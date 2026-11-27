"""bm-v1.56.0 라이브 점검 (390×844) — 일지 컨디션 5단계 · 시작 화면 앱 분위기 3종

· 127.0.0.1 로 띄운 저장소를 그대로 봅니다(Supabase·구글·지도 타일·CDN 요청은 막습니다).
· 진짜 앱(index.html)을 local 모드로 열고 실제 버튼을 눌러 확인합니다.
  A) 기존 5개 탭 정상 · 콘솔 오류 0 · CSP 위반 0 · 가로 넘침 0 · 버전 v1.56.0
  B) 일지 컨디션 — 5단계 카드(1~2·3~4·5~6·7~8·9~10) · 누르면 대표 점수(2·4·6·8·10) 저장
     · 다시 누르면 미입력 · 저장하면 1~10 숫자 그대로(평균 컨디션·AI 계산 그대로)
     · 예전에 3·7처럼 저장된 지난 일지를 고치면 그 구간이 켜짐
  C) 다크·라이트·사쿠라 세 테마에서 카드가 앱 톤으로 보임
  D) 시작(온보딩) — 앱 분위기 3종을 누르면 화면 전체가 바로 그 테마로 미리 보기
     · 여성일 때만 사쿠라에 '추천' 배지(강제 적용 없음) · 시작하기를 누르면 저장되어 앱 전체에 적용
· 실행(저장소 루트에서):
  LD_LIBRARY_PATH=/workspace/tmp/deblibs/usr/lib/x86_64-linux-gnu:/workspace/tmp/deblibs/lib/x86_64-linux-gnu:/workspace/tmp/deblibs2/usr/lib/x86_64-linux-gnu:/workspace/tmp/deblibs2/lib/x86_64-linux-gnu \\
  (python3 -m http.server 8822 --bind 127.0.0.1 &) ; python3 test/local-v156.py
"""

import time

from playwright.sync_api import sync_playwright

BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'
PLAYER = 'live156@example.com'

checks, errs, csp, blocked = [], [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:260]) if extra else ''))
    checks.append((label, bool(cond)))


def text_of(page, sel):
    return page.evaluate("(s) => { const n = document.querySelector(s); return n ? n.innerText : ''; }", sel)


def has(page, sel):
    return page.evaluate("(s) => !!document.querySelector(s)", sel)


def count(page, sel):
    return page.evaluate("(s) => document.querySelectorAll(s).length", sel)


def val(page, sel):
    return page.evaluate("(s) => { const n = document.querySelector(s); return n ? n.value : ''; }", sel)


def visible(page, sel):
    return page.evaluate(
        "(s) => { const n = document.querySelector(s); if (!n) return false;"
        " if (n.checkVisibility) return n.checkVisibility();"
        " const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0; }",
        sel)


def overflow(page):
    return page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")


def theme(page):
    return page.evaluate("() => document.documentElement.getAttribute('data-theme')")


