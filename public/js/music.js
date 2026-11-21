// 배경 음악 (켜고 끄기, 기본은 꺼짐)
// - public/music/tracks.json 이 있으면 그 음원 파일을 시간대에 맞춰 재생 (예: 수노 AI로 만든 곡)
//   형식: { "sunrise": [곡, ...], "sunset": [...], "night": [...] }
//   곡은 "파일.mp3" 또는 { "file", "title", "artist", "links": { "melon", "spotify", "youtube", "apple" } }
//   곡 정보가 있으면 재생될 때 '지금 흐르는 곡' 카드가 뜨고, 음원 사이트로 이어짐 (우리 음원 홍보)
// - 없으면 브라우저에서 직접 만드는 잔잔한 피아노·패드 연주 (음원 파일 없음, 저작권 걱정 없음)
// 불멍을 방해하지 않게: 느린 박자, 작은 소리, 가사 없음

const MOODS = {
  // 해돋이: 맑고 희망찬 (C 장조)
  sunrise: { chords: [[48, 55, 64, 67], [45, 52, 60, 64], [41, 48, 57, 64], [43, 50, 59, 62]], scale: [60, 62, 64, 67, 69, 72, 74, 76] },
  // 노을: 따뜻하고 그리운 (F 장7)
  sunset: { chords: [[41, 48, 57, 64], [38, 45, 53, 60], [46, 53, 62, 65], [43, 50, 58, 62]], scale: [60, 62, 65, 67, 69, 72, 74, 77] },
  // 밤: 고요한 (A 단조)
  night: { chords: [[45, 52, 60, 64], [41, 48, 57, 60], [48, 55, 64, 67], [43, 50, 59, 62]], scale: [57, 60, 62, 64, 67, 69, 72, 76] },
};
const hz = (m) => 440 * 2 ** ((m - 69) / 12);

export class Music {
  constructor() {
    this.on = false;
    this.mood = 'sunrise';
    this.tracks = null; // tracks.json 내용
    this.audio = null;
    this.ctx = null;
    this.timers = [];
    this.loadTracks();
  }

  async loadTracks() {
    try {
      const r = await fetch('music/tracks.json', { cache: 'no-cache' });
      if (r.ok) this.tracks = await r.json();
    } catch {
      this.tracks = null;
    }
  }

  // 곡 정보가 있는 모든 곡 (메뉴의 '우리 음악' 목록)
  allTracks() {
    if (!this.tracks) return [];
    const seen = new Set();
    const out = [];
    for (const k of ['sunrise', 'sunset', 'night']) {
      for (const p of this.tracks[k] || []) {
        if (typeof p !== 'object' || !p.title || seen.has(p.file)) continue;
        seen.add(p.file);
        out.push(p);
      }
    }
    return out;
  }

  setMood(mood) {
    if (!MOODS[mood] || mood === this.mood) return;
    this.mood = mood;
    // 음원 파일로 재생 중일 때만 곡을 바꿈 (직접 연주는 다음 마디부터 새 분위기)
    if (this.on && this.audio && this.tracks && (this.tracks[mood] || []).length) this.playFile(true);
  }

  async start() {
    if (this.on) return true;
    this.on = true;
    if (this.tracks && (this.tracks[this.mood] || []).length) return this.playFile(false);
    return this.startSynth();
  }

  stop() {
    if (!this.on) return;
    this.on = false;
    if (this.audio) this.fadeAudio(this.audio, 0, 1500, true);
    this.audio = null;
    this.current = null;
    this.timers.forEach(clearTimeout);
    this.timers = [];
    if (this.master) this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.6);
  }

  setHidden(hidden) {
    if (this.audio) hidden ? this.audio.pause() : this.on && this.audio.play().catch(() => {});
    if (this.ctx) hidden ? this.ctx.suspend() : this.on && this.ctx.resume();
  }

  // ---------- 음원 파일 ----------
  playFile(crossfade) {
    const list = (this.tracks && this.tracks[this.mood]) || [];
    if (!list.length) return this.startSynth();
    const pick = list[Math.floor(Math.random() * list.length)];
    const track = typeof pick === 'string' ? { file: pick } : pick;
    const a = new Audio('music/' + track.file);
    this.current = track;
    a.volume = 0;
    a.loop = list.length === 1;
    a.addEventListener('ended', () => this.on && this.playFile(true));
    const old = this.audio;
    this.audio = a;
    if (old && crossfade) this.fadeAudio(old, 0, 3000, true);
    return a
      .play()
      .then(() => {
        this.fadeAudio(a, 0.35, 3000);
        if (track.title && this.onTrack) this.onTrack(track);
        return true;
      })
      .catch(() => false);
  }

  fadeAudio(a, to, ms, thenStop = false) {
    const from = a.volume;
    const t0 = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      a.volume = from + (to - from) * k;
      if (k < 1) requestAnimationFrame(step);
      else if (thenStop) a.pause();
    };
    step();
  }

  // ---------- 직접 만드는 연주 ----------
  async startSynth() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    if (!this.ctx) {
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0;
      // 부드러운 잔향 (짧게 사라지는 잡음 임펄스)
      const len = ctx.sampleRate * 3;
      const ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
      }
      this.verb = ctx.createConvolver();
      this.verb.buffer = ir;
      const wet = ctx.createGain();
      wet.gain.value = 0.45;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 3200;
      this.bus = ctx.createGain();
      this.bus.connect(lp);
      lp.connect(this.master);
      lp.connect(this.verb).connect(wet).connect(this.master);
      this.master.connect(ctx.destination);
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    this.master.gain.setTargetAtTime(0.16, this.ctx.currentTime, 2.5);
    this.bar = 0;
    this.scheduleBar();
    return true;
  }

  // 한 마디(약 8초): 패드 화음 + 드문드문 피아노 음
  scheduleBar() {
    if (!this.on || this.audio) return;
    const ctx = this.ctx;
    const m = MOODS[this.mood];
    const chord = m.chords[this.bar % m.chords.length];
    const t = ctx.currentTime + 0.05;
    const dur = 8;
    for (const n of chord) this.pad(hz(n), t, dur);
    // 피아노: 한 마디에 3~5음, 박자는 조금씩 흔들리게
    const notes = 3 + Math.floor(Math.random() * 3);
    let at = 0.4 + Math.random() * 0.6;
    for (let i = 0; i < notes; i++) {
      const pick = m.scale[Math.floor(Math.random() * m.scale.length)];
      this.piano(hz(pick), t + at, 0.05 + Math.random() * 0.03);
      at += 1.2 + Math.random() * 1.4;
      if (at > dur - 0.5) break;
    }
    this.bar++;
    this.timers.push(setTimeout(() => this.scheduleBar(), dur * 1000 - 60));
  }

  pad(f, t, dur) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.018, t + 2.5);
    g.gain.setValueAtTime(0.018, t + dur - 2);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.8);
    for (const det of [-5, 5]) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      o.detune.value = det;
      o.connect(g);
      o.start(t);
      o.stop(t + dur + 1);
    }
    g.connect(this.bus);
  }

  piano(f, t, vel) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.01);
    g.gain.exponentialRampToValueAtTime(vel * 0.35, t + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
    for (const [mul, a] of [[1, 1], [2, 0.25], [3, 0.08]]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * mul;
      const og = ctx.createGain();
      og.gain.value = a;
      o.connect(og).connect(g);
      o.start(t);
      o.stop(t + 3.4);
    }
    g.connect(this.bus);
  }
}
