"""이불 밖은 추우니까 · 설계 원칙과 레트로 스테이지 기획 (docx)

실행: python3 scripts/make_stage_docx.py
결과: docs/이불밖은추우니까_스테이지기획.docx
"""

from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "이불밖은추우니까_스테이지기획.docx"
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


def para(doc, text, size=10.5, bold=False, color=None, align=None, space=4):
    p = doc.add_paragraph()
    font(p.add_run(text), size, bold, color)
    p.paragraph_format.space_after = Pt(space)
    if align:
        p.alignment = align
    return p


def h(doc, text, level=1):
    para(doc, text, 15 if level == 1 else 12.5, True, ACCENT if level == 1 else INK, space=6)


def bullets(doc, items):
    for t in items:
        p = doc.add_paragraph(style="List Bullet")
        font(p.add_run(t), 10.5)
        p.paragraph_format.space_after = Pt(2)


def table(doc, head, rows, widths=None):
    t = doc.add_table(rows=1, cols=len(head))
    t.style = "Light Grid Accent 2"
    for i, x in enumerate(head):
        c = t.rows[0].cells[i]
        c.text = ""
        font(c.paragraphs[0].add_run(x), 10, True)
    for r in rows:
        cells = t.add_row().cells
        for i, x in enumerate(r):
            cells[i].text = ""
            font(cells[i].paragraphs[0].add_run(x), 9.5)
    doc.add_paragraph()


doc = Document()
para(doc, "이불 밖은 추우니까", 22, True, ACCENT, WD_ALIGN_PARAGRAPH.CENTER, 2)
para(doc, "설계 원칙과 레트로 스테이지 기획", 14, True, align=WD_ALIGN_PARAGRAPH.CENTER, space=2)
para(doc, "기차 이름: 방구석 해돋이호 · 2026년 11월", 10, color=MUTED, align=WD_ALIGN_PARAGRAPH.CENTER, space=14)

h(doc, "1. 본질 (뼈대): 이것에서 벗어나지 않는다")
para(doc, "사람들은 '외롭다'고 말하지 않는다. '이불 밖은 추우니까'라고 말하며 들어와, 말없이 함께 불을 쬐고 마음을 띄워 보낸다. 모든 스테이지는 아래 세 가지 욕구를 먼저 채운다.")
table(doc, ["기둥", "사람의 욕구", "지금 구현된 것"], [
    ["① 힐링 · 불멍", "아무것도 안 해도 되는 따뜻한 쉼", "실제 시각·날씨에 맞는 하늘과 바다, 모닥불·파도·바람 소리, 윤슬, 은은한 움직임"],
    ["② 소원", "내일이 조금 나아지길 비는 마음", "소원 풍등, 동전 소원(공개 소원은 동전)"],
    ["③ 그리운 이에게", "닿지 못하는 사람에게 한 줄 건네고 싶은 마음", "유리병 편지(나만 보기 / 용기 내어 공개)"],
])
h(doc, "설계 체크리스트 (새 기능·스테이지마다 확인)", 2)
bullets(doc, [
    "불멍처럼 '가만히 있어도 좋은' 장면인가? 깜빡임·튀는 효과로 시선을 빼앗지 않는가?",
    "소원을 비는 의식이 그 장소다운 모습으로 있는가? (풍등, 촛불, 동전, 종 등)",
    "그리운 이에게 보내는 의식이 있는가? (편지, 엽서, 라디오 사연, 음성 사서함 등)",
    "외로움을 직접 말하지 않고 은유로 감싸는가? (추우니까, 같이 보니까)",
    "모르는 사람과의 연결은 정해진 따뜻한 문구로만, 가까이 와서, 둘에게만인가? (자유 1:1 채팅 없음)",
    "재미 요소는 뼈대 '위에' 얹혀 있는가? 재미가 쉼을 방해하지 않는가?",
    "유료 아이템은 쉼·소원·그리움을 더 깊게 해 주는 것인가? (방해를 없애는 장사는 하지 않음)",
])

h(doc, "2. 재미 층: 레트로, 옛날 추억 소환")
para(doc, "주 이용층인 30~40대가 '어, 이거 기억난다' 하고 웃게 만드는 작은 장치를 스테이지마다 하나씩 얹는다. 추억은 따뜻함을 키우는 재료이지, 시끄러운 게임이 아니다.")
bullets(doc, [
    "짧고 혼자서도 되는 놀이: 물수제비, 장작 넣기처럼 손가락 한두 번이면 끝나는 것",
    "소리 추억: 카세트 늘어지는 소리, 라디오 주파수 맞추는 소리, 공중전화 동전 소리 (직접 합성, 저작권 걱정 없음)",
    "물건 추억: 삐삐, 카세트테이프, 연탄, 문방구 불량식품, 롤러스케이트 등은 그림으로 직접 그림 (상표·캐릭터는 쓰지 않음)",
])

