// Minimal service worker: cache the app shell for offline start; API calls always go to network.
const CACHE = 'smartmotor-v1'
const SHELL = ['/', '/index.html', '/icon.svg', '/manifest.webmanifest']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))))
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api') || url.pathname.startsWith('/ws')) return
  e.respondWith(
    fetch(e.request)
      .then((resp) => {
        const copy = resp.clone()
        caches.open(CACHE).then((c) => c.put(e.request, copy))
        return resp
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('/index.html'))),
  )
})
