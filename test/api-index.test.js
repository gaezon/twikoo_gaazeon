const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const handler = require('../api/index')

describe('api/index handler', () => {
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
      json () {
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

  it('short-circuits OPTIONS requests with 204 and CORS headers', async () => {
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
    assert.equal(response.headers['Access-Control-Allow-Origin'], 'https://example.com')
    assert.equal(response.headers['Access-Control-Max-Age'], '600')
    assert.equal(response.headers['Access-Control-Allow-Credentials'], 'true')
  })
})
