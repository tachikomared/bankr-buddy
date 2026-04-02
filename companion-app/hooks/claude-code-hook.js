#!/usr/bin/env node
// hooks/claude-code-hook.js
// Claude Code hook script — zero external dependencies
// Reads hook payload from stdin, notifies Bankr Buddy via HTTP.
// Made by TachikomaRed x smolemaru
'use strict';

const http = require('http');

const PORT       = parseInt(process.env.BUDDY_PORT || '', 10) || 23444;
const TIMEOUT_MS = 800;

// Claude Code hook_event_name → Buddy state
const EVENT_MAP = {
  SessionStart:       'thinking',
  UserPromptSubmit:   'thinking',
  PreToolUse:         'working',
  PostToolUse:        'working',
  PostToolUseFailure: 'error',
  SubagentStart:      'juggling',
  SubagentStop:       'idle',
  Stop:               'happy',
  PostCompact:        'happy',
  Notification:       'notification',
  PreCompact:         'sweeping',
  WorktreeCreate:     'carrying',
  SessionEnd:         'idle',
};

function notifyBuddy(state, session_id, event) {
  const body = JSON.stringify({ state, session_id, event });
  const req  = http.request({
    hostname: '127.0.0.1',
    port:     PORT,
    path:     '/state',
    method:   'POST',
    headers: {
      'Content-Type':   'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  }, () => {});
  req.on('error', () => {}); // silent — Buddy may not be running
  req.setTimeout(TIMEOUT_MS, () => req.destroy());
  req.write(body);
  req.end();
}

// Claude Code sends hook payload as JSON on stdin
let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  let payload = {};
  try { payload = JSON.parse(raw || '{}'); } catch {}

  // Claude Code hook payload fields
  const event      = payload.hook_event_name || '';
  const session_id = payload.session_id      || 'claude-code';

  const state = EVENT_MAP[event];
  if (state) {
    notifyBuddy(state, session_id, event);
  }

  // Always exit 0 — never block Claude Code
  process.exit(0);
});

// Safety: if stdin never closes (shouldn't happen), exit after 1.5s
setTimeout(() => process.exit(0), 1500);
