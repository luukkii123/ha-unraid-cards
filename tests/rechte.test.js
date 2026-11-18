'use strict';
// M16 (#1282): opt-in admin gate `admin_actions` and confirmation `confirm_update_all`, both off by default (E1).
// With the option a non-admin sees no action buttons for server, Docker and VM cards and no service call leaves the card,
// not even from a button rendered earlier for an admin. Card side only: unraid_ssh does not check admin rights (E2).
const test = require('node:test'), assert = require('node:assert/strict');
const { ladeKarte } = require('./laden.js');
const { unraidAttrappe } = require('./attrappe.js');
const { familienFixture, dockerFixture, dashboardFixture, ladeFamilie } = require('./familie-attrappe.js');
const { domMitHistory } = require('./dom-attrappe.js');

const hassVon = (admin, calls) => ({ locale: { language: 'de' }, user: { is_admin: admin }, callService: async (...args) => { calls.push(args); } });
// Buttons that change something; details/toggle/show-all only show or open information.
const AKTION = new Set(['control', 'restart', 'force-stop', 'update-all', 'update', 'mover_start', 'more']);
const aktionsKnoepfe = k => k.shadowRoot.querySelectorAll('button').filter(b => AKTION.has(b.dataset.focusKey));
const tick = () => new Promise(r => setImmediate(r));
// Values from the vm sandbox come from another realm: compare as JSON.
const same = (a, b, msg) => assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), msg);
const kachelKnoepfe = k => k.shadowRoot.querySelectorAll('button').filter(b => b.dataset.focusKey && b.dataset.focusKey !== 'toggle');

function familie(kind, config, admin) {
  const l = ladeFamilie(), { core } = familienFixture(), calls = [];
  const k = new (kind === 'stack' ? l.BuschUnraidStackCard : l.BuschUnraidContainerCard)();
  k._core = core; k._hass = hassVon(admin, calls);
  k.setConfig({ device_id: 'stack', ...(kind === 'container' ? { container_key: 'web' } : {}), confirm_stop: false, confirm_restart: false, ...config });
  return { k, calls, l };
}
function vmKarte(config, admin) {
  const { BuschUnraidVmCard } = ladeKarte(['BuschUnraidVmCard']), k = new BuschUnraidVmCard(), calls = [];
  k._core = unraidAttrappe(); k._hass = hassVon(admin, calls); k.setConfig({ confirm_stop: false, confirm_restart: false, ...config }); k._render();
  return { k, calls };
}
function docker(config, admin) {
  const l = ladeFamilie(), k = new l.BuschUnraidDockerCard(), calls = [];
  k._core = dockerFixture(); k._hass = hassVon(admin, calls); k.setConfig({ device_id: 'server', confirm_stop: false, confirm_restart: false, ...config });
  return { k, calls, l, t: l.TEXTE_BUSCH_UNRAID_DOCKER_CARD.de.texte };
}
function kachel(name, config, admin) {
  const env = domMitHistory(), { [name]: Klass } = ladeKarte([name], env), core = dashboardFixture({ second: true }), calls = [], k = new Klass();
  k._core = core; k._hass = hassVon(admin, calls); k.setConfig({ device_id: 'demo', show_clock: false, ...config });
  return { k, calls, env, core };
}
const flach = liste => liste.flatMap(a => a.menu ? a.menu : [a]);

for (const kind of ['stack', 'container']) {
  test(`${kind}: without admin_actions a non-admin keeps every button an admin sees`, () => {
    const admin = familie(kind, {}, true), user = familie(kind, {}, false);
    const keys = k => aktionsKnoepfe(k).map(b => b.dataset.focusKey);
    assert.ok(keys(admin.k).length > 0);
    same(keys(user.k), keys(admin.k));
  });
  test(`${kind}: admin_actions hides every action button for a non-admin and sends nothing`, async () => {
    const { k, calls, l } = familie(kind, { admin_actions: true }, false);
    assert.equal(aktionsKnoepfe(k).length, 0);
    assert.ok(k.shadowRoot.querySelector('[data-focus-key="details"]'), 'details stay');
    const m = l.context.buschUnraidModel(k._core, k._config, kind), rows = [m, m.selected, ...m.containers].filter(Boolean);
    for (const row of rows) for (const action of ['start', 'stop', 'restart', 'force_stop', 'update_all']) await k._action(action, row);
    assert.equal(calls.length, 0);
  });
  test(`${kind}: admin_actions leaves an admin unchanged`, () => {
    const admin = familie(kind, { admin_actions: true }, true), heute = familie(kind, {}, true);
    same(aktionsKnoepfe(admin.k).map(b => b.dataset.focusKey), aktionsKnoepfe(heute.k).map(b => b.dataset.focusKey));
  });
  test(`${kind}: a stale button from the admin render calls nothing after the switch to a non-admin`, async () => {
    const { k, calls } = familie(kind, { admin_actions: true }, true);
    const alt = aktionsKnoepfe(k).find(b => b.dataset.focusKey === 'control'); assert.ok(alt);
    k._hass = hassVon(false, calls); alt.click(); await tick();
    assert.equal(calls.length, 0);
    k._render(); assert.equal(aktionsKnoepfe(k).length, 0, 'the next render drops the buttons');
  });
}
test('stack: losing admin rights while the stop confirmation is open sends nothing', async () => {
  const { k, calls, l } = familie('stack', { admin_actions: true, confirm_stop: true }, true);
  l.context.unraidBestaetigen = async () => { k._hass = hassVon(false, calls); return true; };
  const m = l.context.buschUnraidModel(k._core, k._config, 'stack');
  await k._action('stop', m);
  assert.equal(calls.length, 0);
});

