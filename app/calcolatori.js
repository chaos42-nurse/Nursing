/* =========================================================
   Calcolatori (dose, diluizioni, velocita' di infusione, gocce)
   (script classico caricato prima di app.js: le funzioni sono globali)
========================================================= */
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

    const text = String(value).trim();

    if (!text) {
        return NaN;
    }

    /*
     * Con la virgola: il punto può essere solo separatore delle
     * migliaia, in gruppi esatti da 3 cifre (1.500,25).
     */

    if (text.includes(",")) {

        if (!/^(\d{1,3}(\.\d{3})+|\d+),\d+$/.test(text)) {
            return NaN;
        }

        return Number(text.replace(/\./g, "").replace(",", "."));
    }

    // Solo cifre: 1000
    if (/^\d+$/.test(text)) {
        return Number(text);
    }

    // Raggruppamento delle migliaia: 1.500 / 12.500.000.
    // Un numero che inizia con "0." (es. 0.250) NON può essere un raggruppamento:
    // è un decimale scritto col punto, quindi vale 0,25 e non 250.
    if (/^[1-9]\d{0,2}(\.\d{3})+$/.test(text)) {
        return Number(text.replace(/\./g, ""));
    }

    // Decimale col punto (tastiere con il punto): 1.5, 0.25, 2.75
    if (/^\d+\.\d+$/.test(text)) {
        return Number(text);
    }

    return NaN;
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

                        <option value="mL/h">
                            mL/h
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
                <br>
                Compila due campi: il terzo si calcola da solo.
                Per cambiare un valore basta riscriverlo.

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

    if (String(unit).toLowerCase() === "l") {
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


    function dilutionToMgMl(value, unit) {

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


    function dilutionFromMgMl(value, unit) {

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
            ? dilutionToMgMl(c1Value, c1Unit.value)
            : null;

        const c2MgMl = c2
            ? dilutionToMgMl(c2Value, c2Unit.value)
            : null;


        // Conversione volumi in mL
        const v1Ml = v1
            ? volumeToMl(v1Value, v1Unit.value)
            : null;

        const v2Ml = v2
            ? volumeToMl(v2Value, v2Unit.value)
            : null;


        // Validazione: numeri validi e positivi, unità riconosciute
        const given = [
            [c1, c1MgMl], [c2, c2MgMl], [v1, v1Ml], [v2, v2Ml]
        ].filter(([filledField]) => filledField).map(([, value]) => value);

        if (!given.every(value => Number.isFinite(value) && value > 0)) {

            result.innerHTML = `
                <strong>Controlla i valori inseriti</strong>
                <p>
                    Usa numeri maggiori di zero (es. 2,5 oppure 1.500).
                </p>
            `;

            result.style.display = "block";
            return;
        }


        // CALCOLA C1
        if (!c1) {

            const calculated =
                (c2MgMl * v2Ml) / v1Ml;

            const finalValue =
                dilutionFromMgMl(calculated, c1Unit.value);

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
                v1Unit.value.toLowerCase() === "l"
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
                        ${volumeLabel(v1Unit.value)}
                    </strong>
                </p>
            `;
        }


        // CALCOLA C2
        else if (!c2) {

            const calculated =
                (c1MgMl * v1Ml) / v2Ml;

            const finalValue =
                dilutionFromMgMl(calculated, c2Unit.value);

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
                v2Unit.value.toLowerCase() === "l"
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
                        ${volumeLabel(v2Unit.value)}
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

            case "mL/h":
                return "mL/h";

            default:
                return "";

        }

    }


    /*
     * CALCOLO AUTOMATICO
     */

    /*
     * Logica: contano i DUE campi modificati per ultimi dall'utente;
     * il terzo viene calcolato. Così si può correggere qualunque valore
     * (anche dopo un calcolo) senza dover svuotare i campi a mano.
     */

    const fields = {
        volume: volumeInput,
        duration: durationInput,
        rate: rateInput
    };

    let touched = [];   // ordine di modifica manuale, l'ultimo è il più recente

    const clearResult = () => {
        result.style.display = "none";
        result.innerHTML = "";
    };

    const showMessage = text => {
        result.style.display = "block";
        result.innerHTML = `<strong>${text}</strong>`;
    };

    const readField = name => {
        const raw = fields[name].value.trim();
        if (!raw) return NaN;
        const number = parseItalianNumber(raw);
        return Number.isFinite(number) && number > 0 ? number : NaN;
    };

    function calculateAutomatically() {

        // Un campo svuotato o non più valido esce dai valori "dell'utente".
        touched = touched.filter(name => fields[name].value.trim() !== "");

        if (calculatedField && touched.length < 2) {
            fields[calculatedField].value = "";
            calculatedField = null;
        }

        if (touched.length < 2) {
            clearResult();
            return;
        }

        const [first, second] = touched.slice(-2);
        const target = Object.keys(fields).find(
            name => name !== first && name !== second
        );

        if (Number.isNaN(readField(first)) || Number.isNaN(readField(second))) {

            if (calculatedField) {
                fields[calculatedField].value = "";
                calculatedField = null;
            }

            showMessage("Controlla i valori: usa numeri maggiori di zero (es. 2,5).");
            return;
        }

        const volumeMl = target === "volume" ? null :
            volumeToMl(readField("volume"), volumeUnit.value);

        const durationMin = target === "duration" ? null :
            timeToMinutes(readField("duration"), durationUnit.value);

        let rateMlMin = null;

        if (target !== "rate") {
            const rate = readField("rate");

            if (rateUnit.value.startsWith("gocce-")) {
                rateMlMin = rate / getDropFactor();
            } else if (rateUnit.value === "mL/h") {
                rateMlMin = rate / 60;
            } else {
                rateMlMin = rate;
            }
        }

        let label;
        let text;

        if (target === "volume") {

            const ml = rateMlMin * durationMin;
            const value = volumeUnit.value === "L" ? ml / 1000 : ml;

            volumeInput.value = formatNumber(value);
            label = "Volume calcolato";
            text = `${formatNumber(value)} ${volumeUnit.value}`;

        } else if (target === "duration") {

            const min = volumeMl / rateMlMin;
            const value = durationUnit.value === "h" ? min / 60 : min;

            durationInput.value = formatNumber(value);
            label = "Durata calcolata";
            text = `${formatNumber(value)} ${durationUnit.value === "h" ? "ore" : "min"}`
                + ` (${formatDuration(min)})`;

        } else {

            const mlMin = volumeMl / durationMin;
            let value = mlMin;

            if (rateUnit.value.startsWith("gocce-")) {
                value = mlMin * getDropFactor();
            } else if (rateUnit.value === "mL/h") {
                value = mlMin * 60;
            }

            rateInput.value = formatNumber(value);
            label = "Velocità calcolata";
            text = `${formatNumber(value)} ${getRateLabel()}`
                + (rateUnit.value.startsWith("gocce-")
                    ? ` (${formatNumber(mlMin * 60)} mL/h)`
                    : "");
        }

        calculatedField = target;

        result.style.display = "block";
        result.innerHTML = `${label}: <strong>${text}</strong>`;
    }


    /*
     * INPUT AUTOMATICI
     */

    Object.entries(fields).forEach(([name, input]) => {

        input.addEventListener("input", () => {

            if (calculatedField === name) {
                calculatedField = null;
            }

            touched = touched.filter(item => item !== name);

            if (input.value.trim() !== "") {
                touched.push(name);
            }

            calculateAutomatically();
        });
    });

    [volumeUnit, durationUnit, rateUnit].forEach(select =>
        select.addEventListener("change", calculateAutomatically)
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

    const value = Number(number);

    if (!Number.isFinite(value)) {
        return "—";
    }

    // Sotto 1 si mantengono 3 cifre significative: 0,125 resta 0,125 e
    // 0,005 non diventa 0,01. Da 1 in su bastano 2 decimali.
    const options = Math.abs(value) > 0 && Math.abs(value) < 1
        ? { maximumSignificantDigits: 3 }
        : { maximumFractionDigits: 2 };

    return value.toLocaleString("it-IT", options);

}

function volumeLabel(unit) {
    return String(unit).toLowerCase() === "l" ? "L" : "mL";
}
