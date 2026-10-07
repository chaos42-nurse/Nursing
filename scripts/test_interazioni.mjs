// Test del modulo js/interazioni.js sui dati reali dello ZIP.
// Uso:  node scripts/test_interazioni.mjs
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NI = require(path.join(radice, "js/interazioni.js"));

let ok = 0;
const prova = (nome, fn) => {
    return Promise.resolve().then(fn).then(
        () => { ok++; console.log("  ok  " + nome); },
        errore => { console.error("  KO  " + nome + "\n      " + (errore && errore.message)); process.exitCode = 1; }
    );
};

const zip = readFileSync(path.join(radice, "data/db_drug_interactions.csv.zip"));
const alias = JSON.parse(readFileSync(path.join(radice, "data/alias-farmaci.json"), "utf-8"));

/* Parser CSV indipendente (volutamente diverso da quello del modulo). */
function csvIndipendente(testo) {
    const righe = [];
    let riga = [], campo = "", virgolette = false;
    for (let i = 0; i < testo.length; i++) {
        const c = testo[i];
        if (virgolette) {
            if (c === '"' && testo[i + 1] === '"') { campo += '"'; i++; }
            else if (c === '"') virgolette = false;
            else campo += c;
        } else if (c === '"') virgolette = true;
        else if (c === ",") { riga.push(campo); campo = ""; }
        else if (c === "\n") { riga.push(campo); righe.push(riga); riga = []; campo = ""; }
        else campo += c;
    }
    if (campo || riga.length) { riga.push(campo); righe.push(riga); }
    return righe;
}

console.log("Lettura ZIP e indicizzazione…");
let t0 = performance.now();
const testo = await NI.estraiCsvDaZip(zip);
console.log("  ZIP letto in " + Math.round(performance.now() - t0) + " ms (" + testo.length + " caratteri)");

t0 = performance.now();
const idx = await NI.costruisciIndice(testo);
NI.aggiungiAlias(idx, alias);
console.log("  indice pronto in " + Math.round(performance.now() - t0) + " ms");

const dati = csvIndipendente(testo).slice(1).filter(r => r.length >= 3 && r[0]);

await prova("lo ZIP viene decompresso (intestazione e dimensioni attese)", () => {
    assert.ok(testo.startsWith("Drug 1,Drug 2,Interaction Description"));
    assert.equal(dati.length, 191541);
});

await prova("il ripiego JavaScript produce lo stesso testo del decompressore nativo", async () => {
    const nativo = globalThis.DecompressionStream;
    try {
        globalThis.DecompressionStream = undefined;
        const t = await NI.estraiCsvDaZip(zip);
        assert.equal(t.length, testo.length);
        assert.ok(t === testo, "contenuto diverso");
    } finally {
        globalThis.DecompressionStream = nativo;
    }
});

await prova("righe, farmaci e modelli corrispondono al dataset", () => {
    assert.equal(idx.righe, dati.length);
    assert.equal(idx.nomi.length, 1701);
    assert.equal(idx.modelli.length, 86);
});

await prova("tutte le frasi del dataset hanno una traduzione italiana", () => {
    assert.equal(idx.nonTradotti, 0, "modelli senza traduzione: " +
        idx.modelli.filter(m => !m.tradotto).map(m => m.en).join(" | "));
});

await prova("la tabella delle traduzioni non contiene modelli inutilizzati o duplicati", () => {
    const usati = new Set(idx.modelli.map(m => m.en));
    assert.equal(NI.MODELLI.length, 86);
    assert.equal(new Set(NI.MODELLI.map(m => m[0])).size, 86);
    for (const [en] of NI.MODELLI) assert.ok(usati.has(en), "modello non presente nei dati: " + en);
});

await prova("ogni traduzione mantiene gli stessi segnaposto {A}/{B} dell'originale", () => {
    const conta = (s, p) => s.split(p).length - 1;
    for (const [en, it, cat] of NI.MODELLI) {
        for (const p of ["{A}", "{B}"]) {
            assert.equal(conta(it, p), conta(en, p), "segnaposto " + p + " diverso in: " + en);
        }
        assert.ok(["rischio", "attenzione", "nota"].includes(cat), "categoria non valida: " + en);
        assert.notEqual(it, en);
        assert.ok(!/\b(the|may|can|when|which|risk|increase|decrease)\b/i.test(it.replace(/\((CNS depressant)\)/, "")),
            "parole inglesi residue in: " + it);
    }
});

await prova("tutte le 191.541 righe sono ritrovabili con la frase originale corretta", () => {
    for (const [a, b, d] of dati) {
        const ia = idx.idPerNome.get(a), ib = idx.idPerNome.get(b);
        assert.notEqual(ia, undefined, a);
        const r = NI.verificaCoppia(idx, ia, ib);
        assert.ok(r.voci.some(v => v.testoEn === d), "riga non ritrovata: " + a + " / " + b);
        // stesso risultato invertendo l'ordine dei due farmaci
        const inv = NI.verificaCoppia(idx, ib, ia);
        assert.equal(inv.voci.length, r.voci.length);
    }
});

await prova("coppie senza interazione nel dataset restituiscono 'nessuna'", () => {
    const presenti = new Set(dati.map(([a, b]) => a + "\u0000" + b));
    let provate = 0;
    for (let i = 0; i < idx.nNomi && provate < 300; i += 7) {
        const j = (i * 31 + 17) % idx.nNomi;
        if (i === j) continue;
        if (presenti.has(idx.nomi[i] + "\u0000" + idx.nomi[j]) || presenti.has(idx.nomi[j] + "\u0000" + idx.nomi[i])) continue;
        assert.equal(NI.verificaCoppia(idx, i, j).esito, "nessuna");
        provate++;
    }
    assert.ok(provate > 100);
});

