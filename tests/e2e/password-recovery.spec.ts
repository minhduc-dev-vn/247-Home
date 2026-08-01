import { randomUUID } from 'node:crypto';

import { PasswordResetDeliveryStatus } from '@prisma/client';
import { expect, test } from '@playwright/test';

import {
  deliverPasswordResetEmail,
  registerCustomer,
} from '@/modules/identity';
import { type PasswordResetEmail } from '@/modules/identity/infrastructure/password-reset-mailer';
import { prisma } from '@/shared/db/client';

test('a customer can complete password recovery after the queued message is delivered', async ({
  page,
}) => {
  const email = `password-recovery-${randomUUID()}@example.test`;
  const initialPassword = 'Initial247!';
  const replacementPassword = 'Replacement247!';
  const actor = await registerCustomer({
    name: 'Password Recovery Customer',
    email,
    password: initialPassword,
  });

  try {
    await page.goto('/forgot-password');
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: 'Gửi hướng dẫn' }).click();
    await expect(page.getByText('Kiểm tra hộp thư')).toBeVisible();

    const delivery = await prisma.passwordResetDelivery.findFirstOrThrow({
      where: { passwordResetToken: { is: { userId: actor.userId } } },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    const sent: PasswordResetEmail[] = [];
    await expect(
      deliverPasswordResetEmail(delivery.id, {
        mailer: { send: async (message) => void sent.push(message) },
      }),
    ).resolves.toBe('delivered');
    expect(sent).toHaveLength(1);

    const resetUrl = new URL(sent[0].resetUrl);
    await page.goto(`${resetUrl.pathname}${resetUrl.search}`);
    await page.getByLabel('Mật khẩu mới').fill(replacementPassword);
    await page.getByRole('button', { name: 'Đặt lại mật khẩu' }).click();
    await expect(
      page.getByText('Mật khẩu đã được đặt lại. Bạn có thể đăng nhập.'),
    ).toBeVisible();

    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Mật khẩu').fill(replacementPassword);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(
      prisma.passwordResetDelivery.findUniqueOrThrow({
        where: { id: delivery.id },
      }),
    ).resolves.toMatchObject({ status: PasswordResetDeliveryStatus.DELIVERED });
  } finally {
    await prisma.user.deleteMany({ where: { email } });
  }
});
