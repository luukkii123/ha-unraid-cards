'use strict';
// M28 (#1317, W4/F7): the Unraid confirmation dialog and the server/Docker menu use the shared dialog history and focus trap
// (BuschUI.dialogHistory/focusTrap) and the confirmation follows the shared anatomy (.busch-dialog: X left, title, content,
// footer with Cancel before the primary action). No card keeps an own pushState.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { ladeKarte } = require('./laden.js');
const { domMitHistory } = require('./dom-attrappe.js');
const { dockerKarte } = require('./familie-attrappe.js');

test('M28 no own pushState outside the shared UI block', () => {
  const quelle = fs.readFileSync(path.join(__dirname, '../dist/unraid-cards.js'), 'utf8').replace(/\/\* BEGIN BUSCH SHARED UI[\s\S]*?\/\* END BUSCH SHARED UI \*\//, '');
  assert.deepEqual(quelle.match(/pushState\(/g) || [], []);
  assert.match(quelle, /BuschUI\.dialogHistory\(/); assert.match(quelle, /BuschUI\.focusTrap\(/);
});

test('M28 confirmation: shared anatomy, shared history entry, Cancel before the primary action', async () => {
  const env = domMitHistory(), { BuschUnraidConfirm } = ladeKarte(['BuschUnraidConfirm'], env);
  for (const gefahr of [true, false]) {
    const p = BuschUnraidConfirm.frage({ titel: 'Stoppen', text: '„plex“ stoppen?', aktion: 'Stoppen', gefahr }), d = env.document.body.lastChild, r = d.shadowRoot;
    const box = r.querySelector('.busch-dialog'); assert.ok(box); assert.equal(box.getAttribute('data-size'), 'confirm'); assert.equal(box.getAttribute('role'), 'alertdialog');
    const head = r.querySelector('.busch-dialog-head'); assert.equal(head.childNodes[0], r.querySelector('.busch-dialog-close'), 'X left'); assert.equal(head.childNodes[1], r.querySelector('.busch-dialog-title'), 'title');
    assert.equal(r.querySelector('.busch-dialog-title').tagName, 'H2'); assert.ok(r.querySelector('.busch-dialog-content').querySelector('p'), 'text in the content');
    const fuss = r.querySelector('.busch-dialog-foot').childNodes; assert.equal(fuss.length, 2); assert.equal(fuss[0], d._abbr, 'Cancel first'); assert.equal(fuss[1], d._ok);
    assert.match(d._abbr.className, /\bbusch-btn\b/); assert.equal(d._abbr.getAttribute('data-variant'), 'secondary');
    assert.match(d._ok.className, /\bbusch-btn\b/); assert.equal(d._ok.getAttribute('data-variant'), gefahr ? 'destructive' : 'primary');
    assert.equal(d._ok.getAttribute('data-filled') !== null, gefahr, 'destructive is filled red');
    // ui-regeln Regel 2: the primary action stays right even when it is destructive. The shared rule pushes only a
    // destructive button that is not the last one (a separate third Delete); the confirm action is the last child.
    const css = r.querySelector('style').textContent;
    assert.match(css, /:where\(\.busch-dialog-foot\) :where\(\[data-variant=destructive\]:not\(:last-child\)\)\{margin-inline-end:auto\}/, 'confirm action keeps the right edge');
    assert.equal(fuss[fuss.length - 1], d._ok, 'confirm action is the last child');
    assert.doesNotMatch(css, /busch-dialog-foot>\.busch-btn:last-child/, 'no local reset of the shared rule');
    assert.equal(env.history.state.buschUiDialog.name, 'busch-unraid-confirm'); assert.equal(env.history.state.dialog, undefined);
    d._abbr.click(); assert.equal(await p, false); assert.equal(env.history.length, 1);
    await new Promise(r => setTimeout(r));
  }
});

test('M28 server/Docker menu: shared history entry, Back closes only the menu, Tab stays inside', async () => {
  const k = dockerKarte(), l = k.l;
  k.shadowRoot.querySelectorAll('.tile-main').find(b => b.dataset.key === 'stack:media').click();
  const menu = l.body.childNodes.find(n => n.tagName === 'BUSCH-UNRAID-DOCKER-MENU'); assert.ok(menu);
  assert.equal(l.history.state.buschUiDialog.name, 'busch-unraid-docker-menu'); assert.equal(l.history.state.buschUiDialog.id, menu._verlauf.id);
  const items = menu.shadowRoot.querySelectorAll('button'), erstes = menu.shadowRoot.querySelectorAll('.item')[0];
  assert.equal(erstes.focused, true, 'first item focused');
  const tab = shiftKey => { const e = { type: 'keydown', key: 'Tab', shiftKey, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {} }; for (const fn of l.context.document.listeners?.keydown || []) fn(e); return e; };
  assert.ok(tab(true).defaultPrevented, 'Shift+Tab is trapped'); assert.equal(menu.shadowRoot.activeElement, menu.shadowRoot.querySelector('.menu-close'), 'Shift+Tab from the first item reaches the close X before it');
  tab(true); assert.equal(menu.shadowRoot.activeElement, items.at(-1), 'and wraps to the last item'); tab(false); assert.equal(menu.shadowRoot.activeElement, items[0], 'Tab wraps forward');
  l.history.stack.pop(); for (const fn of l.window.listeners?.popstate || []) fn({ type: 'popstate' });
  assert.ok(!l.body.childNodes.includes(menu), 'Back closes the menu'); assert.equal(l.history.state, null);
  assert.deepEqual(l.context.document.listeners.keydown || [], [], 'trap released');
});
