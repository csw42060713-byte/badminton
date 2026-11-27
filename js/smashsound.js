/* ============================================================
 * js/smashsound.js — bm-v1.90.0
 *   🔊 스매시 소리 — 효과마다 다른 소리 (불 · 얼음 · 번개 · 충격 링)
 *
 *   · 오디오 파일을 하나도 받지 않습니다. Web Audio(AudioContext)로 그 자리에서
 *     합성하므로 CSP(script-src 'self')·오프라인·앱 캐시에 그대로 맞습니다.
 *     (media-src 를 열 필요도, mp3 를 저장소에 넣을 필요도 없습니다.)
 *   · 브라우저 자동재생 규칙: AudioContext 는 사용자가 라켓을 톡 치거나
 *     ⚡ 스매시 단추를 누른 그 손짓 안에서 만들고 resume 합니다. 손짓 없이는
 *     아무 소리도 내지 않습니다.
 *   · 소리는 '층(layer)' 목록으로 정의합니다. 층은 값만 든 데이터라서
 *     테스트에서 효과별 소리가 정말 다른지 그대로 확인할 수 있습니다.
 *   · 스윙 소리는 지금(0ms) 시작하고, 정타음은 실제 임팩트 시각(HIT_AT)에
 *     맞춰 예약합니다 — 화면의 히트스톱과 소리가 같은 순간에 떨어집니다.
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM || (root.BM = {});

  var KEY = 'bm_sound_v1';
  var VOLUME = 0.42;
  var AC = null, MASTER = null, NOISE = null;
  var MUTED = false;

  /* 임팩트 시각 — js/racketcustom.js 의 WIND_MS(250) + SWING_MS(96) 와 같은 값.
   * 그 파일이 먼저 읽히지 않는 화면(테스트 등)에서도 소리만 따로 쓸 수 있게 복사해 둡니다. */
  var HIT_AT = 0.346;

  try {
    MUTED = !!(root.localStorage && root.localStorage.getItem(KEY) === 'off');
  } catch (e) { MUTED = false; }

  function supported() {
    return !!(root && (root.AudioContext || root.webkitAudioContext));
  }

  function persist() {
    try {
      if (root.localStorage) root.localStorage.setItem(KEY, MUTED ? 'off' : 'on');
    } catch (e) { /* 저장 못 해도 이번 화면에서는 그대로 동작 */ }
  }

  /* ---------- 잡음 완충 — 한 번만 만들어 모든 층이 나눠 씁니다 ---------- */
  function noiseBuffer(ac) {
    var len = Math.floor(ac.sampleRate * 0.7);
    var buf = ac.createBuffer(1, len, ac.sampleRate);
    var d = buf.getChannelData(0);
    var seed = 12345;
    for (var i = 0; i < len; i++) {
      /* 씨앗 난수 — 기기마다 같은 결이라 소리가 들쭉날쭉하지 않습니다 */
      seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
      d[i] = (seed / 0x7fffffff) * 2 - 1;
    }
    return buf;
  }

  function ctx() {
    if (!supported()) return null;
    if (AC) return AC;
    try {
      AC = new (root.AudioContext || root.webkitAudioContext)();
      MASTER = AC.createGain();
      MASTER.gain.value = MUTED ? 0 : VOLUME;
      MASTER.connect(AC.destination);
      NOISE = noiseBuffer(AC);
    } catch (e) {
      AC = null; MASTER = null; NOISE = null;
    }
    return AC;
  }

  /* 사용자 손짓 안에서 부릅니다 — 처음 만들거나 잠든 소리를 깨웁니다 */
  function unlock() {
    var ac = ctx();
    if (!ac) return false;
    if (ac.state === 'suspended' && ac.resume) {
      try { ac.resume(); } catch (e) { /* 다음 손짓에서 다시 */ }
    }
    return true;
  }

  /* ---------- 층 만들기 도우미 (값만 든 데이터) ---------- */
  function noise(at, dur, gain, freq, q, filter, freqTo) {
    return {
      kind: 'noise', at: at, dur: dur, gain: gain, freq: freq,
      q: q == null ? 1 : q, filter: filter || 'bandpass',
      freqTo: freqTo == null ? 0 : freqTo
    };
  }
  function tone(at, dur, gain, freq, type, freqTo) {
    return {
      kind: 'tone', at: at, dur: dur, gain: gain, freq: freq,
      type: type || 'sine', freqTo: freqTo == null ? 0 : freqTo
    };
  }

  /* ---------- 효과별 소리 설계 ----------
   *  기본  : 바람 가르는 스윙 + 거트 정타 "빡!"
   *  불꽃  : 정타 + "화르륵" 저음 열기 + 타닥타닥 불티
   *  얼음  : 정타 + "쨍그랑" 맑은 크리스탈 (2~5kHz 배음)
   *  번개  : 정타 + "찌릿" 방전 크랙 + 낮게 깔리는 우르릉
   *  바닥강타: 묵직한 "쿵!" + 충격파 링 공명
   */
  var LABEL = {
    none: '기본 스매시', fire: '불꽃 스매시', ice: '얼음 스매시',
    thunder: '번개 셔틀', slam: '바닥 강타'
  };

  function swingLayer(lo, hi, gain) {
    return noise(0.01, 0.30, gain == null ? 0.16 : gain, lo, 1.25, 'bandpass', hi);
  }
  function hitCore(out) {
    out.push(tone(HIT_AT, 0.170, 0.60, 210, 'sine', 62));      /* 손목·몸통이 실린 '퍽' */
    out.push(noise(HIT_AT, 0.060, 0.55, 1500, 1.1, 'bandpass'));  /* 거트 맞는 '빡' */
    out.push(noise(HIT_AT - 0.004, 0.022, 0.34, 3400, 0.8, 'highpass')); /* 채찍 끝 스냅 */
    return out;
  }

  function layers(fx, kind) {
    var k = kind === 'slam' ? 'slam' : 'air';
    var id = String(fx || 'none');
    var out = [];

    if (k === 'slam') {
      /* ① 라켓이 코트를 내려찍는 묵직한 저음 + ② 충격파 링이 코트를 타고 퍼지는 공명 */
      out.push(noise(0.01, 0.26, 0.18, 900, 1.2, 'bandpass', 2400));
      out.push(tone(HIT_AT, 0.560, 0.92, 132, 'sine', 34));      /* 쿵 */
      out.push(noise(HIT_AT, 0.320, 0.46, 300, 0.8, 'lowpass')); /* 코트 판 때리는 소리 */
      out.push(noise(HIT_AT + 0.008, 0.620, 0.26, 1180, 9, 'bandpass'));  /* 링 공명 1 */
      out.push(noise(HIT_AT + 0.008, 0.520, 0.18, 2140, 12, 'bandpass')); /* 링 공명 2 */
      out.push(noise(HIT_AT + 0.020, 0.090, 0.22, 5200, 1.2, 'highpass')); /* 파편 */
      return out;
    }

    if (id === 'fire') {
      out.push(swingLayer(600, 2100, 0.18));
      hitCore(out);
      /* 화르륵 — 낮게 번지는 열기, 끝으로 갈수록 힘이 빠집니다 */
      out.push(noise(HIT_AT + 0.004, 0.480, 0.40, 520, 0.9, 'lowpass', 130));
      out.push(tone(HIT_AT + 0.010, 0.340, 0.15, 86, 'sawtooth', 48));   /* 웅웅거리는 불길 */
      /* 타닥타닥 — 불티가 튀는 잔소리 */
      for (var f = 0; f < 6; f++) {
        out.push(noise(HIT_AT + 0.035 + f * 0.048, 0.038, 0.11 + (f % 3) * 0.02,
          900 + (f % 4) * 340, 3.2, 'bandpass'));
      }
      return out;
    }

    if (id === 'ice') {
      out.push(swingLayer(900, 3000, 0.15));
      hitCore(out);
      /* 쨍그랑 — 맑은 크리스탈 배음이 살짝씩 늦게 따라옵니다 */
      var CHIME = [2093, 2637, 3136, 4186, 5274];
      for (var c = 0; c < CHIME.length; c++) {
        out.push(tone(HIT_AT + 0.004 + c * 0.014, 0.30 + c * 0.045,
          0.13 - c * 0.014, CHIME[c], c % 2 ? 'triangle' : 'sine', 0));
      }
      out.push(noise(HIT_AT + 0.006, 0.300, 0.20, 5200, 0.9, 'highpass')); /* 얼음 가루 */
      out.push(tone(HIT_AT + 0.02, 0.180, 0.10, 784, 'sine', 0));          /* 몸통의 단단한 울림 */
      out.push(noise(HIT_AT + 0.055, 0.040, 0.14, 6400, 1.0, 'highpass')); /* 금 가는 소리 */
      return out;
    }

    if (id === 'thunder') {
      out.push(swingLayer(1100, 3600, 0.16));
      hitCore(out);
      /* 찌릿 — 짧은 방전 크랙이 연달아 터집니다 */
      for (var t = 0; t < 5; t++) {
        out.push(noise(HIT_AT + t * 0.024, 0.030, 0.34 - t * 0.03,
          1800 + (t % 3) * 900, 4.2, 'bandpass'));
      }
      out.push(tone(HIT_AT + 0.002, 0.260, 0.20, 2400, 'sawtooth', 90));  /* 지지직 내려오는 전류 */
      out.push(noise(HIT_AT + 0.060, 0.420, 0.17, 120, 0.7, 'lowpass'));  /* 멀리 우르릉 */
      return out;
    }

    /* 기본(그 밖의 효과 포함) — 스윙 + 정타 + 짧게 빠지는 바람 */
    out.push(swingLayer(700, 2800, 0.17));
    hitCore(out);
    out.push(noise(HIT_AT + 0.010, 0.180, 0.14, 900, 1.1, 'bandpass', 380));
    return out;
  }

  function signature(fx, kind) {
    return (kind === 'slam' ? 'slam' : String(fx || 'none')) + '|' +
      layers(fx, kind).map(function (l) {
        return l.kind + Math.round(l.freq) + ':' + Math.round(l.dur * 1000) + ':' + Math.round(l.gain * 100);
      }).join(',');
  }

  /* ---------- 실제 재생 ---------- */
  function playLayer(ac, l, t0) {
    var at = t0 + l.at;
    var end = at + Math.max(0.02, l.dur);
    var g = ac.createGain();
    g.gain.setValueAtTime(0, at);
    /* 8ms 어택 → 지수 감쇠 (딱딱 끊기지 않게) */
    g.gain.linearRampToValueAtTime(Math.max(0.0001, l.gain), at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    g.connect(MASTER);

    var src;
    if (l.kind === 'noise') {
      if (!NOISE) return;
      src = ac.createBufferSource();
      src.buffer = NOISE;
      src.loop = true;
      var flt = ac.createBiquadFilter();
      flt.type = l.filter;
      flt.frequency.setValueAtTime(Math.max(40, l.freq), at);
      if (l.freqTo) flt.frequency.exponentialRampToValueAtTime(Math.max(40, l.freqTo), end);
      flt.Q.value = l.q;
      src.connect(flt);
      flt.connect(g);
    } else {
      src = ac.createOscillator();
      src.type = l.type;
      src.frequency.setValueAtTime(Math.max(20, l.freq), at);
      if (l.freqTo) src.frequency.exponentialRampToValueAtTime(Math.max(20, l.freqTo), end);
      src.connect(g);
    }
    src.start(at);
    src.stop(end + 0.03);
    src.onended = function () {
      try { g.disconnect(); } catch (e) { /* 정리 */ }
    };
  }

  /* 라켓을 톡 치거나 ⚡ 스매시를 누른 그 순간에 한 번 — 소리 전체를 예약합니다 */
  function play(fx, kind) {
    if (MUTED) return false;
    var ac = ctx();               /* unlock() 은 성공 여부(boolean)를 돌려주므로 여기서는 ctx 를 직접 */
    if (!ac) return false;
    if (ac.state === 'suspended' && ac.resume) {
      try { ac.resume(); } catch (e) { /* 다음 손짓에서 다시 */ }
    }
    if (!MASTER) return false;
    var list = layers(fx, kind);
    var t0 = ac.currentTime + 0.005;
    for (var i = 0; i < list.length; i++) {
      try { playLayer(ac, list[i], t0); } catch (e) { /* 한 층이 실패해도 나머지는 재생 */ }
    }
    return true;
  }

  function muted() { return MUTED; }
  function setMuted(flag) {
    MUTED = !!flag;
    persist();
    var ac = AC;
    if (ac && MASTER) {
      try {
        MASTER.gain.cancelScheduledValues(ac.currentTime);
        MASTER.gain.setTargetAtTime(MUTED ? 0 : VOLUME, ac.currentTime, 0.02);
      } catch (e) { MASTER.gain.value = MUTED ? 0 : VOLUME; }
    }
    return MUTED;
  }
  function toggle() { return setMuted(!MUTED); }
  function label(fx, kind) {
    if (kind === 'slam') return LABEL.slam;
    return LABEL[String(fx || 'none')] || LABEL.none;
  }

  BM.smashsound = {
    supported: supported,
    unlock: unlock,
    play: play,
    layers: layers,
    signature: signature,
    label: label,
    muted: muted,
    setMuted: setMuted,
    toggle: toggle,
    HIT_AT: HIT_AT,
    VOLUME: VOLUME
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
