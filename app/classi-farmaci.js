/* =========================================================
   Classi farmacologiche: elenco per macro-area e ricerca dei principi attivi
   (script classico caricato prima di app.js: le funzioni sono globali)
========================================================= */
/* =========================================================
   ELENCO CLASSI RAGGRUPPATE PER MACRO-AREA
========================================================= */

function readOpenDrugAreas() {
    try {
        const saved = JSON.parse(sessionStorage.getItem("nursing-drug-areas-open") || "[]");
        return new Set(Array.isArray(saved) ? saved : []);
    } catch (_) {
        return new Set();
    }
}

function renderDrugClassGroups(root, stateId, populatedIds) {
    const link = currentItem => `
        <a class="content-button" href="?state=${encodeURIComponent(stateId)}&item=${encodeURIComponent(currentItem.id)}">
            <span>${escapeHtml(currentItem.title)}</span>
        </a>`;

    const visible = (Array.isArray(root.items) ? root.items : [])
        .filter(currentItem => !currentItem.fallback || (populatedIds && populatedIds.has(currentItem.id)));

    const areas = Array.isArray(root.areas) ? root.areas : [];
    if (!areas.length) return visible.map(link).join("");

    const opened = readOpenDrugAreas();
    const known = new Set(areas.map(area => area.id));
    const groups = areas.map(area => ({ ...area, classes: visible.filter(c => c.area === area.id) }));
    const others = visible.filter(c => !known.has(c.area));
    if (others.length) groups.push({ id: "altro", icon: "💊", title: "Altre classi", classes: others });

    return groups
        .filter(group => group.classes.length)
        .map(group => {
            /* "Altri farmaci ..." in fondo al gruppo, il resto in ordine alfabetico */
            const sorted = group.classes.slice().sort((a, b) =>
                (a.fallback ? 1 : 0) - (b.fallback ? 1 : 0) ||
                a.title.localeCompare(b.title, "it-IT"));
            return `
                <details class="drug-area" data-area="${escapeAttribute(group.id)}" ${opened.has(group.id) ? "open" : ""}>
                    <summary>
                        <span class="drug-area-title">${escapeHtml(group.icon || "")} ${escapeHtml(group.title)}</span>
                        <span class="drug-area-count">${sorted.length}</span>
                    </summary>
                    <div class="drug-area-items">
                        ${sorted.map(link).join("")}
                    </div>
                </details>`;
        })
        .join("");
}

/* =========================================================
   CATEGORIA CLASSI FARMACOLOGICHE
========================================================= */

