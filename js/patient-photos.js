/* =========================================================
   FOTO PAZIENTE — salvataggio locale, gratuito, a basso consumo di spazio

   Perché non si saturava lo spazio prima:
   - localStorage ha un limite di circa 5 MB e una foto di fotocamera
     (3-6 MB, poi +33% in base64) lo riempie al primo scatto.
   - Qui ogni foto viene ridimensionata e ricompressa (WebP, in
     alternativa JPEG) e salvata come Blob in IndexedDB, che ha una
     quota di centinaia di MB (dipende dal dispositivo).

   Tutto resta sul dispositivo: nessun server, nessun costo.
   Ricomprimere via canvas elimina anche i metadati EXIF (GPS incluso).
========================================================= */

(function () {
    "use strict";

    const DB_NAME = "nursing-patient-photos";
    const DB_VERSION = 1;
    const STORE = "photos";

    // Lato massimo e qualità: leggibili per documentare una medicazione,
    // ma ~30-50 volte più leggere dell'originale.
    const MAX_SIDE = 1280;
    const QUALITY_STEPS = [0.74, 0.62, 0.5];
    const FALLBACK_MAX_SIDE = 960;
    const TARGET_BYTES = 220 * 1024;

    // Sotto questa soglia di spazio libero avvisiamo prima di salvare.
    const LOW_SPACE_BYTES = 15 * 1024 * 1024;

    class PhotoError extends Error {
        constructor(code, message) {
            super(message);
            this.name = "PhotoError";
            this.code = code;
        }
    }

    /* ---------- IndexedDB ---------- */

    let dbPromise = null;

    function openDb() {
        if (dbPromise) return dbPromise;

        dbPromise = new Promise((resolve, reject) => {
            if (!("indexedDB" in window)) {
                reject(new PhotoError(
                    "unsupported",
                    "Questo browser non permette di salvare le foto sul dispositivo."
                ));
                return;
            }

            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = () => {
                const db = request.result;

                if (!db.objectStoreNames.contains(STORE)) {
                    const store = db.createObjectStore(STORE, { keyPath: "id" });
                    store.createIndex("patientId", "patientId", { unique: false });
                }
            };

            request.onsuccess = () => resolve(request.result);

            request.onerror = () => {
                dbPromise = null;
                reject(request.error || new PhotoError("db", "Database foto non disponibile."));
            };
        });

        return dbPromise;
    }

    function runTransaction(mode, work) {
        return openDb().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, mode);
            let result;

            try {
                result = work(tx.objectStore(STORE));
            } catch (error) {
                reject(error);
                return;
            }

            tx.oncomplete = () => {
                resolve(result && "result" in result ? result.result : result);
            };

            tx.onerror = () => reject(tx.error || new PhotoError("db", "Operazione non riuscita."));
            tx.onabort = () => reject(tx.error || new PhotoError("db", "Operazione annullata."));
        }));
    }

    function isQuotaError(error) {
        return Boolean(error) && (
            error.name === "QuotaExceededError" ||
            error.code === 22 ||
            error.code === 1014 ||
            /quota/i.test(String(error.message || ""))
        );
    }

    /* ---------- Spazio disponibile ---------- */

    async function getStorageInfo() {
        const info = {
            supported: false,
            usage: 0,
            quota: 0,
            free: Infinity,
            persisted: false
        };

        try {
            if (navigator.storage?.estimate) {
                const estimate = await navigator.storage.estimate();
                info.supported = true;
                info.usage = estimate.usage || 0;
                info.quota = estimate.quota || 0;
                info.free = info.quota ? Math.max(0, info.quota - info.usage) : Infinity;
            }

            if (navigator.storage?.persisted) {
                info.persisted = await navigator.storage.persisted();
            }
        } catch (_) {}

        return info;
    }

    // Chiede al browser di non cancellare i dati sotto pressione di spazio.
    // Senza questo, in alcuni browser le foto possono sparire da sole.
    async function requestPersistence() {
        try {
            if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
                return await navigator.storage.persist();
            }
        } catch (_) {}

        return false;
    }

    function formatBytes(bytes) {
        if (!Number.isFinite(bytes)) return "—";
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
        if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + " MB";
        return (bytes / 1024 / 1024 / 1024).toFixed(2) + " GB";
    }

    /* ---------- Compressione ---------- */

    async function decodeImage(file) {
        if ("createImageBitmap" in window) {
            try {
                return await createImageBitmap(file, { imageOrientation: "from-image" });
            } catch (_) {
                // Si ripiega su <img> qui sotto.
            }
        }

        return await new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const image = new Image();

            image.onload = () => {
                URL.revokeObjectURL(url);
                resolve(image);
            };

            image.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new PhotoError("decode", "Impossibile leggere questa immagine."));
            };

            image.src = url;
        });
    }

    function canvasToBlob(canvas, type, quality) {
        return new Promise(resolve => canvas.toBlob(resolve, type, quality));
    }

    function drawScaled(source, maxSide) {
        const width = source.naturalWidth || source.width;
        const height = source.naturalHeight || source.height;
        const scale = Math.min(1, maxSide / Math.max(width, height));

        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));

        const context = canvas.getContext("2d");
        context.imageSmoothingQuality = "high";
        context.drawImage(source, 0, 0, canvas.width, canvas.height);

        return canvas;
    }

    // Prova WebP; se il browser lo ignora (restituisce PNG) usa JPEG.
    async function encode(canvas, quality) {
        const webp = await canvasToBlob(canvas, "image/webp", quality);
        if (webp && webp.type === "image/webp") return webp;

        const jpeg = await canvasToBlob(canvas, "image/jpeg", quality);
        if (jpeg) return jpeg;

        throw new PhotoError("encode", "Impossibile comprimere l'immagine.");
    }

    async function compressImage(file, options = {}) {
        // Alcuni telefoni Android restituiscono file senza tipo MIME: si prova
        // comunque a decodificarli invece di rifiutarli.
        const type = String((file && file.type) || "");
        if (!file || (type && !type.startsWith("image/"))) {
            throw new PhotoError("type", "Il file scelto non è un'immagine.");
        }

        const source = await decodeImage(file);

        try {
            let canvas = drawScaled(source, options.maxSide || MAX_SIDE);
            let best = null;

            for (const quality of (options.quality ? [options.quality] : QUALITY_STEPS)) {
                best = await encode(canvas, quality);
                if (best.size <= TARGET_BYTES) break;
            }

            // Foto ancora pesante (scena molto dettagliata): riduce la risoluzione.
            if (!options.maxSide && best.size > TARGET_BYTES * 1.6) {
                canvas = drawScaled(source, FALLBACK_MAX_SIDE);
                best = await encode(canvas, QUALITY_STEPS[QUALITY_STEPS.length - 1]);
            }

            return {
                blob: best,
                width: canvas.width,
                height: canvas.height,
                originalBytes: file.size
            };
        } finally {
            if (typeof source.close === "function") source.close();
        }
    }

    /* ---------- API ---------- */

    function createId() {
        if (window.crypto?.randomUUID) return window.crypto.randomUUID();
        return "ph-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
    }

    async function addPhoto(patientId, file, note = "") {
        if (!patientId) throw new PhotoError("patient", "Paziente non valido.");

        const compressed = await compressImage(file);

        const buildRecord = data => ({
            id: createId(),
            patientId: String(patientId),
            createdAt: new Date().toISOString(),
            note: String(note || "").trim().slice(0, 120),
            width: data.width,
            height: data.height,
            size: data.blob.size,
            blob: data.blob
        });

        // Nessun controllo preventivo: navigator.storage.estimate() è una stima
        // e su Android con poca memoria libera dà quote bassissime anche quando
        // una foto da ~250 KB si salverebbe senza problemi. Si prova a scrivere
        // e si reagisce solo a un rifiuto reale del browser.
        let record = buildRecord(compressed);

        try {
            await runTransaction("readwrite", store => store.put(record));
        } catch (error) {
            if (!isQuotaError(error)) throw error;

            // Ritenta una volta con una versione molto più piccola (~60-80 KB).
            try {
                const small = await compressImage(file, { maxSide: 800, quality: 0.45 });
                record = buildRecord(small);
                await runTransaction("readwrite", store => store.put(record));
            } catch (retryError) {
                if (!isQuotaError(retryError)) throw retryError;

                const info = await getStorageInfo();
                const free = Number.isFinite(info.free) ? info.free : null;

                throw new PhotoError(
                    "quota",
                    "Memoria del telefono insufficiente" +
                    (free !== null ? " (liberi circa " + formatBytes(free) + ")" : "") +
                    ". Libera spazio sul telefono (app, foto, download) oppure elimina " +
                    "le foto salvate qui, poi riprova."
                );
            }
        }

        // Dopo il primo salvataggio riuscito chiede la persistenza dei dati.
        requestPersistence();

        return {
            record,
            originalBytes: compressed.originalBytes
        };
    }

    async function listPhotos(patientId) {
        const records = await runTransaction("readonly", store =>
            store.index("patientId").getAll(String(patientId))
        );

        return (records || []).sort((a, b) =>
            String(b.createdAt).localeCompare(String(a.createdAt))
        );
    }

    // Aggiorna solo la nota di una foto già salvata (la foto non viene toccata).
    function updateNote(id, note) {
        const clean = String(note || "").trim().slice(0, 120);

        return openDb().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, "readwrite");
            const store = tx.objectStore(STORE);
            const request = store.get(id);

            request.onsuccess = () => {
                const record = request.result;

                if (!record) {
                    tx.abort();
                    reject(new PhotoError("missing", "Foto non trovata."));
                    return;
                }

                record.note = clean;
                store.put(record);
            };

            tx.oncomplete = () => resolve(clean);
            tx.onerror = () => reject(tx.error || new PhotoError("db", "Operazione non riuscita."));
            tx.onabort = () => reject(tx.error || new PhotoError("db", "Operazione annullata."));
        }));
    }

    function deletePhoto(id) {
        return runTransaction("readwrite", store => store.delete(id));
    }

    async function removeAllForPatient(patientId) {
        try {
            await runTransaction("readwrite", store => {
                const request = store.index("patientId").openKeyCursor(IDBKeyRange.only(String(patientId)));

                request.onsuccess = () => {
                    const cursor = request.result;
                    if (!cursor) return;
                    store.delete(cursor.primaryKey);
                    cursor.continue();
                };

                return request;
            });
        } catch (_) {}
    }

    async function clearAll() {
        try {
            await runTransaction("readwrite", store => store.clear());
        } catch (_) {}
    }

    window.PatientPhotos = {
        PhotoError,
        LOW_SPACE_BYTES,
        addPhoto,
        listPhotos,
        deletePhoto,
        updateNote,
        removeAllForPatient,
        clearAll,
        getStorageInfo,
        formatBytes,
        // esposti per i test
        _compressImage: compressImage,
        _isQuotaError: isQuotaError
    };
})();
