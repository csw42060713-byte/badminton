/* ============================================================
 * test/v193.test.js — bm-v1.96.0
 *   🔧 '상대 라켓 구경' 시트에 체육관 지도 버튼 태그가 글자로 보이던 문제
 *
 *   1) 원인 — metaHtml(p) 는 등록된 체육관이면 이미 <button class="gymlink"> HTML 을
 *      돌려주는데, 시트 본문(peekBody)에서 U.esc 로 한 번 더 감싸
 *      &lt;button type="button" class="gymlink" ...&gt; 가 글자 그대로 노출됐습니다.
 *   2) 수정 — U.esc 감싸기를 벗겨 지역·주 체육관 줄이 원래처럼 그려집니다(js/views/matching.js).
 *   3) 보호 — 지역·체육관 '글자'는 metaHtml 안에서 그대로 이스케이프됩니다(주입 없음).
 *   4) 재발 방지 — js/ 전체에서 HTML 을 돌려주는 함수를 U.esc 로 감싼 곳이 없는지 검사.
 *   5) 버전 — sw · app · push · 스타일 캐시 · TWA · README · 테스트 목록
 *   실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var U = BM.util, D = BM.domain;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;

  var hasNode = false;
  try { hasNode = typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string'; } catch (e) { hasNode = false; }

  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }
  function readJson(file) { return JSON.parse(readRoot(file)); }

  var ME = {
    key: BM.seed.ME, nick: '나래', level: 'C조', discipline: '복식', bio: '소개',
    region: '경기', club: '나래울', theme: { theme: 'th_night', avatar: '🦋' }
  };

  function copyOf(o) { return JSON.parse(JSON.stringify(o)); }

  function stateOf(rows) {
    return {
      ready: true, mode: 'local', me: copyOf(ME), rows: rows || [],
      data: BM.store.derive(rows || [], BM.seed.ME),
      drafts: { log: { date: U.ymd(), cond: null } },
      ui: {
        tab: 'log', matchFilter: { level: '전체', region: '전체', discipline: '전체' },
        matchTab: 'find', matchStarted: false, matchSort: 'score',
        chatRoom: null, chatOther: '', chatDraft: '', coachTab: '', coachPlayer: null,
        composer: '', composerTopic: '자유', lastSavedLog: null
      },
      analysis: null, queue: [], locks: {}, syncState: 'idle', syncError: null, lastSync: '',
      stats: { writes: 0, blocked: 0, failed: 0 }
    };
  }

  function peerRows(profile) {
    return [Object.assign({
      type: '프로필', id: 'p_fr', clientId: 'p_fr', createdAt: '2026-11-26 09:00:00',
      userKey: 'u_fr', nick: '하늘', level: 'B조', region: '경기', discipline: '복식'
    }, profile || {})];
  }

  function peekOf(patch) {
    var st = stateOf(peerRows(patch));
    var p = D.profileOf(st.data.idx, 'u_fr');
    return { st: st, p: p, html: BM.views.matching._peekBody(st, p) };
  }

  /* ============================================================
   * 1. 구경 시트 — 체육관 지도 버튼이 '버튼'으로 그려진다
   * ============================================================ */

  test('v1.93 구경: 주 체육관이 등록 체육관이면 지역·체육관 줄에 지도 버튼이 태그가 아닌 버튼으로 그려진다', function () {
    var g = peekOf({ club: '나래울' });
    eq(g.p.club, '나래울', '구경 대상 주 체육관');
    includes(g.html, 'class="peek__meta"', '지역·체육관 줄');
    includes(g.html, 'class="gymlink"', '지도 버튼 클래스');
    includes(g.html, 'data-gym-open=', '지도 열기 핸들');
    includes(g.html, '나래울 배드민턴장', '체육관 이름');
    excludes(g.html, '&lt;button', '태그가 글자로 새지 않는다');
    excludes(g.html, '&amp;lt;', '두 번 이스케이프되지 않는다');
    includes(g.html, '경기', '지역 글자');
  });

  test('v1.93 구경: 체육관이 등록 목록과 안 이어지면 지역·이름이 글자로만 남는다', function () {
    var g = peekOf({ club: '동네 체육관' });
    includes(g.html, '동네 체육관', '이름 그대로');
    excludes(g.html, 'class="gymlink"', '지도 버튼 없음');
    excludes(g.html, '&lt;', '이스케이프된 태그 없음');
  });

  test('v1.93 구경: 체육관·지역을 비우면 이전처럼 지역 미입력 한 줄', function () {
    var g = peekOf({ club: '', region: '' });
    includes(g.html, '지역 미입력', '빈 값 안내');
    excludes(g.html, 'class="gymlink"', '지도 버튼 없음');
  });

  /* ============================================================
   * 2. 보호 — 글자는 그대로 이스케이프 (U.esc 를 벗겨도 주입 없음)
   * ============================================================ */

  test('v1.93 보호: 지역·체육관 글자는 metaHtml 안에서 이스케이프된다', function () {
    var g = peekOf({ club: '<img src=x onerror="alert(1)">', region: '<b>경기</b>' });
    excludes(g.html, '<img src=x', '체육관 이름으로 태그가 살아나지 않는다');
    excludes(g.html, '<b>경기</b>', '지역으로 태그가 살아나지 않는다');
    includes(g.html, '&lt;b&gt;경기&lt;/b&gt;', '지역은 글자로 이스케이프');
    includes(g.html, '&lt;img src=x', '체육관 이름도 글자로 이스케이프');
  });

  /* ============================================================
   * 3. 재발 방지 — HTML 반환 함수를 U.esc 로 감싼 곳이 js/ 전체에 없다
   * ============================================================ */

  function escArgOf(src, start) {
    /* U.esc( ... ) 의 인자만 뽑는다(괄호 균형) */
    var i = start, depth = 1, j = i;
    while (j < src.length && depth > 0) {
      var c = src.charAt(j);
      if (c === '(') depth += 1;
      else if (c === ')') depth -= 1;
      j += 1;
    }
    return src.slice(i, j - 1);
  }

  function badEscapes(src) {
    var out = [];
    var re = /U\.esc\s*\(/g, m;
    while ((m = re.exec(src))) {
      var arg = escArgOf(src, re.lastIndex);
      /* ① 인자 안에서 HTML 문자열(<태그>)을 감싸는 경우 ② *Html( ) 호출을 감싸는 경우 */
      if (/<[a-zA-Z/!]/.test(arg) || /\b[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*[Hh]tml\s*\(/.test(arg)) {
        out.push({ at: m.index, arg: arg.replace(/\s+/g, ' ').slice(0, 80) });
      }
    }
    return out;
  }

  test('v1.93 재발 방지: js/ 어디에도 HTML 을 돌려주는 값을 U.esc 로 감싼 곳이 없다', function () {
    if (!hasNode) return;
    var fs = require('fs'), path = require('path');
    var dir = path.join(root.__REPO_ROOT__, 'js');
    var files = [];
    (function walk(d) {
      fs.readdirSync(d).forEach(function (name) {
        var p = path.join(d, name);
        if (fs.statSync(p).isDirectory()) walk(p);
        else if (/\.js$/.test(name)) files.push(p);
      });
    })(dir);
    files.push(path.join(root.__REPO_ROOT__, 'app.js'));
    var bad = [];
    files.forEach(function (f) {
      badEscapes(fs.readFileSync(f, 'utf8')).forEach(function (b) {
        bad.push(path.relative(root.__REPO_ROOT__, f) + ' · ' + b.arg);
      });
    });
    eq(bad.length, 0, '이중 이스케이프 없음' + (bad.length ? ': ' + bad.join(' / ') : ''));

    var matching = readRoot('js/views/matching.js');
    excludes(matching, 'U.esc((metaHtml(p)', '구경 시트의 이중 이스케이프 제거');
    includes(matching, "'<p class=\"peek__meta\">' + (metaHtml(p) || '지역 미입력') + '</p>'", '원래대로 그리는 줄');
  });

  /* ============================================================
   * 4. 버전
   * ============================================================ */

  test('v1.93 버전: sw · app · push · 스타일 캐시 · TWA · README · 테스트 목록', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.98.0'", 'sw 버전');
    includes(readRoot('app.js'), "version: 'v1.98.0'", 'app 버전');
    includes(readRoot('js/push.js'), "version: 'v1.98.0'", 'push 버전');
    includes(readRoot('index.html'), 'styles.css?v=20261128-4', '스타일 캐시 키(이번엔 CSS 무변경)');
    var twa = readJson('twa-manifest.json');
    eq(twa.appVersionName, '1.98.0', 'TWA 이름');
    eq(twa.appVersion, '1.98.0', 'TWA appVersion');
    eq(twa.appVersionCode, 92, 'TWA 코드');
    includes(readRoot('README.md'), 'bm-v1.98.0', 'README 변경 이력');
    includes(readRoot('test/run.js'), 'test/v193.test.js', '테스트 목록');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
