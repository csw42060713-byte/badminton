"""구간·다인 테스트 영상 만들기 — 실제 배드민턴 사진 3장면을 12초로 이어 붙임

· 0~4초  : cand2.jpg 전체  → 선수(오른쪽)·심판(왼쪽) 두 사람이 잡히는 장면
· 4~8초  : cand2.jpg 확대  → 선수 한 명만 크게 (한 명짜리 구간)
· 8~12초 : cand4.jpg 전체  → 다른 자세의 선수 한 명
· MediaRecorder(webm)로 12초 기록 → 앱에서 3구간(4초씩)으로 나뉨
· 결과: /workspace/work/pose-test/pose-duo.webm
실행: (python3 -m http.server 8899 --bind 127.0.0.1 --directory /workspace &) ; python3 test/make-duo-video.py
"""
import base64
import pathlib

from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:8899/work/pose-test/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = pathlib.Path('/workspace/work/pose-test/pose-duo.webm')
W, H = 720, 540

HTML = """<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;background:#08100e}canvas{display:block}</style>
<canvas id="c" width="720" height="480"></canvas>
<script>
window.ready = (async () => {
  const load = (src) => new Promise((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src;
  });
  window.FULL = await load('cand2.jpg');    // 선수 + 심판 두 사람
  window.ONE1 = await load('crop-a.jpg');   // 서 있는 선수 한 명
  window.ONE2 = await load('crop-b.jpg');   // 다른 자세의 선수 한 명
  return [FULL.width, FULL.height];
})();
/* 비율을 지키며 화면 안에 다 넣기(레터박스) + 살짝 확대/이동 */
function contain(g, img, zoom, dx, dy) {
  const s = Math.min(720 / img.width, 480 / img.height) * zoom;
  const w = img.width * s, h = img.height * s;
  g.drawImage(img, (720 - w) / 2 + dx, (480 - h) / 2 + dy, w, h);
}
window.record = (secs) => new Promise((resolve) => {
  const c = document.getElementById('c');
  const g = c.getContext('2d');
  const stream = c.captureStream(25);
  const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 3000000 });
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  rec.onstop = async () => {
    const blob = new Blob(chunks, { type: 'video/webm' });
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
    resolve(btoa(s));
  };
  const t0 = performance.now();
  const total = secs * 1000;
  function draw(now) {
    const p = Math.min(1, (now - t0) / total);
    const scene = p < 0.34 ? 0 : p < 0.67 ? 1 : 2;
    const local = scene === 0 ? p / 0.34 : scene === 1 ? (p - 0.34) / 0.33 : (p - 0.67) / 0.33;
    g.fillStyle = '#0f2b21';
    g.fillRect(0, 0, 720, 480);
    if (scene === 0) {
      contain(g, FULL, 1 + 0.04 * local, 0, 0);                 // 두 사람
    } else if (scene === 1) {
      contain(g, FULL, 1.02, -18 + 36 * local, 0);              // 같은 두 사람, 조금 이동
    } else {
      contain(g, ONE2, 1 + 0.04 * local, 0, 0);                 // 한 사람
    }
    if (p < 1) requestAnimationFrame(draw); else rec.stop();
  }
  rec.start();
  requestAnimationFrame(draw);
});
</script>"""

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)
    ctx = b.new_context(viewport={'width': 760, 'height': 600})
    page = ctx.new_page()
    page.goto(BASE + 'blank.html', wait_until='domcontentloaded')
    page.set_content(HTML)
    print('images', page.evaluate('() => window.ready'))
    b64 = page.evaluate('() => window.record(12)')
    raw = base64.b64decode(b64)
    OUT.write_bytes(raw)
    print('saved', OUT, len(raw), 'bytes')
    b.close()
