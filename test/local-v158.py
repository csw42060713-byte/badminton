"""bm-v1.58.0 로컬 점검 (390×844) — 인스타 카드 색상 5 × 디자인 3 · 동기화 막힘 해결

· 127.0.0.1 로 띄운 저장소를 그대로 봅니다(Supabase·구글·지도 타일·CDN 요청은 막습니다).
· 진짜 앱(index.html)을 local 모드로 열고 실제 버튼을 눌러 확인합니다.
  A) 기존 5개 탭 정상 · 콘솔 오류 0 · CSP 위반 0 · 가로 넘침 0 · 버전 v1.58.0
  B) 공유 카드 색상 칩 5개 · 디자인 칩 3개가 390 시트에서 한 줄에 눌리고 넘치지 않음
     · 나이트/코트 블루/챔피언 골드 × 미니멀/포스터/코트 라인을 실제로 눌러 캔버스 색 확인
     · 1080×1350 PNG 저장 + downloads/v158_*.png 카드 원본
  C) 동기화: 막힌 1건을 격리하면 뒤 4건이 나가고, MY › 고급에 대기열·오류·'대기 중 비우기'
     · 인증 만료 안내는 '로그인 세션이 만료됐어요'
실행(저장소 루트에서):
  LD_LIBRARY_PATH=/workspace/tmp/deblibs/usr/lib/x86_64-linux-gnu:/workspace/tmp/deblibs/lib/x86_64-linux-gnu:/workspace/tmp/deblibs2/usr/lib/x86_64-linux-gnu:/workspace/tmp/deblibs2/lib/x86_64-linux-gnu \\
  (python3 -m http.server 8824 --bind 127.0.0.1 &) ; python3 test/local-v158.py
"""

from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:8824/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'

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


