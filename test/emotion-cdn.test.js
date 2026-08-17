const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  DEFAULT_EMOTION_CDN,
  applyPublicEmotionCdn,
  wrapResponseJson
} = require('../lib/emotion-cdn')

describe('applyPublicEmotionCdn', () => {
  it('defaults an empty public GET_CONFIG EMOTION_CDN', () => {
    const body = applyPublicEmotionCdn('GET_CONFIG', {
      code: 0,
      config: {
        VERSION: '1.7.19',
        EMOTION_CDN: ''
      },
      accessToken: 'token'
    })

    assert.equal(body.config.EMOTION_CDN, DEFAULT_EMOTION_CDN)
    assert.equal(body.accessToken, 'token')
  })

  it('defaults a missing public GET_CONFIG EMOTION_CDN', () => {
    const body = applyPublicEmotionCdn('GET_CONFIG', {
      code: 0,
      config: { VERSION: '1.7.19' }
    })

    assert.equal(body.config.EMOTION_CDN, '/twikoo/owo.json')
  })

  it('keeps an admin-set catalog URL', () => {
    const body = applyPublicEmotionCdn('GET_CONFIG', {
      code: 0,
      config: { EMOTION_CDN: 'https://example.com/owo.json' }
    })

    assert.equal(body.config.EMOTION_CDN, 'https://example.com/owo.json')
  })

  it('does not rewrite admin config or failed responses', () => {
    assert.deepEqual(
      applyPublicEmotionCdn('GET_CONFIG_FOR_ADMIN', {
        code: 0,
        config: { EMOTION_CDN: '' }
      }),
      { code: 0, config: { EMOTION_CDN: '' } }
    )

    assert.deepEqual(
      applyPublicEmotionCdn('GET_CONFIG', {
        code: 1000,
        config: { EMOTION_CDN: '' }
      }),
      { code: 1000, config: { EMOTION_CDN: '' } }
    )
  })
})

describe('wrapResponseJson', () => {
  it('rewrites response.json for GET_CONFIG', () => {
    const sent = []
    const response = wrapResponseJson(
      { body: { event: 'GET_CONFIG' } },
      { json (body) { sent.push(body) } }
    )

    response.json({ code: 0, config: { EMOTION_CDN: '' } })

    assert.deepEqual(sent, [{
      code: 0,
      config: { EMOTION_CDN: '/twikoo/owo.json' }
    }])
  })
})
