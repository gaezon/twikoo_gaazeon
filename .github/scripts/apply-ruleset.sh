#!/usr/bin/env bash
set -euo pipefail

# Upsert the repository ruleset defined in .github/rulesets/main.json.
# Creating or updating a ruleset requires repository admin, so this is meant
# to be run locally with `gh` or from Actions with a PAT that can administer
# the repo. The default GITHUB_TOKEN cannot manage rulesets.
# https://docs.github.com/en/rest/repos/rules#create-a-repository-ruleset
# https://docs.github.com/en/rest/repos/rules#update-a-repository-ruleset
# https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RULESET_FILE="${ROOT}/.github/rulesets/main.json"

if ! command -v gh >/dev/null; then
  echo "gh is required to apply the ruleset" >&2
  exit 1
fi

if ! command -v jq >/dev/null; then
  echo "jq is required to apply the ruleset" >&2
  exit 1
fi

if [ ! -f "$RULESET_FILE" ]; then
  echo "ruleset file not found: $RULESET_FILE" >&2
  exit 1
fi

jq empty "$RULESET_FILE"

repo="${GITHUB_REPOSITORY:-}"
if [ -z "$repo" ]; then
  repo="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
fi

name="$(jq -r .name "$RULESET_FILE")"
if [ -z "$name" ] || [ "$name" = "null" ]; then
  echo "ruleset file is missing a name" >&2
  exit 1
fi

existing_id="$(
  gh api "repos/${repo}/rulesets" \
    | jq -r --arg name "$name" '.[] | select(.name == $name) | .id' \
    | head -n 1
)"

if [ -n "$existing_id" ]; then
  gh api --method PUT "repos/${repo}/rulesets/${existing_id}" --input "$RULESET_FILE"
  echo "Updated ruleset ${name} (${existing_id}) on ${repo}"
else
  gh api --method POST "repos/${repo}/rulesets" --input "$RULESET_FILE"
  echo "Created ruleset ${name} on ${repo}"
fi
