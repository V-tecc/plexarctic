'use strict';
/* Custom Plex player – browser version 0.3.
   Everything is drawn on a 1920x1080 stage and driven by the keyboard like a TV remote:
   arrows move, Enter selects, Esc/Backspace goes back, Space pauses in the player. */

const APP = 'PLEX arctic';
/* PLEX:arctic wordmark (Archivo Expanded Black + Orbitron), outlined so it needs no font. */
const LOGO = '<svg class="logo" viewBox="-4.6 30.6 549.5 86.1" role="img" aria-label="PLEX:arctic"><path fill="currentColor" d="M8.2 112.0V34.9H70.2Q77.8 34.9 83.6 38.3Q89.4 41.7 92.7 47.8Q95.9 53.9 95.9 61.9Q95.9 70.1 92.6 76.2Q89.3 82.4 83.5 85.7Q77.7 89.1 70.2 89.1H35.9V112.0ZM35.9 70.0H62.4Q66.7 70.0 68.8 67.9Q70.8 65.9 70.8 62.0Q70.8 59.3 69.9 57.6Q68.9 55.8 67.1 54.9Q65.2 54.0 62.4 54.0H35.9ZM102.9 112.0V34.9H130.5V90.8H180.5V112.0ZM188.7 112.0V34.9H271.0V54.0H216.4V64.0H263.5V82.2H216.4V92.8H271.9V112.0ZM275.8 112.0 312.5 72.2 279.2 34.9H314.9L330.0 53.1H330.9L347.0 34.9H379.7L346.1 71.1L382.8 112.0H347.2L328.8 90.2H327.8L308.7 112.0Z"/><path class="logo-colon" d="M396.5 112.0V107.0H401.4V112.0ZM396.5 94.8V89.8H401.4V94.8Z"/><path fill="currentColor" d="M421.7 112.0Q420.4 112.0 419.2 111.3Q418.1 110.6 417.5 109.5Q416.8 108.4 416.8 107.0V98.9H435.1V95.0Q435.1 94.6 434.8 94.3Q434.5 94.0 434.2 94.0H416.8V89.9H434.3Q435.6 89.9 436.8 90.6Q437.9 91.2 438.6 92.4Q439.2 93.5 439.2 94.9V112.0ZM421.9 107.8H435.1V102.7H420.9V106.9Q420.9 107.3 421.2 107.6Q421.5 107.8 421.9 107.8ZM443.4 112.0V94.9Q443.4 93.5 444.1 92.4Q444.8 91.3 445.9 90.6Q447.0 89.9 448.4 89.9H460.7V94.0H448.5Q448.1 94.0 447.8 94.3Q447.5 94.6 447.5 95.0V112.0ZM468.7 112.0Q467.4 112.0 466.3 111.3Q465.2 110.6 464.5 109.5Q463.8 108.4 463.8 107.0V94.9Q463.8 93.5 464.5 92.4Q465.2 91.3 466.3 90.6Q467.4 89.9 468.7 89.9H486.1V94.0H468.9Q468.5 94.0 468.2 94.3Q467.9 94.6 467.9 95.0V106.9Q467.9 107.3 468.2 107.6Q468.5 107.8 468.9 107.8H486.2V112.0ZM495.0 112.0Q493.6 112.0 492.5 111.3Q491.4 110.6 490.7 109.5Q490.1 108.4 490.1 107.0V83.0H494.2V89.9H503.2V94.0H494.2V106.9Q494.2 107.3 494.4 107.6Q494.7 107.8 495.1 107.8H503.2V112.0ZM507.0 112.0V89.9H511.2V112.0ZM507.0 86.8V82.7H511.2V86.8ZM520.7 112.0Q519.3 112.0 518.2 111.3Q517.1 110.6 516.4 109.5Q515.7 108.4 515.7 107.0V94.9Q515.7 93.5 516.4 92.4Q517.1 91.3 518.2 90.6Q519.3 89.9 520.7 89.9H538.1V94.0H520.8Q520.4 94.0 520.1 94.3Q519.9 94.6 519.9 95.0V106.9Q519.9 107.3 520.1 107.6Q520.4 107.8 520.8 107.8H538.2V112.0Z"/></svg>';
const VERSION = '0.60.0';

/* ---------- storage and settings ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem('pp.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('pp.' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  del(k) { try { localStorage.removeItem('pp.' + k); } catch (e) { /* ignore */ } }
};
let clientId = store.get('clientId', null);
if (!clientId) {
  clientId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
  store.set('clientId', clientId);
}
const S = {
  token: store.get('token', null),
  adminToken: store.get('adminToken', null),
  user: store.get('user', null),
  server: store.get('server', null),
  homeMode: 'spotlight',   /* the other home layouts are switched off for now */
  libView: store.get('libView', 'box'),
  epView: store.get('epView', 'cards'),
  lang: store.get('lang', 'en'),
  subLang: store.get('subLang', 'app'),
  quality: store.get('quality', 'orig'),
  subDraw: store.get('subDraw', false), /* draw text subtitles in the app instead of having the server burn them in */
  tmdb: store.get('tmdb', '') || ((window.PRESET && window.PRESET.tmdb) || ''),
  ytPage: store.get('ytPage', '') || ((window.PRESET && window.PRESET.ytPage) || ''),
  fanartKey: store.get('fanartKey', '') || ((window.PRESET && window.PRESET.fanart) || ''),
  clearart: store.get('clearart', 'on'),
  auddKey: store.get('auddKey', '') || ((window.PRESET && window.PRESET.audd) || ''),
  font: store.get('font', 'Questrial'),
  forceDirect: store.get('forceDirect', false),
  account: store.get('account', null),
  theme: store.get('theme', 'dark'),
  accent: store.get('accent', 'color'),
  showMissing: store.get('showMissing', false),
  calView: store.get('calView', 'week'),
  titleStyle: store.get('titleStyle', 'logo'),
  seasonStyle: store.get('seasonStyle', 'picker'),
  trailerSrc: store.get('trailerSrc', 'youtube'),   /* 'logo' (title logos where there is one) or 'text' */
  calMode: store.get('calMode', 'tv'),          /* 'tv' (your shows) or 'movies' (cinema releases) */
  calHidden: store.get('calHidden', []),        /* shows left out of the calendar */
  calExtra: store.get('calExtra', []),          /* shows added by hand: { id (TVmaze), name, image, year } */
  movieRegion: store.get('movieRegion', 'SE')
};
/* Settings that belong to the person watching (Plex Home profile), not to the TV: which shows the calendar
   follows. Each profile keeps its own; the first profile to open this version keeps the list from before. */
function userKey(k) { return k + '.' + (S.user && S.user.id ? S.user.id : 'owner'); }
/* anything drawn outside the views that depends on the language */
function applyLangChange() { try { document.documentElement.lang = S.lang; } catch (e) { /* ignore */ } }
function loadUserPrefs() {
  const mine = (k, def) => {
    const v = store.get(userKey(k), null);
    if (v != null) return v;
    if (!store.get(k + '.split', false)) { store.set(k + '.split', true); const old = store.get(k, def); store.set(userKey(k), old); return old; }
    return def;
  };
  /* language and subtitle language are each profile's own; a profile that never chose gets this device's */
  const ownLang = store.get(userKey('lang'), null), ownSub = store.get(userKey('subLang'), null);
  if (ownLang) S.lang = ownLang; else S.lang = store.get('lang', 'en');
  if (ownSub) S.subLang = ownSub; else S.subLang = store.get('subLang', 'app');
  /* the colour theme is each profile's own too */
  const ownAccent = store.get(userKey('accent'), null);
  if (ownAccent) { S.accent = ownAccent; try { applyTheme(); } catch (e) { /* drawn later */ } }
  S.calHidden = mine('calHidden', []);
  S.calExtra = mine('calExtra', []);
  try { if (radar && radar.shows) radar.next = radarNext(); } catch (e) { /* not set up yet */ }
}
loadUserPrefs();
/* 'Questrial' is the theme's own font: Questrial for normal text, Roboto for anything bold. The rest are alternatives. */
const FONTS = ['Questrial', 'Manrope', 'Manrope Bold', 'Inter Tight', 'Barlow', 'Roboto', 'Roboto Condensed', 'IBM Plex Sans', 'Outfit'];
if (store.get('fontv', 0) < 2 || !FONTS.includes(S.font)) { S.font = 'Questrial'; store.set('font', 'Questrial'); store.set('fontv', 2); }
/* Fonts: Google Fonts by name, or your own file placed in the fonts folder as custom.woff2 / custom.ttf / custom.otf.
   "Manrope Bold" is Manrope with every weight lifted one step. */
async function applyFont() {
  let name = S.font;
  document.getElementById('stage').classList.toggle('bold', name === 'Manrope Bold');
  document.getElementById('stage').classList.toggle('qst', name === 'Questrial');
  if (name === 'Manrope Bold') name = 'Manrope';
  const fallback = "'Segoe UI', system-ui, sans-serif";
  if (name === 'custom') {
    for (const f of ['fonts/custom.woff2', 'fonts/custom.woff', 'fonts/custom.ttf', 'fonts/custom.otf']) {
      try {
        const face = new FontFace('CustomFont', 'url(' + f + ')');
        await face.load();
        document.fonts.add(face);
        document.getElementById('stage').style.setProperty('--font', "'CustomFont', " + fallback);
        return true;
      } catch (e) { /* try the next file type */ }
    }
    return false;
  }
  if (name !== 'Inter Tight' && name !== 'Manrope' && name !== 'Questrial' && name !== 'Roboto' && !document.querySelector('link[data-font="' + name + '"]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.dataset.font = name;
    l.href = 'https://fonts.googleapis.com/css2?family=' + name.replace(/ /g, '+') + ':wght@300;400;500;600;700;800&display=swap';
    document.head.appendChild(l);
  }
  /* Questrial has no Cyrillic/Greek, so those letters fall back to Manrope */
  document.getElementById('stage').style.setProperty('--font', "'" + name + "', " + (name === 'Questrial' ? "'Manrope', " : '') + fallback);
  return true;
}
if (S.token && !S.adminToken) { S.adminToken = S.token; store.set('adminToken', S.token); }

const QUALITIES = [
  { id: 'orig' },
  { id: 'q20', br: 20000, res: '1920x1080', label: '20 Mbps · 1080p' },
  { id: 'q12', br: 12000, res: '1920x1080', label: '12 Mbps · 1080p' },
  { id: 'q8', br: 8000, res: '1920x1080', label: '8 Mbps · 1080p' },
  { id: 'q4', br: 4000, res: '1280x720', label: '4 Mbps · 720p' },
  { id: 'q2', br: 2000, res: '1280x720', label: '2 Mbps · 720p' },
  { id: 'q1', br: 1500, res: '720x480', label: '1.5 Mbps · 480p' }
];
const SORTS = [
  { id: 'added', key: 'addedAt:desc', label: 'sortAdded' },
  { id: 'title', key: 'titleSort', label: 'sortTitle' },
  { id: 'released', key: 'originallyAvailableAt:desc', label: 'sortReleased' },
  { id: 'rating', key: 'audienceRating:desc', label: 'sortRating' },
  { id: 'watched', key: 'lastViewedAt:desc', label: 'sortWatched' }
];

/* ---------- text ---------- */
function t(key, vars) {
  let s = (TEXT[S.lang] && TEXT[S.lang][key]) || TEXT.en[key] || key;
  if (vars) Object.keys(vars).forEach((k) => { s = s.split('{' + k + '}').join(vars[k]); });
  return s;
}
function lang() { return LANGS.find((l) => l.code === S.lang) || LANGS[0]; }
function qLabel(id) { const q = QUALITIES.find((x) => x.id === id) || QUALITIES[0]; return q.id === 'orig' ? t('original') : q.label; }

/* ---------- helpers ---------- */
const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function hhmm(d) { return d.toLocaleTimeString(lang().locale, { hour: '2-digit', minute: '2-digit', hour12: false }); }
function dateLong(d) { return d.toLocaleDateString(lang().locale, { weekday: 'long', day: 'numeric', month: 'long' }); }
function durText(ms) {
  if (!ms) return '';
  const m = Math.round(ms / 60000);
  const h = Math.floor(m / 60);
  return h ? h + ' h ' + (m % 60) + ' min' : m + ' min';
}
function leftText(item) {
  if (!item.duration || !item.viewOffset) return '';
  return t('left', { t: durText(item.duration - item.viewOffset) });
}
function seasonsText(n) { return n ? (n === 1 ? t('seasonN1') : t('seasonsN', { n: n })) : ''; }
function tc(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const p = (n) => String(n).padStart(2, '0');
  return h ? h + ':' + p(m) + ':' + p(s) : m + ':' + p(s);
}
function epCode(it) { return 'S' + (it.parentIndex != null ? it.parentIndex : '?') + ' E' + (it.index != null ? it.index : '?'); }
function resLabel(r) {
  if (!r) return '';
  r = String(r).toLowerCase();
  if (r === '4k') return '4K';
  if (r === 'sd') return 'SD';
  return r.toUpperCase().endsWith('P') ? r.toUpperCase() : r + 'P';
}
function sourceTags(file) {
  const f = String(file || '');
  const out = [];
  if (/remux/i.test(f)) out.push('REMUX');
  if (/blu-?ray|bdrip|brrip|bdremux/i.test(f)) out.push('BLURAY');
  else if (/web-?dl/i.test(f)) out.push('WEB-DL');
  else if (/web-?rip/i.test(f)) out.push('WEBRIP');
  else if (/hdtv/i.test(f)) out.push('HDTV');
  else if (/dvd/i.test(f)) out.push('DVD');
  return out;
}
function mediaTags(m) {
  const media = m && m.Media && m.Media[0];
  if (!media) return [];
  const out = [];
  const r = resLabel(media.videoResolution);
  if (r) out.push(r);
  if (media.videoProfile && /hdr|dv|dolby/i.test(media.videoProfile)) out.push('HDR');
  if (media.audioChannels >= 6) out.push(media.audioChannels >= 8 ? '7.1' : '5.1');
  const part = media.Part && media.Part[0];
  return out.concat(sourceTags(part && part.file));
}
function tagsHTML(list, strong) {
  return list.map((x) => '<span class="tag' + (strong && strong.includes(x) ? ' strong' : '') + '">' + esc(x) + '</span>').join('');
}

/* ---------- Plex requests ---------- */
function plexParams(extra) {
  const p = new URLSearchParams({
    'X-Plex-Product': APP,
    'X-Plex-Version': VERSION,
    'X-Plex-Client-Identifier': clientId,
    'X-Plex-Platform': 'Chrome',
    'X-Plex-Device': 'Browser',
    'X-Plex-Device-Name': 'Custom player',
    'X-Plex-Language': S.lang
  });
  Object.entries(extra || {}).forEach(([k, v]) => { if (v != null) p.set(k, v); });
  return p.toString();
}
async function fetchText(url, opts) {
  opts = opts || {};
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeout || 15000);
  try {
    const r = await fetch(url, { method: opts.method || 'GET', headers: { Accept: opts.accept || 'application/json' }, signal: ctrl.signal });
    const txt = await r.text();
    if (!r.ok) { const err = new Error('The server answered ' + r.status + '.'); err.status = r.status; throw err; }
    return txt;
  } finally {
    clearTimeout(timer);
  }
}
async function getJSON(url, opts) { const txt = await fetchText(url, opts); return txt ? JSON.parse(txt) : {}; }
function tvURL(path, extra, token) { return 'https://plex.tv' + path + '?' + plexParams(Object.assign({ 'X-Plex-Token': token || S.token }, extra)); }
function pmsURL(path, extra) {
  const sep = path.includes('?') ? '&' : '?';
  return S.server.uri + path + sep + plexParams(Object.assign({ 'X-Plex-Token': S.server.token }, extra));
}
async function api(path, extra) {
  const j = await getJSON(pmsURL(path, extra));
  return j.MediaContainer || {};
}
function imgURL(path, w, h) {
  if (!path) return '';
  if (/^(https?:|data:|file:|local\/)/.test(path)) return path;
  return S.server.uri + '/photo/:/transcode?' + new URLSearchParams({ width: w, height: h, minSize: 1, upscale: 1, url: path, 'X-Plex-Token': S.server.token });
}
/* Plex answers some account endpoints only in XML; read either form. */
function parseRecords(txt, tag) {
  txt = (txt || '').trim();
  if (txt.startsWith('{') || txt.startsWith('[')) {
    const j = JSON.parse(txt);
    if (Array.isArray(j)) return j;
    const mc = j.MediaContainer || j;
    return mc[tag] || mc[tag.toLowerCase() + 's'] || j.users || [];
  }
  const doc = new DOMParser().parseFromString(txt, 'application/xml');
  return Array.from(doc.getElementsByTagName(tag)).map((el) => {
    const o = {};
    Array.from(el.attributes).forEach((a) => { o[a.name] = a.value; });
    return o;
  });
}

/* Pictures that fail to load (missing on the server, network hiccup) are hidden, so the grey placeholder
   shows instead of the browser's broken-image icon and frame. */
document.addEventListener('error', (e) => {
  const el = e.target;
  if (el && el.tagName === 'IMG' && !el.classList.contains('broken')) {
    el.classList.add('broken');
    el.removeAttribute('alt');
    el.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  }
}, true);
/* ---------- stage scaling ---------- */
const stage = $('#stage');
/* Samsung TVs apply a default security policy that ignores style="…" written in the page's HTML (it only allows
   styles set from code). That made progress bars full width and let the fanart cover titles on the TV. So every
   style attribute that appears is re-applied from code, which the policy allows. */
(function () {
  const apply = (el) => { const v = el.getAttribute('style'); if (v && el.style.cssText !== v) el.style.cssText = v; };
  const scan = (root) => { if (root.nodeType !== 1) return; if (root.hasAttribute('style')) apply(root); root.querySelectorAll('[style]').forEach(apply); };
  try {
    new MutationObserver((list) => { list.forEach((m) => m.addedNodes.forEach(scan)); }).observe(document.body, { childList: true, subtree: true });
    scan(document.body);
  } catch (e) { /* very old engines: nothing to do */ }
})();
function viewSize() {
  /* the TV can report the window size late or in a different unit; take the most reliable one available */
  const vv = window.visualViewport;
  const w = (vv && vv.width) || document.documentElement.clientWidth || window.innerWidth;
  const h = (vv && vv.height) || document.documentElement.clientHeight || window.innerHeight;
  return { w: w, h: h };
}
function fit() {
  const v = viewSize();
  if (!v.w || !v.h) return;
  const s = Math.min(v.w / 1920, v.h / 1080);
  stage.style.transformOrigin = '50% 50%';
  stage.style.transform = 'translate(-50%, -50%) scale(' + s + ')';
  /* one real screen pixel, so hairlines never vanish when the stage is scaled down */
  stage.style.setProperty('--px', Math.max(1, 1 / s).toFixed(3) + 'px');
}
window.addEventListener('resize', fit);
if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);
window.addEventListener('load', fit);
fit();
setTimeout(fit, 300);
setTimeout(fit, 1500);
/* ---------- toast ---------- */
let toastTimer = null;
function toast(msg, ms) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms || 4500);
}

/* ---------- clock ---------- */
function clockHTML(light, style) {
  return '<div class="clock' + (light ? ' light' : '') + '"' + (style ? ' style="' + style + '"' : '') + '><div class="t" data-clock="t"></div><div class="d" data-clock="d"></div></div>';
}
function tickClock() {
  const now = new Date();
  $$('[data-clock="t"]').forEach((el) => { el.textContent = hhmm(now); });
  $$('[data-clock="d"]').forEach((el) => { el.textContent = dateLong(now); });
}
setInterval(tickClock, 10000);

/* ---------- views, actions, focus and modals ---------- */
const viewEl = $('#view');
const acts = new Map();
let actSeq = 0;
function A(fn) { const id = 'a' + (++actSeq); acts.set(id, fn); return id; }

let current = null;
const stack = [];
let viewSeq = 0;
let cleanup = null;
let keyHandler = null;
let focused = null;
let modalReturn = null;
let modalArt = null;
const stillCache = new Map(), stillTried = new Set(); /* TMDB pictures for episodes not in the library */
const sub2Cache = new Map(); /* second-subtitle lines already fetched, kept for the session */
/* the last few second subtitles are also kept on the TV, since pulling one out of a video file is slow */
function sub2Store(key, txt) {
  try {
    const idx = JSON.parse(localStorage.getItem('pp.sub2idx') || '[]');
    if (txt == null) return localStorage.getItem('pp.sub2txt.' + key);
    const next = [key].concat(idx.filter((k) => k !== key));
    next.slice(8).forEach((k) => localStorage.removeItem('pp.sub2txt.' + k));
    localStorage.setItem('pp.sub2txt.' + key, txt);
    localStorage.setItem('pp.sub2idx', JSON.stringify(next.slice(0, 8)));
  } catch (e) { /* storage full or unavailable: fine, it is only a cache */ }
  return null;
} /* box art shown at the left of popups opened from an item's page or the player */

function render(html) {
  viewEl.innerHTML = html;
  if (typeof wtBadge === 'function') setTimeout(wtBadge, 0);
  document.documentElement.lang = S.lang;
  tickClock();
}
function go(fn, args) {
  if (current) { current.focusKey = focused && focused.dataset.key; stack.push(current); }
  current = { fn: fn, args: args || [] };
  run();
}
function replaceView(fn, args) { current = { fn: fn, args: args || [] }; stack.length = 0; run(); }
function back() {
  /* Home, scrolled down: Back goes up to the top first; only from the top does it ask about leaving */
  if (current && current.fn === viewHome && !modalOpen()) {
    {
      const sc = $('.homescroll', viewEl) || $('.scroll', viewEl);
      const atTop = (!sc || sc.scrollTop < 20) && (!focused || /^nav-/.test(focused.dataset.key || '') || focused.closest('nav, .tabsnav, .top'));
      if (!atTop) {
        const first = $('[data-key="nav-home"]', viewEl) || $('[data-key="sp-play"]', viewEl);
        if (sc) sc.scrollTop = 0;
        if (first) setFocus(first, true);
        if (sc) sc.scrollTop = 0;
        return;
      }
    }
  }
  if (!stack.length) { confirmExit(); return; }
  current = stack.pop();
  run();
}
/* Back on the home screen asks before leaving the app; "No" is selected */
function confirmExit() {
  if (modalOpen()) return;
  gradSheet(openModal(sheetHeader(t('exitTitle'), '') + '<div class="optlist">' +
    optionRow('ex-no', t('exitNo'), [], false, A(() => closeModal())) +
    optionRow('ex-yes', t('exitYes'), [], false, A(() => { closeModal(true); if (window.tvExit) window.tvExit(); else toast(t('exitPc'), 3000); })) +
    '</div>', 'ex-no'));
}
function rerun() { current.focusKey = focused && focused.dataset.key; run(); }
function run() {
  viewSeq++;
  if (cleanup) { try { cleanup(); } catch (e) { /* ignore */ } cleanup = null; }
  keyHandler = null;
  focused = null;
  modalReturn = null;
  modalArt = null;
  acts.clear();
  Promise.resolve(current.fn.apply(null, current.args)).catch((e) => showError(e));
}
function initFocus(preferKey, root) {
  root = root || viewEl;
  const key = preferKey || (current && current.focusKey);
  let el = key ? $('.f[data-key="' + CSS.escape(key) + '"]', root) : null;
  if (!el) el = $('.f[data-default]', root) || $('.f:not(.crumb)', root) || $('.f', root);
  if (el) setFocus(el, true);
}
/* Keep the selected item in view. Vertical scrolling is done here (instantly on the TV, where smooth
   scrolling stutters); items near the top of a page scroll it right back to the top, and leaving a page
   for the top bar does the same, so the page never stays half scrolled. */
/* bring something to the middle of its own scrolling box (never the page or stage around it: the TV's browser
   would scroll those too with scrollIntoView, and the whole screen ends up offset) */
function scrollToCenter(el) {
  const sc = el && el.closest('.scroll, .dscroll, .dllist, .mbody, .side');
  if (!sc) return;
  const r = el.getBoundingClientRect(), sr = sc.getBoundingClientRect();
  const k = sr.height / sc.clientHeight || 1;
  const mid = (r.top + r.height / 2 - sr.top) / k + sc.scrollTop;
  sc.scrollTop = Math.max(0, mid - sc.clientHeight / 2);
}
function scrollToFocus(el, instant) {
  /* the frame around everything never scrolls (the browser may have moved it when something got focus) */
  [document.documentElement, document.body, stage, viewEl].forEach((x) => { if (x && (x.scrollTop || x.scrollLeft)) { x.scrollTop = 0; x.scrollLeft = 0; } });
  const sc = el.closest('.scroll, .dscroll, .dllist, .mbody, .side');
  const smooth = !instant && !window.IS_TV;
  if (!sc) {
    $$('.scroll, .dscroll', viewEl).forEach((x) => { if (x.scrollTop && !x.closest('.modal')) x.scrollTop = 0; });
    return;
  }
  /* horizontal rows: let the browser bring the item in sideways, then restore the vertical position */
  const keep = sc.scrollTop;
  const row = el.closest('.hrow, .tabs.compact');
  if (row) {
    const r = el.getBoundingClientRect(), rr = row.getBoundingClientRect();
    if (r.left < rr.left || r.right > rr.right) row.scrollLeft += (r.left < rr.left ? r.left - rr.left - 40 : r.right - rr.right + 40) / (rr.width / row.clientWidth || 1);
  }
  sc.scrollTop = keep;
  const r = el.getBoundingClientRect(), sr = sc.getBoundingClientRect();
  const k = sr.height / sc.clientHeight || 1; /* the stage is scaled: convert screen pixels to page pixels */
  const top = (r.top - sr.top) / k + sc.scrollTop;
  const bottom = (r.bottom - sr.top) / k + sc.scrollTop;
  let target = sc.scrollTop;
  const pad = 90;
  if (top < sc.scrollTop + pad) target = top - pad;
  else if (bottom > sc.scrollTop + sc.clientHeight - pad) target = bottom - sc.clientHeight + pad;
  if (top < sc.clientHeight * 0.55 || el.closest('.spottop')) target = 0; /* the banner at the top of Home always shows whole */
  target = Math.max(0, target);
  if (Math.abs(target - sc.scrollTop) < 2) return;
  if (smooth && sc.scrollTo) sc.scrollTo({ top: target, behavior: 'smooth' }); else sc.scrollTop = target;
}
function setFocus(el, instant) {
  if (!el) return;
  if (focused && focused !== el) focused.classList.remove('focus');
  focused = el;
  el.classList.add('focus');
  /* fields marked data-okfocus only open the keyboard when OK is pressed, so you can move past them */
  if (el.tagName === 'INPUT' && !el.hasAttribute('data-okfocus')) el.focus(); else if (document.activeElement && document.activeElement.tagName === 'INPUT') document.activeElement.blur();
  scrollToFocus(el, instant);
  if (el.dataset.onfocus && acts.has(el.dataset.onfocus)) acts.get(el.dataset.onfocus)(el);
}
function visible(el) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && el.style.visibility !== 'hidden';
}
function move(dir) {
  const scope = $('.modal', viewEl) || viewEl;
  const els = $$('.f', scope).filter(visible);
  if (!els.length) return false;
  if (!focused || !els.includes(focused)) { setFocus(els[0]); return true; }
  const a = focused.getBoundingClientRect();
  const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  const pick = (list) => {
    let best = null, bestScore = Infinity;
    list.forEach((el) => {
      if (el === focused) return;
      const b = el.getBoundingClientRect();
      const bx = b.left + b.width / 2, by = b.top + b.height / 2;
      const dx = bx - ax, dy = by - ay;
      let primary, secondary;
      /* sideways distance counts from the nearest edges, so wide rows and narrow buttons above/below them line up */
      const gapX = Math.max(0, b.left - a.right, a.left - b.right);
      const gapY = Math.max(0, b.top - a.bottom, a.top - b.bottom);
      /* sideways moves only reach things that overlap horizontally if they're on the same line */
      if ((dir === 'r' || dir === 'l') && gapY > 0 && (dir === 'r' ? b.left < a.right - 2 : b.right > a.left + 2)) return;
      /* and up/down never goes to something beside it on the same line (e.g. a cast photo whose name runs to two lines) */
      if ((dir === 'd' || dir === 'u') && gapX > 0 && (dir === 'd' ? b.top < a.bottom - 2 : b.bottom > a.top + 2)) return;
      if (dir === 'r') { if (b.left < a.right - 2 && dx < 8) return; primary = Math.max(1, b.left - a.right + a.width / 2); secondary = gapY + Math.abs(dy) * 0.15; }
      if (dir === 'l') { if (b.right > a.left + 2 && dx > -8) return; primary = Math.max(1, a.left - b.right + a.width / 2); secondary = gapY + Math.abs(dy) * 0.15; }
      if (dir === 'd') { if (b.top < a.bottom - 2 && dy < 8) return; primary = Math.max(1, b.top - a.bottom + a.height / 2); secondary = gapX + Math.abs(dx) * 0.15; }
      if (dir === 'u') { if (b.bottom > a.top + 2 && dy > -8) return; primary = Math.max(1, a.top - b.bottom + a.height / 2); secondary = gapX + Math.abs(dx) * 0.15; }
      if (primary <= 0) return;
      /* left/right strongly prefer something on the same line over something diagonally below/above */
      const score = primary + secondary * 2.2 + ((dir === 'l' || dir === 'r') && gapY > 0 ? 600 : 0);
      if (score < bestScore) { bestScore = score; best = el; }
    });
    return best;
  };
  /* A block can say where leaving it in a direction should go (data-nav-l / -r / -u / -d = a list of
     data-keys): moves inside the block work as usual, and only leaving it uses the given target. */
  const box = focused.closest('[data-nav-' + dir + ']');
  if (box) {
    const inner = pick(els.filter((e) => box.contains(e)));
    if (inner) { setFocus(inner); return true; }
    const keys = box.getAttribute('data-nav-' + dir).split(',');
    for (const k of keys) {
      const el = els.find((e) => e.dataset.key === k.trim());
      if (el) { setFocus(el); return true; }
    }
  }
  /* inside a scrolling area, move within it first; only leave it (to the top bar) when nothing is left in it */
  const sc = focused.closest('.scroll, .dscroll');
  if (sc) {
    const inner = pick(els.filter((e) => sc.contains(e)));
    if (inner) { setFocus(inner); return true; }
  }
  const best = pick(els);
  if (best) { setFocus(best); return true; }
  return false;
}
function activate(el) {
  if (el && el.dataset.act && acts.has(el.dataset.act)) acts.get(el.dataset.act)(el);
}
function openModal(html, preferKey, full) {
  const had = modalOpen();
  closeModal(true);
  /* keep where to come back to when one popup replaces another (e.g. movie info → its trailer) */
  if (!had) modalReturn = (focused && document.contains(focused)) ? focused : (modalReturn && document.contains(modalReturn) ? modalReturn : focused);
  const el = document.createElement('aside');
  const art = !full && modalArt;
  el.className = 'side modal hide-scroll' + (full ? ' full' : '') + (art ? ' withart' : '');
  el.innerHTML = art ? '<div class="mart"><img src="' + esc(art) + '" alt=""></div><div class="mbody hide-scroll">' + html + '</div>' : html;
  viewEl.appendChild(el);
  initFocus(preferKey, el);
  return el;
}
function closeModal(silent) {
  const el = $('.modal', viewEl);
  if (!el) return false;
  el.remove();
  if (el._onclose) { try { el._onclose(); } catch (e) { /* ignore */ } }
  if (!silent && modalReturn && document.contains(modalReturn)) setFocus(modalReturn, true);
  if (!silent) modalReturn = null;
  return true;
}
function modalOpen() { return !!$('.modal', viewEl); }
function sheetHeader(title, note) {
  return '<div class="shead"><h2>' + esc(title) + '</h2>' + (note ? '<span class="count">' + esc(note) + '</span>' : '') + '</div>';
}
function subRow(s) {
  const tags = [];
  if (s.hearingImpaired || /sdh|hearing|\bcc\b/i.test(s.title || s.displayTitle || '')) tags.push('HI/CC');
  if (s.forced) tags.push('FORCED');
  if (s.codec) tags.push(String(s.codec).toUpperCase());
  return { id: s.id, name: s.language || s.displayTitle || '?', sub: s.title || '', tags: tags.concat(sourceTags(s.title || '')) };
}
/* Top-billed actors and the director with their photos, for the list and detailed library views.
   Library listings carry names only, so the full metadata is fetched once per title when it's selected. */
const creditCache = new Map();
function fetchCredits(it) {
  if (!creditCache.has(it.ratingKey)) {
    creditCache.set(it.ratingKey, api('/library/metadata/' + it.ratingKey).then((r) => {
      const m = (r.Metadata || [])[0] || it;
      return { roles: (m.Role || it.Role || []).slice(0, 3), dirs: (m.Director || it.Director || []).slice(0, 1) };
    }).catch(() => ({ roles: (it.Role || []).slice(0, 3), dirs: (it.Director || []).slice(0, 1) })));
  }
  return creditCache.get(it.ratingKey);
}
function creditsHTML(c) {
  if (!c || (!c.roles.length && !c.dirs.length)) return '';
  const face = (p, sub) => '<div class="cface">' + (p.thumb ? '<img src="' + esc(imgURL(p.thumb, 200, 200)) + '" alt="">' : '<span class="ini">' + esc(String(p.tag || '?').split(' ').map((w) => w[0]).join('').slice(0, 2)) + '</span>') +
    '<b>' + esc(p.tag) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div>';
  return (c.roles.length ? '<div class="cgrp"><span class="label">' + esc(t('starring')) + '</span><div class="cfaces">' + c.roles.map((p) => face(p, p.role)).join('') + '</div></div>' : '') +
    (c.dirs.length ? '<div class="cgrp"><span class="label">' + esc(t('director')) + '</span><div class="cfaces">' + c.dirs.map((p) => face(p, '')).join('') + '</div></div>' : '');
}
function fillCredits(box, it) {
  if (!box) return;
  fetchCredits(it).then((c) => { if (document.contains(box) && box.dataset.rk === String(it.ratingKey)) box.innerHTML = creditsHTML(c); });
}
/* A few menus get the blue-to-teal highlight on the selected row. */
function gradSheet(el) { if (el) el.classList.add('gradsheet'); return el; }
function optionRow(key, label, tags, selected, action, sub) {
  return '<div class="subrow f" data-key="' + esc(key) + '" data-act="' + action + '">' +
    '<span class="chk">' + (selected ? ICON.check : '') + '</span>' +
    '<span class="lang">' + esc(label) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span>' +
    '<span class="tags">' + tagsHTML(tags || []) + '</span></div>';
}

document.addEventListener('keydown', (e) => {
  const k = e.key;
  const typing = document.activeElement && document.activeElement.tagName === 'INPUT';
  if (typing && !['ArrowUp', 'ArrowDown', 'Escape', 'Enter'].includes(k)) return;
  if (keyHandler && keyHandler(e) === true) { e.preventDefault(); return; }
  if (k === 'ArrowRight') move('r');
  else if (k === 'ArrowLeft') move('l');
  else if (k === 'ArrowDown') move('d');
  else if (k === 'ArrowUp') move('u');
  else if (k === 'Enter') enterDown(e);
  else if (k === 'Escape' || (k === 'Backspace' && !typing)) {
    /* a long sheet can ask Back to go up to its top first (like Home) */
    const mo = $('.modal', viewEl);
    if (mo && typeof mo._backTop === 'function' && mo._backTop()) { e.preventDefault(); return; }
    if (!closeModal()) back();
  }
  else return;
  e.preventDefault();
});
/* Holding OK on something that has extra options (data-ctx) opens its menu; a short press works as usual. */
let held = null;
function enterDown(e) {
  if (e.repeat) return;
  const el = focused;
  if (!el || !el.dataset.ctx || typeof e.keyCode !== 'number' || e.__tv) { activate(el); return; }
  if (held) clearTimeout(held.timer);
  held = { el: el, fired: false, timer: setTimeout(() => { if (held && held.el === el) { held.fired = true; openCtx(el); } }, 650) };
}
document.addEventListener('keyup', (e) => {
  if (e.key !== 'Enter' || !held) return;
  clearTimeout(held.timer);
  const h = held; held = null;
  if (!h.fired && focused === h.el) activate(h.el);
});
function openCtx(el) {
  const fn = el && el.dataset.ctx && acts.get(el.dataset.ctx);
  if (fn) fn(el);
}
viewEl.addEventListener('contextmenu', (e) => {
  const el = e.target.closest('.f[data-ctx]');
  if (!el) return;
  e.preventDefault();
  setFocus(el, true);
  openCtx(el);
});
viewEl.addEventListener('click', (e) => {
  const el = e.target.closest('.f');
  if (!el) return;
  setFocus(el, true);
  activate(el);
});
viewEl.addEventListener('mousemove', (e) => {
  const el = e.target.closest('.f');
  if (el && el !== focused) setFocus(el, true);
});

function showError(e) {
  console.error(e);
  const msg = (e && e.name === 'AbortError') ? t('slow') : (e && e.message) || String(e);
  toast(msg + ' ' + t('goBackHint'), 7000);
}

const ICON = {
  people: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.2"></circle><path d="M3.5 19c0-3.2 2.5-5.5 5.5-5.5s5.5 2.3 5.5 5.5"></path><circle cx="17" cy="9" r="2.6"></circle><path d="M15.5 13.8c.5-.2 1-.3 1.5-.3 2.5 0 4.5 2 4.5 4.8"></path></svg>',
  grid: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="4" width="6" height="7"></rect><rect x="14" y="4" width="6" height="7"></rect><rect x="4" y="14" width="6" height="7"></rect><rect x="14" y="14" width="6" height="7"></rect></svg>',
  lines: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"></path></svg>',
  back: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"></path></svg>',
  next: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg>',
  down: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"></path></svg>',
  up: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"></path></svg>',
  play: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l12-7.5z"></path></svg>',
  pause: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"></rect><rect x="14" y="5" width="4" height="14" rx="1"></rect></svg>',
  check: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>',
  cc: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M7 13h3M13 13h4M7 16h6"></path></svg>',
  audio: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2"></path></svg>',
  quality: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"></path><circle cx="16" cy="7" r="2"></circle><circle cx="10" cy="17" r="2"></circle></svg>',
  sort: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4v16M4 17l3 3 3-3M17 20V4M14 7l3-3 3 3"></path></svg>',
  gear: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"></path><circle cx="16" cy="7" r="2"></circle><circle cx="10" cy="17" r="2"></circle></svg>',
  globe: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"></path></svg>'
};

