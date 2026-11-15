// Sdílený stav aplikace + pomocné funkce nad daty
import { CONFIG } from './config.js';
import * as api from './api.js';

// Barevná identita ročníků (0 = nezařazené)
export const COLORS = [
  { bg: '#D9D2C2', ink: '#1F1D36', soft: '#F1ECE0' },
  { bg: '#FFC83D', ink: '#1F1D36', soft: '#FFF2CC' }, // 1 žlutá
  { bg: '#FF5C8A', ink: '#FFFFFF', soft: '#FFE1EA' }, // 2 růžová
  { bg: '#1FAE6E', ink: '#FFFFFF', soft: '#D6F4E5' }, // 3 zelená
  { bg: '#2E5BFF', ink: '#FFFFFF', soft: '#DFE6FF' }, // 4 modrá
  { bg: '#FF8A34', ink: '#1F1D36', soft: '#FFE7D4' }, // 5 oranžová
  { bg: '#B9A2FF', ink: '#1F1D36', soft: '#EEE8FF' }, // 6 levandulová
  { bg: '#FFA98F', ink: '#1F1D36', soft: '#FFE9E1' }, // 7 broskvová
  { bg: '#BED2E9', ink: '#0E2A47', soft: '#E8EFF8' }, // 8 šedomodrá jako naše mikiny
  { bg: '#00A2CB', ink: '#0E2A47', soft: '#D3EEF6' }, // 9 tyrkysová jako naše trička
];

export const LS = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null || v === '' ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} },
};

export const S = {
  db: api.empty(),
  admin: false,
  key: LS.get('kronika-admin-key') || '',
  player: LS.get('kronika-player') || '',
  loaded: false,
  offline: false,
  rerender() {},
};

export const ids = v => String(v ?? '').split(',').map(s => s.trim()).filter(Boolean);
export const vis = arr => (S.admin ? arr : arr.filter(x => !x.hidden));
export const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function gradeList() {
  const y0 = Number(CONFIG.FIRST_SCHOOL_YEAR) || 2017;
  return Array.from({ length: 9 }, (_, i) => {
    const n = i + 1;
    const row = S.db.grades.find(g => String(g.id) === String(n)) || {};
    return {
      n,
      title: row.title || `${n}. třída`,
      years: row.years || `${y0 + i}–${y0 + i + 1}`,
      subtitle: row.subtitle || '',
      intro: row.intro || '',
      coverPhotoId: row.coverPhotoId || '',
      c: COLORS[n],
    };
  });
}
export const gradeOf = n => gradeList()[n - 1];

const big = 1e9;
const cmpEv = (a, b) => (a.order ?? big) - (b.order ?? big) || String(a.date).localeCompare(String(b.date)) || String(a.createdAt).localeCompare(String(b.createdAt));
const cmpPh = (a, b) => (a.source === 'classmate') - (b.source === 'classmate') || (a.order ?? big) - (b.order ?? big) || String(a.createdAt).localeCompare(String(b.createdAt));

export const albumPhotos = () => vis(S.db.photos).filter(p => p.source !== 'profile');
export const eventById = id => S.db.events.find(e => e.id === id);
export const eventsOf = n => vis(S.db.events).filter(e => Number(e.grade) === n).sort(cmpEv);
export const photosOfEvent = id => albumPhotos().filter(p => p.eventId === id).sort(cmpPh);
export function loosePhotos(n) {
  const evIds = new Set(vis(S.db.events).map(e => e.id));
  return albumPhotos().filter(p => p.grade === n && !evIds.has(p.eventId)).sort(cmpPh);
}
export const photosOfGrade = n => albumPhotos().filter(p => (eventById(p.eventId)?.grade ?? p.grade) === n);
export const photoById = id => S.db.photos.find(p => p.id === id);
export const person = id => S.db.classmates.find(c => c.id === id);
// podle abecedy – příjmení (poslední slovo jména), pak jméno
const surname = n => String(n || '').trim().split(/\s+/).pop();
export const classmates = () => vis(S.db.classmates).slice()
  .sort((a, b) => surname(a.name).localeCompare(surname(b.name), 'cs') || a.name.localeCompare(b.name, 'cs'));
export const currentClass = () => classmates().filter(c => !c.left);

