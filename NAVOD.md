# Pomocník – návod pro rodinu

Pomocník je webová aplikace pro telefon s Androidem (ověřeno pro Chrome, cíl: Samsung Galaxy A23 5G).
Ovládá se hlasem nebo velkými barevnými dlaždicemi a vše říká nahlas slovensky. Uživatel nemusí nic číst.

## Co umí (příklady povelů)

Uživatel ťukne na velký zelený mikrofon a řekne:

| Povel | Co se stane |
|---|---|
| „Zavolaj Jankovi“, „Zavolaj mame“, nebo jen „Janko“ | otevře volání; pak stačí ťuknout na zelené sluchátko |
| „Pomoc“, „Pomôž mi“, „Je mi zle“ | volá hlavní kontakt pro pomoc; při dalším „Pomoc“ do 10 minut volá záložní |
| „Pusti rádio“, „Vypni“, „Stop“ | Rádio Lumen |
| „Pusti rozprávku“, „Pusti Janka Hraška“, „Pusti hudbu“, „Ďalšiu“, „Pokračuj“ | rozprávky, audioknihy, hudba (knihy si pamatují, kde skončily) |
| „Koľko je hodín“, „Aký je dnes deň“, „Čo mám dnes“ | čas, datum, dnešní program z kalendáře |
| „Čo vieš?“ | přečte nápovědu |

Bez hlasu: ťuknutí na dlaždici. U fotky kontaktu nebo u „Pomoc“ se volá až po **druhém ťuknutí** (ochrana proti omylu, dá se vypnout).
Připomínky z Google Kalendáře v daný čas zazvoní, přečtou název a opakují se, dokud uživatel neťukne na obrazovku.

---

## 1. Zveřejnění aplikace (jednou, na počítači, cca 15 minut)

Aplikace musí běžet na zabezpečené adrese `https://`, jinak telefon nepovolí mikrofon. Zdarma to jde přes GitHub Pages:

1. Založte si účet na <https://github.com> (zdarma).
2. Vpravo nahoře **+ → New repository**, název např. `pomocnik`, zvolte **Public**, potvrďte **Create repository**.
3. Na stránce repozitáře klikněte na **uploading an existing file** a přetáhněte do okna **obsah složky `pomocnik`**
   (soubory `index.html`, `app.js`, `style.css`, `sw.js`, `manifest.webmanifest` a složku `icons`). Složku `google-apps-script` a tento návod nahrávat nemusíte. Potvrďte **Commit changes**.
4. **Settings → Pages → Branch: `main`, složka `/ (root)` → Save.**
5. Za 1–2 minuty bude aplikace na adrese `https://VAS-UCET.github.io/pomocnik/`.

V repozitáři nejsou žádná osobní data. Kontakty, čísla a fotky se zadávají až v telefonu a zůstávají jen v něm.

## 2. Příprava telefonu (Samsung Galaxy A23)

1. **Slovenský hlas:** Nastavenia → Všeobecná správa → **Prevod textu na reč** → Preferovaný nástroj **Google** → ozubené kolečko → Jazyk **Slovenčina** (případně stáhnout hlasová data). Pokud Google převod textu na řeč chybí, nainstalujte z Obchodu Play „Služby rozpoznávania reči od Googlu“.
2. Otevřete adresu aplikace v **Chrome** (ne v Samsung Internetu, ten neumí rozpoznávat řeč).
3. V Chrome menu **⋮ → Pridať na plochu / Inštalovať aplikáciu**. Na ploše vznikne zelená ikona s mikrofonem.
4. Spusťte Pomocníka z plochy, ťukněte na zelený mikrofon a **povolte mikrofon** („Pri používaní aplikácie“).
5. **Hlasitost médií** nastavte nahlas (tlačítka na boku → rozbalit → Médiá). Aplikace sama hlasitost měnit neumí.
6. **Zámek obrazovky:** pokud je odemykání obtížné, zvolte otisk prstu nebo zámek bez kódu.
7. **Baterie:** Nastavenia → Starostlivosť o batériu → Limity používania na pozadí → přidejte **Chrome** do „Aplikácie, ktoré nikdy neuspávať“.
8. Ideální je telefon na **stojánku s nabíječkou** a Pomocník stále otevřený. Displej pak nezhasíná a připomínky spolehlivě promluví.
9. Pro jistotu ponechte zapnutá i oznámení z aplikace Google Kalendář. Když bude Pomocník zavřený, upozorní aspoň ona.

## 3. Nastavení v aplikaci

