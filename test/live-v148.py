"""bm-v1.48.0 라이브 점검 — 게스트 모집 날짜·시간 고르기 · 단체방 삭제 · 코트 점수판 가로 보기.

· 배포본(https://csw42060713-byte.github.io/badminton/)을 390×844 와 844×390 으로 열어 확인합니다.
· 로그인 없이 체험(기기 저장) 모드로만 움직입니다 → Supabase에 아무것도 쓰지 않습니다.
· 실행:
  LD_LIBRARY_PATH=/workspace/tmp/deblibs/usr/lib/x86_64-linux-gnu:/workspace/tmp/deblibs2/usr/lib/x86_64-linux-gnu:/workspace/tmp/deblibs2/lib/x86_64-linux-gnu python3 test/live-v148.py
"""

import time
import urllib.request

from playwright.sync_api import sync_playwright

BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'
checks, errs, csp, blocked = [], [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:240]) if extra else ''))
    checks.append((label, bool(cond)))


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    return urllib.request.urlopen(req, timeout=30).read().decode('utf-8', 'replace')


def text_of(page, sel):
    return page.evaluate("(s) => { const n = document.querySelector(s); return n ? n.innerText : ''; }", sel)


def val_of(page, sel):
    return page.evaluate("(s) => { const n = document.querySelector(s); return n ? n.value : ''; }", sel)


def has(page, sel):
    return page.evaluate("(s) => !!document.querySelector(s)", sel)


def count(page, sel):
    return page.evaluate("(s) => document.querySelectorAll(s).length", sel)


def toast(page):
    return text_of(page, '#toast')


def overflow(page):
    return page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")


def watch(page):
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


def boot(page):
    page.goto(BASE + 'index.html?l=' + str(int(time.time())), wait_until='load')
    page.wait_for_timeout(2000)
    page.evaluate("() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} }")
    page.reload(wait_until='load')
    page.wait_for_timeout(2600)
    if page.query_selector('[data-act="guest"]'):
        page.click('[data-act="guest"]')
        page.wait_for_timeout(2200)
    for _ in range(6):
        if not page.query_selector('#sheet.is-on .sheet__panel .btn--primary'):
            break
        page.click('#sheet.is-on .sheet__panel .btn--primary')
        page.wait_for_timeout(400)


# ---------- 배포본 파일부터 확인 (버전·캐시 키·새 코드) ----------
stamp = '?l=' + str(int(time.time()))
sw = get(BASE + 'sw.js' + stamp)
index = get(BASE + 'index.html' + stamp)
app = get(BASE + 'app.js' + stamp)
domain = get(BASE + 'js/domain.js' + stamp)
comm = get(BASE + 'js/views/community.js' + stamp)
chat = get(BASE + 'js/views/chat.js' + stamp)
logjs = get(BASE + 'js/views/log.js' + stamp)
css = get(BASE + 'styles.css' + stamp)
twa = get(BASE + 'twa-manifest.json' + stamp)

check('sw.js bm-v1.48.0', "var VERSION = 'bm-v1.48.0'" in sw,
      (sw.split('var VERSION')[1][:40] if 'var VERSION' in sw else sw[:60]))
