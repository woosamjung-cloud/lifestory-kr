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
    env: { ...process.env, PORT: String(PORT), SEATS: '2', MAX_PER_IP: '4', DATA_DIR, REVIEW_MIN_SEC: '1', POST_LIMIT: '200' },
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

test('이메일 간편 로그인: 테스트 모드는 링크를 바로 주고, 다른 기기에서 로그인하면 동전·아이템이 합쳐짐', async () => {
  const phone = 'loginphone01';
  const laptop = 'loginlaptop1';
  // 휴대폰에서 동전 구매 후 로그인
  const o = await post('/api/shop/order', { visitor: phone, product: 'coins10' });
  await post('/api/shop/confirm', { orderId: o.body.orderId, paymentKey: 'test', amount: 1000 });
  assert.equal((await post('/api/shop/login', { email: 'bad', visitor: phone })).status, 400);
  const l1 = await post('/api/shop/login', { email: 'Tester@Example.com', visitor: phone });
  assert.equal(l1.status, 200);
  const tok1 = new URL(l1.body.devLink).searchParams.get('login');
  const v1 = await post('/api/shop/verify', { token: tok1, visitor: phone });
  assert.equal(v1.body.visitor, phone);
  assert.match(v1.body.email, /^te\*+@example\.com$/);
  assert.equal(v1.body.wallet.coins, 11);
  // 같은 링크는 한 번만
  assert.equal((await post('/api/shop/verify', { token: tok1, visitor: phone })).status, 400);
  // 노트북에서 폭죽을 산 뒤 같은 이메일로 로그인 → 휴대폰 계정으로 합쳐짐
  const o2 = await post('/api/shop/order', { visitor: laptop, product: 'fireworks' });
  await post('/api/shop/confirm', { orderId: o2.body.orderId, paymentKey: 'test', amount: 2000 });
  // 1분 안에 같은 이메일로 또 요청하면 막힘 → 테스트에서는 다른 이메일 대소문자도 같은 사람으로 취급되는지만 확인
  const again = await post('/api/shop/login', { email: 'tester@example.com', visitor: laptop });
  assert.equal(again.status, 400);
});

test('해외 결제: 달러 가격은 서버가 정하고, 소액 묶음은 달러로 팔지 않음', async () => {
  const visitor = 'usdbuyer0001';
  const info = await (await fetch(`http://localhost:${PORT}/api/shop?visitor=${visitor}`)).json();
  assert.equal(info.products.coins5.usd, null);
  assert.ok(info.products.coins33.usd >= 2.99);
  assert.equal((await post('/api/shop/order', { visitor, product: 'coins5', currency: 'USD' })).status, 400);
  const o = await post('/api/shop/order', { visitor, product: 'coins33', currency: 'USD' });
  assert.equal(o.body.currency, 'USD');
  assert.equal(o.body.amount, info.products.coins33.usd);
  const bad = await post('/api/shop/confirm', { orderId: o.body.orderId, amount: 0.5 });
  assert.equal(bad.status, 400);
  const ok = await post('/api/shop/confirm', { orderId: o.body.orderId, paymentKey: 'test', amount: o.body.amount });
  assert.equal(ok.body.wallet.coins, 35);
});

test('별명: 가까이 온 사람이 물으면 알려 주고, 바꿀 수 있고, 나쁜 말은 거름', async () => {
  const [a, b] = await Promise.all([client(), client()]);
  a.send(JSON.stringify({ t: 'join', room: 'west', char: 'coat', color: 0, nick: '노을이' }));
  b.send(JSON.stringify({ t: 'join', room: 'west', char: 'hood', color: 1, nick: '010-1234-5678' }));
  await wait(600);
  const aSeat = last(a, 'seat').seat;
  const bSeat = last(b, 'seat').seat;
  b.send(JSON.stringify({ t: 'who', seat: aSeat }));
  a.send(JSON.stringify({ t: 'who', seat: bSeat }));
  await wait(300);
  assert.equal(last(b, 'who').nick, '노을이');
  assert.equal(last(a, 'who').nick, ''); // 연락처 별명은 안 받음
  a.send(JSON.stringify({ t: 'nick', nick: '해돋이' }));
  await wait(300);
  assert.equal(last(a, 'nickok').nick, '해돋이');
  b.send(JSON.stringify({ t: 'who', seat: aSeat }));
  await wait(300);
  assert.equal(last(b, 'who').nick, '해돋이');
  a.close();
  b.close();
});

