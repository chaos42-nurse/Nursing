/* =========================================================
   Condivisione tramite link, file, QR e NFC; import di note e personalizzazioni
   (script classico caricato prima di app.js: le funzioni sono globali)
========================================================= */
/* =========================================================
   EDITOR LOCALE
========================================================= */

function applyLocalOverride(stateId, data) {

    try {

        const saved =
            localStorage.getItem(
                `nursing-nfc-${stateId}`
            );


        if (!saved) {

            return data;

        }


        const localData =
            JSON.parse(saved);


        return localData;

    }

    catch (error) {

        console.error(
            "Errore caricamento dati locali:",
            error
        );

        return data;

    }

}

/* =========================================================
   CODIFICA CONDIVISIONE
========================================================= */

function toBase64(value) {

    const bytes =
        new TextEncoder().encode(
            String(value ?? "")
        );

    let binary = "";

    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }

    return btoa(binary);
}

function fromBase64(value) {

    const binary =
        atob(String(value || ""));

    const bytes =
        Uint8Array.from(
            binary,
            char => char.charCodeAt(0)
        );

    return new TextDecoder().decode(bytes);
}

/* Compressione per le condivisioni (collegamento, QR, NFC): LZW sui byte UTF-8 + base64url.
   Il collegamento risulta circa la metà di prima e non contiene caratteri da codificare. */
function lzwWidth(index) {
    return Math.max(9, (255 + index).toString(2).length);
}

function lzwCompress(text) {
    const input = new TextEncoder().encode(String(text));
    if (!input.length) return new Uint8Array(0);

    const dict = new Map();
    for (let i = 0; i < 256; i++) dict.set(String.fromCharCode(i), i);

    const out = [];
    let buffer = 0, length = 0, next = 256, index = 0;

    const emit = code => {
        buffer |= code << length;
        length += lzwWidth(index++);
        while (length >= 8) {
            out.push(buffer & 255);
            buffer >>>= 8;
            length -= 8;
        }
    };

    let w = String.fromCharCode(input[0]);
    for (let i = 1; i < input.length; i++) {
        const c = String.fromCharCode(input[i]);
        const wc = w + c;
        if (dict.has(wc)) {
            w = wc;
        } else {
            emit(dict.get(w));
            dict.set(wc, next++);
            w = c;
        }
    }
    emit(dict.get(w));
    if (length > 0) out.push(buffer & 255);
    return Uint8Array.from(out);
}

function lzwDecompress(bytes) {
    if (!bytes.length) return "";

    const table = [];
    for (let i = 0; i < 256; i++) table.push([i]);

    let buffer = 0, length = 0, position = 0, index = 0;
    const read = () => {
        const width = lzwWidth(index);
        while (length < width) {
            if (position >= bytes.length) return null;
            buffer |= bytes[position++] << length;
            length += 8;
        }
        const code = buffer & ((1 << width) - 1);
        buffer >>>= width;
        length -= width;
        index++;
        return code;
    };

    let code = read();
    if (code === null) return "";
    let previous = table[code];
    const result = [...previous];

    while ((code = read()) !== null) {
        let entry;
        if (code < table.length) entry = table[code];
        else if (code === table.length) entry = [...previous, previous[0]];
        else throw new Error("Dati compressi non validi");

        result.push(...entry);
        table.push([...previous, entry[0]]);
        previous = entry;
    }

    return new TextDecoder().decode(Uint8Array.from(result));
}

function bytesToBase64Url(bytes) {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value) {
    const padded = String(value).replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(padded + "=".repeat((4 - padded.length % 4) % 4));
    return Uint8Array.from(binary, char => char.charCodeAt(0));
}

/* Nelle condivisioni di sole note si tolgono ids e date: chi riceve le rigenera. */
function compactShareData(type, data) {
    const slim = notes => (Array.isArray(notes) ? notes : []).map(note => ({
        title: note?.title || "",
        text: note?.text || ""
    }));

    if (type === "selection" && data) {
        const notes = {};
        for (const [key, list] of Object.entries(data.notes || {})) notes[key] = slim(list);
        return { appNotes: slim(data.appNotes), notes };
    }

    if ((type === "section" || type === "notes") && data) {
        return { stateId: data.stateId, itemId: data.itemId, notes: slim(data.notes) };
    }

    return data;
}

function createSharePayload(type, data) {

    const json = JSON.stringify(compactShareData(type, data));

    return "NS3." + type + "." + bytesToBase64Url(lzwCompress(json));
}

function buildShareUrl(type, data) {

    return window.location.origin +
        window.location.pathname +
        "?share=" +
        encodeURIComponent(
            createSharePayload(type, data)
        );
}

/* =========================================================
   LETTURA CONDIVISIONE
========================================================= */



function readSharePayload() {

    const searchParams =
        new URLSearchParams(window.location.search);

    const queryPayload =
        searchParams.get("share");

    const hash =
        window.location.hash || "";

    let encodedPayload = queryPayload || "";

    if (
        !encodedPayload &&
        hash.startsWith("#nursing-share=")
    ) {
        encodedPayload =
            hash.slice("#nursing-share=".length);
    }

    if (!encodedPayload) {
        return null;
    }

    try {

        const payload =
            decodeURIComponent(encodedPayload);

        // Formato compresso (NS3): NS3.<tipo>.<dati>
        if (payload.startsWith("NS3.")) {
            const [, type, packed] = payload.split(".");
            return {
                type,
                data: JSON.parse(lzwDecompress(base64UrlToBytes(packed)))
            };
        }

        const parts =
            payload.split("|");

        if (
            parts.length !== 3 ||
            parts[0] !== "NS2"
        ) {
            return null;
        }

        const type =
            fromBase64(parts[1]);

        const data =
            JSON.parse(
                fromBase64(parts[2])
            );

        return {
            type,
            data
        };

    } catch (error) {

        console.error(
            "Collegamento di condivisione non valido:",
            error
        );

        return null;

    }

}

/* =========================================================
   ROUTE CONDIVISIONE / PAZIENTI
========================================================= */



const incomingPersonalization =
    readSharePayload();

const patientsRoute =
    new URLSearchParams(window.location.search)
        .get("patients");

function createNotesSharePayload(stateId, itemId, notes) {
    const noteParts = notes.map(note =>
        [
            toBase64(note.id || ""),
            toBase64(note.title || "Nota personale"),
            toBase64(note.text || "")
        ].join(".")
    );

    return [
        "NS1",
        toBase64(stateId),
        toBase64(itemId),
        noteParts.join(",")
    ].join("|");
}

function readNotesSharePayload() {
    const hash = window.location.hash || "";

    if (!hash.startsWith("#nursing-notes=")) {
        return null;
    }

    try {
        const payload = decodeURIComponent(
            hash.slice("#nursing-notes=".length)
        );

        const parts = payload.split("|");

        if (parts.length !== 4 || parts[0] !== "NS1") {
            return null;
        }

        const sharedStateId = fromBase64(parts[1]);
        const sharedItemId = fromBase64(parts[2]);

        const notes = parts[3]
            ? parts[3].split(",").map(part => {
                const fields = part.split(".");

                if (fields.length !== 3) {
                    return null;
                }

                return {
                    id: fromBase64(fields[0]),
                    title: fromBase64(fields[1]) || "Nota personale",
                    text: fromBase64(fields[2])
                };
            }).filter(Boolean)
            : [];

        if (!sharedStateId || !sharedItemId || !notes.length) {
            return null;
        }

        return {
            stateId: sharedStateId,
            itemId: sharedItemId,
            notes
        };
    } catch (error) {
        console.error("Collegamento note non valido:", error);
        return null;
    }
}

function buildNotesShareUrl(stateId, itemId, notes) {
    const payload = createNotesSharePayload(
        stateId,
        itemId,
        notes
    );

    return window.location.origin +
        window.location.pathname +
        "?state=" + encodeURIComponent(stateId) +
        "&item=" + encodeURIComponent(itemId) +
        "&notes=1" +
        "#nursing-notes=" +
        encodeURIComponent(payload);
}

