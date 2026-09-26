/* =========================================================
   PULIZIA VECCHIA SCHERMATA DI CARICAMENTO
========================================================= */

const oldLoadingScreen = document.getElementById("appLoadingScreen");
if (oldLoadingScreen) {
    oldLoadingScreen.remove();
}


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
   TEMA
========================================================= */

function applyTheme(theme) {

    document.documentElement.dataset.theme =
        theme;

    localStorage.setItem(
        "nursing-theme",
        theme
    );

    const themeButton =
        document.getElementById(
            "themeButton"
        );

    if (themeButton) {

        const light =
            theme === "light";

        themeButton.textContent =
            light ? "☀️" : "💡";

        themeButton.setAttribute(
            "aria-label",
            light
                ? "Passa alla modalità scura"
                : "Passa alla modalità chiara"
        );

    }

}


function setupTheme() {

    const savedTheme =
        localStorage.getItem("nursing-theme") || "dark";

    applyTheme(savedTheme);
}


/* =========================================================
   IMPOSTAZIONI / MODALITÀ MODIFICA ORDINE
========================================================= */

let orderEditMode = false;

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
    const message = document.getElementById("settingsMessage");

    if (!panel || !openButton) return;

    const setMessage = text => {
        if (message) message.textContent = text;
    };

    openButton.addEventListener("click", () => {
        panel.hidden = false;
    });

    closeButton?.addEventListener("click", () => {
        panel.hidden = true;
    });

    panel.addEventListener("click", event => {
        if (event.target === panel) panel.hidden = true;
    });

    orderButton?.addEventListener("click", () => {
        orderEditMode = !orderEditMode;
        document.body.classList.toggle("order-editing", orderEditMode);

        orderButton.textContent =
            orderEditMode
                ? "✅ Fine modifica ordine"
                : "↕️ Modifica ordine";

        setMessage(
            orderEditMode
                ? "Modalità modifica attiva: usa i pulsanti ↑ e ↓."
                : "Ordine salvato."
        );

        panel.hidden = true;

        if (state) {
            loadState();
        } else {
            loadCategories();
        }
    });

    resetButton?.addEventListener("click", () => {
        const keys = Object.keys(localStorage)
            .filter(key =>
                key === "nursing-category-order" ||
                key.startsWith("nursing-sections-") ||
                key.startsWith("nursing-items-")
            );

        keys.forEach(key => localStorage.removeItem(key));

        setMessage("↩️ Ordini ripristinati.");

        if (panel) panel.hidden = false;

        if (state) {
            loadState();
        } else {
            loadCategories();
        }
    });

    themeButton?.addEventListener("click", () => {
        const current =
            document.documentElement.dataset.theme || "dark";

        applyTheme(current === "dark" ? "light" : "dark");
        setMessage("Tema aggiornato.");
    });
}



/* =========================================================
   NAVIGAZIONE
========================================================= */

