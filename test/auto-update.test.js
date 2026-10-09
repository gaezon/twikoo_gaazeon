const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { spawnSync } = require('node:child_process')

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

  it('does not approve pull request reviews', () => {
    assert.doesNotMatch(script, /gh pr review/)
    assert.doesNotMatch(script, /--approve/)
  })

  it('waits for the approved CI run then dispatches Vercel deploy', () => {
    assert.match(script, /gh run view "\$run_id" --json status,conclusion/)
    assert.match(script, /gh run watch "\$run_id" --exit-status/)
    assert.match(script, /gh workflow run "Deploy Twikoo to Vercel" --ref main/)
  })

  it('sends a failure Telegram notice after a detected update fails', () => {
    assert.match(workflow, /Notify Telegram \(Failure\)/)
    assert.match(workflow, /failure\(\) && steps\.check_updates\.outputs\.has_updates == 'true'/)
  })
})

// Run the actual Bash script with isolated command doubles: no network,
// repository writes, real deployment, or wall-clock sleeps.
function runUpdateScript ({ mergeAfterSeconds = 90, closed = false, ciFails = false } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'twikoo-auto-update-'))
  const bin = path.join(directory, 'bin')
  const callsPath = path.join(directory, 'calls.jsonl')
  const outputPath = path.join(directory, 'output')
  fs.mkdirSync(bin)
  fs.writeFileSync(outputPath, '')
  const mock = `#!${process.execPath}
const fs = require('node:fs')
const path = require('node:path')
const command = path.basename(process.argv[1])
const args = process.argv.slice(2)
const callsPath = process.env.MOCK_CALLS_PATH
const calls = fs.existsSync(callsPath)
  ? fs.readFileSync(callsPath, 'utf8').trim().split('\\n').filter(Boolean).map(JSON.parse)
  : []
fs.appendFileSync(callsPath, JSON.stringify({ command, args }) + '\\n')
const elapsed = calls.filter(call => call.command === 'sleep')
  .reduce((total, call) => total + Number(call.args[0]), 0)
if (command === 'sleep') process.exit(0)
if (command === 'git') {
  if (args[0] === 'ls-remote') process.exit(2)
  if (args[0] === 'diff') process.exit(1)
  if (args[0] === 'rev-parse') console.log('test-head-sha')
  process.exit(0)
}
if (args[0] === 'pr' && args[1] === 'list') {
  console.log('https://github.com/gaezon/twikoo_gaazeon/pull/30')
} else if (args[0] === 'pr' && args[1] === 'merge') {
  process.exit(0)
} else if (args[0] === 'run' && args[1] === 'list') {
  console.log('123')
} else if (args[0] === 'api') {
  process.exit(0)
} else if (args[0] === 'run' && args[1] === 'view') {
  console.log('completed success')
} else if (args[0] === 'run' && args[1] === 'watch') {
  process.exit(process.env.MOCK_CI_FAILS === 'true' ? 1 : 0)
} else if (args[0] === 'pr' && args[1] === 'view') {
  const state = process.env.MOCK_CLOSED === 'true' ? 'CLOSED'
    : elapsed >= Number(process.env.MOCK_MERGE_AFTER_SECONDS) ? 'MERGED' : 'OPEN'
  console.log(args[args.indexOf('--json') + 1] === 'state'
    ? state : JSON.stringify({ state, mergeStateStatus: 'BLOCKED' }))
} else if (args[0] === 'workflow' && args[1] === 'run') {
  process.exit(0)
} else {
  console.error('Unexpected mock command: ' + args.join(' '))
  process.exit(1)
}
`
  for (const command of ['git', 'gh', 'sleep']) {
    fs.writeFileSync(path.join(bin, command), mock, { mode: 0o755 })
  }
  try {
    const result = spawnSync('bash', [scriptPath], {
      cwd: directory,
      encoding: 'utf8',
      timeout: 30000,
      env: {
        ...process.env,
        PATH: `${bin}${path.delimiter}${process.env.PATH}`,
        FROM_VERSION: '2.0.12',
        TO_VERSION: '2.0.13',
        GITHUB_REPOSITORY: 'gaezon/twikoo_gaazeon',
        GITHUB_OUTPUT: outputPath,
        MOCK_CALLS_PATH: callsPath,
        MOCK_MERGE_AFTER_SECONDS: String(mergeAfterSeconds),
        MOCK_CLOSED: String(closed),
        MOCK_CI_FAILS: String(ciFails)
      }
    })
    assert.ifError(result.error)
    const calls = fs.readFileSync(callsPath, 'utf8').trim().split('\n').map(JSON.parse)
    return {
      ...result,
      calls,
      output: fs.readFileSync(outputPath, 'utf8'),
      elapsed: calls.filter(call => call.command === 'sleep')
        .reduce((total, call) => total + Number(call.args[0]), 0),
      deployments: calls.filter(call => call.command === 'gh' && call.args[0] === 'workflow')
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
}

describe('auto-update merge waiting and deployment', () => {
  it('deploys once after auto-merge takes longer than one minute', () => {
    const result = runUpdateScript()
    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.elapsed, 90)
    assert.match(result.output, /merged=true/)
    assert.equal(result.deployments.length, 1)
    assert.deepEqual(result.deployments[0].args, ['workflow', 'run', 'Deploy Twikoo to Vercel', '--ref', 'main'])
  })

  it('checks again and deploys when the PR merges at the five-minute boundary', () => {
    const result = runUpdateScript({ mergeAfterSeconds: 300 })
    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.elapsed, 300)
    assert.equal(result.deployments.length, 1)
  })

  it('stops after five minutes without deploying an unmerged PR and reports recovery', () => {
    const result = runUpdateScript({ mergeAfterSeconds: 600 })
    assert.equal(result.status, 1)
    assert.equal(result.elapsed, 300)
    assert.match(result.output, /merged=false/)
    assert.match(result.stderr, /state=OPEN/)
    assert.match(result.stderr, /mergeStateStatus/)
    assert.match(result.stderr, /After the PR merges, run the Deploy Twikoo to Vercel workflow on main/)
    assert.equal(result.deployments.length, 0)
  })

  it('stops immediately if the PR closes without merging', () => {
    const result = runUpdateScript({ closed: true })
    assert.equal(result.status, 1)
    assert.equal(result.elapsed, 0)
    assert.match(result.stderr, /state=CLOSED/)
    assert.equal(result.deployments.length, 0)
  })

  it('never dispatches deployment when CI fails', () => {
    const result = runUpdateScript({ ciFails: true })
    assert.equal(result.status, 1)
    assert.match(result.stderr, /CI run 123 failed/)
    assert.equal(result.deployments.length, 0)
    assert.equal(result.elapsed, 0)
    assert.equal(result.calls.some(call => call.command === 'gh' && call.args[0] === 'pr' && call.args[1] === 'view'), false)
  })
})
