(function() {
    const RSS_FEED_URL = "https://anchor.fm/s/dc304bfc/podcast/rss";

    let sermonAudio, sermonPlayBtn, sermonPlayIcon, sermonProgressBar, sermonProgressContainer, sermonTimeDisplay;
    
    // Variables para controlar la paginación limpia
    let todosLosEpisodios = [];
    let episodiosVisibles = 5;

    function vincularControles() {
        sermonAudio = document.getElementById('audioSermonPlayer');
        sermonPlayBtn = document.getElementById('custom-play-btn');
        sermonPlayIcon = document.getElementById('custom-play-icon');
        sermonProgressBar = document.getElementById('custom-progress-bar');
        sermonProgressContainer = document.getElementById('custom-progress-container');
        sermonTimeDisplay = document.getElementById('custom-player-time');

        if (sermonPlayBtn && sermonAudio && sermonProgressContainer) {
            sermonPlayBtn.onclick = togglePlaySermon;
            sermonAudio.ontimeupdate = actualizarProgresoSermon;
            sermonProgressContainer.onclick = buscarTiempoSermon;
            sermonAudio.onended = () => { if (sermonPlayIcon) sermonPlayIcon.className = "fas fa-play"; };
        }
    }

    async function cargarPodcast() {
        vincularControles();
        try {
            const response = await fetch(RSS_FEED_URL);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const xmlText = await response.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "text/xml");
            
            const items = xmlDoc.querySelectorAll("item");
            
            if (items && items.length > 0) {
                todosLosEpisodios = [];
                
                let defaultChannelImage = "/assets/icons/logo-192.png";
                const channelImageEl = xmlDoc.querySelector("channel > image > url");
                if (channelImageEl) {
                    defaultChannelImage = channelImageEl.textContent;
                }

                items.forEach(item => {
                    const title = item.querySelector("title")?.textContent || "Sermón sin título";
                    const pubDate = item.querySelector("pubDate")?.textContent || "";
                    const enclosure = item.querySelector("enclosure");
                    const mp3Url = enclosure ? enclosure.getAttribute("url") : "";
                    
                    let thumbnail = defaultChannelImage;
                    const itunesImage = item.getElementsByTagName("itunes:image")[0];
                    if (itunesImage) {
                        thumbnail = itunesImage.getAttribute("href") || thumbnail;
                    } else {
                        const altImage = item.querySelector("image")?.getAttribute("href");
                        if (altImage) thumbnail = altImage;
                    }

                    const asegurarHttps = (url) => url && url.startsWith("http://") ? url.replace("http://", "https://") : url;

                    todosLosEpisodios.push({ 
                        title, 
                        pubDate, 
                        mp3Url: mp3Url ? asegurarHttps(mp3Url) : "", 
                        thumbnail: asegurarHttps(thumbnail) 
                    });
                });

                let episodioParaPlayer = todosLosEpisodios.find(ep => ep.mp3Url !== "");
                if (!episodioParaPlayer) episodioParaPlayer = todosLosEpisodios[0];

                // Inyectar el reproductor con su carátula
                inyectarAudioSermon(episodioParaPlayer.title, episodioParaPlayer.mp3Url, episodioParaPlayer.thumbnail, false);
                
                // Mostrar los primeros 5 episodios en el historial
                episodiosVisibles = 5; 
                renderizarListaHistorial();
                
            } else {
                marcarError();
            }
        } catch (error) {
            console.error("Error procesando XML del podcast:", error);
            marcarError();
        }
    }

    function renderizarListaHistorial() {
        const archiveContainer = document.getElementById('sermons-archive-list');
        if (!archiveContainer) return;

        archiveContainer.innerHTML = '';

        const fragmentoEpisodios = todosLosEpisodios.slice(0, episodiosVisibles);

        fragmentoEpisodios.forEach(item => {
            const fecha = item.pubDate ? new Date(item.pubDate).toLocaleDateString('es-ES', {
                month: 'short', day: 'numeric', year: 'numeric'
            }) : "Pura Gracia Radio";

            const tarjeta = document.createElement('div');
            tarjeta.style.cssText = "display: flex; align-items: center; background: #1a2436; padding: 12px; margin-bottom: 12px; border-radius: 8px; cursor: pointer; transition: transform 0.2s; box-shadow: 0 4px 6px rgba(0,0,0,0.1); font-family: system-ui, sans-serif; width: 100%; box-sizing: border-box;";
            
            tarjeta.onmouseenter = () => tarjeta.style.transform = "scale(1.01)";
            tarjeta.onmouseleave = () => tarjeta.style.transform = "scale(1)";
            
            tarjeta.onclick = () => {
                if (!item.mp3Url) {
                    alert("Este episodio aún se está procesando.");
                    return;
                }
                inyectarAudioSermon(item.title, item.mp3Url, item.thumbnail, true);
                const seccionSermones = document.getElementById('sermones');
                if (seccionSermones) seccionSermones.scrollTo({ top: 0, behavior: 'smooth' });
            };

            const estiloTexto = item.mp3Url ? "color: #ffffff;" : "color: #718096; font-style: italic;";

            tarjeta.innerHTML = `
                <img src="${item.thumbnail}" alt="Portada" style="width: 50px; height: 50px; border-radius: 6px; margin-right: 12px; object-fit: cover; flex-shrink: 0; ${!item.mp3Url ? 'opacity: 0.5;' : ''}">
                <div style="flex-grow: 1; min-width: 0; text-align: left;">
                    <h4 style="${estiloTexto} margin: 0 0 4px 0; font-size: 0.95rem; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;">
                        ${item.title} ${!item.mp3Url ? ' (Procesando)' : ''}
                    </h4>
                    <span style="color: #a0aec0; font-size: 0.8rem; display: block;">
                        ${fecha}
                    </span>
                </div>
                <div style="color: ${item.mp3Url ? '#fbac33' : '#4a5568'}; padding-left: 8px; display: flex; align-items: center; flex-shrink: 0;">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
                </div>
            `;
            archiveContainer.appendChild(tarjeta);
        });

        if (episodiosVisibles < todosLosEpisodios.length) {
            const btnVerMas = document.createElement('button');
            btnVerMas.innerText = "Ver más episodios";
            btnVerMas.style.cssText = "width: 100%; background: transparent; border: 2px solid #fbac33; color: #fbac33; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer; margin-top: 10px; margin-bottom: 25px; font-family: system-ui, sans-serif; transition: background 0.2s, color 0.2s;";
            
            btnVerMas.onmouseenter = () => {
                btnVerMas.style.background = "#fbac33";
                btnVerMas.style.color = "#111b29";
            };
            btnVerMas.onmouseleave = () => {
                btnVerMas.style.background = "transparent";
                btnVerMas.style.color = "#fbac33";
            };

            btnVerMas.onclick = () => {
                episodiosVisibles += 5; 
                renderizarListaHistorial();
            };

            archiveContainer.appendChild(btnVerMas);
        }
    }

    function inyectarAudioSermon(titulo, mp3Url, thumbnail, reproducirInmediatamente) {
        const titleEl = document.getElementById('custom-player-title');
        if (titleEl) titleEl.innerText = titulo;
        
        // INYECCIÓN DE IMAGEN UTILIZANDO EL PADRE REAL DIRECTO DEL TÍTULO
        let playerCoverEl = document.getElementById('custom-player-cover');
        if (!playerCoverEl && titleEl && titleEl.parentNode) {
            playerCoverEl = document.createElement('img');
            playerCoverEl.id = 'custom-player-cover';
            playerCoverEl.style.cssText = "width: 160px; height: 160px; border-radius: 12px; object-fit: cover; margin: 0 auto 15px auto; display: block; box-shadow: 0 8px 16px rgba(0,0,0,0.3); border: 2px solid #2a364f;";
            
            // Se inserta usando de pivote el contenedor real e inmediato del título
            titleEl.parentNode.insertBefore(playerCoverEl, titleEl);
        }
        
        if (playerCoverEl && thumbnail) {
            playerCoverEl.src = thumbnail;
        }
        
        if (sermonAudio && mp3Url) {
            sermonAudio.pause();
            sermonAudio.removeAttribute('crossorigin');
            sermonAudio.removeAttribute('src'); 
            sermonAudio.preload = "metadata";
            sermonAudio.volume = 1.0;
            sermonAudio.muted = false;
            
            sermonAudio.src = mp3Url;
            sermonAudio.load();
            
            if (reproducirInmediatamente) {
                if (typeof window.apagarRadioDesdeSermon === 'function') {
                    window.apagarRadioDesdeSermon();
                } else {
                    try {
                        const radioAudioEl = document.getElementById('radioAudio');
                        if (radioAudioEl) radioAudioEl.pause();
                    } catch(e) {}
                }

                setTimeout(() => {
                    sermonAudio.play()
                        .then(() => { if (sermonPlayIcon) sermonPlayIcon.className = "fas fa-pause"; })
                        .catch(e => console.log("Fallo reproducción:", e));
                }, 200);
            } else {
                if (sermonPlayIcon) sermonPlayIcon.className = "fas fa-play";
            }
        }
    }

    function togglePlaySermon() {
        if (!sermonAudio || !sermonAudio.src) return;
        
        if (sermonAudio.paused) {
            if (typeof window.apagarRadioDesdeSermon === 'function') {
                window.apagarRadioDesdeSermon();
            } else {
                try {
                    const radioAudioEl = document.getElementById('radioAudio');
                    if (radioAudioEl) radioAudioEl.pause();
                } catch(e) {}
            }

            sermonAudio.play()
                .then(() => { if (sermonPlayIcon) sermonPlayIcon.className = "fas fa-pause"; })
                .catch(err => console.log("Error al reproducir manual:", err));
        } else {
            sermonAudio.pause();
            if (sermonPlayIcon) sermonPlayIcon.className = "fas fa-play";
        }
    }

    function actualizarProgresoSermon() {
        if (sermonAudio && sermonAudio.duration) {
            const porcentaje = (sermonAudio.currentTime / sermonAudio.duration) * 100;
            if (sermonProgressBar) sermonProgressBar.style.width = `${porcentaje}%`;
            
            const mins = Math.floor(sermonAudio.currentTime / 60);
            const secs = Math.floor(sermonAudio.currentTime % 60).toString().padStart(2, '0');
            if (sermonTimeDisplay) sermonTimeDisplay.innerText = `${mins}:${secs}`;
        }
    }

    function buscarTiempoSermon(e) {
        if (!sermonAudio || !sermonProgressContainer) return;
        const width = sermonProgressContainer.clientWidth;
        const clickX = e.offsetX;
        const duration = sermonAudio.duration;
        if (duration) {
            sermonAudio.currentTime = (clickX / width) * duration;
        }
    }

    function marcarError() {
        const titleEl = document.getElementById('custom-player-title');
        if (titleEl) titleEl.innerText = "Sermones temporalmente no disponibles";
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', cargarPodcast);
    } else {
        cargarPodcast();
    }
})();
