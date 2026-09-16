// content.js
// Vive "dentro" de la página que visita el usuario.
// Se encarga de extraer el texto, leerlo en voz alta, escuchar los atajos
// de teclado GLOBALES, y maneja dos flujos de voz:
//
//   - Al PAUSAR (Espacio), el micrófono se activa automáticamente y queda
//     escuchando: si el usuario dice algo, se toma como una pregunta sobre
//     lo leído y la IA responde. Si no dice nada y vuelve a presionar
//     Espacio, simplemente continúa la lectura.
//   - "C" (Cuestionario): la IA le hace preguntas al usuario sobre lo
//     leído, evalúa sus respuestas y da retroalimentación (varias vueltas
//     hasta terminar).

let sentences = [];
let currentIndex = 0;
// Estado único de la lectura: "stopped" | "playing" | "paused"
let readingState = "stopped";
let speakResumeTimer = null;

// Si estamos en pausa esperando a ver si el usuario pregunta algo.
let isListeningForQuestion = false;

// Si estamos escuchando en segundo plano por si dice "Oye Lector, ...".
let isWakeListening = false;

// Cuántas oraciones de contexto le mandamos a la IA cuando el usuario
// pregunta algo mientras está pausado.
const CONTEXT_WINDOW = 5;

// ---------- Utilidades de texto y notificación ----------

function extractSentences() {
  const rawText = document.body.innerText;
  return rawText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
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

// ---------- Lectura de la página ----------

function speakCurrentSentence() {
  if (currentIndex >= sentences.length) {
    readingState = "stopped";
    showNotice("Oye Lector: terminó la página.");
    askToStartQuizByVoice();
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
  stopListeningForQuestion(); // ya no estamos pausados, dejamos de escuchar
  stopWakeWordListener(); // se vuelve a activar al final, sin duplicar

  if (readingState === "paused") {
    readingState = "playing";
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    } else if (!window.speechSynthesis.speaking) {
      speakSoon();
    }
    startWakeWordListener(); // por si dice "Oye Lector, pausa" mientras lee
    return;
  }

  if (sentences.length === 0) {
    sentences = extractSentences();
    currentIndex = 0;
  }
  readingState = "playing";
  speakSoon();
  // Pequeño respiro: si startReading() se llamó desde un comando de voz
  // que el propio reconocimiento acababa de escuchar, evita pisarle la
  // sesión anterior que todavía se está cerrando.
  setTimeout(startWakeWordListener, 200);
}

// Pausa la reproducción, sin activar el micrófono (la usan internamente
// el cuestionario y otros flujos que manejan su propia escucha).
function pausePlayback() {
  readingState = "paused";
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.pause();
  }
}

// La pausa "normal" (Espacio): pausa Y activa el micrófono por si el
// usuario quiere preguntar algo.
function pauseReading() {
  pausePlayback();
  stopWakeWordListener();
  startListeningForQuestion();
}

function restartReading() {
  stopListeningForQuestion();
  stopWakeWordListener();
  readingState = "stopped";
  window.speechSynthesis.cancel();
  sentences = extractSentences();
  currentIndex = 0;
  readingState = "playing";
  showNotice("Oye Lector: reiniciando lectura");
  speakSoon();
  startWakeWordListener();
}

function toggleReading() {
  if (readingState === "stopped" || readingState === "paused") {
    startReading();
    showNotice("Oye Lector: leyendo");
  } else if (readingState === "playing") {
    pauseReading();
    showNotice("Oye Lector: en pausa, puedes preguntarme algo...");
  }
}

// ---------- Reconocimiento y síntesis de voz (compartidos) ----------

function getRecentContext() {
  const start = Math.max(0, currentIndex - CONTEXT_WINDOW + 1);
  const end = Math.min(sentences.length, currentIndex + 1);
  return sentences.slice(start, end).join(" ");
}

function getReadContent() {
  if (sentences.length === 0) {
    sentences = extractSentences();
  }
  const upTo = currentIndex > 0 ? currentIndex + 1 : sentences.length;
  return sentences.slice(0, upTo).join(" ");
}

