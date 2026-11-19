'use strict';
// M79 (#1322, W23): every render script of the runner (hacs/scripts/karten-runner.json) installs the shared ha-icon
// stand-in of hacs/docs/render/regeln.py, so the images show the real MDI glyphs instead of a letter or a diamond, and
// writes its state (active, names without a path) into report.json. Checked in the source: no browser in the Node run.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');

const RENDER = path.join(__dirname, '../docs/render');
const SKRIPTE = ['unraid-cards.py', 'unraid-queue.py', 'unraid-updated-family.py', 'unraid-docker.py', 'kacheln.py', 'stufe2.py', 'stufe3.py', 'anzeige.py'];

test('M79 every runner render script installs the shared ha-icon stand-in and reports it', () => {
  for (const name of SKRIPTE) {
    const text = fs.readFileSync(path.join(RENDER, name), 'utf8');
    assert.match(text, /regeln\.ha_icon_attrappe\(|\bha_icon_attrappe\(/, name + ': regeln.ha_icon_attrappe missing');
    assert.match(text, /ha_icon_fehlend\(/, name + ': ha_icon_fehlend (report) missing');
  }
});

test('M79 the contrast measurement keeps no ha-icon exception: the real glyphs are measured with 3:1 (WCAG 1.4.11)', () => {
  const liste = JSON.parse(fs.readFileSync(path.join(RENDER, 'kontrast-ausnahmen.json'), 'utf8'));
  for (const bereich of ['kontrast', 'touch']) {
    const treffer = (liste[bereich] || []).filter(a => /(^|[\s>,])ha-icon\b/.test(a.selektor));
    assert.deepEqual(treffer, [], bereich + ': ha-icon exception left');
  }
});
