'use strict';
const { ladeKarte } = require('./laden.js');
const { inventoryFixture } = require('./familie-attrappe.js');
function render(kind, core = inventoryFixture(), config = {}, language = 'de') {
  const name = `BuschUnraid${kind}Card`, card = new (ladeKarte([name])[name])();
  card._core = core; card.calls = []; card._hass = { locale: { language }, callService: (...args) => card.calls.push(args) };
  card.setConfig({ device_id: 'demo', ...config }); return card;
}
const text = card => card.shadowRoot.querySelector('ha-card').textContent;
const sensor = (core, kind) => core.entities.get('sensor.demo_dashboard_' + kind);
module.exports = { render, text, sensor, inventoryFixture };
