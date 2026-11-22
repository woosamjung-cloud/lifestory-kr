// 이불 밖은 추우니까 (방구석 해돋이호) - 화면 흐름과 상호작용

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
import { Scene, FUEL_SECONDS } from './scene.js';
import { CHAR_LIST, BLANKETS, HAIRS, PETS, renderPortrait, renderPetPortrait } from './characters.js';
import { Net } from './net.js';
import { makeTicket, makeProofCard, saveOrShare, downloadCanvas, shareImage } from './cards.js';
import { todayLine, loadDays, recordDay, dayStats } from './daily.js';
import { t, tOr, getLang, setLang, applyI18n, startAutoTranslate, LANGS, L } from './i18n.js';
import { COUNTRIES, DESTINATIONS } from './countries.js';
import { Ambience } from './ambience.js';
import { Music } from './music.js';

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
  profile: { name: store.get('name', ''), char: store.get('char', 'blanket'), color: store.get('color', 0), hair: store.get('hair', 0), pet: store.get('pet', 0), petName: store.get('petName', '') },
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
const music = new Music();

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
        .map(([seat, code, flags = 0, px, py, up = 0]) => ({ seat, flags, up: !!up, pos: px != null ? [px, py] : null, pet: Math.floor(code / 384), hair: Math.floor((code % 384) / 64), char: CHAR_LIST[Math.floor((code % 64) / 8)]?.key || CHAR_LIST[0].key, color: code % 8 }));
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
  onNewVersion() {
    // 새 버전 배포: 잠시 알린 뒤 새로 고침, 탑승 중이었다면 자동으로 다시 탑승
    toast('새 버전으로 바뀌어요 ✨');
    try {
      if (state.screen === 'ride') sessionStorage.setItem('haedoti.autoboard', '1');
    } catch {
      /* 저장 불가 */
    }
    setTimeout(() => location.reload(), 2500);
  },
  onWallet(w) {
    setWallet(w);
  },
  onWhisper(m) {
    const text = shopInfo && shopInfo.whispers[m.i];
    if (!text) return;
    if (m.self) {
      talked.set(m.to, Date.now());
      scene.bubbleAt(scene.mySlot, text, true);
      return;
    }
    talked.set(m.from, Date.now());
    const slot = scene.slotForSeat(m.from);
    scene.bubbleAt(slot, text);
    toast(`💬 누군가 말을 건넸어요: "${text}" · 그 사람을 눌러 답해 보세요`);
  },
  onSayResult(m) {
    if (m.t === 'sayok') {
      customNext = m.next ? Date.now() + (m.next - Date.now()) : Date.now() + CUSTOM_GAP;
      store.set('customNext', customNext);
      return;
    }
    // 거절되면 화면에 띄운 내 말 지우고 이유 안내
    document.querySelectorAll('.say.me.pending').forEach((el) => el.remove());
    if (m.wait) {
      customNext = Date.now() + m.wait;
      store.set('customNext', customNext);
    } else customNext = 0;
    toast(m.error ? `💬 ${m.error}` : `💬 직접 쓴 한마디는 10분에 한 번이에요 (${fmtWait(customNext - Date.now())} 남음)`);
    renderCustomRow();
  },
  onGotHeart(m) {
    setWallet(m.wallet);
    toast(`❤️ 하트를 선물 받았어요 (모두 ${m.total.toLocaleString('ko-KR')}개)`);
  },
  onNeed(item) {
    if (item === 'talk') return toast('💬 먼저 한마디 건네 보세요. 이야기를 나눈 사이에만 하트를 줄 수 있어요');
    item === 'coins' ? openShop('소원 동전이 부족해요. 충전해 주세요', 'coins') : openShop('이 아이템은 기간이 끝났어요', 'items', item);
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
      if (kind === 'heart') {
        scene.heartFrom(slot, scene.slotForSeat(extra), extra === state.seat);
        continue;
      }
      if (kind === 'wood') {
        scene.throwWood(slot);
        continue;
      }
      if (kind === 'say') {
        const f = list.find((x) => x[0] === 'say' && x[1] === seat && x[2] === extra);
        const text = extra === -1 ? f && f[4] : shopInfo && shopInfo.sayings[extra];
        if (text && seat !== state.seat) showSay(text, false, (f && f[3]) || 1);
        continue;
      }
      if (kind === 'wish') {
        const text = shopInfo && shopInfo.wishes[extra];
        if (text) scene.wishFrom(slot || scene.slots[Math.floor(Math.random() * Math.min(40, scene.slots.length))], text);
        continue;
      }
      if (!slot) continue;
      if (kind === 'cheer') {
        scene.cheerAt(slot);
        ambience.cheer(1, 0.35); // 다른 사람의 와!는 작게
      }
      else if (kind === 'ritual') scene.ritualAt(slot, false, extra != null && shopInfo ? ritualList()[extra] : null);
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
  return destEvent(state.placeMode, now) || currentEvent(now);
}

// ---------- 매표소: 행선지 승차권 (나라·장소가 늘면 한 줄씩 추가) ----------
// 행선지 목록과 나라 정보는 countries.js에서 (나라·장소가 늘면 그 파일만 고치면 됨)
const DESTS = DESTINATIONS.filter((k) => PLACES[k]).map((k) => ({ key: k, country: PLACES[k].country }));
const placeName = (key) => PLACES[key].names?.[getLang()] ?? tOr(`place.${key}`, PLACES[key].name);
// 그 장소의 지금 진행 중이거나 다음 해돋이·해넘이
function destEvent(key, now) {
  const cur = currentEvent(now);
  return cur && cur.place === key ? cur : nextEventAt(key, now);
}
function destText(key, now) {
  const ev = destEvent(key, now);
  if (!ev) return null;
  const kind = PLACES[key].kind;
  const diff = ev.time.getTime() - now.getTime();
  if (diff > 0) return { ev, kind, label: t(`dest.until.${kind}`), count: formatCountdown(diff) };
  const mins = Math.floor(-diff / 60000);
  return { ev, kind, label: t(`dest.done.${kind}`), count: mins < 1 ? t('dest.justnow') : t('dest.ago', { m: mins }) };
}
function renderDepartures() {
  const box = $('dest-list');
  if (!box) return;
  const now = realNow();
  const sel = state.event ? state.event.place : null;
  box.innerHTML = '';
  for (const d of DESTS) {
    const x = destText(d.key, now);
    if (!x) continue;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `dest-ticket ${x.kind}`;
    b.dataset.place = d.key;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(d.key === sel));
    b.innerHTML =
      '<div class="dt-main"><div class="dt-country"><span class="dt-flag"></span><span class="dt-cname"></span><span class="dt-en"></span></div>' +
      '<div class="dt-place"></div><div class="dt-event"></div><div class="dt-special" hidden></div></div>' +
      '<div class="dt-stub"><div class="dt-time"></div><div class="dt-label"></div><div class="dt-count"></div><div class="dt-check"></div></div>';
    const c = COUNTRIES[d.country] || { flag: '', code: '', names: {} };
    const cname = c.names[getLang()] || '';
    b.querySelector('.dt-flag').textContent = c.flag;
    // 나라 이름: 그 언어 이름 + 영문 코드 (영어면 코드만)
    b.querySelector('.dt-cname').textContent = cname.toUpperCase() === c.code ? '' : cname;
    b.querySelector('.dt-en').textContent = c.code;
    b.querySelector('.dt-place').textContent = t('dest.bound', { place: placeName(d.key) });
    b.querySelector('.dt-event').textContent = t(`event.${x.kind}`);
    if (x.ev.special) {
      b.querySelector('.dt-special').hidden = false;
      b.querySelector('.dt-special').textContent = `✨ ${L(x.ev.special)}`;
    }
    b.querySelector('.dt-time').textContent = formatHM(x.ev.time);
    b.querySelector('.dt-check').textContent = d.key === sel ? `✓ ${t('booth.selected')}` : '';
    b.addEventListener('click', () => {
      state.placeMode = d.key;
      stopPreview();
      applyEvent(pickEvent(realNow()));
      renderEventTexts();
    });
    box.append(b);
  }
  updateDepartures();
}
function updateDepartures() {
  const now = realNow();
  document.querySelectorAll('.dest-ticket').forEach((b) => {
    const x = destText(b.dataset.place, now);
    if (!x) return;
    b.querySelector('.dt-label').textContent = x.label;
    b.querySelector('.dt-count').textContent = x.count;
  });
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
    if (state.screen === 'ride' || state.joined) net.join(ev.place, state.profile.char, state.profile.color, state.profile.hair, state.profile.pet);
    if (animate && state.screen === 'ride') playTrain(ev);
  }
  renderEventTexts();
  renderDaily();
  if (typeof applyWeather === 'function') applyWeather();
}

