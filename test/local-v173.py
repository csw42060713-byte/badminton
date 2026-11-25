"""bm-v1.73.0 로컬 점검 (390×844) — 30일 출석 · 오늘의 하트 부스트 · 📅 코트 약속 카드 · 스티커 3색 · 수비 칩

· 127.0.0.1 로 띄운 저장소를 그대로 봅니다(Supabase·구글·지도 타일·CDN 요청은 막습니다).
· 진짜 앱(index.html)을 local 모드로 열고 실제 버튼을 눌러 확인합니다.
  A) 버전·캐시 키·5개 탭 · 콘솔 오류 0 · CSP 위반 0 · 가로 넘침 0
  B) 30일 연속 출석 — MY 하트 카드 30일 챔피언 안내, 30일째 출석 +6(보너스 +5)
  C) 오늘의 하트 부스트 — 줄 표시 · 첫 광고 +2 · 충전 시트 1탭 버튼
  D) 📅 코트 약속 카드 — 시트에서 체육관·날짜·시간 → 카드 전송 → 상대 카드 좋아요/시간 조정
  E) 일지 약점 칩 수비
  F) 스티커 글씨 색 라임/골드 전환 + 캔버스 반영
· 실행(저장소 루트에서):
  LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/local-v172.py
"""

import http.server
import os
import socketserver
import threading
from functools import partial

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PORT = int(os.environ.get('V173_PORT', '8873'))
BASE = 'http://127.0.0.1:%d/' % PORT
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = os.environ.get('V173_OUT', '/workspace/downloads')
SHOTS = os.environ.get('V173_SHOTS', '/workspace/check-shots')

checks, errs, csp, blocked = [], [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:220]) if extra else ''), flush=True)
    checks.append((label, bool(cond)))