function speakText(text, onDone) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "es-ES";
  if (onDone) utterance.onend = onDone;
  window.speechSynthesis.speak(utterance);
}

let recognition = null;

function getSpeechRecognition() {
  const SpeechRecognitionClass =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognitionClass) return null;
  if (!recognition) {
    recognition = new SpeechRecognitionClass();
    recognition.lang = "es-ES";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
  }
  return recognition;
}

// ---------- Pregunta automática al terminar de leer: ¿cuestionario? ----------

// Detectamos sí/no de forma LOCAL (sin llamar a la IA) comparando contra
// frases comunes en español. Es gratis, rápido, y no depende del servidor
// -- lo guardamos para preguntas genuinamente abiertas, no para esto.
function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // quita tildes: "sí" -> "si"
}

const AFFIRMATIVE_PATTERNS = [
  "si", "claro", "dale", "va", "quiero", "obvio",
  "por supuesto", "ok", "okay", "bueno", "sale",
  "de una", "empecemos", "hagamoslo", "vamos",
];

// Ojo: revisamos negativas ANTES que afirmativas, porque frases como
// "no quiero" contienen "quiero" (que sería un falso positivo afirmativo).
const NEGATIVE_PATTERNS = [
  "no gracias", "ahora no", "todavia no", "no quiero",
  "luego", "despues", "paso", "no",
];

function detectYesNo(transcript) {
  const text = normalizeText(transcript);
  if (NEGATIVE_PATTERNS.some((p) => text.includes(p))) return "no";
  if (AFFIRMATIVE_PATTERNS.some((p) => text.includes(p))) return "yes";
  return "unknown";
}

// ---------- Comando de activación "Oye Lector" (local, sin IA) ----------

const WAKE_WORD = "oye lector";

// Detecta "oye lector" + una palabra de control. Si no está la palabra de
// activación, devuelve null -- así una pregunta normal ("¿a qué te
// refieres?") nunca se confunde con un comando de control.
function detectVoiceCommand(transcript) {
  const text = normalizeText(transcript);
  if (!text.includes(WAKE_WORD)) return null;

  if (/(pausa|detente|deten|para)\b/.test(text)) return "pause";
  if (/(reanuda|continua|sigue|resume)/.test(text)) return "resume";
  if (/(empieza|inicia|comienza|arranca|lee)/.test(text)) return "start";
  return null;
}

function askToStartQuizByVoice() {
  speakText(
    "Terminé de leer la página. ¿Quieres iniciar un cuestionario para comprobar lo que aprendiste?",
    () => listenForQuizConfirmation(1)
  );
}

function listenForQuizConfirmation(attempt) {
  const rec = getSpeechRecognition();
  if (!rec) return; // sin soporte de voz: simplemente no se ofrece el cuestionario automático

  showNotice("Oye Lector: escuchando tu respuesta...");

  rec.onresult = (event) => {
    const transcript = event.results[event.results.length - 1][0].transcript;
    const answer = detectYesNo(transcript);

    if (answer === "yes") {
      startQuiz();
    } else if (answer === "no") {
      showNotice("Oye Lector: entendido. Presiona C cuando quieras el cuestionario.");
      speakText("Entendido. Si cambias de opinión, presiona la letra C para iniciar el cuestionario.", () => {
        startWakeWordListener();
      });
    } else if (attempt < 2) {
      speakText(
        "No logré entender si es un sí o un no. ¿Quieres iniciar el cuestionario?",
        () => listenForQuizConfirmation(attempt + 1)
      );
    } else {
      showNotice("Oye Lector: puedes presionar C cuando quieras el cuestionario.");
      speakText("Está bien, cuando quieras puedes presionar la letra C para iniciar el cuestionario.", () => {
        startWakeWordListener();
      });
    }
  };

  rec.onerror = (event) => {
    if (event.error === "not-allowed") {
      showNotice("Oye Lector: necesito permiso de micrófono para escucharte.");
      return;
    }
    showNotice("Oye Lector: no logré escucharte. Puedes presionar C para el cuestionario.");
  };

  rec.onend = null; // esta pregunta no se reintenta sola en bucle, a diferencia de la escucha en pausa

  try {
    rec.start();
  } catch (err) {
    // Ignorar si ya estaba escuchando.
  }
}

