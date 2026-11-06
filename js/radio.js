// -------------------------
// SPA Navigation
// -------------------------
const sections = document.querySelectorAll('.section');
const navLinks = document.querySelectorAll('header nav a');

// ✅ Google Analytics - navegación SPA
function trackPage(pageName){
  if (typeof gtag !== "undefined") {
    gtag('event', 'page_view', {
      page_title: pageName,
      page_path: '/' + pageName
    });
  }
}

navLinks.forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const target = link.dataset.section;

    sections.forEach(sec => {
      sec.classList.toggle('active', sec.id === target);
    });

    // ✅ DISPARADOR FINAL (Sincronizado con el delay de 800ms del schedule.js)
if (target === 'programacion') {
    // Aumentamos a 300ms para asegurar que la sección 'active' esté pintada
    setTimeout(() => {
        if (typeof runFocusEngine === 'function') {
            runFocusEngine(true); 
        }
    }, 300); 
}

    trackPage(target);
  });
});

// -------------------------
// Radio Player
// -------------------------
const playBtn = document.getElementById('playRadio');
const audio = document.getElementById('radioAudio');
const body = document.body;
const radioStatus = document.getElementById('radioStatus');

const STREAM_URL = "https://playerservices.streamtheworld.com/api/livestream-redirect/SAM05AAC459_SC";

// Estado interno
let isPlaying = false;
let isUserStopping = false;

// ✅ NUEVO: control de tiempo escuchando
let listenTimer = null;
let hasCounted30s = false;

// -------------------------
// STATUS UI
// -------------------------
function setStatus(text, type = ""){
  if (!radioStatus) return;

  radioStatus.textContent = text;
  radioStatus.className = "radio-status";

  if(type){
    radioStatus.classList.add(type);
  }
}

// -------------------------
// UI UPDATE (ACTUALIZADA)
// -------------------------
function updateUIPlayingState(state) {
  isPlaying = state;
  body.classList.toggle('playing', state);

  if (state) {
    // Modo PAUSA: Icono con dos barras blancas
    playBtn.innerHTML = `
      <svg viewBox="0 0 24 24" style="width: 35px; height: 35px; fill: #ffffff;">
        <rect x="6" y="5" width="4" height="14"/>
        <rect x="14" y="5" width="4" height="14"/>
      </svg>`;
  } else {
    // Modo PLAY: Triángulo negro
    playBtn.innerHTML = `
      <svg viewBox="0 0 24 24" style="width: 35px; height: 35px; fill: #000000;">
        <path d="M8 5v14l11-7z"/>
      </svg>`;
  }
}

// -------------------------
// PLAY (CORREGIDO: APAGA EL SERMÓN ANTES DE REPRODUCIR EN VIVO)
// -------------------------
function playLive() {
  isUserStopping = false;

  setStatus("Conectando...", "loading");

  // DETENER EL REPRODUCTOR DE SERMONES DE RAÍZ SI ESTÁ SONANDO
  try {
    const sermonAudioEl = document.getElementById('audioSermonPlayer');
    if (sermonAudioEl && !sermonAudioEl.paused) {
        sermonAudioEl.pause();
        
        // Forzamos el icono del reproductor de sermones a que vuelva a "Play"
        const sermonPlayIconEl = document.getElementById('custom-play-icon');
        if (sermonPlayIconEl) {
            sermonPlayIconEl.className = "fas fa-play";
        }
    }
  } catch(e) {
    console.log("No se pudo pausar el reproductor de sermones desde la radio:", e);
  }

  // Ahora sí, cargamos y reproducimos la emisora en vivo
  audio.src = STREAM_URL;
  audio.load();

  const playPromise = audio.play();

  if (playPromise !== undefined) {
    playPromise.catch(err => {
      console.error('Error al reproducir:', err);
      setStatus("No se pudo reproducir", "error");
      updateUIPlayingState(false);
    });
  }
}

// -------------------------
// PAUSE / STOP
// -------------------------
function stopLive() {
  isUserStopping = true;
  audio.pause();

  // limpiar timer
  clearTimeout(listenTimer);
}

