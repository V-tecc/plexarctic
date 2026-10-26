/* PLEX:arctic — Home sections that aren't rows of posters:
   the favourite-actor banner, "Fits before …" as a timeline, and "What are you in the mood for?" genre tiles. */
'use strict';

/* ---------- favourite actor banner ---------- */
function abSelHTML(m) {
  if (!m) return '';
  return '<span class="ablabel">' + esc(t('abSelected')) + '</span><b>' + esc(m.title) + '</b>' +
    '<span class="abmeta">' + esc([m.year, (m.Genre || []).slice(0, 1).map((g) => g.tag)[0], durText(m.duration), m.duration ? endsAtText(m.duration) : ''].filter(Boolean).join(' · ')) + '</span>' +
    (m.summary ? '<p>' + esc(m.summary) + '</p>' : '');
}
function abSelect(m) {
  const art = $('#abart'); const sel = $('#absel');
  if (art && m.art) { const src = imgURL(m.art, 1600, 900); if (art.getAttribute('src') !== src) { art.classList.add('swap'); setTimeout(() => { art.src = src; art.classList.remove('swap'); }, 160); } }
  if (sel) sel.innerHTML = abSelHTML(m);
}
/* The chosen film is the big poster under the face and stays in that spot: Right / Left slide the films along,
   the small posters after it are the ones coming up. */
let abCur = null;
function abRowHTML(a) {
  const next = a.items.slice(a.sel + 1, a.sel + 7);
  return next.map((m) => '<div class="abcard"><img loading="lazy" src="' + esc(imgURL(m.thumb, 300, 450)) + '" alt=""></div>').join('') +
    '<span class="abpos">' + esc((a.sel + 1) + ' / ' + a.items.length) + '</span>';
}
/* ‹ only once you've moved on, › not on the last film */
function abArrows(a) {
  const el = $('#abarrows'); if (!el || !a) return;
  el.classList.toggle('nol', a.sel <= 0);
  el.classList.toggle('nor', a.sel >= a.items.length - 1);
}
function abShow(dir) {
  const a = abCur && abCur.actor;
  if (!a) return false;
  const n = Math.max(0, Math.min(a.items.length - 1, a.sel + dir));
  if (n === a.sel) return false;
  a.sel = n;
  const m = a.items[n];
  const big = $('#abbig'); if (big) { const im = $('img', big); if (im) im.src = imgURL(m.thumb, 400, 600); }
  const row = $('#abrowc'); if (row) row.innerHTML = abRowHTML(a);
  abArrows(a);
  abSelect(m);
  return true;
}
document.addEventListener('keydown', (e) => {
  if (!focused || modalOpen()) return;
  const k = focused.dataset.key;
  /* up from the big poster to the face, down from the face to the poster */
  const jump = (key) => { const el = $('[data-key="' + key + '"]', viewEl); if (el) { setFocus(el); e.preventDefault(); e.stopImmediatePropagation(); } };
  if (k === 'ab-big' && e.key === 'ArrowUp') return jump('ab-face');
  if (k === 'ab-face' && e.key === 'ArrowDown') return jump('ab-big');
  if (k === 'ab-face' && e.key === 'ArrowRight') return jump($('[data-key="ab-next"]', viewEl) ? 'ab-next' : 'ab-set');
  if (k === 'ab-next' && e.key === 'ArrowLeft') return jump('ab-big');
  if (k !== 'ab-big') return;
  const ban = $('#abanner'); if (ban && ban.scrollTop) ban.scrollTop = 0;
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    if (abShow(e.key === 'ArrowRight' ? 1 : -1)) { e.preventDefault(); e.stopImmediatePropagation(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopImmediatePropagation(); }
  }
}, true);
function actorBannerHTML(x, d) {
  const a = x.actor;
  a.sel = Math.min(a.sel || 0, Math.max(0, a.items.length - 1));
  abCur = x;
  const first = a.items[a.sel];
  const pool = x.actorPool || [];
  const ini = a.name.split(' ').map((w) => w[0]).join('').slice(0, 2);
  const cur = () => a.items[a.sel];
  return '<section class="abanner" id="abanner">' +
    '<img class="abart" id="abart" src="' + esc(first && first.art ? imgURL(first.art, 1600, 900) : '') + '" alt="">' +
    '<div class="abshade"></div>' +
    /* the face is a button: all their films */
    '<div class="abwho"><button type="button" class="abfacebtn f" data-key="ab-face" aria-label="' + esc(t('abAll')) + '" data-act="' + A(() => go(viewPerson, [a.name, a.who && a.who.thumb, null, t('home')])) + '">' +
    (a.who && a.who.thumb ? '<img class="abface" src="' + esc(imgURL(a.who.thumb, 400, 400)) + '" alt="">' : '<span class="abface ini">' + esc(ini) + '</span>') + '<span class="abfacehint">' + esc(t('abAll')) + '</span></button>' +
    '<div class="abtx"><span class="eyebrow">' + esc(t('abEyebrow')) + '</span><h2><span class="abmw">' + esc(t('abMore')) + '</span>' + esc(a.name) + '</h2>' +
    '<span class="absub">' + esc(t('tasteActorSub2', { s: tasteTitlesText(a.who) })) + '</span></div></div>' +
    '<div class="absel" id="absel">' + abSelHTML(first) + '</div>' +
    (first ? '<div class="abbig f" id="abbig" data-key="ab-big" data-act="' + A(() => openItem(cur())) + '" data-ctx="' + A(() => itemMenu(cur())) + '" data-onfocus="' + A(() => { abSelect(cur()); const ban = $('#abanner'); if (ban) { ban.scrollTop = 0; setTimeout(() => { ban.scrollTop = 0; }, 50); } }) + '">' +
      '<img src="' + esc(imgURL(first.thumb, 400, 600)) + '" alt=""></div><span class="abarrows' + (a.sel <= 0 ? ' nol' : '') + (a.sel >= a.items.length - 1 ? ' nor' : '') + '" id="abarrows" aria-hidden="true"><i>‹</i><i>›</i></span>' : '') +
    '<div class="abrow"><div class="abrowc" id="abrowc">' + abRowHTML(a) + '</div>' +
    (pool.length > 1 ? '<div class="abnav"><span class="abcount">' + esc(((x.actorPos || 0) + 1) + ' / ' + pool.length) + '</span>' +
      '<button type="button" class="btn ghostbtn f" data-key="ab-next" data-act="' + A(() => abNext(x, d)) + '">' + esc(t('abSwitch')) + ICON.next + '</button>' : '<div class="abnav">') +
    '<button type="button" class="btn ghostbtn icon f" data-key="ab-set" aria-label="' + esc(t('pinTitle')) + '" data-act="' + A(() => abSettings(x, d)) + '">' + ICON.gear + '</button></div>' +
    '</div></section>';
}
let abBusy = false;
async function abNext(x, d) {
  if (abBusy || !d.movieSec) return;
  abBusy = true;
  const btn = $('[data-key="ab-next"]', viewEl);
  if (btn) btn.classList.add('busy');
  try {
    const pool = x.actorPool || [];
    for (let step = 1; step <= pool.length; step++) {
      const pos = ((x.actorPos || 0) + step) % pool.length;
      const f = pool[pos];
      let list = [];
      list = await abActorFilms(d.movieSec, f, x.moviesAll);
      list = tasteSort(list, x.taste);
      if (list.length >= 2) {
        x.actor = { name: f.name, n: f.n, who: f, items: list.slice(0, 60) };
        x.actorPos = pos;
        const el = $('#abanner', viewEl);
        if (el) { el.outerHTML = actorBannerHTML(x, d); const b = $('[data-key="ab-next"]', viewEl); if (b) setFocus(b, true); }
        break;
      }
    }
  } finally { abBusy = false; const b = $('[data-key="ab-next"]', viewEl); if (b) b.classList.remove('busy'); }
}