def draft_cond(page):
    return page.evaluate("() => BM.app.ctx.store.state.drafts.log.cond")


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    ctx.route('**/*', lambda route: route.abort()
              if ('supabase.co' in route.request.url or 'google' in route.request.url
                  or 'jsdelivr' in route.request.url
                  or 'tile.openstreetmap.org' in route.request.url)
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

    def login(email, nick, onboarded=True):
        page.goto(BASE, wait_until='load')
        page.evaluate("""(a) => {
          try {
            localStorage.clear(); sessionStorage.clear();
            localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
            const s = { kind: 'email', email: a.email, name: a.nick, at: new Date().toISOString() };
            if (a.onboarded) {
              s.onboardedAt = '2026-11-22 09:00:00';
              s.profile = { nick: a.nick, level: 'B조', discipline: '복식', region: '경기',
                            club: '나래울', onboardedAt: '2026-11-22 09:00:00' };
            }
            localStorage.setItem('bm_auth_v1', JSON.stringify(s));
            localStorage.setItem('bm_seen_v1', JSON.stringify(true));
          } catch (e) {}
        }""", {'email': email, 'nick': nick, 'onboarded': onboarded})
        page.reload(wait_until='load')
        page.wait_for_timeout(2600)

    def tap(sel, wait=420):
        page.click(sel)
        page.wait_for_timeout(wait)


    # ── A-0. 배포본 파일 버전 ──
    import urllib.request

    def get(url):
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        return urllib.request.urlopen(req, timeout=30).read().decode('utf-8', 'replace')

    stamp = '?l=' + str(int(time.time()))
    sw = get(BASE + 'sw.js' + stamp)
    index = get(BASE + 'index.html' + stamp)
    appjs = get(BASE + 'app.js' + stamp)
    twa = get(BASE + 'twa-manifest.json' + stamp)
    dom = get(BASE + 'js/domain.js' + stamp)
    logjs = get(BASE + 'js/views/log.js' + stamp)
    startjs = get(BASE + 'js/views/start.js' + stamp)
    css = get(BASE + 'styles.css' + stamp)
    check('A-0 sw.js bm-v1.56.0', "var VERSION = 'bm-v1.56.0'" in sw)
    check('A-0 app.js v1.56.0', "version: 'v1.56.0'" in appjs)
    check('A-0 index styles.css?v=20261122-70', 'styles.css?v=20261122-70' in index)
    check('A-0 TWA 1.56.0 · 코드 50', '"appVersionName": "1.56.0"' in twa and '"appVersionCode": 50' in twa,
          twa[twa.find('appVersionName'):][:60])
    check('A-0 domain.js 컨디션 5단계·앱 분위기 3종', 'CONDITION_BANDS' in dom and 'onbThemes' in dom)
    check('A-0 log.js 5단계 카드', 'data-cond-band' in logjs)
    check('A-0 start.js 앱 분위기 카드', 'data-pick="theme"' in startjs and 'previewTheme' in startjs)
    check('A-0 styles.css 5단계·테마 카드', '.condbands' in css and '.onbtheme__mini' in css)

    # ── A. 진입 · 5개 탭 ──
    login(PLAYER, '점검왕')
    ver = page.evaluate("() => BM.app.version")
    check('A 앱 진입 · 버전 v1.56.0', ver == 'v1.56.0', ver)

    for tab in ['log', 'matching', 'community', 'coach', 'my']:
        tap("#tabbar [data-tab='%s']" % tab, 620)
        body = text_of(page, '#main')
        check('A 탭 %s 정상' % tab, len(body) > 40 and has(page, "[data-view='%s']" % tab),
              body[:40].replace('\n', ' '))
        w = overflow(page)
        check('A 탭 %s 가로 넘침 없음' % tab, w[0] <= w[1] + 1, w)

    # ── B. 일지 — 컨디션 5단계 ──
    tap("#tabbar [data-tab='log']", 700)
    check('B 컨디션 5단계 카드가 있다', count(page, '[data-cond-band]') == 5, count(page, '[data-cond-band]'))
    labels = ['오늘은 회복이 먼저', '가볍게 몸 풀기', '무난한 컨디션', '오늘은 제대로 달리자', '컨디션 최고!']
    form_text = text_of(page, '[data-form="log"]')
    check('B 5단계 한 줄 기준 문구', all(l in form_text for l in labels),
          [l for l in labels if l not in form_text])
    check('B 예전 1~10 슬라이더는 없다', not has(page, '[aria-label="컨디션 1에서 10"]'))
    check('B 훈련강도 슬라이더는 그대로', has(page, '[aria-label="훈련 강도 1에서 10"]'))
    check('B 처음엔 미입력', text_of(page, '[data-out="cond"]').strip() == '미입력',
          text_of(page, '[data-out="cond"]'))
    check('B 다크 테마 카드가 보인다(높이 ≥ 44px)',
          page.evaluate("""() => {
            const n = document.querySelector('[data-cond-band="normal"]');
            const r = n.getBoundingClientRect(); return r.height >= 44;
          }"""))
    page.locator('[data-form="log"]').screenshot(path=OUT + '/v156_live_log_cond_dark_form.png')
    page.evaluate("() => document.querySelector('.card[data-form=\"log\"]').scrollIntoView({block:'start'})")
    page.wait_for_timeout(300)
    page.screenshot(path=OUT + '/v156_live_log_cond_dark.png')

    tap('[data-cond-band="light"]', 380)
    check('B 3~4를 누르면 4로 저장 준비', draft_cond(page) == 4, draft_cond(page))
    check('B 오른쪽에 구간 표시 3~4점', '3~4점' in text_of(page, '[data-out="cond"]'),
          text_of(page, '[data-out="cond"]'))
    check('B 누른 카드만 켜짐', page.evaluate("""() => {
      const on = [...document.querySelectorAll('[data-cond-band]')].filter(b => b.classList.contains('is-on'));
      return on.length === 1 && on[0].getAttribute('data-cond-band') === 'light';
    }"""))
    page.locator('[data-form="log"]').screenshot(path=OUT + '/v156_live_log_cond_selected_form.png')

    tap('[data-cond-band="light"]', 380)
    check('B 다시 누르면 미입력으로 돌아감', draft_cond(page) is None and text_of(page, '[data-out="cond"]').strip() == '미입력',
          draft_cond(page))

    tap('[data-cond-band="normal"]', 350)
    page.fill('[data-field="minutes"]', '60')
    tap('[data-act="save-log"]', 1500)
    rec = page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      const r = (st.data.records || [])[0] || null;
      return r ? { cond: r.cond, minutes: r.minutes, id: r.id } : null;
    }""")
    check('B 저장된 컨디션은 숫자 6 그대로', rec and rec['cond'] == 6, rec)
    check('B 최근 기록에 컨디션 6이 보인다', '컨디션 6' in text_of(page, '[data-region="recent"]'),
          text_of(page, '[data-region="recent"]')[:120])

    # 예전 값(3, 7)으로 저장된 지난 일지를 고칠 때 그 구간이 켜지는지
    for old, band, out in [(3, 'light', '3~4점'), (7, 'go', '7~8점'), (9, 'best', '9~10점')]:
        page.evaluate("""(o) => {
          const D = BM.domain, U = BM.util, A = BM.auth;
          const key = A.rowsKeyFor();
          const rows = JSON.parse(localStorage.getItem(key) || '[]');
          rows.push(D.toRow({ id: 'old156_' + o.old, type: '기록', createdAt: '2026-11-19 09:00:00',
                              date: '2026-11-19', nick: '점검왕', userKey: A.meKeyFor(), cond: o.old,
                              games: [{ a: '21', b: '17' }], result: '승' }));
          localStorage.setItem(key, JSON.stringify(rows));
        }""", {'old': old})
        page.reload(wait_until='load')
        page.wait_for_timeout(2400)
        page.evaluate("(id) => { BM.app.ctx.store.actions.startEditLog(id); BM.app.repaint(); }", 'old156_%d' % old)
        page.wait_for_timeout(700)
        on = page.evaluate("""() => {
          const on = [...document.querySelectorAll('[data-cond-band]')].filter(b => b.classList.contains('is-on'));
          return on.length === 1 ? on[0].getAttribute('data-cond-band') : 'none:' + on.length;
        }""")
        check('B 옛 일지 컨디션 %d → %s 구간이 켜짐' % (old, band), on == band, on)
        check('B 옛 일지 표시 %s' % out, out in text_of(page, '[data-out="cond"]'), text_of(page, '[data-out="cond"]'))
        if old == 3:
            page.evaluate("() => document.querySelector('[data-form=\"log\"]').scrollIntoView({block:'start'})")
            page.wait_for_timeout(300)
            page.screenshot(path=OUT + '/v156_live_log_edit_old3.png')
        page.evaluate("() => { BM.app.ctx.store.actions.cancelEditLog(); BM.app.repaint(); }")
        page.wait_for_timeout(400)

    # ── C. 세 테마에서 카드 톤 ──
    for tid, name in [('th_def', 'light'), ('th_sakura', 'sakura'), ('th_night', 'dark')]:
        page.evaluate("(t) => { BM.app.ctx.store.state.locks = {}; BM.app.ctx.store.actions.setTheme(t);"
                      " BM.app.repaint(); }", tid)
        page.wait_for_timeout(700)
        check('C %s 테마 적용' % name, theme(page) == tid, theme(page))
        check('C %s 테마에서 카드 5장 보임' % name, count(page, '[data-cond-band]') == 5)
        w = overflow(page)
        check('C %s 테마 가로 넘침 없음' % name, w[0] <= w[1] + 1, w)
        page.evaluate("() => document.querySelector('[data-form=\"log\"]').scrollIntoView({block:'start'})")
        page.wait_for_timeout(250)
        page.screenshot(path=OUT + '/v156_live_log_cond_%s.png' % name)

    # ── D. 시작(온보딩) — 앱 분위기 3종 ──
    login('newbie156live@example.com', '새내기', onboarded=False)
    check('D 온보딩이 뜬다', has(page, '[data-act="finish"]'))
    check('D 앱 분위기 카드 3장', count(page, '[data-pick="theme"]') == 3, count(page, '[data-pick="theme"]'))
    onb_text = text_of(page, '#main')
    check('D 세 가지 분위기 이름 안내', all(s in onb_text for s in ['나이트', '기본 코트', '사쿠라']), onb_text[-200:])
    check('D 사쿠라는 하트 2 안내', '하트 2' in onb_text)
    check('D 처음엔 추천 배지 숨김', page.evaluate(
        "() => { const n = document.querySelector('[data-onb-rec=\"th_sakura\"]'); return !!n && n.hidden; }"))

    page.evaluate("() => document.querySelector('[data-onb-theme]').scrollIntoView({block:'center'})")
    page.wait_for_timeout(300)
    page.screenshot(path=OUT + '/v156_live_onb_theme.png')

    tap('[data-pick="theme"][data-val="th_def"]', 450)
    check('D 라이트를 누르면 화면 전체가 라이트로 미리 보기', theme(page) == 'th_def', theme(page))
    page.evaluate("() => document.querySelector('[data-onb-theme]').scrollIntoView({block:'center'})")
    page.wait_for_timeout(250)
    page.screenshot(path=OUT + '/v156_live_onb_light.png')

    tap('[data-pick="gender"][data-val="여성"]', 350)
    check('D 여성이면 사쿠라에 추천 배지', page.evaluate(
        "() => { const n = document.querySelector('[data-onb-rec=\"th_sakura\"]'); return !!n && !n.hidden; }"))
    check('D 추천은 사쿠라에만', page.evaluate(
        "() => document.querySelectorAll('[data-onb-rec]:not([hidden])').length === 1"))

    tap('[data-pick="theme"][data-val="th_sakura"]', 500)
    check('D 사쿠라를 누르면 화면이 핑크로 미리 보기', theme(page) == 'th_sakura', theme(page))
    check('D 사쿠라 안내 한 줄', '하트 2개로 여는 테마' in text_of(page, '[data-onb-theme-note]'),
          text_of(page, '[data-onb-theme-note]'))
    w = overflow(page)
    check('D 온보딩 가로 넘침 없음', w[0] <= w[1] + 1, w)
    page.evaluate("() => document.querySelector('[data-onb-theme]').scrollIntoView({block:'center'})")
    page.wait_for_timeout(250)
    page.screenshot(path=OUT + '/v156_live_onb_sakura.png')

    page.click('[data-pick="gender"][data-val="남성"]')
    page.wait_for_timeout(300)
    check('D 남성으로 바꾸면 추천 배지 사라짐(강제 없음)', page.evaluate(
        "() => { const n = document.querySelector('[data-onb-rec=\"th_sakura\"]'); return !!n && n.hidden; }"))
    check('D 남성도 사쿠라 선택은 그대로', theme(page) == 'th_sakura', theme(page))

    # 마저 채우고 시작하기 → 고른 테마가 저장되어 앱 전체에 적용
    page.click('[data-pick="role"][data-val="club"]')
    page.wait_for_timeout(250)
    page.fill('#onbNick', '새내기')
    page.click('[data-pick="level"][data-val="C조"]')
    page.click('[data-pick="discipline"][data-val="복식"]')
    page.wait_for_timeout(250)
    page.click('[data-act="finish"]')
    page.wait_for_timeout(2600)
    for _ in range(4):
        if page.query_selector('#sheet .sheet__head [data-close]'):
            try:
                page.click('#sheet .sheet__head [data-close]', timeout=1200)
            except Exception:
                pass
            page.wait_for_timeout(220)
    check('D 시작 후 일지 화면으로 들어옴', has(page, '[data-form="log"]'))
    applied = page.evaluate("() => BM.app.ctx.store.state.me.theme.theme")
    check('D 고른 사쿠라가 저장됨', applied == 'th_sakura', applied)
    check('D 화면 전체(html data-theme)도 사쿠라', theme(page) == 'th_sakura', theme(page))
    bal = page.evaluate("() => BM.app.ctx.store.state.data.hearts.balance")
    check('D 사쿠라는 하트 2개로 열림(3 → 1)', bal == 1, bal)
    page.wait_for_timeout(400)
    page.evaluate("() => document.querySelector('[data-form=\"log\"]').scrollIntoView({block:'start'})")
    page.wait_for_timeout(300)
    page.screenshot(path=OUT + '/v156_live_sakura_applied.png')

    # 새로고침해도 테마가 유지되는지
    page.reload(wait_until='load')
    page.wait_for_timeout(2600)
    check('D 새로고침해도 사쿠라 유지', theme(page) == 'th_sakura', theme(page))
    check('D 새로고침 후에도 컨디션 카드 5장', count(page, '[data-cond-band]') == 5)

    # ── E. 콘솔 · CSP ──
    check('E 콘솔 오류 0', len(errs) == 0, errs[:3])
    check('E CSP 위반 0', len(csp) == 0, csp[:3])

    b.close()

failed = [c for c in checks if not c[1]]
print('\n%d/%d 통과%s' % (len(checks) - len(failed), len(checks), (' · 실패: ' + str([f[0] for f in failed])) if failed else ''))
raise SystemExit(1 if failed else 0)
