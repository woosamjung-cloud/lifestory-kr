# 이불 밖은 추우니까 (방구석 해돋이호) · 작업 지침

## 먼저 읽을 것 (필수)
- **`docs/스테이지_공통규칙.md` = 제작 규칙.** 어떤 화면·스테이지를 만들거나 고치든 작업 전에 읽고 그대로 따릅니다.
  정동진·정서진에서 정한 규칙도 모든 스테이지에 공통 적용합니다.
- 작업 중 대표님 피드백으로 새 규칙이 생기면 그 문서에 바로 추가하고, 이미 있는 스테이지에도 맞춥니다.

## 서비스
- 사이트: 이불 밖은 추우니까 (영어: Too Cold to Leave the Blanket) / 열차: 방구석 해돋이호 (영어: **Blanket Express** — 세계 누구나 아는 쉬운 두 단어, 담요 특급열차).
  본질은 힐링·불멍, 소원, 그리운 이에게 메시지.
- 도메인(예정): **theblanketexpress.com** (The Orient Express처럼 열차 이름 앞 The) — 대표님이 구매 후 Render에 연결, `PUBLIC_URL`을 새 주소로.
  (blanketexpress.com은 2006년부터 다른 사람이 쓰고 있어 제외. 글로벌 기준으로 Blanket-In보다 Blanket Express가 뜻·철자 전달이 쉬워 선택)
- 배포: 브랜치 `claude/stoic-clarke-s22qwm` → Render 자동 배포 (https://bangguseok-haedoti.onrender.com)
- 구조: `server.js`(웹소켓·API), `shop.js`(상점·로그인·결제), `public/js/scene.js`(장면), `sealife.js`(바다 이벤트),
  `train.js`(출발·귀가 막간), `characters.js`(사람·반려동물), `ambience.js`(소리), `camera.js`(카메라 공통 규칙).

## 대표님 선호
- 답변은 한국어로, 쉽고 편하게. 보고서는 docx.
- Python 코드를 고칠 때는 기존 구조를 유지.
- 누구에게도 해가 되면 안 되고, 위험이 있으면 하지 않음. SNS 게시는 승인 후에만. 키는 채팅이 아니라 Render 환경 변수로.

## 확인
- `npm test` 통과, 휴대폰(390×844)·PC 크기로 화면 확인, 밝은·어두운 화면 모두 확인.
