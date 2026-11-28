#!/usr/bin/env python3
"""bm-v1.101.0 — 수분·체온 + 정신 피로 코칭 확인 (390×844 · has_touch)

  ① 일지(100분 · 강도 8 · 2경기 · 컨디션 2 · 메모 '더위/시합')를 저장하면
     분석 카드에 '오늘 컨디션 케어' 접기 한 칸이 생기고, 수분·머리 피로 블록이 함께 나온다
  ② 접기를 열면 수분(11점 60초·세트 사이 120초·탈수 1% 아래)과 정신 피로 3단계
     (스마트폰 줄이기 · 60초 눈·호흡 · 직선·가운데)가 보인다 → 화면 캡처
  ③ 조건이 없는 날(60분 · 강도 5 · 컨디션 7)은 접기가 아예 안 나온다 (예전 화면 그대로)
  ④ 콘솔 오류 0 · 페이지 오류 0 · CSP 위반 0 · 가로 넘침 0

  실행: LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/capture-v1101.py
        TS_LIVE=1 ... 라이브(깃허브 페이지)
  결과: /workspace/downloads/v1101_*.png · v1101_report.json
"""
import base64
import http.server
import json
import os
import socketserver
import threading

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = '/workspace/downloads'
PORT = 8803
LIVE = os.environ.get('TS_LIVE', '') == '1'
BASE = ('https://csw42060713-byte.github.io/badminton/index.html?c=%d' % os.getpid() if LIVE
        else 'http://127.0.0.1:%d/index.html' % PORT)
LIVE_BASE = 'https://csw42060713-byte.github.io/badminton/'

errors = []
page_errors = []
csp = []
checks = []


def check(name, ok, detail=''):
    checks.append({'name': name, 'ok': bool(ok), 'detail': str(detail)})
    print(('  ✓ ' if ok else '  ✗ ') + name + ((' · ' + str(detail)) if detail else ''), flush=True)


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

