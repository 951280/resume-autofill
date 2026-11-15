# -*- coding: utf-8 -*-
"""估算 docx 正文高度，用来判断是否超出一页（没有 LibreOffice 时的兜底手段）。

按字号、行距、段前段后间距逐段估算；中文按 1em、西文按 0.55em 计宽。
结果只是估算，最终仍应以实际打开文档为准。
"""
import math
import sys

from docx import Document

USABLE_CM = 17.8      # A4 21cm - 左右各 1.6cm
PT_TO_CM = 0.03528
PAGE_BODY_CM = 27.4   # 29.7 - 上下边距 1.2/1.1
HEADER_CM = 3.95      # 顶部姓名+照片表格的估算高度


def para_height_cm(p):
    text = p.text
    if not text.strip():
        return 0.0

    size = 9.5
    for r in p.runs:
        if r.font.size:
            size = r.font.size.pt
            break

    cw = size * PT_TO_CM                      # 一个中文字符宽度
    units = sum(1.0 if ord(ch) > 127 else 0.55 for ch in text)
    if "\t" in text:                          # 带右对齐制表的行，永远单行
        lines = 1
    else:
        lines = max(1, math.ceil(units * cw / USABLE_CM))

    pf = p.paragraph_format
    before = pf.space_before.pt if pf.space_before is not None else 0.0
    after = pf.space_after.pt if pf.space_after is not None else 0.0
    line_sp = pf.line_spacing if pf.line_spacing else 1.0
    if not isinstance(line_sp, float):
        line_sp = 1.0

    height_pt = lines * size * 1.2 * line_sp + before + after
    return height_pt * PT_TO_CM


def main(path):
    doc = Document(path)
    total = HEADER_CM
    rows = []
    for p in doc.paragraphs:
        h = para_height_cm(p)
        if h <= 0:
            continue
        total += h
        rows.append((h, p.text[:46]))

    print(f"正文估算高度：{total:.1f} cm / 可用 {PAGE_BODY_CM} cm")
    if total <= PAGE_BODY_CM:
        print(f"判定：一页放得下，余量 {PAGE_BODY_CM - total:.1f} cm")
    else:
        print(f"判定：超出 {total - PAGE_BODY_CM:.1f} cm，大约多 "
              f"{math.ceil((total - PAGE_BODY_CM) / 0.42)} 行")

    print("\n占高最多的段落：")
    for h, t in sorted(rows, reverse=True)[:8]:
        print(f"  {h:4.2f}cm  {t}")


if __name__ == "__main__":
    main(sys.argv[1])
