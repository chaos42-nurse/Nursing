/* =========================================================
   PULIZIA VECCHIA SCHERMATA DI CARICAMENTO
========================================================= */

/* =========================================================
   PARAMETRI URL
========================================================= */

const params = new URLSearchParams(
    window.location.search
);

const state = params.get("state");
const item = params.get("item");
const editor =
    params.get("editor");
const patientRouteId =
    params.get("patient") || "";

const patientPhotosRoute =
    params.get("patientPhotos") || "";

const appNotesRoute =
    params.get("appnotes") || "";

const contactRoute =
    params.get("contact") || "";


/* =========================================================
   ELEMENTI HTML
========================================================= */

const stateTitle =
    document.getElementById("state");

const description =
    document.getElementById("description");

const content =
    document.getElementById("content");

const shortcuts =
    document.getElementById("shortcuts");

const backButton =
    document.getElementById("backButton");



/* =========================================================
   NAVIGAZIONE
========================================================= */

if (backButton) {

    backButton.addEventListener("click", () => {

        const photoViewer = document.getElementById("patientPhotoViewer");
        if (photoViewer) {
            photoViewer.querySelector('[data-viewer="close"]')?.click();
            return;
        }

        if (patientPhotosRoute === "1") {
            const url = new URL(window.location.href);
            url.searchParams.delete("patientPhotos");
            window.history.pushState({}, "", url);
            renderPatientsPage(patientRouteId, false);
            return;
        }

        if (patientsRoute === "1") {
            const currentPatient =
                document.querySelector(".patient-editor[data-selected-id]");

            if (currentPatient) {
                const url = new URL(window.location.href);
                url.searchParams.delete("patient");
                window.history.pushState({}, "", url);
                renderPatientsPage();
            } else {
                window.location.href = "./";
            }
            return;
        }

        if (window.history.length > 1) {

            window.history.back();

        } else {

            window.location.href = "./";

        }

    });

}


/* =========================================================
   ID AUTOMATICO
========================================================= */

function createId(text) {

    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

}


/* =========================================================
   CARICA CATEGORIE
========================================================= */

async function loadCategories() {

    try {

        const response =
            await fetch("./data/categories.json");

        if (!response.ok) {

            throw new Error(
                "Categorie non trovate"
            );

        }

        const categories =
            await response.json();

        createShortcuts(categories);

    }

    catch (error) {

        console.error(error);

        shortcuts.innerHTML = `
            <p>
                Impossibile caricare le categorie.
            </p>
        `;

    }

}


/* =========================================================
   CREA SHORTCUT
========================================================= */

function createShortcuts(categories) {

    let savedOrder = null;

    try {
        savedOrder = JSON.parse(
            localStorage.getItem("nursing-category-order") || "null"
        );
    } catch (_) {
        localStorage.removeItem("nursing-category-order");
    }

    let orderedCategories = [...categories];

    if (Array.isArray(savedOrder)) {
        orderedCategories.sort((a, b) => {
            const aIndex = savedOrder.indexOf(a.id);
            const bIndex = savedOrder.indexOf(b.id);
            return (
                (aIndex === -1 ? 999 : aIndex) -
                (bIndex === -1 ? 999 : bIndex)
            );
        });
    }

    shortcuts.innerHTML = "";

    orderedCategories.forEach((category, index) => {

        const row = document.createElement("div");
        row.className = "shortcut-row";

        const link = document.createElement("a");
        link.className = "shortcut";
        link.href = category.route === "patients"
            ? "?patients=1"
            : `?state=${encodeURIComponent(category.id)}`;
        link.dataset.categoryId = category.id;

        link.innerHTML = `
            <span class="shortcut-icon">${category.icon || ""}</span>
            <span class="shortcut-text">
                <strong>${category.title}</strong>
                <small>${category.description || ""}</small>
            </span>
        `;

        row.appendChild(link);

        if (isOrderEditMode()) {
            row.appendChild(
                createOrderControls(
                    index,
                    orderedCategories.length,
                    "categoria"
                )
            );
        }

        shortcuts.appendChild(row);
    });

    setupHomeOrderControls();
}


/* =========================================================
   RIORDINO HOME — LONG PRESS + POINTER DRAG
========================================================= */

let draggedShortcut = null;

function setupShortcutDrag(element) {

    element.addEventListener("contextmenu", event => event.preventDefault());

    let timer = null;
    let dragging = false;
    let pointerId = null;
    let startX = 0;
    let startY = 0;

    element.addEventListener("pointerdown", event => {

        if (
            event.pointerType === "mouse" &&
            event.button !== 0
        ) {
            return;
        }

        pointerId = event.pointerId;

        startX = event.clientX;
        startY = event.clientY;

        dragging = false;

        clearTimeout(timer);

        timer = setTimeout(() => {

            dragging = true;
            draggedShortcut = element;

            element.classList.add(
                "shortcut-dragging"
            );

            try {
                element.setPointerCapture(pointerId);
            }
            catch (_) {}

        }, isOrderEditMode() ? 0 : 1000);

    });

    element.addEventListener("pointermove", event => {

        if (event.pointerId !== pointerId) {
            return;
        }

        if (!dragging) {
            if (isOrderEditMode()) {
                dragging = true;
                draggedShortcut = element;
                element.classList.add("shortcut-dragging");
                try { element.setPointerCapture(pointerId); } catch (_) {}
            } else {
                return;
            }
        }

        event.preventDefault();

        const target =
            document
                .elementFromPoint(
                    event.clientX,
                    event.clientY
                )
                ?.closest(".shortcut");

        if (
            !target ||
            target === element ||
            !shortcuts.contains(target)
        ) {
            return;
        }

        const rect =
            target.getBoundingClientRect();

        const after =
            event.clientY >
            rect.top + rect.height / 2;

        if (after) {

            shortcuts.insertBefore(
                element,
                target.nextSibling
            );

        } else {

            shortcuts.insertBefore(
                element,
                target
            );

        }

    });

    const finish = event => {

        if (event.pointerId !== pointerId) {
            return;
        }

        clearTimeout(timer);

        if (dragging) {

            event.preventDefault();

            element.classList.remove(
                "shortcut-dragging"
            );

            dragging = false;
            draggedShortcut = null;

            try {
                element.releasePointerCapture(
                    pointerId
                );
            }
            catch (_) {}

            saveShortcutOrder();

            element.dataset.justDragged = "1";

            setTimeout(() => {
                delete element.dataset.justDragged;
            }, 250);

        }

        pointerId = null;

    };

    element.addEventListener(
        "pointerup",
        finish
    );

    element.addEventListener(
        "pointercancel",
        finish
    );

    element.addEventListener(
        "click",
        event => {

            if (
                element.dataset.justDragged === "1"
            ) {
                event.preventDefault();
                event.stopPropagation();
            }

        },
        true
    );

}


