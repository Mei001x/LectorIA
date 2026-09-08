// content.js
// Vive "dentro" de la página que visita el usuario.
// Se encarga de extraer el texto y leerlo en voz alta con SpeechSynthesis.

let sentences = [];
let currentIndex = 0;
let isPaused = false;

// Divide el texto de la página en oraciones simples.
// Es un split básico por ahora (por punto, signo de exclamación o interrogación).
function extractSentences() {
  const rawText = document.body.innerText;
  return rawText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3); // ignora fragmentos muy cortos (menús, etc.)
}

// Lee la oración actual y, al terminar, pasa a la siguiente.
function speakCurrentSentence() {
  if (currentIndex >= sentences.length) {
    console.log("Oye Lector: terminó de leer la página.");
    return;
  }

  const utterance = new SpeechSynthesisUtterance(sentences[currentIndex]);
  utterance.lang = "es-ES";

  utterance.onend = () => {
    if (!isPaused) {
      currentIndex++;
      speakCurrentSentence();
    }
  };

  window.speechSynthesis.speak(utterance);
}

function playReading() {
  if (sentences.length === 0) {
    sentences = extractSentences();
    currentIndex = 0;
  }
  isPaused = false;
  speakCurrentSentence();
}

function pauseReading() {
  isPaused = true;
  window.speechSynthesis.cancel(); // detiene la oración actual
  // currentIndex queda "congelado" en la oración donde se pausó
}

// Escucha los mensajes que manda el popup (play / pause / preguntas)
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "PLAY") {
    playReading();
  } else if (message.action === "PAUSE") {
    pauseReading();
  } else if (message.action === "ASK_QUESTIONS") {
    console.log("Oye Lector: aquí conectaremos con la IA para las preguntas.");
    // TODO: mandar `sentences` leídas hasta currentIndex al backend
  }
});
