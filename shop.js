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
export const COIN_PRICE = 100; // 소원 동전 1개 정가 (원)
export const COIN_PRICE_USD = 0.1; // 해외(페이팔) 동전 1개 정가 (달러). 페이팔은 건당 수수료가 있어 해외는 2.99달러부터 묶음만 팝니다
export const PRODUCTS = {
  candle: { group: 'items', name: '촛불', price: 1000, usd: 1.49, grants: { items: ['candle'] }, icon: '🕯️', desc: '내 자리 앞에 촛불이 일렁여요. 켜고 끌 수 있어요.' },
  flash: { group: 'items', name: '후레쉬', price: 1000, usd: 1.49, grants: { items: ['flash'] }, icon: '🔦', desc: '손전등으로 밤바다를 은은하게 비춰요.' },
  fireworks: { group: 'items', name: '폭죽', price: 2000, usd: 1.99, grants: { items: ['fireworks'] }, icon: '🎆', desc: '하늘에 불꽃놀이! 함께 보는 모든 사람 화면에 보여요.' },
  bigfire: { group: 'items', name: '큰 캠프파이어', price: 2900, usd: 2.49, grants: { items: ['bigfire'] }, icon: '🔥', desc: '내 모닥불이 더 크고 화려한 색으로 타올라요.' },
  raincoat: { group: 'items', name: '노란 우비 (비·눈 오는 날)', price: 1500, usd: 1.99, grants: { items: ['raincoat'] }, icon: '☔', desc: '실제로 비나 눈이 오는 날, 나와 함께 온 강아지·고양이가 노란 우비를 입어요. 모자는 귀까지 폭, 빗방울은 톡톡 튕겨요. 다른 사람에게도 보여요.' },
  bgsound: { group: 'items', name: '잠들 때까지 소리 켜두기', price: 1000, usd: 1.49, grants: { items: ['bgsound'] }, icon: '🎧', desc: '다른 창으로 옮기거나 화면을 꺼도 파도·모닥불 소리와 음악이 계속 나와요. 잠자기 타이머(30분·1시간·2시간) 포함. 아이폰도 화면을 꺼도 들려요.' },
  package: { group: 'items', name: '모두 담은 꾸러미', price: 4900, usd: 3.99, grants: { items: ['candle', 'flash', 'fireworks', 'bigfire'], coins: 5 }, icon: '🎁', desc: '네 가지 아이템을 한 번에 + 소원 동전 5개 덤.' },
  coins5: { group: 'coins', name: '소원 동전 5개', price: 500, grants: { coins: 5 }, icon: '🪙', desc: '가볍게 한두 번' },
  coins10: { group: 'coins', name: '소원 동전 11개', price: 1000, grants: { coins: 11 }, icon: '🪙', desc: '10개 + 덤 1개' },
  coins33: { group: 'coins', name: '소원 동전 35개', price: 3000, usd: 2.99, grants: { coins: 35 }, icon: '🪙', desc: '30개 + 덤 5개' },
  coins60: { group: 'coins', name: '소원 동전 60개', price: 5000, usd: 4.99, grants: { coins: 60 }, icon: '🪙', desc: '50개 + 덤 10개' },
  coins130: { group: 'coins', name: '소원 동전 130개', price: 10000, usd: 8.99, grants: { coins: 130 }, icon: '🪙', desc: '100개 + 덤 30개' },
};
export const ITEM_KEYS = ['candle', 'flash', 'fireworks', 'bigfire', 'bgsound', 'raincoat'];
// 한마디 무게에 들어가는 꾸미기 아이템 (소리 켜두기는 제외)
export const SHOW_ITEMS = ['candle', 'flash', 'fireworks', 'bigfire'];
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

