# -*- coding: utf-8 -*-
"""
Controllo mensile dell'archivio interazioni tra farmaci (eseguito il 16 di ogni mese dal workflow
.github/workflows/update-interactions.yml, oppure a mano: python scripts/aggiorna_interazioni.py).

1. Se e' impostata la variabile d'ambiente INTERACTIONS_SOURCE_URL (indirizzo di uno ZIP nello stesso
   formato di data/db_drug_interactions.csv.zip: un CSV con le colonne farmaco A, farmaco B, descrizione),
   scarica il file e, se e' diverso da quello presente, lo sostituisce. Senza URL non scarica nulla:
   il dataset DrugBank/TDC non ha un indirizzo pubblico di aggiornamento.
2. Rigenera data/interazioni.csv e data/traduzioni-interazioni.json (scripts/update_interactions.py).
3. Aggiorna data/interazioni-meta.json (mostrato nella pagina Interazioni dell'app):
   - last_checked: data del controllo;
   - last_updated: data dell'ultima volta in cui l'archivio e' cambiato davvero;
   - dataset_date: data del file CSV dentro lo ZIP;
   - numero di interazioni, di principi attivi e impronta (SHA-256) dello ZIP.
Scrive in GITHUB_OUTPUT changed=true/false se un file e' cambiato (la data del controllo da sola
non conta come modifica dei dati, ma viene comunque salvata).
"""
import csv
import hashlib
import io
import json
import os
import shutil
import sys
import tempfile
import urllib.request
import zipfile
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
os.chdir(ROOT)

ZIP_PATH = os.path.join("data", "db_drug_interactions.csv.zip")
META_PATH = os.path.join("data", "interazioni-meta.json")
CSV_OUT = os.path.join("data", "interazioni.csv")


def sha256(percorso):
    h = hashlib.sha256()
    with open(percorso, "rb") as f:
        for blocco in iter(lambda: f.read(1 << 20), b""):
            h.update(blocco)
    return h.hexdigest()


def verifica_zip(percorso):
    """Controlla che lo ZIP contenga un CSV con almeno 3 colonne e un numero ragionevole di righe."""
    with zipfile.ZipFile(percorso) as z:
        nomi = [n for n in z.namelist() if n.lower().endswith(".csv")]
        if not nomi:
            raise SystemExit("❌ Lo ZIP scaricato non contiene file CSV: non lo uso.")
        with z.open(nomi[0]) as raw:
            lettore = csv.reader(io.TextIOWrapper(raw, encoding="utf-8", newline=""))
            intestazione = next(lettore, None)
            righe = 0
            for riga in lettore:
                if len(riga) < 3 or not riga[0].strip() or not riga[1].strip():
                    raise SystemExit(f"❌ Riga {righe + 2} non valida nello ZIP scaricato: non lo uso.")
                righe += 1
        if not intestazione or len(intestazione) < 3 or righe < 1000:
            raise SystemExit(f"❌ Archivio scaricato non plausibile ({righe} righe): non lo uso.")
        info = z.getinfo(nomi[0])
    return righe, "%04d-%02d-%02d" % info.date_time[:3]


def scarica_se_nuovo():
    url = os.environ.get("INTERACTIONS_SOURCE_URL", "").strip()
    if not url:
        print("ℹ️ INTERACTIONS_SOURCE_URL non impostato: nessun download, controllo dell'archivio presente.")
        return False
    if not url.lower().startswith("https://"):
        raise SystemExit("❌ INTERACTIONS_SOURCE_URL deve iniziare con https://")
    print(f"⬇️ Scaricamento da {url}")
    with tempfile.TemporaryDirectory() as tmp:
        destinazione = os.path.join(tmp, "nuovo.zip")
        richiesta = urllib.request.Request(url, headers={"User-Agent": "nursing-shot-data-bot"})
        with urllib.request.urlopen(richiesta, timeout=120) as r, open(destinazione, "wb") as f:
            shutil.copyfileobj(r, f)
        verifica_zip(destinazione)
        if sha256(destinazione) == sha256(ZIP_PATH):
            print("✓ L'archivio scaricato e' identico a quello presente.")
            return False
        shutil.copyfile(destinazione, ZIP_PATH)
        print("🔄 Archivio sostituito con la versione scaricata.")
        return True


def main():
    oggi = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    sostituito = scarica_se_nuovo()

    righe_zip, data_dataset = verifica_zip(ZIP_PATH)
    zip_hash = sha256(ZIP_PATH)

    csv_prima = sha256(CSV_OUT) if os.path.exists(CSV_OUT) else ""
    import update_interactions
    update_interactions.process_interactions()
    csv_dopo = sha256(CSV_OUT)

    try:
        with open(META_PATH, encoding="utf-8") as f:
            meta = json.load(f)
    except (OSError, ValueError):
        meta = {}

    with open(CSV_OUT, encoding="utf-8", newline="") as f:
        interazioni = sum(1 for _ in f) - 1
    with open(os.path.join("data", "traduzioni-interazioni.json"), encoding="utf-8") as f:
        farmaci = len(json.load(f).get("nomi", {})) or None

    cambiato = sostituito or csv_dopo != csv_prima or meta.get("zip_sha256") != zip_hash
    nuovo = dict(meta)
    nuovo.update({
        "dataset_date": data_dataset,
        "records_zip": righe_zip,
        "records": interazioni,
        "zip_sha256": zip_hash,
        "last_checked": oggi,
    })
    if farmaci:
        nuovo["drugs"] = farmaci
    if cambiato or "last_updated" not in meta:
        # prima volta: la data dell'archivio e' quella del file contenuto nello ZIP
        nuovo["last_updated"] = oggi if (sostituito or csv_dopo != csv_prima) else meta.get("last_updated", data_dataset)

    with open(META_PATH, "w", encoding="utf-8") as f:
        json.dump(nuovo, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"✅ Controllo del {oggi}: {interazioni} interazioni, dati del {data_dataset}, "
          f"{'archivio aggiornato' if (sostituito or csv_dopo != csv_prima) else 'nessuna novita nei dati'}.")
    uscita = os.environ.get("GITHUB_OUTPUT")
    if uscita:
        with open(uscita, "a", encoding="utf-8") as f:
            f.write(f"changed={'true' if (sostituito or csv_dopo != csv_prima) else 'false'}\n")


if __name__ == "__main__":
    main()
