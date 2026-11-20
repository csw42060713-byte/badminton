# PLAY_STORE_GUIDE.md — 플레이 스토어 출시 가이드 (TWA · Bubblewrap)

배드민턴 분석 앱을 **구글 플레이 스토어**에 올리기까지의 순서입니다.
웹 앱(PWA)을 그대로 안드로이드 앱으로 감싸는 **TWA(Trusted Web Activity)** 방식이라
앱 코드는 웹사이트 한 벌만 관리하면 됩니다.

```
웹 앱(이 폴더)  →  GitHub Pages 배포  →  Bubblewrap으로 .aab 빌드  →  Play Console 등록
```

---

## 0. 지금 준비된 것

| 항목 | 파일 | 상태 |
|---|---|---|
| 개인정보처리방침 | `privacy.html` | ✅ 작성 완료 · 앱 안(MY·시작화면)에서 링크 |
| 계정 삭제(탈퇴) | `MY > 개인정보 · 계정 > 회원 탈퇴` | ✅ 확인 시트 + 시트(서버) 삭제 |
| 서버 삭제 API | `APPS_SCRIPT_BRIDGE.gs` `deleteAccount` | ✅ 본인 토큰 검증 · 본인 행만 삭제 |
| 앱 아이콘 512 | `store-assets/icon-512.png` | ✅ 512×512 PNG |
| 대표 그래픽 | `store-assets/feature-graphic-1024x500.png` | ✅ 1024×500 PNG |
| 스크린샷 4장 | `store-assets/screenshot-1~4-*.png` | ✅ 540×960 (405×720 화면, 9:16) |
| 웹 앱 매니페스트 | `manifest.webmanifest` (+ 호환용 `manifest.json`) | ✅ id/scope/start_url/icons/maskable/screenshots |
| 디지털 자산 링크 | `.well-known/assetlinks.json` | ⚠️ **지문 넣기 필요**(아래 2단계) |
| Bubblewrap 설정 | `twa-manifest.json` | ⚠️ 지문·키 경로 확인 후 사용 |

그래픽을 다시 만들려면:

```bash
python3 store-assets/make-store-assets.py          # 아이콘 · 대표 그래픽
python3 store-assets/capture-screenshots.py        # 스크린샷(로컬 서버 + 모바일 뷰포트)
```

> 스크린샷 촬영 스크립트는 Chromium(Playwright)이 필요합니다.
> 없다면 이미 만들어진 `store-assets/screenshot-*.png`를 그대로 쓰세요.

---

## 1. 준비물

| 도구 | 버전 | 확인 |
|---|---|---|
| Google Play 개발자 계정 | — | 1회 25달러 등록, 신원 확인 필요 |
| JDK | 17 | `java -version` |
| Node.js | 18 이상 | `node -v` |
| Android SDK (build-tools 34+) | — | Android Studio 또는 `sdkmanager` |
| Bubblewrap CLI | 최신 | `npm i -g @bubblewrap/cli` |

```bash
npm i -g @bubblewrap/cli
bubblewrap --version
```

> Play Console 개발자 계정은 **개인 계정이면 신원 확인(신분증·주소)과 테스트 요건**이 있습니다.
> 2023년 이후 개인 개발자 계정은 프로덕션 출시 전 **테스터 12명 × 14일** 내부/비공개 테스트를
> 거쳐야 하는 경우가 있으니, 심사 일정을 넉넉히 잡으세요.

---

## 2. 서명 키 만들고 SHA-256 지문 넣기 ★가장 중요

TWA는 **앱 서명 지문**과 사이트의 `assetlinks.json`이 일치해야 주소창 없이 전체 화면으로 뜹니다.
지문이 틀리면 앱 위에 브라우저 주소창이 남습니다.

### 2-1. 업로드 키(keystore) 만들기 — 한 번만, 절대 잃어버리지 마세요

