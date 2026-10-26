'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { ladeKarte } = require('./laden.js'); const { dashboardFixture } = require('./familie-attrappe.js'); const { domMitHistory } = require('./dom-attrappe.js');
const actions = { BuschUnraidServerCard: ['server_reboot','server_shutdown','mover_start'], BuschUnraidArrayCard: ['array_start','array_stop','spindown_all'], BuschUnraidParityCard: ['parity_start','parity_pause','parity_resume','parity_cancel'] };
function setup(name) { const env = domMitHistory(); const { [name]: Klass } = ladeKarte([name], env); const core = dashboardFixture({ second: true }), calls = [], k = new Klass(); k._core = core; k._hass = { locale: { language: 'de' }, callService: async (...args) => calls.push(args) }; k.setConfig({ device_id: 'demo', show_clock: false, confirm_stop: false, confirm_restart: false }); return { k, core, calls, env }; }
const tick = () => new Promise(r => setImmediate(r));
for (const [name, list] of Object.entries(actions)) for (const key of list) test(`${key}: close X cancels without dispatch and restores the current opener after telemetry`, async () => {
  const { k, core, calls, env } = setup(name);
  const old = k.shadowRoot.querySelector(`[data-focus-key="${key}"]`); old.focus(); env.document.activeElement = k;
  const action = k._aktionen(k._modell(core, k._config), k._texte.de).find(a => a.key === key);
  const pending = k._ausfuehren(action, k._texte.de), dialog = env.document.body.lastChild;
  assert.equal(dialog.shadowRoot.activeElement, dialog._abbr);
  old.blur(); core.entities.get('sensor.demo_cpu_percent').state = '34'; k._render();
  const current = k.shadowRoot.querySelector(`[data-focus-key="${key}"]`);
  assert.ok(current, 'telemetry preserves the action opener');
  assert.notEqual(current, old);
  const close = dialog.shadowRoot.querySelector('.close'); assert.ok(close, 'real close X'); close.click(); close.click();
  await pending;
  assert.equal(calls.length, 0); assert.equal(k._busy, false);
  const restored = k.shadowRoot.querySelector(`[data-focus-key="${key}"]`);
  assert.ok(restored, 'the completed cancellation leaves a focusable opener');
  assert.notEqual(restored, old, 'focus returns to the rendered opener, not its detached original');
  assert.equal(k.shadowRoot.activeElement, restored);
  assert.equal(dialog.isConnected, false);
  assert.equal(env.history.length, 1); assert.equal(env.history.backs, 1);
  assert.equal(env.document.listeners.keydown.length, 0); assert.equal(env.window.listeners.popstate.length, 0);
  assert.equal(k.shadowRoot.querySelector('[role="status"]'), null);
});
for (const [name, list] of Object.entries(actions)) for (const key of list) test(`${key}: always confirmed, cancel sends zero, double confirm sends exactly its own button`, async () => { const { k, calls, env } = setup(name); const t = k._texte.de; const model = k._modell(k._core, k._config); const a = k._aktionen(model, t).find(x => x.key === key); assert.ok(a, key); assert.match(a.bestaetigen, /Example server/); assert.ok(a.bestaetigen.length > 'Example server'.length + 10); const p = k._ausfuehren(a, t); const d = env.document.body.lastChild; assert.ok(d, 'real confirmation dialog opened'); d._scrim.click(); assert.ok(d.isConnected); d._abbr.click(); await p; assert.equal(calls.length, 0); const esc = k._ausfuehren(a, t); env.document.body.lastChild.dispatchEvent(new env.KeyboardEvent('keydown', { key: 'Escape' })); await esc; await new Promise(r => setTimeout(r)); assert.equal(calls.length, 0); const back = k._ausfuehren(a, t); env.history.back(); await back; assert.equal(calls.length, 0); const q = k._ausfuehren(a, t); const dialog = env.document.body.lastChild; dialog._ok.click(); dialog._ok.click(); await Promise.all([q, k._ausfuehren(a, t)]); assert.deepEqual(calls.map(x => JSON.parse(JSON.stringify(x))), [['button', 'press', { entity_id: 'button.demo_' + key }]]); assert.match(k.shadowRoot.textContent, /Anfrage gesendet.*prüfen/s); });
test('Unavailable, disabled, wrong-domain and missing buttons are never dispatched or guessed', () => { const { k, core } = setup('BuschUnraidServerCard'); const e = core.entities.get('button.demo_server_reboot'); e.state = 'unavailable'; core.entities.get('button.demo_server_shutdown').registry.disabled_by = 'user'; core.entities.delete('button.demo_mover_start'); core.add('mover_start', 'ok'); const a = k._aktionen(k._modell(core, k._config), k._texte.de); assert.ok(a.every(x => x.deaktiviert)); });
test('Server timeout sends once, shows uncertain result, never claims success or retries', async () => { const { k, calls } = setup('BuschUnraidServerCard'); k._hass.callService = async (...a) => { calls.push(a); throw new Error('Timeout after send'); }; k._bestaetigen = async () => true; const a = k._aktionen(k._modell(k._core, k._config), k._texte.de).find(x => x.key === 'server_shutdown'); await k._ausfuehren(a, k._texte.de); assert.equal(calls.length, 1); assert.match(k.shadowRoot.textContent, /nicht bestätigt.*Verbindung.*prüfen/s); assert.doesNotMatch(k.shadowRoot.querySelector('ha-card').textContent, /erfolgreich/); });
test('Paused parity has its own state and does not claim idle', () => { const { k } = setup('BuschUnraidParityCard'); assert.match(k.shadowRoot.querySelector('ha-card').textContent, /pausiert/); assert.doesNotMatch(k.shadowRoot.querySelector('ha-card').textContent, /Keine Prüfung aktiv/); });

