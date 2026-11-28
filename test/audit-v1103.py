#!/usr/bin/env python3
"""bm-v1.103.0 — 앱 전체 오류 점검 + 새 AI 코칭 2건 화면 확인 (390×844 · has_touch)

  ① 로그인 전 화면(시작 · 이메일 로그인) — 콘솔 오류 0 · 가로 넘침 0 · 버튼 가림 0
  ② 로그인 후 5개 탭 + 설정 — 탭마다 JS 런타임 오류 · 콘솔 오류 · CSP 위반 · 가로 넘침 ·
     누를 수 없는(가려진) 버튼 0건
  ③ 일지 저장 → AI 분석 카드 → 심화 › 시합 당일 준비 › 강한 스매시 · 템포 정리 블록
  ④ 커스텀 라켓 3D — bm-v1.102.0 다회전 스핀·임팩트·소리에서 예외/멈춤이 없는지
  ⑤ 화면 캡처 → /workspace/downloads/v1103_*.png · v1103_report.json

  실행(로컬): LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/audit-v1103.py
  실행(라이브): TS_LIVE=1 LD_LIBRARY_PATH=... python3 test/audit-v1103.py
"""
import base64
import http.server
import json
import os
import socketserver
import threading
import time

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = '/workspace/downloads'
PORT = 8813
LIVE = os.environ.get('TS_LIVE', '') == '1'
LIVE_BASE = 'https://csw42060713-byte.github.io/badminton/'
BASE = (LIVE_BASE + 'index.html?c=%d' % int(time.time()) if LIVE
        else 'http://127.0.0.1:%d/index.html' % PORT)

console_errors = []      # (step, text) 실제 앱 오류
net_errors = []          # 로컬 점검에서 차단한 외부 요청(예상된 실패) — 앱 오류로 세지 않음
page_errors = []
csp_violations = []
checks = []


def check(name, ok, detail=''):
    checks.append({'name': name, 'ok': bool(ok), 'detail': str(detail)[:400]})
    print(('  ✓ ' if ok else '  ✗ ') + name + ((' · ' + str(detail)[:160]) if detail else ''), flush=True)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, *a):
        pass


