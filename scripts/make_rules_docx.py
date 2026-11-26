"""이불 밖은 추우니까 · 제작 규칙 (모든 스테이지 공통) docx

docs/스테이지_공통규칙.md 를 그대로 Word 문서로 만듭니다. 규칙 문서를 고친 뒤 다시 실행하세요.
실행: python3 scripts/make_rules_docx.py
결과: docs/이불밖은추우니까_제작규칙.docx
"""

import re
from pathlib import Path

from docx import Document
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "docs" / "스테이지_공통규칙.md"
OUT = ROOT / "docs" / "이불밖은추우니까_제작규칙.docx"
FONT = "맑은 고딕"
INK = RGBColor(0x3B, 0x2A, 0x20)
ACCENT = RGBColor(0xC8, 0x45, 0x3E)


def runs(p, text, size=10.5, bold=False, color=None):
    # **굵게** 와 `코드` 를 구분해서 넣기
    for part in re.split(r"(\*\*[^*]+\*\*|`[^`]+`)", text):
        if not part:
            continue
        b = bold
        t = part
        if part.startswith("**") and part.endswith("**"):
            b, t = True, part[2:-2]
        elif part.startswith("`") and part.endswith("`"):
            t = part[1:-1]
        r = p.add_run(t)
        r.font.name = FONT
        r._element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
        r.font.size = Pt(size)
        r.bold = b
        r.font.color.rgb = color or INK


def main():
    doc = Document()
    lines = SRC.read_text(encoding="utf-8").splitlines()
    last = None
    for raw in lines:
        line = raw.rstrip()
        if not line.strip() or line.strip() == "---":
            last = None
            continue
        if line.startswith("# "):
            runs(doc.add_paragraph(), line[2:], 18, True, ACCENT)
        elif line.startswith("## "):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(10)
            runs(p, line[3:], 13, True, ACCENT)
        elif re.match(r"^\s*- ", line):
            indent = len(line) - len(line.lstrip())
            last = doc.add_paragraph(style="List Bullet 2" if indent >= 2 else "List Bullet")
            runs(last, line.strip()[2:])
        elif re.match(r"^\d+\. ", line):
            last = doc.add_paragraph(style="List Number")
            runs(last, re.sub(r"^\d+\. ", "", line))
        elif line.startswith("  ") and last is not None:
            runs(last, " " + line.strip())  # 앞 항목에 이어지는 줄
        elif line.startswith("```"):
            continue
        else:
            last = doc.add_paragraph()
            runs(last, line.strip())
    doc.save(OUT)
    print(OUT)


if __name__ == "__main__":
    main()
