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
  if (prev === dir) { toast(t(dir > 0 ? 'tasteAlreadyMore' : 'tasteAlreadyLess'), 3000); return; }
  const step = dir - prev; /* switching from "less" to "more" undoes the first one too */
  (m.Genre || []).forEach((g) => { x.g[g.tag] = clampT((x.g[g.tag] || 0) + step, -6, 6); });
  (m.Role || []).slice(0, 4).forEach((r) => { x.a[r.tag] = clampT((x.a[r.tag] || 0) + step * 0.6, -4, 4); });
  delete x.yes[key]; delete x.no[key];
  if (dir > 0) x.yes[key] = Date.now(); else x.no[key] = Date.now();
  tasteSave(x);
  toast(t(dir > 0 ? 'tasteMoreDone' : 'tasteLessDone', { s: m.title }), 4000);
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
    optionRow('cx-more', t('tasteMore'), [], !!x.yes[k], A(() => { closeModal(true); tasteMark(it, 1); }), t('tasteMoreSub')),
    optionRow('cx-less', t('tasteLess'), [], !!x.no[k], A(() => { closeModal(true); tasteMark(it, -1); }), t('tasteLessSub'))
  ];
}

ICON.thumbDown = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.7a2 2 0 0 0-2 1.7l-1.4 9a2 2 0 0 0 2 2.3z"></path><path d="M17 2h2.7A2.3 2.3 0 0 1 22 4v7a2.3 2.3 0 0 1-2.3 2H17"></path></svg>';

/* favourite actors: the full cast (top eight billed) of the films this profile watched most recently, from Plex's own
   watch history. Casts are kept on this device so each film is only asked for once; a few new ones per visit. */
async function tasteFavActors(movies, h) {
  const watched = movies.filter((m) => m.viewCount).sort((a, b) => (b.lastViewedAt || 0) - (a.lastViewedAt || 0)).slice(0, 80);
  const cache = store.get('castCache.' + S.server.id, {}) || {};
  /* casts saved before pictures were kept are asked for again once */
  const missing = watched.filter((m) => !cache[m.ratingKey] || (cache[m.ratingKey].length && cache[m.ratingKey][0].length < 3)).slice(0, 30);
  for (let i = 0; i < missing.length; i += 6) {
    await Promise.all(missing.slice(i, i + 6).map((m) => api('/library/metadata/' + m.ratingKey).then((r) => {
      const full = (r.Metadata || [])[0];
      cache[m.ratingKey] = ((full && full.Role) || []).slice(0, 8).map((x) => [x.tag, x.id || x.tagKey || '', x.thumb || '']);
    }).catch(() => {})));
  }
  const ks = Object.keys(cache); if (ks.length > 1500) ks.slice(0, ks.length - 1500).forEach((k) => delete cache[k]);
  try { store.set('castCache.' + S.server.id, cache); } catch (e) { /* full: carry on */ }
  const count = new Map();
  watched.forEach((m) => (cache[m.ratingKey] || (m.Role || []).map((x) => [x.tag, x.id || '', x.thumb || ''])).forEach(([name, id, thumb]) => {
    const c = count.get(name) || { name: name, id: id, thumb: thumb || '', n: 0 };
    c.n++; if (!c.id && id) c.id = id; if (!c.thumb && thumb) c.thumb = thumb;
    count.set(name, c);
  }));
  const x = tasteGet();
  const favs = Array.from(count.values()).filter((c) => c.n >= 2 && c.id && (x.a[c.name] || 0) > -1).sort((a, b) => b.n - a.n);
  /* the scoring uses these too */
  if (h) { favs.forEach((c) => h.actors.set(c.name, Math.max(h.actors.get(c.name) || 0, c.n))); h.favs = favs; }
  return favs;
}

