const params = new URLSearchParams(window.location.search);

const state = params.get("state");

const stateTitle = document.getElementById("state");
const content = document.getElementById("content");
const shortcuts = document.getElementById("shortcuts");


/* =========================
   CATEGORIE
========================= */

const categories = [
    {
        id: "ecg",
        icon: "🫀",
        title: "ECG",
        description: "Elettrocardiogramma"
    },

    {
        id: "farmaci",
        icon: "💊",
        title: "Farmaci",
        description: "Farmacologia"
    },

    {
        id: "laboratorio",
        icon: "🧪",
        title: "Laboratorio",
        description: "Esami e provette"
    },

    {
        id: "emergenze",
        icon: "🚨",
        title: "Emergenze",
        description: "Gestione delle emergenze"
    }
];


/* =========================
   CREA SHORTCUT
========================= */

function createShortcuts() {

    shortcuts.innerHTML = "";

    categories.forEach(category => {

        const button = document.createElement("button");

        button.className = "shortcut";

        button.innerHTML = `
            <span class="shortcut-icon">
                ${category.icon}
            </span>

            <span class="shortcut-text">
                <strong>${category.title}</strong>
                <small>${category.description}</small>
            </span>
        `;

        button.addEventListener("click", () => {

            window.location.href = `?state=${category.id}`;

        });

        shortcuts.appendChild(button);

    });
}


/* =========================
   CARICA ARCHIVIO
========================= */

async function loadState() {

    if (!state) {

        stateTitle.textContent = "";

        content.innerHTML = `
            <p class="welcome">
                Seleziona un archivio oppure
                scansiona una carta NFC.
            </p>
        `;

        return;
    }


    try {

        const response = await fetch(`data/${state}.json`);

        if (!response.ok) {
            throw new Error("Archivio non trovato");
        }

        const data = await response.json();


        stateTitle.textContent =
            `${data.icon} ${data.title}`;


        let html = `
            <p>${data.description}</p>
        `;


        data.sections.forEach(section => {

            html += `
                <section>

                    <h2>${section.title}</h2>

                    <ul>
            `;


            section.items.forEach(item => {

                html += `
                    <li>${item}</li>
                `;

            });


            html += `
                    </ul>

                </section>
            `;

        });


        content.innerHTML = html;


    } catch (error) {

        stateTitle.textContent = "❌ Errore";

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
   AVVIO
========================= */

createShortcuts();

loadState();


/* =========================
   SERVICE WORKER
========================= */

if ("serviceWorker" in navigator) {

    window.addEventListener("load", () => {

        navigator.serviceWorker.register("./service-worker.js")

            .then(() => {

                console.log("Service Worker attivo");

            })

            .catch(error => {

                console.error(
                    "Errore Service Worker:",
                    error
                );

            });

    });

}
