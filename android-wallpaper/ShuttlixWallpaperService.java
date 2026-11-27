/*
 * ShuttlixWallpaperService — 셔틀릭스 폰 바탕화면(안드로이드 라이브 배경화면)
 *
 *  어두운 스튜디오 위에 내가 고른 커스텀 라켓이 천천히 떠 있고,
 *  바탕화면을 톡 치면 그 자리에서 불꽃·얼음·번개 셔틀콕 임팩트가 터집니다.
 *
 *  · 색은 WallpaperStore(SharedPreferences)에서 읽습니다 — 웹앱의 '📱 폰 바탕화면으로
 *    설정하기' 가 넘긴 값이 그대로 반영되고, 떠 있는 동안 값이 바뀌면 다시 읽습니다.
 *  · 프레임은 16ms 간격(60fps)으로 그리고, 배경(그라데이션·조명·바닥)은 화면 크기가
 *    바뀔 때 한 번만 비트맵에 구워 매 프레임 다시 만들지 않습니다.
 *  · lockHardwareCanvas(하드웨어 가속)로 그리고, 안 되는 기기는 lockCanvas 로 물러납니다.
 */
package io.github.csw42060713_byte.badminton;

import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffColorFilter;
import android.graphics.RadialGradient;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.SweepGradient;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.service.wallpaper.WallpaperService;
import android.view.MotionEvent;
import android.view.SurfaceHolder;

import java.util.Random;

public class ShuttlixWallpaperService extends WallpaperService {

    /* 프레임 간격 — 60fps(16ms) 목표 */
    private static final long FRAME_MS = 16L;

    private static int withAlpha(int color, int a) {
        return (color & 0x00FFFFFF) | ((a & 0xFF) << 24);
    }

    private static int mix(int a, int b, float t) {
        if (t < 0f) t = 0f;
        if (t > 1f) t = 1f;
        int ar = (a >> 16) & 0xFF, ag = (a >> 8) & 0xFF, ab = a & 0xFF, aa = (a >>> 24) & 0xFF;
        int br = (b >> 16) & 0xFF, bg = (b >> 8) & 0xFF, bb = b & 0xFF, ba = (b >>> 24) & 0xFF;
        int r = (int) (ar + (br - ar) * t);
        int g = (int) (ag + (bg - ag) * t);
        int bl = (int) (ab + (bb - ab) * t);
        int al = (int) (aa + (ba - aa) * t);
        return (al << 24) | (r << 16) | (g << 8) | bl;
    }

    static int lighten(int c, float t) { return mix(c, 0xFFFFFFFF, t); }

    static int darken(int c, float t) { return mix(c, 0xFF000000, t); }

    @Override
    public Engine onCreateEngine() {
        return new RacketEngine();
    }

    /* ============================================================ */

