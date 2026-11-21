// 승차권과 인증 카드 이미지 만들기 (인스타그램 4:5 비율, 1080x1350)

import { PLACES, formatHM, formatDateKo } from './sun.js';
import { renderPortrait, CHAR_LIST } from './characters.js';
import { roundRect } from './scene.js';

const W = 1080;
const H = 1350;
const FONT = '"Gowun Batang", "AppleMyungjo", "Batang", serif';
const TITLE = '"Nanum Brush Script", "Gowun Batang", serif';

// 구글 웹 글꼴은 글자 묶음별로 나눠 내려받기 때문에, 캔버스에 쓸 글자를 미리 불러옵니다.
async function loadGlyphs(text) {
  if (!document.fonts || !document.fonts.load) return;
  try {
    await Promise.all([document.fonts.load(`40px "Nanum Brush Script"`, text), document.fonts.load(`40px "Gowun Batang"`, text), document.fonts.load(`700 40px "Gowun Batang"`, text)]);
  } catch {
    /* 글꼴을 못 불러와도 기본 글꼴로 그립니다 */
  }
}

function newCanvas() {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  return c;
}

// 좌석 번호 → "3호차 17번"
export function seatLabel(seat, fallbackSeed = 0) {
  const n = seat != null ? seat : Math.abs(fallbackSeed) % 400;
  return `${Math.floor(n / 40) + 1}호차 ${(n % 40) + 1}번`;
}