Object.assign(ICON, {
  search: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="M20 20l-4-4"></path></svg>',
  filter: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16l-6 7.5V19l-4-2v-4.5z"></path></svg>',
  stack: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="8" width="16" height="12" rx="1"></rect><path d="M7 5h10M9 2h6"></path></svg>',
  x: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>',
  star: '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.8l2.8 6 6.5.7-4.9 4.4 1.4 6.4L12 17l-5.8 3.3 1.4-6.4L2.7 9.5l6.5-.7z"></path></svg>',
  download: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"></path></svg>',
  music: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l11-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="17" cy="16" r="3"></circle></svg>',
  image: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="1"></rect><circle cx="9" cy="9.5" r="1.6"></circle><path d="M3.5 18l5.5-5.5 4 4 3-3 4.5 4.5"></path></svg>',
  film: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="1"></rect><path d="M10 9.5v5l4.5-2.5z" fill="currentColor"></path></svg>',
  mic: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"></rect><path d="M5 11a7 7 0 0 0 14 0M12 18v3"></path></svg>',
  sliders: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M3 7h11M19 7h2M3 17h5M13 17h8"></path><path d="M14 4v6M8 14v6"></path></svg>'
});
/* Settings (icon) and the signed-in user, shown in the top bar of every main screen. */
function navTools() {
  const name = (S.user && S.user.title) || (S.account && S.account.title) || t('switchUser');
  return '<div class="tools">' +
    '<button type="button" class="btn small icon f" data-key="nav-settings" aria-label="' + esc(t('settings')) + '" data-act="' + A(() => go(viewSettings)) + '">' + ICON.sliders + '</button>' +
    '<button type="button" class="btn small f" data-key="nav-user" data-act="' + A(() => go(viewUsers)) + '">' + esc(name) + '</button></div>';
}
const THEMES = [['light', 'themeLight'], ['dark', 'themeDark'], ['auto', 'themeAuto']];
/* Sunrise and sunset for Malmö (NOAA approximation, good to a few minutes). Auto theme: dark between sunset and sunrise. */
function sunTimes(d) {
  const lat = 55.6, lon = 13.0, rad = Math.PI / 180;
  const day = Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / 86400000);
  const g = 2 * Math.PI / 365 * (day - 1);
  const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const cosH = (Math.cos(90.833 * rad) - Math.sin(lat * rad) * Math.sin(decl)) / (Math.cos(lat * rad) * Math.cos(decl));
  const ha = Math.acos(Math.max(-1, Math.min(1, cosH))) / rad;
  const utcMid = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return { rise: new Date(utcMid + (720 - 4 * (lon + ha) - eqt) * 60000), set: new Date(utcMid + (720 - 4 * (lon - ha) - eqt) * 60000) };
}
function effectiveTheme() {
  if (S.theme !== 'auto') return S.theme;
  const now = new Date(), st = sunTimes(now);
  return now >= st.rise && now < st.set ? 'light' : 'dark';
}
setInterval(() => { if (S.theme === 'auto' && stage.dataset.theme !== effectiveTheme()) applyTheme(); }, 60000);
/* colour themes on the same base: black & white, Arctic (teal & purple), Ember, Aurora, Cinema, Sakura */
const ACCENTS = [['mono', 'accentMono'], ['color', 'accentColor'], ['ember', 'palEmber'], ['aurora', 'palAurora'], ['gold', 'palGold'], ['sakura', 'palSakura'], ['cobalt', 'palCobalt']];
/* the colour squares shown next to each theme: background, surface, selection, highlight (dark theme) */
const ACCENT_SW = {
  mono: ['#111113', '#1C1C1F', '#F1F1EC', '#8A8A90'], color: ['#111113', '#1C1C1F', '#29F5DC', '#C084FC'],
  ember: ['#14110F', '#211C18', '#FFB547', '#FF7A45'], aurora: ['#0E1311', '#17201B', '#6BF2A0', '#E879F9'],
  gold: ['#0A0A0A', '#161514', '#E8C468', '#D9CBA6'], sakura: ['#121014', '#1E1A21', '#FF7EB6', '#A78BFA'],
  cobalt: ['#0E1218', '#18202B', '#4DA3FF', '#FF9F43']
};
function accentSwatch(id) { return '<span class="acsw" aria-hidden="true">' + (ACCENT_SW[id] || []).map((c) => '<i style="background: ' + c + '"></i>').join('') + '</span>'; }
function setAccent(x) { S.accent = x; store.set('accent', x); try { store.set(userKey('accent'), x); } catch (e) { /* no profile yet */ } applyTheme(); }
function autoNote() { const st = sunTimes(new Date()); return t('themeAutoNote', { a: hhmm(st.set), b: hhmm(st.rise) }); }
function applyTheme() {
  stage.dataset.theme = effectiveTheme();
  stage.dataset.accent = S.accent === 'mono' ? 'mono' : 'color';
  stage.dataset.palette = S.accent === 'mono' || S.accent === 'color' ? '' : S.accent;
}
function pickTheme() {
  const draw = (prefer) => openModal(sheetHeader(t('theme')) +
    '<div class="optlist">' + THEMES.map((x) => optionRow('th-' + x[0], t(x[1]), [], S.theme === x[0], A(() => { S.theme = x[0]; store.set('theme', x[0]); applyTheme(); draw('th-' + x[0]); }), x[0] === 'auto' ? autoNote() : '')).join('') + '</div>' +
    '<span class="label">' + esc(t('accent')) + '</span><div class="optlist">' +
    ACCENTS.map((x) => optionRow('ac-' + x[0], t(x[1]), [], S.accent === x[0], A(() => { setAccent(x[0]); draw('ac-' + x[0]); }), x[0] === 'mono' ? '' : t(x[0] === 'color' ? 'accentColorNote' : x[1] + 'Note')).replace('<span class="tags">', '<span class="tags">' + accentSwatch(x[0]))).join('') + '</div>', prefer);
  draw('th-' + S.theme);
}

/* ---------- sign in ---------- */
async function viewLogin() {
  const seq = viewSeq;
  render('<div class="center"><div class="wordmark">' + LOGO + '</div>' +
    '<div class="lead">' + t('goTo', { link: '<b>plex.tv/link</b>' }) + '</div>' +
    '<div class="code" id="code"><span>·</span><span>·</span><span>·</span><span>·</span></div>' +
    '<div class="lead" id="lmsg" style="font-size: 20px">' + esc(t('gettingCode')) + '</div></div>');
  let pin;
  try {
    pin = await getJSON('https://plex.tv/api/v2/pins?' + plexParams({ strong: 'false' }), { method: 'POST' });
  } catch (e) {
    $('#lmsg').textContent = t('noPlexTv');
    throw e;
  }
  $('#code').innerHTML = String(pin.code || '').split('').map((c) => '<span>' + esc(c) + '</span>').join('');
  $('#lmsg').textContent = t('waiting');
  const started = Date.now();
  while (seq === viewSeq && Date.now() - started < 15 * 60000) {
    await new Promise((r) => setTimeout(r, 2000));
    if (seq !== viewSeq) return;
    try {
      const p = await getJSON('https://plex.tv/api/v2/pins/' + pin.id + '?' + plexParams({ code: pin.code }));
      if (p.authToken) {
        S.token = p.authToken; S.adminToken = p.authToken; S.user = null;
        store.set('token', S.token); store.set('adminToken', S.adminToken); store.del('user');
        loadAccount();
        replaceView(viewUsers, [true]);
        return;
      }
    } catch (e) { /* keep polling */ }
  }
  if (seq === viewSeq) $('#lmsg').textContent = t('codeExpired');
}

/* ---------- servers ---------- */
async function viewServers() {
  render('<div class="center"><div class="wordmark">' + LOGO + '</div><div class="lead" id="smsg">' + esc(t('findingServers')) + '</div></div>');
  const res = await getJSON(tvURL('/api/v2/resources', { includeHttps: 1, includeRelay: 1 }));
  const servers = (Array.isArray(res) ? res : []).filter((r) => String(r.provides || '').includes('server'));
  if (!servers.length) { $('#smsg').textContent = t('noServers'); return; }
  if (servers.length === 1) return connect(servers[0]);
  render('<div class="center"><div class="wordmark">' + LOGO + '</div><div class="lead">' + esc(t('chooseServer')) + '</div>' +
    '<div style="display: flex; gap: 16px; flex-wrap: wrap; justify-content: center">' +
    servers.map((s, i) => '<button type="button" class="btn f"' + (i === 0 ? ' data-default' : '') + ' data-act="' + A(() => connect(s)) + '">' + esc(s.name) + (s.owned ? '' : ' (' + esc(t('shared')) + ')') + '</button>').join('') +
    '</div></div>');
  initFocus();
}
async function connect(r) {
  render('<div class="center"><div class="wordmark">' + LOGO + '</div><div class="lead">' + t('connecting', { name: '<b>' + esc(r.name) + '</b>' }) + '</div></div>');
  const token = r.accessToken || S.token;
  const rank = (c) => (c.local && !c.relay ? 0 : (!c.relay ? 1 : 2));
  const tries = (r.connections || []).map((c) => getJSON(c.uri + '/identity?' + plexParams({ 'X-Plex-Token': token }), { timeout: 6000 }).then(() => c));
  const results = await Promise.allSettled(tries);
  const ok = results.filter((x) => x.status === 'fulfilled').map((x) => x.value).sort((a, b) => rank(a) - rank(b));
  if (!ok.length) { toast(t('cantReach', { name: r.name }), 9000); return; }
  S.server = { name: r.name, uri: ok[0].uri, token: token, id: r.clientIdentifier, relay: !!ok[0].relay, local: !!ok[0].local };
  store.set('server', S.server);
  libIndex = null;
  if (S.server.relay) toast(t('relay'), 7000);
  replaceView(viewHome);
}
async function loadAccount() {
  try {
    const u = await getJSON(tvURL('/api/v2/user', {}, S.adminToken || S.token));
    S.account = { title: u.title || u.username || u.friendlyName || '', thumb: u.thumb || '' };
    store.set('account', S.account);
  } catch (e) { /* name stays as before */ }
}
function signOut() {
  ['token', 'adminToken', 'server', 'user', 'account'].forEach((k) => store.del(k));
  S.token = null; S.adminToken = null; S.server = null; S.user = null; S.account = null;
  libIndex = null;
  replaceView(viewLogin);
}

/* ---------- users (Plex Home) ---------- */
async function viewUsers(first) {
  render('<div class="center"><div class="wordmark">' + LOGO + '</div><div class="lead">' + esc(t('loading')) + '</div></div>');
  let users;
  /* first start after signing in: always ask who is watching; with no Plex Home, go straight on */
  const leave = (msg) => { if (first) return replaceView(viewServers); toast(msg, 6000); back(); };
  try {
    users = parseRecords(await fetchText(tvURL('/api/home/users', {}, S.adminToken)), 'User');
  } catch (e) { leave(t('usersFailed')); return; }
  if (users.length < 2) { leave(t('noUsers')); return; }
  const isProt = (u) => u.protected === true || u.protected === '1' || u.protected === 1;
  const cur = S.user ? S.user.id : (users.find((u) => u.admin === '1' || u.admin === true) || {}).id;
  render('<div class="users"><div class="wordmark">' + LOGO + '</div><h1>' + esc(t('whosWatching')) + '</h1>' +
    '<div class="utiles">' + users.map((u) => {
      const name = u.title || u.username || '?';
      return '<button type="button" class="utile f" data-key="u-' + esc(u.id) + '"' + (String(u.id) === String(cur) ? ' data-default' : '') + ' data-act="' + A(() => (isProt(u) ? go(viewPin, [u]) : switchUser(u, ''))) + '">' +
        '<span class="pic">' + (u.thumb ? '<img src="' + esc(u.thumb) + '" alt="">' : '<b>' + esc(name[0]) + '</b>') +
        (isProt(u) ? '<i class="lock" aria-label="PIN">' + LOCK + '</i>' : '') + '</span><span class="nm">' + esc(name) + '</span></button>';
    }).join('') + '</div>' + clockHTML(false, 'position: absolute; top: 56px; right: 120px') + '</div>');
  initFocus();
}
const LOCK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="1"></rect><path d="M8 11V8a4 4 0 0 1 8 0v3"></path></svg>';
async function viewPin(u) {
  let pin = '';
  const name = u.title || u.username || '?';
  const draw = () => {
    $('#pinboxes').innerHTML = [0, 1, 2, 3].map((i) => '<span class="pbox' + (i === pin.length ? ' cur' : '') + '">' + (i < pin.length ? '<i></i>' : '') + '</span>').join('');
  };
  const press = async (d) => {
    if (pin.length >= 4) return;
    pin += d;
    draw();
    if (pin.length === 4) {
      const ok = await switchUser(u, pin);
      if (!ok) { pin = ''; draw(); }
    }
  };
  const del = () => { pin = pin.slice(0, -1); draw(); };
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', 'del'];
  render('<div class="users"><div class="wordmark">' + LOGO + '</div>' +
    '<div class="pinwrap"><div class="pinuser"><span class="pic big">' + (u.thumb ? '<img src="' + esc(u.thumb) + '" alt="">' : '<b>' + esc(name[0]) + '</b>') + '</span><span class="nm">' + esc(name) + '</span></div>' +
    '<div class="pinright"><h1>' + esc(t('enterPin')) + '</h1><div class="pinboxes" id="pinboxes"></div>' +
    '<div class="keypad">' + keys.map((k) => '<button type="button" class="key f" data-key="k' + k + '"' + (k === '1' ? ' data-default' : '') + ' data-act="' + A(() => (k === 'back' ? back() : k === 'del' ? del() : press(k))) + '">' + (k === 'back' ? esc(t('back')) : k === 'del' ? esc(t('del')) : k) + '</button>').join('') + '</div></div></div>' +
    clockHTML(false, 'position: absolute; top: 56px; right: 120px') + '</div>');
  draw();
  initFocus();
  keyHandler = (e) => {
    if (/^[0-9]$/.test(e.key)) { press(e.key); return true; }
    if (e.key === 'Backspace' && pin.length) { del(); return true; }
    return false;
  };
}
async function switchUser(u, pin) {
  try {
    const txt = await fetchText(tvURL('/api/home/users/' + encodeURIComponent(u.id) + '/switch', pin ? { pin: pin } : {}, S.adminToken), { method: 'POST' });
    let tok = null;
    if (txt.trim().startsWith('{')) { const j = JSON.parse(txt); tok = j.authToken || j.authenticationToken || (j.user && (j.user.authToken || j.user.authenticationToken)); }
    else { const rec = parseRecords(txt, 'user')[0] || parseRecords(txt, 'User')[0] || {}; tok = rec.authenticationToken || rec.authToken; }
    if (!tok) throw new Error('no token');
    S.token = tok;
    S.user = { id: u.id, title: u.title || u.username, thumb: u.thumb || '', admin: u.admin === true || u.admin === '1' || u.admin === 1 };
    store.set('token', tok); store.set('user', S.user); loadUserPrefs();
    S.server = null; store.del('server'); libIndex = null;
    replaceView(viewServers);
    return true;
  } catch (e) {
    if (e.status === 401 || e.status === 403 || pin) toast(t('wrongPin'), 4000);
    else toast(t('usersFailed'), 5000);
    return false;
  }
}

/* ---------- settings ---------- */
function viewSettings() {
  const segLang = (cur, set, withApp) => '<div class="seg">' +
    (withApp ? '<button type="button" class="f' + (cur === 'app' ? ' on' : '') + '" data-key="sl-app" data-act="' + A(() => set('app')) + '">' + esc(t('sameAsApp')) + '</button>' : '') +
    LANGS.map((l) => '<button type="button" class="f' + (cur === l.code ? ' on' : '') + '" data-key="' + (withApp ? 'sl-' : 'l-') + l.code + '" data-act="' + A(() => set(l.code)) + '">' + esc(l.name) + '</button>').join('') + '</div>';
  const row = (label, control) => '<div class="srow"><span class="slabel">' + esc(label) + '</span><div class="sctl">' + control + '</div></div>';
  render('<div class="screen"><div class="top"><div style="display: flex; flex-direction: column; gap: 4px"><button type="button" class="crumb f" data-key="crumb" data-act="' + A(back) + '">' + ICON.back + esc(t('home')) + '</button><h1>' + esc(t('settings')) + '</h1></div>' + clockHTML() + '</div>' +
    '<div class="scroll hide-scroll"><div class="settings">' +
    row(t('language'), segLang(S.lang, (c) => { S.lang = c; store.set(userKey('lang'), c); if (!S.user) store.set('lang', c); applyLangChange(); rerun(); }, false)) +
    row(t('subLang'), segLang(S.subLang, (c) => { S.subLang = c; store.set(userKey('subLang'), c); if (!S.user) store.set('subLang', c); rerun(); }, true)) +
    row(t('font'), '<div class="seg wrap">' + FONTS.map((f) => '<button type="button" class="f' + (S.font === f ? ' on' : '') + '" data-key="font-' + esc(f) + '" data-act="' + A(async () => {
      const prev = S.font;
      S.font = f;
      const ok = await applyFont();
      if (!ok) { S.font = prev; applyFont(); toast(t('fontCustomMissing'), 8000); return; }
      store.set('font', f); rerun();
    }) + '"' + (f === 'custom' ? '' : ' style="font-family: \'' + esc(f.replace(' Bold', '')) + '\', sans-serif' + (f.endsWith('Bold') ? '; font-weight: 800' : '') + '"') + '>' + esc(f === 'Questrial' ? t('fontTheme') : f) + '</button>').join('') + '</div>') +
    row(t('titleStyle'), '<div class="seg">' + [['logo', t('titleLogo')], ['text', t('titleText')]].map((x) => '<button type="button" class="f' + (S.titleStyle === x[0] ? ' on' : '') + '" data-key="ts-' + x[0] + '" data-act="' + A(() => { S.titleStyle = x[0]; store.set('titleStyle', x[0]); rerun(); }) + '">' + esc(x[1]) + '</button>').join('') + '</div>') +
    row(t('seasonStyle'), '<div class="seg">' + [['numbers', t('ssNumbers')], ['picker', t('ssPicker')], ['posters', t('ssPosters')]].map((x) => '<button type="button" class="f' + (S.seasonStyle === x[0] ? ' on' : '') + '" data-key="ss-' + x[0] + '" data-act="' + A(() => { S.seasonStyle = x[0]; store.set('seasonStyle', x[0]); rerun(); }) + '">' + esc(x[1]) + '</button>').join('') + '</div>') +
    row(t('theme'), '<div class="seg">' + THEMES.map((x) => '<button type="button" class="f' + (S.theme === x[0] ? ' on' : '') + '" data-key="th-' + x[0] + '" data-act="' + A(() => { S.theme = x[0]; store.set('theme', x[0]); applyTheme(); rerun(); }) + '">' + esc(t(x[1])) + '</button>').join('') + '</div>' +
      '<div class="seg wrap">' + ACCENTS.map((x) => '<button type="button" class="f' + (S.accent === x[0] ? ' on' : '') + '" data-key="ac-' + x[0] + '" data-act="' + A(() => { setAccent(x[0]); rerun(); }) + '">' + accentSwatch(x[0]) + esc(t(x[1])) + '</button>').join('') + '</div>' + (S.theme === 'auto' ? '<span class="count">' + esc(autoNote()) + '</span>' : '')) +
    row(t('saver'), '<div class="seg">' + [0, 5, 10, 20, 30].map((n) => '<button type="button" class="f' + (saverMinutes() === n ? ' on' : '') + '" data-key="sv-' + n + '" data-act="' + A(() => { store.set('saverMin', n); rerun(); }) + '">' + esc(n ? t('saverMin', { n: n }) : t('off')) + '</button>').join('') + '</div>') +
    row(t('asTitle'), typeof asSettingsHTML === 'function' ? asSettingsHTML() : '') +
    row(t('defQuality'), '<button type="button" class="btn f" data-key="q" data-act="' + A(() => pickQuality(S.quality, (id) => { S.quality = id; store.set('quality', id); closeModal(true); rerun(); })) + '">' + ICON.quality + esc(qLabel(S.quality)) + '</button>' +
      '<button type="button" class="chip f' + (S.forceDirect ? ' on' : '') + '" data-key="fd" data-act="' + A(() => { S.forceDirect = !S.forceDirect; store.set('forceDirect', S.forceDirect); rerun(); }) + '">' + (S.forceDirect ? ICON.check : '') + esc(t('forceDirect')) + '</button>') +
    row(t('tmdbKey'), '<input class="input f" id="tmdb" data-key="tmdb" data-okfocus data-act="' + A((el) => el.focus()) + '" type="text" spellcheck="false" autocomplete="off" placeholder="' + esc(t('notSet')) + '" value="' + esc(S.tmdb) + '">' +
      '<button type="button" class="btn f" data-key="tmdbsave" data-act="' + A(() => { S.tmdb = $('#tmdb').value.trim(); store.set('tmdb', S.tmdb); trendingCache = null; toast(t('save') + ' ✓', 2000); }) + '">' + esc(t('save')) + '</button>') +
    row(t('fanartKeyLabel'), '<input class="input f" id="fanartkey" data-key="fanartkey" data-okfocus data-act="' + A((el) => el.focus()) + '" type="text" spellcheck="false" autocomplete="off" placeholder="' + esc(t('notSet')) + '" value="' + esc(S.fanartKey) + '">' +
      '<button type="button" class="btn f" data-key="fanartsave" data-act="' + A(() => { S.fanartKey = $('#fanartkey').value.trim(); store.set('fanartKey', S.fanartKey); store.del('fanartCache'); toast(t('save') + ' ✓', 2000); rerun(); }) + '">' + esc(t('save')) + '</button>') +
    row(t('clearartSetting'), '<div class="seg">' + [['on', t('clearartOn')], ['off', t('off')]].map((x) => '<button type="button" class="f' + (S.clearart === x[0] ? ' on' : '') + '" data-key="ca-' + x[0] + '" data-act="' + A(() => { S.clearart = x[0]; store.set('clearart', x[0]); rerun(); }) + '">' + esc(x[1]) + '</button>').join('') + '</div>' +
      (S.fanartKey ? '' : '<span class="sval">' + esc(t('clearartNeedsKey')) + '</span>')) +
    row(t('auddKeyLabel'), '<input class="input f" id="auddkey" data-key="auddkey" data-okfocus data-act="' + A((el) => el.focus()) + '" type="text" spellcheck="false" autocomplete="off" placeholder="' + esc(t('notSet')) + '" value="' + esc(S.auddKey) + '">' +
      '<button type="button" class="btn f" data-key="auddsave" data-act="' + A(() => { S.auddKey = $('#auddkey').value.trim(); store.set('auddKey', S.auddKey); toast(t('save') + ' ✓', 2000); }) + '">' + esc(t('save')) + '</button>' +
      '<button type="button" class="btn f" data-key="songhist" data-act="' + A(songHistorySheet) + '">' + ICON.music + esc(t('songHistory')) + '</button>') +
    row(t('wlSetting'), '<div class="seg">' + [[true, t('wlShow')], [false, t('wlHide')]].map((x) => '<button type="button" class="f' + ((store.get(userKey('wlHome'), true) !== false) === x[0] ? ' on' : '') + '" data-key="wlh-' + x[0] + '" data-act="' + A(() => { store.set(userKey('wlHome'), x[0]); rerun(); }) + '">' + esc(x[1]) + '</button>').join('') + '</div>') +
    row(t('tasteSettings'), '<button type="button" class="btn f" data-key="tastereset" data-act="' + A(() => { tasteReset(); rerun(); }) + '">' + esc(t('tasteResetBtn', { n: tasteCount() })) + '</button>', t('tasteSettingsNote')) +
    row(t('trailerSrc'), '<div class="seg">' + [['youtube', t('trailerYt')], ['plex', t('trailerPlex')]].map((x) => '<button type="button" class="f' + (S.trailerSrc === x[0] ? ' on' : '') + '" data-key="tr-' + x[0] + '" data-act="' + A(() => { S.trailerSrc = x[0]; store.set('trailerSrc', x[0]); rerun(); }) + '">' + esc(x[1]) + '</button>').join('') + '</div>') +
    row(t('ytPage'), '<input class="input f" id="ytpage" data-key="ytpage" data-okfocus data-act="' + A((el) => el.focus()) + '" type="text" spellcheck="false" autocomplete="off" placeholder="https://…github.io/…/yt.html" value="' + esc(S.ytPage) + '">' +
      '<button type="button" class="btn f" data-key="ytsave" data-act="' + A(() => { S.ytPage = $('#ytpage').value.trim(); store.set('ytPage', S.ytPage); toast(t('save') + ' ✓', 2000); }) + '">' + esc(t('save')) + '</button>') +
    row(t('wt'), '<button type="button" class="btn f" data-key="wtjoin" data-act="' + A(() => wtPanel()) + '">' + ICON.people + esc(t('wtJoinCode')) + '</button>') +
    row(t('server'), '<span class="sval">' + esc(S.server ? S.server.name : '') + '</span><button type="button" class="btn f" data-key="srv" data-act="' + A(() => { S.server = null; store.del('server'); libIndex = null; replaceView(viewServers); }) + '">' + esc(t('changeServer')) + '</button>') +
    '<div id="adminrow"></div>' +
    row(t('account'), '<span class="sval">' + esc((S.user && S.user.title) || (S.account && S.account.title) || '') + '</span><button type="button" class="btn f" data-key="sw" data-act="' + A(() => go(viewUsers)) + '">' + esc(t('switchUser')) + '</button><button type="button" class="btn f" data-key="out" data-act="' + A(signOut) + '">' + esc(t('signOut')) + '</button>') +
    '<div class="count" style="padding: 24px 0">' + esc(t('version', { v: VERSION })) + '</div>' +
    '</div></div></div>');
  initFocus();
  /* server managers: scan libraries for new files */
  const seq = viewSeq;
  isAdmin().then(async (admin) => {
    const box = $('#adminrow');
    if (!admin || !box || seq !== viewSeq) return;
    let secs = [];
    try { secs = ((await api('/library/sections')).Directory || []); } catch (e) { return; }
    if (seq !== viewSeq || !secs.length) return;
    box.outerHTML = row(t('scanLibraries'), '<span class="sval">' + esc(t('adminOnly')) + '</span>' +
      secs.map((sec) => '<button type="button" class="btn f" data-key="scan-' + esc(sec.key) + '" data-act="' + A(() => scanLibrary(sec)) + '">' + ICON.search + esc(sec.title) + '</button>').join('') +
      (secs.length > 1 ? '<button type="button" class="btn f" data-key="scan-all" data-act="' + A(() => secs.forEach(scanLibrary)) + '">' + esc(t('scanAll')) + '</button>' : '')) +
      (typeof collRunAll === 'function' ? row(t('collTitle'), '<span class="sval" id="collstat">' + esc(collStatusText()) + '</span>' +
        '<button type="button" class="btn f" data-key="collnow" data-act="' + A(() => collRunAll(false)) + '">' + ICON.stack + esc(t('collBuild')) + '</button>' +
        '<button type="button" class="chip f' + (store.get('collAuto', false) ? ' on' : '') + '" data-key="collauto" data-act="' + A(() => { store.set('collAuto', !store.get('collAuto', false)); rerun(); }) + '">' + (store.get('collAuto', false) ? ICON.check : '') + esc(t('collWeekly')) + '</button>') : '') +
      '<div id="adminusers"></div>';
    /* the main account (signed in as itself) chooses which Home profiles get the admin tools on this TV */
    if (!S.adminToken) return;
    const isHomeAdmin = (u) => u.admin === true || u.admin === '1' || u.admin === 1;
    let all = [];
    try { all = parseRecords(await fetchText(tvURL('/api/home/users', {}, S.adminToken), { timeout: 8000 }), 'User'); } catch (e) { return; }
    const owner = all.find(isHomeAdmin);
    if (S.user && (!owner || String(S.user.id) !== String(owner.id))) return;
    const users = all.filter((u) => !isHomeAdmin(u));
    const ub = $('#adminusers');
    if (!ub || seq !== viewSeq || !users.length) return;
    const drawUsers = (focusKey) => {
      const on = (store.get('adminUsers', []) || []).map(String);
      const box2 = $('#adminusers');
      if (!box2) return;
      box2.innerHTML = row(t('adminUsers'), '<span class="sval">' + esc(t('adminUsersNote')) + '</span>' + users.map((u) => '<button type="button" class="chip f' + (on.includes(String(u.id)) ? ' on' : '') + '" data-key="au-' + esc(u.id) + '" data-act="' + A(() => {
        const cur = (store.get('adminUsers', []) || []).map(String);
        const id = String(u.id);
        store.set('adminUsers', cur.includes(id) ? cur.filter((x) => x !== id) : cur.concat([id]));
        drawUsers('au-' + u.id);
      }) + '">' + (on.includes(String(u.id)) ? ICON.check : '') + esc(u.title || u.username || '?') + '</button>').join(''));
      if (focusKey) setFocus($('[data-key="' + focusKey + '"]'));
    };
    drawUsers();
  });
}
function pickQuality(cur, onPick, note, extra) {
  openModal(sheetHeader(t('quality'), note || '') +
    '<div class="optlist">' + QUALITIES.map((q) => optionRow('q-' + q.id, q.id === 'orig' ? t('original') : t('convertTo', { q: q.label }), [], q.id === cur, A(() => onPick(q.id)), q.id === 'orig' ? t('originalNote') : '')).join('') + '</div>' + (extra || ''),
  'q-' + cur);
}
function pickLanguage() {
  openModal(sheetHeader(t('language')) + '<div class="optlist">' +
    LANGS.map((l) => optionRow('l-' + l.code, l.name, [l.code.toUpperCase()], l.code === S.lang, A(() => { S.lang = l.code; store.set(userKey('lang'), l.code); if (!S.user) store.set('lang', l.code); applyLangChange(); closeModal(true); rerun(); }))).join('') + '</div>', 'l-' + S.lang);
}

/* ---------- shared item rendering ---------- */
function itemTitle(it) {
  if (it.type === 'episode') return it.grandparentTitle || it.title;
  if (it.type === 'season') return it.parentTitle || it.title;
  return it.title;
}
function itemSub(it, mode) {
  if (it.type === 'episode') return epCode(it) + (mode === 'deck' && leftText(it) ? ' · ' + leftText(it) : (it.title ? ' · ' + it.title : ''));
  if (it.type === 'season') return it.title;
  if (it.type === 'show') return [it.year, seasonsText(it.childCount)].filter(Boolean).join(' · ');
  if (mode === 'deck') return leftText(it) || t('upNext');
  return [it.year, durText(it.duration)].filter(Boolean).join(' · ');
}
/* A YouTube trailer found on TMDB: on the TV through your trailer page (or the YouTube app), on a computer in the page. */
async function tmdbTrailer(isShow, tmdbId, title) {
  if (!S.tmdb || !tmdbId) { toast(S.tmdb ? t('noTrailer') : t('trailerNeedsKey'), 6000); return; }
  try {
    /* TMDB lists only English videos unless asked: also ask for trailers in your subtitle language (local
       distributors' trailers usually have the subtitles burned in) and prefer those */
    const cc = prefLangOrder()[0];
    const j = await tmdbGet('/' + (isShow ? 'tv' : 'movie') + '/' + tmdbId + '/videos', { include_video_language: cc + ',en,null' });
    const vids = (j.results || []).filter((v) => v.site === 'YouTube');
    const mine = vids.filter((x) => x.iso_639_1 === cc);
    const pick = (l) => l.find((x) => x.type === 'Trailer' && x.official) || l.find((x) => x.type === 'Trailer');
    const v = (cc !== 'en' && pick(mine)) || pick(vids.filter((x) => x.iso_639_1 !== cc)) || pick(vids) || vids[0];
    if (!v) { toast(t('noTrailer'), 5000); return; }
    if (window.IS_TV && S.ytPage) { trailerInApp(v.key, title); return; }
    if (window.IS_TV) { openYouTube(v.key); return; }
    openModal('<iframe class="yt" referrerpolicy="strict-origin-when-cross-origin" src="https://www.youtube.com/embed/' + encodeURIComponent(v.key) + '?autoplay=1&rel=0&modestbranding=1" title="' + esc(t('trailer')) + '" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>' +
      '<button type="button" class="btn f ytclose" data-default data-act="' + A(() => closeModal()) + '">' + ICON.back + esc(t('back')) + '</button>', null, true);
  } catch (e) { toast(t('noTrailer'), 5000); }
}
/* With your own trailer page set up (Settings), YouTube trailers play inside the app: the page has a real
   web address, which YouTube needs, and the app steers it with play/pause and skip commands. */