    private class RacketEngine extends Engine
            implements SharedPreferences.OnSharedPreferenceChangeListener {

        private final Handler handler = new Handler(Looper.getMainLooper());
        private final Random rnd = new Random();

        private boolean visible = false;
        private int w = 0, h = 0;
        private float density = 2f;

        private Bitmap bg = null;
        private Bitmap glow = null;

        private WallpaperConfig cfg = WallpaperConfig.defaults();
        private boolean paintsReady = false;

        private long startedAt = 0L;
        private long lastFrameAt = 0L;
        private float t = 0f;
        private float xOffset = 0.5f;

        /* ---- 화면에 그리는 도구 ---- */
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint glowPaint = new Paint(Paint.ANTI_ALIAS_FLAG);

        private Paint framePaint, rimPaint, innerRimPaint, stringPaint, jointPaint,
                shaftPaint, conePaint, gripPaint, wrapPaint, capPaint, stencilPaint,
                accentPaint, prismPaint, ringPaint, motePaint, linePaint, shadowPaint;

        private final Path headPath = new Path();
        private final Path shaftPath = new Path();
        private final Path conePath = new Path();
        private final Path scratch = new Path();
        private final RectF rect = new RectF();
        private final Matrix matrix = new Matrix();

        /* ---- 임팩트 파티클 ---- */
        private static final int MAX_P = 260;
        private final float[] pX = new float[MAX_P];
        private final float[] pY = new float[MAX_P];
        private final float[] pVX = new float[MAX_P];
        private final float[] pVY = new float[MAX_P];
        private final float[] pLife = new float[MAX_P];
        private final float[] pMax = new float[MAX_P];
        private final float[] pSize = new float[MAX_P];
        private final float[] pGrav = new float[MAX_P];
        private final int[] pCol = new int[MAX_P];

        /* ---- 충격 링 ---- */
        private static final int MAX_R = 6;
        private final float[] rX = new float[MAX_R];
        private final float[] rY = new float[MAX_R];
        private final float[] rAge = new float[MAX_R];
        private final float[] rMaxR = new float[MAX_R];
        private final int[] rCol = new int[MAX_R];

        /* ---- 날아가는 셔틀콕 ---- */
        private static final int MAX_S = 8;
        private final float[] sX = new float[MAX_S];
        private final float[] sY = new float[MAX_S];
        private final float[] sVX = new float[MAX_S];
        private final float[] sVY = new float[MAX_S];
        private final float[] sRot = new float[MAX_S];
        private final float[] sAge = new float[MAX_S];
        private final int[] sCol = new int[MAX_S];
        private int sSlot = 0;

        /* ---- 떠다니는 먼지 ---- */
        private static final int MOTES = 26;
        private final float[] mX = new float[MOTES];
        private final float[] mY = new float[MOTES];
        private final float[] mV = new float[MOTES];
        private final float[] mS = new float[MOTES];
        private final float[] mP = new float[MOTES];

        private final Runnable ticker = new Runnable() {
            @Override
            public void run() {
                if (!visible) return;
                long frameStart = SystemClock.uptimeMillis();
                draw();
                long spent = SystemClock.uptimeMillis() - frameStart;
                long delay = FRAME_MS - spent;
                if (delay < 1) delay = 1;
                handler.postDelayed(this, delay);
            }
        };

        @Override
        public void onCreate(SurfaceHolder holder) {
            super.onCreate(holder);
            setTouchEventsEnabled(true);
            setOffsetNotificationsEnabled(true);
            density = getResources().getDisplayMetrics().density;
            if (density <= 0f) density = 2f;
            startedAt = SystemClock.uptimeMillis();
            cfg = WallpaperStore.config(ShuttlixWallpaperService.this);
            WallpaperStore.prefs(ShuttlixWallpaperService.this)
                    .registerOnSharedPreferenceChangeListener(this);
            initMotes();
            for (int i = 0; i < MAX_P; i++) pLife[i] = 0f;
            for (int i = 0; i < MAX_R; i++) rAge[i] = 1f;
            for (int i = 0; i < MAX_S; i++) sAge[i] = 1f;
        }

        @Override
        public void onDestroy() {
            handler.removeCallbacks(ticker);
            try {
                WallpaperStore.prefs(ShuttlixWallpaperService.this)
                        .unregisterOnSharedPreferenceChangeListener(this);
            } catch (RuntimeException ignored) {
            }
            recycle();
            super.onDestroy();
        }

        @Override
        public void onVisibilityChanged(boolean v) {
            visible = v;
            handler.removeCallbacks(ticker);
            if (v) {
                lastFrameAt = 0L;
                handler.post(ticker);
            }
        }

        @Override
        public void onSurfaceChanged(SurfaceHolder holder, int format, int width, int height) {
            super.onSurfaceChanged(holder, format, width, height);
            w = width;
            h = height;
            buildBackground();
            paintsReady = false;
        }

        @Override
        public void onSurfaceDestroyed(SurfaceHolder holder) {
            visible = false;
            handler.removeCallbacks(ticker);
            recycle();
            super.onSurfaceDestroyed(holder);
        }

        @Override
        public void onOffsetsChanged(float offsetX, float offsetY, float stepX, float stepY,
                                     int pixelsX, int pixelsY) {
            super.onOffsetsChanged(offsetX, offsetY, stepX, stepY, pixelsX, pixelsY);
            xOffset = offsetX;
        }

        @Override
        public void onSharedPreferenceChanged(SharedPreferences prefs, String key) {
            if (WallpaperStore.KEY_CONFIG.equals(key)) {
                cfg = WallpaperConfig.parse(prefs.getString(key, null));
                paintsReady = false;
            }
        }

        @Override
        public void onTouchEvent(MotionEvent event) {
            if (event.getActionMasked() == MotionEvent.ACTION_DOWN) {
                spawnImpact(event.getX(), event.getY());
            }
            super.onTouchEvent(event);
        }

        private void recycle() {
            if (bg != null) {
                bg.recycle();
                bg = null;
            }
            if (glow != null) {
                glow.recycle();
                glow = null;
            }
        }

        /* ============================================================
         * 배경(스튜디오) — 화면 크기가 바뀔 때 한 번만 굽습니다
         * ============================================================ */
        private void buildBackground() {
            if (w <= 0 || h <= 0) return;
            if (bg != null) bg.recycle();
            bg = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
            Canvas c = new Canvas(bg);
            Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);

            /* 위아래로 깊어지는 스튜디오 벽 */
            p.setShader(new LinearGradient(0f, 0f, 0f, h,
                    new int[]{0xFF070A0E, 0xFF101A20, 0xFF0A1216, 0xFF04070A},
                    new float[]{0f, 0.38f, 0.72f, 1f}, Shader.TileMode.CLAMP));
            c.drawRect(0f, 0f, w, h, p);

            /* 위쪽 키 라이트 */
            p.setShader(new RadialGradient(w * 0.5f, h * 0.16f, w * 0.98f,
                    new int[]{0x3A2E5060, 0x10203040, 0x00000000},
                    new float[]{0f, 0.5f, 1f}, Shader.TileMode.CLAMP));
            c.drawRect(0f, 0f, w, h * 0.7f, p);

            /* 바닥 스포트라이트 풀 */
            float poolY = h * 0.79f;
            p.setShader(new RadialGradient(w * 0.5f, poolY, w * 0.72f,
                    new int[]{0x3A86B8D8, 0x143A5A6E, 0x00000000},
                    new float[]{0f, 0.45f, 1f}, Shader.TileMode.CLAMP));
            c.drawRect(0f, h * 0.5f, w, h, p);

            /* 바닥 반사 원 + 얇은 링 */
            p.setShader(null);
            p.setStyle(Paint.Style.STROKE);
            p.setStrokeWidth(1.2f * density);
            p.setColor(0x2A9FD4EA);
            rect.set(w * 0.5f - w * 0.42f, poolY - h * 0.09f, w * 0.5f + w * 0.42f, poolY + h * 0.09f);
            c.drawOval(rect, p);
            p.setStrokeWidth(1f * density);
            p.setColor(0x18CFE6F2);
            rect.set(w * 0.5f - w * 0.30f, poolY - h * 0.055f, w * 0.5f + w * 0.30f, poolY + h * 0.055f);
            c.drawOval(rect, p);

            /* 바닥으로 모이는 옅은 선(스튜디오 바닥 결) */
            p.setColor(0x0FFFFFFF);
            p.setStrokeWidth(1f);
            float vy = h * 0.30f;
            for (int i = -4; i <= 4; i++) {
                float bx = w * 0.5f + i * w * 0.24f;
                c.drawLine(w * 0.5f, vy, bx, h, p);
            }
            p.setColor(0x14FFFFFF);
            for (int i = 0; i < 4; i++) {
                float yy = h * 0.62f + i * h * 0.11f;
                c.drawLine(0f, yy, w, yy, p);
            }

            /* 가장자리 비네팅 */
            p.setStyle(Paint.Style.FILL);
            p.setShader(new RadialGradient(w * 0.5f, h * 0.46f, Math.max(w, h) * 0.78f,
                    new int[]{0x00000000, 0x22000000, 0x88000000},
                    new float[]{0f, 0.55f, 1f}, Shader.TileMode.CLAMP));
            c.drawRect(0f, 0f, w, h, p);
            p.setShader(null);
        }

