/* ============================================================
 * api.js — 데이터 통로
 * 같은 인터페이스를 가진 두 가지 구현:
 *   1) local  : 브라우저 저장소 (체험 모드, 인터넷 없이 즉시 동작)
 *   2) sheets : Google Apps Script 브리지 (실제 시트)
 * 앱의 나머지 코드는 어느 쪽인지 몰라도 됩니다.
 *
 * 모든 쓰기 요청에는 clientId가 붙습니다. 같은 clientId가 다시 오면
 * 브리지가 무시하므로, 손가락 연타·재시도로 인한 중복 행이 생기지 않습니다.
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};
  var U = BM.util, D = BM.domain;

  var ROWS_KEY = 'bm_rows_v1';
  var DEDUPE_KEY = 'bm_dedupe_v1';
  var SESSION_KEY = 'bm_session_v1';

  function ApiError(code, message, retryable) {
    this.name = 'ApiError';
    this.code = code || 'error';
    this.message = message || '요청을 처리하지 못했어요.';
    this.retryable = retryable !== false;
  }
  ApiError.prototype = Object.create(Error.prototype);

  /* =========================================================
   * 1) 체험 모드 (localStorage) — 시트와 같은 26칸 행 배열을 그대로 보관
   * ========================================================= */
  function createLocal(opts) {
    opts = opts || {};
    var latency = opts.latency == null ? 90 : opts.latency;
    /* rowsKey: 로그인 계정마다 데이터를 따로 보관할 때 씁니다 (체험 모드는 기본 키) */
    var rowsKey = opts.rowsKey || ROWS_KEY;
    var identity = opts.me || null;      /* {nick, level, discipline, region, club} */
    var rows = U.readJSON(rowsKey, null);
    var dedupe = U.readJSON(DEDUPE_KEY, {});
    var meKey = opts.meKey || U.readJSON('bm_me_v1', null) || BM.seed.ME;
    var listeners = [];

    function persist() {
      U.writeJSON(rowsKey, rows);
    }

    function ensure() {
      if (!rows || !rows.length) {
        rows = BM.seed.build();
        persist();
      }
      if (!rows.length) rows = BM.seed.build();
      return rows;
    }

    function meProfile() {
      var idx = D.index(rows.map(D.fromRow));
      var p = D.profileOf(idx, meKey);
      var base = identity || {};
      /* 로그인 사용자는 데모 기본값을 쓰지 않습니다(온보딩에서 본인이 고름) */
      var signed = !!identity;
      return {
        key: meKey,
        email: (identity && identity.email) || '',
        nick: p.nick || base.nick || (signed ? '회원' : '체험 사용자'),
        level: p.level || base.level || (signed ? '' : '일반회원'),
        discipline: p.discipline || base.discipline || (signed ? '' : '복식'),
        bio: p.bio || base.bio || '',
        region: base.region || '',
        club: base.club || '',
        theme: p.theme || { theme: 'th_night' }
      };
    }

    function delay(fn) {
      if (!latency) return Promise.resolve().then(fn);
      return new Promise(function (resolve, reject) {
        setTimeout(function () {
          try { resolve(fn()); } catch (e) { reject(e); }
        }, latency);
      });
    }

    function remember(id) {
      if (dedupe[id]) return false;
      dedupe[id] = Date.now();
      var keys = Object.keys(dedupe);
      if (keys.length > 400) {
        keys.sort(function (a, b) { return dedupe[a] - dedupe[b]; })
          .slice(0, 200).forEach(function (k) { delete dedupe[k]; });
      }
      U.writeJSON(DEDUPE_KEY, dedupe);
      return true;
    }

    return {
      mode: 'local',
      bootstrap: function () {
        ensure();
        return delay(function () {
          return { me: meProfile(), rows: rows.slice(), syncedAt: U.stamp() };
        });
      },
      login: function (cred) {
        return delay(function () { return { me: meProfile(), token: 'local' }; });
      },
      logout: function () { return Promise.resolve(); },
      append: function (row, clientId) {
        return delay(function () {
          ensure();
          if (clientId && !remember(clientId)) return { id: row[0], duplicate: true };
          var copy = row.slice();
          if (!copy[0]) copy[0] = U.uid();
          rows.push(copy);
          persist();
          return { id: copy[0] };
        });
      },
      update: function (id, cells, clientId) {
        return delay(function () {
          ensure();
          if (clientId && !remember(clientId)) return { duplicate: true };
          var hit = null;
          for (var i = 0; i < rows.length; i++) if (String(rows[i][0]) === String(id)) hit = rows[i];
          if (!hit) throw new ApiError('not_found', '해당 기록을 찾지 못했어요.', false);
          Object.keys(cells || {}).forEach(function (name) {
            var c = D.COL[name];
            if (c != null) hit[c] = String(cells[name]);
          });
          persist();
          return { id: id };
        });
      },
      remove: function (id, clientId) {
        return delay(function () {
          ensure();
          if (clientId && !remember(clientId)) return { duplicate: true };
          for (var i = rows.length - 1; i >= 0; i--) if (String(rows[i][0]) === String(id)) rows.splice(i, 1);
          persist();
          return { id: id };
        });
      },
      resetDemo: function () {
        rows = BM.seed.build();
        dedupe = {};
        persist();
        U.writeJSON(DEDUPE_KEY, {});
        return Promise.resolve({ ok: true });
      }
    };
  }

  /* =========================================================
   * 2) 실제 시트 모드 (Apps Script 브리지)
   * 브리지는 비밀번호 해시와 이메일을 절대 내려주지 않습니다.
   * ========================================================= */
  function createSheets(opts) {
    opts = opts || {};
    var url = (opts.url || '').trim();
    var token = opts.token || '';
    var timeout = opts.timeout || 12000;

    function request(payload) {
      if (!url) return Promise.reject(new ApiError('no_url', '브리지 주소가 설정되지 않았어요.', false));
      var body = JSON.stringify(payload);
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, timeout) : null;
      /* text/plain 으로 보내면 브라우저 사전요청(preflight)이 생기지 않습니다.
         Apps Script는 커스텀 헤더를 허용하지 않기 때문에 이 방법이 필요합니다. */
      return fetch(url, {
        method: 'POST',
        body: body,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        redirect: 'follow',
        signal: ctrl ? ctrl.signal : undefined
      }).then(function (res) {
        if (timer) clearTimeout(timer);
        return res.text();
      }).then(function (text) {
        var data;
        try { data = JSON.parse(text); }
        catch (e) { throw new ApiError('bad_response', '서버 응답을 이해하지 못했어요. 배포 주소를 확인해 주세요.', true); }
        if (!data || data.ok === false) {
          throw new ApiError((data && data.code) || 'server', (data && data.message) || '서버에서 처리하지 못했어요.', !!(data && data.retryable));
        }
        return data;
      }).catch(function (err) {
        if (timer) clearTimeout(timer);
        if (err instanceof ApiError) throw err;
        throw new ApiError('network', '네트워크에 연결하지 못했어요. 잠시 뒤 다시 시도할게요.', true);
      });
    }

    return {
      mode: 'sheets',
      token: token,
      bootstrap: function () {
        return request({ action: 'bootstrap', token: token }).then(function (data) {
          token = data.token || token;
          U.writeJSON(SESSION_KEY, { token: token, url: url });
          return { me: data.me, rows: data.rows, syncedAt: data.syncedAt, token: token };
        });
      },
      login: function (cred) {
        return request({
          action: 'login', email: cred.email, password: cred.password, nick: cred.nick, create: cred.create
        }).then(function (data) {
          token = data.token;
          U.writeJSON(SESSION_KEY, { token: token, url: url });
          return { me: data.me, token: token };
        });
      },
      /* 회원가입: 브리지가 이미 있는 계정이면 code:'exists'로 거절합니다 */
      register: function (cred) {
        return request({
          action: 'register', email: cred.email, password: cred.password, nick: cred.nick
        }).then(function (data) {
          token = data.token;
          U.writeJSON(SESSION_KEY, { token: token, url: url });
          return { me: data.me, token: token, created: !!data.created };
        });
      },
      logout: function () { return request({ action: 'logout', token: token }).catch(function () {}); },
      append: function (row, clientId) {
        return request({ action: 'append', token: token, row: row, clientId: clientId });
      },
      update: function (id, cells, clientId) {
        return request({ action: 'update', token: token, id: id, cells: cells, clientId: clientId });
      },
      remove: function (id, clientId) {
        return request({ action: 'remove', token: token, id: id, clientId: clientId });
      },
      resetDemo: function () { return Promise.resolve({ ok: false }); },
      /* 관리자: 예전 앱이 넣은 샘플 글을 시트에서 실제로 지웁니다 */
      purgeSamples: function () {
        return request({ action: 'purge_samples', token: token });
      }
    };
  }

  function savedSession() { return U.readJSON(SESSION_KEY, null); }

  BM.api = {
    createLocal: createLocal, createSheets: createSheets,
    ApiError: ApiError, savedSession: savedSession,
    SESSION_KEY: SESSION_KEY, ROWS_KEY: ROWS_KEY
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
