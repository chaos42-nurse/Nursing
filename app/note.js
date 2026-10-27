/* =========================================================
   Note personali e note dell'app, collegamenti alle categorie
   (script classico caricato prima di app.js: le funzioni sono globali)
========================================================= */
/* =========================================================
   NOTE GENERALI DELL'APP
   Note libere non legate a una sezione o scheda specifica.
========================================================= */

function getAppNotes() {
    try {
        const raw = JSON.parse(
            localStorage.getItem(PERSONALIZATION_KEYS.appNotes) || "[]"
        );

        if (!Array.isArray(raw)) return [];

        return raw
            .filter(note => note && typeof note === "object")
            .map(note => ({
                id: String(note.id || Date.now()),
                title: String(note.title || "Nota"),
                text: String(note.text || ""),
                createdAt: String(note.createdAt || ""),
                updatedAt: String(note.updatedAt || "")
            }));
    } catch (_) {
        return [];
    }
}

/* "Nuova nota" è solo un pulsante in cima: il riquadro per scrivere si apre al tocco. */
function showNoteEditor(editor) {
    if (!editor) return;
    editor.hidden = false;
    const page = editor.closest(".app-notes-page, .personal-notes-page");
    page?.classList.add("is-editing-note");
    document.querySelectorAll("[data-note-new-toggle]").forEach(button => { button.hidden = true; });
}

function hideNoteEditor() {
    document.querySelectorAll(".app-note-editor, .personal-note-editor").forEach(editor => {
        editor.hidden = true;
        const page = editor.closest(".app-notes-page, .personal-notes-page");
        page?.classList.remove("is-editing-note");
        delete editor.dataset.editingId;
        editor.querySelectorAll("input[type=text], textarea").forEach(field => { field.value = ""; });
        const save = editor.querySelector("#saveAppNote, #savePersonalNote");
        if (save) save.textContent = "💾 Aggiungi nota";
        const heading = editor.querySelector("h3");
        if (heading && editor.classList.contains("app-note-editor")) heading.textContent = "➕ Nuova nota";
    });
    document.querySelectorAll("[data-note-new-toggle]").forEach(button => { button.hidden = false; });
}

function saveAppNotes(notes) {
    localStorage.setItem(
        PERSONALIZATION_KEYS.appNotes,
        JSON.stringify(notes)
    );
}

function renderContactPage() {
    content.innerHTML = `
        <section class="detail-page contact-page">
            <div class="detail-header-row">
                <h2>📩 Contattami</h2>
            </div>

            <p class="personal-notes-context">
                Per domande, segnalazioni o suggerimenti puoi contattarmi tramite email.
            </p>

            <div class="contact-links">
                <a
                    class="settings-action"
                    href="mailto:svngrl99a11a494a@gmail.com"
                >✉️ Email</a>
            </div>
        </section>
    `;
}

/* LEGGENDA delle note: per ogni funzione, a sinistra come si scrive (con termini segnaposto
   come "testo" o "parola"), a destra il risultato vero, reso dallo stesso motore delle note. */
const NOTE_LEGEND = [
    {
        titolo: "✍️ Stile del testo",
        nota: "Il segno va attaccato al testo, senza spazi. Si possono sommare.",
        righe: [
            ["*testo*", "grassetto"],
            ["/testo/", "corsivo"],
            ["_testo_", "sottolineato"],
            ["*/_testo_/*", "tutti e tre insieme"]
        ]
    },
    {
        titolo: "🖍️ Colori",
        nota: "Evidenziatore con =…= e colore del testo con ~…~. Lettera dopo il segno: g giallo, v verde, r rosso, a azzurro.",
        righe: [
            ["=testo=", "evidenziato (giallo)"],
            ["=v:testo= =r:testo= =a:testo=", "evidenziatore verde, rosso, azzurro"],
            ["~testo~ ~v:testo~ ~a:testo~", "testo colorato (rosso, verde, azzurro)"],
            ["=r:*urgente*=", "si somma agli altri stili"]
        ]
    },
    {
        titolo: "📋 Elenchi",
        nota: "A capo con Invio l'elenco continua da solo.",
        righe: [
            ["- elemento\n- elemento", "elenco con caselle da spuntare"],
            ["1. elemento\n2. elemento", "elenco numerato"],
            ["a. elemento\nb. elemento", "elenco alfabetico"],
            ["° elemento\n° elemento", "elenco puntato (anche con •)"]
        ]
    },
    {
        titolo: "🔗 Collegamenti",
        nota: "Tocca il collegamento per aprirlo.",
        righe: [
            ["[[parola]]", "collega le note che contengono la stessa parola"],
            ["[[@categoria]]", "apre una categoria, scheda o microarea (es. [[@ECG]])"]
        ]
    },
    {
        titolo: "▦ Tabelle",
        nota: "Ogni cella tra parentesi quadre; serve uno spazio tra una cella e l'altra.",
        righe: [
            ["[A] [B]\n[1] [2]", "tabella (la prima riga è l'intestazione)"]
        ]
    }
];

