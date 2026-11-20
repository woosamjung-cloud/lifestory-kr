// 부하 시험: node test/load.mjs [접속 수] [초]
// 서버를 먼저 켜 두세요: MAX_PER_IP=100000 npm start  (한 컴퓨터에서 접속하므로 IP 제한을 풉니다)
import WebSocket from 'ws';

const N = Number(process.argv[2] || 2000);
const SECS = Number(process.argv[3] || 20);
const URL = process.env.URL || 'ws://localhost:3000/ws';
const chars = ['otter', 'penguin', 'rabbit', 'bear', 'cat'];
let open = 0, seated = 0, queued = 0, msgs = 0, bytes = 0, errors = 0;
const lat = [];
const socks = [];

function connect(i) {
  return new Promise((resolve) => {
    const ws = new WebSocket(URL);
    ws.on('open', () => {
      open++;
      ws.send(JSON.stringify({ t: 'join', room: i % 4 === 0 ? 'west' : 'east', char: chars[i % 5], color: i % 8, visitor: 'load' + i.toString(36).padStart(8, '0') }));
      resolve();
    });
    ws.on('message', (d) => {
      msgs++; bytes += d.length;
      const m = JSON.parse(d);
      if (m.t === 'seat') seated++;
      else if (m.t === 'queue' && !ws.q) { ws.q = 1; queued++; }
      else if (m.t === 'fx' && ws.pending) { lat.push(Date.now() - ws.pending); ws.pending = 0; }
    });
    ws.on('error', () => { errors++; resolve(); });
    socks.push(ws);
  });
}

const t0 = Date.now();
for (let i = 0; i < N; i += 100) await Promise.all(Array.from({ length: Math.min(100, N - i) }, (_, k) => connect(i + k)));
console.log(`접속 ${open}/${N} (${Date.now() - t0}ms), 착석 ${seated}, 대기 ${queued}, 오류 ${errors}`);

msgs = 0; bytes = 0;
const iv = setInterval(() => {
  for (let k = 0; k < N / 20; k++) {
    const ws = socks[(Math.random() * socks.length) | 0];
    if (ws.readyState === 1) { ws.pending = ws.pending || Date.now(); ws.send('{"t":"cheer"}'); }
  }
}, 1000);
await new Promise((r) => setTimeout(r, SECS * 1000));
clearInterval(iv);
lat.sort((a, b) => a - b);
const p = (q) => lat[Math.floor(lat.length * q)] ?? '-';
console.log(`${SECS}초 동안 받은 메시지 ${msgs}, 데이터 ${(bytes / 1e6).toFixed(1)}MB (접속당 초당 ${(bytes / N / SECS / 1000).toFixed(2)}KB)`);
console.log(`함성 전달 지연 ms: 중간값 ${p(0.5)}, 95% ${p(0.95)}, 최대 ${lat[lat.length - 1] ?? '-'}`);
const st = await (await fetch(URL.replace('ws', 'http').replace('/ws', '/api/status'))).json();
console.log('서버 상태', JSON.stringify(st));
for (const ws of socks) ws.terminate();
process.exit(0);
