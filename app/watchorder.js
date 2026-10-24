/* PLEX:arctic — watch orders for shared TV universes (the Arrowverse).
   Rule: shows start in release order. You watch a show until the episode just before its part of the next
   crossover, then move to the next show and do the same. When every show has reached the crossover, the crossover
   plays in its own order. Shows that are not in a crossover keep up by air date (everything they aired before the
   crossover comes first). After the last crossover, the rest plays season by season, by when each block aired.
   The order is saved as a Plex playlist for the person watching (so other Plex apps see it too), and episodes
   you play from it follow the order: "Next episode" at the credits goes to the next one in the list. */
'use strict';

const WO_PRESETS = {
  arrowverse: {
    name: 'Arrowverse',
    /* release order; matched by TMDB id first, then by title and year */
    shows: [
      { id: 'arrow', tmdb: 1412, titles: ['Arrow'], year: 2012 },
      { id: 'flash', tmdb: 60735, titles: ['The Flash'], year: 2014 },
      { id: 'supergirl', tmdb: 62688, titles: ['Supergirl'], year: 2015 },
      { id: 'legends', tmdb: 62643, titles: ["DC's Legends of Tomorrow", 'Legends of Tomorrow'], year: 2016 },
      { id: 'batwoman', tmdb: 89247, titles: ['Batwoman'], year: 2019 }
    ],
    /* crossovers in the order they aired; parts in the order they play: [show, season, episode] */
    events: [
      { name: 'Flash vs. Arrow', date: '2014-12-02', parts: [['flash', 1, 8], ['arrow', 3, 8]] },
      { name: 'Heroes Join Forces', date: '2015-12-01', parts: [['flash', 2, 8], ['arrow', 4, 8]] },
      { name: 'Invasion!', date: '2016-11-28', parts: [['supergirl', 2, 8], ['flash', 3, 8], ['arrow', 5, 8], ['legends', 2, 7]] },
      { name: 'Duet', date: '2017-03-20', parts: [['supergirl', 2, 16], ['flash', 3, 17]] },
      { name: 'Crisis on Earth-X', date: '2017-11-27', parts: [['supergirl', 3, 8], ['arrow', 6, 8], ['flash', 4, 8], ['legends', 3, 8]] },
      { name: 'Elseworlds', date: '2018-12-09', parts: [['flash', 5, 9], ['arrow', 7, 9], ['supergirl', 4, 9]] },
      { name: 'Crisis on Infinite Earths', date: '2019-12-08', parts: [['supergirl', 5, 9], ['batwoman', 1, 9], ['flash', 6, 9], ['arrow', 8, 8], ['legends', 5, 1]] }
    ]
  }
};

function woStore(id) { return store.get(userKey('wo.' + id), null); }
function woSave(id, v) { store.set(userKey('wo.' + id), v); }

/* which preset a show belongs to (for the button on its page) */
function woPresetFor(m) {
  if (!m || m.type !== 'show') return null;
  const tm = tmdbIdOf(m);
  for (const pid of Object.keys(WO_PRESETS)) {
    const p = WO_PRESETS[pid];
    if (p.shows.some((s) => (tm && s.tmdb === tm) || woTitleMatch(s, m))) return pid;
  }
  return null;
}
function woTitleMatch(s, m) {
  const ft = fold(m.title).replace(/\s*\(\d{4}\)\s*$/, '').trim();
  return s.titles.some((x) => fold(x) === ft) && (!m.year || Math.abs(m.year - s.year) <= 1);
}

/* find the shows in your TV libraries */
async function woFindShows(p) {
  const secs = ((await api('/library/sections')).Directory || []).filter((s) => s.type === 'show');
  const found = {};
  for (const sec of secs) {
    const all = (await api('/library/sections/' + sec.key + '/all', { type: 2, includeGuids: 1, 'X-Plex-Container-Start': 0, 'X-Plex-Container-Size': 20000 })).Metadata || [];
    for (const s of p.shows) {
      if (found[s.id]) continue;
      const hit = all.find((m) => tmdbIdOf(m) === s.tmdb) || all.find((m) => woTitleMatch(s, m));
      if (hit) found[s.id] = hit;
    }
  }
  return found;
}
async function woEpisodes(show) {
  const r = await api('/library/metadata/' + show.ratingKey + '/allLeaves');
  return (r.Metadata || []).filter((e) => e.parentIndex >= 1).sort((a, b) => (a.parentIndex - b.parentIndex) || (a.index - b.index));
}

