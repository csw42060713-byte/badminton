"""v1.32 라이브 점검 — 배포된 앱에서 파트너 승률 · 영상 체크 메모 · 챌린지 자랑을 실제로 써 봅니다 (390×844).
   LD_LIBRARY_PATH=/workspace/tmp/deblibs/usr/lib/x86_64-linux-gnu python3 test/live-v132.py
"""
import sys
import time

from playwright.sync_api import sync_playwright

OUT = '/workspace/downloads'
BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
VIDEO = 'https://www.youtube.com/watch?v=live132'
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
    page.on('requestfailed', lambda r: fails.append(r.url[:120]))

    # 배포 반영 기다리기 (Pages 빌드)
    sw = ''
    for i in range(60):
        sw = page.request.get(BASE + 'sw.js?cachebust=' + str(i)).text()
        if 'bm-v1.32.0' in sw:
            break
        time.sleep(6)
    check('라이브 sw.js = bm-v1.32.0', 'bm-v1.32.0' in sw, sw[:80])
    app = page.request.get(BASE + 'app.js?x=1').text()
    dom = page.request.get(BASE + 'js/domain.js?x=1').text()
    logjs = page.request.get(BASE + 'js/views/log.js?x=1').text()
    css = page.request.get(BASE + 'styles.css?x=1').text()
    check('라이브 app.js = v1.32.0', "version: 'v1.32.0'" in app, app[:40])
    check('라이브 domain.js = partnerStats · safeVideoUrl · challengeShareText',
          all(k in dom for k in ('partnerStats', 'safeVideoUrl', 'logExtraJson', 'challengeShareText')))
    check('라이브 log.js = 파트너 카드 · 영상 칸 · 자랑하기',
          all(k in logjs for k in ('partnerBlock', 'videoHintOf', 'challenge-share')))
    check('라이브 styles.css = 파트너 · 영상 스타일',
          all(k in css for k in ('.card--ptn', '.ptn__rate', '.logrow__vid', '.vidbox')))

    page.goto(BASE + '?live=132', wait_until='load')
    page.wait_for_timeout(2600)
    if page.query_selector('[data-act="guest"]'):
        page.click('[data-act="guest"]')
        page.wait_for_timeout(2400)
    for _ in range(3):
        if page.query_selector('#sheet [data-close]'):
            page.click('#sheet [data-close]')
            page.wait_for_timeout(400)
    check('앱 버전 노출', page.evaluate('window.BM && BM.app && BM.app.version') == 'v1.32.0',
          page.evaluate('window.BM && BM.app && BM.app.version'))

    page.goto(BASE + '#/log', wait_until='load')
    page.wait_for_timeout(1800)
    if not page.query_selector('[data-act="open-scoreboard"]'):
        page.click('[data-tab="log"]')
        page.wait_for_timeout(1200)
    check('일지 화면', page.query_selector('[data-form="log"]') is not None)
    check('파트너 입력칸', page.query_selector('[data-field="partner"]') is not None)
    check('영상 입력칸', page.query_selector('[data-field="video"]') is not None)
    check('처음에는 파트너 카드 없음', page.query_selector('[data-region="partner"]') is None)

    def save_log(days_ago, games, weak, partner, video='', label='', wait=2000):
        page.evaluate("""({n, games, weak, partner, video, label}) => {
            const U = BM.util, A = BM.app.ctx.store.actions;
            A.setDraft({
              date: U.ymd(U.addDays(new Date(), -n)), cond: 7, intensity: 6, minutes: 60,
              done: ['스트록', '게임'], weakness: weak, pain: [], note: '',
              games: games, gameMode: 21, partner: partner, video: video, videoNote: label
            });
        }""", {'n': days_ago, 'games': games, 'weak': weak, 'partner': partner,
               'video': video, 'label': label})
        page.wait_for_timeout(320)
        btn = page.query_selector('[data-act="save-log"]')
        if btn:
            btn.click()
        page.wait_for_timeout(wait)

    # 1) 파트너 4전 3승 1패 — 같은 주 안 세 날(11/16·11/18·11/20) + 첫 날 2경기
    save_log(5, [{'a': '21', 'b': '18'}, {'a': '18', 'b': '21'}], ['헤어핀'], '조환비')
    save_log(3, [{'a': '21', 'b': '15'}], ['헤어핀'], '조환비', VIDEO, '스매시 손목 각도')
    save_log(1, [{'a': '25', 'b': '23'}], ['헤어핀'], '조환비')

    row = page.evaluate("""() => {
        const C = BM.domain.COL, rows = BM.app.ctx.store.state.rows;
        const mine = rows.filter(r => r[C['유형']] === '기록');
        const r = mine[mine.length - 1] || [];
        return { len: r.length, team: r[C['팀']] };
    }""")
    check('일지 행 26칸 그대로', row.get('len') == 26, row)
    check('팀 칸 JSON (새 칸 없음)', '"partner"' in (row.get('team') or ''), row.get('team'))

    pcard = page.query_selector('[data-region="partner"]')
    check('파트너 승률 카드', pcard is not None)
    ptext = (pcard.inner_text().replace('\n', ' | ') if pcard else '')
    check('요약줄에 조환비 4전 3승 1패', '조환비' in ptext and '4전 3승 1패' in ptext, ptext[:160])
    check('승률 75%', '75%' in ptext, ptext[:160])
    page.evaluate("""() => { const d = document.querySelector('[data-region="partner"] details'); if (d) d.open = true; }""")
    page.wait_for_timeout(400)
    page.evaluate("""() => { const e = document.querySelector('[data-region="partner"]'); if (e) e.scrollIntoView({block:'center'}); }""")
    page.wait_for_timeout(500)
    page.screenshot(path=f'{OUT}/배드민턴_파트너별승률_bm-v1.32.0.png')
    check('펼친 목록에 전적', '4전 3승 1패' in page.inner_text('[data-region="partner"]'))

    # 2) 영상 체크 — 최근 기록 줄의 링크와 상세 시트 버튼
    vlink = page.query_selector('.logrow__vid')
    check('최근 기록에 영상 링크', vlink is not None)
    if vlink:
        check('영상 링크 target=_blank', vlink.get_attribute('target') == '_blank', vlink.get_attribute('target'))
        check('영상 링크 rel=noopener noreferrer',
              (vlink.get_attribute('rel') or '').replace(' ', '') == 'noopenernoreferrer',
              vlink.get_attribute('rel'))
        check('영상 링크 주소', vlink.get_attribute('href') == VIDEO, vlink.get_attribute('href'))
        # 기록 줄을 눌러 상세 시트 → 영상 보기 버튼
        page.evaluate("""() => {
            const a = document.querySelector('.logrow__vid');
            const row = a.closest('[data-record]');
            row.click();
        }""")
        page.wait_for_timeout(700)
        sheet = page.inner_text('#sheet') if page.query_selector('#sheet') else ''
        check('상세 시트에 복식 파트너', '조환비' in sheet, sheet[:200])
        check('상세 시트에 체크 포인트', '스매시 손목 각도' in sheet, sheet[:300])
        vbtn = page.query_selector('#sheet a.vidbox__btn')
        check('상세 시트 영상 보기 버튼', vbtn is not None)
        if vbtn:
            check('상세 버튼도 새 창·noopener',
                  vbtn.get_attribute('target') == '_blank' and
                  (vbtn.get_attribute('rel') or '').replace(' ', '') == 'noopenernoreferrer',
                  vbtn.get_attribute('rel'))
        page.screenshot(path=f'{OUT}/배드민턴_영상체크메모_bm-v1.32.0.png')
        page.evaluate("() => { if (window.BM && BM.ui && BM.ui.closeSheet) BM.ui.closeSheet(); }")
        page.wait_for_timeout(600)

    # 3) 챌린지 3/3 → 커뮤니티에 자랑하기
    ch = page.query_selector('[data-region="challenge"]')
    chtext = (ch.inner_text().replace('\n', ' | ') if ch else '')
    check('챌린지 3회 달성', '3회 채웠어요' in chtext, chtext[:160])
    sharebtn = page.query_selector('[data-act="challenge-share"]')
    check('자랑하기 버튼', sharebtn is not None)
    if sharebtn:
        sharebtn.scroll_into_view_if_needed()
        page.wait_for_timeout(300)
        page.screenshot(path=f'{OUT}/배드민턴_챌린지자랑버튼_bm-v1.32.0.png')
        sharebtn.click()
        page.wait_for_timeout(1200)
        check('커뮤니티 탭으로 이동', page.evaluate("() => BM.app.ctx.store.state.ui.tab") == 'community',
              page.evaluate("() => BM.app.ctx.store.state.ui.tab"))
        text = page.evaluate("() => document.querySelector('[data-composer]') ? document.querySelector('[data-composer]').value : ''")
        check('글쓰기에 자랑 문구', '이번 주 헤어핀 3회 연습 달성' in (text or ''), text)
        check('말머리 일지', page.evaluate("() => BM.app.ctx.store.state.ui.composerTopic") == '일지',
              page.evaluate("() => BM.app.ctx.store.state.ui.composerTopic"))
        check('글은 아직 안 올라감(사람이 올리기)',
              page.evaluate("() => BM.app.ctx.store.state.data.posts.filter(p => (p.text||'').indexOf('3회 연습 달성') >= 0 && p.userKey === (BM.app.ctx.store.state.me||{}).key).length") == 0)
        page.evaluate("() => window.scrollTo(0,0)")
        page.wait_for_timeout(400)
        page.screenshot(path=f'{OUT}/배드민턴_챌린지커뮤니티자랑_bm-v1.32.0.png')

    print('CONSOLE ERRORS', errs if errs else 'none')
    print('REQ FAILED', fails if fails else 'none')
    b.close()

bad = [c for c in checks if not c[1]]
print('SUMMARY', str(len(checks) - len(bad)) + '/' + str(len(checks)))
sys.exit(1 if bad or errs or fails else 0)