        /* ============================================================
         * 그리기 도구 — 색이 바뀔 때 한 번 만듭니다
         * ============================================================ */
        private void ensurePaints() {
            if (paintsReady) return;

            WallpaperConfig k = cfg;

            framePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            framePaint.setStyle(Paint.Style.STROKE);
            framePaint.setStrokeWidth(k.hoop * 1.12f);
            framePaint.setShader(new LinearGradient(-k.rx, -k.ry, k.rx * 0.9f, k.ry * 1.05f,
                    new int[]{lighten(k.frameColor, 0.58f), k.frameColor, darken(k.frameColor, 0.5f)},
                    new float[]{0f, 0.42f, 1f}, Shader.TileMode.CLAMP));

            rimPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            rimPaint.setStyle(Paint.Style.STROKE);
            rimPaint.setStrokeWidth(1.5f);
            rimPaint.setColor(withAlpha(lighten(k.frameColor, 0.72f), 150));

            innerRimPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            innerRimPaint.setStyle(Paint.Style.STROKE);
            innerRimPaint.setStrokeWidth(1.8f);
            innerRimPaint.setColor(withAlpha(darken(k.frameColor, 0.62f), 150));

            stringPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            stringPaint.setStyle(Paint.Style.STROKE);
            stringPaint.setStrokeWidth(0.85f);
            stringPaint.setColor(withAlpha(k.stringColor, 165));

            jointPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            jointPaint.setStyle(Paint.Style.FILL);
            jointPaint.setColor(darken(k.frameColor, 0.28f));

            shaftPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            shaftPaint.setStyle(Paint.Style.FILL);
            shaftPaint.setShader(new LinearGradient(-k.shaftR, 0f, k.shaftR, 0f,
                    new int[]{darken(k.frameColor, 0.42f), lighten(k.frameColor, 0.42f),
                            darken(k.frameColor, 0.5f)},
                    new float[]{0f, 0.45f, 1f}, Shader.TileMode.CLAMP));

            conePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            conePaint.setStyle(Paint.Style.FILL);
            conePaint.setShader(new LinearGradient(-k.gripR, 0f, k.gripR, 0f,
                    new int[]{darken(k.frameColor, 0.55f), lighten(k.frameColor, 0.2f),
                            darken(k.frameColor, 0.6f)},
                    new float[]{0f, 0.42f, 1f}, Shader.TileMode.CLAMP));

            gripPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            gripPaint.setStyle(Paint.Style.FILL);
            gripPaint.setShader(new LinearGradient(-k.gripR, 0f, k.gripR, 0f,
                    new int[]{lighten(k.gripColor, 0.3f), k.gripColor, darken(k.gripColor, 0.45f)},
                    new float[]{0f, 0.5f, 1f}, Shader.TileMode.CLAMP));

            wrapPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            wrapPaint.setStyle(Paint.Style.STROKE);
            wrapPaint.setStrokeWidth(1.1f);
            wrapPaint.setColor(k.gripColor2 != 0
                    ? withAlpha(k.gripColor2, 165)
                    : withAlpha(darken(k.gripColor, 0.45f), 130));

            capPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            capPaint.setStyle(Paint.Style.FILL);
            capPaint.setColor(darken(k.gripColor, 0.55f));

            stencilPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            stencilPaint.setStyle(Paint.Style.FILL);
            stencilPaint.setColor(withAlpha(k.stencilColor, 78));

            accentPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            accentPaint.setStyle(Paint.Style.STROKE);
            accentPaint.setStrokeWidth(2f);
            accentPaint.setColor(withAlpha(k.effectColor, 150));

            prismPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            prismPaint.setStyle(Paint.Style.STROKE);
            prismPaint.setStrokeWidth(2.4f);

            linePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            linePaint.setStyle(Paint.Style.STROKE);
            linePaint.setStrokeWidth(1.2f);
            linePaint.setColor(withAlpha(k.effectColor, 160));

            shadowPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            shadowPaint.setColorFilter(new PorterDuffColorFilter(0xFF000000, PorterDuff.Mode.SRC_IN));

            ringPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            ringPaint.setStyle(Paint.Style.STROKE);

            motePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            motePaint.setStyle(Paint.Style.FILL);

            /* 터치 임팩트 색 — 라켓 효과를 그대로 따라갑니다 */
            int kind = k.impactKind();
            int glowCol;
            if (kind == 1) glowCol = 0xFFFF6A1E;
            else if (kind == 2) glowCol = 0xFFA9E8FF;
            else if (kind == 3) glowCol = 0xFF8FD0FF;
            else glowCol = 0xFFE8F5C8;

            if (glow == null) glow = buildGlowSprite();
            glowPaint.setColorFilter(new PorterDuffColorFilter(
                    glowCol & 0x00FFFFFF, PorterDuff.Mode.SRC_IN));
            glowPaint.setAlpha(90);

            headPath.reset();
            float irx = k.rx - k.hoop * 0.78f;
            float iry = k.ry - k.hoop * 0.78f;
            headPath.addOval(new RectF(-irx, -iry, irx, iry), Path.Direction.CW);

            paintsReady = true;
        }

