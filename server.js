// 방구석 해돋이호 서버
// - public/ 폴더의 화면 파일을 보여주고
// - WebSocket(/ws)으로 좌석, 대기열, "와!" 함성, 풍등·종이배 효과를 실시간으로 나눕니다.
// 실행: npm install && npm start  (기본 주소 http://localhost:3000)

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { nextEventAt, dateKey } from './public/js/sun.js';
import { startWeather, weatherStatus } from './weather.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'counts.json');

const PORT = Number(process.env.PORT || 3000);
const SEATS = Math.max(1, Number(process.env.SEATS || 1000)); // 장소(방)마다 좌석 수
const MAX_CLIENTS = Number(process.env.MAX_CLIENTS || 20000); // 서버 전체 접속 상한
const MAX_PER_IP = Number(process.env.MAX_PER_IP || 30); // 한 IP에서 동시 접속 상한 (회사·학교 와이파이 고려)
const PEOPLE_IN_SNAPSHOT = 150; // 화면에 그릴 수 있는 앞쪽 좌석만 보냅니다.
const CHARS = ['blanket', 'hood', 'scarf', 'beanie', 'coat']; // public/js/characters.js 의 CHAR_LIST 순서와 같아야 함
const ROOMS = ['east', 'west'];
const WITNESS_BEFORE_MS = 30 * 60 * 1000; // 이벤트 30분 전부터
const WITNESS_AFTER_MS = 20 * 60 * 1000; // 이벤트 20분 후까지 자리에 있으면 "함께 본 사람"

// ---------- 집계 저장 (함성 수, 함께 본 사람 수) ----------
let counts = { cheers: {}, witnesses: {}, daily: {} };
try {
  counts = { cheers: {}, witnesses: {}, daily: {}, ...JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) };
} catch {
  /* 처음 실행이면 파일이 없습니다 */
}
const witnessSets = new Map(); // eventKey -> Set(visitorId)
let countsDirty = false;

// ---------- 하루 통계 (개인정보 없이 숫자만) ----------
// visitors: 하루 동안 접속한 기기 수 (기기마다 만든 무작위 번호로 중복 제거, 번호 자체는 저장하지 않음)
const STAT_KINDS = ['ticket', 'card', 'save', 'preview'];
const dailyVisitors = new Map(); // dateKey -> Set(visitorId)  (메모리에만, 하루 지나면 지움)
function today() {
  return dateKey(new Date());
}
function dayStats(key = today()) {
  if (!counts.daily[key]) {
    counts.daily[key] = { visitors: 0, peak: 0, ticket: 0, card: 0, save: 0, preview: 0, cheer: 0, ritual: 0 };
    // 오래된 날짜(60일 넘은 것) 정리
    const keys = Object.keys(counts.daily).sort();
    while (keys.length > 60) delete counts.daily[keys.shift()];
    for (const k of dailyVisitors.keys()) if (k !== key) dailyVisitors.delete(k);
  }
  return counts.daily[key];
}
function bump(field, n = 1) {
  dayStats()[field] += n;
  countsDirty = true;
}
function countVisitor(visitor) {
  const key = today();
  let set = dailyVisitors.get(key);
  if (!set) {
    set = new Set();
    dailyVisitors.set(key, set);
  }
  if (set.has(visitor)) return;
  set.add(visitor);
  const d = dayStats(key);
  d.visitors = Math.max(d.visitors, set.size);
  countsDirty = true;
}
function notePeak() {
  const d = dayStats();
  if (clients.size > d.peak) {
    d.peak = clients.size;
    countsDirty = true;
  }
}

function saveCounts() {
  if (!countsDirty) return;
  countsDirty = false;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE + '.tmp', JSON.stringify(counts));
    fs.renameSync(DATA_FILE + '.tmp', DATA_FILE);
  } catch (err) {
    console.error('집계 저장 실패:', err.message);
  }
}
setInterval(saveCounts, 10000).unref();

