/* PLEX:arctic — screen saver.
   After a while without a key press: a slow slideshow of backdrops with the title and a clock.
   In menus it shows films and shows from the library; with a film paused in the player it shows that
   title's own backdrops (Plex already has them, a handful at most). Any key brings the app back. */
'use strict';

const SAVER_STEP = 14000;          /* each picture stays this long */
let saverLast = Date.now();        /* last key press */
let saverOn = false, saverTimer = null, saverPics = [], saverIdx = 0, saverLayer = 0, saverPaused = null;

function saverMinutes() { let v = store.get(userKey('saverMin'), null); if (v == null) v = store.get('saverMin', 10); return v == null ? 10 : Number(v); }

/* a key: note it, and if the saver is up, just close it (the key does nothing else) */
window.addEventListener('keydown', (e) => {
  saverLast = Date.now();
  if (!saverOn) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  saverStop();
}, true);
['mousemove', 'mousedown', 'wheel'].forEach((ev) => window.addEventListener(ev, () => { saverLast = Date.now(); if (saverOn) saverStop(); }, true));

/* is something playing? then no saver */
function saverPlaying() {
  const v = document.getElementById('vid');
  return !!(v && document.contains(v) && !v.paused && !v.ended);
}

setInterval(() => {
  const min = saverMinutes();
  if (!min || saverOn || !S.server || !S.token) return;
  if (saverPlaying()) { saverLast = Date.now(); return; }
  if (Date.now() - saverLast >= min * 60000) saverStart().catch(() => {});
}, 15000);

async function saverPictures() {
  /* paused in the player: that title's own backdrops */
  if (current && current.fn === viewPlayer && current.args && current.args[0]) {
    const key = current.args[0];
    try {
      const m = ((await api('/library/metadata/' + key)).Metadata || [])[0];
      if (m) {
        const ep = m.type === 'episode';
        const showKey = ep ? m.grandparentRatingKey : m.ratingKey;
        let arts = [];
        try { arts = ((await api('/library/metadata/' + showKey + '/arts')).Metadata || []).map((a) => a.key || a.thumb).filter(Boolean); } catch (e) { arts = []; }
        const own = ep ? (m.grandparentArt || m.art) : m.art;
        const list = [own].concat(arts.filter((a) => a !== own)).filter(Boolean).slice(0, 4);
        if (list.length) {
          const vid = document.getElementById('vid');
          saverPaused = { title: ep ? m.grandparentTitle : m.title, sub: ep ? epCode(m) + ' · ' + m.title : (m.year || ''), at: vid ? vid.currentTime : 0, dur: (m.duration || 0) / 1000 };
          return list.map((a) => ({ art: a, title: saverPaused.title, sub: saverPaused.sub, key: ep ? showKey : m.ratingKey }));
        }
      }
    } catch (e) { /* fall through to the library */ }
  }
  saverPaused = null;
  /* elsewhere: random films and shows that have a backdrop */
  let secs = [];
  try { secs = ((await api('/library/sections')).Directory || []).filter((s) => s.type === 'movie' || s.type === 'show'); } catch (e) { secs = []; }
  let items = [];
  for (const s of secs.slice(0, 4)) {
    try {
      const r = await api('/library/sections/' + s.key + '/all', { type: s.type === 'movie' ? 1 : 2, sort: 'random', 'X-Plex-Container-Start': 0, 'X-Plex-Container-Size': 20 });
      items = items.concat((r.Metadata || []).filter((m) => m.art));
    } catch (e) { /* next section */ }
  }
  for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const x = items[i]; items[i] = items[j]; items[j] = x; }
  return items.slice(0, 30).map((m) => ({ art: m.art, title: m.title, key: m.ratingKey, sub: [m.year, (m.Genre || [])[0] && m.Genre[0].tag].filter(Boolean).join(' · ') }));
}

