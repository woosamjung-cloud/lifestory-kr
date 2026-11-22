// 실시간 하늘·바다·해변 장면
// 실제 해의 고도와 방위각에 맞춰 하늘색이 바뀌고 해가 뜨고 집니다.

import { solarPosition, PLACES, HORIZON_ELEVATION } from './sun.js';
import { drawCritterFast, drawPet, drawWalker, drawPettingArm, BREEDS } from './characters.js';
import { localizeCtx } from './i18n.js';
import { cameraFor } from './camera.js';
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


// ---------- 구름 모양 (흰 마스크) ----------
// cumulus 뭉게구름 · tower 여름 쌘구름 · stratus 흐린 날 층구름 · nimbus 비구름 · mackerel 가을 비늘구름 · cirrus 새털구름
function makeCloudMask(kind, k) {
  const sizes = { cumulus: [420, 150], tower: [360, 320], stratus: [700, 160], nimbus: [700, 200], mackerel: [520, 160], cirrus: [600, 110] };
  const [w, h] = sizes[kind] || sizes.cumulus;
  const m = document.createElement('canvas');
  m.width = w;
  m.height = h;
  const g = m.getContext('2d');
  let r = (k + 1) * 9301 + kind.length * 77;
  const rnd = () => ((r = (r * 1664525 + 1013904223) >>> 0) / 4294967296);
  const puff = (px, py, pr, a0 = 0.55) => {
    const rg = g.createRadialGradient(px, py, 0, px, py, pr);
    rg.addColorStop(0, `rgba(255,255,255,${a0})`);
    rg.addColorStop(0.6, `rgba(255,255,255,${a0 * 0.6})`);
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg;
    g.fillRect(px - pr, py - pr, pr * 2, pr * 2);
  };
  const flatBottom = (base) => {
    g.globalCompositeOperation = 'destination-out';
    const cut = g.createLinearGradient(0, base - h * 0.02, 0, base + h * 0.1);
    cut.addColorStop(0, 'rgba(0,0,0,0)');
    cut.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = cut;
    g.fillRect(0, base - h * 0.02, w, h);
    g.globalCompositeOperation = 'source-over';
  };
  if (kind === 'cumulus' || kind === 'tower') {
    const tall = kind === 'tower';
    const base = h * (tall ? 0.85 : 0.72);
    for (let i = 0; i < (tall ? 46 : 34); i++) {
      const u = rnd();
      const hump = Math.sin(u * Math.PI);
      const px = w * (0.12 + 0.76 * u);
      const pr = h * (tall ? 0.08 + 0.14 * hump : 0.12 + 0.2 * hump) * (0.6 + 0.6 * rnd());
      const py = base - pr * 0.5 - (tall ? h * 0.55 * hump * rnd() : pr * 0.9 * rnd() * hump);
      puff(px, py, pr);
    }
    flatBottom(base);
  } else if (kind === 'stratus' || kind === 'nimbus') {
    // 하늘을 넓게 덮는 낮고 평평한 층, 아래로 갈수록 짙음
    const dark = kind === 'nimbus';
    for (let i = 0; i < 60; i++) {
      const px = w * rnd();
      const py = h * (0.3 + 0.45 * rnd());
      puff(px, py, h * (0.25 + 0.25 * rnd()), dark ? 0.5 : 0.35);
    }
    if (dark) {
      // 비가 내리는 줄기 (아래로 흐릿하게)
      for (let i = 0; i < 14; i++) {
        const px = w * (0.1 + 0.8 * rnd());
        const lg = g.createLinearGradient(0, h * 0.6, 0, h);
        lg.addColorStop(0, 'rgba(255,255,255,0.25)');
        lg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = lg;
        g.fillRect(px, h * 0.6, w * 0.04 * (0.5 + rnd()), h * 0.4);
      }
    }
  } else if (kind === 'mackerel') {
    // 가을 비늘구름: 작은 조각이 줄지어 늘어섬
    for (let row = 0; row < 5; row++) {
      const y = h * (0.25 + row * 0.12);
      for (let i = 0; i < 14; i++) {
        const px = w * (0.08 + i * 0.062 + (row % 2) * 0.03 + (rnd() - 0.5) * 0.03);
        // 서로 살짝 이어진 부드러운 조각
        puff(px, y + (rnd() - 0.5) * h * 0.05, h * (0.09 + 0.05 * rnd()), 0.32);
        puff(px + w * 0.02, y + h * 0.02, h * 0.07, 0.2);
      }
    }
  } else {
    // 새털구름: 높은 하늘에 가늘게 흩날림
    for (let i = 0; i < 10; i++) {
      const y = h * (0.2 + 0.6 * rnd());
      const x0 = w * 0.1 * rnd();
      g.strokeStyle = `rgba(255,255,255,${0.25 + 0.2 * rnd()})`;
      g.lineWidth = 2 + rnd() * 4;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x0, y);
      g.bezierCurveTo(w * 0.35, y - h * 0.15 * rnd(), w * 0.6, y + h * 0.1 * rnd(), w * (0.8 + 0.18 * rnd()), y - h * 0.25 * rnd());
      g.stroke();
    }
  }
  // 가장자리를 부드럽게 지워 네모난 경계가 보이지 않게
  g.globalCompositeOperation = 'destination-in';
  const fx = g.createLinearGradient(0, 0, w, 0);
  fx.addColorStop(0, 'rgba(0,0,0,0)');
  fx.addColorStop(0.15, 'rgba(0,0,0,1)');
  fx.addColorStop(0.85, 'rgba(0,0,0,1)');
  fx.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fx;
  g.fillRect(0, 0, w, h);
  const fy = g.createLinearGradient(0, 0, 0, h);
  fy.addColorStop(0, 'rgba(0,0,0,0)');
  fy.addColorStop(0.18, 'rgba(0,0,0,1)');
  fy.addColorStop(0.85, 'rgba(0,0,0,1)');
  fy.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fy;
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'source-over';
  return m;
}

// 날씨와 계절에 맞는 구름 무리 (종류, 높이, 크기)
function cloudPlan(sky, pty, month) {
  const season = month >= 3 && month <= 5 ? 'spring' : month >= 6 && month <= 8 ? 'summer' : month >= 9 && month <= 11 ? 'autumn' : 'winter';
  const list = [];
  const add = (kind, n, y0, y1, w0, w1) => {
    for (let i = 0; i < n; i++) list.push({ kind, y: y0 + (y1 - y0) * ((i * 0.618) % 1), w: w0 + (w1 - w0) * ((i * 0.37) % 1) });
  };
  if (pty) {
    add('nimbus', 3, 0.15, 0.55, 0.9, 1.2);
    add('stratus', 2, 0.05, 0.3, 0.9, 1.1);
  } else if (sky >= 4) {
    add('stratus', 4, 0.05, 0.6, 0.8, 1.1);
    add('cumulus', 2, 0.4, 0.7, 0.2, 0.3);
  } else if (sky === 3) {
    if (season === 'summer') add('tower', 3, 0.45, 0.75, 0.22, 0.32);
    add('cumulus', 5, 0.15, 0.7, 0.14, 0.28);
    if (season === 'autumn') add('mackerel', 2, 0.1, 0.35, 0.35, 0.5);
    else add('cirrus', 1, 0.08, 0.2, 0.4, 0.5);
  } else {
    if (season === 'summer') add('cumulus', 3, 0.5, 0.75, 0.1, 0.16);
    else if (season === 'autumn') add('mackerel', 1, 0.1, 0.3, 0.35, 0.45);
    else if (season === 'winter') add('cirrus', 2, 0.08, 0.35, 0.35, 0.5);
    else add('cumulus', 2, 0.3, 0.6, 0.12, 0.18);
    add('cirrus', 1, 0.05, 0.2, 0.3, 0.4);
  }
  return list.map((c, i) => ({ ...c, k: i + 1, x: (i * 0.381) % 1, v: 0.002 + ((i * 0.53) % 1) * 0.004 }));
}

// 장작 1.0(가득)이 다 타는 데 걸리는 초 (장작 하나 = 0.35 ≈ 10분)
export const FUEL_SECONDS = 30 * 60;

