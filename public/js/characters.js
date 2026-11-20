// 잠옷 담요를 두른 동물 승객 캐릭터 (캔버스로 직접 그립니다. 외부 이미지 없음)

export const CHAR_LIST = [
  { key: 'otter', name: '졸린 수달' },
  { key: 'penguin', name: '아기 펭귄' },
  { key: 'rabbit', name: '이불 토끼' },
  { key: 'bear', name: '꼬마 곰' },
  { key: 'cat', name: '귤 고양이' },
];

// 담요 색 (바탕, 줄무늬)
export const BLANKETS = [
  ['#e8574f', '#f6c9a0'],
  ['#4f7be8', '#cfe0ff'],
  ['#45a37a', '#d6f2c4'],
  ['#f2b134', '#fff1c7'],
  ['#9b6be0', '#ead9ff'],
  ['#ef7fae', '#ffe0ee'],
  ['#3b9bb5', '#d3f3f7'],
  ['#8c8c8c', '#f2f2f2'],
];

const FUR = {
  otter: { main: '#8b5b3c', light: '#c9a07c', dark: '#5c3a24' },
  penguin: { main: '#2c3548', light: '#f4f4f0', dark: '#1a2030' },
  rabbit: { main: '#f2e5d5', light: '#ffffff', dark: '#c8b4a0' },
  bear: { main: '#a3683e', light: '#d9a77a', dark: '#6e4325' },
  cat: { main: '#f0a654', light: '#ffe3bd', dark: '#c47a2c' },
};

function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
}

function drawEars(ctx, type, x, hy, hr, fur) {
  ctx.fillStyle = fur.main;
  if (type === 'rabbit') {
    for (const sgn of [-1, 1]) {
      ellipse(ctx, x + sgn * hr * 0.42, hy - hr * 1.35, hr * 0.26, hr * 0.75, sgn * 0.15);
      ctx.fill();
      ctx.fillStyle = '#f7c6c6';
      ellipse(ctx, x + sgn * hr * 0.42, hy - hr * 1.3, hr * 0.12, hr * 0.5, sgn * 0.15);
      ctx.fill();
      ctx.fillStyle = fur.main;
    }
  } else if (type === 'bear' || type === 'otter') {
    const r = type === 'bear' ? 0.32 : 0.2;
    for (const sgn of [-1, 1]) {
      ellipse(ctx, x + sgn * hr * 0.72, hy - hr * 0.68, hr * r, hr * r);
      ctx.fill();
    }
  } else if (type === 'cat') {
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + sgn * hr * 0.25, hy - hr * 0.85);
      ctx.lineTo(x + sgn * hr * 0.8, hy - hr * 1.25);
      ctx.lineTo(x + sgn * hr * 0.88, hy - hr * 0.45);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function blanketPath(ctx, x, y, s, open) {
  ctx.beginPath();
  ctx.moveTo(x - s * 0.5, y);
  ctx.bezierCurveTo(x - s * 0.55, y - s * 0.45, x - s * 0.45, y - s * 0.78, x - s * 0.18, y - s * 0.84);
  if (open) {
    ctx.lineTo(x - s * 0.12, y - s * 0.3);
    ctx.lineTo(x - s * 0.2, y);
    ctx.closePath();
    ctx.moveTo(x + s * 0.5, y);
    ctx.bezierCurveTo(x + s * 0.55, y - s * 0.45, x + s * 0.45, y - s * 0.78, x + s * 0.18, y - s * 0.84);
    ctx.lineTo(x + s * 0.12, y - s * 0.3);
    ctx.lineTo(x + s * 0.2, y);
    ctx.closePath();
  } else {
    ctx.quadraticCurveTo(x, y - s * 0.9, x + s * 0.18, y - s * 0.84);
    ctx.bezierCurveTo(x + s * 0.45, y - s * 0.78, x + s * 0.55, y - s * 0.45, x + s * 0.5, y);
    ctx.quadraticCurveTo(x, y + s * 0.06, x - s * 0.5, y);
    ctx.closePath();
  }
}

function drawBlanket(ctx, x, y, s, color, open) {
  const [base, stripe] = BLANKETS[color % BLANKETS.length];
  ctx.save();
  blanketPath(ctx, x, y, s, open);
  ctx.fillStyle = base;
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = stripe;
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(x - s, y - s * 0.72 + i * s * 0.2, s * 2, s * 0.07);
  }
  ctx.restore();
}

/**
 * 캐릭터 그리기
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} o  { x, y(바닥), s(크기), type, color, facing:'back'|'front', arms:0~1, hop:0~1, rim:{x:-1|1, color, a} }
 */
