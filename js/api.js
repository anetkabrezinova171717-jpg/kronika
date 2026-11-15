// Datová vrstva: Google Apps Script (Sheets + Drive), nebo DEMO v localStorage.
import { CONFIG } from './config.js';
import { SEED } from './demo-data.js';

export const TABLES = ['grades', 'events', 'photos', 'classmates', 'quotes', 'scores'];
export const DEMO = !CONFIG.API_URL;
export const DEMO_PASSWORD = 'demo';
const CACHE_KEY = 'kronika-cache-v1';
const DEMO_KEY = 'kronika-demo-v1';

export const empty = () => Object.fromEntries(TABLES.map(t => [t, []]));
export const BOOL = v => v === true || v === 1 || /^(true|1|ano|yes|x)$/i.test(String(v ?? '').trim());
const num = v => (v === '' || v == null || isNaN(Number(v)) ? null : Number(v));

export function normalize(raw) {
  const out = {};
  for (const t of TABLES) {
    out[t] = (raw?.[t] || [])
      .filter(r => r && r.id !== '' && r.id != null)
      .map(r => {
        const o = { ...r, id: String(r.id) };
        for (const k of Object.keys(o)) {
          if (o[k] == null) o[k] = '';
          // názvy ze souborů na Macu bývají v rozložené podobě (NFD) → sjednotit
          else if (typeof o[k] === 'string' && !o[k].startsWith('data:')) o[k] = o[k].normalize('NFC');
        }
        o.hidden = BOOL(o.hidden);
        o.order = num(o.order);
        if (t === 'photos' || t === 'events' || t === 'quotes') o.grade = Number(o.grade) || 0;
        if (t === 'photos') {
          o.w = Number(o.w) || 0; o.h = Number(o.h) || 0;
          o.eventId = o.eventId ? String(o.eventId) : '';
          o.source = o.source || 'admin';
          o.faces = o.faces === '' ? null : Number(o.faces);   // null = nezjištěno
          o.taken = String(o.taken || '').slice(0, 10);
          o.quiz = o.quiz || '';
        }
        if (t === 'classmates') o.left = BOOL(o.left);
        if (t === 'scores') { o.points = Number(o.points) || 0; o.player = String(o.player || ''); }
        return o;
      });
  }
  return out;
}

export function cached() {
  if (DEMO) return null;
  try { const s = localStorage.getItem(CACHE_KEY); return s ? normalize(JSON.parse(s)) : null; } catch { return null; }
}
export function writeCache(db) {
  if (DEMO) return;
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(db)); } catch { /* plné úložiště – nevadí */ }
}

// ---------- DEMO ----------
let demo = null;
function D() {
  if (!demo) {
    try { demo = JSON.parse(localStorage.getItem(DEMO_KEY) || 'null'); } catch { demo = null; }
    if (!demo) demo = JSON.parse(JSON.stringify(SEED));
    for (const t of TABLES) demo[t] ||= [];
  }
  return demo;
}
function persist() {
  try { localStorage.setItem(DEMO_KEY, JSON.stringify(demo)); }
  catch { throw new Error('Úložiště prohlížeče je plné (demo režim). Propoj kroniku s Google Diskem – viz návod.'); }
}
// Demo: smaže ukázkový obsah (ponechá jen to, co přidal admin importem)
export function clearDemo() { demo = empty(); persist(); }
export function resetDemo() { try { localStorage.removeItem(DEMO_KEY); } catch {} demo = null; }
const needDemoAdmin = key => { if (key !== DEMO_PASSWORD) throw new Error('Nejsi přihlášený jako administrátor.'); };

// ---------- REMOTE ----------
async function post(payload) {
  let r, j;
  try {
    // text/plain = „simple request“, Apps Script pak nepotřebuje CORS preflight
    r = await fetch(CONFIG.API_URL, { method: 'POST', body: JSON.stringify(payload) });
  } catch { throw new Error('Nepodařilo se spojit se serverem. Zkontroluj internet.'); }
  try { j = await r.json(); } catch { throw new Error('Server vrátil neplatnou odpověď. Je Apps Script správně nasazený?'); }
  if (!j.ok) throw new Error(j.error || 'Chyba serveru');
  return j;
}

