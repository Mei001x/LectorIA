# LectorIA

**Extensión de Chrome para el aprendizaje autónomo de estudiantes ciegos y con baja visión.**

LectorIA lee en voz alta cualquier página web, permite interrumpir la lectura para hacer preguntas por voz y, al terminar, evalúa la comprensión del usuario con un cuestionario de preguntas abiertas. No es solo un lector de texto a voz: está pensada para acompañar el proceso de aprendizaje cuando no hay un profesor o alguien con conocimiento del tema disponible.

> 🏅 Quinto lugar a nivel internacional en la categoría **Educación Especial** de la Hackatón Internacional de Innovación Educativa Juvenil 2026, organizada por Empower Youth SV (El Salvador).

---

## Tabla de contenidos

- [Problema](#problema)
- [Solución](#solución)
- [Funcionalidades](#funcionalidades)
- [Controles](#controles)
- [Arquitectura](#arquitectura)
- [Instalación](#instalación)
- [Uso](#uso)
- [Estado actual y limitaciones](#estado-actual-y-limitaciones)
- [Hoja de ruta](#hoja-de-ruta)
- [Equipo](#equipo)

---

## Problema

Los estudiantes ciegos o con baja visión suelen enfrentarse a contenidos digitales que los lectores de pantalla tradicionales solo recitan, sin ayudar a comprenderlos. Cuando surge una duda, muchas veces no hay un docente a mano, y el apoyo de familiares, aunque bienintencionado, no siempre garantiza una explicación certera.

El resultado es que el estudiante puede acceder al texto, pero no necesariamente aprender de él.

## Solución

LectorIA convierte la lectura en un proceso interactivo:

1. **Lee** la página completa, incluyendo texto y gráficos.
2. **Responde dudas** en el momento: el usuario pausa y pregunta, por ejemplo, *"¿a qué te refieres con fotón?"*, y luego continúa desde el mismo punto.
3. **Evalúa** lo aprendido con preguntas abiertas y retroalimentación generada por IA.
4. **Registra notas** por voz y las guarda en Google Docs.

La extensión no limita lo que el usuario quiere aprender: funciona sobre cualquier contenido de la web.

## Funcionalidades

- **Lectura de páginas web** (texto y gráficos) en voz alta.
- **Preguntas por voz**: al pausar la lectura, el micrófono se activa automáticamente para recibir la duda.
- **Cuestionario de comprensión** de 4 preguntas abiertas, elegidas para favorecer el pensamiento crítico. Cada pregunta tiene tiempo límite; si no hay respuesta, se avanza y se marca como no respondida.
- **Ofrecimiento automático del cuestionario** al terminar la lectura, con detección de variaciones de sí/no en la respuesta del usuario.
- **Notas por voz** transcritas en tiempo real a un documento de Google Docs, nombrado con el título del artículo y la fecha. Las notas posteriores del mismo artículo o día se acumulan en el mismo documento.
- **Comandos de voz con sinónimos**, para que resulten intuitivos.
- **Respaldo por teclado** con teclas de forma distintiva, pensadas para ser fáciles de reconocer al tacto, útiles en espacios donde no se puede hablar (por ejemplo, en el aula, usando audífonos).
- **Panel en pantalla** con botones para las mismas funciones, pensado para cuando el usuario cuenta con un ayudante.

## Controles

### Comandos de voz

| Comando | Acción |
| --- | --- |
| "Oye lector, inicia" | Comienza la lectura de toda la página |
| "Oye lector, detener" | Pausa la lectura y activa el micrófono para una pregunta |
| "Oye lector, reanuda" | Continúa desde el mismo punto donde se pausó |
| "Oye lector, comenzar nota" | Inicia la grabación de una nota (con la lectura detenida) |
| "Oye lector, sube nota" | Sube las notas a Google Docs |

### Atajos de teclado

| Tecla | Acción |
| --- | --- |
| `Espacio` | Reproducir / pausar |
| `C` | Iniciar el cuestionario directamente |
| `Shift` | Iniciar la grabación de notas / subirlas a Google Docs |

## Arquitectura

```
LectorIA/
├── Extension/        # Extensión de Chrome (JavaScript)
└── Server/
    └── src/          # Backend en Node.js + Express
```

- **Extensión (cliente):** lectura en voz alta, reconocimiento de voz, comandos, atajos de teclado y panel en pantalla.
- **Servidor:** API en Express que se comunica con el modelo de IA mediante el SDK `@google/genai` (modelo `gemini-3.1-flash-lite`).

### Endpoints

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/health` | Verifica que el servidor esté activo |
| `POST` | `/api/generate` | Genera una respuesta a partir de un prompt |
| `POST` | `/api/quiz` | Generación de cuestionario (opción múltiple; sin uso por ahora) |

### ¿Por qué Chrome y Gemini?

Se eligió una extensión de Chrome con Gemini para minimizar costos de desarrollo y operación, manteniendo la solución accesible.

## Instalación

### Requisitos

- Node.js 18 o superior
- Google Chrome
- Una clave de API de Gemini

### 1. Clonar el repositorio

```bash
git clone https://github.com/<usuario>/LectorIA.git
cd LectorIA
```

### 2. Configurar y ejecutar el servidor

```bash
cd Server
npm install
```

Crea un archivo `.env` con tu clave:

```env
GEMINI_API_KEY=tu_clave_aqui
```

Inicia el servidor:

```bash
npm start
```

Verifica que funcione abriendo `http://localhost:<puerto>/health`.

### 3. Cargar la extensión en Chrome

1. Abre `chrome://extensions`.
2. Activa el **Modo de desarrollador**.
3. Haz clic en **Cargar descomprimida** y selecciona la carpeta `Extension/`.

## Uso

1. Abre la página que quieres leer.
2. Inicia la lectura con el botón **Iniciar lectura**, con `Espacio` o diciendo *"Oye lector, inicia"*.
3. Para hacer una pregunta, pausa la lectura y habla.
4. Al terminar, acepta el cuestionario por voz o presiona `C`.
5. Para tomar notas, detén la lectura y usa el comando de notas o la tecla `Shift`.

## Estado actual y limitaciones

LectorIA es un prototipo desarrollado durante una hackatón de 3 días.

- Para ahorrar tokens, la retroalimentación del cuestionario se limita por ahora a indicar si cada respuesta es correcta o incorrecta. La intención del proyecto es que la retroalimentación sea completa y explique en qué se equivocó el usuario en cada pregunta.
- El demo funciona con los tokens gratuitos de la IA. Una publicación en la Chrome Web Store requeriría un modelo de costos, aunque sea mínimo.
- Al ser una extensión de navegador, hoy solo funciona en laptops y computadoras.

## Hoja de ruta

- [ ] Retroalimentación completa en el cuestionario, explicando los errores por pregunta.
- [ ] Integración con **TalkBack** (lector de pantalla de Android) para llevar LectorIA a celulares.
- [ ] Publicación en la Chrome Web Store con un modelo de costos sostenible.
- [ ] Pruebas con usuarios ciegos y con baja visión para validar los controles y el flujo de aprendizaje.

## Licencia

MIT 
