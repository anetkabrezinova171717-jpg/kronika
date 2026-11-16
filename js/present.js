// PROMÍTÁNÍ – kronika rok po roku jako prezentace na celou obrazovku (na sraz, na projektor, na televizi)
import { CONFIG } from './config.js';
import { S, COLORS, gradeList, eventsOf, photosOfEvent, loosePhotos, imgSrc, vis, inShow } from './store.js';
import { $, $$, esc, fmtDate, pad2, ICON, shuffle } from './ui.js';

const LS_KEY = 'kronika-present';
const opts = (() => { try { return { from: 1, per: 6, speed: 6, ...JSON.parse(localStorage.getItem(LS_KEY) || '{}') }; } catch { return { from: 1, per: 6, speed: 6 }; } })();
const saveOpts = () => { try { localStorage.setItem(LS_KEY, JSON.stringify(opts)); } catch {} };

// Z velké akce vybereme jen pár fotek, rovnoměrně rozložených; přednost mají fotky s lidmi
function pick(ps, k) {
  const withPeople = ps.filter(p => p.faces == null || p.faces > 0);
  const pool = withPeople.length >= Math.min(k, ps.length) ? withPeople : ps;
  if (pool.length <= k) return pool;
  return Array.from({ length: k }, (_, i) => pool[Math.floor((i * pool.length) / k)]);
}

// Akce, které se do automatického promítání nehodí (školka, stránky časopisu, naskenované dokumenty)
const SKIP = /školka|termit|ze starého školního webu/i;
// Vybrala administrátorka fotky ručně (Admin → Promítání)? Pak se promítá jen výběr.
const manual = () => vis(S.db.photos).some(inShow);

function buildSlides() {
  const slides = [{ type: 'intro' }];
  const own = manual();
  const choose = (ps, k) => own ? ps.filter(inShow) : pick(ps, k);
  for (const g of gradeList()) {
    if (g.n < opts.from) continue;
    const evSlides = [];
    for (const ev of eventsOf(g.n)) {
      if (!own && SKIP.test(ev.title)) continue;
      const ps = choose(photosOfEvent(ev.id), opts.per);
      if (!ps.length) continue;
      evSlides.push({ type: 'event', g: g.n, ev, p: ps[0] });
      ps.forEach(p => evSlides.push({ type: 'photo', g: g.n, ev, p }));
    }
    const loose = choose(loosePhotos(g.n), Math.min(4, opts.per));
    loose.forEach(p => evSlides.push({ type: 'photo', g: g.n, p }));
    if (!evSlides.length) continue;
    slides.push({ type: 'grade', g: g.n }, ...evSlides);
  }
  slides.push({ type: 'outro' });
  return slides;
}

// Společná fotka (stejná jako na úvodu)
function classPhoto() {
  const evs = vis(S.db.events);
  for (const pat of CONFIG.HERO_EVENTS || []) {
    const e = evs.find(x => x.title.toLowerCase().includes(String(pat).toLowerCase()));
    const p = e && photosOfEvent(e.id)[0];
    if (p) return p;
  }
  return null;
}

const colorVars = n => { const c = COLORS[n] || COLORS[0]; return `--g:${c.bg};--gi:${c.ink}`; };
// Všechny fotky promítání v jedné velikosti (1280 px stačí na televizi i projektor) – stáhnou se dopředu a pak už jen naskočí.
const PW = 1280;
const ready = new Map();   // photo.id → src, který se opravdu načetl (Disk nebo data:URL ze skriptu)
const srcOf = p => ready.get(p.id) || imgSrc(p, PW);
const img = (p, w, cls = '') => p ? `<img class="${cls}" src="${esc(srcOf(p))}" data-fid="${esc(p.fileId || '')}" alt="" onerror="__imgErr(this)">` : '';

