// 방구석 해돋이호 - 화면 흐름과 상호작용

import {
  PLACES,
  HORIZON_ELEVATION,
  EVENT_AFTERGLOW_MS,
  currentEvent,
  nextEventAt,
  formatHM,
  formatCountdown,
  solarPosition,
} from './sun.js';
import { Scene } from './scene.js';
import { CHAR_LIST, BLANKETS, renderPortrait } from './characters.js';
import { Net } from './net.js';
import { makeTicket, makeProofCard, saveOrShare } from './cards.js';
import { Ambience } from './ambience.js';

const $ = (id) => document.getElementById(id);

// ---------- 시계 ----------
// 주소 뒤에 ?t=2026-12-31T23:50:00+09:00 를 붙이면 그 시각부터 흐르는 것처럼 시험해 볼 수 있습니다.
const params = new URLSearchParams(location.search);
const clockOffset = (() => {
  const t = params.get('t');
  if (!t) return 0;
  const ms = Date.parse(t);
  return Number.isNaN(ms) ? 0 : ms - Date.now();
})();
// ?speed=60 을 붙이면 시계가 60배 빠르게 흐릅니다 (홍보 영상·시험용 타임랩스).
const clock = {
  anchorReal: Date.now(),
  anchorScene: Date.now() + clockOffset,
  speed: Math.min(600, Math.max(1, Number(params.get('speed')) || 1)),
};
const realNow = () => new Date(clock.anchorScene + (Date.now() - clock.anchorReal) * clock.speed);
// 시험·영상 촬영용: 장면 시각과 배속을 바꿉니다. (사용자 화면에는 영향 없음)
function setClock(sceneMs, speed = 1) {
  clock.anchorReal = Date.now();
  clock.anchorScene = sceneMs;
  clock.speed = Math.min(600, Math.max(1, speed));
  state.lastElev = null;
}

// ---------- 상태 ----------
const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem('haedoti.' + k);
      return v == null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem('haedoti.' + k, JSON.stringify(v));
    } catch {
      /* 저장 불가 환경 */
    }
  },
};

const state = {
  screen: 'home',
  profile: { name: store.get('name', ''), char: store.get('char', 'blanket'), color: store.get('color', 0) },
  placeMode: 'auto', // auto | east | west
  event: null,
  netStatus: 'connecting',
  room: null,
  seat: null,
  queuePos: null,
  wish: '',
  preview: null, // { start: performance.now(), from: Date, speed }
  lastElev: null,
  celebratedKey: null,
};

// 예전 캐릭터(동물)를 고른 적이 있으면 새 캐릭터로 바꿉니다.
if (!CHAR_LIST.some((c) => c.key === state.profile.char)) state.profile.char = CHAR_LIST[0].key;
state.profile.color = Math.abs(Number(state.profile.color) || 0) % 8;

const scene = new Scene($('scene'));
const ambience = new Ambience();

