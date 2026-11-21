// 나라와 행선지 설정 (서버·화면이 함께 씀)
// - 나라를 늘리려면: COUNTRIES에 한 줄 + sun.js PLACES에 장소 + 아래 DESTINATIONS에 장소 키
// - weather: 그 나라 날씨를 가져올 곳 (weather.js의 PROVIDERS 이름). 없으면 날씨 없이 동작
export const COUNTRIES = {
  KR: { flag: '🇰🇷', code: 'KOREA', names: { ko: '한국', en: 'Korea' }, weather: 'kma' },
  // 예) JP: { flag: '🇯🇵', code: 'JAPAN', names: { ko: '일본', en: 'Japan', ja: '日本' }, weather: 'openmeteo' },
};

// 매표소에 보이는 행선지 (순서대로, sun.js PLACES의 키)
export const DESTINATIONS = ['east', 'west'];

export function countryOf(place) {
  return COUNTRIES[place && place.country] || null;
}
