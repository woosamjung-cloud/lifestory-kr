// 바다의 작은 이벤트: 가끔 지나가는 배와 튀어 오르는 바다 친구들
// - 배: 크루즈선·요트·고깃배(밤엔 집어등)·수상스키. 거리(수평선 쪽은 작고 느리게), 날씨(비·강풍이면
//   작은 배는 안 나옴), 낮·밤(밤엔 불빛만)에 따라 고름
// - 바다 친구: 돌고래 무리, 참치 한 마리, 작은 물고기 떼가 한 번씩 튀어 오름 (낮·해 질 녘에만)
// 불멍을 방해하지 않도록 드물게, 천천히, 작게.

const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

export class SeaLife {
  constructor() {
    this.ships = [];
    this.jumps = [];
    this.splashes = [];
    // 처음 들어와서 조금 지나면 첫 배 (너무 바로 나오지 않게)
    this.nextShip = performance.now() + rand(20000, 45000);
    this.nextJump = performance.now() + rand(30000, 60000);
  }

  // 지금 나올 수 있는 배 종류 (날씨·밤낮·장소)
  shipKinds(env) {
    const { night, rain, wind, place } = env;
    const calm = !rain && wind < 9;
    const out = [];
    out.push(['cruise', 2]);
    out.push(['fishing', night ? 4 : 2]);
    if (!night && calm) out.push(['yacht', 2.5]);
    if (!night && calm && !env.dim && place === 'east') out.push(['ski', 1.2]);
    if (!night && calm && place === 'west') out.push(['ski', 0.6]);
    return out;
  }

  spawnShip(now, env) {
    const kinds = this.shipKinds(env);
    let total = kinds.reduce((s, k) => s + k[1], 0);
    let r = Math.random() * total;
    let kind = kinds[0][0];
    for (const [k, w] of kinds) {
      if ((r -= w) <= 0) {
        kind = k;
        break;
      }
    }
    // 거리: 0 수평선 ~ 1 해변. 큰 배는 멀리, 수상스키는 가까이
    // 알아볼 수 있는 크기로만: 너무 먼 수평선 끝에는 띄우지 않음 (밤 고깃배는 불빛이라 멀어도 알아봄)
    const depth = { cruise: rand(0.07, 0.14), fishing: env.night ? rand(0.06, 0.3) : rand(0.2, 0.4), yacht: rand(0.25, 0.45), ski: rand(0.4, 0.6) }[kind];
    const dir = Math.random() < 0.5 ? 1 : -1;
    // 화면을 건너는 데 걸리는 시간: 멀수록 느려 보임 (불멍처럼 천천히)
    const cross = { cruise: rand(150, 220), fishing: rand(90, 150), yacht: rand(110, 170), ski: rand(28, 40) }[kind] * 1000;
    this.ships.push({ kind, depth, dir, start: now, cross, seed: Math.random() * 1000, lights: 6 + Math.floor(Math.random() * 6) });
    // 밤바다 고깃배는 몇 척이 줄지어 (동해 오징어잡이 불빛)
    if (kind === 'fishing' && env.night && Math.random() < 0.7) {
      for (let k = 1; k <= 2 + Math.floor(Math.random() * 3); k++) this.ships.push({ kind, depth: clamp(depth + rand(-0.02, 0.03), 0.04, 0.3), dir, start: now - k * rand(6000, 14000), cross, seed: Math.random() * 1000, lights: 6 + Math.floor(Math.random() * 6) });
    }
  }

  spawnJump(now, env) {
    const kind = pick(env.place === 'east' ? ['dolphin', 'dolphin', 'tuna', 'fish', 'fish'] : ['fish', 'fish', 'dolphin', 'tuna']);
    const depth = rand(0.32, 0.72);
    const x = rand(0.15, 0.85);
    const dir = Math.random() < 0.5 ? 1 : -1;
    const n = kind === 'dolphin' ? 2 + Math.floor(Math.random() * 2) : kind === 'fish' ? 6 + Math.floor(Math.random() * 5) : 1;
    for (let i = 0; i < n; i++) {
      const gap = kind === 'dolphin' ? 650 : kind === 'fish' ? 140 : 0;
      this.jumps.push({
        kind,
        depth: depth + (kind === 'fish' ? rand(-0.03, 0.03) : 0),
        x: x + (kind === 'fish' ? rand(-0.05, 0.05) : i * 0.035 * dir),
        dir,
        start: now + i * gap + (kind === 'fish' ? Math.random() * 300 : 0),
        dur: kind === 'dolphin' ? 1300 : kind === 'tuna' ? 1100 : 520,
        reach: kind === 'dolphin' ? 0.05 : kind === 'tuna' ? 0.035 : 0.012,
        splashed: [false, false],
      });
    }
  }

