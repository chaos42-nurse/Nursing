/* =========================================================
   Pagina Interazioni tra farmaci
   (script classico caricato prima di app.js: le funzioni sono globali)
========================================================= */
/* =========================================================================
   INTERAZIONI TRA FARMACI
   I dati vengono letti direttamente dallo ZIP originale
   (data/db_drug_interactions.csv.zip) e tradotti in italiano da
   js/interazioni.js (window.NursingInterazioni).
========================================================================= */

const DDI_STILE_ESITO = {
    rischio: { classe: "ddi-rischio", icona: "⚠️" },
    attenzione: { classe: "ddi-attenzione", icona: "⚠️" },
    nota: { classe: "ddi-nota", icona: "ℹ️" },
    nessuna: { classe: "ddi-nessuna", icona: "ℹ️" }
};

const DDI_BADGE = {
    rischio: "Pericolosa",
    attenzione: "Possibile",
    nota: "Possibile"
};

const DDI_TIPO_ICONA = {
    potenziamento: "⬆️",
    antagonismo: "↘️",
    farmacocinetica: "🧪",
    protettiva: "🛡️"
};

const DDI_TIPO_BADGE = {
    potenziamento: "Effetti che si sommano",
    antagonismo: "Si riducono a vicenda",
    farmacocinetica: "Cambia i livelli",
    protettiva: "Riduce un effetto avverso"
};

/* Riepilogo di compatibilità della coppia: dice subito se l'associazione è da evitare,
   se un farmaco riduce o annulla l'altro, se gli effetti si sommano o cambiano i livelli. */
function ddiRenderRiepilogo(NI, idx, idA, idB, curate, esito) {
    const voci = [
        ...curate.map(v => ({ categoria: v.categoria, tipo: v.effetto, testo: v.testo, da: null, a: null, curata: true })),
        ...esito.voci.map(v => ({ categoria: v.categoria, tipo: v.tipo, testo: v.testoIt, da: v.da, a: v.a, curata: false }))
    ];

    const coppia = `${escapeHtml(NI.nomeCompleto(idx, idA))} + ${escapeHtml(NI.nomeCompleto(idx, idB))}`;

    if (!voci.length) return "";

    const rischi = voci.filter(v => v.categoria === "rischio");
    const cautele = voci.filter(v => v.categoria === "attenzione");

    let classe, titolo;
    if (rischi.length) {
        classe = "ddi-rischio";
        titolo = "⛔ Associazione a rischio: da evitare, o da somministrare solo con monitoraggio";
    } else if (cautele.length) {
        classe = "ddi-attenzione";
        titolo = "⚠️ Associazione da usare con cautela";
    } else {
        classe = "ddi-nota";
        titolo = "ℹ️ Nessun rischio rilevato dal database";
    }

    const righe = [];
    const perTipo = tipo => voci.filter(v => v.tipo === tipo);

    const pericolosiInsieme = rischi.filter(v => v.tipo !== "antagonismo");
    if (pericolosiInsieme.length) {
        righe.push(`<li><span>⛔</span><div><strong>Pericolosi se somministrati insieme</strong>
            <small>${pericolosiInsieme.length} segnalazion${pericolosiInsieme.length === 1 ? "e" : "i"} di rischio: leggi i dettagli qui sotto.</small></div></li>`);
    }

    const antagonismi = perTipo("antagonismo");
    if (antagonismi.length) {
        const elenco = antagonismi.map(v => {
            if (v.curata || v.da === null) return `<small>${escapeHtml(v.testo)}</small>`;
            return `<small>${escapeHtml(NI.nomeVisto(idx, v.da))} può ridurre o annullare l'effetto di ${escapeHtml(NI.nomeVisto(idx, v.a))}.</small>`;
        });
        righe.push(`<li><span>${DDI_TIPO_ICONA.antagonismo}</span><div><strong>Un farmaco riduce o annulla l'effetto dell'altro</strong>${[...new Set(elenco)].join("")}</div></li>`);
    }

    const potenziamenti = perTipo("potenziamento").filter(v => v.categoria !== "rischio");
    if (potenziamenti.length) {
        righe.push(`<li><span>${DDI_TIPO_ICONA.potenziamento}</span><div><strong>Gli effetti si sommano o si potenziano</strong>
            <small>${potenziamenti.length} segnalazion${potenziamenti.length === 1 ? "e" : "i"}.</small></div></li>`);
    }

    const cinetica = perTipo("farmacocinetica");
    if (cinetica.length) {
        righe.push(`<li><span>${DDI_TIPO_ICONA.farmacocinetica}</span><div><strong>Cambiano i livelli del farmaco nel sangue</strong>
            <small>Metabolismo, assorbimento o eliminazione modificati: ${cinetica.length} segnalazion${cinetica.length === 1 ? "e" : "i"}.</small></div></li>`);
    }

    const protettive = perTipo("protettiva");
    if (protettive.length) {
        righe.push(`<li><span>${DDI_TIPO_ICONA.protettiva}</span><div><strong>Riduce un effetto avverso</strong>
            <small>${protettive.length} segnalazion${protettive.length === 1 ? "e" : "i"}.</small></div></li>`);
    }

    return `
        <div class="info-block ddi-esito ddi-riepilogo ${classe}">
            <h4>${titolo}</h4>
            <p class="ddi-coppia">${coppia}</p>
            <ul class="ddi-riepilogo-lista">${righe.join("")}</ul>
            <p class="ddi-riepilogo-nota">Riepilogo indicativo ricavato dal tipo di effetto descritto: non è una valutazione clinica e non riguarda la compatibilità fisico-chimica in infusione o in siringa.</p>
        </div>`;
}

