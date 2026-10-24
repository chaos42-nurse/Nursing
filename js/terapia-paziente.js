/* =========================================================================
   NURSING SHOT — TERAPIA DEL PAZIENTE

   Funzioni pure (senza DOM) per leggere il testo libero dei campi "Allergie"
   e "Farmaci" della scheda paziente e:
     - collegare le allergie alle classi di farmaci in terapia;
     - ricavare l'elenco dei farmaci da passare al controllo interazioni.

   ATTENZIONE: il confronto si basa sul testo scritto dall'utente e su un
   elenco di gruppi di farmaci mantenuto a mano. E' un promemoria di supporto,
   non sostituisce l'anamnesi allergica ne' la valutazione del medico: un
   mancato avviso NON significa che la terapia sia sicura.
   ========================================================================= */

(function (root, factory) {
    if (typeof module === "object" && module.exports) {
        module.exports = factory();
    } else {
        root.NursingTerapia = factory();
    }
})(typeof self !== "undefined" ? self : this, function () {
    "use strict";

    function normalizza(testo) {
        return String(testo || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .replace(/[^a-z0-9]+/g, " ")
            .trim();
    }

    function parole(testo) {
        const n = normalizza(testo);
        return n ? n.split(" ") : [];
    }

    /* Una voce per riga, separata da virgola, punto e virgola o a capo.
       Il segno + resta dentro la voce (es. "Amoxicillina + acido clavulanico"). */
    function separaElenco(testo) {
        return String(testo || "")
            .split(/[\n;,]+/)
            .map(voce => voce.replace(/\s+/g, " ").trim())
            .filter(voce => voce && /[a-zA-ZÀ-ÿ]/.test(voce));
    }

    const PAROLE_NON_NOME = new Set([
        "mg", "g", "gr", "mcg", "ug", "ml", "ui", "u", "cpr", "cp", "compresse", "compressa", "fl", "fiala", "fiale",
        "f", "fv", "gtt", "gocce", "bustina", "bustine", "os", "per", "ev", "iv", "im", "sc", "sl", "die", "x", "h",
        "ore", "ora", "volte", "volta", "mattina", "sera", "al", "giorno", "se", "al bisogno", "bis", "tid", "bid"
    ]);

    /* "Furosemide 25 mg 1 cp x2" -> "Furosemide"; "2 cpr di Tachipirina" -> "Tachipirina". */
    function nomeFarmaco(voce) {
        const grezze = String(voce || "").replace(/\([^)]*\)/g, " ").split(/\s+/).filter(Boolean);
        const nome = [];
        let iniziato = false;
        for (const p of grezze) {
            const n = normalizza(p);
            if (!n) {
                if (iniziato && /^[+/]$/.test(p)) nome.push(p);
                continue;
            }
            const eNumero = /\d/.test(n);
            const eUnita = PAROLE_NON_NOME.has(n);
            if (!iniziato) {
                if (eNumero || eUnita || n === "di" || n === "da") continue;
                iniziato = true;
                nome.push(p);
                continue;
            }
            if (eNumero || (eUnita && n !== "per")) break;
            if (n === "per" || n === "al") break;
            nome.push(p);
        }
        return nome.join(" ").replace(/[.:]+$/, "").trim();
    }

    /* ---------------------------------------------------------------------
       GRUPPI DI FARMACI PER LE ALLERGIE
       classi:  parti di parola che, scritte nell'allergia, indicano la classe
       membri:  inizi di parola dei principi attivi/nomi commerciali (se la
                parola e' preceduta da "=" deve coincidere per intero)
       atc:     prefissi ATC (usati solo per gli antibiotici, quando il farmaco e' nel catalogo AIFA)
    --------------------------------------------------------------------- */
    const GRUPPI = [
        { id: "penicilline", nome: "Penicilline", classi: ["penicillin", "betalattam"],
          membri: ["penicillin", "benzilpenicillin", "benzatin", "amoxicillin", "ampicillin", "piperacillin", "oxacillin", "flucloxacillin", "augmentin", "zimox", "clavulan"],
          atc: ["J01C"] },
        { id: "cefalosporine", nome: "Cefalosporine", classi: ["cefalospor", "betalattam"],
          membri: ["cef", "rocefin"], atc: ["J01DB", "J01DC", "J01DD", "J01DE"] },
        { id: "carbapenemi", nome: "Carbapenemi", classi: ["carbapenem", "betalattam"],
          membri: ["meropenem", "imipenem", "ertapenem", "doripenem"], atc: ["J01DH"] },
        { id: "macrolidi", nome: "Macrolidi", classi: ["macrolid"],
          membri: ["eritromicin", "claritromicin", "azitromicin", "roxitromicin", "spiramicin", "josamicin", "zitromax"], atc: ["J01FA"] },
        { id: "fluorochinoloni", nome: "Fluorochinoloni", classi: ["chinolon"],
          membri: ["ciprofloxacin", "levofloxacin", "moxifloxacin", "ofloxacin", "norfloxacin", "prulifloxacin", "ciproxin", "tavanic"], atc: ["J01MA"] },
        { id: "tetracicline", nome: "Tetracicline", classi: ["tetraciclin"],
          membri: ["tetraciclin", "doxiciclin", "minociclin", "tigeciclin"], atc: ["J01AA"] },
        { id: "aminoglicosidi", nome: "Aminoglicosidi", classi: ["aminoglicosid"],
          membri: ["gentamicin", "amikacin", "tobramicin", "streptomicin", "neomicin"], atc: ["J01G"] },
        { id: "sulfamidici", nome: "Sulfamidici antibiotici", classi: ["sulfamid", "sulfonamid", "sulfa"],
          membri: ["sulfametossazol", "cotrimossazol", "trimetoprim", "sulfadiazin", "bactrim"], atc: ["J01E"] },
        { id: "fans", nome: "FANS e acido acetilsalicilico", classi: ["fans", "antinfiammator", "antiinfiammator", "nsaid", "aspirin", "salicilat"],
          membri: ["ibuprofen", "diclofenac", "ketoprofen", "ketorolac", "naprossen", "nimesulid", "meloxicam", "piroxicam", "indometacin", "etoricoxib",
              "celecoxib", "aceclofenac", "flurbiprofen", "dexketoprofen", "acetilsalicil", "aspirin", "cardioaspirin", "=asa", "brufen", "voltaren", "toradol", "aulin"],
          atc: ["M01A", "N02BA", "B01AC06", "A01AD05"] },
        { id: "oppioidi", nome: "Oppioidi", classi: ["oppioid", "oppiace"],
          membri: ["morfin", "codein", "tramadol", "ossicodon", "oxicodon", "fentanil", "fentanyl", "metadon", "buprenorfin", "idromorfon", "tapentadol", "petidin", "meperidin", "contramal"],
          atc: ["N02A", "R05DA"] },
        { id: "anestetici-locali", nome: "Anestetici locali", classi: ["anestetic"],
          membri: ["lidocain", "bupivacain", "mepivacain", "ropivacain", "articain", "prilocain", "xilocain"], atc: ["N01B"] },
        { id: "benzodiazepine", nome: "Benzodiazepine", classi: ["benzodiazep"],
          membri: ["diazepam", "lorazepam", "alprazolam", "midazolam", "clonazepam", "bromazepam", "delorazepam", "oxazepam", "tavor", "valium", "xanax"],
          atc: ["N05BA", "N05CD", "N03AE"] },
        { id: "ace-inibitori", nome: "ACE-inibitori", classi: ["aceinib", "ace inib"],
          membri: ["enalapril", "ramipril", "lisinopril", "captopril", "perindopril", "zofenopril", "benazepril", "quinapril", "fosinopril"],
          atc: ["C09A", "C09B"] },
        { id: "insuline", nome: "Insuline", classi: ["insulin"],
          membri: ["insulin", "lispro", "aspart", "glargine", "detemir", "degludec", "glulisin"], atc: ["A10A"] },
        { id: "eparine", nome: "Eparine", classi: ["eparin"],
          membri: ["eparin", "enoxaparin", "nadroparin", "dalteparin", "bemiparin", "clexane", "fraxiparin"], atc: ["B01AB"] },
        { id: "corticosteroidi", nome: "Corticosteroidi", classi: ["cortison", "corticosteroid", "steroid"],
          membri: ["prednison", "metilprednisolon", "idrocortison", "desametason", "betametason", "deflazacort", "triamcinolon", "budesonid", "fluticason", "beclometason", "cortison"],
          atc: ["H02A", "R03BA", "D07"] }
    ];

    /* L'ATC del catalogo AIFA e' quello del primo prodotto in elenco (es. "Paracetamolo" ha
       l'ATC dell'associazione con codeina), quindi si usa solo per gli antibiotici, dove e'
       affidabile; per le altre classi conta il nome del principio attivo. */
    GRUPPI.forEach(g => { g.usaAtc = g.atc.every(prefisso => prefisso.indexOf("J01") === 0); });

    function iniziaCon(parola, membro) {
        if (membro.charAt(0) === "=") return parola === membro.slice(1);
        return parola.indexOf(membro) === 0;
    }

    function trovaMembro(listaParole, gruppo) {
        for (const p of listaParole) {
            for (const m of gruppo.membri) {
                if (iniziaCon(p, m)) return m;
            }
        }
        return null;
    }

    /* Parole troppo generiche per dire che due nomi indicano lo stesso farmaco. */
    const PAROLE_GENERICHE = new Set(["acido", "sodico", "sodio", "cloridrato", "fosfato", "solfato", "potassio", "calcico", "calcio", "sale", "cpr", "compresse", "flaconi", "soluzione"]);

    /* ---------------------------------------------------------------------
       NOMI ALTERNATIVI (data/alias-farmaci.json) E CATALOGO AIFA
    --------------------------------------------------------------------- */
    function creaIndiceAlias(datiAlias) {
        const mappa = new Map();
        const alias = (datiAlias && datiAlias.alias) || {};
        for (const [en, nomi] of Object.entries(alias)) {
            const voce = { en, nomi: Array.isArray(nomi) ? nomi : [] };
            for (const nome of [en, ...voce.nomi]) {
                const chiave = normalizza(nome);
                if (chiave && !mappa.has(chiave)) mappa.set(chiave, voce);
            }
        }
        return mappa;
    }

    function creaIndiceAifa(lista) {
        const mappa = new Map();
        for (const f of (Array.isArray(lista) ? lista : [])) {
            const chiave = normalizza(f.principioAttivo);
            if (chiave && !mappa.has(chiave)) mappa.set(chiave, f);
            const prima = chiave.split(" ")[0];
            const singolo = !/[+/]/.test(String(f.principioAttivo));
            if (singolo && prima && prima.length > 3 && !mappa.has(prima)) mappa.set(prima, f);
        }
        return mappa;
    }

    /* Sinonimi e ATC di un farmaco scritto dall'utente. */
    function descriviFarmaco(voce, contesto) {
        const nome = nomeFarmaco(voce) || voce;
        const base = parole(nome);
        const chiavi = new Set([base.join(" "), ...base]);
        for (let i = 0; i + 1 < base.length; i++) chiavi.add(base[i] + " " + base[i + 1]);

        const bag = new Set(base);
        let atc = "";

        for (const chiave of chiavi) {
            const a = contesto.alias && contesto.alias.get(chiave);
            if (a) {
                parole(a.en).forEach(p => bag.add(p));
                a.nomi.forEach(n => parole(n).forEach(p => bag.add(p)));
            }
        }
        for (const parolaBag of [...bag]) {
            const f = contesto.aifa && contesto.aifa.get(parolaBag);
            if (f) {
                if (!atc && f.atc) atc = String(f.atc).toUpperCase();
                parole(f.principioAttivo).forEach(p => bag.add(p));
            }
        }
        const intero = contesto.aifa && contesto.aifa.get(base.join(" "));
        if (intero && intero.atc) atc = String(intero.atc).toUpperCase();

        return { voce, nome, parole: [...bag], atc };
    }

    /* ---------------------------------------------------------------------
       CONTROLLO ALLERGIE
       Restituisce:
         avvisi:      { farmaco, allergia, gruppo, tipo }  tipo = "stesso" | "classe"
         nonCollegate: voci di allergia che non corrispondono a un gruppo di farmaci
    --------------------------------------------------------------------- */
    function controllaAllergie(opzioni) {
        const contesto = { alias: opzioni.alias || null, aifa: opzioni.aifa || null };
        const allergie = separaElenco(opzioni.allergie);
        const farmaci = separaElenco(opzioni.farmaci).map(v => descriviFarmaco(v, contesto));
        const avvisi = [];
        const nonCollegate = [];
        const visti = new Set();

        for (const allergia of allergie) {
            const testoN = normalizza(allergia);
            const paroleA = parole(allergia);
            let collegata = false;

            for (const gruppo of GRUPPI) {
                const perClasse = gruppo.classi.some(c => testoN.indexOf(c) !== -1);
                const membroNominato = trovaMembro(paroleA, gruppo);
                if (!perClasse && !membroNominato) continue;
                collegata = true;

                for (const f of farmaci) {
                    const membroFarmaco = trovaMembro(f.parole, gruppo);
                    const perAtc = gruppo.usaAtc && f.atc && gruppo.atc.some(prefisso => f.atc.indexOf(prefisso) === 0);
                    if (!membroFarmaco && !perAtc) continue;

                    const stesso = !!(membroNominato && f.parole.some(p => iniziaCon(p, membroNominato))) ||
                        paroleA.some(p => p.length > 5 && !PAROLE_GENERICHE.has(p) && f.parole.indexOf(p) !== -1);
                    const chiave = f.voce + "|" + allergia + "|" + gruppo.id;
                    if (visti.has(chiave)) continue;
                    visti.add(chiave);
                    avvisi.push({
                        farmaco: f.voce,
                        allergia,
                        gruppo: gruppo.nome,
                        tipo: stesso ? "stesso" : "classe"
                    });
                }
            }
            if (!collegata) nonCollegate.push(allergia);
        }

        /* Prima i principi attivi uguali a quello dichiarato, poi le classi. */
        avvisi.sort((a, b) => (a.tipo === b.tipo ? 0 : a.tipo === "stesso" ? -1 : 1));
        return { avvisi, nonCollegate, nFarmaci: farmaci.length, nAllergie: allergie.length };
    }


    /* ---------------------------------------------------------------------
       INTERAZIONI TRA I FARMACI IN TERAPIA
       NI = modulo js/interazioni.js, idx = indice gia' caricato.
       Solo le corrispondenze ESATTE vengono usate: gli altri nomi sono elencati
       a parte con le possibili alternative, senza mai scegliere al posto dell'utente.
       Restituisce:
         coppie:          { a, b, nomeA, nomeB, categoria, curate, esito }  (solo con segnalazioni)
         nonRiconosciuti: { voce, suggerimenti }
         riconosciuti:    nomi dei farmaci trovati nell'archivio
         nCoppie:         numero di coppie controllate
    --------------------------------------------------------------------- */
    const ORDINE_CATEGORIA = { rischio: 0, attenzione: 1, nota: 2 };

    function controllaInterazioni(NI, idx, testoFarmaci) {
        const voci = separaElenco(testoFarmaci);
        const trovati = [];            // { id, voce, gruppo }
        const nonRiconosciuti = [];

        voci.forEach((voce, gruppo) => {
            const nome = nomeFarmaco(voce) || voce;
            const diretto = NI.risolvi(idx, nome);
            if (diretto.tipo === "esatto") {
                trovati.push({ id: diretto.id, voce, gruppo });
                return;
            }

            /* "Amoxicillina + acido clavulanico": prova a riconoscere ogni parte. */
            const parti = nome.split(/\s*[+/]\s*/).filter(Boolean);
            if (parti.length > 1) {
                const risolte = parti.map(parte => NI.risolvi(idx, parte));
                if (risolte.every(r => r.tipo === "esatto")) {
                    risolte.forEach(r => trovati.push({ id: r.id, voce, gruppo }));
                    return;
                }
            }
            nonRiconosciuti.push({
                voce,
                suggerimenti: diretto.tipo === "candidati" ? diretto.candidati.slice(0, 3).map(c => c.label) : []
            });
        });

        const unici = [];
        const visti = new Set();
        for (const t of trovati) {
            if (visti.has(t.id)) continue;
            visti.add(t.id);
            unici.push(t);
        }

        const coppie = [];
        let nCoppie = 0;
        for (let i = 0; i < unici.length; i++) {
            for (let j = i + 1; j < unici.length; j++) {
                if (unici[i].gruppo === unici[j].gruppo) continue;   // parti dello stesso preparato
                nCoppie++;
                const a = unici[i].id;
                const b = unici[j].id;
                const curate = NI.verificaCurate(idx, a, b);
                const esito = NI.verificaCoppia(idx, a, b);
                if (!curate.length && esito.esito === "nessuna") continue;

                const categorie = [...curate.map(c => c.categoria), ...(esito.voci.length ? [esito.esito] : [])];
                categorie.sort((x, y) => ORDINE_CATEGORIA[x] - ORDINE_CATEGORIA[y]);
                coppie.push({
                    a, b,
                    nomeA: NI.nomeVisto(idx, a),
                    nomeB: NI.nomeVisto(idx, b),
                    categoria: categorie[0] || "nota",
                    curate,
                    esito
                });
            }
        }
        coppie.sort((x, y) => ORDINE_CATEGORIA[x.categoria] - ORDINE_CATEGORIA[y.categoria]);

        return {
            coppie,
            nonRiconosciuti,
            riconosciuti: unici.map(t => NI.nomeVisto(idx, t.id)),
            nCoppie
        };
    }

    return {
        GRUPPI,
        normalizza,
        separaElenco,
        nomeFarmaco,
        creaIndiceAlias,
        creaIndiceAifa,
        descriviFarmaco,
        controllaAllergie,
        controllaInterazioni
    };
});
