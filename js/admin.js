// ADMIN MÓD – správa celé kroniky bez úprav kódu
import * as api from './api.js';
import {
  S, LS, COLORS, gradeList, gradeOf, eventsOf, photosOfEvent, albumPhotos, imgSrc, cmPhoto, person, ids, uid,
  classmates, eventById, photoById, save, remove, uploadPhoto, load, quizCheck, inQuiz, photoGrade,
} from './store.js';
import { $, $$, esc, fmtDate, ICON, scribble, openForm, toast, closeSheet } from './ui.js';
import { avatar } from './views.js';
import { leaderboard, GAMES } from './games.js';

let tab = 'inbox';
let photoFilter = 'all';
let quizFilter = 'tip';   // výběr fotek do hry: tip | sel | 1..9
let quizN = 60;

const gradeOpts = (withZero = true) => [...(withZero ? [{ v: 0, l: '— Nezařazeno (ke zařazení) —' }] : []), ...gradeList().map(g => ({ v: g.n, l: `${g.title} (${g.years})` }))];
const eventOpts = () => [{ v: '', l: '— bez události —' }, ...gradeList().flatMap(g => eventsOf(g.n).map(e => ({ v: e.id, l: `${g.n}. tř. · ${e.title}` })))];
const peopleOpts = () => classmates().map(c => ({ v: c.id, l: c.nickname ? `${c.name.split(' ')[0]} („${c.nickname}“)` : c.name }));
const gStyle = n => { const c = COLORS[n] || COLORS[0]; return `--g:${c.bg};--gi:${c.ink};--gs:${c.soft}`; };
const thumb = (p, w = 300) => `<img loading="lazy" src="${esc(imgSrc(p, w))}" data-fid="${esc(p.fileId || '')}" alt="" onerror="__imgErr(this)">`;
const done = () => S.rerender();

// ---------- přihlášení ----------
function loginView() {
  return {
    html: `<section class="page-head">
      <span class="pill">${ICON.lock} Administrace</span>
      <h1>Admin ${scribble('mód', 'var(--orange)')}</h1>
      <p>Pro úpravy kroniky zadej heslo administrátora.${api.DEMO ? ' V demo režimu je heslo <b>demo</b>.' : ''}</p>
    </section>
    <form class="form card" id="login">
      <div class="field"><label for="pw">Heslo</label><input id="pw" type="password" name="pw" autocomplete="current-password"></div>
      <button class="btn btn-ink btn-block">Přihlásit</button>
    </form>`,
    mount() {
      $('#login').onsubmit = async e => {
        e.preventDefault();
        const pw = e.target.pw.value;
        const btn = e.target.querySelector('button');
        btn.disabled = true; btn.textContent = 'Ověřuji…';
        try {
          await api.auth(pw);
          S.key = pw; LS.set('kronika-admin-key', pw);
          await load();
          toast('Admin mód zapnutý ✓');
          done();
        } catch (err) { toast(err.message, 'err'); btn.disabled = false; btn.textContent = 'Přihlásit'; }
      };
    },
  };
}

// ---------- hlavní panel ----------
export function adminView() {
  if (!S.admin) return loginView();
  const inbox = albumPhotos().filter(p => !(p.grade >= 1) && !eventById(p.eventId));
  const tabs = [
    ['inbox', `Ke zařazení${inbox.length ? ` <i>${inbox.length}</i>` : ''}`],
    ['upload', 'Nahrát fotky'],
    ['import', 'Import archivu'],
    ['events', 'Události'],
    ['photos', 'Fotky'],
    ['quiz', `Hra: Poznej rok <i>${S.db.photos.filter(inQuiz).length}</i>`],
    ['grades', 'Ročníky'],
    ['classmates', 'Spolužáci'],
    ['quotes', 'Hlášky'],
    ['scores', 'Skóre'],
  ];
  const panels = { inbox: () => inboxPanel(inbox), upload: uploadPanel, import: importPanel, events: eventsPanel, photos: photosPanel, quiz: quizPanel, grades: gradesPanel, classmates: classmatesPanel, quotes: quotesPanel, scores: scoresPanel };
  return {
    html: `<section class="page-head compact">
      <span class="pill admin-pill">${ICON.lock} Admin mód${api.DEMO ? ' · demo' : ''}</span>
      <h1>Správa ${scribble('kroniky', 'var(--orange)')}</h1>
      <p>Změny se ukládají hned a uvidí je všichni. Upravovat můžeš i přímo v kronice – u obsahu uvidíš tlačítka „Upravit“.</p>
    </section>
    <div class="chips-scroll adm-tabs">${tabs.map(([k, l]) => `<button class="fchip ${tab === k ? 'on' : ''}" data-atab="${k}">${l}</button>`).join('')}</div>
    <div class="adm-panel">${(panels[tab] || panels.inbox)()}</div>
    <div class="adm-foot">
      <button class="btn btn-ghost btn-sm" id="adm-refresh">Načíst znovu</button>
      ${api.DEMO ? '<button class="btn btn-ghost btn-sm" id="adm-reset">Obnovit ukázková data</button>' : ''}
      <button class="btn btn-ghost btn-sm" id="adm-out">Odhlásit</button>
    </div>`,
    mount() {
      $$('[data-atab]').forEach(b => b.onclick = () => { tab = b.dataset.atab; done(); });
      $('#adm-out').onclick = () => { S.key = ''; S.admin = false; LS.set('kronika-admin-key', null); load().finally(done); toast('Odhlášeno'); };
      $('#adm-refresh').onclick = async () => { try { await load(); toast('Načteno'); done(); } catch (e) { toast(e.message, 'err'); } };
      $('#adm-reset') && ($('#adm-reset').onclick = async () => { if (!confirm('Smazat všechny změny v demo režimu a vrátit ukázková data?')) return; api.resetDemo(); await load(); done(); });
      mountPanel();
    },
  };
}