function renderDaily() {
  const [text, src] = todayLine(new Date(), getLang());
  $('tl-text').textContent = text;
  $('tl-src').textContent = src ? `— ${src}` : '';
  $('tl-src').hidden = !src;
  $('my-days').hidden = true; // 숫자 기록은 화면에 보이지 않게 (탑승할 때 인사로만)
}

function renderEventTexts() {
  const ev = state.event;
  const place = PLACES[ev.place];
  const east = ev.place === 'east';
  renderDepartures();
  $('hud-place').textContent = place.name;
  $('hud-special').hidden = !ev.special;
  $('hud-special').textContent = ev.special ? `✨ ${ev.special}` : '';
  $('ritual-ico').textContent = east ? '🏮' : '🍾';
  $('ritual-name').textContent = place.ritual;
  $('ritual-title').textContent = east ? '소원 풍등' : '그리운 이에게, 유리병 편지';
  $('ritual-desc').textContent = east
    ? '소원을 담아서 띄워 보세요.'
    : '보고 싶은 사람에게 짧은 편지를 써서 유리병에 담아 노을 속으로 띄워 보내요.';
  $('ritual-text').placeholder = east ? '예) 우리 가족 모두 건강하길' : '예) 엄마, 오늘 노을이 참 예뻐요';
  $('pw-what').textContent = east ? '고른 문구가 풍등에 적혀 함께 보는 모든 분께 보여요.' : '고른 문구가 유리병에 적혀 함께 보는 모든 분께 보여요.';
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
  updateDepartures();
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
  const homeOnline = s === 'online' && r ? t('booth.online', { n: r.seated.toLocaleString('ko-KR') }) : '';
  $('nt-online').textContent = homeOnline;
  const woodEl = $('hud-wood');
  if (s === 'online' && r && r.wood) {
    // 1,000개마다 불꽃이 크게 피어오름
    if (state.lastWood != null && Math.floor(r.wood / 1000) > Math.floor(state.lastWood / 1000)) {
      scene.fireBoost = 2;
      toast(`🔥 다 함께 장작 ${(Math.floor(r.wood / 1000) * 1000).toLocaleString('ko-KR')}개! 불이 활활 타올라요`);
    }
    state.lastWood = r.wood;
    woodEl.hidden = false;
    woodEl.textContent = `🪵 장작 ${r.wood.toLocaleString('ko-KR')}`;
  } else woodEl.hidden = true;
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
    b.append(cv, document.createTextNode(tOr(`char.${c.key}`, c.name)));
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
  const hrow = $('hair-row');
  hrow.innerHTML = '';
  HAIRS.forEach(([name, col], i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch hair-swatch';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-label', `머리 색 ${name}`);
    b.title = name;
    b.style.background = col;
    b.addEventListener('click', () => {
      state.profile.hair = i;
      refreshPicker();
    });
    hrow.append(b);
  });
  const prow = $('pet-row');
  prow.innerHTML = '';
  PETS.forEach(([name], i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pet-opt';
    b.setAttribute('role', 'radio');
    b.innerHTML = '<canvas aria-hidden="true"></canvas><span></span>';
    b.querySelector('span').textContent = tOr(`pet.${i}`, name);
    b.title = tOr(`pet.${i}`, name);
    b.addEventListener('click', () => {
      state.profile.pet = i;
      refreshPicker();
    });
    prow.append(b);
    requestAnimationFrame(() => renderPetPortrait(b.querySelector('canvas'), i));
  });
  $('petname').value = state.profile.petName;
  $('nick').value = state.profile.name;
  refreshPicker();
}

function refreshPicker() {
  document.querySelectorAll('.char-opt').forEach((b) => {
    const on = b.dataset.char === state.profile.char;
    b.setAttribute('aria-checked', String(on));
    renderPortrait(b.querySelector('canvas'), b.dataset.char, state.profile.color, state.profile.hair);
  });
  document.querySelectorAll('#color-row .swatch').forEach((b, i) => b.setAttribute('aria-checked', String(i === state.profile.color)));
  document.querySelectorAll('#hair-row .swatch').forEach((b, i) => b.setAttribute('aria-checked', String(i === state.profile.hair)));
  document.querySelectorAll('.pet-opt').forEach((b, i) => b.setAttribute('aria-checked', String(i === state.profile.pet)));
  $('petname-wrap').hidden = !state.profile.pet;
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
  store.set('hair', state.profile.hair);
  store.set('pet', state.profile.pet);
  state.profile.petName = $('petname').value.trim().slice(0, 8);
  store.set('petName', state.profile.petName);

  // 승차권에 실제 좌석 번호를 넣기 위해 먼저 자리를 잡습니다.
  state.joined = true;
  net.join(state.event.place, state.profile.char, state.profile.color, state.profile.hair, state.profile.pet);
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
  btn.textContent = t('form.ticket');
  show('ticket');
});

$('save-ticket').addEventListener('click', async () => {
  if (!ticketCanvas) return;
  net.stat('save');
  await downloadCanvas(ticketCanvas, 'haedoji-ticket.png');
  toast('📥 승차권을 저장했어요');
});

// 휴대폰 기울기로 화면이 흐르게 (조이스틱처럼)
function onTilt(e) {
  if (e.gamma == null) return;
  const portrait = innerHeight >= innerWidth;
  // 가로 화면이면 앞뒤 기울기(beta)가 좌우 방향
  const sideways = screen.orientation && screen.orientation.angle === 90 ? 1 : -1;
  const g = portrait ? e.gamma : sideways * e.beta; // 좌우
  const b = portrait ? e.beta : -sideways * e.gamma; // 앞뒤
  scene.tiltG = scene.tiltG * 0.85 + g * 0.15;
  scene.tiltB = scene.tiltB == null ? b : scene.tiltB * 0.85 + b * 0.15;
}
function enableTilt() {
  const DOE = window.DeviceOrientationEvent;
  if (!DOE) return;
  if (typeof DOE.requestPermission === 'function') {
    DOE.requestPermission().then((r) => r === 'granted' && addEventListener('deviceorientation', onTilt)).catch(() => {});
  } else addEventListener('deviceorientation', onTilt);
}

