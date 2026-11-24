import assert from 'node:assert/strict';
import test from 'node:test';
import worker from './src/index.ts';

/**
 * Lightweight in-memory D1 stub implementing the exact SQL statements used by
 * `workers/comments/src/index.ts` so the Worker can be tested with zero deps.
 */
function createMemoryDb() {
  const comments = [];
  const rateLimits = [];

  return {
    comments,
    rateLimits,
    prepare(query) {
      const sql = query.replace(/\s+/g, ' ').trim();
      let bound = [];

      const statement = {
        bind(...values) {
          bound = values;
          return statement;
        },

        async first() {
          if (
            sql.startsWith(
              'SELECT id, slug, parent_id, status FROM comments WHERE id = ?',
            )
          ) {
            const found = comments.find((row) => row.id === bound[0]);
            return found
              ? {
                  id: found.id,
                  slug: found.slug,
                  parent_id: found.parent_id,
                  status: found.status,
                }
              : null;
          }
          if (
            sql.startsWith(
              'SELECT COUNT(*) AS count FROM rate_limits WHERE ip_hash = ? AND created_at >= ?',
            )
          ) {
            const [ipHash, since] = bound;
            const count = rateLimits.filter(
              (entry) => entry.ip_hash === ipHash && entry.created_at >= since,
            ).length;
            return { count };
          }
          throw new Error(`Unhandled first() SQL: ${sql}`);
        },

        async all() {
          if (
            sql.includes("WHERE slug = ? AND status = 'approved'") &&
            sql.includes('ORDER BY created_at ASC')
          ) {
            const [slug] = bound;
            const results = comments
              .filter((row) => row.slug === slug && row.status === 'approved')
              .sort(
                (a, b) =>
                  a.created_at.localeCompare(b.created_at) ||
                  a.id.localeCompare(b.id),
              )
              .map(({ ip_hash: _ignored, ...rest }) => ({ ...rest }));
            return { results, success: true };
          }
          if (sql.includes('ORDER BY created_at DESC, id DESC')) {
            let idx = 0;
            let statusFilter = null;
            let slugFilter = null;
            if (sql.includes('status = ?')) statusFilter = bound[idx++];
            if (sql.includes('slug = ?')) slugFilter = bound[idx++];
            const results = comments
              .filter(
                (row) =>
                  (!statusFilter || row.status === statusFilter) &&
                  (!slugFilter || row.slug === slugFilter),
              )
              .sort(
                (a, b) =>
                  b.created_at.localeCompare(a.created_at) ||
                  b.id.localeCompare(a.id),
              )
              .map(({ ip_hash: _ignored, ...rest }) => ({ ...rest }));
            return { results, success: true };
          }
          throw new Error(`Unhandled all() SQL: ${sql}`);
        },

        async run() {
          if (sql.startsWith('DELETE FROM rate_limits WHERE created_at < ?')) {
            const [cutoff] = bound;
            let removed = 0;
            for (let i = rateLimits.length - 1; i >= 0; i--) {
              if (rateLimits[i].created_at < cutoff) {
                rateLimits.splice(i, 1);
                removed++;
              }
            }
            return { results: [], success: true, meta: { changes: removed } };
          }
          if (sql.startsWith('INSERT INTO rate_limits')) {
            const [ip_hash, created_at] = bound;
            rateLimits.push({ ip_hash, created_at });
            return { results: [], success: true, meta: { changes: 1 } };
          }
          if (sql.startsWith('INSERT INTO comments')) {
            const [
              id,
              slug,
              parent_id,
              author,
              website,
              body,
              status,
              is_owner,
              ip_hash,
              created_at,
            ] = bound;
            comments.push({
              id,
              slug,
              parent_id,
              author,
              website,
              body,
              status,
              is_owner,
              ip_hash,
              created_at,
            });
            return { results: [], success: true, meta: { changes: 1 } };
          }
          if (sql.startsWith('UPDATE comments SET status = ? WHERE id = ?')) {
            const [status, id] = bound;
            const row = comments.find((entry) => entry.id === id);
            if (!row) {
              return { results: [], success: true, meta: { changes: 0 } };
            }
            row.status = status;
            return { results: [], success: true, meta: { changes: 1 } };
          }
          if (sql.startsWith('DELETE FROM comments WHERE id = ?')) {
            const [id] = bound;
            const idx = comments.findIndex((entry) => entry.id === id);
            if (idx < 0) {
              return { results: [], success: true, meta: { changes: 0 } };
            }
            comments.splice(idx, 1);
            return { results: [], success: true, meta: { changes: 1 } };
          }
          throw new Error(`Unhandled run() SQL: ${sql}`);
        },
      };

      return statement;
    },
  };
}

