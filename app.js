'use strict';
/*
 * Pomocník – hlasový pomocník pre telefón (slovensky).
 * Všetky nastavenia (kontakty, fotky, rádiá, kalendár) sa ukladajú len v tomto telefóne.
 */

const VERSION = '1.2';

// ===================== Nastavenia a úložisko =====================

const COLORS = ['#2563eb', '#16a34a', '#ea580c', '#7c3aed', '#db2777', '#0d9488',
  '#ca8a04', '#dc2626', '#4f46e5', '#65a30d', '#0891b2', '#9333ea'];

const DEFAULTS = {
  contacts: [],          // {id, name, aliases, voiceName, phone, photo, color}
  helpPrimary: '',       // id kontaktu
  helpBackup: '',
  stations: [{ id: 'lumen', name: 'Rádio Lumen', aliases: 'lumen', url: 'https://audio.lumen.sk/live128.mp3', photo: '' }],
  library: [],           // {id, name, aliases, cat: 'citanie'|'hudba', url, file, size, photo}
  calendarUrl: '',
  calendarToken: '',
  readDescription: true,
  reminderRepeatMin: 3,
  reminderRepeatCount: 5,
  allDayTime: '08:00',
  confirmTap: true,
  keepAwake: true,
  showCaptions: false,   // titulky len pre rodinu – používateľ nečíta
  contactsFromGoogle: false,
  listenSeconds: 15,     // ako dlho čakať na hlasový povel
  confirmSeconds: 15,    // koľko času na druhé ťuknutie pri volaní
  voiceURI: '',
  rate: 1.0,
  pin: '',
};

function readJSON(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

let S = Object.assign(structuredClone(DEFAULTS), readJSON('settings', {}));

function saveSettings() {
  if (!writeJSON('settings', S)) alert('Nastavenia sa nepodarilo uložiť – v telefóne je asi málo miesta.');
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const contactById = id => S.contacts.find(c => c.id === id) || null;
const lib = cat => S.library.filter(x => x.cat === cat);

// Zvukové súbory nahrané z telefónu sú v IndexedDB (localStorage je na ne malý).
const idb = {
  db: null,
  open() {
    return this.db ||= new Promise((res, rej) => {
      const r = indexedDB.open('pomocnik', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('files');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  },
  async run(mode, fn) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const tx = db.transaction('files', mode);
      const req = fn(tx.objectStore('files'));
      tx.oncomplete = () => res(req && req.result);
      tx.onerror = () => rej(tx.error);
    });
  },
  put(k, v) { return this.run('readwrite', s => s.put(v, k)); },
  get(k) { return this.run('readonly', s => s.get(k)); },
  del(k) { return this.run('readwrite', s => s.delete(k)); },
};

// ===================== Pomocné funkcie DOM =====================

const $ = id => document.getElementById(id);

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : String(kid));
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k in el) el[k] = v;
    else el.setAttribute(k, v);
  }
  return el;
}

const initial = name => (name || '?').trim().charAt(0).toUpperCase() || '?';
const pad = n => String(n).padStart(2, '0');
const hm = t => { const d = new Date(t); return `${d.getHours()}:${pad(d.getMinutes())}`; };

// ===================== Hlas (čítanie nahlas) =====================

let voices = [];
function loadVoices() { voices = 'speechSynthesis' in window ? speechSynthesis.getVoices() : []; }
if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
const slovakVoice = () => voices.find(v => /^sk/i.test(v.lang)) || null;
const currentVoice = () => voices.find(v => v.voiceURI === S.voiceURI) || slovakVoice();

let speakSeq = 0;
let captionTimer;

function showCaption(text) {
  if (!S.showCaptions) return;
  const c = $('caption');
  c.textContent = text;
  c.classList.remove('hidden');
  clearTimeout(captionTimer);
  captionTimer = setTimeout(() => c.classList.add('hidden'), 9000);
}

// Vráti true, ak sa veta dohovorila; false, ak ju prerušila iná veta.
function say(text) {
  showCaption(text);
  if (!('speechSynthesis' in window)) return Promise.resolve(true);
  const my = ++speakSeq;
  speechSynthesis.cancel();
  return new Promise(resolve => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'sk-SK';
    const v = currentVoice();
    if (v) u.voice = v;
    u.rate = S.rate || 1;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (my === speakSeq) duck(false);
      resolve(my === speakSeq);
    };
    const timer = setTimeout(finish, 3000 + text.length * 110 / (S.rate || 1));
    u.onend = finish;
    u.onerror = finish;
    duck(true);
    // Chrome na Androide niekedy zahodí reč, ktorá nasleduje hneď po cancel().
    setTimeout(() => { if (my === speakSeq) speechSynthesis.speak(u); else finish(); }, 80);
  });
}

function stopSpeaking() {
  speakSeq++;
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  duck(false);
}

let actx;
function beep(freq = 880, dur = 0.12) {
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.3, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
    o.connect(g).connect(actx.destination);
    o.start();
    o.stop(actx.currentTime + dur);
  } catch { /* bez zvuku */ }
  return new Promise(r => setTimeout(r, dur * 1000 + 60));
}
async function chime() { await beep(660, .2); await beep(880, .2); await beep(1100, .35); }

// ===================== Slovenské vety o čase =====================

const NUM_F = ['nula', 'jedna', 'dve', 'tri', 'štyri'];
const DAYS = ['nedeľa', 'pondelok', 'utorok', 'streda', 'štvrtok', 'piatok', 'sobota'];
const MONTHS = ['januára', 'februára', 'marca', 'apríla', 'mája', 'júna', 'júla', 'augusta',
  'septembra', 'októbra', 'novembra', 'decembra'];
const plural = (n, one, few, many) => n === 1 ? one : (n >= 2 && n <= 4 ? few : many);

function timeSentence(d = new Date()) {
  const H = d.getHours(), M = d.getMinutes();
  if (H === 0 && M === 0) return 'Je polnoc.';
  let s = (H >= 2 && H <= 4 ? 'Sú ' : 'Je ') + (H <= 4 ? NUM_F[H] : H) + ' ' + plural(H, 'hodina', 'hodiny', 'hodín');
  if (M) s += ' a ' + (M <= 4 ? NUM_F[M] : M) + ' ' + plural(M, 'minúta', 'minúty', 'minút');
  return s + '.';
}
const dateSentence = (d = new Date()) => `Dnes je ${DAYS[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}.`;
function greeting() {
  const H = new Date().getHours();
  return H < 10 ? 'Dobré ráno.' : H >= 18 ? 'Dobrý večer.' : 'Dobrý deň.';
}

const HELP_TEXT = 'Ťukni na zelený mikrofón a povedz napríklad: Zavolaj Jankovi. Pusti rádio. ' +
  'Pusti rozprávku. Pusti hudbu. Koľko je hodín. Čo mám dnes. Stop. ' +
  'Keď potrebuješ pomoc, povedz: Pomoc.';

// ===================== Prehrávač =====================

const audio = new Audio();
audio.preload = 'none';
let blobUrl = null;
let lastPosSave = 0;

const posKey = id => 'pos:' + id;