function saveShortcutOrder() {

    const order =
        Array.from(
            shortcuts.querySelectorAll(".shortcut-row .shortcut")
        ).map(
            card => card.dataset.categoryId
        );

    localStorage.setItem(
        "nursing-category-order",
        JSON.stringify(order)
    );

}


/* =========================================================
   CARICA ARCHIVIO
========================================================= */

async function loadState() {

        const linksMode =
        new URLSearchParams(window.location.search).get("links");

    if (appNotesRoute === "1") {
        document.body.classList.remove("home-page");
        shortcuts.style.display = "none";

        if (backButton) {
            backButton.style.display = "flex";
        }

        stateTitle.textContent = "📝 Note";
        description.textContent = "Appunti e idee non legati alle singole sezioni.";
        renderAppNotesPage();
        return;
    }

    if (linksMode === "1") {
        document.body.classList.remove("home-page");
        shortcuts.style.display = "none";

        if (backButton) {
            backButton.style.display = "flex";
        }

        const termFilter =
            new URLSearchParams(window.location.search).get("term") || "";

        stateTitle.textContent = "🔗 Collegamenti";
        description.textContent = "Collegamenti tra tutte le note personali.";
        renderAllNoteLinksPage(termFilter);
        return;
    }

    if (contactRoute === "1") {
        document.body.classList.remove("home-page");
        shortcuts.style.display = "none";

        if (backButton) {
            backButton.style.display = "flex";
        }

        stateTitle.textContent = "📩 Contattami";
        description.textContent = "Per domande, segnalazioni o suggerimenti.";
        renderContactPage();
        return;
    }


    /*
     * HOME
     */

    if (!state) {

        document.body.classList.add("home-page");

        shortcuts.style.display = "flex";

        if (backButton) {
            backButton.style.display = "none";
        }

        stateTitle.textContent =
            "Benvenuto";

        description.textContent =
            "Seleziona un archivio per iniziare.";

        content.innerHTML = "";

        return;
    }


    document.body.classList.remove("home-page");

    /*
     * PAGINA CATEGORIA
     */

    shortcuts.style.display = "none";

    if (backButton) {
        backButton.style.display = "flex";
    }


    try {

        /*
         * Costruiamo esplicitamente il percorso
         * del file JSON.
         */

        const filePath =
            `./data/${state}.json`;


        console.log(
            "Caricamento archivio:",
            filePath
        );


        const response =
            await fetch(filePath);


        /*
         * Controlla se il file esiste davvero.
         */

        if (!response.ok) {

            throw new Error(
                `File non trovato: ${filePath} — HTTP ${response.status}`
            );

        }


        /*
         * Prova a leggere il JSON.
         */

        let data;

        try {

            data =
                await response.json();

        }

        catch (jsonError) {

            throw new Error(
                `Il file "${filePath}" esiste, ma il JSON non è valido.`
            );

        }


        /*
         * Applica eventuali modifiche
         * salvate dall'editor locale.
         */

        data =
            applyLocalOverride(
                state,
                data
            );


        /*
         * Mostra titolo e descrizione.
         */

        stateTitle.textContent =
            `${data.icon || ""} ${data.title || state}`;

        description.textContent =
            data.description || "";


        /*
         * ELEMENTO SPECIFICO
         */

        if (item) {

            loadItem(data);

            return;
        }


        /*
         * PAGINA PRINCIPALE
         */

        renderSections(data);

    }


    catch (error) {

        console.error(
            "ERRORE CARICAMENTO ARCHIVIO:",
            error
        );


        stateTitle.textContent =
            "❌ Errore caricamento";


        description.textContent =
            "";


        content.innerHTML = `

            <section>

                <h2>
                    Archivio non disponibile
                </h2>

                <p>
                    Non è stato possibile caricare
                    l'archivio
                    <strong>${state}</strong>.
                </p>

                <p style="
                    color:#ff7777;
                    font-family:monospace;
                    font-size:13px;
                    word-break:break-word;
                ">
                    ${error.message}
                </p>

                <p style="
                    color:#888;
                    font-size:13px;
                ">
                    Controlla la console del browser
                    (F12 → Console) per maggiori dettagli.
                </p>

            </section>

        `;

    }

}
/* =========================================================
   RENDER SEZIONI
========================================================= */

// =========================================================================
// SISTEMA AUTO-INSTALLANTE PER AUTOCOMPLETAMENTO FARMACI (SENZA DOPPIONI)
// =========================================================================