// ---------- 방(장소) 상태 ----------
const rooms = Object.fromEntries(
  ROOMS.map((key) => [
    key,
    {
      key,
      seats: new Array(SEATS).fill(null), // 좌석 번호 -> client
      queue: [], // 대기 중인 client
      members: new Set(),
      fx: [], // 모아서 보낼 효과
      dirty: true,
    },
  ]),
);

let nextId = 1;
const clients = new Set();
const perIp = new Map();

function clientIp(req) {
  // Render 등 프록시 뒤에서는 x-forwarded-for 의 첫 번째 주소가 실제 접속자입니다.
  const fwd = req.headers['x-forwarded-for'];
  return (fwd ? String(fwd).split(',')[0] : req.socket.remoteAddress || '').trim();
}

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function currentEventOf(roomKey) {
  return nextEventAt(roomKey, new Date());
}

function freeSeat(room) {
  // 앞줄 가운데부터 채우도록 좌석 번호 0번부터 찾습니다.
  return room.seats.indexOf(null);
}

function seatClient(room, c) {
  const idx = freeSeat(room);
  if (idx === -1) return false;
  room.seats[idx] = c;
  c.seat = idx;
  c.queued = false;
  send(c.ws, { t: 'seat', seat: idx });
  markWitness(room, c);
  return true;
}

function markWitness(room, c) {
  const ev = currentEventOf(room.key);
  if (!ev || c.seat == null) return;
  const now = Date.now();
  const t = ev.time.getTime();
  if (now < t - WITNESS_BEFORE_MS || now > t + WITNESS_AFTER_MS) return;
  let set = witnessSets.get(ev.key);
  if (!set) {
    set = new Set();
    witnessSets.set(ev.key, set);
  }
  if (!set.has(c.visitor)) {
    set.add(c.visitor);
    counts.witnesses[ev.key] = Math.max(counts.witnesses[ev.key] || 0, set.size);
    countsDirty = true;
  }
}

function leaveRoom(c) {
  const room = c.room && rooms[c.room];
  if (!room) return;
  room.members.delete(c);
  if (c.seat != null && room.seats[c.seat] === c) room.seats[c.seat] = null;
  const qi = room.queue.indexOf(c);
  if (qi !== -1) room.queue.splice(qi, 1);
  c.seat = null;
  c.queued = false;
  c.room = null;
  // 빈자리가 생기면 대기 순서대로 앉힙니다.
  while (room.queue.length && freeSeat(room) !== -1) {
    seatClient(room, room.queue.shift());
  }
  room.queue.forEach((q, i) => send(q.ws, { t: 'queue', pos: i + 1 }));
  room.dirty = true;
}

function joinRoom(c, roomKey) {
  if (c.room === roomKey) return;
  leaveRoom(c);
  const room = rooms[roomKey];
  c.room = roomKey;
  room.members.add(c);
  if (!seatClient(room, c)) {
    c.queued = true;
    room.queue.push(c);
    send(c.ws, { t: 'queue', pos: room.queue.length });
  }
  room.dirty = true;
}

// people: [좌석번호, 캐릭터번호*8+담요색] 목록 (화면에 보이는 앞쪽 좌석만)
function roomSnapshot(room, withPeople = true) {
  const ev = currentEventOf(room.key);
  const people = [];
  if (withPeople) {
    const end = Math.min(room.seats.length, PEOPLE_IN_SNAPSHOT + 1);
    for (let i = 0; i < end; i++) {
      const c = room.seats[i];
      if (c) people.push([i, CHARS.indexOf(c.char) * 8 + c.color]);
    }
  }
  const seated = room.members.size - room.queue.length;
  return {
    t: 'room',
    room: room.key,
    seated,
    waiting: room.queue.length,
    seats: SEATS,
    online: clients.size,
    eventKey: ev ? ev.key : null,
    cheers: ev ? counts.cheers[ev.key] || 0 : 0,
    witnesses: ev ? counts.witnesses[ev.key] || 0 : 0,
    people,
  };
}

