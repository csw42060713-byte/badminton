"""390x844 headless check — 사용성 다듬기 미리보기 (로컬 폴더만, 배포 없음)

확인
 A. 프로필 꾸미기 — 사진·프레임 아래 프레임/배경/아이콘/배지 소제목, 하단 한 줄 안내
 B. 잠긴 프레임 → 미리보기 → 닫기 → 프로필 꾸미기 창 유지(스크롤·고치던 값 그대로)
 C. 미리보기의 위 × 로 닫아도 같은 동선
 D. 체육관 지도 — 내 집 설정 후 목록이 내 집에서 가까운 순
 E. 콘솔/페이지 오류 0건
"""
import http.server
import os
import socketserver
import subprocess
import threading
from functools import partial

from playwright.sync_api import sync_playwright

ROOT = os.environ.get("UX_ROOT") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8823
BASE = "http://127.0.0.1:%d" % PORT
OUT = os.environ.get("UX_OUT") or "/workspace/downloads"
SHOTS = os.environ.get("UX_SHOTS") or "/workspace/check-shots"
ERRORS = []
FAILS = []


def step(msg):
    print(msg, flush=True)


def check(name, ok, detail=""):
    print(("  PASS " if ok else "  FAIL ") + name + (" — " + str(detail) if detail else ""), flush=True)
    if not ok:
        FAILS.append(name + (" — " + str(detail) if detail else ""))


def serve():
    handler = partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def wire(page):
    page.on("console", lambda m: ERRORS.append("console.%s: %s" % (m.type, m.text))
            if m.type in ("error", "assert") else None)
    page.on("pageerror", lambda e: ERRORS.append("pageerror: %s" % e))


def route_external(ctx):
    for pattern in ("**://accounts.google.com/**", "**://apis.google.com/**", "**://*.gstatic.com/**",
                    "**://script.google.com/**", "**://*.supabase.co/**"):
        ctx.route(pattern, lambda route: route.fulfill(status=200, content_type="application/javascript", body=""))


def enter_guest(page):
    page.goto(BASE + "/index.html", wait_until="load")
    page.evaluate("() => { localStorage.clear(); sessionStorage.clear(); }")
    page.reload(wait_until="load")
    page.wait_for_timeout(1000)
    page.locator("[data-act='guest']").first.click()
    page.wait_for_timeout(1200)
    for _ in range(4):
        btn = page.locator("#sheet.is-on .sheet__panel .btn--primary")
        if btn.count() == 0:
            break
        btn.first.click()
        page.wait_for_timeout(400)


def open_decorate(page):
    page.locator("#tabbar [data-tab='my']").click()
    page.wait_for_timeout(700)
    page.locator("[data-act='decorate-sheet']").first.click()
    page.wait_for_timeout(900)


