const { test: base, expect } = require('@playwright/test');

// Exercise the real browser code and CDN SDK, but never send a form to a server.
const test = base.extend({
  backend: async ({ context }, use) => {
    const backend = { requests: [], status: 201, unexpected: [] };
    await context.route('**/*', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (request.method() === 'POST' && url.pathname === '/rest/v1/feedback') {
        backend.requests.push({
          url: request.url(),
          headers: request.headers(),
          payload: request.postDataJSON(),
        });
        await route.fulfill({
          status: backend.status,
          contentType: 'application/json',
          body: backend.status === 201 ? '' : JSON.stringify({ message: 'Test service unavailable' }),
        });
      } else if (!['GET', 'HEAD'].includes(request.method()) || url.hostname.endsWith('.supabase.co')) {
        backend.unexpected.push(`${request.method()} ${url.origin}${url.pathname}`);
        await route.abort();
      } else {
        await route.continue();
      }
    });
    await use(backend);
    expect(backend.unexpected, 'Unexpected network calls were blocked').toEqual([]);
  },
});

test.beforeEach(async ({ page, backend, baseURL }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.origin === new URL(baseURL).origin && /\.(js|css)$/.test(url.pathname) && !response.ok()) {
      errors.push(`Asset ${response.status()}: ${url.pathname}`);
    }
  });
  page.on('requestfailed', (request) => {
    if (['script', 'stylesheet'].includes(request.resourceType())) {
      errors.push(`Failed ${request.resourceType()}: ${new URL(request.url()).pathname}`);
    }
  });
  // Keep resource checks attached to each page, including submission error tests.
  page.testErrors = errors;
});

test.afterEach(async ({ page }) => {
  expect(page.testErrors, 'Page JavaScript and styles must load without errors').toEqual([]);
});

async function open(page, language = 'en', suffix = '') {
  const response = await page.goto(`/feedback/${language}/${suffix}`);
  expect(response.status()).toBe(200);
  // Stars are created by feedback.js only after the external SDK has loaded.
  await expect(page.locator('#view-website [data-rating] button')).toHaveCount(5);
}

async function expectSubmission(page, backend, expected) {
  await expect(page.locator('#view-done')).toBeVisible();
  expect(backend.requests).toHaveLength(1);
  const sent = backend.requests[0];
  const config = await page.evaluate(() => window.FEEDBACK_CONFIG);
  expect(sent.url).toBe(`${config.SUPABASE_URL}/rest/v1/feedback`);
  expect(sent.headers.apikey).toBe(config.SUPABASE_ANON_KEY);
  const rows = Array.isArray(sent.payload) ? sent.payload : [sent.payload];
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject(expected);
  expect(rows[0].page_url).toBe(page.url());
  expect(rows[0].user_agent).toBeTruthy();
  expect(rows[0]).not.toHaveProperty('company');
}

for (const language of ['en', 'fi']) {
  test(`${language}: website navigation, validation and submission`, async ({ page, backend }) => {
    await open(page, language);
    await page.locator('[data-goto="view-website"]').click();
    const form = page.locator('form[data-category="website"]');
    await form.locator('[type="submit"]').click();
    await expect(form.locator('[name="message"]')).toHaveAttribute('aria-invalid', 'true');
    expect(backend.requests).toHaveLength(0);
    await form.locator('[name="message"]').fill('  CI browser test: clear navigation.  ');
    await form.locator('[name="email"]').fill('invalid-address');
    await form.locator('[type="submit"]').click();
    await expect(form.locator('[name="email"]')).toHaveAttribute('aria-invalid', 'true');
    expect(backend.requests).toHaveLength(0);
    await form.locator('[name="email"]').fill('');
    await form.locator('[data-rating] button').nth(3).click();
    await form.locator('[type="submit"]').click();
    await expectSubmission(page, backend, {
      category: 'website', app: 'website', lang: language,
      message: 'CI browser test: clear navigation.', rating: 4, email: null,
    });
  });
}

test('app selection is carried into quick feedback', async ({ page, backend }) => {
  await open(page);
  await page.locator('[data-goto="view-app"]').click();
  await page.locator('[data-app="shodia"][data-goto]').click();
  await page.locator('[data-goto="view-app-general"]').click();
  const form = page.locator('form[data-category="program_general"]');
  await form.locator('[name="message"]').fill('CI browser test: app selection.');
  await form.locator('[type="submit"]').click();
  await expectSubmission(page, backend, {
    category: 'program_general', app: 'shodia', lang: 'en',
    message: 'CI browser test: app selection.', rating: null, email: null,
  });
});

test('bug deep link preserves app and structured details', async ({ page, backend }) => {
  await open(page, 'en', '?app=heda#bug');
  const form = page.locator('form[data-category="program_bug"]');
  await expect(form).toBeVisible();
  await form.locator('[name="bug_title"]').fill('CI browser test');
  await form.locator('[name="steps"]').fill('Open the report');
  await form.locator('[name="expected"]').fill('Report appears');
  await form.locator('[name="actual"]').fill('Blank screen');
  await form.locator('[name="environment"]').fill('Chromium test');
  await form.locator('[name="severity"]').selectOption('high');
  await form.locator('[type="submit"]').click();
  await expectSubmission(page, backend, {
    category: 'program_bug', app: 'heda', lang: 'en', rating: null, email: null,
    bug_title: 'CI browser test', steps: 'Open the report', severity: 'high',
    expected: 'Report appears', actual: 'Blank screen', environment: 'Chromium test',
    message: 'CI browser test\nSteps: Open the report\nExpected: Report appears\nActual: Blank screen',
  });
});

test('failed submission retains the message and allows retry', async ({ page, backend }) => {
  await open(page, 'en', '?app=website');
  const form = page.locator('form[data-category="website"]');
  backend.status = 503;
  await form.locator('[name="message"]').fill('CI browser test: retry.');
  await form.locator('[type="submit"]').click();
  await expect(form.locator('[data-form-error]')).toBeVisible();
  await expect(page.locator('#view-done')).not.toBeVisible();
  await expect(form.locator('[name="message"]')).toHaveValue('CI browser test: retry.');
  await expect(form.locator('[type="submit"]')).toBeEnabled();
  expect(backend.requests).toHaveLength(1);
  backend.status = 201;
  await form.locator('[type="submit"]').click();
  await expect(page.locator('#view-done')).toBeVisible();
  expect(backend.requests).toHaveLength(2);
});

test('honeypot blocks automated submissions', async ({ page, backend }) => {
  await open(page, 'en', '?app=website');
  const form = page.locator('form[data-category="website"]');
  await form.locator('[name="company"]').evaluate((input) => { input.value = 'Test bot'; });
  await form.locator('[name="message"]').fill('CI browser test: honeypot.');
  await form.locator('[type="submit"]').click();
  await expect(page.locator('#view-done')).toBeVisible();
  expect(backend.requests).toHaveLength(0);
});