if (backButton) {

    backButton.addEventListener("click", () => {

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

    const savedOrder =
        JSON.parse(
            localStorage.getItem("nursing-category-order") || "null"
        );

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
        link.href = `?state=${encodeURIComponent(category.id)}`;
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
                            <span class="arrow">→</span>
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
     * SCHEDA COMPONIBILE
     */
    if (Array.isArray(selectedItem.blocks)) {

        renderComposableItem(selectedItem, data);
        return;
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
                                <span class="arrow">→</span>
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

        <h2>
            ${title}
        </h2>

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
                    "Indicazioni",
                    drug.indications
                )}

                ${renderListField(
                    "Effetti",
                    drug.effects
                )}

                ${renderListField(
                    "Monitoraggio",
                    drug.monitoring
                )}

                ${renderListField(
                    "Effetti indesiderati",
                    drug.adverseEffects
                )}

                ${renderField(
                    "Note",
                    drug.notes
                )}

            </div>

        </section>

    `;

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


/* =========================================================
   SEZIONE CALCOLATORI
========================================================= */

function renderCalculatorHub(item, data) {

    const calculators =
        item.items || [];

    let html = `
        <section class="detail-page">

            ${detailHeader(item.title, data)}

            <div class="detail-content">

                <div class="item-list calculator-list">

                    ${calculators.map(calculator => `

                        <a
                            class="content-button"
                            href="?state=${encodeURIComponent(data.id)}&item=${encodeURIComponent(calculator.id)}"
                        >
                            <span>
                                ${calculator.title}
                            </span>

                            <span class="arrow">
                                →
                            </span>
                        </a>

                    `).join("")}

                </div>

            </div>

        </section>
    `;

    content.innerHTML = html;

}


/* =========================================================
   CALCOLATORI
========================================================= */


/* =========================================================
   NUMERI IN FORMATO ITALIANO
========================================================= */

/*
 * Regole:
 *
 * 1.000       = 1000
 * 0,5         = 0.5
 * 1.500,25    = 1500.25
 *
 * Il punto è SEMPRE separatore delle migliaia.
 * La virgola è SEMPRE separatore decimale.
 */

function parseItalianNumber(value) {

    if (value === null || value === undefined) {
        return NaN;
    }

    let text = String(value).trim();

    if (!text) {
        return NaN;
    }

    /*
     * Controllo formato:
     *
     * Sono ammessi:
     * 1000
     * 1.000
     * 0,5
     * 1.500,25
     */

    if (!/^\d{1,3}(\.\d{3})*(,\d+)?$|^\d+(,\d+)?$/.test(text)) {
        return NaN;
    }

    text = text.replace(/\./g, "");
    text = text.replace(",", ".");

    const number = Number(text);

    return number;
}



/* =========================================================
   INPUT NUMERICO
========================================================= */

function numberInput(id, label, placeholder = "") {

    return `
        <label>

            ${label}

            <input
                id="${id}"
                type="text"
                inputmode="decimal"
                placeholder="${placeholder}"
                autocomplete="off"
            >

        </label>
    `;
}


/* =========================================================
   SELECT UNITÀ
========================================================= */

function unitSelect(id, units) {

    return `
        <select id="${id}">

            ${units.map(unit => `
                <option value="${unit.value}">
                    ${unit.label}
                </option>
            `).join("")}

        </select>
    `;
}


/* =========================================================
   NOTA DIDATTICA
========================================================= */

function calculatorNote() {

    return `
        <p class="calculator-note">
            Strumento didattico: verifica sempre prescrizione,
            concentrazione, unità di misura e protocollo prima
            dell'uso clinico.
        </p>
    `;
}


/* =========================================================
   DOSE DA SOMMINISTRARE
========================================================= */

function renderDoseCalculator() {

    return `

        <div class="calculator">

            <h3>
                Dose da somministrare
            </h3>

            ${calculatorNote()}


            <p>
                Puoi calcolare il volume da somministrare
                partendo dalla quantità disponibile oppure
                da una concentrazione percentuale.
            </p>


            <div class="calculate-choice">

                <strong>
                    Tipo di concentrazione disponibile
                </strong>


                <label class="radio-option">

                    <input
                        type="radio"
                        name="dose-mode"
                        value="quantity"
                        checked
                    >

                    Quantità / volume

                </label>


                <label class="radio-option">

                    <input
                        type="radio"
                        name="dose-mode"
                        value="percentage"
                    >

                    Percentuale

                </label>

            </div>


            <div class="calculator-row">

                ${numberInput(
                    "dose-prescribed",
                    "Dose prescritta",
                    "es. 500"
                )}

                ${unitSelect(
                    "dose-prescribed-unit",
                    [
                        {
                            value: "mcg",
                            label: "mcg"
                        },
                        {
                            value: "mg",
                            label: "mg"
                        },
                        {
                            value: "g",
                            label: "g"
                        }
                    ]
                )}

            </div>


            <div id="dose-concentration-fields">

                <div class="calculator-row">

                    ${numberInput(
                        "dose-concentration",
                        "Quantità disponibile",
                        "es. 250"
                    )}

                    ${unitSelect(
                        "dose-concentration-unit",
                        [
                            {
                                value: "mcg",
                                label: "mcg"
                            },
                            {
                                value: "mg",
                                label: "mg"
                            },
                            {
                                value: "g",
                                label: "g"
                            }
                        ]
                    )}

                </div>


                <div class="calculator-row">

                    ${numberInput(
                        "dose-volume",
                        "Volume contenente la quantità",
                        "es. 2"
                    )}

                    ${unitSelect(
                        "dose-volume-unit",
                        [
                            {
                                value: "mL",
                                label: "mL"
                            },
                            {
                                value: "L",
                                label: "L"
                            }
                        ]
                    )}

                </div>

            </div>


            <div
                id="dose-percentage-field"
                style="display: none;"
            >

                <div class="calculator-row">

                    ${numberInput(
                        "dose-percent",
                        "Concentrazione",
                        "es. 5"
                    )}

                    <span class="unit-static">
                        % m/V
                    </span>

                </div>


                <p class="calculator-note">
                    Per questo calcolo la percentuale è interpretata
                    come % m/V: grammi di sostanza ogni 100 mL
                    di soluzione.
                </p>

            </div>


            <button id="calculate-dose">
                Calcola
            </button>


            <div
                id="dose-result"
                class="calculator-result"
            ></div>

        </div>

    `;
}


/* =========================================================
   DILUIZIONI
========================================================= */

/*
 * Per C1 e C2 l'utente sceglie:
 *
 * PESO:
 * mcg / mg / g
 *
 * VOLUME:
 * mL / L
 *
 * Esempio:
 *
 * C1 = 500 mg / 10 mL
 * C2 = 50 mg / 10 mL
 *
 * Il programma converte internamente
 * entrambe le concentrazioni in mg/mL.
 */

function renderDilutionCalculator() {

    return `
        <div class="calculator">

            <div class="calculator-grid">

                <div class="calculator-field">
                    <label for="dilution-c1">
                        C1
                    </label>

                    <input
                        type="text"
                        id="dilution-c1"
                        inputmode="decimal"
                        placeholder="Es. 100"
                    >

                    <select id="dilution-c1-unit">
                        <option value="mg/ml">mg/mL</option>
                        <option value="g/ml">g/mL</option>
                        <option value="%">% m/V</option>
                    </select>
                </div>


                <div class="calculator-field">
                    <label for="dilution-v1">
                        V1
                    </label>

                    <input
                        type="text"
                        id="dilution-v1"
                        inputmode="decimal"
                        placeholder="Es. 5"
                    >

                    <select id="dilution-v1-unit">
                        <option value="ml">mL</option>
                        <option value="l">L</option>
                    </select>
                </div>


                <div class="calculator-field">
                    <label for="dilution-c2">
                        C2
                    </label>

                    <input
                        type="text"
                        id="dilution-c2"
                        inputmode="decimal"
                        placeholder="Es. 20"
                    >

                    <select id="dilution-c2-unit">
                        <option value="mg/ml">mg/mL</option>
                        <option value="g/ml">g/mL</option>
                        <option value="%">% m/V</option>
                    </select>
                </div>


                <div class="calculator-field">
                    <label for="dilution-v2">
                        V2
                    </label>

                    <input
                        type="text"
                        id="dilution-v2"
                        inputmode="decimal"
                        placeholder="Es. ?"
                    >

                    <select id="dilution-v2-unit">
                        <option value="ml">mL</option>
                        <option value="l">L</option>
                    </select>
                </div>

            </div>


            <div class="calculator-formula">
                <strong>C1 × V1 = C2 × V2</strong>
            </div>


            <div
                id="dilution-result"
                class="calculator-result"
                style="display:none;"
            ></div>


            <div class="calculator-actions">

                <button
                    type="button"
                    id="dilution-calculate"
                    class="primary-button"
                >
                    Calcola
                </button>

                <button
                    type="button"
                    id="dilution-reset"
                    class="secondary-button"
                >
                    Cancella
                </button>

            </div>


            ${calculatorNote()}

        </div>
    `;
}


/* =========================================================
   VELOCITÀ DI INFUSIONE
========================================================= */

function renderMlHCalculator() {

    return `

        <div class="calculator">

            <h3>
                Velocità di infusione
            </h3>

            ${calculatorNote()}


            <div class="calculator-row">

                ${numberInput(
                    "infusion-volume",
                    "Volume",
                    "es. 0,5"
                )}

                ${unitSelect(
                    "infusion-volume-unit",
                    [
                        {
                            value: "mL",
                            label: "mL"
                        },
                        {
                            value: "L",
                            label: "L"
                        }
                    ]
                )}

            </div>


            <div class="calculator-row">

                ${numberInput(
                    "infusion-time",
                    "Tempo",
                    "es. 2"
                )}

                ${unitSelect(
                    "infusion-time-unit",
                    [
                        {
                            value: "min",
                            label: "minuti"
                        },
                        {
                            value: "h",
                            label: "ore"
                        }
                    ]
                )}

            </div>


            <button id="calculate-mlh">
                Calcola
            </button>


            <div
                id="mlh-result"
                class="calculator-result"
            ></div>

        </div>

    `;
}

/* =========================================================
   DURATA DELL'INFUSIONE
========================================================= */

function renderDurationCalculator() {

    return `

        <div class="calculator">

            <h3>
                Durata dell'infusione
            </h3>

            ${calculatorNote()}

            <div class="calculator-row">

                ${numberInput(
                    "duration-volume",
                    "Volume",
                    "es. 500"
                )}

                ${unitSelect(
                    "duration-volume-unit",
                    [
                        {
                            value: "mL",
                            label: "mL"
                        },
                        {
                            value: "L",
                            label: "L"
                        }
                    ]
                )}

            </div>


            <div class="calculator-row">

                ${numberInput(
                    "duration-rate",
                    "Velocità di infusione",
                    "es. 125"
                )}

                ${unitSelect(
                    "duration-rate-unit",
                    [
                        {
                            value: "mL/h",
                            label: "mL/h"
                        },
                        {
                            value: "mL/min",
                            label: "mL/min"
                        }
                    ]
                )}

            </div>


            <button
                id="calculate-duration"
                type="button"
            >
                Calcola
            </button>


            <div
                id="duration-result"
                class="calculator-result"
            ></div>

        </div>

    `;

}
/* =========================================================
   GOCCE / MINUTO
========================================================= */

function renderDropsCalculator() {

    return `
        <div class="calculator">

            <div class="calculator-grid">

                <!-- VOLUME -->

                <div class="calculator-field">

                    <label for="drops-volume">
                        Volume
                    </label>

                    <input
                        type="text"
                        id="drops-volume"
                        inputmode="decimal"
                        placeholder="Es. 500"
                    >

                    <select id="drops-volume-unit">

                        <option value="mL">
                            mL
                        </option>

                        <option value="L">
                            L
                        </option>

                    </select>

                </div>


                <!-- DURATA -->

                <div class="calculator-field">

                    <label for="drops-duration">
                        Durata
                    </label>

                    <input
                        type="text"
                        id="drops-duration"
                        inputmode="decimal"
                        placeholder="Es. 4"
                    >

                    <select id="drops-duration-unit">

                        <option value="min">
                            min
                        </option>

                        <option value="h">
                            ore
                        </option>

                    </select>

                </div>


                <!-- VELOCITÀ -->

                <div class="calculator-field">

                    <label for="drops-rate">
                        Velocità infusione
                    </label>

                    <input
                        type="text"
                        id="drops-rate"
                        inputmode="decimal"
                        placeholder="Es. 125"
                    >

                    <select id="drops-rate-unit">

                        <option value="gocce-10">
                            gocce/min — fattore 10
                        </option>

                        <option value="gocce-15">
                            gocce/min — fattore 15
                        </option>

                        <option value="gocce-20" selected>
                            gocce/min — fattore 20
                        </option>

                        <option value="gocce-60">
                            gocce/min — fattore 60
                        </option>

                        <option value="mL/min">
                            mL/min
                        </option>

                    </select>

                </div>

            </div>


            <div class="calculator-formula">

                <strong>
                    Volume = Velocità × Durata
                </strong>

            </div>


            <div
                id="drops-result"
                class="calculator-result"
                style="display:none;"
            ></div>


            ${calculatorNote()}

        </div>
    `;

}
/* =========================================================
   CONVERSIONE VOLUME → mL
========================================================= */

function volumeToMl(value, unit) {

    if (unit === "L") {
        return value * 1000;
    }

    return value;
}


/* =========================================================
   CONVERSIONE TEMPO → MINUTI
========================================================= */

function timeToMinutes(value, unit) {

    if (unit === "h") {
        return value * 60;
    }

    return value;
}


/* =========================================================
   CONVERSIONE PESO → mg
========================================================= */

function massToMg(value, unit) {

    switch (unit) {

        case "mcg":
            return value / 1000;

        case "mg":
            return value;

        case "g":
            return value * 1000;

        default:
            return NaN;
    }
}


/* =========================================================
   CONCENTRAZIONE → mg/mL
========================================================= */

function concentrationToMgMl(
    quantity,
    quantityUnit,
    volume,
    volumeUnit
) {

    if (
        !Number.isFinite(quantity) ||
        !Number.isFinite(volume) ||
        quantity <= 0 ||
        volume <= 0
    ) {
        return NaN;
    }

    const quantityMg =
        massToMg(
            quantity,
            quantityUnit
        );

    const volumeMl =
        volumeToMl(
            volume,
            volumeUnit
        );

    if (
        !Number.isFinite(quantityMg) ||
        !Number.isFinite(volumeMl) ||
        volumeMl <= 0
    ) {
        return NaN;
    }

    return quantityMg / volumeMl;
}


/* =========================================================
   CONCENTRAZIONE PERCENTUALE → mg/mL
========================================================= */

/*
 * % m/V:
 *
 * 1% = 1 g / 100 mL
 * 1% = 1000 mg / 100 mL
 * 1% = 10 mg/mL
 */

function percentageToMgMl(percent) {

    if (
        !Number.isFinite(percent) ||
        percent <= 0
    ) {
        return NaN;
    }

    return percent * 10;
}


/* =========================================================
   CONCENTRAZIONE mg/mL → UNITÀ VISIBILE
========================================================= */

function formatConcentration(
    concentrationMgMl,
    weightUnit,
    volumeUnit
) {

    if (!Number.isFinite(concentrationMgMl)) {
        return "—";
    }

    let quantityMg;
    let volumeMl;

    switch (weightUnit) {

        case "mcg":
            quantityMg = concentrationMgMl * 1000;
            break;

        case "mg":
            quantityMg = concentrationMgMl;
            break;

        case "g":
            quantityMg = concentrationMgMl / 1000;
            break;

        default:
            return "—";
    }

    if (volumeUnit === "L") {

        quantityMg *= 1000;
        volumeMl = 1000;

    } else {

        volumeMl = 1;

    }

    let quantity;

    switch (weightUnit) {

        case "mcg":
            quantity = quantityMg;
            break;

        case "mg":
            quantity = quantityMg;
            break;

        case "g":
            quantity = quantityMg;
            break;

        default:
            return "—";
    }

    return `${formatNumber(quantity)} ${weightUnit}/${volumeUnit}`;
}


/* =========================================================
   CONVERSIONE RISULTATO CONCENTRAZIONE
========================================================= */

function mgMlToSelectedConcentration(
    concentrationMgMl,
    weightUnit,
    volumeUnit
) {

    let value;

    if (volumeUnit === "L") {

        switch (weightUnit) {

            case "mcg":
                value = concentrationMgMl * 1000 * 1000;
                break;

            case "mg":
                value = concentrationMgMl * 1000;
                break;

            case "g":
                value = concentrationMgMl;
                break;

            default:
                return NaN;
        }

    } else {

        switch (weightUnit) {

            case "mcg":
                value = concentrationMgMl * 1000;
                break;

            case "mg":
                value = concentrationMgMl;
                break;

            case "g":
                value = concentrationMgMl / 1000;
                break;

            default:
                return NaN;
        }
    }

    return value;
}


/* =========================================================
   RENDER CALCOLATORE
========================================================= */

function renderCalculator(id, title, data) {

    let calculatorHTML = "";

    if (id === "dose") {
        calculatorHTML = renderDoseCalculator();
    }
    else if (id === "diluizioni") {
        calculatorHTML = renderDilutionCalculator();
    }
    else if (id === "ml-h") {
        calculatorHTML = renderMlHCalculator();
       
    }
   else if (id === "gocce-min") {
    calculatorHTML = renderDropsCalculator();
    }
    else if (id === "durata-infusione") {
    calculatorHTML = renderDurationCalculator();
    }
    else {
        content.innerHTML = `
            <section class="detail-page">
                ${detailHeader(title, data)}

                <div class="detail-content">
                    <h3>Calcolatore non disponibile</h3>

                    <p>
                        Il calcolatore
                        <strong>${id}</strong>
                        non è stato riconosciuto.
                    </p>
                </div>
            </section>
        `;
        return;
    }

    content.innerHTML = `
        <section class="detail-page">
            ${detailHeader(title, data)}

            <div class="detail-content">
                ${calculatorHTML}
            </div>
        </section>
    `;

    attachCalculatorEvents(id);
}

function attachCalculatorEvents(id) {


    /* =====================================================
       DOSE
    ===================================================== */

    if (id === "dose") {

        const modeInputs =
            document.querySelectorAll(
                'input[name="dose-mode"]'
            );

        const concentrationFields =
            document.getElementById(
                "dose-concentration-fields"
            );

        const percentageField =
            document.getElementById(
                "dose-percentage-field"
            );


        function updateDoseMode() {

            const mode =
                document.querySelector(
                    'input[name="dose-mode"]:checked'
                )?.value;

            if (mode === "percentage") {

                concentrationFields.style.display =
                    "none";

                percentageField.style.display =
                    "block";

            } else {

                concentrationFields.style.display =
                    "block";

                percentageField.style.display =
                    "none";
            }
        }


        modeInputs.forEach(input => {

            input.addEventListener(
                "change",
                updateDoseMode
            );

        });


        updateDoseMode();


        document
            .getElementById("calculate-dose")
            ?.addEventListener(
                "click",
                () => {

                    const dose =
                        parseItalianNumber(
                            document.getElementById(
                                "dose-prescribed"
                            ).value
                        );


                    const doseUnit =
                        document.getElementById(
                            "dose-prescribed-unit"
                        ).value;


                    if (
                        !Number.isFinite(dose) ||
                        dose <= 0
                    ) {

                        showResult(
                            "dose-result",
                            "Controlla la dose prescritta."
                        );

                        return;
                    }


                    const doseMg =
                        massToMg(
                            dose,
                            doseUnit
                        );


                    const mode =
                        document.querySelector(
                            'input[name="dose-mode"]:checked'
                        )?.value;


                    let concentrationMgMl;


                    /* -------------------------------------
                       QUANTITÀ / VOLUME
                    ------------------------------------- */

                    if (mode === "quantity") {

                        const quantity =
                            parseItalianNumber(
                                document.getElementById(
                                    "dose-concentration"
                                ).value
                            );


                        const quantityUnit =
                            document.getElementById(
                                "dose-concentration-unit"
                            ).value;


                        const volume =
                            parseItalianNumber(
                                document.getElementById(
                                    "dose-volume"
                                ).value
                            );


                        const volumeUnit =
                            document.getElementById(
                                "dose-volume-unit"
                            ).value;


                        concentrationMgMl =
                            concentrationToMgMl(
                                quantity,
                                quantityUnit,
                                volume,
                                volumeUnit
                            );

                    }


                    /* -------------------------------------
                       PERCENTUALE
                    ------------------------------------- */

                    if (mode === "percentage") {

                        const percent =
                            parseItalianNumber(
                                document.getElementById(
                                    "dose-percent"
                                ).value
                            );


                        concentrationMgMl =
                            percentageToMgMl(
                                percent
                            );

                    }


                    if (
                        !Number.isFinite(
                            concentrationMgMl
                        ) ||
                        concentrationMgMl <= 0
                    ) {

                        showResult(
                            "dose-result",
                            "Controlla concentrazione e unità di misura."
                        );

                        return;
                    }


                    const resultMl =
                        doseMg /
                        concentrationMgMl;


                    let resultText =
                        `Volume da somministrare: ${formatNumber(
                            resultMl
                        )} mL`;


                    if (mode === "percentage") {

                        const percent =
                            parseItalianNumber(
                                document.getElementById(
                                    "dose-percent"
                                ).value
                            );


                        resultText +=
                            ` — concentrazione ${formatNumber(
                                percent
                            )} % m/V`;

                    }


                    showResult(
                        "dose-result",
                        resultText
                    );

                }
            );
    }


    /* =====================================================
       DILUIZIONI
    ===================================================== */

    if (id === "diluizioni") {

    const c1Input = document.getElementById("dilution-c1");
    const c1Unit = document.getElementById("dilution-c1-unit");

    const v1Input = document.getElementById("dilution-v1");
    const v1Unit = document.getElementById("dilution-v1-unit");

    const c2Input = document.getElementById("dilution-c2");
    const c2Unit = document.getElementById("dilution-c2-unit");

    const v2Input = document.getElementById("dilution-v2");
    const v2Unit = document.getElementById("dilution-v2-unit");

    const calculateButton =
        document.getElementById("dilution-calculate");

    const resetButton =
        document.getElementById("dilution-reset");

    const result =
        document.getElementById("dilution-result");


    function concentrationToMgMl(value, unit) {

        if (unit === "mg/ml") {
            return value;
        }

        if (unit === "g/ml") {
            return value * 1000;
        }

        if (unit === "%") {
            return value * 10;
        }

        return NaN;
    }


    function mgMlToUnit(value, unit) {

        if (unit === "mg/ml") {
            return value;
        }

        if (unit === "g/ml") {
            return value / 1000;
        }

        if (unit === "%") {
            return value / 10;
        }

        return NaN;
    }


    calculateButton.addEventListener("click", () => {

        const c1 = c1Input.value.trim() !== "";
        const v1 = v1Input.value.trim() !== "";
        const c2 = c2Input.value.trim() !== "";
        const v2 = v2Input.value.trim() !== "";

        const filled =
            [c1, v1, c2, v2].filter(Boolean).length;


        // Meno di 3 valori
        if (filled < 3) {

            result.innerHTML = `
                <strong>Dati insufficienti</strong>
                <p>
                    Inserisci 3 valori e lascia vuoto quello
                    che vuoi calcolare.
                </p>
            `;

            result.style.display = "block";
            return;
        }


        // Tutti e 4 compilati
        if (filled === 4) {

            result.innerHTML = `
                <strong>Lascia un campo vuoto</strong>
                <p>
                    Inserisci 3 valori e lascia vuoto quello
                    che vuoi calcolare.
                </p>
            `;

            result.style.display = "block";
            return;
        }


        // Leggiamo i numeri
        const c1Value = c1
            ? parseItalianNumber(c1Input.value)
            : null;

        const v1Value = v1
            ? parseItalianNumber(v1Input.value)
            : null;

        const c2Value = c2
            ? parseItalianNumber(c2Input.value)
            : null;

        const v2Value = v2
            ? parseItalianNumber(v2Input.value)
            : null;


        // Conversione concentrazioni in mg/mL
        const c1MgMl = c1
            ? concentrationToMgMl(c1Value, c1Unit.value)
            : null;

        const c2MgMl = c2
            ? concentrationToMgMl(c2Value, c2Unit.value)
            : null;


        // Conversione volumi in mL
        const v1Ml = v1
            ? volumeToMl(v1Value, v1Unit.value)
            : null;

        const v2Ml = v2
            ? volumeToMl(v2Value, v2Unit.value)
            : null;


        // CALCOLA C1
        if (!c1) {

            const calculated =
                (c2MgMl * v2Ml) / v1Ml;

            const finalValue =
                mgMlToUnit(calculated, c1Unit.value);

            c1Input.value =
                formatNumber(finalValue);

            result.innerHTML = `
                <strong>C1 calcolata</strong>
                <p>
                    C1 =
                    <strong>
                        ${formatNumber(finalValue)}
                        ${c1Unit.value}
                    </strong>
                </p>
            `;
        }


        // CALCOLA V1
        else if (!v1) {

            const calculated =
                (c2MgMl * v2Ml) / c1MgMl;

            const finalValue =
                v1Unit.value === "L"
                    ? calculated / 1000
                    : calculated;

            v1Input.value =
                formatNumber(finalValue);

            result.innerHTML = `
                <strong>V1 calcolato</strong>
                <p>
                    V1 =
                    <strong>
                        ${formatNumber(finalValue)}
                        ${v1Unit.value}
                    </strong>
                </p>
            `;
        }


        // CALCOLA C2
        else if (!c2) {

            const calculated =
                (c1MgMl * v1Ml) / v2Ml;

            const finalValue =
                mgMlToUnit(calculated, c2Unit.value);

            c2Input.value =
                formatNumber(finalValue);

            result.innerHTML = `
                <strong>C2 calcolata</strong>
                <p>
                    C2 =
                    <strong>
                        ${formatNumber(finalValue)}
                        ${c2Unit.value}
                    </strong>
                </p>
            `;
        }


        // CALCOLA V2
        else if (!v2) {

            const calculated =
                (c1MgMl * v1Ml) / c2MgMl;

            const finalValue =
                v2Unit.value === "L"
                    ? calculated / 1000
                    : calculated;

            v2Input.value =
                formatNumber(finalValue);

            result.innerHTML = `
                <strong>V2 calcolato</strong>
                <p>
                    V2 =
                    <strong>
                        ${formatNumber(finalValue)}
                        ${v2Unit.value}
                    </strong>
                </p>
            `;
        }


        result.style.display = "block";

    });


    resetButton.addEventListener("click", () => {

        c1Input.value = "";
        v1Input.value = "";
        c2Input.value = "";
        v2Input.value = "";

        result.innerHTML = "";
        result.style.display = "none";

    });

}
    /* =====================================================
       VELOCITÀ DI INFUSIONE
    ===================================================== */

    if (id === "ml-h") {

        document
            .getElementById("calculate-mlh")
            ?.addEventListener(
                "click",
                () => {

                    const volume =
                        parseItalianNumber(
                            document.getElementById(
                                "infusion-volume"
                            ).value
                        );


                    const volumeUnit =
                        document.getElementById(
                            "infusion-volume-unit"
                        ).value;


                    const time =
                        parseItalianNumber(
                            document.getElementById(
                                "infusion-time"
                            ).value
                        );


                    const timeUnit =
                        document.getElementById(
                            "infusion-time-unit"
                        ).value;


                    if (
                        !Number.isFinite(volume) ||
                        !Number.isFinite(time) ||
                        volume <= 0 ||
                        time <= 0
                    ) {

                        showResult(
                            "mlh-result",
                            "Controlla i valori inseriti."
                        );

                        return;
                    }


                    const volumeMl =
                        volumeToMl(
                            volume,
                            volumeUnit
                        );


                    const minutes =
                        timeToMinutes(
                            time,
                            timeUnit
                        );


                    const mlPerHour =
                        volumeMl /
                        (minutes / 60);


                    const lPerHour =
                        mlPerHour / 1000;


                    showResult(
                        "mlh-result",
                        `${formatNumber(
                            mlPerHour
                        )} mL/h — ${formatNumber(
                            lPerHour
                        )} L/h`
                    );

                }
            );
    }
/* =====================================================
   DURATA DELL'INFUSIONE
===================================================== */

if (id === "durata-infusione") {

    document
        .getElementById("calculate-duration")
        ?.addEventListener(
            "click",
            () => {

                const volume =
                    parseItalianNumber(
                        document.getElementById(
                            "duration-volume"
                        ).value
                    );


                const volumeUnit =
                    document.getElementById(
                        "duration-volume-unit"
                    ).value;


                const rate =
                    parseItalianNumber(
                        document.getElementById(
                            "duration-rate"
                        ).value
                    );


                const rateUnit =
                    document.getElementById(
                        "duration-rate-unit"
                    ).value;


                if (
                    !Number.isFinite(volume) ||
                    !Number.isFinite(rate) ||
                    volume <= 0 ||
                    rate <= 0
                ) {

                    showResult(
                        "duration-result",
                        "Controlla i valori inseriti."
                    );

                    return;
                }


                const volumeMl =
                    volumeToMl(
                        volume,
                        volumeUnit
                    );


                let rateMlHour;


                if (rateUnit === "mL/min") {

                    rateMlHour =
                        rate * 60;

                } else {

                    rateMlHour =
                        rate;

                }


                const durationHours =
                    volumeMl /
                    rateMlHour;


                const durationMinutes =
                    durationHours * 60;


                showResult(
                    "duration-result",
                    `Durata: ${formatDuration(
                        durationMinutes
                    )} — ${formatNumber(
                        durationHours
                    )} ore`
                );

            }
        );

}

    /* =====================================================
       GOCCE
    ===================================================== */

 if (id === "gocce-min") {

    const volumeInput =
        document.getElementById("drops-volume");

    const volumeUnit =
        document.getElementById("drops-volume-unit");

    const durationInput =
        document.getElementById("drops-duration");

    const durationUnit =
        document.getElementById("drops-duration-unit");

    const rateInput =
        document.getElementById("drops-rate");

    const rateUnit =
        document.getElementById("drops-rate-unit");

    const result =
        document.getElementById("drops-result");


    /*
     * Memorizza quale campo è stato calcolato
     */

    let calculatedField = null;


    /*
     * Restituisce il fattore gocce
     */

    function getDropFactor() {

        switch (rateUnit.value) {

            case "gocce-10":
                return 10;

            case "gocce-15":
                return 15;

            case "gocce-20":
                return 20;

            case "gocce-60":
                return 60;

            default:
                return null;

        }

    }


    /*
     * Restituisce l'unità visualizzata
     */

    function getRateLabel() {

        switch (rateUnit.value) {

            case "gocce-10":
            case "gocce-15":
            case "gocce-20":
            case "gocce-60":
                return "gocce/min";

            case "mL/min":
                return "mL/min";

            default:
                return "";

        }

    }


    /*
     * CALCOLO AUTOMATICO
     */

    function calculateAutomatically() {

        const volumeFilled =
            volumeInput.value.trim() !== "";

        const durationFilled =
            durationInput.value.trim() !== "";

        const rateFilled =
            rateInput.value.trim() !== "";


        const filled =
            [
                volumeFilled,
                durationFilled,
                rateFilled
            ].filter(Boolean).length;


        /*
         * Se l'utente modifica un campo
         * diverso da quello calcolato,
         * svuotiamo il vecchio risultato.
         */

        if (calculatedField) {

            const currentValues = {
                volume: volumeInput.value.trim(),
                duration: durationInput.value.trim(),
                rate: rateInput.value.trim()
            };

            /*
             * Se il campo calcolato è ancora uguale
             * al valore prodotto precedentemente,
             * lo consideriamo ancora calcolato.
             */

        }


        /*
         * Meno di 2 valori:
         * non possiamo calcolare.
         */

        if (filled < 2) {

            result.style.display = "none";
            result.innerHTML = "";

            calculatedField = null;

            return;
        }


        /*
         * Se tutti e 3 sono compilati:
         * controlliamo se uno è stato generato
         * automaticamente.
         */

        if (filled === 3) {

            /*
             * Se esiste un campo calcolato,
             * lo svuotiamo prima di ricalcolare.
             */

            if (calculatedField === "volume") {

                volumeInput.value = "";
                calculatedField = null;

                calculateAutomatically();
                return;

            }

            if (calculatedField === "duration") {

                durationInput.value = "";
                calculatedField = null;

                calculateAutomatically();
                return;

            }

            if (calculatedField === "rate") {

                rateInput.value = "";
                calculatedField = null;

                calculateAutomatically();
                return;

            }


            /*
             * Tutti e 3 inseriti manualmente.
             */

            result.style.display = "block";

            result.innerHTML = `
                <strong>Lascia vuoto il valore da calcolare.</strong>
            `;

            return;
        }


        /*
         * LETTURA VALORI
         */

        const volume =
            volumeFilled
                ? parseItalianNumber(volumeInput.value)
                : null;

        const duration =
            durationFilled
                ? parseItalianNumber(durationInput.value)
                : null;

        const rate =
            rateFilled
                ? parseItalianNumber(rateInput.value)
                : null;


        /*
         * VALIDAZIONE
         */

        if (
            volumeFilled &&
            (!Number.isFinite(volume) || volume <= 0)
        ) {
            return;
        }

        if (
            durationFilled &&
            (!Number.isFinite(duration) || duration <= 0)
        ) {
            return;
        }

        if (
            rateFilled &&
            (!Number.isFinite(rate) || rate <= 0)
        ) {
            return;
        }


        /*
         * VOLUME → mL
         */

        const volumeMl =
            volumeFilled
                ? volumeToMl(
                    volume,
                    volumeUnit.value
                )
                : null;


        /*
         * DURATA → minuti
         */

        const durationMin =
            durationFilled
                ? timeToMinutes(
                    duration,
                    durationUnit.value
                )
                : null;


        /*
         * VELOCITÀ → mL/min
         */

        let rateMlMin = null;

        if (rateFilled) {

            if (
                rateUnit.value.startsWith("gocce-")
            ) {

                const factor =
                    getDropFactor();

                rateMlMin =
                    rate / factor;

            } else {

                rateMlMin =
                    rate;

            }

        }


        /*
         * =============================================
         * CALCOLO VOLUME
         * =============================================
         */

        if (!volumeFilled) {

            const calculatedMl =
                rateMlMin *
                durationMin;


            let calculated =
                calculatedMl;


            if (volumeUnit.value === "L") {

                calculated =
                    calculatedMl / 1000;

            }


            volumeInput.value =
                formatNumber(calculated);


            calculatedField =
                "volume";


            result.style.display =
                "block";


            result.innerHTML = `
                Volume calcolato:
                <strong>
                    ${formatNumber(calculated)}
                    ${volumeUnit.value}
                </strong>
            `;


            return;
        }


        /*
         * =============================================
         * CALCOLO DURATA
         * =============================================
         */

        if (!durationFilled) {

            const calculatedMin =
                volumeMl /
                rateMlMin;


            let calculated =
                calculatedMin;


            if (durationUnit.value === "h") {

                calculated =
                    calculatedMin / 60;

            }


            durationInput.value =
                formatNumber(calculated);


            calculatedField =
                "duration";


            result.style.display =
                "block";


            result.innerHTML = `
                Durata calcolata:
                <strong>
                    ${formatNumber(calculated)}
                    ${durationUnit.value === "h"
                        ? "ore"
                        : "min"}
                </strong>
            `;


            return;
        }


        /*
         * =============================================
         * CALCOLO VELOCITÀ
         * =============================================
         */

        if (!rateFilled) {

            const calculatedMlMin =
                volumeMl /
                durationMin;


            let calculated;


            if (
                rateUnit.value.startsWith("gocce-")
            ) {

                const factor =
                    getDropFactor();

                calculated =
                    calculatedMlMin *
                    factor;

            } else {

                calculated =
                    calculatedMlMin;

            }


            rateInput.value =
                formatNumber(calculated);


            calculatedField =
                "rate";


            result.style.display =
                "block";


            result.innerHTML = `
                Velocità calcolata:
                <strong>
                    ${formatNumber(calculated)}
                    ${getRateLabel()}
                </strong>
            `;

        }

    }


    /*
     * =============================================
     * INPUT AUTOMATICI
     * =============================================
     */

    volumeInput.addEventListener(
        "input",
        () => {

            if (calculatedField === "volume") {
                calculatedField = null;
            }

            calculateAutomatically();

        }
    );


    durationInput.addEventListener(
        "input",
        () => {

            if (calculatedField === "duration") {
                calculatedField = null;
            }

            calculateAutomatically();

        }
    );


    rateInput.addEventListener(
        "input",
        () => {

            if (calculatedField === "rate") {
                calculatedField = null;
            }

            calculateAutomatically();

        }
    );


    volumeUnit.addEventListener(
        "change",
        calculateAutomatically
    );


    durationUnit.addEventListener(
        "change",
        calculateAutomatically
    );


    rateUnit.addEventListener(
        "change",
        calculateAutomatically
    );

}


}
/* =========================================================
   CAMPI DINAMICI GOCCE
========================================================= */

function updateDropsFields() {

    const target =
        document.querySelector(
            'input[name="drops-target"]:checked'
        )?.value;


    const container =
        document.getElementById(
            "drops-fields"
        );


    if (!container) {
        return;
    }


    /* -------------------------------------
       CALCOLARE GOCCE/MIN
    ------------------------------------- */

    if (target === "rate") {

        container.innerHTML = `

            <div class="calculator-row">

                ${numberInput(
                    "drops-time",
                    "Tempo",
                    "es. 2"
                )}

                ${unitSelect(
                    "drops-time-unit",
                    [
                        {
                            value: "min",
                            label: "minuti"
                        },
                        {
                            value: "h",
                            label: "ore"
                        }
                    ]
                )}

            </div>


            <div class="calculator-row">

                ${numberInput(
                    "drop-factor",
                    "Fattore di gocciolamento",
                    "es. 20"
                )}

                <span class="unit-static">
                    gocce/mL
                </span>

            </div>

        `;

    }


    /* -------------------------------------
       CALCOLARE DURATA
    ------------------------------------- */

    if (target === "duration") {

        container.innerHTML = `

            <div class="calculator-row">

                ${numberInput(
                    "drops-rate",
                    "Velocità",
                    "es. 20"
                )}

                <span class="unit-static">
                    gocce/min
                </span>

            </div>


            <div class="calculator-row">

                ${numberInput(
                    "drop-factor",
                    "Fattore di gocciolamento",
                    "es. 20"
                )}

                <span class="unit-static">
                    gocce/mL
                </span>

            </div>

        `;

    }


    /* -------------------------------------
       CALCOLARE FATTORE
    ------------------------------------- */

    if (target === "factor") {

        container.innerHTML = `

            <div class="calculator-row">

                ${numberInput(
                    "drops-time",
                    "Tempo",
                    "es. 2"
                )}

                ${unitSelect(
                    "drops-time-unit",
                    [
                        {
                            value: "min",
                            label: "minuti"
                        },
                        {
                            value: "h",
                            label: "ore"
                        }
                    ]
                )}

            </div>


            <div class="calculator-row">

                ${numberInput(
                    "drops-rate",
                    "Velocità",
                    "es. 20"
                )}

                <span class="unit-static">
                    gocce/min
                </span>

            </div>

        `;

    }

}


/* =========================================================
   CALCOLO GOCCE
========================================================= */

function calculateDrops() {

    const volume =
        parseItalianNumber(
            document.getElementById(
                "drops-volume"
            ).value
        );


    const volumeUnit =
        document.getElementById(
            "drops-volume-unit"
        ).value;


    const target =
        document.querySelector(
            'input[name="drops-target"]:checked'
        )?.value;


    if (
        !Number.isFinite(volume) ||
        volume <= 0
    ) {

        showResult(
            "drops-result",
            "Controlla il volume inserito."
        );

        return;
    }


    const volumeMl =
        volumeToMl(
            volume,
            volumeUnit
        );


    /* -------------------------------------
       GOCCE/MIN
    ------------------------------------- */

    if (target === "rate") {

        const time =
            parseItalianNumber(
                document.getElementById(
                    "drops-time"
                ).value
            );


        const timeUnit =
            document.getElementById(
                "drops-time-unit"
            ).value;


        const factor =
            parseItalianNumber(
                document.getElementById(
                    "drop-factor"
                ).value
            );


        if (
            !Number.isFinite(time) ||
            !Number.isFinite(factor) ||
            time <= 0 ||
            factor <= 0
        ) {

            showResult(
                "drops-result",
                "Controlla tempo e fattore di gocciolamento."
            );

            return;
        }


        const minutes =
            timeToMinutes(
                time,
                timeUnit
            );


        const rate =
            (
                volumeMl *
                factor
            ) /
            minutes;


        showResult(
            "drops-result",
            `${formatNumber(
                rate
            )} gocce/min`
        );


        return;
    }


    /* -------------------------------------
       DURATA
    ------------------------------------- */

    if (target === "duration") {

        const rate =
            parseItalianNumber(
                document.getElementById(
                    "drops-rate"
                ).value
            );


        const factor =
            parseItalianNumber(
                document.getElementById(
                    "drop-factor"
                ).value
            );


        if (
            !Number.isFinite(rate) ||
            !Number.isFinite(factor) ||
            rate <= 0 ||
            factor <= 0
        ) {

            showResult(
                "drops-result",
                "Controlla velocità e fattore."
            );

            return;
        }


        const minutes =
            (
                volumeMl *
                factor
            ) /
            rate;


        const hours =
            minutes / 60;


        showResult(
            "drops-result",
            `Durata: ${formatDuration(
                minutes
            )} — ${formatNumber(
                hours
            )} ore`
        );


        return;
    }


    /* -------------------------------------
       FATTORE
    ------------------------------------- */

    if (target === "factor") {

        const time =
            parseItalianNumber(
                document.getElementById(
                    "drops-time"
                ).value
            );


        const timeUnit =
            document.getElementById(
                "drops-time-unit"
            ).value;


        const rate =
            parseItalianNumber(
                document.getElementById(
                    "drops-rate"
                ).value
            );


        if (
            !Number.isFinite(time) ||
            !Number.isFinite(rate) ||
            time <= 0 ||
            rate <= 0
        ) {

            showResult(
                "drops-result",
                "Controlla tempo e velocità."
            );

            return;
        }


        const minutes =
            timeToMinutes(
                time,
                timeUnit
            );


        const factor =
            (
                rate *
                minutes
            ) /
            volumeMl;


        showResult(
            "drops-result",
            `Fattore necessario: ${formatNumber(
                factor
            )} gocce/mL`
        );

    }

}


/* =========================================================
   VALIDAZIONE
========================================================= */

function validNumber(value) {

    return Number.isFinite(value);

}


/* =========================================================
   FORMATTA DURATA
========================================================= */

function formatDuration(totalMinutes) {

    if (
        !Number.isFinite(totalMinutes) ||
        totalMinutes < 0
    ) {
        return "—";
    }


    const rounded =
        Math.round(totalMinutes);


    const hours =
        Math.floor(
            rounded / 60
        );


    const minutes =
        rounded % 60;


    if (hours === 0) {

        return `${minutes} min`;

    }


    if (minutes === 0) {

        return `${hours} h`;

    }


    return `${hours} h ${minutes} min`;

}


/* =========================================================
   MOSTRA RISULTATO
========================================================= */

function showResult(id, text) {

    const element =
        document.getElementById(id);


    if (element) {

        element.textContent = text;

    }

}


/* =========================================================
   FORMATTA NUMERI
========================================================= */

function formatNumber(number) {

    return Number(number)
        .toLocaleString("it-IT", {
            maximumFractionDigits: 2
        });

}


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
   AVVIO
========================================================= */
setupTheme();
setupSettings();

if (editor === "1") {

    loadEditor();

} else {

    loadCategories();

    loadState();

}
/* =========================================================
   EDITOR
========================================================= */

async function loadEditor() {

    shortcuts.style.display = "none";

    stateTitle.textContent =
        "🛠️ Editor";

    description.textContent =
        "Modifica i contenuti dell'archivio.";

    content.innerHTML = `

        <section>

            <h2>
                Archivio
            </h2>

            <select id="editor-state">

                <option value="">
                    Seleziona archivio
                </option>

                <option value="ecg">
                    ECG
                </option>

                <option value="farmaci">
                    Farmaci
                </option>

                <option value="laboratorio">
                    Laboratorio
                </option>

                <option value="emergenze">
                    Emergenze
                </option>

            </select>

            <div id="editor-area"></div>

        </section>

    `;


    const select =
        document.getElementById(
            "editor-state"
        );


    select.addEventListener(
        "change",
        () => {

            if (select.value) {

                openEditorFile(
                    select.value
                );

            }

        }
    );

}


/* =========================================================
   APRE FILE NELL'EDITOR
========================================================= */

async function openEditorFile(stateId) {

    const area =
        document.getElementById(
            "editor-area"
        );


    try {

        const response =
            await fetch(
                `./data/${stateId}.json`
            );


        if (!response.ok) {

            throw new Error(
                "File non trovato"
            );

        }


        let data =
            await response.json();


        data =
            applyLocalOverride(
                stateId,
                data
            );


        area.innerHTML = `

            <h2>
                ${data.icon || ""}
                ${data.title}
            </h2>

            <label>
                Titolo

                <input
                    id="editor-title"
                    type="text"
                    value="${escapeAttribute(
                        data.title || ""
                    )}"
                >

            </label>


            <label>
                Descrizione

                <textarea
                    id="editor-description"
                >${data.description || ""}</textarea>

            </label>


            <h3>
                JSON completo
            </h3>

            <textarea
                id="editor-json"
                class="editor-json"
            ></textarea>


            <div class="editor-buttons">

                <button id="editor-save">
                    💾 Salva localmente
                </button>

                <button id="editor-export">
                    📥 Esporta JSON
                </button>

                <button id="editor-reset">
                    ↩ Ripristina originale
                </button>

            </div>


            <div
                id="editor-message"
                class="calculator-result"
            ></div>

        `;


        const jsonArea =
            document.getElementById(
                "editor-json"
            );


        jsonArea.value =
            JSON.stringify(
                data,
                null,
                2
            );


        document
            .getElementById("editor-save")
            .addEventListener(
                "click",
                () => {

                    saveEditorData(
                        stateId
                    );

                }
            );


        document
            .getElementById("editor-export")
            .addEventListener(
                "click",
                () => {

                    exportEditorData(
                        stateId
                    );

                }
            );


        document
            .getElementById("editor-reset")
            .addEventListener(
                "click",
                () => {

                    localStorage.removeItem(
                        `nursing-nfc-${stateId}`
                    );

                    location.reload();

                }
            );

    }

    catch (error) {

        area.innerHTML = `

            <p>
                Impossibile caricare
                ${stateId}.json
            </p>

        `;

        console.error(error);

    }

}


/* =========================================================
   SALVA EDITOR
========================================================= */

function saveEditorData(stateId) {

    const jsonArea =
        document.getElementById(
            "editor-json"
        );


    try {

        const data =
            JSON.parse(
                jsonArea.value
            );


        localStorage.setItem(

            `nursing-nfc-${stateId}`,

            JSON.stringify(data)

        );


        showEditorMessage(
            "✅ Modifiche salvate localmente."
        );

    }

    catch (error) {

        showEditorMessage(
            "❌ JSON non valido. Controlla la sintassi."
        );

        console.error(error);

    }

}


/* =========================================================
   ESPORTA JSON
========================================================= */

function exportEditorData(stateId) {

    const jsonArea =
        document.getElementById(
            "editor-json"
        );


    try {

        const data =
            JSON.parse(
                jsonArea.value
            );


        const blob =
            new Blob(

                [
                    JSON.stringify(
                        data,
                        null,
                        2
                    )
                ],

                {
                    type:
                        "application/json"
                }

            );


        const url =
            URL.createObjectURL(blob);


        const link =
            document.createElement("a");


        link.href = url;

        link.download =
            `${stateId}.json`;


        link.click();


        URL.revokeObjectURL(url);


        showEditorMessage(
            "📥 JSON esportato."
        );

    }

    catch (error) {

        showEditorMessage(
            "❌ JSON non valido."
        );

        console.error(error);

    }

}


/* =========================================================
   MESSAGGIO EDITOR
========================================================= */

function showEditorMessage(message) {

    const element =
        document.getElementById(
            "editor-message"
        );


    if (element) {

        element.textContent =
            message;

    }

}


/* =========================================================
   SICUREZZA HTML
========================================================= */

function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


/* =========================================================
   SICUREZZA ATTRIBUTO
========================================================= */

function escapeAttribute(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

}

/* =========================================================
   SERVICE WORKER
========================================================= */

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
