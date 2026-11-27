/*
 * WallpaperSetupActivity — 웹앱의 '📱 폰 바탕화면으로 설정하기' 를 받는 문
 *
 *  웹앱은 세 가지 길로 부릅니다.
 *    ① 네이티브 브리지(WebView) — 자바스크립트가 setWallpaperConfig 를 부르면 여기로 인텐트
 *    ② 딥링크 — shuttlix://wallpaper?c=<설정 JSON>  (TWA·크롬에서 intent:// 로 실행)
 *    ③ 배경화면 선택창을 그냥 열기 — 설정값 없이 불려도 동작
 *
 *  받은 설정은 SharedPreferences 에 저장하고 곧바로 안드로이드의
 *  ACTION_CHANGE_LIVE_WALLPAPER 선택창을 띄웁니다. 화면은 그리지 않습니다(Theme.Translucent).
 */
package io.github.csw42060713_byte.badminton;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.app.WallpaperManager;

public class WallpaperSetupActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Intent intent = getIntent();
        String json = null;

        Uri data = intent == null ? null : intent.getData();
        if (data != null) {
            json = data.getQueryParameter("c");
            if (json == null) json = data.getQueryParameter("config");
        }
        if (json == null && intent != null) {
            json = intent.getStringExtra("shuttlix_config");
            if (json == null) json = intent.getStringExtra("config");
        }
        if (json != null) WallpaperStore.save(this, json);

        openLiveWallpaperChooser();
        finish();
    }

    private void openLiveWallpaperChooser() {
        ComponentName service = new ComponentName(this, ShuttlixWallpaperService.class);
        Intent change = new Intent(WallpaperManager.ACTION_CHANGE_LIVE_WALLPAPER);
        change.putExtra(WallpaperManager.EXTRA_LIVE_WALLPAPER_COMPONENT, service);
        change.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            startActivity(change);
            return;
        } catch (RuntimeException ignored) {
            /* 일부 기기(예: 삼성 일부 모델)는 위 액션이 없습니다 — 전체 목록으로 물러납니다 */
        }

        Intent chooser = new Intent(WallpaperManager.ACTION_LIVE_WALLPAPER_CHOOSER);
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            startActivity(chooser);
        } catch (RuntimeException ignored) {
            /* 배경화면 선택창도 없으면 조용히 끝냅니다 — 사용자는 폰 설정에서 고를 수 있습니다 */
        }
    }
}