/* ---------- "Fits before …" as a timeline: each bar is as long as the film ---------- */
function fitsTimelineHTML(x) {
  const now = Date.now();
  const end = x.fitsTarget instanceof Date ? x.fitsTarget.getTime() : +x.fitsTarget;
  const total = end - now;
  if (total <= 0) return '';
  const list = x.fits.slice(0, 4).slice().sort((a, b) => a.duration - b.duration);
  const pct = (ms) => Math.max(0, Math.min(100, ms / total * 100));
  /* a tick on every half hour */
  const ticks = [];
  const tk = new Date(now); tk.setSeconds(0, 0); tk.setMinutes(tk.getMinutes() < 30 ? 30 : 60);
  const step = total > 3.5 * 3600000 ? 60 : 30;
  if (step === 60 && tk.getMinutes() === 30) tk.setMinutes(60);
  for (let ts = tk.getTime(); ts < end - 10 * 60000; ts += step * 60000) if ((ts - now) / total > 0.07 && (end - ts) / total > 0.06) ticks.push(ts);
  return '<section class="hub fitstl"><div class="hubhead"><h2>' + esc(t('fitsBefore', { t: hhmm(new Date(end)) })) + '</h2><span>' + esc(t('fitsTlSub')) + '</span></div>' +
    '<div class="tlaxis"><span class="tlnow">' + esc(t('tlNow', { t: hhmm(new Date(now)) })) + '</span>' +
    ticks.map((ts) => '<span class="tltick" style="left: ' + pct(ts - now).toFixed(2) + '%">' + esc(hhmm(new Date(ts))) + '</span>').join('') +
    '<span class="tlend">' + esc(hhmm(new Date(end))) + '</span></div>' +
    '<div class="tllanes">' + ticks.map((ts) => '<i class="tlgrid" style="left: ' + pct(ts - now).toFixed(2) + '%"></i>').join('') + '<i class="tlendline"></i>' +
    list.map((m, i) => '<div class="tlbar f" data-key="fit-' + i + '" style="width: ' + pct(m.duration).toFixed(2) + '%" data-act="' + A(() => openItem(m)) + '" data-ctx="' + A(() => itemMenu(m)) + '">' +
      '<img loading="lazy" src="' + esc(imgURL(m.thumb, 80, 120)) + '" alt="">' +
      '<span class="tltx"><b>' + esc(m.title) + '</b><small>' + esc([durText(m.duration), rateOf(m) ? '★ ' + rateOf(m).toFixed(1) : ''].filter(Boolean).join(' · ')) + '</small></span>' +
      '<span class="tlendt">' + esc(hhmm(new Date(now + m.duration))) + '</span></div>').join('') +
    '</div>' +
    '<div class="tlfoot"><button type="button" class="btn ghostbtn f" data-key="fit-more" data-act="' + A(() => fitsOthers(x)) + '">' + ICON.next + esc(t('fitsOthers')) + '</button>' +
    '<span>' + esc(t('fitsCount', { n: (x.fitsPool || x.fits).length })) + '</span></div>' +
    '</section>';
}
/* another four films that fit, picked to your taste but different each time */
function fitsOthers(x) {
  const pool = (x.fitsPool || x.fits).filter((m) => !x.fits.slice(0, 4).includes(m));
  if (!pool.length) return;
  const picks = [];
  for (let i = 0; i < 4 && pool.length; i++) { const m = tastePick(pool, x.taste); if (!m) break; picks.push(m); pool.splice(pool.indexOf(m), 1); }
  x.fits = picks.concat(x.fits.filter((m) => !picks.includes(m)));
  const sec = $('.fitstl', viewEl);
  if (sec) { sec.outerHTML = fitsTimelineHTML(x); const b = $('[data-key="fit-more"]', viewEl); if (b) setFocus(b, true); }
}

