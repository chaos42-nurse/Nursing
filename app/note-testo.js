/* =========================================================
   Formattazione del testo delle note, tabelle, checklist e pagina dei collegamenti
   (script classico caricato prima di app.js: le funzioni sono globali)
========================================================= */
/* =========================================================
   FORMATTAZIONE NELLE NOTE
   Un carattere per stile: asterisco = grassetto, barra = corsivo, trattino basso = sottolineato.
   Si possono sommare annidandoli (vedi esempi nella guida delle note).
========================================================= */

const NOTE_FORMAT_TOKENS = {
    b: ["\uE000", "\uE001", "<strong>", "</strong>"],
    i: ["\uE002", "\uE003", "<em>", "</em>"],
    u: ["\uE004", "\uE005", "<u>", "</u>"]
};

// Evidenziatore (=testo=) e colore del testo (~testo~): g giallo, v verde, r rosso, a azzurro.
const NOTE_COLOR_LETTERS = ["g", "v", "r", "a"];

function markNoteFormatting(source) {
    // I collegamenti [[...]] e <placeorder> vengono messi da parte: dentro non si formatta.
    const saved = [];
    let text = String(source).replace(/<placeorder>[\s\S]*?<\/placeorder>|\[\[[\s\S]*?\]\]/gi, match => {
        saved.push(match);
        return "\uE010" + (saved.length - 1) + "\uE011";
    });

    const wrap = (pattern, kinds) => {
        text = text.replace(pattern, (all, inner) =>
            kinds.map(k => NOTE_FORMAT_TOKENS[k][0]).join("") +
            inner +
            kinds.slice().reverse().map(k => NOTE_FORMAT_TOKENS[k][1]).join("")
        );
    };

    // Un solo carattere per stile: *grassetto*  /corsivo/  _sottolineato_
    // (restano valide anche le vecchie forme **grassetto** e __sottolineato__).
    // Il segno deve toccare il testo e non stare dentro una parola: 2*3*4, mg/mL, 11/10 restano com'erano.
    const single = (mark, kind) => {
        const m = mark.replace(/[*/]/g, c => "\\" + c);
        const wordChar = "\\p{L}\\p{N}";
        wrap(new RegExp("(?<![" + wordChar + m + "])" + m + "(?=[^\\s" + m + "])([^\n" + m + "]*?[^\\s" + m + "])" + m + "(?![" + wordChar + m + "])", "gu"), [kind]);
    };

    // =testo= evidenzia (giallo); =v:testo= =r:testo= =a:testo= altri colori.
    // ~testo~ colora le lettere (rosso); ~v:testo~ ~a:testo~ altri colori. Il segno non sta dentro una parola.
    const colored = (mark, prefix, defaultLetter) => {
        const wordChar = "\\p{L}\\p{N}";
        const pattern = new RegExp(
            "(?<![" + wordChar + mark + "])" + mark + "(?:([gvra]):)?(?=[^\\s" + mark + "])([^\n" + mark + "]*?[^\\s" + mark + "])" + mark + "(?![" + wordChar + mark + "])",
            "gu"
        );
        text = text.replace(pattern, (all, letter, inner) => {
            const kind = prefix + (letter || defaultLetter);
            return NOTE_FORMAT_TOKENS[kind][0] + inner + NOTE_FORMAT_TOKENS[kind][1];
        });
    };

    wrap(/\*\*(?=[^\s*])([^\n]*?[^\s*])\*\*/g, ["b"]);
    wrap(/__(?=[^\s_])([^\n]*?[^\s_])__/g, ["u"]);
    single("*", "b");
    single("/", "i");
    single("_", "u");
    colored("=", "h", "g");
    colored("~", "t", "r");

    return text.replace(/\uE010(\d+)\uE011/g, (all, index) => saved[Number(index)]);
}

function renderNoteFormatTokens(html) {
    let out = String(html);

    Object.values(NOTE_FORMAT_TOKENS).forEach(([open, close, openTag, closeTag]) => {
        out = out.split(open).join(openTag).split(close).join(closeTag);
    });

    return out;
}

