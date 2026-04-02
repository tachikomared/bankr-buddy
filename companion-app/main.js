'use strict';
// src/main.js — Bankr Buddy Electron main process
// Made by TachikomaRed x smolemaru

const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, screen, shell } = require('electron');
const http = require('http');
const path = require('path');
const fs   = require('fs');

// ── Config ────────────────────────────────────────────────────────────────────
const PORT          = parseInt(process.env.BUDDY_PORT || '', 10) || 23444;
const IDLE_SLEEP_MS = 60_000;
const MIN_STATE_MS  = 1_200;
const POSITION_FILE = path.join(app.getPath('userData'), 'buddy-position.json');

// ── State priorities ──────────────────────────────────────────────────────────
const PRIORITY = {
  error:        10,
  notification: 9,
  juggling:     8,
  conducting:   7,
  building:     6,
  working:      5,
  thinking:     4,
  happy:        3,
  sweeping:     2,
  carrying:     2,
  idle:         1,
  sleeping:     0,
};

// ── Event → state map (Claude Code + OpenClaw compatible) ─────────────────────
const EVENT_TO_STATE = {
  // Claude Code events (hook_event_name field)
  SessionStart:         'thinking',
  UserPromptSubmit:     'thinking',
  PreToolUse:           'working',
  PostToolUse:          'working',
  PostToolUseFailure:   'error',
  SubagentStart:        'juggling',
  SubagentStop:         'idle',
  Stop:                 'happy',
  PostCompact:          'happy',
  Notification:         'notification',
  PreCompact:           'sweeping',
  WorktreeCreate:       'carrying',
  SessionEnd:           'idle',
  // Bankr-specific
  GatewayHealthy:       'happy',
  GatewayDown:          'error',
  GatewayUnreachable:   'notification',
  BankrCreditsLow:      'notification',
};

// ── Runtime state ─────────────────────────────────────────────────────────────
let mainWindow    = null;
let tray          = null;
let sessions      = {};        // { [sessionId]: { state, ts } }
let currentState  = 'idle';
let lockUntil     = 0;
let sleepTimer    = null;
let isMiniMode    = false;
let isDND         = false;

// ── Single-instance guard ─────────────────────────────────────────────────────
if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }
app.on('second-instance', () => { if (mainWindow) mainWindow.show(); });

// ── State helpers ─────────────────────────────────────────────────────────────
function resolveState() {
  if (isDND) return 'sleeping';
  let best = 'idle', bestP = -1;
  for (const s of Object.values(sessions)) {
    const p = PRIORITY[s.state] ?? 0;
    if (p > bestP) { best = s.state; bestP = p; }
  }
  return best;
}

function pushState(state, sessionId = 'default') {
  sessions[sessionId] = { state, ts: Date.now() };
  resetSleepTimer();

  const now      = Date.now();
  const resolved = resolveState();
  const newP     = PRIORITY[resolved] ?? 0;
  const curP     = PRIORITY[currentState] ?? 0;

  if (now >= lockUntil || newP >= curP) {
    currentState = resolved;
    lockUntil    = now + MIN_STATE_MS;
    if (mainWindow) {
      mainWindow.webContents.send('state-change', { state: currentState, isMini: isMiniMode });
    }
  }
}

function resetSleepTimer() {
  clearTimeout(sleepTimer);
  if (currentState === 'sleeping') {
    currentState = 'idle';
    if (mainWindow) mainWindow.webContents.send('state-change', { state: 'idle', isMini: isMiniMode });
  }
  sleepTimer = setTimeout(() => {
    sessions     = {};
    currentState = 'sleeping';
    if (mainWindow) mainWindow.webContents.send('state-change', { state: 'sleeping', isMini: isMiniMode });
  }, IDLE_SLEEP_MS);
}

// ── HTTP server ───────────────────────────────────────────────────────────────
function startServer() {
  const server = http.createServer((req, res) => {

    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status:   'ok',
        version:  '1.0.0',
        author:   'TachikomaRed x smolemaru',
        state:    currentState,
        sessions: Object.keys(sessions).length,
        port:     PORT,
      }));
      return;
    }

    if (req.method === 'POST' && req.url === '/state') {
      let body = '';
      req.on('data', (d) => { body += d; });
      req.on('end',  () => {
        try {
          const { state, session_id, event } = JSON.parse(body || '{}');
          const sid = session_id || 'default';

          // Resolve state: explicit state > event name lookup
          let resolved = state;
          if (!resolved && event) resolved = EVENT_TO_STATE[event];

          // SubagentStart: escalate to conducting if ≥2 juggling sessions
          if (event === 'SubagentStart') {
            const juggling = Object.values(sessions).filter(s => s.state === 'juggling').length;
            resolved = juggling >= 1 ? 'conducting' : 'juggling';
          }

          if (resolved) pushState(resolved, sid);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, state: resolved || null }));
        } catch {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'invalid json' }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(PORT, '127.0.0.1', () => {
    console.log(`🟣 Bankr Buddy listening on http://127.0.0.1:${PORT}`);
    console.log('   Made by TachikomaRed x smolemaru');
  });

  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.warn(`[Bankr Buddy] Port ${PORT} already in use — set BUDDY_PORT to override`);
    }
  });
}

