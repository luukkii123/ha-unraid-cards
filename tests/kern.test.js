"use strict";
// Befund 1 (#564, R17): Der Kern gehört dem, der ensureBuschCore zuerst aufruft.
// Lädt eine Unraid-Karte zuerst, nutzen Busch-Cards-Karten (Gerät, Smart) diesen
// Kern — er muss daher wortgleich zu Busch Cards sein, inklusive smartQuery.
const test = require('node:test'), assert = require('node:assert');
const fs = require('node:fs'), path = require('node:path');
const { ladeKarte } = require('./laden.js');

const crypto = require('node:crypto');
const KARTE = path.join(__dirname, '..', 'dist', 'unraid-cards.js');
const BLOCK = /\/\* BEGIN BUSCH SHARED CORE (\S+) sha256:([0-9a-f]{64}) \*\/\n([\s\S]*?)\/\* END BUSCH SHARED CORE \*\//g;

test('Kern: smartQuery wirft nicht, BuschSmartQueries ist vorhanden', () => {
  const { ensureBuschCore } = ladeKarte(['ensureBuschCore'], { performance: { now: () => 0 }, setTimeout, clearTimeout });
  const core = ensureBuschCore(1);
  const q = core.smartQuery({ filter: { include: [{ domain: 'light' }] } });
  assert.ok(q && q.key, 'smartQuery liefert eine Abfrage');
  assert.ok(core.smart, 'BuschSmartQueries wird angelegt');
});

// M8: The core is embedded from hacs/shared-core/busch-core.js by
// scripts/sync-shared-ui.py. The marker hash must match the block, so any edit
// inside the block fails here and in GitHub CI without the neighbouring repo.
// Cross-repo equality is checked by the sync check mode.
test('Kern: genau ein CORE-Block, Inhalt passt zum Hash im Marker', () => {
  const quelle = fs.readFileSync(KARTE, 'utf8');
  const bloecke = [...quelle.matchAll(BLOCK)];
  assert.equal(bloecke.length, 1, 'genau ein BUSCH SHARED CORE-Block');
  assert.equal(quelle.split('/* BEGIN BUSCH SHARED CORE ').length - 1, 1, 'kein zweiter BEGIN-Marker');
  const [, , hash, inhalt] = bloecke[0];
  assert.equal(crypto.createHash('sha256').update(inhalt).digest('hex'), hash, 'Kern weicht vom Marker-Hash ab');
  assert.ok(inhalt.startsWith('const BUSCH_CORE_KEY = Symbol.for("busch.cards.core");\n'), 'Block beginnt mit dem Kern');
});
