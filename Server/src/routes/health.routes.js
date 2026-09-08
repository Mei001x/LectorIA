// health.routes.js
// Endpoint simple para que el background.js de la extensión (o cualquiera)
// pueda comprobar que el servidor local está corriendo antes de intentar
// generar un cuestionario.

import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/health", (req, res) => {
  res.json({ status: "ok", service: "lectoria-server" });
});
