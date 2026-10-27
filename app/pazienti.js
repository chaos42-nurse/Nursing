/* =========================================================
   Schede paziente, parametri vitali, foto, controllo della terapia
   (script classico caricato prima di app.js: le funzioni sono globali)
========================================================= */
/* =========================================================
   MODALITÀ MODIFICA ORDINE
========================================================= */

let orderEditMode = false;

const PATIENTS_KEY = "nursing-patients";

const PERSONALIZATION_VERSION = 2;

const PERSONALIZATION_KEYS = {
    theme: "nursing-theme",
    categoryOrder: "nursing-category-order",
    notes: "nursing-personal-notes",
    appNotes: "nursing-app-notes"
};

function normalizePatient(patient = {}) {
    return {
        id: String(patient.id || ""),
        name: String(patient.name || ""),
        birthDate: String(patient.birthDate || ""),
        age: String(patient.age || ""),
        room: String(patient.room || ""),
        bed: String(patient.bed || ""),
        pathologies: String(patient.pathologies || ""),
        admissionReason: String(patient.admissionReason || ""),
        allergies: String(patient.allergies || ""),
        diabetic: Boolean(patient.diabetic),
        medications: String(patient.medications || ""),
        notes: String(patient.notes || ""),
        // Mantiene compatibilità con i vecchi record che salvavano i PV in un unico campo.
        pv: String(patient.pv || ""),
        pvHistory: Array.isArray(patient.pvHistory)
            ? patient.pvHistory.map(entry => ({
                id: String(entry?.id || ""),
                recordedAt: String(entry?.recordedAt || ""),
                pa: String(entry?.pa || ""),
                fc: String(entry?.fc || ""),
                sat: String(entry?.sat || ""),
                temperature: String(entry?.temperature || ""),
                glucose: String(entry?.glucose || "")
            }))
            : []
    };
}

function setupPvInputFormatting(modal) {
    const paInput = modal.querySelector("#patientPa");
    const temperatureInput = modal.querySelector("#patientTemperature");
    const fcInput = modal.querySelector("#patientFc");
    const satInput = modal.querySelector("#patientSat");
    const glucoseInput = modal.querySelector("#patientGlucose");

    paInput?.addEventListener("input", () => {
        let digits = paInput.value.replace(/\D/g, "").slice(0, 6);
        if (digits.length > 3) {
            digits = digits.slice(0, 3) + "/" + digits.slice(3);
        }
        paInput.value = digits;
    });

    temperatureInput?.addEventListener("input", () => {
        let digits = temperatureInput.value.replace(/\D/g, "").slice(0, 3);
        if (digits.length > 2) {
            digits = digits.slice(0, 2) + "," + digits.slice(2);
        }
        temperatureInput.value = digits;
    });

    [fcInput, satInput, glucoseInput].forEach(input => {
        input?.addEventListener("input", () => {
            input.value = input.value.replace(/\D/g, "");
        });
    });
}

function calculatePatientAge(birthDate) {
    if (!birthDate) return "";

    const birth = new Date(birthDate + "T00:00:00");
    if (Number.isNaN(birth.getTime())) return "";

    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();

    const beforeBirthday =
        today.getMonth() < birth.getMonth() ||
        (
            today.getMonth() === birth.getMonth() &&
            today.getDate() < birth.getDate()
        );

    if (beforeBirthday) age--;

    return age >= 0 ? String(age) : "";
}

function formatPatientDate(value) {
    const raw = String(value || "").trim();
    const match = raw.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
    if (!match) return raw;
    return `${match[3].padStart(2, "0")}-${match[2].padStart(2, "0")}-${match[1]}`;
}

function renderPatientField(label, value) {
    let displayValue = String(value ?? "").trim();

    if (label === "Data di nascita" && displayValue) {
        displayValue = formatPatientDate(displayValue);
    }

    return `
        <div class="patient-readonly-field">
            <strong>${escapeHtml(label)}</strong>
            <span>${displayValue ? renderNoteText(displayValue) : "—"}</span>
        </div>
    `;
}

function formatBloodPressure(value) {
    const raw = String(value || "").trim().replace(/\s/g, "");
    const match = raw.match(/^(\d{1,3})\/(\d{1,3})$/);
    if (!match) return escapeHtml(raw || "—");

    const systolic = String(Number(match[1]));
    const diastolic = String(Number(match[2]));

    return escapeHtml(`${systolic}/${diastolic}`);
}

function renderPatientPvHistory(history, patientId = "") {
    if (!Array.isArray(history) || !history.length) {
        return '<div class="personal-note-empty">Nessuna rilevazione registrata.</div>';
    }

    return `
        <div class="patient-pv-table-wrap">
            <table class="patient-pv-table">
                <thead>
                    <tr>
                        <th>Data/ora</th>
                        <th>P.A.<small>mm/Mh</small></th>
                        <th>F.C.<small>bpm</small></th>
                        <th>Sat.<small>%</small></th>
                        <th>T.°<small>°C</small></th>
                        <th>Glicemia<small>mg/dL</small></th>
                        <th>Azioni</th>
                    </tr>
                </thead>
                <tbody>
                    ${history.slice().reverse().map((entry, reversedIndex) => {
                        const index = history.length - 1 - reversedIndex;
                        const date = entry.recordedAt ? new Date(entry.recordedAt).toLocaleString("it-IT") : "—";
                        const pa = formatBloodPressure(entry.pa);
                        const fc = entry.fc ? escapeHtml(entry.fc) : "—";
                        const sat = entry.sat ? escapeHtml(entry.sat) + " %" : "—";
                        const temperature = entry.temperature ? escapeHtml(entry.temperature) + " °C" : "—";
                        const glucose = entry.glucose ? escapeHtml(entry.glucose) : "—";

                        return `
                            <tr>
                                <td>${escapeHtml(date)}</td>
                                <td>${pa !== "—" ? pa + " <small>mm/Mh</small>" : "—"}</td>
                                <td>${fc !== "—" ? fc + " <small>bpm</small>" : "—"}</td>
                                <td>${sat}</td>
                                <td>${temperature}</td>
                                <td>${glucose !== "—" ? glucose + " <small>mg/dL</small>" : "—"}</td>
                                <td class="patient-pv-actions">
                                    <button type="button" class="patient-pv-edit" data-patient-id="${escapeAttribute(patientId)}" data-pv-index="${index}" title="Modifica">✏️</button>
                                    <button type="button" class="patient-pv-delete" data-patient-id="${escapeAttribute(patientId)}" data-pv-index="${index}" title="Elimina">🗑️</button>
                                </td>
                            </tr>
                        `;
                    }).join("")}
                </tbody>
            </table>
        </div>
    `;
}