function renderInlineNoteText(text) {
    const source = markNoteFormatting(String(text || ""));
    const pattern = /<placeorder>([\s\S]*?)<\/placeorder>|\[\[([\s\S]*?)\]\]/gi;
    let html = "";
    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(source)) !== null) {
        html += escapeNoteText(source.slice(lastIndex, match.index));

        const term = String(match[1] || match[2] || "").trim();

        if (/^audio:[\w-]+$/.test(term) && window.AudioNotes) {
            html += window.AudioNotes.renderToken(term.slice(6));
        } else if (/^img:[\w-]+$/.test(term) && window.AudioNotes) {
            html += window.AudioNotes.renderImageToken(term.slice(4));
        } else if (term.startsWith("@")) {
            const spec = parseCategoryLinkSpec(term);
            const target = resolveCategoryLink(spec);

            html += '<a class="note-category-link' + (target ? "" : " note-category-link-missing") + '"' +
                ' data-note-cat="' + escapeAttribute(term.slice(1)) + '"' +
                ' href="' + escapeAttribute(target ? target.href : "#") + '"' +
                ' title="' + escapeAttribute(target ? "Apri: " + target.path : "Categoria non trovata") + '">📂 ' +
                escapeHtml(spec.label) + '</a>';
        } else if (term) {
            html += '<a class="personal-note-linked-term" href="?links=1&term=' +
                encodeURIComponent(term) +
                '" title="Visualizza i collegamenti di ' +
                escapeAttribute(term) +
                '">' +
                escapeHtml(term) +
                '</a>';
        }

        lastIndex = pattern.lastIndex;
    }

    html += escapeNoteText(source.slice(lastIndex));
    return renderNoteFormatTokens(html);
}

function parseNoteTableRow(line) {
    const source = String(line || "");
    const cells = [];
    let index = 0;

    while (index < source.length && /\s/.test(source[index])) index++;

    while (index < source.length) {
        if (source[index] !== "[") return null;

        // Una cella deve avere una chiusura "]". Le parentesi doppie
        // vengono lasciate al contenuto della cella: [ [[placeholder]] ].
        let end = index + 1;
        let depth = 0;
        let closingIndex = -1;

        for (; end < source.length; end++) {
            if (source[end] === "[" && source[end + 1] === "[") {
                depth++;
                end++;
                continue;
            }

            if (source[end] === "]" && source[end + 1] === "]" && depth > 0) {
                depth--;
                end++;
                continue;
            }

            if (source[end] === "]" && depth === 0) {
                closingIndex = end;
                break;
            }
        }

        if (closingIndex === -1) return null;

        const rawCell = source.slice(index + 1, closingIndex);
        cells.push(rawCell.trim());

        index = closingIndex + 1;

        let spaces = 0;
        while (index < source.length && /\s/.test(source[index])) {
            spaces++;
            index++;
        }

        if (index >= source.length) break;
        if (spaces === 0 || source[index] !== "[") return null;
    }

    return cells.length >= 2 ? cells : null;
}

