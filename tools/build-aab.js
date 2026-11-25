#!/usr/bin/env node
/* ============================================================
 * tools/build-aab.js — twa-manifest.json으로 Bubblewrap TWA 프로젝트(안드로이드)를 만듭니다.
 *   node tools/build-aab.js --out build-twa
 *   node tools/build-aab.js --out build-twa --version-name 1.79.0 --version-code 73
 *
 * 이 스크립트는 프로젝트만 만들고, 빌드·서명은 Gradle과 jarsigner가 합니다.
 * (Android SDK·JDK 17이 필요합니다. GitHub Actions는 .github/workflows/build-aab.yml)
 * ============================================================ */
'use strict';

function parseArgs(argv) {
  const args = { manifest: 'twa-manifest.json', out: 'build-twa' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--manifest') args.manifest = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--version-name') args.versionName = argv[++i];
    else if (a === '--version-code') args.versionCode = Number(argv[++i]);
    else if (a === '-h' || a === '--help') args.help = true;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('node tools/build-aab.js --out <폴더> [--manifest twa-manifest.json] [--version-name 1.79.0] [--version-code 73]');
    return;
  }

  const path = require('path');
  const fs = require('fs');
  const core = require('@bubblewrap/core');

  const manifestPath = path.resolve(args.manifest);
  const outDir = path.resolve(args.out);
  const json = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (args.versionName) json.appVersionName = args.versionName;
  if (args.versionCode) json.appVersionCode = args.versionCode;

  const twaManifest = new core.TwaManifest(json);
  if (typeof twaManifest.validate === 'function') {
    const problem = twaManifest.validate();
    if (problem) throw new Error('twa-manifest.json 값이 올바르지 않습니다: ' + (problem.message || problem));
  }

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const log = new core.ConsoleLog('shuttlix');
  await new core.TwaGenerator().createTwaProject(outDir, twaManifest, log, () => {});

  /* 프로젝트 안에도 같은 설정을 남깁니다 (bubblewrap 안드로이드 프로젝트 관례) */
  fs.writeFileSync(path.join(outDir, 'twa-manifest.json'), JSON.stringify(twaManifest.toJson(), null, 2) + '\n');
  console.log('TWA 프로젝트 생성: ' + outDir);
  console.log('  패키지 ' + twaManifest.packageId + ' · 버전 ' + twaManifest.appVersionName + ' (' + twaManifest.appVersionCode + ')');
}

main().catch((e) => {
  console.error(e && e.message ? e.message : e);
  process.exit(1);
});
