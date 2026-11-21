// 배경음: 파도·바람·모닥불 소리를 브라우저에서 직접 합성 (음원 파일 없음, 저작권 걱정 없음)
// 브라우저 정책상 사용자가 버튼을 누른 뒤에만 소리를 낼 수 있습니다.

function pinkNoiseBuffer(ctx, seconds = 6) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    // Paul Kellet 방식 핑크 노이즈 (자연의 소리에 가까운 부드러운 잡음)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  }
  return buf;
}

export class Ambience {
  constructor() {
    this.ctx = null;
    this.on = false;
    this.timers = [];
    this.wind = 0.5; // 0~1 (날씨에 따라 조절 가능)
  }

  build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    this.noise = pinkNoiseBuffer(ctx);

    // 파도: 저역 통과 잡음이 천천히 밀려왔다 빠짐
    const wsrc = this.loop(0);
    this.waveFilter = ctx.createBiquadFilter();
    this.waveFilter.type = 'lowpass';
    this.waveFilter.frequency.value = 400;
    this.waveGain = ctx.createGain();
    this.waveGain.gain.value = 0.05;
    // 웅장하게 울리는 낮은 소리를 걷어내 잔잔한 물결 소리로
    const waveHp = ctx.createBiquadFilter();
    waveHp.type = 'highpass';
    waveHp.frequency.value = 220;
    wsrc.connect(this.waveFilter).connect(waveHp).connect(this.waveGain).connect(this.master);
    // 부서지는 물보라 (고역 잡음, 파도 정점에서만)
    const fsrc = this.loop(1.7);
    this.foamFilter = ctx.createBiquadFilter();
    this.foamFilter.type = 'highpass';
    this.foamFilter.frequency.value = 2500;
    this.foamGain = ctx.createGain();
    this.foamGain.gain.value = 0;
    fsrc.connect(this.foamFilter).connect(this.foamGain).connect(this.master);

    // 바람: 대역 통과 잡음, 세기와 높이가 천천히 바뀜
    const nsrc = this.loop(3.1);
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.Q.value = 0.9;
    this.windFilter.frequency.value = 500;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.05;
    nsrc.connect(this.windFilter).connect(this.windGain).connect(this.master);

