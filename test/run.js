#!/usr/bin/env node
/* ============================================================
 * test/run.js — node로 로직 테스트 실행
 *   node test/run.js
 * 브라우저가 없어도 도메인·AI·저장소 로직을 그대로 검증합니다.
 * (localStorage는 메모리 저장소로 대체됩니다)
 * ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const files = [
  'js/util.js', 'js/domain.js', 'js/routine.js', 'js/beginner.js', 'js/ai.js', 'js/seed.js', 'js/api.js',
  'js/auth.js', 'js/store.js', 'js/ui.js', 'js/smashsound.js', 'js/racket3d.js', 'js/racketcustom.js', 'js/wallpaper.js', 'js/gear.js', 'js/push.js', 'js/sharecard.js', 'js/gyms.js', 'js/nearby.js', 'js/art.js', 'js/ads.js', 'js/scoreboard.js', 'js/timer.js', 'js/report.js', 'js/pose.js', 'js/safety.js', 'js/views/profile.js', 'js/views/friends.js', 'js/views/chat.js', 'js/views/gyms.js', 'js/views/log.js', 'js/views/matching.js',
  'js/views/community.js', 'js/views/coach.js', 'js/views/my.js', 'js/views/start.js',
  'test/harness.js', 'test/fixtures.js', 'test/logic.test.js', 'test/account.test.js', 'test/release.test.js', 'test/usability.test.js',
  'test/routine.test.js', 'test/routine-choice.test.js', 'test/meet.test.js', 'test/matchrules.test.js', 'test/v113.test.js', 'test/v114.test.js', 'test/v115.test.js', 'test/v116.test.js', 'test/v117.test.js', 'test/v118.test.js', 'test/v119.test.js', 'test/v120.test.js', 'test/v122.test.js', 'test/v123.test.js', 'test/v124.test.js', 'test/v125.test.js', 'test/v126.test.js', 'test/v127.test.js', 'test/v128.test.js', 'test/v129.test.js', 'test/v130.test.js', 'test/v131.test.js', 'test/v132.test.js', 'test/v133.test.js', 'test/v134.test.js', 'test/v135.test.js', 'test/v136.test.js', 'test/v137.test.js', 'test/v137_2.test.js', 'test/v138.test.js', 'test/v138_1.test.js', 'test/v139.test.js', 'test/v139_1.test.js', 'test/v140.test.js', 'test/v140_1.test.js', 'test/v141.test.js', 'test/gyms.test.js', 'test/map5km.test.js', 'test/v142_1.test.js', 'test/v143.test.js', 'test/v144.test.js', 'test/v145.test.js', 'test/v146.test.js', 'test/v147.test.js', 'test/v148.test.js', 'test/v149.test.js', 'test/v150.test.js', 'test/ux-polish.test.js', 'test/v152.test.js', 'test/v152_2.test.js', 'test/v153.test.js', 'test/v154.test.js', 'test/v155.test.js', 'test/v156.test.js', 'test/v157.test.js', 'test/v158.test.js', 'test/v159.test.js', 'test/v160.test.js', 'test/v161.test.js', 'test/v162.test.js', 'test/v163.test.js', 'test/v164.test.js', 'test/v165.test.js', 'test/v166.test.js', 'test/v167.test.js', 'test/v168.test.js', 'test/v169.test.js', 'test/v170.test.js', 'test/v171.test.js', 'test/morning-ux.test.js', 'test/v173.test.js', 'test/v174.test.js', 'test/v175.test.js', 'test/v176.test.js', 'test/v177.test.js', 'test/v178.test.js', 'test/v179.test.js', 'test/v180.test.js', 'test/v181.test.js', 'test/v182.test.js', 'test/v183.test.js', 'test/ux1125.test.js', 'test/twa.test.js', 'test/v185.test.js', 'test/v186.test.js', 'test/v187.test.js', 'test/v188.test.js',
  'test/v189.test.js',
  'test/v190.test.js',
  'test/v191.test.js',
  'test/v192.test.js',
  'test/v193.test.js',
  'test/v194.test.js',
  'test/v195.test.js',
  'test/v196.test.js',
  'test/v197.test.js'
];

const sandbox = {
  console,
  require,                      // 계정 삭제 테스트가 파일·vm·crypto를 씁니다
  __REPO_ROOT__: root,
  setTimeout: () => 0,          // 테스트에서는 타이머를 쓰지 않습니다
  clearTimeout: () => {},
  Date, Math, JSON, Promise, Error, String, Number, Object, Array, RegExp
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
const context = vm.createContext(sandbox);

files.forEach((f) => {
  const code = fs.readFileSync(path.join(root, f), 'utf8');
  try {
    vm.runInContext(code, context, { filename: f });
  } catch (err) {
    console.error('로드 실패: ' + f + '\n  ' + err.message);
    process.exit(1);
  }
});

vm.runInContext('BM.test.run()', context)
  .then((sum) => {
    sum.results.forEach((r) => {
      console.log((r.ok ? '  ✓ ' : '  ✗ ') + r.name + (r.error ? '\n      ' + r.error : ''));
    });
    console.log('\n' + sum.passed + '/' + sum.total + ' 통과' + (sum.failed ? ' · 실패 ' + sum.failed : ''));
    process.exitCode = sum.failed ? 1 : 0;
  })
  .catch((err) => {
    console.error('테스트 실행 오류:', err);
    process.exitCode = 1;
  });
