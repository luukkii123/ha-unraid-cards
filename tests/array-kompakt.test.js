'use strict';
// M64 (#1317, W16): array/pool disks as compact rows (phone: one line per disk with a details toggle; desktop: one fixed
// table layout with the same colgroup for every group), pool facts below the pool heading in the table's type step, the
// "additional data" hint as .busch-notice.
const test = require('node:test'), assert = require('node:assert/strict');
const { ladeKarte } = require('./laden.js');
const { unraidAttrappe } = require('./attrappe.js');
const { dashboardFixture } = require('./familie-attrappe.js');

const K = ladeKarte(['BuschUnraidArrayCard', 'BuschUnraidSystemCard', 'UNRAID_TILE_STYLE']);
function array(core = unraidAttrappe(), config = {}) { const k = new K.BuschUnraidArrayCard(); k._core = core; k._hass = { locale: { language: 'de' }, user: { is_admin: true }, callService: async () => {} }; k.setConfig({ device_id: '', ...config }); k._render(); return k; }
const tabellen = k => k.shadowRoot.querySelectorAll('table').filter(t => /\bdisks\b/.test(t.className));
const spalten = t => t.childNodes.find(n => n.tagName === 'COLGROUP')?.childNodes.map(c => c.className);

test('M64 every disk group is one .disks table with the same colgroup (fixed layout on desktop)', () => {
  const k = array(), liste = tabellen(k);
  assert.equal(liste.length, 4, 'array, cache, raid, boot');
  const erste = spalten(liste[0]); assert.ok(erste && erste.length >= 4, 'colgroup'); for (const t of liste) assert.deepEqual(spalten(t), erste, 'same columns in every group');
  assert.equal(liste[0].childNodes[0].tagName, 'COLGROUP', 'colgroup first');
  assert.match(K.UNRAID_TILE_STYLE, /@container \(min-width:421px\)\{[^@]*\.table\.disks\{table-layout:fixed/);
  assert.match(K.UNRAID_TILE_STYLE, /@container \(max-width:420px\)\{[^@]*\.table\.disks tr\{display:grid;grid-template-columns:/, 'phone: one grid line per disk');
});

test('M64 phone details: a toggle per disk opens the SMART line, named after the disk, state kept across renders', () => {
  const k = array(), zeile = () => k.shadowRoot.querySelectorAll('tr').find(r => r.querySelector('td')?.textContent === 'disk1');
  const knopf = () => zeile().querySelector('.disk-more-btn');
  assert.ok(knopf(), 'details toggle'); assert.equal(knopf().getAttribute('aria-expanded'), 'false'); assert.match(knopf().getAttribute('aria-label'), /disk1/);
  assert.match(knopf().className, /\bbusch-btn\b/);
  assert.doesNotMatch(zeile().className, /\boffen\b/);
  knopf().click(); assert.equal(knopf().getAttribute('aria-expanded'), 'true'); assert.match(zeile().className, /\boffen\b/);
  k._signatur = null; k._render(); assert.match(zeile().className, /\boffen\b/, 'open state survives a render');
  knopf().click(); assert.doesNotMatch(zeile().className, /\boffen\b/);
  const ohne = array(unraidAttrappe(), { visible_items: ['array', 'pools', 'boot'] });
  assert.equal(ohne.shadowRoot.querySelector('.disk-more-btn'), null, 'without the SMART column no details toggle');
});

test('M64 pool facts follow the pool heading as key/value rows; the hint is a notice', () => {
  const k = array(dashboardFixture(), { device_id: 'demo' }), body = k.shadowRoot.querySelector('.tile-body'), kinder = body.childNodes;
  const fakten = kinder.findIndex(n => /\bpool-facts\b/.test(n.className)); assert.ok(fakten > 0, 'pool facts');
  assert.equal(kinder[fakten - 1].tagName, 'H3', 'pool heading directly above its facts'); assert.match(kinder[fakten - 1].textContent, /fast-storage/);
  const kv = kinder[fakten].querySelectorAll('.busch-kv'); assert.equal(kv.length, 4);
  assert.deepEqual(kv.map(n => n.querySelector('.busch-kv-key').textContent), ['Poolzustand', 'Dateisystem', 'Mitglieder', 'Frei']);
  for (const card of [array(), (() => { const s = new K.BuschUnraidSystemCard(); s._core = unraidAttrappe(); s._hass = { locale: { language: 'de' } }; s.setConfig({ show_clock: false }); s._render(); return s; })()]) {
    const n = card.shadowRoot.querySelector('.busch-notice'); assert.ok(n, 'notice'); assert.equal(n.getAttribute('data-tone'), 'info');
    assert.equal(n.querySelector('.busch-notice-icon').getAttribute('aria-hidden'), 'true'); assert.match(n.querySelector('.busch-notice-text').textContent, /Unraid SSH.*0\.9/);
    assert.equal(card.shadowRoot.querySelectorAll('.message').filter(m => /Zusatzdaten/.test(m.textContent)).length, 0, 'no plain message line');
  }
});
