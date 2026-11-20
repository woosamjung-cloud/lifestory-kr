// 해를 기다리는 사람들의 뒷모습 (어른 감성 일러스트, 캔버스로 직접 그림 · 외부 이미지 없음)
// 담요를 두르거나 후드·목도리·비니·코트 차림으로 바닷가에 앉아 있는 모습.
// 차분한 단색 옷, 옷 주름 음영, 종이 질감(그레인), 역광에 빛나는 윤곽선.

export const CHAR_LIST = [
  { key: 'blanket', name: '담요를 두른' },
  { key: 'hood', name: '후드를 쓴' },
  { key: 'scarf', name: '목도리를 한' },
  { key: 'beanie', name: '비니를 쓴' },
  { key: 'coat', name: '코트를 입은' },
];

// 옷 색 (바탕, 포인트) - 뮤트 톤
export const BLANKETS = [
  ['#b98580', '#e8cfc6'], // 더스티 로즈
  ['#7f9583', '#d9e2d3'], // 세이지
  ['#c2ad8f', '#efe5d4'], // 오트밀
  ['#3f4a63', '#b9c2d6'], // 네이비
  ['#b8934a', '#efd9a6'], // 머스터드
  ['#76596e', '#d8c4d0'], // 플럼
  ['#66737e', '#ccd5db'], // 슬레이트
  ['#9c7150', '#e4cdb6'], // 카멜
];

const HAIR = ['#2a211d', '#3a2b23', '#1e1a19', '#4a3428', '#2f2420'];
const SKIN = '#e9c8b0';

// ---------- 색 도우미 ----------
function hexRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function tone(h, amt, a = 1) {
  const [r, g, b] = hexRgb(h);
  const f = (c) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt))));
  return a < 1 ? `rgba(${f(r)},${f(g)},${f(b)},${a})` : `rgb(${f(r)},${f(g)},${f(b)})`;
}
function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
}

// 사람 한 명의 기준 치수
function geom(x, y, s, breathe = 0) {
  const headR = s * 0.2;
  const headY = y - s * 0.95 + breathe * s * 0.008;
  return {
    headR,
    headY,
    neckY: headY + headR * 0.92,
    shY: y - s * 0.64 + breathe * s * 0.006, // 어깨 높이 (웅크린 자세라 낮음)
    sw: s * 0.29, // 어깨 반폭
    bw: s * 0.4, // 앉은 엉덩이 반폭
  };
}

// 몸(옷) 실루엣
function bodyPath(ctx, x, y, s, g, wide = 1) {
  const bw = g.bw * wide;
  const sw = g.sw * (wide > 1 ? 1.12 : 1);
  ctx.beginPath();
  ctx.moveTo(x - bw, y);
  // 왼쪽 무릎이 살짝 보이는 옆선
  ctx.bezierCurveTo(x - bw * 1.12, y - s * 0.12, x - bw * 1.1, y - s * 0.22, x - bw * 0.98, y - s * 0.26);
  ctx.bezierCurveTo(x - sw * 1.18, g.shY + s * 0.2, x - sw * 1.1, g.shY + s * 0.04, x - sw * 0.92, g.shY);
  ctx.bezierCurveTo(x - sw * 0.6, g.shY - s * 0.06, x - s * 0.12, g.neckY + s * 0.01, x - s * 0.07, g.neckY);
  ctx.lineTo(x + s * 0.07, g.neckY);
  ctx.bezierCurveTo(x + s * 0.12, g.neckY + s * 0.01, x + sw * 0.6, g.shY - s * 0.06, x + sw * 0.92, g.shY);
  ctx.bezierCurveTo(x + sw * 1.1, g.shY + s * 0.04, x + sw * 1.18, g.shY + s * 0.2, x + bw * 0.98, y - s * 0.26);
  ctx.bezierCurveTo(x + bw * 1.1, y - s * 0.22, x + bw * 1.12, y - s * 0.12, x + bw, y);
  ctx.quadraticCurveTo(x, y + s * 0.03, x - bw, y);
  ctx.closePath();
}

function clothFill(ctx, x, y, s, g, base, lightX) {
  const gr = ctx.createLinearGradient(x + lightX * s * 0.5, g.shY, x - lightX * s * 0.5, y);
  gr.addColorStop(0, tone(base, 0.12));
  gr.addColorStop(0.5, base);
  gr.addColorStop(1, tone(base, -0.18));
  return gr;
}