// ---------- 서버 ----------
const net = new Net({
  onStatus(s) {
    state.netStatus = s;
    if (s !== 'online') {
      scene.people = [];
      state.room = null;
    }
    updateOnlineLabels();
  },
  onRoom(m) {
    if (!state.event || m.room !== state.event.place) return;
    state.room = m;
    if (m.people.length || !m.seated) {
      scene.people = m.people
        .filter(([seat]) => seat !== state.seat)
        .map(([seat, code, flags = 0]) => ({ seat, flags, char: CHAR_LIST[Math.floor(code / 8)]?.key || CHAR_LIST[0].key, color: code % 8 }));
    }
    updateOnlineLabels();
  },
  onSeat(seat) {
    state.seat = seat;
    state.queuePos = null;
    scene.selfSeat = seat;
    scene.selfStanding = false;
    $('queue').hidden = true;
    // 켜 둔 아이템 상태를 서버에 알림 (다른 사람 화면에 촛불이 보이도록)
    if (typeof owned === 'function') for (const k of ['candle', 'bigfire']) if (owned(k)) net.use(k, itemShow[k]);
    if (state.screen === 'ride') toast('자리에 앉았어요. 함께 해를 기다려요 ☺️');
  },
  onQueue(pos) {
    state.queuePos = pos;
    state.seat = null;
    scene.selfSeat = null;
    scene.selfStanding = true;
    $('queue-pos').textContent = pos.toLocaleString('ko-KR');
    $('queue').hidden = state.screen !== 'ride';
  },
  onWallet(w) {
    setWallet(w);
  },
  onNeed(item) {
    openShop(item === 'coins' ? '소원 동전이 부족해요. 충전해 주세요' : '이 아이템은 기간이 끝났어요');
  },
  onFx(list) {
    for (const [kind, seat, extra] of list) {
      const isMe = seat === state.seat;
      if (isMe) continue; // 내 효과는 누르는 순간 바로 그립니다
      const slot = scene.slotForSeat(seat);
      // 폭죽과 소원은 보이지 않는 자리에서 보내도 하늘에는 보임
      if (kind === 'fireworks') {
        scene.fireworksFrom(slot ? slot.x : scene.W * (0.2 + Math.random() * 0.6));
        continue;
      }
      if (kind === 'wish') {
        const text = shopInfo && shopInfo.wishes[extra];
        if (text) scene.wishFrom(slot || scene.slots[Math.floor(Math.random() * Math.min(40, scene.slots.length))], text);
        continue;
      }
      if (!slot) continue;
      if (kind === 'cheer') scene.cheerAt(slot);
      else if (kind === 'ritual') scene.ritualAt(slot);
      else if (kind === 'flash') scene.flashAt(slot);
    }
  },
});
net.connect();

// ---------- 실제 날씨 (기상청) ----------
// 시험용: 주소 뒤에 ?wx=4,3,-2 (하늘 1맑음/3구름많음/4흐림, 강수 0없음/1비/3눈, 기온)
const weather = { data: null };
const wxParam = params.get('wx');
function applyWeather() {
  let w = null;
  if (wxParam) {
    const [sky, pty, temp] = wxParam.split(',').map(Number);
    const label = { 1: '비', 2: '비/눈', 3: '눈', 5: '빗방울', 7: '눈날림' }[pty] || { 1: '맑음', 3: '구름많음', 4: '흐림' }[sky] || '';
    w = { sky: sky || 1, pty: pty || 0, temp: Number.isFinite(temp) ? temp : null, label };
  } else if (weather.data && weather.data.available && state.event) {
    w = weather.data[state.event.place];
  }
  scene.weather = w;
  if (w && w.wind != null) ambience.setWind(w.wind);
  const el = $('hud-weather');
  if (w) {
    const night = scene.sunInfo().elevation < -3;
    const icon = w.pty ? ([3, 7].includes(w.pty) ? '❄️' : '🌧️') : { 1: night ? '🌙' : '☀️', 3: night ? '☁️' : '⛅', 4: '☁️' }[w.sky] || '';
    el.textContent = `${icon} ${w.label}${w.temp != null ? ` ${Math.round(w.temp)}°C` : ''}`;
    el.title = '기상청 초단기예보 기준 실제 날씨';
    el.hidden = false;
  } else el.hidden = true;
}
async function loadWeather() {
  try {
    const r = await fetch('api/weather', { cache: 'no-store' });
    if (r.ok) weather.data = await r.json();
  } catch {
    /* 서버 없음 (정적 호스팅) */
  }
  applyWeather();
}
if (location.protocol !== 'file:') {
  loadWeather();
  setInterval(loadWeather, 10 * 60 * 1000);
}

// ---------- 이벤트(장소) 결정 ----------
function pickEvent(now) {
  if (state.placeMode === 'auto') return currentEvent(now);
  return nextEventAt(state.placeMode, now) || currentEvent(now);
}

function applyEvent(ev, { animate = false } = {}) {
  const changed = !state.event || state.event.key !== ev.key;
  const placeChanged = !state.event || state.event.place !== ev.place;
  state.event = ev;
  if (!changed) return;
  scene.setPlace(ev.place, ev.time);
  state.lastElev = null;
  if (placeChanged) {
    state.room = null;
    scene.people = [];
    if (state.screen === 'ride' || state.joined) net.join(ev.place, state.profile.char, state.profile.color);
    if (animate && state.screen === 'ride') playTrain(ev);
  }
  renderEventTexts();
  if (typeof applyWeather === 'function') applyWeather();
}

