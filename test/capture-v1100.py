#!/usr/bin/env python3
"""bm-v1.100.0 — 12시 점검 버그 3건 확인 (390×844 · has_touch)

  ① 주간 리포트 — 이번 주 경기 0건 + 지난주 경기 있음 → '첫 기간' 이 아니라 '이번 주 경기 없음'
  ② 내 커스텀 라켓 — 전환 '⚡ 스매시' 와 실행 버튼 이름이 다름 · 잠긴 파츠 카드에 빈 ❤ 없음
  ③ 영상 자세 비교 — '정확해요.영상 없이' 가 아니라 '정확해요. 영상 없이'(띄어쓰기·줄바꿈)

  실행: LD_LIBRARY_PATH=/workspace/tmp/syslibs python3 test/capture-v1100.py
        TS_LIVE=1 ... 라이브(깃허브 페이지)
  결과: /workspace/downloads/v1100_*.png · v1100_report.json
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
PORT = 8801
LIVE = os.environ.get('TS_LIVE', '') == '1'
BASE = ('https://csw42060713-byte.github.io/badminton/index.html?c=%d' % os.getpid() if LIVE
        else 'http://127.0.0.1:%d/index.html' % PORT)

errors = []
page_errors = []
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
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: page_errors.append(str(e)))

    def grab(path, clip=None):
        args = {'format': 'png', 'captureBeyondViewport': False}
        if clip:
            args['clip'] = {'x': clip['x'], 'y': clip['y'], 'width': clip['width'], 'height': clip['height'], 'scale': 2}
        r = cdp.send('Page.captureScreenshot', args)
        open(path, 'wb').write(base64.b64decode(r['data']))
        print('saved', os.path.basename(path), flush=True)

    def overflow():
        return pg.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")

    pg.goto(BASE, wait_until='networkidle')
    pg.evaluate("""() => {
      localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
      localStorage.setItem('bm_auth_v1', JSON.stringify({kind:'guest', guest:true, name:'나래',
        at:new Date().toISOString(), onboardedAt:'2026-11-28 13:00:00',
        profile:{nick:'나래', level:'C조', discipline:'복식', region:'경기', club:'나래울', onboardedAt:'2026-11-28 13:00:00'}}));
      localStorage.setItem('bm_seen_v1', 'true');
    }""")
    if not LIVE:
        pg.reload(wait_until='networkidle')
        pg.wait_for_timeout(1600)
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

    # ---------- ① 리포트 ----------
    print('\n[1] 주간·월간 상세 리포트', flush=True)
    pg.evaluate("""() => {
      const recs = [
        { id:'c1', type:'기록', date:'2026-11-26', minutes:70, done:[], weakness:['드라이브'], pain:[], games:[], score:null, note:'' },
        { id:'c2', type:'기록', date:'2026-11-20', minutes:60, done:[], weakness:[], pain:[], games:[{a:21,b:18,mode:21},{a:15,b:21,mode:21}], score:{a:21,b:18,mode:21}, note:'' }
      ];
      BM.report.open({ records: recs, mode: 'week', now: '2026-11-28', role: 'club', level: 'C조' });
      return true;
    }""")
    pg.wait_for_timeout(700)
    badges = pg.evaluate("() => Array.from(document.querySelectorAll('[data-rpt-body] .rpt__stat')).map(e => e.innerText.replace(/\\n/g, ' | '))")
    print('   stats:', json.dumps(badges, ensure_ascii=False), flush=True)
    body_text = pg.evaluate("() => document.querySelector('[data-rpt-body]').innerText")
    check('리포트: 이번 주 경기 없음 배지', '이번 주 경기 없음' in body_text)
    check('리포트: 첫 기간 오표기 없음', '첫 기간' not in body_text)
    grab(os.path.join(OUT, 'v1100_report_week.png'))
    pg.evaluate("""() => {
      const recs = [
        { id:'m1', type:'기록', date:'2026-11-26', minutes:70, done:[], weakness:[], pain:[], games:[], score:null, note:'' },
        { id:'m2', type:'기록', date:'2026-10-20', minutes:60, done:[], weakness:[], pain:[], games:[{a:21,b:19,mode:21}], score:{a:21,b:19,mode:21}, note:'' }
      ];
      BM.report.close();
      BM.report.open({ records: recs, mode: 'month', now: '2026-11-28', role: 'club', level: 'C조' });
    }""")
    pg.wait_for_timeout(600)
    mtext = pg.evaluate("() => document.querySelector('[data-rpt-body]').innerText")
    check('리포트(월간): 이번 달 경기 없음 배지', '이번 달 경기 없음' in mtext)
    check('리포트(월간): 첫 기간 오표기 없음', '첫 기간' not in mtext)
    pg.evaluate("() => BM.report.close()")
    pg.wait_for_timeout(400)

    # ---------- ② 자세 비교 ----------
    print('\n[2] 영상 자세 비교', flush=True)
    pg.evaluate("() => BM.pose.openFrom(BM.app.ctx)")
    pg.wait_for_timeout(1100)
    hint = pg.evaluate("""() => {
      const p = document.querySelector('#posePanel [data-pose-status] p');
      if (!p) return null;
      return { text: p.textContent, html: p.innerHTML };
    }""")
    print('   hint:', json.dumps(hint, ensure_ascii=False), flush=True)
    check('자세 비교: 문장 붙음 없음', bool(hint) and '정확해요.영상' not in hint['text'], hint['text'] if hint else '')
    check('자세 비교: 띄어쓰기 + 줄바꿈', bool(hint and '정확해요. 영상 없이' in hint['text'] and '<br>' in hint['html']), hint['html'] if hint else '')
    pbox = pg.evaluate("""() => { const r = document.querySelector('#posePanel .pose__status').getBoundingClientRect();
      return {x:r.x, y:r.y, width:r.width, height:r.height}; }""")
    grab(os.path.join(OUT, 'v1100_pose_hint.png'), pbox)
    pg.evaluate("() => BM.pose.close()")
    pg.wait_for_timeout(400)

    # ---------- ③ 내 커스텀 라켓 ----------
    print('\n[3] 내 커스텀 라켓', flush=True)
    pg.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.hearts = st.hearts || {}; st.hearts.balance = 1;   /* 하트 부족 → 잠긴 카드가 보이게 */
      BM.racketcustom.openSheet(BM.app.ctx);
    }""")
    pg.wait_for_timeout(1500)
    rk = pg.evaluate("""() => {
      const modes = Array.from(document.querySelectorAll('.rkstage__m')).map(e => e.textContent.trim());
      const gos = Array.from(document.querySelectorAll('.rkstage__go')).map(e => e.textContent.trim());
      const goAria = Array.from(document.querySelectorAll('.rkstage__go')).map(e => e.getAttribute('aria-label'));
      const frame = document.querySelector('[data-rk-group="frame"]');
      const cards = frame ? Array.from(frame.querySelectorAll('.rkpart')).map(c => ({
        txt: c.innerText.replace(/\\n/g, ' | '),
        lock: c.querySelectorAll('.rkpart__lock').length,
        price: c.querySelector('.rkpart__p') ? c.querySelector('.rkpart__p').textContent.trim() : ''
      })) : [];
      return { modes, gos, goAria, cards: cards.slice(0, 4),
               emptyHeartSpans: Array.from(document.querySelectorAll('.rkpart__lock')).filter(e => e.textContent.trim() === '❤').length,
               lockIcons: Array.from(document.querySelectorAll('.rkpart__lock')).map(e => e.textContent.trim()) };
    }""")
    print('   modes:', json.dumps(rk['modes'], ensure_ascii=False), flush=True)
    print('   go:', json.dumps(rk['gos'], ensure_ascii=False), 'aria:', json.dumps(rk['goAria'], ensure_ascii=False), flush=True)
    print('   frame cards:', json.dumps(rk['cards'], ensure_ascii=False), flush=True)
    check('라켓: 전환 ⚡ 스매시 그대로', rk['modes'][0] == '⚡ 스매시', rk['modes'])
    check('라켓: 실행 버튼 이름 구분', rk['gos'][0] == '⚡ 스매시 쳐보기', rk['gos'])
    check('라켓: 잠긴 파츠에 빈 ❤ 없음', all(c['lock'] == 0 for c in rk['cards']) and rk['emptyHeartSpans'] == 0,
          'heart lock spans=%d · 기타 잠금 %s' % (rk['emptyHeartSpans'], json.dumps(rk['lockIcons'], ensure_ascii=False)))
    check('라켓: 가격 ❤ 배지는 그대로', any('❤' in c['price'] or '부족' in c['price'] for c in rk['cards']),
          [c['price'] for c in rk['cards']])
    box = pg.evaluate("""() => { const r = document.querySelector('.rkstage').getBoundingClientRect();
      return {x:r.x, y:r.y, width:r.width, height:r.height}; }""")
    grab(os.path.join(OUT, 'v1100_racket_stage.png'), box)
    pg.evaluate("""() => { const f = document.querySelector('[data-rk-group="frame"] .rkparts'); if (f) f.scrollIntoView({block: 'center'}); }""")
    pg.wait_for_timeout(700)
    grab(os.path.join(OUT, 'v1100_racket_parts.png'))
    pg.evaluate("() => BM.racketcustom.closeSheet && BM.racketcustom.closeSheet()")
    pg.wait_for_timeout(400)

    check('가로 넘침 0', overflow() <= 0, 'overflow=%s' % overflow())
    real_errors = [e for e in errors if 'ERR_FAILED' not in e and 'net::' not in e]
    check('콘솔 오류 0', len(real_errors) == 0, real_errors[:3] or ('(로컬 모드에서 막은 외부 요청 %d건)' % len(errors)))
    check('페이지 오류 0', len(page_errors) == 0, page_errors[:3])

    report = {'live': LIVE, 'version': version, 'checks': checks, 'errors': errors, 'page_errors': page_errors,
              'passed': sum(1 for c in checks if c['ok']), 'total': len(checks)}
    open(os.path.join(OUT, 'v1100_report.json'), 'w').write(json.dumps(report, ensure_ascii=False, indent=2))
    print('\n%d/%d 확인 통과' % (report['passed'], report['total']), flush=True)
    b.close()

if httpd:
    httpd.shutdown()