// Školní rok n-té třídy: 1. 9. – 31. 8.
export function schoolYear(n) {
  const y0 = Number(CONFIG.FIRST_SCHOOL_YEAR) || 2017;
  return [`${y0 + n - 1}-09-01`, `${y0 + n}-08-31`];
}
// Ruční výběry administrátora se ukládají jako značky do sloupce „quiz“ (oddělené čárkou):
//   yes  = fotka je ve hře „Poznej rok“
//   show = fotka se promítá
export const flags = p => String(p?.quiz || '').split(',').map(s => s.trim()).filter(Boolean);
export const hasFlag = (p, f) => flags(p).includes(f);
export const withFlag = (p, f, on) => { const s = new Set(flags(p)); on ? s.add(f) : s.delete(f); return [...s].join(','); };

export const photoGrade = p => eventById(p.eventId)?.grade ?? p.grade;
export const inQuiz = p => hasFlag(p, 'yes') && p.source !== 'profile' && photoGrade(p) >= 1 && photoGrade(p) <= 9;
export const inShow = p => hasFlag(p, 'show') && !p.hidden && p.source !== 'profile';

// Jen NÁVRH pro výběr: na fotce jsou lidé a datum sedí do školního roku.
export function quizCheck(p) {
  const ev = eventById(p.eventId);
  const g = ev?.grade ?? p.grade;
  if (p.source === 'profile' || !(g >= 1 && g <= 9)) return { ok: false, why: 'není zařazená do třídy' };
  if (p.faces == null) return { ok: false, why: 'obličeje nezjištěné' };
  if (p.faces < 1) return { ok: false, why: 'nejsou na ní lidé' };
  const [a, b] = schoolYear(g);
  const inYear = d => /^\d{4}-\d{2}-\d{2}/.test(d || '') && d.slice(0, 10) >= a && d.slice(0, 10) <= b;
  if (inYear(p.taken)) return { ok: true, why: `datum fotky ${p.taken}` };
  if (inYear(ev?.date)) return { ok: true, why: `datum akce ${ev.date}` };
  return { ok: false, why: p.taken ? `datum ${p.taken} nesedí do školního roku` : 'neznámé datum' };
}

export function coverOf(n) {
  const g = gradeOf(n);
  return photoById(g.coverPhotoId) || photosOfGrade(n).sort(cmpPh)[0] || null;
}

// Google Disk vrátí chybu (po ~25 s), když chceme fotku širší než originál → max. 1600 px (tolik má import)
const driveUrl = (id, w) => `https://lh3.googleusercontent.com/d/${id}=w${Math.min(Number(w) || 1200, 1600)}`;
export function imgSrc(p, w = 1200) {
  if (!p) return '';
  if (p.url) return p.url;
  if (p.fileId) return driveUrl(p.fileId, w);
  return '';
}
export function cmPhoto(c, w = 600) {
  if (!c) return '';
  if (c.photoUrl) return c.photoUrl;
  if (c.photoId) return driveUrl(c.photoId, w);
  return '';
}

// ---------- načítání a zápisy ----------
export function primeFromCache() {
  const c = api.cached();
  if (c) { S.db = c; S.loaded = true; S.admin = !!S.key; }
  return !!c;
}
export async function load() {
  const before = JSON.stringify(S.db);
  const { db, admin } = await api.fetchAll(S.key);
  S.db = db;
  S.offline = false;
  if (S.key && !admin) { S.key = ''; LS.set('kronika-admin-key', null); }
  S.admin = !!admin;
  S.loaded = true;
  return JSON.stringify(S.db) !== before;
}

function apply(t, row) {
  const a = S.db[t];
  const i = a.findIndex(r => r.id === String(row.id));
  if (i >= 0) a[i] = { ...a[i], ...row }; else a.push(row);
  S.db = api.normalize(S.db);
  api.writeCache(S.db);
}
export async function save(t, row) { const r = await api.save(t, row, S.key); apply(t, r || row); return r || row; }
export async function remove(t, id) {
  await api.remove(t, id, S.key);
  S.db[t] = S.db[t].filter(r => r.id !== String(id));
  api.writeCache(S.db);
}
export async function setProfilePhoto(file, id) { const r = await api.setProfilePhoto(file, id, S.key); apply('classmates', r); return r; }
export async function uploadPhoto(file, meta) {
  const r = await api.upload(file, meta, S.key);
  // server občas fotku uloží, ale odpověď nevrátí řádek – stav se pak dorovná přes load()
  if (r && r.id) apply('photos', r);
  return r;
}
export async function addScore(row) { const r = await api.addScore(row); apply('scores', r || row); }

export function setPlayer(name) { S.player = name.trim().slice(0, 30); LS.set('kronika-player', S.player); }