/* ---------- songs you've found with "What's this song?" ---------- */
function songsHomeHTML() {
  const list = (store.get('songHistory', []) || []).slice(0, 8);
  if (!list.length) return '';
  return '<section class="hub"><div class="hubhead"><h2>' + esc(t('songHistory')) + '</h2><span>' + esc(t('songHomeSub')) + '</span></div><div class="songhome">' +
    list.map((s, i) => '<div class="songcardh f" data-key="sgh-' + i + '" data-act="' + A(() => go(viewPlayer, [s.key, { at: s.at }])) + '" data-ctx="' + A(() => songHistorySheet()) + '">' +
      (s.art ? '<img src="' + esc(s.art) + '" alt="">' : '<span class="songph">' + ICON.music + '</span>') +
      '<span class="sgtx"><b>' + esc(s.title) + '</b><span>' + esc(s.artist) + '</span><small>' + esc(s.from + ' · ' + tc(s.at)) + '</small></span></div>').join('') +
    '</div><button type="button" class="btn ghostbtn f" data-key="sgh-all" data-act="' + A(() => songHistorySheet()) + '">' + ICON.music + esc(t('songHomeAll')) + '</button></section>';
}

/* ---------- "What are you in the mood for?": your top genres as tiles ---------- */
function moodTilesHTML(x) {
  const st = x.viewStats;
  if (!st || !st.all || !st.all.genres.length) return '';
  const r = (m) => Number(m.audienceRating || m.rating || 0);
  const no = tasteGet().no;
  const tiles = st.all.genres.slice(0, 4).map((g, i) => {
    const unseen = st.moviesAll.filter((m) => !m.viewCount && !no[m.ratingKey] && (m.Genre || []).some((y) => y.tag === g.name));
    const arts = unseen.filter((m) => m.art).sort((a, b) => r(b) - r(a)).slice(0, 3);
    return '<div class="mood f m' + i + '" data-key="mood-' + i + '" data-act="' + A(() => vsGenre(st, { genre: g.name }, g.name)) + '">' +
      '<div class="mart3">' + arts.map((m) => '<img loading="lazy" src="' + esc(imgURL(m.art, 480, 270)) + '" alt="">').join('') + '</div><div class="mshade"></div>' +
      '<div class="mtx"><b>' + esc(g.name) + '</b><small>' + esc(t('moodSub', { p: g.pct, n: unseen.length })) + '</small></div></div>';
  });
  return '<section class="hub"><div class="hubhead"><h2>' + esc(t('moodTitle')) + '</h2><span>' + esc(t('moodHead')) + '</span></div><div class="moods">' + tiles.join('') + '</div></section>';
}