h(doc, "3. 스테이지 기획안")
para(doc, "모든 스테이지는 같은 뼈대(시간·날씨 연동 하늘, 모닥불 대신 그 장소의 '불', 소원 의식, 그리운 이 의식, 공통 카메라 규칙)를 쓰고, 풍경과 레트로 장치만 바꾼다.")
table(doc, ["스테이지", "① 불멍 (따뜻한 불)", "② 소원", "③ 그리운 이에게", "레트로 재미"], [
    ["정동진 해돋이 (운영 중)", "모래사장 모닥불", "소원 풍등", "-", "물수제비, 기러기"],
    ["정서진 해넘이 (운영 중)", "나무 데크 화로", "동전 소원", "유리병 편지", "물수제비"],
    ["수련회 캠프파이어의 밤", "운동장 큰 캠프파이어", "촛불 의식(촛불 들고 소원)", "'부모님께 쓰는 편지' 시간", "레크리에이션 노래, 장기자랑 박수"],
    ["90년대 기차역 대합실", "난로 위 주전자 김", "역 종이 소원 (승차권 뒤에)", "공중전화로 음성 사서함 남기기(정해진 문구)", "삐삐 번호 놀이, 역 안내 방송"],
    ["외갓집 시골 마루", "아궁이 불·군고구마", "장독대에 정화수 놓고 빌기", "할머니께 보내는 엽서", "반딧불, 모깃불, 별 보기"],
    ["겨울 골목 포장마차", "연탄불·붕어빵 틀", "붕어빵 속 소원 쪽지", "포장마차 벽 낙서 한 줄", "옛날 과자, 김 서린 창문 그림"],
    ["한밤의 라디오 부스", "스탠드 불빛·전기난로", "신청곡과 함께 소원", "라디오 사연(정해진 문구), DJ가 읽어 주는 연출", "카세트 녹음, 주파수 맞추기 소리"],
    ["광화문 기도 광장 (메모)", "촛불 바다", "기도 풍등", "묵념과 한 줄 기도", "특정 종교·정치 구호 없이"],
])

h(doc, "4. 추천 개발 순서")
table(doc, ["순서", "스테이지", "이유"], [
    ["1", "수련회 캠프파이어의 밤", "지금 해변·모닥불 구조를 가장 많이 다시 쓸 수 있고, '부모님께 쓰는 편지'가 ③ 그리운 이 욕구를 가장 강하게 건드림. 30~40대 공감 최고"],
    ["2", "외갓집 시골 마루", "불멍(아궁이)과 그리움(할머니)이 동시에. 반딧불·별로 힐링"],
    ["3", "90년대 기차역 대합실", "'방구석 해돋이호' 기차 콘셉트와 이어지는 허브(대기실). 다른 스테이지로 가는 매표소 역할"],
    ["4", "겨울 포장마차 / 라디오 부스", "계절·밤 시간대용. 라디오 사연은 음원(수노) 홍보와도 연결"],
])

h(doc, "5. 스테이지 공통 구조 (개발 기준)")
bullets(doc, [
    "장소 표(sun.js PLACES)에 위치·시간대·종류를 넣고, 매표소 행선지(countries.js)에 한 줄 추가",
    "카메라 규칙은 camera.js 공통값을 그대로 (정동진 기준). 필요한 값만 장소에서 덮어씀",
    "풍경(scene.js)만 스테이지별로: 땅, 배경 실루엣, 그 장소의 '불', 장애물(바위처럼 물수제비가 부딪히는 것)",
    "의식 3종(소원·그리운 이·공개 옵션)은 공통 창을 쓰고 문구·그림만 스테이지에 맞게",
    "다국어 사전(lang/)에 새 문장 추가",
])

h(doc, "6. 지켜야 할 것")
bullets(doc, [
    "실제 브랜드·상표·캐릭터(코레일, 특정 과자·게임 캐릭터 등)는 쓰지 않고 직접 그린 것만",
    "외로움·슬픔을 직접 드러내는 문구는 쓰지 않음",
    "모르는 사람끼리의 자유 대화 없음. 가까이 와서, 정해진 문구로, 둘에게만",
    "재미는 30초 안에 끝나고, 다시 가만히 불멍으로 돌아올 수 있게",
])

OUT.parent.mkdir(parents=True, exist_ok=True)
doc.save(OUT)
print(OUT)
