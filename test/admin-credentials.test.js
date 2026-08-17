const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const workflowDir = path.join(__dirname, '../.github/workflows')

function workflowFiles () {
  return fs.readdirSync(workflowDir)
    .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
    .map((name) => ({
      name,
      text: fs.readFileSync(path.join(workflowDir, name), 'utf8')
    }))
}

describe('admin credentials stay off Actions', () => {
  it('does not ship apply workflows for rulesets or push protection', () => {
    const names = workflowFiles().map((file) => file.name)
    assert.equal(names.includes('apply-ruleset.yml'), false)
    assert.equal(names.includes('apply-push-protection.yml'), false)
  })

  it('does not inject a repository-admin PAT into any workflow', () => {
    for (const file of workflowFiles()) {
      assert.equal(
        file.text.includes('RULESET_TOKEN'),
        false,
        `${file.name} must not reference RULESET_TOKEN`
      )
      assert.doesNotMatch(
        file.text,
        /apply-(ruleset|push-protection)\.sh/
      )
    }
  })
})