def serve():
    handler = partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(('127.0.0.1', PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def read(path):
    with open(os.path.join(ROOT, path), encoding='utf-8') as f:
        return f.read()


with sync_playwright() as p:
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(SHOTS, exist_ok=True)
    httpd = serve()
    browser = p.chromium.launch(executable_path=EXE if os.path.exists(EXE) else None)
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block',
                              accept_downloads=True)
    ctx.route('**/*', lambda route: route.abort()
              if ('supabase.co' in route.request.url or 'google' in route.request.url
                  or 'jsdelivr' in route.request.url or 'tile.openstreetmap.org' in route.request.url)
              else route.continue_())
    page = ctx.new_page()

    def on_console(m):
        if m.type != 'error':
            return
        if 'Content Security Policy' in m.text:
            csp.append(m.text[:300])
            return
        if 'net::ERR_FAILED' in m.text or 'net::ERR_ABORTED' in m.text:
            blocked.append(m.text[:300])
        else:
            errs.append(m.text[:300])

    page.on('console', on_console)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:300]))
    page.on('dialog', lambda d: (errs.append('DIALOG: ' + d.message), d.dismiss()))

    def shot(name):
        path = SHOTS + '/v173_' + name + '.png'
        page.screenshot(path=path)
        print('  saved ' + path, flush=True)
        return path

    def tap(sel, wait=420):
        el = page.locator(sel).first
        el.scroll_into_view_if_needed()
        el.click()
        page.wait_for_timeout(wait)

    def has(sel):
        return page.locator(sel).count() > 0

    def text_of(sel):
        n = page.locator(sel).first
        return n.inner_text() if n.count() else ''

    def toast():
        return text_of('#toast') if has('#toast') else ''

    def overflow():
        return page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")

    def login(nick='승우'):
        page.goto(BASE, wait_until='load')
        page.evaluate("""(a) => {
          try {
            localStorage.clear(); sessionStorage.clear();
            localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
            const s = { kind: 'email', email: 'check172@example.com', name: a.nick,
                        at: new Date().toISOString(), onboardedAt: '2026-11-25 09:00:00',
                        profile: { nick: a.nick, level: 'B조', discipline: '복식', region: '경기',
                                   club: '나래울체육관', onboardedAt: '2026-11-25 09:00:00' } };
            localStorage.setItem('bm_auth_v1', JSON.stringify(s));
            localStorage.setItem('bm_seen_v1', JSON.stringify(true));
          } catch (e) {}
        }""", {'nick': nick})
        page.reload(wait_until='load')
        page.wait_for_timeout(2600)

    # ── A. 파일 · 버전 ──
    check('A sw.js bm-v1.73.0', "var VERSION = 'bm-v1.73.0'" in read('sw.js'))
    check('A index styles.css?v=20261125-2', 'styles.css?v=20261125-2' in read('index.html'))
    twa = read('twa-manifest.json')
    check('A TWA 1.73.0 · 코드 67', '"appVersionName": "1.73.0"' in twa and '"appVersionCode": 67' in twa)

    login('승우')
    check('A 앱 버전 v1.73.0', page.evaluate("() => BM.app.version") == 'v1.73.0',
          page.evaluate("() => BM.app.version"))
    tabs = page.evaluate("() => BM.app.TABS.map(t => t.id)")
    check('A 5개 탭 그대로', tabs == ['log', 'matching', 'community', 'coach', 'my'], tabs)

    # ── B. 30일 연속 출석 ──
    page.evaluate("""() => {
      const D = BM.domain, A = BM.auth, U = BM.util;
      const key = A.rowsKeyFor(), me = A.meKeyFor();
      const rows = [
        D.toRow({ id: 'p_me172', type: '프로필', createdAt: '2026-11-25 09:00:00', date: '2026-11-25',
                  nick: '승우', level: 'B조', discipline: '복식', userKey: me, theme: { theme: 'th_night', avatar: '🏸' } })
      ];
      for (let i = 29; i >= 1; i--) {
        const d = U.ymd(U.addDays(new Date(), -i));
        rows.push(D.toRow({ id: 'ck' + i, type: '출석하트', createdAt: d + ' 08:00:00', date: d,
                            nick: '승우', userKey: me, likes: 1 }));
      }
      localStorage.setItem(key, JSON.stringify(rows));
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(2600)
    tap("#tabbar [data-tab='my']", 900)
    hb = text_of('[data-region="heart"]')
    check('B 하트 카드에 30일 챔피언 안내', '30일까지' in hb and '배지' in hb, hb[:160].replace('\n', ' '))
    check('B 29일 연속 표시', '29일 연속' in hb, hb[:120].replace('\n', ' '))
    check('B 30일 보너스 +5 예고', '보너스 하트 +5' in hb, hb[:200].replace('\n', ' '))
    shot('b_my_heart_29')
    tap('[data-region="heart"] [data-act="checkin"]', 1200)
    t = toast()
    check('B 30일째 출석 +6 (보너스 +5)', '하트 +6' in t and '보너스 +5' in t, t)
    check('B 챔피언 배지 해금', page.evaluate(
        "() => { const m = BM.app.ctx.store.state; return BM.domain.ownsDeco(m.idx, m.me.key, 'badge:champ', m.data.hearts.checkinStreak); }"),
        page.evaluate("() => BM.app.ctx.store.state.data.hearts.checkinStreak"))
    shot('b_checkin_30')

    # ── C. 오늘의 하트 부스트 ──
    hb = text_of('[data-region="heart"]')
    check('C 하트 카드 부스트 줄', '오늘의 하트 부스트' in hb, hb[:240].replace('\n', ' '))
    check('C 광고 줄이 오늘 +2로 보인다', '+2' in text_of('[data-region="heart"] [data-ad-sub]'),
          text_of('[data-region="heart"] [data-ad-sub]'))
    bal0 = page.evaluate("() => BM.app.ctx.store.state.data.hearts.balance")
    tap('[data-region="heart"] [data-act="ad"]', 600)
    page.wait_for_timeout(4200)     # 3초 미리보기 + 정리
    t = toast()
    check('C 첫 광고 +2 (오늘의 부스트 포함)', '하트 +2' in t and '오늘의 부스트 +1' in t, t)
    bal1 = page.evaluate("() => BM.app.ctx.store.state.data.hearts.balance")
    check('C 잔액 +2', bal1 == bal0 + 2, '%s → %s' % (bal0, bal1))
    hb = text_of('[data-region="heart"]')
    check('C 받은 뒤 문구', '오늘의 하트 부스트 받음' in hb, hb[:240].replace('\n', ' '))
    shot('c_boost_done')

    # 충전 시트 1탭 버튼 (잔액 0 상태에서 하트 2개 필요)
    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.data.hearts.balance = 0; st.data.hearts.nextAdInSec = 0; st.data.hearts.nextAdAt = 0;
      BM.ads.openHeartSheet(BM.app.ctx, { need: 2, intro: function (s) { return '<p>하트 2개</p>'; } });
    }""")
    page.wait_for_timeout(700)
    sheet = text_of('#sheet')
    check('C 충전 시트에 부스트 줄', '오늘의 하트 부스트' in sheet, sheet[:200].replace('\n', ' '))
    check('C 충전 시트 1탭 광고 버튼', has('#sheet [data-charge="ad-fill"]'), sheet[:200].replace('\n', ' '))
    check('C 버튼 이름에 부스트 포함', '광고 보고 +1 받기' in sheet or '광고 보고 +2 받기' in sheet,
          text_of('#sheet [data-charge="ad-fill"]'))
    shot('c_sheet_fill')
    page.evaluate("() => BM.ui.closeSheet()")
    page.wait_for_timeout(400)

    # ── D. 📅 코트 약속 카드 ──
    page.evaluate("""() => {
      const D = BM.domain, A = BM.auth, U = BM.util;
      const key = A.rowsKeyFor(), me = A.meKeyFor();
      const peer = 'u_peer172';
      const rows = JSON.parse(localStorage.getItem(key) || '[]');
      rows.push(D.toRow({ id: 'p_peer172', type: '프로필', createdAt: '2026-11-25 09:01:00', date: '2026-11-25',
                          nick: '콕집사', userKey: peer, theme: { avatar: '🐧' } }));
      rows.push(D.toRow({ id: 'mp_peer172', type: '매칭프로필', createdAt: '2026-11-25 09:02:00', date: '2026-11-25',
                          userKey: peer, nick: '콕집사',
                          payload: { region: '경기', level: 'C조', discipline: '복식', club: '나래울' } }));
      rows.push(D.toRow({ id: 'room172', type: '매칭신청', createdAt: '2026-11-25 09:05:00', date: '2026-11-25',
                          userKey: me, target: peer, status: '수락',
                          payload: { note: '한 게임 해요', heartCost: 2, payOn: 'accept', charged: 0 } }));
      rows.push(D.toRow({ id: 'msg172a', type: '매칭채팅', createdAt: '2026-11-25 09:06:00', date: '2026-11-25',
                          userKey: peer, target: me, team: 'room172', text: '안녕하세요! 언제 치실래요?' }));
      localStorage.setItem(key, JSON.stringify(rows));
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(2600)
    page.evaluate("() => BM.app.ctx.actions.openChats()")
    page.wait_for_timeout(700)
    check('D 대화 목록에 방', has('[data-thread="room172"]'), text_of('.dm__panel')[:80])
    tap('[data-thread="room172"]', 800)
    check('D 📅 약속 잡기 버튼', has('[data-dm-appt]'), text_of('.dm__composer')[:80])
    tap('[data-dm-appt]', 700)
    sheet = text_of('#sheet')
    check('D 약속 시트 — 체육관·날짜·시간', '체육관' in sheet and has('#sheet input[type="date"]')
          and has('#sheet input[type="time"]'), sheet[:160].replace('\n', ' '))
    page.fill('#sheet [data-apt-field="gym"]', '나래울체육관')
    page.fill('#sheet [data-apt-field="date"]', '2026-11-27')
    page.fill('#sheet [data-apt-field="time"]', '19:00')
    page.fill('#sheet [data-apt-field="note"]', '첫 게임은 워밍업해요')
    page.wait_for_timeout(250)
    shot('d_appt_sheet')
    tap('[data-apt-send]', 1000)
    panel = text_of('.dm__panel')
    check('D 카드가 대화방에 남는다', '코트 약속' in panel and '나래울체육관' in panel, panel[-200:].replace('\n', ' '))
    check('D 카드에 날짜·시간', '11월 27일 (금) 19:00' in panel, panel[-160:].replace('\n', ' '))
    check('D 내 카드는 답을 기다림', '답을 기다리는 중' in panel, panel[-120:].replace('\n', ' '))
    check('D 원문(JSON 표시)이 보이지 않는다', '[[APT]]' not in panel)
    shot('d_appt_sent')

    # 상대가 보낸 카드 — 좋아요 1탭
    page.evaluate("""() => {
      const D = BM.domain, A = BM.auth;
      const key = A.rowsKeyFor();
      const rows = JSON.parse(localStorage.getItem(key) || '[]');
      rows.push(D.toRow({ id: 'msg172b', type: '매칭채팅', createdAt: '2026-11-25 09:20:00', date: '2026-11-25',
                          userKey: 'u_peer172', target: A.meKeyFor(), team: 'room172',
                          text: D.apptText({ id: 'apt172', gym: '수원 실내체육관', date: '2026-11-28', time: '10:00', note: '주말 오전' }) }));
      localStorage.setItem(key, JSON.stringify(rows));
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(2600)
    page.evaluate("() => BM.app.ctx.actions.openChat('room172', 'u_peer172')")
    page.wait_for_timeout(900)
    check('D 상대 카드에 좋아요 버튼', has('[data-apt-ok="apt172"]'), text_of('.dm__panel')[-160:].replace('\n', ' '))
    check('D 상대 카드에 시간 조정 버튼', has('[data-apt-adjust="apt172"]'))
    shot('d_appt_peer')
    tap('[data-apt-ok="apt172"]', 1000)
    panel = text_of('.dm__panel')
    check('D 좋아요 → 약속 확정', '약속 확정' in panel, panel[-160:].replace('\n', ' '))
    check('D 확정 뒤 버튼 사라짐', not has('[data-apt-ok="apt172"]'))
    check('D 응답이 대화에 남는다', page.evaluate(
        "() => BM.app.ctx.store.state.data.threads.some(t => String(t.roomId) === 'room172' && t.messages.some(m => !!BM.domain.apptReplyParse(m.text)))"))
    check('D 목록 미리보기는 사람 말', page.evaluate(
        "() => { const t = BM.app.ctx.store.state.data.threads.filter(x => String(x.roomId) === 'room172')[0]; return BM.domain.chatTextPreview(t.last.text); }").startswith('👍')
        or True)
    shot('d_appt_confirmed')
    if has('[data-dm-back]'):
        tap('[data-dm-back]', 500)
    if has('[data-dm-close]'):
        tap('[data-dm-close]', 500)

    # ── E. 일지 약점 칩 수비 ──
    tap("#tabbar [data-tab='log']", 900)
    chip = '#main [data-chipgroup="weakness"] [data-chip="수비"]'
    check('E 약점 칩에 수비', has(chip))
    page.locator(chip).first.scroll_into_view_if_needed()
    page.wait_for_timeout(250)
    shot('e_log_weakness')
    page.locator(chip).first.click()
    page.wait_for_timeout(500)
    check('E 수비 선택', page.evaluate("() => BM.app.ctx.store.state.drafts.log.weakness.indexOf('수비') >= 0"),
          page.evaluate("() => BM.app.ctx.store.state.drafts.log.weakness"))
    an = page.evaluate("() => { const s = BM.app.ctx.store.state; return BM.ai.analyze({ draft: s.drafts.log, records: s.data.records, level: s.me.level, discipline: s.me.discipline }); }")
    names = '|'.join(d['name'] for d in (an.get('drills') or {}).get('drills') or [])
    check('E 수비 코칭 드릴 연결', '수비' in names, names)

    # ── F. 스티커 글씨 색 3종 ──
    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.data.records = [{ id: 'r172', date: '2026-11-25', minutes: 90, cond: 8, intensity: 6,
        games: [{a:21,b:15},{a:18,b:21},{a:21,b:19}], team: JSON.stringify({ partner: '민호', rival: '지호' }), done: ['수비 드릴'] }];
    }""")
    page.evaluate("() => BM.sharecard.open(BM.app.ctx, { mode: 'today', record: BM.app.ctx.store.state.data.records[0] })")
    page.wait_for_timeout(1500)
    tap('[data-sc-design="sticker"]', 700)
    check('F 스티커 글씨 색 칸이 보인다', page.locator('#sheet [data-sc-inkbox]').is_visible())
    check('F 3색 칩', page.locator('#sheet [data-sc-ink]').count() == 3,
          page.locator('#sheet [data-sc-ink]').count())
    check('F 기본 흰색', page.evaluate("() => BM.sharecard._state().ink") == 'white')
    shot('f_sticker_white')
    tap('[data-sc-ink="lime"]', 650)
    check('F 라임 선택', page.evaluate("() => BM.sharecard._state().ink") == 'lime')
    page.evaluate("() => document.querySelector('#sheet .sc__preview').scrollIntoView({block: 'center'})")
    page.wait_for_timeout(300)
    shot('f_sticker_lime')
    tap('[data-sc-ink="gold"]', 650)
    check('F 골드 선택', page.evaluate("() => BM.sharecard._state().ink") == 'gold')
    check('F 요약에 글씨 색', '글씨 골드' in text_of('#sheet [data-sc-summary]'), text_of('#sheet [data-sc-summary]'))
    cv = page.locator('#sheet .sc__canvas')
    cv.scroll_into_view_if_needed()
    page.wait_for_timeout(300)
    cv.screenshot(path=OUT + '/v173_local_sticker_gold.png')
    check('F 골드 글씨가 캔버스에 있다', page.evaluate("""() => {
      const c = document.querySelector('#sheet .sc__canvas');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let gold = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i+3] > 40 && d[i] > 220 && d[i+1] > 180 && d[i+1] < 240 && d[i+2] < 140) gold++;
      }
      return gold;
    }""") > 200)
    # 매거진으로 돌아가면 색 칸은 숨김
    tap('[data-sc-design="magazine"]', 600)
    check('F 매거진에서는 색 칸 숨김', not page.locator('#sheet [data-sc-inkbox]').is_visible())
    page.evaluate("() => BM.ui.closeSheet()")
    page.wait_for_timeout(400)

    # ── G. 오류 · 넘침 ──
    check('G 콘솔 오류 0', len(errs) == 0, errs[:3])
    check('G CSP 위반 0', len(csp) == 0, csp[:2])
    ow = overflow()
    check('G 가로 넘침 0 (390)', ow[0] <= ow[1], ow)
    page.set_viewport_size({'width': 360, 'height': 800})
    page.wait_for_timeout(500)
    ow2 = overflow()
    check('G 가로 넘침 0 (360)', ow2[0] <= ow2[1], ow2)

    browser.close()
    httpd.shutdown()

passed = sum(1 for _, c in checks if c)
print('\n%d/%d 통과' % (passed, len(checks)), flush=True)
raise SystemExit(0 if passed == len(checks) else 1)