async function saverStart() {
  saverOn = true;
  const pics = await saverPictures();
  if (!saverOn) return;
  if (!pics.length) { saverOn = false; saverLast = Date.now(); return; }
  saverPics = pics; saverIdx = 0; saverLayer = 0;
  let el = document.getElementById('saver');
  if (!el) {
    el = document.createElement('div');
    el.id = 'saver';
    el.className = 'saver';
    el.innerHTML = '<img class="svimg a" alt=""><img class="svimg b" alt=""><div class="svshade"></div>' +
      '<div class="svinfo" id="svinfo"><div class="svclock" id="svclock"></div><div class="svdate" id="svdate"></div>' +
      '<div class="svtitle" id="svtitle"></div><div class="svsub" id="svsub"></div>' +
      '<div class="svfact" id="svfact"><span class="svfacth"></span><span class="svfactt"></span></div></div>';
    document.getElementById('stage').appendChild(el);
  }
  /* the TV's own screen saver stays out of the way while this one runs */
  try { webapis.appcommon.setScreenSaver(webapis.appcommon.AppCommonScreenSaverState.SCREEN_SAVER_OFF); } catch (e) { /* not a TV */ }
  el.classList.add('on');
  saverShow();
  saverTimer = setInterval(saverShow, SAVER_STEP);
}

function saverShow() {
  const el = document.getElementById('saver');
  if (!el || !saverOn) return;
  const p = saverPics[saverIdx % saverPics.length];
  saverIdx++;
  const img = el.querySelectorAll('.svimg')[saverLayer];
  const other = el.querySelectorAll('.svimg')[1 - saverLayer];
  const url = imgURL(p.art, 1920, 1080);
  const pre = new Image();
  pre.onload = pre.onerror = () => {
    if (!saverOn) return;
    img.src = url;
    /* a slow drift, a different way each time */
    img.style.transformOrigin = ['20% 30%', '80% 30%', '30% 70%', '70% 70%'][saverIdx % 4];
    img.style.transform = '';
    img.classList.remove('show'); void img.offsetWidth; img.classList.add('show');
    /* the one fading out keeps the size its slow zoom had reached (no jump back while it fades) */
    try { other.style.transform = getComputedStyle(other).transform; } catch (e) { /* ignore */ }
    other.classList.remove('show');
    saverLayer = 1 - saverLayer;
    const tick = () => {
      const now = new Date();
      const c = document.getElementById('svclock'); if (c) c.textContent = now.toLocaleTimeString(lang().locale, { hour: '2-digit', minute: '2-digit' });
      const d = document.getElementById('svdate'); if (d) d.textContent = now.toLocaleDateString(lang().locale, { weekday: 'long', day: 'numeric', month: 'long' });
    };
    tick();
    const ti = document.getElementById('svtitle'), su = document.getElementById('svsub');
    if (ti) ti.textContent = p.title || '';
    if (su) su.textContent = saverPaused ? t('saverPaused', { s: p.sub, t: tc(saverPaused.at) + (saverPaused.dur ? ' / ' + tc(saverPaused.dur) : '') }) : (p.sub || '');
    saverFactShow(p);
    /* the next picture's fact is looked up while this one shows */
    const nx = saverPics[saverIdx % saverPics.length]; if (nx) saverFact(nx).catch(() => {});
    /* the text moves a little each time, so nothing stays burnt in one place */
    const info = document.getElementById('svinfo');
    if (info) { info.style.left = (90 + Math.round(Math.random() * 90)) + 'px'; info.style.bottom = (80 + Math.round(Math.random() * 70)) + 'px'; }
  };
  pre.src = url;
}

function saverStop() {
  saverOn = false;
  clearInterval(saverTimer); saverTimer = null;
  saverLast = Date.now();
  const el = document.getElementById('saver');
  if (el) el.classList.remove('on');
  try { webapis.appcommon.setScreenSaver(webapis.appcommon.AppCommonScreenSaverState.SCREEN_SAVER_ON); } catch (e) { /* not a TV */ }
}
/* the clock keeps going between pictures */
setInterval(() => {
  if (!saverOn) return;
  const c = document.getElementById('svclock');
  if (c) c.textContent = new Date().toLocaleTimeString(lang().locale, { hour: '2-digit', minute: '2-digit' });
}, 20000);

/* ---------- Plex stats in the screen saver ----------
   Lines built from your own library and viewing history, so they are always true. Each picture gets one:
   about the title on screen or about the library / your viewing / the server, never one shown recently. */
