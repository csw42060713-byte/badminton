#!/usr/bin/env python3
"""store-assets/crop_shots.py — 촬영한 전체 화면에서 휴대폰 영역(540×960)만 잘라 저장

  python3 store-assets/crop_shots.py 원본.png 결과.png

임시 촬영 페이지(dev-shot.html)의 바깥 배경(#20262e)과 앱 배경(#080b0a)의 경계를 찾아
정확히 프레임 영역만 남깁니다. 크기가 540×960이 아니면 알려 줍니다.
"""
import sys
from PIL import Image

PAGE_BG = (32, 38, 46)      # 촬영 페이지 바깥 배경
TOL = 14                    # 압축/색 변환 여유


def is_page_bg(px):
    return all(abs(px[i] - PAGE_BG[i]) <= TOL for i in range(3))


def find_frame(img):
    """촬영 페이지가 프레임 둘레에 그린 마젠타 테두리(#ff00ff)를 찾아 그 안쪽을 돌려줍니다."""
    w, h = img.size
    px = img.load()

    def is_mark(p):
        return p[0] > 200 and p[1] < 80 and p[2] > 200

    left = top = None
    right = bottom = None
    for y in range(h):
        for x in range(w):
            if is_mark(px[x, y]):
                left, top = x, y
                break
        if left is not None:
            break
    if left is None:
        raise SystemExit("마젠타 기준선을 찾지 못했습니다 (dev-shot.html로 찍은 화면인지 확인)")
    for y in range(h - 1, -1, -1):
        for x in range(w - 1, -1, -1):
            if is_mark(px[x, y]):
                right, bottom = x, y
                break
        if right is not None:
            break

    # 테두리 두께(2px) 안쪽 = 실제 앱 화면
    inset = 2
    return left + inset, top + inset, right - inset + 1, bottom - inset + 1


def main():
    src, dst = sys.argv[1], sys.argv[2]
    img = Image.open(src).convert("RGB")
    box = find_frame(img)
    crop = img.crop(box)
    print(f"{src} → {box} = {crop.size}")
    if crop.size != (540, 960):
        print(f"  경고: 크기가 540×960이 아닙니다 ({crop.size})")
    crop.save(dst, "PNG", optimize=True)
    print(f"저장: {dst} {crop.size}")


if __name__ == "__main__":
    main()
