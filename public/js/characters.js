// 떡 친구들: 한국 떡을 닮은 말랑한 캐릭터 (손그림 잉크 선 + 수채화 느낌, 캔버스로 직접 그림)
// 평소에는 바다를 바라보는 뒷모습, "와!"·해 뜨는 순간에는 뒤돌아 얼굴을 보여줌.

export const CHAR_LIST = [
  { key: 'baekseolgi', name: '백설기' },
  { key: 'injeolmi', name: '인절미' },
  { key: 'ssuk', name: '쑥떡' },
  { key: 'kkul', name: '꿀떡' },
  { key: 'heugimja', name: '흑임자' },
];

// 목도리 색 (바탕, 무늬)
export const BLANKETS = [
  ['#d9776b', '#f3c3b5'],
  ['#6f8fc9', '#c9d8f2'],
  ['#7fae8a', '#d2e8d5'],
  ['#e0b04e', '#f7e2ad'],
  ['#9b7fc4', '#ddd0ef'],
  ['#e58fae', '#f8d3e0'],
  ['#5aa5b3', '#c4e6ec'],
  ['#a58466', '#e6d4c1'],
];

const MOCHI = {
  baekseolgi: { fill: '#fbf7ee', shade: '#e8e0d0' },
  injeolmi: { fill: '#ecd29e', shade: '#d6b679', dots: '#b38d4f' },
  ssuk: { fill: '#c3d7a4', shade: '#a6c084' },
  kkul: { fill: '#f6c3cc', shade: '#e8a3b0' },
  heugimja: { fill: '#b9b4b7', shade: '#9d979b', dots: '#3c3537' },
};
const INK = '#4a352c';

// ---------- 도우미 ----------
function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
}
function rng(seed) {
  let r = seed >>> 0 || 1;
  return () => {
    r = (r * 1664525 + 1013904223) >>> 0;
    return r / 4294967296;
  };
}

// 떡 몸통 윤곽: 아래가 살짝 퍼진 찹쌀떡 모양, 손으로 그린 듯 미세하게 흔들림
function blobPoints(x, y, s, seed) {
  const R = rng(seed);
  const pts = [];
  const n = 40;
  const w = s * 0.5;
  const h = s * 0.39;
  const cy = y - h;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const sn = Math.sin(a);
    const rx = w * (sn > 0 ? 1.06 : 1);
    const ry = h * (sn > 0 ? 0.92 : 1.05);
    const j = 1 + (R() - 0.5) * 0.025;
    pts.push([x + Math.cos(a) * rx * j, cy + sn * ry * j]);
  }
  return pts;
}
function tracePts(ctx, pts) {
  ctx.beginPath();
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[i];
    const p1 = pts[(i + 1) % n];
    const mx = (p0[0] + p1[0]) / 2;
    const my = (p0[1] + p1[1]) / 2;
    if (i === 0) ctx.moveTo(mx, my);
    else ctx.quadraticCurveTo(p0[0], p0[1], mx, my);
  }
  const p0 = pts[0];
  const p1 = pts[1];
  ctx.quadraticCurveTo(p0[0], p0[1], (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2);
  ctx.closePath();
}

