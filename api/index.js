const twikoo = require('twikoo-vercel')
const { wrapResponseJson } = require('../lib/emotion-cdn')
const { handleCors } = require('../lib/cors')

// Twikoo 1.7.19 clients XHR GET_CONFIG.EMOTION_CDN and fall back to
// https://owo.imaegoo.com/owo.json when it is empty. Fill the public
// config with the blog-origin catalog so connect-src can stay explicit.
module.exports = async (request, response) => {
  if (handleCors(request, response)) {
    return
  }
  wrapResponseJson(request, response)
  return twikoo(request, response)
}