// 가까이 온 사람에게 건네는 한마디 (두 사람에게만 보임, 정해진 문구라 안전)
export const WHISPERS = [
  '안녕하세요 😊',
  '같이 봐서 좋아요',
  '불 따뜻하죠? 🔥',
  '오늘 하루 수고했어요',
  '노을 진짜 예쁘네요',
  '강아지(고양이) 귀여워요 🐾',
  '내일 또 만나요 👋',
  '좋은 밤 되세요 🌙',
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
let db = { accounts: {}, orders: {}, codes: {}, users: {}, tokens: {} };
let file = null;
let dirty = false;

export function initShop(dataDir) {
  file = path.join(dataDir, 'shop.json');
  let raw = null;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    /* 처음 실행 */
  }
  if (raw != null) {
    try {
      db = { accounts: {}, orders: {}, codes: {}, users: {}, tokens: {}, ...JSON.parse(raw) };
    } catch {
      // 깨진 파일은 지우지 않고 옆에 보관한 뒤 새로 시작 (나중에 손으로 살릴 수 있게)
      const keep = `${file}.broken-${Date.now()}`;
      try {
        fs.copyFileSync(file, keep);
      } catch {
        /* 보관 실패 */
      }
      console.error('상점 파일이 깨져 있어 보관했어요:', keep);
    }
  }
  setInterval(saveShop, 5000).unref();
  // 오래된 것 정리: 15분 지난 로그인 링크, 하루 지난 미결제 주문
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of Object.entries(db.tokens)) if (v.exp < now) delete db.tokens[k];
    for (const [k, o] of Object.entries(db.orders)) if (o.status === 'ready' && now - o.created > 86400000) delete db.orders[k];
    for (const [k, t] of lastMail) if (now - t > 60000) lastMail.delete(k);
    dirty = true;
  }, 10 * 60 * 1000).unref();
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
    email: a && a.email ? maskEmail(a.email) : null, // 로그인한 이메일 (가려서)
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
  if (SHOW_ITEMS.some((k) => hasItem(visitor, k))) w += 1;
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
// currency: 'KRW'(국내, 키움페이) / 'USD'(해외, 페이팔)
export function createOrder(visitor, product, currency = 'KRW') {
  if (!validVisitor(visitor)) return { error: '기기 정보가 올바르지 않아요' };
  const p = PRODUCTS[product];
  if (!p) return { error: '없는 상품이에요' };
  const usd = currency === 'USD';
  if (usd && !p.usd) return { error: '없는 상품이에요' };
  const a = account(visitor);
  // 실제 결제는 로그인(이메일)한 사람만: 구매 기록을 어느 기기에서든 찾을 수 있게
  if (shopMode() === 'live' && !a.email) return { error: '로그인이 필요해요', needLogin: true };
  const amount = usd ? p.usd : p.price;
  const orderId = 'hd' + Date.now().toString(36) + crypto.randomBytes(6).toString('hex');
  db.orders[orderId] = { visitor, product, amount, currency: usd ? 'USD' : 'KRW', status: 'ready', created: Date.now() };
  dirty = true;
  return { orderId, amount, currency: usd ? 'USD' : 'KRW', orderName: `이불 밖은 추우니까 ${p.name}`, customerKey: 'c_' + visitor };
}

