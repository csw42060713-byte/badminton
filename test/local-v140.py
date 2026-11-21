"""bm-v1.40 로컬 확인 (390×844) — 시작 4유형 · 선수 7대 훈련 저장·최근 기록.

· Supabase 등 바깥 요청은 모두 막고(route abort) 이 기기 저장(local)으로만 확인합니다.
· 실행:  python3 -m http.server 8423 &  →  (아래 LD_LIBRARY_PATH) python3 test/local-v140.py
"""
import json

from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:8423/index.html'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'

checks, errs = [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:300]) if extra else ''))
    checks.append((label, bool(cond)))


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    # 바깥 서버(Supabase·구글 등)로 나가는 요청을 막습니다 — 이 기기 저장으로만 확인
    ctx.route('**/*', lambda route: route.abort()
              if ('supabase.co' in route.request.url or 'google' in route.request.url
                  or 'gstatic' in route.request.url)
              else route.continue_())
    page = ctx.new_page()
    logs = []
    page.on('console', lambda m: (errs.append('console: ' + m.text[:200]) if m.type == 'error' else None,
                                  logs.append(m.type + ': ' + m.text[:200])))
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:400]))
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:200]))

    page.goto(BASE, wait_until='load')
    page.evaluate("""() => {
      try {
        localStorage.clear(); sessionStorage.clear();
        localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
        localStorage.setItem('bm_auth_v1', JSON.stringify({
          kind: 'email', email: 'local140@example.com', name: '로컬선수', at: new Date().toISOString()
        }));
      } catch (e) {}
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(2800)

    # ── 1) 온보딩: 유형 카드 네 장
    has_role = page.query_selector('[data-pick="role"]')
    if not has_role:
        page.screenshot(path=OUT + '/v140_local_00_nostart.png', full_page=True)
    check('온보딩이 뜬다', has_role is not None)
    check('온보딩 유형 카드 4장', len(page.query_selector_all('[data-pick="role"]')) == 4,
          len(page.query_selector_all('[data-pick="role"]')))
    if has_role:
        page.screenshot(path=OUT + '/v140_local_01_onboarding.png', full_page=True)
        page.click('[data-pick="role"][data-val="player"]')
        page.wait_for_timeout(300)
        on = page.query_selector('[data-pick="role"][data-val="player"]').get_attribute('class')
        check('선수 카드가 켜진다', 'is-on' in on, on)
        page.screenshot(path=OUT + '/v140_local_02_role_player.png', full_page=True)

        page.fill('#onbNick', '로컬선수')
        page.click('[data-pick="level"][data-val="선수부"]')
        page.click('[data-pick="discipline"][data-val="단식"]')
        page.wait_for_timeout(200)
        page.screenshot(path=OUT + '/v140_local_03_onb_filled.png', full_page=True)
        page.evaluate("""() => {
          window.__seq = [];
          const mo = new MutationObserver(() => {
            const m = document.getElementById('main');
            window.__seq.push([Date.now(), document.body.className, m && m.firstElementChild ? m.firstElementChild.className : '']);
          });
          mo.observe(document.getElementById('main'), {childList: true});
        }""")
        page.click('[data-act="finish"]')
        page.wait_for_timeout(2400)
        for _ in range(5):
            if page.query_selector('#sheet .sheet__head [data-close]'):
                try:
                    page.click('#sheet .sheet__head [data-close]', timeout=1500)
                except Exception:
                    pass
                page.wait_for_timeout(250)
        check('일지 탭으로 들어옴', page.query_selector('[data-form="log"]') is not None)
        if page.query_selector('[data-form="log"]') is None:
            page.screenshot(path=OUT + '/v140_local_03b_after_finish.png', full_page=True)
            print('errors', errs)
        # ── 2) 일지: 7대 훈련 블록
        page.wait_for_timeout(600)
        toggles = page.query_selector_all('[data-pro-toggle]')
        check('7대 훈련 7줄', len(toggles) == 7, len(toggles))
        check('선수 화면에는 완료 훈련 칩 줄이 없다', page.query_selector('[data-chipgroup="done"]') is None)
        note = page.query_selector('[data-pro="상체 근력운동"] [data-pro-note]')
        check('입력칸은 처음에 접혀 있음', note is not None and note.is_hidden(),
              note.is_hidden() if note else None)

        page.click('[data-pro-toggle="상체 근력운동"]')
        page.wait_for_timeout(350)
        note = page.query_selector('[data-pro="상체 근력운동"] [data-pro-note]')
        check('체크하면 입력칸이 열린다', note is not None and note.is_visible())
        focused = page.evaluate("() => (document.activeElement && document.activeElement.getAttribute('data-pro-name')) || ''")
        check('입력칸에 커서가 간다', focused == '상체 근력운동', focused)
        page.fill('[data-pro="상체 근력운동"] [data-pro-note]', '풀업 4세트, 벤치프레스 60kg')
        page.wait_for_timeout(250)
        page.click('[data-pro-toggle="풋워크"]')
        page.wait_for_timeout(300)
        page.fill('[data-pro="풋워크"] [data-pro-note]', '사이드 스텝 10분 × 3세트')
        page.wait_for_timeout(250)
        page.click('[data-pro-toggle="스매시"]')      # 체크했다가
        page.wait_for_timeout(250)
        page.click('[data-pro-toggle="스매시"]')      # 다시 눌러 풀기
        page.wait_for_timeout(300)
        st = page.evaluate("""() => {
          const s = window.BM.app.ctx.store.state;
          return {pro: Object.keys(s.drafts.log.pro || {}), done: s.drafts.log.done.slice()};
        }""")
        check('초안 pro 2개(스매시는 풀림)',
              sorted(st['pro']) == sorted(['상체 근력운동', '풋워크']), st['pro'])
        check('초안 완료 훈련에 체크한 이름',
              '상체 근력운동' in st['done'] and '풋워크' in st['done'] and '스매시' not in st['done'], st['done'])
        page.screenshot(path=OUT + '/v140_local_04_pro_filled.png', full_page=True)

        # ── 3) 저장 → 최근 기록
        page.evaluate("""() => {
          const f = document.querySelector('[data-field="minutes"]');
          if (f) { f.value = '90'; f.dispatchEvent(new Event('input', {bubbles: true})); }
        }""")
        page.wait_for_timeout(400)
        page.click('[data-act="save-log"]')
        page.wait_for_timeout(1600)
        toast = page.evaluate("() => { const t = document.getElementById('toast'); return t ? t.textContent : ''; }")
        check('저장 안내', '일지를 저장했어요' in toast, toast)

        rec = page.evaluate("""() => {
          const s = window.BM.app.ctx.store.state;
          const rows = s.rows.filter(r => r[1] === '기록');
          const row = rows[0] || [];
          return {
            count: rows.length, cells: row.length,
            plan: row[window.BM.domain.COL['훈련계획']] || '',
            done: row[window.BM.domain.COL['완료훈련']] || ''
          };
        }""")
        check('저장 행 1건 · 26칸', rec['count'] == 1 and rec['cells'] == 26, rec)
        check('훈련계획 칸에 pro JSON', '"pro"' in rec['plan'] and '풀업 4세트' in rec['plan'], rec['plan'][:160])
        check('완료훈련 칸에 체크한 이름',
              '상체 근력운동' in rec['done'] and '풋워크' in rec['done'] and '스매시' not in rec['done'], rec['done'])

        page.wait_for_timeout(900)
        recent = page.evaluate("""() => {
          const el = document.querySelector('[data-region="recent"] .logrow .logrow__pro');
          return el ? el.innerText.replace(/\\s+/g, ' ').trim() : '';
        }""")
        check('최근 기록에 7대 훈련 줄', '상체 근력운동' in recent and '풀업 4세트' in recent, recent)
        page.evaluate("() => document.querySelector('[data-region=\"recent\"]').scrollIntoView({block: 'center'})")
        page.wait_for_timeout(400)
        page.screenshot(path=OUT + '/v140_local_05_recent.png')

        page.click('[data-region="recent"] .logrow')
        page.wait_for_timeout(800)
        sheet_text = page.evaluate("() => { const s = document.getElementById('sheet'); return s ? s.innerText.replace(/\\s+/g, ' ') : ''; }")
        check('상세 시트에 7대 훈련', '선수 7대 훈련' in sheet_text and '풀업 4세트' in sheet_text, sheet_text[:200])
        page.screenshot(path=OUT + '/v140_local_06_detail.png')
        if page.query_selector('#sheet .sheet__head [data-close]'):
            page.click('#sheet .sheet__head [data-close]')
            page.wait_for_timeout(400)

        # ── 4) MY: 내 유형
        page.click('[data-tab="my"]')
        page.wait_for_timeout(1000)
        check('MY에 내 유형 카드', page.query_selector('[data-region="role"]') is not None)
        on_cls = page.query_selector('[data-role="player"]').get_attribute('class')
        check('선수가 켜져 있음', 'is-on' in on_cls, on_cls)
        page.evaluate("() => document.querySelector('[data-region=\"role\"]').scrollIntoView({block: 'center'})")
        page.wait_for_timeout(300)
        page.screenshot(path=OUT + '/v140_local_07_my_role.png')

        page.click('[data-role="club"]')
        page.wait_for_timeout(1000)
        theme_role = page.evaluate("() => (window.BM.app.ctx.store.state.me.theme || {}).role")
        check('유형이 꾸미기 JSON에 저장됨', theme_role == 'club', theme_role)
        page.click('[data-tab="log"]')
        page.wait_for_timeout(1000)
        check('동호인은 7대 훈련 없음', len(page.query_selector_all('[data-pro-toggle]')) == 0)
        check('동호인은 완료 훈련 칩', page.query_selector('[data-chipgroup="done"]') is not None)

        page.click('[data-tab="my"]')
        page.wait_for_timeout(800)
        page.click('[data-role="player"]')
        page.wait_for_timeout(900)
        page.click('[data-tab="log"]')
        page.wait_for_timeout(900)
        check('선수로 돌아오면 7대 훈련 복귀', len(page.query_selector_all('[data-pro-toggle]')) == 7)

        info = page.evaluate("() => ({overflowX: document.documentElement.scrollWidth > innerWidth + 1, w: document.documentElement.scrollWidth})")
        check('가로 넘침 없음', not info['overflowX'], info['w'])

    print('\n== 오류 ==', len(errs))
    for e in errs[:10]:
        print(' ', e)
    okn = sum(1 for _, c in checks if c)
    print('\n%d/%d 통과' % (okn, len(checks)))
    for label, c in checks:
        if not c:
            print('FAILED:', label)
    b.close()