check('app.js v1.48.0', "version: 'v1.48.0'" in app)
check('index.html styles.css?v=20261122-60', 'styles.css?v=20261122-60' in index)
check('index.html CSP 유지', "object-src 'none'" in index and "base-uri 'none'" in index)
check('TWA 1.48.0 · 코드 40', '"appVersionName": "1.48.0"' in twa and '"appVersionCode": 40' in twa)
check('domain.js 일시 고르기', 'function whenCompose' in domain and 'function whenParse' in domain and 'quickTimes' in domain)
check('community.js 날짜·시간 칸', 'data-vitewhen="date"' in comm and 'data-vitetime-quick' in comm and 'function syncWhen' in comm)
check('chat.js 방 삭제', 'deleteGroupRoom' in chat and 'data-room-del' in chat and '방장이 단체방을 삭제했어요' in chat)
check('log.js 가로 보기', 'data-sb-rotate' in logjs and 'screen.orientation' in logjs and 'is-qrot' in logjs)
check('styles.css 가로 배치·회전', '@media (orientation: landscape)' in css and 'rotate(90deg)' in css and '.sbfull__rot' in css)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    page = ctx.new_page()
    watch(page)
    boot(page)

    check('앱 버전 v1.48.0', page.evaluate("() => BM.app.version") == 'v1.48.0', page.evaluate("() => BM.app.version"))

    # ---------- A. 게스트 모집 날짜·시간 고르기 ----------
    page.click("#tabbar [data-tab='community']")
    page.wait_for_timeout(800)
    page.click('[data-topic="게스트 모집"]')
    page.wait_for_timeout(600)
    check('모집 칸이 열림', has(page, '[data-vitewhenbox]'))
    check('날짜·시간 칸 3개', count(page, '[data-vitewhen]') == 3, count(page, '[data-vitewhen]'))
    check('날짜 칩 3개', count(page, '[data-viteday-quick]') == 3, count(page, '[data-viteday-quick]'))
    check('시간 칩 3개', count(page, '[data-vitetime-quick]') == 3, count(page, '[data-vitetime-quick]'))
    today = page.evaluate("() => BM.util.ymd()")
    check('달력 칸 기본값 = 오늘', val_of(page, '[data-vitewhen="date"]') == today, val_of(page, '[data-vitewhen="date"]'))

    page.click('[data-viteday-quick] >> nth=1')
    page.wait_for_timeout(300)
    page.click('[data-vitetime-quick="19:00~21:00"]')
    page.wait_for_timeout(500)
    when = val_of(page, '[data-vitefield="when"]')
    expect = page.evaluate("""() => {
      const d = BM.util.addDays(new Date(), 1);
      return BM.domain.meetWhen.compose(BM.util.ymd(d), '19:00', '21:00');
    }""")
    check('내일 + 19:00~21:00 → 글자 한 줄', when == expect, (when, expect))
    check('시작·끝 칸도 채워짐', val_of(page, '[data-vitewhen="start"]') == '19:00'
          and val_of(page, '[data-vitewhen="end"]') == '21:00')
    page.screenshot(path=OUT + '/v148_01_모집_날짜시간_칩.png')

    target = page.evaluate("() => BM.util.ymd(BM.util.addDays(new Date(), 3))")
    page.fill('[data-vitewhen="date"]', target)
    page.wait_for_timeout(250)
    page.fill('[data-vitewhen="start"]', '20:00')
    page.wait_for_timeout(250)
    page.fill('[data-vitewhen="end"]', '22:00')
    page.wait_for_timeout(450)
    when2 = val_of(page, '[data-vitefield="when"]')
    expect2 = page.evaluate("(d) => BM.domain.meetWhen.compose(d, '20:00', '22:00')", target)
    check('달력·시간 칸 → 글자 한 줄', when2 == expect2, (when2, expect2))
    page.screenshot(path=OUT + '/v148_02_모집_달력시간_칸.png')

    page.fill('[data-composer]', '수요일 저녁 같이 쳐요')
    page.fill('[data-vitefield="cap"]', '4')
    page.click('[data-act="post"]')
    page.wait_for_timeout(1400)
    card = text_of(page, '.vite')
    check('올린 글 카드에 고른 일시', expect2 in card, card[:110])
    page.screenshot(path=OUT + '/v148_03_모집_올린카드.png')

    # ---------- B. 단체방 삭제 ----------
    me = page.evaluate("() => BM.app.ctx.store.state.me")
    rows = page.evaluate("""(me) => {
      const D = BM.domain, U = BM.util;
      const post = { id: 'room148', type: '소셜', createdAt: U.stamp(), date: U.ymd(),
        nick: me.nick || '나', text: '금요일 게스트 모집', userKey: me.key,
        plan: { topic: '게스트 모집', meet: { when: '11/23(월) 19:00~21:00', place: '영통 체육관', cap: '4' } } };
      const ok = { id: 'ok148', type: '게스트신청', createdAt: U.stamp(), date: U.ymd(),
        nick: me.nick || '나', userKey: me.key, target: 'u_guest148', team: 'room148',
        payload: { kind: '수락', nick: '게스트' } };
      const chatRow = { id: 'msg148', type: '매칭채팅', createdAt: U.stamp(), date: U.ymd(),
        nick: '게스트', userKey: 'u_guest148', target: '', team: 'room148', text: '안녕하세요! 금요일 가능해요' };
      return [D.toRow(post), D.toRow(ok), D.toRow(chatRow)];
    }""", me)
    page.evaluate("""(rows) => {
      const cur = JSON.parse(localStorage.getItem('bm_rows_v1') || '[]');
      localStorage.setItem('bm_rows_v1', JSON.stringify(rows.concat(cur)));
    }""", rows)
    page.reload(wait_until='load')
    page.wait_for_timeout(2800)
    page.evaluate("() => BM.app.ctx.actions.openChats()")
    page.wait_for_timeout(900)
    check('대화 목록에 내 단체방', has(page, '[data-thread="room148"]'))
    check('글쓴이에게만 삭제 버튼', has(page, '[data-room-del="room148"]'))
    page.screenshot(path=OUT + '/v148_04_채팅목록_방삭제버튼.png')
    page.click('[data-room-del="room148"]')
    page.wait_for_timeout(700)
    check('목록 안 2단계 확인', has(page, '[data-roomdel-bar]'))
    check('확인 문구에 모집 글 안내', '모집 글도 함께' in text_of(page, '[data-roomdel-bar]'))
    page.screenshot(path=OUT + '/v148_05_채팅목록_삭제확인.png')
    page.click('[data-roomdel-no]')
    page.wait_for_timeout(500)
    check('그대로 두기 → 확인 닫힘', not has(page, '[data-roomdel-bar]'))

    page.click('[data-thread="room148"]')
    page.wait_for_timeout(900)
    check('단체방 화면', has(page, '[data-vite-end="room148"]'))
    check('헤더 버튼 이름 = 방 삭제', '방 삭제' in text_of(page, '[data-vite-end="room148"]'))
    page.screenshot(path=OUT + '/v148_06_단체방_헤더.png')
    page.click('[data-vite-end="room148"]')
    page.wait_for_timeout(600)
    check('방 안 확인 바', has(page, '[data-leavebar]'))
    page.screenshot(path=OUT + '/v148_07_단체방_삭제확인.png')
    page.click('[data-act="leave-yes"][data-leave-kind="end"]')
    page.wait_for_timeout(1300)
    check('삭제 토스트', '단체방을 삭제했어요' in toast(page), toast(page))
    check('목록에서 사라짐', not has(page, '[data-thread="room148"]'))
    check('모집 글도 사라짐', page.evaluate("() => !BM.app.ctx.store.state.idx.byId['room148']"))
    page.screenshot(path=OUT + '/v148_08_삭제후_목록.png')
    if has(page, '[data-dm-close]'):
        page.click('[data-dm-close]')
        page.wait_for_timeout(500)

    # ---------- B-2. 참여자 화면 — 방장이 지운 방 ----------
    page.evaluate("""(me) => {
      const D = BM.domain, U = BM.util;
      const post = { id: 'roomG148', type: '소셜', createdAt: U.stamp(), date: U.ymd(),
        nick: '방장', text: '게스트 모집', userKey: 'u_owner148g',
        plan: { topic: '게스트 모집', meet: { when: '11/23(월) 19:00~21:00', place: '영통 체육관', cap: '4' } } };
      const app = { id: 'ga1', type: '게스트신청', createdAt: U.stamp(), date: U.ymd(),
        nick: me.nick, userKey: me.key, target: 'u_owner148g', team: 'roomG148',
        payload: { kind: '신청', note: '가고 싶어요' } };
      const ok = { id: 'ga2', type: '게스트신청', createdAt: U.stamp(), date: U.ymd(),
        nick: '방장', userKey: 'u_owner148g', target: me.key, team: 'roomG148', payload: { kind: '수락' } };
      const msg = { id: 'gm1', type: '매칭채팅', createdAt: U.stamp(), date: U.ymd(),
        nick: '방장', userKey: 'u_owner148g', target: '', team: 'roomG148', text: '안녕하세요' };
      const rows = [D.toRow(post), D.toRow(app), D.toRow(ok), D.toRow(msg)];
      const cur = JSON.parse(localStorage.getItem('bm_rows_v1') || '[]');
      localStorage.setItem('bm_rows_v1', JSON.stringify(rows.concat(cur)));
    }""", me)
    page.reload(wait_until='load')
    page.wait_for_timeout(2600)
    page.evaluate("() => BM.app.ctx.actions.openChats()")
    page.wait_for_timeout(900)
    check('참여자 목록에 방장의 단체방', has(page, '[data-thread="roomG148"]'))
    check('참여자에게는 삭제 버튼 없음', not has(page, '[data-room-del="roomG148"]'))
    page.click('[data-thread="roomG148"]')
    page.wait_for_timeout(900)
    check('참여자 방 화면(입력창 있음)', has(page, '[data-dm-form]'))
    page.evaluate("""async () => {
      await BM.app.ctx.actions._api().remove('roomG148', '');
      await BM.app.ctx.actions.poll();
    }""")
    page.wait_for_timeout(1400)
    check('열어 둔 방이 삭제 안내로 바뀜', '방장이 단체방을 삭제했어요' in text_of(page, '.dm__panel'))
    check('삭제 안내에는 입력창 없음', not has(page, '[data-dm-form]'))
    page.screenshot(path=OUT + '/v148_14_참여자_삭제안내.png')
    page.click('[data-dm-back]')
    page.wait_for_timeout(700)
    check('대화 목록에서도 사라짐', not has(page, '[data-thread="roomG148"]'))
    if has(page, '[data-dm-close]'):
        page.click('[data-dm-close]')
        page.wait_for_timeout(400)

    # ---------- C-1. 점수판 (세로 → 가로 보기) ----------
    page.click("#tabbar [data-tab='log']")
    page.wait_for_timeout(900)
    page.click('[data-act="open-scoreboard"]')
    page.wait_for_timeout(1000)
    check('점수판 열림(세로)', has(page, '[data-sb-view="port"]'))
    check('가로 보기 버튼', has(page, '[data-sb-rotate]'))
    page.screenshot(path=OUT + '/v148_09_점수판_세로.png')
    page.click('[data-sb-rotate]')
    page.wait_for_timeout(900)
    check('가로 보기 클래스', 'is-land' in page.evaluate("() => document.querySelector('#sbfull').className"))
    check('세로 화면에서는 CSS 90도 회전', page.evaluate("() => document.querySelector('#sbfull').classList.contains('is-qrot')"))
    box = page.evaluate("() => { const r = document.querySelector('#sbfull').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), innerWidth, innerHeight]; }")
    check('회전해도 화면을 꽉 채움', abs(box[0] - box[2]) < 3 and abs(box[1] - box[3]) < 3, box)
    check('가로 배치(2열)', page.evaluate(
        "() => getComputedStyle(document.querySelector('.sb__board')).gridTemplateColumns.split(' ').length") == 2)
    page.screenshot(path=OUT + '/v148_10_점수판_가로보기.png')
    page.click('[data-sb-point="a"]')
    page.wait_for_timeout(300)
    page.click('[data-sb-point="a"]')
    page.wait_for_timeout(300)
    page.click('[data-sb-point="b"]')
    page.wait_for_timeout(400)
    nums = page.evaluate("""() => Array.from(document.querySelectorAll('[data-sb-point]'))
        .map(n => n.getAttribute('data-sb-point') + ':' + n.querySelector('.sb__num').textContent)""")
    check('가로에서 +1 (내 2 · 상대 1)', nums == ['a:2', 'b:1'], nums)
    page.click('[data-sb-undo]')
    page.wait_for_timeout(400)
    nums = page.evaluate("""() => Array.from(document.querySelectorAll('[data-sb-point]'))
        .map(n => n.getAttribute('data-sb-point') + ':' + n.querySelector('.sb__num').textContent)""")
    check('가로에서 -1', nums == ['a:2', 'b:0'], nums)
    page.click('[data-sb-swap]')
    page.wait_for_timeout(400)
    order = page.evaluate("""() => Array.from(document.querySelectorAll('[data-sb-point]')).map(n => n.getAttribute('data-sb-point'))""")
    check('코트 교대', order == ['b', 'a'], order)
    page.click('[data-sb-reset]')
    page.wait_for_timeout(400)
    nums = page.evaluate("""() => Array.from(document.querySelectorAll('[data-sb-point]'))
        .map(n => n.getAttribute('data-sb-point') + ':' + n.querySelector('.sb__num').textContent)""")
    check('세트 초기화', nums == ['b:0', 'a:0'], nums)
    page.screenshot(path=OUT + '/v148_11_점수판_가로_점수.png')
    check('버튼 이름이 세로 보기로', '세로 보기' in text_of(page, '[data-sb-rotate]'))
    page.click('[data-sb-rotate]')
    page.wait_for_timeout(700)
    check('세로 보기로 돌아옴', not page.evaluate("() => document.querySelector('#sbfull').classList.contains('is-land')"))
    page.click('[data-sb-close]')
    page.wait_for_timeout(700)
    check('점수판 닫힘', not has(page, '#sbfull'))

    for tab in ['log', 'matching', 'community', 'coach', 'my']:
        page.click("#tabbar [data-tab='%s']" % tab)
        page.wait_for_timeout(700)
        body = text_of(page, '[data-view]')
        check('탭 %s 정상' % tab, len(body) > 40 and 'undefined' not in body, body[:40].replace('\n', ' '))

    check('세로 콘솔 오류 0건', len(errs) == 0, errs[:2])
    check('세로 CSP 위반 0건', len(csp) == 0, csp[:2])
    ov = overflow(page)
    check('세로 가로 넘침 없음', ov[0] <= ov[1] + 1, ov)
    ctx.close()

    # ---------- C-2. 기기 가로 844×390 ----------
    land = b.new_context(viewport={'width': 844, 'height': 390}, device_scale_factor=2,
                         is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    lp = land.new_page()
    watch(lp)
    boot(lp)
    lp.click("#tabbar [data-tab='log']")
    lp.wait_for_timeout(800)
    lp.click('[data-act="open-scoreboard"]')
    lp.wait_for_timeout(1000)
    check('가로 기기: 자동 가로 배치', lp.evaluate("() => document.querySelector('#sbfull').classList.contains('is-land')"))
    check('가로 기기: 회전 없이 그대로', not lp.evaluate("() => document.querySelector('#sbfull').classList.contains('is-qrot')"))
    check('가로 기기: 2열', lp.evaluate(
        "() => getComputedStyle(document.querySelector('.sb__board')).gridTemplateColumns.split(' ').length") == 2)
    geo = lp.evaluate("""() => {
      const a = document.querySelector('[data-sb-point="a"]').getBoundingClientRect();
      const b = document.querySelector('[data-sb-point="b"]').getBoundingClientRect();
      const num = parseFloat(getComputedStyle(document.querySelector('[data-sb-point="a"] .sb__num')).fontSize);
      return { ax: a.x, ay: a.y, bx: b.x, by: b.y, ah: a.height, num: num, vh: innerHeight };
    }""")
    check('가로 기기: 내 팀이 왼쪽', geo['ax'] < geo['bx'] and abs(geo['ay'] - geo['by']) < 4, geo)
    check('가로 기기: 점수 숫자가 큼', geo['num'] >= 60, geo['num'])
    lp.screenshot(path=OUT + '/v148_12_가로기기_점수판.png')
    lp.click('[data-sb-point="b"]')
    lp.wait_for_timeout(300)
    lp.click('[data-sb-point="a"]')
    lp.wait_for_timeout(400)
    nums = lp.evaluate("""() => Array.from(document.querySelectorAll('[data-sb-point]'))
        .map(n => n.getAttribute('data-sb-point') + ':' + n.querySelector('.sb__num').textContent)""")
    check('가로 기기: +1 동작', nums == ['a:1', 'b:1'], nums)
    lp.screenshot(path=OUT + '/v148_13_가로기기_점수.png')
    ov = overflow(lp)
    check('가로 가로 넘침 없음', ov[0] <= ov[1] + 1, ov)
    check('가로 콘솔 오류 0건', len(errs) == 0, errs[:2])
    check('가로 CSP 위반 0건', len(csp) == 0, csp[:2])
    land.close()
    b.close()

ok = sum(1 for _, c in checks if c)
print('\n%d/%d 통과' % (ok, len(checks)))
if ok != len(checks):
    for label, c in checks:
        if not c:
            print('  FAIL ' + label)
    raise SystemExit(1)