function renderNoteLegend() {
    const sezioni = NOTE_LEGEND.map(sezione => `
        <section class="note-legend-section">
            <h4>${sezione.titolo}</h4>
            <p class="note-legend-hint">${escapeHtml(sezione.nota)}</p>
            ${sezione.righe.map(([scrivi, descrizione]) => {
                // Gli esempi con [[@categoria]] usano una categoria reale per mostrare il link vero.
                const esempio = scrivi.replace("[[@categoria]]", "[[@ECG]]");
                return `
                <div class="note-legend-row">
                    <div class="note-legend-write">
                        <span class="note-legend-label">Scrivi</span>
                        <code>${escapeHtml(scrivi)}</code>
                    </div>
                    <div class="note-legend-result">
                        <span class="note-legend-label">Ottieni</span>
                        <div class="note-legend-render">${renderNoteText(esempio, "", "", "legend").replace(/<input /g, "<input disabled ")}</div>
                        <small>${escapeHtml(descrizione)}</small>
                    </div>
                </div>`;
            }).join("")}
        </section>`).join("");

    return `<div class="note-legend">${sezioni}</div>`;
}

function renderAppNotesPage() {
    const notes = getAppNotes();

    content.innerHTML = `
        <section class="detail-page app-notes-page">
            <div class="detail-header-row">
                <h2>📝 Note</h2>
                <a
                    class="home-button"
                    href="?links=1"
                    title="Collegamenti tra note"
                    aria-label="Collegamenti tra note"
                >🔗</a>
            </div>

            <p class="personal-notes-context">
                Appunti liberi.
            </p>

            <button class="settings-action note-new-toggle" type="button" data-note-new-toggle>➕ Nuova nota</button>

            <div class="app-notes-list">
                ${notes.length
                    ? notes.map(note => {
                        return `
                        <article id="app-note-${escapeAttribute(note.id)}" class="app-note-card" data-app-note-id="${escapeAttribute(note.id)}">
                            <div class="app-note-card-header">
                                <h3>${renderNoteText(note.title || "Nota")}</h3>
                                <div class="personal-note-actions app-note-actions">
                                    ${orderEditMode ? `<span class="order-controls app-note-order-controls">
                                        <button class="order-button app-note-move" type="button" data-app-note-move="up" data-app-note-id="${escapeAttribute(note.id)}" title="Sposta nota in alto" aria-label="Sposta ${escapeAttribute(note.title || "nota")} in alto" ${notes.indexOf(note) === 0 ? "disabled" : ""}>↑</button>
                                        <button class="order-button app-note-move" type="button" data-app-note-move="down" data-app-note-id="${escapeAttribute(note.id)}" title="Sposta nota in basso" aria-label="Sposta ${escapeAttribute(note.title || "nota")} in basso" ${notes.indexOf(note) === notes.length - 1 ? "disabled" : ""}>↓</button>
                                    </span>` : ""}
                                    <button class="app-note-edit" type="button" data-app-note-edit="${escapeAttribute(note.id)}" title="Modifica nota">✏️</button>
                                    <button class="app-note-delete" type="button" data-app-note-delete="${escapeAttribute(note.id)}" title="Elimina nota">🗑️</button>
                                </div>
                            </div>
                            <div class="app-note-text">${renderNoteText(note.text, "", "", "app-" + note.id)}</div>
                        </article>
                    `;
                    }).join("")
                    : `
                        <div class="personal-note-empty">
                            Nessuna nota.
                        </div>
                    `}
                <article class="app-note-card app-note-legend" id="app-note-legend">
                    <details>
                        <summary class="app-note-legend-title">LEGGENDA</summary>
                        ${renderNoteLegend()}
                    </details>
                </article>
            </div>

            <div class="app-note-editor" hidden>
                <h3>➕ Nuova nota</h3>
                <input
                    id="appNoteTitle"
                    class="personal-note-title-input"
                    type="text"
                    autocomplete="off"
                    placeholder="Titolo della nota"
                >
                <div class="note-format-bar" role="group" aria-label="Formattazione">
                    <button type="button" data-note-format="*" data-note-format-target="appNoteInput" title="Grassetto: *testo*"><b>G</b></button>
                    <button type="button" data-note-format="/" data-note-format-target="appNoteInput" title="Corsivo: /testo/"><i>C</i></button>
                    <button type="button" data-note-format="_" data-note-format-target="appNoteInput" title="Sottolineato: _testo_"><u>S</u></button>
                    <button type="button" class="note-color-toggle" data-note-color-target="appNoteInput" title="Evidenziatore e colori" aria-label="Evidenziatore e colori">🖍️</button>
                </div>
                <textarea
                    id="appNoteInput"
                    class="personal-note-input"
                    placeholder="Scrivi un'idea, una modifica da fare o un promemoria..."
                    rows="7"
                ></textarea>
                <label class="app-note-checklist-order-label app-note-editor-order-label" for="appNoteChecklistOrder">
                    <span>Ordine degli elementi spuntati</span>
                    <select id="appNoteChecklistOrder" class="app-note-checklist-order" aria-label="Ordine degli elementi spuntati">
                        <option value="original">Nessuno</option>
                        <option value="top">In cima</option>
                        <option value="bottom">In fondo</option>
                    </select>
                </label>
                <div class="note-attach-row">
                    <button class="note-attach-button" type="button" data-note-image-target="appNoteInput" title="Aggiungi immagine" aria-label="Aggiungi immagine">🖼️</button>
                    <button class="note-attach-button" type="button" data-note-audio-target="appNoteInput" title="Aggiungi nota vocale" aria-label="Aggiungi nota vocale">🎙️</button>
                </div>
                <button id="saveAppNote" class="settings-action" type="button">💾 Aggiungi nota</button>
                <button class="settings-action personal-note-cancel" type="button" data-note-new-cancel>Annulla</button>
                <p id="appNoteMessage" class="personal-note-message"></p>
            </div>
        </section>
    `;
}