/* ---------- Watching now: how a stream is being played (admins) ---------- */
function streamDecision(d) {
  d = String(d || '').toLowerCase();
  if (d === 'directplay') return t('sdDirectPlay');
  if (d === 'copy') return t('sdDirectStream');
  if (d === 'transcode') return t('sdTranscode');
  if (d === 'burn') return t('sdBurn');
  return d ? d : '';
}
function streamInfo(it) {
  const media = (it.Media || [])[0] || {};
  const part = (media.Part || [])[0] || {};
  const streams = part.Stream || [];
  const pick = (type) => streams.find((s) => s.streamType === type && (s.selected || s.decision)) || streams.find((s) => s.streamType === type) || null;
  const v = pick(1), a = pick(2), sub = pick(3);
  const ts = it.TranscodeSession || {};
  const pl = it.Player || {}, se = it.Session || {};
  const res = (x) => (x ? (/^\d+$/.test(String(x)) ? x + 'p' : String(x).toUpperCase()) : '');
  const mbps = se.bandwidth ? (se.bandwidth >= 1000 ? (Math.round(se.bandwidth / 100) / 10) + ' Mbps' : se.bandwidth + ' kbps') : '';
  const local = pl.local === true || pl.local === 1 || pl.local === '1' || se.location === 'lan';
  const vTxt = v ? [res(media.videoResolution || (v.height ? v.height : '')), '(' + [String(v.codec || '').toUpperCase(), v.profile ? v.profile.replace(/^\w/, (c) => c.toUpperCase()) : ''].filter(Boolean).join(' ') + ')'].filter(Boolean).join(' ') : '';
  const aTxt = a ? [a.language || t('sdUnknown'), '(' + [String(a.codec || '').toUpperCase(), a.audioChannelLayout || (a.channels ? (a.channels === 6 ? '5.1' : a.channels === 8 ? '7.1' : a.channels === 2 ? t('sdStereo') : a.channels + 'ch') : '')].filter(Boolean).join(' ') + ')'].join(' ') : '';
  const sTxt = sub ? [sub.language || sub.displayTitle || '', '(' + [String(sub.codec || '').toUpperCase(), sub.title || ''].filter(Boolean).join(' ') + ')'].filter(Boolean).join(' ') : '';
  return {
    player: [pl.product || '', pl.title || pl.device || ''].filter(Boolean).join(' — '),
    state: (pl.state === 'paused' ? t('sdPaused') : pl.state === 'buffering' ? t('sdBuffering') : t('sdPlaying')) + ' — ' + tc((it.viewOffset || 0) / 1000) + ' / ' + tc((it.duration || 0) / 1000),
    net: (local ? t('sdLocal') : t('sdRemote')) + (pl.address || pl.remotePublicAddress ? ' (' + (pl.remotePublicAddress && !local ? pl.remotePublicAddress : pl.address) + ')' : '') + (mbps ? ' — ' + mbps : ''),
    video: v ? { txt: vTxt, how: streamDecision(v.decision || ts.videoDecision || part.decision || (ts.key ? '' : 'directplay')) } : null,
    audio: a ? { txt: aTxt, how: streamDecision(a.decision || ts.audioDecision || part.decision || (ts.key ? '' : 'directplay')) } : null,
    subs: sub ? { txt: sTxt, how: streamDecision(sub.decision || ts.subtitleDecision || '') } : null,
    short: [ts.videoDecision === 'transcode' || (v && v.decision === 'transcode') ? t('sdTranscode') : (v && v.decision === 'copy') || ts.videoDecision === 'copy' ? t('sdDirectStream') : t('sdDirectPlay'), mbps].filter(Boolean).join(' · '),
    transcoding: ts.videoDecision === 'transcode' || ts.audioDecision === 'transcode' || (v && v.decision === 'transcode'),
    speed: ts.speed ? (Math.round(ts.speed * 10) / 10) + '×' : '',
    hw: ts.transcodeHwRequested || ts.transcodeHwFullPipeline ? t('sdHw') : ''
  };
}
function streamInfoSheet(it) {
  const s = streamInfo(it);
  const row = (label, x) => x ? '<div class="sirow"><span class="sil">' + esc(label) + '</span><span class="siv"><b>' + esc(x.txt) + '</b>' + (x.how ? '<small>↪ ' + esc(x.how) + '</small>' : '') + '</span></div>' : '';
  const ep = it.type === 'episode';
  const who = (it.User && it.User.title) || '';
  const prevArt = modalArt; modalArt = imgURL(ep ? (it.grandparentThumb || it.thumb) : it.thumb, 440, 660) || prevArt;
  gradSheet(openModal(sheetHeader(ep ? it.grandparentTitle + ' · ' + epCode(it) : itemTitle(it), who) +
    '<div class="sinfo">' +
    '<div class="sihead"><b>' + esc(s.player) + '</b><span>' + esc(s.state) + '</span><span>' + esc(s.net) + '</span>' +
    (s.transcoding && (s.speed || s.hw) ? '<span>' + esc([t('sdTranscode'), s.speed, s.hw].filter(Boolean).join(' · ')) + '</span>' : '') + '</div>' +
    row(t('sdVideo'), s.video) + row(t('sdAudio'), s.audio) + row(t('sdSubs'), s.subs) + '</div>' +
    '<div class="optlist">' + optionRow('si-open', ep ? t('ctxEpisode') : t('ctxDetails'), [], false, A(() => { closeModal(true); openItem(it); })) + '</div>', 'si-open'));
  modalArt = prevArt;
}