export async function makeTicket({ name, char, color, hair = 0, pet = 0, event, seat, seed }) {
  await loadGlyphs(`방구석해돋이호해넘이열차승차권편도잠옷착용출발도착내방정동진정서진승객날짜일출일몰예정좌석호차번익명의여행자년월일새해첫마지막이불밖은추우니에서봐요담요를두른후드를쓴목도리를한비니를쓴코트를입은→0123456789:${name || ''}`);
  const c = newCanvas();
  const ctx = c.getContext('2d');
  const place = PLACES[event.place];
  const east = event.place === 'east';

  // 배경: 새벽빛 / 노을빛
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  if (east) {
    bg.addColorStop(0, '#16204a');
    bg.addColorStop(0.55, '#6d4a7c');
    bg.addColorStop(1, '#ff9a5c');
  } else {
    bg.addColorStop(0, '#2a3c78');
    bg.addColorStop(0.5, '#d26f5f');
    bg.addColorStop(1, '#ffbe7a');
  }
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 승차권 종이
  const tx = 90;
  const ty = 150;
  const tw = W - 180;
  const th = H - 300;
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 40;
  ctx.fillStyle = '#fffaf0';
  roundRect(ctx, tx, ty, tw, th, 36);
  ctx.fill();
  ctx.shadowBlur = 0;

  // 머리띠
  ctx.save();
  roundRect(ctx, tx, ty, tw, th, 36);
  ctx.clip();
  ctx.fillStyle = east ? '#b9574e' : '#4c5f8f';
  ctx.fillRect(tx, ty, tw, 150);
  ctx.restore();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `64px ${TITLE}`;
  ctx.fillText('방구석 해돋이호', tx + 60, ty + 64);
  ctx.font = `30px ${FONT}`;
  ctx.fillText(east ? '해돋이 열차 · 승차권' : '해넘이 열차 · 승차권', tx + 60, ty + 115);
  ctx.textAlign = 'right';
  ctx.font = `30px ${FONT}`;
  ctx.fillText('편도 · 잠옷 착용', tx + tw - 60, ty + 64);

  // 구간
  ctx.fillStyle = '#3b2a20';
  ctx.textAlign = 'left';
  ctx.font = `36px ${FONT}`;
  ctx.fillText('출발', tx + 60, ty + 230);
  ctx.textAlign = 'right';
  ctx.fillText('도착', tx + tw - 60, ty + 230);
  ctx.font = `92px ${TITLE}`;
  ctx.textAlign = 'left';
  ctx.fillText('내 방', tx + 60, ty + 320);
  ctx.textAlign = 'right';
  ctx.fillText(place.name, tx + tw - 60, ty + 320);
  ctx.textAlign = 'center';
  ctx.font = `60px ${FONT}`;
  ctx.fillText('→', tx + tw / 2, ty + 318);

  // 정보 칸
  const rows = [
    ['승객', name || '익명의 여행자'],
    ['날짜', formatDateKo(event.time)],
    [east ? '일출' : '일몰', `${formatHM(event.time)} 예정`],
    ['좌석', seatLabel(seat, seed)],
  ];
  ctx.textAlign = 'left';
  rows.forEach(([k, v], i) => {
    const y = ty + 440 + i * 92;
    ctx.fillStyle = '#9a7b66';
    ctx.font = `34px ${FONT}`;
    ctx.fillText(k, tx + 60, y);
    ctx.fillStyle = '#3b2a20';
    ctx.font = `46px ${FONT}`;
    ctx.fillText(v, tx + 200, y);
  });

  // 캐릭터
  const pc = document.createElement('canvas');
  pc.width = pc.height = 300;
  renderPortrait(pc, char, color, hair, pet);
  ctx.drawImage(pc, tx + tw - 330, ty + 500, 280, 280);
  ctx.fillStyle = '#9a7b66';
  ctx.font = `28px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText((CHAR_LIST.find((x) => x.key === char) || CHAR_LIST[0]).name, tx + tw - 190, ty + 830);

  // 절취선
  const cutY = ty + th - 190;
  ctx.strokeStyle = '#d9c9b5';
  ctx.setLineDash([16, 14]);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(tx + 40, cutY);
  ctx.lineTo(tx + tw - 40, cutY);
  ctx.stroke();
  ctx.setLineDash([]);
  const bgTop = east ? '#6d4a7c' : '#d26f5f';
  for (const sx of [tx, tx + tw]) {
    ctx.fillStyle = bgTop;
    ctx.beginPath();
    ctx.arc(sx, cutY, 28, 0, Math.PI * 2);
    ctx.fill();
  }

  // 바코드 느낌 줄무늬 + 문구
  let bx = tx + 60;
  let r = (seed || 7) >>> 0;
  while (bx < tx + tw * 0.55) {
    r = (r * 1103515245 + 12345) >>> 0;
    const w = 3 + (r % 9);
    ctx.fillStyle = '#3b2a20';
    ctx.fillRect(bx, cutY + 50, w, 90);
    bx += w + 4 + ((r >> 8) % 6);
  }
  ctx.textAlign = 'right';
  ctx.fillStyle = '#3b2a20';
  ctx.font = `34px ${FONT}`;
  ctx.fillText(event.special || `${place.name} ${place.eventName}`, tx + tw - 60, cutY + 75);
  ctx.fillStyle = '#9a7b66';
  ctx.font = `28px ${FONT}`;
  ctx.fillText('이불 밖은 추우니 방에서 봐요', tx + tw - 60, cutY + 120);

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.textAlign = 'center';
  ctx.font = `30px ${FONT}`;
  ctx.fillText(location.host || '방구석 해돋이호', W / 2, H - 80);
  return c;
}

// 인증 카드: 지금 화면(하늘)을 배경으로
export async function makeProofCard({ sceneCanvas, event, name, witnesses, wish, focusY }) {
  await loadGlyphs(`정동진정서진년월일오늘의해돋이해넘이새해첫마지막를함께봤어요방구석에서본사람명나소원바다에띄워보낸것호“”·0123456789:,${name || ''}${wish || ''}`);
  const c = newCanvas();
  const ctx = c.getContext('2d');
  const place = PLACES[event.place];
  const east = event.place === 'east';

  // 장면을 4:5로 잘라 채우기: 세로 화면이면 내 캐릭터가 아래쪽에 오도록 자릅니다.
  const sw = sceneCanvas.width;
  const sh = sceneCanvas.height;
  const ratio = sw / (sceneCanvas.clientWidth || sw);
  let cw = sw;
  let ch = sw * 1.25;
  let cx = 0;
  let cy = 0;
  if (ch > sh) {
    ch = sh;
    cw = sh * 0.8;
    cx = (sw - cw) / 2;
  } else {
    const bottom = Math.min(sh, ((focusY || sh / ratio) + 30) * ratio);
    cy = Math.max(0, bottom - ch);
  }
  ctx.drawImage(sceneCanvas, cx, cy, cw, ch, 0, 0, W, H);

  const shade = ctx.createLinearGradient(0, 0, 0, H * 0.45);
  shade.addColorStop(0, 'rgba(0,0,0,0.55)');
  shade.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H * 0.45);

  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 12;
  ctx.font = `40px ${FONT}`;
  ctx.fillText(`${place.name} · ${formatDateKo(event.time)} ${formatHM(event.time)}`, W / 2, 110);
  ctx.font = `76px ${TITLE}`;
  const title = event.special ? `${event.special}를` : east ? '오늘의 해돋이를' : '오늘의 해넘이를';
  ctx.fillText(title, W / 2, 210);
  ctx.fillText(witnesses > 1 ? '함께 봤어요' : '방구석에서 봤어요', W / 2, 300);
  if (witnesses > 1) {
    ctx.font = `40px ${FONT}`;
    ctx.fillText(`함께 본 사람 ${witnesses.toLocaleString('ko-KR')}명`, W / 2, 380);
  }
  ctx.shadowBlur = 0;

  // 소원은 해를 가리지 않도록 제목 아래에 글자로만 얹습니다.
  if (wish) {
    const label = east ? '🏮 나의 소원' : '🍾 바다에 띄운 편지';
    const y0 = witnesses > 1 ? 450 : 380;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = 'rgba(255,240,215,0.95)';
    ctx.font = `30px ${FONT}`;
    ctx.fillText(label, W / 2, y0);
    ctx.fillStyle = '#fff';
    const lines = wrap(ctx, `“${wish}”`, W - 220, `44px ${FONT}`);
    lines.forEach((ln, i) => ctx.fillText(ln, W / 2, y0 + 56 + i * 56));
    ctx.shadowBlur = 0;
  }

  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = `34px ${TITLE}`;
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 10;
  ctx.fillText(`방구석 해돋이호${name ? ` · ${name}` : ''}`, W / 2, H - 110);
  ctx.font = `26px ${FONT}`;
  ctx.fillText(location.host || '', W / 2, H - 65);
  return c;
}

function wrap(ctx, text, maxW, font) {
  ctx.font = font;
  const out = [];
  let line = '';
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > maxW && line) {
      out.push(line);
      line = ch;
    } else line += ch;
  }
  if (line) out.push(line);
  return out.slice(0, 3);
}

// 저장 또는 공유
export async function saveOrShare(canvas, filename, shareText) {
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: shareText });
      return 'shared';
    } catch (err) {
      if (err && err.name === 'AbortError') return 'cancelled';
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return 'downloaded';
}
