'use strict';
// M19 (#1282, S5): every card of the bundle rendered with XSS payloads in each displayed text field (device names,
// container/stack/VM names, image, update errors, queue target, raw states, dashboard lists, users, USB, Coral). The cards
// build their DOM with textContent only; the payload must arrive literally as text and activeMarkup must stay empty.
// Known, intended elements: the picture <img> of BuschUI.media inside .busch-media (src from the URL allowlist, never
// javascript:) and the constant gauge/line <svg> of unraidRing (figure.ring) and unraidLinie (svg.line). Nothing else.
const test = require('node:test'), assert = require('node:assert/strict');
const { XSS_PAYLOADS, activeMarkup } = require('./_testkit.cjs');
const { ladeKarte } = require('./laden.js');
const { unraidAttrappe } = require('./attrappe.js');
const { familienFixture, dockerFixture, inventoryFixture, ladeFamilie } = require('./familie-attrappe.js');
const { domMitHistory } = require('./dom-attrappe.js');

// Attribute keys whose string values a card shows (or may show) as text; joins and roles stay untouched.
const TEXTFELDER = new Set(['name', 'description', 'product_name', 'board_vendor', 'board_name', 'board_version', 'bios_vendor', 'bios_version', 'bios_date', 'cpu_model', 'registration', 'driver_version', 'filesystem', 'members', 'model', 'remote_host', 'assigned_vm', 'port', 'field', 'label', 'friendly_name', 'container_name', 'stack_name', 'stack_display_name', 'vm_name', 'image', 'last_error', 'current_target']);
// Raw states shown when the card has no translation for them.
const ROHZUSTAENDE = /array_state|disk_status|vm_state/;

function vergiften(core, payload) {
  const tief = (wert, key) => {
    // friendly_name as suffix: cards strip a leading device name, a prefix would vanish with it.
    if (typeof wert === 'string') return !TEXTFELDER.has(key) ? wert : key === 'friendly_name' ? wert + ' ' + payload : payload + wert;
    if (Array.isArray(wert)) return wert.map(v => (typeof v === 'string' ? (TEXTFELDER.has(key) ? payload + v : v) : tief(v, key)));
    if (wert && typeof wert === 'object') { for (const k of Object.keys(wert)) wert[k] = tief(wert[k], k); return wert; }
    return wert;
  };
  for (const d of core.devices.values()) { d.name = payload + d.name; if (d.name_by_user) d.name_by_user = payload + d.name_by_user; }
  for (const e of core.entities.values()) {
    tief(e.attributes || {}, '');
    if (e.stateObject?.attributes && e.stateObject.attributes !== e.attributes) tief(e.stateObject.attributes, '');
    if (ROHZUSTAENDE.test(e.entity_id) && e.domain === 'sensor') { e.state = payload; if (e.stateObject) e.stateObject.state = payload; }
  }
  return core;
}

function elementeIn(root, tag) {
  const treffer = [], gehe = n => { if (String(n.tagName).toUpperCase() === tag) treffer.push(n); for (const c of n.childNodes || []) gehe(c); if (n.shadowRoot) gehe(n.shadowRoot); };
  gehe(root); return treffer;
}
const bilderIn = root => elementeIn(root, 'IMG');
const klassen = n => String(n?.className || n?.getAttribute?.('class') || '').split(/\s+/);
function textIn(root) {
  const teile = [], gehe = n => { if (n._text) teile.push(n._text); if (n.title) teile.push(n.title); for (const v of Object.values(n.attributes || {})) teile.push(String(v)); for (const c of n.childNodes || []) gehe(c); if (n.shadowRoot) gehe(n.shadowRoot); };
  gehe(root); return teile.join('\n');
}
function sauber(root, payload, wo, { text = true } = {}) {
  const funde = activeMarkup(root);
  const bilder = bilderIn(root).filter(b => klassen(b.parentNode).includes('busch-media') && !/^\s*javascript:/i.test(b.getAttribute('src') || ''));
  const grafiken = elementeIn(root, 'SVG').filter(g => klassen(g.parentNode).includes('ring') || klassen(g).includes('line'));
  assert.deepEqual(funde.filter(f => f !== 'img' && f !== 'svg'), [], `${wo}: active markup`);
  assert.equal(funde.filter(f => f === 'img').length, bilder.length, `${wo}: only BuschUI.media pictures with allowed src`);
  assert.equal(funde.filter(f => f === 'svg').length, grafiken.length, `${wo}: only the constant ring/line graphics`);
  if (text) assert.ok(textIn(root).includes(payload), `${wo}: payload not rendered as literal text, test would be vacuous`);
}
// Names that the integration only carries in unique_ids (share, disk, VM): one extra device each with a payload name.
function rohnamen(core, payload) {
  const geraet = (id, name, model) => core.devices.set(id, { id, name: 'Example server ' + name, name_by_user: null, model, manufacturer: 'Lime Technology', config_entries: ['example-entry'], via_device_id: 'demo' });
  geraet('xshare', 'Share ' + payload, 'Unraid share'); core.add('share_used_' + payload, 1, { unit_of_measurement: 'GiB' }, 'xshare'); core.add('share_free_' + payload, 3, { unit_of_measurement: 'GiB' }, 'xshare');
  geraet('xdisk', 'disk ' + payload, 'Data disk'); core.add('disk_status_' + payload, 'ok', {}, 'xdisk'); core.add('disk_usage_' + payload, 10, {}, 'xdisk');
  geraet('xvm', 'VM ' + payload, 'Virtual machine'); core.add('vm_state_' + payload, 'running', {}, 'xvm'); core.add('vm_cpu_' + payload, 5, {}, 'xvm');
  return core;
}
const hassMit = calls => ({ locale: { language: 'de' }, user: { is_admin: true }, config: { time_zone: 'Europe/Berlin' }, states: {}, callService: async (...a) => { calls.push(a); } });

