'use strict';
// M63 (#1317, W13): type sizes, inner radii and spacing of the Unraid styles come from tokens; no fixed px font size outside
// a var() fallback, no capitals in headings, one inner radius step (--busch-radius-inner) below the card radius.
const test = require('node:test'), assert = require('node:assert/strict');
const { ladeKarte } = require('./laden.js');

const NAMEN = ['BUSCH_UNRAID_STYLE', 'UNRAID_TILE_STYLE', 'UNRAID_FAMILIE_STYLE', 'BUSCH_UNRAID_DOCKER_STYLE', 'BUSCH_UNRAID_DOCKER_MENU_STYLE', 'UNRAID_CONFIRM_STYLE', 'UNRAID_INVENTAR_SPALTEN_STYLE'];
const K = ladeKarte([...NAMEN, 'BuschUI']);
// Own CSS only: the shared cardStyles prefix is checked in shared-ui.
const eigen = name => K[name].split(K.BuschUI.cardStyles).join('');
const ohneVar = css => { let s = css, alt; do { alt = s; s = s.replace(/var\([^()]*(\([^()]*\))*[^()]*\)/g, 'TOKEN'); } while (s !== alt); return s; };

test('M63 no fixed px font size outside var() fallbacks, no capitals or letter spacing in the Unraid styles', () => {
  for (const name of NAMEN) {
    const css = ohneVar(eigen(name));
    assert.deepEqual(css.match(/font-size:\s*[\d.]+px/g) || [], [], name + ': fixed px font size');
    assert.doesNotMatch(css, /text-transform:\s*uppercase/, name); assert.doesNotMatch(css, /letter-spacing:/, name);
  }
});

test('M63 fallbacks of the HA type tokens match the HA scale (s 12, m 14, l 16 px)', () => {
  for (const name of NAMEN) for (const [, stufe, px] of eigen(name).matchAll(/var\(--ha-font-size-(s|m|l),\s*(\d+)px\)/g))
    assert.equal(Number(px), { s: 12, m: 14, l: 16 }[stufe], `${name}: --ha-font-size-${stufe} fallback ${px}px`);
});

test('M63 inner surfaces use the one inner radius step, pills the pill token', () => {
  const alle = NAMEN.map(eigen).join('\n'), regel = sel => alle.match(new RegExp('(?:^|[}\\n])' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{([^}]*)\\}'))?.[1] || '';
  for (const sel of ['.card-icon,.row-icon', '.rows', '.tile', '.tile-main .tile-icon']) assert.match(regel(sel), /border-radius:var\(--busch-radius-inner,var\(--ha-border-radius-md,8px\)\)/, sel);
  assert.match(regel('.bar-track'), /border-radius:var\(--ha-border-radius-pill,9999px\)/, '.bar-track');
  assert.match(regel('.status-badge'), /border-radius:var\(--ha-border-radius-pill,9999px\)/, '.status-badge');
  assert.deepEqual(ohneVar(alle).match(/border-radius:\s*\d+px(?!\s*\d)/g) || [], [], 'no fixed px radius');
});