export class Scene {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = localizeCtx(canvas.getContext('2d'));
    this.place = 'east';
    this.placeInfo = PLACES.east;
    this.centerAz = 115;
    this.baseAz = 115;
    // 넓은 해변: 월드 폭(WW)은 화면 폭보다 넓고, camX만큼 옆으로 옮겨서 보여 줌
    this.camX = 0;
    this.tiltG = 0; // 휴대폰 좌우 기울기 (도)
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
    // 월드 폭: 휴대폰 세로 2배, 가로 1.5배, 넓은 PC 1.3배
    const cw = cameraFor(this.placeInfo).world;
    this.WW = Math.round(w * (w >= 900 ? cw.wide : this.landscape ? cw.landscape : cw.phone));
    this.sunR = Math.max(16, h * 0.042);
    this.layoutSlots();
  }

  setPlace(placeKey, eventTime) {
    this.place = placeKey;
    const p = PLACES[placeKey];
    this.placeInfo = p;
    this.cam = cameraFor(p); // 공통 카메라 규칙 (+ 장소별로 바꾼 값)
    this.centerAz = solarPosition(eventTime, p.lat, p.lon).azimuth;
    this.baseAz = this.centerAz;
    this.effects = [];
    // 장소마다 해변 폭 규칙을 다시 적용
    if (this.W) {
      const cw = this.cam.world;
      this.WW = Math.round(this.W * (this.W >= 900 ? cw.wide : this.landscape ? cw.landscape : cw.phone));
    }
    this.layoutSlots();
  }

  // 좌석(자리) 배치: 바다 가까운 줄부터, 가운데부터 채웁니다. 내 자리는 따로 둡니다.
  layoutSlots() {
    const { H } = this;
    const W = this.WW || this.W; // 자리는 넓은 해변 전체에
    // 맨 앞줄 머리 꼭대기가 파도 거품선(최대 shoreY+16px)보다 아래에 오도록
    // 캐릭터 크기 기준: 가로 화면은 높이가 낮으므로 조금 키움
    const unit = this.landscape ? H * 1.3 : H;
    const top = this.shoreY + 20 + unit * 0.03 * 1.05;
    // 아래쪽 버튼 영역을 피합니다 (가로 화면은 버튼이 낮아 덜 비움)
    let bottom = H - (this.landscape ? 84 : Math.max(130, H * 0.2));
    // 실제 화면 아래 버튼들의 위치를 재서, 캐릭터가 버튼에 가리지 않게
    const ctrlTop = Math.min(...['#ride .actions', '#ride .itembar']
      .map((sel) => document.querySelector(sel))
      .filter((el) => el && el.offsetParent && el.getBoundingClientRect().height > 0)
      .map((el) => el.getBoundingClientRect().top), Infinity);
    if (Number.isFinite(ctrlTop)) bottom = Math.min(bottom, ctrlTop - 12);
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
    // 걷기용: 해변 자리 범위
    this.rowTop = top;
    this.rowBottom = bottom;
    this.sMin = unit * 0.03;
    this.sMax = unit * 0.075;
    this.homeSlot = mine; // 원래 내 자리 (모닥불 위치 기준)
    // 처음에는 내 자리가 화면 가운데쯤 오게
    this.camX = clamp(mine.x - this.W * 0.45, 0, Math.max(0, W - this.W));
    this.camBase = this.camX;
    const prev = this.mySlot;
    this.mySlot = { ...mine };
    if (this.selfPos) {
      Object.assign(this.mySlot, this.posToSlot(this.selfPos[0], this.selfPos[1]));
      if (prev) {
        // 화면 크기가 바뀌어도 걷던 흐름 유지
        this.mySlot.tx = this.mySlot.x;
        this.mySlot.ty = this.mySlot.y;
        this.mySlot.ts = this.mySlot.s;
      }
    }
    this.moved = new Map();
    this.slots = slots.filter((sl) => sl !== mine);
  }

  // ---------- 카메라 (넓은 해변 옆으로 보기) ----------
  toWorldX(x) {
    return x + this.camX;
  }

  panBy(dx) {
    this.camBase = clamp((this.camBase ?? this.camX) + dx, 0, Math.max(0, this.WW - this.W));
    this.camX = this.camBase;
    this.lastPanAt = performance.now();
  }

  // 매 프레임 카메라
  // - 걷거나 서 있을 때: 좌우로 기울이면 그쪽을 조금 더 보여 줌 (내 캐릭터는 항상 화면 안에)
  // - 앉아 있을 때: 좌우로는 아주 조금, 앞뒤로 기울이면 장면이 위아래로 살짝만
  // - 손으로 끌어 구경하다가 앉은 채 6초 지나면 내 자리로 천천히 돌아옴
  updateCamera(dt) {
    const max = Math.max(0, this.WW - this.W);
    const me = this.mySlot;
    if (this.camBase == null) this.camBase = this.camX;
    const standing = !!(me && (me.walking || this.selfUp));
    const now = performance.now();
    const R = this.cam || cameraFor(this.placeInfo);
    // 기울기: 평소 들고 있는 각도를 기준(천천히 따라감)으로 삼아 그 차이만 씀
    const g = this.tiltG || 0;
    const bRaw = this.tiltB;
    if (bRaw != null) this.tiltBase = this.tiltBase == null ? bRaw : this.tiltBase + (bRaw - this.tiltBase) * Math.min(1, dt * 0.25);
    const db = bRaw != null && this.tiltBase != null ? bRaw - this.tiltBase : 0;

    if (me) {
      // 걸을 때는 나를 따라가고
      if (standing) {
        const left = this.camBase + this.W * R.standing.followBand[0];
        const right = this.camBase + this.W * R.standing.followBand[1];
        if (me.x < left) this.camBase -= Math.min(left - me.x, this.W * 1.2 * dt + 0.5);
        else if (me.x > right) this.camBase += Math.min(me.x - right, this.W * 1.2 * dt + 0.5);
      } else if (now - (this.lastPanAt || 0) > R.seated.returnAfterMs) {
        // 앉아서 가만히 있고 내가 화면 밖이면 천천히 돌아옴
        const want = clamp(me.x - this.W * 0.45, 0, max);
        const seen = me.x > this.camBase + this.W * 0.08 && me.x < this.camBase + this.W * 0.92;
        if (!seen || this.camReturning) {
          this.camReturning = Math.abs(want - this.camBase) > 2;
          this.camBase += (want - this.camBase) * Math.min(1, dt * 1.5);
        }
      }
    }
    this.camBase = clamp(this.camBase, 0, max);

    // 기울기로 살짝 더 보여 주기 (서 있을 때만, 부드럽게)
    // 서 있을 때는 화면 폭의 18%까지, 앉아 있을 때는 6%까지만 살짝
    let leadT = 0;
    const dz = R.tilt.deadzone;
    if (Math.abs(g) > dz) leadT = Math.sign(g) * Math.min(1, (Math.abs(g) - dz) / R.tilt.range) * this.W * (standing ? R.standing.leadMax : R.seated.leadMax);
    this.camLead = (this.camLead || 0) + (leadT - (this.camLead || 0)) * Math.min(1, dt * 3);
    let cam = this.camBase + this.camLead;
    // 내 캐릭터는 화면 안쪽(18%~82%)에 꼭 남게
    if (me) cam = clamp(cam, me.x - this.W * R.standing.keepIn[1], me.x - this.W * R.standing.keepIn[0]);
    this.camX = clamp(cam, 0, max);

    // 앉아 있을 때 앞뒤 기울기: 위아래로 살짝 (최대 9px)
    const offT = standing ? 0 : clamp(db / 25, -1, 1) * R.seated.tiltYMax;
    this.camY = (this.camY || 0) + (offT - (this.camY || 0)) * Math.min(1, dt * 3);

    // 먼 하늘·바다는 천천히 (해의 방위를 살짝 돌려서)
    this.farShift = (this.camX - max / 2) * R.farParallax;
    this.centerAz = (this.baseAz ?? this.centerAz) + this.farShift / this.pxPerDeg;
  }

  // ---------- 해변 걷기 ----------
  // 0~1000 위치 → 화면 자리
  posToSlot(px, py) {
    const t = clamp(py / 1000);
    return { x: (px / 1000) * this.WW, y: lerp(this.rowTop, this.rowBottom, t ** 1.15), s: lerp(this.sMin, this.sMax, t), r: Math.round(t * 4) };
  }

  // 월드 좌표 → 0~1000 위치 (해변 밖이면 null)
  screenToPos(x, y) {
    if (y < this.shoreY + 6) return null;
    const f = clamp((y - this.rowTop) / (this.rowBottom - this.rowTop));
    const t = f ** (1 / 1.15);
    return [Math.round(clamp(x / this.WW, 0.03, 0.97) * 1000), Math.round(t * 1000)];
  }

  walkTo(slot, target) {
    slot.tx = target.x;
    slot.ty = target.y;
    slot.ts = target.s;
    slot.tr = target.r;
  }

  // 내 캐릭터를 걷게 함
  walkSelf(px, py) {
    this.selfPos = [px, py];
    this.selfUp = true;
    this.walkTo(this.mySlot, this.posToSlot(px, py));
  }

  stepWalkers(dt) {
    const step = (sl) => {
      if (sl.tx == null) return;
      const dx = sl.tx - sl.x;
      const dy = sl.ty - sl.y;
      const d = Math.hypot(dx, dy);
      const speed = this.W * 0.1 + 40; // px/초 (발걸음에 맞춰 천천히)
      if (d < 1) {
        sl.x = sl.tx;
        sl.y = sl.ty;
        sl.s = sl.ts;
        sl.r = sl.tr ?? sl.r;
        sl.walking = false;
        sl.face = 'back'; // 멈추면 바다를 바라봄
        return;
      }
      const k = Math.min(1, (speed * dt) / d);
      // 걷는 방향에 따라 앞모습·뒷모습·옆모습
      sl.face = Math.abs(dx) > Math.abs(dy) * 1.1 ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'front' : 'back';
      sl.x += dx * k;
      sl.y += dy * k;
      sl.s += (sl.ts - sl.s) * k;
      sl.walking = true;
    };
    step(this.mySlot);
    for (const sl of this.moved.values()) step(sl);
  }

  slotForSeat(seat) {
    if (seat == null) return null;
    if (this.moved && this.moved.has(seat)) return this.moved.get(seat);
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
    const r = this.sunRadius(pos.elevation);
    return {
      elevation: pos.elevation,
      r,
      x: this.W / 2 + d * this.pxPerDeg,
      y: this.horizonY + r - (pos.elevation - HORIZON_ELEVATION) * this.pxPerDeg,
    };
  }

  // 수평선 가까운 해는 사진처럼 크게 보임
  sunRadius(e) {
    return this.sunR * (1 + 0.85 * clamp(1 - (e + 1) / 7));
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
    const kind = PLACES[this.place].kind === 'sunrise' ? 'lantern' : 'bottle';
    this.effects.push({ kind, x: slot.x, y: slot.y - slot.s * 1.2, s: slot.s, t0: performance.now(), self: isSelf, seed: Math.random() * 6, text });
    if (this.effects.length > 120) this.effects.splice(0, this.effects.length - 120);
  }

  celebrate() {
    this.celebrateAt = performance.now();
  }

  // ---------- 그리기 ----------
  render(nowMs) {
    const dtc = this._camT ? Math.min(0.1, (nowMs - this._camT) / 1000) : 0;
    this._camT = nowMs;
    this.updateCamera(dtc);
    const { ctx, W, H, horizonY, shoreY } = this;
    // 앞뒤 기울기로 장면 전체가 위아래로 살짝: 위아래 가장자리에 빈틈이 보이지 않게 미리 칠함
    const camY = this.camY || 0;
    if (Math.abs(camY) > 0.2) {
      ctx.fillStyle = '#0b1027';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.save();
    ctx.translate(0, camY);
    const sun = this.sunInfo();
    const e = sun.elevation;
    const [zen, hor] = skyColors(e);
    const light = clamp((e + 9) / 15);
    // 노을이 가장 진한 때는 해가 막 진 직후(고도 -1° 안팎). 앞뒤로 넉넉히
    const warm = clamp(1 - Math.abs(e + 1) / 9);
    // 노을 농도: 날씨와 장소에 따라 (맑으면 진하고, 구름이 적당하면 구름이 물들어 더 극적, 흐리면 약함)
    const wx0 = this.weather;
    const cover0 = wx0 ? { 1: 0.1, 3: 0.55, 4: 0.9 }[wx0.sky] ?? 0.25 : 0.25;
    const rain0 = wx0 && wx0.pty ? 0.4 : 1;
    const glowK = (cover0 < 0.2 ? 1 : cover0 < 0.7 ? 1.1 : 0.25) * rain0 * (this.place === 'west' ? 1.3 : 1);
    this.glowK = glowK;
    const wk = warm * glowK;

    // 하늘
    const g = ctx.createLinearGradient(0, 0, 0, horizonY);
    g.addColorStop(0, rgb(zen));
    g.addColorStop(0.65, rgb(mix(zen, hor, 0.55)));
    g.addColorStop(1, rgb(hor));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, horizonY + 1);

    if (wk > 0.01) {
      // 노을 띠: 수평선부터 위로 주황 → 분홍 → 보라
      const band = ctx.createLinearGradient(0, horizonY, 0, horizonY * 0.15);
      band.addColorStop(0, `rgba(255,120,55,${Math.min(0.85, 0.7 * wk)})`);
      band.addColorStop(0.18, `rgba(255,95,85,${Math.min(0.7, 0.5 * wk)})`);
      band.addColorStop(0.42, `rgba(220,90,140,${Math.min(0.5, 0.32 * wk)})`);
      band.addColorStop(0.75, `rgba(120,80,160,${Math.min(0.3, 0.18 * wk)})`);
      band.addColorStop(1, 'rgba(90,70,150,0)');
      ctx.fillStyle = band;
      ctx.fillRect(0, 0, W, horizonY + 1);
      // 해가 있는 쪽이 가장 뜨겁게
      const gx = clamp(sun.x, -W * 0.3, W * 1.3);
      const rg = ctx.createRadialGradient(gx, horizonY, 0, gx, horizonY, Math.max(W, H) * 0.85);
      rg.addColorStop(0, `rgba(255,200,110,${Math.min(0.95, 0.85 * wk)})`);
      rg.addColorStop(0.12, `rgba(255,140,60,${Math.min(0.8, 0.6 * wk)})`);
      rg.addColorStop(0.4, `rgba(255,90,70,${Math.min(0.45, 0.28 * wk)})`);
      rg.addColorStop(1, 'rgba(255,80,90,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, horizonY + 1);
    }
    // 해가 낮을 때 하늘 전체가 붉은 주황 한 빛으로 (위는 진한 다홍, 수평선은 주황)
    const sat = (e > 0 ? clamp(1 - e / 8) : clamp(1 - Math.abs(e) / 7.5)) * Math.min(1, glowK);
    this.sat = sat;
    if (sat > 0.02) {
      const mono = ctx.createLinearGradient(0, 0, 0, horizonY);
      mono.addColorStop(0, `rgba(150,35,25,${0.55 * sat})`);
      mono.addColorStop(0.55, `rgba(215,60,25,${0.6 * sat})`);
      mono.addColorStop(1, `rgba(255,120,25,${0.55 * sat})`);
      ctx.fillStyle = mono;
      ctx.fillRect(0, 0, W, horizonY + 1);
      // 노을에 불타는 새털구름: 해 진 뒤 아랫면이 붉게 빛남 (맑은 날도 옅게, 구름 조금이면 진하게)
      const after = clamp((1 - e) / 3); // 해 진 뒤 더 진하게
      const streakK = sat * (cover0 < 0.2 ? 0.55 : cover0 < 0.7 ? 1 : 0.3) * (0.55 + 0.45 * after);
      if (!this.streaks) {
        let r = 4242;
        const rnd = () => ((r = (r * 1664525 + 1013904223) >>> 0) / 4294967296);
        this.streaks = Array.from({ length: 9 }, () => ({ y: 0.12 + rnd() * 0.62, x: rnd(), w: 0.35 + rnd() * 0.5, h: 0.006 + rnd() * 0.012, v: (rnd() - 0.5) * 0.004 }));
      }
      for (const st of this.streaks) {
        const sx = (((st.x + (nowMs / 1000) * Math.abs(st.v) * 0.05 * this.windDir()) % 1.4) + 1.4) % 1.4 - 0.2;
        const cx = sx * W;
        const cy = st.y * horizonY;
        const sw = st.w * W;
        const sh = Math.max(3, st.h * H);
        const near = clamp(1 - Math.abs(cx - sun.x) / (W * 0.9)); // 해 쪽 구름이 더 밝게
        const lowY = st.y; // 수평선에 가까울수록 주황, 위쪽은 분홍·보라
        const col = mix(mix([255, 120, 150], [255, 150, 70], lowY), [255, 210, 120], near * 0.5);
        const fadeX = (a) => {
          const gg = ctx.createLinearGradient(cx - sw / 2, 0, cx + sw / 2, 0);
          gg.addColorStop(0, 'rgba(0,0,0,0)');
          gg.addColorStop(0.25, a);
          gg.addColorStop(0.75, a);
          gg.addColorStop(1, 'rgba(0,0,0,0)');
          return gg;
        };
        // 어두운 구름 몸통 (노을을 등진 쪽)
        ctx.fillStyle = fadeX(`rgba(110,35,50,${0.55 * streakK})`);
        ctx.beginPath();
        ctx.ellipse(cx, cy, sw / 2, sh, 0, 0, Math.PI * 2);
        ctx.fill();
        // 해를 받은 아랫면: 불타는 테두리
        ctx.fillStyle = fadeX(rgb(col, Math.min(0.95, (0.5 + 0.5 * near) * streakK * 1.3)));
        ctx.beginPath();
        ctx.ellipse(cx, cy + sh * 0.55, sw * 0.46, sh * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 실제 밤하늘: 별·별자리·달·유성 (구름량에 따라 가려짐)
    const wx = this.weather;
    const cover = wx ? { 1: 0.1, 3: 0.55, 4: 0.9 }[wx.sky] ?? 0.25 : 0.25;
    const starA = clamp((-e - 4) / 8);
    this.night.draw(ctx, this, this.time, nowMs, starA, cover);
    this.night.drawOvercast(ctx, this, cover, light);

    // 구름: 해 질 녘에는 아랫면이 해에 물들고 윗면은 어둡게
    const cloudTop = mix(mix('#3a3f62', '#f4f2f0', light), [110, 80, 120], 0.55 * warm);
    const cloudUnder = mix(mix('#4a4f70', '#ffffff', light), [255, 125, 75], Math.min(0.95, 0.9 * wk));
    // 맑음이면 구름 두 조각만, 구름많음·흐림이면 더 많이
    const month = new Date(this.time.getTime() + 9 * 3600e3).getUTCMonth() + 1;
    const planKey = `${wx ? wx.sky : 1}|${wx ? wx.pty : 0}|${month}`;
    if (this.planKey !== planKey) {
      this.planKey = planKey;
      this.cloudPlan = cloudPlan(wx ? wx.sky : 1, wx ? wx.pty : 0, month);
    }
    const cloudList = this.cloudPlan;
    const cloudScale = 1;
    for (const c of cloudList) {
      // 모든 구름이 같은 바람을 타고 한 방향으로 (가까운 낮은 구름이 조금 더 빨라 보임)
      const dir = this.windDir();
      // 화면을 건너는 데 걸리는 초: 불멍처럼 아주 천천히 (7~12분), 바람이 세면 조금 빨라짐
      const windK = 1 + clamp(((wx && wx.wind) || 0) / 12) * 0.6;
      const period = ((560 / (0.6 + c.v * 120)) * (1.25 - c.y * 0.6)) / windK;
      const life = (((nowMs / 1000) / period + c.x) % 1 + 1) % 1; // 0→1 한 번 건너기
      const cx = dir > 0 ? (-0.25 + life * 1.5) * W : (1.25 - life * 1.5) * W;
      // 흘러가며 조금씩 부풀었다 작아지고, 끝 무렵에는 흩어지며 사라짐
      const grow = 0.75 + 0.35 * Math.sin(life * Math.PI) + 0.04 * Math.sin(nowMs / 30000 + c.k);
      const fade = clamp(life / 0.12) * clamp((1 - life) / 0.2);
      const cy = (c.y + 0.02 * Math.sin(nowMs / 60000 + c.k)) * horizonY;
      const cw = c.w * W * cloudScale * 1.6 * grow;
      const img = this.cloudSprite(c, cloudTop, cloudUnder);
      const ch = cw * (img.height / img.width) * (0.9 + 0.15 * (grow - 0.75));
      const heavy = c.kind === 'stratus' || c.kind === 'nimbus';
      ctx.globalAlpha = (heavy ? 0.85 : c.kind === 'cirrus' ? 0.55 : 0.6 + 0.3 * light) * fade;
      ctx.drawImage(img, cx - cw / 2, cy - ch * 0.6, cw, ch);
      ctx.globalAlpha = 1;
    }

    // 해
    const sunR = sun.r;
    if (sun.y - sunR < horizonY) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, horizonY);
      ctx.clip();
      ctx.globalAlpha = 1 - clamp((cover - 0.4) * 1.3, 0, 0.75);
      const low = clamp(1 - e / 6); // 수평선에 가까울수록 1
      // 은은한 빛무리 (낮은 해는 테두리가 또렷하고 빛무리는 좁게)
      const gr = sunR * (2.2 + 2.5 * (1 - low) + 1.5 * low * glowK);
      const glow = ctx.createRadialGradient(sun.x, sun.y, sunR * 0.95, sun.x, sun.y, gr);
      glow.addColorStop(0, `rgba(255,${Math.round(200 - 50 * low)},${Math.round(90 - 40 * low)},${0.5 + 0.2 * low})`);
      glow.addColorStop(0.3, `rgba(255,120,40,${0.22 * glowK})`);
      glow.addColorStop(1, 'rgba(255,100,40,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(sun.x - gr, sun.y - gr, gr * 2, gr * 2);
      // 해 원반: 가운데 노랑 → 테두리 주황 (낮을수록 진하고 붉게)
      const disk = ctx.createRadialGradient(sun.x, sun.y - sunR * 0.15, 0, sun.x, sun.y, sunR);
      disk.addColorStop(0, rgb(mix([255, 248, 170], [255, 252, 235], clamp((e - 3) / 10))));
      disk.addColorStop(0.55, rgb(mix([255, 214, 40], [255, 240, 190], clamp((e - 3) / 10))));
      disk.addColorStop(1, rgb(mix([255, 120, 20], [255, 225, 160], clamp((e - 2) / 10))));
      ctx.fillStyle = disk;
      ctx.beginPath();
      // 대기 굴절로 수평선 근처의 해는 살짝 납작해 보임
      ctx.ellipse(sun.x, sun.y, sunR, sunR * (1 - 0.1 * low), 0, 0, Math.PI * 2);
      ctx.fill();
      // 눈부심은 해가 충분히 높을 때만 (낮은 해는 사진처럼 맨눈으로 볼 수 있는 원반)
      const glare = clamp((e - 3) / 5) * (1 - clamp((cover - 0.3) * 1.4));
      if (glare > 0.02) {
        ctx.globalCompositeOperation = 'lighter';
        const hot = ctx.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, sunR * 1.1);
        hot.addColorStop(0, `rgba(255,255,245,${0.9 * glare})`);
        hot.addColorStop(1, 'rgba(255,240,200,0)');
        ctx.fillStyle = hot;
        ctx.fillRect(sun.x - sunR * 1.2, sun.y - sunR * 1.2, sunR * 2.4, sunR * 2.4);
        const br = sunR * 10;
        const bloom = ctx.createRadialGradient(sun.x, sun.y, sunR, sun.x, sun.y, br);
        bloom.addColorStop(0, `rgba(255,240,200,${0.45 * glare})`);
        bloom.addColorStop(0.3, `rgba(255,220,170,${0.15 * glare})`);
        bloom.addColorStop(1, 'rgba(255,210,160,0)');
        ctx.fillStyle = bloom;
        ctx.fillRect(sun.x - br, sun.y - br, br * 2, br * 2);
        ctx.globalCompositeOperation = 'source-over';
      }
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
      ctx.fillStyle = rgb(mix(mix(mix(zen, [0, 0, 0], 0.4), hor, 0.25), [28, 12, 14], 0.85 * (this.sat || 0)));
      for (const is of this.islands) {
        const ix = is.x * W - (this.farShift || 0) * 1.6;
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
    if (wk > 0.01) {
      // 노을이 바다에 번짐 (수평선 쪽이 진하고 가까울수록 옅게)
      const sr = ctx.createLinearGradient(0, horizonY, 0, shoreY);
      sr.addColorStop(0, `rgba(255,130,80,${Math.min(0.7, 0.55 * wk)})`);
      sr.addColorStop(0.5, `rgba(220,90,110,${Math.min(0.35, 0.22 * wk)})`);
      sr.addColorStop(1, 'rgba(160,80,120,0)');
      ctx.fillStyle = sr;
      ctx.fillRect(0, horizonY, W, shoreY - horizonY + 2);
    }

    // 해가 낮을 때 바다는 어둡고 붉게 (사진처럼 대비가 강해짐)
    if ((this.sat || 0) > 0.02) {
      const sa = this.sat;
      const dk = ctx.createLinearGradient(0, horizonY, 0, shoreY);
      dk.addColorStop(0, `rgba(225,95,40,${0.88 * sa})`);
      dk.addColorStop(0.3, `rgba(160,50,35,${0.88 * sa})`);
      dk.addColorStop(1, `rgba(50,18,22,${0.9 * sa})`);
      ctx.fillStyle = dk;
      ctx.fillRect(0, horizonY, W, shoreY - horizonY + 2);
    }
    // 물에 비친 햇빛 기둥
    if (e > -3) {
      const a = clamp((e + 3) / 4) * (1 - clamp((e - 25) / 20));
      // 금빛 물길 (원래 어른거림 그대로, 막대 양끝만 부드럽게)
      const px = clamp(sun.x, -W, 2 * W);
      const sat0 = this.sat || 0;
      for (let i = 0; i < 26; i++) {
        const t = i / 26;
        const yy = horizonY + 2 + t * (shoreY - horizonY);
        const wv = Math.sin(nowMs / 400 + i * 1.3) * 6 * (1 + t);
        const ww = sunR * (0.6 + t * 2.6) * (0.6 + 0.4 * Math.sin(nowMs / 300 + i)) * (1 + 0.3 * wk);
        const alpha = Math.min(0.95, a * (0.65 - t * 0.35) * (1 + 0.6 * wk));
        const col = `255,${Math.round(170 + 70 * clamp(e / 10) + 40 * sat0 * (1 - t))},${Math.round(60 + 40 * clamp(e / 10))}`;
        const x0 = px - ww / 2 + wv;
        const lg = ctx.createLinearGradient(x0, 0, x0 + ww, 0);
        lg.addColorStop(0, `rgba(${col},0)`);
        lg.addColorStop(0.2, `rgba(${col},${alpha})`);
        lg.addColorStop(0.8, `rgba(${col},${alpha})`);
        lg.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = lg;
        ctx.fillRect(x0, yy, ww, 1.6 + t * 1.5);
      }
      // 오메가(Ω) 해넘이: 해가 수평선에 닿을 무렵, 해 아랫부분과 물에 비친 해가 이어져 보임
      const touch = clamp(1 - Math.abs(sun.y + sunR * 0.6 - horizonY) / (sunR * 1.6));
      if (touch > 0.02 && e > -1.2) {
        const om = ctx.createRadialGradient(sun.x, horizonY, 0, sun.x, horizonY, sunR * 0.9);
        om.addColorStop(0, `rgba(255,230,90,${0.9 * touch})`);
        om.addColorStop(0.6, `rgba(255,170,40,${0.6 * touch})`);
        om.addColorStop(1, 'rgba(255,120,30,0)');
        ctx.fillStyle = om;
        ctx.beginPath();
        ctx.ellipse(sun.x, horizonY + sunR * 0.18, sunR * 0.75, sunR * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 윤슬: 해가 낮을 때 바다 전체 물결 위에 햇빛이 반짝임 (해 아래가 가장 진하고 양옆으로 옅어짐)
    const glit = e > -2.5 ? clamp((e + 2.5) / 4) * (1 - clamp((e - 14) / 14)) * (1 - 0.75 * clamp((cover - 0.3) / 0.6)) : 0;
    if (glit > 0.02) {
      const sx = clamp(sun.x, -W * 0.3, W * 1.3);
      // 해 쪽 바다 표면에 넓게 번지는 따뜻한 빛
      const sheen = ctx.createRadialGradient(sx, horizonY, 0, sx, horizonY, W * 0.85);
      sheen.addColorStop(0, `rgba(255,205,125,${0.24 * glit})`);
      sheen.addColorStop(0.5, `rgba(255,175,105,${0.11 * glit})`);
      sheen.addColorStop(1, 'rgba(255,150,90,0)');
      ctx.fillStyle = sheen;
      ctx.fillRect(0, horizonY, W, shoreY - horizonY + 2);
      // 물비늘: 정해진 자리에서 제각각 반짝 (물결을 따라가지 않음)
      // 켜지고 꺼질 때 부드럽게 (갑자기 생기거나 사라지지 않게)
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const spr = this.glintSprite();
      const N = 140;
      for (let k = 0; k < N; k++) {
        const r1 = Math.abs((Math.sin(k * 127.1) * 43758.5453) % 1);
        const r2 = Math.abs((Math.sin(k * 311.7) * 24634.6345) % 1);
        const r3 = Math.abs((Math.sin(k * 74.7) * 9631.17) % 1);
        const t = 0.05 + (r2 ** 0.8) * 0.88; // 수평선 ~ 해변 쪽 (자리 고정)
        const x = r1 * W;
        const y = horizonY + t * t * (shoreY - horizonY);
        const near = 1 - clamp(Math.abs(x - sx) / (W * 0.75));
        // 반짝: 사인파의 꼭대기만 쓰고 세제곱으로 부드럽게 (주기 2~5초, 제각각)
        const wave = Math.sin(nowMs / (2000 + r3 * 3000) * Math.PI * 2 + k * 2.39);
        const blink = Math.max(0, wave) ** 3;
        const a = 0.6 * glit * (0.1 + 0.9 * near ** 1.5) * blink;
        if (a < 0.02) continue;
        const len = (3 + 9 * t) * (0.6 + 0.5 * near) * (0.7 + 0.3 * blink);
        const h = 1.2 + 2 * t;
        ctx.globalAlpha = Math.min(0.6, a);
        ctx.drawImage(spr, x - len / 2, y - h / 2, len, h);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // 잔물결 (해가 낮을 때는 금빛을 띰)
    ctx.strokeStyle = glit > 0.02 ? `rgba(255,${Math.round(225 - 25 * glit)},${Math.round(200 - 60 * glit)},${0.06 + 0.12 * light + 0.12 * glit})` : `rgba(255,255,255,${0.06 + 0.12 * light})`;
    ctx.lineWidth = 1;
    const rippleBase = ctx.strokeStyle;
    for (let i = 0; i < 14; i++) {
      const t = (i + ((nowMs / 4000) % 1)) / 14;
      const yy = horizonY + t * t * (shoreY - horizonY);
      // 수평선에서 서서히 나타나 해변 앞에서 서서히 옅어짐 (뚝 끊기지 않게)
      ctx.globalAlpha = clamp(t / 0.1) * clamp((1 - t) / 0.18);
      ctx.strokeStyle = rippleBase;
      ctx.beginPath();
      for (let x = 0; x < W + 24; x += 24) {
        const yv = yy + Math.sin(x / 40 + i * 2 + nowMs / 900) * (0.6 + t * 2);
        if (x === 0) ctx.moveTo(x, yv);
        else ctx.lineTo(x, yv);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // ---------- 여기부터 넓은 해변(월드): 카메라만큼 옆으로 옮겨서 그림 ----------
    ctx.save();
    ctx.translate(-this.camX, 0);
    {
    const W = this.WW;
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
    const dtw = this._walkT ? Math.min(0.1, (nowMs - this._walkT) / 1000) : 0;
    this._walkT = nowMs;
    const seen = new Set();
    for (const p of this.people) {
      if (p.pos) {
        seen.add(p.seat);
        let ms = this.moved.get(p.seat);
        const target = this.posToSlot(p.pos[0], p.pos[1]);
        if (!ms) {
          const base = this.slotForSeat(p.seat);
          ms = base ? { ...base } : { ...target };
          this.moved.set(p.seat, ms);
        }
        if (ms.tx !== target.x || ms.ty !== target.y) this.walkTo(ms, target);
      }
    }
    for (const k of [...this.moved.keys()]) if (!seen.has(k)) this.moved.delete(k);
    this.stepWalkers(dtw);
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
      // 손전등 빛은 몸 앞쪽에서 나가므로 사람보다 먼저 그림 (몸에 살짝 가려짐)
      const fl = this.flashes.get(sl);
      if (fl) this.drawFlash(ctx, sl, nowMs, fl);
      // 사람마다 고정된 박자 차이 (위치에 묶으면 왼쪽으로 걸을 때 시간이 멈춰 보임)
      if (sl.phase == null) sl.phase = Math.random() * 10000;
      const standing = sl.walking || (p.me ? this.selfUp : p.up);
      if (standing) {
        // 걷는 중이거나 서 있는 중 (아래로 쓸면 앉음)
        const still = !sl.walking;
        const face = sl.walking ? sl.face || 'back' : 'back';
        const petX = sl.x + sl.s * (face === 'left' ? -0.55 : 0.55);
        const petFirst = face === 'front';
        const pet = () => p.pet && drawPet(ctx, { x: petX, y: sl.y, s: sl.s, kind: p.pet, t: nowMs + sl.phase * 1.7, bright: critterBright, walking: true, still, face });
        if (!petFirst) pet();
        drawWalker(ctx, { x: sl.x, y: sl.y, s: sl.s, type: p.char, color: p.color, hair: p.hair ?? null, t: nowMs + sl.phase, bright: critterBright, still, face });
        if (petFirst) pet();
        continue;
      }
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
      // 함께 온 강아지·고양이 (오른쪽 옆) + 가끔 머리 쓰다듬기
      if (p.pet) {
        const pt = this.pettingAt(sl, nowMs, hopT <= 0 && !celebrating);
        drawPet(ctx, { x: sl.x + sl.s * 0.62, y: sl.y, s: sl.s, kind: p.pet, t: nowMs + sl.phase * 1.7, bright: critterBright, hop: Math.max(hopT > 0 ? Math.sin(hopT * Math.PI) : 0, cel * 0.5), petted: pt.pet });
        if (pt.reach > 0) drawPettingArm(ctx, { x: sl.x, y: sl.y, s: sl.s, color: p.color, bright: critterBright, reach: pt.reach, stroke: pt.stroke, t: nowMs, petSize: (BREEDS[p.pet] || BREEDS[1]).size });
        // 내 친구 이름 (내 화면에만)
        if (p.me && p.petName) {
          const sz = (BREEDS[p.pet] || BREEDS[1]).size;
          ctx.font = `700 ${Math.max(10, sl.s * 0.15)}px "Gowun Batang", serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const lx = sl.x + sl.s * 0.62;
          const ly = sl.y - sl.s * 0.42 * sz * 1.75 - sl.s * 0.12; // 귀 위로 넉넉히
          const tw = ctx.measureText(p.petName).width + 12;
          ctx.fillStyle = 'rgba(255,248,236,0.85)';
          roundRect(ctx, lx - tw / 2, ly - 9, tw, 18, 9);
          ctx.fill();
          ctx.fillStyle = '#5a3a28';
          ctx.fillText(p.petName, lx, ly + 1);
        }
      }
      const candle = p.me ? this.selfItems.candle : p.flags & 1;
      if (candle) this.drawCandle(ctx, sl.x - sl.s * 0.62, sl.y, sl.s, nowMs);

    }
    ctx.restore();
    // 불빛이 가까운 사람들을 따뜻하게 비춤
    this.drawFireLight(ctx, fire, nowMs, fireNight);
    this.drawFuelHint(ctx, fire, nowMs);

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

    // 바람 자국, 날리는 먼지·낙엽 (화면 기준)
    ctx.save();
    ctx.translate(this.camX, 0);
    this.drawWind(ctx, nowMs, light);
    ctx.restore();

    // 장작·물수제비·하트
    this.drawThrows(ctx, nowMs);
    this.drawReach(ctx, nowMs);
    this.drawBubbles(ctx, nowMs);
    this.drawSitHint(ctx, nowMs);
    this.drawHearts(ctx, nowMs);

    // 폭죽·동전 소원
    this.drawBursts(ctx, nowMs);
    this.drawWishes(ctx, nowMs);
    }
    ctx.restore();
    // ---------- 월드 끝 ----------

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

    ctx.restore(); // 위아래 기울기
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
    const sl = this.homeSlot || this.mySlot;
    const fs = Math.min(sl.s * 1.5, this.W * 0.16) * (this.selfItems.bigfire ? 1.35 : 1);
    return { x: Math.min(sl.x + this.W * 0.22, this.WW - fs * 0.8), y: sl.y - sl.s * 0.1, s: fs };
  }

  flicker(t, k = 0) {
    return 0.82 + 0.1 * Math.sin(t / 97 + k) + 0.06 * Math.sin(t / 41 + k * 2.3) + 0.04 * Math.sin(t / 23 + k * 5.1);
  }

  // 불 크기 배율: 장작이 많을수록 크게 (0.35~1.2)
  fuelK() {
    const f = this.fuel == null ? 0.8 : this.fuel;
    return 0.35 + 0.65 * Math.min(1, f) + 0.2 * Math.max(0, f - 1);
  }

  // 장작 한 개 넣기
  addFuel(amount = 0.35) {
    this.fuel = Math.min(1.4, (this.fuel == null ? 0.8 : this.fuel) + amount);
  }

  // 불이 약해지면 모닥불 옆에 '🪵 장작' 표시가 천천히 깜빡임
  drawFuelHint(ctx, f, t) {
    if (this.fuel == null || this.selfStanding) return;
    // 남은 시간이 4분쯤일 때만 모닥불 아래 게이지가 나타나 천천히 깜빡임 (남은 4분이 줄어드는 만큼 짧아짐)
    const left = (this.fuel - 0.12) * FUEL_SECONDS; // 불씨만 남기까지 남은 초
    const WARN = 240;
    if (left > WARN) return;
    {
      const lvl = clamp(left / WARN);
      const gw = Math.max(36, f.s * 0.8);
      const gh = Math.max(4, f.s * 0.06);
      const gx = f.x - gw / 2;
      const gy = f.y + f.s * 0.22;
      const appear = clamp((WARN - left) / 8); // 나타날 때 부드럽게
      ctx.save();
      ctx.globalAlpha = appear * (0.55 + 0.4 * (0.5 + 0.5 * Math.sin(t / 650)));
      ctx.fillStyle = 'rgba(20,12,8,0.6)';
      roundRect(ctx, gx - 1, gy - 1, gw + 2, gh + 2, (gh + 2) / 2);
      ctx.fill();
      ctx.fillStyle = lvl < 0.4 ? '#e2553b' : '#f0a33a';
      roundRect(ctx, gx, gy, Math.max(gh, gw * lvl), gh, gh / 2);
      ctx.fill();
      ctx.restore();
    }
    const a = (0.45 + 0.35 * Math.sin(t / 900)) * clamp((WARN - left) / 20);
    const txt = '🪵 장작';
    ctx.save();
    ctx.font = `700 ${Math.max(11, f.s * 0.2)}px "Gowun Batang", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(txt).width + 14;
    const x = f.x;
    const y = f.y - f.s * 1.05;
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(255,246,230,0.9)';
    roundRect(ctx, x - w / 2, y - 10, w, 20, 10);
    ctx.fill();
    ctx.fillStyle = '#6b3b10';
    ctx.fillText(txt, x, y + 1);
    ctx.restore();
  }

  drawFireGlow(ctx, f, t, night) {
    const fl = this.flicker(t) * (0.55 + 0.45 * this.fuelK());
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
    const fl = this.flicker(t, 1) * (0.55 + 0.45 * this.fuelK());
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
      const h = s * hh * (0.75 + 0.25 * Math.sin(t / (150 + k * 30) + k) + 0.1 * Math.sin(t / 53 + k * 3)) * (1 + (this.fireBoost || 0)) * this.fuelK();
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
    this.fireBoost = Math.max(0, (this.fireBoost || 0) - dt * 0.35);
    // 장작(연료): 가득 찬 불이 약 30분에 걸쳐 서서히 줄고, 꺼지지는 않고 작은 불씨로 남음
    if (this.fuel == null) this.fuel = 0.8;
    this.fuel = Math.max(0.12, this.fuel - dt / FUEL_SECONDS);
    if (Math.random() < dt * (this.selfItems.bigfire ? 22 : 9) * this.fuelK() * (1 + (this.fireBoost || 0) * 4)) this.embers.push({ x: x + (Math.random() - 0.5) * s * 0.3, y: base - s * 0.2, vx: (Math.random() - 0.5) * s * 0.3, vy: -(s * 0.8 + Math.random() * s * 0.9), life: 0, max: 1.4 + Math.random() * 1.8, r: 0.8 + Math.random() * 1.4, ph: Math.random() * 6 });
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

  // 후레쉬: 품에 든 손전등으로 바다 쪽을 은은하게 비춤 (밤바다를 비추는 따뜻한 빛줄기)
  drawFlash(ctx, sl, t, t0) {
    const age = (t - t0) / 1000;
    const dur = 9;
    if (age > dur) {
      this.flashes.delete(sl);
      return;
    }
    const a = age < 1.2 ? age / 1.2 : age > dur - 1.5 ? (dur - age) / 1.5 : 1;
    const s = sl.s;
    // 가슴 앞에서 시작해 수평선 쪽으로
    const ox = sl.x;
    const oy = sl.y - s * 0.62;
    const sway = Math.sin(age * 0.6 + sl.x * 0.01) * s * 0.9;
    const tx = ox + sway;
    const ty = this.horizonY + (this.shoreY - this.horizonY) * 0.15;
    const ang = Math.atan2(ty - oy, tx - ox);
    const len = Math.hypot(tx - ox, ty - oy);
    const spread = 0.13;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(ox, oy, tx, ty);
    g.addColorStop(0, `rgba(255,226,170,${0.22 * a})`);
    g.addColorStop(0.6, `rgba(255,220,165,${0.08 * a})`);
    g.addColorStop(1, 'rgba(255,215,160,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + Math.cos(ang - spread) * len, oy + Math.sin(ang - spread) * len);
    ctx.lineTo(ox + Math.cos(ang + spread) * len, oy + Math.sin(ang + spread) * len);
    ctx.closePath();
    ctx.fill();
    // 빛이 닿는 바다 위 동그란 빛 웅덩이
    const pg = ctx.createRadialGradient(tx, ty, 0, tx, ty, s * 1.4);
    pg.addColorStop(0, `rgba(255,228,180,${0.14 * a})`);
    pg.addColorStop(1, 'rgba(255,220,170,0)');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.ellipse(tx, ty, s * 1.4, s * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    // 손전등이 있는 가슴 쪽 은은한 빛 (몸 옆으로 살짝 번짐)
    const hg = ctx.createRadialGradient(ox, oy, 0, ox, oy, s * 0.7);
    hg.addColorStop(0, `rgba(255,230,180,${0.18 * a})`);
    hg.addColorStop(1, 'rgba(255,220,170,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(ox - s * 0.7, oy - s * 0.7, s * 1.4, s * 1.4);
    ctx.restore();
  }

  fireworksFrom(x) {
    const now = performance.now();
    for (let k = 0; k < 3; k++) {
      this.bursts.push({
        x0: x,
        x: this.camX + this.W * (0.15 + Math.random() * 0.7),
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

  // ---------- 바람 ----------
  // 바람 방향 하나로 구름·바람 자국·낙엽이 모두 같은 쪽으로 (장소마다 바다에서 불어오는 쪽)
  windDir() {
    return this.place === 'west' ? 1 : -1;
  }

  // 가끔 바람이 지나가며 하얀 바람 자국이 그어지고, 먼지·낙엽이 날려 한쪽으로 사라짐
  drawWind(ctx, t, light) {
    const wx = this.weather;
    const windMs = wx && wx.wind != null ? wx.wind : 3;
    const strength = clamp(windMs / 8, 0.25, 1.4);
    const dir = this.windDir();
    if (!this.wind) this.wind = { lines: [], bits: [], nextGust: t + 2500, lastT: t };
    const W = this.W;
    const H = this.H;
    const dt = Math.min(0.1, (t - this.wind.lastT) / 1000);
    this.wind.lastT = t;
    // 돌풍: 몇 초에 한 번 (바람이 셀수록 자주)
    if (t > this.wind.nextGust) {
      this.wind.nextGust = t + (7000 + Math.random() * 9000) / strength;
      const baseY = this.horizonY * (0.35 + Math.random() * 0.9);
      const n = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < n; i++) {
        this.wind.lines.push({ y: baseY + i * (10 + Math.random() * 14), t0: t + i * 120, len: W * (0.25 + Math.random() * 0.2), amp: 6 + Math.random() * 10, curl: Math.random() < 0.5, speed: W * (0.45 + 0.25 * strength) });
      }
      // 돌풍에 실려 날아가는 먼지·낙엽
      const snowy = wx && [3, 7].includes(wx.pty);
      const m = Math.round(4 + 6 * strength);
      for (let i = 0; i < m; i++) {
        const leaf = !snowy && Math.random() < 0.35;
        this.wind.bits.push({
          x: dir > 0 ? -20 - Math.random() * W * 0.3 : W + 20 + Math.random() * W * 0.3,
          y: this.shoreY + Math.random() * (H - this.shoreY) * 0.8,
          vx: dir * (W * (0.25 + Math.random() * 0.25) * strength),
          vy: -(10 + Math.random() * 30),
          rot: Math.random() * 6,
          vr: (Math.random() - 0.5) * 8,
          leaf,
          col: ['#b5652e', '#c98a3a', '#8a5a2b', '#d1a14a'][Math.floor(Math.random() * 4)],
          sz: leaf ? 3 + Math.random() * 3 : 0.8 + Math.random() * 1.4,
          ph: Math.random() * 6,
        });
      }
    }
    // 가끔 바닥에서 낙엽 하나가 떨어져 굴러감
    if (Math.random() < dt * 0.15 * strength && this.wind.bits.length < 60) {
      this.wind.bits.push({ x: Math.random() * W, y: this.shoreY - 20 - Math.random() * 60, vx: dir * W * 0.08 * strength, vy: 20, rot: 0, vr: 3, leaf: true, col: '#b5652e', sz: 3.5, ph: Math.random() * 6, falling: true });
    }
    ctx.save();
    // 바람 자국: 가는 곡선이 휙 지나가며 그어졌다 사라짐
    ctx.lineCap = 'round';
    this.wind.lines = this.wind.lines.filter((l) => {
      const age = (t - l.t0) / 1000;
      if (age < 0) return true;
      const travel = age * l.speed;
      const total = W + l.len * 2;
      if (travel > total) return false;
      const head = dir > 0 ? -l.len + travel : W + l.len - travel;
      const tail = head - dir * l.len;
      const a = Math.min(1, age * 3) * Math.min(1, (total - travel) / (W * 0.3)) * (0.22 + 0.25 * light);
      const g = ctx.createLinearGradient(tail, 0, head, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.7, `rgba(255,255,255,${a})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      const steps = 18;
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const x = tail + (head - tail) * u;
        let y = l.y + Math.sin(u * Math.PI * 2 + age * 3) * l.amp * 0.4;
        // 끝에서 돌돌 말리는 바람 자국
        if (l.curl && u > 0.8) {
          const k = (u - 0.8) / 0.2;
          y -= Math.sin(k * Math.PI) * l.amp;
        }
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      return true;
    });
    // 먼지·낙엽
    this.wind.bits = this.wind.bits.filter((b) => {
      if (b.falling) {
        b.vy = Math.min(b.vy + 30 * dt, 40);
        if (b.y > this.shoreY + 10) b.falling = false;
      } else {
        b.vy += (Math.sin(t / 300 + b.ph) * 40 - b.vy) * dt;
      }
      b.x += b.vx * dt + Math.sin(t / 250 + b.ph) * 0.6;
      b.y += b.vy * dt;
      b.rot += b.vr * dt;
      if (b.x < -60 || b.x > W + 60 || b.y > H + 20) return false;
      if (b.leaf) {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rot);
        ctx.scale(1, Math.abs(Math.cos(b.rot * 1.3)) * 0.8 + 0.2); // 뒤집히며 날림
        ctx.fillStyle = b.col;
        ctx.globalAlpha = 0.6 + 0.4 * light;
        ctx.beginPath();
        ctx.ellipse(0, 0, b.sz * 1.4, b.sz * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = `rgba(230,215,190,${0.35 + 0.3 * light})`;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.sz, 0, Math.PI * 2);
        ctx.fill();
      }
      return true;
    });
    ctx.restore();
  }

  // ---------- 하트 선물 ----------
  // 화면 좌표에 있는 다른 사람 (가장 가까운 사람)
  personAt(x, y) {
    let best = null;
    for (const p of this.people) {
      const sl = this.slotForSeat(p.seat);
      if (!sl) continue;
      const cy = sl.y - sl.s * 0.5;
      const d = Math.hypot(x - sl.x, (y - cy) * 0.8);
      if (d < Math.max(24, sl.s * 0.6) && (!best || d < best.d)) best = { d, seat: p.seat, slot: sl };
    }
    return best;
  }

  // 사람과 사람이 만나는 거리 (모닥불 불빛이 닿는 반경 정도): 나와 상대 사이
  // 윤슬 빛 조각: 가장자리가 부드럽게 퍼지는 금빛 타원 (한 번만 만들어 둠)
  glintSprite() {
    if (this._glint) return this._glint;
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 16;
    const g = c.getContext('2d');
    g.translate(32, 8);
    g.scale(4, 1);
    const rg = g.createRadialGradient(0, 0, 0, 0, 0, 8);
    rg.addColorStop(0, 'rgba(255,245,215,1)');
    rg.addColorStop(0.35, 'rgba(255,215,150,0.7)');
    rg.addColorStop(1, 'rgba(255,190,120,0)');
    g.fillStyle = rg;
    g.beginPath();
    g.arc(0, 0, 8, 0, Math.PI * 2);
    g.fill();
    this._glint = c;
    return c;
  }

  reachR() {
    return this.fireSpot().s * 2.6;
  }

  isNear(slot) {
    const me = this.mySlot;
    if (!slot || !me) return false;
    const R = this.reachR();
    const dx = (slot.x - me.x) / R;
    const dy = (slot.y - me.y) / (R * 0.6);
    return dx * dx + dy * dy <= 1;
  }

  // 불빛 범위를 잠깐 점선으로 보여 줌 (멀어서 마음을 못 건넬 때)
  showReach(ms = 2200) {
    this.reachUntil = performance.now() + ms;
  }

  drawReach(ctx, t) {
    if (!this.reachUntil || t > this.reachUntil) return;
    const f = this.mySlot; // 내 캐릭터 둘레
    if (!f) return;
    const R = this.reachR();
    const a = clamp((this.reachUntil - t) / 600) * 0.7;
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.lineDashOffset = -t / 60;
    ctx.strokeStyle = `rgba(255,214,150,${a})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(f.x, f.y, R, R * 0.6, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 두 사람에게만 보이는 한마디 말풍선
  bubbleAt(slot, text, self = false) {
    if (!slot) return;
    this.bubbles = (this.bubbles || []).filter((b) => b.slot !== slot);
    this.bubbles.push({ slot, text, self, t0: performance.now() });
  }

  drawBubbles(ctx, t) {
    if (!this.bubbles || !this.bubbles.length) return;
    this.bubbles = this.bubbles.filter((b) => t - b.t0 < 6000);
    for (const b of this.bubbles) {
      const age = (t - b.t0) / 1000;
      const a = clamp(age / 0.3) * clamp((6 - age) / 0.8);
      const sl = b.slot;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = `${Math.max(12, sl.s * 0.17)}px "Gowun Batang", serif`;
      const tw = ctx.measureText(b.text).width + 18;
      const h = Math.max(22, sl.s * 0.3);
      const x = Math.max(this.camX + 6, Math.min(this.camX + this.W - tw - 6, sl.x - tw / 2));
      const y = sl.y - sl.s * (b.self ? 2.05 : 1.55) - h - (1 - clamp(age / 0.3)) * 6; // 내 말풍선은 "나" 이름표 위로
      ctx.fillStyle = b.self ? 'rgba(255,243,214,0.95)' : 'rgba(255,255,255,0.95)';
      roundRect(ctx, x, y, tw, h, h / 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(sl.x - 5, y + h - 1);
      ctx.lineTo(sl.x, y + h + 7);
      ctx.lineTo(sl.x + 5, y + h - 1);
      ctx.fill();
      ctx.fillStyle = '#3b2a20';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.text, x + 9, y + h / 2 + 1);
      ctx.restore();
    }
  }

  heartFrom(from, to, toMe = false, fromMe = false) {
    if (!to) return;
    const f = from || { x: to.x + (Math.random() - 0.5) * this.W * 0.4, y: to.y + 40, s: to.s };
    if (!this.hearts) this.hearts = [];
    this.hearts.push({ x0: f.x, y0: f.y - f.s * 1.1, to, t0: performance.now(), big: toMe || fromMe });
    if (this.hearts.length > 40) this.hearts.shift();
  }

  drawHearts(ctx, t) {
    if (!this.hearts || !this.hearts.length) return;
    const heart = (x, y, r, a) => {
      ctx.fillStyle = `rgba(255,95,120,${a})`;
      ctx.beginPath();
      ctx.moveTo(x, y + r * 0.9);
      ctx.bezierCurveTo(x - r * 1.4, y - r * 0.1, x - r * 0.6, y - r * 1.25, x, y - r * 0.45);
      ctx.bezierCurveTo(x + r * 0.6, y - r * 1.25, x + r * 1.4, y - r * 0.1, x, y + r * 0.9);
      ctx.fill();
    };
    ctx.save();
    this.hearts = this.hearts.filter((h) => {
      const age = (t - h.t0) / 1000;
      const fly = 0.9;
      const tx = h.to.x;
      const ty = h.to.y - h.to.s * 1.3;
      if (age < fly) {
        const p = age / fly;
        const x = h.x0 + (tx - h.x0) * p;
        const y = h.y0 + (ty - h.y0) * p - Math.sin(p * Math.PI) * this.H * 0.08;
        heart(x, y, h.big ? 8 : 6, 0.95);
        return true;
      }
      const e = age - fly;
      if (e > 1.4) return false;
      // 도착하면 퐁 터지며 작은 하트들이 떠오름
      const a = 1 - e / 1.4;
      heart(tx, ty - e * 22, (h.big ? 9 : 7) * (1 + e * 0.3), a);
      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * Math.PI * 2 + 0.6;
        heart(tx + Math.cos(ang) * e * 26, ty - e * 30 + Math.sin(ang) * e * 12, 3, a * 0.8);
      }
      return true;
    });
    ctx.restore();
  }

  // ---------- 장작 넣기 ----------
  nearFire(x, y) {
    const f = this.fireSpot();
    return Math.hypot(x - f.x, (y - (f.y - f.s * 0.3)) * 1.2) < Math.max(36, f.s * 0.75);
  }

  throwWood(fromSlot, isSelf = false) {
    const f = this.fireSpot();
    const from = fromSlot || this.slots[Math.floor(Math.random() * Math.min(30, this.slots.length))] || this.mySlot;
    if (!this.throws) this.throws = [];
    this.throws.push({ kind: 'wood', x0: from.x, y0: from.y - from.s * 0.9, x1: f.x + (Math.random() - 0.5) * f.s * 0.2, y1: f.y - f.s * 0.2, s: f.s, t0: performance.now(), self: isSelf, rot: Math.random() * 6 });
  }

  // ---------- 물수제비 ----------
  // dir: 좌우로 기울어진 정도(-1~1), bounces: 튀는 횟수
  skipStone(fromSlot, dir, bounces, isSelf = true) {
    const from = fromSlot || this.mySlot;
    const pts = [];
    let depth = 0;
    let gap = 0.22;
    for (let i = 0; i <= bounces; i++) {
      depth = Math.min(0.97, depth + gap);
      gap *= 0.78;
      const y = lerp(this.shoreY - 3, this.horizonY + 4, depth);
      pts.push({ x: from.x + dir * (this.shoreY - y) * 0.9, y, d: depth });
    }
    // 가는 길에 바위(정동진 해안 절벽)가 있으면 부딪혀서 튕겨 나옴
    const x0 = from.x;
    const y0 = from.y - from.s * 0.9;
    const hit = this.rockHit(x0, y0, pts, from.y);
    let rock = false;
    if (hit) {
      rock = true;
      const back = Math.sign(x0 - hit.x) || 1;
      const landX = hit.x + back * Math.max(18, Math.abs(x0 - hit.x) * 0.35);
      const landY = Math.min(this.rowBottom, Math.max(this.shoreY + 14, hit.y + from.s * 0.6));
      pts.length = 0;
      pts.push({ x: hit.x, y: hit.y, d: 0, type: 'rock' }, { x: landX, y: landY, d: 0, type: 'sand' });
      bounces = 0;
    }
    if (!this.throws) this.throws = [];
    this.throws.push({ kind: 'stone', x0, y0, pts, n: bounces, t0: performance.now(), self: isSelf, rock });
  }

  // 정동진 해안 바위의 자리 (땅 그림과 같은 크기 계산)
  rockZone() {
    if (this.place !== 'east') return null;
    const rk = Math.min(this.WW * 0.22, this.H * 0.16);
    return { rk, top: this.shoreY - rk * 0.65, bottom: this.shoreY + rk * 0.42 };
  }

  // 바위 안쪽인지: 위는 좁고 아래는 넓은 바위 모양을 대략 따라감
  inRock(x, y) {
    const z = this.rockZone();
    if (!z || y < z.top || y > z.bottom) return false;
    const u = (y - z.top) / (z.bottom - z.top); // 0 위 ~ 1 아래
    const right = z.rk * (0.45 + 0.45 * Math.sin(Math.min(1, u * 1.3) * Math.PI * 0.5));
    return x < right;
  }

  // 돌이 날아가는 길(던진 곳 → 튀는 자리들)을 따라가며 처음 바위에 닿는 곳
  // (바위는 해안선에 있으니, 돌이 바위가 있는 깊이까지 날아갔을 때만 부딪힘)
  rockHit(x0, y0, pts, groundY0 = y0) {
    const z = this.rockZone();
    if (!z) return null;
    const baseY = this.shoreY + z.rk * 0.3; // 바위 밑동 깊이
    let ax = x0;
    let ay = y0;
    let gy = groundY0;
    for (let i = 0; i < pts.length; i++) {
      const b = pts[i];
      const lift = i === 0 ? 40 : 18 * (1 - b.d);
      for (let k = 1; k <= 16; k++) {
        const p = k / 16;
        if (lerp(gy, b.y, p) > baseY) continue; // 아직 바위 앞쪽
        const x = lerp(ax, b.x, p);
        const y = lerp(ay, b.y, p) - lift * Math.sin(p * Math.PI);
        if (this.inRock(x, y)) return { x, y };
      }
      ax = b.x;
      ay = b.y;
      gy = b.y;
    }
    return null;
  }

  // 가끔(20~50초마다, 사람마다 제각각) 옆의 강아지·고양이 머리를 쓰다듬음
  // reach: 팔 뻗기, stroke: 쓰다듬기, pet: 강아지·고양이 반응(힐끔·꼬리)
  pettingAt(sl, now, ok) {
    if (sl.petNext == null) sl.petNext = now + 8000 + Math.random() * 30000;
    // 와! 하며 뛰면 쓰다듬기는 멈춤
    if (!ok && sl.petT0 != null) {
      sl.petT0 = null;
      sl.petNext = now + 15000 + Math.random() * 20000;
    }
    if (sl.petT0 == null && ok && now > sl.petNext) sl.petT0 = now;
    if (sl.petT0 == null) return { reach: 0, stroke: 0, pet: 0 };
    const a = (now - sl.petT0) / 1000;
    const DUR = 3.4;
    if (a > DUR + 1.8) {
      sl.petT0 = null;
      sl.petNext = now + 20000 + Math.random() * 30000;
      return { reach: 0, stroke: 0, pet: 0 };
    }
    const ease = (v) => v * v * (3 - 2 * v);
    const reach = a < 0.5 ? ease(a / 0.5) : a < DUR - 0.6 ? 1 : a < DUR ? ease((DUR - a) / 0.6) : 0;
    const stroke = a > 0.5 && a < DUR - 0.6 ? 1 : 0;
    const pet = a < 0.6 ? 0 : a < DUR ? Math.min(1, (a - 0.6) / 0.5) : clamp(1 - (a - DUR) / 1.8);
    return { reach, stroke, pet };
  }

  // 처음 일어섰을 때: 머리 위에서 아래로 은은하게 내려오는 화살표 (앉으면 사라짐)
  drawSitHint(ctx, t) {
    if (!this.sitHintUntil || !this.selfUp || t > this.sitHintUntil) return;
    const sl = this.mySlot;
    if (!sl || sl.walking) return;
    const left = (this.sitHintUntil - t) / 1000;
    const fadeAll = clamp(left / 1.2) * clamp((8 - left) / 0.8);
    const s = Math.max(sl.s, 30); // 멀리 있어도 잘 보이게 최소 크기
    const x = sl.x;
    const top = sl.y - sl.s * 2.6 - s * 1.5; // '나' 표시 위쪽
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, s * 0.07);
    for (let i = 0; i < 3; i++) {
      const ph = ((t / 1400 + i / 3) % 1);
      const y = top + ph * s * 0.9;
      const a = Math.sin(ph * Math.PI) * 0.85 * fadeAll;
      ctx.strokeStyle = `rgba(255,240,215,${a})`;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.18, y);
      ctx.lineTo(x, y + s * 0.14);
      ctx.lineTo(x + s * 0.18, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawThrows(ctx, t) {
    if (!this.throws || !this.throws.length) return;
    ctx.save();
    this.throws = this.throws.filter((th) => {
      const age = (t - th.t0) / 1000;
      if (th.kind === 'wood') {
        const fly = 0.7;
        if (age < fly) {
          const p = age / fly;
          const x = lerp(th.x0, th.x1, p);
          const y = lerp(th.y0, th.y1, p) - Math.sin(p * Math.PI) * th.s * 1.2;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(th.rot + age * 9);
          ctx.fillStyle = '#7a4b2e';
          ctx.fillRect(-th.s * 0.2, -th.s * 0.05, th.s * 0.4, th.s * 0.1);
          ctx.fillStyle = '#c99a6b';
          ctx.beginPath();
          ctx.ellipse(th.s * 0.2, 0, th.s * 0.03, th.s * 0.05, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          return true;
        }
        if (!th.landed) {
          th.landed = true;
          this.fireBoost = Math.min(1.2, (this.fireBoost || 0) + (th.self ? 0.7 : 0.35));
          if (th.self) this.addFuel(0.35);
          if (this.onWood) this.onWood(th.self);
        }
        return false;
      }
      // 물수제비
      const segs = [0.45];
      for (let i = 1; i < th.pts.length; i++) segs.push(segs[i - 1] * 0.82);
      let acc = 0;
      let seg = -1;
      for (let i = 0; i < segs.length; i++) {
        if (age < acc + segs[i]) {
          seg = i;
          break;
        }
        acc += segs[i];
      }
      // 튄 자리마다 물결
      for (let i = 0; i < th.pts.length; i++) {
        const hitAt = segs.slice(0, i + 1).reduce((a, b) => a + b, 0);
        const ra = age - hitAt;
        if (ra < 0 || ra > 1.6) continue;
        const pt = th.pts[i];
        const sc = 1 - pt.d * 0.85;
        const last = i === th.pts.length - 1;
        if (pt.type) {
          // 바위에 탁 / 모래에 툭: 작은 부스러기가 튐
          if (ra < 0.6) {
            const k = ra / 0.6;
            ctx.fillStyle = pt.type === 'rock' ? `rgba(230,225,215,${0.9 * (1 - k)})` : `rgba(200,170,130,${0.7 * (1 - k)})`;
            for (let j = 0; j < 6; j++) {
              const ang = Math.PI * (0.1 + 0.8 * (j / 5)) + (pt.type === 'rock' ? Math.PI * 0.5 : 0);
              const r = 4 + k * 16;
              ctx.beginPath();
              ctx.arc(pt.x + Math.cos(ang) * r, pt.y - Math.abs(Math.sin(ang)) * r + k * k * 10, 1.4, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          if (!th['s' + i] && ra >= 0) {
            th['s' + i] = true;
            if (pt.type === 'rock' && this.onRock) this.onRock();
          }
          continue;
        }
        ctx.strokeStyle = `rgba(255,255,255,${(0.65 - ra / 1.6 * 0.65) * (last ? 1 : 0.8)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(pt.x, pt.y, (4 + ra * 26) * sc, (1.2 + ra * 6) * sc, 0, 0, Math.PI * 2);
        ctx.stroke();
        if (!th['s' + i] && ra >= 0) {
          th['s' + i] = true;
          if (this.onSkip) this.onSkip(last, i);
        }
      }
      if (seg >= 0) {
        const p = (age - acc) / segs[seg];
        const a0 = seg === 0 ? { x: th.x0, y: th.y0, d: -0.1 } : th.pts[seg - 1];
        const a1 = th.pts[seg];
        const sc = Math.max(0.15, 1 - lerp(Math.max(0, a0.d), a1.d, p) * 0.9);
        const lift = (seg === 0 ? 40 : a1.type === 'sand' ? 14 : 18 * (1 - a1.d)) * Math.sin(p * Math.PI) * sc;
        const x = lerp(a0.x, a1.x, p);
        const y = lerp(a0.y, a1.y, p) - lift;
        ctx.fillStyle = '#8c8a90';
        ctx.beginPath();
        ctx.ellipse(x, y, 4 * sc, 2.6 * sc, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      const total = segs.reduce((a, b) => a + b, 0);
      // 결과 글자 (내 돌만)
      if (th.self && age > total * 0.6 && age < total + 2.2) {
        const last = th.pts[th.pts.length - 1];
        const a = Math.min(1, (age - total * 0.6) / 0.4) * Math.min(1, (total + 2.2 - age) / 0.6);
        ctx.font = `700 ${Math.max(15, this.H * 0.022)}px "Gowun Batang", serif`;
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 8;
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        const word = th.rock ? '탁! 바위에 맞았어요' : th.n > 0 ? `통통 ${th.n}번!` : '퐁당';
        // 글자는 지금 보이는 화면 안에
        const half = ctx.measureText(word).width / 2 + 8;
        const wx = clamp(th.rock ? th.pts[0].x + 40 : last.x, this.camX + half, this.camX + this.W - half);
        ctx.fillText(word, wx, (th.rock ? th.pts[0].y : last.y) - 18 - (age - total * 0.6) * 8);
        ctx.shadowBlur = 0;
      }
      return age < total + 2.4;
    });
    ctx.restore();
  }

  // 부드러운 붓터치 구름: 모양(흰 마스크)은 한 번만, 색은 바뀔 때만 다시 입힘
  cloudSprite(c, top, under) {
    if (!c.mask) {
      const m = makeCloudMask(c.kind || 'cumulus', c.k);
      c.mask = m;
      c.tints = new Map();
    }
    const q = (v) => v.map((x) => Math.round(x / 12) * 12).join(',');
    const key = q(top) + '|' + q(under);
    let img = c.tints.get(key);
    if (!img) {
      img = document.createElement('canvas');
      img.width = c.mask.width;
      img.height = c.mask.height;
      const g = img.getContext('2d');
      g.drawImage(c.mask, 0, 0);
      g.globalCompositeOperation = 'source-in';
      const vg = g.createLinearGradient(0, 0, 0, img.height * 0.75);
      vg.addColorStop(0, rgb(top));
      vg.addColorStop(0.55, rgb(mix(top, under, 0.5)));
      vg.addColorStop(1, rgb(under));
      g.fillStyle = vg;
      g.fillRect(0, 0, img.width, img.height);
      if (c.tints.size > 24) c.tints.clear();
      c.tints.set(key, img);
    }
    return img;
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
        ctx.font = `${Math.max(16, fx.slot.s * (fx.self ? 0.55 : 0.4))}px "Playwrite US Trad", "ShinYoungbok", "KotraHandwritingFont", "Nanum Brush Script", "Gowun Batang", serif`;
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
      if (fx.kind === 'bottle') {
        // 소원을 말아 넣은 유리병: 바다로 던지면 포물선 → 퐁당 → 물결 따라 해 쪽으로 멀어짐
        const dur = 18;
        const fly = 1.1;
        if (age > dur) return false;
        const sunWX = sun.x + this.camX;
        const landX = lerp(fx.x, clamp(sunWX, this.camX + this.W * 0.15, this.camX + this.W * 0.85), 0.25) + Math.sin(fx.seed * 7) * this.W * 0.08;
        const landY = lerp(this.shoreY, horizonY, 0.28);
        let x, y, s, tilt, inWater;
        if (age < fly) {
          const u = age / fly;
          x = lerp(fx.x, landX, u);
          y = lerp(fx.y, landY, u) - Math.sin(u * Math.PI) * fx.s * 2.2;
          s = fx.s * lerp(1.0, 0.75, u);
          tilt = age * 9 + fx.seed;
          inWater = false;
        } else {
          const t = (age - fly) / (dur - fly);
          const ease = 1 - (1 - t) ** 1.6;
          const tx = clamp(sun.x + this.camX, this.camX + this.W * 0.1, this.camX + this.W * 0.9);
          x = lerp(landX, lerp(landX, tx, 0.6), ease) + Math.sin(age * 0.9 + fx.seed) * 3;
          y = lerp(landY, horizonY + 4, ease) + Math.sin(age * 2.2 + fx.seed) * 1.2;
          s = fx.s * lerp(0.75, 0.1, ease);
          tilt = -1.15 + Math.sin(age * 1.8 + fx.seed) * 0.22;
          inWater = true;
          // 퐁당 물보라와 동심원
          const sa = age - fly;
          if (sa < 1.4) {
            const k = sa / 1.4;
            ctx.strokeStyle = `rgba(255,255,255,${0.55 * (1 - k)})`;
            ctx.lineWidth = 1.2;
            for (let r = 0; r < 2; r++) {
              ctx.beginPath();
              ctx.ellipse(landX, landY, fx.s * (0.3 + k * 1.2 + r * 0.35), fx.s * (0.08 + k * 0.3 + r * 0.09), 0, 0, Math.PI * 2);
              ctx.stroke();
            }
            if (sa < 0.5) {
              ctx.fillStyle = `rgba(255,255,255,${0.8 * (1 - sa / 0.5)})`;
              for (let d = 0; d < 7; d++) {
                const ang = Math.PI * (0.15 + 0.7 * (d / 6));
                const r = fx.s * 0.6 * (sa / 0.5);
                ctx.beginPath();
                ctx.arc(landX - Math.cos(ang) * r, landY - Math.sin(ang) * r * 1.4 + (sa / 0.5) ** 2 * fx.s * 0.5, Math.max(1, fx.s * 0.04), 0, Math.PI * 2);
                ctx.fill();
              }
            }
          }
        }
        const a = age < dur * 0.85 ? 1 : (dur - age) / (dur * 0.15);
        const bw = s * 0.36;
        const bh = s * 1.0;
        ctx.save();
        ctx.translate(x, y);
        if (inWater) {
          // 물에 반쯤 잠김: 수면 아래는 잘라내고 물결선만
          ctx.beginPath();
          ctx.rect(-s * 2, -s * 2, s * 4, s * 2 + s * 0.1);
          ctx.clip();
        }
        ctx.rotate(tilt);
        ctx.globalAlpha = a;
        // 병 몸통 (옅은 초록 유리)
        const gl = ctx.createLinearGradient(-bw, 0, bw, 0);
        gl.addColorStop(0, 'rgba(150,200,175,0.75)');
        gl.addColorStop(0.35, 'rgba(225,245,235,0.85)');
        gl.addColorStop(1, 'rgba(90,140,120,0.8)');
        ctx.fillStyle = gl;
        ctx.beginPath();
        ctx.moveTo(-bw, bh * 0.5);
        ctx.lineTo(-bw, -bh * 0.12);
        ctx.quadraticCurveTo(-bw, -bh * 0.3, -bw * 0.38, -bh * 0.36);
        ctx.lineTo(-bw * 0.38, -bh * 0.52);
        ctx.lineTo(bw * 0.38, -bh * 0.52);
        ctx.lineTo(bw * 0.38, -bh * 0.36);
        ctx.quadraticCurveTo(bw, -bh * 0.3, bw, -bh * 0.12);
        ctx.lineTo(bw, bh * 0.5);
        ctx.quadraticCurveTo(0, bh * 0.56, -bw, bh * 0.5);
        ctx.closePath();
        ctx.fill();
        // 안에 말아 넣은 편지 (리본)
        ctx.fillStyle = 'rgba(245,230,195,0.95)';
        ctx.fillRect(-bw * 0.45, -bh * 0.18, bw * 0.9, bh * 0.58);
        ctx.fillStyle = fx.self ? 'rgba(220,90,70,0.95)' : 'rgba(180,110,80,0.9)';
        ctx.fillRect(-bw * 0.45, bh * 0.08, bw * 0.9, Math.max(0.8, bh * 0.06));
        // 코르크
        ctx.fillStyle = 'rgba(165,115,70,1)';
        ctx.fillRect(-bw * 0.42, -bh * 0.62, bw * 0.84, bh * 0.13);
        // 유리 반짝임
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = Math.max(0.6, s * 0.05);
        ctx.beginPath();
        ctx.moveTo(-bw * 0.6, bh * 0.38);
        ctx.lineTo(-bw * 0.6, -bh * 0.1);
        ctx.stroke();
        ctx.restore();
        if (inWater) {
          ctx.strokeStyle = `rgba(255,255,255,${0.4 * a})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x - s * 0.75, y + s * 0.1);
          ctx.quadraticCurveTo(x, y + s * 0.02, x + s * 0.75, y + s * 0.1);
          ctx.stroke();
          // 해가 낮으면 병이 노을빛에 반짝
          if (sun.elevation < 8 && Math.sin(age * 3 + fx.seed) > 0.85) {
            ctx.fillStyle = `rgba(255,220,150,${0.8 * a})`;
            ctx.beginPath();
            ctx.arc(x - s * 0.15, y - s * 0.2, Math.max(1.2, s * 0.1), 0, Math.PI * 2);
            ctx.fill();
          }
        }
        if (fx.text) this.wishLabel(ctx, fx.text, x, y - Math.max(12, s * 1.4), a, fx.self);
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
