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
    this.waveGain.gain.value = 0.15;
    wsrc.connect(this.waveFilter).connect(this.waveGain).connect(this.master);
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
    this.fireGain.gain.value = 0.18;
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
    const rise = 2.6 + Math.random() * 1.6;
    const fall = 4 + Math.random() * 2.5;
    const peak = 0.38 + Math.random() * 0.22;
    const g = this.waveGain.gain;
    const f = this.waveFilter.frequency;
    g.cancelScheduledValues(t);
    f.cancelScheduledValues(t);
    g.setTargetAtTime(peak, t, rise / 3);
    f.setTargetAtTime(1100 + Math.random() * 500, t, rise / 3);
    g.setTargetAtTime(0.1, t + rise, fall / 3);
    f.setTargetAtTime(320, t + rise, fall / 3);
    const fg = this.foamGain.gain;
    fg.cancelScheduledValues(t);
    fg.setTargetAtTime(0.0, t, 0.3);
    fg.setTargetAtTime(0.09 * peak, t + rise * 0.85, 0.25);
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

  async start() {
    if (!this.ctx && !this.build()) return false;
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    if (this.on) return true;
    this.on = true;
    this.master.gain.setTargetAtTime(0.55, this.ctx.currentTime, 1.2);
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
