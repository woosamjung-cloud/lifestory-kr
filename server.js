// 이불 밖은 추우니까 (방구석 해돋이호) 서버
// - public/ 폴더의 화면 파일을 보여주고
// - WebSocket(/ws)으로 좌석, 대기열, "와!" 함성, 풍등·유리병 편지 효과를 실시간으로 나눕니다.
// 실행: npm install && npm start  (기본 주소 http://localhost:3000)

import { cleanCustom, CUSTOM_GAP_MS } from './saycheck.js';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { nextEventAt, dateKey, PLACES } from './public/js/sun.js';
import { startWeather, weatherStatus } from './weather.js';
import * as shop from './shop.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'counts.json');

const PORT = Number(process.env.PORT || 3000);
// 배포 버전 (Render는 커밋 번호를 알려줌). 바뀌면 접속자 화면이 새 버전으로 다시 열림
const VERSION = process.env.RENDER_GIT_COMMIT || String(Date.now());
const SEATS = Math.max(1, Number(process.env.SEATS || 1000)); // 장소(방)마다 좌석 수
const MAX_CLIENTS = Number(process.env.MAX_CLIENTS || 20000); // 서버 전체 접속 상한
const MAX_PER_IP = Number(process.env.MAX_PER_IP || 30); // 한 IP에서 동시 접속 상한 (회사·학교 와이파이 고려)
const PEOPLE_IN_SNAPSHOT = 150; // 화면에 그릴 수 있는 앞쪽 좌석만 보냅니다.
const CHARS = ['blanket', 'hood', 'scarf', 'beanie', 'coat']; // public/js/characters.js 의 CHAR_LIST 순서와 같아야 함
const ROOMS = ['east', 'west'];
const WITNESS_BEFORE_MS = 30 * 60 * 1000; // 이벤트 30분 전부터
const WITNESS_AFTER_MS = 20 * 60 * 1000; // 이벤트 20분 후까지 자리에 있으면 "함께 본 사람"

// ---------- 집계 저장 (함성 수, 함께 본 사람 수) ----------
let counts = { cheers: {}, witnesses: {}, daily: {}, wood: {} };
try {
  counts = { cheers: {}, witnesses: {}, daily: {}, wood: {}, ...JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) };
} catch (err) {
  // 처음 실행이면 파일이 없음. 깨져 있으면 옆에 보관
  if (err.code !== 'ENOENT') {
    try {
      fs.copyFileSync(DATA_FILE, `${DATA_FILE}.broken-${Date.now()}`);
    } catch {
      /* 보관 실패 */
    }
  }
}
const witnessSets = new Map(); // eventKey -> Set(visitorId)
let countsDirty = false;

