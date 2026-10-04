#!/usr/bin/env python3
import csv
import io
import os
import re
import zipfile
from pathlib import Path

SOURCE = "TDCommons (TDC) — Drug-Drug Interaction (DDI)"
SOURCE_URL = "https://tdcommons.ai/multi_pred_tasks/ddi/"
ZIP_PATH = Path("data/db_drug_interactions.csv.zip")
OUTPUT_PATH = Path("data/interazioni.csv")
META_PATH = Path("data/interazioni-meta.json")

def normalize(value):
    return re.sub(r"[^a-z0-9]+", "", str(value or "").strip().lower())

def find_column(fieldnames, candidates):
    norm = {normalize(x): x for x in fieldnames}
    for candidate in candidates:
        if normalize(candidate) in norm:
            return norm[normalize(candidate)]
    for name in fieldnames:
        n = normalize(name)
        if any(normalize(c) in n for c in candidates):
            return name
    return None

def italianize(text, drug_a, drug_b):
    s = str(text or "").strip()
    if not s:
        return ""

    # Keep drug names untouched and translate the finite set of
    # relationship phrases used by the TDC/DrugBank-style DDI descriptions.
    replacements = [
        ("The metabolism of the active metabolites of ", "Il metabolismo dei metaboliti attivi di "),
        ("The metabolism of ", "Il metabolismo di "),
        (" serum concentration of the active metabolites of ", " concentrazione sierica dei metaboliti attivi di "),
        (" serum concentration of ", " concentrazione sierica di "),
        ("The serum concentration of ", "La concentrazione sierica di "),
        (" can be decreased when it is combined with ", " può diminuire quando è associata a "),
        (" can be increased when it is combined with ", " può aumentare quando è associata a "),
        (" can be decreased when combined with ", " può diminuire quando viene associato a "),
        (" can be increased when combined with ", " può aumentare quando viene associato a "),
        (" which could result in a higher serum level.", " il che potrebbe determinare un livello sierico più elevato."),
        (" which could result in a lower serum level.", " il che potrebbe determinare un livello sierico più basso."),
        (" may increase the ", " può aumentare l'azione "),
        (" may decrease the ", " può diminuire l'azione "),
        (" activities of ", " di "),
        (" may increase the ", " può aumentare l'azione "),
        (" may decrease the ", " può diminuire l'azione "),
        (" can cause a decrease in the absorption of ", " può causare una diminuzione dell'assorbimento di "),
        (" resulting in a reduced serum concentration and potentially a decrease in efficacy.", " con conseguente riduzione della concentrazione sierica e potenziale diminuzione dell'efficacia."),
        (" resulting in an increased serum concentration and potentially an increase in toxicity.", " con conseguente aumento della concentrazione sierica e potenziale aumento della tossicità."),
        ("The therapeutic efficacy of ", "L'efficacia terapeutica di "),
        (" can be decreased when used in combination with ", " può diminuire quando viene utilizzato in associazione con "),
        (" can be increased when used in combination with ", " può aumentare quando viene utilizzato in associazione con "),
        (" may increase the ", " può aumentare l'effetto "),
        (" may decrease the ", " può diminuire l'effetto "),
        ("risk or severity of adverse effects can be increased when ", "rischio o la gravità degli effetti avversi possono aumentare quando "),
        ("risk or severity of adverse effects can be decreased when ", "rischio o la gravità degli effetti avversi possono diminuire quando "),
        (" is combined with ", " è associato a "),
        (" is used in combination with ", " viene utilizzato in associazione con "),
        (" when combined with ", " quando viene associato a "),
        (" when it is combined with ", " quando viene associato a "),
        (" may increase the risk or severity of ", " può aumentare il rischio o la gravità di "),
        (" may decrease the risk or severity of ", " può diminuire il rischio o la gravità di "),
        (" may increase the hypotensive activities of ", " può aumentare gli effetti ipotensivi di "),
        (" may decrease the antihypertensive activities of ", " può diminuire gli effetti antipertensivi di "),
        (" may increase the antihypertensive activities of ", " può aumentare gli effetti antipertensivi di "),
        (" may increase the hypoglycemic activities of ", " può aumentare gli effetti ipoglicemizzanti di "),
        (" may increase the bradycardic activities of ", " può aumentare gli effetti bradicardizzanti di "),
        (" may increase the hypokalemic activities of ", " può aumentare gli effetti ipokaliemizzanti di "),
        (" may increase the sedative activities of ", " può aumentare gli effetti sedativi di "),
        (" may decrease the sedative activities of ", " può diminuire gli effetti sedativi di "),
        (" may decrease the cardiotoxic activities of ", " può diminuire gli effetti cardiotossici di "),
        (" may increase the neuroexcitatory activities of ", " può aumentare gli effetti neuroeccitatori di "),
        (" may increase the serotonergic activities of ", " può aumentare gli effetti serotoninergici di "),
        (" may increase the hypertensive activities of ", " può aumentare gli effetti ipertensivi di "),
        (" may increase the orthostatic hypotensive activities of ", " può aumentare gli effetti ipotensivi ortostatici di "),
        (" may decrease the stimulatory activities of ", " può diminuire gli effetti stimolanti di "),
        (" may increase the nephrotoxic activities of ", " può aumentare gli effetti nefrotossici di "),
        (" may increase the immunosuppressive activities of ", " può aumentare gli effetti immunosoppressivi di "),
        (" may increase the tachycardic activities of ", " può aumentare gli effetti tachicardizzanti di "),
        (" may decrease the bronchodilatory activities of ", " può diminuire gli effetti broncodilatatori di "),
        (" may decrease the vasoconstricting activities of ", " può diminuire gli effetti vasocostrittori di "),
        (" may increase the vasoconstricting activities of ", " può aumentare gli effetti vasocostrittori di "),
        (" may increase the atrioventricular blocking (AV block) activities of ", " può aumentare gli effetti di blocco atrioventricolare di "),
        (" may increase the central nervous system depressant (CNS depressant) activities of ", " può aumentare gli effetti depressivi sul sistema nervoso centrale di "),
        (" may increase the central nervous system depressant activities of ", " può aumentare gli effetti depressivi sul sistema nervoso centrale di "),
        (" risk or severity of QTc prolongation can be increased when ", " rischio o la gravità del prolungamento del QTc possono aumentare quando "),
        (" risk or severity of QT prolongation can be increased when ", " rischio o la gravità del prolungamento del QT possono aumentare quando "),
    ]

    for old, new in replacements:
        s = s.replace(old, new)

    # Common remaining grammar fragments.
    s = s.replace(" may increase ", " può aumentare ")
    s = s.replace(" may decrease ", " può diminuire ")
    s = s.replace(" can be increased ", " può aumentare ")
    s = s.replace(" can be decreased ", " può diminuire ")
    s = s.replace(" can result in ", " può determinare ")
    s = s.replace(" could result in ", " potrebbe determinare ")
    s = s.replace("The risk or severity of ", "Il rischio o la gravità di ")
    s = s.replace("The risk or severity ", "Il rischio o la gravità ")
    s = s.replace(" is associated with ", " è associato a ")
    s = s.replace(" when ", " quando ")
    s = s.replace("combined with", "associato a")
    s = s.replace("in combination with", "in associazione con")

    # If the original sentence was already Italian, leave it as-is.
    return re.sub(r"\s+", " ", s).strip()

