# Pomocník – návod pro rodinu

Pomocník je webová aplikace pro telefon s Androidem (ověřeno pro Chrome, cíl: Samsung Galaxy A23 5G).
Na obrazovce **nejsou žádné texty**, jen velké obrázky. Vše, co se děje, telefon říká nahlas slovensky.

Adresa aplikace: **https://matko1996.github.io/pomocnik/**

## Jak se ovládá

**Úvodní obrazovka** má jen dvě obrovská tlačítka:

- 🎤 **zelený mikrofon**: ťukne a řekne povel. Telefon čeká až 15 sekund a zvládne i pauzu uprostřed věty.
- 👨‍👩‍👧📻🎵 **modré tlačítko s obrázky**: výběr ťuknutím. Otevře tři velké dlaždice:
  - 👨‍👩‍👧 **Rodina**: fotky kontaktů přes celou obrazovku. První ťuknutí řekne jméno, druhé (do 15 sekund) zavolá.
  - 📻 **Rádio**: zapne nebo vypne Rádio Lumen.
  - 🎵 **Hudba**: seznam nahrané hudby.

Na dalších obrazovkách je nahoře velká šipka ⬅️ zpět a menší mikrofon 🎤.

### Hlasové povely (příklady)

| Povel | Co se stane |
|---|---|
| „Zavolaj Jankovi“, „Zavolaj mame“, nebo jen „Janko“ | otevře volání; pak stačí ťuknout na zelené sluchátko |
| „Pomoc“, „Pomôž mi“, „Je mi zle“ | volá hlavní kontakt pro pomoc; při dalším „Pomoc“ do 10 minut volá záložní |
| „Pusti rádio“, „Vypni“, „Stop“ | Rádio Lumen |
| „Pusti rozprávku“, „Pusti Janka Hraška“, „Pusti hudbu“, „Ďalšiu“, „Pokračuj“ | rozprávky, audioknihy, hudba (knihy si pamatují, kde skončily) |
| „Koľko je hodín“, „Aký je dnes deň“, „Čo mám dnes“ | čas, datum, dnešní program z kalendáře |
| „Čo vieš?“ | přečte nápovědu |

Pomoc a rozprávky jsou dostupné jen hlasem (ve výběru obrázky jsou jen Rodina, Rádio, Hudba).
Připomínky z Google Kalendáře v daný čas zazvoní, přečtou název a opakují se, dokud uživatel neťukne na obrazovku.

---

## 1. Aplikace na internetu

Aplikace je zveřejněná přes GitHub Pages v repozitáři `matko1996/pomocnik`. V repozitáři nejsou žádná osobní data,
kontakty, čísla a fotky jsou jen v telefonu (případně v Google Kontaktech).

## 2. Příprava telefonu (Samsung Galaxy A23)

1. **Slovenský hlas:** Nastavenia → Všeobecná správa → **Prevod textu na reč** → Preferovaný nástroj **Google** → ozubené kolečko → Jazyk **Slovenčina** (případně stáhnout hlasová data).
2. Otevřete adresu aplikace v **Chrome** (ne v Samsung Internetu, ten neumí rozpoznávat řeč).
3. V Chrome menu **⋮ → Pridať na plochu / Inštalovať aplikáciu**. Na ploše vznikne zelená ikona s mikrofonem.
4. Spusťte Pomocníka z plochy, ťukněte na zelený mikrofon a **povolte mikrofon** („Pri používaní aplikácie“).
5. **Hlasitost médií** nastavte nahlas. Aplikace sama hlasitost měnit neumí.
6. **Zámek obrazovky:** pokud je odemykání obtížné, zvolte otisk prstu nebo zámek bez kódu.
7. **Baterie:** Nastavenia → Starostlivosť o batériu → Limity používania na pozadí → přidejte **Chrome** do „Aplikácie, ktoré nikdy neuspávať“.
8. Ideální je telefon na **stojánku s nabíječkou** a Pomocník stále otevřený (displej pak nezhasíná a připomínky spolehlivě promluví).
9. Pro jistotu ponechte zapnutá i oznámení z aplikace Google Kalendář.

## 3. Nastavení v aplikaci