```bash
keytool -genkeypair -v \
  -keystore android.keystore \
  -alias android \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=Badminton App, OU=Dev, O=Personal, L=Seoul, S=Seoul, C=KR"
```

- 파일(`android.keystore`)과 비밀번호를 **안전한 곳에 백업**하세요.
  잃어버리면 같은 패키지로 앱을 업데이트할 수 없습니다(Play 앱 서명을 쓰면 복구 여지가 있지만 번거롭습니다).
- 이 파일은 **절대 깃에 올리지 마세요**. (`.gitignore`에 `*.keystore`, `*.jks`)

### 2-2. 지문(SHA-256) 확인

```bash
keytool -list -v -keystore android.keystore -alias android
# → Certificate fingerprints:
#    SHA256: 1A:2B:3C:...   ← 콜론 포함 32쌍
```

### 2-3. `.well-known/assetlinks.json` 채우기

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "io.github.csw42060713_byte.badminton",
      "sha256_cert_fingerprints": [
        "1A:2B:3C:...(업로드 키 지문)",
        "9F:8E:7D:...(Play 앱 서명 키 지문)"
      ]
    }
  }
]
```

- **Play 앱 서명 키 지문**은 Play Console → (앱) → 설정 → **앱 무결성 → 앱 서명**에서 확인합니다.
  (앱을 한 번 업로드한 뒤에 보입니다. 두 지문을 모두 넣어 두면 테스트 빌드와 스토어 빌드가 모두 동작합니다.)
- `package_name`은 `twa-manifest.json`의 `packageId`와 **정확히 같아야** 합니다.
- 수정 후 `main`·`gh-pages`에 반영하고 아래 주소가 200으로 열리는지 확인:

```
https://csw42060713-byte.github.io/badminton/.well-known/assetlinks.json
```

> `.nojekyll` 파일이 저장소에 있어야 `.well-known` 같은 점(.) 폴더가 그대로 배포됩니다. (이미 있음)

### 2-4. 검증

```bash
# 구글 공식 검증 도구
https://developers.google.com/digital-asset-links/tools/generator
```

앱 설치 후 실기기에서 주소창이 사라지면 성공입니다.

---

## 3. TWA 빌드 (.aab 만들기)

이 저장소의 `twa-manifest.json`을 그대로 쓰거나, 마법사로 새로 만들 수 있습니다.

### 방법 A — 준비된 설정으로 빌드 (권장)

```bash
mkdir -p ~/badminton-android && cd ~/badminton-android
cp /경로/badminton/twa-manifest.json .          # 이 저장소의 설정 복사
cp /경로/badminton/android.keystore .           # 2-1에서 만든 키

bubblewrap build
```

처음 실행하면 Android SDK/JDK 경로를 묻습니다. 한 번 지정하면 저장됩니다.

결과물:

| 파일 | 용도 |
|---|---|
| `app-release-signed.apk` | 실기기 테스트용 |
| `app-release-bundle.aab` | **Play Console 업로드용** |
| `assetlinks.json` | Bubblewrap이 만든 지문 파일(사이트 것과 같은지 대조) |

### 방법 B — 처음부터 마법사로

```bash
bubblewrap init --manifest https://csw42060713-byte.github.io/badminton/manifest.webmanifest
bubblewrap build
```

물어보는 값:

| 질문 | 넣을 값 |
|---|---|
| Application name | 배드민턴 분석 |
| Short name | 배드민턴 |
| Application ID | `io.github.csw42060713_byte.badminton` (**한 번 정하면 변경 불가**) |
| Display mode | `standalone` |
| Status bar / navigation color | `#F6F8F6` (나이트 테마는 `#080B0A`) |
| Splash color | `#F6F8F6` |
| Include support for offine | Yes |
| Signing key | 새로 만들기(권장) 또는 기존 `android.keystore` |
| Key alias | `android` |

### 버전 올리기 (업데이트할 때)

