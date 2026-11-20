"""방구석 해돋이호 홍보 계획(docx) 생성 스크립트

실행: python3 scripts/make_promo_docx.py
결과: docs/방구석해돋이호_홍보계획.docx
"""

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

from make_plan_docx import ACCENT, FONT, IMG, INK, MUTED, ROOT, bullets, heading, images_row, para, set_font, shade, table

OUT = ROOT / "docs" / "방구석해돋이호_홍보계획.docx"
URL = "bangguseok-haedoti.onrender.com"
BOX = "FFF6E8"


def is_emoji(ch):
    o = ord(ch)
    return o >= 0x1F000 or 0x2600 <= o <= 0x27BF or o in (0xFE0F, 0x200D, 0x2B50)


def add_mixed(par, line):
    """한글과 이모지를 서로 다른 글꼴의 조각으로 나눠 넣습니다 (한글 깨짐 방지)."""
    buf, emo = "", None
    for ch in line + "\0":
        e = is_emoji(ch) if ch != "\0" else None
        if ch == "\0" or (emo is not None and e != emo):
            if buf:
                r = par.add_run(buf)
                if emo:
                    r.font.name = "Segoe UI Emoji"
                    r._element.get_or_add_rPr().get_or_add_rFonts().set(qn("w:eastAsia"), "Segoe UI Emoji")
                    r.font.size = Pt(10)
                else:
                    set_font(r, 10)
            buf = ""
        if ch != "\0":
            buf += ch
            emo = e


def copy_box(doc, title, text):
    """복사해서 바로 쓰는 문구 상자"""
    t = doc.add_table(rows=1, cols=1)
    t.style = "Table Grid"
    cell = t.rows[0].cells[0]
    shade(cell, BOX)
    cell.text = ""
    p = cell.paragraphs[0]
    r = p.add_run(title)
    set_font(r, 9.5, True, ACCENT)
    for line in text.strip("\n").split("\n"):
        q = cell.add_paragraph()
        q.paragraph_format.space_after = Pt(0)
        q.paragraph_format.line_spacing = 1.3
        add_mixed(q, line)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)


