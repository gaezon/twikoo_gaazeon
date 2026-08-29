#!/usr/bin/env bash
set -euo pipefail

# Commit the twikoo-vercel upgrade, force-push a versioned branch, open a
# pull request if needed, and enable auto-merge. `main` is ruleset-protected,
# so this cannot push the default branch. GITHUB_TOKEN can create the PR only
# when the repository setting "Allow GitHub Actions to create and approve
# pull requests" is on. Apply that setting locally with:
#   bash .github/scripts/apply-auto-update-settings.sh
# https://docs.github.com/en/rest/actions/permissions#set-default-workflow-permissions-for-a-repository
# https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/control-permissions-for-github_token

FROM_VERSION="${FROM_VERSION:?FROM_VERSION is required}"
TO_VERSION="${TO_VERSION:?TO_VERSION is required}"

if ! command -v gh >/dev/null; then
  echo "gh is required to open the update pull request" >&2
  exit 1
fi

git config user.name 'github-actions[bot]'
git config user.email 'github-actions[bot]@users.noreply.github.com'

branch="chore/twikoo-vercel-${TO_VERSION}"

# `--force-with-lease` needs current remote-tracking info. A previous run may
# already have pushed this branch (for example after creating the branch but
# failing to open the PR). `actions/checkout` only fetches `main`, so without
# this fetch Git reports "stale info" and rejects the push.
if git ls-remote --exit-code --heads origin "$branch" >/dev/null; then
  git fetch origin "refs/heads/${branch}:refs/remotes/origin/${branch}"
  echo "Fetched existing branch ${branch}"
else
  echo "No existing remote branch ${branch}"
fi

git checkout -B "$branch"
git add package.json package-lock.json
if git diff --cached --quiet; then
  echo "No staged dependency changes" >&2
  exit 1
fi
git commit -m "chore: update twikoo-vercel to latest version"
git push --force-with-lease origin "$branch"

pr_url="$(gh pr list --head "$branch" --state open --json url --jq '.[0].url // empty')"
if [ -z "$pr_url" ]; then
  body="$(printf 'Automated Twikoo upgrade from %s to %s.\n\n`main` is protected by the repository ruleset, so this workflow opens a pull request instead of pushing the default branch. Auto-merge is enabled and will complete after the required `test` check passes.\n' "$FROM_VERSION" "$TO_VERSION")"
  pr_url="$(
    gh pr create \
      --base main \
      --head "$branch" \
      --title "chore: update twikoo-vercel to latest version" \
      --body "$body"
  )"
fi

if [ -z "$pr_url" ]; then
  echo "Failed to create or locate the update pull request for ${branch}" >&2
  exit 1
fi

echo "url=$pr_url"
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "url=$pr_url" >> "$GITHUB_OUTPUT"
fi

if ! gh pr merge "$pr_url" --merge --auto --delete-branch; then
  echo "Failed to enable auto-merge. Enable it on the repository, then re-run this workflow." >&2
  echo "Apply locally: bash .github/scripts/apply-auto-update-settings.sh" >&2
  exit 1
fi

# Pull requests opened with GITHUB_TOKEN leave the pull_request CI run in
# `action_required` until a write-access actor approves it. Auto-merge waits
# for that suite, so a separate workflow_dispatch `test` check is not enough.
# https://docs.github.com/en/rest/actions/workflow-runs#approve-a-workflow-run-for-a-fork-pull-request
repo="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
head_sha="$(git rev-parse HEAD)"
run_id=""
for _ in $(seq 1 15); do
  run_id="$(
    gh run list --workflow CI --event pull_request --branch "$branch" --limit 10 \
      --json databaseId,headSha \
      --jq "[.[] | select(.headSha == \"${head_sha}\")][0].databaseId // empty"
  )"
  if [ -n "$run_id" ]; then
    break
  fi
  sleep 2
done

if [ -z "$run_id" ]; then
  echo "Timed out waiting for the pull_request CI run on ${head_sha}" >&2
  exit 1
fi

if ! gh api --method POST "repos/${repo}/actions/runs/${run_id}/approve" >/dev/null; then
  echo "Failed to approve CI run ${run_id} for ${pr_url}" >&2
  exit 1
fi
echo "Approved CI run ${run_id}"

# Merges authenticated with GITHUB_TOKEN do not start `push` workflows, so
# neither CI nor the Vercel deploy would run on `main`. Wait for the approved
# check, then dispatch deploy after auto-merge lands.
# https://docs.github.com/en/actions/using-workflows/triggering-a-workflow#triggering-a-workflow-from-a-workflow
# Approval restarts an `action_required` run; wait until jobs actually start
# before `gh run watch`, otherwise it can exit on the previous conclusion.
for _ in $(seq 1 20); do
  status="$(gh run view "$run_id" --json status,conclusion --jq '[.status, .conclusion] | join(" ")')"
  case "$status" in
    "in_progress "*|"queued "*|"pending "*|"waiting "*|"completed success")
      break
      ;;
    "completed action_required"|"completed "|"completed null")
      sleep 2
      ;;
    "completed "*)
      echo "CI run ${run_id} concluded ${status} for ${pr_url}" >&2
      exit 1
      ;;
    *)
      sleep 2
      ;;
  esac
done

if ! gh run watch "$run_id" --exit-status; then
  echo "CI run ${run_id} failed for ${pr_url}" >&2
  exit 1
fi

merged=false
for _ in $(seq 1 12); do
  state="$(gh pr view "$pr_url" --json state --jq .state)"
  if [ "$state" = MERGED ]; then
    merged=true
    break
  fi
  if [ "$state" = CLOSED ]; then
    break
  fi
  sleep 5
done

echo "merged=$merged"
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "merged=$merged" >> "$GITHUB_OUTPUT"
fi

if [ "$merged" != true ]; then
  echo "Pull request did not merge after CI passed: ${pr_url}" >&2
  exit 1
fi

gh workflow run "Deploy Twikoo to Vercel" --ref main