function shareCurrentNotes(stateId, itemId) {
    const notes = getNotesForItem(stateId, itemId);

    if (!notes.length) {
        window.alert("Non ci sono note da condividere.");
        return;
    }

    const url = buildNotesShareUrl(stateId, itemId, notes);

    if (navigator.share) {
        navigator.share({
            title: "Note personali — Nursing Shot",
            text: "Note personali collegate",
            url
        }).catch(() => {});
        return;
    }

    navigator.clipboard?.writeText(url).then(() => {
        window.alert("Collegamento copiato. Puoi inviarlo al telefono o a un altro PC.");
    }).catch(() => {
        window.prompt("Copia questo collegamento:", url);
    });
}

function showNotesQr(stateId, itemId) {
    const notes = getNotesForItem(stateId, itemId);

    if (!notes.length) {
        window.alert("Non ci sono note da condividere.");
        return;
    }

    const url = buildNotesShareUrl(stateId, itemId, notes);
    const qrUrl =
        "https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=" +
        encodeURIComponent(url);

    const existing = document.getElementById("notesQrDialog");
    existing?.remove();

    const dialog = document.createElement("div");
    dialog.id = "notesQrDialog";
    dialog.className = "notes-qr-dialog";
    dialog.innerHTML = `
        <div class="notes-qr-card">
            <button class="notes-qr-close" type="button" aria-label="Chiudi">×</button>
            <h3>📱 Condividi tramite QR</h3>
            <p>Scansiona questo QR con il telefono per importare le note.</p>
            <img src="${qrUrl}" alt="QR per condividere le note personali">
            <button class="settings-action" type="button" id="copyNotesShareLink">🔗 Copia collegamento</button>
        </div>
    `;

    document.body.appendChild(dialog);

    dialog.querySelector(".notes-qr-close")?.addEventListener("click", () => {
        dialog.remove();
    });

    dialog.addEventListener("click", event => {
        if (event.target === dialog) dialog.remove();
    });

    dialog.querySelector("#copyNotesShareLink")?.addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(url);
            window.alert("Collegamento copiato.");
        } catch (_) {
            window.prompt("Copia questo collegamento:", url);
        }
    });
}

function getInternalNotesShareUrl(rawValue) {
    const value = String(rawValue || "").trim();

    if (!value) return null;

    try {
        const url = new URL(value, window.location.href);

        if (url.origin !== window.location.origin) return null;

        const hasShareQuery =
            url.searchParams.has("share");

        const hasShareHash =
            url.hash.startsWith("#nursing-notes=") ||
            url.hash.startsWith("#nursing-share=");

        if (!hasShareQuery && !hasShareHash) {
            return null;
        }

        return url.href;
    } catch (_) {
        return null;
    }
}

function closeNotesQrReader(dialog, stream, animationId) {
    if (animationId) cancelAnimationFrame(animationId);

    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }

    dialog?.remove();
}

async function readNotesQr() {
    if (!window.isSecureContext) {
        window.alert("La lettura QR richiede una connessione HTTPS.");
        return;
    }

    if (!("BarcodeDetector" in window)) {
        window.alert(
            "Questo browser non supporta la lettura QR integrata."
        );
        return;
    }

    try {
        const supportedFormats =
            await BarcodeDetector.getSupportedFormats();

        if (!supportedFormats.includes("qr_code")) {
            window.alert(
                "Questo browser non supporta la lettura dei QR code tramite fotocamera."
            );
            return;
        }
    } catch (_) {}

    document.getElementById("notesQrReaderDialog")?.remove();

    const dialog = document.createElement("div");
    dialog.id = "notesQrReaderDialog";
    dialog.className = "notes-qr-dialog";

    dialog.innerHTML = [
        '<div class="notes-qr-card notes-qr-reader-card">',
        '<button class="notes-qr-close" type="button" aria-label="Chiudi">×</button>',
        '<h3>📷 Leggi QR</h3>',
        '<p>Inquadra il QR delle note personali.</p>',
        '<video class="notes-qr-video" id="notesQrVideo" autoplay muted playsinline></video>',
        '<p id="notesQrReaderStatus" class="settings-message">Richiesta accesso alla fotocamera…</p>',
        '</div>'
    ].join("");

    document.body.appendChild(dialog);

    const video = dialog.querySelector("#notesQrVideo");
    const status = dialog.querySelector("#notesQrReaderStatus");

    let stream = null;
    let animationId = null;
    let stopped = false;

    const stop = () => {
        stopped = true;
        closeNotesQrReader(dialog, stream, animationId);
    };

    dialog.querySelector(".notes-qr-close")?.addEventListener("click", stop);

    dialog.addEventListener("click", event => {
        if (event.target === dialog) stop();
    });

    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: { ideal: "environment" }
            },
            audio: false
        });

        video.srcObject = stream;
        await video.play();

        status.textContent = "Fotocamera attiva. Inquadra il QR…";

        const detector = new BarcodeDetector({
            formats: ["qr_code"]
        });

        const scan = async () => {
            if (stopped) return;

            try {
                const results = await detector.detect(video);
                const result = results.find(current => current.rawValue);

                if (result?.rawValue) {
                    const internalUrl =
                        getInternalNotesShareUrl(result.rawValue);

                    if (internalUrl) {
                        stop();
                        window.location.href = internalUrl;
                        return;
                    }

                    status.textContent =
                        "QR non riconosciuto. Cerca un QR generato da Nursing Shot.";
                }
            } catch (_) {}

            if (!stopped) {
                animationId = requestAnimationFrame(scan);
            }
        };

        scan();

    } catch (error) {
        status.textContent =
            "Impossibile accedere alla fotocamera.";

        window.setTimeout(() => {
            if (dialog.isConnected) {
                closeNotesQrReader(dialog, stream, animationId);
            }
        }, 1600);

        console.error("Errore lettura QR:", error);
    }
}

function decodeNfcRecord(record) {
    if (!record) return "";

    if (typeof record.data === "string") {
        return record.data.trim();
    }

    if (!record.data) return "";

    try {
        const bytes = new Uint8Array(
            record.data.buffer,
            record.data.byteOffset,
            record.data.byteLength
        );

        if (record.recordType === "url") {
            if (!bytes.length) return "";

            const prefixes = {
                0x00: "",
                0x01: "http://www.",
                0x02: "https://www.",
                0x03: "http://",
                0x04: "https://",
                0x05: "tel:",
                0x06: "mailto:",
                0x0F: "news:",
                0x10: "telnet://",
                0x11: "imap:",
                0x12: "rtsp://",
                0x13: "urn:",
                0x14: "pop:",
                0x15: "sip:",
                0x16: "sips:",
                0x17: "tftp:",
                0x1D: "file://",
                0x23: "urn:nfc:"
            };

            const prefix = prefixes[bytes[0]] ?? "";
            const suffix = new TextDecoder().decode(bytes.slice(1));

            return prefix + suffix;
        }

        return new TextDecoder().decode(bytes).trim();

    } catch (_) {
        return "";
    }
}

function getNfcShareUrl(message) {
    if (!message?.records) return null;

    for (const record of message.records) {
        const value = decodeNfcRecord(record);
        const internalUrl = getInternalNotesShareUrl(value);

        if (internalUrl) return internalUrl;
    }

    return null;
}