function renderEventTexts() {
  const ev = state.event;
  const place = PLACES[ev.place];
  const east = ev.place === 'east';
  $('nt-place').textContent = `${place.name}행`;
  $('nt-time').textContent = formatHM(ev.time);
  $('next-train').classList.toggle('west', !east);
  $('nt-special').hidden = !ev.special;
  $('nt-special').textContent = ev.special ? `✨ ${ev.special}` : '';
  $('hud-place').textContent = place.name;
  $('hud-special').hidden = !ev.special;
  $('hud-special').textContent = ev.special ? `✨ ${ev.special}` : '';
  $('ritual-ico').textContent = east ? '🏮' : '⛵';
  $('ritual-name').textContent = place.ritual;
  $('ritual-title').textContent = east ? '소원 풍등 날리기' : '종이배 띄워 보내기';
  $('ritual-desc').textContent = east
    ? '해 뜨는 하늘에 소원을 띄워 보내요.'
    : '오늘(올해) 털어버리고 싶은 걸 적어 바다로 보내요.';
  $('ritual-text').placeholder = east ? '예) 올해는 꼭 합격!' : '예) 오늘의 실수, 잊어버리자';
  $('preview-start').textContent = east ? '⏩ 해돋이 장면 60초 미리보기' : '⏩ 해넘이 장면 60초 미리보기';
  document.querySelectorAll('.seg-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.place === state.placeMode)));
}

// ---------- 표시 갱신 ----------
function sceneTime(now) {
  const p = state.preview;
  if (!p) return now;
  const elapsed = (performance.now() - p.start) / 1000;
  const t = new Date(p.from.getTime() + elapsed * p.speed * 1000);
  if (t.getTime() > p.to.getTime()) {
    stopPreview();
    return now;
  }
  return t;
}

function updateTexts(now, tScene) {
  const ev = state.event;
  const east = ev.place === 'east';
  const diff = ev.time.getTime() - tScene.getTime();
  let label;
  let count;
  if (diff > 0) {
    label = east ? '해돋이까지' : '해넘이까지';
    count = formatCountdown(diff);
  } else {
    label = east ? '해가 떴어요 ☀️' : '해가 졌어요 🌇';
    const mins = Math.floor(-diff / 60000);
    count = mins < 1 ? '방금' : `${mins}분 전`;
  }
  $('nt-label').textContent = label;
  $('nt-count').textContent = count;
  $('hud-label').textContent = label;
  $('hud-count').textContent = count;
  $('hud-clock').textContent = formatHM(tScene);
}

function updateOnlineLabels() {
  const r = state.room;
  const s = state.netStatus;
  let text;
  if (s === 'online' && r) {
    text = `함께 보는 중 ${r.seated.toLocaleString('ko-KR')}명`;
    if (r.waiting) text += ` · 대기 ${r.waiting.toLocaleString('ko-KR')}`;
  } else if (s === 'online' || s === 'connecting') text = '연결 중…';
  else if (s === 'reconnecting') text = '다시 연결 중…';
  else if (s === 'full') text = '서버 만원 · 혼자 보기';
  else text = '혼자 보기';
  $('hud-online').textContent = text;
  const homeOnline = s === 'online' && r ? `지금 ${r.seated.toLocaleString('ko-KR')}명이 탑승해 있어요` : '';
  $('nt-online').textContent = homeOnline;
  const cheers = $('hud-cheers');
  if (s === 'online' && r && r.cheers) {
    cheers.hidden = false;
    cheers.textContent = `🙌 와! ${r.cheers.toLocaleString('ko-KR')}`;
  } else cheers.hidden = true;
}

// ---------- 메인 루프 ----------
let lastTextUpdate = 0;
let lastEventCheck = 0;
let lastDraw = 0;
const FRAME_MS = 1000 / 30; // 배터리를 아끼려고 초당 30장만 그립니다
function frame(ts) {
  if (ts - lastDraw < FRAME_MS - 2) {
    requestAnimationFrame(frame);
    return;
  }
  lastDraw = ts;
  const now = realNow();
  if (ts - lastEventCheck > 5000 && !state.preview) {
    lastEventCheck = ts;
    applyEvent(pickEvent(now), { animate: true });
  }
  const tScene = sceneTime(now);
  scene.time = tScene;
  const sun = scene.render(ts);

  // 해가 수평선을 넘는 순간
  const ev = state.event;
  const crossed =
    state.lastElev != null &&
    (ev.kind === 'sunrise'
      ? state.lastElev < HORIZON_ELEVATION && sun.elevation >= HORIZON_ELEVATION
      : state.lastElev >= HORIZON_ELEVATION && sun.elevation < HORIZON_ELEVATION);
  state.lastElev = sun.elevation;
  if (crossed && state.screen === 'ride') {
    scene.celebrate();
    toast(ev.kind === 'sunrise' ? (ev.special ? `🎉 ${ev.special}! 새해 복 많이 받으세요` : '☀️ 해가 떴어요!') : '🌇 해가 졌어요. 오늘도 수고했어요');
    $('act-card').classList.add('glow');
    setTimeout(() => $('act-card').classList.remove('glow'), 20000);
    $('sr-status').textContent = ev.kind === 'sunrise' ? '해가 떴습니다' : '해가 졌습니다';
  }

  if (ts - lastTextUpdate > 250) {
    lastTextUpdate = ts;
    updateTexts(now, tScene);
    // 별이 보일 만큼 어두울 때만 별자리 버튼 표시
    $('toggle-stars').hidden = sun.elevation > -6;
    const sh = scene.night.shower;
    const skyEl = $('hud-sky');
    if (sh && sh.rate >= 10) {
      const p = sh.peak;
      const md = `${new Date(p.getTime() + 9 * 3600e3).getUTCMonth() + 1}/${new Date(p.getTime() + 9 * 3600e3).getUTCDate()}`;
      skyEl.textContent = `☄️ ${sh.name}${Math.abs(sh.daysFromPeak) < 1 ? ' 극대' : ` (극대 ${md})`}`;
      skyEl.hidden = false;
    } else skyEl.hidden = true;
  }
  requestAnimationFrame(frame);
}

// ---------- 매표소 ----------
function buildPicker() {
  const grid = $('char-grid');
  grid.innerHTML = '';
  for (const c of CHAR_LIST) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'char-opt';
    b.setAttribute('role', 'radio');
    b.dataset.char = c.key;
    const cv = document.createElement('canvas');
    cv.width = 128;
    cv.height = 128;
    b.append(cv, document.createTextNode(c.name));
    b.addEventListener('click', () => {
      state.profile.char = c.key;
      refreshPicker();
    });
    grid.append(b);
  }
  const row = $('color-row');
  row.innerHTML = '';
  BLANKETS.forEach(([base, stripe], i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-label', `옷 색 ${i + 1}`);
    b.style.background = `radial-gradient(circle at 35% 30%, ${stripe} 0 18%, ${base} 60%)`;
    b.addEventListener('click', () => {
      state.profile.color = i;
      refreshPicker();
    });
    row.append(b);
  });
  $('nick').value = state.profile.name;
  refreshPicker();
}

