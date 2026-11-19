'use strict';
// M49 (#1299, P10/F13): an own update patches the live card instead of rebuilding it. Per card kind (tile, family,
// VM list, Docker): ha-icon elements stay the same objects, the value is updated, the focused element keeps focus,
// structural changes (row added/removed, stack opened) rebuild correctly, kept buttons run the latest handler, and the
// stylesheet is shared through adoptedStyleSheets (fallback: one <style> per root, kept across updates).
const test = require('node:test'), assert = require('node:assert/strict');
const { ladeKarte } = require('./laden.js');
const { dashboardFixture, inventoryFixture, familienKarte, dockerKarte, familienFixture } = require('./familie-attrappe.js');
const { unraidAttrappe } = require('./attrappe.js');

const icons = k => k.shadowRoot.querySelectorAll('ha-icon');
const karte = k => k.shadowRoot.querySelector('ha-card');
const gleicheIcons = (vorher, k, name) => { const jetzt = icons(k); assert.equal(jetzt.length, vorher.length, name + ': icon count'); jetzt.forEach((icon, i) => assert.equal(icon, vorher[i], `${name}: ha-icon ${i} kept`)); };

// One own update per tile kind: a value the tile shows changes (dashboard/inventory fixtures, see familie-attrappe.js).
const KACHELN = {
  BuschUnraidServerCard: c => { c.entities.get('sensor.demo_dashboard_hardware').attributes.registration = 'Example license 2'; },
  BuschUnraidSystemCard: c => { c.entities.get('sensor.demo_ram_percent').state = '61'; },
  BuschUnraidCpuCard: c => { c.entities.get('sensor.demo_cpu_percent').state = '55'; },
  BuschUnraidGpuCard: c => { c.entities.get('sensor.demo_gpu_util_0').state = '77'; },
  BuschUnraidArrayCard: c => { c.entities.get('sensor.demo_dashboard_storage').attributes.pools[0].used_bytes = 2 * 1024 ** 4; },
  BuschUnraidParityCard: c => { c.entities.get('sensor.demo_parity_progress').state = '61'; },
  BuschUnraidAirflowCard: c => { c.entities.get('sensor.demo_fan_cpu_rpm').state = '1500'; },
  BuschUnraidSharesCard: c => { c.entities.get('sensor.share_share_used_documents').state = '3'; },
  BuschUnraidVmUsageCard: c => { c.entities.get('sensor.demo_dashboard_vms').attributes.vms[0].host_cpu_percent = 12.5; },
  BuschUnraidInterfaceCard: c => { c.entities.get('sensor.demo_dashboard_interfaces').attributes.interfaces[0].rx_bytes_s = 4096; },
  BuschUnraidUsersCard: c => { c.entities.get('sensor.demo_dashboard_users').attributes.users[0].read_shares = 5; },
  BuschUnraidUsbCard: c => { c.entities.get('sensor.demo_dashboard_usb').attributes.devices[1].speed_mbps = 480; },
  BuschUnraidCoralCard: c => { c.entities.get('sensor.demo_dashboard_coral').attributes.devices[0].temperature_c = 47; },
};
function kachelFixture() { const core = inventoryFixture(); core.add('fan_cpu_rpm', 1200); return core; }
function kachel(name, core, zusatz) {
  const l = ladeKarte([name, 'UNRAID_TILE_STYLE'], zusatz), k = new l[name]();
  if (zusatz?.adopt) k.shadowRoot.adoptedStyleSheets = [];
  k._core = core; k._hass = { locale: { language: 'de' }, config: { time_zone: 'UTC' }, callService: async () => {} };
  k.setConfig({ device_id: 'demo', show_clock: false, show_history: false }); return { k, l };
}

