// 파도·바람·모닥불 소리를 4분짜리 이음매 없는 음원으로 (아이폰 화면 꺼도 재생용)
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('about:blank');
  const b64 = await p.evaluate(async () => {
    const SR = 44100, LEN = 240, X = 4; // 4분 + 이음매 4초
    const ctx = new OfflineAudioContext(2, SR * (LEN + X), SR);
    const nb = ctx.createBuffer(2, SR * 8, SR);
    for (let ch = 0; ch < 2; ch++) {
      const d = nb.getChannelData(ch); let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926; }
    }
    const master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    const loop = (off) => { const s = ctx.createBufferSource(); s.buffer = nb; s.loop = true; s.start(0, off); return s; };
    const T = LEN + X;
    // 파도
    const wl = ctx.createBiquadFilter(); wl.type = 'lowpass'; wl.frequency.value = 420;
    const wh = ctx.createBiquadFilter(); wh.type = 'highpass'; wh.frequency.value = 220;
    const wg = ctx.createGain(); wg.gain.setValueAtTime(0.04, 0);
    loop(0).connect(wl).connect(wh).connect(wg).connect(master);
    const fh = ctx.createBiquadFilter(); fh.type = 'highpass'; fh.frequency.value = 2500;
    const fg = ctx.createGain(); fg.gain.setValueAtTime(0, 0);
    loop(1.7).connect(fh).connect(fg).connect(master);
    for (let t = 0.5; t < T; ) {
      const up = 3 + Math.random(), down = 4 + Math.random() * 2, peak = 0.11 + Math.random() * 0.07;
      wg.gain.setTargetAtTime(peak, t, up / 3); wg.gain.setTargetAtTime(0.035, t + up, down / 3);
      fg.gain.setTargetAtTime(0.025 * peak / 0.15, t + up * 0.85, 0.3); fg.gain.setTargetAtTime(0, t + up + 0.8, 1.2);
      t += up + down;
    }
    // 바람
    const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.Q.value = 0.9; bf.frequency.value = 500;
    const bg = ctx.createGain(); bg.gain.value = 0.05;
    loop(3.1).connect(bf).connect(bg).connect(master);
    for (let t = 0; t < T; t += 6) { bg.gain.setTargetAtTime(0.03 + Math.random() * 0.05, t, 2.5); bf.frequency.setTargetAtTime(350 + Math.random() * 400, t, 3); }
    // 모닥불 웅웅 + 타닥
    const rf = ctx.createBiquadFilter(); rf.type = 'lowpass'; rf.frequency.value = 180;
    const rg = ctx.createGain(); rg.gain.value = 0.07;
    loop(4.4).connect(rf).connect(rg).connect(master);
    for (let t = 0.2; t < T; ) {
      const n = Math.random() < 0.15 ? 3 : 1;
      for (let k = 0; k < n; k++) {
        const s = ctx.createBufferSource(); s.buffer = nb;
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1200 + Math.random() * 3000;
        const g = ctx.createGain(); const at = t + k * (0.02 + Math.random() * 0.05), dur = 0.004 + Math.random() * 0.025, amp = (0.2 + Math.random() * 0.8) * 0.5;
        g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(amp, at + 0.001); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
        s.connect(hp).connect(g).connect(master); s.start(at, Math.random() * 5, dur + 0.02);
      }
      t += 0.06 + Math.random() * 0.52;
    }
    const buf = await ctx.startRendering();
    // 끝 4초를 처음 4초에 겹쳐 이어 붙임 (반복해도 이음매 없음)
    const out = [0, 1].map((ch) => { const d = buf.getChannelData(ch); const o = new Float32Array(SR * LEN); for (let i = 0; i < o.length; i++) o[i] = d[i]; for (let i = 0; i < SR * X; i++) { const a = i / (SR * X); o[i] = d[i] * a + d[SR * LEN + i] * (1 - a); } return o; });
    let peak = 0; for (const o of out) for (const v of o) peak = Math.max(peak, Math.abs(v));
    const gain = 0.6 / peak;
    const n = out[0].length; const dv = new DataView(new ArrayBuffer(44 + n * 4));
    const ws = (o, s) => [...s].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
    ws(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); ws(8, 'WAVE'); ws(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true); dv.setUint32(24, SR, true); dv.setUint32(28, SR * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); ws(36, 'data'); dv.setUint32(40, n * 4, true);
    for (let i = 0; i < n; i++) { dv.setInt16(44 + i * 4, out[0][i] * gain * 32767, true); dv.setInt16(46 + i * 4, out[1][i] * gain * 32767, true); }
    const bytes = new Uint8Array(dv.buffer); let s = ''; for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(s);
  });
  fs.writeFileSync(process.argv[2], Buffer.from(b64, 'base64'));
  await b.close();
})();
