/* ============================================================
 * send-push — 배드민턴 앱(셔틀릭스) 푸시 발송 서버 함수 (bm-v1.77.0)
 *
 *   POST /functions/v1/send-push
 *   Authorization: Bearer <앱 로그인 access_token>   (필수)
 *   { "userKey": "u_...", "kind": "chat", "title": "새 채팅",
 *     "body": "민호: 오늘 7시 어때요?", "url": "#/chat/<방>", "roomId": "..." }
 *
 *   하는 일
 *     ① 로그인한 사람이 맞는지 확인하고, 그 사람 user_key 를 서버에서 찾습니다.
 *     ② 받는 사람(userKey)의 기기 토큰을 push_tokens 에서 읽습니다.
 *     ③ FCM 서비스 계정 시크릿(FCM_SERVICE_ACCOUNT_JSON)이 있으면
 *        FCM HTTP v1(messages:send)로 실제 발송합니다.
 *     ④ 시크릿이 아직 없으면 아무 것도 보내지 않고 pending_fcm_secret 만 돌려줍니다.
 *        → 앱은 이 응답을 조용히 무시하므로 채팅·신청 흐름이 절대 막히지 않습니다.
 *     ⑤ 발송 결과는 push_log 에 남깁니다(앱은 읽지 못함 · 남용 제한·중복 차단 근거).
 *
 *   안전장치
 *     · 남의 토큰을 조회하지 않습니다 — 받는 사람 user_key 의 토큰만 읽습니다.
 *     · 보낸 사람 한 명이 1시간에 60건을 넘기면 429(limit)로 멈춥니다.
 *     · 같은 사람에게 같은 글을 8초 안에 다시 보내면 duplicate 로 건너뜁니다(재시도·연타 방지).
 *     · FCM 시크릿·서비스 계정 값은 응답·로그 어디에도 남기지 않습니다.
 *
 *   필요한 시크릿 (supabase secrets set ...)
 *     FCM_SERVICE_ACCOUNT_JSON = Firebase 서비스 계정 키 JSON 전문
 *     (SUPABASE_URL · SUPABASE_ANON_KEY · SUPABASE_SERVICE_ROLE_KEY 는 자동 주입)
 *
 *   배포
 *     supabase functions deploy send-push --project-ref mwgpakntlollndfluwgg
 * ============================================================ */

// @ts-nocheck — Supabase(Deno) 런타임에서 실행됩니다. npm 의존성 없이 Web Crypto 만 씁니다.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_TOKENS = 10;          // 한 번에 보낼 기기 수 상한
const RATE_PER_HOUR = 60;       // 보낸 사람 1시간 상한
const DEDUPE_SECONDS = 8;       // 같은 글 재발송 차단
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

const KINDS = {
  chat: { title: '새 채팅', url: '#/chat' },
  appt: { title: '코트 약속 카드', url: '#/chat' },
  match: { title: '1:1 매칭 요청', url: '#/matching' },
  guest: { title: '게스트 신청', url: '#/community' },
  guest_accept: { title: '게스트 신청 수락', url: '#/community' },
  guest_reject: { title: '게스트 신청', url: '#/community' },
};

