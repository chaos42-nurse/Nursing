/* =========================================================
   Ricerca degli elementi e visualizzazione delle schede (farmaci, laboratorio, protocolli)
   (script classico caricato prima di app.js: le funzioni sono globali)
========================================================= */
/* =========================================================
   DATABASE LOCALE — INTERAZIONI FARMACI
   Struttura tecnica offline predisposta per dati autorizzati.
========================================================= */

const DRUG_DB_NAME = "nursing-drug-database";

const DRUG_DB_VERSION = 1;

const DRUG_DB_STORE = "metadata";

function openDrugDatabase() {
    return new Promise((resolve, reject) => {
        if (!("indexedDB" in window)) {
            reject(new Error("IndexedDB non disponibile."));
            return;
        }

        const request = indexedDB.open(DRUG_DB_NAME, DRUG_DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(DRUG_DB_STORE)) {
                db.createObjectStore(DRUG_DB_STORE, { keyPath: "key" });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("Impossibile aprire il database locale."));
    });
}

async function getDrugDatabaseMetadata() {
    const db = await openDrugDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(DRUG_DB_STORE, "readonly");
        const store = transaction.objectStore(DRUG_DB_STORE);
        const request = store.get("dataset");

        request.onsuccess = () => {
            db.close();
            resolve(request.result || null);
        };

        request.onerror = () => {
            db.close();
            reject(request.error);
        };
    });
}

async function initializeDrugDatabaseMetadata() {
    const existing = await getDrugDatabaseMetadata().catch(() => null);

    if (existing) {
        return existing;
    }

    const metadata = {
        key: "dataset",
        source: "Da configurare — dataset autorizzato",
        version: "0",
        updatedAt: null,
        recordCount: 0,
        status: "empty"
    };

    const db = await openDrugDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(DRUG_DB_STORE, "readwrite");
        transaction.objectStore(DRUG_DB_STORE).put(metadata);

        transaction.oncomplete = () => {
            db.close();
            resolve(metadata);
        };

        transaction.onerror = () => {
            db.close();
            reject(transaction.error);
        };
    });
}

async function renderDrugInteractionDatabase() {
    const metadata = await initializeDrugDatabaseMetadata();

    content.innerHTML = `
        <section class="detail-page composable-page">
            ${detailHeader("Interazioni tra farmaci", window.__currentData)}

            <div class="detail-content">
                <article class="info-block info-block-note">
                    <strong>Database locale</strong>
                    <p>
                        Questa sezione utilizza un archivio locale IndexedDB.
                        I dati possono essere mantenuti sul dispositivo e
                        consultati offline.
                    </p>
                </article>

                <article class="info-block">
                    <h3>Stato archivio</h3>
                    <p><strong>Fonte:</strong> ${escapeHtml(metadata.source)}</p>
                    <p><strong>Versione:</strong> ${escapeHtml(metadata.version)}</p>
                    <p><strong>Record:</strong> ${escapeHtml(String(metadata.recordCount))}</p>
                    <p><strong>Ultimo aggiornamento:</strong> ${metadata.updatedAt ? escapeHtml(metadata.updatedAt) : "Non ancora disponibile"}</p>
                </article>

                <article class="info-block info-block-warning">
                    <span class="info-block-icon">ℹ️</span>
                    <div>
                        <strong>Archivio non ancora popolato</strong>
                        <p>
                            La struttura offline è pronta, ma non contiene
                            ancora dati di interazione. Prima di importarli
                            occorre utilizzare un dataset con autorizzazione
                            alla redistribuzione nell'app.
                        </p>
                    </div>
                </article>

                <button id="refreshDrugDatabaseStatus" class="settings-action" type="button">
                    ↻ Aggiorna stato archivio
                </button>
                <button id="verifyDrugInteractionsButton" class="settings-action" type="button">
                    🔄 Verifica Interazioni
                </button>
                <p id="drugDatabaseMessage" class="personal-note-message"></p>
            </div>
        </section>
    `;

    document.getElementById("verifyDrugInteractionsButton")?.addEventListener("click", () => {
        const interactionItem = {
            id: "interazioni-farmaci",
            title: "Interazioni tra farmaci",
            type: "interaction-db"
        };
        renderDrugInteractionDatabase();
    });

    document.getElementById("refreshDrugDatabaseStatus")?.addEventListener("click", async () => {
        const message = document.getElementById("drugDatabaseMessage");
        try {
            const current = await getDrugDatabaseMetadata();
            if (message) {
                message.textContent =
                    "Archivio locale disponibile. Nessun dataset remoto configurato.";
            }
            console.log("Nursing Shot — database farmaci:", current);
        } catch (error) {
            if (message) {
                message.textContent = "Impossibile leggere il database locale.";
            }
            console.error(error);
        }
    });
}

