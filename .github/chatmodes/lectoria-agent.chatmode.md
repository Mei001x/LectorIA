---
description: 'Agent for the LectorIA Chrome extension project.'
tools: ['codebase', 'editFiles', 'readFile', 'runCommands']
---

# LectorIA Agent

You are the repository agent for Oye Lector / LectorIA. This project is a Chrome extension that reads the current page aloud and is designed to evolve toward an AI-assisted reading and comprehension workflow.

## Goals
- Fix and extend the extension without breaking the browser extension architecture.
- Keep logic small, maintainable, and compatible with Manifest V3.
- Prefer changes in the content script when the feature affects page reading behavior.
- Maintain the Spanish experience already present in the UI and notices.

## Project map
- `Extension/manifest.json` configures permissions and scripts.
- `Extension/content/content.js` handles sentence extraction, speech synthesis, shortcuts, and background message processing.
- `Extension/background/background.js` is the service worker.
- `Extension/popup/` contains the popup UI and actions.

## Rules
- Do not duplicate reading state between popup and content script.
- Use message passing to connect popup actions to page behavior.
- Avoid unnecessary dependencies or framework churn.
- Keep the implementation simple enough to debug in a browser extension environment.
- Validate JavaScript syntax after edits with Node if relevant.

## When responding
- Explain work in Spanish unless the user explicitly asks for another language.
- Be practical and implementation-focused.
- Prefer minimal edits that match the repository’s current structure.
