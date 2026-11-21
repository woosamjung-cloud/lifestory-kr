// 날마다 새롭게 — 오늘의 한 줄과 나의 하루 기록
// 고전 문장은 저작권이 끝난 원전을 직접 옮겼고, 나머지는 이 서비스를 위해 새로 쓴 문장입니다.

export const LINES = [
  ['진실로 하루가 새로워지려면, 날마다 새롭게 하고 또 날마다 새롭게 하라.', '『대학』 탕왕의 세숫대야에 새긴 글'],
  ['어제의 해는 어제 졌어요. 오늘의 해는 처음 뜨는 해예요.', ''],
  ['아침은 내가 깨어 있는 때이고, 내 안에 새벽이 있는 때다.', '소로, 『월든』'],
  ['내일은 아직 아무 실수도 하지 않은 새로운 날이에요.', '몽고메리, 『빨강머리 앤』'],
  ['다 끝내지 못해도 괜찮아요. 해도 매일 다 비추고 지지는 않으니까.', ''],
  ['가장 좋은 것은 물과 같다. 물은 만물을 이롭게 하되 다투지 않는다.', '노자, 『도덕경』'],
  ['오늘 하루, 잘 버틴 것만으로도 노을을 볼 자격이 있어요.', ''],
  ['배우고 때때로 익히면 또한 기쁘지 아니한가.', '공자, 『논어』'],
  ['놓아 보낸 것들은 바다가 잘 데리고 갈 거예요.', ''],
  ['천 리 길도 발밑에서 시작된다.', '노자, 『도덕경』'],
  ['같은 바다, 같은 해. 그래도 오늘의 빛깔은 오늘뿐이에요.', ''],
  ['어제의 일은 어제의 바다에 두고 와요.', ''],
  ['하루를 여는 데는 긴 다짐이 필요 없어요. 한 가지면 충분해요.', ''],
  ['슬플 땐 해 지는 걸 보고 싶어져.', '생텍쥐페리, 『어린 왕자』'],
  ['잘한 일 하나, 고마운 사람 하나. 그거면 오늘은 좋은 날이에요.', ''],
  ['봄에는 꽃, 여름엔 바람, 가을엔 달, 겨울엔 눈. 마음에 걸림 없으면 그때가 좋은 때.', '무문 혜개, 『무문관』'],
  ['어둠이 다 지나야 해가 뜨는 게 아니라, 해가 떠서 어둠이 지나가요.', ''],
  ['오늘 내려놓은 만큼, 내일 담을 자리가 생겨요.', ''],
  ['흐린 날에도 해는 구름 뒤에서 제 시간에 떠 있어요.', ''],
  ['서두르지 않아도 해는 정확히 떠요. 우리도 그래요.', ''],
  ['오늘의 나는 어제의 나보다 하루만큼 더 살아 봤어요.', ''],
  ['나는 날마다 세 번 나를 돌아본다.', '증자, 『논어』'],
  ['모닥불 앞에서는 아무 말 안 해도 괜찮아요.', ''],
  ['해는 지는 게 아니라, 다른 누군가의 아침으로 가는 거예요.', ''],
  ['일을 이루면 물러나는 것, 그것이 하늘의 길이다.', '노자, 『도덕경』'],
  ['오늘 처음 본 하늘이, 오늘의 가장 큰 선물이었으면.', ''],
  ['잊을 것은 잊고, 남길 것은 마음에 한 줄만.', ''],
  ['새벽은 언제나 가장 조용하게 와요.', ''],
  ['멈춰 서서 노을을 보는 일, 그것도 하루의 중요한 일이에요.', ''],
  ['오늘도 수고했어요. 내일의 해는 또 새로 떠요.', ''],
];

function dayKey(d = new Date()) {
  // 한국 시간 기준 날짜
  const k = new Date(d.getTime() + 9 * 3600e3);
  return k.toISOString().slice(0, 10);
}

export function todayLine(d = new Date()) {
  const k = dayKey(d);
  const n = Math.floor(Date.parse(k) / 86400e3);
  return LINES[((n % LINES.length) + LINES.length) % LINES.length];
}

// 나의 하루 기록 (내 기기에만 저장). 끊겨도 아무 불이익 없음.
export function loadDays(store) {
  const v = store.get('days', {});
  return v && typeof v === 'object' ? v : {};
}

export function recordDay(store, place, d = new Date()) {
  const days = loadDays(store);
  const k = dayKey(d);
  const cur = days[k] || '';
  const mark = place === 'east' ? 'e' : 'w';
  if (!cur.includes(mark)) days[k] = cur + mark;
  // 너무 커지지 않게 최근 3년치만
  const keys = Object.keys(days).sort();
  while (keys.length > 1100) delete days[keys.shift()];
  store.set('days', days);
  return days;
}

export function dayStats(days) {
  let opened = 0;
  let closed = 0;
  for (const v of Object.values(days)) {
    if (v.includes('e')) opened++;
    if (v.includes('w')) closed++;
  }
  return { total: Object.keys(days).length, opened, closed };
}
