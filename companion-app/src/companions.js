'use strict';
// src/companions.js — Companion skin switcher for Bankr Buddy
// Managed via tray menu (same UX as sound pack switching).
// Made by TachikomaRed x smolemaru

const fs   = require('fs');
const path = require('path');
const { app } = require('electron');

// ── Registered companions ─────────────────────────────────────
const COMPANIONS = [
  {
    id:          'tv',
    label:       '📺 Retro TV (original)',
    file:        'index-tv.html',
    description: 'The classic Bankr Buddy retro CRT TV',
  },
  {
    id:          'okcomputer',
    label:       '🤖 OKcomputer Robot',
    file:        'index-okcomputer.html',
    description: 'Pixel robot — boxing fists, antenna, full body',
  },
  {
    id:          'ham',
    label:       '🧢 HAM Buddy',
    file:        'index-ham.html',
    description: 'The frog in a unicorn floatie with a HAM cap',
  },
  {
    id:          'deployer',
    label:       '🏗️ Deployer',
    file:        'index-deployer.html',
    description: 'Onchain deployer assistant',
  },
  {
    id:          'pretext',
    label:       '◎ Pretext Matrix',
    file:        'index-pretext.html',
    description: 'Matrix-morphing text companion — glyphs ARE the body, pretext speech',
  },
  {
    id:          'tachi',
    label:       '🦀 $TACHI Crab Agent',
    file:        'index-tachi.html',
    description: 'Mech crab AI agent — Base chain, cigarette, matrix streams',
  },
];

// ── Persistence ───────────────────────────────────────────────
const CONFIG_FILE = path.join(app.getPath('userData'), 'companion-config.json');

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return { active: 'okcomputer' };
  }
}

function saveConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
  } catch {}
}

// ── CompanionManager ──────────────────────────────────────────
class CompanionManager {
  constructor() {
    this._cfg      = loadConfig();
    this._onChange  = null;
  }

  get active() {
    return COMPANIONS.find(c => c.id === this._cfg.active) || COMPANIONS[1];
  }

  get list() {
    return COMPANIONS;
  }

  get htmlPath() {
    const srcDir = path.join(__dirname);
    return path.join(srcDir, this.active.file);
  }

  async switchTo(id) {
    const found = COMPANIONS.find(c => c.id === id);
    if (!found) throw new Error(`Unknown companion: ${id}`);
    this._cfg.active = id;
    saveConfig(this._cfg);
    if (this._onChange) await this._onChange(id, this.htmlPath);
  }

  onChange(cb) {
    this._onChange = cb;
  }
}

module.exports = new CompanionManager();
