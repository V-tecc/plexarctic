/* PLEX:arctic — seasonal touches on the menus: snow at Christmas, pumpkins and bats at Halloween, sparkles at New Year,
   hearts on Valentine's Day, feathers at Easter, petals at Midsummer. Drawn on one canvas at half resolution and at most
   30 frames a second, so it stays light on older TVs; it stops during playback, in the screen saver and when the app is
   in the background. Settings → Seasonal effects (Automatic / Off, plus a preview of each). */
'use strict';

function seasonSetting() { return store.get('season', 'auto'); }
/* the season for a date, or null */
function seasonFor(d) {
  const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
  const md = m * 100 + day;
  if (md >= 1024 && md <= 1101) return 'halloween';
  if (md >= 1201 && md <= 1230) return 'christmas';
  if (md === 1231 || md <= 102) return 'newyear';
  if (md >= 213 && md <= 215) return 'valentine';
  /* Easter: Good Friday to Easter Monday (Gauss / Meeus) */
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, dd = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3),
    h = (19 * a + b - dd - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, mm = Math.floor((a + 11 * h + 22 * l) / 451),
    em = Math.floor((h + l - 7 * mm + 114) / 31), ed = ((h + l - 7 * mm + 114) % 31) + 1;
  const easter = new Date(y, em - 1, ed);
  const diff = Math.round((new Date(y, m - 1, day) - easter) / 86400000);
  if (diff >= -2 && diff <= 1) return 'easter';
  /* Midsummer: the Friday between 19 and 25 June, and the weekend */
  if (m === 6 && day >= 19 && day <= 27) { const fri = [19, 20, 21, 22, 23, 24, 25].find((x) => new Date(y, 5, x).getDay() === 5); if (day >= fri && day <= fri + 2) return 'midsummer'; }
  return null;
}
let seasonPreview = null;   /* a season picked in Settings to try out, until the app restarts */
function seasonNow() {
  if (seasonPreview) return seasonPreview;
  if (seasonSetting() === 'off') return null;
  return seasonFor(new Date());
}

const SEASON = { cv: null, ctx: null, kind: null, parts: [], last: 0, raf: 0, t0: 0, bats: [] };
const SEA_W = 960, SEA_H = 540;   /* half of the 1920 × 1080 stage, stretched by CSS */
const seaRnd = (a, b) => a + Math.random() * (b - a);

function seasonStart() {
  const kind = seasonNow();
  if (kind === SEASON.kind && SEASON.cv) return;
  seasonStop();
  if (!kind) return;
  const st = document.getElementById('stage');
  if (!st) return;
  const cv = document.createElement('canvas');
  cv.className = 'season'; cv.width = SEA_W; cv.height = SEA_H;
  st.insertBefore(cv, st.firstChild);   /* behind the page: only the background shows it, not the tiles */
  SEASON.cv = cv; SEASON.ctx = cv.getContext('2d'); SEASON.kind = kind; SEASON.t0 = performance.now();
  SEASON.parts = seasonParts(kind);
  SEASON.bats = [];
  SEASON.raf = requestAnimationFrame(seasonFrame);
}
function seasonStop() {
  cancelAnimationFrame(SEASON.raf);
  if (SEASON.cv) SEASON.cv.remove();
  if (SEASON.spider) { SEASON.spider.cv.remove(); SEASON.spider = null; }
  SEASON.ghosts = [];
  SEASON.cv = null; SEASON.ctx = null; SEASON.kind = null; SEASON.parts = [];
}