        private Bitmap buildGlowSprite() {
            int n = 96;
            Bitmap b = Bitmap.createBitmap(n, n, Bitmap.Config.ARGB_8888);
            Canvas c = new Canvas(b);
            Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
            p.setShader(new RadialGradient(n / 2f, n / 2f, n / 2f,
                    new int[]{0xFFFFFFFF, 0xB0FFFFFF, 0x30FFFFFF, 0x00FFFFFF},
                    new float[]{0f, 0.32f, 0.65f, 1f}, Shader.TileMode.CLAMP));
            c.drawCircle(n / 2f, n / 2f, n / 2f, p);
            return b;
        }

        /* ============================================================
         * 한 프레임
         * ============================================================ */
        private void draw() {
            SurfaceHolder holder = getSurfaceHolder();
            if (holder == null || w <= 0 || h <= 0) return;

            long now = SystemClock.uptimeMillis();
            float dt = lastFrameAt == 0L ? 0.016f : (now - lastFrameAt) / 1000f;
            if (dt > 0.05f) dt = 0.05f;
            if (dt <= 0f) dt = 0.016f;
            lastFrameAt = now;
            t = (now - startedAt) / 1000f;

            if (bg == null || bg.getWidth() != w || bg.getHeight() != h) buildBackground();
            ensurePaints();

            Canvas c = null;
            try {
                c = holder.lockHardwareCanvas();
            } catch (RuntimeException e) {
                c = null;
            }
            if (c == null) {
                try {
                    c = holder.lockCanvas();
                } catch (RuntimeException e) {
                    return;
                }
            }
            if (c == null) return;
            try {
                render(c, dt);
            } catch (RuntimeException e) {
                /* 한 프레임이 실패해도 배경화면은 계속 떠 있어야 합니다 */
            } finally {
                try {
                    holder.unlockCanvasAndPost(c);
                } catch (RuntimeException ignored) {
                }
            }
        }

        private void render(Canvas c, float dt) {
            c.drawColor(0xFF04060A);
            if (bg != null) c.drawBitmap(bg, 0f, 0f, null);

            drawMotes(c, dt);

            /* 라켓 배치 — 화면 높이의 62%, 넓이도 넘지 않게 */
            float scale = h * 0.62f / cfg.totalLength();
            float wide = w * 0.86f / (2f * (cfg.rx + cfg.hoop));
            if (scale > wide) scale = wide;

            float cx = w * 0.5f + (xOffset - 0.5f) * w * 0.07f;
            float cy = h * 0.46f;
            float bob = (float) Math.sin(t * 0.85f) * 7f * density;
            float tilt = (float) Math.sin(t * 0.48f + 0.6f) * 2.4f;

            drawContactShadow(c, cx, cy, scale, bob);

            c.save();
            c.translate(cx, cy + bob);
            c.rotate(tilt);
            c.scale(scale, scale);
            c.translate(0f, -(cfg.shaftLen + cfg.gripLen) / 2f);

            drawEffectsBehind(c);
            drawRacket(c);
            drawEffectsFront(c);
            c.restore();

            updateRings(c, dt);
            updateParticles(c, dt);
            updateShuttles(c, dt);
        }