// ---------- Escucha automática al pausar ----------

function startListeningForQuestion() {
  const rec = getSpeechRecognition();
  if (!rec) return; // navegador sin soporte: simplemente no escucha, sin error ruidoso

  isWakeListening = false; // nos aseguramos de no mezclar modos
  isListeningForQuestion = true;

  rec.onresult = (event) => {
    const transcript = event.results[event.results.length - 1][0].transcript;

    // Antes de tratarlo como pregunta, revisamos si fue un comando de
    // control por voz ("Oye Lector, reanuda" / "Oye Lector, empieza a leer").
    const command = detectVoiceCommand(transcript);
    if (command === "resume" || command === "start") {
      isListeningForQuestion = false;
      rec.onend = null;
      startReading();
      return;
    }

    isListeningForQuestion = false;
    rec.onend = null; // evitamos que se reinicie solo después de esto
    handleUserQuestion(transcript);
  };

  rec.onerror = (event) => {
    if (event.error === "not-allowed") {
      isListeningForQuestion = false;
      showNotice("Oye Lector: necesito permiso de micrófono para escucharte.");
      return;
    }
    // "no-speech" y similares son normales mientras espera en silencio:
    // no mostramos error, onend se encarga de reintentar.
  };

  rec.onend = () => {
    // El reconocimiento se corta solo tras un rato de silencio.
    // Si seguimos pausados esperando una pregunta, lo reactivamos.
    if (isListeningForQuestion && readingState === "paused") {
      try {
        rec.start();
      } catch (err) {
        // Puede fallar si se llama demasiado rápido; se reintentará
        // en el próximo onend si sigue pausado.
      }
    }
  };

  try {
    rec.start();
  } catch (err) {
    // Ya podría estar escuchando; lo ignoramos.
  }
}

// ---------- Comando de activación por voz: "Oye Lector, ..." ----------
// Activo mientras NO estemos pausados ni en cuestionario -- o sea, cuando
// readingState es "stopped" (todavía no empezó nada) o "playing" (leyendo).
// Si detecta la palabra de activación + un comando reconocido, actúa.
// Si no, simplemente sigue escuchando en silencio (sin gastar tokens de IA,
// esta detección es local).

function startWakeWordListener() {
  const rec = getSpeechRecognition();
  if (!rec) return;

  isListeningForQuestion = false; // nos aseguramos de no mezclar modos
  isWakeListening = true;

  rec.onresult = (event) => {
    const transcript = event.results[event.results.length - 1][0].transcript;
    console.log('Oye Lector [wake]: escuché "' + transcript + '"');
    const command = detectVoiceCommand(transcript);

    if (command === "start" && readingState === "stopped") {
      showNotice('Oye Lector: "empieza a leer" -- iniciando...');
      startReading();
    } else if (command === "pause" && readingState === "playing") {
      showNotice('Oye Lector: "pausa" -- pausando...');
      pauseReading();
    }
    // Si no coincide con nada válido en el estado actual, lo ignoramos
    // y seguimos escuchando (onend se encarga de reiniciar).
  };

  rec.onerror = (event) => {
    console.log("Oye Lector [wake]: error de reconocimiento ->", event.error);
    if (event.error === "not-allowed" || event.error === "audio-capture") {
      isWakeListening = false;
      showNotice("Oye Lector: sin permiso o sin micrófono disponible.");
      return;
    }
    // Errores como "no-speech" son normales mientras espera en silencio;
    // onend se encarga de reintentar.
  };

  rec.onend = () => {
    if (isWakeListening) {
      try {
        rec.start();
      } catch (err) {
        // Puede fallar si se llama demasiado rápido; se reintentará
        // en el próximo onend.
      }
    }
  };

  try {
    rec.start();
    console.log("Oye Lector [wake]: escuchando...");
  } catch (err) {
    // Es normal si justo se está deteniendo la sesión anterior (ej. justo
    // después de un comando reconocido) -- el propio onend la reintenta.
    console.log("Oye Lector [wake]: reintentando en breve...");
  }
}

