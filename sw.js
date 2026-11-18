const CACHE = "rootine-grow-journal-v2";
const PRECACHE_URLS = ["./", "./index.html"];

self.addEventListener("install", (e) => {
    e.waitUntil(
        caches
            .open(CACHE)
            .then((c) => c.addAll(PRECACHE_URLS))
            .catch(() => { })
    );
    self.skipWaiting();
});

self.addEventListener("activate", (e) => {
    e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("rootine-grow-journal-") && k !== CACHE).map((k) => caches.delete(k)))));
    self.clients.claim();
});

self.addEventListener("fetch", (e) => {
    const req = e.request;
    if (req.method !== "GET") return;
    const url = new URL(req.url);
    if (url.origin !== location.origin) return;

    if (req.mode === "navigate") {
        e.respondWith(
            fetch(req)
                .then((resp) => {
                    if (resp && resp.ok) caches.open(CACHE).then((c) => c.put(req, resp.clone())).catch(() => { });
                    return resp;
                })
                .catch(() => caches.match(req).then((cached) => cached || caches.match("./index.html")))
        );
        return;
    }

    e.respondWith(
        caches.match(req).then(
            (cached) =>
                cached ||
                fetch(req).then((resp) => {
                    if (resp && resp.ok) caches.open(CACHE).then((c) => c.put(req, resp.clone())).catch(() => { });
                    return resp;
                })
        )
    );
});
