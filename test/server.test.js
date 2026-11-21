import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import WebSocket from 'ws';

const PORT = 3900 + Math.floor(Math.random() * 90);
let proc;
// 실행할 때마다 새 저장 폴더 (지난 실행의 동전·함성 기록이 섞이지 않게)
const DATA_DIR = fs.mkdtempSync('/tmp/haedoti-test-');

before(async () => {
  proc = spawn(process.execPath, ['server.js'], {
    env: { ...process.env, PORT: String(PORT), SEATS: '2', MAX_PER_IP: '4', DATA_DIR },
    stdio: ['ignore', 'ignore', process.env.TEST_SERVER_LOG ? fs.openSync(process.env.TEST_SERVER_LOG, 'a') : 'ignore'],
  });
  for (let i = 0; i < 50; i++) {
    try {
      await fetch(`http://localhost:${PORT}/healthz`);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
});
after(async () => {
  // 서버가 종료하면서 파일을 다 쓴 뒤에 폴더 삭제
  const exited = new Promise((r) => proc.once('exit', r));
  proc.kill();
  await exited;
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
});
// 앞 테스트의 연결이 서버에서 완전히 정리된 뒤 다음 테스트 시작 (IP당 접속 제한에 걸리지 않게)
afterEach(async () => {
  for (let i = 0; i < 40; i++) {
    const st = await (await fetch(`http://localhost:${PORT}/api/status`)).json();
    if (st.online === 0) return;
    await new Promise((r) => setTimeout(r, 100));
  }
});

function client() {
  const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
  ws.inbox = [];
  ws.on('message', (d) => ws.inbox.push(JSON.parse(d)));
  return new Promise((res) => ws.on('open', () => res(ws)));
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const last = (ws, t) => ws.inbox.filter((m) => m.t === t).pop();

test('좌석이 차면 대기열, 자리가 나면 자동 착석', async () => {
  const [a, b, c] = await Promise.all([client(), client(), client()]);
  for (const [i, ws] of [a, b, c].entries()) ws.send(JSON.stringify({ t: 'join', room: 'east', char: 'cat', color: i }));
  await wait(600);
  assert.equal(last(a, 'seat').seat, 0);
  assert.equal(last(b, 'seat').seat, 1);
  assert.equal(last(c, 'queue').pos, 1);
  a.close();
  await wait(600);
  assert.equal(last(c, 'seat').seat, 0);
  b.close();
  c.close();
});

test('함성은 집계되고 다른 승객에게 전달됨', async () => {
  const [a, b] = await Promise.all([client(), client()]);
  a.send(JSON.stringify({ t: 'join', room: 'west', char: 'bear', color: 1 }));
  b.send(JSON.stringify({ t: 'join', room: 'west', char: 'otter', color: 2 }));
  await wait(600);
  a.send('{"t":"cheer"}');
  a.send('{"t":"cheer"}'); // 0.6초 안의 연타는 무시
  await wait(1600);
  const fx = b.inbox.filter((m) => m.t === 'fx').flatMap((m) => m.list);
  assert.equal(fx.filter(([k]) => k === 'cheer').length, 1);
  const room = last(b, 'room');
  assert.equal(room.cheers, 1);
  assert.equal(room.seated, 2);
  assert.deepEqual(room.people.map((p) => p[0]).sort(), [0, 1]);
  a.close();
  b.close();
});

test('잘못된 메시지는 무시하고 한 IP 접속 수를 제한함', async () => {
  const socks = await Promise.all([client(), client(), client(), client()]);
  socks[0].send('not json');
  socks[0].send(JSON.stringify({ t: 'join', room: 'mars' }));
  const extra = await client();
  await wait(600);
  assert.equal(last(extra, 'full')?.t, 'full');
  const st = await (await fetch(`http://localhost:${PORT}/api/status`)).json();
  assert.equal(st.rooms.east.seated + st.rooms.west.seated, 0);
  for (const s of [...socks, extra]) s.close();
});

test('첫 화면의 공유 이미지 주소는 절대 주소로 바뀜', async () => {
  const html = await (await fetch(`http://localhost:${PORT}/`)).text();
  assert.match(html, new RegExp(`content="http://localhost:${PORT}/og.png"`));
});

test('public 밖의 파일은 읽을 수 없음', async () => {
  const r = await fetch(`http://localhost:${PORT}/..%2fserver.js`);
  assert.notEqual(r.status, 200);
});

test('하루 통계: 방문 기기 중복 제거, 종류별 상한, 잘못된 종류 무시', async () => {
  const a = await client();
  a.send(JSON.stringify({ t: 'hello', visitor: 'statvisitor01' }));
  for (let i = 0; i < 8; i++) a.send(JSON.stringify({ t: 'stat', k: 'ticket' }));
  a.send(JSON.stringify({ t: 'stat', k: 'hack' }));
  const b = await client();
  b.send(JSON.stringify({ t: 'hello', visitor: 'statvisitor01' })); // 같은 기기
  await wait(600);
  const s = await (await fetch(`http://localhost:${PORT}/api/stats`)).json();
  const d = s.days[0];
  assert.equal(d.ticket, 5);
  assert.equal(d.visitors, 1);
  assert.equal(d.hack, undefined);
  assert.ok(d.peak >= 2);
  a.close();
  b.close();
});

const post = (path, body) =>
  fetch(`http://localhost:${PORT}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, body: await r.json() }));

test('상점: 테스트 결제로 아이템·동전 지급, 금액 위조 거부, 복구 코드', async () => {
  const visitor = 'shoptester01';
  const info = await (await fetch(`http://localhost:${PORT}/api/shop?visitor=${visitor}`)).json();
  assert.equal(info.mode, 'test');
  assert.equal(info.wallet.coins, 0);
  // 금액을 바꿔서 확인 요청하면 거부
  const o1 = await post('/api/shop/order', { visitor, product: 'fireworks' });
  assert.equal(o1.body.amount, 2000);
  const bad = await post('/api/shop/confirm', { orderId: o1.body.orderId, paymentKey: 'x', amount: 10 });
  assert.equal(bad.status, 400);
  // 정상 확인
  const ok = await post('/api/shop/confirm', { orderId: o1.body.orderId, paymentKey: 'test', amount: 2000 });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.wallet.items.fireworks > Date.now() + 29 * 86400e3);
  // 같은 주문을 두 번 확인해도 한 번만 지급
  const again = await post('/api/shop/confirm', { orderId: o1.body.orderId, paymentKey: 'test', amount: 2000 });
  assert.equal(again.body.already, true);
  // 동전
  const o2 = await post('/api/shop/order', { visitor, product: 'coins10' });
  const c2 = await post('/api/shop/confirm', { orderId: o2.body.orderId, paymentKey: 'test', amount: 1000 });
  assert.equal(c2.body.wallet.coins, 11);
  // 큰 묶음은 내 동전에 쌓이고, 상품 정보에 정가·할인 근거가 있음
  const o3 = await post('/api/shop/order', { visitor, product: 'coins130' });
  assert.equal(o3.body.amount, 10000);
  const c3 = await post('/api/shop/confirm', { orderId: o3.body.orderId, paymentKey: 'test', amount: 10000 });
  assert.equal(c3.body.wallet.coins, 141);
  const tiers = Object.values(info.products).filter((p) => p.group === 'coins').sort((x, y) => x.price - y.price);
  assert.ok(tiers.length >= 4);
  for (let i = 1; i < tiers.length; i++) assert.ok(tiers[i].price / tiers[i].coins <= tiers[i - 1].price / tiers[i - 1].coins, '많이 살수록 개당 가격이 같거나 싸야 함');
  // 없는 상품
  assert.equal((await post('/api/shop/order', { visitor, product: 'free' })).status, 400);
  // 복구 코드
  const code = (await post('/api/shop/code', { visitor })).body.code;
  assert.match(code, /^[A-Z0-9]{5}-[A-Z0-9]{5}$/);
  const rest = await post('/api/shop/restore', { code: code.toLowerCase() });
  assert.equal(rest.body.visitor, visitor);
  assert.equal(rest.body.wallet.coins, 141);
});

test('동전 소원은 동전을 쓰고 모두에게 전달, 아이템이 없으면 사용 불가', async () => {
  const visitor = 'shoptester02';
  const o = await post('/api/shop/order', { visitor, product: 'coins10' });
  await post('/api/shop/confirm', { orderId: o.body.orderId, paymentKey: 'test', amount: 1000 });
  const [a, b] = await Promise.all([client(), client()]);
  a.send(JSON.stringify({ t: 'hello', visitor }));
  a.send(JSON.stringify({ t: 'join', room: 'west', char: 'scarf', color: 1, visitor }));
  b.send(JSON.stringify({ t: 'join', room: 'west', char: 'hood', color: 2 }));
  await wait(600);
  a.send(JSON.stringify({ t: 'wish', i: 0 }));
  a.send(JSON.stringify({ t: 'use', item: 'fireworks' })); // 폭죽은 산 적 없음
  await wait(800);
  assert.equal(last(a, 'wallet').wallet.coins, 10);
  assert.equal(last(a, 'need').item, 'fireworks');
  const fx = b.inbox.filter((m) => m.t === 'fx').flatMap((m) => m.list);
  assert.ok(fx.some(([k, , i]) => k === 'wish' && i === 0));
  a.close();
  b.close();
});

test('동전 소원 풍등: 동전을 쓰면 소원 번호가 함께 전달, 머리색·반려동물 코드 압축', async () => {
  const visitor = 'shoptester03';
  const o = await post('/api/shop/order', { visitor, product: 'coins10' });
  await post('/api/shop/confirm', { orderId: o.body.orderId, paymentKey: 'test', amount: 1000 });
  const [a, b] = await Promise.all([client(), client()]);
  a.send(JSON.stringify({ t: 'hello', visitor }));
  a.send(JSON.stringify({ t: 'join', room: 'east', char: 'scarf', color: 3, hair: 4, pet: 2, visitor }));
  b.send(JSON.stringify({ t: 'join', room: 'east', char: 'hood', color: 1 }));
  await wait(1200);
  a.send(JSON.stringify({ t: 'ritual', i: 2 }));
  await wait(900);
  assert.equal(last(a, 'wallet').wallet.coins, 10);
  const fx = b.inbox.filter((m) => m.t === 'fx').flatMap((m) => m.list);
  assert.ok(fx.some(([k, , i]) => k === 'ritual' && i === 2));
  const room = last(b, 'room');
  const mine = room.people.find(([, code]) => code >= 384);
  assert.equal(mine[1], 2 * 384 + 4 * 64 + 2 * 8 + 3); // 고양이, 빨강 머리, 목도리, 옷색 3
  a.close();
  b.close();
});

test('응원 한마디: 정해진 문구만, 10초에 한 번만 전달', async () => {
  const [a, b] = await Promise.all([client(), client()]);
  a.send(JSON.stringify({ t: 'join', room: 'west', char: 'coat', color: 0 }));
  b.send(JSON.stringify({ t: 'join', room: 'west', char: 'hood', color: 1 }));
  await wait(600);
  a.send(JSON.stringify({ t: 'say', i: 1 }));
  a.send(JSON.stringify({ t: 'say', i: 2 })); // 연타 → 무시
  a.send(JSON.stringify({ t: 'say', i: 999 })); // 없는 문구 → 무시
  a.send(JSON.stringify({ t: 'say', text: '자유 글' })); // 10초 안에 또 → 무시
  await wait(800);
  const says = b.inbox.filter((m) => m.t === 'fx').flatMap((m) => m.list).filter(([k]) => k === 'say');
  assert.equal(says.length, 1);
  assert.equal(says[0][2], 1);
  a.close();
  b.close();
});

test('직접 쓴 한마디: 15자·필터 통과 시 전달, 10분에 한 번, 남은 시간 안내', async () => {
  const [a, b] = await Promise.all([client(), client()]);
  a.send(JSON.stringify({ t: 'hello', visitor: 'customsay01' }));
  a.send(JSON.stringify({ t: 'join', room: 'east', char: 'coat', color: 0, visitor: 'customsay01' }));
  b.send(JSON.stringify({ t: 'join', room: 'east', char: 'hood', color: 1 }));
  await wait(600);
  a.send(JSON.stringify({ t: 'say', text: '010-1234-5678' })); // 연락처 → 거절
  await wait(300);
  assert.ok(last(a, 'sayno').error);
  a.send(JSON.stringify({ t: 'say', text: '노을 정말 예쁘다' }));
  await wait(600);
  assert.ok(last(a, 'sayok').next > Date.now() + 9 * 60e3);
  const says = b.inbox.filter((m) => m.t === 'fx').flatMap((m) => m.list).filter(([k]) => k === 'say');
  assert.equal(says.length, 1);
  assert.equal(says[0][2], -1);
  assert.equal(says[0][4], '노을 정말 예쁘다');
  a.send(JSON.stringify({ t: 'say', text: '열여섯글자가넘는아주긴한마디입니다요' }));
  await wait(300);
  assert.ok(last(a, 'sayno'));
  a.close();
  b.close();
});

test('해변 걷기 위치 전달, 장작은 모두 합산·연타 무시', async () => {
  const [a, b] = await Promise.all([client(), client()]);
  a.send(JSON.stringify({ t: 'join', room: 'east', char: 'coat', color: 0 }));
  b.send(JSON.stringify({ t: 'join', room: 'east', char: 'hood', color: 1 }));
  await wait(600);
  a.send(JSON.stringify({ t: 'move', x: 300, y: 700 }));
  a.send(JSON.stringify({ t: 'move', x: 5000, y: 1 })); // 범위 밖 → 무시
  a.send(JSON.stringify({ t: 'wood' }));
  a.send(JSON.stringify({ t: 'wood' })); // 연타 → 무시
  b.send(JSON.stringify({ t: 'wood' }));
  await wait(1600);
  const room = last(b, 'room');
  const moved = room.people.find((p) => p.length === 6);
  assert.deepEqual(moved.slice(3), [300, 700, 1]); // 걸어가면 서 있음
  a.send(JSON.stringify({ t: 'sit' }));
  await wait(1300);
  const sat = last(b, 'room').people.find((p) => p.length === 6);
  assert.equal(sat[5], 0); // 아래로 쓸면 앉음
  assert.equal(room.wood, 2);
  const fx = b.inbox.filter((m) => m.t === 'fx').flatMap((m) => m.list).filter(([k]) => k === 'wood');
  assert.ok(fx.length >= 1);
  a.close();
  b.close();
});

test('하트: 마음껏 주고, 받은 사람에게 알림·집계, 같은 사람에게 연타는 무시, 한마디 무게 전달', async () => {
  const [a, b] = await Promise.all([client(), client()]);
  a.send(JSON.stringify({ t: 'hello', visitor: 'hearttest01' }));
  b.send(JSON.stringify({ t: 'hello', visitor: 'hearttest02' }));
  a.send(JSON.stringify({ t: 'join', room: 'east', char: 'coat', color: 0, visitor: 'hearttest01' }));
  b.send(JSON.stringify({ t: 'join', room: 'east', char: 'hood', color: 1, visitor: 'hearttest02' }));
  await wait(700);
  const bSeat = last(b, 'seat').seat;
  a.send(JSON.stringify({ t: 'heart', seat: bSeat }));
  a.send(JSON.stringify({ t: 'heart', seat: bSeat })); // 연타 → 무시
  a.send(JSON.stringify({ t: 'heart', seat: last(a, 'seat').seat })); // 나에게 → 무시
  await wait(700);
  assert.equal(last(b, 'gotheart').total, 1);
  assert.equal(last(a, 'wallet').wallet.hearts.given, 1);
  b.send(JSON.stringify({ t: 'say', i: 0 }));
  await wait(700);
  const say = a.inbox.filter((m) => m.t === 'fx').flatMap((m) => m.list).find(([k]) => k === 'say');
  assert.ok(say[3] >= 1);
  a.close();
  b.close();
});
