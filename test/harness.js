/* ============================================================
 * test/harness.js — 아주 작은 테스트 도구 (의존성 없음)
 * node:  node test/run.js
 * 브라우저 콘솔: BM.test.run()
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};
  var tests = [];
  var results = [];
  var finished = false;

  function test(name, fn) { tests.push({ name: name, fn: fn }); }

  function ok(value, message) {
    if (!value) throw new Error(message || '값이 참이어야 합니다');
  }
  function eq(actual, expected, message) {
    if (actual !== expected) {
      throw new Error((message || '값이 다릅니다') + ' → 기대: ' + JSON.stringify(expected) + ', 실제: ' + JSON.stringify(actual));
    }
  }
  function near(actual, expected, tol, message) {
    var t = tol == null ? 0.01 : tol;
    if (Math.abs(actual - expected) > t) {
      throw new Error((message || '값이 다릅니다') + ' → 기대: ' + expected + '±' + t + ', 실제: ' + actual);
    }
  }
  function includes(haystack, needle, message) {
    if (String(haystack).indexOf(needle) < 0) {
      throw new Error((message || '포함되어야 합니다') + ' → 찾음: ' + needle);
    }
  }
  function excludes(haystack, needle, message) {
    if (String(haystack).indexOf(needle) >= 0) {
      throw new Error((message || '포함되면 안 됩니다') + ' → 발견: ' + needle);
    }
  }
  function throws(fn, message) {
    var did = false;
    try { fn(); } catch (e) { did = true; }
    if (!did) throw new Error(message || '예외가 발생해야 합니다');
  }

  function run() {
    results = [];
    finished = false;
    var i = 0;
    function step() {
      if (i >= tests.length) { finished = true; return Promise.resolve(summary()); }
      var t = tests[i++];
      var out;
      try {
        out = t.fn();
      } catch (e) {
        results.push({ name: t.name, ok: false, error: String((e && e.message) || e) });
        return step();
      }
      return Promise.resolve(out).then(function () {
        results.push({ name: t.name, ok: true });
      }, function (e) {
        results.push({ name: t.name, ok: false, error: String((e && e.message) || e) });
      }).then(step);
    }
    return step();
  }

  function summary() {
    var failed = results.filter(function (r) { return !r.ok; });
    return { total: results.length, passed: results.length - failed.length, failed: failed.length, results: results };
  }

  BM.test = {
    test: test, ok: ok, eq: eq, near: near, includes: includes, excludes: excludes, throws: throws,
    run: run, results: function () { return results; }, finished: function () { return finished; },
    summary: summary, tests: tests
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
