/* =========================================================
   PARAMETRI URL
========================================================= */

const params = new URLSearchParams(
    window.location.search
);

const state = params.get("state");
const item = params.get("item");


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

    shortcuts.innerHTML = "";

    categories.forEach(category => {

        const link =
            document.createElement("a");

        link.className = "shortcut";

        link.href =
            `?state=${encodeURIComponent(category.id)}`;

        link.innerHTML = `

            <span class="shortcut-icon">
                ${category.icon || ""}
            </span>

            <span class="shortcut-text">

                <strong>
                    ${category.title}
                </strong>

                <small>
                    ${category.description || ""}
                </small>

            </span>

        `;

        shortcuts.appendChild(link);

    });

}


/* =========================================================
   CARICA ARCHIVIO
========================================================= */

async function loadState() {

    /*
     * HOME
     */

    if (!state) {

        shortcuts.style.display = "flex";

        stateTitle.textContent =
            "Benvenuto";

        description.textContent =
            "Seleziona un archivio per iniziare.";

        content.innerHTML = "";

        return;

    }


    /*
     * PAGINA CATEGORIA
     */

    shortcuts.style.display = "none";


    try {

        const response =
            await fetch(
                `./data/${state}.json`
            );


        if (!response.ok) {

            throw new Error(
                "Archivio non trovato"
            );

        }


        let data =
            await response.json();


        /*
         * Applica eventuali modifiche
         * salvate dall'editor locale.
         */

        data =
            applyLocalOverride(
                state,
                data
            );


        stateTitle.textContent =
            `${data.icon || ""} ${data.title}`;


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

        console.error(error);

        stateTitle.textContent =
            "❌ Errore";

        description.textContent = "";

        content.innerHTML = `

            <section>

                <h2>
                    Archivio non disponibile
                </h2>

                <p>
                    Non è stato possibile trovare
                    l'archivio "${state}".
                </p>

            </section>

        `;

    }

}


/* =========================================================
   RENDER SEZIONI
========================================================= */

function renderSections(data) {

    let html = "";


    if (!data.sections) {

        content.innerHTML = "";

        return;

    }


    data.sections.forEach(section => {

        html += `

            <section>

                <h2>
                    ${section.title}
                </h2>

                <div class="item-list">

        `;


        if (section.items) {

            section.items.forEach(sectionItem => {

                const itemId =
                    typeof sectionItem === "string"
                        ? createId(sectionItem)
                        : sectionItem.id;


                const itemTitle =
                    typeof sectionItem === "string"
                        ? sectionItem
                        : sectionItem.title;


                html += `

                    <a
                        class="content-button"
                        href="?state=${encodeURIComponent(state)}&item=${encodeURIComponent(itemId)}"
                    >

                        <span>
                            ${itemTitle}
                        </span>

                        <span class="arrow">
                            →
                        </span>

                    </a>

                `;

            });

        }


        html += `

                </div>

            </section>

        `;

    });


    content.innerHTML = html;

}


/* =========================================================
   TROVA ELEMENTO
========================================================= */

