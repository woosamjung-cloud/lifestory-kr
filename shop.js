// 상점: 30일 이용권 아이템, 동전(엽전) 충전, 결제(토스페이먼츠) 확인, 구매 기록
//
// SHOP_MODE 환경 변수
//   off  : 상점 숨김
//   test : 테스트 결제 (실제 돈이 나가지 않음, 기본값)
//   live : 토스페이먼츠 실제 결제 (TOSS_CLIENT_KEY, TOSS_SECRET_KEY 필요)
//
// 주의: 실제 판매(live) 전에는 반드시 DATA_DIR을 영구 저장소(Render Disk 등)로 지정하세요.
//       무료 서버는 재시작하면 파일이 사라져 구매 기록이 없어집니다.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DAY = 86400000;

// 판매 상품 (가격은 서버에서만 정함 - 화면에서 바꿔도 소용없음)
export const COIN_PRICE = 100; // 소원 동전 1개 정가
export const PRODUCTS = {
  candle: { group: 'items', name: '촛불', price: 1000, grants: { items: ['candle'] }, icon: '🕯️', desc: '내 자리 앞에 촛불이 일렁여요. 켜고 끌 수 있어요.' },
  flash: { group: 'items', name: '후레쉬', price: 1000, grants: { items: ['flash'] }, icon: '🔦', desc: '손전등으로 밤바다를 은은하게 비춰요.' },
  fireworks: { group: 'items', name: '폭죽', price: 2000, grants: { items: ['fireworks'] }, icon: '🎆', desc: '하늘에 불꽃놀이! 함께 보는 모든 사람 화면에 보여요.' },
  bigfire: { group: 'items', name: '큰 캠프파이어', price: 2900, grants: { items: ['bigfire'] }, icon: '🔥', desc: '내 모닥불이 더 크고 화려한 색으로 타올라요.' },
  package: { group: 'items', name: '모두 담은 꾸러미', price: 4900, grants: { items: ['candle', 'flash', 'fireworks', 'bigfire'], coins: 5 }, icon: '🎁', desc: '네 가지 아이템을 한 번에 + 소원 동전 5개 덤.' },
  coins5: { group: 'coins', name: '소원 동전 5개', price: 500, grants: { coins: 5 }, icon: '🪙', desc: '가볍게 한두 번' },
  coins10: { group: 'coins', name: '소원 동전 11개', price: 1000, grants: { coins: 11 }, icon: '🪙', desc: '10개 + 덤 1개' },
  coins33: { group: 'coins', name: '소원 동전 35개', price: 3000, grants: { coins: 35 }, icon: '🪙', desc: '30개 + 덤 5개' },
  coins60: { group: 'coins', name: '소원 동전 60개', price: 5000, grants: { coins: 60 }, icon: '🪙', desc: '50개 + 덤 10개' },
  coins130: { group: 'coins', name: '소원 동전 130개', price: 10000, grants: { coins: 130 }, icon: '🪙', desc: '100개 + 덤 30개' },
};
export const ITEM_KEYS = ['candle', 'flash', 'fireworks', 'bigfire'];
export const ITEM_DAYS = 30;

// 공개 소원 문구 (자유 글 대신 고르는 방식 - 욕설·개인정보 걱정 없음)
export const WISHES = [
  '🎓 합격 기원',
  '💪 가족 모두 건강',
  '💕 사랑이 이루어지길',
  '💰 대박 나세요',
  '🍀 올해는 꼭 행운',
  '🏡 내 집 마련',
  '💼 취업 성공',
  '😊 마음 편한 한 해',
  '✈️ 여행 많이 가기',
  '🙏 모두 행복하길',
];

// 그리운 이에게 띄우는 유리병 편지에 다는 공개 문구 (정서진)
export const LETTERS = [
  '💌 보고 싶어요',
  '🙏 고마웠어요',
  '😢 미안했어요',
  '💕 사랑해요',
  '🌅 저는 잘 지내요',
  '🕊️ 편히 쉬세요',
  '🌙 꿈에서 만나요',
  '😊 덕분에 행복했어요',
  '🤝 꼭 다시 만나요',
  '💛 늘 응원할게요',
];

