#!/usr/bin/env python3
"""test/store-shots-v136.py — bm-v1.36.0 플레이 스토어 스크린샷을 **라이브 배포본**에서 다시 찍습니다.

  LD_LIBRARY_PATH=/workspace/tmp/deblibs/usr/lib/x86_64-linux-gnu python3 test/store-shots-v136.py

  · 라이브(gh-pages) 화면을 그대로 찍습니다 — 로컬 사본이 아니라 배포본 기준.
  · 405×720 CSS 픽셀(정확히 9:16), 배율 2.6667 → 파일 1080×1920.
  · 로그인 세션과 테스트 픽스처(test/fixtures.js)를 심어 실제 화면처럼 채웁니다.
    (gh-pages에는 test/ 가 없으므로 픽스처는 파일 내용을 그대로 주입합니다)
  · 이번 사이클 화면이 보이도록 복식 파트너 2건 · 6일 연속 출석을 심습니다.
  · 결과: store-assets/screenshot-1-matching.png, -2-chat, -3-ai, -4-my
"""
import os

from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
OUT = os.path.join(APP, "store-assets")   # 결과는 store-assets/ 에 넣습니다
BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'

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
  /* 촬영용 데이터가 그대로 보이도록 '이 기기 저장' 모드로 둡니다(서버 데이터와 섞이지 않게) */
  localStorage.setItem('bm_mode_v1', JSON.stringify('local'));
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

# 이번 사이클 화면(파트너 전적 줄 · 7일 연속 보너스 줄)이 보이도록 몇 줄만 보탭니다.
DRESS_UP = """
() => {
  const session = BM.auth.session();
  const me = BM.auth.meKeyFor(session);
  const rowsKey = BM.auth.rowsKeyFor(session);
  const U = BM.util, D = BM.domain;
  const col = D.COL;
  const rows = U.readJSON(rowsKey, []);
  const names = ['민호', '민수'];
  let k = 0;
  rows.forEach((r) => {
    if (r[col['유형']] !== '기록') return;
    if (!String(r[col['게임점수']] || '').trim()) return;
    if (k >= names.length) return;
    const team = r[col['팀']] ? r[col['팀']] : '';
    if (team && team.indexOf('{') === 0) return;
    const out = {};
    out.partner = names[k];
    r[col['팀']] = JSON.stringify(out);
    k += 1;
  });
  /* 어제까지 6일 연속 출석 — MY 하트 카드에 7일 보너스 안내가 보입니다 */
  for (let i = 1; i <= 6; i++) {
    const day = U.ymd(U.addDays(new Date(), -i));
    rows.push(D.toRow({ id: 'shot_c_' + i, type: '출석하트', createdAt: day + ' 08:00:00', date: day,
      nick: session.profile.nick, userKey: me, likes: 1 }));
  }
  U.writeJSON(rowsKey, rows);
  return {partnered: k, total: rows.length};
}
"""


def settle(page, ms=700):
    page.wait_for_timeout(ms)


def app_ready(page):
    page.wait_for_function("() => window.BM && document.querySelector('.view')", timeout=20000)


def close_sheets(page):
    for _ in range(3):
        if page.query_selector('#sheet .sheet__head [data-close]'):
            page.click('#sheet .sheet__head [data-close]')
            settle(page, 400)


