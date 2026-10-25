/* PLEX:arctic — a backup of what lives in Plex's database and is hard to get back:
   what each profile has watched (and how far into what), ratings, playlists, and for the server's managers
   the collections and hand-made edits (titles, sort titles, summaries).

   Every title is noted by several ids (Plex, TMDB, IMDb, TVDB, name + year; an episode by its show + season
   + episode number), so a restore finds it again even on a newly installed Plex with a new database.
   The backup is kept on the TV and, with the GitHub token, in the same private gist as the artwork choices
   (one file per profile). It is refreshed once a day, quietly. A backup that suddenly holds far less than the
   last one (for example right after the server lost its database) never replaces the good one. */
'use strict';

const LB_DAY = 86400000;
let lbState = { busy: false, msg: '' };

function lbFile() { return 'plexarctic-library-' + String(S.user ? S.user.id : 'owner').replace(/[^a-z0-9_-]/gi, '') + '.json'; }
function lbKeyLocal() { return userKey('libBackup'); }
function lbWho(m) { return { g: m.guid, ids: asIdsOf(m), t: m.title, yr: m.year || null }; }
function lbSize(sn) { return sn ? (sn.movies || []).length + (sn.shows || []).reduce((n, s) => n + (s.w || []).length + (s.p || []).length, 0) + (sn.playlists || []).length : 0; }

/* ---- making a snapshot ---- */
async function lbSnapshot(onStep) {
  const step = (s) => { if (onStep) onStep(s); };
  let secs = [];
  try { secs = ((await api('/library/sections')).Directory || []).filter((x) => x.type === 'movie' || x.type === 'show'); } catch (e) { throw new Error(t('lbNoServer')); }
  const admin = await isAdmin().catch(() => false);
  const sn = { v: 1, app: 'PLEX:arctic', what: 'watch history, ratings, playlists' + (admin ? ', collections, edits' : ''), at: new Date().toISOString(),
    profile: (S.user && S.user.title) || (S.account && S.account.title) || '', server: S.server && S.server.name, movies: [], shows: [], playlists: [], collections: [], edits: [] };
  const lockedEdit = (m) => (m.Field || []).filter((f) => f.locked && /^(title|titleSort|summary|originalTitle)$/.test(f.name)).map((f) => f.name);
  for (const sec of secs) {
    step(sec.title);
    if (sec.type === 'movie') {
      const all = (await api('/library/sections/' + sec.key + '/all', { type: 1, includeGuids: 1 })).Metadata || [];
      all.forEach((m) => {
        if (m.viewCount || m.viewOffset || m.userRating) sn.movies.push(Object.assign(lbWho(m), { vc: m.viewCount || 0, lv: m.lastViewedAt || null, vo: m.viewOffset || 0, r: m.userRating || null }));
        if (admin) { const ed = lockedEdit(m); if (ed.length) sn.edits.push(Object.assign(lbWho(m), { y: 'movie', f: ed.reduce((o, k) => { o[k] = m[k] || ''; return o; }, {}) })); }
      });
    } else {
      const shows = (await api('/library/sections/' + sec.key + '/all', { type: 2, includeGuids: 1 })).Metadata || [];
      const byKey = new Map(shows.map((s) => [String(s.ratingKey), s]));
      const rec = new Map();
      const get = (k) => { if (!rec.has(k)) { const s = byKey.get(k); if (!s) return null; rec.set(k, Object.assign(lbWho(s), { r: s.userRating || null, w: [], p: [] })); } return rec.get(k); };
      shows.forEach((s) => {
        if (s.userRating) get(String(s.ratingKey));
        if (admin) { const ed = lockedEdit(s); if (ed.length) sn.edits.push(Object.assign(lbWho(s), { y: 'show', f: ed.reduce((o, k) => { o[k] = s[k] || ''; return o; }, {}) })); }
      });
      /* every watched episode, and the ones stopped halfway */
      const seen = (await api('/library/sections/' + sec.key + '/all', { type: 4, 'viewCount>': 0 })).Metadata || [];
      seen.forEach((e) => { const r = get(String(e.grandparentRatingKey)); if (r) r.w.push([e.parentIndex, e.index, e.viewCount || 1, e.lastViewedAt || null]); });
      let half = [];
      try { half = (await api('/library/sections/' + sec.key + '/all', { type: 4, 'viewOffset>': 0 })).Metadata || []; } catch (e) { half = []; }
      half.filter((e) => !e.viewCount).forEach((e) => { const r = get(String(e.grandparentRatingKey)); if (r) r.p.push([e.parentIndex, e.index, e.viewOffset]); });
      rec.forEach((r) => sn.shows.push(r));
    }
    /* collections: the server's own, kept by its managers */
    if (admin) {
      let cols = [];
      try { cols = (await api('/library/sections/' + sec.key + '/collections', { includeGuids: 1 })).Metadata || []; } catch (e) { cols = []; }
      for (const c of cols.filter((x) => !x.smart || x.smart === '0')) {
        try {
          const kids = (await api('/library/collections/' + c.ratingKey + '/children', { includeGuids: 1 })).Metadata || [];
          sn.collections.push({ t: c.title, sec: sec.title, y: sec.type, items: kids.map(lbWho) });
        } catch (e) { /* next */ }
      }
    }
  }
  /* edits noted by the last full artwork scan, when the lists above don't show them */
  if (admin && !sn.edits.length) { try { sn.edits = (await asDB.get(userKey('libEdits'))) || []; } catch (e) { /* none */ } }
  /* playlists (each profile's own) */
  step(t('lbPlaylists'));
  let pls = [];
  try { pls = (await api('/playlists', { playlistType: 'video' })).Metadata || []; } catch (e) { pls = []; }
  for (const pl of pls.filter((p) => !p.smart)) {
    try {
      const items = (await api('/playlists/' + pl.ratingKey + '/items', { includeGuids: 1 })).Metadata || [];
      const out = [];
      for (const it of items) {
        if (it.type === 'episode') out.push({ y: 'episode', show: { t: it.grandparentTitle }, gk: it.grandparentRatingKey, s: it.parentIndex, e: it.index });
        else out.push(Object.assign(lbWho(it), { y: it.type }));
      }
      /* the show's ids for the episodes */
      const showIds = new Map();
      for (const x of out.filter((o) => o.y === 'episode')) {
        if (!showIds.has(x.gk)) { try { const sh = ((await api('/library/metadata/' + x.gk, { includeGuids: 1 })).Metadata || [])[0]; showIds.set(x.gk, sh ? lbWho(sh) : null); } catch (e) { showIds.set(x.gk, null); } }
        if (showIds.get(x.gk)) x.show = showIds.get(x.gk);
        delete x.gk;
      }
      sn.playlists.push({ t: pl.title, items: out });
    } catch (e) { /* next */ }
  }
  return sn;
}

