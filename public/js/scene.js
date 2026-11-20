// 실시간 하늘·바다·해변 장면
// 실제 해의 고도와 방위각에 맞춰 하늘색이 바뀌고 해가 뜨고 집니다.

import { solarPosition, PLACES, HORIZON_ELEVATION } from './sun.js';
import { drawCritterFast } from './characters.js';
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
    this.weather = null; // { sky, pty, temp, label } 기상청 실제 날씨
    this.clouds = Array.from({ length: 6 }, (_, i) => ({ x: rnd(), y: 0.12 + rnd() * 0.25, w: 0.12 + rnd() * 0.16, v: 0.002 + rnd() * 0.004, k: i }));
    this.cloudsMore = [...this.clouds, ...Array.from({ length: 7 }, (_, i) => ({ x: rnd(), y: 0.08 + rnd() * 0.55, w: 0.14 + rnd() * 0.18, v: 0.002 + rnd() * 0.004, k: i + 6 }))];
    this.islands = Array.from({ length: 4 }, () => ({ x: rnd(), w: 0.06 + rnd() * 0.12, h: 0.008 + rnd() * 0.018 }));
    this.gulls = Array.from({ length: 3 }, () => ({ x: rnd(), y: 0.2 + rnd() * 0.15, v: 0.01 + rnd() * 0.01, p: rnd() * 6 }));
    this.resize();
    window.addEventListener('resize', () => this.resize());
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
    this.horizonY = h * 0.5;
    this.shoreY = this.horizonY + h * 0.13;
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
    const top = this.shoreY + 20 + H * 0.03 * 1.05;
    const bottom = H - Math.max(130, H * 0.2); // 아래쪽 버튼 영역을 피합니다
    const rows = 5;
    const slots = [];
    for (let r = 0; r < rows; r++) {
      const t = r / (rows - 1);
      const y = lerp(top, bottom, t ** 1.15);
      const s = lerp(H * 0.03, H * 0.075, t);
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

  ritualAt(slot, isSelf = false) {
    if (!slot) return;
    const kind = this.place === 'east' ? 'lantern' : 'boat';
    this.effects.push({ kind, x: slot.x, y: slot.y - slot.s * 1.2, s: slot.s, t0: performance.now(), self: isSelf, seed: Math.random() * 6 });
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
    draw.sort((a, b) => a.sl.y - b.sl.y);
    for (const { sl, p } of draw) {
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
      });
    }
    ctx.restore();

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
