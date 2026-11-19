'use strict';
// M27 (#1317, W3/F4): one state block (BuschUI.stateBlock) for loading, empty, error and offline, and a live region in
// every card from its first render. Offline tiles name the cause and offer one retry (reload of the config entry).
const test = require('node:test'), assert = require('node:assert/strict');
const { ladeKarte } = require('./laden.js');
const { unraidAttrappe } = require('./attrappe.js');
const { inventoryFixture, familienKarte, dockerKarte } = require('./familie-attrappe.js');

const KACHELN = ['BuschUnraidServerCard', 'BuschUnraidSystemCard', 'BuschUnraidCpuCard', 'BuschUnraidGpuCard', 'BuschUnraidArrayCard',
  'BuschUnraidParityCard', 'BuschUnraidAirflowCard', 'BuschUnraidSharesCard', 'BuschUnraidVmUsageCard', 'BuschUnraidInterfaceCard',
  'BuschUnraidUsersCard', 'BuschUnraidUsbCard', 'BuschUnraidCoralCard'];
const K = ladeKarte([...KACHELN, 'BuschUnraidVmCard']);
function rendere(name, core, config = {}, hass = {}) {
  const k = new K[name](), calls = [];
  k._core = core; k._hass = { locale: { language: 'de' }, config: { time_zone: 'UTC' }, user: { is_admin: true }, callService: async (...a) => { calls.push(a); }, ...hass };
  k.setConfig({ show_clock: false, show_history: false, ...config }); k._render(); k.calls = calls; return k;
}
const live = k => k.shadowRoot.querySelector('.live-region');
const block = k => k.shadowRoot.querySelector('.busch-state');
function ausgefallen() { const c = unraidAttrappe(); c.entities.get('sensor.tower_cpu').state = 'unavailable'; c.entities.get('sensor.tower_array').state = 'unavailable'; return c; }

test('M27 every card has a polite live region from its first render (loading, empty and with data)', () => {
  for (const name of [...KACHELN, 'BuschUnraidVmCard']) {
    const laedt = new K[name](); laedt.setConfig({}); laedt._render();
    for (const [fall, k] of [['loading', laedt], ['empty', rendere(name, unraidAttrappe(), { device_id: 'weg' })], ['data', rendere(name, inventoryFixture(), { device_id: 'demo' })]]) {
      const r = live(k); assert.ok(r, `${name} ${fall}: live region`);
      assert.equal(r.getAttribute('aria-live'), 'polite', `${name} ${fall}`); assert.equal(r.getAttribute('aria-atomic'), 'true', `${name} ${fall}`);
    }
  }
  for (const k of [familienKarte('stack'), familienKarte('container'), familienKarte('stack', { device_id: 'weg' }), dockerKarte(), dockerKarte({ device_id: 'weg' })])
    assert.equal(live(k)?.getAttribute('aria-live'), 'polite', k.tagName || k.constructor.name);
});

test('M27 the live region is the same node across renders and carries the tile notice', () => {
  const k = rendere('BuschUnraidServerCard', inventoryFixture(), { device_id: 'demo' }), region = live(k);
  assert.equal(region.textContent, ''); assert.equal(k.shadowRoot.querySelector('[role="status"]'), null, 'no status text without a notice');
  k._notice = 'Anfrage gesendet; Verbindung/Serverzustand prüfen.'; k._render();
  assert.equal(live(k), region, 'same live region object (announced on change)');
  assert.match(region.textContent, /Anfrage gesendet/); assert.equal(region.querySelector('[role="status"]').textContent, k._notice);
});

test('M27 loading and empty tiles use the state block with status semantics', () => {
  const laedt = new K.BuschUnraidArrayCard(); laedt._hass = { locale: { language: 'de' } }; laedt.setConfig({}); laedt._render();
  const b = block(laedt); assert.ok(b, 'loading block'); assert.equal(b.getAttribute('data-kind'), 'loading'); assert.equal(b.getAttribute('role'), 'status'); assert.equal(b.getAttribute('aria-busy'), 'true');
  assert.match(b.querySelector('.busch-state-title').textContent, /Wird geladen/);
  const leer = rendere('BuschUnraidArrayCard', unraidAttrappe(), { device_id: 'weg' }), e = block(leer);
  assert.equal(e.getAttribute('data-kind'), 'empty'); assert.equal(e.getAttribute('role'), 'status');
  assert.match(e.querySelector('.busch-state-title').textContent, /Kein Unraid-Server gefunden/);
  const gpu = rendere('BuschUnraidGpuCard', unraidAttrappe({ gpu: false })); assert.equal(block(gpu)?.getAttribute('data-kind'), 'empty', 'empty GPU list');
});

