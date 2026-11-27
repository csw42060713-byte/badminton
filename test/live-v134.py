"""v1.34 라이브 점검 — 배포된 앱(390×844)에서 연속 배지·파트너 프로필 연결·코치 요청 영상 동봉을 확인합니다.
   LD_LIBRARY_PATH=/workspace/tmp/deblibs/usr/lib/x86_64-linux-gnu python3 test/live-v134.py
"""
import time

from playwright.sync_api import sync_playwright

OUT = '/workspace/downloads'
BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
VIDEO = 'https://www.youtube.com/watch?v=v134live'
errs, fails = [], []
checks = []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:200]) if extra else ''))
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
        if 'bm-v1.34.0' in sw:
            break
        time.sleep(6)
    check('라이브 sw.js = bm-v1.34.0', 'bm-v1.34.0' in sw, sw[-60:])
    app = page.request.get(BASE + 'app.js?x=1').text()
    dom = page.request.get(BASE + 'js/domain.js?x=1').text()
    css = page.request.get(BASE + 'styles.css?x=1').text()
    index = page.request.get(BASE + 'index.html?x=1').text()
    check('라이브 app.js = v1.34.0', "version: 'v1.34.0'" in app)
    check('라이브 domain.js = 연속·회원·링크 함수',
          all(k in dom for k in ('function challengeStreak', 'function memberByName', 'function linkify')))
    check('라이브 styles.css = 새 클래스',
          all(k in css for k in ('.mystreak', '.ptn__link', '.dbubble .dlink', '.fbask__toggle')))
    check('라이브 index.html = styles.css?v=20261121-34', 'styles.css?v=20261121-34' in index)

    # ── 앱 열기 (둘러보기 = 체험 모드)
    page.goto(BASE + '?live=134', wait_until='load')
    page.wait_for_timeout(2600)
    if page.query_selector('[data-act="guest"]'):
        page.click('[data-act="guest"]')
        page.wait_for_timeout(2400)
    for _ in range(3):
        if page.query_selector('#sheet .sheet__head [data-close]'):
            page.click('#sheet .sheet__head [data-close]')
            page.wait_for_timeout(400)
    check('앱 버전 노출', page.evaluate('window.BM && BM.app && BM.app.version') == 'v1.34.0',
          page.evaluate('window.BM && BM.app && BM.app.version'))

    # ── 이번 주 일지 3일 (연속 배지) + 영상·파트너가 있는 최근 일지 — 앱 저장 동작 그대로
    saved = []
    for day in ('2026-11-16', '2026-11-17', '2026-11-18'):
        saved.append(page.evaluate("""(d) => {
            const st = BM.app.ctx.store;
            st.actions.setDraft({ date: d, cond: 7, intensity: 6, minutes: 70, weakness: ['풋워크'],
              done: ['게임'], games: [{ a: '21', b: '17' }] });
            return st.actions.saveLog().ok;
        }""", day))
        page.wait_for_timeout(1500)          # 저장 잠금(1.2초)이 풀린 뒤 다음 저장
    saved.append(page.evaluate("""(video) => {
        const st = BM.app.ctx.store;
        st.actions.setDraft({ date: '2026-11-20', cond: 6, intensity: 7, minutes: 80,
          weakness: ['스매시'], done: ['스트록'], games: [{ a: '21', b: '19' }],
          partner: '민호', video: video, videoNote: '스매시 손목 각도' });
        return st.actions.saveLog().ok;
    }""", VIDEO))
    check('일지 4건 저장 (이번 주 3일 + 영상·파트너)', saved and all(saved), saved)
    page.wait_for_timeout(1200)

    # ── 검증용 회원 한 줄: 닉네임 '민호' 선수 + 승인된 코치 (이 브라우저 저장소에만)
    page.evaluate("""() => {
        const U = BM.util, D = BM.domain;
        const rows = U.readJSON('bm_rows_v1', []) || [];
        rows.push(D.toRow({ id: 'row_v134_friend', type: '프로필', createdAt: '2026-11-19 10:00:00',
          date: '2026-11-19', nick: '민호', level: 'B조', discipline: '복식', userKey: 'u_v134_friend' }));
        rows.push(D.toRow({ id: 'row_v134_coach', type: '멘토신청', createdAt: '2026-11-19 11:00:00',
          date: '2026-11-19', nick: '민호', level: 'B조', discipline: '복식', userKey: 'u_v134_friend',
          text: JSON.stringify({ status: '승인', experience: '5년', awards: '시 대회 3위', reason: '코트에서 봐 드릴게요' }) }));
        localStorage.setItem('bm_rows_v1', JSON.stringify(rows));
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(3000)
    for _ in range(3):
        if page.query_selector('#sheet .sheet__head [data-close]'):
            page.click('#sheet .sheet__head [data-close]')
            page.wait_for_timeout(400)

    def shot(name, region=None):
        path = OUT + '/' + name
        if region:
            page.locator(region).first.screenshot(path=path)
        else:
            page.screenshot(path=path)
        print('     saved', path)

    # ── 1) MY — 연속 챌린지 배지
    page.click('[data-tab="my"]')
    page.wait_for_timeout(1100)
    badge = page.evaluate("""() => {
        const el = document.querySelector('.mystreak');
        if (!el) return null;
        const r = el.getBoundingClientRect(), st = getComputedStyle(el);
        return {text: el.textContent.trim(), weeks: el.getAttribute('data-streak'),
                h: Math.round(r.height), color: st.color, fs: st.fontSize};
    }""")
    check('MY 연속 배지 보임', badge is not None, badge)
    check('MY 배지 주 수 = 1 (이번 주 3/3)', badge and badge['weeks'] == '1', badge)
    check('MY 배지 문구', badge and '이번 주 챌린지 달성' in badge['text'], badge)
    check('MY 배지 한 줄 높이(≤ 34px)', badge and badge['h'] <= 34, badge)
    shot('배드민턴_연속챌린지배지_bm-v1.34.0_MY.png')
    shot('배드민턴_연속챌린지배지_bm-v1.34.0_MY_카드.png', '.card--profile')

    # ── 2) 일지 & AI — 파트너 이름 → 프로필 시트
    page.click('[data-tab="log"]')
    page.wait_for_timeout(1200)
    page.evaluate("document.querySelector('.card--ptn')?.scrollIntoView({block:'center'})")
    page.wait_for_timeout(500)
    if page.query_selector('.ptn[data-ptn]'):
        page.click('.ptn[data-ptn] summary')
        page.wait_for_timeout(500)
    plink = page.evaluate("""() => {
        const el = document.querySelector('[data-partner]');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {key: el.getAttribute('data-partner'), text: el.textContent.trim(),
                color: getComputedStyle(el).color, deco: getComputedStyle(el).textDecorationLine};
    }""")
    check('파트너 이름이 회원 프로필 버튼', plink is not None, plink)
    check('파트너 버튼 = 누를 수 있는 모양(밑줄)', plink and 'underline' in (plink['deco'] or ''), plink)
    shot('배드민턴_파트너프로필연결_bm-v1.34.0_일지.png')
    if plink:
        page.click('[data-partner]')
        page.wait_for_timeout(900)
        pp = page.evaluate("""() => {
            const s = document.querySelector('#sheet');
            if (!s) return null;
            return {name: (s.querySelector('.pp__name') || {}).textContent || '',
                    friend: !!s.querySelector('[data-friend-add]'),
                    chat: !!s.querySelector('[data-friend-chat]') || !!s.querySelector('.pp__friendhint')};
        }""")
        check('프로필 시트가 열린다', pp is not None, pp)
        check('프로필 시트 = 민호 · 친구 추가 버튼', pp and pp['name'].strip() == '민호' and pp['friend'], pp)
        shot('배드민턴_파트너프로필시트_bm-v1.34.0.png')
        if page.query_selector('#sheet .sheet__head [data-close]'):
            page.click('#sheet .sheet__head [data-close]')
            page.wait_for_timeout(500)

    # ── 3) 코치 — 피드백 요청에 최근 일지 영상 동봉
    page.click('[data-tab="coach"]')
    page.wait_for_timeout(1200)
    check('코치 카드(승인 코치) 보임', page.query_selector('[data-coach-ask]') is not None)
    page.click('[data-coach-ask]')
    page.wait_for_timeout(900)
    ask = page.evaluate("""() => {
        const s = document.querySelector('#sheet');
        if (!s) return null;
        const box = s.querySelector('[data-video-include]');
        const pv = s.querySelector('[data-ask-preview]');
        return {title: (s.querySelector('h2') || {}).textContent || '',
                checked: box ? box.checked : null,
                preview: pv ? pv.textContent : '',
                hasUrl: pv ? pv.textContent.indexOf('youtube') >= 0 : false};
    }""")
    check('영상 동봉 확인 시트가 열린다', ask is not None, ask and ask['title'])
    check('체크 기본 켜짐 · 미리보기에 영상 주소', ask and ask['checked'] is True and ask['hasUrl'], ask)
    shot('배드민턴_코치영상동봉_bm-v1.34.0_시트.png')
    if page.query_selector('[data-video-include]'):
        page.click('[data-video-include]')
        page.wait_for_timeout(400)
        off = page.evaluate("""() => {
            const pv = document.querySelector('[data-ask-preview]');
            return pv ? pv.textContent : '';
        }""")
        check('체크를 풀면 미리보기에서 영상이 빠진다', 'youtube' not in off and '코치님' in off, off[:120])
        shot('배드민턴_코치영상동봉_bm-v1.34.0_체크해제.png')
    # 실제로 대화를 열어 말풍선 링크까지
    page.click('[data-video-include]')
    page.wait_for_timeout(300)
    page.click('#sheet [data-act="ask-send"]')
    page.wait_for_timeout(1400)
    chat = page.evaluate("""() => {
        const inp = document.querySelector('[data-dm-input]');
        return inp ? inp.value : '';
    }""")
    check('대화 입력칸에 영상이 담긴 요청 문구', VIDEO in chat, chat[:120])
    # 보내고 말풍선 링크 확인 (내 체험 데이터에만 남습니다)
    if page.query_selector('[data-dm-form]'):
        page.fill('[data-dm-input]', chat)
        page.press('[data-dm-input]', 'Enter')
        page.wait_for_timeout(1600)
    bubble = page.evaluate("""() => {
        const a = document.querySelector('.dbubble .dlink');
        if (!a) return null;
        return {href: a.getAttribute('href'), target: a.getAttribute('target'),
                rel: a.getAttribute('rel'), text: a.textContent.slice(0, 60)};
    }""")
    check('말풍선 영상 주소가 눌러지는 링크', bubble is not None, bubble)
    check('말풍선 링크 = 새 창 + noopener', bubble and bubble['target'] == '_blank' and 'noopener' in (bubble['rel'] or ''), bubble)
    shot('배드민턴_코치영상링크_bm-v1.34.0_대화.png')

    # ── 가로 넘침·오류
    widths = {}
    for tab in ('log', 'matching', 'community', 'coach', 'my'):
        if page.query_selector('[data-dm-back]'):
            page.click('[data-dm-back]')
            page.wait_for_timeout(400)
        if page.query_selector('[data-dm-close]'):
            page.click('[data-dm-close]')
            page.wait_for_timeout(500)
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