/* ---------- Plex Watchlist (the same list Plex's own apps show; per profile, kept by Plex) ---------- */
const WL = { ids: new Set(), at: 0, items: [], user: null };
const WL_HOSTS = ['https://discover.provider.plex.tv', 'https://metadata.provider.plex.tv'];
function wlId(it) { const g = String((it && it.guid) || ''); return /^plex:\/\//.test(g) ? g.split('/').pop() : ''; }
async function wlCall(path, extra, method) {
  let last = null;
  for (const host of WL_HOSTS) {
    try { return await getJSON(host + path + '?' + plexParams(Object.assign({ 'X-Plex-Token': S.token }, extra)), { method: method || 'GET' }); }
    catch (e) { last = e; if (e.status === 401) break; }
  }
  throw last || new Error('watchlist');
}
async function wlLoad(force) {
  const who = S.user ? S.user.id : 'owner';
  if (!force && WL.user === who && Date.now() - WL.at < 60000) return WL.items;
  const j = await wlCall('/library/sections/watchlist/all', { sort: 'watchlistedAt:desc', includeCollections: 1, includeExternalMedia: 1, 'X-Plex-Container-Start': 0, 'X-Plex-Container-Size': 100 });
  const items = (j.MediaContainer || {}).Metadata || [];
  WL.items = items; WL.ids = new Set(items.map(wlId).filter(Boolean)); WL.at = Date.now(); WL.user = who;
  return items;
}
async function wlToggle(it) {
  let id = wlId(it);
  if (!id && it.ratingKey && !String(it.ratingKey).startsWith('wo-')) {
    try { id = wlId(((await api('/library/metadata/' + it.ratingKey)).Metadata || [])[0]); } catch (e) { /* none */ }
  }
  if (!id) { toast(t('wlNoMatch'), 5000); return; }
  const on = WL.ids.has(id);
  try {
    await wlCall(on ? '/actions/removeFromWatchlist' : '/actions/addToWatchlist', { ratingKey: id }, 'PUT');
    if (on) WL.ids.delete(id); else WL.ids.add(id);
    WL.at = 0;
    toast(t(on ? 'wlRemoved' : 'wlAdded', { s: it.title || '' }), 3500);
    if (current && current.fn === viewHome) {
      /* stay where you were: the card you held OK on (the next one moves into its place) */
      const keep = modalReturn && document.contains(modalReturn) ? modalReturn : focused;
      current.focusKey = (keep && keep.dataset.key) || null;
      run();
    }
  } catch (e) { toast(t('wlFailed') + (e.status ? ' (' + e.status + ')' : ''), 6000); }
}
/* the row for hold-OK menus on movies and shows */
function wlRow(it) {
  if (!it || it.virtual || (it.type !== 'movie' && it.type !== 'show')) return '';
  const on = WL.ids.has(wlId(it));
  return optionRow('cx-wl', t(on ? 'wlRemove' : 'wlAdd'), [], on, A(() => { closeModal(true); wlToggle(it); }), t('wlSub'));
}
/* a title that isn't in your library: what Plex knows about it */
function wlInfo(w) {
  const prevArt = modalArt; modalArt = w.thumb || prevArt;
  gradSheet(openModal(sheetHeader(w.title || '', [w.year, w.type === 'show' ? t('shows') : t('movies')].filter(Boolean).join(' · ')) +
    '<div class="tags"><span class="tag">' + esc(t('notInLibrary').toUpperCase()) + '</span></div>' +
    (w.summary ? '<p class="sheettext">' + esc(w.summary) + '</p>' : '') +
    '<div class="optlist">' + optionRow('wl-tr', t('trailer'), [], false, A(() => { closeModal(true); wlTrailer(w); })) + optionRow('wl-rm', t('wlRemove'), [], false, A(() => { closeModal(true); wlToggle(w); })) + '</div>', 'wl-tr'));
  modalArt = prevArt;
}
/* a Watchlist title you don't have: its trailer from TMDB (found by Plex's ids, or by name and year) */
async function wlTrailer(w) {
  const isShow = w.type === 'show';
  let tid = tmdbIdOf(w);
  if (!tid && wlId(w)) { try { tid = tmdbIdOf((((await wlCall('/library/metadata/' + wlId(w), { includeGuids: 1 })).MediaContainer || {}).Metadata || [])[0]); } catch (e) { tid = 0; } }
  if (!tid && S.tmdb && w.title) {
    try { const j = await tmdbGet('/search/' + (isShow ? 'tv' : 'movie'), { query: w.title, year: isShow ? undefined : w.year, first_air_date_year: isShow ? w.year : undefined }); tid = ((j.results || [])[0] || {}).id || 0; } catch (e) { tid = 0; }
  }
  return tmdbTrailer(isShow, tid, w.title);
}
function watchlistHTML(x) {
  const items = x.watchlist || [];
  if (!items.length) return '';
  const own = new Map();
  (x.moviesAll || []).concat(x.showsAll || []).forEach((m) => { const id = wlId(m); if (id) own.set(id, m); });
  const cards = items.slice(0, 16).map((w, i) => {
    const m = own.get(wlId(w));
    const poster = m && m.thumb ? imgURL(m.thumb, 300, 450) : (w.thumb || '');
    return '<div class="card f' + (m ? '' : ' notown') + '" data-key="wl-' + i + '" data-act="' + A(() => (m ? openItem(m) : wlInfo(w))) + '" data-ctx="' + A(() => (m ? itemMenu(m) : wlInfo(w))) + '"><div class="imgwrap">' +
      (poster ? '<img class="img" loading="lazy" src="' + esc(poster) + '" alt="">' : '<div class="img"></div>') +
      (m ? (m.viewCount || (m.viewedLeafCount && m.viewedLeafCount >= m.leafCount) ? '<span class="watched">' + ICON.check + '</span>' : '') : '<span class="ghosttag">' + esc(t('notInLibrary')) + '</span>') + '</div>' +
      '<span class="t">' + esc((m && m.title) || w.title || '') + '</span><span class="s">' + esc([(m && m.year) || w.year, w.type === 'show' ? t('vsShowWord') : ''].filter(Boolean).join(' · ')) + '</span></div>';
  }).join('');
  return '<section class="hub"><div class="hubhead"><h2>' + esc(t('wlTitle')) + '</h2><span>' + esc(t('wlHead', { n: items.length })) + '</span></div><div class="hrow hide-scroll wlrow">' + cards + '</div></section>';
}

/* ---------- pinned favourite actors (per profile): they come first in the actor banner ---------- */
function pinActors() { return store.get(userKey('pinActors'), []) || []; }
function pinActorSet(list) { store.set(userKey('pinActors'), list); }
function isPinned(name) { return pinActors().some((a) => a.name === name); }
function pinToggle(a) {
  const list = pinActors();
  const i = list.findIndex((x) => x.name === a.name);
  if (i >= 0) list.splice(i, 1); else list.unshift({ name: a.name, id: a.id || '', thumb: a.thumb || '' });
  pinActorSet(list.slice(0, 30));
  toast(t(i >= 0 ? 'pinOff' : 'pinOn', { s: a.name }), 3000);
}
/* the banner's settings: pin the one shown, unpin, or pick from your most watched */
function abSettings(x, d) {
  const cur = x.actor && x.actor.who;
  const draw = (focusKey) => {
    const pins = pinActors();
    const top = (x.taste && x.taste.favs || []).slice(0, 20);
    const rows = [];
    if (cur) rows.push(optionRow('as-cur', t(isPinned(cur.name) ? 'pinUnpinThis' : 'pinThis', { s: cur.name }), [], isPinned(cur.name), A(() => { pinToggle(cur); draw('as-cur'); })));
    const body = '<span class="label">' + esc(t('pinPinned')) + '</span>' +
      (pins.length ? '<div class="optlist">' + pins.map((p, i) => optionRow('as-p' + i, p.name, [], true, A(() => { pinToggle(p); draw('as-p' + Math.max(0, i - 1)); }), t('pinTapToRemove'))).join('') + '</div>' : '<p class="sheettext small">' + esc(t('pinNone')) + '</p>') +
      '<span class="label">' + esc(t('pinFromTop')) + '</span><div class="optlist">' +
      top.filter((a) => !isPinned(a.name)).map((a, i) => optionRow('as-t' + i, a.name, [], false, A(() => { pinToggle(a); draw('as-t' + i); }), tasteTitlesText(a))).join('') + '</div>';
    gradSheet(openModal(sheetHeader(t('pinTitle'), '') + '<p class="sheettext small">' + esc(t('pinNote')) + '</p>' + (rows.length ? '<div class="optlist">' + rows.join('') + '</div>' : '') + body, focusKey || (rows.length ? 'as-cur' : null)));
    $('.modal', viewEl)._onclose = () => { x.actorPool = abPool(x.taste && x.taste.favs || []); };
  };
  draw();
}
/* pinned actors first (in random order), then your top ten */
function abPool(favs) {
  const rnd = (l) => l.map((f) => ({ f: f, r: Math.random() })).sort((a, b) => a.r - b.r).map((y) => y.f);
  const pins = pinActors().filter((p) => p.id);
  const pinned = rnd(pins.map((p) => Object.assign({ n: 0, films: null }, (favs || []).find((f) => f.name === p.name) || {}, p)));
  return pinned.concat(rnd((favs || []).slice(0, 10).filter((f) => !pins.some((p) => p.name === f.name))));
}

ICON.bookmark = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"></path><path d="M12 7v6M9 10h6"></path></svg>';
ICON.bookmarkOn = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"></path></svg>';
/* know the Watchlist on other pages too (the button on a title's page) */
setTimeout(() => { if (S.server && S.token) wlLoad().catch(() => {}); }, 4000);

/* the next six films with this actor (round again after the last ones) */
function abPage(x, d) {
  const a = x.actor;
  const pages = Math.ceil(a.items.length / 6);
  a.page = ((a.page || 0) + 1) % pages;
  const el = $('#abanner', viewEl);
  if (el) { el.outerHTML = actorBannerHTML(x, d); const b = $('[data-key="ab-page"]', viewEl); if (b) setFocus(b, true); }
}


/* ---------- Samsung TV: a row of posters on the TV's own home screen (Smart Hub preview) ----------
   Continue watching and the newest in the library, for the profile that used the app last. Samsung allows
   an update at most every 10 minutes; a tile opens the title here (or plays it). */
function tvPreviewUpdate(d) {
  try {
    if (!window.IS_TV || !window.tizen || !d) return;
    const last = store.get('tvPreviewAt2', 0) || 0;
    if (Date.now() - last < 10 * 60000) return;
    const poster = (it) => imgURL(it.type === 'episode' ? (it.grandparentThumb || it.parentThumb || it.thumb) : it.thumb, 300, 450);
    const tile = (it, play) => ({
      title: it.type === 'episode' ? (it.grandparentTitle || it.title) : it.title,
      subtitle: it.type === 'episode' ? epCode(it) : (it.year ? String(it.year) : ''),
      image_ratio: '2by3', image_url: poster(it), is_playable: !!play,
      action_data: JSON.stringify({ k: String(it.ratingKey), p: play ? 1 : 0 })
    });
    const cont = (d.deckAll || []).filter((it) => it.thumb || it.grandparentThumb).slice(0, 10).map((it) => tile(it, true));
    const fresh = (d.raMAll || []).concat(d.raSAll || []).filter((it) => !it.viewCount)
      .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)).slice(0, 10).map((it) => tile(it, false));
    const sections = [];
    if (cont.length) sections.push({ title: t('continue'), tiles: cont });
    if (fresh.length) sections.push({ title: t('recent'), tiles: fresh });
    if (!sections.length) return;
    const json = JSON.stringify({ sections: sections });
    const fail = (where, e) => { if (!tvPreviewWarned) { tvPreviewWarned = true; toast('Smart Hub: ' + where + ' – ' + ((e && (e.message || e.name)) || e), 8000); } };
    /* Samsung's way: hand the row to the app's small background service, which passes it on to the TV */
    let viaService = false;
    try {
      if (tizen.systeminfo.getCapability('http://tizen.org/feature/web.service')) {
        const ac = new tizen.ApplicationControl('http://tizen.org/appcontrol/operation/pick', null, 'image/jpeg', null,
          [new tizen.ApplicationControlData('caller', ['ForegroundApp']), new tizen.ApplicationControlData('preview', [json])]);
        tizen.application.launchAppControl(ac, tizen.application.getCurrentApplication().appInfo.packageId + '.service',
          () => { store.set('tvPreviewAt2', Date.now()); }, (e) => fail('service', e));
        viaService = true;
      }
    } catch (e) { fail('service', e); }
    /* and straight from the app as well, in case this TV takes it that way */
    if (window.webapis && webapis.preview) {
      try { webapis.preview.setPreviewData(json, () => { store.set('tvPreviewAt2', Date.now()); }, (e) => { if (!viaService) fail('preview', e); }); } catch (e) { if (!viaService) fail('preview', e); }
    }
  } catch (e) { /* not supported on this TV */ }
}
let tvPreviewWarned = false;
/* open what was picked in the Smart Hub row */
function tvDeepLinkGo() {
  const l = window.__deepLink;
  if (!l || !l.k || !S.server || !S.token) return false;
  window.__deepLink = null;
  try { if (l.p) go(viewPlayer, [l.k]); else go(viewDetails, [l.k]); } catch (e) { return false; }
  return true;
}
window.onDeepLink = () => { if (current && current.fn === viewHome) tvDeepLinkGo(); };