const player = {
  item: null,
  kind: null,          // 'radio' | 'lib'
  retries: 0,
  get playing() { return !!this.item && !audio.paused; },

  async start(item, kind, src, startAt = 0, isBlob = false) {
    this.release();
    if (isBlob) blobUrl = src;
    this.item = item;
    this.kind = kind;
    this.retries = 0;
    audio.src = src;
    if (startAt > 0) audio.addEventListener('loadedmetadata', () => { try { audio.currentTime = startAt; } catch { /* */ } }, { once: true });
    updatePlayerUI();
    try {
      await audio.play();
    } catch (e) {
      if (e.name !== 'AbortError') {
        say(kind === 'radio' ? 'Rádio sa nedá pustiť. Skontroluj internet.' : 'Túto nahrávku sa nedá prehrať.');
        this.stop();
      }
    }
    updatePlayerUI();
    setMediaSession();
  },

  pause() {
    if (!this.item) return;
    if (this.kind === 'lib') savePos(true);
    audio.pause();
    updatePlayerUI();
  },

  resume() {
    if (!this.item) return;
    if (this.kind === 'radio') audio.src = this.item.url;   // pri rádiu chceme živé vysielanie, nie oneskorenie
    audio.play().catch(() => {});
    updatePlayerUI();
  },

  stop() {
    if (this.kind === 'lib') savePos(true);
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    this.release();
    this.item = null;
    this.kind = null;
    updatePlayerUI();
  },

  release() {
    if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null; }
  },
};

function savePos(force) {
  if (player.kind !== 'lib' || !player.item) return;
  const now = Date.now();
  if (!force && now - lastPosSave < 5000) return;
  lastPosSave = now;
  try { localStorage.setItem(posKey(player.item.id), String(Math.floor(audio.currentTime || 0))); } catch { /* */ }
}

audio.addEventListener('timeupdate', () => savePos(false));
audio.addEventListener('play', updatePlayerUI);
audio.addEventListener('pause', updatePlayerUI);
audio.addEventListener('ended', () => {
  if (player.kind !== 'lib') return;
  const item = player.item;
  try { localStorage.removeItem(posKey(item.id)); } catch { /* */ }
  if (item.cat === 'hudba') { playNext(); return; }
  player.stop();
  say('Koniec. ' + item.name + ' sa dohralo.');
});
audio.addEventListener('error', () => {
  if (!player.item || !audio.getAttribute('src')) return;
  if (player.kind === 'radio' && player.retries < 3) {
    player.retries++;
    setTimeout(() => { if (player.kind === 'radio') { audio.src = player.item.url; audio.play().catch(() => {}); } }, 4000);
    return;
  }
  const radio = player.kind === 'radio';
  player.stop();
  say(radio ? 'Rádio sa prerušilo. Skontroluj internet.' : 'Túto nahrávku sa nedá prehrať.');
});

function setMediaSession() {
  if (!('mediaSession' in navigator) || !player.item) return;
  navigator.mediaSession.metadata = new MediaMetadata({ title: player.item.name, artist: 'Pomocník' });
  navigator.mediaSession.setActionHandler('play', () => player.resume());
  navigator.mediaSession.setActionHandler('pause', () => player.pause());
  navigator.mediaSession.setActionHandler('stop', () => player.stop());
}

// Pri hovorení stíšime hudbu, aby bolo rozumieť.
function duck(on) { audio.volume = on && player.playing ? 0.2 : 1; }

function updatePlayerUI() {
  const p = $('player');
  if (!player.item) {
    p.classList.add('hidden');
  } else {
    p.classList.remove('hidden');
    $('player-icon').replaceChildren(player.item.photo
      ? h('img', { src: player.item.photo, alt: '', style: 'width:100%;max-height:11vh;object-fit:cover;border-radius:14px' })
      : player.kind === 'radio' ? '📻' : player.item.cat === 'hudba' ? '🎵' : '📖');
    $('player-toggle').textContent = audio.paused ? '▶️' : '⏸️';
  }
  if (screen === 'list') renderList();
}

async function playStation(st) {
  if (!st) return say('Žiadne rádio nie je nastavené.');
  if (!st.url) return say(`${st.name} nemá nastavenú adresu.`);
  stopSpeaking();
  showCaption('Púšťam: ' + st.name);
  await player.start(st, 'radio', st.url);
}

async function playLib(item) {
  let src = item.url;
  if (item.file) {
    const blob = await idb.get(item.id).catch(() => null);
    if (!blob) return say(`Súbor ${item.name} sa v telefóne nenašiel.`);
    src = URL.createObjectURL(blob);
  }
  if (!src) return say(`${item.name} nemá nastavený súbor ani adresu.`);
  const pos = item.cat === 'citanie' ? Number(readJSON(posKey(item.id), 0)) : 0;
  writeJSON('last:' + item.cat, item.id);
  if (player.item) player.stop();
  const ok = await say((pos > 10 ? 'Pokračujem: ' : 'Púšťam: ') + item.name + '.');
  if (!ok) { if (item.file) URL.revokeObjectURL(src); return; }
  await player.start(item, 'lib', src, pos, !!item.file);
}

function playCategory(cat) {
  const items = lib(cat);
  if (!items.length) {
    showScreen('list', cat);
    return say(cat === 'hudba' ? 'Zatiaľ tu nie je žiadna hudba.' : 'Zatiaľ tu nie sú žiadne rozprávky ani knihy.');
  }
  const last = items.find(x => x.id === readJSON('last:' + cat, ''));
  return playLib(last || items[0]);
}

function playNext() {
  if (player.kind === 'radio') {
    const i = S.stations.findIndex(s => s.id === player.item.id);
    return playStation(S.stations[(i + 1) % S.stations.length]);
  }
  if (player.kind === 'lib') {
    const items = lib(player.item.cat);
    const i = items.findIndex(x => x.id === player.item.id);
    return playLib(items[(i + 1) % items.length]);
  }
  return say('Práve nič nehrá.');
}

// ===================== Telefonovanie a pomoc =====================

const cleanNumber = n => (n || '').replace(/[^\d+]/g, '');

async function callContact(c) {
  const num = cleanNumber(c.phone);
  if (!num) return say(`${c.name} nemá nastavené telefónne číslo.`);
  player.pause();
  const ok = await say((c.voiceName ? `Volám ${c.voiceName}.` : `Volám: ${c.name}.`) + ' Potom ťukni na zelený telefón.');
  if (ok) location.href = 'tel:' + num;
}

const HELP_WINDOW = 10 * 60e3;

async function callHelp() {
  const prim = contactById(S.helpPrimary), back = contactById(S.helpBackup);
  if (!prim && !back) return say('Pomoc zatiaľ nie je nastavená. Požiadaj rodinu, nech ju nastaví.');
  const st = readJSON('help', null);
  let target = prim || back, step = prim ? 1 : 2;
  if (st && st.step === 1 && Date.now() - st.t < HELP_WINDOW && back) { target = back; step = 2; }
  const num = cleanNumber(target.phone);
  if (!num) return say(`${target.name} nemá nastavené telefónne číslo.`);
  writeJSON('help', { t: Date.now(), step, asked: false });
  player.pause();
  // Pri pomoci voláme aj vtedy, ak vetu niečo preruší.
  await say(`Volám pomoc: ${target.voiceName || target.name}. Ťukni na zelený telefón.`);
  location.href = 'tel:' + num;
}

