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

// ---------- 1:1 수다톡 (동전 1개로 연 두 사람만의 대화) ----------
// 한마디보다 넉넉하게: 80자, 숫자·시간 표현은 허용. 욕설은 가리고(♡) 보내고,
// 링크·전화번호·도박·대출·오픈채팅 같은 외부 유도는 막음
export const CHAT_MAX = 80;
const CHAT_SWEAR = ['씨발', '시발', '씨바', 'ㅅㅂ', 'ㅆㅂ', '병신', 'ㅂㅅ', '븅신', '좆', '존나', 'ㅈㄴ', '개새끼', '개새', '새끼', 'ㅅㄲ', '지랄', 'ㅈㄹ', '엠창', '느금', '니애미', '애미', '애비', '꺼져', '닥쳐', '한남', '김치녀', '틀딱', 'fuck', 'shit', 'bitch'];
const CHAT_BLOCK = ['섹스', '야동', '보지', '자지', 'porn', 'sex', '토토', '카지노', '도박', '바카라', '대출', '텔레그램', '텔레', '오픈채팅', '오픈톡', '오카방', '코인방', '리딩방', '부업', '고수익', '스폰', '조건만남'];
const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function cleanChat(raw) {
  if (typeof raw !== 'string') return { error: '글을 적어 주세요' };
  let text = raw.replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e\ufeff]/g, '').replace(/\s+/g, ' ').trim();
  if (!text) return { error: '글을 적어 주세요' };
  if ([...text].length > CHAT_MAX) return { error: `${CHAT_MAX}자까지 쓸 수 있어요` };
  const flat = text.toLowerCase().replace(/[\s.\-_~!@#$%^&*()+=|\\/,'"`?<>:;[\]{}·…]/g, '');
  if (/https?|www|\.(com|kr|net|io|me|ly|gg)\b/i.test(text) || /(com|net)$/.test(flat)) return { error: '링크는 보낼 수 없어요' };
  if (/\d{7,}/.test(flat.replace(/[^0-9]/g, '').length >= 9 ? flat.replace(/[^0-9]/g, '') : flat) || /01[016789]\d{3,4}\d{4}/.test(flat)) return { error: '전화번호는 보낼 수 없어요' };
  if (CHAT_BLOCK.some((w) => flat.includes(w))) return { error: '그 말은 보낼 수 없어요' };
  let masked = false;
  for (const w of CHAT_SWEAR) {
    const re = new RegExp(esc(w), 'gi');
    if (re.test(text)) {
      text = text.replace(re, '♡'.repeat([...w].length));
      masked = true;
    }
  }
  if (!masked && CHAT_SWEAR.some((w) => flat.includes(w))) text = '♡♡♡';
  return { text };
}
