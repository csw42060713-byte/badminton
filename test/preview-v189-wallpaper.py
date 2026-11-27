"""셔틀릭스 폰 바탕화면 — 렌더러 미리보기 시안 (실기기 캡처 아님)

  안드로이드 ShuttlixWallpaperService.java 와 같은 좌표·색·구도로 그린 미리보기입니다.
  (자바 코드는 Canvas 로 그리므로 픽셀이 완전히 같지는 않습니다 — 배치·색 확인용)

  python3 test/preview-v189-wallpaper.py
"""
import math
import os

import numpy as np
from PIL import Image, ImageDraw

W, H = 1080, 2400
OUT = '/workspace/downloads'
SS = 2  # 랙켓 레이어 슈퍼샘플


def hex2rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def mixc(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def lighten(c, t):
    return mixc(c, (255, 255, 255), t)


def darken(c, t):
    return mixc(c, (0, 0, 0), t)


def vertical_gradient(stops):
    y = np.arange(H, dtype=np.float32) / (H - 1)
    pos = np.array([s[0] for s in stops], dtype=np.float32)
    cols = np.array([s[1] for s in stops], dtype=np.float32)
    out = np.zeros((H, 3), dtype=np.float32)
    for ch in range(3):
        out[:, ch] = np.interp(y, pos, cols[:, ch])
    return np.repeat(out[:, None, :], W, axis=1)


def radial_field(cx, cy, radius):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / max(1.0, radius)
    return np.clip(1.0 - d, 0.0, 1.0)


def add_glow(img, cx, cy, radius, color, strength, power=2.0):
    f = radial_field(cx, cy, radius) ** power
    a = (f * strength)[..., None]
    rgb = np.array(color, dtype=np.float32)[None, None, :]
    img[:] = 1.0 - (1.0 - img) * (1.0 - a * (rgb / 255.0))


def background():
    img = vertical_gradient([
        (0.00, hex2rgb('#070A0E')),
        (0.38, hex2rgb('#101A20')),
        (0.72, hex2rgb('#0A1216')),
        (1.00, hex2rgb('#04070A')),
    ]) / 255.0
    add_glow(img, W * 0.5, H * 0.16, W * 0.98, (46, 80, 96), 0.55, 1.6)
    add_glow(img, W * 0.5, H * 0.79, W * 0.72, (134, 184, 216), 0.34, 2.2)

    base = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8))
    d = ImageDraw.Draw(base, 'RGBA')

    pool_y = H * 0.79
    for rx, ry, col, wd in [(W * 0.42, H * 0.09, (159, 212, 234, 66), 3),
                            (W * 0.30, H * 0.055, (207, 230, 242, 38), 2)]:
        d.ellipse([W * 0.5 - rx, pool_y - ry, W * 0.5 + rx, pool_y + ry], outline=col, width=wd)

    for i in range(-4, 5):
        d.line([(W * 0.5, H * 0.30), (W * 0.5 + i * W * 0.24, H)], fill=(255, 255, 255, 14), width=2)
    for i in range(4):
        yy = H * 0.62 + i * H * 0.11
        d.line([(0, yy), (W, yy)], fill=(255, 255, 255, 18), width=2)

    # 비네팅
    img = np.asarray(base).astype(np.float32) / 255.0
    v = radial_field(W * 0.5, H * 0.46, max(W, H) * 0.78)
    v = np.clip(1.0 - v, 0, 1)
    img *= (1.0 - 0.55 * (v ** 1.7))[..., None]
    return img


