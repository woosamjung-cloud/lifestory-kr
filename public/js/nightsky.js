// 실제 밤하늘 그리기: 별(실제 위치·밝기·색), 별자리 선과 이름, 달(위상), 유성
// 날씨 그리기: 구름량에 따른 흐림, 비·눈

import { STARS, LINES, NAMES } from './skydata.js';
import { gmst, equToHor, moonPosition, activeShower, SPORADIC_PER_HOUR } from './sky.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const RAD = Math.PI / 180;

// 별 색 (색지수 B-V → 색)
function starColor(bv) {
  if (bv < 0) return '200,215,255';
  if (bv < 0.4) return '235,240,255';
  if (bv < 0.8) return '255,250,235';
  if (bv < 1.2) return '255,228,190';
  return '255,205,160';
}

// 반짝이는 별 이미지 (색·크기별로 한 번만 그려 둠)
const starSprites = new Map();
function starSprite(rgb, size, spikes) {
  const key = `${rgb}|${size}|${spikes}`;
  let c = starSprites.get(key);
  if (c) return c;
  const R = Math.ceil(size * (spikes ? 7 : 3.2));
  c = document.createElement('canvas');
  c.width = c.height = R * 2;
  const g = c.getContext('2d');
  // 부드러운 빛무리
  const halo = g.createRadialGradient(R, R, 0, R, R, R);
  halo.addColorStop(0, `rgba(${rgb},1)`);
  halo.addColorStop(0.12, `rgba(${rgb},0.85)`);
  halo.addColorStop(0.3, `rgba(${rgb},0.22)`);
  halo.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = halo;
  g.fillRect(0, 0, R * 2, R * 2);
  if (spikes) {
    // 가늘게 퍼지는 십자 빛살
    for (const [w, h, a] of [[R * 2, size * 0.5, 0.55], [size * 0.5, R * 2, 0.55], [R * 1.1, size * 0.35, 0.3]]) {
      const lg = w > h ? g.createLinearGradient(0, R, R * 2, R) : g.createLinearGradient(R, 0, R, R * 2);
      lg.addColorStop(0, `rgba(${rgb},0)`);
      lg.addColorStop(0.5, `rgba(${rgb},${a})`);
      lg.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = lg;
      g.fillRect(R - w / 2, R - h / 2, w, h);
    }
  }
  // 작은 흰 중심
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.beginPath();
  g.arc(R, R, Math.max(0.5, size * 0.35), 0, Math.PI * 2);
  g.fill();
  starSprites.set(key, c);
  return c;
}

export class NightSky {
  constructor() {
    this.showConstellations = false; // 별자리 선·이름 (눈 아이콘으로 켜고 끔)
    this.meteors = [];
    this.lastSpawn = 0;
    this.lastT = 0;
    this.shower = null;
    this.showerCheckedAt = 0;
    this.drops = [];
  }

  // 하늘 좌표 → 화면 좌표 (해 그림과 별도로, 하늘을 넓게 보여주는 투영)
  project(alt, az, view) {
    let d = az - view.centerAz;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return { x: view.W / 2 + d * view.px, y: view.horizonY - alt * view.px, d };
  }

  view(scene) {
    const px = Math.max(scene.horizonY / 62, scene.W / 140);
    return { W: scene.W, horizonY: scene.horizonY, centerAz: scene.centerAz, px };
  }

