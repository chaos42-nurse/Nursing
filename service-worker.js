const CACHE_NAME = "nursing-v88";

const CORE_FILES = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js?v=88",
    "./js/interazioni.js?v=88",
    "./manifest.json",
    "./icon-192.png",
    "./icon-512.png",
    "./data/categories.json",
    "./data/ecg.json",
    "./data/farmaci.json",
    "./data/laboratorio.json",
    "./data/emergenze.json",
    "./data/version.json",
    "./src/data/aifa-principi-attivi.json",
    "./data/db_drug_interactions.csv.zip",
    "./data/alias-farmaci.json",
    "./data/interazioni-curate.json"
];

self.addEventListener("install", event => {
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_FILES)));
    self.skipWaiting();
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys()
            .then(cacheNames => Promise.all(
                cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", event => {
    if (event.request.method !== "GET") return;

    const protocol = new URL(event.request.url).protocol;
    if (protocol !== "http:" && protocol !== "https:") return;

    event.respondWith(
        fetch(event.request)
            .then(networkResponse => {
                if (networkResponse && networkResponse.status === 200 && networkResponse.type !== "opaque") {
                    const responseCopy = networkResponse.clone();
                    caches.open(CACHE_NAME)
                        .then(cache => cache.put(event.request, responseCopy))
                        .catch(error => console.warn("Impossibile aggiornare la cache:", error));
                }
                return networkResponse;
            })
            .catch(() => caches.match(event.request).then(cachedResponse => {
                if (cachedResponse) return cachedResponse;
                if (event.request.mode === "navigate") return caches.match("./index.html");
                return new Response("Risorsa non disponibile offline.", {
                    status: 503,
                    headers: {"Content-Type": "text/plain; charset=utf-8"}
                });
            }))
    );
});
