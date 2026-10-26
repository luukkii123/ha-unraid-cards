#!/usr/bin/env python3
"""Stage 3 final renderer: prepared for the one root-owned final browser run.

python3 /repo/docs/render/stufe3.py /repo/dist/unraid-cards.js /out
Mount the unchanged shared rule helpers at /work. No real HA or hardware.
All three cards/editors, full/empty/partial/offline/legacy, de/en,
320/480/960 light/dark. The fixture factory alone needs no browser package.
"""
import json
import pathlib
import sys


def fixtures():
    """Invented Node registry fixtures, independently executable without Playwright."""
    import copy
    import json
    import pathlib
    import shutil
    import subprocess
    node = shutil.which('node')
    if node is None:
        # Only the final container needs this fallback; fixture unit tests use PATH.
        import playwright
        node = str(pathlib.Path(playwright.__file__).parent / 'driver' / 'node')
    repo = pathlib.Path(__file__).resolve().parents[2]
    js = "const f=require('./tests/familie-attrappe.js').inventoryFixture;const out={};for(const [v,opt] of [['voll',{second:true}],['legacy',{second:true,legacy:true}]]){const c=f(opt);out[v]={devices:[...c.devices.values()],entities:[...c.entities.values()]};}console.log(JSON.stringify(out))"
    data = json.loads(subprocess.check_output([node, '-e', js], cwd=repo, text=True))
    # Long, untrusted descriptions and model/assignment names are literal text.
    for e in data['voll']['entities']:
        a = e['attributes']
        if e['entity_id'] == 'sensor.demo_dashboard_users':
            a['users'][0]['description'] = 'Long invented description <script>throw Error(1)</script> ' * 8
        if e['entity_id'] == 'sensor.demo_dashboard_usb':
            a['devices'][0]['name'] = 'Example remote adapter with a long invented descriptive name ' * 4
            a['devices'][2]['assigned_vm'] = 'Example guest with a long invented name ' * 4
        if e['entity_id'] == 'sensor.demo_dashboard_coral':
            a['devices'][0]['name'] = 'Example Coral accelerator with a long invented name ' * 4
    for variant in ['empty', 'partial', 'offline']:
        data[variant] = copy.deepcopy(data['voll'])
    for e in data['empty']['entities']:
        suffix = e['registry']['unique_id']
        if e['device_id'] == 'demo' and suffix.split('_dashboard_')[-1] in ('users', 'usb', 'coral'):
            key = suffix.split('_dashboard_')[-1]
            e['state'] = e['stateObject']['state'] = '0'
            e['attributes']['users' if key == 'users' else 'devices'] = []
            if key == 'users':
                e['attributes']['unprotected_count'] = 0
    for e in data['offline']['entities']:
        if e['device_id'] == 'demo':
            e['state'] = e['stateObject']['state'] = 'unavailable'
    for e in data['partial']['entities']:
        if e['entity_id'] == 'sensor.demo_dashboard_users':
            e['state'] = e['stateObject']['state'] = 'unavailable'
            e['attributes']['users'] = None
            e['attributes']['failed_sections'] = ['inv_users']
        if e['entity_id'] == 'sensor.demo_dashboard_usb':
            e['attributes']['mapping_status'] = 'partial'
            e['attributes']['failed_sections'] = ['inv_usb_mapping']
            for d in e['attributes']['devices']:
                d['state'] = 'unknown'
                d['assigned_vm'] = d['remote_host'] = d['assignment_source'] = None
        if e['entity_id'] == 'sensor.demo_dashboard_coral':
            e['attributes']['failed_sections'] = ['inv_usb']
            e['attributes']['devices'] = [d for d in e['attributes']['devices'] if d['transport'] == 'pci']
            e['state'] = e['stateObject']['state'] = str(len(e['attributes']['devices']))
    for fixture in data.values():
        for entity in fixture['entities']:
            entity['stateObject'] = {'entity_id': entity['entity_id'], 'state': entity['state'], 'attributes': entity['attributes']}
    return data


# The form is a standalone HA form fixture. Production editors still use ha-form.
FORM = """<style>[data-stage3-editor]{display:block;min-width:0;color:var(--primary-text-color);background:var(--card-background-color);padding:16px;box-sizing:border-box}</style><script>
customElements.define('ha-form',class extends HTMLElement {
 set schema(v){this._schema=v;this.draw()} get schema(){return this._schema}
 set data(v){this._data=v;this.draw()} get data(){return this._data}
 set computeLabel(v){this._label=v;this.draw()}
 set computeHelper(v){this._helper=v;this.draw()}
 draw(){this.replaceChildren();for(const s of this._schema||[]){
 const box=document.createElement('div');box.style.cssText='display:grid;gap:8px;margin:12px 0;overflow-wrap:anywhere;min-width:0';
 const label=document.createElement('label');label.textContent=this._label?.(s)||s.name;label.htmlFor='field-'+s.name;
 const input=document.createElement('input');input.id=label.htmlFor;input.name=s.name;input.type=s.name==='show_hubs'?'checkbox':'text';
 input.style.cssText='min-height:44px;min-width:44px;max-width:100%;box-sizing:border-box;color:var(--primary-text-color);background:var(--card-background-color);border:1px solid var(--divider-color)';
 if(input.type==='checkbox')input.checked=!!this._data?.[s.name];else input.value=this._data?.[s.name]||'';
 input.onchange=()=>{this._data={...this._data,[s.name]:input.type==='checkbox'?input.checked:input.value};this.dispatchEvent(new CustomEvent('value-changed',{detail:{value:this._data}}))};
 const help=document.createElement('small');help.textContent=this._helper?.(s)||'';box.append(label,input,help);this.append(box)}}
});
</script>"""


