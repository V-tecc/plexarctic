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
function actorBannerHTML(x, d) {
  const a = x.actor;
  const items = a.items.slice(0, 6);
  const first = items[0];
  const pool = x.actorPool || [];
  const ini = a.name.split(' ').map((w) => w[0]).join('').slice(0, 2);
  return '<section class="abanner" id="abanner">' +
    '<img class="abart" id="abart" src="' + esc(first && first.art ? imgURL(first.art, 1600, 900) : '') + '" alt="">' +
    '<div class="abshade"></div>' +
    '<div class="abwho">' + (a.who && a.who.thumb ? '<img class="abface" src="' + esc(imgURL(a.who.thumb, 400, 400)) + '" alt="">' : '<span class="abface ini">' + esc(ini) + '</span>') +
    '<div class="abtx"><span class="eyebrow">' + esc(t('abEyebrow')) + '</span><h2>' + esc(t('abMore')) + '<br>' + esc(a.name) + '</h2>' +
    '<span class="absub">' + esc(t('tasteActorSub2', { s: tasteTitlesText(a.who) })) + '</span></div></div>' +
    '<div class="absel" id="absel">' + abSelHTML(first) + '</div>' +
    '<div class="abrow">' + items.map((m, i) => '<div class="abcard f" data-key="ab-' + i + '" data-act="' + A(() => openItem(m)) + '" data-ctx="' + A(() => itemMenu(m)) + '" data-onfocus="' + A(() => abSelect(m)) + '">' +
      '<img loading="lazy" src="' + esc(imgURL(m.thumb, 300, 450)) + '" alt="' + esc(m.title) + '"></div>').join('') +
    (pool.length > 1 ? '<div class="abnav"><span class="abdots">' + pool.map((_, i) => '<i class="' + (i === x.actorPos ? 'on' : '') + '"></i>').join('') + '</span>' +
      '<button type="button" class="btn ghostbtn f" data-key="ab-next" data-act="' + A(() => abNext(x, d)) + '">' + esc(t('abSwitch')) + ICON.next + '</button></div>' : '') +
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
      try { list = (await api('/library/sections/' + d.movieSec.key + '/all', { type: 1, actor: f.id, unwatched: 1 })).Metadata || []; } catch (e) { list = []; }
      list = tasteSort(list, x.taste);
      if (list.length >= 2) {
        x.actor = { name: f.name, n: f.n, who: f, items: list.slice(0, 8) };
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
  const list = x.fits.slice(0, 6).slice().sort((a, b) => a.duration - b.duration);
  const pct = (ms) => Math.max(0, Math.min(100, ms / total * 100));
  /* a tick on every half hour */
  const ticks = [];
  const tk = new Date(now); tk.setSeconds(0, 0); tk.setMinutes(tk.getMinutes() < 30 ? 30 : 60);
  for (let ts = tk.getTime(); ts < end - 10 * 60000; ts += 30 * 60000) ticks.push(ts);
  return '<section class="hub fitstl"><div class="hubhead"><h2>' + esc(t('fitsBefore', { t: hhmm(new Date(end)) })) + '</h2><span>' + esc(t('fitsTlSub')) + '</span></div>' +
    '<div class="tlaxis"><span class="tlnow">' + esc(t('tlNow', { t: hhmm(new Date(now)) })) + '</span>' +
    ticks.map((ts) => '<span class="tltick" style="left: ' + pct(ts - now).toFixed(2) + '%">' + esc(hhmm(new Date(ts))) + '</span>').join('') +
    '<span class="tlend">' + esc(hhmm(new Date(end))) + '</span></div>' +
    '<div class="tllanes">' + ticks.map((ts) => '<i class="tlgrid" style="left: ' + pct(ts - now).toFixed(2) + '%"></i>').join('') + '<i class="tlendline"></i>' +
    list.map((m, i) => '<div class="tlbar f" data-key="fit-' + i + '" style="width: ' + pct(m.duration).toFixed(2) + '%" data-act="' + A(() => openItem(m)) + '" data-ctx="' + A(() => itemMenu(m)) + '">' +
      '<img loading="lazy" src="' + esc(imgURL(m.thumb, 80, 120)) + '" alt="">' +
      '<span class="tltx"><b>' + esc(m.title) + '</b><small>' + esc([durText(m.duration), rateOf(m) ? '★ ' + rateOf(m).toFixed(1) : ''].filter(Boolean).join(' · ')) + '</small></span>' +
      '<span class="tlendt">' + esc(hhmm(new Date(now + m.duration))) + '</span></div>').join('') +
    '</div></section>';
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
