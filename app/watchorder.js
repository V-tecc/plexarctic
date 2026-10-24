/* PLEX:arctic — watch orders for shared TV universes (the Arrowverse).
   Rule: shows start in release order. You watch a show until the episode just before its part of the next
   crossover, then move to the next show and do the same. When every show has reached the crossover, the crossover
   plays in its own order. Shows that are not in a crossover keep up by air date (everything they aired before the
   crossover comes first). After the last crossover, the rest plays season by season, by when each block aired.
   It shows up in TV Shows as a series of its own ("Arrowverse"), with seasons by TV year, and with the episodes
   you don't have mixed in when "Missing episodes" is on (from TVmaze, like a normal show). The order is also saved
   as a Plex playlist for the person watching, and "Next episode" at the credits follows it. */
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
  const today = new Date().toISOString().slice(0, 10);
  const eps = {};
  let ghosts = 0;
  for (const s of p.shows) {
    if (!shows[s.id]) continue;
    say(t('woReading', { s: shows[s.id].title }));
    const lib = await woEpisodes(shows[s.id]);
    /* the episodes you don't have (aired ones), so they get their place in the order too */
    let tv = [];
    try { const sh = await tvmFor(shows[s.id]); tv = (sh && sh._embedded && sh._embedded.episodes) || []; } catch (e) { /* ignore */ }
    const have = new Set(lib.map((e) => e.parentIndex + ':' + e.index));
    const gh = tv.filter((e) => e.season >= 1 && e.number && e.airdate && e.airdate <= today && !have.has(e.season + ':' + e.number)).map((e) => ({
      ghost: true, parentIndex: e.season, index: e.number, title: e.name || '', originallyAvailableAt: e.airdate,
      image: (e.image && (e.image.medium || e.image.original)) || '', summary: stripTags(e.summary).slice(0, 400)
    }));
    ghosts += gh.length;
    eps[s.id] = lib.concat(gh).sort((a, b) => (a.parentIndex - b.parentIndex) || (a.index - b.index));
  }
  const order = woOrder(p, eps);
  const items = order.map((x) => {
    const e = x.ep;
    const it = { s: x.show, se: e.parentIndex, ep: e.index, d: e.originallyAvailableAt || '' };
    if (x.why) it.x = x.why;
    if (e.ghost) it.g = { t: e.title, i: e.image, u: e.summary };
    else it.k = String(e.ratingKey);
    return it;
  });
  const keys = items.filter((x) => x.k).map((x) => x.k);
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
  Object.keys(shows).forEach((id) => { shown[id] = { key: shows[id].ratingKey, title: shows[id].title, thumb: shows[id].thumb || '', art: shows[id].art || '', addedAt: shows[id].addedAt || 0 }; });
  woSave(pid, { v: 2, at: Date.now(), keys: keys, items: items, shows: shown, playlist: playlist, seen: old && old.seen || 0 });
  woPosterMake(pid).catch(() => {});
  return { n: keys.length, ghosts: ghosts, playlist: playlist, missing: p.shows.filter((s) => !shows[s.id]).map((s) => s.titles[0]) };
}

/* the player asks: does this episode belong to an order? → the next one you have */
function woNextKey(ratingKey) {
  for (const pid of Object.keys(WO_PRESETS)) {
    const o = woStore(pid);
    if (!o || !o.keys) continue;
    const i = o.keys.indexOf(String(ratingKey));
    if (i >= 0) return o.keys[i + 1] || null;
  }
  return undefined;
}

