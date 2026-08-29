#!/usr/bin/env bash
set -euo pipefail

# Apply the repository settings that auto-update needs:
# 1. Allow GitHub Actions to create pull requests (and, as a side effect of
#    the same GitHub toggle, approve pull request reviews).
# 2. Keep pull request auto-merge enabled.
# 3. Delete head branches after a pull request is merged.
# Changing these settings requires repository admin, so this is meant to be
# run locally with an admin-authenticated `gh`. Do not store an admin PAT as
# a repository Actions secret or inject it into a workflow: write
# collaborators can read those secrets and trigger workflow_dispatch.
# The default GITHUB_TOKEN cannot change these settings.
# https://docs.github.com/en/rest/actions/permissions#set-default-workflow-permissions-for-a-repository
# https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-permissions-for-your-repository#preventing-github-actions-from-creating-or-approving-pull-requests
# https://docs.github.com/en/rest/repos/repos#update-a-repository

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORKFLOW_PERMISSIONS_FILE="${ROOT}/.github/settings/workflow-permissions.json"
AUTO_MERGE_FILE="${ROOT}/.github/settings/auto-merge.json"

if ! command -v gh >/dev/null; then
  echo "gh is required to apply auto-update settings" >&2
  exit 1
fi

if ! command -v jq >/dev/null; then
  echo "jq is required to apply auto-update settings" >&2
  exit 1
fi

if [ ! -f "$WORKFLOW_PERMISSIONS_FILE" ]; then
  echo "workflow permissions file not found: $WORKFLOW_PERMISSIONS_FILE" >&2
  exit 1
fi

if [ ! -f "$AUTO_MERGE_FILE" ]; then
  echo "auto-merge file not found: $AUTO_MERGE_FILE" >&2
  exit 1
fi

jq empty "$WORKFLOW_PERMISSIONS_FILE"
jq empty "$AUTO_MERGE_FILE"

if [ "$(jq -r .default_workflow_permissions "$WORKFLOW_PERMISSIONS_FILE")" != "read" ]; then
  echo "workflow permissions file must keep default_workflow_permissions=read" >&2
  exit 1
fi

if [ "$(jq -r .can_approve_pull_request_reviews "$WORKFLOW_PERMISSIONS_FILE")" != "true" ]; then
  echo "workflow permissions file must allow Actions to create pull requests" >&2
  exit 1
fi

if [ "$(jq -r .allow_auto_merge "$AUTO_MERGE_FILE")" != "true" ]; then
  echo "auto-merge file must enable allow_auto_merge" >&2
  exit 1
fi

if [ "$(jq -r .delete_branch_on_merge "$AUTO_MERGE_FILE")" != "true" ]; then
  echo "auto-merge file must enable delete_branch_on_merge" >&2
  exit 1
fi

repo="${GITHUB_REPOSITORY:-}"
if [ -z "$repo" ]; then
  repo="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
fi

gh api --method PUT "repos/${repo}/actions/permissions/workflow" --input "$WORKFLOW_PERMISSIONS_FILE"

workflow_permissions="$(gh api "repos/${repo}/actions/permissions/workflow")"
default_permissions="$(jq -r .default_workflow_permissions <<<"$workflow_permissions")"
can_create_or_approve="$(jq -r .can_approve_pull_request_reviews <<<"$workflow_permissions")"

if [ "$default_permissions" != "read" ] || [ "$can_create_or_approve" != "true" ]; then
  echo "Failed to apply workflow permissions on ${repo}: ${workflow_permissions}" >&2
  exit 1
fi

gh api --method PATCH "repos/${repo}" --input "$AUTO_MERGE_FILE" >/dev/null

merge_settings="$(
  gh api "repos/${repo}" --jq '{
    allow_auto_merge: .allow_auto_merge,
    delete_branch_on_merge: .delete_branch_on_merge
  }'
)"
allow_auto_merge="$(jq -r .allow_auto_merge <<<"$merge_settings")"
delete_branch_on_merge="$(jq -r .delete_branch_on_merge <<<"$merge_settings")"
if [ "$allow_auto_merge" != "true" ] || [ "$delete_branch_on_merge" != "true" ]; then
  echo "Failed to enable auto-merge settings on ${repo}: ${merge_settings}" >&2
  exit 1
fi

echo "Enabled Actions pull-request creation, auto-merge, and delete-branch-on-merge on ${repo}"
