/* ============================================================
 * gear.js — 🏸 내 라켓 · 스트링 장력 메모 & 교체 알림 (bm-v1.76.0)
 *
 *  "저번에 무슨 스트링 몇 파운드로 언제 맸지?" 를 잊지 않게,
 *  내 라켓 모델 · 스트링 · 장력(lbs) · 교체한 날 · 교체 주기 · 한 줄 메모를
 *  MY 탭에 적어 두고, 교체 시기(주기 3일 전 ~ 지난 뒤)에 조용히 알려 줍니다.
 *
 *  저장: 새 시트 칸·새 DB 컬럼 없이 프로필 꾸미기 JSON(theme.gear) 한 칸.
 *        (theme 은 이미 jsonb/JSON 문자열 칸이라 기기·시트·Supabase 모두 그대로 따라옵니다)
 *  알림: 브라우저 알림은 허용한 사람에게만, 하루 한 번(같은 날 중복 없음).
 *        화면이 보이는 중에는 MY 카드·일지 위 한 줄 배너로만 알립니다.
 *
 *  실존 선수 이름은 예시·문구에 쓰지 않습니다(모델·스트링 이름만).
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};
  var U = BM.util;

  /* 자주 쓰는 프리셋 — 칩으로 1탭, 아니면 직접 입력 */
  var STRINGS = ['BG65', 'BG80', '에어로바이트', '엑스볼트63'];
  var TENSIONS = [24, 25, 26, 27, 28];
  var CYCLES = [30, 45, 60, 90];

  var MIN_TENSION = 15;
  var MAX_TENSION = 35;
  var DEFAULT_CYCLE = 60;      /* 주기를 비워 두면 60일로 봅니다 */
  var MIN_CYCLE = 7;
  var MAX_CYCLE = 365;
  var SOON_DAYS = 3;           /* 3일 안으로 다가오면 미리 알림 */
  var NOTIFY_KEY = 'bm_gear_notified_v1';

  var hasDom = typeof document !== 'undefined';

  function text(v, max) {
    var s = String(v == null ? '' : v).replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
    return s.length > max ? s.slice(0, max) : s;
  }

  function ymdOf(v) {
    var s = String(v == null ? '' : v).trim().slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
  }

  function intOf(v, lo, hi) {
    var n = U.num(v, 0);
    if (!n) return 0;
    return Math.max(lo, Math.min(hi, Math.round(n)));
  }

  function blank() {
    return { racket: '', string: '', tension: 0, strungAt: '', cycleDays: 0, memo: '' };
  }

  function hasGear(g) {
    if (!g) return false;
    return !!(text(g.racket, 24) || text(g.string, 20) || Number(g.tension));
  }

  /* 저장·표시에 쓰는 모양으로 정리합니다. 예전에 저장된 값·직접 입력 모두 받습니다. */
  function normalizeGear(o) {
    if (typeof o === 'string') o = U.jsonParse(o, null);
    if (!o || typeof o !== 'object') return blank();
    var g = {
      racket: text(o.racket, 24),
      string: text(o.string, 20),
      tension: intOf(o.tension, MIN_TENSION, MAX_TENSION),
      strungAt: ymdOf(o.strungAt),
      cycleDays: intOf(o.cycleDays, MIN_CYCLE, MAX_CYCLE),
      memo: text(o.memo, 40)
    };
    if (!g.cycleDays && (g.racket || g.string || g.tension)) g.cycleDays = DEFAULT_CYCLE;
    return g;
  }

  /* 내 프로필(state.me · 저장된 프로필 행)에서 gear 를 꺼냅니다 */
  function gearOf(me) {
    if (!me) return blank();
    var raw = me.gear || (me.theme && me.theme.gear) || null;
    return raw ? normalizeGear(raw) : blank();
  }

  function dayMs() { return 86400000; }

  /* 교체 시기 계산 — 순수 함수 (today 를 넘기면 그 날 기준) */
  function statusOf(g, now) {
    g = normalizeGear(g);
    var out = {
      gear: g, has: hasGear(g),
      state: 'empty',          /* empty · nodate · ok · soon · due */
      daysSince: 0, daysLeft: 0, cycle: g.cycleDays || DEFAULT_CYCLE,
      label: '', meta: '', badge: '', line: ''
    };
    if (!out.has) {
      out.label = '아직 안 적음';
      return out;
    }
    if (!g.strungAt) {
      out.state = 'nodate';
      out.label = '교체일 미입력';
      out.meta = '교체한 날을 적으면 다음 시기를 알려드려요';
      return out;
    }
    var today = now ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
      : U.parseYmd(U.ymd());
    var d = U.parseYmd(g.strungAt);
    if (!today || !d) {
      out.state = 'nodate';
      out.label = '교체일 미입력';
      return out;
    }
    var since = Math.round((today.getTime() - d.getTime()) / dayMs());
    if (since < 0) since = 0;                 /* 앞날짜로 적어도 D+0 으로 */
    out.daysSince = since;
    out.daysLeft = out.cycle - since;
    out.state = out.daysLeft <= 0 ? 'due' : (out.daysLeft <= SOON_DAYS ? 'soon' : 'ok');
    out.label = 'D+' + since;
    var when = g.strungAt.slice(5, 7).replace(/^0/, '') + '/' + g.strungAt.slice(8, 10).replace(/^0/, '') + ' 맴';
    out.line = '교체까지 ' + out.daysLeft + '일 남았어요';
    if (out.state === 'due') {
      out.badge = '줄 교체 시기!';
      out.line = '주기보다 ' + (-out.daysLeft) + '일 지났어요' + (out.daysLeft === 0 ? ' · 오늘이 교체일이에요' : '');
      out.meta = when + ' · D+' + since + '일 · ' + out.line;
    } else if (out.state === 'soon') {
      out.badge = '곧 교체 D-' + out.daysLeft;
      out.meta = when + ' · ' + out.line;
    } else {
      out.badge = '';
      out.meta = when + ' · ' + out.line;
    }
    return out;
  }

  function specText(g) {
    g = normalizeGear(g);
    var parts = [];
    if (g.string) parts.push(g.string);
    if (g.tension) parts.push(g.tension + ' lbs');
    return parts.join(' · ');
  }

  function dueNow(st) {
    return !!st && (st.state === 'due' || st.state === 'soon');
  }

  /* ---------- MY 카드 ---------- */
  function cardHtml(state) {
    var st = statusOf(gearOf(state && state.me), (state && state.ui && state.ui.gearNow) || null);
    var g = st.gear;
    var pill = st.state === 'due' ? '<span class="pill pill--no">줄 교체 시기!</span>'
      : st.state === 'soon' ? '<span class="pill pill--wait">곧 교체 D-' + st.daysLeft + '</span>'
        : st.has ? '<span class="pill pill--ok">' + U.esc(st.label) + '</span>'
          : '';
    var body;
    if (!st.has) {
      body = '<p class="gear__empty">라켓 · 스트링 · 장력을 한 번만 적어 두면, 다음에 몇 파운드로 맸는지 잊지 않아요.</p>';
    } else {
      body = '<div class="gear__main">' +
        '<p class="gear__racket">' + U.esc(g.racket || '내 라켓') + '</p>' +
        (specText(g) ? '<p class="gear__spec">' + U.esc(specText(g)) + '</p>' : '') +
        (st.state === 'nodate'
          ? '<p class="gear__meta">교체한 날을 적으면 다음 시기를 알려드려요</p>'
          : '<p class="gear__meta">' + U.esc(st.meta) + '</p>') +
        (g.memo ? '<p class="gear__memo">' + U.esc(g.memo) + '</p>' : '') +
        (g.cycleDays ? '<p class="gear__cycle">교체 주기 ' + g.cycleDays + '일</p>' : '') +
        '</div>';
    }
    return '' +
      '<section class="card gear" data-region="gear" data-gear-state="' + st.state + '">' +
      '<header class="card__head"><h2>🏸 내 라켓 · 스트링</h2>' + pill + '</header>' +
      body +
      '<div class="gear__acts">' +
      (st.has && g.strungAt
        ? '<button type="button" class="btn btn--primary btn--sm grow" data-act="gear-restung">오늘 새 줄로 갈았어요</button>'
        : '') +
      '<button type="button" class="btn btn--ghost btn--sm' + (st.has && g.strungAt ? '' : ' grow') + '" data-act="gear-sheet">' +
      (st.has ? '수정' : '내 라켓 기록하기') + '</button>' +
      '</div>' +
      '</section>';
  }

  /* ---------- 일지 & AI 위 한 줄 배너 (시기가 됐을 때만) ---------- */
  function bannerHtml(state) {
    var st = statusOf(gearOf(state && state.me), (state && state.ui && state.ui.gearNow) || null);
    if (!dueNow(st)) return '';
    var g = st.gear;
    var head = st.state === 'due' ? '줄 교체 시기예요' : '줄 갈 때가 다가와요';
    var spec = specText(g);
    return '' +
      '<button type="button" class="gearline gearline--' + st.state + '" data-act="gear-sheet" data-gear-state="' + st.state + '">' +
      '<span class="gearline__ico" aria-hidden="true">🏸</span>' +
      '<span class="gearline__txt">' +
      '<span class="gearline__t">' + U.esc(head) + (spec ? ' · ' + U.esc(spec) : '') + '</span>' +
      '<span class="gearline__s">' + U.esc(st.line) + ' · 눌러서 오늘 갈았다고 표시</span>' +
      '</span>' +
      '<svg class="ico gearline__car" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>' +
      '</button>';
  }

  /* ---------- 편집 시트 ---------- */
  function pickRow(kind, values, current) {
    return '<div class="gpick">' + values.map(function (v) {
      var on = String(v) === String(current == null ? '' : current);
      return '<button type="button" class="gpick__b' + (on ? ' is-on' : '') + '" data-gear-pick="' + kind + '"' +
        ' data-value="' + U.esc(v) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + U.esc(v) + '</button>';
    }).join('') + '</div>';
  }

  function sheetBody(me) {
    var g = gearOf(me);
    var cycle = g.cycleDays || DEFAULT_CYCLE;
    var today = U.ymd();
    return '' +
      '<div class="gearform" data-gear-form>' +
      '<label class="gfield"><span class="gfield__l">라켓 모델</span>' +
      '<input type="text" maxlength="24" data-gear="racket" value="' + U.esc(g.racket) + '" placeholder="예: 아스트록스 88D 프로" enterkeyhint="next"></label>' +

      '<div class="gfield"><div class="gfield__l">스트링<small>자주 쓰는 것</small></div>' +
      pickRow('string', STRINGS, g.string) +
      '<input type="text" maxlength="20" data-gear="string" value="' + U.esc(g.string) + '" placeholder="직접 입력 (예: BG80)" enterkeyhint="next"></div>' +

      '<div class="gfield"><div class="gfield__l">장력 <small>lbs</small></div>' +
      '<div class="gfield__row">' + pickRow('tension', TENSIONS, g.tension) +
      '<input class="gfield__num" type="number" inputmode="numeric" min="' + MIN_TENSION + '" max="' + MAX_TENSION + '" step="1" data-gear="tension" value="' + (g.tension || '') + '" placeholder="26" aria-label="장력 직접 입력"></div></div>' +

      '<div class="gfield"><div class="gfield__l">교체한 날<small>새 줄로 맨 날</small></div>' +
      '<div class="grow-row">' +
      '<input type="date" data-gear="strungAt" value="' + U.esc(g.strungAt) + '" max="' + today + '">' +
      '<button type="button" class="btn btn--ghost btn--sm" data-gear-today="1">오늘</button></div></div>' +

      '<div class="gfield"><div class="gfield__l">교체 주기<small>보통 며칠마다</small></div>' +
      '<div class="gfield__row">' + pickRow('cycleDays', CYCLES, cycle) +
      '<input class="gfield__num" type="number" inputmode="numeric" min="' + MIN_CYCLE + '" max="' + MAX_CYCLE + '" step="1" data-gear="cycleDays" value="' + cycle + '" placeholder="60" aria-label="교체 주기 직접 입력(일)"></div></div>' +

      '<label class="gfield"><span class="gfield__l">한 줄 메모<small>선택</small></span>' +
      '<input type="text" maxlength="40" data-gear="memo" value="' + U.esc(g.memo) + '" placeholder="예: 26은 조금 팽팽, 25가 편함"></label>' +

      '<div class="row gap8 mt16">' +
      '<button type="button" class="btn btn--ghost grow" data-close="1">닫기</button>' +
      '<button type="button" class="btn btn--primary grow" data-gear-save="1">저장</button></div>' +
      '<p class="hint">저장하면 MY 카드에 바로 보이고, 교체 주기가 3일 안으로 다가오면 알려 드려요. 교체 주기를 비워 두면 60일로 봅니다.</p>' +
      '</div>';
  }

  function readForm(wrap) {
    function v(name) {
      var n = wrap.querySelector('[data-gear="' + name + '"]');
      return n ? n.value : '';
    }
    return normalizeGear({
      racket: v('racket'), string: v('string'), tension: v('tension'),
      strungAt: v('strungAt'), cycleDays: v('cycleDays'), memo: v('memo')
    });
  }

  function openSheet(ctx) {
    if (!hasDom || !BM.ui) return null;
    var me = (ctx && ctx.store && ctx.store.state && ctx.store.state.me) || {};
    var wrap = BM.ui.openSheet({
      title: '🏸 내 라켓 · 스트링',
      body: sheetBody(me),
      onMount: function (host) {
        var form = host.querySelector('[data-gear-form]');
        if (!form) return;
        function field(name) { return form.querySelector('[data-gear="' + name + '"]'); }
        function markPick(kind, value) {
          Array.prototype.forEach.call(form.querySelectorAll('[data-gear-pick="' + kind + '"]'), function (b) {
            var on = String(b.getAttribute('data-value')) === String(value);
            b.classList.toggle('is-on', on);
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
          });
        }
        form.addEventListener('click', function (ev) {
          var pick = ev.target.closest('[data-gear-pick]');
          if (pick) {
            ev.preventDefault();
            var kind = pick.getAttribute('data-gear-pick');
            var val = pick.getAttribute('data-value');
            var input = field(kind);
            if (input) {
              /* 칩을 한 번 더 누르면 그 값은 지웁니다(직접 입력으로 바꿀 때) */
              var wasOn = pick.classList.contains('is-on');
              input.value = wasOn ? '' : val;
            }
            markPick(kind, input ? input.value : '');
            BM.ui.haptic(6);
            return;
          }
          if (ev.target.closest('[data-gear-today]')) {
            ev.preventDefault();
            var d = field('strungAt');
            if (d) d.value = U.ymd();
            BM.ui.haptic(6);
            return;
          }
          if (ev.target.closest('[data-gear-save]')) {
            ev.preventDefault();
            var g = readForm(form);
            var res = ctx.actions.setGear ? ctx.actions.setGear(g) : { ok: false };
            if (!res || !res.ok) {
              BM.ui.toast(res && res.reason === 'locked'
                ? '잠시만요, 저장 중이에요' : '저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.', 'error');
              return;
            }
            BM.ui.closeSheet();
            var st = statusOf(g, null);
            if (!st.has) BM.ui.toast('라켓 기록을 지웠어요');
            else if (st.state === 'due') BM.ui.toast('저장했어요 · 이미 교체 시기예요. 오늘 갈았다면 한 번만 눌러 주세요');
            else if (st.state === 'soon') BM.ui.toast('저장했어요 · 교체까지 ' + st.daysLeft + '일 남았어요');
            else if (st.state === 'nodate') BM.ui.toast('저장했어요 · 교체한 날을 적으면 시기를 알려드려요');
            else BM.ui.toast('저장했어요 · 교체까지 ' + st.daysLeft + '일 남았어요');
            BM.ui.haptic(12);
            if (ctx.repaint) ctx.repaint();
            return;
          }
        });
        form.addEventListener('input', function (ev) {
          var el = ev.target;
          var name = el.getAttribute && el.getAttribute('data-gear');
          if (!name) return;
          if (name === 'string' || name === 'tension' || name === 'cycleDays') markPick(name, el.value);
        });
      }
    });
    return wrap;
  }

  /* 오늘 새 줄로 갈았어요 — 교체일만 오늘로 갱신합니다 */
  function restung(ctx) {
    if (!ctx || !ctx.actions || !ctx.actions.setGear) return { ok: false };
    var res = ctx.actions.setGear({ strungAt: U.ymd() });
    if (!res || !res.ok) {
      if (BM.ui) {
        BM.ui.toast(res && res.reason === 'locked'
          ? '잠시만요, 방금 저장했어요' : '기록하지 못했어요. 잠시 뒤 다시 눌러 주세요.', 'error');
      }
      return res || { ok: false };
    }
    var st = statusOf(res.gear || gearOf(ctx.store && ctx.store.state && ctx.store.state.me), null);
    if (BM.ui) {
      BM.ui.toast('오늘 새 줄로 갈았어요 · 다음 교체까지 ' + st.daysLeft + '일');
      BM.ui.haptic(12);
    }
    if (ctx.repaint) ctx.repaint();
    return res;
  }

  /* ---------- 브라우저 알림 (허용한 사람에게만 · 하루 한 번) ---------- */
  function notifyText(st) {
    var spec = specText(st.gear);
    var head = st.state === 'due' ? '줄 교체 시기예요' : '줄 갈 때가 다가와요';
    return {
      title: '셔틀릭스 · ' + head,
      body: [spec, st.line, '오늘 갈았다면 MY › 내 라켓에서 한 번만 눌러 주세요'].filter(Boolean).join(' · '),
      tag: 'bm-gear'
    };
  }

  function alreadyToday(now) {
    var last = U.readJSON(NOTIFY_KEY, null) || {};
    return last.date === U.ymd(now || undefined);
  }

  function notifyIfDue(state, now) {
    var st = statusOf(gearOf(state && state.me), now || null);
    if (!dueNow(st)) return false;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
    /* 화면을 보고 있을 때는 카드·배너로 충분합니다 */
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') return false;
    if (alreadyToday(now)) return false;
    var msg = notifyText(st);
    U.writeJSON(NOTIFY_KEY, { date: U.ymd(now || undefined), at: U.stamp(now || undefined), state: st.state });
    var options = {
      body: msg.body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: msg.tag, data: { kind: 'gear' }
    };
    /* 안드로이드 크롬은 new Notification() 대신 서비스워커 알림만 됩니다 */
    try {
      if (typeof navigator !== 'undefined' && navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then(function (reg) {
          if (reg && typeof reg.showNotification === 'function') return reg.showNotification(msg.title, options);
        }).catch(function () { /* 권한·지원 문제는 조용히 넘어감 */ });
        return true;
      }
    } catch (e) { /* 서비스워커 없이도 아래로 시도 */ }
    try { new Notification(msg.title, options); } catch (e) { /* 알림을 못 띄우는 브라우저 */ }
    return true;
  }

  BM.gear = {
    STRINGS: STRINGS, TENSIONS: TENSIONS, CYCLES: CYCLES,
    DEFAULT_CYCLE: DEFAULT_CYCLE, SOON_DAYS: SOON_DAYS, NOTIFY_KEY: NOTIFY_KEY,
    blank: blank, normalizeGear: normalizeGear, hasGear: hasGear, gearOf: gearOf,
    statusOf: statusOf, specText: specText,
    cardHtml: cardHtml, bannerHtml: bannerHtml, sheetBody: sheetBody,
    openSheet: openSheet, restung: restung, readForm: readForm,
    notifyText: notifyText, notifyIfDue: notifyIfDue
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