async function readNotesNfc() {
    if (!window.isSecureContext) {
        window.alert("La lettura NFC richiede una connessione HTTPS.");
        return;
    }

    if (!("NDEFReader" in window)) {
        window.alert(
            "Questo browser non supporta Web NFC. Su Android serve un browser compatibile con Web NFC."
        );
        return;
    }

    document.getElementById("notesNfcDialog")?.remove();

    const dialog = document.createElement("div");
    dialog.id = "notesNfcDialog";
    dialog.className = "notes-qr-dialog";

    dialog.innerHTML = [
        '<div class="notes-qr-card notes-nfc-card">',
        '<button class="notes-qr-close" type="button" aria-label="Chiudi">×</button>',
        '<h3>📡 Leggi NFC</h3>',
        '<div class="notes-nfc-icon">📳</div>',
        '<p id="notesNfcStatus">Avvicina il telefono al tag NFC…</p>',
        '</div>'
    ].join("");

    document.body.appendChild(dialog);

    let controller = null;

    const close = () => {
        controller?.abort();
        dialog.remove();
    };

    dialog.querySelector(".notes-qr-close")?.addEventListener("click", close);

    dialog.addEventListener("click", event => {
        if (event.target === dialog) close();
    });

    try {
        const reader = new NDEFReader();

        controller = new AbortController();

        reader.addEventListener("reading", event => {
            const internalUrl = getNfcShareUrl(event.message);

            if (!internalUrl) {
                const status =
                    dialog.querySelector("#notesNfcStatus");

                if (status) {
                    status.textContent =
                        "Tag letto, ma non contiene un collegamento Nursing Shot.";
                }

                return;
            }

            close();
            window.location.href = internalUrl;

        }, { signal: controller.signal });

        reader.addEventListener("readingerror", () => {
            const status =
                dialog.querySelector("#notesNfcStatus");

            if (status) {
                status.textContent =
                    "Non riesco a leggere questo tag NFC. Prova ad avvicinarlo meglio.";
            }
        }, { signal: controller.signal });

        await reader.scan({
            signal: controller.signal
        });

    } catch (error) {
        const status =
            dialog.querySelector("#notesNfcStatus");

        if (status) {
            status.textContent =
                "Impossibile avviare la lettura NFC.";
        }

        console.error("Errore lettura NFC:", error);
    }
}

async function writeNotesNfc(stateId, itemId) {
    const notes = getNotesForItem(stateId, itemId);

    if (!notes.length) {
        window.alert("Non ci sono note da condividere.");
        return;
    }

    if (!window.isSecureContext) {
        window.alert("La scrittura NFC richiede una connessione HTTPS.");
        return;
    }

    if (!("NDEFReader" in window)) {
        window.alert("Questo browser non supporta Web NFC.");
        return;
    }

    const url = buildNotesShareUrl(
        stateId,
        itemId,
        notes
    );

    if (!window.confirm(
        "Il collegamento alle note verrà scritto sul tag NFC. Continuare?"
    )) {
        return;
    }

    try {
        const writer = new NDEFReader();

        await writer.write({
            records: [
                {
                    recordType: "url",
                    data: url
                }
            ]
        });

        window.alert("✅ Collegamento scritto sul tag NFC.");

    } catch (error) {
        console.error("Errore scrittura NFC:", error);

        if (error?.name === "NotAllowedError") {
            window.alert(
                "Scrittura NFC non autorizzata o tag non scrivibile."
            );
            return;
        }

        window.alert(
            "Non è stato possibile scrivere il tag NFC."
        );
    }
}

function renderSharedNotesImport(shared) {
    if (!shared) return "";

    const sameTarget =
        shared.stateId === state &&
        shared.itemId === item;

    return `
        <section class="personal-notes-import">
            <div>
                <strong>📥 Note ricevute</strong>
                <span>
                    ${shared.notes.length} ${shared.notes.length === 1 ? "nota" : "note"} da importare
                    ${sameTarget ? "" : " in un'altra scheda"}
                </span>
            </div>
            <div class="personal-notes-import-actions">
                <button
                    id="importSharedNotes"
                    class="settings-action"
                    type="button"
                >📥 Importa note</button>
                <button
                    id="cancelSharedNotes"
                    class="settings-action"
                    type="button"
                >✕ Ignora</button>
            </div>
        </section>
    `;
}

function importSharedNotes(shared) {
    if (!shared) return;

    const existing = getNotesForItem(
        shared.stateId,
        shared.itemId
    );

    const imported = shared.notes.map(note => ({
        id: String(Date.now()) + "-" +
            Math.random().toString(36).slice(2, 8),
        title: note.title || "Nota personale",
        text: note.text || ""
    }));

    saveNotesForItem(
        shared.stateId,
        shared.itemId,
        [...existing, ...imported]
    );

    window.location.hash = "";
    window.location.href =
        "?state=" + encodeURIComponent(shared.stateId) +
        "&item=" + encodeURIComponent(shared.itemId) +
        "&notes=1";
}

function renderPersonalNotesPage(stateId, itemId, data, title) {
    const notes = getNotesForItem(stateId, itemId);
    const filteredNotes = notes;
    const sharedNotes = readNotesSharePayload();

    content.innerHTML = `
        <section class="detail-page personal-notes-page">
            ${renderSharedNotesImport(sharedNotes)}
            <div class="detail-header-row">
                <h2>📝 Note personali</h2>
            </div>

            <p class="personal-notes-context">
                ${escapeHtml(title)}
            </p>

            <div class="personal-notes-share-actions">
                <button id="sharePersonalNotes" class="settings-action" type="button">🔗 Condividi / importa</button>
            </div>

            <button class="settings-action note-new-toggle" type="button" data-note-new-toggle>➕ Nuova nota</button>

            <div class="personal-notes-list">
                ${filteredNotes.length
                    ? filteredNotes.map(note => `
                        <article class="personal-note-card" data-note-id="${escapeAttribute(note.id)}">
                            <div class="personal-note-card-header">
                                <div>
                                    <h3>${renderNoteText(
                                    note.title || "Nota personale",
                                    stateId,
                                    itemId,
                                    note.id
                                )}</h3>
                                </div>
                                <div class="personal-note-actions">
                                    <button class="personal-note-edit" type="button" data-note-edit="${escapeAttribute(note.id)}" title="Modifica nota">✏️</button>
                                    <button class="personal-note-delete" type="button" data-note-delete="${escapeAttribute(note.id)}" title="Elimina nota">🗑️</button>
                                </div>
                            </div>
                            <div class="personal-note-text">${renderNoteText(note.text, stateId, itemId, note.id)}</div>
                        </article>
                    `).join("")
                    : `
                        <div class="personal-note-empty">
                            Nessuna nota personale in questa sottocategoria.
                        </div>
                    `}
            </div>

            <div class="personal-note-editor" hidden>
                <h3>➕ Nuova nota</h3>
                <input id="personalNoteTitle" class="personal-note-title-input" type="text" autocomplete="off" placeholder="Titolo della nota">
                <div class="note-format-bar" role="group" aria-label="Formattazione">
                    <button type="button" data-note-format="*" data-note-format-target="personalNoteInput" title="Grassetto: *testo*"><b>G</b></button>
                    <button type="button" data-note-format="/" data-note-format-target="personalNoteInput" title="Corsivo: /testo/"><i>C</i></button>
                    <button type="button" data-note-format="_" data-note-format-target="personalNoteInput" title="Sottolineato: _testo_"><u>S</u></button>
                    <button type="button" class="note-color-toggle" data-note-color-target="personalNoteInput" title="Evidenziatore e colori" aria-label="Evidenziatore e colori">🖍️</button>
                </div>
                <textarea id="personalNoteInput" class="personal-note-input" placeholder="Scrivi la nota... Per collegarla ad altre note usa: [[parola]]; per una categoria: [[@ECG]]" rows="7"></textarea>
                <div class="note-attach-row">
                    <button class="note-attach-button" type="button" data-note-image-target="personalNoteInput" title="Aggiungi immagine" aria-label="Aggiungi immagine">🖼️</button>
                    <button class="note-attach-button" type="button" data-note-audio-target="personalNoteInput" title="Aggiungi nota vocale" aria-label="Aggiungi nota vocale">🎙️</button>
                </div>
                <button id="savePersonalNote" class="settings-action" type="button">💾 Aggiungi nota</button>
                <button class="settings-action personal-note-cancel" type="button" data-note-new-cancel>Annulla</button>
                <p id="personalNoteMessage" class="personal-note-message"></p>
            </div>

            <a
                class="personal-notes-back"
                href="?state=${encodeURIComponent(stateId)}&item=${encodeURIComponent(itemId)}"
            >← Torna alla scheda</a>
        </section>
    `;
}