// 옷 주름: 부드러운 어두운 곡선
function folds(ctx, x, y, s, g, base, n = 3) {
  ctx.save();
  ctx.strokeStyle = tone(base, -0.3, 0.2);
  ctx.lineWidth = Math.max(0.8, s * 0.016);
  ctx.lineCap = 'round';
  // 등이 둥글게 굽은 주름 두 줄 (세로줄 대신 부드러운 곡선)
  ctx.beginPath();
  ctx.moveTo(x - g.sw * 0.7, g.shY + s * 0.16);
  ctx.quadraticCurveTo(x, g.shY + s * 0.24, x + g.sw * 0.7, g.shY + s * 0.16);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + g.sw * 0.35, y - s * 0.24);
  ctx.quadraticCurveTo(x + g.sw * 0.55, y - s * 0.12, x + g.sw * 0.45, y - s * 0.03);
  ctx.stroke();
  ctx.restore();
}

function hair(ctx, kind, x, g, s, color) {
  const { headR: r, headY: hy } = g;
  ctx.fillStyle = color;
  if (kind === 'long') {
    // 긴 생머리: 어깨 아래까지
    ctx.beginPath();
    ctx.moveTo(x - r * 1.02, hy);
    ctx.bezierCurveTo(x - r * 1.1, hy + r * 1.4, x - r * 1.0, g.shY + s * 0.1, x - r * 0.75, g.shY + s * 0.2);
    ctx.quadraticCurveTo(x, g.shY + s * 0.26, x + r * 0.75, g.shY + s * 0.2);
    ctx.bezierCurveTo(x + r * 1.0, g.shY + s * 0.1, x + r * 1.1, hy + r * 1.4, x + r * 1.02, hy);
    ctx.arc(x, hy, r * 1.02, 0, Math.PI, true);
    ctx.fill();
  } else if (kind === 'bob') {
    ctx.beginPath();
    ctx.moveTo(x - r * 1.08, hy);
    ctx.quadraticCurveTo(x - r * 1.15, hy + r * 1.05, x - r * 0.8, hy + r * 1.2);
    ctx.lineTo(x + r * 0.8, hy + r * 1.2);
    ctx.quadraticCurveTo(x + r * 1.15, hy + r * 1.05, x + r * 1.08, hy);
    ctx.arc(x, hy, r * 1.08, 0, Math.PI, true);
    ctx.fill();
  } else if (kind === 'bun') {
    ellipse(ctx, x, hy, r * 1.02, r * 1.02);
    ctx.fill();
    ellipse(ctx, x + r * 0.1, hy - r * 1.05, r * 0.45, r * 0.42);
    ctx.fill();
  } else {
    // 짧은 머리
    ellipse(ctx, x, hy + r * 0.05, r * 1.03, r * 1.05);
    ctx.fill();
  }
  // 머리결 하이라이트
  ctx.strokeStyle = tone(color, 0.25, 0.5);
  ctx.lineWidth = Math.max(0.7, s * 0.01);
  ctx.beginPath();
  ctx.arc(x - r * 0.1, hy - r * 0.1, r * 0.7, 1.15 * Math.PI, 1.55 * Math.PI);
  ctx.stroke();
}

// 종이 질감: 인물 위에만 아주 옅은 점
function grain(ctx, x0, y0, w, h, seed) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  let r = seed >>> 0 || 1;
  const n = Math.min(4000, Math.floor((w * h) / 9));
  for (let i = 0; i < n; i++) {
    r = (r * 1664525 + 1013904223) >>> 0;
    const px = x0 + ((r % 1000) / 1000) * w;
    r = (r * 1664525 + 1013904223) >>> 0;
    const py = y0 + ((r % 1000) / 1000) * h;
    ctx.fillStyle = r & 1 ? 'rgba(255,248,235,0.07)' : 'rgba(30,20,15,0.08)';
    ctx.fillRect(px, py, 1, 1);
  }
  ctx.restore();
}

