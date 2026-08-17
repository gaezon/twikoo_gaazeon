const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rulesetPath = path.join(__dirname, '../.github/rulesets/main.json')
const ruleset = JSON.parse(fs.readFileSync(rulesetPath, 'utf8'))

describe('main ruleset', () => {
  it('protects the default branch', () => {
    assert.equal(ruleset.name, 'Protect main')
    assert.equal(ruleset.target, 'branch')
    assert.equal(ruleset.enforcement, 'active')
    assert.deepEqual(ruleset.conditions.ref_name.include, ['refs/heads/main'])
    assert.deepEqual(ruleset.bypass_actors, [])
  })

  it('blocks deletion and force-pushes', () => {
    const types = ruleset.rules.map((rule) => rule.type)
    assert.ok(types.includes('deletion'))
    assert.ok(types.includes('non_fast_forward'))
  })

  it('requires a pull request without a human review gate', () => {
    const pullRequest = ruleset.rules.find((rule) => rule.type === 'pull_request')
    assert.ok(pullRequest)
    assert.equal(pullRequest.parameters.required_approving_review_count, 0)
    assert.equal(pullRequest.parameters.require_code_owner_review, false)
    assert.equal(pullRequest.parameters.require_last_push_approval, false)
  })

  it('requires the GitHub Actions test check', () => {
    const statusChecks = ruleset.rules.find((rule) => rule.type === 'required_status_checks')
    assert.ok(statusChecks)
    assert.equal(statusChecks.parameters.strict_required_status_checks_policy, true)
    assert.deepEqual(statusChecks.parameters.required_status_checks, [
      {
        context: 'test',
        integration_id: 15368
      }
    ])
  })
})