/* poster for the series card: the first four shows' posters as a 2×2 picture, kept on this device */
async function woPosterMake(pid) {
  const o = woStore(pid);
  if (!o) return;
  const ids = WO_PRESETS[pid].shows.map((s) => s.id).filter((id) => o.shows[id] && o.shows[id].thumb).slice(0, 4);
  if (!ids.length) return;
  const load = (src) => new Promise((res, rej) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = rej; im.src = src; });
  const imgs = await Promise.all(ids.map((id) => load(imgURL(o.shows[id].thumb, 300, 450)).catch(() => null)));
  const c = document.createElement('canvas'); c.width = 600; c.height = 900;
  const g = c.getContext('2d');
  g.fillStyle = '#111'; g.fillRect(0, 0, 600, 900);
  const n = imgs.length;
  imgs.forEach((im, i) => {
    if (!im) return;
    const w = n === 1 ? 600 : 300, h = n <= 2 ? 900 : 450;
    const x = n === 1 ? 0 : (i % 2) * 300, y = n <= 2 ? 0 : Math.floor(i / 2) * 450;
    g.drawImage(im, x, y, w, h);
  });
  const gr = g.createLinearGradient(0, 560, 0, 900);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.92)');
  g.fillStyle = gr; g.fillRect(0, 560, 600, 340);
  g.fillStyle = '#fff'; g.textAlign = 'center';
  g.font = '700 70px Roboto, Arial, sans-serif';
  g.fillText(WO_PRESETS[pid].name.toUpperCase(), 300, 850, 560);
  g.fillStyle = '#2DD4BF'; g.fillRect(270, 868, 60, 5);
  try { store.set('woPoster.' + pid, c.toDataURL('image/jpeg', 0.82)); } catch (e) { /* tainted picture or no room: the first show's poster is used */ }
}

/* the card in TV Shows: added when the library has at least one of the shows */
function woLibraryItems(sec, items) {
  const out = [];
  for (const pid of Object.keys(WO_PRESETS)) {
    const p = WO_PRESETS[pid];
    const members = items.filter((m) => m.type === 'show' && p.shows.some((s) => woTitleMatch(s, m) || (tmdbIdOf(m) && tmdbIdOf(m) === s.tmdb)));
    if (!members.length) continue;
    const o = woStore(pid);
    const first = members.slice().sort((a, b) => (a.year || 0) - (b.year || 0))[0];
    out.push({
      ratingKey: 'wo-' + pid, virtual: pid, type: 'show', title: p.name, year: first.year,
      thumb: woPosterRef(pid, first.thumb), art: woArt(pid).art || woPresetArt(pid).art || first.art,
      addedAt: Math.max.apply(null, members.map((m) => m.addedAt || 0)), updatedAt: Math.max.apply(null, members.map((m) => m.updatedAt || 0)),
      Genre: first.Genre, contentRating: first.contentRating, summary: t('woSummary'),
      childCount: o && o.seasons || 0, leafCount: o ? o.keys.length : 0, viewedLeafCount: o && o.seen || 0
    });
  }
  return out;
}

/* ---------- the series page ---------- */
function woShort(id) { return { arrow: 'Arrow', flash: 'The Flash', supergirl: 'Supergirl', legends: 'Legends', batwoman: 'Batwoman' }[id] || id; }
/* TV years: a season runs from August to July */
function woYear(d) { if (!d) return 0; const y = +d.slice(0, 4), mo = +d.slice(5, 7); return mo >= 8 ? y : y - 1; }
function woYearLabel(y) { return y + '–' + String((y + 1) % 100).padStart(2, '0'); }