function renderDrugClassCategory(item, data) {
    const classes = Array.isArray(item.items) ? item.items : [];

    function renderDrugCatalogInfo(versionData) {
        const container = document.getElementById("drugCatalogInfo");
        if (!container) return;

        const updatedAt = versionData?.last_updated;
        const checkedAt = versionData?.last_checked || updatedAt;
        let formattedDate = "non disponibile";
        let formattedChecked = "non disponibile";
        const formatDay = value => {
            const day = new Date(value);
            return Number.isNaN(day.getTime())
                ? "non disponibile"
                : day.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
        };
        if (checkedAt) formattedChecked = formatDay(checkedAt);

        if (updatedAt) {
            const date = new Date(updatedAt);
            if (!Number.isNaN(date.getTime())) {
                formattedDate = date.toLocaleDateString("it-IT", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric"
                });
            }
        }

        container.innerHTML =
            `<strong>📚 Catalogo farmaci</strong>` +
            `<span>Ultimo controllo: ${formattedChecked}</span>` +
            `<span>Ultimo aggiornamento dei dati: ${formattedDate}</span>` +
            `<span>Fonte: <a href="https://www.aifa.gov.it/liste-dei-farmaci" target="_blank" rel="noopener noreferrer">AIFA — Anagrafica dei farmaci</a></span>`;
    }

    content.innerHTML = `
        <section class="detail-page">
            <div class="detail-header-row drug-class-header-row">
                <h2>Classi farmacologiche</h2>
                <button id="drugClassSearchToggle" class="patient-search-toggle" type="button" aria-label="Cerca principio attivo">🔍</button>
            </div>

            <div id="drugCatalogInfo" class="drug-catalog-info">
                <strong>📚 Catalogo farmaci</strong>
                <span>Ultimo controllo: caricamento...</span>
                <span>Fonte: <a href="https://www.aifa.gov.it/liste-dei-farmaci" target="_blank" rel="noopener noreferrer">AIFA — Anagrafica dei farmaci</a></span>
            </div>

            <input id="drugClassSearchInput" class="patient-search-input" type="search"
                placeholder="Cerca principio attivo..." autocomplete="off">
            <div id="drugClassSearchSuggestions" class="patient-search-suggestions" hidden></div>

            <div class="detail-content">
                <div class="item-list drug-area-list" id="drugClassList">
                    ${renderDrugClassGroups(item, data.id, null)}
                </div>
            </div>
        </section>
    `;

    /* Le classi "Altri farmaci ..." compaiono solo quando contengono principi attivi. */
    if (classes.some(currentItem => currentItem.fallback)) {
        loadDrugActiveIngredientIndex()
            .then(index => {
                const populated = new Set(index.map(entry => entry.classeId).filter(Boolean));
                const box = document.getElementById("drugClassList");
                if (!box || !classes.some(currentItem => currentItem.fallback && populated.has(currentItem.id))) return;
                box.innerHTML = renderDrugClassGroups(item, data.id, populated);
            })
            .catch(() => {});
    }

    document.getElementById("drugClassList")?.addEventListener("toggle", event => {
        const details = event.target;
        if (!details?.dataset?.area) return;
        const opened = readOpenDrugAreas();
        if (details.open) opened.add(details.dataset.area);
        else opened.delete(details.dataset.area);
        try {
            sessionStorage.setItem("nursing-drug-areas-open", JSON.stringify([...opened]));
        } catch (_) { /* facoltativo */ }
    }, true);

    fetch("./data/version.json", { cache: "no-store" })
        .then(response => {
            if (!response.ok) throw new Error("Versione catalogo non disponibile");
            return response.json();
        })
        .then(renderDrugCatalogInfo)
        .catch(() => renderDrugCatalogInfo(null));

    const searchInput = document.getElementById("drugClassSearchInput");
    const suggestions = document.getElementById("drugClassSearchSuggestions");
    const classList = document.getElementById("drugClassList");

    function updateDrugClassSearch(queryValue = "") {
        const query = queryValue.trim();

        if (!query) {
            suggestions.hidden = true;
            suggestions.innerHTML = "";
            classList.style.display = "";
            return;
        }

        classList.style.display = "none";

        Promise.all([
            loadDrugActiveIngredientIndex(),
            loadAifaActiveIngredientIndex()
        ])
            .then(([index, aifaIndex]) => {
                const matches = index
                    .map(entry => ({
                        ...entry,
                        score: drugSearchScore(query, entry.principioAttivo)
                    }))
                    .filter(entry => entry.score > 0);

                const aifaMatches = aifaIndex
                    .map(entry => {
                        const name = typeof entry === "string"
                            ? entry
                            : entry?.principioAttivo;

                        return {
                            principioAttivo: name || "",
                            classeId: typeof entry === "object" ? (entry.classeId || "") : "",
                            classeNome: typeof entry === "object"
                                ? (entry.classeNome || "Catalogo AIFA")
                                : "Catalogo AIFA",
                            atc: typeof entry === "object" ? (entry.atc || "") : "",
                            score: drugSearchScore(query, name)
                        };
                    })
                    .filter(entry => entry.principioAttivo && entry.score > 0);

                // Se lo stesso principio è presente nell'indice didattico,
                // manteniamo la classificazione già definita nell'app.
                const classifiedNames = new Set(
                    matches.map(entry => normalizeDrugSearchText(entry.principioAttivo))
                );

                const filteredAifaMatches = aifaMatches.filter(entry =>
                    !classifiedNames.has(normalizeDrugSearchText(entry.principioAttivo))
                );

                const classMatches = classes
                    .map(entry => ({
                        id: entry.id,
                        title: entry.title,
                        score: classSearchScore(query, entry)
                    }))
                    .filter(entry => entry.score > 0)
                    .map(entry => ({ ...entry, tipo: "classe" }));

                const ingredientMatches = [...matches, ...filteredAifaMatches]
                    .map(entry => ({ ...entry, tipo: "principio" }));

                const combined = [...classMatches, ...ingredientMatches]
                    .sort((a, b) =>
                        b.score - a.score ||
                        (a.tipo === b.tipo ? 0 : a.tipo === "classe" ? -1 : 1) ||
                        (a.title || a.principioAttivo).localeCompare(
                            b.title || b.principioAttivo, "it-IT"
                        )
                    )
                    .slice(0, 20);

                suggestions.innerHTML = combined.length
                    ? combined.map(entry => entry.tipo === "classe"
                        ? `
                        <button
                            type="button"
                            class="patient-search-suggestion"
                            data-drug-class-id="${entry.id}"
                        >
                            <strong>${escapeHtml(entry.title)}</strong>
                            <span>Classe farmacologica</span>
                        </button>
                        `
                        : entry.classeId
                            ? `
                            <button
                                type="button"
                                class="patient-search-suggestion"
                                data-drug-class-id="${entry.classeId}"
                            >
                                <strong>${escapeHtml(entry.principioAttivo)}</strong>
                                <span>${escapeHtml(entry.classeNome)}</span>
                            </button>
                            `
                            : `
                            <div class="patient-search-suggestion">
                                <strong>${escapeHtml(entry.principioAttivo)}</strong>
                                <span>Catalogo AIFA</span>
                            </div>
                            `
                    ).join("")
                    : '<div class="personal-note-empty">Nessun principio attivo o classe farmacologica trovati.</div>';

                suggestions.hidden = false;
            })
            .catch(error => {
                console.error(error);
                suggestions.innerHTML =
                    '<div class="personal-note-empty">Indice dei principi attivi non disponibile.</div>';
                suggestions.hidden = false;
            });
    }

    searchInput?.addEventListener("input", () => {
        updateDrugClassSearch(searchInput.value);
    });

    document.getElementById("drugClassSearchToggle")?.addEventListener("click", () => {
        searchInput?.classList.toggle("is-open");

        if (searchInput?.classList.contains("is-open")) {
            searchInput.focus();
            updateDrugClassSearch(searchInput.value);
        } else {
            searchInput.value = "";
            updateDrugClassSearch("");
        }
    });

    suggestions?.addEventListener("click", event => {
        const result = event.target.closest("[data-drug-class-id]");
        if (!result) return;

        const classId = result.dataset.drugClassId;
        if (!classId) return;

        window.location.href =
            "?state=farmaci&item=" + encodeURIComponent(classId);
    });
}