- `twa-manifest.json`의 `appVersionCode`를 **1씩 증가** (같은 값으로는 업로드 거부)
- `appVersionName`은 사람이 보는 버전(`1.0.1` 등)
- 웹을 고쳤다면 `sw.js`의 `VERSION`도 함께 올리기

---

## 4. Play Console 등록

1. **Play Console → 앱 만들기**
   - 앱 이름: `배드민턴 분석` (30자 이내)
   - 기본 언어: 한국어
   - 앱 또는 게임: 앱 / 무료
   - 선언: 개발자 프로그램 정책 동의
2. **앱 콘텐츠** 메뉴의 모든 항목 채우기 (아래 4-2 ~ 4-6)
3. **테스트 → 내부 테스트**에 `.aab` 업로드 → 테스터 추가 → 실기기 설치 확인
4. **프로덕션 → 새 버전 만들기** → 출시 검토 제출

### 4-1. 스토어 등록정보

| 항목 | 규격 | 이 저장소 파일 |
|---|---|---|
| 앱 아이콘 | 512×512 PNG (32bit) | `store-assets/icon-512.png` |
| 대표 그래픽 | 1024×500 PNG/JPG | `store-assets/feature-graphic-1024x500.png` |
| 휴대전화 스크린샷 | 2~8장, 320~3840px, 16:9~9:16 | `store-assets/screenshot-1-matching.png` … `-4-my.png` (540×960) |
| 앱 이름 | 30자 | 배드민턴 분석 |
| 간단한 설명 | 80자 | 아래 문구 사용 |
| 자세한 설명 | 4000자 | 아래 문구 사용 |

**간단한 설명(초안)**

```
일지 한 줄이면 AI가 드릴·루틴을, 급수에 맞춰 1:1 파트너까지 찾아 주는 배드민턴 앱
```

**자세한 설명(초안)**

```
배드민턴, 치고 나서 뭘 해야 할지 막막할 때.

■ 일지 한 번이면 AI 코치
오늘의 컨디션·운동 시간·경기 점수·아픈 부위만 고르면, AI가 맞춤 처방과 추천 드릴 3개,
이번 주 루틴까지 만들어 줍니다. 기록이 쌓일수록 더 정확해져요.

■ 급수에 맞는 1:1 매칭
급수·종목·지역·성별로 조건을 좁혀 같이 칠 파트너를 찾습니다. 마음에 드는 상대에게
신청하고, 수락되면 바로 1:1 대화로 이어집니다.

■ 커뮤니티와 코치 피드백
오늘의 경기 이야기, 장비 고민, 클럽 모집까지. 멘토(코치)에게 폼과 훈련을 물어보고
피드백을 받을 수 있어요.

■ 하트로 쓰는 부담 없는 이용
출석 체크와 짧은 광고로 하트를 모아 매칭·꾸미기에 사용합니다. 현금 결제 없이 시작하세요.

■ 내 기록은 내 것
비밀번호는 되돌릴 수 없는 해시로만 저장하고, 이메일은 공개 ID로 바꿔 보여 줍니다.
MY > 회원 탈퇴로 언제든 계정과 기록을 직접 지울 수 있어요.
```

### 4-2. 개인정보처리방침 URL

```
https://csw42060713-byte.github.io/badminton/privacy.html
```

로그인 없이 열려야 합니다(현재 그렇게 동작). **계정 삭제 안내** 섹션은
`https://csw42060713-byte.github.io/badminton/privacy.html#delete-account` 로 바로 링크할 수 있습니다.

### 4-3. 데이터 보안(Data safety) 설문 — 이 앱 기준 답