**Ozubené kolečko ⚙️ vpravo nahoře podržte 2 sekundy.** Krátké ťuknutí nic nedělá, aby se nastavení neotevřelo omylem. Změny se ukládají hned, tlačítko **Hotovo** nastavení zavře.

- **Kontakty:** fotka (z galerie), jméno, číslo a hlavně **další oslovení**, tedy jak tomu člověku říká, i se slovenskými tvary:
  `syn, synovi, Janko, Jankovi` nebo `mama, mamu, mame, mamička`.
  U podobných jmen (Peter/Petra) vždy doplňte tvary (`Petrovi` / `Petre`), jinak se Pomocník zeptá, koho myslí.
  Políčko „Čo povie telefón pri volaní“ umožní správnou větu, např. „Volám **synovi Jankovi**“.
- **Pomoc:** hlavní a záložní kontakt (112 se nevolá).
- **Rádio:** Rádio Lumen je přednastavené (`https://audio.lumen.sk/live128.mp3`). Další stanici lze přidat, adresa musí začínat `https://`.
- **Rozprávky, knihy a hudba:** tlačítkem se vyberou MP3 soubory **přímo z telefonu** (nejdřív je do telefonu nakopírujte, např. z počítače kabelem nebo z Google Disku). Název upravte tak, jak ho bude vyslovovat.
- **Hlas:** volba hlasu, rychlost řeči, tlačítko pro vyzkoušení.
- **PIN** pro nastavení (nepovinné).
- **Záloha:** uloží kontakty a nastavení do souboru (bez MP3), např. při výměně telefonu.
- **Kontrola telefonu** dole ukáže, jestli funguje rozpoznávání řeči, slovenský hlas a ostatní.

## 4. Google Kalendář (léky a další připomínky)

Doporučujeme v Google účtu někoho z rodiny založit samostatný kalendář, např. „Pomocník“, a do něj zadávat události
(„Ranné lieky“, „Obed“, „Príde lekár“). Opakované události (každý den v 8:00) fungují. Název události se čte nahlas,
volitelně i popis.

1. Otevřete <https://script.google.com> → **Nový projekt**.
2. Smažte ukázkový kód a vložte obsah souboru `google-apps-script/Kalendar.gs`.
3. V kódu změňte:
   - `TOKEN` na vlastní náhodný text (např. `k8Fq2mZt7pLx9wRb`),
   - `CALENDAR_ID` na ID kalendáře „Pomocník“ (Google Kalendář → Nastavenia kalendára → Integrovať kalendár → ID kalendára). Ponecháte-li `primary`, čte se hlavní kalendář účtu.
4. Ozubené kolečko **Nastavenia projektu** → Časové pásmo **(GMT+01:00) Bratislava**.
5. **Nasadiť → Nové nasadenie** → typ **Webová aplikácia** → Spúšťať ako **Ja** → Kto má prístup **Ktokoľvek** → Nasadiť → povolit přístup ke kalendáři.
6. Zkopírujte adresu končící na `/exec`.
7. V Pomocníkovi: Nastavenia → Kalendár → vložte **adresu** a **TOKEN** → **Otestovať kalendár**. Mělo by se objevit „V poriadku“ a seznam nejbližších událostí.

Pomocník kalendář načítá každých 10 minut. Připomínka zazní v čase začátku události (celodenní události v čase nastaveném v Pomocníkovi, výchozí 8:00).
Pokud byl telefon vypnutý déle než 30 minut po čase události, připomínka se už nepřehraje.

## 5. Úpravy aplikace později

Po změně souborů je nahrajte znovu do repozitáře na GitHubu (Add file → Upload files). V `sw.js` zvyšte číslo
v `const CACHE = 'pomocnik-v1'` (např. na `v2`), aby si telefon stáhl novou verzi. Nastavení v telefonu zůstanou zachována.

## Známá omezení

- Hlasové ovládání potřebuje **internet** (rozpoznávání řeči běží u Googlu). Bez internetu fungují dlaždice, čas a nahrané MP3.
- Telefon neposlouchá pořád, nejdřív se musí ťuknout na mikrofon. Stálé poslouchání by vyžadovalo samostatnou Android aplikaci.
- Při volání Android vždy chce ještě jedno ťuknutí na zelené sluchátko. Webová aplikace nesmí volat sama, Pomocník na to ale upozorní hlasem.
- Po restartu telefonu nebo zavření aplikace je potřeba Pomocníka znovu otevřít a jednou ťuknout (prohlížeč jinak nepustí zvuk).
- Pomocník mu tyká. Pokud by vadilo, dá se to v textech v `app.js` změnit na vykání.
