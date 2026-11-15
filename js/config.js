// ============================================================
//  NASTAVENÍ KRONIKY – tohle je jediný soubor, který upravuješ
// ============================================================
export const CONFIG = {
  // URL webové aplikace z Google Apps Script (končí na /exec).
  // Dokud je prázdná, kronika běží v DEMO režimu (data jen v tomto prohlížeči).
  API_URL: 'https://script.google.com/macros/s/AKfycbzLgVpPeZuDAYS7zHGyehM9N9V1Qg_HtcpI3zxT6pyEnho3Dhce3TvABEU246rYP-4ZDQ/exec',

  APP_NAME: 'Flákači 2016',
  CLASS_NAME: 'Flákači',          // přezdívka třídy
  CLASS_YEAR: '2016',             // rok z trička
  MOTTO: 'Učitelé, nejásejte, přijdou naše děti…',
  TEE_IMAGE: 'img/tricko.webp',   // obrázek našeho trička (prázdné = kreslené tričko)

  // Úvodní koláž: první fotka z akcí s tímhle textem v názvu (velká nahoře, vlevo dole, vpravo dole)
  HERO_EVENTS: ['Třídní foto 9', 'vyřazení', 'Rozlučka'],
  SCHOOL_NAME: 'ZŠ T. G. Masaryka Hodkovice',
  SCHOOL_SHORT: 'ZŠ TGM Hodkovice',

  // Rok, kdy jste nastoupili do 1. třídy (2007 → 9. třída = 2015–2016)
  FIRST_SCHOOL_YEAR: 2007,
};