// Po návrate z hovoru o pomoc sa opýtame, či sa dovolal; ak nie, ponúkneme záložný kontakt.
function checkHelpAfterCall() {
  const st = readJSON('help', null);
  const back = contactById(S.helpBackup);
  if (!st || st.step !== 1 || st.asked || !back || Date.now() - st.t > HELP_WINDOW || Date.now() - st.t < 3000) return;
  st.asked = true;
  writeJSON('help', st);
  $('help-backup-photo').replaceChildren(faceOf(back));
  $('help-check').classList.remove('hidden');
  say(`Dovolal si sa? Ak áno, ťukni hore na zelené. Ak nie, ťukni dole na červené a zavolám ${back.voiceName || back.name}.`);
}

// ===================== Potvrdenie druhým ťuknutím =====================

let armed = null;
function disarm() {
  if (!armed) return;
  armed.el.classList.remove('armed');
  clearTimeout(armed.timer);
  armed = null;
}
function confirmTap(key, el, prompt, action) {
  if (!S.confirmTap) return action();
  const ms = Math.max(5, S.confirmSeconds || 15) * 1000;
  if (armed && armed.key === key && Date.now() - armed.t < ms) { disarm(); return action(); }
  disarm();
  el.classList.add('armed');
  armed = { key, el, t: Date.now(), timer: setTimeout(disarm, ms) };
  say(prompt);
}

// ===================== Obrazovky =====================

let screen = 'home';
let listKind = null;
const ITEM_COLORS = ['#7c3aed', '#ea580c', '#0d9488', '#2563eb', '#db2777', '#65a30d', '#ca8a04', '#0891b2'];

// Obrazovky: home (mikrofón + výber), menu (Rodina, Rádio, Hudba), contacts, list.
// Na obrazovkách nie je žiadny text – používateľ nečíta, všetko sa hovorí nahlas.
function showScreen(name, kind) {
  screen = name;
  listKind = kind || null;
  disarm();
  for (const s of ['home', 'menu', 'contacts', 'list']) $('screen-' + s).classList.toggle('hidden', s !== name);
  $('subbar').classList.toggle('hidden', name === 'home');
  $('btn-settings').classList.toggle('hidden', name !== 'home');
  if (name === 'contacts') renderContacts();
  if (name === 'list') renderList();
}

// Späť: z kontaktov a zoznamov do výberu, z výberu domov.
function goBack() {
  stopSpeaking();
  showScreen(screen === 'contacts' || screen === 'list' ? 'menu' : 'home');
}

// Mriežka vyplní celú obrazovku – čím menej položiek, tým väčšie obrázky.
function fitGrid(box, n) {
  const cols = n <= 2 ? 1 : n <= 6 ? 2 : 3;
  box.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  box.style.gridTemplateRows = `repeat(${Math.max(1, Math.ceil(n / cols))}, 1fr)`;
}

const faceOf = c => c.photo ? h('img', { src: c.photo, alt: '' }) : h('span', { class: 'noface' }, '👤');

function renderContacts() {
  const box = $('screen-contacts');
  box.replaceChildren();
  fitGrid(box, S.contacts.length);
  if (!S.contacts.length) { box.append(h('div', { class: 'empty' }, '👤')); return; }
  for (const c of S.contacts) {
    const el = h('button', { class: 'person', style: `--c:${c.color || COLORS[0]}`, 'aria-label': c.name }, faceOf(c));
    el.addEventListener('click', () =>
      confirmTap('c:' + c.id, el, `${c.name}. Ťukni ešte raz a zavolám.`, () => callContact(c)));
    box.append(el);
  }
}

function renderList() {
  const box = $('screen-list');
  const items = listKind === 'radio' ? S.stations : lib(listKind);
  const emoji = listKind === 'radio' ? '📻' : listKind === 'hudba' ? '🎵' : '📖';
  box.replaceChildren();
  fitGrid(box, items.length);
  if (!items.length) { box.append(h('div', { class: 'empty' }, emoji)); return; }
  items.forEach((it, i) => {
    const current = player.item && player.item.id === it.id;
    const el = h('button', { class: 'item' + (current ? ' playing' : ''), style: `--c:${ITEM_COLORS[i % ITEM_COLORS.length]}`, 'aria-label': it.name },
      it.photo ? h('img', { src: it.photo, alt: '' }) : h('span', { class: 'ii' }, emoji));
    el.addEventListener('click', () => {
      if (current) { if (audio.paused) player.resume(); else player.pause(); return; }
      if (listKind === 'radio') playStation(it); else playLib(it);
    });
    box.append(el);
  });
}

// ===================== Kalendár a pripomienky =====================

let calCache = readJSON('calendar', { events: [], at: 0 });

