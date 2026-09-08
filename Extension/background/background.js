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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "PING_SERVER") {
    pingServer().then(sendResponse);
    return true; // mantiene el canal abierto para la respuesta async
  }
});

console.log("Oye Lector: background script cargado.");