// 응원 한마디 (자유 채팅 대신 고르는 문구 - 욕설·광고·개인정보 걱정 없음, 무료)
export const SAYINGS = [
  '안녕하세요 👋',
  '와, 예쁘다 😍',
  '해 뜬다! ☀️',
  '새해 복 많이 받으세요 🙏',
  '오늘도 수고했어요',
  '다들 화이팅! 💪',
  '소원 꼭 이뤄지길 🍀',
  '불멍 최고 🔥',
  '춥다 🥶 이불 덮어요',
  '함께라서 좋아요 💛',
  '별이 예뻐요 ✨',
  '잘 자요 🌙',
];

export function shopMode() {
  const m = (process.env.SHOP_MODE || 'test').toLowerCase();
  if (m === 'live' && !(process.env.TOSS_CLIENT_KEY && process.env.TOSS_SECRET_KEY)) return 'test';
  return ['off', 'test', 'live'].includes(m) ? m : 'test';
}

// ---------- 저장 ----------
let db = { accounts: {}, orders: {}, codes: {} };
let file = null;
let dirty = false;

export function initShop(dataDir) {
  file = path.join(dataDir, 'shop.json');
  try {
    db = { accounts: {}, orders: {}, codes: {}, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch {
    /* 처음 실행 */
  }
  setInterval(saveShop, 5000).unref();
}

export function saveShop(force = false) {
  if (!file || (!dirty && !force)) return;
  dirty = false;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file + '.tmp', JSON.stringify(db));
    fs.renameSync(file + '.tmp', file);
  } catch (err) {
    console.error('상점 저장 실패:', err.message);
  }
}

const validVisitor = (v) => typeof v === 'string' && /^[a-z0-9]{8,40}$/i.test(v);

function account(visitor, create = true) {
  if (!validVisitor(visitor)) return null;
  let a = db.accounts[visitor];
  if (!a && create) {
    a = db.accounts[visitor] = { coins: 0, items: {}, created: Date.now() };
    dirty = true;
  }
  return a || null;
}

// 화면에 보낼 내 지갑 정보
export function wallet(visitor) {
  const a = account(visitor, false);
  const now = Date.now();
  const items = {};
  if (a) for (const k of ITEM_KEYS) if (a.items[k] > now) items[k] = a.items[k];
  return {
    coins: a ? a.coins : 0,
    items,
    hasCode: !!(a && a.code),
    hearts: { received: a ? a.heartsIn || 0 : 0, given: a ? a.heartsOut || 0 : 0 },
  };
}

export function hasItem(visitor, key) {
  const a = account(visitor, false);
  return !!(a && a.items[key] > Date.now());
}

// ---------- 하트 ----------

// 하트는 마음껏 줄 수 있음 (사랑은 주면 줄수록 많이 나오니까). 준 하트도 기록
export function spendHeart(visitor) {
  const a = account(visitor);
  if (!a) return false;
  a.heartsOut = (a.heartsOut || 0) + 1;
  dirty = true;
  return true;
}

export function receiveHeart(visitor) {
  const a = account(visitor);
  if (!a) return 0;
  a.heartsIn = (a.heartsIn || 0) + 1;
  dirty = true;
  return a.heartsIn;
}

// 한마디의 무게: 받은 하트가 많을수록, 아이템을 쓰고 있으면 한 단계 더 (1~5)
export function sayWeight(visitor) {
  const a = account(visitor, false);
  // 받은 하트 + 준 하트의 절반 (주는 사람도 마음이 커짐)
  const got = a ? (a.heartsIn || 0) + (a.heartsOut || 0) * 0.5 : 0;
  let w = got >= 200 ? 4 : got >= 50 ? 3 : got >= 10 ? 2 : 1;
  if (ITEM_KEYS.some((k) => hasItem(visitor, k))) w += 1;
  return Math.min(5, w);
}

export function spendCoin(visitor) {
  const a = account(visitor, false);
  if (!a || a.coins < 1) return false;
  a.coins -= 1;
  dirty = true;
  return true;
}

function grant(visitor, product) {
  const a = account(visitor);
  const g = PRODUCTS[product].grants;
  const now = Date.now();
  for (const k of g.items || []) a.items[k] = Math.max(a.items[k] || 0, now) + ITEM_DAYS * DAY; // 이미 있으면 기간 연장
  if (g.coins) a.coins += g.coins;
  if (g.hearts) a.heartsBought = (a.heartsBought || 0) + g.hearts;
  dirty = true;
}

