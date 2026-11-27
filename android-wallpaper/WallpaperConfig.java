/*
 * Shuttlix — 폰 바탕화면(라이브 배경화면) 설정값
 *
 *  웹앱(js/wallpaper.js)이 넘긴 JSON 한 줄을 그대로 읽습니다. 안드로이드 API 를 쓰지
 *  않는 순수 자바라 같은 파일을 javac 로 단독 검증할 수 있습니다.
 *
 *  받는 키(웹앱과 약속):
 *    v · body · name · frame · frameColor · string · stringColor ·
 *    grip · gripColor · gripColor2 · stencil · stencilColor · effect · effectColor
 *
 *  색은 #rrggbb 또는 #aarrggbb. 색이 없으면 파츠 이름(id)으로 기본 팔레트에서 찾습니다.
 *  (웹앱이 새 파츠를 넣어도 배경화면이 검게 깨지지 않게 하는 안전장치)
 */
package io.github.csw42060713_byte.badminton;

import java.util.HashMap;
import java.util.Map;

public final class WallpaperConfig {

    /* ---- 지금 입은 라켓 ---- */
    public String body = "power77";
    public String name = "파워 77";

    public String frame = "matte";
    public int frameColor = 0xFF23272B;

    public String string = "lime";
    public int stringColor = 0xFFC6F24E;

    public String grip = "black";
    public int gripColor = 0xFF1D2124;
    public int gripColor2 = 0;              /* 투톤 그립의 둘째 색(없으면 0) */

    public String stencil = "none";
    public int stencilColor = 0;

    public String effect = "none";
    public int effectColor = 0xFF7FD8FF;

    /* ---- 바디별 실제 규격(mm) — 웹앱 BODIES 와 같은 값 ---- */
    public float rx = 98f;
    public float ry = 120.5f;
    public float hoop = 10.4f;
    public float shaftR = 3.6f;
    public float gripR = 13.6f;
    public int shaftLen = 236;
    public int gripLen = 198;

    public WallpaperConfig() {
    }

    public static WallpaperConfig defaults() {
        return new WallpaperConfig();
    }

    /* ---------- 읽기 ---------- */

    public static WallpaperConfig parse(String json) {
        WallpaperConfig c = new WallpaperConfig();
        Map<String, String> m = flat(json);
        if (m.isEmpty()) return c;

        c.body = pick(m.get("body"), new String[]{"power77", "aero", "control", "smash"}, c.body);
        String nm = m.get("name");
        if (nm != null && nm.length() > 0 && nm.length() <= 24) c.name = nm;

        c.frame = pick(m.get("frame"), null, c.frame);
        c.frameColor = color(m.get("frameColor"), framePalette(c.frame));

        c.string = pick(m.get("string"), null, c.string);
        c.stringColor = color(m.get("stringColor"), stringPalette(c.string));

        c.grip = pick(m.get("grip"), null, c.grip);
        c.gripColor = color(m.get("gripColor"), gripPalette(c.grip));
        c.gripColor2 = color(m.get("gripColor2"), "twotone".equals(c.grip) ? 0xFF20252B : 0);

        c.stencil = pick(m.get("stencil"), new String[]{"none", "x", "bolt", "crown", "shuttle"}, c.stencil);
        c.stencilColor = color(m.get("stencilColor"), 0xFFF2C14E);

        c.effect = pick(m.get("effect"),
                new String[]{"none", "speed", "spark", "blaze", "prism", "fire", "ice", "thunder"}, c.effect);
        c.effectColor = color(m.get("effectColor"), effectPalette(c.effect));

        c.applyBody();
        return c;
    }

    /* 바디 4종의 비율 — 웹앱 js/racketcustom.js BODIES 와 같습니다 */
    public void applyBody() {
        if ("aero".equals(body)) {
            rx = 97f; ry = 119f; hoop = 9.2f; shaftR = 3.4f; gripR = 13.2f; shaftLen = 241; gripLen = 196;
        } else if ("control".equals(body)) {
            rx = 97.5f; ry = 120f; hoop = 9.9f; shaftR = 3.5f; gripR = 13.5f; shaftLen = 231; gripLen = 204;
        } else if ("smash".equals(body)) {
            rx = 95f; ry = 118f; hoop = 11.2f; shaftR = 3.8f; gripR = 13.9f; shaftLen = 245; gripLen = 190;
        } else {
            body = "power77";
            rx = 98f; ry = 120.5f; hoop = 10.4f; shaftR = 3.6f; gripR = 13.6f; shaftLen = 236; gripLen = 198;
        }
        if (name == null || name.length() == 0) name = "파워 77";
    }

