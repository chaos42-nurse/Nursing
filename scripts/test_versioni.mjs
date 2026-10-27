// Controlla che index.html e service-worker.js facciano riferimento agli stessi file e versioni.
import { readFileSync, existsSync } from "node:fs";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(path.join(radice, "index.html"), "utf-8");
const sw = readFileSync(path.join(radice, "service-worker.js"), "utf-8");

const locali = [...html.matchAll(/(?:src|href)="\.\/([^"#]+)"/g)].map(m => m[1])
    .filter(p => /\.(js|css)(\?v=\d+)?$/.test(p));
const precache = new Set([...sw.matchAll(/"\.\/([^"]+)"/g)].map(m => m[1]));

let ok = 0;
const prova = (nome, fn) => { fn(); ok++; console.log("✓ " + nome); };

prova("ogni script e foglio di stile di index.html esiste", () => {
    assert.ok(locali.length > 0);
    for (const p of locali) assert.ok(existsSync(path.join(radice, p.split("?")[0])), "file mancante: " + p);
});

prova("gli stessi file, con la stessa versione, sono nella cache del service worker", () => {
    for (const p of locali) assert.ok(precache.has(p), `${p} manca (o ha un'altra versione) in service-worker.js`);
});

prova("tutti i file della cache esistono", () => {
    for (const p of precache) {
        if (p === "" ) continue;
        assert.ok(existsSync(path.join(radice, p.split("?")[0])), "file della cache non trovato: " + p);
    }
});

console.log(`\n${ok} controlli superati`);