def sheet_scroll(page):
    return page.evaluate("() => { const s = document.querySelector('#sheet .sheet__body'); return s ? s.scrollTop : -1; }")


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(SHOTS, exist_ok=True)
    httpd = serve()
    code = subprocess.run(["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", BASE + "/index.html"],
                          capture_output=True, text=True).stdout
    print("server:", code, flush=True)
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                                      locale="ko-KR", service_workers="block")
            route_external(ctx)
            page = ctx.new_page()
            wire(page)

            # ── A. 꾸미기 화면 문구·소제목
            step("A) 프로필 꾸미기 — 소제목 · 하단 안내")
            enter_guest(page)
            open_decorate(page)
            check("꾸미기 시트 열림", page.locator("#sheet .sheet__head h2").inner_text().strip() == "프로필 꾸미기",
                  page.locator("#sheet .sheet__head h2").inner_text())
            subs = page.evaluate("""() => [...document.querySelectorAll('#sheet .deco__sub')].map(n => ({
                key: n.getAttribute('data-sub'), text: n.textContent.trim(),
                top: Math.round(n.getBoundingClientRect().top)
            }))""")
            check("소제목 4개", len(subs) == 4, subs)
            check("소제목 글자", [s["text"] for s in subs] == ["프레임", "배경", "아이콘", "배지"],
                  [s["text"] for s in subs])
            check("소제목 차례(위→아래)", [s["key"] for s in subs] == ["frame", "bg", "emoji", "badge"],
                  [s["key"] for s in subs])
            order_ok = page.evaluate("""() => {
                const body = document.querySelector('#sheet .sheet__body');
                const pos = sel => { const n = body.querySelector(sel); return n ? n.getBoundingClientRect().top : 1e9; };
                return pos('[data-sub="frame"]') < pos('[data-dframe]')
                    && pos('[data-sub="bg"]') < pos('[data-dbg]')
                    && pos('[data-sub="emoji"]') < pos('[data-demoji]')
                    && pos('[data-sub="badge"]') < pos('[data-dbadge]');
            }""")
            check("소제목이 각 묶음 바로 위", order_ok)
            hint = page.evaluate("""() => {
                const b = document.querySelector('#sheet .sheet__body');
                const p = [...b.querySelectorAll('p.hint')].pop();
                return p ? p.textContent.trim() : '';
            }""")
            check("하단 한 줄 안내", hint == "저장하면 MY 카드와 1:1 매칭 프로필에 바로 반영돼요.", hint)
            all_text = page.inner_text("#sheet")
            check("개발자 문구 없음", ("26칸" not in all_text) and ("JSON" not in all_text), all_text[:0])
            metrics = page.evaluate("""() => {
                const b = document.querySelector('#sheet .sheet__body');
                const p = document.querySelector('#sheet .sheet__panel');
                const save = document.querySelector('#sheet [data-act="deco-save"]');
                const hint = [...b.querySelectorAll('p.hint')].pop();
                return { bodyH: b.clientHeight, scrollH: b.scrollHeight, panelH: p.clientHeight,
                         saveTop: Math.round(save.getBoundingClientRect().top),
                         hintBottom: Math.round(hint.getBoundingClientRect().bottom), vh: innerHeight };
            }""")
            print("   layout:", metrics, flush=True)

            # ── B. 잠긴 프레임 미리보기 → 닫기
            step("B) 잠긴 프레임 → 미리보기 → 닫기")
            page.evaluate("() => { const s = document.querySelector('#sheet .sheet__body'); s.scrollTop = 180; }")
            page.wait_for_timeout(300)
            nick = "나래" + "9"
            page.fill('#sheet [data-dtext="nick"]', nick)
            page.wait_for_timeout(200)
            before = sheet_scroll(page)
            locked = page.evaluate("""() => {
                const b = Array.from(document.querySelectorAll('[data-dframe]')).find(x => x.classList.contains('is-locked'));
                return b ? b.getAttribute('data-dframe') : '';
            }""")
            check("잠긴 프레임 있음", bool(locked), locked)
            page.click('[data-dframe="%s"]' % locked)
            page.wait_for_timeout(800)
            check("미리보기 열림", "미리보기" in page.locator("#sheet .sheet__head h2").inner_text(),
                  page.locator("#sheet .sheet__head h2").inner_text())
            page.screenshot(path=SHOTS + "/ux_preview_01_미리보기.png")
            page.click('#sheet [data-dpv-act="close"]')
            page.wait_for_timeout(900)
            title = page.locator("#sheet .sheet__head h2").inner_text().strip()
            check("닫기 → 프로필 꾸미기 유지", title == "프로필 꾸미기", title)
            check("꾸미기 칸이 그대로", page.locator("#sheet [data-dframe]").count() > 0)
            after = sheet_scroll(page)
            check("보던 스크롤 자리 유지", abs(after - before) <= 2, (before, after))
            check("고치던 닉네임 유지", page.input_value('#sheet [data-dtext="nick"]') == nick,
                  page.input_value('#sheet [data-dtext="nick"]'))
            page.screenshot(path=SHOTS + "/ux_preview_02_돌아옴.png")

            # ── C. 위 × 로 닫기
            step("C) 미리보기의 위 × 로 닫기")
            page.click('[data-dframe="%s"]' % locked)
            page.wait_for_timeout(800)
            check("미리보기 다시 열림", "미리보기" in page.locator("#sheet .sheet__head h2").inner_text(),
                  page.locator("#sheet .sheet__head h2").inner_text())
            page.click("#sheet .sheet__head [data-close]")
            page.wait_for_timeout(900)
            title = page.locator("#sheet .sheet__head h2").inner_text().strip()
            check("× 로 닫아도 꾸미기 유지", title == "프로필 꾸미기", title)

            # 배지도 같은 길
            page.evaluate("() => { const s = document.querySelector('#sheet .sheet__body'); s.scrollTop = s.scrollHeight; }")
            page.wait_for_timeout(300)
            lock_badge = page.evaluate("""() => {
                const b = Array.from(document.querySelectorAll('[data-dbadge]')).find(x => x.classList.contains('is-locked'));
                return b ? b.getAttribute('data-dbadge') : '';
            }""")
            if lock_badge:
                page.click('[data-dbadge="%s"]' % lock_badge)
                page.wait_for_timeout(800)
                check("잠긴 배지 → 미리보기", "미리보기" in page.locator("#sheet .sheet__head h2").inner_text(),
                      page.locator("#sheet .sheet__head h2").inner_text())
                page.click('#sheet [data-dpv-act="close"]')
                page.wait_for_timeout(900)
                check("배지 닫기 → 꾸미기 유지",
                      page.locator("#sheet .sheet__head h2").inner_text().strip() == "프로필 꾸미기",
                      page.locator("#sheet .sheet__head h2").inner_text())

            # ── B2. 하트가 넉넉할 때: 해금 성공도 미리보기를 닫고 꾸미기로
            step("B2) 해금 성공 → 꾸미기로 (미리보기 위에 겹치지 않음)")
            page.evaluate("() => { const st = BM.app.ctx.store.state; st.data.hearts.balance = 9; }")
            page.wait_for_timeout(200)
            page.click('[data-dframe="%s"]' % locked)
            page.wait_for_timeout(800)
            check("해금 버튼 있음", page.locator('#sheet [data-dpv-act="unlock"]').count() == 1)
            page.click('#sheet [data-dpv-act="unlock"]')
            page.wait_for_timeout(1200)
            title = page.locator("#sheet .sheet__head h2").inner_text().strip()
            check("해금 → 꾸미기 창", title == "프로필 꾸미기", title)
            on = page.evaluate("() => { const b = document.querySelector('[data-dframe=\"%s\"]'); return b ? b.classList.contains('is-on') : null; }" % locked)
            check("해금한 프레임이 골라져 있음", on is True, on)
            check("시트가 하나만", page.locator("#sheet").count() == 1, page.locator("#sheet").count())

            # ── A2. 화면 1) 미리보기용 캡처 — 시트 전체를 한 장에 (스크롤되는 화면이라
            #      제목·소제목·하단 안내를 함께 보이도록 시트를 펼쳐서 찍습니다)
            step("A2) 프로필 꾸미기 화면 캡처")
            page.wait_for_timeout(2600)          # 해금 토스트가 사라진 뒤
            page.evaluate("() => { const s = document.querySelector('#sheet .sheet__body'); s.scrollTop = 0; }")
            page.wait_for_timeout(400)
            page.evaluate("""() => {
                const p = document.querySelector('#sheet .sheet__panel');
                const b = document.querySelector('#sheet .sheet__body');
                p.style.maxHeight = 'none'; p.style.height = 'auto';
                b.style.maxHeight = 'none'; b.style.height = 'auto'; b.style.overflow = 'visible';
            }""")
            page.wait_for_timeout(500)
            page.locator("#sheet .sheet__panel").screenshot(path=OUT + "/preview-ux-profile-polish.png")
            metrics2 = page.evaluate("""() => {
                const b = document.querySelector('#sheet .sheet__body');
                const p = document.querySelector('#sheet .sheet__panel');
                return { panelH: p.clientHeight, bodyH: b.clientHeight, scrollH: b.scrollHeight };
            }""")
            print("   panel:", metrics2, flush=True)
            page.reload(wait_until="load")
            page.wait_for_timeout(1400)

            # ── D. 체육관 지도 — 내 집 가까운 순
            step("D) 체육관 지도 — 내 집에서 가까운 순")
            page.locator("#tabbar [data-tab='matching']").click()
            page.wait_for_timeout(700)
            page.locator("[data-act='open-gym-map']").first.click()
            page.wait_for_timeout(2500)
            check("지도 열림", page.locator("#gympage.is-on").count() == 1)
            note0 = page.inner_text("#gympage [data-gymnote]").replace("\n", " ")
            print("   note(전):", note0, flush=True)
            page.click("#gympage [data-gym-home]")
            page.wait_for_timeout(700)
            page.click('#sheet [data-home-place="신길동"]')
            page.wait_for_timeout(1400)
            home = page.inner_text("#gympage [data-gymhome]").replace("\n", " | ")
            check("내 집 = 신길동", "신길동" in home, home)
            note = page.inner_text("#gympage [data-gymnote]").replace("\n", " ")
            check("지도 안내에 가까운 순", "가까운 순" in note, note)
            cards = page.evaluate("""() => [...document.querySelectorAll('#gympage [data-gym-card]')].map(n => ({
                id: n.getAttribute('data-gym-card'),
                name: (n.querySelector('h3') || {}).textContent || '',
                dist: (n.querySelector('.gymcard__dist') || {}).textContent || ''
            }))""")
            check("카드마다 거리 표시", all(c["dist"] for c in cards), [c["dist"] for c in cards[:5]])
            kms = []
            for c in cards:
                txt = c["dist"].replace("약", "").replace("km", "").strip()
                try:
                    kms.append(float(txt))
                except ValueError:
                    kms.append(None)
            check("거리 오름차순", all(kms[i] is None or kms[i - 1] is None or kms[i] >= kms[i - 1]
                                     for i in range(1, len(kms))), kms[:10])
            print("   첫 카드:", cards[0]["name"], cards[0]["dist"], flush=True)
            check("첫 카드가 집 앞", cards[0]["dist"] and float(cards[0]["dist"].replace("약", "").replace("km", "").strip()) <= 3.0,
                  cards[0])
            page.wait_for_timeout(2600)          # '내 집을 바꿨어요' 토스트가 사라진 뒤
            page.evaluate("() => { const n = document.querySelector('#gympage [data-gymmap]'); if (n) n.scrollIntoView({block:'start'}); }")
            page.wait_for_timeout(900)
            shot_note = page.inner_text("#gympage [data-gymnote]").replace("\n", " ")
            check("캡처 화면에 지도 안내 보임", "가까운 순" in shot_note, shot_note)
            page.screenshot(path=OUT + "/preview-ux-map-nearby.png")
            page.screenshot(path=SHOTS + "/ux_preview_03_지도목록.png")

            print("\n콘솔·페이지 오류:", len(ERRORS), flush=True)
            for e in ERRORS[:10]:
                print("  ", e, flush=True)
            check("콘솔·페이지 오류 0건", len(ERRORS) == 0, ERRORS[:3])
            browser.close()
    finally:
        httpd.shutdown()

    print("\n실패:", len(FAILS), flush=True)
    for f in FAILS:
        print("  -", f, flush=True)
    print("결과:", "통과" if not FAILS else "실패 있음", flush=True)
    return 1 if FAILS else 0


if __name__ == "__main__":
    raise SystemExit(main())
