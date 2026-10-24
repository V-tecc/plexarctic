/* PLEX:arctic — "What's this song?" in the player.
   Asks the Plex server for about 12 seconds of the title's sound from where you are (a tiny, picture-less copy),
   sends it to AudD (https://audd.io, a music recognition service) and shows the song it finds.
   Needs an AudD API token (Settings, or config.js). Nothing is recorded with a microphone. */
'use strict';

const SONG_SECONDS = 12;
function songKey() { return S.auddKey || ''; }
function songSession() { return 'song-' + Math.random().toString(36).slice(2, 12); }

/* the sound from `at` (seconds) onwards, as one MPEG-TS clip */
async function songClip(ratingKey, at, audioStreamID) {
  const session = songSession();
  const master = pmsURL('/video/:/transcode/universal/start.m3u8', {
    hasMDE: 1, path: '/library/metadata/' + ratingKey, mediaIndex: 0, partIndex: 0, protocol: 'hls',
    fastSeek: 1, directPlay: 0, directStream: 0, directStreamAudio: 0,
    videoQuality: 60, maxVideoBitrate: 1500, videoResolution: '1280x720', audioBoost: 100,
    location: S.server.local ? 'lan' : 'wan', subtitles: 'none', audioStreamID: audioStreamID || null,
    session: session, 'X-Plex-Session-Identifier': session
  });
  const stop = () => { fetch(pmsURL('/video/:/transcode/universal/stop', { session: session })).catch(() => {}); };
  try {
    const abs = (u, base) => new URL(u, base).toString();
    const lines = async (url) => {
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return (await r.text()).split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    };
    const m = await lines(master);
    const variant = m.find((x) => !x.startsWith('#'));
    if (!variant) throw new Error('no stream');
    const listURL = abs(variant, master);
    /* the transcoder needs a moment before the first pieces exist */
    let segs = [];
    for (let i = 0; i < 12 && !segs.length; i++) {
      const pl = await lines(listURL);
      /* the list covers the whole title from the start; take the pieces from where you are (asking for a later
         piece makes the server jump there, the same way the player seeks) */
      let t0 = 0, dur = 0;
      segs = [];
      for (let j = 0; j < pl.length && dur < SONG_SECONDS; j++) {
        const inf = /^#EXTINF:([\d.]+)/.exec(pl[j]);
        if (!inf || !pl[j + 1] || pl[j + 1].startsWith('#')) continue;
        const d = parseFloat(inf[1]);
        if (t0 + d > at) { segs.push(abs(pl[j + 1], listURL)); dur += d; }
        t0 += d;
      }
      if (!segs.length) await sleep(700);
    }
    if (!segs.length) throw new Error('no sound');
    /* a piece that isn't ready yet can come back empty: wait and ask again */
    const parts = [], sizes = [];
    for (const u of segs) {
      let buf = null;
      for (let k = 0; k < 15; k++) {
        const r = await fetch(u);
        if (!r.ok) { if (k < 14) { await sleep(600); continue; } if (!parts.length) throw new Error('segment HTTP ' + r.status); break; }
        buf = await r.arrayBuffer();
        if (buf.byteLength > 4000) break;
        await sleep(600);
      }
      if (buf && buf.byteLength) { parts.push(buf); sizes.push(buf.byteLength); }
    }
    if (!parts.length) throw new Error('no sound');
    songClip.last = segs.length + ' pieces: ' + sizes.map((x) => Math.round(x / 1024) + 'k').join(' ');
    return new Blob(parts, { type: 'video/mp2t' });
  } finally { stop(); }
}

async function songLookup(ratingKey, at, audioStreamID) {
  let clip;
  try { clip = await songClip(ratingKey, at, audioStreamID); } catch (e) { e.message = 'Plex: ' + (e.message || e); throw e; }
  if (!clip.size || clip.size < 20000) throw new Error('Plex: clip ' + clip.size + ' B · ' + (songClip.last || ''));
  const fd = new FormData();
  fd.append('api_token', songKey());
  fd.append('return', 'apple_music,spotify');
  fd.append('file', clip, 'clip.ts');
  let j;
  try {
    const r = await fetch('https://api.audd.io/', { method: 'POST', body: fd });
    j = await r.json();
  } catch (e) { throw new Error('AudD: ' + (e.message || e) + ' (' + Math.round(clip.size / 1024) + ' kB)'); }
  if (j.status === 'error') { const e = new Error((j.error && j.error.error_message) || 'AudD'); e.code = j.error && j.error.error_code; throw e; }
  return j.result || null;
}

function songArt(res) {
  const am = res.apple_music && res.apple_music.artwork && res.apple_music.artwork.url;
  if (am) return am.replace('{w}', '300').replace('{h}', '300');
  const sp = res.spotify && res.spotify.album && res.spotify.album.images && res.spotify.album.images[0];
  return sp ? sp.url : '';
}

/* remember what was found (newest first), with where you heard it */
function songRemember(res, m, at) {
  const list = store.get('songHistory', []) || [];
  list.unshift({ title: res.title, artist: res.artist, album: res.album || '', art: songArt(res), link: res.song_link || '',
    from: m.type === 'episode' ? (m.grandparentTitle + ' · ' + epCode(m)) : m.title, key: m.ratingKey, at: Math.floor(at), when: Date.now() });
  store.set('songHistory', list.slice(0, 60));
}

