/* ============================================================
 * views/coach.js — 코치 (선수 피드백 + 멘토 신청/심사)
 *
 *  · 일반 사용자: '멘토 신청' 탭에서 조건(경력·수상·지원 사유)을 적어 신청하고,
 *    화면에는 "관리자에게 전달되었습니다 (심사중)" 상태만 보입니다.
 *    (남의 신청을 승인/거절하는 버튼은 아예 그리지 않습니다.)
 *  · 관리자(ADMIN_EMAILS): 코치 탭 상단에 "도착한 멘토 신청 N건"이 뜨고,
 *    신청자의 닉네임·급수·주력·성별·지역/클럽·경력·수상·사유·신청일시를 보고
 *    '조건 확인 후 수락' 또는 '거절'을 할 수 있습니다.
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};
  var U = BM.util, D = BM.domain;
  var UI = BM.ui;
  BM.views = BM.views || {};

  var rating = 4;
  var picked = [];

  function isAdmin(state) {
    return !!(state.data && state.data.isAdmin) || D.isAdminMe(state.me);
  }

  /* 화면이 항상 최신 신청 목록을 보도록 idx에서 직접 계산합니다.
   * (관리자는 전부, 일반 사용자는 내 신청만) */
  function mentorAppsOf(state) {
    return D.mentorApplications(state.data.idx, state.me && state.me.key, isAdmin(state));
  }

  function playersWithLogs(state) {
    var me = (state.me && state.me.key) || '';
    var map = {};
    (state.data.allRecords || []).forEach(function (r) {
      if (!r.userKey || r.userKey === me) return;
      (map[r.userKey] = map[r.userKey] || []).push(r);
    });
    return Object.keys(map).map(function (k) {
      var list = U.sortBy(map[k], function (r) { return (r.date || '') + (r.createdAt || ''); }, true);
      var mp = (state.data.matchProfiles || []).filter(function (m) { return m.userKey === k; })[0] || {};
      return {
        key: k, nick: list[0].nick || mp.nick || '선수', avatar: mp.avatar || '🏸',
        avatarPhoto: mp.avatarPhoto || '', avatarFrame: mp.avatarFrame || 'basic',
        avatarBg: mp.avatarBg || 'plain', avatarBadge: mp.avatarBadge || '',
        records: list, level: list[0].level || mp.level || '',
        last: (list[0] && list[0].date) || ''
      };
    }).sort(function (a, b) { return a.last < b.last ? 1 : -1; });   /* 최근 기록이 있는 선수부터 */
  }

  function playerBlock(p, state, canCoach) {
    var sum = BM.ai.summarize(p.records, p.level);
    var last = p.records[0] || {};
    var openRec = state.ui.coachPlayer === p.key;
    return '<article class="card card--player' + (openRec ? ' is-open' : '') + '" data-player="' + U.esc(p.key) + '">' +
      '<header class="pcard__top">' + UI.avatar(p, 46) +
      '<div class="pcard__id"><div class="pcard__name">' + U.esc(p.nick) + '<span class="pill">' + U.esc(p.level) + '</span></div>' +
      '<p class="pcard__meta">최근 30일 ' + sum.sessions + '회 · ' + sum.minutes + '분 · 승률 ' + (sum.winRate == null ? '—' : sum.winRate + '%') + '</p></div>' +
      '<button class="btn btn--ghost btn--sm" data-pick="' + U.esc(p.key) + '">' + (openRec ? '접기' : '자세히') + '</button></header>' +
      '<div class="tags">' +
      (sum.topWeakness.length ? sum.topWeakness.map(function (w) { return '<span class="tag tag--warn">약점 ' + U.esc(w) + '</span>'; }).join('') : '') +
      (sum.pain.length ? sum.pain.map(function (x) { return '<span class="tag">통증 ' + U.esc(x) + '</span>'; }).join('') : '') +
      '<span class="tag tag--soft">평균 컨디션 ' + (sum.avgCond == null ? '—' : sum.avgCond) + '</span></div>' +
      (openRec ? '<div class="player__detail">' +
        '<h4 class="sec-title">최근 기록</h4><ul class="loglist loglist--tight">' +
        p.records.slice(0, 4).map(function (r) {
          return '<li class="logrow"><div class="logrow__date"><strong>' + U.shortDay(r.date) + '</strong><span>' + U.relDay(r.date) + '</span></div>' +
            '<div class="logrow__mid"><p class="logrow__title">컨디션 ' + (r.cond == null ? '—' : r.cond) + ' · 강도 ' + (r.intensity == null ? '—' : r.intensity) + ' · ' + (r.minutes || 0) + '분</p>' +
            '<div class="tags">' + [].concat(r.pain || [], r.weakness || []).map(function (t) { return '<span class="tag">' + U.esc(t) + '</span>'; }).join('') + '</div></div>' +
            '<div class="logrow__score"><span class="score ' + (r.result === '승' ? 'is-win' : r.result === '패' ? 'is-loss' : '') + '">' + U.esc(r.scoreRaw || '—') + '</span></div></li>';
        }).join('') + '</ul>' +
        '<div class="coachbox" data-coachbox="' + U.esc(p.key) + '">' +
        '<h4 class="sec-title">피드백 보내기</h4>' +
        (canCoach ?
          '<div class="stars" data-stars>' + [1, 2, 3, 4, 5].map(function (n) {
            return '<button type="button" class="star' + (n <= rating ? ' is-on' : '') + '" data-star="' + n + '">★</button>';
          }).join('') + '</div>' +
          '<div class="chips" data-drills>' + ['드라이브', '풋워크', '헤어핀', '스매시', '기초 체력'].map(function (d) {
            return '<button type="button" class="chip chip--sm" data-drill="' + U.esc(d) + '">' + U.esc(d) + '</button>';
          }).join('') + '</div>' +
          '<textarea rows="3" data-fb-text placeholder="예: 드라이브 타점이 뒤로 밀려요. 몸 앞에서 잡는 연습 3세트 해보세요." maxlength="300"></textarea>' +
          '<button class="btn btn--primary btn--big" data-act="send-fb" data-player="' + U.esc(p.key) + '">' + UI.icon('send') + '피드백 보내기</button>'
          : '<p class="approw__done">멘토 승인을 받은 코치만 피드백을 보낼 수 있어요.</p>') +
        '</div></div>' : '') +
      '</article>';
  }

  /* ---------- 멘토 신청 (일반 사용자) ---------- */
  function statusPill(status) {
    var cls = status === '승인' ? 'ok' : status === '거절' ? 'no' : 'wait';
    return '<span class="pill pill--' + cls + '">' + U.esc(status) + '</span>';
  }

  function myApplicationBlock(state) {
    var apps = mentorAppsOf(state);
    var mine = apps[0] || null;
    var pending = mine && mine.status === '심사중';
    var approved = mine && mine.status === '승인';

    var statusCard = mine ? '<section class="card card--mentor">' +
      '<header class="card__head"><h2>' + UI.icon('coach') + '내 멘토 신청</h2>' + statusPill(mine.status) + '</header>' +
      (pending
        ? '<div class="pp__note">' + UI.icon('clock') + '<span><b>관리자에게 멘토 신청이 전달되었습니다.</b><br>조건을 확인한 뒤 수락 여부를 알려 줍니다 (심사중).</span></div>'
        : approved
          ? '<div class="pp__note pp__note--ok">' + UI.icon('check') + '멘토로 승인되었습니다. 선수 피드백을 남길 수 있어요.</div>'
          : '<div class="pp__note">' + UI.icon('alert') + '이번 신청은 거절되었습니다. 조건을 보완해 다시 신청할 수 있어요.</div>') +
      '<dl class="kv kv--tight">' +
      '<dt>신청일</dt><dd>' + U.esc(mine.submitted ? U.dayLabel(String(mine.submitted).slice(0, 10)) : '—') + '</dd>' +
      '<dt>경력</dt><dd>' + U.esc(mine.experience || '—') + '</dd>' +
      '<dt>수상</dt><dd>' + U.esc(mine.awards || '—') + '</dd>' +
      '<dt>지원 사유</dt><dd>' + U.esc(mine.reason || '—') + '</dd>' +
      '</dl></section>' : '';

    var form = (!mine || mine.status === '거절') ? '<section class="card">' +
      '<header class="card__head"><h2>멘토 신청</h2><span class="muted sm">관리자 심사</span></header>' +
      '<p class="sectionnote">코치·멘토로 활동하려면 아래 조건을 적어 신청해 주세요. <b>관리자에게만 전달</b>되고, 다른 회원에게는 보이지 않습니다.</p>' +
      '<div class="form">' +
      '<div class="flabel"><span>활동 유형</span>' +
      '<div class="chips" data-mentor-type>' +
      ['선수 멘토', '코치', '클럽 운영'].map(function (t, i) {
        return '<button type="button" class="chip' + (i === 0 ? ' is-on' : '') + '" data-mtype="' + U.esc(t) + '">' + U.esc(t) + '</button>';
      }).join('') + '</div></div>' +
      '<label class="flabel">경력<input type="text" data-mentor-field="experience" maxlength="40" placeholder="예: 5년, A조 리그 3회 출전" value=""></label>' +
      '<label class="flabel">수상·자격<input type="text" data-mentor-field="awards" maxlength="60" placeholder="예: 시·군 대회 복식 3위, 생활체육지도자 2급" value=""></label>' +
      '<label class="flabel">지원 사유<textarea rows="3" data-mentor-field="reason" maxlength="300" placeholder="어떤 도움을 줄 수 있는지 적어 주세요"></textarea></label>' +
      '<label class="flabel">증빙 (선택)<input type="text" data-mentor-field="proof" maxlength="60" placeholder="자격증 번호·링크 등" value=""></label>' +
      '</div>' +
      '<button class="btn btn--primary btn--big mt16" data-act="apply-mentor">' + UI.icon('send') + '멘토 신청 보내기</button>' +
      '<p class="hint">보내면 관리자 계정으로 전달되고, 수락 여부는 여기에서 확인할 수 있어요.</p>' +
      '</section>' : '';

    return statusCard + form;
  }

  /* ---------- 멘토 심사 (관리자) ---------- */
  function applicantAvatar(state, a) {
    return UI.avatar(UI.person(state, a.userKey), 46);
  }

  function mentorCard(a, state) {
    var cls = a.status === '승인' ? 'is-ok' : a.status === '거절' ? 'is-no' : 'is-wait';
    var pending = a.status === '심사중';
    return '<li class="approw approw--mentor ' + cls + '" data-mentor="' + U.esc(a.id) + '">' +
      '<div class="approw__top">' + applicantAvatar(state, a) +
      '<div class="approw__who"><strong>' + U.esc(a.nick || '신청자') + '</strong>' +
      '<div class="pp__pills">' + statusPill(a.status) +
      (a.level ? '<span class="pill pill--grade">' + U.esc(a.level) + '</span>' : '') +
      (a.discipline ? '<span class="pill pill--ghost">' + U.esc(a.discipline) + '</span>' : '') +
      (a.gender && a.gender !== '비공개' ? '<span class="pill pill--gender">' + U.esc(a.gender) + '</span>' : '') +
      '</div></div></div>' +
      '<dl class="kv kv--tight">' +
      '<dt>지역·클럽</dt><dd>' + U.esc([a.region, a.club].filter(Boolean).join(' · ') || '—') + '</dd>' +
      '<dt>경력</dt><dd>' + U.esc(a.experience || '—') + '</dd>' +
      '<dt>수상·자격</dt><dd>' + U.esc(a.awards || '—') + '</dd>' +
      '<dt>지원 사유</dt><dd>' + U.esc(a.reason || '—') + '</dd>' +
      '<dt>신청일시</dt><dd>' + U.esc(a.submitted || a.createdAt || '—') + '</dd>' +
      '</dl>' +
      '<div class="approw__act">' +
      '<button class="linkbtn" data-mentor-open="' + U.esc(a.id) + '">조건 자세히 보기</button>' +
      (pending
        ? '<div class="row gap8 mt8">' +
          '<button class="btn btn--ghost grow" data-mentor-reject="' + U.esc(a.id) + '">거절</button>' +
          '<button class="btn btn--primary grow" data-mentor-accept="' + U.esc(a.id) + '">조건 확인 후 수락</button></div>'
        : '<p class="approw__done">' + U.esc(a.payload && a.payload.decidedBy ? a.payload.decidedBy + ' 님이 처리' : '처리 완료') +
          (a.payload && a.payload.decided ? ' · ' + U.esc(a.payload.decided) : '') + '</p>') +
      '</div></li>';
  }

  function mentorAdminBlock(state) {
    var apps = mentorAppsOf(state);
    var pending = apps.filter(function (a) { return a.status === '심사중'; });
    var done = apps.filter(function (a) { return a.status !== '심사중'; });
    return '<section class="card">' +
      '<header class="card__head"><h2>멘토 신청 심사</h2>' +
      '<span class="badge">' + pending.length + ' 대기</span></header>' +
      '<p class="sectionnote">신청자의 조건을 확인하고 <b>수락</b> 또는 <b>거절</b>을 정해 주세요. 심사는 관리자 계정에서만 보입니다.</p>' +
      (apps.length
        ? '<ul class="applist">' + pending.concat(done).map(function (a) { return mentorCard(a, state); }).join('') + '</ul>'
        : UI.emptyState('coach', '도착한 멘토 신청이 없어요', '회원이 멘토를 신청하면 여기로 옵니다.')) +
      '</section>';
  }

  /* 관리자 상단 배너 */
  function mentorBanner(state) {
    if (!isAdmin(state)) return '';
    var pending = mentorAppsOf(state).filter(function (a) { return a.status === '심사중'; });
    if (!pending.length) return '';
    return '<section class="card card--banner" data-act="open-mentor">' +
      '<div class="row between">' +
      '<div><p class="banner__t">도착한 멘토 신청 <b>' + pending.length + '건</b></p>' +
      '<p class="banner__s">조건을 보고 수락 여부를 정해 주세요.</p></div>' +
      '<button class="btn btn--primary btn--sm" data-act="open-mentor">심사하기</button>' +
      '</div></section>';
  }

  function openMentorSheet(appId, ctx) {
    var state = ctx.store.state;
    var a = mentorAppsOf(state).filter(function (x) { return String(x.id) === String(appId); })[0];
    if (!a) return;
    UI.openSheet({
      title: '멘토 신청 조건',
      body: '<div class="pp">' +
        '<div class="pp__head">' + applicantAvatar(state, a) +
        '<div class="pp__id"><div class="pp__name">' + U.esc(a.nick) + '</div>' +
        '<div class="pp__pills">' + statusPill(a.status) +
        (a.level ? '<span class="pill pill--grade">' + U.esc(a.level) + '</span>' : '') +
        (a.discipline ? '<span class="pill pill--ghost">' + U.esc(a.discipline) + '</span>' : '') +
        '</div></div></div>' +
        '<dl class="kv kv--tight">' +
        '<dt>성별</dt><dd>' + U.esc(a.gender || '비공개') + '</dd>' +
        '<dt>지역</dt><dd>' + U.esc(a.region || '—') + '</dd>' +
        '<dt>클럽</dt><dd>' + U.esc(a.club || '—') + '</dd>' +
        '<dt>경력</dt><dd>' + U.esc(a.experience || '—') + '</dd>' +
        '<dt>수상·자격</dt><dd>' + U.esc(a.awards || '—') + '</dd>' +
        '<dt>지원 사유</dt><dd>' + U.esc(a.reason || '—') + '</dd>' +
        '<dt>증빙</dt><dd>' + U.esc(a.proof || '—') + '</dd>' +
        '<dt>신청일시</dt><dd>' + U.esc(a.submitted || a.createdAt || '—') + '</dd>' +
        '</dl>' +
        (a.bio ? '<p class="pp__bio">' + U.esc(a.bio) + '</p>' : '') +
        (a.status === '심사중'
          ? '<div class="row gap8 mt16">' +
            '<button class="btn btn--ghost grow" data-mentor-reject="' + U.esc(a.id) + '">거절</button>' +
            '<button class="btn btn--primary grow" data-mentor-accept="' + U.esc(a.id) + '">조건 확인 후 수락</button></div>'
          : '<p class="approw__done">' + U.esc(a.status) + ' 처리됨</p>') +
        '</div>'
    });
  }

  /* ---------- 선수 화면: 코치 찾기 · 피드백 받기 ----------
   * 승인된 코치(멘토) 목록을 보여 줍니다. 코치가 없으면 멘토 신청을 권합니다. */
  function coachesOf(state) {
    var me = (state.me && state.me.key) || '';
    var idx = state.data.idx || { byType: {} };
    var seen = {}, out = [];
    ['멘토신청', '코치신청'].forEach(function (type) {
      (idx.byType[type] || []).forEach(function (a) {
        var status = a.status || (a.payload && a.payload.status) || '심사중';
        if (status !== '승인' || !a.userKey || a.userKey === me || seen[a.userKey]) return;
        seen[a.userKey] = 1;
        var p = D.profileOf(idx, a.userKey) || {};
        var mp = D.matchProfileOf(idx, a.userKey) || {};
        var pl = a.payload || {};
        out.push({
          key: a.userKey,
          nick: p.nick || a.nick || '코치',
          level: pl.level || p.level || mp.level || '',
          discipline: pl.discipline || mp.discipline || p.discipline || '',
          region: pl.region || mp.region || '',
          club: pl.club || mp.club || ''
        });
      });
    });
    return out;
  }

  /* 코치 카드 — 누르면 바로 피드백 요청(DM 미리 채움) 또는 1:1 채팅으로 이어집니다 */
  function coachCard(c, state) {
    var key = U.esc(c.key);
    var meta = [c.level, c.discipline, [c.region, c.club].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
    var p = UI.person(state, c.key);
    var room = D.coachRoomId((state.me && state.me.key) || '', c.key);
    var thread = (state.data.threads || []).filter(function (t) {
      return String(t.roomId) === room;
    })[0];
    var canChat = D.canChatWith(state.data.idx, state.me && state.me.key, c.key);
    return '<li class="coachcard" data-coach="' + key + '">' +
      '<div class="coachcard__top">' + UI.avatar(p, 42) +
      '<div class="coachcard__id"><strong>' + U.esc(c.nick) +
      (thread && thread.unread ? ' <i class="badge">' + thread.unread + '</i>' : '') + '</strong>' +
      (meta ? '<p class="coachcard__meta">' + U.esc(meta) + '</p>' : '') + '</div></div>' +
      '<div class="coachcard__act">' +
      '<button type="button" class="btn btn--primary btn--sm" data-coach-ask="' + key + '">' + UI.icon('spark') + '피드백 요청</button>' +
      (canChat
        ? '<button type="button" class="btn btn--ghost btn--sm" data-coach-chat="' + key + '">' + UI.icon('community') + '1:1 채팅' +
          (thread && thread.unread ? ' <i class="badge">' + thread.unread + '</i>' : '') + '</button>'
        : '<span class="coachcard__note">채팅은 승인된 코치와만 열립니다</span>') +
      '</div></li>';
  }

  function playerCoachView(state) {
    var coaches = coachesOf(state);
    return '<section class="card">' +
      '<header class="card__head"><h2>' + UI.icon('coach') + '코치에게 피드백 받기</h2>' +
      (coaches.length ? '<span class="muted sm">코치 ' + coaches.length + '명</span>' : '') + '</header>' +
      '<p class="coachintro">일지를 남기면 코치가 한 줄 피드백과 추천 드릴을 붙여 줍니다.</p>' +
      '<p class="coachflow">일지 남기기 <i>→</i> 코치 확인 <i>→</i> 피드백</p>' +
      '<button class="btn btn--primary btn--big mt16" data-act="go-log">' + UI.icon('log') + '오늘 일지 남기기</button>' +
      (coaches.length
        ? '<ul class="coachcards mt16">' + coaches.slice(0, 6).map(function (c) { return coachCard(c, state); }).join('') + '</ul>'
        : '<p class="hint">아직 활동 중인 코치가 없어요. 내가 먼저 멘토로 신청할 수 있어요.</p>') +
      '<button class="linkbtn mt8" data-coachtab="apply">' + UI.icon('coach') + ' 멘토로 신청하기</button>' +
      '</section>';
  }

  /* 피드백 요청 문구 — 내 최근 일지를 짧게 붙여 코치가 바로 알게 합니다 */
  function feedbackAskText(state) {
    var r = (state.data.records || [])[0];
    if (!r) return '코치님, 일지 피드백 부탁드려요. 이번 주 훈련에서 먼저 볼 점을 알려 주세요.';
    var tags = [].concat(r.weakness || [], r.pain || []).slice(0, 2).join('·');
    return '코치님, ' + U.shortDay(r.date) + ' 일지' + (tags ? '(' + tags + ')' : '') + ' 보고 한 줄 피드백 부탁드려요.';
  }

  var view = {
    title: '코치',
    render: function (state) {
      var admin = isAdmin(state);
      var canCoach = admin || D.isCoach(state.data.idx, state.me && state.me.key);
      /* 기본 화면은 선수(코치 찾기·피드백)입니다. 멘토 신청은 두 번째 탭으로 옮겼습니다. */
      var tab = state.ui.coachTab || 'feedback';
      if (!admin && tab === 'approve') tab = 'feedback';
      if (admin && tab === 'apply') tab = 'approve';
      var players = playersWithLogs(state);
      var myFeedback = (state.data.feedback || []).filter(function (f) {
        return state.me && f.target === state.me.key;
      });
      var sent = (state.data.feedback || []).filter(function (f) {
        return state.me && f.userKey === state.me.key;
      });
      var pendingCount = mentorAppsOf(state).filter(function (a) { return a.status === '심사중'; }).length;

      var feedbackHtml = '' +
        (myFeedback.length ? '<section class="card card--fb"><header class="card__head"><h2>' + UI.icon('spark') + '내가 받은 피드백</h2></header>' +
          myFeedback.slice(0, 3).map(function (f) {
            var pl = f.payload || {};
            return '<div class="fb"><div class="fb__top"><strong>' + U.esc(pl.coach || f.nick) + '</strong>' +
              '<span class="stars stars--sm">' + UI.stars(pl.rating || 0) + '</span></div>' +
              '<p>' + U.esc(pl.feedback || '') + '</p>' +
              '<div class="tags">' + (pl.drills || []).map(function (d) { return '<span class="tag">' + U.esc(d) + '</span>'; }).join('') + '</div></div>';
          }).join('') + '</section>' : '') +
        (canCoach
          ? '<p class="sectionnote">코치는 선수 기록을 보고 한 줄 피드백과 추천 드릴을 남길 수 있어요. 내 기록은 <b>일지 & AI</b>에서 확인합니다.</p>' +
            (players.length ? players.map(function (p) { return playerBlock(p, state, canCoach); }).join('')
              : '<section class="card">' + UI.emptyState('coach', '선수 기록이 아직 없어요', '다른 회원이 일지를 저장하면 여기에 나타납니다.') + '</section>') +
            (sent.length ? '<section class="card"><header class="card__head"><h2>내가 보낸 피드백</h2><span class="muted sm">' + sent.length + '건</span></header>' +
              '<ul class="bullets">' + sent.slice(0, 5).map(function (f) {
                var pl = f.payload || {};
                return '<li><b>' + U.esc(f.nick ? '보낸 피드백' : '피드백') + '</b> · ' + U.esc(U.truncate(pl.feedback || '', 40)) + '</li>';
              }).join('') + '</ul></section>' : '')
          : playerCoachView(state) +
            (myFeedback.length ? '' : '<section class="card">' +
              UI.emptyState('spark', '받은 피드백이 아직 없어요', '일지를 남기면 코치가 여기에 한 줄 남겨요.') + '</section>'));

      return '' +
        mentorBanner(state) +
        '<div class="seg seg--wide" data-coachtabs>' +
        '<button class="seg__btn' + (tab === 'feedback' ? ' is-on' : '') + '" data-coachtab="feedback">' +
          (canCoach ? '선수 피드백' : '코치 찾기 · 피드백') + '</button>' +
        (admin
          ? '<button class="seg__btn' + (tab === 'approve' ? ' is-on' : '') + '" data-coachtab="approve">멘토 심사' +
            (pendingCount ? ' <i class="badge">' + pendingCount + '</i>' : '') + '</button>'
          : '<button class="seg__btn' + (tab === 'apply' ? ' is-on' : '') + '" data-coachtab="apply">멘토 신청</button>') +
        '</div>' +
        (tab === 'feedback' ? feedbackHtml : (admin ? mentorAdminBlock(state) : myApplicationBlock(state)));
    },

    mount: function (root, ctx) {
      root.addEventListener('click', function (ev) {
        var t = ev.target.closest('[data-coachtab]');
        if (t) { ev.preventDefault(); ctx.actions.setCoachTab(t.getAttribute('data-coachtab')); return; }

        if (ev.target.closest('[data-act="go-log"]')) {
          ev.preventDefault();
          ctx.actions.setTab('log');
          UI.haptic(6);
          return;
        }

        /* 코치에게 피드백 요청 — 상단 DM 대화방을 열고 요청 문구를 미리 적어 둡니다 */
        var ask = ev.target.closest('[data-coach-ask]');
        if (ask) {
          ev.preventDefault();
          var askKey = ask.getAttribute('data-coach-ask');
          var r1 = ctx.actions.openCoachChat(askKey, feedbackAskText(ctx.store.state));
          if (r1.ok) { UI.toast('메시지를 고친 뒤 보내 주세요'); UI.haptic(10); }
          else UI.toast('대화를 열지 못했어요', 'error');
          return;
        }
        var cchat = ev.target.closest('[data-coach-chat]');
        if (cchat) {
          ev.preventDefault();
          var chatKey = cchat.getAttribute('data-coach-chat');
          var r2 = ctx.actions.openCoachChat(chatKey, '');
          if (r2.ok) UI.haptic(8);
          else UI.toast('대화를 열지 못했어요', 'error');
          return;
        }

        if (ev.target.closest('[data-act="open-mentor"]')) {
          ev.preventDefault();
          ctx.actions.setCoachTab('approve');
          UI.haptic(6);
          return;
        }

        var mtype = ev.target.closest('[data-mtype]');
        if (mtype) {
          ev.preventDefault();
          UI.$$('[data-mtype]', root).forEach(function (b) { b.classList.remove('is-on'); });
          mtype.classList.add('is-on');
          return;
        }

        var apply = ev.target.closest('[data-act="apply-mentor"]');
        if (apply) {
          ev.preventDefault();
          if (apply.dataset.busy === '1') return;
          apply.dataset.busy = '1';
          var val = function (name) {
            var el = root.querySelector('[data-mentor-field="' + name + '"]');
            return el ? el.value : '';
          };
          var typeBtn = root.querySelector('[data-mtype].is-on');
          var res = ctx.actions.requestMentor({
            type: typeBtn ? typeBtn.getAttribute('data-mtype') : '선수 멘토',
            experience: val('experience'), awards: val('awards'),
            reason: val('reason'), proof: val('proof')
          });
          setTimeout(function () { apply.dataset.busy = '0'; }, 800);
          if (res.ok) { UI.toast('관리자에게 멘토 신청을 보냈어요 (심사중)'); UI.haptic(12); }
          else if (res.reason === 'empty') UI.toast('지원 사유를 적어 주세요');
          else if (res.reason === 'pending') UI.toast('이미 심사중인 신청이 있어요');
          else if (res.reason === 'locked') UI.toast('잠시만요, 보내는 중이에요');
          else UI.toast('신청을 보내지 못했어요', 'error');
          return;
        }

        var mopen = ev.target.closest('[data-mentor-open]');
        if (mopen) {
          ev.preventDefault();
          openMentorSheet(mopen.getAttribute('data-mentor-open'), ctx);
          return;
        }

        var maccept = ev.target.closest('[data-mentor-accept]');
        if (maccept) {
          ev.preventDefault();
          var id = maccept.getAttribute('data-mentor-accept');
          UI.confirm('이 신청의 조건을 확인했고, 멘토로 수락할까요?', '수락').then(function (ok) {
            if (!ok) return;
            var r = ctx.actions.decideMentor(id, '승인');
            UI.closeSheet();
            if (r.ok) { UI.toast('멘토 신청을 수락했어요.'); UI.haptic(12); }
            else if (r.reason === 'forbidden') UI.toast('관리자 계정에서만 심사할 수 있어요', 'error');
            else if (r.reason === 'done') UI.toast('이미 처리된 신청이에요');
            else UI.toast('처리하지 못했어요', 'error');
          });
          return;
        }

        var mreject = ev.target.closest('[data-mentor-reject]');
        if (mreject) {
          ev.preventDefault();
          var rid = mreject.getAttribute('data-mentor-reject');
          UI.confirm('이 멘토 신청을 거절할까요?', '거절').then(function (ok) {
            if (!ok) return;
            var r = ctx.actions.decideMentor(rid, '거절');
            UI.closeSheet();
            if (r.ok) { UI.toast('멘토 신청을 거절했어요.'); UI.haptic(10); }
            else if (r.reason === 'forbidden') UI.toast('관리자 계정에서만 심사할 수 있어요', 'error');
            else if (r.reason === 'done') UI.toast('이미 처리된 신청이에요');
            else UI.toast('처리하지 못했어요', 'error');
          });
          return;
        }

        var pickBtn = ev.target.closest('[data-pick]');
        if (pickBtn) {
          ev.preventDefault();
          var k = pickBtn.getAttribute('data-pick');
          ctx.actions.setCoachPlayer(ctx.store.state.ui.coachPlayer === k ? null : k);
          UI.haptic(6);
          return;
        }
        var star = ev.target.closest('[data-star]');
        if (star) {
          ev.preventDefault();
          rating = +star.getAttribute('data-star');
          var box = star.closest('[data-stars]');
          Array.prototype.forEach.call(box.querySelectorAll('[data-star]'), function (s) {
            s.classList.toggle('is-on', +s.getAttribute('data-star') <= rating);
          });
          return;
        }
        var drill = ev.target.closest('[data-drill]');
        if (drill) {
          ev.preventDefault();
          UI.toggleChip(drill);
          return;
        }
        var send = ev.target.closest('[data-act="send-fb"]');
        if (send) {
          ev.preventDefault();
          var box2 = send.closest('[data-coachbox]');
          var text = box2.querySelector('[data-fb-text]').value;
          var drills = UI.readChips(box2.querySelector('[data-drills]'));
          var res = ctx.actions.sendCoachFeedback({
            playerKey: send.getAttribute('data-player'), text: text, rating: rating, drills: drills
          });
          if (res.ok) {
            box2.querySelector('[data-fb-text]').value = '';
            UI.toast('피드백을 보냈어요.');
            UI.haptic(12);
          } else if (res.reason === 'empty') UI.toast('피드백 내용을 적어 주세요');
          else if (res.reason === 'forbidden') UI.toast('코치·관리자만 피드백을 보낼 수 있어요', 'error');
          else if (res.reason === 'locked') UI.toast('잠시만요');
          return;
        }
        var dec = ev.target.closest('[data-decide]');
        if (dec) {
          ev.preventDefault();
          var d = ctx.actions.decideCoachApp(dec.getAttribute('data-decide'), dec.getAttribute('data-status'));
          if (d.ok) UI.toast('멘토 신청을 ' + dec.getAttribute('data-status') + ' 처리했어요.');
          else if (d.reason === 'forbidden') UI.toast('관리자 계정에서만 심사할 수 있어요', 'error');
          UI.haptic(10);
          return;
        }
      });
    },

    update: function (root, state, ctx) {
      /* 코치 화면은 상태가 바뀌면 통째로 다시 그립니다 (목록이 작아 빠릅니다) */
      ctx.refresh();
    }
  };

  BM.views.coach = view;
})(typeof globalThis !== 'undefined' ? globalThis : this);
