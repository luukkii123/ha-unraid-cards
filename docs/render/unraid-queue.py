"""Queue UI matrix, optionally in the existing HA host; all actions synthetic.
Usage: script bundle output-directory [private-credentials-json].
"""
import json,pathlib,sys,re
from playwright.sync_api import sync_playwright
from readonly_guard import install_readonly_guard
source=pathlib.Path(sys.argv[1]).read_text();out=pathlib.Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
native=len(sys.argv)>3
prefix='queue-candidate-busch-' if native else 'busch-'
if native:source=source.replace('busch-',prefix).replace('ensureBuschCore(1)','window.__queueCore')
fixture='''
window.__queueCore={devices:new Map([['stack',{id:'stack',name:'Synthetischer Medienstack mit langem Namen',model:'Compose stack',config_entries:['demo']}]]),entities:new Map(),getDeviceEntities(id){return [...this.entities.values()].filter(e=>e.device_id===id)},attach(){},retain(){return()=>{}},watch(){return()=>{}}};
window.put=(domain,key,kind,role,state,extra={})=>{const id=domain+'.'+key+'_'+role;__queueCore.entities.set(id,{entity_id:id,domain,device_id:'stack',platform:'unraid_ssh',config_entry_id:'demo',state,registry:{},attributes:{kind,role,config_entry_id:'demo',container_key:key,container_name:'Container '+key+' mit besonders langem Namen',stack_key:'media',...extra}});return id};
put('switch','media','stack','control','on');put('button','media','stack','update_all','unknown');
for(const key of ['web','db','proxy']){put('switch',key,'container','control','on');put('update',key,'container','update','on');}
window.baseline=JSON.stringify([...__queueCore.entities]);
window.calls=[];
'''
def rgb(css):
 """Parse a computed colour: rgb()/rgba() in 0..255 or color(srgb r g b) in 0..1; returns 0..1 floats."""
 werte=[float(x) for x in re.findall(r'[-\d.]+',css)[:3]]
 return werte if css.startswith('color(') else [x/255 for x in werte]
def ton(c):
 r,g,b=c;mx,mn=max(c),min(c)
 if mx==mn:return None
 h=(g-b)/(mx-mn)%6 if mx==r else (b-r)/(mx-mn)+2 if mx==g else (r-g)/(mx-mn)+4
 return h*60
def roter_ton(farbe,fehler):
 """Same hue family as --error-color (within 15 degrees) and red is the dominant channel."""
 a,b=ton(rgb(farbe)),ton(rgb(fehler))
 return a is not None and b is not None and min(abs(a-b),360-abs(a-b))<=15 and rgb(farbe)[0]==max(rgb(farbe))
