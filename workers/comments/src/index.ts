export interface D1Meta {
  changes?: number;
}

export interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta?: D1Meta;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

export interface Env {
  DB: D1Database;
  ALLOWED_ORIGINS?: string;
  MODERATION_MODE?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET?: string;
  ADMIN_TOKEN?: string;
  IP_HASH_SALT?: string;
}

export interface PublicComment {
  id: string;
  slug: string;
  parent_id: string | null;
  author: string;
  website: string | null;
  body: string;
  is_owner: boolean;
  created_at: string;
}

interface CommentRow {
  id: string;
  slug: string;
  parent_id: string | null;
  author: string;
  website: string | null;
  body: string;
  status: 'approved' | 'pending' | 'deleted';
  is_owner: number;
  created_at: string;
}

const DEFAULT_ALLOWED_ORIGINS =
  'https://www.ayixiayi.com,http://127.0.0.1:4321,http://localhost:4321';
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_POSTS = 5;
const MAX_BODY_BYTES = 16 * 1024;
const VALID_STATUSES = new Set(['approved', 'pending', 'deleted']);
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

function parseAllowedOrigins(env: Env): Set<string> {
  const raw = env.ALLOWED_ORIGINS ?? DEFAULT_ALLOWED_ORIGINS;
  return new Set(
    raw
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

function buildCorsHeaders(
  request: Request,
  env: Env,
): { headers: Headers; originAllowed: boolean } {
  const headers = new Headers({
    Vary: 'Origin',
    'Cache-Control': 'no-store',
  });
  const origin = request.headers.get('Origin');
  if (!origin) {
    return { headers, originAllowed: true };
  }
  const allowed = parseAllowedOrigins(env).has(origin);
  if (allowed) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PATCH, DELETE, OPTIONS',
    );
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    headers.set('Access-Control-Max-Age', '86400');
  }
  return { headers, originAllowed: allowed };
}

function jsonResponse(
  body: unknown,
  status: number,
  corsHeaders: Headers,
  extraHeaders?: Record<string, string>,
): Response {
  const headers = new Headers(corsHeaders);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  if (extraHeaders) {
    for (const [key, value] of Object.entries(extraHeaders)) {
      headers.set(key, value);
    }
  }
  return new Response(JSON.stringify(body), { status, headers });
}

async function sha256Bytes(input: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(digest);
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = await sha256Bytes(input);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time string comparison via fixed-length SHA-256 digests. */
async function timingSafeStringEqual(a: string, b: string): Promise<boolean> {
  const [hashA, hashB] = await Promise.all([sha256Bytes(a), sha256Bytes(b)]);
  let diff = 0;
  for (let i = 0; i < hashA.length; i++) {
    diff |= hashA[i] ^ hashB[i];
  }
  return diff === 0 && a.length === b.length;
}

function extractBearerToken(request: Request): string | null {
  const auth = request.headers.get('Authorization');
  if (!auth) return null;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

async function isAdmin(request: Request, env: Env): Promise<boolean> {
  const expected = env.ADMIN_TOKEN?.trim();
  if (!expected) return false;
  const provided = extractBearerToken(request);
  if (!provided) return false;
  return timingSafeStringEqual(provided, expected);
}

async function requireAdmin(
  request: Request,
  env: Env,
  corsHeaders: Headers,
): Promise<Response | null> {
  if (!env.ADMIN_TOKEN?.trim()) {
    return jsonResponse(
      { error: 'Admin API is not configured.' },
      503,
      corsHeaders,
    );
  }
  if (!(await isAdmin(request, env))) {
    return jsonResponse({ error: 'Unauthorized.' }, 401, corsHeaders);
  }
  return null;
}

function validateSlug(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const slug = raw.trim();
  if (!slug || slug.length > 200 || CONTROL_CHARS.test(slug)) return null;
  return slug;
}

function validateWebsite(
  raw: unknown,
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === undefined || raw === null || raw === '') {
    return { ok: true, value: null };
  }
  if (typeof raw !== 'string') {
    return { ok: false, error: '网址格式无效。' };
  }
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  if (trimmed.length > 200) {
    return { ok: false, error: '网址长度不能超过 200 个字符。' };
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: '网址必须是有效的 http 或 https 链接。' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: '仅支持 http 或 https 网址。' };
  }
  return { ok: true, value: parsed.href };
}

