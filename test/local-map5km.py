"""390x844 headless check — 내 집 반경 5km · 동네 동호인 · 지도 안 게스트 모집 (local only).

실행:  python3 test/local-map5km.py   (저장소 루트 기준, 로컬 서버를 스스로 띄우고 끝내 닫습니다)

확인
 A. 지도 화면: 내 상태 카드(운동 중/지금 운동 가능/운동 가능 시간) · 내 집 줄 · 반경 5km 원
    · 5km 안 동호인 사람 아이콘(파란 불 켜짐 / 꺼짐) · 5km 밖은 빠짐
 B. 내 상태 토글: '지금 운동 가능'을 끄면 내 불이 꺼지고, 운동 중을 켜면 파란 불
 C. 내 집 바꾸기: 동네 프리셋으로 바꾸면 원·사람이 따라 옮겨 감
 D. 지도 안 게스트 모집: 모집 글 쓰기 → 올리기 → 지도 안 목록에 바로 보임 · 참여 문의로 단체방
 E. 콘솔/페이지 오류 0건
"""
import http.server
import json
import os
import socketserver
import subprocess
import sys
import threading
from functools import partial

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PORT = 8797
BASE = "http://127.0.0.1:%d" % PORT
OUT = os.environ.get("MAP5KM_OUT", "/workspace/downloads")
SHOTS = os.environ.get("MAP5KM_SHOTS", "/workspace/check-shots")
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
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    return httpd


def wire(page):
    page.on("console", lambda m: ERRORS.append("console.%s: %s" % (m.type, m.text))
            if m.type in ("error", "assert") else None)
    page.on("pageerror", lambda e: ERRORS.append("pageerror: %s" % e))


def route_external(ctx):
    for pattern in ("**://accounts.google.com/**", "**://apis.google.com/**", "**://*.gstatic.com/**"):
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


def open_map(page):
    page.locator("#tabbar [data-tab='matching']").click()
    page.wait_for_timeout(700)
    page.locator("[data-act='open-gym-map']").first.click()
    page.wait_for_timeout(2400)