def racket_layer(rx, ry, hoop, shaft_r, grip_r, shaft_len, grip_len,
                 frame_c, string_c, grip_c, grip_c2, stencil, stencil_c,
                 scale, cx, cy, tilt_deg):
    """랙켓 한 자루를 슈퍼샘플 레이어에 그려 돌려줍니다 (화면 좌표)."""
    layer = Image.new('RGBA', (W * SS, H * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer, 'RGBA')
    mid = (shaft_len + grip_len) / 2.0
    th = math.radians(tilt_deg)
    cos_t, sin_t = math.cos(th), math.sin(th)

    def P(x_mm, y_mm):
        y_mm = y_mm - mid
        sx = x_mm * scale
        sy = y_mm * scale
        px = cx + (sx * cos_t - sy * sin_t)
        py = cy + (sx * sin_t + sy * cos_t)
        return (px * SS, py * SS)

    def line_w(mm):
        return max(1, int(round(mm * scale * SS)))

    # 헤드 테두리
    head_pts = [P(-rx, -ry), P(rx, ry)]
    d.ellipse([head_pts[0], head_pts[1]], outline=frame_c + (255,), width=line_w(hoop * 1.12))
    # 테두리 마감 — 안쪽 그늘 → 바깥 하이라이트(자바 렌더러와 같이 타원 전체)
    inner = [P(-rx + hoop * 0.7, -ry + hoop * 0.7), P(rx - hoop * 0.7, ry - hoop * 0.7)]
    d.ellipse(inner, outline=darken(frame_c, 0.62) + (110,), width=line_w(1.8))
    d.ellipse([P(-rx, -ry), P(rx, ry)], outline=lighten(frame_c, 0.72) + (120,), width=line_w(1.4))

    # 거트 17×19
    irx, iry = rx - hoop * 0.78, ry - hoop * 0.78
    strings = Image.new('RGBA', (W * SS, H * SS), (0, 0, 0, 0))
    sd = ImageDraw.Draw(strings, 'RGBA')
    for i in range(1, 15):
        x = -irx + 2 * irx * i / 15
        sd.line([P(x, -iry), P(x, iry)], fill=string_c + (165,), width=line_w(0.85))
    for j in range(1, 17):
        y = -iry + 2 * iry * j / 17
        sd.line([P(-irx, y), P(irx, y)], fill=string_c + (165,), width=line_w(0.85))
    mask = Image.new('L', (W * SS, H * SS), 0)
    ImageDraw.Draw(mask).ellipse([P(-irx, -iry), P(irx, iry)], fill=255)
    layer.alpha_composite(Image.composite(strings, Image.new('RGBA', layer.size, (0, 0, 0, 0)), mask))

    # 스텐실
    if stencil != 'none':
        sx, sy = rx * 0.42, ry * 0.42
        if stencil == 'crown':
            pts = [P(-sx, sy * 0.55), P(-sx, -sy * 0.15), P(-sx * 0.5, sy * 0.25), P(0, -sy * 0.5),
                   P(sx * 0.5, sy * 0.25), P(sx, -sy * 0.15), P(sx, sy * 0.55)]
            d.polygon(pts, fill=stencil_c + (70,))
        elif stencil == 'bolt':
            pts = [P(sx * 0.28, -sy), P(-sx * 0.35, sy * 0.12), P(sx * 0.05, sy * 0.12),
                   P(-sx * 0.2, sy), P(sx * 0.45, -sy * 0.18), P(sx * 0.02, -sy * 0.18)]
            d.polygon(pts, fill=stencil_c + (70,))
        elif stencil == 'x':
            d.line([P(-sx, -sy * 0.7), P(sx, sy * 0.7)], fill=stencil_c + (95,), width=line_w(9))
            d.line([P(sx, -sy * 0.7), P(-sx, sy * 0.7)], fill=stencil_c + (95,), width=line_w(9))
        else:
            d.ellipse([P(-sx * 0.2, -sy * 0.55 - sx * 0.2), P(sx * 0.2, -sy * 0.55 + sx * 0.2)],
                      fill=stencil_c + (110,))
            d.polygon([P(-sx * 0.5, sy * 0.75), P(-sx * 0.16, -sy * 0.3),
                       P(sx * 0.16, -sy * 0.3), P(sx * 0.5, sy * 0.75)], fill=stencil_c + (95,))

    # T 조인트
    d.rounded_rectangle([P(-13, ry - 7), P(13, ry + 11)], radius=line_w(5), fill=darken(frame_c, 0.28) + (255,))

    # 샤프트
    y0, y1 = ry + 2, ry + shaft_len
    sw = shaft_r * 2.1
    d.polygon([P(-sw * 0.55, y0), P(sw * 0.55, y0), P(sw * 0.42, y1), P(-sw * 0.42, y1)],
              fill=mixc(frame_c, (255, 255, 255), 0.16) + (255,))
    # 콘
    gw = grip_r * 2
    cone_end = y1 + 20
    d.polygon([P(-sw * 0.42, y1), P(sw * 0.42, y1), P(gw * 0.46, cone_end), P(-gw * 0.46, cone_end)],
              fill=darken(frame_c, 0.3) + (255,))
    # 그립
    grip_top = cone_end - 2
    grip_bot = grip_top + grip_len
    d.rounded_rectangle([P(-gw / 2, grip_top), P(gw / 2, grip_bot)], radius=line_w(7), fill=grip_c + (255,))
    # 감은 나선
    wrap = Image.new('RGBA', (W * SS, H * SS), (0, 0, 0, 0))
    wd = ImageDraw.Draw(wrap, 'RGBA')
    wrap_col = (grip_c2 if grip_c2 else darken(grip_c, 0.45)) + (170,)
    for i in range(15):
        y = grip_top + grip_len * i / 15
        wd.line([P(-gw / 2, y + 3), P(gw / 2, y - 7)], fill=wrap_col, width=line_w(1.1))
    gmask = Image.new('L', (W * SS, H * SS), 0)
    ImageDraw.Draw(gmask).rounded_rectangle([P(-gw / 2, grip_top), P(gw / 2, grip_bot)], radius=line_w(7), fill=255)
    layer.alpha_composite(Image.composite(wrap, Image.new('RGBA', layer.size, (0, 0, 0, 0)), gmask))
    # 엔드 캡
    d.rounded_rectangle([P(-gw / 2, grip_bot - 4), P(gw / 2, grip_bot + 3.5)], radius=line_w(4),
                        fill=darken(grip_c, 0.55) + (255,))

    layer = layer.resize((W, H), Image.LANCZOS)
    arr = np.asarray(layer).astype(np.float32) / 255.0
    return arr[..., :3], arr[..., 3:4]


def scatter(img, particles):
    """불티/결정 — 작은 원을 가산 합성으로."""
    for (x, y, r, col, a) in particles:
        rr = int(max(2, r))
        x0, x1 = int(max(0, x - rr)), int(min(W, x + rr + 1))
        y0, y1 = int(max(0, y - rr)), int(min(H, y + rr + 1))
        if x0 >= x1 or y0 >= y1:
            continue
        yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
        d = np.sqrt((xx - x) ** 2 + (yy - y) ** 2) / max(1.0, r)
        f = np.clip(1.0 - d, 0, 1) ** 1.6 * a
        col_arr = np.array(col, dtype=np.float32) / 255.0
        sub = img[y0:y1, x0:x1]
        img[y0:y1, x0:x1] = 1.0 - (1.0 - sub) * (1.0 - f[..., None] * col_arr[None, None, :])


def ring(img, cx, cy, radius, width, col, alpha):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.abs(np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) - radius)
    f = np.clip(1.0 - d / max(1.0, width), 0, 1) ** 1.5 * alpha
    col_arr = np.array(col, dtype=np.float32) / 255.0
    img[:] = 1.0 - (1.0 - img) * (1.0 - f[..., None] * col_arr[None, None, :])


