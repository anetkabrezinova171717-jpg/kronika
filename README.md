# 📖 Naše kronika – digitální kronika třídy 1.–9.

Mobilní webová aplikace (PWA): kronika po ročnících, fotoalbum, profily spolužáků, 4 hry a žebříček.
Kód běží zdarma na **GitHub Pages**, fotky se ukládají na **tvůj Google Disk** a data do **Google Tabulky**.

```
Telefon spolužáka ──► GitHub Pages (aplikace)
                         │  fetch
                         ▼
              Google Apps Script (backend, zdarma)
                ├── Google Tabulka  (události, spolužáci, hlášky, skóre…)
                └── Google Disk     (fotky ve složce „Naše kronika – fotky“)
```

Dokud nevyplníš `API_URL`, běží aplikace v **demo režimu**: má ukázková data a změny ukládá jen do prohlížeče. Admin heslo v demu je `demo`.

---

## 1. Google: tabulka + backend (asi 10 minut)

> Použij **osobní Gmail účet**, ne školní. Školní účty často zakazují sdílet soubory „komukoli s odkazem“, a pak by se fotky nezobrazovaly.

1. Na [sheets.new](https://sheets.new) vytvoř novou Google Tabulku a pojmenuj ji třeba **Kronika – data**.
2. V tabulce otevři **Rozšíření → Apps Script**.
3. Smaž ukázkový kód a vlož celý obsah souboru [`backend/Code.gs`](backend/Code.gs).
4. Na 1. řádku změň heslo: `const ADMIN_PASSWORD = 'tvoje-tajne-heslo';`
5. Ulož (💾). Nahoře v seznamu funkcí vyber **setup** a klikni na **▶ Spustit**.
   - Google se zeptá na oprávnění: **Zkontrolovat oprávnění** → vyber účet → *Upřesnit* → *Přejít na projekt (nebezpečné)* → **Povolit**.
     (Je to tvůj vlastní skript, Google jen upozorňuje, že ho neověřoval.)
   - V tabulce se vytvoří listy `grades`, `events`, `photos`, `classmates`, `quotes`, `scores` a na Disku složka **Naše kronika – fotky**.
6. **Nasadit → Nové nasazení** → ozubené kolo → **Webová aplikace**
   - *Spustit jako:* **Já**
   - *Kdo má přístup:* **Kdokoli**
   - **Nasadit** a zkopíruj **URL webové aplikace** (končí na `/exec`).

> ⚠️ Když později změníš kód skriptu, musíš ho znovu nasadit: **Nasadit → Spravovat nasazení → ✏️ → Verze: Nová verze → Nasadit**. URL zůstane stejná.

## 2. Nastavení aplikace

Otevři [`js/config.js`](js/config.js) a vyplň:

```js
API_URL: 'https://script.google.com/macros/s/……/exec',
CLASS_NAME: '9.A',
SCHOOL_NAME: 'ZŠ …',
FIRST_SCHOOL_YEAR: 2017,   // rok nástupu do 1. třídy
```

## 3. Zveřejnění na GitHub Pages

1. Na [github.com/new](https://github.com/new) vytvoř repozitář, např. `kronika` (Public).
2. **Add file → Upload files** a přetáhni **obsah** složky `kronika` (soubor `index.html` musí být v kořeni). Potvrď **Commit changes**.
3. **Settings → Pages → Build and deployment**: Source **Deploy from a branch**, Branch **main**, složka **/ (root)** → **Save**.
4. Za 1–2 minuty bude kronika na adrese `https://TVOJE-JMENO.github.io/kronika/`.
   Tenhle odkaz pošli spolužákům.

Aktualizace: znovu nahraj změněné soubory (Upload files přepíše staré). Při větší změně zvyš v `sw.js` číslo `VERSION`, aby se telefonům načetla nová verze.

## 4. Naplnění kroniky (ty jako administrátor)

Otevři kroniku → dole na úvodní stránce **🔒 Admin** (nebo `…/#/admin`) → zadej heslo.

Doporučený postup:

1. **Ročníky:** doplň školní roky, úvodní texty a případně třídní učitelku.
2. **Spolužáci:** přidej jména, přezdívky, popisky, oblíbené hlášky a fotky.
3. **Události:** v každém ročníku vytvoř akce (název, datum, místo, text).
   Prázdný řádek v textu = nový odstavec. V kronice se odstavce **střídají s fotkami** (fotka → text → fotka…).
4. **Nahrát fotky:** vyber ročník a událost a nahraj klidně desítky fotek najednou.
   Nebo nahraj vše jako „Nezařazeno“ a roztřiď to v záložce **Ke zařazení**, kde stačí klepnout na číslo třídy.
5. U fotky (klepni na ni → **Upravit**) můžeš změnit ročník, událost, popisek a pořadí, **označit spolužáky**, skrýt ji nebo smazat.
6. **Hlášky:** přidej hlášky a kdo je řekl (pro hru „Kdo to řekl?“).

Kdykoli jsi přihlášený jako admin, uvidíš přímo v kronice oranžová tlačítka **Upravit**.

### Import našich fotek (připravený balíček)

Složka `import/` obsahuje připravený balíček:
- `import/tridy/`: **1097 fotek** ze složky *Naše třída 2007–2016 / Fotky podle let* (disk VERBATIM), zmenšených na 1600 px a roztříděných do **46 akcí** v 1.–9. třídě. Školka je na začátku 1. třídy, „Od spolužáků“ na konci 9. třídy.
- `import/fotky/086–234`: 149 fotek z článků starého webu školy, které se nahrají do „Ke zařazení“.

Postup:
- **Složku `import/` nenahrávej na GitHub** (má asi 390 MB). Fotky patří na Google Disk.
- Po propojení s Googlem (vyplněné `API_URL`) spusť kroniku na počítači: `python3 -m http.server 8642` ve složce `kronika`. Otevři `http://localhost:8642/#/admin` → **Import archivu** → **Importovat**.
  Nahrání 1246 fotek trvá zhruba hodinu. Nech počítač zapnutý a stránku otevřenou. Fotky se pak ve všech telefonech objeví hned.
- Akce zatím nemají data ani texty. Doplň je v záložce **Události**. Pořadí akcí odpovídá číslování souborů.

## 5. Jak to funguje pro spolužáky

- **+ Přidat fotku**: vyberou fotky z telefonu, třídu (nebo „Nevím / zařadit později“), krátké info a své jméno.
- Fotka se v telefonu zmenší (rychlé nahrání), uloží se na Disk do podsložky **Od spolužáků** a do tabulky jako nový řádek se `source = classmate`.
  **Nikdy nepřepíše** tvůj obsah (`source = admin`).
- Fotky s „Nevím“ mají ročník `0` a čekají v adminu v záložce **Ke zařazení**.
- **Hry** potřebují jméno hráče (zapamatuje se v telefonu). Výsledky se ukládají do listu `scores`.
  Žebříček = součet nejlepších výsledků z každé hry.
- **Na plochu:** iPhone → Safari → Sdílet → *Přidat na plochu*. Android → Chrome → ⋮ → *Přidat na plochu / Nainstalovat*.

## Datová struktura (Google Tabulka)

| List | Sloupce |
|---|---|
| `grades` | id (1–9), title, years, subtitle, intro, coverPhotoId |
| `events` | id, grade, title, date, place, text, people, order, hidden, createdAt |
| `photos` | id, fileId, url, grade (0 = nezařazeno), eventId, caption, author, **source** (admin / classmate / profile), people, order, hidden, createdAt, w, h |
| `classmates` | id, name, nickname, bio, quote, photoId, photoUrl, order, hidden |
| `quotes` | id, text, author (id spolužáka), grade, context, hidden |
| `scores` | id, player, game, points, total, createdAt |

`people` = id spolužáků oddělená čárkou. Tabulku jde upravovat i ručně (sloupec `id` nech vždy jako první). Pohodlnější je ale admin v aplikaci.

## Limity a bezpečnost

- Vše je zdarma: Google Disk má 15 GB, jedna zmenšená fotka má asi 300–500 kB, takže se vejdou tisíce fotek.
- Kdo má odkaz na kroniku, může ji prohlížet a přidávat fotky. Upravovat a mazat může **jen admin s heslem** (heslo kontroluje server).
  Nevhodnou fotku skryješ nebo smažeš v adminu. Smazaná fotka jde do koše na Disku, kde se 30 dní dá obnovit.
- Heslo nikomu neposílej. Když ho změníš ve skriptu, nasaď novou verzi.

## Soubory

```
index.html            kostra aplikace
css/style.css         celý vzhled
js/config.js          ← nastavení (API_URL, třída, rok)
js/app.js             router, navigace, start
js/views.js           kronika, ročníky, fotoalbum, třída, nahrávání
js/games.js           4 hry + žebříček
js/admin.js           admin mód
js/store.js, api.js   práce s daty (Google / demo)
js/demo-data.js       ukázková data pro demo režim
backend/Code.gs       backend pro Google Apps Script (na GitHub nemusí)
sw.js, manifest…      PWA (instalace na plochu, offline)
```

Lokální spuštění: `python3 -m http.server 8642` ve složce `kronika` a otevřít `http://localhost:8642`.
