# Bankr Buddy Companion

<p align="center">
  <img src="assets/bankr-buddy-main.png" alt="Bankr Buddy" width="200" />
</p>

<p align="center">
  <a href="https://github.com/tachikomared/bankr-buddy/actions"><img src="https://img.shields.io/github/actions/workflow/status/tachikomared/bankr-buddy/ci.yml?style=flat-square" alt="Build Status"></a>
  <a href="https://github.com/tachikomared/bankr-buddy/blob/master/LICENSE"><img src="https://img.shields.io/github/license/tachikomared/bankr-buddy?style=flat-square" alt="License"></a>
</p>

**Bankr Buddy** is a cross-environment desktop companion for [OpenClaw](https://openclaw.ai) and [Claude Code](https://claude.ai/code). It mirrors agent state, keeps your buddy animated, and keeps the vibe alive while you code.

---

## 🚀 Setup Guide

### 1. Windows (Companion App)
1. Open the `companion-app/` folder in a terminal on your Windows host.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the companion:
   ```bash
   npm start
   ```

### 2. WSL2 (OpenClaw Gateway)
1. Ensure your hook files are correctly mapped in your OpenClaw environment:
   ```text
   ~/.openclaw/hooks/bankr-buddy/
   ```
2. Update your `openclaw.json` config:
   ```json
   "hooks": {
     "internal": {
       "load": { "extraDirs": ["/home/tachiboss/tachi/.openclaw/hooks"] },
       "entries": { "bankr-buddy": { "enabled": true } }
     }
   }
   ```
3. Restart the gateway: `systemctl --user restart openclaw-gateway`.

### 3. Claude Code (Windows Workflow)
1. Run the companion app on Windows.
2. Claude Code pushes updates to the local HTTP endpoint (`localhost:23444`).
3. Keep sensitive configs in local `.env` files (never commit these).

---

## 🛠 Troubleshooting
- **Image broken?** Ensure the image file is at `assets/bankr-buddy-main.png` and properly committed.
- **Hook not loading?** Check `openclaw.json` paths and run `openclaw hooks list`.
- **Windows app not connecting?** Verify the companion port (`23444`) and WSL2-to-Windows host networking.

## 📦 Repo hygiene
- **NEVER** commit `.env` files, `node_modules`, or Electron binaries.
- Keep setup docs and runtime code separated.
