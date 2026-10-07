# -*- coding: utf-8 -*-
"""
Genera i file del database interazioni a partire dallo ZIP in data/.

Input : data/db_drug_interactions.csv.zip   (DrugBank/TDCommons, in inglese)
Output: data/interazioni.csv                (nomi ed effetti in italiano)
        data/traduzioni-interazioni.json    (dizionario usato dall'app per
                                             tradurre al volo anche lo ZIP)

Tutta la traduzione e la classificazione "pericolosa"/"possibile" sono in
scripts/traduzioni_interazioni.py.
"""

import csv
import json
import os
import sys
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import traduzioni_interazioni as tr  # noqa: E402

ZIP_DIR = "data"
OUT_CSV = os.path.join("data", "interazioni.csv")
OUT_JSON = os.path.join("data", "traduzioni-interazioni.json")


def leggi_righe_zip(percorso_zip):
    with zipfile.ZipFile(percorso_zip) as z:
        nomi_csv = [n for n in z.namelist() if n.lower().endswith(".csv")]
        if not nomi_csv:
            raise SystemExit("❌ Nessun file CSV trovato all'interno dello ZIP")
        with z.open(nomi_csv[0]) as raw:
            import io
            lettore = csv.reader(io.TextIOWrapper(raw, encoding="utf-8", newline=""))
            intestazione = next(lettore, None)
            print(f"📖 Lettura di {nomi_csv[0]} — colonne: {intestazione}")
            for riga in lettore:
                if len(riga) >= 3 and riga[0].strip() and riga[1].strip():
                    yield riga[0].strip(), riga[1].strip(), riga[2].strip()


def process_interactions():
    if not os.path.isdir(ZIP_DIR):
        raise SystemExit(f"❌ La cartella {ZIP_DIR} non esiste.")

    zip_files = sorted(f for f in os.listdir(ZIP_DIR) if f.endswith(".zip"))
    if not zip_files:
        raise SystemExit("❌ Nessun file ZIP trovato nella cartella data/")

    percorso = os.path.join(ZIP_DIR, zip_files[0])
    print(f"📦 Estrazione del file ZIP: {percorso}")

    nomi_en = set()
    viste = set()
    scritte = non_tradotte = 0

    with open(OUT_CSV, "w", encoding="utf-8", newline="") as out:
        scrittore = csv.writer(out, lineterminator="\n")
        scrittore.writerow(["farmacoA", "farmacoB", "stato", "nota"])

        for a_en, b_en, testo_en in leggi_righe_zip(percorso):
            nomi_en.add(a_en)
            nomi_en.add(b_en)

            tradotto = tr.effetto_it(testo_en, a_en, b_en)
            if tradotto is None:
                # Frase non prevista: si conserva l'originale, da rivedere
                non_tradotte += 1
                nota, stato = testo_en, tr.M
            else:
                nota, stato = tradotto

            a_it, b_it = tr.nome_it(a_en), tr.nome_it(b_en)
            chiave = (a_it, b_it, nota)
            if chiave in viste:
                continue
            viste.add(chiave)
            scrittore.writerow([a_it, b_it, stato, nota])
            scritte += 1

    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(tr.esporta_json(nomi_en), f, ensure_ascii=False, separators=(",", ":"))

    print(f"✅ Completato! {OUT_CSV}: {scritte} record "
          f"({non_tradotte} con frase non prevista).")
    print(f"✅ {OUT_JSON}: {len(nomi_en)} nomi, {len(tr.EFFETTI)} modelli di frase.")


if __name__ == "__main__":
    process_interactions()