async function viewUniverse(pid, opts) {
  opts = opts || {};
  const seq = viewSeq;
  const p = WO_PRESETS[pid];
  if (!p) throw new Error(t('notFound'));
  const shell = (msg) => render('<div class="screen"><div class="top"><button type="button" class="crumb f" data-key="crumb" data-act="' + A(back) + '">' + ICON.back + esc(t('shows')) + '</button>' + clockHTML() + '</div><div class="empty" id="wobusy">' + esc(msg) + '</div></div>');
  shell(t('loading'));
  let o = woStore(pid);
  if (!o || o.v !== 2) {
    try { await woBuild(pid, (msg) => { const el = $('#wobusy'); if (el) el.textContent = msg; }); } catch (e) { const el = $('#wobusy'); if (el) el.textContent = t('woFailed') + ' (' + (e.message || e) + ')'; return; }
    if (seq !== viewSeq) return;
    o = woStore(pid);
  }
  /* fresh watched state and pictures for everything you have */
  const live = new Map();
  let heroArt = '';
  for (const id of Object.keys(o.shows)) {
    try {
      const r = await api('/library/metadata/' + o.shows[id].key + '/allLeaves');
      if (!heroArt && r.art) heroArt = r.art;
      (r.Metadata || []).forEach((e) => live.set(String(e.ratingKey), e));
    } catch (e) { /* ignore */ }
  }
  if (woArt(pid).art || woPresetArt(pid).art) heroArt = woArt(pid).art || woPresetArt(pid).art;
  if (!heroArt) { const f = WO_PRESETS[pid].shows.find((x) => o.shows[x.id] && o.shows[x.id].art); if (f) heroArt = o.shows[f.id].art; }
  if (seq !== viewSeq) return;
  /* every item, real or missing, with its TV-year season (seasons only go forward, so catching up stays in one) */
  let yr = 0;
  const rows = [];
  o.items.forEach((it) => {
    const e = it.k ? live.get(it.k) : null;
    if (it.k && !e) return; /* removed from the library since the order was made */
    yr = Math.max(yr, woYear(it.d) || yr);
    rows.push({ it: it, e: e, ghost: !it.k, year: yr });
  });
  const years = Array.from(new Set(rows.map((r) => r.year))).filter(Boolean);
  const mine = rows.filter((r) => !r.ghost);
  const seen = mine.filter((r) => r.e.viewCount && !r.e.viewOffset).length;
  const next = (mine.find((r) => r.e.viewOffset) || mine.find((r) => !r.e.viewCount) || null);
  o.seen = seen; o.seasons = years.length; woSave(pid, o);
  const state = { year: opts.year || (next ? next.year : years[0]) };
  modalArt = null;

  keyHandler = (e) => {
    if (e.key !== 'Escape' || modalOpen() || !focused) return false;
    if (focused.closest('.actions') || focused.dataset.key === 'crumb') return false;
    const top = $('.actions [data-default]', viewEl) || $('.actions .f', viewEl);
    if (!top) return false;
    setFocus(top, true);
    const sc = $('.dscroll', viewEl); if (sc) sc.scrollTop = 0;
    return true;
  };
  const code = (r) => woShort(r.it.s) + ' · S' + r.it.se + ' E' + r.it.ep;
  const title = (r) => r.ghost ? r.it.g.t : r.e.title;
  const status = (r) => t('notInLibrary');
  const openGhost = (r) => openModal(sheetHeader(code(r) + (title(r) ? ' · ' + title(r) : ''), status(r)) +
    (r.it.g.i ? '<img class="sheetimg" src="' + esc(r.it.g.i) + '" alt="">' : '') +
    '<div class="tags"><span class="tag">' + esc(status(r).toUpperCase()) + '</span>' + (r.it.x ? '<span class="tag">' + esc(r.it.x.toUpperCase()) + '</span>' : '') + '</div>' +
    (r.it.g.u ? '<p class="sheettext">' + esc(r.it.g.u) + '</p>' : '') +
    '<button type="button" class="btn f" data-default data-act="' + A(() => closeModal()) + '">' + ICON.back + esc(t('back')) + '</button>');
  const act = (r) => A(() => (r.ghost ? openGhost(r) : go(viewDetails, [r.e.ratingKey])));
  const key = (r) => (r.ghost ? 'g-' + r.it.s + '-' + r.it.se + '-' + r.it.ep : 'e-' + r.e.ratingKey);
  const xTag = (r) => (r.it.x ? '<span class="woxtag">' + esc(r.it.x) + '</span>' : '');

  const episodesHTML = () => {
    const list = rows.filter((r) => r.year === state.year && (S.showMissing || !r.ghost));
    if (!list.length) return '<div class="empty">' + esc(t('nothing')) + '</div>';
    const v = S.epView;
    if (v === 'list') {
      return '<div class="eplist">' + list.map((r) => '<div class="eprow2 wo f' + (r.ghost ? ' ghost' : '') + (r.it.x ? ' wox' : '') + '" data-key="' + key(r) + '" data-act="' + act(r) + '">' +
        '<div class="emain"><span class="num">' + esc(code(r)) + '</span><span class="et">' + esc(title(r)) + '</span>' + xTag(r) +
        (r.ghost ? '<span class="tag">' + esc(status(r).toUpperCase()) + '</span>' : (progress(r.e) ? '<span class="mini"><i style="width: ' + progress(r.e) + '%"></i></span>' : '') +
        '<span class="ed">' + esc(durText(r.e.duration)) + '</span><span class="ew">' + (r.e.viewCount && !r.e.viewOffset ? ICON.check : '') + '</span>') + '</div><div class="ex"></div></div>').join('') + '</div>';
    }
    if (v === 'detailed') {
      return '<div class="eplist">' + list.map((r) => {
        const th = r.ghost ? r.it.g.i : imgURL(r.e.thumb, 480, 270);
        return '<div class="epdet f' + (r.ghost ? ' ghost' : '') + '" data-key="' + key(r) + '" data-act="' + act(r) + '">' +
          '<div style="position: relative">' + (th ? '<img class="img" loading="lazy" src="' + esc(th) + '" alt="">' : '<div class="img"></div>') +
          (!r.ghost && r.e.viewCount && !r.e.viewOffset ? '<span class="watched">' + ICON.check + '</span>' : '') + '</div>' +
          '<div class="eptext"><b>' + esc(code(r) + ' · ' + title(r)) + '</b>' + xTag(r) +
          (r.ghost ? '<span class="tags"><span class="tag">' + esc(status(r).toUpperCase()) + '</span></span>' : '<span class="count">' + esc([durText(r.e.duration), r.e.originallyAvailableAt ? t('aired', { d: r.e.originallyAvailableAt }) : ''].filter(Boolean).join(' · ')) + '</span>') +
          '<p>' + esc(r.ghost ? r.it.g.u || '' : r.e.summary || '') + '</p></div></div>';
      }).join('') + '</div>';
    }
    return '<div class="hrow hide-scroll">' + list.map((r) => {
      const th = r.ghost ? r.it.g.i : imgURL(r.e.thumb, 480, 270);
      const pct = r.ghost ? 0 : progress(r.e);
      return '<div class="card ep f' + (r.ghost ? ' ghost' : '') + '" data-key="' + key(r) + '" data-act="' + act(r) + '">' +
        '<div style="position: relative">' + (th ? '<img class="img" loading="lazy" src="' + esc(th) + '" alt="">' : '<div class="img"></div>') +
        (r.ghost ? '<span class="ghosttag">' + esc(status(r)) + '</span>' : '') + (r.it.x ? '<span class="woxbadge">' + esc(r.it.x) + '</span>' : '') +
        (!r.ghost && r.e.viewCount && !r.e.viewOffset ? '<span class="watched">' + ICON.check + '</span>' : '') + '</div>' +
        (pct ? '<div class="bar"><i style="width: ' + pct + '%"></i></div>' : '') +
        '<div class="t" style="font-size: 18px">' + esc(code(r)) + '</div><div class="s">' + esc(title(r)) + '</div></div>';
    }).join('') + '</div>';
  };

  const draw = () => {
    const ghostN = rows.filter((r) => r.ghost).length;
    const meta = [woYearLabel(years[0]).slice(0, 4) + '–' + (years[years.length - 1] + 1), t('woNShows', { n: Object.keys(o.shows).length }), t('seasonsN', { n: years.length }), t('woSeen', { a: seen, b: mine.length })];
    let actions = '';
    if (next) actions += '<button type="button" class="btn primary f" data-default data-key="playnext" data-act="' + A(() => go(viewPlayer, [next.e.ratingKey, next.e.viewOffset ? {} : { fromStart: true }])) + '">' + ICON.play + esc((next.e.viewOffset ? t('resume') : t('play')) + ' ' + woShort(next.it.s) + ' S' + next.it.se + ' E' + next.it.ep) + '</button>';
    actions += '<button type="button" class="btn f" data-key="worebuild" data-act="' + A(rebuild) + '">' + esc(t('woRebuild')) + '</button>';
    actions += '<button type="button" class="btn icon f" data-key="wmore" aria-label="' + esc(t('woMore')) + '" data-act="' + A(() => woMenu({ virtual: pid, title: p.name, thumb: '', leafCount: mine.length, viewedLeafCount: seen })) + '">' + ICON.gear + '</button>';
    const tab = (y) => '<button type="button" class="f' + (y === state.year ? ' on' : '') + '" data-key="y-' + y + '" data-act="' + A(() => { state.year = y; redraw('y-' + y); }) + '">' + esc(woYearLabel(y)) + '</button>';
    const ev = S.epView;
    render('<div class="dscroll hide-scroll">' +
      '<div class="hero">' + (heroArt ? '<img src="' + esc(imgURL(heroArt, 1600, 900)) + '" alt="">' : '') + '</div>' +
      '<div style="display: flex; justify-content: space-between; align-items: center; position: relative; z-index: 2"><button type="button" class="crumb f" data-key="crumb" data-act="' + A(back) + '">' + ICON.back + esc(t('shows')) + '</button>' +
      '<div style="display: flex; align-items: center; gap: 28px">' + clockHTML(!!heroArt, 'margin-left: 0') + '</div></div>' +
      '<div style="position: relative; z-index: 2">' +
      '<h1 class="dtitle">' + esc(p.name) + '</h1>' +
      '<div class="dmeta">' + meta.map((x) => '<span>' + esc(x) + '</span>').join('<span aria-hidden="true">·</span>') + '</div>' +
      '<p class="summary">' + esc(t('woSummary')) + (ghostN ? ' ' + esc(t('woGhosts', { n: ghostN })) : '') + '</p>' +
      '<div class="actions">' + actions + '</div>' +
      '<div class="tabsrow"><div class="tabs" data-nav-r="missing,ev-' + ev + '">' + years.map(tab).join('') + '</div>' +
      '<div class="tabtools">' +
      '<button type="button" class="chip f' + (S.showMissing ? ' on' : '') + '" data-key="missing" data-act="' + A(() => { S.showMissing = !S.showMissing; store.set('showMissing', S.showMissing); redraw('missing'); }) + '">' + (S.showMissing ? ICON.check : '') + esc(t('showMissing')) + '</button>' +
      '<div class="seg">' + [['cards', t('cards')], ['list', t('list')], ['detailed', t('detailed')]].map((x) => '<button type="button" class="f' + (ev === x[0] ? ' on' : '') + '" data-key="ev-' + x[0] + '" data-act="' + A(() => { S.epView = x[0]; store.set('epView', x[0]); redraw('ev-' + x[0]); }) + '">' + esc(x[1]) + '</button>').join('') + '</div></div></div>' +
      episodesHTML() +
      '</div></div>');
    initFocus();
  };
  const redraw = (focusKey) => {
    const sc = $('.dscroll', viewEl);
    const top = sc ? sc.scrollTop : 0;
    current.focusKey = focusKey || (focused && focused.dataset.key);
    draw();
    const sc2 = $('.dscroll', viewEl);
    if (sc2) sc2.scrollTop = top;
  };
  async function rebuild() {
    const btn = $('[data-key="worebuild"]', viewEl);
    const say = (msg) => { if (btn && document.contains(btn)) btn.textContent = msg; };
    try {
      const r = await woBuild(pid, say);
      toast(t('woBuilt', { n: r.n }) + (r.missing.length ? ' ' + t('woMissing', { s: r.missing.join(', ') }) : '') + (r.playlist ? '' : ' ' + t('woNoPlaylist')), 7000);
      if (seq === viewSeq) { current.focusKey = 'worebuild'; run(); }
    } catch (e) { toast(t('woFailed') + ' (' + (e.message || e) + ')', 7000); say(t('woRebuild')); }
  }
  draw();
}

