import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gmst, equToHor, moonPosition, activeShower } from '../public/js/sky.js';

const LAT = 37.69;
const LON = 129.03;

test('북극성 고도는 위도와 거의 같음 (언제 보아도)', () => {
  for (const t of ['2026-12-31T22:00:00+09:00', '2027-06-01T02:00:00+09:00']) {
    const d = new Date(t);
    const { alt, az } = equToHor(37.95, 89.26, LAT, gmst(d) + LON);
    assert.ok(Math.abs(alt - LAT) < 1.2, `alt ${alt}`);
    assert.ok(az < 3 || az > 357, `az ${az}`);
  }
});

test('겨울 밤 9시에는 오리온자리 베텔게우스가 동남쪽 하늘에 떠 있음', () => {
  const d = new Date('2026-12-20T21:00:00+09:00');
  const { alt, az } = equToHor(88.79, 7.41, LAT, gmst(d) + LON);
  assert.ok(alt > 20 && alt < 60, `alt ${alt}`);
  assert.ok(az > 90 && az < 160, `az ${az}`);
});

test('달 위상: 2026-11-24 보름달, 2026-12-09 그믐(삭) 무렵', () => {
  const full = moonPosition(new Date('2026-11-24T23:00:00+09:00'));
  const nw = moonPosition(new Date('2026-12-09T09:00:00+09:00'));
  assert.ok(full.illum > 0.97, `full ${full.illum}`);
  assert.ok(nw.illum < 0.05, `new ${nw.illum}`);
});

test('유성우: 12월 14일 밤은 쌍둥이자리 유성우 극대, 평소에는 없음', () => {
  const g = activeShower(new Date('2026-12-14T23:00:00+09:00'));
  assert.equal(g.name, '쌍둥이자리 유성우');
  assert.ok(g.rate > 100);
  assert.equal(activeShower(new Date('2026-03-10T23:00:00+09:00')), null);
  assert.equal(activeShower(new Date('2027-01-03T23:00:00+09:00')).name, '사분의자리 유성우');
});