function refreshPicker() {
  document.querySelectorAll('.char-opt').forEach((b) => {
    const on = b.dataset.char === state.profile.char;
    b.setAttribute('aria-checked', String(on));
    renderPortrait(b.querySelector('canvas'), b.dataset.char, state.profile.color);
  });
  document.querySelectorAll('.swatch').forEach((b, i) => b.setAttribute('aria-checked', String(i === state.profile.color)));
}

function show(screen) {
  state.screen = screen;
  for (const id of ['home', 'ticket', 'ride']) $(id).classList.toggle('active', id === screen);
  $('queue').hidden = !(screen === 'ride' && state.queuePos);
}

function waitForSeat(ms) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const iv = setInterval(() => {
      if (state.seat != null || state.queuePos != null || state.netStatus !== 'online' || Date.now() - t0 > ms) {
        clearInterval(iv);
        resolve();
      }
    }, 100);
  });
}

let ticketCanvas = null;
$('board-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('get-ticket');
  btn.disabled = true;
  btn.textContent = '발권 중…';
  state.profile.name = $('nick').value.trim().slice(0, 10);
  store.set('name', state.profile.name);
  store.set('char', state.profile.char);
  store.set('color', state.profile.color);

  // 승차권에 실제 좌석 번호를 넣기 위해 먼저 자리를 잡습니다.
  state.joined = true;
  net.join(state.event.place, state.profile.char, state.profile.color);
  await waitForSeat(1500);

  ticketCanvas = await makeTicket({
    ...state.profile,
    event: state.event,
    seat: state.seat,
    seed: hash(net.visitor || state.profile.name || 'x'),
  });
  $('ticket-img').src = ticketCanvas.toDataURL('image/png');
  net.stat('ticket');
  btn.disabled = false;
  btn.textContent = '승차권 받기';
  show('ticket');
});