/* ---------- long press on the series: play, watched/unwatched, rebuild, artwork ---------- */
function woArt(pid) { return store.get('woArt.' + (S.server ? S.server.id : '') + '.' + pid, {}) || {}; }
function woArtSet(pid, kind, ref) { const a = woArt(pid); if (ref) a[kind] = ref; else delete a[kind]; store.set('woArt.' + S.server.id + '.' + pid, a); }
function woPresetArt(pid) { return ((window.PRESET || {}).woArt || {})[pid] || {}; }
function woPosterRef(pid, fallback) { const a = woArt(pid).poster; if (a === 'data-made') return store.get('woPoster.' + pid, '') || fallback || ''; return a || woPresetArt(pid).poster || store.get('woPoster.' + pid, '') || fallback || ''; }

/* the next episode in the order (fresh watched state) */
async function woNextUp(pid) {
  const o = woStore(pid);
  if (!o || !o.keys) return null;
  const live = new Map();
  for (const id of Object.keys(o.shows)) {
    try { ((await api('/library/metadata/' + o.shows[id].key + '/allLeaves')).Metadata || []).forEach((e) => live.set(String(e.ratingKey), e)); } catch (e) { /* ignore */ }
  }
  const eps = o.keys.map((k) => live.get(k)).filter(Boolean);
  return eps.find((e) => e.viewOffset) || eps.find((e) => !e.viewCount) || null;
}
async function woMarkAll(pid, seen) {
  const o = woStore(pid);
  if (!o) return;
  toast(t('woMarking'), 3000);
  for (const id of Object.keys(o.shows)) {
    try { await fetch(pmsURL(seen ? '/:/scrobble' : '/:/unscrobble', { key: o.shows[id].key, identifier: 'com.plexapp.plugins.library' })); } catch (e) { /* ignore */ }
  }
  toast(seen ? t('markedWatched') : t('ctxResetDone'), 3000);
  rerun();
}
function woMenu(it) {
  const pid = it.virtual;
  const o = woStore(pid);
  const rows = [];
  if (o) rows.push(optionRow('wm-next', it.viewedLeafCount ? t('playNextEp') : t('startWatching'), [], false, A(async () => {
    closeModal(true);
    const n = await woNextUp(pid);
    if (n) go(viewPlayer, [n.ratingKey, n.viewOffset ? {} : { fromStart: true }]); else toast(t('woAllSeen'), 4000);
  }), t('woInOrder')));
  rows.push(optionRow('wm-open', t('ctxShow'), [], false, A(() => { closeModal(true); go(viewDetails, ['wo-' + pid]); })));
  if (o) {
    rows.push(optionRow('wm-seen', t('markWatched'), [], false, A(() => { closeModal(true); woMarkAll(pid, true); }), t('woAllShows')));
    rows.push(optionRow('wm-unseen', t('markUnwatched'), [], false, A(() => woConfirmUnseen(pid)), t('woAllShows')));
    rows.push(optionRow('wm-build', t('woRebuild'), [], false, A(async () => {
      closeModal(true);
      toast(t('woFinding'), 3000);
      try { const r = await woBuild(pid, () => {}); toast(t('woBuilt', { n: r.n }), 5000); rerun(); } catch (e) { toast(t('woFailed') + ' (' + (e.message || e) + ')', 6000); }
    }), t('woRebuildNote', { d: new Date(o.at).toLocaleDateString(lang().locale, { day: 'numeric', month: 'short' }) })));
    rows.push(optionRow('wm-art', t('artChange'), [], false, A(() => { closeModal(true); woArtEditor(pid); }), t('woArtNote')));
  }
  const prevArt = modalArt;
  modalArt = imgURL(woPosterRef(pid, it.thumb), 440, 660) || prevArt;
  gradSheet(openModal(sheetHeader(it.title, it.leafCount ? t('woSeen', { a: it.viewedLeafCount || 0, b: it.leafCount }) : '') + '<div class="optlist">' + rows.join('') + '</div>', o ? 'wm-next' : 'wm-open'));
  modalArt = prevArt;
}
/* every episode of every show unwatched: ask first, "No" is the default */
function woConfirmUnseen(pid) {
  gradSheet(openModal(sheetHeader(t('woUnseenQ', { s: WO_PRESETS[pid].name }), t('woAllShows')) + '<div class="optlist">' +
    optionRow('wu-no', t('exitNo'), [], false, A(() => closeModal())) +
    optionRow('wu-yes', t('woUnseenYes'), [], false, A(() => { closeModal(true); woMarkAll(pid, false); })) +
    '</div>', 'wu-no'));
}