test('M27 offline tile: cause, impact and a retry that reloads the config entry exactly once', async () => {
  for (const name of ['BuschUnraidSystemCard', 'BuschUnraidArrayCard', 'BuschUnraidUsersCard']) {
    const k = rendere(name, ausgefallen()), b = block(k);
    assert.ok(b, name + ': offline block'); assert.equal(b.getAttribute('data-kind'), 'offline'); assert.equal(b.getAttribute('role'), 'status');
    assert.equal(b.querySelector('.busch-state-title').textContent, 'Nicht verfügbar');
    assert.match(b.querySelector('.busch-state-hint').textContent, /Unraid antwortet nicht.*Unraid SSH/s, name + ': cause and next step');
    const knopf = b.querySelector('button'); assert.ok(knopf, name + ': retry button'); assert.equal(knopf.textContent, 'Erneut versuchen');
    knopf.click(); knopf.click(); await new Promise(r => setImmediate(r));
    assert.deepEqual(JSON.parse(JSON.stringify(k.calls)), [['homeassistant', 'reload_config_entry', { entry_id: 'e1' }]], name + ': one reload');
  }
  const fehl = rendere('BuschUnraidSystemCard', ausgefallen(), {}, { callService: async () => { throw new Error('nope'); } });
  block(fehl).querySelector('button').click(); await new Promise(r => setImmediate(r));
  assert.match(fehl.shadowRoot.querySelector('[role="alert"]')?.textContent || '', /fehlgeschlagen/, 'failed retry shows the error');
  const gast = rendere('BuschUnraidSystemCard', ausgefallen(), { admin_actions: true }, { user: { is_admin: false } });
  assert.equal(block(gast).querySelector('button'), null, 'admin_actions: no retry for a non-admin');
});

test('M27 VM list: loading, offline with retry and empty list as state blocks', async () => {
  const laedt = new K.BuschUnraidVmCard(); laedt.setConfig({ device_id: 'srv' }); laedt._hass = { locale: { language: 'de' } }; laedt._render();
  assert.equal(block(laedt)?.getAttribute('data-kind'), 'loading');
  const off = rendere('BuschUnraidVmCard', ausgefallen(), { device_id: 'srv' }); assert.equal(block(off)?.getAttribute('data-kind'), 'offline');
  block(off).querySelector('button').click(); await new Promise(r => setImmediate(r));
  assert.deepEqual(JSON.parse(JSON.stringify(off.calls)), [['homeassistant', 'reload_config_entry', { entry_id: 'e1' }]]);
  const c = unraidAttrappe(); for (const e of c.entities.values()) if (e.entity_id.startsWith('switch.win') || e.entity_id.startsWith('sensor.win')) { e.state = 'shut off'; }
  c.entities.get('switch.win').state = 'off';
  const leer = rendere('BuschUnraidVmCard', c, { device_id: 'srv' }); assert.equal(block(leer)?.getAttribute('data-kind'), 'empty');
});

test('M27 family and Docker cards: no device, no containers and all hidden use the state block', () => {
  const s = familienKarte('stack', { device_id: 'weg' }); assert.equal(block(s)?.getAttribute('data-kind'), 'empty'); assert.match(block(s).textContent, /Kein passendes Unraid-Gerät/);
  const ohne = require('./familie-attrappe.js').dockerFixture(); ohne.devices.delete('server');
  const d = dockerKarte({ device_id: '' }, { core: ohne }); assert.equal(block(d)?.getAttribute('data-kind'), 'empty'); assert.match(block(d).textContent, /Kein Unraid-Server gefunden/);
  const versteckt = dockerKarte({ hide_stopped: true });
  for (const e of versteckt._core.entities.values()) if (e.domain === 'switch') { e.state = 'off'; e.attributes.container_state = 'exited'; e.attributes.running_containers = 0; }
  versteckt._render(); assert.equal(block(versteckt)?.getAttribute('data-kind'), 'empty'); assert.match(block(versteckt).textContent, /ausgeblendet/);
});
