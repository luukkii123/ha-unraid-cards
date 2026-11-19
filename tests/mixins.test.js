'use strict';
// M72 (#1322, D15): collapse toggle and core connection live in one mixin each (unraidEinklappbar,
// unraidKernAnbindung); every card class and editor gets them from there instead of its own copy.
const test = require('node:test'), assert = require('node:assert/strict');
const { ladeKarte, quelle } = require('./laden.js');

const EIGEN = quelle()
  .replace(/\/\* BEGIN BUSCH SHARED UI[\s\S]*?\/\* END BUSCH SHARED UI \*\//, '')
  .replace(/\/\* BEGIN BUSCH SHARED CORE[\s\S]*?\/\* END BUSCH SHARED CORE \*\//, '');
const definitionen = name => (EIGEN.match(new RegExp(`(?<![.\\w])${name}\\s*\\(\\s*\\)\\s*\\{`, 'g')) || []).length;

test('M72 _umschalten and _connect are each defined exactly once, _verbinden is gone', () => {
  assert.equal(definitionen('_umschalten'), 1, '_umschalten');
  assert.equal(definitionen('_connect'), 1, '_connect');
  assert.deepEqual(EIGEN.match(/_verbinden/g) || [], [], '_verbinden');

  // ui-regeln-pruefen.py follows `class X extends Name {`; a call in the header would hide getCardSize/getGridOptions.
  assert.deepEqual(EIGEN.match(/^class \w+ extends [^{]*\(/gm) || [], [], 'no mixin call in a class header');
});

test('M72 every card and editor reaches the shared methods through the mixins', () => {
  const k = ladeKarte(['BuschUnraidBaseCard', 'BuschUnraidDockerCard', 'BuschUnraidTile', 'BuschUnraidServerCard',
    'BuschUnraidBaseEditor', 'BuschUnraidDockerEditor', 'unraidEinklappbar', 'unraidKernAnbindung']);
  assert.equal(typeof k.unraidEinklappbar, 'function');
  assert.equal(typeof k.unraidKernAnbindung, 'function');
  for (const C of [k.BuschUnraidBaseCard, k.BuschUnraidDockerCard, k.BuschUnraidTile, k.BuschUnraidServerCard]) {
    assert.equal(typeof C.prototype._umschalten, 'function', C.name + '._umschalten');
    assert.equal(typeof C.prototype._connect, 'function', C.name + '._connect');
  }
  for (const C of [k.BuschUnraidBaseEditor, k.BuschUnraidDockerEditor]) {
    assert.equal(typeof C.prototype._connect, 'function', C.name + '._connect');
    assert.equal(C.prototype._umschalten, undefined, C.name + ' does not collapse');
  }
});

test('M72 toggle keeps storage key per card and the Docker focus hook', () => {
  const speicher = new Map();
  const k = ladeKarte(['BuschUnraidTile', 'BuschUnraidDockerCard', 'BuschUnraidStackCard'],
    { localStorage: { getItem: x => speicher.get(x) ?? null, setItem: (x, v) => speicher.set(x, String(v)) } });
  const ohneRender = C => class extends C { _render() { this.gerendert = (this.gerendert || 0) + 1; } };
  class Kachel extends ohneRender(k.BuschUnraidTile) { static get kachel() { return 'probe'; } }
  const kachel = new Kachel(); kachel.setConfig({ device_id: 's', title: 'T' });
  kachel._umschalten();
  assert.equal(speicher.get('unraid-cards:probe:s:T'), '1');
  assert.equal(kachel._focusAfter, undefined, 'tile sets no focus target');
  const stack = new (ohneRender(k.BuschUnraidStackCard))(); stack.setConfig({ device_id: 's', title: 'S' });
  stack._umschalten();
  assert.equal(speicher.get('unraid-cards:stack:s:S'), '1');
  assert.equal(stack._focusAfter, undefined, 'family card sets no focus target');
  const docker = new (ohneRender(k.BuschUnraidDockerCard))(); docker.setConfig({ device_id: 's', title: 'D' });
  docker._umschalten(); docker._umschalten();
  assert.equal(speicher.get('unraid-cards:docker:s:D'), '0');
  assert.deepEqual({ ...docker._focusAfter }, { key: 'card', role: 'toggle' });
  assert.equal(docker._eingeklappt, false);
});

test('M72 core connection: one retain and one watch per connect, release on disconnect', () => {
  const aufrufe = { retain: 0, release: 0, watch: 0, unwatch: 0 };
  const kern = {
    retain() { aufrufe.retain++; return () => aufrufe.release++; },
    watch() { aufrufe.watch++; return () => aufrufe.unwatch++; },
    attach() {}, unchanged() { return false; }, track(f) { f(); return []; },
  };
  const k = ladeKarte(['BuschUnraidTile', 'BuschUnraidBaseEditor'], { kern }, 'ensureBuschCore = () => kern;');
  class Kachel extends k.BuschUnraidTile { static get kachel() { return 'probe'; } _render() {} }
  class Editor extends k.BuschUnraidBaseEditor { get _kind() { return 'stack'; } _render() {} }
  for (const C of [Kachel, Editor]) {
    const el = new C(); el.isConnected = true;
    el._connect(); assert.deepEqual(aufrufe, { retain: 0, release: 0, watch: 0, unwatch: 0 }, C.name + ': no hass, no retain');
    el.hass = { states: {} }; el._connect();
    assert.equal(aufrufe.retain, 1, C.name + ': retain once'); assert.equal(aufrufe.watch, 1, C.name + ': watch once');
    assert.equal(el._core, kern);
    el.disconnectedCallback();
    assert.equal(aufrufe.release, 1, C.name + ': release'); assert.equal(aufrufe.unwatch, 1, C.name + ': unwatch');
    for (const key of Object.keys(aufrufe)) aufrufe[key] = 0;
  }
});
