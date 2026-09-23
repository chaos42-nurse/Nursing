const CACHE_NAME = "nursing-nfc";

const CORE_FILES = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./manifest.json",
    "./icon.svg",
    "./data/categories.json"
];


/* =========================
   INSTALLAZIONE
========================= */

self.addEventListener("install", event => {

    event.waitUntil(

        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(CORE_FILES))

    );

    self.skipWaiting();

});


/* =========================
   ATTIVAZIONE
========================= */

self.addEventListener("activate", event => {

    event.waitUntil(

        caches.keys()
            .then(cacheNames => {

                return Promise.all(

                    cacheNames
                        .filter(name => name !== CACHE_NAME)
                        .map(name => caches.delete(name))

                );

            })

    );

    self.clients.claim();

});


/* =========================
   RICHIESTE
========================= */

self.addEventListener("fetch", event => {

    /*
     * Per le richieste GET usiamo:
     *
     * ONLINE  → prova prima Internet
     * OFFLINE → usa la cache
     */

    if (event.request.method !== "GET") {
        return;
    }

    event.respondWith(

        fetch(event.request)

            .then(networkResponse => {

                if (
                    networkResponse &&
                    networkResponse.status === 200 &&
                    networkResponse.type !== "opaque"
                ) {

                    const copy =
                        networkResponse.clone();

                    caches.open(CACHE_NAME)
                        .then(cache => {

                            cache.put(
                                event.request,
                                copy
                            );

                        });

                }

                return networkResponse;

            })

            .catch(() => {

                return caches.match(event.request)

                    .then(cachedResponse => {

                        if (cachedResponse) {

                            return cachedResponse;

                        }

                        return new Response(
                            "Sei offline e questa risorsa non è ancora disponibile.",
                            {
                                status: 503,
                                headers: {
                                    "Content-Type":
                                        "text/plain; charset=utf-8"
                                }
                            }
                        );

                    });

            })

    );

});
