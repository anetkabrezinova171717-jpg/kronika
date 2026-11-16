// Obrazovky: Kronika (domů + ročník), Fotoalbum, Naše třída, Přidat fotku, prohlížeč fotek
import { CONFIG } from './config.js';
import { DEMO } from './api.js';
import {
  S, COLORS, gradeList, gradeOf, eventsOf, photosOfEvent, loosePhotos, photosOfGrade, albumPhotos,
  imgSrc, cmPhoto, person, ids, classmates, coverOf, eventById, photoById, uploadPhoto, LS, vis, setProfilePhoto,
} from './store.js';
import { $, $$, esc, escBr, fmtDate, initials, scribble, ICON, pad2, openSheet, closeSheet, toast, shuffle } from './ui.js';

// ---------- stavební kameny ----------
export function ph(p, { cls = '', r = 0, w = 1100, cap = true, attrs = '', style = '' } = {}) {
  if (!p) return '';
  const ar = p.w && p.h ? `${p.w}/${p.h}` : '4/3';
  const by = p.source === 'classmate' && p.author ? `<span class="sticker">📷 ${esc(p.author)}</span>` : '';
  // malé fotky (např. náhledy ze starého webu) nenatahujeme do rozmazané velikosti
  if (p.w && p.w < 480) { cls += ' lowres'; style += `;max-width:${Math.round(Math.max(p.w * 1.7, 230))}px`; }
  return `<figure class="ph ${cls} ${p.hidden ? 'is-hidden' : ''}" style="--r:${r}deg;--ar:${ar};${style}" data-photo="${esc(p.id)}" ${attrs}>${by}
    <img loading="lazy" decoding="async" src="${esc(imgSrc(p, w))}" data-fid="${esc(p.fileId || '')}" alt="${esc(p.caption || '')}" onerror="__imgErr(this)">
    ${cap && p.caption ? `<figcaption>${esc(p.caption)}</figcaption>` : ''}</figure>`;
}
const AV_COLORS = [1, 2, 3, 4, 5, 6, 7, 8].map(n => COLORS[n]);
export function avatar(c, cls = '') {
  const src = cmPhoto(c, 500);
  const i = Math.abs([...String(c?.id || '')].reduce((a, ch) => a + ch.charCodeAt(0), 0)) % AV_COLORS.length;
  const col = AV_COLORS[i];
  return `<div class="av ${cls}" style="--av:${col.bg};--avi:${col.ink}">${src
    ? `<img loading="lazy" src="${esc(src)}" data-fid="${esc(c.photoId || '')}" alt="" onerror="__imgErr(this)">`
    : `<span>${esc(initials(c?.name))}</span>`}</div>`;
}
// Naše třídní tričko (tvar + potisk; bez postaviček)
// photo = vaše vlastní fotka obrázku z trička/Termitu → „potiskne“ se na tričko
export function teeHTML(cls = '', photo = null) {
  // hotový návrh trička (obrázek v img/) má přednost před kresleným tričkem
  if (CONFIG.TEE_IMAGE) return `<img class="tee-img ${cls}" src="${esc(CONFIG.TEE_IMAGE)}" alt="Tričko ${esc(CONFIG.CLASS_NAME)} – ${esc(CONFIG.MOTTO)}">`;
  const pic = photo ? `<span class="tee-pic"><img src="${esc(imgSrc(photo, 900))}" data-fid="${esc(photo.fileId || '')}" alt="" onerror="__imgErr(this)"></span>` : '';
  return `<div class="tee ${cls} ${pic ? 'has-pic' : ''}" role="img" aria-label="Tričko ${esc(CONFIG.CLASS_NAME)} ${esc(CONFIG.CLASS_YEAR)}">
    <svg viewBox="0 0 300 290" aria-hidden="true">
      <path class="tee-body" d="M100 18 C115 36 185 36 200 18 L248 34 L292 92 L250 122 L232 102 L232 278 Q150 290 68 278 L68 102 L50 122 L8 92 L52 34 Z"/>
      <path class="tee-fold" d="M68 102 L68 278 M232 102 L232 278"/>
      <path class="tee-collar" d="M100 18 C115 40 185 40 200 18"/>
    </svg>
    <div class="tee-print"><b>${esc(CONFIG.CLASS_NAME)}</b><span>${esc(CONFIG.CLASS_YEAR)}</span>${pic}<small>${esc(CONFIG.MOTTO)}</small></div>
  </div>`;
}
export function marqueeHTML() {
  return `<div class="marquee"><span>${esc(CONFIG.CLASS_NAME)} ${esc(CONFIG.CLASS_YEAR)}</span><span>${esc(CONFIG.SCHOOL_SHORT || CONFIG.SCHOOL_NAME)}</span></div>`;
}
const gStyle = n => { const c = COLORS[n] || COLORS[0]; return `--g:${c.bg};--gi:${c.ink};--gs:${c.soft}`; };
const adminBtn = (act, id, label = 'Upravit', extra = '') => S.admin ? `<button class="adm-btn" data-act="${act}" data-id="${esc(id)}" ${extra}>${ICON.edit}<span>${label}</span></button>` : '';
const demoNote = () => DEMO ? `<div class="demo-note"><b>Demo režim</b> – ukázková data uložená jen v tomto prohlížeči. Po propojení s Google Diskem uvidí všichni stejný obsah.</div>` : '';

