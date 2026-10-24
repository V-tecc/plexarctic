/* PLEX:arctic — artwork: title logos, and changing posters, backgrounds and logos (server admins only).
   Choices come from the Plex server itself (its agents and anything uploaded) and, with a TMDB key, from TMDB. */
'use strict';

/* ---------- title logos ---------- */
const LOGO_TTL = 14 * 86400000;
let logoMem = null;
function logoStore() {
  if (!logoMem) { logoMem = store.get('logoCache', {}) || {}; }
  return logoMem;
}
function logoSave() {
  const m = logoStore();
  const keys = Object.keys(m);
  if (keys.length > 400) keys.sort((a, b) => m[a].at - m[b].at).slice(0, keys.length - 400).forEach((k) => delete m[k]);
  store.set('logoCache', m);
}
function logoForget(key) { const m = logoStore(); delete m[S.server.id + ':' + key]; logoSave(); }
function plexLogoURL(path) {
  if (!path) return '';
  if (/^https?:/.test(path)) return path;
  /* PNG keeps the transparency */
  return S.server.uri + '/photo/:/transcode?' + new URLSearchParams({ width: 1000, height: 400, minSize: 1, upscale: 0, format: 'png', url: path, 'X-Plex-Token': S.server.token });
}
function clearLogoOf(m) {
  const img = ((m && m.Image) || []).find((x) => x.type === 'clearLogo');
  return img ? img.url : '';
}
const logoWait = new Map();
async function findLogo(key) {
  const ck = S.server.id + ':' + key;
  const hit = logoStore()[ck];
  if (hit && Date.now() - hit.at < LOGO_TTL) return hit.url;
  if (logoWait.has(ck)) return logoWait.get(ck);
  const p = (async () => {
    let url = '';
    try {
      const m = ((await api('/library/metadata/' + key, { includeGuids: 1 })).Metadata || [])[0];
      if (m) {
        url = plexLogoURL(clearLogoOf(m));
        if (!url && S.tmdb && (m.type === 'movie' || m.type === 'show')) {
          const id = tmdbIdOf(m);
          if (id) {
            const r = await tmdbGet('/' + (m.type === 'movie' ? 'movie' : 'tv') + '/' + id + '/images', { include_image_language: [S.lang, 'en', 'null'].join(',') });
            const pick = bestByLang(r.logos || [], S.lang);
            if (pick) url = 'https://image.tmdb.org/t/p/w500' + pick.file_path;
          }
        }
      }
    } catch (e) { url = ''; }
    logoStore()[ck] = { url: url, at: Date.now() };
    logoSave();
    logoWait.delete(ck);
    return url;
  })();
  logoWait.set(ck, p);
  return p;
}
function bestByLang(list, ui) {
  const rank = (x) => (x.iso_639_1 === ui ? 3 : x.iso_639_1 === 'en' ? 2 : !x.iso_639_1 ? 1 : 0);
  return list.slice().sort((a, b) => (rank(b) - rank(a)) || ((b.vote_average || 0) - (a.vote_average || 0)) || ((b.width || 0) - (a.width || 0)))[0] || null;
}
/* white logos vanish on the light theme: measure how light the logo is and darken it there if needed */
function logoTone(img) {
  try {
    const c = document.createElement('canvas');
    c.width = 48; c.height = 16;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0, 48, 16);
    const d = g.getImageData(0, 0, 48, 16).data;
    let sum = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) { sum += (d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722) / 255; n++; }
    return n ? sum / n : 0.5;
  } catch (e) { return 0.5; }
}
function fillLogo(el) {
  const key = el.getAttribute('data-logo');
  el.removeAttribute('data-logo');
  if (!key || S.titleStyle === 'text' || !S.server) return;
  findLogo(key).then((url) => {
    if (!url || !document.contains(el)) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.alt = el.textContent;
    img.className = 'tlogo';
    img.onload = () => {
      if (!document.contains(el)) return;
      const tone = img.crossOrigin ? logoTone(img) : 0.5;
      if (tone > 0.78) img.classList.add('light');
      else if (tone < 0.22) img.classList.add('dark');
      el.classList.add('haslogo');
      el.setAttribute('aria-label', el.textContent);
      el.textContent = '';
      el.appendChild(img);
    };
    /* if the server won't share the picture for measuring, show it anyway without the tone check */
    img.onerror = () => { if (img.crossOrigin) { img.removeAttribute('crossorigin'); img.crossOrigin = null; img.onerror = null; img.src = url + (url.indexOf('?') < 0 ? '?' : '&') + 'nc=1'; } };
    img.src = url;
  });
}
(function () {
  const scan = (root) => {
    if (root.nodeType !== 1) return;
    if (root.hasAttribute('data-logo')) fillLogo(root);
    root.querySelectorAll('[data-logo]').forEach(fillLogo);
  };
  try { new MutationObserver((list) => list.forEach((m) => m.addedNodes.forEach(scan))).observe(document.body, { childList: true, subtree: true }); } catch (e) { /* ignore */ }
})();

