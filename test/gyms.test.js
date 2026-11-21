/* ============================================================
 * test/gyms.test.js — 체육관 지도 · 자주 가는 체육관 (로컬 검토용)
 *
 *  1) 체육관 목록 (js/gyms.js)
 *     · 10곳 이상, id·이름·동네·좌표가 모두 있고 좌표는 국내 범위
 *     · 앱에 이미 나오던 '나래울'이 목록에 있다 (동탄 · 코트 10면)
 *     · 코트 수·운영 시간·요금이 카드에 그대로 담긴다
 *  2) 즐겨찾기
 *     · 처음엔 비어 있고, 별을 누르면 추가·다시 누르면 해제
 *     · localStorage(기기)에 저장돼 다시 읽어도 남는다 · 계정마다 따로
 *     · 없는 체육관 id·깨진 저장값은 버리고 안전하게 빈 목록으로
 *  3) 목록 고르기
 *     · '즐겨찾기만 보기' · 이름/동네 검색 · 즐겨찾기 먼저 정렬
 *     · 오프라인 핀 지도 좌표(%)가 0~100 안에 들어간다
 *  4) 화면
 *     · 매칭 > 찾기 맨 위 '체육관 지도' 입구 카드
 *     · 지도 화면: 기본 13개 핀 + 별 버튼 + '즐겨찾기만' + 자주 가는 체육관 칩
 *     · 커뮤니티 게스트 모집의 '지도에서 고르기'
 *     · Leaflet 을 못 불러와도 핀 지도가 그려진다 · 파일·캐시 목록에 있다
 *
 *  실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var U = BM.util;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes, near = t.near;

  var hasNode = false;
  try { hasNode = typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string'; } catch (e) { hasNode = false; }

  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }
  function existsRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.existsSync(path.join(root.__REPO_ROOT__, file));
  }

  function G() { return BM.gyms; }

  /* 테스트마다 즐겨찾기 저장소를 비웁니다 */
  function resetFavs() {
    U.storage.removeItem(G().keyFor('demo_me'));
    U.storage.removeItem(G().keyFor('other_me'));
    U.storage.removeItem(G().keyFor('guest'));
  }

  function stateOf(scope, patch) {
    var meKey = scope || 'demo_me';
    var rows = BM.fixtures.demo();
    var st = {
      ready: true, mode: 'local',
      me: { key: meKey, nick: '나래', level: 'C조', region: '경기', club: '나래울', theme: { theme: 'th_def' } },
      rows: rows,
      data: BM.store.derive(rows, meKey),
      ui: {
        tab: 'matching', matchTab: 'find', matchFilter: {}, matchSort: 'score',
        matchFilterOpen: '', matchStarted: false, chatRoom: null, chatOther: '',
        chatDraft: '', chatOpen: false, coachTab: '', coachPlayer: null,
        composer: '', composerTopic: '자유', composerMeet: { when: '', place: '', cap: '' }, replyTo: null
      },
      analysis: null, queue: [], locks: {}, syncState: 'idle', syncError: null, lastSync: ''
    };
    if (patch && patch.ui) {
      Object.keys(patch.ui).forEach(function (k) { st.ui[k] = patch.ui[k]; });
    }
    return st;
  }

  /* =========================================================
   * 1. 체육관 목록
   * ========================================================= */
  test('체육관: 목록에 10곳 이상이 있고 이름·동네·좌표가 모두 국내 범위다', function () {
    var list = G().all();
    ok(list.length >= 10, '10곳 이상 (실제 ' + list.length + '곳)');
    var seen = {};
    list.forEach(function (v) {
      ok(v.id && !seen[v.id], 'id 중복 없음: ' + v.id);
      seen[v.id] = true;
      ok(v.name && v.name.length >= 2, '이름: ' + v.id);
      ok(v.area && v.area.length >= 2, '동네: ' + v.id);
      ok(v.lat >= 33 && v.lat <= 39, v.id + ' 위도가 국내 범위');
      ok(v.lng >= 124 && v.lng <= 132, v.id + ' 경도가 국내 범위');
      ok(v.hours || v.fee || v.courts, v.id + ' 운영 정보가 하나는 있다');
    });
    eq(G().count(), list.length, 'count() 가 목록 수와 같다');
  });

  test('체육관: 앱에 이미 나오던 나래울(동탄)이 코트 10면으로 들어 있다', function () {
    var v = G().get('naraeul');
    ok(v, '나래울 배드민턴장');
    includes(v.name, '나래울', '이름');
    includes(v.area, '화성', '동네');
    eq(v.courts, 10, '코트 수');
    includes(v.hours, '부', '운영 시간(부 단위)');
    ok(JSON.stringify(BM.fixtures.demo()).indexOf('나래울') >= 0, '데모 프로필의 주 체육관 이름도 나래울');
  });

  test('체육관: 목록은 복사본이라 밖에서 고쳐도 원본이 그대로다', function () {
    var a = G().get('mapo');
    a.name = '바뀜';
    eq(G().get('mapo').name, '마포구민체육센터', '원본 유지');
    var list = G().all();
    list[0].name = '바뀜';
    ok(G().all()[0].name !== '바뀜', 'all() 도 복사본');
  });

  /* =========================================================
   * 2. 즐겨찾기 (기기 저장)
   * ========================================================= */
  test('즐겨찾기: 처음엔 비어 있고 별을 누르면 담기고 다시 누르면 빠진다', function () {
    resetFavs();
    eq(G().favorites('demo_me').length, 0, '처음엔 빈 목록');
    var add = G().toggle('demo_me', 'mapo');
    eq(add.ok, true, '등록 성공');
    eq(add.added, true, '추가됨');
    eq(G().isFav('demo_me', 'mapo'), true, '등록 확인');
    var del = G().toggle('demo_me', 'mapo');
    eq(del.added, false, '해제');
    eq(G().isFav('demo_me', 'mapo'), false, '해제 확인');
    resetFavs();
  });

  test('즐겨찾기: 기기(localStorage)에 저장돼 새로 읽어도 남고, 최근에 담은 것이 앞에 온다', function () {
    resetFavs();
    G().toggle('demo_me', 'mapo');
    G().toggle('demo_me', 'magok');
    var raw = U.readJSON(G().keyFor('demo_me'), null);
    ok(Array.isArray(raw), '저장된 값이 배열');
    eq(raw.join(','), 'magok,mapo', '최근 등록이 앞');
    eq(G().favorites('demo_me').join(','), 'magok,mapo', '다시 읽어도 그대로');
    resetFavs();
  });

  test('즐겨찾기: 계정마다 따로 저장된다', function () {
    resetFavs();
    G().toggle('demo_me', 'songpa');
    G().toggle('other_me', 'doksan');
    eq(G().favorites('demo_me').join(','), 'songpa', '내 계정');
    eq(G().favorites('other_me').join(','), 'doksan', '다른 계정');
    eq(G().favorites('guest').length, 0, '둘러보기(guest)는 따로');
    resetFavs();
  });

  test('즐겨찾기: 없는 체육관·중복·깨진 저장값은 조용히 걸러진다', function () {
    resetFavs();
    var bad = G().toggle('demo_me', 'no_such_gym');
    eq(bad.ok, false, '없는 id는 거부');
    eq(G().favorites('demo_me').length, 0, '저장값도 그대로');

    U.writeJSON(G().keyFor('demo_me'), ['mapo', 'mapo', 'no_such_gym', 'songpa']);
    eq(G().favorites('demo_me').join(','), 'mapo,songpa', '중복·없는 id 제거');

    U.storage.setItem(G().keyFor('demo_me'), '{깨진 값');
    eq(G().favorites('demo_me').length, 0, '깨진 값은 빈 목록');

    U.writeJSON(G().keyFor('demo_me'), { a: 1 });
    eq(G().favorites('demo_me').length, 0, '배열이 아니면 빈 목록');
    resetFavs();
  });

  test('즐겨찾기: 지우면 저장값도 사라진다', function () {
    resetFavs();
    G().toggle('demo_me', 'wolgye');
    eq(G().clear('demo_me').length, 0, '빈 목록 반환');
    eq(U.readJSON(G().keyFor('demo_me'), null), null, '저장값 삭제');
  });

  /* =========================================================
   * 3. 목록 고르기 · 지도 좌표
   * ========================================================= */
  test("보기: '즐겨찾기만'은 즐겨찾기한 곳만, 즐겨찾기가 먼저 온다", function () {
    resetFavs();
    G().toggle('demo_me', 'guro');
    var favs = G().favorites('demo_me');
    var all = G().withFavoritesFirst(G().all(), favs);
    eq(all[0].id, 'guro', '즐겨찾기가 맨 앞');
    var only = G().filter(G().all(), { onlyFav: true, favorites: favs });
    eq(only.length, 1, '즐겨찾기만 1곳');
    eq(only[0].id, 'guro', '그 체육관');
    resetFavs();
  });

  test('보기: 이름·동네·주소로 찾을 수 있고 띄어쓰기는 무시한다', function () {
    eq(G().filter(G().all(), { query: '마포' }).length >= 1, true, '구 이름');
    eq(G().filter(G().all(), { query: '신림' })[0].id, 'miseong', '동네 이름');
    eq(G().filter(G().all(), { query: ' 동탄 ' })[0].id, 'naraeul', '앞뒤 공백 무시');
    eq(G().filter(G().all(), { query: '없는동네이름' }).length, 0, '없으면 빈 목록');
    eq(G().filter(G().all(), {}).length, G().count(), '조건이 없으면 전부');
  });

  test('오프라인 지도: 핀 좌표가 0~100% 안에 있고 북쪽이 위로 간다', function () {
    var pts = G().project(G().all());
    eq(pts.length, G().count(), '모든 체육관에 핀');
    pts.forEach(function (p) {
      ok(p.x >= 0 && p.x <= 100, p.id + ' x: ' + p.x);
      ok(p.y >= 0 && p.y <= 100, p.id + ' y: ' + p.y);
    });
    var north = pts.filter(function (p) { return p.id === 'wolgye'; })[0];
    var south = pts.filter(function (p) { return p.id === 'naraeul'; })[0];
    ok(north.y < south.y, '북쪽(월계)이 남쪽(동탄)보다 위');
    var empty = G().project([]);
    eq(empty.length, 0, '빈 목록은 핀도 없음');
  });

  /* =========================================================
   * 4. 화면
   * ========================================================= */
  test('화면: 매칭 > 찾기 맨 위에 체육관 지도 입구 카드가 있다', function () {
    resetFavs();
    var html = BM.views.matching.render(stateOf('demo_me'));
    includes(html, 'data-act="open-gym-map"', '지도 열기 버튼');
    includes(html, '체육관 지도', '이름');
    includes(html, '서울·수도권 체육관 ' + G().count() + '곳', '기본 안내 문구');
    /* 즐겨찾기가 있으면 입구 카드에 이름이 보인다 */
    G().toggle('demo_me', 'mapo');
    var html2 = BM.views.matching.render(stateOf('demo_me'));
    includes(html2, '자주 가는 곳 1곳', '즐겨찾기 수');
    includes(html2, '마포구민체육센터', '즐겨찾기 이름');
    resetFavs();
  });

  test('화면: 지도 화면이 체육관 13곳을 핀·카드로 기본 표시한다', function () {
    resetFavs();
    var html = BM.views.gyms.render({ scope: 'demo_me' });
    includes(html, 'data-gymmap', '지도 상자');
    includes(html, 'data-gympins', '핀 레이어');
    eq((html.match(/data-gym-pin="/g) || []).length, G().count(), '핀 개수 = 체육관 수');
    eq((html.match(/data-gym-card="/g) || []).length, G().count(), '카드 개수 = 체육관 수');
    eq((html.match(/data-gym-fav="/g) || []).length, G().count(), '별 버튼 개수 = 체육관 수');
    includes(html, 'data-gym-filter="fav"', '즐겨찾기만 보기');
    includes(html, '자주 가는 체육관', '자주 가는 체육관 영역');
    includes(readRoot('js/views/gyms.js'), 'OpenStreetMap', '지도 저작자 표시');
    includes(html, '운영', '운영 시간 줄');
    includes(html, '서울 <b>', '서울 우선 지도 안내');
    includes(html, '동탄 1곳은 <b>전체 보기</b>', '동탄은 전체 보기 안내');
  });

  test('화면: 별을 누른 뒤에는 상단 칩·지도 핀·카드가 즐겨찾기를 따라간다', function () {
    resetFavs();
    G().toggle('demo_me', 'songpa');
    G().toggle('demo_me', 'doksan');
    var html = BM.views.gyms.render({ scope: 'demo_me' });
    includes(html, 'gymfav__chips', '자주 가는 체육관 칩 줄');
    eq((html.match(/data-gym-jump="/g) || []).length, 2, '칩 2개');
    includes(html, '송파배드민턴체육관', '칩에 이름');
    eq((html.match(/class="gympin is-fav"/g) || []).length >= 2, true, '즐겨찾기 핀 표시');

    var only = BM.views.gyms.render({ scope: 'demo_me', onlyFav: true });
    eq((only.match(/data-gym-card="/g) || []).length, 2, '즐겨찾기만 보기 → 카드 2개');
    eq((only.match(/data-gym-pin="/g) || []).length, 2, '핀도 2개');
    includes(only, '자주 가는 체육관 <b>2곳</b>만 지도에 보여요', '지도 안내');
    resetFavs();
  });

  test('화면: 즐겨찾기가 없으면 안내를, MY 주 체육관과 같은 곳은 배지로 표시한다', function () {
    resetFavs();
    var empty = BM.views.gyms.render({ scope: 'demo_me', onlyFav: true });
    includes(empty, '즐겨찾기한 체육관이 없어요', '빈 즐겨찾기 안내');
    var mine = BM.views.gyms.render({ scope: 'demo_me', club: '나래울 배드민턴장' });
    includes(mine, '내 주 체육관', '주 체육관 배지');
  });

  test('화면: Leaflet 을 못 불러와도 핀 지도가 그려지고, 지도 파일이 저장소·캐시에 있다', function () {
    var html = BM.views.gyms.render({ scope: 'demo_me' });
    includes(html, 'gymmap__fallback', '오프라인용 핀 지도');
    ok(!root.L || !root.L.map, '테스트 환경에는 Leaflet 이 없다(이 경로를 탄다)');
    ok(existsRoot('js/vendor/leaflet/leaflet.js'), 'Leaflet js 파일');
    ok(existsRoot('js/vendor/leaflet/leaflet.css'), 'Leaflet css 파일');
    var sw = readRoot('sw.js');
    includes(sw, "'./js/gyms.js'", 'sw.js 캐시: gyms.js');
    includes(sw, "'./js/views/gyms.js'", 'sw.js 캐시: views/gyms.js');
    includes(sw, "'./js/vendor/leaflet/leaflet.js'", 'sw.js 캐시: leaflet.js');
    var index = readRoot('index.html');
    includes(index, 'js/vendor/leaflet/leaflet.js', 'index.html 스크립트');
    includes(index, 'js/gyms.js', 'index.html 스크립트');
    includes(index, 'js/views/gyms.js', 'index.html 스크립트');
    var leaf = readRoot('js/vendor/leaflet/leaflet.js');
    includes(leaf, 'Leaflet 1.9.4', '버전 표기(라이선스 고지 유지)');
  });

  test('화면: 커뮤니티 게스트 모집의 어디 체육관 칸에서 지도로 고를 수 있다', function () {
    var html = BM.views.community.render(stateOf('demo_me', { ui: { composerTopic: '게스트 모집' } }));
    includes(html, 'data-act="pick-gym"', '지도에서 고르기 버튼');
    includes(html, 'data-vitefield="place"', '기존 어디 체육관 칸은 그대로');
  });

  test('화면: 지도·즐겨찾기 코드는 서버로 아무것도 보내지 않는다', function () {
    var view = readRoot('js/views/gyms.js');
    var data = readRoot('js/gyms.js');
    excludes(view, 'fetch(', '지도 화면은 네트워크로 저장하지 않음');
    excludes(data, 'fetch(', '데이터 모듈도 네트워크 없음');
    includes(data, 'bm_gym_fav_v1', '기기 저장 키');
    includes(data, 'U.readJSON', '기기 저장 읽기');
    includes(data, 'U.writeJSON', '기기 저장 쓰기');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