/* An actor's unwatched films here. Plex sometimes keeps the same person under several tags (one per metadata
   agent), so every tag id seen for that name is asked for, plus the films whose cast lists the name. */
/* every actor in a library (name, id), read once a session */
const abActors = {};
async function abActorIndex(sec) {
  const k = sec.key + '|' + (S.server ? S.server.id : '');
  if (abActors[k] && Date.now() - abActors[k].at < 6 * 3600000) return abActors[k].list;
  const r = await api('/library/sections/' + sec.key + '/actor');
  const list = (r.Directory || []).map((x) => {
    const id = /^\d+$/.test(String(x.key)) ? String(x.key) : ((/actor=(\d+)/.exec(x.fastKey || x.key || '') || [])[1] || '');
    return [fold(x.title), id];
  }).filter((x) => x[1]);
  abActors[k] = { at: Date.now(), list: list };
  return list;
}
async function abActorFilms(sec, f, moviesAll) {
  const ids = new Set(f.id ? [String(f.id)] : []);
  const nm = String(f.name || '').toLowerCase();
  try {
    const cs = castStore();
    Object.values(cs.c).forEach((cast) => (cast || []).forEach((r) => { if (r[1] && String(r[0]).toLowerCase() === nm) ids.add(String(r[1])); }));
  } catch (e) { /* no saved casts */ }
  (moviesAll || []).forEach((m) => (m.Role || []).forEach((r) => { if (r.id && String(r.tag).toLowerCase() === nm) ids.add(String(r.id)); }));
  /* Plex can have the same person under several ids (one per metadata source); the library's own list of actors
     has them all, so every one with this name is asked for */
  try { (await abActorIndex(sec)).forEach((x) => { if (x[0] === fold(f.name)) ids.add(x[1]); }); } catch (e) { /* the ids found above */ }
  let list = [];
  if (ids.size) {
    try { list = (await api('/library/sections/' + sec.key + '/all', { type: 1, actor: Array.from(ids).join(','), unwatched: 1 })).Metadata || []; } catch (e) { list = []; }
  }
  const seen = new Set(list.map((m) => String(m.ratingKey)));
  (moviesAll || []).forEach((m) => { if (!m.viewCount && !seen.has(String(m.ratingKey)) && (m.Role || []).some((r) => String(r.tag).toLowerCase() === nm)) { list.push(m); seen.add(String(m.ratingKey)); } });
  return list;
}

