const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const {
  LOCALHOST_REGEX,
  ALLOWED_HEADERS,
  ALLOWED_METHODS,
  MAX_AGE,
  getAllowedOrigin,
  setCorsHeaders,
  handleCors
} = require('../lib/cors')

describe('getAllowedOrigin', () => {
  it('returns empty string for missing or invalid origins', () => {
    assert.equal(getAllowedOrigin(''), '')
    assert.equal(getAllowedOrigin(null), '')
    assert.equal(getAllowedOrigin(undefined), '')
    assert.equal(getAllowedOrigin(123), '')
  })

  it('allows localhost and loopback addresses with any port', () => {
    assert.equal(getAllowedOrigin('http://localhost', 'https://example.com'), 'http://localhost')
    assert.equal(getAllowedOrigin('http://localhost:3000', 'https://example.com'), 'http://localhost:3000')
    assert.equal(getAllowedOrigin('https://127.0.0.1:8080', 'https://example.com'), 'https://127.0.0.1:8080')
    assert.equal(getAllowedOrigin('http://0.0.0.0:5173', 'https://example.com'), 'http://0.0.0.0:5173')
  })

  it('matches origins in whitelist regardless of trailing slashes', () => {
    const whitelist = 'https://example.com, https://blog.example.com/'
    assert.equal(getAllowedOrigin('https://example.com', whitelist), 'https://example.com')
    assert.equal(getAllowedOrigin('https://blog.example.com', whitelist), 'https://blog.example.com')
  })

  it('rejects origins not in whitelist', () => {
    const whitelist = 'https://example.com, https://blog.example.com'
    assert.equal(getAllowedOrigin('https://evil.com', whitelist), '')
    assert.equal(getAllowedOrigin('https://example.org', whitelist), '')
  })

  it('allows requested origin when no whitelist is configured', () => {
    assert.equal(getAllowedOrigin('https://any-site.org', ''), 'https://any-site.org')
    assert.equal(getAllowedOrigin('https://any-site.org', undefined), 'https://any-site.org')
  })
})

describe('setCorsHeaders', () => {
  function createMockResponse () {
    const headers = {}
    return {
      headers,
      setHeader (key, value) {
        headers[key] = value
      }
    }
  }

  it('does nothing when request has no origin', () => {
    const response = createMockResponse()
    setCorsHeaders({ headers: {} }, response)
    assert.deepEqual(response.headers, {})
  })

  it('sets full CORS headers and Vary: Origin for allowed origin', () => {
    const response = createMockResponse()
    setCorsHeaders(
      { headers: { origin: 'https://example.com' } },
      response,
      'https://example.com'
    )

    assert.equal(response.headers['Vary'], 'Origin')
    assert.equal(response.headers['Access-Control-Allow-Origin'], 'https://example.com')
    assert.equal(response.headers['Access-Control-Allow-Credentials'], 'true')
    assert.equal(response.headers['Access-Control-Allow-Methods'], ALLOWED_METHODS)
    assert.equal(response.headers['Access-Control-Allow-Headers'], ALLOWED_HEADERS)
    assert.equal(response.headers['Access-Control-Max-Age'], MAX_AGE)
  })

  it('sets Vary: Origin but omits Access-Control-Allow-Origin for disallowed origin', () => {
    const response = createMockResponse()
    setCorsHeaders(
      { headers: { origin: 'https://disallowed.com' } },
      response,
      'https://example.com'
    )

    assert.equal(response.headers['Vary'], 'Origin')
    assert.equal(response.headers['Access-Control-Allow-Origin'], undefined)
    assert.equal(response.headers['Access-Control-Allow-Credentials'], undefined)
  })
})

describe('handleCors', () => {
  function createMockResponse () {
    const headers = {}
    let statusCode = null
    let ended = false
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
      getStatusCode () {
        return statusCode
      },
      isEnded () {
        return ended
      }
    }
    return res
  }

  it('intercepts OPTIONS preflight and responds with 204', () => {
    const request = {
      method: 'OPTIONS',
      headers: { origin: 'https://example.com' }
    }
    const response = createMockResponse()

    const handled = handleCors(request, response, 'https://example.com')

    assert.equal(handled, true)
    assert.equal(response.getStatusCode(), 204)
    assert.equal(response.isEnded(), true)
    assert.equal(response.headers['Vary'], 'Origin')
    assert.equal(response.headers['Access-Control-Allow-Origin'], 'https://example.com')
    assert.equal(response.headers['Access-Control-Max-Age'], '600')
  })

  it('sets CORS headers on POST requests without terminating early', () => {
    const request = {
      method: 'POST',
      headers: { origin: 'https://example.com' }
    }
    const response = createMockResponse()

    const handled = handleCors(request, response, 'https://example.com')

    assert.equal(handled, false)
    assert.equal(response.getStatusCode(), null)
    assert.equal(response.isEnded(), false)
    assert.equal(response.headers['Vary'], 'Origin')
    assert.equal(response.headers['Access-Control-Allow-Origin'], 'https://example.com')
  })
})

describe('environment variables support', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('respects CORS_ALLOW_ORIGIN env', () => {
    process.env.CORS_ALLOW_ORIGIN = 'https://env-allowed.com'
    assert.equal(getAllowedOrigin('https://env-allowed.com'), 'https://env-allowed.com')
    assert.equal(getAllowedOrigin('https://other.com'), '')
  })

  it('falls back to TWIKOO_CORS_ALLOW_ORIGIN env', () => {
    delete process.env.CORS_ALLOW_ORIGIN
    process.env.TWIKOO_CORS_ALLOW_ORIGIN = 'https://twikoo-env.com'
    assert.equal(getAllowedOrigin('https://twikoo-env.com'), 'https://twikoo-env.com')
    assert.equal(getAllowedOrigin('https://other.com'), '')
  })
})
