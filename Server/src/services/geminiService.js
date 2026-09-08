// geminiService.js
// Único punto del backend que habla con la API de Gemini (paquete oficial
// @google/genai). Si mañana cambiamos de modelo, de proveedor, o agregamos
// caché, todo pasa por aquí: las rutas nunca importan @google/genai directo.

import { GoogleGenAI, Type } from "@google/genai";
import { config } from "../config.js";

let client = null;

function getClient() {
  if (!client) {
    client = new GoogleGenAI({ apiKey: config.geminiApiKey });
  }
  return client;
}

const QUIZ_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      description: "Preguntas de comprensión sobre el texto leído.",
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Exactamente 4 opciones de respuesta.",
          },
          correctIndex: {
            type: Type.INTEGER,
            description: "Índice (0-3) de la opción correcta dentro de 'options'.",
          },
          explanation: {
            type: Type.STRING,
            description: "Breve explicación de por qué esa es la respuesta correcta.",
          },
        },
        required: ["question", "options", "correctIndex", "explanation"],
      },
    },
  },
  required: ["questions"],
};

/**
 * Genera un cuestionario de opción múltiple a partir del texto leído.
 * @param {object} params
 * @param {string} params.text - Texto de la página (o del fragmento leído hasta ahora).
 * @param {number} [params.numQuestions=4] - Cantidad de preguntas a generar.
 * @param {string} [params.language="es"] - Idioma en el que deben redactarse las preguntas.
 * @returns {Promise<{questions: Array}>}
 */
export async function generateQuiz({ text, numQuestions = 4, language = "es" }) {
  if (!text || !text.trim()) {
    const err = new Error("El texto para generar el cuestionario está vacío.");
    err.status = 400;
    throw err;
  }

  const trimmedText = text.slice(0, 20000); // límite defensivo de tamaño de entrada

  const prompt = [
    `Eres un asistente que crea cuestionarios de comprensión lectora para personas invidentes o con baja visión que acaban de escuchar un texto leído en voz alta.`,
    `Genera exactamente ${numQuestions} preguntas de opción múltiple (4 opciones cada una, solo una correcta) en idioma "${language}", basadas ÚNICAMENTE en el siguiente texto.`,
    `No inventes datos que no estén en el texto. Si el texto es muy corto o poco informativo, genera las preguntas que razonablemente se puedan formar.`,
    ``,
    `Texto:`,
    `"""${trimmedText}"""`,
  ].join("\n");

  const response = await getClient().models.generateContent({
    model: config.geminiModel,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: QUIZ_SCHEMA,
    },
  });

  return JSON.parse(response.text);
}

/**
 * Endpoint genérico de texto: útil mientras el flujo de datos entre la
 * extensión y el backend todavía no está cerrado. Permite experimentar con
 * nuevas features (resúmenes, simplificación de texto, traducción, etc.)
 * sin tener que crear una ruta y un método de servicio nuevos cada vez.
 * @param {object} params
 * @param {string} params.prompt - Instrucción completa a enviar al modelo.
 * @returns {Promise<string>}
 */
export async function generateText({ prompt }) {
  if (!prompt || !prompt.trim()) {
    const err = new Error("El prompt está vacío.");
    err.status = 400;
    throw err;
  }

  const response = await getClient().models.generateContent({
    model: config.geminiModel,
    contents: prompt,
  });

  return response.text;
}
