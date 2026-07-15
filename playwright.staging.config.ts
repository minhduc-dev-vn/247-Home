import { defineConfig, devices } from '@playwright/test';

const stagingBaseUrl = process.env.STAGING_BASE_URL;
if (!stagingBaseUrl)
  throw new Error('STAGING_BASE_URL is required for staging validation.');

const parsedBaseUrl = new URL(stagingBaseUrl);
const isLoopback = ['127.0.0.1', '::1', 'localhost'].includes(
  parsedBaseUrl.hostname,
);
if (
  parsedBaseUrl.protocol !== 'https:' &&
  !(
    process.env.STAGING_ALLOW_HTTP_LOOPBACK === 'true' &&
    isLoopback &&
    parsedBaseUrl.protocol === 'http:'
  )
)
  throw new Error(
    'Staging validation requires HTTPS. HTTP is allowed only for an explicitly enabled loopback rehearsal.',
  );

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: stagingBaseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