// Celodenné udalosti prídu ako 'RRRR-MM-DD', ostatné ako ISO čas.
function parseDay(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
const evStart = ev => ev.allDay ? parseDay(ev.start).getTime() : Date.parse(ev.start);
const evEnd = ev => ev.allDay ? parseDay(ev.end).getTime() : Date.parse(ev.end);

const CONTACTS_EVERY = 60 * 60e3;   // kontakty z Google stačí obnoviť raz za hodinu

// Jeden skript Google vracia udalosti z kalendára a (na požiadanie) kontakty so štítkom „Pomocník“.
async function fetchCalendar(forceContacts = false) {
  if (!S.calendarUrl) return { ok: false, msg: 'Adresa skriptu nie je vyplnená.' };
  const wantContacts = S.contactsFromGoogle && (forceContacts || Date.now() - readJSON('contactsSyncAt', 0) > CONTACTS_EVERY);
  try {
    const u = new URL(S.calendarUrl.trim());
    if (S.calendarToken) u.searchParams.set('t', S.calendarToken.trim());
    if (wantContacts) u.searchParams.set('contacts', '1');
    u.searchParams.set('_', Date.now());
    const r = await fetch(u, { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    if (j.error) throw new Error(j.error === 'unauthorized' ? 'nesprávny kľúč (token)' : j.error);
    const res = { ok: true, count: 0, calendarError: j.calendarError, contactsError: j.contactsError };
    if (j.events) {
      calCache = { events: j.events, at: Date.now() };
      writeJSON('calendar', calCache);
      res.count = j.events.length;
    }
    if (wantContacts && j.contacts) {
      applyGoogleContacts(j.contacts);
      res.contacts = j.contacts.length;
    } else if (wantContacts && !j.contactsError) {
      res.contactsError = 'skript neposlal kontakty – je nasadená nová verzia skriptu?';
    }
    return res;
  } catch (e) {
    return { ok: false, msg: e.message };
  }
}

// Kontakty z Google nahradia zoznam v telefóne. Farba a fotka nahratá v telefóne zostanú,
// ak ich Google nemá; ID (resourceName) je stále, takže výber „Pomoc“ sa zachová.
function applyGoogleContacts(list) {
  const old = new Map(S.contacts.map(c => [c.id, c]));
  S.contacts = list.map((c, i) => {
    const o = old.get(c.id) || {};
    return {
      id: c.id, name: c.name, aliases: c.aliases || '', voiceName: c.voiceName || '', phone: c.phone,
      photo: c.photo || o.photo || '', color: o.color || COLORS[i % COLORS.length], google: true,
    };
  });
  saveSettings();
  writeJSON('contactsSyncAt', Date.now());
  if (screen === 'contacts' && $('settings').classList.contains('hidden')) renderContacts();
}

function todayEvents() {
  const s = new Date(); s.setHours(0, 0, 0, 0);
  const from = s.getTime(), to = from + 86400e3;
  return (calCache.events || []).filter(ev => { const t = evStart(ev); return t >= from && t < to; })
    .sort((a, b) => (b.allDay - a.allDay) || evStart(a) - evStart(b));
}

function speakToday() {
  let txt = timeSentence() + ' ' + dateSentence();
  if (S.calendarUrl) {
    const now = Date.now();
    const rest = todayEvents().filter(ev => ev.allDay || evEnd(ev) > now);
    txt += rest.length
      ? ' Dnes máš: ' + rest.map(ev => (ev.allDay ? '' : `o ${hm(evStart(ev))}, `) + ev.title).join('. ') + '.'
      : ' Dnes už nemáš nič naplánované.';
  }
  return say(txt);
}

const remQueue = [];
let remCurrent = null, remTimer = null, remWasPlaying = false;

function checkReminders() {
  const now = Date.now();
  const ann = readJSON('announced', {});
  for (const ev of calCache.events || []) {
    let due;
    if (ev.allDay) {
      if (!S.allDayTime) continue;
      const [hh, mm] = S.allDayTime.split(':').map(Number);
      const d = parseDay(ev.start); d.setHours(hh, mm, 0, 0);
      due = d.getTime();
    } else {
      due = Date.parse(ev.start);
    }
    const key = ev.id + '@' + due;
    if (now >= due && now - due < 30 * 60e3 && !ann[key]) { ann[key] = now; remQueue.push(ev); }
  }
  for (const k in ann) if (now - ann[k] > 3 * 86400e3) delete ann[k];
  writeJSON('announced', ann);
  if (!remCurrent) nextReminder();
}

function nextReminder() {
  remCurrent = remQueue.shift() || null;
  if (!remCurrent) {
    $('reminder').classList.add('hidden');
    if (remWasPlaying) { remWasPlaying = false; player.resume(); }
    return;
  }
  if (player.playing) { remWasPlaying = true; player.pause(); }
  remCurrent.count = 0;
  $('reminder').classList.remove('hidden');
  announceReminder();
}

async function announceReminder() {
  const ev = remCurrent;
  if (!ev) return;
  ev.count++;
  await chime();
  if (remCurrent !== ev) return;
  const desc = S.readDescription && ev.description ? ' ' + ev.description : '';
  say('Pripomienka. ' + ev.title + '.' + desc + ' Keď je hotovo, ťukni na obrazovku.');
  if (ev.count < S.reminderRepeatCount) remTimer = setTimeout(announceReminder, Math.max(1, S.reminderRepeatMin) * 60e3);
}

$('reminder').addEventListener('click', async () => {
  clearTimeout(remTimer);
  remCurrent = null;
  $('reminder').classList.add('hidden');
  await say('Výborne.');
  nextReminder();
});

// ===================== Rozpoznávanie reči =====================

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let listening = null;          // { cancel } počas počúvania
const SETTLE_MS = 2000;        // po vete ešte chvíľu čakáme, či používateľ nepokračuje

const LISTEN_ERRORS = {
  'network': 'Na počúvanie treba internet. Ťukni radšej na obrázok.',
  'not-allowed': 'Pomocník nemá povolený mikrofón. Požiadaj rodinu o pomoc.',
  'service-not-allowed': 'Pomocník nemá povolený mikrofón. Požiadaj rodinu o pomoc.',
};

function setMic(on) {
  for (const m of document.querySelectorAll('.mic')) m.classList.toggle('listening', on);
}

// Počúva až S.listenSeconds sekúnd. Chrome sám končí po pár sekundách ticha,
// preto rozpoznávanie v tom čase znova spúšťame, kým používateľ niečo nepovie.
async function listen() {
  disarm();
  if (listening) { listening.cancel(); return; }
  if (!SR) return say('Tento prehliadač nevie počúvať. Otvor Pomocníka v aplikácii Chrome.');
  stopSpeaking();
  const wasPlaying = player.playing;
  if (wasPlaying) player.pause();
  await beep(880, .12);

  const deadline = Date.now() + Math.max(5, S.listenSeconds || 15) * 1000;
  const heard = [];            // doteraz povedané časti vety
  let alts = null, done = false, settle = null, r = null;

  // end(alternatívy) = spracuj; end(null) = nič nepočul; end(null, null) = zrušené ťuknutím
  const end = (result, msg) => {
    if (done) return;
    done = true;
    listening = null;
    setMic(false);
    clearTimeout(settle);
    clearTimeout(timer);
    if (r) { r.onend = null; try { r.abort(); } catch { /* */ } }
    if (result) return handleSpeech(result, wasPlaying);
    if (msg === null) { if (wasPlaying) player.resume(); return; }
    say(msg || 'Nič nebolo počuť. Ťukni na mikrofón a skús to znova.').then(() => { if (wasPlaying) player.resume(); });
  };
  const timer = setTimeout(() => end(alts), deadline - Date.now());

  const start = () => {
    r = new SR();
    r.lang = 'sk-SK';
    r.interimResults = false;
    r.maxAlternatives = 5;
    r.continuous = true;
    r.onresult = e => {
      const res = e.results[e.results.length - 1];
      if (!res.isFinal) return;
      const prefix = heard.join(' ');
      alts = Array.from(res).map(a => (prefix + ' ' + a.transcript).trim());
      heard.push(res[0].transcript);
      clearTimeout(settle);
      settle = setTimeout(() => end(alts), SETTLE_MS);
    };
    r.onerror = e => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;   // onend počúvanie obnoví
      end(null, LISTEN_ERRORS[e.error] || 'Počúvanie nefunguje. Skús to znova.');
    };
    r.onend = () => {
      if (done) return;
      if (Date.now() < deadline - 500) {
        try { start(); } catch { end(alts); }
      } else {
        end(alts);
      }
    };
    r.start();
  };

  listening = { cancel: () => end(null, null) };
  setMic(true);
  try { start(); } catch { end(null, 'Počúvanie nefunguje. Skús to znova.'); }
}

// ===================== Porozumenie povelom =====================

const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim();
const tokens = s => norm(s).split(' ').filter(Boolean);
const has = (tk, ...prefixes) => tk.some(t => prefixes.some(p => t.startsWith(p)));
const hasWord = (tk, ...ws) => tk.some(t => ws.includes(t));

// Slová, ktoré nie sú menom ani názvom (aby "pusti" nepripomínalo napr. meno "Pustaj").
const FILLER = new Set(['pusti', 'pust', 'zapni', 'zahraj', 'hraj', 'zavolaj', 'zavolat', 'volaj', 'vytoc', 'prosim',
  'mi', 'mne', 'chcem', 'by', 'som', 'sa', 'si', 'rozpravku', 'rozpravky', 'rozpravka', 'knihu', 'knihy', 'kniha',
  'hudbu', 'hudba', 'pesnicku', 'pesnicky', 'radio', 'a', 'o', 'na', 'do', 'z', 's', 'so', 'je', 'ten', 'tu', 'to',
  'mojmu', 'mojej', 'moju', 'mojho', 'moja', 'moj', 'teraz', 'hned', 'citaj', 'precitaj']);

const lcp = (a, b) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; };

// Skóre slova voči vete; toleruje slovenské koncovky (Janko – Jankovi, mama – mame).
function wordScore(w, tk) {
  let best = 0;
  for (const t of tk) {
    if (t === w) { best = Math.max(best, 100 + w.length); continue; }
    const p = lcp(w, t);
    const need = w.length <= 3 ? w.length : Math.max(3, w.length - 2);
    if (p >= need) best = Math.max(best, p * 10 - Math.abs(t.length - w.length));
  }
  return best;
}
// Všetky slová mena musia zaznieť (kontakty).
function phraseScore(phrase, tk) {
  const ws = tokens(phrase);
  if (!ws.length) return 0;
  let sum = 0;
  for (const w of ws) { const s = wordScore(w, tk); if (!s) return 0; sum += s; }
  return sum;
}
// Stačí aspoň polovica dlhších slov názvu (rozprávky, piesne, rádiá).
function titleScore(title, tk) {
  const ws = tokens(title).filter(w => w.length >= 3);
  if (!ws.length) return phraseScore(title, tk);
  let sum = 0, n = 0;
  for (const w of ws) { const s = wordScore(w, tk); if (s) { sum += s; n++; } }
  return n >= Math.ceil(ws.length / 2) ? sum : 0;
}
const namesOf = x => [x.name, ...(x.aliases || '').split(',')].map(s => s.trim()).filter(Boolean);

// margin: o koľko môže druhý najlepší zaostať, aby sme sa radšej opýtali (Petrovi – Peter alebo Petra?).
function bestMatch(items, tk, scorer, margin = 0) {
  const ranked = items.map(it => ({ it, s: Math.max(0, ...namesOf(it).map(n => scorer(n, tk))) }))
    .filter(r => r.s > 0).sort((a, b) => b.s - a.s);
  if (!ranked.length) return null;
  return { item: ranked[0].it, score: ranked[0].s, tie: ranked[1] && ranked[1].s >= ranked[0].s - margin ? ranked[1].it : null };
}
const CONTACT_MARGIN = 10;
// Kontakty z Google majú často celé meno („Janko Novák“) – stačí, keď zaznie krstné meno.
function contactScore(name, tk) {
  const full = phraseScore(name, tk);
  if (full) return full;
  const first = tokens(name)[0] || '';
  return first.length >= 3 ? wordScore(first, tk) : 0;
}

function interpret(text) {
  const tk = tokens(text);
  if (!tk.length) return null;
  const j = tk.join(' ');
  const rest = tk.filter(t => !FILLER.has(t));

  if (hasWord(tk, 'pomoc', 'sos') || has(tk, 'pomoz', 'zachran') || /\b(je mi|mi je) zle\b/.test(j)) return { type: 'help' };
  if (has(tk, 'stop', 'zastav', 'vypn', 'prestan', 'pauz') || hasWord(tk, 'ticho', 'dost')) return { type: 'stop' };
  if (has(tk, 'hlasnej', 'tichsi', 'zosil', 'stisi', 'stlm')) return { type: 'volume' };
  if (has(tk, 'pokracuj')) return { type: 'resume' };
  if (has(tk, 'dalsi', 'dalsiu', 'dalsie') || hasWord(tk, 'inu', 'ine', 'ina')) return { type: 'next' };

  if (has(tk, 'zavol', 'volaj', 'vytoc', 'telefon', 'zatelefon')) {
    const m = bestMatch(S.contacts, rest, contactScore, CONTACT_MARGIN);
    return m ? { type: 'call', m } : { type: 'contacts' };
  }
  const st = bestMatch(S.stations, rest, titleScore);
  if (has(tk, 'radi') || st) return { type: 'radio', item: st && st.item };
  if (has(tk, 'rozpravk', 'knih', 'citaj', 'precitaj', 'pribeh', 'audiokni')) {
    const m = bestMatch(lib('citanie'), rest, titleScore);
    return { type: 'play', cat: 'citanie', item: m && m.item };
  }
  if (has(tk, 'hudb', 'pesn', 'piesen', 'muzik', 'spiev')) {
    const m = bestMatch(lib('hudba'), rest, titleScore);
    return { type: 'play', cat: 'hudba', item: m && m.item };
  }
  if (has(tk, 'hodin') || hasWord(tk, 'cas', 'kolko')) return { type: 'time' };
  if (has(tk, 'datum', 'ktoreho', 'mesiac') || hasWord(tk, 'den')) return { type: 'date' };
  if (has(tk, 'program', 'kalendar', 'liek', 'pripomien', 'udalost', 'plan') || hasWord(tk, 'dnes', 'zajtra')) return { type: 'today' };
  if (has(tk, 'rodin', 'kontakt')) return { type: 'contacts' };
  if (has(tk, 'napoved', 'navod', 'pomocnik') || /\bco (vies|umis|dokazes)\b/.test(j)) return { type: 'info' };
  if (has(tk, 'domov', 'spat', 'naspat', 'zaciatok')) return { type: 'home' };

  // Samotný názov rozprávky alebo piesne, prípadne samotné meno = zavolať.
  // Pri „pusti …“ má prednosť názov („pusti Janka Hraška“ nie je volanie Jankovi).
  const playVerb = has(tk, 'pust', 'zapni', 'hraj', 'zahraj');
  const l = bestMatch(S.library, rest, titleScore);
  const c = !playVerb && bestMatch(S.contacts, rest, contactScore, CONTACT_MARGIN);
  if (l && (playVerb || !c || l.score > c.score)) return { type: 'play', cat: l.item.cat, item: l.item };
  if (c) return { type: 'call', m: c };
  if (l) return { type: 'play', cat: l.item.cat, item: l.item };
  if (playVerb && player.item) return { type: 'resume' };
  return null;
}

async function handleSpeech(alts, wasPlaying) {
  for (const text of alts) {
    const r = interpret(text);
    if (r) return run(r, wasPlaying);
  }
  await say('Prepáč, nerozumiem. Ťukni na mikrofón a skús to znova.');
  if (wasPlaying) player.resume();
}

async function run(r, wasPlaying) {
  switch (r.type) {
    case 'help': return callHelp();
    case 'stop': player.stop(); return say('Vypnuté.');
    case 'resume':
      if (player.item) { player.resume(); return; }
      return say('Práve nič nehrá.');
    case 'next': return playNext();
    case 'call':
      if (r.m.tie) {
        showScreen('contacts');
        return say(`Neviem, či ${r.m.item.name} alebo ${r.m.tie.name}. Povedz celé meno alebo ťukni na fotku.`);
      }
      return callContact(r.m.item);
    case 'contacts':
      showScreen('contacts');
      return say('Komu mám zavolať? Povedz meno alebo ťukni na fotku.');
    case 'radio': return playStation(r.item || S.stations[0]);
    case 'play': return r.item ? playLib(r.item) : playCategory(r.cat);
    case 'volume': await say('Hlasitosť sa mení tlačidlami na boku telefónu.'); break;
    case 'time': await say(timeSentence()); break;
    case 'date': await say(dateSentence()); break;
    case 'today': await speakToday(); break;
    case 'info': await say(HELP_TEXT); break;
    case 'home': showScreen('home'); break;
  }
  if (wasPlaying) player.resume();
}

// ===================== Ovládanie dotykom =====================

const TILES = {
  contacts() {
    showScreen('contacts');
    say(S.contacts.length ? 'Rodina. Ťukni na fotku alebo povedz meno.' : 'Zatiaľ tu nie sú žiadne kontakty.');
  },
  radio() {
    if (S.stations.length === 1) {
      const st = S.stations[0];
      if (player.item && player.item.id === st.id && player.playing) { player.stop(); say('Rádio vypnuté.'); }
      else playStation(st);
      return;
    }
    showScreen('list', 'radio');
    say('Rádio. Ťukni na stanicu.');
  },
  music() {
    showScreen('list', 'hudba');
    say('Hudba. Ťukni na obrázok alebo povedz názov.');
  },
};

for (const el of document.querySelectorAll('.tile')) {
  el.addEventListener('click', () => TILES[el.dataset.action](el));
}
for (const el of document.querySelectorAll('.mic')) el.addEventListener('click', listen);
$('btn-menu').addEventListener('click', () => {
  showScreen('menu');
  say('Vyber: rodina, rádio, alebo hudba.');
});
$('btn-back').addEventListener('click', goBack);
$('player-toggle').addEventListener('click', () => { if (audio.paused) player.resume(); else player.pause(); });
$('player-stop').addEventListener('click', () => { player.stop(); say('Vypnuté.'); });

$('help-ok').addEventListener('click', () => {
  $('help-check').classList.add('hidden');
  try { localStorage.removeItem('help'); } catch { /* */ }
  say('Dobre.');
});
$('help-backup').addEventListener('click', () => {
  $('help-check').classList.add('hidden');
  callHelp();
});

// Nastavenia sa otvoria až po podržaní ozubeného kolieska, aby sa nedali otvoriť omylom.
(() => {
  const gear = $('btn-settings');
  let timer;
  gear.addEventListener('pointerdown', () => { timer = setTimeout(openSettingsGuarded, 1500); });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) gear.addEventListener(ev, () => clearTimeout(timer));
  gear.addEventListener('contextmenu', e => e.preventDefault());
})();

