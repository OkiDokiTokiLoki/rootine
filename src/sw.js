export async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    if ("file:" === location.protocol) return;

    let fingerprint;
    try {
        fingerprint = await computeFingerprint(["./", "./index.html"]);
    } catch {
        return;
    }

    const cacheName = `rootine-grow-journal-${fingerprint}`;

    let source;
    try {
        source = await fetch("/sw.js", { cache: "no-cache" }).then((r) => {
            if (!r.ok) throw new Error(`Failed to fetch /sw.js: ${r.status}`);
            return r.text();
        });
    } catch {
        return;
    }

    const patched = source.replace(/const CACHE = "[^"]*";/, `const CACHE = ${JSON.stringify(cacheName)};`).replace(/const PRECACHE_URLS = \[[^\]]*\];/, `const PRECACHE_URLS = ${JSON.stringify(["./", "./index.html"])};`);

    const blob = new Blob([patched], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    try {
        await navigator.serviceWorker.register(url);
    } catch {}
}

async function computeFingerprint(urls) {
    const responses = await Promise.all(
        urls.map(async (url) => {
            const r = await fetch(url, { cache: "no-cache" });
            if (!r.ok) throw new Error(`Failed to fetch ${url}: ${r.status}`);
            return new Uint8Array(await r.arrayBuffer());
        })
    );

    let hash = 2166136261;
    for (const bytes of responses) {
        for (let i = 0; i < bytes.length; i++) {
            hash ^= bytes[i];
            hash = Math.imul(hash, 16777619);
        }
    }
    return (hash >>> 0).toString(36);
}