function clientIp(request: Request): string {
  const cfIp = request.headers.get('CF-Connecting-IP')?.trim();
  if (cfIp) return cfIp;
  const forwarded = request.headers.get('X-Forwarded-For');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return 'unknown';
}

function toPublicComment(row: CommentRow): PublicComment {
  return {
    id: row.id,
    slug: row.slug,
    parent_id: row.parent_id,
    author: row.author,
    website: row.website,
    body: row.body,
    is_owner: Boolean(row.is_owner),
    created_at: row.created_at,
  };
}

async function parseJsonBody(
  request: Request,
): Promise<
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; status: number; error: string }
> {
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return { ok: false, status: 413, error: '请求体过大。' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, status: 400, error: '无效的 JSON 请求体。' };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, status: 400, error: '请求体必须是 JSON 对象。' };
  }
  return { ok: true, data: parsed as Record<string, unknown> };
}

async function verifyTurnstile(
  secret: string,
  token: string,
  ip: string,
): Promise<boolean> {
  const form = new URLSearchParams({
    secret,
    response: token,
    ...(ip !== 'unknown' ? { remoteip: ip } : {}),
  });
  const response = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      method: 'POST',
      body: form,
    },
  );
  if (!response.ok) return false;
  const result = (await response.json()) as { success?: boolean };
  return result.success === true;
}

async function handleGetComments(
  url: URL,
  env: Env,
  corsHeaders: Headers,
): Promise<Response> {
  const slug = validateSlug(url.searchParams.get('slug'));
  if (!slug) {
    return jsonResponse({ error: '缺少有效的 slug 参数。' }, 400, corsHeaders);
  }
  const { results } = await env.DB.prepare(
    `SELECT id, slug, parent_id, author, website, body, status, is_owner, created_at
     FROM comments
     WHERE slug = ? AND status = 'approved'
     ORDER BY created_at ASC, id ASC`,
  )
    .bind(slug)
    .all<CommentRow>();

  const comments = results.map(toPublicComment);
  return jsonResponse(
    { slug, count: comments.length, comments },
    200,
    corsHeaders,
  );
}

