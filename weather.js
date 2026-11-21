// 기상청 초단기예보 연동 (정동진·정서진의 실제 하늘 상태, 강수, 기온)
// 환경 변수 KMA_API_KEY 에 공공데이터포털 "기상청_단기예보 조회서비스" 일반 인증키(Decoding)를 넣으면 동작합니다.
// 키는 서버에만 있고 방문자에게는 결과(하늘 상태·기온)만 전달됩니다.

import { PLACES } from './public/js/sun.js';
import { DESTINATIONS, countryOf } from './public/js/countries.js';

const ENDPOINT = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtFcst';
const REFRESH_MS = 20 * 60 * 1000;

// 위도·경도 → 기상청 격자 좌표 (람베르트 정각원추도법, 기상청 공식 변환식)
export function toGrid(lat, lon) {
  const RE = 6371.00877;
  const GRID = 5.0;
  const SLAT1 = 30.0;
  const SLAT2 = 60.0;
  const OLON = 126.0;
  const OLAT = 38.0;
  const XO = 43;
  const YO = 136;
  const DEGRAD = Math.PI / 180.0;
  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD;
  const slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD;
  const olat = OLAT * DEGRAD;
  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);
  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);
  let theta = lon * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;
  return {
    nx: Math.floor(ra * Math.sin(theta) + XO + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5),
  };
}

const pad = (n) => String(n).padStart(2, '0');

// 초단기예보 발표 시각: 매시 30분 발표, 45분 이후 조회 가능
export function baseTime(now = new Date()) {
  let k = new Date(now.getTime() + 9 * 3600e3);
  if (k.getUTCMinutes() < 45) k = new Date(k.getTime() - 3600e3);
  return {
    base_date: `${k.getUTCFullYear()}${pad(k.getUTCMonth() + 1)}${pad(k.getUTCDate())}`,
    base_time: `${pad(k.getUTCHours())}30`,
  };
}

const SKY_LABEL = { 1: '맑음', 3: '구름많음', 4: '흐림' };
const PTY_LABEL = { 0: '', 1: '비', 2: '비/눈', 3: '눈', 5: '빗방울', 6: '빗방울·눈날림', 7: '눈날림' };

// 응답 항목에서 가장 이른 예보 시각의 값만 골라 정리
export function parseForecast(items) {
  if (!Array.isArray(items) || !items.length) return null;
  const first = items.map((it) => `${it.fcstDate}${it.fcstTime}`).sort()[0];
  const pick = {};
  for (const it of items) if (`${it.fcstDate}${it.fcstTime}` === first) pick[it.category] = it.fcstValue;
  const sky = Number(pick.SKY) || 1;
  const pty = Number(pick.PTY) || 0;
  const temp = pick.T1H != null ? Number(pick.T1H) : null;
  const label = PTY_LABEL[pty] || SKY_LABEL[sky] || '';
  const wind = pick.WSD != null ? Number(pick.WSD) : null; // 풍속 m/s
  return { sky, pty, temp, wind, label, lightning: Number(pick.LGT) > 0, forecastAt: first };
}

// ---------- 나라별 날씨 제공처 ----------
// 나라를 늘리면 여기에 제공처를 하나 추가하고, countries.js의 weather에 그 이름을 적으면 됩니다.
// 각 제공처는 장소(place)를 받아 { sky(1 맑음·3 구름많음·4 흐림), pty(0 없음·1 비·3 눈 …), temp, wind, label } 을 돌려줍니다.
const PROVIDERS = {
  kma: {
    source: '기상청 초단기예보',
    envKey: 'KMA_API_KEY',
    fetch: (place, key) => fetchPlace(key, place),
  },
  // 예) openmeteo: { source: 'Open-Meteo', envKey: null, fetch: async (place) => { ... } },
};

const cache = { places: {}, updatedAt: null, error: null };
let timer = null;

async function fetchPlace(key, place) {
  const { nx, ny } = toGrid(place.lat, place.lon);
  const params = new URLSearchParams({
    serviceKey: key,
    pageNo: '1',
    numOfRows: '60',
    dataType: 'JSON',
    ...baseTime(),
    nx: String(nx),
    ny: String(ny),
  });
  const res = await fetch(`${ENDPOINT}?${params}`, { signal: AbortSignal.timeout(10000) });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    // 키가 아직 활성화되지 않았거나 잘못되면 XML 오류가 옵니다.
    const m = text.match(/<returnAuthMsg>([^<]+)</) || text.match(/<errMsg>([^<]+)</);
    throw new Error(m ? m[1] : `응답 형식 오류 (HTTP ${res.status})`);
  }
  const head = body?.response?.header;
  if (head && head.resultCode !== '00') throw new Error(`${head.resultCode} ${head.resultMsg}`);
  const parsed = parseForecast(body?.response?.body?.items?.item);
  if (!parsed) throw new Error('예보 자료 없음');
  return { ...parsed, grid: { nx, ny } };
}

export async function refreshWeather() {
  const errors = [];
  await Promise.all(
    DESTINATIONS.map(async (k) => {
      const place = PLACES[k];
      const country = countryOf(place);
      const prov = country && PROVIDERS[country.weather];
      if (!prov) return;
      const key = prov.envKey ? process.env[prov.envKey] : null;
      if (prov.envKey && !key) {
        errors.push(`${prov.envKey} 없음`);
        return;
      }
      try {
        cache.places[k] = await prov.fetch(place, key);
      } catch (err) {
        // 오류 메시지에 키가 섞여 나가지 않도록 정리
        errors.push(String(err.message || err).replaceAll(key || '\u0000', '***').slice(0, 200));
      }
    }),
  );
  if (Object.keys(cache.places).length) cache.updatedAt = new Date().toISOString();
  cache.error = errors.length ? [...new Set(errors)].join(' / ') : null;
  if (cache.error) console.error('날씨 갱신 실패:', cache.error);
}

export function startWeather() {
  if (timer) return;
  refreshWeather();
  timer = setInterval(refreshWeather, REFRESH_MS);
  timer.unref();
}

export function weatherStatus() {
  const sources = [...new Set(DESTINATIONS.map((k) => PROVIDERS[countryOf(PLACES[k])?.weather]?.source).filter(Boolean))];
  return {
    available: DESTINATIONS.every((k) => cache.places[k]),
    ...cache.places, // east, west … 장소 키별 날씨 (예전 화면과 같은 모양)
    updatedAt: cache.updatedAt,
    error: cache.error,
    source: sources.join(', '),
  };
}