def locate_csv(zf):
    names = [n for n in zf.namelist() if n.lower().endswith(".csv") and not n.endswith("/")]
    if not names:
        raise RuntimeError("Nel file ZIP non è presente alcun CSV.")
    return names[0]

def main():
    if not ZIP_PATH.exists():
        raise RuntimeError(f"File sorgente non trovato: {ZIP_PATH}")

    with zipfile.ZipFile(ZIP_PATH) as zf:
        csv_name = locate_csv(zf)
        raw = zf.read(csv_name)

    text = raw.decode("utf-8-sig", errors="replace")
    sample = text[:10000]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
        delimiter = dialect.delimiter
    except csv.Error:
        delimiter = ","

    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    fields = reader.fieldnames or []

    a_col = find_column(fields, ["drug_a", "drug1", "drug 1", "drug_a_name", "farmacoa", "drug"])
    b_col = find_column(fields, ["drug_b", "drug2", "drug 2", "drug_b_name", "farmacob"])
    desc_col = find_column(fields, ["interaction", "description", "interaction_description", "effect", "relation", "nota", "description"])

    if not a_col or not b_col:
        raise RuntimeError(f"Colonne farmaco non riconosciute. Colonne trovate: {fields}")
    if not desc_col:
        raise RuntimeError(f"Colonna descrizione/interazione non riconosciuta. Colonne trovate: {fields}")

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = OUTPUT_PATH.with_suffix(".csv.tmp")

    count = 0
    with tmp.open("w", encoding="utf-8", newline="") as out:
        writer = csv.writer(out)
        writer.writerow(["farmacoA", "farmacoB", "nota"])

        for row in reader:
            a = str(row.get(a_col, "") or "").strip()
            b = str(row.get(b_col, "") or "").strip()
            note = str(row.get(desc_col, "") or "").strip()
            if not a or not b:
                continue
            writer.writerow([a, b, italianize(note, a, b)])
            count += 1

    if count == 0:
        tmp.unlink(missing_ok=True)
        raise RuntimeError("La conversione ha prodotto zero interazioni.")

    os.replace(tmp, OUTPUT_PATH)

    META_PATH.write_text(
        '{\n'
        f'  "source": {SOURCE!r},\n'
        f'  "sourceUrl": {SOURCE_URL!r},\n'
        f'  "records": {count}\n'
        '}\n'.replace("'", '"'),
        encoding="utf-8"
    )

    print(f"Interazioni convertite: {count}")
    print(f"Fonte: {SOURCE} — {SOURCE_URL}")

if __name__ == "__main__":
    main()
