import { defineConfig, devices } from '@playwright/test';

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
      NEXTAUTH_SECRET: 'test-only-auth-secret-at-least-thirty-two-characters',
      NEXTAUTH_URL: 'http://127.0.0.1:3000',
      VNPAY_TMN_CODE: 'TEST247',
      VNPAY_HASH_SECRET: 'playwright-test-vnpay-secret-247-home',
      VNPAY_PAYMENT_URL: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
      VNPAY_RETURN_URL: 'http://127.0.0.1:3000/api/v1/payment/return',
    },
    url: 'http://127.0.0.1:3000/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
