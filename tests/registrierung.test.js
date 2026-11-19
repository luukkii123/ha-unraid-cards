'use strict';
// M42 (#1317, D8): every element is registered through BuschUI.register (define only without a definition, one card-picker
// entry per type); loading the bundle twice into one realm throws nothing and adds no duplicate entries.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { Element, dokument } = require('./dom-attrappe.js');

const QUELLE = fs.readFileSync(path.join(__dirname, '../dist/unraid-cards.js'), 'utf8');
const EIGEN = QUELLE.replace(/\/\* BEGIN BUSCH SHARED UI[\s\S]*?\/\* END BUSCH SHARED UI \*\//, '');

test('M42 no direct customElements.define or customCards.push outside the shared UI block', () => {
  assert.deepEqual(EIGEN.match(/customElements\.define\(/g) || [], []);
  assert.deepEqual(EIGEN.match(/customCards\.push\(/g) || [], []);
  assert.ok((EIGEN.match(/BuschUI\.register\(/g) || []).length >= 36, '17 cards, 17 editors, menu and dialog');
});

test('M42 loading the bundle twice keeps the first classes, no NotSupportedError, no duplicate picker entries', () => {
  const registry = new Map(), defines = [];
  const customElements = { get: k => registry.get(k), define(k, v) { if (registry.has(k)) throw new Error('NotSupportedError: ' + k); defines.push(k); registry.set(k, v); } };
  const window = { customCards: [], addEventListener() {}, removeEventListener() {} };
  const kontext = vm.createContext({ console: { info() {}, warn() {}, error() {}, log() {} }, window, customElements, HTMLElement: Element, document: dokument(), navigator: { language: 'de-DE' }, setTimeout, clearTimeout });
  vm.runInContext(QUELLE, kontext);
  const erste = new Map(registry), typen = window.customCards.map(c => c.type);
  assert.equal(typen.length, 17, 'one picker entry per card'); assert.equal(new Set(typen).size, 17);
  assert.equal(defines.length, new Set(defines).size);
  vm.runInContext(QUELLE, vm.createContext({ ...kontext, window, customElements }));
  assert.deepEqual(window.customCards.map(c => c.type), typen, 'second load adds no picker entry');
  for (const [k, v] of erste) assert.equal(registry.get(k), v, k + ': first class stays');
  assert.equal(defines.length, erste.size, 'no second define');
});
