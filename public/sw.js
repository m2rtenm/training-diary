const CACHE = 'stride-static-v2'
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg']
const STATIC_PATH = /^\/assets\/[A-Za-z0-9._-]+\.(?:js|css)$/

self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE)
  const index = await fetch('/index.html', { cache: 'no-store' })
  if (!index.ok || !index.headers.get('content-type')?.includes('text/html')) throw new Error('Unable to load app shell')
  const html = await index.text()
  const assets = [...html.matchAll(/(?:src|href)="([^\"]+\.(?:js|css))"/g)]
    .map(match => match[1])
    .filter(path => STATIC_PATH.test(path))
  await cache.addAll([...APP_SHELL, ...assets])
  await self.skipWaiting()
})()))

self.addEventListener('activate', event => event.waitUntil((async () => {
  const keys = await caches.keys()
  await Promise.all(keys.filter(key => key.startsWith('stride-static-') && key !== CACHE).map(key => caches.delete(key)))
  await self.clients.claim()
})()))

self.addEventListener('fetch', event => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.search || url.pathname === '/auth/callback') return

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request)
        if (response.ok && response.headers.get('content-type')?.includes('text/html')) {
          const cache = await caches.open(CACHE)
          event.waitUntil(cache.put('/index.html', response.clone()))
        }
        return response
      } catch {
        return (await caches.match('/index.html')) || new Response('Stride is offline. Reconnect to continue.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
      }
    })())
    return
  }

  if (!STATIC_PATH.test(url.pathname) && !['/manifest.webmanifest', '/icon.svg'].includes(url.pathname)) return
  event.respondWith((async () => {
    const cached = await caches.match(request)
    if (cached) return cached
    try {
      const response = await fetch(request)
      const expectedType = url.pathname.endsWith('.js') ? 'javascript' : url.pathname.endsWith('.css') ? 'text/css' : null
      if (response.ok && (!expectedType || response.headers.get('content-type')?.includes(expectedType))) {
        const cache = await caches.open(CACHE)
        event.waitUntil(cache.put(request, response.clone()))
      }
      return response
    } catch {
      return new Response('This Stride resource is unavailable offline.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    }
  })())
})
