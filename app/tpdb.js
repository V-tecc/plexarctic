'use strict';
/* PLEX:arctic — ThePosterDB (theposterdb.com) in the artwork picker.
   TPDb has no public API: like the other community tools, the app signs in with your own TPDb account and
   reads the site's pages (search, title pages, sets). Posters are downloaded with that session and uploaded
   to Plex, so they work in every Plex app afterwards. Works on the TV; a normal browser blocks it (CORS). */

const TPDB = 'https://theposterdb.com';
let tpdbOk = false;
const tpdbCache = new Map(); /* path -> { at, doc } for 10 minutes, so going back and forth doesn't reload */

function tpdbUser() { return store.get('tpdbUser', '') || (window.PRESET && window.PRESET.tpdbUser) || ''; }
function tpdbPass() { return store.get('tpdbPass', '') || (window.PRESET && window.PRESET.tpdbPass) || ''; }
function tpdbReady() { return !!(tpdbUser() && tpdbPass()); }

async function tpdbGet(path, opts) {
  let r;
  try { r = await fetch(/^https?:/.test(path) ? path : TPDB + path, Object.assign({ credentials: 'include', redirect: 'follow' }, opts || {})); } catch (e) { throw new Error(window.IS_TV ? t('tpdbNet') : t('tpdbTvOnly')); }
  return { status: r.status, url: r.url || '', text: await r.text() };
}
const tpdbAtLogin = (u) => /\/login\/?(\?|$)/.test(u);
function tpdbBlocked(h) { return /just a moment|cf-chl|challenge-platform|attention required!/i.test(String(h).slice(0, 4000)); }
function tpdbCsrf(h) {
  const m = /<meta[^>]+name=["']csrf-token["'][^>]+content=["']([^"']+)["']/i.exec(h) || /<input[^>]+name=["']_token["'][^>]+value=["']([^"']+)["']/i.exec(h);
  return m ? m[1].replace(/&amp;/g, '&') : '';
}
async function tpdbLogin(force) {
  if (tpdbOk && !force) return;
  if (!tpdbReady()) throw new Error(t('tpdbNoLogin'));
  const p = await tpdbGet('/login');
  if (tpdbBlocked(p.text)) throw new Error(t('tpdbCloudflare'));
  /* a session from before is still good: the login page sends us on */
  if (p.url && !tpdbAtLogin(p.url) && !/name=["']password["']/i.test(p.text)) { tpdbOk = true; return; }
  const u = tpdbUser();
  const body = new URLSearchParams({ _token: tpdbCsrf(p.text), email: u, login: u, password: tpdbPass(), remember: 'on' });
  const r = await tpdbGet('/login', { method: 'POST', body: body.toString(), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  if (tpdbBlocked(r.text)) throw new Error(t('tpdbCloudflare'));
  if (r.status >= 400) throw new Error('HTTP ' + r.status);
  const low = r.text.toLowerCase();
  if ((tpdbAtLogin(r.url) && /name=["']password["']/.test(low)) || /credentials do not match|do not match our records|the provided credentials/.test(low)) throw new Error(t('tpdbBadLogin'));
  tpdbOk = true;
}
async function tpdbPage(path) {
  const c = tpdbCache.get(path);
  if (c && Date.now() - c.at < 600000) return c.doc;
  await tpdbLogin();
  let r = await tpdbGet(path);
  if (r.status === 401 || r.status === 419 || tpdbAtLogin(r.url)) { tpdbOk = false; await tpdbLogin(true); r = await tpdbGet(path); }
  if (tpdbBlocked(r.text)) throw new Error(t('tpdbCloudflare'));
  if (r.status >= 400) throw new Error('HTTP ' + r.status);
  const doc = new DOMParser().parseFromString(r.text, 'text/html');
  tpdbCache.set(path, { at: Date.now(), doc: doc });
  return doc;
}

/* "Star Wars (1977)" -> { name: 'Star Wars', year: 1977 }; "The Mandalorian (2019) - Season 2" -> season 2 */
function tpdbParseTitle(s) {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  const o = { raw: s, season: null, specials: false };
  let m = /\s+-\s+(season\s+(\d+)|specials)\s*$/i.exec(s);
  if (m) { if (m[2]) o.season = +m[2]; else o.specials = true; s = s.slice(0, m.index); }
  m = /\s*\((\d{4})\)\s*$/.exec(s);
  if (m) { o.year = +m[1]; s = s.slice(0, m.index); }
  o.name = s.trim();
  return o;
}
function tpdbNorm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/^(the|a|an) /, '').trim();
}

/* Search results: the titles (each with its own page of posters) */
async function tpdbSearch(term, section) {
  const doc = await tpdbPage('/search?term=' + encodeURIComponent(term) + '&section=' + section);
  const out = [], seen = new Set();
  doc.querySelectorAll('a[href*="/posters/"]').forEach((a) => {
    const m = /\/posters\/(\d+)/.exec(a.getAttribute('href') || '');
    const title = (a.textContent || '').replace(/\s+/g, ' ').trim();
    if (!m || !title || seen.has(m[1])) return;
    seen.add(m[1]);
    out.push(Object.assign({ id: m[1] }, tpdbParseTitle(title)));
  });
  return out;
}
/* The poster cards on a title page or a set page */
function tpdbGrid(doc) {
  const out = [], seen = new Set();
  doc.querySelectorAll('[data-poster-id]').forEach((el) => {
    const id = el.getAttribute('data-poster-id');
    if (!id || seen.has(id)) return;
    seen.add(id);
    let card = el;
    while (card.parentElement && !/\bcol-6\b|\bcol-lg-2\b/.test(card.className || '') && card.parentElement !== doc.body) card = card.parentElement;
    const p = card.querySelector('p.text-break') || card.querySelector('p');
    const title = p ? p.textContent.replace(/\s+/g, ' ').trim() : '';
    const typed = Array.from(card.querySelectorAll('[title]')).map((x) => x.getAttribute('title')).find((x) => /^(movie|show|collection|season)$/i.test(x || '')) || '';
    const srcEl = card.querySelector('source[srcset]');
    const img = card.querySelector('img');
    let thumb = srcEl ? srcEl.getAttribute('srcset').split(/\s+/)[0] : img ? (img.getAttribute('data-src') || img.getAttribute('src') || '') : '';
    if (!/^https?:/.test(thumb) || /missing_poster/.test(thumb)) thumb = TPDB + '/api/assets/' + id;
    const setA = card.querySelector('a.set_poster_count') || card.querySelector('a[href*="/set/"]');
    const setM = setA && /\/set\/(\d+)/.exec(setA.getAttribute('href') || '');
    const info = tpdbParseTitle(title);
    out.push(Object.assign(info, {
      id: id, title: title, kind: info.season != null || info.specials ? 'season' : (typed || '').toLowerCase(),
      thumb: thumb, setId: setM ? setM[1] : '', setSize: setA ? parseInt((setA.textContent || '').replace(/\D/g, ''), 10) || 0 : 0
    }));
  });
  return out;
}
async function tpdbSet(id) {
  const doc = await tpdbPage('/set/' + id);
  const h = doc.querySelector('h1') || doc.querySelector('h2');
  return { id: id, title: h ? h.textContent.replace(/\s+/g, ' ').trim() : 'Set ' + id, posters: tpdbGrid(doc) };
}
/* the poster file, with the signed-in session */
async function tpdbAsset(id) {
  await tpdbLogin();
  let r = await fetch(TPDB + '/api/assets/' + id, { credentials: 'include' });
  if (!r.ok || !/image/.test(r.headers.get('content-type') || '')) { tpdbOk = false; await tpdbLogin(true); r = await fetch(TPDB + '/api/assets/' + id, { credentials: 'include' }); }
  if (!r.ok) throw new Error('TPDb ' + r.status);
  const b = await r.blob();
  if (!/image/.test(b.type || r.headers.get('content-type') || '')) throw new Error(t('tpdbNoImage'));
  return b;
}

/* Posters for one Plex item (movie, show, season or collection), for the artwork picker */
async function tpdbFor(m) {
  if (!tpdbReady()) return [];
  const isSeason = m.type === 'season';
  const name = isSeason ? m.parentTitle : m.title;
  const year = isSeason ? null : m.year;
  const section = m.type === 'movie' ? 'movies' : m.type === 'collection' ? 'collections' : 'shows';
  const term = m.type === 'collection' ? String(name).replace(/\s*(collection|samlingen|samling|kolekce)\s*$/i, '') : name;
  const hits = await tpdbSearch(term, section);
  const n = tpdbNorm(term);
  const score = (h) => (tpdbNorm(h.name) === n ? 4 : tpdbNorm(h.name).indexOf(n) >= 0 ? 1 : 0) + (year && h.year ? (h.year === year ? 3 : Math.abs(h.year - year) === 1 ? 1 : -3) : 0);
  const best = hits.map((h) => ({ h: h, s: score(h) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, m.type === 'collection' ? 3 : 1);
  let list = [];
  for (const b of best) list = list.concat(tpdbGrid(await tpdbPage('/posters/' + b.h.id)));
  if (isSeason) list = list.filter((p) => p.season === m.index || (m.index === 0 && p.specials));
  else list = list.filter((p) => p.kind !== 'season');
  return list.slice(0, 60).map((p) => ({ src: 'tpdb', id: p.id, thumb: p.thumb, full: p.id, setId: p.setId, setSize: p.setSize, title: p.title }));
}

/* ---------- a whole set onto the library ---------- */
async function tpdbMatchSet(set, editing) {
  const items = await allLibraryItems();
  const movies = items.filter((x) => x.type === 'movie'), shows = items.filter((x) => x.type === 'show');
  const pick = (list, p) => {
    const n = tpdbNorm(p.name);
    const cands = list.filter((x) => tpdbNorm(x.title) === n || (x.originalTitle && tpdbNorm(x.originalTitle) === n));
    return cands.find((x) => p.year && x.year === p.year) || cands.find((x) => p.year && x.year && Math.abs(x.year - p.year) <= 1) || (cands.length === 1 && !p.year ? cands[0] : null);
  };
  let colls = null;
  const out = [], missing = [];
  for (const p of set.posters) {
    let hit = null;
    if (p.kind === 'collection' || (!p.year && /collection|saga/i.test(p.name) && p.kind !== 'show')) {
      if (editing && editing.type === 'collection') hit = editing;
      else {
        if (!colls) {
          colls = [];
          const secs = ((await api('/library/sections')).Directory || []).filter((x) => x.type === 'movie');
          for (const s of secs) { try { colls = colls.concat((await api('/library/sections/' + s.key + '/collections')).Metadata || []); } catch (e) { /* none */ } }
        }
        const core = (s) => tpdbNorm(s).replace(/\b(the )?complete\b|\bcollection\b|\bsaga\b/g, '').replace(/\s+/g, ' ').trim();
        hit = colls.find((c) => core(c.title) === core(p.name)) || null;
      }
    } else if (p.kind === 'season') {
      const show = pick(shows, p);
      if (show) {
        try {
          const ss = (await api('/library/metadata/' + show.ratingKey + '/children')).Metadata || [];
          hit = ss.find((s) => (p.specials ? s.index === 0 : s.index === p.season)) || null;
        } catch (e) { hit = null; }
      }
    } else if (p.kind === 'show') hit = pick(shows, p);
    else if (p.kind === 'movie') hit = pick(movies, p);
    else hit = pick(movies, p) || pick(shows, p);
    if (hit) out.push({ p: p, item: hit }); else missing.push(p);
  }
  return { hits: out, missing: missing };
}
async function tpdbApplyOne(item, posterId) {
  const before = await artList(item.ratingKey, 'poster').catch(() => []);
  await artSelect(item, 'poster', { src: 'tpdb', id: posterId, full: posterId }, before);
}
async function tpdbApplySet(setId, editing, onDone) {
  toast(t('tpdbLoadingSet'), 4000);
  let set, match;
  try { set = await tpdbSet(setId); match = await tpdbMatchSet(set, editing); } catch (e) { toast(t('tpdbFail', { e: e.message || e }), 9000); return; }
  if (!match.hits.length) { toast(t('tpdbNoMatches'), 7000); return; }
  const lines = match.hits.map((h) => '<li>' + esc(h.p.title) + ' → ' + esc(h.item.type === 'season' ? (h.item.parentTitle + ' · ' + h.item.title) : h.item.title) + '</li>').join('');
  const miss = match.missing.length ? '<p class="sheettext small">' + esc(t('tpdbMissing', { n: match.missing.length })) + ' ' + esc(match.missing.slice(0, 12).map((p) => p.title).join(' · ')) + (match.missing.length > 12 ? ' …' : '') + '</p>' : '';
  openModal(sheetHeader(set.title, t('tpdbSetCount', { n: match.hits.length, m: set.posters.length })) +
    '<div class="optlist">' +
    optionRow('tps-go', t('tpdbApplyAll', { n: match.hits.length }), [], false, A(async () => {
      closeModal(true);
      let ok = 0, fail = 0;
      for (let i = 0; i < match.hits.length; i++) {
        const h = match.hits[i];
        toast(t('tpdbProgress', { i: i + 1, n: match.hits.length, s: h.p.title }), 4000);
        try { await tpdbApplyOne(h.item, h.p.id); ok++; } catch (e) { fail++; }
        await new Promise((res) => setTimeout(res, 350));
      }
      toast(t('tpdbSetDone', { n: ok }) + (fail ? ' · ' + t('tpdbSetFailed', { n: fail }) : ''), 7000);
      try { if (typeof libIndex !== 'undefined') libIndex = null; } catch (e) { /* ignore */ }
      try { libCache.clear(); } catch (e) { /* ignore */ }
      if (onDone) onDone(); else if (current && current.fn !== viewPlayer) rerun();
    })) +
    '</div><span class="label">' + esc(t('tpdbWillChange')) + '</span><ul class="tpdblist">' + lines + '</ul>' + miss, 'tps-go');
}
/* the number or link of a set, typed in */
function tpdbAskSet(editing, onDone) {
  openModal(sheetHeader(t('tpdbImportSet'), t('tpdbImportNote')) +
    '<input class="input f" id="tpset" data-key="tpset" data-okfocus data-act="' + A((el) => el.focus()) + '" type="text" spellcheck="false" autocomplete="off" placeholder="44420">' +
    '<button type="button" class="btn f" data-key="tpsetgo" data-act="' + A(() => {
      const v = ($('#tpset').value || '').trim();
      const m = /(?:set\/)?(\d{2,})/.exec(v);
      if (!m) { toast(t('tpdbBadSet'), 4000); return; }
      tpdbApplySet(m[1], editing, onDone);
    }) + '">' + esc(t('tpdbFind')) + '</button>', 'tpset');
}

/* Settings row: e-mail and password, and a test */
function tpdbSettingsHTML() {
  const inp = (id, val, ph, pw) => '<input class="input f" id="' + id + '" data-key="' + id + '" data-okfocus data-act="' + A((el) => el.focus()) + '" type="' + (pw ? 'password' : 'text') + '" spellcheck="false" autocomplete="off" placeholder="' + esc(ph) + '" value="' + esc(val) + '">';
  return inp('tpuser', tpdbUser(), t('tpdbUserPh')) + inp('tppass', '', tpdbPass() ? '••••••' : t('osPassPh'), true) +
    '<button type="button" class="btn f" data-key="tpsave" data-act="' + A(async () => {
      const u = $('#tpuser').value.trim(), p = $('#tppass').value;
      if (u) store.set('tpdbUser', u);
      if (p) store.set('tpdbPass', p);
      tpdbOk = false; tpdbCache.clear();
      try { await tpdbLogin(true); const hits = await tpdbSearch('Star Wars', 'movies'); toast(t('tpdbOkTest', { n: hits.length }), 6000); } catch (e) { toast(t('tpdbFail', { e: e.message || e }), 9000); }
    }) + '">' + esc(t('osTest')) + '</button>' +
    '<button type="button" class="btn f" data-key="tpimport" data-act="' + A(async () => {
      if (!(await isAdmin())) { toast(t('adminOnly'), 4000); return; }
      tpdbAskSet(null, null);
    }) + '">' + esc(t('tpdbImportSet')) + '</button>';
}

Object.assign(TEXT.en, {
  tpdbTitle: 'ThePosterDB', tpdbUserPh: 'TPDb e-mail or username', tpdbFromTpdb: 'From ThePosterDB', tpdbLoading: 'Looking on ThePosterDB…',
  tpdbNoLogin: 'Add your ThePosterDB login in Settings first', tpdbBadLogin: 'ThePosterDB login failed, check the e-mail and password',
  tpdbCloudflare: 'ThePosterDB asked for a robot check, try again in a while', tpdbNet: 'ThePosterDB could not be reached', tpdbTvOnly: 'ThePosterDB only works in the TV app',
  tpdbNoImage: 'ThePosterDB did not send a picture', tpdbFail: 'ThePosterDB: {e}', tpdbOkTest: 'ThePosterDB works ({n} results for Star Wars)',
  tpdbUseThis: 'Use this poster', tpdbUseSet: 'Use the whole set ({n} posters)', tpdbUseSetNote: 'Every title in the set that is in your library gets its poster',
  tpdbImportSet: 'Import a ThePosterDB set', tpdbImportNote: 'The set number or link, e.g. 44420', tpdbFind: 'Find the set', tpdbBadSet: 'That is not a set number',
  tpdbLoadingSet: 'Reading the set…', tpdbNoMatches: 'None of the set\'s titles are in your library', tpdbSetCount: '{n} of {m} posters match your library',
  tpdbApplyAll: 'Change {n} posters', tpdbWillChange: 'Will change', tpdbMissing: 'Not in your library ({n}):', tpdbProgress: 'Poster {i} of {n}: {s}',
  tpdbSetDone: '{n} posters changed', tpdbSetFailed: '{n} failed', tpdbNone: 'Nothing on ThePosterDB for this one', tpdbMore: 'ThePosterDB set…'
});
Object.assign(TEXT.sv, {
  tpdbUserPh: 'TPDb e-post eller användarnamn', tpdbFromTpdb: 'Från ThePosterDB', tpdbLoading: 'Letar på ThePosterDB…',
  tpdbNoLogin: 'Lägg in din ThePosterDB-inloggning i Inställningar först', tpdbBadLogin: 'Inloggningen på ThePosterDB misslyckades, kolla e-post och lösenord',
  tpdbCloudflare: 'ThePosterDB ville ha en robotkontroll, försök igen om en stund', tpdbNet: 'ThePosterDB gick inte att nå', tpdbTvOnly: 'ThePosterDB fungerar bara i TV-appen',
  tpdbNoImage: 'ThePosterDB skickade ingen bild', tpdbOkTest: 'ThePosterDB fungerar ({n} träffar på Star Wars)',
  tpdbUseThis: 'Använd den här postern', tpdbUseSet: 'Använd hela setet ({n} postrar)', tpdbUseSetNote: 'Alla titlar i setet som finns i ditt bibliotek får sin poster',
  tpdbImportSet: 'Importera ett set från ThePosterDB', tpdbImportNote: 'Setets nummer eller länk, t.ex. 44420', tpdbFind: 'Hitta setet', tpdbBadSet: 'Det är inget setnummer',
  tpdbLoadingSet: 'Läser setet…', tpdbNoMatches: 'Inga av setets titlar finns i ditt bibliotek', tpdbSetCount: '{n} av {m} postrar matchar ditt bibliotek',
  tpdbApplyAll: 'Byt {n} postrar', tpdbWillChange: 'Byts', tpdbMissing: 'Finns inte i biblioteket ({n}):', tpdbProgress: 'Poster {i} av {n}: {s}',
  tpdbSetDone: '{n} postrar bytta', tpdbSetFailed: '{n} misslyckades', tpdbNone: 'Inget på ThePosterDB för den här', tpdbMore: 'Set från ThePosterDB…'
});
Object.assign(TEXT.cs, {
  tpdbUserPh: 'E-mail nebo jméno na TPDb', tpdbFromTpdb: 'Z ThePosterDB', tpdbLoading: 'Hledám na ThePosterDB…',
  tpdbNoLogin: 'Nejdřív zadejte přihlášení k ThePosterDB v Nastavení', tpdbBadLogin: 'Přihlášení k ThePosterDB selhalo, zkontrolujte e-mail a heslo',
  tpdbUseThis: 'Použít tento plakát', tpdbUseSet: 'Použít celou sadu ({n} plakátů)', tpdbImportSet: 'Importovat sadu z ThePosterDB', tpdbFind: 'Najít sadu',
  tpdbApplyAll: 'Změnit {n} plakátů', tpdbSetDone: 'Změněno plakátů: {n}', tpdbMore: 'Sada z ThePosterDB…'
});
Object.assign(TEXT.uk, {
  tpdbUserPh: 'E-mail або ім’я на TPDb', tpdbFromTpdb: 'З ThePosterDB', tpdbLoading: 'Шукаю на ThePosterDB…',
  tpdbNoLogin: 'Спершу додайте вхід до ThePosterDB у Налаштуваннях', tpdbBadLogin: 'Не вдалося увійти в ThePosterDB, перевірте e-mail і пароль',
  tpdbUseThis: 'Використати цей постер', tpdbUseSet: 'Використати весь набір ({n} постерів)', tpdbImportSet: 'Імпортувати набір з ThePosterDB', tpdbFind: 'Знайти набір',
  tpdbApplyAll: 'Змінити {n} постерів', tpdbSetDone: 'Змінено постерів: {n}', tpdbMore: 'Набір з ThePosterDB…'
});
Object.assign(TEXT.el, {
  tpdbUserPh: 'E-mail ή όνομα στο TPDb', tpdbFromTpdb: 'Από το ThePosterDB', tpdbLoading: 'Αναζήτηση στο ThePosterDB…',
  tpdbNoLogin: 'Προσθέστε πρώτα τη σύνδεση ThePosterDB στις Ρυθμίσεις', tpdbBadLogin: 'Η σύνδεση στο ThePosterDB απέτυχε, ελέγξτε e-mail και κωδικό',
  tpdbUseThis: 'Χρήση αυτής της αφίσας', tpdbUseSet: 'Χρήση όλου του σετ ({n} αφίσες)', tpdbImportSet: 'Εισαγωγή σετ από το ThePosterDB', tpdbFind: 'Εύρεση σετ',
  tpdbApplyAll: 'Αλλαγή {n} αφισών', tpdbSetDone: 'Άλλαξαν {n} αφίσες', tpdbMore: 'Σετ από το ThePosterDB…'
});