def main():
    sys.path.insert(0, '/work')
    from playwright.sync_api import sync_playwright
    from regeln import bewerte, lauf_breiten, messe_text, schreibe, selbsttest, zaehle
    import kacheln as base
    bundle = pathlib.Path(sys.argv[1])
    out = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else '/tmp/stufe3-out')
    out.mkdir(parents=True, exist_ok=True)
    report = {'abgeschlossen': False, 'selbsttest': {}, 'breiten': {}, 'interaktionen': [],
              'eigene_verstoesse': [], 'seitenfehler': [], 'netz': [],
              'grenzen': ['Synthetic HA form fixture; real HA editor dialog behavior belongs to HA.',
                          'No screen reader or field performance measurement.']}
    failures = report['eigene_verstoesse']
    def check(ok, message):
        if not ok:
            failures.append(message)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 960, 'height': 1200}, locale='de-DE')
        page.on('pageerror', lambda e: report['seitenfehler'].append(str(e)))
        page.on('console', lambda m: m.type == 'error' and report['seitenfehler'].append(m.text))
        # Escape '<' so untrusted fixture text cannot close the harness script.
        payload = json.dumps(fixtures(), ensure_ascii=False).replace('<', r'\u003c')
        html = base.SEITE.replace('__ATTRAPPE__', payload).replace('<script src="/unraid-cards.js">', FORM + '<script src="/unraid-cards.js">')
        def route(r):
            url = r.request.url
            report['netz'].append(url)
            if url == base.ORIGIN + '/unraid-cards.js':
                return r.fulfill(body=bundle.read_text(), content_type='text/javascript')
            if url == base.ORIGIN + '/':
                return r.fulfill(body=html, content_type='text/html')
            failures.append('Unexpected network request: ' + url)
            return r.fulfill(status=404, body='')
        page.route('**/*', route)
        page.goto(base.ORIGIN + '/')
        page.wait_for_function("!!customElements.get('busch-unraid-coral-card')")
        def place(kind, variant='voll', language='de', config=None):
            tag = 'busch-unraid-' + kind + '-card'
            page.evaluate("([tag,v,lang,cfg])=>{localStorage.clear();place(tag,v,{device_id:'demo',...cfg});const c=document.querySelector(tag);c.hass={...c.hass,locale:{language:lang}}}", [tag, variant, language, config or {}])
            return tag
        def capture(name, selector):
            width = page.viewport_size['width']
            theme = page.evaluate('document.documentElement.dataset.theme')
            page.locator(selector).screenshot(path=str(out / f'{name}-{width}-{theme}.png'))
            check(not page.evaluate(base.JS_HSCROLL), f'Horizontal scroll: {name}/{width}/{theme}')
            measurement = messe_text(page, selector)  # selector names ONE host; helpers enter its shadow root.
            check(measurement.get('geprueft', 0) > 0 and measurement.get('geprueft_mit_kasten', 0) > 0,
                  f'Empty text measurement: {name}/{width}/{theme}: {measurement}')
            return measurement
        for kind in ('users', 'usb', 'coral'):
            tag = place(kind)
            report['selbsttest'][kind] = selbsttest(page, tag)
        def measurement(pg):
            results = {}
            for language in ('de', 'en'):
                for kind in ('users', 'usb', 'coral'):
                    for variant in ('voll', 'empty', 'partial', 'offline', 'legacy'):
                        tag = place(kind, variant, language)
                        name = f'{kind}-{variant}-{language}'
                        results[name] = capture(name, tag)
                        info = pg.evaluate(base.JS_KARTE, tag)
                        check(not info['laedt'], f'Unexpected loading: {name}')
                        check(not info['ziele'], f'Small touch target: {name}: {info["ziele"]}')
                        content = pg.locator(tag + ' ha-card').inner_text()
                        check('FOREIGN' not in content, f'Cross-server inventory: {name}')
                        check('NaN' not in content and 'undefined' not in content, f'Invalid text: {name}')
                        if variant == 'legacy':
                            check('0.10' in content, f'No specific upgrade hint: {name}')
                        if variant in ('partial', 'offline'):
                            check(('verfügbar' in content if language == 'de' else 'available' in content), f'No source failure feedback: {name}')
                        if variant == 'empty':
                            check(('Keine' in content if language == 'de' else 'No ' in content), f'No empty feedback: {name}')
                        if kind == 'coral' and variant == 'voll':
                            check(('USB erkannt' in content if language == 'de' else 'USB detected' in content), f'Missing USB Coral limit: {name}')
                    tag = place(kind, language=language)
                    toggle = pg.locator(tag + ' [data-focus-key="toggle"]')
                    # place() removed the preceding editor/card. Tab reaches the fresh
                    # card's only focusable control and establishes keyboard modality,
                    # including after the USB editor's pointer-driven hub.uncheck().
                    pg.keyboard.press('Tab')
                    focus = pg.evaluate("tag=>{const c=document.querySelector(tag),r=c.shadowRoot,b=r.querySelector('[data-focus-key=toggle]'),s=getComputedStyle(b);return {active:document.activeElement===c&&r.activeElement===b,focus_visible:b.matches(':focus-visible'),outline_style:s.outlineStyle,outline_width:s.outlineWidth}}", tag)
                    focused = (focus['active'] and focus['focus_visible'] and
                               focus['outline_style'] != 'none' and float(focus['outline_width'].removesuffix('px')) > 0)
                    check(focused, f'No visible keyboard focus after Tab: {kind}/{language}: {focus}')
                    toggle.press('Enter')
                    check(pg.locator(tag + ' table').count() == 0, f'Keyboard collapse failed: {kind}/{language}')
                    results[f'{kind}-collapsed-{language}'] = capture(f'{kind}-collapsed-{language}', tag)
                    toggle.press('Space')
                    check(pg.locator(tag + ' table').count() == 1, f'Keyboard expand failed: {kind}/{language}')
                    pg.evaluate("tag=>{const c=document.querySelector(tag);c._core.entities.get('sensor.demo_dashboard_'+c.constructor.kachel).attributes.sampled_at={example:54321};c.hass={...c.hass}}", tag)
                    retained = pg.evaluate("tag=>{const r=document.querySelector(tag).shadowRoot;return r.activeElement===r.querySelector('[data-focus-key=toggle]')}", tag)
                    check(retained, f'Focus lost on stream render: {kind}/{language}')
                    toggle.press('Enter')
                    persisted = pg.evaluate("tag=>{const c=document.querySelector(tag);c.setConfig({...c._config});return c._eingeklappt&&c.shadowRoot.querySelector('[data-focus-key=toggle]').getAttribute('aria-expanded')==='false'}", tag)
                    check(persisted, f'Collapse preference lost: {kind}/{language}')
                    report['interaktionen'].append({'karte': kind, 'sprache': language, 'breite': pg.viewport_size['width'], 'thema': pg.evaluate('document.documentElement.dataset.theme'), 'fokus_sichtbar': focused, 'fokus_eingabe': 'Tab', 'fokus_details': focus, 'fokus_stream': retained, 'einklappen_gespeichert': persisted})
                    editor = tag + '-editor'
                    pg.evaluate("([tag,lang])=>{const e=document.createElement(tag);e.setAttribute('data-stage3-editor','');e.setConfig({type:'custom:'+tag.replace(/-editor$/,''),device_id:'demo'});e.hass={locale:{language:lang}};window.editorConfig=null;e.addEventListener('config-changed',ev=>window.editorConfig=ev.detail.config);document.querySelector('#wrap').replaceChildren(e)}", [editor, language])
                    results[f'{kind}-editor-{language}'] = capture(f'{kind}-editor-{language}', editor)
                    title = pg.locator(editor + ' input[name=title]')
                    title.focus()
                    check(title.evaluate('(e)=>document.activeElement===e'), f'Editor input cannot focus: {kind}/{language}')
                    title.fill('Example custom title')
                    title.press('Tab')
                    check(pg.evaluate("window.editorConfig?.title==='Example custom title'"), f'Editor did not publish title: {kind}/{language}')
                    if kind == 'usb':
                        hub = pg.locator(editor + ' input[name=show_hubs]')
                        check(hub.is_checked(), f'Hub default is not true: {language}')
                        hub.uncheck()
                        check(pg.evaluate('window.editorConfig?.show_hubs===false'), f'Editor did not publish hub filter: {language}')
                        tag = place('usb', language=language, config={'show_hubs': False})
                        check('Example hub' not in pg.locator(tag + ' ha-card').inner_text(), 'Hub filter did not apply')
                        results[f'usb-filtered-{language}'] = capture(f'usb-filtered-{language}', tag)
            check(pg.evaluate('window.calls.length===0 && window.ws.length===0'), 'Read-only cards sent services or browser polls')
            return results
        report['breiten'] = lauf_breiten(page, breiten=(320, 480, 960), messung=measurement, hoehe=1200)
        browser.close()
    report['abgeschlossen'] = True
    schreibe(out / 'report.json', report, zeige=0)
    code = max(bewerte(report), int(bool(failures or report['seitenfehler'])))
    print(json.dumps({'zaehlung': zaehle(report), 'eigene': failures, 'seitenfehler': report['seitenfehler'], 'report': str(out / 'report.json'), 'exit': code}, ensure_ascii=False))
    return code


if __name__ == '__main__':
    sys.exit(main())