function parseNoteTableRowFromLines(lines, startIndex) {
    if (startIndex >= lines.length) return null;

    const singleLine = parseNoteTableRow(lines[startIndex]);
    if (singleLine) return { row: singleLine, nextIndex: startIndex + 1 };

    // Se una cella resta aperta, le righe successive diventano parte della cella
    // fino alla parentesi ] di chiusura. In questo modo il contenuto può andare a capo.
    if (!/^\s*\[/.test(lines[startIndex])) return null;

    let candidate = lines[startIndex];
    for (let nextIndex = startIndex + 1; nextIndex < lines.length; nextIndex++) {
        candidate += "\n" + lines[nextIndex];
        const row = parseNoteTableRow(candidate);
        if (row) return { row, nextIndex: nextIndex + 1 };

        // Se inizia una nuova riga-tabella completa, la cella precedente era incompleta.
        if (parseNoteTableRow(lines[nextIndex])) return null;
    }

    return null;
}

function renderNoteTableCell(cell, noteId = "", rowIndex = 0, columnIndex = 0) {
    const lines = String(cell ?? "").split(/\r?\n/);
    let html = "";
    let bulletItems = [];
    const checklistState = readChecklistState();
    const occurrences = new Map();

    const renderTableChecklistItem = (label, explicitChecked) => {
        const occurrence = occurrences.get(label) || 0;
        occurrences.set(label, occurrence + 1);
        const key = String(noteId) + "::table::" + rowIndex + "::" + columnIndex + "::" + label + "::" + occurrence;
        const checked = Object.prototype.hasOwnProperty.call(checklistState, key)
            ? Boolean(checklistState[key])
            : Boolean(explicitChecked);
        return '<label class="note-checklist-item note-table-checklist-item' +
            (checked ? ' is-checked' : '') + '">' +
            '<input type="checkbox" class="note-checklist-checkbox" data-note-checklist-key="' +
            escapeAttribute(key) + '"' + (checked ? ' checked' : '') + '>' +
            '<span>' + renderInlineNoteText(label) + '</span></label>';
    };

    const flushBullets = () => {
        if (!bulletItems.length) return;
        html += '<ul class="personal-note-table-list">' +
            bulletItems.map(item => '<li>' + renderInlineNoteText(item) + '</li>').join("") +
            '</ul>';
        bulletItems = [];
    };

    lines.forEach(line => {
        const checklist = line.match(/^\s*-\s+(?:\[([ xX])\]\s+)?(.+)$/);
        if (checklist && noteId) {
            flushBullets();
            html += '<div class="note-table-checklist-row">' +
                renderTableChecklistItem(checklist[2], checklist[1] && checklist[1].toLowerCase() === "x") +
                '</div>';
            return;
        }

        const bullet = line.match(/^\s*-\s+(.+)$/);
        if (bullet) {
            bulletItems.push(bullet[1]);
            return;
        }

        flushBullets();
        if (line.trim()) {
            html += '<div>' + renderInlineNoteText(line) + '</div>';
        } else {
            html += '<div class="personal-note-table-line-break"></div>';
        }
    });

    flushBullets();
    return html;
}

function renderNoteTable(rows, noteId = "") {
    if (!Array.isArray(rows) || rows.length < 2) return "";

    const columnCount = rows[0].length;

    if (columnCount < 2 || rows.some(row => row.length !== columnCount)) {
        return "";
    }

    return '<div class="personal-note-table-wrapper"><table class="personal-note-table">' +
        '<thead><tr>' +
        rows[0].map((cell, columnIndex) => '<th>' + renderNoteTableCell(cell, noteId, 0, columnIndex) + '</th>').join("") +
        '</tr></thead>' +
        '<tbody>' +
        rows.slice(1).map((row, rowOffset) =>
            '<tr>' +
            row.map((cell, columnIndex) => '<td>' + renderNoteTableCell(cell, noteId, rowOffset + 1, columnIndex) + '</td>').join("") +
            '</tr>'
        ).join("") +
        '</tbody></table></div>';
}

/* ---- Spunte delle liste: chiavi stabili ----
   La chiave usa testo + n° di occorrenza (non la posizione della riga), così aggiungere,
   togliere o spostare righe non azzera le altre spunte. */
const CHECKLIST_LINE = /^\s*-\s+(?:\[([ xX])\]\s+)?(.+)$/;

function checklistKeysFor(noteId, text) {
    const counts = new Map();
    const items = [];
    String(text || "").split(/\r?\n/).forEach((line, lineIndex) => {
        const match = line.match(CHECKLIST_LINE);
        if (!match) return;
        const label = match[2];
        const occurrence = counts.get(label) || 0;
        counts.set(label, occurrence + 1);
        items.push({
            text: label,
            lineIndex,
            key: String(noteId) + "::t::" + label + "::" + occurrence,
            legacyKey: String(noteId) + "::" + lineIndex + "::" + label
        });
    });
    return items;
}

function readChecklistState() {
    try {
        return JSON.parse(localStorage.getItem("nursing-note-checklists") || "{}") || {};
    } catch (error) {
        return {};
    }
}

/* Modificando una nota, le spunte seguono le voci rimaste uguali; una voce solo
   riscritta (stessa posizione nel blocco modificato) mantiene la sua spunta. */
function migrateChecklistState(noteId, oldText, newText) {
    if (!noteId || oldText === newText) return;

    const oldItems = checklistKeysFor(noteId, oldText);
    if (!oldItems.length) return;
    const newItems = checklistKeysFor(noteId, newText);
    const state = readChecklistState();

    const valueOf = item => {
        if (Object.prototype.hasOwnProperty.call(state, item.key)) return Boolean(state[item.key]);
        if (Object.prototype.hasOwnProperty.call(state, item.legacyKey)) return Boolean(state[item.legacyKey]);
        return undefined;
    };

    let prefix = 0;
    while (prefix < oldItems.length && prefix < newItems.length && oldItems[prefix].text === newItems[prefix].text) prefix++;
    let suffix = 0;
    while (
        suffix < oldItems.length - prefix && suffix < newItems.length - prefix &&
        oldItems[oldItems.length - 1 - suffix].text === newItems[newItems.length - 1 - suffix].text
    ) suffix++;

    const carried = new Map();
    const pair = (oldItem, newItem) => {
        const value = valueOf(oldItem);
        if (value !== undefined) carried.set(newItem.key, value);
    };

    for (let i = 0; i < prefix; i++) pair(oldItems[i], newItems[i]);
    for (let i = 0; i < suffix; i++) pair(oldItems[oldItems.length - 1 - i], newItems[newItems.length - 1 - i]);

    const oldMiddle = oldItems.slice(prefix, oldItems.length - suffix);
    const newMiddle = newItems.slice(prefix, newItems.length - suffix);
    // Voci uguali ma spostate dentro il blocco modificato: si abbinano per testo.
    const usedOld = new Set();
    newMiddle.forEach(item => {
        const j = oldMiddle.findIndex((candidate, idx) => !usedOld.has(idx) && candidate.text === item.text);
        if (j >= 0) { usedOld.add(j); pair(oldMiddle[j], item); }
    });
    // Le altre, riscritte, si abbinano per posizione.
    const leftoverOld = oldMiddle.filter((_, idx) => !usedOld.has(idx));
    const leftoverNew = newMiddle.filter(item => !carried.has(item.key));
    leftoverNew.forEach((item, idx) => { if (leftoverOld[idx]) pair(leftoverOld[idx], item); });

    oldItems.forEach(item => { delete state[item.key]; delete state[item.legacyKey]; });
    carried.forEach((value, key) => { state[key] = value; });

    try {
        localStorage.setItem("nursing-note-checklists", JSON.stringify(state));
    } catch (error) {}
}

function clearChecklistState(noteId, text) {
    const state = readChecklistState();
    checklistKeysFor(noteId, text).forEach(item => { delete state[item.key]; delete state[item.legacyKey]; });
    try { localStorage.setItem("nursing-note-checklists", JSON.stringify(state)); } catch (error) {}
}

function renderNoteText(text, stateId = "", itemId = "", noteId = "") {
    const source = String(text || "");
    const lines = source.split(/\r?\n/);
    let html = "";
    let index = 0;
    let checklistState = {};
    let checklistOrder = "original";

    if (noteId) {
        try {
            checklistState = JSON.parse(localStorage.getItem("nursing-note-checklists") || "{}");
        } catch (error) {
            checklistState = {};
        }
        try {
            const orderSettings = JSON.parse(localStorage.getItem("nursing-note-checklist-order") || "{}");
            checklistOrder = orderSettings[String(noteId)] || "original";
        } catch (error) {
            checklistOrder = "original";
        }
    }

    const isChecklistLine = line => Boolean(noteId) && CHECKLIST_LINE.test(line);
    const checklistKeys = noteId
        ? new Map(checklistKeysFor(noteId, source).map(item => [item.lineIndex, item]))
        : new Map();
    const getChecklistEntry = (line, lineIndex) => {
        const match = line.match(CHECKLIST_LINE);
        if (!match) return null;
        const info = checklistKeys.get(lineIndex);
        const key = info.key;
        const has = k => Object.prototype.hasOwnProperty.call(checklistState, k);
        const checked = has(key)
            ? Boolean(checklistState[key])
            : has(info.legacyKey)
                ? Boolean(checklistState[info.legacyKey])
                : Boolean(match[1]) && match[1].toLowerCase() === "x";
        return { text: match[2], key, checked, index: lineIndex };
    };
    const renderChecklistEntry = entry =>
        '<label class="note-checklist-item' + (entry.checked ? ' is-checked' : '') + '">' +
        '<input type="checkbox" class="note-checklist-checkbox" data-note-checklist-key="' +
        escapeAttribute(entry.key) + '"' + (entry.checked ? ' checked' : '') + '>' +
        '<span>' + renderInlineNoteText(entry.text) + '</span>' +
        '</label>';

    while (index < lines.length) {
        if (isChecklistLine(lines[index])) {
            const entries = [];
            while (index < lines.length && isChecklistLine(lines[index])) {
                entries.push(getChecklistEntry(lines[index], index));
                index++;
            }

            if (checklistOrder === "top") {
                entries.sort((a, b) => Number(b.checked) - Number(a.checked) || a.index - b.index);
            } else if (checklistOrder === "bottom") {
                entries.sort((a, b) => Number(a.checked) - Number(b.checked) || a.index - b.index);
            }

            html += entries.map(renderChecklistEntry).join("<br>");
            if (index < lines.length) html += "<br>";
            continue;
        }

        const orderedMatch = lines[index].match(/^\s*(\d+|[a-zA-Z])\.\s+(.+)$/);
        const bulletMatch = lines[index].match(/^\s*([°•])\s+(.+)$/);
        if (orderedMatch) {
            const isNumeric = /^\d+$/.test(orderedMatch[1]);
            const startValue = isNumeric ? Number.parseInt(orderedMatch[1], 10) : orderedMatch[1].toLowerCase().charCodeAt(0) - 96;
            const listType = isNumeric ? "" : (orderedMatch[1] === orderedMatch[1].toUpperCase() ? ' type="A"' : ' type="a"');
            const items = [];
            while (index < lines.length) {
                const match = lines[index].match(/^\s*(\d+|[a-zA-Z])\.\s+(.+)$/);
                if (!match || /^\d+$/.test(match[1]) !== isNumeric) break;
                items.push(match[2]);
                index++;
            }
            html += '<ol' + listType + (isNumeric && startValue !== 1 ? ' start="' + startValue + '"' : '') + '>' +
                items.map(item => '<li>' + renderInlineNoteText(item) + '</li>').join("") + '</ol>';
            if (index < lines.length) html += "<br>";
            continue;
        }
        if (bulletMatch) {
            const items = [];
            while (index < lines.length) {
                const match = lines[index].match(/^\s*([°•])\s+(.+)$/);
                if (!match) break;
                items.push(match[2]);
                index++;
            }
            html += '<ul class="personal-note-symbol-list">' +
                items.map(item => '<li>' + renderInlineNoteText(item) + '</li>').join("") + '</ul>';
            if (index < lines.length) html += "<br>";
            continue;
        }

        const firstParsedRow = parseNoteTableRowFromLines(lines, index);
        if (firstParsedRow) {
            const firstRow = firstParsedRow.row;
            const tableRows = [firstRow];
            let nextIndex = firstParsedRow.nextIndex;
            while (nextIndex < lines.length) {
                const parsedRow = parseNoteTableRowFromLines(lines, nextIndex);
                if (!parsedRow || parsedRow.row.length !== firstRow.length) break;
                tableRows.push(parsedRow.row);
                nextIndex = parsedRow.nextIndex;
            }
            if (tableRows.length >= 2) {
                html += renderNoteTable(tableRows, noteId);
                if (nextIndex < lines.length) html += "<br>";
                index = nextIndex;
                continue;
            }
        }

        html += renderInlineNoteText(lines[index]);
        if (index < lines.length - 1) html += "<br>";
        index++;
    }
    return html;
}

function renderPersonalNotesButton(stateId, itemId) {
    return `
        <a
            class="personal-notes-button"
            href="?state=${encodeURIComponent(stateId)}&item=${encodeURIComponent(itemId)}&notes=1"
        >
            <span>📝 Note personali</span>
            
        </a>
    `;
}

function getPatientShortcutText(patient) {
    const parts = [
        patient?.name,
        patient?.birthDate,
        patient?.age,
        patient?.room,
        patient?.bed,
        patient?.pathologies,
        patient?.admissionReason,
        patient?.allergies,
        patient?.medications,
        patient?.notes
    ];

    if (Array.isArray(patient?.pvHistory)) {
        for (const entry of patient.pvHistory) {
            parts.push(
                entry?.recordedAt,
                entry?.pa,
                entry?.fc,
                entry?.sat,
                entry?.temperature
            );
        }
    }

    return parts.filter(value => String(value || "").trim()).join("\n");
}

function makePatientUrl(patientId) {
    return "?patients=1&patient=" + encodeURIComponent(patientId);
}

function renderAllNoteLinksPage(termFilter = "") {
    const groups = new Map();

    function addShortcutSource(term, source) {
        const key = normalizeLinkTerm(term);

        if (!key) return;

        if (!groups.has(key)) {
            groups.set(key, { term, records: [] });
        }

        const group = groups.get(key);

        const alreadyExists = group.records.some(existing => {
            if (existing.type !== source.type) return false;

            if (source.type === "patient") {
                return existing.patient.id === source.patient.id;
            }

            if (source.type === "appnote") {
                return String(existing.note.id) === String(source.note.id);
            }

            return (
                existing.stateId === source.stateId &&
                existing.itemId === source.itemId &&
                String(existing.note.id) === String(source.note.id)
            );
        });

        if (!alreadyExists) {
            group.records.push(source);
        }
    }

    // Shortcut presenti nelle note personali, sia nel titolo sia nel testo.
    for (const record of getAllPersonalNoteRecords()) {
        for (const term of extractPlaceorders(
            String(record.note.title || "") + "\n" +
            String(record.note.text || "")
        )) {
            addShortcutSource(term, {
                type: "note",
                ...record
            });
        }
    }

    // Shortcut presenti nelle Note generali, sia nel titolo sia nel testo.
    for (const note of getAppNotes()) {
        for (const term of extractPlaceorders(
            String(note.title || "") + "\n" +
            String(note.text || "")
        )) {
            addShortcutSource(term, {
                type: "appnote",
                note
            });
        }
    }

    // Shortcut presenti in qualsiasi dato testuale del paziente.
    for (const patient of getPatients()) {
        for (const term of extractPlaceorders(
            getPatientShortcutText(patient)
        )) {
            addShortcutSource(term, {
                type: "patient",
                patient
            });
        }
    }

    let visibleGroups = Array.from(groups.values())
        .filter(group => group.records.length >= 1)
        .sort((a, b) =>
            normalizeLinkTerm(a.term).localeCompare(
                normalizeLinkTerm(b.term), "it"
            )
        );

    if (termFilter) {
        const normalizedFilter = normalizeLinkTerm(termFilter);
        visibleGroups = visibleGroups.filter(group =>
            normalizeLinkTerm(group.term) === normalizedFilter
        );
    }

    content.innerHTML = `
        <section class="detail-page personal-links-page">
            <div class="detail-header-row">
                <h2>🔗 Collegamenti tra note</h2>
            </div>
            <p class="personal-notes-context">
                Tutti i collegamenti creati con [[parola]], comprese le schede paziente.
            </p>
            ${termFilter ? `
                <div class="personal-note-filter">
                    Parola selezionata: <strong>${escapeHtml(termFilter)}</strong>
                    <a href="?links=1">Mostra tutti</a>
                </div>
            ` : ""}
            <div class="personal-note-index-list">
                ${visibleGroups.length
                    ? visibleGroups.map(group => `
                        <article class="personal-note-index-group">
                            <strong class="personal-note-index-term">${escapeHtml(group.term)}</strong>
                            <div class="personal-note-index-links">
                                ${group.records.map(record => record.type === "patient"
                                    ? `
                                        <a class="personal-note-index-link"
                                           href="${makePatientUrl(record.patient.id)}">
                                            <span>👤 Pazienti</span>
                                            <strong>${escapeHtml(record.patient.name || "Paziente senza nome")}</strong>
                                        </a>
                                    `
                                    : record.type === "appnote"
                                    ? `
                                        <a class="personal-note-index-link"
                                           href="?appnotes=1#app-note-${encodeURIComponent(record.note.id)}">
                                            <span>📝 Note</span>
                                            <strong>${escapeHtml(record.note.title || "Nota")}</strong>
                                        </a>
                                    `
                                    : `
                                        <a class="personal-note-index-link"
                                           href="${makeNoteUrl(record.stateId, record.itemId, record.note.id)}">
                                            <span>${escapeHtml(record.stateId)} › ${escapeHtml(record.itemId)}</span>
                                            <strong>${escapeHtml(record.note.title || "Nota personale")}</strong>
                                        </a>
                                    `
                                ).join("")}
                            </div>
                        </article>
                    `).join("")
                    : `<div class="personal-note-empty">${termFilter
                        ? "Nessun collegamento trovato per questa parola."
                        : "Non ci sono ancora parole presenti nelle note o nei pazienti."}</div>`
                }
            </div>
        </section>
    `;
}