// ---------- 주문 ----------
export function createOrder(visitor, product) {
  if (!validVisitor(visitor)) return { error: '기기 정보가 올바르지 않아요' };
  const p = PRODUCTS[product];
  if (!p) return { error: '없는 상품이에요' };
  account(visitor);
  const orderId = 'hd' + Date.now().toString(36) + crypto.randomBytes(6).toString('hex');
  db.orders[orderId] = { visitor, product, amount: p.price, status: 'ready', created: Date.now() };
  dirty = true;
  return { orderId, amount: p.price, orderName: `이불 밖은 추우니까 ${p.name}`, customerKey: 'c_' + visitor };
}

// 결제 확인: 금액이 주문과 같은지 확인한 뒤 토스페이먼츠에 승인 요청 (테스트 모드는 바로 승인)
export async function confirmOrder({ orderId, paymentKey, amount }) {
  const o = db.orders[orderId];
  if (!o) return { error: '주문을 찾을 수 없어요' };
  if (o.status === 'done') return { ok: true, already: true, wallet: wallet(o.visitor) };
  if (Number(amount) !== o.amount) return { error: '결제 금액이 주문과 달라요' };
  const mode = shopMode();
  if (mode === 'off') return { error: '상점이 닫혀 있어요' };
  if (mode === 'live') {
    if (typeof paymentKey !== 'string' || paymentKey.length > 200) return { error: '결제 정보가 올바르지 않아요' };
    const auth = Buffer.from(process.env.TOSS_SECRET_KEY + ':').toString('base64');
    let res;
    let body;
    try {
      res = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json', 'Idempotency-Key': orderId },
        body: JSON.stringify({ paymentKey, orderId, amount: o.amount }),
        signal: AbortSignal.timeout(15000),
      });
      body = await res.json();
    } catch (err) {
      return { error: '결제 확인 중 오류가 났어요. 잠시 후 다시 시도해 주세요' };
    }
    if (!res.ok || body.status !== 'DONE') {
      o.status = 'failed';
      o.failure = body && body.code;
      dirty = true;
      return { error: (body && body.message) || '결제가 승인되지 않았어요' };
    }
    o.paymentKey = paymentKey;
    o.method = body.method;
  } else {
    o.test = true;
  }
  o.status = 'done';
  o.paidAt = Date.now();
  grant(o.visitor, o.product);
  saveShop(true);
  return { ok: true, wallet: wallet(o.visitor), test: mode === 'test' };
}

// ---------- 복구 코드 (다른 기기로 구매 내역 옮기기) ----------
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function recoveryCode(visitor) {
  const a = account(visitor, false);
  if (!a) return { error: '구매 내역이 없어요' };
  if (!a.code) {
    let code;
    do {
      code = Array.from(crypto.randomBytes(10), (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
      code = `${code.slice(0, 5)}-${code.slice(5)}`;
    } while (db.codes[code]);
    a.code = code;
    db.codes[code] = visitor;
    dirty = true;
    saveShop(true);
  }
  return { code: a.code };
}

export function restore(code) {
  const c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const key = `${c.slice(0, 5)}-${c.slice(5)}`;
  const visitor = db.codes[key];
  if (!visitor) return { error: '복구 코드를 찾을 수 없어요' };
  return { visitor, wallet: wallet(visitor) };
}

export function shopPublicInfo() {
  return {
    mode: shopMode(),
    clientKey: shopMode() === 'live' ? process.env.TOSS_CLIENT_KEY : null,
    products: Object.fromEntries(Object.entries(PRODUCTS).map(([k, p]) => [k, { group: p.group, name: p.name, price: p.price, icon: p.icon, desc: p.desc, coins: p.grants.coins || 0, items: p.grants.items || [], list: p.group === 'coins' ? p.grants.coins * COIN_PRICE : 0 }])),
    wishes: WISHES,
    letters: LETTERS,
    sayings: SAYINGS,
    itemDays: ITEM_DAYS,
  };
}

export function shopStats() {
  let sales = 0;
  let orders = 0;
  for (const o of Object.values(db.orders)) if (o.status === 'done' && !o.test) {
    sales += o.amount;
    orders += 1;
  }
  return { orders, sales, accounts: Object.keys(db.accounts).length };
}
