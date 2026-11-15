# -*- coding: utf-8 -*-
"""按真实字体宽度估算每段占几行，判断简历是否还超出一页。

用系统里的微软雅黑按字号测量文本像素宽度，再除以可用行宽，比按字符数估算准得多。
"""
import math
import sys

from PIL import ImageFont
from docx import Document

FONT_CANDIDATES = [
    r"C:\Windows\Fonts\msyh.ttc",
    r"C:\Windows\Fonts\simsun.ttc",
    r"C:\Windows\Fonts\simhei.ttf",
]
USABLE_CM = 17.8
DPI = 96
PAGE_CM = 27.4
HEADER_CM = 4.2          # 顶部姓名 + 照片表格
LINE_FACTOR = (1.32, 1.45)  # 中文行高倍数区间


def load_font(size_px):
    for path in FONT_CANDIDATES:
        try:
            return ImageFont.truetype(path, size_px)
        except Exception:
            continue
    raise RuntimeError("找不到中文字体")


def main(path):
    doc = Document(path)
    usable_px = USABLE_CM / 2.54 * DPI

    total_lines = 0
    per_line_avg = []
    rows = []
    for p in doc.paragraphs:
        text = p.text
        if not text.strip():
            continue
        size_pt = 9.5
        for r in p.runs:
            if r.font.size:
                size_pt = r.font.size.pt
                break
        font = load_font(max(8, round(size_pt * DPI / 72)))
        lines = 1 if "\t" in text else max(1, math.ceil(font.getlength(text) / usable_px))
        total_lines += lines
        per_line_avg.append(size_pt)

        pf = p.paragraph_format
        after = pf.space_after.pt if pf.space_after is not None else 0.0
        before = pf.space_before.pt if pf.space_before is not None else 0.0
        rows.append((lines, size_pt, before + after, text))

    print(f"正文段落行数合计：{total_lines} 行")
    print(f"顶部信息表约折合：{HEADER_CM / 0.49:.1f} 行")
    print("单页可用：27.4 cm\n")

    for factor in LINE_FACTOR:
        body_cm = 0.0
        for lines, size_pt, sp, _ in rows:
            body_cm += lines * size_pt * factor / 72 * 2.54 + sp / 72 * 2.54
        total = body_cm + HEADER_CM
        verdict = "放得下" if total <= PAGE_CM else f"超出 {total - PAGE_CM:.1f}cm"
        print(f"行高按 {factor}× 估算：正文 {body_cm:.1f}cm，合计 {total:.1f}cm / 27.4cm → {verdict}")

    print("\n占行最多的段落：")
    for lines, size_pt, sp, text in sorted(rows, key=lambda r: -r[0])[:6]:
        print(f"  {lines} 行 @{size_pt}pt  {text[:44]}")


if __name__ == "__main__":
    main(sys.argv[1])
