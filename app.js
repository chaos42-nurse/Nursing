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

                const combined = [...matches, ...aifaMatches]
                    .sort((a, b) =>
                        b.score - a.score ||
                        a.principioAttivo.localeCompare(b.principioAttivo, "it-IT")
                    )
                    .slice(0, 20);

                suggestions.innerHTML = combined.length
                    ? combined.map(entry => entry.classeId
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
                    : '<div class="personal-note-empty">Nessun principio attivo trovato.</div>';

                suggestions.hidden = false;
            })
            .catch(error => {
                console.error(error);
                suggestions.innerHTML =
                    '<div class="personal-note-empty">Indice dei principi attivi non disponibile.</div>';