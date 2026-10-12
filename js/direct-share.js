/* Trasferimento diretto telefono → telefono (con foto), senza file e senza server.
   I due telefoni si scambiano due QR (offerta e risposta WebRTC); poi i dati
   passano direttamente da un dispositivo all'altro.
   Servizio gratuito: l'unico appoggio esterno è un server STUN pubblico, che serve
   solo a far trovare i due telefoni in rete e non vede i dati. */
(function (global) {
    "use strict";

    const PREFIX = "NSD1";
    const CHUNK = 12000;
    const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

    /* ---------- SDP compatto: solo i campi indispensabili ---------- */

    function compactSdp(sdp) {
        const get = re => { const m = sdp.match(re); return m ? m[1].trim() : ""; };
        const candidates = [];
        sdp.split(/\r?\n/).forEach(line => {
            if (!line.startsWith("a=candidate:")) return;
            const parts = line.slice(12).split(" ");
            if (String(parts[2]).toLowerCase() !== "udp") return;
            if (String(parts[4]).includes(":")) return;         // niente IPv6: QR più corto
            candidates.push(line.slice(12));
        });
        // host e srflx per primi, al massimo 4 candidati
        candidates.sort((a, b) => (/ typ host/.test(b) ? 1 : 0) - (/ typ host/.test(a) ? 1 : 0));
        return {
            u: get(/a=ice-ufrag:(.+)/),
            p: get(/a=ice-pwd:(.+)/),
            f: get(/a=fingerprint:sha-256 (.+)/).replace(/:/g, ""),
            c: candidates.slice(0, 4)
        };
    }

    function buildSdp(info, role) {
        const fp = (info.f.match(/.{2}/g) || []).join(":").toUpperCase();
        return [
            "v=0",
            "o=- 1 2 IN IP4 127.0.0.1",
            "s=-",
            "t=0 0",
            "a=group:BUNDLE 0",
            "a=msid-semantic: WMS",
            "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
            "c=IN IP4 0.0.0.0",
            "a=ice-ufrag:" + info.u,
            "a=ice-pwd:" + info.p,
            "a=fingerprint:sha-256 " + fp,
            "a=setup:" + (role === "offer" ? "actpass" : "active"),
            "a=mid:0",
            "a=sctp-port:5000",
            "a=max-message-size:262144",
            ...info.c.map(c => "a=candidate:" + c)
        ].join("\r\n") + "\r\n";
    }

    const encodeCode = info => PREFIX + btoa(JSON.stringify(info));

    function decodeCode(text) {
        const raw = String(text || "").trim();
        if (!raw.startsWith(PREFIX)) throw new Error("Codice non riconosciuto.");
        const info = JSON.parse(atob(raw.slice(PREFIX.length)));
        if (!info || !info.u || !info.p || !info.f) throw new Error("Codice incompleto.");
        return info;
    }

    function gatheringComplete(pc, timeoutMs) {
        return new Promise(resolve => {
            if (pc.iceGatheringState === "complete") return resolve();
            const done = () => { clearTimeout(timer); pc.removeEventListener("icegatheringstatechange", check); resolve(); };
            const check = () => { if (pc.iceGatheringState === "complete") done(); };
            const timer = setTimeout(done, timeoutMs);
            pc.addEventListener("icegatheringstatechange", check);
        });
    }

    /* ---------- interfaccia ---------- */

    function openDialog(id) {
        document.getElementById(id)?.remove();
        const dialog = document.createElement("div");
        dialog.id = id;
        dialog.className = "notes-qr-dialog";
        document.body.appendChild(dialog);
        return dialog;
    }

    const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

    /* Mostra un QR (con codice copiabile) e restituisce il dialogo. */
    function showCodeDialog(id, title, text, code, nextLabel) {
        const dialog = openDialog(id);
        dialog.innerHTML = `
            <div class="notes-qr-card direct-share-card">
                <button class="notes-qr-close" type="button" aria-label="Chiudi">×</button>
                <h3>${esc(title)}</h3>
                <p>${text}</p>
                <canvas class="direct-share-qr" aria-label="QR code"></canvas>
                <button class="settings-action direct-share-copy" type="button">📋 Copia codice (alternativa al QR)</button>
                ${nextLabel ? `<button class="settings-action direct-share-next" type="button">${esc(nextLabel)}</button>` : ""}
                <p class="settings-message direct-share-status"></p>
            </div>`;
        const canvas = dialog.querySelector("canvas");
        try {
            global.NursingQR.draw(canvas, code, 360);
        } catch (error) {
            canvas.replaceWith(Object.assign(document.createElement("p"), { textContent: "QR troppo grande: usa «Copia codice»." }));
        }
        dialog.querySelector(".direct-share-copy").addEventListener("click", async () => {
            try { await navigator.clipboard.writeText(code); dialog.querySelector(".direct-share-status").textContent = "Codice copiato."; }
            catch (_) { global.prompt("Copia questo codice:", code); }
        });
        return dialog;
    }

    /* Legge un QR con la fotocamera. Restituisce il testo, oppure null se annullato. */
    function scanCode(title, hint) {
        return new Promise(resolve => {
            const dialog = openDialog("directShareScan");
            dialog.innerHTML = `
                <div class="notes-qr-card notes-qr-reader-card">
                    <button class="notes-qr-close" type="button" aria-label="Chiudi">×</button>
                    <h3>${esc(title)}</h3>
                    <p>${esc(hint)}</p>
                    <video class="notes-qr-video" autoplay muted playsinline></video>
                    <p class="settings-message direct-share-status">Richiesta accesso alla fotocamera…</p>
                    <button class="settings-action direct-share-paste" type="button">⌨️ Incolla il codice</button>
                </div>`;
            const video = dialog.querySelector("video");
            const status = dialog.querySelector(".direct-share-status");
            let stream = null, stopped = false, timer = 0;

            const finish = value => {
                if (stopped) return;
                stopped = true;
                clearTimeout(timer);
                if (stream) stream.getTracks().forEach(t => t.stop());
                dialog.remove();
                resolve(value);
            };

            dialog.querySelector(".notes-qr-close").addEventListener("click", () => finish(null));
            dialog.querySelector(".direct-share-paste").addEventListener("click", () => {
                const text = global.prompt("Incolla qui il codice copiato dall'altro telefono:");
                if (text) finish(text.trim());
            });

            (async () => {
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !("BarcodeDetector" in global)) {
                    status.textContent = "Questo browser non legge i QR con la fotocamera: usa «Incolla il codice».";
                    return;
                }
                try {
                    const detector = new global.BarcodeDetector({ formats: ["qr_code"] });
                    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
                    if (stopped) { stream.getTracks().forEach(t => t.stop()); return; }
                    video.srcObject = stream;
                    status.textContent = "Fotocamera attiva. Inquadra il QR…";
                    const tick = async () => {
                        if (stopped) return;
                        try {
                            const found = await detector.detect(video);
                            const hit = found.find(code => String(code.rawValue || "").startsWith(PREFIX));
                            if (hit) return finish(hit.rawValue);
                        } catch (_) {}
                        timer = setTimeout(tick, 250);
                    };
                    tick();
                } catch (error) {
                    status.textContent = "Fotocamera non disponibile: usa «Incolla il codice».";
                }
            })();
        });
    }

    function progressDialog(id, title) {
        const dialog = openDialog(id);
        dialog.innerHTML = `
            <div class="notes-qr-card direct-share-card">
                <button class="notes-qr-close" type="button" aria-label="Chiudi">×</button>
                <h3>${esc(title)}</h3>
                <p class="direct-share-progress">Connessione in corso…</p>
                <progress class="direct-share-bar" max="100" value="0" hidden></progress>
            </div>`;
        const text = dialog.querySelector(".direct-share-progress");
        const bar = dialog.querySelector("progress");
        return {
            dialog,
            set(message, percent) {
                text.textContent = message;
                if (typeof percent === "number") { bar.hidden = false; bar.value = percent; }
            },
            onClose(fn) { dialog.querySelector(".notes-qr-close").addEventListener("click", fn); },
            close() { dialog.remove(); }
        };
    }

    /* ---------- mittente ---------- */

    async function send(payload) {
        if (!global.RTCPeerConnection) {
            global.alert("Questo browser non supporta il trasferimento diretto.");
            return;
        }
        const json = JSON.stringify(payload);
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        const channel = pc.createDataChannel("nursing", { ordered: true });
        let closed = false;
        const cleanup = () => { closed = true; try { channel.close(); } catch (_) {} try { pc.close(); } catch (_) {} };

        try {
            await pc.setLocalDescription(await pc.createOffer());
            await gatheringComplete(pc, 4000);
            const offerCode = encodeCode(compactSdp(pc.localDescription.sdp));

            const qrDialog = showCodeDialog(
                "directShareOffer",
                "📲 Trasferimento diretto — 1/2",
                "Sull'altro telefono apri <b>Condividi / importa → Ricevi direttamente</b> e inquadra questo QR.",
                offerCode,
                "➡️ Fatto: leggi la risposta"
            );

            const abort = () => { qrDialog.remove(); cleanup(); };
            qrDialog.querySelector(".notes-qr-close").addEventListener("click", abort);

            const answerCode = await new Promise(resolve => {
                qrDialog.querySelector(".direct-share-next").addEventListener("click", async () => {
                    qrDialog.style.display = "none";
                    const text = await scanCode("📷 Leggi la risposta", "Inquadra il QR mostrato dall'altro telefono.");
                    if (text) { qrDialog.remove(); resolve(text); } else qrDialog.style.display = "";
                });
                qrDialog.querySelector(".notes-qr-close").addEventListener("click", () => resolve(null));
            });
            if (!answerCode) return cleanup();

            const progress = progressDialog("directShareProgress", "📲 Invio in corso");
            progress.onClose(() => { progress.close(); cleanup(); });

            const info = decodeCode(answerCode);
            await pc.setRemoteDescription({ type: "answer", sdp: buildSdp(info, "answer") });

            await new Promise((resolve, reject) => {
                if (channel.readyState === "open") return resolve();
                const timer = setTimeout(() => reject(new Error("Connessione non riuscita. I due telefoni devono essere online.")), 25000);
                channel.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
                pc.addEventListener("connectionstatechange", () => {
                    if (pc.connectionState === "failed") { clearTimeout(timer); reject(new Error("Connessione non riuscita. I due telefoni devono essere online.")); }
                });
            });

            const total = Math.ceil(json.length / CHUNK);
            channel.bufferedAmountLowThreshold = 256 * 1024;
            const ack = new Promise(resolve => channel.addEventListener("message", event => { if (event.data === "OK") resolve(true); }));
            channel.send("H:" + JSON.stringify({ chunks: total, size: json.length }));

            for (let i = 0; i < total; i++) {
                if (closed) throw new Error("Trasferimento interrotto.");
                if (channel.bufferedAmount > 1024 * 1024) {
                    await new Promise(resolve => channel.addEventListener("bufferedamountlow", resolve, { once: true }));
                }
                channel.send(json.slice(i * CHUNK, (i + 1) * CHUNK));
                progress.set("Invio… " + (i + 1) + " / " + total, Math.round(((i + 1) / total) * 100));
            }

            progress.set("Attendo conferma dall'altro telefono…", 100);
            await Promise.race([ack, new Promise((_, reject) => setTimeout(() => reject(new Error("Nessuna conferma dal destinatario.")), 30000))]);
            progress.set("✅ Inviato.", 100);
            setTimeout(() => { progress.close(); cleanup(); }, 1500);
        } catch (error) {
            console.error("Invio diretto:", error);
            document.getElementById("directShareProgress")?.remove();
            cleanup();
            global.alert(error && error.message ? error.message : "Trasferimento non riuscito.");
        }
    }

    /* ---------- destinatario ---------- */

    async function receive(onPayload) {
        if (!global.RTCPeerConnection) {
            global.alert("Questo browser non supporta il trasferimento diretto.");
            return;
        }
        const offerText = await scanCode("📷 Ricevi direttamente", "Inquadra il QR mostrato dal telefono che invia.");
        if (!offerText) return;

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        let finished = false;
        const cleanup = () => { finished = true; try { pc.close(); } catch (_) {} };

        try {
            const info = decodeCode(offerText);
            await pc.setRemoteDescription({ type: "offer", sdp: buildSdp(info, "offer") });
            await pc.setLocalDescription(await pc.createAnswer());
            await gatheringComplete(pc, 4000);
            const answerCode = encodeCode(compactSdp(pc.localDescription.sdp));

            const qrDialog = showCodeDialog(
                "directShareAnswer",
                "📲 Ricevi direttamente — 2/2",
                "Fai inquadrare questo QR al telefono che invia, poi attendi qui.",
                answerCode,
                ""
            );
            qrDialog.querySelector(".notes-qr-close").addEventListener("click", () => { qrDialog.remove(); cleanup(); });

            const channel = await new Promise((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error("Nessuna connessione dall'altro telefono.")), 120000);
                pc.addEventListener("datachannel", event => { clearTimeout(timer); resolve(event.channel); }, { once: true });
            });
            qrDialog.remove();

            const progress = progressDialog("directShareProgress", "📲 Ricezione in corso");
            progress.onClose(() => { progress.close(); cleanup(); });

            const received = await new Promise((resolve, reject) => {
                let expected = 0, parts = [], count = 0;
                channel.addEventListener("message", event => {
                    const data = event.data;
                    if (typeof data !== "string") return;
                    if (data.startsWith("H:") && !expected) {
                        try { expected = JSON.parse(data.slice(2)).chunks; } catch (_) { return reject(new Error("Dati non validi.")); }
                        return;
                    }
                    parts.push(data);
                    count++;
                    progress.set("Ricezione… " + count + " / " + expected, expected ? Math.round((count / expected) * 100) : 0);
                    if (expected && count >= expected) {
                        try { channel.send("OK"); } catch (_) {}
                        resolve(parts.join(""));
                    }
                });
                pc.addEventListener("connectionstatechange", () => {
                    if (!finished && (pc.connectionState === "failed" || pc.connectionState === "disconnected")) reject(new Error("Connessione interrotta."));
                });
            });

            progress.close();
            setTimeout(cleanup, 1500);
            await onPayload(JSON.parse(received));
        } catch (error) {
            console.error("Ricezione diretta:", error);
            document.getElementById("directShareProgress")?.remove();
            document.getElementById("directShareAnswer")?.remove();
            cleanup();
            global.alert(error && error.message ? error.message : "Ricezione non riuscita.");
        }
    }

    global.DirectShare = { send, receive, _compactSdp: compactSdp, _buildSdp: buildSdp };
})(window);