function inkStroke(ctx, s, alpha = 0.9) {
  ctx.strokeStyle = INK;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = Math.max(1, s * 0.026);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function watercolor(ctx, x, y, s, m, seed) {
  const cy = y - s * 0.42;
  const g = ctx.createRadialGradient(x - s * 0.12, cy - s * 0.15, s * 0.05, x, cy + s * 0.1, s * 0.62);
  g.addColorStop(0, m.fill);
  g.addColorStop(0.45, m.fill);
  g.addColorStop(1, m.shade);
  ctx.fillStyle = g;
  ctx.fill();
  const R = rng(seed + 99);
  ctx.save();
  ctx.clip();
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.08 + R() * 0.08})`;
    ellipse(ctx, x + (R() - 0.5) * s * 0.7, cy + (R() - 0.5) * s * 0.6, s * (0.08 + R() * 0.12), s * (0.05 + R() * 0.08), R() * 3);
    ctx.fill();
  }
  if (m.dots) {
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = m.dots;
      ctx.globalAlpha = 0.55 + R() * 0.3;
      ellipse(ctx, x + (R() - 0.5) * s * 0.85, cy + (R() - 0.5) * s * 0.75, s * 0.012, s * 0.009, R() * 3);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function topFeature(ctx, type, x, top, s) {
  ctx.lineWidth = Math.max(1, s * 0.028);
  ctx.strokeStyle = INK;
  if (type === 'ssuk') {
    ctx.beginPath();
    ctx.moveTo(x, top + s * 0.02);
    ctx.quadraticCurveTo(x + s * 0.01, top - s * 0.06, x + s * 0.02, top - s * 0.1);
    ctx.stroke();
    for (const sg of [-1, 1]) {
      ctx.fillStyle = '#7fa65a';
      ctx.beginPath();
      ctx.moveTo(x + s * 0.02, top - s * 0.09);
      ctx.quadraticCurveTo(x + sg * s * 0.1, top - s * 0.2, x + sg * s * 0.14, top - s * 0.1);
      ctx.quadraticCurveTo(x + sg * s * 0.07, top - s * 0.06, x + s * 0.02, top - s * 0.09);
      ctx.fill();
      ctx.stroke();
    }
  } else if (type === 'kkul') {
    ctx.fillStyle = '#f2d39b';
    ellipse(ctx, x, top + s * 0.01, s * 0.045, s * 0.025, 0.3);
    ctx.fill();
    ctx.stroke();
  } else if (type === 'baekseolgi') {
    ctx.fillStyle = '#8a5a44';
    ellipse(ctx, x + s * 0.05, top + s * 0.035, s * 0.035, s * 0.028, -0.4);
    ctx.fill();
  }
}

function scarf(ctx, x, y, s, color, back) {
  const [base, knit] = BLANKETS[color % BLANKETS.length];
  const ny = y - s * 0.33;
  const w = s * 0.5;
  ctx.save();
  ctx.lineWidth = Math.max(1, s * 0.028);
  ctx.strokeStyle = INK;
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.moveTo(x - w, ny - s * 0.02);
  ctx.quadraticCurveTo(x, ny + s * 0.08, x + w, ny - s * 0.02);
  ctx.lineTo(x + w * 0.97, ny + s * 0.08);
  ctx.quadraticCurveTo(x, ny + s * 0.18, x - w * 0.97, ny + s * 0.08);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = knit;
  ctx.lineWidth = Math.max(0.8, s * 0.016);
  for (let k = -3; k <= 3; k++) {
    const kx = x + k * w * 0.27;
    ctx.beginPath();
    ctx.moveTo(kx, ny + s * 0.02 - Math.abs(k) * s * 0.006);
    ctx.lineTo(kx + s * 0.015, ny + s * 0.1 - Math.abs(k) * s * 0.008);
    ctx.stroke();
  }
  const tx = back ? x + w * 0.35 : x + w * 0.55;
  ctx.fillStyle = base;
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, s * 0.028);
  ctx.beginPath();
  ctx.moveTo(tx - s * 0.06, ny + s * 0.1);
  ctx.lineTo(tx - s * 0.04, ny + s * 0.3);
  ctx.lineTo(tx + s * 0.07, ny + s * 0.29);
  ctx.lineTo(tx + s * 0.06, ny + s * 0.09);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = knit;
  ctx.lineWidth = Math.max(0.8, s * 0.014);
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    ctx.moveTo(tx - s * 0.035 + k * s * 0.035, ny + s * 0.29);
    ctx.lineTo(tx - s * 0.035 + k * s * 0.035, ny + s * 0.33);
    ctx.stroke();
  }
  ctx.restore();
}

function face(ctx, x, y, s, happy) {
  const cy = y - s * 0.56;
  const ex = s * 0.15;
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  ctx.lineCap = 'round';
  if (happy) {
    ctx.lineWidth = Math.max(1, s * 0.03);
    for (const sg of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(x + sg * ex, cy + s * 0.02, s * 0.045, 1.15 * Math.PI, 1.85 * Math.PI);
      ctx.stroke();
    }
  } else {
    for (const sg of [-1, 1]) {
      ellipse(ctx, x + sg * ex, cy, s * 0.04, s * 0.05);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ellipse(ctx, x + sg * ex - s * 0.012, cy - s * 0.018, s * 0.013, s * 0.013);
      ctx.fill();
      ctx.fillStyle = INK;
    }
  }
  ctx.lineWidth = Math.max(1, s * 0.022);
  ctx.beginPath();
  if (happy) {
    ctx.moveTo(x - s * 0.05, cy + s * 0.07);
    ctx.quadraticCurveTo(x, cy + s * 0.15, x + s * 0.05, cy + s * 0.07);
    ctx.closePath();
    ctx.fillStyle = '#c9655f';
    ctx.fill();
    ctx.stroke();
  } else {
    // 작은 반달 미소
    ctx.arc(x, cy + s * 0.055, s * 0.04, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
  }
  // 수채화처럼 번지는 동그란 볼터치
  for (const sg of [-1, 1]) {
    const bx = x + sg * s * 0.27;
    const by = cy + s * 0.07;
    const bg = ctx.createRadialGradient(bx, by, 0, bx, by, s * 0.08);
    bg.addColorStop(0, 'rgba(240,130,135,0.6)');
    bg.addColorStop(1, 'rgba(240,130,135,0)');
    ctx.fillStyle = bg;
    ellipse(ctx, bx, by, s * 0.08, s * 0.055);
    ctx.fill();
  }
}

// 손: 둥근 손바닥 + 작은 손가락 세 개 (끝이 바깥쪽을 향함)
function hand(ctx, cx, cy, s, ang, m) {
  const r = s * 0.075;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);
  ctx.fillStyle = m.fill;
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, s * 0.024);
  // 손가락 (손바닥 뒤에 먼저)
  for (let k = -1; k <= 1; k++) {
    const fa = k * 0.55;
    ellipse(ctx, Math.cos(fa) * r * 1.05, Math.sin(fa) * r * 1.05, r * 0.42, r * 0.34, fa);
    ctx.fill();
    ctx.stroke();
  }
  // 엄지
  ellipse(ctx, r * 0.15, -r * 0.95, r * 0.36, r * 0.3, -1.2);
  ctx.fill();
  ctx.stroke();
  // 손바닥
  ellipse(ctx, 0, 0, r, r * 0.9);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function arms(ctx, x, y, s, m, up) {
  for (const sg of [-1, 1]) {
    if (up) hand(ctx, x + sg * s * 0.52, y - s * 0.6, s, sg > 0 ? -1.1 : -2.04, m);
    else hand(ctx, x + sg * s * 0.42, y - s * 0.16, s, sg > 0 ? 0.35 : Math.PI - 0.35, m);
  }
}

/**
 * 떡 친구 그리기
 * o: { x, y(바닥), s(크기), type, color, facing:'back'|'front', happy, armsUp }
 */
export function drawCritter(ctx, o) {
  const { x, y, s, type = 'baekseolgi', color = 0, facing = 'back', happy = false, armsUp = false } = o;
  const m = MOCHI[type] || MOCHI.baekseolgi;
  const seed = Math.max(0, CHAR_LIST.findIndex((c) => c.key === type)) * 97 + color * 7 + 3;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.fillStyle = 'rgba(60,40,30,0.16)';
  ellipse(ctx, x, y + s * 0.01, s * 0.5, s * 0.06);
  ctx.fill();

  if (facing === 'front' && armsUp) arms(ctx, x, y, s, m, true);

  const pts = blobPoints(x, y, s, seed);
  tracePts(ctx, pts);
  watercolor(ctx, x, y, s, m, seed);
  tracePts(ctx, pts);
  inkStroke(ctx, s);
  ctx.save();
  ctx.translate(s * 0.006, -s * 0.004);
  tracePts(ctx, pts);
  inkStroke(ctx, s, 0.25);
  ctx.restore();

  topFeature(ctx, type, x, y - s * 0.8, s);
  scarf(ctx, x, y, s, color, facing === 'back');

  if (facing === 'front') {
    face(ctx, x, y, s, happy);
    if (!armsUp) arms(ctx, x, y, s, m, false);
  } else {
    ctx.strokeStyle = INK;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = Math.max(0.8, s * 0.02);
    ctx.beginPath();
    ctx.moveTo(x - s * 0.06, y - s * 0.06);
    ctx.quadraticCurveTo(x, y - s * 0.1, x + s * 0.06, y - s * 0.06);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// ---------- 빠르게 그리기 (장면용, 이미지 캐시) ----------
const spriteCache = new Map();
const SPRITE_W = 1.5;
const SPRITE_H = 1.35;
const SPRITE_FOOT = 0.12;

function getSprite(type, color, s, dpr, bright, variant) {
  const sz = Math.max(6, Math.round(s));
  const b = Math.round(bright * 20) / 20;
  const key = `${type}|${color}|${sz}|${dpr}|${b}|${variant}`;
  let sp = spriteCache.get(key);
  if (sp) return sp;
  const c = document.createElement('canvas');
  c.width = Math.ceil(sz * SPRITE_W * dpr);
  c.height = Math.ceil(sz * SPRITE_H * dpr);
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  if (b < 0.999) g.filter = `brightness(${b})`;
  const opt = { x: (sz * SPRITE_W) / 2, y: sz * (SPRITE_H - SPRITE_FOOT), s: sz, type, color };
  if (variant === 'cheer') Object.assign(opt, { facing: 'front', happy: true, armsUp: true });
  else Object.assign(opt, { facing: 'back' });
  drawCritter(g, opt);
  sp = { canvas: c, sz };
  if (spriteCache.size > 900) spriteCache.clear();
  spriteCache.set(key, sp);
  return sp;
}

function drawSteam(ctx, x, y, s, t, phase) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(0.8, s * 0.022);
  for (let i = 0; i < 2; i++) {
    const p = (((t / 2600 + phase + i * 0.5) % 1) + 1) % 1;
    ctx.strokeStyle = `rgba(255,255,255,${0.4 * (1 - p) * Math.min(1, p * 4)})`;
    const bx = x + i * s * 0.05;
    const by = y - p * s * 0.3;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.bezierCurveTo(bx - s * 0.04, by - s * 0.05, bx + s * 0.04, by - s * 0.09, bx, by - s * 0.14);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * 장면용: 평소 뒷모습, "와!"·축하 때는 뒤돌아 웃는 얼굴로 만세
 */
export function drawCritterFast(ctx, o) {
  const { x, s, type = 'baekseolgi', color = 0, arms = 0, hop = 0, rim, t = 0, steam = false, dpr = 1, bright = 1 } = o;
  const phase = (Math.abs(x * 7 + color * 13) % 100) / 100;
  const breathe = Math.sin(t / 1200 + phase * 6.28);
  const y = o.y - hop * s * 0.3;
  const variant = arms > 0 ? 'cheer' : 'back';
  const sp = getSprite(type, color, s, dpr, bright, variant);
  const k = s / sp.sz;
  const w = sp.sz * SPRITE_W * k;
  const h = sp.sz * SPRITE_H * k;
  const sy = 1 + breathe * 0.02;
  const sx = 1 - breathe * 0.012;
  const foot = sp.sz * SPRITE_FOOT * k;
  ctx.drawImage(sp.canvas, x - (w * sx) / 2, y + foot - h * sy, w * sx, h * sy);

  if (rim && rim.a > 0.01 && variant === 'back') {
    ctx.save();
    ctx.globalAlpha = rim.a;
    ctx.strokeStyle = rim.color;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, s * 0.03);
    const cy = y - s * 0.39 * sy;
    const a0 = rim.x > 0 ? -0.62 * Math.PI : -0.98 * Math.PI;
    ctx.beginPath();
    ctx.ellipse(x, cy, s * 0.5 * sx, s * 0.41 * sy, 0, a0, a0 + 0.6 * Math.PI);
    ctx.stroke();
    ctx.restore();
  }
}

// 캐릭터 고르기·승차권용: 노을빛 원 안에서 정면 얼굴
export function renderPortrait(canvas, type, color) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  const r = Math.min(w, h) * 0.48;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
  ctx.clip();
  const g = ctx.createLinearGradient(0, h / 2 - r, 0, h / 2 + r);
  g.addColorStop(0, '#f6d9c4');
  g.addColorStop(0.6, '#f2c2a6');
  g.addColorStop(0.61, '#c9dbe8');
  g.addColorStop(1, '#a9c3d8');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  drawCritter(ctx, { x: w / 2, y: h * 0.9, s: h * 0.72, type, color, facing: 'front' });
  ctx.restore();
}