        /* ---------- 바닥 그림자 ---------- */
        private void drawContactShadow(Canvas c, float cx, float cy, float scale, float bob) {
            if (glow == null) return;
            float bottom = cy + bob + (cfg.totalLength() / 2f + 14f) * scale;  /* 그립 끝 바로 아래 바닥 */
            float rw = cfg.rx * scale * 1.15f;
            rect.set(cx - rw, bottom - rw * 0.26f, cx + rw, bottom + rw * 0.26f);
            shadowPaint.setAlpha(120);
            c.drawBitmap(glow, null, rect, shadowPaint);
        }

        /* ---------- 라켓(단위: mm) ---------- */
        private void drawRacket(Canvas c) {
            WallpaperConfig k = cfg;
            RectF head = new RectF(-k.rx, -k.ry, k.rx, k.ry);

            /* 헤드 테두리 */
            c.drawOval(head, framePaint);

            /* 거트 17×19 — 헤드 안쪽만 보이게 자름 */
            float irx = k.rx - k.hoop * 0.78f;
            float iry = k.ry - k.hoop * 0.78f;
            c.save();
            c.clipPath(headPath);
            int nv = 15, nh = 17;
            for (int i = 1; i < nv; i++) {
                float x = -irx + (2f * irx) * i / nv;
                c.drawLine(x, -iry, x, iry, stringPaint);
            }
            for (int j = 1; j < nh; j++) {
                float y = -iry + (2f * iry) * j / nh;
                c.drawLine(-irx, y, irx, y, stringPaint);
            }
            c.restore();

            /* 스텐실 */
            drawStencil(c);

            /* T 조인트 */
            rect.set(-13f, k.ry - 7f, 13f, k.ry + 11f);
            c.drawRoundRect(rect, 5f, 5f, jointPaint);

            /* 샤프트 */
            float y0 = k.ry + 2f;
            float y1 = k.ry + k.shaftLen;
            float sw = k.shaftR * 2.1f;
            shaftPath.reset();
            shaftPath.moveTo(-sw * 0.55f, y0);
            shaftPath.lineTo(sw * 0.55f, y0);
            shaftPath.lineTo(sw * 0.42f, y1);
            shaftPath.lineTo(-sw * 0.42f, y1);
            shaftPath.close();
            c.drawPath(shaftPath, shaftPaint);

            /* 콘(프론트 캡) */
            float gw = k.gripR * 2f;
            float coneEnd = y1 + 20f;
            conePath.reset();
            conePath.moveTo(-sw * 0.42f, y1);
            conePath.lineTo(sw * 0.42f, y1);
            conePath.lineTo(gw * 0.46f, coneEnd);
            conePath.lineTo(-gw * 0.46f, coneEnd);
            conePath.close();
            c.drawPath(conePath, conePaint);

            /* 그립 + 감은 나선 */
            float gripTop = coneEnd - 2f;
            float gripBot = gripTop + k.gripLen;
            rect.set(-gw / 2f, gripTop, gw / 2f, gripBot);
            c.drawRoundRect(rect, 7f, 7f, gripPaint);

            c.save();
            c.clipRect(rect);
            int wraps = 15;
            for (int i = 0; i < wraps; i++) {
                float y = gripTop + k.gripLen * i / (float) wraps;
                c.drawLine(-gw / 2f, y + 3f, gw / 2f, y - 7f, wrapPaint);
            }
            c.restore();

            /* 엔드 캡 */
            rect.set(-gw / 2f, gripBot - 4f, gw / 2f, gripBot + 3.5f);
            c.drawRoundRect(rect, 4f, 4f, capPaint);

            /* 테두리 마감(안쪽 그늘 → 바깥 하이라이트) */
            c.drawOval(head, innerRimPaint);
            c.drawOval(head, rimPaint);
        }

