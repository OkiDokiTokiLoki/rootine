export async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    if ("file:" === location.protocol) return;
    const base = import.meta.env.BASE_URL;
    const workerUrl = new URL(`${base}sw.js`, location.origin);
    try {
        const registration = await navigator.serviceWorker.register(workerUrl, {
            scope: base,
            updateViaCache: "none",
        });
        await registration.update();
    } catch (error) {
        console.warn("Service worker registration failed:", error);
    }
}