def shoot(name, cfg):
    img = background()

    # 라켓 뒤 광
    if cfg['effect'] in ('fire', 'blaze'):
        add_glow(img, W * 0.5, H * 0.44, W * 0.62, (255, 106, 30), 0.42, 2.0)
    elif cfg['effect'] == 'ice':
        add_glow(img, W * 0.5, H * 0.44, W * 0.62, (169, 232, 255), 0.40, 2.0)
    elif cfg['effect'] in ('thunder', 'spark'):
        add_glow(img, W * 0.5, H * 0.44, W * 0.62, (143, 208, 255), 0.38, 2.0)
    else:
        add_glow(img, W * 0.5, H * 0.44, W * 0.58, (232, 245, 200), 0.16, 2.2)

    # 바닥 그림자
    add_glow(img, W * 0.5, H * 0.76, W * 0.30, (0, 0, 0), 0.55, 2.6)

    scale = H * 0.62 / 674.0
    scale = min(scale, W * 0.86 / (2 * (cfg['rx'] + cfg['hoop'])))
    rgb, alpha = racket_layer(cfg['rx'], cfg['ry'], cfg['hoop'], cfg['shaft_r'], cfg['grip_r'],
                              cfg['shaft_len'], cfg['grip_len'],
                              hex2rgb(cfg['frame']), hex2rgb(cfg['string']), hex2rgb(cfg['grip']),
                              hex2rgb(cfg['grip2']) if cfg.get('grip2') else None,
                              cfg['stencil'], hex2rgb(cfg['stencil_c']),
                              scale, W * 0.5, H * 0.46, cfg.get('tilt', -1.4))
    img = img * (1 - alpha) + rgb * alpha

    # 효과 장식
    if cfg['effect'] in ('fire', 'blaze'):
        for i in range(7):
            fx = -cfg['rx'] * 0.78 + 1.56 * cfg['rx'] * i / 6
            base = math.sqrt(max(0.0, 1 - (fx / cfg['rx']) ** 2)) * cfg['ry']
            x = W * 0.5 + fx * scale
            y = H * 0.46 - base * scale
            h = (18 + 9 * abs(math.sin(i * 1.3))) * scale
            scatter(img, [(x, y - h * 0.5, h * 0.9, (255, 122, 47), 0.5),
                          (x, y - h * 0.35, h * 0.5, (255, 210, 122), 0.45)])
    elif cfg['effect'] == 'ice':
        for i in range(6):
            a = math.radians(i * 60 + 8)
            x = W * 0.5 + math.cos(a) * (cfg['rx'] + 6) * scale
            y = H * 0.46 + math.sin(a) * (cfg['ry'] + 6) * scale
            scatter(img, [(x, y, 26 * scale, (234, 251, 255), 0.55)])
    elif cfg['effect'] in ('thunder', 'spark'):
        for i in range(5):
            a = math.radians(i * 72 + 6)
            x = W * 0.5 + math.cos(a) * (cfg['rx'] + 4) * scale
            y = H * 0.46 + math.sin(a) * (cfg['ry'] + 4) * scale
            scatter(img, [(x, y, 18 * scale, (185, 228, 255), 0.5)])

    # 터치 임팩트
    ix, iy = cfg['impact']
    ring(img, ix, iy, 210, 26, cfg['ring'], 0.42)
    ring(img, ix, iy, 120, 14, (255, 255, 255), 0.30)
    rnd = np.random.default_rng(7)
    parts = []
    for i in range(34):
        a = 2 * math.pi * i / 34 + rnd.uniform(-0.12, 0.12)
        r = 40 + rnd.uniform(0, 150)
        parts.append((ix + math.cos(a) * r, iy + math.sin(a) * r,
                      rnd.uniform(5, 13), cfg['ring'] if i % 2 else (255, 255, 255), 0.55))
    scatter(img, parts)
    scatter(img, [(ix, iy, 120, cfg['ring'], 0.22)])

    # 먼지
    mo = np.random.default_rng(3)
    scatter(img, [(mo.uniform(0, W), mo.uniform(0, H), mo.uniform(1.5, 3.4), (207, 230, 242), 0.12)
                  for _ in range(26)])

    out = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8))
    path = os.path.join(OUT, name)
    out.save(path)
    print('saved', path)