  /**
   * 별·별자리·달·유성 그리기
   * @param starA 별이 보이는 정도 (0~1, 해 고도로 결정)
   * @param cover 구름량 (0~1)
   */
  draw(ctx, scene, time, nowMs, starA, cover) {
    const place = scene.placeInfo;
    const lst = gmst(time) + place.lon;
    const v = this.view(scene);
    const moon = moonPosition(time);
    const mh = equToHor(moon.ra, moon.dec, place.lat, lst);
    // 밝은 달이 떠 있으면 하늘이 밝아져 어두운 별이 덜 보임
    const moonlight = mh.alt > 0 ? moon.illum * clamp(mh.alt / 20) : 0;
    const vis = starA * (1 - cover * 0.92) * (1 - moonlight * 0.35);
    const dt = this.lastT ? Math.min(0.1, (nowMs - this.lastT) / 1000) : 0;
    this.lastT = nowMs;

    // 달빛에 하늘이 살짝 밝아짐
    if (moonlight > 0.05 && starA > 0.2) {
      ctx.fillStyle = `rgba(90,110,160,${0.12 * moonlight * starA})`;
      ctx.fillRect(0, 0, v.W, v.horizonY + 1);
    }
    // 달 (낮에도 희미하게 보임)
    if (mh.alt > -1) this.drawMoon(ctx, scene, v, mh, moon, starA, cover);

    if (vis > 0.02) {
      ctx.save();
      if (this.showConstellations) {
      // 별자리 선
      ctx.strokeStyle = `rgba(190,205,255,${0.24 * vis})`;
      ctx.lineWidth = 0.7;
      for (const segs of Object.values(LINES)) {
        for (const seg of segs) {
          ctx.beginPath();
          let pen = false;
          let prev = null;
          for (const [ra, dec] of seg) {
            const h = equToHor(ra, dec, place.lat, lst);
            const p = this.project(h.alt, h.az, v);
            const ok = h.alt > 0 && Math.abs(p.d) < 100 && (!prev || Math.abs(p.x - prev.x) < v.W);
            if (ok && pen) ctx.lineTo(p.x, p.y);
            else if (ok) ctx.moveTo(p.x, p.y);
            pen = ok;
            prev = p;
          }
          ctx.stroke();
        }
      }
      // 별자리 이름
      ctx.fillStyle = `rgba(215,225,255,${0.6 * vis})`;
      ctx.font = '11px "Gowun Batang", serif';
      ctx.textAlign = 'center';
      for (const [name, ra, dec] of Object.values(NAMES)) {
        const h = equToHor(ra, dec, place.lat, lst);
        if (h.alt < 8) continue;
        const p = this.project(h.alt, h.az, v);
        if (p.x < 20 || p.x > v.W - 20 || p.y < 60) continue;
        ctx.fillText(name, p.x, p.y);
      }
      }
      // 별
      for (let i = 0; i < STARS.length; i++) {
        const [ra, dec, mag, bv] = STARS[i];
        // 어두운 별은 하늘이 충분히 어두울 때만
        if (mag > 2.8 + vis * 2.0) continue;
        const h = equToHor(ra, dec, place.lat, lst);
        if (h.alt < 0.5) continue;
        const p = this.project(h.alt, h.az, v);
        if (p.x < -4 || p.x > v.W + 4 || p.y < -4) continue;
        const size = Math.max(0.6, (5.2 - mag) * 0.38);
        // 지평선 가까이는 대기에 가려 흐려짐
        const ext = clamp(h.alt / 12, 0.25, 1);
        const tw = 0.75 + 0.25 * Math.sin(nowMs / (380 + (i % 7) * 90) + i);
        const a = clamp(vis * ext * tw * (mag < 2.5 ? 1.1 : 0.9));
        const spr = starSprite(starColor(bv), Math.round(size * 4) / 4, mag < 1.6);
        ctx.globalAlpha = a;
        ctx.drawImage(spr, p.x - spr.width / 2, p.y - spr.height / 2);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }

    // 유성
    if (nowMs - this.showerCheckedAt > 30000 || !this.showerCheckedAt) {
      this.shower = activeShower(time);
      this.showerCheckedAt = nowMs;
    }
    if (vis > 0.25 && dt > 0) {
      // 실제 시간당 유성 수를 바탕으로, 화면에서 보기 좋게 3배로 연출
      const perHour = SPORADIC_PER_HOUR + (this.shower ? this.shower.rate : 0);
      const perSec = (perHour / 3600) * 3 * vis;
      if (Math.random() < perSec * dt) this.spawnMeteor(scene, v, place, lst);
    }
    this.drawMeteors(ctx, nowMs, vis);
  }

  spawnMeteor(scene, v, place, lst) {
    let rad = null;
    if (this.shower && Math.random() < this.shower.rate / (this.shower.rate + SPORADIC_PER_HOUR)) {
      const h = equToHor(this.shower.ra, this.shower.dec, place.lat, lst);
      if (h.alt > 0) rad = this.project(h.alt, h.az, v);
    }
    const sx = Math.random() * v.W;
    const sy = Math.random() * v.horizonY * 0.75;
    let ang;
    if (rad) ang = Math.atan2(sy - rad.y, sx - rad.x); // 복사점에서 멀어지는 방향
    else ang = (0.15 + Math.random() * 0.7) * Math.PI; // 대체로 아래쪽으로
    const len = 70 + Math.random() * 130;
    this.spawned = (this.spawned || 0) + 1;
    this.meteors.push({ x: sx, y: sy, ang, len, t0: performance.now(), dur: 450 + Math.random() * 600, bright: 0.6 + Math.random() * 0.4 });
    if (this.meteors.length > 12) this.meteors.shift();
  }

  drawMeteors(ctx, nowMs, vis) {
    this.meteors = this.meteors.filter((m) => {
      const p = (nowMs - m.t0) / m.dur;
      if (p >= 1) return false;
      const head = Math.min(1, p * 1.3);
      const tail = Math.max(0, p * 1.3 - 0.45);
      const hx = m.x + Math.cos(m.ang) * m.len * head;
      const hy = m.y + Math.sin(m.ang) * m.len * head;
      const tx = m.x + Math.cos(m.ang) * m.len * tail;
      const ty = m.y + Math.sin(m.ang) * m.len * tail;
      const a = m.bright * vis * (p < 0.8 ? 1 : (1 - p) / 0.2);
      const g = ctx.createLinearGradient(tx, ty, hx, hy);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(1, `rgba(255,250,235,${a})`);
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(hx, hy);
      ctx.stroke();
      ctx.fillStyle = `rgba(255,255,245,${a})`;
      ctx.beginPath();
      ctx.arc(hx, hy, 1.4, 0, Math.PI * 2);
      ctx.fill();
      return true;
    });
  }

  drawMoon(ctx, scene, v, mh, moon, starA, cover) {
    const p = this.project(mh.alt, mh.az, v);
    if (p.x < -40 || p.x > v.W + 40 || p.y < -40) return;
    const r = Math.max(9, scene.H * 0.018);
    const a = (0.35 + 0.65 * starA) * (1 - cover * 0.7) * clamp(mh.alt / 3 + 0.3);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, v.W, v.horizonY);
    ctx.clip();
    // 달무리
    const g = ctx.createRadialGradient(p.x, p.y, r, p.x, p.y, r * 5);
    g.addColorStop(0, `rgba(255,248,225,${0.22 * a * moon.illum})`);
    g.addColorStop(1, 'rgba(255,248,225,0)');
    ctx.fillStyle = g;
    ctx.fillRect(p.x - r * 5, p.y - r * 5, r * 10, r * 10);
    // 어두운 면 (지구조)
    ctx.fillStyle = `rgba(60,70,100,${0.35 * a})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    // 밝은 면: 반원 + 타원 (위상에 따라)
    const k = moon.illum; // 0~1
    const side = moon.waxing ? 1 : -1; // 북반구: 차오르는 달은 오른쪽이 밝음
    ctx.fillStyle = `rgba(255,248,225,${a})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, -Math.PI / 2, Math.PI / 2, side < 0);
    const ex = r * Math.abs(1 - 2 * k);
    // 명암 경계선: 초승·그믐(k<0.5)은 밝은 쪽으로, 상현~보름(k>0.5)은 어두운 쪽으로 볼록
    const tSide = k < 0.5 ? side : -side;
    ctx.ellipse(p.x, p.y, Math.max(0.01, ex), r, 0, Math.PI / 2, -Math.PI / 2, tSide > 0);
    ctx.fill();
    ctx.restore();
  }

  // ---------- 날씨: 흐림 덮개 ----------
  drawOvercast(ctx, scene, cover, light) {
    if (cover < 0.5) return;
    const a = (cover - 0.5) * 1.3;
    const top = light > 0.5 ? '150,155,170' : '40,44,62';
    const bot = light > 0.5 ? '185,185,195' : '70,70,90';
    const g = ctx.createLinearGradient(0, 0, 0, scene.horizonY);
    g.addColorStop(0, `rgba(${top},${a})`);
    g.addColorStop(1, `rgba(${bot},${a * 0.7})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, scene.W, scene.horizonY + 1);
  }

  // ---------- 날씨: 비·눈 ----------
  drawPrecip(ctx, scene, pty, nowMs) {
    if (!pty) return;
    const snow = pty === 3 || pty === 7 || pty === 2 || pty === 6;
    const rain = pty === 1 || pty === 2 || pty === 5 || pty === 6;
    const n = pty === 5 || pty === 6 || pty === 7 ? 70 : 150;
    if (this.drops.length !== n) {
      this.drops = Array.from({ length: n }, (_, i) => ({ x: Math.random(), y: Math.random(), s: 0.5 + Math.random(), snow: snow && (!rain || i % 2 === 0) }));
    }
    const t = nowMs / 1000;
    ctx.save();
    for (const d of this.drops) {
      if (d.snow) {
        const y = ((d.y + t * 0.05 * d.s) % 1) * scene.H;
        const x = ((d.x + Math.sin(t * 0.8 + d.y * 20) * 0.01) % 1) * scene.W;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.arc(x, y, 1.2 + d.s * 1.3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const y = ((d.y + t * 0.9 * d.s) % 1) * scene.H;
        const x = d.x * scene.W - y * 0.08;
        ctx.strokeStyle = 'rgba(210,225,240,0.45)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 2, y + 10 + d.s * 6);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}
