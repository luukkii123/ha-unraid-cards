'use strict';
// M61 (#1317, W11): one card header for all 17 cards (BuschUI.header level 1: --ha-card-header-font-size, medium) and one
// level-2 step for section headings (BuschUI.sectionHeading); the family CSS no longer sets its own title typography.
const test = require('node:test'), assert = require('node:assert/strict');
const { ladeKarte } = require('./laden.js');
const { inventoryFixture, familienKarte, dockerKarte } = require('./familie-attrappe.js');
const { unraidAttrappe } = require('./attrappe.js');

const KACHELN = ['BuschUnraidServerCard', 'BuschUnraidSystemCard', 'BuschUnraidCpuCard', 'BuschUnraidGpuCard', 'BuschUnraidArrayCard',
  'BuschUnraidParityCard', 'BuschUnraidAirflowCard', 'BuschUnraidSharesCard', 'BuschUnraidVmUsageCard', 'BuschUnraidInterfaceCard',
  'BuschUnraidUsersCard', 'BuschUnraidUsbCard', 'BuschUnraidCoralCard'];
const K = ladeKarte([...KACHELN, 'BuschUnraidVmCard', 'BUSCH_UNRAID_STYLE', 'UNRAID_TILE_STYLE', 'UNRAID_FAMILIE_STYLE', 'BuschUI']);
function kachel(name, core, config = {}) { const k = new K[name](); k._core = core; k._hass = { locale: { language: 'de' }, config: { time_zone: 'UTC' }, callService: async () => {} }; k.setConfig({ device_id: 'demo', show_clock: false, show_history: false, ...config }); k._render(); return k; }

test('M61 all 17 cards: title through BuschUI.header level 1 in a labelled header group', () => {
  const karten = KACHELN.map(n => [n, kachel(n, inventoryFixture())]);
  karten.push(['VM-Liste', kachel('BuschUnraidVmCard', unraidAttrappe(), { device_id: 'srv' })], ['VM', kachel('BuschUnraidVmCard', unraidAttrappe(), { device_id: 'vm1' })],
    ['Stack', familienKarte('stack')], ['Container', familienKarte('container')], ['Docker', dockerKarte()]);
  assert.equal(karten.length, 18, '13 tiles, VM list and single VM, stack, container, Docker');
  for (const [name, k] of karten) {
    const titel = k.shadowRoot.querySelector('.tile-title');
    assert.ok(titel, name); assert.equal(titel.tagName, 'H2', name); assert.match(titel.className, /\bbusch-ui-title\b/, name);
    assert.equal(titel.getAttribute('data-level'), '1', name + ': card title step');
    const kopf = titel.parentNode.parentNode?.className?.includes('busch-ui-header') ? titel.parentNode.parentNode : titel.parentNode.parentNode?.parentNode;
    assert.ok(kopf && /\bbusch-ui-header\b/.test(kopf.className), name + ': header group'); assert.equal(kopf.getAttribute('role'), 'group', name);
    assert.equal(kopf.getAttribute('aria-label'), titel.textContent, name);
  }
});

test('M61 the family CSS leaves title size and weight to the shared card header step', () => {
  const tile = K.UNRAID_TILE_STYLE.split(K.BuschUI.cardStyles).join(''), regel = sel => tile.match(new RegExp('(?:^|[}\\n])' + sel + '\\{([^}]*)\\}'))?.[1];
  assert.ok(regel('\\.tile-title') !== undefined, '.tile-title rule'); assert.doesNotMatch(regel('\\.tile-title'), /font-(size|weight):/, '.tile-title');
  assert.doesNotMatch(tile, /(?:^|[}\n,])h2[,{][^}]*font-size/, 'no h2 font size'); assert.match(K.BuschUI.cardStyles, /busch-ui-title\[data-level="1"\]\)\{font-size:var\(--ha-card-header-font-size/);
  assert.doesNotMatch(regel('\\.section'), /font-size:|color:/, '.section: typography from busch-ui-heading2');
});

test('M61 section headings are the one level-2 step (busch-ui-heading2)', () => {
  const gpu = kachel('BuschUnraidGpuCard', unraidAttrappe(), { device_id: '' }), array = kachel('BuschUnraidArrayCard', unraidAttrappe(), { device_id: '' }), sys = kachel('BuschUnraidSystemCard', unraidAttrappe(), { device_id: '' });
  let n = 0;
  for (const k of [gpu, array, sys]) for (const h of k.shadowRoot.querySelectorAll('.section')) { n++; assert.equal(h.tagName, 'H3'); assert.match(h.className, /\bbusch-ui-heading2\b/, h.textContent); }
  assert.ok(n >= 4, 'section headings checked: ' + n);
});
