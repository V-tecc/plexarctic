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