// Přednačtení: přímo z Disku (6 naráz); co Google odmítne, hned stahuje skript po skupinách (3 skupiny naráz).
let prep = null;
function prepare(photos, onProgress) {
  const list = [...new Map(photos.filter(Boolean).map(p => [p.id, p])).values()].filter(p => !ready.has(p.id));
  const total = list.length;
  let done = 0;
  const tick = () => onProgress && onProgress(done, total);
  const direct = p => new Promise(res => {
    const im = new Image();
    im.onload = () => { ready.set(p.id, im.src); res(true); };   // zůstane v mezipaměti prohlížeče
    im.onerror = () => res(false);
    im.src = imgSrc(p, PW);
  });
  const failQ = [];
  let proxyBusy = 0, directLeft = list.length;
  let finish; const allDone = new Promise(r => { finish = r; });
  const check = () => { tick(); if (done >= total) finish(); };
  const pump = () => {
    while (proxyBusy < 3 && failQ.length && window.__proxyImgs) {
      const part = failQ.splice(0, 6);
      proxyBusy++;
      window.__proxyImgs(part.map(p => p.fileId).filter(Boolean), PW)
        .then(got => part.forEach(p => { if (got[p.fileId]) ready.set(p.id, got[p.fileId]); }))
        .catch(() => {})
        .finally(() => { proxyBusy--; done += part.length; check(); pump(); });
    }
    if (!window.__proxyImgs && failQ.length) { done += failQ.splice(0).length; check(); }
  };
  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const p = list[next++];
      const ok = await direct(p);
      directLeft--;
      if (ok) { done++; check(); }
      else { failQ.push(p); if (failQ.length >= 6 || directLeft === 0) pump(); }
    }
    pump();
  };
  tick();
  if (!total) return Promise.resolve();
  Array.from({ length: 6 }, worker);
  return allDone;
}
const slidePhotos = slides => slides.flatMap(s => s.type === 'outro' ? [classPhoto()] : [s.p]).filter(p => p && (p.fileId || p.url));

function slideHTML(s) {
  const G = gradeList();
  switch (s.type) {
    case 'intro':
      return `<div class="sl sl-intro">
        <div class="sl-intro-txt"><span class="sl-kicker">${esc(CONFIG.SCHOOL_SHORT || CONFIG.SCHOOL_NAME)}</span>
        <h1>${esc(CONFIG.CLASS_NAME)} ${esc(CONFIG.CLASS_YEAR)}</h1><p>Devět let. Jedna parta.</p>
        <span class="sl-years">${esc(G[0].years.split('–')[0])} – ${esc(G[8].years.split('–')[1] || '')}</span></div>
        ${CONFIG.TEE_IMAGE ? `<div class="sl-tee"><img src="${esc(CONFIG.TEE_IMAGE)}" alt=""></div>` : ''}</div>`;
    case 'grade': {
      const g = G[s.g - 1];
      return `<div class="sl sl-grade" style="${colorVars(s.g)}">
        <span class="sl-bignum">${pad2(s.g)}</span>
        <div class="sl-grade-txt"><h1>${esc(g.title)}</h1><p>${esc(g.years)}</p>
        ${g.intro ? `<p class="sl-intro-line">${esc(g.intro)}</p>` : ''}</div></div>`;
    }
    case 'event':
      return `<div class="sl sl-event" style="${colorVars(s.g)}">
        <div class="sl-event-txt"><span class="sl-chip">${s.g}. třída</span><h2>${esc(s.ev.title)}</h2>
        ${s.ev.date || s.ev.place ? `<p>${esc([fmtDate(s.ev.date), s.ev.place].filter(Boolean).join(' · '))}</p>` : ''}</div>
        <div class="sl-polaroid tilt">${img(s.p, 1400)}</div></div>`;
    case 'photo': {
      const dir = ['kb-a', 'kb-b', 'kb-c', 'kb-d'][Math.floor(Math.random() * 4)];
      return `<div class="sl sl-photo" style="${colorVars(s.g)}">
        <div class="sl-bg">${img(s.p, 600)}</div>
        <div class="sl-pic ${dir}">${img(s.p, 2000)}</div>
        <div class="sl-cap"><span class="sl-chip">${s.g}. třída</span>${s.ev ? `<b>${esc(s.ev.title)}</b>` : ''}${s.p.caption ? `<i>${esc(s.p.caption)}</i>` : ''}</div></div>`;
    }
    case 'outro': {
      const p = classPhoto();
      return `<div class="sl sl-intro sl-outro">
        <div class="sl-intro-txt"><h1>Tak zase někdy, ${esc(CONFIG.CLASS_NAME)}.</h1><p>${esc(CONFIG.SCHOOL_SHORT || CONFIG.SCHOOL_NAME)} · ${esc(G[0].years.split('–')[0])}–${esc(G[8].years.split('–')[1] || '')}</p></div>
        ${p ? `<div class="sl-polaroid">${img(p, 1600)}</div>` : ''}</div>`;
    }
  }
  return '';
}
const durationOf = s => ({ intro: 6, grade: 4, event: 3.5, photo: opts.speed, outro: 10 }[s.type] || opts.speed) * 1000;

