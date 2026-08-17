const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const settingPath = path.join(__dirname, '../.github/security/push-protection.json')
const setting = JSON.parse(fs.readFileSync(settingPath, 'utf8'))

describe('push protection setting', () => {
  it('only updates security analysis features', () => {
    assert.deepEqual(Object.keys(setting), ['security_and_analysis'])
    assert.deepEqual(Object.keys(setting.security_and_analysis).sort(), [
      'secret_scanning',
      'secret_scanning_push_protection'
    ])
  })

  it('keeps secret scanning on so push protection can run', () => {
    assert.equal(setting.security_and_analysis.secret_scanning.status, 'enabled')
  })

  it('enables secret scanning push protection', () => {
    assert.equal(
      setting.security_and_analysis.secret_scanning_push_protection.status,
      'enabled'
    )
  })
})