test('소셜 로그인: 키가 없으면 버튼도 없고, 시작 주소는 오류로 돌아감', async () => {
  const info = await (await fetch(`http://localhost:${PORT}/api/shop?visitor=oauthtest01`)).json();
  assert.deepEqual(info.auth, []);
  const r = await fetch(`http://localhost:${PORT}/auth/kakao/start?visitor=oauthtest01`, { redirect: 'manual' });
  assert.equal(r.status, 302);
  assert.match(r.headers.get('location'), /loginerr/);
});

test('우비 아이템: 산 사람은 방 정보에 우비 표시(8)가 붙어 다른 사람에게도 보임', async () => {
  const visitor = 'raincoat0001';
  const o = await post('/api/shop/order', { visitor, product: 'raincoat' });
  await post('/api/shop/confirm', { orderId: o.body.orderId, paymentKey: 'test', amount: o.body.amount });
  const [a, b] = await Promise.all([client(), client()]);
  a.send(JSON.stringify({ t: 'hello', visitor }));
  a.send(JSON.stringify({ t: 'join', room: 'east', char: 'coat', color: 0, visitor }));
  b.send(JSON.stringify({ t: 'join', room: 'east', char: 'hood', color: 1 }));
  await wait(1500);
  const aSeat = last(a, 'seat').seat;
  const me = last(b, 'room').people.find((x) => x[0] === aSeat);
  assert.ok(me && (me[2] & 8));
  a.close();
  b.close();
});

