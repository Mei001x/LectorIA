// server.js
// Punto de entrada del backend de Oye Lector / LectorIA.
//
// Rol de este servidor: es el ÚNICO lugar donde vive la API key de Gemini.
// La extensión (content.js / background.js) nunca debe llamar a Gemini
// directamente ni contener la clave: le habla a este servidor por HTTP,
// y este servidor le habla a Gemini.
//
//   Extensión (background.js)  --HTTP-->  Server (este proyecto)  --HTTPS-->  Gemini API
//
// Arrancar en desarrollo:
//   cp .env.example .env   (y completar GEMINI_API_KEY)
//   npm install
//   npm run dev

import express from "express";
import { config, assertConfig } from "./config.js";
import { corsMiddleware } from "./middleware/cors.js";
import { rateLimiter } from "./middleware/rateLimiter.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";
import { healthRouter } from "./routes/health.routes.js";
import { quizRouter } from "./routes/quiz.routes.js";
import { generateRouter } from "./routes/generate.routes.js";

assertConfig();

const app = express();

app.use(corsMiddleware);
app.use(express.json({ limit: "1mb" }));
app.use("/api", rateLimiter);

app.use(healthRouter);
app.use("/api", quizRouter);
app.use("/api", generateRouter);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Oye Lector server escuchando en http://localhost:${config.port}`);
  console.log(`Modelo de Gemini configurado: ${config.geminiModel}`);
});