$('save-ticket').addEventListener('click', async () => {
  if (!ticketCanvas) return;
  net.stat('save');
  const r = await saveOrShare(ticketCanvas, 'haedoti-ticket.png', '방구석 해돋이호 승차권 🎫 잠옷 입고 같이 해 보러 가요!');
  if (r === 'downloaded') toast('승차권 이미지를 저장했어요');
});

$('board').addEventListener('click', () => {
  scene.self = { ...state.profile };
  // 탑승 버튼을 누른 순간 배경음 시작 (브라우저는 사용자가 누른 뒤에만 소리를 허용)
  if (store.get('sound', true)) ambience.start().then((ok) => ok && setTimeout(() => toast('🌊 파도·바람·모닥불 소리가 켜졌어요. 오른쪽 위에서 끌 수 있어요'), 3200));
  show('ride');
  playTrain(state.event);
});

function playTrain(ev) {
  const place = PLACES[ev.place];
  $('train-text').textContent = `${place.name}행 ${ev.kind === 'sunrise' ? '해돋이호' : '해넘이호'}가 출발합니다`;
  const ov = $('train');
  ov.hidden = false;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  setTimeout(() => {
    ov.hidden = true;
    const diff = ev.time - realNow();
    if (diff > 90 * 60000) {
      toast(`${ev.kind === 'sunrise' ? '해돋이' : '해넘이'}까지 ${Math.round(diff / 3600000)}시간쯤 남았어요. ☰ 에서 미리보기를 해 보세요`);
    }
  }, reduce ? 900 : 2700);
}

// ---------- 탑승 중 버튼 ----------
$('act-cheer').addEventListener('click', () => {
  scene.cheerAt(scene.mySlot, true);
  net.cheer();
  if (navigator.vibrate) navigator.vibrate(20);
});

$('act-ritual').addEventListener('click', () => {
  $('ritual-text').value = state.wish;
  $('ritual').showModal();
});
$('ritual-form').addEventListener('submit', (e) => {
  const send = e.submitter && e.submitter.value === 'send';
  if (!send) return;
  state.wish = $('ritual-text').value.trim().slice(0, 40);
  scene.ritualAt(scene.mySlot, true);
  net.ritual();
  toast(state.event.place === 'east' ? '🏮 소원 풍등이 하늘로 올라가요' : '⛵ 종이배가 바다로 떠나요');
});

$('act-card').addEventListener('click', async () => {
  $('act-card').classList.remove('glow');
  const r = state.room;
  const witnesses = state.netStatus === 'online' && r ? Math.max(r.witnesses || 0, r.seated || 0) : 0;
  const canvas = await makeProofCard({
    sceneCanvas: $('scene'),
    event: state.event,
    name: state.profile.name,
    witnesses,
    wish: state.wish,
    focusY: scene.mySlot ? scene.mySlot.y : null,
  });
  cardCanvas = canvas;
  net.stat('card');
  $('card-img').src = canvas.toDataURL('image/png');
  $('card').showModal();
});
let cardCanvas = null;
$('card-close').addEventListener('click', () => $('card').close());
$('card-save').addEventListener('click', async () => {
  if (!cardCanvas) return;
  net.stat('save');
  const r = await saveOrShare(cardCanvas, 'haedoti-card.png', '방구석 해돋이호에서 해를 봤어요 🌅');
  if (r === 'downloaded') toast('인증 카드를 저장했어요');
});

