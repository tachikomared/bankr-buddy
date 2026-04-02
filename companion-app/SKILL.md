---
name: bankr-buddy
description: >
  Install, start, and manage Bankr Buddy — the retro pixel desktop companion
  that reacts to OpenClaw and Claude Code sessions in real-time. Made by
  TachikomaRed x smolemaru. Use this skill whenever the user mentions
  "bankr buddy", "desktop pet", "desktop companion", "pixel TV", "retro companion",
  wants their agent to have a visual companion, asks how to install or start
  bankr-buddy, or wants to wire OpenClaw hooks to the Buddy app.
  Also triggers when the user asks to test states, check if Buddy is running,
  restart the monitor, or update hooks after moving the repo.
---

# Bankr Buddy — OpenClaw Skill

Retro pixel desktop companion for OpenClaw + Claude Code + Bankr.  
Made by **TachikomaRed x smolemaru**.

The pet lives on your desktop as a pixel-art CRT TV with a smiley face.
It reacts to everything your agent does — thinking, working, juggling subagents,
celebrating task completions, and sleeping when you're away.

---

## Prerequisites

- Node.js 20+ in PATH (`node --version`)
- Bankr Buddy repo cloned locally
- Optional: Bankr API key (`bk_...`) for gateway health monitoring

---

## Part 1 — First-time install

```bash
# Clone the repo (adjust URL to wherever TachikomaRed publishes it)
git clone https://github.com/tachikomared/bankr-buddy ~/bankr-buddy
cd ~/bankr-buddy

# Install Electron and dependencies
npm install

# Start Buddy (keep this running in background or as a separate terminal)
npm start
```

Buddy will appear on your desktop — bottom-right corner by default.
Drag it anywhere. Drag to the right screen edge to enter mini mode.

---

## Part 2 — Wire OpenClaw hooks (plug-n-play)

Bankr Buddy ships as a proper OpenClaw plugin. Install it directly:

```bash
# Install from local path
openclaw plugins install ~/bankr-buddy

# Restart the gateway to load it
openclaw gateway restart

# Verify the hook is discovered and enable it
openclaw hooks list | grep bankr-buddy
openclaw hooks enable bankr-buddy-notifier
openclaw gateway restart
```

That's it. Start or reset a session and Buddy reacts automatically.

### Manual hook check

```bash
openclaw hooks info bankr-buddy-notifier
```

Should show: events `command:new, command:reset, command:stop, agent:bootstrap, gateway:startup, gateway:shutdown, tool_result_persist`

---

## Part 3 — Wire Claude Code hooks

```bash
cd ~/bankr-buddy
node hooks/claude-code-install.js
```

This writes Buddy's hook command into `~/.claude/settings.json` for all
Claude Code hook events. Open a new Claude Code session — Buddy reacts automatically.

Verify:
```bash
cat ~/.claude/settings.json | grep claude-code-hook
```

---

## Part 4 — Optional: Bankr gateway health monitor

Watches `llm.bankr.bot/health` every 30s and reflects status on Buddy's power LED.

```bash
# Set your key first (optional — health check works without it)
export BANKR_API_KEY=bk_YOUR_KEY

# Run monitor in background
node ~/bankr-buddy/hooks/bankr-monitor.js &
```

LED colours:
- 🟣 Purple = healthy / idle
- 🟡 Yellow = thinking / compacting
- 🟢 Green = task complete
- 🔴 Red = error / gateway down
- 🟠 Orange = notification / credits low

---

## Testing states manually

```bash
# Check Buddy is running
curl -s http://127.0.0.1:23444/health | python3 -m json.tool

# Trigger a specific state
curl -s -X POST http://127.0.0.1:23444/state \
  -H "Content-Type: application/json" \
  -d '{"state":"juggling","session_id":"test"}'

# Cycle through all states (run this in bash)
for s in idle thinking working building happy error sleeping juggling conducting notification sweeping carrying; do
  curl -s -X POST http://127.0.0.1:23444/state \
    -H "Content-Type: application/json" \
    -d "{\"state\":\"$s\",\"session_id\":\"demo\"}" > /dev/null
  echo "→ $s"
  sleep 2
done
```

---

## State reference

| Agent event | Buddy state | Animation |
|---|---|---|
| Prompt submitted / session start | thinking | pulse + thought bubble |
| Tool running | working | shake + ⚡ |
| 3+ tool sessions | building | fast shake + 🔨 |
| Subagent started (1) | juggling | spin + token orbit |
| Subagents (2+) | conducting | wave + token orbit |
| Task complete / Stop | happy | bounce + stars + ★ |
| Tool error | error | wobble + ✗ over eyes |
| Notification | notification | jump + ! |
| Pre-compact | sweeping | slide |
| Worktree create | carrying | waddle |
| 60s idle | sleeping | sway + ZZZ |
| Gateway healthy | happy (brief) | |
| Gateway down | error | |
| Credits low | notification | |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Buddy doesn't appear | `npm start` in `~/bankr-buddy` |
| Port 23444 in use | `export BUDDY_PORT=23445` then restart Buddy and re-run install |
| OpenClaw hook not firing | `openclaw hooks list` — check `bankr-buddy-notifier` is listed and enabled |
| Claude Code not reacting | `cat ~/.claude/settings.json \| grep claude-code-hook` — reinstall if missing |
| Multiple Buddy windows | Buddy enforces single-instance lock — quit the extra one |
| Buddy freezes on mini mode | Right-click tray → Exit Mini Mode |

---

## Customization

- **Port**: set `BUDDY_PORT` env var before `npm start`
- **Pet size**: edit `W`/`H` constants in `src/main.js` `createWindow()`
- **Colors**: `#7B5BF5` = Bankr purple, `#CC4B26` = screen orange (in `src/index.html`)
- **Sleep timeout**: `IDLE_SLEEP_MS` in `src/main.js` (default 60 000 ms)
- **Poll interval**: `POLL_MS` in `hooks/bankr-monitor.js` (default 30 000 ms)

---

Made by **TachikomaRed x smolemaru**  
Bankr LLM Gateway: https://docs.bankr.bot/llm-gateway/overview
