/* =========================================================
   PULIZIA VECCHIA SCHERMATA DI CARICAMENTO
========================================================= */

/* =========================================================
   PARAMETRI URL
========================================================= */

const params = new URLSearchParams(
    window.location.search
);

const state = params.get("state");
const item = params.get("item");
const editor =
    params.get("editor");
const patientRouteId =
    params.get("patient") || "";

const patientPhotosRoute =
    params.get("patientPhotos") || "";

const appNotesRoute =
    params.get("appnotes") || "";

const contactRoute =
    params.get("contact") || "";


/* =========================================================
   ELEMENTI HTML
========================================================= */

const stateTitle =
    document.getElementById("state");

const description =
    document.getElementById("description");

const content =
    document.getElementById("content");

const shortcuts =
    document.getElementById("shortcuts");

const backButton =
    document.getElementById("backButton");


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

            <div id="patientPhotoCompareBar" class="patient-photo-comparebar" hidden>
                <span id="patientPhotoCompareText"></span>
                <button id="patientPhotoCompareGo" type="button" disabled>Confronta</button>
                <button id="patientPhotoCompareCancel" type="button">Annulla</button>
            </div>
        </section>
    `;

    setupPatientPhotosPage(patient);
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

        const pane = (label, item) => `
            <div class="patient-photo-compare-pane">
                <div class="patient-photo-viewer-stage">
                    <div class="patient-photo-viewer-layer">
                        <img src="${escapeAttribute(URL.createObjectURL(item.blob))}" alt="" draggable="false">
                        <svg class="patient-photo-ruler-svg" aria-hidden="true"></svg>
                    </div>
                </div>
                <div class="patient-photo-compare-cap">
                    <strong>${label}</strong> ${escapeHtml(fmt(item))}${item.note ? " · " + escapeHtml(item.note) : ""}${measureSummary(item.measure) ? " · " + escapeHtml(measureSummary(item.measure)) : ""}
                </div>
            </div>`;

        const view = document.createElement("div");
        view.id = "patientPhotoCompareView";
        view.className = "patient-photo-compare";
        view.innerHTML = `
            <div class="patient-photo-compare-top">
                <span>Confronto · distanza ${escapeHtml(formatGap(before.createdAt, after.createdAt))}</span>
                <span class="patient-photo-compare-tools">
                    <button type="button" data-cmp="ruler" class="active" aria-label="Mostra o nascondi i righelli">📐</button>
                    <button type="button" data-cmp="close" aria-label="Chiudi">✕</button>
                </span>
            </div>
            <div class="patient-photo-compare-panes">
                ${pane("Prima", before)}
                ${pane("Dopo", after)}
            </div>
        `;

        document.body.appendChild(view);

        const urls = [...view.querySelectorAll("img")].map(img => img.src);

        // Ogni foto ha il suo righello (posizione, angolo e dimensione indipendenti)
        // e usa la scala della propria calibrazione, se esiste.
        const rulers = [];
        const refits = [];

        view.querySelectorAll(".patient-photo-compare-pane").forEach((el, index) => {
            const item = index === 0 ? before : after;
            const stage = el.querySelector(".patient-photo-viewer-stage");
            const layerEl = el.querySelector(".patient-photo-viewer-layer");
            const image = layerEl.querySelector("img");
            let paneZoom = null;

            const paneRuler = createRuler({
                svg: layerEl.querySelector("svg"),
                layer: layerEl,
                img: image,
                state: { x: null, y: null, r: 0, arm: null },
                getMmPerPx: () => measureScale(item.measure),
                getZoomScale: () => paneZoom ? paneZoom.getScale() : 1
            });

            const fitPane = () => {
                const naturalW = image.naturalWidth || 1;
                const naturalH = image.naturalHeight || 1;
                const box = stage.getBoundingClientRect();
                const factor = Math.min(box.width / naturalW, box.height / naturalH);

                layerEl.style.width = Math.round(naturalW * factor) + "px";
                layerEl.style.height = Math.round(naturalH * factor) + "px";
                paneRuler.draw();
            };

            paneZoom = attachZoom(stage, layerEl, { onChange: () => paneRuler.draw() });

            image.addEventListener("load", fitPane);
            if (image.complete) fitPane();

            rulers.push(paneRuler);
            refits.push(fitPane);
        });

        const onResize = () => refits.forEach(fit => fit());
        window.addEventListener("resize", onResize);

        const close = () => {
            document.removeEventListener("keydown", onKey);
            window.removeEventListener("resize", onResize);
            urls.forEach(url => URL.revokeObjectURL(url));
            view.remove();
            setCompareMode(false);
        };

        const onKey = event => { if (event.key === "Escape") close(); };

        document.addEventListener("keydown", onKey);
        view.querySelector("[data-cmp=close]").addEventListener("click", close);

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
    const createRuler = ({ svg, layer, img, state, getMmPerPx, getZoomScale, isInteractive = () => true }) => {
        let visible = true;
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

            let armPx = Math.min(Math.max(state.arm, minSide * 0.08), minSide * 0.7);
            state.arm = armPx;   // lo stato non resta mai oltre i limiti: rotella e pizzico rispondono subito
            let armCm = 0;

            if (calibrated) {
                const maxCm = Math.max(1, Math.floor(minSide * 0.7 / (10 * pxPerMm)));
                armCm = Math.min(maxCm, Math.max(1, Math.round(armPx / (10 * pxPerMm))));
                armPx = armCm * 10 * pxPerMm;
            }

            const tickPxPerMm = calibrated ? pxPerMm : armPx / 100;      // non calibrato: 10 cm nominali
            const totalMm = calibrated ? armCm * 10 : 100;
            const stripPx = Math.min(Math.max(12 * tickPxPerMm, 22 * unit), armPx * 0.4);

            return { width, height, screenPerImage, unit, calibrated, armPx, tickPxPerMm, totalMm, stripPx };
        };

        const draw = (clampPosition = true) => {
            const g0 = geometry();
            svg.setAttribute("viewBox", "0 0 " + g0.width + " " + g0.height);

            if (!visible) {
                svg.innerHTML = "";
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

            // L'intera "L" resta dentro la foto, a qualunque angolo e dimensione.
            // Durante una rotazione/ridimensionamento col dito il vincolo si rimanda al
            // rilascio, altrimenti il righello verrebbe spinto via da sotto il dito.
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

            draw(mode.type === "move");
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
                draw(true);          // al rilascio la "L" torna entro i bordi della foto
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

        return {
            draw: () => draw(true),
            setVisible: on => { visible = on; draw(true); },
            isVisible: () => visible
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
                ${item ? '<button type="button" data-viewer="ruler" class="active" aria-label="Mostra o nascondi il righello a L">📐</button>' : ""}
                ${item ? '<button type="button" data-viewer="measure" aria-label="Misura">📏</button>' : ""}
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

        const captionText = () => {
            const summary = measureSummary(measure);
            return date +
                (item?.note ? " · " + item.note : "") +
                (summary ? " · " + summary : "");
        };

        const updateCaption = () => { caption.textContent = captionText(); };

        /* ----- disegno dei segni sulla foto ----- */

        const draw = () => {
            const naturalW = img.naturalWidth || 1;
            const naturalH = img.naturalHeight || 1;
            svg.setAttribute("viewBox", "0 0 " + naturalW + " " + naturalH);

            const zoomScale = zoom ? zoom.getScale() : 1;
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
            ruler.draw();
        };



        /* ----- pannello di misura ----- */

        const stepLabel = { ref: "il riferimento", L: "la lunghezza", W: "la larghezza" };

        const renderPanel = () => {
            panel.hidden = !measuring;
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
                    <p>Inquadra la moneta o il righello vicino alla lesione, sullo stesso piano. Poi tocca le due estremità del riferimento (per la moneta, il diametro).</p>
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
            pending = [];
            panelMessage = "";
            step = on ? (measure.ref ? null : "ref") : null;
            viewer.querySelector('[data-viewer="measure"]')?.classList.toggle("active", on);
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
            updateCaption();
        };

        // Tocco sulla foto in modalità misura: lo converte in coordinate dell'immagine.
        const onMeasureTap = (event, onPhoto) => {
            if (!measuring || !step || !onPhoto) return;

            const box = layer.getBoundingClientRect();
            const naturalW = img.naturalWidth || 1;
            const naturalH = img.naturalHeight || 1;

            pending.push([
                Math.round((event.clientX - box.left) / box.width * naturalW * 10) / 10,
                Math.round((event.clientY - box.top) / box.height * naturalH * 10) / 10
            ]);

            panelMessage = "";

            if (pending.length === 2) finishStep();

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
            }

            if (action === "recal") {
                step = "ref";
                pending = [];
                panelMessage = "";
            }

            if (action === "clear") {
                if (!window.confirm("Azzerare riferimento e misure di questa foto?")) return;
                measure = { ref: null, refMm: 0, refKey, lines: {} };
                step = "ref";
                pending = [];
                dirty = true;
                updateCaption();
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

        let zoom = null;

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
            if (dirty && !window.confirm("La misura non è stata salvata. Chiudere senza salvare?")) return;

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
            onBackgroundTap: () => { if (!measuring) close(); },
            onTap: onMeasureTap,
            // In modalità misura il doppio tocco non ingrandisce: ogni tocco è un punto.
            doubleTap: () => !(measuring && step),
            onChange: () => draw()
        });

        const ruler = createRuler({
            svg: rulerSvg,
            layer,
            img,
            state: rulerState,
            getMmPerPx: mmPerPx,
            getZoomScale: () => zoom.getScale(),
            // Mentre si segnano i punti di una misura il righello lascia passare i tocchi.
            isInteractive: () => !(measuring && step)
        });

        document.addEventListener("keydown", onKey);
        window.addEventListener("resize", fit);
        img.addEventListener("load", fit);
        if (img.complete) fit();

        viewer.querySelector(".patient-photo-viewer-top").addEventListener("click", event => {
            const action = event.target.closest("[data-viewer]")?.dataset.viewer;
            if (action === "close") close();
            if (action === "in") zoom.zoomBy(1.5);
            if (action === "out") zoom.zoomBy(1 / 1.5);
            if (action === "measure") setMeasuring(!measuring);

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
            if (!window.confirm("Eliminare questa foto dal dispositivo?")) return;

            try {
                await photos.deletePhoto(deleteButton.dataset.photoDelete);
                showMessage("Foto eliminata.");
            } catch (error) {
                console.error("Errore eliminazione foto:", error);
                showMessage("Impossibile eliminare la foto.");
            }

            await renderGallery();
            await refreshStorage();
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

    const newPatientButton = document.getElementById("newPatientButton");
    newPatientButton?.addEventListener("click", () => {
        window.__newPatientPvDraft = [];
        renderPatientsPage("", false, true);
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

    applyTheme("dark");
    orderEditMode = false;
    document.body.classList.remove("order-editing");
}



/* =========================================================
   NAVIGAZIONE
========================================================= */

if (backButton) {

    backButton.addEventListener("click", () => {

        const photoViewer = document.getElementById("patientPhotoViewer");
        if (photoViewer) {
            photoViewer.querySelector('[data-viewer="close"]')?.click();
            return;
        }

        if (patientPhotosRoute === "1") {
            const url = new URL(window.location.href);
            url.searchParams.delete("patientPhotos");
            window.history.pushState({}, "", url);
            renderPatientsPage(patientRouteId, false);
            return;
        }

        if (patientsRoute === "1") {
            const currentPatient =
                document.querySelector(".patient-editor[data-selected-id]");

            if (currentPatient) {
                const url = new URL(window.location.href);
                url.searchParams.delete("patient");
                window.history.pushState({}, "", url);
                renderPatientsPage();
            } else {
                window.location.href = "./";
            }
            return;
        }

        if (window.history.length > 1) {

            window.history.back();

        } else {

            window.location.href = "./";

        }

    });

}


/* =========================================================
   ID AUTOMATICO
========================================================= */

function createId(text) {

    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

}


/* =========================================================
   CARICA CATEGORIE
========================================================= */

async function loadCategories() {

    try {

        const response =
            await fetch("./data/categories.json");

        if (!response.ok) {

            throw new Error(
                "Categorie non trovate"
            );

        }

        const categories =
            await response.json();

        createShortcuts(categories);

    }

    catch (error) {

        console.error(error);

        shortcuts.innerHTML = `
            <p>
                Impossibile caricare le categorie.
            </p>
        `;

    }

}


/* =========================================================
   CREA SHORTCUT
========================================================= */

function createShortcuts(categories) {

    let savedOrder = null;

    try {
        savedOrder = JSON.parse(
            localStorage.getItem("nursing-category-order") || "null"
        );
    } catch (_) {
        localStorage.removeItem("nursing-category-order");
    }

    let orderedCategories = [...categories];

    if (Array.isArray(savedOrder)) {
        orderedCategories.sort((a, b) => {
            const aIndex = savedOrder.indexOf(a.id);
            const bIndex = savedOrder.indexOf(b.id);
            return (
                (aIndex === -1 ? 999 : aIndex) -
                (bIndex === -1 ? 999 : bIndex)
            );
        });
    }

    shortcuts.innerHTML = "";

    orderedCategories.forEach((category, index) => {

        const row = document.createElement("div");
        row.className = "shortcut-row";

        const link = document.createElement("a");
        link.className = "shortcut";
        link.href = category.route === "patients"
            ? "?patients=1"
            : `?state=${encodeURIComponent(category.id)}`;
        link.dataset.categoryId = category.id;

        link.innerHTML = `
            <span class="shortcut-icon">${category.icon || ""}</span>
            <span class="shortcut-text">
                <strong>${category.title}</strong>
                <small>${category.description || ""}</small>
            </span>
        `;

        row.appendChild(link);

        if (isOrderEditMode()) {
            row.appendChild(
                createOrderControls(
                    index,
                    orderedCategories.length,
                    "categoria"
                )
            );
        }

        shortcuts.appendChild(row);
    });

    setupHomeOrderControls();
}


/* =========================================================
   RIORDINO HOME — LONG PRESS + POINTER DRAG
========================================================= */

let draggedShortcut = null;

function setupShortcutDrag(element) {

    element.addEventListener("contextmenu", event => event.preventDefault());

    let timer = null;
    let dragging = false;
    let pointerId = null;
    let startX = 0;
    let startY = 0;

    element.addEventListener("pointerdown", event => {

        if (
            event.pointerType === "mouse" &&
            event.button !== 0
        ) {
            return;
        }

        pointerId = event.pointerId;

        startX = event.clientX;
        startY = event.clientY;

        dragging = false;

        clearTimeout(timer);

        timer = setTimeout(() => {

            dragging = true;
            draggedShortcut = element;

            element.classList.add(
                "shortcut-dragging"
            );

            try {
                element.setPointerCapture(pointerId);
            }
            catch (_) {}

        }, isOrderEditMode() ? 0 : 1000);

    });

    element.addEventListener("pointermove", event => {

        if (event.pointerId !== pointerId) {
            return;
        }

        if (!dragging) {
            if (isOrderEditMode()) {
                dragging = true;
                draggedShortcut = element;
                element.classList.add("shortcut-dragging");
                try { element.setPointerCapture(pointerId); } catch (_) {}
            } else {
                return;
            }
        }

        event.preventDefault();

        const target =
            document
                .elementFromPoint(
                    event.clientX,
                    event.clientY
                )
                ?.closest(".shortcut");

        if (
            !target ||
            target === element ||
            !shortcuts.contains(target)
        ) {
            return;
        }

        const rect =
            target.getBoundingClientRect();

        const after =
            event.clientY >
            rect.top + rect.height / 2;

        if (after) {

            shortcuts.insertBefore(
                element,
                target.nextSibling
            );

        } else {

            shortcuts.insertBefore(
                element,
                target
            );

        }

    });

    const finish = event => {

        if (event.pointerId !== pointerId) {
            return;
        }

        clearTimeout(timer);

        if (dragging) {

            event.preventDefault();

            element.classList.remove(
                "shortcut-dragging"
            );

            dragging = false;
            draggedShortcut = null;

            try {
                element.releasePointerCapture(
                    pointerId
                );
            }
            catch (_) {}

            saveShortcutOrder();

            element.dataset.justDragged = "1";

            setTimeout(() => {
                delete element.dataset.justDragged;
            }, 250);

        }

        pointerId = null;

    };

    element.addEventListener(
        "pointerup",
        finish
    );

    element.addEventListener(
        "pointercancel",
        finish
    );

    element.addEventListener(
        "click",
        event => {

            if (
                element.dataset.justDragged === "1"
            ) {
                event.preventDefault();
                event.stopPropagation();
            }

        },
        true
    );

}


function saveShortcutOrder() {

    const order =
        Array.from(
            shortcuts.querySelectorAll(".shortcut-row .shortcut")
        ).map(
            card => card.dataset.categoryId
        );

    localStorage.setItem(
        "nursing-category-order",
        JSON.stringify(order)
    );

}


/* =========================================================
   CARICA ARCHIVIO
========================================================= */

async function loadState() {

        const linksMode =
        new URLSearchParams(window.location.search).get("links");

    if (appNotesRoute === "1") {
        document.body.classList.remove("home-page");
        shortcuts.style.display = "none";

        if (backButton) {
            backButton.style.display = "flex";
        }

        stateTitle.textContent = "📝 Note";
        description.textContent = "Appunti e idee non legati alle singole sezioni.";
        renderAppNotesPage();
        return;
    }

    if (linksMode === "1") {
        document.body.classList.remove("home-page");
        shortcuts.style.display = "none";

        if (backButton) {
            backButton.style.display = "flex";
        }

        const termFilter =
            new URLSearchParams(window.location.search).get("term") || "";

        stateTitle.textContent = "🔗 Collegamenti";
        description.textContent = "Collegamenti tra tutte le note personali.";
        renderAllNoteLinksPage(termFilter);
        return;
    }

    if (contactRoute === "1") {
        document.body.classList.remove("home-page");
        shortcuts.style.display = "none";

        if (backButton) {
            backButton.style.display = "flex";
        }

        stateTitle.textContent = "📩 Contattami";
        description.textContent = "Per domande, segnalazioni o suggerimenti.";
        renderContactPage();
        return;
    }


    /*
     * HOME
     */

    if (!state) {

        document.body.classList.add("home-page");

        shortcuts.style.display = "flex";

        if (backButton) {
            backButton.style.display = "none";
        }

        stateTitle.textContent =
            "Benvenuto";

        description.textContent =
            "Seleziona un archivio per iniziare.";

        content.innerHTML = "";

        return;
    }


    document.body.classList.remove("home-page");

    /*
     * PAGINA CATEGORIA
     */

    shortcuts.style.display = "none";

    if (backButton) {
        backButton.style.display = "flex";
    }


    try {

        /*
         * Costruiamo esplicitamente il percorso
         * del file JSON.
         */

        const filePath =
            `./data/${state}.json`;


        console.log(
            "Caricamento archivio:",
            filePath
        );


        const response =
            await fetch(filePath);


        /*
         * Controlla se il file esiste davvero.
         */

        if (!response.ok) {

            throw new Error(
                `File non trovato: ${filePath} — HTTP ${response.status}`
            );

        }


        /*
         * Prova a leggere il JSON.
         */

        let data;

        try {

            data =
                await response.json();

        }

        catch (jsonError) {

            throw new Error(
                `Il file "${filePath}" esiste, ma il JSON non è valido.`
            );

        }


        /*
         * Applica eventuali modifiche
         * salvate dall'editor locale.
         */

        data =
            applyLocalOverride(
                state,
                data
            );


        /*
         * Mostra titolo e descrizione.
         */

        stateTitle.textContent =
            `${data.icon || ""} ${data.title || state}`;

        description.textContent =
            data.description || "";


        /*
         * ELEMENTO SPECIFICO
         */

        if (item) {

            loadItem(data);

            return;
        }


        /*
         * PAGINA PRINCIPALE
         */

        renderSections(data);

    }


    catch (error) {

        console.error(
            "ERRORE CARICAMENTO ARCHIVIO:",
            error
        );


        stateTitle.textContent =
            "❌ Errore caricamento";


        description.textContent =
            "";


        content.innerHTML = `

            <section>

                <h2>
                    Archivio non disponibile
                </h2>

                <p>
                    Non è stato possibile caricare
                    l'archivio
                    <strong>${state}</strong>.
                </p>

                <p style="
                    color:#ff7777;
                    font-family:monospace;
                    font-size:13px;
                    word-break:break-word;
                ">
                    ${error.message}
                </p>

                <p style="
                    color:#888;
                    font-size:13px;
                ">
                    Controlla la console del browser
                    (F12 → Console) per maggiori dettagli.
                </p>

            </section>

        `;

    }

}
/* =========================================================
   RENDER SEZIONI
========================================================= */

// =========================================================================
// SISTEMA AUTO-INSTALLANTE PER AUTOCOMPLETAMENTO FARMACI (SENZA DOPPIONI)
// =========================================================================

(function() {
    let listaFarmaciDati = [];

    // Lista di emergenza se il CSV locale non è leggibile dal browser (es. protocollo file:///)
    const farmaciDiBackup = [
        "Acetaminofene", "Acido Acetilsalicilico", "Amoxicillina", "Aspirina", "Atenololo", 
        "Augmentin", "Azitromicina", "Clonazepam", "Codeina", "Diazepam", "Eparina", 
        "Ibuprofene", "Insulina", "Ketoprofene", "Levofloxacina", "Metformina", 
        "Omeprazolo", "Paracetamolo", "Prednisone", "Rifampicina", "Tachipirina", "Warfarin"
    ];

    // 1. Carica i dati dal CSV della repository
    async function caricaDatabase() {
        try {
            const response = await fetch("./src/data/farmaci.csv");
            if (!response.ok) throw new Error();
            const testo = await response.text();
            const righe = testo.split(/\r?\n/);
            
            const nomiGrezzi = righe.map(riga => {
                const colonne = riga.split(/[,;]/);
                return colonne[0]?.trim(); // Prende il nome dalla prima colonna
            }).filter(nome => nome && nome.length > 0);

            // RIMOZIONE DOPPIONI: Utilizza Set per tenere solo i nomi unici
            listaFarmaciDati = [...new Set(nomiGrezzi)];

            if (listaFarmaciDati.length > 0 && ["nome", "farmaco"].includes(listaFarmaciDati[0].toLowerCase())) {
                listaFarmaciDati.shift();
            }
        } catch (e) {
            // Rimuove i doppioni anche dalla lista di backup per sicurezza
            listaFarmaciDati = [...new Set(farmaciDiBackup)];
        }
    }
    caricaDatabase();

    // 2. Osserva la pagina: appena appare un input di ricerca, gli aggancia il datalist
    const observer = new MutationObserver(mutations => {
        // Controlla solo gli input realmente aggiunti al DOM.
        // Evita di riscannerizzare tutta la pagina ad ogni modifica,
        // riducendo lavoro sul main thread e reflow inutili.
        const inputs = [];

        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType !== Node.ELEMENT_NODE) return;

                if (
                    node.matches?.("input[type='text'], input:not([type])")
                ) {
                    inputs.push(node);
                }

                node.querySelectorAll?.(
                    "input[type='text'], input:not([type])"
                ).forEach(input => inputs.push(input));
            });
        });

        if (!inputs.length) return;

        const excludedIds = new Set([
            "patientName",
            "patientBirthDate",
            "patientAge",
            "patientRoom",
            "patientBed",
            "patientPa",
            "patientFc",
            "patientSat",
            "patientTemperature",
            "patientGlucose",
            "personalNoteTitle",
            "appNoteTitle"
        ]);

        inputs.forEach(input => {
            if (excludedIds.has(input.id)) return;
            if (input.hasAttribute("list") || input.getAttribute("role") === "combobox") return;

            const dataListId =
                "dl-" + Math.random().toString(36).substr(2, 9);

            const dataList = document.createElement("datalist");
            dataList.id = dataListId;

            document.body.appendChild(dataList);
            input.setAttribute("list", dataListId);
            input.setAttribute("autocomplete", "off");

            input.addEventListener("input", () => {
                const valore = input.value.toLowerCase();
                dataList.innerHTML = "";

                if (valore.length > 0) {
                    const filtrati = listaFarmaciDati
                        .filter(f =>
                            f.toLowerCase().startsWith(valore)
                        )
                        .slice(0, 15);

                    filtrati.forEach(farmaco => {
                        const option = document.createElement("option");
                        option.value = farmaco;
                        dataList.appendChild(option);
                    });
                }
            });
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();





function renderSections(data) {

    if (!data.sections) {
        content.innerHTML = "";
        return;
    }

    const orderedSections =
        applySavedSectionOrder(
            data.id || state,
            data.sections
        );

    let html = "";

    orderedSections.forEach((section, sectionIndex) => {

        const sectionKey =
            getStableSectionKey(section, sectionIndex);

        const orderedItems =
            applySavedItemOrder(
                data.id || state,
                sectionKey,
                section.items || []
            );

        html += `
            <section
                class="sortable-section"
                data-section-key="${escapeAttribute(sectionKey)}"
            >
                <h2>
                    <span>${section.title}</span>
                    ${isOrderEditMode() ? `
                        <span class="order-controls section-order-controls">
                            <button type="button" class="order-button" data-order="up" aria-label="Sposta sezione su">↑</button>
                            <button type="button" class="order-button" data-order="down" aria-label="Sposta sezione giù">↓</button>
                        </span>
                    ` : ""}
                </h2>

                <div class="item-list">
        `;

        orderedItems.forEach(sectionItem => {

            const itemId =
                typeof sectionItem === "string"
                    ? createId(sectionItem)
                    : sectionItem.id || createId(sectionItem.title);

            const itemTitle =
                typeof sectionItem === "string"
                    ? sectionItem
                    : sectionItem.title;

            html += `
                    <div
                        class="sortable-item-row"
                        data-item-id="${escapeAttribute(itemId)}"
                        data-section-key="${escapeAttribute(sectionKey)}"
                    >
                        <a
                            class="content-button sortable-item"
                            href="?state=${encodeURIComponent(state)}&item=${encodeURIComponent(itemId)}"
                        >
                            <span>${itemTitle}</span>
                            
                        </a>

                        ${isOrderEditMode() ? `
                            <span class="order-controls item-order-controls">
                                <button type="button" class="order-button" data-order="up" aria-label="Sposta elemento su">↑</button>
                                <button type="button" class="order-button" data-order="down" aria-label="Sposta elemento giù">↓</button>
                            </span>
                        ` : ""}
                    </div>
            `;
        });

        html += `
                </div>
            </section>
        `;
    });

    content.innerHTML = html;
    setupContentOrderControls();
}


/* =========================================================
   ORDINE CONTENUTI — LOCAL STORAGE
========================================================= */

function getStableSectionKey(section, index) {

    return (
        section.id ||
        createId(section.title || `section-${index}`)
    );

}


function getItemKey(item, index) {

    if (typeof item === "string") {
        return createId(item);
    }

    return (
        item.id ||
        createId(item.title || `item-${index}`)
    );

}


function applySavedSectionOrder(stateId, sections) {

    const key =
        `nursing-sections-${stateId}`;

    try {

        const saved =
            JSON.parse(
                localStorage.getItem(key) || "null"
            );

        if (!Array.isArray(saved)) {
            return [...sections];
        }

        const map =
            new Map(
                sections.map(
                    (section, index) => [
                        getStableSectionKey(section, index),
                        section
                    ]
                )
            );

        return [
            ...saved
                .map(id => map.get(id))
                .filter(Boolean),
            ...sections.filter(
                (section, index) =>
                    !saved.includes(
                        getStableSectionKey(section, index)
                    )
            )
        ];

    }

    catch (error) {

        console.error(
            "Errore ordine sottogruppi:",
            error
        );

        return [...sections];

    }

}


function applySavedItemOrder(stateId, sectionKey, items) {

    const key =
        `nursing-items-${stateId}-${sectionKey}`;

    try {

        const saved =
            JSON.parse(
                localStorage.getItem(key) || "null"
            );

        if (!Array.isArray(saved)) {
            return [...items];
        }

        const map =
            new Map(
                items.map(
                    (item, index) => [
                        getItemKey(item, index),
                        item
                    ]
                )
            );

        return [
            ...saved
                .map(id => map.get(id))
                .filter(Boolean),
            ...items.filter(
                (item, index) =>
                    !saved.includes(
                        getItemKey(item, index)
                    )
            )
        ];

    }

    catch (error) {

        console.error(
            "Errore ordine elementi:",
            error
        );

        return [...items];

    }

}


/* =========================================================
   MODIFICA ORDINE — PULSANTI SU / GIÙ
========================================================= */

function createOrderControls(index, total, label) {

    const controls = document.createElement("div");
    controls.className = "order-controls";

    const up = document.createElement("button");
    up.type = "button";
    up.className = "order-button";
    up.dataset.order = "up";
    up.setAttribute("aria-label", `Sposta ${label} su`);
    up.textContent = "↑";
    up.disabled = index === 0;

    const down = document.createElement("button");
    down.type = "button";
    down.className = "order-button";
    down.dataset.order = "down";
    down.setAttribute("aria-label", `Sposta ${label} giù`);
    down.textContent = "↓";
    down.disabled = index === total - 1;

    controls.append(up, down);
    return controls;
}


function moveElement(element, direction, selector, saveCallback) {

    const current = element.closest(selector);
    if (!current) return;

    const sibling =
        direction === "up"
            ? current.previousElementSibling
            : current.nextElementSibling;

    if (!sibling) return;

    if (direction === "up") {
        current.parentNode.insertBefore(current, sibling);
    } else {
        current.parentNode.insertBefore(sibling, current);
    }

    saveCallback();
    refreshOrderControls();
}


function setupHomeOrderControls() {

    shortcuts
        .querySelectorAll(".order-button")
        .forEach(button => {

            button.addEventListener("click", event => {

                event.preventDefault();
                event.stopPropagation();

                const row = button.closest(".shortcut-row");
                if (!row) return;

                moveElement(
                    row,
                    button.dataset.order,
                    ".shortcut-row",
                    saveShortcutOrder
                );
            });
        });
}


function setupContentOrderControls() {

    content
        .querySelectorAll(".section-order-controls .order-button")
        .forEach(button => {

            button.addEventListener("click", event => {

                event.preventDefault();
                event.stopPropagation();

                const section = button.closest(".sortable-section");
                if (!section) return;

                moveElement(
                    section,
                    button.dataset.order,
                    ".sortable-section",
                    saveSectionOrder
                );
            });
        });

    content
        .querySelectorAll(".item-order-controls .order-button")
        .forEach(button => {

            button.addEventListener("click", event => {

                event.preventDefault();
                event.stopPropagation();

                const row = button.closest(".sortable-item-row");
                if (!row) return;

                moveElement(
                    row,
                    button.dataset.order,
                    ".sortable-item-row",
                    () => {
                        saveItemOrder(
                            row.dataset.sectionKey,
                            row.parentElement
                        );
                    }
                );
            });
        });
}

// ==========================================
// FUNZIONE DI INTERAZIONE FARMACI (DA ZERO)
// ==========================================

// Array principale che conterrà l'elenco dei farmaci
let listaFarmaciDati = [];

// Lista di backup immediata nel caso in cui il file CSV non sia accessibile localmente
const farmaciDiBackup = [
    "Acetaminofene", "Acido Acetilsalicilico", "Amoxicillina", "Aspirina", "Atenololo", 
    "Augmentin", "Azitromicina", "Clonazepam", "Codeina", "Diazepam", "Eparina", 
    "Ibuprofene", "Insulina", "Ketoprofene", "Levofloxacina", "Metformina", 
    "O someprazolo", "Paracetamolo", "Prednisone", "Rifampicina", "Tachipirina", "Warfarin"
];

/**
 * Tenta di caricare il file CSV dalla repository.
 * Se fallisce (es. aperto come file locale), carica la lista di backup.
 */
async function caricaDatabaseFarmaci() {
    try {
        const response = await fetch("./src/data/farmaci.csv");
        if (!response.ok) throw new Error("CSV non raggiungibile");
        
        const testoCSV = await response.text();
        const righe = testoCSV.split(/\r?\n/);
        
        // Estrae la prima colonna pulendola dagli spazi
        listaFarmaciDati = righe.map(riga => {
            const colonne = riga.split(/[,;]/);
            return colonne[0]?.trim();
        }).filter(nome => nome && nome.length > 0);

        // Scarta l'intestazione se presente
        if (listaFarmaciDati.length > 0 && 
           (listaFarmaciDati[0].toLowerCase() === "nome" || listaFarmaciDati[0].toLowerCase() === "farmaco")) {
            listaFarmaciDati.shift();
        }
        
        console.log("Database farmaci caricato correttamente dal file CSV.");
    } catch (e) {
        // Se si verifica un errore o sei offline/locale, usa la lista pronta
        listaFarmaciDati = farmaciDiBackup;
        console.warn("Impossibile leggere il CSV (probabilmente sei in locale senza server). Caricata lista di backup.");
    }
}

// Avvia immediatamente l'indicizzazione dei dati
caricaDatabaseFarmaci();

/**
 * Restituisce i farmaci filtrati escludendo rigorosamente tutto ciò che non inizia con le stesse lettere.
 * Puoi richiamare questa funzione passando il testo inserito dall'utente.
 * 
 * @param {string} testoInserito - Il testo digitato dall'utente
 * @returns {Array} Array di stringhe con i soli farmaci suggeriti
 */
function updateDrugSearch(testoInserito) {
    if (!testoInserito || testoInserito.trim() === "") {
        return [];
    }

    const inputMinuscolo = testoInserito.toLowerCase();

    // FILTRO RIGIDO: Mantiene SOLO i farmaci che INIZIANO con i caratteri digitati
    return listaFarmaciDati.filter(farmaco => 
        farmaco.toLowerCase().startsWith(inputMinuscolo)
    );
}

function refreshOrderControls() {

    shortcuts
        .querySelectorAll(".shortcut-row")
        .forEach((row, index, rows) => {

            row.querySelector('[data-order="up"]').disabled =
                index === 0;

            row.querySelector('[data-order="down"]').disabled =
                index === rows.length - 1;
        });

    content
        .querySelectorAll(".sortable-section")
        .forEach((section, index, sections) => {

            section.querySelector('[data-order="up"]').disabled =
                index === 0;

            section.querySelector('[data-order="down"]').disabled =
                index === sections.length - 1;
        });

    content
        .querySelectorAll(".item-list")
        .forEach(list => {

            const rows =
                Array.from(
                    list.querySelectorAll(".sortable-item-row")
                );

            rows.forEach((row, index) => {

                row.querySelector('[data-order="up"]').disabled =
                    index === 0;

                row.querySelector('[data-order="down"]').disabled =
                    index === rows.length - 1;
            });
        });
}

function saveSectionOrder() {

    const order =
        Array.from(
            content.querySelectorAll(
                ".sortable-section"
            )
        ).map(
            section =>
                section.dataset.sectionKey
        );

    localStorage.setItem(
        `nursing-sections-${state}`,
        JSON.stringify(order)
    );

}


function saveItemOrder(sectionKey, list) {

    const order =
        Array.from(
            list.querySelectorAll(".sortable-item-row")
        ).map(
            row => row.dataset.itemId
        );

    localStorage.setItem(
        `nursing-items-${state}-${sectionKey}`,
        JSON.stringify(order)
    );
}



/* =========================================================
   DATABASE LOCALE — INTERAZIONI FARMACI
   Struttura tecnica offline predisposta per dati autorizzati.
========================================================= */

const DRUG_DB_NAME = "nursing-drug-database";
const DRUG_DB_VERSION = 1;
const DRUG_DB_STORE = "metadata";

function openDrugDatabase() {
    return new Promise((resolve, reject) => {
        if (!("indexedDB" in window)) {
            reject(new Error("IndexedDB non disponibile."));
            return;
        }

        const request = indexedDB.open(DRUG_DB_NAME, DRUG_DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(DRUG_DB_STORE)) {
                db.createObjectStore(DRUG_DB_STORE, { keyPath: "key" });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("Impossibile aprire il database locale."));
    });
}

async function getDrugDatabaseMetadata() {
    const db = await openDrugDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(DRUG_DB_STORE, "readonly");
        const store = transaction.objectStore(DRUG_DB_STORE);
        const request = store.get("dataset");

        request.onsuccess = () => {
            db.close();
            resolve(request.result || null);
        };

        request.onerror = () => {
            db.close();
            reject(request.error);
        };
    });
}

async function initializeDrugDatabaseMetadata() {
    const existing = await getDrugDatabaseMetadata().catch(() => null);

    if (existing) {
        return existing;
    }

    const metadata = {
        key: "dataset",
        source: "Da configurare — dataset autorizzato",
        version: "0",
        updatedAt: null,
        recordCount: 0,
        status: "empty"
    };

    const db = await openDrugDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(DRUG_DB_STORE, "readwrite");
        transaction.objectStore(DRUG_DB_STORE).put(metadata);

        transaction.oncomplete = () => {
            db.close();
            resolve(metadata);
        };

        transaction.onerror = () => {
            db.close();
            reject(transaction.error);
        };
    });
}

async function renderDrugInteractionDatabase() {
    const metadata = await initializeDrugDatabaseMetadata();

    content.innerHTML = `
        <section class="detail-page composable-page">
            ${detailHeader("Interazioni tra farmaci", window.__currentData)}

            <div class="detail-content">
                <article class="info-block info-block-note">
                    <strong>Database locale</strong>
                    <p>
                        Questa sezione utilizza un archivio locale IndexedDB.
                        I dati possono essere mantenuti sul dispositivo e
                        consultati offline.
                    </p>
                </article>

                <article class="info-block">
                    <h3>Stato archivio</h3>
                    <p><strong>Fonte:</strong> ${escapeHtml(metadata.source)}</p>
                    <p><strong>Versione:</strong> ${escapeHtml(metadata.version)}</p>
                    <p><strong>Record:</strong> ${escapeHtml(String(metadata.recordCount))}</p>
                    <p><strong>Ultimo aggiornamento:</strong> ${metadata.updatedAt ? escapeHtml(metadata.updatedAt) : "Non ancora disponibile"}</p>
                </article>

                <article class="info-block info-block-warning">
                    <span class="info-block-icon">ℹ️</span>
                    <div>
                        <strong>Archivio non ancora popolato</strong>
                        <p>
                            La struttura offline è pronta, ma non contiene
                            ancora dati di interazione. Prima di importarli
                            occorre utilizzare un dataset con autorizzazione
                            alla redistribuzione nell'app.
                        </p>
                    </div>
                </article>

                <button id="refreshDrugDatabaseStatus" class="settings-action" type="button">
                    ↻ Aggiorna stato archivio
                </button>
                <button id="verifyDrugInteractionsButton" class="settings-action" type="button">
                    🔄 Verifica Interazioni
                </button>
                <p id="drugDatabaseMessage" class="personal-note-message"></p>
            </div>
        </section>
    `;

    document.getElementById("verifyDrugInteractionsButton")?.addEventListener("click", () => {
        const interactionItem = {
            id: "interazioni-farmaci",
            title: "Interazioni tra farmaci",
            type: "interaction-db"
        };
        renderDrugInteractionDatabase();
    });

    document.getElementById("refreshDrugDatabaseStatus")?.addEventListener("click", async () => {
        const message = document.getElementById("drugDatabaseMessage");
        try {
            const current = await getDrugDatabaseMetadata();
            if (message) {
                message.textContent =
                    "Archivio locale disponibile. Nessun dataset remoto configurato.";
            }
            console.log("Nursing Shot — database farmaci:", current);
        } catch (error) {
            if (message) {
                message.textContent = "Impossibile leggere il database locale.";
            }
            console.error(error);
        }
    });
}

/* =========================================================
   TROVA ELEMENTO
========================================================= */

function findItem(data, itemId) {

    if (!data.sections || !itemId) {
        return null;
    }

    /*
     * Cerca ricorsivamente negli elementi dell'archivio.
     * Questo gestisce anche elementi annidati, come i
     * singoli calcolatori dentro la sezione Calcolatori.
     */

    function searchItems(items) {

        if (!Array.isArray(items)) {
            return null;
        }

        for (const currentItem of items) {

            const currentId =
                typeof currentItem === "string"
                    ? createId(currentItem)
                    : currentItem?.id;

            if (currentId === itemId) {
                return currentItem;
            }

            if (
                typeof currentItem === "object" &&
                Array.isArray(currentItem.items)
            ) {

                const nestedItem =
                    searchItems(currentItem.items);

                if (nestedItem) {
                    return nestedItem;
                }
            }
        }

        return null;
    }

    for (const section of data.sections) {

        const found =
            searchItems(section.items);

        if (found) {
            return found;
        }
    }

    return null;
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
        let formattedDate = "non disponibile";

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
            `<span>Ultimo aggiornamento: ${formattedDate}</span>` +
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
                <span>Ultimo aggiornamento: caricamento...</span>
                <span>Fonte: <a href="https://www.aifa.gov.it/liste-dei-farmaci" target="_blank" rel="noopener noreferrer">AIFA — Anagrafica dei farmaci</a></span>
            </div>

            <input id="drugClassSearchInput" class="patient-search-input" type="search"
                placeholder="Cerca principio attivo..." autocomplete="off">
            <div id="drugClassSearchSuggestions" class="patient-search-suggestions" hidden></div>

            <div class="detail-content">
                <div class="item-list" id="drugClassList">
                    ${classes.map(currentItem => `
                        <a class="content-button" href="?state=${encodeURIComponent(data.id)}&item=${encodeURIComponent(currentItem.id)}">
                            <span>${escapeHtml(currentItem.title)}</span>
                            
                        </a>
                    `).join("")}
                </div>
            </div>
        </section>
    `;

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

                const combined = [...matches, ...filteredAifaMatches]
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