export function drawCritter(ctx, o) {
  const { x, s, type = 'otter', color = 0, facing = 'back', arms = 0, hop = 0, rim } = o;
  const fur = FUR[type] || FUR.otter;
  const y = o.y - hop * s * 0.35;
  const hr = s * 0.34;
  const hy = y - s * 1.0;

  // 그림자
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ellipse(ctx, x, o.y + s * 0.02, s * 0.5 * (1 - hop * 0.3), s * 0.09);
  ctx.fill();

  // 들어 올린 팔 (만세)
  if (arms > 0) {
    ctx.fillStyle = fur.main;
    for (const sgn of [-1, 1]) {
      const ax = x + sgn * s * (0.36 + 0.06 * arms);
      const ay = y - s * (0.62 + 0.42 * arms);
      ellipse(ctx, ax, ay, s * 0.1, s * 0.22, sgn * (0.5 - 0.4 * arms));
      ctx.fill();
    }
  }

  // 몸통
  ctx.fillStyle = fur.main;
  ellipse(ctx, x, y - s * 0.42, s * 0.42, s * 0.44);
  ctx.fill();
  if (facing === 'front') {
    ctx.fillStyle = fur.light;
    ellipse(ctx, x, y - s * 0.36, s * 0.24, s * 0.3);
    ctx.fill();
  }

  // 꼬리 (뒷모습)
  if (facing === 'back') {
    if (type === 'cat') {
      ctx.strokeStyle = fur.main;
      ctx.lineWidth = s * 0.11;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x + s * 0.3, y - s * 0.05);
      ctx.quadraticCurveTo(x + s * 0.8, y - s * 0.1, x + s * 0.68, y - s * 0.55);
      ctx.stroke();
    } else if (type === 'otter') {
      ctx.fillStyle = fur.dark;
      ellipse(ctx, x + s * 0.42, y - s * 0.06, s * 0.3, s * 0.09, -0.3);
      ctx.fill();
    }
  }

  drawBlanket(ctx, x, y, s, color, facing === 'front');

  // 머리
  drawEars(ctx, type, x, hy, hr, fur);
  ctx.fillStyle = fur.main;
  ellipse(ctx, x, hy, hr, hr * 0.95);
  ctx.fill();

  if (facing === 'front') {
    // 얼굴
    if (type === 'penguin') {
      ctx.fillStyle = fur.light;
      ellipse(ctx, x - hr * 0.3, hy + hr * 0.08, hr * 0.42, hr * 0.55);
      ctx.fill();
      ellipse(ctx, x + hr * 0.3, hy + hr * 0.08, hr * 0.42, hr * 0.55);
      ctx.fill();
    } else if (type === 'otter' || type === 'cat' || type === 'bear') {
      ctx.fillStyle = fur.light;
      ellipse(ctx, x, hy + hr * 0.35, hr * 0.5, hr * 0.36);
      ctx.fill();
    }
    ctx.fillStyle = '#2a1d17';
    // 졸린 눈 (수달) / 동그란 눈
    if (type === 'otter') {
      ctx.strokeStyle = '#2a1d17';
      ctx.lineWidth = Math.max(1, s * 0.035);
      ctx.lineCap = 'round';
      for (const sgn of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(x + sgn * hr * 0.38, hy - hr * 0.05, hr * 0.14, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
      }
    } else {
      for (const sgn of [-1, 1]) {
        ellipse(ctx, x + sgn * hr * 0.36, hy - hr * 0.05, hr * 0.1, hr * 0.12);
        ctx.fill();
      }
    }
    if (type === 'penguin') {
      ctx.fillStyle = '#f2a33a';
      ctx.beginPath();
      ctx.moveTo(x - hr * 0.16, hy + hr * 0.2);
      ctx.lineTo(x + hr * 0.16, hy + hr * 0.2);
      ctx.lineTo(x, hy + hr * 0.42);
      ctx.closePath();
      ctx.fill();
    } else {
      ellipse(ctx, x, hy + hr * 0.22, hr * 0.1, hr * 0.07);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,120,120,0.45)';
    for (const sgn of [-1, 1]) {
      ellipse(ctx, x + sgn * hr * 0.6, hy + hr * 0.25, hr * 0.15, hr * 0.09);
      ctx.fill();
    }
  } else if (type === 'penguin') {
    // 뒷모습 펭귄의 작은 발
    ctx.fillStyle = '#f2a33a';
    for (const sgn of [-1, 1]) {
      ellipse(ctx, x + sgn * s * 0.18, o.y - s * 0.01, s * 0.1, s * 0.05);
      ctx.fill();
    }
  }

  // 해를 향한 쪽 테두리 빛 (역광 느낌)
  if (rim && rim.a > 0.01) {
    ctx.save();
    ctx.globalAlpha = rim.a;
    ctx.strokeStyle = rim.color;
    ctx.lineWidth = Math.max(1, s * 0.05);
    ctx.lineCap = 'round';
    const a0 = rim.x > 0 ? -0.55 * Math.PI : -0.95 * Math.PI;
    ctx.beginPath();
    ctx.arc(x, hy, hr * 0.97, a0, a0 + 0.5 * Math.PI);
    ctx.stroke();
    ctx.restore();
  }
}

// 캐릭터 고르기·승차권용 작은 그림 (정면)
export function renderPortrait(canvas, type, color) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  drawCritter(ctx, { x: w / 2, y: h * 0.9, s: h * 0.56, type, color, facing: 'front' });
}
