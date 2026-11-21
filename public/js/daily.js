// 날마다 새롭게 — 오늘의 한 줄과 나의 하루 기록
// 편하고 살짝 웃음 나는 한 줄 (모두 이 서비스를 위해 새로 쓴 문장)

export const LINES = [
  ['해는 알람 없이도 일어나요. 우리는 이불 속에서 응원만 해요.', ''],
  ['오늘 할 일: 해 보기. 끝. 참 잘했어요.', ''],
  ['이불 밖은 위험해요. 해돋이는 여기서 봐도 충분해요.', ''],
  ['해도 매일 출근하는데, 우리도 오늘 하루 출석 완료!', ''],
  ['노을 맛집은 웨이팅이 없어요. 바로 입장하세요.', ''],
  ['잠옷 차림 환영. 드레스 코드: 편안함.', ''],
  ['해는 지각한 적이 없대요. 대신 우리가 늦잠 자도 기다려 주진 않아요.', ''],
  ['오늘 수고한 나에게, 노을 한 그릇 대접해요.', ''],
  ['모닥불은 말을 안 해도 다 들어줘요. 장작만 챙겨 주면요.', ''],
  ['구름 낀 날도 해는 출근했어요. 잠깐 커튼 친 것뿐이에요.', ''],
  ['어제의 실수는 어제의 해가 가지고 갔어요.', ''],
  ['따뜻한 차 한 잔, 해 하나, 그리고 이불. 완벽한 조합이에요.', ''],
  ['해 뜨는 거 보면서 “오늘은 좀 괜찮겠다” 해 봐요. 진짜 그렇게 돼요.', ''],
  ['오늘의 운세: 해가 뜹니다. 적중률 100%.', ''],
  ['바다는 출렁, 마음은 몽글, 이불은 포근.', ''],
  ['해한테 소원 빌면 들어줄까요? 일단 빌어 보는 걸로.', ''],
  ['퇴근길 노을은 하루를 버틴 사람에게만 보이는 보너스예요.', ''],
  ['강아지도 고양이도 해 보러 왔어요. 우리도 왔으니 됐어요.', ''],
  ['오늘 아무 일 없었죠? 그게 제일 좋은 일이에요.', ''],
  ['해는 혼자 떠도, 같이 보면 더 예뻐요.', ''],
  ['멍 때리기 좋은 날이에요. 불멍, 물멍, 노을멍.', ''],
  ['오늘 고생한 어깨는 내려놓고, 노을만 올려다봐요.', ''],
  ['해 지는 속도로 천천히 살아도 괜찮아요.', ''],
  ['별이 보이면 오늘도 잘 버틴 거예요. 진짜예요.', ''],
  ['따끈한 고구마가 생각나는 저녁이에요. 마음만이라도 호호.', ''],
  ['월요병도 해돋이 앞에선 잠깐 조용해져요.', ''],
  ['해는 내일도 와요. 그러니 오늘은 푹 자도 돼요.', ''],
  ['한 줄 소원, 한 장 사진, 한 번 “와!”. 오늘 할 일 끝.', ''],
  ['바람이 불면 장작 하나 더. 마음이 시리면 하트 하나 더.', ''],
  ['오늘도 이불 밖으로 안 나가고 해를 봤어요. 대단해요.', ''],
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
