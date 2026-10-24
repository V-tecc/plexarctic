/* PLEX:arctic — suggestions that learn, per profile.
   "More like this" / "Less like this" on any movie or show nudges the genres and lead actors of that title up or down,
   and "Less like this" also stops that title from being suggested. On top of that, the actors in the films a profile
   has watched most are its favourites: films with them get a lift, and Home gets a row with the top favourite.
   Everything is kept on this device, separately for each Plex Home profile. Nothing is sent anywhere. */
'use strict';

function tasteGet() { const x = store.get(userKey('taste'), null) || {}; return { g: x.g || {}, a: x.a || {}, no: x.no || {}, yes: x.yes || {} }; }
function tasteSave(x) { store.set(userKey('taste'), x); }
function tasteCount() { const x = tasteGet(); return Object.keys(x.no).length + Object.keys(x.yes).length; }
const clampT = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* teach: dir +1 more like this, -1 less like this */
async function tasteMark(it, dir) {
  let m = it;
  try { m = ((await api('/library/metadata/' + it.ratingKey)).Metadata || [])[0] || it; } catch (e) { /* use what we have */ }
  const x = tasteGet();
  const key = String(m.ratingKey);
  const prev = x.yes[key] ? 1 : x.no[key] ? -1 : 0;
  /* picking the same one again takes it back */
  const undo = prev === dir;
  if (undo) dir = 0;
  const step = dir - prev; /* switching from "less" to "more" undoes the first one too */
  (m.Genre || []).forEach((g) => { x.g[g.tag] = clampT((x.g[g.tag] || 0) + step, -6, 6); });
  (m.Role || []).slice(0, 4).forEach((r) => { x.a[r.tag] = clampT((x.a[r.tag] || 0) + step * 0.6, -4, 4); });
  delete x.yes[key]; delete x.no[key];
  if (dir > 0) x.yes[key] = Date.now(); else if (dir < 0) x.no[key] = Date.now();
  tasteSave(x);
  toast(undo ? t('tasteUndone', { s: m.title }) : t(dir > 0 ? 'tasteMoreDone' : 'tasteLessDone', { s: m.title }), 4000);
  if (current && current.fn === viewHome) { spot.pick = null; rerun(); }
}
function tasteReset() { store.set(userKey('taste'), null); toast(t('tasteResetDone'), 3000); }

/* what a profile has watched: favourite actors and how often each genre comes up */
function tasteHistory(movies) {
  const actors = new Map(), genres = new Map();
  let n = 0;
  movies.forEach((m) => {
    if (!m.viewCount) return;
    n++;
    (m.Role || []).slice(0, 3).forEach((r) => actors.set(r.tag, (actors.get(r.tag) || 0) + 1));
    (m.Genre || []).forEach((g) => genres.set(g.tag, (genres.get(g.tag) || 0) + 1));
  });
  const fav = Array.from(actors.entries()).filter((a) => a[1] >= 2).sort((a, b) => b[1] - a[1]);
  return { n: n, actors: new Map(fav), favList: fav.map((a) => a[0]), genres: genres };
}

/* how well a title fits this profile (higher is better; titles you said no to drop out) */
function tasteScore(m, h, x) {
  x = x || tasteGet();
  if (x.no[m.ratingKey]) return -99;
  let s = 0;
  (m.Genre || []).forEach((g) => {
    s += (x.g[g.tag] || 0) * 0.9;
    if (h && h.n) s += Math.min(1.2, (h.genres.get(g.tag) || 0) / h.n * 2.5);
  });
  (m.Role || []).slice(0, 3).forEach((r) => {
    s += x.a[r.tag] || 0;
    if (h) s += Math.min(3, h.actors.get(r.tag) || 0) * 0.5;
  });
  const r = Number(m.audienceRating || m.rating || 0);
  if (r) s += (r - 6.5) * 0.35;
  return s;
}
function tasteOK(m, h, x) { return tasteScore(m, h, x) > -1.5; }
/* a pick that is good for you but not always the same: random among the best third */
function tastePick(list, h, avoid) {
  const x = tasteGet();
  const pool = list.filter((m) => m !== avoid && !x.no[m.ratingKey]);
  if (!pool.length) return null;
  const ranked = pool.map((m) => ({ m: m, s: tasteScore(m, h, x) + Math.random() * 0.8 })).sort((a, b) => b.s - a.s);
  const top = ranked.slice(0, Math.max(5, Math.ceil(ranked.length / 3)));
  return top[Math.floor(Math.random() * top.length)].m;
}
function tasteSort(list, h) { const x = tasteGet(); return list.filter((m) => !x.no[m.ratingKey]).map((m) => ({ m: m, s: tasteScore(m, h, x) })).sort((a, b) => b.s - a.s).map((y) => y.m); }

