import {
  expect,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test';

import {
  createOperationsFixture,
  operationsFixturePassword,
  runFailureSafeCleanup,
  type OperationsFixture,
} from '../fixtures/operations';

export async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.locator('input[type="password"]').fill(operationsFixturePassword);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/account$/);
}

export async function requestJson<T>(
  page: Page,
  url: string,
  init?: { method?: string; body?: unknown },
): Promise<{ status: number; body: T }> {
  return page.evaluate(
    async ({ target, options }) => {
      const response = await fetch(target, {
        method: options?.method,
        headers: options?.body
          ? { 'Content-Type': 'application/json' }
          : undefined,
        body: options?.body ? JSON.stringify(options.body) : undefined,
      });
      return { status: response.status, body: await response.json() };
    },
    { target: url, options: init },
  );
}

export async function requestStatus(page: Page, url: string) {
  return page.evaluate(async (target) => {
    const response = await fetch(target);
    return {
      status: response.status,
      contentType: response.headers.get('content-type'),
    };
  }, url);
}

export async function requestHeaders(page: Page, url: string) {
  return page.evaluate(async (target) => {
    const response = await fetch(target);
    return {
      cacheControl: response.headers.get('cache-control'),
      status: response.status,
    };
  }, url);
}

export async function withOperationsE2eFixture(
  browser: Browser,
  run: (input: {
    fixture: OperationsFixture;
    newContext: () => Promise<BrowserContext>;
  }) => Promise<void>,
) {
  const fixture = await createOperationsFixture();
  const contexts: BrowserContext[] = [];
  let testError: unknown;
  try {
    await run({
      fixture,
      newContext: async () => {
        const context = await browser.newContext();
        contexts.push(context);
        return context;
      },
    });
  } catch (error: unknown) {
    testError = error;
    throw error;
  } finally {
    try {
      await runFailureSafeCleanup([
        ...contexts.map((context, index) => ({
          name: `close browser context ${index + 1}`,
          run: () => context.close(),
        })),
        { name: `cleanup fixture ${fixture.namespace}`, run: fixture.cleanup },
      ]);
    } catch (cleanupError: unknown) {
      if (testError)
        throw new AggregateError(
          [testError, cleanupError],
          'Operations E2E test and cleanup both failed.',
        );
      throw cleanupError;
    }
  }
}

function appointmentsResponse(
  page: Page,
  expected: { status?: string; hasCursor?: boolean } = {},
) {
  return page.waitForResponse((response) => {
    if (
      response.request().method() !== 'GET' ||
      response.status() !== 200 ||
      !response.url().includes('/api/v1/admin/operations/appointments')
    )
      return false;
    const url = new URL(response.url());
    if (expected.status && url.searchParams.get('status') !== expected.status)
      return false;
    return expected.hasCursor === undefined
      ? true
      : url.searchParams.has('cursor') === expected.hasCursor;
  });
}

export async function selectAppointmentStatus(page: Page, status: string) {
  const response = appointmentsResponse(page, { status });
  await page.getByLabel('Trang thai').selectOption(status);
  await response;
}

export async function findAppointmentRow(
  page: Page,
  orderNumber: string,
): Promise<Locator> {
  for (let pageIndex = 0; pageIndex < 100; pageIndex += 1) {
    const row = page.locator('tr', { hasText: orderNumber });
    if ((await row.count()) > 0) return row;

    const next = page.getByRole('button', { name: 'Trang sau' });
    if (await next.isDisabled()) break;
    const response = appointmentsResponse(page, { hasCursor: true });
    await next.click();
    await response;
  }
  throw new Error(
    `Appointment row ${orderNumber} was not found in pagination.`,
  );
}
