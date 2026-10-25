/* PLEX:arctic — your artwork choices, kept safe.
   Every cover, season cover, background, logo and clearart picked in "Change artwork" is noted as a small
   record: the title's lasting Plex id (its GUID, the same after a reinstall) + where the picture came from
   (a TMDB / fanart.tv link, or Plex's own id for it). The pictures themselves stay where they are.
   The list lives on this TV and in your plex.tv account, so another TV (or this one after a Plex crash)
   can put everything back with "Restore my artwork" in Settings. Clearart, which Plex can't store,
   comes back by itself. */
'use strict';

const AS_ID = 'plexarctic-art';
const AS_HOSTS = ['https://clients.plex.tv', 'https://plex.tv'];
let asState = { cloud: null, at: 0, msg: '' };   /* cloud: true (saved in the account) / false (only on this TV) */

function asKey() { return userKey('artChoices'); }
function asLocal() { return store.get(asKey(), null) || { v: 1, items: {} }; }
function asSaveLocal(d) { store.set(asKey(), d); }
function asCount() { return Object.keys(asLocal().items).length; }

/* called by "Change artwork" when a picture was chosen */
function artRecord(m, kind, o) {
  try {
    const guid = m && m.guid;
    if (!guid) return;
    const d = asLocal();
    const rec = { g: guid, k: kind, t: m.type === 'season' ? (m.parentTitle || '') + ' · ' + (m.title || '') : (m.title || ''), y: m.type, at: Date.now() };
    if (kind === 'clear') { rec.s = 'url'; rec.u = o.full; }
    else if (o.src === 'plex') { rec.s = /^https?:/.test(o.id) ? 'url' : 'plex'; rec.u = o.id; }
    else { rec.s = 'url'; rec.u = o.full; }
    if (!rec.u) return;
    d.items[guid + '|' + kind] = rec;
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
      return hit && hit.value ? JSON.parse(hit.value) : { v: 1, items: {} };
    } catch (e) { last = e; }
  }
  throw last || new Error('no answer');
}
async function asCloudPut(d) {
  const value = JSON.stringify(d);
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
  const out = { v: 1, items: Object.assign({}, a.items || {}) };
  Object.entries((b && b.items) || {}).forEach(([k, r]) => { if (!out.items[k] || (r.at || 0) > (out.items[k].at || 0)) out.items[k] = r; });
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
    asApplyClearart(merged).catch(() => {});
  } catch (e) {
    asState = { cloud: false, at: Date.now(), msg: (e && e.message) || String(e) };
  }
  return asState;
}

/* find a title on this server by its lasting id */
async function asFind(rec) {
  try {
    const r = await api('/library/all', { guid: rec.g, includeGuids: 1 });
    const hit = (r.Metadata || []).find((x) => x.guid === rec.g) || (r.Metadata || [])[0];
    if (hit) return hit;
  } catch (e) { /* try the type filter */ }
  const type = ART_TYPE[rec.y];
  if (type) {
    try {
      const r = await api('/library/all', { type: type, guid: rec.g });
      return (r.Metadata || []).find((x) => x.guid === rec.g) || null;
    } catch (e) { return null; }
  }
  return null;
}

/* clearart lives on each TV only, so it is put back by itself */
async function asApplyClearart(d) {
  if (!S.server) return;
  const picks = store.get('clearartPick', {}) || {};
  let changed = false;
  for (const rec of Object.values(d.items).filter((r) => r.k === 'clear')) {
    const m = await asFind(rec);
    if (!m) continue;
    const key = S.server.id + ':' + m.ratingKey;
    if (picks[key] !== rec.u) { picks[key] = rec.u; changed = true; }
  }
  if (changed) store.set('clearartPick', picks);
}

/* "Restore my artwork": put every saved choice back on the server (cover, season cover, background, logo) */
async function asRestore(onStep) {
  const d = asLocal();
  const recs = Object.values(d.items);
  let done = 0, same = 0, missing = 0, failed = 0;
  for (let i = 0; i < recs.length; i++) {
    const rec = recs[i];
    if (onStep) onStep(i + 1, recs.length, rec.t);
    try {
      const m = await asFind(rec);
      if (!m) { missing++; continue; }
      if (rec.k === 'clear') { const p = store.get('clearartPick', {}) || {}; p[S.server.id + ':' + m.ratingKey] = rec.u; store.set('clearartPick', p); done++; continue; }
      const now = await artList(m.ratingKey, rec.k).catch(() => []);
      const sel = now.find((x) => x.selected);
      if (sel && (sel.id === rec.u || sel.full === rec.u)) { same++; continue; }
      const o = rec.s === 'plex' ? { src: 'plex', id: rec.u } : { src: 'url', full: rec.u };
      /* a picture the server already has: choose it; a link: add it and choose it */
      const there = now.find((x) => x.id === rec.u || x.full === rec.u);
      await artSelect(m, rec.k, there || o, now);
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
    const locked = items.filter((m) => (m.Field || []).some((f) => f.locked && lockOf[f.name]));
    for (let i = 0; i < locked.length; i++) {
      const m = locked[i];
      if (onStep) onStep(i + 1, locked.length, m.title);
      for (const f of (m.Field || []).filter((x) => x.locked && lockOf[x.name])) {
        const kind = lockOf[f.name];
        if (asLocal().items[m.guid + '|' + kind]) continue;
        try {
          const sel = (await artList(m.ratingKey, kind)).find((x) => x.selected);
          if (sel) { artRecord(m, kind, sel); found++; }
        } catch (e) { /* next */ }
      }
    }
  }
  return found;
}

/* the Settings row */
function asSettingsHTML() {
  const n = asCount();
  const where = asState.cloud === true ? t('asCloud') : asState.cloud === false ? t('asLocalOnly', { e: asState.msg }) : t('asChecking');
  return '<span class="sval">' + esc(t('asCount', { n: n }) + ' · ' + where) + '</span>' +
    '<button type="button" class="btn f" data-key="asrestore" data-act="' + A(async () => {
      if (!(await isAdmin())) { toast(t('adminOnly'), 4000); return; }
      if (!asCount()) { toast(t('asNone'), 4000); return; }
      toast(t('asRestoring'), 3000);
      const r = await asRestore((i, all, title) => { const el = $('#asprog'); if (el) el.textContent = i + ' / ' + all + ' · ' + title; });
      toast(t('asRestored', { a: r.done, b: r.same, c: r.missing + r.failed }), 9000);
      const el = $('#asprog'); if (el) el.textContent = '';
    }) + '">' + esc(t('asRestore')) + '</button>' +
    '<button type="button" class="btn ghostbtn f" data-key="asbackup" data-act="' + A(async () => {
      if (!(await isAdmin())) { toast(t('adminOnly'), 4000); return; }
      toast(t('asBackingUp'), 3000);
      const n = await asBackupExisting((i, all, title) => { const el = $('#asprog'); if (el) el.textContent = i + ' / ' + all + ' · ' + title; });
      await asSync();
      toast(t('asBackedUp', { n: n }), 7000);
      rerun();
    }) + '">' + esc(t('asBackup')) + '</button>' +
    '<button type="button" class="btn ghostbtn f" data-key="assync" data-act="' + A(async () => { await asSync(); rerun(); }) + '">' + esc(t('asSyncNow')) + '</button>' +
    '<span class="sval" id="asprog"></span>';
}

/* once a session, a little after start */
setTimeout(() => { if (S.token) asSync().catch(() => {}); }, 8000);
