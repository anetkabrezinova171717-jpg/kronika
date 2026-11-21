// ADMIN MÓD – správa celé kroniky bez úprav kódu
import * as api from './api.js';
import {
  S, LS, COLORS, gradeList, gradeOf, eventsOf, photosOfEvent, albumPhotos, imgSrc, isVideo, videoLinkOk, cmPhoto, person, ids, uid,
  classmates, eventById, photoById, save, remove, uploadPhoto, load, quizCheck, inQuiz, photoGrade, inShow, hasFlag, withFlag,
} from './store.js';
import { $, $$, esc, fmtDate, ICON, scribble, openForm, toast, closeSheet } from './ui.js';
import { avatar } from './views.js';
import { leaderboard, GAMES } from './games.js';

let tab = 'inbox';
let photoFilter = 'all';
let quizFilter = 'tip';   // výběr fotek do hry: tip | sel | 1..9
let quizN = 60;
let showGrade = 1;        // výběr fotek k promítání: zobrazená třída

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
    ['show', `Promítání <i>${S.db.photos.filter(inShow).length}</i>`],
    ['grades', 'Ročníky'],
    ['classmates', 'Spolužáci'],
    ['quotes', 'Hlášky'],
    ['scores', 'Skóre'],
  ];
  const panels = { inbox: () => inboxPanel(inbox), upload: uploadPanel, import: importPanel, events: eventsPanel, photos: photosPanel, quiz: quizPanel, show: showPanel, grades: gradesPanel, classmates: classmatesPanel, quotes: quotesPanel, scores: scoresPanel };
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
  if (tab === 'show') mountShow();
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
  </form>
  <form class="form card" id="vid" novalidate style="margin-top:16px">
    <h3 style="margin:0">${ICON.video} Přidat video</h3>
    <p class="fine">Vlož odkaz na video z <b>YouTube</b> (klidně neveřejné) nebo z <b>Google Disku</b>. Na Disku nastav u videa sdílení <b>„Kdokoli s odkazem“</b>, jinak ho ostatní nepřehrají. Video se ukáže mezi fotkami s ikonou ▶.</p>
    <div class="field"><label>Odkaz na video</label><input name="url" type="url" placeholder="https://youtu.be/… nebo https://drive.google.com/file/d/…" required></div>
    <div class="field"><label>Ročník</label><select name="grade">${gradeOpts().map(o => `<option value="${o.v}">${esc(o.l)}</option>`).join('')}</select></div>
    <div class="field"><label>Událost <em>(nepovinné)</em></label><select name="eventId"></select></div>
    <div class="field"><label>Popisek <em>(nepovinné)</em></label><input name="caption" maxlength="200"></div>
    <div class="field"><label>Autor</label><input name="author" value="Kronika" maxlength="60"></div>
    <button class="btn btn-ink btn-block" id="v-go">Přidat video</button>
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
  const vf = $('#vid');
  const vfill = () => {
    const evs = Number(vf.grade.value) ? eventsOf(Number(vf.grade.value)) : [];
    vf.eventId.innerHTML = `<option value="">— bez události —</option>` + evs.map(e => `<option value="${esc(e.id)}">${esc(e.title)}</option>`).join('');
    vf.eventId.disabled = !evs.length;
  };
  vf.grade.onchange = vfill; vfill();
  vf.onsubmit = async e => {
    e.preventDefault();
    const url = vf.url.value.trim();
    if (!videoLinkOk(url)) return toast('Tohle nevypadá jako odkaz na YouTube nebo Google Disk', 'err');
    const btn = $('#v-go'); btn.disabled = true;
    try {
      const ev = eventById(vf.eventId.value);
      await save('photos', { id: uid('v'), fileId: '', url, source: 'video', grade: ev ? ev.grade : Number(vf.grade.value), eventId: vf.eventId.value,
        caption: vf.caption.value.trim(), author: vf.author.value.trim(), people: '', order: '', hidden: false, createdAt: new Date().toISOString(), w: 16, h: 9 });
      toast('Video přidáno'); vf.url.value = ''; vf.caption.value = '';
    } catch (err) { toast(err.message, 'err'); }
    btn.disabled = false;
  };
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
  try { await load(); } catch {}   // čerstvý stav z tabulky

  const norm = t => String(t || '').normalize('NFC').trim().toLowerCase();
  const key = (g, t) => `${Number(g)}|${norm(t)}`;
  const cnt = id => S.db.photos.filter(p => p.eventId === id).length;
  const total = pkg.events.reduce((a, e) => a + e.photos.length, 0) + pkg.loose.reduce((a, l) => a + l.photos.length, 0);

  // Co už v tabulce je: zdvojené akce (z dvojitého importu) a kolik fotek ještě chybí
  const analyze = () => {
    const groups = {};
    for (const e of S.db.events) (groups[key(e.grade, e.title)] ||= []).push(e);
    const keep = {}, dups = [];
    for (const [k, evs] of Object.entries(groups)) {
      const sorted = evs.slice().sort((x, y) => cnt(y.id) - cnt(x.id) || String(x.createdAt).localeCompare(String(y.createdAt)));
      keep[k] = sorted[0];
      dups.push(...sorted.slice(1));
    }
    const dupIds = new Set(dups.map(d => d.id));
    const dupPhotos = S.db.photos.filter(p => dupIds.has(p.eventId));
    const plan = [];
    let remaining = 0;
    for (const e of pkg.events) {
      const ex = keep[key(e.grade, e.title)];
      const todo = e.photos.slice(ex ? cnt(ex.id) : 0);   // fotky jdou popořadě → přeskočit už nahrané
      remaining += todo.length;
      plan.push({ e, ex, todo });
    }
    for (const l of pkg.loose) {
      const have = S.db.photos.filter(p => !p.eventId && norm(p.caption) === norm(l.caption)).length;
      const todo = l.photos.slice(have);
      remaining += todo.length;
      plan.push({ loose: l, todo });
    }
    return { dups, dupPhotos, plan, remaining };
  };

  // pojistka proti spuštění importu dvakrát v tomto prohlížeči
  const LOCK = 'kronika-import-lock';
  const lockedByOther = () => { const t = Number(LS.get(LOCK) || 0); return Date.now() - t < 30000; };

  // verze importu je uložená v tabulce (list grades, řádek id = „import“) – platí ve všech prohlížečích
  const pkgVer = String(pkg.version || 1);
  const sheetVer = () => String(S.db.grades.find(g => String(g.id) === 'import')?.title || '');
  const markVer = () => save('grades', { id: 'import', title: pkgVer });
  const oldImport = () => {
    const ps = S.db.photos.filter(p => p.source === 'admin');
    return { ps, evs: S.db.events };
  };
  const needsReset = () => {
    const o = oldImport();
    return (o.ps.length || o.evs.length) && sheetVer() !== pkgVer;
  };

  const render = () => {
    const st = analyze();
    if (needsReset()) {
      const o = oldImport();
      box.innerHTML = `<b>${esc(pkg.source)}</b>
        <div class="imp-warn">V kronice je dřívější import (<b>${o.ps.length}</b> fotek, <b>${o.evs.length}</b> akcí) podle staršího výběru. Nový výběr ho celý nahradí.
        Fotky od spolužáků a profilovky zůstanou. Smazané soubory půjdou do koše na Google Disku (30 dní jde obnovit).
        <button class="btn btn-danger btn-block" id="imp-reset" style="margin-top:10px">Nahradit starý import novým výběrem</button></div>
        <p class="fine" style="margin-top:8px">Smazání trvá asi 10–15 minut. Pak se automaticky spustí nahrávání nového výběru.</p>
        <div class="b-log" id="imp-log"></div>`;
      $('#imp-reset').onclick = async e => {
        if (!confirm(`Smazat ${o.ps.length} dříve importovaných fotek a ${o.evs.length} akcí a nahrát nový výběr?`)) return;
        if (lockedByOther()) return toast('Import už běží v jiné kartě tohoto prohlížeče.', 'err');
        const btn = e.target; btn.disabled = true;
        const beat = setInterval(() => LS.set(LOCK, String(Date.now())), 5000);
        try {
          let k = 0;
          for (const p of o.ps) { k++; btn.innerHTML = `<span class="spin"></span> Mažu fotky ${k} / ${o.ps.length}`; await remove('photos', p.id); }
          k = 0;
          for (const ev of o.evs) { k++; btn.innerHTML = `<span class="spin"></span> Mažu akce ${k} / ${o.evs.length}`; await remove('events', ev.id); }
          await markVer();
          toast('Starý import smazán ✓ – spouštím nahrávání');
          try { await load(); } catch {}
          clearInterval(beat); LS.set(LOCK, null);   // uvolnit pojistku, ať se nahrávání může spustit
          render();
          $('#imp-go')?.click();
        } catch (err) { toast(err.message, 'err'); btn.disabled = false; btn.textContent = 'Zkusit znovu'; clearInterval(beat); LS.set(LOCK, null); }
      };
      return;
    }
    const doneN = total - st.remaining;
    box.innerHTML = `<b>${esc(pkg.source)}</b>
      <p class="fine">${pkg.events.length} akcí a ${total} fotek. Fotky se nahrají jako obsah administrátora, akce se vytvoří v příslušných ročnících.</p>
      <div class="imp-state"><b>${doneN}</b> z ${total} fotek už je v kronice · zbývá <b>${st.remaining}</b></div>
      ${st.dups.length ? `<div class="imp-warn">⚠️ Našel jsem <b>${st.dups.length}</b> zdvojených akcí (<b>${st.dupPhotos.length}</b> fotek) – nejspíš z dvojitého importu. Před pokračováním je ukliď.
        <button class="btn btn-danger btn-block" id="imp-dedupe" style="margin-top:10px">Uklidit duplicity</button></div>` : ''}
      ${api.DEMO ? `<label class="check" style="margin-top:14px"><input type="checkbox" id="imp-clear" ${doneN ? '' : 'checked'}><span>Nejdřív smazat ukázková data (demo)</span></label>` : ''}
      ${pkg.classmates?.length || pkg.quotes?.length ? `<p class="fine" style="margin-top:10px">👋 Navíc ${pkg.classmates?.length || 0} spolužáků a ${pkg.quotes?.length || 0} hlášek (přidají se jen ti, kteří v kronice ještě nejsou).</p>` : ''}
      <button class="btn btn-ink btn-block" id="imp-go" style="margin-top:14px" ${st.dups.length ? 'disabled' : ''}>${st.remaining === 0 ? 'Fotky jsou nahrané – doplnit spolužáky a hlášky' : doneN ? `Pokračovat v importu (zbývá ${st.remaining} fotek)` : `Importovat ${total} fotek`}</button>
      ${pkg.classmates?.length ? `<button class="btn btn-ghost btn-block" id="imp-people" style="margin-top:8px">Importovat jen spolužáky a hlášky</button>` : ''}
      ${textsTodo() ? `<button class="btn btn-ghost btn-block" id="imp-texts" style="margin-top:8px">Doplnit texty (${textsTodo()})</button>` : `<p class="fine" style="margin-top:8px">✓ Texty ročníků a akcí jsou doplněné.</p>`}
      <p class="fine" style="margin-top:8px">Import nech běžet jen v jednom okně. Když ho zavřeš, příště pokračuje tam, kde skončil.</p>
      <div class="b-log" id="imp-log"></div>`;
    mountButtons(st);
  };

  // spolužáci + hlášky (bez duplicit podle jména / textu)
  const importPeople = async () => {
    let n = 0;
    const names = new Set(S.db.classmates.map(c => norm(c.name)));
    for (const c of pkg.classmates || []) {
      if (names.has(norm(c.name))) continue;
      await save('classmates', { id: uid('c'), name: c.name, nickname: c.nickname || '', bio: c.bio || '', quote: c.quote || '', photoId: '', photoUrl: '', order: c.order ?? '', hidden: false, left: !!c.left });
      n++;
    }
    const texts = new Set(S.db.quotes.map(q => norm(q.text)));
    for (const q of pkg.quotes || []) {
      if (texts.has(norm(q.text))) continue;
      await save('quotes', { id: uid('q'), text: q.text, author: q.author || '', grade: q.grade || 0, context: q.context || '', hidden: false });
      n++;
    }
    return n;
  };

  // texty z balíčku: úvody ročníků, texty/data/pořadí akcí, akce jen s textem
  const textsTodo = () => {
    let n = 0;
    for (const g of pkg.grades || []) {
      const cur = S.db.grades.find(x => String(x.id) === String(g.id));
      if (!cur || norm(cur.intro) !== norm(g.intro)) n++;
    }
    for (const e of pkg.events) {
      const ex = S.db.events.find(x => key(x.grade, x.title) === key(e.grade, e.title));
      if (!ex) { if (!e.photos.length) n++; continue; }
      if ((e.text && norm(ex.text) !== norm(e.text)) || (e.date && String(ex.date) !== String(e.date))) n++;
    }
    return n;
  };
  const applyTexts = async () => {
    let n = 0;
    for (const g of pkg.grades || []) {
      const cur = S.db.grades.find(x => String(x.id) === String(g.id));
      if (!cur || norm(cur.intro) !== norm(g.intro)) { await save('grades', { id: String(g.id), intro: g.intro }); n++; }
    }
    for (const e of pkg.events) {
      const ex = S.db.events.find(x => key(x.grade, x.title) === key(e.grade, e.title));
      if (!ex) {
        if (!e.photos.length) { await save('events', { id: uid('e'), grade: e.grade, title: e.title, date: e.date || '', order: e.order ?? '', place: e.place || '', text: e.text || '', createdAt: new Date().toISOString() }); n++; }
        continue;
      }
      const patch = {};
      if (e.text && norm(ex.text) !== norm(e.text)) patch.text = e.text;
      if (e.date && String(ex.date) !== String(e.date)) patch.date = e.date;
      if (Object.keys(patch).length) { await save('events', { id: ex.id, ...patch }); n++; }
    }
    return n;
  };

  const mountButtons = st => {
    $('#imp-texts') && ($('#imp-texts').onclick = async e => {
      const b = e.target; b.disabled = true; b.innerHTML = '<span class="spin"></span> Doplňuji texty…';
      try { const n = await applyTexts(); toast(`Doplněno ${n} textů`); } catch (err) { toast(err.message, 'err'); }
      render();
    });
    $('#imp-people') && ($('#imp-people').onclick = async e => {
      e.target.disabled = true;
      try { const n = await importPeople(); toast(`Přidáno ${n} záznamů`); render(); }
      catch (err) { toast(err.message, 'err'); e.target.disabled = false; }
    });

    $('#imp-dedupe') && ($('#imp-dedupe').onclick = async e => {
      if (!confirm(`Smazat ${st.dups.length} zdvojených akcí a ${st.dupPhotos.length} fotek? Soubory půjdou do koše na Google Disku (30 dní jde obnovit). Původní akce a fotky zůstanou.`)) return;
      const btn = e.target; btn.disabled = true;
      let k = 0;
      try {
        for (const p of st.dupPhotos) { k++; btn.innerHTML = `<span class="spin"></span> Mažu ${k} / ${st.dupPhotos.length}`; await remove('photos', p.id); }
        for (const d of st.dups) await remove('events', d.id);
        toast('Duplicity uklizené ✓');
      } catch (err) { toast(err.message, 'err'); }
      try { await load(); } catch {}
      render();
    });

    $('#imp-go').onclick = async () => {
      if (lockedByOther()) return toast('Import už běží v jiné kartě tohoto prohlížeče.', 'err');
      const btn = $('#imp-go'), log = $('#imp-log');
      btn.disabled = true;
      const beat = setInterval(() => LS.set(LOCK, String(Date.now())), 5000);
      LS.set(LOCK, String(Date.now()));
      try {
        if (sheetVer() !== pkgVer) await markVer();
        if (api.DEMO && $('#imp-clear')?.checked) { api.clearDemo(); await load(); }
        const plan = analyze().plan;
        const todoTotal = plan.reduce((a, x) => a + x.todo.length, 0);
        let i = 0, ok = 0;
        // položka fotky může být "cesta" nebo { f, w, h, faces, taken, quiz }
        const put = async (entry, meta) => {
          const path = typeof entry === 'string' ? entry : entry.f;
          i++;
          btn.innerHTML = `<span class="spin"></span> ${api.DEMO ? 'Přidávám' : 'Nahrávám'} ${i} / ${todoTotal}`;
          try {
            if (api.DEMO) {
              await save('photos', { id: uid('p'), fileId: '', url: 'import/' + path, ...meta, people: '', order: i, hidden: false,
                createdAt: new Date().toISOString(), w: entry.w || 0, h: entry.h || 0 });
            } else {
              const blob = await (await fetch('import/' + path)).blob();
              await uploadPhoto(new File([blob], path.split('/').pop(), { type: blob.type || 'image/jpeg' }), meta);
            }
            ok++;
          } catch (err) { log.insertAdjacentHTML('beforeend', `<div class="err">✗ ${esc(path)} – ${esc(err.message)}</div>`); }
        };
        for (const x of plan) {
          if (x.loose) {
            for (const p of x.todo) await put(p, { grade: x.loose.grade || 0, caption: x.loose.caption || '', author: pkg.author, source: 'admin' });
            continue;
          }
          const e = x.e;
          let ev = x.ex;
          if (!ev) ev = await save('events', { id: uid('e'), grade: e.grade, title: e.title, date: e.date || '', order: e.order ?? '', place: e.place || '', text: e.text || '', createdAt: new Date().toISOString() });
          for (const p of x.todo) await put(p, { grade: e.grade, eventId: ev.id, caption: '', author: pkg.author, source: 'admin',
            ...(typeof p === 'object' && p.faces !== undefined ? { faces: p.faces, taken: p.taken || '' } : {}),
            ...(typeof p === 'object' && p.quiz === 'yes' ? { quiz: 'yes' } : {}) });
          if (x.todo.length) log.insertAdjacentHTML('beforeend', `<div>✓ ${e.grade}. tř. – ${esc(e.title)}</div>`);
        }
        await importPeople();
        await applyTexts();
        await markVer();
        toast(`Importováno ${ok} fotek`);
        // načíst čerstvý stav z tabulky a ukázat, co případně ještě zbývá (log chyb zůstane)
        const logHTML = log.innerHTML;
        try { await load(); } catch {}
        render();
        const nb = $('#imp-go'), nl = $('#imp-log');
        if (nl) nl.innerHTML = logHTML;
        if (nb && !analyze().plan.some(x => x.todo.length)) { nb.disabled = true; nb.textContent = `Hotovo – nahráno ${ok} fotek`; }
      } catch (err) { toast(err.message, 'err'); btn.disabled = false; btn.textContent = 'Zkusit znovu'; }
      finally { clearInterval(beat); LS.set(LOCK, null); }
    };
  };

  render();
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
      await save('photos', { id: p.id, quiz: withFlag(p, 'yes', on) });
      const n = S.db.photos.filter(inQuiz).length;
      $('.quiz-count') && ($('.quiz-count').innerHTML = `<b>${n}</b> fotek ve hře${n < 3 ? ' · hra potřebuje aspoň 3' : ''}`);
      const t = $('[data-atab="quiz"] i'); t && (t.textContent = n);
    } catch (e) { b.classList.toggle('picked', !on); toast(e.message, 'err'); }
  });
}