test('보안: 깨진 주소에도 서버가 살아 있고, 보안 헤더가 붙고, 폴더 밖 파일은 못 읽음', async () => {
  const bad = await fetch(`http://localhost:${PORT}/%E0%A4%A`);
  assert.equal(bad.status, 400);
  const ok = await fetch(`http://localhost:${PORT}/healthz`);
  assert.equal(ok.status, 200);
  const home = await fetch(`http://localhost:${PORT}/`);
  assert.equal(home.headers.get('x-content-type-options'), 'nosniff');
  assert.match(home.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  const trav = await fetch(`http://localhost:${PORT}/..%2f..%2fpackage.json`);
  assert.ok([403, 404].includes(trav.status));
  const trav2 = await fetch(`http://localhost:${PORT}/%2e%2e/server.js`);
  assert.ok([403, 404].includes(trav2.status));
});

test('이름표: 켠 사람만 [별명, 친구 이름]이 같은 방 사람에게 가고, 끄면 사라짐', async () => {
  const [a, b] = await Promise.all([client(), client()]);
  a.send(JSON.stringify({ t: 'join', room: 'west', char: 'cat', color: 1, pet: 3, nick: '별빛', petName: '콩이', tag: true }));
  await wait(300);
  b.send(JSON.stringify({ t: 'join', room: 'west', char: 'cat', color: 2, pet: 0, nick: '달빛', tag: false }));
  await wait(1300);
  const sa = last(a, 'seat').seat;
  const sb = last(b, 'seat').seat;
  const full = last(b, 'labels').map;
  assert.deepEqual(full[sa], ['별빛', '콩이']);
  assert.equal(full[sb], undefined); // 이름표를 끈 사람은 없음
  // 나쁜 친구 이름은 거절
  a.send(JSON.stringify({ t: 'nick', nick: '별빛', petName: '010-1234-5678' }));
  await wait(300);
  assert.ok(last(a, 'nickok').error);
  // 이름표 끄기 → 다른 사람에게 null
  await wait(3100);
  a.send(JSON.stringify({ t: 'nick', nick: '별빛', tag: false }));
  await wait(1300);
  const diffs = b.inbox.filter((m) => m.t === 'label' && sa in m.map);
  assert.equal(diffs.pop().map[sa], null);
  a.close();
  b.close();
  await wait(200);
});

test('수다톡: 동전 없으면 못 걸고, 수락하면 건 사람 동전 1개, 둘만 보고, 욕설은 가리고 링크는 막고, 신고하면 차단', async () => {
  const visitor = 'talktester01';
  const o = await post('/api/shop/order', { visitor, product: 'coins10' });
  const paid = await post('/api/shop/confirm', { orderId: o.body.orderId, paymentKey: 'test', amount: 1000 });
  const coins0 = paid.body.wallet.coins;
  const [a, b] = await Promise.all([client(), client()]);
  a.send(JSON.stringify({ t: 'hello', visitor }));
  a.send(JSON.stringify({ t: 'join', room: 'west', char: 'scarf', color: 1, visitor, nick: '별빛' }));
  b.send(JSON.stringify({ t: 'join', room: 'west', char: 'hood', color: 2, visitor: 'talktester02', nick: '달빛' }));
  await wait(600);
  const sa = last(a, 'seat').seat;
  const sb = last(b, 'seat').seat;
  // 동전 없는 b는 못 검
  b.send(JSON.stringify({ t: 'talkask', seat: sa }));
  await wait(300);
  assert.equal(last(b, 'need').item, 'coins');
  // a가 걸면 b에게 신청, 거절하면 동전 그대로
  a.send(JSON.stringify({ t: 'talkask', seat: sb }));
  await wait(300);
  const ask = last(b, 'talkask');
  assert.equal(ask.nick, '별빛');
  b.send(JSON.stringify({ t: 'talkans', id: ask.id, ok: true }));
  await wait(300);
  assert.equal(last(a, 'wallet').wallet.coins, coins0 - 1);
  assert.equal(last(a, 'talkopen').nick, '달빛');
  a.send(JSON.stringify({ t: 'talk', text: '시발 해 진짜 예쁘다' }));
  await wait(800);
  a.send(JSON.stringify({ t: 'talk', text: 'www.example.com 와봐요' }));
  await wait(300);
  assert.equal(last(b, 'talkmsg').text, '♡♡ 해 진짜 예쁘다');
  assert.equal(last(a, 'talkno').reason, 'text');
  // 신고하면 닫히고 차단
  b.send(JSON.stringify({ t: 'talkreport' }));
  await wait(300);
  assert.ok(last(a, 'talkend'));
  assert.ok(last(b, 'talkreported'));
  await wait(10100);
  a.send(JSON.stringify({ t: 'talkask', seat: sb }));
  await wait(300);
  assert.equal(last(a, 'talkno').reason, 'busy');
  a.close();
  b.close();
  await wait(200);
});

test('수다톡 평판: 둘 다 말한 뒤 끝나면 서로 한 번 평가, 같은 짝은 하루 한 번', async () => {
  const visitor = 'reptester01';
  const o = await post('/api/shop/order', { visitor, product: 'coins10' });
  await post('/api/shop/confirm', { orderId: o.body.orderId, paymentKey: 'test', amount: 1000 });
  const [a, b] = await Promise.all([client(), client()]);
  a.send(JSON.stringify({ t: 'hello', visitor }));
  a.send(JSON.stringify({ t: 'join', room: 'west', char: 'scarf', color: 1, visitor, nick: '해' }));
  b.send(JSON.stringify({ t: 'join', room: 'west', char: 'hood', color: 2, visitor: 'reptester02', nick: '달' }));
  await wait(600);
  const sa = last(a, 'seat').seat;
  const sb = last(b, 'seat').seat;
  a.send(JSON.stringify({ t: 'talkask', seat: sb }));
  await wait(300);
  assert.deepEqual(last(b, 'talkask').rep, { up: 0, down: 0 });
  b.send(JSON.stringify({ t: 'talkans', id: last(b, 'talkask').id, ok: true }));
  await wait(300);
  a.send(JSON.stringify({ t: 'talk', text: '안녕하세요' }));
  b.send(JSON.stringify({ t: 'talk', text: '반가워요' }));
  await wait(300);
  a.send(JSON.stringify({ t: 'talkend' }));
  await wait(300);
  assert.equal(last(a, 'talkend').canRate, true);
  assert.equal(last(b, 'talkend').canRate, true);
  b.send(JSON.stringify({ t: 'rate', good: true }));
  b.send(JSON.stringify({ t: 'rate', good: true })); // 두 번은 안 됨
  await wait(300);
  assert.equal(b.inbox.filter((m) => m.t === 'talkrated').length, 1);
  b.send(JSON.stringify({ t: 'who', seat: sa }));
  await wait(300);
  assert.deepEqual(last(b, 'who').rep, { up: 1, down: 0 });
  a.close();
  b.close();
  await wait(200);
});

test('귀가 후기: 왕복 승차권 + 머문 시간 + SNS 글 주소면 동전 10개, 같은 글·하루 두 번·편도는 안 됨', async () => {
  const one = await client();
  one.send(JSON.stringify({ t: 'hello', visitor: 'onewaytrip01' }));
  one.send(JSON.stringify({ t: 'join', room: 'west', char: 'scarf', color: 1, visitor: 'onewaytrip01', trip: 'one' }));
  const a = await client();
  a.send(JSON.stringify({ t: 'hello', visitor: 'roundtrip001' }));
  a.send(JSON.stringify({ t: 'join', room: 'west', char: 'scarf', color: 1, visitor: 'roundtrip001', trip: 'round' }));
  await wait(1300);
  const bad = await post('/api/shop/review', { visitor: 'onewaytrip01', url: 'https://www.instagram.com/p/abc123/' });
  assert.match(bad.body.error, /왕복/);
  const notSns = await post('/api/shop/review', { visitor: 'roundtrip001', url: 'https://example.com/post/1' });
  assert.ok(notSns.body.error);
  const profile = await post('/api/shop/review', { visitor: 'roundtrip001', url: 'https://www.instagram.com/' });
  assert.ok(profile.body.error);
  a.send(JSON.stringify({ t: 'leave' }));
  await wait(200);
  const ok = await post('/api/shop/review', { visitor: 'roundtrip001', url: 'https://www.instagram.com/p/abc123/' });
  assert.equal(ok.body.ok, true);
  assert.equal(ok.body.wallet.coins, 10);
  const twice = await post('/api/shop/review', { visitor: 'roundtrip001', url: 'https://www.threads.net/@me/post/xyz' });
  assert.ok(twice.body.error);
  const same = await post('/api/shop/review', { visitor: 'onewaytrip01', url: 'https://instagram.com/p/abc123' });
  assert.ok(same.body.error);
  one.close();
  a.close();
  await wait(200);
});

test('별점·건의: 저장되고 통계엔 개수·평균만, 운영자 키 없이는 글 목록 못 봄', async () => {
  const empty = await post('/api/feedback', { visitor: 'fbtester0001' });
  assert.ok(empty.body.error);
  const ok = await post('/api/feedback', { visitor: 'fbtester0001', stars: 4, text: '불멍 너무 좋아요', place: 'east', lang: 'ko' });
  assert.equal(ok.body.ok, true);
  const again = await post('/api/feedback', { visitor: 'fbtester0001', stars: 5 });
  assert.ok(again.body.error); // 1분 안에 또는 안 됨
  const stats = await (await fetch(`http://localhost:${PORT}/api/stats`)).json();
  assert.equal(stats.feedback.count, 1);
  assert.equal(stats.feedback.stars, 4);
  assert.equal(JSON.stringify(stats).includes('불멍 너무 좋아요'), false);
  const hidden = await fetch(`http://localhost:${PORT}/api/feedback?key=wrong`);
  assert.equal(hidden.status, 404);
});

test('잔상 방지: 같은 기기가 다시 연결되면 예전 연결은 자리에서 내려가고 닫힘', async () => {
  const visitor = 'ghosttest001';
  const old = await client();
  old.send(JSON.stringify({ t: 'hello', visitor }));
  old.send(JSON.stringify({ t: 'join', room: 'west', char: 'cat', color: 1, visitor }));
  await wait(400);
  assert.ok(last(old, 'seat'));
  let code = null;
  old.on('close', (c) => (code = c));
  const fresh = await client();
  fresh.send(JSON.stringify({ t: 'hello', visitor }));
  fresh.send(JSON.stringify({ t: 'join', room: 'west', char: 'cat', color: 1, visitor }));
  await wait(1300);
  assert.equal(code, 4001);
  assert.ok(last(fresh, 'seat'));
  const st = await (await fetch(`http://localhost:${PORT}/api/status`)).json();
  assert.equal(st.rooms.west.seated, 1);
  fresh.close();
  await wait(200);
});

test('보안: 너무 큰 요청은 413, 배열·이상한 본문은 400', async () => {
  const big = await fetch(`http://localhost:${PORT}/api/shop/order`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'x'.repeat(10000) });
  assert.equal(big.status, 413);
  const arr = await fetch(`http://localhost:${PORT}/api/shop/order`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '[1,2]' });
  assert.equal(arr.status, 400);
});

