/* ============================================================
 * test/v187.test.js — bm-v1.96.0
 *   🏸 레전드 프레임·타월/투톤 그립 · 라켓 상태 배지 + 원톡 회복
 *   · 하트 부족 → 광고로 바로 열기 · 오늘 N/5회 남음 · 상대 라켓 구경 → 응원·매칭
 *
 *   1) 파츠   — frame:onyx(레전드 ❤4 · 금속) · grip:towel/twotone(에픽 ❤3 · 타월/투톤)
 *   2) 3D     — 오닉스 금속 반사 · 타월 보풀 결 · 투톤 두 색이 실제로 더 그려진다
 *   3) 배지   — 🔥 최상 / 💧 줄 느슨 · N일 휴식 / ✂️ 줄 끊김 · 교체 필요 + 원톡 회복
 *   4) 광고   — 하트가 모자란 파츠·모션은 '♥ N개 부족 · 광고 보고 바로 열기' 시트로 1탭
 *   5) 잔여   — 오늘 N/5회 남음 (MY 하트 지갑 · 충전 시트 · 꾸미기 지갑)
 *   6) 구경   — 상대 라켓 미리보기(바디·등급·효과·줄 상태) → 💛 응원 · 1:1 매칭
 *   7) 보호·버전
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

  var RC = BM.racketcustom;

  var ME = {
    key: BM.seed.ME, nick: '나래', level: 'C조', discipline: '복식', bio: '소개',
    region: '경기', club: '나래울', theme: { theme: 'th_night', avatar: '🦋' }
  };

  function copyOf(o) { return JSON.parse(JSON.stringify(o)); }

  function ymdAgo(n) {
    var d = new Date();
    d.setDate(d.getDate() - n);
    var mm = String(d.getMonth() + 1), dd = String(d.getDate());
    return d.getFullYear() + '-' + (mm.length < 2 ? '0' + mm : mm) + '-' + (dd.length < 2 ? '0' + dd : dd);
  }

  function stateOf(rows, patch) {
    var st = {
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
    if (patch) {
      Object.keys(patch).forEach(function (k) { st[k] = patch[k]; });
      if (patch.ui) st.ui = Object.assign({}, st.ui, patch.ui);
    }
    return st;
  }

  function logRows(daysAgo) {
    if (daysAgo == null) return [];
    return [{
      type: '기록', id: 'x', clientId: 'x', createdAt: ymdAgo(daysAgo) + ' 10:00:00',
      userKey: ME.key, nick: '나래', date: ymdAgo(daysAgo), minutes: 60
    }];
  }

  function stateWithLogs(daysAgo, gear) {
    var st = stateOf(logRows(daysAgo));
    if (gear) st.me.theme = { theme: 'th_night', gear: gear };
    return st;
  }

  /* 3D 투영에 필요한 시점 값 — draw3d 와 같은 모양 */
  var VIEW = { yaw: -0.42, pitch: 0.14, k: 1.7, cx: 200, cy: 250, mid: 0, span: 520 };

  /* ============================================================
   * 1. 파츠 — 레전드 프레임 · 타월/투톤 그립
   * ============================================================ */

  test('v1.87 파츠: 오닉스 티타늄(레전드 ❤4 · 금속) · 타월 베이지·투톤 네온(에픽 ❤3 · 결)', function () {
    var onyx = RC.itemOf('frame', 'onyx');
    ok(!!onyx, '레전드 프레임이 있다');
    eq(onyx.name, '오닉스 티타늄', '이름');
    eq(onyx.rarity, 'legend', '레전드 등급');
    eq(onyx.heart, 4, '하트 4개');
    eq(onyx.finish, 'metal', '금속 마감');
    eq(RC.priceOf('frame', 'onyx'), 4, '가격표도 4');
    eq(RC.rarityOf(onyx.rarity).rank, 3, '가장 높은 등급');

    var towel = RC.itemOf('grip', 'towel');
    var two = RC.itemOf('grip', 'twotone');
    eq(towel.name, '타월 베이지', '타월 그립');
    eq(towel.rarity, 'epic', '에픽');
    eq(towel.heart, 3, '❤3');
    eq(towel.weave, 'towel', '타월 결');
    eq(two.name, '투톤 네온', '투톤 그립');
    eq(two.rarity, 'epic', '에픽');
    eq(two.heart, 3, '❤3');
    eq(two.weave, 'twotone', '투톤 결');
    ok(!!two.color2, '두 번째 색이 있다');
    /* 기본 파츠는 여전히 무료 1종씩 */
    eq(RC.itemsOf('frame').filter(function (i) { return i.free; }).length, 1, '프레임 무료 1종');
    eq(RC.itemsOf('grip').filter(function (i) { return i.free; }).length, 1, '그립 무료 1종');
    /* 서버 가격표에도 새 파츠가 있어야 실제 차감이 된다 */
    var sql = readRoot('supabase/heart-rpc-v1.84-racket.sql');
    includes(sql, "when 'frame:onyx'", '서버 가격 frame:onyx');
    includes(sql, "when 'grip:towel'", '서버 가격 grip:towel');
    includes(sql, "when 'grip:twotone'", '서버 가격 grip:twotone');
  });

  /* ============================================================
   * 2. 3D — 금속 광택 · 타월 결 · 투톤 라인
   * ============================================================ */

  test('v1.87 3D: 오닉스 프레임은 금속 반사 띠를 더 그리고, 돌려도 프레임이 유지된다', function () {
    var gm = RC.geomOf({ frame: 'onyx' });
    var metal = [], plain = [];
    RC._parts.head(metal, gm, VIEW, '#1b1f26', { finish: 'metal', shine: '#b8c8d8' });
    RC._parts.head(plain, gm, VIEW, '#23272b', {});
    ok(metal.length > plain.length + 4, '금속 반사 면이 더 그려진다 ' + metal.length + ' > ' + plain.length);
    var bands = metal.filter(function (p) { return p.alpha != null && p.alpha < 1 && p.alpha > 0; });
    ok(bands.length > 0, '금속 반사 띠(반투명 겹) ' + bands.length);
    var js = readRoot('js/racketcustom.js');
    includes(js, "it.finish === 'metal'", '금속 마감 분기');
    includes(js, "finish: 'metal'", '오닉스에 금속 마감');
    /* 미니 라켓(SVG)도 금속 반사 한 줄 */
    var svgMetal = RC.svg({ frame: 'onyx', unlocked: ['frame:onyx'] }, { level: 'ok' });
    includes(svgMetal, '#b8c8d8', '미니 라켓 금속 반사');
    excludes(RC.svg({ frame: 'matte', unlocked: ['frame:onyx'] }, { level: 'ok' }), '#b8c8d8', '일반 프레임에는 없다');
  });

  test('v1.87 3D: 타월 그립은 보풀 결이, 투톤 그립은 두 색이 실제로 그려진다', function () {
    var gm = RC.geomOf({});
    var towel = [], plain = [], two = [];
    RC._parts.grip(towel, gm, VIEW, '#d9c6a5', '#c6f24e', { weave: 'towel' });
    RC._parts.grip(plain, gm, VIEW, '#d9c6a5', '#c6f24e', null);
    RC._parts.grip(two, gm, VIEW, '#c6f24e', '#c6f24e', { weave: 'twotone', color2: '#20252b' });
    ok(towel.length > plain.length + 8, '타월 결 선이 더 그려진다 ' + towel.length + ' > ' + plain.length);
    var fibers = towel.filter(function (p) { return p.polys; });
    ok(fibers.length > 0, '보풀 획');
    ok(two.length > plain.length, '투톤은 아래 색 면이 더 그려진다');
    var dark = two.filter(function (p) { return /^rgb\(/.test(String(p.fill)) && String(p.fill) !== String(plain[0].fill); });
    ok(dark.length > 0, '두 번째 색 면');

    var js = readRoot('js/racketcustom.js');
    includes(js, "weave === 'towel'", '타월 결 분기');
    includes(js, "weave === 'twotone'", '투톤 분기');
    /* 미니 라켓도 두 색 · 타월은 보풀선이 진하게 */
    includes(RC.svg({ grip: 'twotone', unlocked: ['grip:twotone'] }, { level: 'ok' }), '#20252b', '미니 라켓 투톤 두 번째 색');
    includes(RC.svg({ grip: 'towel', unlocked: ['grip:towel'] }, { level: 'ok' }), '0.28', '미니 라켓 타월 결');
  });

  /* ============================================================
   * 3. 상태 배지 + 원톡 회복
   * ============================================================ */

  test('v1.87 배지: 🔥 최상 컨디션 / 💧 줄 느슨 · N일 휴식 / ✂️ 줄 끊김 · 교체 필요', function () {
    var prime = RC.stageState(stateWithLogs(0));
    eq(prime.level, 'prime', '오늘 운동 → 최상');
    eq(prime.emoji, '🔥', '불 이모지');
    eq(prime.badge, '최상 컨디션', '배지 문구');
    eq(prime.action, '', '최상에는 회복 버튼 없음');

    var worn = RC.stageState(stateWithLogs(4));
    eq(worn.level, 'worn', '4일 휴식 → 느슨');
    eq(worn.emoji, '💧', '물방울');
    includes(worn.badge, '줄 느슨', '느슨 문구');
    includes(worn.badge, '4일 휴식', '며칠 쉬었는지');
    eq(worn.action, 'log', '일지로 회복');
    eq(worn.actionLabel, '오늘 일지 쓰고 라켓 회복하기', '원톡 버튼 문구');

    var due = RC.stageState(stateWithLogs(0, { racket: '아스트록스', string: 'BG80', tension: 26, strungAt: ymdAgo(45), cycleDays: 30 }));
    eq(due.level, 'broken', '교체 시기 지남 → 끊김');
    eq(due.emoji, '✂️', '가위');
    eq(due.badge, '줄 끊김 · 교체 필요', '끊김 문구');
    eq(due.action, 'restring', '교체일 기록');
    eq(due.actionLabel, '오늘 새 줄로 갈았어요', '교체 버튼 문구');

    var idleBroken = RC.stageState(stateWithLogs(9));
    eq(idleBroken.level, 'broken', '9일 휴식 → 끊김');
    eq(idleBroken.action, 'log', '오래 쉰 끊김은 일지로 회복');
  });

  test('v1.87 배지: 꾸미기 시트 맨 위에 배지와 원톡 버튼이 함께 그려진다', function () {
    var html = RC.sheetBody(stateWithLogs(4));
    includes(html, 'class="rkstate rkstate--worn"', '느슨 배지');
    includes(html, '💧 줄 느슨', '느슨 문구');
    includes(html, 'data-rk-recover="log"', '일지 회복 버튼');
    includes(html, '오늘 일지 쓰고 라켓 회복하기', '버튼 글자');
    ok(html.indexOf('rkstate') < html.indexOf('data-rk-3d'), '배지가 3D 라켓보다 위');

    var dueHtml = RC.sheetBody(stateWithLogs(0, { racket: '아스트록스', string: 'BG80', tension: 26, strungAt: ymdAgo(45), cycleDays: 30 }));
    includes(dueHtml, 'data-rk-recover="restring"', '교체 버튼');
    includes(dueHtml, '오늘 새 줄로 갈았어요', '교체 글자');

    var primeHtml = RC.sheetBody(stateWithLogs(0));
    includes(primeHtml, '🔥 최상 컨디션', '최상 배지');
    excludes(primeHtml, 'data-rk-recover', '최상에는 회복 버튼 없음');

    var js = readRoot('js/racketcustom.js');
    includes(js, 'function stageBadgeHtml', '배지 함수');
    includes(js, 'function restringToday', '교체일 기록 함수(버튼·배지 공용)');
  });

  /* ============================================================
   * 4. 하트 부족 → 광고 보고 바로 열기
   * ============================================================ */

  test('v1.87 광고: 하트가 모자란 파츠는 칸 안에 몇 개 부족한지 + 광고로 바로 열기', function () {
    var st = stateWithLogs(0);
    st.data.hearts = { balance: 1 };
    var html = RC.sheetBody(st);
    includes(html, 'data-rk-part="frame:onyx"', '레전드 프레임 칸');
    includes(html, '♥ 3개 부족', '❤4 − 보유 1 = 3개 부족');
    includes(html, 'is-short', '부족 표시');
    includes(html, '광고로 열기', '광고로 바로 열기 안내');
    /* 하트가 넉넉하면 부족 표시가 없다 */
    var rich = stateWithLogs(0);
    rich.data.hearts = { balance: 40 };
    excludes(RC.sheetBody(rich), '♥ 3개 부족', '넉넉하면 부족 표시 없음');
    var js = readRoot('js/racketcustom.js');
    includes(js, "short ? '♥ ' + (hearts - bal) + '개 부족'", '부족 개수 계산');
  });

  test('v1.87 광고: 모자란 모션도 몇 개 부족한지 보여 주고, 탭하면 공용 충전 시트로 1탭', function () {
    var st = stateWithLogs(0);
    st.data.hearts = { balance: 0 };
    var html = RC.motionChipsHtml(st);
    includes(html, '♥ 1개 부족', '트위스트 ❤1 부족');
    includes(html, '♥ 3개 부족', '플립 ❤3 부족');
    includes(html, 'rkmotion__ad', '광고로 열기 표시');

    var js = readRoot('js/racketcustom.js');
    includes(js, "'♥ ' + short + '개 부족 · 광고 보고 바로 열기'", '충전 시트 제목');
    includes(js, 'function openAdCharge', '충전 시트로 잇는 함수');
    includes(js, "if (needH > balH)", '파츠 탭에서 부족 판정');
    includes(js, 'openAdCharge(host, ctx, slot, id, partIt.name', '파츠 → 충전 시트');
    includes(js, "openAdCharge(host, ctx, 'motion', mid", '모션 → 충전 시트');
    includes(js, 'onContinue: function () {\n          if (slot && id) buyPart(', '채운 뒤 바로 열기');
    /* 광고 모듈이 없으면 막다른 안내 대신 이유를 남긴다 */
    includes(js, 'MY에서 충전해 주세요', '폴백 안내');
  });

  /* ============================================================
   * 5. 오늘 N/5회 남음
   * ============================================================ */

  test('v1.87 잔여: adLeftText 가 오늘 남은 광고 횟수를 한 줄로 쓴다', function () {
    var s = BM.ads.getStatus({ adLimit: 5, adUsedToday: 2 });
    eq(BM.ads.adLeftText(s), '오늘 3/5회 남음', '남은 3회');
    eq(BM.ads.adLeftText(BM.ads.getStatus({ adLimit: 5, adUsedToday: 5 })), '오늘 0/5회 남음', '모두 받음');
    eq(BM.ads.adLeftText(BM.ads.getStatus({ adLimit: 0 })), '오늘 볼 수 있는 광고가 없어요', '광고 없음');
    eq(BM.ads.adLeftText(null), '', '값이 없으면 빈 줄');
    /* 기존 문구(남은 N/5회 · 쿨타임)는 그대로 — 보호 */
    includes(BM.ads.adMeterText(s), '남은 3/5회', '기존 줄 유지');
  });

  test('v1.87 잔여: MY 하트 지갑 · 충전 시트 · 꾸미기 지갑이 같은 문구를 보여 준다', function () {
    var st = stateWithLogs(0);
    st.data.hearts = { balance: 2, adLimit: 5, adUsedToday: 1, adReward: 1 };
    includes(RC.sheetBody(st), '오늘 4/5회 남음', '꾸미기 하트 지갑');
    var my = readRoot('js/views/my.js');
    includes(my, 'data-ad-left-t', 'MY 하트 카드 잔여 줄');
    includes(my, 'BM.ads.adLeftText', '같은 문구 함수');
    includes(my, 'leftT.textContent = BM.ads.adLeftText(h)', '1초마다 갱신');
    var ads = readRoot('js/ads.js');
    includes(ads, 'data-ad-left-t', '충전 시트 잔여 줄');
    includes(ads, 'function adLeftText', '함수 정의');
    includes(ads, 'adLeftText: adLeftText', '내보냄');
    includes(readRoot('styles.css'), '.adleft', '잔여 줄 스타일');
  });

  /* ============================================================
   * 6. 상대 라켓 구경 → 응원 · 1:1 매칭
   * ============================================================ */

  function peerRows() {
    return [{
      type: '프로필', id: 'p_fr', clientId: 'p_fr', createdAt: ymdAgo(1) + ' 09:00:00',
      userKey: 'u_fr', nick: '하늘', level: 'B조', region: '경기', discipline: '복식',
      theme: {
        theme: 'th_night',
        gear: {
          racket: '아스트록스', string: 'BG80', tension: 26, strungAt: ymdAgo(40), cycleDays: 30,
          custom: {
            body: 'aero', unlocked: ['frame:onyx', 'grip:twotone', 'effect:prism', 'body:aero', 'charm:ace', 'stencil:crown', 'string:gold'],
            frame: 'onyx', string: 'gold', grip: 'twotone', stencil: 'crown', charm: 'ace', effect: 'prism'
          }
        }
      }
    }];
  }

  test('v1.87 구경: 상대 라켓 요약 — 바디·등급·효과·줄 상태를 사실대로', function () {
    var st = stateOf(peerRows());
    var info = RC.peekOf(st, 'u_fr');
    eq(info.has, true, '꾸민 라켓');
    eq(info.body.id, 'aero', '스피드 에어로 바디');
    eq(info.rarity.id, 'legend', '레전드 등급(오닉스·에이스 참)');
    includes(info.spec, '오닉스 티타늄', '프레임 이름');
    includes(info.spec, '투톤 네온', '그립 이름');
    eq(info.effectName, '챔피언 프리즘', '효과 이름');
    eq(info.level, 'broken', '교체 시기 지남');
    includes(info.gearText, '교체 필요', '줄 상태 문구');
    /* 기록이 없는 사람은 미등록이라고 솔직하게 */
    var none = RC.peekOf(stateOf([]), 'u_none');
    includes(none.gearText, '미등록', '기록 없으면 미등록');
  });

  test('v1.87 구경: 미리보기 시트에서 💛 응원 하트 1개 · 1:1 매칭 신청으로 바로', function () {
    var st = stateOf(peerRows());
    var p = D.profileOf(st.data.idx, 'u_fr');
    var html = BM.views.matching._peekBody(st, p);
    includes(html, 'data-racket-peek="u_fr"', '구경 시트');
    includes(html, '오닉스 티타늄', '프레임');
    includes(html, '투톤 네온', '그립');
    includes(html, '챔피언 프리즘', '효과');
    includes(html, '교체 필요', '줄 상태');
    includes(html, 'data-peek-cheer="u_fr"', '응원 하트 버튼');
    includes(html, '응원 하트 1개', '응원 문구');
    includes(html, 'data-peek-match="u_fr"', '1:1 매칭 신청 버튼');
    includes(html, '1:1 매칭 신청', '매칭 문구');
    includes(html, '수락할 때 하트 2개가 차감', '하트 안내');

    var js = readRoot('js/views/matching.js');
    includes(js, 'function openRacketPeek', '시트 열기');
    includes(js, "view.openRacketPeek = openRacketPeek", '다른 화면에서도 열 수 있게');
    includes(js, "cheerSend(ctx, p)", '응원은 기존 gift RPC');
    includes(js, 'openLetterCompose(ctx, p)', '매칭은 기존 편지지 흐름');
  });

  test('v1.87 구경: 매칭 카드 미니 라켓·스펙 배지와 커뮤니티 글에서 열린다', function () {
    var st = stateOf(peerRows());
    st.data.matchProfiles = [D.profileOf(st.data.idx, 'u_fr')];
    var card = BM.views.matching.playerCard(D.profileOf(st.data.idx, 'u_fr'), st);
    includes(card, 'data-rk-person="u_fr"', '카드 미니 라켓·스펙 배지');
    ok((card.match(/data-rk-person="u_fr"/g) || []).length >= 2, '미니 라켓 + 스펙 배지 둘 다');
    var mjs = readRoot('js/views/matching.js');
    includes(mjs, "ev.target.closest('[data-rk-person]')", '탭 처리');
    includes(mjs, 'openRacketPeek(ctx, rkKey)', '구경 시트 열기');

    var cjs = readRoot('js/views/community.js');
    includes(cjs, 'class="post__rk" data-rk-person=', '글 카드의 미니 라켓');
    includes(cjs, 'BM.views.matching.openRacketPeek(ctx, rkKey)', '커뮤니티 → 같은 구경 시트');
    includes(readRoot('styles.css'), '.peek__top', '구경 시트 스타일');
  });

  /* ============================================================
   * 7. 되받아치는 스윙 · 회전 현실감 (사용자 추가 지시 2026-11-27)
   * ============================================================ */

  test('v1.87 스윙: 셔틀이 날아온 방향의 반대로 되받아치고, 코르크가 약 180° 돌아 앞장선다', function () {
    var imp = { x: 183, y: 200 }, w = 366, h = 356;
    var e = RC.entryVec(imp, w, h, false);
    ok(e.x > 0 && e.y > 0, '들어오는 방향은 오른쪽 아래(코트 안쪽) ' + e.x.toFixed(2) + ',' + e.y.toFixed(2));
    var l1 = RC.launchPath(imp, w, h, 1, false);
    /* 나가는 방향이 들어온 방향의 반대 */
    var dot = Math.cos(l1.dir) * e.x + Math.sin(l1.dir) * e.y;
    ok(dot < -0.5, '들어온 방향의 반대로 나간다 dot=' + dot.toFixed(2));
    /* 코르크 방향(rot)이 반대(약 π)로 뒤집힌다 */
    var l0 = RC.launchPath(imp, w, h, 0, false);
    var diff = Math.abs(((l1.rot - l0.rot + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    ok(diff > 2.4, '코르크가 180° 가까이 돈다 ' + diff.toFixed(2));
    /* 한 번에 사라지지 않고 되돌아가는 길이 보인다 */
    var mid = RC.launchPath(imp, w, h, 0.35, false);
    ok(mid.x > -40 && mid.y > -40, '0.35 시점에도 화면 안 ' + Math.round(mid.x) + ',' + Math.round(mid.y));
    ok(mid.sc < 1 && l1.sc < mid.sc, '멀어지며 작아진다');
    includes(readRoot('js/racketcustom.js'), 'function entryVec', '들어온 방향을 재는 함수');
  });

  test('v1.87 스윙: 백스윙 → 임팩트 → 팔로스루로 스위트 스팟이 셔틀 타점을 지나 계속 흐른다', function () {
    var back = RC.swingOf(RC.WIND_MS - 1, 'air');
    var hit = RC.swingOf(RC.HIT_AT, 'air');
    var flow = RC.swingOf(RC.HIT_AT + 40, 'air');
    ok(back.pitch < hit.pitch && hit.pitch < flow.pitch, '각도가 한 방향으로 흐른다');
    ok(hit.dx < back.dx && flow.dx < hit.dx, '가로로도 계속 지나간다');
    /* 임팩트 = 1단계(250ms) + 2단계(96ms) 경계 */
    eq(RC.HIT_AT, RC.WIND_MS + RC.SWING_MS, '임팩트 시각');
    /* 스윙 구간이 실제로 존재하고, 끝나면 제자리로 돌아온다 */
    var end = RC.swingOf(RC.SMASH_MS - 1, 'air');
    ok(Math.abs(end.pitch) < 0.05 && Math.abs(end.yaw) < 0.05, '끝나면 제자리');
    var js = readRoot('js/racketcustom.js');
    includes(js, '스위트 스팟이 지나온 자리', '스윗 스팟 아크 잔상');
    includes(js, 'function shuttleShadow', '셔틀콕 그림자');
  });

  test('v1.87 회전: 쇼케이스는 손목으로 한 바퀴(roll 360°) · 드래그 관성은 dt 기반', function () {
    var s0 = RC.motionPose('showcase', 0);
    var s1 = RC.motionPose('showcase', RC.MOTION_MS.showcase * 0.92);
    var s2 = RC.motionPose('showcase', RC.MOTION_MS.showcase);
    ok(Math.abs(s0.roll) < 0.01 && Math.abs(s0.yaw) < 0.01, '처음은 제자리');
    ok(s1.roll > 6 && s1.roll < Math.PI * 2 + 0.01, '한 바퀴(2π)까지 ' + s1.roll.toFixed(2));
    ok(Math.abs(s2.roll - Math.PI * 2) < 0.02, '끝나면 정확히 2π');
    ok(Math.abs(s1.yaw) < 0.45, '옆면이 보이게 살짝만 흔들');
    var js = readRoot('js/racketcustom.js');
    includes(js, 'Math.pow(0.9, step)', 'dt 기반 관성 감쇠');
    includes(js, 'var step = dt / 16.7', '프레임 간격 보정');
    includes(js, 'function motion(kind)', '모션 재생 함수');
    includes(js, 'motionAt = nowMs();', '누를 때마다 처음부터');
  });

  /* ============================================================
   * 7. 보호 · 버전
   * ============================================================ */

  test('v1.87 보호: 5개 탭 · 시트 26칸 · 3D 라켓 4종 · 파츠 6칸 · 하트 RPC 그대로', function () {
    includes(readRoot('index.html'), 'data-tab="log"', '5개 탭');
    eq(D.COLS.length, 26, '시트 26칸');
    eq(RC.BODY_IDS.length, 4, '3D 라켓 바디 4종');
    eq(RC.SLOTS.join(','), 'frame,string,grip,stencil,charm,effect', '파츠 6칸');
    var sql = readRoot('supabase/heart-rpc-v1.84-racket.sql');
    includes(sql, 'heart_spend', '하트 차감 함수');
    includes(sql, "if v_kind = 'racket'", '라켓 차감 갈래 유지');
    includes(sql, "if v_kind = 'gift'", '선물 갈래 유지');
    includes(sql, "if v_kind = 'match'", '매칭 갈래 유지');
    /* 기존 화면 요소 보호 */
    includes(RC.stageHtml({ me: {}, data: {} }), 'data-rk-slam="1"', '바닥 강타 버튼');
    includes(RC.sheetBody(stateWithLogs(0)), 'data-rk-share="1"', '공유 카드 버튼');
    includes(RC.sheetBody(stateWithLogs(0)), 'data-rk-hearts="1"', '하트 모으기 버튼');
    includes(RC.sheetBody(stateWithLogs(0)), 'data-rk-restring="1"', '줄 갈았어요 버튼');
    eq((RC.motionChipsHtml(stateWithLogs(0)).match(/data-rk-motion=/g) || []).length, 3, '모션 칩 3개');
    eq(RC.itemsOf('string').length, 10, '스트링 10종(기존 5 + 세트 5)');
  });

  test('v1.87 보호: 새 코드·문구에 실존 선수 이름·외부 브랜드가 없다', function () {
    ['js/racketcustom.js', 'js/views/matching.js', 'js/views/community.js', 'js/views/my.js',
      'js/ads.js', 'supabase/heart-rpc-v1.84-racket.sql'].forEach(function (f) {
      var text = readRoot(f);
      ['김원호', '안세영', '서승재', '윤드로이드', '요넥스'].forEach(function (n) {
        excludes(text, n, f + ' 에 ' + n + ' 없음');
      });
    });
  });

  test('v1.87 버전: sw · app · push · 스타일 캐시 · TWA · README · 테스트 목록', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.97.0'", 'sw 버전');
    includes(readRoot('app.js'), "version: 'v1.97.0'", 'app 버전');
    includes(readRoot('js/push.js'), "version: 'v1.97.0'", 'push 버전');
    includes(readRoot('index.html'), 'styles.css?v=20261128-3', '스타일 캐시 키');
    var twa = readJson('twa-manifest.json');
    eq(twa.appVersionName, '1.97.0', 'TWA 이름');
    eq(twa.appVersion, '1.97.0', 'TWA appVersion');
    eq(twa.appVersionCode, 91, 'TWA 코드');
    includes(readRoot('README.md'), 'bm-v1.97.0', 'README');
    includes(readRoot('test/run.js'), 'test/v187.test.js', '테스트 목록');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