function seasonParts(kind) {
  const n = { christmas: 70, halloween: 0, newyear: 45, valentine: 16, easter: 22, midsummer: 26 }[kind] || 0;
  const out = [];
  for (let i = 0; i < n; i++) out.push(seasonNew(kind, true));
  return out;
}
const PASTEL = ['#F7A8C4', '#FFD86B', '#9AD8F0', '#B6E39A', '#C9A8F5', '#FFB37A'];
const PETAL = ['#FFFFFF', '#FFE9F2', '#FFD3E4', '#F9F3B5', '#D9C7FF'];
const LEAF = ['#C2571A', '#E0861F', '#8C3B12', '#D9A12B'];
function seasonNew(kind, anywhere) {
  const y = anywhere ? seaRnd(0, SEA_H) : -10;
  if (kind === 'christmas') return { x: seaRnd(0, SEA_W), y: y, r: seaRnd(0.6, 2.2), vy: seaRnd(0.25, 0.8), sw: seaRnd(0.3, 1.2), ph: seaRnd(0, 6.28), a: seaRnd(0.45, 0.9) };
  if (kind === 'halloween') return { x: seaRnd(0, SEA_W), y: y, s: seaRnd(4, 8), vy: seaRnd(0.3, 0.7), sw: seaRnd(0.4, 1.4), ph: seaRnd(0, 6.28), rot: seaRnd(0, 6.28), vr: seaRnd(-0.03, 0.03), c: LEAF[Math.floor(seaRnd(0, LEAF.length))] };
  if (kind === 'newyear') return { x: seaRnd(0, SEA_W), y: seaRnd(0, SEA_H * 0.85), r: seaRnd(0.8, 2), ph: seaRnd(0, 6.28), sp: seaRnd(0.02, 0.06), c: Math.random() < 0.7 ? '#FFD86B' : '#FFFFFF' };
  if (kind === 'valentine') return { x: seaRnd(0, SEA_W), y: anywhere ? seaRnd(0, SEA_H) : SEA_H + 10, s: seaRnd(4, 9), vy: -seaRnd(0.2, 0.5), sw: seaRnd(0.3, 1), ph: seaRnd(0, 6.28), a: seaRnd(0.35, 0.7) };
  if (kind === 'easter') return { x: seaRnd(0, SEA_W), y: y, s: seaRnd(5, 10), vy: seaRnd(0.25, 0.6), sw: seaRnd(0.6, 1.6), ph: seaRnd(0, 6.28), rot: seaRnd(0, 6.28), vr: seaRnd(-0.02, 0.02), c: PASTEL[Math.floor(seaRnd(0, PASTEL.length))] };
  if (kind === 'midsummer') return { x: seaRnd(0, SEA_W), y: y, s: seaRnd(3, 6), vy: seaRnd(0.3, 0.7), sw: seaRnd(0.4, 1.2), ph: seaRnd(0, 6.28), rot: seaRnd(0, 6.28), vr: seaRnd(-0.03, 0.03), c: PETAL[Math.floor(seaRnd(0, PETAL.length))] };
  return {};
}

/* nothing while a film plays, the screen saver is up or the app is in the background */
function seasonPaused() {
  if (document.hidden) return true;
  if (typeof saverOn !== 'undefined' && saverOn) return true;
  return !!(typeof current !== 'undefined' && current && typeof viewPlayer !== 'undefined' && current.fn === viewPlayer);
}

function seasonFrame(now) {
  SEASON.raf = requestAnimationFrame(seasonFrame);
  if (now - SEASON.last < 33) return;            /* about 30 frames a second */
  SEASON.last = now;
  const c = SEASON.ctx; if (!c) return;
  const paused = seasonPaused();
  SEASON.cv.style.visibility = paused ? 'hidden' : '';
  if (SEASON.spider) SEASON.spider.cv.style.visibility = paused ? 'hidden' : '';
  if (paused) return;
  c.clearRect(0, 0, SEA_W, SEA_H);
  const t = (now - SEASON.t0) / 1000;
  const k = SEASON.kind;
  SEASON.parts.forEach((p, i) => {
    if (k === 'newyear') {
      const a = 0.25 + 0.75 * Math.max(0, Math.sin(t * 2 + p.ph * 3));
      c.globalAlpha = a * 0.8; c.fillStyle = p.c;
      c.fillRect(p.x - p.r, p.y - 0.4, p.r * 2, 0.8); c.fillRect(p.x - 0.4, p.y - p.r, 0.8, p.r * 2);
      if (a > 0.95 && Math.random() < 0.01) { p.x = seaRnd(0, SEA_W); p.y = seaRnd(0, SEA_H * 0.85); }
      return;
    }
    p.y += p.vy; p.x += Math.sin(t * p.sw + p.ph) * 0.35;
    if (p.rot != null) p.rot += p.vr;
    if (p.y > SEA_H + 12 || p.y < -14) SEASON.parts[i] = seasonNew(k, false);
    if (k === 'christmas') { c.globalAlpha = p.a; c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 6.283); c.fill(); return; }
    if (k === 'valentine') { c.globalAlpha = p.a; seasonHeart(c, p.x, p.y, p.s); return; }
    c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.globalAlpha = k === 'midsummer' ? 0.75 : 0.8; c.fillStyle = p.c;
    c.beginPath();
    if (k === 'easter') { c.ellipse(0, 0, p.s * 0.28, p.s, 0, 0, 6.283); }        /* a feather */
    else if (k === 'midsummer') { c.ellipse(0, 0, p.s, p.s * 0.55, 0, 0, 6.283); } /* a petal */
    else { c.moveTo(0, -p.s); c.quadraticCurveTo(p.s * 0.9, 0, 0, p.s); c.quadraticCurveTo(-p.s * 0.9, 0, 0, -p.s); } /* a leaf */
    c.fill(); c.restore();
  });
  if (k === 'halloween') seasonHalloween(c, t);
  c.globalAlpha = 1;
}

