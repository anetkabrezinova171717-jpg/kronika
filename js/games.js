// Hry + skóre + žebříček
import { S, gradeList, imgSrc, cmPhoto, person, ids, classmates, currentClass, addScore, setPlayer, vis, inQuiz, photoGrade } from './store.js';
import { $, esc, shuffle, sample, toast, openSheet, closeSheet, scribble, ICON } from './ui.js';

export const GAMES = [
  { id: 'prezdivky', title: 'Poznej podle přezdívky', short: 'Kdo je „Koblížek“?', bg: 'var(--yellow)', fg: 'var(--ink)', emoji: '🏷️' },
  { id: 'fotka', title: 'Kdo je na fotce?', short: 'Poznej spolužáka na fotografii', bg: 'var(--pink)', fg: '#fff', emoji: '📸' },
  { id: 'hlaska', title: 'Doplň hlášku', short: 'Které slovo v hlášce chybí?', bg: 'var(--green)', fg: '#fff', emoji: '💬' },
  { id: 'rok', title: 'Poznej rok', short: 'Ze které třídy je ta fotka?', bg: 'var(--blue)', fg: '#fff', emoji: '🗓️' },
];
const ROUNDS = 10;
const key = s => String(s || '').trim().toLowerCase();

export function leaderboard() {
  const by = {};
  for (const s of S.db.scores) {
    const k = key(s.player);
    if (!k) continue;
    by[k] ||= { player: s.player.trim(), games: {} };
    by[k].games[s.game] = Math.max(by[k].games[s.game] || 0, s.points);
  }
  return Object.values(by)
    .map(x => ({ ...x, total: Object.values(x.games).reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total || a.player.localeCompare(b.player, 'cs'));
}
const myRow = () => leaderboard().find(r => key(r.player) === key(S.player));

// ---------- otázky ----------
function build(id) {
  const cm = currentClass();
  const name = c => c.name;
  const opts = (correct, label) => shuffle([correct, ...sample(cm.filter(x => x.id !== correct.id), 3)]).map(x => ({ label: label(x), ok: x.id === correct.id }));
  const imgBox = p => `<div class="q-img"><img src="${esc(imgSrc(p, 1100))}" data-fid="${esc(p.fileId || '')}" alt="" onerror="__imgErr(this)"></div>`;

  if (id === 'prezdivky') {
    const pool = cm.filter(c => c.nickname);
    if (!pool.length || cm.length < 4) return null;
    return sample(pool, ROUNDS).map(c => ({ prompt: `Kdo je <mark>„${esc(c.nickname)}“</mark>?`, options: opts(c, name) }));
  }
  if (id === 'fotka') {
    const items = [];
    for (const p of vis(S.db.photos).filter(p => p.source !== 'profile')) {
      const who = ids(p.people);
      if (who.length === 1 && person(who[0])) items.push({ p, c: person(who[0]) });
    }
    cm.filter(c => cmPhoto(c)).forEach(c => items.push({ p: { url: c.photoUrl, fileId: c.photoId }, c }));
    if (!items.length || cm.length < 4) return null;
    return sample(items, ROUNDS).map(({ p, c }) => ({ prompt: 'Kdo je na fotce?', media: imgBox(p), options: opts(c, name) }));
  }
  if (id === 'hlaska') {
    // Doplň hlášku: v hlášce chybí jedno slovo, vybírá se ze 4 možností (ostatní slova z jiných hlášek)
    const texts = [...new Set([...vis(S.db.quotes).map(q => q.text), ...cm.map(c => c.quote)].map(t => String(t || '').trim()).filter(Boolean))];
    const WORD = /[\p{L}]+/gu;
    const words = t => [...t.matchAll(WORD)].map(m => ({ w: m[0], at: m.index }));
    const lc = s => s.toLocaleLowerCase('cs');
    const items = [];
    for (const t of texts) {
      const ws = words(t);
      if (ws.length < 2) continue;
      const cand = ws.filter(x => x.w.length >= 4);
      if (!cand.length) continue;
      const longest = Math.max(...cand.map(x => x.w.length));
      const pick = sample(cand.filter(x => x.w.length >= Math.min(longest, 5) || x === ws[ws.length - 1]), 1)[0];
      const pool = [...new Set(texts.filter(o => o !== t).flatMap(o => words(o).map(x => x.w)).filter(w => w.length >= 4 && lc(w) !== lc(pick.w)).map(lc))];
      if (pool.length < 3) continue;
      const near = pool.sort((x, y) => Math.abs(x.length - pick.w.length) - Math.abs(y.length - pick.w.length)).slice(0, 12);
      const cap = w => (pick.w[0] === pick.w[0].toLocaleUpperCase('cs') ? w[0].toLocaleUpperCase('cs') + w.slice(1) : w);
      items.push({ t, pick, decoys: sample(near, 3).map(cap) });
    }
    if (items.length < 3) return null;
    return sample(items, ROUNDS).map(({ t, pick, decoys }) => ({
      prompt: 'Doplň hlášku',
      media: `<blockquote class="q-quote">„${esc(t.slice(0, pick.at))}<span class="q-gap">…</span>${esc(t.slice(pick.at + pick.w.length))}“</blockquote>`,
      options: shuffle([{ label: pick.w, ok: true }, ...decoys.map(d => ({ label: d, ok: false }))]),
    }));
  }
  if (id === 'rok') {
    const gl = gradeList();
    // jen fotky, které vybral administrátor (Admin → Hra: Poznej rok); třída podle akce
    const gradeOfP = photoGrade;
    const ps = vis(S.db.photos).filter(inQuiz);
    if (ps.length < 3) return null;
    // střídat třídy, aby nebylo 10 fotek z jednoho výletu
    const byGrade = {};
    shuffle(ps).forEach(p => (byGrade[gradeOfP(p)] ||= []).push(p));
    const picked = [];
    const queues = shuffle(Object.values(byGrade));
    while (picked.length < ROUNDS && queues.some(q => q.length)) for (const q of queues) if (q.length && picked.length < ROUNDS) picked.push(q.shift());
    return picked.map(p => {
      const g = gradeOfP(p);
      const others = sample([1, 2, 3, 4, 5, 6, 7, 8, 9].filter(n => n !== g), 3);
      return {
        prompt: 'Ze které třídy je tahle fotka?',
        media: imgBox(p),
        options: shuffle([g, ...others]).map(n => ({ label: `${n}. třída · ${gl[n - 1].years}`, ok: n === g })),
      };
    });
  }
  return null;
}

// ---------- rozcestník her ----------
export function gamesView() {
  const me = myRow();
  const lb = leaderboard().slice(0, 10);
  return {
    html: `
    <section class="page-head">
      <span class="pill">🎮 Hry</span>
      <h1>Kdo si ${scribble('pamatuje', 'var(--lime)')} víc?</h1>
      <p>Čtyři hry o naší třídě. Za každou správnou odpověď +1 bod.</p>
    </section>
    <div class="me-card">
      <div><small>Hraješ jako</small><b>${S.player ? esc(S.player) : 'zatím bez jména'}</b><button class="link" id="chg-name">${S.player ? 'změnit' : 'zadat jméno'}</button></div>
      <div class="me-score"><small>Tvoje skóre</small><b>${me ? me.total : 0}</b></div>
    </div>
    <div class="games">
      ${GAMES.map((g, i) => `<a class="game-card reveal" href="#/hry/${g.id}" style="--gb:${g.bg};--gf:${g.fg};--r:${[-1.5, 1.2, 1.4, -1.2][i]}deg;--d:${i * 70}ms">
        ${ICON.clip}<span class="g-emoji">${g.emoji}</span><b>${esc(g.title)}</b><small>${esc(g.short)}</small>
        <span class="g-best">${me?.games[g.id] != null ? `Tvůj rekord: ${me.games[g.id]}` : 'Hrát →'}</span></a>`).join('')}
    </div>
    <section class="sec">
      <div class="lb-card">
        <h2>${ICON.trophy} Žebříček třídy</h2>
        <p class="fine">Součet nejlepších výsledků ze všech čtyř her (max. ${GAMES.length * ROUNDS} bodů).</p>
        ${lb.length ? `<ol class="lb-list">${lb.map((r, i) => `<li class="${key(r.player) === key(S.player) ? 'me' : ''}"><span class="lb-pos">${i + 1}.</span><span class="lb-name">${esc(r.player)}</span><span class="lb-pts">${r.total} b.</span></li>`).join('')}</ol>` : '<p>Zatím nikdo nehrál. Buď první!</p>'}
      </div>
    </section>`,
    mount() { $('#chg-name').onclick = () => askName(() => S.rerender()); },
  };
}

export function askName(done) {
  const body = openSheet(`<h2 class="sheet-title">Jak se jmenuješ?</h2><p>Pod tímhle jménem se zapíšeš do žebříčku třídy.</p>
    <form class="form" id="nm"><div class="field"><input name="n" maxlength="30" placeholder="např. Anča" value="${esc(S.player)}" autocomplete="nickname"></div>
    <button class="btn btn-ink btn-block">Uložit a hrát</button></form>`);
  const f = $('#nm', body);
  setTimeout(() => f.n.focus(), 350);
  f.onsubmit = e => { e.preventDefault(); const v = f.n.value.trim(); if (!v) return toast('Napiš jméno nebo přezdívku', 'err'); setPlayer(v); closeSheet(); done && done(); };
}

// ---------- samotná hra ----------
export function gameView(id) {
  const g = GAMES.find(x => x.id === id);
  if (!g) return { html: '<div class="empty"><b>Hra nenalezena</b><a class="btn btn-ink" href="#/hry">Zpět</a></div>' };
  return {
    html: `<section class="game" style="--gb:${g.bg};--gf:${g.fg}">
      <div class="game-top"><a href="#/hry" class="back">${ICON.left} Hry</a><span class="pill">${g.emoji} ${esc(g.title)}</span></div>
      <div id="quiz"></div></section>`,
    mount() { start(g); },
  };
}

function start(g) {
  const el = $('#quiz');
  if (!el) return;
  if (!S.player) {
    el.innerHTML = `<div class="q-card center"><p>Nejdřív nám řekni, kdo hraje.</p><button class="btn btn-ink" id="nm-btn">Zadat jméno</button></div>`;
    $('#nm-btn').onclick = () => askName(() => start(g));
    askName(() => start(g));
    return;
  }
  const qs = build(g.id);
  if (!qs || !qs.length) {
    el.innerHTML = `<div class="q-card center"><b>Na tuhle hru zatím nemáme dost dat.</b><p class="fine">${g.id === 'fotka' ? 'Potřebujeme aspoň 4 spolužáky a fotky, na kterých je označený jeden člověk (nebo profilovky).' : g.id === 'hlaska' ? 'Potřebujeme aspoň 3 hlášky. Administrátor je doplní v Adminu → Hlášky.' : g.id === 'rok' ? 'Fotky do této hry vybírá administrátor (Admin → Hra: Poznej rok). Zatím jich je vybráno méně než 3.' : 'Potřebujeme aspoň 4 spolužáky s přezdívkami.'}</p><a class="btn btn-ink" href="#/hry">Zpět na hry</a></div>`;
    return;
  }
  let i = 0, score = 0;
  const show = () => {
    const q = qs[i];
    delete el.dataset.locked;
    el.innerHTML = `
      <div class="q-progress"><span style="width:${(i / qs.length) * 100}%"></span></div>
      <div class="q-meta"><span>Otázka ${i + 1} / ${qs.length}</span><span>Body: <b id="q-score">${score}</b></span></div>
      <div class="q-card in">
        <h2 class="q-prompt">${q.prompt}</h2>
        ${q.media || ''}
        <div class="opts">${q.options.map((o, k) => `<button class="opt" data-k="${k}"><span class="opt-l">${'ABCD'[k]}</span><span>${esc(o.label)}</span></button>`).join('')}</div>
      </div>
      <div class="q-next"></div>`;
    el.querySelectorAll('.opt').forEach(b => b.onclick = () => {
      if (el.dataset.locked) return;
      el.dataset.locked = '1';
      const o = q.options[b.dataset.k];
      const btns = el.querySelectorAll('.opt');
      if (o.ok) { score++; b.classList.add('ok'); b.insertAdjacentHTML('beforeend', '<span class="plus1">+1</span>'); }
      else { b.classList.add('bad'); btns[q.options.findIndex(x => x.ok)].classList.add('ok'); }
      btns.forEach(x => x.disabled = true);
      $('#q-score').textContent = score;
      const last = i === qs.length - 1;
      $('.q-next', el).innerHTML = `<button class="btn btn-ink btn-block">${last ? 'Zobrazit výsledek' : 'Další otázka'} ${ICON.right}</button>`;
      $('.q-next button', el).onclick = () => { if (last) finish(); else { i++; show(); window.scrollTo({ top: 0, behavior: 'smooth' }); } };
    });
  };
  const finish = async () => {
    const pct = score / qs.length;
    const msg = pct === 1 ? 'Dokonalé! Pamatuješ si úplně všechno. 🏆' : pct >= .7 ? 'Super! Tohle je třídní paměť. 🎉' : pct >= .4 ? 'Dobrý! Ještě kolečko? 😉' : 'Hmm, asi je čas listovat kronikou. 📖';
    el.innerHTML = `<div class="q-card center result">
      <small>Tvoje skóre</small>
      <div class="big-score">${score}<span>/${qs.length}</span></div>
      <p>${msg}</p>
      <p class="fine" id="save-state"><span class="spin"></span> Ukládám do žebříčku…</p>
      <div class="col"><button class="btn btn-ink" id="again">Hrát znovu</button><a class="btn btn-ghost" href="#/hry">Žebříček a další hry</a></div>
    </div>`;
    $('#again').onclick = () => start(g);
    try {
      await addScore({ id: 's' + Date.now().toString(36), player: S.player, game: g.id, points: score, total: qs.length, createdAt: new Date().toISOString() });
      const me = myRow();
      const t = me ? me.total : score;
      $('#save-state') && ($('#save-state').innerHTML = `Uloženo ✓ · Celkem máš <b>${t}</b> ${t === 1 ? 'bod' : t >= 2 && t <= 4 ? 'body' : 'bodů'}`);
    } catch (err) {
      $('#save-state') && ($('#save-state').textContent = 'Skóre se nepodařilo uložit: ' + err.message);
    }
  };
  show();
}
