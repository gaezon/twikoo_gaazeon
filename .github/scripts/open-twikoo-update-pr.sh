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

if ! gh pr merge "$pr_url" --merge --auto; then
  echo "Failed to enable auto-merge. Enable it on the repository, then re-run this workflow." >&2
  echo "Apply locally: bash .github/scripts/apply-auto-update-settings.sh" >&2
  exit 1
fi

# Do not occupy the runner waiting for CI. Auto-merge completes after `test`.
merged=false
state="$(gh pr view "$pr_url" --json state --jq .state)"
if [ "$state" = MERGED ]; then
  merged=true
fi

echo "merged=$merged"
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "merged=$merged" >> "$GITHUB_OUTPUT"
fi