test('Changing selected server during confirmation cannot send a command or show old feedback', async () => { const { k, calls, env } = setup('BuschUnraidServerCard'); const a = k._aktionen(k._modell(k._core, k._config), k._texte.de).find(x => x.key === 'server_reboot'); const pending = k._ausfuehren(a, k._texte.de); k.setConfig({device_id:'other',show_clock:false}); env.document.body.lastChild._ok.click(); await pending; assert.equal(calls.length,0); assert.doesNotMatch(k.shadowRoot.querySelector('ha-card').textContent,/nicht bestätigt|Anfrage gesendet/); });
test('Switching server while a sent request is pending cannot show completion feedback on the new server', async () => { const { k, calls } = setup('BuschUnraidServerCard'); let done; k._hass.callService = async (...args) => { calls.push(args); await new Promise(r => { done = r; }); }; k._bestaetigen = async () => true; const a = k._aktionen(k._modell(k._core,k._config),k._texte.de).find(x => x.key === 'server_reboot'); const pending = k._ausfuehren(a,k._texte.de); await tick(); k.setConfig({device_id:'other',show_clock:false}); done(); await pending; assert.equal(calls.length,1); assert.doesNotMatch(k.shadowRoot.querySelector('ha-card').textContent,/Anfrage gesendet/); });
test('Changing the selected server clears feedback from the previous target', async () => { const { k } = setup('BuschUnraidServerCard'); k._bestaetigen = async () => true; const a = k._aktionen(k._modell(k._core,k._config),k._texte.de).find(x => x.key === 'server_reboot'); await k._ausfuehren(a,k._texte.de); k.setConfig({device_id:'other',show_clock:false}); assert.doesNotMatch(k.shadowRoot.querySelector('ha-card').textContent,/Anfrage gesendet/); });
test('Cancel restores the opener after telemetry rebuilt the card while the modal owned focus', async () => { const { k, core, calls, env } = setup('BuschUnraidServerCard'); const old = k.shadowRoot.querySelector('[data-focus-key="server_reboot"]'); old.focus(); const a = k._aktionen(k._modell(core,k._config),k._texte.de).find(x => x.key === 'server_reboot'); const pending = k._ausfuehren(a,k._texte.de); old.blur(); core.entities.get('sensor.demo_cpu_percent').state='26'; k._render(); assert.notEqual(k.shadowRoot.querySelector('[data-focus-key="server_reboot"]'),old); env.document.body.lastChild._abbr.click(); await pending; assert.equal(calls.length,0); assert.equal(k.shadowRoot.activeElement?.dataset.focusKey,'server_reboot'); });

for (const state of ['unavailable', 'unknown']) for (const phase of ['idle', 'paused', 'running']) {
  test(`Parity ${state} ignores retained ${phase} while main sensors remain available`, () => {
    const { k, core } = setup('BuschUnraidParityCard');
    const parity = core.entities.get('binary_sensor.demo_parity_running');
    parity.state = state; parity.attributes.state = phase; k._render();
    assert.match(k.shadowRoot.querySelector('.tile-sub').textContent, /Unbekannt/);
    assert.match(k.shadowRoot.querySelector('.dot-text').textContent, /Unbekannt/);
    assert.equal(k.shadowRoot.querySelector('.bar'), null, 'no stale progress');
  });
}

