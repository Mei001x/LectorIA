# Copilot instructions for LectorIA

You are working in a Chrome extension project called Oye Lector. The repository is intentionally small and focused: the core behavior lives in the extension content script, while the popup sends actions to the active tab and the background worker handles extension lifecycle concerns.

## Repository map
- `Extension/manifest.json`: extension configuration
- `Extension/content/content.js`: reads page text, uses speech synthesis, intercepts keyboard shortcuts, and handles runtime messages
- `Extension/background/background.js`: background service worker
- `Extension/popup/popup.js`: popup actions and keyboard event forwarding
- `Extension/popup/popup.html`: popup UI
- `Extension/popup/popup.css`: popup styling

## Design principles
- Stay aligned with Manifest V3 and browser extension APIs.
- Keep the actual reading state in the content script, not in the popup.
- Prefer direct, readable logic with simple functions and minimal abstractions.
- Maintain Spanish labels and user-visible messages.
- Keep the extension behavior robust when the page is dynamic or the user triggers keyboard shortcuts quickly.

## Code conventions
- Prefer progressive enhancement and defensive checks before manipulating the DOM.
- Use `chrome.runtime.onMessage` and `chrome.tabs.sendMessage` for cross-context communication.
- Keep console logs concise and useful for debugging.
- Avoid introducing external dependencies unless there is a clear requirement.

## Validation
Before claiming changes are complete, run syntax checks for modified JavaScript files:
- `node --check Extension/content/content.js`
- `node --check Extension/background/background.js`
- `node --check Extension/popup/popup.js`

## Preferred output style
- Favor practical, implementation-focused edits.
- Explain changes in Spanish when speaking to the user, because the project UI and messages are in Spanish.
- Keep the solution small and focused on the extension’s real feature set.