const DDI_AIFA_URL = "https://medicinali.aifa.gov.it/";

function ddiRenderCurate(curate) {
    if (!curate.length) return "";

    const voci = curate.map(v => `
        <li class="ddi-voce ddi-voce-${v.categoria}">
            <span class="ddi-badge">${escapeHtml(v.tipo === "compatibilita" ? "Compatibilità in infusione" : DDI_BADGE[v.categoria])}</span>
            ${v.tipo === "compatibilita" ? "" : `<span class="ddi-badge ddi-badge-tipo">${DDI_TIPO_ICONA[v.effetto] || ""} ${escapeHtml(DDI_TIPO_BADGE[v.effetto] || "")}</span>`}
            <p>${escapeHtml(v.testo)}</p>
            ${v.monitoraggio ? `<p class="ddi-monitoraggio"><strong>Cosa controllare:</strong> ${escapeHtml(v.monitoraggio)}</p>` : ""}
        </li>`).join("");

    const grave = curate.some(v => v.categoria === "rischio");
    return `
        <div class="info-block ddi-esito ddi-curata ${grave ? "ddi-rischio" : "ddi-attenzione"}">
            <h4>⚠️ Informazione comunque da verificare</h4>
            <p class="ddi-curata-nota">
                Segnalazione dell'elenco integrato a mano nell'app, non proveniente dal database
                e non verificata voce per voce. Controlla RCP, protocollo di reparto o farmacista.
            </p>
            <ul class="ddi-voci">${voci}</ul>
        </div>`;
}

