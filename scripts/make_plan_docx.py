"""방구석 해돋이호 기획안(docx) 생성 스크립트

실행: python3 scripts/make_plan_docx.py
결과: docs/방구석해돋이호_기획안.docx
필요: pip install python-docx
"""

from pathlib import Path

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / "docs" / "images"
OUT = ROOT / "docs" / "방구석해돋이호_기획안.docx"

FONT = "맑은 고딕"
INK = RGBColor(0x3B, 0x2A, 0x20)
ACCENT = RGBColor(0xC8, 0x45, 0x3E)
MUTED = RGBColor(0x8A, 0x73, 0x63)


def set_font(run, size=None, bold=None, color=None):
    run.font.name = FONT
    run._element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
    if size:
        run.font.size = Pt(size)
    if bold is not None:
        run.bold = bold
    if color:
        run.font.color.rgb = color


def shade(cell, hex_color):
    tc_pr = cell._element.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_color)
    tc_pr.append(shd)


def para(doc, text, size=10.5, bold=False, color=INK, align=None, space_after=6):
    p = doc.add_paragraph()
    if align:
        p.alignment = align
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = 1.35
    r = p.add_run(text)
    set_font(r, size, bold, color)
    return p


def heading(doc, text, level=1):
    h = doc.add_heading(level=level)
    r = h.add_run(text)
    set_font(r, {1: 16, 2: 13, 3: 11.5}[level], True, ACCENT if level == 1 else INK)
    h.paragraph_format.space_before = Pt(14 if level == 1 else 10)
    h.paragraph_format.space_after = Pt(6)
    return h


def bullets(doc, items):
    for it in items:
        p = doc.add_paragraph(style="List Bullet")
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.line_spacing = 1.3
        if isinstance(it, tuple):
            r = p.add_run(it[0])
            set_font(r, 10.5, True)
            r = p.add_run(" " + it[1])
            set_font(r, 10.5)
        else:
            r = p.add_run(it)
            set_font(r, 10.5)


def table(doc, header, rows, widths=None, head_fill="F3D9C9"):
    t = doc.add_table(rows=1, cols=len(header))
    t.style = "Table Grid"
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, h in enumerate(header):
        c = t.rows[0].cells[i]
        c.text = ""
        r = c.paragraphs[0].add_run(h)
        set_font(r, 10, True)
        shade(c, head_fill)
    for row in rows:
        cells = t.add_row().cells
        for i, v in enumerate(row):
            cells[i].text = ""
            r = cells[i].paragraphs[0].add_run(str(v))
            set_font(r, 9.5)
    if widths:
        t.autofit = False
        for i, w in enumerate(widths):
            t.columns[i].width = Cm(w)
        for row in t.rows:
            for i, w in enumerate(widths):
                row.cells[i].width = Cm(w)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return t


