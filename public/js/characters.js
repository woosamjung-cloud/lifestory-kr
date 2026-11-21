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
// 고를 수 있는 머리 색 (이름, 색)
export const HAIRS = [
  ['검정', '#1f1a19'],
  ['흑갈색', '#3b2a22'],
  ['갈색', '#6e4a30'],
  ['금발', '#c8a25c'],
  ['빨강', '#8e3d2a'],
  ['은발', '#bdb7b0'],
];
// 반려동물: 0 없음, 1 강아지, 2 고양이
export const PETS = [
  ['없음', ''],
  ['강아지', '🐶'],
  ['고양이', '🐱'],
];
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
  const hairIdx = o.hair; // 고른 머리 색 번호 (없으면 옷 색에 따라 자동)
  const [base, accent] = BLANKETS[color % BLANKETS.length];
  const seed = color * 13 + type.length * 31 + 7;
  const hairColor = hairIdx != null && HAIRS[hairIdx] ? HAIRS[hairIdx][1] : HAIR[(color + type.length) % HAIR.length];
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

function getSprite(type, color, s, dpr, bright = 1, lightX = -1, hair = null) {
  const sz = Math.max(6, Math.round(s));
  const b = Math.round(bright * 20) / 20;
  const key = `${type}|${color}|${sz}|${dpr}|${b}|${lightX}|${hair}`;
  let sp = spriteCache.get(key);
  if (sp) return sp;
  const c = document.createElement('canvas');
  c.width = Math.ceil(sz * SPRITE_W * dpr);
  c.height = Math.ceil(sz * SPRITE_H * dpr);
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  if (b < 0.999) g.filter = `brightness(${b})`;
  drawCritter(g, { x: (sz * SPRITE_W) / 2, y: sz * (SPRITE_H - SPRITE_FOOT), s: sz, type, color, lightX, hair });
  sp = { canvas: c, sz };
  if (spriteCache.size > 800) spriteCache.clear();
  spriteCache.set(key, sp);
  return sp;
}

/**
 * 장면용: 캐시한 몸통 + 실시간 움직임(숨쉬기, 만세, 역광, 음료 김)
 */