$('board').addEventListener('click', () => {
  enableTilt();
  scene.self = { ...state.profile };
  // 나의 하루 기록 (미리보기·해외 장소는 세지 않음)
  if (state.event && (state.event.place === 'east' || state.event.place === 'west')) {
    const before = dayStats(loadDays(store)).total;
    const st = dayStats(recordDay(store, state.event.place));
    if (st.total > before && st.total > 1) setTimeout(() => toast(`🌱 오늘로 ${st.total}번째 하루를 함께해요`), 2500);
    renderDaily();
  }
  // 탑승 화면의 버튼 위치에 맞춰 자리 다시 배치
  requestAnimationFrame(() => scene.layoutSlots());
  // 탑승 버튼을 누른 순간 배경음 시작 (브라우저는 사용자가 누른 뒤에만 소리를 허용)
  // 처음 탑승하면 놀이 방법 안내
  if (!store.get('playHint', false)) {
    store.set('playHint', true);
    setTimeout(() => toast('👆 모래를 누르면 걸어가요 · ↔ 옆으로 끌면 해변 구경 · ↓ 아래로 쓸면 앉아요 · 🔥 불을 누르면 장작'), 7000);
  }
  if (store.get('sound', true)) ambience.start().then((ok) => ok && setTimeout(() => toast('🌊 파도·바람·모닥불 소리가 켜졌어요. 오른쪽 위에서 끌 수 있어요'), 3200));
  show('ride');
  playTrain(state.event);
});

function playTrain(ev) {
  const place = PLACES[ev.place];
  $('train-text').textContent = `${place.name}행 ${ev.kind === 'sunrise' ? '해돋이호' : '해넘이호'}가 출발합니다`;
  const ov = $('train');
  ov.hidden = false;
  // 기차 소리 (소리가 켜져 있을 때만, 탑승 직후엔 소리가 켜질 때까지 잠깐 기다림)
  setTimeout(() => ambience.train(), 250);
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
  ambience.cheer(2, 1);
  net.cheer();
  if (navigator.vibrate) navigator.vibrate(20);
});