/* ---- keeping it: on the TV and in the gist ---- */
async function lbLocal() { try { return (await asDB.get(lbKeyLocal())) || null; } catch (e) { return store.get(lbKeyLocal(), null); } }
async function lbSaveLocal(sn) { try { await asDB.set(lbKeyLocal(), sn); } catch (e) { store.set(lbKeyLocal(), sn); } }
async function lbGistRead() {
  if (!ghToken()) return null;
  const g = await ghGist();
  const f = g && g.files && g.files[lbFile()];
  if (!f) return null;
  let txt = f.content;
  if (f.truncated || !txt) txt = await (await fetch(f.raw_url)).text();
  return JSON.parse(txt);
}
async function lbGistWrite(sn, name) {
  if (!ghToken()) return false;
  const files = {}; files[name || lbFile()] = { content: JSON.stringify(sn, null, 1) };
  let id = store.get('ghGistId', '');
  if (!id) { const g = await ghGist(); if (g) id = g.id; }
  if (id) { await gh('/gists/' + id, 'PATCH', { files: files }); return true; }
  const g = await gh('/gists', 'POST', { description: GH_DESC, public: false, files: files });
  store.set('ghGistId', g.id);
  return true;
}

/* make a fresh backup; a much smaller one than the last good one is kept aside, not over it */
async function lbBackup(onStep, force) {
  if (lbState.busy) return null;
  lbState.busy = true;
  try {
    const sn = await lbSnapshot(onStep);
    const prev = (await lbGistRead().catch(() => null)) || (await lbLocal());
    const shrunk = prev && lbSize(prev) >= 10 && lbSize(sn) < lbSize(prev) * 0.7;
    if (shrunk && !force) {
      await lbGistWrite(sn, lbFile().replace('.json', '-check-this.json')).catch(() => {});
      store.set(userKey('libBackupAt'), Date.now());
      lbState.msg = t('lbShrunk', { a: lbSize(sn), b: lbSize(prev) });
      return { kept: true, sn: sn, prev: prev };
    }
    await lbSaveLocal(sn);
    let cloud = false;
    try { cloud = await lbGistWrite(sn); } catch (e) { lbState.msg = 'GitHub: ' + (e.message || e); }
    store.set(userKey('libBackupAt'), Date.now());
    store.set(userKey('libBackupInfo'), { at: Date.now(), size: lbSize(sn), cloud: cloud, movies: sn.movies.length, shows: sn.shows.length, playlists: sn.playlists.length, collections: sn.collections.length, edits: sn.edits.length });
    if (cloud) lbState.msg = '';
    return { kept: false, sn: sn };
  } finally { lbState.busy = false; }
}