/* ---------- "Feel like binging?": a random collection back to back, as a timeline from now ---------- */
async function bingeLoad(sec, x, avoid) {
  if (!x.bingeColls) {
    const r = await api('/library/sections/' + sec.key + '/collections', { 'X-Plex-Container-Start': 0, 'X-Plex-Container-Size': 2000 });
    x.bingeColls = (r.Metadata || []).filter((c) => (c.childCount || 0) >= 2 && (c.childCount || 0) <= 12 && (!c.subtype || c.subtype === 'movie'));
    x.bingeShown = [];
  }
  let pool = x.bingeColls.filter((c) => !x.bingeShown.includes(c.ratingKey) && c.ratingKey !== avoid);
  if (!pool.length) { x.bingeShown = []; pool = x.bingeColls.filter((c) => c.ratingKey !== avoid); }
  let best = null;
  /* a few tries for one with something you haven't seen; otherwise take what came up */
  for (let i = 0; i < 5 && pool.length; i++) {
    const c = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    let items = [];
    try { items = ((await api('/library/collections/' + c.ratingKey + '/children', { 'X-Plex-Container-Start': 0, 'X-Plex-Container-Size': 50 })).Metadata || []).filter((m) => m.type === 'movie' && m.duration); } catch (e) { items = []; }
    if (items.length < 2) continue;
    const dt = (m) => m.originallyAvailableAt || String(m.year || 9999);
    items.sort((a, b) => (dt(a) < dt(b) ? -1 : dt(a) > dt(b) ? 1 : 0));
    const cand = { c: c, items: items, skipSeen: false };
    if (!best) best = cand;
    if (items.some((m) => !m.viewCount)) { best = cand; break; }
  }
  if (best) { x.bingeShown.push(best.c.ratingKey); x.binge = best; }
  return x.binge || null;
}

function bingeList(b) {
  const un = b.items.filter((m) => !m.viewCount);
  return b.skipSeen && un.length ? un : b.items;
}