// -------------------------
// BUTTON CLICK
// -------------------------
playBtn.addEventListener('click', () => {
  if (!isPlaying) {
    playLive();
  } else {
    stopLive();
  }

  // ✅ Analytics play/pause
  if (typeof gtag !== "undefined") {
    gtag('event', 'play_radio', {
      event_category: 'radio',
      event_label: isPlaying ? 'pause' : 'play'
    });
  }
});

// -------------------------
// AUDIO EVENTS (CORREGIDOS PARA CONTROL CRUZADO)
// -------------------------

audio.addEventListener('play', () => {
  updateUIPlayingState(true);
  setStatus("🔴 En vivo", "live");

  if (typeof gtag !== "undefined") {
    gtag('event', 'radio_session_start');
  }

  hasCounted30s = false;
  clearTimeout(listenTimer);

  listenTimer = setTimeout(() => {
    if (!hasCounted30s && !isUserStopping) {
      hasCounted30s = true;
      if (typeof gtag !== "undefined") {
        gtag('event', 'listened_30s');
      }
    }
  }, 30000);
});

// Corrección crucial: Si se pausa por cualquier motivo (interno o externo), actualizamos la UI
audio.addEventListener('pause', () => {
  updateUIPlayingState(false);
  setStatus("Pausado");

  if (typeof gtag !== "undefined" && isUserStopping) {
    gtag('event', 'radio_session_end');
  }

  clearTimeout(listenTimer);
});

audio.addEventListener('ended', () => {
  updateUIPlayingState(false);
  setStatus("Pausado");
  clearTimeout(listenTimer);
});

audio.addEventListener('error', () => {
  if (isUserStopping) return;
  console.error("Error en el stream");
  updateUIPlayingState(false);
  setStatus("Error de conexión", "error");
  clearTimeout(listenTimer);
});

// HACEMOS LA FUNCIÓN DE DETENER LA RADIO ACCESIBLE PARA OTROS SCRIPTS
window.apagarRadioDesdeSermon = function() {
  isUserStopping = true;
  audio.pause();
  updateUIPlayingState(false);
  setStatus("Pausado");
  clearTimeout(listenTimer);
};

// -------------------------
// PWA DETECTION
// -------------------------
function detectPWA(){
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

  if (isStandalone && typeof gtag !== "undefined") {
    gtag('event', 'pwa_used');
  }
}

detectPWA();

// -------------------------
// INIT
// -------------------------
updateUIPlayingState(false);
setStatus("");

// -------------------------
// PWA INSTALLATION LOGIC
// -------------------------
const installTrigger = document.getElementById('installTrigger');
let deferredPrompt;

// Escuchamos el evento que dispara el navegador cuando la app es instalable
window.addEventListener('beforeinstallprompt', (e) => {
    // Prevenimos que se muestre el aviso automático (para mostrarlo con nuestro botón)
    e.preventDefault();
    deferredPrompt = e;
    
    // Si existe el botón en el header, lo mostramos
    if (installTrigger) {
        installTrigger.style.display = 'block';
    }
});

// Lógica de clic del botón
if (installTrigger) {
    installTrigger.addEventListener('click', () => {
        if (deferredPrompt) {
            // Disparamos la ventana nativa de instalación
            deferredPrompt.prompt();
            
            // Esperamos a ver qué hizo el usuario
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    // Si aceptó, ocultamos el botón
                    installTrigger.style.display = 'none';
                }
                deferredPrompt = null;
            });
        } else {
            // Mensaje de ayuda si el navegador no disparó el evento antes
            alert("Para instalar Pura Gracia Radio:\n\nAndroid: Toca los 3 puntos (⋮) en el menú del navegador y elige 'Instalar aplicación'.\n\niPhone: Toca el botón 'Compartir' (📤) y selecciona 'Agregar al inicio'.");
        }
    });
}

// Ocultar el botón si la app ya está instalada (por si acaso)
window.addEventListener('appinstalled', () => {
    if (installTrigger) installTrigger.style.display = 'none';
    deferredPrompt = null;
});
