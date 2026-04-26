# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

Accessible Mail Assistant — a web app for people with motor disabilities (e.g. ALS). It assists with reading, writing, and managing emails using AI/LLM, speech recognition, and accessibility-first design. The user always retains final validation before any message is sent.

## Commands

```bash
# Start the server
npm start                         # runs node backend/src/server.js

# LLM / dataset scripts
npm run test:llm-dataset          # run LLM diagnostics on test dataset
npm run test:llm-context          # evaluate context window sufficiency
npm run seed:mail-rules           # initialize default mail rules in DB

# Gmail test helpers
npm run send:test-gmail-dataset   # send test emails to configured Gmail account
npm run reset:test-gmail-mailbox  # clear the test mailbox

# Build
npm run build:predictive-dictionaries
```

There is no automated test runner (no Jest/Mocha). Test coverage is manual: scripts above + browser UI. See `/docs/Tests/` for test procedures and datasets.

No linter is configured.

## Architecture

### Stack

- **Backend:** Node.js with a native `http` server (no Express). All routes are registered in `backend/src/server.js`.
- **Frontend:** Vanilla HTML/CSS/JavaScript — no framework. Pages communicate with the backend via `fetch` and Server-Sent Events (SSE) for streaming responses.
- **Database:** SQLite3 with WAL mode (`backend/data/agent-mail-assistant.db`), ~21 tables. All schema and queries live in `backend/src/services/databaseService.js` (the largest file, ~120 KB).
- **LLM routing:** `backend/src/services/aiRouter.js` selects between Together.ai, DeepSeek, Mistral, and Ollama based on configuration and role-based model access (`backend/config/model-access.json`).

### Directory layout

```
backend/src/
  server.js              ← HTTP server + all route registration
  routes/                ← Route handlers (thin — delegate to services)
    mailRoutes.js
    accountRoutes.js
    adminRoutes.js
    audioRoutes.js
    backupsRoutes.js
    browserAutomationRoutes.js
  services/              ← All business logic (30 files)
    databaseService.js   ← SQLite schema + every DB query
    mailboxService.js    ← Gmail/IMAP sync via imapflow + OAuth
    llmService.js        ← Email analysis & classification
    audioTranscriptionService.js  ← Deepgram / AssemblyAI / Whisper
    aiRouter.js          ← LLM provider routing
    rephraseService.js, summaryService.js, translationService.js
    securityService.js, emailValidationService.js
    ...
  controllers/
    mailController.js    ← Shared mail utilities used by routes
  utils/logger.js

frontend/
  *.html                 ← One HTML file per page (mail.html is the main UI)
  js/
    mail.js              ← Core mail UI (162 KB, the largest JS file)
    audioInput.js        ← Audio recording (85 KB)
    audioReader.js       ← Audio playback / streaming
    account.js, billing.js, rules.js, sidebar.js, ...
  css/styles.css
  components/sidebar.html  ← Injected into each page

shared/contracts/          ← JSON schemas documenting API payloads
  mail_context.json
  mail_analysis.json
  draft_payload.json
```

### Core data flow

1. **Mail import:** User pastes text or connects Gmail (OAuth) → `mailboxService` → stored in SQLite.
2. **AI analysis:** `mailRoutes → llmService → aiRouter` → LLM provider. Active rules fetched from DB shape the prompt. Results cached in `mail_analysis_cache` table.
3. **Draft generation:** LLM returns three tone variants (court / professionnel / chaleureux). User reviews before sending. Sending is gated by `simulation_enabled` and `validation_required` flags in DB — both default OFF.
4. **Streaming text assist:** Client opens an SSE stream at `/api/mail/text-assist/stream/{sessionId}` after initiating via POST. Used for translation, summarization, rephrasing.
5. **Audio:** Live speech goes through Deepgram or AssemblyAI websocket; on-demand transcription uses `audioTranscriptionService`.

### Multi-environment setup

| Environment | Port | Env file |
|-------------|------|----------|
| Mac (local) | 3001 | `.env.mac` |
| Spark DGX (prod) | 3002 | `.env.spark` |

The server is managed as a systemd service on Spark (`accessible-mail-assistant-multi-spark.service`). Operations notes are in `MEMO-EXPLOITATION.md`.

### Key constraints

- **No send without user validation** — always verify `simulation_enabled` / `validation_required` flags are respected when touching mail-sending paths.
- **Role-based model access** — `backend/config/model-access.json` blocks certain models per environment role. Consult `modelAccessService.js` before adding new LLM calls.
- **SQLite WAL** — the DB file has companion `-shm` / `-wal` files; don't delete them while the server is running.
- **French documentation** — `README.md`, `MEMO-EXPLOITATION.md`, and all files under `docs/` are in French.