/* =========================================================
   TROVA ELEMENTO
========================================================= */

function findItem(data, itemId) {

    if (!data.sections || !itemId) {
        return null;
    }

    /*
     * Cerca ricorsivamente negli elementi dell'archivio.
     * Questo gestisce anche elementi annidati, come i
     * singoli calcolatori dentro la sezione Calcolatori.
     */

    function searchItems(items) {

        if (!Array.isArray(items)) {
            return null;
        }

        for (const currentItem of items) {

            const currentId =
                typeof currentItem === "string"
                    ? createId(currentItem)
                    : currentItem?.id;

            if (currentId === itemId) {
                return currentItem;
            }

            /*
             * Vecchio id di una classe unita a un'altra
             * (link salvati, note personali).
             */
            if (
                typeof currentItem === "object" &&
                Array.isArray(currentItem.aliasIds) &&
                currentItem.aliasIds.includes(itemId)
            ) {
                return currentItem;
            }

            if (
                typeof currentItem === "object" &&
                Array.isArray(currentItem.items)
            ) {

                const nestedItem =
                    searchItems(currentItem.items);

                if (nestedItem) {
                    return nestedItem;
                }
            }
        }

        return null;
    }

    for (const section of data.sections) {

        const found =
            searchItems(section.items);

        if (found) {
            return found;
        }
    }

    return null;
}

/* =========================================================
   CARICA ELEMENTO
========================================================= */

function loadItem(data) {

    const selectedItem =
        findItem(data, item);


    /*
     * ELEMENTO NON TROVATO
     */

    if (!selectedItem) {

        content.innerHTML = `

            <section>

                <h2>
                    Elemento non trovato
                </h2>

                <a
                    class="back-button"
                    href="?state=${encodeURIComponent(state)}"
                >
                    ← ${data.title}
                </a>

            </section>

        `;

        return;

    }


    /*
     * Link a una classe unita ad un'altra: porta all'id attuale,
     * cosi' le note personali usano sempre la stessa chiave.
     */
    if (
        typeof selectedItem === "object" &&
        selectedItem.id &&
        selectedItem.id !== item &&
        Array.isArray(selectedItem.aliasIds) &&
        selectedItem.aliasIds.includes(item)
    ) {
        const canonicalUrl = new URL(window.location.href);
        canonicalUrl.searchParams.set("item", selectedItem.id);
        window.location.replace(canonicalUrl.toString());
        return;
    }


    window.__currentData = data;
    window.__currentItemTitle =
        typeof selectedItem === "string"
            ? selectedItem
            : selectedItem.title || "Scheda";

    const notesMode =
        new URLSearchParams(window.location.search).get("notes");

    if (notesMode === "1") {
        renderPersonalNotesPage(
            state,
            item,
            data,
            window.__currentItemTitle
        );
        return;
    }


    /*
     * SCHEDA COMPONIBILE
     */
    if (Array.isArray(selectedItem.blocks)) {

        renderComposableItem(selectedItem, data);
        return;
    }



    /*
     * STRINGA SEMPLICE
     */
    if (typeof selectedItem === "string") {

        renderGenericText(
            selectedItem,
            "Contenuto in preparazione.",
            data
        );

        return;
    }


    /*
     * SEZIONE CALCOLATORI
     */
    if (selectedItem.type === "calculator-section") {

        renderCalculatorHub(
            selectedItem,
            data
        );

        return;
    }


    /*
     * CALCOLATORE
     */
    if (selectedItem.type === "calculator") {

        renderCalculator(
            selectedItem.id,
            selectedItem.title,
            data
        );

        return;
    }


    /*
     * DATABASE LOCALE — INTERAZIONI
     */
    if (selectedItem.type === "interaction-db") {
        renderDrugInteractions(selectedItem, data);
        return;
    }

    if (selectedItem.type === "category-section") {
        renderDrugClassCategory(selectedItem, data);
        return;
    }

    if (selectedItem.type === "drug-search") {
        renderDrugSearch();
        return;
    }



    /*
     * FARMACO
     */
    if (selectedItem.type === "drug") {

        renderDrug(
            selectedItem,
            data
        );

        return;
    }


    /*
     * VALORE DI LABORATORIO
     */
    if (selectedItem.type === "lab-value") {

        renderLabValue(
            selectedItem,
            data
        );

        return;
    }


    /*
     * PROTOCOLLO
     */
    if (selectedItem.type === "protocol") {

        renderProtocol(
            selectedItem,
            data
        );

        return;
    }


    /*
     * TESTO GENERICO
     */
    if (selectedItem.type === "text") {

        const text =
            selectedItem.content?.text ||
            "Contenuto in preparazione.";

        renderGenericText(
            selectedItem.title,
            text,
            data
        );

        return;
    }


    /*
     * FALLBACK
     */
    renderGenericText(
        selectedItem.title,
        "Contenuto in preparazione.",
        data
    );

}

