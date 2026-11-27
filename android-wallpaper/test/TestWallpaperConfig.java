/*
 * WallpaperConfig 단독 검증 — 안드로이드 없이 javac/java 로 돌립니다.
 *
 *   javac -d out WallpaperConfig.java TestWallpaperConfig.java
 *   java -cp out TestWallpaperConfig
 *
 * 웹앱(js/wallpaper.js)이 넘기는 JSON 을 그대로 넣어 배경화면이 쓰는 값을 확인합니다.
 */
import io.github.csw42060713_byte.badminton.WallpaperConfig;

public class TestWallpaperConfig {

    static int pass = 0, fail = 0;

    static void check(boolean ok, String name) {
        if (ok) {
            pass++;
        } else {
            fail++;
            System.out.println("  ✗ " + name);
        }
    }

    static void eq(int a, int b, String name) {
        check(a == b, name + " → 기대 " + Integer.toHexString(b) + ", 실제 " + Integer.toHexString(a));
    }

    static void eqS(String a, String b, String name) {
        check(a != null && a.equals(b), name + " → 기대 " + b + ", 실제 " + a);
    }

    public static void main(String[] args) {
        System.out.println("[WallpaperConfig] 셔틀릭스 폰 바탕화면 설정 검증");

        /* 1) 값이 없으면 기본 라켓(매트 블랙 · 형광 라임 · 블랙 그립) */
        WallpaperConfig d = WallpaperConfig.parse(null);
        eqS(d.frame, "matte", "기본 프레임");
        eq(d.frameColor, 0xFF23272B, "매트 블랙 색");
        eq(d.stringColor, 0xFFC6F24E, "형광 라임 색");
        eqS(d.grip, "black", "기본 그립");
        eq(d.gripColor, 0xFF1D2124, "블랙 그립 색");
        eqS(d.effect, "none", "기본 효과");

        /* 2) 웹앱이 실제로 보내는 모양 그대로 */
        String web = "{\"v\":1,\"body\":\"smash\",\"name\":\"스매시 맥스\","
                + "\"frame\":\"onyx\",\"frameColor\":\"#1b1f26\","
                + "\"string\":\"cobalt\",\"stringColor\":\"#3f7cf2\","
                + "\"grip\":\"twotone\",\"gripColor\":\"#c6f24e\",\"gripColor2\":\"#20252b\","
                + "\"stencil\":\"crown\",\"stencilColor\":\"#f2c14e\","
                + "\"effect\":\"ice\",\"effectColor\":\"#a9e8ff\"}";
        WallpaperConfig w = WallpaperConfig.parse(web);
        eqS(w.body, "smash", "바디");
        eqS(w.name, "스매시 맥스", "이름");
        eq(w.frameColor, 0xFF1B1F26, "오닉스 티타늄");
        eq(w.stringColor, 0xFF3F7CF2, "코발트 블루");
        eq(w.gripColor, 0xFFC6F24E, "투톤 네온 첫 색");
        eq(w.gripColor2, 0xFF20252B, "투톤 네온 둘째 색");
        eq(w.stencilColor, 0xFFF2C14E, "왕관 금색");
        eqS(w.effect, "ice", "얼음 효과");
        eq(w.effectColor, 0xFFA9E8FF, "얼음 색");
        eq(w.impactKind(), 2, "얼음 → 얼음 임팩트");

        /* 3) 색이 깨져도 팔레트로 되살아난다(웹앱이 새 파츠를 넣어도 안전) */
        WallpaperConfig broken = WallpaperConfig.parse(
                "{\"frame\":\"red\",\"frameColor\":\"#zzzzzz\",\"string\":\"gold\",\"grip\":\"towel\"}");
        eq(broken.frameColor, 0xFFE0433C, "파이어 레드 팔레트");
        eq(broken.stringColor, 0xFFF2C14E, "골드 팔레트");
        eq(broken.gripColor, 0xFFD9C6A5, "타월 베이지 팔레트");

        /* 4) 모르는 파츠 이름은 기본으로 */
        WallpaperConfig unknown = WallpaperConfig.parse("{\"frame\":\"neon-rainbow\",\"body\":\"proto9\"}");
        eqS(unknown.frame, "neon-rainbow", "이름은 보존");
        eq(unknown.frameColor, 0xFF23272B, "모르는 프레임 → 매트 블랙");
        eqS(unknown.body, "power77", "모르는 바디 → 파워 77");

        /* 5) #rgb · #aarrggbb 도 읽는다 */
        eq(WallpaperConfig.color("#abc", 0), 0xFFAABBCC, "#rgb");
        eq(WallpaperConfig.color("#80FF0000", 0), 0x80FF0000, "#aarrggbb");
        eq(WallpaperConfig.color("", 0x11223344), 0x11223344, "빈 색 → 기본");

        /* 6) 효과 → 터치 임팩트 */
        eq(WallpaperConfig.parse("{\"effect\":\"fire\"}").impactKind(), 1, "불꽃");
        eq(WallpaperConfig.parse("{\"effect\":\"blaze\"}").impactKind(), 1, "블레이즈 → 불꽃");
        eq(WallpaperConfig.parse("{\"effect\":\"thunder\"}").impactKind(), 3, "번개");
        eq(WallpaperConfig.parse("{\"effect\":\"spark\"}").impactKind(), 3, "스파크 → 번개");
        eq(WallpaperConfig.parse("{\"effect\":\"prism\"}").impactKind(), 0, "프리즘 → 기본 스매시");

        /* 7) 바디 4종 비율(웹앱 BODIES 와 같은 값) */
        WallpaperConfig aero = WallpaperConfig.parse("{\"body\":\"aero\"}");
        check(Math.abs(aero.shaftLen - 241) < 0.01, "에어로 샤프트 241mm");
        check(Math.abs(aero.gripR - 13.2f) < 0.01, "에어로 그립 13.2mm");
        WallpaperConfig ctrl = WallpaperConfig.parse("{\"body\":\"control\"}");
        check(Math.abs(ctrl.gripLen - 204) < 0.01, "컨트롤 롱 그립 204mm");
        WallpaperConfig power = WallpaperConfig.parse("{\"body\":\"power77\"}");
        check(Math.abs(power.totalLength() - 674f) < 3f, "전체 길이 약 674mm (" + power.totalLength() + ")");
        check(Math.abs(aero.rx - 97f) < 0.01 && Math.abs(ctrl.ry - 120f) < 0.01, "헤드 비율");

        /* 8) 키가 많아도 필요한 값만 읽는다(중첩·숫자 섞임) */
        WallpaperConfig extra = WallpaperConfig.parse(
                "{\"v\":1,\"nested\":{\"x\":1},\"frame\":\"navy\",\"frameColor\":\"#22409f\",\"extra\":\"zzz\"}");
        eqS(extra.frame, "navy", "중첩 무시 · 프레임");
        eq(extra.frameColor, 0xFF22409F, "로열 네이비");

        System.out.println((fail == 0 ? "  ✓ " : "  ✗ ") + pass + "/" + (pass + fail) + " 통과");
        if (fail > 0) System.exit(1);
    }
}
