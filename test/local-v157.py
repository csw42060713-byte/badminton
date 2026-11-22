"""bm-v1.57.0 로컬 점검 (390×844) — 테마 전체 무료 · 인스타 공유 카드 · 푸시 알림 틀

· 127.0.0.1 로 띄운 저장소를 그대로 봅니다(Supabase·구글·지도 타일·CDN 요청은 막습니다).
· 진짜 앱(index.html)을 local 모드로 열고 실제 버튼을 눌러 확인합니다.
  A) 기존 5개 탭 정상 · 콘솔 오류 0 · CSP 위반 0 · 가로 넘침 0 · 버전 v1.57.0
  B) 테마 전체 무료 — MY › 테마에 잠금·하트 없음, 사쿠라를 눌러도 하트가 그대로
     · 시작 화면 카드에 '하트 2' 배지·유료 안내 없음
  C) 인스타 공유 카드 — 오늘 운동(다크 코트) · 대회 인증 · 내 사진 합성 · 투명 스티커
     · 1080×1350 PNG 저장(다운로드) · 스티커는 모서리 알파 0(배경 투명)
  D) MY 알림 · 편지지 — 실시간 푸시 알림 스위치·권한 상태(에러 없음)
  E) 최근 기록 상세·일지 저장 직후에도 공유 카드 입구
실행(저장소 루트에서):
  LD_LIBRARY_PATH=/workspace/tmp/deblibs/usr/lib/x86_64-linux-gnu:/workspace/tmp/deblibs/lib/x86_64-linux-gnu:/workspace/tmp/deblibs2/usr/lib/x86_64-linux-gnu:/workspace/tmp/deblibs2/lib/x86_64-linux-gnu \\
  (python3 -m http.server 8823 --bind 127.0.0.1 &) ; python3 test/local-v157.py
"""

import os

from PIL import Image
from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:8823/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'
PHOTO = '/workspace/tmp/v157_photo.jpg'
PLAYER = 'clean157@example.com'

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


def overflow(page):
    return page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")


def theme(page):
    return page.evaluate("() => document.documentElement.getAttribute('data-theme')")


def png_size(path):
    with Image.open(path) as im:
        return im.size, im.mode


def corner_alpha(path):
    with Image.open(path) as im:
        return im.convert('RGBA').getpixel((4, 4))[3]


