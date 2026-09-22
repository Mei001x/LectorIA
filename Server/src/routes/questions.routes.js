// questions.routes.js
// POST /api/questions
// Body esperado:
// {
//   "text": "texto leído hasta ahora (obligatorio)",
//   "numQuestions": 4,   // opcional, 1-10, default 4
//   "language": "es"     // opcional
// }
//
// Respuesta: { "questions": ["¿...?", "¿...?", ...] }
// Preguntas ABIERTAS (sin opciones de respuesta) — el usuario responde
// libremente, normalmente por voz, y esa respuesta se manda luego a
// POST /api/evaluate.

import { Router } from "express";
import { generateQuestions } from "../services/geminiService.js";
import { asyncRoute } from "../middleware/errorHandler.js";

export const questionsRouter = Router();

questionsRouter.post(
  "/questions",
  asyncRoute(async (req, res) => {
    const { text, numQuestions, language } = req.body ?? {};

    const result = await generateQuestions({ text, numQuestions, language });
    res.json(result);
  })
);