function mountPanel() {
  if (tab === 'inbox') {
    $$('[data-setg]').forEach(b => b.onclick = async () => {
      const card = b.closest('[data-pid]');
      b.disabled = true;
      try { await save('photos', { id: card.dataset.pid, grade: Number(b.dataset.setg), eventId: '' }); toast(`Přesunuto do ${b.dataset.setg}. třídy`); done(); }
      catch (e) { toast(e.message, 'err'); b.disabled = false; }
    });
    $$('[data-delp]').forEach(b => b.onclick = async () => {
      if (!confirm(api.DEMO ? 'Smazat tuto fotku?' : 'Smazat fotku? Soubor se přesune do koše na Google Disku (30 dní jde obnovit).')) return;
      b.disabled = true;
      try { await remove('photos', b.dataset.delp); b.closest('.ibx').remove(); toast('Smazáno'); }
      catch (e) { toast(e.message, 'err'); b.disabled = false; }
    });
  }
  if (tab === 'upload') mountUpload();
  if (tab === 'import') mountImport();
  if (tab === 'quiz') mountQuiz();
  if (tab === 'photos') $$('[data-pf]').forEach(b => b.onclick = () => { photoFilter = b.dataset.pf; done(); });
  if (tab === 'scores') $$('[data-del-score]').forEach(b => b.onclick = async () => {
    if (!confirm('Smazat tento záznam skóre?')) return;
    try { await remove('scores', b.dataset.delScore); done(); } catch (e) { toast(e.message, 'err'); }
  });
}

// ---------- panely ----------
function inboxPanel(list) {
  if (!list.length) return `<div class="empty"><b>Nic ke zařazení 🎉</b><p>Fotky, u kterých spolužák zvolí „Nevím / zařadit později“, se objeví tady.</p></div>`;
  return `<p class="fine">Klepni na číslo třídy a fotka se rovnou přesune. Přes „Upravit“ ji můžeš přiřadit i k události.</p>
  <div class="ibx-list">${list.map(p => `<div class="ibx" data-pid="${esc(p.id)}">
    <div class="ibx-top">${thumb(p, 400)}<div><b>${esc(p.caption || 'Bez popisku')}</b><small>${p.author ? 'od ' + esc(p.author) + ' · ' : ''}${esc(fmtDate(p.createdAt))}</small>
    <div class="row"><button class="adm-btn" data-act="edit-photo" data-id="${esc(p.id)}">${ICON.edit}<span>Upravit</span></button>
    <button class="adm-btn adm-del" data-delp="${esc(p.id)}">${ICON.x}<span>Smazat</span></button></div></div></div>
    <div class="ibx-g">${gradeList().map(g => `<button data-setg="${g.n}" style="${gStyle(g.n)}">${g.n}.</button>`).join('')}</div>
  </div>`).join('')}</div>`;
}

