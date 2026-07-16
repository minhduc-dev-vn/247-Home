import { randomUUID } from 'node:crypto';

import { expect, test, type Page } from '@playwright/test';

import { prisma } from '@/shared/db/client';

const demoPassword = 'LocalDemoOnly-247Home';

test('a customer can register and starts an authenticated account session', async ({
  page,
}) => {
  const email = `demo-register-${randomUUID()}@example.test`;
  try {
    await page.goto('/register');
    const inputs = page.locator('form input');
    await inputs.nth(0).fill('Local Demo Registration');
    await inputs.nth(1).fill(email);
    await inputs.nth(2).fill(demoPassword);
    await page.locator('form button[type="submit"]').click();

    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByText(email)).toBeVisible();
  } finally {
    await prisma.user.deleteMany({ where: { email } });
  }
});

async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.locator('input[type="password"]').fill(demoPassword);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/account$/);
}

test('MinIO evidence preview is private to the assigned technician', async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const otherContext = await browser.newContext();
  try {
    const ownerPage = await ownerContext.newPage();
    await login(ownerPage, 'technician1@example.com');
    await ownerPage.goto('/technician');
    const row = ownerPage.locator('tr', { hasText: '247H-OPS-TECH-DEMO' });
    await row.getByRole('button', { name: 'Chi tiet' }).click();
    const evidenceLink = ownerPage.locator(
      'a[href*="/api/v1/operations/evidence/"]',
    );
    await expect(evidenceLink).toHaveCount(1);
    const evidencePath = await evidenceLink.getAttribute('href');
    if (!evidencePath) throw new Error('Demo evidence preview URL is missing.');
    const ownerPreview = await ownerPage.evaluate(async (path) => {
      const response = await fetch(path);
      return {
        contentType: response.headers.get('content-type'),
        status: response.status,
      };
    }, evidencePath);
    expect(ownerPreview).toEqual({ contentType: 'image/png', status: 200 });

    const otherPage = await otherContext.newPage();
    await login(otherPage, 'technician2@example.com');
    const deniedPreview = await otherPage.evaluate(async (path) => {
      const response = await fetch(path);
      return { body: await response.text(), status: response.status };
    }, evidencePath);
    expect(deniedPreview.status).toBe(404);
    expect(deniedPreview.body).not.toContain('Test Street');
    expect(deniedPreview.body).not.toContain('0900000000');
  } finally {
    await Promise.allSettled([ownerContext.close(), otherContext.close()]);
  }
});