function drawSteam(ctx, x, y, s, t, phase, alpha = 0.4, rgb = '255,255,255') {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(0.8, s * 0.022);
  for (let i = 0; i < 2; i++) {
    const p = (((t / 2600 + phase + i * 0.5) % 1) + 1) % 1;
    ctx.strokeStyle = `rgba(${rgb},${alpha * (1 - p) * Math.min(1, p * 4)})`;
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
 * 사람 뒷모습 그리기 (몸통만, 움직이는 부분 제외)
 * o: { x, y(바닥), s(크기), type, color, lightX }
 */
export function drawCritter(ctx, o) {
  const { x, y, s, type = 'blanket', color = 0, lightX = -1 } = o;
  const [base, accent] = BLANKETS[color % BLANKETS.length];
  const seed = color * 13 + type.length * 31 + 7;
  const hairColor = HAIR[(color + type.length) % HAIR.length];
  const g = geom(x, y, s);
  const line = tone(base, -0.45, 0.35);
  const hairKind = { blanket: 'long', scarf: 'bob', coat: 'bun', beanie: 'short', hood: 'none' }[type] || 'short';

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // 그림자
  ctx.fillStyle = 'rgba(30,18,12,0.18)';
  ellipse(ctx, x, y + s * 0.015, s * 0.55, s * 0.06);
  ctx.fill();

  // 목덜미
  ctx.fillStyle = tone(SKIN, -0.08);
  ctx.fillRect(x - s * 0.05, g.headY + g.headR * 0.5, s * 0.1, g.neckY - g.headY);

  if (type === 'hood') {
    bodyPath(ctx, x, y, s, g);
    ctx.fillStyle = clothFill(ctx, x, y, s, g, base, lightX);
    ctx.fill();
    ctx.strokeStyle = line;
    ctx.lineWidth = Math.max(0.8, s * 0.014);
    ctx.stroke();
    folds(ctx, x, y, s, g, base, 2);
    // 머리를 감싼 후드
    ctx.fillStyle = clothFill(ctx, x, g.neckY, s, g, base, lightX);
    ctx.beginPath();
    ctx.moveTo(x - g.sw * 0.75, g.shY + s * 0.03);
    ctx.bezierCurveTo(x - g.headR * 1.7, g.headY + g.headR * 1.2, x - g.headR * 1.35, g.headY - g.headR * 0.4, x - g.headR * 0.9, g.headY - g.headR * 0.85);
    ctx.quadraticCurveTo(x, g.headY - g.headR * 1.45, x + g.headR * 0.9, g.headY - g.headR * 0.85);
    ctx.bezierCurveTo(x + g.headR * 1.35, g.headY - g.headR * 0.4, x + g.headR * 1.7, g.headY + g.headR * 1.2, x + g.sw * 0.75, g.shY + s * 0.03);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = tone(base, -0.3, 0.45);
    ctx.beginPath();
    ctx.moveTo(x, g.headY - g.headR * 1.2);
    ctx.quadraticCurveTo(x + g.headR * 0.08, g.headY + g.headR * 0.4, x, g.shY + s * 0.02);
    ctx.stroke();
  } else {
    const wide = type === 'blanket' ? 1.16 : 1;
    bodyPath(ctx, x, y, s, g, wide);
    ctx.fillStyle = clothFill(ctx, x, y, s, g, base, lightX);
    ctx.fill();
    ctx.strokeStyle = line;
    ctx.lineWidth = Math.max(0.8, s * 0.014);
    ctx.stroke();
    folds(ctx, x, y, s, g, base, type === 'blanket' ? 4 : 3);

    if (type === 'blanket') {
      // 담요 가장자리 술 장식과 겹쳐 두른 자락
      ctx.strokeStyle = tone(accent, -0.1, 0.8);
      ctx.lineWidth = Math.max(0.7, s * 0.012);
      for (let k = -6; k <= 6; k++) {
        const fx = x + k * g.bw * 1.16 * 0.15;
        ctx.beginPath();
        ctx.moveTo(fx, y - s * 0.01);
        ctx.lineTo(fx + s * 0.005, y + s * 0.035);
        ctx.stroke();
      }
    }
    if (type === 'coat') {
      // 코트 깃과 허리 벨트
      ctx.fillStyle = tone(base, -0.12);
      ctx.beginPath();
      ctx.moveTo(x - s * 0.16, g.neckY - s * 0.02);
      ctx.quadraticCurveTo(x, g.neckY + s * 0.07, x + s * 0.16, g.neckY - s * 0.02);
      ctx.lineTo(x + s * 0.13, g.neckY + s * 0.05);
      ctx.quadraticCurveTo(x, g.neckY + s * 0.11, x - s * 0.13, g.neckY + s * 0.05);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = tone(base, -0.32, 0.6);
      ctx.lineWidth = Math.max(1, s * 0.03);
      ctx.beginPath();
      ctx.moveTo(x - g.bw * 0.9, y - s * 0.22);
      ctx.quadraticCurveTo(x, y - s * 0.19, x + g.bw * 0.9, y - s * 0.22);
      ctx.stroke();
    }

    // 머리카락 (긴 머리는 등 위로 흘러내림)
    hair(ctx, hairKind, x, g, s, hairColor);

    if (type === 'scarf') {
      // 목도리: 목에 감고 한쪽 자락이 바람에 날림
      ctx.fillStyle = accent;
      ctx.strokeStyle = tone(accent, -0.35, 0.5);
      ctx.lineWidth = Math.max(0.7, s * 0.012);
      ctx.beginPath();
      ctx.moveTo(x - s * 0.17, g.neckY - s * 0.04);
      ctx.quadraticCurveTo(x, g.neckY + s * 0.05, x + s * 0.17, g.neckY - s * 0.04);
      ctx.lineTo(x + s * 0.18, g.neckY + s * 0.05);
      ctx.quadraticCurveTo(x, g.neckY + s * 0.14, x - s * 0.18, g.neckY + s * 0.05);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - s * 0.1, g.neckY + s * 0.06);
      ctx.quadraticCurveTo(x - s * 0.2, g.shY + s * 0.2, x - s * 0.3, g.shY + s * 0.28);
      ctx.lineTo(x - s * 0.22, g.shY + s * 0.32);
      ctx.quadraticCurveTo(x - s * 0.12, g.shY + s * 0.22, x - s * 0.02, g.neckY + s * 0.08);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    if (type === 'beanie') {
      // 니트 비니: 접힌 단과 작은 방울
      const r = g.headR;
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(x, g.headY - r * 0.05, r * 1.08, Math.PI, 0);
      ctx.lineTo(x + r * 1.1, g.headY + r * 0.15);
      ctx.lineTo(x - r * 1.1, g.headY + r * 0.15);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = tone(accent, -0.12);
      ctx.fillRect(x - r * 1.12, g.headY - r * 0.12, r * 2.24, r * 0.32);
      ctx.strokeStyle = tone(accent, -0.3, 0.45);
      ctx.lineWidth = Math.max(0.6, s * 0.009);
      for (let k = -3; k <= 3; k++) {
        ctx.beginPath();
        ctx.moveTo(x + k * r * 0.3, g.headY - r * 0.12);
        ctx.lineTo(x + k * r * 0.3, g.headY + r * 0.2);
        ctx.stroke();
      }
      ctx.fillStyle = tone(accent, 0.15);
      ellipse(ctx, x, g.headY - r * 1.15, r * 0.3, r * 0.28);
      ctx.fill();
    }
  }

  // 종이 질감
  grain(ctx, x - s * 0.6, g.headY - s * 0.35, s * 1.2, y - g.headY + s * 0.4, seed);
  ctx.restore();
}

// ---------- 빠르게 그리기 (장면용) ----------
const spriteCache = new Map();
const SPRITE_W = 1.5;
const SPRITE_H = 1.5;
const SPRITE_FOOT = 0.12;

function getSprite(type, color, s, dpr, bright = 1, lightX = -1) {
  const sz = Math.max(6, Math.round(s));
  const b = Math.round(bright * 20) / 20;
  const key = `${type}|${color}|${sz}|${dpr}|${b}|${lightX}`;
  let sp = spriteCache.get(key);
  if (sp) return sp;
  const c = document.createElement('canvas');
  c.width = Math.ceil(sz * SPRITE_W * dpr);
  c.height = Math.ceil(sz * SPRITE_H * dpr);
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  if (b < 0.999) g.filter = `brightness(${b})`;
  drawCritter(g, { x: (sz * SPRITE_W) / 2, y: sz * (SPRITE_H - SPRITE_FOOT), s: sz, type, color, lightX });
  sp = { canvas: c, sz };
  if (spriteCache.size > 800) spriteCache.clear();
  spriteCache.set(key, sp);
  return sp;
}

/**
 * 장면용: 캐시한 몸통 + 실시간 움직임(숨쉬기, 만세, 역광, 음료 김)
 */
export function drawCritterFast(ctx, o) {
  const { x, s, type = 'blanket', color = 0, arms = 0, hop = 0, rim, t = 0, steam = false, dpr = 1, bright = 1 } = o;
  const [base] = BLANKETS[color % BLANKETS.length];
  const phase = (Math.abs(x * 7 + color * 13) % 100) / 100;
  const breathe = Math.sin(t / 1300 + phase * 6.28);
  const y = o.y - hop * s * 0.25;
  const lightX = rim && rim.a > 0.05 ? rim.x : -1;
  const sp = getSprite(type, color, s, dpr, bright, lightX);
  const k = s / sp.sz;
  const w = sp.sz * SPRITE_W * k;
  const h = sp.sz * SPRITE_H * k;
  const g = geom(x, y, s, breathe);

  // 만세 하는 팔 (몸 뒤에서)
  if (arms > 0) {
    ctx.save();
    ctx.lineCap = 'round';
    for (const sg of [-1, 1]) {
      const ax0 = x + sg * g.sw * 0.8;
      const ay0 = g.shY + s * 0.04;
      const ax1 = x + sg * s * (0.3 + 0.08 * arms);
      const ay1 = g.shY - s * (0.15 + 0.38 * arms);
      ctx.strokeStyle = tone(base, -0.1 + (bright - 1) * 0.6);
      ctx.lineWidth = s * 0.11;
      ctx.beginPath();
      ctx.moveTo(ax0, ay0);
      ctx.lineTo(ax1, ay1);
      ctx.stroke();
      ctx.fillStyle = tone(SKIN, (bright - 1) * 0.6);
      ellipse(ctx, ax1, ay1 - s * 0.03, s * 0.045, s * 0.05);
      ctx.fill();
    }
    ctx.restore();
  }

  const sy = 1 + breathe * 0.008;
  const foot = sp.sz * SPRITE_FOOT * k;
  ctx.drawImage(sp.canvas, x - w / 2, y + foot - h * sy, w, h * sy);

  // 역광: 머리와 어깨 윤곽이 빛남
  if (rim && rim.a > 0.01) {
    ctx.save();
    ctx.globalAlpha = rim.a;
    ctx.strokeStyle = rim.color;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, s * 0.028);
    const hr = g.headR * (type === 'hood' ? 1.2 : 1.05);
    const a0 = rim.x > 0 ? -0.55 * Math.PI : -1.05 * Math.PI;
    ctx.beginPath();
    ctx.arc(x, g.headY, hr, a0, a0 + 0.6 * Math.PI);
    ctx.stroke();
    ctx.lineWidth = Math.max(0.8, s * 0.02);
    ctx.globalAlpha = rim.a * 0.8;
    ctx.beginPath();
    if (rim.x > 0) {
      ctx.moveTo(x + s * 0.1, g.neckY + s * 0.01);
      ctx.quadraticCurveTo(x + g.sw * 0.8, g.neckY, x + g.sw, g.shY + s * 0.02);
    } else {
      ctx.moveTo(x - s * 0.1, g.neckY + s * 0.01);
      ctx.quadraticCurveTo(x - g.sw * 0.8, g.neckY, x - g.sw, g.shY + s * 0.02);
    }
    ctx.stroke();
    ctx.restore();
  }
  // 두 손에 든 따뜻한 음료의 김
  if (steam) drawSteam(ctx, x + s * 0.24, g.shY + s * 0.02, s, t, phase, 0.35);
}

// 캐릭터 고르기·승차권용: 노을빛 원 안에 앉은 뒷모습
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
  g.addColorStop(0, '#4a4f78');
  g.addColorStop(0.55, '#e0927a');
  g.addColorStop(0.62, '#f2c08a');
  g.addColorStop(0.63, '#5b6b8a');
  g.addColorStop(1, '#3d4866');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,214,150,0.9)';
  ctx.beginPath();
  ctx.arc(w * 0.64, h / 2 - r + r * 1.25, r * 0.13, Math.PI, 0);
  ctx.fill();
  drawCritter(ctx, { x: w / 2, y: h * 0.95, s: h * 0.62, type, color, lightX: 1 });
  ctx.restore();
}
