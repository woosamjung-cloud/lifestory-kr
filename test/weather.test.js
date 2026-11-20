import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toGrid, baseTime, parseForecast } from '../weather.js';

test('격자 변환: 서울시청은 기상청 격자 (60, 127)', () => {
  assert.deepEqual(toGrid(37.5665, 126.978), { nx: 60, ny: 127 });
});

test('정동진·정서진 격자는 동해안·서해안 쪽', () => {
  const e = toGrid(37.6906, 129.0339);
  const w = toGrid(37.5622, 126.6042);
  assert.ok(e.nx > 90, JSON.stringify(e));
  assert.ok(w.nx < 58, JSON.stringify(w));
});

test('발표 시각: 45분 전이면 한 시간 전 30분 발표분', () => {
  assert.deepEqual(baseTime(new Date('2026-12-31T23:40:00+09:00')), { base_date: '20261231', base_time: '2230' });
  assert.deepEqual(baseTime(new Date('2027-01-01T00:20:00+09:00')), { base_date: '20261231', base_time: '2330' });
  assert.deepEqual(baseTime(new Date('2027-01-01T07:50:00+09:00')), { base_date: '20270101', base_time: '0730' });
});

test('예보 해석: 가장 이른 시각의 하늘·강수·기온', () => {
  const items = [
    { category: 'SKY', fcstDate: '20270101', fcstTime: '0900', fcstValue: '1' },
    { category: 'SKY', fcstDate: '20270101', fcstTime: '0800', fcstValue: '4' },
    { category: 'PTY', fcstDate: '20270101', fcstTime: '0800', fcstValue: '3' },
    { category: 'T1H', fcstDate: '20270101', fcstTime: '0800', fcstValue: '-2' },
  ];
  const r = parseForecast(items);
  assert.equal(r.sky, 4);
  assert.equal(r.pty, 3);
  assert.equal(r.temp, -2);
  assert.equal(r.label, '눈');
  assert.equal(parseForecast([]), null);
});
