// background.js
// Único lugar de la extensión que habla por red con el servidor Node
// (Server/) que a su vez habla con la API de Gemini. content.js y popup.js
// nunca hacen fetch directo: le piden a background.js via mensajes.

const SERVER_URL = "http://localhost:3000";

// Helper genérico de POST JSON contra el backend. Devuelve { data } o
// { error } — nunca lanza, para que quien llame pueda usar el resultado
// sin try/catch.
async function postJSON(path, body) {
  try {
    const response = await fetch(`${SERVER_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return { error: data.error || `Servidor respondió ${response.status}` };
    }
    return { data };
  } catch (err) {
    return { error: "No se pudo conectar con el servidor local." };
  }
}

// Chequeo simple de conectividad contra GET /health del backend.
async function pingServer() {
  try {
    const response = await fetch(`${SERVER_URL}/health`);
    if (!response.ok) {
      return { connected: false, error: `Servidor respondió ${response.status}` };
    }
    const data = await response.json();
    return { connected: true, service: data.service };
  } catch (err) {
    return { connected: false, error: "No se pudo conectar con el servidor local." };
  }
}

async function callGenerate(prompt) {
  const result = await postJSON("/api/generate", { prompt });
  if (result.error) return { error: result.error };
  if (typeof result.data.text !== "string") {
    return { error: "El servidor no devolvió texto válido." };
  }
  return { text: result.data.text };
}

async function askAI(question, context) {
  const prompt = [
    `Contexto del texto que el usuario está escuchando: "${context}"`,
    ``,
    `El usuario preguntó: "${question}"`,
    ``,
    `Responde de forma clara y breve (2 a 3 oraciones), en español, pensando en que tu respuesta será leída en voz alta a una persona con discapacidad visual. No uses markdown, listas, ni símbolos.`,
  ].join("\n");

  const result = await callGenerate(prompt);
  if (result.error) return result;
  return { answer: result.text };
}

// Pide al servidor 4 preguntas ABIERTAS de comprensión sobre lo leído.
// El servidor devuelve JSON estructurado y validado (responseSchema de
// Gemini), así que no hace falta parsear texto libre acá.
async function startQuizRequest(content) {
  const result = await postJSON("/api/questions", {
    text: content,
    numQuestions: 4,
    language: "es",
  });
  if (result.error) return { error: result.error };

  const { questions } = result.data;
  if (!Array.isArray(questions) || questions.length === 0) {
    return { error: "El servidor no devolvió preguntas válidas." };
  }
  return { questions };
}

// Evalúa las respuestas del cuestionario: cada ítem llega como
// { question, answer } (answer es null si no respondió a tiempo). El
// servidor devuelve, por cada una, si es correcta y un puntaje de 0 a 10,
// más un overallScore. Acá lo convertimos a un solo texto para que
// content.js lo lea en voz alta (mismo contrato que antes: { feedback }).
async function evaluateQuiz(items) {
  const result = await postJSON("/api/evaluate", { items, language: "es" });
  if (result.error) return { error: result.error };

  const { results, overallScore } = result.data;
  if (!Array.isArray(results) || results.length === 0) {
    return { error: "El servidor no devolvió una evaluación válida." };
  }

  const perQuestion = results
    .map((r, i) => `Pregunta ${i + 1}: ${r.correct ? "correcta" : "incorrecta"}, puntaje ${r.score} de 10. ${r.feedback}`)
    .join(" ");

  const feedback = `Tu puntaje general fue ${overallScore} de 10. ${perQuestion}`;

  return { feedback, results, overallScore };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "PING_SERVER") {
    pingServer().then(sendResponse);
    return true; // mantiene el canal abierto para la respuesta async
  }
  if (message.action === "ASK_AI") {
    askAI(message.question, message.context).then(sendResponse);
    return true;
  }
  if (message.action === "START_QUIZ") {
    startQuizRequest(message.content).then(sendResponse);
    return true;
  }
  if (message.action === "EVALUATE_QUIZ") {
    evaluateQuiz(message.items).then(sendResponse);
    return true;
  }
});

console.log("Oye Lector: background script cargado.");
