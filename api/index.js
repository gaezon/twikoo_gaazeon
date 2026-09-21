const twikoo = require('twikoo-vercel')
const { wrapResponseJson } = require('../lib/emotion-cdn')
const { handleCors, withCorsHeaderGuard } = require('../lib/cors')

// Twikoo clients request GET_CONFIG.EMOTION_CDN and fall back to
// https://owo.imaegoo.com/owo.json when it is empty. Fill the public
// config with the blog-origin catalog so connect-src can stay explicit.
function createApiHandler (twikooHandler = twikoo) {
  return async (request, response) => {
    if (handleCors(request, response)) {
      return
    }
    wrapResponseJson(request, response)
    return twikooHandler(request, withCorsHeaderGuard(response))
  }
}

const handler = createApiHandler()
handler.createApiHandler = createApiHandler
module.exports = handler