for (const config of [{ device_id: 'vm1' }, { device_id: 'srv' }]) {
  const art = config.device_id === 'srv' ? 'VM list' : 'single VM';
  test(`${art}: admin_actions hides start/shutdown/restart/force stop for a non-admin`, async () => {
    const heute = vmKarte(config, false), { k, calls } = vmKarte({ ...config, admin_actions: true }, false);
    assert.ok(aktionsKnoepfe(heute.k).length > 0, 'today a non-admin sees VM actions');
    assert.equal(aktionsKnoepfe(k).length, 0);
    for (const b of k.shadowRoot.querySelectorAll('button')) if (b.dataset.focusKey !== 'details') b.click(); // details only opens more-info
    await tick(); assert.equal(calls.length, 0);
  });
  test(`${art}: stale VM button sends nothing after the switch to a non-admin, admin sends once`, async () => {
    const { k, calls } = vmKarte({ ...config, admin_actions: true }, true);
    const knopf = () => aktionsKnoepfe(k).find(b => b.dataset.focusKey === 'control');
    const alt = knopf(); assert.ok(alt);
    k._hass = hassVon(false, calls); alt.click(); await tick();
    assert.equal(calls.length, 0);
    k._hass = hassVon(true, calls); k._render(); knopf().click(); await tick();
    assert.equal(calls.length, 1);
  });
}

test('docker: without admin_actions the menu of a non-admin is unchanged', () => {
  const user = docker({}, false), admin = docker({}, true);
  for (const row of admin.l.buschUnraidDockerModel(admin.k._core, admin.k._config).tiles)
    same(user.k._menuItems(row, user.t).map(i => i.key), admin.k._menuItems(row, admin.t).map(i => i.key));
});
test('docker: admin_actions leaves only toggle and details for a non-admin and sends nothing', async () => {
  const { k, calls, l, t } = docker({ admin_actions: true }, false), m = l.buschUnraidDockerModel(k._core, k._config);
  const rows = m.tiles.flatMap(r => [r, ...(r.containers || [])]);
  for (const row of rows) for (const item of k._menuItems(row, t)) assert.ok(['toggle', 'details'].includes(item.key), item.key);
  for (const row of rows) for (const action of ['start', 'stop', 'restart', 'update_all']) await k._action(action, row);
  assert.equal(calls.length, 0);
});
test('docker: stale menu item from the admin render sends nothing after the switch', async () => {
  const { k, calls, l, t } = docker({ admin_actions: true }, true), media = l.buschUnraidDockerModel(k._core, k._config).tiles.find(r => r.name === 'media');
  const stop = k._menuItems(media, t).find(i => i.key === 'stop'); assert.ok(stop);
  k._hass = hassVon(false, calls); stop.run(); await tick();
  assert.equal(calls.length, 0);
});

const SERVERKARTEN = { BuschUnraidServerCard: ['server_reboot', 'server_shutdown', 'mover_start'], BuschUnraidArrayCard: ['array_start', 'array_stop', 'spindown_all'], BuschUnraidParityCard: ['parity_start', 'parity_pause', 'parity_resume', 'parity_cancel'] };
for (const [name, keys] of Object.entries(SERVERKARTEN)) {
  test(`${name}: admin_actions shows a non-admin no action button and no menu`, () => {
    const heute = kachel(name, {}, false), { k } = kachel(name, { admin_actions: true }, false);
    assert.ok(kachelKnoepfe(heute.k).length > 0, 'today a non-admin sees server actions');
    assert.equal(kachelKnoepfe(k).length, 0);
    assert.equal(k.shadowRoot.querySelector('[data-focus-key="more"]'), null);
    assert.ok(k.shadowRoot.querySelector('[data-focus-key="toggle"]'), 'collapse stays');
  });
  test(`${name}: admin keeps every action with admin_actions`, () => {
    const { k, core } = kachel(name, { admin_actions: true }, true);
    same(flach(k._aktionen(k._modell(core, k._config), k._texte.de)).map(a => a.key).sort(), [...keys].sort());
    assert.ok(kachelKnoepfe(k).length > 0);
  });
  for (const key of keys) test(`${name} ${key}: stale action from the admin render opens no dialog and sends nothing`, async () => {
    const { k, core, calls, env } = kachel(name, { admin_actions: true }, true);
    const a = flach(k._aktionen(k._modell(core, k._config), k._texte.de)).find(x => x.key === key);
    k._hass = hassVon(false, calls);
    await k._ausfuehren(a, k._texte.de);
    assert.equal(env.document.body.lastChild, null, 'no confirmation dialog');
    await assert.rejects(a.ausfuehren({ generation: k._actionGeneration, serverId: 'demo' }));
    assert.equal(calls.length, 0);
  });
}
test('server: losing admin rights while the confirmation is open sends nothing', async () => {
  const { k, core, calls } = kachel('BuschUnraidServerCard', { admin_actions: true }, true);
  k._bestaetigen = async () => { k._hass = hassVon(false, calls); return true; };
  const a = flach(k._aktionen(k._modell(core, k._config), k._texte.de)).find(x => x.key === 'server_reboot');
  await k._ausfuehren(a, k._texte.de);
  assert.equal(calls.length, 0);
});