test('M49 tile (CPU): own update keeps ha-icon objects and the focused toggle, updates the value', () => {
  const core = kachelFixture(), { k } = kachel('BuschUnraidCpuCard', core), vorher = icons(k), card = karte(k);
  const toggle = k.shadowRoot.querySelector('[data-focus-key="toggle"]'); toggle.focus();
  assert.match(card.textContent, /25 %/);
  KACHELN.BuschUnraidCpuCard(core); k._render();
  assert.match(karte(k).textContent, /55 %/, 'value updated'); assert.doesNotMatch(karte(k).textContent, /25 %/);
  assert.equal(karte(k), card, 'ha-card kept');
  gleicheIcons(vorher, k, 'cpu');
  assert.equal(k.shadowRoot.activeElement, toggle, 'focused toggle stays focused');
});

for (const [name, aendern] of Object.entries(KACHELN)) test(`M49 tile ${name}: own update renders and keeps every ha-icon object`, () => {
  const core = kachelFixture(), { k } = kachel(name, core), vorher = icons(k), signatur = k._signatur;
  assert.ok(vorher.length >= 2, name + ': head icon and collapse chevron');
  aendern(core); k._render();
  assert.notEqual(k._signatur, signatur, name + ': the change is an own update (render ran)');
  gleicheIcons(vorher, k, name);
});

test('M49 family (stack): own update keeps icons, row and focused row button; badge text follows', () => {
  // The stack badge loses its warning symbol (partial → running): compare every icon outside the status badges.
  const k = familienKarte('stack', { start_expanded: true }), ohneBadge = () => icons(k).filter(i => !String(i.parentNode.className).includes('status-badge')), vorher = ohneBadge();
  const zeile = id => k.shadowRoot.querySelectorAll('.row').find(r => r.dataset.entityId === id);
  const db = zeile('switch.other'), knopf = zeile('switch.renamed').querySelector('button'); knopf.focus();
  assert.match(db.textContent, /Gestoppt/);
  k._core.entities.get('switch.other').state = 'on'; k._render();
  assert.equal(zeile('switch.other'), db, 'row kept'); assert.doesNotMatch(db.textContent, /Gestoppt/, 'status text updated');
  assert.equal(ohneBadge().length, vorher.length); ohneBadge().forEach((icon, i) => assert.equal(icon, vorher[i], `stack: ha-icon ${i} kept`));
  assert.equal(k.shadowRoot.activeElement, knopf, 'focused row button stays focused');
});

test('M49 family (stack): a removed and re-added container row rebuilds in place and in order', () => {
  const k = familienKarte('stack', { start_expanded: true }), ids = () => k.shadowRoot.querySelectorAll('.row').map(r => r.dataset.entityId);
  const vorher = ids(), web = k.shadowRoot.querySelectorAll('.row').find(r => r.dataset.entityId === 'switch.renamed');
  assert.deepEqual(vorher.length, 2);
  const db = k._core.entities.get('switch.other'); k._core.entities.delete('switch.other'); k._render();
  assert.deepEqual(ids(), vorher.filter(id => id !== 'switch.other'), 'row removed');
  k._core.entities.set('switch.other', db); k._render();
  assert.deepEqual(ids(), vorher, 'row back at its position');
  assert.equal(k.shadowRoot.querySelectorAll('.row').find(r => r.dataset.entityId === 'switch.renamed'), web, 'untouched row kept');
});

test('M49 family (container): a kept control button runs the handler of the latest render', async () => {
  const k = familienKarte('container'), calls = []; k._hass.callService = async (...a) => { calls.push(a); };
  const knopf = () => k.shadowRoot.querySelector('[data-focus-key="control"]'), alt = knopf(), vorher = icons(k);
  assert.match(alt.textContent, /Stoppen/);
  k._core.entities.get('switch.renamed').state = 'off'; k._render();
  assert.equal(knopf(), alt, 'control button kept'); assert.match(alt.textContent, /Starten/);
  gleicheIcons(vorher, k, 'container');
  alt.click(); await new Promise(r => setImmediate(r));
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [['switch', 'turn_on', { entity_id: 'switch.renamed' }]]);
});