async function handlePostComment(
  request: Request,
  env: Env,
  corsHeaders: Headers,
): Promise<Response> {
  const parsed = await parseJsonBody(request);
  if (!parsed.ok) {
    return jsonResponse({ error: parsed.error }, parsed.status, corsHeaders);
  }
  const data = parsed.data;

  // Honeypot: silently accept bot submissions without persisting.
  if (typeof data.company === 'string' && data.company.trim().length > 0) {
    return jsonResponse(
      { ok: true, status: 'approved', comment: null },
      201,
      corsHeaders,
    );
  }

  const slug = validateSlug(data.slug);
  if (!slug) {
    return jsonResponse({ error: '文章标识无效。' }, 400, corsHeaders);
  }

  if (typeof data.author !== 'string') {
    return jsonResponse({ error: '请填写昵称。' }, 400, corsHeaders);
  }
  const author = data.author.trim();
  const authorLen = [...author].length;
  if (authorLen < 1 || authorLen > 40 || CONTROL_CHARS.test(author)) {
    return jsonResponse({ error: '昵称需为 1–40 个字符。' }, 400, corsHeaders);
  }

  const websiteResult = validateWebsite(data.website);
  if (!websiteResult.ok) {
    return jsonResponse({ error: websiteResult.error }, 400, corsHeaders);
  }

  if (typeof data.body !== 'string') {
    return jsonResponse({ error: '请填写评论内容。' }, 400, corsHeaders);
  }
  const body = data.body.replace(/\r\n?/g, '\n').trim();
  const bodyLen = [...body].length;
  if (bodyLen < 2 || bodyLen > 2000) {
    return jsonResponse(
      { error: '评论内容需为 2–2000 个字符。' },
      400,
      corsHeaders,
    );
  }

  let resolvedParentId: string | null = null;
  if (
    data.parent_id !== undefined &&
    data.parent_id !== null &&
    data.parent_id !== ''
  ) {
    if (typeof data.parent_id !== 'string' || data.parent_id.length > 100) {
      return jsonResponse({ error: '回复目标无效。' }, 400, corsHeaders);
    }
    const parent = await env.DB.prepare(
      `SELECT id, slug, parent_id, status FROM comments WHERE id = ?`,
    )
      .bind(data.parent_id.trim())
      .first<{
        id: string;
        slug: string;
        parent_id: string | null;
        status: string;
      }>();
    if (!parent || parent.status !== 'approved' || parent.slug !== slug) {
      return jsonResponse(
        { error: '回复的目标评论不存在。' },
        400,
        corsHeaders,
      );
    }
    // Flatten reply-to-reply onto the root comment so threads stay 1 level deep.
    resolvedParentId = parent.parent_id ?? parent.id;
  }

  const owner = await isAdmin(request, env);
  const ip = clientIp(request);
  const ipHash = await sha256Hex(`${env.IP_HASH_SALT ?? ''}:${ip}`);

  if (!owner && env.TURNSTILE_SECRET?.trim()) {
    const token =
      typeof data.turnstile_token === 'string'
        ? data.turnstile_token.trim()
        : '';
    if (!token) {
      return jsonResponse({ error: '请完成人机验证。' }, 400, corsHeaders);
    }
    const verified = await verifyTurnstile(
      env.TURNSTILE_SECRET.trim(),
      token,
      ip,
    );
    if (!verified) {
      return jsonResponse(
        { error: '人机验证未通过，请重试。' },
        403,
        corsHeaders,
      );
    }
  }

  if (!owner) {
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW_MS;
    await env.DB.prepare(`DELETE FROM rate_limits WHERE created_at < ?`)
      .bind(windowStart)
      .run();
    const recent = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM rate_limits WHERE ip_hash = ? AND created_at >= ?`,
    )
      .bind(ipHash, windowStart)
      .first<{ count: number }>();
    if ((recent?.count ?? 0) >= RATE_LIMIT_MAX_POSTS) {
      return jsonResponse(
        { error: '发言过于频繁，请稍后再试。' },
        429,
        corsHeaders,
        { 'Retry-After': String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)) },
      );
    }
    await env.DB.prepare(
      `INSERT INTO rate_limits (ip_hash, created_at) VALUES (?, ?)`,
    )
      .bind(ipHash, now)
      .run();
  }

  const moderationMode = (env.MODERATION_MODE ?? 'auto').trim().toLowerCase();
  const status: 'approved' | 'pending' =
    owner || moderationMode !== 'pre' ? 'approved' : 'pending';
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO comments (id, slug, parent_id, author, website, body, status, is_owner, ip_hash, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      slug,
      resolvedParentId,
      author,
      websiteResult.value,
      body,
      status,
      owner ? 1 : 0,
      ipHash,
      createdAt,
    )
    .run();

  const comment: PublicComment = {
    id,
    slug,
    parent_id: resolvedParentId,
    author,
    website: websiteResult.value,
    body,
    is_owner: owner,
    created_at: createdAt,
  };

  return jsonResponse({ ok: true, status, comment }, 201, corsHeaders);
}

async function handleAdminList(
  request: Request,
  url: URL,
  env: Env,
  corsHeaders: Headers,
): Promise<Response> {
  const authError = await requireAdmin(request, env, corsHeaders);
  if (authError) return authError;

  const statusParam = (url.searchParams.get('status') ?? 'pending').trim();
  if (statusParam !== 'all' && !VALID_STATUSES.has(statusParam)) {
    return jsonResponse({ error: '无效的 status 参数。' }, 400, corsHeaders);
  }
  const slugParam = url.searchParams.get('slug');
  const slug = slugParam ? validateSlug(slugParam) : null;
  if (slugParam && !slug) {
    return jsonResponse({ error: '无效的 slug 参数。' }, 400, corsHeaders);
  }

  const clauses: string[] = [];
  const params: unknown[] = [];
  if (statusParam !== 'all') {
    clauses.push('status = ?');
    params.push(statusParam);
  }
  if (slug) {
    clauses.push('slug = ?');
    params.push(slug);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { results } = await env.DB.prepare(
    `SELECT id, slug, parent_id, author, website, body, status, is_owner, created_at
     FROM comments
     ${where}
     ORDER BY created_at DESC, id DESC`,
  )
    .bind(...params)
    .all<CommentRow>();

  const comments = results.map((row) => ({
    ...toPublicComment(row),
    status: row.status,
  }));
  return jsonResponse({ count: comments.length, comments }, 200, corsHeaders);
}

async function handlePatchComment(
  request: Request,
  id: string,
  env: Env,
  corsHeaders: Headers,
): Promise<Response> {
  const authError = await requireAdmin(request, env, corsHeaders);
  if (authError) return authError;

  const parsed = await parseJsonBody(request);
  if (!parsed.ok) {
    return jsonResponse({ error: parsed.error }, parsed.status, corsHeaders);
  }
  const status = parsed.data.status;
  if (typeof status !== 'string' || !VALID_STATUSES.has(status)) {
    return jsonResponse(
      { error: "status 必须是 'approved'、'pending' 或 'deleted'。" },
      400,
      corsHeaders,
    );
  }

  const result = await env.DB.prepare(
    `UPDATE comments SET status = ? WHERE id = ?`,
  )
    .bind(status, id)
    .run();
  if ((result.meta?.changes ?? 0) === 0) {
    return jsonResponse({ error: '评论不存在。' }, 404, corsHeaders);
  }
  return jsonResponse({ ok: true, id, status }, 200, corsHeaders);
}

async function handleDeleteComment(
  request: Request,
  id: string,
  env: Env,
  corsHeaders: Headers,
): Promise<Response> {
  const authError = await requireAdmin(request, env, corsHeaders);
  if (authError) return authError;

  const result = await env.DB.prepare(`DELETE FROM comments WHERE id = ?`)
    .bind(id)
    .run();
  if ((result.meta?.changes ?? 0) === 0) {
    return jsonResponse({ error: '评论不存在。' }, 404, corsHeaders);
  }
  return jsonResponse({ ok: true, id }, 200, corsHeaders);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { headers: corsHeaders, originAllowed } = buildCorsHeaders(
      request,
      env,
    );

    if (request.method === 'OPTIONS') {
      if (!originAllowed) {
        return jsonResponse({ error: 'Origin not allowed.' }, 403, corsHeaders);
      }
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (
      !originAllowed &&
      (request.method === 'POST' ||
        request.method === 'PATCH' ||
        request.method === 'DELETE')
    ) {
      return jsonResponse({ error: 'Origin not allowed.' }, 403, corsHeaders);
    }

    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === '/api/health' && request.method === 'GET') {
      return jsonResponse({ ok: true }, 200, corsHeaders);
    }

    if (pathname === '/api/comments') {
      if (request.method === 'GET') {
        return handleGetComments(url, env, corsHeaders);
      }
      if (request.method === 'POST') {
        return handlePostComment(request, env, corsHeaders);
      }
      return jsonResponse({ error: 'Method not allowed.' }, 405, corsHeaders);
    }

    if (pathname === '/api/admin/comments') {
      if (request.method === 'GET') {
        return handleAdminList(request, url, env, corsHeaders);
      }
      return jsonResponse({ error: 'Method not allowed.' }, 405, corsHeaders);
    }

    const commentMatch = pathname.match(/^\/api\/comments\/([^/]+)$/);
    if (commentMatch) {
      let id: string;
      try {
        id = decodeURIComponent(commentMatch[1]);
      } catch {
        return jsonResponse({ error: '无效的评论 ID。' }, 400, corsHeaders);
      }
      if (request.method === 'PATCH') {
        return handlePatchComment(request, id, env, corsHeaders);
      }
      if (request.method === 'DELETE') {
        return handleDeleteComment(request, id, env, corsHeaders);
      }
      return jsonResponse({ error: 'Method not allowed.' }, 405, corsHeaders);
    }

    return jsonResponse({ error: 'Not found.' }, 404, corsHeaders);
  },
};