/* =========================================================
   RICERCA PRINCIPI ATTIVI
========================================================= */

let aifaActiveIngredientIndex = null;

// Tabella ATC -> classe (src/data/atc-classi.json), la stessa usata dallo smistamento automatico.
// Vince il prefisso ATC più lungo; le classi sono quelle reali dell'app (data/farmaci.json).
let atcClassTable = null;

async function loadAtcClassTable() {
    if (atcClassTable) return atcClassTable;
    try {
        const response = await fetch("./src/data/atc-classi.json");
        if (!response.ok) throw new Error("Tabella ATC non disponibile");
        const data = await response.json();
        atcClassTable = {
            regole: (data.regole || []).slice().sort((a, b) => b.atc.length - a.atc.length),
            classi: data.classi || {},
            eccezioni: data.eccezioni || {}
        };
    } catch (error) {
        atcClassTable = { regole: [], classi: {}, eccezioni: {} };
    }
    return atcClassTable;
}

// Completa le voci senza classe usando la tabella (le voci già smistate non cambiano).
function mappaEUnisciClassiATC(listaGrezza, table) {
    const tabella = table || atcClassTable || { regole: [], classi: {}, eccezioni: {} };

    return listaGrezza.map(farmaco => {
        const cNome = String(farmaco.classeNome || "").trim().toLowerCase();
        if (!(cNome.includes("aifa") || !farmaco.classeId)) return farmaco;

        const chiave = normalizeDrugSearchText(farmaco.principioAttivo);
        const eccezione = tabella.eccezioni[chiave];
        const atc = String(farmaco.atc || "").trim().toUpperCase();
        const regola = tabella.regole.find(r => atc.startsWith(r.atc));
        const classeId = eccezione || (regola && regola.id);

        if (!classeId || !tabella.classi[classeId]) return farmaco;
        return { ...farmaco, classeId, classeNome: tabella.classi[classeId] };
    });
}

async function loadAifaActiveIngredientIndex() {
    if (Array.isArray(aifaActiveIngredientIndex)) return aifaActiveIngredientIndex;
    const response = await fetch("./src/data/aifa-principi-attivi.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Indice AIFA non disponibile");
    const rawData = await response.json();
    aifaActiveIngredientIndex = mappaEUnisciClassiATC(rawData, await loadAtcClassTable());
    return aifaActiveIngredientIndex;
}

let drugActiveIngredientIndex = null;