// ---------- DOMŮ ----------
export function homeView() {
  const grades = gradeList();
  const photos = albumPhotos();
  const fromMates = photos.filter(p => p.source === 'classmate');
  // úvodní koláž: první fotka z akcí podle CONFIG.HERO_EVENTS (velká společná + dvě menší)
  const evs = vis(S.db.events);
  const fromEvent = pat => { const e = evs.find(x => x.title.toLowerCase().includes(String(pat).toLowerCase())); return e ? photosOfEvent(e.id)[0] : null; };
  const heroPics = [...new Map([...(CONFIG.HERO_EVENTS || []).map(fromEvent), coverOf(9), coverOf(1), coverOf(6), ...photos.slice(0, 3)]
    .filter(Boolean).map(p => [p.id, p])).values()].slice(0, 1); // na úvodu jen společná fotka
  // Termit = náš třídní časopis (akce s „Termit“ v názvu); první fotka = obálka
  const termit = vis(S.db.events).find(e => /termit/i.test(e.title));
  const termitPs = termit ? photosOfEvent(termit.id) : [];
  const cover = termitPs[0] || null;
  const latest = photos.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 10);
  const stats = [
    [9, 'ročníků', 'var(--tee)', '#fff'],
    [photos.length, 'fotek', 'var(--hoodie)', 'var(--tee-ink)'],
  ];

  const gradeCard = g => {
    const cov = coverOf(g.n);
    const count = photosOfGrade(g.n).length;
    return `<a class="gcard reveal" href="#/rocnik/${g.n}" style="${gStyle(g.n)}">
      <span class="gcard-num">${pad2(g.n)}</span>
      <span class="gcard-txt"><b>${esc(g.title)}</b><small>${esc(g.years)} · ${count} ${count === 1 ? 'fotka' : count < 5 && count ? 'fotky' : 'fotek'}</small></span>
      ${cov ? `<span class="gcard-pic"><img loading="lazy" src="${esc(imgSrc(cov, 300))}" data-fid="${esc(cov.fileId || '')}" alt="" onerror="__imgErr(this)"></span>` : `<span class="gcard-pic empty">${ICON.right}</span>`}
    </a>`;
  };

  return {
    html: `
    <section class="hero">
      ${demoNote()}
      <span class="pill">👕 ${esc(CONFIG.CLASS_NAME)} ${esc(CONFIG.CLASS_YEAR)} · ${esc(CONFIG.SCHOOL_NAME)}</span>
      <h1 class="hero-title">Devět let.<br>Jedna parta ${scribble('flákačů', 'var(--tee)')}.</h1>
      <p class="lead">Naše společná kronika od prvního zvonění až po to poslední. Listuj, vzpomínej a přidávej vlastní fotky.</p>
      <div class="hero-cta">
        <a class="btn btn-ink" href="#/rocnik/1">Otevřít kroniku ${ICON.right}</a>
        <a class="btn btn-yellow" href="#/pridat">${ICON.plus} Přidat fotku</a>
        <a class="btn btn-ghost" href="#/promitani">📽️ Promítání</a>
      </div>
      <div class="collage">
        ${heroPics.map((p, i) => ph(p, { cls: `c${i + 1} tape`, r: [-1.5, -3, 3][i], w: i ? 700 : 1400, cap: false })).join('')}
        <span class="bubble">Ahoj, ${esc(CONFIG.CLASS_NAME)}!</span>
        <span class="blob b1"></span><span class="blob b2"></span>
      </div>
    </section>

    ${marqueeHTML()}

    <section class="stats">
      ${stats.map(([n, l, bg, fg], i) => `<div class="stat reveal" style="--sb:${bg};--sf:${fg};--d:${i * 60}ms"><b>${n}</b><span>${l}</span></div>`).join('')}
    </section>

    <section class="sec">
      <div class="tee-card reveal">
        <div class="tee-card-txt">
          <span class="pill">👕 Náš dress code</span>
        </div>
        ${teeHTML('', cover)}
      </div>
    </section>

    ${termit && cover ? `<section class="sec">
      <a class="termit-card reveal" href="#/album?e=${esc(termit.id)}">
        <div class="termit-txt">
          <span class="pill">📰 Třídní časopis</span>
          <h2>${esc(termit.title)}</h2>
          <p>Přezdívky, hlášky, vzkazy od učitelů, taneční i kam kdo šel dál. ${termitPs.length} stránek.</p>
          <span class="btn btn-yellow btn-sm">Listovat ${ICON.right}</span>
        </div>
        <div class="termit-pages">
          ${termitPs.slice(1, 3).map((p, i) => `<img class="tp tp${i + 2}" src="${esc(imgSrc(p, 500))}" data-fid="${esc(p.fileId || '')}" alt="" onerror="__imgErr(this)">`).join('')}
          <img class="tp tp1" src="${esc(imgSrc(cover, 600))}" data-fid="${esc(cover.fileId || '')}" alt="Obálka časopisu ${esc(termit.title)}" onerror="__imgErr(this)">
        </div>
      </a>
    </section>` : ''}

    <section class="sec">
      <div class="sec-head"><span class="pill">📚 Ročníky</span><h2>Listuj rok po ${scribble('roce', 'var(--blue)')}.</h2></div>
      <div class="gcards">${grades.map(gradeCard).join('')}</div>
    </section>

    ${latest.length ? `<section class="sec">
      <div class="sec-head row"><h2>Čerstvě přidané</h2><a class="link" href="#/album">Celé album ${ICON.right}</a></div>
      <div class="strip">${latest.map((p, i) => ph(p, { cls: 'mini', r: i % 2 ? 2 : -2, w: 500 })).join('')}</div>
    </section>` : ''}

    <section class="sec">
      <div class="memory reveal" id="memory"></div>
    </section>

    <section class="sec">
      <div class="dark-card reveal">
        <h2>Máš doma fotky ze školy?</h2>
        <p>Přidej je do kroniky. ${fromMates.length ? `Spolužáci už přidali <b>${fromMates.length}</b> ${fromMates.length < 5 ? 'fotky' : 'fotek'}.` : 'Buď první!'}</p>
        <a class="btn btn-yellow" href="#/pridat">${ICON.cam} Přidat fotografii</a>
      </div>
    </section>

    <section class="sec install" id="install-card" hidden>
      <div class="note-card">
        <b>📱 Přidej si kroniku na plochu</b>
        <p id="install-text">iPhone: v Safari klepni na <b>Sdílet</b> → <b>Přidat na plochu</b>.<br>Android: v Chromu menu <b>⋮</b> → <b>Přidat na plochu</b>.</p>
        <div class="row"><button class="btn btn-ink btn-sm" id="install-btn" hidden>Nainstalovat</button><button class="btn btn-ghost btn-sm" id="install-hide">Teď ne</button></div>
      </div>
    </section>

    <footer class="foot"><span>${esc(CONFIG.APP_NAME)} · <i>${esc(CONFIG.MOTTO)}</i></span><a href="#/admin">${ICON.lock} Admin</a></footer>`,
    mount() {
      renderMemory();
      setupInstallCard();
    },
  };
}