function stopWakeWordListener() {
  isWakeListening = false;
  if (recognition) {
    recognition.onend = null;
    try {
      recognition.stop();
    } catch (err) {
      // Si ya estaba detenido, no pasa nada.
    }
  }
}

function stopListeningForQuestion() {
  isListeningForQuestion = false;
  if (recognition) {
    recognition.onend = null;
    try {
      recognition.stop();
    } catch (err) {
      // Si ya estaba detenido, no pasa nada.
    }
  }
}

function handleUserQuestion(transcript) {
  showNotice(`Oye Lector: entendí "${transcript}". Pensando...`);
  const context = getRecentContext();

  chrome.runtime.sendMessage(
    { action: "ASK_AI", question: transcript, context },
    (response) => {
      if (chrome.runtime.lastError || !response || response.error) {
        const errorText =
          response?.error || "No pude conectarme con el servidor.";
        showNotice(`Oye Lector: ${errorText}`);
        speakText("No pude conectarme con el servidor para responder tu pregunta.", () => {
          if (readingState === "paused") startListeningForQuestion();
        });
        return;
      }
      // Después de responder, si seguimos pausados, volvemos a escuchar
      // por si el usuario tiene otra pregunta de seguimiento.
      speakText(response.answer, () => {
        if (readingState === "paused") startListeningForQuestion();
      });
    }
  );
}

// ---------- "C": cuestionario (4 preguntas en lote, con tiempo límite) ----------

// Tiempo que tiene el usuario para responder cada pregunta antes de pasar
// a la siguiente sin respuesta. 10 minutos como pediste -- bájalo (por
// ejemplo a 30 * 1000 = 30 segundos) mientras están probando, para no
// esperar tanto en cada prueba.
const QUESTION_TIME_LIMIT_MS = 10 * 60 * 1000;

let quizQuestions = [];
let quizAnswers = [];
let currentQuizIndex = 0;

function startQuiz() {
  stopListeningForQuestion(); // que no se mezcle con la escucha automática
  pausePlayback();

  const content = getReadContent();

  if (!content) {
    showNotice("Oye Lector: primero lee algo de la página con Espacio.");
    speakText("Todavía no hay nada leído para hacer un cuestionario. Presiona espacio para empezar a leer primero.");
    return;
  }

  showNotice("Oye Lector: preparando el cuestionario...");

  chrome.runtime.sendMessage(
    { action: "START_QUIZ", content },
    (response) => {
      if (chrome.runtime.lastError || !response || response.error) {
        const errorText =
          response?.error || "No pude conectarme con el servidor.";
        showNotice(`Oye Lector: ${errorText}`);
        speakText("No pude conectarme con el servidor para preparar el cuestionario.");
        return;
      }
      if (!response.questions || response.questions.length === 0) {
        showNotice("Oye Lector: el servidor no generó preguntas.");
        speakText("No pude generar preguntas para el cuestionario, intenta de nuevo.");
        return;
      }

      quizQuestions = response.questions;
      quizAnswers = new Array(quizQuestions.length).fill(null);
      currentQuizIndex = 0;
      askNextQuizQuestion();
    }
  );
}

function askNextQuizQuestion() {
  if (currentQuizIndex >= quizQuestions.length) {
    finishQuizAndEvaluate();
    return;
  }

  const questionNumber = currentQuizIndex + 1;
  const question = quizQuestions[currentQuizIndex];

  speakText(`Pregunta ${questionNumber}: ${question}`, () => {
    listenForQuizAnswerWithTimeout();
  });
}

