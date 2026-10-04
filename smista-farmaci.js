const fs = require('fs');
const path = require('path');

// Percorso del tuo file dei farmaci (verifica se si trova in src/data/ o altrove)
const PERCORSO_FILE = path.join(__dirname, 'src/data/farmaci.json');

// Mappatura basata sui codici ufficiali ATC dell'AIFA e le categorie della tua PWA
function ottieniDatiClasse(codiceATC) {
  if (!codiceATC) return null;
  const atc = codiceATC.toUpperCase().trim();

  // --- CARDIOVASCOLARE & IPERTENSIONE ---
  if (atc.startsWith('C09A') || atc.startsWith('C09B')) {
    return { id: 'ace-inibitori', nome: 'ACE-inibitori' };
  }
  if (atc.startsWith('C07')) {
    return { id: 'beta-bloccanti', nome: 'Beta-bloccanti' }; // Assicurati che l'ID esista nei filtri
  }
  if (atc.startsWith('C08')) {
    return { id: 'calcio-antagonisti', nome: 'Calcio-antagonisti' };
  }
  if (atc.startsWith('C03')) {
    return { id: 'diuretici', nome: 'Diuretici' };
  }
  if (atc.startsWith('C09C') || atc.startsWith('C09D')) {
    return { id: 'sartani', nome: 'Sartani (ARB)' };
  }
  if (atc.startsWith('C02') || atc.startsWith('C09X')) {
    return { id: 'antipertensivi', nome: 'Altri antipertensivi' };
  }
  if (atc.startsWith('C01A') || atc.startsWith('C01B')) {
    return { id: 'antiaritmici', nome: 'Antiaritmici' };
  }
  if (atc.startsWith('C01D')) {
    return { id: 'antianginosi', nome: 'Antianginosi' };
  }
  if (atc.startsWith('C10AA') || atc.startsWith('C10BA')) {
    return { id: 'statine', nome: 'Statine' };
  }
  if (atc.startsWith('C01C')) {
    return { id: 'antiadrenergici', nome: 'Antiadrenergici' };
  }

  // --- SANGUE & COAGULAZIONE ---
  if (atc.startsWith('B01AC') || atc === 'C10BX05') {
    return { id: 'antiaggreganti', nome: 'Antiaggreganti' };
  }
  if (atc.startsWith('B01A') && !atc.startsWith('B01AC')) {
    return { id: 'anticoagulanti', nome: 'Anticoagulanti' };
  }
  if (atc.startsWith('B02')) {
    return { id: 'antiemorragici', nome: 'Antiaggreganti ed emostatici' };
  }

  // --- SISTEMA GASTROINTESTINALE ---
  if (atc.startsWith('A02BC') || atc.startsWith('A02BA')) {
    return { id: 'antiacidi', nome: 'Antiacidi' }; // Comprende gli inibitori di pompa e anti-H2
  }
  if (atc.startsWith('A03F') || atc.startsWith('A04A')) {
    return { id: 'antiemetici', nome: 'Antiemetici' };
  }
  if (atc.startsWith('A07A') || atc.startsWith('A07D') || atc.startsWith('A07E')) {
    return { id: 'antidiarroici', nome: 'Antidiarroici' };
  }

  // --- SISTEMA NERVOSO & DOLORE ---
  if (atc.startsWith('N01')) {
    return { id: 'anestetici', nome: 'Anestetici' };
  }
  if (atc.startsWith('M01A') || atc.startsWith('N02B')) {
    return { id: 'fans', nome: 'Antidolorifici (FANS)' }; // Mappa FANS e antipiretici comuni (es Paracetamolo)
  }
  if (atc.startsWith('N02A')) {
    return { id: 'oppioidi', nome: 'Oppioidi' };
  }
  if (atc.startsWith('N03')) {
    return { id: 'antiepilettici', nome: 'Antiepilettici' };
  }
  if (atc.startsWith('N06AB')) {
    return { id: 'antidepressivi-ssri', nome: 'Antidepressivi SSRI' };
  }
  if (atc.startsWith('N05A') || atc.startsWith('N05A')) {
    return { id: 'neurolettici', nome: 'Neurolettici (antipsicotici)' };
  }

  // --- ALTRI INFETTIVI E SPECIALISTICI ---
  if (atc.startsWith('J01')) {
    return { id: 'antibiotici', nome: 'Antibiotici' };
  }
  if (atc.startsWith('J05')) {
    return { id: 'antivirali', nome: 'Antivirali' };
  }
  if (atc.startsWith('L04A')) {
    return { id: 'immunosoppressori', nome: 'Immunosoppressori' };
  }
  if (atc.startsWith('L01') || atc.startsWith('L02')) {
    return { id: 'chemioterapici-antineoplastici', nome: 'Chemioterapici antineoplastici' };
  }
  if (atc.startsWith('G03C') || atc.startsWith('L02B')) {
    return { id: 'antiandrogeni', nome: 'Antiandrogeni' };
  }
  if (atc.startsWith('V03') || atc.startsWith('V07')) {
    return { id: 'antidoti', nome: 'Antidoti' };
  }

  return null; // Ritorna null se la classe non è mappata o appartiene ad altre sezioni
}

function aggiornaDatabase() {
  try {
    if (!fs.existsSync(PERCORSO_FILE)) {
      throw new Error(`Il file non esiste nel percorso: ${PERCORSO_FILE}. Verifica la cartella.`);
    }

    const datiGrezzi = fs.readFileSync(PERCORSO_FILE, 'utf8');
    const farmaci = JSON.parse(datiGrezzi);

    let contatoreAggiornati = 0;

    const farmaciAggiornati = farmaci.map(farmaco => {
      // Se la classe è vuota o ha il valore generico dell'AIFA, la sovrascriviamo
      if (!farmaco.classeId || farmaco.classeId === "" || farmaco.classeNome === "Catalogo AIFA") {
        const nuovaClasse = ottieniDatiClasse(farmaco.atc);
        if (nuovaClasse) {
          farmaco.classeId = nuovaClasse.id;
          farmaco.classeNome = nuovaClasse.nome;
          contatoreAggiornati++;
        }
      }
      return farmaco;
    });

    fs.writeFileSync(PERCORSO_FILE, JSON.stringify(farmaciAggiornati, null, 2), 'utf8');
    console.log(`✅ Successo! Smistati correttamente ${contatoreAggiornati} farmaci orfani.`);
  } catch (errore) {
    console.error(`❌ Errore durante l'esecuzione:`, errore.message);
  }
}

aggiornaDatabase();