// ── Position helpers ──────────────────────────────────────────────────────────
function loadPosition() {
  try { return JSON.parse(fs.readFileSync(POSITION_FILE, 'utf8')); } catch { return null; }
}
function savePosition(x, y) {
  try { fs.writeFileSync(POSITION_FILE, JSON.stringify({ x, y }), 'utf8'); } catch {}
}

// ── Window ────────────────────────────────────────────────────────────────────
function createWindow() {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  const W = 160, H = 160;
  const saved = loadPosition();

  mainWindow = new BrowserWindow({
    width:      W,
    height:     H,
    x:          saved ? saved.x : sw - W - 40,
    y:          saved ? saved.y : sh - H - 80,
    transparent: true,
    frame:       false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable:   false,
    focusable:   false,
    hasShadow:   false,
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
  });

  mainWindow.setIgnoreMouseEvents(true, { forward: true });
  mainWindow.loadFile(path.join(__dirname, 'src/index.html'));

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('moved', () => {
    const [x, y] = mainWindow.getPosition();
    savePosition(x, y);
    if (x + W >= sw - 10) {
      isMiniMode = true;
      mainWindow.webContents.send('state-change', { state: currentState, isMini: true });
    } else if (isMiniMode) {
      isMiniMode = false;
      mainWindow.webContents.send('state-change', { state: currentState, isMini: false });
    }
  });
}

// ── Tray ──────────────────────────────────────────────────────────────────────
function createTray() {
  // Minimal 16x16 purple icon (inline, no external asset needed)
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAASElEQVQ4jWNgG' +
    'AUkAkYGBob/VMb/GRgY/lMZ/2dgYPhPZfyfgYHhP5XxfwYGhv9Uxv8ZGBj+' +
    'Uxn/Z2Bg+E9l/J+BgeE/AOaWCdJnxHf6AAAAAElFTkSuQmCC', 'base64');
  const img = nativeImage.createFromBuffer(png);
  tray = new Tray(img);
  tray.setToolTip('Bankr Buddy — TachikomaRed x smolemaru');

  const buildMenu = () => Menu.buildFromTemplate([
    { label: `🟣 Bankr Buddy`,       enabled: false },
    { label: `State: ${currentState}`, enabled: false },
    { type: 'separator' },
    {
      label: isDND ? '🔔 Exit Do Not Disturb' : '🔕 Do Not Disturb',
      click: () => {
        isDND = !isDND;
        pushState(isDND ? 'sleeping' : 'idle');
        tray.setContextMenu(buildMenu());
      },
    },
    {
      label: isMiniMode ? '🐾 Exit Mini Mode' : '🐾 Mini Mode',
      click: () => {
        isMiniMode = !isMiniMode;
        mainWindow.webContents.send('state-change', { state: currentState, isMini: isMiniMode });
        tray.setContextMenu(buildMenu());
      },
    },
    { type: 'separator' },
    { label: '🔌 Buddy Health',  click: () => shell.openExternal(`http://127.0.0.1:${PORT}/health`) },
    { label: '💰 Bankr Credits', click: () => shell.openExternal('https://bankr.bot/llm?tab=credits') },
    { label: '📖 Bankr Docs',    click: () => shell.openExternal('https://docs.bankr.bot/llm-gateway/overview') },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);

  tray.setContextMenu(buildMenu());
  setInterval(() => tray.setContextMenu(buildMenu()), 5000);
}

// ── IPC ───────────────────────────────────────────────────────────────────────
ipcMain.on('enable-mouse',  () => mainWindow?.setIgnoreMouseEvents(false));
ipcMain.on('disable-mouse', () => mainWindow?.setIgnoreMouseEvents(true, { forward: true }));
ipcMain.on('drag-end',      (_, pos) => { savePosition(pos.x, pos.y); });
ipcMain.on('mini-exit',     () => { isMiniMode = false; mainWindow?.webContents.send('state-change', { state: currentState, isMini: false }); });
ipcMain.on('force-state',   (_, s) => pushState(s, 'manual'));

// ── Boot ──────────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  startServer();
  createWindow();
  createTray();
  resetSleepTimer();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
