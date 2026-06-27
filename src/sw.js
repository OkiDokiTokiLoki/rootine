export async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    if ("file:" === location.protocol) return;
    let e;
    try {
        e = await computeFingerprint(["./", "./index.html"]);
    } catch {
        return;
    }
    const n = `rootine-grow-journal-${e}`,
        t = `\nconst CACHE = ${JSON.stringify(n)};\nconst PRECACHE_URLS = ['./', './index.html'];\n\nself.addEventListener('install', e => {\n  e.waitUntil(\n    caches.open(CACHE).then(c => c.addAll(PRECACHE_URLS)).catch(() => {})\n  );\n  self.skipWaiting();\n});\n\nself.addEventListener('activate', e => {\n  e.waitUntil(\n    caches.keys().then(keys =>\n      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))\n    )\n  );\n  self.clients.claim();\n});\n\n// Cache-first for same-origin GETs, with opportunistic runtime caching\n// for any same-origin asset the SW sees. Cache name is keyed off the\n// precached file contents, so it changes automatically when those files\n// do — no manual version bump required.\nself.addEventListener('fetch', e => {\n  const req = e.request;\n  if (req.method !== 'GET') return;\n  const url = new URL(req.url);\n  if (url.origin !== location.origin) return;\n\n  e.respondWith(\n    caches.match(req).then(cached => {\n      if (cached) return cached;\n      return fetch(req).then(resp => {\n        if (resp && resp.ok) {\n          const copy = resp.clone();\n          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});\n        }\n        return resp;\n      }).catch(() => cached);\n    })\n  );\n});\n`,
        r = new Blob([t], { type: "application/javascript" }),
        c = URL.createObjectURL(r);
    try {
        await navigator.serviceWorker.register(c);
    } catch {}
}
async function computeFingerprint(e) {
    const n = await Promise.all(
        e.map(async (e) => {
            const n = await fetch(e, { cache: "no-cache" });
            if (!n.ok) throw new Error(`Failed to fetch ${e}: ${n.status}`);
            return new Uint8Array(await n.arrayBuffer());
        })
    );
    let t = 2166136261;
    for (const e of n) for (let n = 0; n < e.length; n++) ((t ^= e[n]), (t = Math.imul(t, 16777619)));
    return (t >>> 0).toString(36);
}