test('M49 VM list: own update keeps icons and the focused show-all button; value follows', () => {
  const { BuschUnraidVmCard } = ladeKarte(['BuschUnraidVmCard']), core = unraidAttrappe({ zweiteVm: true }), k = new BuschUnraidVmCard();
  k._core = core; k._hass = { locale: { language: 'de' }, states: {}, callService: async () => {} }; k.setConfig({ device_id: 'srv' });
  const vorher = icons(k), alle = k.shadowRoot.querySelector('[data-focus-key="show-all"]'); alle.focus();
  core.entities.get('sensor.win_cpu').state = '77'; k._render();
  assert.match(karte(k).textContent, /77 %/);
  gleicheIcons(vorher, k, 'vm list');
  assert.equal(k.shadowRoot.activeElement, alle);
});

test('M49 Docker: own update keeps tile, icons and focused tile button; status follows', () => {
  const k = dockerKarte(), vorher = icons(k), main = key => k.shadowRoot.querySelectorAll('.tile-main').find(b => b.dataset.key === key);
  const cache = main('container:cache'); cache.focus();
  const web = [...k._core.entities.values()].find(e => e.entity_id.startsWith('switch.webserver'));
  const tile = main('container:' + web.attributes.container_key), text = tile.querySelector('.tile-status-text').textContent;
  web.state = 'off'; web.attributes.container_state = 'exited'; k._render();
  assert.notEqual(tile.querySelector('.tile-status-text').textContent, text, 'status text updated');
  assert.equal(main(tile.dataset.key), tile, 'tile button kept');
  gleicheIcons(vorher, k, 'docker');
  assert.equal(k.shadowRoot.activeElement, cache, 'focused tile button stays focused');
});

test('M49 Docker: opening and closing a stack inserts and removes its child tiles in order', () => {
  const k = dockerKarte(), keys = () => k.shadowRoot.querySelectorAll('.tile').map(t => t.dataset.key);
  const stack = () => k.shadowRoot.querySelectorAll('.tile').find(t => t.dataset.key === 'stack:media'), vorher = keys(), alt = stack();
  k._toggle('stack:media');
  const offen = keys(), i = offen.indexOf('stack:media');
  assert.ok(offen.length > vorher.length, 'children inserted');
  assert.ok(offen.slice(i + 1, i + 4).every(key => key.startsWith('container:media')), 'children follow their stack: ' + offen.join());
  assert.equal(stack(), alt, 'stack tile kept');
  k._toggle('stack:media'); assert.deepEqual(keys(), vorher, 'children removed');
});

test('M49 styles: one shared constructed sheet via adoptedStyleSheets, no <style> element', () => {
  let erzeugt = 0;
  class CSSStyleSheet { constructor() { erzeugt++; } replaceSync(text) { this.text = text; } }
  const core = kachelFixture(), zusatz = { CSSStyleSheet, adopt: true };
  const l = ladeKarte(['BuschUnraidCpuCard', 'BuschUnraidGpuCard', 'UNRAID_TILE_STYLE'], zusatz);
  const neu = name => { const k = new l[name](); k.shadowRoot.adoptedStyleSheets = []; k._core = core; k._hass = { locale: { language: 'de' } }; k.setConfig({ device_id: 'demo', show_history: false }); return k; };
  const a = neu('BuschUnraidCpuCard'), b = neu('BuschUnraidGpuCard');
  for (const k of [a, b]) { assert.equal(k.shadowRoot.querySelector('style'), null, 'no <style> element'); assert.equal(k.shadowRoot.adoptedStyleSheets.length, 1); }
  assert.equal(a.shadowRoot.adoptedStyleSheets[0], b.shadowRoot.adoptedStyleSheets[0], 'one sheet shared by both cards');
  assert.equal(a.shadowRoot.adoptedStyleSheets[0].text, l.UNRAID_TILE_STYLE);
  KACHELN.BuschUnraidCpuCard(core); a._render(); assert.equal(erzeugt, 1, 'no new sheet on an own update');
});