// ---------- 페이팔 (해외 결제) ----------
// Render 환경변수: PAYPAL_CLIENT_ID, PAYPAL_SECRET, PAYPAL_ENV(sandbox|live, 기본 sandbox)
export function paypalReady() {
  return !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_SECRET);
}
const paypalBase = () => (process.env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com');
async function paypalToken() {
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString('base64');
  const res = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(15000),
  });
  const body = await res.json();
  if (!res.ok || !body.access_token) throw new Error('paypal auth');
  return body.access_token;
}
// 우리 주문 → 페이팔 주문 만들기 (금액은 서버가 정함)
export async function paypalCreate(orderId) {
  const o = db.orders[orderId];
  if (!o || o.currency !== 'USD' || o.status !== 'ready') return { error: '주문을 찾을 수 없어요' };
  if (!paypalReady()) return { error: '결제창을 불러오지 못했어요' };
  try {
    const token = await paypalToken();
    const res = await fetch(`${paypalBase()}/v2/checkout/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': orderId },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{ custom_id: orderId, description: `Too Cold to Leave the Blanket - ${PRODUCTS[o.product].name}`, amount: { currency_code: 'USD', value: o.amount.toFixed(2) } }],
      }),
      signal: AbortSignal.timeout(15000),
    });
    const body = await res.json();
    if (!res.ok || !body.id) return { error: '결제창을 불러오지 못했어요' };
    o.paypalId = body.id;
    dirty = true;
    return { id: body.id };
  } catch {
    return { error: '결제창을 불러오지 못했어요' };
  }
}
async function paypalCapture(o) {
  const token = await paypalToken();
  const res = await fetch(`${paypalBase()}/v2/checkout/orders/${encodeURIComponent(o.paypalId)}/capture`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': `cap-${o.paypalId}` },
    signal: AbortSignal.timeout(15000),
  });
  const body = await res.json();
  const cap = body?.purchase_units?.[0]?.payments?.captures?.[0];
  const ok = res.ok && body.status === 'COMPLETED' && cap && cap.amount?.currency_code === 'USD' && Number(cap.amount.value) === o.amount;
  return { ok, captureId: cap && cap.id, payer: body?.payer?.email_address };
}

// 결제 확인: 금액이 주문과 같은지 확인한 뒤 토스페이먼츠에 승인 요청 (테스트 모드는 바로 승인)
export async function confirmOrder({ orderId, paymentKey, amount }) {
  const o = db.orders[orderId];
  if (!o) return { error: '주문을 찾을 수 없어요' };
  if (o.status === 'done') return { ok: true, already: true, wallet: wallet(o.visitor) };
  if (Number(amount) !== o.amount) return { error: '결제 금액이 주문과 달라요' };
  const mode = shopMode();
  if (mode === 'off') return { error: '상점이 닫혀 있어요' };
  if (o.currency === 'USD' && mode === 'live') {
    // 해외: 페이팔 결제 확정 (금액·통화를 다시 확인)
    if (!o.paypalId) return { error: '결제 정보가 올바르지 않아요' };
    let r;
    try {
      r = await paypalCapture(o);
    } catch {
      return { error: '결제 확인 중 오류가 났어요. 잠시 후 다시 시도해 주세요' };
    }
    if (!r.ok) {
      o.status = 'failed';
      dirty = true;
      return { error: '결제가 승인되지 않았어요' };
    }
    o.captureId = r.captureId;
    o.method = 'paypal';
  } else if (mode === 'live') {
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

// ---------- 이메일 간편 로그인 (결제할 때만 요청) ----------
// 메일로 보낸 링크를 누르면 로그인. 비밀번호 없음.
// Render 환경변수: RESEND_API_KEY(메일 발송), MAIL_FROM(보내는 주소, 예: '이불 밖은 추우니까 <hello@도메인>')
// 메일 키가 없고 테스트 모드면 링크를 화면에 바로 돌려줌 (흐름 확인용)
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i;
const LOGIN_TTL = 15 * 60 * 1000;
const lastMail = new Map(); // email → 마지막 발송 시각 (1분에 한 번)
function maskEmail(e) {
  const [id, dom] = e.split('@');
  return `${id.slice(0, 2)}${'*'.repeat(Math.max(1, Math.min(4, id.length - 2)))}@${dom}`;
}
export async function loginStart(rawEmail, visitor, origin) {
  const email = String(rawEmail || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: '이메일 주소를 확인해 주세요' };
  if (!validVisitor(visitor)) return { error: '기기 정보가 올바르지 않아요' };
  const now = Date.now();
  if (now - (lastMail.get(email) || 0) < 60000) return { error: '잠시 후 다시 시도해 주세요' };
  lastMail.set(email, now);
  for (const [k, v] of Object.entries(db.tokens)) if (v.exp < now) delete db.tokens[k];
  const token = crypto.randomBytes(24).toString('hex');
  db.tokens[token] = { email, visitor, exp: now + LOGIN_TTL };
  dirty = true;
  const link = `${origin}/?login=${token}`;
  const key = process.env.RESEND_API_KEY;
  if (key) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.MAIL_FROM || '이불 밖은 추우니까 <onboarding@resend.dev>',
          to: [email],
          subject: '이불 밖은 추우니까 · 로그인 링크 (Login link)',
          html: `<p>아래 버튼을 누르면 로그인돼요. (15분 동안 유효)</p><p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#b9574e;color:#fff;border-radius:10px;text-decoration:none">로그인하기 · Log in</a></p><p style="color:#888;font-size:12px">요청하지 않으셨다면 이 메일은 무시해 주세요. If you didn't request this, just ignore this email.</p>`,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error('mail');
      return { sent: true };
    } catch {
      return { error: '메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요' };
    }
  }
  if (shopMode() !== 'live') return { sent: false, devLink: link };
  return { error: '메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요' };
}
// 다른 기기의 지갑을 계정으로 합치기
function mergeInto(target, source) {
  const t = account(target);
  const s = account(source, false);
  if (!s || target === source) return;
  t.coins += s.coins || 0;
  for (const [k, until] of Object.entries(s.items || {})) t.items[k] = Math.max(t.items[k] || 0, until);
  t.heartsIn = (t.heartsIn || 0) + (s.heartsIn || 0);
  t.heartsOut = (t.heartsOut || 0) + (s.heartsOut || 0);
  s.coins = 0;
  s.items = {};
  s.mergedInto = target;
  dirty = true;
}
// 소셜 로그인으로 받은 사람: 이메일(없으면 '카카오:번호' 같은 고유 키)과 별명으로 로그인 토큰을 만듦
export function socialToken({ key, email, nick, visitor }) {
  const token = crypto.randomBytes(24).toString('hex');
  db.tokens[token] = { email: key, realEmail: email || null, nick: nick || '', visitor, exp: Date.now() + LOGIN_TTL };
  dirty = true;
  return token;
}

