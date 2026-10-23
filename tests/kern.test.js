"use strict";
// Befund 1 (#564, R17): Der Kern gehört dem, der ensureBuschCore zuerst aufruft.
// Lädt eine Unraid-Karte zuerst, nutzen Busch-Cards-Karten (Gerät, Smart) diesen
// Kern — er muss daher wortgleich zu Busch Cards sein, inklusive smartQuery.
const test = require('node:test'), assert = require('node:assert');
const fs = require('node:fs'), path = require('node:path');
const { ladeKarte } = require('./laden.js');

const START = 'const BUSCH_CORE_KEY = Symbol.for("busch.cards.core");';
/** Kern von BUSCH_CORE_KEY bis zur schließenden Klammer von BuschSmartQueries. */
function kern(quelle) {
  const zeilen = quelle.split('\n');
  const a = zeilen.indexOf(START);
  const s = zeilen.findIndex((z, i) => i > a && z.startsWith('class BuschSmartQueries'));
  const e = zeilen.findIndex((z, i) => i > s && z === '}');
  if (a < 0 || s < 0 || e < 0) return null;
  return zeilen.slice(a, e + 1).join('\n');
}

test('Kern: smartQuery wirft nicht, BuschSmartQueries ist vorhanden', () => {
  const { ensureBuschCore } = ladeKarte(['ensureBuschCore'], { performance: { now: () => 0 }, setTimeout, clearTimeout });
  const core = ensureBuschCore(1);
  const q = core.smartQuery({ filter: { include: [{ domain: 'light' }] } });
  assert.ok(q && q.key, 'smartQuery liefert eine Abfrage');
  assert.ok(core.smart, 'BuschSmartQueries wird angelegt');
});

test('Kern: Abschnitt ist byte-gleich zu Busch Cards', (t) => {
  const kandidaten = [path.join(__dirname, '..', '..', 'busch-cards', 'dist', 'busch-cards.js'), '/busch-cards/dist/busch-cards.js'];
  const busch = kandidaten.find((p) => fs.existsSync(p));
  if (!busch) { t.skip('busch-cards liegt nicht daneben; Vergleich über hacs/scripts/kern-gleich-pruefen.py'); return; }
  const eigen = kern(fs.readFileSync(path.join(__dirname, '..', 'dist', 'unraid-cards.js'), 'utf8'));
  const fremd = kern(fs.readFileSync(busch, 'utf8'));
  assert.ok(eigen && fremd, 'Marker in beiden Bundles gefunden');
  assert.ok(eigen === fremd, 'Kern weicht von Busch Cards ab');
});