/* the button in the player: listen, then show a card at the bottom left */
let songBusy = false, songLast = null;
/* set by the player: jump inside the title that's playing instead of reopening it */
let songJump = null;
function songsFor(key) { return (store.get('songHistory', []) || []).filter((x) => String(x.key) === String(key)); }
async function songFind(pl, m, at, audioStreamID) {
  if (!songKey()) { toast(t('songNeedsKey'), 6000); return; }
  /* never spend two lookups on the same moment: a second press while listening does nothing, and asking again
     within 40 seconds of the same spot shows the earlier answer */
  if (songBusy) return;
  if (songLast && songLast.key === m.ratingKey && Math.abs(songLast.at - at) < 40 && songLast.res) { songShow(pl, songLast.res); return; }
  songBusy = true;
  try { await songFindNow(pl, m, at, audioStreamID); } finally { songBusy = false; }
}
function songShow(pl, res) {
  const old = $('.songcard', pl); if (old) old.remove();
  const card = document.createElement('div');
  card.className = 'songcard';
  const art = songArt(res);
  card.innerHTML = (art ? '<img src="' + esc(art) + '" alt="">' : '<div class="songph">' + ICON.music + '</div>') +
    '<div class="songtx"><span class="label">' + esc(t('songFound')) + '</span><b>' + esc(res.title) + '</b><span>' + esc(res.artist) + (res.album && res.album !== res.title ? ' · ' + esc(res.album) : '') + '</span><small>' + esc(t('songListHint')) + '</small></div>';
  pl.appendChild(card);
  songAutoHide(pl, card, 15000);
}
/* the card stays while the video is paused; it only counts down while it plays */
function songAutoHide(pl, card, ms) {
  let left = ms;
  const vid = $('#vid', pl);
  const tick = setInterval(() => {
    if (!document.contains(card)) { clearInterval(tick); return; }
    if (!vid || !vid.paused) left -= 500;
    if (left <= 0) { clearInterval(tick); card.classList.add('out'); setTimeout(() => card.remove(), 400); }
  }, 500);
}
async function songFindNow(pl, m, at, audioStreamID) {
  const old = $('.songcard', pl); if (old) old.remove();
  const card = document.createElement('div');
  card.className = 'songcard listening';
  card.innerHTML = '<div class="songwave"><i></i><i></i><i></i><i></i></div><div class="songtx"><b>' + esc(t('songListening')) + '</b><span>' + esc(t('songListeningSub')) + '</span></div>';
  pl.appendChild(card);
  let res = null, err = null;
  try { res = await songLookup(m.ratingKey, at, audioStreamID); } catch (e) { err = e; }
  if (!document.contains(card)) return;
  card.classList.remove('listening');
  if (err) {
    card.innerHTML = '<div class="songtx"><b>' + esc(t('songFailed')) + '</b><span>' + esc(err.code === 900 || err.code === 901 ? t('songBadKey') : err.code === 902 ? t('songOutOfLookups') : (err.message || '')) + '</span></div>';
  } else if (!res) {
    card.innerHTML = '<div class="songtx"><b>' + esc(t('songNone')) + '</b><span>' + esc(t('songNoneSub')) + '</span></div>';
  } else {
    songLast = { key: m.ratingKey, at: at, res: res };
    songRemember(res, m, at);
    const art = songArt(res);
    card.innerHTML = (art ? '<img src="' + esc(art) + '" alt="">' : '<div class="songph">' + ICON.music + '</div>') +
      '<div class="songtx"><span class="label">' + esc(t('songFound')) + '</span><b>' + esc(res.title) + '</b><span>' + esc(res.artist) + (res.album && res.album !== res.title ? ' · ' + esc(res.album) : '') + '</span><small>' + esc(t('songListHint')) + '</small></div>';
  }
  songAutoHide(pl, card, res ? 15000 : 7000);
}

/* every song you've looked up, newest first (Settings → Songs you looked up) */
function songHistorySheet(onlyKey, title) {
  const all = store.get('songHistory', []) || [];
  const list = onlyKey ? all.filter((x) => String(x.key) === String(onlyKey)) : all;
  const rows = list.map((s, i) => '<div class="songrow f" data-key="sh-' + i + '" data-act="' + A(() => { closeModal(true); if (!(songJump && songJump.key === String(s.key) && songJump.go(s.at))) go(viewPlayer, [s.key, { at: s.at }]); }) + '">' +
    (s.art ? '<img src="' + esc(s.art) + '" alt="">' : '<div class="songph">' + ICON.music + '</div>') +
    '<div class="songtx"><b>' + esc(s.title) + '</b><span>' + esc(s.artist) + '</span><small>' + esc(s.from + ' · ' + tc(s.at)) + '</small></div></div>').join('');
  gradSheet(openModal(sheetHeader(title ? t('songsIn', { s: title }) : t('songHistory'), list.length ? (list.length === 1 ? t('songCount1') : t('songCount', { n: list.length })) : '') +
    (rows ? '<p class="sheettext small">' + esc(t('songHistoryNote')) + '</p><div class="songlist">' + rows + '</div>' : '<p class="sheettext">' + esc(t('songHistoryEmpty')) + '</p>'), 'sh-0'));
}
