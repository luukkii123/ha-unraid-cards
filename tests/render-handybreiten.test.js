'use strict';
// M76 (#1344, F14): every dialog and editor of the runner render scripts is also rendered and measured at the phone
// widths 360 and 390 px (light and dark), Regel 1 (messe_text) and, for dialogs, Regel 2 (messe_popup). report.json
// lists them in `handybreiten` ({breiten, ansichten: {view: [widths]}, luecken}); a view without 360 or 390 fails
// the run. Checked in the source and with the helper itself (python3, stub browser modules) – the final render run
// measures in the browser.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { spawnSync } = require('node:child_process');

const RENDER = path.join(__dirname, '../docs/render');
const lies = name => fs.readFileSync(path.join(RENDER, name), 'utf8');

test('M76 kacheln.handy_ausweis lists every view with its phone widths and names each gap', () => {
  const py = String.raw`
import json, sys, types
sys.path.insert(0, sys.argv[1])
pw = types.ModuleType("playwright"); api = types.ModuleType("playwright.sync_api"); api.sync_playwright = None
sys.modules.update({"playwright": pw, "playwright.sync_api": api})
r = types.ModuleType("regeln")
for n in ("bewerte", "ha_icon_attrappe", "ha_icon_fehlend", "lauf_breiten", "messe_popup", "messe_text", "schreibe", "selbsttest", "zaehle"):
    setattr(r, n, None)
sys.modules["regeln"] = r
sys.argv = ["kacheln.py", "bundle.js", sys.argv[2]]
import kacheln
voll = kacheln.handy_ausweis([("dialog", 360), ("dialog", 390), ("dialog", 360), ("editor-cpu", 390)])
print(json.dumps({"breiten": list(kacheln.HANDY_BREITEN), "dialog_breiten": list(kacheln.DIALOG_BREITEN), "voll": voll,
                  "leer": kacheln.handy_ausweis([])}))`;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'handy-'));
  const r = spawnSync('python3', ['-I', '-c', py, RENDER, tmp], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const o = JSON.parse(r.stdout);
  assert.deepEqual(o.breiten, [360, 390]);
  assert.deepEqual(o.dialog_breiten, [320, 360, 390, 480, 960], 'VM confirmation: rule widths plus both phone widths');
  assert.deepEqual(o.voll.ansichten, { dialog: [360, 390], 'editor-cpu': [390] });
  assert.deepEqual(o.voll.luecken, ['editor-cpu ohne 360 px']);
  assert.deepEqual(o.leer.luecken, ['keine Dialog-/Editoransicht bei 360/390 px gemessen'], 'nothing measured is a gap, not a pass');
});

test('M76 kacheln.py: the VM confirmation dialog runs at 360/390 (Regel 1, Regel 2, bottom sheet) and is listed', () => {
  const t = lies('kacheln.py');
  assert.match(t, /for breite in DIALOG_BREITEN:\n\s+for t in \("light", "dark"\):/, 'dialog loop over DIALOG_BREITEN in both themes');
  assert.match(t, /report\["handybreiten"\] = handy_ausweis\(/);
  assert.match(t, /eigene \+= \[f"handybreite \{l\}" for l in report\["handybreiten"\]\["luecken"\]\]/);
});

test('M76 stufe2.py: action dialogs and the interface editor at 360/390, Regel 2 per phone width', () => {
  const t = lies('stufe2.py');
  assert.match(t, /lauf_breiten\(page, breiten=base\.HANDY_BREITEN, messung=dialoge, hoehe=1200\)/);
  assert.match(t, /for width in base\.DIALOG_BREITEN:/, 'Regel 2 loop includes 360/390');
  assert.match(t, /rule == "scrim" and width < 450/, 'every phone sheet may leave no outside point, not only 320');
  assert.match(t, /report\["handybreiten"\] = base\.handy_ausweis\(/);
});

test('M76 stufe3.py: users/usb/coral editors at 360/390', () => {
  const t = lies('stufe3.py');
  assert.match(t, /lauf_breiten\(page, breiten=base\.HANDY_BREITEN, messung=editoren, hoehe=1200\)/);
  assert.match(t, /report\['handybreiten'\] = base\.handy_ausweis\(/);
});

test('M76 anzeige.py: all 17 editors, server menu and confirmation at 360/390, menu Regel 2 per phone width', () => {
  const t = lies('anzeige.py');
  assert.match(t, /lauf_breiten\(page, breiten=base\.HANDY_BREITEN, messung=dialoge_editoren, hoehe=1200\)/);
  assert.match(t, /for breite in base\.DIALOG_BREITEN:\n\s+page\.set_viewport_size/, 'menu Regel 2 loop includes 360/390');
  assert.match(t, /report\["handybreiten"\] = base\.handy_ausweis\(/);
});
