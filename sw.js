/* ============================================================
 * sw.js — 앱 껍데기 오프라인 캐시
 * 네트워크(GET, 같은 주소)만 캐시합니다. 시트 브리지(다른 주소, POST)는
 * 서비스워커가 건드리지 않습니다.
 * 파일을 수정하면 VERSION을 올리면 새로 받습니다.
 * ============================================================ */
var VERSION = 'bm-v1.0.0';
var SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './js/util.js',
  './js/domain.js',
  './js/ai.js',
  './js/seed.js',
  './js/api.js',
  './js/store.js',
  './js/ui.js',
  './js/views/log.js',
  './js/views/matching.js',
  './js/views/community.js',
  './js/views/coach.js',
  './js/views/my.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/favicon.svg'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(VERSION).then(function (cache) {
      return cache.addAll(SHELL).catch(function () { /* 일부 파일이 없어도 설치는 진행 */ });
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

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) {
        /* 뒤에서 조용히 갱신 (stale-while-revalidate) */
        event.waitUntil(
          fetch(req).then(function (res) {
            if (res && res.ok) return caches.open(VERSION).then(function (c) { return c.put(req, res.clone()); });
          }).catch(function () {})
        );
        return hit;
      }
      return fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(VERSION).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match('./index.html');
      });
    })
  );
});