// Dizionario delle sottoclassi terapeutiche specifiche per i farmaci più diffusi
const sottoclassiSpecificheATC = {
    'M01A': { id: 'fans', nome: 'FANS / Antinfiammatori' },
    'J01C': { id: 'antibiotici', nome: 'Antibiotici (Penicilline/Beta-lattamici)' },
    'J01D': { id: 'antibiotici', nome: 'Antibiotici (Cefalosporine)' },
    'J01F': { id: 'antibiotici', nome: 'Antibiotici (Macrolidi)' },
    'J01G': { id: 'antibiotici', nome: 'Antibiotici (Aminoglicosidi)' },
    'N02A': { id: 'oppioidi', nome: 'Oppioidi' },
    'N03A': { id: 'antiepilettici', nome: 'Antiepilettici' },
    'N05A': { id: 'neurolettici', nome: 'Neurolettici (Antipsicotici)' },
    'C07A': { id: 'beta-bloccanti', nome: 'Beta-bloccanti' },
    'C08C': { id: 'calcio-antagonisti', nome: 'Calcio-antagonisti' },
    'C09A': { id: 'ace-inibitori', nome: 'ACE-inibitori' },
    'C09C': { id: 'sartani', nome: 'Sartani (ARB)' },
    'R03A': { id: 'broncodilatatori', nome: 'Broncodilatatori' },
    'H02A': { id: 'corticosteroidi', nome: 'Corticosteroidi sistemici' },
    'D07A': { id: 'corticosteroidi', nome: 'Corticosteroidi dermatologici' },
    'B01A': { id: 'antiaggreganti', nome: 'Antiaggreganti / Anticoagulanti' },
    'B02A': { id: 'emostatici', nome: 'Emostatici' },
    'J05A': { id: 'antivirali', nome: 'Antivirali' },
    'A10B': { id: 'ipoglicemizzanti-orali', nome: 'Ipoglicemizzanti orali' },
    'M05B': { id: 'metabolismo-osseo', nome: 'Farmaci per il metabolismo osseo' },
    'N06A': { id: 'antidepressivi', nome: 'Antidepressivi' }
};

// Dizionario di fallback basato sulle macro-aree (se non c'è una sottoclasse mappata sopra)
const macroClassiATC = {
    'A': { id: 'gastrointestinali-metabolismo', nome: 'Apparato Gastrointestinale e Metabolismo' },
    'B': { id: 'sangue-emopoietici', nome: 'Sangue ed Organi Emopoietici' },
    'C': { id: 'sistema-cardiovascolare', nome: 'Sistema Cardiovascolare' },
    'D': { id: 'dermatologici', nome: 'Dermatologici' },
    'G': { id: 'genito-urinario-ormoni', nome: 'Sistema Genito-Urinario ed Ormoni Sessuali' },
    'H': { id: 'preparati-ormonali', nome: 'Preparati Ormonali Sistemici' },
    'J': { id: 'antinfettivi-sistemici', nome: 'Antinfettivi per Uso Sistemico' },
    'L': { id: 'antineoplastici-immunomodulatori', nome: 'Agenti Antineoplastici ed Immunomodulatori' },
    'M': { id: 'sistema-muscolo-scheletrico', nome: 'Sistema Muscolo-Scheletrico' },
    'N': { id: 'sistema-nervoso', nome: 'Sistema Nervoso' },
    'R': { id: 'sistema-respiratorio', nome: 'Sistema Respiratorio' },
    'S': { id: 'organi-di-senso', nome: 'Organi di Senso' },
    'V': { id: 'vari', nome: 'Vari' }
};