$('act-menu').addEventListener('click', () => $('menu').showModal());
$('menu-close').addEventListener('click', () => $('menu').close());
document.querySelectorAll('.seg-btn').forEach((b) =>
  b.addEventListener('click', () => {
    state.placeMode = b.dataset.place;
    stopPreview();
    applyEvent(pickEvent(realNow()), { animate: true });
    renderEventTexts();
    $('menu').close();
  }),
);

$('preview-start').addEventListener('click', () => {
  $('menu').close();
  const ev = state.event;
  // 해돋이: 50분 전 → 25분 후 / 해넘이: 25분 전 → 50분 후 를 60초에
  const before = ev.kind === 'sunrise' ? 50 : 25;
  const after = ev.kind === 'sunrise' ? 25 : 50;
  state.preview = {
    start: performance.now(),
    from: new Date(ev.time.getTime() - before * 60000),
    to: new Date(ev.time.getTime() + after * 60000),
    speed: ((before + after) * 60) / 60,
  };
  state.lastElev = null;
  $('preview-bar').hidden = false;
  net.stat('preview');
});
$('preview-stop').addEventListener('click', stopPreview);
function stopPreview() {
  if (!state.preview) return;
  state.preview = null;
  state.lastElev = null;
  $('preview-bar').hidden = true;
}

$('show-help').addEventListener('click', () => {
  $('menu').close();
  $('help').showModal();
});
$('help-close').addEventListener('click', () => $('help').close());

// ---------- 상점 · 아이템 · 동전 소원 ----------
let shopInfo = null;
let myWallet = { coins: 0, items: {} };
const itemShow = { candle: store.get('show.candle', true), bigfire: store.get('show.bigfire', true) };
const cooldown = {};

function owned(item) {
  return (myWallet.items[item] || 0) > Date.now();
}

function setWallet(w) {
  if (!w) return;
  myWallet = w;
  scene.selfItems.candle = owned('candle') && itemShow.candle;
  scene.selfItems.bigfire = owned('bigfire') && itemShow.bigfire;
  document.querySelectorAll('.item-btn[data-item]').forEach((b) => {
    const k = b.dataset.item;
    b.hidden = !owned(k);
    if (k === 'candle' || k === 'bigfire') b.setAttribute('aria-pressed', String(itemShow[k]));
  });
  $('wish-coins').textContent = myWallet.coins;
  $('shop-coins').textContent = myWallet.coins;
  if (shopInfo && $('shopdlg').open) renderProducts();
}

async function loadShop() {
  try {
    const r = await fetch(`api/shop?visitor=${encodeURIComponent(net.visitor || '')}`, { cache: 'no-store' });
    if (!r.ok) return;
    shopInfo = await r.json();
    $('open-shop').hidden = shopInfo.mode === 'off';
    $('menu-shop').hidden = shopInfo.mode === 'off';
    $('act-wish').hidden = shopInfo.mode === 'off';
    setWallet(shopInfo.wallet);
    renderWishes();
  } catch {
    // 서버 없음 (정적 호스팅): 상점 숨김
    $('open-shop').hidden = true;
    $('menu-shop').hidden = true;
    $('act-wish').hidden = true;
  }
}

function fmtDate(ms) {
  const d = new Date(ms + 9 * 3600e3);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
}