/* menu rows for movies and shows */
function tasteRows(it) {
  if (!it || !it.ratingKey || it.virtual || (it.type !== 'movie' && it.type !== 'show')) return [];
  const x = tasteGet();
  const k = String(it.ratingKey);
  return [
    optionRow('cx-more', t('tasteMore'), [], !!x.yes[k], A(() => { closeModal(true); tasteMark(it, 1); }), x.yes[k] ? t('tasteOnSub') : t('tasteMoreSub')),
    optionRow('cx-less', t('tasteLess'), [], !!x.no[k], A(() => { closeModal(true); tasteMark(it, -1); }), x.no[k] ? t('tasteOnSub') : t('tasteLessSub'))
  ];
}

ICON.thumbUp = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 10v12"></path><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"></path></svg>';
ICON.thumbDown = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.7a2 2 0 0 0-2 1.7l-1.4 9a2 2 0 0 0 2 2.3z"></path><path d="M17 2h2.7A2.3 2.3 0 0 1 22 4v7a2.3 2.3 0 0 1-2.3 2H17"></path></svg>';

/* favourite actors: the full cast (top eight billed) of the films this profile watched most recently, from Plex's own
   watch history. Casts are kept on this device so each film is only asked for once; a few new ones per visit. */
/* Casts: every film and show this profile has watched counts. Plex's library list already names the top three billed
   actors of each title, so the numbers are there straight away; the full cast (top eight) is then read in the
   background, once per title, and kept on this device (names only, plus pictures for the people who come up). */
function castStore() {
  const k = 'castCache2.' + S.server.id;
  try { localStorage.removeItem('pp.castCache.' + S.server.id); } catch (e) { /* the old, smaller cache */ }
  return { k: k, c: store.get(k, {}) || {}, thumbs: store.get('castThumbs.' + S.server.id, {}) || {} };
}
function tasteWatchedTitles(movies, shows) {
  return movies.filter((m) => m.viewCount).map((m) => ({ it: m, show: false }))
    .concat((shows || []).filter((sh) => sh.viewedLeafCount).map((sh) => ({ it: sh, show: true })));
}
/* actors across the given titles, from the saved casts (top three billed until a full cast is read) */
function actorRank(movies, shows, allTime) {
  const all = tasteWatchedTitles(movies, shows);
  const cs = castStore();
  const count = new Map();
  all.forEach((x) => {
    const cast = cs.c[x.it.ratingKey] || (x.it.Role || []).slice(0, 3).map((y) => [y.tag, y.id || '']);
    const seenHere = new Set();
    cast.forEach(([name, id, thumb]) => {
      if (seenHere.has(name)) return; seenHere.add(name);
      const c = count.get(name) || { name: name, id: id, thumb: cs.thumbs[name] || thumb || '', n: 0, films: 0, shows: 0, eps: 0, bill: 99 };
      c.bill = Math.min(c.bill, seenHere.size - 1);
      c.n++; if (x.show) { c.shows++; c.eps += x.it.viewedLeafCount || 0; } else c.films++;
      if (!c.id && id) c.id = id; if (!c.thumb && (cs.thumbs[name] || thumb)) c.thumb = cs.thumbs[name] || thumb;
      count.set(name, c);
    });
  });
  /* ranked by how many of your titles they're in; episodes watched break ties */
  /* ties (common in a short period, where everyone is in one title) go to the ones you've seen most over time, then to the leads */
  const fam = (c) => (allTime && allTime.get(c.name)) || 0;
  return Array.from(count.values()).sort((a, b) => (b.n - a.n) || (fam(b) - fam(a)) || (a.bill - b.bill) || (b.eps - a.eps));
}
async function tasteFavActors(movies, h, shows) {
  const ranked = actorRank(movies, shows);
  const tx = tasteGet();
  const favs = ranked.filter((c) => c.n >= 2 && c.id && (tx.a[c.name] || 0) > -1);
  if (h) { favs.slice(0, 200).forEach((c) => h.actors.set(c.name, Math.max(h.actors.get(c.name) || 0, c.n))); h.favs = favs; h.actorAll = ranked.slice(0, 10); }
  return favs;
}
/* the background read of full casts; onDone gets called when there were new ones */
let castScanBusy = false;
async function tasteCastScan(movies, shows, onProgress, onDone) {
  if (castScanBusy || !S.server) return;
  const server = S.server.id;
  const cs = castStore();
  const todo = tasteWatchedTitles(movies, shows).filter((x) => !cs.c[x.it.ratingKey]);
  if (!todo.length) return;
  castScanBusy = true;
  const seenCount = new Map();
  let done = 0, lastSave = 0;
  const save = () => {
    /* pictures only for people who come up in two or more titles, to keep it small */
    Object.values(cs.c).forEach((cast) => cast.forEach(([name]) => seenCount.set(name, (seenCount.get(name) || 0) + 1)));
    const thumbs = {};
    Object.keys(cs.thumbs).forEach((n) => { if ((seenCount.get(n) || 0) >= 2) thumbs[n] = cs.thumbs[n]; });
    seenCount.clear();
    try { store.set(cs.k, cs.c); store.set('castThumbs.' + server, thumbs); } catch (e) { /* full: keep going in memory */ }
  };
  try {
    for (let i = 0; i < todo.length; i += 6) {
      if (!S.server || S.server.id !== server) break;
      await Promise.all(todo.slice(i, i + 6).map((x) => api('/library/metadata/' + x.it.ratingKey).then((r) => {
        const full = (r.Metadata || [])[0];
        const roles = ((full && full.Role) || []).slice(0, 8);
        cs.c[x.it.ratingKey] = roles.map((y) => [y.tag, y.id || y.tagKey || '']);
        roles.forEach((y) => { if (y.thumb && !cs.thumbs[y.tag]) cs.thumbs[y.tag] = y.thumb; });
      }).catch(() => { cs.c[x.it.ratingKey] = cs.c[x.it.ratingKey] || []; })));
      done = Math.min(todo.length, i + 6);
      if (onProgress) onProgress(done, todo.length);
      if (done - lastSave >= 120) { lastSave = done; save(); }
      await sleep(60);
    }
    save();
  } finally { castScanBusy = false; }
  if (onDone) onDone();
}
/* "4 films · 2 shows" */
function tasteTitlesText(c) {
  if (c.films == null) return t('vsFilmsN', { n: c.n });
  return [c.films ? t(c.films === 1 ? 'vsFilm1' : 'vsFilmsN', { n: c.films }) : '', c.shows ? t(c.shows === 1 ? 'vsShow1' : 'vsShowsShort', { n: c.shows }) : ''].filter(Boolean).join(' · ');
}