for (const change of ['server', 'roundtrip', 'auto', 'auto-roundtrip']) for (const result of ['resolve', 'reject']) {
  test(`Pending server request ${result} has no stale feedback after ${change} context change`, async () => {
    const { k, core, calls } = setup('BuschUnraidServerCard');
    if (change.startsWith('auto')) { core.devices.delete('other'); k.setConfig({ device_id: '', show_clock: false }); }
    let finish;
    k._hass.callService = (...args) => { calls.push(args); return new Promise((resolve, reject) => { finish = result === 'reject' ? () => reject(new Error('Synthetic timeout')) : resolve; }); };
    k._bestaetigen = async () => true;
    const action = k._aktionen(k._modell(core, k._config), k._texte.de).find(a => a.key === 'server_reboot');
    const pending = k._ausfuehren(action, k._texte.de); await tick();
    if (change.startsWith('auto')) {
      const original = core.devices.get('demo');
      core.devices.set('other', { id: 'other', name: 'Other example', model: 'Unraid', config_entries: ['other-entry'] });
      core.devices.delete('demo'); k._render();
      if (change === 'auto-roundtrip') { core.devices.delete('other'); core.devices.set('demo', original); k._render(); }
    } else {
      k.setConfig({ device_id: 'other', show_clock: false });
      if (change === 'roundtrip') k.setConfig({ device_id: 'demo', show_clock: false });
    }
    finish(); await pending;
    assert.deepEqual(calls.map(args => JSON.parse(JSON.stringify(args))), [['button', 'press', { entity_id: 'button.demo_server_reboot' }]]);
    assert.equal(k.shadowRoot.querySelector('[role="alert"]'), null);
    assert.equal(k.shadowRoot.querySelector('[role="status"]'), null);
    assert.equal(k._busy, false);
  });
}

for (const selection of ['selected', 'auto']) for (const result of ['resolve', 'reject']) {
  test(`Confirmation roundtrip with ${selection} selection keeps dispatch ${result} feedback`, async () => {
    const { k, core, calls, env } = setup('BuschUnraidServerCard');
    const original = core.devices.get('demo'), other = core.devices.get('other');
    if (selection === 'auto') { core.devices.delete('other'); k.setConfig({ device_id: '', show_clock: false }); }
    let finish;
    k._hass.callService = (...args) => { calls.push(args); return new Promise((resolve, reject) => { finish = result === 'reject' ? () => reject(new Error('Synthetic timeout')) : resolve; }); };
    const action = k._aktionen(k._modell(core, k._config), k._texte.de).find(a => a.key === 'server_reboot');
    const pending = k._ausfuehren(action, k._texte.de);
    if (selection === 'auto') {
      core.devices.delete('demo'); core.devices.set('other', other); k._render();
      core.devices.delete('other'); core.devices.set('demo', original); k._render();
    } else {
      k.setConfig({ device_id: 'other', show_clock: false });
      k.setConfig({ device_id: 'demo', show_clock: false });
    }
    assert.equal(calls.length, 0, 'no dispatch while confirmation is open');
    env.document.body.lastChild._ok.click(); await tick();
    assert.deepEqual(calls.map(args => JSON.parse(JSON.stringify(args))), [['button', 'press', { entity_id: 'button.demo_server_reboot' }]]);
    finish(); await pending;
    if (result === 'reject') {
      assert.match(k.shadowRoot.querySelector('[role="alert"]')?.textContent || '', /nicht bestätigt.*Verbindung.*prüfen/s);
      assert.equal(k.shadowRoot.querySelector('[role="status"]'), null);
    } else {
      assert.match(k.shadowRoot.querySelector('[role="status"]')?.textContent || '', /Anfrage gesendet.*prüfen/s);
      assert.equal(k.shadowRoot.querySelector('[role="alert"]'), null);
    }
    assert.equal(calls.length, 1, 'no automatic retry');
    assert.equal(k._busy, false);
  });
}

test('Auto-selection changing during confirmation cannot dispatch the previous server button', async () => {
  const { k, core, calls, env } = setup('BuschUnraidServerCard');
  const other = core.devices.get('other'); core.devices.delete('other');
  k.setConfig({ device_id: '', show_clock: false });
  const action = k._aktionen(k._modell(core, k._config), k._texte.de).find(a => a.key === 'server_reboot');
  const pending = k._ausfuehren(action, k._texte.de);
  core.devices.delete('demo'); core.devices.set('other', other); k._render();
  env.document.body.lastChild._ok.click(); await pending;
  assert.equal(calls.length, 0);
  assert.equal(k.shadowRoot.querySelector('[role="alert"]'), null);
  assert.equal(k.shadowRoot.querySelector('[role="status"]'), null);
  assert.equal(k._busy, false);
});

for (const state of [undefined, null, 'unavailable', 'unknown']) {
  test(`Confirmation rechecks button state ${String(state)} before dispatch`, async () => {
    const { k, core, calls, env } = setup('BuschUnraidServerCard');
    const action = k._aktionen(k._modell(core, k._config), k._texte.de).find(a => a.key === 'server_reboot');
    const pending = k._ausfuehren(action, k._texte.de);
    core.entities.get('button.demo_server_reboot').state = state;
    env.document.body.lastChild._ok.click(); await pending;
    assert.equal(calls.length, state === 'unknown' ? 1 : 0);
  });
}