def build():
    doc = Document()
    sec = doc.sections[0]
    sec.page_width, sec.page_height = Cm(21), Cm(29.7)
    sec.left_margin = sec.right_margin = Cm(2.2)
    sec.top_margin = sec.bottom_margin = Cm(2)
    style = doc.styles["Normal"]
    style.font.name = FONT
    style.element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
    style.font.size = Pt(10.5)

    para(doc, "홍보 계획서", 11, color=MUTED, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=2)
    para(doc, "방구석 해돋이호 홍보 계획", 24, True, ACCENT, WD_ALIGN_PARAGRAPH.CENTER, 2)
    para(doc, f"서비스 주소: {URL}  ·  작성일: 2026년 11월 20일", 10, color=MUTED, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=10)

    # 1. 원칙
    heading(doc, "1. 기본 방향")
    para(doc, "산사는 광고비 없이 '스레드 게시물 하나 → 입소문 → 언론 보도' 순서로 퍼졌습니다. 같은 경로를 따르되, "
              "12월 31일·1월 1일이라는 확실한 날짜를 향해 단계적으로 기대감을 쌓습니다.")
    bullets(doc, [
        ("홍보처럼 보이지 않게:", "첫 게시물은 '만든 이야기'로. 사업 홍보는 화제가 붙은 뒤 2차로."),
        ("사용자가 퍼뜨리게:", "승차권·인증 카드(인스타 4:5 이미지), 1월 1일 '만석·대기' 화면이 자연스러운 공유 거리."),
        ("작게 먼저 시험:", "12월 초 지인·소규모 공개로 반응을 보고 문구와 기능을 다듬은 뒤 본격 공개."),
    ])

    heading(doc, "지켜야 할 것 (누구에게도 해가 되지 않게)", 2)
    bullets(doc, [
        "가짜 계정·가짜 후기·댓글 조작을 하지 않습니다.",
        "시연 영상의 가상 승객은 '시연 화면'으로 표시합니다. 실제 접속자 수를 부풀려 말하지 않습니다.",
        "커뮤니티마다 홍보 규칙을 먼저 확인하고, 금지된 곳에는 올리지 않습니다. 같은 글을 여러 곳에 반복해서 올리지 않습니다.",
        "영상 배경음악은 인스타그램·유튜브 앱 안에서 제공하는 음악을 사용합니다(저작권 문제 예방).",
        "기자에게는 사실만 전달하고, 실제 수치는 서버 집계(/api/status)로 확인한 값만 씁니다.",
        "지자체 로고·축제 이름·실제 철도회사 상표를 쓰지 않습니다.",
    ])

    # 2. 일정
    heading(doc, "2. 일정")
    table(doc, ["시기", "할 일", "확인할 것"], [
        ["11월 4주", "인스타·스레드 계정 개설, 프로필 링크에 서비스 주소, 지인 20~50명 시험 탑승", "오류, 휴대폰 기종별 화면"],
        ["12월 1주", "첫 게시물(제작기) + 릴스 영상, 대표님 사업 채널에 가볍게 소개", "조회수·공유 수, 접속자 수"],
        ["12월 2주", "반응 좋은 문구로 2차 게시, 커뮤니티 1~2곳 자연스럽게 공유", "어떤 문구에 반응이 큰지"],
        ["12월 3주", "'12/31 막차 · 1/1 첫차' 예고, 승차권 인증 이벤트 / 서버 Starter로 상향", "예고 게시물 저장·공유 수"],
        ["12/24~25", "크리스마스 특별 운행 게시물", "재방문"],
        ["12/28경", "서버 Standard 상향, SEATS 5000 설정, 실제 서버 부하 시험", "동시 접속 한계"],
        ["12/31 오후", "보도자료 발송, '오늘 17:24 마지막 해넘이' 게시", "기자 반응"],
        ["1/1 07:00~", "실시간 '지금 ○○명 함께 기다리는 중' 캡처 게시", "실제 수치만 사용"],
        ["1월 이후", "출근 해돋이·퇴근 해넘이 습관 서비스로 운영, 설날 특별 운행, 사업 연계", "재방문율"],
    ], [2.8, 9, 4.7])

    # 3. 영상
    heading(doc, "3. 홍보 영상 (릴스·쇼츠)")
    para(doc, "promo/haedoti_reels_1080x1920.mp4 · 세로형 1080×1920 · 32초 · 무음(앱에서 음악 추가)")
    bullets(doc, [
        "구성: 매표소 → 승차권 → 열차 출발 → '새벽에 못 일어나도, 춥고 멀어도' → '방에서 다 같이 새해 첫 해를 봐요' → 해 뜨는 순간 와! 함성·반짝임 → 소원 풍등이 하늘로 → 서비스 주소",
        "가상 승객이 들어간 시연 영상이라 화면에 '시연 화면 · 가상 승객 포함' 표시가 있습니다.",
        "1월 1일 이후에는 실제 접속 화면을 녹화한 영상으로 바꾸는 것을 권합니다.",
    ])
    images_row(doc, ["03_sunrise.png", "02_ticket.png", "04_card.png"], ["해돋이 순간", "승차권", "인증 카드"], 4.6)

    # 4. 게시물 문구
    heading(doc, "4. 바로 쓰는 게시물 문구")
    copy_box(doc, "① 스레드 첫 게시물 (제작기)", f"""
매년 해돋이 보러 가고 싶은데
새벽에 일어나서, 춥고, 차 막히고, 사람 많아서 결국 못 갔어요.

그래서 AI랑 같이 만들었어요.
방구석 해돋이호 🚂

잠옷 입고 열차표 끊고 탑승하면
실제 해 뜨는 시각에 맞춰 정동진 해돋이를,
저녁엔 정서진 해넘이를 같이 봐요.

가입 없고, 채팅 없고, 그냥 말없이 같이 해를 기다리는 곳.
12월 31일 마지막 해넘이, 1월 1일 첫 해돋이도 여기서 같이 봐요 🌅

🔗 {URL}
""")
    copy_box(doc, "② 인스타그램 릴스 설명", f"""
이불 밖은 추우니까, 방에서 같이 보는 해돋이 🌅

🎫 떡 친구(백설기·인절미·쑥떡·꿀떡·흑임자) 고르고 승차권 받기
🚂 정동진행 해돋이호 탑승
☀️ 실제 일출 시각에 맞춰 다 같이 해맞이
🏮 소원 풍등 날리기

아침엔 정동진, 저녁엔 정서진.
1월 1일 새해 첫 해돋이도 여기서 같이 봐요!

프로필 링크 👉 방구석 해돋이호
#해돋이 #새해 #정동진 #정서진 #해넘이 #새해소원 #방구석여행 #온라인해돋이
""")
    copy_box(doc, "③ 12월 3주 예고 게시물", """
🚂 방구석 해돋이호 특별 운행 안내

12월 31일(목) 17:24 정서진 · 2026년 마지막 해넘이
→ 올해 털어버릴 것을 종이배에 적어 바다로 보내요

1월 1일(금) 07:38 정동진 · 2027년 새해 첫 해돋이
→ 해 뜨는 순간 다 같이 "와!" 하고 소원 풍등 날려요

좌석이 다 차면 순서대로 대기해요. 잠옷 입고 미리 탑승하세요 🛌
""")
    copy_box(doc, "④ 진케이에듀 (수험생·학부모)", f"""
시험 준비하느라 해돋이 보러 갈 시간 없죠?
방에서 5분만, 새해 첫 해 보면서 합격 소원 풍등 날려요 🏮
🔗 {URL}
""")
    copy_box(doc, "⑤ 퍼스널멘토 (직장인·자기계발)", f"""
올해 털어버리고 싶은 것, 정서진 해넘이에 종이배로 띄워 보내세요 ⛵
그리고 새해 첫 해돋이에 다짐 한 줄. 새해 목표 상담도 함께 준비했어요.
🔗 {URL}
""")
    copy_box(doc, "⑥ 맛깔참죽 (고객)", f"""
새해 첫 해, 방에서 따뜻하게 보고
아침은 따뜻한 죽 한 그릇으로 시작해요 🍲
🔗 {URL}
""")
    copy_box(doc, "⑦ 커뮤니티용 (짧고 가볍게, 규칙 확인 후 1~2곳만)", f"""
제목: 해 뜨는 거 방에서 같이 볼 사람?
새벽에 못 일어나는 사람용으로 만들어 봤어요. 실제 일출 시각 맞춰서 해 뜨고, 다른 사람들 캐릭터도 같이 앉아 있어요. 가입 없음.
{URL}
""")

    # 5. 보도자료
    heading(doc, "5. 보도자료 초안 (12월 31일 오후 발송)")
    copy_box(doc, "보도자료", """
[제목] "이불 밖은 추우니까" 방구석에서 함께 보는 새해 첫 해돋이… 온라인 '방구석 해돋이호' 등장

[부제] 실제 일출·일몰 시각에 맞춰 정동진 해돋이·정서진 해넘이를 전국 이용자가 함께 보는 웹 서비스

온라인 절 '산사'에 이어, 이번에는 방에서 새해 첫 해돋이를 함께 보는 웹 서비스가 나왔다.

'방구석 해돋이호'는 이용자가 한국 떡을 닮은 말랑한 캐릭터('떡 친구들': 백설기·인절미·쑥떡·꿀떡·흑임자)를 골라 온라인 열차표를 받고 탑승하면, 실제 해 뜨는 시각에 맞춰 정동진 해돋이와 정서진 해넘이를 다른 이용자들과 함께 볼 수 있는 서비스다. 하늘과 해는 천문 계산으로 실제 시각에 맞춰 움직이고, 해가 수평선을 넘는 순간 이용자들이 함께 "와!" 함성을 보내거나 소원 풍등을 날릴 수 있다.

회원가입과 설치 없이 링크 하나로 접속할 수 있으며, 채팅 기능은 없다. 적은 소원은 서버에 저장되지 않고 이용자 기기에만 남는다. 좌석이 차면 대기 순번을 받는다.

서비스를 만든 [대표 이름] 대표는 [운영 사업 소개]를 운영하며, AI 코딩 도구를 활용해 직접 제작했다. [대표 한마디: 예) "매년 해돋이를 보러 가고 싶었지만 새벽·추위·인파 때문에 쉽지 않았다. 방에서라도 많은 분과 함께 새해를 맞고 싶었다"]

12월 31일 오후 5시 24분 정서진 '마지막 해넘이', 1월 1일 오전 7시 38분 정동진 '새해 첫 해돋이'가 특별 운행된다.

서비스 주소: bangguseok-haedoti.onrender.com
문의: [연락처]
""")
    para(doc, "※ [ ] 부분은 대표님이 직접 채워 주세요. 이용자 수 등 수치는 발송 직전에 실제 집계로 확인해 넣습니다.", 9.5, color=MUTED)

    # 6. 지표
    heading(doc, "6. 확인할 지표")
    table(doc, ["지표", "확인 방법", "목표"], [
        ["게시물 조회·공유·저장", "인스타·스레드 통계", "첫 게시물 공유 100회"],
        ["동시 접속", f"{URL}/api/status", "1월 1일 3만 명"],
        ["누적 함성", "/api/status의 cheers", "1월 1일 10만 회"],
        ["함께 본 사람", "/api/status의 witnesses", "1월 1일 1만 명"],
        ["태그·인증 카드 공유", "해시태그 검색", "5천 건"],
    ], [5, 6, 5.5])

    # 7. 체크리스트
    heading(doc, "7. 대표님 할 일 체크리스트")
    bullets(doc, [
        "☐ 인스타그램·스레드 계정 만들기 (이름 예: @bangguseok.haedoti)",
        "☐ 프로필에 서비스 주소 넣기",
        "☐ 지인 20~50명에게 시험 탑승 부탁하고 의견 받기",
        "☐ 릴스 영상 올리기 (앱에서 음악 추가)",
        "☐ (선택) 기억하기 쉬운 도메인 구입 → 연결은 제가 도와드립니다",
        "☐ 12월 3주 Render Starter, 12/28경 Standard로 상향 + SEATS 5000",
        "☐ 보도자료 [ ] 채우기, 보낼 기자 목록 정리",
    ])

    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(OUT)
    print(f"저장: {OUT}")


if __name__ == "__main__":
    build()