function seasonHeart(c, x, y, s) {
  c.fillStyle = '#FF6F9C';
  c.beginPath();
  c.moveTo(x, y + s * 0.35);
  c.bezierCurveTo(x - s, y - s * 0.3, x - s * 0.45, y - s, x, y - s * 0.45);
  c.bezierCurveTo(x + s * 0.45, y - s, x + s, y - s * 0.3, x, y + s * 0.35);
  c.fill();
}

/* Halloween: bats now and then across the top, a ghost or two drifting by, a cobweb in the corner behind the logo,
   and a spider letting itself down on its thread onto the X of PLEX */
function seasonHalloween(c, t) {
  seasonCobweb(c);
  if (!SEASON.bats.length && Math.random() < 0.004) SEASON.bats.push({ x: -20, y: seaRnd(30, 140), v: seaRnd(1.4, 2.2), ph: seaRnd(0, 6) });
  SEASON.bats = SEASON.bats.filter((b) => b.x < SEA_W + 30);
  SEASON.bats.forEach((b) => {
    b.x += b.v; const yy = b.y + Math.sin(t * 3 + b.ph) * 8; const w = Math.sin(t * 18) * 5;
    c.globalAlpha = 0.85; c.fillStyle = '#0B0B0D';
    c.beginPath(); c.moveTo(b.x, yy);
    c.quadraticCurveTo(b.x - 6, yy - 4 - w, b.x - 13, yy - 1 + w * 0.3); c.quadraticCurveTo(b.x - 7, yy + 1, b.x, yy + 3);
    c.quadraticCurveTo(b.x + 7, yy + 1, b.x + 13, yy - 1 + w * 0.3); c.quadraticCurveTo(b.x + 6, yy - 4 - w, b.x, yy);
    c.fill();
  });
  /* ghosts: one at a time, now and then, from either side */
  SEASON.ghosts = SEASON.ghosts || [];
  if (SEASON.ghosts.length < 1 && Math.random() < 0.003) {
    const left = Math.random() < 0.5;
    SEASON.ghosts.push({ x: left ? -30 : SEA_W + 30, v: (left ? 1 : -1) * seaRnd(1.0, 1.6), y: seaRnd(30, 140), s: seaRnd(10, 14), ph: seaRnd(0, 6) });   /* across the screen like the bats */
  }
  SEASON.ghosts = SEASON.ghosts.filter((g) => g.x > -40 && g.x < SEA_W + 40);
  SEASON.ghosts.forEach((g) => { g.x += g.v; seasonGhost(c, g.x, g.y + Math.sin(t * 1.6 + g.ph) * 6, g.s, g.v < 0, t + g.ph); });
  seasonSpider(t);
}
function seasonGhost(c, x, y, s, flip, t) {
  c.save(); c.translate(x, y); if (flip) c.scale(-1, 1);
  c.globalAlpha = 0.55;
  c.fillStyle = '#F4F4F6';
  c.beginPath();
  c.moveTo(-s, 0); c.arc(0, 0, s, Math.PI, 0);
  c.lineTo(s, s * 1.3);
  /* a wavy hem that moves */
  for (let i = 0; i <= 4; i++) { const xx = s - i * (s / 2); c.lineTo(xx, s * 1.3 + (i % 2 ? -s * 0.22 : s * 0.12) + Math.sin(t * 4 + i) * s * 0.06); }
  c.lineTo(-s, s * 1.3); c.closePath(); c.fill();
  c.globalAlpha = 0.8; c.fillStyle = '#16161A';
  c.beginPath(); c.ellipse(-s * 0.35, -s * 0.1, s * 0.16, s * 0.24, 0, 0, 6.283); c.ellipse(s * 0.3, -s * 0.1, s * 0.16, s * 0.24, 0, 0, 6.283); c.fill();
  c.beginPath(); c.ellipse(0, s * 0.42, s * 0.14, s * 0.2, 0, 0, 6.283); c.fill();
  c.restore();
}
/* the web, in the top left corner behind the logo */
function seasonCobweb(c) {
  const R = 210, spokes = 7, rings = 7;
  c.save(); c.globalAlpha = 0.2; c.strokeStyle = '#E8E8EC'; c.lineWidth = 0.6;
  const ang = (k) => (k / (spokes - 1)) * (Math.PI / 2);
  c.beginPath();
  for (let k = 0; k < spokes; k++) { c.moveTo(0, 0); c.lineTo(Math.cos(ang(k)) * R, Math.sin(ang(k)) * R); }
  for (let r = 1; r <= rings; r++) {
    const rr = R * r / (rings + 0.6);
    for (let k = 0; k < spokes - 1; k++) {
      const a1 = ang(k), a2 = ang(k + 1), am = (a1 + a2) / 2, sag = rr * 0.86;
      c.moveTo(Math.cos(a1) * rr, Math.sin(a1) * rr);
      c.quadraticCurveTo(Math.cos(am) * sag, Math.sin(am) * sag, Math.cos(a2) * rr, Math.sin(a2) * rr);
    }
  }
  c.stroke(); c.restore();
}
/* the spider sits on its own small canvas above the page, hanging on its thread from the bottom of the X on Home */
function seasonSpider(t) {
  const logo = document.querySelector('#view .hlogo svg.logo');
  let sp = SEASON.spider;
  if (!logo) { if (sp) sp.cv.style.display = 'none'; return; }
  if (!sp) {
    const cv = document.createElement('canvas'); cv.className = 'season-spider'; cv.width = 40; cv.height = 110;
    document.getElementById('stage').appendChild(cv);
    sp = SEASON.spider = { cv: cv, ctx: cv.getContext('2d'), at: 0 };
  }
  /* the notch at the bottom of the X: about 60.6 % along the wordmark, 69 % down */
  if (!sp.at || t - sp.at > 2) {
    sp.at = t;
    const st = document.getElementById('stage').getBoundingClientRect(), r = logo.getBoundingClientRect(), k = 1920 / st.width;
    const xX = (r.left - st.left) * k + r.width * k * 0.6058, yX = (r.top - st.top) * k + r.height * k * 0.692;
    sp.cv.style.left = Math.round(xX - 20) + 'px'; sp.cv.style.top = Math.round(yX) + 'px';
  }
  sp.cv.style.display = '';
  const c = sp.ctx; c.clearRect(0, 0, 40, 110);
  /* lets itself down, sways a little, climbs back up under the X: a 16-second round */
  const ph = (t % 16) / 16;
  const drop = ph < 0.3 ? ph / 0.3 : ph < 0.7 ? 1 : ph < 0.92 ? 1 - (ph - 0.7) / 0.22 : 0;
  const ease = drop * drop * (3 - 2 * drop);
  const y = 14 + ease * 70;
  const sway = Math.sin(t * 1.3) * 2.5 * ease;
  const x = 20 + sway;
  c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 0.8;
  c.beginPath(); c.moveTo(20, 0); c.lineTo(x, y - 3); c.stroke();
  c.fillStyle = '#FFFFFF'; c.strokeStyle = '#FFFFFF'; c.lineWidth = 1; c.lineCap = 'round';
  const wig = Math.sin(t * 9) * 0.8;
  c.beginPath();
  [-1, 1].forEach((side) => {
    for (let i = 0; i < 4; i++) {
      const by = y - 1 + i * 1.5, ky = by - 2.5 + i * 1.4 + (i % 2 ? wig : -wig);
      c.moveTo(x + side * 2, by); c.quadraticCurveTo(x + side * (5 + i * 0.4), ky - 2, x + side * (7.5 + i * 0.3), ky + 3);
    }
  });
  c.stroke();
  c.beginPath(); c.ellipse(x, y + 2, 3, 3.8, 0, 0, 6.283); c.fill();   /* body */
  c.beginPath(); c.arc(x, y - 2.3, 2, 0, 6.283); c.fill();             /* head */
}

