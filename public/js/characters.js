// 이불을 뒤집어쓴 동물 승객 (그림책 느낌, 캔버스로 직접 그림 · 외부 이미지 없음)
// 뒷모습: 이불을 머리끝까지 덮고 귀만 쏙 내민 채 해를 바라봄. 손에 든 코코아에서 김이 피어오름.
// 정면: 이불 후드 속 얼굴과 코코아 컵 (캐릭터 고르기·승차권용)

export const CHAR_LIST = [
  { key: 'otter', name: '졸린 수달' },
  { key: 'penguin', name: '아기 펭귄' },
  { key: 'rabbit', name: '이불 토끼' },
  { key: 'bear', name: '꼬마 곰' },
  { key: 'cat', name: '귤 고양이' },
];

// 이불 색 (바탕, 뜨개 무늬) - 따뜻한 파스텔
export const BLANKETS = [
  ['#e9897e', '#f7d3c4'],
  ['#8fa8de', '#dfe7fb'],
  ['#8cc3a4', '#e1f3e6'],
  ['#f1c46b', '#fff0c9'],
  ['#b9a0e0', '#ece2fb'],
  ['#f2a7c0', '#ffe4ee'],
  ['#7fc0cf', '#dcf3f6'],
  ['#c9b8a6', '#f6efe6'],
];

const FUR = {
  otter: { main: '#9a6a4f', light: '#e6c9a8', inner: '#c98f74', dark: '#5e3f2e' },
  penguin: { main: '#3b4660', light: '#fbf8f2', inner: '#f2a65a', dark: '#232a3b' },
  rabbit: { main: '#f6ece2', light: '#ffffff', inner: '#f5bcc4', dark: '#b9a593' },
  bear: { main: '#b07a52', light: '#edcfac', inner: '#d39f7c', dark: '#6d4529' },
  cat: { main: '#f2b066', light: '#fff1dc', inner: '#f6c1b0', dark: '#b8753a' },
};

// ---------- 색 도우미 ----------
function hexRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function tone(h, amt) {
  // amt > 0 밝게, < 0 어둡게
  const [r, g, b] = hexRgb(h);
  const f = (c) => Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
}
function softFill(ctx, x, y, r, base, lightDir = -1) {
  // 위쪽(빛 방향)이 밝고 가장자리가 살짝 어두운 그라데이션
  const g = ctx.createRadialGradient(x + lightDir * r * 0.3, y - r * 0.45, r * 0.1, x, y, r * 1.25);
  g.addColorStop(0, tone(base, 0.22));
  g.addColorStop(0.6, base);
  g.addColorStop(1, tone(base, -0.14));
  return g;
}

