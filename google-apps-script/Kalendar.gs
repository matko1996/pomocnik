/**
 * Pomocník – sprístupní udalosti z Google Kalendára aplikácii v telefóne.
 *
 * 1. TOKEN zmeňte na vlastný náhodný text (napr. 20 písmen a číslic) a ten istý zadajte v Pomocníkovi.
 * 2. CALENDAR_ID: 'primary' = hlavný kalendár účtu. Lepšie je založiť samostatný kalendár
 *    (napr. „Pomocník“) a sem vložiť jeho ID z Nastavenia kalendára → Integrovať kalendár.
 * 3. Nasadiť → Nové nasadenie → Webová aplikácia: Spúšťať ako „Ja“, Prístup „Ktokoľvek“.
 */
const TOKEN = 'ZMENTE-MA-NA-NAHODNY-TEXT';
const CALENDAR_ID = 'primary';
const DAYS_AHEAD = 3;

function doGet(e) {
  if (!e || !e.parameter || e.parameter.t !== TOKEN) return json_({ error: 'unauthorized' });

  const cal = CALENDAR_ID === 'primary'
    ? CalendarApp.getDefaultCalendar()
    : CalendarApp.getCalendarById(CALENDAR_ID);
  if (!cal) return json_({ error: 'Kalendár sa nenašiel – skontrolujte CALENDAR_ID.' });

  const tz = Session.getScriptTimeZone();
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = new Date(from.getTime() + DAYS_AHEAD * 24 * 3600 * 1000);

  const events = cal.getEvents(from, to).map(function (ev) {
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

  return json_({ events: events, generated: now.toISOString() });
}

function stripHtml_(s) {
  return String(s || '').replace(/<br\s*\/?>/gi, '. ').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