/* ---------- the profile's own statistics (Home → Your viewing) ---------- */
function tasteStats(movies, shows, h) {
  const seen = movies.filter((m) => m.viewCount);
  if (!seen.length && !(shows || []).some((s) => s.viewedLeafCount)) return null;
  const top = (map, n) => Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, n);
  const genres = new Map(), dirs = new Map(), decades = new Map();
  let minutes = 0;
  seen.forEach((m) => {
    (m.Genre || []).forEach((g) => genres.set(g.tag, (genres.get(g.tag) || 0) + 1));
    (m.Director || []).forEach((g) => dirs.set(g.tag, (dirs.get(g.tag) || 0) + 1));
    if (m.year) { const d = Math.floor(m.year / 10) * 10; decades.set(d, (decades.get(d) || 0) + 1); }
    minutes += Math.round((m.duration || 0) / 60000) * Math.max(1, m.viewCount || 1);
  });
  const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime() / 1000;
  const thisYear = seen.filter((m) => (m.lastViewedAt || 0) >= yearStart).length;
  const re = seen.filter((m) => m.viewCount > 1).sort((a, b) => b.viewCount - a.viewCount)[0] || null;
  const sh = (shows || []).filter((s) => s.viewedLeafCount).sort((a, b) => b.viewedLeafCount - a.viewedLeafCount);
  const eps = sh.reduce((n, s) => n + (s.viewedLeafCount || 0), 0);
  return {
    movies: seen.length, hours: Math.round(minutes / 60), thisYear: thisYear, eps: eps, showsN: sh.length,
    genres: top(genres, 3).map((g) => ({ name: g[0], pct: Math.round(g[1] / seen.length * 100) })),
    director: top(dirs, 1).map((d) => ({ name: d[0], n: d[1] }))[0] || null,
    decade: top(decades, 1).map((d) => ({ d: d[0], n: d[1] }))[0] || null,
    actors: ((h && h.favs) || []).slice(0, 3),
    show: sh[0] || null, rewatch: re
  };
}
function tasteStatsHTML(st, movieSec, showSec) {
  if (!st) return '';
  const nf = (n) => Number(n).toLocaleString(lang().locale);
  const tiles = [];
  const tile = (key, cls, inner, act) => tiles.push('<div class="vtile f ' + cls + '" data-key="vs-' + key + '"' + (act ? ' data-act="' + A(act) + '"' : '') + '>' + inner + '</div>');
  tile('movies', '', '<span class="vl">' + esc(t('vsMovies')) + '</span><b>' + nf(st.movies) + '</b><small>' + esc(t('vsHours', { n: nf(st.hours) })) + '</small>', movieSec ? () => go(viewLibrary, [movieSec]) : null);
  tile('eps', '', '<span class="vl">' + esc(t('vsEpisodes')) + '</span><b>' + nf(st.eps) + '</b><small>' + esc(t('vsShowsN', { n: nf(st.showsN) })) + '</small>', showSec ? () => go(viewLibrary, [showSec]) : null);
  if (st.actors.length) tile('actors', 'wide', '<span class="vl">' + esc(t('vsActors')) + '</span><div class="vfaces">' + st.actors.map((a, i) =>
    '<div class="vface"><span class="vrank">' + (i + 1) + '</span>' + (a.thumb ? '<img src="' + esc(imgURL(a.thumb, 160, 160)) + '" alt="">' : '<span class="ini">' + esc(a.name.split(' ').map((w) => w[0]).join('').slice(0, 2)) + '</span>') +
    '<b>' + esc(a.name) + '</b><small>' + esc(t('vsFilmsN', { n: a.n })) + '</small></div>').join('') + '</div>', () => go(viewPerson, [st.actors[0].name, st.actors[0].thumb]));
  if (st.genres.length) tile('genre', '', '<span class="vl">' + esc(t('vsGenre')) + '</span><b class="vtext">' + esc(st.genres[0].name) + '</b><small>' + esc(st.genres.map((g) => g.name + ' ' + g.pct + ' %').join(' · ')) + '</small>');
  if (st.show) tile('show', 'withart', (st.show.art ? '<img class="vart" src="' + esc(imgURL(st.show.art, 640, 360)) + '" alt="">' : '') + '<span class="vl">' + esc(t('vsTopShow')) + '</span><b class="vtext">' + esc(st.show.title) + '</b><small>' + esc(t('vsEpsN', { n: st.show.viewedLeafCount })) + '</small>', () => go(viewDetails, [st.show.ratingKey]));
  if (st.director) tile('dir', '', '<span class="vl">' + esc(t('vsDirector')) + '</span><b class="vtext">' + esc(st.director.name) + '</b><small>' + esc(t('vsFilmsN', { n: st.director.n })) + '</small>');
  if (st.decade) tile('decade', '', '<span class="vl">' + esc(t('vsDecade')) + '</span><b>' + esc(String(st.decade.d) + (S.lang === 'sv' ? '-talet' : 's')) + '</b><small>' + esc(t('vsFilmsN', { n: st.decade.n })) + '</small>');
  tile('year', '', '<span class="vl">' + esc(t('vsThisYear', { y: new Date().getFullYear() })) + '</span><b>' + nf(st.thisYear) + '</b><small>' + esc(t('vsMoviesShort')) + '</small>');
  if (st.rewatch) tile('re', 'withart', (st.rewatch.art ? '<img class="vart" src="' + esc(imgURL(st.rewatch.art, 640, 360)) + '" alt="">' : '') + '<span class="vl">' + esc(t('vsRewatched')) + '</span><b class="vtext">' + esc(st.rewatch.title) + '</b><small>' + esc(t('vsTimes', { n: st.rewatch.viewCount })) + '</small>', () => go(viewDetails, [st.rewatch.ratingKey]));
  return '<section class="hub"><div class="hubhead"><h2>' + esc(t('vsTitle')) + '</h2><span>' + esc(t('vsSub', { s: (S.user && S.user.title) || (S.account && S.account.title) || '' })) + '</span></div><div class="vtiles">' + tiles.join('') + '</div></section>';
}
