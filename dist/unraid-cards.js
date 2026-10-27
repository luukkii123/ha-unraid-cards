/* BEGIN BUSCH SHARED UI 0.3.2 sha256:03f8f2772ce4a11e5bc843226fea493d961f9119bc588f6187190e8bc5a663f2 */
/** Busch UI 0.3.2 — standalone Vanilla source. Synchronized verbatim, never imported at runtime. */
const BuschUI = (() => {
  const sourceVersion = '0.3.2';
  const cloneConfig = value => Array.isArray(value) ? value.map(cloneConfig)
    : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key,item]) => [key,cloneConfig(item)])) : value;
  function configsEqual(a,b) {
    if (Object.is(a,b)) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a)!==Array.isArray(b)) return false;
    if (Array.isArray(a) && a.length!==b.length) return false;
    const keys=Object.keys(a);
    return keys.length===Object.keys(b).length && keys.every(key=>Object.hasOwn(b,key)&&configsEqual(a[key],b[key]));
  }
  const validKey = key => !['__proto__','prototype','constructor'].includes(String(key));
  function updateConfig(config,patch) {
    const next=cloneConfig(config||{});
    for (const [key,value] of Object.entries(patch||{})) {
      if (!validKey(key)) throw new Error('Invalid editor config key');
      if (value===undefined) delete next[key]; else next[key]=cloneConfig(value);
    }
    return next;
  }
  function updateConfigPath(config,path,value) {
    const parts=Array.isArray(path)?path:String(path).split('.');
    if (!parts.length || parts.some(key=>!String(key)||!validKey(key))) throw new Error('Invalid editor config path');
    const next=cloneConfig(config||{});let node=next;
    for (let i=0;i<parts.length-1;i++) {const key=parts[i];if (!Object.hasOwn(node,key)||!node[key]||typeof node[key]!=='object') node[key]=typeof parts[i+1]==='number'?[]:{};node=node[key];}
    const key=parts.at(-1);
    if (value===undefined) {if (Array.isArray(node)&&typeof key==='number') node.splice(key,1);else delete node[key];} else node[key]=cloneConfig(value);
    return next;
  }
  const deleteConfigPath=(config,path)=>updateConfigPath(config,path,undefined);
  const editorEchoStates=new WeakMap();
  function editorEchoState(editor) {let state=editorEchoStates.get(editor);if(!state){state=createEchoState();editorEchoStates.set(editor,state);}return state;}
  function emitConfigChanged(editor,config,{echo=true}={}) {
    if(echo)queueEcho(editorEchoState(editor),config);
    editor.dispatchEvent(new CustomEvent('config-changed',{detail:{config:cloneConfig(config)},bubbles:true,composed:true}));
  }
  function guardEditorKeys(root) {
    root.addEventListener?.('keydown',event=>event.stopPropagation());
    root.addEventListener?.('keyup',event=>event.stopPropagation());
  }
  class EditorBase extends (typeof HTMLElement==='undefined'?class{}:HTMLElement) {
    constructor() {super();guardEditorKeys(this);}
    _acceptConfig(config,normalize=cloneConfig,{echo=true}={}) {
      const result=validateConfig(config,{normalize});
      if(!result.ok)throw result.error;
      const next=result.value;
      if (echo?!acceptEcho(editorEchoState(this),next,this._config):configsEqual(next,this._config)) return false;
      this._config=next;return true;
    }
    _publishConfig(config,options) {
      const next=cloneConfig(config);this._config=next;emitConfigChanged(this,next,options);return next;
    }
  }
  // HA supplies no echo ID: match the earliest unacknowledged equal snapshot.
  const createEchoState=()=>({pending:[],received:new Set(),stale:[]});
  function queueEcho(state,config) {state.pending.push(cloneConfig(config));}
  function acceptEcho(state,next,current) {
    const pending=state.pending.findIndex(value=>!state.received.has(value)&&configsEqual(value,next));
    if (pending!==-1) {
      if (pending<state.pending.length-1) {state.received.add(state.pending[pending]);return false;}
      state.stale.push(...state.pending.slice(0,-1).filter(value=>!state.received.has(value)));
      state.pending=[];state.received.clear();
    } else {
      if (configsEqual(current,next)||state.pending.some(value=>state.received.has(value)&&configsEqual(value,next))) return false;
      const stale=state.stale.findIndex(value=>configsEqual(value,next));
      if (stale!==-1) {state.stale.splice(stale,1);return false;}
      state.pending=[];state.received.clear();state.stale=[];
    }
    return !configsEqual(current,next);
  }
  function resolveMedia(config={},metadata={},defaultIcon='mdi:devices') {
    const safe=value=>typeof value==='string'&&value.trim()&&!/^(?:javascript|vbscript|file):/i.test(value.trim())?value.trim():null;
    const available=[metadata.entity_picture,metadata.device_picture,metadata.picture].map(safe).filter(Boolean),custom=safe(config.image),mode=config.display_mode||'auto';
    const images=mode==='icon'?[]:[...new Set((mode==='image'?[custom,...available]:[...available,custom]).filter(Boolean))];
    return {image:images[0]||null,images,icon:config.icon||metadata.icon||defaultIcon};
  }
  function media(config,metadata,defaultIcon,className='card-icon') {
    const resolved=resolveMedia(config,metadata,defaultIcon),holder=document.createElement('span');
    holder.className='busch-media '+className;holder.setAttribute('aria-hidden','true');let index=0;
    const next=()=>{
      if (index>=resolved.images.length) {const icon=ha.icon(resolved.icon);holder.replaceChildren(icon);return;}
      const img=document.createElement('img');img.setAttribute('src',resolved.images[index++]);img.setAttribute('alt','');img.setAttribute('loading','lazy');
      img.addEventListener('error',next,{once:true});holder.replaceChildren(img);
    };
    next();return holder;
  }
  function statusSemantic(status) {
    return ({success:'success',running:'success',online:'success',connected:'success',on:'success',idle:'warning',warning:'warning',partial:'warning',starting:'warning',stopping:'warning',paused:'warning',blocked:'warning',suspended:'warning',error:'error',failed:'error',neutral:'neutral',stopped:'neutral',offline:'neutral',disconnected:'neutral',off:'neutral',unavailable:'unavailable',unknown:'unknown'})[status]||'unknown';
  }
  function statusBadge(status,text,classPrefix='status-') {
    const badge=document.createElement('span');badge.className='status-badge '+classPrefix+statusSemantic(status);badge.textContent=text;return badge;
  }
  function formatNumber(value,locale,options={maximumFractionDigits:1}) {
    return !['number','string'].includes(typeof value)||(typeof value==='string'&&!value.trim())||!Number.isFinite(Number(value))?null:new Intl.NumberFormat(locale||'en',options).format(Number(value));
  }
  function metric(label,value,ratio) {
    const node=document.createElement('div');node.className='metric';
    const caption=document.createElement('span');caption.className='metric-label';caption.textContent=label;
    const text=document.createElement('strong');text.className='metric-value';text.textContent=value;node.appendChild(caption);node.appendChild(text);
    if (ratio!==undefined&&Number.isFinite(ratio)) {const bar=document.createElement('progress');bar.max=100;bar.value=Math.min(100,Math.max(0,ratio*100));bar.setAttribute('aria-label',label);node.appendChild(bar);}return node;
  }
  let helperPromise=null;
  const ha = {
    form() {
      const form=document.createElement('ha-form');
      // HA lazy-loads ha-form. Retain its real selector contract and replay
      // properties after upgrade; a free-text replacement would lose selectors.
      if (typeof customElements!=='undefined' && customElements.get && !customElements.get('ha-form') && customElements.whenDefined) {
        customElements.whenDefined('ha-form').then(()=>{
          const props=['hass','schema','data','computeLabel','computeHelper','computeError','disabled'].filter(key=>Object.hasOwn(form,key)).map(key=>[key,form[key]]);
          for (const [key] of props) delete form[key];
          customElements.upgrade?.(form);
          for (const [key,value] of props) form[key]=value;
        });
      }
      return form;
    },
    input({native=false}={}) {return document.createElement(!native&&typeof customElements!=='undefined'&&customElements.get?.('ha-input')?'ha-input':'input');},
    icon(name) {const icon=document.createElement('ha-icon');icon.setAttribute('icon',name);return icon;},
    async cardHelpers({requireRow=false}={}) {
      if (!helperPromise) {
      if (typeof window==='undefined'||typeof window.loadCardHelpers!=='function') return null;
      helperPromise=Promise.resolve().then(()=>window.loadCardHelpers()).then(helpers=>helpers&&typeof helpers.createCardElement==='function'?helpers:null).catch(()=>null);
      }
      const helpers=await helperPromise;
      if(!helpers||(requireRow&&typeof helpers.createRowElement!=='function')){helperPromise=null;return null;}
      return helpers;
    },
  };
  const tokens=Object.freeze({space1:'var(--ha-space-1, 4px)',space2:'var(--ha-space-2, 8px)',space3:'var(--ha-space-3, 12px)',space4:'var(--ha-space-4, 16px)',mediaRadius:'var(--ha-card-border-radius, 12px)',controlMinHeight:'44px'});
  function language(hass,{legacy=false,browser=true}={}) {
    const code=hass?.locale?.language||(legacy&&hass?.language)||(browser&&typeof navigator!=='undefined'&&navigator.language)||'en';
    return String(code).toLowerCase().startsWith('de')?'de':'en';
  }
  const dictionary=(table,hass,options)=>table[language(hass,options)]||table.en;
  function fieldText(table,hass,name,options) {
    const words=dictionary(table,hass,options),fallback=table.en||{};
    return {label:words?.labels?.[name]??fallback.labels?.[name]??name,helper:words?.helpers?.[name]??fallback.helpers?.[name]??''};
  }
  function validateConfig(input,{parse=false,normalize=cloneConfig,validate}={}) {
    try {
      const copied=cloneConfig(parse?JSON.parse(input):input);
      const error=validate?.(copied);
      if(error) return {ok:false,error:error instanceof Error?error:new Error(String(error))};
      return {ok:true,value:cloneConfig(normalize(copied))};
    } catch(error) {return {ok:false,error};}
  }
  const addClass=(node,name)=>{if(!String(node.className||'').split(/\s+/).includes(name))node.className=((node.className||'')+' '+name).trim();};
  function header({node=document.createElement('div'),titleNode,label}={}) {
    addClass(node,'busch-ui-header');node.setAttribute('role','group');
    const name=label??titleNode?.textContent;if(name)node.setAttribute('aria-label',name);
    if(titleNode){if(!/^H[1-6]$/.test(titleNode.tagName||'')){titleNode.setAttribute('role','heading');titleNode.setAttribute('aria-level','2');}addClass(titleNode,'busch-ui-title');}
    return node;
  }
  const actionBindings=new WeakMap();
  function action({node=document.createElement('button'),label,text,icon,disabled,variant='secondary',onClick}={}) {
    if(!label)throw new Error('Action requires an accessible label');
    addClass(node,'busch-ui-action');node.type='button';node.setAttribute('aria-label',label);node.setAttribute('data-variant',variant);
    if(disabled!==undefined)node.disabled=disabled;
    let binding=actionBindings.get(node);
    if(!binding){
      binding={};actionBindings.set(node,binding);
      // Keep native keyboard activation and owning tablist arrow navigation.
      for(const type of ['keydown','keyup'])node.addEventListener(type,event=>{if(event.key==='Enter'||event.key===' ')event.stopPropagation();});
      node.addEventListener('click',event=>{event.stopPropagation();if(!node.disabled)binding.onClick?.(event);});
    }
    binding.onClick=onClick;
    if(text!==undefined){node.textContent=text;binding.icon=null;}
    if(icon){if(!binding.icon){binding.icon=ha.icon(icon);binding.icon.setAttribute('aria-hidden','true');node.appendChild(binding.icon);}else binding.icon.setAttribute('icon',icon);}
    if(icon||text===undefined){if(!node.title||node.title===binding.tooltip){node.title=label;binding.tooltip=label;}}
    return node;
  }

  function section({title,content,open=false}={}) {
    const node=document.createElement('details');
    addClass(node,'busch-ui-section');node.open=open;
    const summary=document.createElement('summary');summary.textContent=title;node.appendChild(summary);
    if(content)node.appendChild(content);return node;
  }
  // Scoped bases: family layout/grid/padding and domain presentation override
  // these fundamentals. No global selectors or services in shared primitives.
  const cardStyles=`
.busch-ui-header{min-width:0}.busch-ui-title{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
:where(.busch-ui-action){border:0;border-radius:var(--ha-card-border-radius,12px);padding:var(--ha-space-2,8px) var(--ha-space-3,12px);color:var(--primary-text-color,#212121);background:var(--secondary-background-color,#eeeeee);box-sizing:border-box;min-height:44px;min-width:44px;max-width:100%;font:inherit;cursor:pointer}
:where(.busch-ui-action):focus-visible{outline:2px solid var(--primary-color,#03a9f4);outline-offset:2px}
:where(.busch-ui-action[data-variant=primary]){background:var(--primary-color,#03a9f4);color:var(--text-primary-color,#ffffff)}
:where(.busch-ui-action[data-variant=secondary]){background:var(--secondary-background-color,#eeeeee);color:var(--primary-text-color,#212121)}
:where(.busch-ui-action[data-variant=destructive]),:where(.busch-ui-action[data-variant=danger]){color:var(--error-color,#db4437)}
:where(.busch-ui-action[data-variant=quiet]),:where(.busch-ui-action[data-variant=icon-only]),:where(.busch-ui-action[data-variant=overflow]){background:transparent}
:where(.busch-ui-action):disabled{cursor:default;opacity:0.5}
`;
  const editorStyles=cardStyles+`
:host(.busch-ui-editor),.busch-ui-editor{display:block;min-width:0;color:var(--primary-text-color,#212121);font:inherit}
:host(.busch-ui-editor) ha-form,.busch-ui-editor ha-form{display:block;min-width:0}.busch-ui-section{min-width:0}
.busch-ui-section>summary{cursor:pointer;min-height:44px;box-sizing:border-box;overflow-wrap:anywhere;font-weight:var(--ha-font-weight-medium,500)}
.busch-ui-section>summary:focus-visible{outline:2px solid var(--primary-color,#03a9f4);outline-offset:2px}
.busch-ui-validation{color:var(--error-color,#db4437);overflow-wrap:anywhere;font-size:var(--ha-font-size-s,12px)}
`;
  return Object.freeze({sourceVersion,EditorBase,cloneConfig,configsEqual,updateConfig,updateConfigPath,deleteConfigPath,emitConfigChanged,guardEditorKeys,createEchoState,queueEcho,acceptEcho,resolveMedia,media,statusSemantic,statusBadge,metric,formatNumber,ha,tokens,language,dictionary,fieldText,validateConfig,header,action,section,cardStyles,editorStyles});
})();
/* END BUSCH SHARED UI */

/* === Kern (Kopie aus Busch Cards, zur Laufzeit geteilt) === */
const BUSCH_CORE_KEY = Symbol.for("busch.cards.core");
const BUSCH_REGISTRY_IDS = { entity: "entity_id", device: "id", area: "area_id", floor: "floor_id", label: "label_id" };
function buschCoreMap(rows, key) {
  return new Map((Array.isArray(rows) ? rows : Object.values(rows || {})).map(row => [row[key], row]));
}
function buschCoreSet(map, key, id, add = true) {
  if (key === undefined || key === null || key === "") return;
  if (add) { if (!map.has(key)) map.set(key, new Set()); map.get(key).add(id); }
  else { const set = map.get(key); if (set) { set.delete(id); if (!set.size) map.delete(key); } }
}
class BuschRegistryCache {
  constructor(hass, onLoad = () => {}) { this.hass = hass; this.onLoad = onLoad; this.promises = new Map(); this.requests = {}; this.generation = 0; }
  load(name) {
    if (!(name in BUSCH_REGISTRY_IDS)) return Promise.reject(new Error(`Unknown registry: ${name}`));
    if (this.promises.has(name)) return this.promises.get(name);
    const generation = this.generation, hass = this.hass;
    const pending = Promise.resolve().then(() => {
      this.requests[name] = (this.requests[name] || 0) + 1;
      return hass.callWS({ type: `config/${name}_registry/list` });
    }).then(rows => {
      if (generation !== this.generation || this.promises.get(name) !== pending) return null;
      if (!Array.isArray(rows)) throw new Error(`Invalid ${name} registry response`);
      const map = buschCoreMap(rows, BUSCH_REGISTRY_IDS[name]);
      this.onLoad(name, map); return map;
    }).catch(error => { if (this.promises.get(name) === pending) this.promises.delete(name); throw error; });
    this.promises.set(name, pending); return pending;
  }
  invalidate(name) { this.promises.delete(name); }
  clear() { this.generation++; this.promises.clear(); }
}
class BuschEntityIndex {
  constructor() {
    this.entities = new Map(); this.devices = new Map(); this.areas = new Map(); this.floors = new Map(); this.labels = new Map(); this.registry = new Map(); this.states = new Map(); this.order = new Map(); this.nextOrder = 0;
    this.indices = Object.fromEntries(["domain", "state", "integration", "config_entry", "device", "area", "floor", "label", "manufacturer", "model", "entity_category"].map(key => [key, new Map()]));
    this.deviceIndices = { via_device_id: new Map(), config_entry_id: new Map() };
    // #641: Versionen je Gerät ("#"+entity_id ohne Gerät) und Epoche je rebuild() für track()/unchanged().
    this.devVersion = new Map(); this.epoch = 0;
  }
  keys(info) {
    return { domain: [info.domain], state: [info.state], integration: [info.platform], config_entry: [info.config_entry_id], device: [info.device_id], area: [info.area_id], floor: [info.floor_id], label: info.labels, manufacturer: [info.manufacturer], model: [info.model], entity_category: [info.entity_category] };
  }
  update(id, state) {
    if (state) { if (!this.order.has(id)) this.order.set(id, this.nextOrder++); this.states.set(id, state); } else { this.states.delete(id); this.order.delete(id); }
    const old = this.entities.get(id);
    const bump = key => this.devVersion.set(key, (this.devVersion.get(key) || 0) + 1), deviceId = this.registry.get(id)?.device_id;
    bump("#" + id); if (old?.device_id) bump(old.device_id); if (deviceId && deviceId !== old?.device_id) bump(deviceId);
    if (old) for (const [field, keys] of Object.entries(this.keys(old))) for (const key of keys) buschCoreSet(this.indices[field], key, id, false);
    const entry = this.registry.get(id);
    if (!entry && !state) { this.entities.delete(id); return { id, old, next: undefined }; }
    const device = this.devices.get(entry?.device_id);
    const area_id = entry?.area_id || device?.area_id;
    const next = { entity_id: id, domain: id.split(".")[0], registry: entry, stateObject: state || undefined, attributes: state?.attributes || {}, state: state?.state,
      platform: entry?.platform, config_entry_id: entry?.config_entry_id, device_id: entry?.device_id,
      area_id, floor_id: this.areas.get(area_id)?.floor_id,
      labels: [...new Set([...(entry?.labels || []), ...(device?.labels || [])])], manufacturer: device?.manufacturer, model: device?.model, entity_category: entry?.entity_category };
    this.entities.set(id, next);
    for (const [field, keys] of Object.entries(this.keys(next))) for (const key of keys) buschCoreSet(this.indices[field], key, id);
    return { id, old, next };
  }
  rebuild() {
    this.epoch++;
    this.order = new Map([...this.states.keys()].map((id, i) => [id, i])); this.nextOrder = this.order.size;
    this.entities.clear(); for (const map of Object.values(this.indices)) map.clear();
    for (const map of Object.values(this.deviceIndices)) map.clear();
    for (const device of this.devices.values()) {
      buschCoreSet(this.deviceIndices.via_device_id, device.via_device_id, device.id);
      for (const entry of device.config_entries || []) buschCoreSet(this.deviceIndices.config_entry_id, entry, device.id);
    }
    for (const id of new Set([...this.states.keys(), ...this.registry.keys()])) this.update(id, this.states.get(id));
  }
}
/* Internal declarative API; auto-entities compatibility is an adapter. */
function buschCoreKey(value) {
  if (Array.isArray(value)) return '[' + value.map(buschCoreKey).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + buschCoreKey(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
/* Shared editor contract for the standalone Busch bundle. */
function buschEditorCopy(value){return BuschUI.cloneConfig(value);}
function buschEditorUpdate(config,patch){return BuschUI.updateConfig(config,patch);}
function buschEditorUpdatePath(config,path,value){return BuschUI.updateConfigPath(config,path,value);}
function buschEditorDeletePath(config,path){return BuschUI.deleteConfigPath(config,path);}
class BuschEditorBase extends BuschUI.EditorBase {}

function buschCorePath(object, path) { return String(path).split(/[.:]/).reduce((value, key) => value?.[key], object); }
function buschCoreMatch(value, pattern) {
  if (typeof pattern !== 'string') return value === pattern;
  if (pattern.startsWith('$$')) return buschCoreMatch(JSON.stringify(value), pattern.slice(2));
  if (pattern.startsWith('/') && pattern.endsWith('/')) return typeof value === 'string' && new RegExp(pattern.slice(1, -1)).test(value);
  const numeric = pattern.match(/^\s*(<=|>=|==|!=|<|>|=)\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (numeric) {
    const a = parseFloat(value), b = Number(numeric[2]);
    if (!Number.isFinite(a)) return false;
    return ({ '<': a < b, '>': a > b, '<=': a <= b, '>=': a >= b, '=': a === b, '==': a === b, '!=': a !== b })[numeric[1]];
  }
  return value === pattern;
}
const BUSCH_QUERY_FIELDS = { domain: 'domain', entity_id: 'entity_id', state: 'state', integration: 'platform', config_entry: 'config_entry_id', device: 'device_id', area: 'area_id', floor: 'floor_id', label: 'labels', device_manufacturer: 'manufacturer', device_model: 'model', entity_category: 'entity_category' };
const BUSCH_QUERY_INDEX = { domain: 'domain', state: 'state', integration: 'integration', config_entry: 'config_entry', device: 'device', area: 'area', floor: 'floor', label: 'label', device_manufacturer: 'manufacturer', device_model: 'model', entity_category: 'entity_category' };
const BUSCH_QUERY_TIME = new Set(['last_changed', 'last_updated', 'last_seen']);
function buschCompileRule(rule) {
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) throw new Error('Invalid query rule');
  const tests = [], guards = [], lookups = [], timeRules = [];
  for (const [raw, value] of Object.entries(rule)) {
    const key = raw.trim().split(/\s+/)[0];
    if (BUSCH_QUERY_TIME.has(key)) {
      const parsed = String(value).match(/^\s*(<=|>=|==|!=|<|>|=)?\s*(\d+(?:\.\d+)?)\s*(m|h|d)?(?:\s+ago)?\s*$/i);
      if (!parsed) throw new Error('Invalid time rule: ' + key);
      const operator = parsed[1] || '=', duration = Number(parsed[2]) * ({ m: 60000, h: 3600000, d: 86400000 }[(parsed[3] || 'm').toLowerCase()]);
      const timestamp = info => Date.parse(key === 'last_seen' ? info.attributes.last_seen : info.stateObject?.[key]);
      tests.push((info, now) => buschCoreMatch(now - timestamp(info), operator + ' ' + duration)); timeRules.push({ timestamp, duration });
    } else if (key === 'attributes') {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid attributes rule');
      tests.push(info => Object.entries(value).every(([path, pattern]) => buschCoreMatch(buschCorePath(info.attributes, path.split(' ')[0]), pattern)));
    } else if (key === 'name') tests.push(info => buschCoreMatch(info.attributes.friendly_name, value));
    else if (key === 'hidden_by') { const fn = info => buschCoreMatch(info.registry?.hidden_by, value); tests.push(fn); guards.push(fn); }
    else if (key in BUSCH_QUERY_FIELDS) {
      const field = BUSCH_QUERY_FIELDS[key];
      const fn = info => key === 'label' ? info.labels.some(label => buschCoreMatch(label, value)) : buschCoreMatch(info[field], value) || (key === 'integration' && buschCoreMatch(info.config_entry_id, value));
      tests.push(fn); if (key !== 'state') guards.push(fn);
      if (typeof value === 'string' && !value.startsWith('$$') && !/[*/<>=!]/.test(value)) lookups.push([key, value]);
    } else throw new Error('Unsupported query rule: ' + key);
  }
  return { test: (info, now) => !!info?.stateObject && tests.length > 0 && tests.every(fn => fn(info, now)), guard: info => !!info && guards.every(fn => fn(info)), lookups, timeRules };
}
class BuschQueryEngine {
  constructor(core) { this.core = core; this.cache = new Map(); this.timer = null; }
  query(spec) {
    const copy = JSON.parse(JSON.stringify(spec)), key = buschCoreKey(copy);
    if (this.cache.has(key)) return this.cache.get(key);
    const filter = copy.filter || {};
    const query = { key, spec: copy, include: (filter.include || []).map(buschCompileRule), exclude: (filter.exclude || []).map(buschCompileRule), members: new Set(), deadlines: new Map(), nextDeadline: Infinity, subscribers: new Set(), result: Object.freeze([]), metrics: { calculations: 0, evaluated: 0, candidates: 0, executionMs: 0 } };
    this.cache.set(key, query); this.calculate(query); this.evict(); return query;
  }
  evict() {
    if (this.cache.size <= 128) return;
    for (const [key, query] of this.cache) { if (!query.subscribers.size) this.cache.delete(key); if (this.cache.size <= 128) break; }
  }
  candidates(rule) {
    const sets = [];
    for (const [field, value] of rule.lookups) {
      if (field === 'entity_id') sets.push(this.core.entities.has(value) ? new Set([value]) : new Set());
      else if (field === 'integration') sets.push(new Set([...(this.core.index.indices.integration.get(value) || []), ...(this.core.index.indices.config_entry.get(value) || [])]));
      else if (BUSCH_QUERY_INDEX[field]) sets.push(this.core.index.indices[BUSCH_QUERY_INDEX[field]].get(value) || new Set());
    }
    if (!sets.length) return this.core.entities.keys();
    sets.sort((a, b) => a.size - b.size);
    return [...sets[0]].filter(id => sets.every(set => set.has(id)));
  }
  matches(query, info, now) { return query.include.some(rule => rule.test(info, now)) && !query.exclude.some(rule => rule.test(info, now)); }
  calculate(query, ids) {
    if (query.smart) return query.smart.calculate(query, ids);
    const start = performance.now(), now = Date.now(); query.metrics.calculations++; this.core.metrics.queriesRecalculated++;
    if (!ids) { query.members.clear(); query.deadlines.clear(); ids = new Set(query.include.flatMap(rule => [...this.candidates(rule)])); }
    query.metrics.candidates = ids.size ?? ids.length;
    for (const id of ids) { query.metrics.evaluated++; if (this.matches(query, this.core.getEntity(id), now)) query.members.add(id); else query.members.delete(id); }
    const timed = [...query.include, ...query.exclude].filter(rule => rule.timeRules.length);
    for (const id of ids) {
      let next = Infinity; const info = this.core.getEntity(id);
      if (info?.stateObject) for (const rule of timed) {
        if (!rule.guard(info)) continue;
        for (const time of rule.timeRules) {
          const boundary = time.timestamp(info) + time.duration;
          for (const at of [boundary, boundary + 1]) if (at > now) next = Math.min(next, at);
        }
      }
      if (Number.isFinite(next)) query.deadlines.set(id, next); else query.deadlines.delete(id);
    }
    query.nextDeadline = Infinity;
    for (const at of query.deadlines.values()) query.nextDeadline = Math.min(query.nextDeadline, at);
    const result = [...query.members].sort();
    if (result.length !== query.result.length || result.some((id, index) => id !== query.result[index])) {
      query.result = Object.freeze(result); this.core.metrics.resultChanges++;
      for (const fn of query.subscribers) { try { fn(query.result); } catch (error) { console.warn('Busch Core subscriber failed', error?.name); } }
    }
    query.metrics.executionMs = performance.now() - start;
  }
  changed({ id, old, next }) {
    for (const query of this.cache.values()) {
      if (query.smart) { query.smart.changed(query, {id,old,next}); continue; }
      if (query.include.some(rule => rule.guard(old) || rule.guard(next))) this.calculate(query, [id]); else this.core.metrics.queriesSkipped++;
    }
    this.schedule();
  }
  refresh() { for (const query of this.cache.values()) this.calculate(query); this.schedule(); }
  subscribe(query, fn) {
    if (typeof fn !== 'function') throw new Error('A query subscriber must be a function');
    if (!this.cache.has(query.key)) { this.cache.set(query.key, query); this.calculate(query); }
    query = this.cache.get(query.key);
    query.subscribers.add(fn);
    try { fn(query.result); } catch (error) { console.warn('Busch Core subscriber failed', error?.name); }
    query.smart?.startTemplate(query);
    this.schedule();
    let active = true;
    return () => { if (!active) return; active = false; query.subscribers.delete(fn); if (!query.subscribers.size) { query.smart?.stop(query); this.cache.delete(query.key); } this.schedule(); };
  }
  schedule() {
    let deadline = Infinity;
    for (const query of this.cache.values()) if (query.subscribers.size) deadline = Math.min(deadline, query.nextDeadline);
    if (this.timer !== null && this.deadline === deadline) return;
    if (this.timer !== null) clearTimeout(this.timer); this.timer = null; this.deadline = deadline;
    if (Number.isFinite(deadline)) this.timer = setTimeout(() => {
      this.timer = null; const now = Date.now();
      for (const query of this.cache.values()) if (query.subscribers.size && query.nextDeadline <= now) this.calculate(query);
      this.schedule();
    }, Math.min(2147483647, Math.max(1, deadline - Date.now())));
  }
  stop() { for (const query of this.cache.values()) query.smart?.stop(query); if (this.timer !== null) clearTimeout(this.timer); this.timer = null; }
}
class BuschCardsCore {
  constructor() {
    this.apiVersion = "1.0"; this.version = "1.0.0"; this.index = new BuschEntityIndex(); this.metrics = { stateUpdates: 0, queriesSkipped: 0, queriesRecalculated: 0, resultChanges: 0, domRenders: null, structuralBuilds: 0 };
    this.registry = new BuschRegistryCache(null, (name, map) => {
      this.index[name === "entity" ? "registry" : name === "device" ? "devices" : name === "area" ? "areas" : name === "floor" ? "floors" : "labels"] = map;
      this.lastErrors.delete(name);
      // #641: Mehrere Registerladungen bauen den Index höchstens einmal je Mikrotask neu.
      if (!this._rebuildQueued) { this._rebuildQueued = true; Promise.resolve().then(() => { this._rebuildQueued = false; this.index.rebuild(); this.engine?.refresh(); }); }
      if (!this._notifyQueued) { this._notifyQueued = true; Promise.resolve().then(() => {
        this._notifyQueued = false;
        for (const listener of this._listeners) { try { listener(); } catch (error) { console.warn("Busch Core registry listener failed", error?.name); } }
      }); }
    });
    this._listeners = new Set(); this._deviceListeners = new Map(); this._dirtyDevices = new Set(); this.lastErrors = new Map(); this.unsubscribers = []; this.generation = 0; this.users = 0;
    this.ready = Promise.resolve(); this.engine = new BuschQueryEngine(this);
  }
  get entities() { return this.index.entities; }
  get devices() { return this.index.devices; }
  get areas() { return this.index.areas; }
  get floors() { return this.index.floors; }
  get labels() { return this.index.labels; }
  getEntity(id) { const entity = this.entities.get(id); if (this._track) this._track.add(entity?.device_id || "#" + id); return entity; }
  getDevice(id) { return this.devices.get(id); }
  getDeviceEntities(id) { if (this._track) this._track.add(id); return [...(this.index.indices.device.get(id) || [])].map(entity => this.entities.get(entity)); }
  // #641: Merkt sich, welche Geräte/Entitäten fn() über getEntity/getDeviceEntities liest; unchanged() prüft deren Versionen.
  track(fn) {
    const outer = this._track, read = new Set(); this._track = read;
    try { fn(); } finally { this._track = outer; if (outer) for (const key of read) outer.add(key); }
    return { epoch: this.index.epoch, versions: [...read].map(key => [key, this.index.devVersion.get(key) || 0]) };
  }
  unchanged(deps) { return !!deps && deps.versions.length > 0 && deps.epoch === this.index.epoch && deps.versions.every(([key, version]) => (this.index.devVersion.get(key) || 0) === version); }
  seed(hass) {
    this.index.registry = buschCoreMap(hass.entities, "entity_id"); this.index.devices = buschCoreMap(hass.devices, "id");
    this.index.areas = buschCoreMap(hass.areas, "area_id"); this.index.floors = buschCoreMap(hass.floors, "floor_id");
    this.index.states = new Map(Object.entries(hass.states || {})); this.index.rebuild(); this._states = hass.states;
    this._display = [hass.entities, hass.devices, hass.areas, hass.floors]; this.engine?.refresh();
  }
  attach(hass) {
    if (!hass) return;
    const identity = hass.connection || hass;
    if (this.connection === identity) {
      const languageChanged = this._language !== buschCoreKey(hass.locale || hass.language);
      this.hass = hass; this.registry.hass = hass; this._language = buschCoreKey(hass.locale || hass.language);
      if (languageChanged) this.engine.refresh();
      if (!this.streaming && [hass.entities, hass.devices, hass.areas, hass.floors].some((value, index) => value !== this._display[index])) this.seed(hass);
      // Without a stream, compare state references once for the shared runtime.
      if (!this.streaming && this._states !== hass.states) this.syncStates(hass.states || {});
      return;
    }
    this.dispose(); this.index.labels = new Map(); this.lastErrors.clear(); this.connection = identity; this.hass = hass; this.registry.hass = hass; this._language = buschCoreKey(hass.locale || hass.language); this.seed(hass);
    const generation = this.generation;
    const connection = hass.connection;
    let stateReady = Promise.resolve();
    if (typeof connection?.subscribeEvents === "function") {
      this._stateBuffer = [];
      const subscribe = (type, callback) => {
        return Promise.resolve(connection.subscribeEvents(event => { if (generation === this.generation) callback(event); }, type)).then(unsubscribe => {
          if (generation !== this.generation) unsubscribe(); else {
            this.unsubscribers.push(unsubscribe);
            if (type === "state_changed") return this.syncStream();
          }
        }).catch(() => { if (generation === this.generation) this.streaming = false; });
      };
      stateReady = subscribe("state_changed", event => {
        if (this._stateBuffer) this._stateBuffer.push(event.data);
        else this.updateState(event.data.entity_id, event.data.new_state);
      });
      for (const name of Object.keys(BUSCH_REGISTRY_IDS)) subscribe(`${name}_registry_updated`, () => {
        this._dirtyRegistries ||= new Set(); this._dirtyRegistries.add(name);
        if (this._registryTimer) return;
        this._registryTimer = setTimeout(() => { this._registryTimer = null; const names = [...this._dirtyRegistries]; this._dirtyRegistries.clear(); this.refreshRegistries(names, true); }, 50);
      });
      if (typeof connection.addEventListener === "function") {
        const onReady = () => {
          if (generation !== this.generation) return;
          this.registry.clear(); this._refreshing.clear(); this._queuedRefresh?.clear();
          this._snapshotEpoch = (this._snapshotEpoch || 0) + 1; this._snapshotPromise = null; this._stateBuffer = []; this.streaming = false;
          this.ready = Promise.all([this.syncStream(), this.refreshRegistries()]); return this.ready;
        };
        connection.addEventListener("ready", onReady);
        this.unsubscribers.push(() => connection.removeEventListener?.("ready", onReady));
      }
    }
    this.ready = Promise.all([stateReady, typeof hass.callWS === "function" ? this.refreshRegistries() : Promise.resolve()]);
  }
  syncStream() {
    if (this._snapshotPromise) return this._snapshotPromise;
    const generation = this.generation, epoch = this._snapshotEpoch || 0, hass = this.hass; this._stateBuffer ||= [];
    const pending = Promise.resolve().then(() => hass.callWS({ type: "get_states" })).then(rows => {
      if (generation !== this.generation || epoch !== (this._snapshotEpoch || 0)) return;
      if (!Array.isArray(rows)) throw new Error("Invalid state snapshot");
      const states = Object.fromEntries(rows.map(state => [state.entity_id, state]));
      for (const event of this._stateBuffer || []) {
        const previous = states[event.entity_id], next = event.new_state;
        if (!next) delete states[event.entity_id];
        else if (!previous || !previous.last_updated || !next.last_updated || next.last_updated >= previous.last_updated) states[event.entity_id] = next;
      }
      this._stateBuffer = null; this.syncStates(states); this.streaming = true; this.lastErrors.delete("states");
    }).catch(error => {
      if (generation !== this.generation || epoch !== (this._snapshotEpoch || 0)) return;
      for (const event of this._stateBuffer || []) this.updateState(event.entity_id, event.new_state);
      this._stateBuffer = null; this.streaming = false; this.lastErrors.set("states", error);
    }).finally(() => { if (this._snapshotPromise === pending) this._snapshotPromise = null; });
    this._snapshotPromise = pending; return pending;
  }
  syncStates(states) {
    const ids = new Set([...this.index.states.keys(), ...Object.keys(states)]);
    const changes = [];
    for (const id of ids) {
      if (this.index.states.get(id) === states[id]) continue;
      this.metrics.stateUpdates++;
      const change = this.index.update(id, states[id]);
      for (const device of [change.old?.device_id, change.next?.device_id]) if (device && this._deviceListeners.has(device)) this._dirtyDevices.add(device);
      changes.push(change);
    }
    this._states = states;
    if (changes.length === 1) this.engine?.changed(changes[0]);
    else if (changes.length > 1) this.engine?.refresh();
    this.notifyDevices();
  }
  updateState(id, state) {
    this.metrics.stateUpdates++; const change = this.index.update(id, state); this.engine?.changed(change);
    for (const device of [change.old?.device_id, change.next?.device_id]) if (device && this._deviceListeners.has(device)) this._dirtyDevices.add(device);
    this.notifyDevices();
  }
  notifyDevices() {
    if (this._dirtyDevices.size && !this._deviceNotifyQueued) {
      this._deviceNotifyQueued = true;
      Promise.resolve().then(() => {
        this._deviceNotifyQueued = false; const ids = [...this._dirtyDevices]; this._dirtyDevices.clear();
        for (const device of ids) for (const listener of this._deviceListeners.get(device) || []) { try { listener(); } catch {} }
      });
    }
  }
  watchDevice(deviceId, callback) {
    if (!this._deviceListeners.has(deviceId)) this._deviceListeners.set(deviceId,new Set());
    const listeners = this._deviceListeners.get(deviceId); listeners.add(callback);
    return () => { listeners.delete(callback); if (!listeners.size && this._deviceListeners.get(deviceId) === listeners) this._deviceListeners.delete(deviceId); };
  }
  refreshRegistries(names = Object.keys(BUSCH_REGISTRY_IDS), afterPending = false) {
    const generation = this.generation;
    this._refreshing ||= new Map(); this._queuedRefresh ||= new Set();
    return Promise.all(names.map(name => {
      if (this._refreshing.has(name)) {
        if (afterPending) this._queuedRefresh.add(name);
        return this._refreshing.get(name);
      }
      if (this.registry.promises.has(name)) this.registry.invalidate(name);
      const pending = this.registry.load(name).catch(error => {
        if (generation === this.generation) { this.lastErrors.set(name, error); for (const listener of this._listeners) { try { listener(); } catch {} } }
        return null;
      }).finally(() => {
        if (generation !== this.generation || this._refreshing.get(name) !== pending) return;
        this._refreshing.delete(name);
        if (this._queuedRefresh.delete(name)) return this.refreshRegistries([name]);
      });
      this._refreshing.set(name, pending); return pending;
    }));
  }
  loadEntityRegistry() { return this.registry.load("entity"); }
  loadDeviceRegistry() { return this.registry.load("device"); }
  loadAreaRegistry() { return this.registry.load("area"); }
  loadFloorRegistry() { return this.registry.load("floor"); }
  loadLabelRegistry() { return this.registry.load("label"); }
  watch(callback) { this._listeners.add(callback); return () => this._listeners.delete(callback); }
  // #641: Freigabe erst nach 30 s Schonfrist; ein neues retain() bricht sie ab (erneutes Öffnen des Kartenwählers holt sonst wieder alles).
  retain(hass) {
    if (this._releaseTimer) { clearTimeout(this._releaseTimer); this._releaseTimer = null; } this.attach(hass); this.users++; let released = false;
    return () => {
      if (released) return; released = true;
      if (--this.users <= 0) { if (this._releaseTimer) clearTimeout(this._releaseTimer); this._releaseTimer = setTimeout(() => { this._releaseTimer = null; if (this.users <= 0) this.dispose(); }, 30000); }
    };
  }
  query(spec) { return this.engine.query(spec); }
  smartQuery(spec, scopeDeviceId) { this.smart ||= new BuschSmartQueries(this); return this.smart.query(spec, scopeDeviceId); }
  subscribe(query, callback) { return this.engine.subscribe(query, callback); }
  debugSnapshot() { return { ...this.metrics, entities: this.entities.size, devices: this.devices.size, registryRequests: { ...this.registry.requests }, errors: [...this.lastErrors.keys()] }; }
  dispose() {
    if (this._releaseTimer) { clearTimeout(this._releaseTimer); this._releaseTimer = null; } this.generation++; for (const unsubscribe of this.unsubscribers.splice(0)) Promise.resolve(unsubscribe()).catch(() => {});
    this.streaming = false; this.connection = null; this.registry.clear(); this._refreshing = new Map(); this._queuedRefresh = new Set(); this._snapshotPromise = null; this._stateBuffer = null;
    if (this._registryTimer) clearTimeout(this._registryTimer); this._registryTimer = null; this._dirtyRegistries?.clear(); this._dirtyDevices.clear(); this.engine?.stop();
  }
}
function ensureBuschCore(requiredApiVersion = 1) {
  const major = Number(String(requiredApiVersion).split(".")[0]);
  if (major !== 1) throw new Error(`Busch Cards Core API ${major} is incompatible with API 1 / ist mit API 1 nicht kompatibel.`);
  const core = globalThis[BUSCH_CORE_KEY] || (globalThis[BUSCH_CORE_KEY] = new BuschCardsCore());
  if (Number(String(core.apiVersion).split(".")[0]) !== major) throw new Error("Busch Cards Core API mismatch / inkompatible API-Version.");
  return core;
}

// auto-entities 1.16.1 compatibility semantics, adapted for Busch's shared index.
// Upstream: https://github.com/thomasloven/lovelace-auto-entities
// Attribution and MIT permission notice follow this compatibility section.
function buschSmartMatch(value, pattern, now = Date.now()) {
  const checks = [];
  if (typeof pattern === 'string') {
    if (pattern.startsWith('$$')) { pattern = pattern.slice(2); value = JSON.stringify(value); }
    if ((pattern.startsWith('/') && pattern.endsWith('/')) || pattern.includes('*')) {
      if (!pattern.startsWith('/')) pattern = '/^' + pattern.replace(/\*/g, '.*') + '$/';
      const regex = new RegExp(pattern.slice(1, -1));
      checks.push(v => typeof v === 'string' && regex.test(v));
    }
    const age = /([mhd])\s+ago\s*$/i.exec(pattern);
    if (age) {
      pattern = pattern.replace(age[0], '');
      value = (now - new Date(value).getTime()) / 60000 / (age[1] === 'h' ? 60 : age[1] === 'd' ? 1440 : 1);
    }
    // Deliberately independent: upstream's overlapping != / ! comparisons
    // and unescaped glob punctuation are part of the imported config contract.
    const ops = {'<=':(a,b)=>a<=b,'>=':(a,b)=>a>=b,'==':(a,b)=>a===b,'!=':(a,b)=>a!==b,'<':(a,b)=>a<b,'>':(a,b)=>a>b,'!':(a,b)=>a!==b,'=':(a,b)=>a===b};
    for (const [op, test] of Object.entries(ops)) if (pattern.startsWith(op)) {
      const limit = parseFloat(pattern.slice(op.length)); checks.push(v => test(parseFloat(v), limit));
    }
  }
  return value !== undefined && (value === pattern || checks.some(fn => fn(value)));
}
function buschSmartContext(core, id) {
  const info = core.entities.get(id), entity = info?.registry;
  const state = core.index.states.get(id);
  const device = core.devices.get(entity?.device_id);
  const area = core.areas.get(entity?.area_id) || core.areas.get(device?.area_id);
  const floor = core.floors.get(area?.floor_id);
  return {info, entity, state, device, area, floor};
}
function buschSmartPath(value, path, valueOutput = false) {
  if (valueOutput && value && Object.hasOwn(value, String(path))) return value[String(path)];
  return String(path).split(valueOutput ? /[.:]/ : ':').reduce((obj, key) => obj?.[key], value);
}
function buschSmartFilter(core, rule, id, now = Date.now()) {
  if (typeof id !== 'string') id = id?.entity;
  const {entity, state, device, area, floor} = buschSmartContext(core, id);
  if (!state) return false;
  const entries = Object.entries(rule).map(([key,value]) => [key.trim().split(' ')[0].trim(),value]).filter(([key]) => !['type','options','sort'].includes(key));
  if (!entries.length) return false;
  return entries.every(([key,value]) => {
    const match = v => buschSmartMatch(v,value,now);
    switch (key) {
      case 'domain': return match(id.split('.')[0]);
      case 'entity_id': return match(id);
      case 'state': return match(state.state) || match(core.hass.formatEntityState(state));
      case 'name': return match(state.attributes?.friendly_name);
      case 'group': return !!core.index.states.get(value)?.attributes?.entity_id?.includes(id);
      case 'attributes': return Object.entries(value).every(([k,v]) => buschSmartMatch(buschSmartPath(state.attributes,k.split(' ')[0]),v,now));
      case 'not': return !buschSmartFilter(core,value,id,now);
      case 'and': return value.every(v => buschSmartFilter(core,v,id,now));
      case 'or': return value.some(v => buschSmartFilter(core,v,id,now));
      case 'device': return !!device && (match(device.id) || match(device.name_by_user) || match(device.name));
      case 'device_manufacturer': return !!device && match(device.manufacturer);
      case 'device_model': return !!device && match(device.model);
      case 'area': return !!entity && !!area && (match(area.name) || match(area.area_id));
      case 'floor': return !!entity && !!floor && (match(floor.name) || match(floor.floor_id));
      case 'level': return !!entity && !!floor && match(floor.level);
      case 'entity_category': return !!entity && match(entity.entity_category);
      case 'hidden_by': return !!entity && match(entity.hidden_by);
      case 'integration': return !!entity && (match(entity.platform) || match(entity.config_entry_id));
      case 'label': {
        if (!entity?.labels) return false;
        const labelMatch = label => match(label) || match(core.labels.get(label)?.name);
        return entity.labels.some(labelMatch) || !!device && device.labels.some(labelMatch);
      }
      case 'last_changed': case 'last_updated': case 'last_triggered':
        return buschSmartMatch(key === 'last_triggered' ? state.attributes.last_triggered : state[key], /([mhd])\s+ago\s*$/i.test(value) ? value : value + 'm ago',now);
      default: return false;
    }
  });
}
function buschSmartCompare(a,b,sort) {
  const [lt,gt] = sort.reverse ? [1,-1] : [-1,1];
  if (sort.ignore_case) { a=a?.toLowerCase?.()??a; b=b?.toLowerCase?.()??b; }
  if (sort.numeric && !(isNaN(parseFloat(a)) && isNaN(parseFloat(b)))) {
    a=isNaN(parseFloat(a))?undefined:parseFloat(a); b=isNaN(parseFloat(b))?undefined:parseFloat(b);
  }
  if (a===undefined && b===undefined) return 0;
  if (a===undefined) return gt;
  if (b===undefined) return lt;
  if (sort.numeric) return a===b?0:a<b?lt:gt;
  if (sort.ip) {
    const aa=a.split('.'),bb=b.split('.');
    return (sort.reverse?-1:1) * ([0,1,2,3].map(i=>buschSmartCompare(aa[i],bb[i],{numeric:true})).find(v=>v!==0)||0);
  }
  return (sort.reverse?-1:1)*String(a).localeCompare(String(b),undefined,sort);
}
function buschSmartSort(core, rows, sort) {
  const methods = ['none','domain','entity_id','friendly_name','name','device','device_name','area','state','attribute','last_changed','last_updated','last_triggered'];
  if (!sort?.method || !methods.includes(sort.method)) return rows;
  const method = {...sort};
  if (['last_changed','last_updated','last_triggered'].includes(method.method)) method.numeric=true;
  const prepare = row => {
    const {state,device,area}=buschSmartContext(core,row.entity);
    switch(method.method) {
      case 'none': return 0;
      case 'domain': return state?.entity_id?.split('.')[0];
      case 'entity_id': return state?.entity_id;
      case 'friendly_name': case 'name': return state?.attributes?.friendly_name || state?.entity_id?.split('.')[1];
      case 'device': case 'device_name': return device?.name_by_user??device?.name;
      case 'area': return area?.name;
      case 'state': return state?.state;
      case 'attribute': return method.attribute?.split(':').reduce((v,k)=>v?.[k],state?.attributes);
      default: { const value=method.method==='last_triggered'?state?.attributes?.last_triggered:state?.[method.method]; return value?new Date(value).getTime():undefined; }
    }
  };
  return rows.map(row=>({row,key:prepare(row)})).sort((a,b)=>buschSmartCompare(a.key,b.key,method)).map(x=>x.row);
}
function buschSmartPage(rows, sort) {
  if (!sort?.count && !sort?.first) return rows;
  const first=sort.first??0;return rows.slice(first,first+(sort.count??Infinity));
}
function buschSmartProcess(core, row, id) {
  const {entity,device,area,state}=buschSmartContext(core,id);
  let text=JSON.stringify(row).replace(/this.entity_id/g,id);
  if (row.eval_js === true) {
    const evaluate=new Function('entity_id','entity','device','area','state','"use strict"; return (String.raw`'+text+'`);');
    try { text=evaluate(id,entity?.name_by_user??entity?.name,device?.name_by_user??device?.name,area?.name_by_user??area?.name,state); }
    catch(error) { return {error:error.message}; }
  }
  return JSON.parse(text);
}
function buschSmartValueKey(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array:['+value.map(buschSmartValueKey).join(',')+']';
  if (typeof value === 'object') return 'object:{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+buschSmartValueKey(value[k])).join(',')+'}';
  return typeof value+':'+JSON.stringify(value);
}
function buschSmartUnique(rows, unique) {
  if (!unique) return rows;
  const seen=new Set();return rows.filter(row=>{const key=unique==='entity'?row.entity:buschSmartValueKey(row);if(seen.has(key))return false;seen.add(key);return true;});
}
function buschSmartResult(core, config, templateRows = [], matchedIncludes = null, trace = null) {
  if(trace)Object.assign(trace,{rows:[],missing:0,duplicates:0,projected:0,output:0,truncated:false});
  const record=entry=>{if(!trace)return;if(trace.rows.length<100)trace.rows.push(entry);else trace.truncated=true;};
  const format=row=>!row?null:typeof row==='string'?{entity:row.trim()}:row;
  const contexts=new Map();
  let rows=[...(config.entities||[]),...(templateRows||[])].map(format).filter(Boolean);
  for (const [index,rule] of (config.filter?.include||[]).entries()) {
    if (rule.type!==undefined) { rows.push(rule);continue; }
    const ids=matchedIncludes?.[index]??[...core.index.states.keys()].filter(id=>buschSmartFilter(core,rule,id));
    const add=buschSmartPage(buschSmartSort(core,Array.from(ids,id=>({entity:id})),rule.sort),rule.sort);
    rows.push(...add.map(row=>{const processed=buschSmartProcess(core,{...row,...rule.options},row.entity);contexts.set(processed,row.entity);return processed;}));
  }
  rows=rows.filter(row=>!(config.filter?.exclude||[]).some(rule=>buschSmartFilter(core,rule,row.entity)));
  if (!config.value) return buschSmartPage(buschSmartUnique(buschSmartSort(core,config.unique_values?buschSmartUnique(rows,true):rows,config.sort),config.unique),config.sort);
  rows=buschSmartUnique(rows,config.unique);
  const seen=new Set(), projected=[];
  for (const row of rows) {
    const sourceId=contexts.get(row)??row.entity;
    const {entity,state}=buschSmartContext(core,sourceId);
    const type=config.value.type||'entity_id';
    let value=type==='entity_id'?sourceId:type==='device_id'?entity?.device_id:buschSmartPath(state?.attributes,config.value.attribute??config.value.path??'',true);
    if (value===undefined || value===null) {
      if (config.value.missing!=='null' && config.value.missing!==null) {if(trace){trace.missing++;record({source:sourceId,value:null,status:'missing'});}continue;}
      value=null;
    }
    const key=buschSmartValueKey(value);
    if(config.unique_values && seen.has(key)){if(trace){trace.duplicates++;record({source:sourceId,value,status:'duplicate'});}continue;}
    if(trace)record({source:sourceId,value,status:'limited'});seen.add(key);projected.push({entity:sourceId,value});
  }
  const selected=buschSmartPage(buschSmartSort(core,projected,config.sort),config.sort);
  if(trace){trace.projected=projected.length;trace.output=selected.length;const ids=new Set(selected.map(row=>row.entity));for(const row of trace.rows)if(row.status==='limited'&&ids.has(row.source))row.status='selected';}
  return selected.map(row=>row.value);
}

/*
MIT License

Copyright (c) 2019 Thomas Lovén

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

function buschSmartSnapshot(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(buschSmartSnapshot));
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(Object.entries(value).map(([key,item])=>[key,buschSmartSnapshot(item)])));
  return value;
}
/* Smart Entities: shared incremental membership and final projection. */
function buschSmartPlan(rule) {
  const constraints = [], groups = new Set(), times = [];
  const walk = (node, safe = true) => {
    if (!node || typeof node !== 'object') return;
    for (const [raw, value] of Object.entries(node)) {
      const key = raw.trim().split(' ')[0];
      if (key === 'group') groups.add(value);
      if (key === 'and') { for (const child of value) walk(child, safe); }
      if (key === 'or') { for (const child of value) walk(child, false); }
      if (key === 'not') walk(value, false);
      if (safe && ['domain', 'integration', 'entity_id'].includes(key) && typeof value === 'string' && !value.startsWith('$$') && !/[*/<>=!]/.test(value)) constraints.push([key, value]);
      const time = (path, pattern) => {
        const text=String(pattern),match=text.match(/([mhd])\s+ago\s*$/i);
        const amount=match?parseFloat(text.slice(0,match.index).replace(/^\s*[<>=!]+/,'')):NaN;
        if (Number.isFinite(amount)) times.push({path,duration:amount*(match[1]==='h'?3600000:match[1]==='d'?86400000:60000)});
      };
      if (['last_changed','last_updated','last_triggered'].includes(key)) time(key === 'last_triggered' ? ['attributes',key] : [key], /[mhd]\s+ago\s*$/i.test(value) ? value : value + 'm ago');
      if (['state','entity_id','name'].includes(key)) time(key === 'name' ? ['attributes','friendly_name'] : [key], value);
      if (key === 'attributes') for (const [attr, pattern] of Object.entries(value || {})) time(['attributes',...attr.split(' ')[0].split(':')], pattern);
    }
  };
  walk(rule);
  return { constraints, groups, times, guard: info => !!info && constraints.every(([key,value]) => key === 'entity_id' ? info.entity_id === value : key === 'domain' ? info.domain === value : info.registry?.platform === value || info.registry?.config_entry_id === value) };
}
class BuschSmartQueries {
  constructor(core) { this.core = core; }
  query(config, scopeDeviceId) {
    const copy = JSON.parse(JSON.stringify(config)), cacheSpec = {...copy};
    if (!copy.filter?.template) for (const key of ['type','card','card_param','item','item_param','else','show_empty','debug']) delete cacheSpec[key];
    const key = 'smart:' + buschCoreKey(scopeDeviceId?{scopeDeviceId,spec:cacheSpec}:cacheSpec), engine = this.core.engine;
    if (engine.cache.has(key)) return engine.cache.get(key);
    const include = copy.filter?.include || [];
    const query = { key, scopeDeviceId, spec: copy, smart: this, javascript:(copy.filter?.include||[]).some(rule=>rule.options?.eval_js===true), include: include.map(buschSmartPlan), extraPlans:(copy.filter?.exclude||[]).map(buschSmartPlan), matched:include.map(()=>new Set()), subscribers:new Set(), result:Object.freeze([]), nextDeadline:Infinity, deadlines:new Map(), metrics:{calculations:0,evaluated:0,candidates:0,executionMs:0}, templateRows:[], templateGeneration:0 };
    engine.cache.set(key,query); this.calculate(query); engine.evict(); return query;
  }
  candidates(plan, query) { return this.core.engine.candidates({lookups:query.scopeDeviceId?[...plan.constraints,['device',query.scopeDeviceId]]:plan.constraints}); }
  changed(query, change) {
    const id = change.id;
    if (query.javascript || [...query.include,...query.extraPlans].some(p=>p.groups.has(id))) return this.calculate(query);
    if(query.scopeDeviceId && ![change.old,change.next].some(info=>info?.device_id===query.scopeDeviceId)){this.core.metrics.queriesSkipped++;return;}
    const statics = [...(query.spec.entities||[]),...query.templateRows];
    if (query.include.some(p=>p.guard(change.old)||p.guard(change.next)) || statics.some(row=>(typeof row==='string'?row.trim():row?.entity)===id)) this.calculate(query,[id]);
    else this.core.metrics.queriesSkipped++;
  }
  calculate(query, ids) {
    try { return this.compute(query, ids); } catch (error) { query.error=error; this.notify(query); }
  }
  compute(query, ids) {
    const start=performance.now(),now=Date.now(); query.metrics.calculations++;this.core.metrics.queriesRecalculated++;
    let touched=new Set();
    for (const [index,rule] of (query.spec.filter?.include||[]).entries()) {
      if (rule.type !== undefined) continue;
      const plan=query.include[index], candidates=ids || this.candidates(plan,query);
      if (!ids) query.matched[index].clear();
      for (const id of candidates) {
        if (!plan.guard(this.core.getEntity(id)) || (query.scopeDeviceId&&this.core.getEntity(id)?.device_id!==query.scopeDeviceId)) { query.matched[index].delete(id);continue; }
        touched.add(id);query.metrics.evaluated++;
        if (buschSmartFilter(this.core,rule,id,now)) query.matched[index].add(id);else query.matched[index].delete(id);
      }
    }
    if (!ids) query.deadlines.clear();
    // Plan every possible age boundary, including excluded and currently absent matches.
    const timed=[...query.include,...query.extraPlans].filter(p=>p.times.length);
    for(const id of ids || new Set([...touched,...[...(query.spec.entities||[]),...query.templateRows].map(e=>typeof e==='string'?e.trim():e.entity)])) {
      let deadline=Infinity;const info=this.core.getEntity(id);
      for(const plan of timed) if(plan.guard(info)) for(const time of plan.times) {
        const stamp=time.path.reduce((v,k)=>v?.[k],info?.stateObject), boundary=new Date(stamp).getTime()+time.duration;
        for(const at of [boundary,boundary+1]) if(at>now) deadline=Math.min(deadline,at);
      }
      if(Number.isFinite(deadline))query.deadlines.set(id,deadline);else query.deadlines.delete(id);
    }
    query.nextDeadline=Infinity;for(const at of query.deadlines.values())query.nextDeadline=Math.min(query.nextDeadline,at);
    query.metrics.candidates=touched.size;
    try {
      const result=buschSmartResult(this.core,query.spec,query.templateRows,query.matched.map(set=>[...set].sort((a,b)=>this.core.index.order.get(a)-this.core.index.order.get(b))));
      const signature=buschCoreKey(result);
      if(signature!==query.signature || query.error){query.signature=signature;query.result=buschSmartSnapshot(result);query.error=query.templateError||null;this.notify(query);}
    }catch(error){query.error=error;this.notify(query);}
    query.metrics.executionMs=performance.now()-start;
    if(query.subscribers.size)this.startTemplate(query);
  }
  notify(query){this.core.metrics.resultChanges++;for(const fn of query.subscribers){try{fn(query.result);}catch(error){console.warn('Busch Smart subscriber failed',error?.name);}}}
  startTemplate(query){
    const template=query.spec.filter?.template;
    if(!template || query.templateActive || !/\{[{%#]/.test(template))return;
    query.templateActive=true;const generation=++query.templateGeneration;
    const connection=this.core.hass?.connection;
    if(typeof connection?.subscribeMessage!=='function'){query.error=query.templateError=new Error('template_unavailable');this.notify(query);return;}
    Promise.resolve().then(()=>connection.subscribeMessage(message=>{
      if(generation!==query.templateGeneration)return;
      if(message.error){query.error=query.templateError=new Error('template_error');this.notify(query);return;}
      query.templateError=null;const raw=message.result;query.templateRows=typeof raw==='string'?raw.split(/[\s,]+/).filter(Boolean):Array.isArray(raw)?raw:[];
      if(query.templateQueued)return;query.templateQueued=true;
      Promise.resolve().then(()=>{query.templateQueued=false;if(generation!==query.templateGeneration)return;this.calculate(query);this.core.engine.schedule();});
    },{type:'render_template',template,variables:{config:query.spec},strict:true})).then(off=>{
      if(generation!==query.templateGeneration)off();else query.templateOff=off;
    }).catch(()=>{if(generation===query.templateGeneration){query.error=query.templateError=new Error('template_error');this.notify(query);}});
  }
  stop(query){query.templateGeneration++;query.templateOff?.();query.templateOff=null;query.templateActive=false;query.templateRows=[];query.templateError=null;}
}


/* === Version und Sprache === */
const CARD_VERSION = "0.4.0";

console.info(
  `%c UNRAID-CARDS %c v${CARD_VERSION} `,
  "color: white; background: #03a9f4; font-weight: 700;",
  "color: #03a9f4; background: white; font-weight: 700;"
);


/* ────────────────────────────────────────────────────────────────────────────
 * Sprache und Wörterbücher — gemeinsam für alle drei Karten
 *
 * `docs/ui-regeln.md`, Regel 3: jede Karte hat EIN Wörterbuch mit beiden
 * Sprachen für Labels, Helper, Knöpfe, Fehlermeldungen und Leerzustände. Kein
 * nutzersichtbarer Text steht außerhalb davon.
 *
 * Welche Sprache gilt, entscheidet `hass.locale.language`. Der Eintrag im
 * Kartenwähler (`window.customCards`) entsteht aber beim Laden der Datei —
 * da gibt es noch keinen `hass`. Dort entscheidet `navigator.language`.
 * ──────────────────────────────────────────────────────────────────────── */

/** `de` oder `en` — mehr Sprachen hat diese Datei nicht. */
function buschSprache(hass) {
  return BuschUI.language(hass,{legacy:true});
}

/** Der Sprachabschnitt eines Wörterbuchs. Ohne `hass`: der Kartenwähler-Fall. */
function buschTexte(tabelle, hass) {
  return BuschUI.dictionary(tabelle,hass,{legacy:true});
}

/**
 * Ein `ha-form`-Schema mit übersetzten Auswahl-Beschriftungen.
 *
 * Die Schemakonstanten stehen bewusst als reines Objektliteral in der Datei —
 * `scripts/ui-regeln-pruefen.py` liest sie so. Übersetzbarer Text darf darin
 * also nicht stehen. Die Beschriftung einer Auswahloption kommt deshalb aus
 * `texte.texte["<feld>_<wert>"]`; fehlt sie, bleibt die Vorgabe des Schemas
 * stehen (bei der Landkarte sind das Eigennamen wie „OpenStreetMap", die in
 * beiden Sprachen gleich heißen).
 */
function buschSchemaMitTexten(schema, texte) {
  return schema.map((eintrag) => {
    const kopie = { ...eintrag };
    if (Array.isArray(eintrag.schema)) {
      kopie.schema = buschSchemaMitTexten(eintrag.schema, texte);
    }
    const auswahl = eintrag.selector && eintrag.selector.select;
    if (auswahl && Array.isArray(auswahl.options)) {
      kopie.selector = {
        ...eintrag.selector,
        select: {
          ...auswahl,
          options: auswahl.options.map((option) => ({
            ...option,
            label:
              (texte.texte && texte.texte[`${eintrag.name}_${option.value}`]) ||
              option.label ||
              option.value,
          })),
        },
      };
    }
    return kopie;
  });
}

/** Platzhalter `{name}` in einem Text ersetzen. */
function buschFuellen(text, werte) {
  let aus = String(text);
  for (const name of Object.keys(werte || {})) {
    aus = aus.split(`{${name}}`).join(String(werte[name]));
  }
  return aus;
}

/* === Unraid-Familie === */
/* Unraid cards: joins are exclusively backend metadata + registry scope. */
const BUSCH_UNRAID_DEFAULTS = { display_mode:'auto', image:'', icon:'', show_all:false, debug:false, title: '', device_id: '', container_key: '', switch_entity: '', update_entity: '', layout: 'detailed', show_controls: true, show_updates: true, state_filter: 'all', sort: 'name', show_restart: true, confirm_stop: true, confirm_restart: true, start_expanded: true };
function buschUnraidConfig(config){const next={...config};delete next.config_entry_id;return next;}
const TEXTE_BUSCH_UNRAID_STACK_CARD = {
 de: {
  labels: {title:'Titel',device_id:'Gerät',container_key:'Container',switch_entity:'Schalter zuordnen',update_entity:'Update zuordnen',layout:'Darstellung',show_status:'Status anzeigen',show_controls:'Steuerung anzeigen',show_containers:'Container anzeigen',show_updates:'Updates anzeigen',state_filter:'Container filtern',sort:'Sortierung',show_restart:'Neustart anzeigen',confirm_stop:'Stoppen bestätigen',confirm_restart:'Neustart bestätigen',start_expanded:'Aufgeklappt starten',visible_items:'Angezeigt',collapsed_items:'Eingeklappt anzeigen'},
  helpers: {title:'Eigener Kartentitel; Vorgabe ist der Gerätename.',device_id:'Wählt ein Unraid-Gerät; im Kartenvorschlag ist das erste passende vorbelegt.',container_key:'Wählt einen Container anhand seiner Backendkennung; Vorgabe ist der einzige Container, sonst bitte auswählen.',switch_entity:'Ordnet bei älterem Backend einen Schalter ausdrücklich zu; Vorgabe ist die automatische Zuordnung.',update_entity:'Ordnet bei älterem Backend das passende Update ausdrücklich zu; Vorgabe ist die automatische Zuordnung.',layout:'Bestimmt den Umfang der Angaben; Vorgabe ist ausführlich.',show_status:'Zeigt Zustand und laufende Container; Vorgabe ist ein.',show_controls:'Zeigt verfügbare Start- und Stoppaktionen; Vorgabe ist ein.',show_containers:'Zeigt die Containerliste des Stacks; Vorgabe ist ein.',show_updates:'Zeigt zugeordnete verfügbare Updates; Vorgabe ist ein.',state_filter:'Zeigt alle, laufende oder gestoppte Container; Vorgabe ist alle.',sort:'Sortiert Container nach Name oder Zustand; Vorgabe ist Name.',show_restart:'Zeigt ausschließlich native Neustartaktionen; ohne Backendunterstützung nicht verfügbar. Vorgabe ist ein.',confirm_stop:'Fragt vor dem Stoppen nach; Vorgabe ist ein.',confirm_restart:'Fragt vor dem Neustart nach; Vorgabe ist ein.',start_expanded:'Öffnet die Containerliste beim Laden; Vorgabe ist ein.',visible_items:'Abschnitte, die ausgeklappt sichtbar sind. Vorgabe: alle wie bisher.',collapsed_items:'Kennzahlen in einer Zeile unter dem Kopf, wenn die Karte eingeklappt ist. Vorgabe: keine.'},anzeige:{status:'Status',update_queue:'Update-Warteschlange',image:'Image',cpu:'CPU',ram:'RAM',containers:'Containerliste'},kurz:{status:'Status',cpu:'CPU',ram:'RAM',containers:'Container'},compact_label:'Kennzahlen',
  texte:{layout_compact:'Kompakt',layout_detailed:'Ausführlich',state_filter_all:'Alle',state_filter_running:'Laufend',state_filter_stopped:'Gestoppt',sort_name:'Name',sort_state:'Zustand'},
  stack:'Unraid-Stack',container:'Unraid-Container',stack_description:'Steuert einen Unraid-Compose-Stack und seine Container.',container_description:'Zeigt und steuert einen Unraid-Container.',empty:'Kein passendes Unraid-Gerät gefunden.',metadata:'Keine eindeutige Zuordnung verfügbar. Backend aktualisieren oder einen Schalter im Editor auswählen.',choose:'Bitte einen Container im Editor auswählen.',none:'Keine Container für diesen Filter.',start:'Starten',stop:'Stoppen',restart:'Neu starten',details:'Details',update:'Update',running:'Läuft',stopped:'Gestoppt',partial:'Teilweise gestartet',unavailable:'Nicht verfügbar',unknown:'Unbekannt',paused:'Pausiert',standalone:'Eigenständiger Container',container_group:'Container ({count})',expand:'Container aufklappen',collapse:'Container zuklappen',running_count:'{running} von {total} laufen',confirm_stop:'„{name}“ stoppen?',confirm_restart:'„{name}“ neu starten?',failed:'Aktion fehlgeschlagen. Bitte Zustand und Berechtigungen prüfen.',restart_missing:'Native Neustartfunktion fehlt. Dafür ist das aktualisierte Unraid-Backend erforderlich. Vorgabe ist ein.'
 },
 en: {
  labels: {title:'Title',device_id:'Device',container_key:'Container',switch_entity:'Assign switch',update_entity:'Assign update',layout:'Layout',show_status:'Show status',show_controls:'Show controls',show_containers:'Show containers',show_updates:'Show updates',state_filter:'Filter containers',sort:'Sort order',show_restart:'Show restart',confirm_stop:'Confirm stop',confirm_restart:'Confirm restart',start_expanded:'Start expanded',visible_items:'Shown',collapsed_items:'Shown when collapsed'},
  helpers: {title:'Custom card title; defaults to the device name.',device_id:'Selects an Unraid device; the card suggestion preselects the first matching one.',container_key:'Selects a container using its backend identity; defaults to the only container, otherwise select one.',switch_entity:'Explicitly assigns a switch on older backends; defaults to automatic matching.',update_entity:'Explicitly assigns the matching update on older backends; defaults to automatic matching.',layout:'Controls the amount of detail; defaults to detailed.',show_status:'Shows state and running count; enabled by default.',show_controls:'Shows available start and stop actions; enabled by default.',show_containers:'Shows the stack container list; enabled by default.',show_updates:'Shows matching available updates; enabled by default.',state_filter:'Shows all, running or stopped containers; defaults to all.',sort:'Sorts containers by name or state; defaults to name.',show_restart:'Shows native restart actions only; unavailable without backend support. Enabled by default.',confirm_stop:'Asks before stopping; enabled by default.',confirm_restart:'Asks before restarting; enabled by default.',start_expanded:'Expands the container list when loaded; enabled by default.',visible_items:'Sections shown when expanded. Default: all, as before.',collapsed_items:'Values shown in one line below the header while collapsed. Default: none.'},anzeige:{status:'Status',update_queue:'Update queue',image:'Image',cpu:'CPU',ram:'RAM',containers:'Container list'},kurz:{status:'Status',cpu:'CPU',ram:'RAM',containers:'Containers'},compact_label:'Key figures',
  texte:{layout_compact:'Compact',layout_detailed:'Detailed',state_filter_all:'All',state_filter_running:'Running',state_filter_stopped:'Stopped',sort_name:'Name',sort_state:'State'},
  stack:'Unraid stack',container:'Unraid container',stack_description:'Controls an Unraid Compose stack and its containers.',container_description:'Displays and controls an Unraid container.',empty:'No matching Unraid device found.',metadata:'No unambiguous mapping available. Update the backend or select a switch in the editor.',choose:'Select a container in the editor.',none:'No containers match this filter.',start:'Start',stop:'Stop',restart:'Restart',details:'Details',update:'Update',running:'Running',stopped:'Stopped',partial:'Partially running',unavailable:'Unavailable',unknown:'Unknown',paused:'Paused',standalone:'Standalone container',container_group:'Containers ({count})',expand:'Expand containers',collapse:'Collapse containers',running_count:'{running} of {total} running',confirm_stop:'Stop “{name}”?',confirm_restart:'Restart “{name}”?',failed:'Action failed. Check the current state and permissions.',restart_missing:'Native restart is unavailable. The updated Unraid backend is required. Enabled by default.'
 }
};
const TEXTE_BUSCH_UNRAID_CONTAINER_CARD = {
 de: {
  labels: {title:'Titel',device_id:'Gerät',container_key:'Container',switch_entity:'Schalter zuordnen',update_entity:'Update zuordnen',layout:'Darstellung',show_status:'Status anzeigen',show_controls:'Steuerung anzeigen',show_containers:'Container anzeigen',show_updates:'Updates anzeigen',state_filter:'Container filtern',sort:'Sortierung',show_restart:'Neustart anzeigen',confirm_stop:'Stoppen bestätigen',confirm_restart:'Neustart bestätigen',start_expanded:'Aufgeklappt starten',visible_items:'Angezeigt',collapsed_items:'Eingeklappt anzeigen'},
  helpers: {title:'Eigener Kartentitel; Vorgabe ist der Gerätename.',device_id:'Wählt ein Unraid-Gerät; im Kartenvorschlag ist das erste passende vorbelegt.',container_key:'Wählt einen Container anhand seiner Backendkennung; Vorgabe ist der einzige Container, sonst bitte auswählen.',switch_entity:'Ordnet bei älterem Backend einen Schalter ausdrücklich zu; Vorgabe ist die automatische Zuordnung.',update_entity:'Ordnet bei älterem Backend das passende Update ausdrücklich zu; Vorgabe ist die automatische Zuordnung.',layout:'Bestimmt den Umfang der Angaben; Vorgabe ist ausführlich.',show_status:'Zeigt Zustand und laufende Container; Vorgabe ist ein.',show_controls:'Zeigt verfügbare Start- und Stoppaktionen; Vorgabe ist ein.',show_containers:'Zeigt die Containerliste des Stacks; Vorgabe ist ein.',show_updates:'Zeigt zugeordnete verfügbare Updates; Vorgabe ist ein.',state_filter:'Zeigt alle, laufende oder gestoppte Container; Vorgabe ist alle.',sort:'Sortiert Container nach Name oder Zustand; Vorgabe ist Name.',show_restart:'Zeigt ausschließlich native Neustartaktionen; ohne Backendunterstützung nicht verfügbar. Vorgabe ist ein.',confirm_stop:'Fragt vor dem Stoppen nach; Vorgabe ist ein.',confirm_restart:'Fragt vor dem Neustart nach; Vorgabe ist ein.',start_expanded:'Öffnet die Containerliste beim Laden; Vorgabe ist ein.',visible_items:'Abschnitte, die ausgeklappt sichtbar sind. Vorgabe: alle wie bisher.',collapsed_items:'Kennzahlen in einer Zeile unter dem Kopf, wenn die Karte eingeklappt ist. Vorgabe: keine.'},anzeige:{status:'Status',update_queue:'Update-Warteschlange',image:'Image',cpu:'CPU',ram:'RAM',containers:'Containerliste'},kurz:{status:'Status',cpu:'CPU',ram:'RAM',containers:'Container'},compact_label:'Kennzahlen',
  texte:{layout_compact:'Kompakt',layout_detailed:'Ausführlich',state_filter_all:'Alle',state_filter_running:'Laufend',state_filter_stopped:'Gestoppt',sort_name:'Name',sort_state:'Zustand'},
  stack:'Unraid-Stack',container:'Unraid-Container',stack_description:'Steuert einen Unraid-Compose-Stack und seine Container.',container_description:'Zeigt und steuert einen Unraid-Container.',empty:'Kein passendes Unraid-Gerät gefunden.',metadata:'Keine eindeutige Zuordnung verfügbar. Backend aktualisieren oder einen Schalter im Editor auswählen.',choose:'Bitte einen Container im Editor auswählen.',none:'Keine Container für diesen Filter.',start:'Starten',stop:'Stoppen',restart:'Neu starten',details:'Details',update:'Update',running:'Läuft',stopped:'Gestoppt',partial:'Teilweise gestartet',unavailable:'Nicht verfügbar',unknown:'Unbekannt',paused:'Pausiert',standalone:'Eigenständiger Container',expand:'Container aufklappen',collapse:'Container zuklappen',running_count:'{running} von {total} laufen',confirm_stop:'„{name}“ stoppen?',confirm_restart:'„{name}“ neu starten?',failed:'Aktion fehlgeschlagen. Bitte Zustand und Berechtigungen prüfen.',restart_missing:'Native Neustartfunktion fehlt. Dafür ist das aktualisierte Unraid-Backend erforderlich. Vorgabe ist ein.'
 },
 en: {
  labels: {title:'Title',device_id:'Device',container_key:'Container',switch_entity:'Assign switch',update_entity:'Assign update',layout:'Layout',show_status:'Show status',show_controls:'Show controls',show_containers:'Show containers',show_updates:'Show updates',state_filter:'Filter containers',sort:'Sort order',show_restart:'Show restart',confirm_stop:'Confirm stop',confirm_restart:'Confirm restart',start_expanded:'Start expanded',visible_items:'Shown',collapsed_items:'Shown when collapsed'},
  helpers: {title:'Custom card title; defaults to the device name.',device_id:'Selects an Unraid device; the card suggestion preselects the first matching one.',container_key:'Selects a container using its backend identity; defaults to the only container, otherwise select one.',switch_entity:'Explicitly assigns a switch on older backends; defaults to automatic matching.',update_entity:'Explicitly assigns the matching update on older backends; defaults to automatic matching.',layout:'Controls the amount of detail; defaults to detailed.',show_status:'Shows state and running count; enabled by default.',show_controls:'Shows available start and stop actions; enabled by default.',show_containers:'Shows the stack container list; enabled by default.',show_updates:'Shows matching available updates; enabled by default.',state_filter:'Shows all, running or stopped containers; defaults to all.',sort:'Sorts containers by name or state; defaults to name.',show_restart:'Shows native restart actions only; unavailable without backend support. Enabled by default.',confirm_stop:'Asks before stopping; enabled by default.',confirm_restart:'Asks before restarting; enabled by default.',start_expanded:'Expands the container list when loaded; enabled by default.',visible_items:'Sections shown when expanded. Default: all, as before.',collapsed_items:'Values shown in one line below the header while collapsed. Default: none.'},anzeige:{status:'Status',update_queue:'Update queue',image:'Image',cpu:'CPU',ram:'RAM',containers:'Container list'},kurz:{status:'Status',cpu:'CPU',ram:'RAM',containers:'Containers'},compact_label:'Key figures',
  texte:{layout_compact:'Compact',layout_detailed:'Detailed',state_filter_all:'All',state_filter_running:'Running',state_filter_stopped:'Stopped',sort_name:'Name',sort_state:'State'},
  stack:'Unraid stack',container:'Unraid container',stack_description:'Controls an Unraid Compose stack and its containers.',container_description:'Displays and controls an Unraid container.',empty:'No matching Unraid device found.',metadata:'No unambiguous mapping available. Update the backend or select a switch in the editor.',choose:'Select a container in the editor.',none:'No containers match this filter.',start:'Start',stop:'Stop',restart:'Restart',details:'Details',update:'Update',running:'Running',stopped:'Stopped',partial:'Partially running',unavailable:'Unavailable',unknown:'Unknown',paused:'Paused',standalone:'Standalone container',expand:'Expand containers',collapse:'Collapse containers',running_count:'{running} of {total} running',confirm_stop:'Stop “{name}”?',confirm_restart:'Restart “{name}”?',failed:'Action failed. Check the current state and permissions.',restart_missing:'Native restart is unavailable. The updated Unraid backend is required. Enabled by default.'
 }
};
const TEXTE_BUSCH_UNRAID_VM_CARD = {
 de: {
  labels: {
   title: "Titel",
   device_id: "Unraid-Server oder VM",
   layout: "Darstellung",
   display_mode: "Medienanzeige",
   image: "Eigenes Bild",
   icon: "Eigenes Icon",
   debug: "Debug",
   show_status: "Status anzeigen",
   show_controls: "Steuerung anzeigen",
   show_restart: "Neustart anzeigen",
   confirm_stop: "Stoppen bestätigen",
   confirm_restart: "Neustart bestätigen",
   show_cpu: "CPU anzeigen",
   show_ram: "RAM anzeigen",
   show_all: "Alle VMs",
   visible_items:'Angezeigt',collapsed_items:'Eingeklappt anzeigen'},
  helpers: {
   title: "Optionaler eigener Titel; leer verwendet den VM-Namen.",
   device_id: "Unraid-Server für die VM-Liste oder eine einzelne VM. Leer: der einzige Server.",
   layout: "Kompakt oder ausführlich; Vorgabe ist ausführlich.",
   display_mode: "Automatisch bevorzugt verfügbare Bilder; Bild bevorzugt das eigene Bild, Icon zeigt nur das Icon. Vorgabe: automatisch.",
   image: "Optionale Bild-URL; leer verwendet vorhandenes Bild oder Icon.",
   icon: "Optionales mdi:-Icon für Anzeige und Bildfehler; leer verwendet das VM-Icon.",
   debug: "Zeigt zugeordnete IDs zur lokalen Diagnose; Vorgabe: aus.",
   show_status: "Zeigt den belegten Betriebszustand; Vorgabe: ein.",
   show_controls: "Zeigt unterstützte Aktionen; Vorgabe: ein.",
   show_restart: "Nur mit nativem Backendbutton verfügbar; Vorgabe: ein.",
   confirm_stop: "Fragt vor dem Stoppen nach; Vorgabe: ein.",
   confirm_restart: "Fragt vor dem Neustart nach; Vorgabe: ein.",
   show_cpu: "Zeigt CPU in Prozent je Kern; über 100 % ist möglich. Fehlende Werte sind nicht verfügbar. Vorgabe: ein.",
   show_ram: "Zeigt Gastverbrauch, sonst ausdrücklich zugewiesenen RAM; Host-RSS ist kein Gastverbrauch. Vorgabe: ein.",
   show_all: "Zeigt auch gestoppte VMs. Vorgabe aus.",
   visible_items:'Abschnitte, die ausgeklappt sichtbar sind. Vorgabe: alle wie bisher.',collapsed_items:'Kennzahlen in einer Zeile unter dem Kopf, wenn die Karte eingeklappt ist. Vorgabe: keine.'},anzeige:{status:'Status',cpu:'CPU',ram:'RAM',vms:'VM-Liste'},kurz:{status:'Status',cpu:'CPU',ram:'RAM',vms:'Laufende VMs'},compact_label:'Kennzahlen',
  vm_list: "Virtuelle Maschinen",
  show_all: "Alle VMs",
  none_vms: "Keine laufenden VMs.",
  loading: "Wird geladen …",
  choose_server: "Mehrere Unraid-Server gefunden. Im Editor einen wählen.",
  no_server: "Kein Unraid-Server gefunden. Die Integration Unraid SSH einrichten."
 },
 en: {
  labels: {
   title: "Title",
   device_id: "Unraid server or VM",
   layout: "Layout",
   display_mode: "Media display",
   image: "Custom picture",
   icon: "Custom icon",
   debug: "Debug",
   show_status: "Show status",
   show_controls: "Show controls",
   show_restart: "Show restart",
   confirm_stop: "Confirm stop",
   confirm_restart: "Confirm restart",
   show_cpu: "Show CPU",
   show_ram: "Show RAM",
   show_all: "All VMs",
   visible_items:'Shown',collapsed_items:'Shown when collapsed'},
  helpers: {
   title: "Optional title; empty uses the VM name.",
   device_id: "Unraid server for the VM list or a single VM. Empty: the only server.",
   layout: "Compact or detailed; defaults to detailed.",
   display_mode: "Auto prefers available pictures; image prefers your picture; icon only shows the icon. Default: auto.",
   image: "Optional picture URL; empty uses an existing picture or icon.",
   icon: "Optional mdi: icon for display and picture failures; empty uses the VM icon.",
   debug: "Shows matched IDs for local diagnostics; default: off.",
   show_status: "Shows the verified VM state; default: on.",
   show_controls: "Shows supported actions; default: on.",
   show_restart: "Requires a native backend button; default: on.",
   confirm_stop: "Asks before stopping; default: on.",
   confirm_restart: "Asks before restarting; default: on.",
   show_cpu: "Shows CPU percent per core; values above 100 % are valid. Missing values are unavailable. Default: on.",
   show_ram: "Shows guest usage, otherwise explicitly allocated RAM; host RSS is not guest usage. Default: on.",
   show_all: "Also shows stopped VMs. Default off.",
   visible_items:'Sections shown when expanded. Default: all, as before.',collapsed_items:'Values shown in one line below the header while collapsed. Default: none.'},anzeige:{status:'Status',cpu:'CPU',ram:'RAM',vms:'VM list'},kurz:{status:'Status',cpu:'CPU',ram:'RAM',vms:'Running VMs'},compact_label:'Key figures',
  vm_list: "Virtual machines",
  show_all: "All VMs",
  none_vms: "No running virtual machines.",
  loading: "Loading …",
  choose_server: "Several Unraid servers found. Choose one in the editor.",
  no_server: "No Unraid server found. Set up the Unraid SSH integration."
 }
};
const BUSCH_UNRAID_TEXT = TEXTE_BUSCH_UNRAID_STACK_CARD;
// All Unraid editors share one field contract, with complete translated help.
for(const dictionary of [TEXTE_BUSCH_UNRAID_STACK_CARD,TEXTE_BUSCH_UNRAID_CONTAINER_CARD])for(const lang of ['de','en']){
 const t=dictionary[lang],de=lang==='de';
 Object.assign(t,{vm:de?'Unraid-VM':'Unraid VM',vm_description:de?'Zeigt und steuert eine virtuelle Unraid-Maschine.':'Displays and controls an Unraid virtual machine.',vm_subtitle:de?'Virtuelle Maschine':'Virtual machine',vm_shutdown:de?'Herunterfahren':'Shut down',force_stop:de?'Sofort ausschalten':'Force stop',confirm_vm_shutdown:de?'„{name}“ herunterfahren? Das Gastbetriebssystem kann dafür Zeit benötigen.':'Shut down “{name}”? The guest operating system may take time.',confirm_force_stop:de?'„{name}“ sofort ausschalten? Nicht gespeicherte Daten können verloren gehen.':'Force stop “{name}”? Unsaved data may be lost.',updating:de?'Update läuft':'Updating',queued:de?'In Warteschlange':'Queued',pulling:de?'Image wird geladen':'Pulling image',preparing:de?'Wird vorbereitet':'Preparing',recreating:de?'Wird neu erstellt':'Recreating',verifying:de?'Wird geprüft':'Verifying',completed:de?'Fertig':'Completed',update_failed:de?'Update fehlgeschlagen':'Update failed',queue_position:de?'Position {position}':'Position {position}',update_all:de?'Alle aktualisieren':'Update all',queue_count:de?'{completed} von {total} fertig · {failed} fehlgeschlagen · {queued} in Warteschlange':'{completed} of {total} completed · {failed} failed · {queued} queued',current_target:de?'Aktuell: {name}':'Current: {name}',queue_blocked:de?'Warteschlange wartet auf Klärung':'Queue awaiting recovery',ram_used:de?'RAM (Gastverbrauch)':'RAM (guest used)',ram_allocated:de?'RAM (zugewiesen)':'RAM (allocated)',idle:de?'Leerlauf':'Idle',blocked:de?'Blockiert':'Blocked',suspended:de?'Ruhezustand':'Suspended',starting:de?'Startet':'Starting',stopping:de?'Stoppt':'Stopping',failed_state:de?'Fehler':'Failed'});
 const fields={display_mode:[de?'Medienanzeige':'Media display',de?'Automatisch bevorzugt vorhandene Bilder, dann eigenes Bild und Icon. Vorgabe: automatisch.':'Auto prefers available pictures, then your picture and icon. Default: auto.'],image:[de?'Eigenes Bild':'Custom picture',de?'Optionale Bild-URL, kein Docker-Image-Tag. Im Bildmodus wird dieses Bild bevorzugt. Leer verwendet verfügbare Metadaten.':'Optional picture URL, not a Docker image tag. Image mode prefers this picture. Empty uses available metadata.'],icon:[de?'Eigenes Icon':'Custom icon',de?'Optionales mdi:-Icon; bei fehlendem oder fehlerhaftem Bild als Ersatz. Leer verwendet das passende Standardicon.':'Optional mdi: icon; fallback for missing or failed pictures. Empty uses a semantic default.'],debug:['Debug',de?'Zeigt die zugeordneten Entity-IDs zur lokalen Diagnose. Vorgabe: aus.':'Shows matched entity IDs for local diagnostics. Default: off.']};
 for(const key of ['cpu','ram','uptime','ip','disk'])fields['show_'+key]=[(de?'Anzeigen: ':'Show: ')+key.toUpperCase(),de?'Zeigt zuverlässig zugeordnete Werte; fehlende Daten werden nicht erfunden. Vorgabe: ein.':'Shows reliably matched values; missing data is not fabricated. Default: on.'];
 for(const [key,[label,help]] of Object.entries(fields)){t.labels[key]=label;t.helpers[key]=help;}
 Object.assign(t.texte,{display_mode_auto:de?'Automatisch':'Auto',display_mode_image:de?'Bild':'Image',display_mode_icon:de?'Icon':'Icon'});
}
/* Reusable BuschMedia API: metadata accepts entity_picture/device_picture/picture,
 * never image (the Docker image:tag field). Auto prefers suitable metadata.
 * Picture URLs use safe browser image schemes; failed loads fall back to icon. */
function buschMediaResolve(config={},metadata={},defaultIcon='mdi:devices'){return BuschUI.resolveMedia(config,metadata,defaultIcon);}
function buschMedia(config,metadata,defaultIcon,className='card-icon'){return BuschUI.media(config,metadata,defaultIcon,className);}
function buschUnraidMetricValue(entities,role){const values=entities.filter(e=>e.domain==='sensor'&&e.attributes.role===role);if(values.length!==1||!buschUnraidAvailable(values[0])||String(values[0].state).trim()==='')return null;const n=Number(values[0].state);return Number.isFinite(n)&&n>=0?n:null;}
function buschUnraidResources(entities,kind,running){
 const read=role=>running?buschUnraidMetricValue(entities,role):null,cpu=read('cpu'),used=read('ram_used'),allocated=kind==='vm'?read('ram_allocated'):null,ram=used??allocated;
 const ram_label=kind==='vm'&&used===null?'ram_allocated':kind==='vm'?'ram_used':'ram';
 const limit=kind==='vm'?(used!==null?allocated:read('ram_max')):read('ram_limit');
 return {cpu,ram,ram_label,ram_total:limit>0?limit:null};
}
// sicht = {cpu,ram} aus der Anzeige der Karte (#642, _metrikSicht).
function buschUnraidMetrics(row,sicht,t,locale){
 const root=buschUnraidNode('div',undefined,'metrics'),format=n=>BuschUI.formatNumber(n,locale,{maximumFractionDigits:1}),bytes=n=>{const units=['B','KiB','MiB','GiB','TiB'];let unit=0;while(n>=1024&&unit<units.length-1){n/=1024;unit++;}return format(n)+' '+units[unit];};
 const add=(label,value,ratio)=>root.appendChild(BuschUI.metric(label,value,ratio));
 if(sicht?.cpu)add('CPU',row.cpu===null||row.cpu===undefined?t.unavailable:format(row.cpu)+' %');
 if(sicht?.ram)add(t[row.ram_label]||'RAM',row.ram===null||row.ram===undefined?t.unavailable:bytes(row.ram)+(row.ram_total?' / '+bytes(row.ram_total):''),row.ram!==null&&row.ram!==undefined&&row.ram_total?row.ram/row.ram_total:undefined);
 return root;
}

function buschUnraidDevices(core,kind) {
 if(!core) return [];
 return [...core.devices.values()].filter(d=>(kind==='vm'?d.model==='Virtual machine':kind==='stack'?d.model==='Compose stack':['Compose stack','Docker container'].includes(d.model))&&core.getDeviceEntities(d.id).some(e=>e.platform==='unraid_ssh')).sort((a,b)=>String(a.name_by_user||a.name||a.id).localeCompare(String(b.name_by_user||b.name||b.id)));
}
function buschUnraidAvailable(entity){return !!entity&&!['unavailable','unknown',undefined].includes(entity.state);}
function buschUnraidStatus(entity){if(!entity||entity.state==='unavailable')return 'unavailable';if(entity.state==='on')return 'running';if(entity.state==='off')return 'stopped';return ['running','stopped','starting','stopping','failed','paused'].includes(entity.state)?entity.state:'unknown';}
function buschUnraidContainerStatus(sw){return !['unavailable','unknown'].includes(sw.state)&&sw.attributes.container_state==='paused'?'paused':buschUnraidStatus(sw);}
function buschUnraidVmStatus(value){return ({'running':'running','shut off':'stopped','shutoff':'stopped','shut_off':'stopped','idle':'idle','paused':'paused','blocked':'blocked','in shutdown':'stopping','in_shutdown':'stopping','crashed':'failed','pmsuspended':'suspended'})[String(value||'').toLowerCase()]||'unknown';}
function buschUnraidVmForceable(status){return ['running','stopping','paused','blocked','suspended','failed','idle'].includes(status);}
function buschUnraidUpdateProgress(update){
 const a=update?.attributes||{},state=a.update_state||null;
 const active=!!update&&(['queued','preparing','pulling','updating','recreating','verifying'].includes(state)||(update.state!=='unavailable'&&a.in_progress===true));
 const value=state?a.progress_percent:a.update_percentage;
 return {active,percent:typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100?value:null,state,position:a.queue_position,error:a.last_error||null};
}

function buschUnraidLegacy(entries){
 return entries.map(e=>{
  if(e.attributes.kind&&e.attributes.role)return e;
  const entry=e.config_entry_id,uid=e.registry?.unique_id;
  if(e.platform!=='unraid_ssh'||!entry||!e.device_id||typeof uid!=='string')return e;
  const prefix=e.domain==='switch'?entry+'_container_':e.domain==='update'?entry+'_update_':null;
  if(prefix&&uid.startsWith(prefix)&&uid.length>prefix.length){
   const name=uid.slice(prefix.length),modern=entries.filter(other=>other.config_entry_id===entry&&other.device_id===e.device_id&&other.platform==='unraid_ssh'&&other.attributes.kind==='container'&&other.attributes.role==='control'&&other.attributes.container_name===name&&other.attributes.container_key);
   const keys=[...new Set(modern.map(other=>other.attributes.container_key))];
   if(keys.length>1)return e;
   return {...e,attributes:{...e.attributes,kind:'container',role:e.domain==='switch'?'control':'update',config_entry_id:entry,container_key:keys[0]||'legacy:'+name,container_name:name,identity_status:'legacy'}};
  }
  const stackPrefix=entry+'_stack_';
  if(e.domain==='switch'&&uid.startsWith(stackPrefix)&&uid.length>stackPrefix.length)return {...e,attributes:{...e.attributes,kind:'stack',role:'control',config_entry_id:entry,stack_key:uid.slice(stackPrefix.length),identity_status:'legacy'}};
  return e;
 });
}
function buschUnraidModel(core,config,kind) {
 const devices=buschUnraidDevices(core,kind),device=config.device_id?devices.find(d=>d.id===config.device_id):null;
 const model={device:device||null,containers:[],selected:null,switch:null,restart:null,force_stop:null,status:'unknown',update_progress:null,running:0,total:0};
 if(!device)return model;
 const deviceEntries=new Set(device.config_entries||[]);
 const candidates=core.getDeviceEntities(device.id).filter(e=>e.platform==='unraid_ssh'&&e.config_entry_id&&!e.registry?.disabled_by&&(!deviceEntries.size||deviceEntries.has(e.config_entry_id)));
 const entryIds=new Set(candidates.map(e=>e.config_entry_id));
 if(entryIds.size!==1)return model;
 const entries=buschUnraidLegacy(candidates);
 const unique=rows=>rows.length===1?rows[0]:null;
 const explicit=(id,domain)=>unique(entries.filter(e=>e.entity_id===id&&e.domain===domain));
 if(kind==='vm'){
  const sw=unique(entries.filter(e=>e.domain==='switch'&&e.attributes.kind==='vm'&&e.attributes.role==='control'&&e.attributes.vm_key&&(!e.attributes.config_entry_id||e.attributes.config_entry_id===e.config_entry_id)));
  if(sw){const a=sw.attributes,related=entries.filter(e=>e.config_entry_id===sw.config_entry_id&&e.attributes.kind==='vm'&&e.attributes.vm_key===a.vm_key&&(!e.attributes.config_entry_id||e.attributes.config_entry_id===e.config_entry_id));
   const state=unique(related.filter(e=>e.domain==='sensor'&&e.attributes.role==='state'));
   model.selected={key:a.vm_key,name:a.vm_name||device.name_by_user||device.name,switch:sw,restart:unique(related.filter(e=>e.domain==='button'&&e.attributes.role==='restart')),force_stop:unique(related.filter(e=>e.domain==='button'&&e.attributes.role==='force_stop')),status:!buschUnraidAvailable(sw)?buschUnraidStatus(sw):state&&buschUnraidAvailable(state)?buschUnraidVmStatus(state.state):a.vm_state?buschUnraidVmStatus(a.vm_state):buschUnraidStatus(sw),...buschUnraidResources(related,'vm',sw.state==='on'),entity_picture:a.entity_picture,device_picture:device.entity_picture};
   model.switch=sw;model.restart=model.selected.restart;model.force_stop=model.selected.force_stop;model.status=model.selected.status;
  }return model;
 }
 const controls=entries.filter(e=>e.domain==='switch'&&e.attributes.kind==='container'&&e.attributes.role==='control'&&e.attributes.container_key);
 const keys=new Set(controls.map(e=>e.config_entry_id+'\0'+e.attributes.container_key));
 for(const key of keys){const candidates=controls.filter(e=>e.config_entry_id+'\0'+e.attributes.container_key===key),sw=unique(candidates);if(!sw)continue;
  const a=sw.attributes,related=entries.filter(e=>e.config_entry_id===sw.config_entry_id&&e.attributes.kind==='container'&&e.attributes.container_key===a.container_key);
  const update=unique(related.filter(e=>e.domain==='update'&&e.attributes.role==='update')),progress=buschUnraidUpdateProgress(update);
  model.containers.push({key:a.container_key,name:a.container_name||sw.attributes.friendly_name||sw.entity_id,stack:a.stack_name||a.stack_key||(device.model==='Compose stack'?(device.name_by_user||device.name):null),image:a.image||'',entity_picture:a.entity_picture,device_picture:device.entity_picture,...buschUnraidResources(related,'container',sw.state==='on'&&a.container_state!=='paused'),switch:sw,restart:unique(related.filter(e=>e.domain==='button'&&e.attributes.role==='restart')),update,update_state:progress.state,queue_position:progress.position,last_error:progress.error,update_progress:progress.percent,status:progress.active?'updating':buschUnraidContainerStatus(sw)});
 }
 const stack=unique(entries.filter(e=>e.domain==='switch'&&e.attributes.kind==='stack'&&e.attributes.role==='control'&&e.attributes.stack_key));
 model.switch=stack||explicit(config.switch_entity,'switch');
 model.restart=stack?unique(entries.filter(e=>e.domain==='button'&&e.attributes.role==='restart'&&e.attributes.kind==='stack'&&e.config_entry_id===stack.config_entry_id&&e.attributes.stack_key===stack.attributes.stack_key)):null;
 model.running=model.containers.filter(c=>c.status==='running'||(c.status==='updating'&&c.switch?.state==='on')).length;model.total=model.containers.length;
 const reportedRunning=stack?.attributes.running_containers,reportedTotal=stack?.attributes.total_containers;
 if(Number.isFinite(reportedRunning)&&Number.isFinite(reportedTotal)){model.running=reportedRunning;model.total=reportedTotal;}
 model.status=model.total?(model.running===model.total?'running':model.running===0?'stopped':'partial'):buschUnraidStatus(model.switch);
 if(!(Number.isFinite(reportedRunning)&&Number.isFinite(reportedTotal))&&model.containers.some(c=>['unavailable','unknown'].includes(c.status)))model.status=model.containers.some(c=>c.status==='unavailable')?'unavailable':'unknown';
 if(model.switch?.state==='unavailable')model.status='unavailable';
 model.update_all=unique(entries.filter(e=>e.domain==='button'&&e.attributes.kind==='stack'&&e.attributes.role==='update_all'&&(!stack||e.attributes.stack_key===stack.attributes.stack_key)));
 model.update_queue=model.update_all?.attributes.update_queue||model.containers.map(c=>c.update?.attributes.stack_update_queue).find(Boolean)||null;
 const updating=model.containers.filter(c=>c.status==='updating');
 if(updating.length&&model.status!=='unavailable'){model.status='updating';model.update_progress=updating.length===1?updating[0].update_progress:null;}
 if(model.update_queue?.active&&model.status!=='unavailable')model.status='updating';
 if(model.update_queue)model.update_progress=model.update_queue.progress_percent;
 if(kind==='container'){
  model.selected=config.container_key?unique(model.containers.filter(c=>c.key===config.container_key)):model.containers.length===1?model.containers[0]:null;
  if(!model.selected&&config.switch_entity){const sw=explicit(config.switch_entity,'switch');if(sw)model.selected={key:sw.entity_id,name:sw.attributes.friendly_name||device.name||sw.entity_id,switch:sw,restart:null,update:explicit(config.update_entity,'update'),status:buschUnraidStatus(sw),stack:device.model==='Compose stack'?(device.name_by_user||device.name):null};}
 }
 if(kind==='container'&&model.selected&&config.update_entity)model.selected={...model.selected,update:explicit(config.update_entity,'update')};
 if(kind==='container'&&model.selected){const progress=buschUnraidUpdateProgress(model.selected.update);model.selected={...model.selected,update_state:progress.state,queue_position:progress.position,last_error:progress.error,status:progress.active?'updating':model.selected.switch?buschUnraidContainerStatus(model.selected.switch):model.selected.status,update_progress:progress.percent};}
 const active=model.containers.filter(c=>c.status==='running');const complete=model.total===model.containers.length&&!model.containers.some(c=>['unknown','unavailable','paused','updating'].includes(c.status));const sum=key=>complete&&active.length&&active.every(c=>c[key]!==null&&c[key]!==undefined)?active.reduce((n,c)=>n+c[key],0):null;model.cpu=sum('cpu');model.ram=sum('ram');model.ram_total=null;
 model.containers.sort((a,b)=>config.sort==='state'?a.status.localeCompare(b.status)||a.name.localeCompare(b.name):a.name.localeCompare(b.name));
 return model;
}
const SCHEMA_BUSCH_UNRAID_STACK_CARD = [
 {name: "title", "selector": {"text": {}}},
 {name: "visible_items", "selector": {"select": {"multiple": true, "mode": "list", "options": []}}},
 {name: "collapsed_items", "selector": {"select": {"multiple": true, "mode": "list", "options": []}}},
 {name: "device_id", "selector": {"select": {"options": []}}},
 {name: "switch_entity", "selector": {"entity": {"filter": {"integration": "unraid_ssh", "domain": "switch"}}}},
 {name: "layout", "selector": {"select": {"options": [{"value": "compact"}, {"value": "detailed"}]}}},
 {name: "show_controls", "selector": {"boolean": {}}},
 {name: "show_updates", "selector": {"boolean": {}}},
 {name: "state_filter", "selector": {"select": {"options": [{"value": "all"}, {"value": "running"}, {"value": "stopped"}]}}},
 {name: "sort", "selector": {"select": {"options": [{"value": "name"}, {"value": "state"}]}}},
 {name: "start_expanded", "selector": {"boolean": {}}},
 {name: "show_restart", "selector": {"boolean": {}}},
 {name: "confirm_stop", "selector": {"boolean": {}}},
 {name: "confirm_restart", "selector": {"boolean": {}}}
];
const SCHEMA_BUSCH_UNRAID_CONTAINER_CARD = [
 {name: "title", "selector": {"text": {}}},
 {name: "visible_items", "selector": {"select": {"multiple": true, "mode": "list", "options": []}}},
 {name: "collapsed_items", "selector": {"select": {"multiple": true, "mode": "list", "options": []}}},
 {name: "device_id", "selector": {"select": {"options": []}}},
 {name: "container_key", "selector": {"select": {"options": []}}},
 {name: "switch_entity", "selector": {"entity": {"filter": {"integration": "unraid_ssh", "domain": "switch"}}}},
 {name: "update_entity", "selector": {"entity": {"filter": {"integration": "unraid_ssh", "domain": "update"}}}},
 {name: "layout", "selector": {"select": {"options": [{"value": "compact"}, {"value": "detailed"}]}}},
 {name: "show_controls", "selector": {"boolean": {}}},
 {name: "show_updates", "selector": {"boolean": {}}},
 {name: "show_restart", "selector": {"boolean": {}}},
 {name: "confirm_stop", "selector": {"boolean": {}}},
 {name: "confirm_restart", "selector": {"boolean": {}}}
];
const BUSCH_UNRAID_MEDIA_SCHEMA=[{name:'display_mode',selector:{select:{options:['auto','image','icon'].map(value=>({value}))}}},{name:'image',selector:{text:{}}},{name:'icon',selector:{icon:{}}}];
const SCHEMA_BUSCH_UNRAID_VM_CARD = [
 {
  name: "title",
  selector: {
   text: {}
  }
 }, {name: "visible_items", selector: {select: {multiple: true, mode: "list", options: []}}},
 {name: "collapsed_items", selector: {select: {multiple: true, mode: "list", options: []}}},

 {
  name: "device_id",
  selector: {
   device: {
    filter: [
     {
      integration: "unraid_ssh",
      model: "Unraid"
     },
     {
      integration: "unraid_ssh",
      model: "Virtual machine"
     }
    ]
   }
  }
 },
 {
  name: "layout",
  selector: {
   select: {
    options: [
     {
      value: "compact"
     },
     {
      value: "detailed"
     }
    ]
   }
  }
 },
 {
  name: "display_mode",
  selector: {
   select: {
    options: [
     {
      value: "auto"
     },
     {
      value: "image"
     },
     {
      value: "icon"
     }
    ]
   }
  }
 },
 {
  name: "image",
  selector: {
   text: {}
  }
 },
 {
  name: "icon",
  selector: {
   icon: {}
  }
 },
 {
  name: "debug",
  selector: {
   boolean: {}
  }
 },

 {
  name: "show_controls",
  selector: {
   boolean: {}
  }
 },
 {
  name: "show_restart",
  selector: {
   boolean: {}
  }
 },
 {
  name: "confirm_stop",
  selector: {
   boolean: {}
  }
 },
 {
  name: "confirm_restart",
  selector: {
   boolean: {}
  }
 },


 {
  name: "show_all",
  selector: {
   boolean: {}
  }
 }
];
function buschUnraidSchema(core,config,kind){
 if(kind==='docker')return SCHEMA_BUSCH_UNRAID_DOCKER_CARD.map(field=>field.name==='device_id'?{...field,selector:{select:{options:buschUnraidServers(core).map(d=>({value:d.id,label:d.name_by_user||d.name||d.id}))}}}:field);
 const model=buschUnraidModel(core,config,kind),base=kind==='stack'?SCHEMA_BUSCH_UNRAID_STACK_CARD:kind==='vm'?SCHEMA_BUSCH_UNRAID_VM_CARD:SCHEMA_BUSCH_UNRAID_CONTAINER_CARD;
 return (kind==='vm'?base:[...base,...BUSCH_UNRAID_MEDIA_SCHEMA,...SCHEMA_BUSCH_UNRAID_VM_CARD.filter(f=>f.name==='debug')]).map(field=>{
  // VM: Gerätewähler aus dem Schema (Server für die Liste oder eine einzelne VM), keine VM-Auswahlliste.
  if(field.name==='device_id'&&kind!=='vm')return {...field,selector:{select:{options:buschUnraidDevices(core,kind).map(d=>({value:d.id,label:d.name_by_user||d.name||d.id}))}}};
  if(field.name==='container_key')return {...field,selector:{select:{options:model.containers.map(c=>({value:c.key,label:c.name}))}}};
  if(field.name==='switch_entity'||field.name==='update_entity')return {...field,selector:{entity:{filter:{integration:'unraid_ssh',domain:field.name==='switch_entity'?'switch':'update',...(model.device?{device_id:model.device.id}:{})}}}};
  if(field.name==='show_restart'&&kind==='vm'&&buschUnraidVmListe(core,config)){
   // VM-Liste: gesperrt nur, wenn keine VM des Servers einen nativen Restart-Button hat.
   const s=core?unraidServer(core,config):null,vms=s?.server&&!s.laedt?s.geraete('Virtual machine'):[];
   return {...field,disabled:vms.length>0&&!vms.some(v=>buschUnraidModel(core,{...config,device_id:v.id},'vm').selected?.restart)};}
  if(field.name==='show_restart')return {...field,disabled:kind==='stack'?!model.restart&&!model.containers.some(c=>c.restart):!model.selected?.restart};
  return field;
 });
}
const BUSCH_UNRAID_STYLE = BuschUI.cardStyles + `
:host{display:block;min-width:0;container-type:inline-size;color:var(--primary-text-color);--unraid-space:${BuschUI.tokens.space4};--unraid-small:${BuschUI.tokens.space2};--unraid-metric-min:100px}
*{box-sizing:border-box;min-width:0}ha-card{display:block;overflow:hidden;padding:var(--unraid-space);font-family:inherit;color:var(--primary-text-color);background:var(--card-background-color)}
h2,.name{margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;font-size:var(--ha-font-size-l,18px);font-weight:var(--ha-font-weight-medium,500)}
p,.detail,.message{margin:0;overflow-wrap:anywhere;font-size:var(--ha-font-size-m,14px)}.detail{color:var(--secondary-text-color)}
.header{display:grid;grid-template-columns:48px minmax(0,1fr) auto;gap:var(--unraid-small) var(--unraid-space);align-items:center;padding-bottom:var(--unraid-space)}
.card-icon,.row-icon{display:grid;place-items:center;flex:none;color:var(--primary-color);background:var(--secondary-background-color);border-radius:var(--ha-card-border-radius,12px)}.card-icon{width:48px;height:48px}.row-icon{width:40px;height:40px}
.header-main{display:grid;gap:var(--ha-space-1,4px);min-width:0}.header-main .detail{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.status-badge{display:inline-flex;align-items:center;gap:var(--ha-space-2,8px);justify-self:end;padding:var(--ha-space-1,4px) var(--ha-space-3,12px);border-radius:999px;font-size:var(--ha-font-size-s,12px);font-weight:var(--ha-font-weight-medium,500);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;min-width:0;background:var(--secondary-background-color);color:var(--secondary-text-color)}
.status-badge::before{content:'';width:8px;height:8px;flex:none;border-radius:50%;background:currentColor}.status-success{color:var(--success-color,#16864b);background:color-mix(in srgb,var(--success-color,#16864b) 12%,var(--card-background-color))}.status-warning{color:color-mix(in srgb,var(--warning-color,#a76900) 50%,var(--primary-text-color,#212121));background:color-mix(in srgb,var(--warning-color,#a76900) 12%,var(--card-background-color))}.status-warning::before{background:var(--warning-color,#a76900)}.status-error,.status-unavailable{color:var(--error-color);background:color-mix(in srgb,var(--error-color) 10%,var(--card-background-color))}
.actions{display:flex;flex-wrap:wrap;gap:var(--unraid-small)}.header>.actions{grid-column:2/-1;justify-content:flex-end}
button{font:inherit;color:var(--primary-color);background:var(--secondary-background-color);border:1px solid var(--divider-color);border-radius:var(--ha-card-border-radius,12px);padding:var(--unraid-small) var(--ha-space-3,12px);min-height:44px;cursor:pointer;overflow-wrap:anywhere;max-width:100%}button:disabled{color:var(--disabled-text-color);cursor:default}button:focus-visible{outline:2px solid var(--primary-color);outline-offset:2px}.danger{color:var(--error-color);border-color:color-mix(in srgb,var(--error-color) 35%,var(--divider-color));background:color-mix(in srgb,var(--error-color) 7%,var(--card-background-color))}.quiet{background:var(--card-background-color)}
.disclosure{display:flex;align-items:center;justify-content:space-between;width:100%;margin-top:var(--unraid-small);text-align:start;color:var(--primary-text-color);background:var(--secondary-background-color)}.disclosure::after{content:'⌄';font-size:1.25em;line-height:1}.disclosure[aria-expanded=false]::after{transform:rotate(-90deg)}
.rows{display:grid;margin-top:var(--unraid-small);border:1px solid var(--divider-color);border-radius:var(--ha-card-border-radius,12px);overflow:hidden}.row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:var(--unraid-small);align-items:center;padding:var(--ha-space-3,12px)}.row+.row{border-top:1px solid var(--divider-color)}.row-identity{display:flex;align-items:center;gap:var(--ha-space-3,12px);min-width:0}.row-text{display:grid;gap:var(--ha-space-1,4px);min-width:0}.row .name{font-size:var(--ha-font-size-m,14px)}.row>.actions{grid-column:1/-1;justify-content:flex-end}.row .detail{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.busch-media{overflow:hidden}.busch-media img{display:block;width:100%;height:100%;object-fit:contain}.metrics{display:flex;flex-wrap:wrap;gap:var(--unraid-space);padding-bottom:var(--unraid-small)}.metric{display:grid;gap:var(--ha-space-1,4px);flex:1 1 0;min-width:min(100%,var(--unraid-metric-min,100px))}.metric-label{color:var(--secondary-text-color);font-size:var(--ha-font-size-s,12px);overflow-wrap:anywhere}.metric-value{font-size:var(--ha-font-size-m,14px);overflow-wrap:anywhere}.metric progress{max-width:100%;width:100%;accent-color:var(--primary-color)}.row>.metrics{grid-column:1/-1}.message{margin-top:var(--unraid-space);overflow-wrap:anywhere}.row>.message,.row>progress{grid-column:1/-1}progress{width:100%;max-width:100%;accent-color:var(--primary-color)}.error{color:var(--error-color)}.compact .detail{display:none}
@container (max-width:440px){.header{grid-template-columns:40px minmax(0,1fr);column-gap:var(--unraid-small);row-gap:var(--unraid-small);padding-bottom:var(--unraid-small)}.card-icon{width:40px;height:40px}.header>.status-badge{grid-column:2;justify-self:start}.header>.actions{grid-column:1/-1;justify-content:flex-start}.row>.status-badge{grid-column:1;justify-self:start}.row>.actions{justify-content:flex-start}.actions button{padding-inline:var(--unraid-small);font-size:var(--ha-font-size-m,14px)}.disclosure{margin-top:0}}
`;
function buschUnraidNode(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;}
/* Busch HA UI 0.1.0: domain states map to the same semantic badge roles. */
function buschUiStatusSemantic(status){return BuschUI.statusSemantic(String(status||'').toLowerCase());}
function buschUnraidBadge(status,text){return BuschUI.statusBadge(status,text);}
function buschUnraidStatusText(row,t,locale){
 const state=row.update_state;
 let label=state&&state!=='idle'?(state==='failed'?t.update_failed:t[state]||t.updating):row.status==='failed'?t.failed_state:t[row.status]||t.unknown;
 if(state==='queued'&&Number.isInteger(row.queue_position))label+=' · '+t.queue_position.replace('{position}',row.queue_position);
 return (row.status==='updating'||state&&state!=='idle')&&row.update_progress!==null&&row.update_progress!==undefined?label+' · '+BuschUI.formatNumber(row.update_progress,locale)+' %':label;
}
function buschUnraidProgress(parent,row,t){
 const value=row.update_progress;
 if(typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100){const progress=buschUnraidNode('progress');progress.setAttribute('max','100');progress.setAttribute('value',String(value));progress.setAttribute('aria-label',t.updating);parent.appendChild(progress);}
 if(row.last_error){const error=buschUnraidNode('p',row.last_error,'message error');error.setAttribute('role','alert');parent.appendChild(error);}
}

function buschUnraidIcon(name,className){const holder=buschUnraidNode('span',undefined,className),icon=buschUnraidNode('ha-icon');holder.setAttribute('aria-hidden','true');icon.setAttribute('icon',name);holder.appendChild(icon);return holder;}
/* #642: Welche Abschnitte eine Karte ausgeklappt zeigt (`visible_items`) und welche Kennzahlen eingeklappt
 * in der Kompaktzeile stehen (`collapsed_items`). Ein Katalog je Kartenart, Reihenfolge = Anzeige-Reihenfolge.
 * IDs sind YAML-Vertrag (stabil, snake_case). Bewusst ohne Texte und ohne `name:`, und nicht *SCHEMA* benannt:
 * scripts/ui-regeln-pruefen.py würde den Katalog sonst als Editorschema lesen. `alt` = überführter Altschalter. */
const UNRAID_ANZEIGE={
 stack:[{id:'status',vorgabe:true,kompakt:true,alt:'show_status'},{id:'update_queue',vorgabe:true,kompakt:false},{id:'cpu',vorgabe:true,kompakt:true,alt:'show_cpu'},{id:'ram',vorgabe:true,kompakt:true,alt:'show_ram'},{id:'containers',vorgabe:true,kompakt:true,alt:'show_containers'}],
 container:[{id:'status',vorgabe:true,kompakt:true,alt:'show_status'},{id:'image',vorgabe:true,kompakt:false},{id:'cpu',vorgabe:true,kompakt:true,alt:'show_cpu'},{id:'ram',vorgabe:true,kompakt:true,alt:'show_ram'}],
 // [A-2] ein Katalog für VM-Liste und Einzel-VM; was im Modus nicht passt, ignoriert die Karte.
 vm:[{id:'status',vorgabe:true,kompakt:true,alt:'show_status'},{id:'cpu',vorgabe:true,kompakt:true,alt:'show_cpu'},{id:'ram',vorgabe:true,kompakt:true,alt:'show_ram'},{id:'vms',vorgabe:true,kompakt:true}],
 docker:[{id:'summary',vorgabe:true,kompakt:true},{id:'stacks',vorgabe:true,kompakt:false},{id:'containers',vorgabe:true,kompakt:false}],
 // [A-3] Uhr nicht kompakt: eingeklappt kein Minutentakt.
 server:[{id:'clock',vorgabe:true,kompakt:false,alt:'show_clock'},{id:'uptime',vorgabe:true,kompakt:true},{id:'array',vorgabe:true,kompakt:true},{id:'mover',vorgabe:true,kompakt:true},{id:'model',vorgabe:true,kompakt:false},{id:'registration',vorgabe:true,kompakt:false}],
 system:[{id:'ram',vorgabe:true,kompakt:true},{id:'filesystems',vorgabe:true,kompakt:false},{id:'hardware',vorgabe:true,kompakt:false},{id:'memory',vorgabe:true,kompakt:false},{id:'temperatures',vorgabe:true,kompakt:true,alt:'show_temperatures'}],
 cpu:[{id:'temperature',vorgabe:true,kompakt:true},{id:'load_average',vorgabe:true,kompakt:true},{id:'load',vorgabe:true,kompakt:true},{id:'power',vorgabe:true,kompakt:true},{id:'cores',vorgabe:true,kompakt:false},{id:'history',vorgabe:true,kompakt:false,alt:'show_history'}],
 gpu:[{id:'util',vorgabe:true,kompakt:true},{id:'vram',vorgabe:true,kompakt:true},{id:'temperature',vorgabe:true,kompakt:true},{id:'power',vorgabe:true,kompakt:true},{id:'fan',vorgabe:true,kompakt:true}],
 array:[{id:'array',vorgabe:true,kompakt:true},{id:'pools',vorgabe:true,kompakt:true},{id:'boot',vorgabe:true,kompakt:true,alt:'show_boot'},{id:'smart',vorgabe:true,kompakt:false}],
 parity:[{id:'state',vorgabe:true,kompakt:true},{id:'progress',vorgabe:true,kompakt:true},{id:'errors',vorgabe:true,kompakt:true}],
 airflow:[{id:'summary',vorgabe:true,kompakt:true},{id:'fans',vorgabe:true,kompakt:false}],
 shares:[{id:'summary',vorgabe:true,kompakt:true},{id:'shares',vorgabe:true,kompakt:false},{id:'share_details',vorgabe:true,kompakt:false}],
 'vm-usage':[{id:'summary',vorgabe:true,kompakt:true},{id:'cpu',vorgabe:true,kompakt:false},{id:'ram',vorgabe:true,kompakt:false},{id:'host_cpu',vorgabe:true,kompakt:false},{id:'io',vorgabe:true,kompakt:false}],
 // [A-5] Werte mehrerer Links werden nie summiert: keine Kompaktwerte. Die Spalte name bleibt immer.
 interface:[{id:'state',vorgabe:true,kompakt:false},{id:'kind',vorgabe:true,kompakt:false},{id:'rx',vorgabe:true,kompakt:false},{id:'tx',vorgabe:true,kompakt:false},{id:'speed',vorgabe:true,kompakt:false},{id:'mtu',vorgabe:true,kompakt:false}],
 users:[{id:'summary',vorgabe:true,kompakt:true},{id:'permission_help',vorgabe:true,kompakt:false},{id:'users',vorgabe:true,kompakt:false},{id:'description',vorgabe:true,kompakt:false}],
 usb:[{id:'summary',vorgabe:true,kompakt:true},{id:'limits',vorgabe:true,kompakt:false},{id:'devices',vorgabe:true,kompakt:false}],
 coral:[{id:'summary',vorgabe:true,kompakt:true},{id:'tpus',vorgabe:true,kompakt:false}]
};
/* Leselogik (nur in setConfig aufrufen, nicht je `set hass`): `visible_items` gilt vor den Altschaltern; fehlt es, gilt der
 * Altschalter (altes Truthy-Verhalten) und sonst die Vorgabe. Unbekannte IDs werden still ignoriert. Die Altschlüssel liest
 * nur diese Funktion, per Klammerzugriff: bewusste Ausnahme von UI-Regel 3.3 für die Migration (docs/entwicklung.md, R24). */
function unraidAnzeige(config,katalog){
 config=config||{};katalog=katalog||[];
 const sichtbar=Array.isArray(config.visible_items)?new Set(katalog.filter(e=>config.visible_items.includes(e.id)).map(e=>e.id)):new Set(katalog.filter(e=>e.alt&&config[e.alt]!==undefined?!!config[e.alt]:e.vorgabe).map(e=>e.id));
 const kompakt=Array.isArray(config.collapsed_items)?katalog.filter(e=>e.kompakt&&config.collapsed_items.includes(e.id)).map(e=>e.id):[];
 return {sichtbar,kompakt};
}
function unraidZeigt(karte,id){return !!karte?._anzeige?.sichtbar?.has(id);}
/* Kompaktzeile unter dem Kopf einer eingeklappten Karte: `ids` (Katalogreihenfolge aus unraidAnzeige().kompakt),
 * `werte` = {id:{wert,semantik?,label?}} oder je ID eine Liste davon (Pools, mehrere GPUs) aus `_kompakt(m,t)`.
 * Nicht verfügbare Werte (null, undefined, '', '–') fallen weg (Linie von #640); bleibt nichts, keine Zeile (null).
 * Bedeutung nie nur über Farbe: der Punkt ist Zierde (aria-hidden), der Wert steht immer als Text daneben. */
function unraidKompaktZeile(ids,werte,t){
 const zeile=buschUnraidNode('div',undefined,'compact-line');zeile.setAttribute('role','list');zeile.setAttribute('aria-label',t?.compact_label||'');
 for(const id of ids||[])for(const w of [].concat(werte?.[id]??[])){
  if(!w||w.wert===null||w.wert===undefined||w.wert===''||w.wert==='–')continue;
  const item=buschUnraidNode('span',undefined,'compact-item');item.setAttribute('role','listitem');
  if(w.semantik){const dot=buschUnraidNode('span',undefined,'dot sem-'+w.semantik);dot.setAttribute('aria-hidden','true');item.appendChild(dot);}
  item.appendChild(buschUnraidNode('span',String(w.label??t?.kurz?.[id]??id),'compact-label'));item.appendChild(buschUnraidNode('span',String(w.wert),'compact-value'));zeile.appendChild(item);}
 return zeile.childNodes.length?zeile:null;
}
// Statusrollen der Badges → Punkte der Kompaktzeile (ok/warning/error/unknown).
function unraidKompaktSemantik(status){const s=buschUiStatusSemantic(status);return s==='success'?'ok':s==='warning'||s==='error'?s:'unknown';}
/* #643/2: der eine Einklapp-Knopf aller 17 Karten (R01, R08): flach, oben rechts im Kopf (Rasterbereich toggle),
 * nie Teil der Aktionsreihe. `t` liefert collapse/expand (UNRAID_TILE_TEXTE); data-focus-key=toggle hält den Fokus über Renders. */
function unraidEinklappKnopf({eingeklappt,t,onClick}){const label=eingeklappt?t.expand:t.collapse,knopf=BuschUI.action({label,icon:eingeklappt?'mdi:chevron-down':'mdi:chevron-up',onClick,variant:'secondary'});
 knopf.className+=' collapse-toggle';knopf.dataset.focusKey='toggle';knopf.setAttribute('aria-expanded',String(!eingeklappt));knopf.title=label;return knopf;}
/* Ein Editor-Helfer für beide Editorklassen (R08): Häkchenlisten `visible_items`/`collapsed_items` aus dem Katalog.
 * formDaten: abgeleitete Listen in form.data, damit die Häkchen auch den Altzustand (show_*) korrekt zeigen.
 * normalisiere: überführte Altschalter löschen; Listen in Katalogreihenfolge, unbekannte IDs der alten Liste anhängen
 * (Datenerhalt, R10); [A-9] entspricht die Auswahl genau der Vorgabe, wird kein visible_items geschrieben (künftige
 * Abschnitte erscheinen dann automatisch); leeres collapsed_items fällt weg.
 * schema: Optionen zur Laufzeit aus dem Katalog, Beschriftung aus t.anzeige; ohne Kompaktwerte kein collapsed_items. */
const unraidAnzeigeEditor={
 formDaten(daten,katalog){if(!katalog)return daten;const a=unraidAnzeige(daten,katalog);return {...daten,visible_items:[...a.sichtbar],collapsed_items:[...a.kompakt]};},
 normalisiere(next,katalog,vorher={}){
  if(!katalog)return next;const n={...next},ids=new Set(katalog.map(e=>e.id)),fremd=(...listen)=>[...new Set(listen.flatMap(l=>Array.isArray(l)?l.filter(id=>!ids.has(id)):[]))];
  for(const e of katalog)if(e.alt)delete n[e.alt];
  if(Array.isArray(n.visible_items)){const bekannt=katalog.filter(e=>n.visible_items.includes(e.id)).map(e=>e.id),rest=fremd(n.visible_items,vorher?.visible_items),vorgabe=katalog.filter(e=>e.vorgabe).map(e=>e.id);
   if(!rest.length&&bekannt.length===vorgabe.length&&bekannt.every((id,i)=>id===vorgabe[i]))delete n.visible_items;else n.visible_items=[...bekannt,...rest];}
  if(Array.isArray(n.collapsed_items)){const liste=[...katalog.filter(e=>e.kompakt&&n.collapsed_items.includes(e.id)).map(e=>e.id),...fremd(n.collapsed_items,vorher?.collapsed_items)];if(liste.length)n.collapsed_items=liste;else delete n.collapsed_items;}
  return n;},
 schema(schema,katalog,t){if(!katalog)return schema;const kompakt=katalog.filter(e=>e.kompakt),optionen=liste=>liste.map(e=>({value:e.id,label:t?.anzeige?.[e.id]||e.id}));
  return schema.filter(f=>f.name!=='collapsed_items'||kompakt.length).map(f=>f.name==='visible_items'||f.name==='collapsed_items'?{...f,selector:{...f.selector,select:{...f.selector.select,options:optionen(f.name==='visible_items'?katalog:kompakt)}}}:f);}
};
// Listenmodus der VM-Karte: leer, Server-ID oder (noch) unbekanntes Gerät; sonst Einzel-VM.
function buschUnraidVmListe(core,config){if(!config?.device_id)return true;const d=core?.devices?.get?.(config.device_id);return !d||d.model==='Unraid';}
// #641: Mit aktivem Stream baut `set hass` nur neu, wenn Sprache/Zeitzone oder die Konfiguration wechseln oder die beim letzten
// Render gelesenen Geräte (Kern-`track`) neue Versionen haben; ohne Stream oder ohne `track` (älterer Kern) wie bisher immer.
function unraidHassRender(karte,vorher,hass){const core=karte._core;
 if(karte._deps&&core?.streaming&&vorher&&karte._depsConfig===karte._config&&vorher.locale===hass?.locale&&vorher.language===hass?.language&&vorher.config?.time_zone===hass?.config?.time_zone&&core.unchanged(karte._deps))return;
 karte._deps=null;karte._depsConfig=karte._config;if(typeof core?.track==='function')karte._deps=core.track(()=>karte._render());else karte._render();}
class BuschUnraidBaseCard extends HTMLElement {
 constructor(){super();this.attachShadow({mode:'open'});this._config={...BUSCH_UNRAID_DEFAULTS};this._expanded=true;this._generation=0;}
 setConfig(config){const next={...BUSCH_UNRAID_DEFAULTS,...buschUnraidConfig(config)},same=buschCoreKey(this._config)===buschCoreKey(next),context=value=>buschCoreKey([value.device_id,value.container_key,value.vm_id]);
  // R21: Einklappen je Schlüssel gemerkt; gelesen nur, wenn sich der Schlüssel ändert (localStorage-Fehler still).
  const schluessel=this._schluessel(next);if(schluessel!==this._klappSchluessel){this._klappSchluessel=schluessel;try{this._eingeklappt=unraidSpeicher()?.getItem(schluessel)==='1';}catch{this._eingeklappt=false;}}
  if(same){if(!this._anzeige)this._anzeige=unraidAnzeige(next,UNRAID_ANZEIGE[this._kind]);return;}if(context(this._config)!==context(next)||!this._config.device_id)this._expanded=next.start_expanded;this._config=next;this._anzeige=unraidAnzeige(next,UNRAID_ANZEIGE[this._kind]);this._error=null;this._generation++;this._render();}
 // #642: Abschnitte aus `_anzeige` (nur in setConfig berechnet, #641).
 _zeigt(id){return unraidZeigt(this,id);}
 _metrikSicht(){return {cpu:this._zeigt('cpu'),ram:this._zeigt('ram')};}
 // [A-10] unraid-cards:<art>:<device_id>:<title>, beim Container zusätzlich :<container_key> (zwei Container eines Stacks).
 _schluessel(config=this._config){return 'unraid-cards:'+this._kind+':'+(config?.device_id||'')+':'+(config?.title||'')+(this._kind==='container'?':'+(config?.container_key||''):'');}
 _umschalten(){this._eingeklappt=!this._eingeklappt;try{unraidSpeicher()?.setItem(this._schluessel(),this._eingeklappt?'1':'0');}catch{}this._render();}
 // Kompaktwerte nur aus dem fertigen Modell; gestoppte VM/Container ohne CPU/RAM (Linie von #640).
 _kompakt(m,t){if(!m?.device)return {};const lang=this._hass?.locale?.language,prozent=n=>typeof n==='number'&&Number.isFinite(n)?BuschUI.formatNumber(n,lang,{maximumFractionDigits:1})+' %':null,bytes=n=>typeof n==='number'&&Number.isFinite(n)?unraidBytes(n,lang):null,status=r=>unraidKw(buschUnraidStatusText(r,t,lang),unraidKompaktSemantik(r.status==='updating'?'warning':r.status));
  if(this._kind==='stack')return {status:status(m),cpu:unraidKw(prozent(m.cpu)),ram:unraidKw(bytes(m.ram)),containers:m.total?unraidKw(`${m.running}/${m.total}`):null};
  const r=m.selected;if(!r)return {};const laeuft=r.status==='running';return {status:status(r),cpu:laeuft?unraidKw(prozent(r.cpu)):null,ram:laeuft?unraidKw(bytes(r.ram)):null};}
 set hass(hass){const vorher=this._hass;this._hass=hass;if(this.isConnected)this._connect();this._core?.attach(hass);unraidHassRender(this,vorher,hass);}
 get hass(){return this._hass;}
 connectedCallback(){this._connect();this._render();}
 disconnectedCallback(){this._release?.();this._unwatch?.();this._unwatchDevice?.();this._unwatchDevice=null;this._watchDeviceId=null;this._release=this._unwatch=null;this._generation++;}
 _connect(){if(!this._hass||this._release)return;this._core=ensureBuschCore(1);this._release=this._core.retain(this._hass);this._unwatch=this._core.watch(()=>this._render());}
 getCardSize(){return this._eingeklappt?1+(this._anzeige?.kompakt?.length?1:0):this._kind==='stack'&&this._expanded?4:2;}
 getGridOptions(){return {columns:12,min_columns:3};}
 _button(parent,text,action,disabled=false,destructive=false,focusKey){const button=BuschUI.action({label:text,text,onClick:action,disabled,variant:destructive?'danger':'secondary'});if(destructive)button.className+=' danger';if(focusKey)button.dataset.focusKey=focusKey;parent.appendChild(button);return button;}
 _actions(parent,row,t){const actions=buschUnraidNode('div',undefined,'actions');
  if(this._config.show_controls&&row.switch){const running=this._kind==='vm'?buschUnraidVmForceable(row.status):row.status==='running'||row.status==='partial'||row.switch.state==='on';this._button(actions,running?(this._kind==='vm'?t.vm_shutdown:t.stop):t.start,()=>this._action(running?'stop':'start',row),this._busy||!buschUnraidAvailable(row.switch)||row.status==='updating'||(this._kind==='vm'&&!['running','stopped'].includes(row.status)),running,'control');}
  if(this._config.show_controls&&this._config.show_restart&&row.restart)this._button(actions,t.restart,()=>this._action('restart',row),this._busy||row.restart.state==='unavailable'||row.status==='updating'||(this._kind==='vm'&&row.status!=='running'),false,'restart');
  if(row.switch){const details=this._button(actions,t.details,()=>this._action('details',row),false,false,'details');details.className+=' quiet';}
  if(this._kind==='vm'&&this._config.show_controls&&row.force_stop&&buschUnraidVmForceable(row.status))this._button(actions,t.force_stop,()=>this._action('force_stop',row),this._busy||row.force_stop.state==='unavailable',true,'force-stop');
  if(this._config.show_updates&&row.update_all)this._button(actions,row.update_queue?.active?t.updating:t.update_all,()=>this._action('update_all',row),this._busy||row.update_queue?.active||row.update_all.state==='unavailable',false,'update-all');
  if(this._config.show_updates&&row.update&&(row.update.state==='on'||row.status==='updating'))this._button(actions,row.status==='updating'?t.updating:t.update,()=>this._action('update',row),row.status==='updating',false,'update');
  if(actions.childNodes.length)parent.appendChild(actions);
 }
 async _action(action,row){
  const t=buschTexte(BUSCH_UNRAID_TEXT,this._hass);
  // Während ein Bestätigungsdialog offen ist, weitere Aufrufe ignorieren; nach der Antwort den Zustand frisch prüfen.
  if(this._confirming)return;
  if(action==='details'||action==='update'){const entity=action==='update'?row.update:row.switch;if(entity)this.dispatchEvent(new CustomEvent('hass-more-info',{detail:{entityId:entity.entity_id},bubbles:true,composed:true}));return;}
  if(action==='update_all'){if(this._busy||row.update_queue?.active||!row.update_all||row.update_all.state==='unavailable')return;this._busy=true;this._error=null;this._render();try{await this._hass.callService('button','press',{entity_id:row.update_all.entity_id});}catch{this._error=t.failed;}finally{this._busy=false;this._render();}return;}
  if(this._busy||(row.status==='updating'&&['start','stop','restart'].includes(action))||(this._kind==='vm'&&((action==='start'&&row.status!=='stopped')||(['restart','stop'].includes(action)&&row.status!=='running')||(action==='force_stop'&&!buschUnraidVmForceable(row.status)))))return;const entity=action==='restart'?row.restart:action==='force_stop'?row.force_stop:row.switch;
  if(!entity||entity.state==='unavailable'||(!['restart','force_stop'].includes(action)&&!buschUnraidAvailable(entity)))return;
  if(action==='force_stop'||(action==='stop'&&this._config.confirm_stop)||(action==='restart'&&this._config.confirm_restart)){
   this._confirming=true;let ja;try{
    if(action==='force_stop')ja=await unraidBestaetigen(t.force_stop,t.confirm_force_stop.replace('{name}',row.name||''),t.force_stop,true);
    else{const prompt=action==='stop'&&this._kind==='vm'?t.confirm_vm_shutdown:t['confirm_'+action];const aktion=action==='stop'?(this._kind==='vm'?t.vm_shutdown:t.stop):t.restart;ja=await unraidBestaetigen(aktion,prompt.replace('{name}',row.name||''),aktion,action==='stop');}
   }finally{this._confirming=false;}
   if(!ja)return;
   const jetzt=this._hass?.states?.[entity.entity_id]||entity;
   if(this._busy||jetzt.state==='unavailable'||(!['restart','force_stop'].includes(action)&&!buschUnraidAvailable(jetzt)))return;
  }
  const generation=this._generation;this._busy=true;this._error=null;this._render();
  try{await this._hass.callService(['restart','force_stop'].includes(action)?'button':'switch',['restart','force_stop'].includes(action)?'press':action==='start'?'turn_on':'turn_off',{entity_id:entity.entity_id});}
  catch{if(generation===this._generation)this._error=t.failed;}
  finally{this._busy=false;this._render();}
 }
 _render(){if(!this.shadowRoot||!this._config)return;const active=this.shadowRoot.activeElement,row=active?.closest?.('.row'),headerAction=active?.tagName==='BUTTON'&&active.closest?.('.header > .actions')?active.dataset.focusKey:null,focus=row&&active?.tagName==='BUTTON'?{entity:row.dataset.entityId,index:[...row.querySelectorAll('button')].indexOf(active)}:headerAction?{headerAction}:active?.dataset?.focusKey==='toggle'?{toggle:true}:active?.classList?.contains('disclosure')?{disclosure:true}:null,scroll={x:window.scrollX,y:window.scrollY};const t=buschTexte(BUSCH_UNRAID_TEXT,this._hass),m=buschUnraidModel(this._core,this._config,this._kind);if(this.isConnected&&this._watchDeviceId!==m.device?.id){this._unwatchDevice?.();this._watchDeviceId=m.device?.id;this._unwatchDevice=this._watchDeviceId?this._core.watchDevice?.(this._watchDeviceId,()=>this._render()):null;}const signature=JSON.stringify([this._config,m,this._expanded,!!this._eingeklappt,!!this._busy,this._error,t]);if(signature===this._renderSignature)return;this._renderSignature=signature;const card=buschUnraidNode('ha-card'),style=buschUnraidNode('style',UNRAID_FAMILIE_STYLE);card.className=this._config.layout;
  // Kachel-Kopf (#564): neue Klassen tile-* zusätzlich; header/header-main/card-icon/detail bleiben für Fokuslogik und Renderskripte.
  const header=buschUnraidNode('div',undefined,'header tile-head'),title=this._config.title||m.device?.name_by_user||m.device?.name||t[this._kind];
  // #643/6: Titel und Badge in .title-row; Einklapp-Knopf oben rechts; Aktionen eigene Zeile (.header > .actions bleibt).
  const main=buschUnraidNode('div',undefined,'header-main tile-text'),titleRow=buschUnraidNode('div',undefined,'title-row'),titleNode=buschUnraidNode('h2',title,'tile-title');
  titleRow.appendChild(titleNode);main.appendChild(titleRow);header.appendChild(buschMedia(this._config,m.selected||m.device||{},this._kind==='vm'?'mdi:monitor':this._kind==='stack'?'mdi:docker':'mdi:cube-outline','card-icon tile-icon'));header.appendChild(main);
  header.appendChild(unraidEinklappKnopf({eingeklappt:!!this._eingeklappt,t:buschTexte(UNRAID_TILE_TEXTE,this._hass),onClick:()=>this._umschalten()}));card.appendChild(header);
  // Eingeklappt: Inhalt landet in einem nicht eingehängten Knoten (nur Kopf, Aktionen und ggf. Kompaktzeile sichtbar).
  const zu=!!this._eingeklappt,body=zu?buschUnraidNode('div'):card,lang=this._hass?.locale?.language;
  const message=text=>body.appendChild(buschUnraidNode('p',text,'message'));
  if(!m.device)message(t.empty);
  else if(this._kind==='container'||this._kind==='vm'){
   const row=m.selected;if(!row)message(m.containers.length?t.choose:t.metadata);else{if(!this._config.title)titleNode.textContent=row.name;if(this._zeigt('status'))titleRow.appendChild(buschUnraidBadge(row.status==='updating'?'warning':row.status,buschUnraidStatusText(row,t,lang)));main.appendChild(buschUnraidNode('p',this._kind==='vm'?t.vm_subtitle:row.stack||t.standalone,'detail tile-sub'));if(row.status==='running'&&!zu)body.appendChild(buschUnraidMetrics(row,this._metrikSicht(),t,lang));buschUnraidProgress(body,row,t);if(row.image&&(this._kind!=='container'||this._zeigt('image')))main.appendChild(buschUnraidNode('p',row.image,'detail tile-sub'));this._actions(header,row,t);}
  }else{
   if(this._zeigt('status')){titleRow.appendChild(buschUnraidBadge(m.status==='updating'?'warning':m.status,buschUnraidStatusText(m,t,lang)));main.appendChild(buschUnraidNode('p',t.running_count.replace('{running}',m.running).replace('{total}',m.total),'detail tile-sub'));}
   if(m.update_queue&&this._zeigt('update_queue')){const q=m.update_queue;message(t.queue_count.replace('{completed}',q.completed_count).replace('{total}',q.total_count).replace('{failed}',q.failed_count).replace('{queued}',q.queued_count));if(q.current_target)message(t.current_target.replace('{name}',q.current_target));if(q.blocked)message(t.queue_blocked);buschUnraidProgress(body,m,t);}
   this._actions(header,{...m,name:title},t);if(!zu)body.appendChild(buschUnraidMetrics(m,this._metrikSicht(),t,lang));if(!m.switch&&!m.containers.length)message(t.metadata);
   if(this._zeigt('containers')&&m.containers.length&&!zu){const expand=this._button(body,t.container_group.replace('{count}',m.containers.length),()=>{this._expanded=!this._expanded;this._render();});expand.className+=' disclosure';expand.setAttribute('aria-expanded',String(this._expanded));expand.setAttribute('aria-label',this._expanded?t.collapse:t.expand);
  if(this._expanded){const rows=buschUnraidNode('div',undefined,'rows'),visible=m.containers.filter(c=>this._config.state_filter==='all'||c.status===this._config.state_filter||(c.status==='updating'&&this._config.state_filter==='running'&&c.switch?.state==='on'));if(!visible.length)rows.appendChild(buschUnraidNode('p',t.none,'message'));for(const row of visible){const item=buschUnraidNode('div',undefined,'row');item.dataset.entityId=row.switch?.entity_id||row.update?.entity_id||row.container_key||row.name;const identity=buschUnraidNode('div',undefined,'row-identity'),texts=buschUnraidNode('div',undefined,'row-text');texts.appendChild(buschUnraidNode('div',row.name,'name'));if(row.image)texts.appendChild(buschUnraidNode('p',row.image,'detail'));identity.appendChild(buschMedia(this._config,row,'mdi:cube-outline','row-icon'));identity.appendChild(texts);item.appendChild(identity);if(this._zeigt('status'))item.appendChild(buschUnraidBadge(row.status==='updating'?'warning':row.status,buschUnraidStatusText(row,t,lang)));item.appendChild(buschUnraidMetrics(row,this._metrikSicht(),t,lang));buschUnraidProgress(item,row,t);this._actions(item,row,t);rows.appendChild(item);}body.appendChild(rows);}
   }
  }
  if(this._config.debug){const debug=buschUnraidNode('p',JSON.stringify({device_id:m.device?.id,control:m.selected?.switch?.entity_id||m.switch?.entity_id,restart:m.selected?.restart?.entity_id||m.restart?.entity_id}),'message detail');body.appendChild(debug);}
  if(zu){const zeile=unraidKompaktZeile(this._anzeige?.kompakt,this._kompakt(m,t),t);if(zeile)card.appendChild(zeile);}
  if(this._error){const error=buschUnraidNode('p',this._error,'message error');error.setAttribute('role','alert');card.appendChild(error);}titleNode.title=titleNode.textContent;BuschUI.header({node:header,titleNode});this.shadowRoot.replaceChildren(style,card);if(focus){let target;if(focus.disclosure)target=this.shadowRoot.querySelector('.disclosure');else if(focus.toggle)target=this.shadowRoot.querySelector('[data-focus-key="toggle"]');else if(focus.headerAction)target=[...this.shadowRoot.querySelectorAll('.header > .actions button')].find(button=>button.dataset.focusKey===focus.headerAction);else{const item=[...this.shadowRoot.querySelectorAll('.row')].find(node=>node.dataset.entityId===focus.entity);const buttons=[...(item?.querySelectorAll('button')||[])];target=buttons[focus.index]||buttons[0];}target?.focus({preventScroll:true});}if(window.scrollX!==scroll.x||window.scrollY!==scroll.y)window.scrollTo({left:scroll.x,top:scroll.y,behavior:'instant'});
 }
}
class BuschUnraidStackCard extends BuschUnraidBaseCard {
 get _kind(){return 'stack';}
 static getConfigElement(){return document.createElement('busch-unraid-stack-card-editor');}
 static getStubConfig(hass){if(!hass)return {type:'custom:busch-unraid-stack-card'};const core=ensureBuschCore(1);core.attach(hass);const device=buschUnraidDevices(core,'stack')[0];return {type:'custom:busch-unraid-stack-card',...(device?{device_id:device.id}:{})};}
}
class BuschUnraidContainerCard extends BuschUnraidBaseCard {
 get _kind(){return 'container';}
 static getConfigElement(){return document.createElement('busch-unraid-container-card-editor');}
 static getStubConfig(hass){if(!hass)return {type:'custom:busch-unraid-container-card'};const core=ensureBuschCore(1);core.attach(hass);const device=buschUnraidDevices(core,'container')[0],model=buschUnraidModel(core,{device_id:device?.id},'container');return {type:'custom:busch-unraid-container-card',...(device?{device_id:device.id}:{}),...(model.containers[0]?{container_key:model.containers[0].key}:{})};}
}
// VM-Karte: device_id eines Servers (oder leer) → Liste aller VMs des Servers im Kachelstil; device_id eines
// VM-Geräts (alte Konfiguration) → unveränderte Einzelansicht der Familie. Aktionen je Zeile über _actions/_action.
class BuschUnraidVmCard extends BuschUnraidBaseCard {
 get _kind(){return 'vm';}
 // Einklappen (Liste und Einzelansicht) aus der Basis, gemerkt unter unraid-cards:vm:<device_id>:<title>.
 setConfig(config){const vorher=buschCoreKey(this._config);super.setConfig(config);if(buschCoreKey(this._config)!==vorher&&this._alle!==undefined){this._alle=undefined;this._render();}}
 // Der Schalter „Alle VMs“ ändert nur die Anzeige dieser Karte, nicht die gespeicherte Konfiguration.
 _zeigeAlle(){return this._alle??!!this._config.show_all;}
 // Unbekanntes Gerät (Kern noch nicht geladen): im Zweifel Liste mit Ladezustand statt kurz der Einzelpfad.
 _istListe(){return buschUnraidVmListe(this._core,this._config);}
 _modellListe(){const s=unraidServer(this._core,this._config);const z=unraidZustand(s);if(z)return z;const alle=s.geraete('Virtual machine').map(d=>buschUnraidModel(this._core,{...this._config,device_id:d.id},'vm').selected).filter(Boolean);return {name:s.server.name_by_user||s.server.name,vms:alle.filter(r=>this._zeigeAlle()||r.status==='running'),unbekannt:this._zeigeAlle()?[]:alle.filter(r=>['unavailable','unknown'].includes(r.status)).map(r=>r.name)};}
 async _zeilenAktion(action,row){return this._action(action,row);}
 // Eingeklappt: in der Liste zählt nur `vms`, in der Einzelansicht nur die Einzelwerte ([A-2]).
 getCardSize(){if(!this._eingeklappt)return this._istListe()?3:super.getCardSize();const k=this._anzeige?.kompakt||[];return 1+((this._istListe()?k.includes('vms'):k.some(id=>id!=='vms'))?1:0);}
 // Liste: Anzahl laufender VMs (unabhängig von „Alle VMs“); Einzelansicht wie die Basis.
 _kompakt(m,t){if(!this._istListe())return super._kompakt(m,t);if(m.laedt||m.fehler||!m.vms)return {};return {vms:unraidKw(String(m.vms.filter(r=>r.status==='running').length))};}
 disconnectedCallback(){super.disconnectedCallback();unraidBeobachten(this,[]);}
 _render(){
  if(!this.shadowRoot||!this._config)return;if(!this._istListe()){this._listSignature=null;unraidBeobachten(this,[]);return super._render();}this._renderSignature=null;
  const h=this._hass,t={...buschTexte(BUSCH_UNRAID_TEXT,h),...buschTexte(TEXTE_BUSCH_UNRAID_VM_CARD,h)},m=this._core&&h?this._modellListe():{laedt:true},alle=this._zeigeAlle();
  // Liste: Server und seine VM-Geräte beobachten (Stream-Updates), Platten usw. nicht.
  if(this.isConnected&&this._core&&h)unraidBeobachten(this,unraidServerIds(this._core,this._config).filter(id=>['Unraid','Virtual machine'].includes(this._core.devices?.get?.(id)?.model)));
  const kt=buschTexte(UNRAID_TILE_TEXTE,h),signature=JSON.stringify([this._config,alle,m,!!this._busy,this._error,t,!!this._eingeklappt]);if(signature===this._listSignature)return;this._listSignature=signature;
  const active=this.shadowRoot.activeElement,fokus=active?.tagName==='BUTTON'?{key:active.dataset.focusKey,entity:active.closest?.('.vm-row')?.dataset.entityId}:null;
  const style=buschUnraidNode('style',UNRAID_TILE_STYLE),card=buschUnraidNode('ha-card');card.className=('tile '+(this._config.layout||'')).trim();
  const head=buschUnraidNode('div',undefined,'tile-head header'),icon=BuschUI.ha.icon('mdi:monitor-multiple');icon.className='tile-icon';icon.setAttribute('aria-hidden','true');head.appendChild(icon);
  const tx=buschUnraidNode('div',undefined,'tile-text'),titel=buschUnraidNode('h2',this._config.title||t.vm_list,'tile-title');titel.title=titel.textContent;tx.appendChild(titel);if(m.name)tx.appendChild(buschUnraidNode('p',m.name,'tile-sub'));head.appendChild(tx);
  const leiste=buschUnraidNode('div',undefined,'tile-actions'),schalter=BuschUI.action({label:t.show_all,text:t.show_all,onClick:()=>{this._alle=!this._zeigeAlle();this._render();},variant:'secondary'});schalter.dataset.focusKey='show-all';schalter.setAttribute('aria-pressed',String(alle));leiste.appendChild(schalter);
  head.appendChild(unraidEinklappKnopf({eingeklappt:!!this._eingeklappt,t:kt,onClick:()=>this._umschalten()}));head.appendChild(leiste);card.appendChild(head);
  const message=text=>card.appendChild(buschUnraidNode('p',text,'message'));
  if(this._eingeklappt){const zeile=m.laedt||m.fehler?null:unraidKompaktZeile(this._anzeige?.kompakt,this._kompakt(m,t),t);if(zeile)card.appendChild(zeile);}
  else if(m.laedt)message(t.loading);else if(m.fehler)message(t[m.fehler]||t.empty);else if(!this._zeigt('vms')){/* [A-1] ohne Abschnitt vms: nur Kopf und Aktionen */}else if(!m.vms.length)message(m.unbekannt?.length?t.unavailable:t.none_vms);
  else{const rows=buschUnraidNode('div',undefined,'rows');for(const r of m.vms){const row=buschUnraidNode('div',undefined,'row vm-row');row.dataset.entityId=r.switch?.entity_id||r.key||r.name;const id=buschUnraidNode('div',undefined,'row-identity'),nm=buschUnraidNode('div',undefined,'row-text');id.appendChild(buschMedia(this._config,r,'mdi:monitor','row-icon'));nm.appendChild(buschUnraidNode('div',r.name,'name'));id.appendChild(nm);row.appendChild(id);
   if(this._zeigt('status'))row.appendChild(buschUnraidBadge(r.status,buschUnraidStatusText(r,t,h?.locale?.language)));
   if(r.status==='running'&&(this._zeigt('cpu')||this._zeigt('ram')))row.appendChild(buschUnraidMetrics(r,this._metrikSicht(),t,h?.locale?.language));
   this._actions(row,r,t);rows.appendChild(row);}card.appendChild(rows);if(m.unbekannt?.length)message(`${t.unavailable}: ${m.unbekannt.join(', ')}`);}
  if(this._error){const e=buschUnraidNode('p',this._error,'message error');e.setAttribute('role','alert');card.appendChild(e);}
  this.shadowRoot.replaceChildren(style,card);
  if(fokus?.key){const ziel=[...this.shadowRoot.querySelectorAll('button')].find(b=>b.dataset.focusKey===fokus.key&&(['show-all','toggle'].includes(fokus.key)||b.closest?.('.vm-row')?.dataset.entityId===fokus.entity));ziel?.focus?.({preventScroll:true});}
 }
 static getConfigElement(){return document.createElement('busch-unraid-vm-card-editor');}
 // Ohne device_id: bei genau einem Server sofort die VM-Liste, bei mehreren „Server wählen“.
 static getStubConfig(){return {type:'custom:busch-unraid-vm-card'};}
}
class BuschUnraidBaseEditor extends BuschEditorBase {
 get _defaults(){return BUSCH_UNRAID_DEFAULTS;}
 // #642: Abschnitte/Kompaktwerte aus dem Katalog der Kartenart (Stack, Container, VM, Docker).
 get _katalog(){return UNRAID_ANZEIGE[this._kind]||null;}
 _formDaten(){return unraidAnzeigeEditor.formDaten({...this._defaults,...this._config},this._katalog);}
 setConfig(config){if(!this._acceptConfig(config,buschUnraidConfig))return;this._render();}
 set hass(hass){this._hass=hass;if(this.isConnected)this._connect();this._core?.attach(hass);this._render();}
 connectedCallback(){this._connect();this._render();}
 disconnectedCallback(){this._release?.();this._unwatch?.();this._release=this._unwatch=null;}
 _connect(){if(!this._hass||this._release)return;this._core=ensureBuschCore(1);this._release=this._core.retain(this._hass);this._unwatch=this._core.watch(()=>this._render());}
 _render(){if(!this._config||!this._hass)return;const t=buschTexte(BUSCH_UNRAID_TEXT,this._hass);if(!this._form){this._form=BuschUI.ha.form();this._form.addEventListener('value-changed',event=>{event.stopPropagation();const next=buschUnraidConfig({...this._config,...event.detail.value});let structural=false;if((next.device_id||'')!==(this._config.device_id||'')){delete next.container_key;delete next.switch_entity;delete next.update_entity;structural=true;}this._publishConfig(unraidAnzeigeEditor.normalisiere(next,this._katalog,this._config));this._form.data=this._formDaten();if(structural)this._render();});this.appendChild(this._form);}
  const fields=this._kind==='vm'?buschTexte(TEXTE_BUSCH_UNRAID_VM_CARD,this._hass):this._kind==='docker'?buschTexte(TEXTE_BUSCH_UNRAID_DOCKER_CARD,this._hass):t;
  this._form.hass=this._hass;this._form.data=this._formDaten();this._form.schema=buschSchemaMitTexten(unraidAnzeigeEditor.schema(buschUnraidSchema(this._core,this._config,this._kind),this._katalog,fields),this._kind==='docker'?fields:t);this._form.computeLabel=s=>fields.labels[s.name]||s.name;this._form.computeHelper=s=>s.name==='show_restart'&&s.disabled?t.restart_missing:fields.helpers[s.name]||'';
 }
}
class BuschUnraidStackEditor extends BuschUnraidBaseEditor {get _kind(){return 'stack';}}
class BuschUnraidContainerEditor extends BuschUnraidBaseEditor {get _kind(){return 'container';}}
if(!customElements.get?.('busch-unraid-stack-card'))customElements.define('busch-unraid-stack-card',BuschUnraidStackCard);
if(!customElements.get?.('busch-unraid-container-card'))customElements.define('busch-unraid-container-card',BuschUnraidContainerCard);
if(!customElements.get?.('busch-unraid-stack-card-editor'))customElements.define('busch-unraid-stack-card-editor',BuschUnraidStackEditor);
if(!customElements.get?.('busch-unraid-container-card-editor'))customElements.define('busch-unraid-container-card-editor',BuschUnraidContainerEditor);
window.customCards=window.customCards||[];
if(!window.customCards.some(c=>c.type==='busch-unraid-stack-card'))window.customCards.push({type:'busch-unraid-stack-card',name:buschTexte(TEXTE_BUSCH_UNRAID_STACK_CARD).stack,description:buschTexte(TEXTE_BUSCH_UNRAID_STACK_CARD).stack_description,preview:true,documentationURL:'https://github.com/luukkii123/ha-unraid-cards'});
if(!window.customCards.some(c=>c.type==='busch-unraid-container-card'))window.customCards.push({type:'busch-unraid-container-card',name:buschTexte(TEXTE_BUSCH_UNRAID_CONTAINER_CARD).container,description:buschTexte(TEXTE_BUSCH_UNRAID_CONTAINER_CARD).container_description,preview:true,documentationURL:'https://github.com/luukkii123/ha-unraid-cards'});

class BuschUnraidVmEditor extends BuschUnraidBaseEditor {get _kind(){return 'vm';}}
if(!customElements.get?.('busch-unraid-vm-card'))customElements.define('busch-unraid-vm-card',BuschUnraidVmCard);
if(!customElements.get?.('busch-unraid-vm-card-editor'))customElements.define('busch-unraid-vm-card-editor',BuschUnraidVmEditor);
if(!window.customCards.some(c=>c.type==='busch-unraid-vm-card'))window.customCards.push({type:'busch-unraid-vm-card',name:buschTexte(BUSCH_UNRAID_TEXT).vm,description:buschTexte(BUSCH_UNRAID_TEXT).vm_description,preview:true,documentationURL:'https://github.com/luukkii123/ha-unraid-cards'});

/* ── Unraid Docker overview: one tile per Compose stack and per standalone
 * container of one Unraid server, Unraid-dashboard style. Reuses the family
 * model (buschUnraidModel), status semantics, BuschUI media and the shared
 * _action path (confirmations, services, more-info). VMs stay out. ── */
const BUSCH_UNRAID_DOCKER_DEFAULTS = { ...BUSCH_UNRAID_DEFAULTS, device_id: '', title: '', hide_stopped: false, sort: 'name', start_expanded: false, columns: 'auto', confirm_stop: true, confirm_restart: true };
const SCHEMA_BUSCH_UNRAID_DOCKER_CARD = [
 {name: "device_id", "selector": {"select": {"options": []}}},
 {name: "title", "selector": {"text": {}}},
 {name: "visible_items", "selector": {"select": {"multiple": true, "mode": "list", "options": []}}},
 {name: "collapsed_items", "selector": {"select": {"multiple": true, "mode": "list", "options": []}}},
 {name: "hide_stopped", "selector": {"boolean": {}}},
 {name: "sort", "selector": {"select": {"options": [{"value": "name"}, {"value": "state"}]}}},
 {name: "start_expanded", "selector": {"boolean": {}}},
 {name: "columns", "selector": {"select": {"options": [{"value": "auto"}, {"value": "1"}, {"value": "2"}, {"value": "3"}, {"value": "4"}]}}},
 {name: "confirm_stop", "selector": {"boolean": {}}},
 {name: "confirm_restart", "selector": {"boolean": {}}}
];
const TEXTE_BUSCH_UNRAID_DOCKER_CARD = {
 de: {
  name: 'Unraid Docker',
  description: 'Zeigt alle Docker-Container und Compose-Stacks eines Unraid-Servers als Kacheln, mit Aktionen je Kachel.',
  labels: {device_id: 'Unraid-Server', title: 'Titel', hide_stopped: 'Gestoppte ausblenden', sort: 'Sortierung', start_expanded: 'Stacks ausgeklappt', columns: 'Spalten', confirm_stop: 'Stoppen bestätigen', confirm_restart: 'Neustart bestätigen',visible_items:'Angezeigt',collapsed_items:'Eingeklappt anzeigen'},
  helpers: {device_id: 'Wählt den Unraid-Server, dessen Container gezeigt werden. Vorgabe ist der einzige vorhandene Server.', title: 'Eigener Kartentitel. Vorgabe ist „Docker-Container“.', hide_stopped: 'Blendet gestoppte Stacks und Container aus. Vorgabe ist aus.', sort: 'Sortiert die Kacheln nach Name oder Zustand. Vorgabe ist Name.', start_expanded: 'Zeigt die Container jedes Stacks schon beim Laden. Vorgabe ist aus.', columns: 'Legt die Spaltenzahl fest; automatisch passt sie an die Kartenbreite an. Vorgabe ist automatisch.', confirm_stop: 'Fragt vor dem Stoppen nach. Vorgabe ist ein.', confirm_restart: 'Fragt vor dem Neustart nach. Vorgabe ist ein.',visible_items:'Abschnitte, die ausgeklappt sichtbar sind. Vorgabe: alle wie bisher.',collapsed_items:'Kennzahlen in einer Zeile unter dem Kopf, wenn die Karte eingeklappt ist. Vorgabe: keine.'},anzeige:{summary:'Zusammenfassung',stacks:'Stacks',containers:'Eigenständige Container'},kurz:{summary:'Gestartet'},compact_label:'Kennzahlen',
  texte: {sort_name: 'Name', sort_state: 'Zustand', columns_auto: 'Automatisch', columns_1: '1', columns_2: '2', columns_3: '3', columns_4: '4',
   default_title: 'Docker-Container', running_total: '{running} von {total} gestartet', stack_count: '{running}/{total} gestartet', stack_stopped: 'Gestoppt · 0/{total}',
   running: 'Gestartet', stopped: 'Gestoppt', paused: 'Pausiert', unavailable: 'Nicht verfügbar', unknown: 'Unbekannt', starting: 'Startet', stopping: 'Stoppt', failed: 'Fehler',
   empty: 'Kein Unraid-Server gefunden. Bitte im Editor einen Server wählen.', no_containers: 'Auf diesem Server gibt es keine Docker-Container.', all_hidden: 'Alle Container sind gestoppt und ausgeblendet.',
   menu: 'Aktionen für {name}', expand: 'Ausklappen', collapse: 'Einklappen', show_containers: 'Container von {name} anzeigen', hide_containers: 'Container von {name} ausblenden',
   start: 'Starten', stop: 'Stoppen', restart: 'Neu starten', update: 'Update', update_all: 'Alle aktualisieren', details: 'Details', close: 'Schließen', in_stack: 'In {name}', stack: 'Stack'}
 },
 en: {
  name: 'Unraid Docker',
  description: 'Shows every Docker container and Compose stack of an Unraid server as tiles, with actions per tile.',
  labels: {device_id: 'Unraid server', title: 'Title', hide_stopped: 'Hide stopped', sort: 'Sort order', start_expanded: 'Stacks expanded', columns: 'Columns', confirm_stop: 'Confirm stop', confirm_restart: 'Confirm restart',visible_items:'Shown',collapsed_items:'Shown when collapsed'},
  helpers: {device_id: 'Selects the Unraid server whose containers are shown. Defaults to the only server.', title: 'Custom card title. Defaults to “Docker containers”.', hide_stopped: 'Hides stopped stacks and containers. Default is off.', sort: 'Sorts the tiles by name or state. Default is name.', start_expanded: 'Shows the containers of every stack when loaded. Default is off.', columns: 'Sets the number of columns; auto adapts to the card width. Default is auto.', confirm_stop: 'Asks before stopping. Default is on.', confirm_restart: 'Asks before restarting. Default is on.',visible_items:'Sections shown when expanded. Default: all, as before.',collapsed_items:'Values shown in one line below the header while collapsed. Default: none.'},anzeige:{summary:'Summary',stacks:'Stacks',containers:'Standalone containers'},kurz:{summary:'Started'},compact_label:'Key figures',
  texte: {sort_name: 'Name', sort_state: 'State', columns_auto: 'Auto', columns_1: '1', columns_2: '2', columns_3: '3', columns_4: '4',
   default_title: 'Docker containers', running_total: '{running} of {total} started', stack_count: '{running}/{total} started', stack_stopped: 'Stopped · 0/{total}',
   running: 'Started', stopped: 'Stopped', paused: 'Paused', unavailable: 'Unavailable', unknown: 'Unknown', starting: 'Starting', stopping: 'Stopping', failed: 'Failed',
   empty: 'No Unraid server found. Select a server in the editor.', no_containers: 'This server has no Docker containers.', all_hidden: 'All containers are stopped and hidden.',
   menu: 'Actions for {name}', expand: 'Expand', collapse: 'Collapse', show_containers: 'Show containers of {name}', hide_containers: 'Hide containers of {name}',
   start: 'Start', stop: 'Stop', restart: 'Restart', update: 'Update', update_all: 'Update all', details: 'Details', close: 'Close', in_stack: 'In {name}', stack: 'Stack'}
 }
};
function buschUnraidServers(core){
 if(!core)return [];
 return [...core.devices.values()].filter(d=>d.model==='Unraid'&&core.getDeviceEntities(d.id).some(e=>e.platform==='unraid_ssh')).sort((a,b)=>String(a.name_by_user||a.name||a.id).localeCompare(String(b.name_by_user||b.name||b.id)));
}
const BUSCH_UNRAID_DOCKER_ORDER={running:0,updating:1,partial:2,starting:3,stopping:4,paused:5,stopped:6,failed:7,unknown:8,unavailable:9};
function buschUnraidDockerSort(rows,sort){return [...rows].sort((a,b)=>(sort==='state'?(BUSCH_UNRAID_DOCKER_ORDER[a.status]??8)-(BUSCH_UNRAID_DOCKER_ORDER[b.status]??8):0)||String(a.name).localeCompare(String(b.name)));}
/** Server → tiles. Stack: own switch/restart/update_all, containers as children.
 * Standalone containers: one tile each. Pictures come from the integration
 * (entity_picture). Unraid SSH 0.8.0 gives the stack switch the picture of its
 * first pictured service and the Compose Manager name (stack_display_name);
 * older backends: borrow the main container's picture, else the first one. */
function buschUnraidDockerModel(core,config){
 const servers=buschUnraidServers(core),server=config.device_id?servers.find(d=>d.id===config.device_id)||null:servers.length===1?servers[0]:null;
 const model={server,tiles:[],running:0,total:0,ambiguous:false};
 if(!server)return model;
 const entries=new Set(core.getDeviceEntities(server.id).filter(e=>e.platform==='unraid_ssh'&&e.config_entry_id).map(e=>e.config_entry_id));
 if(entries.size!==1){model.ambiguous=true;return model;}
 const entry=[...entries][0];
 for(const device of buschUnraidDevices(core,'container')){
  if(!core.getDeviceEntities(device.id).some(e=>e.platform==='unraid_ssh'&&e.config_entry_id===entry))continue;
  if(device.model==='Compose stack'){
   const m=buschUnraidModel(core,{device_id:device.id},'stack');if(!m.switch&&!m.containers.length)continue;
   const name=m.switch?.attributes?.stack_display_name||m.switch?.attributes?.stack_name||m.containers.find(c=>c.switch?.attributes?.stack_display_name)?.switch.attributes.stack_display_name||m.containers.find(c=>c.stack)?.stack||device.name_by_user||device.name||device.id,key='stack:'+device.id;
   const pictured=buschUnraidDockerSort(m.containers,'name').filter(c=>c.entity_picture),main=pictured.find(c=>c.name===name)||pictured[0];
   model.tiles.push({type:'stack',key,name,status:m.status,running:m.running,total:m.total,switch:m.switch,restart:m.restart,update_all:m.update_all,update_queue:m.update_queue,update_progress:m.update_progress,has_update:m.containers.some(c=>c.update?.state==='on'),entity_picture:m.switch?.attributes?.entity_picture||main?.entity_picture,containers:m.containers.map(c=>({...c,type:'container',key:'container:'+c.key,parent:key,parent_name:name}))});
   model.running+=m.running;model.total+=m.total;
  }else{
   const m=buschUnraidModel(core,{device_id:device.id},'container');
   for(const c of m.containers){model.tiles.push({...c,type:'container',key:'container:'+c.key});model.total++;if(c.status==='running'||(c.status==='updating'&&c.switch?.state==='on'))model.running++;}
  }
 }
 model.tiles=buschUnraidDockerSort(model.tiles,config.sort);
 for(const tile of model.tiles)if(tile.containers)tile.containers=buschUnraidDockerSort(tile.containers,config.sort);
 return model;
}
const BUSCH_UNRAID_DOCKER_ICONS={running:['mdi:play','success'],partial:['mdi:play','warning'],stopped:['mdi:stop','neutral'],paused:['mdi:pause','warning'],updating:['mdi:progress-download','warning'],starting:['mdi:play-circle-outline','warning'],stopping:['mdi:stop-circle-outline','warning'],failed:['mdi:alert-circle-outline','error'],unavailable:['mdi:alert-circle-outline','error']};
function buschUnraidDockerStatus(row,t,stackText,locale){
 const [icon,semantic]=BUSCH_UNRAID_DOCKER_ICONS[row.status]||['mdi:help-circle-outline','unknown'];
 let text;
 if(row.status==='updating'||(row.update_state&&row.update_state!=='idle'))text=buschUnraidStatusText(row,stackText,locale);
 else if(row.type==='stack'&&row.total&&['running','partial','stopped'].includes(row.status))text=(row.status==='stopped'?t.stack_stopped:t.stack_count).replace('{running}',row.running).replace('{total}',row.total);
 else text=t[row.status]||t.unknown;
 return {icon,semantic,text};
}
// Nur die Docker-Zusätze; gerendert wird UNRAID_FAMILIE_STYLE + BUSCH_UNRAID_DOCKER_STYLE (Kachel-Kopf, #564).
const BUSCH_UNRAID_DOCKER_STYLE = `
.header{grid-template-columns:48px minmax(0,1fr) auto}.header>.actions{grid-column:auto;justify-content:flex-end}
@container (max-width:440px){.header{grid-template-columns:40px minmax(0,1fr) auto}.header>.actions{grid-column:auto}}
.grid{display:grid;gap:var(--unraid-small);grid-template-columns:minmax(0,1fr)}
@container (min-width:520px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@container (min-width:800px){.grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@container (min-width:1100px){.grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
.grid.cols-1{grid-template-columns:minmax(0,1fr)}.grid.cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}.grid.cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}.grid.cols-4{grid-template-columns:repeat(4,minmax(0,1fr))}
.tile{display:flex;align-items:stretch;min-width:0;border:1px solid var(--divider-color);border-radius:var(--ha-card-border-radius,12px);background:var(--card-background-color);overflow:hidden}
.tile.child{border-inline-start:4px solid var(--primary-color);background:color-mix(in srgb,var(--primary-color) 6%,var(--card-background-color))}
.tile-main{flex:1 1 auto;display:flex;align-items:center;gap:var(--ha-space-3,12px);min-width:0;min-height:64px;margin:0;padding:var(--unraid-small) var(--ha-space-3,12px);border:0;border-radius:0;background:transparent;color:var(--primary-text-color);text-align:start;overflow:hidden}
.tile-main:hover{background:color-mix(in srgb,var(--primary-text-color) 5%,transparent)}
.tile-main:focus-visible,.tile-toggle:focus-visible{outline:2px solid var(--primary-color);outline-offset:-2px}
.tile-main[aria-expanded=true]{background:color-mix(in srgb,var(--primary-color) 12%,transparent)}
.tile-main .tile-icon{--mdc-icon-size:24px;display:grid;grid-template:100%/100%;place-items:center;flex:none;width:40px;height:40px;border-radius:var(--ha-card-border-radius,12px);background:var(--secondary-background-color);color:var(--primary-color);overflow:hidden}
.tile-main .tile-icon img{display:block;width:100%;height:100%;object-fit:contain;padding:var(--ha-space-1,4px);box-sizing:border-box}
.tile-text{display:grid;gap:2px;min-width:0;flex:1 1 auto}
.tile-name{display:block;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;font-size:var(--ha-font-size-m,14px);font-weight:var(--ha-font-weight-medium,500)}
.tile-status{display:flex;align-items:flex-start;gap:var(--ha-space-1,4px);min-width:0;color:var(--secondary-text-color);font-size:var(--ha-font-size-s,12px)}
.tile-status ha-icon{--mdc-icon-size:16px;flex:none;margin-top:1px}
.tile-status-text{min-width:0;overflow-wrap:anywhere}
.sem-success ha-icon{color:var(--success-color,#16864b)}.sem-warning ha-icon{color:var(--warning-color,#a76900)}.sem-error ha-icon,.sem-unavailable ha-icon{color:var(--error-color,#db4437)}.sem-neutral ha-icon,.sem-unknown ha-icon{color:var(--secondary-text-color)}
.tile-toggle{flex:none;display:grid;place-items:center;width:44px;min-width:44px;min-height:44px;margin:0;padding:0;border:0;border-inline-start:1px solid var(--divider-color);border-radius:0;background:transparent;color:var(--secondary-text-color)}
.tile-toggle ha-icon{transition:transform .15s ease}.tile-toggle[aria-expanded=true] ha-icon{transform:rotate(180deg)}
@media (prefers-reduced-motion:reduce){.tile-toggle ha-icon{transition:none}}
.grid>.message{grid-column:1/-1;margin:0}
`;
const BUSCH_UNRAID_DOCKER_MENU_STYLE = `
:host{position:fixed;inset:0;z-index:100000;display:block;font-family:var(--ha-font-family-body,inherit);color:var(--primary-text-color)}
*{box-sizing:border-box;min-width:0}
.menu-scrim{position:absolute;inset:0;background:transparent}
:host([sheet]) .menu-scrim{background:var(--mdc-dialog-scrim-color,rgba(0,0,0,.32))}
.menu-panel{position:absolute;width:min(300px,calc(100vw - 16px));max-height:calc(100vh - 16px);overflow:auto;padding:var(--ha-space-1,4px) 0;border:1px solid var(--divider-color);border-radius:var(--ha-card-border-radius,12px);background:var(--card-background-color,var(--primary-background-color));box-shadow:0 8px 24px rgba(0,0,0,.28)}
:host([sheet]) .menu-panel{left:0;right:0;bottom:0;top:auto;width:100%;max-height:90vh;border-radius:var(--ha-card-border-radius,12px) var(--ha-card-border-radius,12px) 0 0;padding-bottom:calc(var(--ha-space-2,8px) + env(safe-area-inset-bottom,0px))}
.menu-head{display:flex;align-items:center;gap:var(--ha-space-2,8px);padding:0 var(--ha-space-1,4px) 0 var(--ha-space-4,16px);border-bottom:1px solid var(--divider-color)}
.menu-title{flex:1 1 auto;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;font-size:var(--ha-font-size-m,14px);font-weight:var(--ha-font-weight-medium,500);color:var(--secondary-text-color)}
button{font:inherit;cursor:pointer;color:var(--primary-text-color);background:transparent;border:0;margin:0}
button:focus-visible{outline:2px solid var(--primary-color);outline-offset:-2px}
.menu-close{display:grid;place-items:center;flex:none;width:44px;height:44px;border-radius:50%;color:var(--secondary-text-color)}
.item{display:flex;align-items:center;gap:var(--ha-space-3,12px);width:100%;min-height:48px;padding:0 var(--ha-space-4,16px);text-align:start}
.item:hover,.item:focus-visible{background:color-mix(in srgb,var(--primary-text-color) 7%,transparent)}
.item:disabled{color:var(--disabled-text-color);cursor:default;background:transparent}
.item ha-icon{flex:none;color:var(--secondary-text-color)}
.item.danger,.item.danger ha-icon{color:var(--error-color)}
.label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
`;
let buschUnraidDockerMenuSerial=0;
/** Small flüchtiges Menü (R04: Außenklick erlaubt). Hängt an document.body, weil
 * container-type an :host einen festen Bezugsrahmen bilden würde. Eigener
 * Verlaufseintrag: Zurück schließt nur das Menü (ui-regeln Regel 2). */
class BuschUnraidDockerMenu extends HTMLElement {
 constructor(){super();this.attachShadow({mode:'open'});}
 static open(options){for(const old of document.querySelectorAll('busch-unraid-docker-menu'))old._finish();const menu=document.createElement('busch-unraid-docker-menu');document.body.appendChild(menu);menu._show(options);return menu;}
 _show({anchor,title,label,closeLabel,items,onClose}){
  this._onClose=onClose;this._id='busch-unraid-docker-menu-'+(++buschUnraidDockerMenuSerial);
  const style=document.createElement('style');style.textContent=BUSCH_UNRAID_DOCKER_MENU_STYLE;
  const scrim=document.createElement('div');scrim.className='menu-scrim';scrim.addEventListener('click',()=>this.close());
  const panel=document.createElement('div');panel.className='menu-panel';
  const head=document.createElement('div');head.className='menu-head';const caption=document.createElement('p');caption.className='menu-title';caption.textContent=title;caption.title=title;
  const close=document.createElement('button');close.type='button';close.className='menu-close';close.setAttribute('aria-label',closeLabel);close.title=closeLabel;close.appendChild(BuschUI.ha.icon('mdi:close'));close.addEventListener('click',()=>this.close());
  head.append(caption,close);
  const list=document.createElement('div');list.setAttribute('role','menu');list.setAttribute('aria-label',label);
  for(const item of items){const button=document.createElement('button');button.type='button';button.className='item'+(item.danger?' danger':'');button.setAttribute('role','menuitem');button.dataset.action=item.key;button.disabled=!!item.disabled;const icon=BuschUI.ha.icon(item.icon);icon.setAttribute('aria-hidden','true');const text=document.createElement('span');text.className='label';text.textContent=item.label;button.append(icon,text);button.addEventListener('click',async event=>{event.stopPropagation();if(button.disabled)return;await this.close();item.run();});list.appendChild(button);}
  panel.append(head,list);this.shadowRoot.replaceChildren(style,scrim,panel);
  this.addEventListener('keydown',event=>this._key(event));
  history.pushState({buschUnraidDockerMenu:this._id},'');
  this._pop=()=>{if(history.state?.buschUnraidDockerMenu!==this._id)this._finish();};window.addEventListener('popstate',this._pop);
  this._place(anchor,panel);
  this._items()[0]?.focus({preventScroll:true});
 }
 _place(anchor,panel){
  const vw=window.innerWidth,vh=window.innerHeight,sheet=vw<450;this.toggleAttribute('sheet',sheet);
  if(sheet)return;
  const r=anchor.getBoundingClientRect(),m=panel.getBoundingClientRect();
  const left=Math.max(8,Math.min(r.left,vw-m.width-8));let top=r.bottom+4;
  if(top+m.height>vh-8)top=r.top-m.height-4;
  if(top<8)top=Math.max(8,vh-m.height-8);
  panel.style.left=Math.round(left)+'px';panel.style.top=Math.round(top)+'px';
 }
 _items(){return [...this.shadowRoot.querySelectorAll('.item:not(:disabled)')];}
 _key(event){
  const items=this._items(),focusable=[...this.shadowRoot.querySelectorAll('button:not(:disabled)')],active=this.shadowRoot.activeElement,index=items.indexOf(active);
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();this.close();return;}
  const move=to=>{event.preventDefault();items[(to+items.length)%items.length]?.focus();};
  if(event.key==='ArrowDown')move(index+1);else if(event.key==='ArrowUp')move(index<0?items.length-1:index-1);else if(event.key==='Home')move(0);else if(event.key==='End')move(items.length-1);
  else if(event.key==='Tab'&&focusable.length){const at=focusable.indexOf(active),next=event.shiftKey?at-1:at+1;event.preventDefault();focusable[(next+focusable.length)%focusable.length].focus();}
  event.stopPropagation();
 }
 close(){
  if(this._closing)return this._closing;
  this.style.display='none';window.removeEventListener('popstate',this._pop);
  const own=history.state?.buschUnraidDockerMenu===this._id;
  this._closing=new Promise(resolve=>{if(!own){this._finish();resolve();return;}let done=false;const finish=()=>{if(done)return;done=true;window.removeEventListener('popstate',finish);this._finish();resolve();};window.addEventListener('popstate',finish);setTimeout(finish,300);history.back();});
  return this._closing;
 }
 _finish(){if(this._done)return;this._done=true;window.removeEventListener('popstate',this._pop);this.remove();this._onClose?.();}
}
class BuschUnraidDockerCard extends BuschUnraidBaseCard {
 constructor(){super();this._config={...BUSCH_UNRAID_DOCKER_DEFAULTS};this._toggled=new Map();this._menuKey=null;this._eingeklappt=false;this.addEventListener('keydown',event=>this._shortcut(event));}
 /* R03: Shift+Plus klappt alle Stacks auf, Shift+Minus alle zu (nicht in Textfeldern). */
 _shortcut(event){if(!event.shiftKey||event.ctrlKey||event.metaKey||event.altKey||/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName||''))return;const open=['+','*'].includes(event.key)?true:['-','_'].includes(event.key)?false:null;if(open===null)return;const m=this._lastModel;if(!m)return;event.preventDefault();for(const tile of m.tiles)if(tile.type==='stack'&&tile.containers.length)this._toggled.set(tile.key,open);this._render();}
 get _kind(){return 'docker';}
 static getConfigElement(){return document.createElement('busch-unraid-docker-card-editor');}
 static getStubConfig(hass){if(!hass)return {type:'custom:busch-unraid-docker-card'};const core=ensureBuschCore(1);core.attach(hass);const server=buschUnraidServers(core)[0];return {type:'custom:busch-unraid-docker-card',...(server?{device_id:server.id}:{})};}
 setConfig(config){const next={...BUSCH_UNRAID_DOCKER_DEFAULTS,...buschUnraidConfig(config)};if(buschCoreKey(this._config)===buschCoreKey(next)&&this._renderSignature)return;if(next.device_id!==this._config.device_id||next.start_expanded!==this._config.start_expanded)this._toggled.clear();this._config=next;this._anzeige=unraidAnzeige(next,UNRAID_ANZEIGE.docker);try{this._eingeklappt=unraidSpeicher()?.getItem(this._schluessel())==='1';}catch{this._eingeklappt=false;}this._error=null;this._generation++;this._render();}
 // Einklappen der ganzen Karte wie BuschUnraidTile, gemerkt je Server und Titel (localStorage, Fehler still).
 _schluessel(){return 'unraid-cards:docker:'+(this._config.device_id||'')+':'+(this._config.title||'');}
 _umschalten(){this._eingeklappt=!this._eingeklappt;try{unraidSpeicher()?.setItem(this._schluessel(),this._eingeklappt?'1':'0');}catch{}this._focusAfter={key:'card',role:'toggle'};this._render();}
 disconnectedCallback(){super.disconnectedCallback();this._menu?._finish();}
 getCardSize(){if(this._eingeklappt)return 1+(this._anzeige?.kompakt?.length?1:0);const m=this._lastModel;return Math.max(2,1+Math.ceil(((m?.tiles.length)||1)/2));}
 getGridOptions(){return {columns:12,min_columns:3};}
 // #642: Kompaktwert „gestartet x/y“ aus demselben Modell wie der Untertitel.
 _kompakt(m){return m?.server&&!m.ambiguous?{summary:unraidKw(`${m.running}/${m.total}`)}:{};}
 _isOpen(key){return this._toggled.has(key)?this._toggled.get(key):!!this._config.start_expanded;}
 _toggle(key){this._toggled.set(key,!this._isOpen(key));this._focusAfter={key,role:'toggle'};this._render();}
 _menuItems(row,t){
  const items=[],busy=this._busy||row.status==='updating',online=!!row.switch&&buschUnraidAvailable(row.switch);
  if(row.type==='stack'&&row.containers.length){const open=this._isOpen(row.key);items.push({key:'toggle',label:open?t.collapse:t.expand,icon:open?'mdi:chevron-up':'mdi:chevron-down',run:()=>this._toggle(row.key)});}
  if(row.switch){
   const on=row.type==='stack'?['running','partial'].includes(row.status)||row.switch.state==='on':row.switch.state==='on'||['running','paused'].includes(row.status);
   if(!on||row.status==='partial')items.push({key:'start',label:t.start,icon:'mdi:play',disabled:busy||!online,run:()=>this._action('start',row)});
   if(on)items.push({key:'stop',label:t.stop,icon:'mdi:stop',danger:true,disabled:busy||!online,run:()=>this._action('stop',row)});
  }
  if(row.restart)items.push({key:'restart',label:t.restart,icon:'mdi:restart',disabled:busy||row.restart.state==='unavailable',run:()=>this._action('restart',row)});
  if(row.type==='stack'&&row.update_all&&(row.has_update||row.update_queue?.active))items.push({key:'update_all',label:t.update_all,icon:'mdi:package-up',disabled:this._busy||row.update_queue?.active||row.update_all.state==='unavailable',run:()=>this._action('update_all',row)});
  if(row.type==='container'&&row.update&&(row.update.state==='on'||row.status==='updating'))items.push({key:'update',label:t.update,icon:'mdi:package-up',run:()=>this._action('update',row)});
  if(row.switch)items.push({key:'details',label:t.details,icon:'mdi:information-outline',run:()=>this._action('details',row)});
  return items;
 }
 _openMenu(row,anchor){
  const t=buschTexte(TEXTE_BUSCH_UNRAID_DOCKER_CARD,this._hass).texte;
  this._menuKey=row.key;anchor.setAttribute('aria-expanded','true');
  this._menu=BuschUnraidDockerMenu.open({anchor,title:row.name,label:t.menu.replace('{name}',row.name),closeLabel:t.close,items:this._menuItems(row,t),onClose:()=>{this._menu=null;this._menuKey=null;const main=[...(this.shadowRoot?.querySelectorAll('.tile-main')||[])].find(n=>n.dataset.key===row.key);main?.setAttribute('aria-expanded','false');main?.focus({preventScroll:true});}});
 }
 _tile(row,t,stackText){
  const tile=buschUnraidNode('div',undefined,'tile '+row.type+(row.parent?' child':''));tile.dataset.key=row.key;
  const main=buschUnraidNode('button',undefined,'tile-main');main.type='button';main.dataset.key=row.key;main.dataset.focusKey='main';
  const status=buschUnraidDockerStatus(row,t,stackText,this._hass?.locale?.language),label=[row.name,row.parent_name?t.in_stack.replace('{name}',row.parent_name):(row.type==='stack'?t.stack:''),status.text].filter(Boolean).join(', ');
  main.setAttribute('aria-label',label);main.setAttribute('aria-haspopup','menu');main.setAttribute('aria-expanded',String(this._menuKey===row.key));main.title=row.name;
  main.appendChild(buschMedia({},row,row.type==='stack'?'mdi:docker':'mdi:cube-outline','tile-icon'));
  const text=buschUnraidNode('span',undefined,'tile-text'),name=buschUnraidNode('span',row.name,'tile-name');name.title=row.name;
  const line=buschUnraidNode('span',undefined,'tile-status sem-'+status.semantic),icon=BuschUI.ha.icon(status.icon);icon.setAttribute('aria-hidden','true');const statusText=buschUnraidNode('span',status.text,'tile-status-text');statusText.title=status.text;line.append(icon,statusText);
  text.append(name,line);main.appendChild(text);main.addEventListener('click',event=>{event.stopPropagation();this._openMenu(row,main);});tile.appendChild(main);
  if(row.type==='stack'&&row.containers.length){const open=this._isOpen(row.key),toggle=buschUnraidNode('button',undefined,'tile-toggle');toggle.type='button';toggle.dataset.key=row.key;toggle.dataset.focusKey='toggle';toggle.setAttribute('aria-expanded',String(open));const hint=(open?t.hide_containers:t.show_containers).replace('{name}',row.name);toggle.setAttribute('aria-label',hint);toggle.title=hint;toggle.appendChild(BuschUI.ha.icon('mdi:chevron-down'));toggle.addEventListener('click',event=>{event.stopPropagation();this._toggle(row.key);});tile.appendChild(toggle);}
  return tile;
 }
 _render(){
  if(!this.shadowRoot||!this._config)return;
  const active=this.shadowRoot.activeElement,focus=this._focusAfter||(active?.dataset?.key?{key:active.dataset.key,role:active.dataset.focusKey}:null);this._focusAfter=null;
  const words=buschTexte(TEXTE_BUSCH_UNRAID_DOCKER_CARD,this._hass),t=words.texte,stackText=buschTexte(BUSCH_UNRAID_TEXT,this._hass),m=buschUnraidDockerModel(this._core,this._config);this._lastModel=m;
  const kachel=buschTexte(UNRAID_TILE_TEXTE,this._hass),signature=JSON.stringify([this._config,m,[...this._toggled],this._menuKey,!!this._busy,this._error,t,this._eingeklappt,kachel]);if(signature===this._renderSignature)return;this._renderSignature=signature;
  const card=buschUnraidNode('ha-card'),style=buschUnraidNode('style',UNRAID_FAMILIE_STYLE+BUSCH_UNRAID_DOCKER_STYLE);if(this._busy)card.setAttribute('aria-busy','true');
  // Kopf-Icon bewusst ohne .tile-icon: diese Klasse tragen nur die Rasterkacheln (Renderskript prüft sie einheitlich).
  const header=buschUnraidNode('div',undefined,'header tile-head'),main=buschUnraidNode('div',undefined,'header-main tile-text'),titleNode=buschUnraidNode('h2',this._config.title||t.default_title,'tile-title');
  main.appendChild(titleNode);header.appendChild(buschMedia({},{},'mdi:docker','card-icon head-icon'));header.appendChild(main);
  const toggle=unraidEinklappKnopf({eingeklappt:this._eingeklappt,t:kachel,onClick:()=>this._umschalten()});toggle.dataset.key='card';header.appendChild(toggle);card.appendChild(header);
  const message=(parent,text)=>parent.appendChild(buschUnraidNode('p',text,'message'));
  const body=buschUnraidNode('div',undefined,'tile-body');
  // #643/7 [A-14]: Untertitel nur „x von y gestartet“, ohne angehängten Servernamen.
  if(m.server&&!m.ambiguous&&this._zeigt('summary'))main.appendChild(buschUnraidNode('p',t.running_total.replace('{running}',m.running).replace('{total}',m.total),'detail tile-sub'));
  if(this._eingeklappt){const zeile=m.server&&!m.ambiguous?unraidKompaktZeile(this._anzeige?.kompakt,this._kompakt(m),words):null;if(zeile)card.appendChild(zeile);}
  else if(!m.server)message(body,t.empty);
  else if(m.ambiguous)message(body,stackText.metadata);
  else if(!this._zeigt('stacks')&&!this._zeigt('containers')){/* [A-1] alles abgewählt: nur der Kopf */}
  else{
   const grid=buschUnraidNode('div',undefined,'grid'+(['1','2','3','4'].includes(String(this._config.columns))?' cols-'+this._config.columns:''));grid.setAttribute('role','list');
   const visible=row=>!this._config.hide_stopped||row.status!=='stopped';
   const add=row=>{const tile=this._tile(row,t,stackText);tile.setAttribute('role','listitem');grid.appendChild(tile);};
   // #642: Abschnitte stacks (Stack-Kacheln samt Kindern) und containers (eigenständige Container).
   const kandidaten=m.tiles.filter(row=>this._zeigt(row.type==='stack'?'stacks':'containers'));
   for(const row of kandidaten.filter(visible)){add(row);if(row.type==='stack'&&this._isOpen(row.key))for(const child of row.containers.filter(visible))add(child);}
   if(!m.tiles.length)message(grid,t.no_containers);else if(!grid.childNodes.length&&kandidaten.length)message(grid,t.all_hidden);
   if(grid.childNodes.length)body.appendChild(grid);
  }
  if(!this._eingeklappt)card.appendChild(body);
  if(this._error){const error=buschUnraidNode('p',this._error,'message error');error.setAttribute('role','alert');card.appendChild(error);}
  titleNode.title=titleNode.textContent;BuschUI.header({node:header,titleNode});this.shadowRoot.replaceChildren(style,card);
  if(focus){const target=[...this.shadowRoot.querySelectorAll('button')].find(n=>n.dataset.key===focus.key&&n.dataset.focusKey===focus.role);target?.focus({preventScroll:true});}
 }
}
class BuschUnraidDockerEditor extends BuschUnraidBaseEditor {get _kind(){return 'docker';}get _defaults(){return BUSCH_UNRAID_DOCKER_DEFAULTS;}}
if(!customElements.get?.('busch-unraid-docker-menu'))customElements.define('busch-unraid-docker-menu',BuschUnraidDockerMenu);
if(!customElements.get?.('busch-unraid-docker-card'))customElements.define('busch-unraid-docker-card',BuschUnraidDockerCard);
if(!customElements.get?.('busch-unraid-docker-card-editor'))customElements.define('busch-unraid-docker-card-editor',BuschUnraidDockerEditor);
if(!window.customCards.some(c=>c.type==='busch-unraid-docker-card'))window.customCards.push({type:'busch-unraid-docker-card',name:buschTexte(TEXTE_BUSCH_UNRAID_DOCKER_CARD).name,description:buschTexte(TEXTE_BUSCH_UNRAID_DOCKER_CARD).description,preview:true,documentationURL:'https://github.com/luukkii123/ha-unraid-cards'});


/* === Kachel-Basis === */
const UNRAID_TILE_TEXTE={de:{upgrade:'Zusatzdaten: Unraid SSH auf 0.9 oder neuer aktualisieren.',
  telemetry_unavailable:'Zusatzdaten teilweise oder nicht verfügbar. Integration und Quelle prüfen.',
  sent:'Anfrage gesendet; Verbindung/Serverzustand prüfen.',
  action_unconfirmed:'Anfrage nicht bestätigt; Verbindung/Serverzustand prüfen. Keine automatische Wiederholung.',
  actions:'Serveraktionen',
  more_actions:'Weitere Serveraktionen',
  model:'Modell',
  registration:'Registrierung',
  board_vendor:'Mainboard-Hersteller',
  board_name:'Mainboard',
  board_version:'Mainboard-Version',
  bios_vendor:'BIOS-Hersteller',
  bios_version:'BIOS-Version',
  bios_date:'BIOS-Datum',
  product_name:'Servermodell',
  cpu_model:'CPU-Modell',
  docker_folder:'Docker verwendet ein Verzeichnis; keine separate Image-Datei.',
  docker_unknown:'Docker-Speichermodus unbekannt. Integration und Quelle prüfen.',
  memory_parts:'RAM-Aufteilung',
  total_bytes:'Gesamt',
  available_bytes:'Verfügbar',
  free_bytes:'Frei',
  cache_bytes:'Cache',
  buffers_bytes:'Puffer',
  system_bytes:'System',
  memory_help:'System, Cache, Puffer und frei sind disjunkt; verfügbar ist eine zusätzliche Kennzahl.',
  boot:'Boot',
  log:'Log',
  docker_vdisk:'Docker-vdisk',
  used:'Belegt',
  free:'Frei',
  total:'Gesamt',
  power:'CPU-Leistung',
  packages:'CPU-Packages',
  source:'Quelle',
  core_details:'Details: CPU-Kerne',
  core:'Kern',
  driver:'Treiber',
  pool_state:'Poolzustand',
  filesystem:'Dateisystem',
  members:'Mitglieder',
  online:'Online',
  degraded:'Beeinträchtigt',
  faulted:'Fehlerhaft',
  unmounted:'Nicht eingehängt',
  unknown:'Unbekannt',
  smart:'SMART',
  passed:'Bestanden',
  warning:'Warnung',
  failed_smart:'Fehlgeschlagen',
  last_sample:'Letzter Stand',
  sampled:'Stand',
  security:'Sicherheit',
  exported:'Exportiert',
  streams:'Streams',
  streams_help:'Offene Pfade wie im Unraid-Dashboard',
  public:'Öffentlich',
  secure:'Geschützt',
  private:'Privat',
  yes:'Ja',
  no:'Nein',
  host_cpu:'Host-CPU',
  net_rx:'Netz empfangen',
  net_tx:'Netz senden',
  disk_read:'Datenträger lesen',
  disk_write:'Datenträger schreiben',
  paused:'Prüfung pausiert',
  other:'Andere Sync-Aktion aktiv',
  server_reboot:'Server neu starten',
  server_shutdown:'Server ausschalten',
  mover_start:'Mover starten',
  array_start:'Array starten',
  array_stop:'Array stoppen',
  spindown_all:'Alle Platten schlafen legen',
  parity_start:'Parität prüfen (ohne Korrektur)',
  parity_pause:'Paritätsprüfung pausieren',
  parity_resume:'Paritätsprüfung fortsetzen',
  parity_cancel:'Paritätsprüfung abbrechen',
  confirm_server_reboot:'„{server}“ neu starten? Der Server und seine Dienste sind vorübergehend nicht erreichbar.',
  confirm_server_shutdown:'„{server}“ ausschalten? Der Server und seine Dienste werden beendet.',
  confirm_mover_start:'Mover auf „{server}“ starten? Dateien werden gemäß der Share-Konfiguration verschoben.',
  confirm_array_start:'Array auf „{server}“ starten? Die konfigurierten Datenträger werden eingebunden.',
  confirm_array_stop:'Array auf „{server}“ stoppen? Freigaben und abhängige Dienste werden beendet.',
  confirm_spindown_all:'Alle Platten auf „{server}“ schlafen legen? Zugriffe können die Platten wieder aufwecken.',
  confirm_parity_start:'Parität auf „{server}“ ohne Korrektur prüfen? Datenträger werden gelesen; Fehler werden nicht korrigiert.',
  confirm_parity_pause:'Paritätsprüfung auf „{server}“ pausieren? Der aktuelle Prüfstand bleibt erhalten.',
  confirm_parity_resume:'Paritätsprüfung auf „{server}“ fortsetzen? Die Datenträger werden wieder gelesen.',
  confirm_parity_cancel:'Paritätsprüfung auf „{server}“ abbrechen? Die aktuelle Prüfung wird nicht abgeschlossen.',
  cancel:'Abbrechen',
  close:'Schließen',
  collapse:'Einklappen',
  expand:'Ausklappen',
  loading:'Wird geladen …',
  failed:'Aktion fehlgeschlagen. Verbindung zu Unraid prüfen und erneut versuchen.',
  no_server:'Kein Unraid-Server gefunden. Die Integration Unraid SSH einrichten.',
  choose_server:'Mehrere Unraid-Server gefunden. Im Editor einen wählen.',
  compact_label:'Kennzahlen',
  temp_high:'hoch',
  temp_critical:'kritisch',
  unavailable:'Nicht verfügbar'},
 en:{upgrade:'Additional data: update Unraid SSH to 0.9 or newer.',
  telemetry_unavailable:'Additional data partially or currently unavailable. Check the integration and source.',
  sent:'Request sent; check connection/server state.',
  action_unconfirmed:'Request not confirmed; check connection/server state. No automatic retry.',
  actions:'Server actions',
  more_actions:'More server actions',
  model:'Model',
  registration:'Registration',
  board_vendor:'Board vendor',
  board_name:'Motherboard',
  board_version:'Board version',
  bios_vendor:'BIOS vendor',
  bios_version:'BIOS version',
  bios_date:'BIOS date',
  product_name:'Server model',
  cpu_model:'CPU model',
  docker_folder:'Docker uses a directory; there is no separate image file.',
  docker_unknown:'Docker storage mode unknown. Check the integration and source.',
  memory_parts:'Memory breakdown',
  total_bytes:'Total',
  available_bytes:'Available',
  free_bytes:'Free',
  cache_bytes:'Cache',
  buffers_bytes:'Buffers',
  system_bytes:'System',
  memory_help:'System, cache, buffers and free are disjoint; available is an additional metric.',
  boot:'Boot',
  log:'Log',
  docker_vdisk:'Docker vdisk',
  used:'Used',
  free:'Free',
  total:'Total',
  power:'CPU power',
  packages:'CPU packages',
  source:'Source',
  core_details:'Details: CPU cores',
  core:'Core',
  driver:'Driver',
  pool_state:'Pool state',
  filesystem:'Filesystem',
  members:'Members',
  online:'Online',
  degraded:'Degraded',
  faulted:'Faulted',
  unmounted:'Unmounted',
  unknown:'Unknown',
  smart:'SMART',
  passed:'Passed',
  warning:'Warning',
  failed_smart:'Failed',
  last_sample:'Last cached sample',
  sampled:'Sample',
  security:'Security',
  exported:'Exported',
  streams:'Streams',
  streams_help:'Open paths as in the Unraid dashboard',
  public:'Public',
  secure:'Secure',
  private:'Private',
  yes:'Yes',
  no:'No',
  host_cpu:'Host CPU',
  net_rx:'Network received',
  net_tx:'Network sent',
  disk_read:'Disk read',
  disk_write:'Disk write',
  paused:'Check paused',
  other:'Other sync operation active',
  server_reboot:'Restart server',
  server_shutdown:'Shut down server',
  mover_start:'Start mover',
  array_start:'Start array',
  array_stop:'Stop array',
  spindown_all:'Spin down all disks',
  parity_start:'Check parity (without corrections)',
  parity_pause:'Pause parity check',
  parity_resume:'Resume parity check',
  parity_cancel:'Cancel parity check',
  confirm_server_reboot:'Restart “{server}”? The server and its services will be temporarily unavailable.',
  confirm_server_shutdown:'Shut down “{server}”? The server and its services will stop.',
  confirm_mover_start:'Start the mover on “{server}”? Files will be moved according to the share configuration.',
  confirm_array_start:'Start the array on “{server}”? The configured disks will be mounted.',
  confirm_array_stop:'Stop the array on “{server}”? Shares and dependent services will stop.',
  confirm_spindown_all:'Spin down all disks on “{server}”? Access may wake them again.',
  confirm_parity_start:'Check parity on “{server}” without corrections? Disks will be read; errors will not be corrected.',
  confirm_parity_pause:'Pause the parity check on “{server}”? Current progress will be retained.',
  confirm_parity_resume:'Resume the parity check on “{server}”? Disks will be read again.',
  confirm_parity_cancel:'Cancel the parity check on “{server}”? The current check will remain incomplete.',
  cancel:'Cancel',
  close:'Close',
  collapse:'Collapse',
  expand:'Expand',
  loading:'Loading …',
  failed:'Action failed. Check the connection to Unraid and try again.',
  no_server:'No Unraid server found. Set up the Unraid SSH integration.',
  choose_server:'Several Unraid servers found. Choose one in the editor.',
  compact_label:'Key figures',
  temp_high:'high',
  temp_critical:'critical',
  unavailable:'Unavailable'}};
// Gemeinsame Laufzeittexte aller Kacheln; je Kachel per Spread in ein eigenes TEXTE_-Literal übernommen.
// labels/helpers stehen wörtlich je Kachel (auch device_id/title), weil scripts/ui-regeln-pruefen.py nur Literale liest.
const UNRAID_SCHWELLEN={warnung:70,kritisch:90};
function unraidZahl(wert,einheit,locale,stellen=0){if(typeof wert!=='number'||!Number.isFinite(wert))return '–';const text=new Intl.NumberFormat(String(locale||'en').startsWith('de')?'de-DE':'en-US',{maximumFractionDigits:stellen,minimumFractionDigits:stellen}).format(wert);return einheit?text+' '+einheit:text;}
// Eintrag der Kompaktzeile: nicht verfügbare Werte (null, '–') werden null und fallen dort weg.
function unraidKw(wert,semantik,label){return wert===null||wert===undefined||wert===''||wert==='–'?null:{wert:String(wert),...(semantik?{semantik}:{}),...(label!==undefined?{label}:{})};}
function unraidStufe(p,s=UNRAID_SCHWELLEN){return typeof p!=='number'||!Number.isFinite(p)?'':p>=s.kritisch?'crit':p>=s.warnung?'warn':'';}
function unraidBalken(prozent,text,{warnung=70,kritisch=90,ohneText=false}={}){const bar=buschUnraidNode('div',undefined,('bar '+unraidStufe(prozent,{warnung,kritisch})).trim());bar.setAttribute('role','meter');bar.setAttribute('aria-valuemin','0');bar.setAttribute('aria-valuemax','100');const bekannt=typeof prozent==='number'&&Number.isFinite(prozent);if(bekannt)bar.setAttribute('aria-valuenow',String(Math.round(prozent)));const anzeige=bekannt?text:'–';bar.setAttribute('aria-valuetext',anzeige);const spur=buschUnraidNode('span',undefined,'bar-track'),fill=buschUnraidNode('span',undefined,'bar-fill');fill.style.width=(bekannt?Math.max(0,Math.min(100,prozent)):0)+'%';spur.appendChild(fill);bar.appendChild(spur);if(!ohneText)bar.appendChild(buschUnraidNode('span',anzeige,'bar-text'));return bar;}
function unraidRing(prozent,label){const bekannt=typeof prozent==='number'&&Number.isFinite(prozent);const box=buschUnraidNode('figure',undefined,('ring '+unraidStufe(prozent)).trim());const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 36 36');svg.setAttribute('aria-hidden','true');for(const [cls,len] of [['ring-bg',100],['ring-fg',bekannt?Math.max(0,Math.min(100,prozent)):0]]){const c=document.createElementNS(ns,'circle');c.setAttribute('class',cls);c.setAttribute('cx','18');c.setAttribute('cy','18');c.setAttribute('r','15.915');c.setAttribute('pathLength','100');c.setAttribute('stroke-dasharray',len+' 100');svg.appendChild(c);}box.appendChild(svg);box.appendChild(buschUnraidNode('span',bekannt?Math.round(prozent)+' %':'–','ring-value'));box.appendChild(buschUnraidNode('figcaption',label,'ring-label'));return box;}
function unraidTabelle(spalten,zeilen,{leer}={}){if(!zeilen||!zeilen.length)return buschUnraidNode('p',leer,'message');const table=document.createElement('table');table.className='table';const head=document.createElement('tr');for(const s of spalten){const th=document.createElement('th');th.setAttribute('scope','col');th.textContent=s.label;head.appendChild(th);}if(spalten.some(s=>s.label)){const thead=document.createElement('thead');thead.appendChild(head);table.appendChild(thead);}const body=document.createElement('tbody');for(const z of zeilen){const tr=document.createElement('tr');for(const s of spalten){const td=document.createElement('td');td.setAttribute('data-label',s.label);const v=z[s.key];if(v&&typeof v==='object'&&v.nodeType)td.appendChild(v);else td.textContent=v??'–';tr.appendChild(td);}body.appendChild(tr);}table.appendChild(body);return table;}
function unraidRaster(eintraege){const grid=buschUnraidNode('div',undefined,'grid');for(const e of eintraege){const cell=buschUnraidNode('div',undefined,'cell');const name=buschUnraidNode('span',e.name,'cell-name');if(e.name!=null&&e.name!=='')name.title=String(e.name);cell.appendChild(name);if(e.wert&&typeof e.wert==='object'&&e.wert.nodeType){const wert=buschUnraidNode('span',undefined,'cell-value');wert.appendChild(e.wert);cell.appendChild(wert);}else cell.appendChild(buschUnraidNode('span',e.wert,'cell-value'));grid.appendChild(cell);}return grid;}
/* [A-11] unraid_ssh liefert für cpu_temp keine Grenzwert-Attribute (collect.py liest nur temp*_input, sensor.py ohne
 * extra_state_attributes). Daher feste Vorgabe: ab 80 °C Warnung, ab 90 °C kritisch (README). Bedeutung nie nur per Farbe (R16):
 * ab der Warnschwelle Punkt plus Text „hoch“/„kritisch“. Gilt für CPU- und Systemkarte [A-12] und die Kompaktzeile. */
const UNRAID_CPU_TEMP_SCHWELLEN={warnung:80,kritisch:90};
function unraidCpuTempStufe(c){return typeof c!=='number'||!Number.isFinite(c)?null:c>=UNRAID_CPU_TEMP_SCHWELLEN.kritisch?'error':c>=UNRAID_CPU_TEMP_SCHWELLEN.warnung?'warning':null;}
function unraidCpuTempText(c,lang,t,stellen=0){const stufe=unraidCpuTempStufe(c),text=unraidZahl(c,'°C',lang,stellen);return stufe?`${text} · ${stufe==='error'?t.temp_critical:t.temp_high}`:text;}
function unraidCpuTemp(c,lang,t,stellen=0){const stufe=unraidCpuTempStufe(c),text=unraidCpuTempText(c,lang,t,stellen);return stufe?unraidPunkt(stufe,text):text;}
function unraidPunkt(semantik,text){const n=buschUnraidNode('span',undefined,'dot-row');const dot=buschUnraidNode('span',undefined,'dot sem-'+semantik);dot.setAttribute('aria-hidden','true');n.appendChild(dot);n.appendChild(buschUnraidNode('span',text,'dot-text'));return n;}
// Servermodell für die Kacheln. unraid_ssh legt jede unique_id als
// `<config_entry_id>_<suffix>` an; der Kern liefert in getDeviceEntities auch
// deaktivierte Entitäten (registry.disabled_by, ohne Zustand) — die zählen nicht.
// Ohne geladenes Entitätsregister (nur hass.entities: keine unique_id und kein
// config_entry_id) gibt es keinen Entry und damit keine Treffer statt Fremdtreffer.
function unraidNum(e){if(!e||e.state==null||['unavailable','unknown',''].includes(String(e.state).trim()))return null;const n=Number(e.state);return Number.isFinite(n)?n:null;}
function unraidSuffix(e){const uid=e?.registry?.unique_id,entry=e?.config_entry_id;return typeof uid==='string'&&typeof entry==='string'&&entry&&uid.startsWith(entry+'_')?uid.slice(entry.length+1)||null:null;}
// Rohname eines Kindgeräts (disk1, appdata, Windows 11): Der Gerätename ist übersetzt und trägt den Eintragstitel
// („Tower Festplatte disk1“), die unique_ids der Entitäten tragen dagegen den Rohnamen (<entry>_disk_status_disk1).
// Präfixe wie in unraid_ssh (sensor/binary_sensor/switch/button, prune.py); das längste passende zuerst, damit
// vm_ram_used_X nicht als vm_ (VM-Schalter) endet. Ohne passende Entität: Gerätename.
const UNRAID_ROH_PRAEFIXE=['disk_smart_','disk_status_','disk_temp_','disk_usage_','disk_total_','disk_used_','disk_free_','disk_spundown_','share_used_','share_free_','vm_state_','vm_cpu_','vm_ram_allocated_','vm_ram_max_','vm_ram_host_rss_','vm_ram_used_','restart_vm_','force_stop_vm_','vm_'].sort((a,b)=>b.length-a.length);
function unraidRohname(d,entitaeten){let best=null,laenge=0;
 for(const e of entitaeten){const s=unraidSuffix(e);if(!s)continue;const p=UNRAID_ROH_PRAEFIXE.find(x=>s.startsWith(x)&&s.length>x.length);if(p&&p.length>laenge){best=s.slice(p.length);laenge=p.length;}}
 return best??String(d?.name??d?.id??'');}
function unraidServer(core,config){
 config=config||{};
 const server=buschUnraidServers(core),gewaehlt=config.device_id?server.find(d=>d.id===config.device_id):server.length===1?server[0]:null;
 if(!gewaehlt)return {server:null,fehler:server.length>1&&!config.device_id?'choose_server':'no_server'};
 const eigene=core.getDeviceEntities(gewaehlt.id).filter(e=>e&&e.platform==='unraid_ssh'),entry=eigene.find(e=>e.config_entry_id)?.config_entry_id;
 const index=liste=>entry?new Map(liste.filter(e=>e&&e.platform==='unraid_ssh'&&e.config_entry_id===entry&&!e.registry?.disabled_by).map(e=>[unraidSuffix(e),e]).filter(([s])=>s)):new Map();
 // #641: Kindgeräte über den config_entry_id-Index statt über alle Geräte; Container/Stacks fragen die Kacheln nie ab (nur Platten, VMs, Shares).
 const kinderIds=entry?core.index?.deviceIndices?.config_entry_id?.get(entry):null;
 const kinder=entry?(kinderIds?[...kinderIds].map(id=>core.devices.get(id)).filter(Boolean):[...core.devices.values()]).filter(d=>d.id!==gewaehlt.id&&d.model!=='Docker container'&&d.model!=='Compose stack'&&core.getDeviceEntities(d.id).some(e=>e?.platform==='unraid_ssh'&&e.config_entry_id===entry)):[];
 const haupt=index(eigene);
 // R18: Hauptsensoren alle nicht verfügbar → Server nicht verfügbar (Kopf bleibt, Inhalt „Nicht verfügbar“).
 const hauptwerte=['cpu_percent','array_state'].map(x=>haupt.get(x)).filter(Boolean),verfuegbar=!hauptwerte.length||hauptwerte.some(buschUnraidAvailable);
 // Ohne Eintrag (Entitätsregister noch nicht geladen: hass.entities hat weder config_entry_id noch unique_id) im Zweifel laden,
 // statt falsche Leerzustände zu zeigen; nur ein gemeldeter Registerfehler beendet das Warten.
 const laedt=!entry&&!core.lastErrors?.has?.('entity');
 return {server:gewaehlt,entry,verfuegbar,laedt,wert:s=>haupt.get(s)||null,alle:p=>[...haupt].filter(([s])=>s.startsWith(p)).map(([suffix,entity])=>({suffix,entity})),
  geraete:modell=>kinder.filter(d=>d.model===modell).map(d=>({...d,roh:unraidRohname(d,core.getDeviceEntities(d.id).filter(e=>e?.platform==='unraid_ssh'&&e.config_entry_id===entry))})).sort((a,b)=>a.roh.localeCompare(b.roh,undefined,{numeric:true})),
  von:(d,s)=>d?index(core.getDeviceEntities(d.id)).get(s)||null:null,ids:[gewaehlt.id,...kinder.map(d=>d.id)]};
}
// Geräte, deren Stream-Updates eine Kachel neu rendern sollen (Server und Kindgeräte desselben Eintrags).
// Gemeinsamer Vorspann der Kachelmodelle: Fehler, Ladezustand oder Nicht verfügbar; null = Daten zeigen.
function unraidZustand(s){if(!s.server)return {fehler:s.fehler};if(s.laedt)return {laedt:true};if(!s.verfuegbar)return {fehler:'unavailable',name:s.server.name_by_user||s.server.name};return null;}
/* Dashboard telemetry (schema 1): entry-scoped data and presentation only. */
function unraidDashboard(server,key){
 const entity=server.wert('dashboard_'+key);
 if(!entity)return {zustand:'legacy',daten:{}};
 const a=entity.attributes||{};
 if(a.schema_version!==1)return {zustand:'legacy',daten:{}};
 if(!['ok','partial'].includes(entity.state))return {zustand:'unavailable',daten:{}};
 return {zustand:entity.state,daten:a};
}
function unraidZusatzHinweis(body,quellen,t){
 if(quellen.some(q=>q?.zustand==='legacy'))body.appendChild(buschUnraidNode('p',t.upgrade,'message'));
 else if(quellen.some(q=>q?.zustand==='partial'||q?.zustand==='unavailable'))body.appendChild(buschUnraidNode('p',t.telemetry_unavailable,'message'));
}
function unraidRate(value,lang){return typeof value==='number'&&Number.isFinite(value)&&value>=0?unraidBytes(value,lang)+'/s':'–';}
function unraidListe(daten,key){return Array.isArray(daten?.[key])?daten[key]:[];}
function unraidSmartText(e,t){
 const status=e?.state,a=e?.attributes||{},text=status==='failed'?t.failed_smart:t[status]||t.unknown;
 const details=Array.isArray(a.details)?a.details.map(x=>typeof x==='string'?x:typeof x?.field==='string'&&typeof x.value==='number'?`${x.field}: ${x.value}`:'').filter(Boolean).join('; '):'';
 // SMART cache mtime is an epoch timestamp. Dashboard sampled_at is a separate per-source map.
 const date=typeof a.sampled_at==='number'?new Date(a.sampled_at*1000):typeof a.sampled_at==='string'?new Date(a.sampled_at):null;
 const sampled=date&&Number.isFinite(date.getTime())?date.toISOString():null;
 return [text,a.stale?t.last_sample:sampled?t.sampled:null,sampled,a.source?`${t.source}: ${a.source}`:null,details].filter(Boolean).join(' · ');
}
const UNRAID_SERVER_AKTIONEN={server_reboot:'mdi:restart',server_shutdown:'mdi:power',mover_start:'mdi:folder-move-outline',array_start:'mdi:play',array_stop:'mdi:stop',spindown_all:'mdi:power-sleep',parity_start:'mdi:shield-search',parity_pause:'mdi:pause',parity_resume:'mdi:play',parity_cancel:'mdi:close'};
function unraidServerButtons(server,keys){return keys.map(key=>{const e=server.wert(key),button=e?.domain==='button'&&e.entity_id?.startsWith('button.');return {key,id:button?e.entity_id:null,verfuegbar:!!(button&&!e.registry?.disabled_by&&e.state!=null&&e.state!=='unavailable')};});}
function unraidServerAktionen(karte,modell,t){return (modell.buttons||[]).map(b=>({key:b.key,label:t[b.key],icon:UNRAID_SERVER_AKTIONEN[b.key],gefahr:true,deaktiviert:!b.verfuegbar,bestaetigen:t['confirm_'+b.key].replace('{server}',modell.name),fehler:t.action_unconfirmed,ausfuehren:async anfrage=>{
 // Resolve again after confirmation. Changing the selected server while the dialog is open cannot send a request to a new target.
 const aktuell=unraidServer(karte._core,karte._config),ziel=aktuell.wert?.(b.key);
 if(!aktuell.server||aktuell.server.id!==modell.serverId||ziel?.entity_id!==b.id||ziel?.domain!=='button'||ziel.registry?.disabled_by||ziel.state==null||ziel.state==='unavailable')throw new Error('Unavailable action');
 await karte._hass.callService('button','press',{entity_id:b.id});if(anfrage.generation===karte._actionGeneration&&unraidServer(karte._core,karte._config).server?.id===anfrage.serverId)karte._notice=t.sent;
}}));}
function unraidServerIds(core,config){try{const s=unraidServer(core,config);return s.server?s.ids:[];}catch{return [];}}
// watchDevice wie BuschUnraidBaseCard: Rückruf rendert, die Render-Signatur verwirft Unverändertes. Leere Liste = abmelden.
function unraidBeobachten(karte,ids){const key=ids.join('\n');if(karte._beobachtKey===key)return;for(const ab of karte._beobachtAb||[])ab?.();karte._beobachtAb=[];karte._beobachtKey=key;const core=karte._core;if(!ids.length||typeof core?.watchDevice!=='function')return;for(const id of ids)karte._beobachtAb.push(core.watchDevice(id,()=>karte._render()));}
function unraidSpeicher(){try{return window.localStorage||null;}catch{return null;}}
const UNRAID_TILE_STYLE=BUSCH_UNRAID_STYLE+`
.tile-head{display:grid;grid-template-columns:auto minmax(0,1fr) auto;grid-template-areas:"icon text toggle" "actions actions actions";align-items:start;gap:var(--ha-space-2,8px) var(--ha-space-3,12px);min-width:0}
.tile-head>.tile-icon,.tile-head>.card-icon{grid-area:icon}.tile-head>.tile-text{grid-area:text;align-self:center}.tile-head>.collapse-toggle{grid-area:toggle}.tile-head>.tile-actions,.tile-head>.actions{grid-area:actions;justify-content:flex-start}
.collapse-toggle{display:inline-grid;place-items:center;width:44px;height:44px;min-width:44px;min-height:44px;padding:0;border:0;border-radius:50%;background:transparent;color:var(--secondary-text-color);--mdc-icon-size:20px;cursor:pointer}
.collapse-toggle:hover{background:color-mix(in srgb,var(--secondary-text-color) 12%,transparent)}.collapse-toggle:focus-visible{outline:2px solid var(--primary-color);outline-offset:2px}
.tile-icon{--mdc-icon-size:40px;color:var(--primary-text-color);flex:0 0 auto}
.tile-title{margin:0;font-size:var(--ha-font-size-l,16px);font-weight:var(--ha-font-weight-bold,600);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.tile-sub{margin:2px 0 0;color:var(--secondary-text-color);font-size:var(--ha-font-size-s,13px);overflow-wrap:anywhere}
.tile-text{flex:1 1 auto;min-width:0}
.tile-actions{display:flex;flex-wrap:wrap;justify-content:flex-start;gap:4px;min-width:0}.tile-actions button{flex:0 1 auto}
.tile-actions button.with-text{display:inline-flex;align-items:center;gap:var(--ha-space-2,8px)}.action-text{overflow-wrap:anywhere;min-width:0}
.tile-actions button{min-width:44px;min-height:44px}.tile-actions button[aria-disabled=true]{cursor:default;opacity:.5}
/* Wert neben der Spur statt auf der Füllung (Kontrast: Text auf Kartenhintergrund, nicht auf Grau/Orange/Rot). */
.bar{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:var(--ha-space-2,8px);min-width:0}
.bar-track{position:relative;display:block;height:8px;border-radius:4px;background:var(--divider-color);overflow:hidden;min-width:0}
.bar-fill{position:absolute;inset:0 auto 0 0;background:var(--secondary-text-color)}
.bar.warn .bar-fill{background:var(--warning-color)}.bar.crit .bar-fill{background:var(--error-color)}
.bar-text{font-size:12px;color:var(--primary-text-color);overflow-wrap:anywhere;min-width:0;text-align:end;font-variant-numeric:tabular-nums}
.ring{margin:0;display:grid;justify-items:center;align-items:center;gap:4px;min-width:0}.ring svg{width:72px;height:72px;transform:rotate(-90deg)}.ring svg,.ring-value{grid-area:1/1}
.ring circle{fill:none;stroke-width:4}.ring-bg{stroke:var(--divider-color)}.ring-fg{stroke:var(--secondary-text-color)}
.ring.warn .ring-fg{stroke:var(--warning-color)}.ring.crit .ring-fg{stroke:var(--error-color)}
.ring-value{font-weight:600;overflow-wrap:anywhere;min-width:0}.ring-label{grid-area:2/1;font-size:12px;color:var(--secondary-text-color);overflow-wrap:anywhere;text-align:center}
.table{width:100%;border-collapse:collapse;font-size:var(--ha-font-size-s,13px)}
.table th{text-align:left;color:var(--secondary-text-color);font-weight:500;padding:4px;overflow-wrap:anywhere}.table td{padding:4px;overflow-wrap:anywhere}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px}
.cell{display:grid;min-width:0}.cell-name{font-size:12px;color:var(--secondary-text-color);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}.cell-value{overflow-wrap:anywhere}
.dot-row{display:inline-flex;align-items:center;gap:6px;min-width:0}.dot-text{overflow-wrap:anywhere;min-width:0}.dot{width:10px;height:10px;border-radius:50%;background:var(--secondary-text-color)}
.dot.sem-ok{background:var(--success-color)}.dot.sem-warning{background:var(--warning-color)}.dot.sem-error{background:var(--error-color)}
/* #643/4 GPU: Wertegitter, Werte bündig rechts; Divs statt Tabelle, daher kein Stapeln unter 420 px. */
.gpu-values{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:var(--ha-space-1,4px) var(--ha-space-3,12px);width:100%}.gpu-row{display:contents}
.gpu-label{color:var(--secondary-text-color);overflow-wrap:anywhere;min-width:0}.gpu-track{min-width:0}.gpu-value{text-align:end;font-variant-numeric:tabular-nums;overflow-wrap:anywhere;min-width:0}
/* #642 Kompaktzeile: umbrechende Inline-Liste „Label Wert · Label Wert“; Trenner nur optisch (Alternativtext leer). */
.compact-line{display:flex;flex-wrap:wrap;align-items:center;gap:var(--ha-space-1,4px) var(--ha-space-2,8px);margin-top:var(--ha-space-2,8px);font-size:var(--ha-font-size-s,12px);overflow-wrap:anywhere;min-width:0}
.compact-item{display:inline-flex;align-items:center;gap:var(--ha-space-1,4px);min-width:0;overflow-wrap:anywhere}.compact-item+.compact-item::before{content:'·'/'';color:var(--secondary-text-color);margin-inline-end:var(--ha-space-1,4px)}
.compact-label{color:var(--secondary-text-color);overflow-wrap:anywhere;min-width:0}.compact-value{color:var(--primary-text-color);font-variant-numeric:tabular-nums;overflow-wrap:anywhere;min-width:0}.compact-item .dot{width:8px;height:8px;flex:none}
@container (max-width: 420px){.table thead{display:none}.table tr{display:grid;padding:6px 0;border-bottom:1px solid var(--divider-color)}.table td{display:flex;gap:8px}.table td::before{content:attr(data-label);color:var(--secondary-text-color);min-width:40%}.table td>.bar{flex:1 1 auto}.table td[data-label=""]::before{display:none}}
@media (prefers-reduced-motion: reduce){*{transition:none!important;animation:none!important}}
.clock{font-size:40px;line-height:1.1;margin:8px 0 2px}
.rings{display:flex;flex-wrap:wrap;gap:16px}.history{margin-top:8px;height:72px}.line{width:100%;height:72px}.line path{fill:none;stroke:var(--warning-color);stroke-width:1.2;vector-effect:non-scaling-stroke}.core-details summary{cursor:pointer;min-height:44px;display:flex;align-items:center;overflow-wrap:anywhere;list-style:none;justify-content:space-between;gap:var(--ha-space-2,8px)}.core-details summary::-webkit-details-marker{display:none}.core-details .summary-text{min-width:0;overflow-wrap:anywhere}.core-details .chevron{flex:none;color:var(--secondary-text-color);transition:transform .2s ease}.core-details[open] .chevron{transform:rotate(180deg)}.core-details summary:focus-visible{outline:2px solid var(--primary-color)}.section{margin:12px 0 6px;font-size:var(--ha-font-size-m,14px);color:var(--secondary-text-color)}`;
// Stack-, Container- und Docker-Karte: Kachelstil, aber der Kopf bleibt das Raster der Familie (Badge, Aktionszeile, schmale Ansicht).
const UNRAID_FAMILIE_STYLE=UNRAID_TILE_STYLE+`
ha-card:not(.tile)>.header.tile-head{display:grid;align-items:center}
.header>.card-icon.tile-icon,.header>.card-icon.head-icon{background:none;color:var(--primary-text-color)}
.header-main.tile-text{display:grid;gap:var(--ha-space-1,4px)}.header-main .tile-sub{margin:0}
/* #643/6: Badge neben dem Titel, umbrechend nur bei Platzmangel (R06); Aktionen bilden die zweite Kopfzeile. */
.title-row{display:flex;flex-wrap:wrap;align-items:center;gap:var(--ha-space-1,4px) var(--ha-space-2,8px);min-width:0}.title-row>.tile-title{flex:0 1 auto;min-width:0}.title-row>.status-badge{flex:none;justify-self:auto}`;
class BuschUnraidTile extends HTMLElement {
 constructor(){super();this.attachShadow({mode:'open'});this._config={};this._eingeklappt=false;this._busy=false;this._error=null;this._notice=null;this._actionGeneration=0;}
 static get kachel(){return 'tile';}
 get _texte(){return UNRAID_TILE_TEXTE;}
 get _vorgaben(){return {device_id:'',title:''};}
 setConfig(config){if((config?.device_id||'')!==(this._config.device_id||'')){this._notice=null;this._error=null;}this._config={...this._vorgaben,...buschUnraidConfig(config||{})};this._anzeige=unraidAnzeige(this._config,UNRAID_ANZEIGE[this.constructor.kachel]);try{this._eingeklappt=unraidSpeicher()?.getItem(this._schluessel())==='1';}catch{this._eingeklappt=false;}this._render();}
 // #642: Abschnitte aus `_anzeige` (nur in setConfig berechnet, #641). [A-1] Inhaltshinweise nur, wenn etwas sichtbar ist.
 _zeigt(id){return unraidZeigt(this,id);}
 _inhaltSichtbar(){return !!this._anzeige?.sichtbar?.size;}
 _schluessel(){return 'unraid-cards:'+this.constructor.kachel+':'+(this._config.device_id||'')+':'+(this._config.title||'');}
 _umschalten(){this._eingeklappt=!this._eingeklappt;try{unraidSpeicher()?.setItem(this._schluessel(),this._eingeklappt?'1':'0');}catch{}this._render();}
 set hass(hass){const vorher=this._hass;this._hass=hass;if(this.isConnected)this._verbinden();this._core?.attach(hass);unraidHassRender(this,vorher,hass);}
 get hass(){return this._hass;}
 connectedCallback(){this._verbinden();this._render();}
 disconnectedCallback(){this._release?.();this._unwatch?.();this._release=this._unwatch=null;unraidBeobachten(this,[]);this._menu?._finish();}
 _verbinden(){if(!this._hass||this._release)return;this._core=ensureBuschCore(1);this._release=this._core.retain(this._hass);this._unwatch=this._core.watch(()=>this._render());}
 // Eingeklappt: Kopf, mit Kompaktzeile eine Zeile mehr; vor setConfig (Kartenwähler) ohne _anzeige sicher.
 getCardSize(){return this._eingeklappt?1+(this._anzeige?.kompakt?.length?1:0):3;}
 getGridOptions(){return {columns:12,min_columns:6};}
 _modell(){return {};}
 _kopf(){return {icon:'mdi:server',titel:''};}
 _aktionen(){return [];}
 _inhalt(){}
 // #642: Werte der Kompaktzeile {id:{wert,semantik?,label?}} – nur aus dem fertigen Modell, keine Abos/Abfragen.
 _kompakt(){return {};}
 // Zusätzlicher Signaturteil (z. B. die Minute der Uhr); null = keiner.
 _signaturZusatz(){return null;}
 _render(){
  if(!this.shadowRoot)return;const t=buschTexte(this._texte,this._hass),m=this._core&&this._hass?this._modell(this._core,this._config):{laedt:true};
  // Track resolved auto-selection as well as explicit changes, including A → B → A.
  const context=JSON.stringify([this._config.device_id||'',this._core?.devices?unraidServer(this._core,this._config).server?.id:null]);
  if(context!==this._actionContext){this._actionContext=context;this._actionGeneration++;this._error=null;this._notice=null;}
  if(this.isConnected&&this._core&&this._hass)unraidBeobachten(this,unraidServerIds(this._core,this._config));
  // Render-Signatur wie BuschUnraidBaseCard: nur bei geänderter Ansicht neu aufbauen (set hass kommt bei jeder Zustandsänderung in HA).
  const signatur=JSON.stringify([this._config,m,this._eingeklappt,this._menuOffen||null,!!this._busy,this._error,this._notice,this._hass?.locale?.language,this._hass?.config?.time_zone,this._signaturZusatz()]);if(signatur===this._signatur)return;this._signatur=signatur;
  const style=document.createElement('style');style.textContent=UNRAID_TILE_STYLE;const card=document.createElement('ha-card');card.className='tile';
  const k=this._kopf(m,t)||{},head=buschUnraidNode('div',undefined,'tile-head'),icon=BuschUI.ha.icon(k.icon||'mdi:server'),text=buschUnraidNode('div',undefined,'tile-text');icon.className='tile-icon';icon.setAttribute('aria-hidden','true');
  const titel=buschUnraidNode('h2',this._config.title||k.titel||'','tile-title');titel.title=titel.textContent;text.appendChild(titel);if(k.untertitel)text.appendChild(buschUnraidNode('p',k.untertitel,'tile-sub'));head.appendChild(icon);head.appendChild(text);
  // Während `_busy` sperrt `aria-disabled` statt `disabled`: der fokussierte Knopf bleibt fokussierbar, der Fokus überlebt die Renders; Klicks verwirft `_ausfuehren`.
  const actions=buschUnraidNode('div',undefined,'tile-actions');
  // a.text: sichtbare Beschriftung neben dem Icon; a.menu: Knopf öffnet das flüchtige Menü (BuschUnraidDockerMenu, R08).
  for(const a of (m.laedt||m.fehler?[]:this._aktionen(m,t)||[])){const b=BuschUI.action({label:a.label,icon:a.icon,onClick:()=>a.menu?this._menuOeffnen(a,t):this._ausfuehren(a,t),disabled:!!a.deaktiviert,variant:a.gefahr?'danger':'secondary'});if(a.text){b.appendChild(buschUnraidNode('span',a.text,'action-text'));b.className+=' with-text';}if(a.menu){b.setAttribute('aria-haspopup','menu');b.setAttribute('aria-expanded',String(this._menuOffen===a.key));}if(this._busy&&!a.deaktiviert)b.setAttribute('aria-disabled','true');b.dataset.focusKey=a.key;actions.appendChild(b);}
  head.appendChild(unraidEinklappKnopf({eingeklappt:this._eingeklappt,t,onClick:()=>this._umschalten()}));if(actions.childNodes.length)head.appendChild(actions);card.appendChild(head);
  // #642: eingeklappt nur Kopf und (gewählt, nicht beim Laden/Fehler) die Kompaktzeile aus demselben Modell.
  if(this._eingeklappt){const zeile=m.laedt||m.fehler?null:unraidKompaktZeile(this._anzeige?.kompakt,this._kompakt(m,t),t);if(zeile)card.appendChild(zeile);}
  else{const body=buschUnraidNode('div',undefined,'tile-body');if(m.laedt)body.appendChild(buschUnraidNode('p',t.loading,'message'));else if(m.fehler)body.appendChild(buschUnraidNode('p',t[m.fehler]||m.fehler,'message'));else this._inhalt(body,m,t);card.appendChild(body);}
  if(this._notice){const n=buschUnraidNode('p',this._notice,'message');n.setAttribute('role','status');card.appendChild(n);}
  if(this._error){const e=buschUnraidNode('p',this._error,'message error');e.setAttribute('role','alert');card.appendChild(e);}
  const fokus=this.shadowRoot.activeElement?.dataset?.focusKey;this.shadowRoot.replaceChildren(style,card);if(fokus)this.shadowRoot.querySelector(`[data-focus-key="${fokus}"]`)?.focus({preventScroll:true});
 }
 // Ruling R2: `_busy` wird synchron VOR dem ersten `await` gesetzt (Doppelklick-Schutz) und bei abgelehnter Bestätigung zurückgenommen.
 async _ausfuehren(a,t){
  if(this._busy||a.deaktiviert)return;this._busy=true;this._error=null;this._notice=null;
  const fokus=this.shadowRoot.activeElement?.dataset?.focusKey,device=this._config.device_id,serverId=this._core?.devices?unraidServer(this._core,this._config).server?.id:null;
  // The modal may outlive a telemetry render; return focus to the current copy of its opener.
  const zurueck=()=>{if(fokus&&device===this._config.device_id)this.shadowRoot.querySelector(`[data-focus-key="${fokus}"]`)?.focus({preventScroll:true});};
  if(a.bestaetigen){let ok=false;try{ok=await this._bestaetigen(a.bestaetigen,a.label,a.gefahr);}catch{ok=false;}if(!ok){this._busy=false;this._render();zurueck();return;}}
  this._render();zurueck();
  // Bind both feedback paths to dispatch time, retaining the original confirmation target.
  const anfrage=Object.freeze({generation:this._actionGeneration,serverId});
  try{await a.ausfuehren(anfrage);}catch{if(anfrage.generation===this._actionGeneration&&(this._core?.devices?unraidServer(this._core,this._config).server?.id:null)===anfrage.serverId)this._error=a.fehler||t.failed;}finally{this._busy=false;this._render();}
 }
 _bestaetigen(text,aktion,gefahr){return unraidBestaetigen(aktion,text,aktion,gefahr);}
 // ⋮-Menü (#643/3): offen-Zustand rendert sofort (aria-expanded, Signatur); jeder Eintrag läuft über _ausfuehren, also mit
 // Bestätigung. R11: bei _busy oder nicht verfügbarem Knopf gesperrt. Schließen gibt den Fokus an ⋮ zurück.
 _menuOeffnen(a,t){this._menu?._finish();this._menuOffen=a.key;this._render();const anker=this.shadowRoot.querySelector(`[data-focus-key="${a.key}"]`);
  this._menu=BuschUnraidDockerMenu.open({anchor:anker,title:a.titel||this._config.title||a.label,label:t.actions,closeLabel:t.close,items:a.menu.map(x=>({key:x.key,label:x.label,icon:x.icon,danger:!!x.gefahr,disabled:!!this._busy||!!x.deaktiviert,run:()=>this._ausfuehren(x,t)})),
   onClose:()=>{this._menu=null;this._menuOffen=null;if(!this.shadowRoot)return;this._render();this.shadowRoot.querySelector(`[data-focus-key="${a.key}"]`)?.focus({preventScroll:true});}});}
}
const UNRAID_CONFIRM_STYLE=`:host{position:fixed;inset:0;z-index:10000;display:grid;place-items:center}
.scrim{position:absolute;inset:0;background:var(--mdc-dialog-scrim-color,rgba(0,0,0,.32))}
.dialog{position:relative;width:min(320px,calc(100vw - 32px));background:var(--card-background-color,#fff);color:var(--primary-text-color);border-radius:var(--ha-card-border-radius,12px);padding:24px;box-shadow:var(--ha-card-box-shadow,0 8px 24px rgba(0,0,0,.3))}
h2{margin:0 0 12px;font-size:var(--ha-font-size-l,18px);overflow-wrap:anywhere}p{margin:0 0 20px;overflow-wrap:anywhere}
.dialog-head{display:flex;align-items:flex-start;gap:12px;margin-bottom:12px}.dialog-head h2{flex:1;min-width:0;align-self:center;margin:0}.close{display:flex;align-items:center;justify-content:center;flex:0 0 44px;width:44px;height:44px;padding:0;border:0}
.buttons{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}.buttons button{flex:0 0 auto;max-width:100%;box-sizing:border-box;overflow-wrap:anywhere;padding:8px 16px}button{min-height:44px;min-width:44px;padding:0 16px;border-radius:8px;border:1px solid var(--divider-color);background:transparent;color:var(--primary-color);font:inherit}
button.danger{background:var(--error-color);color:var(--text-primary-color,#fff);border-color:var(--error-color)}button:focus-visible{outline:2px solid var(--primary-color);outline-offset:2px}
@media (max-width:449px),(max-height:499px){:host{place-items:end stretch}.dialog{width:auto;min-height:90vh;border-radius:16px 16px 0 0;display:flex;flex-direction:column}.buttons{margin-top:auto}}`;
// Zentraler Bestätigungsdialog (R04): Escape, Abbrechen und Zurück liefern false, Bestätigen true, genau einmal.
// `history.state` ist im Browser eine Kopie: der eigene Eintrag wird deshalb über seine id erkannt, nie per Identität.
// Schlüssel `buschUnraidConfirm`, nicht `dialog`: HA wertet `history.state.dialog` selbst aus.
// Tasten hängen am document (Capture): nach einem Klick ins Leere liegt der Fokus sonst auf body und Escape/Tab erreichen den Dialog nicht.
class BuschUnraidConfirm extends HTMLElement {
 static frage(o){const d=document.createElement('busch-unraid-confirm');document.body.appendChild(d);return d._zeigen(o);}
 _zeigen({titel,text,aktion,gefahr}){
  // document.activeElement meldet nur den äußersten Shadow-Host; bis zum wirklich fokussierten Element absteigen.
  let vorher=document.activeElement;while(vorher?.shadowRoot?.activeElement)vorher=vorher.shadowRoot.activeElement;this._vorher=vorher;
  const root=this.attachShadow({mode:'open'}),style=document.createElement('style');style.textContent=UNRAID_CONFIRM_STYLE;
  this._scrim=document.createElement('div');this._scrim.className='scrim';
  const box=document.createElement('div');box.className='dialog';box.setAttribute('role','alertdialog');box.setAttribute('aria-modal','true');
  const h=document.createElement('h2');h.id='t';h.textContent=titel;const p=document.createElement('p');p.id='d';p.textContent=text;box.setAttribute('aria-labelledby','t');box.setAttribute('aria-describedby','d');
  const t=buschTexte(UNRAID_TILE_TEXTE,document.querySelector('home-assistant')?.hass),head=document.createElement('div');head.className='dialog-head';
  this._close=document.createElement('button');this._close.className='close';this._close.setAttribute('type','button');this._close.setAttribute('aria-label',t.close);this._close.title=t.close;const icon=BuschUI.ha.icon('mdi:close');icon.setAttribute('aria-hidden','true');this._close.appendChild(icon);head.append(this._close,h);
  const row=document.createElement('div');row.className='buttons';this._abbr=document.createElement('button');this._abbr.textContent=t.cancel;
  this._ok=document.createElement('button');this._ok.textContent=aktion;if(gefahr)this._ok.className='danger';row.append(this._abbr,this._ok);box.append(head,p,row);root.append(style,this._scrim,box);
  const id=Math.random().toString(36).slice(2);this._eintrag={buschUnraidConfirm:id};history.pushState(this._eintrag,'');
  const obenEigener=()=>{const s=history.state;return !!s&&s.buschUnraidConfirm===id;};
  return new Promise(resolve=>{
   this._fertig=(wert,ausHistory=false)=>{if(this._erledigt)return;this._erledigt=true;window.removeEventListener('popstate',this._pop);document.removeEventListener('keydown',this._taste,true);if(!ausHistory&&obenEigener())history.back();this.remove();this._vorher?.focus?.();resolve(wert);};
   // Jedes popstate, solange der Dialog offen ist, ist ein Zurück: der eigene back()-Aufruf läuft erst nach dem Abmelden.
   this._pop=()=>this._fertig(false,true);
   this._taste=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation?.();this._fertig(false);}else if(e.key==='Tab'){const z=[this._close,this._abbr,this._ok],i=z.indexOf(root.activeElement);e.preventDefault();(i<0?z[e.shiftKey?z.length-1:0]:z[(i+(e.shiftKey?-1:1)+z.length)%z.length]).focus();}};
   window.addEventListener('popstate',this._pop);document.addEventListener('keydown',this._taste,true);
   this._close.addEventListener('click',()=>this._fertig(false));this._abbr.addEventListener('click',()=>this._fertig(false));this._ok.addEventListener('click',()=>this._fertig(true));
   // R04: Klick auf den Scrim schließt einen Bestätigungsdialog bewusst nicht; mousedown ohne Standardaktion hält den Fokus im Dialog.
   this._scrim.addEventListener('mousedown',e=>e.preventDefault());
   this._abbr.focus();
  });
 }
}
function unraidBestaetigen(titel,text,aktion,gefahr){return BuschUnraidConfirm.frage({titel,text,aktion,gefahr});}
if(!customElements.get?.('busch-unraid-confirm'))customElements.define('busch-unraid-confirm',BuschUnraidConfirm);

/* === Kacheln === */
// Gemeinsamer Editor aller Kacheln: `ha-form` mit Schema und Texten der Kachel
// (`labels`/`helpers`), wie `BuschUnraidBaseEditor`; Echo-Schutz aus BuschUI.EditorBase.
class BuschUnraidTileEditor extends BuschEditorBase {
 get _schema(){return [];}get _texte(){return {de:{},en:{}};}get _defaults(){return {};}
 // Katalog der Kachel, deren Editor das ist (#642).
 get _katalog(){const k=UNRAID_KACHELN.find(([,,Editor])=>this instanceof Editor);return k?UNRAID_ANZEIGE[k[1].kachel]||null:null;}
 _formDaten(){return unraidAnzeigeEditor.formDaten({...this._defaults,...this._config},this._katalog);}
 setConfig(config){if(!this._acceptConfig(config,buschUnraidConfig))return;this._render();}
 set hass(hass){this._hass=hass;this._render();}
 get hass(){return this._hass;}
 _render(){if(!this._config||!this._hass)return;const t=buschTexte(this._texte,this._hass);
  if(!this._form){this._form=BuschUI.ha.form();this._form.addEventListener('value-changed',event=>{event.stopPropagation();this._publishConfig(unraidAnzeigeEditor.normalisiere(buschUnraidConfig({...this._config,...event.detail.value}),this._katalog,this._config));this._form.data=this._formDaten();});this.appendChild(this._form);}
  this._form.hass=this._hass;this._form.data=this._formDaten();this._form.schema=buschSchemaMitTexten(unraidAnzeigeEditor.schema(this._schema,this._katalog,t),t);this._form.computeLabel=s=>t.labels?.[s.name]||s.name;this._form.computeHelper=s=>t.helpers?.[s.name]||'';
 }
}
const UNRAID_ARRAY_STATUS={de:{started:'Gestartet',stopped:'Gestoppt',starting:'Startet',stopping:'Stoppt'},en:{started:'Started',stopped:'Stopped',starting:'Starting',stopping:'Stopping'}};
function unraidDauer(sek,t){if(typeof sek!=='number'||!Number.isFinite(sek)||sek<0)return '–';const d=Math.floor(sek/86400),h=Math.floor(sek%86400/3600),m=Math.floor(sek%3600/60);return [[d,t.day,t.days],[h,t.hour,t.hours],[m,t.minute,t.minutes]].filter(([n],i)=>n||i===2).map(([n,e,v])=>`${n} ${n===1?e:v}`).join(', ');}
const SCHEMA_BUSCH_UNRAID_SERVER_CARD=[{name:'device_id',selector:{device:{filter:[{integration:'unraid_ssh',model:'Unraid'}]}}},{name:'title',selector:{text:{}}},{name:'visible_items',selector:{select:{multiple:true,mode:'list',options:[]}}},{name:'collapsed_items',selector:{select:{multiple:true,mode:'list',options:[]}}}];
const TEXTE_BUSCH_UNRAID_SERVER_CARD={de:{...UNRAID_TILE_TEXTE.de,name:'Unraid: Server',description:'Name, Uhrzeit, Laufzeit und Array-Zustand eines Unraid-Servers.',labels:{device_id:'Server',title:'Titel',visible_items:'Angezeigt',collapsed_items:'Eingeklappt anzeigen'},helpers:{device_id:'Unraid-Server, dessen Daten die Karte zeigt. Leer: der einzige Server.',title:'Überschrift der Karte. Leer: Name der Kachel.',visible_items:'Abschnitte, die ausgeklappt sichtbar sind. Vorgabe: alle wie bisher.',collapsed_items:'Kennzahlen in einer Zeile unter dem Kopf, wenn die Karte eingeklappt ist. Vorgabe: keine.'},anzeige:{clock:'Uhrzeit',uptime:'Laufzeit',array:'Array',mover:'Mover',model:'Modell',registration:'Registrierung'},kurz:{uptime:'Laufzeit',array:'Array',mover:'Mover'},tile:'Server',uptime:'Laufzeit',array:'Array',mover:'Mover',mover_on:'läuft',mover_off:'ruht',day:'Tag',days:'Tage',hour:'Stunde',hours:'Stunden',minute:'Minute',minutes:'Minuten',version:'Unraid-Version'},
 en:{...UNRAID_TILE_TEXTE.en,name:'Unraid: Server',description:'Name, clock, uptime and array state of an Unraid server.',labels:{device_id:'Server',title:'Title',visible_items:'Shown',collapsed_items:'Shown when collapsed'},helpers:{device_id:'Unraid server whose data the card shows. Empty: the only server.',title:'Heading of the card. Empty: the tile name.',visible_items:'Sections shown when expanded. Default: all, as before.',collapsed_items:'Values shown in one line below the header while collapsed. Default: none.'},anzeige:{clock:'Clock',uptime:'Uptime',array:'Array',mover:'Mover',model:'Model',registration:'Registration'},kurz:{uptime:'Uptime',array:'Array',mover:'Mover'},tile:'Server',uptime:'Uptime',array:'Array',mover:'Mover',mover_on:'running',mover_off:'idle',day:'day',days:'days',hour:'hour',hours:'hours',minute:'minute',minutes:'minutes',version:'Unraid version'}};
class BuschUnraidServerCard extends BuschUnraidTile{
 static get kachel(){return 'server';}get _texte(){return TEXTE_BUSCH_UNRAID_SERVER_CARD;}get _vorgaben(){return {device_id:'',title:''};}
 // Der Uptime-Sensor von unraid_ssh ist ein Zeitstempel (Boot-Zeit, ISO); die Laufzeit rechnet die Karte selbst.
 _modell(core,config){const s=unraidServer(core,config);const z=unraidZustand(s);if(z)return z;const hw=unraidDashboard(s,'hardware'),up=s.wert('uptime'),boot=up&&!['unavailable','unknown'].includes(up.state)?Date.parse(up.state):NaN;
  return {name:s.server.name_by_user||s.server.name,serverId:s.server.id,buttons:unraidServerButtons(s,['server_reboot','server_shutdown','mover_start']),hw,version:s.server.sw_version||'',uptime:Number.isFinite(boot)?Math.floor(Math.max(0,(Date.now()-boot)/1000)/60)*60:null,array:s.wert('array_state')?.state||null,mover:s.wert('mover_active')?.state||null};}
 _kopf(m,t){return {icon:'mdi:server',titel:m.name||t.tile,untertitel:m.version?`${t.version} ${m.version}`:undefined};}
 _inhalt(body,m,t){if(!this._inhaltSichtbar())return;const lang=String(this._hass?.locale?.language||'en'),tz=this._hass?.config?.time_zone;
  if(this._zeigt('clock')){const now=new Date();body.appendChild(buschUnraidNode('div',new Intl.DateTimeFormat(lang,{hour:'2-digit',minute:'2-digit',timeZone:tz}).format(now),'clock'));body.appendChild(buschUnraidNode('p',new Intl.DateTimeFormat(lang,{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric',timeZoneName:'short',timeZone:tz}).format(now),'detail'));}
  const st=UNRAID_ARRAY_STATUS[lang.startsWith('de')?'de':'en'],arr=m.array&&!['unavailable','unknown'].includes(m.array)?m.array:null;
  const zeilen=[['uptime',()=>({k:t.uptime,v:unraidDauer(m.uptime,t)})],['array',()=>({k:t.array,v:unraidPunkt(arr==='started'?'ok':arr?'warning':'unknown',arr?(st[arr]||arr):t.unavailable)})],['mover',()=>({k:t.mover,v:m.mover==='on'?t.mover_on:m.mover==='off'?t.mover_off:t.unavailable})],['model',()=>({k:t.model,v:m.hw.daten.hardware?.product_name||'–'})],['registration',()=>({k:t.registration,v:m.hw.daten.registration||'–'})]].filter(([id])=>this._zeigt(id)).map(([,z])=>z());
  if(zeilen.length)body.appendChild(unraidTabelle([{key:'k',label:''},{key:'v',label:''}],zeilen,{leer:''}));unraidZusatzHinweis(body,[m.hw],t);}
 _kompakt(m,t){if(m.laedt||m.fehler)return {};const lang=String(this._hass?.locale?.language||'en'),st=UNRAID_ARRAY_STATUS[lang.startsWith('de')?'de':'en'],arr=m.array&&!['unavailable','unknown'].includes(m.array)?m.array:null;
  return {uptime:unraidKw(unraidDauer(m.uptime,t)),array:arr?unraidKw(st[arr]||arr,arr==='started'?'ok':'warning'):null,mover:unraidKw(m.mover==='on'?t.mover_on:m.mover==='off'?t.mover_off:null)};}
 // #643/3 (O-2: nur hier): Mover als beschrifteter Knopf; Neustart/Ausschalten im ⋮-Menü. Die Einträge bleiben die
 // Aktionen aus unraidServerAktionen (Bestätigung, Zielprüfung nach dem Dialog), nur anders angeordnet.
 _aktionen(m,t){const alle=unraidServerAktionen(this,m,t),mover=alle.filter(a=>a.key==='mover_start').map(a=>({...a,text:a.label,gefahr:false})),menu=alle.filter(a=>a.key!=='mover_start');
  return [...mover,...(menu.length?[{key:'more',label:t.more_actions,icon:'mdi:dots-vertical',titel:m.name,menu}]:[])];}
 // [A-3]/R20: eingeklappt kein Minutentakt (die Uhr ist nicht kompakt).
 _signaturZusatz(){return this._zeigt('clock')&&!this._eingeklappt?Math.floor(Date.now()/60000):null;}
 // Uhr: alle 30 s prüfen, gebaut wird nur bei neuer Minute (Signatur); bei verstecktem Tab nichts tun.
 connectedCallback(){super.connectedCallback();clearInterval(this._uhr);this._uhr=setInterval(()=>{if(typeof document!=='undefined'&&document.hidden)return;if(this._zeigt('clock')&&!this._eingeklappt)this._render();},30000);}
 disconnectedCallback(){super.disconnectedCallback();clearInterval(this._uhr);this._uhr=null;}
 static getConfigElement(){return document.createElement('busch-unraid-server-card-editor');}
 static getStubConfig(){return {type:'custom:busch-unraid-server-card'};}
}
class BuschUnraidServerCardEditor extends BuschUnraidTileEditor{get _schema(){return SCHEMA_BUSCH_UNRAID_SERVER_CARD;}get _texte(){return TEXTE_BUSCH_UNRAID_SERVER_CARD;}get _defaults(){return new BuschUnraidServerCard()._vorgaben;}}
// friendly_name ohne führenden Gerätenamen (has_entity_name stellt ihn voran); ein vom Nutzer gesetzter Name bleibt unverändert.
function unraidOhneGeraet(geraet,n){return geraet&&typeof n==='string'&&n.startsWith(geraet+' ')&&n.length>geraet.length+1?n.slice(geraet.length+1):n;}
// Doppelte Namen (z. B. zwei NVMe mit gleichem friendly_name) bekommen den Rohchip angehängt.
function unraidEindeutig(liste){const zahl=new Map();for(const x of liste)zahl.set(x.name,(zahl.get(x.name)||0)+1);for(const x of liste)if(zahl.get(x.name)>1&&x.chip)x.name+=' ('+x.chip+')';return liste;}
const SCHEMA_BUSCH_UNRAID_SYSTEM_CARD=[{name:'device_id',selector:{device:{filter:[{integration:'unraid_ssh',model:'Unraid'}]}}},{name:'title',selector:{text:{}}},{name:'visible_items',selector:{select:{multiple:true,mode:'list',options:[]}}},{name:'collapsed_items',selector:{select:{multiple:true,mode:'list',options:[]}}}];
const TEXTE_BUSCH_UNRAID_SYSTEM_CARD={de:{...UNRAID_TILE_TEXTE.de,name:'Unraid: System',description:'RAM-Auslastung und Temperaturen eines Unraid-Servers.',labels:{device_id:'Server',title:'Titel',visible_items:'Angezeigt',collapsed_items:'Eingeklappt anzeigen'},helpers:{device_id:'Unraid-Server, dessen Daten die Karte zeigt. Leer: der einzige Server.',title:'Überschrift der Karte. Leer: Name der Kachel.',visible_items:'Abschnitte, die ausgeklappt sichtbar sind. Vorgabe: alle wie bisher.',collapsed_items:'Kennzahlen in einer Zeile unter dem Kopf, wenn die Karte eingeklappt ist. Vorgabe: keine.'},anzeige:{ram:'RAM-Auslastung',filesystems:'Dateisysteme',hardware:'Hardware',memory:'RAM-Aufteilung',temperatures:'Temperaturen'},kurz:{ram:'RAM',temperatures:'CPU-Temp.'},tile:'System',ram:'RAM-Auslastung',temps:'Temperaturen',cpu:'CPU',board:'Mainboard',no_temps:'Keine Temperaturfühler.'},
 en:{...UNRAID_TILE_TEXTE.en,name:'Unraid: System',description:'RAM usage and temperatures of an Unraid server.',labels:{device_id:'Server',title:'Title',visible_items:'Shown',collapsed_items:'Shown when collapsed'},helpers:{device_id:'Unraid server whose data the card shows. Empty: the only server.',title:'Heading of the card. Empty: the tile name.',visible_items:'Sections shown when expanded. Default: all, as before.',collapsed_items:'Values shown in one line below the header while collapsed. Default: none.'},anzeige:{ram:'RAM usage',filesystems:'Filesystems',hardware:'Hardware',memory:'Memory breakdown',temperatures:'Temperatures'},kurz:{ram:'RAM',temperatures:'CPU temp.'},tile:'System',ram:'RAM usage',temps:'Temperatures',cpu:'CPU',board:'Motherboard',no_temps:'No temperature sensors.'}};
class BuschUnraidSystemCard extends BuschUnraidTile{
 static get kachel(){return 'system';}get _texte(){return TEXTE_BUSCH_UNRAID_SYSTEM_CARD;}get _vorgaben(){return {device_id:'',title:''};}
 // Weitere Fühler `temp_<key>` (HW_TEMP von unraid_ssh, Name „<Gerät> Temperatur <Chip> <label>“; attrs chip/channel/label, label kann leer sein).
 // Name = friendly_name ohne führenden Gerätenamen, sonst label, sonst Kanal. `label` allein („Composite“) ist nicht eindeutig;
 // zwei NVMe ergeben sogar denselben friendly_name (Chipname „NVMe“) → doppelte Namen bekommen den Rohchip („nvme-pci-0200“) angehängt.
 _modell(core,config){const s=unraidServer(core,config);const z=unraidZustand(s);if(z)return z;const geraet=s.server.name_by_user||s.server.name||'';
  const temps=unraidEindeutig(s.alle('temp_').map(({entity,suffix})=>{const a=entity.attributes||{};return {name:unraidOhneGeraet(geraet,a.friendly_name)||a.label||a.channel||suffix||entity.entity_id,chip:a.chip||suffix,wert:unraidNum(entity)};}));
  return {hw:unraidDashboard(s,'hardware'),memory:unraidDashboard(s,'memory'),storage:unraidDashboard(s,'storage'),name:geraet,ram:unraidNum(s.wert('ram_percent')),cpu:unraidNum(s.wert('cpu_temp')),board:unraidNum(s.wert('board_temp')),temps};}
 _kopf(m,t){return {icon:'mdi:memory',titel:t.tile,untertitel:m.name};}
 _kompakt(m,t){if(m.laedt||m.fehler)return {};const lang=this._hass?.locale?.language;return {ram:unraidKw(unraidZahl(m.ram,'%',lang)),temperatures:unraidKw(unraidCpuTempText(m.cpu,lang,t),unraidCpuTempStufe(m.cpu))};}
 _inhalt(body,m,t){if(!this._inhaltSichtbar())return;const lang=this._hass?.locale?.language,dateien=this._zeigt('filesystems');const rings=buschUnraidNode('div',undefined,'rings');if(this._zeigt('ram'))rings.appendChild(unraidRing(m.ram,t.ram));
  const mode=m.storage.daten.docker_mode,fs=dateien?unraidListe(m.storage.daten,'filesystems').filter(x=>x.kind!=='docker_vdisk'||mode==='image'):[];if(dateien)for(const kind of ['boot','log','docker_vdisk']){if(kind==='docker_vdisk'&&mode!=='image')continue;const x=fs.find(x=>x.kind===kind);if(m.storage.zustand!=='legacy')rings.appendChild(unraidRing(x?.percent??null,t[kind]));}if(rings.childNodes.length)body.appendChild(rings);
  if(dateien&&m.storage.zustand!=='legacy')body.appendChild(buschUnraidNode('p',mode==='folder'?t.docker_folder:mode==='image'?'':t.docker_unknown,'detail'));
  const hardware=m.hw.daten.hardware||{};if(this._zeigt('hardware')&&m.hw.zustand!=='legacy')body.appendChild(unraidRaster(['board_vendor','board_name','board_version','bios_vendor','bios_version','bios_date'].map(key=>({name:t[key],wert:hardware[key]||'–'}))));
  if(this._zeigt('memory')&&m.memory.zustand!=='legacy'){body.appendChild(buschUnraidNode('h3',t.memory_parts,'section'));body.appendChild(unraidRaster(['total_bytes','system_bytes','cache_bytes','buffers_bytes','free_bytes','available_bytes'].map(key=>({name:t[key],wert:unraidBytes(m.memory.daten.memory?.[key],lang)}))));body.appendChild(buschUnraidNode('p',t.memory_help,'detail'));}
  for(const x of fs)body.appendChild(unraidRaster([{name:t[x.kind]||x.kind,wert:`${t.used}: ${unraidBytes(x.used_bytes,lang)} / ${t.total}: ${unraidBytes(x.total_bytes,lang)} · ${t.free}: ${unraidBytes(x.free_bytes,lang)}`}]));
  unraidZusatzHinweis(body,[m.hw,m.memory,m.storage],t);
  if(!this._zeigt('temperatures'))return;
  if(m.cpu===null&&m.board===null&&!m.temps.length){body.appendChild(buschUnraidNode('h3',t.temps,'section'));body.appendChild(buschUnraidNode('p',t.no_temps,'message'));return;}
  const zeilen=[{name:t.cpu,wert:unraidCpuTemp(m.cpu,lang,t)},{name:t.board,wert:unraidZahl(m.board,'°C',lang)},...m.temps.map(x=>({name:x.name,wert:unraidZahl(x.wert,'°C',lang,1)}))];
  body.appendChild(buschUnraidNode('h3',t.temps,'section'));body.appendChild(unraidRaster(zeilen));}
 static getConfigElement(){return document.createElement('busch-unraid-system-card-editor');}
 static getStubConfig(){return {type:'custom:busch-unraid-system-card'};}
}
class BuschUnraidSystemCardEditor extends BuschUnraidTileEditor{get _schema(){return SCHEMA_BUSCH_UNRAID_SYSTEM_CARD;}get _texte(){return TEXTE_BUSCH_UNRAID_SYSTEM_CARD;}get _defaults(){return new BuschUnraidSystemCard()._vorgaben;}}
// Verlauf aus der HA-History (R20): höchstens ein Abruf je Minute und Entität+Zeitraum. Gecacht wird das Promise,
// damit auch gleichzeitige Renders vor der ersten Antwort keinen zweiten Abruf auslösen; ein Fehlschlag gilt ebenfalls eine Minute.
const UNRAID_VERLAUF_CACHE=new Map();
function unraidVerlauf(hass,entityId,minuten){const key=entityId+'|'+minuten,alt=UNRAID_VERLAUF_CACHE.get(key);if(alt&&Date.now()-alt.zeit<60000)return alt.punkte;
 const start=new Date(Date.now()-minuten*60000).toISOString();
 const punkte=Promise.resolve().then(()=>hass.callWS({type:'history/history_during_period',start_time:start,entity_ids:[entityId],minimal_response:true,no_attributes:true,significant_changes_only:false}))
  .then(antwort=>(antwort?.[entityId]||[]).map(r=>({t:Number(r.lu??r.lc)*1000,v:Number(r.s)})).filter(p=>Number.isFinite(p.v)&&Number.isFinite(p.t)));
 UNRAID_VERLAUF_CACHE.set(key,{zeit:Date.now(),punkte});return punkte;}
function unraidLinie(punkte,leer,label=leer){if(!punkte||punkte.length<2)return buschUnraidNode('p',leer,'message');const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 100 30');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('class','line');svg.setAttribute('role','img');svg.setAttribute('aria-label',label);
 const t0=punkte[0].t,t1=punkte[punkte.length-1].t,d=punkte.map((p,i)=>`${i?'L':'M'}${((p.t-t0)/(t1-t0||1)*100).toFixed(2)},${(30-Math.max(0,Math.min(100,p.v))*0.3).toFixed(2)}`).join(' ');const path=document.createElementNS(ns,'path');path.setAttribute('d',d);svg.appendChild(path);return svg;}
const UNRAID_CPU_ZEITRAEUME=['5','10','30','60'];
const SCHEMA_BUSCH_UNRAID_CPU_CARD=[{name:'device_id',selector:{device:{filter:[{integration:'unraid_ssh',model:'Unraid'}]}}},{name:'title',selector:{text:{}}},{name:'visible_items',selector:{select:{multiple:true,mode:'list',options:[]}}},{name:'collapsed_items',selector:{select:{multiple:true,mode:'list',options:[]}}},{name:'history_minutes',selector:{select:{mode:'dropdown',options:UNRAID_CPU_ZEITRAEUME.map(v=>({value:v,label:v+' min'}))}}}];
const TEXTE_BUSCH_UNRAID_CPU_CARD={de:{...UNRAID_TILE_TEXTE.de,name:'Unraid: Prozessor',description:'Gesamtlast, Temperatur und Lastverlauf der CPU.',labels:{device_id:'Server',title:'Titel',history_minutes:'Verlaufszeitraum',visible_items:'Angezeigt',collapsed_items:'Eingeklappt anzeigen'},helpers:{device_id:'Unraid-Server, dessen Daten die Karte zeigt. Leer: der einzige Server.',title:'Überschrift der Karte. Leer: Name der Kachel.',history_minutes:'Minuten, die die Verlaufslinie zeigt. Vorgabe 10.',visible_items:'Abschnitte, die ausgeklappt sichtbar sind. Vorgabe: alle wie bisher.',collapsed_items:'Kennzahlen in einer Zeile unter dem Kopf, wenn die Karte eingeklappt ist. Vorgabe: keine.'},anzeige:{temperature:'Temperatur',load_average:'Load (1 min)',load:'Gesamtlast',power:'Leistung',cores:'CPU-Kerne',history:'Verlauf'},kurz:{temperature:'Temp.',load_average:'Load',load:'CPU',power:'Leistung'},tile:'Prozessor',load:'Gesamtlast',temp:'Temperatur',load1:'Load (1 min)',no_history:'Noch kein Verlauf.',history_title:'Verlauf · {minutes} min',history_range:'Min {min} · Max {max}'},
 en:{...UNRAID_TILE_TEXTE.en,name:'Unraid: Processor',description:'Overall load, temperature and load history of the CPU.',labels:{device_id:'Server',title:'Title',history_minutes:'History period',visible_items:'Shown',collapsed_items:'Shown when collapsed'},helpers:{device_id:'Unraid server whose data the card shows. Empty: the only server.',title:'Heading of the card. Empty: the tile name.',history_minutes:'Minutes shown by the history line. Default 10.',visible_items:'Sections shown when expanded. Default: all, as before.',collapsed_items:'Values shown in one line below the header while collapsed. Default: none.'},anzeige:{temperature:'Temperature',load_average:'Load (1 min)',load:'Overall load',power:'Power',cores:'CPU cores',history:'History'},kurz:{temperature:'Temp.',load_average:'Load',load:'CPU',power:'Power'},tile:'Processor',load:'Overall load',temp:'Temperature',load1:'Load (1 min)',no_history:'No history yet.',history_title:'History · {minutes} min',history_range:'Min {min} · Max {max}'}};
// Erlaubte Zeiträume wie im Editor-Dropdown; alles andere (Tippfehler, YAML) fällt auf 10 Minuten zurück.
const UNRAID_VERLAUF_MINUTEN=[5,10,30,60];
class BuschUnraidCpuCard extends BuschUnraidTile{
 static get kachel(){return 'cpu';}get _texte(){return TEXTE_BUSCH_UNRAID_CPU_CARD;}get _vorgaben(){return {device_id:'',title:'',history_minutes:'10'};}
 // `open` changes before the deferred native toggle event; capture the live DOM before replacing it.
 _render(){const details=this.shadowRoot?.querySelector('.core-details');if(details)this._coreDetailsOpen=!!details.open;super._render();}
 _modell(core,config){const s=unraidServer(core,config);const z=unraidZustand(s);if(z)return z;const cpu=s.wert('cpu_percent');return {dashboard:unraidDashboard(s,'cpu'),hw:unraidDashboard(s,'hardware'),power:unraidNum(s.wert('cpu_power')),name:s.server.name_by_user||s.server.name,cpu:unraidNum(cpu),cpuId:cpu?.entity_id,temp:unraidNum(s.wert('cpu_temp')),load:unraidNum(s.wert('load_1'))};}
 _kopf(m,t){return {icon:'mdi:cpu-64-bit',titel:t.tile,untertitel:m.hw?.daten.hardware?.cpu_model||m.name};}
 _kompakt(m,t){if(m.laedt||m.fehler)return {};const lang=this._hass?.locale?.language;return {temperature:unraidKw(unraidCpuTempText(m.temp,lang,t),unraidCpuTempStufe(m.temp)),load_average:unraidKw(unraidZahl(m.load,'',lang,1)),load:unraidKw(unraidZahl(m.cpu,'%',lang)),power:unraidKw(unraidZahl(m.power,'W',lang))};}
 _signaturZusatz(){return this._zeigt('history')&&!this._eingeklappt?Math.floor(Date.now()/60000):null;}
 _inhalt(body,m,t){if(!this._inhaltSichtbar())return;const lang=this._hass?.locale?.language,zeilen=[];if(this._zeigt('temperature'))zeilen.push({k:t.temp,v:unraidCpuTemp(m.temp,lang,t)});if(this._zeigt('load_average'))zeilen.push({k:t.load1,v:unraidZahl(m.load,'',lang,1)});if(zeilen.length)body.appendChild(unraidTabelle([{key:'k',label:''},{key:'v',label:''}],zeilen,{leer:''}));
  if(this._zeigt('load')){body.appendChild(buschUnraidNode('h3',t.load,'section'));body.appendChild(unraidBalken(m.cpu,unraidZahl(m.cpu,'%',lang)));}
  // #643/5: leere Technikzeilen (Leistung „–“, Package ohne Wert) entfallen.
  if(this._zeigt('power')&&m.power!==null)body.appendChild(unraidRaster([{name:t.power,wert:unraidZahl(m.power,'W',lang)}]));
  if(this._zeigt('power'))for(const pkg of unraidListe(m.dashboard.daten,'packages').filter(p=>typeof p?.power_w==='number'&&Number.isFinite(p.power_w)))body.appendChild(unraidRaster([{name:pkg.id,wert:`${unraidZahl(pkg.power_w,'W',lang)} · ${t.source}: ${pkg.source||'–'}`} ]));
  const kerne=unraidListe(m.dashboard.daten,'cores');if(this._zeigt('cores')&&kerne.length){const details=buschUnraidNode('details',undefined,'core-details'),summary=buschUnraidNode('summary');summary.appendChild(buschUnraidNode('span',t.core_details,'summary-text'));const pfeil=BuschUI.ha.icon('mdi:chevron-down');pfeil.className='chevron';pfeil.setAttribute('aria-hidden','true');summary.appendChild(pfeil);summary.dataset.focusKey='cpu-core-details';details.open=!!this._coreDetailsOpen;details.addEventListener('toggle',()=>{if(this.shadowRoot.querySelector('.core-details')===details)this._coreDetailsOpen=details.open;});details.appendChild(summary);details.appendChild(unraidRaster(kerne.map(c=>({name:t.core+' '+c.id,wert:unraidZahl(c.percent,'%',lang)}))));body.appendChild(details);}unraidZusatzHinweis(body,[m.dashboard,m.hw],t);
  // Ohne callWS (Vorschau, Tests) entfällt der Verlauf. Die letzte Linie bleibt bis zur Antwort stehen, damit Renders nicht flackern.
  // #643/5: Zeitraum als Überschrift, Min/Max aus denselben Punkten (kein zusätzlicher Abruf).
  if(this._zeigt('history')&&m.cpuId&&typeof this._hass?.callWS==='function'){const min=UNRAID_VERLAUF_MINUTEN.includes(Number(this._config.history_minutes))?Number(this._config.history_minutes):10,key=m.cpuId+'|'+min;
   body.appendChild(buschUnraidNode('h3',buschFuellen(t.history_title,{minutes:min}),'section'));const platz=buschUnraidNode('div',undefined,'history'),spanne=buschUnraidNode('p',undefined,'detail history-range');body.appendChild(platz);body.appendChild(spanne);
   const zeige=p=>{platz.replaceChildren(unraidLinie(p,t.no_history,t.load));const werte=(p||[]).map(x=>x.v);spanne.textContent=werte.length>1?buschFuellen(t.history_range,{min:unraidZahl(Math.min(...werte),'%',lang),max:unraidZahl(Math.max(...werte),'%',lang)}):'';};
   if(this._linie?.key===key)zeige(this._linie.punkte);
   unraidVerlauf(this._hass,m.cpuId,min).then(p=>{this._linie={key,punkte:p};zeige(p);}).catch(()=>{platz.replaceChildren(buschUnraidNode('p',t.no_history,'message'));spanne.textContent='';});}}
 static getConfigElement(){return document.createElement('busch-unraid-cpu-card-editor');}
 static getStubConfig(){return {type:'custom:busch-unraid-cpu-card'};}
}
class BuschUnraidCpuCardEditor extends BuschUnraidTileEditor{get _schema(){return SCHEMA_BUSCH_UNRAID_CPU_CARD;}get _texte(){return TEXTE_BUSCH_UNRAID_CPU_CARD;}get _defaults(){return new BuschUnraidCpuCard()._vorgaben;}}
const SCHEMA_BUSCH_UNRAID_GPU_CARD=[{name:'device_id',selector:{device:{filter:[{integration:'unraid_ssh',model:'Unraid'}]}}},{name:'title',selector:{text:{}}},{name:'visible_items',selector:{select:{multiple:true,mode:'list',options:[]}}},{name:'collapsed_items',selector:{select:{multiple:true,mode:'list',options:[]}}}];
const TEXTE_BUSCH_UNRAID_GPU_CARD={de:{...UNRAID_TILE_TEXTE.de,name:'Unraid: GPU',description:'Last, Speicher, Temperatur, Leistung und Lüfter der Grafikkarte.',labels:{device_id:'Server',title:'Titel',visible_items:'Angezeigt',collapsed_items:'Eingeklappt anzeigen'},helpers:{device_id:'Unraid-Server, dessen Daten die Karte zeigt. Leer: der einzige Server.',title:'Überschrift der Karte. Leer: Name der Kachel.',visible_items:'Abschnitte, die ausgeklappt sichtbar sind. Vorgabe: alle wie bisher.',collapsed_items:'Kennzahlen in einer Zeile unter dem Kopf, wenn die Karte eingeklappt ist. Vorgabe: keine.'},anzeige:{util:'Last',vram:'VRAM',temperature:'Temperatur',power:'Leistung',fan:'Lüfter'},kurz:{util:'GPU',vram:'VRAM',temperature:'Temp.',power:'Leistung',fan:'Lüfter'},tile:'GPU',util:'Last',vram:'Speicher',temp:'Temperatur',power:'Leistung',fan:'Lüfter',none:'Keine GPU gefunden.'},
 en:{...UNRAID_TILE_TEXTE.en,name:'Unraid: GPU',description:'Load, memory, temperature, power and fan of the graphics card.',labels:{device_id:'Server',title:'Title',visible_items:'Shown',collapsed_items:'Shown when collapsed'},helpers:{device_id:'Unraid server whose data the card shows. Empty: the only server.',title:'Heading of the card. Empty: the tile name.',visible_items:'Sections shown when expanded. Default: all, as before.',collapsed_items:'Values shown in one line below the header while collapsed. Default: none.'},anzeige:{util:'Load',vram:'VRAM',temperature:'Temperature',power:'Power',fan:'Fan'},kurz:{util:'GPU',vram:'VRAM',temperature:'Temp.',power:'Power',fan:'Fan'},tile:'GPU',util:'Load',vram:'Memory',temp:'Temperature',power:'Power',fan:'Fan',none:'No GPU found.'}};
const UNRAID_GPU_SUFFIX=/^gpu_(?:util|vram|temp|power|fan)_(\d+)$/;
class BuschUnraidGpuCard extends BuschUnraidTile{
 static get kachel(){return 'gpu';}get _texte(){return TEXTE_BUSCH_UNRAID_GPU_CARD;}
 // Index aus dem Suffix `gpu_<metrik>_<i>`. Eine Karte ohne steuerbaren Lüfter hat keine gpu_fan-Entität → Zeile entfällt (fan undefined);
 // eine vorhandene, aber nicht verfügbare zeigt –.
 _modell(core,config){const s=unraidServer(core,config);const z=unraidZustand(s);if(z)return z;
  const hw=unraidDashboard(s,'hardware'),info=unraidListe(hw.daten,'gpus');
  const idx=[...new Set([...s.alle('gpu_').map(x=>UNRAID_GPU_SUFFIX.exec(x.suffix)?.[1]).filter(i=>i!==undefined),...info.map(g=>String(g.index))])].sort((a,b)=>Number(a)-Number(b));
  return {hw,name:s.server.name_by_user||s.server.name,gpus:idx.map(i=>{const fan=s.wert('gpu_fan_'+i),meta=info.find(g=>String(g.index)===i);return {index:i,name:meta?.model||'GPU '+i,driver:meta?.driver_version||null,util:unraidNum(s.wert('gpu_util_'+i)),vram:unraidNum(s.wert('gpu_vram_'+i)),temp:unraidNum(s.wert('gpu_temp_'+i)),power:unraidNum(s.wert('gpu_power_'+i)),fan:fan?unraidNum(fan):undefined};})};}
 _kopf(m,t){const g=m.gpus?.[0];return {icon:'mdi:expansion-card',titel:t.tile,untertitel:g?`${g.name} · ${t.driver}: ${g.driver||'–'}`:m.name};}
 _kompakt(m,t){if(m.laedt||m.fehler||!m.gpus?.length)return m.gpus&&!m.gpus.length?{util:null,vram:null,temperature:null,power:null,fan:null}:{};const lang=this._hass?.locale?.language,mehrere=m.gpus.length>1;
  const je=(id,f)=>{const liste=m.gpus.map(g=>{const w=unraidKw(f(g));return w&&mehrere?{...w,label:`${t.kurz[id]} ${g.index}`}:w;});return mehrere?liste.filter(Boolean):liste[0];};
  return {util:je('util',g=>unraidZahl(g.util,'%',lang)),vram:je('vram',g=>unraidZahl(g.vram,'%',lang)),temperature:je('temperature',g=>unraidZahl(g.temp,'°C',lang)),power:je('power',g=>unraidZahl(g.power,'W',lang)),fan:je('fan',g=>g.fan===undefined?null:unraidZahl(g.fan,'%',lang))};}
 _inhalt(body,m,t){if(!this._inhaltSichtbar())return;const lang=this._hass?.locale?.language;unraidZusatzHinweis(body,[m.hw],t);if(!m.gpus.length){body.appendChild(buschUnraidNode('p',t.none,'message'));return;}
  // #643/4: Wertegitter Label | Spur | Wert; alle Werte in einer bündigen rechten Spalte, Balken ohne eigenen Text.
  for(const g of m.gpus){const zeilen=[['util',{k:t.util,p:g.util,v:unraidZahl(g.util,'%',lang)}],['vram',{k:t.vram,p:g.vram,v:unraidZahl(g.vram,'%',lang)}],['temperature',{k:t.temp,v:unraidZahl(g.temp,'°C',lang)}],['power',{k:t.power,v:unraidZahl(g.power,'W',lang)}],...(g.fan===undefined?[]:[['fan',{k:t.fan,v:unraidZahl(g.fan,'%',lang)}]])].filter(([id])=>this._zeigt(id)).map(([,z])=>z);if(!zeilen.length)continue;
   if(m.gpus.length>1)body.appendChild(buschUnraidNode('h3',g.driver?`${g.name} · ${t.driver}: ${g.driver}`:g.name,'section'));
   const gitter=buschUnraidNode('div',undefined,'table gpu-values');gitter.setAttribute('role','table');gitter.setAttribute('aria-label',g.name);
   for(const z of zeilen){const zeile=buschUnraidNode('div',undefined,'gpu-row'),name=buschUnraidNode('span',z.k,'gpu-label'),spur=buschUnraidNode('span',undefined,'gpu-track'),wert=buschUnraidNode('span',z.v,'gpu-value');zeile.setAttribute('role','row');for(const c of [name,spur,wert])c.setAttribute('role','cell');if('p' in z)spur.appendChild(unraidBalken(z.p,z.v,{ohneText:true}));zeile.append(name,spur,wert);gitter.appendChild(zeile);}
   body.appendChild(gitter);}}
 static getConfigElement(){return document.createElement('busch-unraid-gpu-card-editor');}
 static getStubConfig(){return {type:'custom:busch-unraid-gpu-card'};}
}
class BuschUnraidGpuCardEditor extends BuschUnraidTileEditor{get _schema(){return SCHEMA_BUSCH_UNRAID_GPU_CARD;}get _texte(){return TEXTE_BUSCH_UNRAID_GPU_CARD;}get _defaults(){return new BuschUnraidGpuCard()._vorgaben;}}
// Array-Karte. Statuswerte genau wie DISK_STATUSES in unraid_ssh (const.py); „schläft“ kommt aus dem eigenen Binärsensor disk_spundown_<name>.
// Gruppen nach Gerätemodell f"{disk.kind} disk" (kind = Unraid-`type` aus disks.ini): Parity/Data → „Array“,
// Cache → Pool nach Rohname ohne Endziffern (raid, raid2 → „raid“), Boot (Unraid 7) und Flash (ältere Versionen) → „Boot“;
// Reihenfolge Array, Pools alphabetisch, Boot. Namen und Suffixe immer über den Rohnamen `roh` (nicht den übersetzten Gerätenamen).
// Poolmitglieder ohne eigenes Dateisystem (raid2 …) haben in unraid_ssh keinen disk_usage-Sensor → „–“.
const UNRAID_DISK_STATUS={de:{ok:'OK',new:'neu',disabled:'deaktiviert',invalid:'ungültig',missing:'fehlt',not_present:'nicht vorhanden',unknown:'unbekannt'},en:{ok:'OK',new:'new',disabled:'disabled',invalid:'invalid',missing:'missing',not_present:'not present',unknown:'unknown'}};
const UNRAID_DISK_SEMANTIK={ok:'ok',new:'warning',disabled:'error',invalid:'error',missing:'error',not_present:'unknown',unknown:'unknown'};
// HA may present DATA_SIZE sensors in a user-selected unit, independent of their native KiB.
const UNRAID_DATENGROESSEN={B:1,kB:1e3,MB:1e6,GB:1e9,TB:1e12,PB:1e15,KiB:1024,MiB:1024**2,GiB:1024**3,TiB:1024**4,PiB:1024**5};
function unraidKapazitaetsBytes(e){
 if(!e||e.registry?.disabled_by||!['number','string'].includes(typeof e.state)||String(e.state).trim()==='')return null;
 const n=Number(e.state),f=UNRAID_DATENGROESSEN[e.attributes?.unit_of_measurement];
 return Number.isFinite(n)&&n>=0&&f&&Number.isFinite(n*f)?n*f:null;
}
function unraidGruppenKapazitaet(g){
 let quellen=g.geraete.filter(d=>d.daten);
 if(g.art===1){
  // disks.ini reports the logical pool filesystem on its named primary device. Never add members.
  const primaer=g.geraete.find(d=>d.name===g.titel);
  quellen=primaer?[primaer]:g.geraete.filter(d=>d.hatKapazitaet);
  if(quellen.length!==1)return null;
 }
 if(!quellen.length||quellen.some(d=>d.used===null||d.total===null||d.used>d.total||d.ausgefallen))return null;
 const used=quellen.reduce((n,d)=>n+d.used,0),total=quellen.reduce((n,d)=>n+d.total,0);
 return Number.isFinite(used)&&Number.isFinite(total)?{used,total}:null;
}
function unraidGruppen(s,t,pools=null){const gruppen=new Map(),add=(titel,d,art)=>{const key=art+':'+titel;if(!gruppen.has(key))gruppen.set(key,{titel,art,geraete:[]});const n=d.roh,st=s.von(d,'disk_status_'+n)?.state;
  const used=s.von(d,'disk_used_'+n),total=s.von(d,'disk_total_'+n);
  gruppen.get(key).geraete.push({name:n,status:st&&!['unavailable','unknown'].includes(st)?st:null,temp:unraidNum(s.von(d,'disk_temp_'+n)),usage:unraidNum(s.von(d,'disk_usage_'+n)),schlaeft:s.von(d,'disk_spundown_'+n)?.state==='on',
   smart:(()=>{const e=s.von(d,'disk_smart_'+n);return e?{state:e.state,attributes:e.attributes}:null;})(),daten:d.model!=='Parity disk',ausgefallen:['missing','not_present','unavailable'].includes(st),used:unraidKapazitaetsBytes(used),total:unraidKapazitaetsBytes(total),hatKapazitaet:!!(used||total)});};
 for(const d of [...s.geraete('Parity disk'),...s.geraete('Data disk')])add(t.array,d,0);
 for(const d of s.geraete('Cache disk')){const pool=pools?.find(p=>p.name===d.roh||Array.isArray(p.members)&&p.members.includes(d.roh));add(pool?.name||(pools?d.roh:d.roh.replace(/\d+$/,'')||d.roh),d,1);}
 if(pools)for(const pool of pools){const key='1:'+pool.name;if(!gruppen.has(key))gruppen.set(key,{titel:pool.name,art:1,geraete:[]});gruppen.get(key).pool=pool;}
 for(const d of [...s.geraete('Boot disk'),...s.geraete('Flash disk')])add(t.boot,d,2);
 return [...gruppen.values()].sort((a,b)=>a.art-b.art||String(a.titel).localeCompare(String(b.titel),undefined,{numeric:true})).map(g=>({...g,kapazitaet:g.pool?(typeof g.pool.used_bytes==='number'&&typeof g.pool.total_bytes==='number'&&g.pool.used_bytes>=0&&g.pool.total_bytes>=g.pool.used_bytes?{used:g.pool.used_bytes,total:g.pool.total_bytes}:null):unraidGruppenKapazitaet(g)}));}
const SCHEMA_BUSCH_UNRAID_ARRAY_CARD=[{name:'device_id',selector:{device:{filter:[{integration:'unraid_ssh',model:'Unraid'}]}}},{name:'title',selector:{text:{}}},{name:'visible_items',selector:{select:{multiple:true,mode:'list',options:[]}}},{name:'collapsed_items',selector:{select:{multiple:true,mode:'list',options:[]}}}];
const TEXTE_BUSCH_UNRAID_ARRAY_CARD={de:{...UNRAID_TILE_TEXTE.de,name:'Unraid: Array',description:'Platten von Array, Pools und Bootgerät mit Status, Temperatur und Belegung.',labels:{device_id:'Server',title:'Titel',visible_items:'Angezeigt',collapsed_items:'Eingeklappt anzeigen'},helpers:{device_id:'Unraid-Server, dessen Daten die Karte zeigt. Leer: der einzige Server.',title:'Überschrift der Karte. Leer: Name der Kachel.',visible_items:'Abschnitte, die ausgeklappt sichtbar sind. Vorgabe: alle wie bisher.',collapsed_items:'Kennzahlen in einer Zeile unter dem Kopf, wenn die Karte eingeklappt ist. Vorgabe: keine.'},anzeige:{array:'Array',pools:'Pools',boot:'Bootgerät',smart:'SMART-Spalte'},kurz:{array:'Array',pools:'Pool',boot:'Boot'},tile:'Array und Pools',array:'Array',boot:'Boot',col_device:'Gerät',col_status:'Status',col_temp:'Temp.',col_usage:'Belegung',sleeping:'schläft',capacity:'{used} von {total}',none:'Keine Platten gefunden.'},
 en:{...UNRAID_TILE_TEXTE.en,name:'Unraid: Array',description:'Array, pool and boot disks with status, temperature and utilization.',labels:{device_id:'Server',title:'Title',visible_items:'Shown',collapsed_items:'Shown when collapsed'},helpers:{device_id:'Unraid server whose data the card shows. Empty: the only server.',title:'Heading of the card. Empty: the tile name.',visible_items:'Sections shown when expanded. Default: all, as before.',collapsed_items:'Values shown in one line below the header while collapsed. Default: none.'},anzeige:{array:'Array',pools:'Pools',boot:'Boot device',smart:'SMART column'},kurz:{array:'Array',pools:'Pool',boot:'Boot'},tile:'Array and pools',array:'Array',boot:'Boot',col_device:'Device',col_status:'Status',col_temp:'Temp.',col_usage:'Utilization',sleeping:'spun down',capacity:'{used} used of {total}',none:'No disks found.'}};
class BuschUnraidArrayCard extends BuschUnraidTile{
 static get kachel(){return 'array';}get _texte(){return TEXTE_BUSCH_UNRAID_ARRAY_CARD;}get _vorgaben(){return {device_id:'',title:''};}
 _modell(core,config){const s=unraidServer(core,config);const z=unraidZustand(s);if(z)return z;const t=buschTexte(this._texte,this._hass),storage=unraidDashboard(s,'storage');return {storage,name:s.server.name_by_user||s.server.name,serverId:s.server.id,buttons:unraidServerButtons(s,['array_start','array_stop','spindown_all']),gruppen:unraidGruppen(s,t,storage.zustand==='legacy'?null:unraidListe(storage.daten,'pools'))};}
 _kopf(m,t){return {icon:'mdi:harddisk',titel:t.tile,untertitel:m.name};}
 _kompakt(m){if(m.laedt||m.fehler)return {};const lang=this._hass?.locale?.language,prozent=g=>g?.kapazitaet&&g.kapazitaet.total>0?unraidZahl(g.kapazitaet.used/g.kapazitaet.total*100,'%',lang):null;
  return {array:unraidKw(prozent(m.gruppen.find(g=>g.art===0))),pools:m.gruppen.filter(g=>g.art===1).map(g=>unraidKw(prozent(g),undefined,g.titel)).filter(Boolean),boot:unraidKw(prozent(m.gruppen.find(g=>g.art===2)))};}
 _inhalt(body,m,t){if(!this._inhaltSichtbar())return;const lang=String(this._hass?.locale?.language||'en'),st=UNRAID_DISK_STATUS[lang.startsWith('de')?'de':'en'];if(!m.gruppen.length){body.appendChild(buschUnraidNode('p',t.none,'message'));return;}
  unraidZusatzHinweis(body,[m.storage],t);
  const spalten=[{key:'n',label:t.col_device},{key:'s',label:t.col_status},{key:'t',label:t.col_temp},{key:'u',label:t.col_usage},...(this._zeigt('smart')?[{key:'smart',label:t.smart}]:[])];
  for(const g of m.gruppen.filter(g=>this._zeigt(['array','pools','boot'][g.art]))){if(g.pool)body.appendChild(unraidRaster([{name:t.pool_state,wert:t[g.pool.state]||t.unknown},{name:t.filesystem,wert:g.pool.filesystem||'–'},{name:t.members,wert:Array.isArray(g.pool.members)?g.pool.members.join(', '):'–'},{name:t.free,wert:unraidBytes(g.pool.free_bytes,lang)}]));body.appendChild(buschUnraidNode('h3',`${g.titel} · ${g.kapazitaet?t.capacity.replace('{used}',unraidBytes(g.kapazitaet.used,lang)).replace('{total}',unraidBytes(g.kapazitaet.total,lang)):'–'}`,'section'));
   body.appendChild(unraidTabelle(spalten,g.geraete.map(d=>{const text=d.status?(st[d.status]||d.status):t.unavailable;return {smart:unraidSmartText(d.smart,t),n:d.name,s:unraidPunkt(UNRAID_DISK_SEMANTIK[d.status]||'unknown',d.schlaeft?`${text} · ${t.sleeping}`:text),t:d.schlaeft?'–':unraidZahl(d.temp,'°C',lang),u:d.usage===null?'–':unraidBalken(d.usage,unraidZahl(d.usage,'%',lang))};}),{leer:''}));}}
 _aktionen(m,t){return unraidServerAktionen(this,m,t);}
 static getConfigElement(){return document.createElement('busch-unraid-array-card-editor');}
 static getStubConfig(){return {type:'custom:busch-unraid-array-card'};}
}
class BuschUnraidArrayCardEditor extends BuschUnraidTileEditor{get _schema(){return SCHEMA_BUSCH_UNRAID_ARRAY_CARD;}get _texte(){return TEXTE_BUSCH_UNRAID_ARRAY_CARD;}get _defaults(){return new BuschUnraidArrayCard()._vorgaben;}}
// Parität: Fortschritt/Fehler/Lauf vom Serverhauptgerät. Leerhinweis nur, wenn kein „Parity disk“-Gerät existiert UND
// keine Prüfung läuft UND kein Fortschrittswert vorliegt (Plattengeräte können abgeschaltet sein, die Prüfung trotzdem laufen).
const SCHEMA_BUSCH_UNRAID_PARITY_CARD=[{name:'device_id',selector:{device:{filter:[{integration:'unraid_ssh',model:'Unraid'}]}}},{name:'title',selector:{text:{}}},{name:'visible_items',selector:{select:{multiple:true,mode:'list',options:[]}}},{name:'collapsed_items',selector:{select:{multiple:true,mode:'list',options:[]}}}];
const TEXTE_BUSCH_UNRAID_PARITY_CARD={de:{...UNRAID_TILE_TEXTE.de,name:'Unraid: Parität',description:'Zustand, Fortschritt und Fehler der Paritätsprüfung.',labels:{device_id:'Server',title:'Titel',visible_items:'Angezeigt',collapsed_items:'Eingeklappt anzeigen'},helpers:{device_id:'Unraid-Server, dessen Daten die Karte zeigt. Leer: der einzige Server.',title:'Überschrift der Karte. Leer: Name der Kachel.',visible_items:'Abschnitte, die ausgeklappt sichtbar sind. Vorgabe: alle wie bisher.',collapsed_items:'Kennzahlen in einer Zeile unter dem Kopf, wenn die Karte eingeklappt ist. Vorgabe: keine.'},anzeige:{state:'Zustand',progress:'Fortschritt',errors:'Fehler'},kurz:{state:'Parität',progress:'Fortschritt',errors:'Fehler'},tile:'Parität',none:'Keine Paritätsplatte vorhanden.',running:'Prüfung läuft',idle:'Keine Prüfung aktiv',unknown:'Unbekannt',progress:'Fortschritt',errors:'Fehler'},
 en:{...UNRAID_TILE_TEXTE.en,name:'Unraid: Parity',description:'State, progress and errors of the parity check.',labels:{device_id:'Server',title:'Title',visible_items:'Shown',collapsed_items:'Shown when collapsed'},helpers:{device_id:'Unraid server whose data the card shows. Empty: the only server.',title:'Heading of the card. Empty: the tile name.',visible_items:'Sections shown when expanded. Default: all, as before.',collapsed_items:'Values shown in one line below the header while collapsed. Default: none.'},anzeige:{state:'State',progress:'Progress',errors:'Errors'},kurz:{state:'Parity',progress:'Progress',errors:'Errors'},tile:'Parity',none:'No parity disk present.',running:'Check running',idle:'No check running',unknown:'Unknown',progress:'Progress',errors:'Errors'}};
class BuschUnraidParityCard extends BuschUnraidTile{
 static get kachel(){return 'parity';}get _texte(){return TEXTE_BUSCH_UNRAID_PARITY_CARD;}
 _modell(core,config){const s=unraidServer(core,config);const z=unraidZustand(s);if(z)return z;const lauf=s.wert('parity_running'),laeuft=lauf?.state==='on',fortschritt=unraidNum(s.wert('parity_progress'));
  // parity_running nicht verfügbar → Zustand unbekannt (nicht grün „Keine Prüfung aktiv“).
  const unbekannt=!lauf||!buschUnraidAvailable(lauf);
  return {name:s.server.name_by_user||s.server.name,serverId:s.server.id,buttons:unraidServerButtons(s,['parity_start','parity_pause','parity_resume','parity_cancel']),phase:unbekannt?'unknown':['idle','running','paused','other','unknown'].includes(lauf?.attributes?.state)?lauf.attributes.state:null,vorhanden:s.geraete('Parity disk').length>0||laeuft||fortschritt!==null||(!!lauf&&unbekannt),laeuft,unbekannt,fortschritt,fehler_anzahl:unraidNum(s.wert('parity_errors'))};}
 _kompakt(m,t){if(m.laedt||m.fehler)return {};const lang=this._hass?.locale?.language;if(!m.vorhanden)return {state:null,progress:null,errors:null};
  return {state:unraidKw(m.phase?t[m.phase]:m.unbekannt?t.unknown:m.laeuft?t.running:t.idle,m.phase==='paused'||m.phase==='other'||m.laeuft?'warning':m.unbekannt||m.phase==='unknown'?'unknown':'ok'),progress:m.laeuft||m.phase==='paused'?unraidKw(unraidZahl(m.fortschritt,'%',lang,1)):null,errors:unraidKw(unraidZahl(m.fehler_anzahl,'',lang))};}
 _kopf(m,t){return {icon:'mdi:shield-check-outline',titel:t.tile,untertitel:m.vorhanden===undefined?undefined:m.vorhanden?(m.phase?t[m.phase]:m.unbekannt?t.unknown:m.laeuft?t.running:t.idle):m.name};}
 _inhalt(body,m,t){if(!this._inhaltSichtbar())return;const lang=this._hass?.locale?.language;if(!m.vorhanden){body.appendChild(buschUnraidNode('p',t.none,'message'));return;}
  if(!m.phase)body.appendChild(buschUnraidNode('p',t.upgrade,'message'));if(this._zeigt('state'))body.appendChild(unraidPunkt(m.phase==='paused'||m.phase==='other'||m.laeuft?'warning':m.unbekannt||m.phase==='unknown'?'unknown':'ok',m.phase?t[m.phase]:m.unbekannt?t.unknown:m.laeuft?t.running:t.idle));
  if(this._zeigt('progress')&&(m.laeuft||m.phase==='paused'))body.appendChild(unraidBalken(m.fortschritt,`${t.progress} ${unraidZahl(m.fortschritt,'%',lang,1)}`,{warnung:101,kritisch:101}));
  if(this._zeigt('errors'))body.appendChild(unraidTabelle([{key:'k',label:''},{key:'v',label:''}],[{k:t.errors,v:unraidZahl(m.fehler_anzahl,'',lang)}],{leer:''}));}
 _aktionen(m,t){return unraidServerAktionen(this,m,t);}
 static getConfigElement(){return document.createElement('busch-unraid-parity-card-editor');}
 static getStubConfig(){return {type:'custom:busch-unraid-parity-card'};}
}
class BuschUnraidParityCardEditor extends BuschUnraidTileEditor{get _schema(){return SCHEMA_BUSCH_UNRAID_PARITY_CARD;}get _texte(){return TEXTE_BUSCH_UNRAID_PARITY_CARD;}get _defaults(){return new BuschUnraidParityCard()._vorgaben;}}
// Airflow: Lüfter `fan_<key>_rpm` (FAN_RPM) und optional `fan_<key>_percent` (FAN_PERCENT, nur mit PWM-Steuerung).
// Die Attribute (_fan_attributes: chip/channel/pwm/pwm_mode) tragen kein label; der Name kommt wie bei der System-Karte
// aus friendly_name ohne Gerätenamen („Lüfter FAN 6 Drehzahl“), sonst Kanal. Lüfter mit 0 U/min legt unraid_ssh
// deaktiviert an — die fehlen ohnehin; `hide_idle` blendet aktivierte mit genau 0 U/min aus (nicht verfügbare bleiben sichtbar).
const SCHEMA_BUSCH_UNRAID_AIRFLOW_CARD=[{name:'device_id',selector:{device:{filter:[{integration:'unraid_ssh',model:'Unraid'}]}}},{name:'title',selector:{text:{}}},{name:'visible_items',selector:{select:{multiple:true,mode:'list',options:[]}}},{name:'collapsed_items',selector:{select:{multiple:true,mode:'list',options:[]}}},{name:'hide_idle',selector:{boolean:{}}}];
const TEXTE_BUSCH_UNRAID_AIRFLOW_CARD={de:{...UNRAID_TILE_TEXTE.de,name:'Unraid: Airflow',description:'Lüfter des Servers mit Drehzahl und Stufe.',labels:{device_id:'Server',title:'Titel',hide_idle:'Stehende Lüfter ausblenden',visible_items:'Angezeigt',collapsed_items:'Eingeklappt anzeigen'},helpers:{device_id:'Unraid-Server, dessen Daten die Karte zeigt. Leer: der einzige Server.',title:'Überschrift der Karte. Leer: Name der Kachel.',hide_idle:'Blendet Lüfter mit 0 U/min aus. Vorgabe aus.',visible_items:'Abschnitte, die ausgeklappt sichtbar sind. Vorgabe: alle wie bisher.',collapsed_items:'Kennzahlen in einer Zeile unter dem Kopf, wenn die Karte eingeklappt ist. Vorgabe: keine.'},anzeige:{summary:'Anzahl',fans:'Lüfter'},kurz:{summary:'Lüfter'},tile:'Airflow',count_one:'{count} Lüfter',count_many:'{count} Lüfter',none:'Keine Lüfter gefunden.',rpm:'U/min'},
 en:{...UNRAID_TILE_TEXTE.en,name:'Unraid: Airflow',description:'Server fans with speed and level.',labels:{device_id:'Server',title:'Title',hide_idle:'Hide idle fans',visible_items:'Shown',collapsed_items:'Shown when collapsed'},helpers:{device_id:'Unraid server whose data the card shows. Empty: the only server.',title:'Heading of the card. Empty: the tile name.',hide_idle:'Hides fans at 0 RPM. Default off.',visible_items:'Sections shown when expanded. Default: all, as before.',collapsed_items:'Values shown in one line below the header while collapsed. Default: none.'},anzeige:{summary:'Count',fans:'Fans'},kurz:{summary:'Fans'},tile:'Airflow',count_one:'{count} fan',count_many:'{count} fans',none:'No fans found.',rpm:'RPM'}};
class BuschUnraidAirflowCard extends BuschUnraidTile{
 static get kachel(){return 'airflow';}get _texte(){return TEXTE_BUSCH_UNRAID_AIRFLOW_CARD;}get _vorgaben(){return {device_id:'',title:'',hide_idle:false};}
 _modell(core,config){const s=unraidServer(core,config);const z=unraidZustand(s);if(z)return z;const geraet=s.server.name_by_user||s.server.name||'';
  const fans=unraidEindeutig(s.alle('fan_').filter(x=>x.suffix.endsWith('_rpm')).map(({suffix,entity})=>{const basis=suffix.slice(0,-4),a=entity.attributes||{};return {name:unraidOhneGeraet(geraet,a.friendly_name)||a.channel||basis,chip:a.chip,rpm:unraidNum(entity),prozent:unraidNum(s.wert(basis+'_percent'))};}));
  return {name:geraet,fans:fans.filter(f=>!config.hide_idle||f.rpm!==0)};}
 _kompakt(m){if(m.laedt||m.fehler)return {};return {summary:unraidKw(m.fans?unraidZahl(m.fans.length,'',this._hass?.locale?.language):null)};}
 _kopf(m,t){return {icon:'mdi:fan',titel:t.tile,untertitel:m.fans&&this._zeigt('summary')?(m.fans.length===1?t.count_one:t.count_many).replace('{count}',m.fans.length):m.name};}
 _inhalt(body,m,t){if(!this._inhaltSichtbar())return;const lang=this._hass?.locale?.language;if(!m.fans.length){body.appendChild(buschUnraidNode('p',t.none,'message'));return;}
  if(this._zeigt('fans'))body.appendChild(unraidRaster(m.fans.map(f=>({name:f.name,wert:unraidZahl(f.rpm,t.rpm,lang)+(f.prozent===null?'':` · ${unraidZahl(f.prozent,'%',lang)}`)}))));}
 static getConfigElement(){return document.createElement('busch-unraid-airflow-card-editor');}
 static getStubConfig(){return {type:'custom:busch-unraid-airflow-card'};}
}
class BuschUnraidAirflowCardEditor extends BuschUnraidTileEditor{get _schema(){return SCHEMA_BUSCH_UNRAID_AIRFLOW_CARD;}get _texte(){return TEXTE_BUSCH_UNRAID_AIRFLOW_CARD;}get _defaults(){return new BuschUnraidAirflowCard()._vorgaben;}}
// Bytes als Binärgröße (B … TiB). unraid_ssh liefert die VM-RAM-Werte nativ in Bytes (DATA_SIZE); hat der Nutzer in HA
// eine andere Anzeigeeinheit gewählt, rechnet unraidInBytes über unit_of_measurement zurück.
const UNRAID_BYTE_FAKTOR={B:1,kB:1e3,KB:1e3,KiB:1024,MB:1e6,MiB:1024**2,GB:1e9,GiB:1024**3,TB:1e12,TiB:1024**4,PB:1e15,PiB:1024**5};
function unraidInBytes(e){const n=unraidNum(e);if(n===null)return null;const f=UNRAID_BYTE_FAKTOR[e?.attributes?.unit_of_measurement||'B'];return f?n*f:null;}
function unraidBytes(b,lang){if(typeof b!=='number'||!Number.isFinite(b))return '–';const e=['B','KiB','MiB','GiB','TiB','PiB'];let i=0;while(b>=1024&&i<e.length-1){b/=1024;i++;}return unraidZahl(b,e[i],lang,b<10&&i?1:0);}
// Shares: Gerät „Unraid share“ je Share, Sensoren share_used_<name>/share_free_<name>; Einheit wie in HA angezeigt (unit_of_measurement, Vorgabe GB).
const SCHEMA_BUSCH_UNRAID_SHARES_CARD=[{name:'device_id',selector:{device:{filter:[{integration:'unraid_ssh',model:'Unraid'}]}}},{name:'title',selector:{text:{}}},{name:'visible_items',selector:{select:{multiple:true,mode:'list',options:[]}}},{name:'collapsed_items',selector:{select:{multiple:true,mode:'list',options:[]}}}];
const TEXTE_BUSCH_UNRAID_SHARES_CARD={de:{...UNRAID_TILE_TEXTE.de,name:'Unraid: Shares',description:'Shares mit belegtem und freiem Speicher.',labels:{device_id:'Server',title:'Titel',visible_items:'Angezeigt',collapsed_items:'Eingeklappt anzeigen'},helpers:{device_id:'Unraid-Server, dessen Daten die Karte zeigt. Leer: der einzige Server.',title:'Überschrift der Karte. Leer: Name der Kachel.',visible_items:'Abschnitte, die ausgeklappt sichtbar sind. Vorgabe: alle wie bisher.',collapsed_items:'Kennzahlen in einer Zeile unter dem Kopf, wenn die Karte eingeklappt ist. Vorgabe: keine.'},anzeige:{summary:'Anzahl',shares:'Sharetabelle',share_details:'Sicherheit und Streams'},kurz:{summary:'Shares'},tile:'Shares',count_one:'{count} Share',count_many:'{count} Shares',col_name:'Name',col_used:'Belegt',col_free:'Frei',none:'Keine Shares gefunden.'},
 en:{...UNRAID_TILE_TEXTE.en,name:'Unraid: Shares',description:'Shares with used and free space.',labels:{device_id:'Server',title:'Title',visible_items:'Shown',collapsed_items:'Shown when collapsed'},helpers:{device_id:'Unraid server whose data the card shows. Empty: the only server.',title:'Heading of the card. Empty: the tile name.',visible_items:'Sections shown when expanded. Default: all, as before.',collapsed_items:'Values shown in one line below the header while collapsed. Default: none.'},anzeige:{summary:'Count',shares:'Share table',share_details:'Security and streams'},kurz:{summary:'Shares'},tile:'Shares',count_one:'{count} share',count_many:'{count} shares',col_name:'Name',col_used:'Used',col_free:'Free',none:'No shares found.'}};
class BuschUnraidSharesCard extends BuschUnraidTile{
 static get kachel(){return 'shares';}get _texte(){return TEXTE_BUSCH_UNRAID_SHARES_CARD;}
 _modell(core,config){const s=unraidServer(core,config);const z=unraidZustand(s);if(z)return z;
  return {dashboard:unraidDashboard(s,'shares'),name:s.server.name_by_user||s.server.name,shares:s.geraete('Unraid share').map(d=>{const u=s.von(d,'share_used_'+d.roh),f=s.von(d,'share_free_'+d.roh);return {name:d.roh,used:unraidNum(u),usedUnit:u?.attributes?.unit_of_measurement||'',free:unraidNum(f),freeUnit:f?.attributes?.unit_of_measurement||''};})};}
 _kompakt(m){if(m.laedt||m.fehler)return {};return {summary:unraidKw(m.shares?unraidZahl(m.shares.length,'',this._hass?.locale?.language):null)};}
 _kopf(m,t){const n=m.shares?.length;return {icon:'mdi:folder-network-outline',titel:t.tile,untertitel:m.shares&&this._zeigt('summary')?(n===1?t.count_one:t.count_many).replace('{count}',n):m.name};}
 _inhalt(body,m,t){if(!this._inhaltSichtbar())return;const lang=this._hass?.locale?.language,meta=unraidListe(m.dashboard.daten,'shares'),details=this._zeigt('share_details');unraidZusatzHinweis(body,[m.dashboard],t);if(!this._zeigt('shares'))return;body.appendChild(unraidTabelle([{key:'n',label:t.col_name},{key:'u',label:t.col_used},{key:'f',label:t.col_free},...(m.dashboard.zustand==='legacy'||!details?[]:[{key:'security',label:t.security},{key:'exported',label:t.exported},{key:'streams',label:t.streams}])],m.shares.map(x=>{const q=meta.find(q=>q.name===x.name);return {n:x.name,u:unraidZahl(x.used,x.usedUnit,lang,1),f:unraidZahl(x.free,x.freeUnit,lang,1),security:t[q?.security]||t.unknown,exported:q?.exported===true?t.yes:q?.exported===false?t.no:t.unknown,streams:unraidZahl(q?.streams,'',lang)};}),{leer:t.none}));if(details)body.appendChild(buschUnraidNode('p',t.streams_help,'detail'));}
 static getConfigElement(){return document.createElement('busch-unraid-shares-card-editor');}
 static getStubConfig(){return {type:'custom:busch-unraid-shares-card'};}
}
class BuschUnraidSharesCardEditor extends BuschUnraidTileEditor{get _schema(){return SCHEMA_BUSCH_UNRAID_SHARES_CARD;}get _texte(){return TEXTE_BUSCH_UNRAID_SHARES_CARD;}get _defaults(){return new BuschUnraidSharesCard()._vorgaben;}}
// VM-Nutzung: Gerät „Virtual machine“ mit Gerätename = VM-Name; Suffixe enthalten den Namen samt Leerzeichen (vm_state_Windows 11).
// Gezeigt werden nur VMs im Zustand `running` (VM_STATES von unraid_ssh). vm_ram_used gibt es nur mit frischen Balloon-Werten, sonst –.
const SCHEMA_BUSCH_UNRAID_VM_USAGE_CARD=[{name:'device_id',selector:{device:{filter:[{integration:'unraid_ssh',model:'Unraid'}]}}},{name:'title',selector:{text:{}}},{name:'visible_items',selector:{select:{multiple:true,mode:'list',options:[]}}},{name:'collapsed_items',selector:{select:{multiple:true,mode:'list',options:[]}}}];
const TEXTE_BUSCH_UNRAID_VM_USAGE_CARD={de:{...UNRAID_TILE_TEXTE.de,name:'Unraid: VM-Nutzung',description:'CPU und RAM laufender virtueller Maschinen.',labels:{device_id:'Server',title:'Titel',visible_items:'Angezeigt',collapsed_items:'Eingeklappt anzeigen'},helpers:{device_id:'Unraid-Server, dessen Daten die Karte zeigt. Leer: der einzige Server.',title:'Überschrift der Karte. Leer: Name der Kachel.',visible_items:'Abschnitte, die ausgeklappt sichtbar sind. Vorgabe: alle wie bisher.',collapsed_items:'Kennzahlen in einer Zeile unter dem Kopf, wenn die Karte eingeklappt ist. Vorgabe: keine.'},anzeige:{summary:'Anzahl',cpu:'Gast-CPU',ram:'RAM',host_cpu:'Host-CPU',io:'Netz und Datenträger'},kurz:{summary:'Laufende VMs'},tile:'VM-Nutzung',cpu:'Gast-CPU',ram:'RAM',running_one:'{count} VM läuft',running_many:'{count} VMs laufen',none:'Keine laufenden VMs.'},
 en:{...UNRAID_TILE_TEXTE.en,name:'Unraid: VM usage',description:'CPU and RAM of running virtual machines.',labels:{device_id:'Server',title:'Title',visible_items:'Shown',collapsed_items:'Shown when collapsed'},helpers:{device_id:'Unraid server whose data the card shows. Empty: the only server.',title:'Heading of the card. Empty: the tile name.',visible_items:'Sections shown when expanded. Default: all, as before.',collapsed_items:'Values shown in one line below the header while collapsed. Default: none.'},anzeige:{summary:'Count',cpu:'Guest CPU',ram:'RAM',host_cpu:'Host CPU',io:'Network and disk'},kurz:{summary:'Running VMs'},tile:'VM usage',cpu:'Guest CPU',ram:'RAM',running_one:'{count} VM running',running_many:'{count} VMs running',none:'No running virtual machines.'}};
class BuschUnraidVmUsageCard extends BuschUnraidTile{
 static get kachel(){return 'vm-usage';}get _texte(){return TEXTE_BUSCH_UNRAID_VM_USAGE_CARD;}
 _modell(core,config){const s=unraidServer(core,config);const z=unraidZustand(s);if(z)return z;
  const alle=s.geraete('Virtual machine').map(d=>{const n=d.roh;return {name:n,state:s.von(d,'vm_state_'+n)?.state,cpu:unraidNum(s.von(d,'vm_cpu_'+n)),used:unraidInBytes(s.von(d,'vm_ram_used_'+n)),alloc:unraidInBytes(s.von(d,'vm_ram_allocated_'+n))};});
  // VM-Zustand nicht verfügbar → eigener Hinweis statt „Keine laufenden VMs“.
  return {dashboard:unraidDashboard(s,'vms'),name:s.server.name_by_user||s.server.name,vms:alle.filter(v=>v.state==='running'),unbekannt:alle.filter(v=>!v.state||['unavailable','unknown'].includes(v.state)).map(v=>v.name)};}
 _kompakt(m){if(m.laedt||m.fehler)return {};return {summary:unraidKw(m.vms?unraidZahl(m.vms.length,'',this._hass?.locale?.language):null)};}
 _kopf(m,t){const n=m.vms?.length;return {icon:'mdi:monitor-dashboard',titel:t.tile,untertitel:n&&this._zeigt('summary')?(n===1?t.running_one:t.running_many).replace('{count}',n):m.name};}
 _inhalt(body,m,t){if(!this._inhaltSichtbar())return;const lang=this._hass?.locale?.language,unbekannt=m.unbekannt||[];unraidZusatzHinweis(body,[m.dashboard],t);if(!m.vms.length){body.appendChild(buschUnraidNode('p',unbekannt.length?t.unavailable:t.none,'message'));return;}
  if(unbekannt.length)body.appendChild(buschUnraidNode('p',`${t.unavailable}: ${unbekannt.join(', ')}`,'message'));
  // Die Überschrift je VM bleibt, solange irgendein Abschnitt je VM sichtbar ist.
  const jeVm=['cpu','ram','host_cpu','io'].some(id=>this._zeigt(id));if(jeVm)for(const v of m.vms){const meta=unraidListe(m.dashboard.daten,'vms').find(x=>x.name===v.name);body.appendChild(buschUnraidNode('h3',v.name,'section'));if(this._zeigt('cpu'))body.appendChild(unraidBalken(v.cpu,`${t.cpu} ${unraidZahl(v.cpu,'%',lang)}`));if(this._zeigt('ram'))body.appendChild(buschUnraidNode('p',`${t.ram}: ${unraidBytes(v.used,lang)} / ${unraidBytes(v.alloc,lang)}`,'detail'));if(this._zeigt('host_cpu'))body.appendChild(unraidBalken(meta?.host_cpu_percent??null,`${t.host_cpu} ${unraidZahl(meta?.host_cpu_percent,'%',lang,1)}`));if(this._zeigt('io'))body.appendChild(unraidRaster([['net_rx','net_rx_bytes_s'],['net_tx','net_tx_bytes_s'],['disk_read','disk_read_bytes_s'],['disk_write','disk_write_bytes_s']].map(([label,key])=>({name:t[label],wert:unraidRate(meta?.[key],lang)}))));}}
 static getConfigElement(){return document.createElement('busch-unraid-vm-usage-card-editor');}
 static getStubConfig(){return {type:'custom:busch-unraid-vm-usage-card'};}
}
class BuschUnraidVmUsageCardEditor extends BuschUnraidTileEditor{get _schema(){return SCHEMA_BUSCH_UNRAID_VM_USAGE_CARD;}get _texte(){return TEXTE_BUSCH_UNRAID_VM_USAGE_CARD;}get _defaults(){return new BuschUnraidVmUsageCard()._vorgaben;}}
// Interfaces stay separate: overlapping physical/bond/bridge links are never summed.
const SCHEMA_BUSCH_UNRAID_INTERFACE_CARD=[{name:'device_id',selector:{device:{filter:[{integration:'unraid_ssh',model:'Unraid'}]}}},{name:'title',selector:{text:{}}},{name:'visible_items',selector:{select:{multiple:true,mode:'list',options:[]}}},{name:'collapsed_items',selector:{select:{multiple:true,mode:'list',options:[]}}},{name:'show_virtual',selector:{boolean:{}}}];
const TEXTE_BUSCH_UNRAID_INTERFACE_CARD={de:{...UNRAID_TILE_TEXTE.de,name:'Unraid: Interfaces',description:'Netzwerkinterfaces mit Zustand, Empfang, Senden und Linkgeschwindigkeit.',labels:{device_id:'Server',title:'Titel',show_virtual:'Virtuelle Interfaces zeigen',visible_items:'Angezeigt',collapsed_items:'Eingeklappt anzeigen'},helpers:{device_id:'Unraid-Server, dessen Daten die Karte zeigt. Leer: der einzige Server.',title:'Überschrift der Karte. Leer: Name der Kachel.',show_virtual:'Zeigt auch Bond-, Bridge-, VLAN- und weitere virtuelle Interfaces getrennt. Vorgabe an.',visible_items:'Abschnitte, die ausgeklappt sichtbar sind. Vorgabe: alle wie bisher.',collapsed_items:'Kennzahlen in einer Zeile unter dem Kopf, wenn die Karte eingeklappt ist. Vorgabe: keine.'},anzeige:{state:'Zustand',kind:'Typ',rx:'Empfang',tx:'Senden',speed:'Linkgeschwindigkeit',mtu:'MTU'},kurz:{},tile:'Interfaces',none:'Keine Interfaces gefunden.',col_name:'Name',col_state:'Zustand',col_rx:'Empfang',col_tx:'Senden',col_speed:'Linkgeschwindigkeit',col_kind:'Typ',mtu:'MTU',physical:'Physisch',bond:'Bond',bridge:'Bridge',vlan:'VLAN',virtual:'Virtuell',up:'Verbunden',down:'Nicht verbunden',lowerlayerdown:'Unterliegender Link getrennt',dormant:'Wartet',notpresent:'Nicht vorhanden',testing:'Testbetrieb',speed_unit:'Mbit/s'},
 en:{...UNRAID_TILE_TEXTE.en,name:'Unraid: Interfaces',description:'Network interfaces with state, receive, transmit and link speed.',labels:{device_id:'Server',title:'Title',show_virtual:'Show virtual interfaces',visible_items:'Shown',collapsed_items:'Shown when collapsed'},helpers:{device_id:'Unraid server whose data the card shows. Empty: the only server.',title:'Heading of the card. Empty: the tile name.',show_virtual:'Shows bond, bridge, VLAN and other virtual interfaces separately. Default on.',visible_items:'Sections shown when expanded. Default: all, as before.',collapsed_items:'Values shown in one line below the header while collapsed. Default: none.'},anzeige:{state:'State',kind:'Type',rx:'Receive',tx:'Transmit',speed:'Link speed',mtu:'MTU'},kurz:{},tile:'Interfaces',none:'No interfaces found.',col_name:'Name',col_state:'State',col_rx:'Receive',col_tx:'Transmit',col_speed:'Link speed',col_kind:'Type',mtu:'MTU',physical:'Physical',bond:'Bond',bridge:'Bridge',vlan:'VLAN',virtual:'Virtual',up:'Connected',down:'Disconnected',lowerlayerdown:'Lower link disconnected',dormant:'Dormant',notpresent:'Not present',testing:'Testing',speed_unit:'Mbit/s'}};
class BuschUnraidInterfaceCard extends BuschUnraidTile{
 static get kachel(){return 'interface';}get _texte(){return TEXTE_BUSCH_UNRAID_INTERFACE_CARD;}get _vorgaben(){return {device_id:'',title:'',show_virtual:true};}
 _modell(core,config){const s=unraidServer(core,config),z=unraidZustand(s);if(z)return z;const dashboard=unraidDashboard(s,'interfaces'),interfaces=dashboard.daten.interfaces;
  return {name:s.server.name_by_user||s.server.name,dashboard,bekannt:Array.isArray(interfaces),interfaces:unraidListe(dashboard.daten,'interfaces').filter(x=>config.show_virtual||x.kind==='physical').sort((a,b)=>String(a.name).localeCompare(String(b.name),undefined,{numeric:true}))};}
 _kopf(m,t){return {icon:'mdi:ethernet',titel:t.tile,untertitel:m.name};}
 _inhalt(body,m,t){if(!this._inhaltSichtbar())return;const lang=this._hass?.locale?.language;unraidZusatzHinweis(body,[m.dashboard],t);if(!m.bekannt){if(m.dashboard.zustand==='ok')body.appendChild(buschUnraidNode('p',t.telemetry_unavailable,'message'));return;}
  body.appendChild(unraidTabelle([{key:'name',label:t.col_name},...[{key:'state',label:t.col_state},{key:'kind',label:t.col_kind},{key:'rx',label:t.col_rx},{key:'tx',label:t.col_tx},{key:'speed',label:t.col_speed},{key:'mtu',label:t.mtu}].filter(s=>this._zeigt(s.key))],m.interfaces.map(x=>({name:x.name,state:t[String(x.state).toLowerCase()]||t.unknown,kind:t[x.kind]||t.unknown,rx:unraidRate(x.rx_bytes_s,lang),tx:unraidRate(x.tx_bytes_s,lang),speed:unraidZahl(x.speed_mbps,t.speed_unit,lang),mtu:unraidZahl(x.mtu,'',lang)})),{leer:t.none}));}
 static getConfigElement(){return document.createElement('busch-unraid-interface-card-editor');}
 static getStubConfig(){return {type:'custom:busch-unraid-interface-card'};}
}
class BuschUnraidInterfaceCardEditor extends BuschUnraidTileEditor{get _schema(){return SCHEMA_BUSCH_UNRAID_INTERFACE_CARD;}get _texte(){return TEXTE_BUSCH_UNRAID_INTERFACE_CARD;}get _defaults(){return new BuschUnraidInterfaceCard()._vorgaben;}}
/* Only the new inventory tables reserve balanced columns. The existing
 * <=420px stacked rules remain untouched, including all labels and values. */
const UNRAID_INVENTAR_SPALTEN_STYLE=`
@container (min-width:421px){
.table.inventory-users,.table.inventory-usb,.table.inventory-coral{table-layout:fixed}
.table.inventory-users th:nth-child(1){width:27%}.table.inventory-users th:nth-child(2){width:37%}.table.inventory-users th:nth-child(3){width:20%}.table.inventory-users th:nth-child(4){width:16%}
.table.inventory-usb th:nth-child(1){width:15%}.table.inventory-usb th:nth-child(2){width:31%}.table.inventory-usb th:nth-child(3){width:27%}.table.inventory-usb th:nth-child(4){width:27%}
.table.inventory-coral th:nth-child(1){width:35%}.table.inventory-coral th:nth-child(2){width:38%}.table.inventory-coral th:nth-child(3){width:27%}
}`;
function unraidInventarTabelle(body,typ,spalten,zeilen,optionen){
 const table=unraidTabelle(spalten,zeilen,optionen);
 if(zeilen.length){table.className+=' inventory-'+typ;const style=document.createElement('style');style.textContent=UNRAID_INVENTAR_SPALTEN_STYLE;body.appendChild(style);}
 body.appendChild(table);
}
/* Stage 3 inventory uses numeric count states (including 0), not ok/partial. */
function unraidInventar(server,key){
 const e=server.wert('dashboard_'+key);if(!e)return {zustand:'legacy',daten:{},liste:null,count:null};
 const a=e.attributes||{};if(a.schema_version!==1)return {zustand:'legacy',daten:{},liste:null,count:null};
 const count=unraidNum(e),liste=a[key==='users'?'users':'devices'];
 if(count===null||count<0||!Number.isInteger(count)||!Array.isArray(liste)||!Array.isArray(a.failed_sections))return {zustand:'unavailable',daten:{},liste:null,count:null};
 return {zustand:a.failed_sections.length?'partial':'ok',daten:a,liste:liste.filter(x=>x&&typeof x==='object'),count};
}
function unraidInventarModell(core,config,key){const s=unraidServer(core,config),z=unraidZustand(s);return z||{name:s.server.name_by_user||s.server.name,inventory:unraidInventar(s,key)};}
function unraidInventarHinweis(body,m,t){const q=m.inventory;if(q.zustand==='legacy')body.appendChild(buschUnraidNode('p',t.inventory_upgrade,'message'));else if(q.zustand==='unavailable')body.appendChild(buschUnraidNode('p',t.inventory_unavailable,'message'));else if(q.zustand==='partial')body.appendChild(buschUnraidNode('p',t.inventory_partial,'message'));return q.liste!==null;}
const UNRAID_INVENTAR_TEXTE={de:{inventory_upgrade:'Unraid SSH auf Version 0.10.0 oder neuer aktualisieren, um diese Inventardaten anzuzeigen.',inventory_unavailable:'Daten nicht verfügbar. Verbindung und Quellen der Unraid-SSH-Integration prüfen.',inventory_partial:'Daten teilweise verfügbar. Fehlende Quellen in der Unraid-SSH-Integration prüfen.',unknown:'Unbekannt',inventory_empty_partial:'Keine Einträge in der verfügbaren Teilquelle; das Inventar ist unvollständig.'},en:{inventory_upgrade:'Update Unraid SSH to version 0.10.0 or newer to show this inventory.',inventory_unavailable:'Data unavailable. Check the connection and sources of the Unraid SSH integration.',inventory_partial:'Data partially available. Check missing sources in the Unraid SSH integration.',unknown:'Unknown',inventory_empty_partial:'No entries in the available partial source; the inventory is incomplete.'}};
const SCHEMA_BUSCH_UNRAID_USERS_CARD=[{name:'device_id',selector:{device:{filter:[{integration:'unraid_ssh',model:'Unraid'}]}}},{name:'title',selector:{text:{}}},{name:'visible_items',selector:{select:{multiple:true,mode:'list',options:[]}}},{name:'collapsed_items',selector:{select:{multiple:true,mode:'list',options:[]}}}];
const TEXTE_BUSCH_UNRAID_USERS_CARD={de:{...UNRAID_TILE_TEXTE.de,...UNRAID_INVENTAR_TEXTE.de,name:'Unraid: Benutzer',description:'Benutzer und ihre SMB-Shareberechtigungen auf einem Unraid-Server.',labels:{device_id:'Server',title:'Titel',visible_items:'Angezeigt',collapsed_items:'Eingeklappt anzeigen'},helpers:{device_id:'Unraid-Server, dessen Benutzer die Karte zeigt. Vorgabe: der einzige Server.',title:'Überschrift der Karte. Vorgabe: Benutzer.',visible_items:'Abschnitte, die ausgeklappt sichtbar sind. Vorgabe: alle wie bisher.',collapsed_items:'Kennzahlen in einer Zeile unter dem Kopf, wenn die Karte eingeklappt ist. Vorgabe: keine.'},anzeige:{summary:'Anzahl',permission_help:'Berechtigungshinweis',users:'Benutzertabelle',description:'Beschreibung'},kurz:{summary:'Benutzer'},tile:'Benutzer',count:'Benutzer',unprotected:'ohne gesetztes Kennwort',password_missing:'Kennwort fehlt',password_set:'Kennwort gesetzt',smb_disabled:'SMB deaktiviert',smb_unknown:'SMB-Status unbekannt',permission_help:'Anzahl SMB-Shares mit dieser Berechtigung',col_user:'Benutzer',col_description:'Beschreibung',col_write:'Schreiben',col_read:'Lesen',none:'Keine Benutzer gefunden'},en:{...UNRAID_TILE_TEXTE.en,...UNRAID_INVENTAR_TEXTE.en,name:'Unraid: Users',description:'Users and their SMB share permissions on an Unraid server.',labels:{device_id:'Server',title:'Title',visible_items:'Shown',collapsed_items:'Shown when collapsed'},helpers:{device_id:'Unraid server whose users the card shows. Default: the only server.',title:'Heading of the card. Default: Users.',visible_items:'Sections shown when expanded. Default: all, as before.',collapsed_items:'Values shown in one line below the header while collapsed. Default: none.'},anzeige:{summary:'Count',permission_help:'Permission note',users:'User table',description:'Description'},kurz:{summary:'Users'},tile:'Users',count:'users',unprotected:'without a password',password_missing:'Password missing',password_set:'Password set',smb_disabled:'SMB disabled',smb_unknown:'SMB status unknown',permission_help:'Number of SMB shares with this permission',col_user:'User',col_description:'Description',col_write:'Write',col_read:'Read',none:'No users found'}};
class BuschUnraidUsersCard extends BuschUnraidTile{
 static get kachel(){return 'users';}get _texte(){return TEXTE_BUSCH_UNRAID_USERS_CARD;}
 _modell(core,config){return unraidInventarModell(core,config,'users');}
 _kompakt(m,t){if(m.laedt||m.fehler)return {};const q=m.inventory,lang=this._hass?.locale?.language,ohne=unraidZahl(q?.daten?.unprotected_count,'',lang);return {summary:unraidKw(q?.liste!==null&&q?.count!=null?(ohne==='–'?unraidZahl(q.count,'',lang):`${unraidZahl(q.count,'',lang)} (${ohne} ${t.unprotected})`):null)};}
 _kopf(m,t){const q=m.inventory;return {icon:'mdi:account-group',titel:t.tile,untertitel:[m.name,this._zeigt('summary')&&q?.liste!==null&&q?.count!=null?`${q.count} ${t.count} · ${unraidZahl(q.daten.unprotected_count,'',this._hass?.locale?.language)} ${t.unprotected}`:null].filter(Boolean).join(' · ')};}
 _inhalt(body,m,t){if(!this._inhaltSichtbar()||!unraidInventarHinweis(body,m,t))return;const q=m.inventory,lang=this._hass?.locale?.language;
  if(q.daten.smb_enabled!==true)body.appendChild(buschUnraidNode('p',q.daten.smb_enabled===false?t.smb_disabled:t.smb_unknown,'message'));
  if(this._zeigt('permission_help'))body.appendChild(buschUnraidNode('p',t.permission_help,'message'));if(!this._zeigt('users'))return;
  const rows=[...q.liste].sort((a,b)=>String(a.name).localeCompare(String(b.name),undefined,{numeric:true})).map(x=>{const user=buschUnraidNode('div');user.appendChild(buschUnraidNode('span',x.name));user.appendChild(buschUnraidNode('p',x.protected===false?t.password_missing:x.protected===true?t.password_set:t.unknown,'message'));const allowed=q.daten.smb_enabled===true&&x.name!=='root';return {user,description:x.description,write:unraidZahl(allowed?x.write_shares:null,'',lang),read:unraidZahl(allowed?x.read_shares:null,'',lang)};});
  unraidInventarTabelle(body,'users',[{key:'user',label:t.col_user},...(this._zeigt('description')?[{key:'description',label:t.col_description}]:[]),{key:'write',label:t.col_write},{key:'read',label:t.col_read}],rows,{leer:q.zustand==='partial'?t.inventory_empty_partial:t.none});}
 static getConfigElement(){return document.createElement('busch-unraid-users-card-editor');}static getStubConfig(){return {type:'custom:busch-unraid-users-card'};}
}
class BuschUnraidUsersCardEditor extends BuschUnraidTileEditor{get _schema(){return SCHEMA_BUSCH_UNRAID_USERS_CARD;}get _texte(){return TEXTE_BUSCH_UNRAID_USERS_CARD;}get _defaults(){return new BuschUnraidUsersCard()._vorgaben;}}
const SCHEMA_BUSCH_UNRAID_USB_CARD=[{name:'device_id',selector:{device:{filter:[{integration:'unraid_ssh',model:'Unraid'}]}}},{name:'title',selector:{text:{}}},{name:'visible_items',selector:{select:{multiple:true,mode:'list',options:[]}}},{name:'collapsed_items',selector:{select:{multiple:true,mode:'list',options:[]}}},{name:'show_hubs',selector:{boolean:{}}}];
const TEXTE_BUSCH_UNRAID_USB_CARD={de:{...UNRAID_TILE_TEXTE.de,...UNRAID_INVENTAR_TEXTE.de,name:'Unraid: USB-Geräte',description:'Erkannte USB-Geräte und belegte VM- oder Remotezuordnungen eines Unraid-Servers.',labels:{device_id:'Server',title:'Titel',show_hubs:'USB-Hubs zeigen',visible_items:'Angezeigt',collapsed_items:'Eingeklappt anzeigen'},helpers:{device_id:'Unraid-Server für das Inventar. Per VFIO durchgereichte Controller sind am Host nicht sichtbar. Vorgabe: der einzige Server.',title:'Überschrift der Karte. Vorgabe: USB-Geräte.',show_hubs:'Zeigt auch USB-Hubs im Inventar. Vorgabe an.',visible_items:'Abschnitte, die ausgeklappt sichtbar sind. Vorgabe: alle wie bisher.',collapsed_items:'Kennzahlen in einer Zeile unter dem Kopf, wenn die Karte eingeklappt ist. Vorgabe: keine.'},anzeige:{summary:'Anzahl',limits:'Hinweis zu Grenzen',devices:'Gerätetabelle'},kurz:{summary:'USB'},tile:'USB-Geräte',count:'erkannte Geräte',col_port:'Port',col_name:'Name',col_state:'Zustand',col_assignment:'VM/Remote',host:'Am Host erkannt',vm:'Mit VM verbunden',remote:'Remote verbunden',usbip_bound:'An USB/IP gebunden',unauthorized:'Nicht autorisiert',remote_unknown:'Remotezuordnung unbekannt',vm_unknown:'VM-Zuordnung unbekannt',mapping_missing:'Zuordnung teilweise oder nicht verfügbar. Nur belegte Verbindungen werden angezeigt.',limits:'Am Host erkannt bedeutet keine freie Verfügbarkeit. Geräte hinter VFIO-Controllern sind hier nicht sichtbar.',speed_unit:'Mbit/s',none:'Keine USB-Geräte gefunden',filtered_empty:'Keine USB-Geräte mit diesem Filter'},en:{...UNRAID_TILE_TEXTE.en,...UNRAID_INVENTAR_TEXTE.en,name:'Unraid: USB devices',description:'Detected USB devices and evidenced VM or remote assignments on an Unraid server.',labels:{device_id:'Server',title:'Title',show_hubs:'Show USB hubs',visible_items:'Shown',collapsed_items:'Shown when collapsed'},helpers:{device_id:'Unraid server for the inventory. Controllers passed through via VFIO are invisible to the host. Default: the only server.',title:'Heading of the card. Default: USB devices.',show_hubs:'Includes USB hubs in the inventory. Default on.',visible_items:'Sections shown when expanded. Default: all, as before.',collapsed_items:'Values shown in one line below the header while collapsed. Default: none.'},anzeige:{summary:'Count',limits:'Limits note',devices:'Device table'},kurz:{summary:'USB'},tile:'USB devices',count:'detected devices',col_port:'Port',col_name:'Name',col_state:'State',col_assignment:'VM/Remote',host:'Detected on host',vm:'Connected to VM',remote:'Connected remotely',usbip_bound:'Bound to USB/IP',unauthorized:'Unauthorized',remote_unknown:'Remote assignment unknown',vm_unknown:'VM assignment unknown',mapping_missing:'Assignment partially or fully unavailable. Only evidenced connections are shown.',limits:'Detected on host does not mean available for assignment. Devices behind VFIO controllers are invisible here.',speed_unit:'Mbit/s',none:'No USB devices found',filtered_empty:'No USB devices match this filter'}};
class BuschUnraidUsbCard extends BuschUnraidTile{
 static get kachel(){return 'usb';}get _texte(){return TEXTE_BUSCH_UNRAID_USB_CARD;}get _vorgaben(){return {device_id:'',title:'',show_hubs:true};}
 _modell(core,config){return unraidInventarModell(core,config,'usb');}
 _kompakt(m){if(m.laedt||m.fehler)return {};const q=m.inventory;return {summary:unraidKw(q?.liste!==null&&q?.count!=null?unraidZahl(q.count,'',this._hass?.locale?.language):null)};}
 _kopf(m,t){return {icon:'mdi:usb',titel:t.tile,untertitel:[m.name,this._zeigt('summary')&&m.inventory?.count!=null?`${m.inventory.count} ${t.count}`:null].filter(Boolean).join(' · ')};}
 _inhalt(body,m,t){if(!this._inhaltSichtbar()||!unraidInventarHinweis(body,m,t))return;const q=m.inventory,lang=this._hass?.locale?.language;if(this._zeigt('limits'))body.appendChild(buschUnraidNode('p',t.limits,'message'));if(q.daten.mapping_status!=='ok')body.appendChild(buschUnraidNode('p',t.mapping_missing,'message'));if(!this._zeigt('devices'))return;
  const rows=q.liste.filter(x=>this._config.show_hubs||!x.is_hub).sort((a,b)=>String(a.port).localeCompare(String(b.port),undefined,{numeric:true})).map(x=>{const name=buschUnraidNode('div');name.appendChild(buschUnraidNode('span',x.name));if(typeof x.speed_mbps==='number'&&Number.isFinite(x.speed_mbps))name.appendChild(buschUnraidNode('p',unraidZahl(x.speed_mbps,t.speed_unit,lang),'message'));return {port:x.port,name,state:['host','vm','remote','usbip_bound','unauthorized'].includes(x.state)?t[x.state]:t.unknown,assignment:x.state==='vm'?x.assigned_vm||t.vm_unknown:x.state==='remote'?x.remote_host||t.remote_unknown:'–'};});
  unraidInventarTabelle(body,'usb',[{key:'port',label:t.col_port},{key:'name',label:t.col_name},{key:'state',label:t.col_state},{key:'assignment',label:t.col_assignment}],rows,{leer:q.liste.length?t.filtered_empty:q.zustand==='partial'?t.inventory_empty_partial:t.none});}
 static getConfigElement(){return document.createElement('busch-unraid-usb-card-editor');}static getStubConfig(){return {type:'custom:busch-unraid-usb-card'};}
}
class BuschUnraidUsbCardEditor extends BuschUnraidTileEditor{get _schema(){return SCHEMA_BUSCH_UNRAID_USB_CARD;}get _texte(){return TEXTE_BUSCH_UNRAID_USB_CARD;}get _defaults(){return new BuschUnraidUsbCard()._vorgaben;}}
const SCHEMA_BUSCH_UNRAID_CORAL_CARD=[{name:'device_id',selector:{device:{filter:[{integration:'unraid_ssh',model:'Unraid'}]}}},{name:'title',selector:{text:{}}},{name:'visible_items',selector:{select:{multiple:true,mode:'list',options:[]}}},{name:'collapsed_items',selector:{select:{multiple:true,mode:'list',options:[]}}}];
const TEXTE_BUSCH_UNRAID_CORAL_CARD={de:{...UNRAID_TILE_TEXTE.de,...UNRAID_INVENTAR_TEXTE.de,name:'Unraid: Coral TPU',description:'Coral-TPUs mit PCI-Status und Temperatur sowie erkannten USB-Geräten.',labels:{device_id:'Server',title:'Titel',visible_items:'Angezeigt',collapsed_items:'Eingeklappt anzeigen'},helpers:{device_id:'Unraid-Server, dessen Coral-TPUs die Karte zeigt. Vorgabe: der einzige Server.',title:'Überschrift der Karte. Vorgabe: Coral TPU.',visible_items:'Abschnitte, die ausgeklappt sichtbar sind. Vorgabe: alle wie bisher.',collapsed_items:'Kennzahlen in einer Zeile unter dem Kopf, wenn die Karte eingeklappt ist. Vorgabe: keine.'},anzeige:{summary:'Anzahl',tpus:'TPU-Tabelle'},kurz:{summary:'TPUs'},tile:'Coral TPU',count:'TPUs',col_name:'Gerät',col_state:'Zustand',col_temp:'Temperatur',ready:'Bereit',error:'Fehler',temperature_missing:'Nicht verfügbar',usb_notice:'USB erkannt, Status/Temperatur nicht verfügbar',none:'Keine Coral TPU gefunden'},en:{...UNRAID_TILE_TEXTE.en,...UNRAID_INVENTAR_TEXTE.en,name:'Unraid: Coral TPU',description:'Coral TPUs with PCI status and temperature, including detected USB devices.',labels:{device_id:'Server',title:'Title',visible_items:'Shown',collapsed_items:'Shown when collapsed'},helpers:{device_id:'Unraid server whose Coral TPUs the card shows. Default: the only server.',title:'Heading of the card. Default: Coral TPU.',visible_items:'Sections shown when expanded. Default: all, as before.',collapsed_items:'Values shown in one line below the header while collapsed. Default: none.'},anzeige:{summary:'Count',tpus:'TPU table'},kurz:{summary:'TPUs'},tile:'Coral TPU',count:'TPUs',col_name:'Device',col_state:'State',col_temp:'Temperature',ready:'Ready',error:'Error',temperature_missing:'Unavailable',usb_notice:'USB detected; status/temperature unavailable',none:'No Coral TPU found'}};
class BuschUnraidCoralCard extends BuschUnraidTile{
 static get kachel(){return 'coral';}get _texte(){return TEXTE_BUSCH_UNRAID_CORAL_CARD;}
 _modell(core,config){return unraidInventarModell(core,config,'coral');}
 _kompakt(m){if(m.laedt||m.fehler)return {};const q=m.inventory;return {summary:unraidKw(q?.liste!==null&&q?.count!=null?unraidZahl(q.count,'',this._hass?.locale?.language):null)};}
 _kopf(m,t){return {icon:'mdi:chip',titel:t.tile,untertitel:[m.name,this._zeigt('summary')&&m.inventory?.count!=null?`${m.inventory.count} ${t.count}`:null].filter(Boolean).join(' · ')};}
 _inhalt(body,m,t){if(!this._inhaltSichtbar()||!unraidInventarHinweis(body,m,t))return;if(!this._zeigt('tpus'))return;const lang=this._hass?.locale?.language,rows=[...m.inventory.liste].sort((a,b)=>String(a.name).localeCompare(String(b.name),undefined,{numeric:true})).map(x=>{const usb=x.transport==='usb',temp=x.temperature_c;return {name:x.name,state:usb?t.usb_notice:['ready','error'].includes(x.state)?t[x.state]:t.unknown,temp:!usb&&typeof temp==='number'&&Number.isFinite(temp)&&temp>-50&&temp<=150?unraidZahl(temp,'°C',lang,1):t.temperature_missing};});unraidInventarTabelle(body,'coral',[{key:'name',label:t.col_name},{key:'state',label:t.col_state},{key:'temp',label:t.col_temp}],rows,{leer:m.inventory.zustand==='partial'?t.inventory_empty_partial:t.none});}
 static getConfigElement(){return document.createElement('busch-unraid-coral-card-editor');}static getStubConfig(){return {type:'custom:busch-unraid-coral-card'};}
}
class BuschUnraidCoralCardEditor extends BuschUnraidTileEditor{get _schema(){return SCHEMA_BUSCH_UNRAID_CORAL_CARD;}get _texte(){return TEXTE_BUSCH_UNRAID_CORAL_CARD;}get _defaults(){return new BuschUnraidCoralCard()._vorgaben;}}

// [tag, Karte, Editor] — für den Vertragstest; registriert wird wörtlich je Kachel (Regelprüfer findet nur das).
const UNRAID_KACHELN=[['busch-unraid-users-card',BuschUnraidUsersCard,BuschUnraidUsersCardEditor],['busch-unraid-usb-card',BuschUnraidUsbCard,BuschUnraidUsbCardEditor],['busch-unraid-coral-card',BuschUnraidCoralCard,BuschUnraidCoralCardEditor],['busch-unraid-interface-card',BuschUnraidInterfaceCard,BuschUnraidInterfaceCardEditor],['busch-unraid-server-card',BuschUnraidServerCard,BuschUnraidServerCardEditor],['busch-unraid-system-card',BuschUnraidSystemCard,BuschUnraidSystemCardEditor],['busch-unraid-cpu-card',BuschUnraidCpuCard,BuschUnraidCpuCardEditor],['busch-unraid-gpu-card',BuschUnraidGpuCard,BuschUnraidGpuCardEditor],['busch-unraid-array-card',BuschUnraidArrayCard,BuschUnraidArrayCardEditor],['busch-unraid-parity-card',BuschUnraidParityCard,BuschUnraidParityCardEditor],['busch-unraid-airflow-card',BuschUnraidAirflowCard,BuschUnraidAirflowCardEditor],['busch-unraid-shares-card',BuschUnraidSharesCard,BuschUnraidSharesCardEditor],['busch-unraid-vm-usage-card',BuschUnraidVmUsageCard,BuschUnraidVmUsageCardEditor]];
if(!customElements.get?.('busch-unraid-server-card'))customElements.define('busch-unraid-server-card',BuschUnraidServerCard);
if(!customElements.get?.('busch-unraid-server-card-editor'))customElements.define('busch-unraid-server-card-editor',BuschUnraidServerCardEditor);
window.customCards=window.customCards||[];
if(!window.customCards.some(c=>c.type==='busch-unraid-server-card'))window.customCards.push({type:'busch-unraid-server-card',name:buschTexte(TEXTE_BUSCH_UNRAID_SERVER_CARD).name,description:buschTexte(TEXTE_BUSCH_UNRAID_SERVER_CARD).description,preview:true,documentationURL:'https://github.com/luukkii123/ha-unraid-cards#busch-unraid-server-card'});
if(!customElements.get?.('busch-unraid-system-card'))customElements.define('busch-unraid-system-card',BuschUnraidSystemCard);
if(!customElements.get?.('busch-unraid-system-card-editor'))customElements.define('busch-unraid-system-card-editor',BuschUnraidSystemCardEditor);
if(!window.customCards.some(c=>c.type==='busch-unraid-system-card'))window.customCards.push({type:'busch-unraid-system-card',name:buschTexte(TEXTE_BUSCH_UNRAID_SYSTEM_CARD).name,description:buschTexte(TEXTE_BUSCH_UNRAID_SYSTEM_CARD).description,preview:true,documentationURL:'https://github.com/luukkii123/ha-unraid-cards#busch-unraid-system-card'});
if(!customElements.get?.('busch-unraid-cpu-card'))customElements.define('busch-unraid-cpu-card',BuschUnraidCpuCard);
if(!customElements.get?.('busch-unraid-cpu-card-editor'))customElements.define('busch-unraid-cpu-card-editor',BuschUnraidCpuCardEditor);
if(!window.customCards.some(c=>c.type==='busch-unraid-cpu-card'))window.customCards.push({type:'busch-unraid-cpu-card',name:buschTexte(TEXTE_BUSCH_UNRAID_CPU_CARD).name,description:buschTexte(TEXTE_BUSCH_UNRAID_CPU_CARD).description,preview:true,documentationURL:'https://github.com/luukkii123/ha-unraid-cards#busch-unraid-cpu-card'});
if(!customElements.get?.('busch-unraid-gpu-card'))customElements.define('busch-unraid-gpu-card',BuschUnraidGpuCard);
if(!customElements.get?.('busch-unraid-gpu-card-editor'))customElements.define('busch-unraid-gpu-card-editor',BuschUnraidGpuCardEditor);
if(!window.customCards.some(c=>c.type==='busch-unraid-gpu-card'))window.customCards.push({type:'busch-unraid-gpu-card',name:buschTexte(TEXTE_BUSCH_UNRAID_GPU_CARD).name,description:buschTexte(TEXTE_BUSCH_UNRAID_GPU_CARD).description,preview:true,documentationURL:'https://github.com/luukkii123/ha-unraid-cards#busch-unraid-gpu-card'});
if(!customElements.get?.('busch-unraid-array-card'))customElements.define('busch-unraid-array-card',BuschUnraidArrayCard);
if(!customElements.get?.('busch-unraid-array-card-editor'))customElements.define('busch-unraid-array-card-editor',BuschUnraidArrayCardEditor);
if(!window.customCards.some(c=>c.type==='busch-unraid-array-card'))window.customCards.push({type:'busch-unraid-array-card',name:buschTexte(TEXTE_BUSCH_UNRAID_ARRAY_CARD).name,description:buschTexte(TEXTE_BUSCH_UNRAID_ARRAY_CARD).description,preview:true,documentationURL:'https://github.com/luukkii123/ha-unraid-cards#busch-unraid-array-card'});
if(!customElements.get?.('busch-unraid-parity-card'))customElements.define('busch-unraid-parity-card',BuschUnraidParityCard);
if(!customElements.get?.('busch-unraid-parity-card-editor'))customElements.define('busch-unraid-parity-card-editor',BuschUnraidParityCardEditor);
if(!window.customCards.some(c=>c.type==='busch-unraid-parity-card'))window.customCards.push({type:'busch-unraid-parity-card',name:buschTexte(TEXTE_BUSCH_UNRAID_PARITY_CARD).name,description:buschTexte(TEXTE_BUSCH_UNRAID_PARITY_CARD).description,preview:true,documentationURL:'https://github.com/luukkii123/ha-unraid-cards#busch-unraid-parity-card'});
if(!customElements.get?.('busch-unraid-airflow-card'))customElements.define('busch-unraid-airflow-card',BuschUnraidAirflowCard);
if(!customElements.get?.('busch-unraid-airflow-card-editor'))customElements.define('busch-unraid-airflow-card-editor',BuschUnraidAirflowCardEditor);
if(!window.customCards.some(c=>c.type==='busch-unraid-airflow-card'))window.customCards.push({type:'busch-unraid-airflow-card',name:buschTexte(TEXTE_BUSCH_UNRAID_AIRFLOW_CARD).name,description:buschTexte(TEXTE_BUSCH_UNRAID_AIRFLOW_CARD).description,preview:true,documentationURL:'https://github.com/luukkii123/ha-unraid-cards#busch-unraid-airflow-card'});
if(!customElements.get?.('busch-unraid-shares-card'))customElements.define('busch-unraid-shares-card',BuschUnraidSharesCard);
if(!customElements.get?.('busch-unraid-shares-card-editor'))customElements.define('busch-unraid-shares-card-editor',BuschUnraidSharesCardEditor);
if(!window.customCards.some(c=>c.type==='busch-unraid-shares-card'))window.customCards.push({type:'busch-unraid-shares-card',name:buschTexte(TEXTE_BUSCH_UNRAID_SHARES_CARD).name,description:buschTexte(TEXTE_BUSCH_UNRAID_SHARES_CARD).description,preview:true,documentationURL:'https://github.com/luukkii123/ha-unraid-cards#busch-unraid-shares-card'});
if(!customElements.get?.('busch-unraid-vm-usage-card'))customElements.define('busch-unraid-vm-usage-card',BuschUnraidVmUsageCard);
if(!customElements.get?.('busch-unraid-vm-usage-card-editor'))customElements.define('busch-unraid-vm-usage-card-editor',BuschUnraidVmUsageCardEditor);
if(!window.customCards.some(c=>c.type==='busch-unraid-vm-usage-card'))window.customCards.push({type:'busch-unraid-vm-usage-card',name:buschTexte(TEXTE_BUSCH_UNRAID_VM_USAGE_CARD).name,description:buschTexte(TEXTE_BUSCH_UNRAID_VM_USAGE_CARD).description,preview:true,documentationURL:'https://github.com/luukkii123/ha-unraid-cards#busch-unraid-vm-usage-card'});

if(!customElements.get?.('busch-unraid-interface-card'))customElements.define('busch-unraid-interface-card',BuschUnraidInterfaceCard);
if(!customElements.get?.('busch-unraid-interface-card-editor'))customElements.define('busch-unraid-interface-card-editor',BuschUnraidInterfaceCardEditor);
if(!window.customCards.some(c=>c.type==='busch-unraid-interface-card'))window.customCards.push({type:'busch-unraid-interface-card',name:buschTexte(TEXTE_BUSCH_UNRAID_INTERFACE_CARD).name,description:buschTexte(TEXTE_BUSCH_UNRAID_INTERFACE_CARD).description,preview:true,documentationURL:'https://github.com/luukkii123/ha-unraid-cards#busch-unraid-interface-card'});

if(!customElements.get?.('busch-unraid-users-card'))customElements.define('busch-unraid-users-card',BuschUnraidUsersCard);
if(!customElements.get?.('busch-unraid-users-card-editor'))customElements.define('busch-unraid-users-card-editor',BuschUnraidUsersCardEditor);
if(!window.customCards.some(c=>c.type==='busch-unraid-users-card'))window.customCards.push({type:'busch-unraid-users-card',name:buschTexte(TEXTE_BUSCH_UNRAID_USERS_CARD).name,description:buschTexte(TEXTE_BUSCH_UNRAID_USERS_CARD).description,preview:true,documentationURL:'https://github.com/luukkii123/ha-unraid-cards#busch-unraid-users-card'});

if(!customElements.get?.('busch-unraid-usb-card'))customElements.define('busch-unraid-usb-card',BuschUnraidUsbCard);
if(!customElements.get?.('busch-unraid-usb-card-editor'))customElements.define('busch-unraid-usb-card-editor',BuschUnraidUsbCardEditor);
if(!window.customCards.some(c=>c.type==='busch-unraid-usb-card'))window.customCards.push({type:'busch-unraid-usb-card',name:buschTexte(TEXTE_BUSCH_UNRAID_USB_CARD).name,description:buschTexte(TEXTE_BUSCH_UNRAID_USB_CARD).description,preview:true,documentationURL:'https://github.com/luukkii123/ha-unraid-cards#busch-unraid-usb-card'});

if(!customElements.get?.('busch-unraid-coral-card'))customElements.define('busch-unraid-coral-card',BuschUnraidCoralCard);
if(!customElements.get?.('busch-unraid-coral-card-editor'))customElements.define('busch-unraid-coral-card-editor',BuschUnraidCoralCardEditor);
if(!window.customCards.some(c=>c.type==='busch-unraid-coral-card'))window.customCards.push({type:'busch-unraid-coral-card',name:buschTexte(TEXTE_BUSCH_UNRAID_CORAL_CARD).name,description:buschTexte(TEXTE_BUSCH_UNRAID_CORAL_CARD).description,preview:true,documentationURL:'https://github.com/luukkii123/ha-unraid-cards#busch-unraid-coral-card'});
