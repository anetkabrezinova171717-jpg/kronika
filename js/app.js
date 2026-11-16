// Jádro: router, navigace, animace, PWA, start
import { CONFIG } from './config.js';
import { S, COLORS, load, primeFromCache } from './store.js';
import { $, $$, esc, ICON, toast, sheetOpen } from './ui.js';
import { homeView, gradeView, albumView, classView, uploadView, openLightbox, openProfile, notFound } from './views.js';
import { gamesView, gameView } from './games.js';
import { adminView, handleAct } from './admin.js';
import { presentView } from './present.js';

// Když se fotka z Disku nenačte: Google při hodně fotkách z jednoho připojení
// (např. všichni na jedné wifi) vrací chybu 429. Pak fotky stáhne náš Apps Script
// po skupinách (8 fotek na dotaz, 4 dotazy naráz) a prohlížeč si je uloží, takže příště jsou hned.
const PROXY_CACHE = 'kronika-proxy-v1';
const pKey = (f, w) => `https://kronika.local/img/${f}/${w}`;
const proxyQ = []; let proxyRun = 0, proxyTimer = 0, batchOff = false, proxyOff = false;
const cacheGet = async (f, w) => { try { const r = await (await caches.open(PROXY_CACHE)).match(pKey(f, w)); return r ? await r.text() : null; } catch { return null; } };
const cachePut = async (f, w, d) => { try { await (await caches.open(PROXY_CACHE)).put(pKey(f, w), new Response(d)); } catch {} };
const proxyFetch = async (group, w) => {
  const url = CONFIG.API_URL;
  if (!batchOff) {
    const j = await (await fetch(`${url}?action=imgs&w=${w}&ids=${group.map(x => encodeURIComponent(x[1])).join(',')}`)).json();
    if (j.ok) return j.data || {};
    if (!/Neznámá akce/.test(j.error || '')) throw new Error(j.error);
    batchOff = true;   // starší verze skriptu – po jedné
  }
  const out = {};
  for (const [, f] of group) {
    const j = await (await fetch(`${url}?action=img&id=${encodeURIComponent(f)}&w=${w}`)).json();
    if (j.ok && j.data) out[f] = j.data;
    else if (/Neznámá akce/.test(j.error || '')) { proxyOff = true; break; }
  }
  return out;
};
const proxyNext = () => {
  clearTimeout(proxyTimer); proxyTimer = 0;
  while (proxyRun < 4 && proxyQ.length) {
    const w = proxyQ[0][2];
    const group = [];
    for (let k = 0; k < proxyQ.length && group.length < 8;) {
      if (proxyQ[k][2] === w && proxyQ[k][0].isConnected) group.push(proxyQ.splice(k, 1)[0]);
      else if (!proxyQ[k][0].isConnected) proxyQ.splice(k, 1);
      else k++;
    }
    if (!group.length) continue;
    proxyRun++;
    proxyFetch(group, w)
      .then(data => group.forEach(([img, f]) => { if (data[f]) { img.src = data[f]; cachePut(f, w, data[f]); } else retryLater(img); }))
      .catch(() => group.forEach(([img]) => retryLater(img)))
      .finally(() => { proxyRun--; proxyNext(); });
  }
};
const retryLater = img => {
  const f = img.dataset.fid, n = Number(img.dataset.fb || 0), w = img.dataset.w;
  if (n >= 7 || !img.isConnected) { img.classList.add('broken'); return; }
  img.dataset.fb = String(n + 1);
  const delay = [0, 0, 3000, 8000, 15000, 30000, 60000][n] + Math.random() * 3000;
  setTimeout(() => { if (img.isConnected) img.src = `https://lh3.googleusercontent.com/d/${f}=w${w}?r=${n}`; }, delay);
};
window.__imgErr = async img => {
  const f = img.dataset.fid;
  if (!f || !img.isConnected || String(img.src).startsWith('data:')) { img.classList.add('broken'); return; }
  const w = (img.dataset.w ||= (String(img.src).match(/[=&]s?z?=?w(\d+)/) || [])[1] || '800');
  const n = Number(img.dataset.fb || 0);
  if (n === 0 && CONFIG.API_URL && !proxyOff) {
    img.dataset.fb = '2';
    const hit = await cacheGet(f, w);
    if (hit) { img.src = hit; return; }
    proxyQ.push([img, f, w]);
    if (!proxyTimer) proxyTimer = setTimeout(proxyNext, 120);   // chvilku počkat a poslat víc fotek najednou
  } else retryLater(img);
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
  [/^\/promitani$/, () => presentView()],
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
