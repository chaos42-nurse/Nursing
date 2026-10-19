// Smista i principi attivi nelle classi farmacologiche dell'app in base al codice ATC.
// La tabella è in src/data/atc-classi.json (condivisa con l'app): vince il prefisso ATC più lungo,
// poi le eccezioni per nome. Le classi sono quelle di data/farmaci.json (es. "Anti-dipendenza"),
// non macro-aree generiche.
const fs = require('fs');
const path = require('path');

const TABELLA = JSON.parse(fs.readFileSync(path.join(__dirname, 'atc-classi.json'), 'utf8'));

// File da smistare: [percorso, rientro del JSON (null = compatto)]
const FILE_DA_SMISTARE = [
  [path.join(__dirname, 'farmaci.json'), 2],
  [path.join(__dirname, 'aifa-principi-attivi.json'), null]
];

const REGOLE = TABELLA.regole.slice().sort((a, b) => b.atc.length - a.atc.length);

const normalizza = testo => String(testo || '')
  .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

function ottieniDatiClasse(codiceATC, principio) {
  const eccezione = TABELLA.eccezioni[normalizza(principio)];
  if (eccezione && TABELLA.classi[eccezione]) return { id: eccezione, nome: TABELLA.classi[eccezione] };

  const atc = String(codiceATC || '').toUpperCase().trim();
  if (!atc) return null;
  const regola = REGOLE.find(r => atc.startsWith(r.atc));
  if (!regola || !TABELLA.classi[regola.id]) return null;
  return { id: regola.id, nome: TABELLA.classi[regola.id] };
}

function smistaFile(percorso, rientro) {
  if (!fs.existsSync(percorso)) {
    throw new Error(`File non esistente in: ${percorso}`);
  }

  const farmaci = JSON.parse(fs.readFileSync(percorso, 'utf8'));
  let contatoreAggiornati = 0;

  const aggiornati = farmaci.map(farmaco => {
    const classe = ottieniDatiClasse(farmaco.atc, farmaco.principioAttivo);
    if (classe && (farmaco.classeId !== classe.id || farmaco.classeNome !== classe.nome)) {
      farmaco.classeId = classe.id;
      farmaco.classeNome = classe.nome;
      contatoreAggiornati++;
    }
    return farmaco;
  });

  fs.writeFileSync(percorso, JSON.stringify(aggiornati, null, rientro || undefined) + (rientro ? '\n' : ''), 'utf8');
  const senzaClasse = aggiornati.filter(f => !f.classeId).length;
  console.log(`✅ ${path.basename(percorso)}: ${contatoreAggiornati} aggiornati, ${senzaClasse} senza classe.`);
}

try {
  FILE_DA_SMISTARE.forEach(([percorso, rientro]) => smistaFile(percorso, rientro));
} catch (errore) {
  console.error(`❌ Errore durante lo smistamento:`, errore.message);
  process.exitCode = 1;
}