/* ---------- the profile's own statistics (Home → Your viewing) ---------- */
/* This month / this year come from the server's own watch history for this profile, so only what this profile
   played in the period counts (episodes counted one by one), not a show's all-time total. */
const vsHistCache = {};
function vsFrom(mode) {
  const now = new Date();
  return Math.floor((mode === 'month' ? new Date(now.getFullYear(), now.getMonth(), 1) : new Date(now.getFullYear(), 0, 1)).getTime() / 1000);
}
async function vsAccountIds() {
  /* the owner is account 1 on their own server; everyone else by their Plex id, or by name as a fallback */
  if (!S.user || S.user.admin) return [1];
  const ids = [Number(S.user.id)];
  try {
    const accts = ((await getJSON(ownerURL('/accounts'))).MediaContainer || {}).Account || [];
    const nm = String(S.user.title || '').toLowerCase();
    accts.forEach((a) => { if (String(a.name || '').toLowerCase() === nm && ids.indexOf(Number(a.id)) < 0) ids.push(Number(a.id)); });
  } catch (e) { /* only the id */ }
  return ids;
}
async function vsPrep(mode) {
  if (!mode || mode === 'all') return null;
  const key = mode + '|' + (S.server && S.server.id) + '|' + (S.user ? S.user.id : 'owner');
  const c = vsHistCache[key];
  if (c && Date.now() - c.at < 5 * 60000) return c.list;
  const from = vsFrom(mode);
  const ids = await vsAccountIds();
  let list = [];
  for (const id of ids) {
    for (let start = 0; start < 20000; start += 2000) {
      const r = await getJSON(ownerURL('/status/sessions/history/all', { 'viewedAt>': from, accountID: id, sort: 'viewedAt:desc', 'X-Plex-Container-Start': start, 'X-Plex-Container-Size': 2000 }));
      const page = ((r.MediaContainer || {}).Metadata) || [];
      list = list.concat(page.filter((x) => Number(x.accountID) === id && (x.viewedAt || 0) >= from));
      if (page.length < 2000) break;
    }
    if (list.length) break;
  }
  vsHistCache[key] = { at: Date.now(), list: list, mode: mode };
  return list;
}
function vsHistCached(mode) {
  const c = vsHistCache[mode + '|' + (S.server && S.server.id) + '|' + (S.user ? S.user.id : 'owner')];
  return c ? c.list : null;
}
/* the period's plays turned into titles shaped like the library ones (viewCount / viewedLeafCount for that period) */
function vsPeriodTitles(movies, shows, hist) {
  const rk = (x) => String(x || '').replace(/^\/library\/metadata\//, '');
  const mv = new Map(movies.map((m) => [String(m.ratingKey), m]));
  const sh = new Map((shows || []).map((x) => [String(x.ratingKey), x]));
  const pm = new Map(), ps = new Map();
  hist.forEach((e) => {
    if (e.type === 'movie') {
      const m = mv.get(rk(e.ratingKey || e.key)); if (!m) return;
      const c = pm.get(m.ratingKey) || Object.assign({}, m, { viewCount: 0, lastViewedAt: 0 });
      c.viewCount++; c.lastViewedAt = Math.max(c.lastViewedAt, e.viewedAt || 0); pm.set(m.ratingKey, c);
    } else if (e.type === 'episode') {
      const s = sh.get(rk(e.grandparentRatingKey || e.grandparentKey)); if (!s) return;
      const c = ps.get(s.ratingKey) || Object.assign({}, s, { viewedLeafCount: 0, lastViewedAt: 0, _eps: new Set() });
      const ek = rk(e.ratingKey || e.key) || (e.parentIndex + 'x' + e.index);
      if (!c._eps.has(ek)) { c._eps.add(ek); c.viewedLeafCount++; }
      c.lastViewedAt = Math.max(c.lastViewedAt, e.viewedAt || 0); ps.set(s.ratingKey, c);
    }
  });
  return { movies: Array.from(pm.values()), shows: Array.from(ps.values()) };
}
function tasteStats(movies, shows, h, mode) {
  const hist = mode && mode !== 'all' ? vsHistCached(mode) : null;
  if (!hist) return tasteStatsCore(movies, shows, h, mode);
  const p = vsPeriodTitles(movies, shows || [], hist);
  let fam = null;
  try { fam = new Map(actorRank(movies, shows || []).map((c) => [c.name, c.n])); } catch (e) { fam = null; }
  const st = tasteStatsCore(p.movies, p.shows, h, 'period', fam);
  st.mode = mode; st.moviesAll = movies; st.showsAll = shows || [];
  return st;
}
function tasteStatsCore(movies, shows, h, mode, fam) {
  const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime() / 1000;
  const now = new Date();
  const from = mode === 'month' ? new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000 : mode === 'year' ? yearStart : 0;
  const inYear = (m) => !from || (m.lastViewedAt || 0) >= from;
  const seen = movies.filter((m) => m.viewCount && inYear(m));
  if ((!mode || mode === 'all') && !seen.length && !(shows || []).some((s) => s.viewedLeafCount)) return null;
  const top = (map, n) => Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, n);
  const byWatch = (a, b) => ((b.viewCount || 0) - (a.viewCount || 0)) || ((b.lastViewedAt || 0) - (a.lastViewedAt || 0));
  const genres = new Map(), dirs = new Map(), decades = new Map();
  let minutes = 0;
  const shSeen = (shows || []).filter((x) => x.viewedLeafCount && inYear(x));
  shSeen.forEach((x) => { const w = 1 + Math.min(2, (x.viewedLeafCount || 0) / 12); (x.Genre || []).forEach((g) => genres.set(g.tag, (genres.get(g.tag) || 0) + w)); });
  const genreTotal = seen.length + shSeen.reduce((n, x) => n + 1 + Math.min(2, (x.viewedLeafCount || 0) / 12), 0);
  seen.forEach((m) => {
    (m.Genre || []).forEach((g) => genres.set(g.tag, (genres.get(g.tag) || 0) + 1));
    (m.Director || []).forEach((g) => dirs.set(g.tag, (dirs.get(g.tag) || 0) + 1));
    if (m.year) { const d = Math.floor(m.year / 10) * 10; decades.set(d, (decades.get(d) || 0) + 1); }
    minutes += Math.round((m.duration || 0) / 60000) * Math.max(1, m.viewCount || 1);
  });
  const thisYear = seen.filter((m) => (m.lastViewedAt || 0) >= yearStart).length;
  const re = seen.filter((m) => m.viewCount > 1).sort((a, b) => b.viewCount - a.viewCount)[0] || null;
  const sh = shSeen.slice().sort((a, b) => b.viewedLeafCount - a.viewedLeafCount);
  const ranked = actorRank(movies.filter((m) => inYear(m)), shSeen, fam);
  /* series time: episodes watched × the show's usual episode length */
  const showMin = shSeen.reduce((n, x) => n + (x.viewedLeafCount || 0) * Math.round((x.duration || 0) / 60000), 0);
  /* what was watched last, film or show */
  const lastSeen = seen.concat(shSeen).filter((x) => x.lastViewedAt).sort((a, b) => b.lastViewedAt - a.lastViewedAt)[0] || null;
  const lastMovie = seen.filter((x) => x.lastViewedAt).sort((a, b) => b.lastViewedAt - a.lastViewedAt)[0] || null;
  const eps = sh.reduce((n, s) => n + (s.viewedLeafCount || 0), 0);
  return {
    movies: seen.length, hours: Math.round(minutes / 60), showHours: Math.round(showMin / 60), totalHours: Math.round((minutes + showMin) / 60), lastSeen: lastSeen, lastMovie: lastMovie, thisYear: thisYear, eps: eps, showsN: sh.length,
    genres: top(genres, 3).map((g) => ({ name: g[0], pct: Math.round(g[1] / (genreTotal || 1) * 100) })),
    director: top(dirs, 1).map((d) => ({ name: d[0], n: d[1] }))[0] || null,
    decade: top(decades, 1).map((d) => ({ d: d[0], n: d[1] }))[0] || null,
    actors: ranked.filter((c) => c.n >= (mode && mode !== 'all' ? 1 : 2)).slice(0, 3),
    mode: mode || 'all',
    decadesAll: Array.from(decades.entries()).sort((a, b) => a[0] - b[0]),
    show: sh[0] || null, rewatch: re,
    /* the longer lists behind each tile */
    all: {
      actors: ranked.slice(0, 10),
      genres: top(genres, 10).map((g) => ({ name: g[0], n: Math.round(g[1]), pct: Math.round(g[1] / (genreTotal || 1) * 100) })),
      directors: top(dirs, 10).map((d) => ({ name: d[0], n: d[1] })),
      decades: top(decades, 10).map((d) => ({ d: d[0], n: d[1] })),
      shows: sh.slice(0, 10),
      movies: seen.slice().sort(byWatch).slice(0, 10),
      year: seen.filter((m) => (m.lastViewedAt || 0) >= yearStart).sort((a, b) => b.lastViewedAt - a.lastViewedAt)
    },
    seenAll: seen, moviesAll: movies, showsSeen: shSeen, showsAll: shows || [], h: h
  };
}
function tasteStatsHTML(st, movieSec, showSec) {
  if (!st) return '';
  const nf = (n) => Number(n).toLocaleString(lang().locale);
  const tiles = [];
  const tile = (key, cls, inner, act) => tiles.push('<div class="vtile f ' + cls + '" data-key="vs-' + key + '"' + (act ? ' data-act="' + A(act) + '"' : '') + '>' + inner + '</div>');
  const artOf = (x) => (x && (x.art || x.grandparentArt)) ? '<img class="vart" src="' + esc(imgURL(x.art || x.grandparentArt, 640, 360)) + '" alt="">' : '';
  tile('movies', st.lastMovie && st.lastMovie.art ? 'withart' : '', artOf(st.lastMovie) + '<span class="vl">' + esc(t('vsMovies')) + '</span><b>' + nf(st.movies) + '</b><small>' + esc(t('vsHours', { n: nf(st.hours) })) + '</small>', () => vsList('movies', st));
  tile('eps', st.show && st.show.art ? 'withart' : '', artOf(st.show) + '<span class="vl">' + esc(t('vsEpisodes')) + '</span><b>' + nf(st.eps) + '</b><small>' + esc(t('vsShowsN', { n: nf(st.showsN) })) + '</small>', () => vsList('shows', st));
  /* every view has the same tiles; an empty one shows a dash */
  const none = (label) => '<span class="vl">' + esc(label) + '</span><b class="vtext">–</b><small>' + esc(t('vsNoneYet')) + '</small>';
  if (!st.actors.length) tile('actors', 'wide', none(t('vsActors')), null);
  if (st.actors.length) tile('actors', 'wide', '<span class="vl">' + esc(t('vsActors')) + '</span><div class="vfaces">' + st.actors.map((a, i) =>
    '<div class="vface"><span class="vrank">' + (i + 1) + '</span>' + (a.thumb ? '<img src="' + esc(imgURL(a.thumb, 240, 240)) + '" alt="">' : '<span class="ini">' + esc(a.name.split(' ').map((w) => w[0]).join('').slice(0, 2)) + '</span>') +
    '<b>' + esc(a.name) + '</b><small>' + esc(tasteTitlesText(a)) + '</small></div>').join('') + '</div>', () => vsList('actors', st));
  if (!st.genres.length) tile('genre', '', none(t('vsGenre')), null);
  if (st.genres.length) tile('genre', '', '<span class="vl">' + esc(t('vsGenre')) + '</span><b class="vtext">' + esc(st.genres[0].name) + '</b>' +
    '<span class="vsplit">' + st.genres.map((g, i) => '<i class="g' + i + '" style="width: ' + g.pct + '%"></i>').join('') + '</span>' +
    '<small>' + esc(st.genres.map((g) => g.name + ' ' + g.pct + ' %').join(' · ')) + '</small>', () => vsList('genres', st));
  if (!st.show) tile('show', '', none(t('vsTopShow')), null);
  if (st.show) tile('show', 'withart', (st.show.art ? '<img class="vart" src="' + esc(imgURL(st.show.art, 640, 360)) + '" alt="">' : '') + '<span class="vl">' + esc(t('vsTopShow')) + '</span><b class="vtext">' + esc(st.show.title) + '</b><small>' + esc(t('vsEpsN', { n: st.show.viewedLeafCount })) + '</small>', () => vsList('shows', st));
  if (!st.director) tile('dir', '', none(t('vsDirector')), null);
  if (st.director) tile('dir', '', '<span class="vl">' + esc(t('vsDirector')) + '</span><b class="vtext">' + esc(st.director.name) + '</b><small>' + esc(t('vsFilmsN', { n: st.director.n })) + '</small>', () => vsList('directors', st));
  if (!st.decade) tile('decade', '', none(t('vsDecade')), null);
  if (st.decade) {
    const dl = st.decadesAll.filter((x) => x[0] >= 1930).slice(-8);
    const max = Math.max.apply(null, dl.map((x) => x[1]).concat([1]));
    tile('decade', '', '<span class="vl">' + esc(t('vsDecade')) + '</span>' +
      '<span class="vdec">' + dl.map((x) => '<i class="' + (x[0] === st.decade.d ? 'top' : '') + '" style="height: ' + Math.max(8, Math.round(x[1] / max * 100)) + '%"><em>' + esc(String(x[0]).slice(2)) + '</em></i>').join('') + '</span>' +
      '<small><b class="vdt">' + esc(String(st.decade.d) + (S.lang === 'sv' ? '-talet' : 's')) + '</b> · ' + esc(t('vsFilmsN', { n: st.decade.n })) + '</small>', () => vsList('decades', st));
  }
  if (st.lastSeen) {
    const ls = st.lastSeen;
    tile('last', ls.art ? 'withart' : '', artOf(ls) + '<span class="vl">' + esc(t('vsLastSeen')) + '</span><b class="vtext">' + esc(ls.title) + '</b><small>' +
      esc(new Date(ls.lastViewedAt * 1000).toLocaleDateString(lang().locale, { weekday: 'short', day: 'numeric', month: 'short' })) + '</small>', () => go(viewDetails, [ls.ratingKey]));
  } else tile('last', '', none(t('vsLastSeen')), null);
  if (!st.rewatch) tile('re', '', none(t('vsRewatched')), null);
  if (st.rewatch) tile('re', 'withart', (st.rewatch.art ? '<img class="vart" src="' + esc(imgURL(st.rewatch.art, 640, 360)) + '" alt="">' : '') + '<span class="vl">' + esc(t('vsRewatched')) + '</span><b class="vtext">' + esc(st.rewatch.title) + '</b><small>' + esc(t('vsTimes', { n: st.rewatch.viewCount })) + '</small>', () => vsList('movies', st));
  return '<section class="hub vssection" id="vssection"><div class="hubhead"><h2>' + esc(t('vsTitle')) + '</h2><span>' + esc(t('vsSub', { s: (S.user && S.user.title) || (S.account && S.account.title) || '' })) + '</span><span class="vsprog" id="vsprog"></span></div>' + vsStripHTML(st, movieSec, showSec) + '<div class="vtiles">' + (tiles.join('') || '<p class="sheettext">' + esc(t('nothing')) + '</p>') + '</div></section>';
}