// ---------- 하루 통계 (개인정보 없이 숫자만) ----------
// visitors: 하루 동안 접속한 기기 수 (기기마다 만든 무작위 번호로 중복 제거, 번호 자체는 저장하지 않음)
// 한마디를 주고받은 두 사람 (순서 상관없이 같은 짝) - 30분 동안 하트를 주고받을 수 있음
const TALK_MS = 30 * 60 * 1000;
// 별명: 빈 값이면 지움, 걸러지면 그대로 둠
function setNick(c, raw) {
  if (raw == null || raw === '') {
    c.nick = '';
    return true;
  }
  const r = cleanCustom(String(raw).slice(0, 20));
  if (r.error || [...r.text].length > 10) return false;
  c.nick = r.text;
  return true;
}
// 강아지·고양이 이름 (8자, 별명과 같은 거름망)
function setPetName(c, raw) {
  if (raw == null || raw === '') {
    c.petName = '';
    return true;
  }
  const r = cleanCustom(String(raw).slice(0, 16));
  if (r.error || [...r.text].length > 8) return false;
  c.petName = r.text;
  return true;
}
// 머리 위 이름표: 본인이 켠 경우에만 [별명, 친구 이름]
function labelOf(c) {
  if (!c.tag) return null;
  const nick = c.nick || '';
  const pet = c.pet ? c.petName || '' : '';
  return nick || pet ? [nick, pet] : null;
}
function markLabel(c) {
  const room = c.room && rooms[c.room];
  if (room && c.seat != null) room.labelDiff.set(c.seat, labelOf(c));
}
function labelsOf(room) {
  const map = {};
  room.seats.forEach((s, i) => {
    const l = s && labelOf(s);
    if (l) map[i] = l;
  });
  return map;
}
const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const STAT_KINDS = ['ticket', 'card', 'save', 'preview', 'musiclink'];
const dailyVisitors = new Map(); // dateKey -> Set(visitorId)  (메모리에만, 하루 지나면 지움)
function today() {
  return dateKey(new Date());
}
function dayStats(key = today()) {
  if (!counts.daily[key]) {
    counts.daily[key] = { visitors: 0, peak: 0, ticket: 0, card: 0, save: 0, preview: 0, cheer: 0, ritual: 0, item: 0, wish: 0 };
    // 오래된 날짜(60일 넘은 것) 정리
    const keys = Object.keys(counts.daily).sort();
    while (keys.length > 60) delete counts.daily[keys.shift()];
    for (const k of dailyVisitors.keys()) if (k !== key) dailyVisitors.delete(k);
  }
  return counts.daily[key];
}
function bump(field, n = 1) {
  const d = dayStats();
  d[field] = (d[field] || 0) + n;
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
      labelDiff: new Map(), // 바뀐 이름표 (좌석 -> [별명, 친구 이름] 또는 null), 1초마다 모아서 보냄
      dirty: true,
    },
  ]),
);

