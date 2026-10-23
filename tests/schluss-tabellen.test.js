"use strict";
// Schluss-Nachbesserung nach dem Gesamtreview (#564, Befunde 2–9 und Kleinigkeiten).
const test = require('node:test'), assert = require('node:assert');
const { ladeKarte } = require('./laden.js');
const { unraidAttrappe } = require('./attrappe.js');
const { dokument } = require('./dom-attrappe.js');
function rendere(Klasse, core, config = {}) { const k = new Klasse(); k._core = core; k._hass = { locale: { language: 'de' }, callService: async () => {} }; k.setConfig(config); k._render(); return k; }
const karte = k => k.shadowRoot.childNodes[1];
// Attrappe mit watchDevice: merkt sich die beobachteten Geräte und ihre Rückrufe.
function mitWatch(core) { core.beobachtet = new Map(); core.watchDevice = (id, fn) => { core.beobachtet.set(id, fn); return () => { if (core.beobachtet.get(id) === fn) core.beobachtet.delete(id); }; }; return core; }
function verbunden(Klasse, core, config = {}) { const k = new Klasse(); k._core = core; k._release = () => {}; k._hass = { locale: { language: 'de' }, states: {}, callService: async () => {} }; k.isConnected = true; k.setConfig(config); k._render(); return k; }

/* Befund 5: Tabellen am Handy */
test('Tabelle: ohne Labels kein thead; CSS für schmale Ansicht', () => {
  const { unraidTabelle, UNRAID_TILE_STYLE, BUSCH_UNRAID_STYLE } = ladeKarte(['unraidTabelle', 'UNRAID_TILE_STYLE', 'BUSCH_UNRAID_STYLE']);
  assert.equal(unraidTabelle([{ key: 'k', label: '' }, { key: 'v', label: '' }], [{ k: 'a', v: 'b' }]).querySelector('thead'), null);
  assert.ok(unraidTabelle([{ key: 'k', label: 'A' }], [{ k: 'a' }]).querySelector('thead'));
  const schmal = UNRAID_TILE_STYLE.match(/@container \(max-width: ?420px\)\{(.*?)\}\n/s)[1];
  assert.match(schmal, /\.table td>\.bar\{[^}]*flex:1 1 auto/); assert.match(schmal, /td\[data-label=""\]::before\{display:none\}/);
  assert.match(BUSCH_UNRAID_STYLE, /:host\{[^}]*container-type:inline-size/, ':host ist der Container für @container');
});

/* Befund 6: Kontrast und Ring */
test('Balken: Wert steht neben der Spur, nicht auf der Füllung; Ring ohne feste Pixelmaße', () => {
  const { unraidBalken, UNRAID_TILE_STYLE } = ladeKarte(['unraidBalken', 'UNRAID_TILE_STYLE']);
  const b = unraidBalken(80, '80 %'); assert.ok(b.className.includes('warn')); const spur = b.querySelector('.bar-track');
  assert.ok(spur, 'eigene Spur'); assert.ok(spur.querySelector('.bar-fill')); assert.equal(spur.querySelector('.bar-text'), null, 'Text nicht über der Füllung');
  assert.equal(b.querySelector('.bar-text').textContent, '80 %');
  const ring = UNRAID_TILE_STYLE.match(/\.ring-value\{[^}]*\}/)[0]; assert.doesNotMatch(ring, /\d+px/); assert.match(UNRAID_TILE_STYLE, /\.ring svg,\.ring-value\{grid-area:1\/1\}/);
});

