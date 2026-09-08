// cors.js
// Las extensiones de Chrome envían Origin: chrome-extension://<id-generado>.
// Ese id cambia según cómo se instale la extensión (dev sin empaquetar vs.
// Chrome Web Store), así que no podemos poner un origen fijo en la lista
// blanca: aceptamos cualquier chrome-extension:// y, además, los orígenes
// extra que se definan en EXTRA_ALLOWED_ORIGINS (por ejemplo, para probar
// el backend desde una página normal en localhost durante el desarrollo).

import cors from "cors";
import { config } from "../config.js";

const CHROME_EXTENSION_ORIGIN = /^chrome-extension:\/\/[a-z]{32}$/;

export const corsMiddleware = cors({
  origin(origin, callback) {
    // Sin header Origin (curl, Postman, peticiones server-to-server): permitir.
    if (!origin) return callback(null, true);

    if (CHROME_EXTENSION_ORIGIN.test(origin)) return callback(null, true);
    if (config.extraAllowedOrigins.includes(origin)) return callback(null, true);

    callback(new Error(`Origen no permitido por CORS: ${origin}`));
  },
});