function setupPersonalNotes() {
    document.addEventListener("click", event => {
        if (event.target.closest("#sharePersonalNotes")) {
            showShareCenter();
            return;
        }

        if (event.target.closest("#importSharedNotes")) {
            const shared = readNotesSharePayload();
            importSharedNotes(shared);
            return;
        }

        if (event.target.closest("#cancelSharedNotes")) {
            window.location.hash = "";
            renderPersonalNotesPage(
                state,
                item,
                window.__currentData || {},
                window.__currentItemTitle || ""
            );
            return;
        }
        const editButton = event.target.closest("[data-note-edit]");

        if (editButton) {
            const noteId = editButton.dataset.noteEdit;
            const notes = getNotesForItem(state, item);
            const note = notes.find(current =>
                String(current.id) === String(noteId)
            );

            if (!note) return;

            const editor = document.querySelector(".personal-note-editor");
            const titleInput = document.getElementById("personalNoteTitle");
            const input = document.getElementById("personalNoteInput");
            const saveButton = document.getElementById("savePersonalNote");

            if (!editor || !titleInput || !input) return;

            showNoteEditor(editor);
            editor.dataset.editingId = String(note.id);
            titleInput.value = note.title || "";
            input.value = note.text || "";

            if (saveButton) {
                saveButton.textContent = "💾 Salva modifiche";
            }

            editor.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

            input.focus();
            input.setSelectionRange(
                input.value.length,
                input.value.length
            );

            return;
        }

        const deleteButton = event.target.closest("[data-note-delete]");

        if (deleteButton) {
            const noteId = deleteButton.dataset.noteDelete;
            const removedPersonal = getNotesForItem(state, item).find(note => note.id === noteId);
            if (removedPersonal && window.AudioNotes) window.AudioNotes.prune(removedPersonal.text, "");
            if (removedPersonal) clearChecklistState(removedPersonal.id, removedPersonal.text);
            const notes = getNotesForItem(state, item)
                .filter(note => note.id !== noteId);

            saveNotesForItem(state, item, notes);

            renderPersonalNotesPage(
                state,
                item,
                window.__currentData || {},
                window.__currentItemTitle || ""
            );
            return;
        }

        if (event.target.closest("#savePersonalNote")) {
            const titleInput = document.getElementById("personalNoteTitle");
            const input = document.getElementById("personalNoteInput");

            if (!input) return;

            const textValue = input.value.trim();

            if (!textValue) {
                const message = document.getElementById("personalNoteMessage");
                if (message) message.textContent = "✏️ Scrivi prima il testo della nota.";
                return;
            }

            const notes = getNotesForItem(state, item);
            const editor = document.querySelector(".personal-note-editor");
            const editingId = editor?.dataset.editingId || "";

            if (editingId) {
                const note = notes.find(current =>
                    String(current.id) === String(editingId)
                );

                if (note) {
                    note.title =
                        (titleInput?.value || "").trim() ||
                        "Nota personale";
                    if (window.AudioNotes) window.AudioNotes.prune(note.text, textValue);
                    migrateChecklistState(note.id, note.text, textValue);
                    note.text = textValue;
                    note.updatedAt = new Date().toISOString();
                }

                saveNotesForItem(state, item, notes);

                renderPersonalNotesPage(
                    state,
                    item,
                    window.__currentData || {},
                    window.__currentItemTitle || ""
                );
                return;
            }

            notes.push({
                id: String(Date.now()) + "-" + Math.random().toString(36).slice(2, 8),
                title: (titleInput?.value || "").trim() || "Nota personale",
                text: textValue
            });

            saveNotesForItem(state, item, notes);

            input.value = "";
            if (titleInput) titleInput.value = "";

            const message = document.getElementById("personalNoteMessage");
            if (message) message.textContent = "✅ Nota aggiunta.";

            renderPersonalNotesPage(
                state,
                item,
                window.__currentData || {},
                window.__currentItemTitle || ""
            );
        }
    });
}

function collectOrderPreferences() {
    const result = {};

    for (const key of Object.keys(localStorage)) {
        if (
            key === PERSONALIZATION_KEYS.categoryOrder ||
            key.startsWith("nursing-sections-") ||
            key.startsWith("nursing-items-") ||
            key === "nursing-patient-order"
        ) {
            result[key] = localStorage.getItem(key);
        }
    }

    return result;
}

function getPatients() {
    try {
        const raw = JSON.parse(
            localStorage.getItem(PATIENTS_KEY) || "[]"
        );

        if (!Array.isArray(raw)) return [];

        return raw
            .filter(patient => patient && typeof patient === "object")
            .map(normalizePatient);
    } catch (_) {
        return [];
    }
}

function savePatients(patients) {
    localStorage.setItem(
        PATIENTS_KEY,
        JSON.stringify(patients)
    );
}

function getPatientOrder() {
    try {
        const raw = JSON.parse(
            localStorage.getItem("nursing-patient-order") || "null"
        );
        return Array.isArray(raw) ? raw.map(String) : null;
    } catch (_) {
        localStorage.removeItem("nursing-patient-order");
        return null;
    }
}

function applyPatientOrder(patients) {
    const savedOrder = getPatientOrder();
    if (!savedOrder) return [...patients];

    return [...patients].sort((a, b) => {
        const aIndex = savedOrder.indexOf(String(a.id));
        const bIndex = savedOrder.indexOf(String(b.id));
        return (
            (aIndex === -1 ? 999999 : aIndex) -
            (bIndex === -1 ? 999999 : bIndex)
        );
    });
}

function savePatientOrder() {
    const order = Array.from(
        content.querySelectorAll(".patient-card-row .patient-card")
    ).map(card => card.dataset.patientId);

    localStorage.setItem(
        "nursing-patient-order",
        JSON.stringify(order)
    );
}

function setupPatientOrderControls() {
    content
        .querySelectorAll(".patient-order-controls .order-button")
        .forEach(button => {
            button.addEventListener("click", event => {
                event.preventDefault();
                event.stopPropagation();

                const row = button.closest(".patient-card-row");
                if (!row) return;

                moveElement(
                    row,
                    button.dataset.order,
                    ".patient-card-row",
                    savePatientOrder
                );
            });
        });
}

function collectPersonalization(includePatients = false) {
    return {
        app: "Nursing Shot",
        type: "personalization",
        version: PERSONALIZATION_VERSION,
        exportedAt: new Date().toISOString(),
        theme:
            localStorage.getItem(PERSONALIZATION_KEYS.theme) ||
            "dark",
        orders: collectOrderPreferences(),
        notes: getPersonalNotes(),
        appNotes: getAppNotes(),
        patients: includePatients ? getPatients() : []
    };
}

/* Unisce note generali ricevute con quelle presenti: niente doppioni, nessuna nota sovrascritta. */
function mergeIncomingAppNotes(incoming) {
    if (!Array.isArray(incoming) || !incoming.length) return 0;

    const current = getAppNotes();
    const fingerprint = note => JSON.stringify([note.title, note.text]);
    const known = new Set(current.map(fingerprint));
    const usedIds = new Set(current.map(note => String(note.id)));
    let added = 0;

    for (const raw of incoming) {
        if (!raw || typeof raw !== "object") continue;

        const note = {
            id: String(raw.id || Date.now()),
            title: String(raw.title || "Nota"),
            text: String(raw.text || ""),
            createdAt: String(raw.createdAt || ""),
            updatedAt: String(raw.updatedAt || "")
        };

        if (!note.text.trim() || known.has(fingerprint(note))) continue;

        if (usedIds.has(note.id)) {
            note.id = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
        }

        usedIds.add(note.id);
        known.add(fingerprint(note));
        current.push(note);
        added++;
    }

    if (added) saveAppNotes(current);
    return added;
}