await prova("nessun nome del dataset ha una forma normalizzata vuota o ambigua", () => {
    const visti = new Map();
    for (const [id, nome] of idx.nomi.entries()) {
        const n = NI.normalizza(nome);
        assert.ok(n, "nome vuoto dopo la normalizzazione: " + nome);
        assert.ok(!visti.has(n), "nomi ambigui: " + nome + " / " + idx.nomi[visti.get(n)]);
        visti.set(n, id);
    }
});

await prova("ogni voce del dizionario italiano punta a un farmaco esistente e non è ambigua", () => {
    for (const [en, lista] of Object.entries(alias.alias)) {
        assert.ok(idx.idPerNome.has(en), "non presente nello ZIP: " + en);
        assert.ok(lista.length > 0);
        for (const nome of lista) {
            const r = idx.esatti.get(NI.normalizza(nome));
            assert.ok(r && r.length === 1 && r[0] === idx.idPerNome.get(en), "alias ambiguo: " + nome);
        }
    }
});

const id = nome => idx.idPerNome.get(nome);

await prova("riconoscimento di nomi italiani, commerciali e inglesi", () => {
    const esatto = testo => { const r = NI.risolvi(idx, testo); assert.equal(r.tipo, "esatto", testo); return r.id; };
    assert.equal(esatto("paracetamolo"), id("Acetaminophen"));
    assert.equal(esatto("Tachipirina"), id("Acetaminophen"));
    assert.equal(esatto("ACETAMINOPHEN"), id("Acetaminophen"));
    assert.equal(esatto("Acido acetilsalicilico"), id("Acetylsalicylic acid"));
    assert.equal(esatto("  aspirina "), id("Acetylsalicylic acid"));
    assert.equal(esatto("Cloruro di potassio"), id("Potassium chloride"));
    assert.equal(esatto("ceftriaxone"), id("Ceftriaxone"));
    assert.equal(esatto("Adrenalina"), id("Epinephrine"));
});

await prova("i nomi approssimati non vengono accettati in automatico ma proposti", () => {
    const r1 = NI.risolvi(idx, "ceftriax");
    assert.equal(r1.tipo, "candidati");
    assert.equal(r1.candidati[0].id, id("Ceftriaxone"));
    const r2 = NI.risolvi(idx, "doxepina");   // nessun alias: dedotta dal nome inglese "Doxepin"
    assert.equal(r2.tipo, "candidati");
    assert.ok(r2.candidati.some(c => c.id === id("Doxepin")));
    assert.equal(NI.risolvi(idx, "zzzzqq").tipo, "nessuno");
    assert.equal(NI.risolvi(idx, "").tipo, "vuoto");
});

await prova("autocompletamento: forme italiane e nomi parziali vengono suggeriti", () => {
    const primo = (q, nome) => {
        const r = NI.cerca(idx, q, 10);
        assert.ok(r.some(x => x.id === id(nome)), q + " non suggerisce " + nome + ": " + r.map(x => x.label).join(", "));
    };
    primo("aripiprazolo", "Aripiprazole");
    primo("lamotrigina", "Lamotrigine");
    primo("duloxetina", "Duloxetine");
    primo("fenitoina", "Phenytoin");
    primo("ossicodone", "Oxycodone");
    primo("acido acetilsalicilico", "Acetylsalicylic acid");
    primo("valproato", "Valproic acid");
    primo("risedronato", "Risedronic acid");
    primo("magnesio solfato", "Magnesium sulfate");
    primo("calcio gluconato", "Calcium gluconate");
    primo("sevoflurano", "Sevoflurane");
    primo("amoxi", "Amoxicillin");
    primo("tachi", "Acetaminophen");
    assert.equal(NI.cerca(idx, "para", 3)[0].id, id("Acetaminophen"), "i farmaci piu' comuni vengono per primi");
    assert.equal(NI.cerca(idx, "a", 5).length, 0, "meno di 2 lettere: nessun suggerimento");
});

await prova("farmaci non inclusi nel dataset (eparina, insulina) risultano 'nessuno', non 'nessuna interazione'", () => {
    assert.equal(NI.risolvi(idx, "eparina").tipo, "nessuno");
    assert.equal(NI.risolvi(idx, "insulina").tipo, "nessuno");
});

await prova("esempi clinici: warfarin + acido acetilsalicilico, amiodarone + midazolam", () => {
    const r = NI.verificaCoppia(idx, id("Warfarin"), id("Acetylsalicylic acid"));
    assert.equal(r.esito, "rischio");
    console.log("      Warfarin + ASA →", r.voci.map(v => "[" + v.categoria + "] " + v.testoIt).join(" || "));
    const r2 = NI.verificaCoppia(idx, id("Amiodarone"), id("Midazolam"));
    console.log("      Amiodarone + Midazolam →", r2.esito, r2.voci.map(v => v.testoIt).join(" || "));
    const r3 = NI.verificaCoppia(idx, id("Furosemide"), id("Ceftriaxone"));
    console.log("      Furosemide + Ceftriaxone →", r3.esito, r3.voci.map(v => v.testoIt).join(" || "));
});

console.log("\n" + ok + " controlli superati" + (process.exitCode ? " — CI SONO ERRORI" : ""));
