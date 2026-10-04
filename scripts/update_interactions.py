import os
import zipfile
import pandas as pd

def process_interactions():
    # 1. Individua automaticamente lo ZIP inserito in data/
    zip_dir = 'data'
    zip_files = [f for f in os.listdir(zip_dir) if f.endswith('.zip')]
    if not zip_files:
        print("❌ Nessun file ZIP trovato nella cartella data/")
        return
    
    zip_path = os.path.join(zip_dir, zip_files[0])
    print(f"📦 Estrazione del file ZIP: {zip_path}")
    
    extract_dir = 'temp_extracted'
    os.makedirs(extract_dir, exist_ok=True)
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(extract_dir)
        
    # Trova il file CSV estratto all'interno dello ZIP
    csv_files = []
    for root, dirs, files in os.walk(extract_dir):
        for file in files:
            if file.endswith('.csv'):
                csv_files.append(os.path.join(root, file))
                
    if not csv_files:
        print("❌ Nessun file CSV trovato all'interno dello ZIP")
        return
        
    csv_path = csv_files[0]
    print(f"📖 Lettura del dataset di origine: {csv_path}")
    df = pd.read_csv(csv_path)

    # 2. Mappatura intelligente delle colonne (TDCommons / TDC usano nomi scientifici differenti)
    col_mapping = {}
    for col in df.columns:
        col_lower = col.lower()
        if 'drug1' in col_lower or 'drug_a' in col_lower or 'id1' in col_lower:
            col_mapping[col] = 'farmacoA'
        elif 'drug2' in col_lower or 'drug_b' in col_lower or 'id2' in col_lower:
            col_mapping[col] = 'farmacoB'
        elif 'desc' in col_lower or 'note' in col_lower or 'effect' in col_lower or 'y' in col_lower:
            col_mapping[col] = 'nota'

    if len(col_mapping) < 2:
        print("⚠️ Colonne non standard rilevate. Associo per posizione fissa (0, 1, 2)")
        df.columns = ['farmacoA', 'farmacoB', 'nota'] + list(df.columns[3:])
    else:
        df.rename(columns=col_mapping, inplace=True)
        
    df['stato'] = 'incompatibile' # Richiesto dall'interfaccia grafica della PWA

    # 3. Traduzione Automatica dei Principi Attivi e delle Note
    print("🔄 Traduzione clinica automatica in corso...")
    traduzioni_farmaci = {
        "aspirin": "Acido acetilsalicilico", "acetaminophen": "Paracetamolo", 
        "paracetamol": "Paracetamolo", "diazepam": "Diazepam", "fentanyl": "Fentanyl", 
        "ceftriaxone": "Ceftriaxone", "amiodarone": "Amiodarone Cloridrato", 
        "warfarin": "Warfarin", "ibuprofen": "Ibuprofene", "midazolam": "Midazolam"
    }

    df['farmacoA'] = df['farmacoA'].astype(str).str.lower().str.strip().map(traduzioni_farmaci).fillna(df['farmacoA'].astype(str).str.capitalize())
    df['farmacoB'] = df['farmacoB'].astype(str).str.lower().str.strip().map(traduzioni_farmaci).fillna(df['farmacoB'].astype(str).str.capitalize())

    # Traduzione massiva delle stringhe inglesi tipiche dei database medici (DrugBank/TDC)
    def formalizza_nota(testo):
        if not isinstance(testo, str): return "Rischio di interazione clinica."
        t = testo.strip()
        t = t.replace("The risk or severity of adverse effects can be increased when", "Il rischio o la gravità degli effetti avversi può aumentare quando il")
        t = t.replace("is combined with", "viene combinato con")
        t = t.replace("The metabolism of", "Il metabolismo di")
        t = t.replace("can be decreased when combined with", "può essere ridotto se combinato con")
        t = t.replace("The serum concentration of", "La concentrazione sierica di")
        t = t.replace("can be increased when combined with", "può aumentare se combinato con")
        return t

    df['nota'] = df['nota'].apply(formalizza_nota)

    # Filtra e pulisce le colonne
    df_finale = df[['farmacoA', 'farmacoB', 'stato', 'nota']].dropna()

    # Rimuove i duplicati speculari (A+B e B+A vengono unificati per ottimizzare l'indice)
    df_finale['coppia_key'] = df_finale.apply(lambda r: "-".join(sorted([str(r['farmacoA']), str(r['farmacoB'])])), axis=1)
    df_finale.drop_duplicates(subset=['coppia_key'], inplace=True)
    df_finale.drop(columns=['coppia_key'], inplace=True)

    # 4. Sovrascrive il file finale che l'Action andrà a committare
    df_finale.to_csv('data/interazioni.csv', index=False)
    print(f"✅ Completato! Generato data/interazioni.csv con {len(df_finale)} record reali.")

if __name__ == '__main__':
    process_interactions()