/* Unisce le note per sezione ({ "stato::scheda": [note] }) senza doppioni. */
function mergeIncomingSectionNotes(incomingMap) {
    if (!incomingMap || typeof incomingMap !== "object") return 0;

    let existingNotes = {};
    try {
        existingNotes = JSON.parse(localStorage.getItem(PERSONALIZATION_KEYS.notes) || "{}") || {};
    } catch (_) {
        existingNotes = {};
    }

    let added = 0;

    for (const [key, incomingNotes] of Object.entries(incomingMap)) {
        if (!Array.isArray(incomingNotes)) continue;

        const list = Array.isArray(existingNotes[key]) ? existingNotes[key] : [];
        const fingerprint = note => JSON.stringify([note?.title || "", note?.text || ""]);
        const known = new Set(list.map(fingerprint));
        const usedIds = new Set(list.map(note => String(note?.id || "")));

        for (const raw of incomingNotes) {
            if (!raw || typeof raw !== "object") continue;
            if (known.has(fingerprint(raw))) continue;

            const note = { ...raw };
            if (!note.id || usedIds.has(String(note.id))) {
                note.id = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
            }

            usedIds.add(String(note.id));
            known.add(fingerprint(note));
            list.push(note);
            added++;
        }

        existingNotes[key] = list;
    }

    if (added) localStorage.setItem(PERSONALIZATION_KEYS.notes, JSON.stringify(existingNotes));
    return added;
}

/* Scelta libera delle note da condividere: generali e di ogni area/sezione. */
function showNoteSelectionShareDialog() {
    document.getElementById("noteSelectionShareDialog")?.remove();

    const appNotes = getAppNotes();
    const sectionNotes = getPersonalNotes();

    const labelOf = (stateId, itemId) => {
        const entries = noteCategoryIndex.ready ? noteCategoryIndex.entries : [];
        const found = entries.find(e => e.state === stateId && e.id === (itemId || ""));
        return found ? found.title : (itemId || stateId);
    };

    // Raggruppa: area (stato) → sezione (scheda) → note
    const areas = new Map();

    for (const [key, notes] of Object.entries(sectionNotes)) {
        const separator = key.indexOf("::");
        if (separator === -1 || !Array.isArray(notes) || !notes.length) continue;

        const stateId = key.slice(0, separator);
        const itemId = key.slice(separator + 2);

        if (!areas.has(stateId)) areas.set(stateId, new Map());
        areas.get(stateId).set(itemId, { key, notes });
    }

    const currentKey = state && item ? state + "::" + item : "";
    const noteRow = (note, attrs, checked) => `
        <label class="share-tree-note">
            <input type="checkbox" ${attrs} ${checked ? "checked" : ""}>
            <span>${escapeHtml(note.title || "Nota")}</span>
        </label>`;

    const generalHtml = appNotes.length ? `
        <details class="share-tree-group" open>
            <summary>
                <label><input type="checkbox" data-share-group="general"> <strong>📝 Note generali</strong></label>
                <small>${appNotes.length}</small>
            </summary>
            <div class="share-tree-body">
                ${appNotes.map(note => noteRow(note, `data-share-app="${escapeAttribute(note.id)}" data-share-in="general"`, false)).join("")}
            </div>
        </details>` : "";

    const areasHtml = [...areas.entries()].map(([stateId, sections]) => {
        const total = [...sections.values()].reduce((sum, sec) => sum + sec.notes.length, 0);
        const hasCurrent = currentKey && [...sections.values()].some(sec => sec.key === currentKey);

        return `
        <details class="share-tree-group" ${hasCurrent ? "open" : ""}>
            <summary>
                <label><input type="checkbox" data-share-group="area:${escapeAttribute(stateId)}"> <strong>📚 ${escapeHtml(labelOf(stateId, ""))}</strong></label>
                <small>${total}</small>
            </summary>
            <div class="share-tree-body">
                ${[...sections.entries()].map(([itemId, sec]) => `
                    <div class="share-tree-section">
                        <label><input type="checkbox" data-share-group="sec:${escapeAttribute(sec.key)}" data-share-in="area:${escapeAttribute(stateId)}"> <strong>${escapeHtml(labelOf(stateId, itemId))}</strong></label>
                        ${sec.notes.map(note => noteRow(note,
                            `data-share-sec="${escapeAttribute(sec.key)}" data-share-id="${escapeAttribute(note.id)}" data-share-in="sec:${escapeAttribute(sec.key)}" data-share-area="area:${escapeAttribute(stateId)}"`,
                            sec.key === currentKey)).join("")}
                    </div>`).join("")}
            </div>
        </details>`;
    }).join("");

    const dialog = document.createElement("div");
    dialog.id = "noteSelectionShareDialog";
    dialog.className = "notes-qr-dialog";
    dialog.innerHTML = `
        <div class="notes-qr-card personalization-share-card share-tree-card">
            <button class="notes-qr-close" type="button" aria-label="Chiudi">×</button>
            <h3>🧩 Scegli le note da condividere</h3>
            <p class="settings-message">Spunta un'area, una sezione o le singole note.</p>
            ${generalHtml || areasHtml ? `
                <div class="share-tree-tools">
                    <button type="button" class="settings-action" data-share-all="1">Seleziona tutto</button>
                    <button type="button" class="settings-action" data-share-all="0">Nessuna</button>
                </div>
                <div class="share-tree">${generalHtml}${areasHtml}</div>
                <p class="settings-message" id="shareTreeCount"></p>
                <button type="button" class="settings-action" id="shareTreeGo">📤 Continua</button>
            ` : `<p class="settings-message">Non ci sono ancora note da condividere.</p>`}
        </div>`;

    document.body.appendChild(dialog);

    const boxes = () => [...dialog.querySelectorAll("input[type=checkbox]")];
    const leaves = () => boxes().filter(box => box.dataset.shareApp || box.dataset.shareId);

    const refresh = () => {
        // Aggiorna sezioni e aree in base alle singole note
        const groups = boxes().filter(box => box.dataset.shareGroup);
        for (const group of groups) {
            const name = group.dataset.shareGroup;
            const members = boxes().filter(box => !box.dataset.shareGroup
                ? (box.dataset.shareIn === name || box.dataset.shareArea === name)
                : false);
            if (!members.length) continue;
            const checked = members.filter(box => box.checked).length;
            group.checked = checked === members.length;
            group.indeterminate = checked > 0 && checked < members.length;
        }

        const count = leaves().filter(box => box.checked).length;
        const label = dialog.querySelector("#shareTreeCount");
        if (label) label.textContent = count ? count + (count === 1 ? " nota selezionata." : " note selezionate.") : "Nessuna nota selezionata.";
    };

    dialog.addEventListener("click", event => {
        if (event.target === dialog || event.target.closest(".notes-qr-close")) {
            dialog.remove();
            return;
        }

        const all = event.target.closest("[data-share-all]");
        if (all) {
            leaves().forEach(box => { box.checked = all.dataset.shareAll === "1"; });
            refresh();
            return;
        }

        if (event.target.closest("#shareTreeGo")) {
            const chosenApp = new Set(leaves().filter(box => box.checked && box.dataset.shareApp).map(box => box.dataset.shareApp));
            const chosenSec = {};

            leaves().filter(box => box.checked && box.dataset.shareId).forEach(box => {
                (chosenSec[box.dataset.shareSec] = chosenSec[box.dataset.shareSec] || new Set()).add(box.dataset.shareId);
            });

            const data = { appNotes: appNotes.filter(note => chosenApp.has(String(note.id))), notes: {} };

            for (const [key, ids] of Object.entries(chosenSec)) {
                data.notes[key] = (sectionNotes[key] || []).filter(note => ids.has(String(note.id)));
            }

            if (!data.appNotes.length && !Object.keys(data.notes).length) {
                window.alert("Seleziona almeno una nota.");
                return;
            }

            dialog.remove();
            showShareMethodDialog("selection", data);
        }
    });

    dialog.addEventListener("change", event => {
        const box = event.target;
        if (!(box instanceof HTMLInputElement)) return;

        const name = box.dataset.shareGroup;
        if (name) {
            // Un gruppo (area/sezione/generali) spunta o toglie tutto ciò che contiene
            boxes().forEach(other => {
                if (other === box) return;
                if (other.dataset.shareIn === name || other.dataset.shareArea === name) other.checked = box.checked;
            });
            box.indeterminate = false;
        }

        refresh();
    });

    // Le caselle dentro il titolo non devono aprire o chiudere il gruppo
    dialog.querySelectorAll("summary label").forEach(label =>
        label.addEventListener("click", event => event.stopPropagation())
    );

    refresh();
}

function getCurrentSectionShareData() {
    if (!state || !item) return null;

    return {
        stateId: state,
        itemId: item,
        notes: getNotesForItem(state, item)
    };
}

