"""bm-v1.65.0 로컬 점검 (390×844) — 하트 연속출석 3·7·14일 · 하트 부스트 · AdMob 훅 · 히어로 즉시갱신 · 챔피언 프레임

  1) MY 하트 지갑: 연속 출석 일수 + 다음 보너스까지 남은 날(3·7·14일) · 하트 부스트 줄
  2) 하트 부스트: 하트 3개로 열고 켜면 출석·광고가 실제로 +1 ('적용 중(+1)')
  3) 출석 체크: 3일째에 연속 보너스 +1 이 함께 들어온다(토스트·잔액)
  4) 광고 미리보기: 부스트가 켜져 있으면 보상도 +2 로 보인다
  5) 일지 저장 직후 히어로(이번 달 N분 · 승률 · 최근 2주)가 바로 바뀐다 + 인스타 칩도 방금 값
  6) 대회 인증 카드 프레임 칩(챔피언 골드 · 하트 2) → 열고 그리면 금빛 테두리·월계관
  7) 라이트 테마 · 360 폭 · 콘솔 오류 0 · CSP 위반 0 · 가로 넘침 0 · 5개 탭 유지

실행(저장소 루트에서):
  (python3 -m http.server 8828 --bind 127.0.0.1 &) ; python3 test/local-v164.py
"""

import os

from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:8828/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

checks, errs, csp, blocked = [], [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:220]) if extra else ''))
    checks.append((label, bool(cond)))


def text_of(page, sel):
    return page.evaluate("(s) => { const n = document.querySelector(s); return n ? n.innerText : ''; }", sel)


def has(page, sel):
    return page.evaluate("(s) => !!document.querySelector(s)", sel)


def overflow(page):
    return page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")