test('update all: no question by default, confirm_update_all asks and a refusal sends nothing', async () => {
  for (const [config, antwort, erwartet, fragen] of [[{}, false, 1, 0], [{ confirm_update_all: true }, false, 0, 1], [{ confirm_update_all: true }, true, 1, 1]]) {
    const { k, calls, l } = docker(config, true), gefragt = [];
    l.context.unraidBestaetigen = async (...args) => { gefragt.push(args); return antwort; };
    const media = l.buschUnraidDockerModel(k._core, k._config).tiles.find(r => r.name === 'media');
    await k._action('update_all', media);
    assert.equal(gefragt.length, fragen, JSON.stringify(config));
    if (fragen) assert.match(gefragt[0][1], /media/);
    assert.equal(calls.length, erwartet, JSON.stringify(config));
    if (erwartet) assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), ['button', 'press', { entity_id: 'button.stack_media_update_all' }]);
  }
});

test('options default to off and have an editor field with bilingual label and helper', () => {
  const l = ladeFamilie(), c = l.context;
  assert.equal(l.BUSCH_UNRAID_DOCKER_DEFAULTS.admin_actions, false); assert.equal(l.BUSCH_UNRAID_DOCKER_DEFAULTS.confirm_update_all, false);
  const { core } = familienFixture(), felder = kind => l.buschUnraidSchema(core, { device_id: 'stack' }, kind).map(f => f.name);
  for (const kind of ['stack', 'container', 'vm', 'docker']) assert.ok(felder(kind).includes('admin_actions'), kind);
  for (const kind of ['stack', 'docker']) assert.ok(felder(kind).includes('confirm_update_all'), kind);
  const woerter = vmContextWerte(c, ['TEXTE_BUSCH_UNRAID_STACK_CARD', 'TEXTE_BUSCH_UNRAID_CONTAINER_CARD', 'TEXTE_BUSCH_UNRAID_VM_CARD', 'TEXTE_BUSCH_UNRAID_DOCKER_CARD', 'TEXTE_BUSCH_UNRAID_SERVER_CARD', 'TEXTE_BUSCH_UNRAID_ARRAY_CARD', 'TEXTE_BUSCH_UNRAID_PARITY_CARD', 'SCHEMA_BUSCH_UNRAID_SERVER_CARD', 'SCHEMA_BUSCH_UNRAID_ARRAY_CARD', 'SCHEMA_BUSCH_UNRAID_PARITY_CARD', 'BuschUnraidServerCard', 'BuschUnraidArrayCard', 'BuschUnraidParityCard']);
  for (const name of ['STACK', 'CONTAINER', 'VM', 'DOCKER', 'SERVER', 'ARRAY', 'PARITY']) for (const lang of ['de', 'en']) {
    const t = woerter['TEXTE_BUSCH_UNRAID_' + name + '_CARD'][lang];
    assert.ok(t.labels.admin_actions, name + lang); assert.match(t.helpers.admin_actions, /(Vorgabe|Default|default).*\.$/, name + lang);
    if (['STACK', 'DOCKER'].includes(name)) { assert.ok(t.labels.confirm_update_all, name + lang); assert.ok(t.helpers.confirm_update_all, name + lang); }
  }
  for (const name of ['SERVER', 'ARRAY', 'PARITY']) {
    assert.ok(woerter['SCHEMA_BUSCH_UNRAID_' + name + '_CARD'].some(f => f.name === 'admin_actions'), name);
    const Karte = woerter['BuschUnraid' + name[0] + name.slice(1).toLowerCase() + 'Card'];
    assert.equal(new Karte()._vorgaben.admin_actions, false, name);
  }
});
function vmContextWerte(context, namen) { return require('node:vm').runInContext(`({${namen.join(',')}})`, context); }
