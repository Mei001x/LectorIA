# AGENTS.md

## Project context
This repository contains a Chrome extension named Oye Lector, also referenced as LectorIA. The extension reads the visible text of the active page using the browser speech engine and exposes keyboard and popup controls for playback and next steps.

## Key architecture
- `Extension/manifest.json`: Manifest V3 configuration for permissions, popup, background worker, and content script.
- `Extension/content/content.js`: Page-level logic for reading sentences aloud, global keyboard shortcuts, and runtime messaging.
- `Extension/background/background.js`: Service worker for background tasks.
- `Extension/popup/`: Popup UI and actions that send messages to the active tab.

## Working rules
- Prefer minimal, targeted edits over broad rewrites.
- Keep speech and DOM behavior in the content script. Avoid duplicating state in the popup.
- Use Chrome messaging patterns (`chrome.tabs.sendMessage` and `chrome.runtime.onMessage`) instead of ad-hoc globals.
- Preserve the Spanish user experience and notice text already used in the extension.
- Keep compatibility with Manifest V3 and browser extension constraints.
- Do not introduce frameworks or build tooling unless the task explicitly requires it.

## Validation
When making JavaScript changes, validate with Node syntax checks:
- `node --check Extension/content/content.js`
- `node --check Extension/background/background.js`
- `node --check Extension/popup/popup.js`

## Contribution expectations
- Make small changes that are easy to review.
- Keep names and behavior explicit.
- When adding new features, follow the existing extension structure and avoid duplicating logic.
- If the user request is for an AI feature, design the integration to be pluggable and keep the content script as the orchestration layer.
