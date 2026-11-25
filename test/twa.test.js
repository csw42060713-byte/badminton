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
  test('자산 링크: assetlinks.json이 유효한 JSON이고 패키지·지문이 TWA 설정과 같다', function () {
    if (!hasNode()) return;
    var links = JSON.parse(readRoot('.well-known/assetlinks.json'));
    ok(Array.isArray(links) && links.length === 1, 'assetlinks.json은 문장 1개짜리 배열');
    var st = links[0];
    ok(st.relation && st.relation.indexOf('delegate_permission/common.handle_all_urls') >= 0, 'handle_all_urls 관계');
    eq(st.target.namespace, 'android_app', 'namespace = android_app');

    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(st.target.package_name, twa.packageId, 'package_name = twa packageId');

    var fps = st.target.sha256_cert_fingerprints || [];
    ok(fps.length >= 1, 'SHA-256 지문이 최소 1개');
    fps.forEach(function (fp) {
      ok(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(fp), 'SHA-256 지문 형식(콜론 포함 32쌍)');
      ok(fp.indexOf('REPLACE_WITH') < 0, '지문 자리에 임시 문구가 없다');
      ok(twa.fingerprints.indexOf(fp) >= 0, 'twa-manifest fingerprints에도 같은 지문');
    });
    /* 업로드 키 지문이 실제로 들어가 있어야 앱이 주소창 없이 뜬다 */
    ok(fps.indexOf('EB:05:FE:F5:CC:EB:A6:25:9E:8A:DC:39:12:DA:87:1C:C2:20:29:C3:BA:5A:DF:F3:48:09:E8:8F:E6:5E:0F:D0') >= 0, '업로드 키 지문 등록됨');
  });

  test('서명 키: 키스토어가 저장소에 없고 .gitignore가 키 파일을 막는다', function () {
    if (!hasNode()) return;
    ok(!fileExists('android.keystore'), '저장소에 android.keystore 없음');
    ok(!fileExists('shuttlix-upload.keystore'), '저장소에 업로드 키스토어 없음');
    var ignore = readRoot('.gitignore');
    ['*.keystore', '*.jks'].forEach(function (p) { ok(ignore.indexOf(p) >= 0, '.gitignore에 ' + p); });
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
