#!/usr/bin/env python3
"""Controllo mensile dei principi attivi AIFA (eseguito da GitHub Actions il 16 di ogni mese).

1. Scarica la "Lista farmaci equivalenti" (CSV) dalla pagina AIFA "Liste dei farmaci".
2. Se il file contiene principi attivi nuovi rispetto a src/data/farmaci.csv,
   sostituisce quel file con quello appena scaricato.
3. Ricostruisce l'indice delle classi farmacologiche (src/data/aifa-principi-attivi.json e
   src/data/farmaci.json): le classi già assegnate restano, i principi attivi nuovi entrano
   come "Catalogo AIFA" e vengono smistati per codice ATC da src/data/smista-farmaci.js.

Solo libreria standard. Uso: python3 scripts/update_principi_attivi.py [--local FILE.csv]
(--local serve per i test: usa un CSV già presente invece di scaricarlo).
"""
import csv
import io
import json
import os
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(ROOT, "src", "data", "farmaci.csv")
INDEX_PATH = os.path.join(ROOT, "src", "data", "aifa-principi-attivi.json")
FARMACI_PATH = os.path.join(ROOT, "src", "data", "farmaci.json")
UPDATE_PATH = os.path.join(ROOT, "src", "data", "ultimo-aggiornamento.txt")
VERSION_PATH = os.path.join(ROOT, "data", "version.json")

PAGE_URL = "https://www.aifa.gov.it/liste-dei-farmaci"
FALLBACK_URL = "https://www.aifa.gov.it/documents/20142/825643/Lista_farmaci_equivalenti.csv"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; Nursing-Shot-Updater/1.0)"}

MIN_ROWS = 1000          # una lista sensata ha migliaia di righe
MIN_PRINCIPLES = 150


def log(message):
    print(message, flush=True)


def normalize(value):
    value = unicodedata.normalize("NFD", str(value or "").strip().lower())
    value = "".join(c for c in value if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "", value)


def http_get(url, binary=False, attempts=3):
    last = None
    for attempt in range(1, attempts + 1):
        try:
            request = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(request, timeout=120) as response:
                data = response.read()
            return data if binary else data.decode("utf-8", errors="replace")
        except Exception as error:  # noqa: BLE001 - riprova su qualsiasi errore di rete
            last = error
            log(f"  tentativo {attempt}/{attempts} fallito: {error}")
            time.sleep(5 * attempt)
    raise RuntimeError(f"Impossibile scaricare {url}: {last}")


def find_csv_url():
    """Cerca nella pagina AIFA il link al CSV (il percorso può cambiare); altrimenti usa quello noto."""
    try:
        html = http_get(PAGE_URL)
        match = re.search(r'href="([^"]*Lista[_-]farmaci[_-]equivalenti[^"]*\.csv[^"]*)"', html, re.I)
        if match:
            return urllib.parse.urljoin(PAGE_URL, match.group(1).replace("&amp;", "&"))
        log("Link al CSV non trovato nella pagina: uso l'indirizzo noto.")
    except Exception as error:  # noqa: BLE001
        log(f"Pagina AIFA non leggibile ({error}): uso l'indirizzo noto.")
    return FALLBACK_URL


def decode(raw):
    if raw.startswith(b"\xef\xbb\xbf"):
        raw = raw[3:]
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        return raw.decode("cp1252", errors="replace")


def parse(text):
    sample = text[:5000]
    delimiter = ";" if sample.count(";") >= sample.count(",") else ","
    rows = list(csv.reader(io.StringIO(text), delimiter=delimiter))
    if not rows:
        raise RuntimeError("CSV vuoto.")
    header = [normalize(c) for c in rows[0]]
    try:
        pa_col = next(i for i, c in enumerate(header) if c.startswith("principioattivo"))
    except StopIteration:
        raise RuntimeError("Colonna 'Principio attivo' non trovata: il formato del CSV è cambiato.")
    atc_col = next((i for i, c in enumerate(header) if c == "atc"), None)

    principles = {}
    for row in rows[1:]:
        if len(row) <= pa_col or not row[pa_col].strip():
            continue
        name = row[pa_col].strip()
        key = normalize(name)
        if key and key not in principles:
            atc = row[atc_col].strip() if atc_col is not None and len(row) > atc_col else ""
            principles[key] = {"principioAttivo": name, "atc": atc}
    return len(rows) - 1, principles


def load_json(path, default):
    try:
        with open(path, encoding="utf-8") as handle:
            return json.load(handle)
    except FileNotFoundError:
        return default


