// 장소를 옮길 때 나오는 막간: "이불 밖은 추우니까, 이불 속에서 끊은 승차권으로 떠나요"
// 화면 전체를 캔버스로 그림. 밤에는 아파트 야경, 낮에는 먼 산과 들. 열차는 곡선 철로를 따라
// 들어와 잠깐 멈췄다가 출발합니다. 승객은 창 안에만 보이고, 축하 깃발은 창 아래에 달려 있어요.

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

// 같은 그림이 매번 같게 나오도록 고정된 난수
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const FLAG_COLORS = ['#f08a5d', '#f4c26b', '#e46f86', '#8fb0d9', '#9cc6a5'];
const HAIR = ['#2a211d', '#3a2b23', '#4a3428', '#1e1a19', '#6b4a32'];
const SHIRT = ['#c8453e', '#6c8fb3', '#7fa77a', '#d9a441', '#8b6aa8', '#c97b63'];

export class TrainIntro {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.raf = 0;
  }

  // night: 밤이면 true, kind: 'sunrise' | 'sunset', duration: ms
  play({ night, kind, duration = 4200, still = false }) {
    this.stop();
    this.night = night;
    this.sign = kind === 'sunset' ? '해넘이 특별열차' : '해돋이 특별열차';
    this.duration = duration;
    this.resize();
    this.build();
    const t0 = performance.now();
    const frame = (now) => {
      const t = still ? 0.42 : clamp((now - t0) / this.duration);
      this.draw(t, now);
      if (!still && t < 1) this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = this.cv.clientWidth || window.innerWidth;
    const H = this.cv.clientHeight || window.innerHeight;
    this.cv.width = Math.round(W * dpr);
    this.cv.height = Math.round(H * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.W = W;
    this.H = H;
    // 열차 크기: 휴대폰에서 한 칸이 화면 폭의 약 40% (예전보다 크게)
    this.carLen = clamp(W * 0.56, 190, 360);
    this.carH = this.carLen * 0.34;
    this.trackY = H * 0.6;
  }

  // 철로: 완만한 언덕 곡선 (x에서의 높이와 기울기)
  railY(x) {
    const { W, H } = this;
    return this.trackY + H * 0.016 * Math.sin((x / W) * Math.PI * 0.9 + 0.6);
  }

  railAngle(x) {
    return Math.atan2(this.railY(x + 2) - this.railY(x - 2), 4);
  }

  build() {
    const r = rng(this.night ? 7 : 11);
    const { W, H } = this;
    // 별
    this.stars = Array.from({ length: 70 }, () => ({ x: r() * W, y: r() * H * 0.45, s: 0.4 + r() * 1.1, p: r() * TAU }));
    // 밤: 아파트 단지 (먼 줄, 가까운 줄)
    this.blocks = [];
    for (const [layer, top, hMin, hMax] of [[0, 0.3, 0.12, 0.22], [1, 0.36, 0.1, 0.2]]) {
      let x = -40;
      while (x < W * 1.6) {
        const w = 34 + r() * 46;
        const h = H * (hMin + r() * (hMax - hMin));
        const floors = Math.max(6, Math.round(h / 9));
        const cols = Math.max(3, Math.round(w / 9));
        const lit = [];
        for (let f = 0; f < floors; f++) for (let c = 0; c < cols; c++) if (r() < (layer ? 0.42 : 0.3)) lit.push([f, c, r() < 0.18]);
        this.blocks.push({ layer, x, w, h, floors, cols, lit, top, roof: r() < 0.4 });
        x += w + 6 + r() * 18;
      }
    }
    // 낮: 산 세 겹 + 구름 + 들판의 나무
    this.ridges = [0, 1, 2].map((i) => {
      const pts = [];
      const amp = H * (0.09 - i * 0.022);
      const base = H * (0.38 + i * 0.055);
      const f1 = 1.5 + r() * 1.5;
      const f2 = 4 + r() * 3;
      const ph = r() * TAU;
      for (let k = 0; k <= 64; k++) {
        const u = k / 64;
        pts.push(base - amp * (0.6 * Math.abs(Math.sin(u * f1 * Math.PI + ph)) + 0.4 * Math.abs(Math.sin(u * f2 * Math.PI + ph * 2))));
      }
      return pts;
    });
    this.clouds = Array.from({ length: 5 }, () => ({ x: r() * W * 1.4, y: H * (0.08 + r() * 0.2), s: 0.6 + r() * 0.8 }));
    this.trees = Array.from({ length: 26 }, () => ({ x: r() * W * 1.6, y: H * (0.47 + r() * 0.07), s: 0.6 + r() * 0.7 }));
    // 승객: 칸마다 창 하나에 한 명씩 (가끔 빈자리)
    this.seats = Array.from({ length: 40 }, () => (r() < 0.82 ? { hair: HAIR[Math.floor(r() * HAIR.length)], shirt: SHIRT[Math.floor(r() * SHIRT.length)], dx: (r() - 0.5) * 0.25, tall: r() } : null));
  }

  // 열차 머리(맨 앞)의 x: 들어와서(감속) 화면 가운데쯤 멈췄다가(잠깐) 출발(가속)
  headX(t) {
    const { W } = this;
    const total = this.carLen * 4 + 12;
    const start = -12;
    const stop = Math.min(W * 0.5 + total * 0.5, W * 0.9); // 동력차 앞모습이 보이게
    const end = W + total + 40;
    if (t < 0.42) return lerp(start, stop, 1 - (1 - t / 0.42) ** 3);
    if (t < 0.6) return stop;
    const u = (t - 0.6) / 0.4;
    return lerp(stop, end, u * u * u);
  }

  draw(t, now) {
    const { ctx, W, H } = this;
    ctx.clearRect(0, 0, W, H);
    const drift = now / 1000; // 배경 아주 천천히
    this.drawSky(now);
    if (this.night) this.drawCity(drift);
    else this.drawCountry(drift);
    this.drawGround();
    this.drawTrack();
    const head = this.headX(t);
    const moving = t < 0.42 || t > 0.6;
    this.drawTrain(head, now, moving);
  }

  drawSky(now) {
    const { ctx, W, H, night } = this;
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.62);
    if (night) {
      g.addColorStop(0, '#0f1430');
      g.addColorStop(0.6, '#26284a');
      g.addColorStop(1, '#4a3d5c');
    } else {
      g.addColorStop(0, '#6fa8d8');
      g.addColorStop(0.7, '#b9d6ec');
      g.addColorStop(1, '#e9eef0');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    if (night) {
      for (const s of this.stars) {
        ctx.globalAlpha = 0.45 + 0.35 * Math.sin(now / 1400 + s.p);
        ctx.fillStyle = '#fff7e0';
        ctx.fillRect(s.x, s.y, s.s, s.s);
      }
      ctx.globalAlpha = 1;
      // 달
      const mx = W * 0.82;
      const my = H * 0.12;
      const mg = ctx.createRadialGradient(mx, my, 0, mx, my, 46);
      mg.addColorStop(0, 'rgba(255,244,210,0.35)');
      mg.addColorStop(1, 'rgba(255,244,210,0)');
      ctx.fillStyle = mg;
      ctx.fillRect(mx - 50, my - 50, 100, 100);
      ctx.fillStyle = '#fff1c8';
      ctx.beginPath();
      ctx.arc(mx, my, 13, 0, TAU);
      ctx.fill();
    } else {
      // 해와 구름
      const sx = W * 0.8;
      const sy = H * 0.11;
      const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 60);
      sg.addColorStop(0, 'rgba(255,250,225,0.9)');
      sg.addColorStop(0.25, 'rgba(255,245,210,0.5)');
      sg.addColorStop(1, 'rgba(255,245,210,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(sx - 60, sy - 60, 120, 120);
      for (const c of this.clouds) {
        const x = ((c.x - now / 120) % (W * 1.4) + W * 1.4) % (W * 1.4) - W * 0.2;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        for (const [dx, dy, rr2] of [[0, 0, 16], [16, -6, 13], [32, 0, 15], [14, 5, 14]]) {
          ctx.beginPath();
          ctx.arc(x + dx * c.s, c.y + dy * c.s, rr2 * c.s, 0, TAU);
          ctx.fill();
        }
      }
    }
  }

  drawCity(drift) {
    const { ctx, W, H } = this;
    for (const layer of [0, 1]) {
      const shift = (drift * (layer ? 6 : 3)) % (W * 0.6);
      const baseY = H * (layer ? 0.5 : 0.47);
      for (const b of this.blocks) {
        if (b.layer !== layer) continue;
        const x = b.x - shift;
        if (x > W + 10 || x + b.w < -10) continue;
        const y = baseY - b.h;
        ctx.fillStyle = layer ? '#1d1f36' : '#2a2b47';
        ctx.fillRect(x, y, b.w, b.h);
        if (b.roof) {
          ctx.fillRect(x + b.w * 0.3, y - 6, b.w * 0.25, 6);
          ctx.fillStyle = 'rgba(255,90,80,0.8)';
          ctx.fillRect(x + b.w * 0.41, y - 8, 2, 2); // 옥상 항공등
        }
        // 불 켜진 창 (따뜻한 색과 형광등 색이 섞임)
        const cw = b.w / b.cols;
        const fh = b.h / b.floors;
        for (const [f, c, cool] of b.lit) {
          ctx.fillStyle = cool ? 'rgba(220,238,255,0.85)' : layer ? 'rgba(255,214,140,0.9)' : 'rgba(255,205,130,0.6)';
          ctx.fillRect(x + c * cw + cw * 0.22, y + f * fh + fh * 0.25, cw * 0.56, fh * 0.45);
        }
      }
    }
    // 도시 불빛이 하늘에 번짐
    const glow = ctx.createLinearGradient(0, H * 0.32, 0, H * 0.52);
    glow.addColorStop(0, 'rgba(255,170,120,0)');
    glow.addColorStop(1, 'rgba(255,170,120,0.12)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, H * 0.32, W, H * 0.2);
  }

  drawCountry(drift) {
    const { ctx, W, H } = this;
    const cols = ['#9fb6cc', '#87a3a0', '#6f9273'];
    this.ridges.forEach((pts, i) => {
      const shift = (drift * (2 + i * 3)) % (W * 0.5);
      ctx.fillStyle = cols[i];
      ctx.beginPath();
      ctx.moveTo(-10, H);
      for (let k = 0; k < pts.length; k++) ctx.lineTo((k / 64) * W * 1.5 - shift, pts[k]);
      ctx.lineTo(W * 1.5, H);
      ctx.closePath();
      ctx.fill();
    });
    // 들판
    const fg = ctx.createLinearGradient(0, H * 0.48, 0, H * 0.6);
    fg.addColorStop(0, '#a9c68a');
    fg.addColorStop(1, '#8fb070');
    ctx.fillStyle = fg;
    ctx.fillRect(0, H * 0.5, W, H * 0.12);
    // 멀리 나무들
    const shift = (drift * 10) % (W * 0.6);
    for (const tr of this.trees) {
      const x = ((tr.x - shift) % (W * 1.6) + W * 1.6) % (W * 1.6) - W * 0.1;
      ctx.fillStyle = '#5e8a5a';
      ctx.beginPath();
      ctx.ellipse(x, tr.y - 7 * tr.s, 5 * tr.s, 8 * tr.s, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#6b5340';
      ctx.fillRect(x - 0.8, tr.y - 1, 1.6, 3 * tr.s);
    }
  }

  drawGround() {
    const { ctx, W, H, night } = this;
    const g = ctx.createLinearGradient(0, H * 0.55, 0, H);
    if (night) {
      g.addColorStop(0, '#2b2738');
      g.addColorStop(1, '#17151f');
    } else {
      g.addColorStop(0, '#9bb57e');
      g.addColorStop(1, '#7e9a63');
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, this.railY(0) + 6);
    for (let x = 0; x <= W + 8; x += 8) ctx.lineTo(x, this.railY(x) + 6);
    ctx.lineTo(W + 8, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
  }

  drawTrack() {
    const { ctx, W, night } = this;
    // 자갈 둑
    ctx.fillStyle = night ? '#3b3644' : '#a59a8a';
    ctx.beginPath();
    for (let x = -10; x <= W + 10; x += 8) ctx.lineTo(x, this.railY(x) + 2);
    for (let x = W + 10; x >= -10; x -= 8) ctx.lineTo(x, this.railY(x) + 12);
    ctx.closePath();
    ctx.fill();
    // 침목
    ctx.fillStyle = night ? '#4a3a33' : '#6e5444';
    for (let x = -10; x <= W + 10; x += 13) {
      const y = this.railY(x);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(this.railAngle(x));
      ctx.fillRect(-3.5, 1, 7, 4.5);
      ctx.restore();
    }
    // 레일 (윗면이 반짝)
    ctx.lineWidth = 3;
    ctx.strokeStyle = night ? '#8d8a96' : '#7b7a80';
    ctx.beginPath();
    for (let x = -10; x <= W + 10; x += 6) ctx.lineTo(x, this.railY(x));
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = night ? 'rgba(255,240,220,0.45)' : 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    for (let x = -10; x <= W + 10; x += 6) ctx.lineTo(x, this.railY(x) - 1.2);
    ctx.stroke();
  }

  drawTrain(head, now, moving) {
    const { carLen } = this;
    const gap = 4;
    // 맨 앞이 동력차, 뒤로 객차 3량. 칸마다 그 자리 철로의 기울기를 따라감
    for (let i = 3; i >= 0; i--) {
      const front = head - i * (carLen + gap);
      const cx = front - carLen / 2;
      if (cx - carLen > this.W + 20 || cx + carLen < -20) continue;
      // 두 대차(바퀴 뭉치)가 레일 위에 놓이도록 칸의 높이와 기울기를 정함
      const xa = cx - carLen * 0.32;
      const xb = cx + carLen * 0.32;
      const ya = this.railY(xa);
      const yb = this.railY(xb);
      const ang = Math.atan2(yb - ya, xb - xa);
      const bob = moving ? Math.sin(now / 90 + i * 1.7) * 0.5 : 0;
      this.drawCar(cx, (ya + yb) / 2 + bob, ang, i === 0, i === 2, i * 10, head, now);
      if (i > 0) this.drawGangway(front + gap / 2, ang);
    }
    // 밤: 전조등 빛
    if (this.night) {
      const x = head;
      const y = this.railY(head) - this.carH * 0.45;
      const g = this.ctx.createRadialGradient(x, y, 0, x, y, 120);
      g.addColorStop(0, 'rgba(255,240,190,0.32)');
      g.addColorStop(1, 'rgba(255,245,200,0)');
      this.ctx.fillStyle = g;
      this.ctx.beginPath();
      this.ctx.moveTo(x, y - 4);
      this.ctx.lineTo(x + 130, y - 30);
      this.ctx.lineTo(x + 130, y + 34);
      this.ctx.closePath();
      this.ctx.fill();
    }
  }

  drawGangway(x, ang) {
    const { ctx, carH } = this;
    const y = this.railY(x);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = '#3d3f4a';
    ctx.fillRect(-3, -carH * 0.95, 6, carH * 0.62);
    ctx.restore();
  }

  drawCar(cx, cy, ang, loco, signCar, seatBase, head, now) {
    const { ctx, carLen: L, carH: Hc, night } = this;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    const wheelR = Hc * 0.1;
    const floor = -wheelR * 2 - 3; // 바퀴 위 차체 바닥
    const top = floor - Hc;
    // ---------- 대차와 바퀴 ----------
    for (const bx of [-L * 0.32, L * 0.32]) {
      ctx.fillStyle = '#2e2f37';
      rr(ctx, bx - L * 0.11, -wheelR * 2.2, L * 0.22, wheelR * 1.3, 3);
      ctx.fill();
      for (const wx of [bx - L * 0.06, bx + L * 0.06]) {
        ctx.fillStyle = '#1f2026';
        ctx.beginPath();
        ctx.arc(wx, -wheelR, wheelR, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#6c6e78';
        ctx.lineWidth = 1;
        const rot = (head / wheelR) % TAU;
        ctx.beginPath();
        for (let k = 0; k < 3; k++) {
          const a = rot + (k * TAU) / 3;
          ctx.moveTo(wx, -wheelR);
          ctx.lineTo(wx + Math.cos(a) * wheelR * 0.8, -wheelR + Math.sin(a) * wheelR * 0.8);
        }
        ctx.stroke();
        ctx.fillStyle = '#9a9ca6';
        ctx.beginPath();
        ctx.arc(wx, -wheelR, wheelR * 0.25, 0, TAU);
        ctx.fill();
      }
    }
    // ---------- 차체 ----------
    const x0 = -L / 2;
    const body = new Path2D();
    if (loco) {
      // 동력차: 오른쪽(앞)이 둥글게 흘러내린 고속열차 코
      body.moveTo(x0 + 10, top);
      body.lineTo(L * 0.12, top);
      body.bezierCurveTo(L * 0.34, top, L * 0.5, top + Hc * 0.45, L * 0.52, floor - 4);
      body.quadraticCurveTo(L * 0.52, floor, L * 0.46, floor);
      body.lineTo(x0, floor);
      body.lineTo(x0, top + 10);
      body.quadraticCurveTo(x0, top, x0 + 10, top);
      body.closePath();
    } else {
      const p = new Path2D();
      p.roundRect ? p.roundRect(x0, top, L, Hc, [12, 12, 6, 6]) : p.rect(x0, top, L, Hc);
      body.addPath(p);
    }
    const bg = ctx.createLinearGradient(0, top, 0, floor);
    bg.addColorStop(0, '#ffffff');
    bg.addColorStop(0.55, '#f3eee6');
    bg.addColorStop(1, '#ddd6cb');
    ctx.fillStyle = bg;
    ctx.fill(body);
    ctx.save();
    ctx.clip(body);
    // 지붕 그늘
    ctx.fillStyle = 'rgba(120,110,100,0.18)';
    ctx.fillRect(x0, top, L * 1.1, Hc * 0.1);
    // 아래 치마(회색)
    ctx.fillStyle = '#4b4f5c';
    ctx.fillRect(x0, floor - Hc * 0.13, L * 1.1, Hc * 0.13);
    // 노을빛 띠
    const sg = ctx.createLinearGradient(x0, 0, x0 + L, 0);
    sg.addColorStop(0, '#e46f86');
    sg.addColorStop(0.5, '#f08a5d');
    sg.addColorStop(1, '#f4c26b');
    ctx.fillStyle = sg;
    ctx.fillRect(x0, floor - Hc * 0.24, L * 1.1, Hc * 0.08);
    ctx.fillStyle = 'rgba(200,69,62,0.9)';
    ctx.fillRect(x0, floor - Hc * 0.155, L * 1.1, Hc * 0.022);
    ctx.restore();
    ctx.strokeStyle = 'rgba(90,70,60,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke(body);

    // ---------- 창문 (승객은 창 안에만) ----------
    const winTop = top + Hc * 0.2;
    const winH = Hc * 0.36;
    const wins = [];
    if (loco) {
      for (let k = 0; k < 3; k++) wins.push([x0 + L * 0.06 + k * L * 0.15, L * 0.12]);
    } else {
      // 출입문 자리를 비우고 창 5개
      for (let k = 0; k < 5; k++) wins.push([x0 + L * 0.2 + k * L * 0.15, L * 0.12]);
    }
    wins.forEach(([wx, ww], k) => this.drawWindow(wx, winTop, ww, winH, this.seats[(seatBase + k) % this.seats.length], now, wx + cx));
    if (loco) {
      // 운전석 앞유리
      const wp = new Path2D();
      wp.moveTo(L * 0.16, winTop - 1);
      wp.lineTo(L * 0.26, winTop - 1);
      wp.bezierCurveTo(L * 0.36, winTop + 1, L * 0.43, winTop + winH * 0.5, L * 0.45, winTop + winH * 0.95);
      wp.lineTo(L * 0.16, winTop + winH * 0.95);
      wp.closePath();
      const gg = ctx.createLinearGradient(L * 0.16, winTop, L * 0.45, winTop + winH);
      gg.addColorStop(0, night ? '#2b3550' : '#9cc0dc');
      gg.addColorStop(1, night ? '#151b2c' : '#5f83a3');
      ctx.fillStyle = gg;
      ctx.fill(wp);
      ctx.strokeStyle = '#3a3d47';
      ctx.lineWidth = 1.5;
      ctx.stroke(wp);
      // 전조등
      ctx.fillStyle = night ? '#fff7d0' : '#f4e6b0';
      ctx.beginPath();
      ctx.ellipse(L * 0.47, floor - Hc * 0.32, 3.2, 2.2, -0.5, 0, TAU);
      ctx.fill();
      // 팬터그래프(지붕 위 전기 집전장치)
      ctx.strokeStyle = '#55575f';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-L * 0.18, top);
      ctx.lineTo(-L * 0.1, top - Hc * 0.28);
      ctx.lineTo(-L * 0.02, top);
      ctx.moveTo(-L * 0.16, top - Hc * 0.28);
      ctx.lineTo(-L * 0.04, top - Hc * 0.28);
      ctx.stroke();
    } else {
      // 출입문
      const dx = x0 + L * 0.05;
      ctx.strokeStyle = 'rgba(80,70,64,0.45)';
      ctx.lineWidth = 1;
      rr(ctx, dx, top + Hc * 0.14, L * 0.11, Hc * 0.66, 4);
      ctx.stroke();
      ctx.fillStyle = night ? '#fff3cf' : '#a9c7de';
      rr(ctx, dx + L * 0.025, top + Hc * 0.2, L * 0.06, Hc * 0.24, 3);
      ctx.fill();
      // 지붕 위 냉방기
      ctx.fillStyle = '#d9d3ca';
      rr(ctx, -L * 0.15, top - Hc * 0.08, L * 0.3, Hc * 0.1, 3);
      ctx.fill();
    }

    // ---------- 창 아래 축하 깃발 (이벤트 열차 표시) ----------
    const fx0 = loco ? x0 + L * 0.04 : x0 + L * 0.18;
    const fx1 = loco ? L * 0.36 : x0 + L * 0.96;
    const fy = winTop + winH + Hc * 0.05;
    const n = Math.max(6, Math.round((fx1 - fx0) / 11));
    const sag = (u) => fy + Math.sin(u * Math.PI) * Hc * 0.04;
    ctx.strokeStyle = 'rgba(110,95,85,0.8)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let k = 0; k <= 20; k++) ctx.lineTo(lerp(fx0, fx1, k / 20), sag(k / 20));
    ctx.stroke();
    for (let k = 0; k < n; k++) {
      const u0 = (k + 0.1) / n;
      const u1 = (k + 0.9) / n;
      const a = lerp(fx0, fx1, u0);
      const b = lerp(fx0, fx1, u1);
      const sway = Math.sin(now / 260 + k * 0.9) * 1.2;
      ctx.fillStyle = FLAG_COLORS[(k + seatBase) % FLAG_COLORS.length];
      ctx.beginPath();
      ctx.moveTo(a, sag(u0));
      ctx.lineTo(b, sag(u1));
      ctx.lineTo((a + b) / 2 + sway, sag((u0 + u1) / 2) + Hc * 0.1);
      ctx.closePath();
      ctx.fill();
    }

    // ---------- 가운데 객차: 특별열차 표지판 ----------
    if (signCar) {
      const fs = Math.max(11, Hc * 0.19);
      ctx.font = `700 ${fs}px "Nanum Brush Script", "Gowun Batang", serif`;
      const tw = ctx.measureText(this.sign).width + 16;
      ctx.fillStyle = '#fffaf0';
      ctx.strokeStyle = '#e8b48a';
      ctx.lineWidth = 1.5;
      rr(ctx, -tw / 2, top - fs - 6, tw, fs + 6, (fs + 6) / 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#b9574e';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.sign, 0, top - fs / 2 - 3);
    }
    ctx.restore();
  }

  // 창 하나: 밤에는 형광등 켜진 객실, 낮에는 하늘이 비친 유리. 승객은 창 안쪽으로만 잘라서 그림
  drawWindow(x, y, w, h, who, now, worldX) {
    const { ctx, night } = this;
    ctx.save();
    rr(ctx, x, y, w, h, Math.min(6, h * 0.3));
    ctx.save();
    ctx.clip();
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    if (night) {
      g.addColorStop(0, '#fffdf0');
      g.addColorStop(0.6, '#f1f4e4');
      g.addColorStop(1, '#d6dccd');
    } else {
      g.addColorStop(0, '#c4dbec');
      g.addColorStop(0.6, '#93b5cf');
      g.addColorStop(1, '#7395b0');
    }
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    if (night) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + w * 0.2, y + 1.5, w * 0.6, 1.6); // 천장 형광등
      // 좌석 등받이
      ctx.fillStyle = '#c96a5a';
      rr(ctx, x + w * 0.12, y + h * 0.5, w * 0.76, h * 0.6, 3);
      ctx.fill();
    }
    if (who) {
      // 앉은 승객: 어깨와 머리 (창틀보다 낮게 앉아서 밖으로 나오지 않음)
      const px = x + w * (0.5 + who.dx);
      const headR = h * 0.17;
      const hy = y + h * (0.5 - who.tall * 0.06);
      ctx.globalAlpha = night ? 1 : 0.55;
      ctx.fillStyle = who.shirt;
      ctx.beginPath();
      ctx.ellipse(px, y + h * 0.98, w * 0.24, h * 0.3, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#f2c9a6';
      ctx.beginPath();
      ctx.arc(px, hy, headR, 0, TAU);
      ctx.fill();
      ctx.fillStyle = who.hair;
      ctx.beginPath();
      ctx.arc(px, hy - headR * 0.15, headR * 1.02, Math.PI * 1.05, Math.PI * 1.95);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (!night) {
      // 유리에 비친 햇빛이 스쳐 지나감
      const sweep = ((worldX + now / 6) % 220) - 60;
      const gl = ctx.createLinearGradient(x + sweep - 14, 0, x + sweep + 14, 0);
      gl.addColorStop(0, 'rgba(255,255,255,0)');
      gl.addColorStop(0.5, 'rgba(255,255,255,0.75)');
      gl.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gl;
      ctx.beginPath();
      ctx.moveTo(x + sweep - 6, y);
      ctx.lineTo(x + sweep + 10, y);
      ctx.lineTo(x + sweep - 4, y + h);
      ctx.lineTo(x + sweep - 20, y + h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(x, y, w, h * 0.18);
    }
    ctx.restore();
    // 창틀
    rr(ctx, x, y, w, h, Math.min(6, h * 0.3));
    ctx.strokeStyle = '#3a3d47';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    if (night) {
      ctx.shadowColor = 'rgba(255,250,220,0.8)';
      ctx.shadowBlur = 6;
      ctx.strokeStyle = 'rgba(255,250,225,0.35)';
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }
}