/* start when the app is up, and look again every hour (a new season can begin while it runs) */
setTimeout(seasonStart, 1500);
setInterval(seasonStart, 3600000);

/* Settings row */
function seasonSettingsHTML() {
  const cur = seasonSetting();
  const seg = '<div class="seg">' + [['auto', t('seasonAuto')], ['off', t('off')]].map((x) => '<button type="button" class="f' + (cur === x[0] && !seasonPreview ? ' on' : '') + '" data-key="sea-' + x[0] + '" data-act="' + A(() => { store.set('season', x[0]); seasonPreview = null; seasonStop(); seasonStart(); rerun(); }) + '">' + esc(x[1]) + '</button>').join('') + '</div>';
  const tries = ['halloween', 'christmas', 'newyear', 'valentine', 'easter', 'midsummer'].map((k) => '<button type="button" class="chip f' + (seasonPreview === k ? ' on' : '') + '" data-key="sea-p-' + k + '" data-act="' + A(() => { seasonPreview = seasonPreview === k ? null : k; seasonStop(); seasonStart(); rerun(); }) + '">' + esc(t('season_' + k)) + '</button>').join('');
  const now = seasonFor(new Date());
  return seg + '<div class="chips">' + tries + '</div><span class="sval">' + esc(now ? t('seasonNow', { s: t('season_' + now) }) : t('seasonNone')) + '</span>';
}
