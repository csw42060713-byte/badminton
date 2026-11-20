/* ============================================================
 * api.js — 데이터 통로
 * 같은 인터페이스를 가진 세 가지 구현:
 *   1) local    : 브라우저 저장소 (체험 모드, 인터넷 없이 즉시 동작)
 *   2) sheets   : Google Apps Script 브리지 (실제 시트)
 *   3) supabase : Supabase(서울) REST + Realtime — 기본 백엔드
 * 앱의 나머지 코드는 어느 쪽인지 몰라도 됩니다.
 *
 * 모든 쓰기 요청에는 clientId가 붙습니다. 같은 clientId가 다시 오면
 * 브리지가 무시하므로, 손가락 연타·재시도로 인한 중복 행이 생기지 않습니다.
 * (Supabase 모드는 행 ID가 기본 키라 같은 행을 다시 넣으면 409로 걸러집니다.)
 *
 * ⚠️ 앱에는 공개 키(anon / publishable)만 들어갑니다.
 *    service_role 키·DB 비밀번호는 절대 이 파일에 넣지 마세요.
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
  /* 예전 버전(v1.0)의 체험용 가상 인물·기록 정리.
   * 그때 커뮤니티에 자동으로 들어갔던 샘플 글이 남아 있는 기기만 대상으로 하므로,
   * 사용자가 직접 남긴 기록(demo_me)은 건드리지 않습니다. */
  function dropLegacyDemoRows(list) {
    if (!list || !list.length) return list;
    var seed = BM.seed || {};
    var legacy = false;
    list.forEach(function (r) {
      var type = String((r && r[D.COL['유형']]) || '');
      var text = (r && r[D.COL['소셜글']]) || '';
      if ((type === '소셜' || type === '답글') && seed.isSampleText && seed.isSampleText(text)) legacy = true;
    });
    if (!legacy) return list;
    var meKey = BM.seed ? BM.seed.ME : 'demo_me';
    return list.filter(function (r) {
      var key = String((r && r[D.COL['사용자ID']]) || '');
      return !(key.indexOf('demo_') === 0 && key !== meKey);
    });
  }

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

    /* 예전 데모 데이터가 남은 기기면 한 번 걷어 냅니다 */
    var cleaned = dropLegacyDemoRows(rows);
    if (cleaned !== rows) { rows = cleaned; persist(); }

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
        style: D.normalizeStyle((p.theme && p.theme.style) || ''),
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
      },
      /* 계정 삭제(탈퇴): 이 기기의 기록·중복 방지 기록을 모두 비웁니다 */
      deleteAccount: function () {
        return delay(function () {
          rows = [];
          dedupe = {};
          persist();
          U.writeJSON(DEDUPE_KEY, {});
          return { ok: true, mode: 'local', removed: 0 };
        });
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
      /* 계정 삭제(탈퇴): 브리지가 본인 세션 토큰을 확인하고 그 계정의 행만 지웁니다 */
      deleteAccount: function () {
        return request({ action: 'deleteAccount', token: token });
      },
      /* 관리자: 예전 앱이 넣은 샘플 글을 시트에서 실제로 지웁니다 */
      purgeSamples: function () {
        return request({ action: 'purge_samples', token: token });
      }
    };
  }

  /* =========================================================
   * 3) 실시간 서버 모드 (Supabase · REST + Realtime)
   *
   *  · 읽기/쓰기는 PostgREST(app_records 표)로 하고, 화면에는 시트와 같은
   *    26칸 행 배열로 넘깁니다. 그래서 store·화면 코드는 그대로입니다.
   *  · RLS 상 anon 키는 SELECT/INSERT 만 됩니다(수정·삭제 정책 없음).
   *    그래서 수정·삭제는 ① 먼저 진짜 UPDATE/DELETE 를 시도하고(로그인 연결 시),
   *    ② 0행이면 '수정/삭제 기록 행'을 덧붙이는 방식으로 처리합니다.
   *    덧붙인 행은 읽을 때 원래 행에 겹쳐 읽고 화면에는 보이지 않습니다
   *    (같은 user_key 의 행에만 적용 — 남의 기록을 건드릴 수 없습니다).
   *  · Realtime 은 postgres_changes 를 WebSocket 으로 구독해, 상대가 보낸
   *    채팅·매칭 요청을 1초 안에 화면에 반영합니다(끊기면 스스로 다시 붙습니다).
   * ========================================================= */
  var SB = {
    url: 'https://mwgpakntlollndfluwgg.supabase.co',
    publishableKey: 'sb_publishable_3-gL5uG6nJ9XreK9GdN_nw_Ck_jAqkr',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13Z3Bha250bG9sbG5kZmx1d2dnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUxNDkzOTQsImV4cCI6MjExMDcyNTM5NH0.D-6wZ4JRLlm98vwqePz-e_FJdBzlugzmgHZEaQAB-Og',
    table: 'app_records',
    pageSize: 1000
  };
  var BACKEND_KEY = 'bm_backend_v1';
  /* 앱이 고른 저장소 — supabase(기본) · sheets · local */
  var BACKENDS = ['supabase', 'sheets', 'local'];

  /* 시트 26칸 이름 → DB 컬럼 이름 (work/SUPABASE_INTEGRATION.md 의 매핑 그대로) */
  var DB_COL = {
    'ID': 'id', '유형': 'type', '작성일시': 'created_at', '날짜': 'date', '닉네임': 'nick',
    '실력': 'level', '주력종목': 'discipline', '훈련계획': 'plan', '컨디션': 'cond',
    '훈련강도': 'intensity', '운동시간(분)': 'minutes', '완료훈련': 'done', '게임점수': 'score',
    '승패': 'win', '아픈부위': 'pain', '맞춤처방': 'prescription', '약점기술': 'weakness',
    '추천드릴': 'drills', '좋아요': 'likes', '사용자ID': 'user_key', '대상': 'target',
    '팀': 'team', '자기소개': 'bio', '꾸미기': 'theme'
  };
  var JSON_COLS = { plan: 1, prescription: 1, drills: 1, theme: 1 };
  var NUM_COLS = { cond: 1, intensity: 1, minutes: 1, likes: 1 };
  /* 수정·삭제를 덧붙이는 행의 유형 (화면·도메인에는 절대 넘기지 않습니다) */
  var PATCH_TYPE = '수정';
  var DELETE_TYPE = '삭제';

  function pad2s(n) { return n < 10 ? '0' + n : '' + n; }

  /* timestamptz(UTC ISO) → 이 기기 시간대의 'YYYY-MM-DD HH:mm:ss'
   * 앱이 시각을 문자열로 비교·정렬하므로 시트와 같은 모양으로 맞춥니다. */
  function localStamp(iso) {
    if (!iso) return '';
    var s = String(iso).replace(/(\.\d{3})\d+/, '$1');   /* 소수점 6자리는 사파리가 못 읽습니다 */
    var d = new Date(s);
    if (!d || isNaN(d.getTime())) return String(iso).slice(0, 19).replace('T', ' ');
    return d.getFullYear() + '-' + pad2s(d.getMonth() + 1) + '-' + pad2s(d.getDate()) + ' ' +
      pad2s(d.getHours()) + ':' + pad2s(d.getMinutes()) + ':' + pad2s(d.getSeconds());
  }

  /* 'YYYY-MM-DD HH:mm:ss'(기기 시간) → UTC ISO (DB에 넣을 값) */
  function isoStamp(stamp) {
    var s = String(stamp == null ? '' : stamp).trim();
    if (!s) return null;
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
    var d = m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) : new Date(s);
    if (!d || isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  /* jsonb 값 → 26칸 칸 값(문자열). 문자열로 저장된 값은 따옴표 없이 그대로. */
  function jsonText(v) {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    try { return JSON.stringify(v); } catch (e) { return ''; }
  }

  /* 26칸 칸 값(문자열) → jsonb 값 */
  function jsonValue(text) {
    var t = String(text == null ? '' : text).trim();
    if (!t) return null;
    if (/^[\{\[]/.test(t) || /^".*"$/.test(t) || t === 'null' || t === 'true' || t === 'false' || /^-?\d+(\.\d+)?$/.test(t)) {
      try { return JSON.parse(t); } catch (e) { /* 아래에서 문자열로 */ }
    }
    return t;
  }

  /* DB 한 행 → 시트와 같은 26칸 배열 (화면이 읽는 모양) */
  function recordToRow(rec) {
    if (!rec || !D) return null;
    var c = [], i;
    for (i = 0; i < D.COLS.length; i++) c.push('');
    function put(name, v) {
      var idx = D.COL[name];
      if (idx == null || v == null || v === '') return;
      c[idx] = String(v);
    }
    put('ID', rec.id);
    put('유형', rec.type);
    put('작성일시', localStamp(rec.created_at));
    put('날짜', rec.date);
    if (!c[D.COL['날짜']]) c[D.COL['날짜']] = String(c[D.COL['작성일시']] || '').slice(0, 10);
    put('닉네임', rec.nick);
    put('실력', rec.level);
    put('주력종목', rec.discipline);
    put('훈련계획', jsonText(rec.plan));
    put('컨디션', rec.cond);
    put('훈련강도', rec.intensity);
    put('운동시간(분)', rec.minutes);
    put('완료훈련', rec.done);
    put('게임점수', rec.score);
    put('승패', rec.win);
    put('아픈부위', rec.pain);
    put('맞춤처방', jsonText(rec.prescription));
    put('약점기술', rec.weakness);
    put('추천드릴', jsonText(rec.drills));
    put('소셜글', rec.payload != null ? jsonText(rec.payload) : rec.note);
    put('좋아요', rec.likes == null ? '' : rec.likes);
    put('사용자ID', rec.user_key);
    put('대상', rec.target);
    put('팀', rec.team);
    put('자기소개', rec.bio);
    put('꾸미기', jsonText(rec.theme));
    return c;
  }

  /* 26칸 배열 → DB에 넣을 행 (빈 칸은 null 로) */
  function rowToRecord(row) {
    var c = D.asCells(row);
    var rec = {};
    Object.keys(DB_COL).forEach(function (name) {
      var idx = D.COL[name];
      if (idx == null) return;
      var col = DB_COL[name];
      var raw = c[idx];
      if (raw == null || raw === '') return;
      if (name === '작성일시') {
        var iso = isoStamp(raw);
        if (iso) rec.created_at = iso;
        return;
      }
      if (NUM_COLS[col]) {
        var n = parseFloat(String(raw).replace(/[^0-9.\-]/g, ''));
        if (isFinite(n)) rec[col] = n;
        return;
      }
      if (JSON_COLS[col]) { rec[col] = jsonValue(raw); return; }
      rec[col] = raw;
    });
    /* 소셜글: 구조화 글(JSON)이면 payload, 평문이면 note */
    var social = c[D.COL['소셜글']];
    if (social != null && social !== '') {
      if (/^\s*[\{\[]/.test(String(social))) rec.payload = jsonValue(social);
      else rec.note = String(social);
    }
    return rec;
  }

  /* 수정 요청(칸 이름 → 값)을 DB 컬럼 값으로 */
  function cellsToPatch(cells) {
    var patch = {};
    Object.keys(cells || {}).forEach(function (name) {
      var text = cells[name] == null ? '' : String(cells[name]);
      if (name === '소셜글') {
        if (!text) { patch.note = null; patch.payload = null; }
        else if (/^\s*[\{\[]/.test(text)) { patch.payload = jsonValue(text); patch.note = null; }
        else { patch.note = text; patch.payload = null; }
        return;
      }
      var col = DB_COL[name];
      if (!col) return;
      if (name === '작성일시') { patch.created_at = isoStamp(text); return; }
      if (!text) { patch[col] = null; return; }
      if (NUM_COLS[col]) {
        var n = parseFloat(text.replace(/[^0-9.\-]/g, ''));
        patch[col] = isFinite(n) ? n : null;
        return;
      }
      patch[col] = JSON_COLS[col] ? jsonValue(text) : text;
    });
    return patch;
  }

  /* DB 행 전체 → 화면에 넘길 26칸 행 배열
   * '수정' 행은 원래 행에 겹쳐 읽고, '삭제' 행은 원래 행을 가립니다.
   * (같은 user_key 의 행에만 적용 — 남의 기록은 손댈 수 없습니다) */
  function reconcileRecords(records) {
    var patches = [], gone = {}, base = [];
    (records || []).forEach(function (rec) {
      if (!rec) return;
      var t = String(rec.type || '');
      if (t === PATCH_TYPE) patches.push(rec);
      else if (t === DELETE_TYPE) gone[String(rec.target || '')] = rec;
      else base.push(rec);
    });

    var rows = [], byId = {};
    base.forEach(function (rec) {
      var row = recordToRow(rec);
      if (!row || !row[0]) return;
      rows.push(row);
      byId[String(row[0])] = row;
    });

    var hidden = {};
    Object.keys(gone).forEach(function (id) {
      var row = byId[id], rec = gone[id];
      if (!row) return;
      if (String(rec.user_key || '') !== String(row[D.COL['사용자ID']] || '')) return;
      hidden[id] = true;
    });

    patches.sort(function (a, b) {
      var ka = String(a.created_at || ''), kb = String(b.created_at || '');
      return ka === kb ? 0 : (ka < kb ? -1 : 1);
    });
    patches.forEach(function (rec) {
      var id = String(rec.target || '');
      var row = byId[id];
      if (!row || hidden[id]) return;
      if (String(rec.user_key || '') !== String(row[D.COL['사용자ID']] || '')) return;
      var cells = (rec.payload && rec.payload.cells) || null;
      if (!cells) return;
      Object.keys(cells).forEach(function (name) {
        var idx = D.COL[name];
        if (idx != null) row[idx] = String(cells[name] == null ? '' : cells[name]);
      });
    });

    return rows.filter(function (row) { return !hidden[String(row[0])]; });
  }

  /* 어떤 저장소를 쓸지 — supabase(기본) · sheets · local */
  function backendFor(session) {
    if (!session || session.kind === 'guest') return 'local';
    var pref = String(U.readJSON(BACKEND_KEY, '') || '');
    var saved = savedSession();
    var bridge = !!(saved && saved.token && saved.url);
    if (pref === 'sheets') return bridge ? 'sheets' : 'supabase';
    if (pref === 'local') return 'local';
    if (pref === 'supabase') return 'supabase';
    /* 아직 고른 적 없는 기기: 예전에 구글 시트를 직접 연결했던 기기만 시트를 이어 갑니다 */
    if (bridge && String(U.readJSON('bm_mode_v1', '') || '') === 'sheets') return 'sheets';
    return 'supabase';
  }

  function createSupabase(opts) {
    opts = opts || {};
    var base = String(opts.url || SB.url).replace(/\/+$/, '');
    var activeKey = String(opts.key || SB.publishableKey);
    var fallbackKey = opts.key ? '' : SB.anonKey;   /* 새 키가 막힌 프로젝트를 위한 예비(공개 키) */
    var identity = opts.me || null;
    var meKey = String(opts.meKey || '');
    var timeout = opts.timeout || 12000;
    var rt = { ws: null, joined: false, closed: true, ref: 0, beat: null, retry: null, wait: 1000, handler: null, onStatus: null };

    function enc(v) { return encodeURIComponent(String(v == null ? '' : v)); }

    function apiErrorOf(status, data) {
      var code = (data && (data.code || (data.error_code))) || String(status);
      if (status === 409 || code === '23505') return new ApiError('conflict', '이미 저장된 기록이에요.', false);
      if (status === 401 || status === 403) return new ApiError('forbidden', '서버 권한을 확인하지 못했어요.', false);
      if (status === 404) return new ApiError('no_table', '서버 표를 찾지 못했어요.', false);
      if (status >= 500) return new ApiError('server', '서버가 잠시 응답하지 못했어요.', true);
      return new ApiError('request', (data && (data.message || data.msg || data.hint)) || '요청을 처리하지 못했어요.', status >= 500);
    }

    function rest(method, path, o) {
      o = o || {};
      return send(method, path, o, false);
    }

    function send(method, path, o, retried) {
      var headers = { 'apikey': activeKey, 'Authorization': 'Bearer ' + activeKey };
      if (o.body !== undefined) headers['Content-Type'] = 'application/json';
      if (o.prefer) headers['Prefer'] = o.prefer;
      if (o.range) headers['Range'] = o.range;
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = (ctrl && timeout && typeof setTimeout === 'function') ? setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, timeout) : null;
      var init = { method: method, headers: headers };
      if (o.body !== undefined) init.body = JSON.stringify(o.body);
      if (ctrl) init.signal = ctrl.signal;
      return fetch(base + '/rest/v1/' + path, init).then(function (res) {
        if (timer) clearTimeout(timer);
        return res.text().then(function (text) {
          var data = null;
          if (text) { try { data = JSON.parse(text); } catch (e) { data = null; } }
          if (!res.ok) {
            /* 새 publishable 키가 막힌 프로젝트면 예전 anon 키로 한 번만 다시 */
            if ((res.status === 401 || res.status === 403) && !retried && fallbackKey && activeKey !== fallbackKey) {
              activeKey = fallbackKey;
              return send(method, path, o, true);
            }
            throw apiErrorOf(res.status, data);
          }
          return data;
        });
      }).catch(function (err) {
        if (timer) clearTimeout(timer);
        if (err instanceof ApiError) throw err;
        throw new ApiError('network', '서버에 연결하지 못했어요. 잠시 뒤 다시 시도할게요.', true);
      });
    }

    /* 표 전체를 1000행씩 나눠 읽습니다 */
    function listAll() {
      var out = [], offset = 0;
      function page() {
        var range = offset + '-' + (offset + SB.pageSize - 1);
        return rest('GET', SB.table + '?select=*&order=created_at.asc', { range: range }).then(function (data) {
          var list = Array.isArray(data) ? data : [];
          out = out.concat(list);
          if (list.length < SB.pageSize) return out;
          offset += SB.pageSize;
          if (offset > 50000) return out;   /* 안전장치 */
          return page();
        });
      }
      return page();
    }

    function meProfile(rows) {
      var idx = D.index((rows || []).map(function (r) { return D.fromRow(r); }));
      var p = D.profileOf(idx, meKey) || {};
      var base0 = identity || {};
      var signed = !!identity;
      return {
        key: meKey,
        email: (identity && identity.email) || '',
        nick: p.nick || base0.nick || (signed ? '회원' : '체험 사용자'),
        level: p.level || base0.level || (signed ? '' : '일반회원'),
        discipline: p.discipline || base0.discipline || (signed ? '' : '복식'),
        bio: p.bio || base0.bio || '',
        region: base0.region || '',
        club: base0.club || '',
        style: D.normalizeStyle((p.theme && p.theme.style) || ''),
        theme: p.theme || { theme: 'th_night' }
      };
    }

    function ownerFilter() {
      return meKey ? '&user_key=eq.' + enc(meKey) : '';
    }

    /* 같은 ID 가 이미 있으면(연타·재시도) 조용히 성공으로 처리합니다.
     * retryOnConflict: '수정/삭제' 처럼 ID 가 매번 새로 생기는 행만 true */
    function insertRow(rec, retryOnConflict, tries) {
      return rest('POST', SB.table, { body: rec, prefer: 'return=minimal' }).catch(function (err) {
        if (!err || err.code !== 'conflict') throw err;
        if (retryOnConflict && (tries || 0) < 2) {
          var again = {};
          Object.keys(rec).forEach(function (k) { again[k] = rec[k]; });
          again.id = U.uid();
          return insertRow(again, true, (tries || 0) + 1);
        }
        return { duplicate: true };
      });
    }

    function writeMark(type, target, cells) {
      var payload = cells ? { cells: cells, at: U.stamp() } : { at: U.stamp() };
      return insertRow({
        id: U.uid(), type: type, user_key: meKey || 'anon', target: String(target), payload: payload
      }, true).then(function () { return { id: target, marked: true }; });
    }

    /* ---------- Realtime (postgres_changes) ---------- */
    function WSClass() {
      if (root && root.WebSocket) return root.WebSocket;
      if (typeof WebSocket !== 'undefined') return WebSocket;
      return null;
    }

    function rtStatus(state) {
      if (rt.onStatus) { try { rt.onStatus(state); } catch (e) {} }
    }

    function rtSend(msg) {
      if (!rt.ws) return false;
      try { rt.ws.send(JSON.stringify(msg)); return true; } catch (e) { return false; }
    }

    function rtOpen() {
      var C = WSClass();
      if (!C || rt.closed) return;
      var wsUrl = base.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:') +
        '/realtime/v1/websocket?apikey=' + enc(activeKey) + '&vsn=1.0.0';
      try { rt.ws = new C(wsUrl); } catch (e) { rtSchedule(); return; }
      rt.ws.onopen = function () { rt.wait = 1000; rtJoin(); rtBeat(); };
      rt.ws.onmessage = function (ev) { rtReceive(ev && ev.data); };
      rt.ws.onerror = function () { /* onclose 가 뒤따릅니다 */ };
      rt.ws.onclose = function () { rt.ws = null; rt.joined = false; rtBeatStop(); rtStatus('off'); if (!rt.closed) rtSchedule(); };
    }

    function rtJoin() {
      rt.ref += 1;
      rtSend({
        topic: 'realtime:public:' + SB.table,
        event: 'phx_join',
        ref: String(rt.ref),
        join_ref: String(rt.ref),
        payload: {
          config: {
            broadcast: { self: true },
            presence: { self: false },
            postgres_changes: [{ event: '*', schema: 'public', table: SB.table }]
          }
        }
      });
    }

    function rtBeat() {
      rtBeatStop();
      if (typeof setInterval !== 'function') return;
      rt.beat = setInterval(function () {
        rt.ref += 1;
        rtSend({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(rt.ref) });
      }, 25000);
    }

    function rtBeatStop() {
      if (rt.beat && typeof clearInterval === 'function') clearInterval(rt.beat);
      rt.beat = null;
    }

    function rtSchedule() {
      if (rt.closed || rt.retry || typeof setTimeout !== 'function') return;
      rt.wait = Math.min(15000, Math.max(1000, rt.wait * 1.6));
      rt.retry = setTimeout(function () { rt.retry = null; rtOpen(); }, rt.wait);
    }

    function rtReceive(raw) {
      var msg = null;
      try { msg = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { return; }
      if (!msg || !msg.event) return;
      var payload = msg.payload || {};
      if (msg.event === 'phx_reply') {
        if (payload.status === 'ok') { rt.joined = true; rtStatus('live'); }
        else { rtStatus('off'); rtSchedule(); }
        return;
      }
      if (msg.event === 'postgres_changes') {
        var data = payload.data || payload;
        if (data && data.record && rt.handler) {
          try { rt.handler(data); } catch (e) { /* 화면 오류가 연결을 끊지 않게 */ }
        }
        return;
      }
      if (msg.event === 'system' && payload.status === 'error') { rtStatus('off'); rtSchedule(); }
    }

    function rtClose() {
      rt.closed = true;
      rtBeatStop();
      if (rt.retry && typeof clearTimeout === 'function') clearTimeout(rt.retry);
      rt.retry = null;
      if (rt.ws) { try { rt.ws.close(); } catch (e) {} }
      rt.ws = null;
      rt.joined = false;
      rt.handler = null;
      rtStatus('off');
    }

    return {
      mode: 'supabase',
      url: base,
      meKey: meKey,
      ping: function () {
        var t0 = Date.now();
        return rest('GET', SB.table + '?select=id&limit=1').then(function () {
          return { ok: true, mode: 'supabase', url: base, ms: Date.now() - t0 };
        });
      },
      bootstrap: function () {
        return listAll().then(function (records) {
          var rows = reconcileRecords(records);
          return { me: meProfile(rows), rows: rows, syncedAt: U.stamp(), token: 'supabase', records: records.length };
        });
      },
      /* 앱 로그인은 시작화면(auth.js)이 맡습니다 — 서버 로그인이 아닙니다 */
      login: function () {
        return Promise.reject(new ApiError('use_app_auth', '앱 로그인은 시작화면에서 해 주세요.', false));
      },
      register: function () {
        return Promise.reject(new ApiError('use_app_auth', '앱 로그인은 시작화면에서 해 주세요.', false));
      },
      logout: function () { return Promise.resolve({ ok: true }); },
      append: function (row, clientId) {
        var rec;
        try { rec = rowToRecord(row); }
        catch (e) { return Promise.reject(new ApiError('bad_row', '저장할 기록을 읽지 못했어요.', false)); }
        rec.id = String((row && row[0]) || rec.id || U.uid());
        if (!rec.type) return Promise.reject(new ApiError('bad_row', '기록 유형이 비어 있어요.', false));
        if (!rec.user_key) rec.user_key = meKey;
        return insertRow(rec, false).then(function (res) {
          var out = { id: rec.id, clientId: clientId || null };
          if (res && res.duplicate) out.duplicate = true;
          return out;
        });
      },
      update: function (id, cells, clientId) {
        var patch = cellsToPatch(cells);
        if (!Object.keys(patch).length) return Promise.resolve({ id: id, noop: true });
        return rest('PATCH', SB.table + '?id=eq.' + enc(id) + ownerFilter(), {
          body: patch, prefer: 'return=representation'
        }).then(function (data) {
          if (Array.isArray(data) && data.length) return { id: id, native: true };
          /* anon 에는 UPDATE 정책이 없습니다 → 수정 기록 행을 덧붙입니다 */
          return writeMark(PATCH_TYPE, id, cells).then(function (res) {
            res.clientId = clientId || null;
            return res;
          });
        });
      },
      remove: function (id, clientId) {
        return rest('DELETE', SB.table + '?id=eq.' + enc(id) + ownerFilter(), {
          prefer: 'return=representation'
        }).then(function (data) {
          if (Array.isArray(data) && data.length) return { id: id, native: true };
          return writeMark(DELETE_TYPE, id, null).then(function (res) {
            res.clientId = clientId || null;
            return res;
          });
        });
      },
      resetDemo: function () { return Promise.resolve({ ok: false }); },
      /* 계정 삭제(탈퇴): 내 기록만 지웁니다. anon 은 DELETE 가 막히므로
       * 지우지 못한 행은 '삭제' 기록으로 가려 앱 어디에서도 보이지 않게 합니다. */
      deleteAccount: function () {
        return listAll().then(function (records) {
          var mine = records.filter(function (r) {
            if (String(r.user_key || '') !== String(meKey)) return false;
            var t = String(r.type || '');
            return t !== PATCH_TYPE && t !== DELETE_TYPE;
          });
          if (!mine.length) return { ok: true, mode: 'supabase', removed: 0 };
          return rest('DELETE', SB.table + '?user_key=eq.' + enc(meKey), { prefer: 'return=representation' }).then(function (data) {
            if (Array.isArray(data) && data.length) return { ok: true, mode: 'supabase', removed: data.length };
            var marks = mine.map(function (r) {
              return { id: U.uid(), type: DELETE_TYPE, user_key: meKey, target: String(r.id), payload: { at: U.stamp() } };
            });
            return rest('POST', SB.table, { body: marks, prefer: 'return=minimal' }).then(function () {
              return { ok: true, mode: 'supabase', removed: mine.length, hidden: true };
            });
          });
        });
      },
      /* 실시간 구독 — 새 행이 들어오면 handler({type, record, ...}) */
      subscribe: function (handler, onStatus) {
        if (!WSClass()) return false;
        rt.handler = handler;
        rt.onStatus = onStatus || null;
        if (!rt.closed && rt.ws) return { close: rtClose };
        rt.closed = false;
        rt.wait = 1000;
        rtOpen();
        return { close: rtClose };
      },
      close: rtClose,
      recordToRow: recordToRow
    };
  }

  function savedSession() { return U.readJSON(SESSION_KEY, null); }

  BM.api = {
    createLocal: createLocal, createSheets: createSheets, createSupabase: createSupabase,
    ApiError: ApiError, savedSession: savedSession, backendFor: backendFor,
    SESSION_KEY: SESSION_KEY, ROWS_KEY: ROWS_KEY, BACKEND_KEY: BACKEND_KEY, BACKENDS: BACKENDS,
    SUPABASE: SB,
    recordToRow: recordToRow, rowToRecord: rowToRecord, cellsToPatch: cellsToPatch,
    reconcileRecords: reconcileRecords, localStamp: localStamp, isoStamp: isoStamp
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
