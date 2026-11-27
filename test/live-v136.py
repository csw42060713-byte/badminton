"""v1.36 라이브 점검 — 배포된 앱(390×844)에서 광고 txId·7일 연속 보너스·파트너 전적 줄을 확인합니다.
   LD_LIBRARY_PATH=/workspace/tmp/deblibs/usr/lib/x86_64-linux-gnu python3 test/live-v136.py
"""
import time

from playwright.sync_api import sync_playwright

OUT = '/workspace/downloads'
BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'

errs, fails = [], []
checks = []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:220]) if extra else ''))
    checks.append((label, bool(cond)))


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    page = ctx.new_page()
    page.on('console', lambda m: errs.append('console: ' + m.text[:200]) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:200]))
    page.on('requestfailed', lambda r: fails.append(r.url[:120]) if BASE.split('/')[2] in r.url else None)

    # ── 배포본 확인 (Pages 빌드 대기)
    sw = ''
    for i in range(40):
        sw = page.request.get(BASE + 'sw.js?cachebust=' + str(i)).text()
        if 'bm-v1.36.2' in sw:
            break
        time.sleep(6)
    check('라이브 sw.js = bm-v1.36.2', 'bm-v1.36.2' in sw, sw[-60:])
    app = page.request.get(BASE + 'app.js?x=1').text()
    ads = page.request.get(BASE + 'js/ads.js?x=1').text()
    dom = page.request.get(BASE + 'js/domain.js?x=1').text()
    st = page.request.get(BASE + 'js/store.js?x=1').text()
    logjs = page.request.get(BASE + 'js/views/log.js?x=1').text()
    css = page.request.get(BASE + 'styles.css?x=1').text()
    index = page.request.get(BASE + 'index.html?x=1').text()
    check('라이브 app.js = v1.36.2', "version: 'v1.36.2'" in app)
    check('라이브 ads.js = onRewardAdResult·newTxId', all(k in ads for k in ('onRewardAdResult', 'newTxId', 'data-streak-bonus')))
    check('라이브 domain.js = STREAK_7_BONUS·adTxSeen·partnerStat',
          all(k in dom for k in ('STREAK_7_BONUS', 'adTxSeen', 'partnerStat', 'challengePartner')))
    check('라이브 store.js = duplicate·challengeShareDraft', all(k in st for k in ("'duplicate'", 'challengeShareDraft')))
    check('라이브 log.js = data-ptn-now', 'data-ptn-now' in logjs)
    check('라이브 styles.css = .ptnnow·.streakbonus', all(k in css for k in ('.ptnnow', '.streakbonus')))
    check('라이브 index.html = styles.css?v=20261121-38', 'styles.css?v=20261121-38' in index)

    # ── 앱 열기 (체험 모드)
    page.goto(BASE + '?live=136', wait_until='load')
    page.wait_for_timeout(2600)
    if page.query_selector('[data-act="guest"]'):
        page.click('[data-act="guest"]')
        page.wait_for_timeout(2400)
    for _ in range(3):
        if page.query_selector('#sheet .sheet__head [data-close]'):
            page.click('#sheet .sheet__head [data-close]')
            page.wait_for_timeout(400)
    check('앱 버전 노출', page.evaluate('window.BM && BM.app && BM.app.version') == 'v1.36.2',
          page.evaluate('window.BM && BM.app && BM.app.version'))

    def shot(name, sel=None):
        path = OUT + '/' + name
        if sel:
            page.locator(sel).first.screenshot(path=path)
        else:
            page.screenshot(path=path)
        print('     saved', path)

    # ── 1) 일지: 파트너 이름을 적고 전적 한 줄이 뜨는지
    plan = [('2026-11-19', '민호', '21', '18'),
            ('2026-11-20', '민호', '21', '19'),
            ('2026-11-21', '민호', '21', '15')]
    saved = []
    for day, partner, a, bb in plan:
        saved.append(page.evaluate("""([d, p, a, b]) => {
            const st = BM.app.ctx.store;
            st.actions.setDraft({ date: d, cond: 6, intensity: 6, minutes: 70, done: ['게임'],
              weakness: ['헤어핀'], games: [{ a: a, b: b }], partner: p, gameMode: 21 });
            return st.actions.saveLog().ok;
        }""", [day, partner, a, bb]))
        page.wait_for_timeout(1400)
    check('일지 3건 저장 (파트너 민호 · 이번 주 챌린지 달성)', saved and all(saved), saved)

    page.reload(wait_until='load')
    page.wait_for_timeout(2600)
    for _ in range(3):
        if page.query_selector('#sheet .sheet__head [data-close]'):
            page.click('#sheet .sheet__head [data-close]')
            page.wait_for_timeout(400)

    page.click('[data-tab="log"]')
    page.wait_for_timeout(1000)
    page.evaluate("document.querySelector('[data-fold=\"games\"]').open = true")
    page.wait_for_timeout(300)
    page.evaluate("document.querySelector('[data-ptnchips]')?.scrollIntoView({block:'center'})")
    page.wait_for_timeout(400)
    chips = page.evaluate("[...document.querySelectorAll('[data-ptn-chip]')].map(b => b.getAttribute('data-ptn-chip'))")
    check('최근 파트너 칩에 민호', '민호' in chips, chips)
    page.click('[data-ptn-chip]')
    page.wait_for_timeout(600)
    line = page.evaluate("(() => { const el = document.querySelector('[data-ptn-now]'); return el ? {hidden: el.hidden, text: el.textContent.trim()} : null; })()")
    check('칩을 누르면 전적 한 줄이 바로 보인다', line and not line['hidden'], line)
    check('한 줄 문구 = 민호 · 3전 3승 (100%)',
          line and line['text'] == '민호 · 3전 3승 0패 (100%)', line)
    box = page.evaluate("""() => {
        const inp = document.querySelector('[data-field="partner"]');
        const now = document.querySelector('[data-ptn-now]');
        const i = inp.getBoundingClientRect(), n = now.getBoundingClientRect();
        return {gap: Math.round(n.top - i.bottom), h: Math.round(n.height)};
    }""")
    check('입력칸 바로 아래(간격 0~20px) · 한 줄 높이', 0 <= box['gap'] <= 20 and box['h'] <= 24, box)
    shot('배드민턴_파트너전적_bm-v1.36.2_일지.png')
    page.locator('[data-partner-field]').first.screenshot(path=OUT + '/배드민턴_파트너전적_bm-v1.36.2_확대.png')
    print('     saved', OUT + '/배드민턴_파트너전적_bm-v1.36.2_확대.png')

    # 직접 입력해도 그 줄이 따라온다
    page.fill('[data-field="partner"]', '민호')
    page.wait_for_timeout(500)
    line2 = page.evaluate("document.querySelector('[data-ptn-now]').textContent.trim()")
    check('직접 입력해도 같은 줄', '민호 · 3전 3승' in line2, line2)
    page.fill('[data-field="partner"]', '없는이름')
    page.wait_for_timeout(400)
    hidden = page.evaluate("document.querySelector('[data-ptn-now]').hidden")
    check('기록 없는 이름이면 줄을 숨긴다', hidden is True, hidden)
    page.fill('[data-field="partner"]', '민호')
    page.wait_for_timeout(400)

    # ── 2) 챌린지 자랑 문구에 파트너
    page.evaluate("document.querySelector('[data-act=\"challenge-share\"]')?.scrollIntoView({block:'center'})")
    page.wait_for_timeout(400)
    shared = page.evaluate("""() => {
        const d = BM.app.ctx.store.actions.challengeShareDraft();
        return {ok: d.ok, text: d.text, partner: d.partner && d.partner.name};
    }""")
    check('자랑 초안에 파트너·전적', shared['ok'] and '(민호와 3경기 3승)' in (shared['text'] or ''), shared)
    if page.query_selector('[data-act="challenge-share"]'):
        page.click('[data-act="challenge-share"]')
        page.wait_for_timeout(700)
        composer = page.evaluate("BM.app.ctx.store.state.ui.composer")
        check('초안이 커뮤니티 글쓰기에 들어간다', '(민호와 3경기 3승)' in (composer or ''), composer)
    else:
        check('초안이 커뮤니티 글쓰기에 들어간다', False, '자랑하기 버튼 없음')

    # ── 3) 광고 거래 ID — 같은 시청 건 두 번째는 막힌다
    ad = page.evaluate("""() => {
        const a = BM.app.ctx.actions, h = BM.app.ctx.store.state.data.hearts;
        const out = {before: h.balance};
        out.first = a.watchAd({ verified: true, adUnit: 'heart_reward', txId: 'live-tx-1' });
        out.again = a.watchAd({ verified: true, adUnit: 'heart_reward', txId: 'live-tx-1' });
        out.after = BM.app.ctx.store.state.data.hearts.balance;
        return out;
    }""")
    check('광고 적립 성공', ad['first'] and ad['first'].get('ok') is True, ad['first'])
    check('같은 txId 두 번째는 duplicate', ad['again'] and ad['again'].get('reason') == 'duplicate', ad['again'])
    check('잔액은 한 번만 늘어난다', ad['after'] == ad['before'] + 1, [ad['before'], ad['after']])
    # 광고 훅(BM.app.onRewardAdResult)은 30초 간격이 비어 있을 때 지급합니다.
    #   오늘 광고 행을 지우고 새로 읽어 간격을 비운 뒤 확인합니다(점검용).
    page.evaluate("""() => {
        const sess = BM.auth.session();
        const key = (BM.auth.rowsKeyFor && sess) ? BM.auth.rowsKeyFor(sess) : 'bm_rows_v1';
        const U = BM.util, D = BM.domain;
        const rows = U.readJSON(key, []).filter(r => r[D.COL['유형']] !== '광고하트');
        U.writeJSON(key, rows);
        return rows.length;
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(2600)
    for _ in range(3):
        if page.query_selector('#sheet .sheet__head [data-close]'):
            page.click('#sheet .sheet__head [data-close]')
            page.wait_for_timeout(400)
    hook = page.evaluate("""() => {
        const r = BM.app.onRewardAdResult(true, 'heart_reward', 'live-tx-hook');
        const r2 = BM.app.onRewardAdResult(true, 'heart_reward', 'live-tx-hook');
        return {txId: r && r.txId, ok: r && r.apply && r.apply.ok,
                reason: r && r.apply && r.apply.reason,
                again: r2 && r2.apply && r2.apply.reason};
    }""")
    check('onRewardAdResult(txId) 지급', hook['ok'] is True, hook)
    check('같은 txId 콜백이 두 번 와도 한 번만', hook['again'] == 'duplicate', hook)

    # ── 4) 7일 연속 출석 보너스 — 6일을 심고 오늘 출석
    seeded = page.evaluate("""() => {
        const st = BM.app.ctx.store, U = BM.util, D = BM.domain;
        const me = st.state.me.key;
        const sess = BM.auth.session ? BM.auth.session() : null;
        const key = (BM.auth.rowsKeyFor && sess) ? BM.auth.rowsKeyFor(sess) : 'bm_rows_v1';
        const rows = st.state.rows.slice();
        for (let i = 1; i <= 6; i++) {
          const day = U.ymd(U.addDays(new Date(), -i));
          rows.push(D.toRow({ id: 'livec_' + i, type: '출석하트', createdAt: day + ' 08:00:00', date: day,
            nick: st.state.me.nick, userKey: me, likes: 1 }));
        }
        U.writeJSON(key, rows);
        return {key: key, rows: rows.length};
    }""")
    print('     seeded', seeded)
    # 심은 행으로 다시 읽도록 새로고칩니다
    page.reload(wait_until='load')
    page.wait_for_timeout(2600)
    for _ in range(3):
        if page.query_selector('#sheet .sheet__head [data-close]'):
            page.click('#sheet .sheet__head [data-close]')
            page.wait_for_timeout(400)
    streak = page.evaluate("""() => {
        const h = BM.app.ctx.store.state.data.hearts;
        return {streak: h.checkinStreak, bonus: h.streakBonus, checked: h.checkedInToday};
    }""")
    check('어제까지 6일 연속으로 읽힌다', streak['streak'] == 6, streak)
    check('보너스 안내 값 = 2 · 7일', streak['bonus'] and streak['bonus']['amount'] == 2 and streak['bonus']['days'] == 7, streak['bonus'])
    page.click('[data-tab="my"]')
    page.wait_for_timeout(1000)
    bonus_line = page.evaluate("(() => { const el = document.querySelector('.streakbonus'); return el ? el.textContent.trim() : null; })()")
    check('MY 하트 카드에 보너스 한 줄', bonus_line and '보너스 하트 +2' in bonus_line, bonus_line)
    page.evaluate("document.querySelector('.streakbonus')?.scrollIntoView({block:'center'})")
    page.wait_for_timeout(400)
    shot('배드민턴_연속출석보너스_bm-v1.36.2_MY.png')
    page.locator('.card--heart').first.screenshot(path=OUT + '/배드민턴_하트카드_bm-v1.36.2_확대.png')
    print('     saved', OUT + '/배드민턴_하트카드_bm-v1.36.2_확대.png')
    before = page.evaluate('BM.app.ctx.store.state.data.hearts.balance')
    ci = page.evaluate("BM.app.ctx.store.actions.checkIn()")
    page.wait_for_timeout(900)
    check('7일째 출석 = 하트 3개(1+2)', ci and ci.get('ok') is True and ci.get('gained') == 3 and ci.get('bonus') == 2, ci)
    after = page.evaluate('BM.app.ctx.store.state.data.hearts.balance')
    check('잔액 +3', after == before + 3, [before, after])
    page.click('[data-tab="my"]')
    page.wait_for_timeout(900)
    line7 = page.evaluate("(() => { const el = document.querySelector('.streakbonus'); return el ? el.textContent.trim() : null; })()")
    check('받은 뒤 안내는 다음 7일', line7 and '7일 더 하면' in line7, line7)
    shot('배드민턴_연속출석보너스_받은뒤_bm-v1.36.2_MY.png')

    # ── 5) 공용 하트 충전 시트에도 같은 안내
    page.evaluate("BM.app.ctx.actions.setDraft && null")
    page.evaluate("""() => {
        const st = BM.app.ctx.store;
        BM.ads.openHeartSheet({ store: st, actions: st.actions }, { need: 5, title: '하트 충전' });
    }""")
    page.wait_for_timeout(700)
    sheet_line = page.evaluate("(() => { const el = document.querySelector('[data-streak-bonus]'); return el ? el.textContent.trim() : null; })()")
    check('충전 시트에 보너스 안내', sheet_line and '보너스 하트 +2' in sheet_line, sheet_line)
    shot('배드민턴_하트충전시트_보너스_bm-v1.36.2.png')
    if page.query_selector('#sheet .sheet__head [data-close]'):
        page.click('#sheet .sheet__head [data-close]')
        page.wait_for_timeout(400)

    # ── 6) 5개 탭 가로 넘침·콘솔 오류
    widths = {}
    for tab in ('log', 'matching', 'community', 'coach', 'my'):
        page.click('[data-tab="%s"]' % tab)
        page.wait_for_timeout(600)
        widths[tab] = page.evaluate('document.documentElement.scrollWidth')
    check('가로 넘침 없음(390px)', all(w <= 390 for w in widths.values()), widths)

    b.close()

print('\n콘솔·페이지 오류', len(errs), errs[:6])
print('실패한 요청', len(fails), fails[:6])
check('콘솔·페이지 오류 0건', len(errs) == 0, errs[:3])
check('실패한 요청 0건', len(fails) == 0, fails[:3])
passed = sum(1 for _, okv in checks if okv)
print('\n점검 %d/%d 통과' % (passed, len(checks)))
raise SystemExit(0 if passed == len(checks) else 1)
