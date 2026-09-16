// background.js
// Único lugar de la extensión que habla por red con el servidor Node
// (Server/) que a su vez habla con la API de Gemini. content.js y popup.js
// nunca hacen fetch directo: le piden a background.js via mensajes.

const SERVER_URL = "http://localhost:3000";

// Chequeo simple de conectividad contra GET /health del backend.
// Devuelve { connected: true } o { connected: false, error } — nunca lanza,
// para que quien llame (el popup) pueda mostrar el resultado sin try/catch.
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
  try {
    const response = await fetch(`${SERVER_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
 
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      return { error: errorBody.error || `Servidor respondió ${response.status}` };
    }
 
    const data = await response.json();
    if (typeof data.text !== "string") {
      return { error: "El servidor no devolvió texto válido." };
    }
    return { text: data.text };
  } catch (err) {
    return { error: "No se pudo conectar con el servidor local." };
  }
}

//Evitar errores de Gemini
function parseJsonFromModelText(text) {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  return JSON.parse(cleaned);
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

async function startQuizRequest(content) {
  const prompt = [
    `Basándote ÚNICAMENTE en el siguiente texto, genera exactamente 4 preguntas ABIERTAS de comprensión (nada de opción múltiple, sin opciones de respuesta) para evaluar si alguien entendió el contenido.`,
    `Responde ÚNICAMENTE con un arreglo JSON de 4 strings, sin texto adicional, sin explicación, sin backticks. Formato exacto: ["pregunta 1", "pregunta 2", "pregunta 3", "pregunta 4"]`,
    ``,
    `Texto:`,
    `"""${content}"""`,
  ].join("\n");

  const result = await callGenerate(prompt);
  if (result.error) return result;
 
  try {
    const questions = parseJsonFromModelText(result.text);
    if (!Array.isArray(questions) || questions.length === 0) {
      return { error: "El servidor no devolvió preguntas válidas." };
    }
    return { questions };
  } catch (err) {
    return { error: "No se pudo interpretar las preguntas generadas." };
  }
}

async function evaluateQuiz(items) {
  const prompt = [
    `Vas a evaluar las respuestas de un estudiante a un cuestionario de comprensión lectora.`,
    `Para cada pregunta: indica si respondió bien, qué le faltó o en qué se equivocó si falló, y si no respondió (la respuesta viene como null) dile cuál era la idea clave que se buscaba.`,
    `Da la retroalimentación de las 4 preguntas en un solo texto corrido, claro y breve, en español, SIN listas ni markdown -- será leído en voz alta a una persona con discapacidad visual.`,
    ``,
    `Preguntas y respuestas del usuario (formato JSON):`,
    JSON.stringify(items),
  ].join("\n");
 
  const result = await callGenerate(prompt);
  if (result.error) return result;
  return { feedback: result.text };
}
// ---------- Notas -> Google Docs ----------
// Requiere que manifest.json tenga configurado un client_id de OAuth
// (ver instrucciones aparte). Usamos el scope "drive.file", que solo da
// acceso a los archivos que ESTA app crea -- no a todo el Drive del
// usuario, por seguridad y porque así lo aprueba Google más rápido.
 
function getAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError || !token) {
        reject(new Error(chrome.runtime.lastError?.message || "No se pudo autenticar con Google."));
        return;
      }
      resolve(token);
    });
  });
}
 
// Busca si ya existe un Google Doc con ese nombre exacto (creado antes
// por esta misma app). Si lo encuentra, reutilizamos ese documento en vez
// de crear uno nuevo -- así varias notas del mismo día/artículo se van
// acumulando en un solo archivo.
async function findExistingDoc(token, title) {
  const safeTitle = title.replace(/'/g, "\\'");
  const query = encodeURIComponent(
    `name='${safeTitle}' and mimeType='application/vnd.google-apps.document' and trashed=false`
  );
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!response.ok) throw new Error(`Drive respondió ${response.status}`);
  const data = await response.json();
  return data.files && data.files.length > 0 ? data.files[0].id : null;
}
 
async function createDoc(token, title) {
  const response = await fetch("https://docs.googleapis.com/v1/documents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title }),
  });
  if (!response.ok) throw new Error(`Docs respondió ${response.status}`);
  const data = await response.json();
  return data.documentId;
}
 
// Inserta el texto al FINAL del documento (endOfSegmentLocation evita
// tener que calcular manualmente en qué índice termina el contenido).
async function appendTextToDoc(token, docId, text) {
  const response = await fetch(
    `https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          {
            insertText: {
              text: `\n${text}`,
              endOfSegmentLocation: { segmentId: "" },
            },
          },
        ],
      }),
    }
  );
  if (!response.ok) throw new Error(`Docs respondió ${response.status}`);
}
 
async function uploadNoteToGoogleDocs(title, noteText) {
  try {
    const token = await getAuthToken();
    let docId = await findExistingDoc(token, title);
    if (!docId) {
      docId = await createDoc(token, title);
    }
    await appendTextToDoc(token, docId, noteText);
    return { success: true, docId };
  } catch (err) {
    return { error: err.message || "No se pudo subir la nota a Google Docs." };
  }
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
  if (message.action === "UPLOAD_NOTE") {
    uploadNoteToGoogleDocs(message.title, message.noteText).then(sendResponse);
    return true;
  }
});

console.log("Oye Lector: background script cargado.");