        private void drawStencil(Canvas c) {
            WallpaperConfig k = cfg;
            if ("none".equals(k.stencil)) return;
            float rx = k.rx * 0.42f, ry = k.ry * 0.42f;
            Path p = scratch;
            p.reset();
            if ("crown".equals(k.stencil)) {
                p.moveTo(-rx, ry * 0.55f);
                p.lineTo(-rx, -ry * 0.15f);
                p.lineTo(-rx * 0.5f, ry * 0.25f);
                p.lineTo(0f, -ry * 0.5f);
                p.lineTo(rx * 0.5f, ry * 0.25f);
                p.lineTo(rx, -ry * 0.15f);
                p.lineTo(rx, ry * 0.55f);
                p.close();
            } else if ("bolt".equals(k.stencil)) {
                p.moveTo(rx * 0.28f, -ry);
                p.lineTo(-rx * 0.35f, ry * 0.12f);
                p.lineTo(rx * 0.05f, ry * 0.12f);
                p.lineTo(-rx * 0.2f, ry);
                p.lineTo(rx * 0.45f, -ry * 0.18f);
                p.lineTo(rx * 0.02f, -ry * 0.18f);
                p.close();
            } else if ("shuttle".equals(k.stencil)) {
                p.addCircle(0f, -ry * 0.55f, rx * 0.2f, Path.Direction.CW);
                p.moveTo(-rx * 0.5f, ry * 0.75f);
                p.lineTo(-rx * 0.16f, -ry * 0.3f);
                p.lineTo(rx * 0.16f, -ry * 0.3f);
                p.lineTo(rx * 0.5f, ry * 0.75f);
                p.close();
            } else {                                   /* X */
                p.moveTo(-rx, -ry * 0.7f);
                p.lineTo(rx, ry * 0.7f);
                p.moveTo(rx, -ry * 0.7f);
                p.lineTo(-rx, ry * 0.7f);
                linePaint.setColor(withAlpha(k.stencilColor, 70));
                linePaint.setStrokeWidth(9f);
                c.drawPath(p, linePaint);
                linePaint.setStrokeWidth(1.2f);
                return;
            }
            c.drawPath(p, stencilPaint);
        }

        /* ---------- 효과(라켓 뒤) ---------- */
        private void drawEffectsBehind(Canvas c) {
            WallpaperConfig k = cfg;
            if ("none".equals(k.effect)) {
                glowPaint.setAlpha(26);
            } else {
                glowPaint.setAlpha((int) (74 + 22 * Math.sin(t * 2.1f)));
            }
            float gr = k.ry * 1.5f;
            rect.set(-gr, -gr * 1.08f, gr, gr * 1.08f);
            if (glow != null) c.drawBitmap(glow, null, rect, glowPaint);
        }

        /* ---------- 효과(라켓 앞) ---------- */
        private void drawEffectsFront(Canvas c) {
            WallpaperConfig k = cfg;
            String fx = k.effect;
            if ("none".equals(fx)) return;

            if ("speed".equals(fx)) {
                c.save();
                c.rotate(t * 62f);
                for (int i = 0; i < 3; i++) {
                    float pad = 5f + i * 7f;
                    rect.set(-k.rx - pad, -k.ry - pad, k.rx + pad, k.ry + pad);
                    accentPaint.setAlpha(120 - i * 34);
                    c.drawArc(rect, i * 120f, 74f, false, accentPaint);
                }
                c.restore();
            } else if ("prism".equals(fx)) {
                SweepGradient sg = new SweepGradient(0f, 0f, new int[]{
                        0xFFFF8080, 0xFFFFE07A, 0xFF7AFFA8, 0xFF7AD8FF,
                        0xFFB47AFF, 0xFFFF80C8, 0xFFFF8080}, null);
                matrix.setRotate(t * 36f);
                sg.setLocalMatrix(matrix);
                prismPaint.setShader(sg);
                prismPaint.setAlpha(130);
                rect.set(-k.rx - 3f, -k.ry - 3f, k.rx + 3f, k.ry + 3f);
                c.drawOval(rect, prismPaint);
            } else if ("spark".equals(fx) || "thunder".equals(fx)) {
                int bolts = "thunder".equals(fx) ? 6 : 5;
                for (int i = 0; i < bolts; i++) {
                    double a = Math.toRadians(i * (360.0 / bolts) + Math.sin(t * 1.4f + i) * 9.0);
                    float bx = (float) Math.cos(a) * (k.rx + k.hoop * 0.4f);
                    float by = (float) Math.sin(a) * (k.ry + k.hoop * 0.4f);
                    float len = (float) (10.0 + 9.0 * Math.abs(Math.sin(t * 5.3f + i * 1.7f)));
                    ScratchBolt(c, bx, by, (float) Math.cos(a), (float) Math.sin(a), len,
                            withAlpha(k.effectColor, 150));
                }
            } else if ("ice".equals(fx)) {
                for (int i = 0; i < 6; i++) {
                    double a = Math.toRadians(i * 60.0 + t * 8.0);
                    float bx = (float) Math.cos(a) * (k.rx + 6f);
                    float by = (float) Math.sin(a) * (k.ry + 6f);
                    c.save();
                    c.translate(bx, by);
                    c.rotate(i * 60f + t * 10f);
                    scratch.reset();
                    scratch.moveTo(0f, -7f);
                    scratch.lineTo(3.2f, 0f);
                    scratch.lineTo(0f, 7f);
                    scratch.lineTo(-3.2f, 0f);
                    scratch.close();
                    linePaint.setStyle(Paint.Style.FILL);
                    linePaint.setColor(withAlpha(0xFFEAFBFF, 120));
                    c.drawPath(scratch, linePaint);
                    linePaint.setStyle(Paint.Style.STROKE);
                    linePaint.setColor(withAlpha(k.effectColor, 200));
                    linePaint.setStrokeWidth(0.8f);
                    c.drawPath(scratch, linePaint);
                    c.restore();
                }
            } else if ("fire".equals(fx) || "blaze".equals(fx)) {
                int tongues = 7;
                for (int i = 0; i < tongues; i++) {
                    float fx2 = -k.rx * 0.78f + (1.56f * k.rx) * i / (tongues - 1f);
                    float base = (float) (Math.sqrt(Math.max(0f,
                            1f - (fx2 / k.rx) * (fx2 / k.rx))) * k.ry);
                    float flick = (float) (7.0 + 9.0 * Math.abs(Math.sin(t * 6.2f + i * 1.3f)));
                    scratch.reset();
                    scratch.moveTo(fx2 - 7f, -base + 6f);
                    scratch.quadTo(fx2, -base - flick, fx2 + 7f, -base + 6f);
                    scratch.close();
                    linePaint.setStyle(Paint.Style.FILL);
                    linePaint.setColor(withAlpha(0xFFFF7A2F, 110));
                    c.drawPath(scratch, linePaint);
                    linePaint.setColor(withAlpha(0xFFFFD27A, 90));
                    scratch.reset();
                    scratch.moveTo(fx2 - 3.4f, -base + 5f);
                    scratch.quadTo(fx2, -base - flick * 0.62f, fx2 + 3.4f, -base + 5f);
                    scratch.close();
                    c.drawPath(scratch, linePaint);
                }
            }
        }

