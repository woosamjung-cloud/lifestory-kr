// 다국어 지원 (지금은 한국어·English, 나라가 늘면 사전에 언어를 추가)
// - HTML: data-i18n="키" (글자), data-i18n-ph="키" (입력칸 안내 글), data-i18n-html="키" (줄바꿈 포함)
// - JS: t('키', { 이름: 값 })

const DICT = {
  ko: {
    'lang.name': '한국어',
    'home.eyebrow': '곧 방구석 해돋이호 출발합니다',
    'home.title': '이불 밖은 추우니까',
    'home.lead': '잠옷 입고 탑승하세요. 혼자 보면 추우니까,<br>정동진 해돋이와 정서진 노을을 같이 봐요.',
    'picket.tag': '대기실 피켓',
    'booth.title': '매표소',
    'booth.pick': '어디로 떠날까요?',
    'booth.selected': '선택됨',
    'booth.online': '지금 {n}명이 탑승해 있어요',
    'dest.bound': '{place}행',
    'dest.until.sunrise': '해돋이까지',
    'dest.until.sunset': '해넘이까지',
    'dest.done.sunrise': '해가 떴어요',
    'dest.done.sunset': '해가 졌어요',
    'dest.ago': '{m}분 전',
    'dest.justnow': '방금',
    'event.sunrise': '해돋이',
    'event.sunset': '해넘이',
    'country.KR': '한국',
    'place.east': '정동진',
    'place.west': '정서진',
    'form.name': '승객 이름',
    'form.nameHint': '(선택, 승차권에만 써요)',
    'form.namePh': '예) 잠꾸러기',
    'form.look': '나의 모습',
    'form.color': '옷 색',
    'form.hair': '머리 색',
    'form.pet': '함께 온 친구',
    'form.petName': '친구 이름',
    'form.petNameHint': '(선택, 내 화면에만 보여요)',
    'form.petNamePh': '예) 콩이',
    'form.ticket': '승차권 받기',
    'form.fine': '가입·설치 없음 · 적은 글은 내 기기에만 남아요',
    'char.blanket': '담요를 두른',
    'char.hood': '후드를 쓴',
    'char.scarf': '목도리를 한',
    'char.beanie': '비니를 쓴',
    'char.coat': '코트를 입은',
  },
  en: {
    'lang.name': 'English',
    'home.eyebrow': 'The Cozy Sunrise Express departs soon',
    'home.title': 'Too Cold to Leave the Blanket',
    'home.lead': 'Board in your pajamas. Watching alone is a little chilly,<br>so let’s watch the sunrise and sunset together.',
    'picket.tag': 'Waiting room sign',
    'booth.title': 'Ticket booth',
    'booth.pick': 'Where shall we go?',
    'booth.selected': 'Selected',
    'booth.online': '{n} people on board now',
    'dest.bound': 'To {place}',
    'dest.until.sunrise': 'Sunrise in',
    'dest.until.sunset': 'Sunset in',
    'dest.done.sunrise': 'The sun is up',
    'dest.done.sunset': 'The sun has set',
    'dest.ago': '{m} min ago',
    'dest.justnow': 'just now',
    'event.sunrise': 'Sunrise',
    'event.sunset': 'Sunset',
    'country.KR': 'Korea',
    'place.east': 'Jeongdongjin',
    'place.west': 'Jeongseojin',
    'form.name': 'Passenger name',
    'form.nameHint': '(optional, only on your ticket)',
    'form.namePh': 'e.g. Sleepyhead',
    'form.look': 'Your look',
    'form.color': 'Clothes',
    'form.hair': 'Hair',
    'form.pet': 'Your buddy',
    'form.petName': 'Buddy’s name',
    'form.petNameHint': '(optional, only you can see it)',
    'form.petNamePh': 'e.g. Bean',
    'form.ticket': 'Get my ticket',
    'form.fine': 'No sign-up, no install · What you write stays on your device',
    'char.blanket': 'Blanket',
    'char.hood': 'Hoodie',
    'char.scarf': 'Scarf',
    'char.beanie': 'Beanie',
    'char.coat': 'Coat',
    'pet.0': 'None',
    'pet.1': 'Puppy',
    'pet.2': 'Kitty',
    'pet.3': 'Poodle',
    'pet.4': 'Corgi',
    'pet.5': 'Maltese',
    'pet.6': 'Spitz',
    'pet.7': 'Persian',
    'pet.8': 'Siamese',
    'pet.9': 'Booted cat',
  },
};

export const LANGS = Object.keys(DICT);

function detect() {
  try {
    const saved = localStorage.getItem('haedoti.lang');
    if (saved && DICT[saved]) return saved;
  } catch {
    /* 저장 불가 */
  }
  const nav = (navigator.language || 'ko').slice(0, 2).toLowerCase();
  return DICT[nav] ? nav : 'ko';
}

let lang = detect();
export const getLang = () => lang;

export function setLang(l) {
  if (!DICT[l]) return;
  lang = l;
  try {
    localStorage.setItem('haedoti.lang', l);
  } catch {
    /* 저장 불가 */
  }
  document.documentElement.lang = l;
  applyI18n();
}

export function t(key, vars) {
  let s = (DICT[lang] && DICT[lang][key]) ?? DICT.ko[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  return s;
}

// 사전에 있으면 번역, 없으면 원래 글자 그대로
export function tOr(key, fallback) {
  return (DICT[lang] && DICT[lang][key]) ?? fallback;
}

export function applyI18n(root = document) {
  document.documentElement.lang = lang;
  root.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n)));
  root.querySelectorAll('[data-i18n-html]').forEach((el) => (el.innerHTML = t(el.dataset.i18nHtml)));
  root.querySelectorAll('[data-i18n-ph]').forEach((el) => (el.placeholder = t(el.dataset.i18nPh)));
}