// Funzione intelligente che effettua lo smistamento a due livelli (Sottoclasse -> Macroarea)
function mappaEUnisciClassiATC(listaGrezza) {
    return listaGrezza.map(farmaco => {
        const cNome = String(farmaco.classeNome || "").trim().toLowerCase();
        
        if (cNome.includes("aifa") || !farmaco.classeId) {
            const atcCompleto = farmaco.atc ? farmaco.atc.trim().toUpperCase() : "";
            
            // 1. Prova prima a cercare nei primi 4 caratteri (es. "M01A") per trovare la sottoclasse esatta come i FANS
            const prefisso4 = atcCompleto.substring(0, 4);
            if (sottoclassiSpecificheATC[prefisso4]) {
                return {
                    ...farmaco,
                    classeId: sottoclassiSpecificheATC[prefisso4].id,
                    classeNome: sottoclassiSpecificheATC[prefisso4].nome
                };
            }
            
            // 2. Se non la trova, ripiega sulla macro-area generale (la prima lettera, es. "M")
            const primaLetteraATC = atcCompleto.charAt(0) || 'V';
            const classeReale = macroClassiATC[primaLetteraATC] || { id: 'altro', nome: 'Altre classi terapeutiche' };
            
            return {
                ...farmaco,
                classeId: classeReale.id,
                classeNome: classeReale.nome
            };
        }
        return farmaco;
    });
}

