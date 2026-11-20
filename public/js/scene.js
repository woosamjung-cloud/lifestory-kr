// 실시간 하늘·바다·해변 장면
// 실제 해의 고도와 방위각에 맞춰 하늘색이 바뀌고 해가 뜨고 집니다.

import { solarPosition, PLACES, HORIZON_ELEVATION } from './sun.js';
import { drawCritterFast, drawPet } from './characters.js';
import { NightSky } from './nightsky.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(c1, c2, t) {
  const a = typeof c1 === 'string' ? hexToRgb(c1) : c1;
  const b = typeof c2 === 'string' ? hexToRgb(c2) : c2;
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

// 해 고도별 하늘색 [고도, 천정색, 수평선색]
const SKY = [
  [-18, '#03050d', '#080d22'],
  [-12, '#060b20', '#141c44'],
  [-8, '#0d1636', '#2c2d63'],
  [-5, '#1a2757', '#6d4a7c'],
  [-2.5, '#2a3c78', '#d26f5f'],
  [0, '#3a5795', '#ff965a'],
  [3, '#4a74b2', '#ffbe7a'],
  [7, '#5290d3', '#ffdcb0'],
  [15, '#3f84d6', '#bfe1f8'],
  [40, '#2f75cc', '#a9d6f5'],
];

function skyColors(e) {
  if (e <= SKY[0][0]) return [hexToRgb(SKY[0][1]), hexToRgb(SKY[0][2])];
  for (let i = 1; i < SKY.length; i++) {
    if (e <= SKY[i][0]) {
      const t = (e - SKY[i - 1][0]) / (SKY[i][0] - SKY[i - 1][0]);
      return [mix(SKY[i - 1][1], SKY[i][1], t), mix(SKY[i - 1][2], SKY[i][2], t)];
    }
  }
  const last = SKY[SKY.length - 1];
  return [hexToRgb(last[1]), hexToRgb(last[2])];
}

