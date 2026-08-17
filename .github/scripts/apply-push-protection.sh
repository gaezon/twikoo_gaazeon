#!/usr/bin/env bash
set -euo pipefail

# Apply the repository security_and_analysis payload defined in
# .github/security/push-protection.json. Changing these settings requires
# repository admin, so this is meant to be run locally with an
# admin-authenticated `gh`. Do not store an admin PAT as a repository
# Actions secret or inject it into a workflow: write collaborators can
# read those secrets and trigger workflow_dispatch. The default
# GITHUB_TOKEN cannot enable secret scanning push protection.
# https://docs.github.com/en/rest/repos/repos#update-a-repository
# https://docs.github.com/en/code-security/secret-scanning/introduction/about-push-protection

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SETTING_FILE="${ROOT}/.github/security/push-protection.json"

if ! command -v gh >/dev/null; then
  echo "gh is required to apply push protection" >&2
  exit 1
fi

if ! command -v jq >/dev/null; then
  echo "jq is required to apply push protection" >&2
  exit 1
fi

if [ ! -f "$SETTING_FILE" ]; then
  echo "push protection file not found: $SETTING_FILE" >&2
  exit 1
fi

jq empty "$SETTING_FILE"

if [ "$(jq -r '.security_and_analysis.secret_scanning.status' "$SETTING_FILE")" != "enabled" ]; then
  echo "push protection file must keep secret scanning enabled" >&2
  exit 1
fi

if [ "$(jq -r '.security_and_analysis.secret_scanning_push_protection.status' "$SETTING_FILE")" != "enabled" ]; then
  echo "push protection file must enable secret_scanning_push_protection" >&2
  exit 1
fi

repo="${GITHUB_REPOSITORY:-}"
if [ -z "$repo" ]; then
  repo="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
fi

gh api --method PATCH "repos/${repo}" --input "$SETTING_FILE" >/dev/null

status="$(
  gh api "repos/${repo}" \
    --jq '{
      secret_scanning: .security_and_analysis.secret_scanning.status,
      secret_scanning_push_protection: .security_and_analysis.secret_scanning_push_protection.status
    }'
)"

scanning="$(jq -r .secret_scanning <<<"$status")"
push_protection="$(jq -r .secret_scanning_push_protection <<<"$status")"

if [ "$scanning" != "enabled" ] || [ "$push_protection" != "enabled" ]; then
  echo "Failed to enable push protection on ${repo}: ${status}" >&2
  exit 1
fi

echo "Enabled secret scanning push protection on ${repo}"
