const params = new URLSearchParams(window.location.search);

const state = params.get("state");

const stateTitle = document.getElementById("state");
const content = document.getElementById("content");

if (state === "ecg") {

    stateTitle.textContent = "🫀 ECG MODE";

    content.innerHTML = `
        <h2>Elettrocardiogramma</h2>

        <p>
            Archivio ECG infermieristico.
        </p>

        <h3>Valori principali</h3>

        <ul>
            <li>Frequenza cardiaca</li>
            <li>Intervallo PR</li>
            <li>QRS</li>
            <li>QT / QTc</li>
        </ul>
    `;

} else {

    stateTitle.textContent = "Nessuna modalità selezionata";

    content.innerHTML = `
        <p>
            Scansiona una carta NFC.
        </p>
    `;
}
