const DEFAULT_EMOTION_CDN = process.env.TWIKOO_EMOTION_CDN || '/twikoo/owo.json'

function applyPublicEmotionCdn (eventName, body, emotionCdn = DEFAULT_EMOTION_CDN) {
  if (eventName !== 'GET_CONFIG') return body
  if (!body || typeof body !== 'object' || body.code !== 0) return body
  if (!body.config || typeof body.config !== 'object') return body
  if (typeof body.config.EMOTION_CDN === 'string' && body.config.EMOTION_CDN.trim()) {
    return body
  }

  return {
    ...body,
    config: {
      ...body.config,
      EMOTION_CDN: emotionCdn
    }
  }
}

function wrapResponseJson (request, response) {
  const originalJson = response.json.bind(response)
  response.json = (body) => {
    const eventName = request && request.body ? request.body.event : undefined
    return originalJson(applyPublicEmotionCdn(eventName, body))
  }
  return response
}

module.exports = {
  DEFAULT_EMOTION_CDN,
  applyPublicEmotionCdn,
  wrapResponseJson
}