// ===================== Spustenie =====================

let wakeLock = null;
async function keepAwake() {
  if (!S.keepAwake || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try { wakeLock = await navigator.wakeLock.request('screen'); } catch { /* */ }
}

let started = false;
$('start').addEventListener('click', async () => {
  $('start').classList.add('hidden');
  started = true;
  beep(660, .08);              // odomkne zvuk v prehliadači
  keepAwake();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  await say(greeting() + ' Ťukni na zelený mikrofón a povedz, čo chceš.');
  fetchCalendar().then(checkReminders);
  setInterval(fetchCalendar, 10 * 60e3);
  setInterval(checkReminders, 20e3);
}, { once: true });

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  keepAwake();
  if (started) { checkHelpAfterCall(); checkReminders(); }
});

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ===================== Nastavenia (pre rodinu) =====================

function openSettingsGuarded() {
  if (S.pin && prompt('PIN pre nastavenia:') !== S.pin) return;
  stopSpeaking();
  disarm();
  renderSettings();
  $('settings').classList.remove('hidden');
}

function closeSettings() {
  saveSettings();
  $('settings').classList.add('hidden');
  showScreen(screen, listKind);
}

function field(label, obj, key, type = 'text', extra = {}) {
  return [
    h('label', {}, label),
    h('input', {
      type, value: obj[key] ?? '', ...extra,
      oninput: e => { obj[key] = type === 'number' ? Number(e.target.value) : e.target.value; saveSettings(); },
    }),
  ];
}
function check(label, obj, key) {
  return h('label', { class: 'check' },
    h('input', { type: 'checkbox', checked: !!obj[key], onchange: e => { obj[key] = e.target.checked; saveSettings(); } }),
    label);
}
function btn(text, onclick, cls = '') { return h('button', { class: 'btn ' + cls, type: 'button', onclick }, text); }

