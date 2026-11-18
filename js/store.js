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
    function derive(rows, meKey) {
    var idx = D.index(rows.map(function (r) { return Array.isArray(r) ? D.fromRow(r) : r; }));
    var posts = U.sortBy(idx.byType['소셜'] || [], function (p) { return p.createdAt || ''; }, true);
    var replies = idx.byType['답글'] || [];
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
    matchProfiles.push({
      rowId: m.id, userKey: m.userKey, nick: m.nick || D.displayName(idx, m.userKey),
      region: m.payload.region || '', level: D.normalizeGrade(m.payload.level), discipline: m.payload.discipline || '',
      club: m.payload.club || '', availability: m.payload.availability || '',
      experience: m.payload.experience || '', bio: m.payload.bio || '', avatar: m.payload.avatar || '🏸',
      createdAt: m.createdAt
    });
    });
    /* 같은 사람이 여러 번 수정하면 최신만 */
    var byUser = {};
    U.sortBy(matchProfiles, function (m) { return m.createdAt || ''; }).forEach(function (m) { byUser[m.userKey] = m; });
    matchProfiles = Object.keys(byUser).map(function (k) { return byUser[k]; });

    var requests = idx.byType['매칭신청'] || [];
    var rooms = me ? D.chatRooms(idx, me) : [];
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
    unread: U.sum(rooms, function (r) { return r.unread; })
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
        tab: 'log', matchFilter: { level: '전체', region: '전체', discipline: '전체' },
        chatRoom: null, coachTab: 'feedback', coachPlayer: null, composer: '', replyTo: null
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
      state.data = derive(state.rows, state.me && state.me.key);
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
          avatar: patch.avatar || (me.theme && me.theme.avatar) || '🏸'
        };
        var theme = { theme: (me.theme && me.theme.theme) || 'th_night', avatar: merged.avatar };
        var entity = {
          type: '프로필', id: U.uid(), clientId: U.clientId(), createdAt: U.stamp(),
          nick: merged.nick, level: merged.level, discipline: merged.discipline,
          userKey: me.key, bio: merged.bio, theme: theme
        };
        pushRow(entity);
        state.me = {
          key: me.key, nick: merged.nick, level: merged.level, discipline: merged.discipline,
          bio: merged.bio, region: merged.region, club: merged.club,
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

      openChat: function (roomId) { state.ui.chatRoom = roomId; emit(); },
      closeChat: function () { state.ui.chatRoom = null; emit(); },

      markChatRead: function (roomId, otherKey) {
        var entity = meEntity({
          type: '채팅읽음', id: U.uid(), clientId: U.clientId(),
          target: otherKey, team: roomId, createdAt: U.stamp()
        });
        var row = D.toRow(entity);
        state.rows.unshift(row);
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

      sendCoachFeedback: function (input) {
        input = input || {};
        var text = (input.text || '').trim();
        if (!text) return { ok: false, reason: 'empty' };
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

      /* 관리자: 데모에서는 내가 관리자 */
      isAdmin: function () { return true; },

      setFilter: function (patch) {
        Object.keys(patch).forEach(function (k) { state.ui.matchFilter[k] = patch[k]; });
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
