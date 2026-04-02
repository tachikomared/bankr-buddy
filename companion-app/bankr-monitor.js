#!/usr/bin/env node
// hooks/bankr-monitor.js
// Optional: polls Bankr LLM Gateway health every 30s and reflects status on Buddy.
// Made by TachikomaRed x smolemaru
'use strict';

const http  = require('http');
const https = require('https');

const BUDDY_PORT      = parseInt(process.env.BUDDY_PORT || '', 10) || 23444;
const POLL_MS         = 30_000;

function notifyBuddy(state, event) {
  const body = JSON.stringify({ state, session_id: 'bankr-monitor', event });
  const req  = http.request({
    hostname: '127.0.0.1',
    port:     BUDDY_PORT,
    path:     '/state',
    method:   'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  }, () => {});
  req.on('error', () => {});
  req.setTimeout(2000, () => req.destroy());
  req.write(body);
  req.end();
}

function checkGateway() {
  const req = https.request({
    hostname: 'llm.bankr.bot',
    path:     '/health',
    method:   'GET',
  }, (res) => {
    let body = '';
    res.on('data', (d) => { body += d; });
    res.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (data.status === 'ok') {
          notifyBuddy('happy', 'GatewayHealthy');
          console.log('[bankr-monitor] Gateway healthy ✓');
        } else {
          notifyBuddy('error', 'GatewayDown');
          console.warn('[bankr-monitor] Gateway degraded:', data);
        }
      } catch {
        notifyBuddy('error', 'GatewayDown');
      }
    });
  });
  req.on('error', () => {
    notifyBuddy('notification', 'GatewayUnreachable');
    console.warn('[bankr-monitor] Gateway unreachable');
  });
  req.setTimeout(5000, () => req.destroy());
  req.end();
}

function checkCredits() {
  const key = process.env.BANKR_API_KEY || process.env.BANKR_LLM_KEY || process.env.ANTHROPIC_API_KEY || '';
  if (!key.startsWith('bk_')) return;

  const req = https.request({
    hostname: 'llm.bankr.bot',
    path:     '/v1/usage?days=1',
    method:   'GET',
    headers:  { 'X-API-Key': key },
  }, (res) => {
    let body = '';
    res.on('data', (d) => { body += d; });
    res.on('end', () => {
      try {
        const data = JSON.parse(body);
        // If requests happened today but cost is $0, credits likely exhausted
        if ((data.totals?.totalRequests || 0) > 0 && (data.totals?.totalCost || 0) === 0) {
          notifyBuddy('notification', 'BankrCreditsLow');
          console.warn('[bankr-monitor] Credits may be exhausted — top up at https://bankr.bot/llm?tab=credits');
        }
      } catch {}
    });
  });
  req.on('error', () => {});
  req.setTimeout(5000, () => req.destroy());
  req.end();
}

// Run immediately then on interval
checkGateway();
checkCredits();
setInterval(() => { checkGateway(); checkCredits(); }, POLL_MS);

console.log('🟣 Bankr Buddy Monitor — TachikomaRed x smolemaru');
console.log(`   Polling llm.bankr.bot every ${POLL_MS / 1000}s → Buddy on :${BUDDY_PORT}`);
console.log('   Ctrl+C to stop\n');
