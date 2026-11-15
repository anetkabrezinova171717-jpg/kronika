// Jádro: router, navigace, animace, PWA, start
import { CONFIG } from './config.js';
import { S, COLORS, load, primeFromCache } from './store.js';
import { $, $$, esc, ICON, toast, sheetOpen } from './ui.js';
import { homeView, gradeView, albumView, classView, uploadView, openLightbox, openProfile, notFound } from './views.js';
import { gamesView, gameView } from './games.js';
import { adminView, handleAct } from './admin.js';

// Záložní URL, když se fotka z Disku nenačte
window.__imgErr = img => {
  const f = img.dataset.fid;
  if (f && !img.dataset.fb) { img.dataset.fb = '1'; img.src = `https://drive.google.com/thumbnail?id=${f}&sz=w1600`; }
  else img.classList.add('broken');
};

const routes = [
  [/^\/$/, (m, q) => homeView(q)],
  [/^\/rocnik\/(\d+)$/, (m, q) => gradeView(Number(m[1]), q)],
  [/^\/album$/, (m, q) => albumView(q)],
  [/^\/trida$/, () => classView()],
  [/^\/hry$/, () => gamesView()],
  [/^\/hry\/([a-z]+)$/, m => gameView(m[1])],
  [/^\/pridat$/, (m, q) => uploadView(q)],
  [/^\/admin$/, () => adminView()],
];
// Obrazovky, které se při načtení nových dat na pozadí nepřekreslují (rozepsaný formulář, hra)
const ACTIVE = /^\/(pridat|hry\/|admin)/;

const parse = () => {
  const h = location.hash.slice(1) || '/';
  const [path, qs] = h.split('?');
  return { path: path || '/', q: Object.fromEntries(new URLSearchParams(qs || '')) };
};

let lastPath = null;
function render({ keep = false } = {}) {
  const { path, q } = parse();
  let view = null;
  for (const [re, fn] of routes) { const m = path.match(re); if (m) { view = fn(m, q); break; } }
  view ||= notFound();
  const el = $('#view');
  const changed = path !== lastPath;
  const y = window.scrollY;
  el.innerHTML = view.html;
  if (changed) { el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter'); }
  setChrome(path, view.theme);
  view.mount && view.mount();
  observeReveal();
  if (changed && !q.e) window.scrollTo(0, 0); else if (keep) window.scrollTo(0, y);
  lastPath = path;
}
S.rerender = () => render({ keep: true });

function setChrome(path, theme) {
  const tab = path.startsWith('/album') || path.startsWith('/pridat') ? 'album' : path.startsWith('/trida') ? 'trida' : path.startsWith('/hry') ? 'hry' : path.startsWith('/admin') ? '' : 'kronika';
  $$('.tabbar a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
  const c = theme ? COLORS[theme] : null;
  const ctx = $('#ctx');
  ctx.innerHTML = c ? `<span class="ctx-chip" style="--g:${c.bg};--gi:${c.ink}">${theme}. třída</span>` : '';
  document.querySelector('meta[name=theme-color]').content = c ? c.bg : '#F3F7FB';
  $('#topbar').style.setProperty('--tb', c ? c.soft : 'rgba(243,247,251,.85)');
  $('#adm-badge').hidden = !S.admin;
}

let io;
function observeReveal() {
  const els = $$('.reveal:not(.in)');
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) { els.forEach(e => e.classList.add('in')); return; }
  io ||= new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  els.forEach(e => io.observe(e));
}

// Delegované kliky: fotky → prohlížeč, spolužáci → profil, admin tlačítka
document.addEventListener('click', e => {
  const act = e.target.closest('[data-act]');
  if (act) { e.preventDefault(); if (!handleAct(act.dataset.act, act.dataset.id)) toast('Jen pro administrátora'); return; }
  const cm = e.target.closest('[data-cm]');
  if (cm) { e.preventDefault(); openProfile(cm.dataset.cm); return; }
  const fig = e.target.closest('figure[data-photo]');
  if (fig && !e.target.closest('.lb')) {
    const scope = fig.closest('.sheet-body') || $('#view');
    const list = [...new Set($$('figure[data-photo]', scope).map(f => f.dataset.photo))];
    openLightbox(list, fig.dataset.photo);
  }
});

window.addEventListener('hashchange', () => render());

// ---------- start ----------
function shell() {
  document.title = CONFIG.APP_NAME;
  $('#app-name').textContent = CONFIG.APP_NAME;
  $('#app-class').textContent = CONFIG.CLASS_YEAR ? '’' + String(CONFIG.CLASS_YEAR).slice(-2) : CONFIG.CLASS_NAME;
  const tabs = [['kronika', '#/', ICON.book, 'Kronika'], ['album', '#/album', ICON.image, 'Fotoalbum'], ['trida', '#/trida', ICON.users, 'Naše třída'], ['hry', '#/hry', ICON.game, 'Hry']];
  $('.tabbar-in').innerHTML = tabs.map(([k, h, i, l]) => `<a href="${h}" data-tab="${k}">${i}<span>${l}</span></a>`).join('');
}

async function boot() {
  shell();
  const hadCache = primeFromCache();
  if (hadCache) render();
  else $('#view').innerHTML = `<div class="loading"><div class="loader"><span></span><span></span><span></span></div><p>Otevírám kroniku…</p></div>`;
  try {
    const changed = await load();
    if (!hadCache || (changed && !ACTIVE.test(parse().path) && !sheetOpen())) render({ keep: hadCache });
  } catch (err) {
    S.offline = true;
    if (!hadCache) $('#view').innerHTML = `<div class="empty" style="margin-top:40px"><b>Kroniku se nepodařilo načíst</b><p>${esc(err.message)}</p><button class="btn btn-ink" onclick="location.reload()">Zkusit znovu</button></div>`;
    else toast('Jsi offline – zobrazuji uloženou verzi');
  }
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
boot();
