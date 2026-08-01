import { defineConfig, devices } from '@playwright/test';

const playwrightAuthSecret =
  'test-only-auth-secret-at-least-thirty-two-characters';
const playwrightBaseUrl = 'http://127.0.0.1:3000';

// The test process also runs trusted worker code against the same database as
// the web server, so both sides must derive the outbox key from the same
// test-only Auth.js secret.
process.env.NEXTAUTH_SECRET = playwrightAuthSecret;
process.env.NEXTAUTH_URL = playwrightBaseUrl;
process.env.APP_ORIGIN = playwrightBaseUrl;

const reuseExistingServer =
  process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === 'true';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm dev',
    env: {
      NEXTAUTH_SECRET: playwrightAuthSecret,
      NEXTAUTH_URL: playwrightBaseUrl,
      APP_ORIGIN: playwrightBaseUrl,
      VNPAY_TMN_CODE: 'TEST247',
      VNPAY_HASH_SECRET: 'playwright-test-vnpay-secret-247-home',
      VNPAY_PUBLIC_ENABLED: 'true',
      VNPAY_PAYMENT_URL: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
      VNPAY_RETURN_URL: 'http://127.0.0.1:3000/api/v1/payment/return',
    },
    url: 'http://127.0.0.1:3000/api/health',
    // A stale Docker/Next process can otherwise satisfy the health probe while
    // serving a different revision than the source under test. Reuse is opt-in
    // for an explicitly managed local server only.
    reuseExistingServer,
    timeout: 120_000,
  },
});