function uploadPanel() {
  return `<form class="form card" id="bulk" novalidate>
    <p class="fine">Hromadné nahrání tvých fotek. Fotky se označí jako <b>obsah administrátora</b>. Tip: nejdřív vytvoř událost (záložka Události), pak k ní nahraj fotky. Nebo vše nahraj jako „Nezařazeno“ a roztřiď v záložce Ke zařazení.</p>
    <label class="drop"><input type="file" accept="image/*" multiple id="b-files"><span class="drop-ic">${ICON.image}</span><b id="b-count">Vybrat fotky</b><small>Klidně desítky najednou</small></label>
    <div class="field"><label>Ročník</label><select name="grade">${gradeOpts().map(o => `<option value="${o.v}">${esc(o.l)}</option>`).join('')}</select></div>
    <div class="field"><label>Událost <em>(nepovinné)</em></label><select name="eventId"></select></div>
    <div class="field"><label>Popisek <em>(stejný pro všechny, nepovinné)</em></label><input name="caption" maxlength="200"></div>
    <div class="field"><label>Autor</label><input name="author" value="Kronika" maxlength="60"></div>
    <button class="btn btn-ink btn-block" id="b-go">Nahrát</button>
    <div id="b-log" class="b-log"></div>
  </form>`;
}
function mountUpload() {
  const f = $('#bulk');
  const fill = () => {
    const n = Number(f.grade.value);
    const evs = n ? eventsOf(n) : [];
    f.eventId.innerHTML = `<option value="">— bez události —</option>` + evs.map(e => `<option value="${esc(e.id)}">${esc(e.title)}</option>`).join('');
    f.eventId.disabled = !evs.length;
  };
  f.grade.onchange = fill; fill();
  $('#b-files').onchange = e => { $('#b-count').textContent = e.target.files.length ? `Vybráno ${e.target.files.length} fotek` : 'Vybrat fotky'; };
  f.onsubmit = async e => {
    e.preventDefault();
    const files = [...$('#b-files').files];
    if (!files.length) return toast('Vyber fotky', 'err');
    const btn = $('#b-go'), log = $('#b-log');
    btn.disabled = true;
    const meta = { grade: Number(f.grade.value), eventId: f.eventId.value, caption: f.caption.value.trim(), author: f.author.value.trim(), source: 'admin' };
    let ok = 0;
    for (let i = 0; i < files.length; i++) {
      btn.innerHTML = `<span class="spin"></span> Nahrávám ${i + 1} / ${files.length}`;
      try { await uploadPhoto(files[i], meta); ok++; log.insertAdjacentHTML('beforeend', `<div>✓ ${esc(files[i].name)}</div>`); }
      catch (err) { log.insertAdjacentHTML('beforeend', `<div class="err">✗ ${esc(files[i].name)} – ${esc(err.message)}</div>`); }
    }
    btn.disabled = false; btn.textContent = 'Nahrát další';
    $('#b-files').value = ''; $('#b-count').textContent = 'Vybrat fotky';
    toast(`Nahráno ${ok} z ${files.length}`);
  };
}

