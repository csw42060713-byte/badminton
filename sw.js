/* ============================================================
 * sw.js — 앱 껍데기 오프라인 캐시
 * 네트워크(GET, 같은 주소)만 캐시합니다. 시트 브리지(다른 주소, POST)는
 * 서비스워커가 건드리지 않습니다.
 *
 * 캐시 전략
 *  · 화면(HTML)·코드(JS)·스타일(CSS) : 네트워크 우선 → 실패하면 캐시(오프라인)
 *    (예전에는 캐시 우선이라 새 버전을 내도 설치한 기기가 옛 화면에 머물렀습니다.)
 *  · 아이콘·이미지 등 정적 파일 : 캐시 우선 + 뒤에서 갱신
 *
 * 새 버전은 설치 즉시 skipWaiting()으로 넘어가고, 화면(app.js)이
 * controllerchange에서 한 번만 새로고침합니다.
 * 파일을 수정하면 VERSION을 올려야 설치된 기기가 새 파일을 받습니다.
 * 2026-11-19: 프로필 꾸미기(실력·성별·스타일·체육관) · 상단 채팅 바로가기 · 전체 필터.
 * 2026-11-20: 공용 하트 충전 시트 · 실시간 광고 쿨타임(1초 카운트다운) · 광고 중복 실행 잠금.
 * 2026-11-20: 지난 일지 수정·삭제 · 코치 피드백 요청에 최근 일지 요약 · MY 꾸미기 입구 하나로.
 * 2026-11-20: 시트 연결 버튼 연타 잠금(연결 요청이 두 번 나가지 않게).
 * 2026-11-20: 시트 연결 웹 앱 URL·이메일·닉네임 기본값 자동 채움.
 * 2026-11-20: 채팅 보낸 시각·날짜 구분선 · 새 메시지/요청 알림 · 활동 상태 · 편지지 요청과 끄기 설정.
 * 2026-11-20: 초보자 4주 루틴 시작/건너뛰기 선택 카드 · MY 표시 스위치.
 * 2026-11-20: Supabase 실시간 서버(서울) 연결 — 채팅·1:1 요청이 1초 안에 도착 · MY에서 시트로 전환.
 * 2026-11-20: 옛 초보용 글 통합 — 용어 사전 43개 · 튜토리얼 3묶음 · 기술 가이드 5종 · 쉬운 맞춤 연습 5종.
 * 2026-11-20: Supabase Auth 이메일 가입·로그인 · 로그인 세션으로 진짜 수정/삭제(RLS) · 비밀번호 변경/재설정 · 탈퇴 시 로그인 계정까지 삭제.
 * 2026-11-20: 관절 보호 체크 — 어깨 GIRD 14°·FR240 0.69·내회전 55°(Guermont 2023·Cejudo 2022),
 *             런지 피로 구간·백핸드 네트 런지·측후방 앞발 착지(Du & Fan 2020·Valldecabres 2018·Fong 2021).
 * 2026-11-20: AI 분석·관절 보호 문구를 쉬운 코트 말투로 — 화면에 GIRD·FR240·OR·p<0.001·HRmax 없이,
 *             논문 수치는 내부 값과 맨 아래 작은 '참고 논문' 한 줄에만.
 * 2026-11-20: 매너 한 줄 태그(1:1 대화방 상단 4칩 · 상대당 하루 1회 · 프로필 배지),
 *             모집 글 정원 자동 마감(마감 배지·대기 문의·글쓴이 참여자 명단).
 * 2026-11-20: 고도화 2차 사이클 — 원탭 코트 점수판(21·25점 · 듀스 자동 · 세트 종료 후
 *             '오늘 일지에 바로 넣기'), AI 추천 드릴·부상 예방 워밍업 옆 원탭 카운트다운 타이머.
 * 2026-11-20: 고도화 3차 사이클 — 주간 약점 3회 스탬프 챌린지(최근 2주 약점 1개 · 일지 저장으로 자동 채움 ·
 *             3회 달성 배지 · 초심 1주차에는 숨김), 프로필 표 라벨 한 줄·대화방 아바타 정리 같은 디자인 폴리싱,
 *             AI 부상 예방 문구의 남은 전문용어(55도·고관절·멀티셔틀)까지 쉬운 코트 말투로.
 * 2026-11-21: 고도화 4차 사이클 — 복식 파트너 이름과 파트너별 승률(게임 점수 접기 안 작은 칸 ·
 *             '팀' 칸 JSON 한 줄 · 일지 & AI에 승률 요약), 스윙·경기 영상 링크 한 개와
 *             한 줄 체크 포인트(http/https만 · 새 창 열기), 챌린지 3회 달성 시
 *             커뮤니티 글쓰기로 한 번에 넘기는 '커뮤니티에 자랑하기'.
 * 2026-11-21: 고도화 5차 사이클 — 빈 화면(일지·매칭·커뮤니티·코치·채팅)에 배드민턴 선화 일러스트
 *             (셔틀콕·라켓·코트·전술 보드, 인라인 SVG · 테마 변수), 맨 위 카드 오른쪽 여백에
 *             은은한 코트 선화 워터마크.
 * 2026-11-21: 고도화 7차 사이클 — 일지 '복식 파트너' 최근·자주 친 파트너 원탭 칩(최대 4개 ·
 *             친구 목록으로 채움 · 다시 누르면 지움), 일지 & AI 첫 화면 밀도 정리(루틴 선택 카드
 *             160px 안쪽 · 카드 여백 12px), 5개 탭 공통 한국어 줄바꿈(keep-all)과 상단 버튼
 *             터치 영역·커뮤니티 작성 카드 '분류' 이름표.
 * 2026-11-21: 수익화·기록 연결 — 보상형 광고 거래 ID(txId) 중복 적립 차단(광고 SDK 콜백이
 *             두 번 와도 한 번만) · 7일 연속 출석 보너스 하트 +2(MY 하트 카드·충전 시트 안내) ·
 *             일지 입력칸 바로 아래 파트너 전적 한 줄('조환비 · 4전 3승 1패 (75%)') ·
 *             챌린지 자랑 문구에 함께 친 파트너·전적('조환비와 2경기 2승') 자동 포함.
 * ============================================================ */
