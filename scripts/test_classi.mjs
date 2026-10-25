// Controlli di coerenza sui dati delle classi farmacologiche (node scripts/test_classi.mjs)
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const leggi = p => JSON.parse(readFileSync(path.join(radice, p), "utf-8"));

const farmaci = leggi("data/farmaci.json");
const tabella = leggi("src/data/atc-classi.json");
const indici = {
    "src/data/aifa-principi-attivi.json": leggi("src/data/aifa-principi-attivi.json"),
    "src/data/farmaci.json": leggi("src/data/farmaci.json")
};

const radiceClassi = farmaci.sections.find(s => s.title === "Classi farmacologiche").items[0];
const classi = radiceClassi.items;
const per = new Map(classi.map(c => [c.id, c]));
const aree = new Set((radiceClassi.areas || []).map(a => a.id));

let ok = 0;
const prova = (nome, fn) => { fn(); ok++; console.log("✓ " + nome); };

prova("id delle classi unici e con titolo", () => {
    assert.equal(per.size, classi.length, "id duplicati");
    for (const c of classi) assert.ok(c.id && c.title && c.content && c.content.class, "classe incompleta: " + c.id);
});

prova("ogni classe ha una macro-area esistente", () => {
    for (const c of classi) assert.ok(aree.has(c.area), `${c.id}: area '${c.area}' inesistente`);
});

prova("regole ATC, eccezioni e indici puntano a classi esistenti", () => {
    for (const r of tabella.regole) assert.ok(per.has(r.id), `regola ${r.atc} -> ${r.id}`);
    for (const [nome, id] of Object.entries(tabella.eccezioni)) assert.ok(per.has(id), `eccezione ${nome} -> ${id}`);
    for (const [file, lista] of Object.entries(indici)) {
        for (const f of lista) {
            // un principio attivo nuovo senza classe e' ammesso (resta nel catalogo AIFA): conta solo che non punti a una classe inesistente
            if (!f.classeId) continue;
            assert.ok(per.has(f.classeId), `${file}: ${f.principioAttivo} -> ${f.classeId}`);
            if (tabella.classi[f.classeId]) {
                assert.equal(f.classeNome, tabella.classi[f.classeId], `${file}: nome classe incoerente per ${f.principioAttivo}`);
            }
        }
    }
});

prova("nessun farmaco (indice, regole, eccezioni) indirizza alla classe Antagonisti", () => {
    assert.ok(per.has("antagonisti"));
    assert.ok(!tabella.regole.some(r => r.id === "antagonisti"));
    assert.ok(!Object.values(tabella.eccezioni).includes("antagonisti"));
    for (const lista of Object.values(indici)) assert.ok(!lista.some(f => f.classeId === "antagonisti"));
});

prova("alias delle classi unite: unici e senza collisioni con id attuali", () => {
    const visti = new Set();
    for (const c of classi) {
        for (const vecchio of c.aliasIds || []) {
            assert.ok(!per.has(vecchio), `alias ${vecchio} coincide con una classe esistente`);
            assert.ok(!visti.has(vecchio), `alias duplicato: ${vecchio}`);
            visti.add(vecchio);
        }
    }
});

prova("liste di testo senza caratteri HTML (le liste sono inserite senza escape)", () => {
    for (const c of classi) {
        for (const campo of ["effects", "indications", "monitoring", "contraindications", "adverseEffects", "routes", "nursingNotes"]) {
            const lista = c.content[campo];
            if (lista === undefined) continue;
            assert.ok(Array.isArray(lista) && lista.every(v => typeof v === "string" && v.trim()), `${c.id}.${campo} non valido`);
            for (const v of lista) assert.ok(!/[<>&]/.test(v), `${c.id}.${campo}: carattere HTML in "${v}"`);
        }
    }
});

prova("tabella Antagonisti: righe complete e farmaci che risolvono su un'altra classe", () => {
    const tab = per.get("antagonisti").content.table;
    assert.ok(tab && tab.rows.length > 0);
    const norm = t => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
    const regole = tabella.regole.slice().sort((a, b) => b.atc.length - a.atc.length);
    for (const r of tab.rows) {
        assert.ok(r.compound && r.drug && r.action, "riga incompleta: " + JSON.stringify(r));
        const chiave = norm(r.drug);
        const noto = indici["src/data/aifa-principi-attivi.json"].find(e => norm(e.principioAttivo) === chiave && e.classeId !== "antagonisti");
        const regola = r.atc && regole.find(x => r.atc.toUpperCase().startsWith(x.atc));
        const id = (noto && noto.classeId) || tabella.eccezioni[chiave] || (regola && regola.id);
        assert.ok(id && id !== "antagonisti" && per.has(id), `${r.drug}: nessuna classe di destinazione`);
    }
});

prova("categorie e file dell'app coerenti (ogni categoria ha il suo JSON)", () => {
    for (const cat of leggi("data/categories.json")) {
        if (cat.route) continue;
        assert.doesNotThrow(() => leggi(`data/${cat.id}.json`), cat.id);
    }
});

console.log(`\n${ok} controlli superati`);
