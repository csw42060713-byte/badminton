/* ============================================================
 * views/coach.js — 코치 (선수 피드백 + 멘토 신청/심사)
 *
 *  · 일반 사용자: '멘토 신청' 탭에서 조건(경력·수상·지원 사유)을 적어 신청하고,
 *    화면에는 "관리자에게 전달되었습니다 (심사중)" 상태만 보입니다.
 *    (남의 신청을 승인/거절하는 버튼은 아예 그리지 않습니다.)
 *  · 관리자(ADMIN_EMAILS): 코치 탭 상단에 "도착한 멘토 신청 N건"이 뜨고,
 *    신청자의 닉네임·급수·주력·성별·지역/클럽·경력·수상·사유·신청일시를 보고
 *    '조건 확인 후 수락' 또는 '거절'을 할 수 있습니다.
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};
  var U = BM.util, D = BM.domain;
  var UI = BM.ui;
  BM.views = BM.views || {};

  var rating = 4;
  var picked = [];

  function isAdmin(state) {
    return !!(state.data && state.data.isAdmin) || D.isAdminMe(state.me);
  }

  /* 화면이 항상 최신 신청 목록을 보도록 idx에서 직접 계산합니다.
   * (관리자는 전부, 일반 사용자는 내 신청만) */
  function mentorAppsOf(state) {
    return D.mentorApplications(state.data.idx, state.me && state.me.key, isAdmin(state));
  }

  function playersWithLogs(state) {
    var me = (state.me && state.me.key) || '';
    var map = {};
    (state.data.allRecords || []).forEach(function (r) {
      if (!r.userKey || r.userKey === me) return;
      (map[r.userKey] = map[r.userKey] || []).push(r);
    });
    return Object.keys(map).map(function (k) {
      var list = U.sortBy(map[k], function (r) { return (r.date || '') + (r.createdAt || ''); }, true);
      var mp = (state.data.matchProfiles || []).filter(function (m) { return m.userKey === k; })[0] || {};
      return {
        key: k, nick: list[0].nick || mp.nick || '선수', avatar: mp.avatar || '🏸',
        avatarPhoto: mp.avatarPhoto || '', avatarFrame: mp.avatarFrame || 'basic',
        avatarBg: mp.avatarBg || 'plain', avatarBadge: mp.avatarBadge || '',
        records: list, level: list[0].level || mp.level || '',
        last: (list[0] && list[0].date) || ''
      };
    }).sort(function (a, b) { return a.last < b.last ? 1 : -1; });   /* 최근 기록이 있는 선수부터 */
  }

  function playerBlock(p, state, canCoach) {
    var sum = BM.ai.summarize(p.records, p.level);
    var last = p.records[0] || {};
    var openRec = state.ui.coachPlayer === p.key;
    return '<article class="card card--player' + (openRec ? ' is-open' : '') + '" data-player="' + U.esc(p.key) + '">' +
      '<header class="pcard__top">' + UI.avatar(p, 46) +
      '<div class="pcard__id"><div class="pcard__name">' + U.esc(p.nick) + '<span class="pill">' + U.esc(p.level) + '</span></div>' +
      '<p class="pcard__meta">최근 30일 ' + sum.sessions + '회 · ' + sum.minutes + '분 · 승률 ' + (sum.winRate == null ? '—' : sum.winRate + '%') + '</p></div>' +
      '<button class="btn btn--ghost btn--sm" data-pick="' + U.esc(p.key) + '">' + (openRec ? '접기' : '자세히') + '</button></header>' +
      '<div class="tags">' +
      (sum.topWeakness.length ? sum.topWeakness.map(function (w) { return '<span class="tag tag--warn">약점 ' + U.esc(w) + '</span>'; }).join('') : '') +
      (sum.pain.length ? sum.pain.map(function (x) { return '<span class="tag">통증 ' + U.esc(x) + '</span>'; }).join('') : '') +
      '<span class="tag tag--soft">평균 컨디션 ' + (sum.avgCond == null ? '—' : sum.avgCond) + '</span></div>' +
      (openRec ? '<div class="player__detail">' +
        '<h4 class="sec-title">최근 기록</h4><ul class="loglist loglist--tight">' +
        p.records.slice(0, 4).map(function (r) {
          var vid = D.logMeta(r).video;
          return '<li class="logrow"><div class="logrow__date"><strong>' + U.shortDay(r.date) + '</strong><span>' + U.relDay(r.date) + '</span></div>' +
            '<div class="logrow__mid"><p class="logrow__title">컨디션 ' + (r.cond == null ? '—' : r.cond) + ' · 강도 ' + (r.intensity == null ? '—' : r.intensity) + ' · ' + (r.minutes || 0) + '분</p>' +
            '<div class="tags">' + [].concat(r.pain || [], r.weakness || []).map(function (t) { return '<span class="tag">' + U.esc(t) + '</span>'; }).join('') + '</div>' +
            /* 영상이 있으면 코치가 여기서 바로 열어 봅니다 (bm-v1.34.0) */
            (vid.url
              ? '<a class="logrow__vid" data-video href="' + U.esc(vid.url) + '" target="_blank" rel="noopener noreferrer" ' +
                'aria-label="' + U.esc((vid.label || '선수 영상') + ' 새 창에서 보기') + '">' + UI.icon('camera') +
                '<span>영상 보기 ↗</span></a>' : '') +
            '</div>' +
            '<div class="logrow__score"><span class="score ' + (r.result === '승' ? 'is-win' : r.result === '패' ? 'is-loss' : '') + '">' + U.esc(r.scoreRaw || '—') + '</span></div></li>';
        }).join('') + '</ul>' +
        '<div class="coachbox" data-coachbox="' + U.esc(p.key) + '">' +
        '<h4 class="sec-title">피드백 보내기</h4>' +
        (canCoach ?
          '<div class="stars" data-stars>' + [1, 2, 3, 4, 5].map(function (n) {
            return '<button type="button" class="star' + (n <= rating ? ' is-on' : '') + '" data-star="' + n + '">★</button>';
          }).join('') + '</div>' +
          '<div class="chips" data-drills>' + ['드라이브', '풋워크', '헤어핀', '스매시', '기초 체력'].map(function (d) {
            return '<button type="button" class="chip chip--sm" data-drill="' + U.esc(d) + '">' + U.esc(d) + '</button>';
          }).join('') + '</div>' +
          '<textarea rows="3" data-fb-text placeholder="예: 드라이브 타점이 뒤로 밀려요. 몸 앞에서 잡는 연습 3세트 해보세요." maxlength="300"></textarea>' +
          '<button class="btn btn--primary btn--big" data-act="send-fb" data-player="' + U.esc(p.key) + '">' + UI.icon('send') + '피드백 보내기</button>'
          : '<p class="approw__done">멘토 승인을 받은 코치만 피드백을 보낼 수 있어요.</p>') +
        '</div></div>' : '') +
      '</article>';
  }

  /* ---------- 멘토 신청 (일반 사용자) ---------- */
  function statusPill(status) {
    var cls = status === '승인' ? 'ok' : status === '거절' ? 'no' : 'wait';
    return '<span class="pill pill--' + cls + '">' + U.esc(status) + '</span>';
  }

  /* ============================================================
   * 멘토 구분 · 활동 소속 · 증명 (bm-v1.45.0)
   *  · '체육관 코치' · '선수 코치' 는 어디서 코치하는지와 증명이 필요합니다.
   *  · 소속은 BM.gyms(전국 체육관 120곳)에서 빠르게 골라 채우거나 직접 적고,
   *    증명은 글·링크(D.safeLinkUrl) · 사진(D.safeImageUrl) 으로 받습니다.
   * ============================================================ */
  var proofPhoto = '';         /* 지금 신청서에 붙인 증빙 사진(data:image/...) */

  /* 신청서 초안 — 체육관 목록(지도)을 다녀오거나 알림으로 화면이 다시 그려져도
   * 적던 값이 사라지지 않도록 모듈에 담아 둡니다. 신청이 끝나면 비웁니다. */
  var draft = null;

  function mentorDraft() {
    if (!draft) {
      draft = {
        type: (D.MENTOR_TYPES && D.MENTOR_TYPES[0]) || '개인 멘토',
        affiliation: '', experience: '', awards: '', reason: '', proof: '', proofUrl: ''
      };
    }
    return draft;
  }

  var MTYPE_HINT_NEED = '체육관·팀에서 코치하는 분은 <b>소속</b>과 <b>증명</b>(링크·사진 중 1개 이상)을 꼭 넣어 주세요. ' +
    '심사에서 확인되면 코치 카드에 <b>활동 증명됨</b>이 붙습니다.';
  var MTYPE_HINT_FREE = '개인 레슨·클럽 운영은 소속·증명 없이도 신청할 수 있어요. 넣어 두면 심사가 더 빨라요.';

  function currentMentorType(scope) {
    var btn = scope && scope.querySelector('[data-mtype].is-on');
    return btn ? btn.getAttribute('data-mtype') : ((D.MENTOR_TYPES && D.MENTOR_TYPES[0]) || '개인 멘토');
  }

  /* 유형 칩을 누를 때 — 안내 문구와 '필수/선택' 표시만 바꿉니다(적던 값은 그대로) */
  function paintMentorType(scope) {
    if (!scope) return;
    var need = D.mentorNeedsProof(currentMentorType(scope));
    var hint = scope.querySelector('[data-mtype-hint]');
    if (hint) hint.innerHTML = need ? MTYPE_HINT_NEED : MTYPE_HINT_FREE;
    Array.prototype.forEach.call(scope.querySelectorAll('[data-req-badge]'), function (b) {
      b.textContent = need ? '필수' : '선택';
      b.classList.toggle('pill--wait', need);
      b.classList.toggle('pill--ghost', !need);
    });
    ['[data-aff-wrap]', '[data-proof-wrap]'].forEach(function (sel) {
      var box = scope.querySelector(sel);
      if (box) box.classList.toggle('is-req', need);
    });
  }

  function typePill(type) {
    var t = D.mentorTypeOf(type);
    return '<span class="pill ' + (D.mentorNeedsProof(t) ? 'pill--grade' : 'pill--ghost') + '">' + U.esc(t) + '</span>';
  }

  /* 증명 한 줄 — 글 · 링크 · 사진(첨부 여부) */
  function proofCellHtml(a) {
    var bits = [];
    if (a.proof) bits.push(U.esc(a.proof));
    if (a.proofUrl) {
      bits.push('<a class="prooflink" href="' + U.esc(a.proofUrl) + '" target="_blank" rel="noopener noreferrer">' +
        UI.icon('doc') + '증빙 링크 ↗</a>');
    }
    if (a.proofPhoto) bits.push('<span class="pill pill--ok">사진 첨부</span>');
    return bits.length ? bits.join(' · ') : '<span class="muted">—</span>';
  }

  function proofPhotoHtml(a, cls) {
    if (!a || !a.proofPhoto) return '';
    return '<figure class="proofshot' + (cls ? ' ' + cls : '') + '">' +
      '<img src="' + U.esc(a.proofPhoto) + '" alt="첨부한 증빙 사진" loading="lazy">' +
      '<figcaption>증빙 사진 · 관리자만 볼 수 있어요</figcaption></figure>';
  }

  /* ---------- 증빙 사진 첨부 ----------
   *  · 재직증명서·자격증처럼 글자가 있는 사진이라 프로필 사진처럼 정사각형으로 자르지 않고
   *    원본 비율 그대로 줄입니다.
   *  · 시트 한 칸(50,000자)을 넘지 않도록 48,000자 아래로 맞추고,
   *    넘치면 해상도·품질을 낮춰 다시 담습니다. */
  var PROOF_PHOTO_TRY = [
    { side: 900, q: 0.72 }, { side: 760, q: 0.64 }, { side: 640, q: 0.56 }, { side: 520, q: 0.5 }
  ];

  function drawFit(img, side, quality) {
    var iw = img.width || side, ih = img.height || side;
    var scale = Math.min(side / iw, side / ih, 1);
    var w = Math.max(1, Math.round(iw * scale)), h = Math.max(1, Math.round(ih * scale));
    var canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    var c2 = canvas.getContext('2d');
    if (!c2) return '';
    c2.fillStyle = '#ffffff';
    c2.fillRect(0, 0, w, h);
    c2.drawImage(img, 0, 0, w, h);
    try { return canvas.toDataURL('image/jpeg', quality); } catch (e) { return ''; }
  }

  function readProofPhoto(file, cb, onError) {
    if (!file) return;
    if (!/^image\//.test(file.type || '')) { if (onError) onError('이미지 파일만 올릴 수 있어요'); return; }
    if (file.size > 12 * 1024 * 1024) { if (onError) onError('12MB보다 작은 사진을 골라 주세요'); return; }
    if (typeof document === 'undefined' || typeof FileReader === 'undefined') return;
    var reader = new FileReader();
    reader.onerror = function () { if (onError) onError('사진을 읽지 못했어요'); };
    reader.onload = function () {
      var img = new Image();
      img.onerror = function () { if (onError) onError('사진을 열지 못했어요'); };
      img.onload = function () {
        var limit = (D.MENTOR && D.MENTOR.photoMax) || 48000;
        var url = '';
        for (var i = 0; i < PROOF_PHOTO_TRY.length; i++) {
          url = drawFit(img, PROOF_PHOTO_TRY[i].side, PROOF_PHOTO_TRY[i].q);
          if (url && url.length <= limit) break;
        }
        if (!url || url.length > limit) {
          if (onError) onError('사진이 너무 커요. 더 작은 사진이나 화면 캡처로 올려 주세요');
          return;
        }
        cb(url);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function pickProofPhoto(cb, onError) {
    if (typeof document === 'undefined') return;
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    document.body.appendChild(input);
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      readProofPhoto(file, function (url) {
        if (input.parentNode) input.parentNode.removeChild(input);
        cb(url);
      }, function (msg) {
        if (input.parentNode) input.parentNode.removeChild(input);
        if (onError) onError(msg);
      });
    });
    input.click();
  }

  function proofPreviewHtml() {
    if (!proofPhoto) {
      return '<p class="hint">재직증명서 · 자격증 · 체육관 코치 프로필 화면 사진도 올릴 수 있어요. (관리자만 봅니다)</p>';
    }
    return '<figure class="proofshot"><img src="' + U.esc(proofPhoto) + '" alt="첨부한 증빙 사진 미리보기" loading="lazy">' +
      '<figcaption><b>증빙 사진 첨부됨</b> · 신청하면 관리자에게만 전달돼요</figcaption></figure>' +
      '<button type="button" class="linkbtn" data-act="mentor-photo-clear">사진 빼기</button>';
  }

  function paintProofPhoto(scope) {
    var box = scope && scope.querySelector('[data-proof-photo]');
    if (box) box.innerHTML = proofPreviewHtml();
  }

  /* 체육관 이름 빠른 선택 — 한 글자 칠 때마다 BM.gyms 에서 4곳까지 추천 */
  function paintAffSuggestions(scope) {
    var box = scope && scope.querySelector('[data-aff-sug]');
    if (!box) return;
    var inp = scope.querySelector('[data-mentor-field="affiliation"]');
    var list = D.gymNameSuggestions(inp ? inp.value : '', 4);
    box.innerHTML = list.map(function (g) {
      return '<button type="button" class="chip chip--sm chip--gym" data-aff-pick="' + U.esc(g.name) + '">' +
        UI.icon('pin') + U.esc(g.name) + (g.area ? '<i>' + U.esc(g.area) + '</i>' : '') + '</button>';
    }).join('');
    box.hidden = !list.length;
  }

  function myApplicationBlock(state) {
    var apps = mentorAppsOf(state);
    var mine = apps[0] || null;
    var pending = mine && mine.status === '심사중';
    var approved = mine && mine.status === '승인';

    var statusCard = mine ? '<section class="card card--mentor">' +
      '<header class="card__head"><h2>' + UI.icon('coach') + '내 멘토 신청</h2>' + statusPill(mine.status) + '</header>' +
      (pending
        ? '<div class="pp__note">' + UI.icon('clock') + '<span><b>관리자에게 멘토 신청이 전달되었습니다.</b><br>조건을 확인한 뒤 수락 여부를 알려 줍니다 (심사중).</span></div>'
        : approved
          ? '<div class="pp__note pp__note--ok">' + UI.icon('check') + '<span>멘토로 승인되었습니다. 선수 피드백을 남길 수 있어요.' +
            (mine.affiliation || mine.proofed
              ? '<br><b>' + U.esc(D.mentorAffiliationLine(mine) || mine.affiliation) + '</b>'
              : '') + '</span></div>'
          : '<div class="pp__note">' + UI.icon('alert') + '이번 신청은 거절되었습니다. 조건을 보완해 다시 신청할 수 있어요.</div>') +
      '<dl class="kv kv--tight">' +
      '<dt>신청일</dt><dd>' + U.esc(mine.submitted ? U.dayLabel(String(mine.submitted).slice(0, 10)) : '—') + '</dd>' +
      '<dt>활동 유형</dt><dd>' + typePill(mine.mentorType) + '</dd>' +
      '<dt>활동 소속</dt><dd>' + U.esc(mine.affiliation || '—') + '</dd>' +
      '<dt>증명</dt><dd>' + proofCellHtml(mine) + '</dd>' +
      '<dt>경력</dt><dd>' + U.esc(mine.experience || '—') + '</dd>' +
      '<dt>수상</dt><dd>' + U.esc(mine.awards || '—') + '</dd>' +
      '<dt>지원 사유</dt><dd>' + U.esc(mine.reason || '—') + '</dd>' +
      '</dl>' + proofPhotoHtml(mine) + '</section>' : '';

    /* 화면이 다시 그려져도 적던 값이 남도록 초안(draft)에서 그립니다 */
    var d = mentorDraft();
    var need = D.mentorNeedsProof(d.type);
    var reqBadge = 'pill ' + (need ? 'pill--wait' : 'pill--ghost') + '" data-req-badge>' + (need ? '필수' : '선택') + '<';

    var form = (!mine || mine.status === '거절') ? '<section class="card" data-mentor-form>' +
      '<header class="card__head"><h2>멘토 신청</h2><span class="muted sm">관리자 심사</span></header>' +
      '<p class="sectionnote">코치·멘토로 활동하려면 아래 조건을 적어 신청해 주세요. <b>관리자에게만 전달</b>되고, 다른 회원에게는 보이지 않습니다.</p>' +
      '<div class="form">' +
      '<div class="flabel"><span>활동 유형</span>' +
      '<div class="chips" data-mentor-type>' +
      D.MENTOR_TYPES.map(function (t) {
        return '<button type="button" class="chip' + (t === d.type ? ' is-on' : '') + '" data-mtype="' + U.esc(t) + '">' + U.esc(t) + '</button>';
      }).join('') + '</div>' +
      '<p class="hint" data-mtype-hint>' + (need ? MTYPE_HINT_NEED : MTYPE_HINT_FREE) + '</p></div>' +

      /* 활동 소속 — 체육관 코치·선수 코치는 필수, 개인 멘토·클럽 운영은 선택 */
      '<div class="flabel flabel--aff' + (need ? ' is-req' : '') + '" data-aff-wrap><span>어디서 코치하나요? (소속 체육관 · 팀) ' +
      '<i class="' + reqBadge + '</i></span>' +
      '<input type="text" data-mentor-field="affiliation" maxlength="40" autocomplete="off" ' +
      'placeholder="예: 나래울 배드민턴장, 매원고 배드민턴부" value="' + U.esc(d.affiliation) + '">' +
      '<div class="chips chips--sug" data-aff-sug hidden></div>' +
      '<button type="button" class="linkbtn" data-act="mentor-gym">' + UI.icon('pin') + '체육관 목록에서 고르기</button>' +
      '<p class="hint">이름을 치면 전국 체육관 120곳에서 찾아 드려요. 목록에 없는 팀·클럽은 그냥 적어 주세요.</p></div>' +

      /* 증명 — 글·링크·사진 중 하나 이상 */
      '<div class="flabel flabel--proof' + (need ? ' is-req' : '') + '" data-proof-wrap><span>소속 증명 ' +
      '<i class="' + reqBadge + '</i></span>' +
      '<p class="hint">재직·위촉 확인 번호, 체육관 공지·시간표 링크, 재직증명서·자격증 사진 중 <b>하나 이상</b>.</p>' +
      '<input type="text" data-mentor-field="proofUrl" maxlength="300" autocomplete="off" inputmode="url" ' +
      'placeholder="증빙 링크 (https://…)" value="' + U.esc(d.proofUrl) + '">' +
      '<input type="text" data-mentor-field="proof" maxlength="60" autocomplete="off" ' +
      'placeholder="증빙 메모 (예: 위촉 2026-03 · 확인 010-0000-0000)" value="' + U.esc(d.proof) + '">' +
      '<div class="proofbox" data-proof-photo>' + proofPreviewHtml() + '</div>' +
      '<button type="button" class="btn btn--ghost btn--sm" data-act="mentor-photo">' + UI.icon('camera') +
      (proofPhoto ? '사진 바꾸기' : '증빙 사진 첨부') + '</button></div>' +

      '<label class="flabel">경력<input type="text" data-mentor-field="experience" maxlength="40" placeholder="예: 5년, A조 리그 3회 출전" value="' + U.esc(d.experience) + '"></label>' +
      '<label class="flabel">수상·자격<input type="text" data-mentor-field="awards" maxlength="60" placeholder="예: 시·군 대회 복식 3위, 생활체육지도자 2급" value="' + U.esc(d.awards) + '"></label>' +
      '<label class="flabel">지원 사유<textarea rows="3" data-mentor-field="reason" maxlength="300" placeholder="어떤 도움을 줄 수 있는지 적어 주세요">' + U.esc(d.reason) + '</textarea></label>' +
      '</div>' +
      '<button class="btn btn--primary btn--big mt16" data-act="apply-mentor">' + UI.icon('send') + '멘토 신청 보내기</button>' +
      '<p class="hint">보내면 관리자 계정으로 전달되고, 수락 여부는 여기에서 확인할 수 있어요.</p>' +
      '</section>' : '';

    return statusCard + form;
  }

  /* ---------- 멘토 심사 (관리자) ---------- */
  function applicantAvatar(state, a) {
    return UI.avatar(UI.person(state, a.userKey), 46);
  }

  function mentorCard(a, state) {
    var cls = a.status === '승인' ? 'is-ok' : a.status === '거절' ? 'is-no' : 'is-wait';
    var pending = a.status === '심사중';
    return '<li class="approw approw--mentor ' + cls + '" data-mentor="' + U.esc(a.id) + '">' +
      '<div class="approw__top">' + applicantAvatar(state, a) +
      '<div class="approw__who"><strong>' + U.esc(a.nick || '신청자') + '</strong>' +
      '<div class="pp__pills">' + statusPill(a.status) + typePill(a.mentorType) +
      (a.level ? '<span class="pill pill--grade">' + U.esc(a.level) + '</span>' : '') +
      (a.discipline ? '<span class="pill pill--ghost">' + U.esc(a.discipline) + '</span>' : '') +
      (a.gender && a.gender !== '비공개' ? '<span class="pill pill--gender">' + U.esc(a.gender) + '</span>' : '') +
      '</div></div></div>' +
      '<dl class="kv kv--tight">' +
      '<dt>활동 소속</dt><dd>' + U.esc(a.affiliation || '—') + '</dd>' +
      '<dt>증명</dt><dd>' + proofCellHtml(a) + '</dd>' +
      '</dl>' + proofPhotoHtml(a, 'proofshot--card') +
      '<dl class="kv kv--tight">' +
      '<dt>지역·클럽</dt><dd>' + U.esc([a.region, a.club].filter(Boolean).join(' · ') || '—') + '</dd>' +
      '<dt>경력</dt><dd>' + U.esc(a.experience || '—') + '</dd>' +
      '<dt>수상·자격</dt><dd>' + U.esc(a.awards || '—') + '</dd>' +
      '<dt>지원 사유</dt><dd>' + U.esc(a.reason || '—') + '</dd>' +
      '<dt>신청일시</dt><dd>' + U.esc(a.submitted || a.createdAt || '—') + '</dd>' +
      '</dl>' +
      '<div class="approw__act">' +
      '<button class="linkbtn" data-mentor-open="' + U.esc(a.id) + '">조건 자세히 보기</button>' +
      (pending
        ? '<div class="row gap8 mt8">' +
          '<button class="btn btn--ghost grow" data-mentor-reject="' + U.esc(a.id) + '">거절</button>' +
          '<button class="btn btn--primary grow" data-mentor-accept="' + U.esc(a.id) + '">조건 확인 후 수락</button></div>'
        : '<p class="approw__done">' + U.esc(a.payload && a.payload.decidedBy ? a.payload.decidedBy + ' 님이 처리' : '처리 완료') +
          (a.payload && a.payload.decided ? ' · ' + U.esc(a.payload.decided) : '') + '</p>') +
      '</div></li>';
  }

  function mentorAdminBlock(state) {
    var apps = mentorAppsOf(state);
    var pending = apps.filter(function (a) { return a.status === '심사중'; });
    var done = apps.filter(function (a) { return a.status !== '심사중'; });
    return '<section class="card">' +
      '<header class="card__head"><h2>멘토 신청 심사</h2>' +
      '<span class="badge">' + pending.length + ' 대기</span></header>' +
      '<p class="sectionnote">신청자의 조건을 확인하고 <b>수락</b> 또는 <b>거절</b>을 정해 주세요. 심사는 관리자 계정에서만 보입니다.</p>' +
      (apps.length
        ? '<ul class="applist">' + pending.concat(done).map(function (a) { return mentorCard(a, state); }).join('') + '</ul>'
        : UI.emptyState('coach', '도착한 멘토 신청이 없어요', '회원이 멘토를 신청하면 여기로 옵니다.')) +
      '</section>';
  }

  /* 관리자 상단 배너 */
  function mentorBanner(state) {
    if (!isAdmin(state)) return '';
    var pending = mentorAppsOf(state).filter(function (a) { return a.status === '심사중'; });
    if (!pending.length) return '';
    return '<section class="card card--banner" data-act="open-mentor">' +
      '<div class="row between">' +
      '<div><p class="banner__t">도착한 멘토 신청 <b>' + pending.length + '건</b></p>' +
      '<p class="banner__s">조건을 보고 수락 여부를 정해 주세요.</p></div>' +
      '<button class="btn btn--primary btn--sm" data-act="open-mentor">심사하기</button>' +
      '</div></section>';
  }

  /* 수락/거절 — 확인 한 번을 거쳐 처리합니다.
   * 카드 버튼과 '조건 자세히 보기' 시트 버튼이 같이 씁니다(시트는 화면 밖 DOM이라
   * 화면 위임만으로는 눌리지 않아 시트가 직접 부릅니다). */
  function decideMentorAsk(appId, status, ctx) {
    var accepted = status === '승인';
    UI.confirm(accepted ? '이 신청의 조건을 확인했고, 멘토로 수락할까요?' : '이 멘토 신청을 거절할까요?',
      accepted ? '수락' : '거절').then(function (yes) {
      if (!yes) return;
      var r = ctx.actions.decideMentor(appId, status);
      UI.closeSheet();
      if (r.ok) { UI.toast('멘토 신청을 ' + (accepted ? '수락' : '거절') + '했어요.'); UI.haptic(12); }
      else if (r.reason === 'forbidden') UI.toast('관리자 계정에서만 심사할 수 있어요', 'error');
      else if (r.reason === 'done') UI.toast('이미 처리된 신청이에요');
      else UI.toast('처리하지 못했어요', 'error');
    });
  }

  function openMentorSheet(appId, ctx) {
    var state = ctx.store.state;
    var a = mentorAppsOf(state).filter(function (x) { return String(x.id) === String(appId); })[0];
    if (!a) return;
    UI.openSheet({
      title: '멘토 신청 조건',
      body: '<div class="pp">' +
        '<div class="pp__head">' + applicantAvatar(state, a) +
        '<div class="pp__id"><div class="pp__name">' + U.esc(a.nick) + '</div>' +
        '<div class="pp__pills">' + statusPill(a.status) + typePill(a.mentorType) +
        (a.level ? '<span class="pill pill--grade">' + U.esc(a.level) + '</span>' : '') +
        (a.discipline ? '<span class="pill pill--ghost">' + U.esc(a.discipline) + '</span>' : '') +
        '</div></div></div>' +
        '<dl class="kv kv--tight">' +
        '<dt>활동 유형</dt><dd>' + typePill(a.mentorType) + '</dd>' +
        '<dt>활동 소속</dt><dd>' + U.esc(a.affiliation || '—') + '</dd>' +
        '<dt>증명</dt><dd>' + proofCellHtml(a) + '</dd>' +
        '<dt>성별</dt><dd>' + U.esc(a.gender || '비공개') + '</dd>' +
        '<dt>지역</dt><dd>' + U.esc(a.region || '—') + '</dd>' +
        '<dt>클럽</dt><dd>' + U.esc(a.club || '—') + '</dd>' +
        '<dt>경력</dt><dd>' + U.esc(a.experience || '—') + '</dd>' +
        '<dt>수상·자격</dt><dd>' + U.esc(a.awards || '—') + '</dd>' +
        '<dt>지원 사유</dt><dd>' + U.esc(a.reason || '—') + '</dd>' +
        '<dt>신청일시</dt><dd>' + U.esc(a.submitted || a.createdAt || '—') + '</dd>' +
        '</dl>' +
        proofPhotoHtml(a, 'proofshot--big') +
        (a.bio ? '<p class="pp__bio">' + U.esc(a.bio) + '</p>' : '') +
        (a.status === '심사중'
          ? '<div class="row gap8 mt16">' +
            '<button class="btn btn--ghost grow" data-sheet-decide="거절">거절</button>' +
            '<button class="btn btn--primary grow" data-sheet-decide="승인">조건 확인 후 수락</button></div>'
          : '<p class="approw__done">' + U.esc(a.status) + ' 처리됨</p>') +
        '</div>',
      onMount: function (node) {
        node.addEventListener('click', function (ev) {
          var btn = ev.target.closest('[data-sheet-decide]');
          if (!btn) return;
          ev.preventDefault();
          decideMentorAsk(a.id, btn.getAttribute('data-sheet-decide'), ctx);
        });
      }
    });
  }

  /* ---------- 선수 화면: 코치 찾기 · 피드백 받기 ----------
   * 승인된 코치(멘토) 목록을 보여 줍니다. 코치가 없으면 멘토 신청을 권합니다. */
  function coachesOf(state) {
    var me = (state.me && state.me.key) || '';
    var idx = state.data.idx || { byType: {} };
    var seen = {}, out = [];
    ['멘토신청', '코치신청'].forEach(function (type) {
      (idx.byType[type] || []).forEach(function (a) {
        var status = a.status || (a.payload && a.payload.status) || '심사중';
        if (status !== '승인' || !a.userKey || a.userKey === me || seen[a.userKey]) return;
        seen[a.userKey] = 1;
        var p = D.profileOf(idx, a.userKey) || {};
        var mp = D.matchProfileOf(idx, a.userKey) || {};
        var pl = a.payload || {};
        var badge = D.mentorBadgeOf(pl);
        out.push({
          key: a.userKey,
          nick: p.nick || a.nick || '코치',
          level: pl.level || p.level || mp.level || '',
          discipline: pl.discipline || mp.discipline || p.discipline || '',
          region: pl.region || mp.region || '',
          club: pl.club || mp.club || '',
          /* v1.45 — 구분 배지 · 활동 소속(증명됨) */
          mentorType: badge.type,
          affiliation: badge.affiliation,
          proofed: badge.proofed
        });
      });
    });
    return out;
  }

  /* 한 곳의 이름을 등록 체육관(120곳)과 이어 봅니다 (bm-v1.52.2)
   *  · '매원고 배드민턴부'처럼 뒤에 팀·부서 이름이 붙으면 앞부분(체육관 이름)으로 한 번 더 찾습니다.
   *  · 찾지 못하면 null — 부르는 쪽이 글자 그대로 보여 줍니다. */
  function venueFor(name) {
    var G = BM.gyms;
    var s = String(name == null ? '' : name).trim();
    if (!G || !s || typeof G.matchVenue !== 'function') return null;
    var v = G.matchVenue(s);
    if (!v) {
      var core = s.replace(/\s*(배드민턴부|배드민턴클럽|배드민턴|클럽|팀|동호회|체육부|부)$/, '').trim();
      if (core && core !== s) v = G.matchVenue(core);
    }
    return v || null;
  }

  /* 활동 소속을 등록 체육관(120곳)과 이어 봅니다 (bm-v1.47.0)
   *  · '나래울 배드민턴장 · 매원고 배드민턴부' 처럼 여러 곳을 적었으면 '·'로 나눠 각각 찾습니다.
   *  · 등록되지 않은 곳(학교팀·클럽 이름 등)은 그대로 두고, 찾은 곳만 지도로 이어 줍니다. */
  function affVenues(affiliation) {
    if (!affiliation) return [];
    var out = [], seen = {};
    String(affiliation).split(/[\u00b7,\/|]/).forEach(function (raw) {
      var v = venueFor(raw);
      if (!v || seen[v.id]) return;
      seen[v.id] = 1;
      out.push(v);
    });
    return out;
  }

  /* 체육관 한 곳 → MY·매칭과 같은 모양의 지도 칩 ([pin] 이름 [지역])
   *  · opts.area === false 이면 지역 풀을 빼고 이름만 (프로필 줄처럼 지역을 바로 앞에 쓸 때) */
  function gymChip(v, label, opts) {
    var withArea = !(opts && opts.area === false);
    return '<button type="button" class="gymlink" data-gym-open="' + U.esc(v.id) + '"' +
      ' aria-label="' + U.esc(v.name + (v.area ? ' ' + v.area : '') + ' · 체육관 지도 열기') + '">' +
      UI.icon('pin') + '<span>' + U.esc(label || v.name) + '</span>' +
      (withArea ? '<i>' + U.esc(v.area || '지도') + '</i>' : '') + '</button>';
  }

  /* 활동 소속 줄 (bm-v1.52.2 — 조환비 님 피드백 '코치 소속 체육관도 눌러서 지도 열기')
   *  · 코치가 적은 소속 이름을 그대로 두되, 등록 체육관과 이어지면 그 이름 자체가
   *    MY·매칭처럼 눌러서 그 체육관 지도를 여는 칩이 됩니다.
   *  · 이어지지 않는 팀·클럽 이름은 글자로만 보여 줍니다(없던 곳을 지어내지 않음). */
  function affRow(affiliation) {
    var parts = String(affiliation == null ? '' : affiliation).split(/[\u00b7,\/|]/)
      .map(function (raw) { return String(raw == null ? '' : raw).trim(); })
      .filter(Boolean);
    if (!parts.length) return '';
    var seen = {};
    return '<p class="coachcard__gyms">' + parts.map(function (name) {
      var v = venueFor(name);
      if (!v) return '<span class="coachcard__gymname">' + U.esc(name) + '</span>';
      if (seen[v.id]) return '<span class="coachcard__gymname">' + U.esc(name) + '</span>';
      seen[v.id] = 1;
      return gymChip(v, name);
    }).join('') + '</p>';
  }

  /* 예전 이름(테스트·점검용) — 등록 체육관과 이어진 소속만 칩으로. 하나도 없으면 빈 문자열. */
  function affMapRow(affiliation) {
    var venues = affVenues(affiliation);
    if (!venues.length) return '';
    return '<p class="coachcard__gyms">' + venues.map(function (v) { return gymChip(v, v.name); }).join('') + '</p>';
  }

  function normName(s) { return String(s == null ? '' : s).replace(/\s+/g, '').toLowerCase(); }

  /* 프로필의 클럽 이름이 그 체육관 이름과 실제로 겹칠 때만 지도 칩으로 (프로필의 지역·클럽 줄)
   *  · '나래울' → '나래울 배드민턴장' 은 잇고, 동네 이름만 같은 다른 체육관은 글자로 둡니다. */
  function gymLinkOrText(name) {
    var s = String(name == null ? '' : name).trim();
    if (!s) return '';
    var v = venueFor(s);
    if (v) {
      var n = normName(s), vn = normName(v.name);
      var core = vn.replace(/(배드민턴장|배드민턴클럽|배드민턴센터|배드민턴|체육관|체육센터|스포츠센터)$/, '');
      var hit = vn.indexOf(n) >= 0 || (core.length >= 2 && core.indexOf(n) >= 0) || (core.length >= 2 && n.indexOf(core) >= 0);
      if (!hit) v = null;
    }
    return v ? gymChip(v, s, { area: false }) : U.esc(s);
  }

  /* 코치 카드 — 누르면 바로 피드백 요청(DM 미리 채움) 또는 1:1 채팅으로 이어집니다 */
  function coachCard(c, state) {
    var key = U.esc(c.key);
    /* 프로필의 지역·클럽 줄 — 클럽이 등록 체육관이면 '경기 나래울'에서 이름을 눌러 지도 (bm-v1.52.2) */
    var place = [];
    if (c.region) place.push(U.esc(c.region));
    if (c.club) place.push(gymLinkOrText(c.club));
    var metaBits = [];
    if (c.level) metaBits.push(U.esc(c.level));
    if (c.discipline) metaBits.push(U.esc(c.discipline));
    if (place.length) metaBits.push(place.join(' '));
    var meta = metaBits.join(' · ');
    var p = UI.person(state, c.key);
    /* 친구·매칭 방이 이미 있으면 그 방을, 없으면 코치 방을 씁니다 */
    var thread = (state.data.threads || []).filter(function (t) { return t.other === c.key; })[0];
    var canChat = D.canChatWith(state.data.idx, state.me && state.me.key, c.key);
    return '<li class="coachcard" data-coach="' + key + '">' +
      '<div class="coachcard__top">' + UI.avatar(p, 42) +
      '<div class="coachcard__id"><strong>' + U.esc(c.nick) +
      (thread && thread.unread ? ' <i class="badge">' + thread.unread + '</i>' : '') + '</strong>' +
      '<p class="coachcard__type">' + typePill(c.mentorType) +
      (c.proofed ? '<span class="coachcard__aff">' + UI.icon('shield') + '활동 증명됨</span>' : '') + '</p>' +
      affRow(c.affiliation) +
      (meta ? '<p class="coachcard__meta">' + meta + '</p>' : '') + '</div></div>' +
      '<div class="coachcard__act">' +
      '<button type="button" class="btn btn--primary btn--sm" data-coach-ask="' + key + '">' + UI.icon('spark') + '피드백 요청</button>' +
      (canChat
        ? '<button type="button" class="btn btn--ghost btn--sm" data-coach-chat="' + key + '">' + UI.icon('community') + '1:1 채팅' +
          (thread && thread.unread ? ' <i class="badge">' + thread.unread + '</i>' : '') + '</button>'
        : '<span class="coachcard__note">채팅은 승인된 코치와만 열립니다</span>') +
      '</div></li>';
  }

  function playerCoachView(state) {
    var coaches = coachesOf(state);
    return '<section class="card card--coach">' +
      '<header class="card__head"><h2>' + UI.icon('coach') + '코치에게 피드백 받기</h2>' +
      (coaches.length ? '<span class="muted sm">코치 ' + coaches.length + '명</span>' : '') + '</header>' +
      '<p class="coachintro">일지를 남기면 코치가 한 줄 피드백과 추천 드릴을 붙여 줍니다.</p>' +
      '<p class="coachflow">일지 남기기 <i>→</i> 코치 확인 <i>→</i> 피드백</p>' +
      '<button class="btn btn--primary btn--big mt16" data-act="go-log">' + UI.icon('log') + '오늘 일지 남기기</button>' +
      (coaches.length
        ? '<ul class="coachcards mt16">' + coaches.slice(0, 6).map(function (c) { return coachCard(c, state); }).join('') + '</ul>'
        : '<p class="hint">아직 활동 중인 코치가 없어요. <b>멘토 신청</b>에서 내가 먼저 신청할 수 있어요.</p>') +
      '</section>';
  }

  /* 피드백 요청 문구 — 내 최근 일지 핵심을 한 줄로 붙여 코치가 바로 알게 합니다.
   * 날짜 · 점수/승패 · 약점 기술 · 아픈 부위 (최근 일지가 없으면 예전 문구 그대로)
   * bm-v1.34.0 — 최근 일지의 영상 링크·체크 포인트도 뒤에 붙입니다(opts.video === false로 뺌). */
  function videoAskLine(rec) {
    var v = rec ? D.logMeta(rec).video : { url: '', label: '' };
    if (!v.url) return '';
    return ' 영상 ' + v.url + (v.label ? ' · 체크 포인트: ' + v.label : '');
  }

  function feedbackAskText(state, opts) {
    opts = opts || {};
    var r = (state.data.records || [])[0];
    if (!r) return '코치님, 일지 피드백 부탁드려요. 이번 주 훈련에서 먼저 볼 점을 알려 주세요.';
    var bits = [];
    var games = (r.games && r.games.length) ? r.games : (r.score ? [r.score] : []);
    var sum = D.gamesSummary(games);
    if (sum.count) {
      bits.push(sum.count > 1
        ? sum.count + '경기 ' + sum.wins + '승 ' + sum.losses + '패' + (sum.draws ? ' ' + sum.draws + '무' : '')
        : (r.scoreRaw || (games[0].a + ':' + games[0].b)) + (sum.result ? ' ' + sum.result : ''));
    } else if (r.result) {
      bits.push(r.result);
    }
    if (r.weakness && r.weakness.length) bits.push('약점 ' + r.weakness.slice(0, 2).join('·'));
    if (r.pain && r.pain.length) bits.push('아픈 곳 ' + r.pain.slice(0, 2).join('·'));
    var text = '코치님, ' + U.shortDay(r.date) + ' 일지' + (bits.length ? '(' + bits.join(' · ') + ')' : '') +
      ' 보고 한 줄 피드백 부탁드려요.';
    if (opts.video !== false) text += videoAskLine(r);
    return text;
  }

  /* 코치와 대화를 열며 요청 문구를 입력칸에 채웁니다(보내기는 사람이) */
  function sendAsk(coachKey, text, ctx) {
    var r = ctx.actions.openCoachChat(coachKey, text);
    if (r && r.ok) { UI.toast('메시지를 고친 뒤 보내 주세요'); UI.haptic(10); }
    else UI.toast('대화를 열지 못했어요', 'error');
    return r;
  }

  /* 피드백 요청 — 최근 일지에 영상이 있으면 함께 보낼지 한 번만 묻습니다 (bm-v1.34.0)
   *  · 영상이 없으면 예전처럼 바로 대화를 열어 문구만 채웁니다(단계를 늘리지 않음).
   *  · 체크를 풀면 영상·체크 포인트 없이 일지 요약만 갑니다.
   *  · 코치는 채팅에서 영상 주소를 바로 누를 수 있습니다(D.linkify). */
  function askFeedback(coachKey, ctx) {
    var state = ctx.store.state;
    var rec = (state.data.records || [])[0];
    var video = rec ? D.logMeta(rec).video : { url: '', label: '' };
    if (!video.url) { sendAsk(coachKey, feedbackAskText(state), ctx); return; }

    var withVideo = feedbackAskText(state);
    var plain = feedbackAskText(state, { video: false });
    UI.openSheet({
      title: '피드백 요청',
      body: '<div class="fbask">' +
        '<p class="fbask__t">' + UI.icon('camera') + '최근 일지에 영상이 있어요. 함께 보낼까요?</p>' +
        '<div class="vidbox">' +
          '<p class="vidbox__head">' + UI.icon('camera') + '영상 체크</p>' +
          (video.label ? '<p class="vidbox__label">' + U.esc(video.label) + '</p>' : '') +
          '<p class="vidbox__url">' + U.esc(video.url) + '</p>' +
        '</div>' +
        '<label class="fbask__toggle"><input type="checkbox" data-video-include checked>' +
          '<span>영상 링크' + (video.label ? ' · 체크 포인트' : '') + ' 함께 보내기</span></label>' +
        '<p class="fbask__lab">보낼 메시지</p>' +
        '<p class="fbask__msg" data-ask-preview>' + U.esc(withVideo) + '</p>' +
        '<div class="row gap8 mt16">' +
          '<button type="button" class="btn btn--ghost grow" data-close>취소</button>' +
          '<button type="button" class="btn btn--primary grow" data-act="ask-send">대화 열기</button>' +
        '</div></div>',
      onMount: function (node) {
        var box = node.querySelector('[data-video-include]');
        var pv = node.querySelector('[data-ask-preview]');
        if (box && pv) {
          box.addEventListener('change', function () { pv.textContent = box.checked ? withVideo : plain; });
        }
        node.addEventListener('click', function (ev) {
          if (!ev.target.closest('[data-act="ask-send"]')) return;
          ev.preventDefault();
          var text = (box && !box.checked) ? plain : withVideo;
          UI.closeSheet();
          sendAsk(coachKey, text, ctx);
        });
      }
    });
  }

  /* ---------- 코치·지도자 입구 (2026-11-23 저녁 사용성 점검) ----------
   *  전에는 코치 탭 맨 위 탭 줄에 '코치 찾기 · 피드백'과 '멘토 신청'이 나란히 있어,
   *  코치를 찾으러 온 동호인·초보도 첫 줄에서 멘토 신청을 먼저 보았습니다.
   *  이제 '내 유형'(MY)이 동호인·초보·미선택이면 위 탭은 코치 찾기 하나만 두고,
   *  멘토 신청은 목록 맨 아래 보조 줄로 내립니다. 선수·코치 유형은 위 탭 그대로입니다. */
  function mentorEntryHtml(mine) {
    var st = mine && mine.status;
    return '<section class="coachmentor" data-coachmentor>' +
      '<span class="coachmentor__ic" aria-hidden="true">' + UI.icon('coach') + '</span>' +
      '<div class="coachmentor__t"><b>코치·지도자이신가요?' +
      (st ? ' <span class="coachmentor__st">' + statusPill(st) + '</span>' : '') + '</b>' +
      '<p>' + (st === '승인'
        ? '멘토로 승인되었어요. 신청 내용은 여기에서 다시 볼 수 있어요.'
        : st === '심사중'
          ? '신청이 관리자에게 전달되었어요. 진행 상황은 여기에서 확인해요.'
          : '소속과 경력을 인증하면 코치로 선수 일지를 보고 피드백을 남길 수 있어요.') + '</p></div>' +
      '<button type="button" class="btn btn--ghost btn--sm coachmentor__b" data-coachtab="apply">' +
        (st ? '내 멘토 신청' : '멘토 신청') + '</button>' +
      '</section>';
  }

  /* 보조 줄에서 들어온 멘토 신청 화면 — 위 탭이 없으니 돌아가는 길을 함께 둡니다 */
  function mentorBackHtml() {
    return '<button type="button" class="linkbtn coachback" data-coachtab="feedback">' +
      '← 코치 찾기로 돌아가기</button>';
  }

  var view = {
    title: '코치',
    render: function (state) {
      var admin = isAdmin(state);
      var canCoach = admin || D.isCoach(state.data.idx, state.me && state.me.key);
      /* 기본 화면은 선수(코치 찾기·피드백)입니다. 멘토 신청은 두 번째 탭으로 옮겼습니다. */
      var tab = state.ui.coachTab || 'feedback';
      if (!admin && tab === 'approve') tab = 'feedback';
      if (admin && tab === 'apply') tab = 'approve';
      /* 내 유형(MY) — 선수·코치일 때만 멘토 신청을 위 탭으로 강조합니다 */
      var role = D.roleOf(state.me || {});
      var mentorTop = admin || role === 'player' || role === 'coach';
      var mineApp = mentorAppsOf(state)[0] || null;
      var players = playersWithLogs(state);
      var myFeedback = (state.data.feedback || []).filter(function (f) {
        return state.me && f.target === state.me.key;
      });
      var sent = (state.data.feedback || []).filter(function (f) {
        return state.me && f.userKey === state.me.key;
      });
      var pendingCount = mentorAppsOf(state).filter(function (a) { return a.status === '심사중'; }).length;

      var feedbackHtml = '' +
        (myFeedback.length ? '<section class="card card--fb"><header class="card__head"><h2>' + UI.icon('spark') + '내가 받은 피드백</h2></header>' +
          myFeedback.slice(0, 3).map(function (f) {
            var pl = f.payload || {};
            return '<div class="fb"><div class="fb__top"><strong>' + U.esc(pl.coach || f.nick) + '</strong>' +
              '<span class="stars stars--sm">' + UI.stars(pl.rating || 0) + '</span></div>' +
              '<p>' + U.esc(pl.feedback || '') + '</p>' +
              '<div class="tags">' + (pl.drills || []).map(function (d) { return '<span class="tag">' + U.esc(d) + '</span>'; }).join('') + '</div></div>';
          }).join('') + '</section>' : '') +
        (canCoach
          ? '<p class="sectionnote">코치는 선수 기록을 보고 한 줄 피드백과 추천 드릴을 남길 수 있어요. 내 기록은 <b>일지 & AI</b>에서 확인합니다.</p>' +
            (players.length ? players.map(function (p) { return playerBlock(p, state, canCoach); }).join('')
              : '<section class="card">' + UI.emptyState('coach', '선수 기록이 아직 없어요', '다른 회원이 일지를 저장하면 여기에 나타납니다.') + '</section>') +
            (sent.length ? '<section class="card"><header class="card__head"><h2>내가 보낸 피드백</h2><span class="muted sm">' + sent.length + '건</span></header>' +
              '<ul class="bullets">' + sent.slice(0, 5).map(function (f) {
                var pl = f.payload || {};
                return '<li><b>' + U.esc(f.nick ? '보낸 피드백' : '피드백') + '</b> · ' + U.esc(U.truncate(pl.feedback || '', 40)) + '</li>';
              }).join('') + '</ul></section>' : '')
          : playerCoachView(state) +
            (myFeedback.length ? '' : '<section class="card">' +
              UI.emptyState('spark', '받은 피드백이 아직 없어요', '일지를 남기면 코치가 여기에 한 줄 남겨요.') + '</section>'));

      return '' +
        mentorBanner(state) +
        (mentorTop
          ? '<div class="seg seg--wide" data-coachtabs>' +
            '<button class="seg__btn' + (tab === 'feedback' ? ' is-on' : '') + '" data-coachtab="feedback">' +
              (canCoach ? '선수 피드백' : '코치 찾기 · 피드백') + '</button>' +
            (admin
              ? '<button class="seg__btn' + (tab === 'approve' ? ' is-on' : '') + '" data-coachtab="approve">멘토 심사' +
                (pendingCount ? ' <i class="badge">' + pendingCount + '</i>' : '') + '</button>'
              : '<button class="seg__btn' + (tab === 'apply' ? ' is-on' : '') + '" data-coachtab="apply">멘토 신청</button>') +
            '</div>'
          /* 동호인·초보는 탭 대신 이 화면 이름만 한 줄로 (멘토 신청은 맨 아래 보조 줄) */
          : '<p class="coachline" data-coachtabs>' + (canCoach ? '선수 피드백' : '코치 찾기 · 피드백') + '</p>') +
        (tab === 'feedback'
          ? feedbackHtml + (mentorTop ? '' : mentorEntryHtml(mineApp))
          : (admin ? mentorAdminBlock(state) : (mentorTop ? '' : mentorBackHtml()) + myApplicationBlock(state)));
    },

    mount: function (root, ctx) {
      root.addEventListener('click', function (ev) {
        var t = ev.target.closest('[data-coachtab]');
        if (t) { ev.preventDefault(); ctx.actions.setCoachTab(t.getAttribute('data-coachtab')); return; }

        if (ev.target.closest('[data-act="go-log"]')) {
          ev.preventDefault();
          ctx.actions.setTab('log');
          UI.haptic(6);
          return;
        }

        /* 코치에게 피드백 요청 — 최근 일지 영상도 함께 보낼지 고르고 DM 문구를 채웁니다 */
        var ask = ev.target.closest('[data-coach-ask]');
        if (ask) {
          ev.preventDefault();
          askFeedback(ask.getAttribute('data-coach-ask'), ctx);
          return;
        }
        var cchat = ev.target.closest('[data-coach-chat]');
        if (cchat) {
          ev.preventDefault();
          var chatKey = cchat.getAttribute('data-coach-chat');
          var r2 = ctx.actions.openCoachChat(chatKey, '');
          if (r2.ok) UI.haptic(8);
          else UI.toast('대화를 열지 못했어요', 'error');
          return;
        }

        if (ev.target.closest('[data-act="open-mentor"]')) {
          ev.preventDefault();
          ctx.actions.setCoachTab('approve');
          UI.haptic(6);
          return;
        }

        var mtype = ev.target.closest('[data-mtype]');
        if (mtype) {
          ev.preventDefault();
          UI.$$('[data-mtype]', root).forEach(function (b) { b.classList.remove('is-on'); });
          mtype.classList.add('is-on');
          mentorDraft().type = mtype.getAttribute('data-mtype') || '개인 멘토';
          paintMentorType(root);      /* 안내·필수 표시만 바뀜(적던 값은 그대로) */
          return;
        }

        /* 체육관 이름 추천에서 바로 채우기 */
        var affPick = ev.target.closest('[data-aff-pick]');
        if (affPick) {
          ev.preventDefault();
          var affInp = root.querySelector('[data-mentor-field="affiliation"]');
          if (affInp) affInp.value = affPick.getAttribute('data-aff-pick');
          mentorDraft().affiliation = affInp ? affInp.value : '';
          paintAffSuggestions(root);
          UI.haptic(6);
          return;
        }

        /* 체육관 목록(지도)에서 고르기 — 전국 120곳 */
        if (ev.target.closest('[data-act="mentor-gym"]')) {
          ev.preventDefault();
          var gymv = BM.views && BM.views.gyms;
          if (!gymv || typeof gymv.open !== 'function') { UI.toast('체육관 목록을 열 수 없어요', 'error'); return; }
          gymv.open(ctx, {
            onPick: function (v) {
              if (!v) return;
              var inp = root.querySelector('[data-mentor-field="affiliation"]');
              if (inp) inp.value = v.name;
              mentorDraft().affiliation = v.name;
              paintAffSuggestions(root);
              UI.toast(v.name + ' · 소속 칸에 넣었어요');
            }
          });
          return;
        }

        /* 증빙 사진 첨부 · 빼기 */
        if (ev.target.closest('[data-act="mentor-photo"]')) {
          ev.preventDefault();
          pickProofPhoto(function (url) {
            proofPhoto = url;
            paintProofPhoto(root);
            var btn = root.querySelector('[data-act="mentor-photo"]');
            if (btn) btn.innerHTML = UI.icon('camera') + '사진 바꾸기';
            UI.toast('증빙 사진을 첨부했어요. 신청하면 관리자에게 함께 전달돼요');
            UI.haptic(8);
          }, function (msg) { UI.toast(msg, 'error'); });
          return;
        }
        if (ev.target.closest('[data-act="mentor-photo-clear"]')) {
          ev.preventDefault();
          proofPhoto = '';
          paintProofPhoto(root);
          var pbtn = root.querySelector('[data-act="mentor-photo"]');
          if (pbtn) pbtn.innerHTML = UI.icon('camera') + '증빙 사진 첨부';
          UI.toast('증빙 사진을 뺐어요');
          return;
        }

        var apply = ev.target.closest('[data-act="apply-mentor"]');
        if (apply) {
          ev.preventDefault();
          if (apply.dataset.busy === '1') return;
          apply.dataset.busy = '1';
          var val = function (name) {
            var el = root.querySelector('[data-mentor-field="' + name + '"]');
            return el ? el.value : '';
          };
          var dd = mentorDraft();
          /* 화면에 남은 값을 한 번 더 읽어 초안과 맞춥니다(입력 직후 바로 누른 경우) */
          ['affiliation', 'experience', 'awards', 'reason', 'proof', 'proofUrl'].forEach(function (name) {
            if (Object.prototype.hasOwnProperty.call(dd, name)) dd[name] = val(name);
          });
          var res = ctx.actions.requestMentor({
            type: currentMentorType(root),
            affiliation: dd.affiliation,
            experience: dd.experience, awards: dd.awards,
            reason: dd.reason, proof: dd.proof, proofUrl: dd.proofUrl,
            proofPhoto: proofPhoto
          });
          setTimeout(function () { apply.dataset.busy = '0'; }, 800);
          if (res.ok) {
            proofPhoto = '';
            draft = null;             /* 보낸 초안은 비웁니다 */
            UI.toast('관리자에게 멘토 신청을 보냈어요 (심사중)');
            UI.haptic(12);
          }
          else if (res.reason === 'empty') UI.toast('지원 사유를 적어 주세요');
          else if (res.reason === 'need_affiliation') {
            UI.toast('소속 체육관·팀을 먼저 적어 주세요');
            var afi = root.querySelector('[data-mentor-field="affiliation"]');
            if (afi && afi.focus) afi.focus();
          } else if (res.reason === 'need_proof') UI.toast('증명을 하나 이상 넣어 주세요 (링크·메모·사진 중)');
          else if (res.reason === 'bad_url') UI.toast('증빙 링크 주소를 확인해 주세요 (https://…)', 'error');
          else if (res.reason === 'bad_photo') UI.toast('증빙 사진을 다시 골라 주세요', 'error');
          else if (res.reason === 'pending') UI.toast('이미 심사중인 신청이 있어요');
          else if (res.reason === 'locked') UI.toast('잠시만요, 보내는 중이에요');
          else UI.toast('신청을 보내지 못했어요', 'error');
          return;
        }

        var mopen = ev.target.closest('[data-mentor-open]');
        if (mopen) {
          ev.preventDefault();
          openMentorSheet(mopen.getAttribute('data-mentor-open'), ctx);
          return;
        }

        var maccept = ev.target.closest('[data-mentor-accept]');
        if (maccept) {
          ev.preventDefault();
          decideMentorAsk(maccept.getAttribute('data-mentor-accept'), '승인', ctx);
          return;
        }

        var mreject = ev.target.closest('[data-mentor-reject]');
        if (mreject) {
          ev.preventDefault();
          decideMentorAsk(mreject.getAttribute('data-mentor-reject'), '거절', ctx);
          return;
        }

        var pickBtn = ev.target.closest('[data-pick]');
        if (pickBtn) {
          ev.preventDefault();
          var k = pickBtn.getAttribute('data-pick');
          ctx.actions.setCoachPlayer(ctx.store.state.ui.coachPlayer === k ? null : k);
          UI.haptic(6);
          return;
        }
        var star = ev.target.closest('[data-star]');
        if (star) {
          ev.preventDefault();
          rating = +star.getAttribute('data-star');
          var box = star.closest('[data-stars]');
          Array.prototype.forEach.call(box.querySelectorAll('[data-star]'), function (s) {
            s.classList.toggle('is-on', +s.getAttribute('data-star') <= rating);
          });
          return;
        }
        var drill = ev.target.closest('[data-drill]');
        if (drill) {
          ev.preventDefault();
          UI.toggleChip(drill);
          return;
        }
        var send = ev.target.closest('[data-act="send-fb"]');
        if (send) {
          ev.preventDefault();
          var box2 = send.closest('[data-coachbox]');
          var text = box2.querySelector('[data-fb-text]').value;
          var drills = UI.readChips(box2.querySelector('[data-drills]'));
          var res = ctx.actions.sendCoachFeedback({
            playerKey: send.getAttribute('data-player'), text: text, rating: rating, drills: drills
          });
          if (res.ok) {
            box2.querySelector('[data-fb-text]').value = '';
            UI.toast('피드백을 보냈어요.');
            UI.haptic(12);
          } else if (res.reason === 'empty') UI.toast('피드백 내용을 적어 주세요');
          else if (res.reason === 'forbidden') UI.toast('코치·관리자만 피드백을 보낼 수 있어요', 'error');
          else if (res.reason === 'locked') UI.toast('잠시만요');
          return;
        }
        var dec = ev.target.closest('[data-decide]');
        if (dec) {
          ev.preventDefault();
          var d = ctx.actions.decideCoachApp(dec.getAttribute('data-decide'), dec.getAttribute('data-status'));
          if (d.ok) UI.toast('멘토 신청을 ' + dec.getAttribute('data-status') + ' 처리했어요.');
          else if (d.reason === 'forbidden') UI.toast('관리자 계정에서만 심사할 수 있어요', 'error');
          UI.haptic(10);
          return;
        }
      });

      /* 입력 — 신청서 값은 초안에 담아 두고(화면이 다시 그려져도 남음),
       * 소속 칸은 치는 동안 BM.gyms 에서 체육관 이름을 찾아 추천합니다 */
      root.addEventListener('input', function (ev) {
        var field = ev.target.closest && ev.target.closest('[data-mentor-field]');
        if (!field) return;
        var name = field.getAttribute('data-mentor-field');
        if (Object.prototype.hasOwnProperty.call(mentorDraft(), name)) mentorDraft()[name] = field.value;
        if (name === 'affiliation') paintAffSuggestions(root);
      });

      /* 화면을 다시 그린 뒤에도 유형에 맞는 안내·필수 표시를 맞춥니다 */
      paintMentorType(root);
    },

    update: function (root, state, ctx) {
      /* 코치 화면은 상태가 바뀌면 통째로 다시 그립니다 (목록이 작아 빠릅니다) */
      ctx.refresh();
    }
  };

  BM.views.coach = view;
  view.feedbackAskText = feedbackAskText;   /* 테스트·점검용 (피드백 요청 한 줄 요약) */
  view.askFeedback = askFeedback;           /* 테스트·점검용 (영상 동봉 확인 시트) */
  view.videoAskLine = videoAskLine;
  view.affVenues = affVenues;               /* 테스트·점검용 (활동 소속 → 등록 체육관) */
  view.affMapRow = affMapRow;
  view.affRow = affRow;                     /* 테스트·점검용 (소속 줄 → 지도 칩) */
  view.venueFor = venueFor;
})(typeof globalThis !== 'undefined' ? globalThis : this);
