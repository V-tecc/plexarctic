/* PLEX:arctic — automatic franchise collections (server admins).
   TMDB knows which films belong together ("The Matrix Collection"). This goes through a movie library, finds every
   franchise you own at least two films of, and makes (or tops up) a Plex collection for it, with TMDB's poster and
   background. Your own collections with the same name are topped up with missing films; their artwork is only
   filled in when they don't have any (Plex's automatic picture collage). Nothing is ever removed. */
'use strict';

const COLL_MIN = 2;
function collCache() { return store.get('tmdbFranchise', {}) || {}; }
function collStatus() { return store.get('collStatus.' + (S.server ? S.server.id : ''), null); }
function collSaveStatus(v) { store.set('collStatus.' + S.server.id, v); }
const collItemURI = (keys) => 'server://' + S.server.id + '/com.plexapp.plugins.library/library/metadata/' + keys.join(',');
function collURL(path, extra) { return S.adminToken ? ownerURL(path, extra) : pmsURL(path, extra); }
async function collFetch(path, extra, method) {
  const r = await fetch(collURL(path, extra), { method: method || 'GET', headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(method + ' ' + path + ' ' + r.status);
  const txt = await r.text();
  try { return txt ? JSON.parse(txt) : {}; } catch (e) { return {}; }
}

/* which TMDB collection a film belongs to (cached for a month; films rarely change franchise) */
async function collOf(tmdbId, cache) {
  const hit = cache[tmdbId];
  if (hit && Date.now() - hit.at < 30 * 86400000) return hit.c;
  let c = null;
  try {
    const j = await tmdbGet('/movie/' + tmdbId, { language: S.lang });
    const b = j.belongs_to_collection;
    if (b) c = { id: b.id, name: b.name, poster: b.poster_path || '', art: b.backdrop_path || '' };
  } catch (e) { return hit ? hit.c : null; }
  cache[tmdbId] = { at: Date.now(), c: c };
  return c;
}

/* the whole job for one movie library; `say` gets progress text */
async function collBuild(sec, say) {
  if (!S.tmdb) throw new Error(t('collNeedsTmdb'));
  say(t('collReading'));
  const movies = ((await api('/library/sections/' + sec.key + '/all', { type: 1, includeGuids: 1, 'X-Plex-Container-Start': 0, 'X-Plex-Container-Size': 20000 })).Metadata || []);
  const cache = collCache();
  const groups = new Map();
  let done = 0;
  for (const m of movies) {
    const id = tmdbIdOf(m);
    done++;
    if (done % 25 === 0) { say(t('collChecking', { n: done, m: movies.length })); store.set('tmdbFranchise', cache); }
    if (!id) continue;
    const c = await collOf(id, cache);
    if (!c) continue;
    if (!groups.has(c.id)) groups.set(c.id, { c: c, items: [] });
    groups.get(c.id).items.push(m);
  }
  store.set('tmdbFranchise', cache);
  const wanted = Array.from(groups.values()).filter((g) => g.items.length >= COLL_MIN);
  /* the collections already in this library, by name */
  const existing = ((await api('/library/sections/' + sec.key + '/collections', { 'X-Plex-Container-Start': 0, 'X-Plex-Container-Size': 5000 })).Metadata || []);
  const byName = new Map(existing.map((c) => [fold(c.title).trim(), c]));
  let made = 0, topped = 0, n = 0;
  for (const g of wanted) {
    n++;
    say(t('collMaking', { n: n, m: wanted.length, s: g.c.name }));
    const keys = g.items.map((x) => String(x.ratingKey));
    let coll = byName.get(fold(g.c.name).trim());
    let fresh = false;
    if (!coll) {
      const j = await collFetch('/library/collections', { type: 1, title: g.c.name, smart: 0, sectionId: sec.key, uri: collItemURI(keys) }, 'POST');
      coll = ((j.MediaContainer || {}).Metadata || [])[0];
      if (!coll) continue;
      fresh = true; made++;
    } else {
      const have = new Set((((await api('/library/collections/' + coll.ratingKey + '/children')).Metadata) || []).map((x) => String(x.ratingKey)));
      const missing = keys.filter((k) => !have.has(k));
      if (missing.length) { await collFetch('/library/collections/' + coll.ratingKey + '/items', { uri: collItemURI(missing) }, 'PUT'); topped++; }
    }
    /* artwork: always for collections made here; for older ones only if they still show Plex's collage */
    const needsArt = fresh || !coll.thumb || /composite/.test(coll.thumb);
    if (needsArt && g.c.poster) await collFetch('/library/metadata/' + coll.ratingKey + '/posters', { url: 'https://image.tmdb.org/t/p/original' + g.c.poster }, 'POST').catch(() => {});
    if ((fresh || !coll.art) && g.c.art) await collFetch('/library/metadata/' + coll.ratingKey + '/arts', { url: 'https://image.tmdb.org/t/p/original' + g.c.art }, 'POST').catch(() => {});
    /* films in release order */
    if (fresh) await collFetch('/library/metadata/' + coll.ratingKey + '/prefs', { collectionSort: 0 }, 'PUT').catch(() => {});
  }
  return { made: made, topped: topped, franchises: wanted.length };
}

/* Settings → Franchise collections → Build now */
async function collRunAll(auto) {
  if (!(await isAdmin())) { if (!auto) toast(t('adminOnly'), 4000); return; }
  const secs = ((await api('/library/sections')).Directory || []).filter((s) => s.type === 'movie');
  if (!secs.length) return;
  let made = 0, topped = 0;
  const say = (msg) => { if (!auto) { const el = $('#collstat'); if (el) el.textContent = msg; } };
  try {
    for (const sec of secs) {
      const r = await collBuild(sec, (msg) => say(sec.title + ' · ' + msg));
      made += r.made; topped += r.topped;
    }
    collSaveStatus({ at: Date.now(), made: made, topped: topped });
    if (!auto || made || topped) toast(t('collDone', { a: made, b: topped }), 6000);
  } catch (e) { if (!auto) toast(t('collFailed') + ' (' + (e.message || e) + ')', 8000); }
  say(collStatusText());
}
function collStatusText() {
  const st = collStatus();
  if (!st) return t('collNever');
  return t('collLast', { d: new Date(st.at).toLocaleDateString(lang().locale, { day: 'numeric', month: 'short' }), a: st.made, b: st.topped });
}
/* once a week by itself (admins, when the home screen opens), if switched on */
function collMaybeAuto() {
  if (!S.server || store.get('collAuto', false) !== true) return;
  const st = collStatus();
  if (st && Date.now() - st.at < 7 * 86400000) return;
  setTimeout(() => collRunAll(true), 20000);
}

/* collections: artwork from TMDB by the collection's name (for the ones you make by hand) */
async function collArtFromTmdb(coll) {
  if (!S.tmdb) { toast(t('collNeedsTmdb'), 5000); return; }
  try {
    const name = String(coll.title || '').replace(/\s*(collection|samlingen|samling|kolekce)\s*$/i, '');
    const j = await tmdbGet('/search/collection', { query: name, language: S.lang });
    const hit = (j.results || [])[0];
    if (!hit) { toast(t('collNoMatch', { s: coll.title }), 5000); return; }
    if (hit.poster_path) await collFetch('/library/metadata/' + coll.ratingKey + '/posters', { url: 'https://image.tmdb.org/t/p/original' + hit.poster_path }, 'POST');
    if (hit.backdrop_path) await collFetch('/library/metadata/' + coll.ratingKey + '/arts', { url: 'https://image.tmdb.org/t/p/original' + hit.backdrop_path }, 'POST');
    toast(t('collArtDone', { s: hit.name }), 5000);
  } catch (e) { toast(t('collFailed') + ' (' + (e.message || e) + ')', 7000); }
}
function collMenu(c, sec) {
  const rows = [optionRow('cm-open', t('ctxDetails'), [], false, A(() => { closeModal(true); go(viewLibrary, [sec, c]); }))];
  if (artAllowedNow()) {
    rows.push(optionRow('cm-auto', t('collAutoArt'), [], false, A(async () => { closeModal(true); await collArtFromTmdb(c); rerun(); }), t('collAutoArtNote')));
    rows.push(optionRow('cm-art', t('artChange'), [], false, A(() => { closeModal(true); artEditor(c); })));
  }
  const prevArt = modalArt; modalArt = c.thumb ? imgURL(c.thumb, 440, 660) : prevArt;
  gradSheet(openModal(sheetHeader(c.title, t('nTitles', { n: c.childCount || 0 })) + '<div class="optlist">' + rows.join('') + '</div>', 'cm-open'));
  modalArt = prevArt;
}
