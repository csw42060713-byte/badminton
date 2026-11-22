/* ============================================================
 * js/views/start.js — 시작화면(로그인 게이트) + 첫 가입 온보딩
 *  - 로그인 전에는 하단 탭바를 감추고 브랜드 화면만 보여 줍니다.
 *  - Google / 이메일 / 둘러보기 세 갈래 길을 한 화면에서 고릅니다.
 *  - 신규 가입자는 닉네임·급수·종목·지역을 10초 안에 고르고 들어갑니다.
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};
  var U = BM.util, D = BM.domain, UI = BM.ui;
  BM.views = BM.views || {};

  var ui = {
    screen: 'home',
    mode: 'login',
    error: '',
    busy: false,
    draft: { email: '', password: '', nick: '' },
    onb: { nick: '', level: '', discipline: '', gender: '', region: '', club: '', role: '', theme: '' }
  };

  /* 지금 실제로 적용된 테마 — 미리보기에서 선택을 풀면 이 테마로 돌아갑니다 */
  var appliedTheme = '';

  function googleMark() {
    return '<svg class="gmark" viewBox="0 0 48 48" aria-hidden="true">' +
      '<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>' +
      '<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>' +
      '<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>' +
      '<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>' +
      '</svg>';
  }

  /* ---------- 화면 1: 시작 ---------- */
  function homeHtml() {
    return '' +
      '<div class="start">' +
      '<div class="start__glow" aria-hidden="true"></div>' +
      '<div class="start__brand">' +
      '<div class="start__mark"><img src="icons/icon-512.png" alt="" width="512" height="512" decoding="async"></div>' +
      '<p class="start__kicker">BADMINTON LOG</p>' +
      '<h1 class="start__title">배드민턴 분석</h1>' +
      '<p class="start__sub">오늘 친 경기 한 줄이면, AI가 내일의 드릴과 이번 주 루틴까지 만들어 드려요.</p>' +
      '</div>' +
      '<div class="start__actions">' +
      '<button type="button" class="btn btn--google btn--big" data-act="google">' +
      googleMark() + '<span>Google로 계속하기</span></button>' +
      '<div class="gsi" data-gsi hidden></div>' +
      '<button type="button" class="btn btn--ghost btn--big start__email" data-act="to-email">' +
      '이메일로 로그인 · 회원가입</button>' +
      '<button type="button" class="start__guest" data-act="guest">로그인 없이 둘러보기</button>' +
      '</div>' +
      '<p class="start__note">처음이면 <b>10초 설정</b>으로 바로 시작해요.<br>체험 모드 기록은 이 기기에만 저장돼요.</p>' +
      '<p class="start__legal"><a href="privacy.html" target="_blank" rel="noopener">개인정보처리방침</a></p>' +
      '</div>';
  }

  /* ---------- 화면 2: 이메일 ---------- */
  function emailHtml() {
    var signup = ui.mode === 'signup';
    var d = ui.draft;
    return '' +
      '<div class="start start--form">' +
      '<div class="start__top">' +
      '<button type="button" class="start__back" data-act="back" aria-label="뒤로 가기">←</button>' +
      '<span class="start__tiny"><img class="start__mini" src="icons/icon-192.png" alt="" width="22" height="22" decoding="async">배드민턴 분석</span>' +
      '</div>' +
      '<div class="start__brand start__brand--sm">' +
      '<h1 class="start__title">' + (signup ? '회원가입' : '로그인') + '</h1>' +
      '<p class="start__sub">' + (signup
        ? '이메일만 있으면 10초 뒤 바로 시작할 수 있어요.'
        : '다시 오셨네요. 기록은 그대로 이어집니다.') + '</p>' +
      '</div>' +
      '<div class="card start__card">' +
      '<div class="seg seg--wide" role="tablist">' +
      '<button type="button" class="seg__btn' + (signup ? '' : ' is-on') + '" data-act="mode" data-mode="login" role="tab">로그인</button>' +
      '<button type="button" class="seg__btn' + (signup ? ' is-on' : '') + '" data-act="mode" data-mode="signup" role="tab">회원가입</button>' +
      '</div>' +
      '<label class="flabel">이메일<input type="email" inputmode="email" autocomplete="email" data-f="email" placeholder="you@example.com" value="' + U.esc(d.email) + '"></label>' +
      '<label class="flabel">비밀번호<input type="password" autocomplete="' + (signup ? 'new-password' : 'current-password') + '" data-f="password" placeholder="6자 이상" value="' + U.esc(d.password) + '"></label>' +
      (signup ? '<label class="flabel">닉네임<input type="text" maxlength="12" data-f="nick" placeholder="앱에서 불릴 이름" value="' + U.esc(d.nick) + '"></label>' : '') +
      (ui.error ? '<p class="start__error">' + U.esc(ui.error) + '</p>' : '') +
      '<button type="button" class="btn btn--primary btn--big mt16" data-act="submit"' + (ui.busy ? ' disabled' : '') + '>' +
      (ui.busy ? '잠시만요…' : (signup ? '가입하고 시작하기' : '로그인')) + '</button>' +
      (signup ? '' : '<button type="button" class="linkbtn start__forgot" data-act="forgot">비밀번호를 잊었어요</button>') +
      '<p class="hint">' + (BM.auth.prefersSheetsAuth()
        ? '구글 시트와 연결된 계정으로 확인해요. 비밀번호는 해시로만 저장됩니다.'
        : '이메일·비밀번호는 서버(Supabase · 서울)에서 관리되고, 다른 기기에서도 같은 계정으로 이어집니다.') + '</p>' +
      '</div>' +
      '</div>';
  }

  /* ---------- 화면 3: 온보딩 ---------- */
  /* 사용자 유형 카드 4장 — 누르면 하나만 켜집니다(같은 카드를 다시 누르면 해제).
   * 픽 처리(data-pick)는 아래 click 한 곳에서 그대로 받으므로 새 리스너가 필요 없습니다. */
  function roleCards(selected) {
    return '<div class="rolepicks" data-pick-group="role">' + D.ROLES.map(function (r) {
      var on = r.id === selected;
      return '<button type="button" class="rolepick' + (on ? ' is-on' : '') + '" data-pick="role" data-val="' + U.esc(r.id) + '"' +
        ' aria-pressed="' + (on ? 'true' : 'false') + '">' +
        '<span class="rolepick__t">' + U.esc(r.label) + '</span>' +
        '<span class="rolepick__s">' + U.esc(r.answer) + '</span>' +
        '<span class="rolepick__d">' + U.esc(r.desc) + '</span>' +
        '</button>';
    }).join('') + '</div>';
  }
  function pickChips(name, options, selected, cls) {
    return '<div class="chips chips--wrap" data-pick-group="' + name + '">' + options.map(function (o) {
      var on = o === selected;
      return '<button type="button" class="chip ' + (cls || '') + (on ? ' is-on' : '') + '" data-pick="' + name + '" data-val="' + U.esc(o) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + U.esc(o) + '</button>';
    }).join('') + '</div>';
  }

  /* 앱 분위기(테마) 3종 — 누르면 이 화면이 바로 그 테마로 바뀌어 미리 보입니다.
   * 저장은 MY › 테마와 같은 곳(me.theme.theme)이라 시작하기를 누르면 전체 화면에 그대로 적용됩니다.
   * 성별이 '여성'일 때만 사쿠라에 '추천' 배지를 빛깔만 은은하게 올리고(강제 적용 없음),
   * 남녀 모두 원하는 테마를 자유롭게 고릅니다. */
  function themeNote(id) {
    if (!id) return '지금 화면 그대로 시작해요 · MY › 테마에서 언제든 바꿀 수 있어요';
    var def = D.themeById(id) || {};
    var price = D.themePrice(id);
    if (price > 0) return (def.name || '이 테마') + '는 하트 ' + price + '개로 여는 테마예요 · 시작하면 바로 적용돼요';
    return '누르면 이 화면이 바로 그 테마로 바뀌어요 · MY에서 언제든 바꿀 수 있어요';
  }

  function themePicks(selected, gender) {
    return '<div class="onbthemes" data-pick-group="theme">' + D.onbThemes().map(function (t) {
      var on = t.id === selected;
      var rec = D.onbThemeRecommended(t.id, gender);
      return '<button type="button" class="onbtheme' + (on ? ' is-on' : '') + '"' +
        ' data-pick="theme" data-val="' + U.esc(t.id) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
        '<span class="onbtheme__mini swatch--' + U.esc(t.id) + '" aria-hidden="true"><i></i><i></i></span>' +
        '<span class="onbtheme__txt"><b>' + U.esc(t.name) +
        '<i class="onbtheme__rec" data-onb-rec="' + U.esc(t.id) + '"' + (rec ? '' : ' hidden') + '>추천</i></b>' +
        '<small>' + U.esc(t.note) + '</small></span>' +
        (t.price > 0 ? '<span class="onbtheme__price">하트 ' + t.price + '</span>' : '') +
        '<span class="onbtheme__mark" aria-hidden="true">' + UI.icon('check') + '</span>' +
        '</button>';
    }).join('') + '</div>' +
      '<p class="onb__tip" data-onb-theme-note>' + U.esc(themeNote(selected)) + '</p>';
  }

  function onboardingHtml(session) {
    var o = ui.onb;
    var hello = (o.nick || (session && session.name) || '').trim();
    return '' +
      '<div class="onb">' +
      '<div class="onb__head">' +
      '<span class="onb__step">10초 설정</span>' +
      '<h1 class="onb__title">' + (hello ? U.esc(hello) + '님, 반가워요!' : '반가워요!') + '</h1>' +
      '<p class="onb__sub">어떤 유형인지 먼저 고르면 일지 화면이 그에 맞게 시작해요. 급수와 주력 종목만 더 알려 주세요.</p>' +
      '</div>' +
      /* v1.40 — 네 가지 유형 중 하나 (초보 · 동호인 · 선수 · 코치) */
      '<div class="onb__block" data-onb-role>' +
      '<span class="onb__label">나는 어떤 유형인가요? <i class="onb__req">필수</i></span>' +
      roleCards(o.role) +
      '</div>' +
      '<div class="onb__block">' +
      '<label class="onb__label" for="onbNick">닉네임</label>' +
      '<input id="onbNick" class="onb__input" type="text" maxlength="12" data-o="nick" placeholder="앱에서 불릴 이름" value="' + U.esc(o.nick || (session && session.name) || '') + '">' +
      '</div>' +
      '<div class="onb__block">' +
      '<span class="onb__label">급수 <i class="onb__req">필수</i></span>' +
      pickChips('level', D.VOCAB.grades, o.level) +
      '</div>' +
      '<div class="onb__block">' +
      '<span class="onb__label">주력 종목 <i class="onb__req">필수</i></span>' +
      pickChips('discipline', D.VOCAB.disciplines, o.discipline) +
      '</div>' +
      '<div class="onb__block">' +
      '<span class="onb__label">성별 <i class="onb__opt">선택 · 매칭 검색에 쓰여요</i></span>' +
      pickChips('gender', D.VOCAB.genders, o.gender || '비공개') +
      '</div>' +
      /* v1.56 — 성별 바로 아래에서 앱 분위기를 고릅니다(고르면 화면 전체가 바로 바뀜) */
      '<div class="onb__block" data-onb-theme>' +
      '<span class="onb__label">앱 분위기 <i class="onb__opt">눌러서 미리 보기 · 지금도 바꿀 수 있어요</i></span>' +
      themePicks(o.theme, o.gender) +
      '</div>' +
      '<div class="onb__block">' +
      '<span class="onb__label">지역 <i class="onb__opt">선택</i></span>' +
      pickChips('region', D.VOCAB.regions, o.region) +
      '</div>' +
      '<div class="onb__block">' +
      '<label class="onb__label" for="onbClub">클럽 <i class="onb__opt">선택</i></label>' +
      '<input id="onbClub" class="onb__input" type="text" maxlength="20" data-o="club" placeholder="예: 우리 클럽" value="' + U.esc(o.club) + '">' +
      '</div>' +
      (ui.error ? '<p class="start__error">' + U.esc(ui.error) + '</p>' : '') +
      '<button type="button" class="btn btn--primary btn--big onb__go" data-act="finish">시작하기</button>' +
      '<p class="onb__note">나중에 MY &gt; 내 유형에서 언제든 바꿀 수 있어요.</p>' +
      '</div>';
  }

  /* ---------- 그리기 ---------- */
  function render() {
    if (ui.screen === 'onboarding') return onboardingHtml(BM.auth.session());
    if (ui.screen === 'email') return emailHtml();
    return homeHtml();
  }

  function reset() {
    ui.screen = 'home';
    ui.mode = 'login';
    ui.error = '';
    ui.busy = false;
    ui.draft = { email: '', password: '', nick: '' };
    ui.onb = { nick: '', level: '', discipline: '', gender: '', region: '', club: '', role: '', theme: '' };
  }

  function paint(host) {
    host.innerHTML = '<div class="view view--start">' + render() + '</div>';
  }

  /* ---------- Google: Client ID 없을 때 안내 ---------- */
  function openGoogleSheet(actions) {
    actions = actions || {};
    var wrap = UI.openSheet({
      title: 'Google 로그인',
      body: '<p class="sheet__text">실제 구글 계정으로 로그인하려면 <b>Google OAuth Client ID</b>가 필요해요. ' +
        'MY &gt; 데이터 연결 &gt; 고급에 한 번만 넣어 두면 다음부터는 버튼 한 번으로 끝납니다.</p>' +
        '<ol class="start__steps">' +
        '<li>console.cloud.google.com → 새 프로젝트</li>' +
        '<li>API 및 서비스 → 사용자 인증 정보 → OAuth 클라이언트 ID(웹 애플리케이션)</li>' +
        '<li>승인된 자바스크립트 원본에 이 사이트 주소를 추가</li>' +
        '<li>발급된 <b>…apps.googleusercontent.com</b>을 MY &gt; 데이터 연결 &gt; 고급에 붙여넣기</li>' +
        '</ol>' +
        '<p class="sheet__text mt8">지금은 데모 계정으로 화면을 미리 볼 수 있어요.</p>' +
        '<button type="button" class="btn btn--primary btn--big mt8" data-g="demo">데모 Google 계정으로 미리보기</button>' +
        '<button type="button" class="btn btn--ghost btn--big mt8" data-g="email">이메일로 로그인</button>',
      onMount: function (node) {
        node.addEventListener('click', function (ev) {
          var b = ev.target.closest('[data-g]');
          if (!b) return;
          var kind = b.getAttribute('data-g');
          UI.closeSheet();
          if (kind === 'demo' && typeof actions.demo === 'function') actions.demo();
          else if (kind === 'email' && typeof actions.email === 'function') actions.email();
        });
      }
    });
    return wrap;
  }

  /* ---------- 이벤트 ----------
   * #main은 시작화면 → 온보딩으로 이어지므로, 다시 마운트할 때
   * 이전에 붙인 리스너를 먼저 떼어 냅니다(같은 클릭이 두 번 처리되던 문제). */
  var bound = null;

  function unbind() {
    if (!bound) return;
    bound.handlers.forEach(function (h) { bound.host.removeEventListener(h.type, h.fn); });
    bound = null;
  }

  function on(host, type, fn) {
    host.addEventListener(type, fn);
    if (bound) bound.handlers.push({ type: type, fn: fn });
  }

  function mount(host, ctx) {
    ctx = ctx || {};
    unbind();
    bound = { host: host, handlers: [] };
    paint(host);

    function done() {
      if (typeof ctx.onDone === 'function') ctx.onDone();
    }

    function repaint() {
      paint(host);
      setupGsi();
    }

    function setupGsi() {
      var cid = BM.auth.googleClientId();
      var slot = host.querySelector('[data-gsi]');
      var btn = host.querySelector('[data-act="google"]');
      if (!cid || !slot || ui.screen !== 'home') return;
      if (!BM.auth.googleReady()) return;
      var ok = BM.auth.renderGoogleButton(slot, {
        clientId: cid,
        onCredential: function (info) {
          try {
            BM.auth.signInGoogle(info);
            done();
          } catch (e) { UI.toast((e && e.message) || '로그인하지 못했어요', 'error'); }
        }
      });
      if (ok) {
        slot.hidden = false;
        if (btn) btn.hidden = true;
      }
    }

    if (ui.screen === 'home' && BM.auth.googleClientId()) {
      BM.auth.loadGoogleScript().then(setupGsi).catch(function () { /* 직접 버튼으로 안내 */ });
    }

    on(host, 'click', function (ev) {
      var act = ev.target.closest('[data-act]');
      if (act) {
        var name = act.getAttribute('data-act');
        if (name === 'google') {
          ev.preventDefault();
          if (act.dataset.busy === '1') return;      /* 연타로 로그인 창이 두 번 뜨지 않게 */
          act.dataset.busy = '1';
          BM.auth.requestGoogleSignIn().then(function (info) {
            act.dataset.busy = '0';
            if (info) {
              BM.auth.signInGoogle(info);
              done();
            } else {
              UI.toast('구글 로그인 창이 뜨지 않았어요. 잠시 뒤 다시 시도해 주세요.');
            }
          }).catch(function (err) {
            act.dataset.busy = '0';
            if (!BM.auth.googleClientId()) {
              openGoogleSheet({
                demo: function () {
                  try { BM.auth.signInGoogle(BM.auth.DEMO_GOOGLE); done(); }
                  catch (e) { UI.toast((e && e.message) || '로그인하지 못했어요', 'error'); }
                },
                email: function () { ui.screen = 'email'; ui.mode = 'login'; ui.error = ''; repaint(); }
              });
            } else {
              UI.toast((err && err.message) || '구글 로그인을 시작하지 못했어요', 'error');
            }
          });
          return;
        }
        if (name === 'to-email') {
          ev.preventDefault();
          ui.screen = 'email';
          ui.mode = 'login';
          ui.error = '';
          repaint();
          return;
        }
        if (name === 'back') {
          ev.preventDefault();
          ui.screen = 'home';
          ui.error = '';
          repaint();
          return;
        }
        if (name === 'mode') {
          ev.preventDefault();
          ui.mode = act.getAttribute('data-mode') || 'login';
          ui.error = '';
          readDraft();
          repaint();
          return;
        }
        if (name === 'forgot') {
          ev.preventDefault();
          readDraft();
          if (!BM.auth.isEmail(ui.draft.email)) {
            ui.error = '가입한 이메일을 먼저 입력해 주세요.';
            repaint();
            return;
          }
          if (ui.busy) return;
          ui.busy = true;
          ui.error = '';
          repaint();
          BM.auth.recoverPassword(ui.draft.email).then(function (res) {
            ui.busy = false;
            if (res && res.ok) { UI.toast((res && res.message) || '재설정 메일을 보냈어요'); repaint(); return; }
            ui.error = (res && res.message) || '메일을 보내지 못했어요. 잠시 뒤 다시 시도해 주세요.';
            repaint();
          }, function () {
            ui.busy = false;
            ui.error = '메일을 보내지 못했어요. 잠시 뒤 다시 시도해 주세요.';
            repaint();
          });
          return;
        }
        if (name === 'guest') {
          ev.preventDefault();
          BM.auth.signInGuest();
          done();
          return;
        }
        if (name === 'submit') {
          ev.preventDefault();
          if (ui.busy) return;
          readDraft();
          var signup = ui.mode === 'signup';
          if (!BM.auth.isEmail(ui.draft.email)) {
            ui.error = '이메일 주소를 확인해 주세요.';
            repaint();
            return;
          }
          if (String(ui.draft.password).length < 6) {
            ui.error = '비밀번호는 6자 이상으로 정해 주세요.';
            repaint();
            return;
          }
          ui.busy = true;
          ui.error = '';
          repaint();
          BM.auth.signInEmail({
            email: ui.draft.email,
            password: ui.draft.password,
            nick: ui.draft.nick,
            create: signup
          }).then(function (res) {
            ui.busy = false;
            if (res && res.ok) { done(); return; }
            ui.error = (res && res.message) || '로그인하지 못했어요.';
            repaint();
          }).catch(function (err) {
            ui.busy = false;
            ui.error = (err && err.message) || '잠시 뒤 다시 시도해 주세요.';
            repaint();
          });
          return;
        }
        if (name === 'finish') {
          ev.preventDefault();
          if (ui.busy) return;                       /* 시작하기 연타 방지 */
          ui.busy = true;
          finishOnboarding(host, ctx);
          return;
        }
      }

      var pick = ev.target.closest('[data-pick]');
      if (pick) {
        ev.preventDefault();
        clearError(host);
        var group = pick.getAttribute('data-pick');
        var val = pick.getAttribute('data-val');
        var box = pick.closest('[data-pick-group]');
        var already = pick.classList.contains('is-on');
        Array.prototype.forEach.call(box.querySelectorAll('[data-pick]'), function (b) {
          b.classList.remove('is-on');
          b.setAttribute('aria-pressed', 'false');
        });
        if (!already) {
          pick.classList.add('is-on');
          pick.setAttribute('aria-pressed', 'true');
          ui.onb[group] = val;
        } else {
          ui.onb[group] = '';
        }
        /* 테마 — 고르는 즉시 이 화면 전체가 그 테마로 바뀌어 미리 보입니다(저장은 시작할 때) */
        if (group === 'theme') previewTheme(ui.onb.theme);
        /* 성별 — '여성'일 때만 사쿠라에 은은한 '추천' 배지 (강제 적용하지 않음) */
        if (group === 'gender') refreshRec(host);
        ui.error = '';
        UI.haptic(6);
      }
    });

    on(host, 'input', function (ev) {
      clearError(host);
      var f = ev.target.closest('[data-f]');
      if (f) { ui.draft[f.getAttribute('data-f')] = f.value; return; }
      var o = ev.target.closest('[data-o]');
      if (o) { ui.onb[o.getAttribute('data-o')] = o.value; }
    });

    on(host, 'keydown', function (ev) {
      if (ev.key !== 'Enter') return;
      var field = ev.target.closest('[data-f]');
      if (!field || ui.screen !== 'email' || ui.busy) return;
      ev.preventDefault();
      var btn = host.querySelector('[data-act="submit"]');
      if (btn) btn.click();
    });

    if (ui.screen === 'home' && !BM.auth.googleClientId()) {
      /* Client ID가 없어도 버튼은 눌리게 두고, 눌렀을 때 안내합니다 */
    }
  }

  /* 테마 미리 보기 — html[data-theme]만 바꿔 보여 주고, 아직 아무것도 저장하지 않습니다 */
  function previewTheme(id) {
    if (typeof document === 'undefined') return;
    var t = id || appliedTheme || 'th_def';
    document.documentElement.setAttribute('data-theme', t);
    var note = document.querySelector('[data-onb-theme-note]');
    if (note) note.textContent = themeNote(id);
  }

  /* 성별을 바꿀 때마다 '추천' 배지만 다시 계산합니다(입력하던 화면은 그대로) */
  function refreshRec(host) {
    if (!host || !host.querySelectorAll) return;
    Array.prototype.forEach.call(host.querySelectorAll('[data-onb-rec]'), function (badge) {
      var id = badge.getAttribute('data-onb-rec');
      badge.hidden = !D.onbThemeRecommended(id, ui.onb.gender);
    });
  }

  function clearError(host) {
    ui.error = '';
    var err = host.querySelector('.start__error');
    if (err && err.parentNode) err.parentNode.removeChild(err);
  }

  function readDraft() {
    /* 화면 입력값은 input 이벤트로 이미 ui.draft에 있습니다 */
    return ui.draft;
  }

  function finishOnboarding(host, ctx) {
    var o = ui.onb;
    var nick = String(o.nick || '').trim();
    if (!o.role) { ui.busy = false; ui.error = '어떤 유형인지 골라 주세요.'; paint(host); return; }
    if (!nick) { ui.busy = false; ui.error = '닉네임을 입력해 주세요.'; paint(host); return; }
    if (!o.level) { ui.busy = false; ui.error = '급수를 골라 주세요.'; paint(host); return; }
    if (!o.discipline) { ui.busy = false; ui.error = '주력 종목을 골라 주세요.'; paint(host); return; }
    ui.error = '';
    if (typeof ctx.onComplete === 'function') {
      ctx.onComplete({
        nick: nick, level: o.level, discipline: o.discipline,
        gender: o.gender || '비공개',
        region: o.region || '', club: String(o.club || '').trim(),
        role: D.normalizeRole(o.role),
        theme: o.theme || ''
      });
    }
  }

  /* ---------- 온보딩 마운트 ---------- */
  function mountOnboarding(host, ctx) {
    ctx = ctx || {};
    var session = BM.auth.session();
    /* 지금 적용된 테마를 기억해 두고, 그 테마가 3종 안에 있으면 미리 골라 둡니다 */
    appliedTheme = ctx.theme ||
      (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme')) || 'th_def';
    if (!ui.onb.theme && D.ONB_THEMES.some(function (t) { return t.id === appliedTheme; })) {
      ui.onb.theme = appliedTheme;
    }
    if (!ui.onb.nick && session && session.name) ui.onb.nick = session.name;
    if (!ui.onb.nick && session && session.email) ui.onb.nick = String(session.email).split('@')[0];
    ui.screen = 'onboarding';
    ui.error = '';
    mount(host, ctx);
  }

  /* ---------- 비밀번호 재설정 (메일 링크로 돌아왔을 때) ----------
   * bootstrapRecovery() 가 세션을 받아 둔 상태이므로 새 비밀번호만 정하면 됩니다. */
  function openRecovery() {
    return UI.openSheet({
      title: '새 비밀번호 정하기',
      body: '<p class="sheet__text">메일 링크 확인이 끝났어요. 새 비밀번호를 정해 주세요.</p>' +
        '<label class="flabel">새 비밀번호<input type="password" autocomplete="new-password" data-p="pw" placeholder="6자 이상"></label>' +
        '<label class="flabel">한 번 더<input type="password" autocomplete="new-password" data-p="pw2" placeholder="같은 비밀번호"></label>' +
        '<p class="start__error" data-p="err" style="display:none"></p>' +
        '<div class="row gap8 mt16"><button type="button" class="btn btn--ghost grow" data-close>나중에</button>' +
        '<button type="button" class="btn btn--primary grow" data-p="save">저장</button></div>',
      onMount: function (node) {
        function show(m) {
          var err = node.querySelector('[data-p="err"]');
          if (err) { err.textContent = m; err.style.display = ''; }
        }
        node.addEventListener('click', function (ev) {
          var btn = ev.target.closest('[data-p="save"]');
          if (!btn) return;
          ev.preventDefault();
          var pw = node.querySelector('[data-p="pw"]').value;
          var pw2 = node.querySelector('[data-p="pw2"]').value;
          if (String(pw).length < 6) { show('비밀번호는 6자 이상으로 정해 주세요.'); return; }
          if (pw !== pw2) { show('두 비밀번호가 달라요.'); return; }
          if (btn.dataset.busy === '1') return;
          btn.dataset.busy = '1';
          btn.disabled = true;
          BM.auth.changePassword(pw).then(function (res) {
            btn.dataset.busy = '0';
            btn.disabled = false;
            if (res && res.ok) { UI.closeSheet(); UI.toast('비밀번호를 바꿨어요'); return; }
            show((res && res.message) || '비밀번호를 바꾸지 못했어요.');
          }, function () {
            btn.dataset.busy = '0';
            btn.disabled = false;
            show('비밀번호를 바꾸지 못했어요. 잠시 뒤 다시 시도해 주세요.');
          });
        });
      }
    });
  }

  BM.views.start = {
    render: render,
    mount: mount,
    renderOnboarding: function (session) {
      ui.screen = 'onboarding';
      if (!ui.onb.nick && session && session.name) ui.onb.nick = session.name;
      return '<div class="view view--start">' + onboardingHtml(session) + '</div>';
    },
    mountOnboarding: mountOnboarding,
    unmount: unbind,
    reset: reset,
    openRecovery: openRecovery,
    state: function () { return ui; }
  };
  BM.views.start.reset = reset;
})(typeof globalThis !== 'undefined' ? globalThis : this);
