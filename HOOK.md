---
name: bankr-buddy
description: "Syncs OpenClaw agent state to the Bankr Buddy desktop companion in real-time"
homepage: https://github.com/tachikomared/bankr-buddy
metadata: { "openclaw": { "emoji": "🟣", "events": ["command:new", "command:reset", "command:stop", "agent:bootstrap", "gateway:startup", "message:received", "message:sent", "session:compact:before", "session:compact:after"], "requires": { "bins": ["node"] } } }
---

# Bankr Buddy Companion

A cross-environment companion for OpenClaw and Claude Code users.

## Features
- **Real-time Agent Status**: Eye/Mouth tracking based on agent activity.
- **Interactive**: Poke/Double-click to wake or juggle states.
- **Non-intrusive**: Transparent Electron window that stays on top.

## Setup
### OpenClaw
1. Ensure the hook files are in `~/tachi/.openclaw/hooks/bankr-buddy/`.
2. Add to `~/tachi/.openclaw/openclaw.json` in `hooks.internal.load.extraDirs`:
   ```json
   "load": {
     "extraDirs": ["/home/tachiboss/tachi/.openclaw/hooks"]
   }
   ```
3. Enable in `hooks.internal.entries`.

### Claude Code
1. Ensure the Buddy Electron app is running (port 23444).
2. Claude Code pushes status updates via HTTP to `localhost:23444`.

## Troubleshooting
- **Buddy not showing?** Check Electron dev tools (Ctrl+Shift+I).
- **No status updates?** Verify gateway event subscription in `handler.js`.
