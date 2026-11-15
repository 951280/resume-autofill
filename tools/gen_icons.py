# -*- coding: utf-8 -*-
"""生成扩展图标：深蓝圆角底 + 白色简历卡 + 绿色对勾，输出 16/32/48/128。"""
import os

from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "icons")
NAVY = (31, 56, 100, 255)
NAVY_LIGHT = (47, 84, 150, 255)
WHITE = (255, 255, 255, 255)
LINE = (203, 213, 225, 255)
GREEN = (34, 197, 94, 255)

SCALE = 8  # 先画大图再缩小，边缘更平滑


def rounded(draw, box, radius, fill):
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def build(size):
    s = size * SCALE
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 底板
    rounded(d, (0, 0, s - 1, s - 1), int(s * 0.22), NAVY_LIGHT)
    rounded(d, (0, 0, s - 1, int(s * 0.62)), int(s * 0.22), NAVY)

    # 简历卡
    pad_x = int(s * 0.24)
    top = int(s * 0.18)
    bottom = int(s * 0.84)
    rounded(d, (pad_x, top, s - pad_x, bottom), int(s * 0.07), WHITE)

    # 正文线
    lx0 = int(s * 0.34)
    lx1 = int(s * 0.66)
    lw = max(1, int(s * 0.045))
    for i, ratio in enumerate((0.34, 0.45, 0.56)):
        y = int(s * ratio)
        d.rounded_rectangle((lx0, y, lx1 - (i == 2) * int(s * 0.1), y + lw), radius=lw // 2, fill=LINE)

    # 绿色对勾
    cx, cy = int(s * 0.70), int(s * 0.66)
    r = int(s * 0.16)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=GREEN)
    w = max(2, int(s * 0.035))
    d.line(
        [
            (cx - r * 0.45, cy + r * 0.02),
            (cx - r * 0.10, cy + r * 0.38),
            (cx + r * 0.50, cy - r * 0.34),
        ],
        fill=WHITE,
        width=w,
        joint="curve",
    )

    return img.resize((size, size), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    for size in (16, 32, 48, 128):
        path = os.path.join(OUT, f"icon{size}.png")
        build(size).save(path)
        print("saved", path)


if __name__ == "__main__":
    main()
