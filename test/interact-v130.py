"""v1.30 코트 점수판 · 드릴 타이머 — 실제 저장소·이벤트까지 돌려 보는 점검 (로컬, 390×844)
   python3 test/interact-v130.py
"""
import functools
import http.server
import os
import socketserver
import threading

from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'

handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=APP)
httpd = socketserver.TCPServer(('127.0.0.1', 0), handler)
port = httpd.server_address[1]
threading.Thread(target=httpd.serve_forever, daemon=True).start()

errs, checks = [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:200]) if extra else ''))
    checks.append((label, bool(cond)))


try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=EXE)
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                            is_mobile=True, has_touch=True, locale='ko-KR')
        page = ctx.new_page()
        page.on('console', lambda m: errs.append('console: ' + m.text[:200]) if m.type == 'error' else None)
        page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:200]))
        page.goto(f'http://127.0.0.1:{port}/test/v130-preview.html?view=log', wait_until='load')
        page.wait_for_timeout(900)
        check('점검 화면 준비', page.evaluate('!!window.__store'))

        # 1) 일지 첫머리 + 코트 점수판 버튼
        btn = page.locator('[data-act="open-scoreboard"]')
        check('+ 코트 점수판 버튼', btn.count() == 1, btn.count())
        check('버튼 글자', '코트 점수판' in btn.inner_text(), btn.inner_text().replace('\n', ' | '))
        page.screenshot(path=f'{OUT}/배드민턴_코트점수판_bm-v1.30.0_일지입구.png')

        # 2) 시트 열기 + 점수 누르기
        btn.click()
        page.wait_for_timeout(600)
        check('점수판 시트 열림', page.locator('#sheet [data-sb]').count() == 1)
        check('+1 버튼 2개', page.locator('#sheet [data-sb-point]').count() == 2)
        for _ in range(3):
            page.click('#sheet [data-sb-point="a"]')
            page.wait_for_timeout(120)
        a_txt = page.locator('#sheet [data-sb-a], #sheet .sb__num').first.inner_text()
        check('내 팀 +1 세 번 → 3', page.evaluate("""() => {
            const nums = document.querySelectorAll('#sheet .sb__num');
            return nums.length === 2 ? [nums[0].textContent, nums[1].textContent].join(':') : '';
        }""") == '3:0', page.evaluate("""() => {
            const nums = document.querySelectorAll('#sheet .sb__num');
            return nums.length === 2 ? [nums[0].textContent, nums[1].textContent].join(':') : '';
        }"""))

        # 3) 되돌리기
        page.click('#sheet [data-sb-undo]')
        page.wait_for_timeout(200)
        check('되돌리기 → 2:0', page.evaluate("""() => {
            const nums = document.querySelectorAll('#sheet .sb__num');
            return [nums[0].textContent, nums[1].textContent].join(':');
        }""") == '2:0')

        # 4) 25점제 · 단식 전환
        page.click('#sheet [data-sb-mode-val="25"]')
        page.wait_for_timeout(250)
        check('25점제로 바뀜', '25점제 · 2점 차' in page.locator('#sheet .sb__state').inner_text(),
              page.locator('#sheet .sb__state').inner_text())
        page.click('#sheet [data-sb-type-val="단식"]')
        page.wait_for_timeout(250)
        labels = page.locator('#sheet .sb__add').inner_text().replace('\n', ' ')
        check('단식 → 나/상대', '나' in labels and '상대' in labels, labels)

        # 5) 21점제 복식으로 되돌리고 21:17까지 (번갈아 누름)
        page.click('#sheet [data-sb-mode-val="21"]')
        page.wait_for_timeout(200)
        page.click('#sheet [data-sb-type-val="복식"]')
        page.wait_for_timeout(200)
        # 지금 2:0 → 내 팀 19점, 상대 17점을 번갈아 채움 (세트가 먼저 끝나지 않게)
        a, bb = 2, 0
        while a < 21 or bb < 17:
            if a < 21 and (a <= bb or bb >= 17):
                page.click('#sheet [data-sb-point="a"]')
                a += 1
            else:
                page.click('#sheet [data-sb-point="b"]')
                bb += 1
        page.wait_for_timeout(400)
        state = page.locator('#sheet .sb__state').inner_text()
        check('21:17 → 세트 종료', '세트 종료' in state and '승' in state, state)
        check('다음 세트 버튼', page.locator('#sheet [data-sb-next]').count() == 1)
        check('오늘 일지에 넣기 버튼', page.locator('#sheet [data-sb-save]').count() == 1)
        page.screenshot(path=f'{OUT}/배드민턴_코트점수판_bm-v1.30.0_세트종료.png')
        scores = page.locator('#sheet .sb__sets').inner_text().replace('\n', ' ')
        check('세트 목록 21:17', '21:17' in scores, scores)

        # 6) 오늘 일지에 넣기 → 시트 닫히고 폼이 채워짐
        page.click('#sheet [data-sb-save]')
        page.wait_for_timeout(900)
        check('시트 닫힘', page.locator('#sheet').count() == 0)
        draft = page.evaluate("() => JSON.parse(JSON.stringify(window.__store.state.drafts.log))")
        check('초안 게임 점수', draft.get('games') == [{'a': 21, 'b': 17}], draft.get('games'))
        check('초안 점수제', draft.get('gameMode') == 21, draft.get('gameMode'))
        check('초안 결과', draft.get('result') == '승', draft.get('result'))
        check('초안 완료훈련에 게임', '게임' in (draft.get('done') or []), draft.get('done'))
        check('초안 메모', '코트 점수판' in (draft.get('note') or ''), draft.get('note'))
        gamerow = page.evaluate("""() => {
            const v = document.querySelector('[data-field="gameA"]');
            const w = document.querySelector('[data-field="gameB"]');
            return v && w ? v.value + ':' + w.value : '';
        }""")
        check('폼에 21:17 보임', gamerow == '21:17', gamerow)
        note = page.evaluate("() => (document.querySelector('[data-field=\"note\"]') || {}).value || ''")
        check('메모 칸 채워짐', '코트 점수판' in note, note)
        toast = page.locator('#toast').inner_text() if page.locator('#toast').count() else ''
        check('안내 토스트', '일지에 넣었어요' in toast, toast)
        page.evaluate("document.querySelector('[data-form=\"log\"]').scrollIntoView({block:'start'})")
        page.wait_for_timeout(500)
        page.screenshot(path=f'{OUT}/배드민턴_코트점수판_bm-v1.30.0_일지자동채움.png')

        # 7) 저장 → 기록에 남고 AI 카드가 나옴
        page.click('[data-act="save-log"]')
        page.wait_for_timeout(1400)
        row = page.evaluate("""() => {
            const C = BM.domain.COL, rows = window.__store.state.rows;
            const mine = rows.filter(r => r[C['유형']] === '기록' && String(r[C['소셜글']] || '').includes('코트 점수판'));
            const r = mine[mine.length - 1] || [];
            return { score: r[C['게임점수']], result: r[C['승패']], done: r[C['완료훈련']], len: r.length };
        }""")
        check('저장된 게임점수 21:17', row.get('score') == '21:17', row)
        check('저장된 승패', row.get('result') == '승', row)
        check('26칸 그대로', row.get('len') == 26, row.get('len'))
        check('AI 카드 나옴', page.locator('[data-region="analysis"]').count() == 1)

        # 8) 드릴 타이머
        page.reload(wait_until='load')     # 점검 화면 기본 상태로
        page.wait_for_timeout(900)
        start = page.locator('[data-timer-start][data-timer-min="3"]').first
        check('타이머 3분 버튼', start.count() == 1)
        total_btns = page.locator('[data-timer-start]').count()
        check('타이머 버튼 14개(드릴 6 + 워밍업 8)', total_btns == 14, total_btns)
        name = page.evaluate("""() => {
            const el = document.querySelector('[data-timer-start]');
            return el ? el.closest('[data-dtimer]').getAttribute('data-dtimer-name') : '';
        }""")
        check('항목 이름 기억', bool(name), name)
        start.click()
        page.wait_for_timeout(1200)
        clock = page.locator('[data-timer-display]').first.inner_text()
        check('카운트다운 표시', clock.startswith('02:5'), clock)
        check('돌고 있는 위젯 1개', page.locator('.dtimer--on').count() == 1)
        check('일시정지 버튼', page.locator('[data-timer-toggle]').count() == 1)
        page.screenshot(path=f'{OUT}/배드민턴_드릴타이머_bm-v1.30.0_카운트다운.png')

        page.click('[data-timer-toggle]')
        page.wait_for_timeout(300)
        paused = page.evaluate("() => (BM.timer.state() || {}).running")
        check('일시정지', paused is False, paused)

        # 다른 항목 타이머를 시작하면 이전 타이머는 멈춤
        page.locator('[data-timer-start][data-timer-min="5"]').nth(1).click()
        page.wait_for_timeout(600)
        st = page.evaluate("() => BM.timer.state()")
        check('한 번에 하나만 (새 타이머만)', st and st.get('min') == 5 and st.get('key') != 'drill:0', st)
        check('돌고 있는 위젯 1개 유지', page.locator('.dtimer--on').count() == 1)

        page.click('[data-timer-reset]')
        page.wait_for_timeout(300)
        check('초기화 → 버튼으로 복귀', page.locator('[data-timer-display]').count() == 0)
        check('초기화 뒤 3분 버튼 다시', page.locator('[data-timer-start]').count() == 14)

        # 9) 타이머 종료 안내 (1초짜리로 줄여 확인)
        page.evaluate("() => BM.timer.start('drill:0', '드릴 점검', 1, Date.now() - 59000)")
        page.wait_for_timeout(1600)
        toast = page.locator('#toast').inner_text() if page.locator('#toast').count() else ''
        check('끝나면 토스트', '끝' in toast, toast)
        check('끝나면 타이머 꺼짐', page.evaluate("() => BM.timer.state()") is None)

        print('CONSOLE ERRORS', errs if errs else 'none')
        b.close()
finally:
    httpd.shutdown()

bad = [c for c in checks if not c[1]]
print('SUMMARY', str(len(checks) - len(bad)) + '/' + str(len(checks)))
if bad or errs:
    raise SystemExit(1)
