"""별자리 데이터 만들기 (d3-celestial 데이터 → public/js/skydata.js)

사용법:
  npm pack d3-celestial && tar xzf d3-celestial-*.tgz
  python3 scripts/build_sky.py package/data

원본 데이터: d3-celestial (https://github.com/ofrohn/d3-celestial)
Copyright (c) 2015, Olaf Frohn. BSD-3-Clause 라이선스.
"""
import json
import sys
from pathlib import Path

src = Path(sys.argv[1])
out = Path(__file__).resolve().parent.parent / "public" / "js" / "skydata.js"
MAG_LIMIT = 4.8

def ra(lon):
    return round(lon % 360, 2)

stars = []
for f in json.load(open(src / "stars.6.json"))["features"]:
    mag = f["properties"]["mag"]
    if mag is None or mag > MAG_LIMIT:
        continue
    lon, lat = f["geometry"]["coordinates"]
    try:
        bv = round(float(f["properties"].get("bv") or 0.6), 1)
    except ValueError:
        bv = 0.6
    stars.append([ra(lon), round(lat, 2), round(mag, 1), bv])
stars.sort(key=lambda s: s[2])

lines = {}
for f in json.load(open(src / "constellations.lines.json"))["features"]:
    lines[f["id"]] = [[[ra(p[0]), round(p[1], 2)] for p in seg] for seg in f["geometry"]["coordinates"]]

names = {}
for f in json.load(open(src / "constellations.json"))["features"]:
    p = f["properties"]
    lon, lat = f["geometry"]["coordinates"]
    if p.get("rank") in ("1", 1, "2", 2):
        names[f["id"]] = [p.get("ko") or p.get("name"), ra(lon), round(lat, 2)]

js = (
    "// 별과 별자리 데이터 (scripts/build_sky.py로 생성)\n"
    "// 원본: d3-celestial, Copyright (c) 2015, Olaf Frohn. BSD-3-Clause 라이선스\n"
    "// https://github.com/ofrohn/d3-celestial/blob/master/LICENSE\n"
    "// STARS: [적경(도), 적위(도), 등급, 색지수]\n"
    f"export const STARS = {json.dumps(stars, separators=(',', ':'))};\n"
    "// LINES: 별자리 선 { 약어: [[[적경, 적위], ...], ...] }\n"
    f"export const LINES = {json.dumps(lines, separators=(',', ':'), ensure_ascii=False)};\n"
    "// NAMES: { 약어: [한국어 이름, 적경, 적위] }\n"
    f"export const NAMES = {json.dumps(names, separators=(',', ':'), ensure_ascii=False)};\n"
)
out.write_text(js, encoding="utf-8")
print(f"저장: {out} (별 {len(stars)}개, 별자리 {len(lines)}개, 이름 {len(names)}개, {len(js)//1024}KB)")