export async function fetchAll(key) {
  if (DEMO) return { db: normalize(D()), admin: key === DEMO_PASSWORD };
  let j;
  if (key) j = await post({ action: 'all', key });
  else {
    const r = await fetch(CONFIG.API_URL + '?action=all&_=' + Date.now());
    j = await r.json();
    if (!j.ok) throw new Error(j.error || 'Chyba serveru');
  }
  const db = normalize(j.data);
  writeCache(db);
  return { db, admin: !!j.admin };
}

export async function auth(key) {
  if (DEMO) { if (key !== DEMO_PASSWORD) throw new Error('Špatné heslo. V demo režimu je heslo „demo“.'); return true; }
  await post({ action: 'auth', key });
  return true;
}

export async function save(table, row, key) {
  if (DEMO) {
    needDemoAdmin(key);
    const a = (D()[table] ||= []);
    const i = a.findIndex(r => String(r.id) === String(row.id));
    if (i >= 0) a[i] = { ...a[i], ...row }; else a.push({ ...row });
    persist();
    return i >= 0 ? a[i] : row;
  }
  return (await post({ action: 'save', key, table, row })).row;
}

export async function remove(table, id, key) {
  if (DEMO) { needDemoAdmin(key); D()[table] = D()[table].filter(r => String(r.id) !== String(id)); persist(); return; }
  await post({ action: 'delete', key, table, id });
}

export async function addScore(row) {
  if (DEMO) { D().scores.push(row); persist(); return row; }
  return (await post({ action: 'score', row })).row;
}

export async function upload(file, meta, key) {
  const img = await compress(file, DEMO ? 1000 : 1800, DEMO ? 0.72 : 0.82);
  const m = { ...meta, w: img.w, h: img.h };
  if (DEMO) {
    const isAdmin = key === DEMO_PASSWORD;
    const row = {
      id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      fileId: '', url: img.dataUrl,
      grade: Number(m.grade) || 0, eventId: m.eventId || '',
      caption: m.caption || '', author: m.author || '',
      source: isAdmin ? (m.source || 'admin') : 'classmate',
      people: isAdmin ? (m.people || '') : '', order: '',
      hidden: isAdmin && m.hidden ? true : false,
      createdAt: new Date().toISOString(), w: img.w, h: img.h,
    };
    D().photos.push(row);
    try { persist(); } catch (e) { D().photos.pop(); throw e; }
    return row;
  }
  return (await post({ action: 'upload', key, data: img.data, mime: 'image/jpeg', meta: m })).row;
}

// Profilovou fotku si může nastavit každý sám (bez hesla) – mění se jen fotka daného spolužáka
export async function setProfilePhoto(file, id, key) {
  const img = await compress(file, DEMO ? 600 : 900, DEMO ? 0.72 : 0.82);
  if (DEMO) {
    const c = D().classmates.find(x => String(x.id) === String(id));
    if (!c) throw new Error('Spolužák nenalezen');
    const old = c.photoUrl;
    c.photoUrl = img.dataUrl; c.photoId = '';
    try { persist(); } catch (e) { c.photoUrl = old; throw e; }
    return { ...c };
  }
  return (await post({ action: 'profile', key, id, data: img.data, mime: 'image/jpeg' })).row;
}

// Zmenšení fotky v telefonu před odesláním (rychlejší upload, méně místa na Disku)
async function compress(file, max, quality) {
  if (!file || !/^image\//.test(file.type || 'image/')) throw new Error('Vyber prosím obrázek.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('Tenhle formát fotky neumím otevřít. Zkus JPG nebo PNG.'));
      i.src = url;
    });
    const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * s);
    c.height = Math.round(img.naturalHeight * s);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const dataUrl = c.toDataURL('image/jpeg', quality);
    return { dataUrl, data: dataUrl.split(',')[1], w: c.width, h: c.height };
  } finally { URL.revokeObjectURL(url); }
}