function pickFile(accept, multiple, onFiles) {
  const inp = h('input', { type: 'file', accept, multiple, style: 'display:none' });
  inp.addEventListener('change', () => { onFiles(Array.from(inp.files)); inp.remove(); });
  document.body.append(inp);
  inp.click();
}

async function imageToDataUrl(file, size = 320) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const s = Math.min(img.naturalWidth, img.naturalHeight);
    const c = h('canvas', { width: size, height: size });
    c.getContext('2d').drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
    return c.toDataURL('image/jpeg', 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function photoButtons(obj) {
  return h('div', { class: 'row' },
    btn('📷 Vybrať fotku', () => pickFile('image/*', false, async ([f]) => {
      if (!f) return;
      try { obj.photo = await imageToDataUrl(f); saveSettings(); renderSettings(); }
      catch { alert('Fotku sa nepodarilo načítať.'); }
    })),
    obj.photo && btn('Bez fotky', () => { obj.photo = ''; saveSettings(); renderSettings(); }));
}

function moveButtons(arr, i) {
  const move = d => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; saveSettings(); renderSettings(); };
  return [btn('⬆️', () => move(-1)), btn('⬇️', () => move(1))];
}

function thumb(obj, emoji) {
  return obj.photo ? h('img', { class: 'thumb', src: obj.photo, alt: '' })
    : h('div', { class: 'thumb', style: `background:${obj.color || '#64748b'}` }, emoji || initial(obj.name));
}

function contactSelect(label, key) {
  const sel = h('select', { onchange: e => { S[key] = e.target.value; saveSettings(); } },
    h('option', { value: '' }, '— nikto —'),
    S.contacts.map(c => h('option', { value: c.id }, `${c.name || '(bez mena)'} ${c.phone || ''}`)));
  sel.value = S[key] || '';
  return [h('label', {}, label), sel];
}

function settingsContacts() {
  if (S.contactsFromGoogle) {
    const status = h('div', { class: 'status' });
    const at = readJSON('contactsSyncAt', 0);
    return [
      h('h2', {}, '👨‍👩‍👧 Kontakty (z Google Kontaktov)'),
      h('p', { class: 'hint' }, 'Kontakty sa načítavajú z Google Kontaktov so štítkom „Pomocník“, asi raz za hodinu. ' +
        'Meno, číslo, fotku, prezývku (= ďalšie oslovenia, napr. „syn, synovi, Jankovi“) a vlastné polia „Volanie“ a „Poradie“ ' +
        'upravujte v Google Kontaktoch. Tu sa dá zmeniť len farba rámčeka.'),
      h('div', { class: 'card' },
        h('div', { class: 'hint', style: 'margin:0' }, at ? `Naposledy načítané: ${new Date(at).toLocaleString('sk-SK')}` : 'Zatiaľ nenačítané.'),
        h('div', { class: 'row' }, btn('🔄 Načítať kontakty teraz', async () => {
          status.className = 'status'; status.textContent = 'Načítavam…';
          const r = await fetchCalendar(true);
          if (!r.ok || r.contactsError) { status.className = 'status bad'; status.textContent = 'Chyba: ' + (r.msg || r.contactsError); return; }
          renderSettings();
        }, 'primary')),
        status),
      S.contacts.map(c => h('div', { class: 'card' },
        h('div', { class: 'contact-head' }, thumb(c),
          h('div', { class: 'grow' }, h('b', {}, c.name), h('div', {}, c.phone),
            c.aliases && h('div', { class: 'hint', style: 'margin:2px 0 0' }, 'Oslovenia: ' + c.aliases),
            c.voiceName && h('div', { class: 'hint', style: 'margin:2px 0 0' }, 'Pri volaní: „Volám ' + c.voiceName + '“')),
          h('input', { type: 'color', value: c.color || COLORS[0], style: 'width:56px;height:44px', oninput: e => { c.color = e.target.value; saveSettings(); } })))),
    ];
  }
  return [
    h('h2', {}, '👨‍👩‍👧 Kontakty'),
    h('p', { class: 'hint' }, 'Do „ďalších oslovení“ napíšte, ako tomu človeku hovorí, aj s tvarmi, ktoré povie pri volaní ' +
      '(napr. „syn, synovi, Janko, Jankovi“). Podľa toho Pomocník rozumie povelu „Zavolaj Jankovi“.'),
    S.contacts.map((c, i) => h('div', { class: 'card' },
      h('div', { class: 'contact-head' }, thumb(c),
        h('div', { class: 'grow' }, h('b', {}, c.name || '(bez mena)'), photoButtons(c))),
      field('Meno (zobrazí sa pod fotkou)', c, 'name'),
      field('Telefónne číslo', c, 'phone', 'tel', { placeholder: '+421 9xx xxx xxx' }),
      field('Ďalšie oslovenia – oddeliť čiarkou', c, 'aliases', 'text', { placeholder: 'napr. syn, synovi, Janko, Jankovi' }),
      field('Čo povie telefón pri volaní – „Volám …“ (nepovinné)', c, 'voiceName', 'text', { placeholder: 'napr. synovi Jankovi' }),
      h('label', {}, 'Farba rámčeka'),
      h('input', { type: 'color', value: c.color || COLORS[0], style: 'width:80px;height:44px', oninput: e => { c.color = e.target.value; saveSettings(); } }),
      h('div', { class: 'row' }, moveButtons(S.contacts, i),
        btn('🗑️ Zmazať', () => {
          if (!confirm(`Zmazať kontakt ${c.name}?`)) return;
          S.contacts.splice(i, 1);
          if (S.helpPrimary === c.id) S.helpPrimary = '';
          if (S.helpBackup === c.id) S.helpBackup = '';
          saveSettings(); renderSettings();
        }, 'danger')))),
    h('div', { class: 'row', style: 'margin:0 12px' }, btn('➕ Pridať kontakt', () => {
      S.contacts.push({ id: uid(), name: '', aliases: '', voiceName: '', phone: '', photo: '', color: COLORS[S.contacts.length % COLORS.length] });
      saveSettings(); renderSettings();
    }, 'primary')),
  ];
}

