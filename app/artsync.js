/* PLEX:arctic — your artwork choices, kept safe.
   Every cover, season cover, background, logo and clearart picked in "Change artwork" is noted as a small
   record: which title it is, and where the picture came from (a TMDB / fanart.tv link, or Plex's own id).
   The pictures themselves stay where they are.

   Built so it keeps working even if Plex changes things:
   - a title is noted by several ids at once: Plex's own, TMDB, IMDb, TVDB, and as a last resort its name + year
     (a season by its show + number), so finding it again doesn't hang on any one of them;
   - the list lives on every TV, in your plex.tv account when Plex allows it, and (in the browser version)
     in a backup file you keep yourself, in plain readable JSON;
   - once a week the app checks quietly that every saved choice can still be found, and says so if not.
   "Restore my artwork" in Settings puts everything back. Clearart, which Plex can't store, comes back by itself. */
'use strict';

const AS_ID = 'plexarctic-art';
const AS_HOSTS = ['https://clients.plex.tv', 'https://plex.tv'];
let asState = { cloud: null, at: 0, msg: '' };   /* cloud: true (saved in the account) / false (only on this TV) */

function asKey() { return userKey('artChoices'); }
function asLocal() { const d = store.get(asKey(), null) || {}; return { v: 2, items: d.items || {} }; }
function asSaveLocal(d) { store.set(asKey(), { v: 2, app: 'PLEX:arctic', items: d.items }); }
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

/* ---- the copy in your plex.tv account ---- */
async function asCloudGet() {
  let last = null;
  for (const h of AS_HOSTS) {
    try {
      const r = await fetch(h + '/api/v2/user/settings?' + plexParams({ 'X-Plex-Token': S.token }), { headers: { Accept: 'application/json' } });
      if (!r.ok) { last = new Error('HTTP ' + r.status); continue; }
      const list = await r.json();
      const hit = (Array.isArray(list) ? list : []).find((x) => x.id === AS_ID);
      return hit && hit.value ? JSON.parse(hit.value) : { v: 2, items: {} };
    } catch (e) { last = e; }
  }
  throw last || new Error('no answer');
}
async function asCloudPut(d) {
  const value = JSON.stringify({ v: 2, app: 'PLEX:arctic', items: d.items });
  let last = null;
  for (const h of AS_HOSTS) {
    try {
      const body = new URLSearchParams({ id: AS_ID, type: 'json', value: value, hidden: '1' });
      const r = await fetch(h + '/api/v2/user/settings?' + plexParams({ 'X-Plex-Token': S.token }), {
        method: 'PUT', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString()
      });
      if (r.ok) return true;
      last = new Error('HTTP ' + r.status);
    } catch (e) { last = e; }
  }
  throw last || new Error('no answer');
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
function asPushSoon() { clearTimeout(asPushTimer); asPushTimer = setTimeout(() => asSync().catch(() => {}), 3000); }

/* both ways: what the account has and what this TV has, newest choice wins */
async function asSync() {
  if (!S.token) return;
  const local = asLocal();
  try {
    const cloud = await asCloudGet();
    const merged = asMerge(local, cloud);
    asSaveLocal(merged);
    if (JSON.stringify(merged.items) !== JSON.stringify((cloud && cloud.items) || {})) await asCloudPut(merged);
    asState = { cloud: true, at: Date.now(), msg: '' };
  } catch (e) {
    asState = { cloud: false, at: Date.now(), msg: (e && e.message) || String(e) };
  }
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
  const d = asLocal();
  const thin = Object.entries(d.items).filter(([, r]) => !r.ids || (r.y === 'season' && !r.sh));
  if (!thin.length) return 0;
  const idx = await asIndex();
  let n = 0;
  for (const [k, r] of thin) {
    const m = await asFind(r, idx);
    if (!m) continue;
    try {
      const full = ((await api('/library/metadata/' + m.ratingKey, { includeGuids: 1 })).Metadata || [])[0] || m;
      r.ids = asIdsOf(full); r.yr = full.year || r.yr || null; r.y = full.type || r.y;
      if (full.type === 'season') {
        r.sx = full.index;
        const sh = ((await api('/library/metadata/' + full.parentRatingKey, { includeGuids: 1 })).Metadata || [])[0];
        if (sh) r.sh = { g: sh.guid, ids: asIdsOf(sh), t: sh.title, yr: sh.year || null };
      }
      d.items[k] = r; n++;
    } catch (e) { /* next */ }
  }
  if (n) { asSaveLocal(d); asPushSoon(); }
  return n;
}

/* can every saved choice still be found? (nothing is changed) */
async function asCheck() {
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
  const where = asState.cloud === true ? t('asCloud') : asState.cloud === false ? t('asLocalOnly', { e: asState.msg }) : t('asChecking');
  const chk = store.get(userKey('artCheck'), null);
  const prog = (i, all, title) => { const el = $('#asprog'); if (el) el.textContent = i + ' / ' + all + ' · ' + title; };
  return '<span class="sval">' + esc(t('asCount', { n: n }) + ' · ' + where) + (chk && chk.total ? ' · ' + esc(t('asCheckLine', { a: chk.ok, b: chk.total })) : '') + '</span>' +
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
    '<button type="button" class="btn ghostbtn f" data-key="assync" data-act="' + A(async () => { await asSync(); rerun(); }) + '">' + esc(t('asSyncNow')) + '</button>' +
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
