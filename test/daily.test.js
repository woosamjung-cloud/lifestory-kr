import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LINES, todayLine, recordDay, loadDays, dayStats } from '../public/js/daily.js';

function memStore() {
  const m = {};
  return { get: (k, d) => (k in m ? JSON.parse(m[k]) : d), set: (k, v) => (m[k] = JSON.stringify(v)) };
}

test('오늘의 한 줄은 하루 동안 같고 다음 날 바뀐다', () => {
  const a = todayLine(new Date('2026-11-21T01:00:00+09:00'));
  const b = todayLine(new Date('2026-11-21T23:30:00+09:00'));
  const c = todayLine(new Date('2026-11-22T00:10:00+09:00'));
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.ok(LINES.every(([t]) => t.length > 0 && t.length < 80));
});

test('나의 하루 기록: 같은 날 여러 번 와도 하루, 아침·저녁 따로 셈', () => {
  const s = memStore();
  recordDay(s, 'east', new Date('2026-11-21T07:00:00+09:00'));
  recordDay(s, 'east', new Date('2026-11-21T07:30:00+09:00'));
  recordDay(s, 'west', new Date('2026-11-21T17:20:00+09:00'));
  recordDay(s, 'west', new Date('2026-11-23T17:20:00+09:00'));
  assert.deepEqual(dayStats(loadDays(s)), { total: 2, opened: 1, closed: 2 });
});