function settingsHelp() {
  return [
    h('h2', {}, '🆘 Pomoc'),
    h('p', { class: 'hint' }, 'Na hlasový povel „Pomoc“ sa volá hlavný kontakt. ' +
      'Keď sa nedovolá, po návrate z hovoru ponúkne záložný kontakt. Číslo 112 sa nevolá.'),
    h('div', { class: 'card' }, contactSelect('Hlavný kontakt', 'helpPrimary'), contactSelect('Záložný kontakt', 'helpBackup')),
  ];
}

function settingsStations() {
  return [
    h('h2', {}, '📻 Rádio'),
    h('p', { class: 'hint' }, 'Adresa musí začínať https://. Keď je nastavené len jedno rádio, dlaždica Rádio ho rovno zapne a vypne.'),
    S.stations.map((st, i) => h('div', { class: 'card' },
      h('div', { class: 'contact-head' }, thumb(st, '📻'), h('div', { class: 'grow' }, h('b', {}, st.name || '(bez názvu)'), photoButtons(st))),
      field('Názov', st, 'name'),
      field('Ďalšie názvy – oddeliť čiarkou', st, 'aliases', 'text', { placeholder: 'napr. lumen' }),
      field('Adresa vysielania (stream)', st, 'url', 'url', { placeholder: 'https://…' }),
      h('div', { class: 'row' }, moveButtons(S.stations, i),
        btn('▶️ Vyskúšať', () => playStation(st)),
        btn('⏹️ Stop', () => player.stop()),
        btn('🗑️ Zmazať', () => { if (confirm(`Zmazať ${st.name}?`)) { S.stations.splice(i, 1); saveSettings(); renderSettings(); } }, 'danger')))),
    h('div', { class: 'row', style: 'margin:0 12px' }, btn('➕ Pridať rádio', () => {
      S.stations.push({ id: uid(), name: '', aliases: '', url: '', photo: '' }); saveSettings(); renderSettings();
    }, 'primary')),
  ];
}

const CAT_LABEL = { citanie: 'Rozprávky a knihy', hudba: 'Hudba' };

function settingsLibrary() {
  const addFiles = cat => pickFile('audio/*', true, async files => {
    for (const f of files) {
      const id = uid();
      try {
        await idb.put(id, f);
        S.library.push({ id, name: f.name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' '), aliases: '', cat, url: '', file: true, size: f.size, photo: '' });
      } catch (e) {
        alert(`Súbor ${f.name} sa nepodarilo uložiť: ${e.message}`);
      }
    }
    saveSettings(); renderSettings();
  });
  return [
    h('h2', {}, '📚 Rozprávky, knihy a hudba'),
    h('p', { class: 'hint' }, 'Súbory MP3 sa nahrajú priamo do Pomocníka v tomto telefóne. Názov upravte tak, ako ho bude vyslovovať ' +
      '(napr. „Janko Hraško“). Knihy si pamätajú, kde skončili.'),
    S.library.map((it, i) => h('div', { class: 'card' },
      h('div', { class: 'contact-head' }, thumb(it, it.cat === 'hudba' ? '🎵' : '📖'),
        h('div', { class: 'grow' }, h('b', {}, it.name || '(bez názvu)'),
          h('div', { class: 'hint', style: 'margin:4px 0 0' }, it.file ? `Súbor v telefóne, ${(it.size / 1048576).toFixed(1)} MB` : 'Odkaz na internet'),
          photoButtons(it))),
      field('Názov', it, 'name'),
      field('Ďalšie názvy – oddeliť čiarkou', it, 'aliases'),
      !it.file && field('Adresa (https://…mp3)', it, 'url', 'url'),
      h('label', {}, 'Kategória'),
      (() => {
        const sel = h('select', { onchange: e => { it.cat = e.target.value; saveSettings(); } },
          Object.entries(CAT_LABEL).map(([v, t]) => h('option', { value: v }, t)));
        sel.value = it.cat;
        return sel;
      })(),
      h('div', { class: 'row' }, moveButtons(S.library, i),
        btn('▶️ Vyskúšať', () => playLib(it)),
        btn('⏹️ Stop', () => player.stop()),
        btn('🗑️ Zmazať', async () => {
          if (!confirm(`Zmazať ${it.name}?`)) return;
          if (player.item && player.item.id === it.id) player.stop();
          if (it.file) await idb.del(it.id).catch(() => {});
          try { localStorage.removeItem(posKey(it.id)); } catch { /* */ }
          S.library.splice(i, 1); saveSettings(); renderSettings();
        }, 'danger')))),
    h('div', { class: 'row', style: 'margin:0 12px' },
      btn('➕ Rozprávky/knihy zo súborov', () => addFiles('citanie'), 'primary'),
      btn('➕ Hudba zo súborov', () => addFiles('hudba'), 'primary'),
      btn('➕ Odkaz z internetu', () => {
        S.library.push({ id: uid(), name: '', aliases: '', cat: 'citanie', url: '', file: false, size: 0, photo: '' });
        saveSettings(); renderSettings();
      })),
  ];
}

