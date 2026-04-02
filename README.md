# Bankr Buddy Companion

<p align="center">
  <img src="assets/bankr-buddy-main.png" alt="Bankr Buddy" width="420" />
</p>

**Bankr Buddy** is a tiny desktop companion for OpenClaw + Claude Code.
It mirrors agent state, animates the buddy, and keeps the vibe alive.

## What it does
- Mirrors OpenClaw events into the Windows companion UI
- Keeps eyes / mouth moving while idle or active
- Supports click-to-idle, wake, and juggle interactions
- Bridges WSL2 ↔ Windows with HTTP hooks

## Screenshots

<p align="center">
  <img src="assets/bankr-buddy-main.png" alt="Bankr Buddy main screen" width="900" />
</p>

## Quick start

### Windows companion app
1. Open `companion-app/` on Windows.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the app:
   ```bash
   npm start
   ```

### OpenClaw on WSL2
1. Keep the hook files in:
   ```text
   ~/.openclaw/hooks/bankr-buddy/
   ```
2. Make sure your OpenClaw config includes the hook directory in `hooks.internal.load.extraDirs`.
3. Do **not** edit your global OpenClaw bootstrap files during setup.

### Claude Code on Windows only
If you only want the Windows companion + Claude Code workflow:
1. Run the companion app on Windows.
2. Configure Claude Code to send updates to the local companion endpoint.
3. Keep secrets in local `.env` files only.

## Troubleshooting
- **README not showing on GitHub home page**: The repo root must contain this `README.md`.
- **GitHub sidebar description empty**: Add the repo description in GitHub settings. README text does not control it.
- **Image not showing**: Put the image at `assets/bankr-buddy-main.png` and commit it.
- **Hook not loading**: Recheck `openclaw.json` and `extraDirs`.
- **Windows app not connecting**: Confirm the companion is listening on the expected port and WSL2 can reach the Windows host.

## Repo hygiene
- Never commit `.env` files
- Never commit `node_modules`
- Never commit Electron binaries
- Keep setup docs separate from runtime hook code

## Files
- `HOOK.md` — OpenClaw hook notes
- `README.md` — GitHub landing page
- `handler.js` — OpenClaw event handler
- `companion-app/` — Windows companion app source
