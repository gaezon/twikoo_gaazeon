const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const workflowPath = path.join(__dirname, '../.github/workflows/auto-update.yml')
const workflow = fs.readFileSync(workflowPath, 'utf8')
const scriptPath = path.join(__dirname, '../.github/scripts/open-twikoo-update-pr.sh')
const script = fs.readFileSync(scriptPath, 'utf8')
const workflowPermissionsPath = path.join(__dirname, '../.github/settings/workflow-permissions.json')
const workflowPermissions = JSON.parse(fs.readFileSync(workflowPermissionsPath, 'utf8'))
const autoMergePath = path.join(__dirname, '../.github/settings/auto-merge.json')
const autoMerge = JSON.parse(fs.readFileSync(autoMergePath, 'utf8'))

describe('auto-update workflow permissions', () => {
  it('keeps default GITHUB_TOKEN permissions read-only', () => {
    assert.equal(workflowPermissions.default_workflow_permissions, 'read')
  })

  it('allows Actions to create pull requests', () => {
    assert.equal(workflowPermissions.can_approve_pull_request_reviews, true)
  })

  it('keeps pull request auto-merge enabled and deletes merged head branches', () => {
    assert.equal(autoMerge.allow_auto_merge, true)
    assert.equal(autoMerge.delete_branch_on_merge, true)
    assert.deepEqual(Object.keys(autoMerge).sort(), [
      'allow_auto_merge',
      'delete_branch_on_merge'
    ])
  })

  it('requests write access for contents, pull requests, and workflow dispatch', () => {
    assert.match(workflow, /actions: write/)
    assert.match(workflow, /contents: write/)
    assert.match(workflow, /pull-requests: write/)
  })
})

describe('auto-update pull request step', () => {
  it('uses the extracted open-pr script', () => {
    assert.match(workflow, /bash \.github\/scripts\/open-twikoo-update-pr\.sh/)
  })

  it('fetches an existing upgrade branch before force-with-lease', () => {
    assert.match(script, /git ls-remote --exit-code --heads origin "\$branch"/)
    assert.match(script, /git fetch origin "refs\/heads\/\$\{branch\}:refs\/remotes\/origin\/\$\{branch\}"/)
    assert.match(script, /git push --force-with-lease origin "\$branch"/)
  })

  it('creates a pull request and enables auto-merge', () => {
    assert.match(script, /gh pr create/)
    assert.match(script, /gh pr merge "\$pr_url" --merge --auto --delete-branch/)
  })

  it('approves the pull_request CI run left in action_required', () => {
    assert.match(script, /gh run list --workflow CI --event pull_request/)
    assert.match(script, /actions\/runs\/\$\{run_id\}\/approve/)
  })

  it('does not approve pull requests or wait on the runner for CI', () => {
    assert.doesNotMatch(script, /gh pr review/)
    assert.doesNotMatch(script, /--approve/)
    assert.doesNotMatch(script, /sleep 10/)
    assert.doesNotMatch(script, /seq 1 36/)
  })

  it('sends a failure Telegram notice after a detected update fails', () => {
    assert.match(workflow, /Notify Telegram \(Failure\)/)
    assert.match(workflow, /failure\(\) && steps\.check_updates\.outputs\.has_updates == 'true'/)
  })
})