// ---------- import připraveného balíčku (složka import/ vedle aplikace) ----------
function importPanel() {
  return `<div class="card" id="imp"><p class="fine"><span class="spin"></span> Hledám balíček import/import.json…</p></div>`;
}
async function mountImport() {
  const box = $('#imp');
  let pkg;
  try {
    const r = await fetch('import/import.json', { cache: 'no-store' });
    if (!r.ok) throw new Error();
    pkg = await r.json();
  } catch {
    box.innerHTML = `<b>Žádný balíček k importu</b><p class="fine">Import funguje, když vedle aplikace leží složka <code>import/</code> se souborem <code>import.json</code>. Spusť ho z počítače (lokálně), ne z GitHub Pages – fotky na GitHub nepatří.</p>`;
    return;
  }
  const total = pkg.events.reduce((a, e) => a + e.photos.length, 0) + pkg.loose.reduce((a, l) => a + l.photos.length, 0);
  const doneAt = LS.get('kronika-import-done');
  box.innerHTML = `<b>${esc(pkg.source)}</b>
    <p class="fine">${pkg.events.length} událostí a ${total} fotek. Fotky se nahrají jako obsah administrátora (autor „${esc(pkg.author)}“), události se vytvoří v příslušných ročnících. Fotky bez události půjdou do „Ke zařazení“.</p>
    <div class="adm-list">${pkg.events.map(e => `<div class="adm-row-i" style="${gStyle(e.grade)}"><span class="adm-dot"></span><span><b>${esc(e.title)}</b><small>${e.grade}. třída${e.date ? ' · ' + esc(fmtDate(e.date)) : ''} · ${e.photos.length} fotek</small></span></div>`).join('')}
    ${pkg.loose.map(l => `<div class="adm-row-i"><span class="adm-dot"></span><span><b>${esc(l.caption)}</b><small>Ke zařazení · ${l.photos.length} fotek</small></span></div>`).join('')}</div>
    ${api.DEMO ? `<label class="check" style="margin-top:14px"><input type="checkbox" id="imp-clear" checked><span>Nejdřív smazat ukázková data (demo)</span></label>` : ''}
    ${doneAt ? `<p class="fine" style="margin-top:10px">⚠️ Tento balíček už byl importován ${esc(fmtDate(doneAt))}. Další import vytvoří duplikáty.</p>` : ''}
    ${pkg.classmates?.length || pkg.quotes?.length ? `<p class="fine" style="margin-top:10px">👋 Navíc ${pkg.classmates?.length || 0} spolužáků a ${pkg.quotes?.length || 0} hlášek (při importu se přidají ti, kteří v kronice ještě nejsou).</p>` : ''}
    <button class="btn btn-ink btn-block" id="imp-go" style="margin-top:14px">Importovat ${total} fotek${pkg.classmates?.length ? ' a spolužáky' : ''}</button>
    ${pkg.classmates?.length ? `<button class="btn btn-ghost btn-block" id="imp-people" style="margin-top:8px">Importovat jen spolužáky a hlášky</button>` : ''}
    <div class="b-log" id="imp-log"></div>`;
  // spolužáci + hlášky (bez duplicit podle jména / textu)
  const importPeople = async () => {
    let n = 0;
    const names = new Set(S.db.classmates.map(c => c.name.trim().toLowerCase()));
    for (const c of pkg.classmates || []) {
      if (names.has(c.name.trim().toLowerCase())) continue;
      await save('classmates', { id: uid('c'), name: c.name, nickname: c.nickname || '', bio: c.bio || '', quote: c.quote || '', photoId: '', photoUrl: '', order: c.order ?? '', hidden: false, left: !!c.left });
      n++;
    }
    const texts = new Set(S.db.quotes.map(q => q.text.trim()));
    for (const q of pkg.quotes || []) {
      if (texts.has(q.text.trim())) continue;
      await save('quotes', { id: uid('q'), text: q.text, author: q.author || '', grade: q.grade || 0, context: q.context || '', hidden: false });
      n++;
    }
    return n;
  };
  $('#imp-people') && ($('#imp-people').onclick = async e => {
    e.target.disabled = true;
    try { const n = await importPeople(); toast(`Přidáno ${n} záznamů`); done(); }
    catch (err) { toast(err.message, 'err'); e.target.disabled = false; }
  });
  $('#imp-go').onclick = async () => {
    const btn = $('#imp-go'), log = $('#imp-log');
    btn.disabled = true;
    if (api.DEMO && $('#imp-clear')?.checked) { api.clearDemo(); await load(); }
    let i = 0, ok = 0;
    // položka fotky může být "cesta" nebo { f, w, h }
    const put = async (entry, meta) => {
      const path = typeof entry === 'string' ? entry : entry.f;
      i++;
      btn.innerHTML = `<span class="spin"></span> ${api.DEMO ? 'Přidávám' : 'Nahrávám'} ${i} / ${total}`;
      try {
        if (api.DEMO) {
          // demo: fotky by se do prohlížeče nevešly → jen odkaz na soubor v balíčku
          await save('photos', { id: uid('p'), fileId: '', url: 'import/' + path, ...meta, people: '', order: i, hidden: false,
            createdAt: new Date().toISOString(), w: entry.w || 0, h: entry.h || 0 });
        } else {
          const blob = await (await fetch('import/' + path)).blob();
          await uploadPhoto(new File([blob], path.split('/').pop(), { type: blob.type || 'image/jpeg' }), meta);
        }
        ok++;
      } catch (err) { log.insertAdjacentHTML('beforeend', `<div class="err">✗ ${esc(path)} – ${esc(err.message)}</div>`); }
    };
    try {
      for (const e of pkg.events) {
        const ev = await save('events', { id: uid('e'), grade: e.grade, title: e.title, date: e.date || '', order: e.order ?? '', place: e.place || '', text: e.text || '', createdAt: new Date().toISOString() });
        for (const p of e.photos) await put(p, { grade: e.grade, eventId: ev.id, caption: '', author: pkg.author, source: 'admin',
          ...(typeof p === 'object' && p.faces !== undefined ? { faces: p.faces, taken: p.taken || '' } : {}),
          ...(typeof p === 'object' && p.quiz === 'yes' ? { quiz: 'yes' } : {}) });
        log.insertAdjacentHTML('beforeend', `<div>✓ ${e.grade}. tř. – ${esc(e.title)}</div>`);
      }
      for (const l of pkg.loose) for (const p of l.photos) await put(p, { grade: l.grade || 0, caption: l.caption || '', author: pkg.author, source: 'admin' });
      await importPeople();
      LS.set('kronika-import-done', new Date().toISOString().slice(0, 10));
      btn.textContent = `Hotovo – ${ok} z ${total} fotek`;
      toast(`Importováno ${ok} fotek`);
    } catch (err) { toast(err.message, 'err'); btn.disabled = false; btn.textContent = 'Zkusit znovu'; }
  };
}

