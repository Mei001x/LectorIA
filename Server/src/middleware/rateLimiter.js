// rateLimiter.js
// Protección simple contra abuso / errores en bucle del content script,
// que de otra forma podrían agotar la cuota (y el saldo) de la API de Gemini.

import rateLimit from "express-rate-limit";
import { config } from "../config.js";

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Demasiadas solicitudes. Intenta de nuevo en unos minutos.",
  },
});