function renderMemory() {
  const el = $('#memory');
  if (!el) return;
  const evs = vis(S.db.events).filter(e => photosOfEvent(e.id).length);
  if (!evs.length) { el.remove(); return; }
  const e = evs[Math.floor(Math.random() * evs.length)];
  const p = photosOfEvent(e.id)[0];
  el.setAttribute('style', gStyle(e.grade));
  el.innerHTML = `<div class="memory-top"><span class="pill">🎲 Náhodná vzpomínka</span><button class="icon-btn" id="mem-next" aria-label="Jiná vzpomínka">${ICON.shuffle}</button></div>
    <a href="#/rocnik/${e.grade}?e=${esc(e.id)}" class="memory-body">
      <div class="memory-pic"><img src="${esc(imgSrc(p, 700))}" data-fid="${esc(p.fileId || '')}" alt="" onerror="__imgErr(this)"></div>
      <div><small>${e.grade}. třída · ${esc(fmtDate(e.date))}</small><h3>${esc(e.title)}</h3><p>${esc(String(e.text || '').split('\n')[0].slice(0, 120))}${String(e.text || '').length > 120 ? '…' : ''}</p></div>
    </a>`;
  $('#mem-next').onclick = renderMemory;
}

let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; setupInstallCard(); });
function setupInstallCard() {
  const card = $('#install-card');
  if (!card) return;
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone || LS.get('kronika-install-hidden')) return;
  card.hidden = false;
  if (deferredInstall) {
    $('#install-btn').hidden = false;
    $('#install-btn').onclick = async () => { deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; card.hidden = true; };
  }
  $('#install-hide').onclick = () => { LS.set('kronika-install-hidden', '1'); card.hidden = true; };
}

