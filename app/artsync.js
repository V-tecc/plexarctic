/* PLEX:arctic — your artwork choices, kept safe.
   Every cover, season cover, background, logo and clearart picked in "Change artwork" is noted as a small
   record: which title it is, and where the picture came from (a TMDB / fanart.tv link, or Plex's own id).
   The pictures themselves stay where they are.

   Built so it keeps working even if Plex changes things:
   - a title is noted by several ids at once: Plex's own, TMDB, IMDb, TVDB, and as a last resort its name + year
     (a season by its show + number), so finding it again doesn't hang on any one of them;
   - the list lives on every TV that has made or scanned choices, and (in the browser version) in a backup
     file you keep yourself, in plain readable JSON (Plex has no place in the account for it);
   - once a week the app checks quietly that every saved choice can still be found, and says so if not.
   "Restore my artwork" in Settings puts everything back. Clearart, which Plex can't store, comes back by itself. */
'use strict';

let asState = { cloud: false, at: 0, msg: '' };

/* The list can hold thousands of choices, more than the TV's small settings storage takes, so it is kept in
   the browser database (IndexedDB) and read into memory at start. Older versions kept it in settings storage:
   it is moved over once, which also frees that space. */
function asKey() { return userKey('artChoices'); }
let asMem = null, asMemKey = null;
const asDB = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((ok, no) => {
    try {
      const r = indexedDB.open('plexarctic', 1);
      r.onupgradeneeded = () => { r.result.createObjectStore('kv'); };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => no(r.error);
    } catch (e) { no(e); }
  }));
  const tx = async (mode, fn) => { const db = await open(); return new Promise((ok, no) => { const t1 = db.transaction('kv', mode); const st = t1.objectStore('kv'); const req = fn(st); t1.oncomplete = () => ok(req && req.result); t1.onerror = () => no(t1.error); }); };
  return { get: (k) => tx('readonly', (st) => st.get(k)), set: (k, v) => tx('readwrite', (st) => st.put(v, k)) };
})();
async function asLoad() {
  const k = asKey();
  if (asMem && asMemKey === k) return asMem;
  let d = null;
  try { d = await asDB.get(k); } catch (e) { d = null; }
  const old = store.get(k, null);
  if (old && old.items) {
    d = asMerge(d || { items: {} }, old);
    try { await asDB.set(k, { v: 2, app: 'PLEX:arctic', items: d.items }); store.del(k); } catch (e) { /* keep the old copy then */ }
  }
  asMem = { v: 2, items: (d && d.items) || {} }; asMemKey = k;
  return asMem;
}
function asLocal() {
  if (asMem && asMemKey === asKey()) return asMem;
  const old = store.get(asKey(), null);
  return { v: 2, items: (old && old.items) || {} };
}
let asSaveTimer = null;
function asSaveLocal(d) {
  asMem = { v: 2, items: d.items }; asMemKey = asKey();
  clearTimeout(asSaveTimer);
  asSaveTimer = setTimeout(() => {
    asDB.set(asMemKey, { v: 2, app: 'PLEX:arctic', items: asMem.items }).catch(() => { store.set(asMemKey, { v: 2, items: asMem.items }); });
  }, 400);
}
function asCount() { return Object.keys(asLocal().items).length; }

/* every id Plex knows for a title: tmdb, imdb, tvdb */
function asIdsOf(m) {
  const out = {};
  (m && m.Guid || []).forEach((g) => { const x = /^(tmdb|imdb|tvdb):\/\/(.+)$/.exec(g.id || ''); if (x) out[x[1]] = x[2]; });
  return out;
}
function asNorm(s) { return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }

/* called by "Change artwork" when a picture was chosen */
async function artRecord(m, kind, o) {
  try {
    if (!m || !m.guid) return;
    if (!m.Guid) { try { m = Object.assign({}, m, ((await api('/library/metadata/' + m.ratingKey, { includeGuids: 1 })).Metadata || [])[0] || {}); } catch (e) { /* what we have */ } }
    const rec = { g: m.guid, ids: asIdsOf(m), k: kind, y: m.type, t: m.title || '', yr: m.year || null, at: Date.now() };
    if (m.type === 'season') {
      rec.sx = m.index;
      try {
        const sh = ((await api('/library/metadata/' + m.parentRatingKey, { includeGuids: 1 })).Metadata || [])[0];
        if (sh) rec.sh = { g: sh.guid, ids: asIdsOf(sh), t: sh.title, yr: sh.year || null };
      } catch (e) { rec.sh = { t: m.parentTitle || '' }; }
    }
    if (kind === 'clear') { rec.s = 'url'; rec.u = o.full; }
    else if (o.src === 'plex') { rec.s = /^https?:/.test(o.id) ? 'url' : 'plex'; rec.u = o.id; }
    else { rec.s = 'url'; rec.u = o.full; }
    if (!rec.u) return;
    const d = asLocal();
    d.items[m.guid + '|' + kind] = rec;
    asSaveLocal(d);
    asPushSoon();
  } catch (e) { /* never in the way of the choice itself */ }
}