def canvas_pixel(page, x, y):
    return page.evaluate("""(p) => {
      const c = document.querySelector('.sc__canvas');
      const g = c.getContext('2d');
      const d = g.getImageData(p.x, p.y, 1, 1).data;
      return [d[0], d[1], d[2], d[3]];
    }""", {'x': x, 'y': y})


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block',
                        accept_downloads=True)
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
    def on_dialog(d):
        errs.append('DIALOG: ' + d.message)
        d.dismiss()

    page.on('dialog', on_dialog)

    def login(nick='점검왕'):
        page.goto(BASE, wait_until='load')
        page.evaluate("""(a) => {
          try {
            localStorage.clear(); sessionStorage.clear();
            localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
            const s = { kind: 'email', email: 'clean158@example.com', name: a.nick,
                        at: new Date().toISOString(), onboardedAt: '2026-11-22 09:00:00',
                        profile: { nick: a.nick, level: 'B조', discipline: '복식', region: '경기',
                                   club: '나래울', onboardedAt: '2026-11-22 09:00:00' } };
            localStorage.setItem('bm_auth_v1', JSON.stringify(s));
            localStorage.setItem('bm_seen_v1', JSON.stringify(true));
          } catch (e) {}
        }""", {'nick': nick})
        page.reload(wait_until='load')
        page.wait_for_timeout(2600)

    def tap(sel, wait=420):
        page.click(sel)
        page.wait_for_timeout(wait)

    def shot(name):
        path = OUT + '/v158_' + name + '.png'
        page.screenshot(path=path)
        return path

    def canvas_png(name):
        page.locator('#sheet .sc__canvas').screenshot(path=OUT + '/v158_' + name + '.png')
        return OUT + '/v158_' + name + '.png'

    # ── A. 진입 · 5개 탭 ──
    login()
    check('A 앱 진입 · 버전 v1.58.0', page.evaluate("() => BM.app.version") == 'v1.58.0',
          page.evaluate("() => BM.app.version"))
    for tab in ['log', 'matching', 'community', 'coach', 'my']:
        tap("#tabbar [data-tab='%s']" % tab, 620)
        body = text_of(page, '#main')
        check('A 탭 %s 정상' % tab, len(body) > 40 and has(page, "[data-view='%s']" % tab),
              body[:40].replace('\n', ' '))
        w = overflow(page)
        check('A 탭 %s 가로 넘침 없음' % tab, w[0] <= w[1] + 1, w)

    # ── B. 일지 저장 → 공유 카드 시트 ──
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
    tap('[data-region="share"] [data-act="share-card"]', 900)
    check('B 공유 카드 시트 열림', has(page, '#sheet .sc__canvas'))
    check('B 색상 칩 5개', count(page, '[data-sc-pal]') == 5, count(page, '[data-sc-pal]'))
    check('B 디자인 칩 3개', count(page, '[data-sc-layout]') == 3, count(page, '[data-sc-layout]'))
    labels = page.evaluate("() => Array.from(document.querySelectorAll('[data-sc-pal] b')).map(n => n.innerText)")
    check('B 색 이름 그대로', labels == ['나이트', '코트 블루', '선셋', '사쿠라', '챔피언 골드'], labels)
    layouts = page.evaluate("() => Array.from(document.querySelectorAll('[data-sc-layout] b')).map(n => n.innerText)")
    check('B 디자인 이름 그대로', layouts == ['미니멀', '포스터', '코트 라인'], layouts)

    # 칩이 한 줄에 나란히 (세로 위치가 같고, 시트 폭을 넘지 않음)
    pal_rows = page.evaluate("""() => {
      const r = Array.from(document.querySelectorAll('[data-sc-pal]')).map(n => n.getBoundingClientRect());
      return { tops: r.map(x => Math.round(x.top)), left: Math.round(r[0].left), right: Math.round(r[4].right), w: window.innerWidth };
    }""")
    check('B 색상 5칸 한 줄', len(set(pal_rows['tops'])) == 1, pal_rows)
    check('B 색상 칩이 화면 폭 안', pal_rows['left'] >= 0 and pal_rows['right'] <= pal_rows['w'], pal_rows)
    lay_rows = page.evaluate("""() => {
      const r = Array.from(document.querySelectorAll('[data-sc-layout]')).map(n => n.getBoundingClientRect());
      return { tops: r.map(x => Math.round(x.top)), right: Math.round(r[2].right), w: window.innerWidth };
    }""")
    check('B 디자인 3칸 한 줄', len(set(lay_rows['tops'])) == 1, lay_rows)
    check('B 디자인 칩이 화면 폭 안', lay_rows['right'] <= lay_rows['w'], lay_rows)
    w = overflow(page)
    check('B 시트 가로 넘침 없음', w[0] <= w[1] + 1, w)

    page.locator('#sheet [data-sc-pal]').first.scroll_into_view_if_needed()
    page.wait_for_timeout(300)
    shot('sharecard_colors_layouts')

    # ── B-2. 기본(나이트 · 미니멀) 캔버스 ──
    base_px = canvas_pixel(page, 560, 40)
    check('B 기본 카드 = 나이트(어두운 초록)', base_px[1] > base_px[2] and base_px[0] < 40, base_px)
    canvas_png('card_night_minimal')

    # ── B-3. 코트 블루 × 미니멀 ──
    tap('[data-sc-pal="court"]', 450)
    court_px = canvas_pixel(page, 560, 40)
    check('B 코트 블루 배경(파랑이 가장 큼)', court_px[2] > court_px[0] and court_px[2] > 20, court_px)
    check('B 코트 블루 선택 표시', page.evaluate(
        "() => document.querySelector('[data-sc-pal=\\\"court\\\"]').classList.contains('is-on')"))
    canvas_png('card_court_blue_minimal')

    # ── B-4. 챔피언 골드 × 미니멀 ──
    tap('[data-sc-pal="gold"]', 450)
    gold_px = canvas_pixel(page, 560, 40)
    check('B 챔피언 골드 배경(딥 블랙 + 골드 빛)', max(gold_px[:3]) < 90 and gold_px[0] >= gold_px[2], gold_px)
    canvas_png('card_gold_minimal')

    # ── B-5. 선셋 × 포스터 ──
    tap('[data-sc-pal="sunset"]', 350)
    tap('[data-sc-layout="poster"]', 500)
    check('B 포스터 선택 표시', page.evaluate(
        "() => document.querySelector('[data-sc-layout=\\\"poster\\\"]').classList.contains('is-on')"))
    band_px = canvas_pixel(page, 540, 100)
    check('B 포스터 위 배너가 선셋 색', band_px[0] > band_px[2], band_px)
    check('B 포스터 카드 요약', '포스터' in text_of(page, '[data-sc-summary]'), text_of(page, '[data-sc-summary]'))
    canvas_png('card_sunset_poster')

    # ── B-6. 코트 블루 × 코트 라인 ──
    tap('[data-sc-pal="court"]', 350)
    tap('[data-sc-layout="courtline"]', 500)
    line_px = canvas_pixel(page, 560, 1270)
    check('B 코트 라인 카드 배경', line_px[2] >= line_px[0], line_px)
    check('B 코트 라인 요약', '코트 라인' in text_of(page, '[data-sc-summary]'), text_of(page, '[data-sc-summary]'))
    canvas_png('card_court_line')

    # ── B-7. 대회 인증 + 챔피언 골드 포스터 ──
    tap('[data-sc-mode="comp"]', 700)
    page.fill('[data-sc-field="contest"]', '2026 전국 동호인 오픈')
    page.fill('[data-sc-field="event"]', 'B조 복식')
    tap('[data-sc-result="준우승"]', 300)
    page.fill('[data-sc-field="compPartner"]', '민호')
    tap('[data-sc-pal="gold"]', 350)
    tap('[data-sc-layout="poster"]', 500)
    page.wait_for_timeout(300)
    check('B 대회 카드 요약', '2026 전국 동호인 오픈' in text_of(page, '[data-sc-summary]'),
          text_of(page, '[data-sc-summary]'))
    page.locator('#sheet .sc__preview').scroll_into_view_if_needed()
    page.locator('#sheet [data-sc-pal]').first.scroll_into_view_if_needed()
    page.wait_for_timeout(300)
    shot('sharecard_contest_gold_poster_sheet')
    page.locator('#sheet .sc__preview').scroll_into_view_if_needed()
    page.wait_for_timeout(250)
    canvas_png('card_gold_contest_poster')

    # ── B-8. PNG 저장(다운로드) ──
    page.locator('#sheet [data-sc-save]').scroll_into_view_if_needed()
    with page.expect_download(timeout=15000) as dl:
        tap('[data-sc-save]', 300)
    path = OUT + '/v158_sharecard_saved.png'
    dl.value.save_as(path)
    check('B 저장한 카드 PNG 이름', dl.value.suggested_filename == 'badminton-share-20261123-contest.png',
          dl.value.suggested_filename)

    # ── C. 동기화: 막힌 1건 격리 + MY 대기열/오류/비우기 ──
    page.evaluate("() => { const b = document.querySelector('#sheet .sheet__close, #sheet [data-close]'); if (b) b.click(); }")
    page.wait_for_timeout(400)
    page.evaluate("() => { if (BM.ui && BM.ui.closeSheet) BM.ui.closeSheet(); }")
    page.wait_for_timeout(400)
    sync = page.evaluate("""async () => {
      const store = BM.app.ctx.store;
      const st = store.actions._state();
      st.mode = 'supabase';
      const api = {
        mode: 'supabase',
        append: () => { const e = new BM.api.ApiError('forbidden', '서버 권한을 확인하지 못했어요.', false); e.status = 403; return Promise.reject(e); },
        update: () => Promise.resolve({ ok: true }),
        remove: () => Promise.resolve({ ok: true })
      };
      store.actions._replaceApi(api);
      st.queue = [
        { kind: 'append', row: ['t1'], clientId: 'q1' },
        { kind: 'update', id: 'r1', cells: {}, clientId: 'q2' },
        { kind: 'update', id: 'r2', cells: {}, clientId: 'q3' },
        { kind: 'update', id: 'r3', cells: {}, clientId: 'q4' },
        { kind: 'update', id: 'r4', cells: {}, clientId: 'q5' }
      ];
      const before = st.queue.length;
      await store.actions._flush();
      await new Promise(r => setTimeout(r, 200));
      BM.app.repaint();
      await new Promise(r => setTimeout(r, 300));
      return { before, queue: st.queue.length, blocked: st.syncBlocked.length, kind: st.syncErrorKind,
               error: st.syncError, writes: st.stats.writes };
    }""")
    page.wait_for_timeout(400)
    check('C 막힌 1건만 격리하고 뒤 4건 전송', sync['queue'] == 0 and sync['blocked'] == 1 and sync['writes'] >= 4, sync)
    check('C 원인 문구에 건너뜀', '건너뛰' in (sync['error'] or ''), sync['error'])
    bar = text_of(page, '#netbar') if has(page, '#netbar') else ''
    check('C 상단 막대에 건너뛴 저장 안내', '건너뛰' in bar, bar)

    tap("#tabbar [data-tab='my']", 700)
    page.evaluate("(sel) => { const n = document.querySelector(sel); if (n) n.open = true; }", 'details[data-group=data]')
    page.wait_for_timeout(250)
    page.evaluate("(sel) => { const n = document.querySelector(sel); if (n) n.open = true; }", 'details[data-adv=sheets]')
    page.wait_for_timeout(400)
    my = text_of(page, '#main')
    check('C MY에 대기열·건너뛴 저장', '대기 중인 저장' in my and '건너뛴 저장' in my, my[:120])
    check('C MY에 대기 중 비우기', '대기 중 비우기' in my and has(page, '[data-act="clear-queue"]'))
    check('C MY에 마지막 오류', '서버 권한을 확인하지 못했어요' in my)
    page.evaluate("() => { const n = document.querySelector('[data-sync-box]'); if (n) n.scrollIntoView({block:'center'}); }")
    page.wait_for_timeout(350)
    shot('my_sync_queue')

    # '대기 중 비우기' → 확인 시트(취소/비우기) → 대기열/격리 비움
    tap('[data-act="clear-queue"]', 600)
    visible = text_of(page, '#sheet')
    check('C 비우기는 확인을 한 번 묻는다', '되돌릴' in visible or '비울까요' in visible, visible[:120])
    tap('#sheet [data-act="yes"]', 900)
    after = page.evaluate("""() => {
      const st = BM.app.ctx.store.actions._state();
      return { queue: st.queue.length, blocked: (st.syncBlocked || []).length, error: st.syncError, kind: st.syncErrorKind };
    }""")
    check('C 비우기 후 대기열·격리 0', after['queue'] == 0 and after['blocked'] == 0 and after['error'] is None, after)
    page.evaluate("(sel) => { const n = document.querySelector(sel); if (n) n.open = true; }", 'details[data-group=data]')
    page.wait_for_timeout(200)
    page.evaluate("(sel) => { const n = document.querySelector(sel); if (n) n.open = true; }", 'details[data-adv=sheets]')
    page.wait_for_timeout(300)
    my2 = text_of(page, '#main')
    check('C 비우고 나면 빈 상태 안내', '보내지 못한 저장이 없어요' in my2, my2[:120])

    # 인증 만료는 '다시 로그인' 안내
    auth = page.evaluate("""async () => {
      const store = BM.app.ctx.store;
      const st = store.actions._state();
      const api = { mode: 'supabase',
        append: () => Promise.reject(Object.assign(new BM.api.ApiError('session', '로그인 세션이 만료됐어요. MY에서 다시 로그인해 주세요.', false), { status: 401 })),
        update: () => Promise.reject(Object.assign(new BM.api.ApiError('session', '로그인 세션이 만료됐어요. MY에서 다시 로그인해 주세요.', false), { status: 401 })),
        remove: () => Promise.resolve({ ok: true }) };
      store.actions._replaceApi(api);
      st.queue = [{ kind: 'update', id: 'rX', cells: {}, clientId: 'q9' }];
      await store.actions._flush();
      BM.app.repaint();
      await new Promise(r => setTimeout(r, 250));
      return { kind: st.syncErrorKind, error: st.syncError, queued: st.queue.length };
    }""")
    page.wait_for_timeout(300)
    bar2 = text_of(page, '#netbar') if has(page, '#netbar') else ''
    check('C 인증 만료 종류', auth['kind'] == 'auth', auth)
    check('C 인증 만료 대기열은 그대로', auth['queued'] == 1, auth)
    check('C 상단 막대에 다시 로그인 안내', '로그인 세션이 만료됐어요' in bar2, bar2)
    page.evaluate("() => { const n = document.querySelector('[data-sync-box]'); if (n) n.scrollIntoView({block:'center'}); }")
    page.wait_for_timeout(300)
    shot('my_sync_auth')

    # ── D. 콘솔·CSP ──
    check('D 콘솔 오류 0', not errs, errs[:3])
    check('D CSP 위반 0', not csp, csp[:2])
    check('D 가로 넘침 0 (마지막 화면)', overflow(page)[0] <= overflow(page)[1] + 1, overflow(page))

    b.close()

failed = [c for c in checks if not c[1]]
print('\n%d/%d 통과%s' % (len(checks) - len(failed), len(checks),
                        (' · 실패: ' + ', '.join(c[0] for c in failed)) if failed else ''))
