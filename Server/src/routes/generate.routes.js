// generate.routes.js
// POST /api/generate
// Body esperado: { "prompt": "instrucción completa para el modelo" }
//
// Endpoint deliberadamente genérico: como el flujo de datos y las features
// futuras (resumen, simplificación de texto, traducción, etc.) todavía no
// están definidas, este endpoint permite iterar rápido desde el front sin
// tener que agregar una ruta nueva por cada experimento. Cuando una feature
// se estabilice, conviene "graduarla" a su propia ruta + método de servicio
// (como se hizo con /api/questions y /api/evaluate), con su propio schema
// y validación.

import { Router } from "express";
import { generateText } from "../services/geminiService.js";
import { asyncRoute } from "../middleware/errorHandler.js";

export const generateRouter = Router();

generateRouter.post(
  "/generate",
  asyncRoute(async (req, res) => {
    const { prompt } = req.body ?? {};

    const text = await generateText({ prompt });
    res.json({ text });
  })
);
