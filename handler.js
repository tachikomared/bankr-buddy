'use strict';
// handler.js — Bankr Buddy notifier hook for OpenClaw
// Sends state events to the Bankr Buddy Electron app on the Windows host.
// Made by TachikomaRed x smolemaru
//
// WSL2 → Windows host is always 172.22.208.1 (or read from env BUDDY_HOST).
// Buddy app must be running: npm start in D:\bankrbuddy

const http = require('http');

const BUDDY_HOST = process.env.BUDDY_HOST || '172.22.208.1';
const BUDDY_PORT = parseInt(process.env.BUDDY_PORT || '', 10) || 23444;
const TIMEOUT_MS = 800;

// OpenClaw internal hook event → Buddy state
// Only events available to internal hooks (per docs.openclaw.ai/automation/hooks)
const EVENT_MAP = {
 // Command events
 'command:new': 'thinking',
 'command:reset': 'thinking',
 'command:stop': 'happy',

 // Agent events
 'agent:bootstrap': 'thinking',

 // Gateway events
 'gateway:startup': 'happy',

 // Message events (these DO fire on internal hooks)
 'message:received': 'thinking', // user message arrived → agent thinking
 'message:sent': 'happy', // agent sent reply → done

 // Session compaction events
 'session:compact:before': 'sweeping',
 'session:compact:after': 'happy',
};

function notifyBuddy(state, sessionKey, event) {
 const body = JSON.stringify({ state, session_id: sessionKey || 'openclaw', event });
 const req = http.request({
 hostname: BUDDY_HOST,
 port: BUDDY_PORT,
 path: '/state',
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 'Content-Length': Buffer.byteLength(body),
 },
 }, () => {});

 req.on('error', () => {}); // silent — Buddy may not be running
 req.setTimeout(TIMEOUT_MS, () => req.destroy());
 req.write(body);
 req.end();
}

// OpenClaw HookHandler — called for every subscribed event
const handler = async (event) => {
 try {
 const eventKey = (event.type && event.action) ? `${event.type}:${event.action}` : '';
 const sessionKey = event.sessionKey || 'openclaw';
 const state = EVENT_MAP[eventKey];

 if (state) {
 notifyBuddy(state, sessionKey, eventKey);
 }
 } catch {
 // never crash the gateway
 }
};

// CommonJS export (OpenClaw loader accepts both ESM default and module.exports)
module.exports = handler;
module.exports.default = handler;