function trailerInApp(id, title) {
  const cc = prefLangOrder()[0];
  const src = S.ytPage + (S.ytPage.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(id) + '&cc=' + encodeURIComponent(cc) + '&hl=' + encodeURIComponent(S.lang) + '&_v=' + encodeURIComponent(VERSION);
  const el = openModal('<iframe class="yt ytpage" tabindex="-1" src="' + esc(src) + '" title="' + esc(t('trailer')) + '" allow="autoplay; encrypted-media; fullscreen"></iframe>' +
    '<div class="ytbar"><span class="yttitle">' + esc(title || '') + '</span><span class="ytpos" id="ytpos"></span><span class="ythint">' + esc(t('ytHint')) + '</span></div>', 'ytback', true);
  el.classList.add('trailerpage');
  const frame = $('iframe', el);
  const cmd = (c) => { try { frame.contentWindow.postMessage(c, '*'); } catch (e) { /* ignore */ } };
  let hideT = null;
  const wakeBar = () => { el.classList.remove('idle'); clearTimeout(hideT); hideT = setTimeout(() => el.classList.add('idle'), 4000); };
  wakeBar();
  let failed = false;
  const onMsg = (e) => {
    const d = e.data || {};
    if (d.yt === 'time') { const p = $('#ytpos'); if (p && d.d) p.textContent = tc(d.t) + ' / ' + tc(d.d); }
    if (d.yt === 'state' && d.s === 0) closeModal();
    if (d.yt === 'cc') {
      const ln0 = (LANGS.find((l) => l.code === cc) || { name: cc }).name; const ln = S.lang === 'sv' || S.lang === 'cs' ? ln0.toLowerCase() : ln0;
      const msg = d.mode === 'looking' ? t('ytCcLooking', { l: ln }) : d.mode === 'own' ? t('ytCcOwn', { l: ln }) : d.mode === 'translated' ? t('ytCcTranslated', { l: ln }) : t('ytCcNone', { l: ln });
      let c = $('.ytcc', el); if (!c) { const bar = $('.ythint', el); if (bar) { bar.insertAdjacentHTML('beforebegin', '<span class="ytcc"></span>'); c = $('.ytcc', el); } } if (c) { c.textContent = msg; c.className = 'ytcc ' + d.mode; } if (d.mode !== 'looking') wakeBar();
    }
    if (d.yt === 'error' && !failed) { failed = true; closeModal(); toast(t('ytPageFailed'), 6000); openYouTube(id); }
  };
  window.addEventListener('message', onMsg);
  const prevKeys = keyHandler;
  keyHandler = (e) => {
    if (!document.contains(el)) return prevKeys ? prevKeys(e) : false;
    wakeBar();
    if (e.key === 'Enter' || e.key === ' ') { cmd({ cmd: 'toggle' }); return true; }
    if (e.key === 'ArrowLeft') { cmd({ cmd: 'seek', by: -10 }); return true; }
    if (e.key === 'ArrowRight') { cmd({ cmd: 'seek', by: 10 }); return true; }
    return false;
  };
  el._onclose = () => { clearTimeout(hideT); window.removeEventListener('message', onMsg); keyHandler = prevKeys; };
}
/* Trailers on the TV open in the YouTube app: YouTube refuses to play inside an installed app
   ("video player configuration error"), because such apps don't send the web address YouTube now requires.
   First the same route a phone uses to cast to the TV (DIAL), then a direct launch of the YouTube app. */
async function openYouTube(id) {
  toast(t('trailerYouTube'), 4000);
  try { fetch('http://127.0.0.1:8080/ws/apps/YouTube', { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: 'v=' + id }).catch(() => {}); } catch (e) { /* ignore */ }
  await sleep(3000);
  if (document.hidden) return;
  const YT = '111299001912';
  const plain = () => { try { tizen.application.launch(YT, () => toast(t('trailerSearch'), 8000), () => toast(t('noTrailer'), 5000)); } catch (e) { toast(t('noTrailer'), 5000); } };
  try {
    const ctl = new tizen.ApplicationControl('http://tizen.org/appcontrol/operation/view', 'https://www.youtube.com/watch?v=' + id, null, null,
      [new tizen.ApplicationControlData('PAYLOAD', [JSON.stringify({ values: 'v=' + id })])]);
    tizen.application.launchAppControl(ctl, YT, () => {}, plain);
  } catch (e) { plain(); }
}
/* Options for a movie or episode, opened by holding OK on it. */
async function itemMenuByKey(key) {
  try { const m = ((await api('/library/metadata/' + key)).Metadata || [])[0]; if (m) itemMenu(m); } catch (e) { /* ignore */ }
}
/* Shows (and seasons): play on where you are, start from the first episode, open, mark everything watched or unwatched. */
function showMenu(it) {
  const showKey = it.type === 'season' ? (it.parentRatingKey || it.ratingKey) : it.ratingKey;
  const title = it.type === 'season' ? (it.parentTitle || it.title) : it.title;
  const left = it.leafCount ? it.leafCount - (it.viewedLeafCount || 0) : 0;
  const allSeen = it.leafCount && !left;
  const eps = async () => ((await api('/library/metadata/' + showKey + '/allLeaves')).Metadata || []).slice().sort((a, b) => (a.parentIndex - b.parentIndex) || (a.index - b.index));
  const rows = [];
  rows.push(optionRow('cx-next', it.viewedLeafCount ? t('playNextEp') : t('startWatching'), [], false, A(async () => {
    closeModal(true);
    try { const all = await eps(); const n = all.find((e) => e.viewOffset) || all.find((e) => !e.viewCount) || all[0]; if (n) go(viewPlayer, [n.ratingKey]); } catch (e) { toast(t('noFile'), 4000); }
  }), left && it.viewedLeafCount ? t('nLeft', { n: left }) : ''));
  rows.push(optionRow('cx-first', t('fromFirstEp'), [], false, A(async () => {
    closeModal(true);
    try { const all = await eps(); const f = all.find((e) => e.parentIndex >= 1) || all[0]; if (f) go(viewPlayer, [f.ratingKey, { fromStart: true }]); } catch (e) { toast(t('noFile'), 4000); }
  }), 'S1 E1'));
  rows.push(optionRow('cx-wt', t('wt'), [], false, A(() => { closeModal(true); wtStart(it); }), t('wtMenuNote')));
  rows.push(optionRow('cx-open', t('ctxShow'), [], false, A(() => { closeModal(true); go(viewDetails, [showKey]); })));
  if (typeof wlRow === 'function' && it.type === 'show' && wlRow(it)) rows.push(wlRow(it));
  if (typeof tasteRows === 'function' && it.type === 'show') tasteRows(it).forEach((r) => rows.push(r));
  if (typeof artAllowedNow === 'function' && artAllowedNow()) rows.push(optionRow('cx-art', t('artChange'), [], false, A(() => { closeModal(true); artEditor({ ratingKey: showKey }); }), t('artMenuNote')));
  rows.push(optionRow('cx-seen', allSeen ? t('markUnwatched') : t('markWatched'), [], false, A(async () => {
    closeModal(true);
    try { await fetch(pmsURL(allSeen ? '/:/unscrobble' : '/:/scrobble', { key: showKey, identifier: 'com.plexapp.plugins.library' })); } catch (e) { /* ignore */ }
    toast(allSeen ? t('ctxResetDone') : t('markedWatched'), 3000);
    rerun();
  }), allSeen ? '' : t('markShowNote')));
  const prevArt = modalArt;
  modalArt = imgURL(posterOf(it), 440, 660) || prevArt;
  gradSheet(openModal(sheetHeader(title, it.leafCount ? t('nEpisodesLeft', { n: left, m: it.leafCount }) : '') + '<div class="optlist">' + rows.join('') + '</div>', 'cx-next'));
  modalArt = prevArt;
}
function itemMenu(it) {
  if (it && it.virtual) return typeof woMenu === 'function' ? woMenu(it) : undefined;
  if (it && (it.type === 'show' || it.type === 'season')) return showMenu(it);
  if (!it || !it.ratingKey || (it.type !== 'movie' && it.type !== 'episode')) return;
  const ep = it.type === 'episode';
  const rows = [];
  if (it.viewOffset) rows.push(optionRow('cx-resume', t('resume'), [], false, A(() => { closeModal(true); go(viewPlayer, [it.ratingKey]); }), leftText(it)));
  rows.push(optionRow('cx-start', it.viewOffset ? t('fromStart') : t('play'), [], false, A(() => { closeModal(true); go(viewPlayer, [it.ratingKey, { fromStart: true }]); })));
  rows.push(optionRow('cx-wt', t('wt'), [], false, A(() => { closeModal(true); wtStart(it); }), t('wtMenuNote')));
  rows.push(optionRow('cx-open', ep ? t('ctxEpisode') : t('ctxDetails'), [], false, A(() => { closeModal(true); go(viewDetails, [it.ratingKey]); })));
  if (typeof wlRow === 'function' && wlRow(it)) rows.push(wlRow(it));
  if (typeof tasteRows === 'function') tasteRows(it).forEach((r) => rows.push(r));
  if (ep && it.grandparentRatingKey) rows.push(optionRow('cx-show', t('ctxShow'), [], false, A(() => { closeModal(true); go(viewDetails, [it.grandparentRatingKey]); }), it.grandparentTitle));
  rows.push(optionRow('cx-subs', t('subtitles'), [], false, A(async () => {
    const m = ((await api('/library/metadata/' + it.ratingKey)).Metadata || [])[0];
    const part = m && m.Media && m.Media[0] && m.Media[0].Part && m.Media[0].Part[0];
    if (!part) { toast(t('noFile'), 5000); return; }
    openSubPicker({ ratingKey: it.ratingKey, part: part, subs: (part.Stream || []).filter((x) => x.streamType === 3), guided: false, onChosen: () => { closeModal(); toast(t('ctxSubsSaved'), 3500); } });
  })));
  if (!it.viewCount || it.viewOffset) rows.push(optionRow('cx-watched', t('markWatched'), [], false, A(async () => {
    closeModal(true);
    try { await fetch(pmsURL('/:/scrobble', { key: it.ratingKey, identifier: 'com.plexapp.plugins.library' })); } catch (e) { /* ignore */ }
    toast(t('markedWatched'), 3000);
    rerun();
  })));
  if (it.viewCount || it.viewOffset) rows.push(optionRow('cx-reset', t('ctxReset'), [], false, A(async () => {
    closeModal(true);
    const id = 'com.plexapp.plugins.library';
    try { await fetch(pmsURL('/:/unscrobble', { key: it.ratingKey, identifier: id })); } catch (e) { /* ignore */ }
    try { await fetch(pmsURL('/actions/removeFromContinueWatching', { ratingKey: it.ratingKey }), { method: 'PUT' }); } catch (e) { /* older servers */ }
    toast(t('ctxResetDone'), 3500);
    rerun();
  }), t('ctxResetSub')));
  if (ep || it.viewOffset) rows.push(optionRow('cx-deck', t('deckRemove'), [], false, A(() => { closeModal(true); deckRemove(it); }), t('deckRemoveSub')));
  if (typeof artAllowedNow === 'function' && artAllowedNow()) rows.push(optionRow('cx-art', t('artChange'), [], false, A(() => { closeModal(true); artEditor(it); }), t('artMenuNote')));
  const prevArt = modalArt;
  modalArt = imgURL(posterOf(it), 440, 660) || prevArt;
  gradSheet(openModal(sheetHeader(ep ? (it.grandparentTitle || itemTitle(it)) : itemTitle(it), ep ? epCode(it) + (it.title ? ' · ' + it.title : '') : (it.year || '') + '') +
    '<div class="optlist">' + rows.join('') + '</div>', it.viewOffset ? 'cx-resume' : 'cx-start'));
  modalArt = prevArt;
}
/* "Remove from Continue watching": the server is told (newer Plex servers honour it), and the app also hides it
   itself for this profile until you watch it again */
function deckHidden() { return store.get(userKey('deckHidden'), {}) || {}; }
function deckFilter(list) {
  const h = deckHidden();
  return list.filter((it) => { const v = h[it.ratingKey]; return v == null || (it.lastViewedAt || 0) > v; });
}
async function deckRemove(it) {
  const h = deckHidden();
  h[it.ratingKey] = it.lastViewedAt || Math.floor(Date.now() / 1000);
  const ks = Object.keys(h); if (ks.length > 200) ks.sort((a, b) => h[a] - h[b]).slice(0, ks.length - 200).forEach((k) => delete h[k]);
  store.set(userKey('deckHidden'), h);
  try { await fetch(pmsURL('/actions/removeFromContinueWatching', { ratingKey: it.ratingKey }), { method: 'PUT' }); } catch (e) { /* older servers: the app's own hiding still works */ }
  toast(t('deckRemoved'), 3500);
  rerun();
}
function openItem(it) {
  if (it.type === 'episode') return go(viewDetails, [it.ratingKey]);
  if (it.type === 'season') return go(viewDetails, [it.parentRatingKey || it.ratingKey]);
  return go(viewDetails, [it.ratingKey]);
}
function progress(it) {
  const dur = it.duration || (it.Media && it.Media[0] && it.Media[0].duration) || 0;
  if (!dur || !it.viewOffset) return 0;
  /* started items always show a little, and never look finished */
  return Math.max(2, Math.min(98, Math.round(it.viewOffset / dur * 1000) / 10));
}
function posterOf(it) {
  if (it.type === 'episode') return it.grandparentThumb || it.parentThumb || it.thumb;
  if (it.type === 'season') return it.thumb || it.parentThumb;
  return it.thumb;
}
function cardHTML(it, key, action, opts) {
  opts = opts || {};
  const poster = opts.poster || imgURL(posterOf(it), 300, 450);
  const pct = progress(it);
  const isShowish = it.type === 'show' || it.type === 'season';
  /* shows: watched only when every episode is; otherwise the corner shows how many are left */
  const watched = isShowish ? (it.leafCount && it.viewedLeafCount >= it.leafCount) : (it.viewCount && !it.viewOffset);
  const unwatchedN = isShowish && it.leafCount ? it.leafCount - (it.viewedLeafCount || 0) : 0;
  const ctx = opts.ctx ? ' data-ctx="' + opts.ctx + '"' : it && it.ratingKey && ['movie', 'episode', 'show', 'season'].includes(it.type) ? ' data-ctx="' + A(() => itemMenu(it)) + '"' : '';
  return '<div class="card f" data-key="' + esc(key) + '" data-act="' + action + '"' + ctx + '>' +
    '<div class="cimg">' +
    (poster ? '<img class="img" loading="lazy" src="' + esc(poster) + '" alt="">' : '<div class="img"></div>') +
    (watched ? '<span class="watched" aria-label="' + esc(t('watched')) + '">' + ICON.check + '</span>' : unwatchedN > 0 ? '<span class="watched leftn" aria-label="' + esc(t('nLeft', { n: unwatchedN })) + '">' + unwatchedN + '</span>' : '') +
    (opts.badge ? '<span class="badge">' + esc(opts.badge) + '</span>' : '') +
    '</div>' +
    (opts.bar && pct ? '<div class="bar"><i style="width: ' + pct + '%"></i></div>' : '') +
    '<div class="t">' + esc(opts.title || itemTitle(it)) + '</div>' +
    '<div class="s">' + esc(opts.sub != null ? opts.sub : itemSub(it, opts.mode)) + '</div>' +
    (opts.tags && opts.tags.length ? '<div class="tags ctags">' + tagsHTML(opts.tags) + '</div>' : '') + '</div>';
}
function lineHTML(it, key, action, opts) {
  opts = opts || {};
  const thumb = imgURL(it.type === 'episode' ? (it.thumb || it.grandparentArt) : (it.art || it.thumb), 128, 72);
  const pct = progress(it);
  const title = it.type === 'episode' ? itemTitle(it) + ' · ' + epCode(it) : itemTitle(it);
  const meta = opts.mode === 'deck' ? (leftText(it) || t('upNext')) : (it.type === 'episode' ? (it.title || '') : (it.year || ''));
  return '<div class="line f" data-key="' + esc(key) + '" data-act="' + action + '">' +
    (thumb ? '<img class="thumb" loading="lazy" src="' + esc(thumb) + '" alt="">' : '<div class="thumb"></div>') +
    '<div class="main"><div class="row"><span class="title">' + esc(title) + '</span><span class="meta">' + esc(meta) + '</span></div>' +
    (opts.mode === 'deck' ? '<div class="bar"><i style="width: ' + pct + '%"></i></div>' : '') +
    '</div></div>';
}

/* ---------- library index (used to mark trending titles you own) ---------- */
let libIndex = null;
async function loadLibIndex(sections) {
  if (libIndex) return libIndex;
  const idx = new Map();
  await Promise.all(sections.filter((s) => s.type === 'movie' || s.type === 'show').map(async (s) => {
    try {
      const res = await api('/library/sections/' + s.key + '/all', { includeGuids: 1, 'X-Plex-Container-Start': 0, 'X-Plex-Container-Size': 20000 });
      (res.Metadata || []).forEach((it) => {
        (it.Guid || []).forEach((g) => {
          const m = /^tmdb:\/\/(\d+)/.exec(g.id || '');
          if (m) idx.set((s.type === 'movie' ? 'movie:' : 'tv:') + m[1], it);
        });
      });
    } catch (e) { /* skip this section */ }
  }));
  libIndex = idx;
  return idx;
}
let trendingCache = null;
async function loadTrending() {
  if (!S.tmdb) return null;
  if (trendingCache && trendingCache.lang === S.lang) return trendingCache.items;
  const tl = { en: 'en-US', sv: 'sv-SE', cs: 'cs-CZ', uk: 'uk-UA', el: 'el-GR' }[S.lang] || 'en-US';
  const isBearer = S.tmdb.length > 60;
  const url = 'https://api.themoviedb.org/3/trending/all/week?language=' + tl + (isBearer ? '' : '&api_key=' + encodeURIComponent(S.tmdb));
  const r = await fetch(url, { headers: isBearer ? { Authorization: 'Bearer ' + S.tmdb, Accept: 'application/json' } : { Accept: 'application/json' } });
  if (!r.ok) throw new Error('tmdb ' + r.status);
  const j = await r.json();
  const items = (j.results || []).filter((x) => x.media_type === 'movie' || x.media_type === 'tv').slice(0, 20);
  trendingCache = { lang: S.lang, items: items };
  return items;
}

/* ---------- home ---------- */
async function viewHome() {
  const seq = viewSeq;
  render('<div class="screen"><div class="top"><h1>' + esc(t('home')) + '</h1>' + clockHTML() + '</div><div class="empty">' + esc(t('loading')) + '</div></div>');
  const secs = (await api('/library/sections')).Directory || [];
  const movieSec = secs.find((s) => s.type === 'movie');
  const showSec = secs.find((s) => s.type === 'show');
  const recent = (sec) => sec ? api('/library/sections/' + sec.key + '/recentlyAdded', { 'X-Plex-Container-Start': 0, 'X-Plex-Container-Size': 12 }).catch(() => ({})) : Promise.resolve({});
  const total = (sec) => sec ? api('/library/sections/' + sec.key + '/all', { 'X-Plex-Container-Start': 0, 'X-Plex-Container-Size': 0 }).then((r) => r.totalSize || r.size || 0).catch(() => 0) : Promise.resolve(0);
  const hubs = (sec) => sec ? api('/hubs/sections/' + sec.key, { count: 10 }).then((r) => r.Hub || []).catch(() => []) : Promise.resolve([]);
  const deckReq = api('/library/onDeck').catch(() => api('/hubs/continueWatching/items').catch(() => ({})));
  const [deck, raM, raS, nM, nS, hM, hS] = await Promise.all([deckReq, recent(movieSec), recent(showSec), total(movieSec), total(showSec), hubs(movieSec), hubs(showSec)]);
  if (seq !== viewSeq) return;
  const deckItems = deckFilter(deck.Metadata || []);
  const skip = /recentlyadded|ondeck|continuewatching|inprogress/i;
  const hubRows = [];
  const pick = (list) => list.filter((h) => !skip.test(h.hubIdentifier || h.key || '') && (h.Metadata || []).length >= 4);
  const a = pick(hM), b = pick(hS);
  for (let i = 0; i < Math.max(a.length, b.length) && hubRows.length < 8; i++) {
    if (a[i]) hubRows.push(a[i]);
    if (b[i] && hubRows.length < 8) hubRows.push(b[i]);
  }
  const data = {
    secs: secs, movieSec: movieSec, showSec: showSec, nM: nM, nS: nS,
    deckM: deckItems.filter((i) => i.type === 'movie').slice(0, 5),
    deckS: deckItems.filter((i) => i.type === 'episode').slice(0, 5),
    raM: (raM.Metadata || []).slice(0, 5),
    raS: (raS.Metadata || []).slice(0, 5),
    artM: (raM.Metadata || []).map((i) => i.art).find(Boolean),
    artS: (raS.Metadata || []).map((i) => i.grandparentArt || i.art || i.parentArt).find(Boolean),
    hubs: hubRows,
    deckAll: deckItems, raMAll: raM.Metadata || [], raSAll: raS.Metadata || [], spot: null, seq: seq,
    trending: null, trendingState: S.tmdb ? 'loading' : 'nokey'
  };
  /* coming back to Home: remember what was selected, so it can be selected again once the lower rows exist */
  data.wantFocus = current.focusKey || null;
  drawHome(data);
  data.autoKey = focused && focused.dataset.key;
  if (showSec) {
    const off = onRadar(() => { if (seq === viewSeq) { updateSoon(); updateWeek(); } });
    cleanup = () => { off(); clearInterval(spot.timer); };
    loadRadar(secs);
  } else cleanup = () => clearInterval(spot.timer);
  if (S.tmdb) {
    try {
      const [items, idx] = await Promise.all([loadTrending(), loadLibIndex(secs)]);
      if (seq !== viewSeq) return;
      data.trending = items.map((x) => ({ x: x, own: idx.get(x.media_type + ':' + x.id) || null }));
      data.trendingState = 'ok';
    } catch (e) {
      data.trendingState = 'failed';
    }
    if (seq !== viewSeq) return;
    current.focusKey = focused && focused.dataset.key;
    const sc = $('.scroll', viewEl);
    const top = sc ? sc.scrollTop : 0;
    drawHome(data);
    const sc2 = $('.scroll', viewEl);
    if (sc2) sc2.scrollTop = top;
  }
}
function drawHome(d) {
  const mode = S.homeMode;
  const head = (sec, art, label, n) => sec
    ? '<button type="button" class="head-tile f" data-key="head-' + sec.key + '" data-act="' + A(() => go(viewLibrary, [sec])) + '">' +
      (art ? '<img src="' + esc(imgURL(art, 1100, 620)) + '" alt="">' : '') +
      '<div class="fade"></div><div class="in"><b>' + esc(label) + '</b><span>' + esc(n ? t('browseN', { n: n }) : t('browse')) + ICON.next + '</span></div></button>'
    : '<div class="head-tile"><div class="fade"></div><div class="in"><b>' + esc(label) + '</b><span>' + esc(t('noLibrary')) + '</span></div></div>';
  const col = (items, rowKey, kind) => {
    if (!items.length) return '<div class="rowcol"><div class="empty">' + esc(t('nothing')) + '</div></div>';
    const list = mode === 'fanart' ? items.slice(0, 4) : items;
    const cells = list.map((it, i) => {
      const act = A(() => openItem(it));
      const key = rowKey + '-' + i;
      if (mode === 'fanart') return fanCardHTML(it, key, act, kind);
      return mode === 'covers' ? cardHTML(it, key, act, { bar: kind === 'deck', mode: kind }) : lineHTML(it, key, act, { mode: kind });
    }).join('');
    return '<div class="rowcol' + (mode === 'covers' ? ' covers' : mode === 'fanart' ? ' fan' : '') + '">' + cells + '</div>';
  };
  let extra = '';
  if (d.trendingState === 'nokey') {
    extra += '<section class="hub"><h2>' + esc(t('trending')) + '</h2><button type="button" class="btn f" data-key="tr-hint" data-act="' + A(() => go(viewSettings)) + '">' + ICON.gear + esc(t('trendingHint')) + '</button></section>';
  } else if (d.trendingState === 'failed') {
    extra += '<section class="hub"><h2>' + esc(t('trending')) + '</h2><div class="empty">' + esc(t('trendingFailed')) + '</div></section>';
  } else if (d.trendingState === 'ok' && d.trending && d.trending.length) {
    extra += '<section class="hub"><div class="hubhead"><h2>' + esc(t('trending')) + '</h2><span>' + esc(t('trendingSub')) + '</span></div><div class="grid10">' + d.trending.slice(0, 8).map((tr, i) => {
      const x = tr.x;
      const title = x.title || x.name || '';
      const year = (x.release_date || x.first_air_date || '').slice(0, 4);
      const act = A(() => (tr.own ? openItem(tr.own) : showTrending(x)));
      return cardHTML(tr.own || {}, 'tr-' + i, act, { poster: tr.own && tr.own.thumb ? imgURL(tr.own.thumb, 300, 450) : x.poster_path ? 'https://image.tmdb.org/t/p/w342' + x.poster_path : '', title: title, sub: [year, x.media_type === 'tv' ? t('shows') : t('movies')].filter(Boolean).join(' · '), badge: tr.own ? t('inLibrary') : '' });
    }).join('') + '</div></section>';
  } else if (d.trendingState === 'loading') {
    extra += '<section class="hub"><h2>' + esc(t('trending')) + '</h2><div class="empty">' + esc(t('loading')) + '</div></section>';
  }
  extra += d.hubs.map((h, hi) => '<section class="hub"><h2>' + esc(h.title) + '</h2><div class="grid10">' +
    (h.Metadata || []).slice(0, 8).map((it, i) => cardHTML(it, 'h' + hi + '-' + i, A(() => openItem(it)))).join('') + '</div></section>').join('');

  const topHTML = homeTop(d);
  if (mode === 'spotlight') { drawSpotlight(d, topHTML, extra); startSpot(d, d.seq); fillHero(d); return; }
  render('<div class="screen">' + topHTML +
    '<div class="scroll hide-scroll"><div class="homegrid">' + soonHTML() +
    head(d.movieSec, d.artM, t('allMovies'), d.nM) + head(d.showSec, d.artS, t('allShows'), d.nS) +
    '<div class="rowlabel"><b>' + esc(t('continue')) + '</b><span>' + esc(t('continueSub')) + '</span></div>' +
    col(d.deckM, 'cm', 'deck') + col(d.deckS, 'cs', 'deck') +
    '<div class="rowlabel"><b>' + esc(t('recent')) + '</b><span>' + esc(t('recentSub')) + '</span></div>' +
    col(d.raM, 'rm', 'recent') + col(d.raS, 'rs', 'recent') +
    '</div>' + extra + '</div></div>');
  initFocus(current.focusKey || 'cs-0');
}
/* Home top bar: logo, the main places, settings, who is watching, clock. Layout, theme and language live in Settings. */
function homeTop(d) {
  const name = (S.user && S.user.title) || (S.account && S.account.title) || t('switchUser');
  const nav = (key, label, act, on) => '<button type="button" class="navbtn f' + (on ? ' on' : '') + '" data-key="' + key + '" data-act="' + A(act) + '">' + label + '</button>';
  return '<div class="top hometop"><div class="wordmark hlogo">' + LOGO + '</div>' +
    '<nav class="mainnav">' +
    nav('nav-home', esc(t('home')), () => {}, true) +
    (d.movieSec ? nav('nav-movies', esc(t('movies')), () => go(viewLibrary, [d.movieSec])) : '') +
    (d.showSec ? nav('nav-shows', esc(t('shows')), () => go(viewLibrary, [d.showSec])) : '') +
    (d.showSec ? nav('nav-cal', esc(t('calendarNav')), () => go(viewCalendar)) : '') +
    ((d.movieSec || d.showSec) ? '<button type="button" class="navbtn icon f" data-key="nav-search" aria-label="' + esc(t('search')) + '" data-act="' + A(() => go(viewLibrary, [d.movieSec || d.showSec, null, { search: true }])) + '">' + ICON.search + '</button>' : '') +
    '</nav>' +
    '<div class="hright">' +
    '<button type="button" class="wtbadge" hidden data-act="' + A(() => wtPanel()) + '"></button>' +
    '<button type="button" class="navbtn icon f" data-key="nav-settings" aria-label="' + esc(t('settings')) + '" data-act="' + A(() => go(viewSettings)) + '">' + ICON.sliders + '</button>' +
    '<button type="button" class="userbtn f" data-key="nav-user" data-act="' + A(() => go(viewUsers)) + '"><span class="av">' + esc(String(name).charAt(0).toUpperCase()) + '</span>' + esc(name) + '</button>' +
    clockHTML(false, 'margin-left: 16px') + '</div></div>';
}
function setHomeMode(mode, d) {
  S.homeMode = mode; store.set('homeMode', mode);
  current.focusKey = 'mode-' + mode;
  drawHome(d);
}
function showTrending(x) {
  const title = x.title || x.name || '';
  const year = (x.release_date || x.first_air_date || '').slice(0, 4);
  openModal(sheetHeader(title, year) +
    (x.backdrop_path ? '<img class="sheetimg" src="https://image.tmdb.org/t/p/w780' + esc(x.backdrop_path) + '" alt="">' : '') +
    '<p class="sheettext">' + esc(x.overview || '') + '</p>' +
    '<div class="tags"><span class="tag">' + esc(t('notInLibrary').toUpperCase()) + '</span></div>' +
    '<button type="button" class="btn f" data-default data-act="' + A(() => closeModal()) + '">' + esc(t('back')) + '</button>');
}

/* ---------- home: Spotlight mode ---------- */
/* A big rotating banner, this week's episodes, Continue watching, the libraries, then rows that use the clock
   and your watch state: movies that end before midnight, seasons that are nearly done, a random pick,
   suggestions based on the last movie you watched, and library numbers. */
const spot = { at: 0, movies: null, idx: 0, pickFilters: { short: true, rated: false }, pick: null, timer: null };
async function loadMovieList(sec) {
  const mk = sec.key + '|' + (S.user ? S.user.id : 'owner');
  if (spot.movies && spot.movies.key === mk && Date.now() - spot.at < 10 * 60000) return spot.movies.items;
  const r = await api('/library/sections/' + sec.key + '/all', { type: 1, 'X-Plex-Container-Start': 0, 'X-Plex-Container-Size': 20000 });
  spot.movies = { key: mk, items: r.Metadata || [] };
  spot.at = Date.now();
  return spot.movies.items;
}
/* The time the row aims for: midnight, or two hours from the next full hour when it is already late. */
function fitsTarget() {
  /* evenings: midnight while there is room for a film; otherwise (late night, daytime) the full hour
     about three hours from now */
  const now = new Date();
  const mid = new Date(now); mid.setHours(24, 0, 0, 0);
  /* midnight once it's four hours away or less (from 20:00), as long as a film still fits; earlier, about three hours ahead */
  if (mid - now <= 4 * 3600000 && mid - now >= 100 * 60000) return mid;
  const t = new Date(now); t.setMinutes(0, 0, 0); t.setHours(t.getHours() + 3);
  return t;
}
function endsAtText(ms) { return t('ends', { t: hhmm(new Date(Date.now() + ms)) }); }
function randomOf(list) { return list.length ? list[Math.floor(Math.random() * list.length)] : null; }
function rateOf(m) { return Number(m.audienceRating || m.rating || 0); }

async function loadSpotExtras(d) {
  const out = { fits: [], pickPool: [], finish: [], because: null, stats: null, heroes: [] };
  const deckEps = d.deckAll.filter((i) => i.type === 'episode');
  const tasks = [];
  if (d.movieSec) {
    tasks.push(loadMovieList(d.movieSec).then((movies) => {
      const unwatched = movies.filter((m) => !m.viewCount && m.duration);
      const left = fitsTarget() - Date.now();
      out.fitsTarget = fitsTarget();
      /* what this profile likes (its own watch history plus More/Less like this) decides the order */
      const h = out.taste = tasteHistory(movies);
      out.moviesAll = movies;
      out.fitsPool = unwatched.filter((m) => m.duration <= left);
      out.fits = tasteSort(out.fitsPool, h).slice(0, 8);
      out.pickPool = unwatched.filter((m) => tasteOK(m, h));
      /* favourite actors from the full cast of what this profile has watched (Plex's own watch history), then a row
         with the first favourite who has films here you haven't seen (asked of the server, so the whole cast counts) */
      const k4 = movies.filter((m) => m.Media && m.Media.some((x) => String(x.videoResolution).toLowerCase() === '4k')).length;
      const month = Date.now() / 1000 - 30 * 86400;
      out.stats = {
        movies: movies.length,
        unwatchedH: Math.round(unwatched.reduce((s, m) => s + (m.duration || 0), 0) / 3600000),
        added: movies.filter((m) => (m.addedAt || 0) >= month).length,
        k4: movies.length ? Math.round(k4 / movies.length * 100) : 0
      };
      out.lastWatched = movies.filter((m) => m.lastViewedAt).sort((a, b) => b.lastViewedAt - a.lastViewedAt)[0] || null;
    }).catch(() => {}));
  }
  /* the profile's Plex Watchlist */
  tasks.push(wlLoad().then((l) => { out.watchlist = l; }).catch(() => { out.watchlist = []; }));
  if (d.showSec) {
    tasks.push(api('/library/sections/' + d.showSec.key + '/all', { type: 4, 'X-Plex-Container-Start': 0, 'X-Plex-Container-Size': 0 })
      .then((r) => { out.episodes = r.totalSize || r.size || 0; }).catch(() => {}));
    tasks.push(api('/library/sections/' + d.showSec.key + '/all', { type: 2, 'X-Plex-Container-Start': 0, 'X-Plex-Container-Size': 5000 })
      .then((r) => { out.showsAll = r.Metadata || []; }).catch(() => {}));
  }
  /* seasons in progress with three or fewer episodes left */
  const seasonKeys = Array.from(new Set(deckEps.map((e) => e.parentRatingKey).filter(Boolean))).slice(0, 12);
  tasks.push(Promise.all(seasonKeys.map((k) => api('/library/metadata/' + k).then((r) => (r.Metadata || [])[0]).catch(() => null))).then((seasons) => {
    out.finish = seasons.filter((s) => s && s.leafCount && s.viewedLeafCount > 0 && s.leafCount - s.viewedLeafCount <= 3 && s.leafCount > s.viewedLeafCount)
      .map((s) => ({ season: s, ep: deckEps.find((e) => e.parentRatingKey === s.ratingKey) })).slice(0, 4);
  }));
  await Promise.all(tasks);
  /* favourite actors from the full cast of what this profile has watched, movies and shows (Plex's own watch history),
     then a row with the first favourite who has films here you haven't seen (asked of the server, so the whole cast counts) */
  if (out.taste && d.movieSec) {
    const h = out.taste;
    try {
      const favs = await tasteFavActors(out.moviesAll || [], h, out.showsAll || []);
      /* a different one of your top ten each time Home opens */
      const pool = abPool(favs);
      out.actorPool = pool;
      for (const f of pool) {
        let list = [];
        list = await abActorFilms(d.movieSec, f, out.moviesAll);
        list = tasteSort(list, h);
        if (list.length >= 2) { out.actor = { name: f.name, n: f.n, who: f, items: list.slice(0, 60) }; out.actorPos = pool.indexOf(f); break; }
      }
      out.fits = tasteSort(out.fits, h);
    } catch (e) { /* no actor row */ }
  }
  if (vsMode !== 'all') { try { await vsPrep(vsMode); } catch (e) { /* library dates instead */ } }
  try { out.viewStats = tasteStats(out.moviesAll || [], out.showsAll || [], out.taste, vsMode); } catch (e) { out.viewStats = null; }
  /* full casts of everything watched are read in the background; the statistics are redrawn when that's done */
  if (out.taste) tasteCastScan(out.moviesAll || [], out.showsAll || [], (n, m) => { const el = $('#vsprog'); if (el) el.textContent = t('vsReading', { n: n, m: m }); }, async () => {
    try {
      await tasteFavActors(out.moviesAll || [], out.taste, out.showsAll || []);
      out.viewStats = tasteStats(out.moviesAll || [], out.showsAll || [], out.taste, vsMode);
      const box = $('.vtiles', viewEl);
      if (!box || d.seq !== viewSeq) return;
      const k = focused && box.contains(focused) ? focused.dataset.key : null;
      box.closest('section').outerHTML = tasteStatsHTML(out.viewStats, d.movieSec, d.showSec);
      if (k) { const el = $('[data-key="' + k + '"]', viewEl); if (el) setFocus(el, true); }
    } catch (e) { /* keep what's shown */ }
  });
  if (S.tmdb && out.lastWatched) {
    try {
      const id = tmdbIdOf(out.lastWatched) || 0;
      let lw = out.lastWatched;
      if (!id) {
        const full = ((await api('/library/metadata/' + lw.ratingKey, { includeGuids: 1 })).Metadata || [])[0];
        if (full) lw = full;
      }
      const tid = tmdbIdOf(lw);
      if (tid) {
        /* only films you have: recommendations (two pages) and similar films, matched against your library */
        const none = { results: [] };
        const [r1, r2, sim, idx] = await Promise.all([
          tmdbGet('/movie/' + tid + '/recommendations', { language: tmdbLang() }).catch(() => none),
          tmdbGet('/movie/' + tid + '/recommendations', { language: tmdbLang(), page: 2 }).catch(() => none),
          tmdbGet('/movie/' + tid + '/similar', { language: tmdbLang() }).catch(() => none),
          loadLibIndex(d.secs)]);
        const seen = new Set([tid]);
        const items = (r1.results || []).concat(r2.results || [], sim.results || [])
          .filter((x) => !seen.has(x.id) && seen.add(x.id))
          .map((x) => ({ x: x, own: idx.get('movie:' + x.id) || null }))
          .filter((b) => b.own);
        /* films you haven't seen yet first */
        items.sort((a, b) => (a.own.viewCount ? 1 : 0) - (b.own.viewCount ? 1 : 0));
        const no = tasteGet().no;
        for (let i = items.length - 1; i >= 0; i--) if (no[items[i].own.ratingKey]) items.splice(i, 1);
        if (items.length >= 3) out.because = { title: out.lastWatched.title, items: items.slice(0, 8) };
      }
    } catch (e) { /* leave the row out */ }
  }
  /* banner: a new episode of a show you watch, what you were watching, a new movie, a random unwatched pick, up next */
  const watchingShows = new Set(deckEps.map((e) => e.grandparentRatingKey));
  const newEp = d.raSAll.find((e) => e.type === 'episode' && !e.viewCount && watchingShows.has(e.grandparentRatingKey));
  const heroes = [];
  const add = (it, kind, label) => { if (it && !heroes.some((h) => h.it.ratingKey === it.ratingKey)) heroes.push({ it: it, kind: kind, label: label || '' }); };
  add(newEp, 'newEpisode');
  add(d.deckAll.find((i) => i.viewOffset), 'continue');
  add((d.raMAll || []).find((m) => !m.viewCount && tasteOK(m, out.taste)), 'recentlyAddedOne');
  add(tastePick(out.fits.length ? out.fits : out.pickPool.filter((m) => rateOf(m) >= 7), out.taste), 'fromLibrary');
  add(d.deckAll.find((i) => !i.viewOffset), 'upNext');
  /* a few more: something else you were in the middle of, your Watchlist, a favourite actor, because you watched,
     your favourite genre, and a new episode or show */
  add(d.deckAll.filter((i) => i.viewOffset)[1], 'continue');
  try {
    const own = new Map();
    (out.moviesAll || []).concat(out.showsAll || []).forEach((m) => { const id = typeof wlId === 'function' ? wlId(m) : ''; if (id) own.set(id, m); });
    const wl = (out.watchlist || []).map((w) => own.get(wlId(w))).filter((m) => m && !m.viewCount && !(m.viewedLeafCount >= m.leafCount && m.leafCount));
    add(wl[0], 'heroWatchlist');
  } catch (e) { /* no watchlist */ }
  if (out.actor && out.actor.items[0]) add(out.actor.items[0], 'heroActor', t('heroWithActor', { s: out.actor.name }));
  if (out.because) { const b = out.because.items.find((y) => y.own && !y.own.viewCount); if (b) add(b.own, 'becauseWatched', t('becauseWatched', { t: out.because.title })); }
  try {
    const g = out.viewStats && out.viewStats.genres[0];
    if (g) add(tastePick(out.pickPool.filter((m) => (m.Genre || []).some((y) => y.tag === g.name) && rateOf(m) >= 7), out.taste), 'heroGenre', t('heroGenre', { s: g.name }));
  } catch (e) { /* none */ }
  add((d.raSAll || []).find((e) => !e.viewCount && !watchingShows.has(e.grandparentRatingKey)), 'heroNewShow');
  out.heroes = heroes.slice(0, 10);
  return out;
}

function spotHeroHTML(d) {
  const x = d.spot;
  const heroes = x ? x.heroes : [];
  if (!heroes.length) return '<section class="spothero"><div class="spotin"><span class="eyebrow">' + esc(t('spotlight')) + '</span><h2>' + esc(x ? t('nothing') : t('loading')) + '</h2></div></section>';
  const h = heroes[spot.idx % heroes.length];
  const it = h.full || h.it;
  const ep = it.type === 'episode';
  const art = ep ? (it.grandparentArt || it.art || it.thumb) : (it.art || it.thumb);
  const rest = it.duration ? it.duration - (it.viewOffset || 0) : 0;
  const meta = [ep ? epCode(it) + (it.title ? ' · ' + it.title : '') : it.year, ep ? '' : (it.Genre || []).slice(0, 1).map((g) => g.tag)[0],
    it.viewOffset ? leftText(it) : durText(it.duration), rest ? endsAtText(rest) : ''].filter(Boolean);
  const tags = mediaTags(it);
  const play = A(() => go(viewPlayer, [it.ratingKey]));
  const part = it.Media && it.Media[0] && it.Media[0].Part && it.Media[0].Part[0];
  const subs = part ? (part.Stream || []).filter((s) => s.streamType === 3) : null;
  return '<section class="spothero" id="spothero">' +
    (art ? '<img src="' + esc(imgURL(art, 1600, 900)) + '" alt="">' : '') + '<div class="fade"></div>' +
    '<div class="spotin"><span class="eyebrow">' + esc(h.label || t(h.kind)) + '</span>' +
    '<h2 data-logo="' + esc(ep ? it.grandparentRatingKey : it.ratingKey) + '">' + esc(ep ? it.grandparentTitle : it.title) + '</h2>' +
    (ep ? '<div class="smeta"><span>' + esc(meta.shift()) + '</span></div>' : '') +
    '<div class="smeta">' + meta.map((m) => '<span>' + esc(m) + '</span>').join('<span aria-hidden="true">·</span>') + '</div>' +
    (tags.length ? '<div class="tags">' + tagsHTML(tags) + '</div>' : '') +
    (it.summary ? '<p>' + esc(it.summary) + '</p>' : '') +
    '<div class="actions">' +
    '<button type="button" class="btn primary f" data-default data-key="sp-play" data-act="' + play + '" data-ctx="' + A(() => itemMenu(it)) + '">' + ICON.play + esc(it.viewOffset ? t('resume') : t('play')) + (ep ? ' ' + esc(epCode(it)) : '') + '</button>' +
    '<button type="button" class="btn ghostbtn f" data-key="sp-info" data-act="' + A(() => go(viewDetails, [it.ratingKey])) + '">' + esc(t('details')) + '</button>' +
    (['fromLibrary', 'recentlyAddedOne', 'heroActor', 'becauseWatched', 'heroGenre'].indexOf(h.kind) >= 0 && typeof tasteMark === 'function' ? (() => {
      /* 👍 more like this (press again to take it back), 👎 not for me (also takes it out of the spotlight) */
      const liked = !!tasteGet().yes[String(it.ratingKey)];
      return '<button type="button" class="btn ghostbtn icon f' + (liked ? ' on' : '') + '" data-key="sp-yes" aria-label="' + esc(t('tasteMore')) + '" data-act="' + A(() => { current.focusKey = 'sp-yes'; tasteMark(it, 1); }) + '">' + ICON.thumbUp + '</button>' +
        '<button type="button" class="btn ghostbtn icon f" data-key="sp-no" aria-label="' + esc(t('tasteNotForMe')) + '" data-act="' + A(() => { x.heroes.splice(spot.idx % heroes.length, 1); tasteMark(it, -1); }) + '">' + ICON.thumbDown + '</button>';
    })() : '') +
    (heroes.length > 1 ? '<button type="button" class="btn ghostbtn icon f" data-key="sp-next" aria-label="' + esc(t('nextSpot')) + '" data-act="' + A(() => { spot.idx++; current.focusKey = 'sp-next'; drawHome(d); }) + '">' + ICON.next + '</button>' : '') +
    '</div></div>' +
    (heroes.length > 1 ? '<div class="pager">' + heroes.map((_, i) => '<i class="' + (i === spot.idx % heroes.length ? 'on' : '') + '"></i>').join('') + '<span>' + ((spot.idx % heroes.length) + 1) + ' / ' + heroes.length + '</span></div>' : '') +
    '</section>';
}
function weekHTML() {
  const from = new Date(); from.setHours(0, 0, 0, 0);
  const to = from.getTime() + 7 * 86400000;
  const list = [];
  radar.shows.filter(calVisible).forEach((s) => s.eps.forEach((e) => { const tt = Date.parse(e.airstamp); if (tt >= from.getTime() && tt < to) list.push({ s: s, e: e, t: tt }); }));
  list.sort((a, b) => a.t - b.t);
  const rows = list.slice(0, 6).map((x, i) => {
    const d = new Date(x.t);
    const today = dayKey(d) === dayKey(new Date());
    const day = today ? t('today') : d.toLocaleDateString(lang().locale, { weekday: 'short' });
    const tag = x.e.owned ? '<span class="tag strong">' + esc(t('inLibrary').toUpperCase()) + '</span>'
      : x.e.number === 1 ? '<span class="tag">' + esc(t('premiere')) + '</span>'
      : '<span class="tag">' + esc(x.e.airstamp.length > 10 ? hhmm(d) : t('upcoming').toUpperCase()) + '</span>';
    return '<div class="wkrow f" data-key="wk-' + i + '" data-act="' + A(() => (x.s.plex.manual ? manualEpInfo(x.s, x.e) : go(viewDetails, [x.e.ownedKey || x.s.plex.ratingKey]))) + '">' +
      '<span class="wd' + (today ? ' today' : '') + '">' + esc(day) + '</span>' +
      '<span class="ws"><b>' + esc(x.s.plex.title) + '</b><small>' + esc('S' + x.e.season + ' E' + x.e.number + (x.e.name ? ' · ' + x.e.name : '')) + '</small></span>' + tag + '</div>';
  }).join('');
  const note = radar.state === 'loading' ? t('radarProgress', { n: radar.done, m: radar.total }) : '';
  return '<section class="week" id="week"><div class="wkhead"><h2>' + esc(t('thisWeek')) + '</h2><span>' + esc(t('onYourShows')) + '</span></div>' +
    '<div class="wklist">' + (rows || '<div class="empty">' + esc(note || t('weekEmpty')) + '</div>') + '</div>' +
    (rows && note ? '<span class="wknote">' + esc(note) + '</span>' : '') +
    '<button type="button" class="btn small f" data-key="wk-cal" data-act="' + A(() => go(viewCalendar)) + '">' + esc(t('releaseCalendar')) + ICON.next + '</button></section>';
}
function updateWeek() {
  const el = $('#week');
  if (!el) return;
  const k = focused && el.contains(focused) ? focused.dataset.key : null;
  el.outerHTML = weekHTML();
  if (k) initFocus(k, $('#week'));
}
function drawSpotlight(d, topHTML, extra) {
  const x = d.spot;
  const contItems = d.deckAll.slice(0, 4).map((it, i) => {
    const ep = it.type === 'episode';
    const src = imgURL(ep ? (it.thumb || it.grandparentArt) : (it.art || it.thumb), 640, 360);
    const pct = progress(it);
    const rest = (it.duration || 0) - (it.viewOffset || 0);
    return '<div class="card wide spc f" data-key="spc-' + i + '" data-act="' + A(() => openItem(it)) + '" data-ctx="' + A(() => itemMenu(it)) + '">' +
      '<div class="imgwrap">' + (src ? '<img class="img" loading="lazy" src="' + esc(src) + '" alt="">' : '<div class="img"></div>') + (pct ? '<div class="bar"><i style="width: ' + pct + '%"></i></div>' : '') + '</div>' +
      '<div class="wrow"><span class="t">' + esc(itemTitle(it)) + '</span><span class="fs">' + esc(rest > 0 ? hhmm(new Date(Date.now() + rest)) : '') + '</span></div>' +
      '<span class="s">' + esc([ep ? epCode(it) : t('movieOne'), it.viewOffset ? leftText(it) : t('upNext')].join(' · ')) + '</span></div>';
  }).join('');
  const head = (sec, art, label, n) => sec ? '<button type="button" class="head-tile f" data-key="head-' + sec.key + '" data-act="' + A(() => go(viewLibrary, [sec])) + '" data-ctx="' + A(() => libraryMenu(sec, label)) + '">' +
    (art ? '<img src="' + esc(imgURL(art, 1100, 620)) + '" alt="">' : '') + '<div class="fade"></div><div class="in"><b>' + esc(label) + '</b><span>' + esc(n ? t('browseN', { n: n }) : t('browse')) + ICON.next + '</span></div></button>' : '';
  let rows = '';
  /* near the top, right under Continue watching */
  const topRows = (x && store.get(userKey('wlHome'), true) !== false ? watchlistHTML(x) : '') + (x && x.actor ? actorBannerHTML(x, d) : '');
  if (x && x.fits.length) rows += fitsTimelineHTML(x);
  const pickBlock = () => {
    if (!x || !x.pickPool.length) return '';
    const f = spot.pickFilters;
    const pool = x.pickPool.filter((m) => (!f.short || m.duration <= 2 * 3600000) && (!f.rated || rateOf(m) >= 7));
    if (!spot.pick || !pool.includes(spot.pick)) spot.pick = tastePick(pool, x.taste);
    const m = spot.pick;
    const chip = (key, on, label, fn, icon) => '<button type="button" class="chip f' + (on ? ' on' : '') + '" data-key="' + key + '" data-act="' + A(fn) + '">' + (on ? ICON.check : '') + (icon || '') + esc(label) + '</button>';
    /* redraw in place: keep the page where it is so the new pick stays in view */
    const redraw = (k) => {
      const keep = $$('.scroll, .homescroll', viewEl).map((x) => x.scrollTop);
      current.focusKey = k; drawHome(d);
      const now = $$('.scroll, .homescroll', viewEl);
      keep.forEach((v, i) => { if (now[i]) now[i].scrollTop = v; });
      const el = $('[data-key="' + k + '"]', viewEl);
      if (el) setFocus(el, true);
      requestAnimationFrame(() => { const n2 = $$('.scroll, .homescroll', viewEl); keep.forEach((v, i) => { if (n2[i]) n2[i].scrollTop = v; }); });
    };
    return '<section class="pick" data-nav-l="fin-0">' + (m && m.art ? '<img src="' + esc(imgURL(m.art, 1100, 620)) + '" alt="">' : '') + '<div class="fade"></div><div class="pin">' +
      '<span class="eyebrow">' + esc(t('pickForMe')) + '</span>' +
      (m ? '<h3>' + esc(m.title) + '</h3><span class="pmeta">' + esc([m.year, (m.Genre || []).slice(0, 1).map((g) => g.tag)[0], durText(m.duration), endsAtText(m.duration)].filter(Boolean).join(' · ')) + '</span>' : '<h3>' + esc(t('noMatches')) + '</h3>') +
      '<div class="chips">' + chip('pk-short', f.short, t('under2h'), () => { f.short = !f.short; spot.pick = null; redraw('pk-short'); }) +
      chip('pk-rated', f.rated, t('rated7'), () => { f.rated = !f.rated; spot.pick = null; redraw('pk-rated'); }, '<span class="chipstar">' + ICON.star + '</span>') + '</div>' +
      '<div class="actions">' + (m ? '<button type="button" class="btn primary f" data-key="pk-play" data-act="' + A(() => go(viewPlayer, [m.ratingKey])) + '" data-ctx="' + A(() => itemMenu(m)) + '">' + ICON.play + esc(t('play')) + '</button>' +
        '<button type="button" class="btn f" data-key="pk-wt" data-act="' + A(() => wtStart(m)) + '">' + ICON.people + esc(t('wtShort')) + '</button>' +
        '<button type="button" class="btn f" data-key="pk-info" data-act="' + A(() => openItem(m)) + '">' + esc(t('moreInfo')) + '</button>' : '') +
      '<button type="button" class="btn f" data-key="pk-again" data-act="' + A(() => { spot.pick = tastePick(pool, x.taste, m) || m; redraw('pk-again'); }) + '">' + esc(t('anotherOne')) + '</button>' +
      (m ? '<button type="button" class="btn icon f" data-key="pk-no" aria-label="' + esc(t('tasteNotForMe')) + '" data-act="' + A(async () => { const was = m; spot.pick = tastePick(pool, x.taste, was) || null; x.pickPool = x.pickPool.filter((p) => p !== was); await tasteMark(was, -1); }) + '">' + ICON.thumbDown + '</button>' : '') + '</div></div></section>';
  };
  const finishBlock = () => {
    if (!x || !x.finish.length) return '';
    return '<section class="finish" data-nav-r="pk-play"><div class="hubhead"><h2>' + esc(t('finishSeason')) + '</h2><span>' + esc(t('finishSub')) + '</span></div>' +
      x.finish.map((f, i) => {
        const s = f.season, left = s.leafCount - s.viewedLeafCount;
        const segs = Array.from({ length: Math.min(s.leafCount, 24) }, (_, j) => '<i class="' + (j < s.viewedLeafCount ? 'on' : '') + '"></i>').join('');
        const epDur = f.ep && f.ep.duration ? f.ep.duration : 0;
        return '<div class="finrow f" data-key="fin-' + i + '" data-act="' + A(() => (f.ep ? go(viewDetails, [f.ep.ratingKey]) : go(viewDetails, [s.parentRatingKey]))) + '">' +
          '<img class="th" loading="lazy" src="' + esc(imgURL((f.ep && (f.ep.thumb || f.ep.grandparentArt)) || s.art || s.thumb, 240, 135)) + '" alt="">' +
          '<span class="fm"><span><b>' + esc(s.parentTitle || '') + '</b><small>' + esc(s.title || '') + '</small></span><span class="segs">' + segs + '</span></span>' +
          '<span class="fl">' + esc(t('nLeft', { n: left }) + (epDur ? ' · ' + durText(left * epDur) : '')) + '</span></div>';
      }).join('') + '</section>';
  };
  const fin = finishBlock(), pk = pickBlock();
  if (fin || pk) rows += '<div class="spot2' + (fin && pk ? '' : ' one') + '">' + fin + pk + '</div>';
  if (x && x.because && x.because.items.length) {
    rows += '<section class="hub"><div class="hubhead"><h2>' + esc(t('becauseWatched', { t: x.because.title })) + '</h2><span>' + esc(t('fromLibrary')) + '</span></div><div class="grid8">' +
      x.because.items.map((b, i) => {
        const y = (b.x.release_date || '').slice(0, 4);
        return '<div class="card f' + (b.own ? '' : ' notown') + '" data-key="bw-' + i + '" data-act="' + A(() => (b.own ? openItem(b.own) : showTrending(Object.assign({ media_type: 'movie' }, b.x)))) + '"' + (b.own ? ' data-ctx="' + A(() => itemMenu(b.own)) + '"' : '') + '><div class="imgwrap">' +
          /* films you have show your own poster from Plex; TMDB's only for the ones you don't */
          (b.own && b.own.thumb ? '<img class="img" loading="lazy" src="' + esc(imgURL(b.own.thumb, 300, 450)) + '" alt="">'
            : b.x.poster_path ? '<img class="img" loading="lazy" src="https://image.tmdb.org/t/p/w342' + esc(b.x.poster_path) + '" alt="">' : '<div class="img"></div>') +
          (b.own ? '<span class="ownmark">' + ICON.play + '</span>' : '') + '</div>' +
          '<span class="t">' + esc((b.own && b.own.title) || b.x.title || '') + '</span><span class="s">' + esc([(b.own && b.own.year) || y, b.own ? '' : t('notInLibrary')].filter(Boolean).join(' · ')) + '</span></div>';
      }).join('') + '</div></section>';
  }
  if (x && x.viewStats) rows += moodTilesHTML(x);
  if (x && x.stats) {
    const st = x.stats;
    const songRowHTML = typeof songsHomeHTML === 'function' ? songsHomeHTML() : '';
    const nf = (n) => Number(n).toLocaleString(lang().locale);
    const cells = [[nf(st.movies), t('statMovies')], [nf(d.nS), t('statShows', { n: nf(x.episodes || 0) })], [nf(st.unwatchedH) + ' h', t('statUnwatched')], [nf(st.added), t('statAdded')], [st.k4 + ' %', t('stat4k')]];
    rows += '<section class="hub"><h2>' + esc(t('yourLibrary')) + '</h2><div class="stats">' + cells.map((c) => '<div><b>' + esc(c[0]) + '</b><span>' + esc(c[1]) + '</span></div>').join('') + '</div></section>';
    if (x.viewStats) rows += tasteStatsHTML(x.viewStats, d.movieSec, d.showSec);
    rows += songRowHTML;
  } else if (!x) {
    rows += '<section class="hub"><div class="empty">' + esc(t('loading')) + '</div></section>';
  }
  render('<div class="screen">' + topHTML +
    '<div class="scroll hide-scroll homescroll"><div class="spottop">' + spotHeroHTML(d) + '</div>' +
    (contItems ? '<section class="hub"><div class="hubhead"><h2>' + esc(t('continue')) + '</h2></div><div class="grid4">' + contItems + '</div></section>' : '') +
    topRows +
    '<div id="nowplaying"></div>' +
    '<div class="hub">' + weekHTML() + '</div>' +
    '<div class="spotlibs">' + head(d.movieSec, d.artM, t('allMovies'), d.nM) + head(d.showSec, d.artS, t('allShows'), d.nS) + '</div>' +
    '<div id="topweek"></div>' +
    rows + extra + '</div></div>');
  initFocus(current.focusKey || (x ? 'sp-play' : 'nav-home'));
  fillHomeStats();
}

/* ---------- server owner extras and shared statistics ---------- */
/* Is the signed-in user allowed to manage this server? Checked once per server and user. */
let adminCheck = { key: '', yes: false, at: 0 };
async function isAdmin() {
  const key = (S.server && S.server.id) + '|' + (S.user ? S.user.id : 'owner');
  if (adminCheck.key === key && Date.now() - adminCheck.at < 3600000) return adminCheck.yes;
  let yes = false;
  try { await fetchText(pmsURL('/status/sessions'), { timeout: 8000 }); yes = true; } catch (e) { yes = false; }
  /* A Plex Home admin (like a second profile for the owner) isn't a server admin with its own token. When this TV
     was linked with the owner's account and the current home user is an admin of the Home, admin tools use the
     owner's token instead. Home users without admin rights never get them. */
  if (!yes && S.adminToken && S.user) {
    let homeAdmin = S.user.admin;
    if (homeAdmin == null) {
      try {
        const users = parseRecords(await fetchText(tvURL('/api/home/users', {}, S.adminToken), { timeout: 8000 }), 'User');
        const me = users.find((u) => String(u.id) === String(S.user.id));
        homeAdmin = !!(me && (me.admin === true || me.admin === '1' || me.admin === 1));
        S.user.admin = homeAdmin; store.set('user', S.user);
      } catch (e) { homeAdmin = false; }
    }
    /* or the main account allowed this home user on this TV (Settings → Admin tools for) */
    if (!homeAdmin) homeAdmin = (store.get('adminUsers', []) || []).map(String).includes(String(S.user.id));
    if (homeAdmin) { try { await fetchText(ownerURL('/status/sessions'), { timeout: 8000 }); yes = true; } catch (e) { yes = false; } }
  }
  adminCheck = { key: key, yes: yes, at: Date.now() };
  return yes;
}
/* Requests made with the server owner's token (kept on this TV from when it was linked), so everyone in the
   household can see the shared "most watched" list. Only works on servers the owner owns. */
function ownerURL(path, extra) {
  return S.server.uri + path + (path.includes('?') ? '&' : '?') + plexParams(Object.assign({ 'X-Plex-Token': S.adminToken || S.server.token }, extra));
}
let statsCache = { at: 0, top: null, now: null, nowAt: 0 };
async function loadTopWeek() {
  if (statsCache.top && Date.now() - statsCache.at < 15 * 60000) return statsCache.top;
  const since = Math.floor(Date.now() / 1000) - 7 * 86400;
  const [hist, accts] = await Promise.all([
    getJSON(ownerURL('/status/sessions/history/all', { 'viewedAt>': since, sort: 'viewedAt:desc', 'X-Plex-Container-Start': 0, 'X-Plex-Container-Size': 1000 })),
    getJSON(ownerURL('/accounts')).catch(() => ({}))
  ]);
  const names = {};
  (((accts.MediaContainer || {}).Account) || []).forEach((a) => { names[a.id] = a.name; });
  const groups = new Map();
  (((hist.MediaContainer || {}).Metadata) || []).forEach((h) => {
    if (h.viewedAt && h.viewedAt < since) return;
    const ep = h.type === 'episode';
    const key = ep ? (h.grandparentRatingKey || h.grandparentKey || h.grandparentTitle) : (h.ratingKey || h.title);
    if (!key) return;
    if (!groups.has(key)) groups.set(key, { key: String(key).replace(/^\/library\/metadata\//, ''), title: ep ? h.grandparentTitle : h.title, type: ep ? 'show' : 'movie', thumb: ep ? (h.grandparentThumb || h.thumb) : h.thumb, plays: 0, users: new Set() });
    const g = groups.get(key);
    g.plays++;
    g.users.add(names[h.accountID] || h.accountID);
  });
  const top = Array.from(groups.values()).sort((a, b) => b.plays - a.plays || b.users.size - a.users.size).slice(0, 8);
  statsCache.top = top; statsCache.at = Date.now();
  return top;
}
/* Watching now (server managers): drawn again whenever someone starts, stops, pauses or switches;
   focus stays on the same stream if it's still there. */
let npTimer = null;
let npSig = '';
function npRender(list, seq) {
  const box = $('#nowplaying');
  if (!box || seq !== viewSeq) return;
  const sig = list.map((it) => [it.sessionKey, it.ratingKey, it.Player && it.Player.state, Math.round((it.viewOffset || 0) / Math.max(1, it.duration || 1) * 50),
    (it.TranscodeSession && it.TranscodeSession.videoDecision) || ''].join(':')).join('|');
  if (sig === npSig && box.innerHTML) return;
  npSig = sig;
  const had = focused && box.contains(focused) ? focused : null;
  const hadSession = had ? had.dataset.session : null;
  const hadIdx = had ? Number(String(had.dataset.key).replace('np-', '')) : -1;
  if (!list.length) {
    box.innerHTML = '';
    if (had) { const up = $('[data-key="vs-strip"]', viewEl) || $('[data-key="nav-home"]', viewEl); if (up) setFocus(up, true); }
    return;
  }
  box.innerHTML = '<section class="hub nowplaying"><div class="hubhead"><h2>' + esc(t('watchingNow')) + '</h2><span>' + esc(t('watchingNowSub')) + '</span></div><div class="grid8">' +
    list.slice(0, 8).map((it, i) => {
      const ep = it.type === 'episode';
      const art = imgURL(ep ? (it.grandparentThumb || it.parentThumb || it.thumb) : it.thumb, 300, 450);
      const pct = it.duration ? Math.min(100, Math.round((it.viewOffset || 0) / it.duration * 100)) : 0;
      const who = [(it.User && it.User.title) || '', (it.Player && (it.Player.title || it.Player.product)) || ''].filter(Boolean).join(' · ');
      const state = it.Player && it.Player.state === 'paused' ? t('pausedTag') : '';
      const si = typeof streamInfo === 'function' ? streamInfo(it) : null;
      return '<div class="card npcard f" data-key="np-' + i + '" data-session="' + esc(String(it.sessionKey || '')) + '" data-act="' + A(() => (typeof streamInfoSheet === 'function' ? streamInfoSheet(it) : openItem(it))) + '" data-ctx="' + A(() => openItem(it)) + '">' +
          '<div class="imgwrap">' + (art ? '<img class="img" loading="lazy" src="' + esc(art) + '" alt="">' : '<div class="img"></div>') + (pct ? '<div class="bar"><i style="width: ' + pct + '%"></i></div>' : '') +
          (state ? '<span class="endbadge">' + esc(state) + '</span>' : '') + '</div>' +
          '<div class="wrow"><span class="t">' + esc(itemTitle(it)) + '</span></div>' +
          '<span class="s">' + esc(who + (ep ? ' · ' + epCode(it) : '')) + '</span>' +
          (si ? '<span class="s npinfo' + (si.transcoding ? ' tc' : '') + '">' + esc(si.short) + '</span>' : '') + '</div>';
      }).join('') + '</div></section>';
  /* back on the same stream, or the one now in its place */
  if (had) {
    const same = hadSession ? $('[data-session="' + hadSession + '"]', box) : null;
    const items = Array.from(box.querySelectorAll('.npcard'));
    const to = same || items[Math.min(Math.max(0, hadIdx), items.length - 1)];
    if (to) setFocus(to, true);
  }
}
async function fillHomeStats() {
  const seq = viewSeq;
  /* Watching now: only for someone who manages the server */
  isAdmin().then(async (admin) => {
    if (!admin || seq !== viewSeq) return;
    if (typeof collMaybeAuto === 'function') collMaybeAuto();
    let list = statsCache.now;
    if (!list || Date.now() - statsCache.nowAt > 20000) {
      try { list = (((await getJSON(ownerURL('/status/sessions'))).MediaContainer || {}).Metadata || []); } catch (e) { list = []; }
      statsCache.now = list; statsCache.nowAt = Date.now();
    }
    npRender(list, seq);
    /* keep it live: look again every 10 s while Home is open */
    clearInterval(npTimer);
    npTimer = setInterval(async () => {
      if (seq !== viewSeq) { clearInterval(npTimer); return; }
      if (document.hidden || modalOpen()) return;
      let l;
      try { l = (((await getJSON(ownerURL('/status/sessions'), { timeout: 8000 })).MediaContainer || {}).Metadata || []); } catch (e) { return; }
      statsCache.now = l; statsCache.nowAt = Date.now();
      if (seq === viewSeq) npRender(l, seq);
    }, 10000);
  });
  /* Most watched this week: for everyone, if the server is the owner's */
  if (!S.adminToken) return;
  try {
    const top = await loadTopWeek();
    const box = $('#topweek');
    if (!box || seq !== viewSeq || !top.length) return;
    box.innerHTML = '<section class="hub"><div class="hubhead"><h2>' + esc(t('topWeek')) + '</h2><span>' + esc(t('topWeekSub')) + '</span></div><div class="grid8">' +
      top.map((g, i) => {
        const th = imgURL(g.thumb, 300, 450);
        return '<div class="card f" data-key="tw-' + i + '" data-act="' + A(() => go(viewDetails, [g.key])) + '" data-ctx="' + A(() => itemMenuByKey(g.key)) + '"><div class="cimg">' +
          (th ? '<img class="img" loading="lazy" src="' + esc(th) + '" alt="">' : '<div class="img"></div>') + '<span class="badge">#' + (i + 1) + '</span></div>' +
          '<div class="t">' + esc(g.title) + '</div><div class="s">' + esc((g.plays === 1 ? t('onePlay') : t('nPlays', { n: g.plays })) + ' · ' + (g.users.size === 1 ? t('oneUser') : t('nUsers', { n: g.users.size }))) + '</div></div>';
      }).join('') + '</div></section>';
  } catch (e) { /* not the owner's server, or no history: leave it out */ }
}
/* Holding OK on "All Movies" / "All TV Shows": open it, or (server managers) scan it for new files. */
async function libraryMenu(sec, label) {
  const admin = await isAdmin();
  const rows = [optionRow('lm-open', t('openLibrary'), [], false, A(() => { closeModal(true); go(viewLibrary, [sec]); }))];
  if (admin) rows.push(optionRow('lm-scan', t('scanLibraries'), [], false, A(() => { closeModal(); scanLibrary(sec); }), t('scanNote')));
  gradSheet(openModal(sheetHeader(label || sec.title, admin ? t('adminOnly') : '') + '<div class="optlist">' + rows.join('') + '</div>' +
    (admin ? '' : '<p class="sheettext">' + esc(t('scanNeedsAdmin')) + '</p>'), admin ? 'lm-scan' : 'lm-open'));
}
/* Settings: scanning libraries for new files (server managers only) */
async function scanLibrary(sec) {
  try {
    await fetch(ownerURL('/library/sections/' + sec.key + '/refresh'), { method: 'GET' });
    toast(t('scanStarted', { s: sec.title }), 4000);
  } catch (e) { toast(t('scanFailed'), 5000); }
}
/* The banner moves on every 15 seconds while nothing in it is selected. */
function spotTick(d, seq) {
  clearInterval(spot.timer);
  spot.timer = setInterval(() => {
    if (seq !== viewSeq || S.homeMode !== 'spotlight') { clearInterval(spot.timer); return; }
    const hero = $('#spothero');
    if (!hero || modalOpen() || (focused && hero.contains(focused)) || !d.spot || d.spot.heroes.length < 2) return;
    spot.idx++;
    /* swap only the banner, and keep whatever is selected exactly where it is on screen */
    const anchor = focused && document.contains(focused) ? focused : null;
    const y0 = anchor ? anchor.getBoundingClientRect().top : 0;
    const sc = $('.homescroll', viewEl) || $('.scroll', viewEl);
    hero.outerHTML = spotHeroHTML(d);
    if (anchor && sc && document.contains(anchor)) sc.scrollTop += anchor.getBoundingClientRect().top - y0;
    fillHero(d);
  }, 15000);
}
/* The banner item from the list endpoints has no stream details; fetch them so the subtitle button can show. */
async function fillHero(d) {
  const x = d.spot;
  if (!x || !x.heroes.length) return;
  const h = x.heroes[spot.idx % x.heroes.length];
  if (h.full) return;
  try {
    const full = ((await api('/library/metadata/' + h.it.ratingKey)).Metadata || [])[0];
    if (!full) return;
    h.full = full;
    const el = $('#spothero');
    if (!el || S.homeMode !== 'spotlight') return;
    const k = focused && el.contains(focused) ? focused.dataset.key : null;
    el.outerHTML = spotHeroHTML(d);
    if (k) initFocus(k, $('#spothero'));
  } catch (e) { /* keep the banner without subtitles */ }
}
function startSpot(d, seq) {
  const ready = () => {
    if (seq !== viewSeq || S.homeMode !== 'spotlight') return;
    const sc = $('.scroll', viewEl);
    const top = sc ? sc.scrollTop : 0;
    let want = d.wantFocus && focused && focused.dataset.key === d.autoKey ? d.wantFocus : null;
    /* the card that was there is gone (removed from a row): the one before it */
    if (want && /-\d+$/.test(want) && !$('[data-key="' + want + '"]', viewEl)) {
      const base = want.replace(/\d+$/, ''); let n = +want.match(/(\d+)$/)[1];
      d.wantFix = base; d.wantN = n;
    }
    d.wantFocus = null;
    current.focusKey = want || (focused && focused.dataset.key);
    if ((current.focusKey === 'spc-0' || current.focusKey === 'nav-home') && focused && focused.dataset.key === d.autoKey && !want) current.focusKey = 'sp-play'; /* nothing moved yet: start on the banner */
    drawHome(d);
    const sc2 = $('.scroll', viewEl);
    if (want && !$('[data-key="' + want + '"]', viewEl) && d.wantFix) {
      for (let n = d.wantN; n >= 0; n--) if ($('[data-key="' + d.wantFix + n + '"]', viewEl)) { want = d.wantFix + n; break; }
    }
    if (want && $('[data-key="' + want + '"]', viewEl)) {
      const el = $('[data-key="' + want + '"]', viewEl); setFocus(el, true); scrollToCenter(el);
      if (typeof vsAfterHome === 'function' && d.spot) vsAfterHome(d.spot.viewStats);
      return;
    }
    if (typeof vsReopen !== 'undefined') vsReopen = null;
    if (sc2) sc2.scrollTop = top;
  };
  if (!d.spotLoading) {
    if (window.__deepLink && typeof tvDeepLinkGo === 'function') setTimeout(tvDeepLinkGo, 0);
    d.spotLoading = loadSpotExtras(d).then((x) => { d.spot = x; ready(); if (typeof tvPreviewUpdate === 'function') tvPreviewUpdate(d); }).catch(() => { d.spot = { fits: [], pickPool: [], finish: [], heroes: [] }; ready(); });
  }
  spotTick(d, seq);
}

/* ---------- home fanart cards ---------- */
/* Movies use their fanart; TV episodes use the episode's own still, with the premise underneath. */
function fanCardHTML(it, key, action, kind) {
  const ep = it.type === 'episode';
  const src = imgURL(ep ? (it.thumb || it.grandparentArt) : (it.art || it.thumb), 640, 360);
  const pct = progress(it);
  const title = ep ? itemTitle(it) + ' · ' + epCode(it) : itemTitle(it);
  const side = kind === 'deck' ? (leftText(it) || t('upNext')) : (ep ? '' : [it.year, durText(it.duration)].filter(Boolean).join(' · '));
  return '<div class="card wide fcard f" data-key="' + esc(key) + '" data-act="' + action + '">' +
    (src ? '<img class="img" loading="lazy" src="' + esc(src) + '" alt="">' : '<div class="img"></div>') +
    (kind === 'deck' && pct ? '<div class="bar"><i style="width: ' + pct + '%"></i></div>' : '') +
    '<div class="wrow"><span class="t">' + esc(title) + '</span><span class="fs">' + esc(side) + '</span></div>' +
    (ep && it.title ? '<span class="eptitle">' + esc(it.title) + '</span>' : '') +
    '<p class="prem">' + esc(it.summary || '') + '</p></div>';
}

/* ---------- release radar (TVmaze) ---------- */
/* Every show in your Plex TV libraries is matched to TVmaze by its TVDB or IMDb id (recently watched first).
   Results are cached in the browser: running shows for 12 hours, ended shows for 30 days, so only the
   first visit is slow. The calendar fills in as shows are checked. Episodes you have are marked. */
let radar = { state: 'idle', shows: [], next: null, done: 0, total: 0, at: 0 };
let radarPromise = null;
const radarSubs = new Set();
function onRadar(fn) { radarSubs.add(fn); return () => radarSubs.delete(fn); }
function notifyRadar() { radarSubs.forEach((fn) => { try { fn(); } catch (e) { /* ignore */ } }); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function stripTags(html) { const d = document.createElement('div'); d.innerHTML = html || ''; return (d.textContent || '').trim(); }
function dayKey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function airLabel(stamp) {
  const d = new Date(stamp);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const day = new Date(d); day.setHours(0, 0, 0, 0);
  const diff = Math.round((day - today) / 86400000);
  if (diff === 0) return t('today');
  if (diff > 0 && diff < 7) return d.toLocaleDateString(lang().locale, { weekday: 'long' });
  return dayKey(d);
}
/* Shows can be left out of the calendar (Shows button in the calendar); the key is the Plex show, or the TVmaze id for shows added by hand. */
function calKey(s) { return s.plex.manual ? 'tvm:' + s.tvm.id : String(s.plex.ratingKey); }
function calVisible(s) { return !S.calHidden.includes(calKey(s)); }
function radarNext() {
  const now = Date.now();
  let next = null;
  radar.shows.filter(calVisible).forEach((s) => s.eps.forEach((e) => {
    const tt = Date.parse(e.airstamp);
    if (tt > now && (!next || tt < next.t)) next = { t: tt, show: s, ep: e };
  }));
  return next;
}
/* All TVmaze calls go through one queue: TVmaze allows about 20 calls per 10 seconds per address,
   so calls are spaced 520 ms apart and a "too many requests" answer is retried after a pause. */
let tvmLast = 0;
let tvmChain = Promise.resolve();
function tvmGet(url) {
  const run = async () => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const wait = tvmLast + 520 - Date.now();
      if (wait > 0) await sleep(wait);
      tvmLast = Date.now();
      const r = await fetch(url);
      if (r.status === 429) { await sleep(2500 * (attempt + 1)); continue; }
      return r;
    }
    return { ok: false, status: 429, json: async () => ({}) };
  };
  const p = tvmChain.then(run, run);
  tvmChain = p.catch(() => {});
  return p;
}
/* Which TVmaze show a Plex show is: by TVDB id, then IMDb id (new and old Plex agents),
   then by title (checked against the year). Misses are retried after a week. */
function tvmIdsOf(c) {
  const g = (c.Guid || []).map((x) => x.id || '').concat([c.guid || '']);
  let tvdb = '', imdb = '';
  g.forEach((x) => {
    const a = /(?:^tvdb|thetvdb):\/\/(\d+)/.exec(x); if (a && !tvdb) tvdb = a[1];
    const b = /imdb:\/\/(tt\d+)/.exec(x); if (b && !imdb) imdb = b[1];
  });
  return { tvdb: tvdb, imdb: imdb };
}
function tvmMapGet() {
  let map = store.get('tvmMap2', null);
  if (!map) {
    map = {};
    const old = store.get('tvmMap', {});
    Object.keys(old).forEach((k) => { if (old[k] > 0) map[k] = old[k]; });
    store.del('tvmMap');
    try { Object.keys(localStorage).filter((k) => k.startsWith('pp.tvmEps.')).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* ignore */ }
    store.set('tvmMap2', map);
  }
  return map;
}
async function tvmIdFor(c, map) {
  map = map || tvmMapGet();
  const key = c.guid || c.ratingKey;
  const hit = map[key];
  if (typeof hit === 'number' && hit > 0) return hit;
  if (hit && hit.miss && Date.now() - hit.miss < 7 * 86400000) return -1;
  const ids = tvmIdsOf(c);
  let id = null;
  const tryURL = async (url) => {
    const r = await tvmGet(url);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('tvmaze ' + r.status);
    return await r.json();
  };
  if (ids.tvdb) { const j = await tryURL('https://api.tvmaze.com/lookup/shows?thetvdb=' + ids.tvdb); if (j && j.id) id = j.id; }
  if (!id && ids.imdb) { const j = await tryURL('https://api.tvmaze.com/lookup/shows?imdb=' + ids.imdb); if (j && j.id) id = j.id; }
  if (!id && c.title) {
    const q = String(c.title).replace(/\s*\(\d{4}\)\s*$/, '');
    const j = await tryURL('https://api.tvmaze.com/singlesearch/shows?q=' + encodeURIComponent(q));
    const y = j && j.premiered ? +j.premiered.slice(0, 4) : 0;
    if (j && j.id && (!c.year || !y || Math.abs(y - c.year) <= 1)) id = j.id;
  }
  map[key] = id || { miss: Date.now() };
  store.set('tvmMap2', map);
  return id || -1;
}
/* Per show we keep its status, the date of its last aired episode and the episodes from the last year on.
   Running shows are checked again after 12 hours, ended shows after 30 days. */
async function tvmShowCached(id) {
  const now = Date.now();
  let cached = store.get('tvm2.' + id, null);
  const maxAge = cached && cached.status === 'Ended' ? 30 * 86400000 : 12 * 3600000;
  if (cached && now - cached.at < maxAge) return cached;
  const r = await tvmGet('https://api.tvmaze.com/shows/' + id + '?embed=episodes');
  if (!r.ok) return cached;
  const sh = await r.json();
  const all = ((sh._embedded && sh._embedded.episodes) || []).filter((e) => e.airdate);
  const from = now - 365 * 86400000;
  const aired = all.filter((e) => Date.parse(e.airstamp || e.airdate) <= now);
  cached = {
    at: now, status: sh.status,
    last: aired.length ? aired[aired.length - 1].airdate : null,
    eps: all.filter((e) => Date.parse(e.airstamp || e.airdate) >= from).map((e) => ({
      season: e.season, number: e.number, name: e.name || '', airdate: e.airdate,
      airstamp: e.airstamp || e.airdate, summary: stripTags(e.summary).slice(0, 300)
    }))
  };
  store.set('tvm2.' + id, cached);
  return cached;
}
/* Every show in your Plex TV libraries, watched or not (recently watched first so they show up first).
   Three shows are worked on at a time; the calendar fills in as they are checked. */
async function loadRadar(secs) {
  if (radar.state === 'ok' && Date.now() - radar.at < 30 * 60000) return radar;
  if (radarPromise) return radarPromise;
  radarPromise = (async () => {
    radar = { state: 'loading', shows: [], next: null, done: 0, total: 0, at: Date.now(), ended: 0, quiet: 0, unmatched: 0 };
    notifyRadar();
    secs = secs || ((await api('/library/sections')).Directory || []);
    let cands = [];
    for (const s of secs.filter((x) => x.type === 'show')) {
      const r = await api('/library/sections/' + s.key + '/all', { includeGuids: 1, 'X-Plex-Container-Start': 0, 'X-Plex-Container-Size': 10000 }).catch(() => ({}));
      cands = cands.concat(r.Metadata || []);
    }
    cands.sort((a, b) => (b.lastViewedAt || 0) - (a.lastViewedAt || 0) || (b.addedAt || 0) - (a.addedAt || 0));
    radar.total = cands.length;
    notifyRadar();
    const map = tvmMapGet();
    let lastNotify = 0;
    const one = async (c) => {
      try {
        const id = await tvmIdFor(c, map);
        if (id === -1) { radar.unmatched++; return; }
        const cached = await tvmShowCached(id);
        if (!cached) { radar.unmatched++; return; }
        if (!cached.eps.length) { if (cached.status === 'Ended') radar.ended++; else radar.quiet++; return; }
        const owned = new Map();
        try {
          const leaves = await api('/library/metadata/' + c.ratingKey + '/allLeaves');
          (leaves.Metadata || []).forEach((e) => owned.set(e.parentIndex + 'x' + e.index, e.ratingKey));
        } catch (e) { /* treat as nothing owned */ }
        const eps = cached.eps.map((e) => Object.assign({}, e, { owned: owned.has(e.season + 'x' + e.number), ownedKey: owned.get(e.season + 'x' + e.number) || null }));
        radar.shows.push({ plex: c, tvm: { id: id, status: cached.status, last: cached.last }, eps: eps });
      } catch (e) { radar.unmatched++; }
    };
    const queue = cands.slice();
    const worker = async () => {
      while (queue.length) {
        await one(queue.shift());
        radar.done++;
        if (Date.now() - lastNotify > 1200) { lastNotify = Date.now(); radar.next = radarNext(); notifyRadar(); }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    /* shows added by hand (not in your library) */
    const have = new Set(radar.shows.map((x) => x.tvm.id));
    for (const x of S.calExtra) {
      if (have.has(x.id)) continue;
      try {
        const cached = await tvmShowCached(x.id);
        if (cached && cached.eps.length) radar.shows.push({ plex: { title: x.name, thumb: x.image, art: x.image, ratingKey: null, manual: true }, tvm: { id: x.id, status: cached.status, last: cached.last }, eps: cached.eps.map((e) => Object.assign({}, e, { owned: false, ownedKey: null })) });
      } catch (e) { /* skip */ }
    }
    radar.next = radarNext();
    radar.state = 'ok';
    radar.at = Date.now();
    notifyRadar();
    return radar;
  })().catch(() => { radar.state = radar.shows.length ? 'ok' : 'failed'; notifyRadar(); return radar; })
    .finally(() => { radarPromise = null; });
  return radarPromise;
}
/* An episode of a show you added by hand (it isn't in Plex, so there's no page to open): a short info sheet. */
function manualEpInfo(show, ep) {
  const prev = modalArt; modalArt = show.plex.thumb || null;
  openModal(sheetHeader(show.plex.title, 'S' + ep.season + ' E' + ep.number) +
    '<div class="tags"><span class="tag">' + esc(airLabel(ep.airstamp).toUpperCase()) + '</span><span class="tag">' + esc(t('notInLibrary').toUpperCase()) + '</span></div>' +
    (ep.name ? '<h3 style="margin: 0; font-size: 30px">' + esc(ep.name) + '</h3>' : '') +
    (ep.summary ? '<p class="sheettext">' + esc(ep.summary) + '</p>' : '') +
    '<button type="button" class="btn f" data-default data-act="' + A(() => closeModal()) + '">' + ICON.back + esc(t('back')) + '</button>');
  modalArt = prev;
}
/* After a calendar menu really closes (not when it swaps to the next menu), the calendar behind it is refreshed. */
function calMenuDone(el, onChange) { if (el) el._onclose = () => setTimeout(() => { if (!modalOpen()) onChange(); }, 0); return el; }
/* Which shows appear in the calendar, plus adding and removing shows by hand. */
function calShowsMenu(onChange, prefer) {
  const all = radar.shows.slice().sort((a, b) => String(a.plex.title).localeCompare(String(b.plex.title)));
  const lib = all.filter((x) => !x.plex.manual), mine = all.filter((x) => x.plex.manual);
  const toggle = (x) => A(() => {
    const k = calKey(x);
    S.calHidden = S.calHidden.includes(k) ? S.calHidden.filter((y) => y !== k) : S.calHidden.concat([k]);
    store.set(userKey('calHidden'), S.calHidden); radar.next = radarNext(); onChange(); calShowsMenu(onChange, 'cs-' + k);
  });
  const row = (x) => optionRow('cs-' + calKey(x), x.plex.title, x.tvm.status === 'Ended' ? [t('ended')] : [], calVisible(x), toggle(x));
  calMenuDone(gradSheet(openModal(sheetHeader(t('calShows'), t('calShowsNote', { n: all.filter(calVisible).length, m: all.length })) +
    '<div class="optlist"><div class="subrow dlrow-sub f" data-key="cs-add" data-act="' + A(() => calAddShow(onChange)) + '"><span class="chk">' + ICON.search + '</span><span class="lang">' + esc(t('calAdd')) + '<small>' + esc(t('calAddNote')) + '</small></span></div>' +
    optionRow('cs-all', t('calShowAll'), [], false, A(() => { S.calHidden = []; store.set(userKey('calHidden'), []); radar.next = radarNext(); onChange(); calShowsMenu(onChange, 'cs-all'); })) +
    optionRow('cs-none', t('calHideAll'), [], false, A(() => { S.calHidden = all.map(calKey); store.set(userKey('calHidden'), S.calHidden); radar.next = radarNext(); onChange(); calShowsMenu(onChange, 'cs-none'); })) + '</div>' +
    (mine.length ? '<span class="label">' + esc(t('calAdded')) + '</span><div class="optlist">' + mine.map(row).join('') +
      optionRow('cs-remove', t('calRemove'), [], false, A(() => calRemoveShow(onChange))) + '</div>' : '') +
    (lib.length ? '<span class="label">' + esc(t('calFromLibrary')) + '</span><div class="optlist">' + lib.map(row).join('') + '</div>' : '') +
    (radar.state === 'loading' ? '<p class="sheettext">' + esc(t('radarProgress', { n: radar.done, m: radar.total })) + '</p>' : ''), prefer || 'cs-add')), onChange);
}
function calRemoveShow(onChange) {
  calMenuDone(gradSheet(openModal(sheetHeader(t('calRemove'), '') + '<div class="optlist">' + S.calExtra.map((x, i) => optionRow('cr-' + i, x.name, x.year ? [String(x.year)] : [], false, A(() => {
    S.calExtra = S.calExtra.filter((y) => y.id !== x.id); store.set(userKey('calExtra'), S.calExtra);
    radar.shows = radar.shows.filter((s) => !(s.plex.manual && s.tvm.id === x.id)); radar.next = radarNext();
    onChange(); toast(t('calRemoved', { s: x.name }), 3000); calShowsMenu(onChange);
  }))).join('') + '</div>' +
    '<button type="button" class="btn f" data-key="crback" data-act="' + A(() => calShowsMenu(onChange)) + '">' + ICON.back + esc(t('back')) + '</button>', 'cr-0')), onChange);
}
/* Search TVmaze for a show to follow (typed on the TV keyboard, or said with the remote's voice button). */
function calAddShow(onChange) {
  const draw = (q, results, msg) => {
    calMenuDone(openModal(sheetHeader(t('calAdd'), '') +
      '<div class="sline"><span class="sicon">' + ICON.search + '</span><input class="input f" id="calq" data-key="calq" type="text" spellcheck="false" autocomplete="off" placeholder="' + esc(t('calAddPlaceholder')) + '" value="' + esc(q || '') + '"></div>' +
      (msg ? '<p class="sheettext">' + esc(msg) + '</p>' : '') +
      (results && results.length ? '<div class="optlist">' + results.map((r, i) => {
        const sh = r.show || {};
        const already = S.calExtra.some((x) => x.id === sh.id) || radar.shows.some((x) => x.tvm.id === sh.id);
        const sub = [sh.premiered ? sh.premiered.slice(0, 4) : '', (sh.network && sh.network.name) || (sh.webChannel && sh.webChannel.name) || '', sh.status || ''].filter(Boolean).join(' · ');
        return optionRow('ca-' + i, sh.name || '?', already ? [t('calFollowing')] : [], already, A(() => {
          if (already) { toast(t('calAlready'), 3000); return; }
          const img = sh.image ? (sh.image.medium || sh.image.original) : '';
          S.calExtra = S.calExtra.concat([{ id: sh.id, name: sh.name, image: img, year: sh.premiered ? +sh.premiered.slice(0, 4) : 0 }]);
          store.set(userKey('calExtra'), S.calExtra);
          toast(t('calAddedToast', { s: sh.name }), 4000);
          closeModal(true);
          tvmShowCached(sh.id).then((cached) => {
            if (cached && cached.eps.length) radar.shows.push({ plex: { title: sh.name, thumb: img, art: (sh.image && sh.image.original) || img, ratingKey: null, manual: true }, tvm: { id: sh.id, status: cached.status, last: cached.last }, eps: cached.eps.map((e) => Object.assign({}, e, { owned: false, ownedKey: null })) });
            else toast(t('calNoEps', { s: sh.name }), 6000);
            radar.next = radarNext(); onChange();
          }).catch(() => toast(t('onlineFailed'), 5000));
        }), sub);
      }).join('') + '</div>' : '') +
      '<button type="button" class="btn f" data-key="caback" data-act="' + A(() => calShowsMenu(onChange)) + '">' + ICON.back + esc(t('back')) + '</button>', results && results.length ? 'ca-0' : 'calq'), onChange);
    const inp = $('#calq');
    if (!inp) return;
    let tmr = null;
    const search = async () => {
      clearTimeout(tmr);
      const qq = inp.value.trim();
      if (qq.length < 2) return;
      try {
        const r = await tvmGet('https://api.tvmaze.com/search/shows?q=' + encodeURIComponent(qq));
        const j = r.ok ? await r.json() : [];
        if (document.contains(inp)) { inp.blur(); draw(qq, j.slice(0, 10), j.length ? '' : t('noMatches')); }
      } catch (e) { draw(qq, [], t('onlineFailed')); }
    };
    /* typing pauses or the TV keyboard's Done start the search; so does OK on the box */
    inp.addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(search, 1500); });
    inp.dataset.act = A(search);
    inp.addEventListener('keydown', (e) => { if (e.keyCode === 65376 || e.keyCode === 65385) { e.preventDefault(); e.stopPropagation(); search(); } });
  };
  draw('', null, '');
}
function soonHTML() {
  const st = radar ? radar.state : 'loading';
  const act = A(() => go(viewCalendar));
  let body;
  if (radar.next) {
    const n = radar.next;
    const art = n.show.plex.art || n.show.plex.thumb;
    if (art) body = '<img class="soonart" src="' + esc(imgURL(art, 600, 340)) + '" alt=""><span class="soonfade"></span>';
    else body = '';
    body += '<span class="label">' + esc(t('comingSoon')) + '</span>' +
      '<b class="sn">' + esc(n.show.plex.title) + '</b>' +
      '<span class="se">S' + n.ep.season + ' E' + n.ep.number + ' · ' + esc(airLabel(n.ep.airstamp)) + '</span>';
  } else if (st === 'loading' || st === 'idle') body = '<span class="label">' + esc(t('comingSoon')) + '</span><span class="sn muted">' + esc(t('loading')) + '</span>';
  else body = '<span class="label">' + esc(t('comingSoon')) + '</span><span class="sn muted">' + esc(t('nothingScheduled')) + '</span>';
  return '<button type="button" class="soon f" id="soon" data-key="soon" data-act="' + act + '">' + body +
    '<span class="cal-link">' + esc(t('releaseCalendar')) + ICON.next + '</span></button>';
}
function updateSoon() {
  const el = $('#soon');
  if (!el) return;
  const wasFocused = focused === el;
  el.outerHTML = soonHTML();
  if (wasFocused) setFocus($('#soon'), true);
}

/* ---------- cinema releases (TMDB) ---------- */
const REGIONS = [['SE', 'Sverige'], ['DK', 'Danmark'], ['NO', 'Norge'], ['FI', 'Suomi'], ['GB', 'United Kingdom'], ['US', 'United States'], ['DE', 'Deutschland'], ['CZ', 'Česko'], ['UA', 'Україна'], ['GR', 'Ελλάδα']];
/* Films opening in cinemas in one country, from two weeks ago to five months ahead. TMDB's discover list gives
   the films; each film's own release dates give the date in that country. Kept for 12 hours. */
const movieCache = new Map();
async function movieReleases(region) {
  const hit = movieCache.get(region) || store.get('movcal.' + region, null);
  if (hit && Date.now() - hit.at < 12 * 3600000) { movieCache.set(region, hit); return hit.list; }
  if (!S.tmdb) throw new Error('no key');
  const from = new Date(Date.now() - 14 * 86400000), to = new Date(Date.now() + 150 * 86400000);
  const iso = (d) => d.toISOString().slice(0, 10);
  const lng = S.lang + '-' + region;
  let found = [];
  for (let page = 1; page <= 4; page++) {
    const j = await tmdbGet('/discover/movie', { region: region, with_release_type: '2|3', 'release_date.gte': iso(from), 'release_date.lte': iso(to), sort_by: 'popularity.desc', language: lng, page: page, include_adult: 'false' });
    found = found.concat(j.results || []);
    if (!j.total_pages || page >= j.total_pages) break;
  }
  const seen = new Set();
  found = found.filter((m) => !seen.has(m.id) && seen.add(m.id)).slice(0, 70);
  const owned = await libraryTmdbMap();
  const genreNames = await tmdbGenres(lng);
  const out = [];
  const queue = found.slice();
  const worker = async () => {
    while (queue.length) {
      const m = queue.shift();
      let date = null;
      try {
        const rd = await tmdbGet('/movie/' + m.id + '/release_dates');
        const mine = ((rd.results || []).find((r) => r.iso_3166_1 === region) || {}).release_dates || [];
        const pick = mine.filter((r) => r.type === 3).concat(mine.filter((r) => r.type === 2));
        if (pick.length) date = pick.map((r) => r.release_date.slice(0, 10)).sort()[0];
      } catch (e) { /* use the main date */ }
      date = date || m.release_date;
      if (!date || date < iso(from) || date > iso(to)) continue;
      out.push({
        id: m.id, title: m.title, date: date, year: (m.release_date || '').slice(0, 4),
        overview: m.overview || '', poster: m.poster_path ? 'https://image.tmdb.org/t/p/w342' + m.poster_path : '',
        backdrop: m.backdrop_path ? 'https://image.tmdb.org/t/p/w780' + m.backdrop_path : '',
        genres: (m.genre_ids || []).slice(0, 2).map((g) => genreNames[g]).filter(Boolean).join(', '),
        ownedKey: owned.get(m.id) || null
      });
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const rec = { at: Date.now(), list: out };
  movieCache.set(region, rec);
  try { store.set('movcal.' + region, rec); } catch (e) { /* storage full: fine */ }
  return out;
}
let tmdbLibMap = null;
async function libraryTmdbMap() {
  if (tmdbLibMap) return tmdbLibMap;
  const map = new Map();
  try {
    const secs = ((await api('/library/sections')).Directory || []).filter((x) => x.type === 'movie');
    for (const s of secs) {
      const r = await api('/library/sections/' + s.key + '/all', { includeGuids: 1, 'X-Plex-Container-Start': 0, 'X-Plex-Container-Size': 20000 });
      (r.Metadata || []).forEach((m) => { const id = tmdbIdOf(m); if (id) map.set(id, m.ratingKey); });
    }
  } catch (e) { /* nothing marked as owned */ }
  tmdbLibMap = map;
  return map;
}
const genreCache = {};
async function tmdbGenres(lng) {
  if (genreCache[lng]) return genreCache[lng];
  const out = {};
  try { ((await tmdbGet('/genre/movie/list', { language: lng })).genres || []).forEach((g) => { out[g.id] = g.name; }); } catch (e) { /* no genre names */ }
  genreCache[lng] = out;
  return out;
}
/* A film that isn't in your library: what it's about, when it opens, and its trailer. */
function movieInfo(mv) {
  const prev = modalArt; modalArt = mv.poster || null;
  const d = new Date(mv.date + 'T12:00:00');
  openModal(sheetHeader(mv.title, mv.genres || '') +
    '<div class="tags"><span class="tag strong">' + esc((Date.now() < d.getTime() ? t('inCinemasFrom') : t('inCinemas')).toUpperCase() + ' · ' + d.toLocaleDateString(lang().locale, { day: 'numeric', month: 'long' })) + '</span></div>' +
    (mv.overview ? '<p class="sheettext">' + esc(mv.overview) + '</p>' : '') +
    '<div class="optlist">' + optionRow('mi-trailer', t('trailer'), [], false, A(() => { closeModal(true); tmdbTrailer(false, mv.id, mv.title); })) + '</div>' +
    '<button type="button" class="btn f" data-key="miback" data-act="' + A(() => closeModal()) + '">' + ICON.back + esc(t('back')) + '</button>', 'mi-trailer');
  modalArt = prev;
}

/* ---------- release calendar ---------- */
async function viewCalendar() {
  const seq = viewSeq;
  render('<div class="screen"><div class="top"><div class="htitle"><button type="button" class="crumb f" data-key="crumb" data-act="' + A(back) + '">' + ICON.back + esc(t('home')) + '</button><h1>' + esc(t('releaseCalendar')) + '</h1></div>' + clockHTML() + '</div><div class="empty">' + esc(t('radarLoading')) + '</div></div>');
  loadRadar();
  const r = radar;
  const now = new Date();
  const month = { y: now.getFullYear(), m: now.getMonth() };
  let byDay = new Map();
  /* Movies mode: cinema releases from TMDB for your country (see movieReleases) */
  let movies = { state: 'idle', list: [] };
  const loadMovies = () => {
    if (movies.state === 'loading') return;
    movies = { state: 'loading', list: [] };
    movieReleases(S.movieRegion).then((list) => { movies = { state: 'ok', list: list }; }).catch((e) => { movies = { state: 'failed', list: [], err: e && e.message }; })
      .then(() => { if (seq === viewSeq && S.calMode === 'movies' && !modalOpen()) { rebuild(); draw(focused && focused.dataset.key); } });
  };
  const rebuild = () => {
    byDay = new Map();
    const add = (k, x) => { if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(x); };
    if (S.calMode === 'movies') {
      movies.list.forEach((mv) => add(mv.date, { movie: mv, show: { plex: { title: mv.title, thumb: mv.poster, art: mv.backdrop || mv.poster, ratingKey: mv.ownedKey } }, ep: { airstamp: mv.date, owned: !!mv.ownedKey, ownedKey: mv.ownedKey, summary: mv.overview } }));
      return;
    }
    radar.shows.filter(calVisible).forEach((s) => s.eps.forEach((e) => add(dayKey(new Date(e.airstamp)), { show: s, ep: e })));
  };
  if (S.calMode === 'movies') loadMovies();
  rebuild();
  /* The calendar fills in while shows are being checked. */
  let pending = null;
  cleanup = onRadar(() => {
    if (seq !== viewSeq || pending || S.calMode === 'movies') return;
    pending = setTimeout(() => {
      pending = null;
      if (seq !== viewSeq || modalOpen()) return;
      rebuild();
      const inPanel = focused && focused.classList.contains('calitem');
      draw(inPanel ? (lastDay && lastDay.dataset.key) : (focused && focused.dataset.key));
    }, 800);
  });
  const todayKey = dayKey(now);
  /* Enter on a day jumps into the episode list on the right; Left or Esc jumps back to the day. */
  let lastDay = null;
  keyHandler = (e) => {
    if (focused && focused.classList.contains('calitem') && ['ArrowLeft', 'Escape', 'Backspace'].includes(e.key)) {
      if (lastDay && document.contains(lastDay)) { setFocus(lastDay); return true; }
    }
    return false;
  };
  const wd = [];
  for (let i = 0; i < 7; i++) wd.push(new Date(2024, 0, 1 + i).toLocaleDateString(lang().locale, { weekday: 'short' }));
  const panel = (k) => {
    const dp = $('#calpanel');
    if (!dp) return;
    const [y, mo, d] = k.split('-').map(Number);
    const date = new Date(y, mo - 1, d);
    const list = byDay.get(k) || [];
    dp.innerHTML = '<span class="label">' + esc(date.toLocaleDateString(lang().locale, { weekday: 'long' })) + '</span><h2>' + esc(date.toLocaleDateString(lang().locale, { day: 'numeric', month: 'long', year: 'numeric' })) + '</h2>' +
      (list.length ? '<span class="count">' + esc(t('calPanelHint')) + '</span>' + list.map((x, i) => {
        const future = Date.parse(x.ep.airstamp) > Date.now();
        const opens = new Date(Date.parse(x.ep.airstamp)).toLocaleDateString(lang().locale, { day: 'numeric', month: 'short' });
        const tag = x.ep.owned ? t('inLibrary') : x.movie ? (future ? t('inCinemasFrom') + ' ' + opens : t('inCinemas')) : future ? t('upcoming') : t('notYetInLibrary');
        const th = imgURL(x.show.plex.thumb, 120, 180);
        /* An episode you have opens the episode; otherwise Enter goes to the show (or an info sheet). */
        const act = A(() => openX(x));
        return '<div class="calitem f" data-key="ci-' + i + '" data-act="' + act + '">' + (th ? '<img src="' + esc(th) + '" alt="">' : '<div class="ph"></div>') +
          '<div class="ci"><b>' + esc(x.show.plex.title) + '</b><span>' + esc(epLine(x)) + '</span>' +
          '<span class="tags"><span class="tag' + (x.ep.owned ? ' strong' : '') + '">' + esc(tag.toUpperCase()) + '</span></span>' +
          (x.ep.summary ? '<p>' + esc(x.ep.summary) + '</p>' : '') +
          '<span class="go">' + esc(x.movie ? (x.ep.ownedKey ? t('goToMovie') : t('moreInfo')) : x.ep.ownedKey ? t('goToEpisode') : t('goToShow')) + ICON.next + '</span></div></div>';
      }).join('') : '<div class="empty" style="padding-left: 0">' + esc(S.calMode === 'movies' ? t('moviesEmpty') : t('calendarEmpty')) + '</div>');
  };
  const drawMonth = (focusKey) => {
    const first = new Date(month.y, month.m, 1);
    const start = new Date(first);
    start.setDate(1 - ((first.getDay() + 6) % 7));
    const last = new Date(month.y, month.m + 1, 0);
    const cells = Math.ceil((((first.getDay() + 6) % 7) + last.getDate()) / 7) * 7;
    let grid = '';
    for (let i = 0; i < cells; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const k = dayKey(d);
      const list = byDay.get(k) || [];
      const out = d.getMonth() !== month.m;
      grid += '<div class="calday f' + (out ? ' out' : '') + (k === todayKey ? ' today' : '') + '" data-key="d-' + k + '" data-onfocus="' + A((el) => { lastDay = el; panel(k); }) + '" data-act="' + A(() => { const first = $('#calpanel .calitem'); if (first) setFocus(first); }) + '">' +
        '<span class="num">' + d.getDate() + '</span>' +
        list.slice(0, 2).map((x) => '<span class="calev"><i class="' + (x.ep.owned ? 'own' : '') + '"></i><span>' + esc(x.show.plex.title) + '</span></span>').join('') +
        (list.length > 2 ? '<span class="more">+' + (list.length - 2) + '</span>' : '') + '</div>';
    }
    const monthName = first.toLocaleDateString(lang().locale, { month: 'long', year: 'numeric' });
    render('<div class="screen cal">' + calTop('<div class="monthnav">' +
      '<button type="button" class="btn small icon f" data-key="prev" aria-label="' + esc(t('prevMonth')) + '" data-act="' + A(() => { month.m--; if (month.m < 0) { month.m = 11; month.y--; } draw('prev'); }) + '">' + ICON.back + '</button>' +
      '<span class="mname">' + esc(monthName) + '</span>' +
      '<button type="button" class="btn small icon f" data-key="next" aria-label="' + esc(t('nextMonth')) + '" data-act="' + A(() => { month.m++; if (month.m > 11) { month.m = 0; month.y++; } draw('next'); }) + '">' + ICON.next + '</button></div>') +
      '<div class="callegend"><span><i class="own"></i>' + esc(t('inLibrary')) + '</span><span><i></i>' + esc(S.calMode === 'movies' ? t('inCinemas') : t('notYetInLibrary')) + '</span><span class="count">' + esc(statusLine()) + '</span></div>' +
      '<div class="calwrap"><div class="calgrid">' + wd.map((w) => '<span class="wd">' + esc(w) + '</span>').join('') + grid + '</div>' +
      '<aside class="calpanel" id="calpanel"></aside></div></div>');
    const inMonth = month.y === now.getFullYear() && month.m === now.getMonth();
    initFocus(focusKey || (inMonth ? 'd-' + todayKey : 'd-' + dayKey(first)));
    if (focused && !focused.classList.contains('calday')) panel(inMonth ? todayKey : dayKey(first));
  };

  /* Header shared by the three views: title, view switch (Week / Month / List), the view's own navigation, clock. */
  function calTop(nav) {
    const views = [['week', t('calWeek')], ['month', t('calMonth')], ['list', t('calList')]];
    const modes = [['tv', t('calModeTv')], ['movies', t('calModeMovies')]];
    const reg = REGIONS.find((r) => r[0] === S.movieRegion) || [S.movieRegion, S.movieRegion];
    return '<div class="top caltop"><div class="htitle"><button type="button" class="crumb f" data-key="crumb" data-act="' + A(back) + '">' + ICON.back + esc(t('home')) + '</button><h1>' + esc(t('releaseCalendar')) + '</h1></div>' +
      '<div class="seg">' + modes.map((v) => '<button type="button" class="f' + (S.calMode === v[0] ? ' on' : '') + '" data-key="cm-' + v[0] + '" data-act="' + A(() => { S.calMode = v[0]; store.set('calMode', v[0]); if (v[0] === 'movies' && movies.state !== 'ok') loadMovies(); rebuild(); draw('cm-' + v[0]); }) + '">' + esc(v[1]) + '</button>').join('') + '</div>' +
      (S.calMode === 'movies'
        ? '<button type="button" class="tbtn f" data-key="calregion" data-act="' + A(pickRegion) + '">' + ICON.filter + esc(reg[1]) + '</button>'
        : '<button type="button" class="tbtn f" data-key="calshows" data-act="' + A(() => calShowsMenu(() => { if (seq !== viewSeq) return; rebuild(); if (!modalOpen()) draw('calshows'); }, null)) + '">' + ICON.filter + esc(t('calShows')) + (S.calHidden.length ? '<span class="count-badge">' + S.calHidden.length + '</span>' : '') + '</button>') +
      '<div class="seg">' + views.map((v) => '<button type="button" class="f' + (S.calView === v[0] ? ' on' : '') + '" data-key="cv-' + v[0] + '" data-act="' + A(() => { S.calView = v[0]; store.set('calView', v[0]); draw('cv-' + v[0]); }) + '">' + esc(v[1]) + '</button>').join('') + '</div>' +
      (nav || '') + '<div style="margin-left: auto"></div>' + clockHTML(false, 'margin-left: 28px') + '</div>';
  }
  const epTag = (x, d) => {
    if (x.ep.owned) return '<span class="tag strong">' + esc(t('inLibrary').toUpperCase()) + '</span>';
    if (x.movie) return '<span class="tag">' + esc(t('cinemaTag')) + '</span>';
    if (x.ep.number === 1) return '<span class="tag">' + esc(t('premiere')) + '</span>';
    return '<span class="tag">' + esc(String(x.ep.airstamp).length > 10 ? hhmm(d) : t('upcoming').toUpperCase()) + '</span>';
  };
  const openX = (x) => {
    if (x.movie) return x.movie.ownedKey ? go(viewDetails, [x.movie.ownedKey]) : movieInfo(x.movie);
    if (x.show.plex.manual) return manualEpInfo(x.show, x.ep);
    return go(viewDetails, [x.ep.ownedKey || x.show.plex.ratingKey]);
  };
  const epLine = (x) => (x.movie ? [x.movie.year, x.movie.genres].filter(Boolean).join(' · ') : 'S' + x.ep.season + ' E' + x.ep.number + (x.ep.name ? ' · ' + x.ep.name : ''));
  const statusLine = () => {
    if (S.calMode === 'movies') {
      const reg = REGIONS.find((r) => r[0] === S.movieRegion);
      return movies.state === 'loading' || movies.state === 'idle' ? t('moviesLoading') : movies.state === 'failed' ? (S.tmdb ? t('moviesFailed') : t('trailerNeedsKey')) : t('moviesDone', { n: movies.list.length, c: reg ? reg[1] : S.movieRegion });
    }
    return radar.state === 'loading' ? t('radarProgress', { n: radar.done, m: radar.total }) : t('radarDone', { n: radar.shows.filter(calVisible).length }) + (radar.ended || radar.quiet || radar.unmatched ? ' · ' + t('radarSkipped', { e: radar.ended + radar.quiet, u: radar.unmatched }) : '');
  };
  const pickRegion = () => gradSheet(openModal(sheetHeader(t('movieCountry'), t('movieCountryNote')) + '<div class="optlist">' +
    REGIONS.map((r) => optionRow('rg-' + r[0], r[1], [r[0]], S.movieRegion === r[0], A(() => { closeModal(true); S.movieRegion = r[0]; store.set('movieRegion', r[0]); movies = { state: 'idle', list: [] }; loadMovies(); rebuild(); draw('calregion'); }))).join('') + '</div>', 'rg-' + S.movieRegion));
  /* Week: seven columns from today (or the next seven days), each episode as a picture card. */
  let weekOff = 0;
  const drawWeek = (focusKey) => {
    const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() + weekOff * 7);
    const days = [];
    for (let i = 0; i < 7; i++) { const d = new Date(start); d.setDate(start.getDate() + i); days.push(d); }
    const label = days[0].toLocaleDateString(lang().locale, { day: 'numeric', month: 'short' }) + ' – ' + days[6].toLocaleDateString(lang().locale, { day: 'numeric', month: 'short' });
    const nav = '<div class="monthnav">' +
      '<button type="button" class="btn small icon f" data-key="wprev" aria-label="' + esc(t('prevWeek')) + '" data-act="' + A(() => { weekOff--; draw('wprev'); }) + '">' + ICON.back + '</button>' +
      '<span class="mname">' + esc(label) + '</span>' +
      '<button type="button" class="btn small icon f" data-key="wnext" aria-label="' + esc(t('nextWeek')) + '" data-act="' + A(() => { weekOff++; draw('wnext'); }) + '">' + ICON.next + '</button></div>';
    let firstKey = null;
    const cols = days.map((d, ci) => {
      const k = dayKey(d);
      const list = (byDay.get(k) || []).slice().sort((p, q) => Date.parse(p.ep.airstamp) - Date.parse(q.ep.airstamp));
      const today = k === todayKey;
      const head = today ? t('today') : d.toLocaleDateString(lang().locale, { weekday: 'short' });
      return '<div class="wcol"><div class="whead"><b class="' + (today ? 'today' : '') + '">' + esc(head) + '</b><span>' + esc(d.toLocaleDateString(lang().locale, { day: 'numeric', month: 'short' })) + '</span></div>' +
        (list.length ? list.map((x, i) => {
          const key = 'wk-' + ci + '-' + i;
          if (!firstKey) firstKey = key;
          const art = imgURL(x.show.plex.art || x.show.plex.thumb, 480, 270);
          return '<div class="wcard f" data-key="' + key + '" data-act="' + A(() => openX(x)) + '"><div class="wimg">' + (art ? '<img loading="lazy" src="' + esc(art) + '" alt="">' : '') + epTag(x, new Date(x.ep.airstamp)) + '</div>' +
            '<b>' + esc(x.show.plex.title) + '</b><span>' + esc(epLine(x)) + '</span></div>';
        }).join('') : '<span class="wnone">–</span>') + '</div>';
    }).join('');
    render('<div class="screen cal">' + calTop(nav) + '<div class="calstatus">' + esc(statusLine()) + '</div><div class="scroll hide-scroll"><div class="weekgrid">' + cols + '</div></div></div>');
    initFocus(focusKey || firstKey || 'cv-week');
  };
  /* List: everything coming up in the next two months, grouped by day; the selected episode is shown big on the right. */
  const drawList = (focusKey) => {
    const from = new Date(); from.setHours(0, 0, 0, 0);
    const to = from.getTime() + (S.calMode === 'movies' ? 150 : 62) * 86400000;
    const all = [];
    byDay.forEach((list, k) => list.forEach((x) => { const tt = Date.parse(x.ep.airstamp); if (tt >= from.getTime() && tt < to) all.push(x); }));
    all.sort((p, q) => Date.parse(p.ep.airstamp) - Date.parse(q.ep.airstamp));
    let lastK = '', html = '', firstKey = null;
    all.forEach((x, i) => {
      const d = new Date(x.ep.airstamp);
      const k = dayKey(d);
      if (k !== lastK) { lastK = k; html += '<span class="lhead' + (k === todayKey ? ' today' : '') + '">' + esc((k === todayKey ? t('today') + ' · ' : '') + d.toLocaleDateString(lang().locale, { weekday: 'long', day: 'numeric', month: 'long' })) + '</span>'; }
      const key = 'ag-' + i;
      if (!firstKey) firstKey = key;
      const th = imgURL(x.show.plex.art || x.show.plex.thumb, 400, 225);
      html += '<div class="agrow f" data-key="' + key + '" data-act="' + A(() => openX(x)) + '" data-onfocus="' + A(() => agPanel(x)) + '">' + (th ? '<img loading="lazy" src="' + esc(th) + '" alt="">' : '<span class="ph"></span>') +
        '<span class="agt"><b>' + esc(x.show.plex.title) + '</b><span>' + esc(epLine(x)) + '</span></span>' + epTag(x, d) + '</div>';
    });
    render('<div class="screen cal">' + calTop('') + '<div class="calstatus">' + esc(statusLine()) + '</div><div class="agwrap"><div class="aglist scroll hide-scroll">' + (html || '<div class="empty">' + esc(t('nothingScheduled')) + '</div>') + '</div><article class="dp" id="agp"></article></div></div>');
    if (all.length) agPanel(all[0]);
    initFocus(focusKey || firstKey || 'cv-list');
  };
  function agPanel(x) {
    const dp = $('#agp');
    if (!dp) return;
    const art = imgURL(x.show.plex.art, 1200, 675);
    const d = new Date(x.ep.airstamp);
    const when = (dayKey(d) === todayKey ? t('today') : d.toLocaleDateString(lang().locale, { weekday: 'long', day: 'numeric', month: 'long' })) + (String(x.ep.airstamp).length > 10 ? ' · ' + hhmm(d) : '');
    dp.innerHTML = '<div class="dpart">' + (art ? '<img src="' + esc(art) + '" alt="">' : '') + '</div>' +
      '<div class="dpin"><span class="eyebrow agwhen">' + esc(when + (x.ep.owned ? ' · ' + t('inLibrary') : x.movie ? ' · ' + t('inCinemas') : '')) + '</span><h2>' + esc(x.show.plex.title) + '</h2>' +
      '<div class="dmeta small"><span>' + esc(epLine(x)) + '</span></div>' + (x.ep.summary ? '<p>' + esc(x.ep.summary) + '</p>' : '') + '</div>';
  }
  const draw = (focusKey) => (S.calView === 'month' ? drawMonth(focusKey) : S.calView === 'list' ? drawList(focusKey) : drawWeek(focusKey));
  draw();
}

/* ---------- library (Movies, TV Shows and collections) ---------- */
const SORT_FIELDS = {
  added: (x) => x.addedAt || 0,
  title: (x) => fold(x.titleSort || x.title || '').trim(),
  released: (x) => x.originallyAvailableAt || String(x.year || ''),
  rating: (x) => Number(x.audienceRating || x.rating || 0),
  watched: (x) => x.lastViewedAt || 0
};
function sortItems(items, s) {
  const f = SORT_FIELDS[s.id] || SORT_FIELDS.added;
  const out = items.slice().sort((a, b) => { const va = f(a), vb = f(b); return va < vb ? -1 : va > vb ? 1 : 0; });
  return s.dir === 'desc' ? out.reverse() : out;
}
function resOf(it) {
  const r = String((it.Media && it.Media[0] && it.Media[0].videoResolution) || '').toLowerCase();
  if (r === '4k') return '4k';
  if (r === '1080') return '1080';
  if (r === '720') return '720';
  return r ? 'sd' : '';
}
function watchState(it) {
  if (it.type === 'show' || it.type === 'season') {
    if (!it.viewedLeafCount) return 'unwatched';
    return it.viewedLeafCount >= it.leafCount ? 'watched' : 'progress';
  }
  if (it.viewOffset) return 'progress';
  return it.viewCount ? 'watched' : 'unwatched';
}
function fold(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
function filterItems(items, fl, q) {
  const qq = fold(q).trim();
  return items.filter((it) => {
    if (fl.watch !== 'all' && watchState(it) !== fl.watch) return false;
    if (fl.res !== 'any' && resOf(it) !== fl.res) return false;
    if (fl.genre && !(it.Genre || []).some((g) => g.tag === fl.genre)) return false;
    if (qq && !fold(it.title).includes(qq) && !fold(it.originalTitle).includes(qq)) return false;
    return true;
  });
}
const WATCH_OPTS = [['all', 'fAll'], ['unwatched', 'fUnwatched'], ['progress', 'fProgress'], ['watched', 'fWatched']];
const RES_OPTS = [['any', 'fAny'], ['4k', '4K'], ['1080', '1080P'], ['720', '720P'], ['sd', 'SD']];

async function viewLibrary(sec, coll, opts) {
  opts = opts || {};
  const seq = viewSeq;
  const title = coll ? coll.title : sec.title;
  const crumb = coll ? sec.title : t('home');
  const isShow = sec.type === 'show';
  render('<div class="screen"><div class="top"><div class="htitle"><button type="button" class="crumb f" data-key="crumb" data-act="' + A(back) + '">' + ICON.back + esc(crumb) + '</button><h1>' + esc(title) + '</h1></div>' + clockHTML() + '</div><div class="empty">' + esc(t('loading')) + '</div></div>');
  const res = coll
    ? await api('/library/collections/' + coll.ratingKey + '/children', { 'X-Plex-Container-Start': 0, 'X-Plex-Container-Size': 10000 })
    : await api('/library/sections/' + sec.key + '/all', { sort: 'addedAt:desc', 'X-Plex-Container-Start': 0, 'X-Plex-Container-Size': 10000 });
  if (seq !== viewSeq) return;
  const items = res.Metadata || [];
  /* shared universes (the Arrowverse) appear as a series of their own */
  if (isShow && !coll && typeof woLibraryItems === 'function') woLibraryItems(sec, items).forEach((x) => items.push(x));
  const sortKey = 'sort3.' + (coll ? 'c' + coll.ratingKey : sec.key);
  const st = {
    sort: store.get(sortKey, coll ? { id: 'released', dir: 'asc' } : { id: 'added', dir: 'desc' }),
    fl: { watch: 'all', res: 'any', genre: '' },
    /* each library (Movies, TV Shows…) remembers its own view */
    view: store.get('libView.' + sec.key, S.libView),
    q: '',
    searching: !!opts.search
  };
  const genres = (() => {
    const counts = new Map();
    items.forEach((it) => (it.Genre || []).forEach((g) => counts.set(g.tag, (counts.get(g.tag) || 0) + 1)));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
  })();
  const sortLabel = () => {
    const s = SORTS.find((x) => x.id === st.sort.id) || SORTS[0];
    return t(s.label) + (st.sort.dir === 'desc' ? ' ↓' : ' ↑');
  };
  const activeFilters = () => {
    const out = [];
    if (st.fl.watch !== 'all') out.push(['watch', t((WATCH_OPTS.find((w) => w[0] === st.fl.watch) || [])[1])]);
    if (st.fl.res !== 'any') out.push(['res', (RES_OPTS.find((r) => r[0] === st.fl.res) || [])[1]]);
    if (st.fl.genre) out.push(['genre', st.fl.genre]);
    return out;
  };
  const list = () => filterItems(sortItems(items, st.sort), st.fl, st.q);
  const open = (it) => (it.type === 'collection' ? go(viewLibrary, [sec, it]) : openItem(it));

  keyHandler = (e) => {
    if (modalOpen()) return false;
    const inBody = focused && !focused.closest('.libtop');
    const toTools = () => { const b = $('.ltools [data-key="sort"]') || $('.ltools .f'); if (b) setFocus(b, true); };
    /* Back from the titles goes up to the toolbar first; Back from the toolbar leaves */
    if (e.key === 'Escape' && focused && focused.id === 'q') { activate(focused); return true; }
    if ((e.key === 'Escape' || (e.key === 'Backspace' && !st.searching)) && inBody) { toTools(); return true; }
    /* on-screen keyboard: left/right stay on the same row of keys */
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && focused && focused.classList.contains('kkey')) {
      const row = $$('.kgrid .kkey', viewEl).filter((k) => k.offsetTop === focused.offsetTop);
      const i = row.indexOf(focused) + (e.key === 'ArrowRight' ? 1 : -1);
      if (row[i]) setFocus(row[i]);
      return true;
    }
    if (focused && focused.classList.contains('azwheel')) {
      if (e.key === 'ArrowUp') { azStep(-1); return true; }
      if (e.key === 'ArrowDown') { azStep(1); return true; }
      if (e.key === 'ArrowLeft') { activate(focused); return true; }
      if (e.key === 'ArrowRight') return true;
    }
    if (e.key === 'ArrowRight' && inBody && focused.closest('#lib') && $('.azwheel', viewEl)) {
      const was = focused;
      move('r');
      if (focused === was || focused.classList.contains('azwheel')) {
        const it = list().find((x) => 'i-' + x.ratingKey === was.dataset.key);
        if (it) azTurn(AZ.indexOf(azLetter(it)));
        setFocus($('.azwheel', viewEl));
      }
      return true;
    }
    /* Left past the first title in a row goes to the toolbar, not to the "‹ Home" button */
    if (e.key === 'ArrowLeft' && inBody && focused.closest('#lib')) {
      const was = focused;
      move('l');
      if (focused === was || !focused.closest('#lib')) toTools();
      return true;
    }
    if (!st.searching || (document.activeElement && document.activeElement.tagName === 'INPUT')) return false;
    if (e.key && e.key.length === 1 && /[\p{L}\p{N} ]/u.test(e.key)) { typeQ(st.q + e.key.toLowerCase()); return true; }
    if (e.key === 'Backspace' && st.q) { typeQ(st.q.slice(0, -1)); return true; }
    return false;
  };
  function drawAll(focusKey) {
    const v = st.view;
    const views = [['box', t('boxArt')], ['boxl', t('boxArtLarge')], ['list', t('list')], ['detailed', t('detailed')], ['fanart', t('fanart')]];
    const nf = activeFilters().length;
    const viewName = (views.find((o) => o[0] === v) || views[0])[1];
    render('<div class="screen">' +
      '<div class="top libtop"><div class="htitle"><button type="button" class="crumb f" data-key="crumb" data-nav-r="search" data-act="' + A(back) + '">' + ICON.back + esc(crumb) + '</button><h1>' + esc(title) + '</h1></div>' +
      '<span class="count" id="libcount"></span>' +
      '<div class="ltools" data-nav-l="crumb">' +
      '<button type="button" class="tbtn icon f" data-key="search" aria-label="' + esc(t('search')) + '" data-act="' + A(toggleSearch) + '">' + ICON.search + '</button>' +
      '<button type="button" class="tbtn f" data-key="filter" data-act="' + A(openFilter) + '">' + ICON.filter + esc(t('filter')) + (nf ? '<span class="count-badge">' + nf + '</span>' : '') + '</button>' +
      '<button type="button" class="tbtn f" data-key="sort" data-act="' + A(openSort) + '">' + esc(sortLabel()) + '</button>' +
      '<button type="button" class="tbtn f" data-key="view" data-act="' + A(pickView) + '">' + (v === 'list' || v === 'detailed' ? ICON.lines : ICON.grid) + esc(viewName) + '</button>' +
      (!coll ? '<button type="button" class="tbtn f" data-key="colls" data-act="' + A(() => go(viewCollections, [sec])) + '">' + ICON.stack + esc(t('collections')) + '</button>' : '') +
      '</div>' + clockHTML(false, 'margin-left: 24px') + '</div>' +
      '<div class="subbar">' +
      (st.searching ? searchPanelHTML() : '') +
      activeFilters().map((f) => '<button type="button" class="chip f" data-key="chip-' + f[0] + '" data-act="' + A(() => { if (f[0] === 'watch') st.fl.watch = 'all'; if (f[0] === 'res') st.fl.res = 'any'; if (f[0] === 'genre') st.fl.genre = ''; drawAll('filter'); }) + '">' + esc(f[1]) + ICON.x + '</button>').join('') +
      '</div>' +
      '<div class="libbody" id="lib"></div></div>');
    function pickView() {
      gradSheet(openModal(sheetHeader(t('view'), '') + '<div class="optlist">' + views.map((o) => optionRow('pv-' + o[0], o[1], [], v === o[0], A(() => { st.view = o[0]; store.set('libView.' + sec.key, o[0]); closeModal(true); drawAll('view'); }))).join('') + '</div>', 'pv-' + v));
    }
    const q = $('#q');
    if (q) {
      let lastLen = q.value.length, doneT = null;
      /* The TV's own keyboard pops up while the real text box is focused. Voice results arrive as a whole
         phrase at once, so when several letters land in one go (or the keyboard's Done/Cancel is pressed)
         the box is closed again and the keyboard goes away by itself. */
      const finishInput = () => {
        clearTimeout(doneT);
        if (q.hidden) return;
        q.blur(); q.hidden = true; q.classList.remove('f', 'focus');
        const sh = $('#qshow'); if (sh) { sh.hidden = false; sh.textContent = st.q; }
        const first = $('#lib .f');
        setFocus(first || $('.kkey.mic') || $('.kkey'), true);
      };
      q.addEventListener('input', () => {
        const jump = q.value.length - lastLen;
        lastLen = q.value.length;
        st.q = q.value; const sh = $('#qshow'); if (sh) sh.textContent = q.value; drawBody();
        /* typing happens on the app's own keyboard, so anything arriving here is voice: close the TV's
           keyboard (and its listening) as soon as the words stop coming */
        clearTimeout(doneT);
        doneT = setTimeout(finishInput, jump > 1 ? 350 : 900);
      });
      q.addEventListener('keydown', (e) => {
        /* Samsung keyboard: 65376 = Done, 65385 = Cancel */
        if (e.keyCode === 65376 || e.keyCode === 65385) { e.preventDefault(); e.stopPropagation(); finishInput(); }
      });
      q.dataset.act = A(finishInput);
    }
    drawBody(focusKey);
  }
  function drawBody(focusKey) {
    const v = st.view;
    const l = list();
    $('#libcount').textContent = (l.length === items.length ? '' : t('showingOf', { n: l.length, m: items.length }) + ' · ') + (isShow ? t('nShows', { n: items.length }) : t('nMovies', { n: items.length }));
    const lib = $('#lib');
    if (!l.length) { lib.innerHTML = '<div class="empty">' + esc(items.length ? t('noMatches') : t('emptyLib')) + '</div>'; finishFocus(focusKey); return; }
    const key = (it) => 'i-' + it.ratingKey;
    if (v === 'list') {
      /* List: one big line per title; the selected one opens up with its poster and summary underneath. */
      lib.innerHTML = '<div class="scroll hide-scroll"><div class="llist">' + l.map((it) => '<div class="lrow f" data-key="' + key(it) + '" data-act="' + A(() => open(it)) + '" data-ctx="' + A(() => itemMenu(it)) + '" data-onfocus="' + A((el) => listOpen(el, it)) + '">' +
        '<div class="lmain"><span class="tt">' + esc(it.title) + '</span><span class="ly">' + esc(it.year || '') + '</span>' +
        '<span class="lg">' + esc((it.Genre && it.Genre[0] && it.Genre[0].tag) || '') + '</span>' +
        '<span class="ld">' + esc(isShow ? seasonsText(it.childCount) : durText(it.duration)) + '</span>' +
        '<span class="rt">' + ((it.audienceRating || it.rating) ? ICON.star + esc(Number(it.audienceRating || it.rating).toFixed(1)) : '') + '</span>' +
        '<span class="tags">' + tagsHTML(mediaTags(it).slice(0, 3)) + '</span></div><div class="lx"></div></div>').join('') + '</div></div>';
    } else if (v === 'detailed') {
      lib.innerHTML = '<div class="dl"><div class="dllist scroll hide-scroll">' + l.map((it) => {
        return '<div class="dlrow big f" data-key="' + key(it) + '" data-act="' + A(() => open(it)) + '" data-ctx="' + A(() => itemMenu(it)) + '" data-onfocus="' + A(() => detailPanel(it)) + '">' +
          '<span class="dtx"><span class="dt">' + esc(it.title) + '</span><span class="dsub">' + esc([it.year, isShow ? seasonsText(it.childCount) : durText(it.duration)].filter(Boolean).join(' · ')) + '</span></span>' +
          '<span class="tags">' + tagsHTML(mediaTags(it).slice(0, 2)) + '</span></div>';
      }).join('') + '</div><article class="dp" id="dp"></article></div>';
      /* Show the first title in the panel straight away so the view never opens empty. */
      detailPanel(l[0]);
      azRail(l);
      if (!focusKey && (!focused || !document.contains(focused))) { const first = $('.dlrow', lib); if (first) { setFocus(first, true); return; } }
    } else if (v === 'fanart') {
      lib.innerHTML = '<div class="scroll hide-scroll"><div class="grid3">' + l.map((it) => {
        const art = imgURL(it.art || it.thumb, 720, 405);
        return '<div class="card wide f" data-key="' + key(it) + '" data-act="' + A(() => open(it)) + '" data-ctx="' + A(() => itemMenu(it)) + '">' +
          '<div class="fimg">' + (art ? '<img class="img" loading="lazy" src="' + esc(art) + '" alt="">' : '<div class="img"></div>') +
          (!it.virtual && (it.type === 'movie' || it.type === 'show') ? '<div class="flogo" data-logo-lazy="' + esc(it.ratingKey) + '"></div>' : '') + '</div>' +
          '<div class="wrow"><span class="t">' + esc(it.title) + '</span><span class="tags">' + tagsHTML(mediaTags(it).slice(0, 2)) + '</span></div>' +
          '<div class="s">' + esc(itemSub(it)) + '</div></div>';
      }).join('') + '</div></div>';
    } else {
      lib.innerHTML = '<div class="scroll hide-scroll"><div class="grid10' + (v === 'boxl' ? ' large' : '') + '">' + l.map((it) => cardHTML(it, key(it), A(() => open(it)), { tags: mediaTags(it).slice(0, 2), sub: it.type === 'collection' ? (it.childCount || '') + '' : null })).join('') + '</div></div>';
    }
    azRail(l);
    finishFocus(focusKey);
  }
  /* sorted by title: an A–Z rail on the right. Moving over a letter scrolls the titles there; OK or Left jumps in. */
  const azLetter = (it) => { const c = fold(it.titleSort || it.title || '').trim().charAt(0); return /[a-z]/.test(c) ? c : '#'; };
  function azTarget(letter) {
    const l = list();
    const order = '#abcdefghijklmnopqrstuvwxyz';
    let it = l.find((x) => azLetter(x) === letter);
    if (!it) {
      /* nothing on that letter: the next one that has titles */
      const want = order.indexOf(letter);
      it = (st.sort.dir === 'desc' ? l.slice().reverse() : l).find((x) => order.indexOf(azLetter(x)) >= want) || l[l.length - 1];
    }
    return it ? $('[data-key="i-' + it.ratingKey + '"]', viewEl) : null;
  }
  /* the A–Z wheel: one control; Up/Down turn it (it wraps around Z → # → A), the letter in the middle is the chosen one */
  const AZ = '#abcdefghijklmnopqrstuvwxyz'.split('');
  let azIdx = 0, azHave = new Set();
  function azRail(l) {
    const lib = $('#lib');
    if (!lib) return;
    const old = $('.azrail', lib); if (old) old.remove();
    const on = st.sort.id === 'title' && l.length > 24;
    lib.classList.toggle('hasaz', on);
    if (!on) return;
    azHave = new Set(l.map(azLetter));
    lib.insertAdjacentHTML('beforeend', '<div class="azrail"><button type="button" class="azwheel f" data-key="az" aria-label="A–Z" data-act="' + A(() => { const tg = azTarget(AZ[azIdx]); if (tg) setFocus(tg); }) + '">' +
      AZ.map((c, i) => '<span class="azl' + (azHave.has(c) ? '' : ' none') + '" data-i="' + i + '">' + (c === '#' ? '#' : c.toUpperCase()) + '</span>').join('') + '</button></div>');
    azTurn(azIdx, true);
  }
  function azTurn(idx, instant) {
    azIdx = (idx + AZ.length) % AZ.length;
    const wheel = $('.azwheel', viewEl);
    if (!wheel) return;
    const half = Math.floor(AZ.length / 2);
    $$('.azl', wheel).forEach((el) => {
      const i = +el.dataset.i;
      let off = i - azIdx;
      if (off > half) off -= AZ.length;
      if (off < -half) off += AZ.length;
      const prev = el.dataset.off == null ? off : +el.dataset.off;
      el.dataset.off = off;
      const d = Math.abs(off);
      /* a letter that wraps from one end to the other jumps instead of sliding across */
      el.classList.toggle('jump', !!instant || Math.abs(off - prev) > 1);
      el.className = el.className.replace(/ ?d\d+/g, '') + ' d' + Math.min(d, 8);
      const y = off === 0 ? 0 : Math.sign(off) * (48 + (d - 1) * 40);
      el.style.transform = 'translateY(' + y + 'px)';
    });
  }
  function azStep(dir) {
    azTurn(azIdx + dir);
    const tg = azTarget(AZ[azIdx]);
    if (tg) scrollToCenter(tg);
  }
  function finishFocus(focusKey) {
    if (focusKey) { initFocus(focusKey); return; }
    if (!focused || !document.contains(focused)) {
      const first = !current.focusKey && !st.searching && $('#lib .f');
      if (first) setFocus(first, true); else initFocus(st.searching && !current.focusKey ? 'k-a' : null);
    }
  }
  function listOpen(el, it) {
    $$('.lrow .lx', viewEl).forEach((x) => { if (x.parentNode !== el) x.innerHTML = ''; });
    const x = $('.lx', el);
    if (!x || x.innerHTML) return;
    const th = imgURL(it.thumb, 240, 360);
    x.innerHTML = (th ? '<img class="lp" src="' + esc(th) + '" alt="">' : '<div class="lp"></div>') +
      '<div class="lxt"><div class="ratings small">' + ratingsHTML(it) + '</div>' + (it.summary ? '<p>' + esc(it.summary) + '</p>' : '') + '</div>' +
      '<div class="lxc credits" data-rk="' + esc(it.ratingKey) + '"></div>';
    fillCredits($('.credits', x), it);
  }
  function detailPanel(it) {
    const dp = $('#dp');
    if (!dp) return;
    const art = imgURL(it.art, 1200, 675);
    const meta = [it.year, (it.Genre || []).slice(0, 2).map((g) => g.tag).join(', '), isShow ? seasonsText(it.childCount) : durText(it.duration), it.contentRating].filter(Boolean);
    dp.innerHTML = '<div class="dpart">' + (art ? '<img src="' + esc(art) + '" alt="">' : '') + '</div>' +
      '<div class="dpin"><h2>' + esc(it.title) + '</h2><div class="dmeta small">' + meta.map((x) => '<span>' + esc(x) + '</span>').join('<span aria-hidden="true">·</span>') + '</div>' +
      '<div class="ratings small">' + ratingsHTML(it) + '<div class="tags">' + tagsHTML(mediaTags(it)) + '</div></div>' +
      (it.summary ? '<p>' + esc(it.summary) + '</p>' : '') + '<div class="dpc credits" data-rk="' + esc(it.ratingKey) + '"></div></div>';
    fillCredits($('.credits', dp), it);
  }
  /* Voice search: the browser's speech recognition here; on the TV this becomes the Samsung voice input. */
  function voice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast(t('voiceUnavailable'), 6000); return; }
    const rec = new SR();
    rec.lang = lang().locale;
    rec.interimResults = true;
    const q = $('#q');
    const mic = $('[data-key="mic"]', viewEl);
    if (mic) mic.classList.add('listening');
    if (q) q.placeholder = t('listening');
    rec.onresult = (e) => {
      const text = Array.from(e.results).map((r) => r[0].transcript).join('');
      typeQ(text);
    };
    rec.onerror = (e) => { toast(e.error === 'not-allowed' ? t('micBlocked') : t('voiceUnavailable'), 6000); };
    rec.onend = () => { if (mic && document.contains(mic)) mic.classList.remove('listening'); if (q && document.contains(q)) q.placeholder = t('searchIn', { s: title }); };
    try { rec.start(); } catch (e) { toast(t('voiceUnavailable'), 6000); }
  }
  function toggleSearch() {
    st.searching = !st.searching;
    if (!st.searching) st.q = '';
    drawAll(st.searching ? 'k-a' : 'search');
  }
  /* Search like the YouTube TV app: an on-screen keyboard types into the search line. The microphone key
     opens the TV's own text field, where the remote's voice button can be used to dictate. */
  function searchPanelHTML() {
    const keys = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');
    const key = (k, label, cls, fn) => '<button type="button" class="kkey f' + (cls ? ' ' + cls : '') + '" data-key="k-' + k + '" data-act="' + A(fn) + '">' + label + '</button>';
    return '<div class="spanel"><div class="sline"><span class="sicon">' + ICON.search + '</span><span id="qshow" class="' + (st.q ? '' : 'ph') + '">' + esc(st.q || t('searchIn', { s: title })) + '</span>' +
      '<input class="input" id="q" type="text" spellcheck="false" autocomplete="off" value="' + esc(st.q) + '" hidden></div>' +
      '<div class="kgrid">' + keys.map((k) => key(k, k.toUpperCase(), '', () => typeQ(st.q + k))).join('') +
      key('space', esc(t('kSpace')), 'wide', () => typeQ(st.q + ' ')) +
      key('del', '⌫', 'wide', () => typeQ(st.q.slice(0, -1))) +
      key('clear', esc(t('kClear')), 'wide', () => typeQ('')) +
      key('mic', ICON.mic + '<span>' + esc(t('voiceSearch')) + '</span>', 'wide mic', voiceOrType) + '</div></div>';
  }
  function typeQ(v) {
    st.q = v;
    const sh = $('#qshow');
    if (sh) { sh.textContent = v || t('searchIn', { s: title }); sh.className = v ? '' : 'ph'; }
    const q = $('#q');
    if (q && q.value !== v) q.value = v;
    drawBody();
  }
  function voiceOrType() {
    if (!window.IS_TV && (window.SpeechRecognition || window.webkitSpeechRecognition)) return voice();
    const q = $('#q');
    if (!q) return;
    q.hidden = false;
    $('#qshow').hidden = true;
    q.classList.add('f');
    q.dataset.key = 'q';
    setFocus(q, true);
    /* nothing said within 12 seconds: close the TV's keyboard again */
    clearTimeout(st.voiceT);
    st.voiceT = setTimeout(() => { if (!q.hidden) activate(q); }, 12000);
  }
  function openFilter() {
    const draw = (prefer) => openModal(sheetHeader(t('filter'), title) +
      '<span class="label">' + esc(t('fShow')) + '</span><div class="chips">' + WATCH_OPTS.map((w) => chipHTML('fw-' + w[0], t(w[1]), st.fl.watch === w[0], () => { st.fl.watch = w[0]; draw('fw-' + w[0]); })).join('') + '</div>' +
      '<span class="label">' + esc(t('quality')) + '</span><div class="chips">' + RES_OPTS.map((r) => chipHTML('fr-' + r[0], r[0] === 'any' ? t(r[1]) : r[1], st.fl.res === r[0], () => { st.fl.res = r[0]; draw('fr-' + r[0]); })).join('') + '</div>' +
      (genres.length ? '<span class="label">' + esc(t('genre')) + '</span><div class="chips">' + chipHTML('fg-', t('fAny'), !st.fl.genre, () => { st.fl.genre = ''; draw('fg-'); }) +
        genres.map((g, i) => chipHTML('fg-' + i, g, st.fl.genre === g, () => { st.fl.genre = g; draw('fg-' + i); })).join('') + '</div>' : '') +
      '<button type="button" class="btn primary f" data-key="fdone" data-act="' + A(() => { closeModal(true); drawAll('filter'); }) + '">' + esc(t('showResults', { n: list().length })) + '</button>', prefer);
    draw('fw-' + st.fl.watch);
  }
  /* Sorting applies as soon as an option is chosen; the list updates behind the panel. */
  function openSort() {
    const apply = () => {
      store.set(sortKey, st.sort);
      drawBody();
      const b = $('[data-key="sort"]', viewEl);
      if (b) b.innerHTML = ICON.sort + esc(sortLabel());
    };
    const draw = (prefer) => gradSheet(openModal(sheetHeader(t('sort'), title) +
      '<div class="optlist">' + SORTS.map((s) => optionRow('so-' + s.id, t(s.label), [], s.id === st.sort.id, A(() => { st.sort = { id: s.id, dir: s.id === st.sort.id ? st.sort.dir : (s.id === 'title' ? 'asc' : 'desc') }; apply(); draw('so-' + s.id); }))).join('') + '</div>' +
      '<span class="label">' + esc(t('direction')) + '</span>' +
      '<button type="button" class="btn f" data-key="dir" data-act="' + A(() => { st.sort.dir = st.sort.dir === 'asc' ? 'desc' : 'asc'; apply(); draw('dir'); }) + '">' +
      esc(st.sort.dir === 'asc' ? t('ascending') + ' ↑' : t('descending') + ' ↓') + '</button>', prefer));
    draw('so-' + st.sort.id);
  }
  drawAll();
}
function chipHTML(key, label, on, fn) {
  return '<button type="button" class="chip f' + (on ? ' on' : '') + '" data-key="' + esc(key) + '" data-act="' + A(fn) + '">' + (on ? ICON.check : '') + esc(label) + '</button>';
}
async function viewCollections(sec) {
  render('<div class="screen"><div class="top"><div class="htitle"><button type="button" class="crumb f" data-key="crumb" data-act="' + A(back) + '">' + ICON.back + esc(sec.title) + '</button><h1>' + esc(t('collections')) + '</h1></div>' + clockHTML() + '</div><div class="empty">' + esc(t('loading')) + '</div></div>');
  const res = await api('/library/sections/' + sec.key + '/collections', { 'X-Plex-Container-Start': 0, 'X-Plex-Container-Size': 2000 });
  const cols = res.Metadata || [];
  render('<div class="screen"><div class="top"><div class="htitle"><button type="button" class="crumb f" data-key="crumb" data-act="' + A(back) + '">' + ICON.back + esc(sec.title) + '</button><h1>' + esc(t('collections')) + '</h1></div>' +
    '<span class="count">' + esc(t('nCollections', { n: cols.length })) + '</span>' + '<div style="margin-left: auto"></div>' + clockHTML(false, 'margin-left: 28px') + '</div>' +
    '<div class="scroll hide-scroll">' + (cols.length ? '<div class="grid10">' + cols.map((c) => cardHTML(c, 'c-' + c.ratingKey, A(() => go(viewLibrary, [sec, c])), { sub: t('nTitles', { n: c.childCount || 0 }), ctx: A(() => collMenu(c, sec)) })).join('') + '</div>' : '<div class="empty">' + esc(t('noCollections')) + '</div>') + '</div></div>');
  initFocus();
}

/* ---------- details ---------- */
/* Every rating source the server has for the title (IMDb, Rotten Tomatoes critics and audience, TMDB, TVDB),
   instead of the single one the library agent happens to pick. */
function ratingsHTML(m) {
  const out = [];
  const seen = new Set();
  const add = (label, val) => { if (val != null && val !== '' && !seen.has(label)) { seen.add(label); out.push([label, val]); } };
  const source = (img) => (/imdb/.test(img) ? 'IMDB' : /rottentomatoes/.test(img) ? 'RT' : /themoviedb|tmdb/.test(img) ? 'TMDB' : /tvdb/.test(img) ? 'TVDB' : '');
  const fmt = (val, src) => (src === 'RT' ? Math.round(Number(val) * 10) + '%' : Number(val).toFixed(1));
  (m.Rating || []).forEach((r) => {
    const src = source(r.image || '');
    const label = src === 'RT' || !src ? (r.type === 'critic' ? t('critics') : t('audienceL')) : src;
    add(label, fmt(r.value, src));
  });
  if (m.audienceRating != null) { const s = source(m.audienceRatingImage || ''); add(s && s !== 'RT' ? s : t('audienceL'), fmt(m.audienceRating, s)); }
  if (m.rating != null) { const s = source(m.ratingImage || ''); add(s && s !== 'RT' ? s : t('critics'), fmt(m.rating, s)); }
  return out.map((p) => '<div class="r"><span>' + esc(p[0]) + '</span><b>' + esc(p[1]) + '</b></div>').join('');
}
/* Full-screen cast and crew page, opened on top of the current screen. */
function castSheet(roles, title, ctx, beforeGo) {
  openModal('<div class="fullhead"><div class="htitle"><button type="button" class="crumb f" data-key="crumb" data-act="' + A(() => closeModal()) + '">' + ICON.back + esc(title) + '</button><h1>' + esc(t('allCast')) + '</h1></div>' + clockHTML() + '</div>' +
    '<div class="castgrid">' + roles.map((p, i) =>
      '<div class="face f" data-key="cp-' + i + '" data-act="' + A(() => { closeModal(true); if (beforeGo) beforeGo(i); go(viewPerson, [p.tag, p.thumb, Object.assign({}, ctx || {}, { kind: p.k }), title]); }) + '">' +
      (p.thumb ? '<img class="img" loading="lazy" src="' + esc(imgURL(p.thumb, 400, 400)) + '" alt="">' : '<div class="img"></div>') +
      '<b>' + esc(p.tag) + '</b><span>' + esc(p.role || p.kind || '') + '</span></div>').join('') + '</div>', null, true);
  tickClock();
}
function crewOf(m) {
  return (m.Role || []).map((r) => ({ tag: r.tag, role: r.role, thumb: r.thumb }))
    .concat((m.Director || []).map((r) => ({ tag: r.tag, kind: t('director'), k: 'director', thumb: r.thumb })))
    .concat((m.Writer || []).map((r) => ({ tag: r.tag, kind: t('writer'), k: 'writer', thumb: r.thumb })))
    .concat((m.Producer || []).map((r) => ({ tag: r.tag, kind: t('producer'), k: 'producer', thumb: r.thumb })));
}
/* Which TMDB title a Plex item is, so the right person is found when names are shared. */
function personCtx(m) {
  if (m.type === 'episode') return { type: 'tv', id: 0, show: m.grandparentRatingKey };
  return { type: m.type === 'show' ? 'tv' : 'movie', id: tmdbIdOf(m) };
}
/* ---------- subtitles picker (details page and player) ---------- */
/* Your five languages are grouped at the top, each with its own "Download" row;
   everything else on the file is listed below them. Downloads use the Plex server's
   own subtitle search (OpenSubtitles). */
function prefLangOrder() {
  const first = S.subLang !== 'app' ? S.subLang : S.lang;
  return [first].concat(LANGS.map((l) => l.code).filter((c) => c !== first));
}
function streamLang(s) {
  const code = String(s.languageCode || s.languageTag || '').toLowerCase();
  const l = LANGS.find((x) => x.plex.includes(code) || (code.length === 2 && x.code === code));
  if (l) return l.code;
  /* no language code on the stream: go by its name, in English or in the language itself */
  const nm = String(s.language || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const names = { en: ['english', 'engelska', 'anglictina'], sv: ['swedish', 'svenska', 'svedstina'], cs: ['czech', 'cestina', 'tjeckiska'], uk: ['ukrainian', 'украінська', 'украiнська', 'ukrainska'], el: ['greek', 'ελληνικα', 'grekiska'] };
  const hit = Object.keys(names).find((c) => names[c].includes(nm) || nm === LANGS.find((x) => x.code === c).name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  return hit || null;
}
/* The subtitle the app uses for a title: your own last choice for it, otherwise the first subtitle
   in your preferred subtitle language, otherwise whatever Plex has selected. */
function pickedSub(ratingKey, subs) {
  const saved = store.get('sub.' + ratingKey, null);
  if (saved === 0 || (saved && subs.some((s) => s.id === saved))) return saved;
  const pref = prefLangOrder()[0];
  const mine = subs.filter((s) => streamLang(s) === pref);
  const best = mine.find((s) => !s.forced && !s.hearingImpaired) || mine[0];
  return best ? best.id : 0;
}
/* Name of a subtitle in its own language ("Svenska", "English"), as in the language list. */
function subLangName(s) {
  const c = streamLang(s);
  const l = c && LANGS.find((x) => x.code === c);
  return l ? l.name : (s.language || s.displayTitle || t('subtitles'));
}
/* What the Subtitles button says: the chosen language, or just "Subtitles" when none is chosen
   (for example when the file only has subtitles in a language that is not your preferred one). */
function subButtonText(ratingKey, subs) {
  const cur = subs.find((s) => s.id === pickedSub(ratingKey, subs));
  return cur ? subLangName(cur) : t('subtitles');
}
/* No subtitle in your preferred language on the file and nothing chosen: the button goes straight
   to downloading one in your preferred language, with everything else below the results. */
function subNeedsGuide(ratingKey, subs) {
  const pref = prefLangOrder()[0];
  return pickedSub(ratingKey, subs) === 0 && store.get('sub.' + ratingKey, null) !== 0 && !subs.some((s) => streamLang(s) === pref);
}
/* Layout: Off · subtitles on the file in your five languages · Download · subtitles in other languages. */
function openSubPicker(o) {
  const order = prefLangOrder();
  const cur = pickedSub(o.ratingKey, o.subs);
  const rank = (s) => order.indexOf(streamLang(s));
  const choose = async (id, downloaded) => {
    store.set('sub.' + o.ratingKey, id);
    /* Subtitle files the app draws itself are not selected on the server, so the server's stream stays
       untouched; others (shown by the server) are selected there as usual. */
    const chosen = o.subs.find((x) => x.id === id);
    const ownDraw = S.subDraw && chosen && chosen.key && /^(srt|subrip|vtt|webvtt|ass|ssa)$/i.test(chosen.codec || '');
    try { await fetch(pmsURL('/library/parts/' + o.part.id, { subtitleStreamID: ownDraw ? 0 : id, allParts: 1 }), { method: 'PUT' }); } catch (e) { /* ignore */ }
    o.subs.forEach((s) => { s.selected = s.id === id; });
    closeModal(true);
    o.onChosen(id, !!downloaded);
  };
  const row = (s) => { const r = subRow(s); return optionRow('sp-' + s.id, r.name, r.tags, s.id === cur, A(() => choose(s.id)), r.sub); };
  const mine = o.subs.filter((s) => rank(s) >= 0).sort((a, b) => rank(a) - rank(b));
  const others = o.subs.filter((s) => rank(s) < 0);
  let html = sheetHeader(t('subtitles'), '') + '<div class="optlist">' + optionRow('sp-0', t('off'), [], cur === 0, A(() => choose(0))) + '</div>';
  if (mine.length) html += '<span class="label">' + esc(t('yourLangs')) + '</span><div class="optlist">' + mine.map(row).join('') + '</div>';
  html += '<div class="optlist"><div class="subrow dlrow-sub f" data-key="dl" data-act="' + A(pickDownloadLang) + '"><span class="chk">' + ICON.download + '</span><span class="lang">' + esc(t('downloadSubs')) + '<small>' + esc(t('downloadSubsNote')) + '</small></span></div></div>';
  if (others.length) html += '<span class="label">' + esc(t('otherLangs')) + '</span><div class="optlist">' + others.map(row).join('') + '</div>';
  if (o.second) pickDownloadLang();
  else if (o.guided) searchOnline(order[0]); else openModal(html, 'sp-' + cur);

  /* The rest of the choices, listed under the online results in guided mode. */
  function moreOptionsHTML() {
    return '<span class="label">' + esc(t('otherOptions')) + '</span><div class="optlist">' +
      optionRow('sp-0', t('off'), [], cur === 0, A(() => choose(0))) +
      mine.concat(others).map(row).join('') +
      '<div class="subrow dlrow-sub f" data-key="dl" data-act="' + A(pickDownloadLang) + '"><span class="chk">' + ICON.download + '</span><span class="lang">' + esc(t('downloadOther')) + '</span></div></div>';
  }

  function pickDownloadLang() {
    openModal(sheetHeader(t('downloadSubs'), '') + '<div class="optlist">' +
      order.map((code, i) => optionRow('dlang-' + code, LANGS.find((l) => l.code === code).name, i === 0 ? [t('preferred')] : [], i === 0, A(() => searchOnline(code)))).join('') + '</div>' +
      '<button type="button" class="btn f" data-key="spback" data-act="' + A(() => (o.second ? closeModal() : openSubPicker(Object.assign({}, o, { guided: false })))) + '">' + ICON.back + esc(t('back')) + '</button>', 'dlang-' + order[0]);
  }

  async function searchOnline(code) {
    const L = LANGS.find((l) => l.code === code);
    const guided = o.guided && code === order[0];
    const backBtn = guided ? moreOptionsHTML() : '<button type="button" class="btn f" data-key="spback" data-act="' + A(() => (o.second ? pickDownloadLang() : openSubPicker(Object.assign({}, o, { guided: false })))) + '">' + ICON.back + esc(t('back')) + '</button>';
    const backKey = guided ? 'dl' : 'spback';
    openModal(sheetHeader(t('searchOnline'), L.name) + '<div class="empty">' + esc(t('searching')) + '</div>' + (guided ? backBtn : ''), guided ? 'dl' : null);
    let res;
    try { res = (await api('/library/metadata/' + o.ratingKey + '/subtitles', { language: code, hearingImpaired: 0, forced: 0 })).Stream || []; } catch (e) { res = null; }
    if (res === null) { openModal(sheetHeader(t('searchOnline'), L.name) + '<p class="sheettext">' + esc(t('onlineFailed')) + '</p>' + backBtn, backKey); return; }
    if (!res.length) {
      openModal(sheetHeader(t('searchOnline'), L.name) + '<p class="sheettext"><b>' + esc(t('noSubsLang', { l: L.name })) + '</b></p>' +
        (code !== 'en' ? '<button type="button" class="btn primary f" data-key="tryen" data-act="' + A(() => searchOnline('en')) + '">' + esc(t('searchEnglish')) + '</button>' : '') + backBtn, code !== 'en' ? 'tryen' : backKey);
      return;
    }
    res.sort((a, b) => (b.score || 0) - (a.score || 0));
    const file = (o.part.file || '').split(/[\\/]/).pop().replace(/\.[^.]+$/, '').toLowerCase();
    openModal(sheetHeader(t('searchOnline'), L.name) + '<span class="label">' + esc(t('bestFirst')) + '</span><div class="optlist">' + res.map((r, i) => {
      const rel = r.title || r.displayTitle || L.name;
      const tags = [];
      if (file && rel.toLowerCase().replace(/\.[^.]+$/, '') === file) tags.push(t('matchesFile'));
      if (r.hearingImpaired) tags.push('HI/CC');
      sourceTags(rel).forEach((x) => tags.push(x));
      if (/2160p|4k/i.test(rel)) tags.push('4K'); else if (/1080p/i.test(rel)) tags.push('1080P'); else if (/720p/i.test(rel)) tags.push('720P');
      return '<div class="subrow f" data-key="or-' + i + '" data-act="' + A(() => download(r)) + '"><span class="chk"></span><span class="lang">' + esc(rel) +
        (r.providerTitle ? '<small>' + esc(r.providerTitle) + '</small>' : '') + '</span><span class="tags">' + tagsHTML(tags, [t('matchesFile')]) + '</span></div>';
    }).join('') + '</div>' + backBtn, 'or-0');
  }
  async function download(r) {
    const before = new Set(o.subs.map((s) => s.id));
    toast(t('downloading'), 3000);
    try {
      await fetch(pmsURL('/library/metadata/' + o.ratingKey + '/subtitles', {
        key: r.key, codec: r.codec, language: r.languageCode || r.language,
        hearingImpaired: r.hearingImpaired ? 1 : 0, forced: r.forced ? 1 : 0, providerTitle: r.providerTitle
      }), { method: 'PUT' });
      let added = null;
      for (let i = 0; i < 12 && !added; i++) {
        await sleep(1500);
        const mm = ((await api('/library/metadata/' + o.ratingKey)).Metadata || [])[0];
        const p2 = mm && mm.Media && mm.Media[0] && mm.Media[0].Part && mm.Media[0].Part[0];
        const fresh = p2 ? (p2.Stream || []).filter((s) => s.streamType === 3) : [];
        added = fresh.find((s) => !before.has(s.id)) || null;
        if (added) { o.subs.length = 0; fresh.forEach((s) => o.subs.push(s)); }
      }
      if (added && o.second) { closeModal(true); o.onSecond(added); return; }
      if (added) return choose(added.id, true);
      toast(t('downloadSlow'), 6000);
      closeModal();
    } catch (e) { toast(t('onlineFailed'), 6000); }
  }
}

/* ---------- TVmaze for one show (status, next episode, missing episodes) ---------- */
const tvmCache = new Map();
async function tvmFor(m) {
  const id = await tvmIdFor(m);
  if (!id || id === -1) return null;
  if (tvmCache.has(id)) return tvmCache.get(id);
  const r2 = await tvmGet('https://api.tvmaze.com/shows/' + id + '?embed[]=episodes&embed[]=nextepisode');
  if (!r2.ok) return null;
  const sh = await r2.json();
  tvmCache.set(id, sh);
  return sh;
}

/* ---------- filmography (TMDB) ---------- */
/* Everything a person has been in or made, movies and series together, newest first.
   Titles in your library are marked and open their own page; the rest are faded and show their summary. */
function tmdbLang() { return { en: 'en-US', sv: 'sv-SE', cs: 'cs-CZ', uk: 'uk-UA', el: 'el-GR' }[S.lang] || 'en-US'; }
async function tmdbGet(path, params) {
  const isBearer = S.tmdb.length > 60;
  const q = Object.assign({}, params || {});
  if (!isBearer) q.api_key = S.tmdb;
  const qs = Object.keys(q).filter((k) => q[k] != null).map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(q[k])).join('&');
  const r = await fetch('https://api.themoviedb.org/3' + path + (qs ? '?' + qs : ''), { headers: isBearer ? { Authorization: 'Bearer ' + S.tmdb, Accept: 'application/json' } : { Accept: 'application/json' } });
  if (!r.ok) throw new Error('TMDB ' + r.status);
  return r.json();
}
function tmdbIdOf(m) {
  const x = ((m && m.Guid) || []).map((g) => /^tmdb:\/\/(\d+)/.exec(g.id || '')).find(Boolean);
  return x ? +x[1] : 0;
}
/* The name on Plex is matched to a TMDB person; when several people share the name,
   the one who was in the title you came from wins. */
const personCache = new Map();
async function findPerson(name, ctx) {
  const ck = name + '|' + (ctx && ctx.type) + (ctx && ctx.id);
  if (personCache.has(ck)) return personCache.get(ck);
  const res = (await tmdbGet('/search/person', { query: name, include_adult: 'false' })).results || [];
  if (!res.length) return null;
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const same = res.filter((p) => norm(p.name) === norm(name));
  const pool = same.length ? same : res;
  let pick = null;
  if (ctx && ctx.id) {
    pick = pool.find((p) => (p.known_for || []).some((k) => k.id === ctx.id && (k.media_type || ctx.type) === ctx.type)) || null;
    if (!pick && pool.length > 1) {
      for (const p of pool.slice(0, 3)) {
        const cc = await tmdbGet('/person/' + p.id + '/combined_credits').catch(() => null);
        if (cc && (cc.cast || []).concat(cc.crew || []).some((k) => k.id === ctx.id && k.media_type === ctx.type)) { pick = p; break; }
      }
    }
  }
  pick = pick || pool[0];
  personCache.set(ck, pick.id);
  return pick.id;
}
const TALK_GENRES = [10767, 10763, 10764];
function isAppearance(c) {
  if (c.media_type === 'tv' && (c.genre_ids || []).some((g) => TALK_GENRES.includes(g))) return true;
  if (c.department === 'Crew' && /thanks/i.test(c.job || '')) return true;
  return /^(self|himself|herself|themselves|guest|archive footage|\(archive footage\)|narrator \(voice\)\s*-\s*self)/i.test(String(c.character || '').trim()) || /\b(himself|herself|themselves)\b/i.test(c.character || '');
}
function mergeCredits(cc) {
  const map = new Map();
  const add = (c, dept, role) => {
    if (c.media_type !== 'movie' && c.media_type !== 'tv') return;
    const k = c.media_type + ':' + c.id;
    let e = map.get(k);
    if (!e) {
      e = {
        key: k, type: c.media_type, id: c.id, title: c.title || c.name || '', date: c.release_date || c.first_air_date || '',
        poster: c.poster_path, overview: c.overview || '', vote: c.vote_average || 0, votes: c.vote_count || 0,
        roles: [], depts: new Set(), eps: 0, appearance: true
      };
      map.set(k, e);
    }
    e.depts.add(dept);
    if (role && !e.roles.includes(role)) e.roles.push(role);
    if (c.episode_count) e.eps = Math.max(e.eps, c.episode_count);
    if (!isAppearance(c)) e.appearance = false;
  };
  (cc.cast || []).forEach((c) => add(c, 'Acting', c.character || ''));
  (cc.crew || []).forEach((c) => add(c, c.department === 'Directing' || c.department === 'Writing' || c.department === 'Production' ? c.department : 'Crew', c.job || ''));
  return Array.from(map.values()).sort((a, b) => (!a.date ? -1 : !b.date ? 1 : b.date.localeCompare(a.date)));
}
async function viewPerson(name, thumb, ctx, from) {
  const seq = viewSeq;
  const head = (count) => '<div class="top"><div class="htitle"><button type="button" class="crumb f" data-key="crumb" data-act="' + A(back) + '">' + ICON.back + esc(from || t('back')) + '</button><h1>' + esc(name) + '</h1></div>' +
    (count ? '<span class="count">' + esc(count) + '</span>' : '') + '<div style="margin-left: auto"></div>' + clockHTML(false, 'margin-left: 28px') + '</div>';
  render('<div class="screen">' + head('') + '<div class="empty">' + esc(t('loading')) + '</div></div>');
  if (!S.tmdb) {
    render('<div class="screen">' + head('') + '<p class="sheettext" style="max-width: 900px">' + esc(t('filmNeedsKey')) + '</p>' +
      '<div><button type="button" class="btn f" data-default data-act="' + A(() => go(viewSettings)) + '">' + esc(t('settings')) + '</button></div></div>');
    initFocus();
    return;
  }
  const secs = (await api('/library/sections')).Directory || [];
  const [pid, idx] = await Promise.all([findPerson(name, ctx), loadLibIndex(secs)]);
  if (seq !== viewSeq) return;
  if (!pid) {
    render('<div class="screen">' + head('') + '<div class="empty">' + esc(t('personNotFound', { n: name })) + '</div></div>');
    return;
  }
  const p = await tmdbGet('/person/' + pid, { language: tmdbLang(), append_to_response: 'combined_credits' });
  if (!p.biography && S.lang !== 'en') {
    const en = await tmdbGet('/person/' + pid, { language: 'en-US' }).catch(() => null);
    if (en) p.biography = en.biography;
  }
  if (seq !== viewSeq) return;
  const all = mergeCredits(p.combined_credits || {});
  all.forEach((e) => { e.own = idx.get(e.key) || null; });
  const deptOrder = ['Acting', 'Directing', 'Writing', 'Production', 'Crew'];
  const depts = deptOrder.filter((d) => all.some((e) => e.depts.has(d)));
  const kindDept = ctx && ctx.kind ? { director: 'Directing', writer: 'Writing', producer: 'Production' }[ctx.kind] : null;
  const f = {
    type: 'all',
    dept: kindDept && depts.includes(kindDept) ? kindDept : (p.known_for_department && depts.includes(p.known_for_department) ? p.known_for_department : 'all'),
    mine: store.get('filmMine', false),
    appear: false,
    bio: false
  };
  const deptLabel = { Acting: t('deptActing'), Directing: t('deptDirecting'), Writing: t('deptWriting'), Production: t('deptProduction'), Crew: t('deptCrew') };
  const list = () => all.filter((e) => (f.type === 'all' || e.type === f.type) && (f.dept === 'all' || e.depts.has(f.dept)) && (!f.mine || e.own) && (f.appear || !e.appearance || e.own));
  const ownedN = all.filter((e) => e.own).length;
  const img = p.profile_path ? 'https://image.tmdb.org/t/p/w300' + p.profile_path : (thumb ? imgURL(thumb, 300, 300) : '');
  const life = [
    p.birthday ? (p.place_of_birth ? t('bornIn', { d: p.birthday, p: p.place_of_birth }) : t('born', { d: p.birthday })) : '',
    p.deathday ? t('died', { d: p.deathday }) : ''
  ].filter(Boolean);

  const rowHTML = (e) => {
    const yr = e.date ? e.date.slice(0, 4) : t('tba');
    const role = e.roles.filter(Boolean).slice(0, 3).join(', ');
    const sub = [role, e.type === 'tv' && e.eps ? t('episodesN', { n: e.eps }) : ''].filter(Boolean).join(' · ');
    const poster = e.own ? imgURL(e.own.thumb, 120, 180) : (e.poster ? 'https://image.tmdb.org/t/p/w92' + e.poster : '');
    return '<div class="frow f' + (e.own ? ' own' : '') + '" data-key="fr-' + e.key + '" data-act="' + A(() => (e.own ? openItem(e.own) : focused && focused.classList.toggle('open'))) + '">' +
      '<span class="fy">' + esc(yr) + '</span>' +
      '<span class="fp">' + (poster ? '<img loading="lazy" src="' + esc(poster) + '" alt="">' : '') + (e.own ? '<i>' + ICON.play + '</i>' : '') + '</span>' +
      '<span class="ft"><b>' + esc(e.title) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span>' +
      '<span class="tags"><span class="tag">' + esc(e.type === 'tv' ? t('seriesTag') : t('movieTag')) + '</span>' + (e.own ? '<span class="tag strong">' + esc(t('inLibrary').toUpperCase()) + '</span>' : '') + '</span>' +
      '<span class="fr">' + (e.votes >= 20 ? ICON.star + esc(e.vote.toFixed(1)) : '') + '</span>' +
      (e.own ? '' : '<p class="fo">' + esc(e.overview || t('noOverview')) + '</p>') + '</div>';
  };
  const seg = (items, cur, set) => '<div class="seg">' + items.map((o) => '<button type="button" class="f' + (cur === o[0] ? ' on' : '') + '" data-key="' + o[2] + '" data-act="' + A(() => set(o[0], o[2])) + '">' + esc(o[1]) + '</button>').join('') + '</div>';
  const draw = (focusKey) => {
    const l = list();
    const sc = $('.scroll', viewEl);
    const top = focusKey && sc ? sc.scrollTop : 0;
    render('<div class="screen">' + head(t('nCredits', { n: all.length, o: ownedN })) +
      '<div class="person">' +
      '<div class="pside">' + (img ? '<img class="pimg" src="' + esc(img) + '" alt="">' : '<div class="pimg"></div>') +
      (life.length ? '<div class="plife">' + life.map((x) => '<span>' + esc(x) + '</span>').join('') + '</div>' : '') +
      (p.biography ? '<p class="pbio' + (f.bio ? ' open' : '') + '">' + esc(p.biography) + '</p>' +
        '<button type="button" class="btn small f" data-key="bio" data-act="' + A(() => { f.bio = !f.bio; draw('bio'); }) + '">' + esc(f.bio ? t('showLess') : t('showMore')) + (f.bio ? ICON.up : ICON.down) + '</button>' : '') +
      '</div>' +
      '<div class="pmain"><div class="ptools">' +
      seg([['all', t('fAll'), 'ft-all'], ['movie', t('movies'), 'ft-movie'], ['tv', t('shows'), 'ft-tv']], f.type, (v, k) => { f.type = v; draw(k); }) +
      (depts.length > 1 ? seg([['all', t('deptAll'), 'fd-all']].concat(depts.map((d) => [d, deptLabel[d], 'fd-' + d])), f.dept, (v, k) => { f.dept = v; draw(k); }) : '') +
      '<button type="button" class="chip f' + (f.mine ? ' on' : '') + '" data-key="fmine" data-act="' + A(() => { f.mine = !f.mine; store.set('filmMine', f.mine); draw('fmine'); }) + '">' + (f.mine ? ICON.check : '') + esc(t('onlyMine')) + '</button>' +
      '<button type="button" class="chip f' + (f.appear ? ' on' : '') + '" data-key="fapp" data-act="' + A(() => { f.appear = !f.appear; draw('fapp'); }) + '">' + (f.appear ? ICON.check : '') + esc(t('appearances')) + '</button>' +
      '</div>' +
      '<div class="scroll hide-scroll"><div class="flist">' + (l.length ? l.map(rowHTML).join('') : '<div class="empty">' + esc(t('filmNoMatch')) + '</div>') + '</div></div>' +
      '</div></div></div>');
    const sc2 = $('.scroll', viewEl);
    if (sc2) sc2.scrollTop = top;
    initFocus(focusKey || (l[0] ? 'fr-' + l[0].key : null));
  };
  draw(current.focusKey);
}

/* ---------- details: movie, show or episode ---------- */
async function viewDetails(ratingKey, opts) {
  opts = opts || {};
  if (String(ratingKey).startsWith('wo-') && typeof viewUniverse === 'function') return viewUniverse(String(ratingKey).slice(3), opts);
  const seq = viewSeq;
  render('<div class="screen"><div class="top"><button type="button" class="crumb f" data-key="crumb" data-act="' + A(back) + '">' + ICON.back + esc(t('back')) + '</button>' + clockHTML() + '</div><div class="empty">' + esc(t('loading')) + '</div></div>');
  const [mres, xres] = await Promise.all([
    api('/library/metadata/' + ratingKey, { includeMarkers: 1, includeGuids: 1 }),
    api('/library/metadata/' + ratingKey + '/extras').catch(() => ({}))
  ]);
  const m = (mres.Metadata || [])[0];
  if (!m) throw new Error(t('notFound'));
  const artPath = m.type === 'episode' ? (m.grandparentThumb || m.parentThumb || m.thumb) : m.thumb;
  const isShow = m.type === 'show';
  const isEp = m.type === 'episode';
  const extras = xres.Metadata || [];
  const localTrailer = extras.find((x) => x.subtype === 'trailer' || String(x.extraType) === '1') || null;
  const part = !isShow && m.Media && m.Media[0] && m.Media[0].Part && m.Media[0].Part[0];
  const subs = part ? (part.Stream || []).filter((s) => s.streamType === 3) : [];
  let seasons = [];
  if (isShow) seasons = ((await api('/library/metadata/' + ratingKey + '/children')).Metadata || []).filter((s) => s.type === 'season');
  const state = { season: null, episodes: [], tvm: null };
  if (isShow && seasons.length) {
    state.season = (opts.season != null && seasons.find((s) => s.index === opts.season)) || seasons.find((s) => s.viewedLeafCount < s.leafCount) || seasons[0];
    state.episodes = (await api('/library/metadata/' + state.season.ratingKey + '/children')).Metadata || [];
  }
  if (seq !== viewSeq) return;
  modalArt = artPath ? imgURL(artPath, 440, 660) : null;
  /* Back from further down the page (seasons, episodes, cast) goes up to the buttons first; Back from there leaves. */
  keyHandler = (e) => {
    if (e.key !== 'Escape' || modalOpen() || !focused) return false;
    if (focused.closest('.actions') || focused.closest('.eplinks') || focused.dataset.key === 'crumb') return false;
    const top = $('.actions [data-default]', viewEl) || $('.actions .f', viewEl);
    if (!top) return false;
    setFocus(top, true);
    const sc = $('.dscroll', viewEl); if (sc) sc.scrollTop = 0;
    return true;
  };

  /* episodes of the selected season, with TVmaze episodes you don't have mixed in when "Missing episodes" is on */
  const tvmEps = () => (state.tvm && state.tvm._embedded && state.tvm._embedded.episodes) || [];
  const tmdbShow = tmdbIdOf(m);
  const stillKey = (sn, en) => tmdbShow + ':' + sn + ':' + en;
  const ghostOf = (e) => ({ ghost: true, season: e.season, index: e.number, title: e.name || '', airstamp: e.airstamp || e.airdate, airdate: e.airdate, summary: stripTags(e.summary), image: (e.image && (e.image.original || e.image.medium)) || stillCache.get(stillKey(e.season, e.number)) || '' });
  /* Episodes you don't have that have already aired: when TVmaze has no picture, get the still from TMDB. */
  const fillStills = () => {
    if (!S.tmdb || !tmdbShow || !S.showMissing || !state.tvm) return;
    const want = episodeList().filter((e) => e.ghost && !e.image && e.airstamp && Date.parse(e.airstamp) < Date.now() && !stillTried.has(stillKey(e.season, e.index)));
    if (!want.length) return;
    want.forEach((e) => stillTried.add(stillKey(e.season, e.index)));
    Promise.all(want.map((e) => tmdbGet('/tv/' + tmdbShow + '/season/' + e.season + '/episode/' + e.index).then((r) => {
      if (r && r.still_path) { stillCache.set(stillKey(e.season, e.index), 'https://image.tmdb.org/t/p/w780' + r.still_path); return true; }
      return false;
    }).catch(() => false))).then((found) => { if (found.some(Boolean) && seq === viewSeq && !modalOpen()) redraw(); });
  };
  const seasonList = () => {
    const list = seasons.map((s) => ({ plex: s, index: s.index, title: s.title }));
    if (S.showMissing && state.tvm) {
      const have = new Set(seasons.map((s) => s.index));
      Array.from(new Set(tvmEps().map((e) => e.season))).filter((n) => n && !have.has(n)).forEach((n) => list.push({ ghost: true, index: n, title: t('seasonN', { n: n }) }));
      list.sort((a, b) => a.index - b.index);
    }
    return list;
  };
  const episodeList = () => {
    let eps = state.season && state.season.ghost ? [] : state.episodes.slice();
    if (S.showMissing && state.tvm && state.season) {
      const sn = state.season.ghost ? state.season.index : state.season.index;
      const have = new Set(eps.map((e) => e.index));
      tvmEps().filter((e) => e.season === sn && !have.has(e.number)).forEach((e) => eps.push(ghostOf(e)));
      eps.sort((a, b) => a.index - b.index);
    }
    return eps;
  };
  const ghostStatus = (g) => (g.airstamp && Date.parse(g.airstamp) > Date.now() ? t('airsOn', { d: airLabel(g.airstamp) }) : t('notInLibrary'));
  const openGhost = (g) => openModal(sheetHeader('S' + g.season + ' E' + g.index + (g.title ? ' · ' + g.title : ''), ghostStatus(g)) +
    (g.image ? '<img class="sheetimg" src="' + esc(g.image) + '" alt="">' : '') +
    '<div class="tags"><span class="tag">' + esc(ghostStatus(g).toUpperCase()) + '</span></div>' +
    (g.summary ? '<p class="sheettext">' + esc(g.summary) + '</p>' : '') +
    '<button type="button" class="btn f" data-default data-act="' + A(() => closeModal()) + '">' + ICON.back + esc(t('back')) + '</button>');
  const epAct = (e) => A(() => (e.ghost ? openGhost(e) : go(viewDetails, [e.ratingKey])));
  const epKey = (e) => (e.ghost ? 'g-' + e.season + '-' + e.index : 'e-' + e.ratingKey);

  const episodesHTML = () => {
    const v = S.epView;
    const eps = episodeList();
    if (!eps.length) return '<div class="empty">' + esc(t('nothing')) + '</div>';
    if (v === 'list') {
      const openEp = (el, e) => {
        $$('.eprow2 .ex', viewEl).forEach((x) => { if (x.parentNode !== el) x.innerHTML = ''; });
        const x = $('.ex', el);
        if (!x || x.innerHTML) return;
        const th = e.ghost ? e.image : imgURL(e.thumb, 640, 360);
        x.innerHTML = (th ? '<img src="' + esc(th) + '" alt="">' : '<div class="ph"></div>') + '<p>' + esc(e.summary || (e.ghost ? ghostStatus(e) : '')) + '</p>';
      };
      return '<div class="eplist">' + eps.map((e) => '<div class="eprow2 f' + (e.ghost ? ' ghost' : '') + '" data-key="' + epKey(e) + '" data-act="' + epAct(e) + '" data-onfocus="' + A((el) => openEp(el, e)) + '">' +
        '<div class="emain"><span class="num">E' + esc(e.index) + '</span><span class="et">' + esc(e.title) + '</span>' +
        (e.ghost ? '<span class="tag">' + esc(ghostStatus(e).toUpperCase()) + '</span>' : (progress(e) ? '<span class="mini"><i style="width: ' + progress(e) + '%"></i></span>' : '') +
        '<span class="ed">' + esc(durText(e.duration)) + '</span><span class="ew">' + (e.viewCount && !e.viewOffset ? ICON.check : '') + '</span>') + '</div><div class="ex"></div></div>').join('') + '</div>';
    }
    if (v === 'detailed') {
      return '<div class="eplist">' + eps.map((e) => {
        const th = e.ghost ? e.image : imgURL(e.thumb, 480, 270);
        return '<div class="epdet f' + (e.ghost ? ' ghost' : '') + '" data-key="' + epKey(e) + '" data-act="' + epAct(e) + '">' +
          '<div style="position: relative">' + (th ? '<img class="img" loading="lazy" src="' + esc(th) + '" alt="">' : '<div class="img"></div>') +
          (!e.ghost && e.viewCount && !e.viewOffset ? '<span class="watched">' + ICON.check + '</span>' : '') +
          (!e.ghost && progress(e) ? '<div class="bar" style="position: absolute; left: 0; right: 0; bottom: 0"><i style="width: ' + progress(e) + '%"></i></div>' : '') + '</div>' +
          '<div class="eptext"><b>E' + esc(e.index) + ' · ' + esc(e.title) + '</b>' +
          (e.ghost ? '<span class="tags"><span class="tag">' + esc(ghostStatus(e).toUpperCase()) + '</span></span>'
            : '<span class="count">' + esc([durText(e.duration), e.originallyAvailableAt ? t('aired', { d: e.originallyAvailableAt }) : ''].filter(Boolean).join(' · ')) + '</span>') +
          '<p>' + esc(e.summary || '') + '</p></div></div>';
      }).join('') + '</div>';
    }
    return '<div class="hrow hide-scroll">' + eps.map((e) => {
      const pct = e.ghost ? 0 : progress(e);
      const th = e.ghost ? e.image : imgURL(e.thumb, 480, 270);
      return '<div class="card ep f' + (e.ghost ? ' ghost' : '') + '" data-key="' + epKey(e) + '" data-act="' + epAct(e) + '">' +
        '<div style="position: relative">' + (th ? '<img class="img" loading="lazy" src="' + esc(th) + '" alt="">' : '<div class="img"></div>') +
        (e.ghost ? '<span class="ghosttag">' + esc(ghostStatus(e)) + '</span>' : '') +
        (!e.ghost && e.viewCount && !e.viewOffset ? '<span class="watched">' + ICON.check + '</span>' : '') + '</div>' +
        (pct ? '<div class="bar"><i style="width: ' + pct + '%"></i></div>' : '') +
        '<div class="t" style="font-size: 18px">E' + esc(e.index) + ' · ' + esc(e.title) + '</div><div class="s">' + esc(e.ghost ? (e.airdate || '') : durText(e.duration)) + '</div></div>';
    }).join('') + '</div>';
  };

  const statusHTML = () => {
    if (!isShow || !state.tvm) return '';
    const nx = state.tvm._embedded && state.tvm._embedded.nextepisode;
    if (nx) return '<div class="status"><i></i>' + esc(t('nextEp', { c: 'S' + nx.season + ' E' + nx.number, d: airLabel(nx.airstamp || nx.airdate) })) + '</div>';
    if (state.tvm.status === 'Ended') {
      const now = Date.now();
      const aired = tvmEps().filter((e) => e.airdate && Date.parse(e.airstamp || e.airdate) <= now);
      const last = aired.length ? aired[aired.length - 1] : null;
      return '<div class="status ended">' + esc(last ? t('endedLast', { d: last.airdate, c: 'S' + last.season + ' E' + last.number }) : t('statusEnded')) + '</div>';
    }
    if (state.tvm.status === 'Running' || state.tvm.status === 'To Be Determined') return '<div class="status"><i></i>' + esc(t('statusReturning')) + '</div>';
    return '';
  };

  const draw = () => {
    const genres = (m.Genre || []).slice(0, 2).map((g) => g.tag);
    const meta = isEp
      ? [epCode(m), m.originallyAvailableAt, durText(m.duration), m.contentRating].filter(Boolean)
      : [m.year, genres.join(', '), isShow ? seasonsText(m.childCount) : durText(m.duration), m.contentRating].filter(Boolean);
    const tags = mediaTags(m);
    let actions = '';
    if (!isShow) {
      if (m.viewOffset) {
        actions += '<button type="button" class="btn primary f" data-default data-key="resume" data-act="' + A(() => go(viewPlayer, [m.ratingKey])) + '" data-ctx="' + A(() => itemMenu(m)) + '">' + ICON.play + esc(t('resume')) + ' <span style="font-weight: var(--w400); opacity: 0.75">' + esc(leftText(m)) + '</span></button>';
      } else {
        actions += '<button type="button" class="btn primary f" data-default data-key="play" data-act="' + A(() => go(viewPlayer, [m.ratingKey])) + '" data-ctx="' + A(() => itemMenu(m)) + '">' + ICON.play + esc(t('play')) + '</button>';
      }
    } else {
      const next = state.episodes.find((e) => e.viewOffset) || state.episodes.find((e) => !e.viewCount) || state.episodes[0];
      if (next) actions += '<button type="button" class="btn primary f" data-default data-key="playnext" data-act="' + A(() => go(viewPlayer, [next.ratingKey])) + '" data-ctx="' + A(() => itemMenu(m)) + '">' + ICON.play + esc(next.viewOffset ? t('resume') : t('play')) + ' ' + esc(epCode(next)) + '</button>';
    }
    if (subs.length || part) {
      actions += '<button type="button" class="btn f" data-key="dsubs" data-act="' + A(() => openSubPicker({ ratingKey: m.ratingKey, part: part, subs: subs, guided: subNeedsGuide(m.ratingKey, subs), onChosen: () => { current.focusKey = 'dsubs'; draw(); } })) + '">' + ICON.cc + esc(subButtonText(m.ratingKey, subs)) + '</button>';
    }
    if (!isShow && (m.viewOffset || m.viewCount)) actions += '<button type="button" class="btn f" data-key="start" data-act="' + A(() => go(viewPlayer, [m.ratingKey, { fromStart: true }])) + '">' + esc(t('fromStart')) + '</button>';
    if (!isShow) {
      const seen = !!m.viewCount && !m.viewOffset;
      actions += '<button type="button" class="btn f" data-key="watched" data-act="' + A(async () => {
        try { await fetch(pmsURL(seen ? '/:/unscrobble' : '/:/scrobble', { key: m.ratingKey, identifier: 'com.plexapp.plugins.library' })); } catch (e) { /* ignore */ }
        toast(seen ? t('ctxResetDone') : t('markedWatched'), 3000);
        current.focusKey = 'watched'; run();
      }) + '">' + (seen ? '' : ICON.check) + esc(seen ? t('markUnwatched') : t('markWatched')) + '</button>';
    }
    if (!isEp) actions += '<button type="button" class="btn f" data-key="trailer" data-act="' + A(playTrailer) + '">' + ICON.film + esc(t('trailer')) + '</button>';
    if (!isShow && typeof songsFor === 'function' && songsFor(m.ratingKey).length) actions += '<button type="button" class="btn f" data-key="songs" data-act="' + A(() => songHistorySheet(m.ratingKey, isEp ? (m.grandparentTitle + ' · ' + epCode(m)) : m.title)) + '" aria-label="' + esc(t('songsN', { n: songsFor(m.ratingKey).length })) + '">' + ICON.music + esc(String(songsFor(m.ratingKey).length)) + '</button>';
    const woPid = typeof woPresetFor === 'function' ? woPresetFor(m) : null;
    if (woPid) actions += '<button type="button" class="btn f" data-key="worder" data-act="' + A(() => go(viewDetails, ['wo-' + woPid])) + '">' + ICON.lines + esc(WO_PRESETS[woPid].name) + '</button>';
    if (typeof artAllowedNow === 'function' && artAllowedNow()) actions += '<button type="button" class="btn icon f" data-key="artedit" aria-label="' + esc(t('artChange')) + '" data-act="' + A(() => artEditor(m)) + '">' + ICON.image + '</button>';
    /* the Watchlist bookmark is always last, the artwork button just before it */
    if (!isEp && typeof wlId === 'function' && wlId(m)) {
      const onWl = WL.ids.has(wlId(m));
      actions += '<button type="button" class="btn icon f' + (onWl ? ' on' : '') + '" data-key="wlbtn" aria-label="' + esc(t(onWl ? 'wlRemove' : 'wlAdd')) + '" data-act="' + A(async () => { await wlToggle(m); redraw('wlbtn'); }) + '">' + (onWl ? ICON.bookmarkOn : ICON.bookmark) + '</button>';
    }
    const extrasBlock = extras.length ? '<h2 class="section-h">' + esc(t('extras')) + '</h2><div class="hrow hide-scroll">' + extras.map((x) => {
      const th = imgURL(x.thumb, 480, 270);
      return '<div class="card ep f" data-key="x-' + x.ratingKey + '" data-act="' + A(() => go(viewPlayer, [x.ratingKey, { fromStart: true }])) + '">' +
        (th ? '<img class="img" loading="lazy" src="' + esc(th) + '" alt="">' : '<div class="img"></div>') +
        '<div class="t" style="font-size: 17px">' + esc(x.title) + '</div><div class="s">' + esc([TEXT.en['ex_' + x.subtype] ? t('ex_' + x.subtype) : t('ex_other'), durText(x.duration)].filter(Boolean).join(' · ')) + '</div></div>';
    }).join('') + '</div>' : '';
    /* how a long season list is shown: 'numbers' (a row of numbered squares), 'picker' (one button that opens a grid
       of all seasons, with previous/next), or 'posters' (a row of season posters) */
    const seasonPickerHTML = (sl, tab, compact, isOn) => {
      if (!compact) return '<div class="tabs" data-nav-r="missing,ev-' + S.epView + '">' + sl.map(tab).join('') + '</div>';
      const style = S.seasonStyle || 'numbers';
      const at = sl.findIndex(isOn);
      if (style === 'picker') {
        const step = (d) => { const n = sl[at + d]; if (n) { current.focusKey = d < 0 ? 'sp-prev' : 'sp-next'; pickSeason(n); } };
        const openAll = () => {
          const el = openModal(sheetHeader(t('seasonsLabel'), t('seasonsN', { n: sl.length })) + '<div class="sgrid">' + sl.map((x) => tab(x).replace('data-act="', 'data-close="1" data-act="')).join('') + '</div>', 's-' + (sl[at] ? (sl[at].ghost ? 'g' + sl[at].index : sl[at].plex.ratingKey) : ''), true);
          el.classList.add('seasonsheet');
          $$('[data-close]', el).forEach((b) => { const a = b.dataset.act; b.dataset.act = A(() => { closeModal(true); acts.get(a)(b); }); });
        };
        return '<div class="spick">' +
          '<button type="button" class="btn icon f" data-key="sp-prev" aria-label="‹"' + (at > 0 ? '' : ' disabled') + ' data-act="' + A(() => step(-1)) + '">' + ICON.back + '</button>' +
          '<button type="button" class="btn f" data-key="sp-all" data-act="' + A(openAll) + '">' + ICON.grid + esc(t('allSeasons', { n: sl.length })) + '</button>' +
          '<button type="button" class="btn icon f" data-key="sp-next" aria-label="›"' + (at < sl.length - 1 ? '' : ' disabled') + ' data-act="' + A(() => step(1)) + '">' + ICON.next + '</button></div>';
      }
      if (style === 'posters') {
        return '<div class="hrow hide-scroll sposters">' + sl.map((x) => {
          const p = x.plex;
          const pct = p && p.leafCount ? Math.round((p.viewedLeafCount || 0) / p.leafCount * 100) : 0;
          const th = p && (p.thumb || m.thumb) ? imgURL(p.thumb || m.thumb, 200, 300) : '';
          return '<div class="card spost f' + (isOn(x) ? ' on' : '') + (x.ghost ? ' ghost' : '') + '" data-key="s-' + (x.ghost ? 'g' + x.index : p.ratingKey) + '" data-act="' + A(() => pickSeason(x)) + '">' +
            '<div class="cimg">' + (th ? '<img class="img" loading="lazy" src="' + esc(th) + '" alt="">' : '<div class="img"></div>') + '<b class="snum">' + esc(x.index === 0 ? t('specials') : String(x.index)) + '</b></div>' +
            (pct ? '<div class="bar"><i style="width: ' + pct + '%"></i></div>' : '') + '</div>';
        }).join('') + '</div>';
      }
      return '<div class="tabs compact hide-scroll">' + sl.map(tab).join('') + '</div>';
    };
    /* the first thing in the season list (Down from Cards/List/Detailed lands here) */
    const firstSeasonKey = (sl) => {
      const st2 = S.seasonStyle || 'numbers';
      if (st2 === 'picker') return 'sp-all';
      const f = sl[0];
      return f ? 's-' + (f.ghost ? 'g' + f.index : f.plex.ratingKey) : '';
    };
    let seasonBlock = '';
    if (isShow) {
      const ev = S.epView;
      const sl = seasonList();
      const isOn = (s) => state.season && (s.ghost ? state.season.ghost && state.season.index === s.index : !state.season.ghost && s.plex.ratingKey === state.season.ratingKey);
      /* many seasons: one tidy row of numbered squares (with a watched bar) instead of a wall of "Season N" buttons */
      const compact = sl.length > 6;
      const tab = (s) => {
        const p = s.plex;
        const pct = p && p.leafCount ? Math.round((p.viewedLeafCount || 0) / p.leafCount * 100) : 0;
        const label = compact ? (s.index === 0 ? t('specials') : String(s.index)) : s.title;
        return '<button type="button" class="f' + (isOn(s) ? ' on' : '') + (s.ghost ? ' ghost' : '') + (compact && s.index === 0 ? ' wide' : '') + '" data-key="s-' + (s.ghost ? 'g' + s.index : s.plex.ratingKey) + '" aria-label="' + esc(s.title) + '" data-act="' + A(() => pickSeason(s)) + '">' + esc(label) +
          (compact && pct ? '<i class="sbar"><b style="width: ' + pct + '%"></b></i>' : '') + '</button>';
      };
      seasonBlock = '<div class="tabsrow' + (compact ? ' compact' : '') + '">' + (compact ? '<div class="seasonhead"><span class="label">' + esc(t('seasonsLabel')) + '</span><b>' + esc(state.season ? (state.season.ghost ? t('seasonN', { n: state.season.index }) : state.season.title) : '') + '</b></div>' : '') +
        (compact ? '<div class="seasonnav" data-nav-u="ev-' + S.epView + ',missing">' + seasonPickerHTML(sl, tab, compact, isOn) + '</div>' : seasonPickerHTML(sl, tab, compact, isOn)) +
        '<div class="tabtools"' + (compact ? ' data-nav-d="' + firstSeasonKey(sl) + '"' : '') + '>' +
        '<button type="button" class="chip f' + (S.showMissing ? ' on' : '') + '" data-key="missing" data-act="' + A(toggleMissing) + '">' + (S.showMissing ? ICON.check : '') + esc(t('showMissing')) + '</button>' +
        '<div class="seg">' + [['cards', t('cards')], ['list', t('list')], ['detailed', t('detailed')]].map((o) => '<button type="button" class="f' + (ev === o[0] ? ' on' : '') + '" data-key="ev-' + o[0] + '" data-act="' + A(() => { S.epView = o[0]; store.set('epView', o[0]); redraw('ev-' + o[0]); }) + '">' + esc(o[1]) + '</button>').join('') + '</div></div></div>' +
        episodesHTML();
    }
    const cast = (m.Role || []).slice(0, 14);
    const castBlock = cast.length ? '<h2 class="section-h">' + esc(t('castCrew')) + '</h2><div class="hrow hide-scroll">' + cast.map((p, i) =>
      '<div class="face f" data-key="p-' + i + '" data-act="' + A(() => go(viewPerson, [p.tag, p.thumb, personCtx(m), m.title])) + '">' +
      (p.thumb ? '<img class="img" loading="lazy" src="' + esc(imgURL(p.thumb, 280, 280)) + '" alt="">' : '<div class="img"></div>') +
      '<b>' + esc(p.tag) + '</b><span>' + esc(p.role || '') + '</span></div>').join('') +
      '<div class="castmore f" data-key="allcast" data-act="' + A(() => castSheet(crewOf(m), m.title, personCtx(m))) + '"><div class="img">' + ICON.next + '</div><b>' + esc(t('allCast')) + '</b></div></div>' : '';
    const heroSrc = isEp ? (m.thumb || m.grandparentArt) : m.art;
    render('<div class="dscroll hide-scroll">' +
      '<div class="hero">' + (heroSrc ? '<img src="' + esc(imgURL(heroSrc, 1600, 900)) + '" alt="">' : '') + '</div>' +
      '<div style="display: flex; justify-content: space-between; align-items: center; position: relative; z-index: 2"><button type="button" class="crumb f" data-key="crumb" data-act="' + A(back) + '">' + ICON.back + esc(isEp ? m.grandparentTitle : isShow ? t('shows') : t('movies')) + '</button>' +
      '<div style="display: flex; align-items: center; gap: 28px">' + clockHTML(!!heroSrc, 'margin-left: 0') + '</div></div>' +
      '<div style="position: relative; z-index: 2">' +
      (isEp ? '<div class="eplinks">' +
        '<button type="button" class="linkbtn f" data-key="to-show" data-act="' + A(() => go(viewDetails, [m.grandparentRatingKey])) + '">' + esc(m.grandparentTitle) + '</button>' +
        '<span aria-hidden="true">·</span>' +
        '<button type="button" class="linkbtn f" data-key="to-season" data-act="' + A(() => go(viewDetails, [m.grandparentRatingKey, { season: m.parentIndex }])) + '">' + esc(m.parentTitle || t('seasonN', { n: m.parentIndex })) + '</button></div>' : '') +
      '<h1' + (isEp ? '' : ' data-logo="' + esc(m.ratingKey) + '"') + ' class="dtitle' + (isEp ? ' epname' : '') + (String(m.title || '').length > 70 ? ' tlong3' : String(m.title || '').length > 45 ? ' tlong2' : String(m.title || '').length > 28 ? ' tlong1' : '') + '">' + esc(m.title) + '</h1>' +
      '<div class="dmeta">' + meta.map((x) => '<span>' + esc(x) + '</span>').join('<span aria-hidden="true">·</span>') + '</div>' +
      '<div class="ratings">' + ratingsHTML(m) + (tags.length ? '<div class="tags">' + tagsHTML(tags) + '</div>' : '') + statusHTML() + '</div>' +
      (m.summary ? '<p class="summary">' + esc(m.summary) + '</p>' : '') +
      '<div class="actions"' + (isShow ? '' : ' data-nav-d="p-0"') + '>' + actions + '</div>' +
      seasonBlock + castBlock + extrasBlock +
      '</div></div>');
    initFocus();
    fillStills();
    /* admin check not done yet: add the artwork button as soon as it is */
    if (typeof artAllowedNow === 'function' && !artAllowedNow()) {
      const vs = viewSeq;
      isAdmin().then((yes) => {
        const box = $('.dscroll .actions', viewEl);
        if (!yes || vs !== viewSeq || !box || $('[data-key="artedit"]', box)) return;
        const wlb = $('[data-key="wlbtn"]', box);
        (wlb || box).insertAdjacentHTML(wlb ? 'beforebegin' : 'beforeend', '<button type="button" class="btn icon f" data-key="artedit" aria-label="' + esc(t('artChange')) + '" data-act="' + A(() => artEditor(m)) + '">' + ICON.image + '</button>');
      });
    }
  };
  const redraw = (focusKey) => {
    const sc = $('.dscroll', viewEl);
    const top = sc ? sc.scrollTop : 0;
    current.focusKey = focusKey || (focused && focused.dataset.key);
    draw();
    const sc2 = $('.dscroll', viewEl);
    if (sc2) sc2.scrollTop = top;
  };
  const toggleMissing = async () => {
    S.showMissing = !S.showMissing;
    store.set('showMissing', S.showMissing);
    redraw('missing');
    if (S.showMissing && !state.tvm) toast(t('radarLoading'), 2500);
  };
  /* "More": the less used actions, so the page itself stays calm. */
  function openMore() {
    const rows = [];
    if (!isShow && m.viewOffset) rows.push(optionRow('mo-start', t('fromStart'), [], false, A(() => { closeModal(true); go(viewPlayer, [m.ratingKey, { fromStart: true }]); })));
    if (!isEp) rows.push(optionRow('mo-trailer', t('trailer'), [], false, A(() => { closeModal(true); playTrailer(); })));
    if (isShow) rows.push(optionRow('mo-missing', t('showMissing'), [], S.showMissing, A(() => { closeModal(true); toggleMissing(); })));
    if (extras.length) rows.push(optionRow('mo-extras', t('extras'), [], false, A(() => { closeModal(true); const x = $('[data-key^="x-"]', viewEl); if (x) setFocus(x); })));
    openModal(sheetHeader(m.title, '') + '<div class="optlist">' + rows.join('') + '</div>', rows.length ? null : null);
  }
  /* Trailer: the library's own trailer if there is one, otherwise the official trailer from TMDB (YouTube). */
  async function playTrailer() {
    const tmdbId = ((m.Guid || []).map((g) => /^tmdb:\/\/(\d+)/.exec(g.id || '')).find(Boolean) || [])[1];
    /* "YouTube first" gives trailers with subtitles in your language; Plex's own trailers have none */
    if (localTrailer && !(S.trailerSrc === 'youtube' && S.tmdb && tmdbId)) return go(viewPlayer, [localTrailer.ratingKey, { fromStart: true }]);
    return tmdbTrailer(isShow, tmdbId, m.title);
  }
  const pickSeason = async (s) => {
    if (s.ghost) {
      state.season = { ghost: true, index: s.index };
      state.episodes = [];
    } else {
      state.season = s.plex;
      state.episodes = (await api('/library/metadata/' + s.plex.ratingKey + '/children')).Metadata || [];
    }
    redraw('s-' + (s.ghost ? 'g' + s.index : s.plex.ratingKey));
  };
  draw();
  if (isShow) {
    tvmFor(m).then((sh) => {
      if (!sh || seq !== viewSeq) return;
      state.tvm = sh;
      if (!modalOpen()) redraw();
    }).catch(() => {});
  }
}

/* ---------- player ---------- */
async function viewPlayer(ratingKey, opts) {
  opts = opts || {};
  const seq = viewSeq;
  render('<div class="player"><div class="spinner"></div></div>');
  const m = ((await api('/library/metadata/' + ratingKey, { includeMarkers: 1 })).Metadata || [])[0];
  if (!m || seq !== viewSeq) return;
  const pArt = m.type === 'episode' ? (m.grandparentThumb || m.parentThumb || m.thumb) : m.thumb;
  modalArt = pArt ? imgURL(pArt, 440, 660) : null;
  const media = m.Media && m.Media[0];
  const part = media && media.Part && media.Part[0];
  if (!part) throw new Error(t('noFile'));
  const streams = part.Stream || [];
  const subs = streams.filter((s) => s.streamType === 3);
  const audios = streams.filter((s) => s.streamType === 2);
  const durMs = m.duration || media.duration || 0;
  const creditsMarkers = (m.Marker || []).filter((x) => x.type === 'credits');
  const credits = creditsMarkers.find((x) => x.final) || creditsMarkers[creditsMarkers.length - 1] || null;
  const intro = (m.Marker || []).find((x) => x.type === 'intro') || null;
  /* the episode after this one (for "Next episode" at the credits) */
  let nextEp = null;
  const woNext = (m.type === 'episode' && typeof woNextKey === 'function') ? woNextKey(m.ratingKey) : undefined;
  if (woNext) api('/library/metadata/' + woNext).then((r) => { nextEp = (r.Metadata || [])[0] || null; }).catch(() => {});
  else if (woNext === undefined && m.type === 'episode' && m.grandparentRatingKey) {
    api('/library/metadata/' + m.grandparentRatingKey + '/allLeaves').then((r) => {
      const all = (r.Metadata || []).slice().sort((a, b) => (a.parentIndex - b.parentIndex) || (a.index - b.index));
      const i = all.findIndex((x) => String(x.ratingKey) === String(m.ratingKey));
      nextEp = i >= 0 ? all[i + 1] || null : null;
    }).catch(() => {});
  }
  const newSession = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
  let session = newSession();

  const st = {
    subId: pickedSub(m.ratingKey, subs),
    audioId: (audios.find((s) => s.selected) || audios[0] || {}).id || 0,
    audioChanged: false,
    quality: S.quality,
    noText: new Set(), // subtitle files the server could not hand over: these are burned in instead
    cues: [],          // subtitle lines drawn by the app itself
    sub2Id: store.get('sub2.' + m.ratingKey, 0), // second subtitle (dual mode), always drawn by the app at the top
    cues2: [],
    hold: null,       // position shown while a stream restarts, so the timeline never jumps
    pending: null,    // queued seek target in seconds
    info: false,
    idleTimer: null,
    hls: null,
    direct: false
  };
  const audioDefault = audios[0] ? audios[0].id : 0;
  const canDirect = () => (S.forceDirect && st.quality === 'orig') || st.quality === 'orig' && media.container === 'mp4' && media.videoCodec === 'h264' && ['aac', 'mp3'].includes(media.audioCodec) && !burnNeeded() && st.audioId === audioDefault;
  /* Text subtitles that Plex can hand over as a file (downloaded or sidecar .srt) are shown by the player itself,
     so switching is instant and never restarts the stream. Everything else is burned in by the server. */
  const textSub = (id) => { if (!S.subDraw) return null; const s = subs.find((x) => x.id === id); return s && s.key && !st.noText.has(id) && /^(srt|subrip|vtt|webvtt|ass|ssa)$/i.test(s.codec || '') ? s : null; };
  const burnNeeded = () => !!st.subId && !textSub(st.subId) && !st.burnFailed;

  const title = m.type === 'episode' ? m.grandparentTitle : m.title;
  const sub = m.type === 'episode' ? epCode(m) + ' · ' + m.title : [m.year, (m.Genre || []).slice(0, 1).map((g) => g.tag)[0], durText(durMs)].filter(Boolean).join(' · ');
  const cast = (m.Role || []).slice(0, 5);

  const isEpP = m.type === 'episode';
  const crumbP = isEpP ? m.grandparentTitle + ' · ' + epCode(m) : '';
  const bigTitle = isEpP ? (m.title || epCode(m)) : m.title;
  const bigSub = isEpP
    ? [t('seasonN', { n: m.parentIndex }), t('episodeN', { n: m.index }), durText(durMs)].filter(Boolean).join(' · ')
    : [m.year, (m.Genre || []).slice(0, 1).map((g) => g.tag)[0], durText(durMs)].filter(Boolean).join(' · ');
  render('<div class="player" id="pl">' +
    '<video id="vid" playsinline></video><div class="psubs" id="psubs"></div><div class="psubs psubs2" id="psubs2"></div><div class="spinner" id="spin"></div>' +
    '<div class="pfade" aria-hidden="true"></div><div class="pfadetop" aria-hidden="true"></div>' +
    '<button type="button" class="skipbtn" id="skipbtn" hidden></button>' +
    '<div class="ptop"><span class="pcrumb">' + esc(crumbP) + '</span><button type="button" class="wtbadge" hidden data-act="' + A(() => wtPanel()) + '"></button>' + clockHTML(true) + '</div>' +
    '<div class="pbottom">' +
    '<div class="prow"><div class="ptl"><h1 class="ptitle"' + (isEpP ? '' : ' data-logo="' + esc(m.ratingKey) + '"') + '>' + esc(bigTitle) + '</h1><span class="psub">' + esc(bigSub) + '</span></div>' +
    '<div class="ends"><b id="ends"></b><span id="ends2"></span></div></div>' +
    '<section class="panel">' +
    '<div class="tl"><span class="time" id="pos">0:00</span>' +
    '<div class="track f" id="track" data-key="track"><div class="buf" id="buf"></div><div class="played" id="played"></div>' +
    (credits && durMs ? '<div class="credits" style="left: ' + (credits.startTimeOffset / durMs * 100).toFixed(2) + '%"></div>' : '') +
    '</div><span class="time r" id="rem"></span></div>' +
    '<div class="controls">' +
    '<button type="button" class="pbtn solid f" id="pp" data-default data-key="pp" data-act="' + A(() => togglePlay()) + '"></button>' +
    '<button type="button" class="pbtn f" data-key="subs" data-act="' + A(openSubs) + '"><span class="lbl">' + esc(t('subtitles')) + '</span><span id="subLabel"></span></button>' +
    '<button type="button" class="pbtn f" data-key="subs2" data-act="' + A(openSub2) + '"><span class="lbl">' + esc(t('sub2')) + '</span><span id="sub2Label"></span></button>' +
    '<button type="button" class="pbtn f" data-key="aud" data-act="' + A(openAudio) + '"><span class="lbl">' + esc(t('audio')) + '</span><span id="audLabel"></span></button>' +
    '<button type="button" class="pbtn f" data-key="qual" data-act="' + A(openQuality) + '"><span class="lbl">' + esc(t('quality')) + '</span><span id="qualLabel"></span></button>' +
    '<button type="button" class="pbtn f" data-key="wt" data-act="' + A(() => {
      if (wtActive()) { wtPanel(); pl.classList.remove('idle'); return; }
      /* inviting from the player: stop here, and everyone starts from this spot */
      vid.pause(); updateUI();
      wtStart(Object.assign({}, m, { viewOffset: Math.round(position() * 1000) }), { fromPlayer: true });
      pl.classList.remove('idle');
    }) + '">' + ICON.people + '<span class="lbl">' + esc(t('wtShort')) + '</span></button>' +
    (S.auddKey ? '<button type="button" class="pbtn f" data-key="song" data-ctx="' + A(() => songHistorySheet(m.ratingKey, m.type === 'episode' ? (m.grandparentTitle + ' · ' + epCode(m)) : m.title)) + '" data-act="' + A(() => { songFind(pl, m, position(), st.audioId); }) + '">' + ICON.music + '<span class="lbl">' + esc(t('songBtn')) + '</span></button>' : '') +
    '<button type="button" class="pbtn muted f" id="hint" data-key="hint" data-act="' + A(() => { setInfo(!st.info); if (st.info) setFocus($('#more'), true); }) + '"></button>' +
    '</div>' +
    '<div class="info" id="info" hidden>' +
    '<div class="icol"><span class="label">' + esc(t('about')) + '</span><p id="about">' + esc(m.summary || '') + '</p>' +
    '<button type="button" class="pbtn small f" id="more" data-key="more" data-nav-r="pf-0,allcast" data-act="' + A(toggleMore) + '">' + esc(t('showMore')) + ICON.next + '</button></div>' +
    '<div class="icol"><span class="label">' + esc(t('cast')) + '</span><div class="pcast" data-nav-d="allcast" data-nav-l="more">' +
    cast.map((p, i) => '<div class="face f" data-key="pf-' + i + '" data-act="' + A(() => { vid.pause(); current.args = [m.ratingKey, backHere('pf-' + i)]; go(viewPerson, [p.tag, p.thumb, personCtx(m), title]); }) + '">' + (p.thumb ? '<img class="img" src="' + esc(imgURL(p.thumb, 240, 240)) + '" alt="">' : '<div class="img"></div>') + '<b>' + esc(p.tag) + '</b>' + (p.role ? '<span class="prole">' + esc(p.role) + '</span>' : '') + '</div>').join('') +
    '</div><button type="button" class="pbtn small f" data-key="allcast" data-act="' + A(() => { vid.pause(); openCast(); }) + '">' + esc(t('allCast')) + ICON.next + '</button></div>' +
    '<div class="icol"><span class="label">' + esc(t('playback')) + '</span><div class="kv" id="kv"></div><div class="tags">' + tagsHTML(mediaTags(m)) + '</div></div>' +
    '</div></section></div></div>');
  const pl = $('#pl'), vid = $('#vid');
  if (typeof playerClearart === 'function') playerClearart(m);
  if (typeof songJump !== 'undefined') songJump = { key: String(m.ratingKey), go: (at) => { if (!document.contains(vid)) return false; try { vid.currentTime = at; vid.play(); } catch (e) { /* ignore */ } return true; } };
  const position = () => (st.hold != null ? st.hold : (vid.currentTime || 0));
  /* going to an actor from here: Back returns to this spot, paused, with the info (or the cast page) open again */
  const backHere = (focusKey, castKey) => ({ at: position(), paused: true, info: true, focusKey: focusKey, castKey: castKey || null });
  const openCast = (focusKey) => {
    castSheet(crewOf(m), title, personCtx(m), (i) => { current.args = [m.ratingKey, backHere('allcast', 'cp-' + i)]; });
    if (focusKey) { const el = $('.modal [data-key="' + focusKey + '"]', viewEl); if (el) setFocus(el, true); }
  };
  let resumePaused = !!opts.paused;

  function audioName(a) { return a ? (a.language || a.displayTitle || '?') + (a.channels ? ' ' + (a.channels >= 8 ? '7.1' : a.channels >= 6 ? '5.1' : a.channels === 2 ? '2.0' : '') : '') : ''; }
  function subName() { const s = subs.find((x) => x.id === st.subId); return s ? subLangName(s) : t('off'); }
  function refreshStatic() {
    $('#subLabel').textContent = st.subId ? subName() : t('off');
    const s2 = subs.find((x) => x.id === st.sub2Id);
    $('#sub2Label').textContent = s2 ? subLangName(s2) : t('off');
    $('#audLabel').textContent = audioName(audios.find((a) => a.id === st.audioId)).trim();
    $('#qualLabel').textContent = st.quality === 'orig' ? (st.direct ? t('directPlay') : t('original')) : qLabel(st.quality);
    $('#kv').innerHTML = [
      [t('video'), [resLabel(media.videoResolution), (media.videoCodec || '').toUpperCase()].filter(Boolean).join(' · ')],
      [t('audio'), audioName(audios.find((a) => a.id === st.audioId))],
      [t('subtitles'), subName()],
      [t('stream'), st.direct ? t('directPlay') : t('transcoding') + (st.quality !== 'orig' ? ' · ' + qLabel(st.quality) : '')]
    ].map((r) => '<span>' + esc(r[0]) + '</span><span>' + esc(r[1]) + '</span>').join('');
    $('#hint').innerHTML = esc(st.info ? t('hideInfo') : t('infoBtn')) + (st.info ? ICON.up : ICON.down);
  }
  function updateUI() {
    if (seq !== viewSeq) return;
    const pos = st.pending != null ? st.pending : position();
    const dur = durMs / 1000;
    $('#pos').textContent = tc(pos);
    $('#rem').textContent = dur ? '−' + tc(dur - pos) : '';
    $('#played').style.width = dur ? Math.min(100, pos / dur * 100) + '%' : '0';
    try {
      const b = vid.buffered;
      if (b.length && dur && st.hold == null) $('#buf').style.width = Math.min(100, b.end(b.length - 1) / dur * 100) + '%';
    } catch (e) { /* ignore */ }
    const now = Date.now();
    $('#ends').textContent = dur ? t('ends', { t: hhmm(new Date(now + (dur - pos) * 1000)) }) : '';
    const cs = credits ? credits.startTimeOffset / 1000 : null;
    $('#ends2').textContent = cs && pos < cs ? t('endsCredits', { t: hhmm(new Date(now + (cs - pos) * 1000)) }) : '';
    /* Skip intro / Skip credits (or Next episode), from the markers Plex finds in the file */
    const ms = pos * 1000;
    let skip = null;
    if (intro && ms >= intro.startTimeOffset && ms < intro.endTimeOffset - 1500) skip = 'intro';
    else if (credits && ms >= credits.startTimeOffset && ms < (credits.endTimeOffset || durMs) - 1500) skip = nextEp ? 'next' : 'credits';
    if (skip !== st.skip) {
      st.skip = skip;
      const b = $('#skipbtn');
      b.hidden = !skip;
      if (skip) b.innerHTML = esc(skip === 'intro' ? t('skipIntro') : skip === 'next' ? t('nextEpisode') : t('skipCredits')) + ICON.next + '<small>OK</small>';
    }
    /* the clearart stands on the panel's top edge, whatever its height */
    { const pc = $('.pclear', pl); if (pc && pc._place) { const ph = ($('.panel', pl) || {}).offsetHeight; if (pc._ph !== ph) { pc._ph = ph; pc._place(); } } }
    /* the skip button sits just above whatever is showing at the bottom (controls, or controls + info) */
    if (st.skip) {
      const b = $('#skipbtn'), pb = $('.pbottom', pl);
      const want = pl.classList.contains('idle') || !pb ? '' : (pb.offsetHeight + 28) + 'px';
      if (b && b.style.bottom !== want) b.style.bottom = want;
    }
    const ppHTML = vid.paused ? ICON.play + '<span>' + esc(t('play')) + '</span>' : ICON.pause + '<span>' + esc(t('pause')) + '</span>';
    if ($('#pp').innerHTML !== ppHTML) $('#pp').innerHTML = ppHTML;
  }

  function streamURL() {
    if (st.direct) return pmsURL(part.key);
    const q = QUALITIES.find((x) => x.id === st.quality) || QUALITIES[0];
    return pmsURL('/video/:/transcode/universal/start.m3u8', {
      hasMDE: 1,
      path: '/library/metadata/' + m.ratingKey,
      mediaIndex: 0,
      partIndex: 0,
      protocol: 'hls',
      fastSeek: 1,
      directPlay: 0,
      directStream: 1,
      directStreamAudio: 1,
      videoQuality: 100,
      maxVideoBitrate: q.br || (S.server.relay ? 2000 : 200000),
      videoResolution: q.res || '3840x2160',
      subtitleSize: 100,
      audioBoost: 100,
      location: S.server.local ? 'lan' : 'wan',
      subtitles: burnNeeded() ? 'burn' : 'none',
      subtitleStreamID: burnNeeded() ? st.subId : null,
      audioStreamID: st.audioId || null,
      session: session,
      'X-Plex-Session-Identifier': session
    });
  }
  function stopTranscode() {
    fetch(pmsURL('/video/:/transcode/universal/stop', { session: session })).catch(() => {});
    session = newSession();
  }
  /* Streams always start at 0 and the player seeks inside them, so the timeline is the file's own time. */
  /* in a Watch Together room the room decides when to play, so the player doesn't start by itself */
  function autoPlay() {
    if (resumePaused) { resumePaused = false; updateUI(); return; } /* back from an actor's page: stay paused */
    if (typeof wtControls === 'function' && wtControls(m.ratingKey)) return;
    vid.play().catch(() => {});
  }
  function start(at) {
    st.hold = at;
    updateUI();
    if (st.hls) { st.hls.destroy(); st.hls = null; }
    $('#spin').hidden = false;
    const wasDirect = st.direct;
    st.direct = canDirect();
    if (!wasDirect) stopTranscode();
    refreshStatic();
    if (st.direct) {
      vid.src = streamURL();
      vid.addEventListener('loadedmetadata', function once() { vid.removeEventListener('loadedmetadata', once); vid.currentTime = at; autoPlay(); });
    } else if (window.IS_TV && !st.nativeFailed && vid.canPlayType('application/vnd.apple.mpegurl')) {
      /* Samsung TVs play HLS themselves, which is lighter than hls.js; hls.js stays as the fallback */
      vid.src = streamURL();
      const onErr = () => { vid.removeEventListener('error', onErr); if (seq !== viewSeq) return; st.nativeFailed = true; start(at); };
      vid.addEventListener('error', onErr);
      vid.addEventListener('loadedmetadata', function once() { vid.removeEventListener('loadedmetadata', once); vid.removeEventListener('error', onErr); if (at) vid.currentTime = at; autoPlay(); });
    } else if (window.Hls && Hls.isSupported()) {
      vid.removeAttribute('src');
      const hls = new Hls({ maxBufferLength: 30, startPosition: at });
      st.hls = hls;
      hls.loadSource(streamURL());
      hls.attachMedia(vid);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { autoPlay(); });
      hls.on(Hls.Events.ERROR, (ev, data) => {
        if (!data || !data.fatal || seq !== viewSeq) return;
        /* the server can end a stream session (for example right after a subtitle was downloaded):
           start a fresh one at the same spot, twice at most, before giving up */
        const waits = [1500, 3000, 5000, 8000];
        if ((st.recover || 0) < waits.length) {
          const pos = position();
          st.hold = pos; $('#spin').hidden = false;
          setTimeout(() => { if (seq === viewSeq) start(pos); }, waits[st.recover || 0]);
          st.recover = (st.recover || 0) + 1;
          return;
        }
        if (burnNeeded()) { st.burnFailed = true; st.recover = 0; toast(t('subBurnFailed'), 8000); start(position()); return; }
        toast(t('playFailed', { d: (data.details || data.type) + (data.response && data.response.code ? ' (' + data.response.code + ')' : '') }), 10000);
      });
    } else if (vid.canPlayType('application/vnd.apple.mpegurl')) {
      vid.src = streamURL();
      vid.addEventListener('loadedmetadata', function once() { vid.removeEventListener('loadedmetadata', once); vid.currentTime = at; autoPlay(); });
    } else {
      toast(t('cantPlay'), 8000);
    }
  }
  function restart() { const at = st.pending != null ? st.pending : position(); st.pending = null; start(at); }
  function seekTo(target) {
    const dur = durMs / 1000;
    target = Math.max(0, dur ? Math.min(dur - 2, target) : target);
    vid.currentTime = target;
  }
  let seekTimer = null;
  function seekBy(delta) {
    const from = st.pending != null ? st.pending : position();
    st.pending = Math.max(0, from + delta);
    updateUI();
    clearTimeout(seekTimer);
    seekTimer = setTimeout(() => { const target = st.pending; st.pending = null; seekTo(target); }, 550);
    wake(1500); /* after skipping, the controls get out of the way quickly */
  }
  function doSkip() {
    if (st.skip === 'intro') { st.pending = null; seekTo(intro.endTimeOffset / 1000); return; }
    if (st.skip === 'next' && nextEp) { current.args = [nextEp.ratingKey, { fromStart: true }]; current.focusKey = null; run(); return; }
    if (st.skip === 'credits') { if (credits.endTimeOffset && credits.endTimeOffset < durMs - 5000) seekTo(credits.endTimeOffset / 1000); else back(); }
  }
  function togglePlay() {
    if (vid.paused) vid.play().catch(() => {}); else vid.pause();
    updateUI();
    wake();
  }
  function wake(ms) {
    pl.classList.remove('idle');
    clearTimeout(st.idleTimer);
    st.idleTimer = setTimeout(() => {
      if (!vid.paused && !st.info && !modalOpen() && seq === viewSeq) pl.classList.add('idle');
    }, ms || 3200);
  }
  function setInfo(on) {
    st.info = on;
    $('#info').hidden = !on;
    refreshStatic();
    if (on) fitAbout();
    wake();
    updateUI();
  }
  /* The summary fills its column down to the level of "All cast & crew", so both buttons line up;
     "Show more" only appears when the text doesn't fit, and opens the full text on its own page. */
  function fitAbout() {
    const p = $('#about'), more = $('#more'), cb = $('#info [data-key="allcast"]');
    if (!p) return;
    const lh = parseFloat(getComputedStyle(p).lineHeight) || 33;
    const lab = p.previousElementSibling;
    /* measure the row without the summary, so the other columns decide its height */
    p.style.display = 'none';
    const k = lab.getBoundingClientRect().height / (lab.offsetHeight || 1) || 1;
    let room = 4 * lh;
    if (cb && cb.offsetParent) room = Math.max(room, (cb.getBoundingClientRect().top - lab.getBoundingClientRect().bottom) / k - 28);
    p.style.display = '';
    p.style.webkitLineClamp = 'unset'; p.style.maxHeight = 'none';
    const full = p.scrollHeight;
    if (full <= room + 2) { p.style.maxHeight = ''; more.style.visibility = 'hidden'; return; }
    const lines = Math.max(2, Math.floor(room / lh));
    p.style.webkitLineClamp = String(lines);
    p.style.maxHeight = (lines * lh) + 'px';
    more.style.visibility = '';
  }
  function toggleMore() {
    const wasPlaying = !vid.paused;
    vid.pause();
    const el = openModal('<div class="fullhead"><div class="htitle"><button type="button" class="crumb f" data-key="crumb" data-act="' + A(() => closeModal()) + '">' + ICON.back + esc(t('back')) + '</button></div>' + clockHTML() + '</div>' +
      '<div class="aboutbody"><h1>' + esc(bigTitle) + '</h1>' +
      '<span class="psub">' + esc((crumbP ? crumbP + ' · ' : '') + bigSub) + '</span>' +
      '<p class="abouttext">' + esc(m.summary || '') + '</p>' +
      '<button type="button" class="btn f" data-default data-key="closeabout" data-act="' + A(() => closeModal()) + '">' + ICON.back + esc(t('back')) + '</button></div>', 'closeabout', true);
    el.classList.add('aboutpage');
    el._onclose = () => { if (wasPlaying && seq === viewSeq) vid.play().catch(() => {}); };
  }

  function openSubs() {
    openSubPicker({
      ratingKey: m.ratingKey, part: part, subs: subs, guided: !st.subId && subNeedsGuide(m.ratingKey, subs),
      onChosen: (id, downloaded) => {
        /* Changing subtitles restarts the player from scratch at the same spot: the same path as opening
           the episode again, which is the one that works reliably. After a download the server needs a
           moment before it serves the file again, so wait a little first. */
        const at = position();
        vid.pause();
        st.hold = at; $('#spin').hidden = false;
        const go2 = () => { if (seq !== viewSeq) return; current.args = [m.ratingKey, { at: at }]; current.focusKey = null; run(); };
        if (downloaded) { toast(t('subPreparing'), 3500); setTimeout(go2, 3000); } else go2();
      }
    });
    pl.classList.remove('idle');
  }
  function toVTT(txt) {
    txt = String(txt || '').replace(/\r/g, '').replace(/^\uFEFF/, '');
    if (/^WEBVTT/.test(txt)) return txt;
    if (/^\[Script Info\]/m.test(txt)) {
      /* ASS/SSA: keep the dialogue text and timing, drop the styling */
      const ts = (x) => { const m = /(\d+):(\d\d):(\d\d)[.:](\d\d)/.exec(x); return m ? String(m[1]).padStart(2, '0') + ':' + m[2] + ':' + m[3] + '.' + m[4] + '0' : '00:00:00.000'; };
      const fmt = (/^Format:\s*(.*)$/m.exec(txt.split(/\[Events\]/)[1] || '') || [])[1];
      const cols = fmt ? fmt.split(',').map((c) => c.trim().toLowerCase()) : ['layer', 'start', 'end', 'style', 'name', 'marginl', 'marginr', 'marginv', 'effect', 'text'];
      const iS = cols.indexOf('start'), iE = cols.indexOf('end'), iT = cols.indexOf('text');
      const cues = txt.split('\n').filter((l) => /^Dialogue:/.test(l)).map((l) => {
        const parts = l.replace(/^Dialogue:\s*/, '').split(',');
        const text = parts.slice(iT).join(',').replace(/\{[^}]*\}/g, '').replace(/\\N/gi, '\n').replace(/\\h/g, ' ').trim();
        return text ? ts(parts[iS]) + ' --> ' + ts(parts[iE]) + '\n' + text : '';
      }).filter(Boolean);
      return 'WEBVTT\n\n' + cues.join('\n\n');
    }
    return 'WEBVTT\n\n' + txt.replace(/(\d\d:\d\d:\d\d),(\d\d\d)/g, '$1.$2');
  }
  /* Text subtitles are drawn by the app itself (TVs do not reliably show <track> subtitles).
     If the server cannot hand over the file, the subtitle is burned into the picture instead. */
  function parseVTT(vtt) {
    const sec = (x) => { const m = /(?:(\d+):)?(\d\d):(\d\d)[.,](\d{1,3})/.exec(x); return m ? (+(m[1] || 0)) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4].padEnd(3, '0')) / 1000 : 0; };
    return vtt.split(/\n\s*\n/).map((block) => {
      const lines = block.split('\n');
      const i = lines.findIndex((l) => l.includes('-->'));
      if (i < 0) return null;
      const se = lines[i].split('-->');
      const text = lines.slice(i + 1).join('\n').replace(/<[^>]+>/g, '').trim();
      return text ? { a: sec(se[0]), b: sec(se[1]), text: text } : null;
    }).filter(Boolean).sort((x, y) => x.a - y.a);
  }
  let lastCue = '', lastCue2 = '';
  function drawCue() {
    const el = $('#psubs');
    if (!el) return;
    const now = vid.currentTime || 0;
    const el2 = $('#psubs2');
    const txt2 = st.cues2.length ? st.cues2.filter((c) => now >= c.a && now <= c.b).map((c) => c.text).join('\n') : '';
    if (el2 && txt2 !== lastCue2) { lastCue2 = txt2; el2.innerHTML = txt2 ? txt2.split('\n').map((l) => '<span>' + esc(l) + '</span>').join('<br>') : ''; }
    const txt = st.cues.filter((c) => now >= c.a && now <= c.b).map((c) => c.text).join('\n');
    if (txt === lastCue) return;
    lastCue = txt;
    el.innerHTML = txt ? txt.split('\n').map((l) => '<span>' + esc(l) + '</span>').join('<br>') : '';
  }
  async function applyTrack() {
    st.cues = []; lastCue = '\u0000'; drawCue();
    const id = st.subId;
    const s = textSub(id);
    if (!s) return;
    try {
      const txt = await fetchText(pmsURL(s.key), { timeout: 20000, accept: '*/*' });
      if (id !== st.subId || seq !== viewSeq) return;
      st.cues = parseVTT(toVTT(txt));
      if (!st.cues.length) throw new Error('empty');
      drawCue();
    } catch (e) {
      if (id !== st.subId || seq !== viewSeq) return;
      st.noText.add(id);
      toast(t('subLoadFailed') + (e.status ? ' (' + e.status + ')' : '') + ' ' + t('subBurnInstead'), 7000);
      start(position());
    }
  }
  /* Dual subtitles: a second, text-based subtitle shown at the top of the picture, on top of the normal one. */
  const textCodec = (x) => /^(srt|subrip|vtt|webvtt|ass|ssa|mov_text|tx3g|text)$/i.test(x.codec || '');
  async function loadSub2() {
    st.cues2 = []; lastCue2 = '\u0000'; drawCue();
    const id = st.sub2Id;
    const s2 = subs.find((x) => x.id === id);
    if (!s2) return;
    const cacheKey = m.ratingKey + ':' + id;
    const stale = () => id !== st.sub2Id || seq !== viewSeq;
    const use = (txt) => {
      const cues = parseVTT(toVTT(txt));
      if (!cues.length) return false;
      sub2Cache.set(cacheKey, cues);
      sub2Store(cacheKey, txt);
      if (!stale()) { st.cues2 = cues; drawCue(); }
      return true;
    };
    if (sub2Cache.has(cacheKey)) { st.cues2 = sub2Cache.get(cacheKey); drawCue(); return; }
    const saved = sub2Store(cacheKey);
    if (saved && use(saved)) return;
    const fails = [];
    /* 1) subtitles that exist as files (downloaded or next to the video) come straight from the server */
    if (s2.key) {
      for (let i = 0; i < 2 && !stale(); i++) {
        try { if (use(await fetchText(pmsURL(s2.key), { timeout: 25000, accept: '*/*' }))) return; fails.push('empty'); }
        catch (e) { fails.push(e.status || 'net'); }
        if (i === 0) await sleep(2500);
      }
    }
    if (stale()) return;
    /* 2) subtitles inside the video file: the server pulls the whole track out as text in the background
       (the same way Plex's own apps do it). Playback keeps going; this can take a minute or two. */
    toast(t('sub2Extracting'), 7000);
    const sess = newSession(), play = newSession();
    const who = { 'X-Plex-Client-Identifier': clientId + '-subs', 'X-Plex-Client-Profile-Name': 'Web', 'X-Plex-Platform': 'Chrome', 'X-Plex-Session-Identifier': play };
    const common = Object.assign({
      hasMDE: 1, path: '/library/metadata/' + m.ratingKey, mediaIndex: 0, partIndex: 0, fastSeek: 1,
      directPlay: 1, directStream: 1, directStreamAudio: 1, subtitleSize: 100, audioBoost: 100, videoQuality: 100,
      videoResolution: '4096x2160', location: S.server.local ? 'lan' : 'wan', mediaBufferSize: 50000,
      session: sess, subtitles: 'sidecar', subtitleStreamID: s2.id
    }, /^(ass|ssa)$/i.test(s2.codec || '') ? { advancedSubtitles: 'text' } : {}, who);
    /* the server extracts whichever subtitle is selected on the file, so select this one for a moment */
    try { await fetch(pmsURL('/library/parts/' + part.id, { subtitleStreamID: s2.id, allParts: 1 }), { method: 'PUT' }); } catch (e) { /* ignore */ }
    let ok = false;
    try {
      await fetchText(pmsURL('/video/:/transcode/universal/decision', Object.assign({}, common, { protocol: 'hls' })), { timeout: 20000 });
      const txt = await fetchText(pmsURL('/subtitles/:/transcode/universal/start', Object.assign({}, common, { protocol: 'http', copyts: 1, offset: 0 })), { timeout: 180000, accept: '*/*' });
      ok = use(txt);
      if (!ok) fails.push('empty');
    } catch (e) { fails.push(e.status || (e.name === 'AbortError' ? 'timeout' : 'net')); }
    finally {
      /* put the file's normal subtitle selection back */
      try { await fetch(pmsURL('/library/parts/' + part.id, { subtitleStreamID: st.subId || 0, allParts: 1 }), { method: 'PUT' }); } catch (e) { /* ignore */ }
      fetch(pmsURL('/video/:/transcode/universal/stop', Object.assign({ session: sess }, who))).catch(() => {});
    }
    if (ok) { if (!stale()) toast(t('sub2Ready'), 3000); return; }
    if (stale()) return;
    st.sub2Id = 0; store.set('sub2.' + m.ratingKey, 0); refreshStatic();
    toast(t('sub2Failed') + ' [' + Array.from(new Set(fails)).join(', ') + ']', 12000);
  }
  function openSub2() {
    const usable = subs.filter(textCodec);
    const other = subs.filter((x) => !textCodec(x));
    const pick = (id) => { closeModal(); st.sub2Id = id; store.set('sub2.' + m.ratingKey, id); refreshStatic(); loadSub2(); };
    openModal(sheetHeader(t('sub2'), t('sub2Note')) + '<div class="optlist">' +
      optionRow('s2-0', t('off'), [], !st.sub2Id, A(() => pick(0))) +
      usable.map((x) => { const r = subRow(x); return optionRow('s2-' + x.id, subLangName(x), r.tags, st.sub2Id === x.id, A(() => pick(x.id)), r.sub); }).join('') + '</div>' +
      '<div class="optlist"><div class="subrow dlrow-sub f" data-key="s2-dl" data-act="' + A(() => openSubPicker({
        ratingKey: m.ratingKey, part: part, subs: subs, second: true,
        onSecond: (added) => { toast(t('subPreparing'), 3500); setTimeout(() => { if (seq === viewSeq) pick(added.id); }, 2500); }
      })) + '"><span class="chk">' + ICON.download + '</span><span class="lang">' + esc(t('downloadSubs')) + '<small>' + esc(t('sub2DlNote')) + '</small></span></div></div>' +
      (other.length ? '<p class="sheettext">' + esc(t('sub2Images', { n: other.length })) + '</p>' : ''), 's2-' + (st.sub2Id || 0));
    pl.classList.remove('idle');
  }
  function openAudio() {
    openModal(sheetHeader(t('audioTracks'), t('onFile')) + '<div class="optlist">' + audios.map((a) => {
      const tags = [];
      if (a.codec) tags.push(String(a.codec).toUpperCase());
      if (a.channels) tags.push(a.channels >= 8 ? '7.1' : a.channels >= 6 ? '5.1' : a.channels === 2 ? 'STEREO' : a.channels + 'CH');
      if (/commentary/i.test(a.title || a.displayTitle || '')) tags.push(t('commentary'));
      return optionRow('aud-' + a.id, a.language || a.displayTitle || '?', tags, a.id === st.audioId, A(() => chooseAudio(a.id)), a.title || a.displayTitle || '');
    }).join('') + '</div>', 'aud-' + st.audioId);
    pl.classList.remove('idle');
  }
  function openQuality() {
    pickQuality(st.quality, (id) => { st.quality = id; closeModal(); restart(); }, st.direct ? t('directPlay') : t('transcoding'),
      '<span class="label">' + esc(t('directPlay')) + '</span><div class="optlist">' +
      optionRow('fd', t('forceDirect'), [], S.forceDirect, A(() => { S.forceDirect = !S.forceDirect; store.set('forceDirect', S.forceDirect); st.quality = 'orig'; closeModal(); restart(); }), t('forceDirectNote')) + '</div>');
    pl.classList.remove('idle');
  }
  async function chooseSub(id) {
    closeModal();
    if (id === st.subId) return;
    const at = position();
    try { await fetch(pmsURL('/library/parts/' + part.id, { subtitleStreamID: id, allParts: 1 }), { method: 'PUT' }); } catch (e) { /* ignore */ }
    st.subId = id;
    start(at);
  }
  async function chooseAudio(id) {
    closeModal();
    if (id === st.audioId) return;
    const at = position();
    try { await fetch(pmsURL('/library/parts/' + part.id, { audioStreamID: id, allParts: 1 }), { method: 'PUT' }); } catch (e) { /* ignore */ }
    st.audioId = id;
    start(at);
  }

  /* progress reporting so Continue Watching stays in sync */
  let lastReport = 0;
  function report(state) {
    const ms = Math.floor(position() * 1000);
    if (!ms) return;
    fetch(pmsURL('/:/timeline', { ratingKey: m.ratingKey, key: '/library/metadata/' + m.ratingKey, state: state, time: ms, duration: durMs })).catch(() => {});
  }
  vid.addEventListener('timeupdate', drawCue);

  vid.addEventListener('seeked', drawCue);
  const cueTimer = setInterval(() => { if ((st.cues.length || st.cues2.length) && !vid.paused) drawCue(); }, 150);
  const ticker = setInterval(() => {
    updateUI();
    if (Date.now() - lastReport > 10000 && !vid.paused && st.hold == null) { lastReport = Date.now(); report('playing'); }
  }, 500);

  vid.addEventListener('playing', () => { st.recover = 0; st.hold = null; $('#spin').hidden = true; updateUI(); wake(); });
  vid.addEventListener('seeked', () => { st.hold = null; updateUI(); });
  vid.addEventListener('waiting', () => { $('#spin').hidden = false; });
  vid.addEventListener('pause', () => { updateUI(); if (st.hold == null) report('paused'); wake(); });
  vid.addEventListener('ended', () => { report('stopped'); back(); });

  keyHandler = (e) => {
    const k = e.key;
    if (modalOpen()) return false;
    if (k === ' ') { togglePlay(); return true; }
    if (pl.classList.contains('idle')) {
      if (k === 'Escape' || k === 'Backspace') return false; /* controls hidden: Back leaves the player */
      /* skipping with the controls hidden selects the timeline, so further Left/Right keep skipping;
         the buttons are only walked through after opening the controls with OK, Up or Down */
      if (k === 'ArrowLeft') { setFocus($('#track'), true); seekBy(-10); return true; }
      if (k === 'ArrowRight') { setFocus($('#track'), true); seekBy(30); return true; }
      /* like the Plex app: the first press only brings up the controls (Play/Pause focused),
         a second press pauses; with no second press the controls hide again after a few seconds */
      if (k === 'ArrowDown') { setInfo(true); setFocus($('#pp'), true); return true; }
      /* while "Skip intro" / "Skip credits" is showing, OK skips */
      if (k === 'Enter' && st.skip) { doSkip(); return true; }
      wake(); setFocus($('#pp'), true); return true;
    }
    wake();
    const inInfo = focused && focused.closest('#info');
    if (focused && focused.id === 'track') {
      if (k === 'Enter') { togglePlay(); return true; }
      if (k === 'ArrowLeft') { seekBy(-10); return true; }
      if (k === 'ArrowRight') { seekBy(30); return true; }
    }
    if (k === 'ArrowDown') {
      if (!st.info && focused && focused.closest('.controls')) { setInfo(true); setFocus($('#more'), true); return true; }
      move('d');
      return true;
    }
    if (k === 'ArrowUp') {
      if (inInfo) { move('u'); return true; }
      if (focused && focused.closest('.controls') && st.info) { setInfo(false); return true; }
      return false;
    }
    if ((k === 'Escape' || k === 'Backspace') && st.info) { setInfo(false); setFocus($('#pp'), true); return true; }
    /* Back while the controls are showing over a playing video: just hide them */
    if ((k === 'Escape' || k === 'Backspace') && !vid.paused && !pl.classList.contains('idle')) { clearTimeout(st.idleTimer); pl.classList.add('idle'); return true; }
    return false;
  };
  pl.addEventListener('mousemove', wake);
  vid.addEventListener('loadedmetadata', function wtHook() { vid.removeEventListener('loadedmetadata', wtHook); if (typeof wtOnPlayer === 'function' && wtOnPlayer(vid, m.ratingKey)) { refreshStatic(); } });
  $('#skipbtn').addEventListener('click', (e) => { e.stopPropagation(); doSkip(); });
  $('#track').addEventListener('click', (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    st.pending = null;
    seekTo((e.clientX - r.left) / r.width * (durMs / 1000));
  });

  cleanup = () => {
    if (typeof wtOnPlayerClosed === 'function') wtOnPlayerClosed(vid);
    clearInterval(ticker);
    clearInterval(cueTimer);
    clearTimeout(st.idleTimer);
    clearTimeout(seekTimer);
    report('stopped');
    if (st.hls) st.hls.destroy();
    vid.pause();
    vid.removeAttribute('src');
    vid.load();
    if (!st.direct) stopTranscode();
  };

  st.direct = true; /* so the first start() does not send a stop for a session that never ran */
  {
    const at0 = opts.fromStart ? 0 : opts.at != null ? opts.at : (m.viewOffset || 0) / 1000;
    start(at0);
    if (st.sub2Id) loadSub2();
  }
  applyTrack();
  if (opts.info) {
    setInfo(true);
    initFocus(opts.focusKey || 'more');
    if (opts.castKey) openCast(opts.castKey);
  } else initFocus('pp');
  wake();
}

/* ---------- boot ---------- */
async function boot() {
  applyTheme();
  applyFont();
  if (!S.token) return replaceView(viewLogin);
  if (!S.account) loadAccount();
  if (S.server) {
    try {
      await getJSON(S.server.uri + '/identity?' + plexParams({ 'X-Plex-Token': S.server.token }), { timeout: 6000 });
      return replaceView(viewHome);
    } catch (e) { /* look the server up again */ }
  }
  replaceView(viewServers);
}
boot();
