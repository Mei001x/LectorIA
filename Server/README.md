# LectorIA Server

Backend preliminar de **Oye Lector / LectorIA**. Es un cliente Node.js de la
API de Gemini que se sienta entre la extensión de Chrome y Google:

```
Extensión (background.js)  --HTTP-->  Este servidor  --HTTPS-->  Gemini API
```

La clave de la API (`GEMINI_API_KEY`) vive **solo** en este servidor. La
extensión nunca debe contenerla ni llamar a Gemini directamente: primero,
porque el manifest y el código de una extensión son inspeccionables por
cualquier usuario; segundo, porque así este servidor puede evolucionar
(caché, límites, cambio de modelo o de proveedor) sin tocar la extensión.

## Requisitos

- Node.js 20+
- Una clave de la API de Gemini: https://aistudio.google.com/apikey

## Instalación

```bash
cd Server
cp .env.example .env
# edita .env y pega tu GEMINI_API_KEY
npm install
npm run dev
```

El servidor queda escuchando en `http://localhost:3000` (configurable con
`PORT` en `.env`).

## Endpoints

### `GET /health`
Chequeo simple. Útil para que `background.js` confirme que el servidor local
está corriendo antes de pedir un cuestionario.

```json
{ "status": "ok", "service": "lectoria-server" }
```

### `POST /api/quiz`
El endpoint principal: genera un cuestionario de opción múltiple a partir
del texto que la extensión ya leyó en voz alta.

**Body:**
```json
{
  "text": "texto de la página o del fragmento leído (obligatorio)",
  "numQuestions": 4,
  "language": "es"
}
```

**Respuesta:**
```json
{
  "questions": [
    {
      "question": "¿...?",
      "options": ["A", "B", "C", "D"],
      "correctIndex": 2,
      "explanation": "..."
    }
  ]
}
```

`numQuestions` y `language` son opcionales (por defecto 4 y "es"). La salida
está forzada a este esquema mediante `responseSchema` de Gemini, así que
siempre llega JSON válido y con esta forma exacta — no hace falta parsear
texto libre en el content script.

### `POST /api/generate` (genérico, para experimentar)
Como todavía no está cerrado el flujo completo de datos ni todas las
features de IA (resumen, simplificar texto, traducir, etc.), este endpoint
acepta cualquier prompt y devuelve texto plano. Sirve para probar ideas
rápido desde el front sin crear una ruta nueva cada vez.

**Body:** `{ "prompt": "instrucción completa para el modelo" }`
**Respuesta:** `{ "text": "..." }`

Cuando una idea se estabilice, conviene "graduarla" a su propia ruta +
función en `geminiService.js` (como se hizo con `/api/quiz`), con su propio
schema de salida y su propia validación.

## Cómo se conectaría con la extensión

Hoy `Extension/background/background.js` está vacío a propósito. La idea es
que sea el único lugar de la extensión que hace `fetch` a este servidor
(content.js sigue siendo la capa de orquestación dentro de la página, pero
no debería hacer llamadas de red directamente). Ejemplo de flujo:

1. En `content.js`, `askQuestions()` junta el texto ya leído y hace
   `chrome.runtime.sendMessage({ action: "GENERATE_QUIZ", text })`.
2. `background.js` escucha ese mensaje y hace:
   ```js
   const res = await fetch("http://localhost:3000/api/quiz", {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify({ text }),
   });
   const quiz = await res.json();
   ```
3. `background.js` responde al content script (o al popup) con el
   cuestionario para que se muestre/lea al usuario.

Para que ese `fetch` funcione hace falta agregar `host_permissions` en
`Extension/manifest.json` apuntando a la URL del servidor, por ejemplo:

```json
"host_permissions": ["http://localhost:3000/*"]
```

Esto no se agregó todavía porque, según se indica en el pedido original,
la estructura y el flujo de datos exacto aún están por determinarse — este
backend está pensado para ser un punto de partida estable sobre el que
iterar, no la integración final.

## Seguridad y CORS

- CORS acepta automáticamente cualquier origen `chrome-extension://<id>`
  (el id cambia según cómo esté instalada la extensión), más los orígenes
  extra que definas en `EXTRA_ALLOWED_ORIGINS` dentro de `.env` (útil para
  probar el backend desde una página normal en desarrollo).
- Hay un límite de solicitudes por IP (`RATE_LIMIT_MAX`, default 60 cada 15
  minutos) para no agotar la cuota/saldo de la API de Gemini ante un bug o
  un bucle accidental en el content script.
- El texto de entrada a `/api/quiz` se recorta defensivamente a 20 000
  caracteres.

## Estructura

```
Server/
├── package.json
├── .env.example
└── src/
    ├── server.js              # arranque de Express, monta todo
    ├── config.js               # única fuente de verdad de variables de entorno
    ├── middleware/
    │   ├── cors.js              # CORS para chrome-extension://
    │   ├── rateLimiter.js
    │   └── errorHandler.js
    ├── services/
    │   └── geminiService.js    # único lugar que importa @google/genai
    └── routes/
        ├── health.routes.js
        ├── quiz.routes.js       # POST /api/quiz
        └── generate.routes.js   # POST /api/generate (genérico)
```

## Notas sobre el modelo de Gemini

Por defecto se usa `gemini-3.1-flash-lite` (estable, económico, rápido —
buen fit para generar unas pocas preguntas de opción múltiple). Se puede
cambiar con `GEMINI_MODEL` en `.env`, por ejemplo a `gemini-3-flash-preview`
o a un modelo más nuevo si Google libera una versión posterior. Evita fijar
modelos de la familia `gemini-2.5-*`: Google tiene programado su apagado.