/* the order itself (pure: shows → episode lists, so it can be tested on its own) */
function woOrder(p, eps) {
  const out = [];
  const ptr = {};
  p.shows.forEach((s) => { ptr[s.id] = 0; });
  const list = (id) => eps[id] || [];
  /* an episode without an air date counts as airing with the one before it */
  const dateOf = (id, i) => { const l = list(id); for (let k = i; k >= 0; k--) if (l[k] && l[k].originallyAvailableAt) return l[k].originallyAvailableAt; return ''; };
  const take = (id, upto, why) => { const l = list(id); while (ptr[id] < upto && ptr[id] < l.length) { out.push({ show: id, ep: l[ptr[id]], why: why }); ptr[id]++; } };
  const idxOf = (id, se, ep) => list(id).findIndex((e) => e.parentIndex === se && e.index === ep);
  for (const ev of p.events) {
    const inEvent = {};
    ev.parts.forEach(([id, se, ep]) => {
      let i = idxOf(id, se, ep);
      if (i < 0) i = list(id).findIndex((e) => e.parentIndex > se || (e.parentIndex === se && e.index > ep)); /* part missing: stop at where it would be */
      if (i < 0) i = list(id).length;
      if (!(id in inEvent)) inEvent[id] = i;
    });
    /* everyone catches up, in release order */
    for (const s of p.shows) {
      if (s.id in inEvent) take(s.id, inEvent[s.id], '');
      else { const l = list(s.id); let i = ptr[s.id]; while (i < l.length && dateOf(s.id, i) && dateOf(s.id, i) < ev.date) i++; take(s.id, i, ''); }
    }
    /* then the crossover */
    ev.parts.forEach(([id, se, ep], n) => {
      const i = idxOf(id, se, ep);
      if (i >= 0 && i === ptr[id]) { out.push({ show: id, ep: list(id)[i], why: ev.name + ' · ' + (n + 1) + '/' + ev.parts.length }); ptr[id]++; }
    });
  }
  /* after the last crossover: the rest of each season as a block, the block that aired first goes first */
  for (;;) {
    let best = null;
    for (const s of p.shows) {
      const l = list(s.id);
      if (ptr[s.id] >= l.length) continue;
      const d = dateOf(s.id, ptr[s.id]) || '9999';
      if (!best || d < best.d) best = { id: s.id, d: d };
    }
    if (!best) break;
    const l = list(best.id), se = l[ptr[best.id]].parentIndex;
    let end = ptr[best.id];
    while (end < l.length && l[end].parentIndex === se) end++;
    take(best.id, end, '');
  }
  return out;
}

/* build (or rebuild) the order and the Plex playlist */
async function woBuild(pid, say) {
  const p = WO_PRESETS[pid];
  say(t('woFinding'));
  const shows = await woFindShows(p);
  if (!Object.keys(shows).length) throw new Error(t('woNoShows'));
  const eps = {};
  for (const s of p.shows) if (shows[s.id]) { say(t('woReading', { s: shows[s.id].title })); eps[s.id] = await woEpisodes(shows[s.id]); }
  const order = woOrder(p, eps);
  const keys = order.map((x) => String(x.ep.ratingKey));
  const crossover = {};
  order.forEach((x) => { if (x.why) crossover[x.ep.ratingKey] = x.why; });
  /* the playlist: replace the old one */
  say(t('woPlaylist'));
  const title = p.name + ' · ' + t('woTitle');
  const old = woStore(pid);
  try {
    const pls = ((await api('/playlists', { playlistType: 'video' })).Metadata || []).filter((x) => x.title === title || (old && String(x.ratingKey) === String(old.playlist)));
    for (const x of pls) await fetch(pmsURL('/playlists/' + x.ratingKey), { method: 'DELETE' }).catch(() => {});
  } catch (e) { /* ignore */ }
  let playlist = null;
  const uri = (ks) => 'server://' + S.server.id + '/com.plexapp.plugins.library/library/metadata/' + ks.join(',');
  const B = 120;
  try {
    const r = await fetch(pmsURL('/playlists', { type: 'video', title: title, smart: 0, uri: uri(keys.slice(0, B)) }), { method: 'POST', headers: { Accept: 'application/json' } });
    const j = await r.json();
    playlist = (((j.MediaContainer || {}).Metadata || [])[0] || {}).ratingKey || null;
    for (let i = B; playlist && i < keys.length; i += B) {
      say(t('woPlaylistN', { n: Math.min(i + B, keys.length), m: keys.length }));
      await fetch(pmsURL('/playlists/' + playlist + '/items', { uri: uri(keys.slice(i, i + B)) }), { method: 'PUT' });
    }
  } catch (e) { playlist = null; }
  const shown = {};
  Object.keys(shows).forEach((id) => { shown[id] = { key: shows[id].ratingKey, title: shows[id].title }; });
  woSave(pid, { at: Date.now(), keys: keys, crossover: crossover, shows: shown, playlist: playlist });
  return { n: keys.length, playlist: playlist, missing: p.shows.filter((s) => !shows[s.id]).map((s) => s.titles[0]) };
}

/* the player asks: does this episode belong to an order you're following? → the next one */
function woNextKey(ratingKey) {
  for (const pid of Object.keys(WO_PRESETS)) {
    const o = woStore(pid);
    if (!o || !o.keys) continue;
    const i = o.keys.indexOf(String(ratingKey));
    if (i >= 0) return o.keys[i + 1] || null;
  }
  return undefined;
}