function findItem(data, itemId) {

    if (!data.sections) {

        return null;

    }


    for (const section of data.sections) {

        if (!section.items) {

            continue;

        }


        for (const sectionItem of section.items) {

            const currentId =
                typeof sectionItem === "string"
                    ? createId(sectionItem)
                    : sectionItem.id;


            if (currentId === itemId) {

                return sectionItem;

            }

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
     * STRINGA SEMPLICE
     */

    if (typeof selectedItem === "string") {

        renderGenericText(
            selectedItem,
            "Contenuto in preparazione."
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
   HEADER DETTAGLIO
========================================================= */

function detailHeader(title, data) {

    return `

        <a
            class="back-button"
            href="?state=${encodeURIComponent(data.id)}"
        >
            ← ${data.title}
        </a>

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
   CALCOLATORI
========================================================= */

function renderCalculator(id, title, data) {

    let calculatorHTML = "";


    switch (id) {

        case "dose":

            calculatorHTML =
                renderDoseCalculator();

            break;


        case "diluizioni":

            calculatorHTML =
                renderDilutionCalculator();

            break;


        case "ml-h":

            calculatorHTML =
                renderMlHCalculator();

            break;


        case "gocce-min":

            calculatorHTML =
                renderDropsCalculator();

            break;


        case "durata-infusione":

            calculatorHTML =
                renderDurationCalculator();

            break;


        default:

            calculatorHTML = `
                <p>
                    Calcolatore non disponibile.
                </p>
            `;

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


/* =========================================================
   DOSE
========================================================= */

function renderDoseCalculator() {

    return `

        <div class="calculator">

            <h3>
                Dose da somministrare
            </h3>

            <p>
                Formula:
                dose prescritta ÷ concentrazione
            </p>

            <label>
                Dose prescritta
                <input
                    id="dose-prescribed"
                    type="number"
                    step="any"
                >
            </label>

            <label>
                Concentrazione disponibile
                <input
                    id="dose-concentration"
                    type="number"
                    step="any"
                >
            </label>

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
   DILUIZIONE
========================================================= */

function renderDilutionCalculator() {

    return `

        <div class="calculator">

            <h3>
                Diluizione — C₁ × V₁ = C₂ × V₂
            </h3>

            <label>
                C₁
                <input
                    id="c1"
                    type="number"
                    step="any"
                >
            </label>

            <label>
                V₁
                <input
                    id="v1"
                    type="number"
                    step="any"
                >
            </label>

            <label>
                C₂
                <input
                    id="c2"
                    type="number"
                    step="any"
                >
            </label>

            <p>
                Inserisci tre valori per calcolare
                il quarto.
            </p>

            <button id="calculate-dilution">
                Calcola
            </button>

            <div
                id="dilution-result"
                class="calculator-result"
            ></div>

        </div>

    `;

}


/* =========================================================
   ML/H
========================================================= */

function renderMlHCalculator() {

    return `

        <div class="calculator">

            <h3>
                Velocità di infusione — mL/h
            </h3>

            <label>
                Volume (mL)
                <input
                    id="infusion-volume"
                    type="number"
                    step="any"
                >
            </label>

            <label>
                Tempo (ore)
                <input
                    id="infusion-hours"
                    type="number"
                    step="any"
                >
            </label>

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
   GOCCE/MIN
========================================================= */

function renderDropsCalculator() {

    return `

        <div class="calculator">

            <h3>
                Velocità — gocce/min
            </h3>

            <label>
                Volume (mL)
                <input
                    id="drops-volume"
                    type="number"
                    step="any"
                >
            </label>

            <label>
                Fattore gocce (gocce/mL)
                <input
                    id="drop-factor"
                    type="number"
                    step="any"
                >
            </label>

            <label>
                Tempo (minuti)
                <input
                    id="drops-time"
                    type="number"
                    step="any"
                >
            </label>

            <button id="calculate-drops">
                Calcola
            </button>

            <div
                id="drops-result"
                class="calculator-result"
            ></div>

        </div>

    `;

}


/* =========================================================
   DURATA
========================================================= */

function renderDurationCalculator() {

    return `

        <div class="calculator">

            <h3>
                Durata dell'infusione
            </h3>

            <label>
                Volume (mL)
                <input
                    id="duration-volume"
                    type="number"
                    step="any"
                >
            </label>

            <label>
                Velocità (mL/h)
                <input
                    id="duration-rate"
                    type="number"
                    step="any"
                >
            </label>

            <button id="calculate-duration">
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
   EVENTOS DOS CALCULADORES
========================================================= */

function attachCalculatorEvents(id) {

    if (id === "dose") {

        document
            .getElementById("calculate-dose")
            ?.addEventListener("click", () => {

                const dose =
                    Number(
                        document.getElementById(
                            "dose-prescribed"
                        ).value
                    );

                const concentration =
                    Number(
                        document.getElementById(
                            "dose-concentration"
                        ).value
                    );


                if (
                    !dose ||
                    !concentration ||
                    dose < 0 ||
                    concentration <= 0
                ) {

                    showResult(
                        "dose-result",
                        "Controlla i valori inseriti."
                    );

                    return;

                }


                const result =
                    dose / concentration;


                showResult(
                    "dose-result",
                    `Risultato: ${formatNumber(result)}`
                );

            });

    }


    if (id === "diluizioni") {

        document
            .getElementById("calculate-dilution")
            ?.addEventListener("click", () => {

                const c1 =
                    Number(
                        document.getElementById("c1").value
                    );

                const v1 =
                    Number(
                        document.getElementById("v1").value
                    );

                const c2 =
                    Number(
                        document.getElementById("c2").value
                    );


                if (
                    !c1 ||
                    !v1 ||
                    !c2 ||
                    c1 <= 0 ||
                    v1 <= 0 ||
                    c2 <= 0
                ) {

                    showResult(
                        "dilution-result",
                        "Inserisci C₁, V₁ e C₂."
                    );

                    return;

                }


                const v2 =
                    (c1 * v1) / c2;


                showResult(
                    "dilution-result",
                    `V₂ = ${formatNumber(v2)}`
                );

            });

    }


    if (id === "ml-h") {

        document
            .getElementById("calculate-mlh")
            ?.addEventListener("click", () => {

                const volume =
                    Number(
                        document.getElementById(
                            "infusion-volume"
                        ).value
                    );

                const hours =
                    Number(
                        document.getElementById(
                            "infusion-hours"
                        ).value
                    );


                if (
                    volume <= 0 ||
                    hours <= 0
                ) {

                    showResult(
                        "mlh-result",
                        "Controlla i valori inseriti."
                    );

                    return;

                }


                const result =
                    volume / hours;


                showResult(
                    "mlh-result",
                    `Velocità = ${formatNumber(result)} mL/h`
                );

            });

    }


    if (id === "gocce-min") {

        document
            .getElementById("calculate-drops")
            ?.addEventListener("click", () => {

                const volume =
                    Number(
                        document.getElementById(
                            "drops-volume"
                        ).value
                    );

                const factor =
                    Number(
                        document.getElementById(
                            "drop-factor"
                        ).value
                    );

                const time =
                    Number(
                        document.getElementById(
                            "drops-time"
                        ).value
                    );


                if (
                    volume <= 0 ||
                    factor <= 0 ||
                    time <= 0
                ) {

                    showResult(
                        "drops-result",
                        "Controlla i valori inseriti."
                    );

                    return;

                }


                const result =
                    (volume * factor) / time;


                showResult(
                    "drops-result",
                    `Velocità = ${formatNumber(result)} gocce/min`
                );

            });

    }


    if (id === "durata-infusione") {

        document
            .getElementById("calculate-duration")
            ?.addEventListener("click", () => {

                const volume =
                    Number(
                        document.getElementById(
                            "duration-volume"
                        ).value
                    );

                const rate =
                    Number(
                        document.getElementById(
                            "duration-rate"
                        ).value
                    );


                if (
                    volume <= 0 ||
                    rate <= 0
                ) {

                    showResult(
                        "duration-result",
                        "Controlla i valori inseriti."
                    );

                    return;

                }


                const hours =
                    volume / rate;


                showResult(
                    "duration-result",
                    `Durata = ${formatNumber(hours)} ore`
                );

            });

    }

}


/* =========================================================
   RISULTATO
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

loadCategories();

loadState();


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