def kontrast(vorne,hinten):
 def l(c):
  c=[x/12.92 if x<=0.04045 else ((x+0.055)/1.055)**2.4 for x in rgb(c)];return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]
 a,b=sorted([l(vorne),l(hinten)],reverse=True);return (a+0.05)/(b+0.05)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True);context=browser.new_context(ignore_https_errors=True,viewport={'width':1100,'height':1800});page=context.new_page();errors=[]
 page.on('pageerror',lambda e:errors.append({'type':type(e).__name__,'locations':re.findall(r'/([A-Za-z0-9_.-]+\.js):(\d+):(\d+)',e.stack or ''),'candidate':'queue-candidate-busch' in (e.stack or '')}))
 if native:
  guard_counts=install_readonly_guard(context)
  private=json.loads(pathlib.Path(sys.argv[3]).read_text());base=private['base_url'].rstrip('/')
  auth={'hassUrl':base,'clientId':base+'/','expires':4102444800000,'expires_in':315360000,'refresh_token':'','access_token':private['token']}
  context.add_init_script('localStorage.setItem("hassTokens",JSON.stringify(%s))'%json.dumps(auth))
  page.goto(base+'/lovelace/0',wait_until='domcontentloaded',timeout=45000)
  page.wait_for_function("!!document.querySelector('home-assistant')?.hass && !!customElements.get('ha-card')",timeout=45000)
 else:
  page.set_content('''<style>body{margin:0;font-family:Arial}html{--primary-color:#0879d0;--error-color:#db4437;--primary-text-color:#212121;--secondary-text-color:#555;--card-background-color:#fff;--secondary-background-color:#eef5fb;--divider-color:#dbe4ed;--success-color:#16864b;--warning-color:#a76900;--disabled-text-color:#777}</style>''')
  page.add_script_tag(content="customElements.define('ha-icon',class extends HTMLElement{connectedCallback(){this.textContent='◇'}})")
 page.add_script_tag(content='(function(){'+source+'})();' if native else source)
 page.add_script_tag(content=fixture)
 if not native:page.evaluate('window.ensureBuschCore=()=>__queueCore')
 page.evaluate('''native=>{window.host=document.createElement('main');host.id='queue-probe';host.style.cssText='position:fixed;left:0;top:0;z-index:2147483647;max-height:100vh;overflow:auto;background:var(--card-background-color);font-family:var(--ha-font-family-body,Arial)';(native?document.querySelector('home-assistant').shadowRoot.querySelector('home-assistant-main').shadowRoot:document.body).append(host)}''',native)
 report=[]
 for dark in [False,True]:
  # Local theme tokens only; never mutate the user's HA preferences.
  page.evaluate("dark=>{for(const [key,light,night] of [['--primary-text-color','#212121','#eee'],['--secondary-text-color','#555','#ccc'],['--card-background-color','#fff','#222'],['--secondary-background-color','#eef5fb','#303b47'],['--divider-color','#dbe4ed','#46505b']])host.style.setProperty(key,dark?night:light)}",dark)
  for width in [320,360,390,480,768,960]:
   page.set_viewport_size({'width':width,'height':1800})
   for kind in ['stack','container']:
    for scenario in ['queued','pulling','percent','recreating','verifying','completed','failed','blocked','offline']:
     page.evaluate('''({prefix,width,kind,scenario})=>{host.replaceChildren();host.style.width=width+'px';__queueCore.entities=new Map(JSON.parse(baseline));const q={active:scenario!=='completed',current_target:scenario==='queued'||scenario==='completed'?null:scenario==='failed'?'Container db':'Container web',queued_count:scenario==='queued'?3:scenario==='completed'?0:scenario==='failed'?1:2,completed_count:scenario==='completed'?3:0,failed_count:scenario==='failed'?1:0,total_count:3,progress_percent:scenario==='completed'?100:scenario==='failed'?100/3:0,blocked:scenario==='blocked'||scenario==='offline'};__queueCore.entities.get('button.media_update_all').attributes.update_queue=q;
      for(const key of ['web','db','proxy']){const update=__queueCore.entities.get('update.'+key+'_update');update.attributes={...update.attributes,in_progress:false,update_state:scenario==='completed'?'completed':key==='web'?scenario==='percent'?'updating':['blocked','offline'].includes(scenario)?'pulling':scenario:scenario==='failed'&&key==='db'?'pulling':'queued',queue_position:scenario==='queued'?(key==='web'?1:key==='db'?2:3):key==='db'?1:key==='proxy'?scenario==='failed'?1:2:null,progress_percent:scenario==='percent'&&key==='web'?42:null,stack_update_queue:q,last_error:scenario==='failed'?'Update fehlgeschlagen. Weitere Aufträge laufen weiter. Unraid prüfen und erneut starten.':scenario==='blocked'?'Backendstatus unklar. Verbindung prüfen; Auftrag bleibt aktiv.':null};if(scenario==='offline')update.state='unavailable';if(scenario==='completed')update.state='off';}
      const card=document.createElement(prefix+'unraid-'+kind+'-card');card.setConfig({device_id:'stack',container_key:'web'});card.hass={locale:{language:'de'},callService:async(...args)=>calls.push(args)};card.addEventListener('hass-more-info',event=>{event.stopPropagation();window.lastDetail=event.detail.entityId});host.append(card);window.card=card;}''',{'prefix':prefix,'width':width,'kind':kind,'scenario':scenario})
     page.wait_for_timeout(20)
     result=page.evaluate('''()=>{const r=card.shadowRoot,b=card.getBoundingClientRect(),issues=[];for(const e of r.querySelectorAll('*')){const x=e.getBoundingClientRect(),s=getComputedStyle(e);if(!x.width||!x.height||s.display==='none')continue;if(x.right>b.right+1||x.left<b.left-1)issues.push('horizontal overflow');if(e.tagName==='BUTTON'&&(x.width<44||x.height<44))issues.push('touch target');if([...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())&&!(s.overflow==='hidden'&&s.textOverflow==='ellipsis')&&(e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1))issues.push('text overflow');}return {issues,text:r.querySelector('ha-card').innerText,progress:[...r.querySelectorAll('progress')].map(e=>Number(e.value)),buttons:[...r.querySelectorAll('button')].map(e=>({text:e.innerText,disabled:e.disabled})),badges:[...r.querySelectorAll('.status-badge')].map(e=>{const probe=document.createElement('span');probe.style.color='var(--error-color)';e.parentNode.appendChild(probe);const error=getComputedStyle(probe).color;probe.remove();return {cls:e.className,text:e.innerText,color:getComputedStyle(e).color,background:getComputedStyle(e).backgroundColor,error,icon:!!e.querySelector('ha-icon')}})}}''')
     if scenario=='queued':assert 'In Warteschlange · Position' in result['text']
     if scenario=='percent' and kind=='container':assert 42 in result['progress'] and '42 %' in result['text']
     if scenario=='pulling':
      assert 'Image wird geladen' in result['text']
      if kind=='stack':assert 'In Warteschlange · Position 1' in result['text'] and 'In Warteschlange · Position 2' in result['text']
     if scenario=='failed':assert 'Update fehlgeschlagen' in result['text'] and 'Unraid prüfen' in result['text']
     if scenario=='completed':assert 'Fertig' in result['text']
     if kind=='container':
      # M3: badge tone follows update_state; failed is red with a symbol, never a green pill.
      badge=result['badges'][0]
      # M26 mixes the error text with the text colour for 4.5:1, so the tone is checked by hue, not by the exact token value.
      if scenario=='failed':assert 'status-error' in badge['cls'] and badge['icon'] and roter_ton(badge['color'],badge['error']) and kontrast(badge['color'],badge['background'])>=4.5,badge
      if scenario in ['queued','pulling','recreating','verifying']:assert 'status-warning' in badge['cls'] and badge['icon'],badge
      if scenario=='completed':assert 'status-success' in badge['cls'] and not badge['icon'],badge
     if scenario=='blocked':assert 'Verbindung prüfen' in result['text']
     if scenario not in ['failed','completed','offline']:
      update_buttons=[b for b in result['buttons'] if any(x in b['text'] for x in ['Update läuft','In Warteschlange','Image wird geladen','Wird neu','Wird geprüft'])]
      assert update_buttons and all(b['disabled'] for b in update_buttons)
     if scenario=='pulling' and kind=='container' and width==390 and not dark:
      # Real Tab/Enter on the native Details action remains available.
      page.locator('#queue-probe').get_by_role('button',name='Details',exact=True).first.focus()
      page.keyboard.press('Enter');assert page.evaluate("lastDetail.startsWith('switch.')")
     if width in [320,390,960] and scenario in ['queued','percent','failed']:
      page.evaluate('host.scrollTop=0');page.locator('#queue-probe').screenshot(path=str(out/f'{kind}-{scenario}-{width}-{dark}.png'))
     report.append({'kind':kind,'scenario':scenario,'width':width,'dark':dark,'issues':result['issues']})
 # HA state stream equivalent: same card/hass, just a new backend state, render.
 page.evaluate("const u=__queueCore.entities.get('update.web_update');u.state='on';u.attributes.update_state='queued';card._render();u.attributes.update_state='verifying';card._render();")
 assert page.evaluate("card.shadowRoot.querySelector('ha-card').innerText.includes('Wird geprüft')")
 assert page.evaluate('calls.length')==0
 guard_report={**guard_counts,'websocketWritesBlocked':page.evaluate("(window.__blocked||[]).reduce((counts,type)=>{counts[type]=(counts[type]||0)+1;return counts},{})")} if native else {}
 browser.close()
summary={'guard':guard_report,'native':native,'cases':len(report),'failures':sum(len(r['issues']) for r in report),'page_errors':errors,'service_calls':0,'cases_detail':report}
(out/'report.json').write_text(json.dumps(summary,indent=2));print(json.dumps({k:v for k,v in summary.items() if k!='cases_detail'}));assert not summary['failures'] and not errors
