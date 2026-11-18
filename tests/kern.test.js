"use strict";
// Befund 1 (#564, R17): Der Kern gehört dem, der ensureBuschCore zuerst aufruft.
// Lädt eine Unraid-Karte zuerst, nutzen Busch-Cards-Karten (Gerät, Smart) diesen
// Kern — er muss daher wortgleich zu Busch Cards sein, inklusive smartQuery.
const test = require('node:test'), assert = require('node:assert');
const fs = require('node:fs'), path = require('node:path');
const { ladeKarte } = require('./laden.js');
const { Element, dokument } = require('./dom-attrappe.js');

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
  const [, version, hash, block] = bloecke[0];
  const stempel = `const BUSCH_CORE_STAMP = Object.freeze({ version: "${version}", sourceHash: "${hash.slice(0, 12)}" });\n`;
  assert.ok(block.startsWith(stempel), 'Block beginnt mit Stempel aus Markerversion und Hashanfang');
  const inhalt = block.slice(stempel.length);
  assert.equal(crypto.createHash('sha256').update(inhalt).digest('hex'), hash, 'Kern weicht vom Marker-Hash ab');
  assert.ok(inhalt.startsWith(`/* Busch Cards Core ${version}. `), 'Quellkopf nennt die Markerversion');
});

// M9: Two bundles with different core content share one global core. The first
// loaded core stays; the later bundle warns exactly once, and the version and
// the 12-character source hash from the marker stay readable from outside.
const vm = require('node:vm');
function evaluateTwice(firstText, secondText) {
  const warnings = [];
  const context = {
    console: { info() {}, warn: (...args) => warnings.push(args.join(' ')), error() {}, log() {} },
    window: { customCards: [] }, customElements: { define() {} }, HTMLElement: Element, document: dokument(),
    setTimeout, clearTimeout, queueMicrotask, performance,
  };
  context.globalThis = context; vm.createContext(context);
  // A function scope per evaluation mirrors two separate ES modules on one globalThis.
  const run = (text) => vm.runInContext(`(() => {\n${text}\n;return { ensureBuschCore };\n})()`, context);
  return { warnings, first: run(firstText), second: run(secondText) };
}
function marker(text) {
  const [, version, hash] = text.match(/\/\* BEGIN BUSCH SHARED CORE (\S+) sha256:([0-9a-f]{64}) \*\//);
  return { version, sourceHash: hash.slice(0, 12) };
}

test('core: a second core with another hash warns once and keeps the first core', () => {
  const text = fs.readFileSync(KARTE, 'utf8'), own = marker(text);
  const other = text.replace(`sourceHash: "${own.sourceHash}"`, 'sourceHash: "000000000000"');
  assert.ok(other !== text, 'bundle carries the injected sourceHash');
  const { warnings, first, second } = evaluateTwice(text, other);
  const core = first.ensureBuschCore(1);
  assert.equal(warnings.length, 0);
  for (let i = 0; i < 3; i++) assert.equal(second.ensureBuschCore(1), core, 'first core is kept');
  assert.equal(warnings.length, 1, warnings.join('\n'));
  assert.match(warnings[0], new RegExp(`${own.sourceHash}[\\s\\S]*000000000000|000000000000[\\s\\S]*${own.sourceHash}`));
  assert.equal(core.version, own.version);
  assert.equal(core.sourceHash, own.sourceHash);
  const snapshot = core.debugSnapshot();
  assert.equal(snapshot.version, own.version);
  assert.equal(snapshot.sourceHash, own.sourceHash);
});

test('core: the same core loaded twice stays silent', () => {
  const text = fs.readFileSync(KARTE, 'utf8');
  const { warnings, first, second } = evaluateTwice(text, text);
  assert.equal(second.ensureBuschCore(1), first.ensureBuschCore(1));
  assert.equal(warnings.length, 0, warnings.join('\n'));
});
