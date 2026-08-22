const LOCALHOST_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d{1,5})?$/
const ALLOWED_HEADERS = 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
const ALLOWED_METHODS = 'POST, GET, OPTIONS'
const MAX_AGE = '600'

function getCorsAllowOriginEnv () {
  return process.env.CORS_ALLOW_ORIGIN || process.env.TWIKOO_CORS_ALLOW_ORIGIN || ''
}

function getAllowedOrigin (origin, corsAllowOrigin = getCorsAllowOriginEnv()) {
  if (!origin || typeof origin !== 'string') return ''
  const trimmedOrigin = origin.trim()
  if (!trimmedOrigin) return ''

  if (LOCALHOST_REGEX.test(trimmedOrigin)) {
    return trimmedOrigin
  }

  const rawConfig = typeof corsAllowOrigin === 'string' ? corsAllowOrigin.trim() : ''
  if (rawConfig) {
    const list = rawConfig
      .split(',')
      .map((item) => item.trim().replace(/\/+$/, ''))
      .filter(Boolean)
    const normalizedOrigin = trimmedOrigin.replace(/\/+$/, '')
    for (const item of list) {
      if (item === normalizedOrigin) {
        return trimmedOrigin
      }
    }
    return ''
  }

  return trimmedOrigin
}

function setCorsHeaders (request, response, corsAllowOrigin = getCorsAllowOriginEnv()) {
  const origin = request && request.headers ? request.headers.origin : undefined
  if (!origin) return

  response.setHeader('Vary', 'Origin')
  const allowedOrigin = getAllowedOrigin(origin, corsAllowOrigin)
  if (allowedOrigin) {
    response.setHeader('Access-Control-Allow-Credentials', 'true')
    response.setHeader('Access-Control-Allow-Origin', allowedOrigin)
    response.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS)
    response.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS)
    response.setHeader('Access-Control-Max-Age', MAX_AGE)
  }
}

function handleCors (request, response, corsAllowOrigin = getCorsAllowOriginEnv()) {
  setCorsHeaders(request, response, corsAllowOrigin)
  if (request && request.method === 'OPTIONS') {
    response.status(204).end()
    return true
  }
  return false
}

module.exports = {
  LOCALHOST_REGEX,
  ALLOWED_HEADERS,
  ALLOWED_METHODS,
  MAX_AGE,
  getCorsAllowOriginEnv,
  getAllowedOrigin,
  setCorsHeaders,
  handleCors
}
