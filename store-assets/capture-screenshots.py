#!/usr/bin/env python3
"""
store-assets/capture-screenshots.py — 플레이 스토어용 모바일 스크린샷 촬영

  python3 store-assets/capture-screenshots.py

  · 로컬 저장소(repo 루트)를 이 스크립트 안에서만 HTTP로 띄웁니다(별도 서버 실행 불필요).
  · 405×720 CSS 픽셀(정확히 9:16), 배율 2.6667 → 실제 파일 1080×1920.
    (Chromium이 없는 환경에서는 배포 사이트에서 같은 화면을 찍었습니다. 규격만 9:16이면 됩니다.)
  · 로그인 세션과 테스트 픽스처(test/fixtures.js)를 심어 실제 화면처럼 채운 뒤 찍습니다.
    이때 저장소를 '이 기기에만(local)'로 고정하고 바깥 요청을 막습니다 —
    스토어 이미지에 실제 사용자의 글이나 닉네임이 찍히지 않게 하기 위해서입니다.
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
BASE = ''

ACCOUNT = {"email": "narae@example.com", "name": "나래"}

SEED_SESSION = """
(account) => {
  const now = '2026-11-21 08:30:00';
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
  /* 스토어 이미지에는 가상 데이터만 보이게 — 실시간 서버 대신 '이 기기에만' 모드 */
  localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
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
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a, **k):
            pass

    socketserver.ThreadingTCPServer.allow_reuse_address = True
    httpd = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=APP))
    httpd.daemon_threads = True
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def main():
    global BASE
    httpd = serve()
    BASE = f'http://127.0.0.1:{httpd.server_address[1]}'
    shots = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(args=['--force-color-profile=srgb', '--font-render-hinting=none'])
            ctx = browser.new_context(
                viewport={'width': 405, 'height': 720},
                device_scale_factor=2.6667,
                is_mobile=True,
                has_touch=True,
                locale='ko-KR',
                timezone_id='Asia/Seoul',
                service_workers='block',
            )
            page = ctx.new_page()
            # 바깥(실시간 서버·구글 로그인 등) 요청은 막습니다 — 가상 데이터만 찍기 위해서
            page.route('**/*', lambda r: r.continue_() if r.request.url.startswith(BASE) else r.abort())

            # 1) 세션 + 데이터 심기
            page.goto(f'{BASE}/index.html')
            page.wait_for_timeout(400)
            page.evaluate(SEED_SESSION, ACCOUNT)
            page.reload()
            page.wait_for_function("() => window.BM && document.querySelector('.view')", timeout=15000)
            page.add_script_tag(url=f'{BASE}/test/fixtures.js')
            info = page.evaluate(SEED_ROWS)
            print('심은 행:', info['count'], '| meKey:', info['me'])
            page.reload()
            page.wait_for_function("() => window.BM && document.querySelector('.view')", timeout=15000)
            # 스크롤바만 숨깁니다(overflow-x:hidden을 걸면 body가 스크롤 주인이 되어 window.scrollTo가 먹지 않습니다)
            page.add_style_tag(content='::-webkit-scrollbar{width:0;height:0}*{scrollbar-width:none}')
            page.wait_for_timeout(900)

            def scroll_to(y):
                page.evaluate('(y) => window.scrollTo(0, y)', y)
                page.wait_for_timeout(450)

            def scroll_card(selector, pad=64):
                """요소의 위쪽을 고정 헤더 바로 아래에 맞춥니다."""
                page.evaluate(
                    """(arg) => {
                      const el = document.querySelector(arg.sel);
                      if (!el) return false;
                      const top = el.getBoundingClientRect().top + window.scrollY - arg.pad;
                      window.scrollTo(0, Math.max(0, top));
                      return true;
                    }""",
                    {'sel': selector, 'pad': pad},
                )
                page.wait_for_timeout(500)

            def shot(name):
                path = os.path.join(HERE, name)
                page.screenshot(path=path)
                shots.append(path)

            # 2) 1:1 매칭 — 결과 목록까지 펼친 화면
            page.evaluate("() => { location.hash = '#/matching'; }")
            page.wait_for_timeout(900)
            scroll_to(0)
            page.evaluate(
                """() => {
                  const b = Array.from(document.querySelectorAll('button, a'))
                    .filter((el) => el.textContent.indexOf('전체 선수 보기') >= 0)[0];
                  if (b) b.click();
                }"""
            )
            page.wait_for_timeout(3000)          # '전체 선수를 보여드릴게요' 토스트가 사라질 때까지
            assert page.query_selector('.pcard'), '매칭 결과 카드가 없습니다'
            # 결과 목록(search·필터·'8명 찾음' + 카드 2장)이 한 화면에 오도록 맞춥니다
            page.evaluate(
                """() => {
                  const head = Array.from(document.querySelectorAll('h2, h3'))
                    .filter((el) => el.textContent.trim() === '플레이어 찾기')[0];
                  if (!head) return;
                  const sec = head.closest('section') || head.parentElement;
                  window.scrollTo(0, Math.max(0, sec.getBoundingClientRect().top + window.scrollY - 30));
                }"""
            )
            page.wait_for_timeout(700)
            shot('screenshot-1-matching.png')

            # 3) 채팅 — 매칭이 성사된 상대와의 1:1 대화
            page.evaluate("() => { location.hash = '#/log'; }")
            page.wait_for_timeout(600)
            page.click('#hdrChat')
            page.wait_for_timeout(800)
            room = page.query_selector('[data-thread]')
            assert room, '대화방이 없습니다 (픽스처 채팅 행 확인)'
            room.click()
            page.wait_for_timeout(800)
            page.evaluate(
                """() => {
                  const box = document.querySelector('.dm__scroll');
                  if (box) box.scrollTop = box.scrollHeight;
                }"""
            )
            page.wait_for_timeout(500)
            shot('screenshot-2-chat.png')

            # 4) 일지 & AI — 오늘 일지를 저장해 AI 분석 카드를 띄웁니다
            page.goto(f'{BASE}/index.html#/log')
            page.wait_for_function("() => window.BM && document.querySelector('.view')", timeout=15000)
            page.wait_for_timeout(700)
            for chip in ('드라이브', '헤어핀'):
                page.evaluate(
                    """(name) => {
                      const el = Array.from(document.querySelectorAll('button, span, label'))
                        .filter((e) => e.textContent.trim() === name)[0];
                      if (el) el.click();
                    }""",
                    chip,
                )
                page.wait_for_timeout(150)
            field = page.query_selector("[data-field='minutes']")
            if field:
                field.fill('90')
                page.wait_for_timeout(150)
            btn = page.query_selector("[data-act='save-log']")
            assert btn, '일지 저장 버튼이 없습니다'
            btn.scroll_into_view_if_needed()
            btn.click()
            page.wait_for_timeout(3200)          # 저장 토스트가 사라질 때까지
            assert page.query_selector('[data-region="analysis"]'), 'AI 분석 카드가 없습니다'
            scroll_card('[data-region="analysis"]', pad=62)
            shot('screenshot-3-ai.png')

            # 5) MY — 프로필·이번 달 숫자·훈련 설정
            page.evaluate("() => { location.hash = '#/my'; }")
            page.wait_for_timeout(900)
            scroll_to(0)
            page.wait_for_timeout(300)
            shot('screenshot-4-my.png')

            ctx.close()
            browser.close()
    finally:
        httpd.shutdown()

    for s in shots:
        print(os.path.relpath(s, APP), os.path.getsize(s) // 1024, 'KB')


if __name__ == '__main__':
    main()
