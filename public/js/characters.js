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
const SKIN = '#e9c8b0';
// 우비 색
const RAIN_YELLOW = '#f2c230';
const RAIN_EDGE = '#c9971c';

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

  // 그림자 (장면에서는 바닥에 따로 그려서 뛰어도 그림자는 바닥에 남게)
  if (!o.noShadow) {
    ctx.fillStyle = 'rgba(30,18,12,0.18)';
    ellipse(ctx, x, y + s * 0.015, s * 0.55, s * 0.06);
    ctx.fill();
  }

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
  drawCritter(g, { x: (sz * SPRITE_W) / 2, y: sz * (SPRITE_H - SPRITE_FOOT), s: sz, type, color, lightX, hair, noShadow: true });
  sp = { canvas: c, sz };
  if (spriteCache.size > 800) spriteCache.clear();
  spriteCache.set(key, sp);
  return sp;
}

/**
 * 장면용: 캐시한 몸통 + 실시간 움직임(숨쉬기, 만세, 역광, 음료 김)
 */
export function drawCritterFast(ctx, o) {
  const { x, s, type = 'blanket', color = 0, arms = 0, hop = 0, rim, t = 0, dpr = 1, bright = 1, hair = null } = o;
  const base = o.coat ? RAIN_YELLOW : BLANKETS[color % BLANKETS.length][0];
  const phase = (Math.abs(x * 7 + color * 13) % 100) / 100;
  const breathe = Math.sin(t / 1300 + phase * 6.28);
  const y = o.y - hop * s * 0.25;
  const lightX = rim && rim.a > 0.05 ? rim.x : -1;
  const sp = getSprite(type, color, s, dpr, bright, lightX, hair);
  const k = s / sp.sz;
  const w = sp.sz * SPRITE_W * k;
  const h = sp.sz * SPRITE_H * k;
  const g = geom(x, y, s, breathe);

  // 바닥 그림자: 몸이 떠도 바닥에 남고, 높이 뜰수록 작고 옅게
  ctx.fillStyle = `rgba(30,18,12,${0.18 * (1 - hop * 0.45)})`;
  ellipse(ctx, x, o.y + s * 0.015, s * 0.55 * (1 - hop * 0.25), s * 0.06 * (1 - hop * 0.25));
  ctx.fill();

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

  // 와! 하고 앉은 채로 살짝 뜰 때: 담요 아래로 동그란 엉덩이(바지)와 양옆 신발 밑창이 살짝
  // (색은 걸을 때의 바지·신발과 같게)
  if (hop > 0.05) {
    const dy = s * 0.07 * hop; // 아래로 드러나는 정도
    const PANTS = tone('#3a3640', (bright - 1) * 0.6);
    const SHOE = tone('#2a2628', (bright - 1) * 0.6);
    const SOLE = tone('#7a6a5e', (bright - 1) * 0.6);
    ctx.save();
    // 신발 밑창 (엉덩이 양옆, 뒤꿈치가 보이게)
    for (const sg of [-1, 1]) {
      const fx = x + sg * s * 0.19;
      const fy = y + dy + s * 0.015;
      ctx.fillStyle = SHOE;
      ellipse(ctx, fx, fy, s * 0.07, s * 0.06);
      ctx.fill();
      ctx.fillStyle = SOLE;
      ellipse(ctx, fx, fy + s * 0.014, s * 0.052, s * 0.038);
      ctx.fill();
    }
    // 엉덩이: 바지를 입은 두 개의 둥근 볼록
    ctx.fillStyle = PANTS;
    for (const sg of [-1, 1]) {
      ellipse(ctx, x + sg * s * 0.08, y + dy - s * 0.01, s * 0.105, s * 0.07);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = Math.max(0.6, s * 0.01);
    ctx.beginPath();
    ctx.moveTo(x, y + dy - s * 0.04);
    ctx.lineTo(x, y + dy + s * 0.03);
    ctx.stroke();
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

// ---------- 반려동물 품종 (생김새·크기·귀·꼬리·털·무늬) ----------
// 번호는 서버와 주고받는 값이라 순서를 바꾸지 않습니다 (1 강아지, 2 고양이는 예전부터 쓰던 번호)
export const BREEDS = [
  null,
  { name: '강아지', dog: true, fur: '#b98652', dark: '#8a5f37', ears: 'floppy', tail: 'normal', size: 1 },
  { name: '고양이', dog: false, fur: '#8a8f99', dark: '#5f646e', ears: 'pointy', tail: 'long', size: 1, stripes: true },
  { name: '푸들', dog: true, fur: '#cf8f5c', dark: '#ad6f42', ears: 'curly', tail: 'pom', size: 0.85, fluff: 0.9, legs: 1.3, wide: 0.9, topknot: true },
  { name: '웰시코기', dog: true, fur: '#dc9248', dark: '#b8702f', ears: 'erect', earSize: 1.4, earInner: '#f3dcc4', tail: 'stub', loaf: true, size: 0.95, legs: 0.42, wide: 1.15, long: 1.4, paw: '#f7f1e8', bib: '#f7f1e8', blaze: '#f7f1e8', whiteLegs: true, smile: true },
  { name: '말티즈', dog: true, fur: '#f6f3ee', dark: '#ddd5c8', ears: 'long', tail: 'plume', size: 0.72, fluff: 0.55 },
  { name: '스피츠', dog: true, fur: '#fbfaf7', dark: '#e4dfd5', ears: 'erect', earSize: 0.8, earInner: '#f1d2c8', tail: 'curl', size: 0.9, fluff: 1.35, mane: true, smile: true },
  { name: '페르시안', dog: false, fur: '#efdcbf', dark: '#d4bb94', ears: 'small', earInner: '#efc7b8', tail: 'fluffy', size: 1.05, fluff: 1.3, flat: true, mane: true, bib: '#fbf6ee', eye: '#d98a2b', bigEyes: true },
  { name: '샴', dog: false, fur: '#f0e4cf', dark: '#5a4233', ears: 'pointy', earDark: true, tail: 'long', size: 0.95, paw: '#5a4233', mask: true },
  { name: '장화 고양이', dog: false, fur: '#3d3b42', dark: '#2a292e', ears: 'pointy', tail: 'long', size: 1, paw: '#f4f1ec', boots: true, bib: '#f4f1ec' },
];
export const PET_COUNT = BREEDS.length;
export const PETS = [['없음', ''], ...BREEDS.slice(1).map((b) => [b.name, b.dog ? '🐶' : '🐱'])];
const breedOf = (kind) => BREEDS[kind] || BREEDS[1];

// ---------- 밝기 낮추기 (ctx.filter는 매우 느려서 색 자체를 어둡게) ----------
function dimHex(c, a) {
  if (typeof c !== 'string' || a >= 0.999) return c;
  let m = /^#([0-9a-f]{6})$/i.exec(c);
  if (m) {
    const n = parseInt(m[1], 16);
    const f = (v) => Math.round(v * a);
    return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }
  m = /^#([0-9a-f]{3})$/i.exec(c);
  if (m) return dimHex('#' + [...m[1]].map((h) => h + h).join(''), a);
  m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(c);
  if (m) {
    const f = (v) => Math.round(Number(v) * a);
    return m[4] != null ? `rgba(${f(m[1])},${f(m[2])},${f(m[3])},${m[4]})` : `rgb(${f(m[1])},${f(m[2])},${f(m[3])})`;
  }
  return c;
}
// 이 그림을 그리는 동안만 fillStyle/strokeStyle에 넣는 색을 어둡게 (ctx.restore 때 원래대로)
const FILL = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'fillStyle');
const STROKE = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'strokeStyle');
function dimStyles(ctx, a) {
  if (Object.prototype.hasOwnProperty.call(ctx, 'fillStyle')) return;
  Object.defineProperty(ctx, 'fillStyle', { configurable: true, get: () => FILL.get.call(ctx), set: (v) => FILL.set.call(ctx, dimHex(v, a)) });
  Object.defineProperty(ctx, 'strokeStyle', { configurable: true, get: () => STROKE.get.call(ctx), set: (v) => STROKE.set.call(ctx, dimHex(v, a)) });
  const restore = ctx.restore;
  ctx.restore = function () {
    delete ctx.fillStyle;
    delete ctx.strokeStyle;
    delete ctx.restore;
    restore.call(ctx);
  };
}
function shadeHex(c, a) {
  const n = parseInt(c.slice(1), 16);
  const f = (v) => Math.min(255, Math.round(v * a));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
// 귀: r = 머리 반지름, inner = 귀 안쪽 색(앞모습일 때)
function petEars(ctx, B, x, hy, r, sway, F, D, inner) {
  if (B.ears === 'floppy') {
    for (const sg of [-1, 1]) dogEar(ctx, x, hy, r, sg, sway * sg, D, inner);
  } else if (B.ears === 'long') {
    for (const sg of [-1, 1]) dogEar(ctx, x, hy + r * 0.2, r * 1.2, sg, sway * sg, D, inner);
  } else if (B.ears === 'curly') {
    ctx.fillStyle = D;
    for (const sg of [-1, 1]) for (let i = 0; i < 3; i++) circle(ctx, x + sg * r * (0.9 + 0.06 * i) + sway * sg * r * 0.04, hy - r * 0.2 + i * r * 0.4, r * (0.36 - 0.03 * i));
  } else {
    // 세모 귀: erect(강아지, 크기 조절) / pointy(고양이) / small(페르시안)
    const e = B.ears === 'erect' ? B.earSize || 1 : B.ears === 'small' ? 0.55 : 1;
    const wide = B.ears === 'small' ? 1.12 : 1;
    ctx.fillStyle = B.earDark ? D : B.dog ? D : F;
    for (const sg of [-1, 1]) {
      const b1x = x + sg * r * 0.3 * wide;
      const b1y = hy - r * 0.78;
      const b2x = x + sg * r * 0.98 * wide;
      const b2y = hy - r * 0.32;
      const tx = x + sg * r * (0.88 + 0.06 * e) * wide + sway * sg * r * 0.03;
      const ty = hy - r * (0.75 + 0.72 * e);
      ctx.beginPath();
      ctx.moveTo(b1x, b1y);
      ctx.lineTo(tx, ty);
      ctx.lineTo(b2x, b2y);
      ctx.closePath();
      ctx.fill();
      if (inner) {
        ctx.fillStyle = inner;
        ctx.beginPath();
        ctx.moveTo(b1x + (tx - b1x) * 0.25 + sg * r * 0.05, b1y + (ty - b1y) * 0.2);
        ctx.lineTo(tx + (b1x + b2x - 2 * tx) * 0.15, ty + (b1y + b2y - 2 * ty) * 0.15);
        ctx.lineTo(b2x + (tx - b2x) * 0.25 - sg * r * 0.03, b2y + (ty - b2y) * 0.25);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = B.earDark ? D : B.dog ? D : F;
      }
    }
  }
}
// 털이 풍성한 품종: 테두리를 따라 동글동글한 털뭉치
function fluffRing(ctx, cx, cy, rx, ry, n, pr, col) {
  ctx.fillStyle = col;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    circle(ctx, cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, pr);
  }
}
// 스피츠처럼 등 위로 말린 풍성한 꼬리
function curlPlume(ctx, x, y, k, rot, F, D) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = D;
  ctx.beginPath();
  ctx.ellipse(0, 0, k * 0.21, k * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = F;
  ctx.beginPath();
  ctx.ellipse(-k * 0.01, -k * 0.015, k * 0.19, k * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 5; i++) circle(ctx, Math.cos(i * 1.25) * k * 0.17, Math.sin(i * 1.25) * k * 0.11, k * 0.06);
  ctx.restore();
}

// 가만히 앉아 있을 때(꼬리·고개·점프·쓰다듬기 없음)는 그려 둔 그림을 다시 씀 (150마리도 가볍게)
const petCache = new Map();
function petStill(o) {
  if (o.hop > 0.001 || o.petted > 0.001) return false;
  const B = breedOf(o.kind);
  const seed = Math.round(Math.abs(o.x)) % 997;
  const t = o.t || 0;
  const wag = B.dog ? episode(t, seed, 6000, 1100, 0.3) : episode(t, seed, 9000, 1600, 0.35);
  const tilt = episode(t, seed + 41, B.dog ? 5600 : 7400, B.dog ? 1300 : 1700, 0.35);
  return wag === 0 && tilt === 0;
}

export function drawPet(ctx, o) {
  const { x, y, s, kind = 1, t = 0, bright = 1, hop = 0, walking = false, petted = 0 } = o;
  if (!kind) return;
  if (walking) return drawPetWalk(ctx, o);
  if (!o.noCache && petStill(o)) {
    const dpr = Math.min(3, ctx.getTransform().a || 1);
    const sz = Math.max(4, Math.round(s * 2) / 2);
    const key = `${kind}|${sz}|${Math.round(bright * 20)}|${o.coat ? 1 : 0}|${dpr}`;
    let c = petCache.get(key);
    if (!c) {
      const k = sz * 0.42 * breedOf(kind).size;
      const w = Math.ceil(k * 1.6);
      const h = Math.ceil(k * 1.5);
      c = document.createElement('canvas');
      c.width = Math.ceil(w * dpr);
      c.height = Math.ceil(h * dpr);
      const g = c.getContext('2d');
      g.scale(dpr, dpr);
      // 꼬리·고개가 멈춘 시각(t=0이 아닌, 이 자리의 정지 상태)으로 그림
      drawPet(g, { ...o, x: w / 2, y: h - k * 0.12, s: sz, noCache: true, frozen: true, bright: Math.round(bright * 20) / 20 });
      c.ox = w / 2;
      c.oy = h - k * 0.12;
      c.w = w;
      c.h = h;
      if (petCache.size > 600) petCache.clear();
      petCache.set(key, c);
    }
    ctx.drawImage(c, x - c.ox, y - c.oy, c.w, c.h);
    return;
  }
  const B = breedOf(kind);
  const dog = B.dog;
  const k = s * 0.42 * B.size; // 사람의 절반쯤 크기 (품종마다 다름)
  const W = B.wide || 1;
  const by = y - hop * k * 0.55;
  const F = shadeHex(B.fur, bright);
  const D = shadeHex(B.dark, bright);
  const P = B.paw ? shadeHex(B.paw, bright) : D;
  ctx.save();
  // 그림자
  ctx.fillStyle = `rgba(30,18,12,${0.16 * (1 - hop * 0.5)})`;
  ctx.beginPath();
  ctx.ellipse(x, y + k * 0.02, k * 0.5 * W * (1 - hop * 0.35), k * 0.07 * (1 - hop * 0.35), 0, 0, Math.PI * 2);
  ctx.fill();
  const seed = Math.round(Math.abs(x)) % 997;
  // 뛰어오를 때: 네 발이 아래로 쭉 (몸 뒤에서 먼저 그려 몸 아래로만 보이게)
  if (hop > 0.04) {
    const L = k * (0.08 + 0.2 * hop) * (B.legs || 1);
    ctx.lineCap = 'round';
    for (const [dx, len, w] of [[-0.25, 1, 0.13], [0.25, 1, 0.13], [-0.1, 0.85, 0.11], [0.1, 0.85, 0.11]]) {
      ctx.strokeStyle = B.boots ? P : shadeHex(B.fur, bright * 0.9);
      ctx.lineWidth = k * w;
      ctx.beginPath();
      ctx.moveTo(x + dx * k * W, by - k * 0.08);
      ctx.lineTo(x + dx * k * W * 1.05, by + L * len);
      ctx.stroke();
      ctx.fillStyle = P;
      ctx.beginPath();
      ctx.ellipse(x + dx * k * W * 1.05, by + L * len, k * w * 0.62, k * w * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // 쓰다듬어 주면 꼬리를 살랑살랑 (평소엔 가끔)
  const wag = o.frozen ? 0 : petted > 0.02 ? Math.sin(t / (dog ? 150 : 220)) * Math.min(1, petted * 1.4) : dog ? episode(t, seed, 6000, 1100, 0.3) : episode(t, seed, 9000, 1600, 0.35);
  // 풍성한 털 (몸 뒤에서, 우비 입으면 우비 속에)
  if (B.fluff && !o.coat) {
    ctx.fillStyle = F;
    for (let i = 0; i < 6; i++) {
      const u = i / 5;
      const half = k * W * (0.37 - 0.17 * u);
      for (const sg of [-1, 1]) circle(ctx, x + sg * half, by - k * (0.04 + 0.56 * u), k * 0.075 * B.fluff);
    }
  }
  // 몸 (앉은 뒷모습: 위는 좁고 엉덩이는 넓은 배 모양)
  ctx.fillStyle = F;
  ctx.beginPath();
  ctx.moveTo(x - k * 0.2 * W, by - k * 0.62);
  ctx.bezierCurveTo(x - k * 0.3 * W, by - k * 0.45, x - k * 0.42 * W, by - k * 0.12, x - k * 0.34 * W, by - k * 0.02);
  ctx.quadraticCurveTo(x, by + k * 0.03, x + k * 0.34 * W, by - k * 0.02);
  ctx.bezierCurveTo(x + k * 0.42 * W, by - k * 0.12, x + k * 0.3 * W, by - k * 0.45, x + k * 0.2 * W, by - k * 0.62);
  ctx.closePath();
  ctx.fill();
  // 살짝 보이는 뒷발 (앉아 있을 때만)
  if (hop <= 0.04) for (const sg of [-1, 1]) {
    ctx.fillStyle = P;
    ctx.beginPath();
    ctx.ellipse(x + sg * k * 0.3 * W, by - k * 0.01, k * 0.09, k * 0.045, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (o.coat) petCape(ctx, x, by, k, W, bright);
  // 꼬리 (품종마다)
  ctx.lineCap = 'round';
  if (B.tail === 'stub') {
    // 웰시코기: 바닥에 퍼진 동그란 식빵 엉덩이 + 짧은 꼬리가 살랑 (우비 입으면 우비 속에)
    if (B.loaf && !o.coat) {
      ctx.fillStyle = F;
      for (const sg of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(x + sg * k * 0.17, by - k * 0.1, k * 0.2, k * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = D;
      ctx.lineWidth = Math.max(0.7, k * 0.018);
      ctx.beginPath();
      ctx.moveTo(x, by - k * 0.16);
      ctx.lineTo(x, by - k * 0.01);
      ctx.stroke();
    }
    ctx.fillStyle = F;
    ctx.beginPath();
    ctx.ellipse(x + wag * k * 0.04, by - k * (B.loaf ? 0.22 : 0.14), k * 0.065, k * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (B.tail === 'curl') {
    curlPlume(ctx, x + k * 0.14 + wag * k * 0.03, by - k * (0.42 + hop * 0.08), k, -0.5 + wag * 0.15, F, D);
  } else if (B.tail === 'pom') {
    const ex = x + k * (0.16 + wag * 0.06);
    const ey = by - k * (0.34 + hop * 0.1);
    ctx.strokeStyle = F;
    ctx.lineWidth = k * 0.07;
    ctx.beginPath();
    ctx.moveTo(x, by - k * 0.1);
    ctx.quadraticCurveTo(x + k * 0.12, by - k * 0.14, ex, ey);
    ctx.stroke();
    ctx.fillStyle = D;
    circle(ctx, ex, ey, k * 0.1);
    ctx.fillStyle = F;
    circle(ctx, ex - k * 0.015, ey - k * 0.015, k * 0.085);
  } else {
    // 강아지·고양이 기본, 말티즈(풍성), 페르시안(복슬): 엉덩이에서 바닥을 따라 옆으로 말림
    const thick = B.tail === 'fluffy' ? 0.17 : B.tail === 'plume' ? 0.14 : dog ? 0.1 : 0.08;
    ctx.strokeStyle = B.tail === 'fluffy' || B.tail === 'plume' ? F : D;
    ctx.lineWidth = k * thick;
    ctx.beginPath();
    ctx.moveTo(x, by - k * 0.08);
    if (hop > 0.04) {
      ctx.quadraticCurveTo(x + k * 0.3, by - k * 0.05, x + k * 0.36, by - k * (0.3 + 0.2 * hop));
    } else {
      ctx.quadraticCurveTo(x + k * 0.22, by, x + k * 0.4, by - k * (0.06 + Math.max(0, wag) * 0.1));
      ctx.quadraticCurveTo(x + k * 0.52, by - k * (0.12 + wag * 0.15), x + k * (0.48 + wag * 0.08), by - k * (0.26 + wag * 0.2));
    }
    ctx.stroke();
    if (B.tail === 'fluffy' && hop <= 0.04) {
      // 길고 복슬복슬한 꼬리털
      ctx.fillStyle = F;
      for (let i = 0; i < 6; i++) {
        const u = i / 5;
        circle(ctx, x + k * (0.12 + 0.36 * u + wag * 0.06 * u), by - k * (0.02 + 0.2 * u * u + Math.max(0, wag) * 0.1 * u), k * (0.09 + 0.03 * u));
      }
    }
  }
  // 스피츠: 목 둘레 갈기털
  if (B.mane && !o.coat) fluffRing(ctx, x, by - k * 0.62, k * 0.24, k * 0.1, 12, k * 0.09, F);
  // 웰시코기: 목 양옆으로 보이는 하얀 털
  if (B.blaze && !o.coat) {
    ctx.fillStyle = shadeHex(B.blaze, bright);
    for (const sg of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(x + sg * k * 0.17 * W, by - k * 0.56, k * 0.055, k * 0.09, sg * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // 머리: 까딱까딱 고개를 갸웃 (가끔 멈췄다 다시), 쓰다듬는 사람(왼쪽)을 힐끔
  const hy = by - k * 0.82;
  const hr = k * 0.26;
  const look = Math.min(1, petted * 1.5);
  const tilt = o.frozen ? 0 : (dog ? 0.28 : 0.22) * episode(t, seed + 41, dog ? 5600 : 7400, dog ? 1300 : 1700, 0.35) * (1 - look) - 0.38 * look;
  ctx.save();
  ctx.translate(x, hy + k * 0.2);
  ctx.rotate(tilt);
  ctx.translate(-x, -(hy + k * 0.2));
  if (B.fluff && !o.coat) fluffRing(ctx, x, hy, hr * 0.95, hr * 0.9, 10, k * 0.07 * B.fluff, F);
  ctx.fillStyle = F;
  circle(ctx, x, hy, hr);
  if (B.topknot && !o.coat) fluffRing(ctx, x + hr * 0.25 * look, hy - hr * 0.8, hr * 0.45, hr * 0.25, 7, hr * 0.28, F);
  // 고개를 돌리면 귀도 머리 뒤쪽(오른쪽)으로 옮겨가며 살짝 좁아짐
  ctx.save();
  ctx.translate(x + hr * 0.28 * look, hy);
  ctx.scale(1 - 0.18 * look, 1);
  ctx.translate(-x, -hy);
  if (!o.coat) petEars(ctx, B, x, hy, hr, tilt * 2, F, D, null);
  ctx.restore();
  if (o.coat) petHood(ctx, B, x + hr * 0.12 * look, hy, hr, tilt * 2, bright, false);
  if (B.stripes && !o.coat) {
    ctx.strokeStyle = D;
    ctx.lineWidth = Math.max(0.8, k * 0.04);
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * k * 0.12, by - k * 0.62);
      ctx.lineTo(x + i * k * 0.1, by - k * 0.45);
      ctx.stroke();
    }
  }
  // 힐끔: 고개를 사람 쪽(왼쪽)으로 돌려 옆얼굴이 살짝 보임 (주둥이·코가 머리 옆으로 삐져나오고, 그 위에 행복한 눈)
  if (look > 0.3) {
    const a = Math.min(1, (look - 0.3) / 0.3);
    ctx.globalAlpha = a;
    const mx = x - hr * (0.92 + 0.08 * a);
    const my = hy + hr * 0.26;
    ctx.fillStyle = B.mask ? D : B.blaze ? shadeHex(B.blaze, bright) : F;
    ctx.beginPath();
    ctx.ellipse(mx, my, hr * (B.flat ? 0.22 : 0.34), hr * 0.24, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b1d16';
    circle(ctx, mx - hr * (B.flat ? 0.18 : 0.3), my - hr * 0.06, Math.max(0.9, hr * 0.11));
    const darkFur = B.fur === '#3d3b42';
    ctx.strokeStyle = darkFur ? 'rgba(250,240,225,0.9)' : 'rgba(40,25,20,0.85)';
    ctx.lineWidth = Math.max(0.8, k * 0.03);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x - hr * 0.62, hy - hr * 0.08, hr * 0.13, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    ctx.fillStyle = 'rgba(240,130,130,0.5)';
    ctx.beginPath();
    ctx.ellipse(x - hr * 0.55, hy + hr * 0.2, hr * 0.13, hr * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  // 목줄 / 방울 (우비를 입으면 우비 속에)
  if (!o.coat) {
    ctx.fillStyle = dog ? '#c9574e' : '#e2b04a';
    ctx.beginPath();
    ctx.ellipse(x, hy + k * 0.24, k * 0.2, k * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// 걷는 반려동물: 네 발로 총총 (뒷모습/앞모습)
function drawPetWalk(ctx, o) {
  if (o.face === 'left' || o.face === 'right') return drawPetSide(ctx, o);
  const { x, y, s, kind = 1, bright = 1, still = false } = o;
  const B = breedOf(kind);
  const facingFront = o.face === 'front';
  const t = o.t || 0;
  const dog = B.dog;
  const F = shadeHex(B.fur, bright);
  const D = shadeHex(B.dark, bright);
  const P = B.paw ? shadeHex(B.paw, bright) : null;
  const k = s * 0.42 * B.size;
  const W = B.wide || 1;
  const yOff = k * 0.2 * (1 - (B.legs || 1)); // 다리가 짧으면 몸이 낮게
  const ph = still ? 0 : t / (dog ? 95 : 120);
  const bob = Math.abs(Math.sin(ph)) * k * 0.05;
  const by = y - bob;
  ctx.save();
  ctx.fillStyle = 'rgba(30,18,12,0.16)';
  ctx.beginPath();
  ctx.ellipse(x, y + k * 0.02, k * 0.42 * W, k * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  const leg = (lx, off, top, w, col) => {
    const lift = Math.max(0, Math.sin(ph + off)) * k * 0.07;
    const fy = y - lift - k * 0.02;
    ctx.strokeStyle = B.boots || B.whiteLegs ? P : col;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x + lx * k * W, by - top + yOff);
    ctx.lineTo(x + lx * k * W, fy);
    ctx.stroke();
    ctx.fillStyle = P || col;
    ctx.beginPath();
    ctx.ellipse(x + lx * k * W, fy, w * 0.6, w * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  ctx.lineCap = 'round';
  leg(-0.12, Math.PI, k * 0.3, k * 0.1, D);
  leg(0.12, 0, k * 0.3, k * 0.1, D);
  // 꼬리 (걸을 때는 위로 들고 신나게)
  const wag = Math.sin(t / (dog ? 90 : 260)) * (dog ? 1 : 0.5);
  const bodyY = by - k * 0.4 + yOff;
  const drawTail = () => {
    if (B.loaf && !facingFront) {
      // 웰시코기 식빵 엉덩이: 통통한 두 볼기 + 하얀 털 바지 + 짧은 꼬리, 걸을 때 씰룩
      const wig = Math.sin(ph) * k * 0.025;
      const cy = bodyY + k * 0.04;
      ctx.fillStyle = shadeHex(B.blaze, bright);
      for (const sg of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(x + sg * k * 0.11 + wig, cy + k * 0.08, k * 0.12, k * 0.08, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = F;
      for (const sg of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(x + sg * k * 0.115 + wig, cy, k * 0.135, k * 0.13, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = D;
      ctx.lineWidth = Math.max(0.7, k * 0.018);
      ctx.beginPath();
      ctx.moveTo(x + wig, cy - k * 0.04);
      ctx.lineTo(x + wig, cy + k * 0.1);
      ctx.stroke();
      ctx.fillStyle = F;
      ctx.beginPath();
      ctx.ellipse(x + wig + Math.sin(t / 120) * k * 0.015, cy - k * 0.13, k * 0.055, k * 0.045, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    if (B.tail === 'stub') {
      if (facingFront) return;
      ctx.fillStyle = F;
      ctx.beginPath();
      ctx.ellipse(x + wag * k * 0.02, bodyY + k * 0.05, k * 0.07, k * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    if (B.tail === 'curl') {
      curlPlume(ctx, x + (facingFront ? k * 0.18 : wag * k * 0.03), bodyY - k * (facingFront ? 0.22 : 0.12), k, -0.4 + wag * 0.1, F, D);
      return;
    }
    const thick = B.tail === 'fluffy' ? 0.16 : B.tail === 'plume' ? 0.14 : dog ? 0.11 : 0.08;
    ctx.lineWidth = k * thick;
    ctx.lineCap = 'round';
    ctx.beginPath();
    let ex;
    let ey;
    if (facingFront) {
      ctx.strokeStyle = dog || B.tail === 'fluffy' ? F : D;
      ctx.moveTo(x + k * 0.05, bodyY - k * 0.05);
      ex = x + k * (0.24 + wag * 0.12);
      ey = bodyY - k * 0.32;
      ctx.quadraticCurveTo(x + k * (0.2 + wag * 0.08), bodyY - k * 0.2, ex, ey);
    } else {
      ctx.strokeStyle = B.tail === 'fluffy' || B.tail === 'plume' ? F : D;
      ctx.moveTo(x, bodyY + k * 0.1);
      ex = x + wag * k * 0.22;
      ey = bodyY - k * (dog ? 0.2 : 0.28);
      ctx.quadraticCurveTo(x + wag * k * 0.12, bodyY - k * 0.08, ex, ey);
    }
    ctx.stroke();
    if (B.tail === 'pom' || B.tail === 'fluffy') {
      ctx.fillStyle = F;
      circle(ctx, ex, ey, k * (B.tail === 'fluffy' ? 0.12 : 0.1));
    }
  };
  if (facingFront) drawTail();
  // 몸통 (서 있으니 낮고 넓게)
  if (B.fluff && !o.coat) fluffRing(ctx, x, bodyY, k * 0.25 * W, k * 0.18, 10, k * 0.07 * B.fluff, F);
  ctx.fillStyle = F;
  ctx.beginPath();
  ctx.ellipse(x, bodyY, k * 0.26 * W, k * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  if (o.coat) {
    // 우비 망토: 몸통을 감쌈 (다리는 앞에 보임)
    const Y = tone(RAIN_YELLOW, (bright - 1) * 0.6);
    ctx.fillStyle = Y;
    ctx.beginPath();
    ctx.ellipse(x, bodyY - k * 0.02, k * 0.29 * W, k * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = tone(RAIN_EDGE, (bright - 1) * 0.6);
    ctx.lineWidth = Math.max(0.7, k * 0.02);
    ctx.beginPath();
    ctx.moveTo(x, bodyY - k * 0.22);
    ctx.lineTo(x, bodyY + k * 0.18);
    ctx.stroke();
  }
  // 앞쪽 다리 한 쌍 (짧고 통통하게, 번갈아 걸음)
  leg(-0.15, 0, k * 0.26, k * 0.12, F);
  leg(0.15, Math.PI, k * 0.26, k * 0.12, F);
  if (!facingFront) drawTail();
  // 머리
  const hy = by - k * 0.7 + yOff;
  const hr = k * 0.22;
  const hx = x + Math.sin(ph * 0.5) * k * 0.02;
  if (B.mane) {
    // 스피츠: 목과 가슴을 감싸는 풍성한 갈기털
    fluffRing(ctx, x, hy + hr * 0.9, hr * 0.85, hr * 0.55, 12, k * 0.09, F);
    ctx.fillStyle = F;
    ctx.beginPath();
    ctx.ellipse(x, hy + hr * 0.9, hr * 0.95, hr * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (B.mane && o.coat) {
    // 우비 깃: 목둘레를 감쌈
  } else if (B.fluff) fluffRing(ctx, hx, hy, hr * 0.95, hr * 0.9, 10, k * 0.065 * B.fluff, F);
  ctx.fillStyle = F;
  circle(ctx, hx, hy, hr);
  if (B.topknot && !o.coat) fluffRing(ctx, hx, hy - hr * 0.8, hr * 0.45, hr * 0.25, 7, hr * 0.28, F);
  if (o.coat) petHood(ctx, B, hx, hy, hr, Math.sin(ph * 2) * 0.3, bright, facingFront);
  else petEars(ctx, B, hx, hy, hr, Math.sin(ph * 2), F, D, facingFront ? B.earInner || '#d9a08a' : null);
  if (facingFront && B.bib && !o.coat) {
    ctx.fillStyle = shadeHex(B.bib, bright);
    ctx.beginPath();
    ctx.ellipse(x, hy + hr * 1.05, hr * 0.55, hr * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (!o.coat) {
    ctx.fillStyle = dog ? '#c9574e' : '#e2b04a';
    ctx.beginPath();
    ctx.ellipse(x, hy + k * 0.2, k * 0.17, k * 0.045, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (facingFront) {
    // 앞을 보고 걸어올 때 얼굴
    if (B.mask) {
      ctx.fillStyle = D;
      ctx.beginPath();
      ctx.ellipse(hx, hy + hr * 0.25, hr * 0.55, hr * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (B.blaze) {
      // 웰시코기: 이마에서 코까지 하얀 줄무늬 + 하얀 주둥이
      ctx.fillStyle = shadeHex(B.blaze, bright);
      ctx.beginPath();
      ctx.moveTo(hx - hr * 0.1, hy - hr * 0.85);
      ctx.quadraticCurveTo(hx, hy - hr * 0.95, hx + hr * 0.1, hy - hr * 0.85);
      ctx.lineTo(hx + hr * 0.16, hy + hr * 0.05);
      ctx.lineTo(hx - hr * 0.16, hy + hr * 0.05);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(hx, hy + hr * 0.42, hr * 0.5, hr * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (B.boots) {
      // 턱시도처럼 입가가 하얀 고양이
      ctx.fillStyle = shadeHex(B.paw, bright);
      ctx.beginPath();
      ctx.ellipse(hx, hy + hr * 0.4, hr * 0.42, hr * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const eyeCol = B.eye || (B.mask ? '#5aa0d8' : B.fur === '#3d3b42' ? '#d8b84a' : '#2b1d16');
    ctx.fillStyle = eyeCol;
    for (const sg of [-1, 1]) circle(ctx, hx + sg * k * 0.08, hy - k * 0.01, Math.max(0.8, k * (B.bigEyes ? 0.055 : B.flat ? 0.04 : 0.03)));
    if (B.bigEyes) {
      // 동그란 호박색 눈 + 까만 눈동자 + 반짝
      ctx.fillStyle = '#2b1d16';
      for (const sg of [-1, 1]) circle(ctx, hx + sg * k * 0.08, hy - k * 0.005, Math.max(0.6, k * 0.03));
      ctx.fillStyle = '#fff';
      for (const sg of [-1, 1]) circle(ctx, hx + sg * k * 0.08 + k * 0.015, hy - k * 0.025, Math.max(0.4, k * 0.012));
    }
    ctx.fillStyle = '#2b1d16';
    ctx.beginPath();
    ctx.ellipse(hx, hy + k * (B.flat ? 0.05 : 0.08), k * (B.flat ? 0.025 : 0.035), k * 0.022, 0, 0, Math.PI * 2);
    ctx.fill();
    if (B.smile) {
      // 웃는 입과 살짝 내민 혀
      ctx.fillStyle = '#e8737a';
      ctx.beginPath();
      ctx.ellipse(hx, hy + k * 0.135, k * 0.035, k * 0.03, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2b1d16';
      ctx.lineWidth = Math.max(0.7, k * 0.014);
      ctx.beginPath();
      ctx.moveTo(hx - k * 0.06, hy + k * 0.1);
      ctx.quadraticCurveTo(hx - k * 0.03, hy + k * 0.125, hx, hy + k * 0.1);
      ctx.quadraticCurveTo(hx + k * 0.03, hy + k * 0.125, hx + k * 0.06, hy + k * 0.1);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// 옆모습 반려동물 (총총 걷기)
function drawPetSide(ctx, o) {
  const { x, y, s, kind = 1, bright = 1, still = false } = o;
  const B = breedOf(kind);
  const t = o.t || 0;
  const d = o.face === 'left' ? -1 : 1;
  const dog = B.dog;
  const F = shadeHex(B.fur, bright);
  const D = shadeHex(B.dark, bright);
  const P = B.paw ? shadeHex(B.paw, bright) : null;
  const k = s * 0.42 * B.size;
  const W = B.long || B.wide || 1; // 옆모습에서는 몸 길이 (웰시코기는 길쭉)
  const legs = B.legs || 1;
  const yOff = k * 0.2 * (1 - legs);
  const ph = still ? 0 : t / (dog ? 95 : 120);
  const by = y - Math.abs(Math.sin(ph)) * k * 0.04 + yOff;
  ctx.save();
  ctx.fillStyle = 'rgba(30,18,12,0.16)';
  ctx.beginPath();
  ctx.ellipse(x, y + k * 0.02, k * 0.48 * W, k * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  // 다리 네 개 (앞뒤 엇갈림)
  ctx.lineCap = 'round';
  ctx.lineWidth = k * 0.09;
  for (const [lx, off] of [[-0.24, 0], [-0.14, Math.PI], [0.18, Math.PI], [0.28, 0]]) {
    const sw = Math.sin(ph + off) * k * 0.08 * legs;
    const lift = Math.max(0, Math.cos(ph + off)) * k * 0.05 * legs;
    const fx = x + d * (lx * k * W + sw);
    const fy = y - lift;
    ctx.strokeStyle = B.boots || B.whiteLegs ? P : D;
    ctx.beginPath();
    ctx.moveTo(x + d * lx * k * W, by - k * 0.3);
    ctx.lineTo(fx, fy);
    ctx.stroke();
    if (P) {
      ctx.fillStyle = P;
      ctx.beginPath();
      ctx.ellipse(fx + d * k * 0.02, fy, k * 0.06, k * 0.035, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // 꼬리
  const wag = Math.sin(t / (dog ? 90 : 260)) * (dog ? 1 : 0.5);
  const rx = x - d * k * 0.3 * W;
  if (B.tail === 'stub') {
    ctx.fillStyle = F;
    ctx.beginPath();
    ctx.ellipse(rx - d * k * 0.04, by - k * 0.45, k * 0.06, k * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (B.tail === 'curl') {
    curlPlume(ctx, rx + d * k * 0.06, by - k * 0.6, k, d * (0.3 + wag * 0.1), F, D);
  } else {
    const thick = B.tail === 'fluffy' ? 0.16 : B.tail === 'plume' ? 0.14 : dog ? 0.11 : 0.08;
    ctx.strokeStyle = dog || B.tail === 'fluffy' || B.tail === 'plume' ? F : D;
    ctx.lineWidth = k * thick;
    const ex = x - d * k * (0.42 + wag * 0.1) * W;
    const ey = by - k * (dog ? 0.7 : 0.85);
    ctx.beginPath();
    ctx.moveTo(rx, by - k * 0.4);
    ctx.quadraticCurveTo(x - d * k * (0.45 + wag * 0.05) * W, by - k * 0.62, ex, ey);
    ctx.stroke();
    if (B.tail === 'pom' || B.tail === 'fluffy') {
      ctx.fillStyle = F;
      if (B.tail === 'fluffy') for (let i = 1; i <= 4; i++) circle(ctx, rx + (ex - rx) * (i / 4), by - k * 0.4 + (ey - by + k * 0.4) * (i / 4), k * 0.1);
      else circle(ctx, ex, ey, k * 0.1);
    }
  }
  // 몸통
  if (B.fluff) fluffRing(ctx, x, by - k * 0.38, k * 0.34 * W, k * 0.15, 12, k * 0.065 * B.fluff, F);
  ctx.fillStyle = F;
  ctx.beginPath();
  ctx.ellipse(x, by - k * 0.38, k * 0.36 * W, k * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  if (B.bib && !o.coat) {
    ctx.fillStyle = shadeHex(B.bib, bright);
    ctx.beginPath();
    ctx.ellipse(x + d * k * 0.24 * W, by - k * 0.32, k * 0.12, k * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (o.coat) {
    // 우비: 등과 옆구리를 덮는 망토
    ctx.fillStyle = tone(RAIN_YELLOW, (bright - 1) * 0.6);
    ctx.beginPath();
    ctx.ellipse(x - d * k * 0.02, by - k * 0.42, k * 0.38 * W, k * 0.15, 0, Math.PI, 0);
    ctx.lineTo(x + d * k * 0.36 * W, by - k * 0.34);
    ctx.quadraticCurveTo(x, by - k * 0.22, x - d * k * 0.4 * W, by - k * 0.34);
    ctx.fill();
  }
  // 머리
  const hx = x + d * k * 0.38 * W;
  const hy = by - k * 0.58;
  if (B.fluff) fluffRing(ctx, hx, hy, k * 0.17, k * 0.16, 9, k * 0.06 * B.fluff, F);
  ctx.fillStyle = F;
  circle(ctx, hx, hy, k * 0.18);
  ctx.beginPath();
  ctx.ellipse(hx + d * k * (B.flat ? 0.1 : B.topknot ? 0.19 : 0.15), hy + k * 0.05, k * (B.flat ? 0.07 : B.topknot ? 0.13 : 0.1), k * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  if (B.topknot) fluffRing(ctx, hx - d * k * 0.02, hy - k * 0.15, k * 0.08, k * 0.05, 7, k * 0.055, F);
  if (B.mask) {
    ctx.fillStyle = D;
    ctx.beginPath();
    ctx.ellipse(hx + d * k * 0.13, hy + k * 0.04, k * 0.11, k * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (B.blaze) {
    // 웰시코기: 하얀 주둥이와 볼, 하얀 배
    ctx.fillStyle = shadeHex(B.blaze, bright);
    ctx.beginPath();
    ctx.ellipse(hx + d * k * 0.15, hy + k * 0.07, k * 0.11, k * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + d * k * 0.05, by - k * 0.27, k * 0.26 * W, k * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (o.coat) {
    // 우비 모자: 정수리와 뒤통수를 덮고 얼굴(앞쪽)은 보이게
    ctx.fillStyle = tone(RAIN_YELLOW, (bright - 1) * 0.6);
    ctx.beginPath();
    ctx.arc(hx - d * k * 0.02, hy, k * 0.205, d > 0 ? Math.PI * 0.55 : Math.PI * 0.45, d > 0 ? Math.PI * 1.9 : Math.PI * 1.1, d < 0);
    ctx.quadraticCurveTo(hx + d * k * 0.05, hy + k * 0.05, hx - d * k * 0.1, hy + k * 0.18);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = o.coat ? tone(RAIN_YELLOW, (bright - 1) * 0.6) : D;
  if (B.ears === 'floppy' || B.ears === 'long') {
    // 옆에서 본 늘어진 귀: 걸음마다 펄럭
    const fl = Math.sin(ph * 2) * 0.12;
    const L = B.ears === 'long' ? 1.35 : 1;
    ctx.save();
    ctx.translate(hx - d * k * 0.1, hy - k * 0.12);
    ctx.rotate(d * (0.2 + fl));
    ctx.beginPath();
    ctx.moveTo(-k * 0.06, k * 0.01);
    ctx.bezierCurveTo(-k * 0.12, k * 0.1 * L, -k * 0.1, k * 0.26 * L, -k * 0.02, k * 0.28 * L);
    ctx.bezierCurveTo(k * 0.06, k * 0.29 * L, k * 0.08, k * 0.12 * L, k * 0.06, k * 0.01);
    ctx.quadraticCurveTo(0, -k * 0.04, -k * 0.06, k * 0.01);
    ctx.fill();
    ctx.restore();
  } else if (B.ears === 'curly') {
    for (let i = 0; i < 3; i++) circle(ctx, hx - d * k * 0.06, hy - k * 0.04 + i * k * 0.08, k * (0.08 - 0.008 * i));
  } else {
    const e = B.ears === 'erect' ? B.earSize || 1 : B.ears === 'small' ? 0.55 : 1;
    ctx.fillStyle = o.coat ? tone(RAIN_YELLOW, (bright - 1) * 0.6) : B.earDark ? D : dog ? D : F;
    ctx.beginPath();
    ctx.moveTo(hx - d * k * 0.04, hy - k * 0.14);
    ctx.lineTo(hx + d * k * 0.04, hy - k * (0.14 + 0.16 * e));
    ctx.lineTo(hx + d * k * 0.12, hy - k * 0.1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = B.eye || (B.mask ? '#5aa0d8' : B.fur === '#3d3b42' ? '#d8b84a' : '#2b1d16');
  circle(ctx, hx + d * k * 0.08, hy - k * 0.02, Math.max(0.8, k * (B.bigEyes ? 0.045 : 0.03)));
  if (B.bigEyes) {
    ctx.fillStyle = '#2b1d16';
    circle(ctx, hx + d * k * 0.09, hy - k * 0.02, Math.max(0.5, k * 0.022));
  }
  ctx.fillStyle = '#2b1d16';
  circle(ctx, hx + d * k * (B.flat ? 0.17 : 0.24), hy + k * 0.04, Math.max(0.7, k * 0.025));
  if (!o.coat) {
    ctx.fillStyle = dog ? '#c9574e' : '#e2b04a';
    ctx.beginPath();
    ctx.ellipse(hx - d * k * 0.05, hy + k * 0.16, k * 0.05, k * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// 고르기 화면용 반려동물 그림 (앞을 보고 선 모습)
export function renderPetPortrait(canvas, kind) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth || 56;
  const h = canvas.clientHeight || 50;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  if (!kind) return;
  const size = breedOf(kind).size;
  drawPetWalk(g, { x: w / 2, y: h * 0.94, s: (h * 2.1) / Math.max(0.9, size) * Math.min(1, size + 0.15), kind, still: true, face: 'front', t: 0 });
}

// ---------- 걷는 사람 (서서 걸어가는 뒷모습) ----------
export function drawWalker(ctx, o) {
  if (o.face === 'left' || o.face === 'right') return drawWalkerSide(ctx, o);
  if (o.face === 'front') return drawWalkerBackOrFront(ctx, o, true);
  return drawWalkerBackOrFront(ctx, o, false);
}

function drawWalkerBackOrFront(ctx, o, front) {
  const { x, y, s, type: type0 = 'blanket', color = 0, bright = 1, dir = 0, still = false } = o;
  const t = still ? 0 : o.t || 0; // 서서 쉬는 중이면 다리 멈춤
  // 우비: 몸·팔은 노랑, 머리는 모자(hood처럼) - 얼굴은 모자 위에 그려져 늘 앞에 보임
  const type = o.coat ? 'hood' : type0;
  const [base0, accent] = BLANKETS[color % BLANKETS.length];
  const base = o.coat ? RAIN_YELLOW : base0;
  const hairIdx = o.hair;
  const hairColor = hairIdx != null && HAIRS[hairIdx] ? HAIRS[hairIdx][1] : HAIR[(color + type0.length) % HAIR.length];
  const ph = t / 150;
  const bob = Math.abs(Math.sin(ph)) * s * 0.03;
  const lean = dir * 0.06;
  ctx.save();
  if (bright < 0.999) dimStyles(ctx, bright); // 느린 필터 대신 색을 직접 어둡게 (ctx.restore로 원래대로)
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
  const hemY = o.coat || type === 'blanket' || type === 'coat' ? y - s * 0.32 - bob : hipY + s * 0.05;
  // 머리 모양 (앞모습은 뒷머리를 몸 뒤에 먼저 그려서 목·가슴을 덮지 않게)
  const swPre = s * (type === 'blanket' ? 0.3 : 0.24);
  const gm = { headR: s * 0.17, headY: shY - s * 0.17, neckY: shY - s * 0.02, shY, sw: swPre };
  const kind = { blanket: 'long', scarf: 'bob', coat: 'bun', beanie: 'short', hood: 'short' }[type] || 'short';
  if (front && type !== 'hood') hair(ctx, kind, x, gm, s, hairColor);
  const g = ctx.createLinearGradient(x - s * 0.3, shY, x + s * 0.3, hemY);
  g.addColorStop(0, dimHex(base, bright));
  g.addColorStop(1, dimHex(base, bright * 0.8));
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
  if (o.coat) {
    ctx.strokeStyle = RAIN_EDGE;
    ctx.lineWidth = Math.max(0.8, s * 0.014);
    ctx.beginPath();
    ctx.moveTo(x, shY + s * 0.04);
    ctx.lineTo(x, hemY - s * 0.01);
    ctx.stroke();
    if (front) {
      ctx.fillStyle = RAIN_EDGE;
      for (let b = 0; b < 3; b++) {
        ctx.beginPath();
        ctx.arc(x + s * 0.03, shY + s * (0.16 + b * 0.16), Math.max(0.8, s * 0.015), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = Math.max(1, s * 0.025);
    ctx.beginPath();
    ctx.moveTo(x - sw * 0.6, shY + s * 0.12);
    ctx.quadraticCurveTo(x - hw * 0.75, (shY + hemY) / 2, x - hw * 0.7, hemY - s * 0.06);
    ctx.stroke();
  }
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
  ctx.fillStyle = '#d9b49c';
  ctx.fillRect(x - s * 0.04, gm.headY + gm.headR * 0.6, s * 0.08, s * 0.08);
  if (type === 'hood') {
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.arc(x, gm.headY, gm.headR * 1.15, 0, Math.PI * 2);
    ctx.fill();
  } else if (front) {
    // 앞모습: 얼굴 둘레 윗머리만 (뒷머리는 이미 몸 뒤에)
    ctx.fillStyle = hairColor;
    ctx.beginPath();
    ctx.arc(x, gm.headY, gm.headR * 1.03, 0, Math.PI * 2);
    ctx.fill();
    if (kind === 'bun') {
      ellipse(ctx, x + gm.headR * 0.1, gm.headY - gm.headR * 1.05, gm.headR * 0.45, gm.headR * 0.42);
      ctx.fill();
    }
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
  const { x: X, y, s, type: type0 = 'blanket', color = 0, bright = 1, still = false } = o;
  const t = still ? 0 : o.t || 0;
  // 우비: 몸·팔은 노랑, 머리는 모자(hood처럼), 목도리·비니는 우비 속에
  const type = o.coat ? 'hood' : type0;
  const [base0, accent] = BLANKETS[color % BLANKETS.length];
  const base = o.coat ? RAIN_YELLOW : base0;
  const hairColor = o.hair != null && HAIRS[o.hair] ? HAIRS[o.hair][1] : HAIR[(color + type0.length) % HAIR.length];
  const ph = t / 130;
  const bob = Math.abs(Math.sin(ph)) * s * 0.03;
  ctx.save();
  if (bright < 0.999) dimStyles(ctx, bright); // 느린 필터 대신 색을 직접 어둡게 (ctx.restore로 원래대로)
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
  const hemY = o.coat || type === 'blanket' || type === 'coat' ? y - s * 0.32 - bob : hipY + s * 0.05;
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.13, shY + s * 0.04);
  ctx.quadraticCurveTo(x, shY - s * 0.03, x + s * 0.13, shY + s * 0.04);
  ctx.lineTo(x + s * (type === 'blanket' ? 0.2 : 0.15), hemY);
  ctx.lineTo(x - s * (type === 'blanket' ? 0.22 : 0.16), hemY);
  ctx.closePath();
  ctx.fill();
  if (o.coat) {
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = Math.max(1, s * 0.025);
    ctx.beginPath();
    ctx.moveTo(x - s * 0.08, shY + s * 0.12);
    ctx.lineTo(x - s * 0.13, hemY - s * 0.06);
    ctx.stroke();
  }
  // 팔
  ctx.strokeStyle = dimHex(base, 0.85);
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

// 옆의 강아지·고양이 머리를 쓰다듬는 팔 (앉은 뒷모습, 오른팔)
// reach: 0(팔 내림)~1(머리에 닿음), stroke: 쓰다듬는 동작 세기
export function drawPettingArm(ctx, o) {
  const { x, y, s, color = 0, bright = 1, reach = 0, stroke = 0, t = 0, petSize = 1 } = o;
  if (reach <= 0.01) return;
  const base = o.coat ? RAIN_YELLOW : BLANKETS[color % BLANKETS.length][0];
  const g = geom(x, y, s);
  const ax0 = x + g.sw * 0.75;
  const ay0 = g.shY + s * 0.05;
  // 강아지·고양이 머리 위 (drawPet: x + s*0.62, 머리 중심 y - s*0.344)
  const rub = Math.sin(t / 230) * s * 0.045 * stroke;
  const tx = x + s * 0.6 + rub;
  const ty = y - s * 0.44 * petSize + Math.abs(Math.sin(t / 230)) * s * 0.012 * stroke; // 품종 크기에 맞춘 머리 높이
  const rx = x + s * 0.3;
  const ry = y - s * 0.42;
  const hx = rx + (tx - rx) * reach;
  const hy = ry + (ty - ry) * reach;
  // 팔꿈치는 살짝 위로 굽게
  const ex = (ax0 + hx) / 2 + s * 0.02;
  const ey = Math.min(ay0, hy) - s * 0.05 * reach;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = tone(base, -0.1 + (bright - 1) * 0.6);
  ctx.lineWidth = s * 0.11;
  ctx.beginPath();
  ctx.moveTo(ax0, ay0);
  ctx.quadraticCurveTo(ex, ey, hx, hy);
  ctx.stroke();
  // 손: 손바닥을 아래로 덮듯이
  const skin = tone(SKIN, (bright - 1) * 0.6);
  ctx.fillStyle = skin;
  ellipse(ctx, hx + s * 0.02, hy + s * 0.005, s * 0.06, s * 0.035, 0.15);
  ctx.fill();
  ctx.strokeStyle = tone(SKIN, -0.15 + (bright - 1) * 0.6);
  ctx.lineWidth = Math.max(0.7, s * 0.012);
  for (let f = 0; f < 3; f++) {
    ctx.beginPath();
    ctx.moveTo(hx + s * (0.035 + f * 0.012), hy - s * 0.01);
    ctx.lineTo(hx + s * (0.06 + f * 0.012), hy + s * 0.02);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------- 우비 (비 오는 날) ----------
// 앉은 뒷모습 사람: 모자 달린 노란 우비 (머리·어깨·등을 덮음)
export function drawRaincoatSeated(ctx, o) {
  const { x, y, s, bright = 1 } = o;
  const g = geom(x, y, s);
  const Y = tone(RAIN_YELLOW, (bright - 1) * 0.6);
  const D = tone(RAIN_EDGE, (bright - 1) * 0.6);
  ctx.save();
  // 망토: 어깨에서 엉덩이까지 넓게
  ctx.fillStyle = Y;
  ctx.beginPath();
  ctx.moveTo(x - g.sw * 1.05, g.shY);
  ctx.quadraticCurveTo(x, g.shY - s * 0.08, x + g.sw * 1.05, g.shY);
  ctx.lineTo(x + g.bw * 1.08, y - s * 0.06);
  ctx.quadraticCurveTo(x, y + s * 0.02, x - g.bw * 1.08, y - s * 0.06);
  ctx.closePath();
  ctx.fill();
  // 등 가운데 솔기, 반짝이는 비닐 느낌
  ctx.strokeStyle = D;
  ctx.lineWidth = Math.max(0.8, s * 0.015);
  ctx.beginPath();
  ctx.moveTo(x, g.shY + s * 0.02);
  ctx.lineTo(x, y - s * 0.08);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = Math.max(1, s * 0.03);
  ctx.beginPath();
  ctx.moveTo(x - g.sw * 0.7, g.shY + s * 0.08);
  ctx.quadraticCurveTo(x - g.bw * 0.85, y - s * 0.3, x - g.bw * 0.8, y - s * 0.12);
  ctx.stroke();
  // 모자: 머리 전체를 감싸고 목까지 내려와 망토와 이어짐 (머리카락이 비치지 않게)
  ctx.fillStyle = Y;
  ctx.beginPath();
  ctx.arc(x, g.headY, g.headR * 1.24, Math.PI, 0);
  ctx.lineTo(x + g.headR * 1.3, g.shY + s * 0.04);
  ctx.quadraticCurveTo(x, g.shY + s * 0.1, x - g.headR * 1.3, g.shY + s * 0.04);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = D;
  ctx.lineWidth = Math.max(0.8, s * 0.015);
  ctx.beginPath();
  ctx.arc(x, g.headY + g.headR * 0.1, g.headR * 1.0, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
  ctx.restore();
}
// 앉은 강아지·고양이 우비 망토 (몸 바로 다음, 꼬리·머리보다 먼저 그림)
function petCape(ctx, x, by, k, W, bright) {
  const Y = tone(RAIN_YELLOW, (bright - 1) * 0.6);
  const D = tone(RAIN_EDGE, (bright - 1) * 0.6);
  ctx.fillStyle = Y;
  ctx.beginPath();
  ctx.moveTo(x - k * 0.24 * W, by - k * 0.64);
  ctx.quadraticCurveTo(x, by - k * 0.72, x + k * 0.24 * W, by - k * 0.64);
  ctx.quadraticCurveTo(x + k * 0.43 * W, by - k * 0.3, x + k * 0.38 * W, by - k * 0.1);
  ctx.quadraticCurveTo(x, by - k * 0.02, x - k * 0.38 * W, by - k * 0.1);
  ctx.quadraticCurveTo(x - k * 0.43 * W, by - k * 0.3, x - k * 0.24 * W, by - k * 0.64);
  ctx.fill();
  ctx.strokeStyle = D;
  ctx.lineWidth = Math.max(0.7, k * 0.02);
  ctx.beginPath();
  ctx.moveTo(x, by - k * 0.66);
  ctx.lineTo(x, by - k * 0.08);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = Math.max(0.8, k * 0.03);
  ctx.beginPath();
  ctx.moveTo(x - k * 0.18 * W, by - k * 0.55);
  ctx.quadraticCurveTo(x - k * 0.33 * W, by - k * 0.32, x - k * 0.3 * W, by - k * 0.16);
  ctx.stroke();
}

// 강아지·고양이 우비 모자: 머리와 귀를 감쌈. 앞모습이면 얼굴 자리를 비워 둠
// (얼굴 그림은 이 다음에 그려지므로 늘 모자 앞에 보임)
function petHood(ctx, B, x, hy, hr, sway, bright, front) {
  const Y = tone(RAIN_YELLOW, (bright - 1) * 0.6);
  const D = tone(RAIN_EDGE, (bright - 1) * 0.6);
  petEars(ctx, B, x, hy, hr * 1.05, sway, Y, Y, null);
  ctx.fillStyle = Y;
  ctx.beginPath();
  ctx.arc(x, hy, hr * 1.12, 0, Math.PI * 2);
  if (front) ctx.ellipse(x, hy + hr * 0.16, hr * 0.86, hr * 0.84, 0, 0, Math.PI * 2);
  ctx.fill('evenodd');
  ctx.strokeStyle = D;
  ctx.lineWidth = Math.max(0.7, hr * 0.07);
  ctx.beginPath();
  if (front) ctx.ellipse(x, hy + hr * 0.16, hr * 0.88, hr * 0.86, 0, 0, Math.PI * 2);
  else ctx.arc(x, hy + hr * 0.05, hr * 0.85, Math.PI * 1.2, Math.PI * 1.8);
  ctx.stroke();
}