async function loadAifaActiveIngredientIndex() {
    if (Array.isArray(aifaActiveIngredientIndex)) return aifaActiveIngredientIndex;
    const response = await fetch("./src/data/aifa-principi-attivi.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Indice AIFA non disponibile");
    const rawData = await response.json();
    aifaActiveIngredientIndex = mappaEUnisciClassiATC(rawData); 
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
    drugActiveIngredientIndex = mappaEUnisciClassiATC(rawData);
    return drugActiveIngredientIndex;
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
            ${detailHeader("Cerca principi attivi", window.__currentData)}
            <div class="detail-content">
                <div class="info-block">
                    <input id="drugActiveSearchInput" class="personal-note-title-input" type="search" placeholder="Cerca un principio attivo..." autocomplete="off">
                    <p class="personal-note-message">La ricerca collega il principio attivo alla classe farmacologica.</p>
                </div>
                <div id="drugActiveSearchResults" class="item-list"></div>
            </div>
        </section>
    `;
    const input=document.getElementById("drugActiveSearchInput"), results=document.getElementById("drugActiveSearchResults");
    input?.addEventListener("input", async () => {
        const query=input.value.trim();
        if(!query){results.innerHTML="";return;}
        try{
            const matches=(await loadDrugActiveIngredientIndex()).map(entry=>({...entry,score:drugSearchScore(query,entry.principioAttivo)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.principioAttivo.localeCompare(b.principioAttivo,"it")).slice(0,20);
            results.innerHTML=matches.length?matches.map(entry=>`<a class="content-button" href="?state=farmaci&item=${encodeURIComponent(entry.classeId)}"><span><strong>${escapeHtml(entry.principioAttivo)}</strong><small> → ${escapeHtml(entry.classeNome)}</small></span></a>`).join(""):"<div class=\"personal-note-empty\">Nessun principio attivo trovato.</div>";
        }catch(error){console.error(error);results.innerHTML="<div class=\"personal-note-empty\">Indice dei principi attivi non disponibile.</div>";}
    });
}
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

const DDI_AIFA_URL = "https://medicinali.aifa.gov.it/";

function ddiRenderCurate(curate) {
    if (!curate.length) return "";

    const voci = curate.map(v => `
        <li class="ddi-voce ddi-voce-${v.categoria}">
            <span class="ddi-badge">${escapeHtml(v.tipo === "compatibilita" ? "Compatibilità in infusione" : DDI_BADGE[v.categoria])}</span>
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

async function renderDrugInteractions(selectedItem, data) {
    const NI = window.NursingInterazioni;
    const titolo = (selectedItem && selectedItem.title) || "Interazioni tra farmaci";

    content.innerHTML = `
        <section class="detail-page ddi-page">
            ${detailHeader(escapeHtml(titolo), data || window.__currentData)}

            <div class="detail-content">
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
        elRisultato.innerHTML =
            ddiRenderCurate(curate) +
            ddiRenderEsito(NI, idx, rA.id, rB.id, NI.verificaCoppia(idx, rA.id, rB.id), curate.length > 0);
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


/* =========================================================
   CARICA ELEMENTO
========================================================= */

function loadItem(data) {

    const selectedItem =
        findItem(data, item);


    /*
     * ELEMENTO NON TROVATO
     */

    if (!selectedItem) {

        content.innerHTML = `

            <section>

                <h2>
                    Elemento non trovato
                </h2>

                <a
                    class="back-button"
                    href="?state=${encodeURIComponent(state)}"
                >
                    ← ${data.title}
                </a>

            </section>

        `;

        return;

    }


    window.__currentData = data;
    window.__currentItemTitle =
        typeof selectedItem === "string"
            ? selectedItem
            : selectedItem.title || "Scheda";

    const notesMode =
        new URLSearchParams(window.location.search).get("notes");

    if (notesMode === "1") {
        renderPersonalNotesPage(
            state,
            item,
            data,
            window.__currentItemTitle
        );
        return;
    }


    /*
     * SCHEDA COMPONIBILE
     */
    if (Array.isArray(selectedItem.blocks)) {

        renderComposableItem(selectedItem, data);
        return;
    }



    /*
     * STRINGA SEMPLICE
     */
    if (typeof selectedItem === "string") {

        renderGenericText(
            selectedItem,
            "Contenuto in preparazione.",
            data
        );

        return;
    }


    /*
     * SEZIONE CALCOLATORI
     */
    if (selectedItem.type === "calculator-section") {

        renderCalculatorHub(
            selectedItem,
            data
        );

        return;
    }


    /*
     * CALCOLATORE
     */
    if (selectedItem.type === "calculator") {

        renderCalculator(
            selectedItem.id,
            selectedItem.title,
            data
        );

        return;
    }


    /*
     * DATABASE LOCALE — INTERAZIONI
     */
    if (selectedItem.type === "interaction-db") {
        renderDrugInteractions(selectedItem, data);
        return;
    }

    if (selectedItem.type === "category-section") {
        renderDrugClassCategory(selectedItem, data);
        return;
    }

    if (selectedItem.type === "drug-search") {
        renderDrugSearch();
        return;
    }



    /*
     * FARMACO
     */
    if (selectedItem.type === "drug") {

        renderDrug(
            selectedItem,
            data
        );

        return;
    }


    /*
     * VALORE DI LABORATORIO
     */
    if (selectedItem.type === "lab-value") {

        renderLabValue(
            selectedItem,
            data
        );

        return;
    }


    /*
     * PROTOCOLLO
     */
    if (selectedItem.type === "protocol") {

        renderProtocol(
            selectedItem,
            data
        );

        return;
    }


    /*
     * TESTO GENERICO
     */
    if (selectedItem.type === "text") {

        const text =
            selectedItem.content?.text ||
            "Contenuto in preparazione.";

        renderGenericText(
            selectedItem.title,
            text,
            data
        );

        return;
    }


    /*
     * FALLBACK
     */
    renderGenericText(
        selectedItem.title,
        "Contenuto in preparazione.",
        data
    );

}


/* =========================================================
   SCHEDE COMPONIBILI
========================================================= */

function renderComposableItem(item, data) {

    const blocks =
        Array.isArray(item.blocks)
            ? item.blocks
            : [];

    content.innerHTML = `
        <section class="detail-page composable-page">

            ${detailHeader(item.title, data)}

            <div class="detail-content composable-content">
                ${blocks.map(renderContentBlock).join("")}
            </div>

        </section>
    `;
}


function renderContentBlock(block) {

    if (!block || typeof block !== "object") {
        return "";
    }

    const type = block.type || "text";

    if (type === "text") {
        return `
            <article class="info-block info-block-text">
                ${block.title ? `<h3>${escapeHtml(block.title)}</h3>` : ""}
                <p>${escapeHtml(block.content || "")}</p>
            </article>
        `;
    }

    if (type === "value") {
        return `
            <article class="info-block info-block-value">
                ${block.title ? `<span class="info-block-label">${escapeHtml(block.title)}</span>` : ""}
                <strong>${escapeHtml(block.content || "")}</strong>
            </article>
        `;
    }

    if (type === "warning") {
        return `
            <aside class="info-block info-block-warning">
                <span class="info-block-icon">⚠️</span>
                <div>
                    ${block.title ? `<strong>${escapeHtml(block.title)}</strong>` : ""}
                    <p>${escapeHtml(block.content || "")}</p>
                </div>
            </aside>
        `;
    }

    if (type === "note") {
        return `
            <aside class="info-block info-block-note">
                ${block.title ? `<strong>${escapeHtml(block.title)}</strong>` : ""}
                <p>${escapeHtml(block.content || "")}</p>
            </aside>
        `;
    }

    if (type === "list") {

        const items =
            Array.isArray(block.items)
                ? block.items
                : [];

        const listTag =
            block.ordered ? "ol" : "ul";

        return `
            <article class="info-block info-block-list">
                ${block.title ? `<h3>${escapeHtml(block.title)}</h3>` : ""}
                <${listTag}>
                    ${items.map(item => `<li>${escapeHtml(item)}</li>`).join("")}
                </${listTag}>
            </article>
        `;
    }

    if (type === "table") {

        const headers =
            Array.isArray(block.headers)
                ? block.headers
                : [];

        const rows =
            Array.isArray(block.rows)
                ? block.rows
                : [];

        return `
            <article class="info-block info-block-table">
                ${block.title ? `<h3>${escapeHtml(block.title)}</h3>` : ""}
                <div class="info-table-wrapper">
                    <table>
                        ${headers.length ? `
                            <thead>
                                <tr>
                                    ${headers.map(header => `<th>${escapeHtml(header)}</th>`).join("")}
                                </tr>
                            </thead>
                        ` : ""}
                        <tbody>
                            ${rows.map(row => `
                                <tr>
                                    ${(Array.isArray(row) ? row : [row]).map(cell => `<td>${escapeHtml(cell)}</td>`).join("")}
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                </div>
            </article>
        `;
    }

    if (type === "divider") {
        return `<hr class="info-block-divider">`;
    }

    if (type === "image" && block.src) {
        return `
            <figure class="info-block info-block-image">
                <img src="${escapeAttribute(block.src)}" alt="${escapeAttribute(block.alt || "")}" loading="lazy">
                ${block.caption ? `<figcaption>${escapeHtml(block.caption)}</figcaption>` : ""}
            </figure>
        `;
    }

    if (type === "related") {

        const items =
            Array.isArray(block.items)
                ? block.items
                : [];

        return `
            <article class="info-block info-block-related">
                ${block.title ? `<h3>${escapeHtml(block.title)}</h3>` : ""}
                <div class="related-list">
                    ${items.map(related => {
                        const relatedId =
                            typeof related === "string"
                                ? createId(related)
                                : related?.id;
                        const relatedTitle =
                            typeof related === "string"
                                ? related
                                : related?.title;

                        if (!relatedId || !relatedTitle) {
                            return "";
                        }

                        return `
                            <a class="related-link" href="?state=${encodeURIComponent(data.id || state)}&item=${encodeURIComponent(relatedId)}">
                                <span>${escapeHtml(relatedTitle)}</span>
                                
                            </a>
                        `;
                    }).join("")}
                </div>
            </article>
        `;
    }

    return "";
}


/* =========================================================
   HEADER DETTAGLIO
========================================================= */

function detailHeader(title, data) {

    return `
        <div class="detail-header-row">
            <h2>${title}</h2>
        </div>

        ${state && item
            ? renderPersonalNotesButton(state, item)
            : ""}
    `;
}



/* =========================================================
   TESTO GENERICO
========================================================= */

function renderGenericText(title, text, data = null) {

    content.innerHTML = `

        <section class="detail-page">

            ${
                data
                    ? detailHeader(title, data)
                    : `<h2>${title}</h2>`
            }

            <div class="detail-content">

                <p>
                    ${text}
                </p>

            </div>

        </section>

    `;

}


/* =========================================================
   FARMACO
========================================================= */

function renderDrug(item, data) {

    const drug =
        item.content || {};


    content.innerHTML = `

        <section class="detail-page">

            ${detailHeader(item.title, data)}

            <div class="detail-content">

                ${renderField(
                    "Classe",
                    drug.class
                )}

                ${renderListField(
                    "Esempi",
                    drug.indications
                )}

                ${renderListField(
                    "Effetti",
                    drug.effects
                )}

                ${renderListField(
                    "Monitoraggio",
                    drug.monitoring
                )}

                ${renderListField(
                    "Effetti indesiderati",
                    drug.adverseEffects
                )}

                ${renderField(
                    "Note",
                    drug.notes
                )}

            </div>

        </section>

    `;

}

/* =========================================================
   LABORATORIO
========================================================= */

function renderLabValue(item, data) {

    const lab =
        item.content || {};


    content.innerHTML = `

        <section class="detail-page">

            ${detailHeader(item.title, data)}

            <div class="detail-content">

                ${renderField(
                    "Descrizione",
                    lab.description
                )}

                ${renderField(
                    "Valori di riferimento",
                    lab.normal
                )}

                ${renderField(
                    "↑ Aumento",
                    lab.high
                )}

                ${renderField(
                    "↓ Riduzione",
                    lab.low
                )}

            </div>

        </section>

    `;

}


/* =========================================================
   PROTOCOLLO
========================================================= */

function renderProtocol(item, data) {

    const protocol =
        item.content || {};


    let stepsHTML = "";


    if (protocol.steps) {

        protocol.steps.forEach(step => {

            stepsHTML += `

                <div class="protocol-step">

                    <h3>
                        ${step.letter || ""}
                        ${step.title || ""}
                    </h3>

                    <p>
                        ${step.text || ""}
                    </p>

                </div>

            `;

        });

    }


    content.innerHTML = `

        <section class="detail-page">

            ${detailHeader(item.title, data)}

            <div class="detail-content">

                ${stepsHTML}

            </div>

        </section>

    `;

}


/* =========================================================
   CAMPO
========================================================= */

function renderField(title, value) {

    if (!value) {

        return "";

    }


    return `

        <div class="info-block">

            <h3>
                ${title}
            </h3>

            <p>
                ${value}
            </p>

        </div>

    `;

}


/* =========================================================
   LISTA
========================================================= */

function renderListField(title, values) {

    if (!values || !values.length) {

        return "";

    }


    return `

        <div class="info-block">

            <h3>
                ${title}
            </h3>

            <ul>

                ${values.map(value => `
                    <li>${value}</li>
                `).join("")}

            </ul>

        </div>

    `;

}


/* =========================================================
   SEZIONE CALCOLATORI
========================================================= */

function renderCalculatorHub(item, data) {

    const calculators =
        item.items || [];

    let html = `
        <section class="detail-page">

            ${detailHeader(item.title, data)}

            <div class="detail-content">

                <div class="item-list calculator-list">

                    ${calculators.map(calculator => `

                        <a
                            class="content-button"
                            href="?state=${encodeURIComponent(data.id)}&item=${encodeURIComponent(calculator.id)}"
                        >
                            <span>
                                ${calculator.title}
                            </span>
                        </a>

                    `).join("")}

                </div>

            </div>

        </section>
    `;

    content.innerHTML = html;

}


/* =========================================================
   CALCOLATORI
========================================================= */


/* =========================================================
   NUMERI IN FORMATO ITALIANO
========================================================= */

/*
 * Regole:
 *
 * 1.000       = 1000
 * 0,5         = 0.5
 * 1.500,25    = 1500.25
 *
 * Il punto è SEMPRE separatore delle migliaia.
 * La virgola è SEMPRE separatore decimale.
 */

function parseItalianNumber(value) {

    if (value === null || value === undefined) {
        return NaN;
    }

    const text = String(value).trim();

    if (!text) {
        return NaN;
    }

    /*
     * Con la virgola: il punto può essere solo separatore delle
     * migliaia, in gruppi esatti da 3 cifre (1.500,25).
     */

    if (text.includes(",")) {

        if (!/^(\d{1,3}(\.\d{3})+|\d+),\d+$/.test(text)) {
            return NaN;
        }

        return Number(text.replace(/\./g, "").replace(",", "."));
    }

    // Solo cifre: 1000
    if (/^\d+$/.test(text)) {
        return Number(text);
    }

    // Raggruppamento delle migliaia: 1.500 / 12.500.000.
    // Un numero che inizia con "0." (es. 0.250) NON può essere un raggruppamento:
    // è un decimale scritto col punto, quindi vale 0,25 e non 250.
    if (/^[1-9]\d{0,2}(\.\d{3})+$/.test(text)) {
        return Number(text.replace(/\./g, ""));
    }

    // Decimale col punto (tastiere con il punto): 1.5, 0.25, 2.75
    if (/^\d+\.\d+$/.test(text)) {
        return Number(text);
    }

    return NaN;
}



/* =========================================================
   INPUT NUMERICO
========================================================= */

function numberInput(id, label, placeholder = "") {

    return `
        <label>

            ${label}

            <input
                id="${id}"
                type="text"
                inputmode="decimal"
                placeholder="${placeholder}"
                autocomplete="off"
            >

        </label>
    `;
}


/* =========================================================
   SELECT UNITÀ
========================================================= */

function unitSelect(id, units) {

    return `
        <select id="${id}">

            ${units.map(unit => `
                <option value="${unit.value}">
                    ${unit.label}
                </option>
            `).join("")}

        </select>
    `;
}


/* =========================================================
   NOTA DIDATTICA
========================================================= */

function calculatorNote() {

    return `
        <p class="calculator-note">
            Strumento didattico: verifica sempre prescrizione,
            concentrazione, unità di misura e protocollo prima
            dell'uso clinico.
        </p>
    `;
}


/* =========================================================
   DOSE DA SOMMINISTRARE
========================================================= */

function renderDoseCalculator() {

    return `

        <div class="calculator">

            <h3>
                Dose da somministrare
            </h3>

            ${calculatorNote()}


            <p>
                Puoi calcolare il volume da somministrare
                partendo dalla quantità disponibile oppure
                da una concentrazione percentuale.
            </p>


            <div class="calculate-choice">

                <strong>
                    Tipo di concentrazione disponibile
                </strong>


                <label class="radio-option">

                    <input
                        type="radio"
                        name="dose-mode"
                        value="quantity"
                        checked
                    >

                    Quantità / volume

                </label>


                <label class="radio-option">

                    <input
                        type="radio"
                        name="dose-mode"
                        value="percentage"
                    >

                    Percentuale

                </label>

            </div>


            <div class="calculator-row">

                ${numberInput(
                    "dose-prescribed",
                    "Dose prescritta",
                    "es. 500"
                )}

                ${unitSelect(
                    "dose-prescribed-unit",
                    [
                        {
                            value: "mcg",
                            label: "mcg"
                        },
                        {
                            value: "mg",
                            label: "mg"
                        },
                        {
                            value: "g",
                            label: "g"
                        }
                    ]
                )}

            </div>


            <div id="dose-concentration-fields">

                <div class="calculator-row">

                    ${numberInput(
                        "dose-concentration",
                        "Quantità disponibile",
                        "es. 250"
                    )}

                    ${unitSelect(
                        "dose-concentration-unit",
                        [
                            {
                                value: "mcg",
                                label: "mcg"
                            },
                            {
                                value: "mg",
                                label: "mg"
                            },
                            {
                                value: "g",
                                label: "g"
                            }
                        ]
                    )}

                </div>


                <div class="calculator-row">

                    ${numberInput(
                        "dose-volume",
                        "Volume contenente la quantità",
                        "es. 2"
                    )}

                    ${unitSelect(
                        "dose-volume-unit",
                        [
                            {
                                value: "mL",
                                label: "mL"
                            },
                            {
                                value: "L",
                                label: "L"
                            }
                        ]
                    )}

                </div>

            </div>


            <div
                id="dose-percentage-field"
                style="display: none;"
            >

                <div class="calculator-row">

                    ${numberInput(
                        "dose-percent",
                        "Concentrazione",
                        "es. 5"
                    )}

                    <span class="unit-static">
                        % m/V
                    </span>

                </div>


                <p class="calculator-note">
                    Per questo calcolo la percentuale è interpretata
                    come % m/V: grammi di sostanza ogni 100 mL
                    di soluzione.
                </p>

            </div>


            <button id="calculate-dose">
                Calcola
            </button>


            <div
                id="dose-result"
                class="calculator-result"
            ></div>

        </div>

    `;
}


/* =========================================================
   DILUIZIONI
========================================================= */

/*
 * Per C1 e C2 l'utente sceglie:
 *
 * PESO:
 * mcg / mg / g
 *
 * VOLUME:
 * mL / L
 *
 * Esempio:
 *
 * C1 = 500 mg / 10 mL
 * C2 = 50 mg / 10 mL
 *
 * Il programma converte internamente
 * entrambe le concentrazioni in mg/mL.
 */

function renderDilutionCalculator() {

    return `
        <div class="calculator">

            <div class="calculator-grid">

                <div class="calculator-field">
                    <label for="dilution-c1">
                        C1
                    </label>

                    <input
                        type="text"
                        id="dilution-c1"
                        inputmode="decimal"
                        placeholder="Es. 100"
                    >

                    <select id="dilution-c1-unit">
                        <option value="mg/ml">mg/mL</option>
                        <option value="g/ml">g/mL</option>
                        <option value="%">% m/V</option>
                    </select>
                </div>


                <div class="calculator-field">
                    <label for="dilution-v1">
                        V1
                    </label>

                    <input
                        type="text"
                        id="dilution-v1"
                        inputmode="decimal"
                        placeholder="Es. 5"
                    >

                    <select id="dilution-v1-unit">
                        <option value="ml">mL</option>
                        <option value="l">L</option>
                    </select>
                </div>


                <div class="calculator-field">
                    <label for="dilution-c2">
                        C2
                    </label>

                    <input
                        type="text"
                        id="dilution-c2"
                        inputmode="decimal"
                        placeholder="Es. 20"
                    >

                    <select id="dilution-c2-unit">
                        <option value="mg/ml">mg/mL</option>
                        <option value="g/ml">g/mL</option>
                        <option value="%">% m/V</option>
                    </select>
                </div>


                <div class="calculator-field">
                    <label for="dilution-v2">
                        V2
                    </label>

                    <input
                        type="text"
                        id="dilution-v2"
                        inputmode="decimal"
                        placeholder="Es. ?"
                    >

                    <select id="dilution-v2-unit">
                        <option value="ml">mL</option>
                        <option value="l">L</option>
                    </select>
                </div>

            </div>


            <div class="calculator-formula">
                <strong>C1 × V1 = C2 × V2</strong>
            </div>


            <div
                id="dilution-result"
                class="calculator-result"
                style="display:none;"
            ></div>


            <div class="calculator-actions">

                <button
                    type="button"
                    id="dilution-calculate"
                    class="primary-button"
                >
                    Calcola
                </button>

                <button
                    type="button"
                    id="dilution-reset"
                    class="secondary-button"
                >
                    Cancella
                </button>

            </div>


            ${calculatorNote()}

        </div>
    `;
}


/* =========================================================
   VELOCITÀ DI INFUSIONE
========================================================= */

function renderMlHCalculator() {

    return `

        <div class="calculator">

            <h3>
                Velocità di infusione
            </h3>

            ${calculatorNote()}


            <div class="calculator-row">

                ${numberInput(
                    "infusion-volume",
                    "Volume",
                    "es. 0,5"
                )}

                ${unitSelect(
                    "infusion-volume-unit",
                    [
                        {
                            value: "mL",
                            label: "mL"
                        },
                        {
                            value: "L",
                            label: "L"
                        }
                    ]
                )}

            </div>


            <div class="calculator-row">

                ${numberInput(
                    "infusion-time",
                    "Tempo",
                    "es. 2"
                )}

                ${unitSelect(
                    "infusion-time-unit",
                    [
                        {
                            value: "min",
                            label: "minuti"
                        },
                        {
                            value: "h",
                            label: "ore"
                        }
                    ]
                )}

            </div>


            <button id="calculate-mlh">
                Calcola
            </button>


            <div
                id="mlh-result"
                class="calculator-result"
            ></div>

        </div>

    `;
}

/* =========================================================
   DURATA DELL'INFUSIONE
========================================================= */

function renderDurationCalculator() {

    return `

        <div class="calculator">

            <h3>
                Durata dell'infusione
            </h3>

            ${calculatorNote()}

            <div class="calculator-row">

                ${numberInput(
                    "duration-volume",
                    "Volume",
                    "es. 500"
                )}

                ${unitSelect(
                    "duration-volume-unit",
                    [
                        {
                            value: "mL",
                            label: "mL"
                        },
                        {
                            value: "L",
                            label: "L"
                        }
                    ]
                )}

            </div>


            <div class="calculator-row">

                ${numberInput(
                    "duration-rate",
                    "Velocità di infusione",
                    "es. 125"
                )}

                ${unitSelect(
                    "duration-rate-unit",
                    [
                        {
                            value: "mL/h",
                            label: "mL/h"
                        },
                        {
                            value: "mL/min",
                            label: "mL/min"
                        }
                    ]
                )}

            </div>


            <button
                id="calculate-duration"
                type="button"
            >
                Calcola
            </button>


            <div
                id="duration-result"
                class="calculator-result"
            ></div>

        </div>

    `;

}
/* =========================================================
   GOCCE / MINUTO
========================================================= */

function renderDropsCalculator() {

    return `
        <div class="calculator">

            <div class="calculator-grid">

                <!-- VOLUME -->

                <div class="calculator-field">

                    <label for="drops-volume">
                        Volume
                    </label>

                    <input
                        type="text"
                        id="drops-volume"
                        inputmode="decimal"
                        placeholder="Es. 500"
                    >

                    <select id="drops-volume-unit">

                        <option value="mL">
                            mL
                        </option>

                        <option value="L">
                            L
                        </option>

                    </select>

                </div>


                <!-- DURATA -->

                <div class="calculator-field">

                    <label for="drops-duration">
                        Durata
                    </label>

                    <input
                        type="text"
                        id="drops-duration"
                        inputmode="decimal"
                        placeholder="Es. 4"
                    >

                    <select id="drops-duration-unit">

                        <option value="min">
                            min
                        </option>

                        <option value="h">
                            ore
                        </option>

                    </select>

                </div>


                <!-- VELOCITÀ -->

                <div class="calculator-field">

                    <label for="drops-rate">
                        Velocità infusione
                    </label>

                    <input
                        type="text"
                        id="drops-rate"
                        inputmode="decimal"
                        placeholder="Es. 125"
                    >

                    <select id="drops-rate-unit">

                        <option value="gocce-10">
                            gocce/min — fattore 10
                        </option>

                        <option value="gocce-15">
                            gocce/min — fattore 15
                        </option>

                        <option value="gocce-20" selected>
                            gocce/min — fattore 20
                        </option>

                        <option value="gocce-60">
                            gocce/min — fattore 60
                        </option>

                        <option value="mL/h">
                            mL/h
                        </option>

                        <option value="mL/min">
                            mL/min
                        </option>

                    </select>

                </div>

            </div>


            <div class="calculator-formula">

                <strong>
                    Volume = Velocità × Durata
                </strong>
                <br>
                Compila due campi: il terzo si calcola da solo.
                Per cambiare un valore basta riscriverlo.

            </div>


            <div
                id="drops-result"
                class="calculator-result"
                style="display:none;"
            ></div>


            ${calculatorNote()}

        </div>
    `;

}
/* =========================================================
   CONVERSIONE VOLUME → mL
========================================================= */

function volumeToMl(value, unit) {

    if (String(unit).toLowerCase() === "l") {
        return value * 1000;
    }

    return value;
}


/* =========================================================
   CONVERSIONE TEMPO → MINUTI
========================================================= */

function timeToMinutes(value, unit) {

    if (unit === "h") {
        return value * 60;
    }

    return value;
}


/* =========================================================
   CONVERSIONE PESO → mg
========================================================= */

function massToMg(value, unit) {

    switch (unit) {

        case "mcg":
            return value / 1000;

        case "mg":
            return value;

        case "g":
            return value * 1000;

        default:
            return NaN;
    }
}


/* =========================================================
   CONCENTRAZIONE → mg/mL
========================================================= */

function concentrationToMgMl(
    quantity,
    quantityUnit,
    volume,
    volumeUnit
) {

    if (
        !Number.isFinite(quantity) ||
        !Number.isFinite(volume) ||
        quantity <= 0 ||
        volume <= 0
    ) {
        return NaN;
    }

    const quantityMg =
        massToMg(
            quantity,
            quantityUnit
        );

    const volumeMl =
        volumeToMl(
            volume,
            volumeUnit
        );

    if (
        !Number.isFinite(quantityMg) ||
        !Number.isFinite(volumeMl) ||
        volumeMl <= 0
    ) {
        return NaN;
    }

    return quantityMg / volumeMl;
}


/* =========================================================
   CONCENTRAZIONE PERCENTUALE → mg/mL
========================================================= */

/*
 * % m/V:
 *
 * 1% = 1 g / 100 mL
 * 1% = 1000 mg / 100 mL
 * 1% = 10 mg/mL
 */

function percentageToMgMl(percent) {

    if (
        !Number.isFinite(percent) ||
        percent <= 0
    ) {
        return NaN;
    }

    return percent * 10;
}


/* =========================================================
   CONCENTRAZIONE mg/mL → UNITÀ VISIBILE
========================================================= */

function formatConcentration(
    concentrationMgMl,
    weightUnit,
    volumeUnit
) {

    if (!Number.isFinite(concentrationMgMl)) {
        return "—";
    }

    let quantityMg;
    let volumeMl;

    switch (weightUnit) {

        case "mcg":
            quantityMg = concentrationMgMl * 1000;
            break;

        case "mg":
            quantityMg = concentrationMgMl;
            break;

        case "g":
            quantityMg = concentrationMgMl / 1000;
            break;

        default:
            return "—";
    }

    if (volumeUnit === "L") {

        quantityMg *= 1000;
        volumeMl = 1000;

    } else {

        volumeMl = 1;

    }

    let quantity;

    switch (weightUnit) {

        case "mcg":
            quantity = quantityMg;
            break;

        case "mg":
            quantity = quantityMg;
            break;

        case "g":
            quantity = quantityMg;
            break;

        default:
            return "—";
    }

    return `${formatNumber(quantity)} ${weightUnit}/${volumeUnit}`;
}


/* =========================================================
   CONVERSIONE RISULTATO CONCENTRAZIONE
========================================================= */

function mgMlToSelectedConcentration(
    concentrationMgMl,
    weightUnit,
    volumeUnit
) {

    let value;

    if (volumeUnit === "L") {

        switch (weightUnit) {

            case "mcg":
                value = concentrationMgMl * 1000 * 1000;
                break;

            case "mg":
                value = concentrationMgMl * 1000;
                break;

            case "g":
                value = concentrationMgMl;
                break;

            default:
                return NaN;
        }

    } else {

        switch (weightUnit) {

            case "mcg":
                value = concentrationMgMl * 1000;
                break;

            case "mg":
                value = concentrationMgMl;
                break;

            case "g":
                value = concentrationMgMl / 1000;
                break;

            default:
                return NaN;
        }
    }

    return value;
}


/* =========================================================
   RENDER CALCOLATORE
========================================================= */

function renderCalculator(id, title, data) {

    let calculatorHTML = "";

    if (id === "dose") {
        calculatorHTML = renderDoseCalculator();
    }
    else if (id === "diluizioni") {
        calculatorHTML = renderDilutionCalculator();
    }
    else if (id === "ml-h") {
        calculatorHTML = renderMlHCalculator();
       
    }
   else if (id === "gocce-min") {
    calculatorHTML = renderDropsCalculator();
    }
    else if (id === "durata-infusione") {
    calculatorHTML = renderDurationCalculator();
    }
    else {
        content.innerHTML = `
            <section class="detail-page">
                ${detailHeader(title, data)}

                <div class="detail-content">
                    <h3>Calcolatore non disponibile</h3>

                    <p>
                        Il calcolatore
                        <strong>${id}</strong>
                        non è stato riconosciuto.
                    </p>
                </div>
            </section>
        `;
        return;
    }

    content.innerHTML = `
        <section class="detail-page">
            ${detailHeader(title, data)}

            <div class="detail-content">
                ${calculatorHTML}
            </div>
        </section>
    `;

    attachCalculatorEvents(id);
}

function attachCalculatorEvents(id) {


    /* =====================================================
       DOSE
    ===================================================== */

    if (id === "dose") {

        const modeInputs =
            document.querySelectorAll(
                'input[name="dose-mode"]'
            );

        const concentrationFields =
            document.getElementById(
                "dose-concentration-fields"
            );

        const percentageField =
            document.getElementById(
                "dose-percentage-field"
            );


        function updateDoseMode() {

            const mode =
                document.querySelector(
                    'input[name="dose-mode"]:checked'
                )?.value;

            if (mode === "percentage") {

                concentrationFields.style.display =
                    "none";

                percentageField.style.display =
                    "block";

            } else {

                concentrationFields.style.display =
                    "block";

                percentageField.style.display =
                    "none";
            }
        }


        modeInputs.forEach(input => {

            input.addEventListener(
                "change",
                updateDoseMode
            );

        });


        updateDoseMode();


        document
            .getElementById("calculate-dose")
            ?.addEventListener(
                "click",
                () => {

                    const dose =
                        parseItalianNumber(
                            document.getElementById(
                                "dose-prescribed"
                            ).value
                        );


                    const doseUnit =
                        document.getElementById(
                            "dose-prescribed-unit"
                        ).value;


                    if (
                        !Number.isFinite(dose) ||
                        dose <= 0
                    ) {

                        showResult(
                            "dose-result",
                            "Controlla la dose prescritta."
                        );

                        return;
                    }


                    const doseMg =
                        massToMg(
                            dose,
                            doseUnit
                        );


                    const mode =
                        document.querySelector(
                            'input[name="dose-mode"]:checked'
                        )?.value;


                    let concentrationMgMl;


                    /* -------------------------------------
                       QUANTITÀ / VOLUME
                    ------------------------------------- */

                    if (mode === "quantity") {

                        const quantity =
                            parseItalianNumber(
                                document.getElementById(
                                    "dose-concentration"
                                ).value
                            );


                        const quantityUnit =
                            document.getElementById(
                                "dose-concentration-unit"
                            ).value;


                        const volume =
                            parseItalianNumber(
                                document.getElementById(
                                    "dose-volume"
                                ).value
                            );


                        const volumeUnit =
                            document.getElementById(
                                "dose-volume-unit"
                            ).value;


                        concentrationMgMl =
                            concentrationToMgMl(
                                quantity,
                                quantityUnit,
                                volume,
                                volumeUnit
                            );

                    }


                    /* -------------------------------------
                       PERCENTUALE
                    ------------------------------------- */

                    if (mode === "percentage") {

                        const percent =
                            parseItalianNumber(
                                document.getElementById(
                                    "dose-percent"
                                ).value
                            );


                        concentrationMgMl =
                            percentageToMgMl(
                                percent
                            );

                    }


                    if (
                        !Number.isFinite(
                            concentrationMgMl
                        ) ||
                        concentrationMgMl <= 0
                    ) {

                        showResult(
                            "dose-result",
                            "Controlla concentrazione e unità di misura."
                        );

                        return;
                    }


                    const resultMl =
                        doseMg /
                        concentrationMgMl;


                    let resultText =
                        `Volume da somministrare: ${formatNumber(
                            resultMl
                        )} mL`;


                    if (mode === "percentage") {

                        const percent =
                            parseItalianNumber(
                                document.getElementById(
                                    "dose-percent"
                                ).value
                            );


                        resultText +=
                            ` — concentrazione ${formatNumber(
                                percent
                            )} % m/V`;

                    }


                    showResult(
                        "dose-result",
                        resultText
                    );

                }
            );
    }


    /* =====================================================
       DILUIZIONI
    ===================================================== */

    if (id === "diluizioni") {

    const c1Input = document.getElementById("dilution-c1");
    const c1Unit = document.getElementById("dilution-c1-unit");

    const v1Input = document.getElementById("dilution-v1");
    const v1Unit = document.getElementById("dilution-v1-unit");

    const c2Input = document.getElementById("dilution-c2");
    const c2Unit = document.getElementById("dilution-c2-unit");

    const v2Input = document.getElementById("dilution-v2");
    const v2Unit = document.getElementById("dilution-v2-unit");

    const calculateButton =
        document.getElementById("dilution-calculate");

    const resetButton =
        document.getElementById("dilution-reset");

    const result =
        document.getElementById("dilution-result");


    function dilutionToMgMl(value, unit) {

        if (unit === "mg/ml") {
            return value;
        }

        if (unit === "g/ml") {
            return value * 1000;
        }

        if (unit === "%") {
            return value * 10;
        }

        return NaN;
    }


    function dilutionFromMgMl(value, unit) {

        if (unit === "mg/ml") {
            return value;
        }

        if (unit === "g/ml") {
            return value / 1000;
        }

        if (unit === "%") {
            return value / 10;
        }

        return NaN;
    }


    calculateButton.addEventListener("click", () => {

        const c1 = c1Input.value.trim() !== "";
        const v1 = v1Input.value.trim() !== "";
        const c2 = c2Input.value.trim() !== "";
        const v2 = v2Input.value.trim() !== "";

        const filled =
            [c1, v1, c2, v2].filter(Boolean).length;


        // Meno di 3 valori
        if (filled < 3) {

            result.innerHTML = `
                <strong>Dati insufficienti</strong>
                <p>
                    Inserisci 3 valori e lascia vuoto quello
                    che vuoi calcolare.
                </p>
            `;

            result.style.display = "block";
            return;
        }


        // Tutti e 4 compilati
        if (filled === 4) {

            result.innerHTML = `
                <strong>Lascia un campo vuoto</strong>
                <p>
                    Inserisci 3 valori e lascia vuoto quello
                    che vuoi calcolare.
                </p>
            `;

            result.style.display = "block";
            return;
        }


        // Leggiamo i numeri
        const c1Value = c1
            ? parseItalianNumber(c1Input.value)
            : null;

        const v1Value = v1
            ? parseItalianNumber(v1Input.value)
            : null;

        const c2Value = c2
            ? parseItalianNumber(c2Input.value)
            : null;

        const v2Value = v2
            ? parseItalianNumber(v2Input.value)
            : null;


        // Conversione concentrazioni in mg/mL
        const c1MgMl = c1
            ? dilutionToMgMl(c1Value, c1Unit.value)
            : null;

        const c2MgMl = c2
            ? dilutionToMgMl(c2Value, c2Unit.value)
            : null;


        // Conversione volumi in mL
        const v1Ml = v1
            ? volumeToMl(v1Value, v1Unit.value)
            : null;

        const v2Ml = v2
            ? volumeToMl(v2Value, v2Unit.value)
            : null;


        // Validazione: numeri validi e positivi, unità riconosciute
        const given = [
            [c1, c1MgMl], [c2, c2MgMl], [v1, v1Ml], [v2, v2Ml]
        ].filter(([filledField]) => filledField).map(([, value]) => value);

        if (!given.every(value => Number.isFinite(value) && value > 0)) {

            result.innerHTML = `
                <strong>Controlla i valori inseriti</strong>
                <p>
                    Usa numeri maggiori di zero (es. 2,5 oppure 1.500).
                </p>
            `;

            result.style.display = "block";
            return;
        }


        // CALCOLA C1
        if (!c1) {

            const calculated =
                (c2MgMl * v2Ml) / v1Ml;

            const finalValue =
                dilutionFromMgMl(calculated, c1Unit.value);

            c1Input.value =
                formatNumber(finalValue);

            result.innerHTML = `
                <strong>C1 calcolata</strong>
                <p>
                    C1 =
                    <strong>
                        ${formatNumber(finalValue)}
                        ${c1Unit.value}
                    </strong>
                </p>
            `;
        }


        // CALCOLA V1
        else if (!v1) {

            const calculated =
                (c2MgMl * v2Ml) / c1MgMl;

            const finalValue =
                v1Unit.value.toLowerCase() === "l"
                    ? calculated / 1000
                    : calculated;

            v1Input.value =
                formatNumber(finalValue);

            result.innerHTML = `
                <strong>V1 calcolato</strong>
                <p>
                    V1 =
                    <strong>
                        ${formatNumber(finalValue)}
                        ${volumeLabel(v1Unit.value)}
                    </strong>
                </p>
            `;
        }


        // CALCOLA C2
        else if (!c2) {

            const calculated =
                (c1MgMl * v1Ml) / v2Ml;

            const finalValue =
                dilutionFromMgMl(calculated, c2Unit.value);

            c2Input.value =
                formatNumber(finalValue);

            result.innerHTML = `
                <strong>C2 calcolata</strong>
                <p>
                    C2 =
                    <strong>
                        ${formatNumber(finalValue)}
                        ${c2Unit.value}
                    </strong>
                </p>
            `;
        }


        // CALCOLA V2
        else if (!v2) {

            const calculated =
                (c1MgMl * v1Ml) / c2MgMl;

            const finalValue =
                v2Unit.value.toLowerCase() === "l"
                    ? calculated / 1000
                    : calculated;

            v2Input.value =
                formatNumber(finalValue);

            result.innerHTML = `
                <strong>V2 calcolato</strong>
                <p>
                    V2 =
                    <strong>
                        ${formatNumber(finalValue)}
                        ${volumeLabel(v2Unit.value)}
                    </strong>
                </p>
            `;
        }


        result.style.display = "block";

    });


    resetButton.addEventListener("click", () => {

        c1Input.value = "";
        v1Input.value = "";
        c2Input.value = "";
        v2Input.value = "";

        result.innerHTML = "";
        result.style.display = "none";

    });

}
    /* =====================================================
       VELOCITÀ DI INFUSIONE
    ===================================================== */

    if (id === "ml-h") {

        document
            .getElementById("calculate-mlh")
            ?.addEventListener(
                "click",
                () => {

                    const volume =
                        parseItalianNumber(
                            document.getElementById(
                                "infusion-volume"
                            ).value
                        );


                    const volumeUnit =
                        document.getElementById(
                            "infusion-volume-unit"
                        ).value;


                    const time =
                        parseItalianNumber(
                            document.getElementById(
                                "infusion-time"
                            ).value
                        );


                    const timeUnit =
                        document.getElementById(
                            "infusion-time-unit"
                        ).value;


                    if (
                        !Number.isFinite(volume) ||
                        !Number.isFinite(time) ||
                        volume <= 0 ||
                        time <= 0
                    ) {

                        showResult(
                            "mlh-result",
                            "Controlla i valori inseriti."
                        );

                        return;
                    }


                    const volumeMl =
                        volumeToMl(
                            volume,
                            volumeUnit
                        );


                    const minutes =
                        timeToMinutes(
                            time,
                            timeUnit
                        );


                    const mlPerHour =
                        volumeMl /
                        (minutes / 60);


                    const lPerHour =
                        mlPerHour / 1000;


                    showResult(
                        "mlh-result",
                        `${formatNumber(
                            mlPerHour
                        )} mL/h — ${formatNumber(
                            lPerHour
                        )} L/h`
                    );

                }
            );
    }
/* =====================================================
   DURATA DELL'INFUSIONE
===================================================== */

if (id === "durata-infusione") {

    document
        .getElementById("calculate-duration")
        ?.addEventListener(
            "click",
            () => {

                const volume =
                    parseItalianNumber(
                        document.getElementById(
                            "duration-volume"
                        ).value
                    );


                const volumeUnit =
                    document.getElementById(
                        "duration-volume-unit"
                    ).value;


                const rate =
                    parseItalianNumber(
                        document.getElementById(
                            "duration-rate"
                        ).value
                    );


                const rateUnit =
                    document.getElementById(
                        "duration-rate-unit"
                    ).value;


                if (
                    !Number.isFinite(volume) ||
                    !Number.isFinite(rate) ||
                    volume <= 0 ||
                    rate <= 0
                ) {

                    showResult(
                        "duration-result",
                        "Controlla i valori inseriti."
                    );

                    return;
                }


                const volumeMl =
                    volumeToMl(
                        volume,
                        volumeUnit
                    );


                let rateMlHour;


                if (rateUnit === "mL/min") {

                    rateMlHour =
                        rate * 60;

                } else {

                    rateMlHour =
                        rate;

                }


                const durationHours =
                    volumeMl /
                    rateMlHour;


                const durationMinutes =
                    durationHours * 60;


                showResult(
                    "duration-result",
                    `Durata: ${formatDuration(
                        durationMinutes
                    )} — ${formatNumber(
                        durationHours
                    )} ore`
                );

            }
        );

}

    /* =====================================================
       GOCCE
    ===================================================== */

 if (id === "gocce-min") {

    const volumeInput =
        document.getElementById("drops-volume");

    const volumeUnit =
        document.getElementById("drops-volume-unit");

    const durationInput =
        document.getElementById("drops-duration");

    const durationUnit =
        document.getElementById("drops-duration-unit");

    const rateInput =
        document.getElementById("drops-rate");

    const rateUnit =
        document.getElementById("drops-rate-unit");

    const result =
        document.getElementById("drops-result");


    /*
     * Memorizza quale campo è stato calcolato
     */

    let calculatedField = null;


    /*
     * Restituisce il fattore gocce
     */

    function getDropFactor() {

        switch (rateUnit.value) {

            case "gocce-10":
                return 10;

            case "gocce-15":
                return 15;

            case "gocce-20":
                return 20;

            case "gocce-60":
                return 60;

            default:
                return null;

        }

    }


    /*
     * Restituisce l'unità visualizzata
     */

    function getRateLabel() {

        switch (rateUnit.value) {

            case "gocce-10":
            case "gocce-15":
            case "gocce-20":
            case "gocce-60":
                return "gocce/min";

            case "mL/min":
                return "mL/min";

            case "mL/h":
                return "mL/h";

            default:
                return "";

        }

    }


    /*
     * CALCOLO AUTOMATICO
     */

    /*
     * Logica: contano i DUE campi modificati per ultimi dall'utente;
     * il terzo viene calcolato. Così si può correggere qualunque valore
     * (anche dopo un calcolo) senza dover svuotare i campi a mano.
     */

    const fields = {
        volume: volumeInput,
        duration: durationInput,
        rate: rateInput
    };

    let touched = [];   // ordine di modifica manuale, l'ultimo è il più recente

    const clearResult = () => {
        result.style.display = "none";
        result.innerHTML = "";
    };

    const showMessage = text => {
        result.style.display = "block";
        result.innerHTML = `<strong>${text}</strong>`;
    };

    const readField = name => {
        const raw = fields[name].value.trim();
        if (!raw) return NaN;
        const number = parseItalianNumber(raw);
        return Number.isFinite(number) && number > 0 ? number : NaN;
    };

    function calculateAutomatically() {

        // Un campo svuotato o non più valido esce dai valori "dell'utente".
        touched = touched.filter(name => fields[name].value.trim() !== "");

        if (calculatedField && touched.length < 2) {
            fields[calculatedField].value = "";
            calculatedField = null;
        }

        if (touched.length < 2) {
            clearResult();
            return;
        }

        const [first, second] = touched.slice(-2);
        const target = Object.keys(fields).find(
            name => name !== first && name !== second
        );

        if (Number.isNaN(readField(first)) || Number.isNaN(readField(second))) {

            if (calculatedField) {
                fields[calculatedField].value = "";
                calculatedField = null;
            }

            showMessage("Controlla i valori: usa numeri maggiori di zero (es. 2,5).");
            return;
        }

        const volumeMl = target === "volume" ? null :
            volumeToMl(readField("volume"), volumeUnit.value);

        const durationMin = target === "duration" ? null :
            timeToMinutes(readField("duration"), durationUnit.value);

        let rateMlMin = null;

        if (target !== "rate") {
            const rate = readField("rate");

            if (rateUnit.value.startsWith("gocce-")) {
                rateMlMin = rate / getDropFactor();
            } else if (rateUnit.value === "mL/h") {
                rateMlMin = rate / 60;
            } else {
                rateMlMin = rate;
            }
        }

        let label;
        let text;

        if (target === "volume") {

            const ml = rateMlMin * durationMin;
            const value = volumeUnit.value === "L" ? ml / 1000 : ml;

            volumeInput.value = formatNumber(value);
            label = "Volume calcolato";
            text = `${formatNumber(value)} ${volumeUnit.value}`;

        } else if (target === "duration") {

            const min = volumeMl / rateMlMin;
            const value = durationUnit.value === "h" ? min / 60 : min;

            durationInput.value = formatNumber(value);
            label = "Durata calcolata";
            text = `${formatNumber(value)} ${durationUnit.value === "h" ? "ore" : "min"}`
                + ` (${formatDuration(min)})`;

        } else {

            const mlMin = volumeMl / durationMin;
            let value = mlMin;

            if (rateUnit.value.startsWith("gocce-")) {
                value = mlMin * getDropFactor();
            } else if (rateUnit.value === "mL/h") {
                value = mlMin * 60;
            }

            rateInput.value = formatNumber(value);
            label = "Velocità calcolata";
            text = `${formatNumber(value)} ${getRateLabel()}`
                + (rateUnit.value.startsWith("gocce-")
                    ? ` (${formatNumber(mlMin * 60)} mL/h)`
                    : "");
        }

        calculatedField = target;

        result.style.display = "block";
        result.innerHTML = `${label}: <strong>${text}</strong>`;
    }


    /*
     * INPUT AUTOMATICI
     */

    Object.entries(fields).forEach(([name, input]) => {

        input.addEventListener("input", () => {

            if (calculatedField === name) {
                calculatedField = null;
            }

            touched = touched.filter(item => item !== name);

            if (input.value.trim() !== "") {
                touched.push(name);
            }

            calculateAutomatically();
        });
    });

    [volumeUnit, durationUnit, rateUnit].forEach(select =>
        select.addEventListener("change", calculateAutomatically)
    );

}


}
/* =========================================================
   CAMPI DINAMICI GOCCE
========================================================= */

function updateDropsFields() {

    const target =
        document.querySelector(
            'input[name="drops-target"]:checked'
        )?.value;


    const container =
        document.getElementById(
            "drops-fields"
        );


    if (!container) {
        return;
    }


    /* -------------------------------------
       CALCOLARE GOCCE/MIN
    ------------------------------------- */

    if (target === "rate") {

        container.innerHTML = `

            <div class="calculator-row">

                ${numberInput(
                    "drops-time",
                    "Tempo",
                    "es. 2"
                )}

                ${unitSelect(
                    "drops-time-unit",
                    [
                        {
                            value: "min",
                            label: "minuti"
                        },
                        {
                            value: "h",
                            label: "ore"
                        }
                    ]
                )}

            </div>


            <div class="calculator-row">

                ${numberInput(
                    "drop-factor",
                    "Fattore di gocciolamento",
                    "es. 20"
                )}

                <span class="unit-static">
                    gocce/mL
                </span>

            </div>

        `;

    }


    /* -------------------------------------
       CALCOLARE DURATA
    ------------------------------------- */

    if (target === "duration") {

        container.innerHTML = `

            <div class="calculator-row">

                ${numberInput(
                    "drops-rate",
                    "Velocità",
                    "es. 20"
                )}

                <span class="unit-static">
                    gocce/min
                </span>

            </div>


            <div class="calculator-row">

                ${numberInput(
                    "drop-factor",
                    "Fattore di gocciolamento",
                    "es. 20"
                )}

                <span class="unit-static">
                    gocce/mL
                </span>

            </div>

        `;

    }


    /* -------------------------------------
       CALCOLARE FATTORE
    ------------------------------------- */

    if (target === "factor") {

        container.innerHTML = `

            <div class="calculator-row">

                ${numberInput(
                    "drops-time",
                    "Tempo",
                    "es. 2"
                )}

                ${unitSelect(
                    "drops-time-unit",
                    [
                        {
                            value: "min",
                            label: "minuti"
                        },
                        {
                            value: "h",
                            label: "ore"
                        }
                    ]
                )}

            </div>


            <div class="calculator-row">

                ${numberInput(
                    "drops-rate",
                    "Velocità",
                    "es. 20"
                )}

                <span class="unit-static">
                    gocce/min
                </span>

            </div>

        `;

    }

}


/* =========================================================
   CALCOLO GOCCE
========================================================= */

function calculateDrops() {

    const volume =
        parseItalianNumber(
            document.getElementById(
                "drops-volume"
            ).value
        );


    const volumeUnit =
        document.getElementById(
            "drops-volume-unit"
        ).value;


    const target =
        document.querySelector(
            'input[name="drops-target"]:checked'
        )?.value;


    if (
        !Number.isFinite(volume) ||
        volume <= 0
    ) {

        showResult(
            "drops-result",
            "Controlla il volume inserito."
        );

        return;
    }


    const volumeMl =
        volumeToMl(
            volume,
            volumeUnit
        );


    /* -------------------------------------
       GOCCE/MIN
    ------------------------------------- */

    if (target === "rate") {

        const time =
            parseItalianNumber(
                document.getElementById(
                    "drops-time"
                ).value
            );


        const timeUnit =
            document.getElementById(
                "drops-time-unit"
            ).value;


        const factor =
            parseItalianNumber(
                document.getElementById(
                    "drop-factor"
                ).value
            );


        if (
            !Number.isFinite(time) ||
            !Number.isFinite(factor) ||
            time <= 0 ||
            factor <= 0
        ) {

            showResult(
                "drops-result",
                "Controlla tempo e fattore di gocciolamento."
            );

            return;
        }


        const minutes =
            timeToMinutes(
                time,
                timeUnit
            );


        const rate =
            (
                volumeMl *
                factor
            ) /
            minutes;


        showResult(
            "drops-result",
            `${formatNumber(
                rate
            )} gocce/min`
        );


        return;
    }


    /* -------------------------------------
       DURATA
    ------------------------------------- */

    if (target === "duration") {

        const rate =
            parseItalianNumber(
                document.getElementById(
                    "drops-rate"
                ).value
            );


        const factor =
            parseItalianNumber(
                document.getElementById(
                    "drop-factor"
                ).value
            );


        if (
            !Number.isFinite(rate) ||
            !Number.isFinite(factor) ||
            rate <= 0 ||
            factor <= 0
        ) {

            showResult(
                "drops-result",
                "Controlla velocità e fattore."
            );

            return;
        }


        const minutes =
            (
                volumeMl *
                factor
            ) /
            rate;


        const hours =
            minutes / 60;


        showResult(
            "drops-result",
            `Durata: ${formatDuration(
                minutes
            )} — ${formatNumber(
                hours
            )} ore`
        );


        return;
    }


    /* -------------------------------------
       FATTORE
    ------------------------------------- */

    if (target === "factor") {

        const time =
            parseItalianNumber(
                document.getElementById(
                    "drops-time"
                ).value
            );


        const timeUnit =
            document.getElementById(
                "drops-time-unit"
            ).value;


        const rate =
            parseItalianNumber(
                document.getElementById(
                    "drops-rate"
                ).value
            );


        if (
            !Number.isFinite(time) ||
            !Number.isFinite(rate) ||
            time <= 0 ||
            rate <= 0
        ) {

            showResult(
                "drops-result",
                "Controlla tempo e velocità."
            );

            return;
        }


        const minutes =
            timeToMinutes(
                time,
                timeUnit
            );


        const factor =
            (
                rate *
                minutes
            ) /
            volumeMl;


        showResult(
            "drops-result",
            `Fattore necessario: ${formatNumber(
                factor
            )} gocce/mL`
        );

    }

}


/* =========================================================
   VALIDAZIONE
========================================================= */

function validNumber(value) {

    return Number.isFinite(value);

}


/* =========================================================
   FORMATTA DURATA
========================================================= */

function formatDuration(totalMinutes) {

    if (
        !Number.isFinite(totalMinutes) ||
        totalMinutes < 0
    ) {
        return "—";
    }


    const rounded =
        Math.round(totalMinutes);


    const hours =
        Math.floor(
            rounded / 60
        );


    const minutes =
        rounded % 60;


    if (hours === 0) {

        return `${minutes} min`;

    }


    if (minutes === 0) {

        return `${hours} h`;

    }


    return `${hours} h ${minutes} min`;

}


/* =========================================================
   MOSTRA RISULTATO
========================================================= */

function showResult(id, text) {

    const element =
        document.getElementById(id);


    if (element) {

        element.textContent = text;

    }

}


/* =========================================================
   FORMATTA NUMERI
========================================================= */

function formatNumber(number) {

    const value = Number(number);

    if (!Number.isFinite(value)) {
        return "—";
    }

    // Sotto 1 si mantengono 3 cifre significative: 0,125 resta 0,125 e
    // 0,005 non diventa 0,01. Da 1 in su bastano 2 decimali.
    const options = Math.abs(value) > 0 && Math.abs(value) < 1
        ? { maximumSignificantDigits: 3 }
        : { maximumFractionDigits: 2 };

    return value.toLocaleString("it-IT", options);

}

function volumeLabel(unit) {
    return String(unit).toLowerCase() === "l" ? "L" : "mL";
}


/* =========================================================
   EDITOR LOCALE
========================================================= */

function applyLocalOverride(stateId, data) {

    try {

        const saved =
            localStorage.getItem(
                `nursing-nfc-${stateId}`
            );


        if (!saved) {

            return data;

        }


        const localData =
            JSON.parse(saved);


        return localData;

    }

    catch (error) {

        console.error(
            "Errore caricamento dati locali:",
            error
        );

        return data;

    }

}


/* =========================================================
   CODIFICA CONDIVISIONE
========================================================= */

function toBase64(value) {

    const bytes =
        new TextEncoder().encode(
            String(value ?? "")
        );

    let binary = "";

    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }

    return btoa(binary);
}

function fromBase64(value) {

    const binary =
        atob(String(value || ""));

    const bytes =
        Uint8Array.from(
            binary,
            char => char.charCodeAt(0)
        );

    return new TextDecoder().decode(bytes);
}

function createSharePayload(type, data) {

    return [
        "NS2",
        toBase64(type),
        toBase64(JSON.stringify(data))
    ].join("|");
}

function buildShareUrl(type, data) {

    return window.location.origin +
        window.location.pathname +
        "?share=" +
        encodeURIComponent(
            createSharePayload(type, data)
        );
}


/* =========================================================
   LETTURA CONDIVISIONE
========================================================= */



function readSharePayload() {

    const searchParams =
        new URLSearchParams(window.location.search);

    const queryPayload =
        searchParams.get("share");

    const hash =
        window.location.hash || "";

    let encodedPayload = queryPayload || "";

    if (
        !encodedPayload &&
        hash.startsWith("#nursing-share=")
    ) {
        encodedPayload =
            hash.slice("#nursing-share=".length);
    }

    if (!encodedPayload) {
        return null;
    }

    try {

        const payload =
            decodeURIComponent(encodedPayload);

        const parts =
            payload.split("|");

        if (
            parts.length !== 3 ||
            parts[0] !== "NS2"
        ) {
            return null;
        }

        const type =
            fromBase64(parts[1]);

        const data =
            JSON.parse(
                fromBase64(parts[2])
            );

        return {
            type,
            data
        };

    } catch (error) {

        console.error(
            "Collegamento di condivisione non valido:",
            error
        );

        return null;

    }

}


/* =========================================================
   ROUTE CONDIVISIONE / PAZIENTI
========================================================= */



const incomingPersonalization =
    readSharePayload();

if (incomingPersonalization) {
    window.__incomingPersonalization =
        incomingPersonalization;
}

const patientsRoute =
    new URLSearchParams(window.location.search)
        .get("patients");

if (patientsRoute === "1") {
    document.body.classList.remove("home-page");
}


/* =========================================================
   FUNZIONI RIPRISTINATE
========================================================= */

function isOrderEditMode() {
    return orderEditMode;
}

function setupSettings() {

    const panel = document.getElementById("settingsPanel");
    const openButton = document.getElementById("settingsButton");
    const closeButton = document.getElementById("settingsClose");
    const orderButton = document.getElementById("orderModeButton");
    const resetButton = document.getElementById("resetOrderButton");
    const themeButton = document.getElementById("settingsThemeButton");
    const appNotesButton = document.getElementById("appNotesButton");
    const contactButton = document.getElementById("contactButton");
    const shareButton = document.getElementById("sharePersonalizationButton");
    const patientsButton = document.getElementById("patientsButton");
    const resetAllButton = document.getElementById("resetPersonalizationButton");
    const message = document.getElementById("settingsMessage");

    if (!panel || !openButton) return;

    const setMessage = text => {
        if (message) message.textContent = text;
    };

    const updateOrderControls = () => {
        if (resetButton) {
            resetButton.hidden = !orderEditMode;
        }
    };

    updateOrderControls();

    openButton.addEventListener("click", () => {
        updateOrderControls();
        panel.hidden = false;
    });

    closeButton?.addEventListener("click", () => {
        panel.hidden = true;
    });

    panel.addEventListener("click", event => {
        if (event.target === panel) panel.hidden = true;
    });

    orderButton?.addEventListener("click", () => {
        orderEditMode = !orderEditMode;
        document.body.classList.toggle("order-editing", orderEditMode);

        orderButton.textContent =
            orderEditMode
                ? "✅ Fine modifica ordine"
                : "↕️ Modifica ordine";

        updateOrderControls();

        setMessage(
            orderEditMode
                ? "Modalità modifica attiva: usa i pulsanti ↑ e ↓."
                : "Ordine salvato."
        );

        panel.hidden = true;

        if (state) {
            loadState();
        } else {
            loadCategories();
        }
    });

    resetButton?.addEventListener("click", () => {
        resetOrderPreferences();

        setMessage("↩️ Ordini ripristinati.");

        if (panel) panel.hidden = false;

        if (patientsRoute === "1") {
            renderPatientsPage(patientRouteId, false);
        } else if (state) {
            loadState();
        } else {
            loadCategories();
        }
    });

    appNotesButton?.addEventListener("click", () => {
        panel.hidden = true;
        window.location.href = "?appnotes=1";
    });

    contactButton?.addEventListener("click", () => {
        panel.hidden = true;
        window.location.href = "?contact=1";
    });

    function updateThemeButtonIcon() {
        const theme =
            document.documentElement.dataset.theme || "dark";

        if (themeButton) {
            themeButton.textContent =
                theme === "light"
                    ? "☀️ Tema"
                    : "🌙 Tema";
        }
    }

    updateThemeButtonIcon();

    themeButton?.addEventListener("click", () => {
        const current =
            document.documentElement.dataset.theme || "dark";

        applyTheme(current === "dark" ? "light" : "dark");
        updateThemeButtonIcon();
        setMessage("Tema aggiornato.");
    });

    shareButton?.addEventListener("click", () => {
        panel.hidden = true;
        showShareCenter();
    });

    patientsButton?.addEventListener("click", () => {
        panel.hidden = true;
        window.location.href = "?patients=1";
    });

    resetAllButton?.addEventListener("click", () => {
        const confirmed = window.confirm(
            "Ripristinare tutte le personalizzazioni locali? Note, ordini e tema verranno cancellati. I contenuti dell'archivio non verranno modificati."
        );

        if (!confirmed) return;

        resetAllPersonalization();

        setMessage("↩️ Personalizzazione ripristinata.");

        panel.hidden = false;

        if (state) {
            loadState();
        } else {
            loadCategories();
        }
    });
}


/* =========================================================
   NOTE GENERALI DELL'APP
   Note libere non legate a una sezione o scheda specifica.
========================================================= */

function getAppNotes() {
    try {
        const raw = JSON.parse(
            localStorage.getItem(PERSONALIZATION_KEYS.appNotes) || "[]"
        );

        if (!Array.isArray(raw)) return [];

        return raw
            .filter(note => note && typeof note === "object")
            .map(note => ({
                id: String(note.id || Date.now()),
                title: String(note.title || "Nota"),
                text: String(note.text || ""),
                createdAt: String(note.createdAt || ""),
                updatedAt: String(note.updatedAt || "")
            }));
    } catch (_) {
        return [];
    }
}

function saveAppNotes(notes) {
    localStorage.setItem(
        PERSONALIZATION_KEYS.appNotes,
        JSON.stringify(notes)
    );
}

function renderContactPage() {
    content.innerHTML = `
        <section class="detail-page contact-page">
            <div class="detail-header-row">
                <h2>📩 Contattami</h2>
            </div>

            <p class="personal-notes-context">
                Per domande, segnalazioni o suggerimenti puoi contattarmi tramite email.
            </p>

            <div class="contact-links">
                <a
                    class="settings-action"
                    href="mailto:svngrl99a11a494a@gmail.com"
                >✉️ Email</a>
            </div>
        </section>
    `;
}

function renderAppNotesPage() {
    const notes = getAppNotes();

    content.innerHTML = `
        <section class="detail-page app-notes-page">
            <div class="detail-header-row">
                <h2>📝 Note</h2>
                <a
                    class="home-button"
                    href="?links=1"
                    title="Collegamenti tra note"
                    aria-label="Collegamenti tra note"
                >🔗</a>
            </div>

            <p class="personal-notes-context">
                Appunti liberi.
            </p>

            <div class="app-notes-list">
                ${notes.length
                    ? notes.map(note => `
                        <article id="app-note-${escapeAttribute(note.id)}" class="app-note-card" data-app-note-id="${escapeAttribute(note.id)}">
                            <div class="app-note-card-header">
                                <h3>${renderNoteText(note.title || "Nota")}</h3>
                                <div class="personal-note-actions">
                                    <button class="app-note-edit" type="button" data-app-note-edit="${escapeAttribute(note.id)}" title="Modifica nota">✏️</button>
                                    <button class="app-note-delete" type="button" data-app-note-delete="${escapeAttribute(note.id)}" title="Elimina nota">🗑️</button>
                                </div>
                            </div>
                            <div class="app-note-text">${renderNoteText(note.text)}</div>
                        </article>
                    `).join("")
                    : `
                        <div class="personal-note-empty">
                            Nessuna nota.
                        </div>
                    `}
            </div>

            <div class="app-note-editor">
                <h3>➕ Nuova nota</h3>
                <input
                    id="appNoteTitle"
                    class="personal-note-title-input"
                    type="text"
                    autocomplete="off"
                    placeholder="Titolo della nota"
                >
                <textarea
                    id="appNoteInput"
                    class="personal-note-input"
                    placeholder="Scrivi un'idea, una modifica da fare o un promemoria..."
                    rows="7"
                ></textarea>
                <button id="saveAppNote" class="settings-action" type="button">💾 Aggiungi nota</button>
                <p id="appNoteMessage" class="personal-note-message"></p>
            </div>
        </section>
    `;
}

function setupAppNotes() {
    document.addEventListener("click", event => {
        const editButton = event.target.closest("[data-app-note-edit]");
        if (editButton) {
            const noteId = editButton.dataset.appNoteEdit || "";
            const note = getAppNotes().find(current =>
                String(current.id) === String(noteId)
            );

            if (!note) return;

            const editor = document.querySelector(".app-note-editor");
            const titleInput = document.getElementById("appNoteTitle");
            const input = document.getElementById("appNoteInput");
            const saveButton = document.getElementById("saveAppNote");

            if (!editor || !titleInput || !input) return;

            editor.dataset.editingId = String(note.id);
            titleInput.value = note.title || "";
            input.value = note.text || "";

            if (saveButton) {
                saveButton.textContent = "💾 Salva modifiche";
            }

            editor.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

            input.focus();
            input.setSelectionRange(
                input.value.length,
                input.value.length
            );
            return;
        }

        const deleteButton = event.target.closest("[data-app-note-delete]");
        if (deleteButton) {
            const noteId = deleteButton.dataset.appNoteDelete || "";
            const notes = getAppNotes().filter(note =>
                String(note.id) !== String(noteId)
            );

            saveAppNotes(notes);
            renderAppNotesPage();
            return;
        }

        if (event.target.closest("#saveAppNote")) {
            const titleInput = document.getElementById("appNoteTitle");
            const input = document.getElementById("appNoteInput");
            const editor = document.querySelector(".app-note-editor");

            if (!input) return;

            const textValue = input.value.trim();

            if (!textValue) {
                const message = document.getElementById("appNoteMessage");
                if (message) {
                    message.textContent = "✏️ Scrivi prima il testo della nota.";
                }
                return;
            }

            const notes = getAppNotes();
            const editingId = editor?.dataset.editingId || "";
            const now = new Date().toISOString();

            if (editingId) {
                const note = notes.find(current =>
                    String(current.id) === String(editingId)
                );

                if (note) {
                    note.title =
                        (titleInput?.value || "").trim() || "Nota";
                    note.text = textValue;
                    note.updatedAt = now;
                }

                saveAppNotes(notes);
                renderAppNotesPage();
                return;
            }

            notes.unshift({
                id: String(Date.now()) + "-" + Math.random().toString(36).slice(2, 8),
                title: (titleInput?.value || "").trim() || "Nota",
                text: textValue,
                createdAt: now,
                updatedAt: now
            });

            saveAppNotes(notes);
            renderAppNotesPage();
        }
    });
}

function getPersonalNotes() {
    try {
        const raw = JSON.parse(
            localStorage.getItem(PERSONALIZATION_KEYS.notes) || "{}"
        );

        const normalized = {};

        for (const [key, value] of Object.entries(raw)) {
            if (Array.isArray(value)) {
                normalized[key] = value
                    .filter(note => note && typeof note === "object")
                    .map(note => ({
                        id: String(note.id || Date.now()),
                        title: String(note.title || "Nota personale"),
                        text: String(note.text || "")
                    }));
            } else if (typeof value === "string" && value.trim()) {
                normalized[key] = [{
                    id: "legacy-" + Date.now(),
                    title: "Nota personale",
                    text: value
                }];
            }
        }

        return normalized;
    } catch (_) {
        return {};
    }
}

function savePersonalNotes(notes) {
    localStorage.setItem(
        PERSONALIZATION_KEYS.notes,
        JSON.stringify(notes)
    );
}

function getPersonalNoteKey(stateId, itemId) {
    return (stateId || "") + "::" + (itemId || "");
}

function getNotesForItem(stateId, itemId) {
    const notes = getPersonalNotes();
    return notes[getPersonalNoteKey(stateId, itemId)] || [];
}

function saveNotesForItem(stateId, itemId, itemNotes) {
    const notes = getPersonalNotes();
    const key = getPersonalNoteKey(stateId, itemId);

    if (itemNotes.length) {
        notes[key] = itemNotes;
    } else {
        delete notes[key];
    }

    savePersonalNotes(notes);
}

function escapeNoteText(value) {
    return escapeHtml(value)
        .replace(/\n/g, "<br>");
}

function extractPlaceorders(text) {
    const matches = [];
    const patterns = [
        /<placeorder>([\s\S]*?)<\/placeorder>/gi,
        /\[\[([\s\S]*?)\]\]/g
    ];

    for (const regex of patterns) {
        let match;

        while ((match = regex.exec(String(text || ""))) !== null) {
            const term = match[1].trim();

            if (
                term &&
                !matches.some(existing =>
                    normalizeLinkTerm(existing) ===
                    normalizeLinkTerm(term)
                )
            ) {
                matches.push(term);
            }
        }
    }

    return matches;
}

function getAllPersonalNoteRecords() {
    const notes = getPersonalNotes();
    const records = [];

    for (const [key, itemNotes] of Object.entries(notes)) {
        const separator = key.indexOf("::");
        if (separator === -1 || !Array.isArray(itemNotes)) continue;

        const stateId = key.slice(0, separator);
        const itemId = key.slice(separator + 2);

        itemNotes.forEach(note => {
            records.push({ stateId, itemId, note });
        });
    }

    return records;
}

function normalizeLinkTerm(value) {
    return String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("it-IT");
}

function getLinkedNoteRecords(term, sourceStateId, sourceItemId, sourceNoteId) {
    const normalized = normalizeLinkTerm(term);

    return getAllPersonalNoteRecords().filter(record => {
        if (
            record.stateId === sourceStateId &&
            record.itemId === sourceItemId &&
            String(record.note.id) === String(sourceNoteId)
        ) {
            return false;
        }

        return extractPlaceorders(
            String(record.note.title || "") + "\n" +
            String(record.note.text || "")
        ).some(
            linkedTerm => normalizeLinkTerm(linkedTerm) === normalized
        );
    });
}

function makeNoteUrl(stateId, itemId, noteId) {
    const params = new URLSearchParams();
    params.set("state", stateId);
    params.set("item", itemId);
    params.set("notes", "1");
    params.set("note", noteId);

    return "?" + params.toString();
}

function renderInlineNoteText(text) {
    const source = String(text || "");
    const pattern = /<placeorder>([\s\S]*?)<\/placeorder>|\[\[([\s\S]*?)\]\]/gi;
    let html = "";
    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(source)) !== null) {
        html += escapeNoteText(source.slice(lastIndex, match.index));

        const term = String(match[1] || match[2] || "").trim();

        if (term) {
            html += '<a class="personal-note-linked-term" href="?links=1&term=' +
                encodeURIComponent(term) +
                '" title="Visualizza i collegamenti di ' +
                escapeAttribute(term) +
                '">' +
                escapeHtml(term) +
                '</a>';
        }

        lastIndex = pattern.lastIndex;
    }

    html += escapeNoteText(source.slice(lastIndex));
    return html;
}

