// Ukázková data pro DEMO režim (než propojíš Google Disk).
import { CONFIG } from './config.js';
// „Fotky“ jsou jednoduché generované ilustrace (žádné externí obrázky).
const PAL = [
  ['#FFE08A', '#FF8A34', '#1FAE6E', '#2E5BFF'], ['#CFE3FF', '#2E5BFF', '#1FAE6E', '#FFC83D'],
  ['#FFD6E2', '#FF5C8A', '#B9A2FF', '#1F1D36'], ['#D6F4E5', '#1FAE6E', '#38B6FF', '#FFC83D'],
  ['#EEE8FF', '#B9A2FF', '#FF5C8A', '#2E5BFF'], ['#F1FBD2', '#C8F03C', '#1FAE6E', '#FF8A34'],
];
const pic = (seed, w = 900, h = 680) => {
  const [bg, a, b, c] = PAL[seed % PAL.length];
  const r = k => ((seed * 9301 + k * 49297) % 233280) / 233280;
  const people = Array.from({ length: 3 + (seed % 4) }, (_, i) => {
    const x = 120 + i * ((w - 240) / Math.max(1, 2 + (seed % 4))) + r(i) * 30;
    const y = h * .62 + r(i + 9) * 30;
    const col = [a, c, b, '#1F1D36'][i % 4];
    return `<circle cx="${x}" cy="${y - 70}" r="34" fill="#F6D2B8"/><rect x="${x - 40}" y="${y - 34}" width="80" height="120" rx="36" fill="${col}"/>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${bg}"/>
    <circle cx="${w * (.15 + r(1) * .7)}" cy="${h * .22}" r="${50 + r(2) * 40}" fill="${a}" opacity=".85"/>
    <path d="M0 ${h * .7} Q ${w * .3} ${h * (.45 + r(3) * .15)} ${w * .55} ${h * .66} T ${w} ${h * .6} V ${h} H 0 Z" fill="${b}" opacity=".9"/>
    ${people}<rect y="${h * .86}" width="${w}" height="${h * .14}" fill="${c}" opacity=".25"/></svg>`;
  return { url: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg), w, h };
};

const classmates = [
  ['c1', 'Anna Nováková', 'Anča', 'Vždycky měla připravený fix. A gumu. A náhradní gumu.', 'Paní učitelko, to už je přestávka?'],
  ['c2', 'Jakub Dvořák', 'Kuba', 'První den ztratil přezůvky a od té doby je pořád hledá.', 'To jsem nebyl já!'],
  ['c3', 'Eliška Malá', 'Koblížek', 'Na každý výlet vezla domácí buchty pro celou třídu.', 'Kdo chce koblížek?'],
  ['c4', 'Tomáš Král', 'Tom', 'Fotbal, fotbal a zase fotbal. A občas matika.', 'Ještě jeden gól a jdem.'],
  ['c5', 'Klára Veselá', 'Klárka', 'Kreslila na okraje sešitů celé komiksy.', 'Počkej, ještě to dokreslím.'],
  ['c6', 'Matěj Horák', 'Mates', 'Třídní DJ všech diskoték a besídek.', 'Pusť to ještě jednou!'],
  ['c7', 'Natálie Černá', 'Naty', 'Předsedkyně třídy, organizátorka všeho.', 'Kdo ještě nezaplatil na výlet?'],
  ['c8', 'Ondřej Procházka', 'Ondra', 'Uměl vysvětlit fyziku líp než učebnice.', 'To je přece logický.'],
].map(([id, name, nickname, bio, quote], i) => ({ id, name, nickname, bio, quote, photoId: '', photoUrl: '', order: i + 1, hidden: false }));

const events = [
  ['e11', 1, 'První školní den', '2017-09-04', 'Školní dvůr', 'Obří aktovky, kornouty plné sladkostí a maminky s kapesníky v ruce.\n\nPaní učitelka nás posadila do lavic podle abecedy a Kuba hned první den ztratil přezůvky.', 'c2'],
  ['e12', 1, 'Vánoční besídka', '2017-12-19', 'Naše třída', 'Zpívali jsme koledy a Anča byla anděl s křídly z alobalu. Rodiče natáčeli na telefony a my jsme mávali.', 'c1'],
  ['e21', 2, 'Karneval', '2019-02-15', 'Tělocvična', 'Tři princezny, dva piráti a jeden dinosaurus, který se nevešel do dveří.\n\nMates poprvé pouštěl hudbu a od té doby už to bylo jeho.', 'c6'],
  ['e22', 2, 'Návštěva ZOO', '2019-05-22', 'ZOO Praha', 'Celý den jsme hledali tučňáky. Nakonec jsme je našli až pět minut před odjezdem autobusu.', ''],
  ['e31', 3, 'Výlet na hory', '2020-02-12', 'Krkonoše', 'Tehdy jsme poprvé všichni jeli společně na hory. Sníh byl až po kolena a boby se nedaly ubrzdit.\n\nVečer jsme na chatě hráli městečko Palermo a nikdo nechtěl jít spát.\n\nKoblížek přivezla buchty pro celý autobus.', 'c3'],
  ['e32', 3, 'Divadlo v tělocvičně', '2020-04-01', 'Tělocvična', 'Hráli jsme Budulínka. Liška zapomněla text a celá třída jí ho napovídala nahlas.', ''],
  ['e41', 4, 'Den Země', '2021-04-22', 'Školní zahrada', 'Sázeli jsme stromky. Ten náš je dneska vyšší než my všichni dohromady.', ''],
  ['e42', 4, 'Dopravní hřiště', '2021-06-10', 'Dopravní hřiště', 'Řidičák na kolo! Tom dvakrát projel na červenou, ale nakonec ho dostal taky.', 'c4'],
  ['e51', 5, 'Škola v přírodě', '2022-06-06', 'Orlické hory', 'Týden bez rodičů, s baterkou pod peřinou a stezkou odvahy.\n\nNaty měla seznam úkolů na každý den a stejně jsme nestihli ani polovinu.', 'c7'],
  ['e52', 5, 'Rozloučení s prvním stupněm', '2022-06-29', 'Školní zahrada', 'Pasování na druháky. Paní učitelka plakala víc než my.', ''],
  ['e61', 6, 'Nová třídní, nová třída', '2022-09-01', 'Učebna 214', 'Druhý stupeň: nová budova, nové předměty a skříňky, které se nedaly zamknout.', ''],
  ['e62', 6, 'Lyžák', '2023-01-23', 'Jizerské hory', 'Polovina třídy poprvé na lyžích, druhá polovina poprvé na snowboardu. Všichni poprvé v sádře? Naštěstí ne.', ''],
  ['e71', 7, 'Exkurze do Prahy', '2024-03-14', 'Praha', 'Pražský hrad, Karlův most a nekonečná fronta na trdelník.', ''],
  ['e72', 7, 'Halloween ve třídě', '2024-10-31', 'Naše třída', 'Klárka namalovala na tabuli dýně tak dobře, že je nikdo nechtěl smazat.', 'c5'],
  ['e81', 8, 'Výlet do Itálie', '2025-05-19', 'Lago di Garda', 'Dvanáct hodin v autobuse, ale stálo to za to. Moře, zmrzlina a první italská slova.\n\nOndra vysvětloval, proč je voda v jezeře tak modrá, a nikdo ho neposlouchal.', 'c8'],
  ['e82', 8, 'Projektový den', '2025-11-20', 'Škola', 'Stavěli jsme mosty ze špejlí. Ten náš vydržel tři kila a jednu sušenku.', ''],
  ['e91', 9, 'Přijímačky', '2026-04-14', 'Střední školy', 'Nejnervóznější ráno devíti let. Ale zvládli jsme to – všichni!', ''],
  ['e92', 9, 'Poslední zvonění', '2026-06-26', 'Školní dvůr', 'Šerpy, balónky a fotka celé třídy na schodech. Devět let je pryč a my jsme pořád ta stejná parta.\n\nTak zase někdy, třído.', ''],
].map(([id, grade, title, date, place, text, people], i) => ({
  id, grade, title, place, text, people, order: '', hidden: false, createdAt: '2026-01-01T10:00:00.000Z',
  // ukázková data jsou psaná od roku 2017 – posuneme je podle nastavení
  date: date.replace(/^\d{4}/, y => String(Number(y) + (Number(CONFIG.FIRST_SCHOOL_YEAR) || 2017) - 2017)),
}));

const photos = [];
let n = 0;
const captions = ['Tady jsme ještě všichni koukali do foťáku', 'Nejlepší den', 'Kdo ví, kdo to fotil?', 'Spolu', 'Na památku', 'Ještě jednou!'];
for (const e of events) {
  const count = e.text.split('\n\n').length + 2;
  for (let i = 0; i < count; i++) {
    n++;
    const tall = i % 3 === 2;
    const p = pic(n, tall ? 700 : 900, tall ? 900 : 640);
    photos.push({
      id: 'p' + n, fileId: '', ...p, grade: e.grade, eventId: e.id,
      caption: i === 0 ? e.title : captions[n % captions.length], author: 'Kronika', source: 'admin',
      people: i === 1 ? classmates[n % classmates.length].id : '', order: i, hidden: false,
      createdAt: `202${Math.min(6, e.grade)}-01-0${(i % 9) + 1}T10:00:00.000Z`,
    });
  }
}
// pár fotek „od spolužáků“
[['Kuba', 3, 'e31', 'Bobovačka u chaty'], ['Naty', 5, 'e51', 'Stezka odvahy – ani jsme nekřičeli'], ['Mates', 8, '', 'Autobus o půlnoci'], ['Anča', 0, '', 'Nevím, odkdy to je, ale je to super']]
  .forEach(([author, grade, eventId, caption], i) => {
    n++;
    photos.push({ id: 'p' + n, fileId: '', ...pic(n), grade, eventId, caption, author, source: 'classmate', people: '', order: '', hidden: false, createdAt: `2026-10-1${i}T18:00:00.000Z` });
  });

const quotes = [
  ['q1', 'Kdo nemá úkol, ať se ani nehlásí.', 'c7', 6, 'Při vybírání úkolů za paní učitelku'],
  ['q2', 'Já myslel, že test je až zítra!', 'c2', 7, ''],
  ['q3', 'Na hřišti to bylo jinak, přísahám.', 'c4', 5, ''],
  ['q4', 'Nechte mě, já kreslím.', 'c5', 4, ''],
  ['q5', 'To je přece úplně logický.', 'c8', 8, 'Fyzika'],
  ['q6', 'Mám v tašce ještě jednu buchtu.', 'c3', 3, 'Výlet na hory'],
].map(([id, text, author, grade, context]) => ({ id, text, author, grade, context, hidden: false }));

const scores = [
  ['s1', 'Anča', 'prezdivky', 9], ['s2', 'Anča', 'hlaska', 7], ['s3', 'Kuba', 'prezdivky', 8],
  ['s4', 'Kuba', 'rok', 6], ['s5', 'Eliška', 'fotka', 7], ['s6', 'Eliška', 'rok', 4],
].map(([id, player, game, points]) => ({ id, player, game, points, total: 10, createdAt: '2026-11-01T12:00:00.000Z' }));

const grades = [
  { id: 1, intro: 'Aktovky větší než my, slabikář a první písmenka. Tady to všechno začalo.' },
  { id: 2, intro: 'Už jsme věděli, kde je jídelna, a začali jsme objevovat, kdo je kdo.' },
  { id: 3, intro: 'Rok, kdy jsme poprvé jeli všichni spolu na hory.' },
  { id: 4, intro: 'Stromky, kola a první opravdové kamarádství.' },
  { id: 5, intro: 'Poslední rok na prvním stupni. Škola v přírodě a velké loučení.' },
  { id: 6, intro: 'Druhý stupeň! Nová třídní, nové předměty, nová budova.' },
  { id: 7, intro: 'Rok exkurzí, prvních tajných lásek a nekonečných přestávek.' },
  { id: 8, intro: 'Itálie, projekty a první myšlenky na to, kam dál.' },
  { id: 9, intro: 'Rok triček Flákači 2016. Přijímačky, poslední zvonění a slib, že se budeme vídat.' },
].map(g => ({ ...g, title: '', years: '', subtitle: '', coverPhotoId: '' }));

export const SEED = { grades, events, photos, classmates, quotes, scores };