const KACHELN = ['Server', 'System', 'Cpu', 'Gpu', 'Array', 'Parity', 'Airflow', 'Shares', 'VmUsage', 'Interface', 'Users', 'Usb', 'Coral'];

XSS_PAYLOADS.forEach((payload, nr) => {
  for (const art of KACHELN) test(`payload ${nr} in every text field: ${art} tile renders it as text only`, async () => {
    const env = domMitHistory(), name = `BuschUnraid${art}Card`, { [name]: Karte } = ladeKarte([name], env), k = new Karte(), calls = [];
    // Airflow needs fans, which only the dashboard-free fixture has.
    const airflow = art === 'Airflow';
    k._core = airflow ? vergiften(unraidAttrappe(), payload) : rohnamen(vergiften(inventoryFixture(), payload), payload);
    k._hass = hassMit(calls); k.setConfig({ device_id: airflow ? 'srv' : 'demo' });
    // Parity has no free text of its own; its server name shows in the confirmation dialog checked below.
    sauber(k.shadowRoot, payload, art, { text: art !== 'Parity' });
    const t = k._texte.de, aktionen = k._modell ? (k._aktionen(k._modell(k._core, k._config), t) || []).flatMap(a => a.menu || [a]) : [];
    for (const a of aktionen) {
      const offen = k._ausfuehren(a, t); sauber(env.document.body, payload, `${art} ${a.key} dialog`);
      env.document.body.lastChild._abbr.click(); await offen;
    }
    assert.equal(calls.length, 0);
  });

  test(`payload ${nr}: server menu and confirmation dialog show the server name as text only`, async () => {
    const env = domMitHistory(), { BuschUnraidServerCard } = ladeKarte(['BuschUnraidServerCard'], env), k = new BuschUnraidServerCard(), calls = [];
    k._core = vergiften(inventoryFixture(), payload); k._hass = hassMit(calls); k.setConfig({ device_id: 'demo' });
    k.shadowRoot.querySelector('[data-focus-key="more"]').click();
    sauber(env.document.body, payload, 'server menu');
    const t = k._texte.de, a = k._aktionen(k._modell(k._core, k._config), t).find(x => x.key === 'mover_start');
    const offen = k._ausfuehren(a, t); sauber(env.document.body, payload, 'confirmation');
    env.document.body.lastChild._abbr.click(); await offen;
    assert.equal(calls.length, 0);
  });

  test(`payload ${nr}: stack and container cards (names, image, update error, queue target) render text only`, () => {
    const core = vergiften(dockerFixture(), payload), l = ladeFamilie();
    const media = core.entities.get('button.stack_media_update_all');
    media.attributes.update_queue = { active: true, completed_count: 1, total_count: 3, failed_count: 0, queued_count: 2, current_target: payload + 'media-db', blocked: false };
    const update = core.entities.get('update.media'); Object.assign(update.attributes, { update_state: 'failed', last_error: payload + 'pull failed' });
    for (const [Karte, config] of [[l.BuschUnraidStackCard, { device_id: 'media' }], [l.BuschUnraidContainerCard, { device_id: 'media', container_key: 'media' }], [l.BuschUnraidContainerCard, { device_id: 'solo' }]]) {
      const k = new Karte(); k._core = core; k._hass = hassMit([]); k.setConfig(config);
      sauber(k.shadowRoot, payload, JSON.stringify(config));
    }
    const { core: familie } = familienFixture(); vergiften(familie, payload);
    const k = new l.BuschUnraidStackCard(); k._core = familie; k._hass = hassMit([]); k.setConfig({ device_id: 'stack' });
    sauber(k.shadowRoot, payload, 'family stack');
  });

  test(`payload ${nr}: docker card tiles and tile menu render text only`, () => {
    const l = ladeFamilie(), k = new l.BuschUnraidDockerCard(); k._core = vergiften(dockerFixture(), payload); k._hass = hassMit([]); k.setConfig({ device_id: 'server', start_expanded: true });
    sauber(k.shadowRoot, payload, 'docker');
    const row = l.buschUnraidDockerModel(k._core, k._config).tiles.find(r => r.type === 'stack');
    k._openMenu(row, k.shadowRoot.querySelector('.tile-main'));
    sauber(l.body, payload, 'docker menu');
  });

  for (const device_id of ['vm1', 'srv']) test(`payload ${nr}: VM card (${device_id === 'srv' ? 'list' : 'single'}) renders VM and server names as text only`, () => {
    const { BuschUnraidVmCard } = ladeKarte(['BuschUnraidVmCard']), k = new BuschUnraidVmCard();
    k._core = vergiften(unraidAttrappe({ zweiteVm: true }), payload); k._hass = hassMit([]); k.setConfig({ device_id, show_all: true }); k._render();
    sauber(k.shadowRoot, payload, 'vm ' + device_id);
  });
});

test('picture URLs with a script scheme never reach an <img>', () => {
  const l = ladeFamilie(), core = dockerFixture();
  for (const e of core.entities.values()) if (e.attributes.entity_picture) e.attributes.entity_picture = 'javascript:alert(1)';
  const k = new l.BuschUnraidDockerCard(); k._core = core; k._hass = hassMit([]); k.setConfig({ device_id: 'server' });
  assert.equal(bilderIn(k.shadowRoot).length, 0);
  assert.deepEqual(activeMarkup(k.shadowRoot), []);
});
