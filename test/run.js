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
  'js/util.js', 'js/domain.js', 'js/routine.js', 'js/ai.js', 'js/seed.js', 'js/api.js',
  'js/auth.js', 'js/store.js', 'js/ui.js', 'js/ads.js', 'js/views/profile.js', 'js/views/chat.js', 'js/views/log.js', 'js/views/matching.js',
  'js/views/community.js', 'js/views/coach.js', 'js/views/my.js', 'js/views/start.js',
  'test/harness.js', 'test/fixtures.js', 'test/logic.test.js', 'test/account.test.js', 'test/release.test.js', 'test/usability.test.js',
  'test/routine.test.js', 'test/meet.test.js', 'test/matchrules.test.js'
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