(function() {
    let listaFarmaciDati = [];

    // Lista di emergenza se il CSV locale non è leggibile dal browser (es. protocollo file:///)
    const farmaciDiBackup = [
        "Acetaminofene", "Acido Acetilsalicilico", "Amoxicillina", "Aspirina", "Atenololo", 
        "Augmentin", "Azitromicina", "Clonazepam", "Codeina", "Diazepam", "Eparina", 
        "Ibuprofene", "Insulina", "Ketoprofene", "Levofloxacina", "Metformina", 
        "Omeprazolo", "Paracetamolo", "Prednisone", "Rifampicina", "Tachipirina", "Warfarin"
    ];

    // 1. Carica i dati dal CSV della repository
    async function caricaDatabase() {
        try {
            const response = await fetch("./src/data/farmaci.csv");
            if (!response.ok) throw new Error();
            const testo = await response.text();
            const righe = testo.split(/\r?\n/);
            
            const nomiGrezzi = righe.map(riga => {
                const colonne = riga.split(/[,;]/);
                return colonne[0]?.trim(); // Prende il nome dalla prima colonna
            }).filter(nome => nome && nome.length > 0);

            // RIMOZIONE DOPPIONI: Utilizza Set per tenere solo i nomi unici
            listaFarmaciDati = [...new Set(nomiGrezzi)];

            if (listaFarmaciDati.length > 0 && ["nome", "farmaco"].includes(listaFarmaciDati[0].toLowerCase())) {
                listaFarmaciDati.shift();
            }
        } catch (e) {
            // Rimuove i doppioni anche dalla lista di backup per sicurezza
            listaFarmaciDati = [...new Set(farmaciDiBackup)];
        }
    }
    caricaDatabase();

    // 2. Osserva la pagina: appena appare un input di ricerca, gli aggancia il datalist
    const observer = new MutationObserver(mutations => {
        // Controlla solo gli input realmente aggiunti al DOM.
        // Evita di riscannerizzare tutta la pagina ad ogni modifica,
        // riducendo lavoro sul main thread e reflow inutili.
        const inputs = [];

        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType !== Node.ELEMENT_NODE) return;

                if (
                    node.matches?.("input[type='text'], input:not([type])")
                ) {
                    inputs.push(node);
                }

                node.querySelectorAll?.(
                    "input[type='text'], input:not([type])"
                ).forEach(input => inputs.push(input));
            });
        });

        if (!inputs.length) return;

        const excludedIds = new Set([
            "patientName",
            "patientBirthDate",
            "patientAge",
            "patientRoom",
            "patientBed",
            "patientPa",
            "patientFc",
            "patientSat",
            "patientTemperature",
            "patientGlucose",
            "personalNoteTitle",
            "appNoteTitle"
        ]);

        inputs.forEach(input => {
            if (excludedIds.has(input.id)) return;
            if (input.hasAttribute("list") || input.getAttribute("role") === "combobox") return;

            const dataListId =
                "dl-" + Math.random().toString(36).substr(2, 9);

            const dataList = document.createElement("datalist");
            dataList.id = dataListId;

            document.body.appendChild(dataList);
            input.setAttribute("list", dataListId);
            input.setAttribute("autocomplete", "off");

            input.addEventListener("input", () => {
                const valore = input.value.toLowerCase();
                dataList.innerHTML = "";

                if (valore.length > 0) {
                    const filtrati = listaFarmaciDati
                        .filter(f =>
                            f.toLowerCase().startsWith(valore)
                        )
                        .slice(0, 15);

                    filtrati.forEach(farmaco => {
                        const option = document.createElement("option");
                        option.value = farmaco;
                        dataList.appendChild(option);
                    });
                }
            });
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();





function renderSections(data) {

    if (!data.sections) {
        content.innerHTML = "";
        return;
    }

    const orderedSections =
        applySavedSectionOrder(
            data.id || state,
            data.sections
        );

    let html = "";

    orderedSections.forEach((section, sectionIndex) => {

        const sectionKey =
            getStableSectionKey(section, sectionIndex);

        const orderedItems =
            applySavedItemOrder(
                data.id || state,
                sectionKey,
                section.items || []
            );

        html += `
            <section
                class="sortable-section"
                data-section-key="${escapeAttribute(sectionKey)}"
            >
                <h2>
                    <span>${section.title}</span>
                    ${isOrderEditMode() ? `
                        <span class="order-controls section-order-controls">
                            <button type="button" class="order-button" data-order="up" aria-label="Sposta sezione su">↑</button>
                            <button type="button" class="order-button" data-order="down" aria-label="Sposta sezione giù">↓</button>
                        </span>
                    ` : ""}
                </h2>

                <div class="item-list">
        `;

        orderedItems.forEach(sectionItem => {

            const itemId =
                typeof sectionItem === "string"
                    ? createId(sectionItem)
                    : sectionItem.id || createId(sectionItem.title);

            const itemTitle =
                typeof sectionItem === "string"
                    ? sectionItem
                    : sectionItem.title;

            html += `
                    <div
                        class="sortable-item-row"
                        data-item-id="${escapeAttribute(itemId)}"
                        data-section-key="${escapeAttribute(sectionKey)}"
                    >
                        <a
                            class="content-button sortable-item"
                            href="?state=${encodeURIComponent(state)}&item=${encodeURIComponent(itemId)}"
                        >
                            <span>${itemTitle}</span>
                            
                        </a>

                        ${isOrderEditMode() ? `
                            <span class="order-controls item-order-controls">
                                <button type="button" class="order-button" data-order="up" aria-label="Sposta elemento su">↑</button>
                                <button type="button" class="order-button" data-order="down" aria-label="Sposta elemento giù">↓</button>
                            </span>
                        ` : ""}
                    </div>
            `;
        });

        html += `
                </div>
            </section>
        `;
    });

    content.innerHTML = html;
    setupContentOrderControls();
}


/* =========================================================
   ORDINE CONTENUTI — LOCAL STORAGE
========================================================= */

function getStableSectionKey(section, index) {

    return (
        section.id ||
        createId(section.title || `section-${index}`)
    );

}


function getItemKey(item, index) {

    if (typeof item === "string") {
        return createId(item);
    }

    return (
        item.id ||
        createId(item.title || `item-${index}`)
    );

}


function applySavedSectionOrder(stateId, sections) {

    const key =
        `nursing-sections-${stateId}`;

    try {

        const saved =
            JSON.parse(
                localStorage.getItem(key) || "null"
            );

        if (!Array.isArray(saved)) {
            return [...sections];
        }

        const map =
            new Map(
                sections.map(
                    (section, index) => [
                        getStableSectionKey(section, index),
                        section
                    ]
                )
            );

        return [
            ...saved
                .map(id => map.get(id))
                .filter(Boolean),
            ...sections.filter(
                (section, index) =>
                    !saved.includes(
                        getStableSectionKey(section, index)
                    )
            )
        ];

    }

    catch (error) {

        console.error(
            "Errore ordine sottogruppi:",
            error
        );

        return [...sections];

    }

}


function applySavedItemOrder(stateId, sectionKey, items) {

    const key =
        `nursing-items-${stateId}-${sectionKey}`;

    try {

        const saved =
            JSON.parse(
                localStorage.getItem(key) || "null"
            );

        if (!Array.isArray(saved)) {
            return [...items];
        }

        const map =
            new Map(
                items.map(
                    (item, index) => [
                        getItemKey(item, index),
                        item
                    ]
                )
            );

        return [
            ...saved
                .map(id => map.get(id))
                .filter(Boolean),
            ...items.filter(
                (item, index) =>
                    !saved.includes(
                        getItemKey(item, index)
                    )
            )
        ];

    }

    catch (error) {

        console.error(
            "Errore ordine elementi:",
            error
        );

        return [...items];

    }

}


/* =========================================================
   MODIFICA ORDINE — PULSANTI SU / GIÙ
========================================================= */

function createOrderControls(index, total, label) {

    const controls = document.createElement("div");
    controls.className = "order-controls";

    const up = document.createElement("button");
    up.type = "button";
    up.className = "order-button";
    up.dataset.order = "up";
    up.setAttribute("aria-label", `Sposta ${label} su`);
    up.textContent = "↑";
    up.disabled = index === 0;

    const down = document.createElement("button");
    down.type = "button";
    down.className = "order-button";
    down.dataset.order = "down";
    down.setAttribute("aria-label", `Sposta ${label} giù`);
    down.textContent = "↓";
    down.disabled = index === total - 1;

    controls.append(up, down);
    return controls;
}


function moveElement(element, direction, selector, saveCallback) {

    const current = element.closest(selector);
    if (!current) return;

    const sibling =
        direction === "up"
            ? current.previousElementSibling
            : current.nextElementSibling;

    if (!sibling) return;

    if (direction === "up") {
        current.parentNode.insertBefore(current, sibling);
    } else {
        current.parentNode.insertBefore(sibling, current);
    }

    saveCallback();
    refreshOrderControls();
}


function setupHomeOrderControls() {

    shortcuts
        .querySelectorAll(".order-button")
        .forEach(button => {

            button.addEventListener("click", event => {

                event.preventDefault();
                event.stopPropagation();

                const row = button.closest(".shortcut-row");
                if (!row) return;

                moveElement(
                    row,
                    button.dataset.order,
                    ".shortcut-row",
                    saveShortcutOrder
                );
            });
        });
}


function setupContentOrderControls() {

    content
        .querySelectorAll(".section-order-controls .order-button")
        .forEach(button => {

            button.addEventListener("click", event => {

                event.preventDefault();
                event.stopPropagation();

                const section = button.closest(".sortable-section");
                if (!section) return;

                moveElement(
                    section,
                    button.dataset.order,
                    ".sortable-section",
                    saveSectionOrder
                );
            });
        });

    content
        .querySelectorAll(".item-order-controls .order-button")
        .forEach(button => {

            button.addEventListener("click", event => {

                event.preventDefault();
                event.stopPropagation();

                const row = button.closest(".sortable-item-row");
                if (!row) return;

                moveElement(
                    row,
                    button.dataset.order,
                    ".sortable-item-row",
                    () => {
                        saveItemOrder(
                            row.dataset.sectionKey,
                            row.parentElement
                        );
                    }
                );
            });
        });
}

// ==========================================
// FUNZIONE DI INTERAZIONE FARMACI (DA ZERO)
// ==========================================

// Array principale che conterrà l'elenco dei farmaci
let listaFarmaciDati = [];

// Lista di backup immediata nel caso in cui il file CSV non sia accessibile localmente
const farmaciDiBackup = [
    "Acetaminofene", "Acido Acetilsalicilico", "Amoxicillina", "Aspirina", "Atenololo", 
    "Augmentin", "Azitromicina", "Clonazepam", "Codeina", "Diazepam", "Eparina", 
    "Ibuprofene", "Insulina", "Ketoprofene", "Levofloxacina", "Metformina", 
    "O someprazolo", "Paracetamolo", "Prednisone", "Rifampicina", "Tachipirina", "Warfarin"
];

/**
 * Tenta di caricare il file CSV dalla repository.
 * Se fallisce (es. aperto come file locale), carica la lista di backup.
 */
async function caricaDatabaseFarmaci() {
    try {
        const response = await fetch("./src/data/farmaci.csv");
        if (!response.ok) throw new Error("CSV non raggiungibile");
        
        const testoCSV = await response.text();
        const righe = testoCSV.split(/\r?\n/);
        
        // Estrae la prima colonna pulendola dagli spazi
        listaFarmaciDati = righe.map(riga => {
            const colonne = riga.split(/[,;]/);
            return colonne[0]?.trim();
        }).filter(nome => nome && nome.length > 0);

        // Scarta l'intestazione se presente
        if (listaFarmaciDati.length > 0 && 
           (listaFarmaciDati[0].toLowerCase() === "nome" || listaFarmaciDati[0].toLowerCase() === "farmaco")) {
            listaFarmaciDati.shift();
        }
        
        console.log("Database farmaci caricato correttamente dal file CSV.");
    } catch (e) {
        // Se si verifica un errore o sei offline/locale, usa la lista pronta
        listaFarmaciDati = farmaciDiBackup;
        console.warn("Impossibile leggere il CSV (probabilmente sei in locale senza server). Caricata lista di backup.");
    }
}

// Avvia immediatamente l'indicizzazione dei dati
caricaDatabaseFarmaci();

/**
 * Restituisce i farmaci filtrati escludendo rigorosamente tutto ciò che non inizia con le stesse lettere.
 * Puoi richiamare questa funzione passando il testo inserito dall'utente.
 * 
 * @param {string} testoInserito - Il testo digitato dall'utente
 * @returns {Array} Array di stringhe con i soli farmaci suggeriti
 */
function updateDrugSearch(testoInserito) {
    if (!testoInserito || testoInserito.trim() === "") {
        return [];
    }

    const inputMinuscolo = testoInserito.toLowerCase();

    // FILTRO RIGIDO: Mantiene SOLO i farmaci che INIZIANO con i caratteri digitati
    return listaFarmaciDati.filter(farmaco => 
        farmaco.toLowerCase().startsWith(inputMinuscolo)
    );
}

function refreshOrderControls() {

    shortcuts
        .querySelectorAll(".shortcut-row")
        .forEach((row, index, rows) => {

            row.querySelector('[data-order="up"]').disabled =
                index === 0;

            row.querySelector('[data-order="down"]').disabled =
                index === rows.length - 1;
        });

    content
        .querySelectorAll(".sortable-section")
        .forEach((section, index, sections) => {

            section.querySelector('[data-order="up"]').disabled =
                index === 0;

            section.querySelector('[data-order="down"]').disabled =
                index === sections.length - 1;
        });

    content
        .querySelectorAll(".item-list")
        .forEach(list => {

            const rows =
                Array.from(
                    list.querySelectorAll(".sortable-item-row")
                );

            rows.forEach((row, index) => {

                row.querySelector('[data-order="up"]').disabled =
                    index === 0;

                row.querySelector('[data-order="down"]').disabled =
                    index === rows.length - 1;
            });
        });
}

function saveSectionOrder() {

    const order =
        Array.from(
            content.querySelectorAll(
                ".sortable-section"
            )
        ).map(
            section =>
                section.dataset.sectionKey
        );

    localStorage.setItem(
        `nursing-sections-${state}`,
        JSON.stringify(order)
    );

}


function saveItemOrder(sectionKey, list) {

    const order =
        Array.from(
            list.querySelectorAll(".sortable-item-row")
        ).map(
            row => row.dataset.itemId
        );

    localStorage.setItem(
        `nursing-items-${state}-${sectionKey}`,
        JSON.stringify(order)
    );
}

if (incomingPersonalization) {
    window.__incomingPersonalization =
        incomingPersonalization;
}

if (patientsRoute === "1") {
    document.body.classList.remove("home-page");
}


/* =========================================================
   FUNZIONI RIPRISTINATE
========================================================= */

function isOrderEditMode() {
    return orderEditMode;
}

function setupSettings() {

    const panel = document.getElementById("settingsPanel");
    const openButton = document.getElementById("settingsButton");
    const closeButton = document.getElementById("settingsClose");
    const orderButton = document.getElementById("orderModeButton");
    const resetButton = document.getElementById("resetOrderButton");
    const themeButton = document.getElementById("settingsThemeButton");
    const appNotesButton = document.getElementById("appNotesButton");
    const contactButton = document.getElementById("contactButton");
    const shareButton = document.getElementById("sharePersonalizationButton");
    const patientsButton = document.getElementById("patientsButton");
    const resetAllButton = document.getElementById("resetPersonalizationButton");
    const message = document.getElementById("settingsMessage");

    if (!panel || !openButton) return;

    const setMessage = text => {
        if (message) message.textContent = text;
    };

    const updateOrderControls = () => {
        if (resetButton) {
            resetButton.hidden = !orderEditMode;
        }
    };

    updateOrderControls();

    openButton.addEventListener("click", () => {
        updateOrderControls();
        panel.hidden = false;
    });

    closeButton?.addEventListener("click", () => {
        panel.hidden = true;
    });

    panel.addEventListener("click", event => {
        if (event.target === panel) panel.hidden = true;
    });

    // Pulsante discreto "salva ordine": visibile solo mentre l'ordine è in modifica.
    if (orderButton && !document.getElementById("orderDoneButton")) {
        const done = document.createElement("button");
        done.id = "orderDoneButton";
        done.type = "button";
        done.title = "Salva modifiche ordine";
        done.setAttribute("aria-label", "Salva modifiche ordine");
        done.textContent = "✓";
        done.addEventListener("click", () => orderButton.click());
        document.body.appendChild(done);
    }

    orderButton?.addEventListener("click", () => {
        orderEditMode = !orderEditMode;
        document.body.classList.toggle("order-editing", orderEditMode);

        orderButton.textContent =
            orderEditMode
                ? "✅ Fine modifica ordine"
                : "↕️ Modifica ordine";

        updateOrderControls();

        setMessage(
            orderEditMode
                ? "Modalità modifica attiva: usa i pulsanti ↑ e ↓."
                : "Ordine salvato."
        );

        panel.hidden = true;

        if (new URLSearchParams(window.location.search).get("appnotes")) {
            renderAppNotesPage();
        } else if (state) {
            loadState();
        } else {
            loadCategories();
        }
    });

    resetButton?.addEventListener("click", () => {
        resetOrderPreferences();

        setMessage("↩️ Ordini ripristinati.");

        if (panel) panel.hidden = false;

        if (patientsRoute === "1") {
            renderPatientsPage(patientRouteId, false);
        } else if (state) {
            loadState();
        } else {
            loadCategories();
        }
    });

    appNotesButton?.addEventListener("click", () => {
        panel.hidden = true;
        window.location.href = "?appnotes=1";
    });

    contactButton?.addEventListener("click", () => {
        panel.hidden = true;
        window.location.href = "?contact=1";
    });

    function updateThemeButtonIcon() {
        const theme =
            document.documentElement.dataset.theme || "dark";

        if (themeButton) {
            themeButton.textContent =
                theme === "light"
                    ? "☀️ Tema"
                    : "🌙 Tema";
        }
    }

    updateThemeButtonIcon();

    themeButton?.addEventListener("click", () => {
        const current =
            document.documentElement.dataset.theme || "dark";

        applyTheme(current === "dark" ? "light" : "dark");
        updateThemeButtonIcon();
        setMessage("Tema aggiornato.");
    });

    shareButton?.addEventListener("click", () => {
        panel.hidden = true;
        showShareCenter();
    });

    patientsButton?.addEventListener("click", () => {
        panel.hidden = true;
        window.location.href = "?patients=1";
    });

    resetAllButton?.addEventListener("click", () => {
        const confirmed = window.confirm(
            "Ripristinare tutte le personalizzazioni locali? Note, ordini e tema verranno cancellati. I contenuti dell'archivio non verranno modificati."
        );

        if (!confirmed) return;

        resetAllPersonalization();

        setMessage("↩️ Personalizzazione ripristinata.");

        panel.hidden = false;

        if (state) {
            loadState();
        } else {
            loadCategories();
        }
    });
}

document.addEventListener("click", event => {
    if (event.target.closest("[data-note-new-toggle]")) {
        const editor = document.querySelector(".app-note-editor, .personal-note-editor");
        showNoteEditor(editor);
        editor?.scrollIntoView({ behavior: "smooth", block: "start" });
        editor?.querySelector("input[type=text]")?.focus();
        return;
    }

    if (event.target.closest("[data-note-new-cancel]")) hideNoteEditor();
});

/* Registra una nota vocale e inserisce [[audio:ID]] dove si trova il cursore. */
document.addEventListener("click", async event => {
    const button = event.target.closest("[data-note-audio-target]");
    if (!button || !window.AudioNotes) return;

    const input = document.getElementById(button.dataset.noteAudioTarget);
    if (!input) return;

    const saved = await window.AudioNotes.recordAndSave("note");
    if (!saved) return;

    const token = "[[audio:" + saved.id + "]]";
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const before = input.value.slice(0, start);
    const needsBreakBefore = before && !before.endsWith("\n");
    input.setRangeText((needsBreakBefore ? "\n" : "") + token + "\n", start, end, "end");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
});

/* Sceglie un'immagine e inserisce [[img:ID]] dove si trova il cursore. */
document.addEventListener("click", async event => {
    const button = event.target.closest("[data-note-image-target]");
    if (!button || !window.AudioNotes) return;

    const input = document.getElementById(button.dataset.noteImageTarget);
    if (!input) return;

    const saved = await window.AudioNotes.pickAndSaveImage("note");
    if (!saved) return;

    const token = "[[img:" + saved.id + "]]";
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const before = input.value.slice(0, start);
    input.setRangeText((before && !before.endsWith("\n") ? "\n" : "") + token + "\n", start, end, "end");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
});

document.addEventListener("click", event => {
    const button = event.target.closest("[data-note-category-picker]");
    if (button) openCategoryPicker(document.getElementById(button.dataset.noteCategoryPicker));
});

loadNoteCategoryIndex();

document.addEventListener("click", event => {
    const button = event.target.closest("[data-note-format]");
    if (!button) return;

    const textarea = document.getElementById(button.dataset.noteFormatTarget);
    if (!textarea) return;

    const mark = button.dataset.noteFormat;
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? start;
    const selected = textarea.value.slice(start, end);

    textarea.value = textarea.value.slice(0, start) + mark + selected + mark + textarea.value.slice(end);

    // Senza selezione il cursore resta tra i due segni, pronto a scrivere.
    // Con una selezione il testo resta selezionato, così si possono sommare più stili.
    textarea.focus();
    textarea.setSelectionRange(start + mark.length, start + mark.length + selected.length);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
});




/* Tavolozza: evidenziatore e colore del testo, inseriti attorno alla selezione. */
document.addEventListener("click", event => {
    const toggle = event.target.closest("[data-note-color-target]");
    const existing = document.getElementById("noteColorPalette");

    const swatch = event.target.closest("[data-note-color-mark]");
    if (swatch && existing) {
        const textarea = document.getElementById(existing.dataset.target);
        if (textarea) {
            const mark = swatch.dataset.noteColorMark;       // "=" oppure "~"
            const letter = swatch.dataset.noteColorLetter;
            const isDefault = (mark === "=" && letter === "g") || (mark === "~" && letter === "r");
            const defaultLetter = mark === "=" ? "g" : "r";
            const open = mark + (isDefault ? "" : letter + ":");
            const start = textarea.selectionStart ?? textarea.value.length;
            const end = textarea.selectionEnd ?? start;
            const value = textarea.value;

            // Se la selezione sta già dentro un colore dello stesso tipo, lo si cambia (o si toglie
            // toccando lo stesso colore) invece di annidarne un altro.
            const lineStart = value.lastIndexOf("\n", start - 1) + 1;
            let lineEnd = value.indexOf("\n", end);
            if (lineEnd < 0) lineEnd = value.length;
            const escMark = mark.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const spanRe = new RegExp(escMark + "(?:([gvra]):)?([^\\n" + escMark + "]+?)" + escMark, "g");
            const line = value.slice(lineStart, lineEnd);
            let span = null;
            let m;
            while ((m = spanRe.exec(line)) !== null) {
                const spanStart = lineStart + m.index;
                const spanEnd = spanStart + m[0].length;
                if (start >= spanStart && end <= spanEnd) {
                    span = { from: spanStart, to: spanEnd, letter: m[1] || defaultLetter, inner: m[2] };
                    break;
                }
            }

            let replacement, innerStart, innerLength;
            if (span) {
                const same = span.letter === letter;
                replacement = same ? span.inner : open + span.inner + mark;
                innerStart = span.from + (same ? 0 : open.length);
                innerLength = span.inner.length;
                textarea.value = value.slice(0, span.from) + replacement + value.slice(span.to);
            } else {
                const selected = value.slice(start, end);
                textarea.value = value.slice(0, start) + open + selected + mark + value.slice(end);
                innerStart = start + open.length;
                innerLength = selected.length;
            }
            textarea.focus();
            textarea.setSelectionRange(innerStart, innerStart + innerLength);
            textarea.dispatchEvent(new Event("input", { bubbles: true }));
        }
        return;     // la tavolozza resta aperta: evidenziatore e colore del testo si possono sommare
    }

    if (existing && !event.target.closest("#noteColorPalette")) existing.remove();
    if (!toggle || existing) return;

    const names = { g: "giallo", v: "verde", r: "rosso", a: "azzurro" };
    const row = (mark, label, cls, content) =>
        '<div class="note-color-row"><span>' + label + '</span>' +
        NOTE_COLOR_LETTERS.map(letter =>
            '<button type="button" class="' + cls + " " + cls + "-" + letter + '" data-note-color-mark="' + mark +
            '" data-note-color-letter="' + letter + '" title="' + names[letter] + '" aria-label="' + names[letter] + '">' + content + '</button>'
        ).join("") + '</div>';

    const palette = document.createElement("div");
    palette.id = "noteColorPalette";
    palette.className = "note-color-palette";
    palette.dataset.target = toggle.dataset.noteColorTarget;
    palette.innerHTML = row("=", "Evidenzia", "note-swatch note-swatch-hl", "") + row("~", "Colora testo", "note-swatch note-swatch-tc", "A");
    toggle.closest(".note-format-bar").appendChild(palette);
    event.stopPropagation();
});
NOTE_COLOR_LETTERS.forEach((letter, i) => {
    NOTE_FORMAT_TOKENS["h" + letter] = [
        String.fromCharCode(0xE020 + i * 2), String.fromCharCode(0xE021 + i * 2),
        '<mark class="note-hl note-hl-' + letter + '">', "</mark>"
    ];
    NOTE_FORMAT_TOKENS["t" + letter] = [
        String.fromCharCode(0xE030 + i * 2), String.fromCharCode(0xE031 + i * 2),
        '<span class="note-tc note-tc-' + letter + '">', "</span>"
    ];
});

// =========================================================================
// SISTEMA AUTO-INSTALLANTE CON TRADUZIONE EN -> IT E RIMOZIONE DOPPIONI
// =========================================================================

(function() {
    let listaFarmaciDati = [];

    // 1. DIZIONARIO DI TRADUZIONE (Estendibile)
    // Struttura: "nome_inglese_nel_csv": "Nome Italiano Da Cercare"
    const dizionarioTraduzione = {
        "acetaminophen": "Paracetamolo",
        "aspirin": "Aspirina",
        "ibuprofen": "Ibuprofene",
        "amoxicillin": "Amoxicillina",
        "warfarin": "Warfarin",
        "heparin": "Eparina",
        "diazepam": "Diazepam",
        "omeprazole": "Omeprazolo",
        "metformin": "Metformina",
        "prednisone": "Prednisone",
        "atorvastatin": "Atorvastatina",
        "furosemide": "Furosemide"
    };

    // Creiamo un dizionario inverso (Italiano -> Inglese) per convertire l'input dell'utente
    const dizionarioInverso = {};
    for (const [en, it] of Object.entries(dizionarioTraduzione)) {
        dizionarioInverso[it.toLowerCase()] = en.toLowerCase();
    }

    // Lista di emergenza se il CSV locale non è leggibile
    const farmaciDiBackup = Object.values(dizionarioTraduzione);

    // 2. Carica i dati dal CSV della repository
    async function caricaDatabase() {
        try {
            const response = await fetch("./src/data/farmaci.csv");
            if (!response.ok) throw new Error();
            const testo = await response.text();
            const righe = testo.split(/\r?\n/);
            
            const nomiGrezzi = righe.map(riga => {
                const colonne = riga.split(/[,;]/);
                const nomeInglese = colonne?.trim(); // Nome originale in Inglese dal CSV
                
                // TRADUZIONE: Se esiste la traduzione in Italiano restituisce quella, altrimenti lascia l'Inglese
                if (nomeInglese && dizionarioTraduzione[nomeInglese.toLowerCase()]) {
                    return dizionarioTraduzione[nomeInglese.toLowerCase()];
                }
                return nomeInglese;
            }).filter(nome => nome && nome.length > 0);

            // RIMOZIONE DOPPIONI
            listaFarmaciDati = [...new Set(nomiGrezzi)];

            if (listaFarmaciDati.length > 0 && ["nome", "farmaco"].includes(listaFarmaciDati.toLowerCase())) {
                listaFarmaciDati.shift();
            }
        } catch (e) {
            listaFarmaciDati = [...new Set(farmaciDiBackup)];
        }
    }
    caricaDatabase();

    // 3. Osserva la pagina: appena appare un input di ricerca, gli aggancia il datalist
    const observer = new MutationObserver(() => {
        const inputs = document.querySelectorAll("input[type='text'], input:not([type])");
        
        inputs.forEach(input => {
            // Questi campi appartengono ai moduli paziente/note e non devono
            // essere trasformati in campi di ricerca automatica.
            if (
                input.id === "patientName" ||
                input.id === "patientBirthDate" ||
                input.id === "patientAge" ||
                input.id === "patientRoom" ||
                input.id === "patientBed" ||
                input.id === "personalNoteTitle" ||
                input.id === "appNoteTitle"
            ) {
                return;
            }

            if (input.hasAttribute("list") || input.getAttribute("role") === "combobox") return;

            const dataListId = "dl-" + Math.random().toString(36).substr(2, 9);
            const dataList = document.createElement("datalist");
            dataList.id = dataListId;
            document.body.appendChild(dataList);
            input.setAttribute("list", dataListId);

            // Ascolta la digitazione dell'utente (Filtro per iniziali in Italiano)
            input.addEventListener("input", () => {
                const valore = input.value.toLowerCase();
                dataList.innerHTML = ""; // Svuota i vecchi suggerimenti

                if (valore.length > 0) {
                    // FILTRO RIGIDO: Mantiene solo i nomi tradotti in Italiano che iniziano con quelle lettere
                    const filtrati = listaFarmaciDati.filter(f => 
                        f.toLowerCase().startsWith(valore)
                    ).slice(0, 15);

                    // Popola il menu a tendina nativo senza duplicati e in Italiano
                    filtrati.forEach(farmaco => {
                        const option = document.createElement("option");
                        option.value = farmaco;
                        dataList.appendChild(option);
                    });
                }
            });
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
})();

/* =========================================================
   TEMA
========================================================= */

function applyTheme(theme) {

    const normalizedTheme =
        theme === "light" ? "light" : "dark";

    document.documentElement.dataset.theme =
        normalizedTheme;

    localStorage.setItem(
        "nursing-theme",
        normalizedTheme
    );

}

function setupTheme() {

    const savedTheme =
        localStorage.getItem("nursing-theme") || "dark";

    applyTheme(savedTheme);


}

setupTheme();
setupSettings();
setupPersonalNotes();
setupAppNotes();
setupPatients();

if (incomingPersonalization) {

    document.body.classList.remove("home-page");
    shortcuts.style.display = "none";

    if (backButton) {
        backButton.style.display = "flex";
    }

    stateTitle.textContent =
        "📥 Importazione";

    description.textContent =
        "Dati ricevuti da un altro dispositivo.";

    content.innerHTML =
        renderSharedPersonalizationImport(
            incomingPersonalization
        );

    const importButton =
        document.getElementById(
            "importSharedPersonalization"
        );

    importButton?.addEventListener("click", () => {

        const imported =
            importSharedPersonalization(
                incomingPersonalization
            );

        if (imported) {

            window.history.replaceState(
                {},
                "",
                window.location.pathname
            );

            window.location.reload();

        } else {

            window.alert(
                "Collegamento di personalizzazione non valido."
            );

        }
    });

    document.getElementById(
        "cancelSharedPersonalization"
    )?.addEventListener("click", () => {

        window.history.replaceState(
            {},
            "",
            window.location.pathname
        );

        window.location.reload();

    });

} else if (patientPhotosRoute === "1") {

    stateTitle.textContent = "📷 Evoluzione medicazione";
    description.textContent = "Documentazione fotografica del paziente.";
    shortcuts.style.display = "none";
    renderPatientPhotosPage(patientRouteId);

} else if (patientsRoute === "1") {

    stateTitle.textContent = "👤 Pazienti";
    description.textContent =
        "Gestione locale dei pazienti.";
    shortcuts.style.display = "none";

    document.querySelector(".page-title-row")?.insertAdjacentHTML("beforeend", `
        <button id="patientSearchToggle" class="patient-search-toggle" type="button" aria-label="Cerca paziente">🔍</button>
    `);

    stateTitle.insertAdjacentHTML("afterend", `
        <input id="patientSearch" class="patient-search-input" type="search"
            placeholder="Cerca paziente..." autocomplete="off">
        <div id="patientSearchSuggestions" class="patient-search-suggestions" hidden></div>
    `);

    const patientSearch =
        document.getElementById("patientSearch");

    const patientSearchSuggestions =
        document.getElementById("patientSearchSuggestions");

    function normalizePatientSearchText(value = "") {
        return String(value ?? "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLocaleLowerCase("it-IT")
            .trim()
            .replace(/\s+/g, " ");
    }

    function patientNameMatches(name, queryValue) {
        const nameNormalized =
            normalizePatientSearchText(name);

        const queryNormalized =
            normalizePatientSearchText(queryValue);

        if (!queryNormalized) return true;

        // Cerca anche una sequenza di parole non necessariamente adiacenti.
        const queryWords =
            queryNormalized.split(" ").filter(Boolean);

        const nameWords =
            nameNormalized.split(" ").filter(Boolean);

        return queryWords.every(queryWord =>
            nameWords.some(nameWord =>
                nameWord.startsWith(queryWord)
            )
        );
    }

    function updatePatientSearch(queryValue = "") {
        const query =
            normalizePatientSearchText(queryValue);

        const patients =
            getPatients();

        // Filtra esclusivamente le schede paziente.
        document
            .querySelectorAll(".patients-list .patient-card")
            .forEach(card => {
                const name =
                    card.getAttribute("data-patient-name") ||
                    card.querySelector("strong")?.textContent ||
                    "";

                card.style.display =
                    patientNameMatches(name, query)
                        ? ""
                        : "none";
            });

        if (!patientSearchSuggestions) return;

        if (!query) {
            patientSearchSuggestions.hidden = true;
            patientSearchSuggestions.innerHTML = "";
            return;
        }

        const matches =
            patients.filter(patient =>
                patientNameMatches(patient.name, query)
            );

        patientSearchSuggestions.innerHTML =
            matches.map(patient => `
                <button
                    type="button"
                    class="patient-search-suggestion"
                    data-patient-suggestion="${escapeAttribute(patient.id)}"
                >
                    <strong>${escapeHtml(getPatientInitials(patient.name))}</strong>
                    <span>${escapeHtml(patient.name)}</span>
                </button>
            `).join("");

        patientSearchSuggestions.hidden =
            matches.length === 0;
    }

    patientSearch?.addEventListener("input", () => {
        updatePatientSearch(patientSearch.value);
    });

    document
        .getElementById("patientSearchToggle")
        ?.addEventListener("click", () => {
            const input =
                document.getElementById("patientSearch");

            if (!input) return;

            input.classList.toggle("is-open");

            if (input.classList.contains("is-open")) {
                input.focus();
                updatePatientSearch(input.value);
            } else {
                input.value = "";
                updatePatientSearch("");
            }
        });

    patientSearchSuggestions?.addEventListener("click", event => {
        const suggestion =
            event.target.closest("[data-patient-suggestion]");

        if (!suggestion) return;

        const patientId =
            suggestion.dataset.patientSuggestion;

        if (!patientId) return;

        window.location.href =
            "?patients=1&patient=" +
            encodeURIComponent(patientId);
    });

    const patientSearchToggle =
        document.getElementById("patientSearchToggle");

    if (patientRouteId) {
        patientSearchToggle?.remove();
        document.getElementById("patientSearch")?.remove();
        document.getElementById("patientSearchSuggestions")?.remove();
    }

    renderPatientsPage(patientRouteId, false);

    // Applica subito l'eventuale ricerca già presente nel campo.
    if (patientSearch && !patientRouteId) {
        updatePatientSearch(patientSearch.value);
    }

} else if (editor === "1") {

    loadEditor();

} else {

    loadCategories();
    loadState();

}

/* =========================================================
   AVVISO NOVITÀ: mostrato una sola volta per questa versione
========================================================= */
function showWhatsNewNotice() {
    const noticeKey = "nursing-whats-new-v132-seen";
    if (localStorage.getItem(noticeKey) === "1") return;

    const modal = document.createElement("div");
    modal.className = "whats-new-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "whatsNewTitle");
    modal.innerHTML = `
        <div class="whats-new-card">
            <h2 id="whatsNewTitle">Cosa c'è di nuovo?</h2>
            <ul>
                <li>Le interazioni farmaci sono state implementate.</li>
                <li>Ora è possibile creare collegamenti sia tra note sia verso le aree dell'app.</li>
                <li>È possibile inserire foto nei pazienti, confrontarle e utilizzare un righello virtuale per valutare la possibile evoluzione della guarigione.</li>
                <li>Si può scrivere in <strong>grassetto</strong>, <em>corsivo</em> o <u>sottolineare</u>.</li>
                <li>Si possono creare elenchi, liste e tabelle.</li>
                <li>È possibile contattarmi via e-mail.</li>
                <li>Nelle note si possono registrare audio e inserire immagini.</li>
                <li>Il testo si può evidenziare o colorare.</li>
            </ul>
            <p class="whats-new-footer">Sto pensando anche ad altre funzioni utili per effettuare valutazioni rapide in diversi contesti.</p>
            <button type="button" class="whats-new-close">Ho capito</button>
        </div>
    `;

    const closeNotice = () => {
        localStorage.setItem(noticeKey, "1");
        modal.remove();
    };
    modal.querySelector(".whats-new-close").addEventListener("click", closeNotice);
    modal.addEventListener("click", event => {
        if (event.target === modal) closeNotice();
    });
    document.addEventListener("keydown", function closeOnEscape(event) {
        if (event.key === "Escape" && document.body.contains(modal)) {
            closeNotice();
            document.removeEventListener("keydown", closeOnEscape);
        }
    });
    document.body.appendChild(modal);
    modal.querySelector(".whats-new-close").focus();
}

showWhatsNewNotice();

window.addEventListener("popstate", () => {
    const viewer = document.getElementById("patientPhotoViewer");
    if (viewer) {
        const returnUrl = viewer.dataset.returnUrl;
        viewer.closeViewer?.();
        if (returnUrl && window.location.href !== returnUrl) {
            window.history.pushState({}, "", returnUrl);
        }
        return;
    }
    window.location.reload();
});

/* =========================================================
   NOTE COMPATTE: anteprima ridotta, un tocco per leggerle intere
========================================================= */

(function setupCollapsibleNotes() {

    const expanded = new Set();     // le note aperte restano aperte anche dopo un nuovo disegno

    const noteKey = card =>
        (card.dataset.appNoteId ? "app:" + card.dataset.appNoteId : "") ||
        (card.dataset.noteId ? "personal:" + card.dataset.noteId : "");

    const refresh = () => {

        document.querySelectorAll(".app-note-card, .personal-note-card").forEach(card => {

            const text = card.querySelector(".app-note-text, .personal-note-text");
            const key = noteKey(card);
            if (!text || !key) return;

            const open = expanded.has(key);
            card.classList.toggle("note-open", open);

            // Misura con la nota chiusa: se è più alta dell'anteprima, si può espandere.
            card.classList.remove("note-open");
            const overflowing = text.scrollHeight > text.clientHeight + 2;
            card.classList.toggle("note-open", open);

            card.classList.toggle("note-collapsible", overflowing || open);
            card.setAttribute("aria-expanded", String(open));
        });
    };

    let queued = false;
    const schedule = () => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => { queued = false; refresh(); });
    };

    new MutationObserver(schedule).observe(content, { childList: true, subtree: true });
    window.addEventListener("resize", schedule);

    document.addEventListener("click", event => {

        const card = event.target.closest(".app-note-card, .personal-note-card");
        if (!card || !card.classList.contains("note-collapsible")) return;

        // Pulsanti, caselle della lista, link e testo selezionato non aprono/chiudono la nota.
        if (event.target.closest("button, a, input, select, textarea, label")) return;
        if (String(window.getSelection && window.getSelection()).length) return;

        const key = noteKey(card);
        if (!key) return;

        if (expanded.has(key)) expanded.delete(key);
        else expanded.add(key);

        refresh();
    });

    schedule();
})();


/* =========================================================
   SERVICE WORKER
========================================================= */

window.addEventListener("load", () => {
    fetch("./data/farmaci.json")
        .then(response => response.ok ? response.json() : null)
        .then(data => { if (data) migratePersonalNotesForMergedClasses(data); })
        .catch(() => {});
});

if ("serviceWorker" in navigator) {

    window.addEventListener("load", () => {

        navigator.serviceWorker
            .register("./service-worker.js")
            .then(() => {

                console.log(
                    "Service Worker attivo"
                );

            })
            .catch(error => {

                console.error(
                    "Errore Service Worker:",
                    error
                );

            });

    });

}