let nextId = 1;
const clients = new Set();
const perIp = new Map();
const customSayAt = new Map(); // visitor → 마지막으로 직접 쓴 한마디 시각
const customSayIp = new Map(); // ip → 최근 1시간 직접 쓴 한마디 시각들
setInterval(() => {
  const now = Date.now();
  for (const [k, t] of customSayAt) if (now - t > CUSTOM_GAP_MS) customSayAt.delete(k);
  for (const [k, l] of customSayIp) if (!l.some((t) => now - t < 3600e3)) customSayIp.delete(k);
}, 600e3).unref();

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
  c.pos = null; // 걸어간 자리 (없으면 원래 좌석)
  c.queued = false;
  send(c.ws, { t: 'seat', seat: idx });
  send(c.ws, { t: 'labels', map: labelsOf(room) });
  markLabel(c);
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
  if (c.seat != null && room.seats[c.seat] === c) {
    room.seats[c.seat] = null;
    room.labelDiff.set(c.seat, null);
  }
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
      if (c) {
        // 지금 켜 둔 아이템 표시: 촛불 1, 후레쉬 2, 큰 캠프파이어 4
        // 우비 8 (비·눈 오는 날 화면에서 입음)
        const flags = (c.show.candle && shop.hasItem(c.visitor, 'candle') ? 1 : 0) | (c.show.bigfire && shop.hasItem(c.visitor, 'bigfire') ? 4 : 0) | (shop.hasItem(c.visitor, 'raincoat') ? 8 : 0);
        // 모습 코드 = 반려동물*384 + 머리색*64 + 모습*8 + 옷색
        const code = (c.pet || 0) * 384 + (c.hair || 0) * 64 + CHARS.indexOf(c.char) * 8 + c.color;
        // [좌석, 모습 코드, 아이템 표시, 걸어간 x, 걸어간 y(0~1000)]
        if (c.pos) people.push([i, code, flags, c.pos[0], c.pos[1], c.up ? 1 : 0]);
        else people.push(flags ? [i, code, flags] : [i, code]);
      }
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
    wood: ev ? counts.wood[ev.key] || 0 : 0,
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
    if (room.labelDiff.size) {
      const msg = JSON.stringify({ t: 'label', map: Object.fromEntries(room.labelDiff) });
      room.labelDiff.clear();
      for (const c of room.members) if (c.seat != null && c.ws.readyState === c.ws.OPEN) c.ws.send(msg);
    }
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
      c.hair = Number.isInteger(msg.hair) ? Math.abs(msg.hair) % 6 : 0;
      c.pet = Number.isInteger(msg.pet) ? Math.abs(msg.pet) % 10 : 0; // 0 없음, 1~9 품종 (characters.js BREEDS)
      if (typeof msg.visitor === 'string' && /^[a-z0-9]{8,40}$/i.test(msg.visitor)) c.visitor = msg.visitor;
      setNick(c, msg.nick);
      setPetName(c, msg.petName);
      c.tag = msg.tag === true;
      joinRoom(c, msg.room);
      markLabel(c);
      return;
    }
    case 'nick': {
      // 별명 바꾸기 (10자, 욕설·연락처 거름)
      if (now - (c.lastNick || 0) < 3000) return;
      c.lastNick = now;
      const ok = setNick(c, msg.nick);
      const okPet = msg.petName === undefined ? true : setPetName(c, msg.petName);
      if (typeof msg.tag === 'boolean') c.tag = msg.tag;
      markLabel(c);
      send(c.ws, { t: 'nickok', nick: c.nick || '', petName: c.petName || '', error: ok ? (okPet ? null : '그 친구 이름은 쓸 수 없어요') : '그 별명은 쓸 수 없어요' });
      return;
    }
    case 'who': {
      // 가까이 온 사람을 눌렀을 때 그 사람 별명
      const to = Number(msg.seat);
      const room = rooms[c.room];
      if (c.seat == null || !Number.isInteger(to) || !room || !room.seats[to]) return;
      send(c.ws, { t: 'who', seat: to, nick: room.seats[to].nick || '' });
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
    case 'use': {
      // 유료 아이템 사용: 폭죽·후레쉬는 순간 효과, 촛불·큰 캠프파이어는 켜고 끄기
      const item = msg.item;
      if (!shop.SHOW_ITEMS.includes(item) || c.seat == null) return;
      if (!shop.hasItem(c.visitor, item)) {
        send(c.ws, { t: 'need', item });
        return;
      }
      const room = rooms[c.room];
      if (item === 'candle' || item === 'bigfire') {
        c.show[item] = msg.on !== false;
        room.dirty = true;
        return;
      }
      const gap = item === 'fireworks' ? 15000 : 2500;
      if (now - (c.lastUse[item] || 0) < gap) return;
      c.lastUse[item] = now;
      bump('item');
      if (c.seat <= PEOPLE_IN_SNAPSHOT || item === 'fireworks') room.fx.push([item, c.seat]);
      return;
    }
    case 'wish': {
      // 동전 1개를 던지고 정해진 소원 문구를 모두에게 띄움
      const i = Number(msg.i);
      if (c.seat == null || !Number.isInteger(i) || i < 0 || i >= shop.WISHES.length) return;
      if (now - c.lastWish < 3000) return;
      if (!shop.spendCoin(c.visitor)) {
        send(c.ws, { t: 'need', item: 'coins' });
        return;
      }
      c.lastWish = now;
      bump('wish');
      rooms[c.room].fx.push(['wish', c.seat, i]);
      send(c.ws, { t: 'wallet', wallet: shop.wallet(c.visitor) });
      return;
    }
    case 'move': {
      // 해변 걷기: 도착 지점만 받음 (0~1000 정수), 0.4초에 한 번
      const x = Math.round(Number(msg.x));
      const y = Math.round(Number(msg.y));
      if (c.seat == null || !(x >= 0 && x <= 1000 && y >= 0 && y <= 1000)) return;
      if (now - (c.lastMove || 0) < 400) return;
      c.lastMove = now;
      c.pos = [x, y];
      c.up = true; // 걸어가면 서 있음 (아래로 쓸면 앉음)
      rooms[c.room].dirty = true;
      return;
    }
    case 'sit': {
      if (c.seat == null || !c.up) return;
      c.up = false;
      rooms[c.room].dirty = true;
      return;
    }
    case 'wood': {
      // 장작 넣기: 모두의 장작이 모여 불을 키움, 2.5초에 한 번
      if (c.seat == null || now - (c.lastWood || 0) < 2500) return;
      c.lastWood = now;
      const room = rooms[c.room];
      const ev = currentEventOf(room.key);
      if (ev) {
        counts.wood[ev.key] = (counts.wood[ev.key] || 0) + 1;
        countsDirty = true;
      }
      bump('wood');
      room.fx.push(['wood', c.seat]);
      room.dirty = true;
      return;
    }
    case 'whisper': {
      // 가까이 온 사람에게 한마디: 정해진 문구, 두 사람에게만. 3초에 하나
      const to = Number(msg.seat);
      const i = Number(msg.i);
      const room = rooms[c.room];
      if (c.seat == null || !Number.isInteger(to) || to === c.seat || !room || !room.seats[to]) return;
      if (!Number.isInteger(i) || i < 0 || i >= shop.WHISPERS.length) return;
      if (now - (c.lastWhisper || 0) < 3000) return;
      c.lastWhisper = now;
      const target = room.seats[to];
      room.talks = room.talks || new Map();
      room.talks.set(pairKey(c.visitor, target.visitor), now);
      bump('whisper');
      send(target.ws, { t: 'whisper', from: c.seat, i });
      send(c.ws, { t: 'whisper', from: c.seat, to, i, self: true });
      return;
    }
    case 'heart': {
      // 하트 선물: 가까이(모닥불 불빛 안) 와서 서로 한마디라도 건넨 사람에게만
      // (1.5초에 하나, 같은 사람에게는 10초에 하나)
      const to = Number(msg.seat);
      const room = rooms[c.room];
      if (c.seat == null || !Number.isInteger(to) || to === c.seat || !room || !room.seats[to]) return;
      const talked = room.talks && room.talks.get(pairKey(c.visitor, room.seats[to].visitor));
      if (!talked || now - talked > TALK_MS) {
        send(c.ws, { t: 'need', item: 'talk' });
        return;
      }
      if (now - (c.lastHeart || 0) < 1500) return;
      c.heartTo = c.heartTo || {};
      if (now - (c.heartTo[to] || 0) < 10000) return;
      const target = room.seats[to];
      if (target.visitor === c.visitor) return;
      if (!shop.spendHeart(c.visitor)) {
        send(c.ws, { t: 'need', item: 'hearts' });
        return;
      }
      c.lastHeart = now;
      c.heartTo[to] = now;
      const total = shop.receiveHeart(target.visitor);
      bump('heart');
      room.fx.push(['heart', c.seat, to]);
      send(c.ws, { t: 'wallet', wallet: shop.wallet(c.visitor) });
      send(target.ws, { t: 'gotheart', total, wallet: shop.wallet(target.visitor) });
      return;
    }
    case 'say': {
      // 직접 쓴 한마디: 15자 이내, 기기당 10분에 한 번(같은 IP는 1시간에 20번까지), 욕설·연락처·링크 거름
      if (msg.text != null) {
        if (c.seat == null) return;
        if (now - (c.lastSay || 0) < 10000) return send(c.ws, { t: 'sayno', error: '한마디는 10초에 한 번 할 수 있어요' });
        const lastAt = customSayAt.get(c.visitor) || 0;
        if (now - lastAt < CUSTOM_GAP_MS) return send(c.ws, { t: 'sayno', wait: CUSTOM_GAP_MS - (now - lastAt) });
        const ipHits = (customSayIp.get(c.ip) || []).filter((t) => now - t < 3600e3);
        if (ipHits.length >= 20) return send(c.ws, { t: 'sayno', error: '잠시 후 다시 보내 주세요' });
        const r = cleanCustom(msg.text);
        if (r.error) return send(c.ws, { t: 'sayno', error: r.error });
        customSayAt.set(c.visitor, now);
        ipHits.push(now);
        customSayIp.set(c.ip, ipHits);
        c.lastSay = now;
        bump('say');
        send(c.ws, { t: 'sayok', next: now + CUSTOM_GAP_MS });
        rooms[c.room].fx.push(['say', c.seat, -1, shop.sayWeight(c.visitor), r.text]);
        return;
      }
      // 응원 한마디: 정해진 문구만, 10초에 한 번
      const i = Number(msg.i);
      if (c.seat == null || !Number.isInteger(i) || i < 0 || i >= shop.SAYINGS.length) return;
      if (now - (c.lastSay || 0) < 10000) return;
      c.lastSay = now;
      bump('say');
      rooms[c.room].fx.push(['say', c.seat, i, shop.sayWeight(c.visitor)]);
      return;
    }
    case 'ritual': {
      // 풍등(정동진) / 유리병 편지(정서진). 적은 글은 서버로 보내지 않습니다.
      if (c.seat == null || now - c.lastRitual < 8000) return;
      // 동전 1개를 쓰면 고른 소원 문구가 풍등·유리병 편지에 적혀 모두에게 보임
      const wi = Number(msg.i);
      const wishList = PLACES[c.room] && PLACES[c.room].kind === 'sunset' ? shop.LETTERS : shop.WISHES; // 해넘이 쪽은 그리운 이에게 편지
      const hasWish = msg.i != null && Number.isInteger(wi) && wi >= 0 && wi < wishList.length;
      if (hasWish && !shop.spendCoin(c.visitor)) {
        send(c.ws, { t: 'need', item: 'coins' });
        return;
      }
      c.lastRitual = now;
      bump('ritual');
      if (hasWish) {
        bump('wish');
        send(c.ws, { t: 'wallet', wallet: shop.wallet(c.visitor) });
        rooms[c.room].fx.push(['ritual', c.seat, wi]);
      } else if (c.seat <= PEOPLE_IN_SNAPSHOT) rooms[c.room].fx.push(['ritual', c.seat]);
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
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

// POST 본문(JSON) 읽기 (최대 4KB)
function readJson(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (ch) => {
      if (data === null) return;
      data += ch;
      if (data.length > 4096) {
        data = null; // 너무 큼: 더 모으지 않고 413으로 답함
        resolve(null);
      }
    });
    req.on('end', () => {
      if (data === null) return;
      try {
        resolve(JSON.parse(data || '{}'));
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}
function json(res, code, body) {
  res.writeHead(code, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}
const postHits = new Map(); // IP별 분당 요청 수 제한
setInterval(() => postHits.clear(), 60000).unref();

// 메일 링크에 넣을 사이트 주소 (도메인을 연결하면 PUBLIC_URL 환경변수로 고정)
function publicOrigin(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  // Host는 Render가 이 서비스로 보낸 주소라 믿을 수 있음 (x-forwarded-host는 누구나 넣을 수 있어 쓰지 않음)
  const host = String(req.headers.host || 'localhost').split(',')[0].trim().toLowerCase();
  const safe = /^[a-z0-9.-]+(:\d{1,5})?$/.test(host) ? host : 'localhost';
  const proto = String(req.headers['x-forwarded-proto'] || '').startsWith('https') || safe.endsWith('.onrender.com') ? 'https' : 'http';
  return `${proto}://${safe}`;
}

async function handleShop(req, res, url) {
  const route = url.pathname.slice('/api/shop'.length) || '/';
  if (req.method === 'GET' && route === '/') {
    const visitor = url.searchParams.get('visitor');
    return json(res, 200, { ...shop.shopPublicInfo(), wallet: shop.wallet(visitor) });
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'POST만 가능해요' });
  const ip = clientIp(req);
  const hits = (postHits.get(ip) || 0) + 1;
  postHits.set(ip, hits);
  if (hits > 40) return json(res, 429, { error: '잠시 후 다시 시도해 주세요' });
  if (shop.shopMode() === 'off') return json(res, 403, { error: '상점이 닫혀 있어요' });
  const body = await readJson(req);
  if (body === null) {
    res.writeHead(413, { 'Content-Type': MIME['.json'], Connection: 'close' });
    res.end(JSON.stringify({ error: '요청이 너무 커요' }));
    return;
  }
  if (typeof body !== 'object' || Array.isArray(body)) return json(res, 400, { error: '잘못된 요청이에요' });
  let r;
  if (route === '/order') r = shop.createOrder(body.visitor, body.product, body.currency === 'USD' ? 'USD' : 'KRW');
  else if (route === '/paypal/create') r = await shop.paypalCreate(body.orderId);
  else if (route === '/login') r = await shop.loginStart(body.email, body.visitor, publicOrigin(req));
  else if (route === '/verify') r = shop.loginVerify(body.token, body.visitor);
  else if (route === '/confirm') r = await shop.confirmOrder(body);
  else if (route === '/code') r = shop.recoveryCode(body.visitor);
  else if (route === '/restore') r = shop.restore(body.code);
  else return json(res, 404, { error: '없는 주소예요' });
  return json(res, r.error ? 400 : 200, r);
}

// 보안 헤더: 다른 사이트에 끼워 넣기·내용 추측·주소 새기 막기, 불러올 수 있는 곳을 정해 둠
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://js.tosspayments.com https://www.paypal.com https://*.paypal.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
  "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob:",
  "connect-src 'self' ws: wss: https://*.paypal.com https://*.tosspayments.com",
  "frame-src https://*.paypal.com https://*.tosspayments.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');
function securityHeaders(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), accelerometer=(self), gyroscope=(self)');
  res.setHeader('Content-Security-Policy', CSP);
  if (String(req.headers['x-forwarded-proto'] || '').startsWith('https')) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
}

const server = http.createServer((req, res) => {
  try {
    route(req, res);
  } catch (err) {
    console.error('요청 처리 오류:', err && err.message);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }
});

function route(req, res) {
  securityHeaders(req, res);
  let url;
  try {
    url = new URL(req.url, 'http://localhost');
  } catch {
    res.writeHead(400);
    res.end();
    return;
  }
  if (url.pathname.startsWith('/api/shop')) {
    handleShop(req, res, url).catch(() => json(res, 500, { error: '서버 오류' }));
    return;
  }
  // 소셜 간편 로그인: /auth/kakao/start?visitor=… → 각 회사 로그인 → /auth/kakao/callback → /?login=토큰
  const am = url.pathname.match(/^\/auth\/(kakao|google|naver)\/(start|callback)$/);
  if (am) {
    const origin = publicOrigin(req);
    const go = (loc) => {
      res.writeHead(302, { Location: loc, 'Cache-Control': 'no-store' });
      res.end();
    };
    if (am[2] === 'start') {
      const to = shop.oauthStart(am[1], url.searchParams.get('visitor'), origin);
      return go(to || '/?loginerr=1');
    }
    shop
      .oauthCallback(am[1], url.searchParams.get('code'), url.searchParams.get('state'), origin)
      .then((token) => go(token ? `/?login=${token}` : '/?loginerr=1'))
      .catch(() => go('/?loginerr=1'));
    return;
  }
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
    res.end(JSON.stringify({ now: new Date().toISOString(), online: clients.size, seats: SEATS, live, total, shop: shop.shopStats(), days: days.map((k) => ({ date: k, ...counts.daily[k] })) }));
    return;
  }
  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }

  let rel;
  try {
    rel = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('잘못된 주소예요');
    return;
  }
  if (rel.includes('\0')) {
    res.writeHead(400);
    res.end();
    return;
  }
  if (rel.endsWith('/')) rel += 'index.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403);
    res.end();
    return;
  }
  // 음원은 부분 요청(Range)을 지원해야 아이폰에서 재생됨
  const ext0 = path.extname(filePath);
  if (ext0 === '.m4a' || ext0 === '.mp3') {
    fs.stat(filePath, (err, st) => {
      if (err) {
        res.writeHead(404);
        res.end();
        return;
      }
      const type = MIME[ext0];
      const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
      if (m) {
        const start = m[1] ? Number(m[1]) : Math.max(0, st.size - Number(m[2]));
        const end = m[1] && m[2] ? Math.min(Number(m[2]), st.size - 1) : st.size - 1;
        if (start >= st.size || start > end) {
          res.writeHead(416, { 'Content-Range': `bytes */${st.size}` });
          res.end();
          return;
        }
        res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'Cache-Control': 'public, max-age=86400' });
        fs.createReadStream(filePath, { start, end }).pipe(res);
      } else {
        res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': st.size, 'Cache-Control': 'public, max-age=86400' });
        fs.createReadStream(filePath).pipe(res);
      }
    });
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (!err && filePath.endsWith('index.html')) {
      const proto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0];
      const host = String(req.headers.host || '').replace(/[^a-zA-Z0-9.:-]/g, '');
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
}


