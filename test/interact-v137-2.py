"""v1.37.2 로컬 동작 점검 — 하단 고정 저장 바(저장·수정·키보드)와 커뮤니티 '게스트 모집'을
   390×844 체험 모드에서 실제로 눌러 확인합니다.
   LD_LIBRARY_PATH=/workspace/tmp/deblibs/usr/lib/x86_64-linux-gnu python3 test/interact-v137-2.py
"""
import functools
import http.server
import socketserver
import threading

from playwright.sync_api import sync_playwright

ROOT = '/workspace/work/bm137'
OUT = '/workspace/tmp/savebar'
PORT = 8142
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'

socketserver.TCPServer.allow_reuse_address = True
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
httpd = socketserver.TCPServer(('127.0.0.1', PORT), handler)
httpd.allow_reuse_address = True
threading.Thread(target=httpd.serve_forever, daemon=True).start()
BASE = 'http://127.0.0.1:%d/' % PORT

errs, checks = [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:240]) if extra else ''))
    checks.append((label, bool(cond)))


INFO = """() => {
  const bar = document.querySelector('.submit-wrap.savebar');
  const btn = bar ? bar.querySelector('button') : null;
  const nav = document.getElementById('tabbar');
  const cs = bar ? getComputedStyle(bar) : null;
  const hint = bar ? bar.querySelector('.hint') : null;
  const br = bar ? bar.getBoundingClientRect() : null;
  const nr = nav ? nav.getBoundingClientRect() : null;
  return {
    pos: cs ? cs.position : null,
    barBottom: br ? Math.round(br.bottom) : null,
    barTop: br ? Math.round(br.top) : null,
    navTop: nr ? Math.round(nr.top) : null,
    label: btn ? btn.textContent.trim() : null,
    busy: btn ? btn.dataset.busy : null,
    hint: hint ? getComputedStyle(hint).display : null,
    gap: br && nr ? Math.round(nr.top - br.bottom) : null,
    kb: document.body.classList.contains('kb-open')
  };
}"""

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    page = ctx.new_page()
    page.on('console', lambda m: errs.append('console: ' + m.text[:200]) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:200]))
    page.goto(BASE + 'index.html?i=1372', wait_until='load')
    page.wait_for_timeout(2600)
    if page.query_selector('[data-act="guest"]'):
        page.click('[data-act="guest"]')
        page.wait_for_timeout(2400)
    for _ in range(4):
        if page.query_selector('#sheet .sheet__head [data-close]'):
            page.click('#sheet .sheet__head [data-close]')
            page.wait_for_timeout(350)
    page.click('[data-tab="log"]')
    page.wait_for_timeout(700)
    page.evaluate("() => document.documentElement.setAttribute('data-theme', 'th_def')")
    page.wait_for_timeout(300)

    info = page.evaluate(INFO)
    print('start', info)
    check('처음: 고정 바 · 저장하고 AI 분석', info['pos'] == 'fixed' and info['label'] == '저장하고 AI 분석', info)
    check('처음: 탭바 바로 위(8px)', info['gap'] == 8, info['gap'])

    # ── 저장: 메모 한 줄 채우고 하단 바 버튼을 누른다
    page.fill('[data-field="note"]', '하단 고정 버튼 확인용 메모')
    page.wait_for_timeout(200)
    page.click('[data-act="save-log"]')
    page.wait_for_timeout(400)
    busy = page.evaluate(INFO)
    page.wait_for_timeout(1600)
    after = page.evaluate(INFO)
    print('saving', busy, '\nafter', after)
    check('저장 누르면 진행 표시(저장 중…/저장됨 ✓)', busy['label'] in ('저장 중…', '저장됨 ✓'), busy['label'])
    check('저장이 끝나면 글자가 돌아온다', after['label'] == '저장하고 AI 분석', after['label'])
    check('저장 뒤에도 고정 바 그대로', after['pos'] == 'fixed' and after['gap'] == 8, (after['pos'], after['gap']))
    rec = page.evaluate("() => document.querySelectorAll('[data-region=\"recent\"] .logrow').length")
    ai = page.evaluate("() => !!document.querySelector('[data-region=\"analysis\"]')")
    check('최근 기록 1건', rec == 1, rec)
    check('AI 분석 카드 생김', ai, ai)
    page.screenshot(path=OUT + '/interact-saved.png')

    # ── 키보드가 올라온 상황(안드로이드 visualViewport): 바가 키보드 위로, 안내 문구는 숨김
    page.evaluate("""() => {
        document.documentElement.style.setProperty('--kbd', '320px');
        document.body.classList.add('kb-open');
    }""")
    page.wait_for_timeout(350)
    kb = page.evaluate(INFO)
    print('kb', kb)
    check('키보드 위(body.kb-open)로 이동', kb['barBottom'] == 844 - 320 - 10 or abs(kb['barBottom'] - (844 - 320 - 10)) <= 1,
          kb['barBottom'])
    check('입력 중에는 안내 문구 숨김', kb['hint'] == 'none', kb['hint'])
    page.screenshot(path=OUT + '/interact-keyboard.png')
    page.evaluate("""() => {
        document.documentElement.style.setProperty('--kbd', '0px');
        document.body.classList.remove('kb-open');
    }""")
    page.wait_for_timeout(300)

    # ── 맨 아래로 스크롤: 바가 그대로, 최근 기록이 바 위로
    page.evaluate("() => window.scrollTo(0, document.documentElement.scrollHeight)")
    page.wait_for_timeout(600)
    end = page.evaluate(INFO)
    check('맨 아래에서도 고정 바', end['pos'] == 'fixed' and end['gap'] == 8, (end['pos'], end['gap']))

    # ── 수정 모드: 최근 기록을 눌러 수정 → 버튼 글자가 '수정 저장'
    page.evaluate("() => window.scrollTo(0, 0)")
    page.wait_for_timeout(400)
    page.click('[data-region="recent"] .logrow')
    page.wait_for_timeout(600)
    if page.query_selector('#sheet [data-act="edit-log"]'):
        page.click('#sheet [data-act="edit-log"]')
        page.wait_for_timeout(900)
    edit = page.evaluate(INFO)
    print('edit', edit)
    check('수정 모드에서 글자가 수정 저장', edit['label'] == '수정 저장', edit['label'])
    page.screenshot(path=OUT + '/interact-edit.png')

    # ── 커뮤니티: 말머리 '게스트 모집'
    page.click('[data-tab="community"]')
    page.wait_for_timeout(800)
    page.evaluate("() => document.documentElement.setAttribute('data-theme', 'th_def')")
    chips = page.evaluate("""() => {
        const out = [];
        document.querySelectorAll('[data-topic]').forEach(b => out.push(b.textContent.trim() + '|' + b.getAttribute('data-topic')));
        return out;
    }""")
    print('chips', chips)
    check('작성 말머리에 게스트 모집', any(c.startswith('게스트 모집|') for c in chips), chips)
    check('옛 이름(번개) 칩 없음', not any('번개' in c for c in chips), chips)
    page.fill('[data-composer]', '금요일 저녁 게스트 모집합니다! 같이 기본기 돌려요.')
    page.click('[data-topic="게스트 모집"]')
    page.wait_for_timeout(500)
    form_open = page.evaluate("() => { const f = document.querySelector('[data-viteform]'); return f ? !f.hidden : null; }")
    check('게스트 모집을 고르면 모집 입력칸이 열린다', form_open is True, form_open)
    page.fill('[data-vitefield="when"]', '11/21(금) 19:00')
    page.fill('[data-vitefield="place"]', '나래울 체육관 3번 코트')
    page.fill('[data-vitefield="cap"]', '6')
    page.click('[data-act="post"]')
    page.wait_for_timeout(1200)
    post = page.evaluate("""() => {
        const card = document.querySelector('.vite');
        const pill = document.querySelector('.post__topic');
        return {
            card: !!card,
            title: card ? card.querySelector('.vite__t').textContent.trim() : '',
            pill: pill ? pill.textContent.trim() : '',
            btn: card && card.querySelector('[data-vite-group]') ? card.querySelector('[data-vite-group]').textContent.trim() : ''
        };
    }""")
    print('post', post)
    check('모집 카드가 게스트 모집으로', post['card'] and '게스트 모집' in post['title'], post)
    check('글 말머리 배지도 게스트 모집', post['pill'] == '게스트 모집', post['pill'])
    check('참여 문의 버튼', post['btn'] == '참여 문의', post['btn'])
    page.screenshot(path=OUT + '/interact-community.png')

    real = [e for e in errs if 'GSI_LOGGER' not in e and 'status of 403' not in e]
    print('errors', real)
    check('콘솔·페이지 에러 0건(로컬 GSI 제외)', len(real) == 0, real[:4])
    print('result', sum(1 for _, c in checks if c), '/', len(checks))
    ctx.close()
    b.close()
