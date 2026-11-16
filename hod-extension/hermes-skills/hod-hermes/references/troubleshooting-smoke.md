# HOD Troubleshooting & Smoke Test

## Smoke Test Entry Points (54 assertions)

### 1. `GET /api/health`

**Expected response shape:**
```json
{
  "ok": true,
  "mode": "vault",
  "vault": {
    "root": "/caminho/real/do/vault",
    ...
  },
  "connections": {
    "obsidian": { ... },
    "hermes": { ... }
  }
}
```

**Validation checks:**
- `ok` must be `true`
- `mode` must be `"vault"`
- `vault.root` must match the expected vault path from `.hod-config.json`

**Common failures:**
- Server not running → timeout or `ok: false`
- `--vault` not passed at startup → `mode: "local (browser)"` or vaultless state
- Wrong API key → `hermes` connection shows error

---

### 2. `GET /api/hermes/models`

**Expected response shape:**
```json
{
  "ok": true,
  "models": [
    { "id": "hermes-default", "name": "Hermes Default", ... },
    ...
  ]
}
```

**Validation checks:**
- `ok` must be `true`
- `models` list must not be empty
- Must not return `401` (unauthorized) or `502` (bad gateway)

**Common failures:**
- Incorrect `hermes.key` in `.hod-config.json` → `401`
- Hermes Agent server not running on port `8642` → `502` or timeout
- CORS misconfiguration → `blocked-page-recovery` flow needed

---

### 3. `POST /api/hermes/chat` (real agent round-trip)

**Request body:**
```json
{
  "model": "hermes-agent",
  "messages": [{ "role": "user", "content": "Diga em uma frase: conexão HOD-Hermes ativa?" }],
  "stream": false
}
```

**Expected response shape** (OpenAI-compatible, relayed verbatim by the proxy):
```json
{
  "choices": [
    { "message": { "role": "assistant", "content": "Sim, a conexão entre o HOD e o Hermes está ativa." } }
  ],
  "model": "hermes-agent"
}
```

**Validation checks:**
- `choices[0].message.content` must contain text (not empty)
- Response should be in Brazilian Portuguese (`pt-BR`)

**Common failures:**
- `Missing or invalid 'messages' field` → you sent `{ action, input, context }`; that contract does
  **not** exist. `/api/hermes/run` forwards `messages` exactly like `/api/hermes/chat`.
- Empty content → model may not be available; check `GET /api/hermes/models`
- Timeout (>5s) → Hermes subprocess may be hanging; see Server-Hanging Diagnostic in jarvis-dashboard skill

---

## Verification Checklist (Post-Installation)

Before reporting the system as operational, execute these 3 tests:

### Test 1: Health Check
```bash
curl -s http://127.0.0.1:8420/api/health
```
✅ Confirms `ok: true`, `mode: "vault"`, vault root present

### Test 2: Hermes Bridge
```bash
curl -s http://127.0.0.1:8420/api/hermes/models
```
✅ Confirms `ok: true` and non-empty `models` list

### Test 3: Agent Execution
```bash
curl -s -X POST http://127.0.0.1:8420/api/hermes/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Diga em uma frase: conexão HOD-Hermes ativa?"}],"stream":false}'
```
✅ Confirms `choices[0].message.content` has text

---

## Common Pitfalls & Fixes

| Problem | Root Cause | Fix |
|---|---|---|
| `curl /api/health` times out | Server not started or crashed | Start: `node server.mjs --vault "..."`; check `ps aux | grep server.mjs` |
| Health returns `mode: "local (navegador)"` | `--vault` not passed at startup | Re-start server with `node server.mjs --vault "/abs/path/to/vault"` |
| `GET /api/hermes/models` returns `401` | Wrong API key in `.hod-config.json` | Replace `hermes.key` with the value of `API_SERVER_KEY` from `~/.hermes/.env` |
| `409 Conflict` on `POST /api/records` | Note modified in vault after load | Run `POST /api/reindex` or reload via `GET /api/note`, merge, resend |
| Edit in Obsidian not showing on frontend | Forgot to run `POST /api/reindex` | Execute `curl -s -X POST http://127.0.0.1:8420/api/reindex` |
| Smoke test `POST /api/hermes/chat` times out | Hermes subprocess hanging | Run `hermes tools list` directly in a fresh shell; if it hangs, the CLI itself has the issue |