function parseNoteTableRow(line) {
    const source = String(line || "");
    const cells = [];
    let index = 0;

    while (index < source.length && /\s/.test(source[index])) index++;

    while (index < source.length) {
        if (source[index] !== "[") return null;

        // Una cella deve avere una chiusura "]". Le parentesi doppie
        // vengono lasciate al contenuto della cella: [ [[placeholder]] ].
        let end = index + 1;
        let depth = 0;
        let closingIndex = -1;

        for (; end < source.length; end++) {
            if (source[end] === "[" && source[end + 1] === "[") {
                depth++;
                end++;
                continue;
            }

            if (source[end] === "]" && source[end + 1] === "]" && depth > 0) {
                depth--;
                end++;
                continue;
            }

            if (source[end] === "]" && depth === 0) {
                closingIndex = end;
                break;
            }
        }

        if (closingIndex === -1) return null;

        const rawCell = source.slice(index + 1, closingIndex);
        cells.push(rawCell.trim());

        index = closingIndex + 1;

        let spaces = 0;
        while (index < source.length && /\s/.test(source[index])) {
            spaces++;
            index++;
        }

        if (index >= source.length) break;
        if (spaces === 0 || source[index] !== "[") return null;
    }

    return cells.length >= 2 ? cells : null;
}

function renderNoteTable(rows) {
    if (!Array.isArray(rows) || rows.length < 2) return "";

    const columnCount = rows[0].length;

    if (columnCount < 2 || rows.some(row => row.length !== columnCount)) {
        return "";
    }

    return '<div class="personal-note-table-wrapper"><table class="personal-note-table">' +
        '<thead><tr>' +
        rows[0].map(cell => '<th>' + renderInlineNoteText(cell) + '</th>').join("") +
        '</tr></thead>' +
        '<tbody>' +
        rows.slice(1).map(row =>
            '<tr>' +
            row.map(cell => '<td>' + renderInlineNoteText(cell) + '</td>').join("") +
            '</tr>'
        ).join("") +
        '</tbody></table></div>';
}

