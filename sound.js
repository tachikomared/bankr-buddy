'use strict';
// src/sound.js — OpenPeon CESP sound engine for Bankr Buddy
// Fetches packs from peonping.github.io/registry, downloads audio files,
// plays them on state changes using the CESP category → state mapping.
// Made by TachikomaRed x smolemaru

const https  = require('https');
const http   = require('http');
const fs     = require('fs');
const path   = require('path');

// OpenPeon sound registry URL
const REGISTRY_URL  = 'https://peonping.github.io/registry/index.json';
const REGISTRY_TTL  = 24 * 60 * 60 * 1000; // re-fetch after 24 h

// ── State → CESP category mapping ────────────────────────────────────────────
const STATE_TO_CESP = {
  thinking:       'task.acknowledge',
  working:        'task.acknowledge',
  building:       'task.acknowledge',
  happy:          'task.complete',
  error:          'task.error',
  notification:   'input.required',
  sleeping:       'session.end',
  idle:           'session.start',
  juggling:       'task.acknowledge',
  conducting:     'task.acknowledge',
  sweeping:       'task.progress',
  carrying:       'task.progress',
  poke:           'session.start',
  _session_start: 'session.start',
  _credits_low:   'resource.limit',
};

function buildRawUrl(pack, filename) {
  const repo = pack.source_repo;
  const ref  = pack.source_ref;
  const sp   = pack.source_path;
  const base = `https://raw.githubusercontent.com/${repo}/${ref}`;
  const dir  = (sp && sp !== '.') ? `/${sp}` : '';
  return `${base}${dir}/${filename}`;
}

class SoundEngine {
  constructor() {
    // Lazy: don't call app.getPath() here — app may not be ready yet
    this.dataDir      = null;
    this.cacheDir     = null;
    this.registryPath = null;
    this.configPath   = null;

    this.registry  = null;
    this.packMeta  = null;
    this.manifest  = null;
    this.volume    = 0.6;
    this.enabled   = true;
    this.packName  = 'eve-walle';

    // Renderer send hook — set by main.js after app.whenReady()
    this._sendToRenderer = null;
  }

  // ── Called by main.js after app.whenReady() ───────────────────────────────
  init() {
    const { app } = require('electron'); // lazy — app is ready now
    this.dataDir      = path.join(app.getPath('userData'), 'openpeon');
    this.cacheDir     = path.join(this.dataDir, 'sounds');
    this.registryPath = path.join(this.dataDir, 'registry.json');
    this.configPath   = path.join(this.dataDir, 'config.json');
    fs.mkdirSync(this.cacheDir, { recursive: true });
    this._loadConfig();
    // Load default pack in background
    this.loadPack('eve-walle').catch(e => console.warn('[sound] default pack load:', e.message));
  }

  _loadConfig() {
    try {
      const c = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
      this.packName = c.pack    ?? 'eve-walle';
      this.volume   = c.volume  ?? 0.6;
      this.enabled  = c.enabled ?? true;
    } catch {}
  }

  saveConfig() {
    if (!this.configPath) return;
    fs.writeFileSync(this.configPath, JSON.stringify({
      pack:    this.packName,
      volume:  this.volume,
      enabled: this.enabled,
    }, null, 2), 'utf8');
  }

  getConfig() {
    return { pack: this.packName, volume: this.volume, enabled: this.enabled };
  }

  async fetchRegistry(force = false) {
    if (!force && this.registry) return this.registry;
    if (this.registryPath) {
      try {
        const stat = fs.statSync(this.registryPath);
        if (!force && Date.now() - stat.mtimeMs < REGISTRY_TTL) {
          this.registry = JSON.parse(fs.readFileSync(this.registryPath, 'utf8'));
          return this.registry;
        }
      } catch {}
    }

    return new Promise((resolve) => {
      https.get(REGISTRY_URL, (res) => {
        let data = '';
        res.on('data', (d) => { data += d; });
        res.on('end', () => {
          try {
            this.registry = JSON.parse(data);
            if (this.registryPath) fs.writeFileSync(this.registryPath, data, 'utf8');
          } catch { this.registry = { packs: [] }; }
          resolve(this.registry);
        });
      }).on('error', () => {
        try { this.registry = JSON.parse(fs.readFileSync(this.registryPath, 'utf8')); } catch {}
        resolve(this.registry || { packs: [] });
      });
    });
  }

  async listPacks() {
    const reg = await this.fetchRegistry();
    return (reg.packs || []).map(p => ({
      name:        p.name,
      displayName: p.display_name,
      description: p.description,
      categories:  p.categories,
      tags:        p.tags,
      trustTier:   p.trust_tier,
      soundCount:  p.sound_count,
      language:    p.language,
    }));
  }

  async loadPack(packName) {
    const reg  = await this.fetchRegistry();
    const meta = (reg.packs || []).find(p => p.name === packName);
    if (!meta) throw new Error(`Pack "${packName}" not found in registry`);

    this.packName = packName;
    this.packMeta = meta;

    const manifestUrl = buildRawUrl(meta, 'openpeon.json');
    const manifestRaw = await this._fetch(manifestUrl);
    this.manifest = JSON.parse(manifestRaw);

    this.saveConfig();
    console.log(`[sound] Loaded pack: ${meta.display_name} (${packName})`);
    return this.manifest;
  }

  async _ensureCached(packName, filename) {
    const dir  = path.join(this.cacheDir, packName);
    const dest = path.join(dir, path.basename(filename));
    fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(dest)) return dest;
    const url = buildRawUrl(this.packMeta, filename);
    await this._download(url, dest);
    return dest;
  }

  async playCategory(category) {
    if (!this.enabled || !this.manifest || !this.packMeta) return;
    const catData = this.manifest.categories?.[category];
    if (!catData || !catData.sounds?.length) return;
    const sounds = catData.sounds;
    const pick   = sounds[Math.floor(Math.random() * sounds.length)];
    if (!pick?.file) return;
    try {
      const localPath = await this._ensureCached(this.packName, pick.file);
      if (this._sendToRenderer) {
        this._sendToRenderer('play-sound', { path: localPath, volume: this.volume });
      }
    } catch (e) {
      console.warn('[sound] playCategory failed:', e.message);
    }
  }

  async playState(state) {
    const category = STATE_TO_CESP[state];
    if (category) await this.playCategory(category);
  }

  async playEvent(eventKey) {
    const category = STATE_TO_CESP[eventKey];
    if (category) await this.playCategory(category);
  }

  _fetch(url) {
    return new Promise((resolve, reject) => {
      const mod = url.startsWith('https') ? https : http;
      mod.get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return resolve(this._fetch(res.headers.location));
        }
        let data = '';
        res.on('data', (d) => { data += d; });
        res.on('end', () => resolve(data));
      }).on('error', reject);
    });
  }

  _download(url, dest) {
    return new Promise((resolve, reject) => {
      const mod = url.startsWith('https') ? https : http;
      const req = mod.get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return resolve(this._download(res.headers.location, dest));
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(dest); });
        file.on('error', reject);
      });
      req.on('error', reject);
      req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
    });
  }
}

module.exports = new SoundEngine();
