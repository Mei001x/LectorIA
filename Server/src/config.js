// config.js
// Punto único de lectura de variables de entorno. El resto del código
// nunca debería leer process.env directamente: siempre importa de aquí.

import "dotenv/config";

function parseOrigins(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export const config = {
  port: Number(process.env.PORT) || 3000,
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-3.1-flash-lite",
  extraAllowedOrigins: parseOrigins(process.env.EXTRA_ALLOWED_ORIGINS),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX) || 60,
};

export function assertConfig() {
  if (!config.geminiApiKey) {
    throw new Error(
      "Falta GEMINI_API_KEY. Copia .env.example a .env y agrega tu clave de la API de Gemini."
    );
  }
}
