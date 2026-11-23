"""390x844 headless check — 2026-11-23 저녁 사용성 개선 3종 (local only).

실행:  python3 test/local-v163.py   (저장소 루트 기준, 로컬 서버를 스스로 띄우고 끝나면 닫습니다)

확인
 A. 지도: 반경 5km 동네 동호인을 누르면 '선택한 동호인' 카드가 열리고
    매칭 요청 · 프로필 보기 버튼이 바로 보인다 (매칭 요청 → 매칭 탭 프로필 시트 / 예시 안내)
 B. 코치: 일반 동호인(유형 미선택) 화면 — 위 탭 줄 없이 '코치 찾기 · 피드백' 한 줄,
    멘토 신청은 맨 아래 보조 줄. 눌러도 신청 화면이 그대로 열리고 돌아갈 길이 있다
 C. 커뮤니티 빈 화면: '게스트 모집 글쓰기' → 분류가 게스트 모집으로 바뀌고 모집 입력칸이 열린다
 D. 콘솔·페이지 오류 0건
"""
import http.server
import os
import socketserver
import subprocess
import threading
from functools import partial

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PORT = 8813
BASE = "http://127.0.0.1:%d" % PORT
OUT = os.environ.get("V163_OUT", "/workspace/downloads")
SHOTS = os.environ.get("V163_SHOTS", "/workspace/check-shots")
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
    for pattern in ("**://accounts.google.com/**", "**://apis.google.com/**", "**://*.gstatic.com/**"):
        ctx.route(pattern, lambda route: route.fulfill(status=200, content_type="application/javascript", body=""))


def freeze_clock(page):
    """불이 시간에 따라 달라지므로 늘 같은 저녁(월 20:30)에서 시작합니다."""
    page.clock.install(time="2026-11-23T20:30:00+09:00")
    page.clock.resume()


def enter_guest(page):
    freeze_clock(page)
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