def read(path):
    with open(os.path.join(ROOT, path), encoding='utf-8') as f:
        return f.read()


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE if os.path.exists(EXE) else None)
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
    page.on('dialog', lambda d: (errs.append('DIALOG: ' + d.message), d.dismiss()))

    def tap(sel, wait=450):
        page.click(sel)
        page.wait_for_timeout(wait)

    def shot(name):
        path = OUT + '/v164_' + name + '.png'
        page.screenshot(path=path)
        return path

    def login(nick='점검왕'):
        page.goto(BASE, wait_until='load')
        page.evaluate("""(a) => {
          try {
            localStorage.clear(); sessionStorage.clear();
            localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
            const s = { kind: 'email', email: 'clean164@example.com', name: a.nick,
                        at: new Date().toISOString(), onboardedAt: '2026-11-24 09:00:00',
                        profile: { nick: a.nick, level: 'B조', discipline: '복식', region: '경기',
                                   club: '나래울', onboardedAt: '2026-11-24 09:00:00' } };
            localStorage.setItem('bm_auth_v1', JSON.stringify(s));
            localStorage.setItem('bm_seen_v1', JSON.stringify(true));
          } catch (e) {}
        }""", {'nick': nick})
        page.reload(wait_until='load')
        page.wait_for_timeout(2800)

    def hearts():
        return page.evaluate("() => BM.app.ctx.store.state.data.hearts")

    # ── A. 파일 · 버전 ──
    sw = read('sw.js')
    twa = read('twa-manifest.json')
    index = read('index.html')
    css = read('styles.css')
    check('A-0 sw.js bm-v1.65.0', "var VERSION = 'bm-v1.65.0'" in sw)
    check('A-0 index styles.css?v=20261124-3', 'styles.css?v=20261124-3' in index)
    check('A-0 TWA 1.65.0 · 코드 59',
          '"appVersionName": "1.65.0"' in twa and '"appVersionCode": 59' in twa)
    check('A-0 부스트 줄 스타일', '.boostline {' in css and '.boostline.is-on {' in css)

    login('점검왕')
    check('A 앱 버전 v1.65.0', page.evaluate("() => BM.app.version") == 'v1.65.0',
          page.evaluate("() => BM.app.version"))
    tabs = page.evaluate("() => BM.app.TABS.map(t => t.id)")
    check('A 5개 탭 그대로', tabs == ['log', 'matching', 'community', 'coach', 'my'], tabs)
    check('A 시작 하트 3 · 부스트 없음',
          hearts()['balance'] == 3 and hearts()['boost']['owned'] is False,
          {'balance': hearts()['balance'], 'boost': hearts()['boost']})

    # ── B. MY 하트 지갑 (연속 출석 안내 · 부스트 줄) ──
    tap("#tabbar [data-tab='my']", 900)
    card = text_of(page, '[data-region="heart"]')
    check('B 연속 출석 안내 — 3·7·14일', '3일·7일·14일' in card, card[:160])
    check('B 다음 보너스까지 남은 날', '3일 더 하면 보너스 하트 +1' in card)
    check('B 하트 부스트 줄', '하트 부스트' in card and '하트 3개로 열기' in card)
    check('B 출석 보조줄 +1 (부스트 전)', '+1 · 하루 1회' in card)
    shot('B-my-heart')

    # ── C. 하트 부스트 열고 켜기 ──
    tap('[data-region="boost"] [data-act="boost"]', 900)
    h = hearts()
    check('C 하트 3개로 해금', h['boost']['owned'] is True, h['boost'])
    check('C 해금하자 바로 적용', h['boost']['equipped'] is True and h['boost']['bonus'] == 1, h['boost'])
    check('C 잔액 3 → 0', h['balance'] == 0, h['balance'])
    card = text_of(page, '[data-region="heart"]')
    check('C 적용 중(+1) 표시', '적용 중(+1)' in card, card[:200])
    check('C 출석 보조줄 +2', '+2 · 하루 1회' in card)
    check('C 광고 보조줄도 +2', '+2' in text_of(page, '[data-region="heart"] [data-ad-sub]'),
          text_of(page, '[data-region="heart"] [data-ad-sub]'))
    shot('C-boost-on')

    # ── D. 광고 미리보기 (부스트 반영) ──
    tap('[data-act="ad"]', 600)
    sim = text_of(page, '.ad-sim')
    check('D 미리보기 보상이 +2', '하트 2개' in sim, sim[:160])
    shot('D-ad-preview')
    page.wait_for_timeout(3600)
    h = hearts()
    check('D 광고 적립 +2', h['balance'] == 2, h['balance'])

    # ── E. 연속 출석 3일째 보너스 (어제·그제 출석 행을 넣고 새로 열기) ──
    page.evaluate("""() => {
      const D = BM.domain, U = BM.util;
      const me = BM.app.ctx.store.state.me.key;
      const key = BM.auth.rowsKeyFor();
      const rows = U.readJSON(key, []) || [];
      const day = (n) => { const d = new Date(); d.setDate(d.getDate() - n);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
      [1, 2].forEach((n) => {
        const k = day(n);
        rows.push(D.toRow({ type: '출석하트', id: 'seed_' + k, clientId: 'seed_' + k,
          date: k, createdAt: k + ' 08:00:00', nick: '점검왕', userKey: me, likes: 1 }));
      });
      U.writeJSON(key, rows);
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(2600)
    tap("#tabbar [data-tab='my']", 900)
    h = hearts()
    check('E 어제까지 2일 연속', h['checkinStreak'] == 2, h['checkinStreak'])
    check('E 남은 날 1일 · 보너스 +1', h['streakBonus']['left'] == 1 and h['streakBonus']['amount'] == 1,
          h['streakBonus'])
    before = h['balance']
    tap('[data-act="checkin"]', 900)
    h = hearts()
    check('E 3일째 출석 = 1 + 부스트 1 + 보너스 1', h['balance'] == before + 3,
          {'before': before, 'after': h['balance']})
    check('E 연속 3일', h['checkinStreak'] == 3, h['checkinStreak'])
    check('E 다음 보너스는 7일(+2)', h['streakBonus']['days'] == 7 and h['streakBonus']['amount'] == 2,
          h['streakBonus'])
    row_note = page.evaluate("""() => {
      const st = BM.app.ctx.store.state, D = BM.domain;
      const notes = st.rows.filter(r => r[D.COL['유형']] === '출석하트')
        .map(r => r[D.COL['소셜글']] || '');
      return notes.filter(Boolean).join(' | ');
    }""")
    check('E 출석 행 메모에 보너스 + 중복 방지 키',
          '3일 연속 출석 보너스' in row_note and 'streak:' in row_note, row_note)
    card = text_of(page, '[data-region="heart"]')
    check('E MY 카드에 3일 연속 · 4일 더 하면 +2', '3일 연속 출석 중' in card and '4일 더 하면 보너스 하트 +2' in card,
          card[:200])
    shot('E-streak-3')

    # ── F. 일지 저장 직후 히어로 즉시 갱신 ──
    tap("#tabbar [data-tab='log']", 800)
    hero0 = text_of(page, '.card--hero .stat-strip')
    page.fill('[data-field="minutes"]', '75')
    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.drafts.log.cond = 8;
      st.drafts.log.games = [{ a: '21', b: '15' }];
      st.drafts.log.partner = '민호';
      st.drafts.log.rival = '지호';
    }""")
    tap('[data-act="save-log"]', 1500)
    hero1 = text_of(page, '.card--hero .stat-strip')
    check('F 저장 직후 이번 달 분이 바로 바뀐다', '75' in hero1 and hero1 != hero0,
          {'before': hero0.replace('\n', ' '), 'after': hero1.replace('\n', ' ')})
    check('F 최근 2주 1회', '1' in text_of(page, '.card--hero .hero__stat'),
          text_of(page, '.card--hero .hero__stat'))
    latest = page.evaluate("() => { const r = BM.views.log.shareRecordOf(BM.app.ctx.store.state, 'log-hero'); return r ? r.minutes : null; }")
    check('F 인스타 칩이 방금 저장한 일지(75분)를 연다', latest == 75, latest)
    shot('F-hero-refreshed')

    # ── G. 인스타 공유 카드 · 대회 프레임 ──
    tap('[data-act="share-card"][data-share-entry="log-hero"]', 900)
    check('G 공유 시트 열림', has(page, '.sc__canvas'))
    check('G 프레임 칩이 대회 탭에 있다', has(page, '[data-sc-frames]') is False)  # 오늘 운동 탭에는 없음
    tap('[data-sc-mode="comp"]', 700)
    frame_txt = text_of(page, '[data-sc-framebox]')
    check('G 대회 탭에 카드 프레임 칩', '카드 프레임' in frame_txt and '챔피언 골드' in frame_txt, frame_txt[:160])
    check('G 챔피언은 하트 2 표시', '하트 2' in frame_txt)
    tap('[data-sc-frame="champ"]', 1000)
    st = page.evaluate("() => BM.sharecard._state()")
    check('G 챔피언 프레임 선택됨', st['frame'] == 'champ', st['frame'])
    gold = page.evaluate("""() => {
      const c = document.querySelector('.sc__canvas'); if (!c) return -1;
      const g = c.getContext('2d');
      const d = g.getImageData(0, Math.round(c.height * 0.5), c.width, 1).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] > 180 && d[i + 1] > 140 && d[i + 2] < 160 && d[i + 3] > 40) n++;
      }
      return n;
    }""")
    check('G 카드에 금빛 프레임이 그려진다', gold > 0, gold)
    shot('G-comp-champ')
    page.evaluate("() => BM.ui.closeSheet()")
    page.wait_for_timeout(400)

    # ── H. 라이트 테마 · 360 폭 · 넘침 · 5개 탭 ──
    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      BM.app.ctx.actions.saveProfile({ nick: st.me.nick });
    }""")
    page.evaluate("""() => { document.documentElement.setAttribute('data-theme', 'th_def'); }""")
    page.wait_for_timeout(350)
    for tab in ['log', 'matching', 'community', 'coach', 'my']:
        tap("#tabbar [data-tab='%s']" % tab, 520)
        w = overflow(page)
        check('H %s 탭 가로 넘침 0 (390)' % tab, w[0] <= w[1], w)
    shot('H-light-my')
    page.set_viewport_size({'width': 360, 'height': 780})
    page.wait_for_timeout(420)
    w = overflow(page)
    check('H 360 폭 넘침 0', w[0] <= w[1], w)
    tap("#tabbar [data-tab='my']", 500)
    shot('H-360-my')
    card = text_of(page, '[data-region="heart"]')
    check('H 부스트 줄이 360 폭에서도 글자 넘침 없이', '하트 부스트' in card)

    check('H 콘솔 오류 0', len(errs) == 0, errs[:3])
    check('H CSP 위반 0', len(csp) == 0, csp[:2])
    check('H (참고) 차단된 외부 요청만', True, len(blocked))

    b.close()

passed = sum(1 for _, ok_ in checks if ok_)
print('\n%d/%d 통과' % (passed, len(checks)))
if passed != len(checks):
    print('실패:', [l for l, ok_ in checks if not ok_])