test('보안: 메시지를 폭탄처럼 보내는 연결은 끊김', async () => {
  const a = await client();
  let closed = false;
  a.on('close', () => (closed = true));
  for (let s = 0; s < 5 && !closed; s++) {
    for (let i = 0; i < 60; i++) a.send(JSON.stringify({ t: 'stat', k: 'x' }));
    await wait(1050);
  }
  assert.ok(closed);
});

test('안정성: 이상한 메시지를 마구 보내도 서버는 멀쩡함', async () => {
  const a = await client();
  const junk = ['', 'null', '[]', '123', '{"t":5}', '{"t":"join","room":{"x":1}}', '{"t":"move","x":"NaN","y":1e309}', '{"t":"heart","seat":-1}', '{"t":"whisper","seat":1e9,"i":-5}', '{"t":"say","text":{"a":1}}', '{"t":"nick","nick":["a"]}', '{"t":"ritual","i":"__proto__"}', '{"t":"use","item":"constructor"}', '{"__proto__":{"t":"x"}}', '{"t":"' + 'x'.repeat(100) + '"}'];
  for (const j of junk) a.send(j);
  a.send(JSON.stringify({ t: 'join', room: 'east', char: 'coat', color: 0 }));
  await wait(600);
  assert.ok(last(a, 'seat'));
  const ok = await fetch(`http://localhost:${PORT}/healthz`);
  assert.equal(ok.status, 200);
  a.close();
});

