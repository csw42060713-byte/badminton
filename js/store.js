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
      text: p.text, createdAt: p.createdAt, date: p.date,
      likes: Math.max(likeCount, p.likes || 0),
      likedByMe: !!(likeSets[p.id] && likeSets[p.id][me]),
      likeId: likeSets[p.id] && likeSets[p.id][me],
      replies: rs.map(function (r) {
        return { id: r.id, nick: r.nick || D.displayName(idx, r.userKey), userKey: r.userKey, text: r.text, createdAt: r.createdAt };
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
      ui: {
        tab: 'log',
        matchFilter: { level: '전체', gender: '전체', region: '전체', discipline: '전체', query: '' },
        chatRoom: null, chatOpen: false, coachTab: '', coachPlayer: null, composer: '', replyTo: null
      },
      analysis: null,
      queue: U.readJSON(QUEUE_KEY, []),
      locks: {},
      syncError: null,
      syncState: 'idle',
      lastSync: null,
      stats: { writes: 0, blocked: 0, failed: 0 }
    };
    var subs = [];
    var flushing = false;
    var apiRef = api;

    function defaultDraft() {
      return {
        date: U.ymd(), cond: 6, intensity: 6, minutes: 60,
        done: ['스트록', '게임'], score: { a: 21, b: 18 }, result: '승',
        pain: [], weakness: [], note: ''
      };
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

    /* ---------- 잠금(연타 방지) ---------- */
    function tryLock(key, ttl) {
      var now = Date.now();
      var until = state.locks[key] || 0;
      if (until > now) { state.stats.blocked++; return false; }
      state.locks[key] = now + (ttl || 900);
      return true;
    }

    /* ---------- 큐 ---------- */
    function persistQueue() { U.writeJSON(QUEUE_KEY, state.queue); }

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
          state.lastSync = res.syncedAt || U.stamp();
          purgeSamples();
          U.writeJSON(CACHE_KEY, { rows: state.rows, me: state.me, at: state.lastSync });
          U.writeJSON(MODE_KEY, state.mode);
          recompute();
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
            state.syncError = (err && err.message) || '오프라인 상태예요.';
            recompute();
            emit();
          }
          return state;
        });
      },

      reload: function () { return apiRef.bootstrap().then(function (res) {
        state.me = normalizeMe(res.me);
        state.rows = res.rows || [];
        recompute();
        emit();
      }); },

      setTab: function (tab) {
        state.ui.tab = tab; emit();
      },

      setDraft: function (patch) {
        Object.keys(patch).forEach(function (k) { state.drafts.log[k] = patch[k]; });
        state.analysis = null;
        emit();
      },

      resetDraft: function () {
        state.drafts.log = defaultDraft();
        state.analysis = null;
        emit();
      },

      analyze: function () {
        var d = state.drafts.log;
        state.analysis = BM.ai.analyze({
          draft: d, records: state.data.records, level: (state.me && state.me.level) || d.level, nick: state.me && state.me.nick
        });
        emit();
        return state.analysis;
      },

      saveLog: function (opts) {
        opts = opts || {};
        if (!tryLock('log', 1200)) return { ok: false, reason: 'locked' };
        var d = JSON.parse(JSON.stringify(state.drafts.log));
        var an = BM.ai.analyze({ draft: d, records: state.data.records, level: (state.me && state.me.level) || d.level, nick: state.me && state.me.nick });
        var entity = meEntity({
          type: '기록',
          date: d.date || U.ymd(),
          id: U.uid(),
          clientId: U.clientId(),
          cond: d.cond, intensity: d.intensity, minutes: d.minutes,
          done: d.done, score: d.score,
          result: d.result || D.resultFromScore(d.score),
          pain: d.pain, weakness: d.weakness,
          prescription: an.care, drills: an.drills
        });
        if (d.note) entity.text = d.note;          /* 메모는 소셜글 칸에 남깁니다 */
        pushRow(entity);
        state.analysis = an;
        state.ui.tab = 'log';
        commit();
        if (opts.keepDraft !== true) state.drafts.log = defaultDraft();
        return { ok: true, entity: entity, analysis: an };
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

      addReply: function (postId, text) {
        text = (text || '').trim();
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

      createPost: function (text) {
        text = (text || '').trim();
        if (!text) return { ok: false, reason: 'empty' };
        if (!tryLock('post', 1200)) return { ok: false, reason: 'locked' };
        var entity = meEntity({
          type: '소셜', date: U.ymd(), id: U.uid(), clientId: U.clientId(), text: text
        });
        pushRow(entity);
        state.ui.composer = '';
        commit();
        return { ok: true };
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
          gender: patch.gender != null ? D.normalizeGender(patch.gender) : D.normalizeGender(me.gender)
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
          avatarBadge: deco.badge
        };
        var entity = {
          type: '프로필', id: U.uid(), clientId: U.clientId(), createdAt: U.stamp(),
          nick: merged.nick, level: merged.level, discipline: merged.discipline,
          userKey: me.key, bio: merged.bio, theme: theme
        };
        pushRow(entity);
        state.me = {
          key: me.key, nick: merged.nick, level: merged.level, discipline: merged.discipline,
          bio: merged.bio, region: merged.region, club: merged.club, gender: merged.gender,
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
          payload: { note: note || '', heartCost: cost }
        });
        pushRow(req);
        pushRow(meEntity({
          type: '내하트사용', id: U.uid(), clientId: U.clientId(), date: U.ymd(),
          nick: state.me.nick, target: targetKey, likes: cost
        }));
        state.ui.chatRoom = reqId;
        commit();
        return { ok: true, roomId: reqId };
      },

      respondMatch: function (reqId, status) {
        if (!tryLock('respond:' + reqId, 1200)) return { ok: false, reason: 'locked' };
        var req = (state.idx.byType['매칭신청'] || []).filter(function (r) { return r.id === reqId; })[0];
        if (!req) return { ok: false, reason: 'notfound' };
        var payload = {};
        Object.keys(req.payload || {}).forEach(function (k) { payload[k] = req.payload[k]; });
        payload.status = status;
        patchRowById(reqId, { '소셜글': JSON.stringify(payload), '승패': status });
        enqueue({ kind: 'update', id: reqId, clientId: U.clientId(), cells: { '소셜글': JSON.stringify(payload), '승패': status } });
        commit();
        return { ok: true, roomId: reqId };
      },

      sendChat: function (roomId, otherKey, text) {
        text = (text || '').trim();
        if (!text) return { ok: false, reason: 'empty' };
        if (!roomId || !otherKey) return { ok: false, reason: 'no_room' };
        if (!D.canChatWith(state.idx, state.me && state.me.key, otherKey)) {
          return { ok: false, reason: 'not_allowed' };
        }
        if (!tryLock('chat:' + roomId, 450)) return { ok: false, reason: 'locked' };
        var entity = meEntity({
          type: '매칭채팅', id: U.uid(), clientId: U.clientId(), nick: state.me.nick,
          userKey: state.me.key, target: otherKey, team: roomId, text: text,
          createdAt: U.stamp()
        });
        pushRow(entity);
        commit();
        return { ok: true };
      },

      /* ---------- 1:1 채팅(상단 DM) ---------- */
      openChats: function () {
        state.ui.chatOpen = true;
        state.ui.chatRoom = null;
        emit();
      },

      closeChats: function () {
        state.ui.chatOpen = false;
        state.ui.chatRoom = null;
        emit();
      },

      openChat: function (roomId, otherKey) {
        state.ui.chatOpen = true;
        state.ui.chatRoom = roomId || null;
        state.ui.chatOther = otherKey || '';
        emit();
      },

      closeChat: function () {
        state.ui.chatRoom = null;
        emit();
      },

      markChatRead: function (roomId, otherKey) {
        if (!roomId) return { ok: false, reason: 'no_room' };
        var me = state.me && state.me.key;
        if (!me) return { ok: false, reason: 'no_login' };
        var thread = D.threadById(state.idx, me, roomId);
        if (!thread || !thread.unread) return { ok: false, reason: 'read' };
        if (!tryLock('read:' + roomId, 1500)) return { ok: false, reason: 'locked' };
        var entity = meEntity({
          type: '채팅읽음', id: U.uid(), clientId: U.clientId(),
          target: otherKey || thread.other, team: roomId, createdAt: U.stamp()
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

      /* 출석 체크: 하루 1회 +1 */
      checkIn: function () {
        if (!tryLock('checkin', 1500)) return { ok: false, reason: 'locked' };
        var status = state.data.hearts || {};
        if (status.checkedInToday) return { ok: false, reason: 'done' };
        var entity = meEntity({
          type: '출석하트', id: U.uid(), clientId: U.clientId(), date: U.ymd(),
          likes: D.HEART_RULES.CHECKIN
        });
        pushRow(entity);
        commit();
        return { ok: true, gained: D.HEART_RULES.CHECKIN, balance: state.data.hearts.balance };
      },

      /* 보상형 광고 시청: 하루 5회, 30초 간격, 같은 요청은 한 번만
       * 실제 광고는 앱(iOS/Android WebView)에서 재생하고, 다 본 뒤에 이 함수를 부르면 됩니다.
       * 광고 SDK 콜백 → BM.app.ctx.store.actions.watchAd() */
      watchAd: function (opts) {
        opts = opts || {};
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
          likes: D.HEART_RULES.AD_REWARD, target: opts.adUnit || ''
        });
        pushRow(entity);
        commit();
        var after = state.data.hearts || {};
        return {
          ok: true, gained: D.HEART_RULES.AD_REWARD,
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
          target: targetKey, likes: D.HEART_RULES.GIFT_COST, text: note || ''
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

        var theme = { theme: themeId, avatar: (me.theme && me.theme.avatar) || '🏸' };
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
       * 승인/거절은 관리자 계정에서만 가능합니다. */
      requestMentor: function (input) {
        input = input || {};
        var me = state.me || {};
        if (!me.key) return { ok: false, reason: 'no_login' };
        var reason = String(input.reason || input.intro || '').trim();
        if (!reason) return { ok: false, reason: 'empty' };
        if (!tryLock('mentor:' + me.key, 2000)) return { ok: false, reason: 'locked' };
        var pending = D.mentorApplications(state.idx, me.key, false)
          .filter(function (a) { return a.status === '심사중'; })[0];
        if (pending) return { ok: false, reason: 'pending' };
        var mp = D.matchProfileOf(state.idx, me.key);
        var payload = {
          status: '심사중',
          submitted: U.stamp(),
          type: input.type || '선수 멘토',
          experience: input.experience || '',
          awards: input.awards || '',
          proof: input.proof || '',
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
        emit();
      },

      setMatchQuery: function (query) {
        state.ui.matchFilter.query = String(query == null ? '' : query);
        emit();
      },

      resetMatchFilter: function () {
        state.ui.matchFilter = { level: '전체', gender: '전체', region: '전체', discipline: '전체', query: '' };
        emit();
      },

      setCoachPlayer: function (key) { state.ui.coachPlayer = key; emit(); },
      setCoachTab: function (tab) { state.ui.coachTab = tab; emit(); },
      setComposer: function (text) { state.ui.composer = text; emit(); },

      retrySync: function () { return flush(); },

      resetDemo: function () {
        if (!apiRef.resetDemo) return Promise.resolve();
        return apiRef.resetDemo().then(function () {
          state.queue = []; persistQueue();
          return actions.init();
        });
      },

      /* 테스트/디버그용 */
      _state: function () { return state; },
      _flush: function () { return flush(); },
      _api: function () { return apiRef; },
      _replaceApi: function (next) { apiRef = next; state.mode = next.mode; }
    };

    function subscribe(fn) {
      subs.push(fn);
      return function () { subs = subs.filter(function (s) { return s !== fn; }); };
    }

    return { state: state, actions: actions, subscribe: subscribe, derive: derive, flush: flush };
  }

  BM.store = { createStore: createStore, derive: derive, AD_DAILY_LIMIT: AD_DAILY_LIMIT };
})(typeof globalThis !== 'undefined' ? globalThis : this);
