const params = new URLSearchParams(
    window.location.search
);

const state = params.get("state");
const item = params.get("item");


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

/* =========================
   HOME
========================= */

backButton.addEventListener("click", () => {

    window.history.back();

});


/* =========================
   CATEGORIE
========================= */

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


/* =========================
   CREA SHORTCUT
========================= */

function createShortcuts(categories) {

    shortcuts.innerHTML = "";

    categories.forEach(category => {

        const link =
            document.createElement("a");

        link.className = "shortcut";

        link.href =
            `?state=${category.id}`;

        link.innerHTML = `

            <span class="shortcut-icon">
                ${category.icon}
            </span>

            <span class="shortcut-text">

                <strong>
                    ${category.title}
                </strong>

                <small>
                    ${category.description}
                </small>

            </span>

        `;

        shortcuts.appendChild(link);

    });

}


/* =========================
   CARICA ARCHIVIO
========================= */

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
                `data/${state}.json`
            );


        if (!response.ok) {

            throw new Error(
                "Archivio non trovato"
            );

        }


        const data =
            await response.json();


        stateTitle.textContent =
            `${data.icon} ${data.title}`;


        description.textContent =
            data.description;


        /*
         * Se è stato selezionato
         * un elemento specifico
         */

        if (item) {

            loadItem(data);

            return;

        }


        /*
         * PAGINA PRINCIPALE
         * DELLA CATEGORIA
         */

        let html = "";


        data.sections.forEach(section => {

            html += `

                <section>

                    <h2>
                        ${section.title}
                    </h2>

                    <div class="item-list">

            `;


            section.items.forEach(sectionItem => {

                /*
                 * Supportiamo sia:
                 *
                 * "Frequenza cardiaca"
                 *
                 * sia:
                 *
                 * {
                 *   "id": "frequenza",
                 *   "title": "Frequenza cardiaca"
                 * }
                 */

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
                        href="?state=${state}&item=${itemId}"
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


            html += `

                    </div>

                </section>

            `;

        });


        content.innerHTML = html;


    }

    catch (error) {

        stateTitle.textContent =
            "❌ Errore";

        description.textContent = "";

        content.innerHTML = `

            <p>

                Non è stato possibile trovare
                l'archivio "${state}".

            </p>

        `;

        console.error(error);

    }

}


/* =========================
   CARICA ELEMENTO
========================= */

function loadItem(data) {

    let selectedItem = null;


    /*
     * Cerca l'elemento
     * dentro tutte le sezioni
     */

    data.sections.forEach(section => {

        section.items.forEach(sectionItem => {

            const itemId =
                typeof sectionItem === "string"
                    ? createId(sectionItem)
                    : sectionItem.id;


            if (itemId === item) {

                selectedItem = sectionItem;

            }

        });

    });


    /*
     * Elemento non trovato
     */

    if (!selectedItem) {

        content.innerHTML = `

            <section>

                <h2>
                    Elemento non trovato
                </h2>

                <a
                    class="back-button"
                    href="?state=${state}"
                >
                    ← Torna indietro
                </a>

            </section>

        `;

        return;

    }


    const title =
        typeof selectedItem === "string"
            ? selectedItem
            : selectedItem.title;


    const text =
        typeof selectedItem === "string"
            ? "Contenuto in preparazione."
            : selectedItem.content;


    content.innerHTML = `

        <section class="detail-page">

            <a
                class="back-button"
                href="?state=${state}"
            >
                ← ${data.title}
            </a>

            <h2>
                ${title}
            </h2>

            <div class="detail-content">

                ${
                    text ||
                    "Contenuto in preparazione."
                }

            </div>

        </section>

    `;

}


/* =========================
   CREA ID
========================= */

function createId(text) {

    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

}


/* =========================
   AVVIO
========================= */

loadCategories();

loadState();


/* =========================
   SERVICE WORKER
========================= */

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
