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

const appNotesRoute =
    params.get("appnotes") || "";


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
const PATIENT_PHOTO_CACHE = "nursing-patient-photos-v1";
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


function patientPhotoRequest(patientId, photoId) {
    const safePatientId = encodeURIComponent(String(patientId || ""));
    return new Request(
        new URL(
            \`./patient-photos/\${safePatientId}/\${encodeURIComponent(photoId)}.jpg\`,
            window.location.href
        ).toString()
    );
}

function formatPatientPhotoDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Data non disponibile";
    return date.toLocaleString("it-IT", {
        dateStyle: "short",
        timeStyle: "short"
    });
}

async function getPatientPhotos(patientId) {
    if (!("caches" in window) || !patientId) return [];

    const cache = await caches.open(PATIENT_PHOTO_CACHE);
    const requests = await cache.keys();
    const prefix = \`/patient-photos/\${encodeURIComponent(String(patientId))}/\`;

    const photos = [];

    for (const request of requests) {
        const url = new URL(request.url);
        if (!url.pathname.includes(prefix)) continue;

        const response = await cache.match(request);
        if (!response) continue;

        const photoId = response.headers.get("X-Photo-Id") || decodeURIComponent(
            url.pathname.split("/").pop().replace(/\.jpg$/i, "")
        );

        photos.push({
            id: photoId,
            recordedAt: response.headers.get("X-Photo-Date") || "",
            request
        });
    }

    photos.sort((a, b) =>
        String(b.recordedAt).localeCompare(String(a.recordedAt))
    );

    return photos;
}

async function renderPatientPhotosPage(patientId) {
    const patient = getPatients().find(current => current.id === patientId);
    if (!patient) {
        renderPatientsPage();
        return;
    }

    stateTitle.textContent = "📷 Evoluzione medicazione";
    description.textContent = "Documentazione fotografica del paziente.";
    content.innerHTML = \`
        <section class="detail-page patients-page patient-photos-page">
            <div class="patient-photo-header">
                <h3>👤 \${renderNoteText(patient.name || "Paziente senza nome")}</h3>
                <button id="takePatientPhoto" class="settings-action" type="button"
                    data-patient-id="\${escapeAttribute(patientId)}">
                    📷 Scatta foto
                </button>
            </div>

            <div class="patient-photo-privacy-warning">
                <strong>⚠️ Privacy e consenso</strong>
                <p>
                    Prima di fotografare, chiedi il consenso del paziente.
                    Non inquadrare volti, documenti, braccialetti identificativi
                    o altri elementi che possano rivelare informazioni non necessarie.
                </p>
            </div>

            <div id="patientPhotoGallery" class="patient-photo-gallery">
                <p class="personal-note-empty">Caricamento immagini…</p>
            </div>
        </section>
    \`;

    const gallery = document.getElementById("patientPhotoGallery");
    const photos = await getPatientPhotos(patientId);

    if (!photos.length) {
        gallery.innerHTML = '<div class="personal-note-empty">Nessuna fotografia acquisita.</div>';
        return;
    }

    gallery.innerHTML = "";

    for (const photo of photos) {
        const response = await caches.match(photo.request);
        if (!response) continue;

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);

        const card = document.createElement("article");
        card.className = "patient-photo-card";
        card.innerHTML = \`
            <img class="patient-photo-image" alt="Fotografia acquisita il \${escapeAttribute(formatPatientPhotoDate(photo.recordedAt))}">
            <div class="patient-photo-meta">
                <strong>\${escapeHtml(formatPatientPhotoDate(photo.recordedAt))}</strong>
                <button type="button" class="patient-photo-delete settings-action settings-danger"
                    data-photo-id="\${escapeAttribute(photo.id)}"
                    data-patient-id="\${escapeAttribute(patientId)}">
                    🗑️ Elimina
                </button>
            </div>
        \`;

        card.querySelector("img").src = objectUrl;
        card.querySelector("img").addEventListener("load", () => URL.revokeObjectURL(objectUrl), { once: true });
        gallery.appendChild(card);
    }
}

function openPatientPhotoCapture(patientId) {
    const modal = document.createElement("div");
    modal.className = "patient-photo-modal";
    modal.innerHTML = \`
        <div class="patient-photo-modal-card">
            <h3>📷 Nuova fotografia</h3>

            <div class="patient-photo-privacy-warning">
                <strong>⚠️ Prima di procedere</strong>
                <p>
                    Chiedi il consenso del paziente prima di effettuare la foto.
                    Non inquadrare volti, documenti, braccialetti identificativi
                    o altri elementi non necessari alla documentazione della medicazione.
                </p>
            </div>

            <label class="patient-photo-consent">
                <input id="patientPhotoConsent" type="checkbox">
                <span>Ho acquisito il consenso del paziente e verificherò che nell'immagine non compaiano dati non necessari.</span>
            </label>

            <input id="patientPhotoInput" type="file" accept="image/*" capture="environment" hidden>

            <button id="startPatientPhoto" class="settings-action" type="button" disabled>
                📷 Apri fotocamera
            </button>
            <button id="closePatientPhoto" class="settings-action" type="button">
                Annulla
            </button>

            <p id="patientPhotoMessage" class="personal-note-message"></p>
        </div>
    \`;

    document.body.appendChild(modal);

    const consent = modal.querySelector("#patientPhotoConsent");
    const start = modal.querySelector("#startPatientPhoto");
    const input = modal.querySelector("#patientPhotoInput");
    const message = modal.querySelector("#patientPhotoMessage");

    consent.addEventListener("change", () => {
        start.disabled = !consent.checked;
    });

    start.addEventListener("click", () => {
        input.click();
    });

    modal.querySelector("#closePatientPhoto").addEventListener("click", () => {
        modal.remove();
    });

    input.addEventListener("change", async () => {
        const file = input.files?.[0];
        if (!file) return;

        try {
            start.disabled = true;
            message.textContent = "Salvataggio nella cache…";

            const cache = await caches.open(PATIENT_PHOTO_CACHE);
            const photoId = \`\${Date.now()}-\${Math.random().toString(36).slice(2, 8)}\`;
            const recordedAt = new Date().toISOString();
            const request = patientPhotoRequest(patientId, photoId);

            const response = new Response(file, {
                headers: {
                    "Content-Type": file.type || "image/jpeg",
                    "X-Photo-Id": photoId,
                    "X-Photo-Date": recordedAt,
                    "X-Patient-Id": String(patientId)
                }
            });

            await cache.put(request, response);
            modal.remove();
            await renderPatientPhotosPage(patientId);
        } catch (error) {
            console.error("Errore salvataggio fotografia:", error);
            message.textContent = "Impossibile salvare la fotografia nella cache.";
            start.disabled = false;
        } finally {
            input.value = "";
        }
    });
}

async function deletePatientPhoto(patientId, photoId) {
    if (!window.confirm("Eliminare questa fotografia?")) return;

    const cache = await caches.open(PATIENT_PHOTO_CACHE);
    await cache.delete(patientPhotoRequest(patientId, photoId));
    await renderPatientPhotosPage(patientId);
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
                                    <small>Fotografie conservate esclusivamente nella cache della PWA.</small>
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

    document.addEventListener("click", event => {
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

        if (event.target.closest("#takePatientPhoto")) {
            const patientId = event.target.closest("#takePatientPhoto")?.dataset.patientId || "";
            if (patientId) openPatientPhotoCapture(patientId);
            return;
        }

        if (event.target.closest("#closePatientPhoto")) {
            event.target.closest(".patient-photo-modal")?.remove();
            return;
        }

        if (event.target.closest(".patient-photo-delete")) {
            const button = event.target.closest(".patient-photo-delete");
            deletePatientPhoto(
                button.dataset.patientId || "",
                button.dataset.photoId || ""
            );
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

    applyTheme("dark");
    orderEditMode = false;
    document.body.classList.remove("order-editing");
}



/* =========================================================
   NAVIGAZIONE
========================================================= */

if (backButton) {

    backButton.addEventListener("click", () => {

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
    rischio: "Effetto avverso",
    attenzione: "Attenzione",
    nota: "Nota"
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
                    <ul id="ddiListaA" class="ddi-suggest" role="listbox" hidden></ul>

                    <label for="drugB">Secondo farmaco</label>
                    <input id="drugB" class="personal-note-title-input" type="text"
                           role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="ddiListaB"
                           autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false"
                           placeholder="Es: amiodarone, midazolam…">
                    <ul id="ddiListaB" class="ddi-suggest" role="listbox" hidden></ul>

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
                            Fonte: DrugBank tramite Therapeutics Data Commons, in inglese; le frasi sono
                            tradotte con un modello fisso e il testo originale è sempre consultabile.
                            Il database indica che un'interazione esiste, non la sua gravità: i colori
                            sono una classificazione indicativa. Le segnalazioni «da verificare» arrivano
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
                    <li role="option" data-i="${i}" aria-selected="false">
                        <strong>${escapeHtml(v.label)}</strong>${v.altro ? `<small>${escapeHtml(v.altro)}</small>` : ""}
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

    elStato.innerHTML = `
        <strong>✓ Archivio caricato</strong>
        <p>${idx.righe.toLocaleString("it-IT")} interazioni tra ${idx.nNomi.toLocaleString("it-IT")} principi attivi, disponibili anche offline.</p>`;
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

    let text = String(value).trim();

    if (!text) {
        return NaN;
    }

    /*
     * Controllo formato:
     *
     * Sono ammessi:
     * 1000
     * 1.000
     * 0,5
     * 1.500,25
     */

    if (!/^\d{1,3}(\.\d{3})*(,\d+)?$|^\d+(,\d+)?$/.test(text)) {
        return NaN;
    }

    text = text.replace(/\./g, "");
    text = text.replace(",", ".");

    const number = Number(text);

    return number;
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

    if (unit === "L") {
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


    function concentrationToMgMl(value, unit) {

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


    function mgMlToUnit(value, unit) {

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
            ? concentrationToMgMl(c1Value, c1Unit.value)
            : null;

        const c2MgMl = c2
            ? concentrationToMgMl(c2Value, c2Unit.value)
            : null;


        // Conversione volumi in mL
        const v1Ml = v1
            ? volumeToMl(v1Value, v1Unit.value)
            : null;

        const v2Ml = v2
            ? volumeToMl(v2Value, v2Unit.value)
            : null;


        // CALCOLA C1
        if (!c1) {

            const calculated =
                (c2MgMl * v2Ml) / v1Ml;

            const finalValue =
                mgMlToUnit(calculated, c1Unit.value);

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
                v1Unit.value === "L"
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
                        ${v1Unit.value}
                    </strong>
                </p>
            `;
        }


        // CALCOLA C2
        else if (!c2) {

            const calculated =
                (c1MgMl * v1Ml) / v2Ml;

            const finalValue =
                mgMlToUnit(calculated, c2Unit.value);

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
                v2Unit.value === "L"
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
                        ${v2Unit.value}
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

            default:
                return "";

        }

    }


    /*
     * CALCOLO AUTOMATICO
     */

    function calculateAutomatically() {

        const volumeFilled =
            volumeInput.value.trim() !== "";

        const durationFilled =
            durationInput.value.trim() !== "";

        const rateFilled =
            rateInput.value.trim() !== "";


        const filled =
            [
                volumeFilled,
                durationFilled,
                rateFilled
            ].filter(Boolean).length;


        /*
         * Se l'utente modifica un campo
         * diverso da quello calcolato,
         * svuotiamo il vecchio risultato.
         */

        if (calculatedField) {

            const currentValues = {
                volume: volumeInput.value.trim(),
                duration: durationInput.value.trim(),
                rate: rateInput.value.trim()
            };

            /*
             * Se il campo calcolato è ancora uguale
             * al valore prodotto precedentemente,
             * lo consideriamo ancora calcolato.
             */

        }


        /*
         * Meno di 2 valori:
         * non possiamo calcolare.
         */

        if (filled < 2) {

            result.style.display = "none";
            result.innerHTML = "";

            calculatedField = null;

            return;
        }


        /*
         * Se tutti e 3 sono compilati:
         * controlliamo se uno è stato generato
         * automaticamente.
         */

        if (filled === 3) {

            /*
             * Se esiste un campo calcolato,
             * lo svuotiamo prima di ricalcolare.
             */

            if (calculatedField === "volume") {

                volumeInput.value = "";
                calculatedField = null;

                calculateAutomatically();
                return;

            }

            if (calculatedField === "duration") {

                durationInput.value = "";
                calculatedField = null;

                calculateAutomatically();
                return;

            }

            if (calculatedField === "rate") {

                rateInput.value = "";
                calculatedField = null;

                calculateAutomatically();
                return;

            }


            /*
             * Tutti e 3 inseriti manualmente.
             */

            result.style.display = "block";

            result.innerHTML = `
                <strong>Lascia vuoto il valore da calcolare.</strong>
            `;

            return;
        }


        /*
         * LETTURA VALORI
         */

        const volume =
            volumeFilled
                ? parseItalianNumber(volumeInput.value)
                : null;

        const duration =
            durationFilled
                ? parseItalianNumber(durationInput.value)
                : null;

        const rate =
            rateFilled
                ? parseItalianNumber(rateInput.value)
                : null;


        /*
         * VALIDAZIONE
         */

        if (
            volumeFilled &&
            (!Number.isFinite(volume) || volume <= 0)
        ) {
            return;
        }

        if (
            durationFilled &&
            (!Number.isFinite(duration) || duration <= 0)
        ) {
            return;
        }

        if (
            rateFilled &&
            (!Number.isFinite(rate) || rate <= 0)
        ) {
            return;
        }


        /*
         * VOLUME → mL
         */

        const volumeMl =
            volumeFilled
                ? volumeToMl(
                    volume,
                    volumeUnit.value
                )
                : null;


        /*
         * DURATA → minuti
         */

        const durationMin =
            durationFilled
                ? timeToMinutes(
                    duration,
                    durationUnit.value
                )
                : null;


        /*
         * VELOCITÀ → mL/min
         */

        let rateMlMin = null;

        if (rateFilled) {

            if (
                rateUnit.value.startsWith("gocce-")
            ) {

                const factor =
                    getDropFactor();

                rateMlMin =
                    rate / factor;

            } else {

                rateMlMin =
                    rate;

            }

        }


        /*
         * =============================================
         * CALCOLO VOLUME
         * =============================================
         */

        if (!volumeFilled) {

            const calculatedMl =
                rateMlMin *
                durationMin;


            let calculated =
                calculatedMl;


            if (volumeUnit.value === "L") {

                calculated =
                    calculatedMl / 1000;

            }


            volumeInput.value =
                formatNumber(calculated);


            calculatedField =
                "volume";


            result.style.display =
                "block";


            result.innerHTML = `
                Volume calcolato:
                <strong>
                    ${formatNumber(calculated)}
                    ${volumeUnit.value}
                </strong>
            `;


            return;
        }


        /*
         * =============================================
         * CALCOLO DURATA
         * =============================================
         */

        if (!durationFilled) {

            const calculatedMin =
                volumeMl /
                rateMlMin;


            let calculated =
                calculatedMin;


            if (durationUnit.value === "h") {

                calculated =
                    calculatedMin / 60;

            }


            durationInput.value =
                formatNumber(calculated);


            calculatedField =
                "duration";


            result.style.display =
                "block";


            result.innerHTML = `
                Durata calcolata:
                <strong>
                    ${formatNumber(calculated)}
                    ${durationUnit.value === "h"
                        ? "ore"
                        : "min"}
                </strong>
            `;


            return;
        }


        /*
         * =============================================
         * CALCOLO VELOCITÀ
         * =============================================
         */

        if (!rateFilled) {

            const calculatedMlMin =
                volumeMl /
                durationMin;


            let calculated;


            if (
                rateUnit.value.startsWith("gocce-")
            ) {

                const factor =
                    getDropFactor();

                calculated =
                    calculatedMlMin *
                    factor;

            } else {

                calculated =
                    calculatedMlMin;

            }


            rateInput.value =
                formatNumber(calculated);


            calculatedField =
                "rate";


            result.style.display =
                "block";


            result.innerHTML = `
                Velocità calcolata:
                <strong>
                    ${formatNumber(calculated)}
                    ${getRateLabel()}
                </strong>
            `;

        }

    }


    /*
     * =============================================
     * INPUT AUTOMATICI
     * =============================================
     */

    volumeInput.addEventListener(
        "input",
        () => {

            if (calculatedField === "volume") {
                calculatedField = null;
            }

            calculateAutomatically();

        }
    );


    durationInput.addEventListener(
        "input",
        () => {

            if (calculatedField === "duration") {
                calculatedField = null;
            }

            calculateAutomatically();

        }
    );


    rateInput.addEventListener(
        "input",
        () => {

            if (calculatedField === "rate") {
                calculatedField = null;
            }

            calculateAutomatically();

        }
    );


    volumeUnit.addEventListener(
        "change",
        calculateAutomatically
    );


    durationUnit.addEventListener(
        "change",
        calculateAutomatically
    );


    rateUnit.addEventListener(
        "change",
        calculateAutomatically
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

    return Number(number)
        .toLocaleString("it-IT", {
            maximumFractionDigits: 2
        });

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

const patientPhotosRoute =
    new URLSearchParams(window.location.search)
        .get("patientPhotos");

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
    const noteLinksButton = document.getElementById("noteLinksButton");
    const appNotesButton = document.getElementById("appNotesButton");
    const shareButton = document.getElementById("sharePersonalizationButton");
    const patientsButton = document.getElementById("patientsButton");
    const resetAllButton = document.getElementById("resetPersonalizationButton");
    const message = document.getElementById("settingsMessage");

    if (!panel || !openButton) return;

    const setMessage = text => {
        if (message) message.textContent = text;
    };

    openButton.addEventListener("click", () => {
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

    noteLinksButton?.addEventListener("click", () => {
        panel.hidden = true;
        window.location.href = "?links=1";
    });

    appNotesButton?.addEventListener("click", () => {
        panel.hidden = true;
        window.location.href = "?appnotes=1";
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

function renderAppNotesPage() {
    const notes = getAppNotes();

    content.innerHTML = `
        <section class="detail-page app-notes-page">
            <div class="detail-header-row">
                <h2>📝 Note</h2>
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
