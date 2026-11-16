// Decide se il controllo AIFA va eseguito (node scripts/serve_controllo.mjs).
// Usato dalle esecuzioni di recupero (17 e 18 del mese): se il controllo del 16 è già registrato
// in data/version.json non fa nulla. Scrive "needed=true|false" in GITHUB_OUTPUT.
import { readFileSync, appendFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const versione = JSON.parse(readFileSync(path.join(radice, "data/version.json"), "utf-8"));

const adesso = new Date();
const anno = adesso.getUTCFullYear();
const mese = String(adesso.getUTCMonth() + 1).padStart(2, "0");
const soglia = `${anno}-${mese}-16`; // ISO: il confronto tra stringhe vale come confronto tra date
const serve = !versione.last_checked || versione.last_checked < soglia;

console.log(serve
    ? `Ultimo controllo ${versione.last_checked}: precedente al ${soglia}, eseguo il recupero.`
    : `Ultimo controllo ${versione.last_checked}: già registrato per questo mese, niente da fare.`);

if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `needed=${serve}\n`);
