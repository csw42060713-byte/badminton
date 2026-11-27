/*
 * Shuttlix — 라이브 배경화면 설정 보관소(SharedPreferences 한 칸)
 *
 *  웹앱의 '📱 폰 바탕화면으로 설정하기' 가 넘긴 JSON 을 여기 저장하고,
 *  배경화면 서비스가 이 값을 읽어 그립니다. 배경화면이 떠 있는 동안 값이 바뀌면
 *  리스너가 바로 알려 주므로, 앱에서 색을 바꾸고 한 번 더 누르면 즉시 반영됩니다.
 */
package io.github.csw42060713_byte.badminton;

import android.content.Context;
import android.content.SharedPreferences;

public final class WallpaperStore {

    public static final String PREFS = "shuttlix_wallpaper";
    public static final String KEY_CONFIG = "config";
    public static final String KEY_UPDATED = "updated_at";

    private WallpaperStore() {
    }

    public static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static void save(Context ctx, String json) {
        if (json == null || json.length() == 0) return;
        prefs(ctx).edit()
                .putString(KEY_CONFIG, json)
                .putLong(KEY_UPDATED, System.currentTimeMillis())
                .apply();
    }

    public static String load(Context ctx) {
        return prefs(ctx).getString(KEY_CONFIG, null);
    }

    public static WallpaperConfig config(Context ctx) {
        return WallpaperConfig.parse(load(ctx));
    }
}
