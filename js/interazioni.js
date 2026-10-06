/* =========================================================================
   NURSING SHOT — INTERAZIONI TRA FARMACI

   Legge direttamente lo ZIP originale (data/db_drug_interactions.csv.zip,
   dataset DrugBank/TDC in inglese), lo traduce in italiano e permette di
   verificare una coppia di farmaci. Nessuna dipendenza esterna: funziona
   offline una volta che lo ZIP è nella cache del service worker.

   Il dataset descrive ogni interazione con una delle 86 frasi-modello
   inglesi (es. "{A} may increase the hypotensive activities of {B}.").
   Qui sotto ciascun modello ha la sua traduzione italiana e una categoria.

   ATTENZIONE: la categoria (rischio / attenzione / nota) è una
   classificazione indicativa basata sul TIPO di effetto descritto. Il
   dataset di origine NON riporta la gravità clinica dell'interazione.
   ========================================================================= */

(function (root, factory) {
    if (typeof module === "object" && module.exports) {
        module.exports = factory();
    } else {
        root.NursingInterazioni = factory();
    }
})(typeof self !== "undefined" ? self : this, function () {
    "use strict";

    const R = "rischio";
    const W = "attenzione";
    const N = "nota";

    const ETICHETTE = {
        rischio: "Possibili effetti avversi",
        attenzione: "Attenzione: possibile variazione di effetto o concentrazioni",
        nota: "Interazione segnalata (riduce un effetto avverso)",
        nessuna: "Nessuna interazione registrata nel database"
    };

    const ORDINE_CATEGORIE = { rischio: 0, attenzione: 1, nota: 2 };

    /* ---------------------------------------------------------------------
       MODELLI: [inglese originale, traduzione italiana, categoria]
       {A} e {B} vengono sostituiti con i nomi dei farmaci. Le frasi italiane
       sono scritte in modo da non dipendere dal genere dei nomi.
    --------------------------------------------------------------------- */
    const MODELLI = [
        ["The risk or severity of adverse effects can be increased when {A} is combined with {B}.",
         "Il rischio o la gravità degli effetti avversi può aumentare quando {A} e {B} vengono associati.", R],
        ["The metabolism of {B} can be decreased when combined with {A}.",
         "Il metabolismo di {B} può risultare ridotto in associazione con {A}.", W],
        ["The serum concentration of {B} can be increased when it is combined with {A}.",
         "La concentrazione sierica di {B} può aumentare in associazione con {A}.", W],
        ["The serum concentration of {B} can be decreased when it is combined with {A}.",
         "La concentrazione sierica di {B} può diminuire in associazione con {A}.", W],
        ["{A} may increase the hypotensive activities of {B}.",
         "{A} può potenziare l'effetto ipotensivo di {B}.", R],
        ["The therapeutic efficacy of {B} can be decreased when used in combination with {A}.",
         "L'efficacia terapeutica di {B} può risultare ridotta in caso di uso in associazione con {A}.", W],
        ["{A} may increase the QTc-prolonging activities of {B}.",
         "{A} può potenziare l'effetto di prolungamento dell'intervallo QTc di {B}.", R],
        ["{A} may increase the central nervous system depressant (CNS depressant) activities of {B}.",
         "{A} può potenziare l'effetto depressivo sul sistema nervoso centrale (SNC) di {B}.", R],
        ["The metabolism of {B} can be increased when combined with {A}.",
         "Il metabolismo di {B} può risultare aumentato in associazione con {A}.", W],
        ["{A} may increase the anticoagulant activities of {B}.",
         "{A} può potenziare l'effetto anticoagulante di {B}.", R],
        ["{A} may decrease the antihypertensive activities of {B}.",
         "{A} può ridurre l'effetto antipertensivo di {B}.", W],
        ["{A} may increase the hypoglycemic activities of {B}.",
         "{A} può potenziare l'effetto ipoglicemizzante di {B}.", R],
        ["{A} may decrease the excretion rate of {B} which could result in a higher serum level.",
         "{A} può ridurre la velocità di eliminazione di {B}, con possibile aumento dei livelli sierici.", W],
        ["{A} may increase the bradycardic activities of {B}.",
         "{A} può potenziare l'effetto bradicardizzante di {B}.", R],
        ["{A} may increase the hypokalemic activities of {B}.",
         "{A} può potenziare l'effetto ipokaliemizzante di {B}.", R],
        ["{A} may decrease the cardiotoxic activities of {B}.",
         "{A} può ridurre l'effetto cardiotossico di {B}.", N],
        ["{A} may increase the sedative activities of {B}.",
         "{A} può potenziare l'effetto sedativo di {B}.", R],
        ["{A} may increase the neuroexcitatory activities of {B}.",
         "{A} può potenziare l'effetto neuroeccitatorio di {B}.", R],
        ["{A} can cause a decrease in the absorption of {B} resulting in a reduced serum concentration and potentially a decrease in efficacy.",
         "{A} può ridurre l'assorbimento di {B}, con riduzione della concentrazione sierica e possibile perdita di efficacia.", W],
        ["{A} may increase the serotonergic activities of {B}.",
         "{A} può potenziare l'effetto serotoninergico di {B}.", R],
        ["{A} may increase the atrioventricular blocking (AV block) activities of {B}.",
         "{A} può potenziare l'effetto di blocco atrioventricolare (blocco AV) di {B}.", R],
        ["{A} may increase the hypertensive activities of {B}.",
         "{A} può potenziare l'effetto ipertensivo di {B}.", R],
        ["{A} may increase the nephrotoxic activities of {B}.",
         "{A} può potenziare l'effetto nefrotossico di {B}.", R],
        ["{A} may increase the antihypertensive activities of {B}.",
         "{A} può potenziare l'effetto antipertensivo di {B}.", R],
        ["{A} may increase the orthostatic hypotensive activities of {B}.",
         "{A} può potenziare l'effetto ipotensivo ortostatico di {B}.", R],
        ["{A} may decrease the sedative activities of {B}.",
         "{A} può ridurre l'effetto sedativo di {B}.", W],
        ["The serum concentration of the active metabolites of {B} can be increased when {B} is used in combination with {A}.",
         "La concentrazione sierica dei metaboliti attivi di {B} può aumentare se {B} è usato in associazione con {A}.", W],
        ["The bioavailability of {B} can be decreased when combined with {A}.",
         "La biodisponibilità di {B} può risultare ridotta in associazione con {A}.", W],
        ["{A} may decrease the stimulatory activities of {B}.",
         "{A} può ridurre l'effetto stimolante di {B}.", W],
        ["The risk or severity of QTc prolongation can be increased when {A} is combined with {B}.",
         "Il rischio o la gravità del prolungamento dell'intervallo QTc può aumentare quando {A} e {B} vengono associati.", R],
        ["{A} may increase the fluid retaining activities of {B}.",
         "{A} può potenziare l'effetto di ritenzione idrica di {B}.", R],
        ["{A} may increase the neuromuscular blocking activities of {B}.",
         "{A} può potenziare l'effetto di blocco neuromuscolare di {B}.", R],
        ["{A} may increase the tachycardic activities of {B}.",
         "{A} può potenziare l'effetto tachicardizzante di {B}.", R],
        ["{A} may decrease the bronchodilatory activities of {B}.",
         "{A} può ridurre l'effetto broncodilatatore di {B}.", W],
        ["{A} may increase the arrhythmogenic activities of {B}.",
         "{A} può potenziare l'effetto aritmogeno di {B}.", R],
        ["{A} may increase the antiplatelet activities of {B}.",
         "{A} può potenziare l'effetto antiaggregante piastrinico di {B}.", R],
        ["{A} may decrease the diuretic activities of {B}.",
         "{A} può ridurre l'effetto diuretico di {B}.", W],
        ["{A} may increase the anticholinergic activities of {B}.",
         "{A} può potenziare l'effetto anticolinergico di {B}.", R],
        ["{A} may increase the immunosuppressive activities of {B}.",
         "{A} può potenziare l'effetto immunosoppressivo di {B}.", R],
        ["The serum concentration of the active metabolites of {B} can be reduced when {B} is used in combination with {A} resulting in a loss in efficacy.",
         "La concentrazione sierica dei metaboliti attivi di {B} può ridursi se {B} è usato in associazione con {A}, con possibile perdita di efficacia.", W],
        ["{A} may decrease the vasoconstricting activities of {B}.",
         "{A} può ridurre l'effetto vasocostrittore di {B}.", W],
        ["{A} may increase the respiratory depressant activities of {B}.",
         "{A} può potenziare l'effetto di depressione respiratoria di {B}.", R],
        ["{A} may increase the analgesic activities of {B}.",
         "{A} può potenziare l'effetto analgesico di {B}.", W],
        ["{A} may increase the hyperkalemic activities of {B}.",
         "{A} può potenziare l'effetto iperkaliemizzante di {B}.", R],
        ["The therapeutic efficacy of {B} can be increased when used in combination with {A}.",
         "L'efficacia terapeutica di {B} può risultare aumentata in caso di uso in associazione con {A}.", W],
        ["{A} may decrease the anticoagulant activities of {B}.",
         "{A} può ridurre l'effetto anticoagulante di {B}.", W],
        ["{A} may increase the cardiotoxic activities of {B}.",
         "{A} può potenziare l'effetto cardiotossico di {B}.", R],
        ["{A} may increase the hypocalcemic activities of {B}.",
         "{A} può potenziare l'effetto ipocalcemizzante di {B}.", R],
        ["{A} may increase the constipating activities of {B}.",
         "{A} può potenziare l'effetto costipante di {B}.", R],
        ["The risk or severity of bleeding can be increased when {A} is combined with {B}.",
         "Il rischio o la gravità di sanguinamento può aumentare quando {A} e {B} vengono associati.", R],
        ["{A} may increase the hyponatremic activities of {B}.",
         "{A} può potenziare l'effetto iponatremizzante di {B}.", R],
        ["{A} may increase the vasoconstricting activities of {B}.",
         "{A} può potenziare l'effetto vasocostrittore di {B}.", R],
        ["{A} may increase the thrombogenic activities of {B}.",
         "{A} può potenziare l'effetto trombogenico di {B}.", R],
        ["{A} may increase the antipsychotic activities of {B}.",
         "{A} può potenziare l'effetto antipsicotico di {B}.", W],
        ["{A} may increase the adverse neuromuscular activities of {B}.",
         "{A} può potenziare gli effetti neuromuscolari avversi di {B}.", R],
        ["{A} may increase the hypercalcemic activities of {B}.",
         "{A} può potenziare l'effetto ipercalcemizzante di {B}.", R],
        ["{A} can cause an increase in the absorption of {B} resulting in an increased serum concentration and potentially a worsening of adverse effects.",
         "{A} può aumentare l'assorbimento di {B}, con aumento della concentrazione sierica e possibile peggioramento degli effetti avversi.", R],
        ["{A} may decrease the neuromuscular blocking activities of {B}.",
         "{A} può ridurre l'effetto di blocco neuromuscolare di {B}.", W],
        ["{A} may increase the neurotoxic activities of {B}.",
         "{A} può potenziare l'effetto neurotossico di {B}.", R],
        ["{A} may increase the myopathic rhabdomyolysis activities of {B}.",
         "{A} può potenziare l'effetto miopatico (rabdomiolisi) di {B}.", R],
        ["{A} may increase the vasopressor activities of {B}.",
         "{A} può potenziare l'effetto vasopressore di {B}.", R],
        ["{A} may increase the hepatotoxic activities of {B}.",
         "{A} può potenziare l'effetto epatotossico di {B}.", R],
        ["{A} may increase the stimulatory activities of {B}.",
         "{A} può potenziare l'effetto stimolante di {B}.", W],
        ["The absorption of {B} can be decreased when combined with {A}.",
         "L'assorbimento di {B} può risultare ridotto in associazione con {A}.", W],
        ["{A} may increase the ulcerogenic activities of {B}.",
         "{A} può potenziare l'effetto ulcerogeno di {B}.", R],
        ["{A} may increase the myelosuppressive activities of {B}.",
         "{A} può potenziare l'effetto mielosoppressivo di {B}.", R],
        ["{A} may decrease effectiveness of {B} as a diagnostic agent.",
         "{A} può ridurre l'efficacia di {B} come agente diagnostico.", W],
        ["{A} may increase the vasodilatory activities of {B}.",
         "{A} può potenziare l'effetto vasodilatatore di {B}.", R],
        ["{A} may increase the excretion rate of {B} which could result in a lower serum level and potentially a reduction in efficacy.",
         "{A} può aumentare la velocità di eliminazione di {B}, con possibile riduzione dei livelli sierici e dell'efficacia.", W],
        ["{A} may increase the hyperglycemic activities of {B}.",
         "{A} può potenziare l'effetto iperglicemizzante di {B}.", R],
        ["The risk of a hypersensitivity reaction to {B} is increased when it is combined with {A}.",
         "Il rischio di reazione di ipersensibilità a {B} aumenta in associazione con {A}.", R],
        ["{A} may increase the central nervous system depressant (CNS depressant) and hypertensive activities of {B}.",
         "{A} può potenziare l'effetto depressivo sul sistema nervoso centrale (SNC) e l'effetto ipertensivo di {B}.", R],
        ["The risk or severity of heart failure can be increased when {B} is combined with {A}.",
         "Il rischio o la gravità dello scompenso cardiaco può aumentare quando {B} e {A} vengono associati.", R],
        ["{A} may increase the bronchoconstrictory activities of {B}.",
         "{A} può potenziare l'effetto broncocostrittore di {B}.", R],
        ["{A} may increase the ototoxic activities of {B}.",
         "{A} può potenziare l'effetto ototossico di {B}.", R],
        ["The risk or severity of hypertension can be increased when {B} is combined with {A}.",
         "Il rischio o la gravità dell'ipertensione può aumentare quando {B} e {A} vengono associati.", R],
        ["{A} may increase the hypotensive and central nervous system depressant (CNS depressant) activities of {B}.",
         "{A} può potenziare l'effetto ipotensivo e depressivo sul sistema nervoso centrale (SNC) di {B}.", R],
        ["{A} may increase the central neurotoxic activities of {B}.",
         "{A} può potenziare l'effetto neurotossico centrale di {B}.", R],
        ["{A} may increase the photosensitizing activities of {B}.",
         "{A} può potenziare l'effetto fotosensibilizzante di {B}.", R],
        ["{A} may increase the dermatologic adverse activities of {B}.",
         "{A} può potenziare gli effetti avversi dermatologici di {B}.", R],
        ["The protein binding of {B} can be decreased when combined with {A}.",
         "Il legame di {B} alle proteine plasmatiche può risultare ridotto in associazione con {A}.", W],
        ["The bioavailability of {B} can be increased when combined with {A}.",
         "La biodisponibilità di {B} può risultare aumentata in associazione con {A}.", W],
        ["{A} may decrease the analgesic activities of {B}.",
         "{A} può ridurre l'effetto analgesico di {B}.", W],
        ["{A} may decrease the antiplatelet activities of {B}.",
         "{A} può ridurre l'effetto antiaggregante piastrinico di {B}.", W],
        ["The risk or severity of hyperkalemia can be increased when {A} is combined with {B}.",
         "Il rischio o la gravità dell'iperkaliemia può aumentare quando {A} e {B} vengono associati.", R],
        ["The risk or severity of hypotension can be increased when {A} is combined with {B}.",
         "Il rischio o la gravità dell'ipotensione può aumentare quando {A} e {B} vengono associati.", R]
    ];

    const TRADUZIONI = new Map(MODELLI.map(([en, it, cat]) => [en, { it, cat }]));

    /* =====================================================================
       LETTURA DELLO ZIP (nativa, con supporto Zip64)
    ===================================================================== */

    function u64(dv, off) {
        return dv.getUint32(off, true) + dv.getUint32(off + 4, true) * 4294967296;
    }

    function leggiVociZip(u8) {
        const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);

        let eocd = -1;
        const minimo = Math.max(0, u8.length - 22 - 65535);
        for (let i = u8.length - 22; i >= minimo; i--) {
            if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
        }
        if (eocd < 0) throw new Error("File ZIP non valido (directory centrale non trovata).");

        let totale = dv.getUint16(eocd + 10, true);
        let offsetCd = dv.getUint32(eocd + 16, true);

        if (totale === 0xFFFF || offsetCd === 0xFFFFFFFF) {
            const loc = eocd - 20;
            if (loc >= 0 && dv.getUint32(loc, true) === 0x07064b50) {
                const z64 = u64(dv, loc + 8);
                if (dv.getUint32(z64, true) === 0x06064b50) {
                    totale = u64(dv, z64 + 32);
                    offsetCd = u64(dv, z64 + 48);
                }
            }
        }

        const decoder = new TextDecoder("utf-8");
        const voci = [];
        let p = offsetCd;

        for (let n = 0; n < totale; n++) {
            if (dv.getUint32(p, true) !== 0x02014b50) {
                throw new Error("File ZIP non valido (voce della directory corrotta).");
            }
            const metodo = dv.getUint16(p + 10, true);
            let csize = dv.getUint32(p + 20, true);
            let usize = dv.getUint32(p + 24, true);
            const lungNome = dv.getUint16(p + 28, true);
            const lungExtra = dv.getUint16(p + 30, true);
            const lungCommento = dv.getUint16(p + 32, true);
            let offsetLocale = dv.getUint32(p + 42, true);
            const nome = decoder.decode(u8.subarray(p + 46, p + 46 + lungNome));

            // Extra field Zip64 (id 0x0001): contiene, nell'ordine, solo i campi che
            // nell'intestazione standard valgono 0xFFFFFFFF.
            let e = p + 46 + lungNome;
            const fineExtra = e + lungExtra;
            while (e + 4 <= fineExtra) {
                const id = dv.getUint16(e, true);
                const dim = dv.getUint16(e + 2, true);
                if (id === 0x0001) {
                    let q = e + 4;
                    if (usize === 0xFFFFFFFF) { usize = u64(dv, q); q += 8; }
                    if (csize === 0xFFFFFFFF) { csize = u64(dv, q); q += 8; }
                    if (offsetLocale === 0xFFFFFFFF) { offsetLocale = u64(dv, q); q += 8; }
                }
                e += 4 + dim;
            }

            voci.push({ nome, metodo, csize, usize, offsetLocale });
            p += 46 + lungNome + lungExtra + lungCommento;
        }
        return voci;
    }

    /* Inflate "deflate-raw" in JavaScript puro (ripiego per i browser privi di
       DecompressionStream con formato deflate-raw). Algoritmo di zlib/puff. */
    const LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
    const LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
    const DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
    const DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
    const ORDINE_LUNGHEZZE = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

    function costruisciHuffman(lunghezze, n) {
        const conta = new Uint16Array(16);
        const simboli = new Uint16Array(n);
        for (let i = 0; i < n; i++) conta[lunghezze[i]]++;
        const offs = new Uint16Array(16);
        for (let l = 1; l < 15; l++) offs[l + 1] = offs[l] + conta[l];
        for (let i = 0; i < n; i++) if (lunghezze[i]) simboli[offs[lunghezze[i]]++] = i;
        return { conta, simboli };
    }

    let tabelleFisse = null;

    function inflateRawJs(src, dimensione) {
        const out = new Uint8Array(dimensione);
        let ip = 0, op = 0, buf = 0, cnt = 0;

        function bit(n) {
            while (cnt < n) {
                if (ip >= src.length) throw new Error("File ZIP troncato.");
                buf |= src[ip++] << cnt;
                cnt += 8;
            }
            const v = buf & ((1 << n) - 1);
            buf >>>= n;
            cnt -= n;
            return v;
        }

        function decodifica(h) {
            let code = 0, first = 0, index = 0;
            for (let len = 1; len <= 15; len++) {
                code |= bit(1);
                const count = h.conta[len];
                if (code - count < first) return h.simboli[index + (code - first)];
                index += count;
                first += count;
                first <<= 1;
                code <<= 1;
            }
            throw new Error("File ZIP non valido (codice).");
        }

        let ultimo;
        do {
            ultimo = bit(1);
            const tipo = bit(2);

            if (tipo === 0) {
                buf = 0;
                cnt = 0;
                const len = src[ip] | (src[ip + 1] << 8);
                ip += 4;
                out.set(src.subarray(ip, ip + len), op);
                ip += len;
                op += len;
            } else if (tipo === 1 || tipo === 2) {
                let lit, dist;
                if (tipo === 1) {
                    if (!tabelleFisse) {
                        const l = new Uint8Array(288);
                        l.fill(8, 0, 144);
                        l.fill(9, 144, 256);
                        l.fill(7, 256, 280);
                        l.fill(8, 280, 288);
                        tabelleFisse = {
                            lit: costruisciHuffman(l, 288),
                            dist: costruisciHuffman(new Uint8Array(30).fill(5), 30)
                        };
                    }
                    lit = tabelleFisse.lit;
                    dist = tabelleFisse.dist;
                } else {
                    const nlen = bit(5) + 257;
                    const ndist = bit(5) + 1;
                    const ncode = bit(4) + 4;
                    const lc = new Uint8Array(19);
                    for (let i = 0; i < ncode; i++) lc[ORDINE_LUNGHEZZE[i]] = bit(3);
                    const hc = costruisciHuffman(lc, 19);
                    const lens = new Uint8Array(nlen + ndist);
                    let idx = 0;
                    while (idx < nlen + ndist) {
                        const sym = decodifica(hc);
                        if (sym < 16) {
                            lens[idx++] = sym;
                        } else {
                            let val = 0, rip;
                            if (sym === 16) {
                                if (idx === 0) throw new Error("File ZIP non valido (lunghezze).");
                                val = lens[idx - 1];
                                rip = 3 + bit(2);
                            } else if (sym === 17) {
                                rip = 3 + bit(3);
                            } else {
                                rip = 11 + bit(7);
                            }
                            if (idx + rip > nlen + ndist) throw new Error("File ZIP non valido (ripetizioni).");
                            while (rip--) lens[idx++] = val;
                        }
                    }
                    lit = costruisciHuffman(lens.subarray(0, nlen), nlen);
                    dist = costruisciHuffman(lens.subarray(nlen), ndist);
                }

                for (;;) {
                    let sym = decodifica(lit);
                    if (sym < 256) {
                        out[op++] = sym;
                    } else if (sym === 256) {
                        break;
                    } else {
                        sym -= 257;
                        if (sym >= 29) throw new Error("File ZIP non valido (lunghezza).");
                        const len = LBASE[sym] + bit(LEXT[sym]);
                        const ds = decodifica(dist);
                        if (ds >= 30) throw new Error("File ZIP non valido (distanza).");
                        const d = DBASE[ds] + bit(DEXT[ds]);
                        if (d > op) throw new Error("File ZIP non valido (riferimento).");
                        for (let k = 0; k < len; k++, op++) out[op] = out[op - d];
                    }
                }
            } else {
                throw new Error("File ZIP non valido (blocco).");
            }
        } while (!ultimo);

        if (op !== dimensione) throw new Error("File ZIP: dimensione decompressa inattesa.");
        return out;
    }

    async function decomprimi(dati, dimensione) {
        if (typeof DecompressionStream === "function" && typeof Blob === "function" && typeof Response === "function") {
            try {
                const stream = new Blob([dati]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
                return new Uint8Array(await new Response(stream).arrayBuffer());
            } catch (errore) {
                // formato non supportato da questo browser: si usa il ripiego JavaScript
            }
        }
        return inflateRawJs(dati, dimensione);
    }

    /* Estrae il primo file .csv dallo ZIP e lo restituisce come testo. */
    async function estraiCsvDaZip(arrayBuffer) {
        const u8 = arrayBuffer instanceof Uint8Array ? arrayBuffer : new Uint8Array(arrayBuffer);

        if (u8.length < 4 || u8[0] !== 0x50 || u8[1] !== 0x4b) {
            throw new Error("Il file scaricato non è un archivio ZIP.");
        }

        const voci = leggiVociZip(u8);
        const voce =
            voci.find(v => /(^|\/)db_drug_interactions\.csv$/i.test(v.nome)) ||
            voci.find(v => /\.csv$/i.test(v.nome) && !/^__MACOSX\//.test(v.nome));
        if (!voce) throw new Error("Nessun file CSV trovato dentro lo ZIP.");

        const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
        if (dv.getUint32(voce.offsetLocale, true) !== 0x04034b50) {
            throw new Error("File ZIP non valido (intestazione locale).");
        }
        const inizio =
            voce.offsetLocale + 30 +
            dv.getUint16(voce.offsetLocale + 26, true) +
            dv.getUint16(voce.offsetLocale + 28, true);
        const dati = u8.subarray(inizio, inizio + voce.csize);

        let byte;
        if (voce.metodo === 0) byte = dati;
        else if (voce.metodo === 8) byte = await decomprimi(dati, voce.usize);
        else throw new Error("Metodo di compressione ZIP non supportato (" + voce.metodo + ").");

        let testo = new TextDecoder("utf-8").decode(byte);
        if (testo.charCodeAt(0) === 0xFEFF) testo = testo.slice(1);
        return testo;
    }

    /* =====================================================================
       CSV → INDICE COMPATTO
    ===================================================================== */

    /* Legge un record CSV (gestisce virgolette e "" interni). */
    function leggiRecord(t, pos) {
        const campi = [];
        let campo = "";
        let tra = false;
        const n = t.length;
        let i = pos;
        for (; i < n; i++) {
            const c = t.charCodeAt(i);
            if (tra) {
                if (c === 34) {
                    if (t.charCodeAt(i + 1) === 34) { campo += '"'; i++; }
                    else tra = false;
                } else {
                    campo += t[i];
                }
            } else if (c === 34) {
                tra = true;
            } else if (c === 44) {
                campi.push(campo);
                campo = "";
            } else if (c === 10) {
                i++;
                break;
            } else if (c === 13) {
                if (t.charCodeAt(i + 1) === 10) i++;
                i++;
                break;
            } else {
                campo += t[i];
            }
        }
        campi.push(campo);
        return { campi, next: i };
    }

    /* Sostituisce i nomi dei farmaci con {A}/{B} per ottenere il modello della
       frase. Si sostituisce prima il nome più lungo (un nome può contenerne un altro). */
    function ricavaModello(descrizione, a, b) {
        if (b.length > a.length) return descrizione.replaceAll(b, "{B}").replaceAll(a, "{A}");
        return descrizione.replaceAll(a, "{A}").replaceAll(b, "{B}");
    }

    function riempi(modello, a, b) {
        return modello.replaceAll("{A}", a).replaceAll("{B}", b);
    }

    function pausa() {
        return new Promise(resolve => setTimeout(resolve, 0));
    }

    function normalizza(s) {
        return String(s ?? "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .replace(/[^a-z0-9]+/g, " ")
            .trim();
    }

    /* Costruisce l'indice dal testo del CSV (colonne: Drug 1, Drug 2, descrizione).
       Per ogni riga memorizza solo (farmaco A, farmaco B, modello della frase):
       le frasi si ricostruiscono al momento della consultazione. */
    async function costruisciIndice(testo, opzioni) {
        const onProgress = opzioni && opzioni.onProgress;
        const len = testo.length;

        const intestazione = leggiRecord(testo, 0);
        if (intestazione.campi.length < 3) {
            throw new Error("Il CSV delle interazioni deve avere almeno 3 colonne (farmaco 1, farmaco 2, descrizione).");
        }

        const nomi = [];
        const idPerNome = new Map();
        const idNome = s => {
            let id = idPerNome.get(s);
            if (id === undefined) {
                id = nomi.length;
                nomi.push(s);
                idPerNome.set(s, id);
            }
            return id;
        };

        const modelli = [];
        const idModello = new Map();
        const coppiaA = [];
        const coppiaB = [];
        const coppiaModello = [];

        let pos = intestazione.next;
        let proxVirgolette = testo.indexOf('"', pos);
        let righe = 0;

        while (pos < len) {
            let fine = testo.indexOf("\n", pos);
            if (fine === -1) fine = len;
            if (proxVirgolette !== -1 && proxVirgolette < pos) proxVirgolette = testo.indexOf('"', pos);

            const inizio = pos;
            let a, b, d;

            if (proxVirgolette !== -1 && proxVirgolette < fine) {
                const rec = leggiRecord(testo, inizio);
                pos = rec.next;
                if (rec.campi.length < 3) continue;
                a = rec.campi[0];
                b = rec.campi[1];
                d = rec.campi.slice(2).join(",");
            } else {
                pos = fine + 1;
                let f = fine;
                if (f > inizio && testo.charCodeAt(f - 1) === 13) f--;
                if (f <= inizio) continue;
                const c1 = testo.indexOf(",", inizio);
                const c2 = c1 === -1 ? -1 : testo.indexOf(",", c1 + 1);
                if (c1 === -1 || c1 >= f || c2 === -1 || c2 >= f) continue;
                a = testo.slice(inizio, c1);
                b = testo.slice(c1 + 1, c2);
                d = testo.slice(c2 + 1, f);
            }

            if (!a || !b || !d) continue;

            const m = ricavaModello(d, a, b);
            let im = idModello.get(m);
            if (im === undefined) {
                im = modelli.length;
                const tr = TRADUZIONI.get(m);
                modelli.push(tr
                    ? { en: m, it: tr.it, cat: tr.cat, tradotto: true }
                    : { en: m, it: m, cat: W, tradotto: false });
                idModello.set(m, im);
            }

            coppiaA.push(idNome(a));
            coppiaB.push(idNome(b));
            coppiaModello.push(im);

            if (++righe % 20000 === 0) {
                if (onProgress) onProgress(pos / len);
                await pausa();
            }
        }

        const n = coppiaA.length;
        const nNomi = nomi.length;

        // Chiave ordinabile: (A * nNomi + B) * M + indiceRiga. Ordinando le chiavi,
        // tutte le righe della stessa coppia ordinata risultano contigue.
        let M = 1;
        while (M <= n) M *= 2;
        const chiavi = new Float64Array(n);
        const rigaModello = new Uint16Array(n);
        for (let i = 0; i < n; i++) {
            chiavi[i] = (coppiaA[i] * nNomi + coppiaB[i]) * M + i;
            rigaModello[i] = coppiaModello[i];
        }
        chiavi.sort();

        return {
            nomi,
            idPerNome,
            nNomi,
            righe: n,
            M,
            chiavi,
            rigaModello,
            modelli,
            nonTradotti: modelli.filter(x => !x.tradotto).length,
            nomeIt: [],
            termini: [],
            esatti: new Map()
        };
    }

    /* Aggiunge i nomi italiani/commerciali (data/alias-farmaci.json) e prepara
       i termini di ricerca. Può essere chiamata anche senza dizionario. */
    function aggiungiAlias(idx, datiAlias) {
        idx.termini = [];
        idx.esatti = new Map();
        idx.nomeIt = new Array(idx.nNomi).fill("");

        const aggiungi = (nome, id, tipo) => {
            const norm = normalizza(nome);
            if (!norm) return;
            idx.termini.push({ norm, label: nome, id, tipo });
            const lista = idx.esatti.get(norm);
            if (!lista) idx.esatti.set(norm, [id]);
            else if (!lista.includes(id)) lista.push(id);
        };

        idx.nomi.forEach((nome, id) => aggiungi(nome, id, "en"));

        const alias = datiAlias && datiAlias.alias;
        if (alias) {
            for (const [en, lista] of Object.entries(alias)) {
                const id = idx.idPerNome.get(en);
                if (id === undefined || !Array.isArray(lista)) continue;
                lista.forEach((nome, i) => {
                    if (i === 0) idx.nomeIt[id] = nome;
                    aggiungi(nome, id, "it");
                });
            }
        }
        return idx;
    }

    /* =====================================================================
       RICERCA E VERIFICA
    ===================================================================== */

    function nomeVisto(idx, id) {
        return idx.nomeIt[id] || idx.nomi[id];
    }

    function nomeCompleto(idx, id) {
        const en = idx.nomi[id];
        const it = idx.nomeIt[id];
        if (!it || normalizza(it) === normalizza(en)) return en;
        return it + " (" + en + ")";
    }

    function suggerimento(idx, id, termine) {
        const tipo = termine ? termine.tipo : "en";
        return {
            id,
            label: termine ? termine.label : idx.nomi[id],
            altro: tipo === "it" ? idx.nomi[id] : (idx.nomeIt[id] || "")
        };
    }

    /* Suggerimenti ordinati per pertinenza (per l'autocompletamento e per
       proporre alternative quando il nome non è esatto). */
    function cerca(idx, testo, limite) {
        const q = normalizza(testo);
        if (q.length < 2) return [];

        const trovati = new Map();
        for (const t of idx.termini) {
            const nt = t.norm;
            let tier = -1;
            if (nt.startsWith(q)) tier = 0;
            else if (nt.includes(" " + q)) tier = 1;
            else if (q.length >= 3 && nt.includes(q)) tier = 2;
            else if (
                nt.length >= 5 && q.length > nt.length && q.startsWith(nt) &&
                (q.length - nt.length <= 3 || q[nt.length] === " ")
            ) tier = 3;
            if (tier < 0) continue;

            const prec = trovati.get(t.id);
            if (!prec || tier < prec.tier || (tier === prec.tier && nt.length < prec.t.norm.length)) {
                trovati.set(t.id, { tier, t });
            }
        }

        return [...trovati.values()]
            .sort((x, y) =>
                x.tier - y.tier ||
                x.t.norm.length - y.t.norm.length ||
                x.t.label.localeCompare(y.t.label))
            .slice(0, limite || 8)
            .map(({ t }) => suggerimento(idx, t.id, t));
    }

    /* Trasforma il testo digitato in un farmaco. Solo una corrispondenza ESATTA
       (nome inglese, italiano o commerciale) viene accettata in automatico: in
       tutti gli altri casi si restituiscono dei candidati da confermare, per non
       interpretare mai in silenzio un farmaco diverso da quello voluto. */
    function risolvi(idx, testo) {
        const q = normalizza(testo);
        if (!q) return { tipo: "vuoto" };

        const esatti = idx.esatti.get(q);
        if (esatti && esatti.length === 1) return { tipo: "esatto", id: esatti[0] };
        if (esatti && esatti.length > 1) {
            return { tipo: "candidati", candidati: esatti.map(id => suggerimento(idx, id, null)) };
        }

        const candidati = cerca(idx, testo, 8);
        return candidati.length ? { tipo: "candidati", candidati } : { tipo: "nessuno" };
    }

    function righeDellaCoppia(idx, a, b) {
        const chiave = (a * idx.nNomi + b) * idx.M;
        let lo = 0;
        let hi = idx.chiavi.length;
        while (lo < hi) {
            const mid = (lo + hi) >>> 1;
            if (idx.chiavi[mid] < chiave) lo = mid + 1;
            else hi = mid;
        }
        const righe = [];
        while (lo < idx.chiavi.length && idx.chiavi[lo] < chiave + idx.M) {
            righe.push(idx.chiavi[lo] - chiave);
            lo++;
        }
        return righe;
    }

    /* Tutte le interazioni registrate tra due farmaci (in entrambi i versi). */
    function verificaCoppia(idx, idA, idB) {
        const visti = new Set();
        const voci = [];

        for (const [x, y] of [[idA, idB], [idB, idA]]) {
            for (const riga of righeDellaCoppia(idx, x, y)) {
                const im = idx.rigaModello[riga];
                const chiave = x + "|" + y + "|" + im;
                if (visti.has(chiave)) continue;
                visti.add(chiave);

                const m = idx.modelli[im];
                voci.push({
                    categoria: m.cat,
                    tradotto: m.tradotto,
                    da: x,
                    a: y,
                    testoIt: riempi(m.it, nomeVisto(idx, x), nomeVisto(idx, y)),
                    testoEn: riempi(m.en, idx.nomi[x], idx.nomi[y])
                });
            }
        }

        voci.sort((p, q) => ORDINE_CATEGORIE[p.categoria] - ORDINE_CATEGORIE[q.categoria]);

        let esito = "nessuna";
        if (voci.length) esito = voci[0].categoria;
        return { esito, voci };
    }

    /* =====================================================================
       CARICAMENTO NEL BROWSER (una sola volta per sessione)
    ===================================================================== */

    let promessaIndice = null;

    function carica(opzioni) {
        if (promessaIndice) return promessaIndice;

        const o = Object.assign({
            zip: "./data/db_drug_interactions.csv.zip",
            alias: "./data/alias-farmaci.json",
            onStato: null
        }, opzioni);
        const stato = msg => { if (o.onStato) o.onStato(msg); };

        promessaIndice = (async () => {
            stato("Scaricamento dell'archivio…");
            const risposta = await fetch(o.zip);
            if (!risposta.ok) {
                throw new Error("Archivio interazioni non raggiungibile (HTTP " + risposta.status + ").");
            }
            const buffer = await risposta.arrayBuffer();

            stato("Lettura dello ZIP…");
            const testo = await estraiCsvDaZip(buffer);

            stato("Preparazione dell'indice…");
            const idx = await costruisciIndice(testo, {
                onProgress: f => stato("Preparazione dell'indice… " + Math.round(f * 100) + "%")
            });

            let datiAlias = null;
            try {
                const ra = await fetch(o.alias);
                if (ra.ok) datiAlias = await ra.json();
            } catch (errore) {
                console.warn("[Interazioni] Dizionario dei nomi italiani non disponibile:", errore);
            }
            return aggiungiAlias(idx, datiAlias);
        })();

        promessaIndice.catch(() => { promessaIndice = null; });
        return promessaIndice;
    }

    return {
        ETICHETTE,
        MODELLI,
        carica,
        estraiCsvDaZip,
        costruisciIndice,
        aggiungiAlias,
        cerca,
        risolvi,
        verificaCoppia,
        nomeVisto,
        nomeCompleto,
        normalizza,
        inflateRawJs
    };
});
