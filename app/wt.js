/* PLEX:arctic — Watch Together.
   Built on Open Watch Party (https://openwatch.party), an open protocol with a free public relay for open-source
   apps. Everyone in a room plays their own copy of the title from their own Plex server; the relay keeps the copies
   in step (play, pause, seek). Rooms are joined with a 6-character code, such as K7M-Q2X.
   Works with other Open Watch Party apps too, such as Plezy. */
'use strict';

const WT_EXT = 'io.github.v-tecc.plexarctic';
const WT = { party: null, relays: null, detach: null, attachedRef: null, away: false, opening: false, video: null, lastNotice: '', lobby: null, invite: null };

function wtActive() { return !!(WT.party && WT.party.state && WT.party.state.connection !== 'ended' && WT.party.state.connection !== 'idle'); }
function wtCode() { try { return WT.party && WT.party.state.room ? OWP.formatCode(WT.party.state.room.code) : ''; } catch (e) { return ''; } }
function wtPeople() { const r = WT.party && WT.party.state.room; return r && r.participants ? r.participants : []; }
function wtName() { return String((S.user && S.user.title) || (S.account && S.account.title) || 'Plex').slice(0, 32) || 'Plex'; }

/* ---- describing a Plex item for the room ---- */
function wtIdsOf(m) {
  const ids = {};
  ((m && m.Guid) || []).forEach((g) => {
    const x = /^(imdb|tmdb|tvdb):\/\/(.+)$/.exec(g.id || '');
    if (x && !ids[x[1]]) ids[x[1]] = String(x[2]);
  });
  if (m && /^plex:\/\//.test(m.guid || '')) ids.plex = m.guid;
  return ids;
}
function wtText(s) { return String(s || '').replace(/[\u0000-\u001F\u007F-\u009F؜‎‏‪-‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').trim(); }
async function wtDescribe(m) {
  const full = ((await api('/library/metadata/' + m.ratingKey, { includeGuids: 1 })).Metadata || [])[0] || m;
  const part = full.Media && full.Media[0] && full.Media[0].Part && full.Media[0].Part[0];
  const ep = full.type === 'episode';
  const media = {
    kind: ep ? 'episode' : full.type === 'movie' ? 'movie' : 'video',
    title: wtText(full.title) || (ep ? 'Episode ' + (full.index || '') : 'Video'),
    durationMs: Math.max(1, Math.round(full.duration || (full.Media && full.Media[0] && full.Media[0].duration) || 1)),
    ext: { [WT_EXT]: { server: S.server.id, item: String(full.ratingKey) } }
  };
  const ids = wtIdsOf(full);
  if (Object.keys(ids).length) media.ids = ids;
  if (!ep && full.year) media.year = full.year;
  if (ep) {
    let show = null;
    try { show = ((await api('/library/metadata/' + full.grandparentRatingKey, { includeGuids: 1 })).Metadata || [])[0]; } catch (e) { /* titles only */ }
    media.series = { title: wtText(full.grandparentTitle) || 'Series' };
    if (show && show.year) media.series.year = show.year;
    const sids = wtIdsOf(show);
    if (Object.keys(sids).length) media.series.ids = sids;
    if (full.parentIndex >= 0) media.season = full.parentIndex;
    if (full.index >= 0) media.episode = full.index;
  }
  if (part) {
    const name = String(part.file || '').split(/[\\/]/).pop();
    media.file = {};
    if (part.size >= 0) media.file.sizeBytes = part.size;
    if (name && name !== '.' && name !== '..') media.file.name = wtText(name);
  }
  if (OWP.checkMedia(media) && media.file) { delete media.file.name; }
  if (OWP.checkMedia(media)) delete media.file;
  return media;
}

/* ---- finding our own copy of the room's title (the resolver) ---- */
let wtIndex = null;
async function wtLibrary() {
  if (wtIndex && Date.now() - wtIndex.at < 10 * 60000) return wtIndex;
  const byId = new Map(), byTitle = new Map();
  const secs = ((await api('/library/sections')).Directory || []).filter((s) => s.type === 'movie' || s.type === 'show');
  for (const s of secs) {
    const r = await api('/library/sections/' + s.key + '/all', { includeGuids: 1, 'X-Plex-Container-Start': 0, 'X-Plex-Container-Size': 20000 });
    (r.Metadata || []).forEach((it) => {
      const kind = s.type === 'movie' ? 'movie' : 'show';
      Object.entries(wtIdsOf(it)).forEach(([ns, v]) => byId.set(kind + ':' + ns + ':' + v, it));
      const k = kind + ':' + fold(it.title).replace(/[^a-z0-9]+/g, '');
      if (!byTitle.has(k)) byTitle.set(k, []);
      byTitle.get(k).push(it);
    });
  }
  wtIndex = { at: Date.now(), byId: byId, byTitle: byTitle };
  return wtIndex;
}
function wtCandidate(it) {
  const part = it.Media && it.Media[0] && it.Media[0].Part && it.Media[0].Part[0];
  const c = { id: String(it.ratingKey), ref: String(it.ratingKey), name: wtText(it.title) || String(it.ratingKey) };
  const dur = it.duration || (it.Media && it.Media[0] && it.Media[0].duration);
  if (dur) c.durationMs = Math.round(dur);
  if (part && part.size >= 0) c.sizeBytes = part.size;
  return c;
}
const wtResolver = {
  async resolve(media, signal) {
    const out = [];
    const add = (it) => { if (it && !out.some((c) => c.id === String(it.ratingKey))) out.push(wtCandidate(it)); };
    /* 1. same server as the one who shared it: the exact file (our own hint, or Plezy's) */
    const hint = (media.ext && (media.ext[WT_EXT] || media.ext['app.plezy'])) || null;
    if (hint && S.server && hint.server === S.server.id && /^\d+$/.test(String(hint.item || ''))) {
      try { add(((await api('/library/metadata/' + hint.item)).Metadata || [])[0]); } catch (e) { /* not reachable */ }
    }
    if (signal && signal.aborted) return out;
    const lib = await wtLibrary();
    const byIds = (kind, ids) => Object.entries(ids || {}).map(([ns, v]) => lib.byId.get(kind + ':' + ns + ':' + v)).filter(Boolean);
    const byName = (kind, title, year) => (lib.byTitle.get(kind + ':' + fold(title).replace(/[^a-z0-9]+/g, '')) || [])
      .filter((it) => !year || !it.year || Math.abs(it.year - year) <= 1);
    if (media.kind === 'movie' || media.kind === 'video') {
      byIds('movie', media.ids).forEach(add);
      if (!out.length) byName('movie', media.title, media.year).forEach(add);
    } else if (media.kind === 'episode' && media.series) {
      let shows = byIds('show', media.series.ids);
      if (!shows.length) shows = byName('show', media.series.title, media.series.year);
      for (const sh of shows.slice(0, 2)) {
        const eps = ((await api('/library/metadata/' + sh.ratingKey + '/allLeaves')).Metadata || []);
        eps.filter((e) => e.parentIndex === media.season && e.index === media.episode).forEach(add);
        if (!out.length && media.ids) eps.filter((e) => Object.entries(wtIdsOf(e)).some(([ns, v]) => media.ids[ns] === v)).forEach(add);
      }
    }
    return out;
  }
};

/* ---- the party ---- */
function wtNewParty() {
  if (WT.party) { try { WT.party.close(); } catch (e) { /* ignore */ } }
  WT.relays = WT.relays || OWP.Relays.public();
  const party = new OWP.WatchParty({ relays: WT.relays, client: 'PLEXarctic/' + VERSION, name: wtName(), resolver: wtResolver });
  WT.party = party; WT.detach = null; WT.attachedRef = null; WT.away = false;
  party.on('state', () => { wtOnState(); wtBadge(); wtLobbyRefresh(); });
  party.on('event', wtOnEvent);
  return party;
}
function wtErrText(e) {
  const code = e && e.code;
  const map = { unreachable: 'wtErrUnreachable', room_not_found: 'wtErrNoRoom', room_full: 'wtErrFull', room_locked: 'wtErrLocked', invalid_code: 'wtErrCode', relay_full: 'wtErrBusy', rate_limited: 'wtErrBusy' };
  return t(map[code] || 'wtErrOther') + (map[code] ? '' : code ? ' (' + code + ')' : '');
}
function wtOnEvent(ev) {
  if (!ev) return;
  if (ev.type === 'participantJoined' && ev.participant && WT.party && ev.participant.peerId !== WT.party.state.peerId) toast(t('wtJoined', { n: ev.participant.name }), 4000);
  else if (ev.type === 'participantLeft' && ev.participant) toast(t('wtLeftRoom', { n: ev.participant.name }), 4000);
  else if (ev.type === 'playBlocked') toast(t('wtPressPlay'), 5000);
  else if (ev.type === 'resolveFailed') toast(t('wtNotFound'), 7000);
  else if (ev.type === 'error' && ev.error) toast(wtErrText(ev.error), 5000);
  else if (ev.type === 'ended') {
    const r = ev.reason;
    if (r !== 'left') toast(t('wtEnded_' + r) !== 'wtEnded_' + r ? t('wtEnded_' + r) : t('wtEnded'), 6000);
    const d = WT.detach; WT.detach = null; WT.attachedRef = null;
    if (d) d().catch(() => {});
    wtBadge();
  }
}
/* the room has a title for us: open it in the player (unless we stepped away from the player on purpose) */
function wtOnState() {
  const st = WT.party && WT.party.state;
  if (!st) return;
  if (WT.lobby && st.isHost && st.room && st.room.phase === 'playing') {
    WT.lobby = null; wtDropInvite();
    if (document.getElementById('wtlobby')) closeModal(true);
  }
  if (st.mismatch) { WT.party.acceptMismatch(); toast(t('wtMismatch'), 5000); return; }
  if (st.match === 'unavailable' && st.media && WT.lastNotice !== 'na:' + st.media.title) { WT.lastNotice = 'na:' + st.media.title; toast(t('wtNotFoundTitle', { s: st.media.series ? st.media.series.title + ' · ' + st.media.title : st.media.title }), 8000); }
  const ref = st.choice && st.choice.ref;
  if (!ref || WT.away || String(ref) === String(WT.attachedRef) || WT.opening) return;
  /* already in the player with this file: just attach */
  if (current && current.fn === viewPlayer && String(current.args[0]) === String(ref)) {
    if (WT.video && document.contains(WT.video)) wtAttach(WT.video, ref);
    return; /* still opening the file: the player attaches itself when it's ready */
  }
  WT.opening = true;
  const at = WT.party.roomPositionMs();
  go(viewPlayer, [String(ref), { at: at != null ? at / 1000 : 0, wt: true }]);
  setTimeout(() => { WT.opening = false; }, 1500);
}
function wtAttach(video, ref) {
  if (!WT.party) return;
  const prev = WT.detach;
  WT.detach = OWP.attachVideo(WT.party, video, String(ref));
  WT.attachedRef = String(ref);
  if (prev) prev().catch(() => {});
}
/* called by the player once its <video> has the file open */
function wtOnPlayer(video, ratingKey) {
  WT.video = video;
  if (!wtActive()) return false;
  const ref = WT.party.state.choice && WT.party.state.choice.ref;
  if (ref && String(ref) === String(ratingKey)) {
    WT.away = false; wtAttach(video, ref);
    if (WT.lobby && WT.party.state.isHost) setTimeout(wtLobby, 400);
    else if (!WT.party.state.isHost && WT.party.state.room && WT.party.state.room.phase !== 'playing' && !(WT.party.state.room.positionMs > 0)) {
      const h = wtPeople().find((p) => p.host);
      if (h) toast(t('wtWaitHost', { n: h.name }), 6000);
    }
    return true;
  }
  return false;
}
/* called by the player when it closes */
function wtOnPlayerClosed(video) {
  if (WT.video === video) WT.video = null;
  if (!WT.detach) return;
  WT.away = true;
  const d = WT.detach; WT.detach = null; WT.attachedRef = null;
  d().catch(() => {});
}
/* is the player for this item in a room? (then it doesn't start playing by itself: the room decides) */
function wtControls(ratingKey) { return wtActive() && WT.party.state.choice && String(WT.party.state.choice.ref) === String(ratingKey); }

/* ---- starting, joining, leaving ---- */
async function wtTitleItem(item) {
  let it = item;
  if (it && (it.type === 'show' || it.type === 'season')) {
    try {
      const showKey = it.type === 'season' ? (it.parentRatingKey || it.ratingKey) : it.ratingKey;
      const all = ((await api('/library/metadata/' + showKey + '/allLeaves')).Metadata || []).slice().sort((a, b) => (a.parentIndex - b.parentIndex) || (a.index - b.index));
      it = all.find((e) => e.viewOffset) || all.find((e) => !e.viewCount) || all[0];
    } catch (e) { it = null; }
  }
  return it;
}
/* start a room for this title; with invitees, the host waits in the lobby and starts when everyone is ready */
async function wtHost(item, invitees) {
  if (!window.OWP) { toast(t('wtErrOther'), 5000); return; }
  const it = await wtTitleItem(item);
  if (!it) { toast(t('noFile'), 4000); return; }
  toast(t('wtCreating'), 3000);
  try {
    const media = await wtDescribe(it);
    const party = (wtActive() && WT.party.state.isHost) ? WT.party : wtNewParty();
    if (!party.state.room) await party.create();
    party.setMedia(media, String(it.ratingKey), Math.round(it.viewOffset || 0));
    WT.away = false;
    if (invitees && invitees.length) {
      WT.lobby = { users: invitees, title: wtTitleOf(media) };
      try { await wtSendInvite(party.state.room.code, it, invitees); toast(t('wtInvitesSent'), 3000); } catch (e) { toast(t('wtInviteFailed'), 7000); WT.lobby = null; wtPanel(); return; }
      /* the lobby opens over the player; if the file is slow to open, don't wait for it */
      setTimeout(() => { if (WT.lobby && !document.getElementById('wtlobby') && !modalOpen()) wtLobby(); }, 2500);
    } else wtPanel();
  } catch (e) { toast(wtErrText(e), 7000); }
}
async function wtStart(item) {
  if (!window.OWP) { toast(t('wtErrOther'), 5000); return; }
  let users = [];
  try { users = (await wtHomeUsers()).filter((u) => String(u.id) !== String(wtMyId())); } catch (e) { users = []; }
  if (!users.length) { wtHost(item); return; }
  const picked = new Set();
  const draw = (msg, keep) => {
    gradSheet(openModal(sheetHeader(t('wtWho'), '') +
      '<p class="sheettext">' + esc(t('wtWhoNote')) + '</p>' +
      '<div class="optlist">' + users.map((u) => optionRow('wtu-' + u.id, u.title || u.username || '?', [], picked.has(String(u.id)), A(() => {
        const id = String(u.id);
        if (picked.has(id)) picked.delete(id); else picked.add(id);
        draw('', 'wtu-' + u.id);
      }))).join('') + '</div>' +
      (msg ? '<p class="sheettext"><b>' + esc(msg) + '</b></p>' : '') +
      '<div class="optlist">' +
      optionRow('wt-invite', t('wtInviteBtn'), [], false, A(() => {
        if (!picked.size) { draw(t('wtPickSome'), 'wt-invite'); return; }
        closeModal(true);
        wtHost(item, users.filter((u) => picked.has(String(u.id))).map((u) => ({ id: String(u.id), name: u.title || u.username || '?' })));
      })) +
      optionRow('wt-code', t('wtCodeInstead'), [], false, A(() => { closeModal(true); wtHost(item); }), t('wtCodeInsteadNote')) +
      '</div><p class="sheettext small">' + esc(t('wtRelayNote')) + '</p>', keep || ('wtu-' + users[0].id)));
  };
  draw('');
}
async function wtJoin(code) {
  if (!window.OWP) { toast(t('wtErrOther'), 5000); return; }
  const party = wtNewParty();
  toast(t('wtJoining'), 3000);
  try {
    await party.join(code);
    closeModal(true);
    toast(t('wtJoinedRoom', { c: wtCode() }), 5000);
    if (party.state.match === 'searching' || !party.state.choice) wtPanel();
  } catch (e) { toast(wtErrText(e), 7000); wtPanel(); }
}
function wtLeave() {
  wtDropInvite();
  WT.lobby = null;
  const p = WT.party;
  WT.party = null;
  const d = WT.detach; WT.detach = null; WT.attachedRef = null;
  if (d) d().catch(() => {});
  if (p) { try { p.leave(); p.close(); } catch (e) { /* ignore */ } }
  toast(t('wtLeftYou'), 3000);
  wtBadge();
}

/* ---- the Watch Together panel: code to share, people, back to the room, leave / join with a code ---- */
function wtPanel() {
  const st = WT.party && WT.party.state;
  if (wtActive() && st.room && WT.lobby && st.isHost) { wtLobby(); return; }
  if (wtActive() && st.room) {
    const people = wtPeople();
    const media = st.media;
    const title = media ? (media.series ? media.series.title + ' · S' + media.season + ' E' + media.episode : media.title) : t('wtNoTitle');
    gradSheet(openModal(sheetHeader(t('wt'), st.isHost ? t('wtYouHost') : '') +
      '<div class="wtcode"><span class="label">' + esc(t('wtShare')) + '</span><b>' + esc(wtCode()) + '</b></div>' +
      '<p class="sheettext">' + esc(t('wtShareNote')) + '</p>' +
      '<span class="label">' + esc(t('wtNow')) + '</span><p class="sheettext" style="margin-top: -8px"><b>' + esc(title) + '</b>' +
      (st.match === 'unavailable' ? ' — ' + esc(t('wtNotFound')) : st.match === 'searching' ? ' — ' + esc(t('wtSearching')) : '') + '</p>' +
      '<span class="label">' + esc(t('wtPeopleN', { n: people.length })) + '</span><div class="wtpeople">' +
      people.map((p) => '<span class="tag' + (p.peerId === st.peerId ? ' strong' : '') + '">' + esc(p.name) + (p.client && !/^PLEXarctic\//.test(p.client) ? ' · ' + esc(String(p.client).split('/')[0]) : '') + '</span>').join('') + '</div>' +
      '<div class="optlist">' +
      (st.choice && WT.away ? optionRow('wt-back', t('wtBackToRoom'), [], false, A(() => { closeModal(true); WT.away = false; WT.attachedRef = null; wtOnState(); })) : '') +
      optionRow('wt-leave', t('wtLeave'), [], false, A(() => { closeModal(); wtLeave(); }), st.isHost ? t('wtLeaveHostNote') : '') +
      '</div>', st.choice && WT.away ? 'wt-back' : 'wt-leave'));
    return;
  }
  const draw = (msg) => {
    gradSheet(openModal(sheetHeader(t('wt'), '') +
      '<p class="sheettext">' + esc(t('wtIntro')) + '</p>' +
      '<span class="label">' + esc(t('wtJoinCode')) + '</span>' +
      '<div class="sline"><span class="sicon">' + ICON.search + '</span><input class="input f" id="wtq" data-key="wtq" type="text" spellcheck="false" autocomplete="off" autocapitalize="characters" maxlength="9" placeholder="K7M-Q2X"></div>' +
      (msg ? '<p class="sheettext"><b>' + esc(msg) + '</b></p>' : '') +
      '<div class="optlist">' + optionRow('wt-joinbtn', t('wtJoinBtn'), [], false, A(() => go2())) + '</div>' +
      '<p class="sheettext">' + esc(t('wtHowStart')) + '</p><p class="sheettext small">' + esc(t('wtRelayNote')) + '</p>', 'wtq'));
    const inp = $('#wtq');
    const go2 = () => {
      const v = (inp && inp.value || '').trim();
      if (v.replace(/[^0-9a-z]/gi, '').length < 6) { draw(t('wtErrCode')); return; }
      inp.blur();
      wtJoin(v);
    };
    if (inp) {
      inp.dataset.act = A(go2);
      inp.addEventListener('keydown', (e) => { if (e.keyCode === 65376) { e.preventDefault(); e.stopPropagation(); go2(); } });
      inp.addEventListener('input', () => { if (inp.value.replace(/[^0-9a-z]/gi, '').length >= 6) { inp.blur(); setFocus($('[data-key="wt-joinbtn"]')); } });
    }
  };
  draw('');
}
/* the small "Together · K7M-Q2X · 2" badge in the top bar and the player */
function wtBadge() {
  const on = wtActive() && WT.party.state.room;
  document.querySelectorAll('.wtbadge').forEach((b) => {
    b.hidden = !on;
    if (on) b.innerHTML = ICON.people + '<span>' + esc(wtCode()) + ' · ' + wtPeople().length + '</span>';
  });
}

/* ---- inviting people from the Plex Home, like the official app ----
   The invite is a short-lived playlist on the server owner's account: "Watch together · Viktor [K7MQ2X:123,456]".
   Every PLEX:arctic in the household looks for one addressed to its user every 20 seconds and offers to join.
   Plex carries the invite, so nothing but the watching itself goes over the Open Watch Party relay. */
const WT_INV = /^Watch together · (.*) \[([2-9A-HJKMNP-Z]{6}):([0-9,]+)\]$/;
let wtUsersCache = null;
async function wtHomeUsers() {
  if (!S.adminToken) return [];
  if (wtUsersCache && Date.now() - wtUsersCache.at < 30 * 60000) return wtUsersCache.list;
  const list = parseRecords(await fetchText(tvURL('/api/home/users', {}, S.adminToken), { timeout: 8000 }), 'User');
  wtUsersCache = { at: Date.now(), list: list };
  return list;
}
function wtMyId() {
  if (S.user && S.user.id) return String(S.user.id);
  const l = wtUsersCache && wtUsersCache.list;
  const a = l && l.find((u) => u.admin === '1' || u.admin === true || u.admin === 1);
  return a ? String(a.id) : '';
}
function wtTitleOf(media) { return media ? (media.series ? media.series.title + ' · S' + media.season + ' E' + media.episode : media.title) : ''; }
async function wtSendInvite(code, it, users) {
  await wtDropInvite();
  const title = 'Watch together · ' + wtName().replace(/[\[\]]/g, '') + ' [' + String(code).replace(/[^0-9A-Z]/gi, '').toUpperCase() + ':' + users.map((u) => u.id).join(',') + ']';
  const uri = 'server://' + S.server.id + '/com.plexapp.plugins.library/library/metadata/' + it.ratingKey;
  const j = await getJSON(ownerURL('/playlists', { type: 'video', title: title, smart: 0, uri: uri }), { method: 'POST' });
  const pl = ((j.MediaContainer || {}).Metadata || [])[0];
  if (!pl || !pl.ratingKey) throw new Error('no playlist');
  WT.invite = { key: String(pl.ratingKey), at: Date.now() };
}
async function wtDropInvite() {
  const inv = WT.invite;
  WT.invite = null;
  if (!inv) return;
  try { await fetch(ownerURL('/playlists/' + inv.key), { method: 'DELETE' }); } catch (e) { /* it ages out */ }
}
/* the host's lobby: who is invited, who has joined and is ready; Start plays for everyone */
function wtLobbyHTML() {
  const st = WT.party && WT.party.state;
  const people = wtPeople().filter((p) => !st || p.peerId !== st.peerId);
  const lob = WT.lobby || { users: [] };
  const fold2 = (x) => String(x || '').trim().toLowerCase();
  const rows = [];
  const seen = new Set();
  lob.users.forEach((u) => {
    const p = people.find((q) => fold2(q.name) === fold2(u.name));
    if (p) seen.add(p.peerId);
    const tag = !p ? t('wtInvited') : p.player === 'ready' ? t('wtReadyTag') : p.player === 'loading' || p.player === 'buffering' ? t('wtLoadingTag') : t('wtJoinedTag');
    rows.push('<div class="wtlrow' + (p ? ' in' : '') + '"><span class="nm">' + esc(u.name) + '</span><span class="tag">' + esc(tag) + '</span></div>');
  });
  people.filter((p) => !seen.has(p.peerId)).forEach((p) => {
    rows.push('<div class="wtlrow in"><span class="nm">' + esc(p.name) + '</span><span class="tag">' + esc(p.player === 'ready' ? t('wtReadyTag') : t('wtJoinedTag')) + '</span></div>');
  });
  const missing = lob.users.filter((u) => !people.some((q) => fold2(q.name) === fold2(u.name))).length;
  return { rows: rows.join(''), missing: missing };
}
function wtLobby() {
  if (!wtActive() || !WT.lobby) return;
  const st = WT.party.state;
  const l = wtLobbyHTML();
  const el = openModal(sheetHeader(t('wtLobby'), wtCode()) +
    '<span class="label">' + esc(t('wtNow')) + '</span><p class="sheettext" style="margin-top: -8px"><b>' + esc(WT.lobby.title || wtTitleOf(st.media) || t('wtNoTitleYet')) + '</b></p>' +
    '<span class="label" id="wtlcount">' + esc(t('wtPeopleN', { n: wtPeople().length })) + '</span><div class="wtlobby" id="wtlobby">' + l.rows + '</div>' +
    '<div class="optlist">' +
    optionRow('wt-start', t('wtStartAll'), [], false, A(wtStartRoom), l.missing ? t('wtStartWait', { n: l.missing }) : t('wtStartNote')) +
    optionRow('wt-leave', t('wtLeave'), [], false, A(() => { closeModal(); wtLeave(); }), t('wtLeaveHostNote')) +
    '</div><p class="sheettext small">' + esc(t('wtRelayNote')) + '</p>', 'wt-start');
  gradSheet(el);
  el.classList.add('wtlobbysheet');
}
function wtLobbyRefresh() {
  const box = document.getElementById('wtlobby');
  if (!box || !WT.lobby) return;
  const l = wtLobbyHTML();
  box.innerHTML = l.rows;
  const cnt = document.getElementById('wtlcount');
  if (cnt) cnt.textContent = t('wtPeopleN', { n: wtPeople().length });
  const small = document.querySelector('[data-key="wt-start"] small');
  if (small) small.textContent = l.missing ? t('wtStartWait', { n: l.missing }) : t('wtStartNote');
}
function wtStartRoom() {
  closeModal(true);
  WT.lobby = null;
  wtDropInvite();
  try { WT.party.play(); toast(t('wtStarted'), 2500); } catch (e) { toast(wtErrText(e), 5000); }
}
/* the invited side: look for an invite addressed to us */
const wtSeen = new Set();
let wtPolling = false;
async function wtCheckInvites() {
  if (wtPolling || !S.server || !S.adminToken || !window.OWP || document.hidden) return;
  if (wtActive() || modalOpen()) return;
  wtPolling = true;
  try {
    if (!wtUsersCache) await wtHomeUsers().catch(() => []);
    const me = wtMyId();
    if (!me) return;
    const j = await getJSON(ownerURL('/playlists', { playlistType: 'video' }), { timeout: 8000 });
    const now = Date.now() / 1000;
    for (const pl of ((j.MediaContainer || {}).Metadata || [])) {
      const m = WT_INV.exec(pl.title || '');
      if (!m) continue;
      const age = now - (pl.updatedAt || pl.addedAt || now);
      /* stale invites (a host that crashed) are cleaned up by whoever sees them */
      if (age > 2 * 3600) { fetch(ownerURL('/playlists/' + pl.ratingKey), { method: 'DELETE' }).catch(() => {}); continue; }
      if (age > 30 * 60 || wtSeen.has(String(pl.ratingKey)) || (WT.invite && WT.invite.key === String(pl.ratingKey))) continue;
      if (m[3].split(',').indexOf(me) < 0) continue;
      wtSeen.add(String(pl.ratingKey));
      let it = null;
      try { it = ((await getJSON(ownerURL('/playlists/' + pl.ratingKey + '/items'))).MediaContainer.Metadata || [])[0]; } catch (e) { /* title unknown */ }
      wtOfferInvite(m[1], m[2], it);
      break;
    }
  } catch (e) { /* try again next round */ }
  finally { wtPolling = false; }
}
function wtOfferInvite(from, code, it) {
  const title = it ? (it.type === 'episode' ? (it.grandparentTitle + ' · ' + epCode(it) + ' · ' + it.title) : it.title + (it.year ? ' (' + it.year + ')' : '')) : '';
  const prevArt = modalArt;
  if (it) modalArt = imgURL(it.type === 'episode' ? (it.grandparentThumb || it.thumb) : it.thumb, 440, 660) || null;
  const el = openModal(sheetHeader(t('wtInviteFrom', { n: from }), '') +
    (title ? '<p class="sheettext"><b>' + esc(title) + '</b></p>' : '') +
    '<div class="optlist">' +
    optionRow('wti-join', t('wtJoinNow'), [], false, A(() => { closeModal(true); wtJoin(code); })) +
    optionRow('wti-no', t('wtNoThanks'), [], false, A(() => closeModal())) +
    '</div><p class="sheettext small">' + esc(t('wtRelayNote')) + '</p>', 'wti-join');
  modalArt = prevArt;
  gradSheet(el);
  if (typeof playSoundCue === 'function') playSoundCue();
}
setInterval(wtCheckInvites, 20000);
setTimeout(wtCheckInvites, 6000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(wtCheckInvites, 1500); });
