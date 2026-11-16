---
name: hod-hermes
description: "Use when integrating HOD with Hermes and Obsidian vault."
version: 1.0.0
author: Hermes Agent review
license: MIT
category: productivity
metadata:
  hermes:
    tags: [hod, hermes, obsidian, integration, productivity]
    related_skills: [jarvis-dashboard, obsidian]
---

Use when integrating HOD with Hermes and Obsidian vault.

## When to Use
- Setting up Central HOD for the first time with an Obsidian vault
- Configuring Hermes Agent bridge integration
- Installing and verifying the HOD server and frontend
- Performing day-to-day operations: CRUD on candidaturas, tarefas, guidelines, rotina
- Running smoke tests and health checks on the HOD-Hermes bridge

## Always-On Rules

### Installation sequence
1. Clone: `git clone https://github.com/Melquisedeque3/Central_HOD.git`
2. **The app lives in `Central_HOD/hod-extension/`, NOT the repo root.** `server.mjs`, `index.html`, `lib/`, `js/`, `package.json` and `.hod-config.json` all live there.
3. Find the real vault from Obsidian's own registry: `cat "$HOME/Library/Application Support/obsidian/obsidian.json"` (macOS) — use the `vaults[<id>].path` value, not a path you guessed. Never create a second vault next to it.
4. Create in the vault: `Candidaturas/`, `Tarefas/`, `Guidelines/`, `Rotina/` (the server also creates `.hod/` and `.hod/trash/` itself).
5. Configure `hod-extension/.hod-config.json` (gitignored). Schema is nested only — `{obsidian:{enabled,url,key,folder}, hermes:{enabled,url,key,model,dashboard}, routine, ui}`. There is **no** `vaultPath` key and the secret field is `key`, not `apiKey`.
6. Node >= 20: `node --version`.
7. Start: `cd hod-extension && node server.mjs --vault "/abs/path/to/vault"` — the vault is a CLI arg (`--vault` / `HOD_VAULT`), never a config key.
8. Bridge check: `curl -s http://127.0.0.1:8420/api/hermes/models` must return a `data[]` list.

### Enabling the Hermes API Server (port 8642)
Hermes only exposes `/v1/*` when the gateway's `api_server` platform is on. Env vars in `~/.hermes/.env` are the reliable path (the `gateway.api_server.*` keys in config.yaml are flagged "not a recognized config key" yet are still read):
```
API_SERVER_ENABLED=true
API_SERVER_PORT=8642
API_SERVER_HOST=127.0.0.1
API_SERVER_KEY=<generated secret>
API_SERVER_CORS_ORIGINS=http://127.0.0.1:8420,http://localhost:8420
```
Then `hermes gateway restart` and confirm `lsof -nP -iTCP:8642 -sTCP:LISTEN`. `/v1/models` advertises `hermes-agent` — put exactly that id in `hermes.model`. Never print the key in chat; read it from `.env` into the config file programmatically.

### Data interaction rules
- Never edit `.hod/index.json` directly — it is a derived cache regenerated on every server operation
- Preserve `id` stability on `POST /api/records` updates; the vault module updates in-place by `id`
- On `409 Conflict`: reload via `GET /api/note`, merge changes, resend with the `updatedAt` from the current version
- After direct filesystem edits to `.md`: always run `POST /api/reindex` so frontend reflects the change
- Always delete via `DELETE /api/records/:type/:id` — moves to `.hod/trash/` and records tombstone in `.hod/tombstones.json`

### Voz (STT/TTS)
O código original do HOD implementa o microfone (`#aiMic`, `webkitSpeechRecognition`, `pt-BR`) mas **a função `speak()` nunca era chamada** — `export function speak` existia em `views/ai.js` e o template nunca a invocava, então o usuário falava e nunca recebia resposta em voz. Correção aplicada (replicar em qualquer install novo):
1. Botão `#aiSpeak` (🔊) ao lado do 🎙 que alterna leitura das respostas, persistido em `localStorage['hod:hermes:voiceOut']`.
2. `if (voiceOut) speak(answer);` no fim do caminho de sucesso de `stream()`.
3. `pickPtVoice()` pontua vozes por `pt-BR` > `pt` + `localService` e escolhe a melhor; `speak()` só define `utter.voice` se achou uma.
4. `speakable()` remove blocos de código, markdown e links antes de falar.
5. `stopSpeaking()` no início do `toggleMic` — sem isso o microfone transcreve a própria resposta do agente.
6. Com `voiceOut` ligado, `onend` do recognizer envia a pergunta sozinho (modo conversa por voz).
As vozes do Chrome carregam de forma assíncrona: chamar `speechSynthesis.getVoices()` na carga e de novo no evento `voiceschanged`, senão a lista vem vazia.

**Estas normas são aplicadas como regras permanentes da integração voz-HOD em toda configuração nova que utilizar esta skill.**

**Limite de navegador:** o STT (`SpeechRecognition`) é do Chromium e depende do serviço de fala do Google; Brave/Firefox costumam bloquear ou não implementar. O TTS (`speechSynthesis`) é local e funciona em qualquer um. Se o 🎙 não abrir, diagnosticar com `!!(window.SpeechRecognition||window.webkitSpeechRecognition)` e mandar o usuário para Chrome/Safari — não é bug do HOD.