function ddiRenderEsito(NI, idx, idA, idB, esito, haCurate) {
    const stile = DDI_STILE_ESITO[esito.esito];
    const coppia = `${escapeHtml(NI.nomeCompleto(idx, idA))} + ${escapeHtml(NI.nomeCompleto(idx, idB))}`;

    if (esito.esito === "nessuna") {
        return `
            <div class="info-block ddi-esito ${stile.classe}">
                <h4>${stile.icona} ${escapeHtml(NI.ETICHETTE.nessuna)}</h4>
                <p class="ddi-coppia">${coppia}</p>
                <p>
                    ${haCurate ? "Il database di base non riporta nulla per questa coppia, ma sopra c'è una segnalazione da verificare. " : ""}
                    <strong>L'assenza di una voce non vuol dire che l'associazione sia sicura.</strong>
                    Il database è incompleto e non riguarda la compatibilità fisico-chimica in
                    infusione o in siringa. Controlla sempre il RCP di entrambi i farmaci
                    (<a href="${DDI_AIFA_URL}" target="_blank" rel="noopener noreferrer">banca dati farmaci AIFA</a>),
                    il protocollo di reparto o il farmacista.
                </p>
            </div>`;
    }

    const voci = esito.voci.map(voce => `
        <li class="ddi-voce ddi-voce-${voce.categoria}">
            <span class="ddi-badge">${escapeHtml(DDI_BADGE[voce.categoria])}</span>
            <span class="ddi-badge ddi-badge-tipo">${DDI_TIPO_ICONA[voce.tipo] || ""} ${escapeHtml(DDI_TIPO_BADGE[voce.tipo] || "")}</span>
            <p>${escapeHtml(voce.testoIt)}</p>
            ${voce.tradotto ? "" : `<p class="ddi-nota-testo">Frase non ancora tradotta: testo originale in inglese.</p>`}
            <details>
                <summary>Testo originale (inglese)</summary>
                <p lang="en">${escapeHtml(voce.testoEn)}</p>
            </details>
        </li>`).join("");

    return `
        <div class="info-block ddi-esito ${stile.classe}">
            <h4>${stile.icona} ${escapeHtml(NI.ETICHETTE[esito.esito])}</h4>
            <p class="ddi-coppia">${coppia}</p>
            <ul class="ddi-voci">${voci}</ul>
        </div>`;
}

function ddiRenderProblema(NI, idx, input, risolto) {
    const digitato = escapeHtml(input.value.trim());

    if (risolto.tipo === "nessuno") {
        return `
            <div class="info-block ddi-esito ddi-nessuna">
                <h4>«${digitato}» non è presente nel database</h4>
                <p>
                    Controlla il nome. L'archivio contiene ${idx.nNomi.toLocaleString("it-IT")} principi attivi,
                    soprattutto molecole di sintesi: farmaci biologici come eparine e insuline non sono inclusi.
                    Questo non significa che non ci siano interazioni.
                </p>
            </div>`;
    }

    const scelte = risolto.candidati.map(c => `
        <button type="button" class="settings-action ddi-scelta" data-target="${escapeHtml(input.id)}" data-valore="${escapeHtml(c.label)}">
            <strong>${escapeHtml(c.label)}</strong>${c.altro ? ` <small>${escapeHtml(c.altro)}</small>` : ""}
        </button>`).join("");

    return `
        <div class="info-block ddi-esito ddi-nessuna">
            <h4>Quale farmaco intendi con «${digitato}»?</h4>
            <div class="ddi-scelte">${scelte}</div>
        </div>`;
}