  // env: { W, horizonY, shoreY, now, light(0밤~1낮), e(해 높이), wx, place, shift }
  draw(ctx, env) {
    const now = env.now;
    const wx = env.wx || {};
    env.night = env.light < 0.3;
    env.dim = env.light < 0.55;
    env.rain = (wx.pty || 0) > 0;
    env.wind = wx.wind || 0;
    if (now > this.nextShip) {
      if (this.ships.length < 6) this.spawnShip(now, env);
      // 다음 배까지 1~3분 (흐리고 비 오면 더 드물게)
      this.nextShip = now + rand(60000, 180000) * (env.rain ? 1.8 : 1);
    }
    if (now > this.nextJump) {
      if (!env.night && !(env.rain && env.wind > 8)) this.spawnJump(now, env);
      this.nextJump = now + rand(45000, 120000);
    }
    const { W, horizonY, shoreY } = env;
    const yOf = (d) => horizonY + d * d * (shoreY - horizonY) * 1.0 + 1;
    const unit = (shoreY - horizonY) / 120; // 화면 크기에 맞춘 단위
    // 먼 것부터
    this.ships.sort((a, b) => a.depth - b.depth);
    this.ships = this.ships.filter((s) => {
      const u = (now - s.start) / s.cross;
      if (u > 1) return false;
      if (u < 0) return true;
      const x = s.dir > 0 ? -0.15 * W + u * 1.3 * W : 1.15 * W - u * 1.3 * W;
      const y = yOf(s.depth);
      const sc = unit * Math.max(s.kind === 'cruise' ? 0.9 : 1.4, 0.5 + s.depth * 3.4);
      // 화면 끝에서 서서히 나타나고 사라짐
      const fade = clamp(u / 0.06) * clamp((1 - u) / 0.06);
      ctx.save();
      ctx.globalAlpha = fade * (env.rain ? 0.7 : 1);
      ctx.translate(x - (env.shift || 0) * (0.4 + s.depth), y);
      if (s.dir < 0) ctx.scale(-1, 1);
      this.drawShip(ctx, s, sc, env, now);
      ctx.restore();
      return true;
    });
    // 튀어 오르는 바다 친구
    this.jumps = this.jumps.filter((j) => {
      const u = (now - j.start) / j.dur;
      if (u > 1) return false;
      if (u < 0) return true;
      const y0 = yOf(j.depth);
      const sc = unit * (0.6 + j.depth * 3);
      const x0 = j.x * W - (env.shift || 0) * (0.4 + j.depth);
      const span = j.reach * W * (0.6 + j.depth);
      const x = x0 + (u - 0.5) * span * j.dir;
      const h = Math.sin(u * Math.PI) * sc * (j.kind === 'dolphin' ? 9 : j.kind === 'tuna' ? 7 : 3.2);
      const ang = Math.atan2(-Math.cos(u * Math.PI) * h * 2.4, span) * j.dir;
      // 물에서 나올 때와 들어갈 때 물보라
      if (u > 0.04 && !j.splashed[0]) {
        j.splashed[0] = true;
        this.splash(x0 - span * 0.5 * j.dir, y0, sc, now, j.kind);
      }
      if (u > 0.94 && !j.splashed[1]) {
        j.splashed[1] = true;
        this.splash(x0 + span * 0.5 * j.dir, y0, sc, now, j.kind);
      }
      ctx.save();
      ctx.translate(x, y0 - h);
      ctx.rotate(ang);
      if (j.dir < 0) ctx.scale(-1, 1);
      // 물속에 잠긴 부분은 안 보이게 (수면 아래 자르기)
      ctx.globalAlpha = clamp(Math.sin(u * Math.PI) * 3) * (0.55 + 0.45 * env.light);
      this.drawFish(ctx, j.kind, sc, env);
      ctx.restore();
      return true;
    });
    // 물보라
    this.splashes = this.splashes.filter((p) => {
      const u = (now - p.start) / p.dur;
      if (u > 1) return false;
      ctx.save();
      ctx.globalAlpha = (1 - u) * (0.45 + 0.4 * env.light);
      ctx.fillStyle = '#f4fbff';
      for (const d of p.drops) {
        const dx = d.vx * u * p.sc * 6;
        const dy = -d.vy * p.sc * 6 * u + 9 * p.sc * u * u;
        ctx.beginPath();
        ctx.arc(p.x + dx, p.y + dy, Math.max(0.6, d.r * p.sc * (1 - u * 0.5)), 0, TAU);
        ctx.fill();
      }
      // 퍼지는 물결
      ctx.strokeStyle = '#eaf6ff';
      ctx.lineWidth = Math.max(0.6, p.sc * 0.4);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 0.5, p.sc * (2 + u * 7), p.sc * (0.5 + u * 1.4), 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
      return true;
    });
  }

