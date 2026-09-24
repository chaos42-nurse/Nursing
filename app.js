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
   FORMATTA NUMERI
========================================================= */

function formatNumber(number) {

    if (!Number.isFinite(number)) {
        return "—";
    }

    return number.toLocaleString(
        "it-IT",
        {
            maximumFractionDigits: 6
        }
    );
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

            <h3>
                Diluizioni
            </h3>

            ${calculatorNote()}


            <p>
                Formula:
                <strong>C₁ × V₁ = C₂ × V₂</strong>
            </p>


            <div class="calculate-choice">

                <strong>
                    Cosa vuoi calcolare?
                </strong>


                <label class="radio-option">

                    <input
                        type="radio"
                        name="dilution-target"
                        value="c1"
                    >

                    C₁

                </label>


                <label class="radio-option">

                    <input
                        type="radio"
                        name="dilution-target"
                        value="v1"
                    >

                    V₁

                </label>


                <label class="radio-option">

                    <input
                        type="radio"
                        name="dilution-target"
                        value="c2"
                    >

                    C₂

                </label>


                <label class="radio-option">

                    <input
                        type="radio"
                        name="dilution-target"
                        value="v2"
                        checked
                    >

                    V₂

                </label>

            </div>


            <!-- C1 -->

            <div class="calculator-row">

                ${numberInput(
                    "c1-value",
                    "C₁ — quantità",
                    "es. 500"
                )}

                ${unitSelect(
                    "c1-weight-unit",
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
                    "c1-volume",
                    "C₁ — volume",
                    "es. 10"
                )}

                ${unitSelect(
                    "c1-volume-unit",
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


            <!-- V1 -->

            <div class="calculator-row">

                ${numberInput(
                    "v1",
                    "V₁",
                    "es. 2"
                )}

                ${unitSelect(
                    "v1-unit",
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


            <!-- C2 -->

            <div class="calculator-row">

                ${numberInput(
                    "c2-value",
                    "C₂ — quantità",
                    "es. 50"
                )}

                ${unitSelect(
                    "c2-weight-unit",
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
                    "c2-volume",
                    "C₂ — volume",
                    "es. 10"
                )}

                ${unitSelect(
                    "c2-volume-unit",
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


            <!-- V2 -->

            <div class="calculator-row">

                ${numberInput(
                    "v2",
                    "V₂",
                    "es. 10"
                )}

                ${unitSelect(
                    "v2-unit",
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
   GOCCE / MINUTO
========================================================= */

function renderDropsCalculator() {

    return `

        <div class="calculator">

            <h3>
                Gocce/min e durata
            </h3>

            ${calculatorNote()}


            <div class="calculator-row">

                ${numberInput(
                    "drops-volume",
                    "Volume",
                    "es. 0,5"
                )}

                ${unitSelect(
                    "drops-volume-unit",
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


            <div class="calculate-choice">

                <strong>
                    Cosa vuoi calcolare?
                </strong>


                <label class="radio-option">

                    <input
                        type="radio"
                        name="drops-target"
                        value="rate"
                        checked
                    >

                    Gocce/min

                </label>


                <label class="radio-option">

                    <input
                        type="radio"
                        name="drops-target"
                        value="duration"
                    >

                    Durata

                </label>


                <label class="radio-option">

                    <input
                        type="radio"
                        name="drops-target"
                        value="factor"
                    >

                    Fattore di gocciolamento

                </label>

            </div>


            <div id="drops-fields"></div>


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
   DURATA INFUSIONE
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
                    "Velocità",
                    "es. 100"
                )}

                ${unitSelect(
                    "duration-rate-unit",
                    [
                        {
                            value: "mL/h",
                            label: "mL/h"
                        },
                        {
                            value: "L/h",
                            label: "L/h"
                        },
                        {
                            value: "mL/min",
                            label: "mL/min"
                        }
                    ]
                )}

            </div>


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
   EVENTI CALCOLATORI
========================================================= */

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

        document
            .getElementById("calculate-dilution")
            ?.addEventListener(
                "click",
                () => {


                    const target =
                        document.querySelector(
                            'input[name="dilution-target"]:checked'
                        )?.value;


                    /* -------------------------------------
                       C1
                    ------------------------------------- */

                    const c1Quantity =
                        parseItalianNumber(
                            document.getElementById(
                                "c1-value"
                            ).value
                        );


                    const c1WeightUnit =
                        document.getElementById(
                            "c1-weight-unit"
                        ).value;


                    const c1Volume =
                        parseItalianNumber(
                            document.getElementById(
                                "c1-volume"
                            ).value
                        );


                    const c1VolumeUnit =
                        document.getElementById(
                            "c1-volume-unit"
                        ).value;


                    /* -------------------------------------
                       V1
                    ------------------------------------- */

                    const v1 =
                        parseItalianNumber(
                            document.getElementById(
                                "v1"
                            ).value
                        );


                    const v1Unit =
                        document.getElementById(
                            "v1-unit"
                        ).value;


                    /* -------------------------------------
                       C2
                    ------------------------------------- */

                    const c2Quantity =
                        parseItalianNumber(
                            document.getElementById(
                                "c2-value"
                            ).value
                        );


                    const c2WeightUnit =
                        document.getElementById(
                            "c2-weight-unit"
                        ).value;


                    const c2Volume =
                        parseItalianNumber(
                            document.getElementById(
                                "c2-volume"
                            ).value
                        );


                    const c2VolumeUnit =
                        document.getElementById(
                            "c2-volume-unit"
                        ).value;


                    /* -------------------------------------
                       V2
                    ------------------------------------- */

                    const v2 =
                        parseItalianNumber(
                            document.getElementById(
                                "v2"
                            ).value
                        );


                    const v2Unit =
                        document.getElementById(
                            "v2-unit"
                        ).value;


                    /* -------------------------------------
                       CONVERSIONE C1
                    ------------------------------------- */

                    const c1 =
                        concentrationToMgMl(
                            c1Quantity,
                            c1WeightUnit,
                            c1Volume,
                            c1VolumeUnit
                        );


                    /* -------------------------------------
                       CONVERSIONE C2
                    ------------------------------------- */

                    const c2 =
                        concentrationToMgMl(
                            c2Quantity,
                            c2WeightUnit,
                            c2Volume,
                            c2VolumeUnit
                        );


                    let result;


                    /* -------------------------------------
                       CALCOLO C1
                    ------------------------------------- */

                    if (target === "c1") {

                        if (
                            !Number.isFinite(c2) ||
                            !Number.isFinite(v1) ||
                            !Number.isFinite(v2) ||
                            v1 <= 0 ||
                            v2 <= 0
                        ) {

                            showResult(
                                "dilution-result",
                                "Per calcolare C₁ servono C₂, V₁ e V₂ validi."
                            );

                            return;
                        }


                        const v1Ml =
                            volumeToMl(
                                v1,
                                v1Unit
                            );


                        const v2Ml =
                            volumeToMl(
                                v2,
                                v2Unit
                            );


                        result =
                            (
                                c2 *
                                v2Ml
                            ) /
                            v1Ml;


                        const output =
                            mgMlToSelectedConcentration(
                                result,
                                c1WeightUnit,
                                c1VolumeUnit
                            );


                        showResult(
                            "dilution-result",
                            `C₁ = ${formatNumber(
                                output
                            )} ${c1WeightUnit}/${c1VolumeUnit}`
                        );


                        return;
                    }


                    /* -------------------------------------
                       CALCOLO V1
                    ------------------------------------- */

                    if (target === "v1") {

                        if (
                            !Number.isFinite(c1) ||
                            !Number.isFinite(c2) ||
                            !Number.isFinite(v2) ||
                            c1 <= 0 ||
                            c2 <= 0 ||
                            v2 <= 0
                        ) {

                            showResult(
                                "dilution-result",
                                "Per calcolare V₁ servono C₁, C₂ e V₂ validi."
                            );

                            return;
                        }


                        const v2Ml =
                            volumeToMl(
                                v2,
                                v2Unit
                            );


                        const resultMl =
                            (
                                c2 *
                                v2Ml
                            ) /
                            c1;


                        let output;


                        if (v1Unit === "L") {

                            output =
                                resultMl / 1000;

                        } else {

                            output =
                                resultMl;

                        }


                        showResult(
                            "dilution-result",
                            `V₁ = ${formatNumber(
                                output
                            )} ${v1Unit}`
                        );


                        return;
                    }


                    /* -------------------------------------
                       CALCOLO C2
                    ------------------------------------- */

                    if (target === "c2") {

                        if (
                            !Number.isFinite(c1) ||
                            !Number.isFinite(v1) ||
                            !Number.isFinite(v2) ||
                            v1 <= 0 ||
                            v2 <= 0
                        ) {

                            showResult(
                                "dilution-result",
                                "Per calcolare C₂ servono C₁, V₁ e V₂ validi."
                            );

                            return;
                        }


                        const v1Ml =
                            volumeToMl(
                                v1,
                                v1Unit
                            );


                        const v2Ml =
                            volumeToMl(
                                v2,
                                v2Unit
                            );


                        result =
                            (
                                c1 *
                                v1Ml
                            ) /
                            v2Ml;


                        const output =
                            mgMlToSelectedConcentration(
                                result,
                                c2WeightUnit,
                                c2VolumeUnit
                            );


                        showResult(
                            "dilution-result",
                            `C₂ = ${formatNumber(
                                output
                            )} ${c2WeightUnit}/${c2VolumeUnit}`
                        );


                        return;
                    }


                    /* -------------------------------------
                       CALCOLO V2
                    ------------------------------------- */

                    if (target === "v2") {

                        if (
                            !Number.isFinite(c1) ||
                            !Number.isFinite(c2) ||
                            !Number.isFinite(v1) ||
                            c1 <= 0 ||
                            c2 <= 0 ||
                            v1 <= 0
                        ) {

                            showResult(
                                "dilution-result",
                                "Per calcolare V₂ servono C₁, V₁ e C₂ validi."
                            );

                            return;
                        }


                        const v1Ml =
                            volumeToMl(
                                v1,
                                v1Unit
                            );


                        const resultMl =
                            (
                                c1 *
                                v1Ml
                            ) /
                            c2;


                        let output;


                        if (v2Unit === "L") {

                            output =
                                resultMl / 1000;

                        } else {

                            output =
                                resultMl;

                        }


                        showResult(
                            "dilution-result",
                            `V₂ = ${formatNumber(
                                output
                            )} ${v2Unit}`
                        );


                        return;
                    }

                }
            );
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
       GOCCE
    ===================================================== */

    if (id === "gocce-min") {

        const targetInputs =
            document.querySelectorAll(
                'input[name="drops-target"]'
            );


        updateDropsFields();


        targetInputs.forEach(input => {

            input.addEventListener(
                "change",
                updateDropsFields
            );

        });


        document
            .getElementById("calculate-drops")
            ?.addEventListener(
                "click",
                calculateDrops
            );
    }


    /* =====================================================
       DURATA INFUSIONE
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


                    let mlPerMinute;


                    switch (rateUnit) {

                        case "mL/h":

                            mlPerMinute =
                                rate / 60;

                            break;


                        case "L/h":

                            mlPerMinute =
                                (rate * 1000) / 60;

                            break;


                        case "mL/min":

                            mlPerMinute =
                                rate;

                            break;

                    }


                    if (
                        !Number.isFinite(
                            mlPerMinute
                        ) ||
                        mlPerMinute <= 0
                    ) {

                        showResult(
                            "duration-result",
                            "Controlla la velocità inserita."
                        );

                        return;
                    }


                    const minutes =
                        volumeMl /
                        mlPerMinute;


                    const hours =
                        minutes / 60;


                    showResult(
                        "duration-result",
                        `Durata: ${formatDuration(
                            minutes
                        )} — ${formatNumber(
                            hours
                        )} ore`
                    );

                }
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