def main():
    shots = []
    with sync_playwright() as p:
        exe = EXE if os.path.exists(EXE) else p.chromium.executable_path
        browser = p.chromium.launch(executable_path=exe,
                                    args=["--force-color-profile=srgb", "--font-render-hinting=none"])
        ctx = browser.new_context(viewport={"width": 405, "height": 720}, device_scale_factor=2.6667,
                                  is_mobile=True, has_touch=True, locale="ko-KR",
                                  timezone_id="Asia/Seoul", service_workers="block")
        page = ctx.new_page()

        page.goto(f"{BASE}?shots=136", wait_until="load")
        settle(page, 600)
        page.evaluate(SEED_SESSION, ACCOUNT)
        page.reload(wait_until="load")
        app_ready(page)
        settle(page, 800)
        close_sheets(page)
        # gh-pages 에는 test/ 가 없으므로 픽스처 파일 내용을 그대로 주입합니다
        fixtures = open(os.path.join(APP, "test", "fixtures.js"), encoding="utf-8").read()
        page.add_script_tag(content=fixtures)
        info = page.evaluate(SEED_ROWS)
        print("심은 행:", info["count"], "| meKey:", info["me"])
        page.reload(wait_until="load")
        app_ready(page)
        settle(page, 800)
        close_sheets(page)
        dressed = page.evaluate(DRESS_UP)
        print("파트너 보탬:", dressed)
        card = page.evaluate("""() => {
          const st = BM.app.ctx.store;
          const mine = (st.state.data.matchProfiles || []).filter(m => m.userKey === st.state.me.key)[0];
          if (mine) return {created: false};
          const res = st.actions.saveMatchProfile({ level: 'C조', discipline: '복식', region: '경기',
            club: '나래울', availability: '주말', experience: '2~5년', gender: '비공개', style: '균형형',
            bio: '주말마다 나래울에서 칩니다. 드라이브를 무기로 만들고 있어요.' });
          return {created: !!(res && res.ok), res: res && res.reason};
        }""")
        print("내 매칭 카드:", card)
        settle(page, 1800)   # 저장 큐가 이 기기 저장소에 다 쓴 뒤 새로 읽습니다
        page.reload(wait_until="load")
        app_ready(page)
        close_sheets(page)
        page.add_style_tag(content="::-webkit-scrollbar{width:0;height:0}html,body{overflow-x:hidden}")
        settle(page, 900)

        # 1) 매칭 — 조건을 골라 목록이 보이는 상태
        page.evaluate("() => { location.hash = '#/matching'; BM.app.ctx.actions.setTab('matching'); }")
        settle(page, 900)
        page.evaluate("() => BM.app.ctx.actions.resetMatchFilter()")
        settle(page, 900)
        # 찾은 선수 카드가 화면에 오게 (목록이 첫 화면 아래에 있습니다)
        # 찾은 선수 카드가 화면 가운데에 오게 (위 카드가 잘려 보이지 않게)
        settle(page, 700)
        page.screenshot(path=os.path.join(OUT, "screenshot-1-matching.png"))
        shots.append("screenshot-1-matching.png")

        # 2) 1:1 채팅 (대화방)
        page.evaluate("() => { location.hash = '#/log'; }")
        settle(page, 600)
        page.click("#hdrChat")
        settle(page, 800)
        room = page.query_selector("[data-thread]")
        if room:
            room.click()
            settle(page, 900)
            page.evaluate("""() => {
              const box = document.querySelector('.dm__msgs, .dm__body, #dm');
              if (box) box.scrollTop = box.scrollHeight;
            }""")
            settle(page, 400)
        page.screenshot(path=os.path.join(OUT, "screenshot-2-chat.png"))
        shots.append("screenshot-2-chat.png")

        # 3) 일지 & AI — 오늘 일지를 저장해 분석 카드(파트너별 승률 포함)
        page.goto(f"{BASE}index.html#/log", wait_until="load")
        app_ready(page)
        settle(page, 800)
        close_sheets(page)
        page.evaluate("""() => {
          const st = BM.app.ctx.store, U = BM.util;
          st.actions.setDraft({ date: U.ymd(), cond: 6, intensity: 6, minutes: 70,
            done: ['게임', '풋워크'], weakness: ['헤어핀'], games: [{ a: 21, b: 17 }],
            partner: '민호', gameMode: 21 });
        }""")
        btn = page.query_selector("[data-act='save-log']")
        if btn:
            btn.scroll_into_view_if_needed()
            btn.click()
            settle(page, 1300)
        page.evaluate("""() => {
          const el = document.querySelector('[data-region="analysis"]') || document.querySelector('[data-form="log"]');
          if (el) el.scrollIntoView({ block: 'start' });
        }""")
        settle(page, 700)
        page.screenshot(path=os.path.join(OUT, "screenshot-3-ai.png"))
        shots.append("screenshot-3-ai.png")

        # 4) MY — 하트 카드(7일 연속 보너스 안내)가 첫 화면에 오게
        page.evaluate("() => { location.hash = '#/my'; }")
        settle(page, 900)
        # 앱은 머리(헤더)를 고정하고 본문을 스크롤합니다 — 실제 손가락처럼 휠로 내립니다
        page.mouse.move(200, 500)
        page.mouse.wheel(0, 520)
        settle(page, 800)
        page.screenshot(path=os.path.join(OUT, "screenshot-4-my.png"))
        shots.append("screenshot-4-my.png")

        ctx.close()
        browser.close()

    for s in shots:
        path = os.path.join(OUT, s)
        print(s, os.path.getsize(path) // 1024, "KB")


if __name__ == "__main__":
    main()