export function loginVerify(token, visitor) {
  const t = db.tokens[String(token || '')];
  if (!t || t.exp < Date.now()) return { error: '링크가 만료됐어요. 다시 시도해 주세요' };
  delete db.tokens[token];
  const here = validVisitor(visitor) ? visitor : t.visitor;
  let u = db.users[t.email];
  if (!u) {
    u = db.users[t.email] = { visitor: here, created: Date.now() };
    account(here).email = t.realEmail || t.email;
  } else {
    mergeInto(u.visitor, here);
    if (here !== t.visitor) mergeInto(u.visitor, t.visitor);
  }
  dirty = true;
  saveShop(true);
  const shown = t.realEmail || t.email;
  if (t.nick) account(u.visitor).nick = t.nick;
  return { visitor: u.visitor, email: shown.includes('@') ? maskEmail(shown) : shown.split(':')[0], nick: t.nick || account(u.visitor).nick || '', wallet: wallet(u.visitor) };
}

// ---------- 소셜 로그인 설정 (Render 환경변수에 키를 넣은 곳만 버튼이 보임) ----------
// 카카오: KAKAO_REST_KEY (+ 선택 KAKAO_SECRET) / 구글: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET / 네이버: NAVER_CLIENT_ID, NAVER_CLIENT_SECRET
// 각 개발자 콘솔에 등록할 콜백 주소: https://(사이트 주소)/auth/kakao/callback (google, naver도 같은 모양)
export const OAUTH = {
  kakao: {
    ready: () => !!process.env.KAKAO_REST_KEY,
    authUrl: (redirect, state) => `https://kauth.kakao.com/oauth/authorize?${new URLSearchParams({ client_id: process.env.KAKAO_REST_KEY, redirect_uri: redirect, response_type: 'code', state, scope: 'profile_nickname,account_email' })}`,
    async profile(code, redirect) {
      const body = new URLSearchParams({ grant_type: 'authorization_code', client_id: process.env.KAKAO_REST_KEY, redirect_uri: redirect, code });
      if (process.env.KAKAO_SECRET) body.set('client_secret', process.env.KAKAO_SECRET);
      const tk = await (await fetch('https://kauth.kakao.com/oauth/token', { method: 'POST', body, signal: AbortSignal.timeout(15000) })).json();
      if (!tk.access_token) throw new Error('kakao token');
      const me = await (await fetch('https://kapi.kakao.com/v2/user/me', { headers: { Authorization: `Bearer ${tk.access_token}` }, signal: AbortSignal.timeout(15000) })).json();
      const acc = me.kakao_account || {};
      return { key: acc.email || `kakao:${me.id}`, email: acc.email || null, nick: (acc.profile && acc.profile.nickname) || (me.properties && me.properties.nickname) || '' };
    },
  },
  google: {
    ready: () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    authUrl: (redirect, state) => `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: redirect, response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account' })}`,
    async profile(code, redirect) {
      const body = new URLSearchParams({ grant_type: 'authorization_code', client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: redirect, code });
      const tk = await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body, signal: AbortSignal.timeout(15000) })).json();
      if (!tk.access_token) throw new Error('google token');
      const me = await (await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tk.access_token}` }, signal: AbortSignal.timeout(15000) })).json();
      if (!me.email) throw new Error('google email');
      return { key: me.email.toLowerCase(), email: me.email.toLowerCase(), nick: me.given_name || me.name || '' };
    },
  },
  naver: {
    ready: () => !!(process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET),
    authUrl: (redirect, state) => `https://nid.naver.com/oauth2.0/authorize?${new URLSearchParams({ client_id: process.env.NAVER_CLIENT_ID, redirect_uri: redirect, response_type: 'code', state })}`,
    async profile(code, redirect, state) {
      const q = new URLSearchParams({ grant_type: 'authorization_code', client_id: process.env.NAVER_CLIENT_ID, client_secret: process.env.NAVER_CLIENT_SECRET, code, state, redirect_uri: redirect });
      const tk = await (await fetch(`https://nid.naver.com/oauth2.0/token?${q}`, { signal: AbortSignal.timeout(15000) })).json();
      if (!tk.access_token) throw new Error('naver token');
      const me = await (await fetch('https://openapi.naver.com/v1/nid/me', { headers: { Authorization: `Bearer ${tk.access_token}` }, signal: AbortSignal.timeout(15000) })).json();
      const r = me.response || {};
      return { key: r.email ? r.email.toLowerCase() : `naver:${r.id}`, email: r.email ? r.email.toLowerCase() : null, nick: r.nickname || r.name || '' };
    },
  },
};
const oauthStates = new Map(); // state → { provider, visitor, exp }
export function oauthStart(provider, visitor, origin) {
  const p = OAUTH[provider];
  if (!p || !p.ready() || !validVisitor(visitor)) return null;
  const now = Date.now();
  for (const [k, v] of oauthStates) if (v.exp < now) oauthStates.delete(k);
  const state = crypto.randomBytes(16).toString('hex');
  oauthStates.set(state, { provider, visitor, exp: now + 10 * 60 * 1000 });
  return p.authUrl(`${origin}/auth/${provider}/callback`, state);
}
export async function oauthCallback(provider, code, state, origin) {
  const st = oauthStates.get(String(state || ''));
  oauthStates.delete(String(state || ''));
  if (!st || st.provider !== provider || st.exp < Date.now() || !code) return null;
  const prof = await OAUTH[provider].profile(String(code), `${origin}/auth/${provider}/callback`, state);
  return socialToken({ ...prof, nick: String(prof.nick || '').slice(0, 10), visitor: st.visitor });
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
  const paypal = paypalReady() ? { clientId: process.env.PAYPAL_CLIENT_ID, env: process.env.PAYPAL_ENV === 'live' ? 'live' : 'sandbox' } : null;
  return {
    mode: shopMode(),
    clientKey: shopMode() === 'live' ? process.env.TOSS_CLIENT_KEY : null,
    products: Object.fromEntries(Object.entries(PRODUCTS).map(([k, p]) => [k, { group: p.group, name: p.name, price: p.price, usd: p.usd || null, icon: p.icon, desc: p.desc, coins: p.grants.coins || 0, items: p.grants.items || [], list: p.group === 'coins' ? p.grants.coins * COIN_PRICE : 0, listUsd: p.group === 'coins' ? Math.round(p.grants.coins * COIN_PRICE_USD * 100) / 100 : 0 }])),
    paypal,
    wishes: WISHES,
    whispers: WHISPERS,
    auth: ['kakao', 'google', 'naver'].filter((p) => OAUTH[p].ready()),
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