function renderNoteText(text, stateId = "", itemId = "", noteId = "") {
    const source = String(text || "");
    const lines = source.split(/\r?\n/);
    let html = "";
    let index = 0;

    while (index < lines.length) {
        const firstRow = parseNoteTableRow(lines[index]);

        if (firstRow) {
            const tableRows = [firstRow];
            let nextIndex = index + 1;

            while (nextIndex < lines.length) {
                const row = parseNoteTableRow(lines[nextIndex]);

                if (!row || row.length !== firstRow.length) break;

                tableRows.push(row);
                nextIndex++;
            }

            if (tableRows.length >= 2) {
                html += renderNoteTable(tableRows);

                if (nextIndex < lines.length) {
                    html += "<br>";
                }

                index = nextIndex;
                continue;
            }
        }

        html += renderInlineNoteText(lines[index]);

        if (index < lines.length - 1) {
            html += "<br>";
        }

        index++;
    }

    return html;
}

function renderPersonalNotesButton(stateId, itemId) {
    return `
        <a
            class="personal-notes-button"
            href="?state=${encodeURIComponent(stateId)}&item=${encodeURIComponent(itemId)}&notes=1"
        >
            <span>📝 Note personali</span>
            
        </a>
    `;
}

function getPatientShortcutText(patient) {
    const parts = [
        patient?.name,
        patient?.birthDate,
        patient?.age,
        patient?.room,
        patient?.bed,
        patient?.pathologies,
        patient?.admissionReason,
        patient?.allergies,
        patient?.medications,
        patient?.notes
    ];

    if (Array.isArray(patient?.pvHistory)) {
        for (const entry of patient.pvHistory) {
            parts.push(
                entry?.recordedAt,
                entry?.pa,
                entry?.fc,
                entry?.sat,
                entry?.temperature
            );
        }
    }

    return parts.filter(value => String(value || "").trim()).join("\n");
}

function makePatientUrl(patientId) {
    return "?patients=1&patient=" + encodeURIComponent(patientId);
}

function renderAllNoteLinksPage(termFilter = "") {
    const groups = new Map();

    function addShortcutSource(term, source) {
        const key = normalizeLinkTerm(term);

        if (!key) return;

        if (!groups.has(key)) {
            groups.set(key, { term, records: [] });
        }

        const group = groups.get(key);

        const alreadyExists = group.records.some(existing => {
            if (existing.type !== source.type) return false;

            if (source.type === "patient") {
                return existing.patient.id === source.patient.id;
            }

            if (source.type === "appnote") {
                return String(existing.note.id) === String(source.note.id);
            }

            return (
                existing.stateId === source.stateId &&
                existing.itemId === source.itemId &&
                String(existing.note.id) === String(source.note.id)
            );
        });

        if (!alreadyExists) {
            group.records.push(source);
        }
    }

    // Shortcut presenti nelle note personali, sia nel titolo sia nel testo.
    for (const record of getAllPersonalNoteRecords()) {
        for (const term of extractPlaceorders(
            String(record.note.title || "") + "\n" +
            String(record.note.text || "")
        )) {
            addShortcutSource(term, {
                type: "note",
                ...record
            });
        }
    }

    // Shortcut presenti nelle Note generali, sia nel titolo sia nel testo.
    for (const note of getAppNotes()) {
        for (const term of extractPlaceorders(
            String(note.title || "") + "\n" +
            String(note.text || "")
        )) {
            addShortcutSource(term, {
                type: "appnote",
                note
            });
        }
    }

    // Shortcut presenti in qualsiasi dato testuale del paziente.
    for (const patient of getPatients()) {
        for (const term of extractPlaceorders(
            getPatientShortcutText(patient)
        )) {
            addShortcutSource(term, {
                type: "patient",
                patient
            });
        }
    }

    let visibleGroups = Array.from(groups.values())
        .filter(group => group.records.length >= 1)
        .sort((a, b) =>
            normalizeLinkTerm(a.term).localeCompare(
                normalizeLinkTerm(b.term), "it"
            )
        );

    if (termFilter) {
        const normalizedFilter = normalizeLinkTerm(termFilter);
        visibleGroups = visibleGroups.filter(group =>
            normalizeLinkTerm(group.term) === normalizedFilter
        );
    }

    content.innerHTML = `
        <section class="detail-page personal-links-page">
            <div class="detail-header-row">
                <h2>🔗 Collegamenti tra note</h2>
            </div>
            <p class="personal-notes-context">
                Tutti i collegamenti creati con [[parola]], comprese le schede paziente.
            </p>
            ${termFilter ? `
                <div class="personal-note-filter">
                    Parola selezionata: <strong>${escapeHtml(termFilter)}</strong>
                    <a href="?links=1">Mostra tutti</a>
                </div>
            ` : ""}
            <div class="personal-note-index-list">
                ${visibleGroups.length
                    ? visibleGroups.map(group => `
                        <article class="personal-note-index-group">
                            <strong class="personal-note-index-term">${escapeHtml(group.term)}</strong>
                            <div class="personal-note-index-links">
                                ${group.records.map(record => record.type === "patient"
                                    ? `
                                        <a class="personal-note-index-link"
                                           href="${makePatientUrl(record.patient.id)}">
                                            <span>👤 Pazienti</span>
                                            <strong>${escapeHtml(record.patient.name || "Paziente senza nome")}</strong>
                                        </a>
                                    `
                                    : record.type === "appnote"
                                    ? `
                                        <a class="personal-note-index-link"
                                           href="?appnotes=1#app-note-${encodeURIComponent(record.note.id)}">
                                            <span>📝 Note</span>
                                            <strong>${escapeHtml(record.note.title || "Nota")}</strong>
                                        </a>
                                    `
                                    : `
                                        <a class="personal-note-index-link"
                                           href="${makeNoteUrl(record.stateId, record.itemId, record.note.id)}">
                                            <span>${escapeHtml(record.stateId)} › ${escapeHtml(record.itemId)}</span>
                                            <strong>${escapeHtml(record.note.title || "Nota personale")}</strong>
                                        </a>
                                    `
                                ).join("")}
                            </div>
                        </article>
                    `).join("")
                    : `<div class="personal-note-empty">${termFilter
                        ? "Nessun collegamento trovato per questa parola."
                        : "Non ci sono ancora parole presenti nelle note o nei pazienti."}</div>`
                }
            </div>
        </section>
    `;
}

function createNotesSharePayload(stateId, itemId, notes) {
    const noteParts = notes.map(note =>
        [
            toBase64(note.id || ""),
            toBase64(note.title || "Nota personale"),
            toBase64(note.text || "")
        ].join(".")
    );

    return [
        "NS1",
        toBase64(stateId),
        toBase64(itemId),
        noteParts.join(",")
    ].join("|");
}

function readNotesSharePayload() {
    const hash = window.location.hash || "";

    if (!hash.startsWith("#nursing-notes=")) {
        return null;
    }

    try {
        const payload = decodeURIComponent(
            hash.slice("#nursing-notes=".length)
        );

        const parts = payload.split("|");

        if (parts.length !== 4 || parts[0] !== "NS1") {
            return null;
        }

        const sharedStateId = fromBase64(parts[1]);
        const sharedItemId = fromBase64(parts[2]);

        const notes = parts[3]
            ? parts[3].split(",").map(part => {
                const fields = part.split(".");

                if (fields.length !== 3) {
                    return null;
                }

                return {
                    id: fromBase64(fields[0]),
                    title: fromBase64(fields[1]) || "Nota personale",
                    text: fromBase64(fields[2])
                };
            }).filter(Boolean)
            : [];

        if (!sharedStateId || !sharedItemId || !notes.length) {
            return null;
        }

        return {
            stateId: sharedStateId,
            itemId: sharedItemId,
            notes
        };
    } catch (error) {
        console.error("Collegamento note non valido:", error);
        return null;
    }
}

function buildNotesShareUrl(stateId, itemId, notes) {
    const payload = createNotesSharePayload(
        stateId,
        itemId,
        notes
    );

    return window.location.origin +
        window.location.pathname +
        "?state=" + encodeURIComponent(stateId) +
        "&item=" + encodeURIComponent(itemId) +
        "&notes=1" +
        "#nursing-notes=" +
        encodeURIComponent(payload);
}

function shareCurrentNotes(stateId, itemId) {
    const notes = getNotesForItem(stateId, itemId);

    if (!notes.length) {
        window.alert("Non ci sono note da condividere.");
        return;
    }

    const url = buildNotesShareUrl(stateId, itemId, notes);

    if (navigator.share) {
        navigator.share({
            title: "Note personali — Nursing Shot",
            text: "Note personali collegate",
            url
        }).catch(() => {});
        return;
    }

    navigator.clipboard?.writeText(url).then(() => {
        window.alert("Collegamento copiato. Puoi inviarlo al telefono o a un altro PC.");
    }).catch(() => {
        window.prompt("Copia questo collegamento:", url);
    });
}

function showNotesQr(stateId, itemId) {
    const notes = getNotesForItem(stateId, itemId);

    if (!notes.length) {
        window.alert("Non ci sono note da condividere.");
        return;
    }

    const url = buildNotesShareUrl(stateId, itemId, notes);
    const qrUrl =
        "https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=" +
        encodeURIComponent(url);

    const existing = document.getElementById("notesQrDialog");
    existing?.remove();

    const dialog = document.createElement("div");
    dialog.id = "notesQrDialog";
    dialog.className = "notes-qr-dialog";
    dialog.innerHTML = `
        <div class="notes-qr-card">
            <button class="notes-qr-close" type="button" aria-label="Chiudi">×</button>
            <h3>📱 Condividi tramite QR</h3>
            <p>Scansiona questo QR con il telefono per importare le note.</p>
            <img src="${qrUrl}" alt="QR per condividere le note personali">
            <button class="settings-action" type="button" id="copyNotesShareLink">🔗 Copia collegamento</button>
        </div>
    `;

    document.body.appendChild(dialog);

    dialog.querySelector(".notes-qr-close")?.addEventListener("click", () => {
        dialog.remove();
    });

    dialog.addEventListener("click", event => {
        if (event.target === dialog) dialog.remove();
    });

    dialog.querySelector("#copyNotesShareLink")?.addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(url);
            window.alert("Collegamento copiato.");
        } catch (_) {
            window.prompt("Copia questo collegamento:", url);
        }
    });
}

function getInternalNotesShareUrl(rawValue) {
    const value = String(rawValue || "").trim();

    if (!value) return null;

    try {
        const url = new URL(value, window.location.href);

        if (url.origin !== window.location.origin) return null;

        const hasShareQuery =
            url.searchParams.has("share");

        const hasShareHash =
            url.hash.startsWith("#nursing-notes=") ||
            url.hash.startsWith("#nursing-share=");

        if (!hasShareQuery && !hasShareHash) {
            return null;
        }

        return url.href;
    } catch (_) {
        return null;
    }
}

function closeNotesQrReader(dialog, stream, animationId) {
    if (animationId) cancelAnimationFrame(animationId);

    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }

    dialog?.remove();
}

async function readNotesQr() {
    if (!window.isSecureContext) {
        window.alert("La lettura QR richiede una connessione HTTPS.");
        return;
    }

    if (!("BarcodeDetector" in window)) {
        window.alert(
            "Questo browser non supporta la lettura QR integrata."
        );
        return;
    }

    try {
        const supportedFormats =
            await BarcodeDetector.getSupportedFormats();

        if (!supportedFormats.includes("qr_code")) {
            window.alert(
                "Questo browser non supporta la lettura dei QR code tramite fotocamera."
            );
            return;
        }
    } catch (_) {}

    document.getElementById("notesQrReaderDialog")?.remove();

    const dialog = document.createElement("div");
    dialog.id = "notesQrReaderDialog";
    dialog.className = "notes-qr-dialog";

    dialog.innerHTML = [
        '<div class="notes-qr-card notes-qr-reader-card">',
        '<button class="notes-qr-close" type="button" aria-label="Chiudi">×</button>',
        '<h3>📷 Leggi QR</h3>',
        '<p>Inquadra il QR delle note personali.</p>',
        '<video class="notes-qr-video" id="notesQrVideo" autoplay muted playsinline></video>',
        '<p id="notesQrReaderStatus" class="settings-message">Richiesta accesso alla fotocamera…</p>',
        '</div>'
    ].join("");

    document.body.appendChild(dialog);

    const video = dialog.querySelector("#notesQrVideo");
    const status = dialog.querySelector("#notesQrReaderStatus");

    let stream = null;
    let animationId = null;
    let stopped = false;

    const stop = () => {
        stopped = true;
        closeNotesQrReader(dialog, stream, animationId);
    };

    dialog.querySelector(".notes-qr-close")?.addEventListener("click", stop);

    dialog.addEventListener("click", event => {
        if (event.target === dialog) stop();
    });

    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: { ideal: "environment" }
            },
            audio: false
        });

        video.srcObject = stream;
        await video.play();

        status.textContent = "Fotocamera attiva. Inquadra il QR…";

        const detector = new BarcodeDetector({
            formats: ["qr_code"]
        });

        const scan = async () => {
            if (stopped) return;

            try {
                const results = await detector.detect(video);
                const result = results.find(current => current.rawValue);

                if (result?.rawValue) {
                    const internalUrl =
                        getInternalNotesShareUrl(result.rawValue);

                    if (internalUrl) {
                        stop();
                        window.location.href = internalUrl;
                        return;
                    }

                    status.textContent =
                        "QR non riconosciuto. Cerca un QR generato da Nursing Shot.";
                }
            } catch (_) {}

            if (!stopped) {
                animationId = requestAnimationFrame(scan);
            }
        };

        scan();

    } catch (error) {
        status.textContent =
            "Impossibile accedere alla fotocamera.";

        window.setTimeout(() => {
            if (dialog.isConnected) {
                closeNotesQrReader(dialog, stream, animationId);
            }
        }, 1600);

        console.error("Errore lettura QR:", error);
    }
}