function bingeHTML(x) {
  const b = x.binge;
  if (!b || !b.items.length) return '';
  const list = bingeList(b);
  const left = (m) => Math.max(60000, (m.duration || 0) - (m.viewCount ? 0 : (m.viewOffset || 0)));
  const now = Date.now();
  const total = list.reduce((s, m) => s + left(m), 0);
  const end = new Date(now + total);
  const pct = (ms) => Math.max(0, Math.min(100, ms / total * 100));
  /* a tick on the full hour, every one, two or three hours depending on how long it runs */
  const step = (total <= 6 * 3600000 ? 1 : total <= 12 * 3600000 ? 2 : 3) * 3600000;
  const ticks = [];
  const tk = new Date(now); tk.setMinutes(0, 0, 0); tk.setHours(tk.getHours() + 1);
  while (step > 3600000 && tk.getHours() % (step / 3600000)) tk.setHours(tk.getHours() + 1);
  for (let ts = tk.getTime(); ts < end.getTime(); ts += step) if ((ts - now) / total > 0.05 && (end - ts) / total > 0.05) ticks.push(ts);
  const nextDay = end.toDateString() !== new Date(now).toDateString();
  const unseen = b.items.filter((m) => !m.viewCount).length;
  let at = now;
  const blocks = list.map((m, i) => {
    const start = at; at += left(m);
    return '<div class="bgblk f' + (m.viewCount ? ' seen' : '') + '" data-key="bg-' + i + '" style="flex-grow: ' + Math.round(left(m) / 60000) + '"' +
      ' data-act="' + A(() => openItem(m)) + '" data-ctx="' + A(() => itemMenu(m)) + '">' +
      ((m.art || m.thumb) ? '<img loading="lazy" src="' + esc(imgURL(m.art || m.thumb, 640, 360)) + '" alt="">' : '') + '<i class="bgshade"></i>' +
      '<span class="bgtx"><small>' + esc(hhmm(new Date(start))) + '</small><b>' + esc(m.title) + '</b>' +
      '<em>' + esc([m.year, durText(left(m)), m.viewCount ? t('bingeSeen') : ''].filter(Boolean).join(' · ')) + '</em></span></div>';
  }).join('');
  const go1 = () => go(viewPlayer, [list[0].ratingKey, { queue: list.slice(1).map((m) => m.ratingKey) }]);
  return '<section class="hub binge" id="binge">' + (b.c.art ? '<div class="bgartw"><img class="bgart" src="' + esc(imgURL(b.c.art, 1280, 720)) + '" alt=""></div>' : '') +
    '<div class="hubhead"><h2>' + esc(t('bingeTitle')) + '</h2><span>' + esc(t('bingeSub')) + '</span></div>' +
    '<div class="bghead"><b>' + esc(b.c.title) + '</b><span>' + esc(t('bingeMeta', { n: list.length, d: durText(total) })) + ' · <strong>' +
      esc(t(nextDay ? 'bingeEndsTom' : 'bingeEnds', { t: hhmm(end) })) + '</strong></span></div>' +
    '<div class="tlaxis bgaxis"><span class="tlnow">' + esc(t('tlNow', { t: hhmm(new Date(now)) })) + '</span>' +
      ticks.map((ts) => '<span class="tltick" style="left: ' + pct(ts - now).toFixed(2) + '%">' + esc(hhmm(new Date(ts))) + '</span>').join('') +
      '<span class="tlend">' + esc(hhmm(end)) + '</span></div>' +
    '<div class="bgrow">' + ticks.map((ts) => '<i class="tlgrid" style="left: ' + pct(ts - now).toFixed(2) + '%"></i>').join('') + blocks + '</div>' +
    '<div class="tlfoot bgfoot"><button type="button" class="btn primary f" data-key="bg-play" data-act="' + A(go1) + '">' + ICON.play + esc(t('bingeStart')) + '</button>' +
      '<button type="button" class="btn f" data-key="bg-other" data-act="' + A(() => bingeOther(x)) + '">' + ICON.next + esc(t('bingeOther')) + '</button>' +
      (unseen && unseen < b.items.length ? '<button type="button" class="chip f' + (b.skipSeen ? ' on' : '') + '" data-key="bg-skip" data-act="' + A(() => { b.skipSeen = !b.skipSeen; bingeRedraw(x, 'bg-skip'); }) + '">' + (b.skipSeen ? ICON.check : '') + esc(t('bingeSkipSeen')) + '</button>' : '') +
      '<button type="button" class="btn ghostbtn f" data-key="bg-open" data-act="' + A(() => go(viewLibrary, [x.bingeSec, b.c])) + '">' + ICON.stack + esc(t('bingeOpen')) + '</button></div>' +
    '</section>';
}
function bingeRedraw(x, key) {
  const el = $('#binge', viewEl);
  if (!el) return;
  el.outerHTML = bingeHTML(x);
  const f = $('[data-key="' + key + '"]', viewEl);
  if (f) setFocus(f, true);
}
let bingeBusy = false;
async function bingeOther(x) {
  if (bingeBusy || !x.bingeSec) return;
  bingeBusy = true;
  const btn = $('[data-key="bg-other"]', viewEl); if (btn) btn.classList.add('busy');
  try { await bingeLoad(x.bingeSec, x, x.binge && x.binge.c.ratingKey); bingeRedraw(x, 'bg-other'); }
  catch (e) { toast(e.message || String(e)); }
  finally { bingeBusy = false; const b2 = $('[data-key="bg-other"]', viewEl); if (b2) b2.classList.remove('busy'); }
}
