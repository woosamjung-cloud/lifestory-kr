// 해의 위치와 일출·일몰 시각 계산 (NOAA 천문 공식)
// 브라우저와 서버(Node)에서 함께 쓰는 모듈입니다.

const RAD = Math.PI / 180;
const KST_OFFSET_MS = 9 * 3600 * 1000; // 한국은 서머타임이 없어 항상 UTC+9
const MIN_MS = 60 * 1000;

// 장소 정보: 정동진은 동쪽 바다(해돋이), 정서진은 서쪽 바다(해넘이)
export const PLACES = {
  east: {
    key: 'east',
    name: '정동진',
    lat: 37.6906,
    lon: 129.0339,
    kind: 'sunrise',
    eventName: '해돋이',
    ritual: '소원 풍등',
  },
  west: {
    key: 'west',
    name: '정서진',
    lat: 37.5622,
    lon: 126.6042,
    kind: 'sunset',
    eventName: '해넘이',
    ritual: '편지 쓰기',
  },
  // ---------- 해외 명소 (비행기로 이동) ----------
  haleakala: {
    key: 'haleakala',
    name: '할레아칼라',
    country: '미국 하와이',
    flag: '🇺🇸',
    lat: 20.7097,
    lon: -156.2533,
    tz: 'Pacific/Honolulu',
    kind: 'sunrise',
    eventName: '해돋이',
    ritual: '소원 풍등',
    scenery: 'clouds',
    abroad: true,
  },
  angkor: {
    key: 'angkor',
    name: '앙코르와트',
    country: '캄보디아',
    flag: '🇰🇭',
    lat: 13.4125,
    lon: 103.867,
    tz: 'Asia/Phnom_Penh',
    kind: 'sunrise',
    eventName: '해돋이',
    ritual: '소원 풍등',
    scenery: 'angkor',
    abroad: true,
  },
  santorini: {
    key: 'santorini',
    name: '산토리니 이아',
    country: '그리스',
    flag: '🇬🇷',
    lat: 36.4618,
    lon: 25.3753,
    tz: 'Europe/Athens',
    kind: 'sunset',
    eventName: '해넘이',
    ritual: '편지 쓰기',
    scenery: 'santorini',
    abroad: true,
  },
};
PLACES.east.scenery = 'beach';
PLACES.west.scenery = 'deck';
export const PLACE_KEYS = Object.keys(PLACES);

// 현지 시각 "06:12" (해외 명소는 그 나라 시간, 국내는 한국 시간)
export function formatLocalHM(date, placeKey) {
  const p = PLACES[placeKey];
  if (!p || !p.tz) return formatHM(date);
  try {
    return new Intl.DateTimeFormat('ko-KR', { timeZone: p.tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
  } catch {
    return formatHM(date);
  }
}

// 해가 수평선에 걸리는 고도 (대기 굴절 + 해 반지름 보정)
export const HORIZON_ELEVATION = -0.833;

// 주어진 시각(Date)에 그 장소에서 해의 고도와 방위각(북쪽 기준, 시계방향)을 구합니다.
export function solarPosition(date, lat, lon) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const T = (jd - 2451545) / 36525;
  const L0 = (((280.46646 + T * (36000.76983 + T * 0.0003032)) % 360) + 360) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C =
    Math.sin(M * RAD) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(2 * M * RAD) * (0.019993 - 0.000101 * T) +
    Math.sin(3 * M * RAD) * 0.000289;
  const omega = 125.04 - 1934.136 * T;
  const lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * RAD);
  const decl = Math.asin(Math.sin(eps * RAD) * Math.sin(lambda * RAD));
  const y = Math.tan((eps * RAD) / 2) ** 2;
  const eqTime =
    (4 / RAD) *
    (y * Math.sin(2 * L0 * RAD) -
      2 * e * Math.sin(M * RAD) +
      4 * e * y * Math.sin(M * RAD) * Math.cos(2 * L0 * RAD) -
      0.5 * y * y * Math.sin(4 * L0 * RAD) -
      1.25 * e * e * Math.sin(2 * M * RAD));

  const utcMin = (((date.getTime() / MIN_MS) % 1440) + 1440) % 1440;
  const tst = (((utcMin + eqTime + 4 * lon) % 1440) + 1440) % 1440;
  const ha = (tst / 4 - 180) * RAD;
  const latR = lat * RAD;
  const cosZ = Math.sin(latR) * Math.sin(decl) + Math.cos(latR) * Math.cos(decl) * Math.cos(ha);
  const zenith = Math.acos(Math.min(1, Math.max(-1, cosZ)));
  const elevation = 90 - zenith / RAD;
  const az =
    Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(latR) - Math.tan(decl) * Math.cos(latR)) / RAD + 180;
  return { elevation, azimuth: ((az % 360) + 360) % 360 };
}

// 한국 날짜(년, 월, 일)의 자정(KST)에 해당하는 Date
export function kstMidnight(y, m, d) {
  return new Date(Date.UTC(y, m - 1, d) - KST_OFFSET_MS);
}