function asMerge(a, b) {
  const out = { v: 2, items: Object.assign({}, a.items || {}) };
  Object.entries((b && b.items) || {}).forEach(([k, r]) => {
    const mine = out.items[k];
    if (!mine || (r.at || 0) > (mine.at || 0)) out.items[k] = Object.assign({}, mine || {}, r, { ids: Object.assign({}, (mine && mine.ids) || {}, r.ids || {}) });
  });
  return out;
}
let asPushTimer = null;
function asPushSoon() { /* nothing to send: the list is saved on this TV as it changes */ }

/* both ways: what the account has and what this TV has, newest choice wins */
async function asSync() {
  if (!S.token) return;
  await asLoad();
  /* Plex has no place in the account for a list like this (plex.tv answers 404), so it stays on each TV
     and in the backup file; covers, backgrounds and logos themselves are on the server for every TV anyway */
  asState = { cloud: false, at: Date.now(), msg: '' };
  asApplyClearart(asLocal()).catch(() => {});
  return asState;
}

/* ---- finding a title again: every film and show on the server, by each of its ids ---- */
let asIdx = null;
async function asIndex(force) {
  if (asIdx && !force && Date.now() - asIdx.at < 10 * 60000 && asIdx.server === (S.server && S.server.id)) return asIdx;
  const map = new Map();
  let secs = [];
  try { secs = ((await api('/library/sections')).Directory || []).filter((x) => x.type === 'movie' || x.type === 'show'); } catch (e) { secs = []; }
  for (const sec of secs) {
    let items = [];
    try { items = (await api('/library/sections/' + sec.key + '/all', { type: sec.type === 'movie' ? 1 : 2, includeGuids: 1 })).Metadata || []; } catch (e) { items = []; }
    items.forEach((m) => {
      const put = (k) => { if (k && !map.has(k)) map.set(k, m); };
      put('plex:' + m.guid);
      Object.entries(asIdsOf(m)).forEach(([k, v]) => put(k + ':' + v));
      put('name:' + m.type + '|' + asNorm(m.title) + '|' + (m.year || ''));
      if (m.originalTitle) put('name:' + m.type + '|' + asNorm(m.originalTitle) + '|' + (m.year || ''));
    });
    /* collections, by name */
    try {
      ((await api('/library/sections/' + sec.key + '/collections', { includeGuids: 1 })).Metadata || []).forEach((c) => {
        if (!map.has('plex:' + c.guid)) map.set('plex:' + c.guid, c);
        const k = 'name:collection|' + asNorm(c.title) + '|';
        if (!map.has(k)) map.set(k, c);
      });
    } catch (e) { /* no collections */ }
  }
  asIdx = { at: Date.now(), server: S.server && S.server.id, map: map };
  return asIdx;
}
function asLookup(idx, who, type) {
  if (!who) return null;
  const tries = [];
  if (who.g) tries.push('plex:' + who.g);
  Object.entries(who.ids || {}).forEach(([k, v]) => tries.push(k + ':' + v));
  if (who.t) { tries.push('name:' + type + '|' + asNorm(who.t) + '|' + (who.yr || '')); }
  for (const k of tries) { const m = idx.map.get(k); if (m) return m; }
  /* name without a year, only if there's exactly one */
  if (who.t) {
    const hits = [];
    idx.map.forEach((m, k) => { if (k.startsWith('name:' + type + '|' + asNorm(who.t) + '|') && !hits.includes(m)) hits.push(m); });
    if (hits.length === 1) return hits[0];
  }
  return null;
}
async function asFind(rec, idx) {
  idx = idx || await asIndex();
  if (rec.y === 'season') {
    const show = asLookup(idx, rec.sh || { t: (rec.t || '').split(' · ')[0] }, 'show');
    if (!show || rec.sx == null) return null;
    try { return ((await api('/library/metadata/' + show.ratingKey + '/children')).Metadata || []).find((s) => s.index === rec.sx) || null; } catch (e) { return null; }
  }
  return asLookup(idx, rec, rec.y === 'show' ? 'show' : rec.y === 'collection' ? 'collection' : 'movie');
}

/* clearart lives on each TV only, so it is put back by itself */
async function asApplyClearart(d) {
  if (!S.server) return;
  const recs = Object.values(d.items).filter((r) => r.k === 'clear');
  if (!recs.length) return;
  const picks = store.get('clearartPick', {}) || {};
  let changed = false;
  const idx = await asIndex();
  for (const rec of recs) {
    const m = await asFind(rec, idx);
    if (!m) continue;
    const key = S.server.id + ':' + m.ratingKey;
    if (picks[key] !== rec.u) { picks[key] = rec.u; changed = true; }
  }
  if (changed) store.set('clearartPick', picks);
}