def save_json(path, data, indent):
    text = json.dumps(data, ensure_ascii=False, indent=indent, separators=(",", ":") if indent is None else None)
    with open(path, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(text + ("\n" if indent else ""))


def merge_index(path, principles, indent, donors):
    """Aggiunge all'indice i principi attivi mancanti, senza toccare le classi già assegnate."""
    current = load_json(path, [])
    known = {normalize(item.get("principioAttivo")) for item in current}
    donor_by_key = {}
    for donor in donors:
        for item in donor:
            donor_by_key.setdefault(normalize(item.get("principioAttivo")), item)

    added = 0
    for key, info in principles.items():
        if key in known:
            continue
        donor = donor_by_key.get(key)
        if donor and donor.get("classeId"):
            entry = dict(donor)
            entry["atc"] = entry.get("atc") or info["atc"]
        else:
            entry = {"principioAttivo": info["principioAttivo"], "classeId": "", "classeNome": "Catalogo AIFA", "atc": info["atc"]}
        current.append(entry)
        added += 1

    current.sort(key=lambda item: normalize(item.get("principioAttivo")))
    if added:
        save_json(path, current, indent)
    return added


def write_output(name, value):
    target = os.environ.get("GITHUB_OUTPUT")
    if target:
        with open(target, "a", encoding="utf-8") as handle:
            handle.write(f"{name}={value}\n")


def main():
    local = None
    if "--local" in sys.argv:
        local = sys.argv[sys.argv.index("--local") + 1]

    if local:
        log(f"Uso il file locale {local}")
        raw = open(local, "rb").read()
    else:
        url = find_csv_url()
        log(f"Scarico {url}")
        raw = http_get(url, binary=True)

    text = decode(raw)
    row_count, new_principles = parse(text)
    log(f"CSV scaricato: {row_count} righe, {len(new_principles)} principi attivi.")

    if row_count < MIN_ROWS or len(new_principles) < MIN_PRINCIPLES:
        raise RuntimeError("Il CSV scaricato è troppo piccolo: non lo uso (il file attuale resta invariato).")

    old_text = decode(open(CSV_PATH, "rb").read()) if os.path.exists(CSV_PATH) else ""
    _, old_principles = parse(old_text) if old_text else (0, {})
    fresh = sorted(info["principioAttivo"] for key, info in new_principles.items() if key not in old_principles)

    changed = False
    if fresh:
        log(f"Nuovi principi attivi ({len(fresh)}): {', '.join(fresh[:30])}{'…' if len(fresh) > 30 else ''}")
        with open(CSV_PATH, "w", encoding="utf-8", newline="") as handle:
            handle.write(text)
        changed = True
        # Il CSV nuovo è la base per l'indice.
        principles = new_principles
    else:
        log("Nessun nuovo principio attivo: il file CSV resta quello attuale.")
        principles = old_principles or new_principles

    farmaci = load_json(FARMACI_PATH, [])
    index = load_json(INDEX_PATH, [])
    added_farmaci = merge_index(FARMACI_PATH, principles, 2, [index])
    added_index = merge_index(INDEX_PATH, principles, None, [farmaci])
    if added_farmaci or added_index:
        log(f"Indice classi: aggiunti {added_index} principi attivi (farmaci.json: {added_farmaci}).")
        changed = True

    now = datetime.now()
    version = load_json(VERSION_PATH, {})
    version.update({"source": "AIFA", "file": "src/data/farmaci.csv", "last_checked": now.strftime("%Y-%m-%d")})
    if changed:
        with open(UPDATE_PATH, "w", encoding="utf-8") as handle:
            handle.write(now.strftime("%d/%m/%Y"))
        version.update({"version": int(now.strftime("%Y%m%d")), "last_updated": now.strftime("%Y-%m-%d")})
    save_json(VERSION_PATH, version, 2)

    with open(os.path.join(os.environ.get("RUNNER_TEMP", "/tmp"), "aggiornamento-aifa.txt"), "w", encoding="utf-8") as handle:
        handle.write("nuovi principi attivi: " + (", ".join(fresh) if fresh else "nessuno") + "\n")

    # Il controllo è sempre registrato (version.json cambia ogni volta): si salva e si ripubblica.
    changed = True

    write_output("changed", "true" if changed else "false")
    log("Fatto.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # noqa: BLE001
        log(f"ERRORE: {error}")
        sys.exit(1)
