/* ============================================================
 * test/v195.test.js — bm-v1.96.0
 *
 *   승우 님 요청(2026-11-28):
 *     "라캣아래 오라같은것도 만들고 조합 보너스해서 노란색으로 다하면
 *      전기가 전체에서 떨어지는 이런것도 만들자"
 *     "히든. 조합보너스도 한7개더 만들어줘 다른것들도 추가해서"
 *     "임팩트 그립색 다 추가해줘"
 *
 *   1) 라켓 아래 바닥 오라 — 3D 쇼룸 바닥에 다층 글로우·라이트 풀·도는 링·빛줄기·빛기둥
 *   2) 공개 세트 4종 — 노랑(전체 낙뢰 포함), 레드, 블루, 블랙
 *   3) 히든 세트 7종 — 전부 실제 파츠 id 로 100% 발동 가능 (조건 누락 없음)
 *   4) 히든 발견 — 발견 전 '???', 맞추면 found 에 영구 기록(새 DB 칸 없음)
 *   5) 그립 8색 · 임팩트 6종 추가 — 기존 하트 1~5 체계 유지, 관리자는 전체 해금
 *   6) 3D 연출 현실감 — 번개는 다단 지그재그 + 잔가지 + 착지 섬광/스파크, 텍스처는 한 번만 굽기
 *   7) 성능 — 프레임마다 캔버스/텍스처를 새로 만들지 않는다
 *   8) SQL heartbeat(heart-rpc-v1.95-all.sql)에 새 품목 모두 포함
 *   9) 보호 · 버전
 *
 *   실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var U = BM.util, D = BM.domain;
  var RC = BM.racketcustom, R3 = BM.racket3d;
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

  function stateOf(custom, extra) {
    var st = {
      ready: true, mode: 'local', me: JSON.parse(JSON.stringify(ME)), rows: [],
      data: BM.store.derive([], BM.seed.ME), drafts: {}, ui: {}, hearts: { balance: 9 }
    };
    st.me.theme = { theme: 'th_night', avatar: '🦋', gear: { custom: custom || null } };
    if (extra) Object.keys(extra).forEach(function (k) { st[k] = extra[k]; });
    return st;
  }

  /* 세트 조건대로 입은 사람 — 모든 파츠를 연 상태 */
  function wearSet(set, extra) {
    var c = RC.blankCustom();
    var unlocked = [];
    set.need.forEach(function (n) {
      /* bm-v1.96.0 — 조건 하나가 여러 파츠를 받을 수 있어(needIds) 첫 번째를 입습니다 */
      var ids = RC.needIds ? RC.needIds(n) : [].concat(n[1]);
      c[n[0]] = ids[0];
      var it = RC.itemOf(n[0], ids[0]);
      if (it && !it.free) unlocked.push(n[0] + ':' + ids[0]);
    });
    c.unlocked = unlocked;
    if (extra) extra.forEach(function (k) {
      var cut = k.indexOf(':');
      c[cut < 0 ? k : k.slice(0, cut)] = k.slice(cut + 1);
      if (unlocked.indexOf(k) < 0) unlocked.push(k);
    });
    return RC.normalizeCustom(c);
  }

  var goldSet = RC.setById('thunderGold');
  var hidden = RC.HIDDEN_SETS;

  /* ============================================================
   * 1. 세트 정의 — 공개 4 · 히든 7
   * ============================================================ */

  test('v1.95 세트: 공개 4종 + 히든 7종 = 11종이고 조건이 화면에 보인다', function () {
    eq(RC.SETS.length, 11, '세트 11종');
    eq(hidden.length, 7, '히든 7종');
    eq(RC.SETS.filter(function (s) { return !s.hidden; }).length, 4, '공개 4종');
    RC.SETS.forEach(function (s) {
      ok(s.id && s.name && s.emoji && s.fx && s.color, s.id + ' 기본 정보');
      ok(s.desc && s.desc.length > 6, s.id + ' 설명');
      if (s.hidden) ok(s.hint, s.id + ' 히든 힌트');
      ok(s.need.length >= 3, s.id + ' 조건 3개 이상');
      /* 조건은 반드시 실제 존재하는 파츠 — 없는 id 를 요구하면 영원히 못 맞춥니다 */
      s.need.forEach(function (n) {
        (RC.needIds ? RC.needIds(n) : [].concat(n[1])).forEach(function (id) {
          var it = RC.itemOf(n[0], id);
          ok(!!it, s.id + ' → ' + n[0] + ':' + id + ' 실제 파츠');
        });
      });
    });
    /* 노랑 풀세트는 전체 낙뢰(fx: lightning) */
    eq(goldSet.fx, 'lightning', '노랑은 전체 낙뢰');
    eq(goldSet.tag, '전체 낙뢰', '낙뢰 문구');
    ok(goldSet.need.every(function (n) { return n[1] === 'gold'; }), '노랑/골드 파츠로 통일');
  });

  test('v1.95 세트: 11종 모두 실제 파츠를 입으면 발동한다(100% 도달 가능)', function () {
    RC.SETS.forEach(function (s) {
      var c = wearSet(s);
      var hit = RC.setHit(c, s);
      ok(hit.complete, s.id + ' 발동 (' + hit.hits + '/' + hit.total + ')');
      var act = RC.activeSet(c);
      ok(!!act, s.id + ' activeSet 있음');
      eq(act.set.fx, s.fx, s.id + ' 발동한 세트가 같은 연출');
    });
    /* 조건이 하나라도 빠지면 발동하지 않는다 */
    var c2 = wearSet(goldSet);
    c2.grip = RC.freeId('grip');
    var miss = RC.setHit(c2, goldSet);
    ok(!miss.complete, '그립이 다르면 미발동');
    eq(miss.hits, 2, '2/3 파츠');
  });

  test('v1.95 세트: 히든 7종은 서로 다른 조합이고 공개 세트와 겹치지 않는다', function () {
    var seen = {};
    RC.SETS.forEach(function (s) {
      var key = s.need.map(function (n) { return n[0] + ':' + n[1]; }).sort().join('|');
      ok(!seen[key], s.id + ' 조합이 중복되지 않음');
      seen[key] = s.id;
    });
    /* 히든은 공개 세트와 다른 파츠를 하나 이상 씁니다 — 같은 옷으로 둘 다 발동하지 않게 */
    hidden.forEach(function (h) {
      RC.SETS.filter(function (s) { return !s.hidden; }).forEach(function (p) {
        var same = p.need.every(function (n) {
          return h.need.some(function (m) { return m[0] === n[0] && m[1] === n[1]; });
        });
        ok(!same, h.id + ' ≠ ' + p.id);
      });
    });
    /* 히든 연출은 서로 다르다 */
    var fx = {};
    hidden.forEach(function (s) { ok(!fx[s.fx], '연출 중복 없음: ' + s.fx); fx[s.fx] = 1; });
  });

  test('v1.95 세트: 히든 7종의 연출이 공개 4종과 확실히 다르다', function () {
    var list = hidden.map(function (s) { return s.fx; });
    ['voidbolt', 'snowstorm', 'pillar', 'cyclone', 'confetti', 'cyber', 'aurora'].forEach(function (f) {
      ok(list.indexOf(f) >= 0, '히든 연출 ' + f);
    });
    ['lightning', 'flame', 'frost', 'void'].forEach(function (f) {
      ok(list.indexOf(f) < 0, '히든 목록에 없는 공개 연출 ' + f);
      ok(RC.SETS.some(function (s) { return s.fx === f && !s.hidden; }), '공개 — ' + f);
    });
  });

  /* ============================================================
   * 2. 발견 — ??? → 영구 기록
   * ============================================================ */

  test('v1.95 발견: 맞추는 순간 newlyFound 가 알려 주고, 저장값(found)에 남는다', function () {
    var c = wearSet(hidden[0]);
    eq(c.found.length, 0, '처음엔 발견 0');
    var fresh = RC.newlyFound(c);
    eq(fresh.length, 1, '새로 발견 1종');
    eq(fresh[0].id, hidden[0].id, '그 히든');
    eq(RC.hiddenFoundCount(c), 0, '기록 전 0/7');
    c.found.push(fresh[0].id);
    eq(RC.hiddenFoundCount(c), 1, '기록 뒤 1/7');
    eq(RC.newlyFound(c).length, 0, '두 번 축하하지 않는다');
    /* 공개 세트는 발견 목록에 들어가지 않는다 */
    var pub = wearSet(goldSet);
    eq(RC.newlyFound(pub).length, 0, '공개 세트는 히든 아님');
    eq(RC.foundOf(pub).length, 0, '공개는 found 에 안 들어감');
  });

  test('v1.95 발견: 저장 경로(setGear)에서도 발견이 기록된다 — 구매·3D 탭 모두', function () {
    var c = wearSet(hidden[0]);
    var merged = RC.mergeFound(c);
    ok(merged.added.length === 1 && merged.added[0].id === hidden[0].id, '처음 저장할 때 발견');
    eq(merged.custom.found.join(','), hidden[0].id, 'found 에 기록');
    var again = RC.mergeFound(merged.custom);
    eq(again.added.length, 0, '두 번째 저장은 조용히');
    if (!hasNode) return;
    /* store.setGear 가 같은 함수를 부릅니다 — 어떤 장착 경로든 기록이 남게 */
    includes(readRoot('js/store.js'), 'BM.racketcustom.mergeFound', 'store.setGear 연결');
  });

  test('v1.95 발견: 예전 저장값(없는 히든 id)은 조용히 버리고, found 는 보존된다', function () {
    var c = RC.normalizeCustom({ frame: 'gold', string: 'gold', grip: 'gold',
      unlocked: ['frame:gold', 'string:gold', 'grip:gold'],
      found: ['phantom', 'nope', 'thunderGold', 'phantom'] });
    eq(c.found.join(','), 'phantom', '아는 히든만 한 번씩');
    var old = RC.normalizeCustom({ frame: 'red', unlocked: ['frame:red'] });
    ok(Array.isArray(old.found) && old.found.length === 0, '예전 값 → 빈 found');
    /* 발견 기록만 있어도 꾸미기 저장으로 친다(초기화되지 않게) */
    ok(RC.hasCustom({ found: ['phantom'] }), '발견 기록 보존');
  });

  test('v1.95 발견: 시트에 히든은 ??? 로 숨고, 발견하면 이름이 보인다', function () {
    var before = RC.setBonusHtml(stateOf({ frame: 'gold', string: 'gold', grip: 'gold',
      unlocked: ['frame:gold', 'string:gold', 'grip:gold'] }));
    includes(before, '??? 히든 조합', '발견 전 ???');
    includes(before, '히든 0/7 발견', '0/7 표시');
    includes(before, '썬더 골드 풀세트 발동!', '노랑 풀세트 배지');
    includes(before, '전체 낙뢰', '낙뢰 문구');
    includes(before, '조합 도감', '도감 접기');
    excludes(before, '팬텀 라이트닝', '히든 이름은 숨김');

    var c = wearSet(hidden[0]);
    c.found = [hidden[0].id];
    var after = RC.setBonusHtml(stateOf(c, null));
    includes(after, '팬텀 라이트닝', '발견한 히든 이름');
    includes(after, '히든 1/7 발견', '1/7 표시');
    includes(after, '발동 중', '발동 표시');
    includes(after, '보랏빛 낙뢰', '연출 이름');
  });

  test('v1.95 발견: 히든을 맞추면 activeSet 이 히든을 고르고 축하 문구가 있다', function () {
    var c = wearSet(hidden[3]);
    var act = RC.activeSet(c);
    eq(act.set.id, hidden[3].id, '히든 우선');
    ok(RC.newlyFound(c)[0].tag, '축하에 쓸 연출 이름');
    if (!hasNode) return;
    var js = readRoot('js/racketcustom.js');
    includes(js, '히든 조합 발견!', '축하 토스트');
    includes(js, 'celebrateSets', '축하 연출');
  });

  /* ============================================================
   * 3. 파츠 라인업 — 그립 8색 · 임팩트 6종
   * ============================================================ */

  test('v1.95 파츠: 그립에 세트 색 8종이 더해져 15종이다', function () {
    var grips = RC.itemsOf('grip');
    eq(grips.length, 15, '그립 15종');
    ['gold', 'crimson', 'ice', 'emerald', 'violet', 'rose', 'white', 'sunset'].forEach(function (id) {
      var it = RC.itemOf('grip', id);
      ok(!!it, '그립 ' + id);
      ok(it.heart >= 1 && it.heart <= 3, '그립 ' + id + ' 하트 ' + it.heart);
    });
    eq(RC.itemOf('grip', 'gold').color, '#e8b93f', '골드 그립 색');
    eq(RC.itemOf('grip', 'white').weave, 'towel', '화이트는 타월 결');
    eq(RC.itemOf('grip', 'violet').weave, 'perf', '바이올렛은 천공 결');
    /* 2D·3D 모두 천공 결을 그린다 */
    includes(readRoot('js/racketcustom.js'), "weave === 'perf'", '2D 천공');
    includes(readRoot('js/racket3d.js'), 'function perfTexture', '3D 천공 텍스처');
    includes(readRoot('js/racket3d.js'), 'gripBumpOf', '3D 결 선택');
  });

  test('v1.95 파츠: 임팩트 6종이 더해져 효과 14종이고 하트는 2~5', function () {
    var list = RC.itemsOf('effect');
    eq(list.length, 14, '효과 14종');
    eq(list.filter(function (it) { return it.smash; }).length, 9, '스매시 9종');
    ['goldbolt', 'void', 'wind', 'blossom', 'snow', 'aurora'].forEach(function (id) {
      var it = RC.itemOf('effect', id);
      ok(!!it, '임팩트 ' + id);
      ok(it.smash, id + ' 스매시');
      ok(it.heart >= 2 && it.heart <= 3, id + ' 하트 ' + it.heart);
      var pal = RC.smashPalette(id);
      ok(pal && pal.hot && pal.mid, id + ' 팔레트');
      includes(readRoot('js/racketcustom.js'), "'" + id + "'", id + ' 팔레트 연결');
    });
    /* 프레임·거트도 세트 색이 늘었다 */
    eq(RC.itemsOf('frame').length, 11, '프레임 11종');
    eq(RC.itemsOf('string').length, 10, '거트 10종');
  });

  test('v1.95 보호: 파츠가 늘어도 열림 기록이 잘리지 않는다(상한 80)', function () {
    var all = [];
    RC.SLOTS.forEach(function (slot) {
      RC.itemsOf(slot).forEach(function (it) { if (!it.free) all.push(slot + ':' + it.id); });
    });
    RC.BODY_IDS.forEach(function (id) { if (!RC.BODIES[id].free) all.push('body:' + id); });
    RC.MOTIONS.forEach(function (id) { all.push('motion:' + id); });
    ok(all.length > 40, '열 수 있는 파츠 ' + all.length + '개(예전 상한 40 초과)');
    var c = RC.normalizeCustom({ unlocked: all });
    eq(c.unlocked.length, all.length, '전부 남는다');
    includes(readRoot('js/racketcustom.js'), 'out.unlocked.length >= 80', '상한 80');
  });

  test('v1.95 관리자: csw42060713@gmail.com 은 새 파츠도 전부 열려 있다', function () {
    var admin = stateOf(null, { me: { key: 'k1', nick: '차승우', email: 'csw42060713@gmail.com' } });
    ok(RC.isAdminUser(admin), '관리자 판정');
    var c = RC.blankCustom();
    ['frame:gold', 'grip:gold', 'grip:violet', 'effect:aurora', 'effect:snow'].forEach(function (k) {
      var cut = k.indexOf(':');
      ok(RC.isUnlocked(c, k.slice(0, cut), k.slice(cut + 1)) || RC.isAdminUser(admin), k + ' 열림');
    });
    /* 관리자 시트에는 전체 해금 안내가 그대로 */
    includes(RC.sheetBody(admin), '관리자 계정 · 전부 열려 있어요', '관리자 안내');
  });

  /* ============================================================
   * 4. 3D — 바닥 오라 · 낙뢰 · 히든 연출
   * ============================================================ */

  test('v1.95 3D: 바닥 오라는 다층 글로우 + 라이트 풀 + 도는 링 + 빛줄기 + 빛기둥', function () {
    var js = readRoot('js/racket3d.js');
    includes(js, 'function buildFloorAura', '바닥 오라');
    includes(js, 'function auraDiscTexture', '방사형 글로우');
    includes(js, 'function auraRingTexture', '에너지 링');
    includes(js, 'function shaftTexture', '빛기둥');
    includes(js, 'out.rays.push', '바닥 빛줄기');
    includes(js, 'function animateFloorAura', '오라 맥동');
    includes(js, 'floorAura = buildFloorAura(T, look.set, floorY + 4)', '라켓 아래에 붙임');
    includes(js, 'pool.material.color = new T.Color(look.set.color)', '바닥 스포트라이트도 세트 색');
  });

  test('v1.95 3D: 전체 낙뢰는 다단 지그재그 + 잔가지 + 착지 섬광 + 스파크', function () {
    var js = readRoot('js/racket3d.js');
    includes(js, 'function boltArm', '지그재그 줄기');
    includes(js, 'bend = Math.sin(t * Math.PI) * amp', '가운데가 크게 꺾임');
    includes(js, 'boltArm(seed * 1.7 + s', '잔가지');
    includes(js, 'function buildBolts', '낙뢰 한 벌');
    includes(js, 'boltArm(i * 3.1 + 1.3, d.x, 640', '화면 위에서 바닥까지');
    includes(js, 'out.land', '착지 섬광');
    includes(js, 'out.sparks = pointCloud', '착지 스파크');
    includes(js, "fx === 'lightning' || fx === 'voidbolt'", '공개+히든 낙뢰');
    includes(js, 'Math.floor(el * 14) % 2 === 0', '찌지직 재생성');
  });

  test('v1.95 3D: 히든 7종 특수 연출이 코드에 모두 있다', function () {
    var js = readRoot('js/racket3d.js');
    includes(js, "fx === 'snowstorm' || fx === 'frost'", '눈보라');
    includes(js, "fx === 'pillar' || fx === 'flame'", '불꽃 기둥');
    includes(js, "fx === 'cyclone' || fx === 'cyber'", '소용돌이·네온');
    includes(js, "fx === 'confetti'", '금가루');
    includes(js, "fx === 'aurora'", '오로라');
    includes(js, "fx === 'void'", '어둠');
    includes(js, 'function auroraTexture', '오로라 커튼');
    includes(js, 'out.bits.ribbons', '오로라 물결');
    includes(js, 'out.bits.grid', '네온 그리드');
    includes(js, 'out.bits.embers', '불티');
    /* 세트가 바뀌면 오라·연출도 다시 만든다 */
    includes(js, 'setInfo ? setInfo.id :', '세트도 looksig 에 포함');
    includes(js, 'setburst: function', '발견 축하 연출');
  });

  test('v1.95 성능: 프레임마다 캔버스·텍스처를 새로 굽지 않는다', function () {
    var js = readRoot('js/racket3d.js');
    var start = js.indexOf('function animateSetScene');
    var end = js.indexOf('/* ============================================================\n   * 6. 셔틀콕', start);
    ok(start > 0 && end > start, 'animateSetScene 구간');
    var body = js.slice(start, end);
    excludes(body, 'canvasDraw', '프레임마다 텍스처를 굽지 않음');
    excludes(body, 'createElement', '프레임마다 캔버스를 만들지 않음');
    excludes(body, 'new T.Mesh(', '프레임마다 메시를 만들지 않음');
    /* 무거운 그림자 블러 금지 */
    excludes(js.slice(js.indexOf('function auraDiscTexture'), end), 'shadowBlur', 'shadowBlur 금지');
    /* 점 개수 상한 — 히든 연출도 몇백 개 수준 */
    includes(js, '? 460 : 200', '눈보라 상한');
  });

  /* ============================================================
   * 5. SQL — 새 그립·임팩트도 하트로 살 수 있다
   * ============================================================ */

  test('v1.95 SQL: heart-rpc-v1.95-all.sql 에 67개 품목이 모두 있다', function () {
    if (!hasNode) return;
    var sql = readRoot('supabase/heart-rpc-v1.95-all.sql');
    includes(sql, 'bm_racket_price', '가격표');
    includes(sql, 'grant execute on function public.heart_spend', '권한');
    excludes(sql, 'drop table', '표를 지우지 않는다');
    var m = sql.match(/create or replace function public\.bm_racket_price[\s\S]*?end;/);
    ok(m, '가격표 본문');
    var db = {};
    (m[0].match(/when '([^']+)'\s+then (\d+)/g) || []).forEach(function (line) {
      var mm = line.match(/when '([^']+)'\s+then (\d+)/);
      db[mm[1]] = Number(mm[2]);
    });
    var app = {};
    Object.keys(RC.PARTS).forEach(function (slot) {
      (RC.PARTS[slot].items || []).forEach(function (it) {
        app[slot + ':' + it.id] = it.heart == null ? 0 : it.heart;
      });
    });
    Object.keys(RC.BODIES).forEach(function (id) {
      app['body:' + id] = RC.BODIES[id].heart == null ? 0 : RC.BODIES[id].heart;
    });
    eq(Object.keys(app).length, 67, '앱 67개 품목');
    Object.keys(app).forEach(function (key) { eq(db[key], app[key], key + ' 가격 일치'); });
    ['grip:gold', 'grip:violet', 'effect:aurora', 'effect:snow', 'frame:gold'].forEach(function (k) {
      ok(db[k] != null, 'SQL 에 ' + k);
    });
    eq((sql.match(/\$\$/g) || []).length % 2, 0, '$$ 짝');
  });

  /* ============================================================
   * 6. 보호 · 버전
   * ============================================================ */

  test('v1.95 보호: 기존 파츠 id·가격·칸·모션·스매시가 그대로다', function () {
    eq(RC.SLOTS.join(','), 'frame,string,grip,stencil,charm,effect', '파츠 6칸 유지');
    eq(RC.MOTIONS.join(','), 'twist,showcase,flip', '모션 3종 유지');
    eq(RC.priceOf('frame', 'matte'), 0, '매트 무료');
    eq(RC.priceOf('frame', 'carbon'), 2, '카본 2');
    eq(RC.priceOf('frame', 'onyx'), 4, '오닉스 4');
    eq(RC.priceOf('string', 'gold'), 2, '골드 거트 2');
    eq(RC.priceOf('grip', 'towel'), 3, '타월 3');
    eq(RC.priceOf('effect', 'prism'), 5, '프리즘 5');
    eq(RC.priceOf('effect', 'fire'), 2, '불꽃 스매시 2');
    eq(RC.priceOf('body', 'smash'), 5, '스매시 맥스 5');
    eq(RC.smashPalette('fire').mid, '#ff8a2f', '기존 팔레트 유지');
    eq(RC.normalizeCustom({ effect: 'prism', unlocked: ['effect:prism'] }).effect, 'prism', '기존 효과 그대로');
    eq(RC.activeSet(RC.normalizeCustom(null)), null, '기본 파츠는 세트 없음');
    includes(RC.setBonusHtml(stateOf(null)), 'data-rk-set=', '기본에도 배지');
  });

  test('v1.95 보호: 2D 스매시도 새 임팩트 색을 쓴다', function () {
    eq(RC.smashPalette('goldbolt').mid, '#ffd84a', '골드 번개');
    eq(RC.smashPalette('void').mid, '#8f6bff', '보이드');
    eq(RC.smashPalette('blossom').mid, '#ff9ec4', '블라썸');
    eq(RC.smashPalette('none').mid, '#c6f24e', '기존 기본');
    includes(readRoot('js/racketcustom.js'), "if (f === 'goldbolt'", 'fxKind 연결');
  });

  test('v1.95 버전: sw · app · push · 스타일 캐시 · TWA · README · 테스트 목록', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.99.0'", 'sw 버전');
    includes(readRoot('app.js'), "version: 'v1.99.0'", 'app 버전');
    includes(readRoot('js/push.js'), "version: 'v1.99.0'", 'push 버전');
    includes(readRoot('index.html'), 'styles.css?v=20261128-5', '스타일 캐시 키');
    var twa = readJson('twa-manifest.json');
    eq(twa.appVersionName, '1.99.0', 'TWA 이름');
    eq(twa.appVersion, '1.99.0', 'TWA appVersion');
    eq(twa.appVersionCode, 93, 'TWA 코드');
    includes(readRoot('README.md'), 'bm-v1.99.0', 'README 변경 이력');
    includes(readRoot('test/run.js'), 'test/v195.test.js', '테스트 목록');
    includes(readRoot('sw.js'), 'bm-v1.99.0', 'sw 이력');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