function decodeNfcRecord(record) {
    if (!record) return "";

    if (typeof record.data === "string") {
        return record.data.trim();
    }

    if (!record.data) return "";

    try {
        const bytes = new Uint8Array(
            record.data.buffer,
            record.data.byteOffset,
            record.data.byteLength
        );

        if (record.recordType === "url") {
            if (!bytes.length) return "";

            const prefixes = {
                0x00: "",
                0x01: "http://www.",
                0x02: "https://www.",
                0x03: "http://",
                0x04: "https://",
                0x05: "tel:",
                0x06: "mailto:",
                0x0F: "news:",
                0x10: "telnet://",
                0x11: "imap:",
                0x12: "rtsp://",
                0x13: "urn:",
                0x14: "pop:",
                0x15: "sip:",
                0x16: "sips:",
                0x17: "tftp:",
                0x1D: "file://",
                0x23: "urn:nfc:"
            };

            const prefix = prefixes[bytes[0]] ?? "";
            const suffix = new TextDecoder().decode(bytes.slice(1));

            return prefix + suffix;
        }

        return new TextDecoder().decode(bytes).trim();

    } catch (_) {
        return "";
    }
}

function getNfcShareUrl(message) {
    if (!message?.records) return null;

    for (const record of message.records) {
        const value = decodeNfcRecord(record);
        const internalUrl = getInternalNotesShareUrl(value);

        if (internalUrl) return internalUrl;
    }

    return null;
}

async function readNotesNfc() {
    if (!window.isSecureContext) {
        window.alert("La lettura NFC richiede una connessione HTTPS.");
        return;
    }

    if (!("NDEFReader" in window)) {
        window.alert(
            "Questo browser non supporta Web NFC. Su Android serve un browser compatibile con Web NFC."
        );
        return;
    }

    document.getElementById("notesNfcDialog")?.remove();

    const dialog = document.createElement("div");
    dialog.id = "notesNfcDialog";
    dialog.className = "notes-qr-dialog";

    dialog.innerHTML = [
        '<div class="notes-qr-card notes-nfc-card">',
        '<button class="notes-qr-close" type="button" aria-label="Chiudi">×</button>',
        '<h3>📡 Leggi NFC</h3>',
        '<div class="notes-nfc-icon">📳</div>',
        '<p id="notesNfcStatus">Avvicina il telefono al tag NFC…</p>',
        '</div>'
    ].join("");

    document.body.appendChild(dialog);

    let controller = null;

    const close = () => {
        controller?.abort();
        dialog.remove();
    };

    dialog.querySelector(".notes-qr-close")?.addEventListener("click", close);

    dialog.addEventListener("click", event => {
        if (event.target === dialog) close();
    });

    try {
        const reader = new NDEFReader();

        controller = new AbortController();

        reader.addEventListener("reading", event => {
            const internalUrl = getNfcShareUrl(event.message);

            if (!internalUrl) {
                const status =
                    dialog.querySelector("#notesNfcStatus");

                if (status) {
                    status.textContent =
                        "Tag letto, ma non contiene un collegamento Nursing Shot.";
                }

                return;
            }

            close();
            window.location.href = internalUrl;

        }, { signal: controller.signal });

        reader.addEventListener("readingerror", () => {
            const status =
                dialog.querySelector("#notesNfcStatus");

            if (status) {
                status.textContent =
                    "Non riesco a leggere questo tag NFC. Prova ad avvicinarlo meglio.";
            }
        }, { signal: controller.signal });

        await reader.scan({
            signal: controller.signal
        });

    } catch (error) {
        const status =
            dialog.querySelector("#notesNfcStatus");

        if (status) {
            status.textContent =
                "Impossibile avviare la lettura NFC.";
        }

        console.error("Errore lettura NFC:", error);
    }
}

async function writeNotesNfc(stateId, itemId) {
    const notes = getNotesForItem(stateId, itemId);

    if (!notes.length) {
        window.alert("Non ci sono note da condividere.");
        return;
    }

    if (!window.isSecureContext) {
        window.alert("La scrittura NFC richiede una connessione HTTPS.");
        return;
    }

    if (!("NDEFReader" in window)) {
        window.alert("Questo browser non supporta Web NFC.");
        return;
    }

    const url = buildNotesShareUrl(
        stateId,
        itemId,
        notes
    );

    if (!window.confirm(
        "Il collegamento alle note verrà scritto sul tag NFC. Continuare?"
    )) {
        return;
    }

    try {
        const writer = new NDEFReader();

        await writer.write({
            records: [
                {
                    recordType: "url",
                    data: url
                }
            ]
        });

        window.alert("✅ Collegamento scritto sul tag NFC.");

    } catch (error) {
        console.error("Errore scrittura NFC:", error);

        if (error?.name === "NotAllowedError") {
            window.alert(
                "Scrittura NFC non autorizzata o tag non scrivibile."
            );
            return;
        }

        window.alert(
            "Non è stato possibile scrivere il tag NFC."
        );
    }
}

function renderSharedNotesImport(shared) {
    if (!shared) return "";

    const sameTarget =
        shared.stateId === state &&
        shared.itemId === item;

    return `
        <section class="personal-notes-import">
            <div>
                <strong>📥 Note ricevute</strong>
                <span>
                    ${shared.notes.length} ${shared.notes.length === 1 ? "nota" : "note"} da importare
                    ${sameTarget ? "" : " in un'altra scheda"}
                </span>
            </div>
            <div class="personal-notes-import-actions">
                <button
                    id="importSharedNotes"
                    class="settings-action"
                    type="button"
                >📥 Importa note</button>
                <button
                    id="cancelSharedNotes"
                    class="settings-action"
                    type="button"
                >✕ Ignora</button>
            </div>
        </section>
    `;
}

function importSharedNotes(shared) {
    if (!shared) return;

    const existing = getNotesForItem(
        shared.stateId,
        shared.itemId
    );

    const imported = shared.notes.map(note => ({
        id: String(Date.now()) + "-" +
            Math.random().toString(36).slice(2, 8),
        title: note.title || "Nota personale",
        text: note.text || ""
    }));

    saveNotesForItem(
        shared.stateId,
        shared.itemId,
        [...existing, ...imported]
    );

    window.location.hash = "";
    window.location.href =
        "?state=" + encodeURIComponent(shared.stateId) +
        "&item=" + encodeURIComponent(shared.itemId) +
        "&notes=1";
}

function renderPersonalNotesPage(stateId, itemId, data, title) {
    const notes = getNotesForItem(stateId, itemId);
    const filteredNotes = notes;
    const sharedNotes = readNotesSharePayload();

    content.innerHTML = `
        <section class="detail-page personal-notes-page">
            ${renderSharedNotesImport(sharedNotes)}
            <div class="detail-header-row">
                <h2>📝 Note personali</h2>
            </div>

            <p class="personal-notes-context">
                ${escapeHtml(title)}
            </p>

            <div class="personal-notes-share-actions">
                <button id="sharePersonalNotes" class="settings-action" type="button">🔗 Condividi / importa</button>
            </div>

            <div class="personal-notes-list">
                ${filteredNotes.length
                    ? filteredNotes.map(note => `
                        <article class="personal-note-card" data-note-id="${escapeAttribute(note.id)}">
                            <div class="personal-note-card-header">
                                <div>
                                    <h3>${renderNoteText(
                                    note.title || "Nota personale",
                                    stateId,
                                    itemId,
                                    note.id
                                )}</h3>
                                </div>
                                <div class="personal-note-actions">
                                    <button class="personal-note-edit" type="button" data-note-edit="${escapeAttribute(note.id)}" title="Modifica nota">✏️</button>
                                    <button class="personal-note-delete" type="button" data-note-delete="${escapeAttribute(note.id)}" title="Elimina nota">🗑️</button>
                                </div>
                            </div>
                            <div class="personal-note-text">${renderNoteText(note.text, stateId, itemId, note.id)}</div>
                        </article>
                    `).join("")
                    : `
                        <div class="personal-note-empty">
                            Nessuna nota personale in questa sottocategoria.
                        </div>
                    `}
            </div>

            <div class="personal-note-editor">
                <h3>➕ Nuova nota</h3>
                <input id="personalNoteTitle" class="personal-note-title-input" type="text" autocomplete="off" placeholder="Titolo della nota">
                <textarea id="personalNoteInput" class="personal-note-input" placeholder="Scrivi la nota... Per collegarla ad altre note usa: [[parola]]" rows="7"></textarea>
                <button id="savePersonalNote" class="settings-action" type="button">💾 Aggiungi nota</button>
                <p id="personalNoteMessage" class="personal-note-message"></p>
            </div>

            <a
                class="personal-notes-back"
                href="?state=${encodeURIComponent(stateId)}&item=${encodeURIComponent(itemId)}"
            >← Torna alla scheda</a>
        </section>
    `;
}

function setupPersonalNotes() {
    document.addEventListener("click", event => {
        if (event.target.closest("#sharePersonalNotes")) {
            showShareCenter();
            return;
        }

        if (event.target.closest("#importSharedNotes")) {
            const shared = readNotesSharePayload();
            importSharedNotes(shared);
            return;
        }

        if (event.target.closest("#cancelSharedNotes")) {
            window.location.hash = "";
            renderPersonalNotesPage(
                state,
                item,
                window.__currentData || {},
                window.__currentItemTitle || ""
            );
            return;
        }
        const editButton = event.target.closest("[data-note-edit]");

        if (editButton) {
            const noteId = editButton.dataset.noteEdit;
            const notes = getNotesForItem(state, item);
            const note = notes.find(current =>
                String(current.id) === String(noteId)
            );

            if (!note) return;

            const editor = document.querySelector(".personal-note-editor");
            const titleInput = document.getElementById("personalNoteTitle");
            const input = document.getElementById("personalNoteInput");
            const saveButton = document.getElementById("savePersonalNote");

            if (!editor || !titleInput || !input) return;

            editor.dataset.editingId = String(note.id);
            titleInput.value = note.title || "";
            input.value = note.text || "";

            if (saveButton) {
                saveButton.textContent = "💾 Salva modifiche";
            }

            editor.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

            input.focus();
            input.setSelectionRange(
                input.value.length,
                input.value.length
            );

            return;
        }

        const deleteButton = event.target.closest("[data-note-delete]");

        if (deleteButton) {
            const noteId = deleteButton.dataset.noteDelete;
            const notes = getNotesForItem(state, item)
                .filter(note => note.id !== noteId);

            saveNotesForItem(state, item, notes);

            renderPersonalNotesPage(
                state,
                item,
                window.__currentData || {},
                window.__currentItemTitle || ""
            );
            return;
        }

        if (event.target.closest("#savePersonalNote")) {
            const titleInput = document.getElementById("personalNoteTitle");
            const input = document.getElementById("personalNoteInput");

            if (!input) return;

            const textValue = input.value.trim();

            if (!textValue) {
                const message = document.getElementById("personalNoteMessage");
                if (message) message.textContent = "✏️ Scrivi prima il testo della nota.";
                return;
            }

            const notes = getNotesForItem(state, item);
            const editor = document.querySelector(".personal-note-editor");
            const editingId = editor?.dataset.editingId || "";

            if (editingId) {
                const note = notes.find(current =>
                    String(current.id) === String(editingId)
                );

                if (note) {
                    note.title =
                        (titleInput?.value || "").trim() ||
                        "Nota personale";
                    note.text = textValue;
                    note.updatedAt = new Date().toISOString();
                }

                saveNotesForItem(state, item, notes);

                renderPersonalNotesPage(
                    state,
                    item,
                    window.__currentData || {},
                    window.__currentItemTitle || ""
                );
                return;
            }

            notes.push({
                id: String(Date.now()) + "-" + Math.random().toString(36).slice(2, 8),
                title: (titleInput?.value || "").trim() || "Nota personale",
                text: textValue
            });

            saveNotesForItem(state, item, notes);

            input.value = "";
            if (titleInput) titleInput.value = "";

            const message = document.getElementById("personalNoteMessage");
            if (message) message.textContent = "✅ Nota aggiunta.";

            renderPersonalNotesPage(
                state,
                item,
                window.__currentData || {},
                window.__currentItemTitle || ""
            );
        }
    });
}

function collectOrderPreferences() {
    const result = {};

    for (const key of Object.keys(localStorage)) {
        if (
            key === PERSONALIZATION_KEYS.categoryOrder ||
            key.startsWith("nursing-sections-") ||
            key.startsWith("nursing-items-") ||
            key === "nursing-patient-order"
        ) {
            result[key] = localStorage.getItem(key);
        }
    }

    return result;
}

function getPatients() {
    try {
        const raw = JSON.parse(
            localStorage.getItem(PATIENTS_KEY) || "[]"
        );

        if (!Array.isArray(raw)) return [];

        return raw
            .filter(patient => patient && typeof patient === "object")
            .map(normalizePatient);
    } catch (_) {
        return [];
    }
}

function savePatients(patients) {
    localStorage.setItem(
        PATIENTS_KEY,
        JSON.stringify(patients)
    );
}

function getPatientOrder() {
    try {
        const raw = JSON.parse(
            localStorage.getItem("nursing-patient-order") || "null"
        );
        return Array.isArray(raw) ? raw.map(String) : null;
    } catch (_) {
        localStorage.removeItem("nursing-patient-order");
        return null;
    }
}

function applyPatientOrder(patients) {
    const savedOrder = getPatientOrder();
    if (!savedOrder) return [...patients];

    return [...patients].sort((a, b) => {
        const aIndex = savedOrder.indexOf(String(a.id));
        const bIndex = savedOrder.indexOf(String(b.id));
        return (
            (aIndex === -1 ? 999999 : aIndex) -
            (bIndex === -1 ? 999999 : bIndex)
        );
    });
}

function savePatientOrder() {
    const order = Array.from(
        content.querySelectorAll(".patient-card-row .patient-card")
    ).map(card => card.dataset.patientId);

    localStorage.setItem(
        "nursing-patient-order",
        JSON.stringify(order)
    );
}

function setupPatientOrderControls() {
    content
        .querySelectorAll(".patient-order-controls .order-button")
        .forEach(button => {
            button.addEventListener("click", event => {
                event.preventDefault();
                event.stopPropagation();

                const row = button.closest(".patient-card-row");
                if (!row) return;

                moveElement(
                    row,
                    button.dataset.order,
                    ".patient-card-row",
                    savePatientOrder
                );
            });
        });
}


function collectPersonalization(includePatients = false) {
    return {
        app: "Nursing Shot",
        type: "personalization",
        version: PERSONALIZATION_VERSION,
        exportedAt: new Date().toISOString(),
        theme:
            localStorage.getItem(PERSONALIZATION_KEYS.theme) ||
            "dark",
        orders: collectOrderPreferences(),
        notes: getPersonalNotes(),
        patients: includePatients ? getPatients() : []
    };
}

function getCurrentSectionShareData() {
    if (!state || !item) return null;

    return {
        stateId: state,
        itemId: item,
        notes: getNotesForItem(state, item)
    };
}

function getSelectedNotesFromDialog(dialog) {
    return Array.from(
        dialog.querySelectorAll(
            'input[data-share-note]:checked'
        )
    ).map(input => input.dataset.shareNote);
}

function showShareCenter() {
    document.getElementById("shareCenterDialog")?.remove();

    const dialog = document.createElement("div");
    dialog.id = "shareCenterDialog";
    dialog.className = "notes-qr-dialog";

    dialog.innerHTML = `
        <div class="notes-qr-card personalization-share-card">
            <button
                class="notes-qr-close"
                type="button"
                aria-label="Chiudi"
            >×</button>

            <h3>🔗 Condividi / importa</h3>

            <button id="shareCenterSend" class="settings-action" type="button">
                📤 Condividi
            </button>

            <button id="shareCenterQr" class="settings-action" type="button">
                📷 Importa da QR
            </button>

            <button id="shareCenterNfc" class="settings-action" type="button">
                📡 Importa da NFC
            </button>
        </div>
    `;

    document.body.appendChild(dialog);

    const close = () => dialog.remove();

    dialog.querySelector(".notes-qr-close")
        ?.addEventListener("click", close);

    dialog.addEventListener("click", event => {
        if (event.target === dialog) close();
    });

    dialog.querySelector("#shareCenterSend")
        ?.addEventListener("click", () => {
            close();
            showPersonalizationShareDialog();
        });

    dialog.querySelector("#shareCenterQr")
        ?.addEventListener("click", () => {
            close();
            readNotesQr();
        });

    dialog.querySelector("#shareCenterNfc")
        ?.addEventListener("click", () => {
            close();
            readNotesNfc();
        });
}

function showPersonalizationShareDialog() {
    document.getElementById("personalizationShareDialog")?.remove();

    const dialog = document.createElement("div");
    dialog.id = "personalizationShareDialog";
    dialog.className = "notes-qr-dialog";

    const currentNotes =
        state && item
            ? getNotesForItem(state, item)
            : [];

    const noteOptions = currentNotes.length
        ? currentNotes.map(note => `
            <label class="share-note-option">
                <input
                    type="checkbox"
                    data-share-note="${escapeAttribute(note.id)}"
                >
                <span>
                    <strong>${escapeHtml(note.title || "Nota personale")}</strong>
                </span>
            </label>
        `).join("")
        : `
            <p class="settings-message">
                Non ci sono micronote nella sezione corrente.
            </p>
        `;

    dialog.innerHTML = `
        <div class="notes-qr-card personalization-share-card">
            <button
                class="notes-qr-close"
                type="button"
                aria-label="Chiudi"
            >×</button>

            <h3>🔗 Condividi personalizzazione</h3>

            <p>
                Scegli cosa vuoi trasferire. Il destinatario potrà importarlo
                direttamente nell'app.
            </p>

            <div class="share-choice-list">
                ${state && item ? `
                    <button
                        class="settings-action share-choice"
                        type="button"
                        data-share-scope="section"
                    >
                        📚 Sezione corrente
                        <small>Tutte le note di questa sottosezione</small>
                    </button>

                    <div class="share-micronotes">
                        <strong>📝 Micronote specifiche</strong>
                        ${noteOptions}
                        <button
                            class="settings-action share-choice"
                            type="button"
                            data-share-scope="notes"
                        >
                            Condividi micronote selezionate
                        </button>
                    </div>
                ` : ""}

                <button
                    class="settings-action share-choice"
                    type="button"
                    data-share-scope="all"
                >
                    🗂️ Intera personalizzazione
                    <small>Tema, ordini e tutte le note</small>
                </button>
            </div>

            <p class="settings-message">
                Dopo questa scelta potrai scegliere il metodo:
                collegamento, QR oppure NFC.
            </p>
        </div>
    `;

    document.body.appendChild(dialog);

    const close = () => dialog.remove();

    dialog.querySelector(".notes-qr-close")
        ?.addEventListener("click", close);

    dialog.addEventListener("click", event => {
        if (event.target === dialog) close();

        const button =
            event.target.closest("[data-share-scope]");

        if (!button) return;

        const scope = button.dataset.shareScope;
        let data = null;
        let type = scope;

        if (scope === "section") {
            data = getCurrentSectionShareData();
        }

        if (scope === "notes") {
            const selectedIds =
                getSelectedNotesFromDialog(dialog);

            if (!selectedIds.length) {
                window.alert(
                    "Seleziona almeno una micronota."
                );
                return;
            }

            data = {
                stateId: state,
                itemId: item,
                notes: getNotesForItem(state, item)
                    .filter(note =>
                        selectedIds.includes(String(note.id))
                    )
            };
        }

        if (scope === "all") {
            const includePatients =
                getPatients().length > 0 &&
                window.confirm(
                    "Vuoi includere anche i dati dei pazienti? Contengono potenzialmente dati sanitari personali e verranno inseriti nel collegamento condiviso."
                );

            data = collectPersonalization(includePatients);

            if (includePatients) {
                const secondConfirm =
                    window.confirm(
                        "Confermi di voler condividere anche i dati dei pazienti?"
                    );

                if (!secondConfirm) {
                    data.patients = [];
                }
            }
        }

        if (!data) return;

        close();
        showShareMethodDialog(type, data);
    });
}

function showShareMethodDialog(type, data) {
    document.getElementById("shareMethodDialog")?.remove();

    const url = buildShareUrl(type, data);

    const dialog = document.createElement("div");
    dialog.id = "shareMethodDialog";
    dialog.className = "notes-qr-dialog";

    dialog.innerHTML = `
        <div class="notes-qr-card personalization-share-card">
            <button
                class="notes-qr-close"
                type="button"
                aria-label="Chiudi"
            >×</button>

            <h3>📤 Come vuoi condividere?</h3>

            <button id="shareMethodLink" class="settings-action" type="button">
                🔗 Collegamento
            </button>

            <button id="shareMethodQr" class="settings-action" type="button">
                ▦ QR code
            </button>

            <button id="shareMethodNfc" class="settings-action" type="button">
                📳 Scrivi su NFC
            </button>
        </div>
    `;

    document.body.appendChild(dialog);

    const close = () => dialog.remove();

    dialog.querySelector(".notes-qr-close")
        ?.addEventListener("click", close);

    dialog.addEventListener("click", event => {
        if (event.target === dialog) close();
    });

    dialog.querySelector("#shareMethodLink")
        ?.addEventListener("click", async () => {
            if (navigator.share) {
                try {
                    await navigator.share({
                        title: "Nursing Shot — personalizzazione",
                        text: "Personalizzazione condivisa da Nursing Shot",
                        url
                    });
                    close();
                    return;
                } catch (_) {}
            }

            try {
                await navigator.clipboard.writeText(url);
                window.alert("Collegamento copiato.");
            } catch (_) {
                window.prompt("Copia questo collegamento:", url);
            }

            close();
        });

    dialog.querySelector("#shareMethodQr")
        ?.addEventListener("click", () => {
            close();
            showGenericShareQr(url);
        });

    dialog.querySelector("#shareMethodNfc")
        ?.addEventListener("click", async () => {
            close();
            await writeGenericNfc(url);
        });
}

function showGenericShareQr(url) {
    const dialog = document.createElement("div");
    dialog.id = "genericShareQrDialog";
    dialog.className = "notes-qr-dialog";

    const qrUrl =
        "https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=" +
        encodeURIComponent(url);

    dialog.innerHTML = `
        <div class="notes-qr-card">
            <button class="notes-qr-close" type="button" aria-label="Chiudi">×</button>
            <h3>▦ Condividi tramite QR</h3>
            <img src="${qrUrl}" alt="QR per condividere la personalizzazione">
            <p class="settings-message">
                Scansiona il QR con Nursing Shot.
            </p>
        </div>
    `;

    document.body.appendChild(dialog);

    dialog.querySelector(".notes-qr-close")
        ?.addEventListener("click", () => dialog.remove());

    dialog.addEventListener("click", event => {
        if (event.target === dialog) dialog.remove();
    });
}

