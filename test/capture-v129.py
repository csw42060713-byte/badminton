#!/usr/bin/env python3
"""v1.29 화면 미리보기 촬영 — 로컬 저장소를 이 스크립트 안에서만 HTTP로 띄웁니다.
   python3 test/capture-v129.py [--out /workspace/downloads]
"""
import functools
import http.server
import os
import socketserver
import sys
import threading

from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
PORT = 8977
BASE = f'http://127.0.0.1:{PORT}'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'

SHOTS = [
    ('chat', '배드민턴_매너한줄태그_bm-v1.29.0_대화방상단.png'),
    ('chat-done', '배드민턴_매너한줄태그_bm-v1.29.0_남긴뒤.png'),
    ('profile', '배드민턴_매너한줄태그_bm-v1.29.0_프로필배지.png'),
    ('meet', '배드민턴_모집정원_bm-v1.29.0_마감카드.png'),
    ('members', '배드민턴_모집정원_bm-v1.29.0_참여자명단.png'),
]


def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=APP)
    httpd = socketserver.TCPServer(('127.0.0.1', 0), handler)
    port = httpd.server_address[1]
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, port


def main():
    out = OUT
    if '--out' in sys.argv:
        out = sys.argv[sys.argv.index('--out') + 1]
    os.makedirs(out, exist_ok=True)
    httpd, port = serve()
    base = f'http://127.0.0.1:{port}'
    errs = []
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(executable_path=EXE)
            ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                                is_mobile=True, has_touch=True, locale='ko-KR')
            page = ctx.new_page()
            page.on('console', lambda m: errs.append('console: ' + m.text[:200]) if m.type == 'error' else None)
            page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:200]))
            for view, name in SHOTS:
                url = f'{base}/test/v129-preview.html?view={view}'
                page.goto(url, wait_until='load')
                page.wait_for_timeout(450)
                page.screenshot(path=os.path.join(out, name))
                print('shot', view, '→', name, '|', page.title())
            b.close()
    finally:
        httpd.shutdown()
    print('CONSOLE ERRORS', errs if errs else 'none')


if __name__ == '__main__':
    main()
