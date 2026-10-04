const fs = require('fs');
const path = require('path');

const PERCORSO_FILE = path.join(__dirname, 'src/data/farmaci.json');

// Mappatura basata sui codici ufficiali ATC e le categorie della tua PWA
function ottieniDatiClasse(codiceATC) {
  if (!codiceATC) return { id: '', nome: 'Catalogo AIFA' };
  const atc = codiceATC.toUpperCase().trim();

  if (atc.startsWith('C09A') || atc.startsWith('C09B')) return { id: 'ace-inibitori', nome: 'ACE-inibitori' };
  if (atc.startsWith('C07')) return { id: 'beta-bloccanti', nome: 'Beta-bloccanti' };
  if (atc.startsWith('C08')) return { id: 'calcio-antagonisti', nome: 'Calcio-antagonisti' };
  if (atc.startsWith('C03')) return { id: 'diuretici', nome: 'Diuretici' };
  if (atc.startsWith('C09C') || atc.startsWith('C09D')) return { id: 'sartani', nome: 'Sartani (ARB)' };
  if (atc.startsWith('C02') || atc.startsWith('C09X')) return { id: 'antipertensivi', nome: 'Altri antipertensivi' };
  if (atc.startsWith('C01A') || atc.startsWith('C01B')) return { id: 'antiaritmici', nome: 'Antiaritmici' };
  if (atc.startsWith('C01D')) return { id: 'antianginosi', nome: 'Antianginosi' };
  if (atc.startsWith('C10AA') || atc.startsWith('C10BA')) return { id: 'statine', nome: 'Statine' };
  if (atc.startsWith('C01C')) return { id: 'antiadrenergici', nome: 'Antiadrenergici' };
  if (atc.startsWith('B01AC') || atc === 'C10BX05') return { id: 'antiaggreganti', nome: 'Antiaggreganti' };
  if (atc.startsWith('B01A')) return { id: 'anticoagulanti', nome: 'Anticoagulanti' };
  if (atc.startsWith('B02')) return { id: 'antiemorragici', nome: 'Antiaggreganti ed emostatici' };
  if (atc.startsWith('A02BC') || atc.startsWith('A02BA')) return { id: 'antiacidi', nome: 'Antiacidi' };
  if (atc.startsWith('A03F') || atc.startsWith('A04A')) return { id: 'antiemetici', nome: 'Antiemetici' };
  if (atc.startsWith('A07A') || atc.startsWith('A07D') || atc.startsWith('A07E')) return { id: 'antidiarroici', nome: 'Antidiarroici' };
  if (atc.startsWith('N01')) return { id: 'anestetici', nome: 'Anestetici' };
  if (atc.startsWith('M01A') || atc.startsWith('N02B')) return { id: 'fans', nome: 'Antidolorifici (FANS)' };
  if (atc.startsWith('N02A')) return { id: 'oppioidi', nome: 'Oppioidi' };
  if (atc.startsWith('N03')) return { id: 'antiepilettici', nome: 'Antiepilettici' };
  if (atc.startsWith('N06AB') || atc.startsWith('N06A')) return { id: 'antidepressivi-ssri', nome: 'Antidepressivi SSRI' };
  if (atc.startsWith('N05A')) return { id: 'neurolettici', nome: 'Neurolettici (antipsicotici)' };
  if (atc.startsWith('N05B') || atc.startsWith('N05C')) return { id: 'benzodiazepine', nome: 'Benzodiazepine / Ansiolitici' };
  if (atc.startsWith('J01')) return { id: 'antibiotici', nome: 'Antibiotici' };
  if (atc.startsWith('J05')) return { id: 'antivirali', nome: 'Antivirali' };
  if (atc.startsWith('L04A')) return { id: 'immunosoppressori', nome: 'Immunosoppressori' };
  if (atc.startsWith('L01') || atc.startsWith('L02')) return { id: 'chemioterapici-antineoplastici', nome: 'Chemioterapici antineoplastici' };
  if (atc.startsWith('G03C') || atc.startsWith('L02B')) return { id: 'antiandrogeni', nome: 'Antiandrogeni' };
  if (atc.startsWith('V03') || atc.startsWith('V07')) return { id: 'antidoti', nome: 'Antidoti' };

  return { id: '', nome: 'Catalogo AIFA' };
}

function convertiFormato() {
  try {
    if (!fs.existsSync(PERCORSO_FILE)) {
      throw new Error(`File non trovato in: ${PERCORSO_FILE}`);
    }

    const datiGrezzi = fs.readFileSync(PERCORSO_FILE, 'utf8');
    const farmaciGrezzi = JSON.parse(datiGrezzi);

    // Mappiamo i campi vecchi trasformandoli nel formato corretto per la PWA
    const farmaciConvertiti = farmaciGrezzi.map(f => {
      const codiceATC = f["ATC"] || "";
      const classeSelezionata = ottieniDatiClasse(codiceATC);

      return {
        principioAttivo: f["Principio attivo"] || "",
        classeId: classeSelezionata.id,
        classeNome: classeSelezionata.nome,
        atc: codiceATC
      };
    });

    // Rimuoviamo i duplicati per principio attivo per non appesantire l'indice della PWA
    const mappaUnici = Array.from(new Map(farmaciConvertiti.map(f => [f.principioAttivo, f])).values());

    // Sovrascriviamo il file farmaci.json con il formato corretto
    fs.writeFileSync(PERCORSO_FILE, JSON.stringify(mappaUnici, null, 2), 'utf8');
    console.log(`✅ Trasformazione riuscita! Struttura uniformata per ${mappaUnici.length} farmaci.`);
  } catch (errore) {
    console.error(`❌ Errore durante la conversione:`, errore.message);
  }
}

convertiFormato();
