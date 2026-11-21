/* ============================================================
 * store.js — 앱 상태 + 낙관적 업데이트 + 동기화 큐
 *
 * 원칙
 *  1) 화면은 항상 '즉시' 바뀐다. 서버 응답을 기다리지 않는다(낙관적 업데이트).
 *  2) 쓰기는 큐에 쌓여 순서대로 전송된다. 실패하면 큐에 남아 재시도한다.
 *  3) 같은 동작의 연타는 잠금(lock)으로, 같은 요청의 중복 전송은
 *     clientId로 막는다. (기존 앱에서 17번 중복 저장되던 문제)
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};
  var U = BM.util, D = BM.domain;

  var QUEUE_KEY = 'bm_queue_v1';
  var CACHE_KEY = 'bm_cache_v1';
  var MODE_KEY = 'bm_mode_v1';
  var AD_DAILY_LIMIT = D.HEART_RULES ? D.HEART_RULES.AD_PER_DAY : 5;

  /* 서버에 보내는 모드 — 시트 브리지와 Supabase 는 같은 큐·재시도를 씁니다 */
  function isRemoteMode(mode) { return mode === 'sheets' || mode === 'supabase'; }

  /* ---------- 파생 데이터 (순수 함수: 테스트에서도 그대로 사용) ---------- */
    function derive(rows, meKey, meInfo) {
    var idx = D.index(rows.map(function (r) { return Array.isArray(r) ? D.fromRow(r) : r; }));
    var isSample = (BM.seed && BM.seed.isSampleText) ? BM.seed.isSampleText : function () { return false; };
    /* 커뮤니티에는 실제 사용자가 쓴 글만 보입니다 (예전 앱이 넣은 샘플 글 제외) */
    var posts = U.sortBy((idx.byType['소셜'] || []).filter(function (p) { return !isSample(p.text); }),
      function (p) { return p.createdAt || ''; }, true);
    var replies = (idx.byType['답글'] || []).filter(function (r) { return !isSample(r.text); });
    var hearts = idx.byType['하트'] || [];
    var me = meKey || '';
    var likeSets = {};
    hearts.forEach(function (h) { (likeSets[h.target] = likeSets[h.target] || {})[h.userKey] = h.id; });
    var postViews = posts.map(function (p) {
    var rs = U.sortBy(replies.filter(function (r) { return r.target === p.id; }), function (r) { return r.createdAt || ''; });
    var likeCount = hearts.filter(function (h) { return h.target === p.id; }).length;
    return {
      id: p.id, nick: p.nick || D.displayName(idx, p.userKey), userKey: p.userKey,
      text: p.text, createdAt: p.createdAt, date: p.date, target: p.target || '',
      topic: D.topicOf(p),
      meet: D.meetOf(p),
      likes: Math.max(likeCount, p.likes || 0),
      likedByMe: !!(likeSets[p.id] && likeSets[p.id][me]),
      likeId: likeSets[p.id] && likeSets[p.id][me],
      replies: rs.map(function (r) {
        return {
          id: r.id, nick: r.nick || D.displayName(idx, r.userKey), userKey: r.userKey, text: r.text, createdAt: r.createdAt,
          /* 승인된 코치·멘토의 답글이면 '멘토 조언' 배지로 구분합니다 */
          mentor: D.isCoach(idx, r.userKey)
        };
      })
    };
    });

    var matchProfiles = [];
    (idx.byType['매칭프로필'] || []).forEach(function (m) {
    if (!m.payload) return;
    var pl = m.payload;
    var av = D.normalizeAvatar({
      avatarPhoto: pl.avatarPhoto, avatar: pl.avatar,
      avatarFrame: pl.avatarFrame, avatarBg: pl.avatarBg, avatarBadge: pl.avatarBadge
    });
    matchProfiles.push({
      rowId: m.id, userKey: m.userKey, nick: m.nick || D.displayName(idx, m.userKey),
      region: pl.region || '', level: D.normalizeGrade(pl.level), discipline: pl.discipline || '',
      club: pl.club || '', availability: pl.availability || '',
      experience: pl.experience || '', bio: pl.bio || '', avatar: av.emoji,
      gender: D.normalizeGender(pl.gender),
      style: D.normalizeStyle(pl.style),
      avatarPhoto: av.photo, avatarFrame: av.frame, avatarBg: av.bg, avatarBadge: av.badge,
      createdAt: m.createdAt
    });
    });
    /* 같은 사람이 여러 번 수정하면 최신만 */
    var byUser = {};
    U.sortBy(matchProfiles, function (m) { return m.createdAt || ''; }).forEach(function (m) { byUser[m.userKey] = m; });
    matchProfiles = Object.keys(byUser).map(function (k) { return byUser[k]; });

    var requests = idx.byType['매칭신청'] || [];
    var rooms = me ? D.chatRooms(idx, me) : [];
    var threads = me ? D.chatThreads(idx, me) : [];
    var friends = me ? D.friendsOf(idx, me) : [];
    var friendRequests = me ? D.incomingFriendRequests(idx, me) : [];
    var admin = D.isAdminMe(meInfo || {});
    var mentorApps = me ? D.mentorApplications(idx, me, admin) : [];
    var coachApps = U.sortBy(idx.byType['코치신청'] || [], function (a) { return a.createdAt || ''; }, true);
    var feedback = U.sortBy(idx.byType['코치피드백'] || [], function (a) { return a.createdAt || ''; }, true);

    var myRecords = U.sortBy(idx.byType['기록'] || [], function (r) { return (r.date || '') + (r.createdAt || ''); }, true);
    var mineOnly = me ? myRecords.filter(function (r) { return r.userKey === me; }) : myRecords;

    return {
    idx: idx,
    records: mineOnly,
    allRecords: myRecords,
    games: (idx.byType['경기'] || []).filter(function (r) { return !me || r.userKey === me; }),
    posts: postViews,
    matchProfiles: matchProfiles,
    requests: me ? D.matchRequests(idx, me) : [],
    rooms: rooms,
    threads: threads,
    friends: friends,
    friendRequests: friendRequests,
    mentorApps: mentorApps,
    mentorPending: admin ? mentorApps.filter(function (a) { return a.status === '심사중'; }).length : 0,
    isAdmin: admin,
    coachApps: coachApps,
    feedback: feedback,
    memos: U.sortBy(idx.byType['달력메모'] || [], function (m) { return m.date || ''; }, true),
    hearts: me ? D.heartStatus(idx, me) : {
      balance: 0, earned: 0, spent: 0, base: 0, history: [],
      adReward: 0, adLimit: 0, adUsedToday: 0, adRemaining: 0, adCooldownSec: 0, nextAdInSec: 0,
      canWatchAd: false, checkedInToday: false, canCheckIn: false, checkinReward: 0,
      streakBonus: { amount: D.HEART_RULES.STREAK_7_BONUS, days: 7, left: 7 },
      matchCost: D.HEART_RULES.MATCH_COST, giftCost: D.HEART_RULES.GIFT_COST,
      todayEarned: 0, todaySpent: 0
    },
    stats: D.stats(idx, me),
    unread: U.sum(threads, function (r) { return r.unread; })
    };
    }


  function normalizeMe(me) {
    if (!me) return me;
    var grade = D.normalizeGrade(me.level);
    if (grade) me.level = grade;
    /* v1.40 — 저장된 유형(꾸미기 JSON의 role)을 화면이 바로 쓰게 me.role로도 꺼내 둡니다 */
    me.role = D.roleOf(me);
    return me;
  }

  function createStore(options) {
    options = options || {};
    var api = options.api;
    var state = {
      ready: false,
      mode: api && api.mode || 'local',
      me: null,
      rows: [],
      idx: D.index([]),
      data: derive([], null),
      drafts: { log: defaultDraft() },
      /* 초보자 4주 루틴 체크 상태 (기기 저장 · 계정별) */
      routine: {},
      /* 초보자 4주 루틴 표시 선택 — null(아직 안 고름) · true(보임) · false(숨김) */
      routinePref: null,
      /* 선수용 7대 훈련 표시 선택 — null(유형을 따라감) · true · false */
      proPref: null,
      ui: {
        tab: 'log',
        /* 매칭 찾기: 처음에는 아무 조건도 고르지 않은 상태(안내 카드만 보임).
         * 급수·지역·종목·성별을 고르거나 검색어를 넣거나 '전체'를 누르면 목록이 나옵니다. */
        matchFilter: { level: '', gender: '', region: '', discipline: '', query: '' },
        matchStarted: false,     /* 조건·전체를 골라 선수 목록을 보여 주는 중인지 */
        matchTab: 'find',        /* find · in(받은 요청) · out(보낸 요청) · chat(대화) */
        matchSort: 'score',      /* score(궁합순) · recent(최근순) */
        matchFilterOpen: '',     /* 펼친 필터 줄 (level · region · discipline · gender) */
        chatRoom: null, chatOther: '', chatOpen: false, chatDraft: '',
        coachTab: '', coachPlayer: null, composer: '', composerTopic: '자유', composerMeet: { when: '', place: '', cap: '', fee: '' }, replyTo: null,
        routineWeek: 0,          /* 초보자 루틴: 보고 있는 주차 (0이면 아직 덜 끝낸 주차) */
        editLogId: null,         /* 수정 중인 일지 ID (있으면 저장은 새 줄이 아니라 갱신) */
        lastSavedLog: null       /* 방금 저장한 일지 → 커뮤니티 원탭 공유 */
      },
      analysis: null,
      /* 전송 대기열은 시트(서버) 모드에서만 씁니다.
       * 기기 저장(체험·게스트) 모드에서 예전 버전이 남긴 대기열을 그대로 읽으면
       * '저장 중… 35건 남음'처럼 보이거나 실패만 반복합니다. */
      queue: isRemoteMode(api && api.mode) ? (U.readJSON(QUEUE_KEY, []) || []) : [],
      locks: {},
      syncError: null,
      syncState: 'idle',
      lastSync: null,
      /* v1.24 — 실시간 구독 상태: live(붙음) · off(안 붙음) */
      realtime: 'off',
      /* v1.20 — 알림 · 편지지 설정(기기 저장)과 새 소식 */
      prefs: D.readPrefs(),
      notifySince: '',          /* 이 시각 이후에 들어온 메시지·요청만 새 소식으로 칩니다 */
      inbox: { messages: [], requests: [], friendRequests: [], total: 0, at: '' },
      activityAt: '',           /* 내 활동 시각(마지막으로 남긴 기록) */
      lastActivityWrite: 0,     /* 시트에 활동 시각을 적은 마지막 시각(ms) — 과도한 쓰기 방지 */
      stats: { writes: 0, blocked: 0, failed: 0 }
    };
    var subs = [];
    var flushing = false;
    var polling = false;
    var apiRef = api;
    /* 활동 시각을 시트에 다시 적는 최소 간격 (3분) — 열어 두기만 해도 3분마다 한 번 */
    var ACTIVITY_WRITE_MS = 180000;

    /* 예전 버전(v1.0)을 쓰던 기기에 남은 전송 대기열 정리.
     * 기기 저장 모드에는 보낼 서버가 없으므로 대기열 자체를 지웁니다. */
    if (!isRemoteMode(api && api.mode)) U.storage.removeItem(QUEUE_KEY);

    function isSheets() { return !!(apiRef && apiRef.mode === 'sheets'); }
    function isRemote() { return isRemoteMode(apiRef && apiRef.mode); }

    function defaultDraft() {
      /* 아무것도 미리 채우지 않습니다. (예전에는 60분·21:18·'승'이 채워져 있어
       * 이미 입력을 마친 것처럼 보였습니다.) */
      return {
        date: U.ymd(), cond: null, intensity: null, minutes: null,
        done: [],
        gameMode: 21,
        games: [{ a: '', b: '' }],
        score: null, result: '',
        pain: [], weakness: [], note: '',
        /* 복식 파트너 이름 · 스윙·경기 영상 링크와 한 줄 체크 포인트 (선택) */
        partner: '', video: '', videoNote: '',
        /* 선수용 7대 훈련 — { '스트록': '클리어 100개', ... } (선수 유형에서만 보입니다) */
        pro: {}
      };
    }

    /* ---------- 선수용 7대 훈련 표시 선택 (기기 저장 · 계정별) ----------
     * null = 유형을 따라감(선수면 보임) · true = 항상 보임 · false = 숨김
     * 일지 저장 칸(완료훈련 · 훈련계획)과는 무관한 화면 설정입니다. */
    var PRO_PREF_KEY = 'bm_pro_pref_v1';

    function proPrefKeyFor(scope) {
      return PRO_PREF_KEY + '::' + String(scope || 'guest').toLowerCase();
    }

    function loadProPref(scope) {
      var v = U.readJSON(proPrefKeyFor(scope), null);
      if (v === true || v === 'true') return true;
      if (v === false || v === 'false') return false;
      return null;
    }

    function saveProPref(scope, val) {
      if (val === true || val === 'true') { U.writeJSON(proPrefKeyFor(scope), true); return true; }
      if (val === false || val === 'false') { U.writeJSON(proPrefKeyFor(scope), false); return false; }
      U.storage.removeItem(proPrefKeyFor(scope));
      return null;
    }

    /* ---------- 초보자 4주 루틴 (기기 저장) ----------
     * 계정마다 체크 상태를 따로 둡니다. 로그인 계정은 me.key(u_…),
     * 둘러보기는 demo_me 키를 씁니다. 시트 26칸과는 무관합니다. */
    function routineScope() {
      return (state.me && state.me.key) || 'guest';
    }

    function loadRoutine() {
      state.routine = BM.routine ? BM.routine.load(routineScope()) : {};
      state.routinePref = BM.routine ? BM.routine.loadPref(routineScope()) : null;
      state.proPref = loadProPref(routineScope());
      /* 이미 체크한 항목이 있는 기기는 루틴을 쓰던 사람입니다.
       * 새로 생긴 '시작할까요?' 카드로 되돌리지 않고 켜진 상태로 이어 갑니다. */
      if (state.routinePref === null && Object.keys(state.routine || {}).length) {
        state.routinePref = BM.routine.savePref(routineScope(), true);
      }
    }

    function recompute() {
      state.idx = D.index(state.rows.map(function (r) { return Array.isArray(r) ? D.fromRow(r) : r; }));
      state.data = derive(state.rows, state.me && state.me.key, state.me);
    }

    function emit() {
      for (var i = 0; i < subs.length; i++) {
        try { subs[i](state); } catch (e) { /* 화면 오류가 상태를 망치지 않게 */ }
      }
    }

    function commit() {
      recompute();
      emit();
    }

    /* ---------- 일지 저장/수정이 함께 쓰는 계산 ----------
     * 게임 점수: 한 일지에 여러 경기를 남길 수 있습니다.
     * 점수가 비어 있는 게임은 저장하지 않고, 예전처럼 한 경기만 넣어도 됩니다. */
    function buildLog(src) {
      var d = JSON.parse(JSON.stringify(src || {}));
      var games = D.cleanGames(d.games);
      if (!games.length && d.score) games = D.cleanGames([d.score]);
      var gsum = D.gamesSummary(games);
      var score = gsum.first;
      var result = gsum.result || d.result || '';
      var scoreRaw = games.length ? D.formatGames(games, d.gameMode) : '';
      var draftForAi = JSON.parse(JSON.stringify(d));
      draftForAi.games = games;
      draftForAi.score = score;
      draftForAi.result = result;
      var an = BM.ai.analyze({
        draft: draftForAi, records: state.data.records, level: (state.me && state.me.level) || d.level,
        discipline: (state.me && state.me.discipline) || d.discipline,
        nick: state.me && state.me.nick
      });
      return { d: d, games: games, score: score, result: result, scoreRaw: scoreRaw, an: an };
    }

    /* 수정 저장: 기존 행을 같은 자리에서 갱신합니다(새 행 없음).
     * 시트 모드에서는 update 요청 한 건으로 나가고, 브리지가 아직 예전 버전이면
     * 바꿀 수 있는 칸만 반영되고 나머지는 다음 동기화에 그대로 남습니다(앱은 깨지지 않음). */
    function saveLogEdit() {
      var id = state.ui.editLogId;
      var rec = (state.rows || []).map(function (r) { return Array.isArray(r) ? D.fromRow(r) : r; })
        .filter(function (r) { return String(r.id) === String(id); })[0];
      if (!rec) {                     /* 그 사이에 지워졌다면 수정 모드를 끝냅니다 */
        state.ui.editLogId = null;
        state.drafts.log = defaultDraft();
        emit();
        return { ok: false, reason: 'not_found' };
      }
      var built = buildLog(state.drafts.log);
      var entity = {
        date: built.d.date || rec.date || U.ymd(),
        cond: built.d.cond, intensity: built.d.intensity, minutes: built.d.minutes,
        done: built.d.done, score: built.score, scoreRaw: built.scoreRaw,
        result: built.result, pain: built.d.pain, weakness: built.d.weakness,
        prescription: built.an.care, drills: built.an.drills,
        text: built.d.note || '',
        /* 선수용 7대 훈련 — '훈련계획' JSON 칸 (체크만 하고 안 적었으면 빈 값) */
        plan: D.proPlan(built.d.pro),
        /* 파트너·영상은 '팀' 칸 JSON — 고칠 때 비우면 칸도 함께 비워집니다 */
        team: D.logExtraJson({ partner: built.d.partner, video: { url: built.d.video, label: built.d.videoNote } })
      };
      var cells = D.logCells(entity);
      patchRowById(id, cells);
      enqueue({ kind: 'update', id: id, cells: cells, clientId: U.clientId() });
      state.ui.editLogId = null;
      state.drafts.log = defaultDraft();
      state.ui.lastSavedLog = null;     /* 수정 저장에서는 공유 카드를 띄우지 않습니다 */
      state.analysis = built.an;
      commit();
      return { ok: true, updated: true, id: id, cells: cells, analysis: built.an };
    }

    /* ---------- 잠금(연타 방지) ---------- */
    function tryLock(key, ttl) {
      var now = Date.now();
      var until = state.locks[key] || 0;
      if (until > now) { state.stats.blocked++; return false; }
      state.locks[key] = now + (ttl || 900);
      return true;
    }

    /* ---------- 큐 ---------- */
    function persistQueue() {
      /* 기기 저장 모드: 대기열을 localStorage에 남기지 않습니다 */
      if (!isRemote()) return;
      U.writeJSON(QUEUE_KEY, state.queue);
    }

    function enqueue(op) {
      op.ts = op.ts || Date.now();
      op.attempts = op.attempts || 0;
      state.queue.push(op);
      persistQueue();
      flush();
      return op;
    }

    function flush() {
      if (flushing) return Promise.resolve();
      if (!state.queue.length) { state.syncState = 'idle'; return Promise.resolve(); }
      if (!apiRef) return Promise.resolve();
      flushing = true;
      state.syncState = 'syncing';
      emit();

      function step() {
        if (!state.queue.length) {
          flushing = false;
          state.syncState = 'idle';
          state.syncError = null;
          emit();
          return Promise.resolve();
        }
        var op = state.queue[0];
        var call;
        if (op.kind === 'append') call = apiRef.append(op.row, op.clientId);
        else if (op.kind === 'update') call = apiRef.update(op.id, op.cells, op.clientId);
        else if (op.kind === 'remove') call = apiRef.remove(op.id, op.clientId);
        else call = Promise.resolve();

        return call.then(function () {
          state.queue.shift();
          persistQueue();
          state.stats.writes++;
          if (op.kind === 'append' && op.tempId && op.row && op.row[0] === op.tempId) {
            /* 서버가 ID를 바꿔줄 일은 없지만, 혹시 몰라 매핑 유지 */
          }
          state.lastSync = U.stamp();
          return step();
        }).catch(function (err) {
          op.attempts = (op.attempts || 0) + 1;
          op.lastError = err && err.message;
          state.stats.failed++;
          if (!isRemote()) {
            /* 기기 저장 모드에는 다시 보낼 서버가 없습니다.
             * 실패한 요청은 버리고 다음 요청으로 넘어갑니다(무한 재시도·대기 표시 없음). */
            state.queue.shift();
            state.syncState = 'idle';
            persistQueue();
            emit();
            return step();
          }
          state.syncError = (err && err.message) || '동기화에 실패했어요.';
          persistQueue();
          flushing = false;
          state.syncState = 'error';
          emit();
          if (op.attempts < 6 && typeof setTimeout === 'function') {
            var wait = Math.min(30000, 1200 * Math.pow(2, op.attempts));
            setTimeout(function () { state.syncState = 'retrying'; flush(); }, wait);
          }
          return null;
        });
      }
      return step();
    }

    /* ---------- 예전 앱이 넣은 샘플 글 걷어내기 ---------- */
    function dropSampleRows() {
      var seed = BM.seed;
      if (!seed || !seed.isSampleText) return [];
      var victims = {};
      state.rows.forEach(function (r) {
        if (String(r[D.COL['유형']]) !== '소셜') return;
        if (seed.isSampleText(r[D.COL['소셜글']])) victims[String(r[0])] = true;
      });
      state.rows.forEach(function (r) {
        var type = String(r[D.COL['유형']]);
        var target = String(r[D.COL['대상']] || '');
        if (type === '답글' && (victims[target] || seed.isSampleText(r[D.COL['소셜글']]))) victims[String(r[0])] = true;
        if (type === '하트' && victims[target]) victims[String(r[0])] = true;
      });
      var ids = Object.keys(victims);
      if (!ids.length) return [];
      state.rows = state.rows.filter(function (r) { return !victims[String(r[0])]; });
      return ids;
    }

    function purgeSamples() {
      var ids = dropSampleRows();
      if (!ids.length) return 0;
      if (state.mode === 'local') {
        ids.forEach(function (id) {
          enqueue({ kind: 'remove', id: id, clientId: U.clientId() });
        });
      } else if (apiRef && typeof apiRef.purgeSamples === 'function' && D.isAdminMe(state.me)) {
        /* 시트 모드: 관리자만 서버에서 실제로 지울 수 있습니다 */
        Promise.resolve(apiRef.purgeSamples()).catch(function () { /* 화면은 이미 필터로 가려짐 */ });
      }
      return ids.length;
    }

    /* ---------- 낙관적 행 추가 ---------- */
    function pushRow(entity, queueIt) {
      var row = D.toRow(entity);
      state.rows.unshift(row);
      if (queueIt !== false) {
        enqueue({ kind: 'append', row: row, clientId: entity.clientId });
      }
      return row;
    }

    function patchRowById(id, cells) {
      for (var i = 0; i < state.rows.length; i++) {
        if (String(state.rows[i][0]) === String(id)) {
          Object.keys(cells).forEach(function (name) {
            var c = D.COL[name];
            if (c != null) state.rows[i][c] = String(cells[name]);
          });
          return true;
        }
      }
      return false;
    }

    /* 일지 한 줄 → 커뮤니티 글 (이모지·장식 없이 담백하게) */
    function shareTextOf(e) {
      var games = (e.games && e.games.length) ? e.games : (e.score ? [e.score] : []);
      var sum = D.gamesSummary(games);
      var head = [U.shortDay(e.date || U.ymd()), (e.minutes ? e.minutes + '분' : ''),
        ((e.done || []).join('·'))].filter(Boolean).join(' · ');
      var tail = [];
      if (sum.count) {
        tail.push(sum.count + '경기 ' + sum.wins + '승 ' + sum.losses + '패' + (sum.draws ? ' ' + sum.draws + '무' : ''));
      }
      if (e.cond) tail.push('컨디션 ' + e.cond + '/10');
      if (e.pain && e.pain.length) tail.push('아픈 곳 ' + e.pain.join('·'));
      return head + (tail.length ? '\n' + tail.join(' · ') : '');
    }

    function meEntity(extra) {
      var me = state.me || {};
      var e = {
        nick: me.nick, level: me.level, discipline: me.discipline, userKey: me.key
      };
      Object.keys(extra || {}).forEach(function (k) { e[k] = extra[k]; });
      return e;
    }

    /* ---------- 액션 ---------- */
    var actions = {
      init: function () {
        return apiRef.bootstrap().then(function (res) {
          state.me = normalizeMe(res.me);
          state.rows = res.rows || [];
          state.ready = true;
          loadRoutine();
          state.lastSync = res.syncedAt || U.stamp();
          purgeSamples();
          U.writeJSON(CACHE_KEY, { rows: state.rows, me: state.me, at: state.lastSync });
          U.writeJSON(MODE_KEY, state.mode);
          recompute();
          /* 처음 열 때는 지금 시각을 기준으로 잡습니다 — 지난 메시지는 알리지 않습니다 */
          state.notifySince = U.stamp();
          state.activityAt = D.lastActiveAt(state.idx, state.me && state.me.key) || '';
          emit();
          flush();
          return state;
        }).catch(function (err) {
          /* 오프라인: 마지막 캐시로 먼저 띄운다 */
          var cache = U.readJSON(CACHE_KEY, null);
          if (cache && cache.rows) {
            state.me = normalizeMe(cache.me);
            state.rows = cache.rows;
            state.ready = true;
            loadRoutine();
            state.syncError = (err && err.message) || '오프라인 상태예요.';
            recompute();
            state.notifySince = U.stamp();
            state.activityAt = D.lastActiveAt(state.idx, state.me && state.me.key) || '';
            emit();
          }
          return state;
        });
      },

      reload: function () { return apiRef.bootstrap().then(function (res) {
        state.me = normalizeMe(res.me);
        state.rows = res.rows || [];
        loadRoutine();
        recompute();
        emit();
      }); },

      /* 초보자 4주 루틴: 항목 하나 체크/해제 → 기기에 바로 저장 */
      toggleRoutine: function (id) {
        if (!BM.routine) return { ok: false };
        state.routine = BM.routine.toggle(state.routine, id);
        BM.routine.save(routineScope(), state.routine);
        emit();
        return { ok: true, routine: state.routine };
      },

      resetRoutine: function () {
        state.routine = {};
        if (BM.routine) BM.routine.save(routineScope(), state.routine);
        emit();
        return { ok: true };
      },

      setRoutineWeek: function (no) {
        var n = Number(no);
        state.ui.routineWeek = n >= 1 && n <= 4 ? n : 0;
        emit();
      },

      /* 루틴 표시 선택: true(보임) · false(숨김) · null(아직 안 고름) — 기기에 바로 저장 */
      setRoutinePref: function (val) {
        if (!BM.routine) return { ok: false };
        state.routinePref = BM.routine.savePref(routineScope(), val);
        emit();
        return { ok: true, routinePref: state.routinePref };
      },

      /* 선수용 7대 훈련 표시: true(봄) · false(숨김) · null(유형을 따라감) */
      setProPref: function (val) {
        state.proPref = saveProPref(routineScope(), val);
        emit();
        return { ok: true, proPref: state.proPref };
      },

      /* ---------- v1.40: 사용자 유형 (초보 · 동호인 · 선수 · 코치) ----------
       * MY에서 언제든 바꿉니다. 유형을 바꾸면 화면도 따라 바뀝니다:
       *  · 초보  → 초보자 4주 루틴을 켜고, 선수 훈련 기록은 숨김
       *  · 동호인 → 4주 루틴·선수 블록 모두 기본 OFF (애초에 고른 사람은 유지)
       *  · 선수  → 7대 훈련 기록 ON, 4주 루틴 숨김
       *  · 코치  → 피드백 흐름 중심 (4주 루틴·선수 블록 OFF)
       * 4주 루틴은 '사용자가 이 기기에서 이미 고른 선택'을 덮어쓰지 않습니다. */
      setRole: function (role) {
        var id = D.normalizeRole(role);
        if (!id) return { ok: false, reason: 'unknown_role' };
        var prev = D.roleOf(state.me);
        if (prev === id) return { ok: true, role: id, saved: false };
        var res = actions.saveProfile({ role: id });
        if (!res || !res.ok) return { ok: false, reason: (res && res.reason) || 'locked' };
        var def = D.roleById(id);
        if (BM.routine) {
          if (def && def.routine) state.routinePref = BM.routine.savePref(routineScope(), true);
          else if (id === 'player' || id === 'coach' || id === 'club') {
            /* 4주 루틴을 쓰던 사람도 유형을 바꾸면 일지 첫머리를 비워 줍니다 */
            state.routinePref = BM.routine.savePref(routineScope(), false);
          }
        }
        /* 유형이 바뀌면 7대 훈련 표시는 다시 '유형을 따라감'으로 */
        state.proPref = saveProPref(routineScope(), null);
        emit();
        return { ok: true, role: id, saved: true };
      },

      setTab: function (tab) {
        state.ui.tab = tab; emit();
      },

      /* ---------- v1.20: 사용자 설정 (알림 · 편지지) ---------- */
      setPref: function (key, value) {
        state.prefs = D.setPref(state.prefs, key, value);
        emit();
        return state.prefs;
      },

      /* ---------- v1.20: 새 소식 폴링 ----------
       * 시트(서버) 모드에서는 다른 기기의 메시지가 시트에 쌓이므로, 40~60초마다
       * bootstrap으로 새 행을 받아 '직전 확인 이후 새로 늘어난 것'만 골라 알립니다.
       * 기기 저장 모드에서도 그대로 동작하지만(같은 기기 데이터), 새로 늘 일은 없습니다. */
      poll: function () {
        if (!apiRef || !state.ready || polling) return Promise.resolve({ ok: false, reason: 'busy' });
        /* 아직 서버로 보내지 못한 쓰기가 있으면 기다립니다.
         * (방금 보낸 메시지가 폴링 때문에 화면에서 사라지는 일 방지) */
        if ((state.queue && state.queue.length) || flushing) return Promise.resolve({ ok: false, reason: 'pending' });
        polling = true;
        var since = state.notifySince || U.stamp();
        return apiRef.bootstrap().then(function (res) {
          polling = false;
          if (res && res.me) state.me = normalizeMe(res.me);
          if (res && res.rows) state.rows = res.rows;
          state.lastSync = (res && res.syncedAt) || U.stamp();
          state.syncError = null;
          recompute();
          var fresh = D.newIncoming(state.idx, state.me && state.me.key, since);
          state.notifySince = U.stamp();
          state.activityAt = D.lastActiveAt(state.idx, state.me && state.me.key) || state.activityAt;
          if (fresh.total) {
            state.inbox = {
              messages: fresh.messages, requests: fresh.requests, friendRequests: fresh.friendRequests,
              total: fresh.total, at: state.notifySince
            };
          }
          U.writeJSON(CACHE_KEY, { rows: state.rows, me: state.me, at: state.lastSync });
          emit();
          return { ok: true, fresh: fresh };
        }).catch(function (err) {
          polling = false;
          state.syncError = (err && err.message) || '새 소식을 확인하지 못했어요.';
          emit();
          return { ok: false, reason: 'error', message: state.syncError };
        });
      },

      dismissInbox: function () {
        state.inbox = { messages: [], requests: [], friendRequests: [], total: 0, at: '' };
        emit();
        return { ok: true };
      },

      /* ---------- v1.20: 내 활동 시각 ----------
       * 앱이 열려 있는 동안 가끔 내 매칭프로필의 소셜글(JSON)에 lastActiveAt을 적어 둡니다.
       * (26칸은 그대로 — 새 열·새 행 유형을 만들지 않습니다. 3분에 한 번만 씁니다.)
       * 매칭프로필이 없는 계정은 기기에만 적고 넘어갑니다. */
      touchActivity: function (opts) {
        opts = opts || {};
        var me = state.me && state.me.key;
        if (!me) return { ok: false, reason: 'no_login' };
        var nowMs = Date.now();
        if (!opts.force && state.lastActivityWrite && nowMs - state.lastActivityWrite < ACTIVITY_WRITE_MS) {
          return { ok: true, mode: 'throttled' };
        }
        state.lastActivityWrite = nowMs;
        state.activityAt = U.stamp();
        var mp = (state.data.matchProfiles || []).filter(function (m) { return m.userKey === me; })[0];
        var row = mp && mp.rowId ? state.idx.byId[mp.rowId] : null;
        if (!row) return { ok: true, mode: 'local-only' };
        var payload = {};
        Object.keys(row.payload || {}).forEach(function (k) { payload[k] = row.payload[k]; });
        payload.lastActiveAt = state.activityAt;
        var cells = { '소셜글': JSON.stringify(payload) };
        patchRowById(row.id, cells);
        enqueue({ kind: 'update', id: row.id, cells: cells, clientId: U.clientId() });
        recompute();
        emit();
        return { ok: true, mode: 'sheets', at: state.activityAt };
      },

      setDraft: function (patch) {
        Object.keys(patch).forEach(function (k) { state.drafts.log[k] = patch[k]; });
        state.analysis = null;
        state.ui.lastSavedLog = null;     /* 다시 고치면 공유 카드는 감춥니다 */
        emit();
      },

      resetDraft: function () {
        state.drafts.log = defaultDraft();
        state.analysis = null;
        state.ui.lastSavedLog = null;
        emit();
      },

      analyze: function () {
        var d = state.drafts.log;
        state.analysis = BM.ai.analyze({
          draft: d, records: state.data.records, level: (state.me && state.me.level) || d.level,
          discipline: (state.me && state.me.discipline) || d.discipline,
          nick: state.me && state.me.nick
        });
        emit();
        return state.analysis;
      },

      saveLog: function (opts) {
        opts = opts || {};
        if (!tryLock('log', 1200)) return { ok: false, reason: 'locked' };
        /* 수정 중이면 새 줄을 만들지 않고 그 일지를 갱신합니다 */
        if (state.ui.editLogId) return saveLogEdit();
        var built = buildLog(state.drafts.log);
        if (!built) return { ok: false, reason: 'bad' };
        var entity = meEntity({
          type: '기록',
          date: built.d.date || U.ymd(),
          id: U.uid(),
          clientId: U.clientId(),
          cond: built.d.cond, intensity: built.d.intensity, minutes: built.d.minutes,
          done: built.d.done, score: built.score, scoreRaw: built.scoreRaw, games: built.games, gameMode: built.d.gameMode,
          result: built.result,
          pain: built.d.pain, weakness: built.d.weakness,
          prescription: built.an.care, drills: built.an.drills,
          /* 선수용 7대 훈련 — 새 칸 없이 '훈련계획' JSON 칸에 (시트 26칸 그대로) */
          plan: D.proPlan(built.d.pro),
          /* 복식 파트너 · 영상 링크 — 새 칸 없이 '팀' 칸에 JSON 한 줄 */
          team: D.logExtraJson({ partner: built.d.partner, video: { url: built.d.video, label: built.d.videoNote } })
        });
        if (built.d.note) entity.text = built.d.note;   /* 메모는 소셜글 칸에 남깁니다 */
        pushRow(entity);
        state.analysis = built.an;
        state.ui.tab = 'log';
        state.ui.lastSavedLog = entity;   /* 저장 직후 '커뮤니티에 공유' 카드용 */
        commit();
        if (opts.keepDraft !== true) state.drafts.log = defaultDraft();
        return { ok: true, entity: entity, analysis: built.an };
      },

      /* ---------- 지난 일지 수정 · 삭제 ----------
       * 수정: 그 날 일지의 기존 값을 입력칸으로 불러오고(값은 그대로),
       *       저장할 때 새 줄을 붙이지 않고 그 줄만 갱신합니다.
       * 삭제: 한 번 확인한 뒤 그 줄만 지웁니다(로컬·시트 모두 같은 큐를 씁니다). */
      startEditLog: function (id) {
        var rec = (state.rows || []).map(function (r) { return Array.isArray(r) ? D.fromRow(r) : r; })
          .filter(function (r) { return String(r.id) === String(id); })[0];
        if (!rec) return { ok: false, reason: 'not_found' };
        if (rec.type && rec.type !== '기록') return { ok: false, reason: 'not_found' };
        if (state.me && rec.userKey && String(rec.userKey) !== String(state.me.key)) {
          return { ok: false, reason: 'not_mine' };
        }
        state.drafts.log = D.recordDraft(rec);
        state.ui.editLogId = rec.id;
        state.ui.tab = 'log';
        state.ui.lastSavedLog = null;
        state.analysis = null;
        emit();
        return { ok: true, id: rec.id, draft: state.drafts.log };
      },

      cancelEditLog: function () {
        if (!state.ui.editLogId) return { ok: false };
        state.ui.editLogId = null;
        state.drafts.log = defaultDraft();
        state.analysis = null;
        emit();
        return { ok: true };
      },

      deleteLog: function (id) {
        if (!id) return { ok: false, reason: 'not_found' };
        var key = String(id);
        var rec = (state.rows || []).map(function (r) { return Array.isArray(r) ? D.fromRow(r) : r; })
          .filter(function (r) { return String(r.id) === key; })[0];
        if (!rec) return { ok: false, reason: 'not_found' };
        if (rec.type && rec.type !== '기록') return { ok: false, reason: 'not_found' };
        if (state.me && rec.userKey && String(rec.userKey) !== String(state.me.key)) {
          return { ok: false, reason: 'not_mine' };
        }
        if (!tryLock('del:' + key, 1500)) return { ok: false, reason: 'locked' };
        state.rows = state.rows.filter(function (r) { return String(r[0]) !== key; });
        if (state.ui.editLogId && String(state.ui.editLogId) === key) {
          state.ui.editLogId = null;
          state.drafts.log = defaultDraft();
        }
        if (state.ui.lastSavedLog && String(state.ui.lastSavedLog.id) === key) state.ui.lastSavedLog = null;
        /* 서버(시트)에도 알립니다. 브리지가 없거나 예전 버전이어도 화면은 이미 지워졌고,
         * 기기 저장 모드에서는 로컬 저장소에서 바로 빠집니다. */
        enqueue({ kind: 'remove', id: key, clientId: U.clientId() });
        state.analysis = null;
        commit();
        return { ok: true, id: key };
      },

      /* 수정 저장 — 새 행을 만들지 않고 기존 일지 한 줄만 갱신합니다 */
      updateLog: function () { return saveLogEdit(); },

      /* 일지 → 커뮤니티 공유: 저장 직후 카드에서 한 번에 올립니다.
       * 같은 일지는 두 번 올리지 않고(대상 칸에 일지 ID), 점수·시간만 담백하게 적습니다. */
      shareLogToCommunity: function (logId) {
        var me = state.me || {};
        if (!me.key) return { ok: false, reason: 'no_login' };
        var e = state.ui.lastSavedLog;
        if (logId) {
          e = (state.data.records || []).filter(function (r) { return r.id === logId; })[0] || e;
        }
        if (!e || !e.id) return { ok: false, reason: 'no_log' };
        if (!tryLock('share:' + e.id, 1500)) return { ok: false, reason: 'locked' };
        var already = (state.idx.byType['소셜'] || []).some(function (p) {
          return p.userKey === me.key && String(p.target || '') === String(e.id);
        });
        if (already) return { ok: false, reason: 'already' };
        var entity = meEntity({
          type: '소셜', date: U.ymd(), id: U.uid(), clientId: U.clientId(),
          target: e.id, text: shareTextOf(e), plan: { topic: '일지' }
        });
        pushRow(entity);
        state.ui.lastSavedLog = null;      /* 공유했으면 카드는 접습니다 */
        commit();
        return { ok: true, text: entity.text };
      },

      /* ---------- 꾸미기 해금 (하트 소모처) ----------
       * 프레임·배지는 한 번 사 두면 계속 씁니다. 무료·연속 출석 해금은 하트를 쓰지 않습니다.
       * 해금 기록은 기존 '꾸미기구매' 행(대상=frame:gold · badge:star)을 그대로 씁니다. */
      buyDeco: function (kind, value) {
        var me = state.me || {};
        if (!me.key) return { ok: false, reason: 'no_login' };
        var id = D.decoId(kind, value);
        if (!id) return { ok: false, reason: 'unknown' };
        if (!tryLock('deco:' + id, 1500)) return { ok: false, reason: 'locked' };
        var status = state.data.hearts || {};
        var streak = D.checkinStreak(state.idx, me.key);
        if (D.ownsDeco(state.idx, me.key, id, streak)) {
          return { ok: true, purchased: false, price: 0, id: id, balance: status.balance || 0 };
        }
        var price = D.decoPrice(id);
        if ((status.balance || 0) < price) {
          return { ok: false, reason: 'hearts', need: price - (status.balance || 0), price: price, id: id };
        }
        pushRow(meEntity({
          type: '꾸미기구매', id: U.uid(), clientId: U.clientId(), date: U.ymd(),
          target: id, likes: price, nick: me.nick
        }));
        commit();
        return { ok: true, purchased: true, price: price, id: id, balance: (state.data.hearts || {}).balance || 0 };
      },

      dismissShare: function () {
        if (!state.ui.lastSavedLog) return { ok: false };
        state.ui.lastSavedLog = null;
        emit();
        return { ok: true };
      },

      saveWeakness: function (skills) {
        if (!tryLock('weak', 1200)) return { ok: false, reason: 'locked' };
        var list = skills && skills.length ? skills : state.drafts.log.weakness;
        var an = BM.ai.analyze({ draft: { weakness: list }, records: state.data.records, level: state.me && state.me.level, nick: state.me && state.me.nick });
        var entity = meEntity({
          type: '약점', date: U.ymd(), id: U.uid(), clientId: U.clientId(),
          weakness: list, drills: an.drills
        });
        pushRow(entity);
        commit();
        return { ok: true, analysis: an };
      },

      toggleLike: function (postId) {
        if (!tryLock('like:' + postId, 320)) return { ok: false, reason: 'locked' };
        var post = state.data.posts.filter(function (p) { return p.id === postId; })[0];
        if (!post) return { ok: false };
        if (post.likedByMe && post.likeId) {
          /* 낙관적 취소 */
          state.rows = state.rows.filter(function (r) { return String(r[0]) !== String(post.likeId); });
          enqueue({ kind: 'remove', id: post.likeId, clientId: U.clientId() });
          commit();
          return { ok: true, liked: false };
        }
        var entity = meEntity({ type: '하트', id: U.uid(), clientId: U.clientId(), target: postId });
        pushRow(entity);
        commit();
        return { ok: true, liked: true };
      },

      /* 매너 한 줄 태그 (bm-v1.29.0) — 매칭이 성사된 1:1 대화방에서 경기 후 한 번.
       * 정해진 4종만(자유 입력 없음), 같은 상대에게는 하루 1회.
       * 새 칸 없이 '유형=매너 · 대상=상대 키 · 팀=태그 코드 · 좋아요=1'로 적습니다. */
      giveManner: function (otherKey, code) {
        var me = state.me || {};
        if (!me.key) return { ok: false, reason: 'no_login' };
        if (!otherKey || String(otherKey) === String(me.key)) return { ok: false, reason: 'no_target' };
        var tag = D.mannerTag(code);
        if (!tag) return { ok: false, reason: 'unknown' };
        if (!D.canChatWith(state.idx, me.key, otherKey)) return { ok: false, reason: 'not_allowed' };
        if (!tryLock('manner:' + otherKey, 1500)) return { ok: false, reason: 'locked' };
        if (D.mannerGivenToday(state.idx, me.key, otherKey)) {
          var sent = D.mannerToday(state.idx, me.key, otherKey);
          return { ok: false, reason: 'daily', label: (sent && sent.label) || '' };
        }
        pushRow(meEntity({
          type: D.MANNER_TYPE, id: U.uid(), clientId: U.clientId(), date: U.ymd(),
          target: String(otherKey), team: tag.code, likes: 1
        }));
        commit();
        return { ok: true, code: tag.code, label: tag.label };
      },

      addReply: function (postId, text) {
        text = D.clampText(text, 200).trim();
        if (!text) return { ok: false, reason: 'empty' };
        if (!tryLock('reply:' + postId, 900)) return { ok: false, reason: 'locked' };
        var entity = meEntity({
          type: '답글', date: U.ymd(), id: U.uid(), clientId: U.clientId(),
          target: postId, text: text
        });
        pushRow(entity);
        commit();
        return { ok: true };
      },

      /* 커뮤니티 글 올리기 — '게스트 모집'이면 모집 정보(언제·어디·몇 명)를 함께 담습니다.
       * 모집 정보를 비우면 일반 글과 똑같이 올라가고, 시트에는 말머리와 같이
       * '훈련계획' 칸의 JSON으로만 적습니다(26칸 호환).
       * bm-v1.39.1: 모집 칸(언제·몇 명·어디 체육관)만 채우고 본문 한 줄을 비워도 올라갑니다.
       *  모집 글은 모집 정보만으로도 성립하기 때문입니다(현장에서 급하게 올리는 경우).
       *  본문도 모집 칸도 비어 있으면 지금처럼 empty로 막습니다. */
      createPost: function (text, topic, meet) {
        /* 화면 입력칸(maxlength) 밖으로 들어온 아주 긴 글도 여기서 자릅니다 (bm-v1.41.1) */
        text = D.clampText(text, 300).trim();
        var tag = D.normalizeTopic(topic || state.ui.composerTopic);
        var mv = (tag === D.MEET.topic) ? D.normalizeMeet(meet || state.ui.composerMeet) : null;
        var hasMeet = D.meetFilled(mv);
        if (!text && !hasMeet) return { ok: false, reason: 'empty' };
        if (!tryLock('post', 1200)) return { ok: false, reason: 'locked' };
        var plan = { topic: tag };
        if (hasMeet) plan.meet = mv;
        var entity = meEntity({
          type: '소셜', date: U.ymd(), id: U.uid(), clientId: U.clientId(), text: text,
          plan: plan
        });
        pushRow(entity);
        state.ui.composer = '';
        state.ui.composerTopic = '자유';
        state.ui.composerMeet = { when: '', place: '', cap: '', fee: '' };
        commit();
        return { ok: true, topic: tag, meet: plan.meet || null };
      },

      /* ---------- 커뮤니티 내 글 삭제(취소) (bm-v1.40.1) ----------
       * 내가 쓴 글만 지웁니다. 화면에서는 한 번 더 확인한 뒤 부르고,
       * 일지 삭제(deleteLog)와 같은 방식으로 그 줄만 빼고 큐에 remove를 넣습니다.
       *  · 글에 달린 답글·하트도 같이 빠져야 빈 글을 가리키는 줄이 남지 않습니다.
       *    서버(Supabase RLS)는 내 행만 지울 수 있어서, 내가 쓴 답글·내 하트만
       *    서버 삭제를 보내고 남이 남긴 답글·하트는 이 기기 화면에서만 감춥니다
       *    (글 자체가 사라지면 그 답글은 어느 화면에도 뜨지 않습니다).
       *  · 모집 글 단체방을 열어 둔 채 지우면 대화도 닫습니다(글이 없으면 방도 없음). */
      deletePost: function (postId) {
        if (!postId) return { ok: false, reason: 'not_found' };
        var key = String(postId);
        var me = (state.me && state.me.key) || '';
        var post = (state.rows || []).map(function (r) { return Array.isArray(r) ? D.fromRow(r) : r; })
          .filter(function (r) { return String(r.id) === key; })[0];
        if (!post || (post.type && post.type !== '소셜')) return { ok: false, reason: 'not_found' };
        if (!me || String(post.userKey || '') !== String(me)) return { ok: false, reason: 'not_mine' };
        if (!tryLock('delpost:' + key, 1500)) return { ok: false, reason: 'locked' };

        /* 이 글에 달린 답글·하트·게스트 신청 (내 것 / 남의 것)
         * bm-v1.43.0 — 모집을 끝내면 그 글의 신청·수락·나가기 행도 함께 정리합니다.
         * (내가 남긴 행만 서버에서도 지우고, 남이 남긴 행은 이 기기 화면에서만 감춤) */
        var related = {};
        (state.rows || []).forEach(function (r) {
          var id = String(r[0]);
          if (id === key) return;
          var rec = Array.isArray(r) ? D.fromRow(r) : r;
          if (!rec) return;
          var mineRow = String(rec.userKey || '') === String(me);
          if ((rec.type === '답글' || rec.type === '하트') && String(rec.target || '') === key) {
            related[id] = mineRow;
          } else if (rec.type === D.GUEST.type && String(rec.team || '') === key) {
            related[id] = mineRow;
          }
        });
        state.rows = state.rows.filter(function (r) {
          var id = String(r[0]);
          return id !== key && !Object.prototype.hasOwnProperty.call(related, id);
        });

        /* 서버에는 내 글만 확실히 지웁니다(남의 행은 서버가 거절하므로 큐에 넣지 않음) */
        enqueue({ kind: 'remove', id: key, clientId: U.clientId() });
        Object.keys(related).forEach(function (id) {
          if (related[id]) enqueue({ kind: 'remove', id: id, clientId: U.clientId() });
        });

        /* 이 글의 단체방을 보고 있었다면 대화도 닫습니다 */
        if (state.ui && state.ui.chatRoom && String(state.ui.chatRoom) === key) {
          state.ui.chatRoom = null;
          state.ui.chatOther = '';
          state.ui.chatDraft = '';
          state.ui.chatOpen = false;
        }
        commit();
        return { ok: true, id: key, removed: 1 + Object.keys(related).length };
      },

      saveProfile: function (patch) {
        if (!tryLock('profile', 1200)) return { ok: false, reason: 'locked' };
        var me = state.me || {};
        var merged = {
          nick: patch.nick != null ? patch.nick : me.nick,
          level: patch.level != null ? patch.level : me.level,
          discipline: patch.discipline != null ? patch.discipline : me.discipline,
          bio: patch.bio != null ? patch.bio : (me.bio || ''),
          region: patch.region != null ? patch.region : (me.region || ''),
          club: patch.club != null ? patch.club : (me.club || ''),
          availability: patch.availability != null ? patch.availability : (me.availability || ''),
          experience: patch.experience != null ? patch.experience : (me.experience || ''),
          avatar: patch.avatar || (me.theme && me.theme.avatar) || '🏸',
          gender: patch.gender != null ? D.normalizeGender(patch.gender) : D.normalizeGender(me.gender),
          style: patch.style != null ? D.normalizeStyle(patch.style) : D.normalizeStyle(me.style || (me.theme && me.theme.style)),
          /* 사용자 유형(초보·동호인·선수·코치) — 넘기지 않으면 지금 것을 유지합니다 */
          role: patch.role != null ? D.normalizeRole(patch.role) : D.roleOf(me)
        };
        /* 꾸미기: 테마 + 아바타(사진·프레임·배경·배지). 넘기지 않은 값은 지금 것을 유지합니다. */
        var cur = D.avatarOf({ theme: me.theme });
        var deco = D.normalizeAvatar({
          avatarPhoto: patch.avatarPhoto != null ? patch.avatarPhoto : cur.photo,
          avatar: merged.avatar,
          avatarFrame: patch.avatarFrame != null ? patch.avatarFrame : cur.frame,
          avatarBg: patch.avatarBg != null ? patch.avatarBg : cur.bg,
          avatarBadge: patch.avatarBadge != null ? patch.avatarBadge : cur.badge
        });
        var theme = {
          theme: (me.theme && me.theme.theme) || 'th_night',
          avatar: deco.emoji,
          avatarPhoto: deco.photo,
          avatarFrame: deco.frame,
          avatarBg: deco.bg,
          avatarBadge: deco.badge,
          style: merged.style,
          role: merged.role
        };
        if (!theme.role) delete theme.role;
        var entity = {
          type: '프로필', id: U.uid(), clientId: U.clientId(), createdAt: U.stamp(),
          nick: merged.nick, level: merged.level, discipline: merged.discipline,
          userKey: me.key, bio: merged.bio, theme: theme
        };
        pushRow(entity);
        state.me = {
          key: me.key, nick: merged.nick, level: merged.level, discipline: merged.discipline,
          bio: merged.bio, region: merged.region, club: merged.club, gender: merged.gender,
          style: merged.style, role: merged.role,
          availability: merged.availability, experience: merged.experience, theme: theme
        };
        commit();
        return { ok: true };
      },

      saveMatchProfile: function (payload) {
        if (!tryLock('matchProfile', 1200)) return { ok: false, reason: 'locked' };
        var entity = meEntity({
          type: '매칭프로필', id: U.uid(), clientId: U.clientId(), nick: state.me.nick,
          payload: payload
        });
        pushRow(entity);
        commit();
        return { ok: true };
      },

      /* 1:1 매칭 요청 — 보낼 때는 '하트 2개를 가지고 있는지'만 확인하고,
       * 실제 차감은 상대가 수락할 때 보낸 사람(from) 원장에서 일어납니다.
       * 요청 행에 payOn:'accept' 를 적어 두면, 상대 기기에서 수락해도
       * 보낸 사람의 하트가 (행을 세는 원장 규칙으로) 바로 차감됩니다. */
      requestMatch: function (targetKey, note) {
        if (!tryLock('match:' + targetKey, 1500)) return { ok: false, reason: 'locked' };
        var balance = state.data.hearts.balance;
        var cost = D.HEART_RULES.MATCH_COST;
        var already = state.data.requests.some(function (r) {
          return r.userKey === (state.me && state.me.key) && r.target === targetKey && r.status !== '거절';
        });
        if (already) return { ok: false, reason: 'already' };
        if (balance < cost) return { ok: false, reason: 'hearts', need: cost - balance };
        var reqId = U.uid();
        var req = meEntity({
          type: '매칭신청', id: reqId, clientId: U.clientId(), date: U.ymd(),
          nick: state.me.nick, target: targetKey, status: '대기',
          payload: { note: D.clampText(note, 60).trim(), heartCost: cost, payOn: 'accept' }
        });
        pushRow(req);
        state.ui.chatRoom = reqId;
        commit();
        return { ok: true, roomId: reqId, cost: cost, balance: balance, chargeOnAccept: true };
      },

      /* 받은 요청 수락/거절 — 수락하면 보낸 사람 하트 2개가 이때 차감됩니다.
       * 보낸 사람이 그 사이 하트를 다 써서 2개보다 적으면, 있는 만큼만 차감하고
       * (거절도 아니고 마이너스도 아닌) 안전한 상태로 남깁니다. */
      respondMatch: function (reqId, status) {
        if (!tryLock('respond:' + reqId, 1200)) return { ok: false, reason: 'locked' };
        var req = (state.idx.byType['매칭신청'] || []).filter(function (r) { return r.id === reqId; })[0];
        if (!req) return { ok: false, reason: 'notfound' };
        /* 이미 답한 요청은 다시 처리하지 않습니다 (연타·두 기기에서 두 번 차감 방지) */
        if (req.status && req.status !== '대기') {
          return { ok: false, reason: 'done', status: req.status, roomId: reqId };
        }
        var payload = {};
        Object.keys(req.payload || {}).forEach(function (k) { payload[k] = req.payload[k]; });
        payload.status = status;
        var charged = 0, short = 0;
        if (status === '수락') {
          var cost = Number(payload.heartCost) || D.HEART_RULES.MATCH_COST;
          var senderBalance = req.userKey ? D.heartStatus(state.idx, req.userKey).balance : 0;
          charged = Math.max(0, Math.min(cost, senderBalance));
          short = Math.max(0, cost - charged);
          if (payload.payOn === 'accept') {
            payload.charged = charged;
            if (short) payload.short = short;
            else delete payload.short;
          } else {
            charged = 0;   /* 예전 요청은 보낼 때 이미 냈습니다(내하트사용 행) */
            short = 0;
          }
        }
        patchRowById(reqId, { '소셜글': JSON.stringify(payload), '승패': status });
        enqueue({ kind: 'update', id: reqId, clientId: U.clientId(), cells: { '소셜글': JSON.stringify(payload), '승패': status } });
        commit();
        return { ok: true, roomId: reqId, charged: charged, short: short };
      },

      /* ---------- 게스트 참여 신청 (bm-v1.43.0) ----------
       * 정원이 있는 모집 글은 바로 방에 들어가지 않고 신청 편지지를 보냅니다.
       * · 신청 → 글쓴이 수락/거절 → 정원 포함/제외 → 게스트 나가기(자리 남)
       * 행 하나(유형=게스트신청)에 '누가 누구에게'와 {kind, note} 만 적습니다.
       * (새 칸·새 표 없이 26칸 그대로 — js/domain.js guestStates 가 상태를 계산) */
      applyGuest: function (postId, note) {
        var me = state.me && state.me.key;
        if (!me) return { ok: false, reason: 'no_login' };
        var key = String(postId == null ? '' : postId);
        var post = state.idx.byId[key];
        if (!post || post.type !== '소셜') return { ok: false, reason: 'notfound' };
        if (String(post.userKey || '') === String(me)) return { ok: false, reason: 'mine' };
        if (!D.isGroupRoom(state.idx, key)) return { ok: false, reason: 'notfound' };
        var st = D.meetStatus(state.idx, post, me);
        if (st.closed) return { ok: false, reason: 'closed' };
        if (st.me.status === D.GUEST.pending || st.me.status === D.GUEST.accept) {
          return { ok: false, reason: st.me.status === D.GUEST.accept ? 'accepted' : 'pending', status: st.me.status };
        }
        if (!tryLock('guest:' + key, 1200)) return { ok: false, reason: 'locked' };
        var text = D.clampText(note, D.GUEST.noteMax).replace(/\s+/g, ' ').trim() || D.GUEST.noteDefault;
        pushRow(meEntity({
          type: D.GUEST.type, id: U.uid(), clientId: U.clientId(), date: U.ymd(),
          nick: state.me.nick, target: String(post.userKey || ''), team: key,
          payload: {
            kind: D.GUEST.apply, note: text, nick: state.me.nick,
            level: state.me.level || '', style: state.me.style || ''
          }
        }));
        commit();
        return { ok: true, postId: key, note: text };
      },

      /* 글쓴이의 수락/거절 — 신청 행 하나에 답합니다 (이미 답한 신청은 다시 처리 안 함) */
      respondGuest: function (appId, accept) {
        var me = state.me && state.me.key;
        if (!me) return { ok: false, reason: 'no_login' };
        var id = String(appId == null ? '' : appId);
        var req = state.idx.byId[id];
        if (!req || req.type !== D.GUEST.type || D.guestKind(req) !== D.GUEST.apply) {
          return { ok: false, reason: 'notfound' };
        }
        if (String(req.target || '') !== String(me)) return { ok: false, reason: 'not_mine' };
        var postId = String(req.team || '');
        var post = state.idx.byId[postId];
        if (!post || post.type !== '소셜') return { ok: false, reason: 'notfound' };
        var applicant = String(req.userKey || '');
        if (!applicant) return { ok: false, reason: 'notfound' };
        var st = D.guestState(state.idx, postId, applicant);
        if (st.status !== D.GUEST.pending) {
          return { ok: false, reason: 'done', status: st.status || '' };
        }
        if (accept && D.meetStatus(state.idx, post, me).closed) {
          return { ok: false, reason: 'full' };
        }
        if (!tryLock('guestres:' + id, 1200)) return { ok: false, reason: 'locked' };
        pushRow(meEntity({
          type: D.GUEST.type, id: U.uid(), clientId: U.clientId(), date: U.ymd(),
          nick: state.me.nick, target: applicant, team: postId,
          payload: {
            kind: accept ? D.GUEST.accept : D.GUEST.reject, app: id,
            nick: (req.payload && req.payload.nick) || req.nick || ''
          }
        }));
        commit();
        return { ok: true, accepted: !!accept, postId: postId, applicant: applicant };
      },

      /* 게스트의 나가기 — 참여/수락 상태를 끝내고 내 대화 목록에서 방을 뺍니다.
       * 자리가 비면 글은 다시 '모집 중'이 되어 커뮤니티에 올라옵니다(계산으로 자동). */
      leaveGuest: function (postId) {
        var me = state.me && state.me.key;
        if (!me) return { ok: false, reason: 'no_login' };
        var key = String(postId == null ? '' : postId);
        var post = state.idx.byId[key];
        if (!post || post.type !== '소셜') return { ok: false, reason: 'notfound' };
        if (String(post.userKey || '') === String(me)) return { ok: false, reason: 'owner' };
        if (!D.guestMember(state.idx, post, me)) return { ok: false, reason: 'not_member' };
        var st = D.guestState(state.idx, key, me);
        if (st.status === D.GUEST.leave) return { ok: false, reason: 'already' };
        if (!tryLock('guestleave:' + key, 1200)) return { ok: false, reason: 'locked' };
        pushRow(meEntity({
          type: D.GUEST.type, id: U.uid(), clientId: U.clientId(), date: U.ymd(),
          nick: state.me.nick, target: String(post.userKey || ''), team: key,
          payload: { kind: D.GUEST.leave, nick: state.me.nick }
        }));
        /* 보고 있던 방이면 대화 목록으로 돌아갑니다 (그 방은 목록에서도 사라짐) */
        if (state.ui && String(state.ui.chatRoom || '') === key) {
          state.ui.chatRoom = null;
          state.ui.chatOther = '';
          state.ui.chatDraft = '';
          state.ui.chatOpen = true;
        }
        commit();
        return { ok: true, postId: key };
      },

      sendChat: function (roomId, otherKey, text) {
        text = D.clampText(text, 300).trim();
        if (!text) return { ok: false, reason: 'empty' };
        if (!roomId) return { ok: false, reason: 'no_room' };
        /* 모집 글 단체방은 방 사람(글쓴이·수락된 게스트·예전 참여자)만 대화합니다.
         * v1.43.0 — 신청만 하고 수락 전인 사람은 아직 방 사람이 아닙니다.
         * 1:1 방은 지금처럼 친구·매칭(·코치) 상대와만. */
        var group = D.isGroupRoom(state.idx, roomId);
        if (group) {
          if (!(state.me && state.me.key)) return { ok: false, reason: 'no_login' };
          var gpost = D.groupPostOf(state.idx, roomId);
          if (gpost && D.guestBlocked(state.idx, gpost, state.me.key)) return { ok: false, reason: 'not_member' };
        } else {
          if (!otherKey) return { ok: false, reason: 'no_room' };
          if (!D.canChatWith(state.idx, state.me && state.me.key, otherKey)) {
            return { ok: false, reason: 'not_allowed' };
          }
        }
        if (!tryLock('chat:' + roomId, 450)) return { ok: false, reason: 'locked' };
        var entity = meEntity({
          type: '매칭채팅', id: U.uid(), clientId: U.clientId(), nick: state.me.nick,
          userKey: state.me.key, target: group ? '' : otherKey, team: roomId, text: text,
          createdAt: U.stamp()
        });
        pushRow(entity);
        state.ui.chatDraft = '';
        commit();
        return { ok: true, group: group };
      },

      /* ---------- 1:1 채팅(상단 DM) ---------- */
      openChats: function () {
        state.ui.chatOpen = true;
        state.ui.chatRoom = null;
        state.ui.chatDraft = '';
        emit();
      },

      closeChats: function () {
        state.ui.chatOpen = false;
        state.ui.chatRoom = null;
        state.ui.chatDraft = '';
        emit();
      },

      /* draft를 넘기면 입력창에 미리 적어 둡니다(사용자가 고쳐서 보냄).
       * 커뮤니티 '게스트 모집 참여 문의'가 이 자리로 바로 이어집니다. */
      openChat: function (roomId, otherKey, draft) {
        state.ui.chatOpen = true;
        state.ui.chatRoom = roomId || null;
        state.ui.chatOther = otherKey || '';
        state.ui.chatDraft = draft || '';
        emit();
      },

      /* 모집 글 단체방 열기 — 커뮤니티 '참여 문의'가 이리로 이어집니다.
       * 글 번호가 곧 방 번호이고, 처음 들어온 사람은 인사 문구가 미리 채워집니다. */
      openGroupChat: function (postId, draft) {
        var roomId = D.groupRoomId(postId);
        if (!D.isGroupRoom(state.idx, roomId)) return { ok: false, reason: 'notfound' };
        if (!(state.me && state.me.key)) return { ok: false, reason: 'no_login' };
        var gpost = D.groupPostOf(state.idx, roomId);
        /* v1.43.0 — 신청만 하고 수락 전인 사람은 방에 들어가지 않습니다 */
        if (gpost && D.guestBlocked(state.idx, gpost, state.me.key)) return { ok: false, reason: 'not_member' };
        state.ui.chatOpen = true;
        state.ui.chatRoom = roomId;
        state.ui.chatOther = '';
        state.ui.chatDraft = draft || '';
        emit();
        return { ok: true, roomId: roomId };
      },

      /* 코치와의 1:1 대화 — 프로필·매칭 없이도 코치 화면에서 바로 연결합니다.
       * draft를 넘기면 입력창에 미리 적어 두고(선수가 고쳐서 보냄) 바로 열립니다. */
      openCoachChat: function (coachKey, draft) {
        var me = state.me && state.me.key;
        if (!me) return { ok: false, reason: 'no_login' };
        if (!coachKey || coachKey === me) return { ok: false, reason: 'no_target' };
        /* 이미 친구·매칭으로 대화방이 있으면 그 방을 그대로 씁니다(같은 사람과 방 두 개 방지) */
        var existing = (state.data.threads || []).filter(function (t) {
          return t.other === coachKey && t.kind !== 'coach';
        })[0];
        state.ui.chatOpen = true;
        state.ui.chatRoom = existing ? existing.roomId : D.coachRoomId(me, coachKey);
        state.ui.chatOther = coachKey;
        state.ui.chatDraft = draft || '';
        emit();
        return { ok: true, roomId: state.ui.chatRoom };
      },

      closeChat: function () {
        state.ui.chatRoom = null;
        state.ui.chatDraft = '';
        emit();
      },

      markChatRead: function (roomId, otherKey) {
        if (!roomId) return { ok: false, reason: 'no_room' };
        var me = state.me && state.me.key;
        if (!me) return { ok: false, reason: 'no_login' };
        var group = D.isGroupRoom(state.idx, roomId);
        var thread = D.threadById(state.idx, me, roomId);
        /* 신청만 하고 수락 전인 사람은 방 읽음도 남기지 않습니다 (v1.43.0) */
        var gpost = group ? D.groupPostOf(state.idx, roomId) : null;
        if (gpost && D.guestBlocked(state.idx, gpost, me)) return { ok: false, reason: 'not_member' };
        /* 막 들어온 단체방은 아직 대화 목록에 없으므로 글에서 바로 셉니다.
         * 읽음 표시를 남기면 그때부터 내 대화 목록에도 방이 남습니다. */
        if (!thread && group) thread = D.groupThreadById(state.idx, me, roomId);
        /* 처음 여는 단체방은 대화가 없어도 '참여' 기록(읽음 표시)을 남겨 내 목록에 남깁니다 */
        var readMark = (state.idx.byType['채팅읽음'] || []).some(function (r) {
          return r.userKey === me && String(r.team || r.target || '') === String(roomId);
        });
        if (!thread || (!thread.unread && (readMark || !group))) return { ok: false, reason: 'read' };
        if (!tryLock('read:' + roomId, 1500)) return { ok: false, reason: 'locked' };
        var entity = meEntity({
          type: '채팅읽음', id: U.uid(), clientId: U.clientId(),
          target: group ? '' : (otherKey || thread.other), team: roomId, createdAt: U.stamp()
        });
        pushRow(entity);
        commit();
        return { ok: true };
      },

      /* ---------- 친구(친추) ---------- */
      sendFriendRequest: function (targetKey) {
        var me = state.me && state.me.key;
        if (!me) return { ok: false, reason: 'no_login' };
        if (!targetKey) return { ok: false, reason: 'no_target' };
        if (targetKey === me) return { ok: false, reason: 'self' };
        if (!tryLock('friendReq:' + targetKey, 1200)) return { ok: false, reason: 'locked' };
        var st = D.friendState(state.idx, me, targetKey);
        if (st.state === 'friends') return { ok: false, reason: 'already' };
        if (st.state === 'sent') return { ok: false, reason: 'sent' };
        if (st.state === 'received') return { ok: false, reason: 'received', requestId: st.requestId };
        var known = (state.idx.byType['프로필'] || []).some(function (p) { return p.userKey === targetKey; }) ||
          (state.idx.byType['매칭프로필'] || []).some(function (m) { return m.userKey === targetKey; });
        if (!known) return { ok: false, reason: 'no_target' };
        pushRow(meEntity({
          type: '친구요청', id: U.uid(), clientId: U.clientId(),
          nick: state.me.nick, target: targetKey
        }));
        commit();
        return { ok: true };
      },

      /* 친구 코드(#XXXX)로 친구 요청 — v1.38
       *  · 화면(친구 추가 시트)은 이 함수만 부릅니다. 닉네임 검색으로는 요청할 수 없습니다.
       *  · 코드가 없거나·잘못됐거나·내 코드면 보내지 않습니다.
       *  · 같은 코드를 쓰는 사람이 둘 이상이면(희박) 어느 쪽인지 고를 수 있게 목록을 돌려줍니다. */
      sendFriendRequestByCode: function (input) {
        var me = state.me && state.me.key;
        if (!me) return { ok: false, reason: 'no_login' };
        var found = D.friendCodeFind(state.idx, input);
        if (!found.code) return { ok: false, reason: 'bad_code' };
        var others = (found.matches || []).filter(function (u) { return u.key !== me; });
        if (!others.length) {
          return { ok: false, reason: found.matches.length ? 'self' : 'notfound', code: found.code };
        }
        if (others.length > 1) return { ok: false, reason: 'ambiguous', code: found.code, matches: others };
        var res = actions.sendFriendRequest(others[0].key);
        res.code = found.code;
        res.target = others[0];
        return res;
      },

      respondFriendRequest: function (requestId, accept) {
        var me = state.me && state.me.key;
        if (!me) return { ok: false, reason: 'no_login' };
        var req = (state.idx.byType['친구요청'] || []).filter(function (r) {
          return String(r.id) === String(requestId) && r.target === me;
        })[0];
        if (!req) return { ok: false, reason: 'notfound' };
        if (!tryLock('friendRes:' + requestId, 1200)) return { ok: false, reason: 'locked' };
        var st = D.friendState(state.idx, me, req.userKey);
        if (st.state === 'friends') return { ok: false, reason: 'already' };
        if (st.state !== 'received') return { ok: false, reason: 'notfound' };
        pushRow(meEntity({
          type: accept ? '친구수락' : '친구거절', id: U.uid(), clientId: U.clientId(),
          nick: state.me.nick, target: req.userKey
        }));
        commit();
        return { ok: true, accepted: !!accept };
      },

      removeFriend: function (targetKey) {
        var me = state.me && state.me.key;
        if (!me || !targetKey) return { ok: false, reason: 'no_target' };
        if (!tryLock('friendDel:' + targetKey, 1200)) return { ok: false, reason: 'locked' };
        if (D.friendState(state.idx, me, targetKey).state !== 'friends') {
          return { ok: false, reason: 'not_friends' };
        }
        pushRow(meEntity({
          type: '친구삭제', id: U.uid(), clientId: U.clientId(),
          nick: state.me.nick, target: targetKey
        }));
        commit();
        return { ok: true };
      },

      /* 출석 체크: 하루 1회 +1 · 7일 연속을 채운 날은 보너스 +2 (bm-v1.36.0)
       *  · 보너스는 출석 행에 얹지 않고 원장(js/domain.js heartLedger)이 날짜 연속에서
       *    매번 다시 셉니다 — 앱을 다시 열거나 다른 기기에서도 같은 잔액이 되게(멱등).
       *    행에는 보너스를 받은 날이라는 메모만 남깁니다. */
      checkIn: function () {
        if (!tryLock('checkin', 1500)) return { ok: false, reason: 'locked' };
        var status = state.data.hearts || {};
        if (status.checkedInToday) return { ok: false, reason: 'done' };
        var me = state.me && state.me.key;
        var streak = (me ? D.checkinStreak(state.idx, me) : 0) + 1;
        var bonus = (streak % 7 === 0) ? Math.max(0, D.HEART_RULES.STREAK_7_BONUS || 0) : 0;
        var entity = meEntity({
          type: '출석하트', id: U.uid(), clientId: U.clientId(), date: U.ymd(),
          likes: D.HEART_RULES.CHECKIN,
          text: bonus ? '7일 연속 출석 보너스 +' + bonus : ''
        });
        pushRow(entity);
        commit();
        return {
          ok: true, gained: D.HEART_RULES.CHECKIN + bonus, base: D.HEART_RULES.CHECKIN,
          bonus: bonus, streak: streak, balance: state.data.hearts.balance
        };
      },

      /* 보상형 광고 시청: 하루 5회, 30초 간격, 같은 시청 건은 한 번만 (bm-v1.36.0)
       *  · opts.txId 가 오면 그 ID를 '광고하트' 행 메모에 'tx:…' 로 남기고,
       *    같은 ID가 이미 있으면 duplicate 로 막습니다(광고 SDK 콜백이 두 번 와도 한 번만 적립).
       *  · 실제 광고는 앱(iOS/Android WebView)에서 재생하고, 다 본 뒤에 이 함수를 부릅니다.
       * 광고 SDK 콜백 → BM.app.ctx.store.actions.watchAd() */
      watchAd: function (opts) {
        opts = opts || {};
        var me = state.me && state.me.key;
        var txId = D.cleanTxId ? D.cleanTxId(opts.txId) : '';
        /* 중복은 시각과 상관없는 조건이라 잠금보다 먼저 봅니다 */
        if (txId && me && D.adTxSeen(state.idx, me, txId)) {
          return { ok: false, reason: 'duplicate', txId: txId, balance: (state.data.hearts || {}).balance || 0 };
        }
        if (!tryLock('ad', 1200)) return { ok: false, reason: 'locked' };
        var status = state.data.hearts || {};
        /* 실제 앱 연동 시: 광고 SDK의 '시청 완료(verified)' 신호가 없으면 적립하지 않도록
         * 여기서 막는 것을 권장합니다. 프로토타입은 서버가 한도·간격을 다시 검사합니다. */
        if (status.adUsedToday >= D.HEART_RULES.AD_PER_DAY) {
          return { ok: false, reason: 'limit', limit: D.HEART_RULES.AD_PER_DAY, remaining: 0 };
        }
        if (status.nextAdInSec > 0) {
          return { ok: false, reason: 'cooldown', retryAfter: status.nextAdInSec };
        }
        var entity = meEntity({
          type: '광고하트', id: U.uid(), clientId: U.clientId(), date: U.ymd(),
          likes: D.HEART_RULES.AD_REWARD, target: opts.adUnit || '',
          text: txId ? D.adTxNote(txId) : ''
        });
        pushRow(entity);
        commit();
        var after = state.data.hearts || {};
        return {
          ok: true, gained: D.HEART_RULES.AD_REWARD, txId: txId,
          remaining: after.adRemaining, balance: after.balance,
          nextAdInSec: D.HEART_RULES.AD_COOLDOWN_SEC
        };
      },

      /* 하트 선물: 보낸 사람 -1, 받는 사람 +1 (같은 행이 양쪽 원장에 반영) */
      giftHeart: function (targetKey, note) {
        if (!targetKey) return { ok: false, reason: 'no_target' };
        if (targetKey === (state.me && state.me.key)) return { ok: false, reason: 'self' };
        if (!tryLock('gift:' + targetKey, 1500)) return { ok: false, reason: 'locked' };
        var known = (state.idx.byType['프로필'] || []).some(function (p) { return p.userKey === targetKey; }) ||
          (state.idx.byType['매칭프로필'] || []).some(function (m) { return m.userKey === targetKey; });
        if (!known) return { ok: false, reason: 'no_target' };
        var status = state.data.hearts || {};
        if (status.balance < D.HEART_RULES.GIFT_COST) {
          return { ok: false, reason: 'hearts', need: D.HEART_RULES.GIFT_COST - status.balance };
        }
        var entity = meEntity({
          type: '선물하트', id: U.uid(), clientId: U.clientId(), date: U.ymd(),
          target: targetKey, likes: D.HEART_RULES.GIFT_COST, text: D.clampText(note, 60).trim()
        });
        pushRow(entity);
        commit();
        return { ok: true, spent: D.HEART_RULES.GIFT_COST, balance: state.data.hearts.balance };
      },

      /* 테마 적용: 무료/이미 산 테마는 바로, 처음 사는 유료 테마는 하트 차감 */
      setTheme: function (themeId) {
        var me = state.me || {};
        if (!tryLock('theme:' + themeId, 900)) return { ok: false, reason: 'locked' };
        var def = D.themeById(themeId);
        if (!def) return { ok: false, reason: 'unknown_theme' };
        var owned = D.ownsTheme(state.idx, me.key, themeId);
        var price = D.themePrice(themeId);
        var status = state.data.hearts || {};
        var purchased = false;

        if (!owned) {
          if (status.balance < price) {
            return { ok: false, reason: 'hearts', need: price - status.balance, price: price };
          }
          pushRow(meEntity({
            type: '꾸미기구매', id: U.uid(), clientId: U.clientId(), date: U.ymd(),
            target: themeId, likes: price, nick: me.nick
          }));
          purchased = true;
        }

        /* 테마를 바꿔도 사진·프레임·배지·플레이 스타일은 그대로 남깁니다 */
        var cur = D.avatarOf({ theme: me.theme });
        var theme = {
          theme: themeId, avatar: cur.emoji, avatarPhoto: cur.photo,
          avatarFrame: cur.frame, avatarBg: cur.bg, avatarBadge: cur.badge,
          style: D.normalizeStyle(me.style || (me.theme && me.theme.style)),
          role: D.roleOf(me)
        };
        if (!theme.role) delete theme.role;
        pushRow({
          type: '프로필', id: U.uid(), clientId: U.clientId(), createdAt: U.stamp(),
          nick: me.nick, level: me.level, discipline: me.discipline, userKey: me.key,
          bio: me.bio, theme: theme
        });
        state.me.theme = theme;
        commit();
        return { ok: true, purchased: purchased, price: purchased ? price : 0, balance: state.data.hearts.balance };
      },

      decideCoachApp: function (rowId, status) {
        if (!D.isAdminMe(state.me)) return { ok: false, reason: 'forbidden' };
        if (status !== '승인' && status !== '거절') return { ok: false, reason: 'bad_status' };
        if (!tryLock('coach:' + rowId, 1200)) return { ok: false, reason: 'locked' };
        var app = (state.idx.byType['코치신청'] || []).filter(function (a) { return a.id === rowId; })[0];
        if (!app) return { ok: false, reason: 'notfound' };
        var payload = {};
        Object.keys(app.payload || {}).forEach(function (k) { payload[k] = app.payload[k]; });
        payload.status = status;
        payload.decided = U.stamp();
        payload.decidedBy = state.me && state.me.key;
        /* 낙관적 반영 */
        patchRowById(rowId, { '소셜글': JSON.stringify(payload), '승패': status });
        enqueue({ kind: 'update', id: rowId, clientId: U.clientId(), cells: { '소셜글': JSON.stringify(payload), '승패': status } });
        commit();
        return { ok: true };
      },

      /* ---------- 멘토 신청 · 심사 (관리자만) ----------
       * 일반 사용자가 신청하면 '대상'이 관리자로 기록되고, 화면에는
       * '관리자에게 전달되었습니다 (심사중)'만 보입니다.
       * 승인/거절은 관리자 계정에서만 가능합니다.
       * bm-v1.45.0 — 구분(개인 멘토·체육관 코치·선수 코치·클럽 운영)과
       *  활동 소속(affiliation) · 증명(글/링크/사진)을 함께 받습니다.
       *  '체육관 코치'·'선수 코치' 는 소속과 증명이 없으면 신청되지 않습니다. */
      requestMentor: function (input) {
        input = input || {};
        var me = state.me || {};
        if (!me.key) return { ok: false, reason: 'no_login' };
        var reason = String(input.reason || input.intro || '').trim();
        if (!reason) return { ok: false, reason: 'empty' };
        var mtype = D.mentorTypeOf(input.type);
        var affiliation = D.cleanAffiliation(input.affiliation);
        var proof = D.cleanProofText(input.proof);
        var proofUrl = D.cleanProofUrl(input.proofUrl);
        var proofPhoto = D.cleanProofPhoto(input.proofPhoto);
        /* 주소·사진이 적혔는데 걸러졌으면 조용히 지우지 않고 알려 줍니다 */
        if (String(input.proofUrl || '').trim() && !proofUrl) return { ok: false, reason: 'bad_url' };
        if (String(input.proofPhoto || '').trim() && !proofPhoto) return { ok: false, reason: 'bad_photo' };
        if (D.mentorNeedsProof(mtype)) {
          if (!affiliation) return { ok: false, reason: 'need_affiliation' };
          if (!(proof || proofUrl || proofPhoto)) return { ok: false, reason: 'need_proof' };
        }
        if (!tryLock('mentor:' + me.key, 2000)) return { ok: false, reason: 'locked' };
        var pending = D.mentorApplications(state.idx, me.key, false)
          .filter(function (a) { return a.status === '심사중'; })[0];
        if (pending) return { ok: false, reason: 'pending' };
        var mp = D.matchProfileOf(state.idx, me.key);
        var payload = {
          status: '심사중',
          submitted: U.stamp(),
          type: mtype,
          affiliation: affiliation,
          experience: input.experience || '',
          awards: input.awards || '',
          proof: proof,
          proofUrl: proofUrl,
          proofPhoto: proofPhoto,
          reason: reason,
          intro: reason,
          level: input.level || me.level || '',
          discipline: input.discipline || me.discipline || '',
          gender: D.normalizeGender(input.gender || mp.gender),
          region: input.region || mp.region || '',
          club: input.club || mp.club || ''
        };
        pushRow(meEntity({
          type: '멘토신청', id: U.uid(), clientId: U.clientId(), date: U.ymd(),
          nick: me.nick, target: D.ADMIN_TARGET, payload: payload
        }));
        commit();
        return { ok: true, status: '심사중' };
      },

      decideMentor: function (appId, status) {
        if (!D.isAdminMe(state.me)) return { ok: false, reason: 'forbidden' };
        if (status !== '승인' && status !== '거절') return { ok: false, reason: 'bad_status' };
        if (!tryLock('mentorDecide:' + appId, 1500)) return { ok: false, reason: 'locked' };
        var row = (state.idx.byType['멘토신청'] || []).concat(state.idx.byType['코치신청'] || [])
          .filter(function (r) { return String(r.id) === String(appId); })[0];
        if (!row) return { ok: false, reason: 'notfound' };
        var current = row.status || (row.payload && row.payload.status) || '심사중';
        if (current !== '심사중') return { ok: false, reason: 'done' };
        var payload = {};
        Object.keys(row.payload || {}).forEach(function (k) { payload[k] = row.payload[k]; });
        payload.status = status;
        payload.decided = U.stamp();
        payload.decidedBy = (state.me && state.me.nick) || '관리자';
        patchRowById(row.id, { '소셜글': JSON.stringify(payload), '승패': status });
        enqueue({ kind: 'update', id: row.id, clientId: U.clientId(), cells: { '소셜글': JSON.stringify(payload), '승패': status } });
        /* 심사 기록 (브리지는 관리자 세션만 '멘토승인'/'멘토거절'을 허용) */
        pushRow(meEntity({
          type: status === '승인' ? '멘토승인' : '멘토거절',
          id: U.uid(), clientId: U.clientId(), date: U.ymd(),
          nick: state.me && state.me.nick, target: row.userKey, team: row.id
        }));
        commit();
        return { ok: true, status: status };
      },

      /* ---------- 커뮤니티 샘플 글 정리 ----------
       * 예전 앱이 커뮤니티에 남긴 샘플 글·답글·하트를 실제로 지웁니다.
       * (사용자가 직접 쓴 글은 본문이 달라서 건드리지 않습니다.) */
      purgeSampleCommunity: function () {
        var removed = purgeSamples();
        if (removed) commit();
        return { ok: true, removed: removed };
      },

      sendCoachFeedback: function (input) {
        input = input || {};
        var text = (input.text || '').trim();
        if (!text) return { ok: false, reason: 'empty' };
        if (!D.isAdminMe(state.me) && !actions.isCoach()) return { ok: false, reason: 'forbidden' };
        if (!tryLock('feedback', 1200)) return { ok: false, reason: 'locked' };
        var entity = meEntity({
          type: '코치피드백', id: U.uid(), clientId: U.clientId(), date: U.ymd(),
          nick: state.me.nick, target: input.playerKey,
          payload: {
            recordId: input.recordId || '', rating: input.rating || 0,
            feedback: text, drills: input.drills || [], coach: state.me.nick, at: U.stamp()
          }
        });
        pushRow(entity);
        commit();
        return { ok: true };
      },

      saveMemo: function (date, text) {
        text = (text || '').trim();
        if (!text) return { ok: false, reason: 'empty' };
        if (!tryLock('memo', 900)) return { ok: false, reason: 'locked' };
        pushRow(meEntity({ type: '달력메모', id: U.uid(), clientId: U.clientId(), date: date, nick: state.me.nick, text: text }));
        commit();
        return { ok: true };
      },

      /* 코치 권한: 승인된 코치신청이 있으면 true */
      isCoach: function () {
        var me = state.me && state.me.key;
        return (state.idx.byType['코치신청'] || []).some(function (a) {
          return a.userKey === me && (a.status === '승인');
        });
      },

      /* 관리자: 관리자 계정(ADMIN_EMAILS)으로 로그인했을 때만 true */
      isAdmin: function () { return D.isAdminMe(state.me); },

      setFilter: function (patch) {
        Object.keys(patch).forEach(function (k) { state.ui.matchFilter[k] = patch[k]; });
        /* 한 조건이라도 고르면 그 순간부터 선수 목록을 보여 줍니다 */
        state.ui.matchStarted = true;
        emit();
      },

      setMatchQuery: function (query) {
        var q = String(query == null ? '' : query);
        state.ui.matchFilter.query = q;
        if (q.trim()) state.ui.matchStarted = true;
        else if (!D.activeFilters(state.ui.matchFilter).length) state.ui.matchStarted = false;
        emit();
      },

      /* 매칭 화면: 찾기/받은 요청/보낸 요청/대화 탭 */
      setMatchTab: function (tab) {
        var allowed = { find: 1, 'in': 1, out: 1, chat: 1 };
        state.ui.matchTab = allowed[tab] ? tab : 'find';
        emit();
      },

      /* 매칭 정렬: 궁합순 / 최근순 */
      setMatchSort: function (sort) {
        state.ui.matchSort = sort === 'recent' ? 'recent' : 'score';
        emit();
      },

      /* 필터 줄 펼치기/접기 (빈 값이면 모두 접힘) */
      setFilterPanel: function (key) {
        state.ui.matchFilterOpen = state.ui.matchFilterOpen === key ? '' : (key || '');
        emit();
      },

      /* '전체' — 조건은 모두 풀고, 전체가 선택된 상태로 모든 선수를 보여 줍니다 */
      resetMatchFilter: function () {
        state.ui.matchFilter = { level: '', gender: '', region: '', discipline: '', query: '' };
        state.ui.matchStarted = true;
        state.ui.matchFilterOpen = '';
        emit();
      },

      /* 조건 초기화 — 다시 '아무것도 고르지 않은' 처음 화면으로 돌아갑니다 */
      clearMatchFilter: function () {
        state.ui.matchFilter = { level: '', gender: '', region: '', discipline: '', query: '' };
        state.ui.matchStarted = false;
        state.ui.matchFilterOpen = '';
        emit();
      },

      setCoachPlayer: function (key) { state.ui.coachPlayer = key; emit(); },
      setCoachTab: function (tab) { state.ui.coachTab = tab; emit(); },
      setComposer: function (text) { state.ui.composer = text; emit(); },
      setComposerTopic: function (topic) { state.ui.composerTopic = D.normalizeTopic(topic); emit(); },
      /* 주간 약점 챌린지 3회 달성 → 커뮤니티 글쓰기로 한 번에 (bm-v1.32.0)
       * 글은 여기서 올리지 않습니다. 문구·말머리만 채워 두고 화면만 옮겨,
       * 올릴지는 사람이 '올리기'로 정합니다. */
      startChallengeShare: function (text, topic) {
        var body = String(text == null ? '' : text);
        state.ui.composer = body;
        state.ui.composerTopic = D.normalizeTopic(topic || '일지');
        state.ui.tab = 'community';
        emit();
        return { ok: true, text: body, topic: state.ui.composerTopic };
      },

      /* 주간 약점 챌린지 자랑 초안 (bm-v1.36.0)
       *  · 이번 주(또는 오늘) 함께 친 파트너의 전적을 문구에 자연스럽게 붙입니다.
       *    예) '이번 주 헤어핀 3회 연습 달성! (조환비와 2경기 2승) 🎉'
       *  · 3회를 아직 채우지 않았으면 not_done (화면은 그대로 '채우면 자랑할 수 있어요').
       *  · 글은 여기서 채우기만 하고 올리기는 사람이 누릅니다. */
      challengeShareDraft: function (opts) {
        opts = opts || {};
        var records = (state.data && state.data.records) || [];
        var now = opts.now || (state.ui && state.ui.challengeNow) || null;
        var ch = D.weekChallenge(records, now ? { now: now } : {});
        if (!ch || !ch.active || !ch.done) return { ok: false, reason: 'not_done', challenge: ch };
        var partner = D.challengePartner(records, ch, now ? { now: now } : {});
        var text = D.challengeShareText(ch, { records: records, now: now || '' });
        return { ok: true, text: text, partner: partner, challenge: ch };
      },
      /* 게스트 모집 입력칸 — 글자마다 화면을 다시 그리면 포커스가 끊기므로 저장만 합니다 */
      setComposerMeet: function (field, value) {
        if (field !== 'when' && field !== 'place' && field !== 'cap' && field !== 'fee') return;
        var cur = state.ui.composerMeet || {};
        var next = D.normalizeMeet(cur);
        next[field] = value;
        state.ui.composerMeet = D.normalizeMeet(next);
      },

      retrySync: function () { return flush(); },

      resetDemo: function () {
        if (!apiRef.resetDemo) return Promise.resolve();
        return apiRef.resetDemo().then(function () {
          state.queue = []; persistQueue();
          return actions.init();
        });
      },

      /* 계정 삭제(탈퇴): 시트(서버)의 내 기록을 지우고 화면 상태도 비웁니다.
       * 실패하면 아무것도 지우지 않고 오류를 그대로 돌려줍니다(부분 삭제 방지). */
      deleteAccount: function () {
        var api = apiRef;
        if (!api || !api.deleteAccount) return Promise.resolve({ ok: true, removed: 0 });
        return api.deleteAccount().then(function (res) {
          if (res && res.ok === false) return res;
          state.rows = [];
          state.queue = []; persistQueue();
          state.analysis = null;
          state.syncState = 'idle';
          recompute();
          emit();
          return res || { ok: true, removed: 0 };
        });
      },

      /* 테스트/디버그용 */
      _state: function () { return state; },
      _flush: function () { return flush(); },
      _api: function () { return apiRef; },
      _replaceApi: function (next) {
        actions.stopListening();
        apiRef = next;
        state.mode = next.mode;
      },

      /* ---------- v1.24: 실시간 구독 (Supabase postgres_changes) ----------
       * 상대가 새 메시지·1:1 요청를 보내면 WebSocket 이 먼저 알려 줍니다.
       * 45초 폴링을 기다리지 않고 바로 화면과 상단 배너에 반영합니다.
       * (끊기면 어댑터가 스스로 다시 붙고, 그동안은 폴링이 메꿉니다) */
      listen: function () {
        if (realtimeSub || !apiRef || typeof apiRef.subscribe !== 'function') return false;
        var sub = apiRef.subscribe(function (change) { applyRemoteChange(change); }, function (status) {
          if (state.realtime === status) return;
          state.realtime = status;
          emit();
        });
        if (!sub) return false;
        realtimeSub = sub;
        state.realtime = 'live';
        return true;
      },
      stopListening: function () {
        if (realtimeSub && realtimeSub.close) { try { realtimeSub.close(); } catch (e) { /* 무시 */ } }
        realtimeSub = null;
        if (remoteRefresh && typeof clearTimeout === 'function') { clearTimeout(remoteRefresh); remoteRefresh = null; }
        if (state.realtime !== 'off') { state.realtime = 'off'; }
      }
    };

    /* ---------- 실시간으로 받은 행 반영 ----------
     * 1) 새 행(INSERT)이면 화면 상태에 바로 넣고 알림 배너까지 띄웁니다.
     * 2) 내가 이미 가진 행이면(=내가 보낸 메시지·재전송) 두 번 넣지 않습니다.
     * 3) 다른 기기의 수정·삭제(겹쳐 읽는 '수정'·'삭제' 행)는 전체를 다시 받아 맞춥니다. */
    var realtimeSub = null;
    var remoteRefresh = null;

    function scheduleRemoteRefresh() {
      if (remoteRefresh && typeof clearTimeout === 'function') clearTimeout(remoteRefresh);
      remoteRefresh = setTimeout(function () {
        remoteRefresh = null;
        actions.poll();
      }, 250);
    }

    function remoteCells(record) {
      try {
        if (apiRef && typeof apiRef.recordToRow === 'function') return apiRef.recordToRow(record);
        if (BM.api && BM.api.recordToRow) return BM.api.recordToRow(record);
      } catch (e) { /* 아래에서 무시 */ }
      return null;
    }

    function applyRemoteChange(change) {
      if (!state.ready || !change || !change.record) return;
      var type = String(change.record.type || '');
      if (type === '수정' || type === '삭제' || change.type === 'DELETE') { scheduleRemoteRefresh(); return; }
      var cells = remoteCells(change.record);
      if (!cells || !cells[0]) return;
      var id = String(cells[0]);
      for (var i = 0; i < state.rows.length; i++) {
        if (String(state.rows[i][0]) !== id) continue;
        if (change.type !== 'UPDATE') return;        /* 이미 가진 행 */
        state.rows[i] = cells;
        recompute();
        emit();
        return;
      }
      state.rows.unshift(cells);
      var since = state.notifySince || U.stamp();
      state.notifySince = U.stamp();
      state.lastSync = state.notifySince;
      recompute();
      var fresh = D.newIncoming(state.idx, state.me && state.me.key, since);
      if (fresh && fresh.total) {
        state.inbox = {
          messages: fresh.messages, requests: fresh.requests, friendRequests: fresh.friendRequests,
          total: fresh.total, at: state.notifySince
        };
      }
      emit();
    }

    function subscribe(fn) {
      subs.push(fn);
      return function () { subs = subs.filter(function (s) { return s !== fn; }); };
    }

    return { state: state, actions: actions, subscribe: subscribe, derive: derive, flush: flush };
  }

  BM.store = { createStore: createStore, derive: derive, AD_DAILY_LIMIT: AD_DAILY_LIMIT };
})(typeof globalThis !== 'undefined' ? globalThis : this);