function listenForQuizAnswerWithTimeout() {
  const rec = getSpeechRecognition();
  if (!rec) {
    // Sin soporte de voz: no podemos tomar la respuesta, la dejamos vacía
    // y avanzamos para no trabar todo el cuestionario.
    quizAnswers[currentQuizIndex] = null;
    currentQuizIndex++;
    askNextQuizQuestion();
    return;
  }

  showNotice("Oye Lector: escuchando tu respuesta...");
  let answered = false;

  const timeoutId = setTimeout(() => {
    if (answered) return;
    answered = true;
    rec.onend = null;
    try {
      rec.stop();
    } catch (err) {
      // no pasa nada si ya estaba detenido
    }
    quizAnswers[currentQuizIndex] = null; // sin respuesta a tiempo
    showNotice("Oye Lector: tiempo agotado para esta pregunta.");
    currentQuizIndex++;
    askNextQuizQuestion();
  }, QUESTION_TIME_LIMIT_MS);

  rec.onresult = (event) => {
    if (answered) return;
    answered = true;
    clearTimeout(timeoutId);
    rec.onend = null;

    const transcript = event.results[event.results.length - 1][0].transcript;
    quizAnswers[currentQuizIndex] = transcript;
    currentQuizIndex++;
    askNextQuizQuestion();
  };

  rec.onerror = (event) => {
    if (event.error === "not-allowed") {
      answered = true;
      clearTimeout(timeoutId);
      showNotice("Oye Lector: necesito permiso de micrófono para escucharte.");
      quizAnswers[currentQuizIndex] = null;
      currentQuizIndex++;
      askNextQuizQuestion();
    }
    // otros errores (ej. "no-speech"): dejamos que onend reintente solo,
    // mientras siga dentro del tiempo límite de esta pregunta.
  };

  rec.onend = () => {
    if (!answered) {
      try {
        rec.start();
      } catch (err) {
        // puede fallar si se llama demasiado rápido; el timeout se
        // encarga de avanzar de todas formas si esto sigue fallando
      }
    }
  };

  try {
    rec.start();
  } catch (err) {
    // Ignorar si ya estaba escuchando.
  }
}

function finishQuizAndEvaluate() {
  showNotice("Oye Lector: evaluando tus respuestas...");

  const items = quizQuestions.map((question, i) => ({
    question,
    answer: quizAnswers[i], // null si no respondió esa pregunta
  }));

  chrome.runtime.sendMessage(
    { action: "EVALUATE_QUIZ", items },
    (response) => {
      if (chrome.runtime.lastError || !response || response.error) {
        const errorText =
          response?.error || "No pude conectarme con el servidor.";
        showNotice(`Oye Lector: ${errorText}`);
        speakText("No pude conectarme con el servidor para evaluar tus respuestas.");
        return;
      }
      speakText(response.feedback, () => {
        if (readingState === "paused") startListeningForQuestion();
      });
      showNotice("Oye Lector: cuestionario terminado.");
    }
  );
}

// ---------- Notas por voz -> Google Docs ----------
 
let isRecordingNotes = false;
let notesBuffer = [];
 
// Nombre del documento: preferimos el título del artículo; si no hay uno
// claro, usamos la fecha. Así, varias notas el mismo día del mismo
// artículo van todas al mismo documento (porque el nombre coincide).
function getArticleTitle() {
  const ogTitle = document.querySelector('meta[property="og:title"]')?.content;
  if (ogTitle && ogTitle.trim()) return ogTitle.trim();
 
  const h1 = document.querySelector("h1");
  if (h1 && h1.textContent.trim()) return h1.textContent.trim();
 
  if (document.title && document.title.trim()) {
    // Quita sufijos típicos como " - Wikipedia" o " | Sitio X".
    return document.title.split(" - ")[0].split(" | ")[0].trim();
  }
 
  return null;
}
 
function getTodayDateString() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
 
function getNoteDocTitle() {
  const articleTitle = getArticleTitle();
  if (articleTitle) return `Notas - ${articleTitle}`;
  return `Notas - ${getTodayDateString()}`;
}
 
function toggleNotesRecording() {
  if (isRecordingNotes) {
    uploadNotes();
  } else {
    startNotesRecording();
  }
}
 
function startNotesRecording() {
  stopWakeWordListener();
  stopListeningForQuestion();
  isRecordingNotes = true;
  notesBuffer = [];
  showNotice("Oye Lector: grabando notas... di 'Oye Lector, sube nota' para terminar.");
  speakText(
    "Comenzando a grabar tus notas. Cuando termines, di: Oye Lector, sube nota.",
    () => listenForNotes()
  );
}
 