/* ---------- changing artwork (admins) ---------- */
const ART_KINDS = {
  poster: { list: 'posters', one: 'poster', lock: 'thumb.locked', label: 'artPoster', tmdb: 'posters', tw: 'w342', ratio: 'tall' },
  art: { list: 'arts', one: 'art', lock: 'art.locked', label: 'artBackground', tmdb: 'backdrops', tw: 'w780', ratio: 'wide' },
  logo: { list: 'clearLogos', one: 'clearLogo', lock: 'clearLogo.locked', label: 'artLogo', tmdb: 'logos', tw: 'w500', ratio: 'logo' }
};
const ART_TYPE = { movie: 1, show: 2, season: 3, episode: 4 };
function artAllowedNow() { return !!(adminCheck && adminCheck.yes && adminCheck.key === (S.server && S.server.id) + '|' + (S.user ? S.user.id : 'owner')); }
/* writes go with the owner's token when we have it (a Home admin's own token may not be allowed to edit) */
function artURL(path, extra) { return S.adminToken ? ownerURL(path, extra) : pmsURL(path, extra); }
async function artList(key, kind) {
  const r = await getJSON(artURL('/library/metadata/' + key + '/' + ART_KINDS[kind].list));
  return ((r.MediaContainer || {}).Metadata || []).map((x) => ({
    src: 'plex', id: x.ratingKey || x.key, selected: !!x.selected, provider: x.provider || '',
    thumb: x.thumb || x.key, full: x.key
  }));
}
async function artTmdb(m, kind) {
  if (!S.tmdb || (m.type !== 'movie' && m.type !== 'show')) return [];
  const id = tmdbIdOf(m);
  if (!id) return [];
  const r = await tmdbGet('/' + (m.type === 'movie' ? 'movie' : 'tv') + '/' + id + '/images', { include_image_language: [S.lang, 'en', 'null'].join(',') });
  const k = ART_KINDS[kind];
  return (r[k.tmdb] || []).slice(0, 40).map((x) => ({
    src: 'tmdb', id: x.file_path, lang: x.iso_639_1 || '', thumb: 'https://image.tmdb.org/t/p/' + k.tw + x.file_path,
    full: 'https://image.tmdb.org/t/p/original' + x.file_path, w: x.width, h: x.height
  }));
}
function artThumb(o, kind) {
  if (/^https?:/.test(o.thumb)) return o.thumb;
  if (kind === 'logo') return plexLogoURL(o.thumb);
  return kind === 'art' ? imgURL(o.thumb, 480, 270) : imgURL(o.thumb, 240, 360);
}
async function artLock(m, kind) {
  const type = ART_TYPE[m.type];
  if (!type || !m.librarySectionID) return;
  try { await fetch(artURL('/library/sections/' + m.librarySectionID + '/all', { type: type, id: m.ratingKey, [ART_KINDS[kind].lock]: 1 }), { method: 'PUT' }); } catch (e) { /* not important */ }
}
async function artSelect(m, kind, o, before) {
  const k = ART_KINDS[kind];
  const base = '/library/metadata/' + m.ratingKey;
  if (o.src === 'plex') {
    const r = await fetch(artURL(base + '/' + k.one, { url: o.id }), { method: 'PUT' });
    if (!r.ok) throw new Error('PUT ' + r.status);
  } else {
    /* add it to the server from the link, then make sure it's the chosen one */
    const r = await fetch(artURL(base + '/' + k.list, { url: o.full }), { method: 'POST' });
    if (!r.ok) throw new Error('POST ' + r.status);
    const after = await artList(m.ratingKey, kind).catch(() => []);
    const was = new Set((before || []).map((x) => x.id));
    const added = after.find((x) => !was.has(x.id)) || after.find((x) => x.selected);
    if (added && !added.selected) await fetch(artURL(base + '/' + k.one, { url: added.id }), { method: 'PUT' });
  }
  await artLock(m, kind);
  if (kind === 'logo') logoForget(m.ratingKey);
}
async function artEditor(item, kindIn) {
  if (!(await isAdmin())) { toast(t('adminOnly'), 4000); return; }
  let m;
  try { m = ((await api('/library/metadata/' + item.ratingKey, { includeGuids: 1 })).Metadata || [])[0]; } catch (e) { m = null; }
  if (!m) { toast(t('notFound'), 4000); return; }
  const kinds = m.type === 'episode' ? ['poster'] : m.type === 'season' ? ['poster', 'art'] : ['poster', 'art', 'logo'];
  let kind = kinds.includes(kindIn) ? kindIn : 'poster';
  let busy = false, changed = false;
  const draw = async (focusKey) => {
    const old = $('.modal', viewEl);
    if (old) old._onclose = null;
    const k = ART_KINDS[kind];
    const tabs = '<div class="seg arttabs">' + kinds.map((x) => '<button type="button" class="f' + (x === kind ? ' on' : '') + '" data-key="at-' + x + '" data-act="' + A(() => { kind = x; draw('at-' + x); }) + '">' + esc(t(ART_KINDS[x].label)) + '</button>').join('') + '</div>';
    const head = sheetHeader(t('artChange'), m.type === 'episode' ? (m.grandparentTitle + ' · ' + epCode(m)) : m.title);
    const el = openModal(head + tabs + '<p class="sheettext" id="artnote">' + esc(t('loading')) + '</p>', focusKey || 'at-' + kind, true);
    el.classList.add('artsheet');
    el._onclose = () => { if (changed) afterArt(m); };
    let plex = [], tm = [];
    try { plex = await artList(m.ratingKey, kind); } catch (e) { plex = []; }
    try { tm = await artTmdb(m, kind); } catch (e) { tm = []; }
    if (!document.contains(el) || ART_KINDS[kind] !== k) return;
    const cell = (o, i) => '<button type="button" class="artopt ' + k.ratio + ' f' + (o.selected ? ' sel' : '') + '" data-key="ao-' + o.src + i + '" data-act="' + A(async () => {
      if (busy || o.selected) return;
      busy = true;
      toast(t('artSaving'), 2500);
      try { await artSelect(m, kind, o, plex); toast(t('artSaved'), 3000); changed = true; draw('ao-' + o.src + i); } catch (e) { toast(t('artFailed') + ' (' + (e.message || e) + ')', 6000); }
      busy = false;
    }) + '"><img loading="lazy" src="' + esc(artThumb(o, kind)) + '" alt="">' +
      (o.selected ? '<i class="artsel">' + ICON.check + '</i>' : '') +
      ((o.src === 'tmdb' && o.lang) ? '<span class="artlang">' + esc(o.lang.toUpperCase()) + '</span>' : '') + '</button>';
    const group = (label, list) => list.length ? '<span class="label">' + esc(label) + '</span><div class="artgrid ' + k.ratio + '">' + list.map(cell).join('') + '</div>' : '';
    const body = group(t('artOnServer'), plex) + group(t('artFromTmdb'), tm.filter((x) => !plex.some((p) => p.full && p.full.indexOf(x.id) >= 0)));
    const note = $('#artnote', el);
    if (note) note.outerHTML = body ? '<p class="sheettext small">' + esc(t('artNote')) + '</p>' + body : '<p class="sheettext">' + esc(kind === 'logo' && !S.tmdb ? t('artNoLogos') : t('artNone')) + '</p>';
    initFocus(focusKey || ('ao-plex' + Math.max(0, plex.findIndex((x) => x.selected))), el);
  };
  draw();
}
/* after a change: forget cached pictures of this item and redraw what's on screen */
function afterArt(m) {
  try { if (typeof libIndex !== 'undefined') libIndex = null; } catch (e) { /* ignore */ }
  if (current && current.fn === viewDetails && String(current.args[0]) === String(m.ratingKey)) {
    const keep = current.focusKey;
    setTimeout(() => { if (!modalOpen()) { current.focusKey = keep; rerun(); } }, 50);
  } else if (current && current.fn !== viewPlayer) {
    setTimeout(() => { if (!modalOpen()) rerun(); }, 50);
  }
}
