
'use strict';
// src/main.js - Bankr Buddy Electron main process
// Made by TachikomaRed x smolemaru

const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, screen, shell, globalShortcut, desktopCapturer } = require('electron');
const http       = require('http');
const path       = require('path');
const fs         = require('fs');
const sound      = require('./sound');
const screenshot = require('./screenshot');
const companions = require('./companions');

// ── Config ────────────────────────────────────────────────────────────────────
const PORT          = parseInt(process.env.BUDDY_PORT || '', 10) || 23444;
const IDLE_SLEEP_MS = 60_000;
const THINKING_LOCK_MS = 3000;
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
  // New event maps
  'message:received':   'thinking',
  'agent:bootstrap':    'thinking',
  'message:sent':       'happy',
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

function pushState(state, sessionId = "default") {
  const now = Date.now();

  // If we are currently thinking and within lock time, ignore new 'idle' pushes
  if (currentState === 'thinking' && now < lockUntil && state === 'idle') {
    return;
  }

  if (state === 'thinking') {
    lockUntil = now + THINKING_LOCK_MS;
  }

  sessions[sessionId] = { state, ts: now };
  resetSleepTimer();

  const resolved = resolveState();
  currentState = resolved; // Update global state tracker

  if (mainWindow) {
    mainWindow.webContents.send("state-change", { state: resolved, isMini: isDND });

    // Keep mouse events passed through; renderer handles click capture when needed
    mainWindow.setIgnoreMouseEvents(true, { forward: true });

    sound.playState(resolved);
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
          console.log(`[HTTP] incoming POST /state: body=${body}`);
          const { state, session_id, event } = JSON.parse(body || '{}');
          const sid = session_id || 'default';

          // Resolve state: explicit state > event name lookup
          let resolved = state;
          if (!resolved && event) {
            resolved = EVENT_TO_STATE[event];
            if (!resolved) console.warn(`[HTTP] unknown event: ${event}`);
          }

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

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🟣 Bankr Buddy listening on http://0.0.0.0:${PORT}`);
    console.log('   Made by TachikomaRed x smolemaru');
  });

  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.warn(`[Bankr Buddy] Port ${PORT} already in use - set BUDDY_PORT to override`);
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
  const W = 200, H = 200;
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
  mainWindow.loadFile(companions.htmlPath);

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // Global mouse tracking loop (50ms interval)
  setInterval(() => {
    if (!mainWindow) return;
    const pos = screen.getCursorScreenPoint();
    mainWindow.webContents.send('global-mouse', pos);
  }, 50);

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
  tray.setToolTip('Bankr Buddy - TachikomaRed x smolemaru');

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
    {
      label: '🔊 Sound Pack',
      submenu: [
        { label: 'EVE (Wall-E) ✓', click: async () => { await sound.loadPack('eve-walle'); mainWindow.webContents.send('show-bubble', 'EVE online! ✓'); } },
        { label: 'Bender (Futurama)', click: async () => { await sound.loadPack('futurama_bender'); mainWindow.webContents.send('show-bubble', 'Bite my shiny metal ass!'); } },
        { label: 'Orc Peon', click: async () => { await sound.loadPack('peon'); mainWindow.webContents.send('show-bubble', 'Zug zug!'); } },
        { label: 'Human Peasant', click: async () => { await sound.loadPack('peasant'); mainWindow.webContents.send('show-bubble', 'Peasant sounds loaded!'); } },
        { type: 'separator' },
        { label: '⚙️ Settings', click: () => { if (mainWindow) mainWindow.webContents.send('show-sound-panel'); } }
      ]
    },
    { label: '▶ Test Sound', click: async () => { sound.playCategory('task.complete'); mainWindow.webContents.send('show-bubble', 'Zug zug!'); } },
    { label: '🔌 Buddy Health',  click: () => shell.openExternal(`http://0.0.0.0:${PORT}/health`) },
    { label: '📸 Screenshot to Agent  Ctrl+Shift+S', click: () => screenshot.capture() },
    { type: 'separator' },

    { label: '🎭 Companion', submenu: companions.list.map(c => ({
        label: c.label,
        type: 'radio',
        checked: companions.active.id === c.id,
        click: async () => { await companions.switchTo(c.id); tray.setContextMenu(buildMenu()); }
    })) },
    { type: 'separator' },
    { label: '💰 Bankr Credits', click: () => shell.openExternal('https://bankr.bot/llm?tab=credits') },
    { label: '📖 Bankr Docs',    click: () => shell.openExternal('https://docs.bankr.bot/llm-gateway/overview') },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);

  tray.setContextMenu(buildMenu());
  setInterval(() => tray.setContextMenu(buildMenu()), 5000);
}

// ── IPC ───────────────────────────────────────────────────────────────────────
ipcMain.on('enable-mouse',  () => { 
  console.log('enable-mouse'); 
  mainWindow?.setIgnoreMouseEvents(false); 
});
ipcMain.on('disable-mouse', () => { 
  console.log('disable-mouse'); 
  // ONLY ignore when not in happy/idle state to allow normal flow
  if (currentState !== 'happy' && currentState !== 'idle') {
      mainWindow?.setIgnoreMouseEvents(true, { forward: true });
  } else {
      mainWindow?.setIgnoreMouseEvents(false);
  }
});
ipcMain.on('drag-end',      (_, pos) => { console.log('drag-end'); savePosition(pos.x, pos.y); });
ipcMain.on('mini-exit',     () => { isMiniMode = false; mainWindow?.webContents.send('state-change', { state: currentState, isMini: false }); });
ipcMain.on('force-state',   (_, s) => pushState(s, 'manual'));
ipcMain.on('take-screenshot', () => screenshot.capture());
ipcMain.handle('screenshot:hotkey', () => HOTKEY);
ipcMain.on('show-sound-panel', () => { console.log('[IPC] show-sound-panel'); mainWindow?.webContents.send('show-sound-panel'); });
ipcMain.handle('sound:listPacks',  async ()        => sound.listPacks());
ipcMain.handle('sound:loadPack',   async (_, name) => sound.loadPack(name));
ipcMain.handle('sound:getConfig',  ()              => sound.getConfig());
ipcMain.on('sound:setVolume',  (_, v) => sound.setVolume(v));
ipcMain.on('sound:setEnabled', (_, v) => sound.setEnabled(v));
ipcMain.handle('sound:test',   async (_, cat) => sound.playCategory(cat || 'task.complete'));

// ── Boot ──────────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  startServer();
  createWindow();
  createTray();
  resetSleepTimer();

  // Sound engine - lazy init after app is ready
  sound.init();
  sound._sendToRenderer = (channel, data) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, data);
  };

  // Screenshot module
  screenshot.register((state, bubble) => {
    pushState(state, 'screenshot');
    if (bubble && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('show-bubble', bubble);
    }
  });

  // Companion switcher - reload window with new HTML when switched
  companions.onChange(async (id, htmlPath) => {
    console.log(`[companion] Switching to ${id} → ${htmlPath}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      await mainWindow.loadFile(htmlPath);
      // Re-send current state so new companion renders correctly
      mainWindow.webContents.send('state-change', { state: currentState, isMini: isMiniMode });
      
      // Ensure mouse events are set correctly for new companion
      mainWindow.setIgnoreMouseEvents(true, { forward: true });
    }
  });

  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
console.log('Main process notified to open sound panel');