function listenForNotes() {
  const rec = getSpeechRecognition();
  if (!rec) {
    isRecordingNotes = false;
    showNotice("Oye Lector: tu navegador no soporta reconocimiento de voz.");
    speakText("Tu navegador no soporta reconocimiento de voz, no puedo grabar notas así.");
    return;
  }
 
  rec.onresult = (event) => {
    const transcript = event.results[event.results.length - 1][0].transcript;
    console.log('Oye Lector [notas]: escuché "' + transcript + '"');
 
    const command = detectVoiceCommand(transcript);
    if (command === "notes-upload") {
      isRecordingNotes = false;
      rec.onend = null;
      uploadNotes();
      return;
    }
 
    // No fue el comando de subir: lo agregamos como parte de la nota.
    notesBuffer.push(transcript);
    showNotice(`Oye Lector: nota agregada (${notesBuffer.length}).`);
  };
 
  rec.onerror = (event) => {
    if (event.error === "not-allowed") {
      isRecordingNotes = false;
      showNotice("Oye Lector: necesito permiso de micrófono para escucharte.");
    }
    // otros errores: onend reintenta solo mientras isRecordingNotes siga activo
  };
 
  rec.onend = () => {
    if (isRecordingNotes) {
      try {
        rec.start();
      } catch (err) {
        // se reintentará en el próximo onend
      }
    }
  };
 
  try {
    rec.start();
  } catch (err) {
    // Ignorar si ya estaba escuchando.
  }
}
 
function resumeMicAfterNotes() {
  if (readingState === "paused") {
    startListeningForQuestion();
  } else {
    startWakeWordListener();
  }
}
 
function uploadNotes() {
  isRecordingNotes = false;
 
  if (notesBuffer.length === 0) {
    showNotice("Oye Lector: no grabaste ninguna nota.");
    speakText("No grabaste ninguna nota todavía.", resumeMicAfterNotes);
    return;
  }
 
  showNotice("Oye Lector: subiendo notas a Google Docs...");
  const title = getNoteDocTitle();
  const noteText = notesBuffer.join(". ") + ".";
  const notesToUpload = notesBuffer.length;
  notesBuffer = [];
 
  chrome.runtime.sendMessage(
    { action: "UPLOAD_NOTE", title, noteText },
    (response) => {
      if (chrome.runtime.lastError || !response || response.error) {
        const errorText =
          response?.error || "No se pudo conectar con Google Docs.";
        showNotice(`Oye Lector: ${errorText}`);
        speakText(`No pude subir tus notas a Google Docs. ${errorText}`, resumeMicAfterNotes);
        return;
      }
      showNotice("Oye Lector: notas subidas correctamente.");
      speakText(
        `Subí ${notesToUpload} nota${notesToUpload === 1 ? "" : "s"} al documento ${title}.`,
        resumeMicAfterNotes
      );
    }
  );
}

// ---------- Atajos de teclado globales ----------

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
      startQuiz();
      } else if (event.key === "Shift") {
      toggleNotesRecording();
    }
  },
  true
);

// ---------- Mensajes desde el popup ----------

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "TOGGLE_READING") {
    toggleReading();
    sendResponse({ readingState });
  } else if (message.action === "RESTART_READING") {
    restartReading();
    sendResponse({ readingState });
  } else if (message.action === "ASK_QUESTIONS") {
    startQuiz();
  } else if (message.action === "GET_READING_STATE") {
    sendResponse({ readingState });
  } else if (message.action === "TOGGLE_NOTES") {
    toggleNotesRecording();
    sendResponse({ isRecordingNotes });
  } else if (message.action === "GET_NOTES_STATE") {
    sendResponse({ isRecordingNotes });
  }
});

// ---------- Arranque ----------
// Apenas carga la página, dejamos el micrófono escuchando por si el
// usuario dice "Oye Lector, empieza a leer" sin tocar el teclado.
startWakeWordListener();