/* fresh watched state for every episode in the order */
async function woProgress(pid) {
  const o = woStore(pid);
  const byKey = new Map();
  for (const id of Object.keys(o.shows || {})) {
    try { ((await api('/library/metadata/' + o.shows[id].key + '/allLeaves')).Metadata || []).forEach((e) => byKey.set(String(e.ratingKey), e)); } catch (e) { /* ignore */ }
  }
  const items = o.keys.map((k) => byKey.get(k)).filter(Boolean);
  const next = items.find((e) => e.viewOffset) || items.find((e) => !e.viewCount) || null;
  return { items: items, next: next, seen: items.filter((e) => e.viewCount && !e.viewOffset).length };
}

function woLabel(e, o) {
  return (e.grandparentTitle || '') + ' · ' + epCode(e) + (e.title ? ' · ' + e.title : '');
}

/* the sheet behind the button on the show page */
async function woSheet(pid) {
  const p = WO_PRESETS[pid];
  const o = woStore(pid);
  if (!o) {
    gradSheet(openModal(sheetHeader(t('woHeading', { s: p.name })) +
      '<p class="sheettext">' + esc(t('woExplain')) + '</p><p class="sheettext small" id="wostat"></p>' +
      '<div class="optlist">' + optionRow('wo-build', t('woBuild'), [], false, A(() => woRunBuild(pid))) + '</div>', 'wo-build'));
    return;
  }
  const el = gradSheet(openModal(sheetHeader(t('woHeading', { s: p.name }), t('woCounting')) + '<p class="sheettext small" id="wostat"></p><div class="optlist" id="wolist"></div>', null));
  let pr;
  try { pr = await woProgress(pid); } catch (e) { toast(t('woFailed') + ' (' + (e.message || e) + ')', 6000); return; }
  if (!document.contains(el)) return;
  const cnt = $('.shead .count', el); if (cnt) cnt.textContent = t('woSeen', { a: pr.seen, b: pr.items.length });
  const rows = [];
  if (pr.next) {
    const why = o.crossover[pr.next.ratingKey];
    rows.push(optionRow('wo-next', (pr.next.viewOffset ? t('resume') : t('woNext')) + ': ' + woLabel(pr.next), why ? ['CROSSOVER'] : [], false,
      A(() => { closeModal(true); go(viewPlayer, [pr.next.ratingKey, pr.next.viewOffset ? {} : { fromStart: true }]); }), why || ''));
  }
  rows.push(optionRow('wo-list', t('woShowList'), [], false, A(() => { closeModal(true); woListSheet(pid, pr); })));
  rows.push(optionRow('wo-build', t('woRebuild'), [], false, A(() => woRunBuild(pid)), t('woRebuildNote', { d: new Date(o.at).toLocaleDateString(lang().locale, { day: 'numeric', month: 'short' }) })));
  $('#wolist', el).innerHTML = rows.join('');
  setFocus($('[data-key="' + (pr.next ? 'wo-next' : 'wo-list') + '"]', el));
}
async function woRunBuild(pid) {
  const say = (msg) => { const s = $('#wostat'); if (s) s.textContent = msg; };
  try {
    const r = await woBuild(pid, say);
    toast(t('woBuilt', { n: r.n }) + (r.missing.length ? ' ' + t('woMissing', { s: r.missing.join(', ') }) : '') + (r.playlist ? '' : ' ' + t('woNoPlaylist')), 7000);
    closeModal(true);
    woSheet(pid);
  } catch (e) { say(t('woFailed') + ' (' + (e.message || e) + ')'); }
}
/* the whole list, crossovers marked, starting at where you are */
function woListSheet(pid, pr) {
  const o = woStore(pid);
  const nextKey = pr.next ? String(pr.next.ratingKey) : '';
  let lastShow = '';
  const rows = pr.items.map((e, i) => {
    const why = o.crossover[e.ratingKey];
    const seen = e.viewCount && !e.viewOffset;
    const head = e.grandparentTitle !== lastShow && !why;
    lastShow = why ? '' : e.grandparentTitle;
    return '<div class="worow f' + (why ? ' x' : '') + (seen ? ' seen' : '') + (head ? ' head' : '') + '" data-key="wl-' + e.ratingKey + '" data-act="' +
      A(() => { closeModal(true); go(viewPlayer, [e.ratingKey, e.viewOffset ? {} : { fromStart: true }]); }) + '">' +
      '<span class="n">' + (i + 1) + '</span><span class="chk">' + (seen ? ICON.check : '') + '</span>' +
      '<span class="tx"><b>' + esc(e.grandparentTitle + ' · ' + epCode(e)) + '</b> ' + esc(e.title || '') + (why ? '<small>' + esc(why) + '</small>' : '') + '</span></div>';
  }).join('');
  gradSheet(openModal(sheetHeader(t('woHeading', { s: WO_PRESETS[pid].name }), t('woSeen', { a: pr.seen, b: pr.items.length })) +
    '<div class="wolist">' + rows + '</div>', nextKey ? 'wl-' + nextKey : (pr.items[0] ? 'wl-' + pr.items[0].ratingKey : null)));
}
