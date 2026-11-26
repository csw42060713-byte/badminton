/* ============================================================
 * gear.js — 🏸 내 라켓 · 스트링 장력 메모 & 교체 알림 (bm-v1.76.0)
 *
 *  "저번에 무슨 스트링 몇 파운드로 언제 맸지?" 를 잊지 않게,
 *  내 라켓 모델 · 스트링 · 장력(lbs) · 교체한 날 · 교체 주기 · 한 줄 메모를
 *  MY 탭에 적어 두고, 교체 시기(주기 3일 전 ~ 지난 뒤)에 조용히 알려 줍니다.
 *
 *  저장: 새 시트 칸·새 DB 컬럼 없이 프로필 꾸미기 JSON(theme.gear) 한 칸.
 *        (theme 은 이미 jsonb/JSON 문자열 칸이라 기기·시트·Supabase 모두 그대로 따라옵니다)
 *          bm-v1.84.0 — 메인·서브 여러 자루는 theme.gears 배열에, 첫 자루는 예전 그대로
 *          theme.gear 에도 함께 적어 둡니다(예전 화면·저장값 호환).
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
  /* bm-v1.84.0 — 초심·여성 동호인이 많이 쓰는 21~23 lbs 를 앞에 더했습니다 (21~28) */
  var TENSIONS = [21, 22, 23, 24, 25, 26, 27, 28];
  var MAX_RACKETS = 5;          /* 한 사람이 기억해 둘 라켓 수 — 메인 + 서브 */
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
    return { racket: '', string: '', tension: 0, strungAt: '', cycleDays: 0, memo: '', custom: null };
  }

  /* bm-v1.80.0 — 커스텀 라켓(프레임·스트링·그립·스텐실·참)은 같은 theme.gear 안 custom 한 칸 */
  function customOf(o) {
    if (!BM.racketcustom) return null;
    return BM.racketcustom.normalizeCustom(o);
  }

  function hasGear(g) {
    if (!g) return false;
    if (text(g.racket, 24) || text(g.string, 20) || Number(g.tension)) return true;
    /* 색만 골라 둔 사람도 꾸미기 JSON이 지워지지 않게 */
    return !!(BM.racketcustom && BM.racketcustom.hasCustom(g.custom));
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
      memo: text(o.memo, 40),
      custom: customOf(o.custom)
    };
    if (!g.cycleDays && (g.racket || g.string || g.tension)) g.cycleDays = DEFAULT_CYCLE;
    return g;
  }

  /* 내 프로필(state.me · 저장된 프로필 행)에서 gear 를 꺼냅니다 (메인 라켓)
   *  · 저장 자리(진실)는 theme.gear — 화면용 me.gear 는 그 사본입니다.
   *    bm-v1.82.0 — 사본(me.gear)이 빈 값으로 남아 있어도 theme.gear 에 기록이 있으면
   *    그쪽을 읽어, 창을 다시 열 때 초기화된 것처럼 보이지 않게 했습니다. */
  function gearOf(me) {
    if (!me) return blank();
    var saved = (me.theme && me.theme.gear) || null;
    var mirror = me.gear || null;
    /* bm-v1.84.0 — theme.gear 가 진실입니다. 비어 있게 저장된 뒤 me.gear 사본이 남아 있으면
     * 사본을 쓰지 않고 '지운 그대로'를 따릅니다(지운 기록이 되살아나지 않게). */
    if (saved) return normalizeGear(saved);
    if (mirror && hasGear(mirror)) return normalizeGear(mirror);
    return blank();
  }

  /* 여러 자루 정리 — 배열·한 자루·JSON 문자열을 모두 받습니다.
   *  · 빈 기록은 빼고, 최대 MAX_RACKETS 자루까지 (메인 먼저). */
  function normalizeGearList(v) {
    if (typeof v === 'string') v = U.jsonParse(v, null);
    if (!v) return [];
    if (!Array.isArray(v)) v = [v];
    var out = [];
    v.forEach(function (o) {
      var g = normalizeGear(o);
      if (hasGear(g)) out.push(g);
    });
    return out.slice(0, MAX_RACKETS);
  }

  /* 내 라켓 모두 — theme.gears 가 있으면 그 목록, 없으면 예전 한 자루(theme.gear) */
  function listOf(me) {
    if (!me) return [];
    var raw = me.gears || (me.theme && me.theme.gears) || null;
    var list = raw ? normalizeGearList(raw) : [];
    if (list.length) return list;
    var one = gearOf(me);
    return hasGear(one) ? [one] : [];
  }

  /* 여러 자루 중 가장 급한 시기 — 교체 시기가 온 라켓을 먼저 보여 줍니다 */
  function worstOf(list, now) {
    var rank = { due: 4, soon: 3, nodate: 2, ok: 1, empty: 0 };
    var worst = null;
    (list || []).forEach(function (g) {
      var st = statusOf(g, now);
      if (!worst || (rank[st.state] || 0) > (rank[worst.state] || 0)) worst = st;
    });
    return worst;
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

  /* ---------- MY 카드 (여러 자루) ----------
   *  · 메인 라켓을 맨 위에 두고, 서브 라켓은 한 줄씩 붙입니다.
   *  · 교체 시기가 온 자루에는 그 줄에서 바로 '오늘 갈았어요' 칩이 보입니다. */
  function racketRowHtml(g, i, now) {
    var st = statusOf(g, now);
    var badge = st.state === 'due' ? '<span class="pill pill--no">줄 교체 시기!</span>'
      : st.state === 'soon' ? '<span class="pill pill--wait">곧 교체 D-' + st.daysLeft + '</span>'
        : '';
    return '<li class="gear__row" data-gear-row="' + i + '" data-gear-state="' + st.state + '">' +
      '<div class="gear__main">' +
      '<p class="gear__racket">' + U.esc(g.racket || '내 라켓') +
      (i === 0 ? '<span class="gear__tag">메인</span>' : '') + badge + '</p>' +
      (specText(g) ? '<p class="gear__spec">' + U.esc(specText(g)) + '</p>' : '') +
      (st.state === 'nodate'
        ? '<p class="gear__meta">교체한 날을 적으면 다음 시기를 알려드려요</p>'
        : '<p class="gear__meta">' + U.esc(st.meta) + '</p>') +
      (g.memo ? '<p class="gear__memo">' + U.esc(g.memo) + '</p>' : '') +
      (g.cycleDays ? '<p class="gear__cycle">교체 주기 ' + g.cycleDays + '일</p>' : '') +
      '</div>' +
      (g.strungAt
        ? '<button type="button" class="gear__restung" data-act="gear-restung" data-gear-idx="' + i + '"' +
          ' aria-label="' + U.esc((g.racket || '이 라켓') + ' 오늘 새 줄로 갈았어요') + '">오늘 갈았어요</button>'
        : '') +
      '</li>';
  }

  function cardHtml(state) {
    var now = (state && state.ui && state.ui.gearNow) || null;
    var list = listOf(state && state.me);
    var worst = worstOf(list, now) || statusOf(blank(), now);
    var pill = worst.state === 'due' ? '<span class="pill pill--no">줄 교체 시기!</span>'
      : worst.state === 'soon' ? '<span class="pill pill--wait">곧 교체 D-' + worst.daysLeft + '</span>'
        : worst.has ? '<span class="pill pill--ok">' + U.esc(worst.label) + '</span>'
          : '';
    var body;
    if (!list.length) {
      body = '<p class="gear__empty">라켓 · 스트링 · 장력을 한 번만 적어 두면, 다음에 몇 파운드로 맸는지 잊지 않아요. 메인·서브 여러 자루를 함께 적어 둘 수 있어요.</p>';
    } else {
      body = '<ul class="gear__list">' + list.map(function (g, i) {
        return racketRowHtml(g, i, now);
      }).join('') + '</ul>';
    }
    var hasStrung = list.some(function (g) { return !!g.strungAt; });
    return '' +
      '<section class="card gear" data-region="gear" data-gear-state="' + worst.state + '" data-gear-count="' + list.length + '">' +
      '<header class="card__head"><h2>🏸 내 라켓 · 스트링</h2>' + pill + '</header>' +
      body +
      '<div class="gear__acts">' +
      (list.length < MAX_RACKETS
        ? '<button type="button" class="btn ' + (list.length ? 'btn--ghost' : 'btn--primary') + ' btn--sm grow" data-act="gear-add">' +
          (list.length ? '+ 라켓 한 자루 더' : '내 라켓 기록하기') + '</button>'
        : '') +
      (list.length
        ? '<button type="button" class="btn ' + (list.length < MAX_RACKETS ? 'btn--ghost' : 'btn--primary') + ' btn--sm grow" data-act="gear-sheet">' +
          (hasStrung ? '수정' : '내 라켓 기록하기') + '</button>'
        : '') +
      /* bm-v1.80.0 — 커스텀 라켓(색·참) 입구 */
      '<button type="button" class="btn btn--ghost btn--sm" data-act="racket-sheet" aria-label="내 커스텀 라켓 꾸미기">🎨</button>' +
      '</div>' +
      '</section>';
  }

  /* ---------- 일지 & AI 위 한 줄 배너 (시기가 됐을 때만) ----------
   *  여러 자루면 가장 급한 자루를 알려 줍니다. */
  function bannerHtml(state) {
    var now = (state && state.ui && state.ui.gearNow) || null;
    var st = worstOf(listOf(state && state.me), now) || statusOf(blank(), now);
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

  /* 라켓 한 자루의 입력 묶음 — 자루마다 같은 칸이 하나씩 (bm-v1.84.0) */
  function gearBlock(g, i, total) {
    var cycle = g.cycleDays || DEFAULT_CYCLE;
    var today = U.ymd();
    return '<section class="gblock" data-gear-item data-gear-at="' + i + '">' +
      '<div class="gblock__h">' +
      '<span class="gblock__no">라켓 ' + (i + 1) + (i === 0 ? ' · 메인' : ' · 서브') + '</span>' +
      (total > 1
        ? '<button type="button" class="gblock__del" data-gear-del="' + i + '">이 자루 지우기</button>'
        : '') +
      '</div>' +

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
      '</section>';
  }

  function blocksHtml(list) {
    var arr = (list && list.length) ? list : [blank()];
    return arr.map(function (g, i) { return gearBlock(g, i, arr.length); }).join('');
  }

  function sheetBody(me, extra) {
    var list = listOf(me);
    var arr = list.length ? list.slice() : [blank()];
    /* '+ 라켓 한 자루 더'로 열면 빈 자루가 붙은 채로 시작합니다 (bm-v1.84.0) */
    if (extra && arr.length < MAX_RACKETS) arr.push(blank());
    return '' +
      '<div class="gearform" data-gear-form>' +
      '<p class="gblock__hint">메인 라켓을 첫 줄에, 서브 라켓은 아래에 한 자루씩 적어 두세요. 최대 ' + MAX_RACKETS + '자루까지 기억해 둬요.</p>' +
      '<div class="gblocks" data-gear-list>' + blocksHtml(arr) + '</div>' +
      '<button type="button" class="btn btn--ghost gadd" data-gear-add="1"' +
      (arr.length >= MAX_RACKETS ? ' disabled' : '') + '>+ 라켓 한 자루 더</button>' +
      '<div class="row gap8 mt16">' +
      '<button type="button" class="btn btn--ghost grow" data-close="1">닫기</button>' +
      '<button type="button" class="btn btn--primary grow" data-gear-save="1">저장</button></div>' +
      '<p class="hint">저장하면 MY 카드에 바로 보이고, 교체 주기가 3일 안으로 다가오면 알려 드려요. 교체 주기를 비워 두면 60일로 봅니다.</p>' +
      '</div>';
  }

  /* 한 자루 입력칸 읽기 */
  function readBlock(el) {
    function v(name) {
      var n = el ? el.querySelector('[data-gear="' + name + '"]') : null;
      return n ? n.value : '';
    }
    return normalizeGear({
      racket: v('racket'), string: v('string'), tension: v('tension'),
      strungAt: v('strungAt'), cycleDays: v('cycleDays'), memo: v('memo')
    });
  }

  /* 폼 안의 모든 자루 읽기 (빈 자루는 그대로 두고 저장할 때 거릅니다) */
  function readForm(wrap) {
    var items = wrap ? wrap.querySelectorAll('[data-gear-item]') : [];
    var out = [];
    Array.prototype.forEach.call(items, function (el) { out.push(readBlock(el)); });
    if (!out.length) out.push(blank());
    return out;
  }

  function openSheet(ctx, opts) {
    if (!hasDom || !BM.ui) return null;
    opts = opts || {};
    /* bm-v1.82.0 — 창을 열 때 적은 값(me)을 오래 들고 있지 않고, 그때그때 지금 상태에서 읽습니다.
     * (다른 곳에서 저장한 라켓·커스텀 색이 이 창의 예전 값에 덮여 사라지는 일 방지) */
    function meNow() {
      return (ctx && ctx.store && ctx.store.state && ctx.store.state.me) || {};
    }
    var wrap = BM.ui.openSheet({
      title: '🏸 내 라켓 · 스트링',
      body: sheetBody(meNow(), !!opts.add),
      onMount: function (host) {
        var form = host.querySelector('[data-gear-form]');
        if (!form) return;
        var listHost = form.querySelector('[data-gear-list]');
        function markPick(scope, kind, value) {
          Array.prototype.forEach.call(scope.querySelectorAll('[data-gear-pick="' + kind + '"]'), function (b) {
            var on = String(b.getAttribute('data-value')) === String(value);
            b.classList.toggle('is-on', on);
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
          });
        }
        /* 자루 목록을 다시 그립니다 — 지금 적힌 값은 먼저 읽어 두었다가 그대로 살립니다 */
        function paintList(list) {
          if (!listHost) return;
          listHost.innerHTML = blocksHtml(list);
          var add = form.querySelector('[data-gear-add]');
          if (add) add.disabled = list.length >= MAX_RACKETS;
        }
        form.addEventListener('click', function (ev) {
          var item = ev.target.closest('[data-gear-item]');
          var pick = ev.target.closest('[data-gear-pick]');
          if (pick && item) {
            ev.preventDefault();
            var kind = pick.getAttribute('data-gear-pick');
            var val = pick.getAttribute('data-value');
            var input = item.querySelector('[data-gear="' + kind + '"]');
            if (input) {
              /* 칩을 한 번 더 누르면 그 값은 지웁니다(직접 입력으로 바꿀 때) */
              var wasOn = pick.classList.contains('is-on');
              input.value = wasOn ? '' : val;
            }
            markPick(item, kind, input ? input.value : '');
            BM.ui.haptic(6);
            return;
          }
          if (ev.target.closest('[data-gear-today]') && item) {
            ev.preventDefault();
            var d = item.querySelector('[data-gear="strungAt"]');
            if (d) d.value = U.ymd();
            BM.ui.haptic(6);
            return;
          }
          if (ev.target.closest('[data-gear-add]')) {
            ev.preventDefault();
            var list = readForm(form);
            if (list.length >= MAX_RACKETS) {
              BM.ui.toast('라켓은 ' + MAX_RACKETS + '자루까지 기억할 수 있어요');
              return;
            }
            list.push(blank());
            paintList(list);
            BM.ui.haptic(8);
            return;
          }
          var del = ev.target.closest('[data-gear-del]');
          if (del) {
            ev.preventDefault();
            var at = Math.max(0, Number(del.getAttribute('data-gear-del')) || 0);
            var cur = readForm(form);
            cur.splice(at, 1);
            paintList(cur.length ? cur : [blank()]);
            BM.ui.haptic(6);
            return;
          }
          if (ev.target.closest('[data-gear-save]')) {
            ev.preventDefault();
            var got = readForm(form);
            /* bm-v1.80.0 — 라켓 기록을 고쳐도 커스텀 색(theme.gear.custom)은 그대로 */
            var prev = gearOf(meNow());
            if (got.length && prev && prev.custom) got[0].custom = prev.custom;
            var save = normalizeGearList(got);
            var res = null;
            if (ctx.actions.setGears) res = ctx.actions.setGears(save);
            else if (ctx.actions.setGear) res = ctx.actions.setGear(save[0] || blank());
            if (!res || !res.ok) {
              BM.ui.toast(res && res.reason === 'locked'
                ? '잠시만요, 저장 중이에요' : '저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.', 'error');
              return;
            }
            BM.ui.closeSheet();
            if (!save.length) BM.ui.toast('라켓 기록을 지웠어요');
            else if (save.length > 1) BM.ui.toast('라켓 ' + save.length + '자루를 저장했어요 · 교체 시기가 되면 알려 드릴게요');
            else {
              var st = statusOf(save[0], null);
              if (st.state === 'due') BM.ui.toast('저장했어요 · 이미 교체 시기예요. 오늘 갈았다면 한 번만 눌러 주세요');
              else if (st.state === 'soon') BM.ui.toast('저장했어요 · 교체까지 ' + st.daysLeft + '일 남았어요');
              else if (st.state === 'nodate') BM.ui.toast('저장했어요 · 교체한 날을 적으면 시기를 알려드려요');
              else BM.ui.toast('저장했어요 · 교체까지 ' + st.daysLeft + '일 남았어요');
            }
            BM.ui.haptic(12);
            if (ctx.repaint) ctx.repaint();
            return;
          }
        });
        form.addEventListener('input', function (ev) {
          var el = ev.target;
          var name = el.getAttribute && el.getAttribute('data-gear');
          if (!name) return;
          var item = el.closest('[data-gear-item]');
          if (item && (name === 'string' || name === 'tension' || name === 'cycleDays')) markPick(item, name, el.value);
        });
      }
    });
    return wrap;
  }

  /* 오늘 새 줄로 갈았어요 — 그 자루의 교체일만 오늘로 (여러 자루 중 idx) */
  function restung(ctx, idx) {
    if (!ctx || !ctx.actions) return { ok: false };
    var me = (ctx.store && ctx.store.state && ctx.store.state.me) || {};
    var list = listOf(me);
    var at = Math.max(0, Math.min(list.length - 1, Number(idx) || 0));
    if (!list.length) {
      if (BM.ui) BM.ui.toast('먼저 라켓을 기록해 주세요', 'error');
      return { ok: false, reason: 'empty' };
    }
    list[at] = normalizeGear(Object.assign({}, list[at], { strungAt: U.ymd() }));
    var res = ctx.actions.setGears ? ctx.actions.setGears(list)
      : (ctx.actions.setGear ? ctx.actions.setGear({ strungAt: U.ymd() }) : { ok: false });
    if (!res || !res.ok) {
      if (BM.ui) {
        BM.ui.toast(res && res.reason === 'locked'
          ? '잠시만요, 방금 저장했어요' : '기록하지 못했어요. 잠시 뒤 다시 눌러 주세요.', 'error');
      }
      return res || { ok: false };
    }
    var st = statusOf(list[at], null);
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
    var st = worstOf(listOf(state && state.me), now || null) || statusOf(blank(), now || null);
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
    STRINGS: STRINGS, TENSIONS: TENSIONS, CYCLES: CYCLES, MAX_RACKETS: MAX_RACKETS,
    DEFAULT_CYCLE: DEFAULT_CYCLE, SOON_DAYS: SOON_DAYS, NOTIFY_KEY: NOTIFY_KEY,
    blank: blank, normalizeGear: normalizeGear, hasGear: hasGear, gearOf: gearOf,
    normalizeGearList: normalizeGearList, listOf: listOf, worstOf: worstOf,
    statusOf: statusOf, specText: specText, gearBlock: gearBlock,
    cardHtml: cardHtml, bannerHtml: bannerHtml, sheetBody: sheetBody,
    openSheet: openSheet, restung: restung, readForm: readForm, readBlock: readBlock,
    notifyText: notifyText, notifyIfDue: notifyIfDue
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
