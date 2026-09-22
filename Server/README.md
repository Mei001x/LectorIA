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

### `POST /api/questions`
Genera una o más preguntas **abiertas** (sin opciones de respuesta) a partir
del texto que la extensión ya leyó en voz alta. El usuario responde
libremente (normalmente por voz).

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
{ "questions": ["¿...?", "¿...?", "¿...?", "¿...?"] }
```

`numQuestions` es opcional (default 4, máximo 10) y `language` también
(default "es"). Al igual que antes, la salida está forzada a este esquema
mediante `responseSchema` de Gemini, así que siempre llega JSON válido.

### `POST /api/evaluate`
Evalúa una o más respuestas abiertas contra sus preguntas: para cada una
indica si es correcta o incorrecta y le asigna un puntaje de 0 a 10.

**Body:**
```json
{
  "items": [
    { "question": "¿Dónde nace el río Amazonas?", "answer": "En los Andes peruanos" },
    { "question": "¿A qué océano desemboca?", "answer": null }
  ],
  "language": "es"
}
```
`answer` puede venir `null` si el usuario no respondió a tiempo — el
servidor lo trata como incorrecto (score 0) y explica cuál era la idea
esperada. Sirve tanto para evaluar una sola respuesta (`items` con un solo
elemento) como un cuestionario completo.

**Respuesta:**
```json
{
  "results": [
    {
      "question": "¿Dónde nace el río Amazonas?",
      "correct": true,
      "score": 9,
      "feedback": "Correcto, identificaste bien el origen del río."
    },
    {
      "question": "¿A qué océano desemboca?",
      "correct": false,
      "score": 0,
      "feedback": "No respondiste. Desemboca en el océano Atlántico."
    }
  ],
  "overallScore": 4.5
}
```

`overallScore` es el promedio de los puntajes individuales.

### `POST /api/generate` (genérico, para experimentar)
Como todavía no está cerrado el flujo completo de datos ni todas las
features de IA (resumen, simplificar texto, traducir, etc.), este endpoint
acepta cualquier prompt y devuelve texto plano. Sirve para probar ideas
rápido desde el front sin crear una ruta nueva cada vez.

**Body:** `{ "prompt": "instrucción completa para el modelo" }`
**Respuesta:** `{ "text": "..." }`

Cuando una idea se estabilice, conviene "graduarla" a su propia ruta +
función en `geminiService.js` (como se hizo con `/api/questions` y
`/api/evaluate`), con su propio
schema de salida y su propia validación.

## Cómo se conecta con la extensión (ya implementado)

`Extension/background/background.js` es el único lugar de la extensión que
hace `fetch` a este servidor (`content.js` nunca llama a la red directo).
Flujo real:

1. En `content.js`, al terminar de leer (o al presionar "C"), se junta el
   texto leído y se manda `chrome.runtime.sendMessage({ action: "START_QUIZ", content })`.
2. `background.js` recibe el mensaje y llama a `POST /api/questions` con
   ese texto, pidiendo 4 preguntas abiertas.
3. Cada pregunta se lee en voz alta y se escucha la respuesta del usuario
   por reconocimiento de voz (con límite de tiempo; si no responde, esa
   respuesta queda como `null`).
4. Al terminar las 4 preguntas, `content.js` manda
   `chrome.runtime.sendMessage({ action: "EVALUATE_QUIZ", items })` con
   los pares `{ question, answer }`.
5. `background.js` llama a `POST /api/evaluate`, arma un texto de
   retroalimentación a partir de `results` y `overallScore`, y se lo
   devuelve a `content.js` para que lo lea en voz alta.

`host_permissions` en `manifest.json` ya incluye `http://localhost:3000/*`,
necesario para que ese `fetch` funcione.

## Seguridad y CORS

- CORS acepta automáticamente cualquier origen `chrome-extension://<id>`
  (el id cambia según cómo esté instalada la extensión), más los orígenes
  extra que definas en `EXTRA_ALLOWED_ORIGINS` dentro de `.env` (útil para
  probar el backend desde una página normal en desarrollo).
- Hay un límite de solicitudes por IP (`RATE_LIMIT_MAX`, default 60 cada 15
  minutos) para no agotar la cuota/saldo de la API de Gemini ante un bug o
  un bucle accidental en el content script.
- El texto de entrada a `/api/questions` se recorta defensivamente a 20 000
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
        ├── questions.routes.js   # POST /api/questions
        ├── evaluate.routes.js    # POST /api/evaluate
        └── generate.routes.js    # POST /api/generate (genérico)
```

## Notas sobre el modelo de Gemini

Por defecto se usa `gemini-3.1-flash-lite` (estable, económico, rápido —
buen fit para generar unas pocas preguntas de opción múltiple). Se puede
cambiar con `GEMINI_MODEL` en `.env`, por ejemplo a `gemini-3-flash-preview`
o a un modelo más nuevo si Google libera una versión posterior. Evita fijar
modelos de la familia `gemini-2.5-*`: Google tiene programado su apagado.
