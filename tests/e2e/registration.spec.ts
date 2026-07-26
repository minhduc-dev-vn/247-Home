import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { prisma } from '@/shared/db/client';

test('a new customer can register and enter their account', async ({
  page,
}) => {
  const email = `registration-${randomUUID()}@example.test`;
  const password = 'PlaywrightRegistrationPassword-247';

  try {
    await page.goto('/register');
    await page.getByLabel('Họ tên').fill('Playwright Customer');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Mật khẩu').fill(password);
    await page.getByRole('button', { name: 'Tạo tài khoản' }).click();

    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByText(email)).toBeVisible();
    await expect(
      prisma.user.findUnique({
        where: { email },
        select: {
          passwordHash: true,
          roles: { select: { role: { select: { code: true } } } },
        },
      }),
    ).resolves.toMatchObject({
      passwordHash: expect.not.stringContaining(password),
      roles: [{ role: { code: 'CUSTOMER' } }],
    });
  } finally {
    await prisma.user.deleteMany({ where: { email } });
  }
});
