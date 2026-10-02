import csv
import io
import json
import os
import re
import urllib.request
import unicodedata
from datetime import datetime, timezone

# ============================================================
# Configurazione
# ============================================================

DATA_DIR = "data"

# NON sovrascrive data/farmaci.json:
# quel file contiene la struttura editoriale dell'app.
INDEX_PATH = os.path.join(DATA_DIR, "farmaci-principi-attivi.json")
ATC_PATH = os.path.join(DATA_DIR, "farmaci-atc.json")
VERSION_PATH = os.path.join(DATA_DIR, "version.json")

# AIFA Open Data: anagrafica dei farmaci.
# La pagina AIFA indica che l'anagrafica contiene anche principio attivo e codice ATC.
AIFA_FARMACI_URL = "https://drive.aifa.gov.it/farmaci/confezioni_fornitura.csv"

# Licenza dichiarata da AIFA per gli open data: CC BY 4.0.
AIFA_SOURCE = "AIFA Open Data - Anagrafica dei farmaci"
AIFA_SOURCE_URL = "https://www.aifa.gov.it/liste-dei-farmaci"


# ============================================================
# Utility
# ============================================================

def normalize(value):
    value = str(value or "").strip()
    value = unicodedata.normalize("NFD", value)
    value = "".join(c for c in value if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def find_column(fieldnames, candidates):
    normalized = {normalize(name): name for name in (fieldnames or [])}

    for candidate in candidates:
        key = normalize(candidate)
        if key in normalized:
            return normalized[key]

    for name in fieldnames or []:
        normalized_name = normalize(name)
        for candidate in candidates:
            if normalize(candidate) in normalized_name:
                return name

    return None


def read_csv(url):
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "Nursing-Shot/1.0"}
    )

    with urllib.request.urlopen(request, timeout=60) as response:
        raw = response.read()

    text = raw.decode("utf-8-sig", errors="replace")

    # AIFA utilizza normalmente ';', ma rileviamo anche ','.
    sample = text[:5000]
    delimiter = ";" if sample.count(";") >= sample.count(",") else ","

    return list(csv.DictReader(io.StringIO(text), delimiter=delimiter))


# ============================================================
# Download AIFA
# ============================================================

def fetch_aifa_data():
    print("Scarico l'anagrafica farmaci AIFA...")

    rows = read_csv(AIFA_FARMACI_URL)

    if not rows:
        raise RuntimeError("Il file AIFA è vuoto.")

    fieldnames = list(rows[0].keys())

    principle_column = find_column(
        fieldnames,
        [
            "PRINCIPIO ATTIVO",
            "PRINCIPIO ATTIVO ESPRESSO IN FORMA COMPATTA",
            "PRINCIPIO_ATTIVO"
        ]
    )

    atc_column = find_column(
        fieldnames,
        [
            "CODICE ATC",
            "CODICE_ATC",
            "ATC"
        ]
    )

    if not principle_column or not atc_column:
        raise RuntimeError(
            "Colonne AIFA non riconosciute. "
            f"Colonne disponibili: {fieldnames}"
        )

    records = {}
    
    for row in rows:
        principle = str(row.get(principle_column, "")).strip()
        atc = str(row.get(atc_column, "")).strip().upper()

        if not principle:
            continue

        # Alcuni record AIFA possono non avere ATC.
        # Non vengono scartati dall'archivio: il codice resta vuoto.
        key = (normalize(principle), atc)

        records[key] = {
            "principioAttivo": principle,
            "codiceAtc": atc
        }

    result = sorted(
        records.values(),
        key=lambda item: normalize(item["principioAttivo"])
    )

    print(f"Record AIFA elaborati: {len(result)}")
    return result


# ============================================================
# Aggiornamento indice usato dalla ricerca dell'app
# ============================================================

def update_search_index(aifa_records):
    if os.path.exists(INDEX_PATH):
        with open(INDEX_PATH, "r", encoding="utf-8") as file:
            old_index = json.load(file)
    else:
        old_index = []

    # Conserva le associazioni già curate manualmente dall'app.
    class_map = {}

    for entry in old_index:
        principle = entry.get("principioAttivo", "")
        if principle and entry.get("classeId"):
            class_map[normalize(principle)] = {
                "classeId": entry["classeId"],
                "classeNome": entry.get("classeNome", "")
            }

    updated = []

    for record in aifa_records:
        key = normalize(record["principioAttivo"])
        mapping = class_map.get(key)

        # La ricerca dell'app deve portare a una classe esistente.
        # I principi non ancora associati a una classe vengono quindi
        # conservati nell'archivio ATC, ma non inseriti nell'indice UI.
        if not mapping:
            continue

        updated.append({
            "principioAttivo": record["principioAttivo"],
            "codiceAtc": record["codiceAtc"],
            "classeId": mapping["classeId"],
            "classeNome": mapping["classeNome"]
        })

    # Mantiene anche le voci manuali che AIFA non ha restituito,
    # evitando che un aggiornamento temporaneo della fonte rompa la ricerca.
    existing_keys = {
        (normalize(item.get("principioAttivo", "")), item.get("classeId"))
        for item in updated
    }

    for entry in old_index:
        key = (normalize(entry.get("principioAttivo", "")), entry.get("classeId"))

        if key in existing_keys:
            continue

        updated.append({
            "principioAttivo": entry.get("principioAttivo", ""),
            "codiceAtc": entry.get("codiceAtc", ""),
            "classeId": entry.get("classeId", ""),
            "classeNome": entry.get("classeNome", "")
        })

    updated.sort(
        key=lambda item: normalize(item.get("principioAttivo", ""))
    )

    with open(INDEX_PATH, "w", encoding="utf-8") as file:
        json.dump(updated, file, ensure_ascii=False, indent=2)
        file.write("\n")

    print(f"Indice ricerca aggiornato: {len(updated)} principi attivi.")


# ============================================================
# Archivio completo principio attivo + ATC
# ============================================================

def write_atc_archive(aifa_records):
    archive = {
        "source": AIFA_SOURCE,
        "sourceUrl": AIFA_SOURCE_URL,
        "license": "CC BY 4.0",
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "records": aifa_records
    }

    with open(ATC_PATH, "w", encoding="utf-8") as file:
        json.dump(archive, file, ensure_ascii=False, indent=2)
        file.write("\n")

    print(f"Archivio AIFA scritto: {ATC_PATH}")


# ============================================================
# Versione
# ============================================================

def update_version():
    current_version = 0

    if os.path.exists(VERSION_PATH):
        try:
            with open(VERSION_PATH, "r", encoding="utf-8") as file:
                data = json.load(file)
                current_version = int(data.get("version", 0))
        except (ValueError, TypeError, json.JSONDecodeError):
            current_version = 0

    new_version = current_version + 1

    data = {
        "version": new_version,
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "source": AIFA_SOURCE,
        "source_url": AIFA_SOURCE_URL
    }

    with open(VERSION_PATH, "w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=2)
        file.write("\n")

    print(f"Versione aggiornata: {current_version} -> {new_version}")


# ============================================================
# Main
# ============================================================

def update_files():
    os.makedirs(DATA_DIR, exist_ok=True)

    aifa_records = fetch_aifa_data()

    if not aifa_records:
        raise RuntimeError("Nessun dato AIFA recuperato.")

    # IMPORTANTE:
    # data/farmaci.json non viene mai modificato.
    write_atc_archive(aifa_records)
    update_search_index(aifa_records)
    update_version()


if __name__ == "__main__":
    update_files()