// ---------- 귀 ----------
function drawEars(ctx, type, x, hy, hr, fur, line, lw) {
  ctx.lineWidth = lw;
  ctx.strokeStyle = line;
  ctx.lineJoin = 'round';
  const pair = (fn) => [-1, 1].forEach(fn);
  if (type === 'rabbit') {
    pair((sg) => {
      const ex = x + sg * hr * 0.42;
      const ey = hy - hr * 1.45;
      const rot = sg * 0.22;
      ctx.fillStyle = softFill(ctx, ex, ey, hr * 0.7, fur.main);
      ellipse(ctx, ex, ey, hr * 0.27, hr * 0.78, rot);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = fur.inner;
      ellipse(ctx, ex + sg * hr * 0.02, ey + hr * 0.08, hr * 0.12, hr * 0.52, rot);
      ctx.fill();
    });
  } else if (type === 'bear' || type === 'otter') {
    const r = type === 'bear' ? 0.3 : 0.2;
    pair((sg) => {
      const ex = x + sg * hr * 0.66;
      const ey = hy - hr * 0.78;
      ctx.fillStyle = fur.main;
      ellipse(ctx, ex, ey, hr * r, hr * r);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = fur.inner;
      ellipse(ctx, ex, ey + hr * 0.03, hr * r * 0.55, hr * r * 0.55);
      ctx.fill();
    });
  } else if (type === 'cat') {
    pair((sg) => {
      ctx.fillStyle = fur.main;
      ctx.beginPath();
      ctx.moveTo(x + sg * hr * 0.2, hy - hr * 0.9);
      ctx.quadraticCurveTo(x + sg * hr * 0.6, hy - hr * 1.5, x + sg * hr * 0.82, hy - hr * 1.32);
      ctx.quadraticCurveTo(x + sg * hr * 0.92, hy - hr * 0.9, x + sg * hr * 0.86, hy - hr * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = fur.inner;
      ctx.beginPath();
      ctx.moveTo(x + sg * hr * 0.38, hy - hr * 0.95);
      ctx.quadraticCurveTo(x + sg * hr * 0.62, hy - hr * 1.32, x + sg * hr * 0.76, hy - hr * 1.2);
      ctx.lineTo(x + sg * hr * 0.74, hy - hr * 0.8);
      ctx.closePath();
      ctx.fill();
    });
  }
}

// 이불 실루엣: 머리를 덮는 둥근 지붕 + 아래로 퍼지는 종 모양 + 물결 밑단
function blanketPath(ctx, x, y, s, hy, hr) {
  const R = hr * 1.14;
  const w = s * 0.64;
  ctx.beginPath();
  ctx.moveTo(x - w, y - s * 0.02);
  ctx.bezierCurveTo(x - w * 1.08, y - s * 0.3, x - R * 1.18, hy + R * 0.75, x - R, hy + R * 0.05);
  ctx.arc(x, hy + R * 0.05, R, Math.PI, 0);
  ctx.bezierCurveTo(x + R * 1.18, hy + R * 0.75, x + w * 1.08, y - s * 0.3, x + w, y - s * 0.02);
  // 물결 밑단
  const n = 5;
  for (let i = n; i > 0; i--) {
    const x1 = x - w + ((i - 0.5) / n) * 2 * w;
    const x0 = x - w + ((i - 1) / n) * 2 * w;
    ctx.quadraticCurveTo(x1, y + s * 0.06, x0, y - s * 0.02);
  }
  ctx.closePath();
}

function drawBlanket(ctx, x, y, s, hy, hr, color, lightX) {
  const [base, knit] = BLANKETS[color % BLANKETS.length];
  ctx.save();
  blanketPath(ctx, x, y, s, hy, hr);
  const g = ctx.createLinearGradient(x + lightX * s * 0.6, hy - hr, x - lightX * s * 0.6, y);
  g.addColorStop(0, tone(base, 0.18));
  g.addColorStop(0.55, base);
  g.addColorStop(1, tone(base, -0.12));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();
  // 뜨개 무늬: 물결 줄과 작은 점
  ctx.strokeStyle = knit;
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = Math.max(1, s * 0.045);
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const yy = y - s * (0.18 + i * 0.2);
    ctx.beginPath();
    for (let k = -6; k <= 6; k++) {
      const xx = x + k * s * 0.09;
      const yv = yy + (k % 2 ? s * 0.025 : -s * 0.025);
      if (k === -6) ctx.moveTo(xx, yv);
      else ctx.lineTo(xx, yv);
    }
    ctx.stroke();
  }
  ctx.fillStyle = knit;
  for (let k = -3; k <= 3; k++) {
    ellipse(ctx, x + k * s * 0.15, y - s * 0.08, s * 0.018, s * 0.018);
    ctx.fill();
  }
  ctx.restore();
}