async function writeGenericNfc(url) {
    if (!window.isSecureContext) {
        window.alert(
            "La scrittura NFC richiede una connessione HTTPS."
        );
        return;
    }

    if (!("NDEFReader" in window)) {
        window.alert(
            "Questo browser non supporta Web NFC."
        );
        return;
    }

    const byteLength =
        new TextEncoder().encode(url).length;

    if (byteLength > 450) {
        window.alert(
            "La condivisione è troppo grande per essere scritta in modo affidabile su un tag NFC. Usa il collegamento o il QR."
        );
        return;
    }

    if (!window.confirm(
        "Il collegamento verrà scritto sul tag NFC. Continuare?"
    )) {
        return;
    }

    try {
        const writer = new NDEFReader();

        await writer.write({
            records: [
                {
                    recordType: "url",
                    data: url
                }
            ]
        });

        window.alert("✅ Collegamento scritto sul tag NFC.");

    } catch (error) {
        console.error("Errore scrittura NFC:", error);
        window.alert(
            "Non è stato possibile scrivere il tag NFC."
        );
    }
}

function importSharedPersonalization(payload) {
    if (!payload) return false;

    if (
        payload.type === "section" ||
        payload.type === "notes"
    ) {
        const data = payload.data;

        if (
            !data ||
            !data.stateId ||
            !data.itemId ||
            !Array.isArray(data.notes)
        ) {
            return false;
        }

        const existing =
            getNotesForItem(
                data.stateId,
                data.itemId
            );

        const imported = data.notes.map(note => ({
            id:
                String(Date.now()) +
                "-" +
                Math.random().toString(36).slice(2, 8),
            title: note.title || "Nota personale",
            text: note.text || ""
        }));

        saveNotesForItem(
            data.stateId,
            data.itemId,
            [...existing, ...imported]
        );

        return true;
    }

    if (payload.type === "all") {
        const data = payload.data;

        if (
            !data ||
            data.app !== "Nursing Shot" ||
            data.type !== "personalization"
        ) {
            return false;
        }

        const incomingPatients =
            Array.isArray(data.patients)
                ? data.patients
                : [];

        let patientsToImport =
            incomingPatients;

        if (
            incomingPatients.length &&
            !window.confirm(
                "Questa personalizzazione contiene dati paziente. Vuoi importarli su questo dispositivo?"
            )
        ) {
            patientsToImport = [];
        }

        if (
            data.theme === "light" ||
            data.theme === "dark"
        ) {
            localStorage.setItem(
                PERSONALIZATION_KEYS.theme,
                data.theme
            );
        }

        if (
            data.orders &&
            typeof data.orders === "object"
        ) {
            for (const [key, value] of Object.entries(data.orders)) {
                if (
                    key === PERSONALIZATION_KEYS.categoryOrder ||
                    key.startsWith("nursing-sections-") ||
                    key.startsWith("nursing-items-")
                ) {
                    localStorage.setItem(
                        key,
                        String(value)
                    );
                }
            }
        }

        if (
            data.notes &&
            typeof data.notes === "object"
        ) {
            const existingNotes =
                JSON.parse(
                    localStorage.getItem(PERSONALIZATION_KEYS.notes) || "{}"
                );

            for (const [key, incomingNotes] of Object.entries(data.notes)) {
                const currentNotes =
                    Array.isArray(existingNotes[key])
                        ? existingNotes[key]
                        : [];

                const mergedNotes = [
                    ...currentNotes,
                    ...(Array.isArray(incomingNotes) ? incomingNotes : [])
                ];

                const seen = new Set();
                existingNotes[key] = mergedNotes.filter(note => {
                    const noteId = String(note?.id || "");
                    const fingerprint =
                        noteId ||
                        JSON.stringify({
                            title: note?.title || "",
                            text: note?.text || ""
                        });

                    if (seen.has(fingerprint)) return false;
                    seen.add(fingerprint);
                    return true;
                });
            }

            localStorage.setItem(
                PERSONALIZATION_KEYS.notes,
                JSON.stringify(existingNotes)
            );
        }

        if (patientsToImport.length) {
            const existingPatients = getPatients();
            const mergedPatients = existingPatients.map(normalizePatient);

            for (const incomingPatient of patientsToImport) {
                const normalizedIncoming = normalizePatient(incomingPatient);
                const incomingId = String(normalizedIncoming.id || "");

                const existingIndex = mergedPatients.findIndex(patient =>
                    String(patient.id) === incomingId && incomingId !== ""
                );

                if (existingIndex === -1) {
                    mergedPatients.push(normalizedIncoming);
                    continue;
                }

                const existingPatient = mergedPatients[existingIndex];

                for (const [key, value] of Object.entries(normalizedIncoming)) {
                    if (key === "pvHistory") {
                        const existingHistory = Array.isArray(existingPatient.pvHistory)
                            ? existingPatient.pvHistory
                            : [];
                        const incomingHistory = Array.isArray(value) ? value : [];
                        const historyById = new Map(
                            existingHistory.map(entry => [String(entry.id || ""), entry])
                        );

                        for (const entry of incomingHistory) {
                            const entryId = String(entry.id || "");
                            if (entryId && historyById.has(entryId)) continue;
                            const newId = entryId || (Date.now() + "-" + Math.random().toString(36).slice(2, 8));
                            historyById.set(newId, { ...entry, id: newId });
                        }

                        existingPatient.pvHistory = Array.from(historyById.values());
                        continue;
                    }

                    if (
                        String(value || "").trim() !== "" &&
                        String(existingPatient[key] || "").trim() === ""
                    ) {
                        existingPatient[key] = value;
                    }
                }
            }

            savePatients(mergedPatients);
        }

        setupTheme();
        return true;
    }

    return false;
}

function renderSharedPersonalizationImport(payload) {
    if (!payload) return "";

    let descriptionText =
        "Personalizzazione pronta da importare.";

    if (payload.type === "section") {
        descriptionText =
            "Sono disponibili le note della sezione corrente.";
    } else if (payload.type === "notes") {
        descriptionText =
            "Sono disponibili le micronote selezionate.";
    } else if (payload.type === "all") {
        const hasPatients =
            Array.isArray(payload.data?.patients) &&
            payload.data.patients.length > 0;

        descriptionText =
            hasPatients
                ? "Include anche dati paziente."
                : "Non include dati paziente.";
    }

    return `
        <section class="personal-notes-import personalization-import-banner">
            <div>
                <strong>📥 Personalizzazione ricevuta</strong>
                <span>${descriptionText}</span>
            </div>
            <div>
                <button id="importSharedPersonalization" class="settings-action" type="button">
                    📥 Importa
                </button>
                <button id="cancelSharedPersonalization" class="settings-action" type="button">
                    ✕ Ignora
                </button>
            </div>
        </section>
    `;
}

// =========================================================================
// SISTEMA AUTO-INSTALLANTE CON TRADUZIONE EN -> IT E RIMOZIONE DOPPIONI
// =========================================================================

(function() {
    let listaFarmaciDati = [];

    // 1. DIZIONARIO DI TRADUZIONE (Estendibile)
    // Struttura: "nome_inglese_nel_csv": "Nome Italiano Da Cercare"
    const dizionarioTraduzione = {
        "acetaminophen": "Paracetamolo",
        "aspirin": "Aspirina",
        "ibuprofen": "Ibuprofene",
        "amoxicillin": "Amoxicillina",
        "warfarin": "Warfarin",
        "heparin": "Eparina",
        "diazepam": "Diazepam",
        "omeprazole": "Omeprazolo",
        "metformin": "Metformina",
        "prednisone": "Prednisone",
        "atorvastatin": "Atorvastatina",
        "furosemide": "Furosemide"
    };

    // Creiamo un dizionario inverso (Italiano -> Inglese) per convertire l'input dell'utente
    const dizionarioInverso = {};
    for (const [en, it] of Object.entries(dizionarioTraduzione)) {
        dizionarioInverso[it.toLowerCase()] = en.toLowerCase();
    }

    // Lista di emergenza se il CSV locale non è leggibile
    const farmaciDiBackup = Object.values(dizionarioTraduzione);

    // 2. Carica i dati dal CSV della repository
    async function caricaDatabase() {
        try {
            const response = await fetch("./src/data/farmaci.csv");
            if (!response.ok) throw new Error();
            const testo = await response.text();
            const righe = testo.split(/\r?\n/);
            
            const nomiGrezzi = righe.map(riga => {
                const colonne = riga.split(/[,;]/);
                const nomeInglese = colonne?.trim(); // Nome originale in Inglese dal CSV
                
                // TRADUZIONE: Se esiste la traduzione in Italiano restituisce quella, altrimenti lascia l'Inglese
                if (nomeInglese && dizionarioTraduzione[nomeInglese.toLowerCase()]) {
                    return dizionarioTraduzione[nomeInglese.toLowerCase()];
                }
                return nomeInglese;
            }).filter(nome => nome && nome.length > 0);

            // RIMOZIONE DOPPIONI
            listaFarmaciDati = [...new Set(nomiGrezzi)];

            if (listaFarmaciDati.length > 0 && ["nome", "farmaco"].includes(listaFarmaciDati.toLowerCase())) {
                listaFarmaciDati.shift();
            }
        } catch (e) {
            listaFarmaciDati = [...new Set(farmaciDiBackup)];
        }
    }
    caricaDatabase();

    // 3. Osserva la pagina: appena appare un input di ricerca, gli aggancia il datalist
    const observer = new MutationObserver(() => {
        const inputs = document.querySelectorAll("input[type='text'], input:not([type])");
        
        inputs.forEach(input => {
            // Questi campi appartengono ai moduli paziente/note e non devono
            // essere trasformati in campi di ricerca automatica.
            if (
                input.id === "patientName" ||
                input.id === "patientBirthDate" ||
                input.id === "patientAge" ||
                input.id === "patientRoom" ||
                input.id === "patientBed" ||
                input.id === "personalNoteTitle" ||
                input.id === "appNoteTitle"
            ) {
                return;
            }

            if (input.hasAttribute("list") || input.getAttribute("role") === "combobox") return;

            const dataListId = "dl-" + Math.random().toString(36).substr(2, 9);
            const dataList = document.createElement("datalist");
            dataList.id = dataListId;
            document.body.appendChild(dataList);
            input.setAttribute("list", dataListId);

            // Ascolta la digitazione dell'utente (Filtro per iniziali in Italiano)
            input.addEventListener("input", () => {
                const valore = input.value.toLowerCase();
                dataList.innerHTML = ""; // Svuota i vecchi suggerimenti

                if (valore.length > 0) {
                    // FILTRO RIGIDO: Mantiene solo i nomi tradotti in Italiano che iniziano con quelle lettere
                    const filtrati = listaFarmaciDati.filter(f => 
                        f.toLowerCase().startsWith(valore)
                    ).slice(0, 15);

                    // Popola il menu a tendina nativo senza duplicati e in Italiano
                    filtrati.forEach(farmaco => {
                        const option = document.createElement("option");
                        option.value = farmaco;
                        dataList.appendChild(option);
                    });
                }
            });
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
})();

/* =========================================================
   TEMA
========================================================= */

function applyTheme(theme) {

    const normalizedTheme =
        theme === "light" ? "light" : "dark";

    document.documentElement.dataset.theme =
        normalizedTheme;

    localStorage.setItem(
        "nursing-theme",
        normalizedTheme
    );

}

function setupTheme() {

    const savedTheme =
        localStorage.getItem("nursing-theme") || "dark";

    applyTheme(savedTheme);


}

setupTheme();
setupSettings();
setupPersonalNotes();
setupAppNotes();
setupPatients();

if (incomingPersonalization) {

    document.body.classList.remove("home-page");
    shortcuts.style.display = "none";

    if (backButton) {
        backButton.style.display = "flex";
    }

    stateTitle.textContent =
        "📥 Importazione";

    description.textContent =
        "Dati ricevuti da un altro dispositivo.";

    content.innerHTML =
        renderSharedPersonalizationImport(
            incomingPersonalization
        );

    const importButton =
        document.getElementById(
            "importSharedPersonalization"
        );

    importButton?.addEventListener("click", () => {

        const imported =
            importSharedPersonalization(
                incomingPersonalization
            );

        if (imported) {

            window.history.replaceState(
                {},
                "",
                window.location.pathname
            );

            window.location.reload();

        } else {

            window.alert(
                "Collegamento di personalizzazione non valido."
            );

        }
    });

    document.getElementById(
        "cancelSharedPersonalization"
    )?.addEventListener("click", () => {

        window.history.replaceState(
            {},
            "",
            window.location.pathname
        );

        window.location.reload();

    });

} else if (patientPhotosRoute === "1") {

    stateTitle.textContent = "📷 Evoluzione medicazione";
    description.textContent = "Documentazione fotografica del paziente.";
    shortcuts.style.display = "none";
    renderPatientPhotosPage(patientRouteId);

} else if (patientsRoute === "1") {

    stateTitle.textContent = "👤 Pazienti";
    description.textContent =
        "Gestione locale dei pazienti.";
    shortcuts.style.display = "none";

    document.querySelector(".page-title-row")?.insertAdjacentHTML("beforeend", `
        <button id="patientSearchToggle" class="patient-search-toggle" type="button" aria-label="Cerca paziente">🔍</button>
    `);

    stateTitle.insertAdjacentHTML("afterend", `
        <input id="patientSearch" class="patient-search-input" type="search"
            placeholder="Cerca paziente..." autocomplete="off">
        <div id="patientSearchSuggestions" class="patient-search-suggestions" hidden></div>
    `);

    const patientSearch =
        document.getElementById("patientSearch");

    const patientSearchSuggestions =
        document.getElementById("patientSearchSuggestions");

    function normalizePatientSearchText(value = "") {
        return String(value ?? "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLocaleLowerCase("it-IT")
            .trim()
            .replace(/\s+/g, " ");
    }

    function patientNameMatches(name, queryValue) {
        const nameNormalized =
            normalizePatientSearchText(name);

        const queryNormalized =
            normalizePatientSearchText(queryValue);

        if (!queryNormalized) return true;

        // Cerca anche una sequenza di parole non necessariamente adiacenti.
        const queryWords =
            queryNormalized.split(" ").filter(Boolean);

        const nameWords =
            nameNormalized.split(" ").filter(Boolean);

        return queryWords.every(queryWord =>
            nameWords.some(nameWord =>
                nameWord.startsWith(queryWord)
            )
        );
    }

    function updatePatientSearch(queryValue = "") {
        const query =
            normalizePatientSearchText(queryValue);

        const patients =
            getPatients();

        // Filtra esclusivamente le schede paziente.
        document
            .querySelectorAll(".patients-list .patient-card")
            .forEach(card => {
                const name =
                    card.getAttribute("data-patient-name") ||
                    card.querySelector("strong")?.textContent ||
                    "";

                card.style.display =
                    patientNameMatches(name, query)
                        ? ""
                        : "none";
            });

        if (!patientSearchSuggestions) return;

        if (!query) {
            patientSearchSuggestions.hidden = true;
            patientSearchSuggestions.innerHTML = "";
            return;
        }

        const matches =
            patients.filter(patient =>
                patientNameMatches(patient.name, query)
            );

        patientSearchSuggestions.innerHTML =
            matches.map(patient => `
                <button
                    type="button"
                    class="patient-search-suggestion"
                    data-patient-suggestion="${escapeAttribute(patient.id)}"
                >
                    <strong>${escapeHtml(getPatientInitials(patient.name))}</strong>
                    <span>${escapeHtml(patient.name)}</span>
                </button>
            `).join("");

        patientSearchSuggestions.hidden =
            matches.length === 0;
    }

    patientSearch?.addEventListener("input", () => {
        updatePatientSearch(patientSearch.value);
    });

    document
        .getElementById("patientSearchToggle")
        ?.addEventListener("click", () => {
            const input =
                document.getElementById("patientSearch");

            if (!input) return;

            input.classList.toggle("is-open");

            if (input.classList.contains("is-open")) {
                input.focus();
                updatePatientSearch(input.value);
            } else {
                input.value = "";
                updatePatientSearch("");
            }
        });

    patientSearchSuggestions?.addEventListener("click", event => {
        const suggestion =
            event.target.closest("[data-patient-suggestion]");

        if (!suggestion) return;

        const patientId =
            suggestion.dataset.patientSuggestion;

        if (!patientId) return;

        window.location.href =
            "?patients=1&patient=" +
            encodeURIComponent(patientId);
    });

    const patientSearchToggle =
        document.getElementById("patientSearchToggle");

    if (patientRouteId) {
        patientSearchToggle?.remove();
        document.getElementById("patientSearch")?.remove();
        document.getElementById("patientSearchSuggestions")?.remove();
    }

    renderPatientsPage(patientRouteId, false);

    // Applica subito l'eventuale ricerca già presente nel campo.
    if (patientSearch && !patientRouteId) {
        updatePatientSearch(patientSearch.value);
    }

} else if (editor === "1") {

    loadEditor();

} else {

    loadCategories();
    loadState();

}
window.addEventListener("popstate", () => {
    const viewer = document.getElementById("patientPhotoViewer");
    if (viewer) {
        const returnUrl = viewer.dataset.returnUrl;
        viewer.closeViewer?.();
        if (returnUrl && window.location.href !== returnUrl) {
            window.history.pushState({}, "", returnUrl);
        }
        return;
    }
    window.location.reload();
});

/* =========================================================
   EDITOR
========================================================= */

async function loadEditor() {

    shortcuts.style.display = "none";

    stateTitle.textContent =
        "🛠️ Editor";

    description.textContent =
        "Modifica i contenuti dell'archivio.";

    content.innerHTML = `

        <section>

            <h2>
                Archivio
            </h2>

            <select id="editor-state">

                <option value="">
                    Seleziona archivio
                </option>

                <option value="ecg">
                    ECG
                </option>

                <option value="farmaci">
                    Farmaci
                </option>

                <option value="laboratorio">
                    Laboratorio
                </option>

                <option value="emergenze">
                    Emergenze
                </option>

            </select>

            <div id="editor-area"></div>

        </section>

    `;


    const select =
        document.getElementById(
            "editor-state"
        );


    select.addEventListener(
        "change",
        () => {

            if (select.value) {

                openEditorFile(
                    select.value
                );

            }

        }
    );

}


/* =========================================================
   APRE FILE NELL'EDITOR
========================================================= */

async function openEditorFile(stateId) {

    const area =
        document.getElementById(
            "editor-area"
        );


    try {

        const response =
            await fetch(
                `./data/${stateId}.json`
            );


        if (!response.ok) {

            throw new Error(
                "File non trovato"
            );

        }


        let data =
            await response.json();


        data =
            applyLocalOverride(
                stateId,
                data
            );


        area.innerHTML = `

            <h2>
                ${data.icon || ""}
                ${data.title}
            </h2>

            <label>
                Titolo

                <input
                    id="editor-title"
                    type="text"
                    value="${escapeAttribute(
                        data.title || ""
                    )}"
                >

            </label>


            <label>
                Descrizione

                <textarea
                    id="editor-description"
                >${data.description || ""}</textarea>

            </label>


            <h3>
                JSON completo
            </h3>

            <textarea
                id="editor-json"
                class="editor-json"
            ></textarea>


            <div class="editor-buttons">

                <button id="editor-save">
                    💾 Salva localmente
                </button>

                <button id="editor-export">
                    📥 Esporta JSON
                </button>

                <button id="editor-reset">
                    ↩ Ripristina originale
                </button>

            </div>


            <div
                id="editor-message"
                class="calculator-result"
            ></div>

        `;


        const jsonArea =
            document.getElementById(
                "editor-json"
            );


        jsonArea.value =
            JSON.stringify(
                data,
                null,
                2
            );


        document
            .getElementById("editor-save")
            .addEventListener(
                "click",
                () => {

                    saveEditorData(
                        stateId
                    );

                }
            );


        document
            .getElementById("editor-export")
            .addEventListener(
                "click",
                () => {

                    exportEditorData(
                        stateId
                    );

                }
            );


        document
            .getElementById("editor-reset")
            .addEventListener(
                "click",
                () => {

                    localStorage.removeItem(
                        `nursing-nfc-${stateId}`
                    );

                    location.reload();

                }
            );

    }

    catch (error) {

        area.innerHTML = `

            <p>
                Impossibile caricare
                ${stateId}.json
            </p>

        `;

        console.error(error);

    }

}


/* =========================================================
   SALVA EDITOR
========================================================= */

function saveEditorData(stateId) {

    const jsonArea =
        document.getElementById(
            "editor-json"
        );


    try {

        const data =
            JSON.parse(
                jsonArea.value
            );


        localStorage.setItem(

            `nursing-nfc-${stateId}`,

            JSON.stringify(data)

        );


        showEditorMessage(
            "✅ Modifiche salvate localmente."
        );

    }

    catch (error) {

        showEditorMessage(
            "❌ JSON non valido. Controlla la sintassi."
        );

        console.error(error);

    }

}


/* =========================================================
   ESPORTA JSON
========================================================= */

function exportEditorData(stateId) {

    const jsonArea =
        document.getElementById(
            "editor-json"
        );


    try {

        const data =
            JSON.parse(
                jsonArea.value
            );


        const blob =
            new Blob(

                [
                    JSON.stringify(
                        data,
                        null,
                        2
                    )
                ],

                {
                    type:
                        "application/json"
                }

            );


        const url =
            URL.createObjectURL(blob);


        const link =
            document.createElement("a");


        link.href = url;

        link.download =
            `${stateId}.json`;


        link.click();


        URL.revokeObjectURL(url);


        showEditorMessage(
            "📥 JSON esportato."
        );

    }

    catch (error) {

        showEditorMessage(
            "❌ JSON non valido."
        );

        console.error(error);

    }

}


/* =========================================================
   MESSAGGIO EDITOR
========================================================= */

function showEditorMessage(message) {

    const element =
        document.getElementById(
            "editor-message"
        );


    if (element) {

        element.textContent =
            message;

    }

}


/* =========================================================
   SICUREZZA HTML
========================================================= */

function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


/* =========================================================
   SICUREZZA ATTRIBUTO
========================================================= */

function escapeAttribute(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

}

/* =========================================================
   SERVICE WORKER
========================================================= */

if ("serviceWorker" in navigator) {

    window.addEventListener("load", () => {

        navigator.serviceWorker
            .register("./service-worker.js")
            .then(() => {

                console.log(
                    "Service Worker attivo"
                );

            })
            .catch(error => {

                console.error(
                    "Errore Service Worker:",
                    error
                );

            });

    });

}
