'use strict';
// M73 (#1322, D16): the bundle head names every card it registers; the list must match window.customCards, so a new card
// without a head entry (or a stale entry) turns this test red.
const test = require('node:test'), assert = require('node:assert/strict');
const vm = require('node:vm');
const { quelle } = require('./laden.js');
const { Element, dokument } = require('./dom-attrappe.js');

function kopfListe(text) {
  const m = text.match(/\/\* === Cards in this bundle[^\n]*\n([\s\S]*?)\*\//);
  assert.ok(m, 'head comment "Cards in this bundle" missing');
  return [...m[1].matchAll(/^ \* (busch-unraid-[a-z0-9-]+)\s/gm)].map(x => x[1]);
}

function waehler(text) {
  const window = { customCards: [], addEventListener() {}, removeEventListener() {} };
  vm.runInContext(text, vm.createContext({ console: { info() {}, warn() {}, error() {}, log() {} }, window,
    customElements: { define() {}, get() { return undefined; } }, HTMLElement: Element, document: dokument(),
    navigator: { language: 'en-US' }, setTimeout, clearTimeout }));
  return window.customCards.map(c => c.type);
}

test('M73 head comment lists exactly the customCards entries, in registration order', () => {
  const typen = waehler(quelle());
  assert.equal(typen.length, 17);
  assert.deepEqual(kopfListe(quelle()), typen);
});

test('M73 a new card without a head entry makes the comparison fail', () => {
  const neu = quelle() + "\nBuschUI.register('busch-unraid-probe-card',class extends HTMLElement{},{type:'busch-unraid-probe-card',name:'Probe'});\n";
  assert.notDeepEqual(kopfListe(neu), waehler(neu));
});

test('M73 no stale card count in section heads', () => {
  assert.deepEqual(quelle().match(/alle drei Karten|all three cards/g) || [], []);
});