function drawSteam(ctx, x, y, s, t, phase, alpha = 0.45, rgb = '255,255,255', rise = 0.45) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1, s * 0.04);
  for (let i = 0; i < 2; i++) {
    const p = ((t / 2200 + phase + i * 0.5) % 1 + 1) % 1; // 0→1 올라가며 사라짐
    ctx.strokeStyle = `rgba(${rgb},${alpha * (1 - p) * Math.min(1, p * 4)})`;
    const bx = x + i * s * 0.08;
    const by = y - p * s * rise;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.bezierCurveTo(bx - s * 0.06, by - s * 0.08, bx + s * 0.06, by - s * 0.14, bx, by - s * 0.22);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTail(ctx, type, x, y, s, t, phase, fur, line, lw) {
  if (type !== 'cat' && type !== 'otter') return;
  const sw = Math.sin(t / 700 + phase * 6) * s * 0.05;
  ctx.beginPath();
  if (type === 'cat') {
    ctx.moveTo(x + s * 0.42, y - s * 0.06);
    ctx.quadraticCurveTo(x + s * 0.86, y - s * 0.04, x + s * 0.78 + sw, y - s * 0.44);
  } else {
    ctx.moveTo(x + s * 0.44, y - s * 0.05);
    ctx.quadraticCurveTo(x + s * 0.76, y, x + s * 0.84 + sw, y - s * 0.14);
  }
  ctx.strokeStyle = line;
  ctx.lineWidth = s * (type === 'cat' ? 0.1 : 0.14) + lw * 2;
  ctx.stroke();
  ctx.strokeStyle = fur.main;
  ctx.lineWidth = s * (type === 'cat' ? 0.1 : 0.14);
  ctx.stroke();
}

// 등에 붙은 바느질 패치 (하트·별·달 중 하나)
function drawPatch(ctx, x, y, s, color, kind) {
  const [base, knit] = BLANKETS[color % BLANKETS.length];
  const px = x + s * 0.17;
  const py = y - s * 0.4;
  const r = s * 0.1;
  ctx.save();
  ctx.fillStyle = knit;
  ctx.strokeStyle = tone(base, -0.3);
  ctx.lineWidth = Math.max(1, s * 0.018);
  ctx.setLineDash([s * 0.03, s * 0.025]);
  ctx.beginPath();
  if (kind === 0) {
    ctx.moveTo(px, py + r * 0.9);
    ctx.bezierCurveTo(px - r * 1.4, py - r * 0.1, px - r * 0.6, py - r * 1.2, px, py - r * 0.45);
    ctx.bezierCurveTo(px + r * 0.6, py - r * 1.2, px + r * 1.4, py - r * 0.1, px, py + r * 0.9);
  } else if (kind === 1) {
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr);
    }
    ctx.closePath();
  } else {
    ctx.arc(px, py, r, 0.35 * Math.PI, 1.65 * Math.PI);
    ctx.arc(px + r * 0.45, py - r * 0.15, r * 0.8, 1.55 * Math.PI, 0.45 * Math.PI, true);
    ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * 캐릭터 그리기
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} o  { x, y(바닥), s(크기), type, color, facing:'back'|'front', arms:0~1, hop:0~1, rim:{x:-1|1, color, a}, t(ms) }
 */