// ---------- ROČNÍK ----------
export function gradeView(n, q = {}) {
  if (!(n >= 1 && n <= 9)) return notFound();
  const g = gradeOf(n);
  const evs = eventsOf(n);
  const loose = loosePhotos(n);
  const cov = coverOf(n);
  const all = gradeList();
  const prev = all[n - 2], next = all[n];
  const total = photosOfGrade(n).length;

  const steps = all.map(x => `<a href="#/rocnik/${x.n}" class="step ${x.n === n ? 'on' : ''} ${x.n < n ? 'past' : ''}" style="${gStyle(x.n)}" aria-label="${esc(x.title)}">${x.n === n ? `<b>${x.n}.</b> třída` : x.n}</a>`).join('');

  return {
    theme: n,
    html: `
    <div class="g-page" style="${gStyle(n)}">
    <nav class="steps" aria-label="Ročníky"><div class="steps-in">${steps}</div></nav>
    <section class="g-hero">
      ${n === 9 ? `<div class="g-tee">${teeHTML('mini')}</div>` : `<span class="g-num" aria-hidden="true">${pad2(n)}</span>`}
      <span class="g-kicker">Ročník ${n} z 9</span>
      <h1>${esc(g.title)}</h1>
      <p class="g-years">${esc(g.years)}${g.subtitle ? ` · ${esc(g.subtitle)}` : ''}</p>
      ${g.intro ? `<p class="g-intro">${escBr(g.intro)}</p>` : ''}
      <div class="g-chips"><span>${evs.length} ${evs.length === 1 ? 'událost' : evs.length < 5 && evs.length ? 'události' : 'událostí'}</span><span>${total} fotek</span></div>
      ${cov ? `<div class="g-cover">${ph(cov, { r: 3, cap: false, w: 900, cls: 'tape' })}</div>` : ''}
      ${S.admin ? `<div class="adm-row">${adminBtn('edit-grade', n, 'Upravit ročník')}${adminBtn('add-event', n, 'Přidat událost')}</div>` : ''}
    </section>

    <div class="g-body">
      ${evs.length ? evs.map((e, i) => eventHTML(e, i)).join('') : `<div class="empty reveal"><b>Tady je zatím prázdno.</b><p>Máš fotku z ${n}. třídy? Přidej ji jako první.</p><a class="btn btn-ink" href="#/pridat?g=${n}">${ICON.plus} Přidat fotku</a></div>`}

      ${loose.length ? `<section class="ev loose reveal">
        <div class="ev-meta"><span class="pill ev-date">📷 Další fotky</span></div>
        <h2 class="ev-title">Z alb spolužáků</h2>
        <div class="masonry">${loose.map((p, i) => ph(p, { r: [-2, 1.5, 2, -1][i % 4], w: 600 })).join('')}</div>
      </section>` : ''}

      <nav class="g-nav">
        ${prev ? `<a href="#/rocnik/${prev.n}" style="${gStyle(prev.n)}">${ICON.left}<span><small>Předchozí</small><b>${esc(prev.title)}</b></span></a>` : `<a href="#/" class="home-link"><span><small>Zpět na</small><b>Úvod</b></span></a>`}
        ${next ? `<a href="#/rocnik/${next.n}" style="${gStyle(next.n)}" class="nx"><span><small>Další</small><b>${esc(next.title)}</b></span>${ICON.right}</a>` : `<a href="#/trida" class="nx" style="${gStyle(9)}"><span><small>A to jsme</small><b>My všichni</b></span>${ICON.right}</a>`}
      </nav>
    </div>
    <a class="fab" href="#/pridat?g=${n}">${ICON.plus}<span>Fotka</span></a>
    </div>`,
    mount() {
      $('.steps .on')?.scrollIntoView({ inline: 'center', block: 'nearest' });
      if (q.e) setTimeout(() => document.getElementById('ev-' + q.e)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    },
  };
}

const EVENT_MAX = 20; // víc fotek z jedné akce → odkaz do alba
function eventHTML(e, idx) {
  const allPs = photosOfEvent(e.id);
  const ps = allPs.slice(0, EVENT_MAX);
  const paras = String(e.text || '').split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
  const alt = idx % 2 === 1;
  let pi = 0;
  const take = k => { const a = ps.slice(pi, pi + k); pi += a.length; return a; };
  const duo = arr => arr.length === 2 ? `<div class="duo">${ph(arr[0], { r: -2.2, w: 700 })}${ph(arr[1], { r: 2.4, w: 700 })}</div>` : arr.map(p => ph(p, { cls: 'solo', r: 1.5 })).join('');

  // FOTKA → TEXT → FOTKA → TEXT → FOTKA
  let body = '';
  const first = take(1)[0];
  if (first) body += ph(first, { cls: `big tape ${alt ? 'off-r' : ''}`, r: alt ? 1.4 : -1.2, w: 1200 });
  paras.forEach((t, i) => {
    body += `<p class="ev-p ${i === 0 ? 'first' : ''} reveal">${escBr(t)}</p>`;
    const left = ps.length - pi;
    const isLast = i === paras.length - 1;
    if (!left) return;
    if (isLast) return; // zbytek fotek až na konec
    if (left >= 2 && i % 2 === 0) body += duo(take(2));
    else body += ph(take(1)[0], { cls: i % 2 ? 'off-l' : 'off-r', r: i % 2 ? -1.8 : 1.8 });
  });
  const rest = ps.slice(pi);
  if (rest.length === 1) body += ph(rest[0], { cls: alt ? 'off-l' : 'off-r', r: alt ? -1.6 : 1.6 });
  else if (rest.length === 2) body += duo(rest);
  else if (rest.length > 2) body += `${duo(rest.slice(0, 2))}<div class="masonry">${rest.slice(2).map((p, i) => ph(p, { r: [1.5, -1.5, -2, 2][i % 4], w: 600 })).join('')}</div>`;

  const people = ids(e.people).map(person).filter(Boolean);
  return `<article class="ev ${alt ? 'alt' : ''} ${e.hidden ? 'is-hidden' : ''}" id="ev-${esc(e.id)}">
    <div class="ev-meta reveal">
      ${e.date ? `<span class="pill ev-date">${esc(fmtDate(e.date))}</span>` : ''}
      ${e.place ? `<span class="pill">${ICON.pin}${esc(e.place)}</span>` : ''}
      ${e.hidden ? '<span class="pill">skryté</span>' : ''}
      ${adminBtn('edit-event', e.id)}
    </div>
    <h2 class="ev-title reveal">${esc(e.title)}</h2>
    ${body}
    ${allPs.length > EVENT_MAX ? `<a class="more-ph" href="#/album?e=${esc(e.id)}">${ICON.image} Zobrazit všech ${allPs.length} fotek ${ICON.right}</a>` : ''}
    ${people.length ? `<div class="people reveal"><span>Na fotkách:</span>${people.map(c => `<button class="chip" data-cm="${esc(c.id)}">${esc(c.nickname || c.name)}</button>`).join('')}</div>` : ''}
    <a class="add-mini" href="#/pridat?g=${e.grade}&e=${esc(e.id)}">${ICON.plus} Mám fotku z této akce</a>
  </article>`;
}

// ---------- FOTOALBUM ----------
export function albumView(q = {}) {
  const f = q.f || 'all';
  let list = albumPhotos();
  const gradeOfPhoto = p => eventById(p.eventId)?.grade ?? p.grade;
  const ev = q.e ? eventById(q.e) : null;
  if (ev) {
    const ps = photosOfEvent(ev.id);
    return {
      theme: ev.grade,
      html: `<section class="page-head compact" style="${gStyle(ev.grade)}">
        <a class="back" href="#/rocnik/${ev.grade}?e=${esc(ev.id)}">${ICON.left} ${ev.grade}. třída</a>
        <h1>${esc(ev.title)}</h1><p>${ps.length} fotek${ev.date ? ' · ' + esc(fmtDate(ev.date)) : ''}</p></section>
        <div class="masonry album">${ps.slice(0, Number(q.n) || 60).map((p, i) => ph(p, { r: [-1.5, 1.2, 2, -2.2][i % 4], w: 600, cap: !!p.caption })).join('')}</div>
        ${ps.length > (Number(q.n) || 60) ? `<a class="btn btn-ghost btn-block" href="#/album?e=${esc(ev.id)}&n=${(Number(q.n) || 60) + 60}">Zobrazit další (${ps.length - (Number(q.n) || 60)})</a>` : ''}
        <a class="fab" href="#/pridat?g=${ev.grade}&e=${esc(ev.id)}">${ICON.plus}<span>Přidat</span></a>`,
    };
  }
  if (f === 'mates') list = list.filter(p => p.source === 'classmate');
  else if (f === '0') list = list.filter(p => !gradeOfPhoto(p));
  else if (/^[1-9]$/.test(f)) list = list.filter(p => gradeOfPhoto(p) === Number(f));
  list = list.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const unsorted = albumPhotos().filter(p => !gradeOfPhoto(p)).length;
  const chips = [['all', 'Vše'], ['mates', 'Od spolužáků'], ...gradeList().map(g => [String(g.n), `${g.n}. třída`]), ...(unsorted ? [['0', `Nezařazené (${unsorted})`]] : [])];
  return {
    html: `
    <section class="page-head">
      <span class="pill">🖼️ Fotoalbum</span>
      <h1>Všechny naše ${scribble('fotky', 'var(--yellow)')}.</h1>
      <p>Klepni na fotku pro zvětšení.</p>
    </section>
    <div class="chips-scroll">${chips.map(([v, l]) => `<a class="fchip ${f === v ? 'on' : ''}" href="#/album?f=${v}" style="${/^[1-9]$/.test(v) ? gStyle(+v) : ''}">${esc(l)}</a>`).join('')}</div>
    ${list.length ? `<div class="masonry album">${list.slice(0, Number(q.n) || 60).map((p, i) => {
      const gn = gradeOfPhoto(p);
      return ph(p, { r: [-1.5, 1.2, 2, -2.2][i % 4], w: 600, cls: 'with-badge', attrs: `data-g="${gn ? gn + '.' : '?'}"`, style: gStyle(gn) });
    }).join('')}</div>
    ${list.length > (Number(q.n) || 60) ? `<a class="btn btn-ghost btn-block" href="#/album?f=${f}&n=${(Number(q.n) || 60) + 60}">Zobrazit další (${list.length - (Number(q.n) || 60)})</a>` : ''}` : `<div class="empty"><b>Žádné fotky</b><p>V této části zatím nic není.</p></div>`}
    <a class="fab" href="#/pridat${/^[1-9]$/.test(f) ? '?g=' + f : ''}">${ICON.plus}<span>Přidat</span></a>`,
  };
}

// ---------- NAŠE TŘÍDA ----------
const ybCard = (c, i, small = false) => `
  <button class="yb reveal ${small ? 'small' : ''} ${c.hidden ? 'is-hidden' : ''}" data-cm="${esc(c.id)}" style="--d:${(i % 6) * 50}ms;--r:${[-1.5, 1.2, 1.8, -1][i % 4]}deg">
    ${avatar(c, 'arch')}
    <b>${esc(c.name)}</b>
    ${c.nickname ? `<span class="nick">„${esc(c.nickname)}“</span>` : ''}
    ${!small && !cmPhoto(c) ? `<span class="yb-add">${ICON.cam} přidat fotku</span>` : ''}
  </button>`;

export function classView() {
  const all = classmates();               // podle abecedy (příjmení)
  const cm = all.filter(c => !c.left);
  const past = all.filter(c => c.left);
  return {
    html: `
    <section class="page-head">
      <span class="pill">👋 Naše třída</span>
      <h1>${cm.length} tváří, jedna ${scribble('parta', 'var(--tee)')}.</h1>
      <p>Seřazeno podle abecedy. Klepni na sebe a nastav si vlastní fotku.</p>
      ${S.admin ? `<div class="adm-row">${adminBtn('add-classmate', '', 'Přidat spolužáka')}</div>` : ''}
    </section>
    ${cm.length ? `<div class="yb-grid">${cm.map((c, i) => ybCard(c, i)).join('')}</div>` : `<div class="empty"><b>Zatím tu nikdo není</b><p>Administrátor přidá spolužáky v Admin módu.</p></div>`}
    ${past.length ? `<section class="sec">
      <div class="sec-head"><span class="pill">🚪 Byli s námi část cesty</span></div>
      <div class="yb-grid three">${past.map((c, i) => ybCard(c, i, true)).join('')}</div>
    </section>` : ''}
    ${quotesHTML()}`,
  };
}

function quotesHTML() {
  const qs = vis(S.db.quotes);
  if (!qs.length) return '';
  return `<section class="sec">
    <div class="sec-head"><span class="pill">💬 Hlášky</span><h2>Hlášky ${scribble(esc(CONFIG.CLASS_NAME.match(/\d\.[A-Z]/)?.[0] || '9.A'), 'var(--tee)')}</h2></div>
    <div class="quotes">${qs.map((q, i) => {
      const c = person(q.author);
      return `<blockquote class="qcard reveal" style="--r:${[-1.5, 1.2, -0.8, 1.6][i % 4]}deg;--d:${(i % 4) * 40}ms">„${esc(q.text)}“${c ? `<small>— ${esc(c.nickname || c.name)}</small>` : ''}</blockquote>`;
    }).join('')}</div>
  </section>`;
}

export function openProfile(id) {
  const c = person(id);
  if (!c) return;
  const pics = albumPhotos().filter(p => ids(p.people).includes(c.id));
  const qs = vis(S.db.quotes).filter(q => q.author === c.id);
  const evs = vis(S.db.events).filter(e => ids(e.people).includes(c.id));
  const body = openSheet(`
    <div class="profile">
      ${avatar(c, 'arch big')}
      <label class="btn btn-ghost btn-sm set-photo">${ICON.cam} <span>${cmPhoto(c) ? 'Změnit fotku' : 'Nastavit svou fotku'}</span><input type="file" accept="image/*" hidden></label>
      <h2>${esc(c.name)}</h2>
      ${c.nickname ? `<p class="nick big">„${esc(c.nickname)}“</p>` : ''}
      ${c.bio ? `<p class="bio">${escBr(c.bio)}</p>` : ''}
      ${c.quote ? `<blockquote class="fav"><small>Oblíbená hláška</small>„${esc(c.quote)}“</blockquote>` : ''}
      ${qs.length ? `<div class="p-sec"><h3>Hlášky</h3>${qs.map(q => `<p class="q-line">„${esc(q.text)}“ ${q.context ? `<small>— ${esc(q.context)}</small>` : ''}</p>`).join('')}</div>` : ''}
      ${evs.length ? `<div class="p-sec"><h3>Byl/a u toho</h3><div class="row wrap">${evs.map(e => `<a class="chip" href="#/rocnik/${e.grade}?e=${esc(e.id)}">${e.grade}. tř. · ${esc(e.title)}</a>`).join('')}</div></div>` : ''}
      ${pics.length ? `<div class="p-sec"><h3>Na fotkách</h3><div class="masonry">${pics.map((p, i) => ph(p, { r: i % 2 ? 1.5 : -1.5, w: 500, cap: false })).join('')}</div></div>` : ''}
      ${S.admin ? `<div class="adm-row">${adminBtn('edit-classmate', c.id, 'Upravit spolužáka')}</div>` : ''}
    </div>`);
  $$('a', body).forEach(a => a.addEventListener('click', () => closeSheet()));
  // vlastní profilovka – může si ji nastavit kdokoli
  const inp = $('.set-photo input', body);
  inp.onchange = async () => {
    const f = inp.files[0];
    if (!f) return;
    const lbl = $('.set-photo span', body);
    lbl.innerHTML = '<span class="spin"></span> Nahrávám…';
    try {
      await setProfilePhoto(f, c.id);
      toast('Fotka nastavena ✓');
      S.rerender();
      openProfile(c.id);
    } catch (err) { toast(err.message, 'err'); lbl.textContent = 'Zkusit znovu'; }
  };
}

// ---------- PŘIDAT FOTKU ----------
export function uploadView(q = {}) {
  const preG = q.g ?? '';
  const author = LS.get('kronika-author') || S.player || '';
  return {
    html: `
    <section class="page-head compact">
      <span class="pill">📸 Fotografie</span>
      <h1>Přidej ${scribble('vzpomínku', 'var(--pink)')}.</h1>
      <p>Fotka se uloží do společné kroniky a uvidí ji celá třída.</p>
    </section>
    <form class="form card" id="up" novalidate>
      <label class="drop" id="drop">
        <input type="file" accept="image/*" multiple id="files">
        <span class="drop-ic">${ICON.cam}</span>
        <b>Vybrat fotky z telefonu</b>
        <small>Můžeš vybrat i víc najednou</small>
      </label>
      <div class="previews" id="prev"></div>
      <div class="field">
        <label for="u-grade">Do které třídy / období patří?</label>
        <select id="u-grade" name="grade">
          <option value="" ${preG === '' ? 'selected' : ''} disabled>Vyber třídu…</option>
          ${gradeList().map(g => `<option value="${g.n}" ${String(preG) === String(g.n) ? 'selected' : ''}>${esc(g.title)} (${esc(g.years)})</option>`).join('')}
          <option value="0" ${String(preG) === '0' ? 'selected' : ''}>Nevím / zařadit později</option>
        </select>
      </div>
      <div class="field" id="ev-field" hidden>
        <label for="u-ev">Z jaké akce? <em>(nepovinné)</em></label>
        <select id="u-ev" name="eventId"></select>
      </div>
      <div class="field">
        <label for="u-cap">Malé info k fotce</label>
        <input id="u-cap" name="caption" maxlength="200" placeholder="například: Výlet do Itálie, byli jsme tam všichni">
      </div>
      <div class="field">
        <label for="u-auth">Kdo fotografii přidává?</label>
        <input id="u-auth" name="author" maxlength="40" placeholder="přezdívka / jméno" value="${esc(author)}" autocomplete="nickname">
      </div>
      <button class="btn btn-ink btn-block" type="submit" id="u-send">Odeslat do kroniky ${ICON.right}</button>
      <p class="fine">Fotky se ukládají na společný Google Disk třídy. Nahrávej jen fotky, se kterými spolužáci souhlasí.</p>
    </form>`,
    mount() {
      const form = $('#up'), input = $('#files'), prev = $('#prev'), gSel = $('#u-grade'), evSel = $('#u-ev');
      let files = [];
      const draw = () => {
        prev.innerHTML = files.map((f, i) => `<div class="pv"><img src="${f.url}" alt=""><button type="button" data-i="${i}" aria-label="Odebrat">${ICON.x}</button></div>`).join('');
        $('#drop').classList.toggle('has', files.length > 0);
        $('#drop b').textContent = files.length ? `Vybráno ${files.length} – přidat další` : 'Vybrat fotky z telefonu';
      };
      input.onchange = () => {
        for (const f of input.files) files.push({ file: f, url: URL.createObjectURL(f) });
        input.value = '';
        draw();
      };
      prev.onclick = e => { const b = e.target.closest('[data-i]'); if (!b) return; URL.revokeObjectURL(files[b.dataset.i].url); files.splice(+b.dataset.i, 1); draw(); };
      const fillEvents = () => {
        const n = Number(gSel.value);
        const evs = n ? eventsOf(n) : [];
        $('#ev-field').hidden = !evs.length;
        evSel.innerHTML = `<option value="">— žádná konkrétní akce —</option>` + evs.map(e => `<option value="${esc(e.id)}" ${q.e === e.id ? 'selected' : ''}>${esc(e.title)}${e.date ? ' · ' + esc(fmtDate(e.date)) : ''}</option>`).join('');
      };
      gSel.onchange = fillEvents; fillEvents();

      form.onsubmit = async e => {
        e.preventDefault();
        const grade = gSel.value, author = form.author.value.trim();
        if (!files.length) return toast('Vyber aspoň jednu fotku', 'err');
        if (grade === '') { gSel.focus(); return toast('Vyber, do které třídy fotka patří', 'err'); }
        if (!author) { form.author.focus(); return toast('Napiš, kdo fotku přidává', 'err'); }
        LS.set('kronika-author', author);
        const btn = $('#u-send');
        btn.disabled = true;
        const meta = { grade: Number(grade), eventId: evSel.value || '', caption: form.caption.value.trim(), author, source: 'classmate' };
        if (meta.eventId) meta.grade = eventById(meta.eventId)?.grade ?? meta.grade;
        let ok = 0;
        const errs = [];
        for (let i = 0; i < files.length; i++) {
          btn.innerHTML = `<span class="spin"></span> Nahrávám ${i + 1} z ${files.length}…`;
          try { await uploadPhoto(files[i].file, meta); ok++; } catch (err) { errs.push(err.message); }
        }
        if (!ok) { btn.disabled = false; btn.innerHTML = `Zkusit znovu ${ICON.right}`; return toast(errs[0] || 'Nahrání se nepovedlo', 'err'); }
        const n = meta.grade;
        form.outerHTML = `<div class="card done" style="${gStyle(n)}">
          <div class="done-ic">🎉</div>
          <h2>Hotovo, díky!</h2>
          <p>${ok === 1 ? 'Fotka je' : `${ok} fotky jsou`} v kronice.${n ? '' : ' Administrátor je brzy zařadí do správné třídy.'}${errs.length ? ` (${errs.length} se nepovedlo nahrát.)` : ''}</p>
          <div class="col">
            ${n ? `<a class="btn btn-ink" href="#/rocnik/${n}${meta.eventId ? '?e=' + meta.eventId : ''}">Zobrazit ${n}. třídu ${ICON.right}</a>` : `<a class="btn btn-ink" href="#/album">Do fotoalba ${ICON.right}</a>`}
            <a class="btn btn-ghost" href="#/pridat?g=${n}&_=${Date.now()}">Přidat další fotky</a>
          </div></div>`;
      };
    },
  };
}

// ---------- prohlížeč fotek ----------
export function openLightbox(list, startId) {
  let i = Math.max(0, list.indexOf(startId));
  const lb = document.createElement('div');
  lb.className = 'lb';
  lb.innerHTML = `<button class="lb-x" aria-label="Zavřít">${ICON.x}</button>
    <div class="lb-stage"><img alt=""></div>
    <button class="lb-nav l" aria-label="Předchozí">${ICON.left}</button><button class="lb-nav r" aria-label="Další">${ICON.right}</button>
    <div class="lb-info"></div>`;
  document.body.appendChild(lb);
  document.body.classList.add('noscroll');
  void lb.offsetWidth;
  lb.classList.add('open');
  const img = $('img', lb), info = $('.lb-info', lb);
  const show = () => {
    const p = photoById(list[i]);
    if (!p) return;
    img.src = imgSrc(p, 1800); img.dataset.fid = p.fileId || ''; delete img.dataset.fb;
    img.onerror = () => window.__imgErr(img);
    const ev = eventById(p.eventId);
    const gn = ev?.grade ?? p.grade;
    const people = ids(p.people).map(person).filter(Boolean);
    info.innerHTML = `${p.caption ? `<p class="lb-cap">${esc(p.caption)}</p>` : ''}
      <p class="lb-meta">${gn ? `<a href="#/rocnik/${gn}${ev ? '?e=' + esc(ev.id) : ''}">${gn}. třída${ev ? ' · ' + esc(ev.title) : ''}</a>` : 'Nezařazeno'}
      ${p.author ? ` · ${p.source === 'classmate' ? 'přidal/a' : 'autor'} ${esc(p.author)}` : ''}${p.source === 'classmate' && p.createdAt ? ` · ${esc(fmtDate(p.createdAt))}` : ''}</p>
      ${people.length ? `<p class="lb-meta">Na fotce: ${people.map(c => esc(c.nickname || c.name)).join(', ')}</p>` : ''}
      <div class="row">${S.admin ? `<button class="btn btn-sm btn-yellow" data-act="edit-photo" data-id="${esc(p.id)}">${ICON.edit} Upravit</button>` : ''}
      <span class="lb-count">${i + 1} / ${list.length}</span></div>`;
    $('.lb-nav.l', lb).hidden = i === 0;
    $('.lb-nav.r', lb).hidden = i === list.length - 1;
  };
  const stage = $('.lb-stage', lb);
  img.onclick = () => { stage.classList.toggle('zoom'); stage.scrollTop = 0; };
  const go = d => { const j = i + d; if (j < 0 || j >= list.length) return; i = j; stage.classList.remove('zoom'); img.classList.remove('in'); show(); void img.offsetWidth; img.classList.add('in'); };
  const close = () => { lb.classList.remove('open'); document.body.classList.remove('noscroll'); document.removeEventListener('keydown', key); setTimeout(() => lb.remove(), 250); };
  const key = e => { if (e.key === 'Escape') close(); if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1); };
  document.addEventListener('keydown', key);
  $('.lb-x', lb).onclick = close;
  $('.lb-nav.l', lb).onclick = () => go(-1);
  $('.lb-nav.r', lb).onclick = () => go(1);
  info.addEventListener('click', e => { if (e.target.closest('a,[data-act]')) close(); });
  let x0 = null, y0 = null;
  lb.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  lb.addEventListener('touchend', e => {
    if (x0 == null || stage.classList.contains('zoom')) { x0 = null; return; }
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
    else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) close();
    x0 = null;
  });
  img.classList.add('in');
  show();
}

export function notFound() {
  return { html: `<div class="empty" style="margin-top:40px"><b>Tahle stránka neexistuje</b><p>Možná se ztratila jako Kubovy přezůvky.</p><a class="btn btn-ink" href="#/">Na úvod</a></div>` };
}
