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
            .then(cache => {

                return cache.addAll(CORE_FILES);

            })

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

    event.respondWith(

        caches.match(event.request)
            .then(cachedResponse => {

                /*
                 * Se abbiamo già la risorsa,
                 * usiamo quella offline.
                 */
                if (cachedResponse) {

                    return cachedResponse;

                }


                /*
                 * Altrimenti proviamo a
                 * scaricarla da Internet.
                 */
                return fetch(event.request)

                    .then(networkResponse => {

                        /*
                         * Salviamo automaticamente
                         * la nuova risorsa nella cache.
                         */
                        if (
                            networkResponse &&
                            networkResponse.status === 200 &&
                            networkResponse.type !== "opaque"
                        ) {

                            const responseToCache =
                                networkResponse.clone();

                            caches.open(CACHE_NAME)
                                .then(cache => {

                                    cache.put(
                                        event.request,
                                        responseToCache
                                    );

                                });

                        }

                        return networkResponse;

                    })

                    .catch(() => {

                        /*
                         * Se siamo offline e la risorsa
                         * non è mai stata memorizzata,
                         * restituiamo una risposta semplice.
                         */
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