function getSelectedNotesFromDialog(dialog) {
    return Array.from(
        dialog.querySelectorAll(
            'input[data-share-note]:checked'
        )
    ).map(input => input.dataset.shareNote);
}

/* File di condivisione con le foto: JSON con le immagini in base64. */
async function sharePersonalizationAsFile(data, photos, audios = [], type = "all") {
    const payload = {
        app: "Nursing Shot",
        type: "share-file",
        version: 1,
        exportedAt: new Date().toISOString(),
        share: { type, data },
        photos,
        audios
    };

    const stamp = new Date().toISOString().slice(0, 10);
    const file = new File(
        [JSON.stringify(payload)],
        "nursing-shot-condivisione-" + stamp + ".json",
        { type: "application/json" }
    );

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({ files: [file], title: "Nursing Shot — condivisione" });
            return;
        } catch (error) {
            if (error && error.name === "AbortError") return;
            // Condivisione di sistema non riuscita: si ripiega sul download.
        }
    }

    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);

    window.alert("File salvato: " + file.name + ". Invialo al destinatario, che lo aprirà da Condividi / importa → Importa da file.");
}

/* Importa un file creato da sharePersonalizationAsFile (note, pazienti e foto). */
async function importShareFile(file) {
    let payload;

    try {
        payload = JSON.parse(await file.text());
    } catch (_) {
        window.alert("Il file non è leggibile.");
        return;
    }

    return importSharePayload(payload);
}

/* Importa una condivisione completa (note, pazienti e foto) ricevuta da file o in diretta. */
async function importSharePayload(payload) {
    if (!payload || payload.app !== "Nursing Shot" || payload.type !== "share-file" || !payload.share) {
        window.alert("Questo file non è una condivisione di Nursing Shot.");
        return;
    }

    const photos = Array.isArray(payload.photos) ? payload.photos : [];
    const audioCount = Array.isArray(payload.audios) ? payload.audios.length : 0;

    if (!window.confirm(
        "Importare la condivisione" +
        (photos.length ? " con " + photos.length + " foto" : "") +
        (audioCount ? (photos.length ? " e " : " con ") + audioCount + " allegati audio/immagine" : "") + "?"
    )) return;

    const ok = importSharedPersonalization(payload.share);

    if (!ok) {
        window.alert("Condivisione non valida.");
        return;
    }

    let summary = "Importazione completata.";

    if (Array.isArray(payload.audios) && payload.audios.length && window.AudioNotes) {
        const known = new Set(getPatients().map(patient => String(patient.id)));
        const usableAudios = payload.audios.filter(item =>
            !String(item.owner || "").startsWith("patient:") ||
            known.has(String(item.owner).slice(8))
        );
        try {
            const result = await window.AudioNotes.importRecords(usableAudios);
            summary += " Note vocali aggiunte: " + result.added + ".";
        } catch (error) {
            console.error("Importazione audio:", error);
            summary += " Le note vocali non si sono potute salvare (memoria insufficiente?).";
        }
    }

    if (photos.length && window.PatientPhotos) {
        // Le foto si importano solo per i pazienti presenti su questo dispositivo.
        const known = new Set(getPatients().map(patient => String(patient.id)));
        const usable = photos.filter(photo => known.has(String(photo.patientId)));

        try {
            const result = await window.PatientPhotos.importRecords(usable);
            summary += " Foto aggiunte: " + result.added +
                (result.skipped ? " (già presenti: " + result.skipped + ")" : "") + ".";
            if (usable.length < photos.length) {
                summary += " " + (photos.length - usable.length) + " foto non importate perché il paziente non è stato importato.";
            }
        } catch (error) {
            console.error("Importazione foto:", error);
            summary += " Le foto non si sono potute salvare (memoria insufficiente?).";
        }
    }

    window.alert(summary);
    window.location.reload();
}

function pickShareFile() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.addEventListener("change", () => {
        if (input.files && input.files[0]) importShareFile(input.files[0]);
    });
    input.click();
}

function showShareCenter() {
    document.getElementById("shareCenterDialog")?.remove();

    const dialog = document.createElement("div");
    dialog.id = "shareCenterDialog";
    dialog.className = "notes-qr-dialog";

    dialog.innerHTML = `
        <div class="notes-qr-card personalization-share-card">
            <button
                class="notes-qr-close"
                type="button"
                aria-label="Chiudi"
            >×</button>

            <h3>🔗 Condividi / importa</h3>

            <button id="shareCenterSend" class="settings-action" type="button">
                📤 Condividi
            </button>

            <button id="shareCenterQr" class="settings-action" type="button">
                📷 Importa da QR
            </button>

            <button id="shareCenterNfc" class="settings-action" type="button">
                📡 Importa da NFC
            </button>

            <button id="shareCenterDirect" class="settings-action" type="button">
                📲 Ricevi direttamente (QR, con foto)
            </button>

            <button id="shareCenterFile" class="settings-action" type="button">
                📁 Importa da file (con foto)
            </button>
        </div>
    `;

    document.body.appendChild(dialog);

    const close = () => dialog.remove();

    dialog.querySelector(".notes-qr-close")
        ?.addEventListener("click", close);

    dialog.addEventListener("click", event => {
        if (event.target === dialog) close();
    });

    dialog.querySelector("#shareCenterSend")
        ?.addEventListener("click", () => {
            close();
            showPersonalizationShareDialog();
        });

    dialog.querySelector("#shareCenterDirect")
        ?.addEventListener("click", () => {
            close();
            window.DirectShare.receive(importSharePayload);
        });

    dialog.querySelector("#shareCenterQr")
        ?.addEventListener("click", () => {
            close();
            readNotesQr();
        });

    dialog.querySelector("#shareCenterNfc")
        ?.addEventListener("click", () => {
            close();
            readNotesNfc();
        });

    dialog.querySelector("#shareCenterFile")
        ?.addEventListener("click", () => {
            close();
            pickShareFile();
        });
}

