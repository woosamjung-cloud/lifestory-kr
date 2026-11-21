// 직접 쓰는 한마디 검사: 15자 이내, 욕설·연락처·링크·광고 거름
export const CUSTOM_MAX = 15;
export const CUSTOM_GAP_MS = 10 * 60 * 1000; // 10분에 한 번

const BAD = [
  '씨발', '시발', '씨바', 'ㅅㅂ', 'ㅆㅂ', 'ㅅ ㅂ', '병신', 'ㅂㅅ', '븅신', '좆', '존나', 'ㅈㄴ', '개새', '새끼', 'ㅅㄲ', '지랄', 'ㅈㄹ',
  '엠창', '느금', '니애미', '느그', '애미', '애비', '섹스', '야동', '보지', '자지', '꺼져', '닥쳐', '한남', '김치녀', '틀딱', '일베', '메갈',
  '토토', '카지노', '도박', '바카라', '대출', '텔레', '카톡', '오픈채팅', '오픈톡', '홍보', '부업', '수익', '코인방', '리딩방', '인스타', 'dm',
  'fuck', 'shit', 'bitch', 'sex', 'porn',
];

export function cleanCustom(raw) {
  if (typeof raw !== 'string') return { error: '글을 적어 주세요' };
  const text = raw.replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e\ufeff]/g, '').replace(/\s+/g, ' ').trim();
  if (!text) return { error: '글을 적어 주세요' };
  if ([...text].length > CUSTOM_MAX) return { error: `${CUSTOM_MAX}자까지 쓸 수 있어요` };
  const flat = text.toLowerCase().replace(/[\s.\-_~!@#$%^&*()+=|\\/,'"`?<>:;[\]{}·…]/g, '');
  if (/https?|www|\.(com|kr|net|io|me|ly)\b/i.test(text) || /(com|net)$/.test(flat)) return { error: '링크는 보낼 수 없어요' };
  if (/\d{4,}/.test(flat) || /[0-9０-９]{2,}.*[0-9０-９]{2,}.*[0-9０-９]{2,}/.test(text)) return { error: '전화번호·숫자는 보낼 수 없어요' };
  if (BAD.some((w) => flat.includes(w.replace(/\s/g, '')))) return { error: '그 말은 보낼 수 없어요' };
  return { text };
}
