// hooks/buddy-notifier/index.js
// Bankr Buddy — OpenClaw plugin hook handler
// Fires on OpenClaw agent lifecycle events and notifies the local Buddy HTTP server.
// Made by TachikomaRed x smolemaru
// Zero external dependencies.

'use strict';

const http = require('http');

// Default port — overridden by openclaw.plugin.json configSchema.buddyPort if set
const DEFAULT_PORT = 23444;
const TIMEOUT_MS   = 800;

// OpenClaw internal event type → Buddy state
// Events: command:new, command:reset, command:stop, agent:bootstrap,
//         gateway:startup, gateway:shutdown, tool_result_persist
const EVENT_MAP = {
  'command:new':       { state: 'thinking',     event: 'SessionStart' },
  'command:reset':     { state: 'thinking',     event: 'SessionStart' },
  'command:stop':      { state: 'happy',         event: 'Stop' },
  'agent:bootstrap':   { state: 'thinking',     event: 'SessionStart' },
  'gateway:startup':   { state: 'happy',         event: 'GatewayHealthy' },
  'gateway:shutdown':  { state: 'sleeping',     event: 'SessionEnd' },
  // tool_result_persist fires after every tool result — maps to working
  'tool_result_persist': { state: 'working',   event: 'PostToolUse' },
};

// Also watch for action strings within events
const ACTION_MAP = {
  'submit': 'thinking',   // prompt:submit
  'pre-use': 'working',   // tool:pre-use
  'error': 'error',       // tool:error
  'stop': 'happy',        // command:stop
  'new': 'thinking',
  'reset': 'thinking',
};

function notifyBuddy(state, sessionKey, event, port = DEFAULT_PORT) {
  const body = JSON.stringify({
    state,
    session_id: sessionKey || 'openclaw',
    event,
  });

  const req = http.request({
    hostname: '127.0.0.1',
    port,
    path: '/state',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  }, () => {});

  req.on('error', () => {
    // Buddy may not be running — silent fail is correct behaviour
  });
  req.setTimeout(TIMEOUT_MS, () => req.destroy());
  req.write(body);
  req.end();
}

/**
 * OpenClaw HookHandler export.
 * Called by OpenClaw gateway for every subscribed event.
 * event shape: { type, action, sessionKey, context, timestamp, messages }
 */
const handler = async (event) => {
  const port = parseInt(process.env.BUDDY_PORT || '', 10) || DEFAULT_PORT;

  // Resolve the event key (type:action)
  const eventKey  = event.type && event.action ? `${event.type}:${event.action}` : '';
  const sessionKey = event.sessionKey || 'openclaw';

  // Check full event key first
  const mapped = EVENT_MAP[eventKey];
  if (mapped) {
    notifyBuddy(mapped.state, sessionKey, mapped.event, port);
    return;
  }

  // Fall back to action-only map
  const actionState = event.action ? ACTION_MAP[event.action] : null;
  if (actionState) {
    notifyBuddy(actionState, sessionKey, event.action, port);
  }
};

module.exports = handler;
module.exports.default = handler;