function eventsPanel() {
  return gradeList().map(g => {
    const evs = eventsOf(g.n);
    return `<div class="adm-group" style="${gStyle(g.n)}">
      <div class="adm-group-h"><b>${esc(g.title)}</b><button class="adm-btn" data-act="add-event" data-id="${g.n}">${ICON.plus}<span>Událost</span></button></div>
      ${evs.map(e => `<button class="adm-row-i" data-act="edit-event" data-id="${esc(e.id)}">
        <span><b>${esc(e.title)}</b><small>${esc(fmtDate(e.date))}${e.place ? ' · ' + esc(e.place) : ''} · ${photosOfEvent(e.id).length} fotek${e.hidden ? ' · skryté' : ''}</small></span>${ICON.edit}</button>`).join('') || '<p class="fine">Zatím žádné události.</p>'}
    </div>`;
  }).join('');
}

// ---------- výběr fotek do hry „Poznej rok“ ----------
function quizPanel() {
  const all = albumPhotos().filter(p => photoGrade(p) >= 1 && photoGrade(p) <= 9);
  const selected = all.filter(inQuiz).length;
  let list = all;
  if (quizFilter === 'tip') list = all.filter(p => quizCheck(p).ok);
  else if (quizFilter === 'sel') list = all.filter(inQuiz);
  else if (/^\d$/.test(quizFilter)) list = all.filter(p => photoGrade(p) === Number(quizFilter));
  const chips = [['tip', '⭐ Návrhy'], ['sel', `✓ Vybrané (${selected})`], ...gradeList().map(g => [String(g.n), `${g.n}. třída`])];
  return `<p class="fine">Klepnutím vyber fotky do hry „Ze které třídy je tahle fotka?“. Vyber ty, na kterých je něco poznat a víš, že jsou opravdu z dané třídy. ⭐ = návrh (jsou na ní lidé a datum sedí do školního roku).</p>
    <div class="quiz-count"><b>${selected}</b> fotek ve hře${selected < 3 ? ' · hra potřebuje aspoň 3' : ''}</div>
    <div class="chips-scroll small">${chips.map(([v, l]) => `<button class="fchip ${quizFilter === v ? 'on' : ''}" data-qf="${v}">${l}</button>`).join('')}</div>
    <div class="adm-grid quiz-grid">${list.slice(0, quizN).map(p => `<button class="adm-ph ${inQuiz(p) ? 'picked' : ''}" data-qp="${esc(p.id)}" style="${gStyle(photoGrade(p))}">
      ${thumb(p)}<span class="adm-ph-g">${photoGrade(p)}</span>${quizCheck(p).ok ? '<span class="adm-ph-s">⭐</span>' : ''}<span class="qp-check">✓</span></button>`).join('') || '<p class="fine">Nic tu není.</p>'}</div>
    ${list.length > quizN ? `<button class="btn btn-ghost btn-block" id="q-more">Zobrazit další (${list.length - quizN})</button>` : ''}`;
}
function mountQuiz() {
  $$('[data-qf]').forEach(b => b.onclick = () => { quizFilter = b.dataset.qf; quizN = 60; done(); });
  $('#q-more') && ($('#q-more').onclick = () => { quizN += 60; done(); });
  $$('[data-qp]').forEach(b => b.onclick = async () => {
    const p = photoById(b.dataset.qp);
    const on = !inQuiz(p);
    b.classList.toggle('picked', on);           // hned ukázat, uložit na pozadí
    try {
      await save('photos', { id: p.id, quiz: on ? 'yes' : '' });
      const n = S.db.photos.filter(inQuiz).length;
      $('.quiz-count') && ($('.quiz-count').innerHTML = `<b>${n}</b> fotek ve hře${n < 3 ? ' · hra potřebuje aspoň 3' : ''}`);
      const t = $('[data-atab="quiz"] i'); t && (t.textContent = n);
    } catch (e) { b.classList.toggle('picked', !on); toast(e.message, 'err'); }
  });
}

