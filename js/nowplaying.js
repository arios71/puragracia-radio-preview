// js/nowplaying.js
const nowPlayingBox = document.getElementById("nowPlayingBox");
const DEFAULT_COVER = new URL("default-cover.png", APP_BASE).href;
const SLOGAN = "Música y contenido en sintonía con el evangelio de Cristo";
const NOWPLAYING_URL = "https://pg-radio-webhook-ji26cdibb-antolins-projects-3931f532.vercel.app/api/radioboss-nowplaying";
let currentTrack = null;
let programsList = [];
let lastActiveProgram = null;

const asText = value => typeof value === "string" ? value.trim() : (value == null ? "" : String(value).trim());

async function loadNowPlayingPrograms() {
    try {
        const response = await fetch(new URL("data/programs.json", APP_BASE));
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        programsList = (Array.isArray(data.programs) ? data.programs : [])
            .map(program => ({ ...program, artwork: program.artwork ? resolveAppAsset(program.artwork) : "" }));
        console.log("Catálogo de programas cargado:", programsList.length);
    } catch (err) {
        console.error("No se pudo cargar el catálogo de programas:", err);
    }
}

function updateNowPlaying(metadata) {
    if (!nowPlayingBox) {
        console.error("No existe #nowPlayingBox en el documento.");
        return;
    }

    let title = asText(metadata?.title) || "Pura Gracia Radio";
    const rawArtist = asText(metadata?.artist);
    const album = asText(metadata?.album);
    const artist = (title === "Pura Gracia Radio" || !rawArtist) ? SLOGAN : rawArtist;

    let prog = programsList.find(p =>
        title.toLowerCase().includes(asText(p.name).toLowerCase()) ||
        asText(p.name).toLowerCase().includes(title.toLowerCase()) ||
        (album && album.toLowerCase().includes(asText(p.name).toLowerCase())) ||
        (album && asText(p.name).toLowerCase().includes(album.toLowerCase()))
    );

    if (!prog && title === "Pura Gracia Radio" && lastActiveProgram) {
        prog = lastActiveProgram;
        title = prog.name;
    } else if (prog) {
        lastActiveProgram = prog;
    } else if (title === "Pura Gracia Radio") {
        lastActiveProgram = null;
    }

    const coverArt = asText(metadata?.coverArt) || (prog?.artwork || DEFAULT_COVER);
    const newTrackId = `${title}_${artist}_${album}_${coverArt}`.toLowerCase();

    let card = nowPlayingBox.querySelector(".now-card");
    if (!card) {
        card = document.createElement("div");
        card.className = "now-card";
        nowPlayingBox.appendChild(card);
    }

    if (currentTrack === newTrackId && card.querySelector("img") && card.querySelector(".now-info")) return;
    currentTrack = newTrackId;

    let coverImg = card.querySelector("img");
    if (!coverImg) {
        coverImg = document.createElement("img");
        card.prepend(coverImg);
    }
    coverImg.onerror = () => {
        if (coverImg.src !== DEFAULT_COVER) coverImg.src = DEFAULT_COVER;
    };
    coverImg.src = coverArt;
    coverImg.alt = "Carátula de lo que está sonando";
    coverImg.style.cursor = "pointer";
    coverImg.onclick = ejecutarCompartir;

    let infoDiv = card.querySelector(".now-info");
    if (!infoDiv) {
        infoDiv = document.createElement("div");
        infoDiv.className = "now-info";
        card.appendChild(infoDiv);
    }

    const isSlogan = artist === SLOGAN;
    infoDiv.innerHTML = `
        <div class="np-meta-viewport">
            <div class="marquee-container"><div class="np-line title marquee">${title}</div></div>
            <div class="np-line artist ${isSlogan ? "slogan-text" : ""}">${artist}</div>
            ${album ? `<div class="np-line album">${album}</div>` : ""}
        </div>
    `;

    if ("mediaSession" in navigator && "MediaMetadata" in window) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title, artist, album,
            artwork: [{ src: coverArt, sizes: "512x512", type: "image/jpeg" }]
        });
    }
}

async function fetchNowPlaying() {
    try {
        const res = await fetch(`${NOWPLAYING_URL}?cb=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        // La API de RadioBOSS entrega los campos dentro de data.nowPlaying.
        // También aceptamos respuestas planas para mantener compatibilidad.
        const metadata = data?.nowPlaying || data?.data?.nowPlaying || data?.data || data;
        if (!metadata || typeof metadata !== "object") throw new Error("Respuesta de metadata vacía");
        console.log("Metadata RadioBOSS recibida:", metadata);
        updateNowPlaying(metadata);
    } catch (err) {
        console.error("No se pudo obtener metadata de RadioBOSS:", err);
        updateNowPlaying({ title: "Pura Gracia Radio" });
    }
}

loadNowPlayingPrograms().finally(fetchNowPlaying);
setInterval(fetchNowPlaying, 15000);

async function ejecutarCompartir() {
    const title = document.querySelector(".np-line.title")?.innerText || "Programación";
    const artist = document.querySelector(".np-line.artist")?.innerText || "";
    const trackInfo = artist ? `${title} - ${artist}` : title;
    const shareData = {
        title: "Pura Gracia Radio",
        text: `Estoy escuchando "${trackInfo}" en Pura Gracia Radio:`,
        url: window.location.href.split("#")[0]
    };

    try {
        if (navigator.share) {
            await navigator.share(shareData);
        } else {
            await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
            alert("Enlace copiado al portapapeles");
        }
    } catch (err) {
        console.log("Error al compartir:", err);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const btnCompartir = document.getElementById("btnCompartirDinamico");
    if (btnCompartir) btnCompartir.addEventListener("click", ejecutarCompartir);
});
