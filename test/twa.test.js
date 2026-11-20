/* ============================================================
 * test/twa.test.js — TWA(Bubblewrap) 설정이 웹 앱과 어긋나지 않는지
 *  1) 실행 바탕·테마·내비 색이 manifest.webmanifest의 색과 같다
 *  2) 버전·주소·아이콘이 지금 앱(버전·호스팅 경로·실제 파일)과 맞는다
 * 실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes;

  function hasNode() {
    try { return typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string'; }
    catch (e) { return false; }
  }
  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }
  function fileExists(rel) {
    var fs = require('fs'), path = require('path');
    return fs.existsSync(path.join(root.__REPO_ROOT__, rel));
  }
  function lower(v) { return String(v).toLowerCase(); }

  /* 배포 주소(csw42060713-byte.github.io/badminton/)를 저장소 안 경로로 바꿉니다 */
  function localPath(url, prefix) {
    return url.indexOf(prefix) === 0 ? url.slice(prefix.length) : '';
  }

  test('TWA 색: 실행 바탕·테마·내비 색이 웹 매니페스트와 같다', function () {
    if (!hasNode()) return;
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    var web = JSON.parse(readRoot('manifest.webmanifest'));
    var theme = lower(web.theme_color);
    var bg = lower(web.background_color);
    eq(lower(twa.themeColor), theme, 'twa themeColor = manifest theme_color');
    eq(lower(twa.navigationColor), theme, 'twa navigationColor = manifest theme_color');
    eq(lower(twa.backgroundColor), bg, 'twa backgroundColor = manifest background_color');
    /* 어두운 모드 값은 나이트 테마 바탕(--bg @ :root)과 같아야 한다 */
    eq(lower(twa.themeColorDark), '#080b0a', 'themeColorDark = 나이트 테마 바탕');
    eq(lower(twa.navigationColorDark), '#080b0a', 'navigationColorDark = 나이트 테마 바탕');
  });

  test('TWA 설정: 버전이 앱 버전과 맞고 주소·아이콘 파일이 실제로 있다', function () {
    if (!hasNode()) return;
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    var app = readRoot('app.js');
    var m = app.match(/version:\s*'(v[\d.]+)'/);
    ok(m, 'app.js 버전 표기');
    var appVersion = m[1].replace(/^v/, '');
    eq(twa.appVersionName, appVersion, 'appVersionName = app.js version');
    eq(twa.appVersion, appVersion, 'appVersion = app.js version');
    ok(twa.appVersionCode >= 2, 'appVersionCode는 2 이상 (업로드마다 +1)');

    var prefix = 'https://' + twa.host + '/badminton/';
    ok(twa.startUrl.indexOf('/badminton/') === 0, 'startUrl은 /badminton/ 아래');
    eq(localPath(twa.webManifestUrl, prefix), 'manifest.webmanifest', 'webManifestUrl 경로');
    eq(localPath(twa.iconUrl, prefix), 'store-assets/icon-512.png', 'iconUrl 경로');
    eq(localPath(twa.maskableIconUrl, prefix), 'icons/icon-maskable-512.png', 'maskableIconUrl 경로');

    ['manifest.webmanifest', 'index.html', 'store-assets/icon-512.png', 'icons/icon-maskable-512.png']
      .forEach(function (f) { ok(fileExists(f), '저장소에 있는 파일: ' + f); });

    var web = JSON.parse(readRoot('manifest.webmanifest'));
    var maskable = web.icons.filter(function (i) { return i.purpose === 'maskable'; });
    ok(maskable.length, '웹 매니페스트에도 maskable 아이콘');
    eq(maskable[0].src, 'icons/icon-maskable-512.png', 'maskable 아이콘 경로 일치');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
