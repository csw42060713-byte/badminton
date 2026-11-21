/* ============================================================
 * views/log.js — 일지 & AI
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};
  var U = BM.util, D = BM.domain;
  var UI = BM.ui;
  BM.views = BM.views || {};

  function fillOf(v) {
    return Math.round((U.clamp(v == null ? 5 : v, 1, 10) - 1) / 9 * 100);
  }

  /* 영상 링크 입력칸 아래 한 줄 안내 — http(s)가 아니면 저장되지 않는다고 미리 알려 줍니다 */
  function videoHintOf(v) {
    var raw = String(v == null ? '' : v).trim();
    if (!raw) return { text: '링크만 저장해요 · 영상 파일은 앱에 올리지 않아요', bad: false };
    if (!D.safeVideoUrl(raw)) return { text: 'http:// 또는 https:// 주소만 열 수 있어요', bad: true };
    return { text: '저장한 일지에서 ‘영상 보기’로 새 창에 열려요', bad: false };
  }

  /* ---------- 게임 점수 (여러 게임 · 21/25점제) ---------- */
  function draftGames(d) {
    if (d.games && d.games.length) return d.games;
    if (d.score) return [{ a: d.score.a, b: d.score.b }];
    return [{ a: '', b: '' }];
  }

  function gamesSummaryText(games) {
    var sum = D.gamesSummary(D.cleanGames(games));
    if (!sum.count) return '점수를 넣으면 승패를 자동으로 계산해요';
    return sum.count + '경기 · ' + sum.wins + '승 ' + sum.losses + '패' +
      (sum.draws ? ' ' + sum.draws + '무' : '') + ' → <b>' + U.esc(sum.result) + '</b>';
  }

  /* 프로필에서 유형에 맞는 안내를 고를 때 쓰는 헬퍼 (domain.proVisible) */

  function roleOf(state) {
    return D.roleOf((state && state.me) || {});
  }

  function roleLabel(state) {
    var r = D.roleById(roleOf(state));
    return r ? r.label : '';
  }

  /* ============================================================
   * 선수용 7대 훈련 (bm-v1.40.0)
   *  · 선수 유형이면 일지 첫머리 '완료 훈련' 칸 대신 이 블록이 보입니다.
   *  · 항목을 누르면 체크되면서 '어떤 걸 했는지' 적는 칸이 바로 열립니다.
   *  · 저장: 체크한 이름은 기존 '완료훈련' 칸으로, 적은 내용은 '훈련계획'
   *    JSON 칸(plan.pro)으로 들어갑니다 — 시트 26칸·Supabase 그대로.
   * ============================================================ */
  function proOn(state) {
    return D.proVisible ? D.proVisible(state && state.me, state && state.proPref) : roleOf(state) === 'player';
  }

  function proBlock(state, d) {
    var pro = D.normalizePro((d && d.pro) || {});
    return '<div class="field" data-pro-block>' +
      '<div class="field__label"><span>선수 7대 훈련</span><small>체크하면 적는 칸이 열려요</small></div>' +
      '<ul class="prolist">' + D.PRO_ITEMS.map(function (it) {
        var on = Object.prototype.hasOwnProperty.call(pro, it.name);
        var text = on ? String(pro[it.name] || '') : '';
        return '<li class="pro' + (on ? ' is-on' : '') + '" data-pro="' + U.esc(it.name) + '">' +
          '<button type="button" class="pro__top" data-pro-toggle="' + U.esc(it.name) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
          '<span class="pro__box" aria-hidden="true">' + (on ? '✓' : '') + '</span>' +
          '<span class="pro__name">' + U.esc(it.name) + '</span>' +
          '<span class="pro__sum">' + U.esc(text) + '</span></button>' +
          '<input type="text" class="pro__note" maxlength="' + D.PRO_MAX + '" enterkeyhint="done" data-field="proNote" data-pro-note data-pro-name="' + U.esc(it.name) + '"' +
          ' value="' + U.esc(text) + '" placeholder="' + U.esc(it.hint) + '"' +
          ' aria-label="' + U.esc(it.name) + ' 어떤 걸 했는지"' + (on ? '' : ' hidden') + '>' +
          '</li>';
      }).join('') + '</ul>' +
      '<p class="pro__foot">체크한 항목은 완료 훈련으로, 적은 내용은 일지에 그대로 쌓여요.</p>' +
      '</div>';
  }

  /* 완료 훈련 칩 — 지난 기록을 고칠 때 7대 훈련 이름이 초안에 남아 있으면
   * 칩 목록에 없어 사라지지 않도록 뒤에 붙여 줍니다. */
  function doneOptions(d) {
    var base = D.VOCAB.done.slice();
    ((d && d.done) || []).forEach(function (v) {
      var name = String(v == null ? '' : v).trim();
      if (name && base.indexOf(name) < 0) base.push(name);
    });
    return base;
  }

  function doneField(d) {
    return '<div class="field"><div class="field__label"><span>완료 훈련</span><small>여러 개 선택</small></div>' +
      UI.chips('done', doneOptions(d), d.done, { scroll: true }) + '</div>';
  }

  /* 코치 유형 안내 — 피드백 흐름으로 바로 이어지게 (bm-v1.40.0)
   *  다른 유형에게는 아무것도 그리지 않아 첫 화면이 짧습니다. */
  function roleHint(state) {
    if (roleOf(state) !== 'coach') return '';
    return '<section class="card card--rolehint" data-region="rolehint" data-sig="coach">' +
      '<div class="rolehint">' +
      '<p class="rolehint__t">' + roleLabel(state) + ' 유형으로 시작했어요</p>' +
      '<p class="rolehint__s">코치 탭에서 선수 일지를 모아 보고 한 줄 피드백을 남길 수 있어요.</p>' +
      '<button type="button" class="btn btn--ghost btn--sm mt8" data-act="go-coach">코치 탭 열기</button>' +
      '</div></section>';
  }

  function gameRowHtml(g, i, total) {
    var a = g && g.a != null ? g.a : '';
    var b = g && g.b != null ? g.b : '';
    return '<div class="gamerow" data-game="' + i + '">' +
      '<span class="gamerow__n">' + (total > 1 ? (i + 1) + '게임' : '게임') + '</span>' +
      '<input type="number" inputmode="numeric" min="0" max="30" step="1" data-field="gameA" data-gi="' + i + '" ' +
        'value="' + U.esc(a) + '" placeholder="나" aria-label="' + (i + 1) + '게임 내 점수">' +
      '<span class="colon">:</span>' +
      '<input type="number" inputmode="numeric" min="0" max="30" step="1" data-field="gameB" data-gi="' + i + '" ' +
        'value="' + U.esc(b) + '" placeholder="상대" aria-label="' + (i + 1) + '게임 상대 점수">' +
      (total > 1
        ? '<button type="button" class="gamerow__del" data-act="remove-game" data-gi="' + i + '" aria-label="' + (i + 1) + '게임 지우기">−</button>'
        : '') +
    '</div>';
  }

  function gamesRows(games) {
    return games.map(function (g, i) { return gameRowHtml(g, i, games.length); }).join('');
  }

  /* ---------- 최근·자주 친 복식 파트너 (bm-v1.35.0) ----------
   *  운동 앱들이 '최근 함께한 상대'를 칩으로 띄우듯, 일지에 적어 둔 파트너 이름을
   *  자주·최근 순으로 최대 4개 보여 주고 1탭으로 입력합니다.
   *  · 기록이 4개보다 적으면 친구 목록 닉네임으로 채웁니다(이미 있는 이름·나 자신 제외).
   *  · 이름만 넣고 점수를 안 적은 일지도 '함께 친 사람'으로 셉니다. */
  function recentPartnerNames(state, limit) {
    var max = Math.max(1, U.num(limit, 4) || 4);
    var me = state && state.me;
    var myNick = String((me && me.nick) || '').trim();
    var list = [], byName = {};
    function add(name, at) {
      var n = String(name == null ? '' : name).replace(/\s+/g, ' ').trim();
      /* 깨진 팀 JSON이 이름처럼 남은 값('{...')은 칩으로 띄우지 않습니다 */
      if (!n || n === myNick || n.indexOf('{') >= 0 || n.indexOf('}') >= 0) return;
      var e = byName[n];
      if (!e) { e = byName[n] = { name: n, count: 0, last: '' }; list.push(e); }
      e.count += 1;
      if (at && String(at) > e.last) e.last = String(at);
    }
    ((state && state.data && state.data.records) || []).forEach(function (r) {
      var meta = r ? D.logMeta(r) : null;
      if (meta && meta.partner) add(meta.partner, r.date || r.createdAt || '');
    });
    list.sort(function (a, b) {
      if (b.count !== a.count) return b.count - a.count;
      return a.last < b.last ? 1 : a.last > b.last ? -1 : 0;
    });
    var names = list.slice(0, max).map(function (e) { return e.name; });
    if (names.length < max) {
      ((state && state.data && state.data.friends) || []).forEach(function (f) {
        if (names.length >= max) return;
        var n = String((f && f.nick) || '').replace(/\s+/g, ' ').trim();
        if (!n || n === myNick || names.indexOf(n) >= 0) return;
        names.push(n);
      });
    }
    return names;
  }

  /* 입력칸 아래 칩 한 줄 — 지금 적힌 이름은 켜진 모양(aria-pressed)입니다 */
  function partnerChips(state, d) {
    var names = recentPartnerNames(state, 4);
    if (!names.length) return '';
    var cur = String((d && d.partner) || '').replace(/\s+/g, ' ').trim();
    return '<div class="ptnchips" data-ptnchips>' +
      '<span class="ptnchips__lab">자주 친 파트너</span>' +
      names.map(function (n) {
        var on = n === cur;
        return '<button type="button" class="ptnchip' + (on ? ' is-on' : '') + '" data-ptn-chip="' + U.esc(n) + '"' +
          ' aria-pressed="' + (on ? 'true' : 'false') + '">' + U.esc(n) + '</button>';
      }).join('') +
      '</div>';
  }

  /* 입력칸 아래 한 줄 — 지금 적힌 파트너의 전적 (bm-v1.36.0)
   *  · 예) 조환비 · 4전 3승 1패 (75%)
   *  · '파트너별 승률' 카드를 펼치지 않아도 바로 보입니다. 기록이 없는 이름이면 숨김. */
  function partnerNowText(state, name) {
    var n = String(name == null ? '' : name).replace(/\s+/g, ' ').trim();
    if (!n) return '';
    var p = D.partnerStat(((state && state.data && state.data.records) || []), n);
    return p ? D.partnerLineText(p) : '';
  }

  function partnerNow(state, name) {
    var txt = partnerNowText(state, name);
    return '<p class="ptnnow" data-ptn-now' + (txt ? '' : ' hidden') + '>' +
      UI.icon('chart') + '<span>' + U.esc(txt) + '</span></p>';
  }

  /* 입력 중에 전적 줄만 다시 칠합니다 — 폼을 다시 그리지 않아 커서가 끊기지 않습니다 */
  function paintPartnerNow(ctx, form, name) {
    if (!form) return;
    var host = form.querySelector('[data-ptn-now]');
    if (!host) return;
    var state = (ctx && ctx.store && ctx.store.state) || null;
    var txt = partnerNowText(state, name);
    host.hidden = !txt;
    var span = host.querySelector('span');
    if (span) span.textContent = txt;
  }

  function gamesField(d, state) {
    var games = draftGames(d);
    var mode = Number(d.gameMode) === 25 ? 25 : 21;
    return '<div class="field" data-games>' +
      '<div class="field__label"><span>게임 점수</span><small>모르면 비워두세요</small></div>' +
      '<div class="seg seg--wide seg--mode" data-gamemode>' +
      [21, 25].map(function (m) {
        return '<button type="button" class="seg__btn' + (mode === m ? ' is-on' : '') + '" data-gamemode-val="' + m + '" aria-pressed="' + (mode === m ? 'true' : 'false') + '">' + m + '점제</button>';
      }).join('') + '</div>' +
      '<div class="gamelist" data-gamelist>' + gamesRows(games) + '</div>' +
      '<button type="button" class="addgame" data-act="add-game">' + UI.icon('plus') + '게임 추가</button>' +
      '<p class="gamesum" data-gamesum>' + gamesSummaryText(games) + '</p>' +
      /* 복식 파트너 — 선택 입력. 새 칸 없이 '팀' 칸 JSON으로 저장하고
       * 일지 & AI의 '파트너별 승률'이 이 이름으로 집계합니다. (bm-v1.32.0) */
      '<div class="ptnfield" data-partner-field>' +
      '<label class="ptnfield__lab" for="log-partner">복식 파트너</label>' +
      '<input id="log-partner" type="text" maxlength="' + D.PARTNER_MAX + '" enterkeyhint="done" data-field="partner" ' +
        'value="' + U.esc((d && d.partner) || '') + '" placeholder="함께 친 사람 (선택)" aria-label="복식 파트너 이름">' +
      '</div>' +
      partnerNow(state, d && d.partner) +
      partnerChips(state, d) +
      '</div>';
  }

  /* 게임 점수는 '선택' 입력 — 기본은 접어 두고, 점수가 있으면 펼칩니다 */
  function hasGames(d) {
    var games = (d && d.games) || [];
    return games.some(function (g) { return (g && g.a !== '' && g.a != null) || (g && g.b !== '' && g.b != null); });
  }

  function gamesFold(d, state) {
    var open = hasGames(d);
    var sum = D.gamesSummary(D.cleanGames(draftGames(d)));
    var val = sum.count ? sum.count + '경기 ' + sum.wins + '승 ' + sum.losses + '패' : '';
    return '<details class="fold" data-fold="games"' + (open ? ' open' : '') + '>' +
      '<summary class="fold__sum"><span>경기 점수 <small>선택</small></span>' +
      '<i class="fold__val">' + U.esc(val) + '</i>' + UI.icon('arrow', 'fold__car') + '</summary>' +
      '<div class="fold__body">' + gamesField(d, state) + '</div></details>';
  }

  function scoreRing(score) {
    var tone = score >= 75 ? 'good' : score >= 50 ? 'mid' : 'low';
    return '<div class="ring ring--' + tone + '" style="--p:' + score + '">' +
      '<span class="ring__num">' + score + '</span><span class="ring__unit">점</span></div>';
  }

  function insightRow(it) {
    var ic = it.icon === 'alert' ? 'alert' : it.icon === 'score' ? 'chart' : it.icon === 'fire' ? 'fire'
      : it.icon === 'clock' ? 'clock' : 'spark';
    return '<li class="insight"><span class="insight__i">' + UI.icon(ic) + '</span>' +
      '<div><p class="insight__l">' + U.esc(it.label) + '</p><p class="insight__d">' + U.esc(it.detail) + '</p></div></li>';
  }

  function bulletList(items) {
    return '<ul class="bullets">' + (items || []).map(function (t) {
      return '<li>' + U.esc(t) + '</li>';
    }).join('') + '</ul>';
  }

  /* 경기 흐름 한 줄 — 점수만 보고 셀 수 있는 값만 */
  function flowLine(flow) {
    if (!flow || !flow.count) return '';
    var parts = [flow.count + '경기 ' + flow.wins + '승 ' + flow.losses + '패' + (flow.count - flow.wins - flow.losses > 0 ? ' ' + (flow.count - flow.wins - flow.losses) + '무' : '')];
    parts.push('평균 ' + flow.avgMargin + '점차');
    /* 모든 경기가 접전이면 전체 전적과 숫자가 겹쳐 군더더기가 됩니다(v1.39.0) */
    if (flow.clutch && flow.clutch.games >= 2 && flow.clutch.games < flow.count) parts.push('접전(3점차 이내) ' + flow.clutch.games + '경기 ' + flow.clutch.wins + '승 ' + flow.clutch.losses + '패');
    else if (flow.deuce) parts.push('끝까지 간 경기 ' + flow.deuce);
    else if (flow.close) parts.push('3점차 이내 ' + flow.close);
    if (flow.fade) parts.push('마지막 경기 점수차 확대');
    return parts.join(' · ');
  }

  function loadLine(load) {
    if (!load || !load.zone) return '';
    var zone = load.zone === 'spike' ? '급증' : load.zone === 'watch' ? '조금 높음' : load.zone === 'low' ? '적음' : '적정';
    return '최근 7일 부하 ' + load.ratio + '배 · ' + zone;
  }

  /* 한 줄 지표 — 진단 목록의 첫 3개를 칩으로. 상세 문장은 접힌 '자세히 보기'에 있습니다. */
  function metricStrip(an) {
    var labels = (an.insights || []).map(function (it) { return it.label; }).slice(0, 3);
    if (!labels.length) return '';
    return '<div class="ai-metrics">' + labels.map(function (t) {
      return '<span class="ai-metric">' + U.esc(t) + '</span>';
    }).join('') + '</div>';
  }

  /* 진단 · 경기 흐름 · 부하 점검을 한 접기로 (저장 직후 화면이 길어지지 않게) */
  function analysisDetails(an, partners) {
    var drills = (an.drills && an.drills.drills) || [];
    var bits = [(an.insights || []).length + '개 진단'];
    if (an.flow && an.flow.count) bits.push('경기 흐름');
    if (an.load && an.load.zone) bits.push('부하 점검');
    if (partners && partners.length) bits.push('파트너 승률');
    return '<details class="fold fold--ai" data-fold="ai-detail">' +
      '<summary class="fold__sum"><span>자세히 보기 <small>' + U.esc(bits.join(' · ')) + '</small></span>' +
      UI.icon('arrow', 'fold__car') + '</summary>' +
      '<div class="fold__body">' +
      ((an.insights || []).length ? '<ul class="insights">' + an.insights.map(insightRow).join('') + '</ul>' : '') +
      (partners && partners.length
        ? '<div class="care__col mt8" data-partner-lines><h4>파트너별 승률</h4><ul class="ptnlist">' +
          partners.map(function (p) { return partnerRow(p, false); }).join('') + '</ul></div>'
        : '') +
      ((an.risk || []).length
        ? '<div class="care__col mt8"><h4>점검</h4>' + bulletList(an.risk.map(function (r) { return r.text; })) + '</div>' : '') +
      (an.flow && an.flow.count && an.flow.tips && an.flow.tips.length
        ? '<h3 class="sec-title">' + UI.icon('chart') + '경기 흐름 · ' + U.esc(an.flow.mode + '점제') + '</h3>' +
          '<div class="planbox"><p class="planbox__t">' + U.esc(flowLine(an.flow)) + '</p>' +
          bulletList(an.flow.tips) + '</div>' : '') +
      (an.load && an.load.zone
        ? '<h3 class="sec-title">' + UI.icon('clock') + '부하 점검</h3>' +
          '<div class="planbox"><p class="planbox__t">' + U.esc(loadLine(an.load)) + '</p>' +
          '<p class="planbox__v">운동 시간 × 강도로 계산한 내부 부하예요. 직전 4주 평균과 비교합니다.</p>' +
          bulletList(an.load.tips) + '</div>' : '') +
      (drills.some(function (d) { return d.point; })
        ? '<div class="care__col mt8"><h4>드릴 포인트</h4>' + bulletList(drills.filter(function (d) {
            return d.point;
          }).map(function (d) { return d.name + ' — ' + d.point; })) + '</div>' : '') +
      '</div></details>';
  }

  /* 근거 기반 예방 워밍업 + 종목별 부하 기준 — 한 접기, 짧은 4줄 안으로 */
  function preventFold(an) {
    var pv = an && an.prevent;
    var lg = an && an.loadGuide;
    if (!pv || !pv.items || !pv.items.length) return '';
    var areas = (pv.areas && pv.areas.length ? pv.areas.join('·') : '전신');
    var items = pv.items.map(function (it, i) {
      return '<li class="warm"><span class="warm__text"><b>' + U.esc(it.name) + '</b> — ' + U.esc(it.how) + '</span>' +
        timerWidget('warm:' + i, it.name) + '</li>';
    }).join('');
    return '<details class="fold fold--ai" data-fold="prevent">' +
      '<summary class="fold__sum"><span>부상 예방 · 종목 부하 <small>코트 전 ' + U.esc(pv.label) + ' · ' + U.esc(areas) + '</small></span>' +
      '<i class="fold__val">' + pv.items.length + '가지</i>' + UI.icon('arrow', 'fold__car') + '</summary>' +
      '<div class="fold__body">' +
      '<div class="planbox"><p class="planbox__t">' + U.esc(pv.title) + ' · ' + U.esc(pv.label) + '</p>' +
      '<ul class="bullets">' + items + '</ul>' +
      '<p class="planbox__v">' + U.esc(pv.reason) + '</p>' +
      '<p class="planbox__v">근거 · ' + U.esc(pv.sourceShort || pv.source) + '</p></div>' +
      (lg
        ? '<div class="planbox mt8"><p class="planbox__t">' + U.esc(lg.discipline) + ' · 랠리 ' + U.esc(lg.rally) + '</p>' +
          '<p class="planbox__v">' + U.esc(lg.workRest) + '</p>' +
          '<p class="planbox__v">' + U.esc(lg.drill + ' · ' + lg.reps) + '</p>' +
          '<p class="planbox__v">' + U.esc(lg.heart + ' · ' + lg.steps) + '</p>' +
          bulletList(lg.tips) +
          '<p class="planbox__v">' + U.esc(lg.levelNote) + '</p>' +
          '<p class="planbox__v">근거 · ' + U.esc(lg.sourceShort || lg.source) + '</p></div>'
        : '') +
      '</div></details>';
  }

  /* 관절 보호 체크 — 어깨·무릎/발목을 쉬운 코트 말투로 점검하는 접기
   * 제목·설명은 일상어, 논문 수치는 맨 아래 작은 '참고 논문' 한 줄에만 */
  function guardBlock(b) {
    var thresholds = (b.thresholds || []).map(function (t) {
      return '<li>' + U.esc(t) + '</li>';
    }).join('');
    var checks = (b.checks || []).map(function (c) {
      return '<li><b>' + U.esc(c.name) + '</b> — ' + U.esc(c.how) + '</li>';
    }).join('');
    var guides = (b.guides || []).map(function (c) {
      return '<li><b>' + U.esc(c.name) + '</b> — ' + U.esc(c.how) + '</li>';
    }).join('');
    return '<div class="planbox mt8"><p class="planbox__t">' + U.esc(b.title) + '</p>' +
      '<p class="planbox__v">' + U.esc(b.reason) + '</p>' +
      (b.window ? '<p class="planbox__v">' + U.esc(b.window) + '</p>' : '') +
      '<p class="planbox__t mt8">' + U.esc(b.thresholdTitle || '기준') + '</p><ul class="bullets">' + thresholds + '</ul>' +
      '<p class="planbox__t mt8">' + U.esc(b.checkTitle || '자가 체크') + '</p><ul class="bullets">' + checks + '</ul>' +
      '<p class="planbox__t mt8">' + U.esc(b.guideTitle || '오늘 할 것') + '</p><ul class="bullets">' + guides + '</ul>' +
      '<p class="planbox__src">' + U.esc(b.sourceShort || b.source) + '</p></div>';
  }

  function guardFold(an) {
    var g = an && an.guard;
    if (!g) return '';
    var blocks = [g.shoulder, g.lower, g.arm].filter(function (b) { return b && b.on; });
    if (!blocks.length) return '';
    return '<details class="fold fold--ai" data-fold="guard">' +
      '<summary class="fold__sum"><span>관절 보호 체크 <small>' + U.esc(g.label) + '</small></span>' +
      '<i class="fold__val">' + blocks.length + '부위</i>' + UI.icon('arrow', 'fold__car') + '</summary>' +
      '<div class="fold__body">' + blocks.map(guardBlock).join('') + '</div></details>';
  }

  /* 실전 선수 오프코트 루틴 — 코트 날 · 웨이트 날 순서 + 코어·허리 보강 3종 + 자전거 40분 */
  function offcourtFold(an) {
    var oc = an && an.offcourt;
    if (!oc || !oc.days || !oc.days.length) return '';
    var days = oc.days.map(function (d) {
      var steps = d.steps.map(function (s) {
        return '<li><b>' + U.esc(s.name) + '</b>' + (s.min > 0 ? ' (' + s.min + '분)' : '') +
          ' — ' + U.esc(s.how) + '</li>';
      }).join('');
      return '<div class="planbox mt8"><p class="planbox__t">' + U.esc(d.title) + '</p>' +
        '<p class="planbox__v">' + U.esc(d.order) + '</p>' +
        '<ul class="bullets">' + steps + '</ul></div>';
    }).join('');
    var core = oc.core && oc.core.items && oc.core.items.length
      ? '<div class="planbox mt8"><p class="planbox__t">' + U.esc(oc.core.title) + ' · ' + oc.core.items.length + '종</p>' +
        '<p class="planbox__v">' + U.esc(oc.core.when) + '</p>' +
        '<ul class="bullets">' + oc.core.items.map(function (it) {
          return '<li><b>' + U.esc(it.name) + '</b> ' + U.esc(it.sets) + ' — ' + U.esc(it.how) + '</li>';
        }).join('') + '</ul></div>'
      : '';
    var endurance = oc.endurance
      ? '<div class="planbox mt8"><p class="planbox__t">' + U.esc(oc.endurance.title) + ' · ' + oc.endurance.min + '분</p>' +
        '<p class="planbox__v">' + U.esc(oc.endurance.when) + '</p>' +
        '<p class="planbox__v">' + U.esc(oc.endurance.how) + '</p></div>'
      : '';
    return '<details class="fold fold--ai" data-fold="offcourt">' +
      '<summary class="fold__sum"><span>' + U.esc(oc.title) + ' <small>코트 날 · 웨이트 날 순서</small></span>' +
      '<i class="fold__val">' + (oc.days.length + (oc.core ? 1 : 0)) + '가지</i>' + UI.icon('arrow', 'fold__car') + '</summary>' +
      '<div class="fold__body">' +
      '<p class="planbox__v">' + U.esc(oc.note) + '</p>' +
      days + core + endurance +
      '<p class="planbox__v">' + U.esc(oc.disciplineNote) + '</p>' +
      '<p class="planbox__v">근거 · ' + U.esc(oc.source) + '</p>' +
      '</div></details>';
  }

  function analysisCard(an, state) {
    if (!an) return '';
    var drills = (an.drills && an.drills.drills) || [];
    var gp = an.gradePlan;
    var pb = an.playbook;
    var warn = (an.risk || []).filter(function (r) { return r.level !== 'ok'; })[0] || null;
    return '' +
      '<section class="card card--ai" data-region="analysis">' +
      '<header class="card__head">' +
      '<div class="ai-badge">' + UI.icon('spark') + '배드민턴 AI</div>' +
      '</header>' +
      '<div class="ai-top">' + scoreRing(an.score) +
      '<div class="ai-top__text"><p class="ai-headline">' + U.esc(an.headline) + '</p>' +
      '<p class="ai-sub">다음 목표 · <strong>' + U.esc(an.focus) + '</strong></p></div></div>' +
      metricStrip(an) +
      (warn ? '<div class="risk risk--' + warn.level + '">' + UI.icon('alert') +
        '<span>' + U.esc(warn.text) + '</span></div>' : '') +
      '<h3 class="sec-title">' + UI.icon('check') + '추천 드릴</h3>' +
      easyGuide(an, drills) +
      '<ol class="drills drills--core">' + drills.map(function (d, i) {
        return '<li class="drill drill--core"><div class="drill__no">' + (i + 1) + '</div><div class="drill__body">' +
          '<div class="drill__top"><strong>' + U.esc(d.name) + '</strong><span class="pill pill--ghost">' + U.esc(d.sets) + '</span></div>' +
          '<p class="drill__method">' + U.esc(d.method) + '</p>' +
          '<div class="drill__foot">' + timerWidget('drill:' + i, d.name) + '</div></div></li>';
      }).join('') + '</ol>' +
      analysisDetails(an, D.partnerStats(((state && state.data && state.data.records) || []), { limit: 3 })) +
      preventFold(an) +
      guardFold(an) +
      offcourtFold(an) +
      '<details class="fold fold--ai" data-fold="week">' +
      '<summary class="fold__sum"><span>이번 주 루틴 <small>다음 훈련 · 실전</small></span>' +
      '<i class="fold__val">' + an.week.length + '회차</i>' + UI.icon('arrow', 'fold__car') + '</summary>' +
      '<div class="fold__body"><div class="week">' + an.week.map(function (w) {
        return '<div class="week__row"><span class="week__day">' + U.esc(w.day) + '</span>' +
          '<span class="week__focus">' + U.esc(w.focus) + '</span><span class="week__menu">' + U.esc(w.menu) + '</span></div>';
      }).join('') + '</div></div></details>' +
      '<details class="fold fold--ai" data-fold="care">' +
      '<summary class="fold__sum"><span>맞춤 처방 <small>웜업 · 회복 · 스트레칭</small></span>' + UI.icon('arrow', 'fold__car') + '</summary>' +
      '<div class="fold__body"><div class="care">' +
      (an.care.warmup && an.care.warmup.length
        ? '<div class="care__col"><h4>웜업</h4>' + bulletList(an.care.warmup) + '</div>' : '') +
      '<div class="care__col"><h4>회복</h4>' + bulletList(an.care.rehab) + '</div>' +
      '<div class="care__col"><h4>스트레칭</h4>' + bulletList(an.care.stretch) + '</div>' +
      '<div class="care__col"><h4>마음</h4>' + bulletList(an.care.mental) + '</div>' +
      '</div></div></details>' +
      ((gp || (pb && pb.tips && pb.tips.length))
        ? '<details class="fold fold--ai" data-fold="extra">' +
          '<summary class="fold__sum"><span>더 보기 <small>급수 플랜 · 전술 노트</small></span>' + UI.icon('arrow', 'fold__car') + '</summary>' +
          '<div class="fold__body">' +
          (gp ? '<div class="planbox"><p class="planbox__t">' + U.esc(gp.grade) + ' 플랜 · ' + U.esc(gp.focus) + '</p>' +
            '<p class="planbox__v">' + U.esc(gp.volume) + '</p>' + bulletList(gp.rules) + '</div>' : '') +
          (pb && pb.tips && pb.tips.length
            ? '<div class="care__col mt8"><h4>전술 노트 · ' + U.esc(pb.discipline) + '</h4>' + bulletList(pb.tips) + '</div>' : '') +
          '</div></details>'
        : '') +

      /* 저장 직후에만 보이는 "커뮤니티에 공유" 스트립 */
      (state && state.ui && state.ui.lastSavedLog
        ? '<div class="sharebar" data-region="share">' +
          '<p class="sharebar__t">오늘 운동을 커뮤니티에 남길까요?</p>' +
          '<p class="sharebar__s">' + U.esc(sharePreview(state.ui.lastSavedLog)) + '</p>' +
          '<div class="sharebar__acts">' +
          '<button type="button" class="btn btn--primary grow" data-act="share-log">' + UI.icon('community') + '커뮤니티에 오늘 운동 공유</button>' +
          '<button type="button" class="btn btn--ghost" data-act="dismiss-share">나중에</button></div></div>'
        : '') +
      '</section>';
  }

  /* 약점이 드라이브·헤어핀·스매시·클리어·언더와 맞물리면
   * 초보용 원문(쉬운 설명)을 먼저 펼쳐 두고, 그 아래에 논문 근거 드릴을 잇습니다.
   * (옛 약점 탭의 순서 그대로 — 왜 이렇게 하는지 → 어떻게 하는지) */
  function easyGuide(an, drills) {
    if (!BM.beginner) return '';
    var names = (drills || []).map(function (d) { return d.name; }).concat(an.weakness || []);
    return BM.beginner.easyGuideHtml(names);
  }

  /* 공유 미리보기 — 일지에서 시간·훈련·전적만 담백하게 */
  function sharePreview(e) {
    var games = (e.games && e.games.length) ? e.games : (e.score ? [e.score] : []);
    var sum = D.gamesSummary(games);
    return [U.shortDay(e.date || U.ymd()), (e.minutes ? e.minutes + '분' : ''), ((e.done || []).join('·')),
      (sum.count ? sum.count + '경기 ' + sum.wins + '승 ' + sum.losses + '패' : '')].filter(Boolean).join(' · ');
  }

  /* ============================================================
   * 초보자 4주 루틴 체크리스트
   *  - 라켓을 처음 잡는 사람이 일지 화면 첫머리에서 바로 찾도록 히어로 카드 아래에 둡니다.
   *  - 기본은 한 줄 요약으로 접혀 있어서(2026-11-19) 일지 입력 폼이 첫 화면에 바로 보입니다.
   *    요약줄을 누르면 4주 체크리스트가 펼쳐지고, 펼친 상태는 화면을 다시 그려도 유지됩니다.
   *  - 체크는 계정별로 기기에 저장됩니다(store.routine).
   *  - 표시 선택(state.routinePref): null이면 '시작할까요?' 선택 카드, true면 체크리스트,
   *    false면 카드 자체를 숨깁니다. 무엇을 보여 줄지는 routineBlock()이 정합니다.
   * ============================================================ */
  var routineOpen = false;   /* 루틴 카드를 펼쳤는지 (탭을 옮겼다 와도 기억) */

  /* '아직 안 고름' 상태에서 보여 주는 선택 카드
   *  v1.35: 첫 화면이 길어지지 않게 한 장을 160px쯤으로 줄였습니다 —
   *  큰 지표 상자 3개를 한 줄 메타 칩으로, 세로로 쌓인 두 버튼을 한 줄로.
   *  알려 주던 정보(4주·연습 13개·20~30분·주 2~3회)는 그대로입니다. */
  function routineAskCard(state) {
    return '' +
      '<section class="card card--rtn-ask" data-region="routine" data-sig="' + U.esc(routineSig(state)) + '">' +
      '<div class="ask__head">' +
      '<span class="ask__eyebrow">' + UI.icon('spark') + '처음 시작하는 분께</span>' +
      '<h2 class="ask__t">초보자 4주 루틴, 같이 시작할까요?</h2>' +
      '<p class="ask__s">라켓을 처음 잡아도 괜찮아요. 하루 20~30분이면 기본기를 하나씩 익힐 수 있어요.</p>' +
      '<div class="ask__meta">' +
      '<span><b>4주</b> 과정</span><span>연습 <b>13개</b></span><span>주 <b>2~3회</b></span>' +
      '</div>' +
      '</div>' +
      '<div class="ask__btns">' +
      '<button type="button" class="btn btn--primary" data-act="routine-start">초보자 루틴 시작하기</button>' +
      '<button type="button" class="btn btn--ghost" data-act="routine-skip">괜찮아요, 건너뛰기</button>' +
      '</div>' +
      '<p class="ask__note">나중에 MY에서 언제든 켜고 끌 수 있어요</p>' +
      '</section>';
  }

  function routineSig(state) {
    var map = (state && state.routine) || {};
    var done = Object.keys(map).filter(function (k) { return map[k]; }).sort().join(',');
    var pref = (state || {}).routinePref;
    var mode = pref === true ? 'on' : pref === false ? 'off' : pref === null ? 'ask' : 'legacy';
    return mode + '|' + ((state.ui && state.ui.routineWeek) || 0) + '|' + done;
  }

  function routineCard(state) {
    var R = BM.routine;
    if (!R) return '';
    var map = (state && state.routine) || {};
    var st = R.stats(map);
    var picked = (state.ui && state.ui.routineWeek) || 0;
    var weekNo = picked ? picked : R.currentWeek(map);
    var week = R.weekOf(weekNo);
    var ws = R.weekStats(week, map);
    var next = R.nextItem(map);

    var weekChips = st.weeks.map(function (w) {
      var on = w.no === weekNo;
      return '<button type="button" class="rtn__wk' + (on ? ' is-on' : '') + (w.complete ? ' is-done' : '') + '"' +
        ' data-rtn-week="' + w.no + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
        w.no + '주차<i>' + w.done + '/' + w.total + '</i>' +
        (w.complete ? '<b aria-hidden="true">✓</b>' : '') + '</button>';
    }).join('');

    var items = week.items.map(function (it) {
      var done = !!map[it.id];
      return '<li class="rtn__item' + (done ? ' is-done' : '') + '">' +
        '<label class="rtn__lab">' +
        '<input type="checkbox" data-rtn-item="' + it.id + '"' + (done ? ' checked' : '') +
        ' aria-label="' + U.esc(it.name) + '">' +
        '<span class="rtn__text">' +
        '<span class="rtn__name">' + U.esc(it.name) + '<small>' + it.min + '분</small></span>' +
        '<span class="rtn__how">' + U.esc(it.how) + '</span>' +
        '<span class="rtn__point"><b>감 잡는 포인트</b>' + U.esc(it.point) + '</span>' +
        '</span></label></li>';
    }).join('');

    var nextLine = st.complete
      ? '<p class="rtn__next is-done">' + UI.icon('check') + '13개 모두 완료했어요. 4주 동안 수고했어요!</p>'
      : '<p class="rtn__next">' + UI.icon('arrow') + '다음 연습 · ' + next.week + '주차 ' + U.esc(next.name) + '</p>';

    /* 접힌 한 줄 요약 — 지금 상태와 다음에 할 한 가지만 */
    var sumNext = st.complete
      ? '4주 동안 수고했어요'
      : '다음 · ' + next.name;

    return '<section class="card card--rtn" data-region="routine" data-sig="' + U.esc(routineSig(state)) + '">' +
      '<details class="rtn" data-rtn' + (routineOpen ? ' open' : '') + '>' +
      '<summary class="rtn__sum">' +
      '<span class="rtn__sum-main">' +
      '<span class="rtn__sum-t">' + UI.icon('check') + '초보자 4주 루틴' +
      '<span class="pill pill--ghost">왕초보</span></span>' +
      '<span class="rtn__sum-s">' + U.esc(sumNext) + '</span></span>' +
      '<span class="rtn__sum-n"><b>' + st.done + '</b>/' + st.total + '</span>' +
      UI.icon('arrow', 'rtn__car') +
      '</summary>' +
      '<div class="rtn__body">' +
      '<p class="rtn__sub">' + U.esc(R.SUB) + '</p>' +
      '<div class="rtn__overall">' +
      '<div class="rtn__bar" role="progressbar" aria-label="4주 루틴 전체 달성률" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + st.pct + '">' +
      '<i style="width:' + st.pct + '%"></i></div>' +
      '<span class="rtn__num"><b>' + st.done + '</b>/' + st.total + ' · ' + st.pct + '%</span></div>' +
      '<div class="rtn__weeks">' + weekChips + '</div>' +
      '<div class="rtn__week">' +
      '<p class="rtn__goal"><b>' + week.no + '주차 · ' + U.esc(week.name) + '</b><span>' + U.esc(ws.pace) + '</span></p>' +
      '<p class="rtn__wkgoal">이번 주 목표 · ' + U.esc(week.goal) + '</p>' +
      '<ul class="rtn__list">' + items + '</ul>' +
      '</div>' +
      nextLine +
      '<div class="rtn__foot">' +
      '<p>' + U.esc(R.GUARD) + '</p>' +
      '<button type="button" class="rtn__reset" data-act="routine-reset">체크 지우기</button></div>' +
      '<p class="rtn__save">체크는 이 기기에 저장돼요 · 오늘은 한두 개만 해도 충분해요</p>' +
      '</div></details>' +
      '</section>';
  }

  /* 표시 선택에 따라 일지 첫머리에 무엇을 그릴지 정합니다.
   *  false → 아무것도 그리지 않음 · null → 선택 카드 · true → 체크리스트
   *  routinePref가 없는 예전 state(undefined)는 예전처럼 체크리스트입니다. */
  function routineBlock(state) {
    var pref = (state || {}).routinePref;
    if (pref === false) return '';
    if (pref === null) return routineAskCard(state);
    return routineCard(state);
  }

  /* 처음이라면 — 용어 사전 & 기초 가이드 입구 (2026-11-20, bm-v1.25.0)
   *  · 초심 급수: 히어로·루틴 카드 바로 아래에 큰 카드로
   *  · 그 위 급수: 한 줄 보조 카드로만 두어 첫 화면을 어지럽히지 않습니다 (MY에서도 열림) */
  function beginnerBlock(state) {
    return BM.beginner ? BM.beginner.entryHtml(state) : '';
  }

  function beginnerSig(state) {
    var me = state && state.me;
    return 'beg|' + (BM.beginner && BM.beginner.isBeginnerGrade(me && me.level) ? '1' : '0');
  }

  function recentRow(r) {
    var games = (r.games && r.games.length) ? r.games : (r.score ? [r.score] : []);
    var win = (r.result || (games.length === 1 ? D.resultFromScore(games[0]) : ''));
    var scoreTxt = games.length
      ? (games.length > 1 ? games.length + '경기' : games[0].a + ':' + games[0].b)
      : '';
    var tagTxt = [].concat(r.pain || [], r.weakness || []).slice(0, 2).join(' · ');
    var doneTxt = (r.done || []).slice(0, 3).join('·');
    var meta = D.logMeta(r);
    var sub = [meta.partner ? '함께 ' + meta.partner : '', tagTxt, doneTxt].filter(Boolean).join(' · ');
    var proTxt = D.proLine(D.proOf(r), 2);
    return '<li class="logrow" data-record="' + U.esc(r.id) + '">' +
      '<div class="logrow__date"><strong>' + U.shortDay(r.date) + '</strong><span>' + U.relDay(r.date) + '</span></div>' +
      '<div class="logrow__mid"><p class="logrow__title">' + (r.cond != null ? '컨디션 ' + r.cond : '훈련') +
      (r.minutes ? ' · ' + r.minutes + '분' : '') + '</p>' +
      (sub ? '<p class="logrow__sub">' + U.esc(sub) + '</p>' : '') +
      /* 선수 7대 훈련에서 적은 내용을 최근 기록에서도 한 줄로 (bm-v1.40.0) */
      (proTxt ? '<p class="logrow__pro"><span>7대 훈련</span> ' + U.esc(proTxt) + '</p>' : '') +
      /* 영상 링크 — 한 번 누르면 새 창에서 바로 (rel="noopener noreferrer") */
      (meta.video.url
        ? '<a class="logrow__vid" data-video href="' + U.esc(meta.video.url) + '" target="_blank" rel="noopener noreferrer" ' +
          'aria-label="' + U.esc((meta.video.label || '오늘 영상') + ' 새 창에서 보기') + '">' + UI.icon('camera') +
          '<span>영상 보기 ↗</span></a>'
        : '') +
      '</div>' +
      (scoreTxt
        ? '<div class="logrow__score"><span class="score ' + (win === '승' ? 'is-win' : win === '패' ? 'is-loss' : '') + '">' + U.esc(scoreTxt) + '</span>' +
          (win ? '<span class="score__res">' + U.esc(win) + '</span>' : '') + '</div>'
        : '') + '</li>';
  }

  /* ============================================================
   * 코트 점수판 (bm-v1.30.0)
   *  · 일지 첫머리 `+ 코트 점수판` 버튼 → 21점/25점 · 듀스 자동 판정 시트
   *  · 끝난 세트는 '오늘 일지에 넣기'로 일지 입력칸(게임 점수·메모)에 바로 들어감
   *  · 계산은 js/scoreboard.js (순수 함수)에 두고 화면은 그리기만 합니다.
   * ============================================================ */
  var sbState = null;          /* 닫았다 다시 열어도 이어서 (일지에 넣으면 새로) */

  /* ============================================================
   * 주간 약점 3회 챌린지 (bm-v1.31.0)
   *  · ideas.md 2026-11-19 3번 — 최근 2주 일지에서 가장 자주 나온 약점 하나를 골라
   *    '이번 주 ○○ 3번 연습하기' 스탬프를 루틴 요약 아래에 조용히 둡니다.
   *  · 스탬프는 그 약점이 '약점기술'·'완료훈련'에 찍힌 일지를 저장하면 자동으로 채워집니다
   *    (수동 체크 없음 · 저장하면 바로 다시 그려집니다).
   *  · 3회를 채우면 축하 배지와 '다음 주에 새 약점으로 교체' 안내.
   *  · 초심이 4주 루틴 1주차를 아직 하는 중이면 첫 화면이 복잡해지지 않게 숨깁니다
   *    (루틴을 건너뛴 사람에게는 보여 줍니다 — 배울 것이 줄어든 만큼 이어서 볼 거리가 필요해요).
   * ============================================================ */
  function challengeOf(state) {
    var ui = (state && state.ui) || {};
    /* 화면은 항상 오늘 기준 — ui.challengeNow는 테스트에서 날짜를 고정할 때만 씁니다 */
    var opts = ui.challengeNow ? { now: ui.challengeNow } : {};
    return D.weekChallenge((state && state.data && state.data.records) || [], opts);
  }

  function challengeHidden(state) {
    if (((state || {}).routinePref) === false) return false;
    var lvl = state && state.me && state.me.level;
    if (!BM.beginner || !BM.beginner.isBeginnerGrade(lvl)) return false;
    if (!BM.routine) return false;
    var st = BM.routine.stats((state && state.routine) || {});
    return !(st.weeks[0] && st.weeks[0].complete);
  }

  function challengeSig(state) {
    var ch = challengeOf(state);
    return 'wkch|' + (challengeHidden(state) ? 'h' : 'v') + '|' + (ch.active ? ch.weakness : ch.reason) +
      '|' + ch.count + '/' + ch.goal + '|' + ch.weekStart;
  }

  function stampRow(ch) {
    var out = '';
    for (var i = 0; i < ch.goal; i++) {
      var on = i < ch.count;
      out += '<span class="wkch__stamp' + (on ? ' is-on' : '') + '" aria-hidden="true">' +
        (on ? '✓' : (i + 1)) + '</span>';
    }
    return '<div class="wkch__stamps" role="progressbar" aria-valuemin="0" aria-valuemax="' + ch.goal +
      '" aria-valuenow="' + Math.min(ch.count, ch.goal) + '" aria-label="이번 주 ' + U.esc(ch.weakness) +
      ' 연습 ' + Math.min(ch.count, ch.goal) + '회 / ' + ch.goal + '회">' + out + '</div>';
  }

  /* 오늘 일지에 그 약점이 아직 없으면 — 첫 스탬프를 어떻게 채우는지 한 줄로 */
  function withParticle(word) {
    /* 받침이 있으면 '을', 없으면 '를' — '헤어핀을' / '드라이브를' */
    var s = String(word || '');
    var c = s.charCodeAt(s.length - 1);
    if (!(c >= 0xac00 && c <= 0xd7a3)) return s + '을';
    return s + ((c - 0xac00) % 28 === 0 ? '를' : '을');
  }

  function challengeHint(state, ch) {
    var d = (state && state.drafts && state.drafts.log) || {};
    var ui = (state && state.ui) || {};
    var todayKey = ui.challengeNow ? String(ui.challengeNow).slice(0, 10) : U.ymd();
    /* 오늘 몫을 이미 채웠으면 같은 날 또 저장해도 늘지 않는다고 알려 줍니다 */
    if ((ch.days || []).indexOf(todayKey) >= 0) return '오늘 몫은 채웠어요 · 다음 연습 날 또 남겨 주세요';
    var todayTagged = (d.weakness || []).indexOf(ch.weakness) >= 0 || (d.done || []).indexOf(ch.weakness) >= 0;
    if (todayTagged) return '오늘 일지를 저장하면 스탬프가 채워져요';
    return '일지에 ' + withParticle(ch.weakness) + ' 남기면 자동으로 채워져요';
  }

  function challengeBlock(state) {
    if (challengeHidden(state)) return '';
    var ch = challengeOf(state);
    var sig = challengeSig(state);

    /* 최근 2주 일지가 아예 없으면 조용히 (첫 화면은 오늘 일지에 집중) */
    if (!ch.active && ch.reason === 'no_records') return '';

    /* 일지는 있는데 약점 태그가 없을 때 — 한 줄 초대 */
    if (!ch.active) {
      return '<section class="card card--wkch is-quiet" data-region="challenge" data-sig="' + U.esc(sig) + '">' +
        '<div class="wkch">' +
        '<div class="wkch__top"><span class="wkch__eyebrow">' + UI.icon('spark') + '주간 약점 챌린지</span>' +
        '<span class="wkch__week">' + U.esc(ch.weekLabel) + '</span></div>' +
        '<p class="wkch__quiet">일지에 <b>약점 기술</b>을 하나 남기면, 이번 주 3회 챌린지가 열려요.</p>' +
        '</div></section>';
    }

    var done = ch.done;
    var progress = done
      ? '🎉 3회 채웠어요! 다음 주 월요일에 새 약점으로 바뀌어요'
      : Math.min(ch.count, ch.goal) + '/' + ch.goal + ' · ' +
        (ch.left === 1 ? '한 번만 더 채우면 완성!' : (ch.goal - ch.count) + '번 더 남았어요');
    var hint = done
      ? (ch.next ? '다음 주 후보 · ' + ch.next : '')   /* 다음 주 후보가 없으면 윗줄과 같은 말을 되풀이하지 않습니다 (v1.35) */
      : challengeHint(state, ch);

    return '<section class="card card--wkch' + (done ? ' is-done' : '') + '" data-region="challenge" data-sig="' + U.esc(sig) + '">' +
      '<div class="wkch">' +
      '<div class="wkch__top"><span class="wkch__eyebrow">' + UI.icon(done ? 'check' : 'spark') + '주간 약점 챌린지</span>' +
      '<span class="wkch__week">' + U.esc(ch.weekLabel) + '</span></div>' +
      '<div class="wkch__mid">' +
      '<p class="wkch__t">이번 주 <b>' + U.esc(ch.weakness) + '</b> ' + ch.goal + '번 연습하기</p>' +
      stampRow(ch) +
      '</div>' +
      '<p class="wkch__note' + (done ? ' is-done' : '') + '">' + U.esc(progress) + '</p>' +
      (hint ? '<p class="wkch__hint">' + U.esc(hint) + '</p>' : '') +
      /* 3회를 채웠으면 — 커뮤니티 글쓰기로 한 번에 (문구만 채우고 올리기는 사람이) */
      (done
        ? '<div class="wkch__acts"><button type="button" class="btn btn--primary btn--sm" data-act="challenge-share">' +
          UI.icon('community') + '<span>커뮤니티에 자랑하기</span></button></div>'
        : '') +
      '</div></section>';
  }

  /* ============================================================
   * 복식 파트너별 승률 (bm-v1.32.0)
   *  · 일지에 파트너 이름을 적은 기록만 셉니다(집계는 D.partnerStats 순수 함수).
   *  · 파트너 이름이 한 번도 없으면 카드 자체를 그리지 않아 첫 화면이 짧습니다.
   *  · 요약줄에는 승률이 가장 높은 파트너 한 명만, 펼치면 최대 5명.
   * ============================================================ */
  function partnerStatsOf(state) {
    return D.partnerStats((state && state.data && state.data.records) || [], { limit: 5 });
  }

  function partnerSig(state) {
    return 'ptn|' + partnerStatsOf(state).map(function (p) {
      return p.name + ':' + p.games + ':' + p.wins + ':' + p.losses + ':' + p.draws;
    }).join('|');
  }

  /* 파트너 이름이 앱 회원 닉네임과 같으면 그 사람 프로필 시트로 잇습니다 (bm-v1.34.0)
   *  · 일지에는 이름만 적히므로(회원 키 없음) 정확히 같은 닉네임이 한 명일 때만 버튼으로.
   *  · 같은 이름이 둘이거나 회원이 아니면 그냥 글자 — 잘못된 사람에게 연결하지 않습니다. */
  function partnerRow(p, top, keys) {
    var key = (keys && keys[p.name]) || '';
    return '<li class="ptn__row">' +
      '<span class="ptn__name">' + (key
        ? '<button type="button" class="ptn__link" data-partner="' + U.esc(key) + '" ' +
          'aria-label="' + U.esc(p.name) + ' 프로필 열기">' + U.esc(p.name) + '</button>'
        : U.esc(p.name)) +
      (top && p.games >= 3 ? '<i class="pill pill--ok ptn__best">찰떡</i>' : '') + '</span>' +
      '<span class="ptn__rec">' + U.esc(p.line) + '</span>' +
      '<b class="ptn__rate">' + p.rate + '%</b></li>';
  }

  /* 이름→회원 키를 카드 한 번에 계산합니다 (줄마다 다시 훑지 않게) */
  function partnerKeys(state, list) {
    var keys = {};
    (function () {
      var idx = state && state.data && state.data.idx;
      var meKey = state && state.me && state.me.key;
      (list || []).forEach(function (p) { keys[p.name] = D.memberByName(idx, p.name, { meKey: meKey }); });
    })();
    return keys;
  }

  function partnerBlock(state) {
    var list = partnerStatsOf(state);
    if (!list.length) return '';
    var top = list[0];
    var keys = partnerKeys(state, list);
    return '<section class="card card--ptn" data-region="partner" data-sig="' + U.esc(partnerSig(state)) + '">' +
      '<details class="ptn" data-ptn>' +
      '<summary class="ptn__sum">' +
      '<span class="ptn__sum-main">' +
      '<span class="ptn__t">' + UI.icon('users') + '파트너별 승률<small>복식</small></span>' +
      '<span class="ptn__sum-s">' + U.esc(top.name + ' ' + top.line + ' · ' + top.rate + '%') + '</span></span>' +
      UI.icon('arrow', 'ptn__car') +
      '</summary>' +
      '<div class="ptn__body">' +
      '<ul class="ptn__list">' + list.map(function (p) { return partnerRow(p, p === top, keys); }).join('') + '</ul>' +
      '<p class="ptn__note">일지 게임 점수에 파트너 이름을 적으면 자동으로 쌓여요' +
      (list.some(function (p) { return !!keys[p.name]; }) ? ' · 이름을 누르면 프로필' : '') + '</p>' +
      '</div></details></section>';
  }

  function timerWidget(key, name) {
    return BM.timer ? BM.timer.widget(key, name) : '';
  }

  function sbTeam(st, side) {
    if (side === 'a') return st.type === '단식' ? '나' : '내 팀';
    return st.type === '단식' ? '상대' : '상대 팀';
  }

  function sbSeg(attr, values, cur, suffix) {
    return '<div class="seg seg--wide" data-sb-' + attr + '>' + values.map(function (v) {
      var on = String(cur) === String(v);
      return '<button type="button" class="seg__btn' + (on ? ' is-on' : '') + '" data-sb-' + attr + '-val="' + U.esc(v) + '"' +
        ' aria-pressed="' + (on ? 'true' : 'false') + '">' + U.esc(v) + (suffix || '') + '</button>';
    }).join('') + '</div>';
  }

  function scoreboardHtml(src) {
    var SB = BM.scoreboard;
    if (!SB) return '';
    var st = SB.copy(src);
    st.over = SB.winner(st);            /* 끝났는지는 점수에서 바로 나옵니다 */
    var list = SB.games(st);
    var sum = SB.summary(st);
    var stt = SB.stateText(st);
    var sets = list.map(function (g, i) {
      var win = g.a > g.b ? '승' : g.a < g.b ? '패' : '무';
      return '<li class="sb__set"><span class="sb__setn">' + (i + 1) + '세트</span><b>' + g.a + ':' + g.b + '</b>' +
        '<i class="sb__res sb__res--' + (win === '승' ? 'w' : win === '패' ? 'l' : 'd') + '">' + win + '</i></li>';
    }).join('');
    return '<div class="sb" data-sb>' +
      '<div class="sb__modes">' + sbSeg('mode', [21, 25], st.mode, '점제') + sbSeg('type', ['복식', '단식'], st.type, '') + '</div>' +
      '<div class="sb__board">' +
        '<div class="sb__side"><span class="sb__who">' + U.esc(sbTeam(st, 'a')) + '</span>' +
          '<b class="sb__num">' + st.a + '</b></div>' +
        '<span class="sb__colon">:</span>' +
        '<div class="sb__side sb__side--b"><span class="sb__who">' + U.esc(sbTeam(st, 'b')) + '</span>' +
          '<b class="sb__num">' + st.b + '</b></div>' +
      '</div>' +
      '<p class="sb__state sb__state--' + U.esc(stt.kind) + '">' + U.esc(stt.text) + '</p>' +
      '<div class="sb__add">' +
        '<button type="button" class="sb__btn sb__btn--a" data-sb-point="a" aria-label="' +
          U.esc(sbTeam(st, 'a')) + ' 1점"><b>+1</b><span>' + U.esc(sbTeam(st, 'a')) + '</span></button>' +
        '<button type="button" class="sb__btn sb__btn--b" data-sb-point="b" aria-label="' +
          U.esc(sbTeam(st, 'b')) + ' 1점"><b>+1</b><span>' + U.esc(sbTeam(st, 'b')) + '</span></button>' +
      '</div>' +
      '<div class="sb__tools">' +
        '<button type="button" class="linkbtn" data-sb-undo>되돌리기</button>' +
        '<span class="sb__score">' + (sum.count
          ? sum.count + '세트 · ' + sum.wins + '승 ' + sum.losses + '패' + (sum.draws ? ' ' + sum.draws + '무' : '')
          : '아직 끝난 세트가 없어요') + '</span>' +
      '</div>' +
      (sets ? '<ul class="sb__sets">' + sets + '</ul>' : '') +
      '<div class="sb__foot">' +
        (st.over ? '<button type="button" class="btn btn--ghost grow" data-sb-next>다음 세트</button>' : '') +
        (list.length
          ? '<button type="button" class="btn btn--primary grow" data-sb-save>' + UI.icon('check') + '오늘 일지에 넣기</button>'
          : '<p class="sb__hint">한 세트를 마치면 오늘 일지에 바로 넣을 수 있어요</p>') +
      '</div></div>';
  }

  /* 점수판 시트 — 누를 때마다 [data-sb]만 다시 그려 이벤트는 한 번만 겁니다 */
  function scoreboardOpen(ctx) {
    var SB = BM.scoreboard;
    if (!SB) return null;
    if (!sbState) sbState = SB.create();
    var node = null;

    function sync() { sbState.over = SB.winner(sbState); }
    function repaint() {
      if (!node) return;
      var host = node.querySelector('[data-sb]');
      if (host) host.outerHTML = scoreboardHtml(sbState);
    }
    function save() {
      sync();
      var draft = (ctx.store && ctx.store.state && ctx.store.state.drafts && ctx.store.state.drafts.log) || {};
      var patch = SB.draftPatch(sbState, draft);
      if (!patch) { UI.toast('한 세트를 마치면 넣을 수 있어요'); return; }
      var summary = SB.summary(sbState);
      UI.closeSheet();
      sbState = null;                       /* 넣었으니 다음엔 새 점수판으로 */
      ctx.actions.setDraft(patch);
      UI.haptic(16);
      if (ctx.repaint) ctx.repaint();
      UI.toast((summary.count > 1 ? summary.count + '세트 ' : '') + '점수를 일지에 넣었어요 · 저장을 누르면 AI 분석까지 이어져요');
      setTimeout(function () {
        var form = document.querySelector('[data-form="log"]');
        if (form && form.scrollIntoView) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 160);
    }

    return UI.openSheet({
      title: '코트 점수판',
      body: scoreboardHtml(sbState),
      onMount: function (n) {
        node = n;
        n.addEventListener('click', function (ev) {
          var el;
          if ((el = ev.target.closest('[data-sb-point]'))) {
            ev.preventDefault();
            sync();
            sbState = SB.point(sbState, el.getAttribute('data-sb-point'));
            sync();
            UI.haptic(sbState.over ? 26 : 8);   /* 세트가 끝나면 조금 긴 진동 — 화면에 '세트 종료'가 이미 보임 */
            repaint();
            return;
          }
          if ((el = ev.target.closest('[data-sb-mode-val]'))) {
            ev.preventDefault();
            var mode = +el.getAttribute('data-sb-mode-val') === 25 ? 25 : 21;
            if (mode !== sbState.mode) {
              sbState = SB.copy(sbState);
              sbState.mode = mode;
              sync();
              UI.haptic(6);
              repaint();
            }
            return;
          }
          if ((el = ev.target.closest('[data-sb-type-val]'))) {
            ev.preventDefault();
            var type = SB.normalType(el.getAttribute('data-sb-type-val'));
            if (type !== sbState.type) {
              sbState = SB.copy(sbState);
              sbState.type = type;
              sync();
              UI.haptic(6);
              repaint();
            }
            return;
          }
          if (ev.target.closest('[data-sb-undo]')) {
            ev.preventDefault();
            sync();
            sbState = SB.undo(sbState);
            UI.haptic(6);
            repaint();
            return;
          }
          if (ev.target.closest('[data-sb-next]')) {
            ev.preventDefault();
            sync();
            sbState = SB.nextSet(sbState);
            UI.haptic(10);
            repaint();
            return;
          }
          if (ev.target.closest('[data-sb-save]')) {
            ev.preventDefault();
            save();
            return;
          }
        });
      }
    });
  }

  var view = {
    title: '일지 & AI',
    render: function (state) {
      var d = state.drafts.log;
      var an = state.analysis;
      var editing = !!(state.ui && state.ui.editLogId);
      var recent = (state.data.records || []).slice(0, 8);
      var stats = state.data.stats || {};
      return '' +
        '<section class="card card--hero">' +
        '<div class="hero__top"><div><p class="hero__hi">' + U.esc((state.me && state.me.nick) || '회원') + '님, 오늘 어땠나요?</p>' +
        '<p class="hero__sub">' + (stats.streak >= 2 ? stats.streak + '일 연속 기록 중 🔥' : '한 줄만 남겨도 AI가 다음 훈련을 골라드려요') + '</p></div>' +
        '<div class="hero__stat"><strong>' + (stats.sessions14 || 0) + '</strong><span>최근 2주</span></div></div>' +
        '<div class="stat-strip">' +
        '<div><span>승률</span><strong>' + (stats.winRate == null ? '—' : stats.winRate + '%') + '</strong></div>' +
        '<div><span>이번 달</span><strong>' + (stats.minutesMonth || 0) + '<i>분</i></strong></div>' +
        '<div><span>평균 컨디션</span><strong>' + (stats.avgCond == null ? '—' : stats.avgCond) + '</strong></div>' +
        '</div>' +
        /* 코트에서 바로 쓰는 점수판 입구 — 계산은 js/scoreboard.js */
        '<button type="button" class="courttool" data-act="open-scoreboard">' +
        UI.icon('plus') +
        '<span class="courttool__t">코트 점수판<small>21·25점 · 듀스 자동 · 끝나면 일지로</small></span>' +
        UI.icon('arrow', 'courttool__car') + '</button>' +
        '</section>' +

        routineBlock(state) +

        /* 코치 유형이면 피드백 흐름으로 이어지는 짧은 카드 */
        roleHint(state) +

        /* 주간 약점 3회 챌린지 — 루틴 요약 바로 아래(루틴을 건너뛰었거나 초심 1주차 전이면 숨김) */
        challengeBlock(state) +

        beginnerBlock(state) +

        /* v1.35: 파트너별 승률은 '저장 결과 요약'이라 오늘 일지 입력 아래로 내렸습니다
         *  (입력까지 76px 빨라지고, 저장하면 바로 아래에서 숫자가 바뀝니다) */
        '<section class="card" data-form="log">' +
        '<header class="card__head"><h2>' + (editing ? '지난 일지 수정' : '오늘 일지') + '</h2>' +
        '<label class="datepick"><input type="date" data-field="date" value="' + U.esc(d.date) + '"></label></header>' +

        (editing
          ? '<div data-edit-banner>' +
            '<div class="pp__note pp__note--info">' + UI.icon('edit') +
            '<span><b>' + U.esc(U.dayLabel(d.date)) + ' 일지를 고치는 중이에요.</b> 저장하면 새 기록이 쌓이지 않고 이 일지만 바뀝니다.</span></div>' +
            '<div class="row mt8"><button type="button" class="linkbtn" data-act="cancel-edit">수정 취소</button></div></div>'
          : '') +

        '<div class="fieldgrid">' +
        '<div class="field"><div class="field__label"><span>컨디션</span><b data-out="cond"' + (d.cond == null ? ' class="is-unset"' : '') + '>' + (d.cond == null ? '미입력' : d.cond) + '</b></div>' +
        '<input type="range" min="1" max="10" step="1" value="' + (d.cond == null ? 5 : d.cond) + '" data-field="cond" class="range" style="--fill:' + fillOf(d.cond) + '%' + '" aria-label="컨디션 1에서 10">' +
        '<div class="range__ends"><span>무거움</span><span>가벼움</span></div></div>' +

        '<div class="field"><div class="field__label"><span>훈련강도</span><b data-out="intensity"' + (d.intensity == null ? ' class="is-unset"' : '') + '>' + (d.intensity == null ? '미입력' : d.intensity) + '</b></div>' +
        '<input type="range" min="1" max="10" step="1" value="' + (d.intensity == null ? 5 : d.intensity) + '" data-field="intensity" class="range" style="--fill:' + fillOf(d.intensity) + '%' + '" aria-label="훈련 강도 1에서 10">' +
        '<div class="range__ends"><span>가볍게</span><span>전력</span></div></div>' +
        '</div>' +

        '<div class="field"><div class="field__label"><span>운동 시간</span><b data-out="minutes"' + (d.minutes == null ? ' class="is-unset"' : '') + '>' + (d.minutes == null ? '미입력' : d.minutes + '분') + '</b></div>' +
        '<div class="stepper"><button type="button" class="step" data-step="-5" aria-label="5분 줄이기">−</button>' +
        '<input type="number" inputmode="numeric" min="0" max="300" step="5" value="' + (d.minutes == null ? '' : d.minutes) + '" placeholder="60" data-field="minutes" aria-label="운동 시간(분)">' +
        '<button type="button" class="step" data-step="5" aria-label="5분 늘리기">+</button></div></div>' +

        /* 선수 유형(또는 MY에서 켠 사람)은 7대 훈련 블록, 그 외에는 지금의 완료 훈련 칩 */
        (proOn(state) ? proBlock(state, d) : doneField(d)) +
        gamesFold(d, state) +

        '<div class="field"><div class="field__label"><span>아픈 부위</span><small>없으면 그대로</small></div>' +
        UI.chips('pain', D.VOCAB.pain, d.pain, { scroll: true }) + '</div>' +

        '<div class="field"><div class="field__label"><span>약점 기술</span><small>오늘 아쉬웠던 것</small></div>' +
        UI.chips('weakness', D.VOCAB.weakness, d.weakness, { scroll: true }) + '</div>' +

        '<div class="field"><div class="field__label"><span>메모</span><small>선택</small></div>' +
        '<textarea rows="2" data-field="note" placeholder="오늘 느낀 점 한 줄">' + U.esc(d.note || '') + '</textarea></div>' +

        /* 스윙·경기 영상 — 링크만 저장합니다(앱에 올리지 않음). http(https)만 허용. */
        '<div class="field" data-video-field>' +
        '<div class="field__label"><span>영상 링크</span><small>유튜브·드라이브 · 선택</small></div>' +
        '<input type="url" inputmode="url" maxlength="' + D.VIDEO_URL_MAX + '" data-field="video" ' +
          'value="' + U.esc(d.video || '') + '" placeholder="https://youtu.be/…" aria-label="영상 링크">' +
        '<p class="field__hint' + (videoHintOf(d.video).bad ? ' is-warn' : '') + '" data-video-hint>' + U.esc(videoHintOf(d.video).text) + '</p>' +
        '<input type="text" maxlength="' + D.VIDEO_LABEL_MAX + '" class="mt8" data-field="videoNote" ' +
          'value="' + U.esc(d.videoNote || '') + '" placeholder="영상에서 볼 한 줄 (예: 스매시 손목 각도)" aria-label="영상 체크 포인트">' +
        '</div>' +

        '<div class="submit-wrap savebar">' +
        '<button class="btn btn--primary btn--big" data-act="save-log">' +
        UI.icon('check') + '<span>' + (editing ? '수정 저장' : '저장하고 AI 분석') + '</span></button>' +
        '<p class="hint">' + (editing ? '바뀐 칸만 새로 계산해 이 일지에 반영합니다' : '비워 둔 항목은 저장하지 않아요') + '</p></div>' +
        '</section>' +

        analysisCard(an, state) +

        /* 복식 파트너별 승률 — 파트너 이름을 적은 일지가 있을 때만 (일지 입력·분석 바로 아래) */
        partnerBlock(state) +

        '<section class="card" data-region="recent">' +
        '<header class="card__head"><h2>최근 기록</h2><span class="muted">' + recent.length + '건</span></header>' +
        (recent.length ? '<ul class="loglist">' + recent.map(recentRow).join('') + '</ul>'
          : UI.emptyState('log', '아직 기록이 없어요', '오늘 일지를 저장하면 여기에 쌓입니다.')) +
        '</section>';
    },

    mount: function (root, ctx) {
      /* 초보자 루틴: 펼침 상태 기억 — 카드가 다시 그려져도 접히지 않습니다 */
      root.addEventListener('toggle', function (ev) {
        var box = ev.target;
        if (box && box.matches && box.matches('[data-rtn]')) routineOpen = !!box.open;
      }, true);

      /* 초보자 루틴: 체크 · 주차 이동 · 체크 지우기 (카드가 다시 그려져도 살아 있게 위임) */
      root.addEventListener('change', function (ev) {
        var cb = ev.target.closest ? ev.target.closest('[data-rtn-item]') : null;
        if (!cb || !BM.routine) return;
        var id = cb.getAttribute('data-rtn-item');
        var item = null;
        for (var i = 0; i < BM.routine.ALL_ITEMS.length; i++) {
          if (BM.routine.ALL_ITEMS[i].id === id) { item = BM.routine.ALL_ITEMS[i]; break; }
        }
        if (!item) return;
        var before = BM.routine.stats(ctx.store.state.routine);
        ctx.actions.toggleRoutine(id);
        var after = BM.routine.stats(ctx.store.state.routine);
        var was = before.weeks[item.week - 1], now = after.weeks[item.week - 1];
        if (was && now && !was.complete && now.complete) {
          UI.haptic(14);
          if (now.no < 4) {
            UI.toast(now.no + '주차 완료! ' + (now.no + 1) + '주차로 넘어가요');
            ctx.actions.setRoutineWeek(now.no + 1);
          } else {
            UI.toast('4주 루틴 완주! 정말 수고했어요 🎉');
          }
        } else {
          UI.haptic(8);
        }
      });

      var form = root.querySelector('[data-form="log"]');
      if (!form) return;

      /* 게임 목록을 상태에서 다시 그립니다 (추가·삭제·점수제 변경) */
      function repaintGames(focusLast) {
        var host = form.querySelector('[data-gamelist]');
        if (!host) return;
        var draft = ctx.store.state.drafts.log;
        var games = draftGames(draft);
        host.innerHTML = gamesRows(games);
        var sum = form.querySelector('[data-gamesum]');
        if (sum) sum.innerHTML = gamesSummaryText(games);
        if (focusLast) {
          var inputs = host.querySelectorAll('[data-field="gameA"]');
          if (inputs.length && inputs[inputs.length - 1].focus) inputs[inputs.length - 1].focus();
        }
      }

      form.addEventListener('input', function (ev) {
        var el = ev.target;
        var f = el.getAttribute && el.getAttribute('data-field');
        if (!f) return;
        if (f === 'cond' || f === 'intensity') {
          var out = form.querySelector('[data-out="' + f + '"]');
          if (out) { out.textContent = el.value; out.classList.remove('is-unset'); }
          el.style.setProperty('--fill', fillOf(+el.value) + '%');
          var patch1 = {}; patch1[f] = +el.value; ctx.actions.setDraft(patch1);
        } else if (f === 'minutes') {
          var mo = form.querySelector('[data-out="minutes"]');
          var mv = el.value === '' ? null : U.clamp(+el.value || 0, 0, 300);
          if (mo) {
            mo.textContent = mv == null ? '미입력' : mv + '분';
            mo.classList.toggle('is-unset', mv == null);
          }
          ctx.actions.setDraft({ minutes: mv });
        } else if (f === 'gameA' || f === 'gameB') {
          var gi = +el.getAttribute('data-gi');
          var games = draftGames(ctx.store.state.drafts.log).slice();
          var g = { a: games[gi] ? games[gi].a : '', b: games[gi] ? games[gi].b : '' };
          g[f === 'gameA' ? 'a' : 'b'] = el.value;
          games[gi] = g;
          ctx.actions.setDraft({ games: games });
          var sum = form.querySelector('[data-gamesum]');
          if (sum) sum.innerHTML = gamesSummaryText(games);
        } else if (f === 'date') {
          ctx.actions.setDraft({ date: el.value });
        } else if (f === 'note') {
          ctx.actions.setDraft({ note: el.value });
        } else if (f === 'partner') {
          /* 이름은 저장할 때 정리합니다(20자·줄바꿈 제거) — 입력 중 커서가 끊기지 않게 그대로 둡니다 */
          ctx.actions.setDraft({ partner: el.value });
          paintPartnerNow(ctx, form, el.value);
        } else if (f === 'video') {
          ctx.actions.setDraft({ video: el.value });
          var vh = form.querySelector('[data-video-hint]');
          if (vh) {
            var hint = videoHintOf(el.value);
            vh.textContent = hint.text;
            vh.classList.toggle('is-warn', hint.bad);
          }
        } else if (f === 'videoNote') {
          ctx.actions.setDraft({ videoNote: el.value });
        } else if (f === 'proNote') {
          /* 7대 훈련 — 적는 칸은 입력 중 커서가 끊기지 않게 그대로 두고 초안만 갱신합니다 */
          var pname = el.getAttribute('data-pro-name');
          var ppro = JSON.parse(JSON.stringify(ctx.store.state.drafts.log.pro || {}));
          ppro[pname] = el.value;
          ctx.actions.setDraft({ pro: ppro });
          var pli = el.closest('[data-pro]');
          var psum = pli && pli.querySelector('.pro__sum');
          if (psum) psum.textContent = el.value;
        }
      }, { passive: true });

      form.addEventListener('click', function (ev) {
        var step = ev.target.closest('[data-step]');
        if (step) {
          ev.preventDefault();
          var input = form.querySelector('[data-field="minutes"]');
          var next = U.clamp((+input.value || 0) + (+step.getAttribute('data-step')), 0, 300);
          input.value = next;
          var mo = form.querySelector('[data-out="minutes"]');
          if (mo) { mo.textContent = next + '분'; mo.classList.remove('is-unset'); }
          ctx.actions.setDraft({ minutes: next });
          UI.haptic(6);
          return;
        }
        var addGame = ev.target.closest('[data-act="add-game"]');
        if (addGame) {
          ev.preventDefault();
          var list = draftGames(ctx.store.state.drafts.log).slice();
          list.push({ a: '', b: '' });
          ctx.actions.setDraft({ games: list });
          repaintGames(true);
          UI.haptic(8);
          return;
        }
        var removeGame = ev.target.closest('[data-act="remove-game"]');
        if (removeGame) {
          ev.preventDefault();
          var at = +removeGame.getAttribute('data-gi');
          var left = draftGames(ctx.store.state.drafts.log).slice();
          left.splice(at, 1);
          if (!left.length) left = [{ a: '', b: '' }];
          ctx.actions.setDraft({ games: left });
          repaintGames(false);
          UI.haptic(6);
          return;
        }
        var modeBtn = ev.target.closest('[data-gamemode-val]');
        if (modeBtn) {
          ev.preventDefault();
          var mode = +modeBtn.getAttribute('data-gamemode-val') === 25 ? 25 : 21;
          ctx.actions.setDraft({ gameMode: mode });
          UI.$$('[data-gamemode-val]', form).forEach(function (b) {
            var on = +b.getAttribute('data-gamemode-val') === mode;
            b.classList.toggle('is-on', on);
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
          });
          UI.haptic(6);
          return;
        }
        /* 최근 파트너 칩 — 1탭으로 이름을 넣고, 같은 칩을 다시 누르면 지웁니다 */
        var ptnChip = ev.target.closest('[data-ptn-chip]');
        if (ptnChip) {
          ev.preventDefault();
          var ptnInput = form.querySelector('[data-field="partner"]');
          var picked = ptnChip.getAttribute('data-ptn-chip') || '';
          var now = ptnInput ? String(ptnInput.value || '').replace(/\s+/g, ' ').trim() : '';
          var next = now === picked ? '' : picked;
          if (ptnInput) ptnInput.value = next;
          ctx.actions.setDraft({ partner: next });
          paintPartnerNow(ctx, form, next);
          UI.$$('[data-ptn-chip]', form).forEach(function (b) {
            var on = next !== '' && b.getAttribute('data-ptn-chip') === next;
            b.classList.toggle('is-on', on);
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
          });
          UI.haptic(8);
          return;
        }
        /* 선수 7대 훈련 — 항목을 누르면 체크되면서 적는 칸이 열립니다 */
        var proBtn = ev.target.closest('[data-pro-toggle]');
        if (proBtn) {
          ev.preventDefault();
          var itemName = proBtn.getAttribute('data-pro-toggle') || '';
          var itemDef = D.proItemByName(itemName);
          if (!itemDef) return;
          var draft0 = ctx.store.state.drafts.log;
          var nextPro = JSON.parse(JSON.stringify(draft0.pro || {}));
          var nextDone = (draft0.done || []).slice();
          var wasOn = Object.prototype.hasOwnProperty.call(nextPro, itemName);
          var row = proBtn.closest('[data-pro]');
          var note = row ? row.querySelector('[data-pro-note]') : null;
          if (wasOn) {
            delete nextPro[itemName];
            nextDone = nextDone.filter(function (v) { return v !== itemName; });
          } else {
            nextPro[itemName] = note ? String(note.value || '') : '';
            if (nextDone.indexOf(itemName) < 0) nextDone.push(itemName);
          }
          ctx.actions.setDraft({ pro: nextPro, done: nextDone });
          if (row) row.classList.toggle('is-on', !wasOn);
          var box = proBtn.querySelector('.pro__box');
          if (box) box.textContent = wasOn ? '' : '✓';
          proBtn.setAttribute('aria-pressed', wasOn ? 'false' : 'true');
          var sumEl = row ? row.querySelector('.pro__sum') : null;
          if (sumEl) sumEl.textContent = wasOn ? '' : (nextPro[itemName] || '');
          if (note) {
            note.hidden = wasOn;
            if (!wasOn && note.focus) { try { note.focus(); } catch (e) { /* 무시 */ } }
          }
          UI.haptic(wasOn ? 4 : 8);
          return;
        }
        var chip = ev.target.closest('[data-chip]');
        if (chip) {
          ev.preventDefault();
          UI.toggleChip(chip);
          var group = chip.closest('[data-chipgroup]');
          var name = group.getAttribute('data-chipgroup');
          var vals = UI.readChips(group);
          var patch = {}; patch[name] = vals;
          ctx.actions.setDraft(patch);
          UI.haptic(6);
          return;
        }
        var seg = ev.target.closest('[data-segval]');
        if (seg) {
          ev.preventDefault();
          UI.$$('.seg__btn', seg.parentNode).forEach(function (b) { b.classList.remove('is-on'); });
          seg.classList.add('is-on');
          ctx.actions.setDraft({ result: seg.getAttribute('data-segval') });
          UI.haptic(6);
          return;
        }
        if (ev.target.closest('[data-act="save-log"]')) {
          ev.preventDefault();
          ctx.saveLog(ev.target.closest('[data-act="save-log"]'));
          return;
        }
      });

      root.addEventListener('click', function (ev) {
        /* 코치 유형 안내 → 코치 탭 */
        if (ev.target.closest('[data-act="go-coach"]')) {
          ev.preventDefault();
          ctx.actions.setTab('coach');
          return;
        }
        /* 코트 점수판 — 21·25점 시트 */
        if (ev.target.closest('[data-act="open-scoreboard"]')) {
          ev.preventDefault();
          UI.haptic(8);
          scoreboardOpen(ctx);
          return;
        }
        /* 드릴 · 워밍업 옆 카운트다운 타이머 (한 번에 하나만) */
        var tStart = ev.target.closest('[data-timer-start]');
        if (tStart && BM.timer) {
          ev.preventDefault();
          var tHost = tStart.closest('[data-dtimer]');
          var tKey = tStart.getAttribute('data-timer-start');
          var tMin = +tStart.getAttribute('data-timer-min') || 3;
          var tName = tHost ? (tHost.getAttribute('data-dtimer-name') || '') : '';
          var res = BM.timer.start(tKey, tName, tMin);
          UI.haptic(10);
          UI.toast(tMin + '분 타이머를 시작했어요' + (res && res.replaced ? ' · 돌던 타이머는 멈췄어요' : ''));
          return;
        }
        if (ev.target.closest('[data-timer-toggle]') && BM.timer) {
          ev.preventDefault();
          BM.timer.toggle();
          UI.haptic(6);
          return;
        }
        if (ev.target.closest('[data-timer-reset]') && BM.timer) {
          ev.preventDefault();
          BM.timer.reset();
          UI.haptic(6);
          return;
        }
        /* 처음이라면 — 초보자 튜토리얼 · 용어 사전 · 기술 가이드 패널 */
        var begBtn = ev.target.closest('[data-act="beginner-open"]');
        if (begBtn) {
          ev.preventDefault();
          if (BM.beginner) {
            BM.beginner.open({
              tab: begBtn.getAttribute('data-beg-tab') || 'intro',
              skill: begBtn.getAttribute('data-beg-skill') || ''
            });
          }
          UI.haptic(8);
          return;
        }
        /* 선택 카드 — 시작하기 / 건너뛰기 */
        if (ev.target.closest('[data-act="routine-start"]')) {
          ev.preventDefault();
          routineOpen = true;                                  /* 시작했으니 체크리스트를 펼쳐서 */
          ctx.actions.setRoutinePref(true);
          UI.toast('4주 루틴을 켰어요 · 1주차부터 하나씩 해 봐요');
          UI.haptic(12);
          return;
        }
        if (ev.target.closest('[data-act="routine-skip"]')) {
          ev.preventDefault();
          ctx.actions.setRoutinePref(false);
          UI.toast('루틴을 숨겼어요 · MY에서 언제든 다시 켤 수 있어요');
          UI.haptic(8);
          return;
        }
        var wk = ev.target.closest('[data-rtn-week]');
        if (wk) {
          ev.preventDefault();
          ctx.actions.setRoutineWeek(+wk.getAttribute('data-rtn-week'));
          UI.haptic(6);
          return;
        }
        /* 수정 중인 일지를 그만 고치기 — 입력칸을 비우고 새 일지로 돌아갑니다 */
        if (ev.target.closest('[data-act="cancel-edit"]')) {
          ev.preventDefault();
          ctx.actions.cancelEditLog();
          UI.toast('수정을 그만됐어요');
          UI.haptic(6);
          if (ctx.repaint) ctx.repaint();
          return;
        }
        if (ev.target.closest('[data-act="routine-reset"]')) {
          ev.preventDefault();
          UI.confirm('체크한 내용을 모두 지울까요?', '지우기').then(function (yes) {
            if (!yes) return;
            ctx.actions.resetRoutine();
            ctx.actions.setRoutineWeek(1);
            UI.toast('체크를 지웠어요. 1주차부터 다시 시작해요');
          });
          return;
        }
        /* 저장 직후 공유 스트립 (분석 카드 안 · 폼 밖) */
        if (ev.target.closest('[data-act="share-log"]')) {
          ev.preventDefault();
          var shared = ctx.actions.shareLogToCommunity();
          if (shared.ok) { UI.toast('커뮤니티에 올렸어요'); UI.haptic(10); }
          else if (shared.reason === 'already') UI.toast('이미 공유한 일지예요');
          else if (shared.reason === 'locked') UI.toast('잠시만요, 올리는 중이에요');
          else UI.toast('공유할 일지가 없어요', 'error');
          return;
        }
        if (ev.target.closest('[data-act="dismiss-share"]')) {
          ev.preventDefault();
          ctx.actions.dismissShare();
          return;
        }
        /* 주간 약점 챌린지 3회 달성 → 커뮤니티 글쓰기(말머리 '일지')로 이동 */
        if (ev.target.closest('[data-act="challenge-share"]')) {
          ev.preventDefault();
          var chNow = challengeOf(ctx.store.state);
          if (!chNow.active || !chNow.done) { UI.toast('3회를 채우면 자랑할 수 있어요'); return; }
          /* 초안은 저장소가 만듭니다 — 이번 주 함께 친 파트너·전적까지 붙어서 (bm-v1.36.0) */
          var draft = ctx.actions.challengeShareDraft ? ctx.actions.challengeShareDraft() : null;
          var text = (draft && draft.ok) ? draft.text : D.challengeShareText(chNow);
          UI.haptic(12);
          if (ctx.actions.startChallengeShare) {
            ctx.actions.startChallengeShare(text, '일지');
            UI.toast('커뮤니티 글쓰기에 문구를 채웠어요 · 올리기만 누르면 돼요');
          } else {
            ctx.actions.setComposer(text);
            ctx.actions.setComposerTopic('일지');
            ctx.actions.setTab('community');
            UI.toast('커뮤니티 글쓰기로 옮겼어요');
          }
          return;
        }
        /* 파트너 이름 → 그 사람 프로필 시트(친구 상태·채팅 — 친구 추가는 친구 코드로만, v1.38). 같은 닉네임이 둘이면 글자로 남습니다 */
        var ptn = ev.target.closest('[data-partner]');
        if (ptn) {
          ev.preventDefault();
          if (BM.views.profile) BM.views.profile.open(ptn.getAttribute('data-partner'), ctx);
          UI.haptic(6);
          return;
        }
        /* 영상 링크는 브라우저가 새 창으로 열게 두고, 일지 상세 시트는 열지 않습니다 */
        if (ev.target.closest('a[data-video]')) return;
        var row = ev.target.closest('[data-record]');
        if (!row) return;
        var id = row.getAttribute('data-record');
        var rec = (ctx.store.state.data.records || []).filter(function (r) { return r.id === id; })[0];
        if (!rec) return;
        UI.openSheet({
          title: U.dayLabel(rec.date) + ' 기록',
          body: recordDetail(rec),
          onMount: function (node) {
            node.addEventListener('click', function (e2) {
              if (e2.target.closest('[data-act="edit-log"]')) {
                e2.preventDefault();
                /* 시트를 먼저 닫고 그 날 일지를 입력칸으로 불러옵니다 */
                UI.closeSheet();
                var res = ctx.actions.startEditLog(id);
                if (!res || !res.ok) { UI.toast(res && res.reason === 'not_mine' ? '내 일지만 수정할 수 있어요' : '일지를 불러오지 못했어요', 'error'); return; }
                UI.haptic(8);
                if (ctx.repaint) ctx.repaint();
                setTimeout(function () {
                  var form = document.querySelector('[data-form="log"]');
                  if (form && form.scrollIntoView) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 90);
                UI.toast('기존 내용을 불러왔어요. 고친 뒤 수정 저장을 눌러 주세요');
                return;
              }
              if (e2.target.closest('[data-act="delete-log"]')) {
                e2.preventDefault();
                UI.closeSheet();
                UI.confirm(U.shortDay(rec.date) + ' 일지를 삭제할까요? 지우면 되돌릴 수 없어요.', '삭제')
                  .then(function (yes) {
                    if (!yes) return;
                    var res = ctx.actions.deleteLog(id);
                    if (res && res.ok) {
                      UI.toast('일지를 삭제했어요');
                      UI.haptic(12);
                      /* 지운 일지의 AI 카드·공유 카드가 화면에 남지 않게 다시 그립니다 */
                      if (ctx.repaint) ctx.repaint();
                    }
                    else if (res && res.reason === 'not_mine') UI.toast('내 일지만 삭제할 수 있어요', 'error');
                    else if (res && res.reason === 'locked') UI.toast('잠시만요, 처리 중이에요');
                    else UI.toast('일지를 찾지 못했어요', 'error');
                  });
                return;
              }
            });
          }
        });
      });
    },

    update: function (root, state) {
      /* 주간 약점 3회 챌린지 — 일지를 저장하면 스탬프가 스스로 채워집니다 */
      var chHost = root.querySelector('[data-region="challenge"]');
      var chHtml = challengeBlock(state);
      if (chHost) {
        if (!chHtml) chHost.remove();
        else if (chHost.getAttribute('data-sig') !== challengeSig(state)) chHost.outerHTML = chHtml;
      } else if (chHtml) {
        var chAnchor = root.querySelector('[data-region="routine"]') || root.querySelector('.card--hero');
        if (chAnchor) chAnchor.insertAdjacentHTML('afterend', chHtml);
      }
      /* 복식 파트너별 승률 — 일지를 저장하면 그 자리에서 숫자가 바뀝니다 */
      var ptnHost = root.querySelector('[data-region="partner"]');
      var ptnHtml = partnerBlock(state);
      if (ptnHost) {
        if (!ptnHtml) ptnHost.remove();
        else if (ptnHost.getAttribute('data-sig') !== partnerSig(state)) ptnHost.outerHTML = ptnHtml;
      } else if (ptnHtml) {
        var ptnAnchor = root.querySelector('[data-region="challenge"]') || root.querySelector('[data-region="routine"]') || root.querySelector('.card--hero');
        if (ptnAnchor) ptnAnchor.insertAdjacentHTML('afterend', ptnHtml);
      }
      var rtn = root.querySelector('[data-region="routine"]');
      var rtnHtml = routineBlock(state);
      if (rtn) {
        if (!rtnHtml) rtn.remove();                                  /* 건너뛰기 → 카드 숨김 */
        else if (rtn.getAttribute('data-sig') !== routineSig(state)) rtn.outerHTML = rtnHtml;
      } else if (rtnHtml) {
        var hero = root.querySelector('.card--hero');
        if (hero) hero.insertAdjacentHTML('afterend', rtnHtml);       /* 다시 켜기 → 카드 복귀 */
      }
      var beg = root.querySelector('[data-region="beginner"]');
      var begHtml = beginnerBlock(state);
      if (beg) {
        if (begHtml && beg.getAttribute('data-sig') !== beginnerSig(state)) beg.outerHTML = begHtml;
      } else if (begHtml) {
        var begHost = root.querySelector('[data-region="routine"]') || root.querySelector('.card--hero');
        if (begHost) begHost.insertAdjacentHTML('afterend', begHtml);
      }
      var anRegion = root.querySelector('[data-region="analysis"]');
      var html = analysisCard(state.analysis, state);
      if (anRegion) {
        if (html) anRegion.outerHTML = html;
      } else if (html) {
        var form = root.querySelector('[data-form="log"]');
        if (form) form.insertAdjacentHTML('afterend', html);
      }
      var recent = root.querySelector('[data-region="recent"]');
      if (recent) {
        var list = (state.data.records || []).slice(0, 8);
        recent.innerHTML = '<header class="card__head"><h2>최근 기록</h2><span class="muted">' + list.length + '건</span></header>' +
          (list.length ? '<ul class="loglist">' + list.map(recentRow).join('') + '</ul>'
            : UI.emptyState('log', '아직 기록이 없어요', '오늘 일지를 저장하면 여기에 쌓입니다.'));
      }
    }
  };

  function recordDetail(rec) {
    var games = (rec.games && rec.games.length) ? rec.games : (rec.score ? [rec.score] : []);
    var meta = D.logMeta(rec);
    var gameText = games.map(function (g, i) {
      return (games.length > 1 ? (i + 1) + '게임 ' : '') + (g.mode === 25 ? '25점제 ' : '') + g.a + ':' + g.b;
    }).join(' / ');
    var rows = [
      ['컨디션', rec.cond], ['훈련강도', rec.intensity], ['운동시간', rec.minutes ? rec.minutes + '분' : ''],
      ['완료훈련', (rec.done || []).join(', ')], ['복식 파트너', meta.partner],
      ['게임점수', gameText || rec.scoreRaw || ''], ['결과', rec.result],
      ['아픈부위', (rec.pain || []).join(', ')], ['약점기술', (rec.weakness || []).join(', ')]
    ].filter(function (r) { return r[1] !== '' && r[1] != null; });
    var care = rec.prescription || null;
    var pro = D.proOf(rec);
    var proRows = D.PRO_ITEMS.filter(function (it) { return Object.prototype.hasOwnProperty.call(pro, it.name); })
      .map(function (it) {
        return '<li><b>' + U.esc(it.name) + '</b>' + (pro[it.name] ? ' — ' + U.esc(pro[it.name]) : '') + '</li>';
      }).join('');
    return '<dl class="kv">' + rows.map(function (r) {
      return '<dt>' + U.esc(r[0]) + '</dt><dd>' + U.esc(r[1]) + '</dd>';
    }).join('') + '</dl>' +
      /* 선수 7대 훈련 상세 — 어떤 걸 했는지 (bm-v1.40.0) */
      (proRows ? '<h3 class="sec-title">선수 7대 훈련</h3><ul class="bullets prodetail">' + proRows + '</ul>' : '') +
      /* 스윙·경기 영상 — 한 줄 체크 포인트 + 버튼 하나로 새 창 */
      (meta.video.url
        ? '<div class="vidbox" data-video-box>' +
          '<p class="vidbox__head">' + UI.icon('camera') + '영상 체크</p>' +
          (meta.video.label ? '<p class="vidbox__label">' + U.esc(meta.video.label) + '</p>' : '') +
          '<a class="btn btn--primary btn--sm vidbox__btn" data-video href="' + U.esc(meta.video.url) + '" ' +
            'target="_blank" rel="noopener noreferrer">영상 보기 ↗</a>' +
          '<p class="vidbox__url">' + U.esc(meta.video.url) + '</p></div>'
        : '') +
      (care ? '<h3 class="sec-title">저장된 처방</h3><div class="care">' +
        (care.warmup && care.warmup.length ? '<div class="care__col"><h4>웜업</h4>' + bulletList(care.warmup) + '</div>' : '') +
        '<div class="care__col"><h4>회복</h4>' + bulletList(care.rehab) + '</div>' +
        '<div class="care__col"><h4>스트레칭</h4>' + bulletList(care.stretch) + '</div>' +
        '</div>' : '') +
      (rec.drills && rec.drills.drills ? '<h3 class="sec-title">추천드릴</h3><ul class="bullets">' +
        rec.drills.drills.map(function (d) { return '<li><b>' + U.esc(d.name) + '</b> · ' + U.esc(d.sets) + '</li>'; }).join('') + '</ul>' : '') +
      /* 지난 일지 고치기 — 닫기(시트 상단 X) 말고 수정·삭제를 바로 둡니다 */
      '<div class="row gap8 mt16" data-log-actions>' +
      '<button type="button" class="btn btn--ghost grow" data-act="edit-log">' + UI.icon('edit') + '수정</button>' +
      '<button type="button" class="btn btn--ghost grow" data-act="delete-log">' + UI.icon('trash') + '삭제</button>' +
      '</div>';
  }

  view.recordDetail = recordDetail;
  view.analysisCard = analysisCard;
  view.challengeBlock = challengeBlock;
  view.challengeHidden = challengeHidden;
  view.partnerBlock = partnerBlock;
  view.partnerStatsOf = partnerStatsOf;
  view.recentPartners = recentPartnerNames;   /* v1.35: 최근 파트너 칩 후보 (테스트·재사용) */
  view.partnerChips = partnerChips;
  view.partnerNow = partnerNow;               /* v1.36: 입력칸 아래 파트너 전적 한 줄 */
  view.partnerNowText = partnerNowText;
  view.videoHintOf = videoHintOf;
  view.scoreboardHtml = scoreboardHtml;
  view.scoreboardOpen = scoreboardOpen;
  view._resetScoreboard = function () { sbState = null; };
  BM.views.log = view;
})(typeof globalThis !== 'undefined' ? globalThis : this);