var VERSION = 'bm-v1.36.0';
var SHELL = [
  './',
  './index.html',
  './privacy.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './js/util.js',
  './js/domain.js',
  './js/routine.js',
  './js/beginner.js',
  './js/ai.js',
  './js/seed.js',
  './js/api.js',
  './js/auth.js',
  './js/store.js',
  './js/ui.js',
  './js/art.js',
  './js/ads.js',
  './js/scoreboard.js',
  './js/timer.js',
  './js/views/profile.js',
  './js/views/chat.js',
  './js/views/log.js',
  './js/views/matching.js',
  './js/views/community.js',
  './js/views/coach.js',
  './js/views/my.js',
  './js/views/start.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/favicon.svg'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(VERSION).then(function (cache) {
      /* 한 파일이 실패해도 나머지는 새 버전으로 채웁니다 */
      return Promise.all(SHELL.map(function (url) {
        return cache.add(url).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* 화면이 새 버전을 바로 쓰게 해 달라고 할 때 */
self.addEventListener('message', function (event) {
  var data = event.data || {};
  if (data && data.type === 'SKIP_WAITING') self.skipWaiting();
});

/* v1.20 — 새 메시지 알림을 누르면 앱 창을 앞으로 (안드로이드 크롬은 이 경로로만 알림이 뜹니다) */
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (c && typeof c.focus === 'function') {
          return c.focus().then(function () { return c; });
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow('./');
    }).catch(function () { /* 무시 */ })
  );
});

/* styles.css?v=… 처럼 물음표가 붙은 요청은 파일 이름으로 한 번 더 찾습니다 */
function bareUrl(url) {
  return String(url || '').split('?')[0].split('#')[0];
}

function matchCached(req) {
  return caches.match(req).then(function (hit) {
    if (hit) return hit;
    return caches.match(bareUrl(req.url));
  });
}

function putCached(req, res) {
  if (!res || !res.ok || res.redirected || res.status !== 200) return;
  var key = bareUrl(req.url);
  var copy = res.clone();
  caches.open(VERSION).then(function (cache) {
    return cache.put(key, copy);
  }).catch(function () {});
}

/* 네트워크 우선 → 실패하면 캐시 (오프라인)
 * 브라우저 HTTP 캐시에 옛 파일이 남아 있어도 서버에 다시 확인합니다(cache: no-cache).
 * (GitHub Pages는 파일에 max-age를 붙여 보내므로 이 확인이 있어야 새 버전이 바로 보입니다.) */
function netFetch(req) {
  try {
    return fetch(req, { cache: 'no-cache' });
  } catch (e) {
    return fetch(req);
  }
}

function networkFirst(req) {
  return netFetch(req).then(function (res) {
    putCached(req, res);
    return res;
  }).catch(function () {
    return matchCached(req).then(function (hit) {
      if (hit) return hit;
      if (req.mode === 'navigate') return caches.match('./index.html');
      return caches.match(bareUrl(new URL('./index.html', self.location).href));
    }).then(function (res) {
      if (res) return res;
      return Response.error();
    });
  });
}

/* 캐시 우선 → 뒤에서 조용히 갱신 */
function cacheFirst(req) {
  return matchCached(req).then(function (hit) {
    if (hit) {
      fetch(req).then(function (res) { putCached(req, res); }).catch(function () {});
      return hit;
    }
    return networkFirst(req);
  });
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;

  var dest = req.destination || '';
  var isAppShell = req.mode === 'navigate' || dest === 'document' ||
    dest === 'script' || dest === 'style' || dest === 'worker';

  event.respondWith(isAppShell ? networkFirst(req) : cacheFirst(req));
});