| 질문 | 답 |
|---|---|
| 앱이 사용자 데이터를 수집/공유하나요? | **예(수집)** · 공유는 아니오 |
| 데이터 암호화 전송 | 예 (HTTPS) |
| 사용자가 데이터 삭제를 요청할 수 있나요? | **예** — 인앱(MY > 회원 탈퇴) + 이메일 |
| 수집 항목 | 이메일 주소(계정 관리), 이름/닉네임(앱 기능), 사진(선택·앱 기능), 메시지(앱 기능), 건강 및 피트니스(앱 기능), 앱 활동(앱 기능) |
| 목적 | 앱 기능, 계정 관리 — **광고·분석 목적 사용 안 함** |
| 제3자 공유 | 없음 (Google Sheets/Apps Script는 **처리위탁**이며 서비스 제공자로 표시) |
| 광고 | 앱에 제3자 광고 SDK 없음 → “광고 없음” |

> 나중에 AdMob 등 광고 SDK를 넣으면 데이터 보안과 방침을 **반드시 함께 갱신**해야 합니다.

### 4-4. 콘텐츠 등급 설문

- 카테고리: **소셜/커뮤니케이션** 또는 **스포츠**(실제 등록 시 선택)
- 사용자 간 소통(채팅·커뮤니티) 있음 → **예**
- 위치 공유 기능 없음, 폭력·성적 콘텐츠 없음, 구매 없음
- 결과: 보통 전체이용가 또는 12세 이상

### 4-5. 타깃층과 광고

- 타깃 연령: **만 13세 이상**(방침상 만 14세 미만 가입 불가로 안내 중)
- "어린이 대상"으로 선택하지 마세요( Families 정책 요건이 추가됩니다).
- 광고 포함: **아니오**

### 4-6. 앱 액세스 권한

- 로그인 필요: **예** (이메일 또는 Google)
- 심사자가 쓸 테스트 계정을 **반드시 제공**: 예) `review@example.com` / 임시 비밀번호.
  시트 브리지에 계정을 미리 만들어 두고, 심사 후 비밀번호를 바꾸세요.
  “로그인 없이 둘러보기”도 있지만 심사관은 로그인 화면을 먼저 만납니다.

---

## 5. 계정 삭제 요구사항 (Play 정책)

플레이 정책상 계정을 만드는 앱은 **앱 안에서 계정을 삭제할 수 있어야** 하고,
**웹에서도 삭제를 요청할 수 있는 경로**를 안내해야 합니다. 이 앱은 둘 다 갖췄습니다.

- 인앱: `MY > 개인정보 · 계정 > 회원 탈퇴` → “탈퇴” 입력 → 탈퇴하기
  - 시트(서버)의 내 행과 이 기기의 세션·캐시를 함께 삭제
- 웹: `privacy.html#delete-account` (이메일 요청 안내)
- 서버: `APPS_SCRIPT_BRIDGE.gs`의 `deleteAccount` (본인 세션 토큰 검증 후 자기 행만)

---

## 6. 시트(Apps Script) 반영 — 이번 변경분

> **현재 상태 (2026-11-19 기준):** `deleteAccount` · `AUTH_SECRET` 우선 사용 · `recordId` 보정이 들어간
> 코드가 **버전 81로 이미 배포되어 `/exec` 주소가 살아 있습니다.**
> 앱의 `js/auth.js` 기본 주소도 이 배포를 가리키므로, 아래는 **시트 코드를 다시 고쳤을 때만** 따라 하면 됩니다.

시트 코드(`APPS_SCRIPT_BRIDGE.gs`)를 수정했다면 시트 쪽도 다시 배포해야 동작합니다.

1. 시트 → 확장 프로그램 → Apps Script → `APPS_SCRIPT_BRIDGE.gs` 전체를 새 내용으로 교체
2. 프로젝트 설정 → 스크립트 속성에 **`SHEET_ID`** 와 **`AUTH_SECRET`** 값 확인
   - `SHEET_ID`: 공개 저장소에 시트 주소가 올라가지 않도록 반드시 속성으로만 넣습니다.
   - `AUTH_SECRET`: 없으면 코드의 임시 기본값이 쓰입니다. **공개 전에는 반드시 긴 임의 문자열로 설정**하세요.
   - 이미 있으면 그대로 두세요. **바꾸면 기존 비밀번호·세션·공개 ID가 모두 무효**가 됩니다.