/* the wide strip above the tiles: OK on it switches the whole section between all time and this year */
let vsMode = 'all';
/* all time → this month → this year → all time */
const VS_MODES = ['all', 'month', 'year'];
function vsMonthName() { return new Date().toLocaleDateString(lang().locale, { month: 'long' }); }
function vsModeLabel(mode, kind) {
  const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
  return t(kind + cap(mode), { y: new Date().getFullYear(), m: vsMonthName() });
}
function vsStripHTML(st, movieSec, showSec) {
  const nf = (n) => Number(n).toLocaleString(lang().locale);
  const mode = st.mode || 'all';
  const year = mode !== 'all';
  const nextMode = VS_MODES[(VS_MODES.indexOf(mode) + 1) % VS_MODES.length];
  /* the same cells in every view: films, shows with their episodes, the hours (films + series) and the top genre */
  const cells = [
    [nf(st.movies), t('vsMoviesShort')],
    [nf(st.showsN), t('vsStripShowsEps', { n: nf(st.eps) })],
    ['≈ ' + nf(st.totalHours || 0) + ' h', t('vsStripHoursSplit', { a: nf(st.hours), b: nf(st.showHours || 0) })],
    [st.genres[0] ? st.genres[0].name : '–', t('vsStripGenre')]
  ];
  const art = (st.rewatch && st.rewatch.art) || (st.show && st.show.art) || '';
  return '<div class="vstrip f" id="vsstrip" data-key="vs-strip" data-act="' + A(async () => {
    vsMode = nextMode;
    const strip = $('#vsstrip', viewEl); if (strip) strip.classList.add('loading');
    try { await vsPrep(vsMode); } catch (e) { /* falls back to the library's own dates */ }
    const next = tasteStats(st.moviesAll, st.showsAll, st.h, vsMode);
    const sec = $('#vssection', viewEl);
    if (sec && next) { sec.outerHTML = tasteStatsHTML(next, movieSec, showSec); const b = $('[data-key="vs-strip"]', viewEl); if (b) setFocus(b, true); }
  }) + '">' + (art ? '<img class="vsart" src="' + esc(imgURL(art, 1400, 400)) + '" alt="">' : '') +
    '<span class="eyebrow">' + esc(vsModeLabel(mode, 'vsStrip')) + '</span>' +
    '<div class="vscells">' + cells.map((c) => '<div><b>' + esc(c[0]) + '</b><span>' + esc(c[1]) + '</span></div>').join('') + '</div>' +
    '<div class="vsnav"><span class="abdots">' + VS_MODES.map((m) => '<i class="' + (m === mode ? 'on' : '') + '"></i>').join('') + '</span>' +
    '<span class="vsok">' + esc(vsModeLabel(mode, 'vsBadge')) + '</span></div></div>';
}

