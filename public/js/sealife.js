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
    const depth = { cruise: rand(0.07, 0.14), fishing: env.night ? rand(0.06, 0.3) : rand(0.2, 0.4), yacht: rand(0.5, 0.64), ski: rand(0.4, 0.6) }[kind];
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
      if (s.kind === 'cruise' && !s.horned && u > 0.3) {
        s.horned = true;
        if (Math.random() < 0.75 && this.onHorn) this.onHorn(s.depth);
      }
      const x = s.dir > 0 ? -0.15 * W + u * 1.3 * W : 1.15 * W - u * 1.3 * W;
      const y = yOf(s.depth);
      const sc = unit * Math.max(s.kind === 'cruise' ? 1.15 : 1.8, 0.7 + s.depth * 4);
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
    // 뒤쪽 물살(항적): 배가 지나간 자리에 하얀 물결이 길게 남았다 흩어짐 (흔들림과 상관없이 수면에)
    this.drawWake(ctx, s, k, env, now);
    ctx.translate(0, bob);
    // 작은 배일수록 앞뒤로 더 까딱 (파도를 타는 느낌)
    const pitch = Math.sin(now / 1300 + s.seed * 2) * (s.kind === 'cruise' ? 0.006 : s.kind === 'yacht' ? 0 : s.kind === 'ski' ? 0.03 : 0.045);
    ctx.rotate(pitch);
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
      this.drawPuffs(ctx, s, 2.1 * k, -10.2 * k, k, now, night ? 0.12 : 0.35, 'cruise');
      this.drawChurn(ctx, s, -14.5 * k, -1.5 * k, k, now, night ? 0.2 : 0.6);
      if (night) {
        for (let i = 0; i < 18; i++) lamp(-12 * k + i * 1.4 * k, -4.2 * k, Math.max(0.5, k * 0.28));
        for (let i = 0; i < 13; i++) lamp(-10 * k + i * 1.45 * k, -5.9 * k, Math.max(0.5, k * 0.26), 'rgba(255,240,200,0.85)');
        lamp(15 * k, -3.5 * k, Math.max(0.6, k * 0.3), 'rgba(120,255,160,0.9)');
      } else {
        ctx.fillStyle = 'rgba(60,80,110,0.55)';
        for (let i = 0; i < 16; i++) ctx.fillRect(-12 * k + i * 1.5 * k, -4.5 * k, 0.7 * k, 0.6 * k);
      }
    } else if (s.kind === 'fishing') {
      // 고깃배: 뱃머리가 높은 통통배 + 창 달린 조타실 + 짧은 깃대(깃발) + 줄줄이 달린 집어등 (세모 줄 없음)
      // 선체: 앞(오른쪽)이 위로 들린 모양, 흰 띠
      ctx.fillStyle = night ? hull : '#2f6aa3';
      ctx.beginPath();
      ctx.moveTo(-6 * k, -2.2 * k);
      ctx.lineTo(5.2 * k, -2.2 * k);
      ctx.quadraticCurveTo(6.6 * k, -2.6 * k, 7.2 * k, -3.6 * k); // 들린 뱃머리
      ctx.lineTo(5.6 * k, -0.4 * k);
      ctx.lineTo(-5.2 * k, -0.4 * k);
      ctx.closePath();
      ctx.fill();
      if (!night) {
        ctx.fillStyle = '#f4f1ea';
        ctx.fillRect(-5.6 * k, -1.85 * k, 11.2 * k, 0.45 * k);
        ctx.fillStyle = '#c8453e';
        ctx.fillRect(-5.2 * k, -0.9 * k, 10.6 * k, 0.4 * k); // 아래 빨간 칠
      }
      // 조타실 (네모 + 지붕 + 창 두 개)
      ctx.fillStyle = night ? '#20232d' : '#f4f1ea';
      ctx.fillRect(-2.6 * k, -5 * k, 3.6 * k, 2.8 * k);
      ctx.fillStyle = night ? '#2a2d38' : '#2f6aa3';
      ctx.fillRect(-2.9 * k, -5.4 * k, 4.2 * k, 0.5 * k);
      ctx.fillStyle = night ? 'rgba(255,230,160,0.9)' : '#7fa9cc';
      ctx.fillRect(-2.1 * k, -4.4 * k, 1.1 * k, 0.9 * k);
      ctx.fillRect(-0.5 * k, -4.4 * k, 1.1 * k, 0.9 * k);
      // 조타실 뒤 굴뚝 + '통통' 연기 (두 번 퐁퐁, 잠깐 쉼)
      ctx.fillStyle = night ? '#1b1d26' : '#3a3d47';
      ctx.fillRect(-3.6 * k, -6.4 * k, 0.9 * k, 1.6 * k);
      this.drawPuffs(ctx, s, -3.15 * k, -6.5 * k, k, now, night ? 0.18 : 0.5, 'fish');
      // 뒤(프로펠러) 물보라: 하얀 물방울이 퐁퐁 튀어오름
      this.drawChurn(ctx, s, -5.6 * k, -0.4 * k, k, now, night ? 0.25 : 0.85);
      // 짧은 깃대와 작은 깃발
      ctx.strokeStyle = night ? '#2a2d38' : '#55575f';
      ctx.lineWidth = Math.max(0.6, k * 0.18);
      ctx.beginPath();
      ctx.moveTo(-0.6 * k, -5.4 * k);
      ctx.lineTo(-0.6 * k, -7.6 * k);
      ctx.stroke();
      ctx.fillStyle = night ? '#3a2b2b' : '#e46f86';
      ctx.beginPath();
      ctx.moveTo(-0.6 * k, -7.6 * k);
      ctx.lineTo(0.9 * k, -7.2 * k);
      ctx.lineTo(-0.6 * k, -6.8 * k);
      ctx.closePath();
      ctx.fill();
      // 뱃전 위 집어등 줄 (낮엔 꺼진 전구)
      ctx.strokeStyle = night ? '#2a2d38' : '#6b6b70';
      ctx.lineWidth = Math.max(0.4, k * 0.1);
      ctx.beginPath();
      ctx.moveTo(-5.4 * k, -3.2 * k);
      ctx.lineTo(4.8 * k, -3.2 * k);
      ctx.stroke();
      if (!night) for (let i = 0; i < 6; i++) lamp(-5 * k + i * 1.9 * k, -3.2 * k, Math.max(0.5, k * 0.25), '#e8e2d6');
      if (night) {
        const g = ctx.createRadialGradient(0, -4 * k, 0, 0, -4 * k, 14 * k);
        g.addColorStop(0, 'rgba(255,250,215,0.45)');
        g.addColorStop(1, 'rgba(255,250,215,0)');
        ctx.fillStyle = g;
        ctx.fillRect(-14 * k, -18 * k, 28 * k, 22 * k);
        for (let i = 0; i < s.lights; i++) lamp(-5 * k + (i * 9.8 * k) / s.lights, -3.2 * k, Math.max(0.7, k * 0.42), 'rgba(255,253,230,1)');
        // 물에 비친 불빛
        ctx.fillStyle = 'rgba(255,245,200,0.18)';
        ctx.fillRect(-5 * k, 0, 10 * k, 3 * k);
      }
    } else if (s.kind === 'yacht') {
      // 고급 세일링 요트: 날렵한 흰 선체(남색 띠·티크 갑판), 낮은 선실 창, 높은 돛대와 붐,
      // 살대가 든 큰 주돛 + 둥글게 부푼 앞돛, 가는 줄(지삭), 돛대 꼭대기 깃발. 수평 유지(기울지 않음)
      const luff = Math.sin(now / 900 + s.seed) * 0.25 * k; // 돛이 바람에 살짝 숨 쉬듯 부풂
      const mastX = -0.6 * k;
      const mastTop = -19 * k;
      const deckY = -1.7 * k;
      // 물에 비친 그림자
      ctx.fillStyle = night ? 'rgba(0,0,0,0.18)' : 'rgba(20,40,70,0.18)';
      ctx.beginPath();
      ctx.ellipse(0, 0.5 * k, 8 * k, 0.6 * k, 0, 0, TAU);
      ctx.fill();
      // 선체: 앞(오른쪽)이 뾰족하고 길게 뻗은 모양, 뒤는 살짝 들린 트랜섬
      const hullPath = () => {
        ctx.beginPath();
        ctx.moveTo(-7.4 * k, deckY);
        ctx.lineTo(7.6 * k, deckY);
        ctx.quadraticCurveTo(9.4 * k, deckY - 0.1 * k, 9.9 * k, deckY - 0.6 * k); // 뱃머리
        ctx.quadraticCurveTo(7.8 * k, 0.2 * k, 5 * k, 0.3 * k);
        ctx.lineTo(-6.2 * k, 0.3 * k);
        ctx.quadraticCurveTo(-7.3 * k, 0.1 * k, -7.6 * k, deckY + 0.1 * k); // 트랜섬
        ctx.closePath();
      };
      const hg = ctx.createLinearGradient(0, deckY, 0, 0.3 * k);
      hg.addColorStop(0, night ? '#2b2f3a' : '#ffffff');
      hg.addColorStop(1, night ? '#1d2029' : '#dfe4ea');
      ctx.fillStyle = hg;
      hullPath();
      ctx.fill();
      ctx.save();
      hullPath();
      ctx.clip();
      ctx.fillStyle = night ? '#141824' : '#1f3a63'; // 남색 띠
      ctx.fillRect(-9 * k, -0.6 * k, 20 * k, 0.5 * k);
      ctx.fillStyle = night ? '#3a2a20' : '#c8453e'; // 물 닿는 곳 빨간 칠
      ctx.fillRect(-9 * k, 0, 20 * k, 0.5 * k);
      ctx.restore();
      ctx.strokeStyle = night ? 'rgba(255,255,255,0.08)' : 'rgba(40,50,70,0.35)';
      ctx.lineWidth = Math.max(0.5, k * 0.08);
      hullPath();
      ctx.stroke();
      // 티크 갑판 줄과 난간
      ctx.fillStyle = night ? '#3a2f26' : '#b7865a';
      ctx.fillRect(-7.2 * k, deckY - 0.22 * k, 14.6 * k, 0.24 * k);
      ctx.strokeStyle = night ? 'rgba(200,200,210,0.25)' : 'rgba(150,155,165,0.9)';
      ctx.lineWidth = Math.max(0.4, k * 0.06);
      ctx.beginPath();
      ctx.moveTo(-7 * k, deckY - 0.9 * k);
      ctx.lineTo(7.4 * k, deckY - 0.9 * k);
      for (let x = -6.6; x <= 7; x += 1.6) {
        ctx.moveTo(x * k, deckY - 0.9 * k);
        ctx.lineTo(x * k, deckY - 0.2 * k);
      }
      ctx.stroke();
      // 낮은 선실 + 길쭉한 창
      ctx.fillStyle = night ? '#262a35' : '#f6f7f8';
      ctx.beginPath();
      ctx.moveTo(-4.4 * k, deckY - 0.2 * k);
      ctx.lineTo(-3.8 * k, deckY - 1.5 * k);
      ctx.lineTo(2.6 * k, deckY - 1.5 * k);
      ctx.lineTo(3.8 * k, deckY - 0.2 * k);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = night ? 'rgba(255,220,150,0.85)' : '#24334d';
      ctx.beginPath();
      ctx.moveTo(-3.4 * k, deckY - 0.75 * k);
      ctx.lineTo(-3.1 * k, deckY - 1.15 * k);
      ctx.lineTo(2.2 * k, deckY - 1.15 * k);
      ctx.lineTo(2.9 * k, deckY - 0.75 * k);
      ctx.closePath();
      ctx.fill();
      // 돛대와 붐
      ctx.strokeStyle = night ? '#6b6f7a' : '#8c9099';
      ctx.lineWidth = Math.max(0.6, k * 0.16);
      ctx.beginPath();
      ctx.moveTo(mastX, deckY - 1.5 * k);
      ctx.lineTo(mastX, mastTop);
      ctx.stroke();
      ctx.lineWidth = Math.max(0.5, k * 0.13);
      ctx.beginPath();
      ctx.moveTo(mastX, deckY - 2.6 * k);
      ctx.lineTo(-7 * k, deckY - 2.3 * k);
      ctx.stroke();
      // 주돛: 살짝 부푼 곡선 + 살대 + 위에서 아래로 그늘
      {
        const sg = ctx.createLinearGradient(mastX, 0, -7 * k, 0);
        sg.addColorStop(0, night ? 'rgba(200,205,215,0.55)' : '#ffffff');
        sg.addColorStop(1, night ? 'rgba(160,165,180,0.45)' : '#e6e9ee');
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.moveTo(mastX - 0.1 * k, mastTop + 0.6 * k);
        ctx.quadraticCurveTo(-5.2 * k - luff, -10 * k, -6.8 * k, deckY - 2.6 * k);
        ctx.lineTo(mastX - 0.1 * k, deckY - 2.8 * k);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = night ? 'rgba(255,255,255,0.15)' : 'rgba(150,160,175,0.6)';
        ctx.lineWidth = Math.max(0.4, k * 0.06);
        for (let b = 1; b <= 4; b++) {
          const yb = mastTop + (deckY - 2.8 * k - mastTop) * (b / 5);
          const span = (b / 5) * 5.6 * k;
          ctx.beginPath();
          ctx.moveTo(mastX - 0.2 * k, yb);
          ctx.lineTo(mastX - span, yb + 0.25 * k);
          ctx.stroke();
        }
        // 앞돛(지브): 둥글게 부푼 삼각, 살짝 주황빛 줄
        ctx.fillStyle = night ? 'rgba(190,195,205,0.5)' : '#fbfbfc';
        ctx.beginPath();
        ctx.moveTo(mastX + 0.25 * k, mastTop + 2.4 * k);
        ctx.quadraticCurveTo(5.4 * k + luff, -8 * k, 8.6 * k, deckY - 0.5 * k);
        ctx.lineTo(mastX + 0.3 * k, deckY - 1.6 * k);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = night ? 'rgba(255,170,120,0.3)' : '#f08a5d';
        ctx.lineWidth = Math.max(0.5, k * 0.12);
        ctx.beginPath();
        ctx.moveTo(mastX + 0.3 * k, deckY - 1.6 * k);
        ctx.lineTo(8.6 * k, deckY - 0.5 * k);
        ctx.stroke();
      }
      // 줄(앞지삭·뒷지삭)
      ctx.strokeStyle = night ? 'rgba(200,200,210,0.2)' : 'rgba(110,115,125,0.7)';
      ctx.lineWidth = Math.max(0.35, k * 0.05);
      ctx.beginPath();
      ctx.moveTo(mastX, mastTop);
      ctx.lineTo(9.6 * k, deckY - 0.5 * k);
      ctx.moveTo(mastX, mastTop);
      ctx.lineTo(-7.3 * k, deckY - 0.1 * k);
      ctx.stroke();
      // 돛대 꼭대기 깃발 (바람에 펄럭)
      const fl = Math.sin(now / 260 + s.seed) * 0.25 * k;
      ctx.fillStyle = night ? 'rgba(200,80,80,0.5)' : '#c8453e';
      ctx.beginPath();
      ctx.moveTo(mastX, mastTop);
      ctx.quadraticCurveTo(mastX - 1 * k, mastTop + 0.2 * k + fl, mastX - 2 * k, mastTop + 0.35 * k);
      ctx.lineTo(mastX, mastTop + 0.8 * k);
      ctx.closePath();
      ctx.fill();
      if (night) {
        lamp(mastX, mastTop - 0.2 * k, Math.max(0.6, k * 0.25), 'rgba(255,255,255,0.95)'); // 돛대 등
        lamp(9.2 * k, deckY - 0.4 * k, Math.max(0.5, k * 0.2), 'rgba(120,255,160,0.9)');
      }
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

  // 연기: 굴뚝에서 몽글몽글 올라가 뒤로 흘러가며 옅어짐. 고깃배는 '통통' 박자(두 번 퐁퐁, 잠깐 쉼)
  drawPuffs(ctx, s, x, y, k, now, alpha, kind) {
    const gap = kind === 'fish' ? 1300 : 900;
    const life = kind === 'fish' ? 2600 : 4200;
    const phase = s.seed * 97;
    for (let i = 0; i < 6; i++) {
      // 고깃배: 한 박자에 두 번 (0ms, 260ms)
      const base = Math.floor((now + phase) / gap) - Math.floor(i / 2);
      const born = base * gap - phase + (kind === 'fish' && i % 2 ? 260 : 0);
      const a = (now - born) / life;
      if (a < 0 || a > 1) continue;
      const px = x - a * k * (kind === 'fish' ? 5 : 7); // 배가 앞으로 가니 연기는 뒤로
      const py = y - a * k * (kind === 'fish' ? 4.5 : 5);
      const r = k * (kind === 'fish' ? 0.5 + a * 1.4 : 0.7 + a * 2.2);
      ctx.fillStyle = `rgba(${kind === 'fish' ? '90,90,96' : '210,210,215'},${(alpha * (1 - a) * (a < 0.1 ? a / 0.1 : 1)).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, TAU);
      ctx.fill();
    }
  }

  // 프로펠러 물보라: 뒤꽁무니에서 하얀 물방울이 퐁퐁 튀어 오름
  drawChurn(ctx, s, x, y, k, now, alpha) {
    for (let i = 0; i < 7; i++) {
      const per = 520 + i * 37;
      const a = ((now + s.seed * 50 + i * 131) % per) / per;
      const px = x - a * k * 2.2 - (i % 3) * 0.4 * k;
      const py = y - Math.sin(a * Math.PI) * k * (0.8 + (i % 3) * 0.35);
      ctx.fillStyle = `rgba(255,255,255,${(alpha * (1 - a)).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(px, py, Math.max(0.5, k * (0.32 - a * 0.15)), 0, TAU);
      ctx.fill();
    }
    // 하얗게 부서지는 물
    ctx.fillStyle = `rgba(255,255,255,${(alpha * 0.55).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(x - k * 0.8, y + 0.3 * k, k * 1.6, k * 0.35, 0, 0, TAU);
    ctx.fill();
  }

  // 항적: 배 뒤로 길게 남는 하얀 물결 줄 (뒤로 갈수록 옅고 넓게)
  drawWake(ctx, s, k, env, now) {
    const len = { cruise: 26, fishing: 14, yacht: 13, ski: 0 }[s.kind] * k;
    if (!len) return;
    const stern = { cruise: -15, fishing: -5.5, yacht: -7.4 }[s.kind] * k;
    const a0 = (env.night ? 0.18 : 0.5) * (s.kind === 'yacht' ? 0.7 : 1);
    for (let j = 0; j < 2; j++) {
      ctx.strokeStyle = `rgba(255,255,255,${(a0 * (j ? 0.5 : 1)).toFixed(3)})`;
      ctx.lineWidth = Math.max(0.6, k * (j ? 0.25 : 0.4));
      ctx.beginPath();
      for (let i = 0; i <= 12; i++) {
        const u = i / 12;
        const x = stern - u * len;
        const y = 0.3 * k + u * k * (j ? 1.4 : 0.6) + Math.sin(u * 9 - now / 400 + s.seed) * k * 0.15 * u;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // 뒤로 갈수록 흩어지는 거품 점
    for (let i = 0; i < 8; i++) {
      const u = ((i * 0.13 + now / 9000 + s.seed) % 1);
      ctx.fillStyle = `rgba(255,255,255,${(a0 * 0.8 * (1 - u)).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(stern - u * len, 0.4 * k + u * k * (i % 2 ? 1.2 : 0.5), Math.max(0.5, k * 0.25 * (1 - u * 0.5)), 0, TAU);
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