// 효과는 0.25초마다 모아서, 방 상태는 바뀌었을 때(최소 1초 간격) 보냅니다.
setInterval(() => {
  for (const room of Object.values(rooms)) {
    if (!room.fx.length) continue;
    const msg = JSON.stringify({ t: 'fx', list: room.fx.splice(0, 40) });
    room.fx.length = 0;
    for (const c of room.members) if (c.seat != null && c.ws.readyState === c.ws.OPEN) c.ws.send(msg);
  }
}, 250).unref();

let tick = 0;
setInterval(() => {
  tick++;
  for (const room of Object.values(rooms)) {
    const busy = room.members.size > 200;
    if (busy ? tick % 2 !== 0 : !room.dirty && tick % 5 !== 0) continue;
    room.dirty = false;
    const full = JSON.stringify(roomSnapshot(room, true));
    const lite = tick % 4 === 0 ? JSON.stringify(roomSnapshot(room, false)) : null;
    for (const c of room.members) {
      if (c.ws.readyState !== c.ws.OPEN) continue;
      if (c.seat != null) c.ws.send(full);
      else if (lite || !busy) c.ws.send(lite || full);
    }
    // 이벤트 시간대에 들어오면 이미 앉아 있던 사람도 "함께 본 사람"으로 셉니다.
    if (tick % 15 === 0) for (const c of room.members) if (c.seat != null) markWitness(room, c);
  }
}, 1000).unref();

// ---------- 메시지 처리 ----------
function handle(c, msg) {
  const now = Date.now();
  switch (msg.t) {
    case 'join': {
      if (!ROOMS.includes(msg.room)) return;
      c.char = CHARS.includes(msg.char) ? msg.char : CHARS[0];
      c.color = Number.isInteger(msg.color) ? Math.abs(msg.color) % 8 : 0;
      if (typeof msg.visitor === 'string' && /^[a-z0-9]{8,40}$/i.test(msg.visitor)) c.visitor = msg.visitor;
      joinRoom(c, msg.room);
      return;
    }
    case 'hello': {
      if (c.helloed) return;
      c.helloed = true;
      if (typeof msg.visitor === 'string' && /^[a-z0-9]{8,40}$/i.test(msg.visitor)) c.visitor = msg.visitor;
      countVisitor(c.visitor);
      return;
    }
    case 'stat': {
      // 승차권 발급·인증 카드 만들기 등. 한 연결에서 종류별로 최대 5번까지만 셉니다.
      if (!STAT_KINDS.includes(msg.k)) return;
      c.stats[msg.k] = (c.stats[msg.k] || 0) + 1;
      if (c.stats[msg.k] <= 5) bump(msg.k);
      return;
    }
    case 'leave':
      leaveRoom(c);
      return;
    case 'cheer': {
      if (c.seat == null || now - c.lastCheer < 600) return;
      c.lastCheer = now;
      const room = rooms[c.room];
      const ev = currentEventOf(room.key);
      if (ev) {
        counts.cheers[ev.key] = (counts.cheers[ev.key] || 0) + 1;
        countsDirty = true;
        bump('cheer');
      }
      if (c.seat <= PEOPLE_IN_SNAPSHOT) room.fx.push(['cheer', c.seat]);
      room.dirty = true;
      return;
    }
    case 'ritual': {
      // 풍등(정동진) / 종이배(정서진). 적은 글은 서버로 보내지 않습니다.
      if (c.seat == null || now - c.lastRitual < 8000) return;
      c.lastRitual = now;
      bump('ritual');
      if (c.seat <= PEOPLE_IN_SNAPSHOT) rooms[c.room].fx.push(['ritual', c.seat]);
      return;
    }
    default:
  }
}