function setupAppNotes() {
    document.addEventListener("keydown", event => {
        const input = event.target;
        if (!input || input.id !== "appNoteInput" || event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;

        const start = input.selectionStart;
        const end = input.selectionEnd;
        if (start !== end) return;

        const value = input.value;
        const lineStart = value.lastIndexOf("\n", start - 1) + 1;
        const linePrefix = value.slice(lineStart, start);
        const listMatch = linePrefix.match(/^(\s*)(-\s+|[°•]\s+|\d+\.\s+|[a-zA-Z]\.\s+)(.*)$/);
        if (!listMatch) return;

        const indentation = listMatch[1] || "";
        const marker = listMatch[2] || "";
        const itemText = listMatch[3] || "";
        event.preventDefault();

        if (!itemText.trim()) {
            input.setRangeText("", lineStart, start, "start");
            const cursor = lineStart + indentation.length;
            input.setRangeText("\n", cursor, cursor, "end");
            return;
        }

        let nextMarker = marker;
        if (/^\d+\.\s+$/.test(marker)) {
            nextMarker = (Number.parseInt(marker, 10) + 1) + ". ";
        } else if (/^[a-zA-Z]\.\s+$/.test(marker)) {
            const letter = marker.trim()[0];
            const upper = letter === letter.toUpperCase();
            const code = letter.charCodeAt(0) + 1;
            nextMarker = (code > (upper ? 90 : 122) ? letter : String.fromCharCode(code)) + ". ";
        }
        input.setRangeText("\n" + indentation + nextMarker, start, end, "end");
    });

    document.addEventListener("change", event => {
        const checkbox = event.target.closest(".note-checklist-checkbox");
        if (!checkbox) return;

        let checklistState = {};
        try {
            checklistState = JSON.parse(localStorage.getItem("nursing-note-checklists") || "{}");
        } catch (error) {
            checklistState = {};
        }

        checklistState[checkbox.dataset.noteChecklistKey || ""] = checkbox.checked;
        localStorage.setItem("nursing-note-checklists", JSON.stringify(checklistState));

        const item = checkbox.closest(".note-checklist-item");
        if (item) item.classList.toggle("is-checked", checkbox.checked);

        const noteCard = checkbox.closest(".app-note-card");
        const noteId = noteCard?.dataset.appNoteId || "";
        if (noteId) {
            let orderSettings = {};
            try {
                orderSettings = JSON.parse(localStorage.getItem("nursing-note-checklist-order") || "{}");
            } catch (error) {
                orderSettings = {};
            }
            if (orderSettings["app-" + noteId] === "top" || orderSettings["app-" + noteId] === "bottom") {
                const scrollPosition = window.scrollY;
                renderAppNotesPage();
                window.scrollTo(0, scrollPosition);
            }
        }
    });

    document.addEventListener("click", event => {
        const moveButton = event.target.closest("[data-app-note-move]");
        if (moveButton) {
            const noteId = moveButton.dataset.appNoteId || "";
            const direction = moveButton.dataset.appNoteMove;
            const notes = getAppNotes();
            const fromIndex = notes.findIndex(note => String(note.id) === String(noteId));
            const toIndex = fromIndex + (direction === "up" ? -1 : 1);
            if (fromIndex < 0 || toIndex < 0 || toIndex >= notes.length) return;
            [notes[fromIndex], notes[toIndex]] = [notes[toIndex], notes[fromIndex]];
            saveAppNotes(notes);
            renderAppNotesPage();
            return;
        }

        const editButton = event.target.closest("[data-app-note-edit]");
        if (editButton) {
            const noteId = editButton.dataset.appNoteEdit || "";
            const note = getAppNotes().find(current =>
                String(current.id) === String(noteId)
            );

            if (!note) return;

            const editor = document.querySelector(".app-note-editor");
            const titleInput = document.getElementById("appNoteTitle");
            const input = document.getElementById("appNoteInput");
            const saveButton = document.getElementById("saveAppNote");

            if (!editor || !titleInput || !input) return;

            showNoteEditor(editor);
            const editorHeading = editor.querySelector("h3");
            if (editorHeading) editorHeading.textContent = "✏️ Modifica nota";
            editor.dataset.editingId = String(note.id);
            titleInput.value = note.title || "";
            input.value = note.text || "";

            const orderSelect = document.getElementById("appNoteChecklistOrder");
            if (orderSelect) {
                let orderSettings = {};
                try {
                    orderSettings = JSON.parse(localStorage.getItem("nursing-note-checklist-order") || "{}");
                } catch (error) {
                    orderSettings = {};
                }
                orderSelect.value = orderSettings["app-" + String(note.id)] || orderSettings[String(note.id)] || "original";
            }

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

        const deleteButton = event.target.closest("[data-app-note-delete]");
        if (deleteButton) {
            const noteId = deleteButton.dataset.appNoteDelete || "";
            const removedNote = getAppNotes().find(note => String(note.id) === String(noteId));
            if (removedNote && window.AudioNotes) window.AudioNotes.prune(removedNote.text, "");
            if (removedNote) clearChecklistState("app-" + removedNote.id, removedNote.text);
            const notes = getAppNotes().filter(note =>
                String(note.id) !== String(noteId)
            );

            saveAppNotes(notes);
            renderAppNotesPage();
            return;
        }

        if (event.target.closest("#saveAppNote")) {
            const titleInput = document.getElementById("appNoteTitle");
            const input = document.getElementById("appNoteInput");
            const editor = document.querySelector(".app-note-editor");

            if (!input) return;

            const textValue = input.value.trim();

            if (!textValue) {
                const message = document.getElementById("appNoteMessage");
                if (message) {
                    message.textContent = "✏️ Scrivi prima il testo della nota.";
                }
                return;
            }

            const notes = getAppNotes();
            const editingId = editor?.dataset.editingId || "";
            const now = new Date().toISOString();

            if (editingId) {
                const note = notes.find(current =>
                    String(current.id) === String(editingId)
                );

                if (note) {
                    note.title =
                        (titleInput?.value || "").trim() || "Nota";
                    if (window.AudioNotes) window.AudioNotes.prune(note.text, textValue);
                    migrateChecklistState("app-" + note.id, note.text, textValue);
                    note.text = textValue;
                    note.updatedAt = now;
                }

                let orderSettings = {};
                try {
                    orderSettings = JSON.parse(localStorage.getItem("nursing-note-checklist-order") || "{}");
                } catch (error) {
                    orderSettings = {};
                }
                const orderSelect = document.getElementById("appNoteChecklistOrder");
                orderSettings["app-" + String(editingId)] = ["original", "top", "bottom"].includes(orderSelect?.value)
                    ? orderSelect.value
                    : "original";
                localStorage.setItem("nursing-note-checklist-order", JSON.stringify(orderSettings));

                saveAppNotes(notes);
                renderAppNotesPage();
                return;
            }

            const newNote = {
                id: String(Date.now()) + "-" + Math.random().toString(36).slice(2, 8),
                title: (titleInput?.value || "").trim() || "Nota",
                text: textValue,
                createdAt: now,
                updatedAt: now
            };
            notes.unshift(newNote);

            let orderSettings = {};
            try {
                orderSettings = JSON.parse(localStorage.getItem("nursing-note-checklist-order") || "{}");
            } catch (error) {
                orderSettings = {};
            }
            const orderSelect = document.getElementById("appNoteChecklistOrder");
            orderSettings["app-" + String(newNote.id)] = ["original", "top", "bottom"].includes(orderSelect?.value)
                ? orderSelect.value
                : "original";
            localStorage.setItem("nursing-note-checklist-order", JSON.stringify(orderSettings));

            saveAppNotes(notes);
            renderAppNotesPage();
        }
    });
}

function getPersonalNotes() {
    try {
        const raw = JSON.parse(
            localStorage.getItem(PERSONALIZATION_KEYS.notes) || "{}"
        );

        const normalized = {};

        for (const [key, value] of Object.entries(raw)) {
            if (Array.isArray(value)) {
                normalized[key] = value
                    .filter(note => note && typeof note === "object")
                    .map(note => ({
                        id: String(note.id || Date.now()),
                        title: String(note.title || "Nota personale"),
                        text: String(note.text || "")
                    }));
            } else if (typeof value === "string" && value.trim()) {
                normalized[key] = [{
                    id: "legacy-" + Date.now(),
                    title: "Nota personale",
                    text: value
                }];
            }
        }

        return normalized;
    } catch (_) {
        return {};
    }
}

function savePersonalNotes(notes) {
    localStorage.setItem(
        PERSONALIZATION_KEYS.notes,
        JSON.stringify(notes)
    );
}

function getPersonalNoteKey(stateId, itemId) {
    return (stateId || "") + "::" + (itemId || "");
}

/*
 * Quando due classi farmacologiche vengono unite, le note personali scritte
 * sulla vecchia classe passano a quella che resta (campo "aliasIds").
 */
function migratePersonalNotesForMergedClasses(data) {
    try {
        const stateId = data?.id || "farmaci";
        const notes = getPersonalNotes();
        let changed = false;

        const visit = items => {
            for (const current of (Array.isArray(items) ? items : [])) {
                if (!current || typeof current !== "object") continue;

                for (const oldId of (Array.isArray(current.aliasIds) ? current.aliasIds : [])) {
                    const oldKey = getPersonalNoteKey(stateId, oldId);
                    const oldNotes = notes[oldKey];
                    if (!oldNotes || !oldNotes.length) continue;

                    const newKey = getPersonalNoteKey(stateId, current.id);
                    const taken = new Set((notes[newKey] || []).map(note => note.id));
                    const moved = oldNotes.map(note => {
                        let noteId = note.id;
                        while (taken.has(noteId)) noteId += "-m";
                        taken.add(noteId);
                        return { ...note, id: noteId };
                    });
                    notes[newKey] = (notes[newKey] || []).concat(moved);
                    delete notes[oldKey];
                    changed = true;
                }

                visit(current.items);
            }
        };

        for (const section of (data?.sections || [])) visit(section.items);

        if (changed) savePersonalNotes(notes);
    } catch (error) {
        console.warn("Migrazione note classi unite non riuscita:", error);
    }
}

function getNotesForItem(stateId, itemId) {
    const notes = getPersonalNotes();
    return notes[getPersonalNoteKey(stateId, itemId)] || [];
}

function saveNotesForItem(stateId, itemId, itemNotes) {
    const notes = getPersonalNotes();
    const key = getPersonalNoteKey(stateId, itemId);

    if (itemNotes.length) {
        notes[key] = itemNotes;
    } else {
        delete notes[key];
    }

    savePersonalNotes(notes);
}

function escapeNoteText(value) {
    return escapeHtml(value)
        .replace(/\n/g, "<br>");
}

function extractPlaceorders(text) {
    const matches = [];
    const patterns = [
        /<placeorder>([\s\S]*?)<\/placeorder>/gi,
        /\[\[([\s\S]*?)\]\]/g
    ];

    for (const regex of patterns) {
        let match;

        while ((match = regex.exec(String(text || ""))) !== null) {
            const term = match[1].trim();

            // [[@Categoria]] è un collegamento a una categoria, non una parola-chiave tra note.
            if (term.startsWith("@") || /^(audio|img):[\w-]+$/.test(term)) continue;

            if (
                term &&
                !matches.some(existing =>
                    normalizeLinkTerm(existing) ===
                    normalizeLinkTerm(term)
                )
            ) {
                matches.push(term);
            }
        }
    }

    return matches;
}

function getAllPersonalNoteRecords() {
    const notes = getPersonalNotes();
    const records = [];

    for (const [key, itemNotes] of Object.entries(notes)) {
        const separator = key.indexOf("::");
        if (separator === -1 || !Array.isArray(itemNotes)) continue;

        const stateId = key.slice(0, separator);
        const itemId = key.slice(separator + 2);

        itemNotes.forEach(note => {
            records.push({ stateId, itemId, note });
        });
    }

    return records;
}

function normalizeLinkTerm(value) {
    return String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("it-IT");
}

function getLinkedNoteRecords(term, sourceStateId, sourceItemId, sourceNoteId) {
    const normalized = normalizeLinkTerm(term);

    return getAllPersonalNoteRecords().filter(record => {
        if (
            record.stateId === sourceStateId &&
            record.itemId === sourceItemId &&
            String(record.note.id) === String(sourceNoteId)
        ) {
            return false;
        }

        return extractPlaceorders(
            String(record.note.title || "") + "\n" +
            String(record.note.text || "")
        ).some(
            linkedTerm => normalizeLinkTerm(linkedTerm) === normalized
        );
    });
}

function makeNoteUrl(stateId, itemId, noteId) {
    const params = new URLSearchParams();
    params.set("state", stateId);
    params.set("item", itemId);
    params.set("notes", "1");
    params.set("note", noteId);

    return "?" + params.toString();
}

/* =========================================================
   COLLEGAMENTI DALLE NOTE ALLE CATEGORIE
   Sintassi: [[@ECG]]  oppure  [[@Titolo|stato/scheda]] (se il titolo è ambiguo)
========================================================= */

const noteCategoryIndex = { entries: [], ready: false };

const normalizeCategoryText = value =>
    String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const categoryHref = entry =>
    "?state=" + encodeURIComponent(entry.state) +
    (entry.id ? "&item=" + encodeURIComponent(entry.id) : "");

function parseCategoryLinkSpec(term) {
    const body = String(term).replace(/^@/, "").trim();
    const bar = body.indexOf("|");
    const label = (bar === -1 ? body : body.slice(0, bar)).trim();
    const where = bar === -1 ? "" : body.slice(bar + 1).trim();
    const [state, id] = where.split("/");
    return { label, state: state || "", id: id || "" };
}

function resolveCategoryLink(spec) {
    if (!noteCategoryIndex.ready) return null;

    const entries = noteCategoryIndex.entries;
    let found = null;

    if (spec.state) {
        found = entries.find(entry =>
            entry.state === spec.state && (entry.id || "") === spec.id
        );
    }

    if (!found) {
        const wanted = normalizeCategoryText(spec.label);
        found = entries.find(entry => normalizeCategoryText(entry.title) === wanted);

        if (!found) {
            const partial = entries.filter(entry => normalizeCategoryText(entry.title).includes(wanted));
            if (partial.length === 1 && wanted.length >= 3) found = partial[0];
        }
    }

    return found ? { href: categoryHref(found), path: found.path } : null;
}

async function loadNoteCategoryIndex() {
    try {
        const categories = await (await fetch("./data/categories.json")).json();
        const entries = [];

        const walk = (node, stateId, trail) => {
            if (Array.isArray(node)) {
                node.forEach(child => walk(child, stateId, trail));
                return;
            }

            // Microaree: voci semplici (solo testo) di una sezione, es. "EGA" o "Glicemia".
            if (typeof node === "string") {
                const title = node.trim();
                if (title) entries.push({ state: stateId, id: createId(title), title, path: trail.concat(title).join(" › ") });
                return;
            }

            if (!node || typeof node !== "object") return;

            const here = node.id && node.title ? trail.concat(node.title) : trail;

            if (node.id && node.title && node.id !== stateId) {
                entries.push({ state: stateId, id: String(node.id), title: String(node.title), path: here.join(" › ") });
            }

            // I blocchi sono il contenuto della scheda: non contengono altre categorie.
            if (node.items) walk(node.items, stateId, here);
            if (node.sections) walk(node.sections, stateId, here);
        };

        for (const category of categories) {
            if (category.route) continue;

            entries.push({ state: category.id, id: "", title: category.title, path: category.title });

            try {
                const data = await (await fetch("./data/" + category.id + ".json")).json();
                walk(data.sections || [], category.id, [category.title]);
            } catch (error) {
                console.warn("Indice categorie: dati non letti per", category.id);
            }
        }

        // Schede raggiungibili come stato a sé (es. ECG) ma elencate dentro altre categorie.
        noteCategoryIndex.entries = entries;
        noteCategoryIndex.ready = true;
        resolveNoteCategoryLinks();
    } catch (error) {
        console.warn("Indice categorie non disponibile", error);
    }
}

// Aggiorna i link già disegnati quando l'indice è pronto.
function resolveNoteCategoryLinks() {
    document.querySelectorAll("a[data-note-cat]").forEach(link => {
        const target = resolveCategoryLink(parseCategoryLinkSpec("@" + link.dataset.noteCat));
        link.classList.toggle("note-category-link-missing", !target);
        link.setAttribute("href", target ? target.href : "#");
        link.title = target ? "Apri: " + target.path : "Categoria non trovata";
    });
}

// Selettore con ricerca: inserisce [[@Titolo]] dove si trova il cursore.
function openCategoryPicker(textarea) {
    if (!textarea) return;

    const overlay = document.createElement("div");
    overlay.className = "note-category-picker";
    overlay.innerHTML = `
        <div class="note-category-picker-box" role="dialog" aria-label="Collega una categoria">
            <div class="note-category-picker-head">
                <strong>📂 Collega una categoria</strong>
                <button type="button" data-pick-close aria-label="Chiudi">✕</button>
            </div>
            <input type="search" placeholder="Cerca (es. ECG, primo soccorso)" autocomplete="off" aria-label="Cerca categoria">
            <div class="note-category-picker-list"></div>
        </div>`;
    document.body.appendChild(overlay);

    const input = overlay.querySelector("input");
    const list = overlay.querySelector(".note-category-picker-list");

    const render = () => {
        if (!noteCategoryIndex.ready) {
            list.innerHTML = '<p class="note-category-picker-empty">Caricamento…</p>';
            return;
        }

        const wanted = normalizeCategoryText(input.value);
        const matches = noteCategoryIndex.entries
            .filter(entry => !wanted || normalizeCategoryText(entry.title + " " + entry.path).includes(wanted))
            .slice(0, 60);

        list.innerHTML = matches.length
            ? matches.map(entry => `
                <button type="button" data-pick="${escapeAttribute(entry.state + "/" + entry.id)}">
                    <strong>${escapeHtml(entry.title)}</strong>
                    <small>${escapeHtml(entry.path)}</small>
                </button>`).join("")
            : '<p class="note-category-picker-empty">Nessuna categoria trovata.</p>';
    };

    const close = () => overlay.remove();

    overlay.addEventListener("click", event => {
        if (event.target === overlay || event.target.closest("[data-pick-close]")) {
            close();
            return;
        }

        const pick = event.target.closest("[data-pick]");
        if (!pick) return;

        const [stateId, itemId] = pick.dataset.pick.split("/");
        const entry = noteCategoryIndex.entries.find(e => e.state === stateId && e.id === (itemId || ""));
        if (!entry) return;

        // Se più categorie hanno lo stesso titolo si aggiunge la destinazione esatta.
        const duplicates = noteCategoryIndex.entries.filter(e =>
            normalizeCategoryText(e.title) === normalizeCategoryText(entry.title)
        ).length > 1;

        const token = "[[@" + entry.title + (duplicates ? "|" + entry.state + "/" + entry.id : "") + "]]";
        const start = textarea.selectionStart ?? textarea.value.length;
        const end = textarea.selectionEnd ?? start;

        textarea.value = textarea.value.slice(0, start) + token + textarea.value.slice(end);
        textarea.selectionStart = textarea.selectionEnd = start + token.length;
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
        close();
        textarea.focus();
    });

    input.addEventListener("input", render);
    render();
    input.focus();
}