function showPersonalizationShareDialog() {
    document.getElementById("personalizationShareDialog")?.remove();

    const dialog = document.createElement("div");
    dialog.id = "personalizationShareDialog";
    dialog.className = "notes-qr-dialog";

    const currentNotes =
        state && item
            ? getNotesForItem(state, item)
            : [];

    const noteOptions = currentNotes.length
        ? currentNotes.map(note => `
            <label class="share-note-option">
                <input
                    type="checkbox"
                    data-share-note="${escapeAttribute(note.id)}"
                >
                <span>
                    <strong>${escapeHtml(note.title || "Nota personale")}</strong>
                </span>
            </label>
        `).join("")
        : `
            <p class="settings-message">
                Non ci sono micronote nella sezione corrente.
            </p>
        `;

    dialog.innerHTML = `
        <div class="notes-qr-card personalization-share-card">
            <button
                class="notes-qr-close"
                type="button"
                aria-label="Chiudi"
            >×</button>

            <h3>🔗 Condividi personalizzazione</h3>

            <p>
                Scegli cosa vuoi trasferire. Il destinatario potrà importarlo
                direttamente nell'app.
            </p>

            <div class="share-choice-list">
                ${state && item ? `
                    <button
                        class="settings-action share-choice"
                        type="button"
                        data-share-scope="section"
                    >
                        📚 Sezione corrente
                        <small>Tutte le note di questa sottosezione</small>
                    </button>

                    <div class="share-micronotes">
                        <strong>📝 Micronote specifiche</strong>
                        ${noteOptions}
                        <button
                            class="settings-action share-choice"
                            type="button"
                            data-share-scope="notes"
                        >
                            Condividi micronote selezionate
                        </button>
                    </div>
                ` : ""}

                <button
                    class="settings-action share-choice"
                    type="button"
                    data-share-scope="pick"
                >
                    🧩 Scegli le note
                    <small>Note generali, aree, sezioni o singole note</small>
                </button>

                <button
                    class="settings-action share-choice"
                    type="button"
                    data-share-scope="all"
                >
                    🗂️ Intera personalizzazione
                    <small>Tema, ordini, note generali e note di tutte le sezioni</small>
                </button>
            </div>

            <p class="settings-message">
                Dopo questa scelta potrai scegliere il metodo:
                collegamento, QR oppure NFC.
            </p>
        </div>
    `;

    document.body.appendChild(dialog);

    const close = () => dialog.remove();

    dialog.querySelector(".notes-qr-close")
        ?.addEventListener("click", close);

    dialog.addEventListener("click", async event => {
        if (event.target === dialog) close();

        const button =
            event.target.closest("[data-share-scope]");

        if (!button) return;

        const scope = button.dataset.shareScope;
        let data = null;
        let type = scope;

        if (scope === "pick") {
            close();
            showNoteSelectionShareDialog();
            return;
        }

        if (scope === "section") {
            data = getCurrentSectionShareData();
        }

        if (scope === "notes") {
            const selectedIds =
                getSelectedNotesFromDialog(dialog);

            if (!selectedIds.length) {
                window.alert(
                    "Seleziona almeno una micronota."
                );
                return;
            }

            data = {
                stateId: state,
                itemId: item,
                notes: getNotesForItem(state, item)
                    .filter(note =>
                        selectedIds.includes(String(note.id))
                    )
            };
        }

        if (scope === "all") {
            const includePatients =
                getPatients().length > 0 &&
                window.confirm(
                    "Vuoi includere anche i dati dei pazienti? Contengono potenzialmente dati sanitari personali e verranno inseriti nel collegamento condiviso."
                );

            data = collectPersonalization(includePatients);

            if (includePatients) {
                const secondConfirm =
                    window.confirm(
                        "Confermi di voler condividere anche i dati dei pazienti?"
                    );

                if (!secondConfirm) {
                    data.patients = [];
                }
            }
        }

        if (!data) return;

        // Foto delle medicazioni: non entrano in collegamento, QR o NFC (si inviano in diretta o in un file).
        let photos = [];
        if (scope === "all" && Array.isArray(data.patients) && data.patients.length && window.PatientPhotos) {
            try {
                photos = await window.PatientPhotos.exportRecords(
                    data.patients.map(patient => patient.id)
                );
            } catch (error) {
                console.error("Foto non incluse:", error);
                window.alert("Non è stato possibile leggere le foto: la condivisione prosegue senza.");
            }
        }

        close();
        showShareMethodDialog(type, data, photos);
    });
}

/* Note vocali collegate ai dati condivisi: dentro le note ([[audio:ID]]) e quelle dei pazienti. */
async function collectShareAudios(data) {
    if (!window.AudioNotes) return [];
    const ids = window.AudioNotes.extractIds(data);
    const owners = Array.isArray(data?.patients)
        ? data.patients.map(patient => "patient:" + patient.id)
        : [];
    const byId = new Map();
    for (const item of await window.AudioNotes.exportByIds(ids)) byId.set(item.id, item);
    for (const item of await window.AudioNotes.exportByOwners(owners)) byId.set(item.id, item);
    return [...byId.values()];
}

function showShareMethodDialog(type, data, photos = []) {
    document.getElementById("shareMethodDialog")?.remove();

    const url = buildShareUrl(type, data);

    const dialog = document.createElement("div");
    dialog.id = "shareMethodDialog";
    dialog.className = "notes-qr-dialog";

    dialog.innerHTML = `
        <div class="notes-qr-card personalization-share-card">
            <button
                class="notes-qr-close"
                type="button"
                aria-label="Chiudi"
            >×</button>

            <h3>📤 Come vuoi condividere?</h3>

            <p id="shareMediaWarning" class="settings-message share-photo-warning" ${photos.length ? "" : "hidden"}>
                ${photos.length ? `📷 Ci sono ${photos.length} foto di medicazione. Con collegamento, QR e NFC passano
                <b>tutti i dati tranne le foto</b> (troppo grandi). Per inviarle usa
                «Trasferimento diretto» o «File».` : ""}
            </p>

            <button id="shareMethodDirect" class="settings-action" type="button">
                📲 Trasferimento diretto (QR)${photos.length ? " — con foto" : ""}
            </button>

            <button id="shareMethodFile" class="settings-action" type="button" ${photos.length ? "" : "hidden"}>
                📁 File (con foto e audio)
            </button>

            <button id="shareMethodLink" class="settings-action" type="button">
                🔗 Collegamento
            </button>

            <button id="shareMethodQr" class="settings-action" type="button">
                ▦ QR code
            </button>

            <button id="shareMethodNfc" class="settings-action" type="button">
                📳 Scrivi su NFC
            </button>
        </div>
    `;

    document.body.appendChild(dialog);

    const close = () => dialog.remove();

    dialog.querySelector(".notes-qr-close")
        ?.addEventListener("click", close);

    dialog.addEventListener("click", event => {
        if (event.target === dialog) close();
    });

    // Note vocali: non entrano in collegamento, QR o NFC. Si contano ora e si inviano in diretta o in file.
    let audioCount = 0;
    collectShareAudios(data).then(list => {
        audioCount = list.length;
        if (!audioCount) return;
        const warning = dialog.querySelector("#shareMediaWarning");
        if (warning) {
            warning.hidden = false;
            warning.innerHTML += (photos.length ? "<br>" : "") +
                "🎙️ Ci sono " + audioCount + " allegati (note vocali e immagini): non passano da collegamento, QR e NFC " +
                "(nel testo resta il segnaposto). Per inviarle usa «Trasferimento diretto» o «File».";
        }
        const fileButton = dialog.querySelector("#shareMethodFile");
        if (fileButton) fileButton.hidden = false;
    }).catch(() => {});

    dialog.querySelector("#shareMethodDirect")
        ?.addEventListener("click", async () => {
            close();
            const audios = await collectShareAudios(data).catch(() => []);
            window.DirectShare.send({
                app: "Nursing Shot",
                type: "share-file",
                version: 1,
                exportedAt: new Date().toISOString(),
                share: { type, data },
                photos,
                audios
            });
        });

    dialog.querySelector("#shareMethodFile")
        ?.addEventListener("click", async () => {
            close();
            const audios = await collectShareAudios(data).catch(() => []);
            await sharePersonalizationAsFile(data, photos, audios, type);
        });

    dialog.querySelector("#shareMethodLink")
        ?.addEventListener("click", async () => {
            if (navigator.share) {
                try {
                    await navigator.share({
                        title: "Nursing Shot — personalizzazione",
                        text: "Personalizzazione condivisa da Nursing Shot",
                        url
                    });
                    close();
                    return;
                } catch (_) {}
            }

            try {
                await navigator.clipboard.writeText(url);
                window.alert("Collegamento copiato.");
            } catch (_) {
                window.prompt("Copia questo collegamento:", url);
            }

            close();
        });

    dialog.querySelector("#shareMethodQr")
        ?.addEventListener("click", () => {
            close();
            showGenericShareQr(url);
        });

    dialog.querySelector("#shareMethodNfc")
        ?.addEventListener("click", async () => {
            close();
            await writeGenericNfc(url, photos.length, audioCount);
        });
}

function showGenericShareQr(url) {
    const dialog = document.createElement("div");
    dialog.id = "genericShareQrDialog";
    dialog.className = "notes-qr-dialog";

    const qrUrl =
        "https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=" +
        encodeURIComponent(url);

    dialog.innerHTML = `
        <div class="notes-qr-card">
            <button class="notes-qr-close" type="button" aria-label="Chiudi">×</button>
            <h3>▦ Condividi tramite QR</h3>
            <img src="${qrUrl}" alt="QR per condividere la personalizzazione">
            <p class="settings-message">
                Scansiona il QR con Nursing Shot.
            </p>
        </div>
    `;

    document.body.appendChild(dialog);

    dialog.querySelector(".notes-qr-close")
        ?.addEventListener("click", () => dialog.remove());

    dialog.addEventListener("click", event => {
        if (event.target === dialog) dialog.remove();
    });
}