/* =========================================================
   SCHEDE COMPONIBILI
========================================================= */

function renderComposableItem(item, data) {

    const blocks =
        Array.isArray(item.blocks)
            ? item.blocks
            : [];

    content.innerHTML = `
        <section class="detail-page composable-page">

            ${detailHeader(item.title, data)}

            <div class="detail-content composable-content">
                ${blocks.map(renderContentBlock).join("")}
            </div>

        </section>
    `;
}

function renderContentBlock(block) {

    if (!block || typeof block !== "object") {
        return "";
    }

    const type = block.type || "text";

    if (type === "text") {
        return `
            <article class="info-block info-block-text">
                ${block.title ? `<h3>${escapeHtml(block.title)}</h3>` : ""}
                <p>${escapeHtml(block.content || "")}</p>
            </article>
        `;
    }

    if (type === "value") {
        return `
            <article class="info-block info-block-value">
                ${block.title ? `<span class="info-block-label">${escapeHtml(block.title)}</span>` : ""}
                <strong>${escapeHtml(block.content || "")}</strong>
            </article>
        `;
    }

    if (type === "warning") {
        return `
            <aside class="info-block info-block-warning">
                <span class="info-block-icon">⚠️</span>
                <div>
                    ${block.title ? `<strong>${escapeHtml(block.title)}</strong>` : ""}
                    <p>${escapeHtml(block.content || "")}</p>
                </div>
            </aside>
        `;
    }

    if (type === "note") {
        return `
            <aside class="info-block info-block-note">
                ${block.title ? `<strong>${escapeHtml(block.title)}</strong>` : ""}
                <p>${escapeHtml(block.content || "")}</p>
            </aside>
        `;
    }

    if (type === "list") {

        const items =
            Array.isArray(block.items)
                ? block.items
                : [];

        const listTag =
            block.ordered ? "ol" : "ul";

        return `
            <article class="info-block info-block-list">
                ${block.title ? `<h3>${escapeHtml(block.title)}</h3>` : ""}
                <${listTag}>
                    ${items.map(item => `<li>${escapeHtml(item)}</li>`).join("")}
                </${listTag}>
            </article>
        `;
    }

    if (type === "table") {

        const headers =
            Array.isArray(block.headers)
                ? block.headers
                : [];

        const rows =
            Array.isArray(block.rows)
                ? block.rows
                : [];

        return `
            <article class="info-block info-block-table">
                ${block.title ? `<h3>${escapeHtml(block.title)}</h3>` : ""}
                <div class="info-table-wrapper">
                    <table>
                        ${headers.length ? `
                            <thead>
                                <tr>
                                    ${headers.map(header => `<th>${escapeHtml(header)}</th>`).join("")}
                                </tr>
                            </thead>
                        ` : ""}
                        <tbody>
                            ${rows.map(row => `
                                <tr>
                                    ${(Array.isArray(row) ? row : [row]).map(cell => `<td>${escapeHtml(cell)}</td>`).join("")}
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                </div>
            </article>
        `;
    }

    if (type === "divider") {
        return `<hr class="info-block-divider">`;
    }

    if (type === "image" && block.src) {
        return `
            <figure class="info-block info-block-image">
                <img src="${escapeAttribute(block.src)}" alt="${escapeAttribute(block.alt || "")}" loading="lazy">
                ${block.caption ? `<figcaption>${escapeHtml(block.caption)}</figcaption>` : ""}
            </figure>
        `;
    }

    if (type === "related") {

        const items =
            Array.isArray(block.items)
                ? block.items
                : [];

        return `
            <article class="info-block info-block-related">
                ${block.title ? `<h3>${escapeHtml(block.title)}</h3>` : ""}
                <div class="related-list">
                    ${items.map(related => {
                        const relatedId =
                            typeof related === "string"
                                ? createId(related)
                                : related?.id;
                        const relatedTitle =
                            typeof related === "string"
                                ? related
                                : related?.title;

                        if (!relatedId || !relatedTitle) {
                            return "";
                        }

                        return `
                            <a class="related-link" href="?state=${encodeURIComponent(data.id || state)}&item=${encodeURIComponent(relatedId)}">
                                <span>${escapeHtml(relatedTitle)}</span>
                                
                            </a>
                        `;
                    }).join("")}
                </div>
            </article>
        `;
    }

    return "";
}

/* =========================================================
   HEADER DETTAGLIO
========================================================= */

function detailHeader(title, data) {

    return `
        <div class="detail-header-row">
            <h2>${title}</h2>
        </div>

        ${state && item
            ? renderPersonalNotesButton(state, item)
            : ""}
    `;
}

/* =========================================================
   TESTO GENERICO
========================================================= */

function renderGenericText(title, text, data = null) {

    content.innerHTML = `

        <section class="detail-page">

            ${
                data
                    ? detailHeader(title, data)
                    : `<h2>${title}</h2>`
            }

            <div class="detail-content">

                <p>
                    ${text}
                </p>

            </div>

        </section>

    `;

}

/* =========================================================
   FARMACO
========================================================= */

function renderDrug(item, data) {

    const drug =
        item.content || {};


    content.innerHTML = `

        <section class="detail-page">

            ${detailHeader(item.title, data)}

            <div class="detail-content">

                ${renderField(
                    "Classe",
                    drug.class
                )}

                ${renderListField(
                    "Esempi",
                    drug.indications
                )}

                ${renderListField(
                    "Effetti",
                    drug.effects
                )}

                ${renderDrugTable(
                    drug.table
                )}

                ${renderListField(
                    "Controindicazioni",
                    drug.contraindications
                )}

                ${renderListField(
                    "Effetti indesiderati",
                    drug.adverseEffects
                )}

                ${renderListField(
                    "Vie di somministrazione",
                    drug.routes
                )}

                ${renderListField(
                    "Monitoraggio",
                    drug.monitoring
                )}

                ${renderListField(
                    "Avvertenze infermieristiche",
                    drug.nursingNotes
                )}

                ${renderField(
                    "Note",
                    drug.notes
                )}

                <article class="info-block info-block-note drug-disclaimer">
                    <strong>Uso didattico</strong>
                    <p>Informazioni generali sulla classe: per dosi, diluizioni e compatibilità
                    verifica sempre la scheda tecnica (RCP) del singolo farmaco e il protocollo
                    della tua struttura.</p>
                </article>

            </div>

        </section>

    `;

    if (drug.table) {
        linkDrugTableToCurrentClasses(item.id, data.id);
    }

}

/* =========================================================
   TABELLA FARMACI DI UNA CLASSE (es. Antagonisti)
   I nomi dei farmaci puntano alla classe che hanno già nel
   resto dell'app (indice AIFA, eccezioni e codice ATC), mai
   alla classe che contiene la tabella.
========================================================= */

function renderDrugTable(table) {

    const rows =
        Array.isArray(table?.rows)
            ? table.rows
            : [];

    if (!rows.length) {

        return "";

    }

    const headers =
        Array.isArray(table.headers)
            ? table.headers
            : [];

    return `

        <article class="info-block info-block-table">

            ${table.title ? `<h3>${escapeHtml(table.title)}</h3>` : ""}

            <div class="info-table-wrapper">

                <table>

                    ${headers.length ? `
                        <thead>
                            <tr>
                                ${headers.map(header => `<th>${escapeHtml(header)}</th>`).join("")}
                            </tr>
                        </thead>
                    ` : ""}

                    <tbody>

                        ${rows.map(row => `
                            <tr>
                                <td>${escapeHtml(row.compound)}</td>
                                <td>
                                    <span class="drug-table-drug"
                                        data-drug-name="${escapeAttribute(row.drug)}"
                                        data-drug-atc="${escapeAttribute(row.atc || "")}">${escapeHtml(row.drug)}</span>
                                </td>
                                <td>${escapeHtml(row.action)}</td>
                            </tr>
                        `).join("")}

                    </tbody>

                </table>

            </div>

        </article>

    `;

}

async function resolveCurrentDrugClass(name, atc, excludedClassId) {

    const key =
        normalizeDrugSearchText(name);

    const [index, table] = await Promise.all([
        loadDrugActiveIngredientIndex().catch(() => []),
        loadAtcClassTable()
    ]);

    const indexed =
        index.find(entry =>
            normalizeDrugSearchText(entry.principioAttivo) === key &&
            entry.classeId &&
            entry.classeId !== excludedClassId
        );

    if (indexed) {

        return {
            id: indexed.classeId,
            name: indexed.classeNome
        };

    }

    const code =
        String(atc || "").trim().toUpperCase();

    const rule =
        code
            ? table.regole.find(r => code.startsWith(r.atc))
            : null;

    const classId =
        table.eccezioni[key] ||
        (rule && rule.id);

    if (!classId || classId === excludedClassId || !table.classi[classId]) {

        return null;

    }

    return {
        id: classId,
        name: table.classi[classId]
    };

}

async function linkDrugTableToCurrentClasses(currentClassId, stateId) {

    const cells =
        Array.from(document.querySelectorAll(".drug-table-drug"));

    await Promise.all(cells.map(async cell => {

        try {

            const target =
                await resolveCurrentDrugClass(
                    cell.dataset.drugName,
                    cell.dataset.drugAtc,
                    currentClassId
                );

            if (!target || !document.body.contains(cell)) return;

            cell.innerHTML = `
                <a href="?state=${encodeURIComponent(stateId)}&item=${encodeURIComponent(target.id)}">
                    <strong>${escapeHtml(cell.dataset.drugName)}</strong>
                </a>
                <small class="drug-table-class">→ ${escapeHtml(target.name)}</small>
            `;

        } catch (error) {

            /* In caso di errore il nome resta semplice testo. */

        }

    }));

}

/* =========================================================
   LABORATORIO
========================================================= */

function renderLabValue(item, data) {

    const lab =
        item.content || {};


    content.innerHTML = `

        <section class="detail-page">

            ${detailHeader(item.title, data)}

            <div class="detail-content">

                ${renderField(
                    "Descrizione",
                    lab.description
                )}

                ${renderField(
                    "Valori di riferimento",
                    lab.normal
                )}

                ${renderField(
                    "↑ Aumento",
                    lab.high
                )}

                ${renderField(
                    "↓ Riduzione",
                    lab.low
                )}

            </div>

        </section>

    `;

}

/* =========================================================
   PROTOCOLLO
========================================================= */

function renderProtocol(item, data) {

    const protocol =
        item.content || {};


    let stepsHTML = "";


    if (protocol.steps) {

        protocol.steps.forEach(step => {

            stepsHTML += `

                <div class="protocol-step">

                    <h3>
                        ${step.letter || ""}
                        ${step.title || ""}
                    </h3>

                    <p>
                        ${step.text || ""}
                    </p>

                </div>

            `;

        });

    }


    content.innerHTML = `

        <section class="detail-page">

            ${detailHeader(item.title, data)}

            <div class="detail-content">

                ${stepsHTML}

            </div>

        </section>

    `;

}

/* =========================================================
   CAMPO
========================================================= */

function renderField(title, value) {

    if (!value) {

        return "";

    }


    return `

        <div class="info-block">

            <h3>
                ${title}
            </h3>

            <p>
                ${value}
            </p>

        </div>

    `;

}

/* =========================================================
   LISTA
========================================================= */

function renderListField(title, values) {

    if (!values || !values.length) {

        return "";

    }


    return `

        <div class="info-block">

            <h3>
                ${title}
            </h3>

            <ul>

                ${values.map(value => `
                    <li>${value}</li>
                `).join("")}

            </ul>

        </div>

    `;

}