function renderProducts() {
  const list = $('product-list');
  list.innerHTML = '';
  $('shop-test').hidden = shopInfo.mode !== 'test';
  for (const [key, p] of Object.entries(shopInfo.products)) {
    const row = document.createElement('div');
    row.className = 'product';
    const until = owned(key) ? `<div class="p-own">✓ ${fmtDate(myWallet.items[key])}까지 사용 가능</div>` : '';
    row.innerHTML = `<div class="p-ico">${p.icon}</div><div><div class="p-name"></div><div class="p-desc"></div>${until}</div>`;
    row.querySelector('.p-name').textContent = p.name;
    row.querySelector('.p-desc').textContent = p.desc;
    const b = document.createElement('button');
    b.className = 'btn primary';
    b.textContent = `${p.price.toLocaleString('ko-KR')}원`;
    b.addEventListener('click', () => buy(key, b));
    row.append(b);
    list.append(row);
  }
}

function openShop(msg) {
  if (!shopInfo || shopInfo.mode === 'off') return;
  renderProducts();
  if ($('wishdlg').open) $('wishdlg').close();
  if (!$('shopdlg').open) $('shopdlg').showModal();
  if (msg) toast(msg);
}

async function buy(product, btn) {
  btn.disabled = true;
  try {
    const r = await fetch('api/shop/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visitor: net.visitor, product }) });
    const order = await r.json();
    if (!r.ok) throw new Error(order.error || '주문 실패');
    if (shopInfo.mode === 'live') {
      // 토스페이먼츠 결제창 (결제 후 이 페이지로 돌아와 확인)
      await loadScript('https://js.tosspayments.com/v2/standard');
      const tp = window.TossPayments(shopInfo.clientKey);
      const payment = tp.payment({ customerKey: order.customerKey });
      store.set('pendingOrder', order.orderId);
      await payment.requestPayment({
        method: 'CARD',
        amount: { currency: 'KRW', value: order.amount },
        orderId: order.orderId,
        orderName: order.orderName,
        successUrl: `${location.origin}${location.pathname}?pay=success`,
        failUrl: `${location.origin}${location.pathname}?pay=fail`,
      });
      return;
    }
    await confirmPayment({ orderId: order.orderId, paymentKey: 'test', amount: order.amount });
  } catch (err) {
    if (err && err.code !== 'USER_CANCEL') toast(err.message || '결제에 실패했어요');
  } finally {
    btn.disabled = false;
  }
}

async function confirmPayment(q) {
  const r = await fetch('api/shop/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(q) });
  const res = await r.json();
  if (!r.ok) throw new Error(res.error || '결제 확인 실패');
  setWallet(res.wallet);
  toast(res.test ? '🧪 테스트 구매 완료! 아이템이 생겼어요' : '🎉 구매 완료! 아이템이 생겼어요');
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const el = document.createElement('script');
    el.src = src;
    el.onload = resolve;
    el.onerror = () => reject(new Error('결제창을 불러오지 못했어요'));
    document.head.append(el);
  });
}

// 결제창에서 돌아왔을 때
if (params.get('pay') === 'success' && params.get('paymentKey')) {
  confirmPayment({ orderId: params.get('orderId'), paymentKey: params.get('paymentKey'), amount: Number(params.get('amount')) })
    .catch((e) => toast(e.message))
    .finally(() => history.replaceState(null, '', location.pathname));
} else if (params.get('pay') === 'fail') {
  setTimeout(() => toast(params.get('message') || '결제를 취소했어요'), 500);
  history.replaceState(null, '', location.pathname);
}

function renderWishes() {
  const grid = $('wish-grid');
  grid.innerHTML = '';
  (shopInfo?.wishes || []).forEach((text, i) => {
    const b = document.createElement('button');
    b.className = 'wish-opt';
    b.textContent = text;
    b.addEventListener('click', () => throwCoin(i));
    grid.append(b);
  });
}

function throwCoin(i) {
  if (myWallet.coins < 1) {
    openShop('소원 동전이 부족해요. 충전해 주세요');
    return;
  }
  if (state.seat == null && state.netStatus === 'online') {
    toast('자리에 앉은 뒤에 던질 수 있어요');
    return;
  }
  if (state.netStatus !== 'online') {
    toast('함께 보기 서버에 연결된 뒤에 던질 수 있어요');
    return;
  }
  myWallet.coins -= 1; // 화면에 먼저 반영, 서버 응답으로 다시 맞춤
  setWallet(myWallet);
  scene.wishFrom(scene.mySlot, shopInfo.wishes[i], true);
  net.wish(i);
  $('wishdlg').close();
}

