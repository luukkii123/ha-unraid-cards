'use strict';
// M26 (#1327, W2/W10): every render script of the runner (hacs/scripts/karten-runner.json, steps unraid-cards … anzeige)
// measures contrast and touch targets with hacs/scripts/kontrast_touch.py (regeln.messe_kontrast_touch_hier) and writes
// the areas `kontrast` and `touch` into report.json; a violation ends the run with exit 1. The CI scripts
// (.github/ci-contracts.txt) keep running without regeln.py and then report `kein_urteil`. Checked in the source and with
// the helper itself (python3, no browser) – the final render run measures in the browser.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), { spawnSync } = require('node:child_process');

const RENDER = path.join(__dirname, '../docs/render');
const SKRIPTE = ['unraid-cards.py', 'unraid-queue.py', 'unraid-updated-family.py', 'unraid-docker.py', 'kacheln.py', 'stufe2.py', 'stufe3.py'];
const CI = fs.readFileSync(path.join(__dirname, '../.github/ci-contracts.txt'), 'utf8').split('\n')
  .filter(z => z.trim() && !z.startsWith('#')).map(z => path.basename(z.split(/\s+/)[0]));

test('M26 every runner render script measures contrast and touch per state and writes both areas into report.json', () => {
  const anzeige = fs.readFileSync(path.join(RENDER, 'anzeige.py'), 'utf8');
  assert.match(anzeige, /messe_kontrast_touch_hier\(/, 'anzeige.py: pattern script');
  for (const name of SKRIPTE) {
    const text = fs.readFileSync(path.join(RENDER, name), 'utf8');
    assert.match(text, /from kontrast_bericht import KontrastTouch|import kontrast_bericht/, name + ': kontrast_bericht missing');
    assert.match(text, /\bkt\.messe\(/, name + ': no measurement per state');
    assert.match(text, /kt\.bericht\(\)/, name + ': kontrast/touch not written into report.json');
    assert.match(text, /kt\.verstoesse\(\)/, name + ': a violation does not end the run with exit 1');
  }
});

test('M26 the CI contract scripts measure only with regeln.py and stay runnable without it', () => {
  assert.ok(CI.length >= 3, 'ci-contracts.txt lists the contract scripts');
  for (const name of CI) {
    const text = fs.readFileSync(path.join(RENDER, name), 'utf8');
    assert.match(text, /KontrastTouch\(regeln\)/, name + ': helper must get the optional regeln module');
    assert.doesNotMatch(text, /^from regeln import|^import regeln$/m, name + ': unguarded regeln import');
  }
});

test('M26 kontrast_bericht: runs per state, unused exceptions, violations count, kein_urteil without regeln.py', () => {
  const py = String.raw`
import json, sys
sys.path.insert(0, sys.argv[1])
import kontrast_bericht as kb
class Seite:
    viewport_size = {"width": 480}
    def evaluate(self, js, *a): return "dark"
class Regeln:
    def __init__(self, k, t): self.k, self.t = k, t
    def messe_kontrast_touch_hier(self, page, sel, ausnahmen=None):
        return {"kontrast": {"ausnahmen_datei": str(ausnahmen), "kontrast_verstoesse": list(self.k), "ausnahmen": [], "geprueft": 3},
                "touch": {"ausnahmen_datei": str(ausnahmen), "touch_verstoesse": list(self.t), "ausnahmen": [], "geprueft": 1}}
out = {}
ohne = kb.KontrastTouch(None); ohne.messe(Seite(), "x", "fall")
out["ohne"] = {"bericht": ohne.bericht(), "verstoesse": ohne.verstoesse()}
gut = kb.KontrastTouch(Regeln([], [])); gut.messe(Seite(), "busch-x", "a"); gut.messe(Seite(), "busch-x", "b", breite=320, thema="light")
out["gut"] = {"bericht": gut.bericht(), "verstoesse": gut.verstoesse()}
leer = kb.KontrastTouch(Regeln([], []))
out["leer"] = leer.verstoesse()
schlecht = kb.KontrastTouch(Regeln([{"text": "x", "verhaeltnis": 2.1}], [{"name": "y", "w": 30, "h": 30}])); schlecht.messe(Seite(), "busch-x", "a")
out["schlecht"] = schlecht.verstoesse()
print(json.dumps(out))`;
  const r = spawnSync('python3', ['-I', '-c', py, RENDER], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const o = JSON.parse(r.stdout);
  assert.deepEqual(Object.keys(o.ohne.bericht).sort(), ['kontrast', 'touch']);
  assert.match(o.ohne.bericht.kontrast.kein_urteil, /regeln\.py/); assert.equal(o.ohne.verstoesse, 0);
  const k = o.gut.bericht.kontrast, t = o.gut.bericht.touch;
  assert.equal(k.laeufe.length, 2); assert.deepEqual(k.laeufe.map(l => [l.fall, l.breite, l.thema]), [['a', 480, 'dark'], ['b', 320, 'light']]);
  assert.ok(Array.isArray(k.ungenutzte_ausnahmen) && Array.isArray(t.ungenutzte_ausnahmen)); assert.equal(t.mindest_px, 44);
  assert.match(String(k.ausnahmen_datei), /kontrast-ausnahmen\.json$/);
  assert.equal(o.gut.verstoesse, 0);
  assert.equal(o.leer, 1, 'regeln.py present but nothing measured is a violation, not a pass');
  assert.equal(o.schlecht, 2);
});
