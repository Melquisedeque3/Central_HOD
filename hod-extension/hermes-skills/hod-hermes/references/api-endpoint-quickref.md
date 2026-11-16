# HOD API Endpoint Quick Reference

## Frequently Used Endpoints

| Method & Route | Description | Payload / Return |
|---|---|---|
| `GET /api/health` | Complete system diagnostics | `{ ok: true, mode: "vault", vault: {...}, connections: { obsidian, hermes } }` |
| `GET /api/state` | Full vault snapshot | `{ version: 4, applications, tasks, guidelines, routine, emails, calendarEvents, driveFiles, vault, connections }` |
| `POST /api/records` | Create or update a record (`.md`) | Body: `{ "type": "application\|task\|guideline\|routine\|settings", "data": {...} }` → `{ ok: true, record }`. **`data.id` is required** — otherwise `400 {"error":"Registro sem id."}` |
| `DELETE /api/records/:type/:id` | Move note to `.hod/trash/` and create tombstone | `{ ok: true, deleted: true, path }` |
| `POST /api/bag` | Update auxiliary lists in `.hod/bag.json` | Body: `{ "emails": [...], "calendarEvents": [...], "driveFiles": [...] }` |
| `POST /api/reindex` | Re-scan all `.md` and rebuild `.hod/index.json` | Returns full state (same format as `GET /api/state`) |
| `GET /api/note?path=<relPath>` | Read raw Markdown of a vault note | `{ path, content }` |
| `PUT /api/note` | Override Markdown of a note and reindex | Body: `{ "path": "Candidaturas/...", "content": "---\n..." }` |
| `GET /api/config` | Read public integration config | Returns URLs, models, flags `hasKey` (never exposes secrets) |
| `POST /api/config` | Update `.hod-config.json` | Partial body with `{ obsidian?, hermes?, ui?, routine? }` (no `vaultPath` — the vault is a CLI arg) |
| `GET /api/hermes/models` | Proxy to `GET <hermes.url>/v1/models` | Lists models available in Hermes Agent |
| `POST /api/hermes/chat` | Proxy to `POST <hermes.url>/v1/chat/completions` | Supports `stream: true` (SSE) and `stream: false` (JSON) |
| `POST /api/hermes/run` | Convenience shortcut that forwards to `<hermes.url>/v1/chat/completions` | Body `{ messages, model? }` — **NOT** `{ action, input, context }` |

## Common Headers

All API calls should include:
- `Content-Type: application/json` (for POST/PUT bodies)
- `Authorization: Bearer <HERMES_API_KEY>` (when the Hermes proxy requires authentication)

## Error Response Shapes

- `409 Conflict`: `{ error: "Conflito: a nota foi modificada mais recentemente no vault.", current: {...} }` — reload and merge before resending
- `403 Forbidden`: Access to internal directories (`/lib`, `/vault`, `/scripts`, `/.git`, etc.) blocked
- `502 Bad Gateway`: Hermes Agent API server unreachable or misconfigured `.hod-config.json` key

## Quick Selection Guide

| Goal | Endpoint |
|---|---|
| Check if server is running | `GET /api/health` |
| See current state of all entities | `GET /api/state` |
| Create a new candidacy | `POST /api/records` with `{ "type": "application", "data": { ... } }` |
| Update a task's status | `POST /api/records` with `{ "type": "task", "data": { ..., "status": "doing" } }` |
| Delete a record | `DELETE /api/records/:type/:id` |
| Refresh index after direct vault edit | `POST /api/reindex` |
| List Hermes Agent models | `GET /api/hermes/models` |
| Send a chat message to Hermes | `POST /api/hermes/chat` with `{ "messages": [...], "stream": true\|false }` |
| Run a daily briefing | `POST /api/hermes/chat` with a user message describing the briefing (there is no `action` endpoint) |