3. 편집기에서 `selfCheck()` 실행 → 로그에 `AUTH_SECRET 설정됨` / `SHEET_ID 설정됨` 이 찍히는지 확인
4. 배포 → 배포 관리 → 기존 배포 선택 → **수정** → 버전: **새 버전** → 배포
   - “새 배포”를 만들면 `/exec` 주소가 바뀌어 앱의 기본 주소와 어긋납니다.
5. 앱에서 MY > 시트 연결이 정상인지, 회원 탈퇴가 동작하는지 확인

> 버전 81 배포 확인 방법: 브라우저에서 `/exec?action=ping` 을 열면 `{"ok":true,...}` 가 보입니다.
> gog CLI로도 반영할 수 있습니다(연결돼 있는 경우):
> ```bash
> gog appscript --help
> ```

---

## 7. 출시 전 체크리스트

- [ ] `https://csw42060713-byte.github.io/badminton/` 가 열린다
- [ ] `privacy.html` 이 로그인 없이 열린다
- [ ] `.well-known/assetlinks.json` 이 200이고 `package_name`·지문이 맞다
- [ ] 앱에서 회원 탈퇴 → 시작화면으로 돌아가고, 다시 로그인되지 않는다
- [ ] 시트에서 그 계정의 행이 `삭제`로 비워졌다
- [ ] `sw.js` VERSION이 올라갔다 (예: `bm-v1.7.0`)
- [ ] `styles.css?v=` 캐시 키도 함께 올라갔다 (예: `20261119-1`)
- [ ] 오프라인에서 앱을 열어도 화면이 뜨고, 저장한 기록이 연결 후 자동으로 전송된다
- [ ] MY 화면에서 계정 안내가 실제 모드(기기 저장/시트)와 맞게 나온다
- [ ] `twa-manifest.json`의 `appVersionCode`가 이전 업로드보다 크다
- [ ] `android.keystore` 백업 완료, 깃에는 없음
- [ ] 스크린샷 4장이 실제 앱 화면이고 9:16(현재 540×960)이다
- [ ] 심사용 테스트 계정을 준비했다

---

## 8. 자주 겪는 문제

| 증상 | 원인 | 해결 |
|---|---|---|
| 앱 위에 주소창이 남는다 | assetlinks 지문 불일치 | 업로드 키 + Play 앱 서명 키 **둘 다** 넣고 재배포 |
| 흰 화면만 뜬다 | `startUrl` 경로 오류 | `/badminton/index.html` 인지 확인(끝에 `/`만 두면 404) |
| 오프라인에서 오류 페이지 | 서비스워커 미등록 | HTTPS인지, `sw.js`가 루트에 있는지 확인 |
| 업로드 거부 “버전 코드 중복” | `appVersionCode` 그대로 | +1 해서 다시 빌드 |
| 심사 반려 “개인정보처리방침 접근 불가” | URL 404/로그인 필요 | 공개 URL 확인, 로그인 없이 열리게 |
| 심사 반려 “계정 삭제 없음” | 인앱 탈퇴 미노출 | MY 화면 하단 ‘회원 탈퇴’ 확인, 심사관에게 경로 안내 |
| 시트 연결이 갑자기 안 된다 | 배포 주소 변경 | MY > 시트 연결에서 새 `/exec` 주소 저장 |

---

## 9. 참고 링크

- TWA 개요: https://developer.chrome.com/docs/android/trusted-web-activity
- Bubblewrap: https://github.com/GoogleChromeLabs/bubblewrap
- Digital Asset Links: https://developers.google.com/digital-asset-links/v1/getting-started
- Play 정책 — 계정 삭제: https://support.google.com/googleplay/android-developer/answer/13327111
- Data safety: https://support.google.com/googleplay/android-developer/answer/10787469