// 간단한 고정 난수 (매번 같은 별 배치)
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export class Scene {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.place = 'east';
    this.placeInfo = PLACES.east;
    this.centerAz = 115;
    this.time = new Date();
    this.people = []; // 다른 승객 [{id, seat, char, color}]
    this.self = null; // { char, color, name }
    this.selfSeat = null;
    this.effects = [];
    this.hops = new Map(); // slotIndex -> 시작 시각
    this.celebrateAt = 0;
    const rnd = seeded(7);
    this.night = new NightSky();
    this.selfItems = { candle: false, bigfire: false }; // 내가 켜 둔 유료 아이템
    this.bursts = []; // 폭죽
    this.flashes = new Map(); // 후레쉬 흔들기
    this.wishFx = []; // 동전 소원
    this.weather = null; // { sky, pty, temp, label } 기상청 실제 날씨
    this.clouds = Array.from({ length: 6 }, (_, i) => ({ x: rnd(), y: 0.12 + rnd() * 0.25, w: 0.12 + rnd() * 0.16, v: 0.002 + rnd() * 0.004, k: i }));
    this.cloudsMore = [...this.clouds, ...Array.from({ length: 7 }, (_, i) => ({ x: rnd(), y: 0.08 + rnd() * 0.55, w: 0.14 + rnd() * 0.18, v: 0.002 + rnd() * 0.004, k: i + 6 }))];
    this.islands = Array.from({ length: 4 }, () => ({ x: rnd(), w: 0.06 + rnd() * 0.12, h: 0.008 + rnd() * 0.018 }));
    this.gulls = Array.from({ length: 3 }, () => ({ x: rnd(), y: 0.2 + rnd() * 0.15, v: 0.01 + rnd() * 0.01, p: rnd() * 6 }));
    this.resize();
    window.addEventListener('resize', () => this.resize());
    // 휴대폰을 옆으로 돌렸을 때 (일부 브라우저는 resize가 늦게 옴)
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 250));
    if (window.visualViewport) window.visualViewport.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.dpr = dpr;
    this.W = w;
    this.H = h;
    // 가로 화면(휴대폰을 옆으로 돌림)은 높이가 낮아서 수평선을 조금 위로 올리고 해변을 넓게
    this.landscape = w > h * 1.25;
    this.horizonY = h * (this.landscape ? 0.4 : 0.5);
    this.shoreY = this.horizonY + h * (this.landscape ? 0.1 : 0.13);
    this.pxPerDeg = Math.max(w / 75, h / 48);
    this.sunR = Math.max(16, h * 0.042);
    this.layoutSlots();
  }

  setPlace(placeKey, eventTime) {
    this.place = placeKey;
    const p = PLACES[placeKey];
    this.placeInfo = p;
    this.centerAz = solarPosition(eventTime, p.lat, p.lon).azimuth;
    this.effects = [];
    this.layoutSlots();
  }

  // 좌석(자리) 배치: 바다 가까운 줄부터, 가운데부터 채웁니다. 내 자리는 따로 둡니다.
  layoutSlots() {
    const { W, H } = this;
    // 맨 앞줄 머리 꼭대기가 파도 거품선(최대 shoreY+16px)보다 아래에 오도록
    // 캐릭터 크기 기준: 가로 화면은 높이가 낮으므로 조금 키움
    const unit = this.landscape ? H * 1.3 : H;
    const top = this.shoreY + 20 + unit * 0.03 * 1.05;
    // 아래쪽 버튼 영역을 피합니다 (가로 화면은 버튼이 낮아 덜 비움)
    let bottom = H - (this.landscape ? 84 : Math.max(130, H * 0.2));
    if (bottom < top + unit * 0.08) bottom = top + unit * 0.08;
    const rows = 5;
    const slots = [];
    for (let r = 0; r < rows; r++) {
      const t = r / (rows - 1);
      const y = lerp(top, bottom, t ** 1.15);
      const s = lerp(unit * 0.03, unit * 0.075, t);
      const gap = s * 1.38;
      const n = Math.max(3, Math.floor((W * 0.92) / gap));
      const row = [];
      for (let c = 0; c < n; c++) {
        const off = (c - (n - 1) / 2) * gap + (r % 2 ? gap * 0.5 : 0);
        row.push({ x: W / 2 + off, y, s, r, d: Math.abs(off) });
      }
      row.sort((a, b) => a.d - b.d);
      slots.push(...row);
    }
    // 내 자리: 맨 앞줄(화면 아래) 가운데에서 살짝 왼쪽
    const lastRow = slots.filter((sl) => sl.r === rows - 1);
    const mine = lastRow.reduce((best, sl) => {
      const score = Math.abs(sl.x - (W / 2 - W * 0.08));
      return !best || score < best.score ? { sl, score } : best;
    }, null).sl;
    this.mySlot = mine;
    this.slots = slots.filter((sl) => sl !== mine);
  }

  slotForSeat(seat) {
    if (seat == null) return null;
    // 서버 좌석 번호를 화면 자리에 대응 (내 좌석보다 앞 번호는 그대로, 뒤 번호는 한 칸 당김)
    let idx = seat;
    if (this.selfSeat != null && seat > this.selfSeat) idx -= 1;
    return this.slots[idx] || null;
  }

  sunInfo() {
    const p = PLACES[this.place];
    const pos = solarPosition(this.time, p.lat, p.lon);
    let d = pos.azimuth - this.centerAz;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    // 해를 실제보다 크게 그리므로, 일출·일몰 순간(-0.833도)에 해의 윗부분이 수평선에 닿게 맞춥니다.
    return {
      elevation: pos.elevation,
      x: this.W / 2 + d * this.pxPerDeg,
      y: this.horizonY + this.sunR - (pos.elevation - HORIZON_ELEVATION) * this.pxPerDeg,
    };
  }

  // ---------- 효과 ----------
  cheerAt(slot, isSelf = false) {
    if (!slot) return;
    const t0 = performance.now();
    this.hops.set(slot, t0);
    this.effects.push({ kind: 'cheer', slot, t0, self: isSelf });
  }

  ritualAt(slot, isSelf = false, text = null) {
    if (!slot) slot = this.slots[Math.floor(Math.random() * Math.min(40, this.slots.length))];
    if (!slot) return;
    const kind = PLACES[this.place].kind === 'sunrise' ? 'lantern' : 'boat';
    this.effects.push({ kind, x: slot.x, y: slot.y - slot.s * 1.2, s: slot.s, t0: performance.now(), self: isSelf, seed: Math.random() * 6, text });
    if (this.effects.length > 120) this.effects.splice(0, this.effects.length - 120);
  }

  celebrate() {
    this.celebrateAt = performance.now();
  }

  // ---------- 그리기 ----------
  render(nowMs) {
    const { ctx, W, H, horizonY, shoreY } = this;
    const sun = this.sunInfo();
    const e = sun.elevation;
    const [zen, hor] = skyColors(e);
    const light = clamp((e + 9) / 15);
    const warm = clamp(1 - Math.abs(e) / 7);

    // 하늘
    const g = ctx.createLinearGradient(0, 0, 0, horizonY);
    g.addColorStop(0, rgb(zen));
    g.addColorStop(0.65, rgb(mix(zen, hor, 0.55)));
    g.addColorStop(1, rgb(hor));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, horizonY + 1);

    // 해 주변 노을빛
    if (warm > 0) {
      const gx = clamp(sun.x, -W * 0.3, W * 1.3);
      const rg = ctx.createRadialGradient(gx, horizonY, 0, gx, horizonY, W * 0.75);
      rg.addColorStop(0, `rgba(255,150,80,${0.55 * warm})`);
      rg.addColorStop(0.35, `rgba(255,110,90,${0.25 * warm})`);
      rg.addColorStop(1, 'rgba(255,100,100,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, horizonY + 1);
    }

    // 실제 밤하늘: 별·별자리·달·유성 (구름량에 따라 가려짐)
    const wx = this.weather;
    const cover = wx ? { 1: 0.1, 3: 0.55, 4: 0.9 }[wx.sky] ?? 0.25 : 0.25;
    const starA = clamp((-e - 4) / 8);
    this.night.draw(ctx, this, this.time, nowMs, starA, cover);
    this.night.drawOvercast(ctx, this, cover, light);

    // 구름
    const cloudBase = mix(mix('#2a3156', '#ffffff', light), hor, 0.35 * warm);
    const cloudUnder = mix(cloudBase, [255, 140, 110], 0.6 * warm);
    // 맑음이면 구름 두 조각만, 구름많음·흐림이면 더 많이
    const cloudList = cover > 0.4 ? this.cloudsMore : cover < 0.2 ? this.clouds.slice(0, 2) : this.clouds;
    const cloudScale = cover > 0.4 ? 1.35 : 1;
    for (const c of cloudList) {
      const cx = (((c.x + (nowMs / 1000) * c.v * 0.05) % 1.3) - 0.15) * W;
      const cy = c.y * horizonY;
      const cw = c.w * W * cloudScale;
      ctx.fillStyle = rgb(cloudBase, 0.55 + 0.25 * light);
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.ellipse(cx + (i - 1.5) * cw * 0.28, cy - Math.sin(i * 1.7 + c.k) * cw * 0.06, cw * 0.24, cw * 0.11, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = rgb(cloudUnder, 0.5 * (0.3 + warm));
      ctx.beginPath();
      ctx.ellipse(cx, cy + cw * 0.06, cw * 0.5, cw * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
      // 손그림 잉크 윤곽 (위쪽 둥근 선만)
      ctx.strokeStyle = `rgba(74,53,44,${0.12 + 0.18 * light})`;
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.ellipse(cx + (i - 1.5) * cw * 0.28, cy - Math.sin(i * 1.7 + c.k) * cw * 0.06, cw * 0.24, cw * 0.11, 0, Math.PI * 1.08, Math.PI * 1.92);
        ctx.stroke();
      }
    }

    // 해
    const sunR = this.sunR;
    if (sun.y - sunR < horizonY) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, horizonY);
      ctx.clip();
      ctx.globalAlpha = 1 - clamp((cover - 0.4) * 1.3, 0, 0.75);
      const glow = ctx.createRadialGradient(sun.x, sun.y, sunR * 0.5, sun.x, sun.y, sunR * 4);
      glow.addColorStop(0, 'rgba(255,220,150,0.55)');
      glow.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(sun.x - sunR * 4, sun.y - sunR * 4, sunR * 8, sunR * 8);
      const core = mix('#ff6a3a', '#fff6d8', clamp((e + 1) / 10));
      ctx.fillStyle = rgb(core);
      ctx.beginPath();
      ctx.arc(sun.x, sun.y, sunR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 갈매기 (낮·여명)
    if (light > 0.45) {
      ctx.strokeStyle = `rgba(40,40,60,${(light - 0.45) * 1.2})`;
      ctx.lineWidth = 1.6;
      for (const gl of this.gulls) {
        const gx = (((gl.x + (nowMs / 1000) * gl.v * 0.1) % 1.2) - 0.1) * W;
        const gy = gl.y * horizonY + Math.sin(nowMs / 900 + gl.p) * 6;
        const flap = Math.sin(nowMs / 160 + gl.p) * 4;
        ctx.beginPath();
        ctx.moveTo(gx - 8, gy - flap);
        ctx.quadraticCurveTo(gx - 3, gy - 4, gx, gy);
        ctx.quadraticCurveTo(gx + 3, gy - 4, gx + 8, gy - flap);
        ctx.stroke();
      }
    }

    // 서해 섬 실루엣 (정서진)
    if (this.place === 'west') {
      ctx.fillStyle = rgb(mix(mix(zen, [0, 0, 0], 0.4), hor, 0.25));
      for (const is of this.islands) {
        const ix = is.x * W;
        ctx.beginPath();
        ctx.moveTo(ix - is.w * W * 0.5, horizonY + 1);
        ctx.quadraticCurveTo(ix, horizonY - is.h * H * 2.2, ix + is.w * W * 0.5, horizonY + 1);
        ctx.fill();
      }
    }

    // 바다
    const seaTop = mix(hor, zen, 0.35);
    const sg = ctx.createLinearGradient(0, horizonY, 0, shoreY);
    sg.addColorStop(0, rgb(mix(seaTop, [0, 0, 0], 0.15)));
    sg.addColorStop(1, rgb(mix(zen, [0, 10, 30], 0.45)));
    ctx.fillStyle = sg;
    ctx.fillRect(0, horizonY, W, shoreY - horizonY + 2);

    // 물에 비친 햇빛 기둥
    if (e > -3) {
      const a = clamp((e + 3) / 4) * (1 - clamp((e - 25) / 20));
      for (let i = 0; i < 26; i++) {
        const t = i / 26;
        const yy = horizonY + 2 + t * (shoreY - horizonY);
        const wv = Math.sin(nowMs / 400 + i * 1.3) * 6 * (1 + t);
        const ww = sunR * (0.6 + t * 2.2) * (0.6 + 0.4 * Math.sin(nowMs / 300 + i));
        ctx.fillStyle = `rgba(255,${190 + 50 * clamp(e / 10)},120,${a * (0.55 - t * 0.35)})`;
        ctx.fillRect(clamp(sun.x, -W, 2 * W) - ww / 2 + wv, yy, ww, 1.6 + t * 1.5);
      }
    }

    // 잔물결
    ctx.strokeStyle = `rgba(255,255,255,${0.06 + 0.12 * light})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      const t = (i + ((nowMs / 4000) % 1)) / 14;
      const yy = horizonY + t * t * (shoreY - horizonY);
      ctx.beginPath();
      for (let x = 0; x < W + 24; x += 24) {
        const yv = yy + Math.sin(x / 40 + i * 2 + nowMs / 900) * (0.6 + t * 2);
        if (x === 0) ctx.moveTo(x, yv);
        else ctx.lineTo(x, yv);
      }
      ctx.stroke();
    }

    // 땅 (정동진: 모래사장 / 정서진: 나무 데크)
    // 밝기 필터 대신 색 자체를 어둡게 섞습니다 (필터는 매우 느림)
    const bright = 0.45 + 0.55 * light;
    const night = [8, 10, 28];
    const dk = (hex) => rgb(mix(hex, night, 1 - bright));
    ctx.save();
    if (this.place === 'east') {
      const sand = ctx.createLinearGradient(0, shoreY, 0, H);
      sand.addColorStop(0, dk('#e9cfa3'));
      sand.addColorStop(1, dk('#c9a375'));
      ctx.fillStyle = sand;
      ctx.beginPath();
      ctx.moveTo(0, shoreY + 6);
      for (let x = 0; x < W + 20; x += 20) ctx.lineTo(x, shoreY + Math.sin(x / 70 + nowMs / 1500) * 3);
      ctx.lineTo(W + 20, H);
      ctx.lineTo(0, H);
      ctx.closePath();
      ctx.fill();
      // 밀려오는 파도 거품
      const foam = (Math.sin(nowMs / 2200) + 1) / 2;
      ctx.strokeStyle = `rgba(255,255,255,${(0.75 * bright).toFixed(2)})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let x = 0; x < W + 16; x += 16) {
        const yv = shoreY + 4 + foam * 10 + Math.sin(x / 35 + nowMs / 700) * 2.5;
        if (x === 0) ctx.moveTo(x, yv);
        else ctx.lineTo(x, yv);
      }
      ctx.stroke();
      // 왼쪽 바위
      // 소나무 (바위 뒤)
      this.drawPines(ctx, W, H, shoreY, dk, bright);
      ctx.fillStyle = dk('#6b6570');
      ctx.beginPath();
      const rk = Math.min(W * 0.22, H * 0.16); // 해안 절벽 크기
      ctx.moveTo(-10, shoreY - rk * 0.55);
      ctx.quadraticCurveTo(rk * 0.35, shoreY - rk * 0.72, rk * 0.62, shoreY - rk * 0.3);
      ctx.quadraticCurveTo(rk * 0.95, shoreY + rk * 0.05, rk * 0.85, shoreY + rk * 0.35);
      ctx.lineTo(-10, shoreY + rk * 0.45);
      ctx.fill();
      ctx.strokeStyle = rgb(mix('#4a352c', night, 1 - bright), 0.8);
      ctx.lineWidth = 1.6;
      ctx.stroke();
      // 바위 결
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(rk * 0.2, shoreY - rk * 0.45);
      ctx.quadraticCurveTo(rk * 0.35, shoreY - rk * 0.2, rk * 0.3, shoreY + rk * 0.15);
      ctx.moveTo(rk * 0.55, shoreY - rk * 0.15);
      ctx.lineTo(rk * 0.6, shoreY + rk * 0.12);
      ctx.stroke();
      // 모래 위 조약돌
      ctx.fillStyle = dk('#b49a78');
      for (let i = 0; i < 14; i++) {
        const px = ((i * 137) % 100) / 100 * W;
        const py = shoreY + 24 + (((i * 61) % 100) / 100) * (H - shoreY - 40);
        ctx.beginPath();
        ctx.ellipse(px, py, 2.2 + (i % 3), 1.4 + (i % 2), 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      const deckTop = shoreY;
      ctx.fillStyle = dk('#9a6a45');
      ctx.fillRect(0, deckTop, W, H - deckTop);
      ctx.strokeStyle = rgb(mix('#3c2314', night, 1 - bright), 0.45);
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 18; i++) {
        const t = i / 18;
        const yy = deckTop + t * t * (H - deckTop);
        ctx.beginPath();
        ctx.moveTo(0, yy);
        ctx.lineTo(W, yy);
        ctx.stroke();
      }
      // 난간
      ctx.strokeStyle = dk('#6b4329');
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, deckTop - H * 0.025);
      ctx.lineTo(W, deckTop - H * 0.025);
      ctx.stroke();
      ctx.lineWidth = 2;
      for (let x = 0; x <= W; x += Math.max(28, W / 30)) {
        ctx.beginPath();
        ctx.moveTo(x, deckTop - H * 0.025);
        ctx.lineTo(x, deckTop + 2);
        ctx.stroke();
      }
    }

    // 승객들 (먼 줄부터) - 이불 색이 탁해지지 않도록 땅보다 덜 어둡게
    const critterBright = 0.72 + 0.28 * light;
    const rim = { x: sun.x > W / 2 ? 1 : -1, color: 'rgb(255,190,120)', a: clamp(1 - Math.abs(e - 2) / 8) * 0.9 };
    const celebrating = nowMs - this.celebrateAt < 4000;
    const draw = [];
    for (const p of this.people) {
      const sl = this.slotForSeat(p.seat);
      if (sl) draw.push({ sl, p });
    }
    if (this.self && !this.selfStanding) draw.push({ sl: this.mySlot, p: { ...this.self, me: true } });
    // 불멍 화로: 내 자리 오른쪽 앞
    const fire = this.fireSpot();
    const fireNight = clamp(1 - light);
    this.drawFireGlow(ctx, fire, nowMs, fireNight);
    draw.push({ sl: { y: fire.y, x: fire.x }, fire: true });
    draw.sort((a, b) => a.sl.y - b.sl.y);
    for (const { sl, p, fire: isFire } of draw) {
      if (isFire) {
        this.drawFire(ctx, fire, nowMs, fireNight);
        continue;
      }
      const hopT = this.hopPhase(sl, nowMs);
      const cel = celebrating ? Math.abs(Math.sin((nowMs - this.celebrateAt) / 260 + sl.x)) : 0;
      drawCritterFast(ctx, {
        x: sl.x,
        y: sl.y,
        s: sl.s,
        type: p.char,
        color: p.color,
        arms: Math.max(hopT > 0 ? 1 : 0, celebrating ? 1 : 0),
        hop: Math.max(hopT > 0 ? Math.sin(hopT * Math.PI) : 0, cel * 0.5),
        rim,
        t: nowMs,
        steam: p.me || sl.r >= 3,
        dpr: this.dpr,
        bright: critterBright,
        hair: p.hair ?? null,
      });
      // 함께 온 강아지·고양이 (오른쪽 옆)
      if (p.pet) drawPet(ctx, { x: sl.x + sl.s * 0.62, y: sl.y, s: sl.s, kind: p.pet, t: nowMs + sl.x * 37, bright: critterBright, hop: Math.max(hopT > 0 ? Math.sin(hopT * Math.PI) : 0, cel * 0.5) });
      const candle = p.me ? this.selfItems.candle : p.flags & 1;
      if (candle) this.drawCandle(ctx, sl.x - sl.s * 0.62, sl.y, sl.s, nowMs);
      const fl = this.flashes.get(sl);
      if (fl) this.drawFlash(ctx, sl, nowMs, fl);
    }
    ctx.restore();
    // 불빛이 가까운 사람들을 따뜻하게 비춤
    this.drawFireLight(ctx, fire, nowMs, fireNight);

    // 내 이름표
    if (this.self && !this.selfStanding) {
      const sl = this.mySlot;
      const label = this.self.name ? `나 · ${this.self.name}` : '나';
      ctx.font = `700 ${Math.max(12, sl.s * 0.22)}px "Gowun Batang", serif`;
      const tw = ctx.measureText(label).width + 16;
      const ly = sl.y - sl.s * 1.85;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      roundRect(ctx, sl.x - tw / 2, ly - 12, tw, 22, 11);
      ctx.fill();
      ctx.fillStyle = '#3b2a20';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, sl.x, ly - 1);
    }

    // 효과들
    this.renderEffects(nowMs, sun);

    // 폭죽·동전 소원
    this.drawBursts(ctx, nowMs);
    this.drawWishes(ctx, nowMs);

    // 비·눈 (실제 날씨)
    if (wx) this.night.drawPrecip(ctx, this, wx.pty, nowMs);

    // 종이 질감 (일러스트 느낌)
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = this.grainPattern();
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // 밤에는 전체적으로 살짝 어둡게
    if (light < 1) {
      ctx.fillStyle = `rgba(5,8,25,${(1 - light) * 0.18})`;
      ctx.fillRect(0, 0, W, H);
    }

    return sun;
  }

  // 정동진 바위 위 소나무 (손그림 느낌)
  drawPines(ctx, W, H, shoreY, dk, bright) {
    const ink = `rgba(${Math.round(74 * bright)},${Math.round(53 * bright)},${Math.round(44 * bright)},0.85)`;
    const rk = Math.min(W * 0.22, H * 0.16);
    const trees = [
      [rk * 0.18, shoreY - rk * 0.6, rk * 0.75, -0.1],
      [rk * 0.45, shoreY - rk * 0.5, rk * 0.55, 0.12],
    ];
    for (const [tx, ty, th, lean] of trees) {
      ctx.strokeStyle = dk('#5a4032');
      ctx.lineWidth = Math.max(2, th * 0.06);
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.quadraticCurveTo(tx + lean * th, ty - th * 0.5, tx + lean * th * 1.6, ty - th);
      ctx.stroke();
      for (let k = 0; k < 3; k++) {
        const ly = ty - th * (0.45 + k * 0.22);
        const lx = tx + lean * th * (0.8 + k * 0.4);
        const lw = th * (0.42 - k * 0.09);
        ctx.fillStyle = dk(k % 2 ? '#3f5d48' : '#4a6b52');
        ctx.beginPath();
        ctx.ellipse(lx, ly, lw, th * 0.09, lean, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = ink;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(lx, ly, lw, th * 0.09, lean, Math.PI, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  // ---------- 불멍 화로 ----------
  fireSpot() {
    const sl = this.mySlot;
    const fs = Math.min(sl.s * 1.5, this.W * 0.16) * (this.selfItems.bigfire ? 1.35 : 1);
    return { x: Math.min(sl.x + this.W * 0.22, this.W - fs * 0.8), y: sl.y - sl.s * 0.1, s: fs };
  }

  flicker(t, k = 0) {
    return 0.82 + 0.1 * Math.sin(t / 97 + k) + 0.06 * Math.sin(t / 41 + k * 2.3) + 0.04 * Math.sin(t / 23 + k * 5.1);
  }

  drawFireGlow(ctx, f, t, night) {
    const fl = this.flicker(t);
    const R = f.s * (2 + night * 1.8) * fl;
    const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, R);
    g.addColorStop(0, `rgba(255,160,70,${(0.12 + 0.38 * night) * fl})`);
    g.addColorStop(0.45, `rgba(255,120,50,${(0.05 + 0.16 * night) * fl})`);
    g.addColorStop(1, 'rgba(255,100,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(f.x, f.y, R, R * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawFireLight(ctx, f, t, night) {
    if (night < 0.15) return;
    const fl = this.flicker(t, 1);
    const R = f.s * 2.6 * fl;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(f.x, f.y - f.s * 0.4, 0, f.x, f.y - f.s * 0.4, R);
    g.addColorStop(0, `rgba(255,140,60,${0.16 * night * fl})`);
    g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(f.x - R, f.y - f.s * 0.4 - R, R * 2, R * 2);
    ctx.restore();
  }

  drawFire(ctx, f, t, night) {
    const { x, y, s } = f;
    const west = this.place === 'west';
    ctx.save();
    if (west) {
      // 정서진: 무쇠 화로 (나무 데크 위)
      ctx.fillStyle = '#2f2724';
      ctx.beginPath();
      ctx.moveTo(x - s * 0.42, y - s * 0.22);
      ctx.quadraticCurveTo(x, y + s * 0.12, x + s * 0.42, y - s * 0.22);
      ctx.lineTo(x + s * 0.36, y - s * 0.28);
      ctx.lineTo(x - s * 0.36, y - s * 0.28);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#2f2724';
      ctx.lineWidth = Math.max(1.5, s * 0.05);
      for (const sg of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(x + sg * s * 0.2, y - s * 0.08);
        ctx.lineTo(x + sg * s * 0.28, y + s * 0.04);
        ctx.stroke();
      }
    } else {
      // 정동진: 돌을 둘러 쌓은 모닥불
      for (let i = 0; i < 9; i++) {
        const a = Math.PI + (i / 8) * Math.PI;
        ctx.fillStyle = i % 2 ? '#6d6a70' : '#7d7980';
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(a) * s * 0.42, y + Math.sin(a) * s * 0.1 + s * 0.02, s * 0.11, s * 0.075, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // 장작
    ctx.strokeStyle = '#4a2f22';
    ctx.lineCap = 'round';
    ctx.lineWidth = s * 0.1;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.3, y - s * 0.2 - (west ? s * 0.12 : 0));
    ctx.lineTo(x + s * 0.22, y - s * 0.08 - (west ? s * 0.12 : 0));
    ctx.moveTo(x + s * 0.3, y - s * 0.22 - (west ? s * 0.12 : 0));
    ctx.lineTo(x - s * 0.2, y - s * 0.07 - (west ? s * 0.12 : 0));
    ctx.stroke();
    // 숯불
    const base = y - s * (west ? 0.27 : 0.14);
    const ember = ctx.createRadialGradient(x, base, 0, x, base, s * 0.32);
    ember.addColorStop(0, `rgba(255,190,90,${0.9 * this.flicker(t, 2)})`);
    ember.addColorStop(1, 'rgba(200,60,20,0)');
    ctx.fillStyle = ember;
    ctx.beginPath();
    ctx.ellipse(x, base, s * 0.32, s * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    // 불꽃: 여러 갈래가 서로 다른 박자로 일렁임
    ctx.globalCompositeOperation = 'lighter';
    const tongues = [
      [-0.16, 0.55, 0.13, 1.0],
      [0.14, 0.6, 0.12, 2.1],
      [0, 0.85, 0.17, 0.3],
      [-0.06, 0.65, 0.1, 3.7],
      [0.08, 0.5, 0.09, 5.2],
    ];
    if (this.selfItems.bigfire) {
      // 큰 캠프파이어: 색이 바뀌는 불꽃 갈래 추가
      tongues.push([-0.24, 0.5, 0.1, 6.3], [0.24, 0.48, 0.1, 7.9], [0.04, 1.0, 0.13, 9.1]);
    }
    for (const [ox, hh, ww, k] of tongues) {
      const h = s * hh * (0.75 + 0.25 * Math.sin(t / (150 + k * 30) + k) + 0.1 * Math.sin(t / 53 + k * 3));
      const w = s * ww;
      const sway = Math.sin(t / 310 + k) * s * 0.06 + Math.sin(t / 89 + k * 2) * s * 0.025;
      const bx = x + ox * s;
      const g = ctx.createLinearGradient(bx, base, bx, base - h);
      if (this.selfItems.bigfire && k > 6) {
        const hue = (t / 40 + k * 60) % 360;
        g.addColorStop(0, `hsla(${hue},90%,65%,0.75)`);
        g.addColorStop(1, `hsla(${hue},90%,55%,0)`);
      } else {
        g.addColorStop(0, 'rgba(255,170,60,0.85)');
        g.addColorStop(0.45, 'rgba(255,110,30,0.55)');
        g.addColorStop(1, 'rgba(230,60,20,0)');
      }
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(bx - w, base);
      ctx.bezierCurveTo(bx - w * 1.1, base - h * 0.45, bx + sway - w * 0.2, base - h * 0.75, bx + sway, base - h);
      ctx.bezierCurveTo(bx + sway + w * 0.2, base - h * 0.75, bx + w * 1.1, base - h * 0.45, bx + w, base);
      ctx.closePath();
      ctx.fill();
      // 안쪽 밝은 심지
      const ih = h * 0.55;
      const ig = ctx.createLinearGradient(bx, base, bx, base - ih);
      ig.addColorStop(0, 'rgba(255,245,200,0.75)');
      ig.addColorStop(1, 'rgba(255,200,90,0)');
      ctx.fillStyle = ig;
      ctx.beginPath();
      ctx.moveTo(bx - w * 0.45, base);
      ctx.quadraticCurveTo(bx + sway * 0.5, base - ih * 1.2, bx + w * 0.45, base);
      ctx.closePath();
      ctx.fill();
    }

    // 불티: 위로 올라가며 사라짐
    if (!this.embers) this.embers = [];
    const dt = this._fireT ? Math.min(0.1, (t - this._fireT) / 1000) : 0;
    this._fireT = t;
    if (Math.random() < dt * (this.selfItems.bigfire ? 22 : 9)) this.embers.push({ x: x + (Math.random() - 0.5) * s * 0.3, y: base - s * 0.2, vx: (Math.random() - 0.5) * s * 0.3, vy: -(s * 0.8 + Math.random() * s * 0.9), life: 0, max: 1.4 + Math.random() * 1.8, r: 0.8 + Math.random() * 1.4, ph: Math.random() * 6 });
    this.embers = this.embers.filter((e) => {
      e.life += dt;
      if (e.life > e.max) return false;
      e.x += (e.vx + Math.sin(t / 300 + e.ph) * s * 0.25) * dt;
      e.y += e.vy * dt;
      e.vy *= 0.995;
      const a = (1 - e.life / e.max) * (0.6 + 0.4 * Math.sin(t / 60 + e.ph));
      ctx.fillStyle = `rgba(255,${150 + Math.floor(60 * (1 - e.life / e.max))},70,${a})`;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fill();
      return true;
    });
    ctx.restore();
  }

  // ---------- 유료 아이템 ----------
  drawCandle(ctx, x, y, s, t) {
    const h = s * 0.32;
    const w = s * 0.09;
    ctx.save();
    ctx.fillStyle = '#f3e9d6';
    ctx.fillRect(x - w / 2, y - h, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(x + w * 0.15, y - h, w * 0.35, h);
    const fl = this.flicker(t, x);
    const fy = y - h - s * 0.08;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, fy, 0, x, fy, s * 0.55 * fl);
    g.addColorStop(0, 'rgba(255,190,100,0.45)');
    g.addColorStop(1, 'rgba(255,160,60,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - s * 0.6, fy - s * 0.6, s * 1.2, s * 1.2);
    ctx.fillStyle = `rgba(255,220,140,${0.9 * fl})`;
    ctx.beginPath();
    ctx.ellipse(x + Math.sin(t / 180 + x) * s * 0.01, fy, s * 0.03, s * 0.08 * fl, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  flashAt(slot) {
    if (slot) this.flashes.set(slot, performance.now());
  }

  drawFlash(ctx, sl, t, t0) {
    const age = (t - t0) / 1000;
    if (age > 6) {
      this.flashes.delete(sl);
      return;
    }
    const a = age < 0.3 ? age / 0.3 : age > 5.4 ? (6 - age) / 0.6 : 1;
    const sway = Math.sin(age * 4.2) * sl.s * 0.35;
    const x = sl.x + sway;
    const y = sl.y - sl.s * 1.35;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, sl.s * 1.1);
    g.addColorStop(0, `rgba(255,255,235,${0.8 * a})`);
    g.addColorStop(0.2, `rgba(255,245,210,${0.35 * a})`);
    g.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - sl.s * 1.1, y - sl.s * 1.1, sl.s * 2.2, sl.s * 2.2);
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(2, sl.s * 0.05), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  fireworksFrom(x) {
    const now = performance.now();
    for (let k = 0; k < 3; k++) {
      this.bursts.push({
        x0: x,
        x: this.W * (0.15 + Math.random() * 0.7),
        y: this.horizonY * (0.15 + Math.random() * 0.45),
        t0: now + k * 650,
        hue: Math.floor(Math.random() * 360),
        n: 46 + Math.floor(Math.random() * 20),
      });
    }
    if (this.bursts.length > 30) this.bursts.splice(0, this.bursts.length - 30);
    if (this.onBoom) setTimeout(() => this.onBoom(), 900);
  }

  drawBursts(ctx, t) {
    if (!this.bursts.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    this.bursts = this.bursts.filter((b) => {
      const age = (t - b.t0) / 1000;
      if (age < 0) return true;
      if (age > 3.4) return false;
      const rise = 0.8;
      if (age < rise) {
        // 쏘아 올리는 꼬리
        const p = age / rise;
        const x = b.x0 + (b.x - b.x0) * p;
        const y = this.shoreY + (b.y - this.shoreY) * (1 - (1 - p) ** 2);
        ctx.fillStyle = `hsla(${b.hue},80%,75%,0.9)`;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
        return true;
      }
      const e = age - rise;
      const R = this.H * 0.16 * (1 - Math.exp(-e * 2.2));
      const a = Math.max(0, 1 - e / 2.6);
      for (let i = 0; i < b.n; i++) {
        const ang = (i / b.n) * Math.PI * 2;
        const x = b.x + Math.cos(ang) * R;
        const y = b.y + Math.sin(ang) * R + e * e * 14; // 중력으로 처짐
        ctx.fillStyle = `hsla(${(b.hue + (i % 3) * 25) % 360},90%,${65 + (i % 2) * 15}%,${a})`;
        ctx.beginPath();
        ctx.arc(x, y, 1.8 + (i % 3) * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      if (e < 0.25) {
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, this.H * 0.12);
        g.addColorStop(0, `hsla(${b.hue},90%,80%,${0.35 * (1 - e / 0.25)})`);
        g.addColorStop(1, `hsla(${b.hue},90%,70%,0)`);
        ctx.fillStyle = g;
        ctx.fillRect(b.x - this.H * 0.12, b.y - this.H * 0.12, this.H * 0.24, this.H * 0.24);
      }
      return true;
    });
    ctx.restore();
  }

  wishLabel(ctx, text, x, y, a, self) {
    ctx.save();
    ctx.font = `${self ? 700 : 400} ${Math.max(13, this.H * 0.017)}px "Gowun Batang", serif`;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(255,190,110,0.95)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = `rgba(255,250,235,${a})`;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  // 동전을 바다로 던지고, 소원 문구가 하늘로 떠오름
  wishFrom(slot, text, isSelf = false) {
    if (!slot) return;
    const tx = slot.x + (Math.random() - 0.5) * this.W * 0.3;
    this.wishFx.push({ x0: slot.x, y0: slot.y - slot.s * 1.1, tx, ty: this.horizonY + (this.shoreY - this.horizonY) * (0.35 + Math.random() * 0.4), t0: performance.now(), text, self: isSelf });
    if (this.wishFx.length > 25) this.wishFx.shift();
    if (this.onCoin) setTimeout(() => this.onCoin(), 750);
  }

  drawWishes(ctx, t) {
    if (!this.wishFx.length) return;
    ctx.save();
    this.wishFx = this.wishFx.filter((w) => {
      const age = (t - w.t0) / 1000;
      if (age > 9) return false;
      const fly = 0.75;
      if (age < fly) {
        // 포물선을 그리며 날아가는 동전
        const p = age / fly;
        const x = w.x0 + (w.tx - w.x0) * p;
        const y = w.y0 + (w.ty - w.y0) * p - Math.sin(p * Math.PI) * this.H * 0.12;
        ctx.fillStyle = '#e8c15a';
        ctx.strokeStyle = '#a3802b';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(x, y, 4, 4 * Math.abs(Math.cos(age * 18)) + 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        return true;
      }
      const e = age - fly;
      // 퐁당: 퍼지는 물결
      if (e < 2.2) {
        for (let k = 0; k < 3; k++) {
          const r = (e * 26 + k * 9) * (1 + k * 0.2);
          const a = Math.max(0, 0.6 - e / 2.2 - k * 0.12);
          ctx.strokeStyle = `rgba(255,255,255,${a})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.ellipse(w.tx, w.ty, r, r * 0.28, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      // 소원 문구가 하늘로 천천히 떠오름
      const tp = Math.min(1, e / 7);
      const a = e < 0.6 ? e / 0.6 : tp > 0.75 ? (1 - tp) / 0.25 : 1;
      const y = w.ty - this.H * 0.08 - tp * this.horizonY * 0.55;
      ctx.font = `${w.self ? 700 : 400} ${Math.max(14, this.H * 0.02)}px "Gowun Batang", serif`;
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(255,200,120,0.9)';
      ctx.shadowBlur = 12;
      ctx.fillStyle = `rgba(255,250,235,${a})`;
      ctx.fillText(w.text, w.tx, y);
      ctx.shadowBlur = 0;
      return true;
    });
    ctx.restore();
  }

  grainPattern() {
    if (this._grain) return this._grain;
    const c = document.createElement('canvas');
    c.width = c.height = 160;
    const g = c.getContext('2d');
    const img = g.createImageData(160, 160);
    let r = 12345;
    for (let i = 0; i < img.data.length; i += 4) {
      r = (r * 1664525 + 1013904223) >>> 0;
      const v = r & 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    this._grain = this.ctx.createPattern(c, 'repeat');
    return this._grain;
  }

  hopPhase(slot, nowMs) {
    const t0 = this.hops.get(slot);
    if (!t0) return 0;
    const t = (nowMs - t0) / 650;
    if (t >= 1) {
      this.hops.delete(slot);
      return 0;
    }
    return t;
  }

  renderEffects(nowMs, sun) {
    const { ctx, horizonY } = this;
    this.effects = this.effects.filter((fx) => {
      const age = (nowMs - fx.t0) / 1000;
      if (fx.kind === 'cheer') {
        if (age > 1.4) return false;
        const a = 1 - age / 1.4;
        ctx.font = `${Math.max(16, fx.slot.s * (fx.self ? 0.55 : 0.4))}px "Nanum Brush Script", "Gowun Batang", serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.strokeStyle = `rgba(120,50,20,${a * 0.6})`;
        ctx.lineWidth = 3;
        const ty = fx.slot.y - fx.slot.s * 1.75 - age * 40;
        ctx.strokeText('와!', fx.slot.x, ty);
        ctx.fillText('와!', fx.slot.x, ty);
        return true;
      }
      if (fx.kind === 'lantern') {
        const dur = 14;
        if (age > dur) return false;
        const t = age / dur;
        const x = fx.x + Math.sin(age * 0.9 + fx.seed) * 18 + t * 30;
        const y = lerp(fx.y, horizonY * 0.08, 1 - (1 - t) ** 1.6);
        const s = fx.s * lerp(0.6, 0.2, t);
        const a = t < 0.85 ? 1 : (1 - t) / 0.15;
        const glow = ctx.createRadialGradient(x, y, 0, x, y, s * 2.2);
        glow.addColorStop(0, `rgba(255,190,90,${0.6 * a})`);
        glow.addColorStop(1, 'rgba(255,160,60,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(x - s * 2.2, y - s * 2.2, s * 4.4, s * 4.4);
        // 한지 풍등: 위가 넓고 아래가 좁은 모양, 안에서 빛이 번짐
        const lg = ctx.createLinearGradient(x, y - s * 0.6, x, y + s * 0.5);
        lg.addColorStop(0, `rgba(240,${fx.self ? 120 : 140},70,${a})`);
        lg.addColorStop(0.7, `rgba(255,${fx.self ? 175 : 190},110,${a})`);
        lg.addColorStop(1, `rgba(255,230,170,${a})`);
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.moveTo(x - s * 0.42, y - s * 0.55);
        ctx.quadraticCurveTo(x, y - s * 0.72, x + s * 0.42, y - s * 0.55);
        ctx.lineTo(x + s * 0.28, y + s * 0.42);
        ctx.quadraticCurveTo(x, y + s * 0.5, x - s * 0.28, y + s * 0.42);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = `rgba(150,80,40,${a * 0.35})`;
        ctx.lineWidth = Math.max(0.6, s * 0.04);
        ctx.beginPath();
        ctx.moveTo(x, y - s * 0.62);
        ctx.lineTo(x, y + s * 0.46);
        ctx.stroke();
        ctx.fillStyle = `rgba(255,250,210,${a})`;
        ctx.beginPath();
        ctx.arc(x, y + s * 0.36, s * 0.09, 0, Math.PI * 2);
        ctx.fill();
        if (fx.text) this.wishLabel(ctx, fx.text, x, y - s * 1.1, a, fx.self);
        return true;
      }
      if (fx.kind === 'boat') {
        const dur = 16;
        if (age > dur) return false;
        const t = age / dur;
        const ease = 1 - (1 - t) ** 2;
        const x = lerp(fx.x, clamp(sun.x, this.W * 0.1, this.W * 0.9), ease * 0.7) + Math.sin(age * 1.5 + fx.seed) * 4;
        const y = lerp(this.shoreY - 4, horizonY + 6, ease);
        const s = fx.s * lerp(0.6, 0.08, ease);
        const a = t < 0.85 ? 1 : (1 - t) / 0.15;
        ctx.fillStyle = `rgba(255,255,250,${a})`;
        ctx.beginPath();
        ctx.moveTo(x - s, y - s * 0.3);
        ctx.lineTo(x + s, y - s * 0.3);
        ctx.lineTo(x + s * 0.6, y + s * 0.15);
        ctx.lineTo(x - s * 0.6, y + s * 0.15);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = `rgba(240,235,225,${a})`;
        ctx.beginPath();
        ctx.moveTo(x - s * 0.1, y - s * 0.3);
        ctx.lineTo(x + s * 0.05, y - s * 1.1);
        ctx.lineTo(x + s * 0.55, y - s * 0.3);
        ctx.closePath();
        ctx.fill();
        if (fx.self) {
          ctx.fillStyle = `rgba(255,200,120,${a * 0.9})`;
          ctx.beginPath();
          ctx.arc(x + s * 0.05, y - s * 1.2, Math.max(1.5, s * 0.12), 0, Math.PI * 2);
          ctx.fill();
        }
        if (fx.text) this.wishLabel(ctx, fx.text, x, y - Math.max(10, s * 1.6), a, fx.self);
        return true;
      }
      return false;
    });

    // 해 뜨는/지는 순간 반짝이
    const ca = (nowMs - this.celebrateAt) / 1000;
    if (ca >= 0 && ca < 5) {
      const n = 60;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + i;
        const r = ca * (120 + (i % 7) * 30);
        const x = sun.x + Math.cos(ang) * r;
        const y = Math.min(horizonY, sun.y) + Math.sin(ang) * r * 0.6 - ca * 20;
        ctx.fillStyle = `hsla(${30 + (i % 5) * 12},100%,70%,${1 - ca / 5})`;
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
