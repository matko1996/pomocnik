/**
 * Pomocník – sprístupní aplikácii v telefóne udalosti z Google Kalendára a kontakty z Google Kontaktov.
 *
 * 1. TOKEN zmeňte na vlastný náhodný text (napr. 20 písmen a číslic) a ten istý zadajte v Pomocníkovi.
 * 2. CALENDAR_ID: 'primary' = hlavný kalendár účtu. Lepšie je založiť samostatný kalendár
 *    (napr. „Pomocník“) a sem vložiť jeho ID z Nastavenia kalendára → Integrovať kalendár.
 * 3. CONTACT_LABEL: štítok v Google Kontaktoch. Do Pomocníka sa načítajú len kontakty s týmto štítkom.
 *    Pre kontakty treba vľavo pri „Služby“ pridať „People API“.
 * 4. Nasadiť → Nové nasadenie → Webová aplikácia: Spúšťať ako „Ja“, Prístup „Ktokoľvek“.
 */
const TOKEN = 'ZMENTE-MA-NA-NAHODNY-TEXT';
const CALENDAR_ID = 'primary';
const DAYS_AHEAD = 3;
const CONTACT_LABEL = 'Pomocník';

function doGet(e) {
  if (!e || !e.parameter || e.parameter.t !== TOKEN) return json_({ error: 'unauthorized' });

  const out = { generated: new Date().toISOString() };
  try {
    out.events = events_();
  } catch (err) {
    out.calendarError = String(err.message || err);
  }
  // Kontakty sa posielajú len na požiadanie (Pomocník si ich pýta asi raz za hodinu).
  if (e.parameter.contacts === '1') {
    try {
      out.contacts = contacts_();
    } catch (err) {
      out.contactsError = String(err.message || err);
    }
  }
  return json_(out);
}

function events_() {
  const cal = CALENDAR_ID === 'primary'
    ? CalendarApp.getDefaultCalendar()
    : CalendarApp.getCalendarById(CALENDAR_ID);
  if (!cal) throw new Error('Kalendár sa nenašiel – skontrolujte CALENDAR_ID.');

  const tz = Session.getScriptTimeZone();
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = new Date(from.getTime() + DAYS_AHEAD * 24 * 3600 * 1000);

  return cal.getEvents(from, to).map(function (ev) {
    const allDay = ev.isAllDayEvent();
    return {
      // Opakované udalosti majú rovnaké ID, preto pridávame čas začiatku.
      id: ev.getId() + '_' + ev.getStartTime().getTime(),
      title: ev.getTitle(),
      description: stripHtml_(ev.getDescription()),
      allDay: allDay,
      start: allDay ? Utilities.formatDate(ev.getAllDayStartDate(), tz, 'yyyy-MM-dd') : ev.getStartTime().toISOString(),
      end: allDay ? Utilities.formatDate(ev.getAllDayEndDate(), tz, 'yyyy-MM-dd') : ev.getEndTime().toISOString(),
    };
  });
}

/**
 * Kontakty so štítkom CONTACT_LABEL:
 *  - meno: zobrazované meno kontaktu,
 *  - prezývka: ďalšie oslovenia oddelené čiarkou (napr. „syn, synovi, Jankovi“),
 *  - vlastné pole „Volanie“: čo povie telefón pri volaní (napr. „synovi Jankovi“),
 *  - vlastné pole „Poradie“: číslo pre poradie fotiek (inak podľa mena),
 *  - prvé telefónne číslo a fotka.
 */
function contacts_() {
  let group = null, pageToken;
  do {
    const res = People.ContactGroups.list({ pageSize: 200, pageToken: pageToken });
    (res.contactGroups || []).forEach(function (g) {
      if ((g.formattedName || g.name) === CONTACT_LABEL) group = g;
    });
    pageToken = res.nextPageToken;
  } while (!group && pageToken);
  if (!group) throw new Error('Štítok „' + CONTACT_LABEL + '“ sa v Google Kontaktoch nenašiel.');

  const members = People.ContactGroups.get(group.resourceName, { maxMembers: 200 }).memberResourceNames || [];
  if (!members.length) return [];

  const people = People.People.getBatchGet({
    resourceNames: members.slice(0, 200),
    personFields: 'names,nicknames,phoneNumbers,photos,userDefined',
  }).responses || [];

  const list = people.map(function (r) {
    const p = r.person || {};
    const custom = {};
    (p.userDefined || []).forEach(function (u) { custom[String(u.key || '').trim().toLowerCase()] = u.value; });
    const photo = (p.photos || []).filter(function (ph) { return !ph.default; })[0];
    return {
      id: p.resourceName,
      name: p.names && p.names[0] ? p.names[0].displayName : '',
      aliases: (p.nicknames || []).map(function (n) { return n.value; }).join(', '),
      voiceName: custom['volanie'] || '',
      order: Number(custom['poradie']) || 999,
      phone: p.phoneNumbers && p.phoneNumbers[0] ? p.phoneNumbers[0].value : '',
      photo: photo ? photoData_(photo.url) : '',
    };
  }).filter(function (c) { return c.name && c.phone; });

  list.sort(function (a, b) { return a.order - b.order || a.name.localeCompare(b.name, 'sk'); });
  return list;
}

// Fotku pošleme priamo ako obrázok (data URL), aby ju telefón mal uloženú aj bez internetu.
function photoData_(url) {
  const big = url.replace(/=s\d+(-c)?$/, '') + '=s320-c';
  const cache = CacheService.getScriptCache();
  const key = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, big));
  const hit = cache.get(key);
  if (hit) return hit;
  try {
    const blob = UrlFetchApp.fetch(big).getBlob();
    const data = 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
    if (data.length < 95000) cache.put(key, data, 6 * 3600);
    return data;
  } catch (err) {
    return '';
  }
}

function stripHtml_(s) {
  return String(s || '').replace(/<br\s*\/?>/gi, '. ').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