if LIVE:
    import time as _time
    import urllib.request

    def _get(u):
        req = urllib.request.Request(u, headers={'Cache-Control': 'no-cache'})
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.read().decode('utf-8', 'replace')

    _st = '?v=%d' % int(_time.time())
    _sw = _get(LIVE_BASE + 'sw.js' + _st)
    _app = _get(LIVE_BASE + 'app.js' + _st)
    _ai = _get(LIVE_BASE + 'js/ai.js' + _st)
    _log = _get(LIVE_BASE + 'js/views/log.js' + _st)
    _twa = _get(LIVE_BASE + 'twa-manifest.json' + _st)
    check('배포본 sw.js bm-v1.101.0', "var VERSION = 'bm-v1.101.0'" in _sw)
    check('배포본 app.js v1.101.0', "version: 'v1.101.0'" in _app)
    check('배포본 TWA 1.101.0 · 95', '"appVersionName": "1.101.0"' in _twa and '"appVersionCode": 95' in _twa)
    check('배포본 ai.js 수분·정신 피로', 'hydrationGuide' in _ai and 'mentalFatigue' in _ai and '10.1123/ijspp.2024-0428' in _ai)
    check('배포본 log.js 컨디션 케어 접기', 'data-fold="state"' in _log)
    try:
        _get(LIVE_BASE + 'test/v1101.test.js' + _st)
        check('배포본에 테스트 파일 없음', False, 'test/ 가 공개되어 있습니다')
    except Exception:
        check('배포본에 테스트 파일 없음', True)

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

    def on_console(m):
        if m.type == 'error':
            errors.append(m.text)
        if 'Content Security Policy' in (m.text or ''):
            csp.append(m.text)

    def on_page_error(e):
        page_errors.append(str(e))

    pg.on('console', on_console)
    pg.on('pageerror', on_page_error)

    def grab(name, clip=None):
        args = {'format': 'png', 'captureBeyondViewport': False}
        if clip:
            args['clip'] = {'x': clip['x'], 'y': clip['y'], 'width': clip['width'], 'height': clip['height'], 'scale': 2}
        r = cdp.send('Page.captureScreenshot', args)
        path = os.path.join(OUT, (name.replace('v1101_', 'v1101_live_') if LIVE else name) + '.png')
        open(path, 'wb').write(base64.b64decode(r['data']))
        print('saved', os.path.basename(path), flush=True)
        return path

    def overflow():
        return pg.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")

    pg.goto(BASE, wait_until='networkidle')
    pg.evaluate("""() => {
      localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
      localStorage.setItem('bm_auth_v1', JSON.stringify({kind:'guest', guest:true, name:'승우',
        at:new Date().toISOString(), onboardedAt:'2026-11-28 16:00:00',
        profile:{nick:'승우', level:'C조', discipline:'복식', region:'경기', club:'매원고', onboardedAt:'2026-11-28 16:00:00'}}));
      localStorage.setItem('bm_seen_v1', 'true');
    }""")
    if not LIVE:
        pg.reload(wait_until='networkidle')
        pg.wait_for_timeout(1500)
    if LIVE and pg.locator('.start__guest').count():
        pg.tap('.start__guest')
        pg.wait_for_timeout(1500)
    for _ in range(4):
        c = pg.locator('#sheet [data-close]')
        if c.count():
            c.first.click()
            pg.wait_for_timeout(300)
        else:
            break

    version = pg.evaluate("() => (BM.app && BM.app.version) || ''")
    print('version:', version, flush=True)
    check('버전 v1.101.0', version == 'v1.101.0', version)

    # ---------- ① 오늘 일지: 100분 · 강도 8 · 2경기 · 컨디션 2 · 더위/시합 메모 ----------
    print('\n[1] 일지 저장 → 오늘 컨디션 케어', flush=True)
    pg.tap('[data-tab="log"]')
    pg.wait_for_timeout(700)
    pg.evaluate("""() => {
      const ctx = BM.app.ctx;
      ctx.actions.setDraft({
        date: BM.util.ymd(), cond: 2, intensity: 8, minutes: 100,
        note: '체육관이 더워서 땀이 많이 났고 시합 2경기를 연속으로 뛰었어요',
        games: [{a:21,b:18,mode:21},{a:17,b:21,mode:21}], gameMode: 21,
        weakness: ['풋워크'], pain: [], done: ['스트록', '게임']
      });
    }""")
    pg.wait_for_timeout(500)
    pg.tap('[data-act="save-log"]')
    pg.wait_for_timeout(1600)
    for _ in range(4):
        c = pg.locator('#sheet [data-close]')
        if c.count():
            c.first.click()
            pg.wait_for_timeout(250)
        else:
            break

    card = pg.evaluate("""() => {
      const el = document.querySelector('[data-region="analysis"]');
      if (!el) return null;
      const fold = el.querySelector('[data-fold="state"]');
      return {
        hasCard: true,
        hasFold: !!fold,
        summary: fold ? fold.querySelector('.fold__sum').innerText.replace(/\\n/g, ' | ') : '',
        folds: Array.from(el.querySelectorAll('details[data-fold]')).map(d => d.getAttribute('data-fold')),
        metrics: Array.from(el.querySelectorAll('.ai-metric')).map(e => e.textContent),
        insightLabels: ((BM.app.ctx.store.state.analysis || {}).insights || []).map(i => i.label),
        hyd: !!el.querySelector('[data-hydration]'),
        mental: !!el.querySelector('[data-mental]'),
        hydText: (el.querySelector('[data-hydration]') || {}).textContent || '',
        mentalText: (el.querySelector('[data-mental]') || {}).textContent || '',
        cardText: el.textContent
      };
    }""")
    print('   summary:', (card or {}).get('summary'), flush=True)
    print('   folds:', (card or {}).get('folds'), flush=True)
    print('   metrics:', json.dumps((card or {}).get('metrics'), ensure_ascii=False), flush=True)
    check('분석 카드가 나온다', bool(card and card['hasCard']))
    check('오늘 컨디션 케어 접기 한 칸', bool(card and card['hasFold']), (card or {}).get('summary'))
    check('접기 이름 · 수분 · 머리 피로', bool(card and '오늘 컨디션 케어' in card['summary'] and '수분' in card['summary'] and '머리 피로' in card['summary']),
          (card or {}).get('summary'))
    check('수분 블록 내용 — 11점 60초 · 120초 · 1% 아래',
          bool(card and '11점 60초' in card['hydText'] and '120초' in card['hydText'] and '1%' in card['hydText']),
          (card or {}).get('hydText', '')[:80])
    check('정신 피로 블록 내용 — 7% · 스마트폰 · 60초 · 직선·가운데',
          bool(card and '7%' in card['mentalText'] and '스마트폰' in card['mentalText']
               and '60초' in card['mentalText'] and '직선' in card['mentalText']),
          (card or {}).get('mentalText', '')[:80])
    check('진단 목록에 수분 보충 · 머리 피로',
          bool(card and '수분 보충' in ' '.join(card.get('insightLabels') or []) and '머리 피로' in ' '.join(card.get('insightLabels') or [])),
          (card or {}).get('insightLabels'))
    check('가로 넘침 0 (카드)', overflow() <= 0, overflow())

    # 접기 펼치기 → 캡처 (공유 바가 접기를 가리지 않게 닫고, 접기 머리를 헤더 아래로)
    pg.evaluate("""() => {
      const x = document.querySelector('.sharebar__x');
      if (x) x.click();
      const fold = document.querySelector('[data-region="analysis"] [data-fold="state"]');
      if (fold) {
        fold.open = true;
        const y = fold.getBoundingClientRect().top + window.scrollY - 74;
        window.scrollTo(0, Math.max(0, y));
      }
    }""")
    pg.wait_for_timeout(800)
    grab('v1101_state_fold')
    pg.evaluate("""() => {
      const m = document.querySelector('[data-region="analysis"] [data-mental]');
      if (m) m.scrollIntoView({block: 'center'});
    }""")
    pg.wait_for_timeout(700)
    grab('v1101_state_fold_mental')
    opened = pg.evaluate("""() => {
      const fold = document.querySelector('[data-region="analysis"] [data-fold="state"]');
      return fold ? {open: fold.open, text: fold.innerText.length > 100} : null;
    }""")
    check('접기를 열면 본문이 보인다', bool(opened and opened['open'] and opened['text']), opened)

    # ---------- ② 조건 없는 날 ----------
    print('\n[2] 조건 없는 날 — 접기 없음', flush=True)
    pg.evaluate("""() => {
      const ctx = BM.app.ctx;
      ctx.actions.setDraft({
        date: BM.util.ymd(), cond: 7, intensity: 5, minutes: 60,
        note: '', games: [], gameMode: 21, weakness: ['드라이브'], pain: [], done: ['스트록']
      });
    }""")
    pg.wait_for_timeout(400)
    pg.tap('[data-act="save-log"]')
    pg.wait_for_timeout(1600)
    for _ in range(4):
        c = pg.locator('#sheet [data-close]')
        if c.count():
            c.first.click()
            pg.wait_for_timeout(250)
        else:
            break
    quiet = pg.evaluate("""() => {
      const el = document.querySelector('[data-region="analysis"]');
      if (!el) return null;
      return {
        hasFold: !!el.querySelector('[data-fold="state"]'),
        hasHyd: !!el.querySelector('[data-hydration]'),
        hasMental: !!el.querySelector('[data-mental]'),
        hasPrevent: !!el.querySelector('[data-fold="prevent"]'),
        hasCare: !!el.querySelector('[data-fold="care"]'),
        text: el.innerText
      };
    }""")
    print('   quiet:', json.dumps(quiet, ensure_ascii=False)[:200], flush=True)
    check('조용한 날: 컨디션 케어 접기 없음', bool(quiet and not quiet['hasFold']), quiet)
    check('조용한 날: 수분·정신 피로 블록 없음', bool(quiet and not quiet['hasHyd'] and not quiet['hasMental']))
    check('조용한 날: 기존 접기(부상 예방·맞춤 처방)는 그대로', bool(quiet and quiet['hasPrevent'] and quiet['hasCare']))
    pg.evaluate("""() => {
      const el = document.querySelector('[data-region="analysis"]');
      if (el) el.scrollIntoView({block: 'start'});
    }""")
    pg.wait_for_timeout(600)
    grab('v1101_quiet_day')

    check('가로 넘침 0', overflow() <= 0, overflow())
    real_errors = [e for e in errors if 'ERR_FAILED' not in e and 'net::' not in e]
    check('콘솔 오류 0', len(real_errors) == 0, real_errors[:3] or ('(로컬 모드에서 막은 외부 요청 %d건)' % len(errors)))
    check('페이지 오류 0', len(page_errors) == 0, page_errors[:3])
    check('CSP 위반 0', len(csp) == 0, csp[:2])

    report = {'live': LIVE, 'version': version, 'checks': checks, 'errors': errors, 'csp': csp,
              'page_errors': page_errors,
              'passed': sum(1 for c in checks if c['ok']), 'total': len(checks)}
    open(os.path.join(OUT, ('v1101_live_report.json' if LIVE else 'v1101_report.json')), 'w').write(
        json.dumps(report, ensure_ascii=False, indent=2))
    print('\n%d/%d 확인 통과' % (report['passed'], report['total']), flush=True)
    b.close()