def rows(page):
    return page.evaluate("""() => [...document.querySelectorAll('#gympage .nearp')].map(n => ({
        id: n.getAttribute('data-gym-person'),
        lit: n.classList.contains('is-lit'),
        status: (n.querySelector('.nearp__s') || {}).textContent || '',
        text: n.innerText.replace(/\\n/g, ' / ')
    }))""")


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(SHOTS, exist_ok=True)
    httpd = serve()
    html = subprocess.run(["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", BASE + "/index.html"],
                          capture_output=True, text=True).stdout
    print("server:", html, flush=True)
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                                      locale="ko-KR", service_workers="block")
            route_external(ctx)
            page = ctx.new_page()
            wire(page)

            step("A) 지도 화면 — 내 집 반경 5km · 동네 동호인")
            enter_guest(page)
            open_map(page)
            check("지도 열림", page.locator("#gympage.is-on").count() == 1)
            check("내 상태 카드", page.locator("#gympage section.mystat").count() == 1)
            stat = page.inner_text("#gympage [data-gymmystat]").replace("\n", " | ")
            check("내 상태: 파란 불 켜짐", "파란 불 켜짐" in stat, stat[:120])
            check("내 상태: 운동 가능 시간", "운동 가능 시간" in stat, stat[:140])
            check("스위치 둘", page.locator("#gympage [data-mystat-work]").count() == 1 and
                  page.locator("#gympage [data-mystat-free]").count() == 1)
            check("운동 가능 시간 칩 4개", page.locator("#gympage [data-mystat-range]").count() == 4,
                  page.locator("#gympage [data-mystat-range]").count())
            home = page.inner_text("#gympage [data-gymhome]").replace("\n", " | ")
            check("내 집 줄: 망원동 · 반경 5km", "망원동" in home and "반경 5km" in home, home)
            check("내 집 바꾸기 버튼", page.locator("#gympage [data-gym-home]").count() == 1)

            rws = rows(page)
            check("5km 안 동호인 7명", len(rws) == 7, len(rws))
            lit = [r for r in rws if r["lit"]]
            off = [r for r in rws if not r["lit"]]
            check("파란 불 켜진 사람 있음", len(lit) >= 3, len(lit))
            check("불 꺼진 사람 있음", len(off) >= 2, len(off))
            check("'운동 중' 표시", any("운동 중" in r["status"] for r in rws),
                  [r["status"] for r in rws])
            check("'운동 끝' 표시", any("운동 끝" in r["status"] for r in rws), [r["status"] for r in rws])
            check("'운동 시간 아님' 표시", any("운동 시간 아님" in r["status"] for r in rws),
                  [r["status"] for r in rws])
            note = page.inner_text("#gympage [data-gymnote]").replace("\n", " ")
            check("지도 안내: 내 집 반경 5km · 동호인 7명", "반경 5km" in note and "7명" in note, note)
            near_sum = page.inner_text("#gympage [data-near-sum]").replace("\n", " ")
            check("5km 밖 2명 표시", "5km 밖 2명" in near_sum, near_sum)
            dists = page.evaluate("""() => [...document.querySelectorAll('#gympage .nearp__t small')].map(n => n.textContent)""")
            check("가까운 순 정렬(첫 줄 정하늘)", "정하늘" in rws[0]["text"], rws[0]["text"])

            check("지도 위 사람 아이콘", page.evaluate("()=>document.querySelectorAll('#gympage .gymp-wrap').length") == 7,
                  page.evaluate("()=>document.querySelectorAll('#gympage .gymp-wrap').length"))
            check("지도 위 파란 불 아이콘", page.evaluate("()=>document.querySelectorAll('#gympage .leaflet-marker-pane .gymp.is-lit').length") == len(lit),
                  page.evaluate("()=>document.querySelectorAll('#gympage .leaflet-marker-pane .gymp.is-lit').length"))
            check("지도 위 내 집 핀", page.evaluate("()=>document.querySelectorAll('#gympage .leaflet-marker-pane .gymhome-pin').length") == 1,
                  page.evaluate("()=>document.querySelectorAll('#gympage .leaflet-marker-pane .gymhome-pin').length"))
            check("반경 5km 원(Leaflet)", page.evaluate("()=>document.querySelectorAll('#gympage .leaflet-overlay-pane path').length") >= 1,
                  page.evaluate("()=>document.querySelectorAll('#gympage .leaflet-overlay-pane path').length"))
            blue = page.evaluate("""() => {
                const c = document.querySelector('#gympage .gymp.is-lit');
                return c ? getComputedStyle(c).backgroundColor : '';
            }""")
            check("파란 불 색(#3b82f6)", blue.replace(" ", "") == "rgb(59,130,246)", blue)
            tiles = page.evaluate("""() => [...document.querySelectorAll('[data-gymmap] img.leaflet-tile')]
                .filter(i => i.complete && i.naturalWidth > 0).length""")
            check("OSM 타일", tiles >= 4, tiles)

            page.evaluate("() => { const b=document.querySelector('#gympage .gympage__body'); if (b) b.scrollTop = 0; }")
            page.wait_for_timeout(500)
            page.screenshot(path=OUT + "/preview-map-5km-people.png")
            step("  saved preview-map-5km-people.png")

            step("B) 내 상태 토글 — '지금 운동 가능' 끄기 / '운동 중' 켜기")
            page.locator("#gympage [data-mystat-free]").click()
            page.wait_for_timeout(500)
            stat2 = page.inner_text("#gympage [data-gymmystat]").replace("\n", " | ")
            check("'지금 운동 가능' 꺼짐 반영", "지금 운동 가능" in stat2, stat2[:160])
            check("매일 19–22시라 저녁엔 여전히 켜짐", "파란 불 켜짐" in stat2, stat2[:120])
            page.locator("#gympage [data-mystat-work]").click()
            page.wait_for_timeout(500)
            stat3 = page.inner_text("#gympage [data-gymmystat]").replace("\n", " | ")
            check("운동 중 켜면 '운동 중 · 파란 불 켜짐'", "운동 중" in stat3 and "파란 불 켜짐" in stat3, stat3[:160])
            check("내 상태 저장(localStorage)", page.evaluate("() => { const k = Object.keys(localStorage).filter(x=>x.indexOf('bm_my_avail_v1')===0); return k.length===1 && JSON.parse(localStorage[k[0]]).working===true; }"))
            page.locator("#gympage [data-mystat-work]").click()
            page.wait_for_timeout(400)

            step("C) 내 집 바꾸기 — 동네 프리셋")
            page.locator("#gympage [data-gym-home]").click()
            page.wait_for_timeout(700)
            check("내 집 시트 열림", page.locator("#sheet.is-on").count() == 1)
            check("동네 프리셋 9곳", page.locator("#sheet [data-home-place]").count() == 9,
                  page.locator("#sheet [data-home-place]").count())
            page.locator("#sheet [data-home-place='여의도']").click()
            page.wait_for_timeout(1200)
            home2 = page.inner_text("#gympage [data-gymhome]").replace("\n", " | ")
            check("내 집이 여의도로 바뀜", "여의도" in home2, home2)
            note2 = page.inner_text("#gympage [data-gymnote]").replace("\n", " ")
            check("여의도 기준으로 사람 수 다시 셈", "반경 5km" in note2, note2)
            rows2 = rows(page)
            check("여의도 기준 5km 안 인원", len(rows2) >= 1, len(rows2))
            page.screenshot(path=SHOTS + "/map5km-home-yeuido.png")
            # 되돌리기 — 망원동
            page.locator("#gympage [data-gym-home]").click()
            page.wait_for_timeout(600)
            page.locator("#sheet [data-home-place='망원동']").click()
            page.wait_for_timeout(1000)
            check("망원동으로 되돌림", "망원동" in page.inner_text("#gympage [data-gymhome]"))

            step("D) 지도 안 게스트 모집 — 모집 글 쓰기 · 올리기")
            page.locator("#gympage [data-gym-recruit-new]").click()
            page.wait_for_timeout(700)
            check("모집 작성 칸 열림", page.locator("#gympage [data-gymrecform]").count() == 1)
            check("가까운 체육관 칩 4곳", page.locator("#gympage [data-gymrec-place]").count() == 4,
                  page.locator("#gympage [data-gymrec-place]").count())
            page.locator("#gympage [data-gymrec-place]").first.click()
            page.wait_for_timeout(300)
            place = page.evaluate("() => document.querySelector('#gympage [data-gymrec=\"place\"]').value")
            check("체육관 칩이 칸에 담김", bool(place), place)
            page.locator("#gympage [data-gymrec=\"when\"]").fill("오늘 20:30")
            page.locator("#gympage [data-gymrec=\"cap\"]").fill("4")
            page.locator("#gympage [data-gymrec-feeval='1만원']").click()
            page.wait_for_timeout(300)
            page.locator("#gympage [data-gym-recruit-post]").click()
            page.wait_for_timeout(1200)
            sumr = page.inner_text("#gympage [data-recruit-sum]").replace("\n", " ")
            check("모집 목록에 1건", "1건" in sumr, sumr)
            check("작성 칸은 올린 뒤 닫힘", page.locator("#gympage [data-gymrecform]").count() == 0)
            # 다시 열어 '지도 + 작성 칸 + 올라간 모집 카드'가 한 화면에 보이게 (미리보기 2)
            page.locator("#gympage [data-gym-recruit-new]").click()
            page.wait_for_timeout(500)
            page.locator("#gympage [data-gymrec=\"when\"]").fill("오늘 20:30")
            page.locator("#gympage [data-gymrec=\"cap\"]").fill("4")
            page.locator("#gympage [data-gymrec-feeval='1만원']").click()
            page.wait_for_timeout(300)
            page.evaluate("() => { const b=document.querySelector('#gympage .gympage__body'); const r=document.querySelector('#gympage [data-gymrecruit]'); if (b && r) b.scrollTop = r.offsetTop - 240; }")
            page.wait_for_timeout(500)
            page.screenshot(path=OUT + "/preview-map-guest-recruit.png")
            step("  saved preview-map-guest-recruit.png")
            page.evaluate("() => { const b=document.querySelector('#gympage .gympage__body'); const r=document.querySelector('#gympage [data-gymrecruit]'); if (b && r) b.scrollTop = r.offsetTop - 100; }")
            page.wait_for_timeout(400)
            card = page.inner_text("#gympage [data-gym-recruit-card]").replace("\n", " | ") if page.locator("#gympage [data-gym-recruit-card]").count() else ""
            check("모집 카드: 언제·몇 명·게스트비", "오늘 20:30" in card and "4명" in card and "1만원" in card, card[:160])
            check("내 글로 표시", "내 글" in card, card[:120])
            check("카드 버튼", page.locator("#gympage [data-gym-recruit-open]").count() == 1)
            page.screenshot(path=SHOTS + "/map5km-recruit-posted.png")

            step("E) 참여 문의 — 단체방 열기")
            page.locator("#gympage [data-gym-recruit-open]").first.click()
            page.wait_for_timeout(1200)
            chat = page.locator("#dm .dm").count() + page.locator("[data-dm]").count()
            open_dm = page.evaluate("() => !!(BM.app.ctx.store.state.ui.chatOpen)")
            check("단체방 열림", open_dm, page.evaluate("() => BM.app.ctx.store.state.ui.chatRoom"))
            check("지도 화면 닫힘", page.locator("#gympage.is-on").count() == 0)
            # 단체방 닫기 (뒤로 → 대화 목록 닫기)
            page.locator("#dm [data-dm-back]").first.click()
            page.wait_for_timeout(600)
            page.evaluate("() => { if (BM.app.ctx.store.state.ui.chatOpen) BM.app.ctx.actions.closeChats(); }")
            page.wait_for_timeout(500)
            check("단체방 닫힘", page.evaluate("() => !BM.app.ctx.store.state.ui.chatOpen"))

            step("F) 커뮤니티에서도 같은 모집 글이 보인다")
            page.locator("#tabbar [data-tab='community']").click()
            page.wait_for_timeout(900)
            check("커뮤니티 글에 모집 카드", page.locator("#main [data-region='posts'] .vite").count() >= 1,
                  page.locator("#main [data-region='posts'] .vite").count())

            step("G) '불 켜진 사람만' — 목록과 지도가 함께 걸러진다")
            page.locator("#tabbar [data-tab='matching']").click()
            page.wait_for_timeout(600)
            page.locator("[data-act='open-gym-map']").first.click()
            page.wait_for_timeout(2200)
            page.locator("#gympage [data-gym-onlylit]").click()
            page.wait_for_timeout(700)
            check("불 켜진 동호인만 5명", len(rows(page)) == 5, len(rows(page)))
            check("지도 아이콘도 5명", page.evaluate("()=>document.querySelectorAll('#gympage .leaflet-marker-pane .gymp').length") == 5,
                  page.evaluate("()=>document.querySelectorAll('#gympage .leaflet-marker-pane .gymp').length"))
            page.locator("#gympage [data-gym-onlylit]").click()
            page.wait_for_timeout(500)
            check("다시 전체 7명", len(rows(page)) == 7, len(rows(page)))

            step("H) 내 집 '지도에서 찍기' — 누른 자리가 내 집이 된다")
            page.locator("#gympage [data-gym-home]").click()
            page.wait_for_timeout(600)
            page.locator("#sheet [data-home-pickmap]").click()
            page.wait_for_timeout(800)
            box = page.locator("#gympage [data-gymmap]").bounding_box()
            page.mouse.click(box["x"] + box["width"] * 0.35, box["y"] + box["height"] * 0.6)
            page.wait_for_timeout(1400)
            home3 = page.inner_text("#gympage [data-gymhome]").replace("\n", " | ")
            check("내 집이 '지도에서 고른 곳'", "지도에서 고른 곳" in home3, home3)
            check("저장됨(localStorage)", page.evaluate("() => { const k=Object.keys(localStorage).filter(x=>x.indexOf('bm_home_base_v1')===0); return k.length===1 && JSON.parse(localStorage[k[0]]).label === '지도에서 고른 곳'; }"))
            check("반경 안 사람 다시 셈", len(rows(page)) >= 1, len(rows(page)))
            page.screenshot(path=SHOTS + "/map5km-home-pickmap.png")
            page.locator("#gympage [data-gym-close]").click()
            page.wait_for_timeout(600)

            check("콘솔·페이지 오류 0건", len(ERRORS) == 0, ERRORS[:5])

            step("I) Leaflet 을 못 불러오는 경우 — 핀 지도로도 원·사람이 보인다")
            ctx2 = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                                      locale="ko-KR", service_workers="block")
            route_external(ctx2)
            ctx2.route("**/js/vendor/leaflet/leaflet.js", lambda route: route.fulfill(status=200, content_type="application/javascript", body=""))
            page2 = ctx2.new_page()
            wire(page2)
            enter_guest(page2)
            open_map(page2)
            check("핀 지도(정적)", page2.evaluate("()=>document.querySelectorAll('#gympage .gymmap.is-static').length") == 1,
                  page2.evaluate("()=>document.querySelectorAll('#gympage .gymmap.is-live').length"))
            check("오프라인 반경 원", page2.locator("#gympage .gymring").count() == 1)
            check("오프라인 내 집 핀", page2.locator("#gympage .gymhome-pin.is-flat").count() == 1)
            check("오프라인 사람 아이콘 7개", page2.locator("#gympage .gymp.is-flat").count() == 7,
                  page2.locator("#gympage .gymp.is-flat").count())
            check("오프라인 파란 불 5개", page2.locator("#gympage .gymp.is-flat.is-lit").count() == 5,
                  page2.locator("#gympage .gymp.is-flat.is-lit").count())
            page2.evaluate("() => { const b=document.querySelector('#gympage .gympage__body'); const n=document.querySelector('#gympage [data-gymnear]'); if (b && n) b.scrollTop = n.offsetTop - 20; }")
            page2.wait_for_timeout(400)
            page2.screenshot(path=SHOTS + "/map5km-noleaflet.png")
            check("오프라인에서도 오류 0건", len(ERRORS) == 0, ERRORS[:5])
            browser.close()
    finally:
        httpd.shutdown()
    print("\n=== FAILS ===")
    print(json.dumps(FAILS, ensure_ascii=False, indent=1) if FAILS else "none")
    print("=== ERRORS ===")
    print(json.dumps(ERRORS, ensure_ascii=False, indent=1) if ERRORS else "none")
    sys.exit(1 if FAILS else 0)


if __name__ == "__main__":
    main()
