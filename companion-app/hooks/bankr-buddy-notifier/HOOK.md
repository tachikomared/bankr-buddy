---
name: bankr-buddy-notifier
description: "Notifies Bankr Buddy desktop companion of OpenClaw agent events in real-time"
homepage: https://github.com/tachikomared/bankr-buddy
metadata: { "openclaw": { "emoji": "🟣", "events": ["command:new", "command:reset", "command:stop", "agent:bootstrap", "gateway:startup", "gateway:shutdown", "tool_result_persist"], "requires": { "bins": ["node"] } } }
---

# Bankr Buddy Notifier

Fires HTTP events to the local Bankr Buddy Electron app whenever your OpenClaw agent does something — thinking, working, completing tasks, erroring, sleeping.

Made by TachikomaRed x smolemaru.

## Requirements

- Bankr Buddy must be running (`npm start` in the bankr-buddy directory)
- Node.js in PATH
- Port 23444 free (or set `BUDDY_PORT` env var to override)

## No configuration needed

Works out of the box once Bankr Buddy is running. If Buddy is not running, this hook silently does nothing.
