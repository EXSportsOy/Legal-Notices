# Feedback regression tests

Tests exercise the feedback feature maintained in this repository. They are useful independently of the database subscription plan. The old keepalive workflow has been removed.

## Run locally

Requires Node.js 20 or newer and Python on PATH. From `tests/feedback`:

```sh
npm ci
npx playwright install chromium
npm test
```

Playwright starts a loopback-only static server automatically. Chromium loads the real application scripts and the Supabase SDK from esm.sh, so these tests require network access. They cover English and Finnish website feedback, app selection, bug-report deep links and fields, required fields, email validation, the honeypot, and recovery after a failed submission. Every browser submission is intercepted and answered by the test. Other write requests and unexpected Supabase calls are blocked. Script and stylesheet failures and uncaught JavaScript errors fail the test.

## Check the published site and production API

In PowerShell:

```powershell
$env:FEEDBACK_BASE_URL = 'https://www.exsports.fi'
$env:FEEDBACK_LIVE_API = '1'
npm run test:production
```

In a POSIX shell:

```sh
FEEDBACK_BASE_URL=https://www.exsports.fi FEEDBACK_LIVE_API=1 npm run test:production
```

The browser tests still intercept submissions when visiting the published site. The separate API test reads the published configuration, validates the expected project host and public key format, and checks:

- The REST API resolves every column used by feedback and its documented schema. `limit=0` prevents retrieving customer feedback.
- An empty message is rejected by its check constraint or the corresponding row-level insert policy.
- An invalid category is rejected by the category check constraint.

Live requests use only the website's public key, have 20-second timeouts, and are not retried. The API test stops at the first failed assertion. No service-role key or other repository secret is needed. Traces, screenshots and response-body artifacts are disabled.

If a database validation rule regresses, an invalid probe could be accepted and the existing insert trigger could send an email. Inspect `CI validation probe` in `message` or `page_url` in the Supabase dashboard and remove only that test row after investigating the failure. The probes contain no real contact details. Do not rerun a failing validation test repeatedly.

Coverage limits: these tests do not verify successful production insertion, email delivery, or row-level read isolation. A zero-row schema query cannot prove that private rows are protected. There is no guarantee that test activity prevents Supabase pausing.

## GitHub Actions and failures

`Feedback tests` runs local browser tests for relevant pushes to main and pull requests. Once daily at 06:17 UTC and on a manual main-branch run, it checks both the checkout and production. After a successful `pages-build-deployment` on main from this repository, it checks the published site and API. Production checks do not run on pull requests or manual runs from other branches. Concurrent production runs are serialized.

A failed assertion makes the Actions job fail with a named test and diagnostic output. Enable **Settings → Notifications → System → Actions** notifications in your GitHub account (including email for failed workflows); delivery depends on each user's GitHub settings. Investigate failures rather than accepting a green HTTP status alone. No separate email integration is configured by this repository.

The daily schedule exists to catch regressions in external SDK delivery, deployed configuration and database constraints between code changes. Adjust it according to testing needs. Public-repository schedules can be disabled after 60 days without repository activity; check the workflow state if daily results stop appearing.
