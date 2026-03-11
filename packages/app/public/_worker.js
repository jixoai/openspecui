export default {
  async fetch(request, env) {
    const assetResponse = await env.ASSETS.fetch(request)
    if (assetResponse.status !== 404) {
      return assetResponse
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return assetResponse
    }

    const url = new URL(request.url)
    const match = url.pathname.match(/^\/versions\/([^/]+)(?:\/.*)?$/)
    if (!match) {
      return assetResponse
    }

    url.pathname = `/versions/${match[1]}/index.html`
    return env.ASSETS.fetch(new Request(url.toString(), request))
  },
}