test('M49 styles fallback: without adoptedStyleSheets one <style> stays the same object across updates', () => {
  const core = kachelFixture(), { k, l } = kachel('BuschUnraidCpuCard', core), style = k.shadowRoot.querySelector('style');
  assert.equal(style.textContent, l.UNRAID_TILE_STYLE);
  KACHELN.BuschUnraidCpuCard(core); k._render();
  assert.equal(k.shadowRoot.querySelectorAll('style').length, 1); assert.equal(k.shadowRoot.querySelector('style'), style);
});

test('M49 custom elements: own content and attributes of ha-icon/ha-card survive, attributes the card set are removed', () => {
  const core = kachelFixture(), { k } = kachel('BuschUnraidCpuCard', core), icon = icons(k)[0];
  // Like a self-rendering icon (render scripts, other themes): light DOM text and an own style attribute.
  icon.textContent = '◇'; icon.setAttribute('style', 'display:inline-grid'); karte(k).setAttribute('raised', '');
  KACHELN.BuschUnraidCpuCard(core); k._render();
  assert.equal(icon.textContent, '◇'); assert.equal(icon.getAttribute('style'), 'display:inline-grid'); assert.equal(karte(k).getAttribute('raised'), '');
  const d = dockerKarte(), card = karte(d); d._busy = true; d._render(); assert.equal(card.getAttribute('aria-busy'), 'true');
  d._busy = false; d._render(); assert.equal(karte(d), card); assert.equal(card.getAttribute('aria-busy'), null, 'aria-busy set by the card is removed');
});

// M49 step 2 (#1299): Intl formatters are built once and reused; an own update constructs none (before: one per number).
function zaehlIntl() {
  const z = { n: 0 }, zaehle = B => class extends B { constructor(...a) { super(...a); z.n++; } };
  return { z, Intl: { NumberFormat: zaehle(Intl.NumberFormat), DateTimeFormat: zaehle(Intl.DateTimeFormat), RelativeTimeFormat: zaehle(Intl.RelativeTimeFormat) } };
}
test('M49 Intl: an own update of every tile builds no new Intl formatter', () => {
  for (const [name, aendern] of Object.entries(KACHELN)) {
    const { z, Intl } = zaehlIntl(), core = kachelFixture(), { k } = kachel(name, core, { Intl });
    const text = karte(k).textContent; aendern(core); const n = z.n; k._render();
    assert.notEqual(karte(k).textContent, text, name + ': value updated');
    assert.equal(z.n - n, 0, name + ': Intl formatters built by the update');
  }
});
test('M49 Intl: an own update of stack and container cards builds no new Intl formatter', () => {
  const cpu = { entity_id: 'sensor.web_cpu', domain: 'sensor', device_id: 'stack', platform: 'unraid_ssh', config_entry_id: 'instance', state: '1.5', registry: {}, attributes: { kind: 'container', role: 'cpu', container_key: 'web', config_entry_id: 'instance' } };
  for (const [kind, config] of [['BuschUnraidStackCard', { device_id: 'stack', start_expanded: true }], ['BuschUnraidContainerCard', { device_id: 'stack', container_key: 'web' }]]) {
    const { z, Intl } = zaehlIntl(), l = ladeKarte([kind], { Intl }), k = new l[kind](), core = familienFixture().core, aendern = c => { c.entities.get('sensor.web_cpu').state = '9.5'; };
    core.entities.set(cpu.entity_id, structuredClone(cpu));
    k._core = core; k._hass = { locale: { language: 'de' }, config: { time_zone: 'UTC' }, callService: async () => {} }; k.setConfig(config);
    const text = karte(k).textContent; aendern(core); const n = z.n; k._render();
    assert.notEqual(karte(k).textContent, text, kind + ': value updated');
    assert.equal(z.n - n, 0, kind + ': Intl formatters built by the update');
  }
});
