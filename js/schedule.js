// =========================
// SCHEDULE ENGINE v2.2 (ID SYSTEM FIXED)
// =========================

const scheduleContainer = document.getElementById("scheduleContainer");

let currentLiveCard = null;
let lastFocusedCard = null;

let userHasInteracted = false;
let initialAutoScrollDone = false;

/* =========================
   PROGRAMS MAP (NEW)
========================= */

let programsMap = {};

async function loadPrograms() {
  try {
    const res = await fetch('/data/programs.json');
    const data = await res.json();

    programsMap = {};

    data.programs.forEach(p => {
      programsMap[p.id] = p;
    });

  } catch (err) {
    console.error("Error cargando programs:", err);
  }
}

/* =========================
   HELPERS
========================= */

function normalizeDay(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function timeToMinutes(time) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function getCurrentMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function getTodayName() {
  const days = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
  return days[new Date().getDay()];
}

/* =========================
   NEXT PROGRAM DETECTOR
========================= */

function getNextProgramCard() {
  const todayKey = normalizeDay(getTodayName());
  const now = getCurrentMinutes();

  let nextCard = null;
  let minDiff = Infinity;

  document.querySelectorAll(".day-block").forEach(block => {
    const title = block.querySelector(".day-title");
    if (!title) return;

    const dayName = normalizeDay(title.textContent);

    if (dayName !== todayKey) return;

    block.querySelectorAll(".schedule-card").forEach(card => {
      const timeText = card.querySelector(".card-time")?.textContent;
      if (!timeText) return;

      const [start] = timeText.split(" - ");
      const startMin = timeToMinutes(start);

      const diff = startMin - now;

      if (diff > 0 && diff < minDiff) {
        minDiff = diff;
        nextCard = card;
      }
    });
  });

  return nextCard;
}

function scrollToTodayBlock() {
  const todayKey = normalizeDay(getTodayName());

  document.querySelectorAll(".day-block").forEach(block => {
    const title = block.querySelector(".day-title");
    if (!title) return;

    const dayName = normalizeDay(title.textContent);

    if (dayName === todayKey) {
      block.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  });
}

/* =========================
   LIVE DETECTOR
========================= */

function updateLiveStatus() {
  const todayKey = normalizeDay(getTodayName());
  const nowMinutes = getCurrentMinutes();

  currentLiveCard = null;

  document.querySelectorAll(".day-block").forEach(block => {
    const title = block.querySelector(".day-title");
    if (!title) return;

    const dayName = normalizeDay(title.textContent);

    if (dayName !== todayKey) return;

    block.querySelectorAll(".schedule-card").forEach(card => {

      const timeText = card.querySelector(".card-time")?.textContent;
      if (!timeText) return;

      const clean = timeText.replace(/\s+/g, " ").trim();
      const [start, end] = clean.split("-").map(t => t.trim());

      if (!start || !end) return;

      const startMin = timeToMinutes(start);
      const endMin = timeToMinutes(end);

      if (nowMinutes >= startMin && nowMinutes < endMin) {
        card.classList.add("live-now", "radio-active");
        currentLiveCard = card;

        // limpiar otros activos
        document.querySelectorAll(".radio-active").forEach(c => {
          if (c !== card) c.classList.remove("radio-active");
        });

        if (!card.querySelector(".live-badge")) {
          const badge = document.createElement("div");
          badge.classList.add("live-badge");
          badge.textContent = "EN VIVO";
          card.appendChild(badge);
        }

      } else {
        // ✅ FIX: remover clases cuando NO está en vivo
        card.classList.remove("live-now", "radio-active");

        const badge = card.querySelector(".live-badge");
        if (badge) badge.remove();
      }
    });
  });
}

/* =========================
   SCROLL ENGINE (ÚNICO Y FINAL)
========================= */

function focusCard(card) {
  if (!card) return;

  const section = document.getElementById('programacion');

  // Protección: Si el contenedor no tiene altura, reintentamos en 500ms
  if (!section || section.offsetHeight === 0) {
    console.log("DEBUG: Contenedor no listo, reintentando...");
    setTimeout(() => focusCard(card), 500);
    return;
  }

  console.log("DEBUG: Intentando hacer scroll a:", card.innerText);

  requestAnimationFrame(() => {
    const cardTop = card.offsetTop;
    section.scrollTo({
      top: cardTop - 100,
      behavior: 'smooth'
    });
    console.log("DEBUG: Scroll vertical ejecutado a:", cardTop - 100);
  });

  // Scroll horizontal de la fila
  const row = card.closest(".day-row");
  if (row) {
    requestAnimationFrame(() => {
      row.scrollTo({
        left: card.offsetLeft - (row.clientWidth / 2) + (card.offsetWidth / 2),
        behavior: 'smooth'
      });
    });
  }
}

function runFocusEngine(force = false) {
  // Mantenemos el tiempo de espera para estabilizar el DOM
  setTimeout(() => {
    let targetCard = currentLiveCard || getNextProgramCard();
    if (!targetCard) return;

    if (!force && (userHasInteracted || targetCard === lastFocusedCard)) return;

    focusCard(targetCard);
    lastFocusedCard = targetCard;
  }, 800);
}

/* =========================
   RENDER
========================= */

async function loadAndRenderSchedule() {
  try {
    const res = await fetch('/data/schedule.json');
    const data = await res.json();

    renderSchedule(data);

    setTimeout(() => {
      updateLiveStatus();
      runFocusEngine(true);
    }, 600);

  } catch (err) {
    console.error("Error cargando schedule:", err);
  }
}

function renderSchedule(data) {
  const days = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];

  const keyMap = {
    "Domingo": "domingo",
    "Lunes": "lunes",
    "Martes": "martes",
    "Miércoles": "miércoles",
    "Jueves": "jueves",
    "Viernes": "viernes",
    "Sábado": "sábado"
  };

  scheduleContainer.innerHTML = "";

  days.forEach(dayName => {
    const key = keyMap[dayName];
    const programs = data[key] || [];

    const dayBlock = document.createElement("div");
    dayBlock.classList.add("day-block");

    const title = document.createElement("div");
    title.classList.add("day-title");
    title.textContent = dayName;

    dayBlock.appendChild(title);

    const row = document.createElement("div");
    row.classList.add("day-row");

    if (programs.length === 0) {
      const empty = document.createElement("div");
      empty.classList.add("schedule-card", "empty-card");
      empty.textContent = "Sin programación";
      row.appendChild(empty);
    } else {
      programs.forEach(program => {
        const card = document.createElement("div");
        card.classList.add("schedule-card");

        const programInfo = programsMap[program.id];

        card.innerHTML = `
  <div class="card-time">${program.start} - ${program.end}</div>

  <div class="card-title">
    ${programInfo?.name || program.id}
  </div>
`;
        card.addEventListener("click", () => openModal(program));

        row.appendChild(card);
      });
    }

    dayBlock.appendChild(row);
    scheduleContainer.appendChild(dayBlock);
  });
}

/* =========================
   MODAL
========================= */

function createModal() {
  const modal = document.createElement("div");
  modal.id = "scheduleModal";

  modal.innerHTML = `
    <div class="modal-content">
      <span class="close-btn">&times;</span>
      <div class="modal-body"></div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector(".close-btn").onclick = () => {
    modal.classList.remove("show");
  };

  modal.onclick = (e) => {
    if (e.target.id === "scheduleModal") {
      modal.classList.remove("show");
    }
  };
}

function openModal(program) {
  const modal = document.getElementById("scheduleModal");
  const body = modal.querySelector(".modal-body");

  const programInfo = programsMap[program.id];

  body.innerHTML = `
    ${programInfo?.artwork ? `<img src="${programInfo.artwork}" class="modal-image" />` : ""}

    <h2>${programInfo?.name || program.id}</h2>

    <p><strong>${program.start} - ${program.end}</strong></p>

    <p>${programInfo?.description || ""}</p>
  `;

  modal.classList.add("show");
}

/* =========================
   INIT
========================= */

createModal();

async function init() {
  await loadPrograms();
  await loadAndRenderSchedule();
}

init();

["scroll", "touchstart", "wheel"].forEach(evt => {
  window.addEventListener(evt, () => {
    userHasInteracted = true;
  }, { passive: true });
});

setInterval(() => {
  updateLiveStatus();
  runFocusEngine(false);
}, 30000);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    updateLiveStatus();
    runFocusEngine(false);
  }
});
