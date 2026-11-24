"""이불 밖은 추우니까 · 리팩토링 5회 (버그·안정성·보안) 결과 보고서 (docx)

실행: python3 scripts/make_refactor_report_docx.py
결과: docs/이불밖은추우니까_리팩토링5회_보고서.docx
"""

from pathlib import Path

from docx import Document
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "이불밖은추우니까_리팩토링5회_보고서.docx"
FONT = "맑은 고딕"
INK = RGBColor(0x3B, 0x2A, 0x20)
ACCENT = RGBColor(0xC8, 0x45, 0x3E)
MUTED = RGBColor(0x8A, 0x73, 0x63)


def font(run, size=None, bold=None, color=None):
    run.font.name = FONT
    run._element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
    if size:
        run.font.size = Pt(size)
    if bold is not None:
        run.bold = bold
    run.font.color.rgb = color or INK


def para(doc, text, size=10.5, bold=False, color=None, space=4):
    p = doc.add_paragraph()
    font(p.add_run(text), size, bold, color)
    p.paragraph_format.space_after = Pt(space)
    return p


def bullets(doc, items):
    for it in items:
        p = doc.add_paragraph(style="List Bullet")
        font(p.add_run(it), 10.5)


def table(doc, rows):
    t = doc.add_table(rows=len(rows), cols=len(rows[0]))
    t.style = "Light Grid Accent 1"
    for i, row in enumerate(rows):
        for j, v in enumerate(row):
            c = t.cell(i, j)
            c.text = ""
            font(c.paragraphs[0].add_run(v), 9.5, i == 0)
    doc.add_paragraph()


ROUNDS = [
    ("1회차 · 보안", [
        "버그: 깨진 주소(예: /%E0%A4%A) 한 번이면 서버가 꺼지던 문제 → 400으로 답하고 계속 운영",
        "보안 헤더: CSP(불러올 수 있는 곳 제한), 다른 사이트에 끼워 넣기 차단, 내용 추측 차단, HSTS, 권한 정책",
        "로그인 메일 링크 주소를 요청 헤더로 바꿔치기 못 하게 (Host만 사용, 형식 검사)",
        "메시지를 폭탄처럼 보내는 연결: 초당 40개 넘는 건 버리고, 3초 넘게 계속되면 연결 끊기",
        "상점 화면의 HTML 끼워넣기 0곳으로 (아이콘도 글자로)",
    ]),
    ("2회차 · 안정성", [
        "메시지·웹 요청 처리 중 오류가 나도 서버 유지 (그 요청만 버림)",
        "예상 못 한 오류: 기록을 먼저 저장하고 깨끗이 재시작 (Render가 자동으로 다시 켬)",
        "저장 파일이 깨져 있으면 덮어쓰지 않고 .broken-시각 파일로 보관 (구매 기록 보호)",
        "오래된 로그인 링크·하루 지난 미결제 주문·30분 지난 한마디 짝 기록 자동 정리 (오래 켜 둬도 메모리가 쌓이지 않게)",
    ]),
    ("3회차 · 성능·코드 정리", [
        "서 있는·걷는 사람에 쓰던 느린 밝기 필터를 색 계산으로 바꿈: 많은 사람이 모인 화면이 1프레임 1,740ms → 약 40ms (평소 2ms)",
        "가만히 앉은 강아지·고양이는 한 번 그린 그림을 다시 씀",
        "안 쓰는 옛 코드(예전 우비 덧그리기, 김, 공유 함수 등) 정리, 코드 검사 경고 0",
    ]),
    ("4회차 · 부하·안정성 시험", [
        "1,500명 동시 접속 × 30초 × 3회 연속 (이상한 메시지 섞어 보내기 포함)",
        "웹소켓 오류 0, 메시지 약 22만 건 처리, 헬스체크 계속 200, 다 나간 뒤 접속자 0, 오류 기록 0",
        "메모리: 123 → 131 → 131MB 에서 멈춤 → 누수 없음",
        "버그: 너무 큰 요청은 답 없이 끊겼음 → 413(너무 큼)으로 정상 응답, 배열 등 이상한 본문은 400",
    ]),
    ("5회차 · 의존성·마무리", [
        "npm audit 취약점 0건, 웹소켓 라이브러리 ws 8.23 (최신), 잠금 파일 유지",
        "아주 느리게 보내며 연결을 붙잡는 공격(slowloris) 대비: 헤더 15초·전체 30초 제한",
        "자동 시험 41개 전부 통과 (보안·폭탄 메시지·이상한 메시지·큰 요청 포함)",
    ]),
]


def main():
    doc = Document()
    para(doc, "이불 밖은 추우니까 · 방구석 해돋이호", 11, False, MUTED, 2)
    para(doc, "리팩토링 5회 결과 보고서 (버그·안정성·보안)", 18, True, ACCENT, 10)
    para(doc, "2026-11-24 · 대상: https://bangguseok-haedoti.onrender.com", 10, False, MUTED, 12)

    para(doc, "한눈에 보기", 13, True, ACCENT)
    table(doc, [
        ["항목", "전", "후"],
        ["깨진 주소 한 번에", "서버 꺼짐", "400 응답, 계속 운영"],
        ["많이 모인 화면 1프레임", "1,740ms (멈춘 듯)", "약 40ms / 평소 2ms"],
        ["1,500명 동시 접속", "시험 안 함", "오류 0, 누수 없음"],
        ["보안 헤더", "없음", "CSP·클릭재킹·HSTS 등 6종"],
        ["깨진 저장 파일", "덮어써서 기록 사라짐", "따로 보관"],
        ["의존성 취약점", "-", "0건"],
        ["자동 시험", "37개", "41개 통과"],
    ])

    for title, items in ROUNDS:
        para(doc, title, 13, True, ACCENT)
        bullets(doc, items)

    para(doc, "남은 일 (운영 전 확인)", 13, True, ACCENT)
    bullets(doc, [
        "실제 판매 전 Render 유료 플랜 + 영구 디스크 (지금은 재배포 때 저장 파일이 초기화될 수 있음)",
        "결제·로그인 키(Resend, PayPal, 카카오·구글·네이버)는 채팅이 아닌 Render 환경 변수로 입력",
        "도메인 연결 후 PUBLIC_URL 환경 변수 지정 (로그인 메일 링크 주소 고정)",
    ])
    doc.save(OUT)
    print(OUT)


if __name__ == "__main__":
    main()
