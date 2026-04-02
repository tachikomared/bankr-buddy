---
name: bankr-buddy
description: "Syncs OpenClaw agent state to the Bankr Buddy desktop companion in real-time"
homepage: https://github.com/tachikomared/bankr-buddy
metadata: { "openclaw": { "emoji": "🟣", "events": ["command:new", "command:reset", "command:stop", "agent:bootstrap", "gateway:startup", "message:received", "message:sent", "session:compact:before", "session:compact:after"], "requires": { "bins": ["node"] } } }
---

# Bankr Buddy Companion

A cross-environment companion for OpenClaw and Claude Code users.

## Setup Instructions

### Windows (Companion App)
1. Navigate to the `companion-app` folder.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the companion:
   ```bash
   npm start
   ```

### OpenClaw (WSL2 Gateway)
1. Ensure the `handler.js` and `HOOK.md` are in `~/.openclaw/hooks/bankr-buddy/`.
2. Update your `openclaw.json`:
   ```json
   {
     "hooks": {
       "internal": {
         "load": { "extraDirs": ["/home/tachiboss/tachi/.openclaw/hooks"] },
         "entries": { "bankr-buddy": { "enabled": true } }
       }
     }
   }
   ```
3. Restart the gateway: `systemctl --user restart openclaw-gateway`.

### Claude Code
1. Start the companion app on Windows (port 23444).
2. Claude Code will automatically attempt to push status updates if a `BANKR_API_KEY` is present in your environment (see `companion-app/README.md`).

## Troubleshooting
- **Buddy not showing?** Check Electron dev tools (Ctrl+Shift+I).
- **No status updates?** Verify gateway event subscription in `handler.js`.
- **Sensitive Config:** Never commit actual API keys to the repo. Use `.env` files locally.
