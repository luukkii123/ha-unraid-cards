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