function photosPanel() {
  let list = albumPhotos();
  const gOf = p => eventById(p.eventId)?.grade ?? p.grade;
  if (photoFilter === 'mates') list = list.filter(p => p.source === 'classmate');
  else if (photoFilter === 'hidden') list = list.filter(p => p.hidden);
  else if (/^\d$/.test(photoFilter)) list = list.filter(p => gOf(p) === Number(photoFilter));
  list = list.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const chips = [['all', 'Vše'], ['mates', 'Od spolužáků'], ['hidden', 'Skryté'], ['0', 'Nezařazené'], ...gradeList().map(g => [String(g.n), `${g.n}.`])];
  return `<div class="chips-scroll small">${chips.map(([v, l]) => `<button class="fchip ${photoFilter === v ? 'on' : ''}" data-pf="${v}">${l}</button>`).join('')}</div>
    <p class="fine">${list.length} fotek. Klepni na fotku pro úpravu, přesun, skrytí nebo smazání.</p>
    <div class="adm-grid">${list.map(p => `<button class="adm-ph ${p.hidden ? 'is-hidden' : ''}" data-act="edit-photo" data-id="${esc(p.id)}" style="${gStyle(gOf(p))}">
      ${thumb(p)}<span class="adm-ph-g">${gOf(p) || '?'}</span>${p.source === 'classmate' ? '<span class="adm-ph-s">👥</span>' : ''}${p.hidden ? `<span class="adm-ph-h">${ICON.eyeOff}</span>` : ''}</button>`).join('')}</div>`;
}

function gradesPanel() {
  return gradeList().map(g => `<button class="adm-row-i" data-act="edit-grade" data-id="${g.n}" style="${gStyle(g.n)}">
    <span class="adm-dot"></span><span><b>${esc(g.title)}</b><small>${esc(g.years)}${g.intro ? ' · ' + esc(g.intro.slice(0, 50)) + '…' : ''}</small></span>${ICON.edit}</button>`).join('');
}

function classmatesPanel() {
  const cm = classmates();
  return `<button class="btn btn-ink btn-sm" data-act="add-classmate">${ICON.plus} Přidat spolužáka</button>
    <div class="adm-list">${cm.map(c => `<button class="adm-row-i ${c.hidden ? 'is-hidden' : ''}" data-act="edit-classmate" data-id="${esc(c.id)}">
      ${avatar(c, 'sm')}<span><b>${esc(c.name)}</b><small>${c.nickname ? '„' + esc(c.nickname) + '“' : 'bez přezdívky'}</small></span>${ICON.edit}</button>`).join('') || '<p class="fine">Zatím nikdo.</p>'}</div>`;
}

function quotesPanel() {
  const qs = S.db.quotes;
  return `<button class="btn btn-ink btn-sm" data-act="add-quote">${ICON.plus} Přidat hlášku</button>
    <p class="fine">Hlášky se používají ve hře „Kdo to řekl?“ a v profilech spolužáků.</p>
    <div class="adm-list">${qs.map(q => `<button class="adm-row-i ${q.hidden ? 'is-hidden' : ''}" data-act="edit-quote" data-id="${esc(q.id)}">
      <span><b>„${esc(q.text)}“</b><small>${esc(person(q.author)?.name || 'autor neznámý – doplň')}${q.grade ? ` · ${q.grade}. třída` : ''}</small></span>${ICON.edit}</button>`).join('') || '<p class="fine">Zatím žádné hlášky.</p>'}</div>`;
}

function scoresPanel() {
  const lb = leaderboard();
  const raw = S.db.scores.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return `<div class="lb-card"><h2>${ICON.trophy} Žebříček</h2>${lb.length ? `<ol class="lb-list">${lb.map((r, i) => `<li><span class="lb-pos">${i + 1}.</span><span class="lb-name">${esc(r.player)}</span><span class="lb-pts">${r.total} b.</span></li>`).join('')}</ol>` : '<p>Prázdný.</p>'}</div>
    <h3 class="adm-h3">Všechny výsledky</h3>
    <div class="adm-list">${raw.map(s => `<div class="adm-row-i"><span><b>${esc(s.player)}</b><small>${esc(GAMES.find(g => g.id === s.game)?.title || s.game)} · ${s.points} b. · ${esc(fmtDate(s.createdAt))}</small></span>
      <button class="icon-btn" data-del-score="${esc(s.id)}" aria-label="Smazat">${ICON.x}</button></div>`).join('')}</div>`;
}