### User preferences (always-on)
- Respond in Brazilian Portuguese (`pt-BR`)
- `--vault` arg or `HOD_VAULT` env var mandatory on server start
- Hermes API key lives in `hod-extension/.hod-config.json` as `hermes.key` (copied from `~/.hermes/.env`'s `API_SERVER_KEY`)
- No `npm install` — HOD is zero-dependencies
- Loopback-only by default: `127.0.0.1:8420`; do not expose to public networks without auth

### LaunchAgent (macOS autostart)
Write `~/Library/LaunchAgents/local.hod.server.plist` pointing at the **absolute node path** (`shutil.which('node')` — often under `~/.hermes/tools/...`, not `/usr/local/bin`), `ProgramArguments` = node + `<repo>/hod-extension/server.mjs` + `--vault <vault>` + `--config <repo>/hod-extension/.hod-config.json`, `WorkingDirectory` = `hod-extension`, `RunAtLoad`+`KeepAlive` true, logs to `/tmp/hod-server.{out,err}.log`. Validate with `plutil -lint`, load with `launchctl load -w`, then verify `launchctl list | grep local.hod` shows exit code 0 and `lsof -nP -iTCP:8420` shows the launchd PID (PPID 1).

### Pitfalls (rule + why mechanism)
- **Looking for `server.mjs` at the repo root**: it is in `hod-extension/`; `node` fails with `MODULE_NOT_FOUND: /Users/.../Central_HOD/server.mjs`.
- **Guessing the vault path**: read `obsidian.json`; the registered vault may differ from any folder you invent. A wrong path silently indexes 0 notes.
- **`POST /api/records` without `id`**: returns `400 {"error":"Registro sem id."}`. Always mint a stable `id` client-side (e.g. `task_seed001`) before creating.
- **Calling `/api/hermes/run` expecting the README's `{action, input, context}` contract**: the v4.0 server forwards `body.messages` to `/v1/chat/completions`, so that README payload fails with `Missing or invalid 'messages' field`. Use `/api/hermes/chat` with a real `messages` array instead — that is what `js/api.js` calls.
- **Skipping `POST /api/reindex` after direct vault edits**: index desynchronizes, frontend shows stale data.
- **Changing `id` during `POST /api/records` update**: creates duplicate instead of in-place update.
- **LaunchAgent bouncing with exit code 1 / `EADDRINUSE`**: a manually started `node server.mjs` still holds 8420 and launchd's copy dies. Kill the orphan (`pkill -f "hod-extension/server.mjs"`, verify `lsof -nP -iTCP:8420`) *before* `launchctl load`, then let launchd own the port.
- **Answering user questions about candidaturas/tarefas/guidelines without first `GET /api/state`**: state may have changed between interactions.

## references/ Support Files

- `references/installation-recipe.md` — fresh install recipe, Node.js version troubleshooting, vault permission fixes
- `references/api-endpoint-quickref.md` — condensed table of frequently-used HOD API endpoints with body schemas
- `references/obsidian-vault-structure.md` — frontmatter schemas for `application`, `task`, `guideline`, `routine` with valid enum values
- `references/troubleshooting-smoke.md` — 54-assertion smoke test entry points: `GET /api/health`, `GET /api/hermes/models`, `POST /api/hermes/chat` with a real `messages` array

## Quick Copy-Paste Commands

```bash
# 1. Clone + enter the app dir
git clone https://github.com/Melquisedeque3/Central_HOD.git
cd Central_HOD/hod-extension

# 2. Discover the REAL registered vault (macOS)
python3 -c "import json,os;d=json.load(open(os.path.expanduser('~/Library/Application Support/obsidian/obsidian.json')));print(*[v['path'] for v in d['vaults'].values()],sep='\n')"

# 3. Create config (secret comes from ~/.hermes/.env, never echoed)
python3 -c "import json,pathlib,os;k=[l.split('=',1)[1].strip() for l in open(os.path.expanduser('~/.hermes/.env')) if l.startswith('API_SERVER_KEY=')][0];pathlib.Path('.hod-config.json').write_text(json.dumps({'obsidian':{'enabled':False,'url':'http://127.0.0.1:27123','key':'','folder':''},'hermes':{'enabled':True,'url':'http://127.0.0.1:8642','key':k,'model':'hermes-agent','dashboard':'http://127.0.0.1:9119'},'ui':{'theme':'dark'}},indent=2))"

# 4. Start server
node server.mjs --vault "/Users/<user>/Documents/HOD" --config "$PWD/.hod-config.json"

# 5. Health + bridge
curl -s http://127.0.0.1:8420/api/health | python3 -m json.tool
curl -s http://127.0.0.1:8420/api/hermes/models

# 6. Real agent round-trip (the ACTUAL v4 contract)
curl -s -X POST http://127.0.0.1:8420/api/hermes/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Diga em uma frase: conexão HOD-Hermes ativa?"}],"stream":false}'
```

*This skill is curator-managed and persists across sessions. Always-on rules live in SKILL.md; topical depth lives in `references/`. To update a rule, edit the SKILL.md directly — do not append 'UPDATE: actually...' underneath it.*