export function drawCritterFast(ctx, o) {
  const { x, s, type = 'blanket', color = 0, arms = 0, hop = 0, rim, t = 0, steam = false, dpr = 1, bright = 1, hair = null } = o;
  const [base] = BLANKETS[color % BLANKETS.length];
  const phase = (Math.abs(x * 7 + color * 13) % 100) / 100;
  const breathe = Math.sin(t / 1300 + phase * 6.28);
  const y = o.y - hop * s * 0.25;
  const lightX = rim && rim.a > 0.05 ? rim.x : -1;
  const sp = getSprite(type, color, s, dpr, bright, lightX, hair);
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
      // 손: 손바닥과 펼친 손가락 네 개, 엄지
      const skin = tone(SKIN, (bright - 1) * 0.6);
      const ang = Math.atan2(ay1 - ay0, ax1 - ax0);
      ctx.save();
      ctx.translate(ax1, ay1);
      ctx.rotate(ang);
      ctx.strokeStyle = skin;
      ctx.lineWidth = Math.max(1, s * 0.022);
      for (let f = -1.5; f <= 1.5; f++) {
        const fa = f * 0.28;
        ctx.beginPath();
        ctx.moveTo(s * 0.02, 0);
        ctx.lineTo(Math.cos(fa) * s * 0.085, Math.sin(fa) * s * 0.085);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(s * 0.035, -sg * s * 0.06);
      ctx.stroke();
      ctx.fillStyle = skin;
      ellipse(ctx, s * 0.01, 0, s * 0.04, s * 0.035);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // 와! 하고 뛰어오를 때: 담요 아래로 다리와 신발이 쏙 (몸 뒤에서 먼저 그림)
  if (hop > 0.05) {
    const L = s * (0.005 + 0.065 * hop); // 살짝만
    ctx.save();
    ctx.lineCap = 'round';
    for (const sg of [-1, 1]) {
      const fx = x + sg * s * 0.095;
      ctx.strokeStyle = tone('#4a4e63', (bright - 1) * 0.6);
      ctx.lineWidth = s * 0.13; // 통통한 바지
      ctx.beginPath();
      ctx.moveTo(fx, y - s * 0.06);
      ctx.lineTo(fx + sg * s * 0.015, y + L);
      ctx.stroke();
      // 동그란 신발 (발끝이 살짝 바깥쪽)
      ctx.fillStyle = tone('#3a2b26', (bright - 1) * 0.6);
      ellipse(ctx, fx + sg * s * 0.025, y + L + s * 0.02, s * 0.08, s * 0.045);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ellipse(ctx, fx + sg * s * 0.015, y + L + s * 0.005, s * 0.035, s * 0.013);
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
}

// 캐릭터 고르기·승차권용: 노을빛 원 안에 앉은 뒷모습
export function renderPortrait(canvas, type, color, hair = null, pet = 0) {
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
  drawCritter(ctx, { x: w / 2 - (pet ? w * 0.08 : 0), y: h * 0.95, s: h * 0.62, type, color, lightX: 1, hair });
  if (pet) drawPet(ctx, { x: w * 0.74, y: h * 0.95, s: h * 0.62, kind: pet, t: 0 });
  ctx.restore();
}


// 강아지 귀: 머리 위쪽에 붙어 아래로 축 늘어진 물방울 모양, 걸음·바람에 살랑
function dogEar(ctx, hx, hy, r, side, sway, outer, inner) {
  const ax = hx + side * r * 0.55; // 귀가 붙는 곳 (정수리 옆)
  const ay = hy - r * 0.62;
  const tx = hx + side * r * (1.12 + sway * 0.1); // 귀 끝
  const ty = hy + r * (0.55 + sway * 0.05);
  ctx.fillStyle = outer;
  ctx.beginPath();
  ctx.moveTo(ax - side * r * 0.2, ay + r * 0.05);
  ctx.bezierCurveTo(ax + side * r * 0.45, ay - r * 0.15, tx + side * r * 0.22, ty - r * 0.55, tx, ty);
  ctx.bezierCurveTo(tx - side * r * 0.12, ty + r * 0.2, hx + side * r * 0.62, ty + r * 0.05, hx + side * r * 0.72, hy + r * 0.05);
  // 안쪽 가장자리는 머리 둥근 선을 따라 부드럽게
  ctx.quadraticCurveTo(hx + side * r * 0.42, hy - r * 0.32, ax - side * r * 0.2, ay + r * 0.05);
  ctx.fill();
  if (inner) {
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.moveTo(ax + side * r * 0.05, ay + r * 0.25);
    ctx.quadraticCurveTo(tx - side * r * 0.05, ty - r * 0.45, tx - side * r * 0.12, ty - r * 0.12);
    ctx.quadraticCurveTo(hx + side * r * 0.82, hy + r * 0.05, ax + side * r * 0.05, ay + r * 0.25);
    ctx.fill();
  }
}

// ---------- 반려동물 (옆에 나란히 앉은 뒷모습, 꼬리가 살랑) ----------
// 가끔 한 번, 어쩔 때는 두 번 천천히 움직이도록 시각마다 정해진 일정을 만듦
function hash01(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
// cycle(ms)마다 한 번 움직일 기회. 움직이지 않는 주기도 있음. 반환값 -1~1
function episode(t, seed, cycle, swingMs, restChance) {
  const tt = t + seed * 9973;
  const idx = Math.floor(tt / cycle);
  const local = tt - idx * cycle;
  const r = hash01(idx + seed * 7.3);
  if (r < restChance) return 0; // 이번엔 가만히
  const swings = hash01(idx * 3.1 + seed) < 0.35 ? 2 : 1;
  const start = (0.1 + 0.5 * hash01(idx * 1.7 + seed * 2.9)) * cycle;
  const dur = swings * swingMs;
  if (local < start || local > start + dur) return 0;
  const u = (local - start) / dur;
  const env = Math.sin(Math.PI * u); // 부드럽게 시작하고 끝남
  return Math.sin(2 * Math.PI * swings * u) * env;
}

export function drawPet(ctx, o) {
  const { x, y, s, kind = 1, t = 0, bright = 1, hop = 0, walking = false } = o;
  if (!kind) return;
  if (walking) return drawPetWalk(ctx, o);
  const dog = kind === 1;
  const fur = dog ? '#b98652' : '#8a8f99';
  const dark = dog ? '#8a5f37' : '#5f646e';
  const k = s * 0.42; // 사람의 절반쯤 크기
  const by = y - hop * k * 0.55;
  const sh = (c, a) => {
    const n = parseInt(c.slice(1), 16);
    const f = (v) => Math.round(v * a);
    return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
  };
  const F = sh(fur, bright);
  const D = sh(dark, bright);
  ctx.save();
  // 그림자
  ctx.fillStyle = `rgba(30,18,12,${0.16 * (1 - hop * 0.5)})`;
  ctx.beginPath();
  ctx.ellipse(x, y + k * 0.02, k * 0.5 * (1 - hop * 0.35), k * 0.07 * (1 - hop * 0.35), 0, 0, Math.PI * 2);
  ctx.fill();
  const seed = Math.round(Math.abs(x)) % 997;
  // 뛰어오를 때: 네 발이 아래로 쭉 (몸 뒤에서 먼저 그려 몸 아래로만 보이게)
  if (hop > 0.04) {
    const L = k * (0.08 + 0.2 * hop);
    ctx.strokeStyle = sh(fur, bright * 0.9);
    ctx.lineCap = 'round';
    for (const [dx, len, w] of [[-0.25, 1, 0.13], [0.25, 1, 0.13], [-0.1, 0.85, 0.11], [0.1, 0.85, 0.11]]) {
      ctx.lineWidth = k * w;
      ctx.beginPath();
      ctx.moveTo(x + dx * k, by - k * 0.08);
      ctx.lineTo(x + dx * k * 1.05, by + L * len);
      ctx.stroke();
      ctx.fillStyle = sh(dark, bright);
      ctx.beginPath();
      ctx.ellipse(x + dx * k * 1.05, by + L * len, k * w * 0.62, k * w * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const wag = dog ? episode(t, seed, 6000, 1100, 0.3) : episode(t, seed, 9000, 1600, 0.35);
  // 몸 (앉은 뒷모습: 위는 좁고 엉덩이는 넓은 배 모양)
  ctx.fillStyle = F;
  ctx.beginPath();
  ctx.moveTo(x - k * 0.2, by - k * 0.62);
  ctx.bezierCurveTo(x - k * 0.3, by - k * 0.45, x - k * 0.42, by - k * 0.12, x - k * 0.34, by - k * 0.02);
  ctx.quadraticCurveTo(x, by + k * 0.03, x + k * 0.34, by - k * 0.02);
  ctx.bezierCurveTo(x + k * 0.42, by - k * 0.12, x + k * 0.3, by - k * 0.45, x + k * 0.2, by - k * 0.62);
  ctx.closePath();
  ctx.fill();
  // 살짝 보이는 뒷발 (앉아 있을 때만)
  if (hop <= 0.04) for (const sg of [-1, 1]) {
    ctx.fillStyle = D;
    ctx.beginPath();
    ctx.ellipse(x + sg * k * 0.3, by - k * 0.01, k * 0.09, k * 0.045, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // 꼬리: 엉덩이 가운데에서 바닥을 따라 옆으로 말림, 가끔 끝이 살랑
  ctx.strokeStyle = D;
  ctx.lineCap = 'round';
  ctx.lineWidth = k * (dog ? 0.1 : 0.08);
  ctx.beginPath();
  ctx.moveTo(x, by - k * 0.08);
  if (hop > 0.04) {
    // 신나서 꼬리가 위로 쫑긋
    ctx.quadraticCurveTo(x + k * 0.3, by - k * 0.05, x + k * 0.36, by - k * (0.3 + 0.2 * hop));
  } else {
    ctx.quadraticCurveTo(x + k * 0.22, by, x + k * 0.4, by - k * (0.06 + Math.max(0, wag) * 0.1));
    ctx.quadraticCurveTo(x + k * 0.52, by - k * (0.12 + wag * 0.15), x + k * (0.48 + wag * 0.08), by - k * (0.26 + wag * 0.2));
  }
  ctx.stroke();
  // 머리: 까딱까딱 고개를 갸웃 (가끔 멈췄다 다시)
  ctx.fillStyle = F;
  const hy = by - k * 0.82;
  // 고개도 가끔 천천히 갸웃
  const tilt = (dog ? 0.28 : 0.22) * episode(t, seed + 41, dog ? 5600 : 7400, dog ? 1300 : 1700, 0.35);
  ctx.save();
  ctx.translate(x, hy + k * 0.2);
  ctx.rotate(tilt);
  ctx.translate(-x, -(hy + k * 0.2));
  ctx.beginPath();
  ctx.arc(x, hy, k * 0.26, 0, Math.PI * 2);
  ctx.fill();
  if (dog) {
    // 축 처진 귀 (고개를 갸웃하면 같이 살랑)
    for (const sg of [-1, 1]) dogEar(ctx, x, hy, k * 0.26, sg, tilt * sg * 2, D, null);
  } else {
    // 쫑긋한 세모 귀
    for (const sg of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + sg * k * 0.08, hy - k * 0.2);
      ctx.lineTo(x + sg * k * 0.24, hy - k * 0.38);
      ctx.lineTo(x + sg * k * 0.26, hy - k * 0.08);
      ctx.closePath();
      ctx.fill();
    }
    // 줄무늬
    ctx.strokeStyle = D;
    ctx.lineWidth = Math.max(0.8, k * 0.04);
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * k * 0.12, by - k * 0.62);
      ctx.lineTo(x + i * k * 0.1, by - k * 0.45);
      ctx.stroke();
    }
  }
  ctx.restore();
  // 목줄 / 방울
  ctx.fillStyle = dog ? '#c9574e' : '#e2b04a';
  ctx.beginPath();
  ctx.ellipse(x, hy + k * 0.24, k * 0.2, k * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// 걷는 반려동물: 네 발로 총총 (뒷모습)
function drawPetWalk(ctx, o) {
  if (o.face === 'left' || o.face === 'right') return drawPetSide(ctx, o);
  const { x, y, s, kind = 1, bright = 1, still = false } = o;
  const facingFront = o.face === 'front';
  const t = o.t || 0;
  const dog = kind === 1;
  const f = (c) => {
    const n = parseInt(c.slice(1), 16);
    const m = (v) => Math.round(v * bright);
    return `rgb(${m((n >> 16) & 255)},${m((n >> 8) & 255)},${m(n & 255)})`;
  };
  const F = f(dog ? '#b98652' : '#8a8f99');
  const D = f(dog ? '#8a5f37' : '#5f646e');
  const k = s * 0.42;
  const ph = still ? 0 : t / (dog ? 95 : 120);
  const bob = Math.abs(Math.sin(ph)) * k * 0.05;
  const by = y - bob;
  ctx.save();
  ctx.fillStyle = 'rgba(30,18,12,0.16)';
  ctx.beginPath();
  ctx.ellipse(x, y + k * 0.02, k * 0.42, k * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  // 뒤쪽 다리 한 쌍 (몸에 가려 짧게만 보임)
  const leg = (lx, off, top, w, col) => {
    const lift = Math.max(0, Math.sin(ph + off)) * k * 0.07;
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x + lx * k, by - top);
    ctx.lineTo(x + lx * k, y - lift - k * 0.02);
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(x + lx * k, y - lift - k * 0.02, w * 0.6, w * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  ctx.lineCap = 'round';
  leg(-0.12, Math.PI, k * 0.3, k * 0.1, D);
  leg(0.12, 0, k * 0.3, k * 0.1, D);
  // 꼬리 (걸을 때는 위로 들고 신나게)
  const wag = Math.sin(t / (dog ? 90 : 260)) * (dog ? 1 : 0.5);
  const drawTail = () => {
    ctx.strokeStyle = dog ? F : D;
    ctx.lineWidth = k * (dog ? 0.11 : 0.08);
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (facingFront) {
      // 앞모습: 몸 뒤에서 등 위로 살짝 보임
      ctx.moveTo(x + k * 0.05, by - k * 0.45);
      ctx.quadraticCurveTo(x + k * (0.2 + wag * 0.08), by - k * 0.6, x + k * (0.24 + wag * 0.12), by - k * 0.72);
    } else {
      // 뒷모습: 엉덩이 가운데에서 위로 솟아 좌우로 흔들림 (몸 앞쪽에 보여서 조금 진한 색)
      ctx.strokeStyle = D;
      ctx.moveTo(x, by - k * 0.3);
      ctx.quadraticCurveTo(x + wag * k * 0.12, by - k * 0.48, x + wag * k * 0.22, by - k * (dog ? 0.6 : 0.68));
    }
    ctx.stroke();
  };
  if (facingFront) drawTail();
  // 몸통 (서 있으니 낮고 넓게)
  ctx.fillStyle = F;
  ctx.beginPath();
  ctx.ellipse(x, by - k * 0.4, k * 0.26, k * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  // 앞쪽 다리 한 쌍 (짧고 통통하게, 번갈아 걸음)
  leg(-0.15, 0, k * 0.26, k * 0.12, F);
  leg(0.15, Math.PI, k * 0.26, k * 0.12, F);
  if (!facingFront) drawTail();
  // 머리 (앞쪽이라 몸 위로 살짝)
  const hy = by - k * 0.7;
  ctx.beginPath();
  ctx.arc(x + Math.sin(ph * 0.5) * k * 0.02, hy, k * 0.22, 0, Math.PI * 2);
  ctx.fill();
  if (dog) {
    // 걸을 때 귀가 통통 흔들림, 앞모습이면 귀 안쪽 분홍빛
    for (const sg of [-1, 1]) dogEar(ctx, x, hy, k * 0.22, sg, Math.sin(ph * 2 + sg), D, facingFront ? '#d9a08a' : null);
  } else {
    for (const sg of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + sg * k * 0.07, hy - k * 0.17);
      ctx.lineTo(x + sg * k * 0.21, hy - k * 0.33);
      ctx.lineTo(x + sg * k * 0.22, hy - k * 0.06);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.fillStyle = dog ? '#c9574e' : '#e2b04a';
  ctx.beginPath();
  ctx.ellipse(x, hy + k * 0.2, k * 0.17, k * 0.045, 0, 0, Math.PI * 2);
  ctx.fill();
  if (facingFront) {
    // 앞을 보고 걸어올 때 얼굴
    ctx.fillStyle = '#2b1d16';
    for (const sg of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(x + sg * k * 0.08, hy - k * 0.01, Math.max(0.8, k * 0.03), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(x, hy + k * 0.08, k * 0.035, k * 0.025, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// 옆모습 반려동물 (총총 걷기)
function drawPetSide(ctx, o) {
  const { x, y, s, kind = 1, bright = 1, still = false } = o;
  const t = o.t || 0;
  const d = o.face === 'left' ? -1 : 1;
  const dog = kind === 1;
  const f = (c) => {
    const n = parseInt(c.slice(1), 16);
    const m = (v) => Math.round(v * bright);
    return `rgb(${m((n >> 16) & 255)},${m((n >> 8) & 255)},${m(n & 255)})`;
  };
  const F = f(dog ? '#b98652' : '#8a8f99');
  const D = f(dog ? '#8a5f37' : '#5f646e');
  const k = s * 0.42;
  const ph = still ? 0 : t / (dog ? 95 : 120);
  const by = y - Math.abs(Math.sin(ph)) * k * 0.04;
  ctx.save();
  ctx.fillStyle = 'rgba(30,18,12,0.16)';
  ctx.beginPath();
  ctx.ellipse(x, y + k * 0.02, k * 0.48, k * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  // 다리 네 개 (앞뒤 엇갈림)
  ctx.strokeStyle = D;
  ctx.lineCap = 'round';
  ctx.lineWidth = k * 0.09;
  for (const [lx, off] of [[-0.24, 0], [-0.14, Math.PI], [0.18, Math.PI], [0.28, 0]]) {
    const sw = Math.sin(ph + off) * k * 0.08;
    const lift = Math.max(0, Math.cos(ph + off)) * k * 0.05;
    ctx.beginPath();
    ctx.moveTo(x + d * lx * k, by - k * 0.3);
    ctx.lineTo(x + d * (lx * k + sw), y - lift);
    ctx.stroke();
  }
  // 꼬리
  const wag = Math.sin(t / (dog ? 90 : 260)) * (dog ? 1 : 0.5);
  ctx.strokeStyle = dog ? F : D;
  ctx.lineWidth = k * (dog ? 0.11 : 0.08);
  ctx.beginPath();
  ctx.moveTo(x - d * k * 0.3, by - k * 0.4);
  ctx.quadraticCurveTo(x - d * k * (0.45 + wag * 0.05), by - k * 0.62, x - d * k * (0.42 + wag * 0.1), by - k * (dog ? 0.7 : 0.85));
  ctx.stroke();
  // 몸통
  ctx.fillStyle = F;
  ctx.beginPath();
  ctx.ellipse(x, by - k * 0.38, k * 0.36, k * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  // 머리
  const hx = x + d * k * 0.38;
  const hy = by - k * 0.58;
  ctx.beginPath();
  ctx.arc(hx, hy, k * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(hx + d * k * 0.15, hy + k * 0.05, k * 0.1, k * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = D;
  if (dog) {
    // 옆에서 본 귀: 머리 뒤쪽 위에서 아래로 늘어지고 걸음마다 펄럭
    const fl = Math.sin(ph * 2) * 0.12;
    ctx.save();
    ctx.translate(hx - d * k * 0.1, hy - k * 0.12);
    ctx.rotate(d * (0.2 + fl));
    ctx.beginPath();
    ctx.moveTo(-k * 0.06, k * 0.01);
    ctx.bezierCurveTo(-k * 0.12, k * 0.1, -k * 0.1, k * 0.26, -k * 0.02, k * 0.28);
    ctx.bezierCurveTo(k * 0.06, k * 0.29, k * 0.08, k * 0.12, k * 0.06, k * 0.01);
    ctx.quadraticCurveTo(0, -k * 0.04, -k * 0.06, k * 0.01);
    ctx.fill();
    ctx.restore();
  } else {
    ctx.beginPath();
    ctx.moveTo(hx - d * k * 0.02, hy - k * 0.14);
    ctx.lineTo(hx + d * k * 0.06, hy - k * 0.3);
    ctx.lineTo(hx + d * k * 0.13, hy - k * 0.1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#2b1d16';
  ctx.beginPath();
  ctx.arc(hx + d * k * 0.08, hy - k * 0.02, Math.max(0.8, k * 0.03), 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(hx + d * k * 0.24, hy + k * 0.04, Math.max(0.7, k * 0.025), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = dog ? '#c9574e' : '#e2b04a';
  ctx.beginPath();
  ctx.ellipse(hx - d * k * 0.05, hy + k * 0.16, k * 0.05, k * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---------- 걷는 사람 (서서 걸어가는 뒷모습) ----------
export function drawWalker(ctx, o) {
  if (o.face === 'left' || o.face === 'right') return drawWalkerSide(ctx, o);
  if (o.face === 'front') return drawWalkerBackOrFront(ctx, o, true);
  return drawWalkerBackOrFront(ctx, o, false);
}

function drawWalkerBackOrFront(ctx, o, front) {
  const { x, y, s, type = 'blanket', color = 0, bright = 1, dir = 0, still = false } = o;
  const t = still ? 0 : o.t || 0; // 서서 쉬는 중이면 다리 멈춤
  const [base, accent] = BLANKETS[color % BLANKETS.length];
  const hairIdx = o.hair;
  const hairColor = hairIdx != null && HAIRS[hairIdx] ? HAIRS[hairIdx][1] : HAIR[(color + type.length) % HAIR.length];
  const ph = t / 150;
  const bob = Math.abs(Math.sin(ph)) * s * 0.03;
  const lean = dir * 0.06;
  ctx.save();
  if (bright < 0.999) ctx.filter = `brightness(${bright.toFixed(2)})`;
  // 그림자
  ctx.fillStyle = 'rgba(30,18,12,0.18)';
  ctx.beginPath();
  ctx.ellipse(x, y + s * 0.01, s * 0.3, s * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(x, y);
  ctx.rotate(lean);
  ctx.translate(-x, -y);
  const hipY = y - s * 0.5 - bob;
  // 다리 (번갈아 들림)
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#3a3640';
  ctx.lineWidth = s * 0.1;
  for (const [sg, off] of [[-1, 0], [1, Math.PI]]) {
    const lift = Math.max(0, Math.sin(ph + off)) * s * 0.08;
    const swing = Math.sin(ph + off) * s * 0.02;
    ctx.beginPath();
    ctx.moveTo(x + sg * s * 0.08, hipY);
    ctx.lineTo(x + sg * s * 0.09 + swing, y - lift);
    ctx.stroke();
    ctx.fillStyle = '#2a2628';
    ctx.beginPath();
    ctx.ellipse(x + sg * s * 0.09 + swing, y - lift, s * 0.06, s * 0.03, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // 몸 (코트·담요)
  const shY = y - s * 1.12 - bob;
  const hemY = type === 'blanket' || type === 'coat' ? y - s * 0.32 - bob : hipY + s * 0.05;
  const g = ctx.createLinearGradient(x - s * 0.3, shY, x + s * 0.3, hemY);
  g.addColorStop(0, base);
  g.addColorStop(1, `color-mix(in srgb, ${base} 80%, black)`);
  ctx.fillStyle = g;
  const sw = s * (type === 'blanket' ? 0.3 : 0.24);
  const hw = s * (type === 'blanket' ? 0.34 : 0.26);
  ctx.beginPath();
  ctx.moveTo(x - sw, shY + s * 0.06);
  ctx.quadraticCurveTo(x, shY - s * 0.04, x + sw, shY + s * 0.06);
  ctx.lineTo(x + hw, hemY);
  ctx.quadraticCurveTo(x, hemY + s * 0.04, x - hw, hemY);
  ctx.closePath();
  ctx.fill();
  // 팔 흔들기
  ctx.strokeStyle = base;
  ctx.lineWidth = s * 0.09;
  for (const [sg, off] of [[-1, Math.PI], [1, 0]]) {
    const sw2 = Math.sin(ph + off) * s * 0.07;
    ctx.beginPath();
    ctx.moveTo(x + sg * sw * 0.95, shY + s * 0.1);
    ctx.lineTo(x + sg * sw * 1.05 + sw2 * 0.4, shY + s * 0.45);
    ctx.stroke();
  }
  // 머리
  const gm = { headR: s * 0.17, headY: shY - s * 0.17, neckY: shY - s * 0.02, shY, sw };
  const kind = { blanket: 'long', scarf: 'bob', coat: 'bun', beanie: 'short', hood: 'short' }[type] || 'short';
  ctx.fillStyle = '#d9b49c';
  ctx.fillRect(x - s * 0.04, gm.headY + gm.headR * 0.6, s * 0.08, s * 0.08);
  if (type === 'hood') {
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.arc(x, gm.headY, gm.headR * 1.15, 0, Math.PI * 2);
    ctx.fill();
  } else {
    hair(ctx, kind, x, gm, s, hairColor);
  }
  if (front) drawFace(ctx, x, gm, s, type === 'hood' ? null : hairColor);
  if (type === 'beanie') {
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(x, gm.headY - gm.headR * 0.05, gm.headR * 1.08, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, gm.headY - gm.headR * 1.15, gm.headR * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }
  if (type === 'scarf') {
    ctx.fillStyle = accent;
    ctx.fillRect(x - sw * 0.8, shY - s * 0.02, sw * 1.6, s * 0.08);
    if (front) ctx.fillRect(x + sw * 0.2, shY, s * 0.07, s * 0.28);
  }
  ctx.restore();
}

// 앞모습 얼굴: 피부, 앞머리, 점 눈, 볼
function drawFace(ctx, x, gm, s, hairColor) {
  const r = gm.headR;
  const y = gm.headY;
  ctx.fillStyle = '#ecc9b0';
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.12, r * 0.82, r * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  if (hairColor) {
    ctx.fillStyle = hairColor;
    ctx.beginPath();
    ctx.ellipse(x, y - r * 0.42, r * 0.92, r * 0.45, 0, Math.PI, 0);
    ctx.fill();
  }
  ctx.fillStyle = '#2b1d16';
  for (const sg of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x + sg * r * 0.32, y + r * 0.12, Math.max(0.8, r * 0.09), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(235,130,130,0.45)';
  for (const sg of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + sg * r * 0.52, y + r * 0.38, r * 0.16, r * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#7a4a3a';
  ctx.lineWidth = Math.max(0.6, r * 0.06);
  ctx.beginPath();
  ctx.arc(x, y + r * 0.38, r * 0.14, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
}

// 옆모습 걷기 (왼쪽·오른쪽): 오른쪽을 보는 모습으로 그리고, 왼쪽은 거울처럼 뒤집음
function drawWalkerSide(ctx, o) {
  const { x: X, y, s, type = 'blanket', color = 0, bright = 1, still = false } = o;
  const t = still ? 0 : o.t || 0;
  const [base, accent] = BLANKETS[color % BLANKETS.length];
  const hairColor = o.hair != null && HAIRS[o.hair] ? HAIRS[o.hair][1] : HAIR[(color + type.length) % HAIR.length];
  const ph = t / 130;
  const bob = Math.abs(Math.sin(ph)) * s * 0.03;
  ctx.save();
  if (bright < 0.999) ctx.filter = `brightness(${bright.toFixed(2)})`;
  ctx.fillStyle = 'rgba(30,18,12,0.18)';
  ctx.beginPath();
  ctx.ellipse(X, y + s * 0.01, s * 0.26, s * 0.045, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(X, 0);
  if (o.face === 'left') ctx.scale(-1, 1);
  const x = 0;
  const hipY = y - s * 0.5 - bob;
  // 다리: 앞뒤로 엇갈림
  ctx.lineCap = 'round';
  ctx.lineWidth = s * 0.1;
  for (const off of [Math.PI, 0]) {
    // 보폭을 크게, 발을 들 때는 무릎을 굽힘
    const swing = Math.sin(ph + off) * s * 0.18;
    const lift = Math.max(0, Math.cos(ph + off)) * s * 0.07;
    ctx.strokeStyle = off === 0 ? '#3a3640' : '#2c2930';
    ctx.beginPath();
    ctx.moveTo(x, hipY);
    ctx.lineTo(x + swing * 0.5 + lift * 0.8, (hipY + y) / 2 - lift * 0.4);
    ctx.lineTo(x + swing, y - lift);
    ctx.stroke();
    ctx.fillStyle = '#2a2628';
    ctx.beginPath();
    ctx.ellipse(x + swing + s * 0.03, y - lift, s * 0.07, s * 0.03, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // 몸
  const shY = y - s * 1.12 - bob;
  const hemY = type === 'blanket' || type === 'coat' ? y - s * 0.32 - bob : hipY + s * 0.05;
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.13, shY + s * 0.04);
  ctx.quadraticCurveTo(x, shY - s * 0.03, x + s * 0.13, shY + s * 0.04);
  ctx.lineTo(x + s * (type === 'blanket' ? 0.2 : 0.15), hemY);
  ctx.lineTo(x - s * (type === 'blanket' ? 0.22 : 0.16), hemY);
  ctx.closePath();
  ctx.fill();
  // 팔
  ctx.strokeStyle = `color-mix(in srgb, ${base} 85%, black)`;
  ctx.lineWidth = s * 0.08;
  const asw = Math.sin(ph) * s * 0.12;
  ctx.beginPath();
  ctx.moveTo(x, shY + s * 0.08);
  ctx.lineTo(x - asw, shY + s * 0.44);
  ctx.stroke();
  // 머리: 오른쪽을 보는 옆얼굴
  const hr = s * 0.17;
  const hx = x + hr * 0.08;
  const hy = shY - s * 0.17;
  ctx.fillStyle = '#ecc9b0';
  ctx.beginPath();
  ctx.arc(hx, hy, hr, 0, Math.PI * 2);
  ctx.fill();
  // 코
  ctx.beginPath();
  ctx.ellipse(hx + hr * 0.95, hy + hr * 0.12, hr * 0.14, hr * 0.11, 0, 0, Math.PI * 2);
  ctx.fill();
  if (type === 'hood') {
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.arc(hx - hr * 0.12, hy - hr * 0.04, hr * 1.14, Math.PI * 0.45, Math.PI * 1.85);
    ctx.quadraticCurveTo(hx + hr * 0.55, hy - hr * 0.2, hx + hr * 0.25, hy + hr * 0.9);
    ctx.closePath();
    ctx.fill();
  } else {
    // 머리카락: 뒤통수와 정수리, 이마 쪽 앞머리
    ctx.fillStyle = hairColor;
    ctx.beginPath();
    ctx.arc(hx - hr * 0.06, hy - hr * 0.06, hr * 1.04, Math.PI * 0.62, Math.PI * 1.9);
    ctx.quadraticCurveTo(hx + hr * 0.75, hy - hr * 0.55, hx + hr * 0.2, hy - hr * 0.25);
    ctx.quadraticCurveTo(hx - hr * 0.1, hy + hr * 0.2, hx - hr * 0.45, hy + hr * 0.95);
    ctx.closePath();
    ctx.fill();
    if (type === 'blanket') {
      // 긴 머리: 등 뒤로 흘러내림
      ctx.beginPath();
      ctx.moveTo(hx - hr * 1.02, hy);
      ctx.quadraticCurveTo(hx - hr * 1.15, hy + s * 0.25, hx - hr * 0.7, hy + s * 0.34);
      ctx.lineTo(hx - hr * 0.15, hy + s * 0.3);
      ctx.lineTo(hx - hr * 0.3, hy + hr * 0.6);
      ctx.closePath();
      ctx.fill();
    } else if (type === 'scarf') {
      // 단발
      ctx.beginPath();
      ctx.moveTo(hx - hr * 1.02, hy);
      ctx.lineTo(hx - hr * 0.95, hy + hr * 1.05);
      ctx.lineTo(hx - hr * 0.2, hy + hr * 1.0);
      ctx.lineTo(hx - hr * 0.3, hy + hr * 0.5);
      ctx.closePath();
      ctx.fill();
    } else if (type === 'coat') {
      ctx.beginPath();
      ctx.arc(hx - hr * 0.85, hy - hr * 0.55, hr * 0.38, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (type === 'beanie') {
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(hx - hr * 0.05, hy - hr * 0.12, hr * 1.06, Math.PI * 0.95, Math.PI * 1.98);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(hx - hr * 0.2, hy - hr * 1.15, hr * 0.26, 0, Math.PI * 2);
    ctx.fill();
  }
  if (type === 'scarf') {
    ctx.fillStyle = accent;
    ctx.fillRect(x - s * 0.12, shY - s * 0.02, s * 0.24, s * 0.08);
    ctx.fillRect(x - s * 0.14, shY, s * 0.06, s * 0.22); // 뒤로 늘어진 자락
  }
  // 눈과 볼
  ctx.fillStyle = '#2b1d16';
  ctx.beginPath();
  ctx.arc(hx + hr * 0.55, hy + hr * 0.02, Math.max(0.8, hr * 0.09), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(235,130,130,0.45)';
  ctx.beginPath();
  ctx.ellipse(hx + hr * 0.42, hy + hr * 0.38, hr * 0.15, hr * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
