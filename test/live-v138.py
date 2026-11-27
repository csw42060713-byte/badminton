"""v1.38.0 라이브 점검 — 배포된 앱(390×844)에서
   ① MY 닉네임 아래 #XXXX 친구 코드 + 원탭 복사
   ② 채팅 목록 내 코드 줄 · + → 친구 추가 시트(코드로 찾기)
   ③ 1:1 매칭 카드·상세에 친구 추가 없음(편지지 요청만)
   를 확인하고 스크린샷을 남깁니다.
   LD_LIBRARY_PATH=/workspace/tmp/deblibs/usr/lib/x86_64-linux-gnu python3 test/live-v138.py
"""
import json
import sys
import time

from playwright.sync_api import sync_playwright

OUT = '/workspace/downloads'
BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
ROWS = json.load(open('/workspace/work/v138/.probe/rows.json', encoding='utf-8'))

errs, fails, checks = [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:300]) if extra else ''))
    checks.append((label, bool(cond)))


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    page = ctx.new_page()
    page.on('console', lambda m: errs.append('console: ' + m.text[:200]) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:200]))

    def _failed(r):
        why = (r.failure or '')
        if 'ERR_ABORTED' in why:
            return
        fails.append(r.url[:120] + ' :: ' + why[:60])
    page.on('requestfailed', _failed)

    # ── 배포 반영 대기 (sw.js·app.js·friends.js)
    sw = ''
    for i in range(40):
        sw = page.request.get(BASE + 'sw.js?cb=' + str(i)).text()
        if 'bm-v1.38.0' in sw:
            break
        time.sleep(8)
    check('라이브 sw.js = bm-v1.38.0', 'bm-v1.38.0' in sw, sw[-60:])
    app = page.request.get(BASE + 'app.js?x=2').text()
    css = page.request.get(BASE + 'styles.css?x=2').text()
    index = page.request.get(BASE + 'index.html?x=2').text()
    twa = page.request.get(BASE + 'twa-manifest.json?x=2').text()
    friends = page.request.get(BASE + 'js/views/friends.js?x=2').text()
    domain = page.request.get(BASE + 'js/domain.js?x=2').text()
    matching = page.request.get(BASE + 'js/views/matching.js?x=2').text()
    check('라이브 app.js = v1.38.0', "version: 'v1.38.0'" in app)
    check('라이브 index.html = 친구 화면 스크립트·스타일 캐시 50',
          'js/views/friends.js' in index and 'styles.css?v=20261121-50' in index)
    check('라이브 twa-manifest = 1.38.0',
          '"appVersionName": "1.38.0"' in twa and '"appVersionCode": 38' in twa)
    check('라이브 friends.js = 친구 코드 화면', 'friendCode' in friends or '친구 추가' in friends, friends[:60])
    check('라이브 domain.js = friendCodeOf', 'friendCodeOf' in domain and 'FRIEND_CODE_ALPHABET' in domain)
    check('라이브 matching.js = 친추 블록 없음', 'pp__social' not in matching, matching.count('pp__social'))
    check('라이브 styles.css = 코드 칩 규칙', '.codechip {' in css and '.codebar {' in css)

    page.goto(BASE + 'index.html', wait_until='load')
    page.evaluate("rows => { localStorage.clear(); localStorage.setItem('bm_rows_v1', JSON.stringify(rows)); }", ROWS)
    page.reload(wait_until='load')
    page.wait_for_timeout(2600)
    if page.query_selector('[data-act="guest"]'):
        page.click('[data-act="guest"]')
        page.wait_for_timeout(2600)
    for _ in range(4):
        if page.query_selector('#sheet .sheet__head [data-close]'):
            page.click('#sheet .sheet__head [data-close]')
            page.wait_for_timeout(300)

    check('앱 버전', page.evaluate('window.BM && BM.app && BM.app.version') == 'v1.38.0',
          page.evaluate('window.BM && BM.app && BM.app.version'))
    code = page.evaluate("() => window.BM.domain.friendCodeOf('demo_me')")
    print('내 코드', code)

    # ── ① MY
    page.click('[data-tab="my"]')
    page.wait_for_timeout(900)
    my = page.evaluate("""() => {
      const chip = document.querySelector('.codechip');
      const name = document.querySelector('.profile__name');
      const r = chip ? chip.getBoundingClientRect() : null;
      return {
        text: chip ? chip.textContent.trim() : null,
        copy: chip ? chip.getAttribute('data-code-copy') : null,
        aria: chip ? chip.getAttribute('aria-label') : null,
        top: r ? Math.round(r.top) : null,
        h: r ? Math.round(r.height) : null,
        w: r ? Math.round(r.width) : null,
        afterName: !!(chip && name && chip.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_PRECEDING),
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1
      };
    }""")
    print('MY', my)
    page.screenshot(path='%s/배드민턴_v1.38_라이브_MY_친구코드.png' % OUT)
    check('MY: 친구 코드 칩 보임', bool(my['text']) and ('#' + code) in my['text'], my['text'])
    check('MY: 복사할 글자 = 닉네임#코드', my['copy'] == '나래#' + code, my['copy'])
    check('MY: 스크린리더 이름', my['aria'] and '내 친구 코드' in my['aria'], my['aria'])
    check('MY: 닉네임 아래', bool(my['afterName']), my)
    check('MY: 터치 높이 28px 이상', my['h'] and my['h'] >= 28, my['h'])
    check('MY: 가로 넘침 없음', not my['overflow'], my['overflow'])

    page.click('.codechip')
    page.wait_for_timeout(800)
    toast = page.evaluate("() => { const t = document.getElementById('toast'); return t ? t.textContent : ''; }")
    check('MY: 누르면 복사 안내', '복사' in toast, toast)
    page.screenshot(path='%s/배드민턴_v1.38_라이브_MY_친구코드_복사.png' % OUT)

    # ── ② 채팅 목록 → 친구 추가
    page.click('#hdrChat')
    page.wait_for_timeout(900)
    bar = page.evaluate("""() => {
      const b = document.querySelector('.codebar');
      const add = document.querySelector('[data-dm-add]');
      return {
        text: b ? b.textContent.replace(/\\s+/g, ' ').trim() : null,
        addAria: add ? add.getAttribute('aria-label') : null,
        old: !!document.querySelector('[data-dm-find]')
      };
    }""")
    print('채팅', bar)
    page.screenshot(path='%s/배드민턴_v1.38_라이브_채팅_내코드.png' % OUT)
    check('채팅: 내 코드 줄', bar['text'] and ('#' + code) in bar['text'], bar['text'])
    check('채팅: + = 친구 코드로 추가', bar['addAria'] == '친구 코드로 친구 추가', bar['addAria'])
    check('채팅: 매칭으로 보내던 예전 입구 없음', not bar['old'], bar['old'])

    page.click('[data-dm-add]')
    page.wait_for_timeout(800)
    sheet = page.evaluate("""() => {
      const s = document.querySelector('#sheet');
      const i = s && s.querySelector('[data-code-input]');
      return {
        title: s ? s.querySelector('.sheet__head h2').textContent : null,
        mine: s ? (s.querySelector('.fcode__mine') || {}).textContent : null,
        input: !!i,
        result: s ? (s.querySelector('[data-code-result]') || {}).textContent : null
      };
    }""")
    print('친구추가 시트', sheet)
    page.screenshot(path='%s/배드민턴_v1.38_라이브_친구추가_시트.png' % OUT)
    check('친구 추가 시트 열림', sheet['title'] == '친구 추가', sheet['title'])
    check('친구 추가 시트: 내 코드', sheet['mine'] and ('#' + code) in sheet['mine'], sheet['mine'])
    check('친구 추가 시트: 입력칸', sheet['input'], sheet['input'])
    check('친구 추가 시트: 안내', sheet['result'] and '아는 사람' in sheet['result'], sheet['result'])

    target_code = page.evaluate("() => window.BM.domain.friendCodeOf('demo_chi')")
    page.fill('[data-code-input]', '#' + target_code.lower())
    page.click('.fcode__form button[type="submit"]')
    page.wait_for_timeout(700)
    found = page.evaluate("""() => {
      const r = document.querySelector('[data-code-result]');
      return { text: r ? r.textContent.replace(/\\s+/g, ' ').trim() : '',
               send: !!document.querySelector('[data-code-send]'),
               who: (document.querySelector('[data-code-send]') || {}).getAttribute ? document.querySelector('[data-code-send]').getAttribute('data-code-send') : '' };
    }""")
    print('찾기 결과', found)
    page.screenshot(path='%s/배드민턴_v1.38_라이브_친구추가_코드찾기.png' % OUT)
    check('코드로 찾기: 콕집사', '콕집사' in found['text'], found['text'])
    check('코드로 찾기: 친구 요청 버튼', found['send'] and found['who'] == 'demo_chi', found)

    page.click('[data-code-send]')
    page.wait_for_timeout(800)
    after = page.evaluate("""() => {
      const r = document.querySelector('[data-code-result]');
      return { text: r ? r.textContent.replace(/\\s+/g, ' ').trim() : '',
               rows: JSON.parse(localStorage.getItem('bm_rows_v1') || '[]').filter(r => r[1] === '친구요청').length };
    }""")
    print('요청 후', after)
    page.screenshot(path='%s/배드민턴_v1.38_라이브_친구추가_요청보냄.png' % OUT)
    check('코드로 요청: 보냄 표시', '요청 보냄' in after['text'], after['text'])
    check('코드로 요청: 친구요청 행 1개', after['rows'] == 1, after['rows'])

    # 시트 닫고 채팅 닫기
    page.click('#sheet .sheet__head [data-close]')
    page.wait_for_timeout(500)
    page.click('[data-dm-close]')
    page.wait_for_timeout(500)

    # ── ③ 1:1 매칭
    page.click('[data-tab="matching"]')
    page.wait_for_timeout(900)
    if page.query_selector('[data-act="show-all"]'):
        page.click('[data-act="show-all"]')
        page.wait_for_timeout(800)
    cards = page.evaluate("""() => {
      const list = Array.prototype.map.call(document.querySelectorAll('.pcard'), c => c.textContent.replace(/\\s+/g, ' ').trim());
      return { n: list.length, list: list, first: list[0] || '', hasAdd: !!document.querySelector('.pcard [data-friend-add]'),
               textAdd: document.body.innerText.includes('친구 추가'),
               overflow: document.documentElement.scrollWidth > window.innerWidth + 1 };
    }""")
    print('매칭 카드', cards['n'], cards['first'][:80])
    page.screenshot(path='%s/배드민턴_v1.38_라이브_매칭_카드_친추없음.png' % OUT)
    check('매칭: 카드 있음', cards['n'] > 0, cards['n'])
    check('매칭: 카드에 친구 추가 없음', not cards['hasAdd'] and not cards['textAdd'], cards)
    check('매칭: 카드에 요청하기', any('요청하기' in t for t in cards['list']), cards['list'][:3])
    check('매칭: 가로 넘침 없음', not cards['overflow'], cards['overflow'])

    # 받은 요청이 없는 카드를 골라 상세(편지지 작성)를 확인합니다
    page.locator('.pcard', has_text='요청하기').first.click()
    page.wait_for_timeout(800)
    prof = page.evaluate("""() => {
      const s = document.querySelector('#sheet');
      return { title: s ? s.querySelector('.sheet__head h2').textContent : null,
               text: s ? s.innerText.replace(/\\s+/g, ' ').trim() : '',
               social: !!(s && s.querySelector('.pp__social')),
               send: !!(s && s.querySelector('[data-send-request]')),
               friendBtn: !!(s && s.querySelector('[data-friend-add]')) };
    }""")
    print('매칭 상세', prof['title'], len(prof['text']))
    page.screenshot(path='%s/배드민턴_v1.38_라이브_매칭_상세_친추없음.png' % OUT)
    check('매칭 상세: 친구 추가 버튼 없음', not prof['friendBtn'] and not prof['social'] and '친구 추가' not in prof['text'], prof)
    check('매칭 상세: 편지지 요청 보내기 있음', prof['send'], prof['send'])
    check('매칭 상세: 한마디 남기기', '한마디 남기기' in prof['text'], prof['text'][:120])

    page.click('#sheet .sheet__head [data-close]')
    page.wait_for_timeout(400)

    # ── 콘솔·요청 오류
    # 구글 로그인(GSI)은 127.0.0.1 오리진이 허용 목록에 없어 로컬에서만 403이 납니다(라이브는 등록된 주소)
    real_errs = [e for e in errs if 'GSI_LOGGER' not in e and 'accounts.google.com' not in e
                 and not (e.startswith('console: Failed to load resource') and '403' in e)]
    check('콘솔·페이지 오류 0건(로컬 GSI 403 제외)', len(real_errs) == 0, real_errs[:3])
    check('실패한 요청 0건', len(fails) == 0, fails[:3])

    ctx.close()
    b.close()

bad = [c for c in checks if not c[1]]
print('\n%d/%d 통과' % (len(checks) - len(bad), len(checks)))
for c in bad:
    print('  ✗', c[0])
sys.exit(1 if bad else 0)
