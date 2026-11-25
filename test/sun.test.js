import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sunTimes, formatHM, currentEvent, kstMidnight, solarPosition, PLACES } from '../public/js/sun.js';

const near = (date, hm, tol = 3) => {
  const [h, m] = formatHM(date).split(':').map(Number);
  const [eh, em] = hm.split(':').map(Number);
  return Math.abs(h * 60 + m - (eh * 60 + em)) <= tol;
};

test('정동진 2027-01-01 일출은 07:38 전후', () => {
  const { sunrise } = sunTimes('east', kstMidnight(2027, 1, 1));
  assert.ok(near(sunrise, '07:39'), formatHM(sunrise));
});

test('정서진 2026-12-31 일몰은 17:24 전후', () => {
  const { sunset } = sunTimes('west', kstMidnight(2026, 12, 31));
  assert.ok(near(sunset, '17:24'), formatHM(sunset));
});

test('서울 하지 일출은 05:11 전후 (천문연 발표값 근사)', () => {
  const seoul = { lat: 37.5665, lon: 126.978 };
  const pos = solarPosition(new Date('2026-06-21T05:11:00+09:00'), seoul.lat, seoul.lon);
  assert.ok(Math.abs(pos.elevation + 0.833) < 0.6, String(pos.elevation));
});

test('정동진 일출 방위각은 동쪽(100~125도)', () => {
  const { sunrise } = sunTimes('east', kstMidnight(2027, 1, 1));
  const pos = solarPosition(sunrise, PLACES.east.lat, PLACES.east.lon);
  assert.ok(pos.azimuth > 100 && pos.azimuth < 125, String(pos.azimuth));
});

test('현재 이벤트 선택: 12/31 오후 3시는 정서진 마지막 해넘이', () => {
  const ev = currentEvent(new Date('2026-12-31T15:00:00+09:00'));
  assert.equal(ev.place, 'west');
  assert.equal(ev.special, '2026년 마지막 해넘이');
});

test('현재 이벤트 선택: 12/31 밤 11시는 정동진 새해 첫 해돋이', () => {
  const ev = currentEvent(new Date('2026-12-31T23:00:00+09:00'));
  assert.equal(ev.place, 'east');
  assert.equal(ev.special, '2027년 새해 첫 해돋이');
});

test('일출 직후 30분은 아직 정동진 장면 유지', () => {
  const { sunrise } = sunTimes('east', kstMidnight(2026, 11, 21));
  const ev = currentEvent(new Date(sunrise.getTime() + 30 * 60000));
  assert.equal(ev.place, 'east');
});

test('크리스마스 특별 운행 표시', () => {
  assert.equal(currentEvent(new Date('2026-12-24T15:00:00+09:00')).special, '크리스마스 이브 해넘이');
  assert.equal(currentEvent(new Date('2026-12-25T06:00:00+09:00')).special, '크리스마스 아침 해돋이');
});

// 규칙: 같은 지역(30km 안)의 다른 편(열차·비행기)은 배경(scenery)과 바라보는 자리(spot)가 달라야 함
test('스테이지 규칙: 같은 지역이라도 편마다 배경과 자리가 다름', async () => {
  const { PLACES } = await import('../public/js/sun.js');
  const list = Object.values(PLACES);
  const km = (a, b) => {
    const r = Math.PI / 180;
    const d = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(d));
  };
  for (const p of list) {
    assert.ok(p.scenery, `${p.key}: 배경(scenery)이 없음`);
    assert.ok(p.spot, `${p.key}: 바라보는 자리(spot)가 없음`);
  }
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      assert.notEqual(a.spot, b.spot, `${a.key}·${b.key}: 바라보는 자리가 같음`);
      if (km(a, b) < 30) assert.notEqual(a.scenery, b.scenery, `${a.key}·${b.key}: 같은 지역인데 배경이 같음`);
    }
  }
});
