export interface Env {
  ADMIN_TOKEN: string
  API_ORIGIN: string
}

const DEFAULT_API_ORIGIN = 'https://bookmarksiteapi.62ichiken.workers.dev'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (!url.pathname.startsWith('/api/')) {
      return new Response(null, { status: 404 })
    }

    const adminToken = env.ADMIN_TOKEN?.trim()
    if (!adminToken) {
      return Response.json(
        { error: { message: 'ADMIN_TOKEN is not configured' } },
        { status: 500 },
      )
    }

    const apiOrigin = (env.API_ORIGIN || DEFAULT_API_ORIGIN).replace(/\/$/, '')
    const targetUrl = `${apiOrigin}${url.pathname}${url.search}`

    const headers = new Headers(request.headers)
    headers.delete('authorization')
    headers.set('Authorization', `Bearer ${adminToken}`)

    return fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    })
  },
} satisfies ExportedHandler<Env>
