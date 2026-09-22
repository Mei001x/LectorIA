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

function assertNonEmptyText(text, message) {
  if (!text || !text.trim()) {
    const err = new Error(message);
    err.status = 400;
    throw err;
  }
}

const QUESTIONS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      description: "Preguntas abiertas de comprensión sobre el texto leído. Sin opciones de respuesta.",
      items: { type: Type.STRING },
    },
  },
  required: ["questions"],
};

/**
 * Genera una o más preguntas ABIERTAS de comprensión a partir del texto
 * leído (sin opciones de respuesta: el usuario responde libremente, por
 * voz o texto).
 * @param {object} params
 * @param {string} params.text - Texto de la página (o del fragmento leído hasta ahora).
 * @param {number} [params.numQuestions=4] - Cantidad de preguntas a generar.
 * @param {string} [params.language="es"] - Idioma en el que deben redactarse las preguntas.
 * @returns {Promise<{questions: string[]}>}
 */
export async function generateQuestions({ text, numQuestions = 4, language = "es" }) {
  assertNonEmptyText(text, "El texto para generar preguntas está vacío.");

  const trimmedText = text.slice(0, 20000); // límite defensivo de tamaño de entrada
  const count = Math.min(Math.max(Number(numQuestions) || 4, 1), 10);

  const prompt = [
    `Eres un asistente que crea preguntas de comprensión lectora para personas invidentes o con baja visión que acaban de escuchar un texto leído en voz alta.`,
    `Genera exactamente ${count} preguntas ABIERTAS (de desarrollo, sin opciones de respuesta) en idioma "${language}", basadas ÚNICAMENTE en el siguiente texto.`,
    `Cada pregunta debe poder responderse con una o dos oraciones. No inventes datos que no estén en el texto.`,
    ``,
    `Texto:`,
    `"""${trimmedText}"""`,
  ].join("\n");

  const response = await getClient().models.generateContent({
    model: config.geminiModel,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: QUESTIONS_SCHEMA,
    },
  });

  return JSON.parse(response.text);
}

const EVALUATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    results: {
      type: Type.ARRAY,
      description: "Un resultado de evaluación por cada pregunta recibida, en el mismo orden.",
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          correct: {
            type: Type.BOOLEAN,
            description: "true si la respuesta demuestra haber entendido lo esencial de la pregunta.",
          },
          score: {
            type: Type.INTEGER,
            description: "Puntaje de 0 a 10. 0 si no hay respuesta o es completamente incorrecta.",
          },
          feedback: {
            type: Type.STRING,
            description: "1-2 oraciones: qué estuvo bien, qué faltó o cuál era la idea clave si no respondió.",
          },
        },
        required: ["question", "correct", "score", "feedback"],
      },
    },
    overallScore: {
      type: Type.NUMBER,
      description: "Promedio de los puntajes individuales, de 0 a 10.",
    },
  },
  required: ["results", "overallScore"],
};

/**
 * Evalúa una o más respuestas abiertas del usuario contra sus preguntas
 * correspondientes: para cada una determina si es correcta o incorrecta,
 * le asigna un puntaje de 0 a 10, y da una breve retroalimentación.
 * @param {object} params
 * @param {Array<{question: string, answer: string|null}>} params.items -
 *   `answer` puede venir null/vacío si el usuario no respondió a tiempo.
 * @param {string} [params.language="es"]
 * @returns {Promise<{results: Array, overallScore: number}>}
 */
export async function evaluateAnswers({ items, language = "es" }) {
  if (!Array.isArray(items) || items.length === 0) {
    const err = new Error("Se necesita al menos un ítem { question, answer } para evaluar.");
    err.status = 400;
    throw err;
  }
  for (const item of items) {
    if (!item || typeof item.question !== "string" || !item.question.trim()) {
      const err = new Error("Cada ítem necesita una 'question' no vacía.");
      err.status = 400;
      throw err;
    }
  }

  const prompt = [
    `Eres un asistente que evalúa respuestas de comprensión lectora de una persona invidente o con baja visión, dadas por voz.`,
    `Para cada pregunta con su respuesta (en idioma "${language}"):`,
    `- Indica si es correcta (demuestra haber entendido lo esencial) o incorrecta.`,
    `- Da un puntaje entero de 0 a 10. Sé razonable: una respuesta parcialmente correcta puede tener puntaje intermedio, no todo es 0 o 10.`,
    `- Si "answer" es null o está vacío, significa que el usuario no respondió: correct debe ser false, score debe ser 0, y el feedback debe explicar cuál era la idea clave esperada.`,
    `- Da una retroalimentación breve (1-2 oraciones), clara y amable, en "${language}". Sin markdown ni listas: se leerá en voz alta.`,
    `Al final, calcula "overallScore" como el promedio de los puntajes individuales.`,
    ``,
    `Preguntas y respuestas (JSON):`,
    JSON.stringify(items),
  ].join("\n");

  const response = await getClient().models.generateContent({
    model: config.geminiModel,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: EVALUATION_SCHEMA,
    },
  });

  return JSON.parse(response.text);
}

/**
 * Endpoint genérico de texto: útil para features que no ameritan todavía
 * su propio schema estructurado (por ejemplo, responder una pregunta
 * suelta del usuario sobre lo leído, con un texto libre).
 * @param {object} params
 * @param {string} params.prompt - Instrucción completa a enviar al modelo.
 * @returns {Promise<string>}
 */
export async function generateText({ prompt }) {
  assertNonEmptyText(prompt, "El prompt está vacío.");

  const response = await getClient().models.generateContent({
    model: config.geminiModel,
    contents: prompt,
  });

  return response.text;
}