/* ---- putting it back ---- */
const LB_ID = 'com.plexapp.plugins.library';
async function lbRestore(sn, onStep) {
  const step = (a, b, s) => { if (onStep) onStep(a, b, s); };
  const idx = await asIndex(true);
  const admin = await isAdmin().catch(() => false);
  const n = { watched: 0, progress: 0, rated: 0, playlists: 0, collections: 0, edits: 0, missing: 0 };
  const hit = (u) => fetch(pmsURL(u.path, u.q), { method: u.method || 'GET' }).catch(() => null);
  /* films */
  const mv = sn.movies || [];
  for (let i = 0; i < mv.length; i++) {
    const r = mv[i];
    if (i % 20 === 0) step(i + 1, mv.length, r.t);
    const m = asLookup(idx, r, 'movie');
    if (!m) { n.missing++; continue; }
    if (r.vc && !m.viewCount) { await hit({ path: '/:/scrobble', q: { key: m.ratingKey, identifier: LB_ID } }); n.watched++; }
    else if (r.vo && !m.viewCount && !m.viewOffset) { await hit({ path: '/:/progress', q: { key: m.ratingKey, identifier: LB_ID, time: r.vo, state: 'stopped' } }); n.progress++; }
    if (r.r && m.userRating !== r.r) { await hit({ path: '/:/rate', q: { key: m.ratingKey, identifier: LB_ID, rating: r.r }, method: 'PUT' }); n.rated++; }
  }
  /* shows, episode by episode */
  const shs = sn.shows || [];
  for (let i = 0; i < shs.length; i++) {
    const r = shs[i];
    step(i + 1, shs.length, r.t);
    const show = asLookup(idx, r, 'show');
    if (!show) { n.missing++; continue; }
    if (r.r && show.userRating !== r.r) { await hit({ path: '/:/rate', q: { key: show.ratingKey, identifier: LB_ID, rating: r.r }, method: 'PUT' }); n.rated++; }
    if (!(r.w || []).length && !(r.p || []).length) continue;
    let eps = [];
    try { eps = (await api('/library/metadata/' + show.ratingKey + '/allLeaves')).Metadata || []; } catch (e) { eps = []; }
    const at = new Map(eps.map((e) => [e.parentIndex + 'x' + e.index, e]));
    for (const [s, e] of r.w || []) { const ep = at.get(s + 'x' + e); if (ep && !ep.viewCount) { await hit({ path: '/:/scrobble', q: { key: ep.ratingKey, identifier: LB_ID } }); n.watched++; } }
    for (const [s, e, vo] of r.p || []) { const ep = at.get(s + 'x' + e); if (ep && !ep.viewCount && !ep.viewOffset) { await hit({ path: '/:/progress', q: { key: ep.ratingKey, identifier: LB_ID, time: vo, state: 'stopped' } }); n.progress++; } }
  }
  /* playlists: added to one with the same name, or made anew */
  let have = [];
  try { have = (await api('/playlists', { playlistType: 'video' })).Metadata || []; } catch (e) { have = []; }
  const epKey = async (x) => {
    const show = asLookup(idx, x.show, 'show');
    if (!show) return null;
    try { const eps = (await api('/library/metadata/' + show.ratingKey + '/allLeaves')).Metadata || []; const ep = eps.find((e) => e.parentIndex === x.s && e.index === x.e); return ep ? ep.ratingKey : null; } catch (e) { return null; }
  };
  for (const pl of sn.playlists || []) {
    step(0, 0, pl.t);
    const keys = [];
    for (const x of pl.items) { const k = x.y === 'episode' ? await epKey(x) : (asLookup(idx, x, x.y === 'show' ? 'show' : 'movie') || {}).ratingKey; if (k) keys.push(String(k)); }
    if (!keys.length) continue;
    const uri = (ks) => 'server://' + S.server.id + '/' + LB_ID + '/library/metadata/' + ks.join(',');
    const old = have.find((p) => p.title === pl.t && !p.smart);
    try {
      if (old) {
        const inIt = new Set(((await api('/playlists/' + old.ratingKey + '/items')).Metadata || []).map((x) => String(x.ratingKey)));
        const add = keys.filter((k) => !inIt.has(k));
        if (add.length) await fetch(pmsURL('/playlists/' + old.ratingKey + '/items', { uri: uri(add) }), { method: 'PUT' });
      } else await fetch(pmsURL('/playlists', { type: 'video', title: pl.t, smart: 0, uri: uri(keys) }), { method: 'POST' });
      n.playlists++;
    } catch (e) { /* next */ }
  }
  /* collections and edits: only for the server's managers */
  if (admin) {
    for (const c of sn.collections || []) {
      step(0, 0, c.t);
      const type = c.y === 'show' ? 2 : 1;
      for (const x of c.items) {
        const m = asLookup(idx, x, c.y === 'show' ? 'show' : 'movie');
        if (!m) continue;
        try {
          const full = ((await api('/library/metadata/' + m.ratingKey)).Metadata || [])[0] || m;
          const tags = (full.Collection || []).map((k) => k.tag);
          if (tags.includes(c.t)) continue;
          const q = { type: type, id: m.ratingKey, 'collection.locked': 1 };
          tags.concat([c.t]).forEach((tg, i) => { q['collection[' + i + '].tag.tag'] = tg; });
          await fetch(artURL('/library/sections/' + m._sec + '/all', q), { method: 'PUT' });
        } catch (e) { /* next */ }
      }
      n.collections++;
    }
    for (const ed of sn.edits || []) {
      const m = asLookup(idx, ed, ed.y === 'show' ? 'show' : 'movie');
      if (!m) continue;
      const q = { type: ed.y === 'show' ? 2 : 1, id: m.ratingKey };
      let any = false;
      Object.entries(ed.f || {}).forEach(([k, v]) => { if (v && m[k] !== v) { q[k + '.value'] = v; q[k + '.locked'] = 1; any = true; } });
      if (any) { try { await fetch(artURL('/library/sections/' + m._sec + '/all', q), { method: 'PUT' }); n.edits++; } catch (e) { /* next */ } }
    }
  }
  return n;
}