function getPatientInitials(name = "") {
    return String(name)
        .trim()
        .match(/(?:^|[\s'])\p{L}/gu)
        ?.join("")
        .toUpperCase() || "";
}

function renderPatientPhotosPage(patientId) {
    const patient = getPatients().find(current => current.id === patientId);

    if (!patient) {
        renderPatientsPage();
        return;
    }

    stateTitle.textContent = "📷 Evoluzione medicazione";
    description.textContent = "Documentazione fotografica del paziente.";

    content.innerHTML = `
        <section class="detail-page patients-page patient-photos-page">
            <div class="patient-photo-header">
                <h3>👤 ${renderNoteText(patient.name || "Paziente senza nome")}</h3>
                <div class="patient-photo-actions">
                    <button id="patientPhotoAdd" class="settings-action" type="button">📷 Nuova foto</button>
                    <button id="patientPhotoCompare" class="settings-action" type="button">↔️ Confronta</button>
                </div>
            </div>

            <div class="patient-photo-privacy-warning">
                <strong>⚠️ Privacy</strong>
                <p>
                    Le foto restano solo su questo dispositivo, ridotte e senza
                    dati di posizione. Chiedi il consenso e non inquadrare volto,
                    nome o altri elementi identificativi non necessari.
                </p>
            </div>

            <p id="patientPhotoStorage" class="settings-message"></p>
            <p id="patientPhotoMessage" class="settings-message" role="status"></p>

            <div id="patientPhotoGallery" class="patient-photo-gallery"></div>

            <section class="patient-audio-section">
                <div class="patient-audio-header">
                    <strong>🎙️ Note vocali</strong>
                    <button id="patientAudioAdd" class="settings-action" type="button">🎙️ Registra</button>
                </div>
                <p class="settings-message">Restano solo su questo dispositivo. Non dire dati identificativi non necessari.</p>
                <div id="patientAudioList" class="patient-audio-list"></div>
            </section>

            <div id="patientPhotoCompareBar" class="patient-photo-comparebar" hidden>
                <span id="patientPhotoCompareText"></span>
                <button id="patientPhotoCompareGo" type="button" disabled>Confronta</button>
                <button id="patientPhotoCompareCancel" type="button">Annulla</button>
            </div>
        </section>
    `;

    setupPatientPhotosPage(patient);
    setupPatientAudio(patient);
}

/* Note vocali del paziente (sezione medicazioni). */
function setupPatientAudio(patient) {
    const audio = window.AudioNotes;
    const list = content.querySelector("#patientAudioList");
    const addButton = content.querySelector("#patientAudioAdd");
    if (!list || !addButton) return;

    if (!audio || !audio.supported()) {
        addButton.disabled = true;
        list.textContent = "Registrazione non supportata da questo browser.";
        return;
    }

    const owner = "patient:" + patient.id;

    const refresh = async () => {
        let items = [];
        try { items = await audio.list(owner); } catch (_) {}

        list.innerHTML = items.length ? items.map(item => `
            <div class="patient-audio-item" data-audio-row="${escapeAttribute(item.id)}">
                <button type="button" class="note-audio" data-audio-id="${escapeAttribute(item.id)}" title="Riproduci">
                    <span class="note-audio-icon">▶</span>
                    <span class="note-audio-label">${escapeHtml(item.title || "Nota vocale")}
                        <small>${escapeHtml(new Date(item.createdAt).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" }))} · ${audio.formatTime(item.duration)}</small>
                    </span>
                </button>
                <button type="button" class="patient-audio-rename" data-audio-rename="${escapeAttribute(item.id)}" title="Rinomina" aria-label="Rinomina">✏️</button>
                <button type="button" class="patient-audio-delete" data-audio-delete="${escapeAttribute(item.id)}" title="Elimina" aria-label="Elimina">🗑️</button>
            </div>`).join("") : '<p class="settings-message">Nessuna nota vocale.</p>';
    };

    addButton.addEventListener("click", async () => {
        const saved = await audio.recordAndSave(owner);
        if (saved) refresh();
    });

    list.addEventListener("click", async event => {
        const del = event.target.closest("[data-audio-delete]");
        if (del) {
            if (!window.confirm("Eliminare questa nota vocale?")) return;
            audio.stopCurrent();
            await audio.remove(del.dataset.audioDelete);
            refresh();
            return;
        }
        const ren = event.target.closest("[data-audio-rename]");
        if (ren) {
            const record = await audio.get(ren.dataset.audioRename);
            const title = window.prompt("Titolo della nota vocale:", record?.title || "");
            if (title === null) return;
            await audio.rename(ren.dataset.audioRename, title);
            refresh();
        }
    });

    refresh();
}

function setupPatientPhotosPage(patient) {
    const photos = window.PatientPhotos;
    const gallery = content.querySelector("#patientPhotoGallery");
    const storageLine = content.querySelector("#patientPhotoStorage");
    const messageLine = content.querySelector("#patientPhotoMessage");
    const addButton = content.querySelector("#patientPhotoAdd");

    let objectUrls = [];
    let itemsById = new Map();
    let compareMode = false;
    let selected = [];

    const showMessage = text => {
        messageLine.textContent = text || "";
    };

    const releaseUrls = () => {
        objectUrls.forEach(url => URL.revokeObjectURL(url));
        objectUrls = [];
    };

    if (!photos) {
        addButton.disabled = true;
        showMessage("Modulo foto non disponibile. Ricarica l'app.");
        return;
    }

    const refreshStorage = async () => {
        const info = await photos.getStorageInfo();

        if (!info.supported || !info.quota) {
            storageLine.textContent = "";
            return info;
        }

        const percent = Math.min(100, Math.round(info.usage / info.quota * 100));

        storageLine.textContent =
            "Spazio dell'app: " + photos.formatBytes(info.usage) +
            " usati su circa " + photos.formatBytes(info.quota) +
            " (" + percent + "%)" +
            (info.persisted ? " · dati protetti" : "");

        if (info.free < photos.LOW_SPACE_BYTES) {
            storageLine.textContent +=
                " — spazio quasi esaurito: elimina le foto che non servono più.";
        }

        return info;
    };

    const renderGallery = async () => {
        releaseUrls();
        itemsById = new Map();

        let items = [];

        try {
            items = await photos.listPhotos(patient.id);
        } catch (error) {
            console.error("Errore lettura foto:", error);
            showMessage("Impossibile leggere le foto salvate.");
        }

        if (!items.length) {
            gallery.innerHTML =
                '<p class="settings-message">Nessuna foto salvata per questo paziente.</p>';
            return;
        }

        // Un'unica griglia per tutte le foto, indipendentemente dal giorno.
        // La data e l'ora restano visibili sotto ogni immagine.
        items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        gallery.innerHTML = `
            <div class="patient-photo-grid">
                ${items.map(item => {
                    const url = URL.createObjectURL(item.blob);
                    objectUrls.push(url);
                    itemsById.set(item.id, item);

                    const dateTime = new Date(item.createdAt).toLocaleString("it-IT", {
                        day: "2-digit", month: "2-digit", year: "numeric",
                        hour: "2-digit", minute: "2-digit"
                    });

                    return `
                        <figure class="patient-photo-card" data-card="${escapeAttribute(item.id)}" style="margin:0">
                            <img class="patient-photo-image" src="${url}"
                                 alt="Foto del ${escapeAttribute(dateTime)}"
                                 loading="lazy" decoding="async"
                                 data-photo-view="${escapeAttribute(item.id)}">
                            <span class="patient-photo-badge" aria-hidden="true"></span>
                            <figcaption class="patient-photo-meta">
                                <span class="patient-photo-date">${escapeHtml(dateTime)}${measureSummary(item.measure) ? " 📏" : ""}</span>
                                <button class="patient-photo-delete" type="button"
                                        data-photo-delete="${escapeAttribute(item.id)}"
                                        aria-label="Elimina foto">🗑️</button>
                            </figcaption>
                        </figure>
                    `;
                }).join("")}
            </div>
        `;

        selected = selected.filter(id => itemsById.has(id));
        updateSelectionUi();
    };

    const saveFile = async (file, note) => {
        addButton.disabled = true;
        showMessage("Salvataggio della foto in corso…");

        try {
            const { record, originalBytes } = await photos.addPhoto(patient.id, file, note);

            showMessage(
                "Foto salvata: " + photos.formatBytes(originalBytes) +
                " → " + photos.formatBytes(record.size) + "."
            );
        } catch (error) {
            console.error("Errore salvataggio foto:", error);
            showMessage(
                error?.code
                    ? error.message
                    : "Impossibile salvare la foto. Controlla lo spazio sul dispositivo."
            );
        } finally {
            addButton.disabled = false;
            await renderGallery();
            await refreshStorage();
        }
    };

    let liveCameraFailed = false;

    // Fotocamera dentro l'app: non apre l'app fotocamera di sistema, quindi
    // Android non chiude la pagina per mancanza di memoria durante lo scatto.
    const openLiveCamera = async note => {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: { ideal: "environment" },
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            },
            audio: false
        });

        const overlay = document.createElement("div");
        overlay.className = "patient-photo-camera";
        overlay.innerHTML = `
            <video class="patient-photo-camera-video" playsinline muted autoplay></video>
            <div class="patient-photo-camera-bar">
                <button type="button" class="settings-action" data-cam="cancel">Annulla</button>
                <button type="button" class="patient-photo-shutter" data-cam="shoot"
                        aria-label="Scatta"></button>
                <span></span>
            </div>
        `;
        document.body.appendChild(overlay);

        const video = overlay.querySelector("video");
        video.srcObject = stream;
        video.play().catch(() => {});

        const stop = () => {
            stream.getTracks().forEach(track => track.stop());
            overlay.remove();
        };

        overlay.addEventListener("click", event => {
            const action = event.target.closest("[data-cam]")?.dataset.cam;
            if (!action) return;

            if (action === "cancel") {
                stop();
                return;
            }

            if (!video.videoWidth) return;

            const canvas = document.createElement("canvas");
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext("2d").drawImage(video, 0, 0);
            stop();

            canvas.toBlob(blob => {
                if (!blob) {
                    showMessage("Impossibile acquisire la foto.");
                    return;
                }
                saveFile(new File([blob], "foto.jpg", { type: "image/jpeg" }), note);
            }, "image/jpeg", 0.9);
        });
    };

    const compareBar = content.querySelector("#patientPhotoCompareBar");
    const compareText = content.querySelector("#patientPhotoCompareText");
    const compareGo = content.querySelector("#patientPhotoCompareGo");
    const compareButton = content.querySelector("#patientPhotoCompare");

    function updateSelectionUi() {
        gallery.classList.toggle("comparing", compareMode);

        gallery.querySelectorAll("[data-card]").forEach(card => {
            const index = selected.indexOf(card.dataset.card);
            card.classList.toggle("selected", index !== -1);
            card.querySelector(".patient-photo-badge").textContent = index !== -1 ? String(index + 1) : "";
        });

        compareBar.hidden = !compareMode;
        compareGo.disabled = selected.length !== 2;
        compareText.textContent = selected.length === 2
            ? "2 foto scelte"
            : "Scegli 2 foto (" + selected.length + "/2)";
    }

    const setCompareMode = on => {
        compareMode = on;
        selected = [];
        updateSelectionUi();
    };

    const toggleSelection = id => {
        const index = selected.indexOf(id);

        if (index !== -1) {
            selected.splice(index, 1);
        } else if (selected.length < 2) {
            selected.push(id);
        } else {
            // Già 2 scelte: la più vecchia selezione viene sostituita.
            selected.shift();
            selected.push(id);
        }

        updateSelectionUi();
    };

    // Distanza leggibile tra due foto: "3 giorni", "5 ore", "40 min".
    const formatGap = (from, to) => {
        const minutes = Math.round((new Date(to) - new Date(from)) / 60000);

        if (minutes < 60) return minutes + " min";
        if (minutes < 60 * 48) return Math.round(minutes / 60) + " ore";

        return Math.round(minutes / (60 * 24)) + " giorni";
    };

    const openCompare = (idA, idB) => {
        const [before, after] = [itemsById.get(idA), itemsById.get(idB)]
            .filter(Boolean)
            .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));

        if (!before || !after) return;

        document.getElementById("patientPhotoCompareView")?.remove();

        const fmt = item => new Date(item.createdAt).toLocaleString("it-IT", {
            day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit"
        });

        const capText = (label, item, measure) => {
            const summary = measureSummary(measure);

            return `<strong>${label}</strong> ${escapeHtml(fmt(item))}${item.note ? " · " + escapeHtml(item.note) : ""}${summary ? " · " + escapeHtml(summary) : ""}`;
        };

        const pane = (label, item) => `
            <div class="patient-photo-compare-pane">
                <div class="patient-photo-viewer-stage">
                    <div class="patient-photo-viewer-layer">
                        <img src="${escapeAttribute(URL.createObjectURL(item.blob))}" alt="" draggable="false">
                        <svg class="patient-photo-measure-svg" aria-hidden="true"></svg>
                        <svg class="patient-photo-ruler-svg" aria-hidden="true"></svg>
                    </div>
                </div>
                <div class="patient-photo-pane-tools">
                    <button type="button" data-pane="measure" aria-label="Misura questa foto (${label})" title="Calibra e misura questa foto">📏</button>
                    <button type="button" data-pane="delete" aria-label="Elimina questa foto (${label})" title="Elimina questa foto">🗑️</button>
                </div>
                <div class="patient-photo-compare-cap">${capText(label, item, item.measure)}</div>
            </div>`;

        const view = document.createElement("div");
        view.id = "patientPhotoCompareView";
        view.className = "patient-photo-compare";
        view.innerHTML = `
            <div class="patient-photo-compare-top">
                <span>Confronto · distanza ${escapeHtml(formatGap(before.createdAt, after.createdAt))}</span>
                <span class="patient-photo-compare-tools">
                    <button type="button" data-cmp="home" aria-label="Riporta i righelli dentro le foto" title="Riporta i righelli dentro le foto">🎯</button>
                    <button type="button" data-cmp="ruler" class="active" aria-label="Mostra o nascondi i righelli">📐</button>
                    <button type="button" data-cmp="close" aria-label="Chiudi">✕</button>
                </span>
            </div>
            <div class="patient-photo-compare-panes">
                ${pane("Prima", before)}
                ${pane("Dopo", after)}
            </div>
            <div class="patient-photo-compare-panel">
                <div class="patient-photo-measure" hidden></div>
                <div class="patient-photo-measure" hidden></div>
            </div>
        `;

        document.body.appendChild(view);

        const urls = [...view.querySelectorAll("img")].map(img => img.src);

        // Ogni foto ha il suo righello a L (posizione, angolo e dimensione indipendenti),
        // la sua calibrazione e le sue misure: si usano gli stessi strumenti del
        // visualizzatore singolo e il risultato viene salvato nella foto in questione.
        const rulers = [];
        const refits = [];
        const measurers = [];
        const labels = ["Prima", "Dopo"];
        const items = [before, after];
        const homeButton = view.querySelector("[data-cmp=home]");
        const updateHome = () => {
            const out = rulers.some(r => r.isVisible() && r.isOutside());
            homeButton.classList.toggle("attention", out);
        };

        const panels = [...view.querySelectorAll(".patient-photo-compare-panel .patient-photo-measure")];

        view.querySelectorAll(".patient-photo-compare-pane").forEach((el, index) => {
            const item = items[index];
            const stage = el.querySelector(".patient-photo-viewer-stage");
            const layerEl = el.querySelector(".patient-photo-viewer-layer");
            const image = layerEl.querySelector("img");
            let paneZoom = null;
            let paneRuler = null;

            const measurer = createMeasurer({
                item,
                root: view,
                layer: layerEl,
                img: image,
                svg: layerEl.querySelector(".patient-photo-measure-svg"),
                panel: panels[index],
                getZoomScale: () => paneZoom ? paneZoom.getScale() : 1,
                getRuler: () => paneRuler,
                onChange: () => {
                    el.querySelector(".patient-photo-compare-cap").innerHTML =
                        capText(labels[index], item, measurer.getMeasure());
                },
                onModeChange: on => el.querySelector("[data-pane=measure]").classList.toggle("active", on)
            });

            paneRuler = createRuler({
                svg: layerEl.querySelector(".patient-photo-ruler-svg"),
                layer: layerEl,
                img: image,
                state: { x: null, y: null, r: 0, arm: null },
                getMmPerPx: () => measureScale(measurer.getMeasure()),
                getZoomScale: () => paneZoom ? paneZoom.getScale() : 1,
                isInteractive: () => !measurer.isPlacing(),
                onDraw: () => updateHome()
            });

            const fitPane = () => {
                const naturalW = image.naturalWidth || 1;
                const naturalH = image.naturalHeight || 1;
                const box = stage.getBoundingClientRect();
                const factor = Math.min(box.width / naturalW, box.height / naturalH);

                layerEl.style.width = Math.round(naturalW * factor) + "px";
                layerEl.style.height = Math.round(naturalH * factor) + "px";
                measurer.draw();
            };

            paneZoom = attachZoom(stage, layerEl, {
                onChange: () => measurer.draw(),
                onTap: measurer.onTap,
                doubleTap: () => !measurer.isPlacing()
            });

            image.addEventListener("load", fitPane);
            if (image.complete) fitPane();

            el.querySelector("[data-pane=measure]").addEventListener("click", () => {
                const on = !measurer.isMeasuring();

                // Si misura una foto alla volta: il pannello è condiviso.
                measurers.forEach(other => { if (other !== measurer && other.isMeasuring()) other.setMeasuring(false); });
                measurer.setMeasuring(on);
            });

            el.querySelector("[data-pane=delete]").addEventListener("click", async () => {
                if (await confirmAndDeletePhoto(item.id)) {
                    measurers.forEach(m => m.discard());
                    close();
                }
            });

            rulers.push(paneRuler);
            refits.push(fitPane);
            measurers.push(measurer);
        });

        const onResize = () => refits.forEach(fit => fit());
        window.addEventListener("resize", onResize);

        const finish = () => {
            document.removeEventListener("keydown", onKey);
            window.removeEventListener("resize", onResize);
            measurers.forEach(m => m.destroy());
            urls.forEach(url => URL.revokeObjectURL(url));
            view.remove();
            setCompareMode(false);
        };

        const close = () => {
            if (measurers.some(m => m.isDirty()) &&
                !window.confirm("Ci sono misure non salvate. Chiudere senza salvare?")) return;

            finish();
        };

        const onKey = event => {
            if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) {
                if (event.key === "Escape") event.target.blur();
                return;
            }

            if (event.key === "Escape") close();
        };

        document.addEventListener("keydown", onKey);
        view.querySelector("[data-cmp=close]").addEventListener("click", close);

        homeButton.addEventListener("click", () => rulers.forEach(r => r.bringInside()));

        view.querySelector("[data-cmp=ruler]").addEventListener("click", event => {
            const on = !rulers[0].isVisible();
            rulers.forEach(r => r.setVisible(on));
            event.currentTarget.classList.toggle("active", on);
        });
    };

    compareButton.addEventListener("click", () => setCompareMode(!compareMode));
    content.querySelector("#patientPhotoCompareCancel").addEventListener("click", () => setCompareMode(false));
    compareGo.addEventListener("click", () => {
        if (selected.length === 2) openCompare(selected[0], selected[1]);
    });

    const openAddModal = () => {
        document.getElementById("patientPhotoModal")?.remove();

        const modal = document.createElement("div");
        modal.id = "patientPhotoModal";
        modal.className = "patient-photo-modal";

        modal.innerHTML = `
            <div class="patient-photo-modal-card">
                <h3>📷 Nuova foto</h3>

                <input id="patientPhotoNote" type="text" maxlength="120"
                       placeholder="Nota breve (facoltativa)" style="width:100%;margin-bottom:12px">

                <button id="patientPhotoCamera" class="settings-action" type="button">📷 Scatta</button>
                <button id="patientPhotoPick" class="settings-action" type="button">🖼️ Scegli dalla galleria</button>
                <button id="patientPhotoCancel" class="settings-action" type="button">Annulla</button>

                <input id="patientPhotoFileCamera" type="file" accept="image/*" capture="environment" hidden>
                <input id="patientPhotoFilePick" type="file" accept="image/*" hidden>
            </div>
        `;

        document.body.appendChild(modal);

        const cameraButton = modal.querySelector("#patientPhotoCamera");
        const pickButton = modal.querySelector("#patientPhotoPick");
        const noteInput = modal.querySelector("#patientPhotoNote");
        const cameraInput = modal.querySelector("#patientPhotoFileCamera");
        const pickInput = modal.querySelector("#patientPhotoFilePick");

        const close = () => modal.remove();

        cameraButton.addEventListener("click", async () => {
            const note = noteInput.value;

            if (navigator.mediaDevices?.getUserMedia && !liveCameraFailed) {
                close();

                try {
                    await openLiveCamera(note);
                } catch (error) {
                    console.warn("Fotocamera integrata non disponibile:", error);
                    liveCameraFailed = true;
                    showMessage(
                        "Fotocamera integrata non disponibile (permesso negato?). " +
                        "Tocca di nuovo Nuova foto → Scatta per usare la fotocamera del telefono."
                    );
                }

                return;
            }

            cameraInput.click();
        });

        pickButton.addEventListener("click", () => pickInput.click());
        modal.querySelector("#patientPhotoCancel").addEventListener("click", close);

        modal.addEventListener("click", event => {
            if (event.target === modal) close();
        });

        const handleFile = event => {
            const file = event.target.files?.[0];
            if (!file) return;

            const note = noteInput.value;
            close();
            saveFile(file, note);
        };

        cameraInput.addEventListener("change", handleFile);
        pickInput.addEventListener("change", handleFile);
    };

    // Zoom e spostamento con i gesti: pizzico, rotella, doppio tocco, trascinamento.
    const attachZoom = (stage, img, options = {}) => {
        const MIN = 1;
        const MAX = 8;
        let scale = 1, x = 0, y = 0;

        const pointers = new Map();
        let pinchStart = null;
        let dragStart = null;
        let moved = false;
        let lastTap = 0;

        const clampPan = () => {
            const rect = stage.getBoundingClientRect();
            const maxX = Math.max(0, (img.offsetWidth * scale - rect.width) / 2);
            const maxY = Math.max(0, (img.offsetHeight * scale - rect.height) / 2);
            x = Math.min(maxX, Math.max(-maxX, x));
            y = Math.min(maxY, Math.max(-maxY, y));
        };

        const apply = () => {
            if (scale <= MIN) { x = 0; y = 0; }
            clampPan();
            img.style.transform = "translate(" + x + "px," + y + "px) scale(" + scale + ")";
            options.onChange?.(scale);
        };

        // Zoom mantenendo fermo il punto (cx, cy), in coordinate dello schermo.
        const zoomAt = (newScale, cx, cy) => {
            newScale = Math.min(MAX, Math.max(MIN, newScale));
            const rect = stage.getBoundingClientRect();
            const px = cx - (rect.left + rect.width / 2);
            const py = cy - (rect.top + rect.height / 2);
            const ratio = newScale / scale;

            x = px - (px - x) * ratio;
            y = py - (py - y) * ratio;
            scale = newScale;
            apply();
        };

        const center = () => {
            const rect = stage.getBoundingClientRect();
            return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        };

        stage.addEventListener("wheel", event => {
            event.preventDefault();
            zoomAt(scale * (event.deltaY < 0 ? 1.2 : 1 / 1.2), event.clientX, event.clientY);
        }, { passive: false });

        const distance = () => {
            const [a, b] = [...pointers.values()];
            return Math.hypot(a.x - b.x, a.y - b.y);
        };

        stage.addEventListener("pointerdown", event => {
            stage.setPointerCapture(event.pointerId);
            pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
            moved = false;

            if (pointers.size === 2) {
                pinchStart = { dist: distance(), scale };
                dragStart = null;
            } else if (pointers.size === 1) {
                dragStart = { px: event.clientX, py: event.clientY, x, y };
            }
        });

        stage.addEventListener("pointermove", event => {
            if (!pointers.has(event.pointerId)) return;
            pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

            if (pointers.size === 2 && pinchStart) {
                const [a, b] = [...pointers.values()];
                zoomAt(
                    pinchStart.scale * distance() / pinchStart.dist,
                    (a.x + b.x) / 2,
                    (a.y + b.y) / 2
                );
                moved = true;
            } else if (pointers.size === 1 && dragStart && scale > MIN) {
                const dx = event.clientX - dragStart.px;
                const dy = event.clientY - dragStart.py;
                if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
                x = dragStart.x + dx;
                y = dragStart.y + dy;
                apply();
            } else if (dragStart && Math.hypot(event.clientX - dragStart.px, event.clientY - dragStart.py) > 6) {
                moved = true;
            }
        });

        const release = event => {
            const wasSingle = pointers.size === 1;
            pointers.delete(event.pointerId);
            pinchStart = null;

            if (pointers.size === 1) {
                const [rest] = [...pointers.values()];
                dragStart = { px: rest.x, py: rest.y, x, y };
                return;
            }

            dragStart = null;

            if (!wasSingle || moved || event.type === "pointercancel") return;

            // Con il tocco "catturato" dal contenitore, event.target è sempre lo stage:
            // si capisce se il tocco è sulla foto confrontando le coordinate.
            const box = img.getBoundingClientRect();
            const onPhoto =
                event.clientX >= box.left && event.clientX <= box.right &&
                event.clientY >= box.top && event.clientY <= box.bottom;

            // Modalità misura: tocco immediato, senza zoom con doppio tocco.
            if (options.doubleTap && !options.doubleTap()) {
                options.onTap?.(event, onPhoto);
                return;
            }

            // Doppio tocco: alterna tra adattata e ingrandita.
            const now = Date.now();

            if (now - lastTap < 320) {
                lastTap = 0;
                if (scale > MIN) zoomAt(MIN, event.clientX, event.clientY);
                else zoomAt(3, event.clientX, event.clientY);
                return;
            }

            lastTap = now;

            // Tocco singolo sullo sfondo (fuori dalla foto) con foto adattata: chiude.
            if (scale === MIN && !onPhoto) {
                setTimeout(() => { if (lastTap === now) options.onBackgroundTap?.(); }, 330);
            }
        };

        stage.addEventListener("pointerup", release);
        stage.addEventListener("pointercancel", release);

        return {
            getScale: () => scale,
            zoomBy: factor => zoomAt(scale * factor, center().x, center().y),
            reset: () => { scale = 1; x = 0; y = 0; apply(); }
        };
    };

    // Posizione e orientamento del righello a L: restano tra una foto e l'altra.
    const rulerState = { x: null, y: null, r: 0, arm: null };

    /* ---------- Misura della lesione ---------- */

    // Diametri ufficiali delle monete euro (mm), usabili come riferimento di scala.
    const MEASURE_REFS = [
        { key: "coin-200", label: "Moneta 2 €", mm: 25.75 },
        { key: "coin-100", label: "Moneta 1 €", mm: 23.25 },
        { key: "coin-050", label: "Moneta 50 cent", mm: 24.25 },
        { key: "coin-020", label: "Moneta 20 cent", mm: 22.25 },
        { key: "coin-010", label: "Moneta 10 cent", mm: 19.75 },
        { key: "custom", label: "Righello / altra misura (mm)", mm: 0 }
    ];

    const formatCm = mm => (mm / 10).toLocaleString("it-IT", {
        minimumFractionDigits: 1, maximumFractionDigits: 1
    });

    // Es.: "L 3,2 cm · P 2,1 cm · ≈ 6,7 cm² (L×P)".
    const measureSummary = measure => {
        const length = measure?.lines?.L?.mm;
        const width = measure?.lines?.W?.mm;
        const parts = [];

        if (length) parts.push("L " + formatCm(length) + " cm");
        if (width) parts.push("P " + formatCm(width) + " cm");

        if (length && width) {
            parts.push("≈ " + ((length / 10) * (width / 10)).toLocaleString("it-IT", {
                minimumFractionDigits: 1, maximumFractionDigits: 1
            }) + " cm² (L×P)");
        }

        return parts.join(" · ");
    };

    const markMeasured = (id, on) => {
        const date = gallery.querySelector('[data-card="' + CSS.escape(id) + '"] .patient-photo-date');
        if (!date) return;
        date.textContent = date.textContent.replace(" 📏", "") + (on ? " 📏" : "");
    };

    // Scala della foto in mm per pixel, ricavata dal riferimento salvato (0 = non calibrata).
    const measureScale = measure => {
        if (!measure?.ref) return 0;
        const [a, b] = measure.ref;
        const length = Math.hypot(a[0] - b[0], a[1] - b[1]);
        return length > 0 ? measure.refMm / length : 0;
    };

    /*
     * Righello a L sovrapposto alla foto. Si comporta come una foto:
     *  - un dito sul righello lo sposta;
     *  - due dita lo ingrandiscono/rimpiccioliscono e lo ruotano (pizzico + torsione);
     *  - la maniglia blu all'angolo lo ruota liberamente (un tocco = +90°);
     *  - la maniglia verde sulla punta lo allunga o lo accorcia;
     *  - rotella = dimensione, Maiusc + rotella = rotazione.
     * Calibrato: tacche in scala reale, la lunghezza è un numero intero di cm.
     * Non calibrato: stesso righello con 10 cm nominali, marcato "NON IN SCALA".
     */
    const createRuler = ({ svg, layer, img, state, getMmPerPx, getZoomScale, isInteractive = () => true, onDraw = null }) => {
        let visible = true;
        // Il righello è libero: può uscire dai bordi della foto e crescere ben oltre lo schermo.
        const MAX_ARM = 6;
        const pointers = new Map();
        let mode = null;

        const normalize = degrees => ((degrees % 360) + 360) % 360;

        const geometry = () => {
            const width = img.naturalWidth || 1;
            const height = img.naturalHeight || 1;
            const screenPerImage = (layer.offsetWidth / width) * getZoomScale() || 1;
            const unit = 1 / screenPerImage;
            const scaleMm = getMmPerPx();
            const calibrated = scaleMm > 0;
            const pxPerMm = calibrated ? 1 / scaleMm : 0;
            const minSide = Math.min(width, height);

            if (!state.arm) {
                state.arm = calibrated
                    ? ([10, 5, 3, 2, 1].find(cm => cm * 10 * pxPerMm <= minSide * 0.8) || 1) * 10 * pxPerMm
                    : minSide * 0.4;
            }

            let armPx = Math.min(Math.max(state.arm, minSide * 0.08), minSide * MAX_ARM);
            state.arm = armPx;   // lo stato non resta mai oltre i limiti: rotella e pizzico rispondono subito
            let armCm = 0;

            if (calibrated) {
                const maxCm = Math.max(1, Math.floor(minSide * MAX_ARM / (10 * pxPerMm)));
                armCm = Math.min(maxCm, Math.max(1, Math.round(armPx / (10 * pxPerMm))));
                armPx = armCm * 10 * pxPerMm;
            }

            const tickPxPerMm = calibrated ? pxPerMm : armPx / 100;      // non calibrato: 10 cm nominali
            const totalMm = calibrated ? armCm * 10 : 100;
            const stripPx = Math.min(Math.max(12 * tickPxPerMm, 22 * unit), armPx * 0.4);

            return { width, height, screenPerImage, unit, calibrated, armPx, tickPxPerMm, totalMm, stripPx };
        };

        const draw = (clampPosition = false) => {
            const g0 = geometry();
            svg.setAttribute("viewBox", "0 0 " + g0.width + " " + g0.height);

            if (!visible) {
                svg.innerHTML = "";
                if (onDraw) onDraw();
                return;
            }

            const { width, height, screenPerImage, unit, calibrated, armPx, tickPxPerMm, totalMm, stripPx } = g0;

            if (state.x === null) {
                state.x = width * 0.05;
                state.y = height * 0.05;
            }

            const rad = state.r * Math.PI / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);

            // Il vincolo (L intera dentro la foto) si applica solo su richiesta: pulsante "Riporta dentro".
            if (clampPosition) {
                const corners = [[0, 0], [armPx, 0], [armPx, stripPx], [stripPx, stripPx], [stripPx, armPx], [0, armPx]];
                const spread = corners.map(([lx, ly]) => [state.x + lx * cos - ly * sin, state.y + lx * sin + ly * cos]);
                const minX = Math.min(...spread.map(q => q[0]));
                const maxX = Math.max(...spread.map(q => q[0]));
                const minY = Math.min(...spread.map(q => q[1]));
                const maxY = Math.max(...spread.map(q => q[1]));

                let shiftX = maxX > width ? width - maxX : 0;
                if (minX + shiftX < 0) shiftX = -minX;
                let shiftY = maxY > height ? height - maxY : 0;
                if (minY + shiftY < 0) shiftY = -minY;

                state.x += shiftX;
                state.y += shiftY;
            }

            const toGlobal = (lx, ly) => [state.x + lx * cos - ly * sin, state.y + lx * sin + ly * cos];
            const interactive = isInteractive();
            const pe = interactive ? "pointer-events:all" : "pointer-events:none";
            const body = `M0,0 H${armPx} V${stripPx} H${stripPx} V${armPx} H0 Z`;
            const parts = [];
            const labels = [];

            parts.push(`<g data-ruler="1" transform="translate(${state.x} ${state.y}) rotate(${state.r})" style="${pe};${interactive ? "cursor:grab" : ""}">`);
            parts.push(`<path d="${body}" fill="transparent" stroke="transparent" stroke-width="22" vector-effect="non-scaling-stroke"/>`);
            parts.push(`<path d="${body}" fill="rgba(255,255,255,.92)" stroke="${calibrated ? "#000" : "#d97706"}" stroke-width="${calibrated ? 1.6 : 2.4}" vector-effect="non-scaling-stroke"${calibrated ? "" : ' stroke-dasharray="8 4"'}/>`);

            // Bordo interno: fascia a quadretti bianchi e neri da 1 cm (stile righello forense),
            // solo sui bracci, fuori dal quadrato d'angolo.
            const barThickness = stripPx * 0.24;
            const cmPx = tickPxPerMm * 10;
            const cmCount = Math.floor(totalMm / 10);

            for (let i = 0; i < cmCount; i++) {
                const fill = i % 2 === 0 ? "#111" : "#fff";
                const start = Math.max(i * cmPx, stripPx);
                const length = (i + 1) * cmPx - start;
                if (length <= 0) continue;

                parts.push(
                    `<rect x="${start}" y="${stripPx - barThickness}" width="${length}" height="${barThickness}" fill="${fill}" stroke="#111" stroke-width="0.8" vector-effect="non-scaling-stroke"/>`,
                    `<rect x="${stripPx - barThickness}" y="${start}" width="${barThickness}" height="${length}" fill="${fill}" stroke="#111" stroke-width="0.8" vector-effect="non-scaling-stroke"/>`
                );
            }

            const mmScreen = tickPxPerMm * screenPerImage;       // pixel dello schermo per mm
            const cmScreen = mmScreen * 10;
            const tick = (t, length) => {
                const pos = t * tickPxPerMm;
                parts.push(`<path d="M${pos},0 V${length} M0,${pos} H${length}" stroke="#000" stroke-width="1" vector-effect="non-scaling-stroke"/>`);
            };

            for (let t = 0; t <= totalMm; t++) {
                if (t % 10 === 0) tick(t, stripPx * 0.44);
                else if (t % 5 === 0 && mmScreen * 5 >= 4) tick(t, stripPx * 0.32);
                else if (mmScreen >= 3.2) tick(t, stripPx * 0.2);
            }

            parts.push("</g>");

            const every = cmScreen >= 18 ? 1 : cmScreen >= 9 ? 2 : 5;
            const fontSize = Math.min(11 * unit, stripPx * 0.24);
            const numberColor = "#000";

            for (let n = every; n * 10 <= totalMm; n += every) {
                const along = n * 10 * tickPxPerMm;
                const [hx, hy] = toGlobal(along, stripPx * 0.6);
                const [vx, vy] = toGlobal(stripPx * 0.6, along);

                [[hx, hy], [vx, vy]].forEach(([tx, ty]) => labels.push(
                    `<text x="${tx}" y="${ty}" text-anchor="middle" dominant-baseline="central" font-size="${fontSize}" font-weight="700" fill="${numberColor}">${n}</text>`
                ));
            }

            const [cx, cy] = toGlobal(stripPx * 0.5, stripPx * 0.5);
            // L'unità si scrive solo quando la scala è vera.
            if (calibrated) {
                labels.push(`<text x="${cx}" y="${cy + fontSize * 1.5}" text-anchor="middle" dominant-baseline="central" font-size="${fontSize * 0.9}" fill="${numberColor}">cm</text>`);
            }

            if (!calibrated) {
                const [bx, by] = toGlobal(stripPx * 1.2, stripPx * 1.8);
                labels.push(`<text x="${bx}" y="${by}" text-anchor="start" dominant-baseline="central" font-size="${Math.min(12 * unit, stripPx * 0.55)}" font-weight="700" fill="#b45309" stroke="#fff" stroke-width="${3 * unit}" paint-order="stroke">NON IN SCALA</text>`);
            }

            // Maniglie: rotazione (angolo) e lunghezza (punta del braccio).
            const handleR = Math.min(stripPx * 0.42, 15 * unit);
            const handle = (kind, lx, ly, fill, glyph) => {
                const [hx, hy] = toGlobal(lx, ly);
                parts.push(
                    `<circle ${kind}="1" cx="${hx}" cy="${hy}" r="${handleR}" fill="${fill}" stroke="#fff" stroke-width="${1.5 * unit}" style="${pe}"/>`,
                    `<text x="${hx}" y="${hy}" text-anchor="middle" dominant-baseline="central" font-size="${handleR * 1.3}" fill="#fff" style="pointer-events:none">${glyph}</text>`
                );
            };

            handle("data-ruler-rot", stripPx * 0.5, stripPx * 0.5, "#2f81f7", "↻");
            handle("data-ruler-size", armPx - stripPx * 0.5, stripPx * 0.5, "#238636", "⤢");

            svg.innerHTML = parts.join("") + labels.join("");
            if (onDraw) onDraw();
        };

        const cornerOnScreen = g => {
            const box = layer.getBoundingClientRect();
            return [
                box.left + state.x / g.width * box.width,
                box.top + state.y / g.height * box.height
            ];
        };

        svg.addEventListener("pointerdown", event => {
            const rot = event.target.closest?.("[data-ruler-rot]");
            const size = event.target.closest?.("[data-ruler-size]");
            const body = event.target.closest?.("[data-ruler]");
            if (!rot && !size && !body) return;

            // Il gesto è del righello: la foto sotto non si sposta e non riceve il tocco.
            event.stopPropagation();
            event.preventDefault();

            try { svg.setPointerCapture(event.pointerId); } catch (_) {}
            pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

            if (pointers.size === 2) {
                const [a, b] = [...pointers.values()];
                mode = {
                    type: "pinch",
                    d0: Math.hypot(b.x - a.x, b.y - a.y) || 1,
                    a0: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI,
                    mx0: (a.x + b.x) / 2,
                    my0: (a.y + b.y) / 2,
                    arm0: state.arm,
                    r0: state.r,
                    x0: state.x,
                    y0: state.y
                };
                return;
            }

            mode = {
                type: rot ? "rot" : size ? "size" : "move",
                id: event.pointerId,
                sx: event.clientX,
                sy: event.clientY,
                x0: state.x,
                y0: state.y,
                moved: false
            };
        });

        svg.addEventListener("pointermove", event => {
            if (!mode || !pointers.has(event.pointerId)) return;
            pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

            const g = geometry();

            if (mode.type === "pinch") {
                if (pointers.size < 2) return;

                const [a, b] = [...pointers.values()];
                const distance = Math.hypot(b.x - a.x, b.y - a.y) || 1;
                const angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;

                state.arm = mode.arm0 * distance / mode.d0;
                state.r = normalize(mode.r0 + (angle - mode.a0));
                state.x = mode.x0 + ((a.x + b.x) / 2 - mode.mx0) / g.screenPerImage;
                state.y = mode.y0 + ((a.y + b.y) / 2 - mode.my0) / g.screenPerImage;
                draw(false);
                return;
            }

            if (event.pointerId !== mode.id) return;

            const dx = event.clientX - mode.sx;
            const dy = event.clientY - mode.sy;
            if (Math.abs(dx) + Math.abs(dy) > 4) mode.moved = true;
            if (!mode.moved) return;

            if (mode.type === "move") {
                state.x = mode.x0 + dx / g.screenPerImage;
                state.y = mode.y0 + dy / g.screenPerImage;
            } else {
                const [cx, cy] = cornerOnScreen(g);
                const vx = event.clientX - cx;
                const vy = event.clientY - cy;

                if (mode.type === "rot") {
                    // La maniglia sta a 45° dall'asse del braccio: la si segue col dito.
                    let angle = normalize(Math.atan2(vy, vx) * 180 / Math.PI - 45);
                    const nearest = Math.round(angle / 90) * 90;
                    if (Math.abs(angle - nearest) < 4) angle = normalize(nearest);
                    state.r = angle;
                } else {
                    const rad = state.r * Math.PI / 180;
                    const along = (vx * Math.cos(rad) + vy * Math.sin(rad)) / g.screenPerImage;
                    state.arm = Math.max(along + g.stripPx * 0.5, 1);
                }
            }

            draw();
        });

        const release = event => {
            if (!pointers.has(event.pointerId)) return;
            pointers.delete(event.pointerId);

            if (mode && mode.type === "rot" && !mode.moved && event.type === "pointerup") {
                state.r = normalize(state.r + 90);
                draw();
            }

            if (!mode || mode.type === "pinch" || mode.id === event.pointerId) {
                mode = null;
                pointers.clear();
                draw();
            }
        };

        svg.addEventListener("pointerup", release);
        svg.addEventListener("pointercancel", release);

        svg.addEventListener("wheel", event => {
            if (!event.target.closest?.("[data-ruler],[data-ruler-rot],[data-ruler-size]")) return;

            event.preventDefault();
            event.stopPropagation();

            if (event.shiftKey) {
                state.r = normalize(state.r + (event.deltaY < 0 ? -5 : 5));
            } else {
                state.arm = (state.arm || 1) * (event.deltaY < 0 ? 1.08 : 1 / 1.08);
            }

            draw();
        }, { passive: false });

        // Riporta la "L" dentro la foto (anche rimpicciolendola se è più grande dell'immagine).
        const bringInside = () => {
            const minSide = Math.min(img.naturalWidth || 1, img.naturalHeight || 1);
            if (state.arm) state.arm = Math.min(state.arm, minSide * 0.7);
            draw(true);
            draw(true);   // seconda passata: il righello calibrato arrotonda i cm e può cambiare ingombro
        };

        // Vero se una parte della "L" sporge dalla foto (o se è più grande di essa).
        const isOutside = () => {
            const g = geometry();
            if (state.x === null) return false;
            const rad = state.r * Math.PI / 180;
            const cos = Math.cos(rad), sin = Math.sin(rad);
            const corners = [[0, 0], [g.armPx, 0], [g.armPx, g.stripPx], [0, g.armPx]];
            return corners.some(([lx, ly]) => {
                const x = state.x + lx * cos - ly * sin;
                const y = state.y + lx * sin + ly * cos;
                return x < -1 || y < -1 || x > g.width + 1 || y > g.height + 1;
            });
        };

        return {
            draw: () => draw(),
            setVisible: on => { visible = on; draw(); },
            isVisible: () => visible,
            bringInside,
            isOutside
        };
    };

    // Elimina una foto (con conferma) e aggiorna la galleria. Vero se è stata eliminata.
    const confirmAndDeletePhoto = async id => {
        if (!window.confirm("Eliminare questa foto dal dispositivo? L'operazione non si può annullare.")) return false;

        let deleted = false;

        try {
            await photos.deletePhoto(id);
            deleted = true;
            showMessage("Foto eliminata.");
        } catch (error) {
            console.error("Errore eliminazione foto:", error);
            showMessage("Impossibile eliminare la foto.");
        }

        await renderGallery();
        await refreshStorage();
        return deleted;
    };

    /*
     * Calibrazione e misura (riferimento di scala, lunghezza, larghezza) di UNA foto.
     * Usata sia dal visualizzatore singolo sia dal confronto: ogni foto salva la
     * propria misura. Mentre si segnano i punti il layout si nasconde (classe
     * "measure-focus" su root) e resta solo una pillola compatta.
     */
    const createMeasurer = ({ item, root, layer, img, svg, panel, getZoomScale, getRuler, onChange = () => {}, onModeChange = () => {} }) => {
        /* ----- stato della misura ----- */

        let measure = item?.measure
            ? JSON.parse(JSON.stringify(item.measure))
            : { ref: null, refMm: 0, refKey: "coin-200", lines: {} };

        let refKey = measure.refKey || "coin-200";
        let refMm = measure.refMm || 25.75;
        let measuring = false;
        let step = null;          // "ref" | "L" | "W" | null
        let pending = [];
        let dirty = false;
        let panelMessage = "";
        let placing = false;      // true mentre si toccano i punti: il layout sparisce

        // Righello a L sovrapposto: sempre visibile all'apertura, trascinabile.
        // La posizione resta quella dell'ultima volta finché non si ricarica la pagina.
        const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
        const hasContent = () => Boolean(measure.ref || Object.keys(measure.lines).length);

        const mmPerPx = () => measure.ref ? measure.refMm / dist(measure.ref[0], measure.ref[1]) : 0;

        const recompute = () => {
            const scale = mmPerPx();
            Object.values(measure.lines).forEach(line => {
                line.mm = dist(line.pts[0], line.pts[1]) * scale;
            });
        };


        /* ----- disegno dei segni sulla foto ----- */

        const draw = () => {
            const naturalW = img.naturalWidth || 1;
            const naturalH = img.naturalHeight || 1;
            svg.setAttribute("viewBox", "0 0 " + naturalW + " " + naturalH);

            const zoomScale = getZoomScale();
            const screenPerImage = (layer.offsetWidth / naturalW) * zoomScale || 1;
            const unit = 1 / screenPerImage;               // unità immagine per pixel schermo
            const radius = 7 * unit;
            const fontSize = 13 * unit;

            const colors = { ref: "#ffb020", L: "#22d3ee", W: "#4ade80" };
            const parts = [];

            const segment = (pts, color, label, dashed, side) => {
                const [a, b] = pts;
                const midX = (a[0] + b[0]) / 2;
                const midY = (a[1] + b[1]) / 2;

                parts.push(
                    `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#000" stroke-opacity=".55" stroke-width="5" vector-effect="non-scaling-stroke"/>`,
                    `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${color}" stroke-width="2.5" vector-effect="non-scaling-stroke"${dashed ? ' stroke-dasharray="6 4"' : ""}/>`
                );

                [a, b].forEach(point => parts.push(
                    `<circle cx="${point[0]}" cy="${point[1]}" r="${radius}" fill="none" stroke="#000" stroke-opacity=".55" stroke-width="${4 * unit}"/>`,
                    `<circle cx="${point[0]}" cy="${point[1]}" r="${radius}" fill="none" stroke="${color}" stroke-width="${2 * unit}"/>`
                ));

                if (label) {
                    // La larghezza si scrive a destra della linea, così non copre la lunghezza.
                    const right = side === "right";
                    const textX = right ? midX + 14 * unit : midX;
                    const textY = right ? midY + 4 * unit : midY - 12 * unit;

                    parts.push(
                        `<text x="${textX}" y="${textY}" text-anchor="${right ? "start" : "middle"}" font-size="${fontSize}" font-weight="700" fill="${color}" stroke="#000" stroke-width="${3 * unit}" paint-order="stroke">${escapeHtml(label)}</text>`
                    );
                }
            };

            if (measure.ref) segment(measure.ref, colors.ref, measure.refMm.toLocaleString("it-IT") + " mm", true);
            if (measure.lines.L) segment(measure.lines.L.pts, colors.L, "L " + formatCm(measure.lines.L.mm) + " cm", false);
            if (measure.lines.W) segment(measure.lines.W.pts, colors.W, "P " + formatCm(measure.lines.W.mm) + " cm", false, "right");

            pending.forEach(point => parts.push(
                `<circle cx="${point[0]}" cy="${point[1]}" r="${radius}" fill="none" stroke="#000" stroke-opacity=".55" stroke-width="${4 * unit}"/>`,
                `<circle cx="${point[0]}" cy="${point[1]}" r="${radius}" fill="none" stroke="#fff" stroke-width="${2 * unit}"/>`,
                `<circle cx="${point[0]}" cy="${point[1]}" r="${1.5 * unit}" fill="#fff"/>`
            ));

            svg.innerHTML = parts.join("");
            getRuler()?.draw();
        };



        /* ----- pannello di misura ----- */

        /* ----- pillola compatta mentre si segnano i punti ----- */

        const pill = document.createElement("div");
        pill.className = "patient-photo-focus-pill";
        pill.hidden = true;
        pill.innerHTML = `
            <span class="patient-photo-focus-text"></span>
            <button type="button" data-pill="undo" aria-label="Annulla l'ultimo punto" title="Annulla l'ultimo punto">↩︎</button>
            <button type="button" data-pill="menu" aria-label="Mostra il menu di misura" title="Mostra il menu di misura">☰</button>
        `;
        root.appendChild(pill);

        const stepLabel = { ref: "il riferimento", L: "la lunghezza", W: "la larghezza" };
        let focusShown = false;

        const syncFocus = () => {
            const focus = measuring && placing && Boolean(step);
            root.classList.toggle("measure-focus", focus);
            pill.hidden = !focus;

            if (focus) {
                pill.querySelector(".patient-photo-focus-text").textContent =
                    "Tocca " + stepLabel[step] + " · punto " + (pending.length + 1) + " di 2";
            }

            if (focus !== focusShown) {
                focusShown = focus;
                // Il layout è cambiato: le foto devono riadattarsi allo spazio disponibile.
                window.dispatchEvent(new Event("resize"));
            }
        };

        const cancelPlacing = () => {
            placing = false;
            pending = [];
            if (step !== "ref") step = null;
            panelMessage = "";
            renderPanel();
            draw();
        };

        pill.addEventListener("click", event => {
            const action = event.target.closest("[data-pill]")?.dataset.pill;
            if (!action) return;

            if (action === "undo") {
                if (pending.length) {
                    pending.pop();
                    renderPanel();
                    draw();
                } else {
                    cancelPlacing();
                }
            }

            if (action === "menu") cancelPlacing();
        });


        const renderPanel = () => {
            panel.hidden = !measuring || placing;
            syncFocus();
            if (!measuring) return;

            const calibrated = Boolean(measure.ref);
            let html = "";

            if (!calibrated || step === "ref") {
                html += `
                    <strong>1 · Riferimento di scala</strong>
                    <div class="patient-photo-measure-row">
                        <select id="measureRef" aria-label="Riferimento">
                            ${MEASURE_REFS.map(ref => `<option value="${ref.key}"${ref.key === refKey ? " selected" : ""}>${ref.label}</option>`).join("")}
                        </select>
                        <input id="measureRefMm" type="text" inputmode="decimal" placeholder="mm"
                               value="${refMm ? String(refMm).replace(".", ",") : ""}"
                               ${refKey === "custom" ? "" : "disabled"} aria-label="Misura del riferimento in mm">
                    </div>
                    <p>Inquadra la moneta o il righello vicino alla lesione, sullo stesso piano. Poi premi il pulsante: il menu si nasconde e tocchi le due estremità del riferimento (per la moneta, il diametro).</p>
                    <div class="patient-photo-measure-row">
                        <button type="button" data-m="start" class="active">▶ Segna i due punti</button>
                    </div>
                `;
                step = "ref";
            } else {
                html += `
                    <strong>2 · Misura</strong>
                    <span class="patient-photo-measure-ref">scala: ${measure.refMm.toLocaleString("it-IT")} mm</span>
                    <div class="patient-photo-measure-row">
                        <button type="button" data-m="L" class="${step === "L" ? "active" : ""}">Lunghezza</button>
                        <button type="button" data-m="W" class="${step === "W" ? "active" : ""}">Larghezza</button>
                    </div>
                `;
            }

            html += `<p class="patient-photo-measure-status">${
                escapeHtml(panelMessage || (step
                    ? "Tocca " + stepLabel[step] + ": punto " + (pending.length + 1) + " di 2."
                    : "Scegli cosa misurare."))
            }</p>`;

            const summary = measureSummary(measure);
            if (summary) html += `<p class="patient-photo-measure-result">${escapeHtml(summary)}</p>`;

            html += `
                <div class="patient-photo-measure-row">
                    <button type="button" data-m="recal"${calibrated ? "" : " disabled"}>Ricalibra</button>
                    <button type="button" data-m="clear"${hasContent() ? "" : " disabled"}>Azzera</button>
                    <button type="button" data-m="save"${dirty ? "" : " disabled"}>💾 Salva</button>
                    <button type="button" data-m="done">Fine</button>
                </div>
                <p class="patient-photo-measure-warn">⚠️ Misura indicativa: vale con riferimento sullo stesso piano della lesione e fotocamera perpendicolare. Non sostituisce la misurazione clinica.</p>
            `;

            panel.innerHTML = html;
        };

        const setMeasuring = on => {
            measuring = on;
            placing = false;
            pending = [];
            panelMessage = "";
            step = on ? (measure.ref ? null : "ref") : null;
            onModeChange(on);
            renderPanel();
            draw();
        };

        const finishStep = () => {
            if (step === "ref") {
                if (!(refMm > 0)) {
                    panelMessage = "Inserisci la misura del riferimento in mm.";
                    pending = [];
                    return;
                }

                if (dist(pending[0], pending[1]) < 2) {
                    panelMessage = "I due punti sono troppo vicini: riprova.";
                    pending = [];
                    return;
                }

                measure.ref = pending.map(point => point.slice());
                measure.refMm = refMm;
                measure.refKey = refKey;
                recompute();
                step = null;
            } else if (step === "L" || step === "W") {
                if (dist(pending[0], pending[1]) < 2) {
                    panelMessage = "I due punti sono troppo vicini: riprova.";
                    pending = [];
                    return;
                }

                measure.lines[step] = {
                    pts: pending.map(point => point.slice()),
                    mm: dist(pending[0], pending[1]) * mmPerPx()
                };
                step = null;
            }

            pending = [];
            panelMessage = "";
            dirty = true;
            onChange();
        };

        // Tocco sulla foto in modalità misura: lo converte in coordinate dell'immagine.
        const onMeasureTap = (event, onPhoto) => {
            if (!measuring || !step || !placing || !onPhoto) return;

            const box = layer.getBoundingClientRect();
            const naturalW = img.naturalWidth || 1;
            const naturalH = img.naturalHeight || 1;

            pending.push([
                Math.round((event.clientX - box.left) / box.width * naturalW * 10) / 10,
                Math.round((event.clientY - box.top) / box.height * naturalH * 10) / 10
            ]);

            panelMessage = "";

            if (pending.length === 2) {
                finishStep();
                placing = false;
            }

            renderPanel();
            draw();
        };

        panel.addEventListener("change", event => {
            if (event.target.id === "measureRef") {
                refKey = event.target.value;
                const preset = MEASURE_REFS.find(ref => ref.key === refKey);
                refMm = preset?.mm || 0;
                renderPanel();
            }

            if (event.target.id === "measureRefMm") {
                refMm = parseItalianNumber(event.target.value);
                if (!Number.isFinite(refMm)) refMm = 0;
            }
        });

        panel.addEventListener("input", event => {
            if (event.target.id === "measureRefMm") {
                const value = parseItalianNumber(event.target.value);
                refMm = Number.isFinite(value) ? value : 0;
            }
        });

        panel.addEventListener("click", async event => {
            const action = event.target.closest("[data-m]")?.dataset.m;
            if (!action) return;

            if (action === "L" || action === "W") {
                step = action;
                pending = [];
                panelMessage = "";
                placing = true;
            }

            if (action === "start") {
                if (!(refMm > 0)) {
                    panelMessage = "Inserisci la misura del riferimento in mm.";
                } else {
                    pending = [];
                    panelMessage = "";
                    placing = true;
                }
            }

            if (action === "recal") {
                placing = false;
                step = "ref";
                pending = [];
                panelMessage = "";
            }

            if (action === "clear") {
                if (!window.confirm("Azzerare riferimento e misure di questa foto?")) return;
                measure = { ref: null, refMm: 0, refKey, lines: {} };
                placing = false;
                step = "ref";
                pending = [];
                dirty = true;
                onChange();
            }

            if (action === "save") {
                try {
                    await photos.updateRecord(item.id, { measure: hasContent() ? measure : null });
                    item.measure = hasContent() ? JSON.parse(JSON.stringify(measure)) : undefined;
                    dirty = false;
                    markMeasured(item.id, Boolean(measureSummary(measure)));
                    panelMessage = "Misura salvata con la foto.";
                    showMessage("Misura salvata.");
                } catch (error) {
                    console.error("Errore salvataggio misura:", error);
                    panelMessage = "Impossibile salvare la misura.";
                }
            }

            if (action === "done") {
                setMeasuring(false);
                return;
            }

            renderPanel();
            draw();
        });

        return {
            draw,
            setMeasuring,
            onTap: onMeasureTap,
            getMeasure: () => measure,
            isMeasuring: () => measuring,
            isPlacing: () => measuring && placing && Boolean(step),
            isDirty: () => dirty,
            discard: () => { dirty = false; },
            destroy: () => { pill.remove(); root.classList.remove("measure-focus"); }
        };

    };

    // Visualizzatore a schermo intero: pizzico a due dita, rotella, doppio
    // tocco, pulsanti +/− e trascinamento per spostare la foto ingrandita.
    // Include il righello: calibra su un riferimento noto e misura L e P.
    const openPhotoViewer = (src, item) => {
        document.getElementById("patientPhotoViewer")?.remove();

        const viewer = document.createElement("div");
        viewer.id = "patientPhotoViewer";
        viewer.className = "patient-photo-viewer";
        viewer.dataset.returnUrl = window.location.href;
        window.history.pushState({ patientPhotoViewer: true }, "", window.location.href);

        const date = item
            ? new Date(item.createdAt).toLocaleString("it-IT", {
                day: "2-digit", month: "2-digit", year: "numeric",
                hour: "2-digit", minute: "2-digit"
            })
            : "";

        viewer.innerHTML = `
            <div class="patient-photo-viewer-stage">
                <div class="patient-photo-viewer-layer">
                    <img src="${escapeAttribute(src)}" alt="" draggable="false">
                    <svg class="patient-photo-measure-svg" aria-hidden="true"></svg>
                    <svg class="patient-photo-ruler-svg" aria-hidden="true"></svg>
                </div>
            </div>
            <div class="patient-photo-viewer-top">
                <span class="patient-photo-viewer-caption"></span>
                ${item ? '<button type="button" data-viewer="home" aria-label="Riporta il righello dentro la foto" title="Riporta il righello dentro la foto">🎯</button>' : ""}
                ${item ? '<button type="button" data-viewer="ruler" class="active" aria-label="Mostra o nascondi il righello a L">📐</button>' : ""}
                ${item ? '<button type="button" data-viewer="measure" aria-label="Misura">📏</button>' : ""}
                ${item ? '<button type="button" data-viewer="delete" aria-label="Elimina foto" title="Elimina foto">🗑️</button>' : ""}
                <button type="button" data-viewer="out" aria-label="Riduci">−</button>
                <button type="button" data-viewer="in" aria-label="Ingrandisci">+</button>
                <button type="button" data-viewer="close" aria-label="Chiudi">✕</button>
            </div>
            <div class="patient-photo-viewer-bottom">
                <div class="patient-photo-measure" hidden></div>
                ${item ? `
                <form class="patient-photo-viewer-note" autocomplete="off">
                    <input type="text" maxlength="120" placeholder="Aggiungi una nota…"
                           value="${escapeAttribute(item.note || "")}" aria-label="Nota della foto">
                    <button type="submit">Salva nota</button>
                </form>` : ""}
            </div>
        `;

        document.body.appendChild(viewer);

        const stage = viewer.querySelector(".patient-photo-viewer-stage");
        const layer = viewer.querySelector(".patient-photo-viewer-layer");
        const img = layer.querySelector("img");
        const svg = viewer.querySelector(".patient-photo-measure-svg");
        const rulerSvg = viewer.querySelector(".patient-photo-ruler-svg");
        const caption = viewer.querySelector(".patient-photo-viewer-caption");
        const panel = viewer.querySelector(".patient-photo-measure");
        const noteForm = viewer.querySelector(".patient-photo-viewer-note");

        /* ----- stato della misura ----- */

        let zoom = null;
        let ruler = null;

        const measurer = createMeasurer({
            item,
            root: viewer,
            layer,
            img,
            svg,
            panel,
            getZoomScale: () => zoom ? zoom.getScale() : 1,
            getRuler: () => ruler,
            onChange: () => updateCaption(),
            onModeChange: on => viewer.querySelector('[data-viewer="measure"]')?.classList.toggle("active", on)
        });

        const mmPerPx = () => {
            const m = measurer.getMeasure();
            return m.ref ? m.refMm / Math.hypot(m.ref[0][0] - m.ref[1][0], m.ref[0][1] - m.ref[1][1]) : 0;
        };

        const captionText = () => {
            const summary = measureSummary(measurer.getMeasure());
            return date +
                (item?.note ? " · " + item.note : "") +
                (summary ? " · " + summary : "");
        };

        const updateCaption = () => { caption.textContent = captionText(); };

        const draw = () => measurer.draw();
        const setMeasuring = on => measurer.setMeasuring(on);

        /* ----- nota ----- */

        noteForm?.addEventListener("submit", async event => {
            event.preventDefault();
            const input = noteForm.querySelector("input");
            input.blur();

            try {
                const saved = await photos.updateNote(item.id, input.value);
                item.note = saved;
                input.value = saved;
                updateCaption();
                showMessage(saved ? "Nota salvata." : "Nota rimossa.");
            } catch (error) {
                console.error("Errore salvataggio nota:", error);
                showMessage("Impossibile salvare la nota.");
            }
        });

        /* ----- zoom e chiusura ----- */

        const fit = () => {
            const naturalW = img.naturalWidth || 1;
            const naturalH = img.naturalHeight || 1;
            const box = stage.getBoundingClientRect();
            const factor = Math.min(box.width / naturalW, box.height / naturalH);

            layer.style.width = Math.round(naturalW * factor) + "px";
            layer.style.height = Math.round(naturalH * factor) + "px";
            draw();
        };

        const close = () => {
            if (measurer.isDirty() && !window.confirm("La misura non è stata salvata. Chiudere senza salvare?")) return;

            document.removeEventListener("keydown", onKey);
            window.removeEventListener("resize", fit);
            if (window.history.state?.patientPhotoViewer) {
                window.history.back();
                return;
            }
            viewer.remove();
        };
        viewer.closeViewer = () => {
            document.removeEventListener("keydown", onKey);
            window.removeEventListener("resize", fit);
            viewer.remove();
        };

        const onKey = event => {
            if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) {
                if (event.key === "Escape") event.target.blur();
                return;
            }
            if (event.key === "Escape") close();
            if (event.key === "+" || event.key === "=") zoom.zoomBy(1.5);
            if (event.key === "-") zoom.zoomBy(1 / 1.5);
        };

        zoom = attachZoom(stage, layer, {
            onBackgroundTap: () => { if (!measurer.isMeasuring()) close(); },
            onTap: measurer.onTap,
            // In modalità misura il doppio tocco non ingrandisce: ogni tocco è un punto.
            doubleTap: () => !measurer.isPlacing(),
            onChange: () => draw()
        });

        ruler = createRuler({
            svg: rulerSvg,
            layer,
            img,
            state: rulerState,
            getMmPerPx: mmPerPx,
            getZoomScale: () => zoom.getScale(),
            // Mentre si segnano i punti di una misura il righello lascia passare i tocchi.
            isInteractive: () => !measurer.isPlacing(),
            onDraw: () => {
                const home = viewer.querySelector("[data-viewer=home]");
                if (home) home.classList.toggle("attention", ruler.isVisible() && ruler.isOutside());
            }
        });

        document.addEventListener("keydown", onKey);
        window.addEventListener("resize", fit);
        img.addEventListener("load", fit);
        if (img.complete) fit();

        viewer.querySelector(".patient-photo-viewer-top").addEventListener("click", async event => {
            const action = event.target.closest("[data-viewer]")?.dataset.viewer;

            if (action === "delete" && item) {
                if (await confirmAndDeletePhoto(item.id)) {
                    measurer.discard();
                    close();
                }
                return;
            }

            if (action === "close") close();
            if (action === "in") zoom.zoomBy(1.5);
            if (action === "out") zoom.zoomBy(1 / 1.5);
            if (action === "measure") setMeasuring(!measurer.isMeasuring());

            if (action === "home") ruler.bringInside();

            if (action === "ruler") {
                ruler.setVisible(!ruler.isVisible());
                event.target.closest("[data-viewer]").classList.toggle("active", ruler.isVisible());
            }
        });

        updateCaption();
        draw();
    };

    addButton.addEventListener("click", openAddModal);

    gallery.addEventListener("click", async event => {
        const deleteButton = event.target.closest("[data-photo-delete]");

        if (deleteButton) {
            await confirmAndDeletePhoto(deleteButton.dataset.photoDelete);
            return;
        }

        const image = event.target.closest("[data-photo-view]");

        if (image && compareMode) {
            toggleSelection(image.dataset.photoView);
            return;
        }

        if (image) {
            openPhotoViewer(image.src, itemsById.get(image.dataset.photoView));
        }
    });

    renderGallery();
    refreshStorage();
}

