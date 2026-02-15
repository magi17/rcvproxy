import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

// Global CORS middleware
app.use('*', cors({
  origin: '*',
  allowHeaders: ['*'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  maxAge: 600,
}))

// Universal proxy route
app.all('*', async (c) => {
  try {
    const targetUrl = c.req.query('url')
    if (!targetUrl) {
      return c.json({ error: 'Missing ?url parameter' }, 400)
    }

    let url
    try {
      url = new URL(targetUrl)
    } catch {
      return c.json({ error: 'Invalid URL' }, 400)
    }

    // Clone request headers (excluding host header)
    const headers = new Headers(c.req.header())
    headers.delete('host')

    // Handle body for non-GET/HEAD
    let body = null
    if (!['GET', 'HEAD'].includes(c.req.method)) {
      const contentType = headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        body = JSON.stringify(await c.req.json())
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        body = await c.req.text()
      } else if (contentType.includes('multipart/form-data')) {
        body = await c.req.formData()
      } else {
        body = await c.req.arrayBuffer()
      }
    }

    // Forward request
    const response = await fetch(url.toString(), {
      method: c.req.method,
      headers,
      body,
    })

    // Clone response headers and inject CORS
    const newHeaders = new Headers(response.headers)
    newHeaders.set('Access-Control-Allow-Origin', '*')
    newHeaders.set('Access-Control-Allow-Methods', '*')
    newHeaders.set('Access-Control-Allow-Headers', '*')

    return new Response(response.body, {
      status: response.status,
      headers: newHeaders,
    })
  } catch (err) {
    return c.json({ error: 'Proxy request failed', details: err.message }, 500)
  }
})

export default app
