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

  function gamesField(d) {
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
      '</div>';
  }

  /* 게임 점수는 '선택' 입력 — 기본은 접어 두고, 점수가 있으면 펼칩니다 */
  function hasGames(d) {
    var games = (d && d.games) || [];
    return games.some(function (g) { return (g && g.a !== '' && g.a != null) || (g && g.b !== '' && g.b != null); });
  }

  function gamesFold(d) {
    var open = hasGames(d);
    var sum = D.gamesSummary(D.cleanGames(draftGames(d)));
    var val = sum.count ? sum.count + '경기 ' + sum.wins + '승 ' + sum.losses + '패' : '';
    return '<details class="fold" data-fold="games"' + (open ? ' open' : '') + '>' +
      '<summary class="fold__sum"><span>경기 점수 <small>선택</small></span>' +
      '<i class="fold__val">' + U.esc(val) + '</i>' + UI.icon('arrow', 'fold__car') + '</summary>' +
      '<div class="fold__body">' + gamesField(d) + '</div></details>';
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
    if (flow.deuce) parts.push('끝까지 간 경기 ' + flow.deuce);
    else if (flow.close) parts.push('3점차 이내 ' + flow.close);
    if (flow.fade) parts.push('마지막 경기 점수차 확대');
    return parts.join(' · ');
  }

  function loadLine(load) {
    if (!load || !load.zone) return '';
    var zone = load.zone === 'spike' ? '급증' : load.zone === 'watch' ? '조금 높음' : load.zone === 'low' ? '적음' : '적정';
    return '최근 7일 부하 ' + load.ratio + '배 · ' + zone;
  }

  function analysisCard(an, state) {
    if (!an) return '';
    var drills = (an.drills && an.drills.drills) || [];
    var gp = an.gradePlan;
    var pb = an.playbook;
    return '' +
      '<section class="card card--ai" data-region="analysis">' +
      '<header class="card__head">' +
      '<div class="ai-badge">' + UI.icon('spark') + '배드민턴 AI</div>' +
      '</header>' +
      '<div class="ai-top">' + scoreRing(an.score) +
      '<div class="ai-top__text"><p class="ai-headline">' + U.esc(an.headline) + '</p>' +
      '<p class="ai-sub">다음 목표 · <strong>' + U.esc(an.focus) + '</strong></p></div></div>' +
      '<ul class="insights">' + an.insights.map(insightRow).join('') + '</ul>' +
      (an.risk && an.risk[0] ? '<div class="risk risk--' + an.risk[0].level + '">' + UI.icon('alert') +
        '<span>' + U.esc(an.risk[0].text) + '</span></div>' : '') +
      '<h3 class="sec-title">' + UI.icon('check') + '추천 드릴</h3>' +
      '<ol class="drills">' + drills.map(function (d, i) {
        return '<li class="drill"><div class="drill__no">' + (i + 1) + '</div><div class="drill__body">' +
          '<div class="drill__top"><strong>' + U.esc(d.name) + '</strong><span class="pill pill--ghost">' + U.esc(d.sets) + '</span></div>' +
          '<p class="drill__method">' + U.esc(d.method) + '</p>' +
          '<p class="drill__point">포인트 · ' + U.esc(d.point) + '</p></div></li>';
      }).join('') + '</ol>' +
      '<details class="fold fold--ai" data-fold="care">' +
      '<summary class="fold__sum"><span>맞춤 처방 <small>웜업 · 회복 · 스트레칭</small></span>' + UI.icon('arrow', 'fold__car') + '</summary>' +
      '<div class="fold__body"><div class="care">' +
      (an.care.warmup && an.care.warmup.length
        ? '<div class="care__col"><h4>웜업</h4>' + bulletList(an.care.warmup) + '</div>' : '') +
      '<div class="care__col"><h4>회복</h4>' + bulletList(an.care.rehab) + '</div>' +
      '<div class="care__col"><h4>스트레칭</h4>' + bulletList(an.care.stretch) + '</div>' +
      '<div class="care__col"><h4>마음</h4>' + bulletList(an.care.mental) + '</div>' +
      '</div></div></details>' +
      (an.flow && an.flow.count && an.flow.tips && an.flow.tips.length
        ? '<h3 class="sec-title">' + UI.icon('chart') + '경기 흐름 · ' + U.esc(an.flow.mode + '점제') + '</h3>' +
          '<div class="planbox"><p class="planbox__t">' + U.esc(flowLine(an.flow)) + '</p>' +
          bulletList(an.flow.tips) + '</div>' : '') +
      (an.load && an.load.zone
        ? '<h3 class="sec-title">' + UI.icon('clock') + '부하 점검</h3>' +
          '<div class="planbox"><p class="planbox__t">' + U.esc(loadLine(an.load)) + '</p>' +
          '<p class="planbox__v">운동 시간 × 강도로 계산한 내부 부하예요. 직전 4주 평균과 비교합니다.</p>' +
          bulletList(an.load.tips) + '</div>' : '') +
      '<h3 class="sec-title">' + UI.icon('chart') + '이번 주 루틴</h3>' +
      '<div class="week">' + an.week.map(function (w) {
        return '<div class="week__row"><span class="week__day">' + U.esc(w.day) + '</span>' +
          '<span class="week__focus">' + U.esc(w.focus) + '</span><span class="week__menu">' + U.esc(w.menu) + '</span></div>';
      }).join('') + '</div>' +
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

  /* 공유 미리보기 — 일지에서 시간·훈련·전적만 담백하게 */
  function sharePreview(e) {
    var games = (e.games && e.games.length) ? e.games : (e.score ? [e.score] : []);
    var sum = D.gamesSummary(games);
    return [U.shortDay(e.date || U.ymd()), (e.minutes ? e.minutes + '분' : ''), ((e.done || []).join('·')),
      (sum.count ? sum.count + '경기 ' + sum.wins + '승 ' + sum.losses + '패' : '')].filter(Boolean).join(' · ');
  }

  function recentRow(r) {
    var games = (r.games && r.games.length) ? r.games : (r.score ? [r.score] : []);
    var win = (r.result || (games.length === 1 ? D.resultFromScore(games[0]) : ''));
    var scoreTxt = games.length
      ? (games.length > 1 ? games.length + '경기' : games[0].a + ':' + games[0].b)
      : '';
    var tagTxt = [].concat(r.pain || [], r.weakness || []).slice(0, 2).join(' · ');
    var doneTxt = (r.done || []).slice(0, 3).join('·');
    var sub = [tagTxt, doneTxt].filter(Boolean).join(' · ');
    return '<li class="logrow" data-record="' + U.esc(r.id) + '">' +
      '<div class="logrow__date"><strong>' + U.shortDay(r.date) + '</strong><span>' + U.relDay(r.date) + '</span></div>' +
      '<div class="logrow__mid"><p class="logrow__title">' + (r.cond != null ? '컨디션 ' + r.cond : '훈련') +
      (r.minutes ? ' · ' + r.minutes + '분' : '') + '</p>' +
      (sub ? '<p class="logrow__sub">' + U.esc(sub) + '</p>' : '') +
      '</div>' +
      (scoreTxt
        ? '<div class="logrow__score"><span class="score ' + (win === '승' ? 'is-win' : win === '패' ? 'is-loss' : '') + '">' + U.esc(scoreTxt) + '</span>' +
          (win ? '<span class="score__res">' + U.esc(win) + '</span>' : '') + '</div>'
        : '') + '</li>';
  }

  var view = {
    title: '일지 & AI',
    render: function (state) {
      var d = state.drafts.log;
      var an = state.analysis;
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
        '</div></section>' +

        '<section class="card" data-form="log">' +
        '<header class="card__head"><h2>오늘 일지</h2>' +
        '<label class="datepick"><input type="date" data-field="date" value="' + U.esc(d.date) + '"></label></header>' +

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

        '<div class="field"><div class="field__label"><span>완료 훈련</span><small>여러 개 선택</small></div>' +
        UI.chips('done', D.VOCAB.done, d.done, { scroll: true }) + '</div>' +

        gamesFold(d) +

        '<div class="field"><div class="field__label"><span>아픈 부위</span><small>없으면 그대로</small></div>' +
        UI.chips('pain', D.VOCAB.pain, d.pain, { scroll: true }) + '</div>' +

        '<div class="field"><div class="field__label"><span>약점 기술</span><small>오늘 아쉬웠던 것</small></div>' +
        UI.chips('weakness', D.VOCAB.weakness, d.weakness, { scroll: true }) + '</div>' +

        '<div class="field"><div class="field__label"><span>메모</span><small>선택</small></div>' +
        '<textarea rows="2" data-field="note" placeholder="오늘 느낀 점 한 줄">' + U.esc(d.note || '') + '</textarea></div>' +

        '<div class="submit-wrap savebar">' +
        '<button class="btn btn--primary btn--big" data-act="save-log">' +
        UI.icon('check') + '<span>저장하고 AI 분석</span></button>' +
        '<p class="hint">비워 둔 항목은 저장하지 않아요</p></div>' +
        '</section>' +

        analysisCard(an, state) +

        '<section class="card" data-region="recent">' +
        '<header class="card__head"><h2>최근 기록</h2><span class="muted">' + recent.length + '건</span></header>' +
        (recent.length ? '<ul class="loglist">' + recent.map(recentRow).join('') + '</ul>'
          : UI.emptyState('log', '아직 기록이 없어요', '오늘 일지를 저장하면 여기에 쌓입니다.')) +
        '</section>';
    },

    mount: function (root, ctx) {
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
        var row = ev.target.closest('[data-record]');
        if (!row) return;
        var id = row.getAttribute('data-record');
        var rec = (ctx.store.state.data.records || []).filter(function (r) { return r.id === id; })[0];
        if (!rec) return;
        UI.openSheet({
          title: U.dayLabel(rec.date) + ' 기록',
          body: recordDetail(rec)
        });
      });
    },

    update: function (root, state) {
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
    var gameText = games.map(function (g, i) {
      return (games.length > 1 ? (i + 1) + '게임 ' : '') + (g.mode === 25 ? '25점제 ' : '') + g.a + ':' + g.b;
    }).join(' / ');
    var rows = [
      ['컨디션', rec.cond], ['훈련강도', rec.intensity], ['운동시간', rec.minutes ? rec.minutes + '분' : ''],
      ['완료훈련', (rec.done || []).join(', ')], ['게임점수', gameText || rec.scoreRaw || ''], ['결과', rec.result],
      ['아픈부위', (rec.pain || []).join(', ')], ['약점기술', (rec.weakness || []).join(', ')]
    ].filter(function (r) { return r[1] !== '' && r[1] != null; });
    var care = rec.prescription || null;
    return '<dl class="kv">' + rows.map(function (r) {
      return '<dt>' + U.esc(r[0]) + '</dt><dd>' + U.esc(r[1]) + '</dd>';
    }).join('') + '</dl>' +
      (care ? '<h3 class="sec-title">저장된 처방</h3><div class="care">' +
        (care.warmup && care.warmup.length ? '<div class="care__col"><h4>웜업</h4>' + bulletList(care.warmup) + '</div>' : '') +
        '<div class="care__col"><h4>회복</h4>' + bulletList(care.rehab) + '</div>' +
        '<div class="care__col"><h4>스트레칭</h4>' + bulletList(care.stretch) + '</div>' +
        '</div>' : '') +
      (rec.drills && rec.drills.drills ? '<h3 class="sec-title">추천드릴</h3><ul class="bullets">' +
        rec.drills.drills.map(function (d) { return '<li><b>' + U.esc(d.name) + '</b> · ' + U.esc(d.sets) + '</li>'; }).join('') + '</ul>' : '');
  }

  view.recordDetail = recordDetail;
  view.analysisCard = analysisCard;
  BM.views.log = view;
})(typeof globalThis !== 'undefined' ? globalThis : this);
