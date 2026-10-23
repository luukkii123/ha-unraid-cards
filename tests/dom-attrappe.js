'use strict';
// Gemeinsame DOM-Element-Attrappe für die Karten-Tests (ohne Browser).
// Selektoren: Tagname (`button`, `td`), Klasse (`.x`, `.x:pseudo`) und
// Attribut (`[data-focus-key="x"]`, wirkt auf `dataset` und Attribute).
class Element {
  constructor(tag = 'div') { this.tagName = String(tag).toUpperCase(); this.childNodes = []; this.listeners = {}; this.attributes = {}; this.dataset = {}; this.style = {}; this.className = ''; this.title = ''; this._text = ''; this.isConnected = false; }
  attachShadow() { this.shadowRoot = new Element('#shadow'); return this.shadowRoot; }
  set textContent(v) { this._text = String(v); this.childNodes = []; }
  get textContent() { return this._text + this.childNodes.map((n) => n.textContent).join(''); }
  appendChild(n) { n.parentNode = this; this.childNodes.push(n); return n; }
  append(...n) { for (const x of n) this.appendChild(x); }
  replaceChildren(...n) { for (const c of this.childNodes) c.parentNode = null; this.childNodes = []; this.append(...n); }
  remove() { if (this.parentNode) this.parentNode.childNodes = this.parentNode.childNodes.filter((c) => c !== this); this.parentNode = null; }
  setAttribute(k, v) { this.attributes[k] = String(v); if (k === 'class') this.className = String(v); }
  getAttribute(k) { return this.attributes[k] ?? null; }
  removeAttribute(k) { delete this.attributes[k]; }
  toggleAttribute(k, on) { if (on) this.attributes[k] = ''; else delete this.attributes[k]; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  removeEventListener() {}
  dispatchEvent(e) { this.event = e; (this.events ||= []).push(e); }
  // Fokus wie im Browser: deaktivierte Knöpfe nehmen keinen Fokus an; die
  // Wurzel (Shadow-Root) merkt sich das aktive Element, solange es im Baum hängt.
  focus() { if (this.disabled) return; this.focused = true; let wurzel = this; while (wurzel.parentNode) wurzel = wurzel.parentNode; wurzel._aktiv = this; }
  blur() { this.focused = false; let wurzel = this; while (wurzel.parentNode) wurzel = wurzel.parentNode; if (wurzel._aktiv === this) wurzel._aktiv = null; }
  get activeElement() { return this._aktiv && this.all().includes(this._aktiv) ? this._aktiv : null; }
  getBoundingClientRect() { return { left: 10, top: 10, right: 110, bottom: 74, width: 100, height: 64 }; }
  all() { return [this, ...this.childNodes.flatMap((c) => c.all())]; }
  matches(sel) {
    const attr = sel.match(/^\[([\w-]+)(?:="([^"]*)")?\]$/);
    if (attr) {
      const key = attr[1], data = key.startsWith('data-') ? key.slice(5).replace(/-(\w)/g, (_, c) => c.toUpperCase()) : null;
      const value = data && this.dataset[data] !== undefined ? this.dataset[data] : this.attributes[key];
      return value !== undefined && (attr[2] === undefined || String(value) === attr[2]);
    }
    if (/^[a-z][\w-]*$/.test(sel)) return this.tagName === sel.toUpperCase();
    const cls = sel.replace(/^\./, '').split(':')[0];
    return String(this.className).split(/\s+/).includes(cls);
  }
  querySelectorAll(sel) { return this.all().slice(1).filter((n) => n.matches(sel)); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  click() { for (const fn of this.listeners.click || []) fn({ stopPropagation() {} }); }
}

/** Ein `document` mit `createElement`/`createElementNS` auf die Attrappe. */
function dokument(registered) {
  const body = new Element('body');
  const createElement = (tag) => { if (!registered || !registered.has(tag)) return new Element(tag); const n = new (registered.get(tag))(); n.tagName = tag.toUpperCase(); return n; };
  return { createElement, createElementNS: (_ns, tag) => new Element(tag), body, querySelectorAll: (sel) => body.all().filter((n) => n.tagName === sel.toUpperCase()) };
}

module.exports = { Element, dokument };