/* artwork: there is no Arrowverse on fanart.tv or TMDB, so the pictures come from the shows themselves (your
   server's and TMDB's). The choice is kept on this TV, since the series exists only in this app. */
async function woArtEditor(pid) {
  const p = WO_PRESETS[pid];
  const o = woStore(pid);
  if (!o) return;
  let kind = 'poster';
  const draw = async (focusKey) => {
    const k = ART_KINDS[kind];
    const tabs = '<div class="seg arttabs">' + ['poster', 'art'].map((x) => '<button type="button" class="f' + (x === kind ? ' on' : '') + '" data-key="at-' + x + '" data-act="' + A(() => { kind = x; draw('at-' + x); }) + '">' + esc(t(ART_KINDS[x].label)) + '</button>').join('') + '</div>';
    const el = openModal(sheetHeader(t('artChange'), p.name) + tabs + '<p class="sheettext" id="artnote">' + esc(t('loading')) + '</p>', focusKey || 'at-' + kind, true);
    el.classList.add('artsheet');
    const cur = woArt(pid)[kind] || woPresetArt(pid)[kind] || '';
    const groups = [];
    const own = woPresetArt(pid)[kind];
    if (own) groups.push({ label: t('woArtOwn'), list: [{ src: 'own', ref: own, thumb: own }] });
    if (kind === 'poster') groups.push({ label: t('woArtMade'), list: [{ src: 'made', ref: '', thumb: store.get('woPoster.' + pid, '') }].filter((x) => x.thumb) });
    for (const s of p.shows) {
      const sh = o.shows[s.id];
      if (!sh) continue;
      let list = [];
      try { list = (await artList(sh.key, kind)).map((x) => ({ src: 'plex', ref: x.thumb, thumb: x.thumb })); } catch (e) { /* ignore */ }
      try {
        const tm = await artTmdb({ type: 'show', Guid: [{ id: 'tmdb://' + s.tmdb }] }, kind);
        list = list.concat(tm.slice(0, 16).map((x) => ({ src: 'tmdb', ref: x.full, thumb: x.thumb, lang: x.lang })));
      } catch (e) { /* ignore */ }
      if (list.length) groups.push({ label: sh.title, list: list });
      if (!document.contains(el)) return;
    }
    if (!document.contains(el) || ART_KINDS[kind] !== k) return;
    let n = 0;
    const cell = (x) => {
      const key = 'ao-' + (n++);
      const sel = x.src === 'made' ? (!cur || cur === 'data-made') : x.ref === cur;
      const ref = x.src === 'made' ? 'data-made' : x.ref;
      return '<button type="button" class="artopt ' + k.ratio + ' f' + (sel ? ' sel' : '') + '" data-key="' + key + '" data-act="' + A(() => {
        woArtSet(pid, kind, ref);
        toast(t('artSaved'), 2500);
        draw(key);
      }) + '"><img loading="lazy" src="' + esc(/^(https?:|data:)/.test(x.thumb) ? x.thumb : (kind === 'art' ? imgURL(x.thumb, 480, 270) : imgURL(x.thumb, 240, 360))) + '" alt="">' +
        (sel ? '<i class="artsel">' + ICON.check + '</i>' : '') + (x.src === 'tmdb' && x.lang ? '<span class="artlang">' + esc(x.lang.toUpperCase()) + '</span>' : '') + '</button>';
    };
    const body = groups.filter((g) => g.list.length).map((g) => '<span class="label">' + esc(g.label) + '</span><div class="artgrid ' + k.ratio + '">' + g.list.map(cell).join('') + '</div>').join('');
    const note = $('#artnote', el);
    if (note) note.outerHTML = body ? '<p class="sheettext small">' + esc(t('woArtNote')) + '</p>' + body : '<p class="sheettext">' + esc(t('artNone')) + '</p>';
    initFocus(focusKey || 'ao-0', el);
    el._onclose = () => setTimeout(() => { if (!modalOpen()) rerun(); }, 50);
  };
  draw();
}
