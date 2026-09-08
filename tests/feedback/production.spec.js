const { test, expect } = require('@playwright/test');

// Explicit opt-in; never run live probes on pull requests. No privileged key.
test.skip(process.env.FEEDBACK_LIVE_API !== '1', 'Set FEEDBACK_LIVE_API=1 to check production');

test('published configuration, database columns and input constraints agree', async ({ request, baseURL }) => {
  test.setTimeout(90000);
  expect(baseURL).toBe('https://www.exsports.fi');
  const configResponse = await request.get('/feedback/feedback-config.js', { timeout: 20000 });
  expect(configResponse.status()).toBe(200);
  const config = await configResponse.text();
  const url = config.match(/SUPABASE_URL:\s*"([^"]+)"/)?.[1];
  const key = config.match(/SUPABASE_ANON_KEY:\s*"([^"]+)"/)?.[1];
  // Refuse to probe any other host if published configuration changes unexpectedly.
  expect(url).toBe('https://jaepadyeyrrwhiomxyfj.supabase.co');
  expect(key).toMatch(/^sb_publishable_/);
  const headers = { apikey: key, Prefer: 'return=minimal' };
  const endpoint = `${url}/rest/v1/feedback`;
  const columns = [
    'id', 'created_at', 'category', 'app', 'lang', 'message', 'rating', 'email',
    'bug_title', 'severity', 'steps', 'expected', 'actual', 'environment',
    'page_url', 'user_agent', 'status',
  ].join(',');
  // Resolves all columns without fetching customer rows; does not prove RLS isolation.
  const schema = await request.get(endpoint, {
    headers, params: { select: columns, limit: '0' }, timeout: 20000,
  });
  expect(schema.status(), 'Published API key and feedback schema must work').toBe(200);
  expect(await schema.json()).toEqual([]);

  // Each probe violates one invariant. Stop on the first failure, without retries.
  // If production validation regresses, a probe could be inserted and trigger an
  // email. The CI marker identifies it for manual removal; no real personal data.
  const marker = `[CI validation probe ${new Date().toISOString()}]`;
  const cases = [
    { name: 'empty message', row: { category: 'website', app: 'website', message: '', page_url: marker } },
    { name: 'invalid category', row: { category: 'ci_invalid_category', app: 'website', message: marker } },
  ];
  for (const probe of cases) {
    const response = await request.post(endpoint, { headers, data: probe.row, timeout: 20000 });
    expect(response.ok(), `${probe.name} was unexpectedly accepted; inspect CI validation probe rows`).toBe(false);
    const error = await response.json();
    if (probe.name === 'empty message' && error.code === '42501') {
      // PostgREST maps insufficient_privilege to 401 for anon, 403 for authenticated users.
      expect([401, 403]).toContain(response.status());
      expect(error.message).toContain('row-level security policy');
    } else {
      expect(response.status(), `${probe.name} must fail a check constraint`).toBe(400);
      expect(error.code).toBe('23514');
      expect(error.message).toContain(probe.name === 'empty message' ? 'feedback_message_check' : 'feedback_category_check');
    }
  }
});
