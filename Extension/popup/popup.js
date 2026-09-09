const playPauseBtn = document.getElementById("playPauseBtn");
const restartBtn = document.getElementById("restartBtn");
const questionsBtn = document.getElementById("questionsBtn");
const statusEl = document.getElementById("status");
const serverStatusEl = document.getElementById("serverStatus");

function updateReadingButton(readingState) {
  const labels = {
    stopped: "Iniciar lectura (Espacio)",
    paused: "Pausado (Espacio)",
    playing: "Reproduciendo (Espacio)",
  };
  playPauseBtn.textContent = labels[readingState] || labels.stopped;
}

// Verifica que el servidor local (Server/) esté disponible. No bloquea el
// resto del popup: si falla, el usuario igual puede leer la página, solo
// el cuestionario (que depende del servidor) no va a funcionar todavía.
async function checkServerConnection() {
  if (!serverStatusEl) return;
  serverStatusEl.textContent = "Servidor IA: verificando...";
  serverStatusEl.className = "server-status checking";

  chrome.runtime.sendMessage({ action: "PING_SERVER" }, (result) => {
    if (chrome.runtime.lastError || !result?.connected) {
      serverStatusEl.textContent = "Servidor IA: sin conexión";
      serverStatusEl.className = "server-status offline";
      return;
    }
    serverStatusEl.textContent = "Servidor IA: conectado";
    serverStatusEl.className = "server-status online";
  });
}

checkServerConnection();

// Envía un mensaje al content script de la pestaña activa
async function sendToActiveTab(message, callback) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  chrome.tabs.sendMessage(tab.id, message, (response) => {
    if (chrome.runtime.lastError) return;
    callback?.(response);
  });
}

function refreshReadingState() {
  sendToActiveTab({ action: "GET_READING_STATE" }, (response) => {
    updateReadingButton(response?.readingState);
  });
}

refreshReadingState();

// El estado REAL de la lectura vive en content.js (porque ahí es donde
// pasa la lectura, y donde también reacciona al atajo global de teclado).
// El popup solo manda la acción; no intenta llevar su propio estado,
// para no arriesgarse a desincronizarse si el usuario usa el atajo
// directo en la página sin abrir el popup.
playPauseBtn.addEventListener("click", () => {
  sendToActiveTab({ action: "TOGGLE_READING" }, (response) => {
    updateReadingButton(response?.readingState);
    statusEl.textContent = response?.readingState === "playing"
      ? "Reproduciendo."
      : "Pausado.";
  });
});

restartBtn.addEventListener("click", () => {
  sendToActiveTab({ action: "RESTART_READING" });
  statusEl.textContent = "Reiniciando desde el inicio.";
});

questionsBtn.addEventListener("click", () => {
  sendToActiveTab({ action: "ASK_QUESTIONS" });
  statusEl.textContent = "Generando preguntas... (próximamente)";
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.code === "Enter" || event.code === "NumpadEnter") {
    event.preventDefault();
    sendToActiveTab({ action: "RESTART_READING" }, (response) => {
      updateReadingButton(response?.readingState);
      statusEl.textContent = "Reiniciando desde el inicio.";
    });
  } else if (event.code === "Space") {
    event.preventDefault();
    sendToActiveTab({ action: "TOGGLE_READING" }, (response) => {
      updateReadingButton(response?.readingState);
      statusEl.textContent = response?.readingState === "playing"
        ? "Reproduciendo."
        : "Pausado.";
    });
  }
});
