const playPauseBtn = document.getElementById("playPauseBtn");
const restartBtn = document.getElementById("restartBtn");
const questionsBtn = document.getElementById("questionsBtn");
const statusEl = document.getElementById("status");

// Envía un mensaje al content script de la pestaña activa
async function sendToActiveTab(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  chrome.tabs.sendMessage(tab.id, message);
}

// El estado REAL de la lectura vive en content.js (porque ahí es donde
// pasa la lectura, y donde también reacciona al atajo global de teclado).
// El popup solo manda la acción; no intenta llevar su propio estado,
// para no arriesgarse a desincronizarse si el usuario usa el atajo
// directo en la página sin abrir el popup.
playPauseBtn.addEventListener("click", () => {
  sendToActiveTab({ action: "TOGGLE_READING" });
  statusEl.textContent = "Listo (revisa el audio de la página).";
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
    sendToActiveTab({ action: "RESTART_READING" });
    statusEl.textContent = "Reiniciando desde el inicio.";
  } else if (event.code === "Space") {
    event.preventDefault();
    sendToActiveTab({ action: "TOGGLE_READING" });
    statusEl.textContent = "Listo (revisa el audio de la página).";
  }
});
