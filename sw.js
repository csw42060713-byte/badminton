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
 * ============================================================ */
var VERSION = 'bm-v1.26.0';
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
  './js/ads.js',
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