function makeEnv(overrides = {}) {
  return {
    DB: createMemoryDb(),
    ALLOWED_ORIGINS: 'https://www.ayixiayi.com,http://127.0.0.1:4321',
    MODERATION_MODE: 'auto',
    ADMIN_TOKEN: 'secret-admin-token-123',
    IP_HASH_SALT: 'test-salt',
    ...overrides,
  };
}

function req(path, options = {}) {
  const {
    method = 'GET',
    body,
    origin = 'https://www.ayixiayi.com',
    ip = '203.0.113.10',
    token,
  } = options;
  const headers = new Headers();
  if (origin) headers.set('Origin', origin);
  if (ip) headers.set('CF-Connecting-IP', ip);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  return new Request(`https://comments.example.com${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

test('GET /api/health returns ok and CORS headers for allowed origin', async () => {
  const env = makeEnv();
  const res = await worker.fetch(req('/api/health'), env);
  assert.equal(res.status, 200);
  assert.equal(
    res.headers.get('Access-Control-Allow-Origin'),
    'https://www.ayixiayi.com',
  );
  assert.equal(res.headers.get('Vary'), 'Origin');
  assert.deepEqual(await res.json(), { ok: true });
});

test('OPTIONS preflight allows whitelisted origins and rejects unknown origins', async () => {
  const env = makeEnv();
  const allowed = await worker.fetch(
    req('/api/comments', { method: 'OPTIONS' }),
    env,
  );
  assert.equal(allowed.status, 204);
  assert.equal(
    allowed.headers.get('Access-Control-Allow-Origin'),
    'https://www.ayixiayi.com',
  );

  const blocked = await worker.fetch(
    req('/api/comments', {
      method: 'OPTIONS',
      origin: 'https://evil.example',
    }),
    env,
  );
  assert.equal(blocked.status, 403);
  assert.equal(blocked.headers.get('Access-Control-Allow-Origin'), null);
});

test('GET /api/comments returns empty list for new slug and 400 without slug', async () => {
  const env = makeEnv();
  const missing = await worker.fetch(req('/api/comments'), env);
  assert.equal(missing.status, 400);

  const empty = await worker.fetch(req('/api/comments?slug=hello-world'), env);
  assert.equal(empty.status, 200);
  assert.deepEqual(await empty.json(), {
    slug: 'hello-world',
    count: 0,
    comments: [],
  });
});

test('POST /api/comments validates fields, preserves XSS text verbatim, and omits ip_hash', async () => {
  const env = makeEnv();

  const emptyAuthor = await worker.fetch(
    req('/api/comments', {
      method: 'POST',
      body: { slug: 'post-1', author: '   ', body: 'Hello there' },
    }),
    env,
  );
  assert.equal(emptyAuthor.status, 400);

  const badWebsite = await worker.fetch(
    req('/api/comments', {
      method: 'POST',
      body: {
        slug: 'post-1',
        author: 'Alice',
        website: 'javascript:alert(1)',
        body: 'Valid comment body',
      },
    }),
    env,
  );
  assert.equal(badWebsite.status, 400);

  const xssBody = '<script>alert("xss")</script> & <b>plain</b>';
  const created = await worker.fetch(
    req('/api/comments', {
      method: 'POST',
      body: {
        slug: 'post-1',
        author: 'Alice',
        website: 'https://alice.example/blog',
        body: xssBody,
      },
    }),
    env,
  );
  assert.equal(created.status, 201);
  const payload = await created.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.status, 'approved');
  assert.equal(payload.comment.body, xssBody);
  assert.equal(payload.comment.is_owner, false);
  assert.equal('ip_hash' in payload.comment, false);

  const listed = await worker.fetch(req('/api/comments?slug=post-1'), env);
  const listData = await listed.json();
  assert.equal(listData.count, 1);
  assert.equal(listData.comments[0].body, xssBody);
  assert.equal('ip_hash' in listData.comments[0], false);
});

test('honeypot field silently accepts without persisting', async () => {
  const env = makeEnv();
  const res = await worker.fetch(
    req('/api/comments', {
      method: 'POST',
      body: {
        slug: 'post-1',
        author: 'Bot',
        body: 'Buy now!',
        company: 'Spam LLC',
      },
    }),
    env,
  );
  assert.equal(res.status, 201);
  assert.equal(env.DB.comments.length, 0);
  assert.equal(env.DB.rateLimits.length, 0);
});

test('parent_id validates same-slug parent and flattens reply-to-reply to 1 level', async () => {
  const env = makeEnv();

  const rootRes = await worker.fetch(
    req('/api/comments', {
      method: 'POST',
      body: { slug: 'post-1', author: 'Root', body: 'First comment' },
    }),
    env,
  );
  const rootId = (await rootRes.json()).comment.id;

  // Cross-slug reply rejected
  const crossSlug = await worker.fetch(
    req('/api/comments', {
      method: 'POST',
      body: {
        slug: 'post-2',
        parent_id: rootId,
        author: 'Cross',
        body: 'Wrong slug reply',
      },
    }),
    env,
  );
  assert.equal(crossSlug.status, 400);

  // Reply to root succeeds
  const reply1Res = await worker.fetch(
    req('/api/comments', {
      method: 'POST',
      body: {
        slug: 'post-1',
        parent_id: rootId,
        author: 'Bob',
        body: 'First reply',
      },
    }),
    env,
  );
  assert.equal(reply1Res.status, 201);
  const reply1 = (await reply1Res.json()).comment;
  assert.equal(reply1.parent_id, rootId);

  // Reply to reply1 flattens to rootId
  const reply2Res = await worker.fetch(
    req('/api/comments', {
      method: 'POST',
      body: {
        slug: 'post-1',
        parent_id: reply1.id,
        author: 'Carol',
        body: 'Nested reply flattened',
      },
    }),
    env,
  );
  assert.equal(reply2Res.status, 201);
  const reply2 = (await reply2Res.json()).comment;
  assert.equal(reply2.parent_id, rootId);
});

test('rate limiting returns 429 after 5 posts in 10 minutes, while admin bypasses', async () => {
  const env = makeEnv();
  for (let i = 1; i <= 5; i++) {
    const res = await worker.fetch(
      req('/api/comments', {
        method: 'POST',
        body: { slug: 'rate-post', author: `User ${i}`, body: `Message #${i}` },
      }),
      env,
    );
    assert.equal(res.status, 201);
  }

  const sixth = await worker.fetch(
    req('/api/comments', {
      method: 'POST',
      body: { slug: 'rate-post', author: 'User 6', body: 'Blocked message' },
    }),
    env,
  );
  assert.equal(sixth.status, 429);
  assert.equal(sixth.headers.get('Retry-After'), '600');

  // Owner with Bearer token bypasses rate limit and is marked is_owner = true
  const ownerPost = await worker.fetch(
    req('/api/comments', {
      method: 'POST',
      token: 'secret-admin-token-123',
      body: { slug: 'rate-post', author: 'ayixiayi', body: 'Author reply' },
    }),
    env,
  );
  assert.equal(ownerPost.status, 201);
  const ownerData = await ownerPost.json();
  assert.equal(ownerData.comment.is_owner, true);
});