let saverCtx = null;               /* { at, items, hist, me } built once per half hour */
const saverRecent = [];            /* stat ids shown lately, so nothing comes back too soon */
const saverTitle = new Map();      /* ratingKey -> full metadata */
const nfmt = (n) => Number(n).toLocaleString(lang().locale);
const hrs = (sec) => { const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60); return h ? t('stH', { h: nfmt(h), m: m }) : t('stM', { m: m }); };
const dayName = (d) => d.toLocaleDateString(lang().locale, { weekday: 'long' });
const dateTxt = (sec) => new Date(sec * 1000).toLocaleDateString(lang().locale, { day: 'numeric', month: 'long', year: 'numeric' });
const nFilms = (n) => t(n === 1 ? 'stFilm1' : 'stFilmN', { n: nfmt(n) }), nEps = (n) => t(n === 1 ? 'stEp1' : 'stEpN', { n: nfmt(n) });
const monthTxt = (sec) => new Date(sec * 1000).toLocaleDateString(lang().locale, { month: 'long', year: 'numeric' });

async function saverContext() {
  if (saverCtx && Date.now() - saverCtx.at < 30 * 60000) return saverCtx;
  const ctx = { at: Date.now(), items: [], hist: [], me: null, names: {} };
  try { ctx.items = await allLibraryItems(); } catch (e) { ctx.items = []; }
  /* the history needs the owner's token; the current profile is found by name */
  if (S.adminToken) {
    try {
      const acc = ((await getJSON(ownerURL('/accounts'))).MediaContainer || {}).Account || [];
      acc.forEach((a) => { ctx.names[a.id] = a.name; });
      const myName = (S.user && S.user.title) || (S.account && S.account.title) || '';
      const mine = acc.find((a) => a.name === myName) || (!S.user ? acc.find((a) => String(a.id) === '1') : null);
      ctx.me = mine ? String(mine.id) : null;
      const since = Math.floor(Date.now() / 1000) - 400 * 86400;
      for (let start = 0; start < 10000; start += 2500) {
        const page = (((await getJSON(ownerURL('/status/sessions/history/all', { sort: 'viewedAt:desc', 'viewedAt>': since, 'X-Plex-Container-Start': start, 'X-Plex-Container-Size': 2500 }))).MediaContainer || {}).Metadata) || [];
        ctx.hist = ctx.hist.concat(page);
        if (page.length < 2500) break;
      }
    } catch (e) { /* not the owner's server: stats from the library only */ }
  }
  saverCtx = ctx;
  return ctx;
}

