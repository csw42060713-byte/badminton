#!/usr/bin/env python3
"""
store-assets/make-store-assets.py — 플레이 스토어 등록 그래픽 만들기

  python3 store-assets/make-store-assets.py

  · store-assets/icon-512.png            512×512 (Play 아이콘, 꽉 찬 정사각형)
  · store-assets/feature-graphic-1024x500.png  1024×500 (대표 그래픽)

아이콘 그림은 icons/icon-512.png(2026-11-21 새 로고 — 아래쪽 짧은 파형 + 은은한 테두리 빛)를
그대로 씁니다. 대표 그래픽 왼쪽 로고도 같은 파일이라, 아이콘을 바꾸면 둘 다 함께 바뀝니다.
글꼴은 시스템의 Noto Sans CJK KR을 씁니다.
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
OUT = HERE

BG_DARK = (8, 11, 10)        # 앱 나이트 배경 #080b0a
NAVY = (21, 32, 51)          # 아이콘 배경 #152033
LIME = (198, 242, 78)        # 셔틀콕 포인트 #c6f24e
MINT = (67, 223, 160)        # 코트 민트 #43dfa0
WHITE = (242, 246, 243)
MUTED = (137, 154, 147)

FONT_KO = "/usr/share/fonts/pickle-hwp/NotoSansCJKkr-Regular.otf"


def font(size):
    return ImageFont.truetype(FONT_KO, size)


def load_icon():
    src = Image.open(os.path.join(APP, "icons", "icon-512.png")).convert("RGBA")
    return src


def square_icon():
    """512×512 꽉 찬 정사각형 아이콘 — 앱 아이콘(icons/icon-512.png)을 그대로 씁니다.
    새 로고는 모서리 둥근 타일과 배경까지 그림에 들어 있어, 자르거나 덧칠하지 않습니다."""
    src = load_icon().convert("RGB")
    if src.size != (512, 512):
        src = src.resize((512, 512), Image.LANCZOS)
    path = os.path.join(OUT, "icon-512.png")
    src.save(path, "PNG", optimize=True)
    return path, src


def emblem(box_size):
    """아이콘에서 셔틀콕 그림만 잘라 투명 배경으로 돌려줍니다.
    아이콘 배경은 어두운 남색(그라데이션)이고 그림은 흰색·라임이라,
    밝기로 전경/배경을 나누고 경계는 부드럽게 살립니다."""
    src = load_icon().convert("RGBA")
    w, h = src.size
    work = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sp, dp = src.load(), work.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = sp[x, y]
            lum = r + g + b
            if a < 20 or lum < 150:
                continue
            # 150~260 구간은 반투명으로 부드럽게
            alpha = 255 if lum >= 260 else int(255 * (lum - 150) / 110)
            dp[x, y] = (r, g, b, min(a, alpha))
    box = work.getbbox()
    crop = work.crop(box)
    ratio = box_size / max(crop.width, crop.height)
    crop = crop.resize((max(1, int(crop.width * ratio)), max(1, int(crop.height * ratio))), Image.LANCZOS)
    return crop


def logo_tile(box_size):
    """아이콘을 그대로 축소해 둥근 타일로 붙일 수 있게 돌려줍니다 (투명 모서리 유지)."""
    src = load_icon().convert("RGBA").resize((box_size, box_size), Image.LANCZOS)
    mask = Image.new("L", (box_size, box_size), 0)
    d = ImageDraw.Draw(mask)
    radius = int(box_size * 0.22)
    d.rounded_rectangle([0, 0, box_size - 1, box_size - 1], radius=radius, fill=255)
    out = Image.new("RGBA", (box_size, box_size), (0, 0, 0, 0))
    out.paste(src, (0, 0), mask)
    return out


def feature_graphic():
    W, H = 1024, 500
    img = Image.new("RGB", (W, H), BG_DARK)
    d = ImageDraw.Draw(img, "RGBA")

    # 세로 그라데이션
    for y in range(H):
        t = y / (H - 1)
        c = (
            int(8 + (18 - 8) * t),
            int(11 + (26 - 11) * t),
            int(10 + (38 - 10) * t),
        )
        d.line([(0, y), (W, y)], fill=c)

    # 왼쪽 라임 글로우
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([-260, -300, 560, 520], fill=(198, 242, 78, 34))
    glow = glow.filter(ImageFilter.GaussianBlur(90))
    img = Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB")
    d = ImageDraw.Draw(img, "RGBA")

    # 코트 라인(오른쪽 아래, 은은하게)
    d.line([(430, 470), (760, 190)], fill=(255, 255, 255, 16), width=2)
    d.line([(520, 500), (860, 210)], fill=(255, 255, 255, 12), width=2)
    d.line([(620, 500), (980, 250)], fill=(255, 255, 255, 9), width=2)

    # 왼쪽 로고 — 앱 아이콘 그대로(둥근 타일). 아이콘을 바꾸면 여기도 따라 바뀝니다.
    mark = logo_tile(300)
    img.paste(mark, (74, (H - mark.height) // 2), mark)

    # 텍스트
    x = 420
    d.text((x, 96), "배드민턴 분석", font=font(74), fill=WHITE, stroke_width=1, stroke_fill=WHITE)
    d.text((x, 206), "일지 한 줄이면", font=font(40), fill=LIME)
    d.text((x, 262), "AI 드릴 · 1:1 매칭 · 코치 피드백", font=font(30), fill=(214, 226, 219))
    d.text((x, 330), "TRAIN SMARTER ON AND OFF THE COURT", font=font(15), fill=MUTED)

    # 아래 라임 라인
    d.rounded_rectangle([x, 372, x + 96, 378], radius=3, fill=LIME)

    path = os.path.join(OUT, "feature-graphic-1024x500.png")
    img.save(path, "PNG", optimize=True)
    return path, img


def main():
    os.makedirs(OUT, exist_ok=True)
    p1, _ = square_icon()
    p2, _ = feature_graphic()
    for p in (p1, p2):
        im = Image.open(p)
        print(os.path.relpath(p, APP), im.size, im.mode, os.path.getsize(p) // 1024, "KB")


if __name__ == "__main__":
    main()