test('admin auth, pre-moderation workflow, PATCH and DELETE', async () => {
  const env = makeEnv({ MODERATION_MODE: 'pre' });

  // Unconfigured admin token returns 503
  const noTokenEnv = makeEnv({ ADMIN_TOKEN: '' });
  const unconfigured = await worker.fetch(
    req('/api/admin/comments', { origin: null }),
    noTokenEnv,
  );
  assert.equal(unconfigured.status, 503);

  // Invalid token returns 401
  const badAuth = await worker.fetch(
    req('/api/admin/comments', { origin: null, token: 'wrong-token' }),
    env,
  );
  assert.equal(badAuth.status, 401);

  // Visitor post enters pending state in pre-moderation mode
  const postRes = await worker.fetch(
    req('/api/comments', {
      method: 'POST',
      body: { slug: 'mod-post', author: 'Visitor', body: 'Awaiting approval' },
    }),
    env,
  );
  assert.equal(postRes.status, 201);
  const { status, comment } = await postRes.json();
  assert.equal(status, 'pending');

  // Public GET does not expose pending comment
  const publicBefore = await worker.fetch(
    req('/api/comments?slug=mod-post'),
    env,
  );
  assert.equal((await publicBefore.json()).count, 0);

  // Admin GET lists pending comment
  const pendingList = await worker.fetch(
    req('/api/admin/comments?status=pending', {
      origin: null,
      token: 'secret-admin-token-123',
    }),
    env,
  );
  assert.equal(pendingList.status, 200);
  const pendingData = await pendingList.json();
  assert.equal(pendingData.count, 1);
  assert.equal(pendingData.comments[0].id, comment.id);

  // Admin PATCH approves comment
  const approveRes = await worker.fetch(
    req(`/api/comments/${comment.id}`, {
      method: 'PATCH',
      origin: null,
      token: 'secret-admin-token-123',
      body: { status: 'approved' },
    }),
    env,
  );
  assert.equal(approveRes.status, 200);

  const publicAfter = await worker.fetch(
    req('/api/comments?slug=mod-post'),
    env,
  );
  assert.equal((await publicAfter.json()).count, 1);

  // Admin DELETE removes comment
  const delRes = await worker.fetch(
    req(`/api/comments/${comment.id}`, {
      method: 'DELETE',
      origin: null,
      token: 'secret-admin-token-123',
    }),
    env,
  );
  assert.equal(delRes.status, 200);

  const publicDeleted = await worker.fetch(
    req('/api/comments?slug=mod-post'),
    env,
  );
  assert.equal((await publicDeleted.json()).count, 0);
});
