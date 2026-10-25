// Imposta un'unica versione per cache del service worker e file con ?v=... in index.html.
// Usato dal workflow di deploy (non serve piu' aggiornare i numeri a mano prima di ogni pubblicazione).
//   node scripts/imposta-versione.mjs 202610241503 [cartella]
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const versione = process.argv[2];
const cartella = path.resolve(process.argv[3] || ".");

if (!/^\d{1,14}$/.test(versione || "")) {
    console.error("Uso: node scripts/imposta-versione.mjs <numero> [cartella]");
    process.exit(1);
}

function sostituisci(file, regole) {
    const percorso = path.join(cartella, file);
    let testo = readFileSync(percorso, "utf-8");
    for (const [regex, nuovo, minimo] of regole) {
        const trovate = (testo.match(regex) || []).length;
        if (trovate < minimo) throw new Error(`${file}: attesa almeno ${minimo} corrispondenza per ${regex}, trovate ${trovate}`);
        testo = testo.replace(regex, nuovo);
    }
    writeFileSync(percorso, testo, "utf-8");
}

sostituisci("index.html", [[/(\.(?:js|css)\?v=)\d+/g, `$1${versione}`, 1]]);
sostituisci("service-worker.js", [
    [/(CACHE_NAME = "nursing-v)\d+(")/, `$1${versione}$2`, 1],
    [/(\.(?:js|css)\?v=)\d+/g, `$1${versione}`, 1]
]);
console.log(`Versione impostata: ${versione}`);