def images_row(doc, files, captions, width_cm=5.2):
    files = [f for f in files if (IMG / f).exists()]
    if not files:
        return
    t = doc.add_table(rows=2, cols=len(files))
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, f in enumerate(files):
        p = t.rows[0].cells[i].paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.add_run().add_picture(str(IMG / f), width=Cm(width_cm))
        cp = t.rows[1].cells[i].paragraphs[0]
        cp.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = cp.add_run(captions[i])
        set_font(r, 9, color=MUTED)
    doc.add_paragraph()


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

    # ---------- 표지 ----------
    para(doc, "온라인 서비스 기획안", 11, color=MUTED, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=2)
    para(doc, "방구석 해돋이호", 30, True, ACCENT, WD_ALIGN_PARAGRAPH.CENTER, 2)
    para(doc, "이불 밖은 추우니까, 방에서 같이 보는 해돋이", 13, color=INK, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=4)
    para(doc, "정동진 해돋이 · 정서진 해넘이 · 실제 시각 동기화 · 함께 보기", 10, color=MUTED, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=14)
    images_row(doc, ["01_home.png", "03_sunrise.png", "04_card.png"], ["매표소(첫 화면)", "새해 첫 해돋이 순간", "인증 카드"], 4.8)
    table(
        doc,
        ["항목", "내용"],
        [
            ["작성일", "2026년 11월 20일"],
            ["목표 일정", "12월 중순 공개 → 12월 31일 마지막 해넘이 · 2027년 1월 1일 새해 첫 해돋이"],
            ["형태", "웹사이트 (설치·회원가입 없음, 링크 하나로 입장)"],
            ["개발 현황", "1차 버전 개발 완료 (실제 동작 확인), 배포만 남음"],
            ["연계 사업", "lifestory · 퍼스널멘토 · 맛깔참죽 · 진케이에듀"],
        ],
        [3.5, 13],
    )
    doc.add_page_break()

    # ---------- 1. 개요 ----------
    heading(doc, "1. 한 줄 요약")
    para(
        doc,
        "담요를 두른 사람들의 뒷모습 일러스트로 '방구석 해돋이호' 열차표를 끊고, 실제 해 뜨는 시각에 맞춰 전국 사람들과 함께 "
        "정동진 해돋이(아침)와 정서진 해넘이(저녁)를 보는 온라인 여행 서비스입니다.",
    )
    heading(doc, "기획 배경", 2)
    bullets(
        doc,
        [
            ("벤치마킹 대상:", "2026년 10월 29일 취업준비생이 AI 바이브 코딩으로 만든 온라인 절 '산사'. 공개 사흘 만에 60만 명, 나흘 만에 100만 명 방문, '법당 웨이팅'이 화제가 됨."),
            ("공감 포인트:", "해돋이 명소는 새벽·추위·교통체증·인파 때문에 '가고 싶지만 갈 시간도 기운도 없는' 대표적인 곳. 산사의 제작 동기와 같은 결핍."),
            ("타이밍:", "연말연시(12/31 마지막 해넘이, 1/1 새해 첫 해돋이)라는 확실한 날짜 이벤트가 있음. 산사에도 없던 강점."),
            ("차별화:", "이미 따라 나온 '가상 ○○ 공간'(성당, 사우나, 캠핑장 등)과 달리 '보는 곳'이 아니라 '떠나는 여행'(열차표·좌석·매진) 콘셉트."),
        ],
    )

    # ---------- 2. 벤치마킹 ----------
    heading(doc, "2. 벤치마킹: 산사의 히트 요소 대입")
    table(
        doc,
        ["산사의 히트 요소", "산사", "해돋이(기본안)", "방구석 해돋이호(보완안)"],
        [
            ["① 의외성·밈", "절을 온라인으로?", "약함 (생중계 익숙)", "방구석에서 기차표 예매·매진"],
            ["② 공감되는 결핍", "갈 시간·기운 없음", "새벽·추위·인파", "그대로 활용 + '이불 밖은 추우니까'"],
            ["③ 진입 장벽 제로", "링크 하나", "가능", "가입·설치 없음, 링크 하나"],
            ["④ 감성 캐릭터", "동자승", "없음", "담요·후드·목도리·비니·코트 차림 5종 × 옷 색 8가지 (어른 감성 일러스트)"],
            ["⑤ 작은 의식 행동", "절, 염주", "보기만 함", "와! 함성, 소원 풍등, 종이배"],
            ["⑥ 말없이 함께", "같은 법당", "약함", "같은 해변, 함께 보는 중 N명, 채팅 없음"],
            ["⑦ 희소성·웨이팅", "방석 부족", "없음", "좌석 제한 + 대기 순번"],
            ["⑧ 만든 사람 이야기", "취준생 바이브 코딩", "-", "사업하는 대표가 AI로 직접 제작"],
            ["⑨ 타이밍", "직장인 번아웃", "연말연시", "12/31 → 1/1 이어지는 이야기"],
        ],
        [3.4, 3.2, 3.4, 6.5],
    )
    para(doc, "결론: 기본안(해돋이 보기)은 9개 중 3개만 충족하지만, 보완안은 9개 중 8개 이상을 충족합니다.", 10.5, True)

    # ---------- 3. 서비스 구성 ----------
    heading(doc, "3. 서비스 구성")
    heading(doc, "사용자 흐름", 2)
    table(
        doc,
        ["단계", "화면", "하는 일"],
        [
            ["1", "매표소", "다음 열차(정동진/정서진)와 남은 시간 확인 → 이름·캐릭터·담요 색 선택"],
            ["2", "승차권", "실제 좌석 번호가 적힌 승차권 이미지 발급 → 저장·공유 (인스타 4:5)"],
            ["3", "열차 출발", "'정동진행 해돋이호가 출발합니다' 연출"],
            ["4", "해변(데크)", "실시간 하늘 아래 다른 승객과 함께 앉아 해를 기다림 (자리 없으면 대기)"],
            ["5", "그 순간", "해가 수평선을 넘으면 축하 연출 + 알림, 와!·풍등·종이배"],
            ["6", "인증 카드", "지금 하늘 + '함께 봤어요' + 함께 본 사람 수 + 내 소원 → 저장·공유"],
        ],
        [1.2, 3, 12.3],
    )
    images_row(doc, ["02_ticket.png", "03_sunrise.png", "05_sunset.png"], ["승차권", "정동진 해돋이", "정서진 해넘이 + 종이배"], 4.8)

    heading(doc, "핵심 기능", 2)
    bullets(
        doc,
        [
            ("실시간 하늘:", "천문 공식(NOAA)으로 해의 고도·방위각을 계산해 하늘색·해 위치·물빛이 실제 시각대로 변함. 외부 API 불필요, 서버 부담 없음."),
            ("자동 안내:", "아침에는 정동진 해돋이, 저녁에는 정서진 해넘이. 12/31 정서진은 '마지막 해넘이', 1/1 정동진은 '새해 첫 해돋이'로 자동 표시."),
            ("좌석·대기열:", "장소마다 좌석 수(기본 500석) 제한. 넘으면 대기 순번을 주고 자리가 나면 자동 착석."),
            ("함께 보기:", "같은 해변의 다른 승객, 실시간 인원, 이벤트별 누적 함성 수, '함께 본 사람' 수."),
            ("개인정보 최소화:", "회원가입 없음. 이름은 내 승차권에만, 소원 글은 서버로 보내지 않음. 채팅 없음 → 관리 부담 없음."),
            ("미리보기:", "해돋이·해넘이 시간이 아닐 때 그 장면을 60초로 빠르게 체험."),
        ],
    )

    # ---------- 4. 일정 ----------
    heading(doc, "4. 출시 일정 (목표: 2027년 1월 1일)")
    table(
        doc,
        ["시기", "할 일", "목적"],
        [
            ["11월 4주", "1차 버전 완성(완료), 서버 배포(Render), 도메인 연결", "기본 완성"],
            ["12월 1주", "지인 50명 시험 탑승, 휴대폰 기종별 점검", "오류 확인"],
            ["12월 2주", "'매일 운행' 공개 (출근 해돋이·퇴근 해넘이), 스레드·인스타 첫 게시", "입소문 시작"],
            ["12월 3주", "'12/31 막차 · 1/1 첫차' 예고, 승차권 공유 이벤트", "화제 만들기"],
            ["12월 24일", "크리스마스 특별 운행", "중간 이벤트"],
            ["12월 31일 17:24", "정서진 마지막 해넘이 + 종이배", "본 이벤트 1"],
            ["1월 1일 07:38", "정동진 새해 첫 해돋이 + 와! 함성", "본 이벤트 2"],
            ["1월 이후", "매일 운행 유지, 설날·벚꽃 시즌 특별 운행, 사업 연계", "계속 운영"],
        ],
        [3.2, 9.5, 3.8],
    )

    # ---------- 5. 홍보 ----------
    heading(doc, "5. 홍보 전략")
    bullets(
        doc,
        [
            ("스레드·인스타그램:", "산사도 스레드와 인스타그램 게시물 하나로 시작. 제작기('대표가 AI로 만든 방구석 해돋이 열차')와 승차권 이미지를 함께 게시."),
            ("공유 장치 내장:", "승차권과 인증 카드가 인스타 피드 비율(4:5) 이미지로 바로 저장·공유됨. 사용자가 곧 홍보 채널."),
            ("매진 연출:", "1월 1일 새벽 좌석이 차면 '온라인 기차표도 매진' 대기 화면이 자연스러운 화제가 됨."),
            ("언론 보도 포인트:", "'산사 이후 이번엔 해돋이' + 실제 시각 동기화 + 12/31→1/1 이어지는 이야기."),
        ],
    )

    # ---------- 6. 목표 ----------
    heading(doc, "6. 목표 지표")
    table(
        doc,
        ["지표", "목표", "확인 방법"],
        [
            ["12월 누적 방문자", "5만 명", "웹 분석 도구 연결 (추가 예정)"],
            ["1월 1일 동시 접속", "3만 명", "서버 /api/status"],
            ["승차권·인증 카드 공유", "5천 건", "인스타·스레드 해시태그"],
            ["1월 1일 누적 함성", "10만 회", "서버 집계"],
        ],
        [5, 3.5, 8],
    )

    # ---------- 7. 사업 연계 ----------
    heading(doc, "7. 사업 연계")
    table(
        doc,
        ["사업", "연계 방안"],
        [
            ["lifestory", "매일 남긴 다짐·회고를 모아 '나의 1년' 기록장 → 부모님 인생 이야기 자서전 서비스로 연결"],
            ["퍼스널멘토", "정서진 해넘이 회고 → 새해 목표 세우기 코칭 상담 연결"],
            ["맛깔참죽", "해돋이 본 아침 '따뜻한 새해 죽 한 그릇' 쿠폰 (인증 카드에 쿠폰 문구 추가 가능)"],
            ["진케이에듀", "수험생 응원 특별 운행 (수능·모의고사 다음 날), 합격 소원 풍등"],
        ],
        [3.5, 13],
    )
    para(doc, "※ 연계 버튼과 쿠폰은 화제가 붙은 뒤 2차로 넣는 것을 권합니다. 처음부터 광고가 보이면 '쉬러 온 곳' 분위기가 깨질 수 있습니다.", 9.5, color=MUTED)

    # ---------- 8. 위험 ----------
    heading(doc, "8. 위험 요소와 대응")
    table(
        doc,
        ["위험", "대응"],
        [
            ["1월 1일 새벽 접속 폭주 (산사도 서버 과부하)", "좌석 제한 + 대기열 기본 탑재. 이벤트 2주 전 유료 서버로 올리고 부하 시험. 대기 화면 자체를 연출로 활용"],
            ["새해 이후 관심 하락", "매일 출근 해돋이·퇴근 해넘이 습관 서비스로 전환, 설날·벚꽃·여름 휴가 시즌 운행"],
            ["유튜브 해돋이 생중계와 비교", "영상이 아닌 '캐릭터로 함께 모이는 경험'과 승차권·인증 카드를 강조"],
            ["상표·지명 문제", "지명만 사용. 지자체 로고·축제명·실제 철도회사 상표 미사용, 가상 열차 '방구석 해돋이호'"],
            ["부적절한 글", "채팅 없음, 소원 글은 서버로 보내지 않음 → 관리할 글 자체가 없음"],
            ["실제 시각과 차이", "천문 계산 기준, 지형에 따라 1~2분 차이 가능함을 안내"],
        ],
        [5.5, 11],
    )

    # ---------- 9. 비용 ----------
    heading(doc, "9. 운영 비용 (예상)")
    table(
        doc,
        ["항목", "평소", "이벤트 기간(12월 말~1월 초)"],
        [
            ["서버 (Render)", "무료 요금제 가능", "유료 요금제 권장 (월 수만 원 수준, 접속 규모에 따라 조정)"],
            ["도메인", "연 1~3만 원 (선택)", "-"],
            ["화면 호스팅", "무료 (서버에 포함 또는 GitHub Pages)", "-"],
            ["외부 API", "없음 (일출·일몰 직접 계산)", "-"],
        ],
        [3.5, 5.5, 7.5],
    )
    para(doc, "※ 요금은 서비스 회사 정책에 따라 바뀔 수 있으니 배포 시점에 확인이 필요합니다.", 9.5, color=MUTED)

    # ---------- 10. 개발 현황 ----------
    heading(doc, "10. 개발 현황과 다음 단계")
    heading(doc, "완료 (1차 버전)", 2)
    bullets(
        doc,
        [
            "실시간 하늘·해 위치 계산 엔진 (자동 테스트 통과: 2027-01-01 정동진 일출 07:38, 2026-12-31 정서진 일몰 17:24)",
            "매표소·승차권·열차 출발·해변·대기열·인증 카드 전체 화면",
            "함께 보기 서버 (좌석, 대기열, 함성 집계, 함께 본 사람 수, 효과 실시간 전달)",
            "서버 없이도 동작하는 '혼자 보기' 모드, 시각 지정 시험 기능(?t=)",
            "Render 배포 설정, 사용 설명서(README)",
        ],
    )
    heading(doc, "다음 단계", 2)
    bullets(
        doc,
        [
            "Render 배포 및 도메인 연결 (대표님 계정 필요)",
            "인스타그램·스레드 계정 준비, 제작기 게시물 작성",
            "방문자 분석 도구 연결, 부하 시험 (동시 접속 수천~수만 명)",
            "카카오톡 공유 미리보기 이미지(OG 이미지) 제작",
            "2차 기능: 날씨 반영, 크리스마스·설날 특별 장면, 사업 연계 버튼",
        ],
    )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(OUT)
    print(f"저장: {OUT}")


if __name__ == "__main__":
    build()