function renderPatientsPage(selectedPatientId = "", editMode = false, newPatientMode = false) {
    const patients = applyPatientOrder(getPatients());
    const selectedPatient =
        patients.find(patient => patient.id === selectedPatientId) || null;

    content.innerHTML = `
        <section class="detail-page patients-page">
            ${selectedPatient ? "" : newPatientMode ? "" : `
                <button id="newPatientButton" class="settings-action patient-new-button" type="button">
                    ➕ Nuovo paziente
                </button>

                <div class="patient-privacy-warning">
                    <strong>⚠️ Dati sensibili</strong>
                    <p>
                        I dati paziente restano salvati localmente sul dispositivo
                        e vengono condivisi solo se scegli esplicitamente di
                        includerli nella condivisione dell'intera personalizzazione.
                    </p>
                </div>

                <div class="patients-list">
                    ${patients.length
                        ? patients.map((patient, index) => `
                            <div class="patient-card-row">
                                <button
                                    class="patient-card patient-card-name"
                                    type="button"
                                    data-patient-open="${escapeAttribute(patient.id)}"
                                    data-patient-id="${escapeAttribute(patient.id)}"
                                    data-patient-name="${escapeAttribute(patient.name || "Paziente senza nome")}"
                                >
                                    <strong>${renderNoteText(patient.name || "Paziente senza nome")}</strong>
                                    ${patient.diabetic ? '<span class="patient-diabetic-marker" title="Paziente diabetico" aria-label="Paziente diabetico"></span>' : ""}
                                    
                                </button>
                                ${isOrderEditMode() ? `
                                    ${createOrderControls(index, patients.length, "paziente").outerHTML}
                                ` : ""}
                            </div>
                        `).join("")
                        : '<div class="personal-note-empty">Nessun paziente inserito.</div>'
                    }
                </div>
            `}

            ${selectedPatient ? `
                <div class="patient-editor" data-selected-id="${escapeAttribute(selectedPatient.id)}">
                    <div class="detail-header-row">
                        <h3>👤 ${renderNoteText(selectedPatient.name || "Paziente senza nome")}</h3>
                    </div>

                    ${editMode ? `
                        <p class="personal-notes-context">✏️ Modalità modifica attiva</p>

                        <input id="patientName" class="personal-note-title-input" type="text"
                            autocomplete="off"
                            placeholder="Nominativo"
                            value="${escapeAttribute(selectedPatient.name)}">

                        <div class="patient-fields-grid">
                            <input id="patientBirthDate" class="personal-note-title-input" type="date"
                                value="${escapeAttribute(selectedPatient.birthDate)}">
                            <input id="patientAge" class="personal-note-title-input" type="text"
                                placeholder="Età" readonly
                                value="${escapeAttribute(calculatePatientAge(selectedPatient.birthDate))}">
                            <input id="patientRoom" class="personal-note-title-input" type="text"
                                autocomplete="off"
                                placeholder="Reparto"
                                value="${escapeAttribute(selectedPatient.room)}">
                            <input id="patientBed" class="personal-note-title-input" type="text"
                                autocomplete="off"
                                placeholder="Stanza / letto"
                                value="${escapeAttribute(selectedPatient.bed)}">
                        </div>

                        <textarea id="patientPathologies" class="personal-note-input" placeholder="Patologie" rows="3">${escapeHtml(selectedPatient.pathologies)}</textarea>
                        <textarea id="patientAdmissionReason" class="personal-note-input" placeholder="Motivo di ricovero" rows="3">${escapeHtml(selectedPatient.admissionReason)}</textarea>
                        <textarea id="patientAllergies" class="personal-note-input" placeholder="Allergie" rows="3">${escapeHtml(selectedPatient.allergies)}</textarea>

                        <div class="patient-diabetic-field">
                            <span class="patient-diabetic-label">Pz. diabetico:</span>
                            <input id="patientDiabetic" type="checkbox" ${selectedPatient.diabetic ? "checked" : ""} hidden>
                            <button type="button" class="patient-diabetic-choice ${selectedPatient.diabetic ? "is-active" : ""}" data-diabetic-choice="yes">Sì</button>
                            <button type="button" class="patient-diabetic-choice ${!selectedPatient.diabetic ? "is-active" : ""}" data-diabetic-choice="no">No</button>
                        </div>

                        <textarea id="patientMedications" class="personal-note-input" placeholder="Farmaci" rows="4">${escapeHtml(selectedPatient.medications)}</textarea>
                        <textarea id="patientNotes" class="personal-note-input" placeholder="Note varie" rows="4">${escapeHtml(selectedPatient.notes)}</textarea>

                        <div class="patient-pv-section">
                            <h4>🩺 Parametri vitali</h4>
                            <div class="patient-pv-history">${renderPatientPvHistory(selectedPatient.pvHistory, selectedPatient.id)}</div>
                            <button id="openPvRecorder" class="settings-action" type="button"
                                data-patient-id="${escapeAttribute(selectedPatient.id)}">➕ Nuova rilevazione PV</button>
                        </div>

                        <button id="savePatient" class="settings-action" type="button"
                            data-editing-id="${escapeAttribute(selectedPatient.id)}">
                            💾 Salva modifiche
                        </button>
                        <button id="cancelPatientEdit" class="settings-action" type="button">
                            ↩️ Annulla modifiche
                        </button>
                        <p id="patientMessage" class="personal-note-message"></p>
                    ` : `
                        ${renderPatientField("Data di nascita", selectedPatient.birthDate)}
                        ${renderPatientField("Età", calculatePatientAge(selectedPatient.birthDate))}
                        ${renderPatientField("Reparto", selectedPatient.room)}
                        ${renderPatientField("Stanza / letto", selectedPatient.bed)}
                        ${renderPatientField("Patologie", selectedPatient.pathologies)}
                        ${renderPatientField("Motivo di ricovero", selectedPatient.admissionReason)}
                        ${renderPatientField("Allergie", selectedPatient.allergies)}
                        ${renderPatientField("Pz. diabetico", selectedPatient.diabetic ? "Sì" : "No")}
                        ${renderPatientField("Farmaci", selectedPatient.medications)}
                        ${renderPatientTherapyCheck(selectedPatient)}
                        ${renderPatientField("Note", selectedPatient.notes)}

                        <div class="patient-pv-section">
                            <h4>🩺 Parametri vitali</h4>
                            <div class="patient-pv-history">${renderPatientPvHistory(selectedPatient.pvHistory, selectedPatient.id)}</div>
                            <button id="openPvRecorder" class="settings-action" type="button"
                                data-patient-id="${escapeAttribute(selectedPatient.id)}">➕ Nuova rilevazione PV</button>
                        </div>

                        <div class="patient-evolution-section">
                            <div class="patient-evolution-row">
                                <div>
                                    <strong>📷 Evoluzione medicazione</strong>
                                    <small>Foto della medicazione salvate sul dispositivo.</small>
                                </div>
                                <button id="openPatientPhotos" class="settings-action" type="button"
                                    data-patient-id="${escapeAttribute(selectedPatient.id)}">
                                    📷 Apri
                                </button>
                            </div>
                            <div class="patient-photo-privacy-warning compact">
                                <strong>⚠️ Privacy</strong>
                                <span>Chiedi il consenso prima della foto e non inquadrare dati o elementi identificativi non necessari.</span>
                            </div>
                        </div>

                        <button id="editCurrentPatient" class="settings-action" type="button">
                            ✏️ Modifica scheda
                        </button>
                        <button id="deleteCurrentPatient" class="settings-action settings-danger" type="button">
                            🗑️ Elimina paziente
                        </button>
                    `}
                </div>
            ` : newPatientMode ? `
                <div class="patient-editor patient-new-editor">
                    <div class="detail-header-row">
                        <h3>➕ Nuovo paziente</h3>
                    </div>

                    <input id="patientName" class="personal-note-title-input" type="text"
                        placeholder="Nominativo">

                    <div class="patient-fields-grid">
                        <input id="patientBirthDate" class="personal-note-title-input" type="date">
                        <input id="patientAge" class="personal-note-title-input" type="text"
                            placeholder="Età" readonly>
                        <input id="patientRoom" class="personal-note-title-input" type="text"
                            placeholder="Reparto">
                        <input id="patientBed" class="personal-note-title-input" type="text"
                            placeholder="Stanza / letto">
                    </div>

                    <textarea id="patientPathologies" class="personal-note-input" placeholder="Patologie" rows="3"></textarea>
                    <textarea id="patientAdmissionReason" class="personal-note-input" placeholder="Motivo di ricovero" rows="3"></textarea>
                    <textarea id="patientAllergies" class="personal-note-input" placeholder="Allergie" rows="3"></textarea>

                    <div class="patient-diabetic-field">
                        <span class="patient-diabetic-label">Pz. diabetico:</span>
                        <input id="patientDiabetic" type="checkbox" hidden>
                        <button type="button" class="patient-diabetic-choice is-active" data-diabetic-choice="no">No</button>
                        <button type="button" class="patient-diabetic-choice" data-diabetic-choice="yes">Sì</button>
                    </div>

                    <textarea id="patientMedications" class="personal-note-input" placeholder="Farmaci" rows="4"></textarea>
                    <textarea id="patientNotes" class="personal-note-input" placeholder="Note varie" rows="4"></textarea>

                    <div class="patient-pv-section">
                        <h4>🩺 Parametri vitali</h4>
                        <button id="openNewPatientPvRecorder" class="settings-action" type="button">
                            ➕ Inserisci PV
                        </button>
                        <p id="newPatientPvMessage" class="personal-notes-context">
                            Nessuna rilevazione iniziale.
                        </p>
                    </div>

                    <button id="savePatient" class="settings-action" type="button">💾 Salva paziente</button>
                    <button id="cancelNewPatient" class="settings-action" type="button">↩️ Annulla</button>
                    <p id="patientMessage" class="personal-note-message"></p>
                </div>
            ` : ""}
        </section>
    `;

    const birthInput = document.getElementById("patientBirthDate");
    const ageInput = document.getElementById("patientAge");

    birthInput?.addEventListener("change", () => {
        if (ageInput) {
            ageInput.value = calculatePatientAge(birthInput.value);
        }
    });

    setupPatientOrderControls();
    refreshOrderControls();

    if (selectedPatient && !editMode && !newPatientMode) {
        initPatientTherapyCheck(selectedPatient);
    }

    const newPatientButton = document.getElementById("newPatientButton");
    newPatientButton?.addEventListener("click", () => {
        window.__newPatientPvDraft = [];
        renderPatientsPage("", false, true);
    });
}