$('act-wish').addEventListener('click', () => {
  if (!shopInfo) return;
  $('wish-coins').textContent = myWallet.coins;
  $('wishdlg').showModal();
});
$('wish-close').addEventListener('click', () => $('wishdlg').close());
$('wish-buy').addEventListener('click', () => openShop());
$('open-shop').addEventListener('click', () => openShop());
$('menu-shop').addEventListener('click', () => {
  $('menu').close();
  openShop();
});
$('shop-close').addEventListener('click', () => $('shopdlg').close());

document.querySelectorAll('.item-btn[data-item]').forEach((b) =>
  b.addEventListener('click', () => {
    const k = b.dataset.item;
    if (!owned(k)) return openShop();
    if (k === 'candle' || k === 'bigfire') {
      itemShow[k] = !itemShow[k];
      store.set('show.' + k, itemShow[k]);
      net.use(k, itemShow[k]);
      setWallet(myWallet);
      return;
    }
    const gap = k === 'fireworks' ? 15000 : 2500;
    if (Date.now() - (cooldown[k] || 0) < gap) return toast(k === 'fireworks' ? '폭죽은 15초에 한 번 쏠 수 있어요' : '잠시 후 다시 흔들 수 있어요');
    cooldown[k] = Date.now();
    b.classList.add('cooling');
    setTimeout(() => b.classList.remove('cooling'), gap);
    if (k === 'fireworks') scene.fireworksFrom(scene.mySlot.x);
    else scene.flashAt(scene.mySlot);
    net.use(k);
  }),
);

$('show-code').addEventListener('click', async () => {
  const r = await fetch('api/shop/code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visitor: net.visitor }) });
  const res = await r.json();
  $('code-out').hidden = false;
  $('code-out').textContent = res.code || res.error;
});
$('restore-btn').addEventListener('click', async () => {
  const r = await fetch('api/shop/restore', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: $('restore-input').value }) });
  const res = await r.json();
  if (!r.ok) return toast(res.error || '복구 실패');
  net.adoptVisitor(res.visitor);
  setWallet(res.wallet);
  toast('구매 내역을 불러왔어요');
});

scene.onBoom = () => ambience.boom();
scene.onCoin = () => ambience.plop();
loadShop();

// ---------- 배경음 (파도·바람·모닥불) ----------
function soundButton() {
  const on = ambience.on;
  $('toggle-sound').setAttribute('aria-pressed', String(on));
  $('toggle-sound').title = on ? '소리 끄기' : '소리 켜기';
}
$('toggle-sound').addEventListener('click', async () => {
  if (ambience.on) {
    ambience.stop();
    store.set('sound', false);
  } else {
    await ambience.start();
    store.set('sound', true);
  }
  soundButton();
});
document.addEventListener('visibilitychange', () => ambience.setHidden(document.hidden));
setInterval(soundButton, 1000);

// ---------- 별자리 보기 (기본은 끔, 기기에 기억) ----------
function setConstellations(on) {
  scene.night.showConstellations = on;
  $('toggle-stars').setAttribute('aria-pressed', String(on));
  $('toggle-stars').title = on ? '별자리 숨기기' : '별자리 보기';
  store.set('constellations', on);
}
setConstellations(store.get('constellations', false) === true);
$('toggle-stars').addEventListener('click', () => {
  const on = !scene.night.showConstellations;
  setConstellations(on);
  toast(on ? '별자리 선과 이름을 보여드려요' : '별자리를 숨겼어요');
});

// ---------- 알림 ----------
let toastTimer = null;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 3600);
}

function hash(str) {
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

// ---------- 시작 ----------
applyEvent(pickEvent(realNow()));
buildPicker();
document.fonts && document.fonts.ready.then(refreshPicker);
requestAnimationFrame(frame);

// 개발·시험용
window.__haedoti = { state, scene, net, solarPosition, EVENT_AFTERGLOW_MS, setClock, ambience };
