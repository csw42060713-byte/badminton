/* ============================================================
 * util.js — 작은 도구 모음 (의존성 없음)
 * 모든 모듈은 window.BM 네임스페이스에 붙습니다.
 * 이 파일은 DOM/저장소가 없는 환경(테스트)에서도 로드됩니다.
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};

  /* ---------- 시간 ---------- */
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function ymd(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function stamp(d) {
    d = d || new Date();
    return ymd(d) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
  }

  function parseYmd(s) {
    if (!s) return null;
    var m = String(s).slice(0, 10).split('-');
    if (m.length !== 3) return null;
    return new Date(+m[0], +m[1] - 1, +m[2]);
  }

  function addDays(d, n) {
    var x = new Date(d.getTime());
    x.setDate(x.getDate() + n);
    return x;
  }

  var WEEK = ['일', '월', '화', '수', '목', '금', '토'];

  function dayLabel(s) {
    var d = parseYmd(s);
    if (!d) return s || '';
    return (d.getMonth() + 1) + '월 ' + d.getDate() + '일 (' + WEEK[d.getDay()] + ')';
  }

  function shortDay(s) {
    var d = parseYmd(s);
    if (!d) return s || '';
    return (d.getMonth() + 1) + '/' + d.getDate();
  }

  function relDay(s) {
    var d = parseYmd(s);
    if (!d) return '';
    var today = parseYmd(ymd());
    var diff = Math.round((today - d) / 86400000);
    if (diff === 0) return '오늘';
    if (diff === 1) return '어제';
    if (diff > 1 && diff < 7) return diff + '일 전';
    if (diff < 0) return '예정';
    return WEEK[d.getDay()];   /* 오래된 기록은 요일만 */
  }

  function timeAgo(isoish) {
    var d = isoish ? new Date(String(isoish).replace(' ', 'T')) : null;
    if (!d || isNaN(d.getTime())) return '';
    var diff = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diff < 1) return '방금';
    if (diff < 60) return diff + '분 전';
    if (diff < 1440) return Math.floor(diff / 60) + '시간 전';
    if (diff < 10080) return Math.floor(diff / 1440) + '일 전';
    return shortDay(ymd(d));
  }

  /* ---------- 숫자/문자 ---------- */
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function num(v, fallback) {
    var n = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, ''));
    return isFinite(n) ? n : (fallback === undefined ? 0 : fallback);
  }
  function sum(arr, pick) {
    var t = 0;
    for (var i = 0; i < arr.length; i++) t += pick ? pick(arr[i], i) : num(arr[i]);
    return t;
  }
  function uniq(arr) {
    var seen = {}, out = [];
    for (var i = 0; i < arr.length; i++) {
      var v = arr[i];
      if (v == null || v === '') continue;
      if (!seen[v]) { seen[v] = 1; out.push(v); }
    }
    return out;
  }
  function groupBy(arr, keyFn) {
    var out = {};
    for (var i = 0; i < arr.length; i++) {
      var k = keyFn(arr[i]);
      (out[k] = out[k] || []).push(arr[i]);
    }
    return out;
  }
  function sortBy(arr, keyFn, desc) {
    return arr.slice().sort(function (a, b) {
      var ka = keyFn(a), kb = keyFn(b);
      if (ka === kb) return 0;
      if (desc) return ka < kb ? 1 : -1;
      return ka > kb ? 1 : -1;
    });
  }
  function pct(a, b) { return b ? Math.round((a / b) * 100) : 0; }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function jsonParse(v, fallback) {
    if (v && typeof v === 'object') return v;
    if (typeof v !== 'string' || !v.trim()) return fallback;
    try { return JSON.parse(v); } catch (e) { return fallback; }
  }

  function truncate(s, n) {
    s = String(s == null ? '' : s);
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  /* ---------- ID ----------
   * 기존 시트와 같은 모양: Date.now() + 3자리 = 15~16자리 숫자 문자열.
   * 시트에서는 반드시 '텍스트'로 저장해야 1.79229E+15 로 깨지지 않습니다.
   */
  var recentIds = {}, idOrder = [];

  function uid() {
    var now = Date.now();
    for (var attempt = 0; attempt < 60; attempt++) {
      var id = String(now) + String(100 + Math.floor(Math.random() * 900));
      if (!recentIds[id]) {
        recentIds[id] = 1;
        idOrder.push(id);
        if (idOrder.length > 4000) delete recentIds[idOrder.shift()];
        return id;
      }
    }
    /* 같은 밀리초에 900개를 넘게 만들 일은 없지만, 안전장치 */
    return String(now) + String(100 + Math.floor(Math.random() * 900)) + String(Math.floor(Math.random() * 10));
  }

  function clientId() {
    var r = '';
    for (var i = 0; i < 4; i++) r += Math.random().toString(36).slice(2, 8);
    return 'c' + Date.now().toString(36) + r;
  }

  /* ---------- 타이밍 ---------- */
  function debounce(fn, wait) {
    var t = null;
    return function () {
      var self = this, args = arguments;
      if (t) clearTimeout(t);
      t = setTimeout(function () { t = null; fn.apply(self, args); }, wait == null ? 160 : wait);
    };
  }

  function throttle(fn, wait) {
    var last = 0, t = null;
    return function () {
      var self = this, args = arguments, now = Date.now();
      var run = function () { last = Date.now(); t = null; fn.apply(self, args); };
      if (now - last >= wait) run();
      else if (!t) t = setTimeout(run, wait - (now - last));
    };
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ---------- 저장소 (없으면 메모리) ---------- */
  function memoryStorage() {
    var map = {};
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null; },
      setItem: function (k, v) { map[k] = String(v); },
      removeItem: function (k) { delete map[k]; }
    };
  }

  var storage = (function () {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        localStorage.setItem('__bm_probe', '1');
        localStorage.removeItem('__bm_probe');
        return localStorage;
      }
    } catch (e) { /* 사생활 보호 모드 등 */ }
    return memoryStorage();
  })();

  function readJSON(key, fallback) {
    var raw = storage.getItem(key);
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch (e) { return fallback; }
  }

  function writeJSON(key, value) {
    try { storage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }

  /* ---------- 햅틱 ---------- */
  function haptic(ms) {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms || 8);
    } catch (e) { /* 무시 */ }
  }

  BM.util = {
    pad2: pad2, ymd: ymd, stamp: stamp, parseYmd: parseYmd, addDays: addDays,
    dayLabel: dayLabel, shortDay: shortDay, relDay: relDay, timeAgo: timeAgo, WEEK: WEEK,
    clamp: clamp, num: num, sum: sum, uniq: uniq, groupBy: groupBy, sortBy: sortBy, pct: pct,
    esc: esc, jsonParse: jsonParse, truncate: truncate,
    uid: uid, clientId: clientId,
    debounce: debounce, throttle: throttle, sleep: sleep,
    storage: storage, readJSON: readJSON, writeJSON: writeJSON, memoryStorage: memoryStorage,
    haptic: haptic
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
