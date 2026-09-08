// errorHandler.js
// Middleware de error centralizado. Cualquier `next(err)` o excepción
// dentro de una ruta async (ver asyncRoute) termina aquí.

export function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function notFoundHandler(req, res) {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  console.error("Oye Lector server error:", err.message);

  if (err.message?.startsWith("Origen no permitido por CORS")) {
    return res.status(403).json({ error: err.message });
  }

  if (err.status === 400 || err.name === "ValidationError") {
    return res.status(400).json({ error: err.message });
  }

  res.status(502).json({
    error: "No se pudo completar la solicitud a la IA. Intenta de nuevo.",
  });
}