export function drawCritter(ctx, o) {
  const { x, s, type = 'otter', color = 0, facing = 'back', arms = 0, hop = 0, rim, t = 0, noSteam = false } = o;
  const fur = FUR[type] || FUR.otter;
  const phase = (Math.abs(x) * 0.0137) % 1;
  const breathe = Math.sin(t / 1100 + phase * 6.28);
  const y = o.y - hop * s * 0.32;
  const hr = s * 0.4;
  const hy = y - s * 0.86 + breathe * s * 0.012 - arms * s * 0.04;
  const line = tone(BLANKETS[color % BLANKETS.length][0], -0.38);
  const lw = Math.max(1, s * 0.032);
  const lightX = rim && rim.a > 0.05 ? rim.x : -1;

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // 그림자
  ctx.fillStyle = 'rgba(40,20,10,0.16)';
  ellipse(ctx, x, o.y + s * 0.03, s * 0.56 * (1 - hop * 0.25), s * 0.08);
  ctx.fill();

  // 펭귄 발
  if (type === 'penguin') {
    ctx.fillStyle = fur.inner;
    for (const sg of [-1, 1]) {
      ellipse(ctx, x + sg * s * 0.2, o.y - s * 0.0, s * 0.11, s * 0.05);
      ctx.fill();
    }
  }

  // 만세 하는 앞발 (이불 옆으로)
  if (arms > 0) {
    for (const sg of [-1, 1]) {
      const ax = x + sg * s * (0.5 + 0.05 * arms);
      const ay = y - s * (0.55 + 0.55 * arms);
      ctx.fillStyle = BLANKETS[color % BLANKETS.length][0];
      ellipse(ctx, ax - sg * s * 0.02, ay + s * 0.14, s * 0.11, s * 0.2, sg * (0.6 - 0.45 * arms));
      ctx.fill();
      ctx.fillStyle = fur.main;
      ellipse(ctx, ax, ay - s * 0.02, s * 0.09, s * 0.09);
      ctx.fill();
    }
  }

  // 귀 (이불 구멍 밖으로 쏙)
  drawEars(ctx, type, x, hy, hr, fur, line, lw);

  if (facing === 'front') {
    drawFront(ctx, { x, y, s, hy, hr, fur, color, line, lw, type, t, phase, lightX });
  } else {
    drawBlanket(ctx, x, y, s, hy, hr, color, lightX);
    blanketPath(ctx, x, y, s, hy, hr);
    ctx.strokeStyle = line;
    ctx.lineWidth = lw;
    ctx.stroke();
    // 목 부분 이불 주름
    ctx.strokeStyle = tone(BLANKETS[color % BLANKETS.length][0], -0.22);
    ctx.lineWidth = lw * 0.9;
    ctx.beginPath();
    ctx.moveTo(x - hr * 0.8, hy + hr * 0.75);
    ctx.quadraticCurveTo(x, hy + hr * 1.05, x + hr * 0.8, hy + hr * 0.75);
    ctx.stroke();
    // 펭귄: 뜨개 방울
    if (type === 'penguin') {
      ctx.fillStyle = BLANKETS[color % BLANKETS.length][1];
      ellipse(ctx, x, hy - hr * 1.12, hr * 0.2, hr * 0.2);
      ctx.fill();
      ctx.strokeStyle = line;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
    drawPatch(ctx, x, y, s, color, Math.floor(phase * 3));
    drawTail(ctx, type, x, y, s, t, phase, fur, line, lw);
    // 코코아 김 (앞에서 피어올라 머리 옆으로 보임)
    if (!noSteam) drawSteam(ctx, x + hr * 1.05, hy + hr * 0.35, s, t, phase, 0.4);
  }

  // 해를 향한 쪽 테두리 빛 (역광)
  if (rim && rim.a > 0.01) {
    ctx.save();
    ctx.globalAlpha = rim.a;
    ctx.strokeStyle = rim.color;
    ctx.lineWidth = Math.max(1.2, s * 0.05);
    const R = hr * 1.14;
    const a0 = rim.x > 0 ? -0.62 * Math.PI : -1.0 * Math.PI;
    ctx.beginPath();
    ctx.arc(x, hy + R * 0.05, R, a0, a0 + 0.62 * Math.PI);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function drawFront(ctx, p) {
  const { x, y, s, hy, hr, fur, color, line, lw, type, t, phase, lightX } = p;
  // 이불 (후드처럼)
  drawBlanket(ctx, x, y, s, hy, hr, color, lightX);
  blanketPath(ctx, x, y, s, hy, hr);
  ctx.strokeStyle = line;
  ctx.lineWidth = lw;
  ctx.stroke();

  // 얼굴 (후드 구멍)
  const fr = hr * 0.84;
  const fy = hy + hr * 0.12;
  ctx.fillStyle = softFill(ctx, x, fy, fr, fur.main);
  ellipse(ctx, x, fy, fr, fr * 0.92);
  ctx.fill();
  ctx.strokeStyle = tone(BLANKETS[color % BLANKETS.length][0], -0.25);
  ctx.lineWidth = lw * 1.4;
  ctx.stroke();

  // 얼굴 무늬
  if (type === 'penguin') {
    ctx.fillStyle = fur.light;
    ctx.beginPath();
    ctx.moveTo(x, fy - fr * 0.35);
    ctx.bezierCurveTo(x - fr * 0.95, fy - fr * 0.85, x - fr * 0.95, fy + fr * 0.8, x, fy + fr * 0.85);
    ctx.bezierCurveTo(x + fr * 0.95, fy + fr * 0.8, x + fr * 0.95, fy - fr * 0.85, x, fy - fr * 0.35);
    ctx.fill();
  } else if (type !== 'rabbit') {
    ctx.fillStyle = fur.light;
    ellipse(ctx, x, fy + fr * 0.38, fr * 0.52, fr * 0.36);
    ctx.fill();
  }

  // 눈
  const ey = fy - fr * 0.02;
  const ex = fr * 0.4;
  ctx.fillStyle = '#2b1d16';
  ctx.strokeStyle = '#2b1d16';
  if (type === 'otter') {
    // 졸린 눈
    ctx.lineWidth = Math.max(1.2, s * 0.035);
    for (const sg of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(x + sg * ex, ey - fr * 0.04, fr * 0.13, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
  } else {
    for (const sg of [-1, 1]) {
      ellipse(ctx, x + sg * ex, ey, fr * 0.13, fr * 0.16);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ellipse(ctx, x + sg * ex - fr * 0.04, ey - fr * 0.06, fr * 0.05, fr * 0.05);
      ctx.fill();
      ellipse(ctx, x + sg * ex + fr * 0.04, ey + fr * 0.05, fr * 0.025, fr * 0.025);
      ctx.fill();
      ctx.fillStyle = '#2b1d16';
    }
  }

  // 코·입
  if (type === 'penguin') {
    ctx.fillStyle = fur.inner;
    ellipse(ctx, x, ey + fr * 0.26, fr * 0.13, fr * 0.08);
    ctx.fill();
  } else {
    ctx.fillStyle = type === 'rabbit' || type === 'cat' ? '#e98b8b' : '#3a2519';
    ellipse(ctx, x, ey + fr * 0.22, fr * 0.08, fr * 0.06);
    ctx.fill();
    ctx.strokeStyle = '#3a2519';
    ctx.lineWidth = Math.max(1, s * 0.022);
    ctx.beginPath();
    ctx.arc(x - fr * 0.07, ey + fr * 0.3, fr * 0.07, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.arc(x + fr * 0.07, ey + fr * 0.3, fr * 0.07, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
  }

  // 볼터치
  for (const sg of [-1, 1]) {
    const bx = x + sg * fr * 0.62;
    const by = ey + fr * 0.28;
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, fr * 0.2);
    g.addColorStop(0, 'rgba(255,120,120,0.55)');
    g.addColorStop(1, 'rgba(255,120,120,0)');
    ctx.fillStyle = g;
    ellipse(ctx, bx, by, fr * 0.2, fr * 0.14);
    ctx.fill();
  }

  // 코코아 컵과 앞발
  const cx = x;
  const cy = y - s * 0.28;
  const cw = s * 0.26;
  const ch = s * 0.22;
  ctx.fillStyle = '#fffaf2';
  ctx.beginPath();
  ctx.moveTo(cx - cw / 2, cy - ch / 2);
  ctx.lineTo(cx + cw / 2, cy - ch / 2);
  ctx.lineTo(cx + cw * 0.42, cy + ch / 2);
  ctx.quadraticCurveTo(cx, cy + ch * 0.62, cx - cw * 0.42, cy + ch / 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = line;
  ctx.lineWidth = lw;
  ctx.stroke();
  ctx.fillStyle = '#8a5a3c';
  ellipse(ctx, cx, cy - ch / 2, cw / 2, ch * 0.13);
  ctx.fill();
  ctx.fillStyle = '#f08a7a';
  ctx.fillRect(cx - cw * 0.3, cy - ch * 0.05, cw * 0.6, ch * 0.18);
  for (const sg of [-1, 1]) {
    ctx.fillStyle = fur.main;
    ellipse(ctx, cx + sg * cw * 0.55, cy + ch * 0.05, s * 0.075, s * 0.085);
    ctx.fill();
    ctx.strokeStyle = line;
    ctx.stroke();
  }
  drawSteam(ctx, cx + cw * 0.75, cy - ch * 0.3, s, t, phase, 0.5, '170,140,120', 0.12);
}

// 캐릭터 고르기·승차권용 정면 그림
export function renderPortrait(canvas, type, color, t = 0) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  drawCritter(ctx, { x: w / 2, y: h * 0.9, s: h * 0.56, type, color, facing: 'front', t });
}

// ---------- 빠르게 그리기 (장면용) ----------
// 캐릭터 몸통은 한 번만 그려 이미지로 저장해 두고, 매 프레임에는 붙이기만 합니다.
// 숨쉬기·만세·역광·김처럼 가벼운 움직임만 실시간으로 그립니다.
const spriteCache = new Map();
const SPRITE_W = 2.1; // 크기(s) 대비 이미지 너비
const SPRITE_H = 2.25; // 크기(s) 대비 이미지 높이 (토끼 귀 포함)
const SPRITE_FOOT = 0.2; // 바닥 아래 여유

function getSprite(type, color, s, dpr, bright = 1) {
  const sz = Math.max(6, Math.round(s));
  const b = Math.round(bright * 20) / 20; // 밝기는 0.05 단위로만 새로 그림
  const key = `${type}|${color}|${sz}|${dpr}|${b}`;
  let sp = spriteCache.get(key);
  if (sp) return sp;
  const c = document.createElement('canvas');
  c.width = Math.ceil(sz * SPRITE_W * dpr);
  c.height = Math.ceil(sz * SPRITE_H * dpr);
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  if (b < 0.999) g.filter = `brightness(${b})`;
  drawCritter(g, { x: (sz * SPRITE_W) / 2, y: sz * (SPRITE_H - SPRITE_FOOT), s: sz, type, color, facing: 'back', noSteam: true, t: 0 });
  sp = { canvas: c, sz };
  if (spriteCache.size > 600) spriteCache.clear();
  spriteCache.set(key, sp);
  return sp;
}

export function drawCritterFast(ctx, o) {
  const { x, s, type = 'otter', color = 0, arms = 0, hop = 0, rim, t = 0, steam = false, dpr = 1, bright = 1 } = o;
  const fur = FUR[type] || FUR.otter;
  const phase = (Math.abs(x) * 0.0137) % 1;
  const breathe = Math.sin(t / 1100 + phase * 6.28);
  const y = o.y - hop * s * 0.32;
  const sp = getSprite(type, color, s, dpr, bright);
  const k = s / sp.sz;
  const w = sp.sz * SPRITE_W * k;
  const h = sp.sz * SPRITE_H * k;
  // 만세 하는 앞발 (몸 뒤에서 솟아오름)
  if (arms > 0) {
    for (const sg of [-1, 1]) {
      const ax = x + sg * s * (0.5 + 0.05 * arms);
      const ay = y - s * (0.55 + 0.55 * arms);
      ctx.fillStyle = BLANKETS[color % BLANKETS.length][0];
      ellipse(ctx, ax - sg * s * 0.02, ay + s * 0.14, s * 0.11, s * 0.2, sg * (0.6 - 0.45 * arms));
      ctx.fill();
      ctx.fillStyle = fur.main;
      ellipse(ctx, ax, ay - s * 0.02, s * 0.09, s * 0.09);
      ctx.fill();
    }
  }
  // 숨쉬기: 아주 살짝 세로로 늘었다 줄었다
  const sy = 1 + breathe * 0.012;
  const foot = sp.sz * SPRITE_FOOT * k;
  ctx.drawImage(sp.canvas, x - w / 2, y + foot - h * sy, w, h * sy);
  const hr = s * 0.4;
  const hy = y - s * 0.86 * sy;
  if (rim && rim.a > 0.01) {
    ctx.save();
    ctx.globalAlpha = rim.a;
    ctx.strokeStyle = rim.color;
    ctx.lineWidth = Math.max(1.2, s * 0.05);
    ctx.lineCap = 'round';
    const R = hr * 1.14;
    const a0 = rim.x > 0 ? -0.62 * Math.PI : -1.0 * Math.PI;
    ctx.beginPath();
    ctx.arc(x, hy + R * 0.05, R, a0, a0 + 0.62 * Math.PI);
    ctx.stroke();
    ctx.restore();
  }
  if (steam) drawSteam(ctx, x + hr * 1.05, hy + hr * 0.35, s, t, phase, 0.4);
}

