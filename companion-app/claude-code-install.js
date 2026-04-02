#!/usr/bin/env node
// hooks/claude-code-install.js
// Installs Bankr Buddy hooks into Claude Code (~/.claude/settings.json)
// Made by TachikomaRed x smolemaru
'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const HOOK_SCRIPT = path.resolve(__dirname, 'claude-code-hook.js');
const HOOK_CMD    = `node "${HOOK_SCRIPT}"`;

// Claude Code hook events that map to Buddy states
// Format per Claude Code docs: { type: 'command', command: '...' }
const EVENTS = [
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'SubagentStart',
  'SubagentStop',
  'Stop',
  'PostCompact',
  'PreCompact',
  'Notification',
  'WorktreeCreate',
  'SessionEnd',
];

function run() {
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  let settings = {};

  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch {
    // File may not exist yet — we'll create it
  }

  if (!settings.hooks) settings.hooks = {};

  for (const event of EVENTS) {
    if (!Array.isArray(settings.hooks[event])) {
      settings.hooks[event] = [];
    }

    // Remove any existing Bankr Buddy entry (idempotent reinstall)
    settings.hooks[event] = settings.hooks[event].filter(
      (h) => !(h && typeof h.command === 'string' && h.command.includes('claude-code-hook'))
    );

    // Append the new hook entry (Claude Code format)
    settings.hooks[event].push({ type: 'command', command: HOOK_CMD });
  }

  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');

  console.log('\n🟣 Bankr Buddy — Claude Code Hook Installer');
  console.log('   Made by TachikomaRed x smolemaru\n');
  console.log('✓ Hooks installed →', settingsPath);
  console.log('✓ Hook script   →', HOOK_SCRIPT);
  console.log('\nEvents registered:', EVENTS.join(', '));
  console.log('\n→ Start Buddy: npm start');
  console.log('→ Then open a new Claude Code session — Buddy will react automatically.\n');
}

run();
