/* ============================================================
 * test/fixtures.js — 테스트 전용 예시 데이터
 *
 * js/seed.js는 이제 데모 인물·기록을 넣지 않지만(build() → []),
 * 저장소·화면 로직이 '행이 있을 때' 어떻게 동작하는지는 계속 검증해야 합니다.
 * 그래서 예전 seed.build()가 만들던 데이터셋을 테스트 쪽으로 옮겨 왔습니다.
 * 앱 번들(sw.js SHELL)에는 포함되지 않으며, node test/run.js 에서만 씁니다.
 * 인물은 모두 가상이고 이메일·비밀번호는 들어 있지 않습니다.
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};
  var U = BM.util, D = BM.domain;

  var ME = 'demo_me';
  var PLAYERS = [
    { key: 'demo_chi', nick: '콕집사', level: 'B조', region: '경기', club: '나래울', availability: '주말', experience: '2~5년', discipline: '복식', avatar: '🐧', gender: '남성', avatarFrame: 'court', bio: '주말 저녁에 꾸준히 칩니다. 같이 기본기 다지실 분 환영해요.' },
    { key: 'demo_suttle', nick: '셔틀버스', level: 'C조', region: '경기', club: '나래울', availability: '평일 저녁', experience: '2~5년', discipline: '복식', avatar: '🦊', gender: '남성', bio: '회사 끝나고 8시 이후 가능. 드라이브 연습 파트너 찾아요.' },
    { key: 'demo_foot', nick: '발놀림장인', level: 'A조', region: '서울', club: '강서 SH', availability: '무관', experience: '5년 이상', discipline: '복식', avatar: '🐯', gender: '남성', avatarFrame: 'gold', avatarBadge: '🥇', bio: '풋워크 교정 환영. 3:1로 훈련해 주실 분 좋아요.' },
    { key: 'demo_net', nick: '네트앞여우', level: '선수부', region: '경기', club: '나래울', availability: '주말', experience: '5년 이상', discipline: '혼합복식', avatar: '🦉', gender: '여성', avatarFrame: 'sakura', avatarBadge: '🏸', bio: '혼복 전문. 네트 앞 플레이와 헤어핀 세밀하게 잡아드려요.' },
    { key: 'demo_bear', nick: '스매시곰', level: '자강', region: '인천', club: '인천 유소년', availability: '평일 낮', experience: '5년 이상', discipline: '복식', avatar: '🐻', gender: '남성', avatarFrame: 'royal', bio: '코치 자격 준비 중입니다. 초보분들 스매시 폼 잡아드려요.' },
    { key: 'demo_drive', nick: '드라이브요정', level: 'D조', region: '경기', club: '부천 레인보우', availability: '평일 저녁', experience: '1년 미만', discipline: '복식', avatar: '🐰', gender: '여성', avatarBg: 'mint', bio: '시작한 지 8개월. 같이 천천히 늘어요.' },
    { key: 'demo_koala', nick: '콕콕이', level: '초심', region: '서울', club: '양천 러브콕', availability: '주말', experience: '1~2년', discipline: '단식', avatar: '🐨', gender: '여성', avatarBg: 'sunset', bio: '단식 위주로 칩니다. 랠리 길게 해 주실 분!' },
    { key: 'demo_clear', nick: '하늘클리어', level: 'B조', region: '서울', club: '양천 러브콕', availability: '평일 저녁', experience: '2~5년', discipline: '혼합복식', avatar: '🦌', gender: '여성', avatarFrame: 'neon', avatarBg: 'ocean', bio: '클리어 깊이를 늘리는 중이에요. 혼복으로 주 2회 치고 싶어요.' }
  ];

  function demo(now) {
    var D0 = now ? new Date(now) : new Date();
    function d(offset) { return U.ymd(U.addDays(D0, offset)); }
    function stampAt(offset, h, m) {
      return d(offset) + ' ' + U.pad2(h) + ':' + U.pad2(m || 0) + ':00';
    }

    var rows = [];
    var me = {
      nick: '나래', level: 'C조', discipline: '복식', gender: '비공개',
      region: '경기', club: '나래울', availability: '주말', experience: '2~5년',
      avatar: '🦋', avatarFrame: 'court', avatarBg: 'mint', avatarBadge: '🏸',
      bio: '주말마다 나래울에서 칩니다. 드라이브를 무기로 만들고 싶어요.'
    };
    var profileUsers = [{ key: ME, p: me }].concat(PLAYERS.map(function (p) {
      return { key: p.key, p: p };
    }));

    /* 프로필 */
    profileUsers.forEach(function (u, i) {
      rows.push(D.toRow({
        id: U.uid(), type: '프로필', createdAt: stampAt(-30 + i, 9, 10 + i),
        nick: u.p.nick, level: u.p.level, discipline: u.p.discipline, userKey: u.key,
        bio: u.p.bio,
        theme: u.key === ME
          ? { theme: 'th_night', avatar: u.p.avatar, avatarFrame: u.p.avatarFrame || 'basic', avatarBg: u.p.avatarBg || 'plain', avatarBadge: u.p.avatarBadge || '' }
          : { avatar: u.p.avatar, avatarFrame: u.p.avatarFrame || 'basic', avatarBg: u.p.avatarBg || 'plain', avatarBadge: u.p.avatarBadge || '' }
      }));
    });

    /* 매칭 프로필 */
    PLAYERS.forEach(function (p, i) {
      rows.push(D.toRow({
        id: U.uid(), type: '매칭프로필', createdAt: stampAt(-20 + i, 20, 5 + i), userKey: p.key, nick: p.nick,
        payload: {
          region: p.region, level: p.level, discipline: p.discipline, club: p.club,
          availability: p.availability, experience: p.experience, bio: p.bio,
          avatar: p.avatar, gender: p.gender,
          avatarFrame: p.avatarFrame || 'basic', avatarBg: p.avatarBg || 'plain', avatarBadge: p.avatarBadge || ''
        }
      }));
    });
    rows.push(D.toRow({
      id: U.uid(), type: '매칭프로필', createdAt: stampAt(-1, 21, 30), userKey: ME, nick: me.nick,
      payload: {
        region: me.region, level: me.level, discipline: me.discipline, club: me.club,
        availability: me.availability, experience: me.experience, bio: me.bio,
        avatar: me.avatar, gender: me.gender,
        avatarFrame: me.avatarFrame, avatarBg: me.avatarBg, avatarBadge: me.avatarBadge
      }
    }));

    /* 내 기록 (최근 2주) — 통증 반복/승률이 AI 분석에 걸리도록 구성 */
    var myLogs = [
      { o: -13, cond: 6, it: 7, min: 60, done: ['스트록', '풋워크', '게임'], score: { a: 18, b: 21 }, pain: [], weak: ['드라이브'] },
      { o: -11, cond: 8, it: 8, min: 75, done: ['스트록', '스매시', '게임'], score: { a: 21, b: 15 }, pain: ['어깨'], weak: ['드라이브'] },
      { o: -10, cond: 5, it: 6, min: 50, done: ['벽치기', '코어', '게임'], score: { a: 21, b: 18 }, pain: [], weak: [] },
      { o: -9, cond: 4, it: 6, min: 45, done: ['스트록', '런닝'], score: null, pain: ['목'], weak: ['헤어핀'] },
      { o: -8, cond: 7, it: 7, min: 90, done: ['스트록', '풋워크', '게임'], score: { a: 19, b: 21 }, pain: [], weak: ['풋워크'] },
      { o: -6, cond: 8, it: 7, min: 60, done: ['스트록', '스매시', '게임'], score: { a: 21, b: 12 }, pain: [], weak: [] },
      { o: -5, cond: 6, it: 5, min: 40, done: ['벽치기', '코어'], score: null, pain: ['어깨'], weak: ['드라이브'] },
      { o: -4, cond: 5, it: 9, min: 110, done: ['스트록', '풋워크', '게임', '웨이트'], score: { a: 16, b: 21 }, pain: ['어깨', '무릎'], weak: ['드라이브', '풋워크'] },
      { o: -3, cond: 7, it: 6, min: 55, done: ['스트록', '풋워크', '게임'], score: { a: 21, b: 19 }, pain: [], weak: [] },
      { o: -1, cond: 6, it: 7, min: 65, done: ['스트록', '풋워크', '게임'], score: { a: 21, b: 17 }, pain: [], weak: ['풋워크'] }
    ];
    myLogs.forEach(function (l, i) {
      rows.push(D.toRow({
        id: U.uid(), type: '기록', createdAt: stampAt(l.o, 19, 5 + i), date: d(l.o),
        nick: me.nick, level: me.level, discipline: me.discipline, userKey: ME,
        cond: l.cond, intensity: l.it, minutes: l.min, done: l.done,
        score: l.score, result: D.resultFromScore(l.score),
        pain: l.pain, weakness: l.weak
      }));
    });

    /* 다른 선수 기록 (코치 화면용) */
    var others = [
      { key: 'demo_drive', nick: '드라이브요정', level: 'D조', logs: [
        { o: -9, cond: 5, it: 6, min: 45, done: ['스트록', '벽치기'], score: { a: 12, b: 21 }, pain: ['팔꿈치'], weak: ['클리어'] },
        { o: -6, cond: 6, it: 6, min: 50, done: ['스트록', '풋워크'], score: { a: 15, b: 21 }, pain: [], weak: ['클리어', '서브'] },
        { o: -2, cond: 7, it: 7, min: 60, done: ['스트록', '풋워크', '게임'], score: { a: 18, b: 21 }, pain: ['팔꿈치'], weak: ['클리어'] }
      ] },
      { key: 'demo_foot', nick: '발놀림장인', level: 'A조', logs: [
        { o: -7, cond: 8, it: 8, min: 80, done: ['풋워크', '스매시', '게임'], score: { a: 21, b: 17 }, pain: ['아킬레스건'], weak: ['리시브'] },
        { o: -3, cond: 7, it: 8, min: 90, done: ['풋워크', '게임'], score: { a: 21, b: 19 }, pain: ['아킬레스건'], weak: ['리시브'] }
      ] },
      { key: 'demo_koala', nick: '콕콕이', level: '초심', logs: [
        { o: -5, cond: 6, it: 5, min: 40, done: ['스트록', '런닝'], score: null, pain: ['무릎'], weak: ['헤어핀'] },
        { o: -1, cond: 7, it: 6, min: 45, done: ['스트록', '벽치기'], score: { a: 21, b: 19 }, pain: [], weak: ['드롭'] }
      ] }
    ];
    others.forEach(function (p) {
      p.logs.forEach(function (l, i) {
        rows.push(D.toRow({
          id: U.uid(), type: '기록', createdAt: stampAt(l.o, 20, 10 + i), date: d(l.o),
          nick: p.nick, level: p.level, discipline: '복식', userKey: p.key,
          cond: l.cond, intensity: l.it, minutes: l.min, done: l.done,
          score: l.score, result: D.resultFromScore(l.score), pain: l.pain, weakness: l.weak
        }));
      });
    });

    /* 약점 기록 2건 */
    rows.push(D.toRow({
      id: U.uid(), type: '약점', createdAt: stampAt(-4, 22, 10), date: d(-4), nick: me.nick,
      level: me.level, discipline: me.discipline, userKey: ME, weakness: ['드라이브'],
      drills: { drills: [{ name: '드라이브 기본 반복', level: 'C조', method: '같은 코스로 정확하게 반복해서 샷 폼을 다집니다.', point: '타점을 몸 앞에' }] }
    }));

    /* 소셜 글 (사용자가 쓴 글) — 예전 샘플 글과 본문이 겹치지 않게 둡니다 */
    var posts = [
      { key: ME, nick: '나래', text: '오늘 클럽 정기전에서 복식 3게임 돌았어요. 마지막 게임은 드라이브로 마무리!', o: -1, h: 6 },
      { key: 'demo_chi', nick: '콕집사', text: '토요일 오전 나래울 코트 빈 자리 있습니다. 같이 치실 분 댓글 주세요.', o: -1, h: 5 },
      { key: 'demo_foot', nick: '발놀림장인', text: '육각 스텝 3일째인데 다리가 무겁네요. 그래도 발이 조금 가벼워진 느낌입니다.', o: -2, h: 5 },
      { key: 'demo_bear', nick: '스매시곰', text: '팔꿈치가 아파서 이번 주는 쉬어요. 다들 스매시 그립 힘 빼고 치세요!', o: -3, h: 4 },
      { key: 'demo_net', nick: '네트앞여우', text: '헤어핀만 넣다가 리프트를 섞었더니 상대가 흔들리네요. 오늘 연습 성공.', o: -4, h: 3 },
      { key: 'demo_drive', nick: '드라이브요정', text: '평일 저녁에 드라이브 연습 같이 하실 분 있나요? 아직 배우는 중입니다.', o: -5, h: 2 }
    ];
    var postIds = [];
    posts.forEach(function (p, i) {
      var id = U.uid();
      postIds.push(id);
      rows.push(D.toRow({
        id: id, type: '소셜', createdAt: stampAt(p.o, 21, 5 + i), date: d(p.o),
        nick: p.nick, level: '', discipline: '', userKey: p.key, text: p.text, likes: p.h
      }));
    });

    /* 답글 */
    var replies = [
      { to: 0, key: 'demo_chi', nick: '콕집사', text: '드라이브 마무리 멋졌어요. 축하합니다!', o: -1 },
      { to: 0, key: 'demo_foot', nick: '발놀림장인', text: '다음에 같이 한 게임 붙어요 ㅎㅎ', o: -1 },
      { to: 2, key: ME, nick: '나래', text: '저도 육각 스텝 시작했는데 이틀째 다리가 아파요.', o: -1 },
      { to: 3, key: 'demo_drive', nick: '드라이브요정', text: '저도 팔꿈치 때문에 고생했는데 밴드가 도움이 됐어요.', o: -2 }
    ];
    replies.forEach(function (r, i) {
      rows.push(D.toRow({
        id: U.uid(), type: '답글', createdAt: stampAt(r.o, 22, 1 + i), date: d(r.o),
        nick: r.nick, level: '', discipline: '', userKey: r.key, target: postIds[r.to], text: r.text
      }));
    });

    /* 좋아요(하트) — 글의 좋아요 수 = 이 행들의 개수 */
    var likers = ['demo_chi', 'demo_foot', 'demo_net', 'demo_drive', 'demo_koala', 'demo_suttle', 'demo_bear', ME];
    posts.forEach(function (p, pi) {
      var n = 0;
      for (var li = 0; li < likers.length && n < (p.h || 0); li++) {
        var who = likers[li];
        if (who === p.key) continue;
        n++;
        rows.push(D.toRow({
          id: U.uid(), type: '하트', createdAt: stampAt(p.o, 22, 10 + n), date: d(p.o),
          nick: who === ME ? me.nick : '', userKey: who, target: postIds[pi]
        }));
      }
    });

    /* 매칭 신청 + 채팅 */
    var room = U.uid();
    rows.push(D.toRow({
      id: room, type: '매칭신청', createdAt: stampAt(-2, 11, 0), date: d(-2), nick: me.nick,
      userKey: ME, target: 'demo_net', status: '수락', payload: { note: '주말 오전 가능하실까요?', heartCost: 2 }
    }));
    rows.push(D.toRow({
      id: U.uid(), type: '내하트사용', createdAt: stampAt(-2, 11, 0), date: d(-2), nick: me.nick,
      userKey: ME, target: 'demo_net', likes: 2
    }));
    var chat = [
      { key: ME, nick: '나래', text: '안녕하세요! 프로필 보고 연락드렸어요. 주말 오전에 같이 치실 수 있을까요?', o: -2, t: 11 },
      { key: 'demo_net', nick: '네트앞여우', text: '안녕하세요 :) 토요일 9시 나래울 괜찮으세요?', o: -2, t: 12 },
      { key: ME, nick: '나래', text: '좋아요! 9시에 뵐게요. 혼복도 가능하실까요?', o: -2, t: 13 },
      { key: 'demo_net', nick: '네트앞여우', text: '네, 혼복 좋습니다. 그날 헤어핀 같이 봐드릴게요.', o: -1, t: 20 }
    ];
    chat.forEach(function (c, i) {
      rows.push(D.toRow({
        id: U.uid(), type: '매칭채팅', createdAt: stampAt(c.o, c.t, 10 + i), nick: c.nick,
        userKey: c.key, target: c.key === ME ? 'demo_net' : ME, team: room, text: c.text
      }));
    });
    rows.push(D.toRow({
      id: U.uid(), type: '채팅읽음', createdAt: stampAt(-1, 21, 0), userKey: ME, target: 'demo_net', team: room
    }));

    /* 매칭 신청 (받은 것) */
    rows.push(D.toRow({
      id: U.uid(), type: '매칭신청', createdAt: stampAt(-1, 18, 30), date: d(-1), nick: '셔틀버스',
      userKey: 'demo_suttle', target: ME, status: '대기', payload: { note: '평일 저녁 어때요?', heartCost: 2 }
    }));

    /* 코치 신청 */
    rows.push(D.toRow({
      id: U.uid(), type: '코치신청', createdAt: stampAt(-6, 15, 20), nick: '스매시곰',
      userKey: 'demo_bear', payload: {
        type: '동호인 멘토',
        experience: '선수부 5년, 유소년 클럽 보조 코치 2년',
        proof: '인천 유소년 클럽 코치 수료증, 대회 입상 3회',
        intro: '초보분 스매시 폼과 어깨 부상 예방 위주로 봐드립니다.',
        status: '심사중', submitted: stampAt(-6, 15, 20)
      }
    }));
    rows.push(D.toRow({
      id: U.uid(), type: '코치신청', createdAt: stampAt(-20, 11, 5), nick: '네트앞여우',
      userKey: 'demo_net', payload: {
        type: '동호인 멘토',
        experience: '혼합복식 8년, 클럽 내 코치 경험',
        proof: '나래울 클럽 코치 활동 2년',
        intro: '네트 앞 플레이와 헤어핀을 집중적으로 봐드려요.',
        status: '승인', submitted: stampAt(-20, 11, 5)
      }
    }));

    /* 하트 경제 — 출석 · 광고 · 선물(주고받기) · 합치기
     * 오늘 출석/광고는 일부러 비워 둡니다(앱에서 직접 눌러 볼 수 있게). */
    rows.push(D.toRow({ id: U.uid(), type: '출석하트', createdAt: stampAt(-2, 8, 5), date: d(-2), nick: me.nick, userKey: ME, likes: 1 }));
    rows.push(D.toRow({ id: U.uid(), type: '출석하트', createdAt: stampAt(-1, 8, 10), date: d(-1), nick: me.nick, userKey: ME, likes: 1 }));
    rows.push(D.toRow({ id: U.uid(), type: '광고하트', createdAt: stampAt(-5, 9, 0), date: d(-5), nick: me.nick, userKey: ME, likes: 1 }));
    rows.push(D.toRow({ id: U.uid(), type: '광고하트', createdAt: stampAt(-3, 9, 0), date: d(-3), nick: me.nick, userKey: ME, likes: 1 }));
    rows.push(D.toRow({ id: U.uid(), type: '선물하트', createdAt: stampAt(-4, 20, 0), date: d(-4), nick: '콕집사', userKey: 'demo_chi', target: ME, likes: 1 }));
    rows.push(D.toRow({ id: U.uid(), type: '선물하트', createdAt: stampAt(-3, 21, 10), date: d(-3), nick: me.nick, userKey: ME, target: 'demo_chi', likes: 1 }));
    rows.push(D.toRow({ id: U.uid(), type: '하트합치기', createdAt: stampAt(-3, 20, 0), date: d(-3), nick: me.nick, userKey: ME, likes: 1 }));

    /* 꾸미기 구매 + 달력 메모 */
    rows.push(D.toRow({
      id: U.uid(), type: '꾸미기구매', createdAt: stampAt(-30, 9, 30), date: d(-30),
      nick: me.nick, userKey: ME, target: 'th_night'
    }));
    rows.push(D.toRow({
      id: U.uid(), type: '달력메모', createdAt: stampAt(3, 10, 0), date: d(3), nick: me.nick, userKey: ME,
      text: '나래울 토요일 9시 — 네트앞여우님과 혼복'
    }));

    return rows;
  }

  BM.fixtures = { demo: demo, ME: ME, PLAYERS: PLAYERS };
})(typeof globalThis !== 'undefined' ? globalThis : this);