// Date → 한국 시각 기준 {y, m, d, hh, mm, ss}
export function kstParts(date) {
  const k = new Date(date.getTime() + KST_OFFSET_MS);
  return {
    y: k.getUTCFullYear(),
    m: k.getUTCMonth() + 1,
    d: k.getUTCDate(),
    hh: k.getUTCHours(),
    mm: k.getUTCMinutes(),
    ss: k.getUTCSeconds(),
  };
}

const pad = (n) => String(n).padStart(2, '0');

export function formatHM(date) {
  const p = kstParts(date);
  return `${pad(p.hh)}:${pad(p.mm)}`;
}

export function formatDateKo(date) {
  const p = kstParts(date);
  return `${p.y}년 ${p.m}월 ${p.d}일`;
}

export function dateKey(date) {
  const p = kstParts(date);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

// 한국 날짜 하루 동안 해가 수평선을 넘는 순간(일출 또는 일몰)을 찾습니다.
export function findSunEvent(place, y, m, d, kind) {
  const start = kstMidnight(y, m, d).getTime();
  const step = 10 * MIN_MS;
  const f = (t) => solarPosition(new Date(t), place.lat, place.lon).elevation - HORIZON_ELEVATION;
  let prevT = start;
  let prev = f(prevT);
  for (let t = start + step; t <= start + 1440 * MIN_MS; t += step) {
    const cur = f(t);
    const rising = prev < 0 && cur >= 0;
    const setting = prev >= 0 && cur < 0;
    if ((kind === 'sunrise' && rising) || (kind === 'sunset' && setting)) {
      let lo = prevT;
      let hi = t;
      for (let i = 0; i < 30; i++) {
        const mid = (lo + hi) / 2;
        const v = f(mid);
        if ((kind === 'sunrise') === v < 0) lo = mid;
        else hi = mid;
      }
      return new Date(Math.round((lo + hi) / 2));
    }
    prevT = t;
    prev = cur;
  }
  return null;
}

// 장소의 하루 일출·일몰
export function sunTimes(placeKey, date) {
  const place = PLACES[placeKey];
  const p = kstParts(date);
  return {
    sunrise: findSunEvent(place, p.y, p.m, p.d, 'sunrise'),
    sunset: findSunEvent(place, p.y, p.m, p.d, 'sunset'),
  };
}

// 이벤트가 끝난 뒤에도 이 시간 동안은 같은 장면을 유지합니다.
export const EVENT_AFTERGLOW_MS = 40 * MIN_MS;

function specialLabel(placeKey, time) {
  const p = kstParts(time);
  if (placeKey === 'east' && p.m === 1 && p.d === 1) return `${p.y}년 새해 첫 해돋이`;
  if (placeKey === 'west' && p.m === 12 && p.d === 31) return `${p.y}년 마지막 해넘이`;
  if (placeKey === 'west' && p.m === 12 && p.d === 24) return '크리스마스 이브 해넘이';
  if (placeKey === 'east' && p.m === 12 && p.d === 25) return '크리스마스 아침 해돋이';
  return null;
}

// 한 장소·한 날짜의 이벤트 정보
export function makeEvent(placeKey, time) {
  const place = PLACES[placeKey];
  return {
    place: placeKey,
    kind: place.kind,
    time,
    key: `${dateKey(time)}-${placeKey}`,
    special: specialLabel(placeKey, time),
  };
}

// 지금 보여줄 이벤트: 아직 끝나지 않은(여운 시간 포함) 가장 가까운 일출(정동진)·일몰(정서진)
export function currentEvent(now) {
  const list = [];
  for (let off = -1; off <= 2; off++) {
    const day = new Date(now.getTime() + off * 86400000);
    const p = kstParts(day);
    const rise = findSunEvent(PLACES.east, p.y, p.m, p.d, 'sunrise');
    const set = findSunEvent(PLACES.west, p.y, p.m, p.d, 'sunset');
    if (rise) list.push(makeEvent('east', rise));
    if (set) list.push(makeEvent('west', set));
  }
  list.sort((a, b) => a.time - b.time);
  return list.find((ev) => ev.time.getTime() + EVENT_AFTERGLOW_MS > now.getTime()) || list[list.length - 1];
}

// 특정 장소의 다음 이벤트 (사용자가 장소를 직접 고를 때)
export function nextEventAt(placeKey, now) {
  const place = PLACES[placeKey];
  for (let off = -1; off <= 2; off++) {
    const day = new Date(now.getTime() + off * 86400000);
    const p = kstParts(day);
    const t = findSunEvent(place, p.y, p.m, p.d, place.kind);
    if (t && t.getTime() + EVENT_AFTERGLOW_MS > now.getTime()) return makeEvent(placeKey, t);
  }
  return null;
}

// 남은 시간 "01:02:03" 형식
export function formatCountdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}
