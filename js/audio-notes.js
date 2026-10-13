/* Note vocali: registrazione e salvataggio sul dispositivo (IndexedDB), gratuito e senza server.
   Usate nelle note (segnaposto [[audio:ID]]) e nella sezione medicazioni dei pazienti. */
(function (global) {
    "use strict";

    const DB_NAME = "nursing-audio-notes";
    const STORE = "audio";
    const MAX_SECONDS = 180;
    const BITRATE = 24000;                 // voce: ~180 KB al minuto

    /* ---------- IndexedDB ---------- */

    let dbPromise = null;

    function openDb() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise((resolve, reject) => {
            if (!("indexedDB" in global)) return reject(new Error("Memoria del dispositivo non disponibile."));
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = () => {
                const store = request.result.createObjectStore(STORE, { keyPath: "id" });
                store.createIndex("owner", "owner", { unique: false });
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => { dbPromise = null; reject(request.error); };
        });
        return dbPromise;
    }

    function tx(mode, work) {
        return openDb().then(db => new Promise((resolve, reject) => {
            const t = db.transaction(STORE, mode);
            let result;
            try { result = work(t.objectStore(STORE)); } catch (error) { return reject(error); }
            t.oncomplete = () => resolve(result && "result" in result ? result.result : result);
            t.onerror = () => reject(t.error);
            t.onabort = () => reject(t.error);
        }));
    }

    const createId = () => "au-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
    const isQuota = e => e && (e.name === "QuotaExceededError" || e.code === 22 || /quota/i.test(String(e.message || "")));

    async function save(owner, data, title) {
        const record = {
            id: createId(),
            owner: String(owner),
            createdAt: new Date().toISOString(),
            title: String(title || "").trim().slice(0, 80),
            duration: Math.round(data.duration || 0),
            mime: data.mime || data.blob.type || "audio/webm",
            size: data.blob.size,
            blob: data.blob
        };
        try {
            await tx("readwrite", store => store.put(record));
        } catch (error) {
            if (isQuota(error)) throw new Error("Memoria del telefono insufficiente: libera spazio o elimina qualche nota vocale.");
            throw error;
        }
        return record;
    }

    const get = id => tx("readonly", store => store.get(String(id)));

    async function list(owner) {
        const records = await tx("readonly", store => store.index("owner").getAll(String(owner)));
        return (records || []).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    }

    const remove = id => tx("readwrite", store => store.delete(String(id)));

    async function removeMany(ids) {
        for (const id of ids || []) { try { await remove(id); } catch (_) {} }
    }

    async function removeOwner(owner) {
        try {
            await tx("readwrite", store => {
                const request = store.index("owner").openKeyCursor(IDBKeyRange.only(String(owner)));
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
        try { await tx("readwrite", store => store.clear()); } catch (_) {}
    }

    function rename(id, title) {
        return get(id).then(record => {
            if (!record) return;
            record.title = String(title || "").trim().slice(0, 80);
            return tx("readwrite", store => store.put(record));
        });
    }

    /* ---------- Segnaposto nel testo delle note ---------- */

    const TOKEN = /\[\[(?:audio|img):([\w-]+)\]\]/g;

    function extractIds(value) {
        const text = typeof value === "string" ? value : JSON.stringify(value || "");
        const ids = new Set();
        let m;
        TOKEN.lastIndex = 0;
        while ((m = TOKEN.exec(text)) !== null) ids.add(m[1]);
        return [...ids];
    }

    /* Elimina le note vocali che erano nel vecchio testo e non sono più nel nuovo. */
    function prune(oldText, newText) {
        const keep = new Set(extractIds(newText));
        return removeMany(extractIds(oldText).filter(id => !keep.has(id)));
    }

    /* ---------- Condivisione (file / trasferimento diretto) ---------- */

    function blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
        });
    }

    function base64ToBlob(base64, mime) {
        const bin = atob(base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new Blob([bytes], { type: mime || "audio/webm" });
    }

    async function serialize(record) {
        return {
            id: record.id, owner: record.owner, createdAt: record.createdAt, title: record.title || "",
            duration: record.duration || 0, mime: record.mime, data: await blobToBase64(record.blob)
        };
    }

    async function exportByIds(ids) {
        const out = [];
        for (const id of ids || []) {
            const record = await get(id).catch(() => null);
            if (record) out.push(await serialize(record));
        }
        return out;
    }

    async function exportByOwners(owners) {
        const out = [];
        for (const owner of owners || []) {
            for (const record of await list(owner)) out.push(await serialize(record));
        }
        return out;
    }

    async function importRecords(items) {
        let added = 0, skipped = 0;
        for (const item of Array.isArray(items) ? items : []) {
            if (!item || !item.id || !item.data) continue;
            if (await get(item.id)) { skipped++; continue; }
            const blob = base64ToBlob(item.data, item.mime);
            await tx("readwrite", store => store.put({
                id: String(item.id), owner: String(item.owner || "note"),
                createdAt: String(item.createdAt || new Date().toISOString()),
                title: String(item.title || "").slice(0, 80),
                duration: Number(item.duration) || 0, mime: item.mime || blob.type, size: blob.size, blob
            }));
            added++;
        }
        return { added, skipped };
    }

    /* ---------- Riproduzione (una alla volta) ---------- */

    let current = null;      // { audio, button, url }

    function formatTime(seconds) {
        const s = Math.max(0, Math.round(seconds || 0));
        return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
    }

    function stopCurrent() {
        if (!current) return;
        try { current.audio.pause(); } catch (_) {}
        URL.revokeObjectURL(current.url);
        current.button.classList.remove("is-playing");
        current.button.querySelector(".note-audio-icon").textContent = "▶";
        current = null;
    }

    async function toggle(button) {
        if (current && current.button === button) return stopCurrent();
        stopCurrent();

        const record = await get(button.dataset.audioId).catch(() => null);
        if (!record) {
            button.classList.add("is-missing");
            button.querySelector(".note-audio-label").textContent = "Nota vocale non presente su questo dispositivo";
            return;
        }

        const url = URL.createObjectURL(record.blob);
        const audio = new Audio(url);
        current = { audio, button, url };
        button.classList.add("is-playing");
        button.querySelector(".note-audio-icon").textContent = "⏸";
        audio.addEventListener("ended", stopCurrent);
        audio.addEventListener("error", stopCurrent);
        try { await audio.play(); } catch (_) { stopCurrent(); }
    }

    document.addEventListener("click", event => {
        const button = event.target.closest(".note-audio");
        if (button && button.dataset.audioId) {
            event.preventDefault();
            toggle(button);
        }
    });

    /* ---------- Registrazione ---------- */

    function pickMime() {
        const options = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
        if (!global.MediaRecorder) return "";
        return options.find(type => MediaRecorder.isTypeSupported(type)) || "";
    }

    function supported() {
        return Boolean(global.MediaRecorder && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    }

    const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

    /* Apre la finestra di registrazione. Restituisce { blob, duration, mime, title } oppure null. */
    function record() {
        return new Promise(resolve => {
            if (!supported()) {
                global.alert("Questo browser non permette di registrare l'audio.");
                return resolve(null);
            }
            if (!global.isSecureContext) {
                global.alert("La registrazione richiede una connessione HTTPS.");
                return resolve(null);
            }

            stopCurrent();
            document.getElementById("audioRecordDialog")?.remove();
            const dialog = document.createElement("div");
            dialog.id = "audioRecordDialog";
            dialog.className = "notes-qr-dialog";
            dialog.innerHTML = `
                <div class="notes-qr-card audio-record-card">
                    <button class="notes-qr-close" type="button" aria-label="Chiudi">×</button>
                    <h3>🎙️ Nota vocale</h3>
                    <p class="audio-record-status">Richiesta accesso al microfono…</p>
                    <div class="audio-record-time">0:00</div>
                    <audio class="audio-record-preview" controls hidden></audio>
                    <input class="personal-note-title-input audio-record-title" type="text" maxlength="80" placeholder="Titolo (facoltativo)" hidden>
                    <div class="audio-record-buttons">
                        <button class="settings-action audio-record-stop" type="button" hidden>⏹ Ferma</button>
                        <button class="settings-action audio-record-save" type="button" hidden>💾 Salva</button>
                        <button class="settings-action audio-record-redo" type="button" hidden>🔁 Rifai</button>
                    </div>
                </div>`;
            document.body.appendChild(dialog);

            const $ = sel => dialog.querySelector(sel);
            const status = $(".audio-record-status"), clock = $(".audio-record-time"), preview = $(".audio-record-preview");
            const titleInput = $(".audio-record-title");
            const stopBtn = $(".audio-record-stop"), saveBtn = $(".audio-record-save"), redoBtn = $(".audio-record-redo");

            let stream = null, recorder = null, chunks = [], startedAt = 0, ticker = 0, result = null, previewUrl = "", closed = false;

            const release = () => {
                clearInterval(ticker);
                if (recorder && recorder.state !== "inactive") { try { recorder.stop(); } catch (_) {} }
                if (stream) stream.getTracks().forEach(t => t.stop());
                stream = null;
            };

            const close = value => {
                if (closed) return;
                closed = true;
                recorder && (recorder.onstop = null);
                release();
                if (previewUrl) URL.revokeObjectURL(previewUrl);
                dialog.remove();
                resolve(value);
            };

            $(".notes-qr-close").addEventListener("click", () => close(null));

            async function start() {
                result = null;
                chunks = [];
                preview.hidden = true; titleInput.hidden = true; saveBtn.hidden = true; redoBtn.hidden = true;
                if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = ""; }

                try {
                    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
                } catch (error) {
                    status.textContent = "Microfono non disponibile: consenti l'accesso nelle impostazioni del browser.";
                    return;
                }
                if (closed) { stream.getTracks().forEach(t => t.stop()); return; }

                const mime = pickMime();
                try {
                    recorder = new MediaRecorder(stream, Object.assign({ audioBitsPerSecond: BITRATE }, mime ? { mimeType: mime } : {}));
                } catch (_) {
                    recorder = new MediaRecorder(stream);
                }

                recorder.ondataavailable = event => { if (event.data && event.data.size) chunks.push(event.data); };
                recorder.onstop = () => {
                    clearInterval(ticker);
                    if (stream) stream.getTracks().forEach(t => t.stop());
                    stream = null;
                    const seconds = (Date.now() - startedAt) / 1000;
                    const type = recorder.mimeType || mime || "audio/webm";
                    const blob = new Blob(chunks, { type });
                    if (!blob.size) { status.textContent = "Registrazione vuota. Riprova."; redoBtn.hidden = false; stopBtn.hidden = true; return; }
                    result = { blob, duration: seconds, mime: type };
                    previewUrl = URL.createObjectURL(blob);
                    preview.src = previewUrl;
                    preview.hidden = false; titleInput.hidden = false;
                    stopBtn.hidden = true; saveBtn.hidden = false; redoBtn.hidden = false;
                    clock.textContent = formatTime(seconds);
                    status.textContent = "Riascolta, poi salva.";
                };

                recorder.start(1000);
                startedAt = Date.now();
                stopBtn.hidden = false;
                status.textContent = "🔴 Registrazione in corso…";
                ticker = setInterval(() => {
                    const elapsed = (Date.now() - startedAt) / 1000;
                    clock.textContent = formatTime(elapsed) + " / " + formatTime(MAX_SECONDS);
                    if (elapsed >= MAX_SECONDS && recorder.state === "recording") recorder.stop();
                }, 250);
            }

            stopBtn.addEventListener("click", () => { if (recorder && recorder.state === "recording") recorder.stop(); });
            redoBtn.addEventListener("click", () => { release(); start(); });
            saveBtn.addEventListener("click", () => {
                if (!result) return;
                close(Object.assign({}, result, { title: titleInput.value.trim() }));
            });

            start();
        });
    }

    /* Registra e salva. Restituisce il record salvato oppure null. */
    async function recordAndSave(owner) {
        const data = await record();
        if (!data) return null;
        try {
            return await save(owner, data, data.title);
        } catch (error) {
            global.alert(error.message || "Non è stato possibile salvare la nota vocale.");
            return null;
        }
    }

    /* HTML del segnaposto [[audio:ID]] dentro una nota. */
    function renderToken(id) {
        return '<button type="button" class="note-audio" data-audio-id="' + esc(id) + '" title="Riproduci nota vocale">' +
            '<span class="note-audio-icon">▶</span><span class="note-audio-label">🎙️ Nota vocale</span></button>';
    }


    /* ---------- Immagini nelle note ([[img:ID]]) ---------- */

    const IMG_MAX_SIDE = 1024;

    async function saveImage(owner, file) {
        const photos = global.PatientPhotos;
        if (!photos || !photos._compressImage) throw new Error("Compressione immagini non disponibile.");
        const out = await photos._compressImage(file, { maxSide: IMG_MAX_SIDE, quality: 0.7 });
        const record = {
            id: "im-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8),
            owner: String(owner),
            createdAt: new Date().toISOString(),
            title: "",
            duration: 0,
            width: out.width,
            height: out.height,
            mime: out.blob.type || "image/webp",
            size: out.blob.size,
            blob: out.blob
        };
        try {
            await tx("readwrite", store => store.put(record));
        } catch (error) {
            if (isQuota(error)) throw new Error("Memoria del telefono insufficiente: libera spazio o elimina qualche allegato.");
            throw error;
        }
        return record;
    }

    /* Apre il selettore (fotocamera o galleria) e salva l'immagine. */
    function pickAndSaveImage(owner) {
        return new Promise(resolve => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "image/*";
            let done = false;
            input.addEventListener("change", async () => {
                done = true;
                const file = input.files && input.files[0];
                if (!file) return resolve(null);
                try {
                    resolve(await saveImage(owner, file));
                } catch (error) {
                    global.alert(error.message || "Non è stato possibile salvare l'immagine.");
                    resolve(null);
                }
            });
            input.addEventListener("cancel", () => { if (!done) resolve(null); });
            input.click();
        });
    }

    function renderImageToken(id) {
        return '<button type="button" class="note-image" data-image-id="' + esc(id) + '" title="Apri immagine" aria-label="Apri immagine">' +
            '<span class="note-image-placeholder">🖼️</span></button>';
    }

    const imageUrls = new Map();

    async function hydrateImages(root) {
        const buttons = (root || document).querySelectorAll(".note-image[data-image-id]:not([data-ready])");
        for (const button of buttons) {
            button.dataset.ready = "1";
            const record = await get(button.dataset.imageId).catch(() => null);
            if (!record || !String(record.mime).startsWith("image/")) {
                button.classList.add("is-missing");
                button.innerHTML = '<span class="note-image-placeholder">🖼️ Immagine non presente su questo dispositivo</span>';
                continue;
            }
            let url = imageUrls.get(record.id);
            if (!url) { url = URL.createObjectURL(record.blob); imageUrls.set(record.id, url); }
            button.innerHTML = "";
            const img = document.createElement("img");
            img.src = url;
            img.alt = "Immagine della nota";
            img.loading = "lazy";
            button.appendChild(img);
        }
    }

    function openImageViewer(button) {
        const img = button.querySelector("img");
        if (!img) return;
        document.getElementById("noteImageViewer")?.remove();
        const viewer = document.createElement("div");
        viewer.id = "noteImageViewer";
        viewer.className = "note-image-viewer";
        viewer.innerHTML = '<button type="button" class="note-image-viewer-close" aria-label="Chiudi">×</button><div class="note-image-viewer-stage"><img alt="Immagine ingrandita"></div>';
        const big = viewer.querySelector("img");
        big.src = img.src;
        let zoomed = false;
        big.addEventListener("click", event => {
            event.stopPropagation();
            zoomed = !zoomed;
            big.classList.toggle("is-zoomed", zoomed);
        });
        viewer.addEventListener("click", () => viewer.remove());
        document.body.appendChild(viewer);
    }

    document.addEventListener("click", event => {
        const button = event.target.closest(".note-image");
        if (button && button.dataset.imageId && !button.classList.contains("is-missing")) {
            event.preventDefault();
            event.stopPropagation();
            openImageViewer(button);
        }
    }, true);

    let hydrateQueued = false;
    new MutationObserver(() => {
        if (hydrateQueued) return;
        hydrateQueued = true;
        requestAnimationFrame(() => { hydrateQueued = false; hydrateImages(document); });
    }).observe(document.documentElement, { childList: true, subtree: true });

    global.AudioNotes = {
        saveImage, pickAndSaveImage, renderImageToken, hydrateImages,
        supported, record, recordAndSave, save, get, list, remove, removeMany, removeOwner, clearAll, rename,
        extractIds, prune, exportByIds, exportByOwners, importRecords, renderToken, formatTime, stopCurrent,
        MAX_SECONDS
    };
})(window);