/* =========================================================
   CONTROLLO DELLA TERAPIA DEL PAZIENTE
   Allergie collegate alle classi di farmaci e interazioni
   tra i farmaci in terapia (js/terapia-paziente.js).
========================================================= */

function renderPatientTherapyCheck(patient) {
    if (!String(patient?.medications || "").trim()) return "";

    return `
        <div class="patient-therapy-check" id="patientTherapyCheck">
            <h4>💊 Controllo della terapia</h4>
            <div id="patientAllergyAlerts" class="patient-therapy-box">Controllo allergie in corso…</div>
            <button id="patientCheckInteractions" class="settings-action" type="button">
                ⚡ Controlla le interazioni tra i farmaci
            </button>
            <div id="patientInteractionResult"></div>
        </div>
    `;
}

let therapyAliasIndexPromise = null;

function loadTherapyAliasIndex() {
    if (!therapyAliasIndexPromise) {
        therapyAliasIndexPromise = fetch("./data/alias-farmaci.json")
            .then(response => response.ok ? response.json() : null)
            .then(data => window.NursingTerapia.creaIndiceAlias(data))
            .catch(() => new Map());
    }
    return therapyAliasIndexPromise;
}

function renderPatientAllergyAlerts(result, patient) {
    const hasAllergies = String(patient.allergies || "").trim();

    if (!hasAllergies) {
        return `<p class="patient-therapy-note">Nessuna allergia registrata nella scheda: il controllo allergie non è stato eseguito. Verifica sempre l'anamnesi allergica.</p>`;
    }

    const alerts = result.avvisi.map(alert => `
        <li class="patient-therapy-alert patient-therapy-alert-${alert.tipo}">
            <strong>${escapeHtml(alert.farmaco)}</strong>
            <span>Allergia registrata: <em>${escapeHtml(alert.allergia)}</em></span>
            <small>${alert.tipo === "stesso"
                ? "Stesso principio attivo dell'allergia dichiarata."
                : `Stessa classe (${escapeHtml(alert.gruppo)}): possibile reattività crociata, da valutare con il medico.`}</small>
        </li>`).join("");

    const header = result.avvisi.length
        ? `<p class="patient-therapy-title patient-therapy-title-alert">⛔ ${result.avvisi.length} possibil${result.avvisi.length === 1 ? "e conflitto" : "i conflitti"} tra allergie e terapia</p><ul class="patient-therapy-list">${alerts}</ul>`
        : `<p class="patient-therapy-title">✓ Nessun collegamento trovato tra le allergie registrate e i farmaci in terapia</p>`;

    const notLinked = result.nonCollegate.length
        ? `<p class="patient-therapy-note">Voci di allergia non confrontate con i farmaci (non sono classi o principi attivi noti all'app): ${result.nonCollegate.map(escapeHtml).join(", ")}.</p>`
        : "";

    return `${header}${notLinked}
        <p class="patient-therapy-note">Controllo indicativo, basato sul testo scritto nei campi Allergie e Farmaci: non sostituisce l'anamnesi allergica né la valutazione del medico. L'assenza di avvisi non garantisce che la terapia sia sicura.</p>`;
}