Na úvodní obrazovce **podržte vyblednuté kolečko ⚙️ vpravo nahoře 2 sekundy**. Změny se ukládají hned, tlačítko **Hotovo** nastavení zavře.

- **Kontakty:** buď ručně v telefonu (fotka, jméno, číslo, další oslovení), nebo automaticky z **Google Kontaktů** (kapitola 4).
  Do „ďalších oslovení“ pište, jak tomu člověku říká, i se slovenskými tvary: `syn, synovi, Janko, Jankovi`.
  U podobných jmen (Peter/Petra, Jana/Janko) vždy doplňte tvary, jinak se Pomocník zeptá, koho myslí.
- **Pomoc:** hlavní a záložní kontakt (112 se nevolá).
- **Rádio:** Rádio Lumen je přednastavené. Další stanici lze přidat (adresa `https://…`).
- **Rozprávky, knihy a hudba:** MP3 soubory se vyberou přímo z telefonu. Název upravte tak, jak ho bude vyslovovat. Lze přidat i obrázek.
- **Hlas a ovládání:**
  - **Ako dlho čakať na hlasový povel**: výchozí 15 sekund,
  - **Čas na druhé ťuknutie**: výchozí 15 sekund,
  - hlas, rychlost řeči, PIN pro nastavení,
  - **Zobrazovať titulky**: jen pro rodinu, ukáže text toho, co telefon říká (standardně vypnuto).
- **Záloha** a **Kontrola telefonu** (jestli funguje rozpoznávání řeči, slovenský hlas atd.).

## 4. Google: kalendář a kontakty

Jeden malý skript v Google účtu někoho z rodiny posílá Pomocníkovi **události z kalendáře** a **kontakty**.
Rodina pak může vše měnit na dálku ze svého telefonu nebo počítače a Pomocník si změny sám načte
(kalendář každých 10 minut, kontakty asi jednou za hodinu).

### Příprava v Google
- **Kalendář:** založte samostatný kalendář, např. „Pomocník“, a zadávejte do něj události
  („Ranné lieky“, „Obed“, „Príde lekár“). Opakované události fungují.
