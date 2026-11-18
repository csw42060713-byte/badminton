/* ============================================================
 * test/account.test.js — 계정 삭제(회원 탈퇴) 검증
 *   1) 앱 쪽: 로컬/시트 모드의 deleteAccount, 저장소 상태, MY·시작화면
 *   2) 브리지 쪽: APPS_SCRIPT_BRIDGE.gs를 가짜 Google 환경에서 그대로 실행해
 *      deleteAccount가 "본인 토큰 + 본인 행만" 지우는지 확인합니다.
 * 실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var U = BM.util, D = BM.domain;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;

  var hasNode = typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string';
  var fs = hasNode ? require('fs') : null;
  var path = hasNode ? require('path') : null;
  var vm = hasNode ? require('vm') : null;
  var crypto = hasNode ? require('crypto') : null;
  var ROOT = hasNode ? root.__REPO_ROOT__ : '';

  /* ---------- 도우미 ---------- */
  function readRepo(rel) {
    return fs.readFileSync(path.join(ROOT, rel), 'utf8');
  }

  function clearRows() { U.storage.removeItem('bm_rows_v1'); }

  function newStore() {
    U.storage.removeItem('bm_queue_v1');
    clearRows();
    U.writeJSON('bm_rows_v1', BM.fixtures.demo());
    var store = BM.store.createStore({ api: BM.api.createLocal({ latency: 0 }) });
    return store.actions.init().then(function () { return store; });
  }

  /* =========================================================
   * 1. 앱 쪽
   * ========================================================= */
  test('탈퇴(기기 모드): 내 기록이 모두 지워진다', function () {
    clearRows();
    U.writeJSON('bm_rows_v1', BM.fixtures.demo());
    var api = BM.api.createLocal({ latency: 0 });
    return api.deleteAccount().then(function (res) {
      eq(res.ok, true, '결과');
      var left = U.readJSON('bm_rows_v1', null);
      ok(Array.isArray(left) && left.length === 0, '남은 행: ' + (left && left.length));
    });
  });

  test('탈퇴(시트 모드): action=deleteAccount + 본인 토큰만 보낸다', function () {
    var calls = [];
    var saved = root.fetch;
    root.fetch = function (url, opts) {
      calls.push({ url: url, body: JSON.parse(opts.body), headers: opts.headers });
      return Promise.resolve({
        text: function () { return Promise.resolve(JSON.stringify({ ok: true, removed: 4 })); }
      });
    };
    var api = BM.api.createSheets({ url: 'https://script.google.com/macros/s/x/exec', token: 'tok-a' });
    return api.deleteAccount().then(function (res) {
      root.fetch = saved;
      eq(calls.length, 1, '요청 1건');
      eq(calls[0].body.action, 'deleteAccount', 'action');
      eq(calls[0].body.token, 'tok-a', '토큰');
      excludes(calls[0].body.email, '@', '이메일을 따로 보내지 않음');
      eq(res.removed, 4, '지운 행 수');
    }).catch(function (e) { root.fetch = saved; throw e; });
  });

  test('탈퇴(시트 모드): 실패하면 오류를 그대로 돌려주고 아무것도 지우지 않는다', function () {
    var saved = root.fetch;
    root.fetch = function () {
      return Promise.resolve({
        text: function () {
          return Promise.resolve(JSON.stringify({ ok: false, code: 'unauthorized', message: '로그인이 필요합니다.' }));
        }
      });
    };
    var store = BM.store.createStore({
      api: BM.api.createSheets({ url: 'https://x/y', token: 'tok-expired' })
    });
    return store.actions.deleteAccount().then(function () {
      throw new Error('실패해야 합니다');
    }, function (err) {
      root.fetch = saved;
      eq(err.code, 'unauthorized', '오류 코드');
      eq(store.state.rows.length, 0, '화면 행은 그대로(초기 상태)');
    }).catch(function (e) { root.fetch = saved; throw e; });
  });

  test('탈퇴: 저장소가 비고 화면도 빈 상태로 바뀐다', function () {
    return newStore().then(function (store) {
      ok(store.state.rows.length > 0, '처음엔 기록이 있다');
      return store.actions.deleteAccount().then(function (res) {
        eq(res.ok, true, '결과');
        eq(store.state.rows.length, 0, '행 0개');
        eq((store.state.data.posts || []).length, 0, '커뮤니티 글 0개');
        eq((store.state.data.records || []).length, 0, '기록 0개');
        eq((U.readJSON('bm_queue_v1', []) || []).length, 0, '대기 중인 저장 0건');
      });
    });
  });

  test('MY 화면: 개인정보처리방침 링크 + 회원 탈퇴 버튼이 있다', function () {
    BM.auth.signInEmailAccount({ email: 'test@example.com', name: '테스터', source: 'local' });
    return newStore().then(function (store) {
      var html = BM.views.my.render(store.state);
      includes(html, 'data-region="legal"', '개인정보·계정 카드');
      includes(html, 'href="privacy.html"', '개인정보처리방침 링크');
      includes(html, 'data-act="delete-account"', '탈퇴 버튼');
      includes(html, '회원 탈퇴', '버튼 이름');
      BM.auth.signOut();
    }).catch(function (e) { BM.auth.signOut(); throw e; });
  });

  test('MY 화면: 체험 모드에서는 탈퇴 버튼 대신 기기 기록 안내를 보여 준다', function () {
    BM.auth.signOut();
    return newStore().then(function (store) {
      var html = BM.views.my.render(store.state);
      includes(html, 'href="privacy.html"', '링크는 항상');
      excludes(html, 'data-act="delete-account"', '체험 모드에는 탈퇴 버튼 없음');
      includes(html, '이 기기에만', '기기 저장 안내');
    });
  });

  test('시작화면: 개인정보처리방침 링크가 있다', function () {
    BM.auth.signOut();
    BM.views.start.reset();
    var html = BM.views.start.render();
    includes(html, 'href="privacy.html"', '링크');
    includes(html, '개인정보처리방침', '문구');
  });

  /* =========================================================
   * 2. 브리지 (APPS_SCRIPT_BRIDGE.gs 실제 실행)
   * ========================================================= */
  /* Google Apps Script의 최소 흉내: 시트(26칸 2차원 배열) · 속성 · 캐시 · 잠금 */
  function makeGAS(scriptProps) {
    var props = scriptProps || {};
    var cacheStore = {};
    var grid = [['ID']];
    for (var i = 1; i < 26; i++) grid[0].push('H' + i);

    function pad(cells) {
      var out = [];
      for (var i = 0; i < 26; i++) out.push(cells && cells[i] !== undefined && cells[i] !== null ? String(cells[i]) : '');
      return out;
    }

    function range(row, col, numRows, numCols) {
      numRows = numRows || 1; numCols = numCols || 1;
      return {
        getValues: function () {
          var out = [];
          for (var r = 0; r < numRows; r++) {
            var src = grid[row - 1 + r] || [];
            var line = [];
            for (var c = 0; c < numCols; c++) line.push(src[col - 1 + c] === undefined ? '' : src[col - 1 + c]);
            out.push(line);
          }
          return out;
        },
        setValues: function (vals) {
          (vals || []).forEach(function (line, r) {
            while (grid.length < row + r) grid.push(pad([]));
            for (var c = 0; c < line.length; c++) {
              grid[row - 1 + r][col - 1 + c] = line[c] === null || line[c] === undefined ? '' : String(line[c]);
            }
          });
          return this;
        },
        setValue: function (v) { return this.setValues([[v]]); },
        setNumberFormat: function () { return this; }
      };
    }

    var sheet = {
      getLastRow: function () { return grid.length; },
      appendRow: function (cells) { grid.push(pad(cells)); },
      getRange: range
    };

    var sandbox = {
      console: console,
      Date: Date, Math: Math, JSON: JSON, Error: Error, Promise: Promise,
      String: String, Number: Number, Object: Object, Array: Array, RegExp: RegExp, isNaN: isNaN,
      PropertiesService: {
        getScriptProperties: function () {
          return {
            getProperty: function (k) { return props[k] === undefined ? null : String(props[k]); },
            setProperty: function (k, v) { props[k] = String(v); }
          };
        }
      },
      SpreadsheetApp: {
        openById: function () {
          return { getSheetByName: function (name) { return name === '출력결과' ? sheet : null; } };
        },
        getUi: function () { return { alert: function () {} }; }
      },
      Utilities: {
        DigestAlgorithm: { SHA_256: 'sha256' },
        Charset: { UTF_8: 'utf8' },
        formatDate: function (d, tz, fmt) {
          /* Asia/Seoul(+9) 고정 */
          var k = new Date(d.getTime() + 9 * 3600 * 1000);
          function p(n) { return (n < 10 ? '0' : '') + n; }
          var y = k.getUTCFullYear(), mo = p(k.getUTCMonth() + 1), da = p(k.getUTCDate());
          if (fmt === 'yyyy-MM-dd') return y + '-' + mo + '-' + da;
          return y + '-' + mo + '-' + da + ' ' + p(k.getUTCHours()) + ':' + p(k.getUTCMinutes()) + ':' + p(k.getUTCSeconds());
        },
        computeDigest: function (alg, text) {
          var h = crypto.createHash('sha256').update(String(text), 'utf8').digest();
          var out = [];
          for (var i = 0; i < h.length; i++) out.push(h[i] > 127 ? h[i] - 256 : h[i]);
          return out;
        },
        getUuid: function () { return crypto.randomUUID(); }
      },
      CacheService: {
        getScriptCache: function () {
          return {
            get: function (k) { return cacheStore[k] === undefined ? null : cacheStore[k]; },
            put: function (k, v) { cacheStore[k] = String(v); },
            remove: function (k) { delete cacheStore[k]; }
          };
        }
      },
      LockService: {
        getScriptLock: function () { return { waitLock: function () {}, releaseLock: function () {} }; }
      },
      Session: { getActiveUser: function () { return { getEmail: function () { return ''; } }; } },
      Logger: { log: function () {} }
    };
    sandbox.globalThis = sandbox;

    var context = vm.createContext(sandbox);
    vm.runInContext(readRepo('APPS_SCRIPT_BRIDGE.gs'), context, { filename: 'APPS_SCRIPT_BRIDGE.gs' });
    return { ctx: context, grid: grid, props: props, cache: cacheStore };
  }

  function register(env, email, password, nick) {
    var res = env.ctx.route_({ action: 'register', email: email, password: password, nick: nick });
    ok(res && res.ok, '가입 실패: ' + email + ' ' + ((res && res.message) || ''));
    return res.token;
  }

  function blankRow() {
    var cells = [];
    for (var i = 0; i < 26; i++) cells.push('');
    return cells;
  }

  function addRecord(env, token, text) {
    var cells = blankRow();
    cells[env.ctx.COL['유형']] = '기록';
    cells[env.ctx.COL['훈련계획']] = text;
    return env.ctx.route_({ action: 'append', token: token, row: cells });
  }

  function addFriendRequest(env, token, target) {
    var cells = blankRow();
    cells[env.ctx.COL['유형']] = '친구요청';
    cells[env.ctx.COL['대상']] = target;
    return env.ctx.route_({ action: 'append', token: token, row: cells });
  }

  function liveRows(env) {
    return env.grid.slice(1).filter(function (r) {
      return r[0] && r[env.ctx.COL['유형']] !== '삭제';
    });
  }

  test('브리지: AUTH_SECRET 속성이 있으면 CONFIG.SECRET보다 우선한다', function () {
    if (!hasNode) return;
    var withProp = makeGAS({ AUTH_SECRET: 'server-only-secret-abc' });
    eq(withProp.ctx.CONFIG.SECRET, 'server-only-secret-abc', '속성 값 사용');
    var without = makeGAS({});
    eq(without.ctx.CONFIG.SECRET, 'CHANGE_ME_badminton_bridge_secret_2026', '속성이 없을 때 기본값');
  });

  test('브리지: 계정 삭제는 본인 토큰이 필요하다', function () {
    if (!hasNode) return;
    var env = makeGAS({ AUTH_SECRET: 's' });
    var tok = register(env, 'a@example.com', 'pw123456', '에이');
    ok(addRecord(env, tok, 'A의 일지').ok, '일지 저장');

    var noToken = env.ctx.route_({ action: 'deleteAccount' });
    eq(noToken.ok, false, '토큰 없음');
    eq(noToken.code, 'unauthorized', '이유');

    var wrong = env.ctx.route_({ action: 'deleteAccount', token: 'made-up-token' });
    eq(wrong.ok, false, '가짜 토큰');
    eq(wrong.code, 'unauthorized', '이유');

    eq(liveRows(env).length, 2, '거절됐으니 아무것도 지워지지 않음(프로필+일지)');
  });

  test('브리지: 내 행만 지우고, 남의 기록은 그대로 둔다', function () {
    if (!hasNode) return;
    var env = makeGAS({ AUTH_SECRET: 's' });
    var tokA = register(env, 'a@example.com', 'pw123456', '에이');
    var tokB = register(env, 'b@example.com', 'pw123456', '비');
    ok(addRecord(env, tokA, 'A의 일지').ok, 'A 일지');
    ok(addRecord(env, tokB, 'B의 일지').ok, 'B 일지');
    ok(addFriendRequest(env, tokB, 'a@example.com').ok, 'B → A 친구요청');

    var res = env.ctx.route_({ action: 'deleteAccount', token: tokA });
    eq(res.ok, true, '삭제 성공');
    eq(res.removed, 3, 'A의 프로필·일지 + A를 가리키는 친구요청');

    var text = liveRows(env).map(function (r) { return r.join('|'); }).join('\n');
    excludes(text, 'a@example.com', 'A의 계정 흔적');
    excludes(text, 'A의 일지', 'A의 일지');
    includes(text, 'b@example.com', 'B 계정 보존');
    includes(text, 'B의 일지', 'B 일지 보존');

    /* 이미 지운 행은 유형이 '삭제'로 바뀌고 ID는 남습니다(행 번호 유지) */
    var deleted = env.grid.slice(1).filter(function (r) { return r[env.ctx.COL['유형']] === '삭제'; });
    eq(deleted.length, 3, '삭제 표시 행');
    deleted.forEach(function (r) { ok(!!r[0], '삭제 행도 ID 유지: ' + r[0]); });
  });

  test('브리지: 삭제한 계정의 세션은 즉시 끊긴다', function () {
    if (!hasNode) return;
    var env = makeGAS({ AUTH_SECRET: 's' });
    var tokA = register(env, 'a@example.com', 'pw123456', '에이');
    var tokB = register(env, 'b@example.com', 'pw123456', '비');

    eq(env.ctx.route_({ action: 'deleteAccount', token: tokA }).ok, true, '삭제');
    var after = env.ctx.route_({ action: 'bootstrap', token: tokA });
    eq(after.ok, false, 'A 세션 종료');
    eq(after.code, 'unauthorized', '이유');

    var other = env.ctx.route_({ action: 'bootstrap', token: tokB });
    eq(other.ok, true, 'B 세션은 유지');
  });

  test('브리지: 삭제한 계정은 다시 로그인되지 않는다', function () {
    if (!hasNode) return;
    var env = makeGAS({ AUTH_SECRET: 's' });
    var tokA = register(env, 'a@example.com', 'pw123456', '에이');
    env.ctx.route_({ action: 'deleteAccount', token: tokA });
    var again = env.ctx.route_({ action: 'login', email: 'a@example.com', password: 'pw123456', create: false });
    eq(again.ok, false, '계정 없음');
    eq(again.code, 'no_user', '이유');
  });

  /* =========================================================
   * 3. 스토어 제출 서류(정적 검사)
   * ========================================================= */
  test('개인정보처리방침: 수집 항목·목적·파기·문의처가 모두 있다', function () {
    if (!hasNode) return;
    var html = readRepo('privacy.html');
    ok(html.length > 3000, '페이지 분량');
    ['이메일 주소', '닉네임', '급수', '성별', '훈련 일지', '채팅', '매칭', '멘토',
      '수집하는 정보', '이용 목적', '보관 기간과 파기', '제3자 제공',
      'csw42060713@gmail.com', 'csw42060713@gmail.com'.replace('csw', 'csw'),
      '회원 탈퇴', '만 14세', '시행일'].forEach(function (word) {
      includes(html, word, '필수 문구: ' + word);
    });
    includes(html, 'mailto:csw42060713@gmail.com', '문의 메일 링크');
    includes(html, 'href="./index.html"', '앱으로 돌아가기');
  });

  test('index.html: 개인정보처리방침을 열 수 있는 링크가 있다', function () {
    if (!hasNode) return;
    includes(readRepo('index.html'), 'privacy.html', '링크');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