    // 모닥불: 낮게 웅웅거리는 소리 + 타닥 튀는 소리
    const rsrc = this.loop(4.4);
    const rf = ctx.createBiquadFilter();
    rf.type = 'lowpass';
    rf.frequency.value = 180;
    this.fireGain = ctx.createGain();
    this.fireGain.gain.value = 0.07;
    rsrc.connect(rf).connect(this.fireGain).connect(this.master);
    this.crackleBus = ctx.createGain();
    this.crackleBus.gain.value = 0.5;
    this.crackleBus.connect(this.master);
    return true;
  }

  loop(offset) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    s.start(0, offset % this.noise.duration);
    return s;
  }

  // 파도 한 번: 밀려오고(3~4초) 부서지고 빠짐(4~6초)
  scheduleWave() {
    if (!this.on) return;
    const t = this.ctx.currentTime;
    const rise = 1.8 + Math.random() * 1.2;
    const fall = 3 + Math.random() * 2;
    const peak = 0.11 + Math.random() * 0.07;
    const g = this.waveGain.gain;
    const f = this.waveFilter.frequency;
    g.cancelScheduledValues(t);
    f.cancelScheduledValues(t);
    g.setTargetAtTime(peak, t, rise / 3);
    f.setTargetAtTime(750 + Math.random() * 300, t, rise / 3);
    g.setTargetAtTime(0.035, t + rise, fall / 3);
    f.setTargetAtTime(420, t + rise, fall / 3);
    const fg = this.foamGain.gain;
    fg.cancelScheduledValues(t);
    fg.setTargetAtTime(0.0, t, 0.3);
    fg.setTargetAtTime(0.25 * peak, t + rise * 0.85, 0.2);
    fg.setTargetAtTime(0.0, t + rise + 0.6, 1.2);
    this.timers.push(setTimeout(() => this.scheduleWave(), (rise + fall * 0.8) * 1000));
  }

  scheduleWind() {
    if (!this.on) return;
    const t = this.ctx.currentTime;
    const base = 0.02 + this.wind * 0.07;
    this.windGain.gain.setTargetAtTime(base * (0.5 + Math.random()), t, 1.5);
    this.windFilter.frequency.setTargetAtTime(300 + Math.random() * 700, t, 2);
    this.timers.push(setTimeout(() => this.scheduleWind(), 2500 + Math.random() * 3000));
  }

  // 타닥: 아주 짧은 고역 잡음 조각
  scheduleCrackle() {
    if (!this.on) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const n = Math.random() < 0.15 ? 3 : 1; // 가끔 연달아 튐
    for (let k = 0; k < n; k++) {
      const s = ctx.createBufferSource();
      s.buffer = this.noise;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1200 + Math.random() * 3000;
      const g = ctx.createGain();
      const at = t + k * (0.02 + Math.random() * 0.05);
      const dur = 0.004 + Math.random() * 0.025;
      const amp = 0.2 + Math.random() * 0.8;
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(amp, at + 0.001);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      s.connect(hp).connect(g).connect(this.crackleBus);
      s.start(at, Math.random() * 5, dur + 0.02);
    }
    this.timers.push(setTimeout(() => this.scheduleCrackle(), 60 + Math.random() * 520));
  }

  // 동전이 물에 떨어지는 '퐁당'
  plop() {
    if (!this.on) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(900, t);
    o.frequency.exponentialRampToValueAtTime(260, t + 0.18);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.35);
  }

  // 물수제비 '톡' (튈 때마다 작게)
  tick() {
    if (!this.on) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(1500, t);
    o.frequency.exponentialRampToValueAtTime(700, t + 0.06);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.1);
  }

  // '와!' 효과음: 목소리 없이 귀여운 '뿅!' + 반짝반짝 종소리 (voices: 뿅 개수)
  cheer(voices = 2, vol = 1) {
    if (!this.on) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    this.cheerHits = (this.cheerHits || []).filter((t) => now - t < 1);
    if (this.cheerHits.length >= 4) return;
    this.cheerHits.push(now);
    const out = ctx.createGain();
    out.gain.value = 0.4 * vol;
    out.connect(this.master);
    // 뿅: 물방울처럼 위로 통 튀는 소리
    for (let k = 0; k < Math.min(voices, 3); k++) {
      const t = now + 0.01 + k * 0.09;
      const base = 520 + k * 140 + Math.random() * 40;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(base, t);
      o.frequency.exponentialRampToValueAtTime(base * 2.6, t + 0.07);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.18);
    }
    // 반짝반짝: 올라가는 작은 종소리
    const t1 = now + 0.06 + Math.min(voices, 3) * 0.09;
    [1568, 2093, 2637, 3136].forEach((f, k) => {
      const t = t1 + k * 0.06;
      for (const [mul, a] of [[1, 0.09], [2.76, 0.02]]) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f * mul;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(a, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + 0.5);
      }
    });
  }

  // 기차: 역 안내 차임(딩-동-댕) → 철컥철컥 지나가는 바퀴 소리 + 멀리서 부드러운 기적
  // (실제 철도 안내음을 흉내 내지 않은, 직접 만든 소리)
  train(seconds = 3.2) {
    if (!this.on) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + 0.05;
    // 차임: 맑은 종소리 세 음
    [[659.25, 0], [523.25, 0.42], [783.99, 0.84]].forEach(([f, dt]) => {
      for (const [mul, a] of [[1, 0.09], [2.01, 0.025], [3.02, 0.01]]) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = f * mul;
        g.gain.setValueAtTime(0.0001, t0 + dt);
        g.gain.exponentialRampToValueAtTime(a, t0 + dt + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 1.6);
        o.connect(g).connect(this.master);
        o.start(t0 + dt);
        o.stop(t0 + dt + 1.7);
      }
    });
    // 바퀴: 이음매를 지날 때마다 '철-컥' (두 번씩), 다가왔다 멀어지게
    const tw = t0 + 1.2;
    const beat = 0.36;
    const n = Math.floor(seconds / beat);
    for (let i = 0; i < n; i++) {
      const env = Math.sin((i / (n - 1)) * Math.PI) ** 1.5; // 가까워졌다 멀어짐
      for (const off of [0, 0.11]) {
        const t = tw + i * beat + off;
        const s = ctx.createBufferSource();
        s.buffer = this.noise;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = off ? 1400 : 900;
        bp.Q.value = 2.5;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.0001 + 0.32 * env, t + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
        s.connect(bp).connect(g).connect(this.master);
        s.start(t, Math.random() * 4, 0.12);
      }
    }
    // 레일 위를 구르는 낮은 웅웅거림
    const r = ctx.createBufferSource();
    r.buffer = this.noise;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    const rg = ctx.createGain();
    rg.gain.setValueAtTime(0.0001, tw);
    rg.gain.exponentialRampToValueAtTime(0.25, tw + seconds * 0.45);
    rg.gain.exponentialRampToValueAtTime(0.0001, tw + seconds);
    r.connect(lp).connect(rg).connect(this.master);
    r.start(tw, Math.random() * 2, seconds + 0.1);
    // 멀리서 들리는 부드러운 기적 (짧게 한 번)
    const tv = tw + 0.3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, tv);
    g.gain.exponentialRampToValueAtTime(0.03, tv + 0.15);
    g.gain.setValueAtTime(0.03, tv + 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, tv + 1.2);
    const wlp = ctx.createBiquadFilter();
    wlp.type = 'lowpass';
    wlp.frequency.value = 1500;
    for (const f of [440, 554.37]) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      o.connect(wlp);
      o.start(tv);
      o.stop(tv + 1.3);
    }
    wlp.connect(g).connect(this.master);
  }

  // 멀리서 터지는 폭죽 '펑'
  boom() {
    if (!this.on) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(120, t + 0.8);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.9, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    s.connect(lp).connect(g).connect(this.master);
    s.start(t, Math.random() * 4, 1.3);
    // 뒤따르는 반짝이는 타닥 소리
    for (let k = 0; k < 10; k++) setTimeout(() => this.on && this.scheduleOneCrackle(0.25), 300 + k * 70 + Math.random() * 120);
  }

  scheduleOneCrackle(amp = 0.5) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3000 + Math.random() * 3000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
    s.connect(hp).connect(g).connect(this.master);
    s.start(t, Math.random() * 5, 0.04);
  }

  async start() {
    if (!this.ctx && !this.build()) return false;
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    if (this.on) return true;
    this.on = true;
    this.master.gain.setTargetAtTime(0.5, this.ctx.currentTime, 1.2);
    this.scheduleWave();
    this.scheduleWind();
    this.scheduleCrackle();
    return true;
  }

  stop() {
    if (!this.ctx || !this.on) return;
    this.on = false;
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
  }

  // 화면을 떠나면 잠시 멈춤 (배터리 절약)
  setHidden(hidden) {
    if (!this.ctx) return;
    if (hidden) this.ctx.suspend();
    else if (this.on) this.ctx.resume();
  }

  // 날씨의 바람 세기 반영 (m/s)
  setWind(ms) {
    this.wind = Math.max(0, Math.min(1, (ms || 0) / 10));
  }
}
