# 📱 셔틀릭스 폰 바탕화면(안드로이드 라이브 배경화면) — 네이티브 소스

앱(`.aab`/`.apk`)을 다시 만들 때 이 폴더의 파일을 TWA(Bubblewrap) 프로젝트에 그대로 넣으면 됩니다.
웹앱 쪽은 `js/wallpaper.js` + `js/racketcustom.js` 의 `data-rk-wallpaper` 단추가 담당합니다.

## 파일

| 파일 | 하는 일 |
| --- | --- |
| `ShuttlixWallpaperService.java` | 라이브 배경화면. 어두운 스튜디오 위에 커스텀 라켓이 떠 있고, 터치하면 불꽃·얼음·번개 셔틀콕 임팩트가 60fps(16ms 루프)로 터집니다. |
| `WallpaperConfig.java` | 웹앱이 넘긴 JSON 한 줄을 읽어 색·바디 비율·터치 효과를 정합니다(안드로이드 API 없음 → javac 로 단독 검증 가능). |
| `WallpaperStore.java` | `SharedPreferences`(`shuttlix_wallpaper`) 한 칸에 설정을 보관합니다. |
| `WallpaperSetupActivity.java` | `shuttlix://wallpaper?c=<JSON>` 딥링크를 받아 설정을 저장하고 `WallpaperManager.ACTION_CHANGE_LIVE_WALLPAPER` 선택창을 엽니다. |
| `res/xml/shuttlix_wallpaper.xml` | 배경화면 정보(설명·썸네일·제작자). |
| `test/TestWallpaperConfig.java` | 설정 파싱 단독 테스트(37건). |

## TWA 프로젝트에 넣는 순서

1. Java 4개 → `app/src/main/java/<패키지 경로>/`
2. `res/xml/shuttlix_wallpaper.xml` → `app/src/main/res/xml/`
3. `res/values/strings.xml` 에 `wallpaper_description` · `wallpaper_author` 추가
4. `AndroidManifest.xml` 에 `android-wallpaper/AndroidManifest.snippet.xml` 내용 추가
   (`<uses-feature android:software.live_wallpaper required=false>` · 서비스 · 액티비티)
5. `./gradlew bundleRelease` → `jarsigner`(업로드 키) → `bundletool validate`
   테스트 APK는 `apksigner` 로 같은 키에 서명

## 웹앱과의 약속(JSON 키)

```
v · body · name · frame · frameColor · string · stringColor ·
grip · gripColor · gripColor2 · stencil · stencilColor · effect · effectColor
```

색은 `#rrggbb`. 앱은 색이 비어 있거나 깨져도 파츠 이름으로 기본 팔레트를 찾아 그리므로
웹앱이 새 파츠를 넣어도 배경화면이 검게 깨지지 않습니다.

## 검증

```
javac -encoding UTF-8 -d out WallpaperConfig.java test/TestWallpaperConfig.java
java -cp out TestWallpaperConfig     # 37/37 통과
```