// ---------- formuláře (volané i z kroniky) ----------
export function editEvent(id, gradeForNew) {
  const e = id ? eventById(id) : null;
  openForm({
    title: e ? 'Upravit událost' : 'Nová událost',
    values: e || { grade: gradeForNew || 1 },
    fields: [
      { k: 'grade', label: 'Ročník', type: 'select', options: gradeOpts(false) },
      { k: 'title', label: 'Název události', ph: 'Výlet na hory' },
      { k: 'date', label: 'Datum', ph: '2020-02-12', help: 'Ideálně RRRR-MM-DD (řadí se podle něj). Můžeš napsat i „jaro 2020“.' },
      { k: 'place', label: 'Místo', opt: true, ph: 'Krkonoše' },
      { k: 'text', label: 'Text', type: 'textarea', rows: 8, opt: true, help: 'Prázdný řádek = nový odstavec. Odstavce se v kronice střídají s fotkami.' },
      { k: 'people', label: 'Kdo byl u toho / na fotkách', type: 'people', options: peopleOpts(), opt: true },
      { k: 'order', label: 'Pořadí', type: 'number', opt: true, help: 'Nech prázdné – události se seřadí podle data.' },
      { k: 'hidden', label: 'Skrýt', type: 'check', text: 'Skrýt událost (uvidíš ji jen ty)' },
    ],
    onSubmit: async v => {
      if (!v.title) throw new Error('Vyplň název');
      await save('events', { ...v, grade: Number(v.grade), id: e?.id || uid('e'), createdAt: e?.createdAt || new Date().toISOString() });
      done();
    },
    onDelete: e ? async () => { await remove('events', e.id); done(); } : null,
    deleteText: 'Smazat událost? Fotky zůstanou v kronice v sekci „Další fotky“ daného ročníku.',
  });
}

export function editPhoto(id) {
  const p = photoById(id);
  if (!p) return;
  openForm({
    title: 'Upravit fotku',
    values: p,
    intro: `<div class="form-prev">${thumb(p, 700)}<p class="fine">${p.source === 'classmate' ? `👥 Přidal/a spolužák: <b>${esc(p.author || '?')}</b>` : '⭐ Obsah administrátora'} · ${esc(fmtDate(p.createdAt))}</p></div>`,
    fields: [
      { k: 'grade', label: 'Ročník', type: 'select', options: gradeOpts() },
      { k: 'eventId', label: 'Událost', type: 'select', options: eventOpts(), help: 'Když vybereš událost, fotka se přesune do jejího ročníku.' },
      { k: 'caption', label: 'Popisek', opt: true },
      { k: 'author', label: 'Autor / kdo přidal', opt: true },
      { k: 'people', label: 'Kdo je na fotce', type: 'people', options: peopleOpts(), opt: true, help: 'Fotky s jedním označeným člověkem se použijí ve hře „Kdo je na fotce?“.' },
      { k: 'order', label: 'Pořadí v události', type: 'number', opt: true, help: 'Nižší číslo = dřív. První fotka je velká.' },
      { k: 'quiz', label: 'Ve hře „Poznej rok“', type: 'select', options: [{ v: '', l: 'Ne' }, { v: 'yes', l: 'Ano, použít ve hře' }], help: quizCheck(p).ok ? '⭐ Návrh: jsou na ní lidé a datum sedí do školního roku.' : `Automatický návrh: ne (${quizCheck(p).why}).` },
      { k: 'hidden', label: 'Skrýt', type: 'check', text: 'Skrýt fotku (ostatní ji neuvidí)' },
    ],
    onSubmit: async v => {
      const ev = eventById(v.eventId);
      await save('photos', { ...v, id: p.id, grade: ev ? ev.grade : Number(v.grade) });
      done();
    },
    onDelete: async () => { await remove('photos', p.id); done(); },
    deleteText: api.DEMO ? 'Smazat fotku?' : 'Smazat fotku? Soubor se přesune do koše na Google Disku (30 dní jde obnovit).',
    mount(form) {
      // změna ročníku → nabídni jen události z daného ročníku
      const sync = () => {
        const n = Number(form.grade.value);
        [...form.eventId.options].forEach(o => { if (!o.value) return; const e = eventById(o.value); o.hidden = !!n && e?.grade !== n; });
      };
      form.grade.onchange = () => { sync(); const e = eventById(form.eventId.value); if (e && e.grade !== Number(form.grade.value)) form.eventId.value = ''; };
      sync();
    },
  });
}

