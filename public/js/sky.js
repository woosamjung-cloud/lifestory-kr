// 밤하늘 계산: 별의 고도·방위, 달의 위치와 위상, 유성우
// 브라우저와 서버(테스트)에서 함께 쓰는 순수 계산 모듈입니다.

const RAD = Math.PI / 180;
const norm360 = (d) => ((d % 360) + 360) % 360;

// 율리우스일
export function julianDay(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

// 그리니치 평균 항성시 (도)
export function gmst(date) {
  const d = julianDay(date) - 2451545.0;
  const T = d / 36525;
  return norm360(280.46061837 + 360.98564736629 * d + 0.000387933 * T * T);
}

// 적도좌표(적경·적위, 도) → 지평좌표(고도, 방위각: 북쪽 0°에서 시계방향)
export function equToHor(raDeg, decDeg, latDeg, lstDeg) {
  const ha = (lstDeg - raDeg) * RAD;
  const dec = decDeg * RAD;
  const lat = latDeg * RAD;
  const sinAlt = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(ha);
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  const az = Math.atan2(-Math.sin(ha) * Math.cos(dec), Math.sin(dec) * Math.cos(lat) - Math.cos(dec) * Math.sin(lat) * Math.cos(ha));
  return { alt: alt / RAD, az: norm360(az / RAD) };
}

// 해의 황경 (도, 간단식)
function sunEclipticLon(d) {
  const M = norm360(356.047 + 0.9856002585 * d) * RAD;
  const w = 282.9404 + 4.70935e-5 * d;
  const e = 0.016709 - 1.151e-9 * d;
  const E = M + e * Math.sin(M) * (1 + e * Math.cos(M));
  const xv = Math.cos(E) - e;
  const yv = Math.sqrt(1 - e * e) * Math.sin(E);
  return norm360(Math.atan2(yv, xv) / RAD + w);
}

// 달의 적경·적위와 위상 (Paul Schlyter의 간단 계산법, 오차 수십 분 이내)
export function moonPosition(date) {
  const d = julianDay(date) - 2451543.5;
  const N = norm360(125.1228 - 0.0529538083 * d) * RAD;
  const i = 5.1454 * RAD;
  const w = norm360(318.0634 + 0.1643573223 * d) * RAD;
  const a = 60.2666;
  const e = 0.0549;
  const M = norm360(115.3654 + 13.0649929509 * d) * RAD;
  let E = M + e * Math.sin(M) * (1 + e * Math.cos(M));
  for (let k = 0; k < 3; k++) E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xv = a * (Math.cos(E) - e);
  const yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const v = Math.atan2(yv, xv);
  const r = Math.sqrt(xv * xv + yv * yv);
  const xh = r * (Math.cos(N) * Math.cos(v + w) - Math.sin(N) * Math.sin(v + w) * Math.cos(i));
  const yh = r * (Math.sin(N) * Math.cos(v + w) + Math.cos(N) * Math.sin(v + w) * Math.cos(i));
  const zh = r * Math.sin(v + w) * Math.sin(i);
  let lon = Math.atan2(yh, xh) / RAD;
  let lat = Math.atan2(zh, Math.sqrt(xh * xh + yh * yh)) / RAD;
  // 주요 섭동 보정
  const Ms = norm360(356.047 + 0.9856002585 * d);
  const Mm = M / RAD;
  const Ls = sunEclipticLon(d);
  const Lm = norm360(N / RAD + w / RAD + Mm);
  const D = Lm - Ls;
  const F = Lm - N / RAD;
  lon +=
    -1.274 * Math.sin((Mm - 2 * D) * RAD) +
    0.658 * Math.sin(2 * D * RAD) -
    0.186 * Math.sin(Ms * RAD) -
    0.059 * Math.sin((2 * Mm - 2 * D) * RAD) -
    0.057 * Math.sin((Mm - 2 * D + Ms) * RAD) +
    0.053 * Math.sin((Mm + 2 * D) * RAD);
  lat += -0.173 * Math.sin((F - 2 * D) * RAD);
  lon = norm360(lon);
  // 황도 → 적도
  const ecl = (23.4393 - 3.563e-7 * d) * RAD;
  const lo = lon * RAD;
  const la = lat * RAD;
  const xe = Math.cos(la) * Math.cos(lo);
  const ye = Math.cos(la) * Math.sin(lo) * Math.cos(ecl) - Math.sin(la) * Math.sin(ecl);
  const ze = Math.cos(la) * Math.sin(lo) * Math.sin(ecl) + Math.sin(la) * Math.cos(ecl);
  const ra = norm360(Math.atan2(ye, xe) / RAD);
  const dec = Math.atan2(ze, Math.sqrt(xe * xe + ye * ye)) / RAD;
  // 위상: 해와 달의 황경 차이
  const elong = norm360(lon - Ls);
  const illum = (1 - Math.cos(elong * RAD)) / 2;
  return { ra, dec, illum, waxing: elong < 180, elong };
}

// 주요 유성우 (극대일, 복사점 적경·적위, 극대 시 시간당 유성 수 ZHR, 지속 폭(일))
export const SHOWERS = [
  { name: '사분의자리 유성우', m: 1, d: 3.8, ra: 230, dec: 49, zhr: 110, width: 0.6 },
  { name: '거문고자리 유성우', m: 4, d: 22.5, ra: 271, dec: 34, zhr: 18, width: 1.3 },
  { name: '물병자리 에타 유성우', m: 5, d: 6, ra: 338, dec: -1, zhr: 50, width: 3 },
  { name: '페르세우스자리 유성우', m: 8, d: 12.7, ra: 48, dec: 58, zhr: 100, width: 2.5 },
  { name: '오리온자리 유성우', m: 10, d: 21.5, ra: 95, dec: 16, zhr: 20, width: 3 },
  { name: '사자자리 유성우', m: 11, d: 17.5, ra: 152, dec: 22, zhr: 15, width: 1.5 },
  { name: '쌍둥이자리 유성우', m: 12, d: 14.3, ra: 112, dec: 33, zhr: 150, width: 1.5 },
  { name: '작은곰자리 유성우', m: 12, d: 22.4, ra: 217, dec: 76, zhr: 10, width: 1 },
];
export const SPORADIC_PER_HOUR = 8;

// 지금 활동 중인 유성우와 그 세기
export function activeShower(date) {
  let best = null;
  const t = date.getTime();
  const y = new Date(t + 9 * 3600e3).getUTCFullYear();
  for (const s of SHOWERS) {
    for (const yy of [y - 1, y, y + 1]) {
      const peak = Date.UTC(yy, s.m - 1, 1) - 9 * 3600e3 + (s.d - 1) * 86400e3;
      const days = Math.abs(t - peak) / 86400e3;
      const rate = s.zhr * Math.exp(-0.5 * (days / s.width) ** 2); // 극대일을 중심으로 종 모양
      if (rate >= 4 && (!best || rate > best.rate)) best = { ...s, rate, peak: new Date(peak), daysFromPeak: (t - peak) / 86400e3 };
    }
  }
  return best;
}