httpd = None
if not LIVE:
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(('127.0.0.1', PORT), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

# ---------- 라이브 배포본 파일 확인 ----------
if LIVE:
    import urllib.request

    def _get(u):
        req = urllib.request.Request(u, headers={'Cache-Control': 'no-cache'})
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.read().decode('utf-8', 'replace')

    st = '?v=%d' % int(time.time())
    sw = _get(LIVE_BASE + 'sw.js' + st)
    appjs = _get(LIVE_BASE + 'app.js' + st)
    aijs = _get(LIVE_BASE + 'js/ai.js' + st)
    logjs = _get(LIVE_BASE + 'js/views/log.js' + st)
    twa = _get(LIVE_BASE + 'twa-manifest.json' + st)
    check('라이브 sw.js bm-v1.103.0', "var VERSION = 'bm-v1.103.0'" in sw)
    check('라이브 app.js v1.103.0', "version: 'v1.103.0'" in appjs)
    check('라이브 TWA 1.103.0 · 97', '"appVersionName": "1.103.0"' in twa and '"appVersionCode": 97' in twa)
    check('라이브 ai.js 새 코칭 2건', 'heavyBlock' in aijs and 'tempoBlock' in aijs and '강한 스매시 받아내기' in aijs)
    check('라이브 log.js 새 블록 렌더', 'data-heavy-smash' in logjs and 'data-tempo' in logjs)

with sync_playwright() as p:
    b = p.chromium.launch(args=['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    if not LIVE:
        ctx.route('**/*', lambda r: r.abort()
                  if ('supabase.co' in r.request.url or 'google' in r.request.url or 'jsdelivr' in r.request.url)
                  else r.continue_())
    pg = ctx.new_page()
    cdp = ctx.new_cdp_session(pg)
    step = {'name': 'init'}

    def on_console(m):
        txt = m.text or ''
        if 'Content Security Policy' in txt or 'Refused to' in txt:
            csp_violations.append((step['name'], txt))
        if m.type == 'error':
            if not LIVE and ('Failed to load resource' in txt or 'ERR_FAILED' in txt):
                net_errors.append((step['name'], txt))
                return
            console_errors.append((step['name'], txt))

    pg.on('console', on_console)
    pg.on('pageerror', lambda e: page_errors.append((step['name'], str(e))))

    def grab(name):
        r = cdp.send('Page.captureScreenshot', {'format': 'png', 'captureBeyondViewport': False})
        path = os.path.join(OUT, ('v1103_live_' if LIVE else '') + name + '.png')
        open(path, 'wb').write(base64.b64decode(r['data']))
        print('   saved', os.path.basename(path), flush=True)
        return path

    def overflow():
        return pg.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")

    def covered_buttons():
        """화면에 보이는 누를 것 중, 그 자리를 다른 요소가 덮고 있어 눌리지 않는 것.
        하단 탭바·상단 헤더처럼 늘 떠 있는 바는 내용을 스크롤해 가리는 게 정상이라 제외하고,
        pointer-events: none 이거나 같은 누를 것 안쪽인 경우도 통과시킵니다."""
        return pg.evaluate("""() => {
          const out = [];
          const vh = window.innerHeight, vw = window.innerWidth;
          function passesThrough(top, el) {
            let n = top;
            while (n && n !== document.body) {
              if (n === el) return true;
              if (getComputedStyle(n).pointerEvents === 'none') return true;
              n = n.parentElement;
            }
            return false;
          }
          function isChrome(top) {
            /* 늘 붙어 있는 바(탭바·헤더·하단 저장 바)는 제외 — 내용 여백이 따로 잼 */
            let n = top;
            while (n && n !== document.body) {
              const cs = getComputedStyle(n);
              if ((cs.position === 'fixed' || cs.position === 'sticky') &&
                  (n.id === 'tabbar' || n.classList.contains('tabbar') || n.tagName === 'HEADER' ||
                   n.classList.contains('topbar') || /고정바|actionbar/i.test(n.className || ''))) return true;
              n = n.parentElement;
            }
            return false;
          }
          function clippedAway(el, r) {
            /* 가로로 밀어 보는 칩 줄처럼, 스크롤 컨테이너 밖으로 잘려 있는 것은 눌리는 요소가 아님 */
            let n = el.parentElement;
            while (n && n !== document.body) {
              const cs = getComputedStyle(n);
              if (cs.overflowX === 'auto' || cs.overflowX === 'scroll' || cs.overflow === 'hidden') {
                const cr = n.getBoundingClientRect();
                if (r.left < cr.left - 2 || r.right > cr.right + 2) return true;
              }
              n = n.parentElement;
            }
            return false;
          }
          document.querySelectorAll('button, [data-act], [data-tab]').forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.width < 8 || r.height < 8) return;
            if (r.bottom < 4 || r.top > vh - 4) return;
            const x = r.left + r.width / 2, y = r.top + r.height / 2;
            if (x < 0 || x > vw || y < 0 || y > vh) return;
            const st = getComputedStyle(el);
            if (st.visibility === 'hidden' || st.opacity === '0' || st.pointerEvents === 'none') return;
            if (clippedAway(el, r)) return;
            const top = document.elementFromPoint(x, y);
            if (!top) return;
            if (passesThrough(top, el) || isChrome(top)) return;
            const label = (el.innerText || el.getAttribute('aria-label') || el.getAttribute('data-act') || el.tagName).trim().slice(0, 24);
            out.push(label + ' ← ' + (top.tagName + '.' + (top.className || '').toString().slice(0, 30)));
          });
          return out.slice(0, 6);
        }""")

    def mark(name):
        step['name'] = name
        return {'err': len(console_errors), 'page': len(page_errors), 'csp': len(csp_violations)}

    def since(m, label):
        ne = len(console_errors) - m['err']
        np_ = len(page_errors) - m['page']
        nc = len(csp_violations) - m['csp']
        if ne or np_ or nc:
            print('   !! ' + label + ' console=%d page=%d csp=%d' % (ne, np_, nc), flush=True)
            for tag, arr in (('console', console_errors), ('page', page_errors), ('csp', csp_violations)):
                for s, t in arr[-3:]:
                    print('      ' + tag + '[' + s + ']: ' + t[:200], flush=True)
        check(label + ' — 콘솔 오류 0 · 런타임 오류 0 · CSP 위반 0', ne == 0 and np_ == 0 and nc == 0,
              'console=%d page=%d csp=%d' % (ne, np_, nc))

    # =========================================================
    # ① 로그인 전
    # =========================================================
    print('\n[1] 로그인 전 화면', flush=True)
    m = mark('로그인 전 · 시작 화면')
    pg.goto(BASE, wait_until='networkidle')
    pg.wait_for_timeout(1200)
    start_ok = pg.locator('.start__title').count() > 0
    check('시작 화면이 뜬다', start_ok)
    check('시작 화면 가로 넘침 0', overflow() <= 0, overflow())
    cv = covered_buttons()
    check('시작 화면 가려진 버튼 0', len(cv) == 0, cv)
    grab('v1103_01_start')
    since(m, '시작 화면')

    m = mark('로그인 전 · 이메일 화면')
    if pg.locator('[data-act="to-email"]').count():
        pg.tap('[data-act="to-email"]')
        pg.wait_for_timeout(700)
    check('이메일 로그인 화면이 뜬다', pg.locator('.start__card').count() > 0)
    check('이메일 화면 가로 넘침 0', overflow() <= 0, overflow())
    check('이메일 화면 가려진 버튼 0', len(covered_buttons()) == 0, covered_buttons())
    grab('v1103_02_email')
    since(m, '이메일 로그인 화면')

    # ---------- 게스트로 들어가기 ----------
    m = mark('게스트 진입')
    pg.goto(BASE, wait_until='networkidle')
    pg.wait_for_timeout(900)
    if pg.locator('.start__guest').count():
        pg.tap('.start__guest')
        pg.wait_for_timeout(1500)
    for _ in range(5):
        c = pg.locator('#sheet [data-close]')
        if c.count() and c.first.is_visible():
            c.first.click()
            pg.wait_for_timeout(250)
        else:
            break
    got_in = pg.locator('[data-tab="log"]').count() > 0
    check('게스트로 들어가 탭이 보인다', got_in)
    version = pg.evaluate("() => (BM.app && BM.app.version) || ''")
    check('앱 버전 ' + ('v1.103.0' if not LIVE else 'v1.103.0'), version == 'v1.103.0', version)
    since(m, '게스트 진입')

    # =========================================================
    # ② 탭 순회 — 콘솔·런타임·넘침·가려짐
    # =========================================================
    print('\n[2] 로그인 후 주요 탭', flush=True)
    TABS = [('log', '일지 & AI'), ('matching', '1:1 매칭'), ('community', '커뮤니티'),
            ('coach', '코치'), ('my', 'MY')]
    for tid, label in TABS:
        m = mark(label)
        if not pg.locator('[data-tab="%s"]' % tid).count():
            check(label + ' 탭 버튼이 있다', False)
            continue
        pg.tap('[data-tab="%s"]' % tid)
        pg.wait_for_timeout(900)
        body = pg.evaluate("() => (document.querySelector('#view') || {}).innerText || document.body.innerText || ''")
        check(label + ' 화면이 내용을 그린다', len(body.strip()) > 40, len(body.strip()))
        check(label + ' 가로 넘침 0', overflow() <= 0, overflow())
        cv = covered_buttons()
        check(label + ' 가려진 버튼 0 (z-index)', len(cv) == 0, cv)
        since(m, label)

    # ---------- MY › 알림·편지지 / 개인정보·계정 (설정 묶음) ----------
    m = mark('MY › 설정 묶음')
    pg.tap('[data-tab="my"]')
    pg.wait_for_timeout(700)
    opened = pg.evaluate("""() => {
      const gs = Array.from(document.querySelectorAll('details.group'));
      const want = ['alarm', 'legal', 'data', 'theme'];
      let n = 0;
      gs.forEach(g => { if (want.indexOf(g.getAttribute('data-group')) >= 0) { g.open = true; n++; } });
      return n;
    }""")
    pg.wait_for_timeout(600)
    check('MY 설정 묶음(알림·개인정보·데이터·테마)을 연다', opened >= 3, opened)
    pg.evaluate("() => { const g = document.querySelector('details.group[data-group=\"alarm\"]'); if (g) g.scrollIntoView({block:'center'}); }")
    pg.wait_for_timeout(400)
    stext = pg.evaluate("() => (document.querySelector('details.group[data-group=\"alarm\"]') || {}).innerText || ''")
    check('설정 묶음이 내용을 그린다', len(stext.strip()) > 20, len(stext.strip()))
    check('설정 가로 넘침 0', overflow() <= 0, overflow())
    check('설정 가려진 버튼 0', len(covered_buttons()) == 0, covered_buttons())
    grab('v1103_03_settings')
    since(m, 'MY › 설정 묶음')

    # =========================================================
    # ③ 일지 저장 → AI 분석 → 새 코칭 2건
    # =========================================================
    print('\n[3] 일지 저장 → AI 분석 카드', flush=True)
    m = mark('일지 → AI 분석')
    if pg.locator('[data-act="back"], .start__back').count():
        pass
    pg.tap('[data-tab="log"]')
    pg.wait_for_timeout(800)
    pg.evaluate("""() => {
      BM.app.ctx.actions.setDraft({
        date: BM.util.ymd(), cond: 6, intensity: 8, minutes: 90,
        note: '상대 스매시가 세게 들어와서 수비가 밀렸고 후반에 숨이 찼어요',
        games: [{a:21,b:18,mode:21},{a:17,b:21,mode:21}], gameMode: 21,
        discipline: '복식',
        weakness: ['수비'], pain: [], done: ['스트록', '게임']
      });
    }""")
    pg.wait_for_timeout(500)
    if pg.locator('[data-act="save-log"]').count():
        pg.tap('[data-act="save-log"]')
        pg.wait_for_timeout(1800)
    for _ in range(5):
        c = pg.locator('#sheet [data-close]')
        if c.count() and c.first.is_visible():
            c.first.click()
            pg.wait_for_timeout(250)
        else:
            break
    card = pg.evaluate("""() => {
      const el = document.querySelector('[data-region="analysis"]');
      if (!el) return null;
      return {
        folds: Array.from(el.querySelectorAll('details[data-fold]')).map(d => d.getAttribute('data-fold')),
        hasMatch: !!el.querySelector('[data-fold="match"]'),
        heavy: (el.querySelector('[data-heavy-smash="1"]') || {}).innerText || '',
        tempo: (el.querySelector('[data-tempo="1"]') || {}).innerText || '',
        cardText: el.innerText.slice(0, 4000)
      };
    }""")
    check('일지 저장 뒤 AI 분석 카드가 뜬다', bool(card))
    if card:
        # 심화(pro) 접기 → 시합 당일 준비 접기를 연다
        pg.evaluate("""() => {
          const pro = document.querySelector('[data-region="analysis"] [data-fold="pro"]');
          if (pro) { pro.open = true; }
          const mt = document.querySelector('[data-region="analysis"] [data-fold="match"]');
          if (mt) { mt.open = true; }
        }""")
        pg.wait_for_timeout(500)
        info = pg.evaluate("""() => {
          const el = document.querySelector('[data-region="analysis"]');
          const hv = el.querySelector('[data-heavy-smash="1"]');
          const tp = el.querySelector('[data-tempo="1"]');
          if (hv) hv.scrollIntoView({block: 'center'});
          return {
            heavyText: hv ? hv.innerText : '',
            tempoText: tp ? tp.innerText : '',
            folds: Array.from(el.querySelectorAll('details[data-fold]')).map(d => d.getAttribute('data-fold')),
            heavyBox: hv ? hv.getBoundingClientRect().toJSON() : null,
            tempoBox: tp ? tp.getBoundingClientRect().toJSON() : null
          };
        }""")
        pg.wait_for_timeout(400)
        print('   folds:', info['folds'], flush=True)
        check('시합 당일 준비 접기 안에 강한 스매시 블록', bool(info['heavyText']), info['heavyText'][:90])
        check('강한 스매시 3단계 — 낮추기·흡수·높게', all(w in info['heavyText'] for w in ['낮추기', '흡수', '높게']))
        check('시합 당일 준비 접기 안에 템포 블록', bool(info['tempoText']), info['tempoText'][:90])
        check('템포 3단계 — 신발끈·숨·낮은 템포',
              all(w in info['tempoText'] for w in ['신발끈', '숨', '2~3구']))
        check('새 블록 화면에 undefined/null 없음',
              'undefined' not in (info['heavyText'] + info['tempoText']) and 'null' not in (info['heavyText'] + info['tempoText']))
        grab('v1103_04_ai_heavy_smash')
        pg.evaluate("""() => {
          const tp = document.querySelector('[data-region="analysis"] [data-tempo="1"]');
          if (tp) tp.scrollIntoView({block: 'center'});
        }""")
        pg.wait_for_timeout(400)
        grab('v1103_05_ai_tempo')
        check('AI 분석 화면 가로 넘침 0', overflow() <= 0, overflow())
    since(m, 'AI 분석 카드')

    # =========================================================
    # ④ 커스텀 라켓 3D — 다회전 스핀·임팩트·소리 (bm-v1.102.0)
    # =========================================================
    print('\n[4] 커스텀 라켓 3D (다회전 스핀)', flush=True)
    m = mark('커스텀 라켓 3D')
    pg.tap('[data-tab="my"]')
    pg.wait_for_timeout(800)
    # 내 라켓 · 스트링 → 🎨 내 커스텀 라켓 순서로 연다 (시트 두 단계)
    step1 = pg.evaluate("""() => {
      const b = document.querySelector('[data-act="gear-sheet"], [data-act="gear-add"]');
      if (!b) return false;
      b.click(); return true;
    }""")
    pg.wait_for_timeout(1200)
    check('내 라켓 · 스트링 시트가 열린다', step1)
    step2 = pg.evaluate("""() => {
      const b = document.querySelector('[data-act="racket-sheet"]');
      if (!b) return false;
      b.click(); return true;
    }""")
    pg.wait_for_timeout(1800)
    check('커스텀 라켓(3D 쇼룸) 시트가 열린다', step2)
    pet = pg.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.me.admin = true;
      const c = BM.racketcustom.customOf(st.me);
      ['frame:white','string:white','grip:white','effect:none','frame:red','string:crimson','grip:crimson','effect:fire',
       'motion:twist','motion:showcase','motion:flip']
        .forEach(k => { if (c.unlocked.indexOf(k) < 0) c.unlocked.push(k); });
      st.me.theme = st.me.theme || {};
      st.me.theme.gear = st.me.theme.gear || {};
      st.me.theme.gear.custom = c;
      return true;
    }""")
    pg.wait_for_timeout(1200)
    has3d = pg.evaluate("""() => !!document.querySelector('canvas.rk3d__cv')""")
    check('3D 캔버스가 화면에 있다', has3d)
    frames_before = pg.evaluate("""() => new Promise(res => {
      const c = document.querySelector('canvas.rk3d__cv');
      if (!c) return res(-1);
      let n = 0, stop = false;
      function tick() { n++; if (!stop) requestAnimationFrame(tick); }
      requestAnimationFrame(tick);
      setTimeout(() => { stop = true; res(n); }, 1000);
    })""")
    check('3D 쇼룸이 계속 그린다 (1초 프레임 수 · 소프트웨어 렌더)',
          isinstance(frames_before, int) and frames_before >= 5, frames_before)

    # 손짓: 스매시(톡) · 좌우 회전(드래그) · 모션 버튼(다회전)
    box = pg.evaluate("""() => {
      const c = document.querySelector('canvas.rk3d__cv');
      if (!c) return null;
      const r = c.getBoundingClientRect();
      return {x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, top: r.top};
    }""")
    check('3D 캔버스 위치를 찾았다', bool(box), box)
    if box:
        pg.mouse.click(box['x'], box['y'])
        pg.wait_for_timeout(900)
        pg.mouse.move(box['x'] - 40, box['y'])
        pg.mouse.down()
        for i in range(10):
            pg.mouse.move(box['x'] - 40 + (i + 1) * 8, box['y'])
            pg.wait_for_timeout(30)
        pg.mouse.up()
        pg.wait_for_timeout(700)
        motion = pg.evaluate("""() => {
          const st = BM.app.ctx.store.state;
          const c = BM.racketcustom.customOf(st.me);
          const btns = Array.from(document.querySelectorAll('button, [data-act], [data-motion]'))
            .filter(b => /스핀|모션|돌리|쇼케이스|트위스트/.test(b.innerText || ''));
          return {motion: c.motion || '', buttons: btns.map(b => (b.innerText || '').trim().slice(0, 20))};
        }""")
        print('   motion buttons:', motion['buttons'], flush=True)
        fired = pg.evaluate("""() => {
          const b = document.querySelector('[data-rk-motion]');
          if (!b) return false;
          window.__rkMid = b.getAttribute('data-rk-motion');
          b.click();
          return true;
        }""")
        pg.wait_for_timeout(220)
        motion_kind = pg.evaluate("""() => {
          const api = BM.racketcustom._last3d || {};
          return {want: window.__rkMid, now: api.motionKind ? api.motionKind() : null};
        }""")
        grab('v1103_06_racket_motion')
        pg.wait_for_timeout(500)
        motion_state = pg.evaluate("""() => {
          const api = BM.racketcustom._last3d || {};
          return {has3d: !!api, keys: Object.keys(api).slice(0, 12)};
        }""")
        pg.wait_for_timeout(1800)
        after = pg.evaluate("""() => ({
          canvas: document.querySelectorAll('canvas.rk3d__cv').length,
          broken: Array.from(document.querySelectorAll('canvas.rk3d__cv')).some(c => c.width === 0 || c.height === 0)
        })""")
        check('모션(다회전) 버튼을 누를 수 있다', bool(fired))
        check('누른 모션이 3D 에서 실제로 재생된다', motion_kind['want'] and motion_kind['now'] == motion_kind['want'], motion_kind)
        check('3D 모션 API 가 연결되어 있다', motion_state['has3d'], motion_state['keys'])
        check('모션 뒤에도 3D 캔버스가 살아 있다 (멈춤·0 크기 없음)',
              after['canvas'] >= 1 and not after['broken'], after)
        pg.wait_for_timeout(300)
        grab('v1103_07_racket_after_motion')
    check('커스텀 라켓 화면 가로 넘침 0', overflow() <= 0, overflow())
    since(m, '커스텀 라켓 3D')

    # =========================================================
    # ⑤ 최종 집계
    # =========================================================
    print('\n[5] 집계', flush=True)
    check('전체 콘솔 오류 0', len(console_errors) == 0, len(console_errors))
    check('전체 JS 런타임 오류 0', len(page_errors) == 0, len(page_errors))
    check('전체 CSP 위반 0', len(csp_violations) == 0, len(csp_violations))
    if net_errors:
        print('   (로컬 점검에서 막은 외부 요청 %d건 — 앱 오류 아님)' % len(net_errors), flush=True)
    for s, t in console_errors[:12]:
        print('   console[' + s + ']: ' + t[:220], flush=True)
    for s, t in page_errors[:12]:
        print('   page[' + s + ']: ' + t[:220], flush=True)

    report = {
        'mode': 'live' if LIVE else 'local',
        'base': BASE,
        'version': version if 'version' in dir() else '',
        'checks': checks,
        'console_errors': console_errors,
        'blocked_network': net_errors,
        'page_errors': page_errors,
        'csp_violations': csp_violations,
        'passed': sum(1 for c in checks if c['ok']),
        'total': len(checks),
        'at': time.strftime('%Y-%m-%d %H:%M:%S')
    }
    name = 'v1103_live_report.json' if LIVE else 'v1103_report.json'
    with open(os.path.join(OUT, name), 'w') as f:
        json.dump(report, f, ensure_ascii=False, indent=1)
    print('\n결과: %d/%d 통과 · 콘솔 %d · 런타임 %d · CSP %d' %
          (report['passed'], report['total'], len(console_errors), len(page_errors), len(csp_violations)), flush=True)
    b.close()
