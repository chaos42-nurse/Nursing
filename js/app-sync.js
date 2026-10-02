// ==========================================
// 1. Inizializzazione Database Locale (Dexie)
// ==========================================
const db = new Dexie('NursingDatabase');

// Definiamo lo schema del DB locale
// 'id' è la chiave primaria automatica, 'principio_attivo' e 'codice_atc' sono indicizzati per ricerche veloci
db.version(1).stores({
  farmaci: '++id, principio_attivo, codice_atc, gruppo_atc'
});

// URL dei file sul tuo repository GitHub Pages / Raw
const VERSION_URL = 'https://raw.githubusercontent.com/chaos42-nurse/Nursing/main/public/data/version.json';
const FARMACI_URL = 'https://raw.githubusercontent.com/chaos42-nurse/Nursing/main/public/data/farmaci.json';

// ==========================================
// 2. Funzione di Sincronizzazione Dati
// ==========================================
async function syncFarmaciData() {
  // Se il dispositivo è offline, interrompi la sincronizzazione
  if (!navigator.onLine) {
    console.log('[Sync] Dispositivo offline. Utilizzo dati locali.');
    return;
  }

  try {
    console.log('[Sync] Controllo aggiornamenti dal server...');
    
    // Fetch del file versione remoto
    const versionResponse = await fetch(VERSION_URL, { cache: 'no-cache' });
    if (!versionResponse.ok) throw new Error('Impossibile recuperare version.json');
    const remoteVersionData = await versionResponse.json();
    const remoteVersion = remoteVersionData.version;

    // Recupera la versione salvata in locale
    const localVersion = parseInt(localStorage.getItem('nursing_db_version') || '0', 10);

    console.log(`[Sync] Versione Locale: ${localVersion} | Versione Remota: ${remoteVersion}`);

    // Se la versione remota è più recente (o se è il primo avvio)
    if (remoteVersion > localVersion) {
      console.log('[Sync] Nuova versione trovata! Scarico farmaci.json...');
      
      const farmaciResponse = await fetch(FARMACI_URL, { cache: 'no-cache' });
      if (!farmaciResponse.ok) throw new Error('Impossibile recuperare farmaci.json');
      const farmaciData = await farmaciResponse.json();

      // Transazione per aggiornare il DB locale in modo atomico
      await db.transaction('rw', db.farmaci, async () => {
        // Svuota i vecchi dati
        await db.farmaci.clear();
        // Inserisce i nuovi principi attivi
        await db.farmaci.bulkAdd(farmaciData);
      });

      // Salva la nuova versione in localStorage
      localStorage.setItem('nursing_db_version', remoteVersion);
      console.log(`[Sync] Database aggiornato con successo alla versione ${remoteVersion}!`);
      
      // Opzionale: Notifica l'utente nell'interfaccia
      if (typeof showToast === 'function') {
        showToast(`Database farmaci aggiornato (v${remoteVersion})`);
      }
    } else {
      console.log('[Sync] Il database locale è già aggiornato.');
    }
  } catch (error) {
    console.error('[Sync] Errore durante la sincronizzazione:', error);
  }
}

// ==========================================
// 3. Funzioni di Ricerca per l'Interfaccia (Offline Ready)
// ==========================================

/**
 * Cerca principi attivi nel database locale (Funziona 100% OFFLINE)
 * @param {string} queryText - Testo cercato dall'infermiere
 * @returns {Promise<Array>} Lista di farmaci trovati
 */
async function cercaFarmaco(queryText) {
  if (!queryText || queryText.trim() === '') return [];

  const text = queryText.trim().toUpperCase();

  // Cerca per principio attivo o codice ATC nel DB locale
  return await db.farmaci
    .filter(f => f.principio_attivo.includes(text) || f.codice_atc.includes(text))
    .limit(50) // Limita a 50 risultati per prestazioni fluide
    .toArray();
}

// ==========================================
// 4. Event Listeners per l'Avvio e il Ritorno Online
// ==========================================

// Controllo all'avvio dell'app
document.addEventListener('DOMContentLoaded', () => {
  syncFarmaciData();
});

// Ascolta l'evento "online": quando il dispositivo ritrova la connessione, avvia lo sync
window.addEventListener('online', () => {
  console.log('[Network] Connessione ripristinata. Avvio sincronizzazione...');
  syncFarmaciData();
});