let publicWish = null; // 동전으로 공개할 소원 문구 번호
// 해돋이(풍등)는 소원, 해넘이(유리병)는 그리운 이에게 보내는 편지 문구
function ritualList() {
  const sunset = state.event && PLACES[state.event.place].kind === 'sunset';
  return (sunset && shopInfo.letters) || shopInfo.wishes;
}
$('act-ritual').addEventListener('click', () => {
  $('ritual-text').value = state.wish;
  publicWish = null;
  // 상점이 열려 있으면 동전으로 공개 소원 달기
  const box = $('public-wish');
  box.hidden = !shopInfo || shopInfo.mode === 'off' || state.netStatus !== 'online';
  if (!box.hidden) {
    $('pw-coins').textContent = myWallet.coins;
    const chips = $('pw-chips');
    chips.innerHTML = '';
    ritualList().forEach((text, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pw-chip';
      b.textContent = text;
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => {
        publicWish = publicWish === i ? null : i;
        chips.querySelectorAll('.pw-chip').forEach((c, k) => c.setAttribute('aria-pressed', String(k === publicWish)));
        $('ritual-send').textContent = publicWish != null ? '🪙 동전 1개로 띄우기' : '띄워 보내기';
      });
      chips.append(b);
    });
  }
  $('ritual-send').textContent = '띄워 보내기';
  $('ritual').showModal();
});
$('ritual-form').addEventListener('submit', (e) => {
  const send = e.submitter && e.submitter.value === 'send';
  if (!send) return;
  if (publicWish != null && myWallet.coins < 1) {
    e.preventDefault();
    $('ritual').close();
    openShop('소원 동전이 부족해요. 충전해 주세요', 'coins');
    return;
  }
  state.wish = $('ritual-text').value.trim().slice(0, 40);
  const text = publicWish != null ? ritualList()[publicWish] : null;
  scene.ritualAt(scene.mySlot, true, text);
  if (text) {
    myWallet.coins -= 1;
    setWallet(myWallet);
    if (scene.onCoin) scene.onCoin();
  }
  net.ritual(publicWish);
  const place = state.event.place;
  const lantern = PLACES[place].kind === 'sunrise';
  toast(text ? (lantern ? `🏮 "${text}" 소원이 모두의 하늘에 떠올라요` : `🍾 "${text}" 편지가 모두의 바다에 떠가요`) : lantern ? '🏮 소원 풍등이 하늘로 올라가요' : '🍾 그리운 이에게 편지가 떠나요');
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
const CARD_FILE = 'haedoji-card.png';
const shareUrl = () => `${location.origin}/`;
const shareText = () => {
  const ev = state.event;
  const what = ev && PLACES[ev.place].kind === 'sunset' ? '노을' : '해돋이';
  return `이불 밖은 추우니까, 방에서 오늘의 ${what}를 함께 봤어요 🌅`;
};
async function copyLink() {
  try {
    await navigator.clipboard.writeText(`${shareText()} ${shareUrl()}`);
    return true;
  } catch {
    return false;
  }
}
$('card-save').addEventListener('click', async () => {
  if (!cardCanvas) return;
  net.stat('save');
  await downloadCanvas(cardCanvas, CARD_FILE);
  toast('📥 인증 사진을 저장했어요');
});

// SNS 바로 공유 (인증 사진·승차권 같이 씀)
async function shareTo(k, canvas, file, text) {
  if (!canvas) return;
  net.stat('save');
  const url = shareUrl();
  const enc = encodeURIComponent;
  // 글쓰기 화면으로 바로 가는 곳: 창은 누른 즉시 열어야 막히지 않음
  const intents = {
    threads: `https://www.threads.net/intent/post?text=${enc(`${text} ${url}`)}`,
    x: `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
  };
  if (intents[k]) {
    window.open(intents[k], '_blank', 'noopener');
    if (k !== 'facebook') {
      await downloadCanvas(canvas, file);
      toast('📥 사진도 저장했어요. 글쓰기 화면에서 사진을 첨부해 주세요');
    }
    return;
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      return true;
    } catch {
      return false;
    }
  };
  if (k === 'link') return toast((await copy()) ? '🔗 링크를 복사했어요' : '링크 복사가 안 돼요. 주소창의 주소를 복사해 주세요');
  // 카카오톡·인스타그램: 휴대폰은 공유 창(사진 포함)에서 앱 선택
  const r = await shareImage(canvas, file, `${text} ${url}`);
  if (r === true || r === 'cancelled') return;
  await downloadCanvas(canvas, file);
  const copied = await copy();
  if (k === 'instagram') {
    window.open('https://www.instagram.com/', '_blank', 'noopener');
    toast('📥 사진을 저장했어요. 인스타그램에서 새 게시물로 올려 주세요');
  } else if (k === 'kakao') toast(`📥 사진을 저장했어요${copied ? ' · 🔗 링크도 복사했어요' : ''}. 카카오톡에 보내 주세요`);
  else toast(`📥 사진을 저장했어요${copied ? ' · 🔗 링크도 복사했어요' : ''}`);
}
const TICKET_FILE = 'haedoji-ticket.png';
const TICKET_TEXT = '이불 밖은 추우니까 🎫 방구석 해돋이호 승차권 나왔어요. 잠옷 입고 같이 해 보러 가요!';
document.querySelectorAll('#card .sns').forEach((b) => b.addEventListener('click', () => shareTo(b.dataset.sns, cardCanvas, CARD_FILE, shareText())));
document.querySelectorAll('#ticket .sns').forEach((b) => b.addEventListener('click', () => shareTo(b.dataset.sns, ticketCanvas, TICKET_FILE, TICKET_TEXT)));

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
  $('login-who').hidden = !myWallet.email;
  if (myWallet.email) $('login-who').textContent = `👤 ${myWallet.email} 로 로그인됨`;
  const hh = myWallet.hearts;
  const hp = $('hud-hearts');
  if (hh) {
    hp.hidden = false;
    hp.textContent = `❤️ 받은 ${hh.received.toLocaleString('ko-KR')} · 준 ${hh.given.toLocaleString('ko-KR')}`;
  }
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

// 상점: 처음엔 큰 두 갈래(소원 동전 / 아이템), 들어가면 고르고 사기
let shopView = 'main';
let shopPick = null;
const won = (n) => `${n.toLocaleString('ko-KR')}원`;
// 결제 통화: 한국어 화면은 원화(국내 결제), 그 밖의 언어는 달러(페이팔)
const shopCurrency = () => (getLang() === 'ko' ? 'KRW' : 'USD');
const usdText = (n) => `$${n.toFixed(2)}`;
const priceOf = (p) => (shopCurrency() === 'USD' ? p.usd : p.price);
const listOf = (p) => (shopCurrency() === 'USD' ? p.listUsd : p.list);
const money = (n) => (shopCurrency() === 'USD' ? usdText(n) : won(n));
const sellable = (p) => (shopCurrency() === 'USD' ? !!p.usd : true);
const ITEM_ORDER = ['candle', 'flash', 'fireworks', 'bigfire', 'package'];

function setShopView(v, pick = null) {
  shopView = v;
  shopPick = pick;
  renderProducts();
}

function renderProducts() {
  const P = shopInfo.products;
  if (!P) return;
  $('shop-test').hidden = shopInfo.mode !== 'test';
  $('shop-coins').textContent = myWallet.coins;
  $('shop-main').hidden = shopView !== 'main';
  $('shop-coins-view').hidden = shopView !== 'coins';
  $('shop-items-view').hidden = shopView !== 'items';
  $('shop-back').hidden = shopView === 'main';
  $('shopdlg').classList.toggle('sub', shopView !== 'main');
  $('shop-title').textContent = shopView === 'coins' ? '소원 동전 충전' : shopView === 'items' ? '아이템' : '상점';

  const coinKeys = Object.keys(P).filter((k) => P[k].group === 'coins' && sellable(P[k])).sort((a, b) => priceOf(P[a]) - priceOf(P[b]));
  const off = (p) => (listOf(p) ? Math.max(0, Math.round((1 - priceOf(p) / listOf(p)) * 100)) : 0);
  if (shopView === 'main') {
    $('door-coins-n').textContent = myWallet.coins;
    $('door-max').textContent = Math.max(0, ...coinKeys.map((k) => off(P[k])));
    const have = ITEM_ORDER.filter((k) => k !== 'package' && owned(k)).length;
    $('door-items-n').textContent = have ? `가진 아이템 ${have}개` : '아직 가진 아이템이 없어요';
  }

  if (shopView === 'coins') {
    const box = $('coin-tiers');
    box.innerHTML = '';
    const best = coinKeys.reduce((m, k) => (off(P[k]) > off(P[m]) ? k : m), coinKeys[0]);
    for (const k of coinKeys) {
      const p = P[k];
      const row = document.createElement('div');
      row.className = 'tier' + (k === best ? ' best' : '');
      const d = off(p);
      row.innerHTML = `<div class="t-coins">🪙 <b></b>개</div><div class="t-info"><span class="t-desc"></span><span class="t-unit"></span></div><div class="t-buy"><span class="t-off"></span><s class="t-list"></s></div>`;
      row.querySelector('.t-coins b').textContent = p.coins;
      row.querySelector('.t-desc').textContent = p.desc;
      row.querySelector('.t-unit').textContent = shopCurrency() === 'USD' ? `개당 ${usdText(priceOf(p) / p.coins)}` : `개당 ${Math.round(p.price / p.coins)}원`;
      row.querySelector('.t-off').textContent = d > 0 ? `${d}% 할인` : '';
      row.querySelector('.t-off').hidden = d <= 0;
      row.querySelector('.t-list').textContent = d > 0 ? money(listOf(p)) : '';
      const b = document.createElement('button');
      b.className = 'btn primary';
      b.textContent = money(priceOf(p));
      b.addEventListener('click', () => buy(k, b));
      row.querySelector('.t-buy').append(b);
      if (k === best) {
        const tag = document.createElement('span');
        tag.className = 't-tag';
        tag.textContent = '가장 이득';
        row.append(tag);
      }
      box.append(row);
    }
  }

  if (shopView === 'items') {
    const grid = $('item-grid');
    const det = $('item-detail');
    grid.innerHTML = '';
    for (const k of ITEM_ORDER) {
      const p = P[k];
      if (!p || !sellable(p)) continue;
      const own = k !== 'package' && owned(k);
      const b = document.createElement('button');
      b.className = 'item-card' + (shopPick === k ? ' on' : '') + (own ? ' own' : '') + (k === 'package' ? ' wide' : '');
      b.innerHTML = `<span class="ic-ico">${p.icon}</span><span class="ic-name"></span><span class="ic-price"></span>`;
      b.querySelector('.ic-name').textContent = p.name;
      b.querySelector('.ic-price').textContent = own ? '✓ 사용 중' : money(priceOf(p));
      b.addEventListener('click', () => setShopView('items', shopPick === k ? null : k));
      grid.append(b);
    }
    det.hidden = !shopPick;
    if (shopPick) {
      const p = P[shopPick];
      const own = shopPick !== 'package' && owned(shopPick);
      const sum = shopPick === 'package' ? p.items.reduce((t, k) => t + priceOf(P[k]), 0) : 0;
      det.innerHTML = `<div class="id-top"><span class="id-ico">${p.icon}</span><div><div class="id-name"></div><div class="id-desc"></div></div></div><ul class="id-facts"></ul>`;
      det.querySelector('.id-name').textContent = p.name;
      det.querySelector('.id-desc').textContent = p.desc;
      const facts = [`${shopInfo.itemDays || 30}일 동안 사용 · 다시 사면 기간이 늘어나요`];
      if (own) facts.unshift(`✓ ${fmtDate(myWallet.items[shopPick])}까지 사용 중`);
      if (sum) facts.push(`따로 사면 ${money(Math.round(sum * 100) / 100)} → ${Math.round((1 - priceOf(p) / sum) * 100)}% 할인`);
      for (const f of facts) {
        const li = document.createElement('li');
        li.textContent = f;
        det.querySelector('.id-facts').append(li);
      }
      const b = document.createElement('button');
      b.className = 'btn primary wide';
      b.textContent = `${money(priceOf(p))} ${own ? '· 기간 늘리기' : '· 구매하기'}`;
      b.addEventListener('click', () => buy(shopPick, b));
      det.append(b);
      requestAnimationFrame(() => det.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    }
  }
}

// view: 'main' | 'coins' | 'items', pick: 아이템 키
function openShop(msg, view = 'main', pick = null) {
  if (!shopInfo || shopInfo.mode === 'off') return;
  setShopView(view, pick);
  if ($('wishdlg').open) $('wishdlg').close();
  if (!$('shopdlg').open) $('shopdlg').showModal();
  if (msg) toast(msg);
}

$('door-coins').addEventListener('click', () => setShopView('coins'));
$('door-items').addEventListener('click', () => setShopView('items'));
$('shop-back').addEventListener('click', () => setShopView('main'));

// ---------- 이메일 간편 로그인 (결제할 때만 요청) ----------
let afterLogin = null; // 로그인 뒤 이어서 할 일 (멈췄던 결제)
const postJson = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(async (r) => ({ ok: r.ok, body: await r.json() }));
function openLogin(next) {
  afterLogin = next || null;
  $('login-msg').hidden = true;
  $('login-dev').hidden = true;
  $('login-send').disabled = false;
  if ($('shopdlg').open) $('shopdlg').close();
  $('logindlg').showModal();
  setTimeout(() => $('login-email').focus(), 50);
}
async function finishLogin(token) {
  const r = await postJson('api/shop/verify', { token, visitor: net.visitor });
  if (!r.ok) throw new Error(r.body.error || '로그인 실패');
  if (r.body.visitor !== net.visitor) net.adoptVisitor(r.body.visitor);
  setWallet(r.body.wallet);
  toast(`✅ 로그인했어요 · ${r.body.email}`);
  return r.body;
}
$('login-form').addEventListener('submit', async (e) => {
  if (!(e.submitter && e.submitter.value === 'send')) return;
  e.preventDefault();
  const email = $('login-email').value.trim();
  const msg = $('login-msg');
  $('login-send').disabled = true;
  const r = await postJson('api/shop/login', { email, visitor: net.visitor }).catch(() => ({ ok: false, body: {} }));
  msg.hidden = false;
  if (!r.ok) {
    msg.textContent = r.body.error || '잠시 후 다시 시도해 주세요';
    $('login-send').disabled = false;
    return;
  }
  if (r.body.devLink) {
    // 메일 서비스를 붙이기 전(테스트 모드): 링크를 바로 씀
    msg.textContent = '🧪 테스트 모드라 메일 대신 아래 버튼으로 로그인해요.';
    const btn = $('login-dev');
    btn.hidden = false;
    btn.onclick = async () => {
      try {
        await finishLogin(new URL(r.body.devLink).searchParams.get('login'));
        $('logindlg').close();
        const next = afterLogin;
        afterLogin = null;
        if (next) next();
      } catch (err) {
        msg.textContent = err.message;
      }
    };
  } else {
    msg.textContent = '📮 메일을 보냈어요. 메일함에서 "로그인하기"를 눌러 주세요. (15분 동안 유효, 스팸함도 확인해 주세요)';
  }
});
// 메일의 로그인 링크로 들어왔을 때
if (params.get('login')) {
  finishLogin(params.get('login'))
    .then(() => {
      if (shopInfo && shopInfo.mode !== 'off') setTimeout(() => openShop('이제 결제할 수 있어요'), 600);
    })
    .catch((e) => toast(e.message));
  history.replaceState(null, '', location.pathname);
}

// 해외 결제: 페이팔 결제창
async function payWithPaypal(order, label) {
  await loadScript(`https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(shopInfo.paypal.clientId)}&currency=USD&intent=capture`);
  const box = $('paypal-buttons');
  box.innerHTML = '';
  $('paypal-what').textContent = `${label} · ${usdText(order.amount)}`;
  if ($('shopdlg').open) $('shopdlg').close();
  $('paypaldlg').showModal();
  await window.paypal
    .Buttons({
      style: { layout: 'vertical', shape: 'pill' },
      createOrder: async () => {
        const r = await postJson('api/shop/paypal/create', { orderId: order.orderId });
        if (!r.ok) throw new Error(r.body.error || '결제창을 불러오지 못했어요');
        return r.body.id;
      },
      onApprove: async () => {
        $('paypaldlg').close();
        await confirmPayment({ orderId: order.orderId, amount: order.amount });
      },
      onCancel: () => toast('결제를 취소했어요'),
      onError: () => toast('결제에 실패했어요'),
    })
    .render(box);
}
$('paypal-close').addEventListener('click', () => $('paypaldlg').close());

async function buy(product, btn) {
  // 결제는 로그인한 뒤에만: 로그인 창을 띄우고, 로그인하면 이어서 결제
  if (!myWallet.email) return openLogin(() => openShop(null, shopView, shopPick));
  btn.disabled = true;
  try {
    const currency = shopCurrency();
    const r = await fetch('api/shop/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visitor: net.visitor, product, currency }) });
    const order = await r.json();
    if (order.needLogin) return openLogin(() => openShop(null, shopView, shopPick));
    if (!r.ok) throw new Error(order.error || '주문 실패');
    if (currency === 'USD') {
      if (shopInfo.mode === 'live' && shopInfo.paypal) return await payWithPaypal(order, shopInfo.products[product].name);
      await confirmPayment({ orderId: order.orderId, paymentKey: 'test', amount: order.amount });
      return;
    }
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
  const before = myWallet.coins;
  setWallet(res.wallet);
  const got = res.wallet.coins - before;
  const head = res.test ? '🧪 테스트 구매 완료!' : '🎉 구매 완료!';
  if (got > 0 && shopView === 'coins') {
    toast(`${head} 🪙 동전 ${got}개가 들어왔어요 · 내 동전 ${res.wallet.coins}개`);
    const chip = document.querySelector('.coin-chip');
    if (chip) {
      chip.classList.remove('pop');
      void chip.offsetWidth;
      chip.classList.add('pop');
    }
  } else toast(`${head} 아이템이 생겼어요${got > 0 ? ` · 동전 ${got}개 덤` : ''}`);
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
    openShop('소원 동전이 부족해요. 충전해 주세요', 'coins');
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
$('wish-buy').addEventListener('click', () => openShop(null, 'coins'));
$('open-shop').addEventListener('click', () => openShop());
$('menu-shop').addEventListener('click', () => {
  $('menu').close();
  openShop();
});
$('shop-close').addEventListener('click', () => $('shopdlg').close());

document.querySelectorAll('.item-btn[data-item]').forEach((b) =>
  b.addEventListener('click', () => {
    const k = b.dataset.item;
    if (!owned(k)) return openShop(null, 'items', k);
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


// ---------- 해변 놀이: 누르면 걷기 · 불을 누르면 장작 · 위로 쓸면 물수제비 ----------
const canvasEl = $('scene');
let pdown = null;
let lastMoveAt = 0;
let lastWoodAt = 0;
let lastStoneAt = 0;
canvasEl.addEventListener('pointerdown', (e) => {
  if (state.screen !== 'ride') return;
  pdown = { x: e.clientX, y: e.clientY, t: performance.now(), cam: scene.camX, drag: false };
  // 쓸다가 버튼 위에서 손을 떼도 해변이 끝까지 받도록
  try {
    canvasEl.setPointerCapture(e.pointerId);
  } catch {
    /* 지원하지 않는 브라우저 */
  }
});
// 옆으로 끌면 넓은 해변을 따라 화면 이동
canvasEl.addEventListener('pointermove', (e) => {
  if (!pdown) return;
  const dx = e.clientX - pdown.x;
  const dy = e.clientY - pdown.y;
  if (!pdown.drag && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.3) pdown.drag = true;
  if (pdown.drag) scene.panBy(pdown.cam - dx - scene.camX);
});
canvasEl.addEventListener('pointerup', (e) => {
  if (state.screen !== 'ride' || !pdown) return;
  const dx = e.clientX - pdown.x;
  const dy = e.clientY - pdown.y;
  const dt = Math.max(16, performance.now() - pdown.t);
  const dist = Math.hypot(dx, dy);
  const start = pdown;
  pdown = null;
  if (start.drag) return; // 화면을 옆으로 끈 것
  const wx = scene.toWorldX(e.clientX); // 넓은 해변 위의 위치
  if (dist < 14) {
    // 짧게 누름
    if (scene.nearFire(wx, e.clientY)) return addWood();
    // 다른 사람을 누르면 한마디·하트
    const who = scene.personAt(wx, e.clientY);
    if (who) return openPersonMenu(who, e.clientX, e.clientY);
    const pos = scene.screenToPos(wx, e.clientY);
    if (!pos) return;
    if (scene.selfStanding) return toast('자리에 앉은 뒤에 움직일 수 있어요');
    const now = Date.now();
    if (now - lastMoveAt < 400) return;
    lastMoveAt = now;
    scene.walkSelf(pos[0], pos[1]);
    net.move(pos[0], pos[1]);
    // 처음 일어섰을 때 한 번만: 아래로 쓸면 앉는다고 안내
    if (!store.get('sitHint', false)) {
      store.set('sitHint', true);
      setTimeout(() => {
        if (!scene.selfUp) return;
        scene.sitHintUntil = performance.now() + 8000;
        toast('👇 서 있을 땐 화면을 아래로 쓸어내리면 그 자리에 앉아요');
      }, 1600);
    }
    return;
  }
  // 아래로 쓸기 → 그 자리에 앉기
  if (dy > 40 && Math.abs(dy) > Math.abs(dx) * 0.6) {
    if (scene.selfUp) {
      scene.selfUp = false;
      scene.sitHintUntil = 0;
      net.sit();
    }
    return;
  }
  // 위로 휙 쓸기 → 물수제비
  if (dy < -40 && Math.abs(dy) > Math.abs(dx) * 0.6 && start.y > scene.horizonY) {
    const now = Date.now();
    if (now - lastStoneAt < 1200) return;
    lastStoneAt = now;
    const speed = dist / dt; // px/ms
    const n = Math.max(0, Math.min(14, Math.round(speed * 3.2 + Math.random() * 3 - 1.5)));
    const dir = Math.max(-1, Math.min(1, dx / Math.abs(dy)));
    scene.skipStone(scene.mySlot, dir, n, true);
    const best = store.get('stoneBest', 0);
    if (n > best) {
      store.set('stoneBest', n);
      if (best > 0) setTimeout(() => toast(`🪨 물수제비 최고 기록! ${n}번`), 1800);
    }
  }
});
canvasEl.addEventListener('pointercancel', () => (pdown = null));

let lastHeartAt = 0;
// ---------- 가까이 온 사람: 한마디 건네기 → 하트 ----------
const talked = new Map(); // 자리 번호 → 한마디를 주고받은 시각
const TALK_MS = 30 * 60 * 1000;
const hasTalked = (seat) => Date.now() - (talked.get(seat) || 0) < TALK_MS;
function closePersonMenu() {
  $('person-menu').hidden = true;
}
function openPersonMenu(who, x, y) {
  if (state.netStatus !== 'online' || state.seat == null) return toast('자리에 앉은 뒤에 할 수 있어요');
  if (!scene.isNear(who.slot)) {
    scene.showReach();
    return toast('🔥 모닥불 불빛 안으로 들어와야 마음을 건넬 수 있어요');
  }
  const box = $('person-menu');
  box.innerHTML = '';
  const title = document.createElement('div');
  title.className = 'pm-title';
  title.textContent = '불빛 안에 함께 있는 사람';
  const say = document.createElement('button');
  say.textContent = '💬 한마디 건네기';
  say.addEventListener('click', () => {
    box.innerHTML = '';
    (shopInfo ? shopInfo.whispers : []).forEach((text, i) => {
      const b = document.createElement('button');
      b.textContent = text;
      b.addEventListener('click', () => {
        closePersonMenu();
        net.whisper(who.seat, i);
      });
      box.append(b);
    });
  });
  const heart = document.createElement('button');
  heart.className = 'pm-heart' + (hasTalked(who.seat) ? '' : ' locked');
  heart.textContent = hasTalked(who.seat) ? '❤️ 하트 건네기' : '❤️ 하트 (먼저 한마디 건네 보세요)';
  heart.addEventListener('click', () => {
    if (!hasTalked(who.seat)) return toast('💬 먼저 한마디 건네 보세요. 이야기를 나눈 사이에만 하트를 줄 수 있어요');
    closePersonMenu();
    sendHeart(who);
  });
  box.append(title, say, heart);
  box.hidden = false;
  const w = box.offsetWidth;
  const h = box.offsetHeight;
  box.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, x - w / 2))}px`;
  box.style.top = `${Math.max(8, Math.min(innerHeight - h - 8, y - h - 16))}px`;
}
document.addEventListener('pointerdown', (e) => {
  const box = $('person-menu');
  if (!box.hidden && !box.contains(e.target)) closePersonMenu();
});

function sendHeart(who) {
  if (state.netStatus !== 'online' || state.seat == null) return toast('자리에 앉은 뒤에 하트를 보낼 수 있어요');
  const now = Date.now();
  if (now - lastHeartAt < 1500) return;
  lastHeartAt = now;
  scene.heartFrom(scene.mySlot, who.slot, false, true);
  net.heart(who.seat);
}

// 지금 내 한마디의 무게 (서버와 같은 기준)
function myWeight() {
  const got = myWallet.hearts ? myWallet.hearts.received + myWallet.hearts.given * 0.5 : 0;
  let w = got >= 200 ? 4 : got >= 50 ? 3 : got >= 10 ? 2 : 1;
  if (['candle', 'flash', 'fireworks', 'bigfire'].some((k) => owned(k))) w += 1;
  return Math.min(5, w);
}

function addWood() {
  const now = Date.now();
  if (now - lastWoodAt < 2500) return;
  lastWoodAt = now;
  scene.throwWood(scene.mySlot, true);
  net.wood();
}

// 장작이 불에 닿는 순간: 내 장작이면 툭·화르륵·타닥타닥, 다른 사람 장작은 작게 타닥
scene.onWood = (self) => {
  if (!ambience.on) return;
  if (self) return ambience.woodIn();
  [0, 60, 130, 220].forEach((d) => setTimeout(() => ambience.on && ambience.scheduleOneCrackle(0.5), d));
};
// 불 크기 저장 (다시 들어와도 지난 시간만큼 줄어든 상태로 이어짐)
{
  const saved = store.get('fuel', null);
  if (saved && typeof saved.f === 'number') scene.fuel = Math.max(0.12, Math.min(1.4, saved.f - (Date.now() - saved.at) / (FUEL_SECONDS * 1000)));
  let warned = false;
  setInterval(() => {
    store.set('fuel', { f: scene.fuel, at: Date.now() });
    ambience.setFire && ambience.setFire(scene.fuelK());
    if (!warned && state.screen === 'ride' && (scene.fuel - 0.12) * FUEL_SECONDS < 240 && !store.get('fuelHint', false)) {
      warned = true;
      store.set('fuelHint', true);
      toast('🔥 장작이 얼마 남지 않았어요. 모닥불을 눌러 장작을 넣어 주세요');
    }
  }, 5000);
}
scene.onSkip = (last) => ambience.on && (last ? ambience.plop() : ambience.tick());

// ---------- 응원 한마디 (정해진 문구, 10초에 한 번) ----------
let lastSay = 0;
// 무게(1~5): 하트를 많이 받은 사람, 아이템을 쓰는 사람의 한마디일수록 높이·오래 떠오름
function showSay(text, me, w = 1) {
  const log = $('saylog');
  const el = document.createElement('div');
  el.className = 'say' + (me ? ' me' : '') + (w >= 3 ? ' heavy' : '');
  el.textContent = text;
  if (w >= 2) {
    const tag = document.createElement('span');
    tag.className = 'w';
    tag.textContent = '❤️'.repeat(Math.min(3, w - 1));
    el.append(tag);
  }
  const room = Math.max(200, window.innerHeight * 0.55);
  const rise = Math.min(room, 140 + (w - 1) * (room - 140) / 4);
  const dur = 9 + (w - 1) * 2.5;
  el.style.setProperty('--rise', `${Math.round(rise)}px`);
  el.style.setProperty('--dur', `${dur}s`);
  el.style.setProperty('--w', w);
  // 여러 개가 겹치지 않게 좌우 자리를 번갈아
  showSay.lane = ((showSay.lane || 0) + 1) % 3;
  el.style.setProperty('--x', `${Math.round(showSay.lane * Math.min(70, window.innerWidth * 0.12) + Math.random() * 12)}px`);
  log.append(el);
  while (log.children.length > 7) log.firstChild.remove(); // 한꺼번에 많이 오면 오래된 것부터 정리
  setTimeout(() => el.remove(), dur * 1000 + 200);
  return el;
}
// ---------- 한마디: 고르기 · 랜덤 · 직접 쓰기(15자, 10분에 한 번) ----------
const CUSTOM_GAP = 10 * 60 * 1000;
let customNext = store.get('customNext', 0);
let customTimer = null;
function fmtWait(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function canSay() {
  const wait = 10000 - (Date.now() - lastSay);
  if (wait > 0) return toast(`한마디는 10초에 한 번 할 수 있어요 (${Math.ceil(wait / 1000)}초 뒤)`), false;
  if (state.netStatus !== 'online' || state.seat == null) return toast('자리에 앉은 뒤에 할 수 있어요'), false;
  return true;
}
function sayPreset(i) {
  $('saypick').hidden = true;
  if (!canSay()) return;
  lastSay = Date.now();
  showSay(shopInfo.sayings[i], true, myWeight());
  net.say(i);
}
function renderCustomRow() {
  const row = $('saypick').querySelector('.say-custom');
  if (!row) return;
  const left = customNext - Date.now();
  const input = row.querySelector('input');
  const btn = row.querySelector('button');
  const note = row.querySelector('.say-note');
  const locked = left > 0;
  input.disabled = locked;
  btn.disabled = locked;
  note.textContent = locked ? `⏳ 다음 한마디까지 ${fmtWait(left)}` : `직접 쓰기 · ${[...input.value].length}/15자 · 10분에 한 번`;
  note.classList.toggle('wait', locked);
  clearTimeout(customTimer);
  if (locked && !$('saypick').hidden) customTimer = setTimeout(renderCustomRow, 1000);
}
function placeSayPick() {
  const pick = $('saypick');
  // PC: 한마디 버튼 바로 위에 붙여서
  if (innerWidth >= 900) {
    const r = $('open-say').getBoundingClientRect();
    pick.classList.add('anchored');
    pick.style.left = 'auto';
    pick.style.right = `${Math.max(12, innerWidth - r.right)}px`;
    pick.style.bottom = `${innerHeight - r.top + 10}px`;
  } else {
    pick.classList.remove('anchored');
    pick.style.left = pick.style.right = pick.style.bottom = '';
  }
}
$('open-say').addEventListener('click', () => {
  const pick = $('saypick');
  if (!pick.hidden) return (pick.hidden = true);
  if (!shopInfo) return toast('잠시 후 다시 눌러 주세요');
  pick.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'say-grid';
  shopInfo.sayings.forEach((text, i) => {
    const b = document.createElement('button');
    b.textContent = text;
    b.addEventListener('click', () => sayPreset(i));
    grid.append(b);
  });
  pick.append(grid);
  const rnd = document.createElement('button');
  rnd.className = 'say-random';
  rnd.textContent = '🎲 아무 말이나 (랜덤 한마디)';
  rnd.addEventListener('click', () => sayPreset(Math.floor(Math.random() * shopInfo.sayings.length)));
  pick.append(rnd);
  const row = document.createElement('form');
  row.className = 'say-custom';
  row.innerHTML = '<div class="say-in"><input maxlength="15" placeholder="직접 쓰기 (15자)" enterkeyhint="send" autocomplete="off"><button class="btn primary" type="submit">보내기</button></div><div class="say-note"></div>';
  const input = row.querySelector('input');
  input.addEventListener('input', () => {
    // 글자 수는 한글 기준으로 15자
    const chars = [...input.value];
    if (chars.length > 15) input.value = chars.slice(0, 15).join('');
    renderCustomRow();
  });
  row.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.replace(/\s+/g, ' ').trim();
    if (!text) return input.focus();
    if (customNext > Date.now()) return renderCustomRow();
    if (!canSay()) return;
    lastSay = Date.now();
    customNext = Date.now() + CUSTOM_GAP;
    store.set('customNext', customNext);
    const el = showSay(text, true, myWeight());
    if (el) {
      el.classList.add('pending');
      setTimeout(() => el.classList.remove('pending'), 3000);
    }
    net.sayText(text);
    input.value = '';
    renderCustomRow();
    toast(`💬 보냈어요 · 다음 직접 한마디는 10분 뒤 (${fmtWait(CUSTOM_GAP)})`);
  });
  pick.append(row);
  placeSayPick();
  pick.hidden = false;
  renderCustomRow();
});
addEventListener('resize', () => !$('saypick').hidden && placeSayPick());
// 바깥을 누르면 문구 고르기 닫기
document.addEventListener('click', (e) => {
  const pick = $('saypick');
  if (!pick.hidden && !pick.contains(e.target) && e.target.closest('#open-say') === null) pick.hidden = true;
});

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
document.addEventListener('visibilitychange', () => {
  ambience.setHidden(document.hidden);
  music.setHidden(document.hidden);
});

// ---------- 음악 (기본은 꺼짐, 시간대에 맞는 분위기) ----------
function musicMood() {
  const sun = scene.sunInfo();
  if (sun.elevation < -7) return 'night';
  return state.event && PLACES[state.event.place].kind === 'sunset' ? 'sunset' : 'sunrise';
}
function musicButton() {
  $('toggle-music').setAttribute('aria-pressed', String(music.on));
  $('toggle-music').title = music.on ? '음악 끄기' : '음악 켜기';
}
$('toggle-music').addEventListener('click', async () => {
  if (music.on) {
    music.stop();
    store.set('music', false);
    toast('🎵 음악을 껐어요');
  } else {
    music.setMood(musicMood());
    await music.start();
    store.set('music', true);
    toast('🎵 잔잔한 음악을 틀었어요');
  }
  musicButton();
});
setInterval(() => music.on && music.setMood(musicMood()), 15000);

// 지금 흐르는 곡 카드 (곡이 시작될 때 잠깐 은은하게) + 우리 음악 목록
const LINK_NAMES = { melon: '멜론', genie: '지니', spotify: '스포티파이', youtube: '유튜브 뮤직', apple: '애플 뮤직' };
function trackLinks(t) {
  return Object.entries(t.links || {}).filter(([k, u]) => LINK_NAMES[k] && /^https:\/\//.test(u));
}
let npTimer = null;
music.onTrack = (t) => {
  $('np-title').textContent = t.title;
  $('np-artist').textContent = t.artist ? ` · ${t.artist}` : '';
  $('np-listen').hidden = !trackLinks(t).length;
  const el = $('nowplay');
  el.hidden = false;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(npTimer);
  npTimer = setTimeout(() => el.classList.remove('show'), 9000);
  setTimeout(() => !el.classList.contains('show') && (el.hidden = true), 10500);
};
$('np-listen').addEventListener('click', () => {
  if (!music.current) return;
  net.stat('musiclink');
  openMusicList(music.current);
});
function openMusicList(focus) {
  const box = $('track-list');
  box.innerHTML = '';
  const list = music.allTracks();
  for (const t of focus ? [focus, ...list.filter((x) => x.file !== focus.file)] : list) {
    const row = document.createElement('div');
    row.className = 'track' + (focus && t.file === focus.file ? ' on' : '');
    row.innerHTML = '<div class="tr-name"><b></b><span></span></div><div class="tr-links"></div>';
    row.querySelector('b').textContent = t.title;
    row.querySelector('span').textContent = t.artist || '';
    for (const [k, u] of trackLinks(t)) {
      const a = document.createElement('a');
      a.href = u;
      a.target = '_blank';
      a.rel = 'noopener';
      a.className = 'tr-link ' + k;
      a.textContent = LINK_NAMES[k];
      a.addEventListener('click', () => net.stat('musiclink'));
      row.querySelector('.tr-links').append(a);
    }
    box.append(row);
  }
  if ($('menu').open) $('menu').close();
  $('musicdlg').showModal();
}
$('menu-music').addEventListener('click', () => openMusicList(null));
$('music-close').addEventListener('click', () => $('musicdlg').close());
// 곡 정보가 있을 때만 메뉴에 보임
setTimeout(function checkTracks() {
  if (music.tracks) $('menu-music').hidden = !music.allTracks().length;
  else setTimeout(checkTracks, 2000);
}, 1500);
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

// ---------- 창 바깥(어두운 여백)을 누르면 닫기 ----------
document.querySelectorAll('dialog.modal').forEach((dlg) =>
  dlg.addEventListener('click', (e) => {
    if (e.target !== dlg) return;
    const r = dlg.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside) dlg.close();
  }),
);

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

// 새 버전으로 새로 고침된 경우 바로 다시 탑승
(() => {
  let auto = false;
  try {
    auto = sessionStorage.getItem('haedoti.autoboard') === '1';
    sessionStorage.removeItem('haedoti.autoboard');
  } catch {
    /* 저장 불가 */
  }
  if (!auto) return;
  $('board-form').requestSubmit();
  const iv = setInterval(() => {
    if (state.screen === 'ticket') {
      clearInterval(iv);
      $('board').click();
    }
  }, 200);
  setTimeout(() => clearInterval(iv), 10000);
})();

// 개발·시험용
window.__haedoti = { state, scene, net, solarPosition, EVENT_AFTERGLOW_MS, setClock, ambience };
window.__showSay = showSay;

// 첫 화면 제목을 한 줄에 꽉 차게: 넘치면 글자 크기를 줄이고, 남으면 원래 크기까지 키움
function fitHomeTitle() {
  const el = $('home-title');
  if (!el || !el.offsetParent) return;
  el.style.fontSize = '';
  const max = parseFloat(getComputedStyle(el).fontSize);
  // 넘치면 폭 비율만큼 한 번에 줄이고, 그래도 넘치면 조금씩 더
  if (el.scrollWidth > el.clientWidth + 1) {
    let size = Math.floor(max * (el.clientWidth / el.scrollWidth) * 0.98 * 2) / 2;
    el.style.fontSize = `${size}px`;
    for (let i = 0; i < 10 && el.scrollWidth > el.clientWidth + 1 && size > 12; i++) {
      size -= 1;
      el.style.fontSize = `${size}px`;
    }
  }
}
fitHomeTitle();
addEventListener('resize', fitHomeTitle);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitHomeTitle);
if (document.fonts) document.fonts.addEventListener?.('loadingdone', fitHomeTitle);

// ---------- 언어 바꾸기 ----------
// 언어 버튼은 lang/index.js 목록대로 자동 생성
{
  const box = $('lang-switch');
  for (const l of LANGS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lang-btn';
    b.dataset.lang = l.code;
    b.textContent = l.label;
    box.append(b);
  }
}
function refreshLang() {
  applyI18n();
  document.querySelectorAll('.lang-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === getLang())));
  buildPicker();
  renderDepartures();
  renderDaily();
  fitHomeTitle();
  // 언어별 손글씨 글꼴을 받은 뒤 제목 크기를 다시 맞춤
  const fam = getComputedStyle(document.documentElement).getPropertyValue('--title').split(',')[0].trim();
  if (document.fonts && fam) document.fonts.load(`40px ${fam}`, $('home-title').textContent).then(fitHomeTitle, () => {});
  setTimeout(fitHomeTitle, 1200);
}
document.querySelectorAll('.lang-btn').forEach((b) =>
  b.addEventListener('click', () => {
    setLang(b.dataset.lang);
    refreshLang();
  }),
);
refreshLang();
startAutoTranslate();