/* fill in the extra ids for records saved before they were kept (while Plex's own id still works) */
async function asEnrich() {
  await asLoad();
  const d = asLocal();
  const thin = Object.entries(d.items).filter(([, r]) => !r.enr && (!r.ids || !Object.keys(r.ids).length || r.yr == null || (r.y === 'season' && !r.sh)));
  if (!thin.length) return 0;
  const idx = await asIndex();
  let n = 0;
  for (const [k, r] of thin) {
    const m = await asFind(r, idx);
    if (!m) continue;
    try {
      /* films and shows: the server's list already has their ids; seasons are asked for */
      const full = m.Guid || m.type !== 'season' ? m : (((await api('/library/metadata/' + m.ratingKey, { includeGuids: 1 })).Metadata || [])[0] || m);
      r.ids = asIdsOf(full); r.yr = full.year || r.yr || null; r.y = full.type || r.y;
      if (full.type === 'season') {
        r.sx = full.index;
        const sh = ((await api('/library/metadata/' + full.parentRatingKey, { includeGuids: 1 })).Metadata || [])[0];
        if (sh) r.sh = { g: sh.guid, ids: asIdsOf(sh), t: sh.title, yr: sh.year || null };
      }
      r.enr = 1; d.items[k] = r; n++;
    } catch (e) { /* next */ }
  }
  if (n) { asSaveLocal(d); asPushSoon(); }
  return n;
}

/* can every saved choice still be found? (nothing is changed) */
async function asCheck() {
  await asLoad();
  const recs = Object.values(asLocal().items);
  const idx = await asIndex(true);
  let ok = 0;
  const lost = [];
  for (const r of recs) { if (await asFind(r, idx)) ok++; else lost.push(r.t || r.g); }
  const res = { at: Date.now(), ok: ok, total: recs.length, lost: lost.slice(0, 20) };
  store.set(userKey('artCheck'), res);
  return res;
}

/* "Restore my artwork": put every saved choice back on the server (cover, season cover, background, logo) */
async function asRestore(onStep) {
  await asLoad();
  const recs = Object.values(asLocal().items);
  const idx = await asIndex(true);
  let done = 0, same = 0, missing = 0, failed = 0;
  for (let i = 0; i < recs.length; i++) {
    const rec = recs[i];
    if (onStep) onStep(i + 1, recs.length, rec.t);
    try {
      const m = await asFind(rec, idx);
      if (!m) { missing++; continue; }
      if (rec.k === 'clear') { const p = store.get('clearartPick', {}) || {}; p[S.server.id + ':' + m.ratingKey] = rec.u; store.set('clearartPick', p); done++; continue; }
      const now = await artList(m.ratingKey, rec.k).catch(() => []);
      const sel = now.find((x) => x.selected);
      if (sel && (sel.id === rec.u || sel.full === rec.u)) { same++; continue; }
      /* a picture the server already has: choose it; a link: add it and choose it */
      const there = now.find((x) => x.id === rec.u || x.full === rec.u);
      const o = there || (rec.s === 'plex' ? { src: 'plex', id: rec.u } : { src: 'url', full: rec.u });
      await artSelect(Object.assign({}, m, { guid: m.guid }), rec.k, o, now);
      done++;
    } catch (e) { failed++; }
  }
  return { done: done, same: same, missing: missing, failed: failed, total: recs.length };
}

/* Note the choices already made on the server (locked covers, backgrounds and logos), so earlier work is
   saved too. Plex marks a picked picture as locked; only those are noted. */
async function asBackupExisting(onStep) {
  await asLoad();
  let secs = [];
  try { secs = ((await api('/library/sections')).Directory || []).filter((x) => x.type === 'movie' || x.type === 'show'); } catch (e) { secs = []; }
  const lockOf = { thumb: 'poster', art: 'art', clearLogo: 'logo' };
  let found = 0;
  for (const sec of secs) {
    let items = [];
    try { items = (await api('/library/sections/' + sec.key + '/all', { type: sec.type === 'movie' ? 1 : 2, includeGuids: 1 })).Metadata || []; } catch (e) { items = []; }
    let locked = items.filter((m) => (m.Field || []).some((f) => f.locked && lockOf[f.name]));
    /* some servers leave the locks out of the list: then ask title by title (a few at a time) */
    if (!locked.length && items.length && !items.some((m) => m.Field)) {
      locked = [];
      let next = 0, seen = 0;
      const worker = async () => {
        while (next < items.length) {
          const m0 = items[next++];
          try {
            const m = ((await api('/library/metadata/' + m0.ratingKey, { includeGuids: 1 })).Metadata || [])[0];
            if (m && (m.Field || []).some((f) => f.locked && lockOf[f.name])) locked.push(m);
          } catch (e) { /* next */ }
          seen++;
          if (onStep && seen % 10 === 0) onStep(seen, items.length, sec.title);
        }
      };
      await Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]);
    }
    for (let i = 0; i < locked.length; i++) {
      const m = locked[i];
      if (onStep) onStep(i + 1, locked.length, m.title);
      for (const f of (m.Field || []).filter((x) => x.locked && lockOf[x.name])) {
        const kind = lockOf[f.name];
        if (asLocal().items[m.guid + '|' + kind]) continue;
        try {
          const sel = (await artList(m.ratingKey, kind)).find((x) => x.selected);
          if (sel) { await artRecord(m, kind, sel); found++; }
        } catch (e) { /* next */ }
      }
    }
  }
  await asEnrich().catch(() => 0);
  return found;
}