export function editGrade(n) {
  const g = gradeOf(Number(n));
  const ps = albumPhotos().filter(p => (eventById(p.eventId)?.grade ?? p.grade) === g.n);
  openForm({
    title: `Upravit ${g.n}. třídu`,
    values: g,
    fields: [
      { k: 'title', label: 'Název', ph: `${g.n}. třída` },
      { k: 'years', label: 'Školní rok', ph: '2019–2020' },
      { k: 'subtitle', label: 'Podtitulek', opt: true, ph: 'např. třídní učitelka Mgr. Nová' },
      { k: 'intro', label: 'Úvodní text', type: 'textarea', rows: 4, opt: true },
      { k: 'coverPhotoId', label: 'Titulní fotka', type: 'select', options: [{ v: '', l: '— automaticky (první fotka) —' }, ...ps.map(p => ({ v: p.id, l: (p.caption || 'Bez popisku') + ' · ' + (eventById(p.eventId)?.title || '') }))] },
    ],
    onSubmit: async v => { await save('grades', { ...v, id: String(g.n) }); done(); },
  });
}

export function editClassmate(id) {
  const c = id ? person(id) : null;
  openForm({
    title: c ? 'Upravit spolužáka' : 'Nový spolužák',
    values: c || {},
    intro: c && cmPhoto(c) ? `<div class="form-prev center">${avatar(c, 'arch')}</div>` : '',
    fields: [
      { k: 'name', label: 'Jméno a příjmení', ph: 'Anna Nováková' },
      { k: 'nickname', label: 'Přezdívka', opt: true, ph: 'Anča' },
      { k: 'bio', label: 'Krátký popis', type: 'textarea', rows: 3, opt: true, ph: 'Vždycky měla připravený fix.' },
      { k: 'quote', label: 'Oblíbená hláška', opt: true },
      { k: 'photo', label: c && cmPhoto(c) ? 'Změnit fotku' : 'Fotka', type: 'file', opt: true },
      { k: 'order', label: 'Pořadí', type: 'number', opt: true, help: 'Prázdné = podle abecedy.' },
      { k: 'left', label: 'Odešel/a', type: 'check', text: 'Odešel/a z třídy (zobrazí se v sekci „Byli s námi část cesty“)' },
      { k: 'hidden', label: 'Skrýt', type: 'check', text: 'Skrýt spolužáka' },
    ],
    onSubmit: async v => {
      if (!v.name) throw new Error('Vyplň jméno');
      const { photo, ...row } = v;
      row.id = c?.id || uid('c');
      if (photo) {
        const up = await uploadPhoto(photo, { grade: 0, source: 'profile', hidden: true, caption: v.name, author: 'Profil' });
        row.photoId = up.fileId || ''; row.photoUrl = up.url || '';
      }
      await save('classmates', row);
      done();
    },
    onDelete: c ? async () => { await remove('classmates', c.id); done(); } : null,
  });
}

export function editQuote(id) {
  const q = id ? S.db.quotes.find(x => x.id === id) : null;
  openForm({
    title: q ? 'Upravit hlášku' : 'Nová hláška',
    values: q || {},
    fields: [
      { k: 'text', label: 'Hláška', type: 'textarea', rows: 3, ph: 'To jsem nebyl já!' },
      { k: 'author', label: 'Kdo to řekl', type: 'select', options: [{ v: '', l: '— nevím (hláška třídy) —' }, ...peopleOpts()], help: 'Jen hlášky se známým autorem jsou ve hře „Kdo to řekl?“.' },
      { k: 'grade', label: 'Kdy (ročník)', type: 'select', options: [{ v: 0, l: '— nevím —' }, ...gradeOpts(false)] },
      { k: 'context', label: 'Souvislost', opt: true, ph: 'Při písemce z matiky' },
      { k: 'hidden', label: 'Skrýt', type: 'check', text: 'Skrýt hlášku' },
    ],
    onSubmit: async v => {
      if (!v.text) throw new Error('Vyplň hlášku');
      await save('quotes', { ...v, grade: Number(v.grade), id: q?.id || uid('q') });
      done();
    },
    onDelete: q ? async () => { await remove('quotes', q.id); done(); } : null,
  });
}

// Delegované akce z celé aplikace (tlačítka data-act)
export function handleAct(act, id) {
  if (!S.admin) return false;
  closeSheet();
  const map = {
    'edit-event': () => editEvent(id), 'add-event': () => editEvent(null, Number(id)),
    'edit-photo': () => editPhoto(id), 'edit-grade': () => editGrade(id),
    'edit-classmate': () => editClassmate(id), 'add-classmate': () => editClassmate(null),
    'edit-quote': () => editQuote(id), 'add-quote': () => editQuote(null),
  };
  if (!map[act]) return false;
  setTimeout(map[act], 10);
  return true;
}
