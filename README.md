# Bankr Buddy Companion

<p align="center">
  <img src="assets/bankr-buddy-main.png" alt="Bankr Buddy" width="200" />
</p>

<p align="center">
  <a href="https://github.com/tachikomared/bankr-buddy/actions"><img src="https://img.shields.io/github/actions/workflow/status/tachikomared/bankr-buddy/ci.yml?style=flat-square" alt="Build Status"></a>
  <a href="https://github.com/tachikomared/bankr-buddy/blob/master/LICENSE"><img src="https://img.shields.io/github/license/tachikomared/bankr-buddy?style=flat-square" alt="License"></a>
</p>

**Bankr Buddy** is a retro pixel desktop companion that lives on your screen. It mirrors your **OpenClaw** and **Claude Code** agent states in real time — thinking, building, juggling subagents, celebrating, and sleeping when idle.

---

## 🎨 Buddy States

| What's happening | Buddy State |
|---|---|
| Prompt submitted | 💭 thinking |
| Tool running | ⚡ working |
| Many subagents | 🟣 juggling |
| Task done | ★ happy |
| Error | ✗ error |
| 60s idle | 😴 sleeping |

---

## 🚀 Quick Setup

### 1. Install & Run Companion
```bash
git clone https://github.com/tachikomared/bankr-buddy
cd bankr-buddy
npm install
npm start
```
Buddy appears as a pixel-art CRT TV. Drag it anywhere; move to the screen edge for "peek" mode.

### 2. Connect OpenClaw
```bash
openclaw plugins install ~/bankr-buddy
openclaw gateway restart
openclaw hooks enable bankr-buddy-notifier
openclaw gateway restart
```

### 3. Connect Claude Code
```bash
node hooks/claude-code-install.js
```

---

## ⚙️ How it works
Buddy runs a local HTTP server (`127.0.0.1:23444`) that accepts state updates from:
- **OpenClaw** (via internal hooks)
- **Claude Code** (via stdin hook)
- **Bankr Gateway** (via optional health monitor)

The Electron renderer resolves state priority (e.g., `error` > `working` > `happy`) and triggers pixel animations.

## 🛠 Manual Testing
Trigger a state change manually to verify your connection:
```bash
curl -X POST http://127.0.0.1:23444/state \
  -H "Content-Type: application/json" \
  -d '{"state":"happy","session_id":"test"}'
```

---

## 📂 Project Structure
- `/src`: Electron main, state machine, and pixel-art renderer.
- `/hooks`: Plugin logic for OpenClaw, Claude Code, and Bankr gateway polling.
- `/skills`: Agent skill definitions for autonomous management.

---

MIT License — Built by **TachikomaRed x smolemaru**