BODY = dict(rx=98.0, ry=120.5, hoop=10.4, shaft_r=3.6, grip_r=13.6, shaft_len=236, grip_len=198)
SMASH = dict(rx=95.0, ry=118.0, hoop=11.2, shaft_r=3.8, grip_r=13.9, shaft_len=245, grip_len=190)


def merge(*ds):
    o = {}
    for d in ds:
        o.update(d)
    return o


shoot('v189_wallpaper_preview_default.png', merge(BODY, dict(
    frame='#23272B', string='#C6F24E', grip='#1D2124', grip2=None,
    stencil='none', stencil_c='#F2C14E', effect='none', ring=(200, 242, 78),
    impact=(300, 1180), tilt=-1.4)))

shoot('v189_wallpaper_preview_onyx_ice.png', merge(SMASH, dict(
    frame='#1B1F26', string='#3F7CF2', grip='#C6F24E', grip2='#20252B',
    stencil='crown', stencil_c='#F2C14E', effect='ice', ring=(169, 232, 255),
    impact=(760, 1520), tilt=1.3)))

shoot('v189_wallpaper_preview_fire.png', merge(SMASH, dict(
    frame='#E0433C', string='#F3F7EF', grip='#FF9A8B', grip2=None,
    stencil='bolt', stencil_c='#C6F24E', effect='fire', ring=(255, 122, 47),
    impact=(340, 1560), tilt=-2.0)))