        private void ScratchBolt(Canvas c, float x, float y, float dx, float dy, float len, int color) {
            float nx = -dy, ny = dx;
            scratch.reset();
            scratch.moveTo(x, y);
            scratch.lineTo(x + dx * len * 0.42f + nx * 3.6f, y + dy * len * 0.42f + ny * 3.6f);
            scratch.lineTo(x + dx * len * 0.62f - nx * 2.4f, y + dy * len * 0.62f - ny * 2.4f);
            scratch.lineTo(x + dx * len, y + dy * len);
            linePaint.setStrokeWidth(1.2f);
            linePaint.setColor(color);
            c.drawPath(scratch, linePaint);
        }

        /* ============================================================
         * 터치 임팩트
         * ============================================================ */
        private void spawnImpact(float x, float y) {
            int kind = cfg.impactKind();
            int[] cols;
            if (kind == 1) {
                cols = new int[]{0xFFFFF1C9, 0xFFFFD27A, 0xFFFF7A2F, 0xFFFF4A18};
            } else if (kind == 2) {
                cols = new int[]{0xFFFFFFFF, 0xFFEAFBFF, 0xFFA9E8FF, 0xFF6FC8F0};
            } else if (kind == 3) {
                cols = new int[]{0xFFFFFFFF, 0xFFFFF7B0, 0xFFB9E4FF, 0xFF7FD8FF};
            } else {
                cols = new int[]{0xFFFFFFFF, 0xFFC6F24E, 0xFFF2C14E, 0xFFEAFBFF};
            }

            int n = 34;
            for (int i = 0; i < n; i++) {
                int slot = -1;
                for (int j = 0; j < MAX_P; j++) {
                    if (pLife[j] <= 0f) { slot = j; break; }
                }
                if (slot < 0) break;
                double a = (Math.PI * 2.0) * i / n + (rnd.nextDouble() - 0.5) * 0.24;
                float speed = (300f + rnd.nextFloat() * 620f) * density * 0.6f;
                pX[slot] = x;
                pY[slot] = y;
                pVX[slot] = (float) Math.cos(a) * speed;
                pVY[slot] = (float) Math.sin(a) * speed - 110f * density;
                pGrav[slot] = 1250f * density;
                pMax[slot] = 0.5f + rnd.nextFloat() * 0.5f;
                pLife[slot] = pMax[slot];
                pSize[slot] = (2.0f + rnd.nextFloat() * 4.2f) * density;
                pCol[slot] = cols[i % cols.length];
            }

            /* 충격 링 2장 — 큰 링 + 안쪽 링 */
            spawnRing(x, y, cols[1], Math.min(w, h) * 0.30f);
            spawnRing(x, y, cols[0], Math.min(w, h) * 0.17f);

            /* 셔틀콕 하나가 튀어 나갑니다 */
            int slot = sSlot % MAX_S;
            sSlot++;
            sX[slot] = x;
            sY[slot] = y;
            float dir = rnd.nextFloat() < 0.5f ? -1f : 1f;
            sVX[slot] = dir * (220f + rnd.nextFloat() * 240f) * density * 0.6f;
            sVY[slot] = -(360f + rnd.nextFloat() * 260f) * density * 0.6f;
            sRot[slot] = 0f;
            sAge[slot] = 0f;
            sCol[slot] = cols[0];
        }