def open_map(page):
    page.locator("#tabbar [data-tab='matching']").click()
    page.wait_for_timeout(700)
    page.locator("[data-act='open-gym-map']").first.click()
    page.wait_for_timeout(2400)


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

            step("A) 지도 — 반경 5km 동호인 선택 → 매칭/프로필 버튼")
            enter_guest(page)
            open_map(page)
            check("지도 열림", page.locator("#gympage.is-on").count() == 1)
            people = page.locator("#gympage .nearp")
            check("동네 동호인 카드 있음", people.count() >= 5, people.count())
            first = people.first
            first.click()
            page.wait_for_timeout(900)
            act = page.locator("#gympage [data-gymact]")
            check("선택한 동호인 카드 열림", act.count() == 1, act.count())
            act_txt = act.inner_text().replace("\n", " | ") if act.count() else ""
            check("카드에 이름·상태", "정하늘" in act_txt and "운동 가능 시간" in act_txt, act_txt[:150])
            match_btn = page.locator("#gympage [data-gym-match]")
            prof_btn = page.locator("#gympage [data-gym-profile]")
            check("매칭 요청 버튼", match_btn.count() == 1, match_btn.count())
            check("프로필 보기 버튼", prof_btn.count() == 1, prof_btn.count())
            check("버튼 이름", "매칭 요청" in match_btn.inner_text() and "프로필 보기" in prof_btn.inner_text())
            check("고른 카드 강조", page.evaluate(
                "() => !!document.querySelector('#gympage .nearp[aria-expanded=\"true\"]')"))
            check("지도 위 고른 사람 표시", page.evaluate(
                "() => !!document.querySelector('#gympage .gymp.is-sel')"))
            check("카드가 화면 안(하단 고정)", page.evaluate("""() => {
                const el = document.querySelector('#gympage [data-gymact]');
                if (!el) return false;
                const r = el.getBoundingClientRect();
                return r.top > 0 && r.bottom <= window.innerHeight + 1 && r.width > 200;
            }"""))

            # 같은 사람을 한 번 더 누르면 카드가 접힙니다(다시 누르면 열림).
            people.first.click()
            page.wait_for_timeout(600)
            check("같은 사람을 다시 누르면 접힘", page.locator("#gympage [data-gymact]").count() == 0)

            # 지도 쪽에서 사람 아이콘을 눌러도 화면을 옮기지 않고 카드가 뜨는지
            page.evaluate("() => { const b = document.querySelector('#gympage .gympage__body'); if (b) b.scrollTop = 0; }")
            page.wait_for_timeout(300)
            page.evaluate("() => { const m = document.querySelector('#gympage [data-gymmap]'); if (m) m.scrollIntoView({block:'center'}); }")
            page.wait_for_timeout(700)
            marker = page.locator("#gympage .leaflet-marker-pane .gymp").first
            if marker.count():
                marker.click()
                page.wait_for_timeout(900)
                check("지도 핀을 눌러도 카드가 화면 안", page.evaluate("""() => {
                    const el = document.querySelector('#gympage [data-gymact]');
                    if (!el) return false;
                    const r = el.getBoundingClientRect();
                    return r.top > 0 && r.bottom <= window.innerHeight + 1;
                }"""))
            page.screenshot(path=OUT + "/preview-evening-map-match.png")
            step("  saved preview-evening-map-match.png")

            step("A-2) 매칭 요청 — 매칭 탭 흐름으로 이어짐(예시 동호인은 안내)")
            match_btn.click()
            page.wait_for_timeout(700)
            sheet = page.locator("#sheet.is-on")
            check("시트 열림", sheet.count() == 1)
            body = page.locator("#sheet .sheet__body").inner_text().replace("\n", " | ")
            check("예시 동호인 안내", "예시 동호인" in body, body[:160])
            check("매칭으로 보내는 버튼", page.locator("#sheet [data-gym-find-mates]").count() == 1)
            page.screenshot(path=SHOTS + "/v163-map-match-sheet.png")
            page.locator("#sheet [data-close]").first.click()
            page.wait_for_timeout(500)

            step("A-3) 실제 매칭 프로필이 있으면 매칭 탭 프로필 시트가 열린다")
            page.locator("#gympage [data-gym-close]").click()
            page.wait_for_timeout(600)
            check("지도 닫힘", page.locator("#gympage").count() == 0)

            # 이 기기에만: 실제 프로필(동네 동호인) 한 명을 얹어 매칭 시트 연결을 확인합니다.
            page.evaluate("""() => {
                const raw = localStorage.getItem('bm_rows_v1');
                const rows = raw ? JSON.parse(raw) : [];
                rows.push({
                    id: 'e2e_prof_v163', type: '매칭프로필', createdAt: '2026-11-22 10:00',
                    userKey: 'e2e_chi', nick: '콕집사',
                    payload: { region: '서울', level: 'B조', discipline: '복식', club: '마포구민체육센터',
                               availability: '주말 오전', experience: '3년', bio: '주말 오전 위주', gender: '남' }
                });
                localStorage.setItem('bm_rows_v1', JSON.stringify(rows));
            }""")
            page.reload(wait_until="load")
            page.wait_for_timeout(1200)
            if page.locator("[data-act='guest']").count():
                page.locator("[data-act='guest']").first.click()
                page.wait_for_timeout(1000)
                for _ in range(4):
                    btn = page.locator("#sheet.is-on .sheet__panel .btn--primary")
                    if btn.count() == 0:
                        break
                    btn.first.click()
                    page.wait_for_timeout(400)
            open_map(page)
            real = page.locator("#gympage [data-gym-person='u:e2e_chi']")
            check("실제 프로필 동호인이 지도 목록에", real.count() >= 1, real.count())
            if real.count():
                real.first.click()
                page.wait_for_timeout(700)
                real_act = page.locator("#gympage [data-gymact]").inner_text().replace("\n", " | ")
                check("실제 프로필은 예시 안내가 없다", "예시 동호인" not in real_act, real_act[:140])
                check("매칭이 성사되면 대화 안내", "매칭이 성사되면" in real_act, real_act[:160])
                page.locator("#gympage [data-gym-match]").click()
                page.wait_for_timeout(800)
                check("매칭 탭 프로필 시트가 지도 위에", page.locator("#sheet.is-on").count() == 1)
                sheet_body = page.locator("#sheet .sheet__body").inner_text().replace("\n", " | ")
                check("프로필 시트 내용(궁합·요청)", "궁합" in sheet_body or "요청 보내기" in sheet_body, sheet_body[:160])
                page.screenshot(path=SHOTS + "/v163-map-real-profile-sheet.png")
                page.evaluate("() => { if (window.BM && BM.ui && BM.ui.closeSheet) BM.ui.closeSheet(); }")
                page.wait_for_timeout(500)
                page.locator("#gympage [data-gym-close]").click()
                page.wait_for_timeout(500)
            # 얹은 확인용 프로필은 지웁니다(이 기기 저장값).
            page.evaluate("""() => {
                const raw = localStorage.getItem('bm_rows_v1');
                if (!raw) return;
                const rows = JSON.parse(raw).filter((r) => r.id !== 'e2e_prof_v163');
                localStorage.setItem('bm_rows_v1', JSON.stringify(rows));
            }""")

            step("B) 코치 — 일반 동호인 화면 정리")
            page.locator("#tabbar [data-tab='coach']").click()
            page.wait_for_timeout(900)
            view = page.locator(".view[data-view='coach']")
            check("코치 화면", view.count() == 1)
            check("위 탭 줄 없음", view.locator("[data-coachtabs].seg").count() == 0)
            line = view.locator("p.coachline")
            check("'코치 찾기 · 피드백' 한 줄", line.count() == 1 and "코치 찾기" in line.inner_text(),
                  line.inner_text() if line.count() else "")
            check("코치 안내 카드", "코치에게 피드백 받기" in view.inner_text())
            entry = view.locator("[data-coachmentor]")
            check("멘토 신청 보조 줄", entry.count() == 1)
            entry_txt = entry.inner_text().replace("\n", " | ") if entry.count() else ""
            check("보조 줄 문구", "코치·지도자이신가요?" in entry_txt and "멘토 신청" in entry_txt, entry_txt[:120])
            check("멘토 신청은 목록 아래", page.evaluate("""() => {
                const v = document.querySelector(".view[data-view='coach']");
                const a = v.querySelector('.card--coach');
                const b = v.querySelector('[data-coachmentor]');
                return !!(a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING));
            }"""))
            mode = page.evaluate("""() => {
                const m = document.querySelector('main');
                return { scroll: m.scrollHeight, client: m.clientHeight };
            }""")
            if mode["scroll"] > mode["client"] + 8:
                page.evaluate("() => { const m = document.querySelector('main'); m.scrollTop = m.scrollHeight; }")
                page.wait_for_timeout(400)
            page.screenshot(path=OUT + "/preview-evening-coach-tab.png")
            step("  saved preview-evening-coach-tab.png")

            step("B-2) 보조 줄 → 멘토 신청 화면 · 돌아가기")
            entry.locator("[data-coachtab='apply']").click()
            page.wait_for_timeout(700)
            view = page.locator(".view[data-view='coach']")
            check("신청 화면 열림", view.locator("[data-mentor-field='affiliation']").count() == 1)
            check("돌아가기", view.locator("[data-coachtab='feedback']").count() >= 1)
            page.locator(".view[data-view='coach'] [data-coachtab='feedback']").first.click()
            page.wait_for_timeout(600)
            check("코치 찾기로 돌아옴",
                  page.locator(".view[data-view='coach'] [data-coachmentor]").count() == 1)

            step("C) 커뮤니티 빈 화면 — 게스트 모집 글쓰기")
            page.locator("#tabbar [data-tab='community']").click()
            page.wait_for_timeout(900)
            view = page.locator(".view[data-view='community']")
            check("빈 화면", "아직 글이 없어요" in view.inner_text())
            guest_btn = view.locator("[data-act='write-guest']")
            check("게스트 모집 글쓰기 버튼", guest_btn.count() == 1)
            check("버튼 이름", "게스트 모집 글쓰기" in guest_btn.inner_text())
            page.evaluate("() => { const m = document.querySelector('main'); m.scrollTop = m.scrollHeight; }")
            page.wait_for_timeout(400)
            page.screenshot(path=OUT + "/preview-evening-community-guest.png")
            step("  saved preview-evening-community-guest.png")

            step("C-2) 누르면 분류가 게스트 모집으로 · 모집 입력칸이 열린다")
            guest_btn.click()
            page.wait_for_timeout(900)
            view = page.locator(".view[data-view='community']")
            picked = page.evaluate("""() => {
                const on = document.querySelector('.view[data-view="community"] [data-topic].is-on');
                return on ? on.getAttribute('data-topic') : '';
            }""")
            check("분류 = 게스트 모집", picked == "게스트 모집", picked)
            vite = view.locator("[data-viteform]")
            check("모집 입력칸 열림", vite.count() == 1 and vite.is_visible())
            focused = page.evaluate("""() => {
                const a = document.activeElement;
                if (!a) return '';
                if (a.hasAttribute('data-composer')) return 'data-composer';
                return a.getAttribute('data-vitefield') || a.tagName;
            }""")
            check("글쓰기 칸에 포커스", focused == "data-composer", focused)
            page.evaluate("() => { const m = document.querySelector('main'); if (m) m.scrollTop = 0; }")
            page.wait_for_timeout(400)
            page.screenshot(path=OUT + "/preview-evening-community-guest-compose.png")
            step("  saved preview-evening-community-guest-compose.png")

            check("콘솔·페이지 오류 0건", len(ERRORS) == 0, ERRORS[:5])
            browser.close()
    finally:
        httpd.shutdown()

    print("", flush=True)
    if FAILS:
        print("실패 %d건" % len(FAILS), flush=True)
        for f in FAILS:
            print("  - " + f, flush=True)
        raise SystemExit(1)
    print("모두 통과", flush=True)


if __name__ == "__main__":
    main()