// ---------- HTTP (정적 파일 + 상태 API) ----------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/status') {
    const body = Object.fromEntries(
      Object.values(rooms).map((r) => {
        const s = roomSnapshot(r);
        return [r.key, { seated: s.seated, waiting: s.waiting, cheers: s.cheers, witnesses: s.witnesses }];
      }),
    );
    res.writeHead(200, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ online: clients.size, seats: SEATS, rooms: body }));
    return;
  }
  if (url.pathname === '/api/weather') {
    res.writeHead(200, { 'Content-Type': MIME['.json'], 'Cache-Control': 'public, max-age=60' });
    res.end(JSON.stringify(weatherStatus()));
    return;
  }
  if (url.pathname === '/api/stats') {
    const days = Object.keys(counts.daily).sort().reverse().slice(0, 30);
    const total = { visitors: 0, ticket: 0, card: 0, save: 0, preview: 0, cheer: 0, ritual: 0, peak: 0 };
    for (const k of Object.keys(counts.daily)) {
      const d = counts.daily[k];
      for (const f of Object.keys(total)) total[f] = f === 'peak' ? Math.max(total.peak, d.peak || 0) : total[f] + (d[f] || 0);
    }
    const live = Object.fromEntries(
      Object.values(rooms).map((r) => {
        const sn = roomSnapshot(r, false);
        return [r.key, { seated: sn.seated, waiting: sn.waiting, eventKey: sn.eventKey, cheers: sn.cheers, witnesses: sn.witnesses }];
      }),
    );
    res.writeHead(200, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ now: new Date().toISOString(), online: clients.size, seats: SEATS, live, total, days: days.map((k) => ({ date: k, ...counts.daily[k] })) }));
    return;
  }
  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }

  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403);
    res.end();
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (!err && filePath.endsWith('index.html')) {
      const proto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0];
      const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').replace(/[^a-zA-Z0-9.:-]/g, '');
      if (host) data = Buffer.from(String(data).replace('content="og.png"', `content="${proto}://${host}/og.png"`));
    }
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('찾을 수 없습니다');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      // 고칠 때마다 바로 반영되도록 항상 새로 확인 (이미지·글꼴만 잠시 보관)
      'Cache-Control': ['.png', '.svg', '.ico'].includes(ext) ? 'public, max-age=300' : 'no-cache',
    });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 2048 });

wss.on('connection', (ws, req) => {
  const ip = clientIp(req);
  if (clients.size >= MAX_CLIENTS || (perIp.get(ip) || 0) >= MAX_PER_IP) {
    send(ws, { t: 'full' });
    ws.close();
    return;
  }
  perIp.set(ip, (perIp.get(ip) || 0) + 1);
  const c = {
    id: nextId++,
    ws,
    visitor: 'anon' + Math.random().toString(36).slice(2, 12),
    room: null,
    seat: null,
    queued: false,
    char: CHARS[0],
    color: 0,
    lastCheer: 0,
    lastRitual: 0,
    alive: true,
    helloed: false,
    stats: {},
  };
  clients.add(c);
  notePeak();
  send(ws, { t: 'welcome', id: c.id, seats: SEATS });

  ws.on('pong', () => {
    c.alive = true;
  });
  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg && typeof msg.t === 'string') handle(c, msg);
  });
  ws.on('close', () => {
    leaveRoom(c);
    clients.delete(c);
    const n = (perIp.get(ip) || 1) - 1;
    if (n <= 0) perIp.delete(ip);
    else perIp.set(ip, n);
  });
});

// 응답 없는 연결 정리
setInterval(() => {
  for (const c of clients) {
    if (!c.alive) {
      c.ws.terminate();
      continue;
    }
    c.alive = false;
    c.ws.ping();
  }
}, 30000).unref();

function shutdown() {
  countsDirty = true;
  saveCounts();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

startWeather();

server.listen(PORT, () => {
  console.log(`방구석 해돋이호 운행 시작: http://localhost:${PORT}  (방마다 좌석 ${SEATS}석)`);
});
