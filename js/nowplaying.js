// js/nowplaying.js
const nowPlayingBox = document.getElementById("nowPlayingBox");
const DEFAULT_COVER = "/default-cover.png";
const SLOGAN = "Música y contenido en sintonía con el evangelio de Cristo"; 
let currentTrack = null;
let programsList = [];
let lastActiveProgram = null;

async function loadPrograms() {
    try {
        const response = await fetch('/data/programs.json');
        const data = await response.json();
        programsList = data.programs;
        console.log("Catálogo de programas cargado:", programsList.length);
    } catch (err) {
        console.error("No se pudo cargar el catálogo de programas:", err);
    }
}

function updateNowPlaying(metadata) {
    // 1. Definimos los textos
    let title = (metadata && metadata.title && metadata.title.trim() !== "") ? metadata.title.trim() : "Pura Gracia Radio";
    
    // Si el título es la radio O el artista está vacío, mostramos el eslogan.
const artist = (title === "Pura Gracia Radio" || !metadata.artist || metadata.artist.trim() === "") 
               ? SLOGAN 
               : metadata.artist.trim();
    
    const album = (metadata && metadata.album) ? metadata.album.trim() : "";
    
    let prog = programsList.find(p => 
        title.toLowerCase().includes(p.name.toLowerCase()) || 
        p.name.toLowerCase().includes(title.toLowerCase()) ||
        (album && album.toLowerCase().includes(p.name.toLowerCase())) ||
        (album && p.name.toLowerCase().includes(album.toLowerCase()))
    );

    // --- LÓGICA DE RETENCIÓN DE PROGRAMA ---
    if (!prog && title === "Pura Gracia Radio" && lastActiveProgram) {
        prog = lastActiveProgram;
        title = prog.name; 
    } else if (prog) {
        lastActiveProgram = prog;
    } else if (title === "Pura Gracia Radio") {
        lastActiveProgram = null;
    }
    // ----------------------------------------

    const coverArt = (metadata && metadata.coverArt && metadata.coverArt !== "") 
                     ? metadata.coverArt 
                     : (prog ? prog.artwork : DEFAULT_COVER);

    const newTrackId = `${title}_${artist}_${album}`.toLowerCase();
    if (currentTrack === newTrackId) return;
    currentTrack = newTrackId;

    // 2. Construcción de la UI
    let card = nowPlayingBox.querySelector(".now-card") || document.createElement("div");
    card.className = "now-card";
    if (!nowPlayingBox.contains(card)) nowPlayingBox.appendChild(card);

    // ... (dentro de updateNowPlaying) ...

    let coverImg = card.querySelector("img") || document.createElement("img");
    coverImg.onerror = () => { coverImg.src = DEFAULT_COVER; };
    coverImg.src = coverArt;
    
    // --- ESTAS DOS LÍNEAS ACTIVAN EL COMPARTIR AL TOCAR LA CARÁTULA ---
    coverImg.style.cursor = "pointer"; 
    coverImg.onclick = ejecutarCompartir;
    // ------------------------------------------------------------------

    if (!card.contains(coverImg)) card.prepend(coverImg);

    // ... (resto del código) ...

    let infoDiv = card.querySelector(".now-info") || document.createElement("div");
    infoDiv.className = "now-info";
    
    const isSlogan = (artist === SLOGAN);
    // ------------------------------------

    infoDiv.innerHTML = `
        <div class="np-meta-viewport">
            <div class="marquee-container"><div class="np-line title marquee">${title}</div></div>
            <div class="np-line artist ${isSlogan ? 'slogan-text' : ''}">${artist}</div>
            ${album ? `<div class="np-line album">${album}</div>` : ""}
        </div>
    `;
    
    if (!card.contains(infoDiv)) card.appendChild(infoDiv);

    if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({ title, artist, album, artwork: [{ src: coverArt, sizes: "512x512", type: "image/png" }] });
    }
}

async function fetchNowPlaying() {
    try {
        const res = await fetch(`https://pg-radio-webhook-ji26cdibb-antolins-projects-3931f532.vercel.app/api/radioboss-nowplaying?cb=${Math.random()}`);
        const data = await res.json();
        updateNowPlaying(data);
    } catch (err) {
        // Al enviar solo el título default, la función updateNowPlaying 
        // detectará que debe mostrar el eslogan automáticamente.
        updateNowPlaying({ title: "Pura Gracia Radio" });
    }
}

// Inicialización
loadPrograms().then(fetchNowPlaying);
setInterval(fetchNowPlaying, 15000);

// Función centralizada para compartir (CÓDIGO NUEVO)
async function ejecutarCompartir() {
    const title = document.querySelector('.np-line.title')?.innerText || "Programación";
    const artist = document.querySelector('.np-line.artist')?.innerText || "";
    const trackInfo = artist ? `${title} - ${artist}` : title;

    const shareData = {
        title: 'Pura Gracia Radio',
        text: `Estoy escuchando "${trackInfo}" en Pura Gracia Radio:`,
        url: 'https://puragracia.com/'
    };

    try {
        if (navigator.share) {
            await navigator.share(shareData);
        } else {
            navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
            alert('Enlace copiado al portapapeles');
        }
    } catch (err) {
        console.log('Error al compartir:', err);
    }
}

// Inicialización de eventos al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
    const btnCompartir = document.getElementById('btnCompartirDinamico');
    if (btnCompartir) {
        btnCompartir.addEventListener('click', ejecutarCompartir);
    }
});