function renderPatientInteractionResult(NI, idx, result) {
    const summary = `
        <p class="patient-therapy-title">${result.coppie.length
            ? `⚠️ ${result.coppie.length} associazion${result.coppie.length === 1 ? "e" : "i"} con segnalazioni su ${result.nCoppie} controllate`
            : `✓ Nessuna segnalazione tra i ${result.riconosciuti.length} farmaci riconosciuti`}</p>
        <p class="patient-therapy-note">Farmaci riconosciuti: ${result.riconosciuti.length
            ? result.riconosciuti.map(escapeHtml).join(", ")
            : "nessuno"}.</p>`;

    const pairs = result.coppie.map(pair => `
        <details class="patient-therapy-pair patient-therapy-pair-${pair.categoria}" ${pair.categoria === "rischio" ? "open" : ""}>
            <summary>
                <span class="ddi-badge">${escapeHtml(DDI_BADGE[pair.categoria] || "Possibile")}</span>
                ${escapeHtml(pair.nomeA)} + ${escapeHtml(pair.nomeB)}
            </summary>
            ${ddiRenderRiepilogo(NI, idx, pair.a, pair.b, pair.curate, pair.esito)}
            ${ddiRenderCurate(pair.curate)}
            ${pair.esito.esito === "nessuna" ? "" : ddiRenderEsito(NI, idx, pair.a, pair.b, pair.esito, pair.curate.length > 0)}
        </details>`).join("");

    const unknown = result.nonRiconosciuti.length
        ? `<div class="patient-therapy-box">
            <p class="patient-therapy-title">Non controllati: nome non riconosciuto</p>
            <ul class="patient-therapy-list">${result.nonRiconosciuti.map(item => `
                <li><strong>${escapeHtml(item.voce)}</strong>${item.suggerimenti.length
                    ? `<small>Forse intendevi: ${item.suggerimenti.map(escapeHtml).join(", ")}. Correggi il nome nella scheda e ripeti il controllo.</small>`
                    : `<small>Controlla l'ortografia o usa il principio attivo; puoi verificare la coppia a mano nella sezione Interazioni.</small>`}</li>`).join("")}</ul>
        </div>`
        : "";

    return `${summary}${pairs}${unknown}
        <p class="patient-therapy-note"><strong>L'assenza di una segnalazione non vuol dire che l'associazione sia sicura.</strong> Il database è incompleto e non riguarda la compatibilità fisico-chimica in infusione. Controlla sempre RCP, protocollo di reparto o farmacista.</p>`;
}

