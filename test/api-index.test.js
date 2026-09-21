const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const handler = require('../api/index')
const twikoo = require('twikoo-vercel')
const createApiHandler = handler.createApiHandler

describe('twikoo-vercel adapter compatibility', () => {
  it('keeps a callable CommonJS handler and Vercel factory export', () => {
    assert.equal(typeof twikoo, 'function')
    assert.equal(typeof twikoo.createVercelFunc, 'function')
  })
})

describe('api/index handler', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  function createMockResponse () {
    const headers = {}
    let statusCode = null
    let ended = false
    let body = null
    const res = {
      headers,
      setHeader (key, value) {
        headers[key] = value
      },
      status (code) {
        statusCode = code
        return res
      },
      end () {
        ended = true
        return res
      },
      json (value) {
        body = value
        return res
      },
      getStatusCode () {
        return statusCode
      },
      isEnded () {
        return ended
      },
      getBody () {
        return body
      }
    }
    return res
  }

  function createRealTwikooHandler (config = {}) {
    const database = {
      async init () {},
      async getConfig () {
        return config
      }
    }
    return createApiHandler(twikoo.createVercelFunc({ database }))
  }

  async function invokeVersion (origin, config = {}) {
    const response = createMockResponse()
    await createRealTwikooHandler(config)(
      {
        method: 'POST',
        headers: {
          origin
        },
        body: {
          event: 'GET_FUNC_VERSION'
        }
      },
      response
    )
    return response
  }

  it('short-circuits OPTIONS requests with 204 and CORS headers for allowed origin', async () => {
    process.env.CORS_ALLOW_ORIGIN = 'https://example.com'
    const request = {
      method: 'OPTIONS',
      headers: {
        origin: 'https://example.com'
      }
    }
    const response = createMockResponse()

    await handler(request, response)

    assert.equal(response.getStatusCode(), 204)
    assert.equal(response.isEnded(), true)
    assert.equal(response.headers['Vary'], 'Origin')
    assert.equal(response.headers['Cache-Control'], 'no-store')
    assert.equal(response.headers['Access-Control-Allow-Origin'], 'https://example.com')
    assert.equal(response.headers['Access-Control-Max-Age'], '600')
    assert.equal(response.headers['Access-Control-Allow-Credentials'], 'true')
    assert.equal(response.headers['Access-Control-Allow-Methods'], 'POST, GET, OPTIONS')
  })

  it('keeps the custom CORS policy after a real twikoo-vercel ordinary request', async () => {
    process.env.CORS_ALLOW_ORIGIN = 'https://first.example, https://allowed.example/'

    const response = await invokeVersion('https://allowed.example')

    assert.equal(response.getBody().code, 0)
    assert.equal(response.headers['Access-Control-Allow-Origin'], 'https://allowed.example')
    assert.equal(response.headers['Access-Control-Allow-Credentials'], 'true')
    assert.equal(response.headers['Access-Control-Allow-Methods'], 'POST, GET, OPTIONS')
    assert.equal(response.headers['Access-Control-Max-Age'], '600')
    assert.equal(response.headers.Vary, 'Origin')
    assert.equal(response.headers['Cache-Control'], 'no-store')
  })

  it('does not let a real twikoo-vercel request allow a non-whitelisted external origin', async () => {
    process.env.CORS_ALLOW_ORIGIN = 'https://allowed.example'

    const response = await invokeVersion('https://evil.example')

    assert.equal(response.getBody().code, 0)
    assert.equal(response.headers['Access-Control-Allow-Origin'], undefined)
    assert.equal(response.headers['Access-Control-Allow-Credentials'], undefined)
    assert.equal(response.headers['Access-Control-Allow-Methods'], undefined)
    assert.equal(response.headers['Access-Control-Allow-Headers'], undefined)
    assert.equal(response.headers['Access-Control-Max-Age'], undefined)
    assert.equal(response.headers.Vary, 'Origin')
    assert.equal(response.headers['Cache-Control'], 'no-store')
  })

  it('does not inherit twikoo-vercel fallback access when no allowlist is configured', async () => {
    delete process.env.CORS_ALLOW_ORIGIN
    delete process.env.TWIKOO_CORS_ALLOW_ORIGIN

    const response = await invokeVersion('https://unconfigured.example')

    assert.equal(response.getBody().code, 0)
    assert.equal(response.headers['Access-Control-Allow-Origin'], undefined)
    assert.equal(response.headers['Access-Control-Allow-Credentials'], undefined)
    assert.equal(response.headers['Access-Control-Allow-Methods'], undefined)
    assert.equal(response.headers['Access-Control-Allow-Headers'], undefined)
    assert.equal(response.headers['Access-Control-Max-Age'], undefined)
  })

  it('keeps localhost allowed through a real twikoo-vercel ordinary request', async () => {
    delete process.env.CORS_ALLOW_ORIGIN
    delete process.env.TWIKOO_CORS_ALLOW_ORIGIN

    const response = await invokeVersion('http://localhost:3000')

    assert.equal(response.getBody().code, 0)
    assert.equal(response.headers['Access-Control-Allow-Origin'], 'http://localhost:3000')
    assert.equal(response.headers['Access-Control-Allow-Credentials'], 'true')
    assert.equal(response.headers['Access-Control-Allow-Methods'], 'POST, GET, OPTIONS')
  })

  it('keeps wildcard behavior authoritative through a real twikoo-vercel ordinary request', async () => {
    process.env.CORS_ALLOW_ORIGIN = '*'

    const response = await invokeVersion('https://anywhere.example')

    assert.equal(response.getBody().code, 0)
    assert.equal(response.headers['Access-Control-Allow-Origin'], '*')
    assert.equal(response.headers['Access-Control-Allow-Credentials'], undefined)
    assert.equal(response.headers['Access-Control-Allow-Methods'], 'POST, GET, OPTIONS')
  })
})
