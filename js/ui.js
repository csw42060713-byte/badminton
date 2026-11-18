/* ============================================================
 * ui.js — 화면 공통 조각 (토스트, 바텀시트, 아이콘, 목록 그리기)
 * 프레임워크 없이 필요한 만큼만 직접 만집니다.
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};
  var U = BM.util;

  var hasDom = typeof document !== 'undefined';

  function $(sel, el) { return (el || document).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }

  var ICONS = {
    log: '<path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="M13.5 6.5l3 3"/>',
    match: '<circle cx="9" cy="7" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="8" r="2.4"/><path d="M16 14c3 0 5 2.2 5 5"/>',
    community: '<path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-6.5A8 8 0 0 1 11 4h2a8 8 0 0 1 8 8z"/>',
    coach: '<path d="M13 4a4 4 0 0 1 4 4v1h2a2 2 0 0 1 0 4h-1.2A6 6 0 0 1 6 13V7a3 3 0 0 1 3-3h4z"/><path d="M10 17v3"/>',
    my: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c0-4.1 3.4-7 7.5-7s7.5 2.9 7.5 7"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-9.4A4.1 4.1 0 0 1 12 7.4a4.1 4.1 0 0 1 7.5 3.2C19.5 15.4 12 20 12 20z"/>',
    arrow: '<path d="M9 6l6 6-6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M5 13l4 4L19 7"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4.5l3 2"/>',
    fire: '<path d="M12 3s4.5 4 4.5 8a4.5 4.5 0 0 1-9 0c0-1.6.7-3 1.5-4 .3 1.2 1 2 2 2 1.4 0 1-3 1-6z"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
    send: '<path d="M4 12l16-8-6 16-3-6z"/>',
    alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    edit: '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3z"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-3.6-3.6"/>',
    filter: '<path d="M4 7h16M7 12h10M10 17h4"/>',
    camera: '<path d="M4 9h3l1.4-2h7.2L18 9h2v10H4z"/><circle cx="12" cy="13.5" r="3.2"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18h1.6a2 2 0 0 0 0-4h-.8a1.8 1.8 0 0 1 0-3.6H17a4 4 0 0 0 4-4c0-3.4-4-6.4-9-6.4z"/><circle cx="8" cy="10" r="1"/><circle cx="12" cy="7.6" r="1"/>',
    trash: '<path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13"/><path d="M11 11v6M13 11v6"/>',
    pin: '<path d="M12 21s6-5.3 6-10a6 6 0 1 0-12 0c0 4.7 6 10 6 10z"/><circle cx="12" cy="11" r="2.2"/>',
    doc: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M10 12h5M10 16h5"/>',
    shield: '<path d="M12 3l7 3v6c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z"/><path d="M9 12l2 2 4-4"/>'
  };

  function icon(name, cls) {
    var body = ICONS[name] || ICONS.spark;
    return '<svg class="ico ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
  }

  function haptic(ms) { U.haptic(ms); }

  /* ---------- 토스트 ---------- */
  var toastTimer = null;
  function toast(msg, kind) {
    if (!hasDom) return;
    var node = $('#toast');
    if (!node) {
      node = document.createElement('div');
      node.id = 'toast';
      node.className = 'toast';
      node.setAttribute('role', 'status');
      document.body.appendChild(node);
    }
    node.textContent = msg;
    node.dataset.kind = kind || 'info';
    node.classList.add('is-on');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { node.classList.remove('is-on'); }, kind === 'error' ? 3600 : 2400);
  }

  /* ---------- 바텀시트 ---------- */
  function closeSheet() {
    if (!hasDom) return;
    var root = $('#sheet');
    if (!root) return;
    root.classList.remove('is-on');
    document.body.classList.remove('no-scroll');
    setTimeout(function () { if (root && root.parentNode) root.parentNode.removeChild(root); }, 220);
  }

  function openSheet(opts) {
    if (!hasDom) return null;
    closeSheet();
    var wrap = document.createElement('div');
    wrap.id = 'sheet';
    wrap.className = 'sheet';
    wrap.innerHTML =
      '<div class="sheet__backdrop" data-close="1"></div>' +
      '<div class="sheet__panel" role="dialog" aria-modal="true">' +
      '<div class="sheet__grab"></div>' +
      '<div class="sheet__head"><h2>' + U.esc(opts.title || '') + '</h2>' +
      '<button class="iconbtn" data-close="1" aria-label="닫기">' + icon('close') + '</button></div>' +
      '<div class="sheet__body">' + (opts.body || '') + '</div></div>';
    document.body.appendChild(wrap);
    document.body.classList.add('no-scroll');
    requestAnimationFrame(function () { wrap.classList.add('is-on'); });
    wrap.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-close]')) closeSheet();
    });
    if (typeof opts.onMount === 'function') opts.onMount(wrap);
    return wrap;
  }

  function confirmSheet(message, okLabel) {
    return new Promise(function (resolve) {
      var wrap = openSheet({
        title: '확인',
        body: '<p class="sheet__text">' + U.esc(message) + '</p>' +
          '<div class="row gap8 mt16"><button class="btn btn--ghost grow" data-act="no">취소</button>' +
          '<button class="btn grow" data-act="yes">' + U.esc(okLabel || '확인') + '</button></div>'
      });
      if (!wrap) return resolve(false);
      wrap.addEventListener('click', function (ev) {
        var act = ev.target.closest('[data-act]');
        if (!act) return;
        closeSheet();
        resolve(act.getAttribute('data-act') === 'yes');
      });
    });
  }

  /* ---------- 목록 다시 그리기 ---------- */
  function paint(el, html) {
    if (!el) return;
    el.innerHTML = html;
  }

  /* ---------- 폼 도우미 ---------- */
  function chips(name, options, selected, opts) {
    opts = opts || {};
    var set = {};
    (selected || []).forEach(function (v) { set[v] = 1; });
    return '<div class="chips" data-chipgroup="' + U.esc(name) + '"' + (opts.multi === false ? ' data-single="1"' : '') + '>' +
      options.map(function (o) {
        var value = typeof o === 'string' ? o : o.value;
        var label = typeof o === 'string' ? o : o.label;
        return '<button type="button" class="chip' + (set[value] ? ' is-on' : '') + '" data-chip="' + U.esc(value) + '"' +
          ' aria-pressed="' + (set[value] ? 'true' : 'false') + '">' + U.esc(label) + '</button>';
      }).join('') + '</div>';
  }

  function readChips(groupEl) {
    if (!groupEl) return [];
    return $$('.chip.is-on', groupEl).map(function (c) { return c.getAttribute('data-chip'); });
  }

  function toggleChip(chipEl) {
    var group = chipEl.parentNode;
    var single = group.getAttribute('data-single') === '1';
    if (single) {
      $$('.chip', group).forEach(function (c) {
        c.classList.remove('is-on');
        c.setAttribute('aria-pressed', 'false');
      });
    }
    var on = !chipEl.classList.contains('is-on');
    chipEl.classList.toggle('is-on', on);
    chipEl.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  /* ---------- 아바타 (프로필 사진 · 프레임 · 배경 · 배지) ----------
   * UI.avatar('🏸', 40) 처럼 이모지만 넘기던 예전 호출도 그대로 동작하고,
   * 프로필/매칭프로필 객체를 넘기면 꾸민 모습으로 그립니다. */
  function avatar(input, size, opts) {
    opts = opts || {};
    var D = BM.domain;
    var spec;
    if (typeof input === 'string' || input == null) {
      spec = D ? D.normalizeAvatar({ avatar: input || '🏸' }) : { emoji: input || '🏸', frame: 'basic', bg: 'plain', badge: '' };
    } else {
      spec = D ? D.avatarOf(input) : { emoji: '🏸', frame: 'basic', bg: 'plain', badge: '' };
    }
    var px = Math.max(18, Math.round(size || 40));
    var inner = spec.photo
      ? '<img class="avx__img" src="' + U.esc(spec.photo) + '" alt="" loading="lazy">'
      : '<span class="avx__emoji">' + U.esc(spec.emoji) + '</span>';
    var badge = spec.badge && opts.badge !== false
      ? '<i class="avx__badge" aria-hidden="true">' + U.esc(spec.badge) + '</i>'
      : '';
    return '<span class="avx avx--' + U.esc(spec.frame) + ' avx--bg-' + U.esc(spec.bg) +
      '" data-frame="' + U.esc(spec.frame) + '" data-bg="' + U.esc(spec.bg) +
      '" style="--av:' + px + 'px">' +
      '<span class="avx__inner">' + inner + '</span>' + badge + '</span>';
  }

  function emptyState(iconName, title, sub, actionHtml) {
    return '<div class="empty">' + icon(iconName || 'spark') +
      '<p class="empty__t">' + U.esc(title) + '</p>' +
      (sub ? '<p class="empty__s">' + U.esc(sub) + '</p>' : '') +
      (actionHtml || '') + '</div>';
  }

  function stars(n, max) {
    max = max || 5;
    var out = '';
    for (var i = 1; i <= max; i++) out += '<span class="' + (i <= n ? 'star is-on' : 'star') + '">★</span>';
    return out;
  }

  /* 화면에 보여 줄 사람 정보 — 매칭 카드가 있으면 그걸, 없으면 프로필 행을 씁니다 */
  function person(state, key) {
    var D = BM.domain;
    var list = (state && state.data && state.data.matchProfiles) || [];
    var mp = list.filter(function (m) { return m.userKey === key; })[0];
    if (mp) return mp;
    var idx = (state && state.data && state.data.idx) || (D ? D.index([]) : { byType: {} });
    var p = D ? D.profileOf(idx, key) : {};
    return {
      nick: p.nick || '회원', level: p.level || '', discipline: p.discipline || '',
      bio: p.bio || '', theme: p.theme || null
    };
  }

  BM.ui = {
    $: $, $$: $$, icon: icon, toast: toast, haptic: haptic,
    openSheet: openSheet, closeSheet: closeSheet, confirm: confirmSheet,
    paint: paint, chips: chips, readChips: readChips, toggleChip: toggleChip,
    avatar: avatar, emptyState: emptyState, stars: stars, person: person, hasDom: hasDom
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