// 아주 느리게 보내며 연결을 붙잡는 요청 막기 (헤더 15초, 전체 30초)
server.headersTimeout = 15000;
server.requestTimeout = 30000;
server.keepAliveTimeout = 65000; // Render 앞단보다 길게 (끊김 방지)

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
    ip,
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
    show: { candle: true, bigfire: true },
    lastUse: {},
    lastWish: 0,
  };
  clients.add(c);
  notePeak();
  send(ws, { t: 'welcome', id: c.id, seats: SEATS, version: VERSION });

  ws.on('pong', () => {
    c.alive = true;
  });
  let burst = 0;
  let burstAt = Date.now();
  let strikes = 0;
  ws.on('message', (raw) => {
    const t = Date.now();
    if (t - burstAt > 1000) {
      strikes = burst > 20 ? strikes + 1 : 0;
      burst = 0;
      burstAt = t;
      if (strikes >= 3) {
        ws.close(1008, 'too many messages');
        return;
      }
    }
    if (++burst > 40) return; // 1초에 40개 넘는 건 버림
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (!msg || typeof msg !== 'object' || typeof msg.t !== 'string' || msg.t.length > 20) return;
    try {
      handle(c, msg);
    } catch (err) {
      console.error('메시지 처리 오류:', msg.t, err && err.message);
    }
  });
  ws.on('close', () => {
    leaveRoom(c);
    clients.delete(c);
    const n = (perIp.get(ip) || 1) - 1;
    if (n <= 0) perIp.delete(ip);
    else perIp.set(ip, n);
  });
});

// 한마디 나눈 짝 기록은 30분 지나면 지움 (오래 켜 둬도 쌓이지 않게)
setInterval(() => {
  const now = Date.now();
  for (const room of Object.values(rooms)) {
    if (!room.talks) continue;
    for (const [k, t] of room.talks) if (now - t > TALK_MS) room.talks.delete(k);
  }
}, 5 * 60 * 1000).unref();

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
  shop.saveShop(true);
  process.exit(0);
}
process.on('unhandledRejection', (err) => console.error('처리되지 않은 오류:', err && err.message));
process.on('uncaughtException', (err) => {
  console.error('예상 못 한 오류, 저장 후 재시작:', err && err.stack);
  try {
    countsDirty = true;
    saveCounts();
    shop.saveShop(true);
  } catch {
    /* 저장 실패 */
  }
  process.exit(1);
});
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

startWeather();
shop.initShop(DATA_DIR);

server.listen(PORT, () => {
  console.log(`방구석 해돋이호 운행 시작: http://localhost:${PORT}  (방마다 좌석 ${SEATS}석)`);
});