/* every stat that fits right now: [id, heading, text] */
async function saverStats(p) {
  const ctx = await saverContext();
  const out = [];
  const add = (id, head, text) => { if (text) out.push([id, head, text]); };
  const H_LIB = t('stLib'), H_ME = t('stMe'), H_SRV = t('stSrv'), H_T = t('stThis');
  const now = Date.now() / 1000;
  const movies = ctx.items.filter((x) => x.type === 'movie'), shows = ctx.items.filter((x) => x.type === 'show');
  const mine = ctx.me ? ctx.hist.filter((h) => String(h.accountID) === ctx.me) : [];
  const durOf = new Map(ctx.items.map((x) => [String(x.ratingKey), x.duration || 0]));
  const hDur = (h) => (h.type === 'episode' ? 45 * 60 : (durOf.get(String(h.ratingKey)) || 0) / 1000 || 6000);

  /* --- the title on screen --- */
  let m = null;
  if (p && p.key) {
    m = saverTitle.get(p.key);
    if (!m) { try { m = ((await api('/library/metadata/' + p.key)).Metadata || [])[0] || null; } catch (e) { m = null; } if (m) saverTitle.set(p.key, m); }
  }
  if (m) {
    const T = m.title, show = m.type === 'show';
    const views = ctx.hist.filter((h) => String(show ? h.grandparentRatingKey : h.ratingKey) === String(m.ratingKey));
    const who = Array.from(new Set(views.map((h) => ctx.names[h.accountID]).filter(Boolean)));
    if (!show && m.viewCount > 1) add('t-seen-' + m.ratingKey, H_T, t('stSeenN', { t: T, n: m.viewCount }) + (m.lastViewedAt ? ' ' + t('stLastTime', { d: monthTxt(m.lastViewedAt) }) : ''));
    else if (!show && m.viewCount === 1 && m.lastViewedAt) add('t-seen1-' + m.ratingKey, H_T, t('stSeen1', { t: T, d: dateTxt(m.lastViewedAt) }));
    else if (!show && !m.viewCount) add('t-unseen-' + m.ratingKey, H_T, t('stUnseen', { t: T }));
    if (who.length >= 2) add('t-who-' + m.ratingKey, H_T, t('stWho', { t: T, w: who.slice(0, 4).join(', ') }));
    if (show && m.leafCount) {
      const left = m.leafCount - (m.viewedLeafCount || 0);
      add('t-eps-' + m.ratingKey, H_T, left > 0 ? t('stEpsLeft', { t: T, n: left, m: m.leafCount }) : t('stEpsAll', { t: T, m: m.leafCount }));
      if (views.length >= 3) add('t-epsw-' + m.ratingKey, H_T, t('stEpsWatched', { t: T, n: views.length }));
    }
    if (m.addedAt) add('t-added-' + m.ratingKey, H_T, t('stAdded', { t: T, d: monthTxt(m.addedAt) }));
    if (!show && m.duration) {
      const end = new Date(Date.now() + m.duration);
      add('t-ends-' + m.ratingKey, H_T, t('stEndsAt', { t: T, h: hhmm(end) }));
      const avg = movies.reduce((a, x) => a + (x.duration || 0), 0) / Math.max(1, movies.filter((x) => x.duration).length);
      if (avg && m.duration < avg * 0.85) add('t-short-' + m.ratingKey, H_T, t('stShorter', { t: T, n: Math.round((avg - m.duration) / 60000) }));
      if (avg && m.duration > avg * 1.25) add('t-long-' + m.ratingKey, H_T, t('stLonger', { t: T, n: Math.round((m.duration - avg) / 60000) }));
    }
    const rank = movies.filter((x) => x.viewCount).sort((a, b) => b.viewCount - a.viewCount).findIndex((x) => String(x.ratingKey) === String(m.ratingKey));
    if (rank >= 0 && rank < 10 && m.viewCount > 1) add('t-top-' + m.ratingKey, H_T, t('stTopTen', { t: T, n: rank + 1 }));
    const r = Number(m.audienceRating || m.rating || 0);
    if (r >= 8) add('t-rate-' + m.ratingKey, H_T, t('stRated', { t: T, r: r.toFixed(1) }));
  }

  /* --- the library --- */
  if (movies.length) add('l-size', H_LIB, t('stLibSize', { f: nfmt(movies.length), s: nfmt(shows.length) }));
  const totalSec = movies.reduce((a, x) => a + (x.duration || 0), 0) / 1000;
  if (totalSec > 3600) add('l-hours', H_LIB, t('stLibHours', { h: nfmt(Math.round(totalSec / 3600)), d: nfmt(Math.round(totalSec / 86400)) }));
  const unseen = movies.filter((x) => !x.viewCount);
  if (unseen.length) {
    const us = unseen.reduce((a, x) => a + (x.duration || 0), 0) / 1000;
    add('l-unseen', H_LIB, t('stUnseenLib', { n: nfmt(unseen.length), d: nfmt(Math.max(1, Math.round(us / 86400))) }));
  }
  const newest = ctx.items.slice().sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))[0];
  if (newest && newest.addedAt) { const dd = Math.floor((now - newest.addedAt) / 86400); add('l-new', H_LIB, t(dd < 1 ? 'stNewestToday' : dd < 2 ? 'stNewestYday' : 'stNewest', { t: newest.title, n: dd })); }
  const dated = movies.filter((x) => x.year).sort((a, b) => a.year - b.year);
  if (dated.length) add('l-old', H_LIB, t('stOldest', { t: dated[0].title, y: dated[0].year }));
  if (dated.length > 20) {
    const dec = {}; dated.forEach((x) => { const d = Math.floor(x.year / 10) * 10; dec[d] = (dec[d] || 0) + 1; });
    const top = Object.keys(dec).sort((a, b) => dec[b] - dec[a])[0];
    add('l-decade', H_LIB, t('stDecade', { d: top, n: dec[top] }));
  }
  const rated = movies.filter((x) => Number(x.audienceRating || x.rating) > 0).sort((a, b) => Number(b.audienceRating || b.rating) - Number(a.audienceRating || a.rating));
  if (rated.length > 5) add('l-best', H_LIB, t('stBest', { t: rated[0].title, r: Number(rated[0].audienceRating || rated[0].rating).toFixed(1) }));
  const longest = movies.filter((x) => x.duration).sort((a, b) => b.duration - a.duration)[0];
  if (longest) add('l-longest', H_LIB, t('stLongest', { t: longest.title, d: hrs(longest.duration / 1000) }));
  const shortest = movies.filter((x) => x.duration > 40 * 60000).sort((a, b) => a.duration - b.duration)[0];
  if (shortest) add('l-shortest', H_LIB, t('stShortest', { t: shortest.title, d: hrs(shortest.duration / 1000) }));
  const genres = {}; movies.forEach((x) => (x.Genre || []).forEach((g) => { genres[g.tag] = (genres[g.tag] || 0) + 1; }));
  const gTop = Object.keys(genres).sort((a, b) => genres[b] - genres[a]);
  if (gTop.length) add('l-genre', H_LIB, t('stLibGenre', { g: gTop[0], n: genres[gTop[0]] }));
  const addedMonth = ctx.items.filter((x) => x.addedAt && now - x.addedAt < 30 * 86400).length;
  if (addedMonth > 1) add('l-added30', H_LIB, t('stAdded30', { n: addedMonth }));
  const seenAll = movies.filter((x) => x.viewCount).length;
  if (movies.length > 10) add('l-seenpct', H_ME, t('stSeenPct', { p: Math.round(seenAll / movies.length * 100), n: nfmt(seenAll), m: nfmt(movies.length) }));
  const fav = movies.filter((x) => x.viewCount > 1).sort((a, b) => b.viewCount - a.viewCount)[0];
  if (fav) add('l-fav', H_ME, t('stFav', { t: fav.title, n: fav.viewCount }));
  const finished = shows.filter((x) => x.leafCount && x.viewedLeafCount === x.leafCount).length;
  if (finished > 1) add('l-done', H_ME, t('stShowsDone', { n: finished }));
  const started = shows.filter((x) => x.viewedLeafCount && x.viewedLeafCount < x.leafCount).length;
  if (started > 1) add('l-started', H_ME, t('stShowsStarted', { n: started }));

  /* --- your viewing (history) --- */
  if (mine.length) {
    const week = mine.filter((h) => now - h.viewedAt < 7 * 86400);
    if (week.length) {
      const f = week.filter((h) => h.type === 'movie').length, e = week.filter((h) => h.type === 'episode').length;
      add('h-week', H_ME, t('stWeek', { d: hrs(week.reduce((a, h) => a + hDur(h), 0)), f: nFilms(f), e: nEps(e) }));
    }
    const month = mine.filter((h) => now - h.viewedAt < 30 * 86400);
    if (month.length) add('h-month', H_ME, t('stMonth', { n: month.length, d: hrs(month.reduce((a, h) => a + hDur(h), 0)) }));
    const year = mine.filter((h) => new Date(h.viewedAt * 1000).getFullYear() === new Date().getFullYear());
    if (year.length > 5) add('h-year', H_ME, t('stYear', { y: new Date().getFullYear(), f: nFilms(year.filter((h) => h.type === 'movie').length), e: nEps(year.filter((h) => h.type === 'episode').length) }));
    const days = [0, 0, 0, 0, 0, 0, 0]; mine.forEach((h) => { days[new Date(h.viewedAt * 1000).getDay()]++; });
    const bd = days.indexOf(Math.max.apply(null, days));
    add('h-day', H_ME, t('stBusyDay', { d: dayName(new Date(2024, 0, 7 + bd)) }));
    const hoursOf = new Array(24).fill(0); mine.forEach((h) => { hoursOf[new Date(h.viewedAt * 1000).getHours()]++; });
    const bh = hoursOf.indexOf(Math.max.apply(null, hoursOf));
    add('h-hour', H_ME, t('stBusyHour', { h: String(bh).padStart(2, '0') + ':00' }));
    /* the longest run of one show's episodes on one evening */
    const runs = {}; mine.filter((h) => h.type === 'episode').forEach((h) => { const k = h.grandparentTitle + '|' + new Date(h.viewedAt * 1000 - 6 * 3600000).toDateString(); runs[k] = (runs[k] || 0) + 1; });
    const rk = Object.keys(runs).sort((a, b) => runs[b] - runs[a])[0];
    if (rk && runs[rk] >= 3) add('h-binge', H_ME, t('stBinge', { n: runs[rk], s: rk.split('|')[0] }));
    const showsN = {}; mine.filter((h) => h.type === 'episode').forEach((h) => { showsN[h.grandparentTitle] = (showsN[h.grandparentTitle] || 0) + 1; });
    const sTop = Object.keys(showsN).sort((a, b) => showsN[b] - showsN[a])[0];
    if (sTop) add('h-show', H_ME, t('stTopShow', { s: sTop, n: showsN[sTop] }));
    const last = mine[0];
    if (last && now - last.viewedAt > 86400) add('h-last', H_ME, t('stLastWatched', { t: last.type === 'episode' ? last.grandparentTitle : last.title, d: dayName(new Date(last.viewedAt * 1000)) }));
    const gm = {}; const gOf = new Map(movies.map((x) => [String(x.ratingKey), x.Genre || []]));
    month.filter((h) => h.type === 'movie').forEach((h) => (gOf.get(String(h.ratingKey)) || []).forEach((g) => { gm[g.tag] = (gm[g.tag] || 0) + 1; }));
    const gmTop = Object.keys(gm).sort((a, b) => gm[b] - gm[a])[0];
    if (gmTop) add('h-genre', H_ME, t('stGenreMonth', { g: gmTop }));
    const mf = mine.filter((h) => h.type === 'movie');
    if (mf.length >= 10) add('h-films', H_ME, t('stFilmsYear', { n: mf.length }));
  }
  /* --- the whole server --- */
  if (ctx.hist.length) {
    const m30 = ctx.hist.filter((h) => now - h.viewedAt < 30 * 86400);
    const tally = {}; m30.forEach((h) => { const k = h.type === 'episode' ? h.grandparentTitle : h.title; tally[k] = (tally[k] || 0) + 1; });
    const st = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0];
    if (st) add('s-top', H_SRV, t('stSrvTop', { t: st, n: tally[st] }));
    const people = {}; m30.forEach((h) => { const n = ctx.names[h.accountID]; if (n) people[n] = (people[n] || 0) + 1; });
    const pt = Object.keys(people).sort((a, b) => people[b] - people[a]);
    if (pt.length >= 2) add('s-people', H_SRV, t('stSrvPeople', { n: pt.length, w: pt[0] }));
    if (m30.length) add('s-plays', H_SRV, t('stSrvPlays', { n: nfmt(m30.length) }));
  }
  return out;
}
/* one that fits, not shown lately; the title's own lines come up about half the time */
async function saverStatPick(p) {
  let all = [];
  try { all = await saverStats(p); } catch (e) { all = []; }
  const fresh = all.filter((x) => !saverRecent.includes(x[0]));
  const pool = fresh.length ? fresh : all;
  if (!pool.length) return null;
  const own = pool.filter((x) => /^t-/.test(x[0])), rest = pool.filter((x) => !/^t-/.test(x[0]));
  const from = own.length && (!rest.length || Math.random() < 0.5) ? own : rest;
  const x = from[Math.floor(Math.random() * from.length)];
  saverRecent.push(x[0]); if (saverRecent.length > Math.max(8, Math.floor(all.length * 0.7))) saverRecent.shift();
  return { head: x[1], text: x[2] };
}
async function saverFact(p) { if (p && p.key) { try { await saverStats(p); } catch (e) { /* later */ } } return null; } /* warms the next title */
async function saverFactShow(p) {
  const box = document.getElementById('svfact');
  if (!box) return;
  box.classList.remove('on');
  let f = null;
  try { f = await saverStatPick(p); } catch (e) { f = null; }
  if (!f || !saverOn || saverPics[(saverIdx - 1 + saverPics.length) % saverPics.length] !== p) return;
  box.querySelector('.svfacth').textContent = f.head;
  box.querySelector('.svfactt').textContent = f.text;
  box.classList.add('on');
}
