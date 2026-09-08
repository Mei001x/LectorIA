// content.js
// Vive "dentro" de la página que visita el usuario.
// Se encarga de extraer el texto, leerlo en voz alta, y escuchar los atajos
// de teclado GLOBALES (funcionan en cualquier parte de la página, sin
// necesitar abrir el popup de la extensión primero).

let sentences = [];
let currentIndex = 0;
// Estado único de la lectura: "stopped" | "playing" | "paused"
let readingState = "stopped";
let speakResumeTimer = null;

// Divide el texto de la página en oraciones simples.
function extractSentences() {
  const rawText = document.body.innerText;
  return rawText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3); // ignora fragmentos muy cortos (menús, etc.)
}

function showNotice(text) {
  const id = "oye-lector-notice";
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("div");
    el.id = id;
    el.style.cssText = [
      "position:fixed",
      "bottom:16px",
      "right:16px",
      "z-index:2147483647",
      "background:#111",
      "color:#fff",
      "padding:10px 14px",
      "border-radius:8px",
      "font:13px system-ui,sans-serif",
      "box-shadow:0 4px 16px rgba(0,0,0,.3)",
    ].join(";");
    document.documentElement.appendChild(el);
  }
  el.textContent = text;
  clearTimeout(showNotice.hideTimer);
  showNotice.hideTimer = setTimeout(() => el.remove(), 1800);
}

function speakCurrentSentence() {
  if (currentIndex >= sentences.length) {
    readingState = "stopped";
    showNotice("Oye Lector: terminó la página.");
    return;
  }

  const utterance = new SpeechSynthesisUtterance(sentences[currentIndex]);
  utterance.lang = "es-ES";

  utterance.onend = () => {
    if (readingState !== "playing") return;
    currentIndex++;
    speakCurrentSentence();
  };

  window.speechSynthesis.speak(utterance);
}

// Chrome a veces ignora speak() si se llama justo después de cancel().
function speakSoon() {
  if (speakResumeTimer) clearTimeout(speakResumeTimer);
  speakResumeTimer = setTimeout(() => {
    speakResumeTimer = null;
    if (readingState === "playing") {
      speakCurrentSentence();
    }
  }, 120);
}

function startReading() {
  if (sentences.length === 0) {
    sentences = extractSentences();
    currentIndex = 0;
  }
  readingState = "playing";
  speakSoon();
}

function pauseReading() {
  readingState = "paused";
  window.speechSynthesis.cancel();
}

function restartReading() {
  // Primero paused/stopped para que el onend del audio cancelado NO avance.
  readingState = "stopped";
  window.speechSynthesis.cancel();
  sentences = extractSentences();
  currentIndex = 0;
  readingState = "playing";
  showNotice("Oye Lector: reiniciando lectura");
  speakSoon();
}

function toggleReading() {
  if (readingState === "stopped" || readingState === "paused") {
    startReading();
    showNotice("Oye Lector: leyendo");
  } else if (readingState === "playing") {
    pauseReading();
    showNotice("Oye Lector: pausado");
  }
}

function askQuestions() {
  showNotice("Oye Lector: cuestionario (próximamente)");
  console.log("Oye Lector: aquí conectaremos con la IA para las preguntas.");
}

function isTypingInField(target) {
  if (!target || !target.tagName) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

function isRestartKey(event) {
  return (
    event.key === "Enter" ||
    event.code === "Enter" ||
    event.code === "NumpadEnter"
  );
}

window.addEventListener(
  "keydown",
  (event) => {
    if (event.repeat) return;
    if (isTypingInField(event.target)) return;

    if (event.code === "Space") {
      event.preventDefault();
      toggleReading();
    } else if (isRestartKey(event)) {
      event.preventDefault();
      restartReading();
    } else if (event.key.toLowerCase() === "c") {
      askQuestions();
    }
  },
  true
);

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "TOGGLE_READING") {
    toggleReading();
  } else if (message.action === "RESTART_READING") {
    restartReading();
  } else if (message.action === "ASK_QUESTIONS") {
    askQuestions();
  }
});