  splash(x, y, sc, now, kind) {
    const n = kind === 'fish' ? 3 : 9;
    const drops = Array.from({ length: n }, () => ({ vx: rand(-1, 1), vy: rand(0.6, 1.6), r: rand(0.25, 0.6) }));
    this.splashes.push({ x, y, sc: sc * (kind === 'fish' ? 0.5 : 1), start: now, dur: kind === 'fish' ? 500 : 900, drops });
  }

  // ---------- 배 그림 (오른쪽을 향함, 수면이 y=0) ----------
  drawShip(ctx, s, k, env, now) {
    const night = env.night;
    const bob = Math.sin(now / 900 + s.seed) * k * 0.15;
    ctx.translate(0, bob);
    const hull = night ? '#14161f' : '#2d3344';
    const white = night ? '#262a36' : '#f4f2ee';
    const lamp = (x, y, r, col = 'rgba(255,226,150,0.95)') => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    };
    if (s.kind === 'cruise') {
      // 큰 유람선: 길고 하얀 층층 선체
      ctx.fillStyle = hull;
      ctx.beginPath();
      ctx.moveTo(-14 * k, -1.5 * k);
      ctx.lineTo(13 * k, -1.5 * k);
      ctx.lineTo(16 * k, -3.2 * k);
      ctx.lineTo(-15 * k, -3.2 * k);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = white;
      ctx.fillRect(-13 * k, -5.2 * k, 25 * k, 2 * k);
      ctx.fillRect(-11 * k, -6.8 * k, 20 * k, 1.7 * k);
      ctx.fillRect(-7 * k, -8.2 * k, 12 * k, 1.5 * k);
      ctx.fillStyle = night ? '#1b1e28' : '#c8453e';
      ctx.fillRect(1 * k, -10 * k, 2.2 * k, 1.9 * k); // 굴뚝
      if (night) {
        for (let i = 0; i < 18; i++) lamp(-12 * k + i * 1.4 * k, -4.2 * k, Math.max(0.5, k * 0.28));
        for (let i = 0; i < 13; i++) lamp(-10 * k + i * 1.45 * k, -5.9 * k, Math.max(0.5, k * 0.26), 'rgba(255,240,200,0.85)');
        lamp(15 * k, -3.5 * k, Math.max(0.6, k * 0.3), 'rgba(120,255,160,0.9)');
      } else {
        ctx.fillStyle = 'rgba(60,80,110,0.55)';
        for (let i = 0; i < 16; i++) ctx.fillRect(-12 * k + i * 1.5 * k, -4.5 * k, 0.7 * k, 0.6 * k);
      }
    } else if (s.kind === 'fishing') {
      // 고깃배: 작은 선체 + 조타실 + 돛대. 밤엔 줄줄이 켠 집어등이 바다를 환하게
      ctx.fillStyle = night ? hull : '#3c5a7a';
      ctx.beginPath();
      ctx.moveTo(-5 * k, -0.8 * k);
      ctx.lineTo(4 * k, -0.8 * k);
      ctx.lineTo(6 * k, -2.6 * k);
      ctx.lineTo(-5.5 * k, -2.4 * k);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = night ? '#20232d' : '#f1ede6';
      ctx.fillRect(-1 * k, -4.6 * k, 3 * k, 2.1 * k);
      ctx.strokeStyle = night ? '#2a2d38' : '#4a4a52';
      ctx.lineWidth = Math.max(0.6, k * 0.2);
      ctx.beginPath();
      ctx.moveTo(-3 * k, -2.4 * k);
      ctx.lineTo(-3 * k, -7 * k);
      ctx.lineTo(4.5 * k, -2.6 * k);
      ctx.stroke();
      if (night) {
        const g = ctx.createRadialGradient(0, -4 * k, 0, 0, -4 * k, 14 * k);
        g.addColorStop(0, 'rgba(255,250,215,0.45)');
        g.addColorStop(1, 'rgba(255,250,215,0)');
        ctx.fillStyle = g;
        ctx.fillRect(-14 * k, -18 * k, 28 * k, 22 * k);
        for (let i = 0; i < s.lights; i++) lamp(-4.5 * k + (i * 8.5 * k) / s.lights, -5.5 * k + Math.sin(i) * 0.3 * k, Math.max(0.7, k * 0.42), 'rgba(255,253,230,1)');
        // 물에 비친 불빛
        ctx.fillStyle = 'rgba(255,245,200,0.18)';
        ctx.fillRect(-5 * k, 0, 10 * k, 3 * k);
      }
    } else if (s.kind === 'yacht') {
      // 요트: 하얀 선체에 삼각 돛 두 장
      ctx.fillStyle = white;
      ctx.beginPath();
      ctx.moveTo(-4.5 * k, -0.6 * k);
      ctx.lineTo(4 * k, -0.6 * k);
      ctx.lineTo(5.5 * k, -1.9 * k);
      ctx.lineTo(-5 * k, -1.9 * k);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#6b6b70';
      ctx.lineWidth = Math.max(0.5, k * 0.15);
      ctx.beginPath();
      ctx.moveTo(0, -1.9 * k);
      ctx.lineTo(0, -11 * k);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      ctx.moveTo(0.3 * k, -10.6 * k);
      ctx.lineTo(4.2 * k, -2.4 * k);
      ctx.lineTo(0.3 * k, -2.4 * k);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(240,138,93,0.9)';
      ctx.beginPath();
      ctx.moveTo(-0.3 * k, -9 * k);
      ctx.lineTo(-0.3 * k, -2.4 * k);
      ctx.lineTo(-3.6 * k, -2.4 * k);
      ctx.closePath();
      ctx.fill();
    } else if (s.kind === 'ski') {
      // 수상스키: 빠른 모터보트 + 하얀 물보라 꼬리 + 줄에 매달린 사람
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      for (let i = 0; i < 6; i++) {
        const wx2 = -3 * k - i * 2.4 * k;
        ctx.beginPath();
        ctx.ellipse(wx2, -0.2 * k, 1.6 * k + i * 0.3 * k, 0.45 * k, 0, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#e9e5de';
      ctx.beginPath();
      ctx.moveTo(-3 * k, -0.5 * k);
      ctx.lineTo(2.5 * k, -0.5 * k);
      ctx.lineTo(4 * k, -1.7 * k);
      ctx.lineTo(-3 * k, -1.7 * k);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#c8453e';
      ctx.fillRect(-2.6 * k, -1.3 * k, 5 * k, 0.35 * k);
      ctx.fillStyle = '#2b2b33';
      ctx.fillRect(-1 * k, -2.6 * k, 1.2 * k, 1 * k);
      // 줄과 스키 타는 사람
      const sx = -15 * k;
      const lean = Math.sin(now / 400 + s.seed) * 0.6 * k;
      ctx.strokeStyle = 'rgba(60,60,70,0.7)';
      ctx.lineWidth = Math.max(0.4, k * 0.1);
      ctx.beginPath();
      ctx.moveTo(-2.8 * k, -1.8 * k);
      ctx.lineTo(sx + 1 * k, -2.6 * k);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.ellipse(sx - 1.5 * k, -0.2 * k, 3 * k, 0.5 * k, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#2b2b33';
      ctx.lineWidth = Math.max(0.6, k * 0.35);
      ctx.beginPath();
      ctx.moveTo(sx, -0.4 * k);
      ctx.lineTo(sx + lean * 0.3, -2.4 * k);
      ctx.lineTo(sx + 0.8 * k, -2.6 * k);
      ctx.stroke();
      ctx.fillStyle = '#f08a5d';
      ctx.beginPath();
      ctx.arc(sx + lean * 0.3, -3.1 * k, 0.55 * k, 0, TAU);
      ctx.fill();
    }
  }

  // ---------- 바다 친구 그림 (오른쪽을 향함, 몸 가운데가 0,0) ----------
  drawFish(ctx, kind, k, env) {
    if (kind === 'dolphin') {
      ctx.fillStyle = env.dim ? '#5b6676' : '#7d8ea3';
      ctx.beginPath();
      ctx.moveTo(-5 * k, 0);
      ctx.quadraticCurveTo(-1 * k, -2.2 * k, 4 * k, -0.4 * k);
      ctx.lineTo(5.6 * k, -0.2 * k); // 주둥이
      ctx.lineTo(4 * k, 0.4 * k);
      ctx.quadraticCurveTo(-1 * k, 1.5 * k, -5 * k, 0.3 * k);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath(); // 등지느러미
      ctx.moveTo(-0.5 * k, -1.4 * k);
      ctx.lineTo(-1.8 * k, -3 * k);
      ctx.lineTo(-2 * k, -1.2 * k);
      ctx.fill();
      ctx.beginPath(); // 꼬리
      ctx.moveTo(-4.8 * k, 0.1 * k);
      ctx.lineTo(-6.6 * k, -1.2 * k);
      ctx.lineTo(-6 * k, 0.2 * k);
      ctx.lineTo(-6.6 * k, 1.4 * k);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(235,240,245,0.75)'; // 밝은 배
      ctx.beginPath();
      ctx.ellipse(1 * k, 0.5 * k, 3 * k, 0.45 * k, -0.05, 0, TAU);
      ctx.fill();
    } else if (kind === 'tuna') {
      const g = ctx.createLinearGradient(0, -1.6 * k, 0, 1.4 * k);
      g.addColorStop(0, '#2c3f66');
      g.addColorStop(0.5, '#8aa0bd');
      g.addColorStop(1, '#e6ecf2');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(4.5 * k, 0);
      ctx.quadraticCurveTo(1 * k, -2 * k, -3.5 * k, -0.3 * k);
      ctx.lineTo(-3.5 * k, 0.3 * k);
      ctx.quadraticCurveTo(1 * k, 1.8 * k, 4.5 * k, 0);
      ctx.fill();
      ctx.fillStyle = '#2c3f66';
      ctx.beginPath(); // 초승달 꼬리
      ctx.moveTo(-3.4 * k, 0);
      ctx.lineTo(-5.2 * k, -1.8 * k);
      ctx.quadraticCurveTo(-4.6 * k, 0, -5.2 * k, 1.8 * k);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#f4c542'; // 작은 노란 토막지느러미
      for (let i = 0; i < 4; i++) ctx.fillRect(-1 * k - i * 0.6 * k, -0.95 * k + i * 0.12 * k, 0.3 * k, 0.3 * k);
    } else {
      // 작은 물고기: 반짝이는 은빛 한 점
      ctx.fillStyle = '#e9f1f7';
      ctx.beginPath();
      ctx.ellipse(0, 0, 1.4 * k, 0.45 * k, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-1.2 * k, 0);
      ctx.lineTo(-2.1 * k, -0.6 * k);
      ctx.lineTo(-2.1 * k, 0.6 * k);
      ctx.closePath();
      ctx.fill();
    }
  }
}
