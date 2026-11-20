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
  profile: { name: store.get('name', ''), char: store.get('char', 'otter'), color: store.get('color', 0) },
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

const scene = new Scene($('scene'));

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
        .map(([seat, code]) => ({ seat, char: CHAR_LIST[Math.floor(code / 8)]?.key || 'otter', color: code % 8 }));
    }
    updateOnlineLabels();
  },
  onSeat(seat) {
    state.seat = seat;
    state.queuePos = null;
    scene.selfSeat = seat;
    scene.selfStanding = false;
    $('queue').hidden = true;
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
  onFx(list) {
    for (const [kind, seat] of list) {
      const isMe = seat === state.seat;
      if (isMe) continue; // 내 효과는 누르는 순간 바로 그립니다
      const slot = scene.slotForSeat(seat);
      if (!slot) continue;
      if (kind === 'cheer') scene.cheerAt(slot);
      else if (kind === 'ritual') scene.ritualAt(slot);
    }
  },
});
net.connect();

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
    b.setAttribute('aria-label', `담요 색 ${i + 1}`);
    b.style.background = `repeating-linear-gradient(0deg, ${base} 0 7px, ${stripe} 7px 10px)`;
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
  btn.textContent = '승차권 받기 🎫';
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
window.__haedoti = { state, scene, net, solarPosition, EVENT_AFTERGLOW_MS, setClock };