// ---------- obrazovka s nastavením ----------
export function presentView() {
  const G = gradeList();
  const chip = (k, v, label) => `<button class="fchip ${opts[k] === v ? 'on' : ''}" data-o="${k}" data-v="${v}">${label}</button>`;
  return {
    html: `<section class="page-head">
      <span class="pill">📽️ Promítání</span>
      <h1>Kronika na velké plátno</h1>
      <p>Rok po roku jako prezentace. Připoj notebook k televizi nebo projektoru a pusť to, až se sejdete.</p>
    </section>
    <div class="card present-setup">
      <div class="field"><label>Začít od</label><div class="chips-scroll small">${G.map(g => chip('from', g.n, `${g.n}. třída`)).join('')}</div></div>
      ${manual()
        ? `<p class="fine">✓ Promítá se <b>tvůj výběr fotek</b>. Upravíš ho v Admin → Promítání.</p>`
        : `<div class="field"><label>Fotek z jedné akce</label><div class="row wrap">${[4, 6, 10].map(n => chip('per', n, `${n}`)).join('')}</div>
           <small>Fotky se vyberou automaticky. Vlastní výběr uděláš v Admin → Promítání.</small></div>`}
      <div class="field"><label>Jak dlouho jedna fotka</label><div class="row wrap">${[4, 6, 9].map(n => chip('speed', n, `${n} s`)).join('')}</div></div>
      <p class="fine" id="pr-info"></p>
      <div class="pr-prep"><div class="pr-prep-bar"><span id="pr-bar"></span></div><p class="fine" id="pr-prep">Připravuji fotky…</p></div>
      <button class="btn btn-ink btn-block" id="pr-go">▶ Spustit promítání</button>
      <p class="fine">Ovládání: šipky nebo klepnutí vlevo/vpravo, mezerník = pauza, F = celá obrazovka, Esc = konec.</p>
    </div>`,
    mount() {
      const progress = (d, t) => {
        const bar = $('#pr-bar'), txt = $('#pr-prep');
        if (!bar) return;
        const all = d >= t;
        bar.style.width = `${t ? Math.round((d / t) * 100) : 100}%`;
        txt.textContent = all ? '✓ Všechny fotky jsou připravené – promítání poběží bez čekání.' : `Připravuji fotky ${d} / ${t}… Nech stránku otevřenou, ať pak promítání běží plynule.`;
        bar.parentElement.classList.toggle('done', all);
      };
      const info = () => {
        const sl = buildSlides(); const ph = sl.filter(s => s.type === 'photo').length; const min = Math.round(sl.reduce((a, s) => a + durationOf(s), 0) / 60000);
        $('#pr-info').textContent = `${ph} fotek · asi ${min} min`;
        prep = prepare(slidePhotos(sl), progress);
      };
      info();
      $$('[data-o]').forEach(b => b.onclick = () => {
        opts[b.dataset.o] = Number(b.dataset.v); saveOpts();
        $$(`[data-o="${b.dataset.o}"]`).forEach(x => x.classList.toggle('on', x === b)); info();
      });
      $('#pr-go').onclick = () => start();
    },
  };
}

