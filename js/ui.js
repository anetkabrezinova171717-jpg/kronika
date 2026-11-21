// Drobné UI stavebnice: escapování, ikony, bottom sheet, formuláře, toast
import { BOOL } from './api.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const escBr = s => esc(s).replace(/\n/g, '<br>');
export const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const sample = (a, k) => shuffle(a).slice(0, k);
export const pad2 = n => String(n).padStart(2, '0');

export function fmtDate(s) {
  if (!s) return '';
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${+m[3]}. ${+m[2]}. ${m[1]}` : String(s);
}
export function initials(name) {
  return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

// Ručně kreslené podtržení pod slovem
export const scribble = (word, color = 'var(--hl)') =>
  `<span class="scribble" style="--hl:${color}">${word}<svg viewBox="0 0 200 22" preserveAspectRatio="none" aria-hidden="true"><path d="M4 15 C 40 6, 90 4, 130 9 S 185 14, 196 8"/></svg></span>`;

const svg = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
export const ICON = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>',
  video: svg('<rect x="2.5" y="5" width="14" height="14" rx="3"/><path d="m16.5 10 5-3v10l-5-3"/>'),
  book: svg('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>'),
  image: svg('<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>'),
  users: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17.5" cy="9" r="2.5"/><path d="M16.5 14.2A5 5 0 0 1 21.5 19"/>'),
  game: svg('<rect x="2.5" y="7" width="19" height="11" rx="5.5"/><path d="M7.5 10.5v4M5.5 12.5h4"/><circle cx="15.5" cy="11.5" r=".6" fill="currentColor"/><circle cx="17.5" cy="13.8" r=".6" fill="currentColor"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>', 'stroke-width="2.6"'),
  x: svg('<path d="M6 6l12 12M18 6 6 18"/>', 'stroke-width="2.4"'),
  edit: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>'),
  pin: svg('<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
  right: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  left: svg('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
  cam: svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  trophy: svg('<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H4a3 3 0 0 0 4 4M16 6h4a3 3 0 0 1-4 4M12 13v4M8 21h8M9 17h6"/>'),
  lock: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  eyeOff: svg('<path d="M3 3l18 18M10.6 6.2A9.8 9.8 0 0 1 12 6c5.5 0 9 6 9 6a15 15 0 0 1-3.2 3.8M6.4 7.6C4 9.2 3 12 3 12s3.5 6 9 6a9 9 0 0 0 3.6-.8"/>'),
  shuffle: svg('<path d="M16 4h4v4M4 20 20 4M20 16v4h-4M15 15l5 5M4 4l5 5"/>'),
  download: svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
  clip: `<svg class="clip" viewBox="0 0 30 64" aria-hidden="true"><path d="M10 52V14a6 6 0 0 1 12 0v40a9 9 0 0 1-18 0V20" fill="none" stroke="#9AA3B5" stroke-width="3.2" stroke-linecap="round"/></svg>`,
};

// ---------- toast ----------
export function toast(msg, type = '') {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'show ' + type;
  clearTimeout(t._t);
  t._t = setTimeout(() => (t.className = ''), type === 'err' ? 4200 : 2600);
}

// ---------- bottom sheet ----------
export function openSheet(html, { onClose, cls = '' } = {}) {
  const root = $('#sheet-root');
  if (root._onClose) { const cb = root._onClose; root._onClose = null; cb(); }
  root.innerHTML = `<div class="sheet-bd"></div><div class="sheet ${cls}" role="dialog" aria-modal="true"><div class="sheet-grip"></div><button class="sheet-x" aria-label="Zavřít">${ICON.x}</button><div class="sheet-body">${html}</div></div>`;
  document.body.classList.add('noscroll');
  root.classList.remove('open');
  void root.offsetWidth; // vynutí vykreslení výchozího stavu → animace vyjetí
  root.classList.add('open');
  root.querySelector('.sheet-bd').onclick = closeSheet;
  root.querySelector('.sheet-x').onclick = closeSheet;
  root._onClose = onClose || null;
  return root.querySelector('.sheet-body');
}
export function closeSheet() {
  const root = $('#sheet-root');
  if (!root || !root.innerHTML) return;
  root.classList.remove('open');
  document.body.classList.remove('noscroll');
  const cb = root._onClose; root._onClose = null;
  const html = root.innerHTML;
  setTimeout(() => { if (!root.classList.contains('open') && root.innerHTML === html) root.innerHTML = ''; }, 320);
  cb && cb();
}
export const sheetOpen = () => $('#sheet-root')?.classList.contains('open');

// ---------- formuláře ----------
// field: { k, label, type: text|textarea|number|select|check|people|file|html, options, ph, help, rows }
export function formHTML(fields, v = {}) {
  return fields.map(f => {
    const val = v[f.k] ?? f.def ?? '';
    const id = 'f_' + f.k;
    let input;
    switch (f.type) {
      case 'html': return `<div class="field">${f.html}</div>`;
      case 'textarea': input = `<textarea id="${id}" name="${f.k}" rows="${f.rows || 4}" placeholder="${esc(f.ph || '')}">${esc(val)}</textarea>`; break;
      case 'select': input = `<select id="${id}" name="${f.k}">${f.options.map(o => `<option value="${esc(o.v)}" ${String(o.v) === String(val) ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select>`; break;
      case 'check': input = `<label class="check"><input type="checkbox" name="${f.k}" ${BOOL(val) ? 'checked' : ''}><span>${esc(f.text || f.label)}</span></label>`; break;
      case 'people': {
        const sel = new Set(String(val).split(',').map(s => s.trim()));
        input = f.options.length
          ? `<div class="pick" data-name="${f.k}">${f.options.map(o => `<label class="pick-i"><input type="checkbox" value="${esc(o.v)}" ${sel.has(String(o.v)) ? 'checked' : ''}><span>${esc(o.l)}</span></label>`).join('')}</div>`
          : `<small>Nejdřív přidej spolužáky v sekci Spolužáci.</small>`;
        break;
      }
      case 'file': input = `<input id="${id}" type="file" name="${f.k}" accept="image/*">`; break;
      default: input = `<input id="${id}" type="${f.type || 'text'}" name="${f.k}" value="${esc(val)}" placeholder="${esc(f.ph || '')}" ${f.type === 'number' ? 'inputmode="numeric"' : ''} ${f.max ? `maxlength="${f.max}"` : ''}>`;
    }
    const label = f.type === 'check' ? '' : `<label for="${id}">${esc(f.label)}${f.opt ? ' <em>(nepovinné)</em>' : ''}</label>`;
    return `<div class="field">${label}${input}${f.help ? `<small>${esc(f.help)}</small>` : ''}</div>`;
  }).join('');
}
export function readForm(form, fields) {
  const o = {};
  for (const f of fields) {
    if (f.type === 'html') continue;
    if (f.type === 'check') o[f.k] = form.querySelector(`[name="${f.k}"]`).checked;
    else if (f.type === 'people') o[f.k] = $$(`[data-name="${f.k}"] input:checked`, form).map(i => i.value).join(',');
    else if (f.type === 'file') o[f.k] = form.querySelector(`[name="${f.k}"]`).files[0] || null;
    else o[f.k] = form.querySelector(`[name="${f.k}"]`).value.trim();
  }
  return o;
}
export function openForm({ title, intro = '', fields, values = {}, submitLabel = 'Uložit', onSubmit, onDelete, deleteText, mount }) {
  const body = openSheet(`<h2 class="sheet-title">${esc(title)}</h2>${intro}<form class="form" novalidate>${formHTML(fields, values)}
    <div class="form-actions"><button class="btn btn-ink" type="submit">${esc(submitLabel)}</button>${onDelete ? `<button type="button" class="btn btn-danger" data-del>Smazat</button>` : ''}</div></form>`);
  const form = body.querySelector('form');
  form.onsubmit = async e => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true; btn.textContent = 'Ukládám…';
    try { await onSubmit(readForm(form, fields)); closeSheet(); toast('Uloženo ✓'); }
    catch (err) { toast(err.message || 'Chyba', 'err'); btn.disabled = false; btn.textContent = submitLabel; }
  };
  if (onDelete) form.querySelector('[data-del]').onclick = async () => {
    if (!confirm(deleteText || 'Opravdu smazat? Tuto akci nelze vrátit.')) return;
    try { await onDelete(); closeSheet(); toast('Smazáno'); } catch (err) { toast(err.message, 'err'); }
  };
  mount && mount(form);
  return body;
}
