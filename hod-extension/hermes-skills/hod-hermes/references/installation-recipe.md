# HOD Installation Recipe

## Fresh Installation Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/Melquisedeque3/Central_HOD.git
   cd Central_HOD
   ```

2. **Discover the Obsidian vault path**
   - **macOS**: inspect `~/Library/Application Support/obsidian/obsidian.json` to list registered vault paths:
     ```bash
     cat ~/Library/Application\ Support/obsidian/obsidian.json | python3 -c "import json,sys; data=json.load(sys.stdin); [print(p['path']) for p in data.get('paths',[])]"
     ```
   - **Linux**: inspect `~/.config/obsidian/obsidian.json` similarly.
   - Alternatively, create a dedicated folder (e.g., `~/Obsidian/HOD_Vault`) and open it in Obsidian.

3. **Create the vault structure**
   Inside the vault, create these folders:
   - `Candidaturas/` — process seletivos (hod_type: application)
   - `Tarefas/` — tarefas diárias (hod_type: task)
   - `Guidelines/` — manuais de qualificação (hod_type: guideline)
   - `Rotina/` — blocos de horário diários (hod_type: routine)

4. **Configure `.hod-config.json`** (create inside `hod-extension/`; already `.gitignore`d)
   ```json
   {
     "obsidian": {
       "enabled": false,
       "url": "http://127.0.0.1:27123",
       "key": "",
       "folder": ""
     },
     "hermes": {
       "enabled": true,
       "url": "http://127.0.0.1:8642",
       "key": "COLE_AQUI_O_API_SERVER_KEY_DO_HERMES",
       "model": "hermes-agent",
       "dashboard": "http://127.0.0.1:9119"
     },
     "ui": { "theme": "dark" }
   }
   ```
   The schema is closed and nested: the server only reads `obsidian{enabled,url,key,folder}`,
   `hermes{enabled,url,key,model,dashboard}`, `routine{slots}` and `ui{theme}`.
   There is **no** `vaultPath` key and the secret field is **`key`**, not `apiKey`.

5. **Verify Node.js environment**
   ```bash
   node --version
   ```
   Must be `>= 20`. HOD uses zero dependencies — no `npm install` required.

6. **Start the HOD server** (from `hod-extension/`, not the repo root)
   ```bash
   cd hod-extension
   node server.mjs --vault "/caminho/absoluto/para/o/VaultDoObsidian" --config "$PWD/.hod-config.json"
   ```
   Server runs on `http://127.0.0.1:8420`.

7. **Verify the Hermes Agent bridge**
   ```bash
   curl -s http://127.0.0.1:8420/api/hermes/models
   ```
   Must return `"ok": true` with a non-empty `models` list. `401` or `502` means the API key is wrong or the server is unreachable.

8. **Smoke test (54 assertions)**
   - `GET /api/health` — confirms `ok: true`, `mode: "vault"`, vault root matches
   - `GET /api/state` — snapshot of all entities (applications, tasks, guidelines, routine)
   - `POST /api/hermes/chat` with `{ "messages": [{ "role": "user", "content": "..." }], "stream": false }`
     — confirm `choices[0].message.content`. (`/api/hermes/run` does **not** accept
     `{ action, input, context }`; it forwards `messages` to `/v1/chat/completions`.)

## Troubleshooting Common Issues

| Symptom | Cause & Solution |
|---|---|
| "Mode local (navegador)" in superior | Opened `index.html` via `file://` or server stopped. Start `node server.mjs --vault "..."` and access `http://127.0.0.1:8420`. |
| Hermes Agent 502 / Offline | Hermes API server not running on port `8642` or incorrect `API_SERVER_KEY` in `.hod-config.json`. Verify `curl http://127.0.0.1:8642/v1/models`. |
| Edited note in Obsidian not reflecting on screen | Click "Sincronizar vault" (or send `POST /api/reindex`). |
| `409 Conflict` on save | Note was modified in disk after screen load. Reload/sync vault for latest version. |
| Desire for sample data | With server pointing at empty vault, run `npm run seed` (or `node scripts/seed.mjs --force`). |

## User Preferences (Always-On)

- **Language**: Respond in Brazilian Portuguese (`pt-BR`).
- **Vault path**: `--vault` arg or `HOD_VAULT` env var mandatory on server start.
- **Hermes API key**: Must be set in `.hod-config.json` as `hermes.key` (copied from `API_SERVER_KEY` in `~/.hermes/.env`). Without it, `GET /api/hermes/models` and `POST /api/hermes/chat` fail.
- **No `npm install`**: HOD is zero-dependencies. Any step referencing `npm` is incorrect for this codebase.
- **Loopback-only by default**: `server.mjs` listens on `127.0.0.1:8420`. Do not expose port 8420 to public networks without additional authentication.