/* ---- the Settings row (every profile: its own history; managers also collections and edits) ---- */
function lbSettingsHTML() {
  const info = store.get(userKey('libBackupInfo'), null);
  const when = info ? new Date(info.at).toLocaleString(lang().locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  const line = lbState.msg ? lbState.msg : info ? t('lbInfo', { t: when, m: info.movies, s: info.shows, p: info.playlists }) + (info.cloud ? ' · GitHub' : '') : t('lbNever');
  const prog = (a, b, s) => { const el = $('#lbprog'); if (el) el.textContent = (b ? a + ' / ' + b + ' · ' : '') + (s || ''); };
  return '<span class="sval">' + esc(line) + '</span>' +
    '<button type="button" class="btn f" data-key="lbnow" data-act="' + A(async () => {
      toast(t('lbWorking'), 3000);
      try {
        const r = await lbBackup((s) => prog(0, 0, s), false);
        toast(r && r.kept ? lbState.msg : t('lbDone'), 8000);
      } catch (e) { toast(String(e.message || e), 8000); }
      prog(0, 0, ''); rerun();
    }) + '">' + esc(t('lbNow')) + '</button>' +
    '<button type="button" class="btn ghostbtn f" data-key="lbrestore" data-act="' + A(() => lbAskRestore()) + '">' + esc(t('lbRestore')) + '</button>' +
    '<span class="sval" id="lbprog"></span>';
}
async function lbAskRestore() {
  let sn = null;
  try { sn = await lbGistRead(); } catch (e) { sn = null; }
  if (!sn) sn = await lbLocal();
  if (!sn) { toast(t('lbNone'), 5000); return; }
  const admin = await isAdmin().catch(() => false);
  const when = new Date(sn.at).toLocaleString(lang().locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  openModal(sheetHeader(t('lbRestore'), sn.profile || '') +
    '<p class="sheettext">' + esc(t('lbAsk', { t: when, m: (sn.movies || []).length, s: (sn.shows || []).length, p: (sn.playlists || []).length })) + (admin ? ' ' + esc(t('lbAskAdmin', { c: (sn.collections || []).length, e: (sn.edits || []).length })) : '') + '</p>' +
    '<p class="sheettext small">' + esc(t('lbAskNote')) + '</p>' +
    '<div class="optlist">' + optionRow('lbgo', t('lbRestoreGo'), [], false, A(async () => {
      closeModal(true);
      toast(t('lbRestoring'), 4000);
      const n = await lbRestore(sn, (a, b, s) => { const el = $('#lbprog'); if (el) el.textContent = (b ? a + ' / ' + b + ' · ' : '') + (s || ''); });
      toast(t('lbRestored', { w: n.watched, p: n.progress, r: n.rated, l: n.playlists, c: n.collections, e: n.edits, x: n.missing }), 12000);
      const el = $('#lbprog'); if (el) el.textContent = '';
    })) + optionRow('lbno', t('lbCancel'), [], false, A(() => closeModal())) + '</div>', 'lbno');
}

/* once a day, a little after start, quietly */
setTimeout(() => {
  if (!S.token || !S.server) return;
  const last = store.get(userKey('libBackupAt'), 0);
  if (Date.now() - last < LB_DAY) return;
  lbBackup(null, false).catch(() => {});
}, 45000);