test('정서진 유리병 편지: 공개 문구는 그리운 이에게 보내는 말 목록', async () => {
  const info = await (await fetch(`http://localhost:${PORT}/api/shop?visitor=lettertest01`)).json();
  assert.ok(info.letters.length >= 5);
  assert.ok(info.letters.every((t) => !info.wishes.includes(t)));
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

test('하트: 한마디를 건넨 사이에만, 받은 사람에게 알림·집계, 연타 무시, 한마디 무게 전달', async () => {
  const [a, b] = await Promise.all([client(), client()]);
  a.send(JSON.stringify({ t: 'hello', visitor: 'hearttest01' }));
  b.send(JSON.stringify({ t: 'hello', visitor: 'hearttest02' }));
  a.send(JSON.stringify({ t: 'join', room: 'east', char: 'coat', color: 0, visitor: 'hearttest01' }));
  b.send(JSON.stringify({ t: 'join', room: 'east', char: 'hood', color: 1, visitor: 'hearttest02' }));
  await wait(700);
  const bSeat = last(b, 'seat').seat;
  // 한마디도 안 건넸으면 하트는 안 됨
  a.send(JSON.stringify({ t: 'heart', seat: bSeat }));
  await wait(400);
  assert.equal(last(a, 'need').item, 'talk');
  assert.equal(last(b, 'gotheart'), undefined);
  // 한마디 건네기 → 상대에게만 전달
  a.send(JSON.stringify({ t: 'whisper', seat: bSeat, i: 1 }));
  await wait(400);
  assert.equal(last(b, 'whisper').i, 1);
  assert.equal(last(a, 'whisper').self, true);
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