function normalizeDrugSearchText(value) {
    return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

async function loadDrugActiveIngredientIndex() {
    if (Array.isArray(drugActiveIngredientIndex)) return drugActiveIngredientIndex;

    // L'indice aggiornato viene generato dal workflow AIFA in src/data/.
    const response = await fetch("./src/data/aifa-principi-attivi.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Indice AIFA non disponibile");

    const rawData = await response.json();
    drugActiveIngredientIndex = mappaEUnisciClassiATC(rawData, await loadAtcClassTable());
    return drugActiveIngredientIndex;
}

function classSearchScore(query, entry) {
    /* Titolo attuale e vecchi nomi delle classi unite (es. "Antitrombotici"). */
    return Math.max(
        drugSearchScore(query, entry.title),
        ...(Array.isArray(entry.aliasTitles) ? entry.aliasTitles : []).map(name => drugSearchScore(query, name)),
        0
    );
}

function drugSearchScore(query, name) {
    const q = normalizeDrugSearchText(query), n = normalizeDrugSearchText(name);
    if (!q || !n) return 0;
    if (n === q) return 100;
    if (n.startsWith(q)) return 80;
    return 0;
}

async function renderDrugSearch() {
    content.innerHTML = `
        <section class="detail-page">
            ${detailHeader("Cerca", window.__currentData)}
            <div class="detail-content">
                <div class="info-block">
                    <input id="drugActiveSearchInput" class="personal-note-title-input" type="search" placeholder="Cerca una classe o un principio attivo..." autocomplete="off">
                    <p class="personal-note-message">Cerca per nome della classe farmacologica o per principio attivo.</p>
                </div>
                <div id="drugActiveSearchResults" class="item-list"></div>
            </div>
        </section>
    `;
    const input = document.getElementById("drugActiveSearchInput");
    const results = document.getElementById("drugActiveSearchResults");
    let classIndexPromise = null;

    async function loadDrugClassSearchIndex() {
        if (!classIndexPromise) {
            classIndexPromise = fetch("./data/farmaci.json")
                .then(response => {
                    if (!response.ok) throw new Error("Catalogo delle classi non disponibile");
                    return response.json();
                })
                .then(data => {
                    const section = (data.sections || []).find(item =>
                        normalizeDrugSearchText(item.title) === normalizeDrugSearchText("Classi farmacologiche")
                    );
                    const root = (section?.items || []).find(item =>
                        normalizeDrugSearchText(item.title) === normalizeDrugSearchText("Classi farmacologiche")
                    );
                    const classes = [];
                    const visit = items => {
                        for (const item of (Array.isArray(items) ? items : [])) {
                            if (!item || typeof item !== "object") continue;
                            if (item.id && item.title && item.id !== "classi-farmacologiche" &&
                                (item.type === "drug" || item.content?.class)) {
                                classes.push({ id: item.id, title: item.title, aliasTitles: item.aliasTitles || [] });
                            }
                            visit(item.items);
                        }
                    };
                    visit(root?.items || []);
                    return classes;
                });
        }
        return classIndexPromise;
    }

    input?.addEventListener("input", async () => {
        const query = input.value.trim();
        if (!query) {
            results.innerHTML = "";
            return;
        }
        try {
            const [activeIngredients, classes] = await Promise.all([
                loadDrugActiveIngredientIndex(),
                loadDrugClassSearchIndex()
            ]);
            const classMatches = classes
                .map(entry => ({ ...entry, score: classSearchScore(query, entry) }))
                .filter(entry => entry.score > 0)
                .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "it-IT"))
                .slice(0, 12);
            const ingredientMatches = activeIngredients
                .map(entry => ({ ...entry, score: drugSearchScore(query, entry.principioAttivo) }))
                .filter(entry => entry.score > 0)
                .sort((a, b) => b.score - a.score || a.principioAttivo.localeCompare(b.principioAttivo, "it-IT"))
                .slice(0, 20);

            const classHtml = classMatches.length
                ? `<div class="personal-note-message"><strong>Classi farmacologiche</strong></div>` +
                  classMatches.map(entry => `<a class="content-button" href="?state=farmaci&item=${encodeURIComponent(entry.id)}"><span><strong>${escapeHtml(entry.title)}</strong><small>Classe farmacologica</small></span></a>`).join("")
                : "";
            const ingredientHtml = ingredientMatches.length
                ? `<div class="personal-note-message"><strong>Principi attivi</strong></div>` +
                  ingredientMatches.map(entry => `<a class="content-button" href="?state=farmaci&item=${encodeURIComponent(entry.classeId || "")}"><span><strong>${escapeHtml(entry.principioAttivo)}</strong><small> → ${escapeHtml(entry.classeNome || "Classe non assegnata")}</small></span></a>`).join("")
                : "";
            results.innerHTML = classHtml + ingredientHtml ||
                "<div class=\"personal-note-empty\">Nessuna classe o principio attivo trovato.</div>";
        } catch (error) {
            console.error(error);
            results.innerHTML = "<div class=\"personal-note-empty\">Archivio di ricerca non disponibile.</div>";
        }
    });
}