// ---------- samotné promítání ----------
let wake = null;
function start() {
  const slides = buildSlides();
  let i = 0, playing = true, timer = null, hideT = null;
  const root = document.createElement('div');
  root.className = 'present';
  root.innerHTML = `<div class="pr-stage"></div>
    <div class="pr-progress">${slides.map(s => `<span style="${colorVars(s.g || 0)}"></span>`).join('')}</div>
    <div class="pr-ui">
      <button class="pr-btn" data-a="close" aria-label="Ukončit">${ICON.x}</button>
      <div class="pr-mid"><button class="pr-btn" data-a="prev" aria-label="Předchozí">${ICON.left}</button>
      <button class="pr-btn pr-play" data-a="play" aria-label="Pauza">❚❚</button>
      <button class="pr-btn" data-a="next" aria-label="Další">${ICON.right}</button></div>
      <button class="pr-btn" data-a="fs" aria-label="Celá obrazovka">⛶</button>
    </div>`;
  document.body.appendChild(root);
  document.body.classList.add('noscroll');
  const stage = $('.pr-stage', root), bars = $$('.pr-progress span', root);
  try { root.requestFullscreen?.(); } catch {}
  try { navigator.wakeLock?.request('screen').then(w => { wake = w; }).catch(() => {}); } catch {}

  const preload = n => { const s = slides[n]; if (s?.p && !ready.has(s.p.id)) prepare([s.p]); };
  let token = 0;
  const show = async (n, dir = 1) => {
    i = Math.max(0, Math.min(slides.length - 1, n));
    const my = ++token;
    clearTimeout(timer);
    const el = document.createElement('div');
    el.className = `pr-slide ${dir < 0 ? 'back' : ''}`;
    el.innerHTML = slideHTML(slides[i]);
    el.style.setProperty('--dur', `${durationOf(slides[i]) + 1500}ms`);
    stage.appendChild(el);
    // počkat, až se načte hlavní fotka (max. 4 s), ať se neprolíná prázdný snímek
    const im = el.querySelector('.sl-pic img, .sl-polaroid img');
    if (im && !im.complete) await Promise.race([new Promise(r => { im.addEventListener('load', r); }), new Promise(r => setTimeout(r, 2500))]);
    if (my !== token) { el.remove(); return; }   // mezitím už uživatel přeskočil dál
    void el.offsetWidth;
    el.classList.add('in');
    const old = $$('.pr-slide', stage).filter(x => x !== el);
    old.forEach(o => { o.classList.add('out'); setTimeout(() => o.remove(), 1200); });
    bars.forEach((b, k) => b.classList.toggle('done', k < i));
    bars.forEach((b, k) => b.classList.toggle('now', k === i));
    preload(i + 1); preload(i + 2); preload(i + 3);
    schedule();
  };
  const schedule = () => {
    clearTimeout(timer);
    if (playing && i < slides.length - 1) timer = setTimeout(() => show(i + 1), durationOf(slides[i]));
  };
  const toggle = () => { playing = !playing; $('.pr-play', root).textContent = playing ? '❚❚' : '▶'; root.classList.toggle('paused', !playing); schedule(); };
  const close = () => {
    clearTimeout(timer); document.removeEventListener('keydown', key);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    try { wake?.release(); } catch {}
    root.remove(); document.body.classList.remove('noscroll');
  };
  const poke = () => { root.classList.add('ui'); clearTimeout(hideT); hideT = setTimeout(() => root.classList.remove('ui'), 2500); };
  const key = e => {
    poke();
    if (e.key === 'ArrowRight' || e.key === 'PageDown') show(i + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') show(i - 1, -1);
    else if (e.key === ' ') { e.preventDefault(); toggle(); }
    else if (e.key === 'Escape') close();
    else if (e.key.toLowerCase() === 'f') { document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen?.(); }
  };
  document.addEventListener('keydown', key);
  root.addEventListener('mousemove', poke);
  root.addEventListener('click', e => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    poke();
    if (a === 'close') return close();
    if (a === 'prev') return show(i - 1, -1);
    if (a === 'next') return show(i + 1);
    if (a === 'play') return toggle();
    if (a === 'fs') return document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen?.();
    if (e.target.closest('.pr-ui')) return;
    // klepnutí do levé třetiny = zpět, jinam = dál
    if (e.clientX < window.innerWidth / 3) show(i - 1, -1); else show(i + 1);
  });
  let x0 = null;
  root.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  root.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) { dx < 0 ? show(i + 1) : show(i - 1, -1); } x0 = null; });
  poke();
  show(0);
}