/* Informazioni sull'archivio (data/interazioni-meta.json, aggiornato il 16 di ogni mese dal workflow). */
function renderDrugInteractionsMeta() {
    const box = document.getElementById("ddiMeta");
    if (!box) return;

    const formatDay = value => {
        const day = new Date(value);
        return Number.isNaN(day.getTime())
            ? "non disponibile"
            : day.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    fetch("./data/interazioni-meta.json", { cache: "no-store" })
        .then(response => {
            if (!response.ok) throw new Error("Metadati non disponibili");
            return response.json();
        })
        .then(meta => {
            if (!document.body.contains(box)) return;
            const parts = [`<strong>📚 Archivio interazioni</strong>`];
            parts.push(`<span>Ultimo controllo: ${meta.last_checked ? formatDay(meta.last_checked) : "non disponibile"}</span>`);
            if (meta.last_updated && meta.last_updated !== meta.dataset_date) parts.push(`<span>Ultimo aggiornamento dei dati: ${formatDay(meta.last_updated)}</span>`);
            if (meta.dataset_date) parts.push(`<span>Data del dataset di origine: ${formatDay(meta.dataset_date)}</span>`);
            if (meta.records) {
                parts.push(`<span>${Number(meta.records).toLocaleString("it-IT")} interazioni${meta.drugs ? ` tra ${Number(meta.drugs).toLocaleString("it-IT")} principi attivi` : ""}</span>`);
            }
            if (meta.sourceUrl) {
                parts.push(`<span>Fonte: <a href="${escapeAttribute(meta.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(meta.source || "archivio interazioni")}</a></span>`);
            }
            box.innerHTML = parts.join("");
        })
        .catch(() => {
            if (document.body.contains(box)) {
                box.innerHTML = `<strong>📚 Archivio interazioni</strong><span>Ultimo controllo: non disponibile</span>`;
            }
        });
}

async function renderDrugInteractions(selectedItem, data) {
    const NI = window.NursingInterazioni;
    const titolo = (selectedItem && selectedItem.title) || "Interazioni tra farmaci";

    content.innerHTML = `
        <section class="detail-page ddi-page">
            ${detailHeader(escapeHtml(titolo), data || window.__currentData)}

            <div class="detail-content">
                <div id="ddiMeta" class="drug-catalog-info">
                    <strong>📚 Archivio interazioni</strong>
                    <span>Ultimo controllo: caricamento...</span>
                </div>

                <article id="ddiStato" class="info-block info-block-note" role="status">
                    <strong>Archivio interazioni</strong>
                    <p>Caricamento in corso…</p>
                </article>

                <article class="info-block ddi-form">
                    <label for="drugA">Primo farmaco</label>
                    <input id="drugA" class="personal-note-title-input" type="text"
                           role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="ddiListaA"
                           autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false"
                           placeholder="Es: paracetamolo, ceftriaxone…">
                    <ul id="ddiListaA" class="ddi-suggest patient-search-suggestions" role="listbox" hidden></ul>

                    <label for="drugB">Secondo farmaco</label>
                    <input id="drugB" class="personal-note-title-input" type="text"
                           role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="ddiListaB"
                           autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false"
                           placeholder="Es: amiodarone, midazolam…">
                    <ul id="ddiListaB" class="ddi-suggest patient-search-suggestions" role="listbox" hidden></ul>

                    <button id="btnCheckCompatibility" class="settings-action ddi-submit" type="button" disabled>
                        🔄 Verifica interazioni
                    </button>
                </article>

                <div id="interactionResult" aria-live="polite"></div>

                <article class="info-block info-block-warning">
                    <span class="info-block-icon">ℹ️</span>
                    <div>
                        <strong>Come leggere il risultato</strong>
                        <p>
                            Fonte: DrugBank tramite Therapeutics Data Commons (file ZIP e CSV del repository);
                            nomi e frasi sono tradotti in italiano e il testo originale è sempre consultabile.
                            Il database indica che un'interazione esiste, non la sua gravità: «Pericolosa» e
                            «Possibile» sono una classificazione indicativa dedotta dal tipo di effetto
                            (per esempio QT lungo, depressione respiratoria, sanguinamento), non una valutazione clinica. Le segnalazioni «da verificare» arrivano
                            da un elenco integrato a mano e vanno sempre controllate. Non riguarda la compatibilità
                            fisico-chimica in infusione o in siringa. Verifica sempre RCP, protocolli
                            di reparto o farmacista.
                        </p>
                    </div>
                </article>
            </div>
        </section>
    `;

    renderDrugInteractionsMeta();

    const elStato = document.getElementById("ddiStato");
    const elRisultato = document.getElementById("interactionResult");
    const inA = document.getElementById("drugA");
    const inB = document.getElementById("drugB");
    const listaA = document.getElementById("ddiListaA");
    const listaB = document.getElementById("ddiListaB");
    const bottone = document.getElementById("btnCheckCompatibility");

    if (!NI) {
        elStato.innerHTML = `<strong>Archivio non disponibile</strong><p>Modulo interazioni non caricato (js/interazioni.js).</p>`;
        return;
    }

    let idx = null;
    const paginaAttiva = () => document.body.contains(elRisultato);

    /* Classe farmacologica di ogni principio attivo: stessa fonte della ricerca
       "Classi farmacologiche", cosi' i suggerimenti hanno lo stesso aspetto
       (nome in grassetto, classe sotto o accanto). */
    let classiPerNome = null;
    Promise.all([
        loadDrugActiveIngredientIndex().catch(() => []),
        loadAifaActiveIngredientIndex().catch(() => [])
    ]).then(([indiceDidattico, indiceAifa]) => {
        const mappa = new Map();
        for (const voce of [...indiceDidattico, ...indiceAifa]) {
            const nome = voce && voce.principioAttivo;
            const classe = voce && voce.classeNome;
            if (!nome || !classe || /catalogo aifa/i.test(classe)) continue;
            const chiave = normalizeDrugSearchText(nome);
            if (!mappa.has(chiave)) mappa.set(chiave, classe);
        }
        classiPerNome = mappa;
    });

    const classeDi = voce => {
        if (!classiPerNome) return "";
        const nomeIt = idx && idx.nomeIt ? idx.nomeIt[voce.id] : "";
        return classiPerNome.get(normalizeDrugSearchText(voce.label))
            || classiPerNome.get(normalizeDrugSearchText(nomeIt))
            || "";
    };

    /* Autocompletamento: elenco dei suggerimenti sotto il campo (non il datalist
       del browser, che su telefono è inaffidabile e filtra per conto suo). */
    function collegaAutocompletamento(input, lista, altroInput) {
        let voci = [];
        let attiva = -1;

        const chiudi = () => {
            lista.hidden = true;
            lista.innerHTML = "";
            input.setAttribute("aria-expanded", "false");
            voci = [];
            attiva = -1;
        };

        const evidenzia = nuova => {
            const nodi = lista.querySelectorAll("li[data-i]");
            if (!nodi.length) return;
            attiva = (nuova + nodi.length) % nodi.length;
            nodi.forEach((n, i) => {
                n.classList.toggle("is-active", i === attiva);
                n.setAttribute("aria-selected", i === attiva ? "true" : "false");
            });
            nodi[attiva].scrollIntoView({ block: "nearest" });
        };

        const scegli = i => {
            const voce = voci[i];
            if (!voce) return;
            input.value = voce.label;
            chiudi();
            if (altroInput && !altroInput.value.trim()) altroInput.focus();
            else verifica();
        };

        const mostra = () => {
            if (!idx) return;
            const testo = input.value.trim();
            if (testo.length < 2) { chiudi(); return; }

            voci = NI.cerca(idx, testo, 8);
            attiva = -1;

            if (!voci.length) {
                lista.innerHTML = `<li class="ddi-suggest-vuoto">Nessun suggerimento: il farmaco potrebbe non essere nel database.</li>`;
            } else {
                lista.innerHTML = voci.map((v, i) => `
                    <li class="patient-search-suggestion" role="option" data-i="${i}" aria-selected="false">
                        <strong>${escapeHtml(v.label)}</strong>
                        <span>${escapeHtml(classeDi(v) || v.altro || "Principio attivo")}</span>
                    </li>`).join("");
            }
            lista.hidden = false;
            input.setAttribute("aria-expanded", "true");
        };

        // pointerdown + preventDefault: il campo non perde il focus prima della scelta
        lista.addEventListener("pointerdown", evento => {
            const riga = evento.target.closest("li[data-i]");
            if (!riga) return;
            evento.preventDefault();
            scegli(Number(riga.dataset.i));
        });

        input.addEventListener("input", mostra);
        input.addEventListener("focus", mostra);
        input.addEventListener("blur", () => setTimeout(chiudi, 120));
        input.addEventListener("keydown", evento => {
            if (evento.key === "ArrowDown" && voci.length) { evento.preventDefault(); evidenzia(attiva + 1); }
            else if (evento.key === "ArrowUp" && voci.length) { evento.preventDefault(); evidenzia(attiva - 1); }
            else if (evento.key === "Escape") chiudi();
            else if (evento.key === "Enter") {
                evento.preventDefault();
                if (attiva >= 0 && voci[attiva]) scegli(attiva);
                else { chiudi(); verifica(); }
            }
        });

        return { chiudi, mostra };
    }

    collegaAutocompletamento(inA, listaA, inB);
    collegaAutocompletamento(inB, listaB, inA);

    function verifica() {
        if (!idx) return;

        const rA = NI.risolvi(idx, inA.value);
        const rB = NI.risolvi(idx, inB.value);

        if (rA.tipo === "vuoto" || rB.tipo === "vuoto") {
            elRisultato.innerHTML = `<div class="personal-note-empty">Inserisci entrambi i farmaci.</div>`;
            return;
        }

        const problemi = [];
        if (rA.tipo !== "esatto") problemi.push(ddiRenderProblema(NI, idx, inA, rA));
        if (rB.tipo !== "esatto") problemi.push(ddiRenderProblema(NI, idx, inB, rB));

        if (problemi.length) {
            elRisultato.innerHTML = problemi.join("");
            elRisultato.querySelectorAll(".ddi-scelta").forEach(pulsante => {
                pulsante.addEventListener("click", () => {
                    document.getElementById(pulsante.dataset.target).value = pulsante.dataset.valore;
                    verifica();
                });
            });
            return;
        }

        if (rA.id === rB.id) {
            elRisultato.innerHTML = `<div class="personal-note-empty">Hai inserito lo stesso farmaco due volte.</div>`;
            return;
        }

        const curate = NI.verificaCurate(idx, rA.id, rB.id);
        const esitoDb = NI.verificaCoppia(idx, rA.id, rB.id);
        elRisultato.innerHTML =
            ddiRenderRiepilogo(NI, idx, rA.id, rB.id, curate, esitoDb) +
            ddiRenderCurate(curate) +
            ddiRenderEsito(NI, idx, rA.id, rB.id, esitoDb, curate.length > 0);
    }

    bottone.addEventListener("click", verifica);

    try {
        idx = await NI.carica({
            onStato: messaggio => {
                if (!paginaAttiva()) return;
                elStato.innerHTML = `<strong>Archivio interazioni</strong><p>${escapeHtml(messaggio)}</p>`;
            }
        });
    } catch (errore) {
        console.error("Errore nel caricamento delle interazioni:", errore);
        if (!paginaAttiva()) return;
        elStato.className = "info-block info-block-warning";
        elStato.innerHTML = `
            <div>
                <strong>Archivio non disponibile</strong>
                <p>${escapeHtml(errore && errore.message ? errore.message : String(errore))}</p>
                <button id="ddiRiprova" class="settings-action" type="button">↻ Riprova</button>
            </div>`;
        document.getElementById("ddiRiprova")?.addEventListener("click", () => renderDrugInteractions(selectedItem, data));
        return;
    }

    if (!paginaAttiva()) return;

    const fonti = idx.fonti || {};
    elStato.innerHTML = `
        <strong>✓ Archivio caricato</strong>
        <p>${idx.righe.toLocaleString("it-IT")} interazioni tra ${idx.nNomi.toLocaleString("it-IT")} principi attivi, disponibili anche offline.</p>
        ${fonti.problemi && fonti.problemi.length ? `<p><small>Una sorgente non è stata letta (${escapeHtml(fonti.problemi.join(" · "))}): i risultati usano l'altra.</small></p>` : ""}`;
    bottone.disabled = false;
}
