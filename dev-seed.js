/* 개발용: 스토어 스크린샷을 찍기 위한 임시 페이지 스크립트 (배포 후 삭제) */
(function () {
  'use strict';
  var params = new URLSearchParams(location.search);
  var screen = params.get('screen') || 'ai';
  var scale = parseFloat(params.get('scale') || '1.5');
  var frame = document.getElementById('frame');
  var mark = document.getElementById('mark');

  frame.style.width = Math.round(360 * scale) + 'px';
  frame.style.height = Math.round(640 * scale) + 'px';

  var app = document.createElement('iframe');
  app.id = 'app';
  app.style.transform = 'scale(' + scale + ')';
  frame.appendChild(app);

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function fail(msg) { mark.textContent = 'ERROR ' + msg; }

  (async function () {
    try {
      var session = {
        kind: 'email', email: 'narae@example.com', name: '나래', token: '', source: 'local',
        at: '2026-11-18 20:00:00', onboardedAt: '2026-11-01 09:00:00',
        profile: { nick: '나래', level: 'C조', discipline: '복식', region: '경기', club: '나래울', onboardedAt: '2026-11-01 09:00:00' }
      };
      localStorage.setItem('bm_auth_v1', JSON.stringify(session));
      localStorage.setItem('bm_seen_v1', 'true');

      var tmp = document.createElement('iframe');
      tmp.src = './index.html';
      tmp.style.cssText = 'position:absolute;left:-9999px;top:0;width:360px;height:640px;border:0';
      document.body.appendChild(tmp);
      await new Promise(function (res) { tmp.onload = res; });
      await wait(700);
      var w = tmp.contentWindow;
      await new Promise(function (res, rej) {
        var s = w.document.createElement('script');
        s.src = './dev-fixtures.js';
        s.onload = res;
        s.onerror = function () { rej(new Error('fixtures')); };
        w.document.head.appendChild(s);
      });
      var BM = w.BM;
      if (!BM || !BM.fixtures) throw new Error('no BM');
      var me = BM.auth.meKeyFor(BM.auth.session());
      var rowsKey = BM.auth.rowsKeyFor(BM.auth.session());
      var col = BM.domain.COL;
      var rows = BM.fixtures.demo().map(function (r) {
        var c = r.slice();
        ['사용자ID', '대상', '팀'].forEach(function (n) {
          var i = col[n];
          if (i != null && c[i] === 'demo_me') c[i] = me;
        });
        return c;
      });
      localStorage.setItem(rowsKey, JSON.stringify(rows));
      tmp.remove();

      var tab = (screen === 'matching' || screen === 'my') ? screen : 'log';
      app.src = './index.html#/' + tab;
      await new Promise(function (res) { app.onload = res; });
      await wait(1100);
      var win = app.contentWindow;
      var doc = win.document;

      if (screen === 'chat') {
        var hdr = doc.getElementById('hdrChat');
        if (hdr) hdr.click();
        await wait(800);
        var room = doc.querySelector('[data-thread]');
        if (room) { room.click(); await wait(900); }
        var dm = doc.getElementById('dm');
        if (dm) dm.scrollTop = dm.scrollHeight;
        await wait(400);
      }

      if (screen === 'ai') {
        var btn = doc.querySelector("[data-act='save-log']");
        if (btn) { btn.click(); await wait(1400); }
        var an = doc.querySelector('[data-region="analysis"]');
        if (an) { an.scrollIntoView({ block: 'start' }); }
        var main = doc.getElementById('main');
        if (an && main) main.scrollTop = an.offsetTop - 8;
        await wait(500);
      }

      if (screen === 'my' || screen === 'matching') {
        var m2 = doc.getElementById('main');
        if (m2) m2.scrollTop = 0;
        await wait(300);
      }

      mark.textContent = 'READY';
      document.title = 'READY';
    } catch (e) {
      fail((e && e.message) || 'unknown');
    }
  })();
})();
