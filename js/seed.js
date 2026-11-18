/* ============================================================
 * seed.js — 초기 데이터 + '샘플 글' 판별
 *
 * 예전에는 체험용 가상 인물(나래·콕집사·셔틀버스 등)과 샘플 기록을
 * 앱 첫 실행 때 넣어 두었지만, 이제는 넣지 않습니다.
 *   - 앱은 빈 상태로 시작하고, 사용자가 직접 남긴 기록만 쌓입니다.
 *   - 화면·저장소 코드는 이 파일의 인터페이스(build/ME)만 봅니다.
 *     build()는 시트와 같은 26칸 '행 배열' 목록을 돌려주며, 지금은 항상 []입니다.
 *     (빈 배열이어도 화면·파생 데이터 계산이 그대로 동작해야 합니다.)
 *
 * 한 가지 더: 예전 버전을 설치했던 기기/시트에는 그때 들어간 샘플 글이
 * 남아 있을 수 있습니다. 그래서 그 글들의 본문을 SAMPLE_POSTS /
 * SAMPLE_REPLIES 로 기억해 두고, 커뮤니티에서는 isSamplePost()로 걸러
 * 내보내지 않으며 저장소가 한 번 청소(purge)합니다.
 *   - 사용자가 직접 쓴 글은 본문이 같지 않으므로 지워지지 않습니다.
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};

  /* 로컬(체험) 모드에서 '나'를 가리키는 사용자ID.
   * 이미 이 기기에 저장된 행들이 이 값을 쓰고 있으므로 바꾸지 않습니다. */
  var ME = 'demo_me';

  /* 데모 선수 목록은 비어 있습니다. (예전 export 이름만 유지) */
  var PLAYERS = [];

  /* 예전 앱이 커뮤니티에 자동으로 넣던 샘플 글 (본문 그대로) */
  var SAMPLE_POSTS = [
    '오늘 21:17로 이겼다! 마지막 5점은 전부 드라이브로 따냈어요 🔥',
    '나래울 클럽 토요일 오픈! 초보분들 환영합니다. 9시에 모여요.',
    '풋워크 영상 보고 육각 스텝 시작했는데 3일 만에 다리가 터졌습니다 ㅋㅋ 그래도 빨라진 느낌',
    '팔꿈치가 아파서 이번 주는 쉽니다. 다들 스매시 연습할 때 그립 힘 꼭 빼세요!',
    '네트 앞에서 무조건 헤어핀만 넣는 습관 고치는 중. 리프트 섞으니 상대가 흔들린다.',
    '경기 남부에서 드라이브 연습 파트너 구해요. 아직 초보지만 꾸준히 나가요!'
  ];

  /* 예전 앱이 샘플 글에 달아 두던 샘플 답글 */
  var SAMPLE_REPLIES = [
    '드라이브 그거 진짜 무기 되던데요. 축하합니다!',
    '다음에 한 게임 붙어봐요 ㅎㅎ',
    'ㅋㅋㅋ 저도 시작했어요. 이틀째 다리 아픔',
    '저도 팔꿈치 때문에 고생했어요. 밴드 차니까 좀 나아졌어요.'
  ];

  function norm(text) {
    return String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
  }

  var SAMPLE_SET = {};
  SAMPLE_POSTS.concat(SAMPLE_REPLIES).forEach(function (t) { SAMPLE_SET[norm(t)] = true; });

  function isSampleText(text) {
    var key = norm(text);
    return !!(key && SAMPLE_SET[key]);
  }

  /* 글 한 건이 예전 앱이 넣은 샘플/데모 글인지 */
  function isSamplePost(post) {
    if (!post) return false;
    return isSampleText(post.text);
  }

  function build(now) {      /* now 인자는 예전 호출부 호환용 */
    return [];
  }

  BM.seed = {
    build: build, ME: ME, PLAYERS: PLAYERS,
    SAMPLE_POSTS: SAMPLE_POSTS, SAMPLE_REPLIES: SAMPLE_REPLIES,
    isSampleText: isSampleText, isSamplePost: isSamplePost
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
