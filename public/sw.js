self.addEventListener("install", (e) => {
    e.waitUntil(
        caches
            .open(CACHE)
            .then((c) => c.addAll(PRECACHE_URLS))
            .catch(() => {})
    );
    self.skipWaiting();
});

self.addEventListener("activate", (e) => {
    e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
    self.clients.claim();
});

self.addEventListener("fetch", (e) => {
    const req = e.request;
    if (req.method !== "GET") return;
    const url = new URL(req.url);
    if (url.origin !== location.origin) return;

    e.respondWith(
        caches.match(req).then((cached) => {
            if (cached) return cached;
            return fetch(req)
                .then((resp) => {
                    if (resp && resp.ok) {
                        const copy = resp.clone();
                        caches
                            .open(CACHE)
                            .then((c) => c.put(req, copy))
                            .catch(() => {});
                    }
                    return resp;
                })
                .catch(() => cached);
        })
    );
});
