const CACHE_NAME = "nursing-app-cache-v5";

const CORE_FILES = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./manifest.json",
    "./icon.svg",
    "./icon-192.png",
    "./icon-512.png",
    "./data/categories.json",
    "./data/ecg.json",
    "./data/farmaci.json",
    "./data/laboratorio.json",
    "./data/emergenze.json"
];


/* =========================================================
   INSTALLAZIONE
========================================================= */

self.addEventListener("install", event => {

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(CORE_FILES))
    );

    self.skipWaiting();

});


/* =========================================================
   ATTIVAZIONE
========================================================= */

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
            .then(() => self.clients.claim())
    );

});


/* =========================================================
   RICHIESTE DI RISORSE
========================================================= */

self.addEventListener("fetch", event => {

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

                    const responseCopy =
                        networkResponse.clone();

                    caches.open(CACHE_NAME)
                        .then(cache => {

                            cache.put(
                                event.request,
                                responseCopy
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

                        /*
                         * Se siamo offline e l'utente apre
                         * un URL con ?state=... o ?item=...,
                         * restituiamo comunque index.html.
                         * L'app poi legge i parametri dell'URL.
                         */

                        if (event.request.mode === "navigate") {
                            return caches.match("./index.html");
                        }

                        return new Response(
                            "Risorsa non disponibile offline.",
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