function env(name: string): string {
  try {
    return (Deno.env.get(name) || '').trim();
  } catch (_e) {
    return '';
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/* 글자 다듬기 — 제어문자 제거 · 길이 상한 (알림에 이상한 값이 실리지 않게) */
function plain(value: unknown, max: number): string {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/* 알림을 누르면 갈 곳 — 앱 안 화면(#/...)만 허용합니다 */
function appUrl(raw: unknown, fallback: string): string {
  const s = String(raw == null ? '' : raw).trim();
  const i = s.indexOf('#');
  const hash = i >= 0 ? s.slice(i) : (s.charAt(0) === '#' ? s : '');
  if (!hash) return fallback;
  const clean = hash.replace(/[\u0000-\u001f\s]/g, '').slice(0, 120);
  return /^#\/[A-Za-z0-9_\-/]*$/.test(clean) ? clean : fallback;
}

/* ---------- Supabase REST (service_role) ---------- */
function restUrl(table: string, query: string): string {
  return `${env('SUPABASE_URL')}/rest/v1/${table}${query ? '?' + query : ''}`;
}

function serviceHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function restGet(table: string, query: string): Promise<any[]> {
  const res = await fetch(restUrl(table, query), { headers: serviceHeaders() });
  if (!res.ok) throw new Error(`rest ${table} ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function restPost(table: string, rows: unknown[]): Promise<void> {
  const res = await fetch(restUrl(table, ''), {
    method: 'POST',
    headers: serviceHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`post ${table} ${res.status}`);
}

async function restDelete(table: string, query: string): Promise<void> {
  const res = await fetch(restUrl(table, query), {
    method: 'DELETE',
    headers: serviceHeaders({ Prefer: 'return=minimal' }),
  });
  if (!res.ok) throw new Error(`delete ${table} ${res.status}`);
}

/* ---------- 로그인 확인 → user_key ---------- */
async function callerKey(req: Request): Promise<string> {
  const auth = req.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return '';
  const anon = env('SUPABASE_ANON_KEY');
  const res = await fetch(`${env('SUPABASE_URL')}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return '';
  const user = await res.json().catch(() => null);
  const uid = user && (user.id || user.sub);
  if (!uid) return '';
  const rows = await restGet('app_users', `auth_uid=eq.${encodeURIComponent(uid)}&select=user_key&limit=1`);
  return rows.length ? String(rows[0].user_key || '') : '';
}

/* ---------- FCM HTTP v1 ---------- */
type ServiceAccount = { client_email: string; private_key: string; project_id: string; token_uri?: string };

let cachedToken: { value: string; exp: number } | null = null;

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlText(text: string): string {
  return b64url(new TextEncoder().encode(text));
}

function pemToDer(pem: string): Uint8Array {
  const body = String(pem || '')
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const raw = atob(body);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function serviceAccount(): ServiceAccount | null {
  const raw = env('FCM_SERVICE_ACCOUNT_JSON');
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw);
    if (!sa || !sa.client_email || !sa.private_key || !sa.project_id) return null;
    /* 붙여넣는 과정에서 \n 이 글자 그대로 들어오는 경우를 풀어 줍니다 */
    sa.private_key = String(sa.private_key).replace(/\\n/g, '\n');
    return sa as ServiceAccount;
  } catch (_e) {
    return null;
  }
}

async function fcmAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.value;

  const header = b64urlText(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64urlText(JSON.stringify({
    iss: sa.client_email,
    scope: FCM_SCOPE,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`)),
  );
  const assertion = `${header}.${claims}.${b64url(signature)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${assertion}`,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || !data.access_token) throw new Error('fcm_token');
  const exp = now + Number(data.expires_in || 3600);
  cachedToken = { value: String(data.access_token), exp };
  return cachedToken.value;
}

/* 기기 하나로 발송. 성공하면 { ok:true }, 토큰이 죽었으면 { ok:false, dead:true } */
async function sendOne(
  sa: ServiceAccount,
  access: string,
  token: string,
  title: string,
  body: string,
  url: string,
  tag: string,
): Promise<{ ok: boolean; dead: boolean; code: string }> {
  const message = {
    token,
    notification: { title, body },
    data: { url, tag, title, body },
    android: {
      priority: 'HIGH',
      notification: {
        channel_id: 'bm_chat',
        default_sound: true,
        default_vibrate_timings: true,
        tag: tag || 'bm-push',
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
    },
    apns: {
      headers: { 'apns-priority': '10' },
      payload: { aps: { sound: 'default', badge: 1, 'mutable-content': 1 } },
    },
    webpush: {
      headers: { Urgency: 'high', TTL: '3600' },
      notification: { icon: 'icons/icon-192.png', tag: tag || 'bm-push' },
      fcm_options: { link: './' },
    },
  };

  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  if (res.ok) return { ok: true, dead: false, code: 'ok' };

  const text = await res.text().catch(() => '');
  const dead = res.status === 404 || /UNREGISTERED|NOT_FOUND|INVALID_ARGUMENT/i.test(text);
  return { ok: false, dead, code: String(res.status) };
}

/* ---------- 요청 처리 ---------- */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, status: 'method' }, 405);

  let input: any = {};
  try {
    input = await req.json();
  } catch (_e) {
    return json({ ok: false, status: 'bad_json' }, 400);
  }
  input = input || {};

  const to = plain(input.userKey || input.user_key || input.to, 128);
  if (!to) return json({ ok: false, status: 'no_target' }, 400);

  const kindInput = plain(input.kind, 24).toLowerCase();
  const kind = KINDS[kindInput] ? kindInput : 'chat';
  const title = plain(input.title, 60) || KINDS[kind].title;
  const body = plain(input.body, 160);
  const url = appUrl(input.url, KINDS[kind].url);
  const tag = plain(input.tag, 40) || kind;

  /* ① 보낸 사람 확인 */
  let sender = '';
  try {
    sender = await callerKey(req);
  } catch (_e) {
    sender = '';
  }
  if (!sender) return json({ ok: false, status: 'unauthorized' }, 401);
  if (sender === to) return json({ ok: true, status: 'self', sent: 0 });

  /* ② 남용 제한 · 중복 차단 */
  try {
    const since = new Date(Date.now() - 3600 * 1000).toISOString();
    const recent = await restGet(
      'push_log',
      `sender_key=eq.${encodeURIComponent(sender)}&created_at=gte.${encodeURIComponent(since)}&select=id&limit=${RATE_PER_HOUR}`,
    );
    if (recent.length >= RATE_PER_HOUR) {
      await logRow(sender, to, kind, title, body, url, 'limit', 0, 0, {});
      return json({ ok: false, status: 'limit', sent: 0 }, 429);
    }
    const dupSince = new Date(Date.now() - DEDUPE_SECONDS * 1000).toISOString();
    const dups = await restGet(
      'push_log',
      `sender_key=eq.${encodeURIComponent(sender)}&user_key=eq.${encodeURIComponent(to)}&kind=eq.${encodeURIComponent(kind)}` +
        `&body=eq.${encodeURIComponent(body)}&created_at=gte.${encodeURIComponent(dupSince)}&select=id&limit=1`,
    );
    if (dups.length) return json({ ok: true, status: 'duplicate', sent: 0 });
  } catch (_e) {
    /* 기록을 못 읽어도 발송은 계속합니다(알림이 기록 때문에 막히면 안 됨) */
  }

  /* ③ 받는 사람 기기 토큰 */
  let tokens: any[] = [];
  try {
    tokens = await restGet(
      'push_tokens',
      `user_key=eq.${encodeURIComponent(to)}&select=id,token,platform&order=seen_at.desc&limit=${MAX_TOKENS}`,
    );
  } catch (_e) {
    tokens = [];
  }
  if (!tokens.length) {
    await logRow(sender, to, kind, title, body, url, 'no_tokens', 0, 0, {});
    return json({ ok: true, status: 'no_tokens', sent: 0 });
  }

  /* ④ FCM 시크릿 확인 — 아직 없으면 조용히 '준비 중'만 알립니다 */
  const sa = serviceAccount();
  if (!sa) {
    await logRow(sender, to, kind, title, body, url, 'pending_fcm_secret', 0, 0, { devices: tokens.length });
    return json({ ok: true, status: 'pending_fcm_secret', sent: 0, devices: tokens.length });
  }

  let access = '';
  try {
    access = await fcmAccessToken(sa);
  } catch (_e) {
    await logRow(sender, to, kind, title, body, url, 'fcm_auth_failed', 0, 0, { devices: tokens.length });
    return json({ ok: true, status: 'fcm_auth_failed', sent: 0, devices: tokens.length });
  }

  /* ⑤ 기기별 발송 (하나가 실패해도 나머지는 계속) */
  let sent = 0;
  let failed = 0;
  const dead: string[] = [];
  for (const row of tokens) {
    const token = String(row.token || '');
    if (!token) continue;
    try {
      const res = await sendOne(sa, access, token, title, body, url, tag);
      if (res.ok) sent++;
      else {
        failed++;
        if (res.dead) dead.push(String(row.id || ''));
      }
    } catch (_e) {
      failed++;
    }
  }

  /* 죽은 토큰은 지워 다음 발송이 헛돌지 않게 합니다 */
  for (const id of dead) {
    try {
      await restDelete('push_tokens', `id=eq.${encodeURIComponent(id)}`);
    } catch (_e) { /* 무시 */ }
  }

  const status = sent > 0 ? (failed > 0 ? 'partial' : 'sent') : 'failed';
  await logRow(sender, to, kind, title, body, url, status, sent, failed, {
    devices: tokens.length,
    removed: dead.length,
  });
  return json({ ok: true, status, sent, failed, removed: dead.length, devices: tokens.length });
});

async function logRow(
  sender: string,
  to: string,
  kind: string,
  title: string,
  body: string,
  url: string,
  status: string,
  sent: number,
  failed: number,
  detail: Record<string, unknown>,
): Promise<void> {
  try {
    await restPost('push_log', [{
      sender_key: sender,
      user_key: to,
      kind,
      title: title.slice(0, 60),
      body: body.slice(0, 160),
      url,
      status,
      sent,
      failed,
      detail,
    }]);
  } catch (_e) {
    /* 기록 실패가 발송 결과를 바꾸지 않습니다 */
  }
}
