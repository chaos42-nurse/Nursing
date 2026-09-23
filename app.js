const params = new URLSearchParams(window.location.search);

const state = params.get("state");

const stateTitle = document.getElementById("state");
const content = document.getElementById("content");

async function loadState() {

    if (!state) {

        stateTitle.textContent = "🩺 Nursing NFC";

        content.innerHTML = `
            <p>Scansiona una carta NFC per iniziare.</p>
        `;

        return;
    }

    try {

        const response = await fetch(`data/${state}.json`);

        if (!response.ok) {
            throw new Error("Archivio non trovato");
        }

        const data = await response.json();

        stateTitle.textContent = `${data.icon} ${data.title}`;

        let html = `<p>${data.description}</p>`;

        data.sections.forEach(section => {

            html += `
                <section>
                    <h2>${section.title}</h2>

                    <ul>
            `;

            section.items.forEach(item => {

                html += `<li>${item}</li>`;

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

loadState();
if ("serviceWorker" in navigator) {

    window.addEventListener("load", () => {

        navigator.serviceWorker.register("./service-worker.js")
            .then(() => {
                console.log("Service Worker attivo");
            })
            .catch(error => {
                console.error("Errore Service Worker:", error);
            });

    });

}