// ---------- výběr fotek k promítání ----------
function showPanel() {
  const all = albumPhotos().filter(p => photoGrade(p) >= 1 && photoGrade(p) <= 9);
  const total = all.filter(inShow).length;
  const perGrade = n => all.filter(p => photoGrade(p) === n && inShow(p)).length;
  const groups = [];
  for (const e of eventsOf(showGrade)) {
    const ps = photosOfEvent(e.id);
    if (ps.length) groups.push({ title: e.title, ps });
  }
  const loose = all.filter(p => photoGrade(p) === showGrade && !eventById(p.eventId));
  if (loose.length) groups.push({ title: 'Fotky bez akce', ps: loose });
  const tile = p => `<button class="adm-ph ${inShow(p) ? 'picked' : ''}" data-sp="${esc(p.id)}" style="${gStyle(photoGrade(p))}">${thumb(p)}<span class="qp-check">✓</span></button>`;
  return `<p class="fine">Klepnutím vyber fotky, které se budou promítat. Když nevybereš žádnou, promítání si fotky vybere samo. Promítají se v pořadí tříd a akcí.</p>
    <div class="quiz-count"><b>${total}</b> fotek k promítání</div>
    <div class="chips-scroll small">${gradeList().map(g => `<button class="fchip ${showGrade === g.n ? 'on' : ''}" data-sg="${g.n}" style="${gStyle(g.n)}">${g.n}. třída${perGrade(g.n) ? ` <i>${perGrade(g.n)}</i>` : ''}</button>`).join('')}</div>
    ${groups.map((g, gi) => `<div class="show-group">
      <div class="show-group-h"><b>${esc(g.title)}</b><small>${g.ps.filter(inShow).length} / ${g.ps.length}</small>
      <button class="link" data-sall="${gi}">${g.ps.every(inShow) ? 'Zrušit vše' : 'Vybrat vše'}</button></div>
      <div class="adm-grid quiz-grid">${g.ps.slice(0, 120).map(tile).join('')}</div>
      ${g.ps.length > 120 ? `<p class="fine">Zobrazeno prvních 120 z ${g.ps.length} fotek.</p>` : ''}
    </div>`).join('') || '<p class="fine">V této třídě zatím nejsou fotky.</p>'}`;
}
function mountShow() {
  $$('[data-sg]').forEach(b => b.onclick = () => { showGrade = Number(b.dataset.sg); done(); });
  const setOne = async (p, on, b) => {
    b && b.classList.toggle('picked', on);
    await save('photos', { id: p.id, quiz: withFlag(p, 'show', on) });
  };
  const refreshCount = () => {
    const n = S.db.photos.filter(inShow).length;
    $('.quiz-count') && ($('.quiz-count').innerHTML = `<b>${n}</b> fotek k promítání`);
    const t = $('[data-atab="show"] i'); t && (t.textContent = n);
  };
  $$('[data-sp]').forEach(b => b.onclick = async () => {
    const p = photoById(b.dataset.sp);
    const on = !inShow(p);
    try { await setOne(p, on, b); refreshCount(); } catch (e) { b.classList.toggle('picked', !on); toast(e.message, 'err'); }
  });
  $$('[data-sall]').forEach(btn => btn.onclick = async () => {
    const grid = btn.closest('.show-group').querySelector('.quiz-grid');
    const tiles = $$('[data-sp]', grid);
    const on = !tiles.every(t => t.classList.contains('picked'));
    btn.disabled = true;
    for (const t of tiles) { const p = photoById(t.dataset.sp); if (inShow(p) !== on) { try { await setOne(p, on, t); } catch (e) { toast(e.message, 'err'); break; } } }
    done();
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
  const vid = isVideo(p);
  openForm({
    title: vid ? 'Upravit video' : 'Upravit fotku',
    values: { ...p, quiz: hasFlag(p, 'yes') ? 'yes' : '', show: hasFlag(p, 'show') },
    intro: `<div class="form-prev">${thumb(p, 700)}<p class="fine">${p.source === 'classmate' ? `👥 Přidal/a spolužák: <b>${esc(p.author || '?')}</b>` : '⭐ Obsah administrátora'} · ${esc(fmtDate(p.createdAt))}</p></div>`,
    fields: [
      ...(vid ? [{ k: 'url', label: 'Odkaz na video', help: 'YouTube nebo Google Disk (sdílení „Kdokoli s odkazem“).' }] : []),
      { k: 'grade', label: 'Ročník', type: 'select', options: gradeOpts() },
      { k: 'eventId', label: 'Událost', type: 'select', options: eventOpts(), help: 'Když vybereš událost, fotka se přesune do jejího ročníku.' },
      { k: 'caption', label: 'Popisek', opt: true },
      { k: 'author', label: 'Autor / kdo přidal', opt: true },
      { k: 'people', label: 'Kdo je na fotce', type: 'people', options: peopleOpts(), opt: true, help: 'Fotky s 1–6 označenými lidmi se použijí ve hře „Kdo je na fotce?“.' },
      { k: 'order', label: 'Pořadí v události', type: 'number', opt: true, help: 'Nižší číslo = dřív. První fotka je velká.' },
      ...(vid ? [] : [{ k: 'quiz', label: 'Ve hře „Poznej rok“', type: 'select', options: [{ v: '', l: 'Ne' }, { v: 'yes', l: 'Ano, použít ve hře' }], help: quizCheck(p).ok ? '⭐ Návrh: jsou na ní lidé a datum sedí do školního roku.' : `Automatický návrh: ne (${quizCheck(p).why}).` },
      { k: 'show', label: 'Promítání', type: 'check', text: 'Promítat tuto fotku' }]),
      { k: 'hidden', label: 'Skrýt', type: 'check', text: 'Skrýt fotku (ostatní ji neuvidí)' },
    ],
    onSubmit: async v => {
      if (vid && !videoLinkOk(v.url)) throw new Error('Tohle nevypadá jako odkaz na YouTube nebo Google Disk');
      const ev = eventById(v.eventId);
      const { show, ...rest } = v;
      rest.quiz = withFlag({ quiz: withFlag(p, 'yes', v.quiz === 'yes') }, 'show', show);
      await save('photos', { ...rest, id: p.id, grade: ev ? ev.grade : Number(v.grade) });
      done();
    },
    onDelete: async () => { await remove('photos', p.id); done(); },
    deleteText: vid ? 'Smazat video z kroniky? (Samotné video na YouTube / Disku zůstane.)' : api.DEMO ? 'Smazat fotku?' : 'Smazat fotku? Soubor se přesune do koše na Google Disku (30 dní jde obnovit).',
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