- **Kontakty:** v [Google Kontaktech](https://contacts.google.com) vytvořte **štítek „Pomocník“** a přidejte do něj až 12 kontaktů. U každého:
  - **jméno** a **telefonní číslo**,
  - **fotku** (zobrazí se přes celou dlaždici),
  - **přezdívku**: další oslovení oddělená čárkou, např. `syn, synovi, Jankovi`,
  - nepovinně **vlastní pole** (Pridať ďalšie polia → Vlastné pole):
    - `Volanie`: co telefon řekne, např. `synovi Jankovi` → „Volám synovi Jankovi“,
    - `Poradie`: číslo 1, 2, 3… pro pořadí fotek (jinak podle jména).

### Nastavení skriptu
1. Otevřete <https://script.google.com> → **Nový projekt**.
2. Smažte ukázkový kód a vložte obsah souboru `google-apps-script/Kalendar.gs`.
3. V kódu změňte:
   - `TOKEN` na vlastní náhodný text (např. `k8Fq2mZt7pLx9wRb`),
   - `CALENDAR_NAME` a `CONTACT_LABEL` jen pokud se kalendář nebo štítek jmenují jinak než `Pomocník`.
4. Vlevo u **Služby** klikněte na **+** a přidejte **People API** (potřeba pro kontakty).
5. Ozubené kolečko **Nastavenia projektu** → Časové pásmo **(GMT+01:00) Bratislava**.
6. **Nasadiť → Nové nasadenie** → typ **Webová aplikácia** → Spúšťať ako **Ja** → Kto má prístup **Ktokoľvek** → Nasadiť → povolit přístup ke kalendáři a kontaktům.
7. Zkopírujte adresu končící na `/exec`.
8. V Pomocníkovi: Nastavenia → **Google: kalendár a kontakty** → vložte **adresu** a **TOKEN** → zaškrtněte
   **Kontakty brať z Google Kontaktov** → **Otestovať spojenie**. Mělo by se objevit „Kalendár v poriadku“ a „Kontakty v poriadku“.
9. V části **Pomoc** vyberte hlavní a záložní kontakt (výběr zůstane i po dalších synchronizacích).

Při pozdější změně kódu skriptu použijte **Nasadiť → Spravovať nasadenia → ✏️ → Verzia: Nová verzia**. Adresa zůstane stejná.

Připomínka zazní v čase začátku události (celodenní události v čase nastaveném v Pomocníkovi, výchozí 8:00).
Pokud byl telefon vypnutý déle než 30 minut po čase události, připomínka se už nepřehraje.

## 5. Aplikace pro Android (doporučeno)

Samostatná aplikace **volá přímo**. Po výběru kontaktu hovor rovnou začne, bez obrazovky s číslem a bez ťukání
na zelené sluchátko. Hlas a rozpoznávání řeči obstarává přímo Android a aplikace se spustí bez úvodního ťuknutí.
Vzhled a ovládání jsou stejné, protože aplikace zobrazuje stejného Pomocníka z internetu. Úpravy Pomocníka se proto
projeví i v ní, bez přeinstalování.

### Instalace (jednou, na jeho telefonu)
1. V Chrome otevřete **https://github.com/matko1996/pomocnik/releases/latest/download/pomocnik.apk** a soubor stáhněte.
2. Otevřete stažený `pomocnik.apk` (oznámení, nebo aplikace Moje súbory → Stiahnuté).
3. Telefon se zeptá na **inštaláciu neznámych aplikácií** → **Nastavenia** → povolit pro Chrome (nebo Moje súbory) → zpět → **Inštalovať**.
4. Pokud se objeví **Google Play Protect** („neznámy vývojár“), zvolte **Ďalšie podrobnosti → Aj tak nainštalovať**.
   Aplikace není v Obchodě Play, proto to varování vypadá takto.
5. Spusťte **Pomocník** a povolte **Mikrofón** a **Telefón** („Povoliť“). Bez povolení Telefón se volá jen přes obrazovku vytáčení.
6. Nastavení si aplikace s webovou verzí v Chrome nesdílí. Kontakty se načtou z Google Kontaktů (stačí znovu zadat
   adresu skriptu a TOKEN). Jinak ve webové verzi uložte **Zálohu** a v aplikaci ji **Obnovte**.
7. Ikonu webové verze z plochy odstraňte, aby nebyly na ploše dvě.

V nastavení aplikace je dole **Kontrola telefónu**. Musí ukazovat ✅ u „Volanie priamo“ a „Slovenský hlas“.

Tlačítko **Späť** v aplikaci vrací o krok zpět a aplikaci nikdy nezavře.
Novou verzi samotné Android aplikace (potřebnou jen při změnách v části pro Android) nainstalujete stejným odkazem přes tu starou.
Nastavení zůstanou zachována.

**Podpisový klíč** aplikace je ve složce `C:\CLAUDIE\Chess\pomocnik-podpis` (soubor `pomocnik.jks` + `heslo.txt`).
Zálohujte ji. Bez ní by šlo novou verzi nainstalovat jen po odinstalování staré.

## 6. Úpravy aplikace později

Aplikaci aktualizuje Claude přímo do repozitáře na GitHubu. Telefon si novou verzi stáhne při dalším otevření
Pomocníka (někdy je potřeba aplikaci zavřít a otevřít ještě jednou). Nastavení v telefonu zůstanou zachována.

## Známá omezení

- Hlasové ovládání potřebuje **internet** (rozpoznávání řeči běží u Googlu). Bez internetu fungují dlaždice a nahrané MP3.
- Telefon neposlouchá pořád, nejdřív se musí ťuknout na mikrofon.
- Ve **webové verzi** (Chrome) se při volání zobrazí obrazovka vytáčení aplikace Telefón a je potřeba ťuknout na zelené sluchátko.
  **Aplikace pro Android** (kapitola 5) volá přímo. Během hovoru se ale i tak ukáže obrazovka hovoru s červeným tlačítkem pro zavěšení.
- Po restartu telefonu nebo zavření aplikace je potřeba Pomocníka znovu otevřít a jednou ťuknout (prohlížeč jinak nepustí zvuk).
- Pomocník mu tyká. Dá se změnit na vykání.
