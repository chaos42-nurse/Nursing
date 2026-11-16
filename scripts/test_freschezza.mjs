// Fallisce se il controllo mensile dei principi attivi AIFA non è stato registrato da troppo tempo
// (node scripts/test_freschezza.mjs). Il controllo avviene il 16 di ogni mese: oltre 35 giorni = saltato.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const versione = JSON.parse(readFileSync(path.join(radice, "data/version.json"), "utf-8"));

const MAX_GIORNI = 35;
const ultimo = new Date(versione.last_checked + "T00:00:00Z");
if (Number.isNaN(ultimo.getTime())) {
    console.error("✗ data/version.json: last_checked mancante o non valido");
    process.exit(1);
}

const giorni = Math.floor((Date.now() - ultimo.getTime()) / 86400000);
if (giorni > MAX_GIORNI) {
    console.error(`✗ Ultimo controllo AIFA: ${versione.last_checked} (${giorni} giorni fa, limite ${MAX_GIORNI}). Il controllo mensile non è stato eseguito.`);
    process.exit(1);
}
console.log(`✓ Ultimo controllo AIFA: ${versione.last_checked} (${giorni} giorni fa)`);