        private void spawnRing(float x, float y, int color, float maxR) {
            for (int i = 0; i < MAX_R; i++) {
                if (rAge[i] >= 1f || rAge[i] < 0f) {
                    rX[i] = x;
                    rY[i] = y;
                    rAge[i] = 0f;
                    rMaxR[i] = maxR;
                    rCol[i] = color;
                    return;
                }
            }
        }

        private void updateRings(Canvas c, float dt) {
            for (int i = 0; i < MAX_R; i++) {
                if (rAge[i] >= 1f) continue;
                rAge[i] += dt / 0.42f;
                float p = rAge[i];
                if (p >= 1f) continue;
                float ease = 1f - (1f - p) * (1f - p);
                float radius = rMaxR[i] * ease;
                ringPaint.setStrokeWidth(Math.max(0.6f, 7f * (1f - p)) * density);
                ringPaint.setColor(withAlpha(rCol[i], (int) (170 * (1f - p))));
                c.drawCircle(rX[i], rY[i], radius, ringPaint);
                ringPaint.setStrokeWidth(Math.max(0.4f, 3f * (1f - p)) * density);
                ringPaint.setColor(withAlpha(0xFFFFFFFF, (int) (120 * (1f - p))));
                c.drawCircle(rX[i], rY[i], radius * 0.86f, ringPaint);
            }
        }

        private void updateParticles(Canvas c, float dt) {
            paint.setStyle(Paint.Style.FILL);
            for (int i = 0; i < MAX_P; i++) {
                if (pLife[i] <= 0f) continue;
                pLife[i] -= dt;
                if (pLife[i] <= 0f) continue;
                float drag = 1f - 2.1f * dt;
                if (drag < 0.6f) drag = 0.6f;
                pVX[i] *= drag;
                pVY[i] = pVY[i] * drag + pGrav[i] * dt;
                pX[i] += pVX[i] * dt;
                pY[i] += pVY[i] * dt;
                float ratio = pLife[i] / pMax[i];
                float radius = pSize[i] * (0.35f + 0.65f * ratio);
                /* 바깥 번짐 + 알맹이 — 불티처럼 보이게 */
                paint.setColor(withAlpha(pCol[i], (int) (60 * ratio)));
                c.drawCircle(pX[i], pY[i], radius * 2.4f, paint);
                paint.setColor(withAlpha(pCol[i], (int) (235 * ratio)));
                c.drawCircle(pX[i], pY[i], radius, paint);
            }
        }

        private void updateShuttles(Canvas c, float dt) {
            for (int i = 0; i < MAX_S; i++) {
                if (sAge[i] >= 1f) continue;
                sAge[i] += dt / 0.85f;
                if (sAge[i] >= 1f) continue;
                sVY[i] += 900f * density * dt;
                sVX[i] *= (1f - 1.1f * dt);
                sX[i] += sVX[i] * dt;
                sY[i] += sVY[i] * dt;
                sRot[i] += 320f * dt;

                float fade = 1f - sAge[i];
                float sc = (0.9f + sAge[i] * 0.9f) * density;
                c.save();
                c.translate(sX[i], sY[i]);
                c.rotate(sRot[i]);
                /* 깃(원뿔) */
                scratch.reset();
                scratch.moveTo(0f, 0f);
                scratch.lineTo(-3.6f * sc, -11f * sc);
                scratch.lineTo(3.6f * sc, -11f * sc);
                scratch.close();
                paint.setStyle(Paint.Style.FILL);
                paint.setColor(withAlpha(0xFFF3F7EF, (int) (200 * fade)));
                c.drawPath(scratch, paint);
                /* 코르크 */
                paint.setColor(withAlpha(sCol[i], (int) (240 * fade)));
                c.drawCircle(0f, 0f, 2.6f * sc, paint);
                c.restore();
            }
        }

        /* ---------- 떠다니는 먼지 ---------- */
        private void initMotes() {
            for (int i = 0; i < MOTES; i++) {
                mX[i] = rnd.nextFloat();
                mY[i] = rnd.nextFloat();
                mV[i] = 0.006f + rnd.nextFloat() * 0.02f;
                mS[i] = 0.7f + rnd.nextFloat() * 1.8f;
                mP[i] = rnd.nextFloat() * 6.28f;
            }
        }

        private void drawMotes(Canvas c, float dt) {
            motePaint.setStyle(Paint.Style.FILL);
            for (int i = 0; i < MOTES; i++) {
                mY[i] -= mV[i] * dt;
                if (mY[i] < -0.02f) {
                    mY[i] = 1.02f;
                    mX[i] = rnd.nextFloat();
                }
                float x = mX[i] * w + (float) Math.sin(t * 0.4f + mP[i]) * 14f * density;
                float y = mY[i] * h;
                int a = (int) (26 + 46 * Math.abs(Math.sin(t * 0.7f + mP[i])));
                motePaint.setColor(withAlpha(0xFFCFE6F2, a));
                c.drawCircle(x, y, mS[i] * density, motePaint);
            }
        }
    }
}
