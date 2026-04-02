# 🟣 Bankr Buddy

**Retro pixel desktop companion for OpenClaw + Claude Code + Bankr.**  
Made by **TachikomaRed x smolemaru**.

A pixel-art CRT TV that lives on your desktop and reacts to your AI agent sessions
in real time — thinking, working, juggling subagents, celebrating completions,
monitoring your Bankr gateway, and sleeping when you're away.

---

## States

| What's happening | Buddy | Animation |
|---|---|---|
| Prompt submitted | 💭 thinking | pulse + thought bubble |
| Tool running | ⚡ working | shake |
| Many tool calls | 🔨 building | fast shake |
| 1 subagent | 🟣 juggling | spin + token orbit |
| 2+ subagents | 🎵 conducting | wave + token orbit |
| Task done | ★ happy | bounce + stars |
| Error | ✗ error | wobble + X eyes |
| Notification | ! notification | jump |
| Compacting | sweeping | slide |
| Worktree | carrying | waddle |
| 60s idle | 😴 sleeping | sway + ZZZ |
| Gateway healthy | happy (brief) | |
| Gateway down | error | |
| Credits low | notification | |
| Double-click | poke reaction | |
| Click ×4 | flail | |

---

## Install

### 1. Clone and start Buddy

```bash
git clone https://github.com/tachikomared/bankr-buddy ~/bankr-buddy
cd ~/bankr-buddy
npm install
npm start
```

Buddy appears on your desktop — drag it anywhere.  
Drag to the right screen edge → mini mode (peek from edge).

### 2. Wire OpenClaw (plugin install — plug-n-play)

```bash
openclaw plugins install ~/bankr-buddy
openclaw gateway restart
openclaw hooks enable bankr-buddy-notifier
openclaw gateway restart
```

Done. Start or reset a session — Buddy reacts automatically.

### 3. Wire Claude Code

```bash
node ~/bankr-buddy/hooks/claude-code-install.js
```

Writes hooks into `~/.claude/settings.json`. Open a new Claude Code session.

### 4. Optional: Bankr gateway monitor

```bash
export BANKR_API_KEY=bk_YOUR_KEY   # optional — health check works without it
node ~/bankr-buddy/hooks/bankr-monitor.js &
```

Polls `llm.bankr.bot/health` every 30s. Power LED turns red if gateway goes down.

---

## How it works

```
OpenClaw session events
  → hooks/buddy-notifier/index.js  (OpenClaw HookHandler — in-process)
  → HTTP POST http://127.0.0.1:23444/state

Claude Code hook events (stdin JSON)
  → hooks/claude-code-hook.js
  → HTTP POST http://127.0.0.1:23444/state

Bankr gateway health (optional)
  → hooks/bankr-monitor.js  (polls every 30s)
  → HTTP POST http://127.0.0.1:23444/state

src/main.js  (state machine + priority resolver + HTTP server)
  → IPC → src/index.html  (Electron renderer: pixel TV, animations)
```

State priority:  
`error > notification > juggling > conducting > building > working > thinking > happy > idle > sleeping`

---

## Manual testing

```bash
# Health check
curl http://127.0.0.1:23444/health

# Trigger a state
curl -X POST http://127.0.0.1:23444/state \
  -H "Content-Type: application/json" \
  -d '{"state":"happy","session_id":"test"}'

# Cycle all states
for s in idle thinking working building happy error sleeping juggling conducting notification sweeping carrying; do
  curl -s -X POST http://127.0.0.1:23444/state \
    -H "Content-Type: application/json" \
    -d "{\"state\":\"$s\",\"session_id\":\"demo\"}" > /dev/null
  echo "→ $s"; sleep 2
done
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Buddy doesn't appear | `npm start` in the bankr-buddy directory |
| Port conflict | `export BUDDY_PORT=23445` then restart Buddy + re-run installs |
| OpenClaw not reacting | `openclaw hooks list` — check `bankr-buddy-notifier` enabled |
| Claude Code not reacting | `cat ~/.claude/settings.json \| grep claude-code-hook` |
| Multiple windows | Single-instance lock enforced — quit the extra one from tray |

---

## Customization

| What | Where |
|---|---|
| Port | `BUDDY_PORT` env var |
| Pet size | `W`/`H` in `src/main.js` `createWindow()` |
| Sleep timeout | `IDLE_SLEEP_MS` in `src/main.js` |
| Colors | `#7B5BF5` purple, `#CC4B26` orange in `src/index.html` |
| Poll interval | `POLL_MS` in `hooks/bankr-monitor.js` |

---

## Project structure

```
bankr-buddy/
├── src/
│   ├── main.js              Electron main — HTTP server, state machine, tray
│   ├── preload.js           IPC bridge (contextBridge)
│   └── index.html           Renderer — pixel TV, all animations, eye tracking
├── hooks/
│   ├── buddy-notifier/
│   │   ├── index.js         OpenClaw HookHandler (in-process plugin entry)
│   │   └── HOOK.md          OpenClaw hook metadata + discovery
│   ├── claude-code-hook.js  Claude Code hook script (reads stdin JSON)
│   ├── claude-code-install.js  Writes hooks into ~/.claude/settings.json
│   └── bankr-monitor.js     Optional: polls llm.bankr.bot/health every 30s
├── skills/
│   └── bankr-buddy/
│       └── SKILL.md         OpenClaw skill — agent can install/run Buddy itself
├── openclaw.plugin.json     OpenClaw native plugin manifest
├── package.json
└── README.md
```

---

MIT License — Made by **TachikomaRed x smolemaru**  
Bankr: https://bankr.bot · Docs: https://docs.bankr.bot/llm-gateway/overview
