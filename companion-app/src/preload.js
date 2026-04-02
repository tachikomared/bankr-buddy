'use strict';
// src/preload.js — Bankr Buddy IPC bridge
// Made by TachikomaRed x smolemaru

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('buddy', {
  onStateChange: (cb) => ipcRenderer.on('state-change', (_, data) => cb(data)),
  onGlobalMouse: (cb) => ipcRenderer.on('global-mouse', (_, pos) => cb(pos)),
  enableMouse:   ()    => ipcRenderer.send('enable-mouse'),
  disableMouse:  ()    => ipcRenderer.send('disable-mouse'),
  dragEnd:       (pos) => ipcRenderer.send('drag-end', pos),
  miniExit:      ()    => ipcRenderer.send('mini-exit'),
  forceState:    (s)   => ipcRenderer.send('force-state', s),
});
