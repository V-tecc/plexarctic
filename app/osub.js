/* PLEX:arctic — subtitles straight from OpenSubtitles.com, with your own account.
   Plex fetches subtitles through its own shared OpenSubtitles connection, which now and then stops working
   for hours ("Failed to download subtitle"). When that happens the app asks OpenSubtitles itself, with your
   own API key and account (your daily allowance, not Plex's), and shows the subtitle with its own subtitle
   drawing. The file is kept on this TV for next time. */
'use strict';

const OS_API = 'https://api.opensubtitles.com/api/v1';
let osSession = null;   /* { token, base, at, remaining } */

function osKey() { return store.get('osKey', '') || (window.PRESET && window.PRESET.osKey) || ''; }
/* a name typed in Settings wins only once it has actually worked; until then the built-in one is used */
function osUser() {
  const typed = store.get('osUser', ''), pre = (window.PRESET && window.PRESET.osUser) || '';
  if (pre && typed && typed !== store.get('osUserOk', '')) return pre;
  return typed || pre;
}
function osPass() { return store.get('osPass', '') || (window.PRESET && window.PRESET.osPass) || ''; }
function osReady() { return !!(osKey() && osUser() && osPass()); }

async function osFetch(path, opts, base) {
  opts = opts || {};
  const headers = { 'Api-Key': osKey(), 'Content-Type': 'application/json', Accept: 'application/json', 'X-User-Agent': 'PLEX:arctic v' + (typeof VERSION !== 'undefined' ? VERSION : '1') };
  if (opts.auth && osSession) headers.Authorization = 'Bearer ' + osSession.token;
  const r = await fetch((base || OS_API) + path, { method: opts.method || 'GET', headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  let j = null;
  try { j = await r.json(); } catch (e) { j = null; }
  if (!r.ok) { const e = new Error((j && (j.message || j.errors && j.errors.join(', '))) || ('OpenSubtitles ' + r.status)); e.status = r.status; throw e; }
  return j;
}
async function osLogin(force) {
  if (!force && osSession && Date.now() - osSession.at < 20 * 3600000) return osSession;
  /* the account name, or the e-mail address as a second try (OpenSubtitles takes either depending on the account) */
  /* OpenSubtitles allows one login per second, so tries are spaced out (and a "too many" is waited out once);
     the name that worked is remembered */
  const worked = store.get('osUserOk', '');
  const names = [worked, osUser(), (window.PRESET && window.PRESET.osUserAlt) || ''].filter((x, i, l) => x && l.indexOf(x) === i);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let j = null, err = null;
  for (let i = 0; i < names.length && !j; i++) {
    if (i) await wait(1600);
    for (let tryN = 0; tryN < 2 && !j; tryN++) {
      try { j = await osFetch('/login', { method: 'POST', body: { username: names[i], password: osPass() } }); store.set('osUserOk', names[i]); }
      catch (e) { err = e; if (e.status === 429 || /rate limit/i.test(e.message || '')) await wait(2000); else break; }
    }
  }
  if (!j) throw err || new Error('login failed');
  osSession = { token: j.token, base: j.base_url ? 'https://' + String(j.base_url).replace(/^https?:\/\//, '') + '/api/v1' : OS_API, at: Date.now(),
    remaining: j.user && j.user.allowed_downloads };
  return osSession;
}

/* query strings for OpenSubtitles must be sorted and lower-case, or they are answered with a redirect */
function osQuery(p) {
  return Object.keys(p).filter((k) => p[k] != null && p[k] !== '').sort().map((k) => k + '=' + encodeURIComponent(String(p[k]).toLowerCase())).join('&');
}
function osIds(m) {
  const out = {};
  (m && m.Guid || []).forEach((g) => { const x = /^(tmdb|imdb|tvdb):\/\/(.+)$/.exec(g.id || ''); if (x) out[x[1]] = x[2]; });
  return out;
}

/* what to search for: the film, or the show + season + episode */
async function osTarget(ratingKey) {
  const m = ((await api('/library/metadata/' + ratingKey, { includeGuids: 1 })).Metadata || [])[0];
  if (!m) return null;
  if (m.type === 'episode') {
    let show = null;
    try { show = ((await api('/library/metadata/' + m.grandparentRatingKey, { includeGuids: 1 })).Metadata || [])[0]; } catch (e) { show = null; }
    const si = osIds(show), ei = osIds(m);
    return { m: m, q: { parent_imdb_id: si.imdb ? si.imdb.replace(/^tt/, '') : null, parent_tmdb_id: si.imdb ? null : si.tmdb, season_number: m.parentIndex, episode_number: m.index },
      alt: ei.imdb ? { imdb_id: ei.imdb.replace(/^tt/, '') } : null };
  }
  const ids = osIds(m);
  return { m: m, q: ids.imdb ? { imdb_id: ids.imdb.replace(/^tt/, '') } : ids.tmdb ? { tmdb_id: ids.tmdb } : { query: m.title, year: m.year } };
}

/* search: the best (most downloaded, not machine-translated) first */
async function osSearch(ratingKey, lang) {
  const tg = await osTarget(ratingKey);
  if (!tg) return [];
  const run = async (q) => ((await osFetch('/subtitles?' + osQuery(Object.assign({ languages: lang, order_by: 'download_count', order_direction: 'desc' }, q)))).data || []);
  let data = await run(tg.q);
  if (!data.length && tg.alt) data = await run(tg.alt);
  return data.filter((d) => d.attributes && d.attributes.files && d.attributes.files.length)
    .map((d) => {
      const a = d.attributes;
      return { fileId: a.files[0].file_id, release: a.release || a.files[0].file_name || '', lang: a.language || lang, hi: !!a.hearing_impaired,
        machine: !!(a.machine_translated || a.ai_translated), downloads: a.download_count || 0, from: 'os' };
    })
    .sort((x, y) => (x.machine - y.machine) || (y.downloads - x.downloads));
}

/* download one: the text, kept on this TV under the title */
async function osDownload(ratingKey, hit) {
  const ses = await osLogin();
  let j;
  try { j = await osFetch('/download', { method: 'POST', auth: true, body: { file_id: hit.fileId, sub_format: 'srt' } }, ses.base); }
  catch (e) { if (e.status === 401) { await osLogin(true); j = await osFetch('/download', { method: 'POST', auth: true, body: { file_id: hit.fileId, sub_format: 'srt' } }, osSession.base); } else throw e; }
  if (!j || !j.link) throw new Error((j && j.message) || 'no link');
  if (osSession) osSession.remaining = j.remaining;
  const text = await (await fetch(j.link)).text();
  if (!text || text.length < 20) throw new Error('empty file');
  const entry = { id: 'os-' + hit.fileId, lang: hit.lang, release: hit.release, hi: hit.hi, text: text, at: Date.now() };
  const key = 'osub:' + ratingKey;
  let list = [];
  try { list = (await asDB.get(key)) || []; } catch (e) { list = []; }
  list = list.filter((x) => x.id !== entry.id).concat([entry]);
  try { await asDB.set(key, list); } catch (e) { /* only for this time then */ }
  return { stream: osStream(entry), remaining: j.remaining };
}

/* a downloaded file, shaped like one of Plex's subtitle streams so the pickers and the player take it as is */
function osStream(e) {
  const L = LANGS.find((l) => l.code === e.lang);
  return { id: e.id, ext: true, streamType: 3, codec: 'srt', key: 'ext', languageCode: e.lang, language: L ? L.name : e.lang,
    displayTitle: (L ? L.name : e.lang) + ' (OpenSubtitles)', title: e.release + ' · OpenSubtitles', hearingImpaired: e.hi, extText: e.text };
}
async function osSavedFor(ratingKey) {
  try { return ((await asDB.get('osub:' + ratingKey)) || []).map(osStream); } catch (e) { return []; }
}

/* Settings row: key, username, password */
function osSettingsHTML() {
  const inp = (id, val, ph, pw) => '<input class="input f" id="' + id + '" data-key="' + id + '" data-okfocus data-act="' + A((el) => el.focus()) + '" type="' + (pw ? 'password' : 'text') + '" spellcheck="false" autocomplete="off" placeholder="' + esc(ph) + '" value="' + esc(val) + '">';
  return inp('oskey', '', osKey() ? t('ghTokSet', { s: osKey().slice(-4) }) : t('osKeyPh')) +
    inp('osuser', osUser(), t('osUserPh')) + inp('ospass', '', osPass() ? '••••••' : t('osPassPh'), true) +
    '<button type="button" class="btn f" data-key="ossave" data-act="' + A(async () => {
      const k = $('#oskey').value.trim(), u = $('#osuser').value.trim(), p = $('#ospass').value;
      if (k) store.set('osKey', k);
      if (u) { store.set('osUser', u); store.set('osUserOk', u); }
      if (p) store.set('osPass', p);
      osSession = null;
      try { const s = await osLogin(true); toast(t('osOk', { n: s.remaining != null ? s.remaining : '?' }), 6000); } catch (e) { toast(t('osFail', { e: e.message || e }), 9000); }
    }) + '">' + esc(t('osTest')) + '</button>';
}
