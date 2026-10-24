// Test del modulo js/terapia-paziente.js (node scripts/test_terapia_paziente.mjs)
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const T = createRequire(import.meta.url)(path.join(radice, "js/terapia-paziente.js"));
const alias = T.creaIndiceAlias(JSON.parse(readFileSync(path.join(radice, "data/alias-farmaci.json"), "utf-8")));
const aifa = T.creaIndiceAifa(JSON.parse(readFileSync(path.join(radice, "src/data/aifa-principi-attivi.json"), "utf-8")));
const controlla = (allergie, farmaci) => T.controllaAllergie({ allergie, farmaci, alias, aifa });
const sintesi = r => r.avvisi.map(a => `${a.farmaco}>${a.gruppo}:${a.tipo}`);

let ok = 0;
const prova = (nome, fn) => { fn(); ok++; console.log("✓ " + nome); };

prova("separaElenco divide per virgola, punto e virgola e a capo", () => {
    assert.deepEqual(T.separaElenco("Amoxicillina 500 mg, Ibuprofene\nFurosemide; "), ["Amoxicillina 500 mg", "Ibuprofene", "Furosemide"]);
    assert.deepEqual(T.separaElenco(""), []);
    assert.deepEqual(T.separaElenco("12, 3"), []);
});

prova("nomeFarmaco toglie dosi e frequenze", () => {
    const casi = {
        "Furosemide 25 mg 1 cp x2": "Furosemide",
        "2 cpr di Tachipirina": "Tachipirina",
        "Cardioaspirina 100mg": "Cardioaspirina",
        "Amoxicillina + acido clavulanico 875/125 mg": "Amoxicillina + acido clavulanico",
        "Eparina calcica 5000 UI": "Eparina calcica",
        "Paracetamolo 1 g se febbre": "Paracetamolo",
        "NaCl 0,9% 500 ml": "NaCl",
        "Insulina glargine 20 UI": "Insulina glargine"
    };
    for (const [entrata, atteso] of Object.entries(casi)) assert.equal(T.nomeFarmaco(entrata), atteso, entrata);
});

prova("penicillina: avviso per Augmentin come stessa classe", () => {
    assert.deepEqual(sintesi(controlla("Penicillina", "Augmentin 1 g, Furosemide 25 mg")), ["Augmentin 1 g>Penicilline:classe"]);
});

prova("allergia dichiarata al principio attivo: stesso principio, anche con il nome commerciale", () => {
    assert.deepEqual(sintesi(controlla("Amoxicillina", "Augmentin 1 g")), ["Augmentin 1 g>Penicilline:stesso"]);
});

prova("FANS: ibuprofene si, paracetamolo no", () => {
    assert.deepEqual(sintesi(controlla("FANS", "Ibuprofene 600 mg, Paracetamolo 1 g")), ["Ibuprofene 600 mg>FANS e acido acetilsalicilico:classe"]);
});

prova("aspirina: Cardioaspirina stesso principio, ibuprofene stessa classe", () => {
    assert.deepEqual(sintesi(controlla("Aspirina", "Cardioaspirina 100 mg, Ibuprofene")), [
        "Cardioaspirina 100 mg>FANS e acido acetilsalicilico:stesso",
        "Ibuprofene>FANS e acido acetilsalicilico:classe"
    ]);
});

prova("betalattamici: penicilline e cefalosporine, non altri antibiotici", () => {
    const r = sintesi(controlla("allergia ai betalattamici", "Ceftriaxone 2 g, Amoxicillina, Azitromicina"));
    assert.deepEqual(r.sort(), ["Amoxicillina>Penicilline:classe", "Ceftriaxone 2 g>Cefalosporine:classe"]);
});

prova("allergie non farmacologiche restano non collegate", () => {
    const r = controlla("Lattice, polvere", "Amoxicillina");
    assert.deepEqual(r.avvisi, []);
    assert.deepEqual(r.nonCollegate, ["Lattice", "polvere"]);
});

prova("nessun falso allarme: sulfamidici non segnalano furosemide", () => {
    assert.deepEqual(controlla("Sulfamidici", "Furosemide 25 mg, Ramipril").avvisi, []);
});

prova("codeina: oppioidi in terapia segnalati", () => {
    assert.deepEqual(sintesi(controlla("Codeina", "Morfina 10 mg, Tramadolo, Paracetamolo")).sort(),
        ["Morfina 10 mg>Oppioidi:classe", "Tramadolo>Oppioidi:classe"]);
});

prova("campi vuoti non danno errori", () => {
    const r = controlla("", "");
    assert.deepEqual([r.avvisi.length, r.nonCollegate.length], [0, 0]);
});

// ---- interazioni sulla terapia del paziente (dati reali) ----
const NI = createRequire(import.meta.url)(path.join(radice, "js/interazioni.js"));
console.log("Indicizzazione archivio interazioni…");
const idx = await NI.costruisciIndice(await NI.estraiCsvDaZip(readFileSync(path.join(radice, "data/db_drug_interactions.csv.zip"))));
NI.aggiungiAlias(idx, JSON.parse(readFileSync(path.join(radice, "data/alias-farmaci.json"), "utf-8")));
NI.aggiungiCurate(idx, JSON.parse(readFileSync(path.join(radice, "data/interazioni-curate.json"), "utf-8")));

prova("interazioni: coppie con segnalazioni ordinate per gravita', farmaci non riconosciuti a parte", () => {
    const r = T.controllaInterazioni(NI, idx, "Warfarin 5 mg, Ibuprofene 600 mg, Furosemide 25 mg, Xyzfarmaco 10 mg");
    assert.equal(r.riconosciuti.length, 3);
    assert.equal(r.nCoppie, 3);
    assert.ok(r.coppie.length >= 1, "attesa almeno una segnalazione warfarin/ibuprofene");
    assert.ok(r.coppie.some(c => /warfarin/i.test(c.nomeA + c.nomeB) && /ibuprofen/i.test(c.nomeA + c.nomeB)));
    assert.deepEqual(r.nonRiconosciuti.map(n => n.voce), ["Xyzfarmaco 10 mg"]);
    const ordine = { rischio: 0, attenzione: 1, nota: 2 };
    for (let i = 1; i < r.coppie.length; i++) assert.ok(ordine[r.coppie[i - 1].categoria] <= ordine[r.coppie[i].categoria]);
});

prova("interazioni: una sola voce o elenco vuoto non produce coppie", () => {
    assert.equal(T.controllaInterazioni(NI, idx, "Warfarin").nCoppie, 0);
    assert.equal(T.controllaInterazioni(NI, idx, "").coppie.length, 0);
});

prova("interazioni: i componenti dello stesso preparato non vengono confrontati tra loro", () => {
    const r = T.controllaInterazioni(NI, idx, "Amoxicillina + acido clavulanico 875/125 mg");
    assert.equal(r.nCoppie, 0);
});

console.log(`\n${ok} test superati`);
