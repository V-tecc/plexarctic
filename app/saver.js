/* PLEX:arctic — screen saver.
   After a while without a key press: a slow slideshow of backdrops with the title and a clock.
   In menus it shows films and shows from the library; with a film paused in the player it shows that
   title's own backdrops (Plex already has them, a handful at most). Any key brings the app back. */
'use strict';

const SAVER_STEP = 14000;          /* each picture stays this long */
let saverLast = Date.now();        /* last key press */
let saverOn = false, saverTimer = null, saverPics = [], saverIdx = 0, saverLayer = 0, saverPaused = null;

function saverMinutes() { const v = store.get('saverMin', 10); return v == null ? 10 : Number(v); }

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
          return list.map((a) => ({ art: a, title: saverPaused.title, sub: saverPaused.sub, key: ep ? null : m.ratingKey }));
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
  return items.slice(0, 30).map((m) => ({ art: m.art, title: m.title, key: m.type === 'movie' ? m.ratingKey : null, sub: [m.year, (m.Genre || [])[0] && m.Genre[0].tag].filter(Boolean).join(' · ') }));
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

/* ---------- a fact about one of the actors in the film on screen (TMDB) ---------- */
const saverFacts = new Map();   /* ratingKey → { head, text } or null */
async function saverFact(p) {
  if (!p || !p.key || !S.tmdb || typeof tmdbGet !== 'function') return null;
  if (saverFacts.has(p.key)) return saverFacts.get(p.key);
  saverFacts.set(p.key, null);
  const m = ((await api('/library/metadata/' + p.key, { includeGuids: 1 })).Metadata || [])[0];
  const tid = m && tmdbIdOf(m);
  if (!tid) return null;
  const tl = tmdbLang();
  const [mv, cr] = await Promise.all([tmdbGet('/movie/' + tid, { language: tl }), tmdbGet('/movie/' + tid + '/credits', { language: tl })]);
  /* the top-billed actor (the one on the poster, not someone further down the list) */
  const c = (cr.cast || []).filter((x) => x.id).sort((a, b) => (a.order || 0) - (b.order || 0))[0];
  if (!c) return null;
  const [pp, mc] = await Promise.all([tmdbGet('/person/' + c.id, { language: tl }), tmdbGet('/person/' + c.id + '/movie_credits', { language: tl }).catch(() => ({}))]);
  let bio = pp.biography || '';
  if (!bio && tl !== 'en-US') { try { bio = (await tmdbGet('/person/' + c.id, { language: 'en-US' })).biography || ''; } catch (e) { bio = ''; } }
  const name = pp.name || c.name, title = mv.title || m.title;
  const facts = [];   /* [heading, text]; facts about the actor are headed with their name */
  const A = (x) => facts.push([t('factHead') + ' · ' + name, x]);
  const F = (x) => facts.push([t('factHead'), x]);
  /* a sentence from the biography (not the first, which is usually just where they were born) */
  const sents = bio.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+(?=[A-ZÅÄÖÁČĎÉĚÍŇÓŘŠŤÚŮÝŽА-ЯΑ-Ω])/).slice(1)
    .filter((x) => x.length >= 60 && x.length <= 230 && !/\b(born|is an?|was an?)\b.{0,30}\b(actor|actress)\b/i.test(x.slice(0, 60)));
  /* "He started his career…" → "Keanu Reeves started his career…", so it's clear who it's about */
  const named = (x) => x.replace(/^(He|She|They|Han|Hon|De|On|Ona|Він|Вона|Αυτός|Αυτή)\s+/, name + ' ');
  if (sents.length) A(named(sents[Math.floor(Math.random() * sents.length)]));
  const bd = pp.birthday && new Date(pp.birthday), rd = mv.release_date && new Date(mv.release_date);
  if (bd && rd && rd > bd) {
    let age = rd.getFullYear() - bd.getFullYear(); if (rd.getMonth() < bd.getMonth() || (rd.getMonth() === bd.getMonth() && rd.getDate() < bd.getDate())) age--;
    if (age >= 4 && age <= 99) A(t('factAge', { n: name, a: age, t: title }));
  }
  if (bd && !pp.deathday) { const now = new Date(); let a2 = now.getFullYear() - bd.getFullYear(); if (now.getMonth() < bd.getMonth() || (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate())) a2--; if (a2 > 0 && a2 < 110) A(t('factAgeNow', { n: name, a: a2 })); }
  if (pp.place_of_birth) A(t('factBorn', { n: name, p: pp.place_of_birth }));
  const nfilms = (mc.cast || []).length;
  if (nfilms >= 5) A(t('factFilms', { n: name, c: nfilms }));
  if (c.character) A(t('factPlays', { n: name, c: c.character, t: title }));
  /* the film itself */
  const nf = (n) => Number(n).toLocaleString(lang().locale);
  if (rd && !isNaN(rd)) {
    const yrs = new Date().getFullYear() - rd.getFullYear();
    if (yrs >= 2) F(t('factYearsAgo', { t: title, n: yrs }));
    F(t('factReleased', { t: title, d: rd.toLocaleDateString(lang().locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }));
  }
  if (mv.budget > 1e6) F(t('factBudget', { t: title, b: nf(Math.round(mv.budget / 1e6)) }));
  if (mv.budget > 1e6 && mv.revenue > 1e6) F(t('factRevenue', { t: title, r: nf(Math.round(mv.revenue / 1e6)), x: (mv.revenue / mv.budget).toFixed(1) }));
  if (mv.tagline) F(t('factTagline', { t: title, g: mv.tagline }));
  if (mv.original_title && mv.original_title !== title) F(t('factOriginal', { t: title, o: mv.original_title }));
  if (mv.belongs_to_collection && mv.belongs_to_collection.name) F(t('factCollection', { t: title, c: mv.belongs_to_collection.name }));
  const dir = (cr.crew || []).find((x) => x.job === 'Director');
  if (dir) F(t('factDirector', { t: title, d: dir.name }));
  if ((mv.production_countries || []).length) F(t('factCountry', { t: title, c: mv.production_countries.slice(0, 3).map((x) => x.name).join(', ') }));
  if (mv.vote_count > 500) F(t('factVotes', { t: title, n: nf(mv.vote_count), r: Number(mv.vote_average).toFixed(1) }));
  if ((cr.cast || []).length >= 20) F(t('factCastSize', { t: title, n: cr.cast.length }));
  /* and you */
  if (m.viewCount > 1) F(t('factSeenN', { t: title, n: m.viewCount }));
  else if (m.viewCount === 1 && m.lastViewedAt) F(t('factSeenLast', { t: title, d: new Date(m.lastViewedAt * 1000).toLocaleDateString(lang().locale, { day: 'numeric', month: 'long', year: 'numeric' }) }));
  else if (!m.viewCount) F(t('factUnseen', { t: title }));
  if (m.addedAt) { const days = Math.floor((Date.now() / 1000 - m.addedAt) / 86400); if (days >= 1) F(days < 60 ? t('factAddedDays', { t: title, n: days }) : t('factAddedDate', { t: title, d: new Date(m.addedAt * 1000).toLocaleDateString(lang().locale, { month: 'long', year: 'numeric' }) })); }
  if (!facts.length) return null;
  saverFacts.set(p.key, facts);
  return facts;
}
/* a different one of the film's facts each time it comes round */
function saverFactPick(list) {
  if (!list || !list.length) return null;
  const x = list[Math.floor(Math.random() * list.length)];
  return { head: x[0], text: x[1] };
}
async function saverFactShow(p) {
  const box = document.getElementById('svfact');
  if (!box) return;
  box.classList.remove('on');
  let f = null;
  try { f = saverFactPick(await saverFact(p)); } catch (e) { f = null; }
  if (!f || !saverOn || saverPics[(saverIdx - 1 + saverPics.length) % saverPics.length] !== p) return;
  box.querySelector('.svfacth').textContent = f.head;
  box.querySelector('.svfactt').textContent = f.text;
  box.classList.add('on');
}