# 사진 합성 확인용 — 위/아래 색이 다른 단순 사진 한 장
if not os.path.exists(PHOTO):
    im = Image.new('RGB', (1200, 1600), (18, 60, 120))
    for x in range(1200):
        for y in range(800):
            im.putpixel((x, y), (230, 160 + (x * 60 // 1200), 60))
    im.save(PHOTO, 'JPEG', quality=88)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block',
                        accept_downloads=True)
    # headless 셸은 Notification.permission이 늘 'denied'라서, 아직 묻지 않은 브라우저를 흉내 냅니다
    ctx.add_init_script("""
      try {
        Object.defineProperty(window, 'Notification', {
          configurable: true,
          value: function Notification() {},
        });
        window.Notification.permission = 'default';
        window.Notification.requestPermission = function () { return Promise.resolve('default'); };
      } catch (e) {}
    """)
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

    def login(email, nick):
        page.goto(BASE, wait_until='load')
        page.evaluate("""(a) => {
          try {
            localStorage.clear(); sessionStorage.clear();
            localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
            const s = { kind: 'email', email: a.email, name: a.nick, at: new Date().toISOString(),
                        onboardedAt: '2026-11-22 09:00:00',
                        profile: { nick: a.nick, level: 'B조', discipline: '복식', region: '경기',
                                   club: '나래울', onboardedAt: '2026-11-22 09:00:00' } };
            localStorage.setItem('bm_auth_v1', JSON.stringify(s));
            localStorage.setItem('bm_seen_v1', JSON.stringify(true));
          } catch (e) {}
        }""", {'email': email, 'nick': nick})
        page.reload(wait_until='load')
        page.wait_for_timeout(2600)

    def tap(sel, wait=420):
        page.click(sel)
        page.wait_for_timeout(wait)

    def shot(name):
        page.screenshot(path=OUT + '/v157_' + name + '.png')
        return OUT + '/v157_' + name + '.png'

    # ── A. 진입 · 5개 탭 ──
    login(PLAYER, '점검왕')
    check('A 앱 진입 · 버전 v1.57.0', page.evaluate("() => BM.app.version") == 'v1.57.0',
          page.evaluate("() => BM.app.version"))
    for tab in ['log', 'matching', 'community', 'coach', 'my']:
        tap("#tabbar [data-tab='%s']" % tab, 620)
        body = text_of(page, '#main')
        check('A 탭 %s 정상' % tab, len(body) > 40 and has(page, "[data-view='%s']" % tab),
              body[:40].replace('\n', ' '))
        w = overflow(page)
        check('A 탭 %s 가로 넘침 없음' % tab, w[0] <= w[1] + 1, w)

    # ── B. 테마 전체 무료 ──
    tap("#tabbar [data-tab='my']", 700)
    page.evaluate("() => { const d = document.querySelector('details[data-group=\"theme\"]'); if (d) d.open = true; }")
    page.wait_for_timeout(320)
    check('B 테마 4종 카드', count(page, '.theme[data-theme]') == 4, count(page, '.theme[data-theme]'))
    check('B 잠금·하트 배지 없음', not has(page, '.theme__lock'))
    hearts0 = page.evaluate("() => BM.app.ctx.store.state.data.hearts.balance")
    tap('.theme[data-theme="th_sakura"]', 700)
    check('B 사쿠라 바로 적용', theme(page) == 'th_sakura', theme(page))
    hearts1 = page.evaluate("() => BM.app.ctx.store.state.data.hearts.balance")
    check('B 하트 차감 없음', hearts0 == hearts1, '%s → %s' % (hearts0, hearts1))
    check('B 확인 창 없음(다이얼로그 0)', not [e for e in errs if e.startswith('DIALOG')], errs[:2])
    page.evaluate("() => document.querySelector('details[data-group=\"theme\"]').scrollIntoView({block:'start'})")
    page.wait_for_timeout(300)
    shot('themes_free_sakura')
    # 라임 코트도 그대로 무료
    tap('.theme[data-theme="th_court"]', 700)
    check('B 라임 코트 적용', theme(page) == 'th_court', theme(page))
    check('B 라임 코트도 하트 그대로',
          page.evaluate("() => BM.app.ctx.store.state.data.hearts.balance") == hearts0)
    onboarding = page.evaluate("""() => {
      BM.views.start.reset();
      return BM.views.start.renderOnboarding({ kind: 'guest', name: '새내기' });
    }""")
    check('B 시작 화면에 하트 2 배지 없음', '하트 2' not in onboarding and 'onbtheme__price' not in onboarding)
    check('B 시작 화면 앱 분위기 3종 그대로', onboarding.count('data-pick="theme"') == 3)

    # ── C. 일지 저장 → 인스타 공유 카드(오늘 운동) ──
    tap("#tabbar [data-tab='log']", 700)
    page.fill('[data-field="minutes"]', '90')
    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.drafts.log.cond = 8;
      st.drafts.log.games = [{ a: '21', b: '15' }, { a: '18', b: '21' }, { a: '21', b: '19' }];
      st.drafts.log.partner = '민호';
      st.drafts.log.rival = '지호';
    }""")
    tap('[data-act="save-log"]', 1600)
    check('C 저장 직후 공유 카드 버튼', has(page, '[data-region="share"] [data-act="share-card"]'))
    page.evaluate("() => document.querySelector('[data-region=\"share\"]').scrollIntoView({block:'center'})")
    page.wait_for_timeout(250)
    shot('sharebar_after_save')
    tap('[data-region="share"] [data-act="share-card"]', 900)
    check('C 공유 카드 시트 열림', has(page, '#sheet .sc__canvas'))
    check('C 시트 제목', '인스타 공유 카드' in text_of(page, '#sheet .sheet__head'))
    check('C 캔버스 1080×1350', page.evaluate(
        "() => { const c = document.querySelector('.sc__canvas'); return [c.width, c.height]; }") == [1080, 1350])
    check('C 두 모드 탭', count(page, '[data-sc-mode]') == 2)
    check('C 세 출력', count(page, '[data-sc-style]') == 3)
    check('C 큰 숫자에 90분', '90' in text_of(page, '[data-sc-summary]'), text_of(page, '[data-sc-summary]'))
    check('C 승패가 카드에', '2승 1패' in text_of(page, '[data-sc-summary]'), text_of(page, '[data-sc-summary]'))
    check('C 체육관·파트너 한 줄', '나래울' in text_of(page, '[data-sc-summary]'), text_of(page, '[data-sc-summary]'))
    page.locator('#sheet .sc__preview').scroll_into_view_if_needed()
    page.wait_for_timeout(300)
    shot('sharecard_today_sheet')
    page.locator('#sheet .sc__canvas').screenshot(path=OUT + '/v157_sharecard_today_canvas.png')
    with page.expect_download(timeout=15000) as dl:
        tap('[data-sc-save]', 300)
    d1 = dl.value
    path1 = OUT + '/v157_sharecard_today.png'
    d1.save_as(path1)
    size1, mode1 = png_size(path1)
    check('C 오늘 카드 PNG 1080×1350', size1 == (1080, 1350), size1)

    # ── C-2. 대회 인증 카드 ──
    tap('[data-sc-mode="comp"]', 600)
    check('C 대회 인증 입력칸', has(page, '[data-sc-field="contest"]') and has(page, '[data-sc-field="event"]'))
    page.fill('[data-sc-field="contest"]', '2026 전국 동호인 오픈')
    page.fill('[data-sc-field="event"]', 'B조 복식')
    tap('[data-sc-result="준우승"]', 300)
    page.fill('[data-sc-field="compPartner"]', '민호')
    page.wait_for_timeout(350)
    check('C 대회 카드 요약', '2026 전국 동호인 오픈' in text_of(page, '[data-sc-summary]'),
          text_of(page, '[data-sc-summary]'))
    check('C 성적 배지 준우승', '준우승' in text_of(page, '[data-sc-summary]'))
    page.locator('#sheet .sc__preview').scroll_into_view_if_needed()
    page.wait_for_timeout(300)
    shot('sharecard_contest_sheet')
    page.locator('#sheet .sc__canvas').screenshot(path=OUT + '/v157_sharecard_contest_canvas.png')
    with page.expect_download(timeout=15000) as dl:
        tap('[data-sc-save]', 300)
    path2 = OUT + '/v157_sharecard_contest.png'
    dl.value.save_as(path2)
    check('C 대회 카드 PNG 1080×1350', png_size(path2)[0] == (1080, 1350), png_size(path2)[0])

    # ── C-3. 내 사진 위에 얹기 ──
    tap('[data-sc-style="photo"]', 400)
    check('C 사진 고르기 입력(accept=image/*)',
          page.evaluate("() => { const i = document.querySelector('[data-sc-photo]'); return i ? i.accept : ''; }") == 'image/*')
    page.set_input_files('[data-sc-photo]', PHOTO)
    page.wait_for_timeout(900)
    check('C 사진이 캔버스에 합성됨', page.evaluate("""() => {
      const c = document.querySelector('.sc__canvas');
      const g = c.getContext('2d');
      const top = g.getImageData(10, 10, 1, 1).data;
      return [top[0], top[1], top[2], top[3]];
    }""") is not None)
    px = page.evaluate("""() => {
      const c = document.querySelector('.sc__canvas');
      const g = c.getContext('2d');
      return Array.from(g.getImageData(540, 300, 1, 1).data);
    }""")
    check('C 사진 색이 실제로 올라감(주황 계열)', px[0] > 120 and px[3] == 255, px)
    page.locator('#sheet .sc__preview').scroll_into_view_if_needed()
    page.wait_for_timeout(300)
    shot('sharecard_photo_sheet')
    page.locator('#sheet .sc__canvas').screenshot(path=OUT + '/v157_sharecard_photo_canvas.png')
    with page.expect_download(timeout=15000) as dl:
        tap('[data-sc-save]', 300)
    path3 = OUT + '/v157_sharecard_photo.png'
    dl.value.save_as(path3)
    check('C 사진 카드 PNG 1080×1350', png_size(path3)[0] == (1080, 1350), png_size(path3)[0])

    # ── C-4. 투명 스티커 ──
    tap('[data-sc-style="sticker"]', 450)
    check('C 스티커 안내', '투명' in text_of(page, '[data-sc-save]'), text_of(page, '[data-sc-save]'))
    page.locator('#sheet .sc__preview').scroll_into_view_if_needed()
    page.wait_for_timeout(300)
    shot('sharecard_sticker_sheet')
    with page.expect_download(timeout=15000) as dl:
        tap('[data-sc-save]', 300)
    path4 = OUT + '/v157_sharecard_sticker.png'
    dl.value.save_as(path4)
    check('C 스티커 PNG 1080×1350', png_size(path4)[0] == (1080, 1350), png_size(path4)[0])
    check('C 스티커 배경 투명(모서리 알파 0)', corner_alpha(path4) == 0, corner_alpha(path4))
    check('C 코트 카드는 불투명(알파 255)', corner_alpha(path1) == 255, corner_alpha(path1))

    # 시트 닫기
    tap('#sheet .sheet__head [data-close]', 400)

    # ── D. MY 알림 · 편지지 — 실시간 푸시 알림 ──
    tap("#tabbar [data-tab='my']", 700)
    page.evaluate("() => { const d = document.querySelector('details[data-group=\"alarm\"]'); if (d) d.open = true; }")
    page.wait_for_timeout(350)
    check('D 실시간 푸시 알림 줄', has(page, '[data-pref-row="push"]'))
    check('D 푸시 스위치', has(page, '[data-act="toggle-push"]'))
    check('D Firebase 준비 상태 문구', 'Firebase 연결 준비됨' in text_of(page, '[data-push-status]'),
          text_of(page, '[data-push-status]'))
    check('D 기존 알림·편지지 스위치 그대로',
          has(page, '[data-act="toggle-notify"]') and has(page, '[data-act="toggle-letter"]'))
    page.evaluate("() => document.querySelector('details[data-group=\"alarm\"]').scrollIntoView({block:'start'})")
    page.wait_for_timeout(300)
    shot('my_push_alarm')
    tap('[data-act="toggle-push"]', 900)
    check('D 스위치를 켜면 저장(prefs.push)', page.evaluate(
        "() => BM.app.ctx.store.state.prefs.push === true"))
    check('D 켠 뒤에도 에러 없음', len([e for e in errs if 'pageerror' in e]) == 0, errs[:3])
    check('D 상태 문구는 준비 상태 그대로', 'Firebase' in text_of(page, '[data-push-status]'),
          text_of(page, '[data-push-status]'))

    # ── E. MY 공유 카드 입구 · 최근 기록 상세 ──
    page.evaluate("() => { const d = document.querySelector('details[data-group=\"share\"]'); if (d) d.open = true; }")
    page.wait_for_timeout(300)
    check('E MY 공유 카드 입구', count(page, 'details[data-group="share"] [data-act="share-card"]') == 2,
          count(page, 'details[data-group="share"] [data-act="share-card"]'))
    page.evaluate("() => document.querySelector('details[data-group=\"share\"]').scrollIntoView({block:'center'})")
    page.wait_for_timeout(250)
    shot('my_share_entry')
    tap("#tabbar [data-tab='log']", 700)
    tap('.logrow', 700)
    check('E 최근 기록 상세에 공유 카드 버튼', has(page, '#sheet [data-act="share-card"]'))
    page.screenshot(path=OUT + '/v157_record_detail_share.png')
    tap('#sheet [data-act="share-card"]', 900)
    check('E 상세 → 공유 카드 시트', has(page, '#sheet .sc__canvas'))
    tap('#sheet .sheet__head [data-close]', 400)

    # ── F. 콘솔 · CSP ──
    check('F 콘솔 오류 0', len(errs) == 0, errs[:3])
    check('F CSP 위반 0', len(csp) == 0, csp[:3])
    check('F 가로 넘침 0', overflow(page)[0] <= overflow(page)[1] + 1, overflow(page))

    b.close()

failed = [c for c in checks if not c[1]]
print('\n%d/%d 통과%s' % (len(checks) - len(failed), len(checks),
                        (' · 실패: ' + str([f[0] for f in failed])) if failed else ''))
raise SystemExit(1 if failed else 0)