async function writeGenericNfc(url, photoCount = 0, audioCount = 0) {
    if (!window.isSecureContext) {
        window.alert(
            "La scrittura NFC richiede una connessione HTTPS."
        );
        return;
    }

    if (!("NDEFReader" in window)) {
        window.alert(
            "Questo browser non supporta Web NFC."
        );
        return;
    }

    const byteLength =
        new TextEncoder().encode(url).length;

    if (byteLength > 880) {
        window.alert(
            "La condivisione è troppo grande anche per i tag NFC più capienti (circa 880 byte, es. NTAG216): ora occupa " +
            byteLength + " byte. Usa «Trasferimento diretto» (nessun limite di dimensione), il collegamento o il QR, oppure condividi meno dati."
        );
        return;
    }

    const advice = byteLength > 480
        ? "\n\nOccupa " + byteLength + " byte: serve un tag da almeno 880 byte (NTAG216)."
        : "\n\nOccupa " + byteLength + " byte: entra in un tag NTAG215 o NTAG216.";

    if (!window.confirm(
        "Il collegamento verrà scritto sul tag NFC. Continuare?" + advice +
        (photoCount ? "\n\n📷 Le " + photoCount + " foto NON sono incluse: con l'NFC non si possono condividere. Per le foto usa «Trasferimento diretto»." : "") +
        (audioCount ? "\n\n🎙️ Gli " + audioCount + " allegati (note vocali e immagini) NON sono inclusi (nel testo resta solo il segnaposto). Per inviarle usa «Trasferimento diretto»." : "")
    )) {
        return;
    }

    try {
        const writer = new NDEFReader();

        await writer.write({
            records: [
                {
                    recordType: "url",
                    data: url
                }
            ]
        });

        window.alert("✅ Collegamento scritto sul tag NFC.");

    } catch (error) {
        console.error("Errore scrittura NFC:", error);
        window.alert(
            "Non è stato possibile scrivere il tag NFC."
        );
    }
}

function importSharedPersonalization(payload) {
    if (!payload) return false;

    if (
        payload.type === "section" ||
        payload.type === "notes"
    ) {
        const data = payload.data;

        if (
            !data ||
            !data.stateId ||
            !data.itemId ||
            !Array.isArray(data.notes)
        ) {
            return false;
        }

        const existing =
            getNotesForItem(
                data.stateId,
                data.itemId
            );

        const imported = data.notes.map(note => ({
            id:
                String(Date.now()) +
                "-" +
                Math.random().toString(36).slice(2, 8),
            title: note.title || "Nota personale",
            text: note.text || ""
        }));

        saveNotesForItem(
            data.stateId,
            data.itemId,
            [...existing, ...imported]
        );

        return true;
    }

    if (payload.type === "selection") {
        const data = payload.data;
        if (!data || typeof data !== "object") return false;

        const added =
            mergeIncomingAppNotes(data.appNotes) +
            mergeIncomingSectionNotes(data.notes);

        return added > 0 || Array.isArray(data.appNotes) || typeof data.notes === "object";
    }

    if (payload.type === "all") {
        const data = payload.data;

        if (
            !data ||
            data.app !== "Nursing Shot" ||
            data.type !== "personalization"
        ) {
            return false;
        }

        const incomingPatients =
            Array.isArray(data.patients)
                ? data.patients
                : [];

        let patientsToImport =
            incomingPatients;

        if (
            incomingPatients.length &&
            !window.confirm(
                "Questa personalizzazione contiene dati paziente. Vuoi importarli su questo dispositivo?"
            )
        ) {
            patientsToImport = [];
        }

        if (
            data.theme === "light" ||
            data.theme === "dark"
        ) {
            localStorage.setItem(
                PERSONALIZATION_KEYS.theme,
                data.theme
            );
        }

        if (
            data.orders &&
            typeof data.orders === "object"
        ) {
            for (const [key, value] of Object.entries(data.orders)) {
                if (
                    key === PERSONALIZATION_KEYS.categoryOrder ||
                    key.startsWith("nursing-sections-") ||
                    key.startsWith("nursing-items-")
                ) {
                    localStorage.setItem(
                        key,
                        String(value)
                    );
                }
            }
        }

        mergeIncomingAppNotes(data.appNotes);

        if (
            data.notes &&
            typeof data.notes === "object"
        ) {
            const existingNotes =
                JSON.parse(
                    localStorage.getItem(PERSONALIZATION_KEYS.notes) || "{}"
                );

            for (const [key, incomingNotes] of Object.entries(data.notes)) {
                const currentNotes =
                    Array.isArray(existingNotes[key])
                        ? existingNotes[key]
                        : [];

                const mergedNotes = [
                    ...currentNotes,
                    ...(Array.isArray(incomingNotes) ? incomingNotes : [])
                ];

                const seen = new Set();
                existingNotes[key] = mergedNotes.filter(note => {
                    const noteId = String(note?.id || "");
                    const fingerprint =
                        noteId ||
                        JSON.stringify({
                            title: note?.title || "",
                            text: note?.text || ""
                        });

                    if (seen.has(fingerprint)) return false;
                    seen.add(fingerprint);
                    return true;
                });
            }

            localStorage.setItem(
                PERSONALIZATION_KEYS.notes,
                JSON.stringify(existingNotes)
            );
        }

        if (patientsToImport.length) {
            const existingPatients = getPatients();
            const mergedPatients = existingPatients.map(normalizePatient);

            for (const incomingPatient of patientsToImport) {
                const normalizedIncoming = normalizePatient(incomingPatient);
                const incomingId = String(normalizedIncoming.id || "");

                const existingIndex = mergedPatients.findIndex(patient =>
                    String(patient.id) === incomingId && incomingId !== ""
                );

                if (existingIndex === -1) {
                    mergedPatients.push(normalizedIncoming);
                    continue;
                }

                const existingPatient = mergedPatients[existingIndex];

                for (const [key, value] of Object.entries(normalizedIncoming)) {
                    if (key === "pvHistory") {
                        const existingHistory = Array.isArray(existingPatient.pvHistory)
                            ? existingPatient.pvHistory
                            : [];
                        const incomingHistory = Array.isArray(value) ? value : [];
                        const historyById = new Map(
                            existingHistory.map(entry => [String(entry.id || ""), entry])
                        );

                        for (const entry of incomingHistory) {
                            const entryId = String(entry.id || "");
                            if (entryId && historyById.has(entryId)) continue;
                            const newId = entryId || (Date.now() + "-" + Math.random().toString(36).slice(2, 8));
                            historyById.set(newId, { ...entry, id: newId });
                        }

                        existingPatient.pvHistory = Array.from(historyById.values());
                        continue;
                    }

                    if (
                        String(value || "").trim() !== "" &&
                        String(existingPatient[key] || "").trim() === ""
                    ) {
                        existingPatient[key] = value;
                    }
                }
            }

            savePatients(mergedPatients);
        }

        setupTheme();
        return true;
    }

    return false;
}

function renderSharedPersonalizationImport(payload) {
    if (!payload) return "";

    let descriptionText =
        "Personalizzazione pronta da importare.";

    if (payload.type === "section") {
        descriptionText =
            "Sono disponibili le note della sezione corrente.";
    } else if (payload.type === "notes") {
        descriptionText =
            "Sono disponibili le micronote selezionate.";
    } else if (payload.type === "selection") {
        const nApp = Array.isArray(payload.data?.appNotes) ? payload.data.appNotes.length : 0;
        const nSec = Object.values(payload.data?.notes || {}).reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);
        descriptionText = "Note selezionate: " + (nApp + nSec) +
            (nApp ? " (di cui " + nApp + " generali)" : "") + ".";
    } else if (payload.type === "all") {
        const hasPatients =
            Array.isArray(payload.data?.patients) &&
            payload.data.patients.length > 0;

        descriptionText =
            hasPatients
                ? "Include anche dati paziente."
                : "Non include dati paziente.";
    }

    return `
        <section class="personal-notes-import personalization-import-banner">
            <div>
                <strong>📥 Personalizzazione ricevuta</strong>
                <span>${descriptionText}</span>
            </div>
            <div>
                <button id="importSharedPersonalization" class="settings-action" type="button">
                    📥 Importa
                </button>
                <button id="cancelSharedPersonalization" class="settings-action" type="button">
                    ✕ Ignora
                </button>
            </div>
        </section>
    `;
}
