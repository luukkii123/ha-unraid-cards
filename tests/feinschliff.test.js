"use strict";
// #643 Design-Feinschliff, Phase A (ohne Render-Pfad): Punkte 1, 4 (GPU), 5 (CPU), 7 (Docker).
const test = require('node:test'), assert = require('node:assert');
const { ladeKarte } = require('./laden.js');

// ── Schritt 7: #643/1 Titel in normaler Schreibung ──────────────────────────
test('#643/1: kein text-transform:uppercase in den Kartenstilen (alle 17 Karten nutzen .tile-title)', () => {
  const l = ladeKarte(['UNRAID_TILE_STYLE', 'UNRAID_FAMILIE_STYLE', 'BUSCH_UNRAID_DOCKER_STYLE', 'BUSCH_UNRAID_STYLE']);
  for (const [name, css] of Object.entries(l)) assert.doesNotMatch(css, /uppercase/i, name);
  assert.match(l.UNRAID_TILE_STYLE, /\.tile-title\{[^}]*text-overflow:ellipsis[^}]*\}/);
  assert.doesNotMatch(l.UNRAID_TILE_STYLE.match(/\.tile-title\{[^}]*\}/)[0], /letter-spacing/);
});

// ── Schritt 8: #643/4 GPU ────────────────────────────────────────────────────
const { unraidAttrappe } = require('./attrappe.js');
function gpu(core = unraidAttrappe(), config = {}) {
  const { BuschUnraidGpuCard } = ladeKarte(['BuschUnraidGpuCard']), k = new BuschUnraidGpuCard();
  k._core = core; k._hass = { locale: { language: 'de' } }; k.setConfig(config); k._render(); return k;
}
test('#643/4 GPU: Untertitel nur Modell und Treiber, weder Last noch Temperatur', () => {
  const sub = gpu().shadowRoot.querySelector('.tile-sub').textContent;
  assert.match(sub, /Treiber: /); assert.doesNotMatch(sub, /Last|Temperatur|%|°C/);
});
test('#643/4 GPU: Wertegitter mit Rollen, jede Zeile drei Zellen, Werte rechts', () => {
  const k = gpu(), gitter = k.shadowRoot.querySelector('.gpu-values');
  assert.ok(gitter); assert.match(gitter.className, /\btable\b/); assert.equal(gitter.getAttribute('role'), 'table');
  assert.equal(k.shadowRoot.querySelector('table'), null, 'keine HTML-Tabelle mehr (kein Stapeln unter 420 px)');
  const zeilen = gitter.childNodes; assert.equal(zeilen.length, 5);
  for (const z of zeilen) { assert.equal(z.getAttribute('role'), 'row'); assert.equal(z.childNodes.length, 3); for (const c of z.childNodes) assert.equal(c.getAttribute('role'), 'cell'); }
  assert.deepEqual(zeilen.map(z => z.childNodes[0].textContent), ['Last', 'Speicher', 'Temperatur', 'Leistung', 'Lüfter']);
  assert.deepEqual(zeilen.map(z => z.childNodes[2].textContent), ['19 %', '9 %', '52 °C', '78 W', '31 %']);
  // Balken nur in der Spur-Spalte und ohne eigenen Text; Einzelwerte haben eine leere Spur
  assert.ok(zeilen[0].childNodes[1].querySelector('.bar')); assert.equal(zeilen[0].childNodes[1].querySelector('.bar-text'), null);
  assert.equal(zeilen[2].childNodes[1].childNodes.length, 0);
});
test('#643/4 unraidBalken: ohneText lässt .bar-text weg, aria-valuetext bleibt', () => {
  const { unraidBalken } = ladeKarte(['unraidBalken']);
  const ohne = unraidBalken(50, '50 %', { ohneText: true }); assert.equal(ohne.querySelector('.bar-text'), null); assert.equal(ohne.getAttribute('aria-valuetext'), '50 %');
  const mit = unraidBalken(50, '50 %'); assert.ok(mit.querySelector('.bar-text'));
  const leer = unraidBalken(null, '–', { ohneText: true }); assert.equal(leer.getAttribute('aria-valuetext'), '–');
});
test('#643/4 GPU: CSS bündige rechte Spalte', () => {
  const { UNRAID_TILE_STYLE } = ladeKarte(['UNRAID_TILE_STYLE']);
  assert.match(UNRAID_TILE_STYLE, /\.gpu-values\{[^}]*display:grid[^}]*grid-template-columns:auto minmax\(0,1fr\) auto/);
  assert.match(UNRAID_TILE_STYLE, /\.gpu-value\{[^}]*text-align:end[^}]*tabular-nums/);
});
