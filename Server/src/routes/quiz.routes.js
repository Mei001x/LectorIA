// quiz.routes.js
// POST /api/quiz
// Body esperado:
// {
//   "text": "texto de la página leída (obligatorio)",
//   "numQuestions": 4,        // opcional
//   "language": "es"         // opcional
// }
//
// Este es el endpoint que, en content.js, reemplazará al TODO dentro de
// askQuestions() / ASK_QUESTIONS una vez que decidamos el flujo exacto
// (por ejemplo: content.js -> background.js -> este servidor).

import { Router } from "express";
import { generateQuiz } from "../services/geminiService.js";
import { asyncRoute } from "../middleware/errorHandler.js";

export const quizRouter = Router();

quizRouter.post(
  "/quiz",
  asyncRoute(async (req, res) => {
    const { text, numQuestions, language } = req.body ?? {};

    const quiz = await generateQuiz({ text, numQuestions, language });
    res.json(quiz);
  })
);
