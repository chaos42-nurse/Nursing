// Coerenza dei metadati dell'archivio interazioni (node scripts/test_interazioni_meta.mjs)
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const meta = JSON.parse(readFileSync(path.join(radice, "data/interazioni-meta.json"), "utf-8"));
let ok = 0;
const prova = (nome, fn) => { fn(); ok++; console.log("✓ " + nome); };

prova("date presenti e in formato AAAA-MM-GG", () => {
    for (const k of ["last_checked", "last_updated", "dataset_date"]) {
        assert.match(String(meta[k]), /^\d{4}-\d{2}-\d{2}$/, k);
        assert.ok(!Number.isNaN(new Date(meta[k]).getTime()), k);
    }
    assert.ok(meta.last_checked >= meta.last_updated, "il controllo non puo' precedere l'aggiornamento");
});

prova("l'impronta dello ZIP corrisponde al file: se lo ZIP cambia va rieseguito aggiorna_interazioni.py", () => {
    const hash = createHash("sha256").update(readFileSync(path.join(radice, "data/db_drug_interactions.csv.zip"))).digest("hex");
    assert.equal(meta.zip_sha256, hash);
});

prova("il numero di interazioni corrisponde al CSV generato", () => {
    const righe = readFileSync(path.join(radice, "data/interazioni.csv"), "utf-8").split("\n").filter(Boolean).length - 1;
    assert.equal(meta.records, righe);
});

console.log(`\n${ok} controlli superati`);
