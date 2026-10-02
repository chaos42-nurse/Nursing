import os
import json
import urllib.request
import csv
import io

DATA_DIR = "public/data"
FARMACI_PATH = os.path.join(DATA_DIR, "farmaci.json")
VERSION_PATH = os.path.join(DATA_DIR, "version.json")

# URL dati aperti AIFA (Medicinali autorizzati con ATC)
AIFA_CSV_URL = "https://www.aifa.gov.it/documents/20142/1740920/Elenco_medicinali_A_H.csv"

def fetch_and_process_aifa_data():
    print("Download dati in corso da AIFA...")
    req = urllib.request.Request(AIFA_CSV_URL, headers={'User-Agent': 'Mozilla/5.0'})
    
    farmaci_set = set()
    farmaci_list = []

    try:
        with urllib.request.urlopen(req) as response:
            csv_content = response.read().decode('utf-8', errors='ignore')
            reader = csv.DictReader(io.StringIO(csv_content), delimiter=';')
            
            for row in reader:
                principio = row.get('PRINCIPIO ATTIVO', '').strip().upper()
                atc = row.get('CODICE ATC', '').strip().upper()
                desc_atc = row.get('GRUPPO ANATOMICO', '').strip()

                if principio and atc:
                    key = f"{principio}_{atc}"
                    if key not in farmaci_set:
                        farmaci_set.add(key)
                        farmaci_list.append({
                            "principio_attivo": principio,
                            "codice_atc": atc,
                            "gruppo_atc": desc_atc
                        })
                        
    except Exception as e:
        print(f"Errore durante il download da AIFA: {e}")
        return None

    farmaci_list.sort(key=lambda x: x["principio_attivo"])
    return farmaci_list

def update_files():
    os.makedirs(DATA_DIR, exist_ok=True)
    
    farmaci_data = fetch_and_process_aifa_data()
    if not farmaci_data:
        print("Operazione annullata a causa di un errore nel recupero dati.")
        return

    # Salva il nuovo farmaci.json
    with open(FARMACI_PATH, "w", encoding="utf-8") as f:
        json.dump(farmaci_data, f, ensure_ascii=False, indent=2)
    print(f"Aggiornato {FARMACI_PATH} con {len(farmaci_data)} elementi.")

    # Aggiorna la versione in version.json
    current_version = 1
    if os.path.exists(VERSION_PATH):
        try:
            with open(VERSION_PATH, "r", encoding="utf-8") as f:
                v_data = json.load(f)
                current_version = v_data.get("version", 0) + 1
        except Exception:
            current_version = 1

    version_data = {
        "version": current_version,
        "last_updated": urllib.request.urlopen("http://worldtimeapi.org/api/timezone/Etc/UTC").read().decode() if False else "Auto-updated"
    }

    with open(VERSION_PATH, "w", encoding="utf-8") as f:
        json.dump(version_data, f, ensure_ascii=False, indent=2)
    print(f"Aggiornata versione a: {current_version}")

if __name__ == "__main__":
    update_files()
