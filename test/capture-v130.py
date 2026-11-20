#!/usr/bin/env python3
"""v1.30 화면 미리보기 촬영 — 로컬 저장소를 이 스크립트 안에서만 HTTP로 띄웁니다.
   LD_LIBRARY_PATH=/workspace/tmp/deblibs/usr/lib/x86_64-linux-gnu python3 test/capture-v130.py [--out /workspace/downloads]
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
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'

SHOTS = [
    ('log', '배드민턴_코트점수판_bm-v1.30.0_일지입구.png'),
    ('deuce', '배드민턴_코트점수판_bm-v1.30.0_듀스.png'),
    ('timer', '배드민턴_드릴타이머_bm-v1.30.0_카운트다운.png'),
    ('warm', '배드민턴_드릴타이머_bm-v1.30.0_워밍업타이머.png'),
]


def main():
    out = OUT
    if '--out' in sys.argv:
        out = sys.argv[sys.argv.index('--out') + 1]
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=APP)
    httpd = socketserver.TCPServer(('127.0.0.1', 0), handler)
    port = httpd.server_address[1]
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
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
                page.goto(f'http://127.0.0.1:{port}/test/v130-preview.html?view={view}', wait_until='load')
                page.wait_for_timeout(1100)
                if view in ('timer', 'warm'):
                    sel = '[data-region="analysis"]' if view == 'timer' else '[data-fold="prevent"] .fold__body'
                    page.evaluate("""(sel) => {
                        const el = document.querySelector(sel);
                        if (el) el.scrollIntoView({ block: 'start' });
                    }""", sel)
                    page.wait_for_timeout(500)
                path = os.path.join(out, name)
                page.screenshot(path=path)
                print('saved', path)
            b.close()
    finally:
        httpd.shutdown()
    print('CONSOLE ERRORS', errs if errs else 'none')


if __name__ == '__main__':
    main()