function settingsCalendar() {
  const status = h('div', { class: 'status' });
  return [
    h('h2', {}, '📅 Google: kalendár a kontakty'),
    h('p', { class: 'hint' }, 'Udalosti z Google Kalendára a kontakty z Google Kontaktov sa čítajú cez malý skript ' +
      '(návod je v súbore NAVOD.md). V čase udalosti telefón zazvoní a prečíta jej názov, napr. „Ranné lieky“.'),
    h('div', { class: 'card' },
      field('Adresa skriptu (končí na /exec)', S, 'calendarUrl', 'url', { placeholder: 'https://script.google.com/macros/s/…/exec' }),
      field('Kľúč (TOKEN zo skriptu)', S, 'calendarToken'),
      h('label', { class: 'check' },
        h('input', { type: 'checkbox', checked: S.contactsFromGoogle, onchange: e => {
          if (e.target.checked && S.contacts.length &&
            !confirm('Kontakty v telefóne sa nahradia kontaktmi z Google so štítkom „Pomocník“. Pokračovať?')) {
            e.target.checked = false; return;
          }
          S.contactsFromGoogle = e.target.checked;
          if (!S.contactsFromGoogle) S.contacts.forEach(c => { delete c.google; });
          saveSettings(); renderSettings();
        } }),
        'Kontakty brať z Google Kontaktov (štítok „Pomocník“)'),
      h('div', { class: 'row' }, btn('🔄 Otestovať spojenie', async () => {
        status.className = 'status';
        status.textContent = 'Načítavam…';
        const r = await fetchCalendar(true);
        if (!r.ok) { status.className = 'status bad'; status.textContent = 'Chyba: ' + r.msg; return; }
        const next = (calCache.events || []).filter(ev => evEnd(ev) > Date.now()).slice(0, 6)
          .map(ev => `• ${ev.allDay ? ev.start + ' (celý deň)' : new Date(evStart(ev)).toLocaleString('sk-SK')} – ${ev.title}`);
        const lines = [r.calendarError ? 'Kalendár – chyba: ' + r.calendarError : `Kalendár v poriadku, udalostí: ${r.count}`, ...next];
        if (S.contactsFromGoogle) lines.push(r.contactsError ? 'Kontakty – chyba: ' + r.contactsError : `Kontakty v poriadku, načítaných: ${r.contacts}`);
        status.className = 'status ' + (r.calendarError || r.contactsError ? 'bad' : 'ok');
        status.textContent = lines.join('\n');
      })),
      status,
      check('Čítať aj popis udalosti', S, 'readDescription'),
      field('Opakovať pripomienku každých (minút)', S, 'reminderRepeatMin', 'number', { min: 1, max: 30 }),
      field('Koľkokrát najviac pripomenúť', S, 'reminderRepeatCount', 'number', { min: 1, max: 20 }),
      field('Celodenné udalosti ohlásiť o', S, 'allDayTime', 'time')),
  ];
}

function settingsVoice() {
  const sk = voices.filter(v => /^sk/i.test(v.lang));
  const others = voices.filter(v => !/^sk/i.test(v.lang));
  const sel = h('select', { onchange: e => { S.voiceURI = e.target.value; saveSettings(); } },
    h('option', { value: '' }, 'Automaticky (slovenský hlas)'),
    sk.map(v => h('option', { value: v.voiceURI }, `${v.name} (${v.lang})`)),
    others.map(v => h('option', { value: v.voiceURI }, `${v.name} (${v.lang})`)));
  sel.value = S.voiceURI || '';
  const rate = h('input', { type: 'range', min: 0.6, max: 1.4, step: 0.05, value: S.rate,
    oninput: e => { S.rate = Number(e.target.value); saveSettings(); } });
  return [
    h('h2', {}, '🔊 Hlas a ovládanie'),
    h('div', { class: 'card' },
      h('label', {}, 'Hlas'), sel,
      h('label', {}, 'Rýchlosť reči'), rate,
      h('div', { class: 'row' }, btn('▶️ Vyskúšať hlas', () => say('Dobrý deň. Toto je skúška hlasu. ' + timeSentence()))),
      field('Ako dlho čakať na hlasový povel (sekúnd)', S, 'listenSeconds', 'number', { min: 5, max: 60 }),
      check('Telefonovať až po druhom ťuknutí na fotku (chráni pred omylom)', S, 'confirmTap'),
      field('Čas na druhé ťuknutie (sekúnd)', S, 'confirmSeconds', 'number', { min: 5, max: 60 }),
      check('Displej nezhasína, kým je Pomocník otvorený', S, 'keepAwake'),
      check('Zobrazovať titulky – čo telefón hovorí (len pre rodinu)', S, 'showCaptions'),
      field('PIN na otvorenie nastavení (prázdne = bez PIN)', S, 'pin', 'password', { inputMode: 'numeric', autocomplete: 'off' })),
  ];
}

function settingsBackup() {
  return [
    h('h2', {}, '💾 Záloha'),
    h('p', { class: 'hint' }, 'Záloha obsahuje kontakty, fotky a ostatné nastavenia. Nahraté MP3 súbory v nej nie sú.'),
    h('div', { class: 'card' }, h('div', { class: 'row', style: 'margin:0' },
      btn('⬇️ Uložiť zálohu do súboru', () => {
        const blob = new Blob([JSON.stringify({ app: 'pomocnik', version: VERSION, settings: S }, null, 1)], { type: 'application/json' });
        const a = h('a', { href: URL.createObjectURL(blob), download: `pomocnik-zaloha-${new Date().toISOString().slice(0, 10)}.json` });
        document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      }),
      btn('⬆️ Obnoviť zo zálohy', () => pickFile('application/json,.json', false, async ([f]) => {
        if (!f) return;
        try {
          const j = JSON.parse(await f.text());
          if (j.app !== 'pomocnik' || !j.settings) throw new Error('nie je to záloha Pomocníka');
          if (!confirm('Prepísať súčasné nastavenia zálohou?')) return;
          S = Object.assign(structuredClone(DEFAULTS), j.settings);
          saveSettings(); renderSettings();
        } catch (e) { alert('Zálohu sa nepodarilo načítať: ' + e.message); }
      })))),
  ];
}

function settingsDiagnostics() {
  const line = (ok, text) => h('div', { class: ok ? 'ok' : 'bad' }, (ok ? '✅ ' : '❌ ') + text);
  const standalone = matchMedia('(display-mode: standalone)').matches;
  return [
    h('h2', {}, '🩺 Kontrola telefónu'),
    h('div', { class: 'card diag' },
      line(!!SR, 'Rozpoznávanie reči' + (SR ? '' : ' – otvorte Pomocníka v Chrome')),
      line(!!slovakVoice(), 'Slovenský hlas' + (slovakVoice() ? `: ${slovakVoice().name}` : ' chýba – pozri návod (Prevod textu na reč)')),
      line(location.protocol === 'https:', 'Zabezpečená adresa (https)'),
      line('wakeLock' in navigator, 'Nezhasínanie displeja'),
      line(standalone, standalone ? 'Spustené ako aplikácia z plochy' : 'Spustené v prehliadači – pridajte na plochu (menu ⋮ → Pridať na plochu)'),
      h('div', { class: 'hint', style: 'margin:8px 0 0' }, `Verzia ${VERSION}`)),
  ];
}

function renderSettings() {
  const box = $('settings');
  const scroll = box.scrollTop;
  box.replaceChildren(...[
    h('header', {}, h('h1', {}, '⚙️ Nastavenia Pomocníka'), btn('Hotovo ✓', closeSettings, 'close')),
    settingsContacts(), settingsHelp(), settingsStations(), settingsLibrary(),
    settingsCalendar(), settingsVoice(), settingsBackup(), settingsDiagnostics()].flat(Infinity));
  box.scrollTop = scroll;
}