async function initPatientTherapyCheck(patient) {
    const alertsBox = document.getElementById("patientAllergyAlerts");
    const button = document.getElementById("patientCheckInteractions");
    const resultBox = document.getElementById("patientInteractionResult");
    if (!alertsBox || !button || !resultBox) return;

    const TP = window.NursingTerapia;
    const NI = window.NursingInterazioni;
    if (!TP) {
        alertsBox.textContent = "Controllo della terapia non disponibile.";
        button.disabled = true;
        return;
    }

    try {
        const [alias, aifaList] = await Promise.all([
            loadTherapyAliasIndex(),
            loadDrugActiveIngredientIndex().catch(() => [])
        ]);
        if (!document.body.contains(alertsBox)) return;

        const result = TP.controllaAllergie({
            allergie: patient.allergies,
            farmaci: patient.medications,
            alias,
            aifa: TP.creaIndiceAifa(aifaList)
        });
        alertsBox.innerHTML = renderPatientAllergyAlerts(result, patient);
    } catch (error) {
        console.error("Controllo allergie non riuscito:", error);
        alertsBox.textContent = "Controllo allergie non riuscito.";
    }

    if (!NI) {
        button.disabled = true;
        resultBox.textContent = "Modulo interazioni non caricato.";
        return;
    }

    button.addEventListener("click", async () => {
        button.disabled = true;
        resultBox.innerHTML = `<p class="patient-therapy-note">Caricamento dell'archivio interazioni…</p>`;

        try {
            const idx = await NI.carica({
                onStato: message => {
                    if (document.body.contains(resultBox)) {
                        resultBox.innerHTML = `<p class="patient-therapy-note">${escapeHtml(message)}</p>`;
                    }
                }
            });
            if (!document.body.contains(resultBox)) return;
            resultBox.innerHTML = renderPatientInteractionResult(NI, idx, TP.controllaInterazioni(NI, idx, patient.medications));
        } catch (error) {
            console.error("Controllo interazioni non riuscito:", error);
            if (document.body.contains(resultBox)) {
                resultBox.innerHTML = `<p class="patient-therapy-note">Archivio interazioni non disponibile: ${escapeHtml(error?.message || String(error))}</p>`;
            }
        } finally {
            button.disabled = false;
        }
    });
}

