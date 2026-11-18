#!/usr/bin/env python3
"""
store-assets/capture-screenshots.py — 플레이 스토어용 모바일 스크린샷 촬영

  python3 store-assets/capture-screenshots.py

  · 로컬 저장소(repo 루트)를 이 스크립트 안에서만 HTTP로 띄웁니다(별도 서버 실행 불필요).
  · 360×640 CSS 픽셀, 배율 3 → 실제 파일 1080×1920 (Play 스토어 9:16 규격).
  · 로그인 세션과 테스트 픽스처(test/fixtures.js)를 심어 실제 화면처럼 채운 뒤 찍습니다.
  · 결과: store-assets/screenshot-1-matching.png, -2-chat, -3-ai, -4-my
"""
import functools
import http.server
import os
import socketserver
import threading

from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
PORT = 8971
BASE = f"http://127.0.0.1:{PORT}"

ACCOUNT = {"email": "narae@example.com", "name": "나래"}

SEED_SESSION = """
(account) => {
  const now = '2026-11-18 20:00:00';
  const session = {
    kind: 'email', email: account.email, name: account.name, token: '', source: 'local',
    at: now, onboardedAt: '2026-11-01 09:00:00',
    profile: {
      nick: account.name, level: 'C조', discipline: '복식', region: '경기',
      club: '나래울', onboardedAt: '2026-11-01 09:00:00'
    }
  };
  localStorage.setItem('bm_auth_v1', JSON.stringify(session));
  localStorage.setItem('bm_seen_v1', 'true');
  return session;
}
"""

SEED_ROWS = """
() => {
  const session = BM.auth.session();
  const me = BM.auth.meKeyFor(session);
  const rowsKey = BM.auth.rowsKeyFor(session);
  const col = BM.domain.COL;
  const rows = BM.fixtures.demo().map((r) => {
    const copy = r.slice();
    ['사용자ID', '대상', '팀'].forEach((name) => {
      const i = col[name];
      if (i != null && copy[i] === 'demo_me') copy[i] = me;
    });
    return copy;
  });
  localStorage.setItem(rowsKey, JSON.stringify(rows));
  return { me, rowsKey, count: rows.length };
}
"""


def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=APP)
    handler.log_message = lambda *a, **k: None
    httpd = socketserver.ThreadingTCPServer(("127.0.0.1", PORT), handler)
    httpd.daemon_threads = True
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def settle(page, ms=700):
    page.wait_for_timeout(ms)


def app_ready(page):
    page.wait_for_function("() => window.BM && document.querySelector('.view')", timeout=15000)


def main():
    httpd = serve()
    os.makedirs(HERE, exist_ok=True)
    shots = []
    try:
        with sync_playwright() as p:
            exe = p.chromium.executable_path
            if not os.path.exists(exe):
                # headless shell이 없을 때: 설치된 크롬 실행 파일로 대신 실행
                import glob
                cands = glob.glob(os.path.expanduser("~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome"))
                exe = cands[0] if cands else exe
            browser = p.chromium.launch(
                executable_path=exe,
                args=["--force-color-profile=srgb", "--font-render-hinting=none", "--headless=new"],
            )
            ctx = browser.new_context(
                viewport={"width": 360, "height": 640},
                device_scale_factor=3,
                is_mobile=True,
                has_touch=True,
                locale="ko-KR",
                timezone_id="Asia/Seoul",
                service_workers="block",
            )
            page = ctx.new_page()

            # 1) 세션 + 데이터 심기
            page.goto(f"{BASE}/index.html")
            settle(page, 400)
            page.evaluate(SEED_SESSION, ACCOUNT)
            page.reload()
            app_ready(page)
            page.add_script_tag(url=f"{BASE}/test/fixtures.js")
            info = page.evaluate(SEED_ROWS)
            print("심은 행:", info["count"], "| meKey:", info["me"])
            page.reload()
            app_ready(page)
            settle(page, 900)

            # 2) 매칭
            page.evaluate("() => { location.hash = '#/matching'; }")
            settle(page, 900)
            assert page.query_selector(".view[data-view='matching'], [data-view='matching']"), "매칭 화면이 없습니다"
            path = os.path.join(HERE, "screenshot-1-matching.png")
            page.screenshot(path=path)
            shots.append(path)

            # 3) 1:1 채팅 (대화방)
            page.evaluate("() => { location.hash = '#/log'; }")
            settle(page, 500)
            page.click("#hdrChat")
            settle(page, 700)
            room = page.query_selector("[data-thread]")
            if room:
                room.click()
                settle(page, 800)
                page.evaluate("""() => {
                  const box = document.querySelector('.dm__msgs, .dm__body, #dm');
                  if (box) box.scrollTop = box.scrollHeight;
                }""")
                settle(page, 400)
            path = os.path.join(HERE, "screenshot-2-chat.png")
            page.screenshot(path=path)
            shots.append(path)

            # 4) 일지 & AI — 오늘 일지를 저장해 분석 카드를 띄웁니다
            page.goto(f"{BASE}/index.html#/log")
            app_ready(page)
            settle(page, 700)
            btn = page.query_selector("[data-act='save-log']")
            if btn:
                btn.scroll_into_view_if_needed()
                btn.click()
                settle(page, 1200)
            page.evaluate("""() => {
              const el = document.querySelector('[data-region="analysis"]');
              if (el) el.scrollIntoView({ block: 'start' });
              window.scrollTo(0, 0);
              document.getElementById('main').scrollTop = 0;
            }""")
            settle(page, 600)
            page.evaluate("""() => {
              const el = document.querySelector('[data-region="analysis"]');
              if (el) el.scrollIntoView({ block: 'start' });
            }""")
            settle(page, 500)
            path = os.path.join(HERE, "screenshot-3-ai.png")
            page.screenshot(path=path)
            shots.append(path)

            # 5) MY
            page.evaluate("() => { location.hash = '#/my'; }")
            settle(page, 900)
            page.evaluate("() => { document.getElementById('main').scrollTop = 0; window.scrollTo(0,0); }")
            settle(page, 400)
            path = os.path.join(HERE, "screenshot-4-my.png")
            page.screenshot(path=path)
            shots.append(path)

            ctx.close()
            browser.close()
    finally:
        httpd.shutdown()

    for s in shots:
        print(os.path.relpath(s, APP), os.path.getsize(s) // 1024, "KB")


if __name__ == "__main__":
    main()
