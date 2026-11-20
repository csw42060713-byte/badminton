/* ============================================================
 * timer.js — 드릴 옆 원탭 카운트다운 타이머 (한 번에 하나만)
 *
 * AI 추천 드릴 · 부상 예방 워밍업 항목 옆의 `⏱ 3분` / `⏱ 5분` 버튼이 씁니다.
 *  · 화면은 이 모듈이 그리는 위젯(span.dtimer)만 갈아 끼웁니다.
 *  · 새 타이머를 시작하면 돌던 타이머는 자동으로 멈춥니다(중복 타이머 방지).
 *  · 끝나면 짧은 진동 + 토스트로 알립니다.
 *  · 화면이 다시 그려져도 돌던 타이머는 이 모듈이 기억하고 이어서 보여 줍니다.
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};
  var U = BM.util;

  var TICK_MS = 250;
  var active = null;      /* {key,label,min,total,left,running,deadline} */
  var handle = null;      /* setInterval 핸들 */

  function hasDom() { return typeof document !== 'undefined' && !!document.querySelectorAll; }

  function fmt(sec) {
    var s = Math.max(0, Math.round(Number(sec) || 0));
    var m = Math.floor(s / 60);
    s = s % 60;
    return (m < 10 ? '0' + m : '' + m) + ':' + (s < 10 ? '0' + s : '' + s);
  }

  /* 남은 초 — now를 넣어 테스트에서 시계를 대신할 수 있습니다 */
  function remaining(t, now) {
    if (!t) return 0;
    if (!t.running) return Math.max(0, Math.round(t.left));
    if (t.deadline == null) return Math.max(0, Math.round(t.left));
    now = now == null ? Date.now() : now;
    return Math.max(0, Math.round((t.deadline - now) / 1000));
  }

  function isOn(key) { return !!active && active.key === key; }
  function activeKey() { return active ? active.key : ''; }

  /* 남은 초 (공개) — now를 넣어 시계를 대신할 수 있습니다 */
  function left(now) { return remaining(active, now == null ? Date.now() : now); }

  function state(now) {
    if (!active) return null;
    return {
      key: active.key, label: active.label, min: active.min, total: active.total,
      running: active.running, left: remaining(active, now)
    };
  }

  /* 시작 — 같은 키를 다시 누르면 그 길이로 새로 시작합니다 */
  function start(key, label, minutes, now) {
    now = now == null ? Date.now() : now;
    var min = Math.max(1, Math.round(Number(minutes) || 3));
    var replaced = !!active && active.key !== key && active.running;
    active = {
      key: String(key || ''),
      label: String(label || ''),
      min: min,
      total: min * 60,
      left: min * 60,
      running: true,
      deadline: now + min * 60000
    };
    ensureTick();
    paint();
    return { timer: state(now), replaced: replaced };
  }

  /* 일시정지 / 이어서 */
  function toggle(now) {
    if (!active) return null;
    now = now == null ? Date.now() : now;
    if (active.running) {
      active.left = remaining(active, now);
      active.running = false;
      stopTick();
    } else {
      active.running = true;
      active.deadline = now + active.left * 1000;
      ensureTick();
    }
    paint();
    return state(now);
  }

  function reset() {
    active = null;
    stopTick();
    paint();
    return null;
  }

  /* ---------- 화면 ---------- */
  function inner(key, label) {
    var name = label ? U.esc(label) + ' ' : '';
    if (!isOn(key)) {
      return '<button type="button" class="dtimer__btn" data-timer-start="' + U.esc(key) + '" data-timer-min="3"' +
        ' aria-label="' + name + '3분 타이머 시작">⏱ 3분</button>' +
        '<button type="button" class="dtimer__btn" data-timer-start="' + U.esc(key) + '" data-timer-min="5"' +
        ' aria-label="' + name + '5분 타이머 시작">⏱ 5분</button>';
    }
    var t = active;
    var left = remaining(t);
    return '<span class="dtimer__clock' + (t.running ? '' : ' is-paused') + '" data-timer-display="' + U.esc(key) + '">' +
        fmt(left) + '</span>' +
      '<button type="button" class="dtimer__icon" data-timer-toggle="' + U.esc(key) + '"' +
        ' aria-label="' + (t.running ? '타이머 일시정지' : '타이머 이어서') + '">' + (t.running ? '❙❙' : '▶') + '</button>' +
      '<button type="button" class="dtimer__icon" data-timer-reset="' + U.esc(key) + '" aria-label="타이머 초기화">✕</button>';
  }

  /* 항목 옆에 붙는 위젯 — 돌고 있는 타이머면 그 상태로 그립니다 */
  function widget(key, label) {
    return '<span class="dtimer' + (isOn(key) ? ' dtimer--on' : '') + '" data-dtimer="' + U.esc(key) + '"' +
      ' data-dtimer-name="' + U.esc(label || '') + '">' + inner(key, label) + '</span>';
  }

  /* 화면의 모든 위젯을 지금 상태로 다시 그립니다 (시작·정지·초기화 때만) */
  function paint() {
    if (!hasDom()) return;
    var list = document.querySelectorAll('[data-dtimer]');
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      var key = el.getAttribute('data-dtimer') || '';
      el.className = 'dtimer' + (isOn(key) ? ' dtimer--on' : '');
      el.innerHTML = inner(key, el.getAttribute('data-dtimer-name') || '');
    }
  }

  /* ---------- 1초 카운트다운 ---------- */
  function ensureTick() {
    if (handle) return;
    if (typeof setInterval !== 'function') return;
    handle = setInterval(tick, TICK_MS);
    if (handle && handle.unref) handle.unref();      /* node 테스트에서 프로세스를 붙잡지 않게 */
  }

  function stopTick() {
    if (!handle) return;
    if (typeof clearInterval === 'function') clearInterval(handle);
    handle = null;
  }

  function tick() {
    if (!active || !active.running) { stopTick(); return; }
    var left = remaining(active);
    if (left <= 0) { finish(); return; }
    if (!hasDom()) return;
    var list = document.querySelectorAll('[data-timer-display]');
    for (var i = 0; i < list.length; i++) list[i].textContent = fmt(left);
  }

  function finish() {
    var label = active ? active.label : '';
    var min = active ? active.min : 0;
    active = null;
    stopTick();
    paint();
    if (BM.util && BM.util.haptic) BM.util.haptic(220);
    if (BM.ui && BM.ui.toast) {
      BM.ui.toast((label ? label + ' ' : '') + min + '분 끝! 다음으로 넘어가요');
    }
  }

  BM.timer = {
    TICK_MS: TICK_MS,
    fmt: fmt, remaining: remaining, left: left,
    start: start, toggle: toggle, reset: reset, finish: finish,
    isOn: isOn, activeKey: activeKey, state: state,
    widget: widget, paint: paint
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
