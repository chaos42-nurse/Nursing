const fs = require('fs');
const path = require('path');

const PERCORSO_FILE = path.join(__dirname, 'src/data/farmaci.json');

// Mappatura precisa basata sul codice ATC dell'AIFA e sulle categorie della tua PWA
function ottieniDatiClasse(codiceATC, principio) {
  if (!codiceATC) return null;
  const atc = codiceATC.toUpperCase().trim();
  const nomeFarmaco = principio ? principio.toLowerCase() : "";

  // --- FOCUS COMPLETO SUI PREPARATI GASTROINTESTINALI & DIABETE ---
  if (atc.startsWith('A10B') || atc.startsWith('A10X') || nomeFarmaco.includes('acarbosio') || nomeFarmaco.includes('metformina')) {
    return { id: 'ipoglicemizzanti-orali', nome: 'Ipoglicemizzanti orali' };
  }
  if (atc.startsWith('A10A')) return { id: 'insuline', nome: 'Insuline' };
  if (atc.startsWith('A02BC') || atc.startsWith('A02BA')) return { id: 'antiacidi', nome: 'Antiacidi' };
  if (atc.startsWith('A03F') || atc.startsWith('A04A')) return { id: 'antiemetici', nome: 'Antiemetici' };
  if (atc.startsWith('A07A') || atc.startsWith('A07D')) return { id: 'antidiarroici', nome: 'Antidiarroici' };
  if (atc.startsWith('A03BA') || nomeFarmaco.includes('atropina')) return { id: 'antidoti', nome: 'Antidoti' };

  // --- CARDIOVASCOLARE, IPERTENSIONE & SANGUE ---
  if (atc.startsWith('C09A') || atc.startsWith('C09B')) return { id: 'ace-inibitori', nome: 'ACE-inibitori' };
  if (atc.startsWith('C07')) return { id: 'beta-bloccanti', nome: 'Beta-bloccanti' };
  if (atc.startsWith('C08')) return { id: 'calcio-antagonisti', nome: 'Calcio-antagonisti' };
  if (atc.startsWith('C03')) return { id: 'diuretici', nome: 'Diuretici' };
  if (atc.startsWith('C09C') || atc.startsWith('C09D') || atc.startsWith('C09X')) return { id: 'sartani', nome: 'Sartani (ARB)' };
  if (atc.startsWith('C02') || atc.startsWith('C01C')) return { id: 'antipertensivi', nome: 'Altri antipertensivi' };
  if (atc.startsWith('C01A') || atc.startsWith('C01B')) return { id: 'antiaritmics', nome: 'Antiaritmici' };
  if (atc.startsWith('C01D')) return { id: 'antianginosi', nome: 'Antianginosi' };
  if (atc.startsWith('C10AA') || atc.startsWith('C10BA') || atc.startsWith('C10B')) return { id: 'statine', nome: 'Statine' };
  if (atc.startsWith('B01AC')) return { id: 'antiaggreganti', nome: 'Antiaggreganti' };
  if (atc.startsWith('B01A')) return { id: 'anticoagulanti', nome: 'Anticoagulanti' };
  if (atc.startsWith('B02')) return { id: 'antiemorragici', nome: 'Antiaggreganti ed emostatici' };

  // --- CORTISONICI, DOLORE & NEUROLOGIA ---
  if (atc.startsWith('H02') || nomeFarmaco.includes('betametasone') || nomeFarmaco.includes('cortison')) {
    return { id: 'corticosteroidi', nome: 'Corticosteroidi' };
  }
  if (atc.startsWith('M01A') || atc.startsWith('N02B')) return { id: 'fans', nome: 'Antidolorifici (FANS)' };
  if (atc.startsWith('N02A')) return { id: 'oppioidi', nome: 'Oppioidi' };
  if (atc.startsWith('N03')) return { id: 'antiepilettici', nome: 'Antiepilettici' };
  if (atc.startsWith('N04')) return { id: 'anti-parkinson', nome: 'Farmaci anti-Parkinson' };
  if (atc.startsWith('N06A')) return { id: 'antidepressivi-ssri', nome: 'Antidepressivi SSRI' };
  if (atc.startsWith('N05A')) return { id: 'neurolettici', nome: 'Neurolettici (antipsicotici)' };
  if (atc.startsWith('N05B') || atc.startsWith('N05C')) return { id: 'benzodiazepine', nome: 'Benzodiazepine / Ansiolitici' };
  if (atc.startsWith('N01')) return { id: 'anestetici', nome: 'Anestetici' };

  // --- METABOLISMO OSSEO & DERMATOLOGIA ---
  if (atc.startsWith('M05B') || nomeFarmaco.includes('alendronico') || nomeFarmaco.includes('clodronico')) {
    return { id: 'fans', nome: 'Antidolorifici (FANS)' }; // Raggruppati nei FANS/Apparato muscolo-scheletrico per semplicitá
  }

  // --- INFRETTIVI & ALTRE CLASSI ---
  if (atc.startsWith('J01')) return { id: 'antibiotici', nome: 'Antibiotici' };
  if (atc.startsWith('J05')) return { id: 'antivirali', nome: 'Antivirali' };
  if (atc.startsWith('L04A')) return { id: 'immunosoppressori', nome: 'Immunosoppressori' };
  if (atc.startsWith('L01') || atc.startsWith('L02')) return { id: 'chemioterapici-antineoplastici', nome: 'Chemioterapici antineoplastici' };
  if (atc.startsWith('G03C') || atc.startsWith('L02B')) return { id: 'antiandrogeni', nome: 'Antiandrogeni' };
  if (atc.startsWith('V03') || atc.startsWith('V07') || atc.startsWith('S01')) return { id: 'antidoti', nome: 'Antidoti' };

  return null;
}

function aggiornaDatabase() {
  try {
    if (!fs.existsSync(PERCORSO_FILE)) {
      throw new Error(`File non esistente in: ${PERCORSO_FILE}`);
    }

    const datiGrezzi = fs.readFileSync(PERCORSO_FILE, 'utf8');
    const farmaci = JSON.parse(datiGrezzi);

    let contatoreAggiornati = 0;

    const farmaciAggiornati = farmaci.map(farmaco => {
      // Modifica sia i vuoti sia chi ha "Catalogo AIFA" generico
      if (!farmaco.classeId || farmaco.classeId === "" || farmaco.classeNome === "Catalogo AIFA") {
        const nuovaClasse = ottieniDatiClasse(farmaco.atc, farmaco.principioAttivo);
        if (nuovaClasse) {
          farmaco.classeId = nuovaClasse.id;
          farmaco.classeNome = nuovaClasse.nome;
          contatoreAggiornati++;
        }
      }
      return farmaco;
    });

    fs.writeFileSync(PERCORSO_FILE, JSON.stringify(farmaciAggiornati, null, 2), 'utf8');
    console.log(`✅ Database elaborato! Smistati correttamente ${contatoreAggiornati} farmaci.`);
  } catch (errore) {
    console.error(`❌ Errore durante lo smistamento:`, errore.message);
  }
}

aggiornaDatabase();
