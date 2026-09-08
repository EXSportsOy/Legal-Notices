const { defineConfig } = require('@playwright/test');

const baseURL = process.env.FEEDBACK_BASE_URL || 'http://127.0.0.1:4173';

module.exports = defineConfig({
  testDir: '.',
  timeout: 45000,
  expect: { timeout: 10000 },
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    baseURL,
    browserName: 'chromium',
    serviceWorkers: 'block',
    trace: 'off',
    screenshot: 'off',
  },
  webServer: process.env.FEEDBACK_BASE_URL ? undefined : {
    command: 'python -m http.server 4173 --bind 127.0.0.1 --directory ../..',
    url: baseURL,
    reuseExistingServer: false,
  },
  projects: [
    { name: 'browser', testMatch: 'form.spec.js' },
    { name: 'api', testMatch: 'production.spec.js' },
  ],
});
