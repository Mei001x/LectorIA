// evaluate.routes.js
// POST /api/evaluate
// Body esperado:
// {
//   "items": [
//     { "question": "¿...?", "answer": "..." },
//     { "question": "¿...?", "answer": null }   // null = no respondió
//   ],
//   "language": "es"   // opcional
// }
//
// Respuesta:
// {
//   "results": [
//     { "question": "...", "correct": true, "score": 8, "feedback": "..." },
//     ...
//   ],
//   "overallScore": 6.5
// }
//
// Sirve tanto para evaluar una sola respuesta (items con un ítem) como un
// lote de varias preguntas del mismo cuestionario.

import { Router } from "express";
import { evaluateAnswers } from "../services/geminiService.js";
import { asyncRoute } from "../middleware/errorHandler.js";

export const evaluateRouter = Router();

evaluateRouter.post(
  "/evaluate",
  asyncRoute(async (req, res) => {
    const { items, language } = req.body ?? {};

    const result = await evaluateAnswers({ items, language });
    res.json(result);
  })
);