/* the list behind a tile; going on from it and coming back lands on the tile again */
/* what to open again when you come back to Home (the list you were in, at the row you picked) */
let vsReopen = null;
function vsGo(fn, args, reopen) {
  const tile = modalReturn && document.contains(modalReturn) ? modalReturn : null;
  vsReopen = reopen && tile ? Object.assign({ tile: tile.dataset.key, row: focused && focused.dataset.key }, reopen) : null;
  closeModal(true);
  if (tile) setFocus(tile, true);
  go(fn, args);
}
function vsList(kind, st) {
  const go2 = (fn, args) => vsGo(fn, args, { kind: kind });
  const A2 = st.all;
  const dec = (d) => String(d) + (S.lang === 'sv' ? '-talet' : 's');
  const face = (thumb, name) => thumb ? '<img class="vsimg round" src="' + esc(imgURL(thumb, 120, 120)) + '" alt="">' : '<span class="vsimg round ini">' + esc(String(name).split(' ').map((w) => w[0]).join('').slice(0, 2)) + '</span>';
  const poster = (p) => p ? '<img class="vsimg" src="' + esc(imgURL(p, 120, 180)) + '" alt="">' : '<span class="vsimg"></span>';
  const row = (i, key, img, title, sub, act) => '<div class="vsrow f" data-key="vl-' + key + '"' + (act ? ' data-act="' + A(act) + '"' : '') + '><span class="vrank">' + (i + 1) + '</span>' + img +
    '<span class="vstx"><b>' + esc(title) + '</b><small>' + esc(sub) + '</small></span></div>';
  let head = '', rows = [];
  if (kind === 'actors') { head = t('vsActors'); rows = A2.actors.map((a, i) => row(i, i, face(a.thumb, a.name), a.name, tasteTitlesText(a), () => go2(viewPerson, [a.name, a.thumb]))); }
  if (kind === 'directors') { head = t('vsDirectors'); rows = A2.directors.map((a, i) => row(i, i, face('', a.name), a.name, t('vsFilmsN', { n: a.n }), () => go2(viewPerson, [a.name, '']))); }
  if (kind === 'shows') { head = t('vsTopShows'); rows = A2.shows.map((s, i) => row(i, i, poster(s.thumb), s.title, t('vsEpsOf', { a: s.viewedLeafCount, b: s.leafCount || '?' }), () => go2(viewDetails, [s.ratingKey]))); }
  if (kind === 'movies') { head = t('vsTopMovies'); rows = A2.movies.map((m, i) => row(i, i, poster(m.thumb), m.title, [m.year, m.viewCount > 1 ? t('vsTimes', { n: m.viewCount }) : ''].filter(Boolean).join(' · '), () => go2(viewDetails, [m.ratingKey]))); }
  if (kind === 'year') { head = t('vsThisYear', { y: new Date().getFullYear() }); rows = A2.year.slice(0, 30).map((m, i) => row(i, i, poster(m.thumb), m.title, new Date(m.lastViewedAt * 1000).toLocaleDateString(lang().locale, { day: 'numeric', month: 'short' }), () => go2(viewDetails, [m.ratingKey]))); }
  if (kind === 'decades') {
    head = t('vsDecades');
    /* the same coloured bars as on the tile, lying down, oldest first */
    const dl = (st.decadesAll || []).slice();
    const max = Math.max.apply(null, dl.map((x) => x[1]).concat([1]));
    const topD = st.decade && st.decade.d;
    rows = dl.map((x, i) => '<div class="vdrow f" data-key="vl-' + i + '" data-act="' + A(() => vsGenre(st, { decade: x[0] }, dec(x[0]))) + '">' +
      '<span class="vdl">' + esc(dec(x[0])) + '</span><span class="vdbar"><i class="c' + (i % 3) + (x[0] === topD ? ' top' : '') + '" style="width: ' + Math.max(2, Math.round(x[1] / max * 100)) + '%"></i></span>' +
      '<span class="vdn">' + esc(t('vsFilmsN', { n: x[1] })) + '</span></div>');
  }
  if (kind === 'genres') { head = t('vsGenres'); rows = A2.genres.map((g, i) => row(i, i, '', g.name, g.pct + ' %', () => vsGenre(st, { genre: g.name }, g.name))); }
  const wide = kind === 'decades';
  const el = gradSheet(openModal(sheetHeader(head, (S.user && S.user.title) || (S.account && S.account.title) || '') + '<div class="vslist' + (wide ? ' vsdec' : '') + '">' + (rows.join('') || '<p class="sheettext">' + esc(t('nothing')) + '</p>') + '</div>', 'vl-0', wide));
  if (wide && el) el.classList.add('vsdecsheet');
}
/* a genre (or decade): what you've watched most of it, and what you haven't seen, best rated first */
function vsGenre(st, f, label) {
  const match = (m) => (f.genre ? (m.Genre || []).some((g) => g.tag === f.genre) : Math.floor((m.year || 0) / 10) * 10 === f.decade);
  const r = (m) => Number(m.audienceRating || m.rating || 0);
  /* movies and shows together: a show weighs like a film watched once per dozen episodes */
  const w = (m) => (m.type === 'show' ? 1 + (m.viewedLeafCount || 0) / 12 : (m.viewCount || 0));
  /* a decade lists every film you watched from it (the bars only count films), latest watched first */
  const seen = f.decade != null
    ? st.seenAll.filter(match).sort((a, b) => (b.lastViewedAt || 0) - (a.lastViewedAt || 0)).slice(0, 96)
    : st.seenAll.concat(st.showsSeen || []).filter(match).sort((a, b) => (w(b) - w(a)) || ((b.lastViewedAt || 0) - (a.lastViewedAt || 0))).slice(0, 8);
  const seenN = f.decade != null ? st.seenAll.filter(match).length : 0;
  const x = tasteGet();
  const unseen = st.moviesAll.filter((m) => !m.viewCount).concat((st.showsAll || []).filter((sh) => !sh.viewedLeafCount))
    .filter((m) => match(m) && !x.no[m.ratingKey]).sort((a, b) => r(b) - r(a)).slice(0, 8);
  const card = (m, key) => '<div class="card f" data-key="' + key + '" data-act="' + A(() => vsGo(viewDetails, [m.ratingKey], { kind: 'genre', f: f, label: label })) + '" data-ctx="' + A(() => itemMenu(m)) + '"><div class="imgwrap">' +
    '<img class="img" loading="lazy" src="' + esc(imgURL(m.thumb, 300, 450)) + '" alt=""></div><span class="t">' + esc(m.title) + '</span><span class="s">' +
    esc([m.year, r(m) ? '★ ' + r(m).toFixed(1) : '', m.type === 'show' ? (m.viewedLeafCount ? t('vsEpsN', { n: m.viewedLeafCount }) : t('vsShowWord')) : m.viewCount > 1 ? t('vsTimes', { n: m.viewCount }) : '',
      f.decade != null && m.viewCount && m.lastViewedAt ? new Date(m.lastViewedAt * 1000).toLocaleDateString(lang().locale, { day: 'numeric', month: 'short', year: 'numeric' }) : ''].filter(Boolean).join(' · ')) + '</span></div>';
  const el = openModal(sheetHeader(label, (S.user && S.user.title) || (S.account && S.account.title) || '') +
    '<span class="label">' + esc(f.decade != null ? t('vsWatchedFrom', { s: label, n: seenN }) : t('vsMostWatchedIn')) + '</span><div class="grid8 vsrowcards">' + (seen.map((m, i) => card(m, 'vg-s' + i)).join('') || '<p class="sheettext">' + esc(t('nothing')) + '</p>') + '</div>' +
    '<span class="label">' + esc(t('vsUnseenBest')) + '</span><div class="grid8 vsrowcards">' + (unseen.map((m, i) => card(m, 'vg-u' + i)).join('') || '<p class="sheettext">' + esc(t('nothing')) + '</p>') + '</div>',
    seen.length ? 'vg-s0' : 'vg-u0', true);
  el.classList.add('vsgenre');
}

/* called by Home once the statistics are drawn again */
function vsAfterHome(st) {
  const r = vsReopen; vsReopen = null;
  if (!r || !st) return false;
  const tile = $('[data-key="' + r.tile + '"]', viewEl);
  if (!tile) return false;
  setFocus(tile, true);
  if (r.kind === 'genre') vsGenre(st, r.f, r.label); else vsList(r.kind, st);
  const row = r.row && $('.modal [data-key="' + r.row + '"]', viewEl);
  if (row) setFocus(row, true);
  return true;
}