    public float totalLength() { return 2f * ry + shaftLen + gripLen; }

    /* 터치 임팩트 종류 — 라켓 효과가 그대로 바탕화면 터치 색이 됩니다 */
    public int impactKind() {
        if ("fire".equals(effect) || "blaze".equals(effect)) return 1;   /* 불꽃 */
        if ("ice".equals(effect)) return 2;                              /* 얼음 */
        if ("thunder".equals(effect) || "spark".equals(effect)) return 3; /* 번개 */
        return 0;                                                        /* 기본 스매시(라임·화이트) */
    }

    /* ---------- 작은 도구들 ---------- */

    private static String pick(String v, String[] allowed, String def) {
        if (v == null) return def;
        String s = v.trim();
        if (s.length() == 0 || s.length() > 24) return def;
        if (allowed == null) return s;
        for (String a : allowed) if (a.equals(s)) return s;
        return def;
    }

    public static int color(String hex, int def) {
        if (hex == null) return def;
        String h = hex.trim();
        if (h.startsWith("#")) h = h.substring(1);
        try {
            if (h.length() == 3) {
                StringBuilder b = new StringBuilder(6);
                for (int i = 0; i < 3; i++) { b.append(h.charAt(i)).append(h.charAt(i)); }
                h = b.toString();
            }
            if (h.length() == 6) return (int) (0xFF000000L | Long.parseLong(h, 16));
            if (h.length() == 8) return (int) Long.parseLong(h, 16);
        } catch (NumberFormatException e) {
            return def;
        }
        return def;
    }

    static int framePalette(String id) {
        if ("carbon".equals(id)) return 0xFF3E4A55;
        if ("white".equals(id)) return 0xFFEEF2F4;
        if ("navy".equals(id)) return 0xFF22409F;
        if ("red".equals(id)) return 0xFFE0433C;
        if ("onyx".equals(id)) return 0xFF1B1F26;
        return 0xFF23272B;
    }

    static int stringPalette(String id) {
        if ("white".equals(id)) return 0xFFF3F7EF;
        if ("gold".equals(id)) return 0xFFF2C14E;
        if ("cobalt".equals(id)) return 0xFF3F7CF2;
        if ("pink".equals(id)) return 0xFFFF7FB0;
        return 0xFFC6F24E;
    }

    static int gripPalette(String id) {
        if ("neon".equals(id)) return 0xFFC6F24E;
        if ("mint".equals(id)) return 0xFFA8E6CF;
        if ("coral".equals(id)) return 0xFFFF9A8B;
        if ("purple".equals(id)) return 0xFF8F7BF2;
        if ("towel".equals(id)) return 0xFFD9C6A5;
        if ("twotone".equals(id)) return 0xFFC6F24E;
        return 0xFF1D2124;
    }

    static int effectPalette(String id) {
        if ("speed".equals(id)) return 0xFF7FD8FF;
        if ("spark".equals(id)) return 0xFF9FD8FF;
        if ("blaze".equals(id)) return 0xFFFF8A2F;
        if ("prism".equals(id)) return 0xFFF2C14E;
        if ("fire".equals(id)) return 0xFFFF7A2F;
        if ("ice".equals(id)) return 0xFFA9E8FF;
        if ("thunder".equals(id)) return 0xFF8FD0FF;
        return 0xFF7FD8FF;
    }

    /* 아주 단순한 '평평한' JSON 리더 — 문자열/숫자 값만 있는 우리 설정 한 줄이면 충분합니다 */
    static Map<String, String> flat(String s) {
        Map<String, String> out = new HashMap<String, String>();
        if (s == null) return out;
        int i = 0, n = s.length();
        while (i < n) {
            int k0 = s.indexOf('"', i);
            if (k0 < 0) break;
            int k1 = s.indexOf('"', k0 + 1);
            if (k1 < 0) break;
            String key = s.substring(k0 + 1, k1);
            int c = s.indexOf(':', k1 + 1);
            if (c < 0) break;
            int v = c + 1;
            while (v < n && Character.isWhitespace(s.charAt(v))) v++;
            String val;
            if (v < n && s.charAt(v) == '"') {
                int v1 = s.indexOf('"', v + 1);
                if (v1 < 0) break;
                val = s.substring(v + 1, v1);
                i = v1 + 1;
            } else {
                int v1 = v;
                while (v1 < n && s.charAt(v1) != ',' && s.charAt(v1) != '}') v1++;
                val = s.substring(v, v1).trim();
                i = v1 + 1;
            }
            if (key.length() > 0) out.put(key, val);
        }
        return out;
    }
}