/* ---- the backup file (browser / PC version) ---- */
function asDownload() {
  const d = asLocal();
  const json = JSON.stringify({ v: 2, app: 'PLEX:arctic', what: 'artwork choices', saved: new Date().toISOString(), user: (S.user && S.user.title) || (S.account && S.account.title) || '', items: d.items }, null, 1);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = 'plexarctic-artwork-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
function asUpload() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = async () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      if (!j || !j.items) throw new Error('not a PLEX:arctic backup');
      asSaveLocal(asMerge(asLocal(), j));
      asPushSoon();
      toast(t('asImported', { n: Object.keys(j.items).length }), 6000);
      rerun();
    } catch (e) { toast(t('asImportFailed') + ' (' + (e.message || e) + ')', 8000); }
  };
  inp.click();
}

/* the Settings row */
function asSettingsHTML() {
  const n = asCount();

  const chk = store.get(userKey('artCheck'), null);
  const prog = (i, all, title) => { const el = $('#asprog'); if (el) el.textContent = i + ' / ' + all + ' · ' + title; };
  return '<span class="sval">' + esc(t('asCountTV', { n: n })) + (chk && chk.total ? ' · ' + esc(t('asCheckLine', { a: chk.ok, b: chk.total })) : '') + '</span>' +
    '<button type="button" class="btn f" data-key="asrestore" data-act="' + A(async () => {
      if (!(await isAdmin())) { toast(t('adminOnly'), 4000); return; }
      if (!asCount()) { toast(t('asNone'), 4000); return; }
      toast(t('asRestoring'), 3000);
      const r = await asRestore(prog);
      toast(t('asRestored', { a: r.done, b: r.same, c: r.missing + r.failed }), 9000);
      const el = $('#asprog'); if (el) el.textContent = '';
    }) + '">' + esc(t('asRestore')) + '</button>' +
    '<button type="button" class="btn ghostbtn f" data-key="asbackup" data-act="' + A(async () => {
      if (!(await isAdmin())) { toast(t('adminOnly'), 4000); return; }
      toast(t('asBackingUp'), 3000);
      const added = await asBackupExisting(prog);
      await asSync();
      toast(t('asBackedUp', { n: added }), 7000);
      rerun();
    }) + '">' + esc(t('asBackup')) + '</button>' +
    '<button type="button" class="btn ghostbtn f" data-key="ascheck" data-act="' + A(async () => {
      toast(t('asChecking'), 2500);
      await asEnrich().catch(() => 0);
      const r = await asCheck();
      toast(r.ok === r.total ? t('asCheckAll', { n: r.total }) : t('asCheckSome', { a: r.ok, b: r.total, s: r.lost.slice(0, 3).join(', ') }), 9000);
      rerun();
    }) + '">' + esc(t('asCheck')) + '</button>' +
    (window.IS_TV ? '' :
      '<button type="button" class="btn ghostbtn f" data-key="asdown" data-act="' + A(asDownload) + '">' + esc(t('asDownload')) + '</button>' +
      '<button type="button" class="btn ghostbtn f" data-key="asup" data-act="' + A(asUpload) + '">' + esc(t('asUpload')) + '</button>') +
    '<span class="sval" id="asprog"></span>';
}

/* once a session, a little after start: sync; once a week, check that everything can still be found */
setTimeout(async () => {
  if (!S.token || !S.server) return;
  await asSync().catch(() => {});
  await asEnrich().catch(() => 0);
  const last = store.get(userKey('artCheck'), null);
  if (!asCount() || (last && Date.now() - last.at < 7 * 86400000)) return;
  try {
    await asEnrich();
    const r = await asCheck();
    if (r.total && r.ok < r.total) toast(t('asCheckWarn', { a: r.total - r.ok, b: r.total }), 12000);
  } catch (e) { /* next time */ }
}, 8000);