function setupPatients() {
    document.addEventListener("click", event => {
        const diabeticButton = event.target.closest("[data-diabetic-choice]");
        if (diabeticButton) {
            const value = diabeticButton.dataset.diabeticChoice === "yes";
            const input = document.getElementById("patientDiabetic");
            if (input) input.checked = value;

            document.querySelectorAll("[data-diabetic-choice]").forEach(button => {
                button.classList.toggle(
                    "is-active",
                    button.dataset.diabeticChoice === (value ? "yes" : "no")
                );
            });
            return;
        }
    });

    document.addEventListener("click", event => {
        const suggestion = event.target.closest("[data-patient-suggestion]");
        if (!suggestion) return;

        const patientId = suggestion.dataset.patientSuggestion || "";
        if (!patientId) return;

        const url = new URL(window.location.href);
        url.searchParams.set("patients", "1");
        url.searchParams.set("patient", patientId);
        window.location.href = url.toString();
    });

    document.addEventListener("click", async event => {
        if (event.target.closest("#openNewPatientPvRecorder")) {
            const modal = document.createElement("div");
            modal.className = "patient-pv-modal";
            modal.dataset.newPatient = "1";
            modal.innerHTML = `
                <div class="patient-pv-modal-card">
                    <h3>🩺 Nuova rilevazione PV</h3>
                    <div class="patient-pv-input-form">
                        <input id="patientPa" autocomplete="off" class="personal-note-title-input" type="text" inputmode="numeric" placeholder="P.A. mm/Mh">
                        <input id="patientFc" autocomplete="off" class="personal-note-title-input" type="text" inputmode="numeric" placeholder="F.C. bpm">
                        <input id="patientSat" autocomplete="off" class="personal-note-title-input" type="text" inputmode="numeric" placeholder="Sat. %">
                        <input id="patientTemperature" autocomplete="off" class="personal-note-title-input" type="text" inputmode="numeric" placeholder="T.° °C">
                        <input id="patientGlucose" autocomplete="off" class="personal-note-title-input" type="text" inputmode="numeric" placeholder="Glicemia mg/dL">
                    </div>
                    <button id="addNewPatientPv" class="settings-action" type="button">💾 Registra PV</button>
                    <button id="closePvRecorder" class="settings-action" type="button">Annulla</button>
                </div>
            `;
            document.body.appendChild(modal);
            setupPvInputFormatting(modal);
            return;
        }

        if (event.target.closest("#addNewPatientPv")) {
            const modal = event.target.closest(".patient-pv-modal");
            const pa = document.getElementById("patientPa")?.value.trim() || "";
            const fc = document.getElementById("patientFc")?.value.trim() || "";
            const sat = document.getElementById("patientSat")?.value.trim() || "";
            const temperature = document.getElementById("patientTemperature")?.value.trim() || "";
            const glucose = document.getElementById("patientGlucose")?.value.trim() || "";

            if (!pa && !fc  && !sat && !temperature  && !glucose) {
                window.alert("Inserisci almeno un parametro vitale.");
                return;
            }

            window.__newPatientPvDraft = Array.isArray(window.__newPatientPvDraft)
                ? window.__newPatientPvDraft
                : [];

            window.__newPatientPvDraft.push({
                id: String(Date.now()) + "-" + Math.random().toString(36).slice(2, 8),
                recordedAt: new Date().toISOString(),
                pa, fc, sat, temperature, glucose
            });

            modal.remove();

            const message = document.getElementById("newPatientPvMessage");
            if (message) {
                const count = window.__newPatientPvDraft.length;
                message.textContent = `${count} rilevazione iniziale pronta per il salvataggio.`;
            }
            return;
        }

        if (event.target.closest("#cancelNewPatient")) {
            renderPatientsPage();
            return;
        }

        const openButton = event.target.closest("[data-patient-open]");
        if (openButton) {
            const patientId = openButton.dataset.patientOpen || "";
            if (!patientId) return;

            const url = new URL(window.location.href);
            url.searchParams.set("patients", "1");
            url.searchParams.set("patient", patientId);
            window.location.href = url.toString();
            return;
        }

        if (event.target.closest("#openPatientPhotos")) {
            const patientId = event.target.closest("#openPatientPhotos")?.dataset.patientId || "";
            if (!patientId) return;

            const url = new URL(window.location.href);
            url.searchParams.set("patients", "1");
            url.searchParams.set("patient", patientId);
            url.searchParams.set("patientPhotos", "1");
            window.location.href = url.toString();
            return;
        }

        if (event.target.closest("#editCurrentPatient")) {
            const id = document.querySelector(".patient-editor")?.dataset.selectedId || "";
            renderPatientsPage(id, true);
            return;
        }

        if (event.target.closest("#cancelPatientEdit")) {
            const id = document.querySelector(".patient-editor")?.dataset.selectedId || "";
            renderPatientsPage(id, false);
            return;
        }

        if (event.target.closest(".patient-pv-edit")) {
            const button = event.target.closest(".patient-pv-edit");
            const patientId = button.dataset.patientId || "";
            const index = Number(button.dataset.pvIndex);
            const patient = getPatients().find(current => current.id === patientId);
            const entry = patient?.pvHistory?.[index];
            if (!patient || !entry) return;

            const modal = document.createElement("div");
            modal.className = "patient-pv-modal";
            modal.dataset.patientId = patientId;
            modal.dataset.pvIndex = String(index);
            modal.innerHTML = `
                <div class="patient-pv-modal-card">
                    <h3>✏️ Modifica rilevazione PV</h3>
                    <div class="patient-pv-input-form">
                        <input id="patientPa" class="personal-note-title-input" type="text" inputmode="numeric" value="${escapeAttribute(entry.pa || "")}" placeholder="P.A. mm/Mh">
                        <input id="patientFc" class="personal-note-title-input" type="text" inputmode="numeric" value="${escapeAttribute(entry.fc || "")}" placeholder="F.C. bpm">
                        <input id="patientSat" class="personal-note-title-input" type="text" inputmode="numeric" value="${escapeAttribute(entry.sat || "")}" placeholder="Sat. %">
                        <input id="patientTemperature" class="personal-note-title-input" type="text" inputmode="numeric" value="${escapeAttribute(entry.temperature || "")}" placeholder="T.° °C">
                        <input id="patientGlucose" class="personal-note-title-input" type="text" inputmode="numeric" value="${escapeAttribute(entry.glucose || "")}" placeholder="Glicemia mg/dL">
                    </div>
                    <button id="savePatientPv" class="settings-action" type="button">💾 Salva rilevazione</button>
                    <button id="closePvRecorder" class="settings-action" type="button">Annulla</button>
                </div>
            `;
            document.body.appendChild(modal);
            setupPvInputFormatting(modal);
            return;
        }

        if (event.target.closest(".patient-pv-delete")) {
            const button = event.target.closest(".patient-pv-delete");
            const patientId = button.dataset.patientId || "";
            const index = Number(button.dataset.pvIndex);
            if (!window.confirm("Eliminare questa rilevazione dei parametri vitali?")) return;

            const patients = getPatients();
            const patient = patients.find(current => current.id === patientId);
            if (!patient || !patient.pvHistory[index]) return;

            patient.pvHistory.splice(index, 1);
            savePatients(patients);
            renderPatientsPage(patientId, false);
            return;
        }

        if (event.target.closest("#openPvRecorder")) {
            const id = event.target.closest("#openPvRecorder")?.dataset.patientId || "";
            if (!id) return;

            const modal = document.createElement("div");
            modal.className = "patient-pv-modal";
            modal.dataset.patientId = id;
            modal.innerHTML = `
                <div class="patient-pv-modal-card">
                    <h3>🩺 Nuova rilevazione PV</h3>
                    <div class="patient-pv-input-form">
                        <input id="patientPa" class="personal-note-title-input" type="text" inputmode="numeric" placeholder="P.A. mm/Mh">
                        <input id="patientFc" class="personal-note-title-input" type="text" inputmode="numeric" placeholder="F.C. bpm">                        
                        <input id="patientSat" class="personal-note-title-input" type="text" inputmode="numeric" placeholder="Sat. %">
                        <input id="patientTemperature" class="personal-note-title-input" type="text" inputmode="numeric" placeholder="T.° °C">
                        <input id="patientGlucose" class="personal-note-title-input" type="text" inputmode="numeric" placeholder="Glicemia mg/dL">
                    </div>
                    <button id="addPatientPv" class="settings-action" type="button">💾 Registra PV</button>
                    <button id="closePvRecorder" class="settings-action" type="button">Annulla</button>
                </div>
            `;
            document.body.appendChild(modal);
            setupPvInputFormatting(modal);
            return;
        }

        if (event.target.closest("#closePvRecorder")) {
            event.target.closest(".patient-pv-modal")?.remove();
            return;
        }

        if (event.target.closest("#savePatientPv")) {
            const modal = event.target.closest(".patient-pv-modal");
            const patientId = modal?.dataset.patientId || "";
            const index = Number(modal?.dataset.pvIndex);
            const patients = getPatients();
            const patient = patients.find(current => current.id === patientId);
            if (!patient || !patient.pvHistory[index]) return;

            const pa = document.getElementById("patientPa")?.value.trim() || "";
            const fc = document.getElementById("patientFc")?.value.trim() || "";
            const sat = document.getElementById("patientSat")?.value.trim() || "";
            const temperature = document.getElementById("patientTemperature")?.value.trim() || "";
            const glucose = document.getElementById("patientGlucose")?.value.trim() || "";

            if (!pa && !fc && !glucose && !sat && !temperature) {
                window.alert("Inserisci almeno un parametro vitale.");
                return;
            }

            patient.pvHistory[index] = {
                ...patient.pvHistory[index],
                pa, fc, glucose, sat, temperature
            };

            savePatients(patients);
            modal.remove();
            renderPatientsPage(patientId, false);
            return;
        }

        if (event.target.closest("#addPatientPv")) {
            const editingId = event.target.closest("#addPatientPv")
                ?.closest(".patient-pv-modal")
                ?.dataset.patientId || "";
            if (!editingId) return;

            const pa = document.getElementById("patientPa")?.value.trim() || "";
            const fc = document.getElementById("patientFc")?.value.trim() || "";            
            const sat = document.getElementById("patientSat")?.value.trim() || "";
            const temperature = document.getElementById("patientTemperature")?.value.trim() || "";
            const glucose = document.getElementById("patientGlucose")?.value.trim() || "";

            if (!pa && !fc && !glucose && !sat && !temperature) {
                window.alert("Inserisci almeno un parametro vitale.");
                return;
            }

            const patients = getPatients();
            const patient = patients.find(current => current.id === editingId);
            if (!patient) return;

            patient.pvHistory.push({
                id: String(Date.now()) + "-" + Math.random().toString(36).slice(2, 8),
                recordedAt: new Date().toISOString(),
                pa, fc, glucose, sat, temperature
            });

            savePatients(patients);
            document.querySelector(".patient-pv-modal")?.remove();
            renderPatientsPage(editingId, false);
            return;
        }

        if (event.target.closest("#savePatient")) {
            const saveButton = event.target.closest("#savePatient");
            const name = document.getElementById("patientName")?.value.trim() || "";

            if (!name) {
                const message = document.getElementById("patientMessage");
                if (message) message.textContent = "✏️ Inserisci almeno un nominativo.";
                return;
            }

            const patients = getPatients();
            const editingId = saveButton.dataset.editingId || "";
            const birthDate = document.getElementById("patientBirthDate")?.value || "";

            const patientData = {
                name,
                birthDate,
                age: calculatePatientAge(birthDate),
                room: document.getElementById("patientRoom")?.value.trim() || "",
                bed: document.getElementById("patientBed")?.value.trim() || "",
                pathologies: document.getElementById("patientPathologies")?.value.trim() || "",
                admissionReason: document.getElementById("patientAdmissionReason")?.value.trim() || "",
                allergies: document.getElementById("patientAllergies")?.value.trim() || "",
                diabetic: document.getElementById("patientDiabetic")?.checked || false,
                medications: document.getElementById("patientMedications")?.value.trim() || "",
                notes: document.getElementById("patientNotes")?.value.trim() || ""
            };

            if (editingId) {
                const patient = patients.find(current => current.id === editingId);
                if (!patient) return;
                Object.assign(patient, patientData);
                savePatients(patients);
                renderPatientsPage(editingId, false);
                return;
            }

            const newPatientPvHistory = Array.isArray(window.__newPatientPvDraft)
                ? window.__newPatientPvDraft
                : [];

            patients.push(normalizePatient({
                id: String(Date.now()) + "-" + Math.random().toString(36).slice(2, 8),
                ...patientData,
                pvHistory: newPatientPvHistory
            }));

            window.__newPatientPvDraft = [];
            savePatients(patients);
            renderPatientsPage();
            return;
        }

        if (event.target.closest("#deleteCurrentPatient")) {
            const id =
                document.querySelector(".patient-editor[data-selected-id]")?.dataset.selectedId || "";

            if (!id) return;

            const patient =
                getPatients().find(current => current.id === id);

            if (!patient) return;

            if (!window.confirm(
                "Eliminare il paziente \"" + (patient.name || "senza nome") + "\" dal dispositivo?"
            )) {
                return;
            }

            savePatients(
                getPatients().filter(current => current.id !== id)
            );

            // Libera lo spazio delle foto del paziente eliminato.
            window.PatientPhotos?.removeAllForPatient(id);
            window.AudioNotes?.removeOwner("patient:" + id);

            renderPatientsPage();
            return;
        }
    });
}

function resetOrderPreferences() {

    const keys = Object.keys(localStorage)
        .filter(key =>
            key === PERSONALIZATION_KEYS.categoryOrder ||
            key.startsWith("nursing-sections-") ||
            key.startsWith("nursing-items-") ||
            key === "nursing-patient-order"
        );

    keys.forEach(key => localStorage.removeItem(key));
}

function resetAllPersonalization() {

    resetOrderPreferences();

    localStorage.removeItem(
        PERSONALIZATION_KEYS.notes
    );

    localStorage.removeItem(
        PERSONALIZATION_KEYS.appNotes
    );

    localStorage.removeItem(
        PERSONALIZATION_KEYS.theme
    );

    localStorage.removeItem(
        PATIENTS_KEY
    );

    window.PatientPhotos?.clearAll();
    window.AudioNotes?.clearAll();

    applyTheme("dark");
    orderEditMode = false;
    document.body.classList.remove("order-editing");
}
