import { expect, test, type Page } from '@playwright/test';

import {
  createWarrantyRequest,
  transitionWarrantyRequest,
} from '@/modules/warranty';
import { prisma } from '@/shared/db/client';
import {
  createWarrantyFixture,
  warrantyFixturePassword,
} from '../fixtures/warranty';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.locator('input[type="password"]').fill(warrantyFixturePassword);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/account$/);
}

async function noHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
}

test('customer creates, reviews and uploads evidence for an owner-scoped warranty', async ({
  page,
}) => {
  const fixture = await createWarrantyFixture();
  try {
    const owned = await createWarrantyRequest(
      fixture.users.customerA.actor,
      {
        orderItemId: fixture.orderItems.eligibleDevice,
        coverageType: 'DEVICE',
        issueType: 'DEVICE_NOT_WORKING',
        description:
          'The device does not power on during normal household use.',
      },
      `${fixture.namespace}-e2e-owned`,
    );
    const foreign = await createWarrantyRequest(
      fixture.users.customerB.actor,
      {
        orderItemId: fixture.orderItems.otherCustomer,
        coverageType: 'DEVICE',
        issueType: 'OTHER',
        description: 'Private warranty details belonging to another customer.',
      },
      `${fixture.namespace}-e2e-foreign`,
    );

    await page.setViewportSize({ height: 844, width: 390 });
    await signIn(page, fixture.users.customerA.email);
    await page.goto('/warranty');
    await expect(
      page.getByRole('heading', { name: 'Bảo hành của tôi' }),
    ).toBeVisible();
    await expect(page.getByTestId('customer-warranty-card')).toHaveCount(1);
    await expect(page.getByText(owned.requestNumber)).toBeVisible();
    await expect(page.getByText(foreign.requestNumber)).toHaveCount(0);
    await noHorizontalOverflow(page);

    await page
      .getByRole('link', { name: `Xem chi tiết ${owned.requestNumber}` })
      .click();
    await expect(
      page.getByRole('heading', { name: owned.requestNumber }),
    ).toBeVisible();
    await expect(page.getByTestId('warranty-status-timeline')).toBeVisible();
    await page.getByLabel('Ảnh hiện trạng').setInputFiles({
      name: 'warranty-evidence.png',
      mimeType: 'image/png',
      buffer: png,
    });
    await page.getByRole('button', { name: 'Tải ảnh lên' }).click();
    await expect(page.getByText('Ảnh đã được lưu an toàn.')).toBeVisible();
    await expect(page.getByAltText('Ảnh hiện trạng bảo hành 1')).toBeVisible();

    const evidence = await prisma.warrantyEvidence.findFirstOrThrow({
      where: { warrantyRequestId: owned.id },
      select: { id: true },
    });
    const preview = await page.request.get(
      `/api/v1/warranty/${owned.id}/evidence/${evidence.id}`,
    );
    expect(preview.status()).toBe(200);
    expect(preview.headers()['content-type']).toBe('image/png');

    const afterEvidence = await prisma.warrantyRequest.findUniqueOrThrow({
      where: { id: owned.id },
      select: { version: true },
    });
    const reviewing = await transitionWarrantyRequest(
      fixture.users.staff.actor,
      owned.id,
      {
        expectedVersion: afterEvidence.version,
        nextStatus: 'IN_REVIEW',
        reason: 'E2E customer warranty review',
      },
      `${fixture.namespace}-e2e-review`,
    );
    await transitionWarrantyRequest(
      fixture.users.manager.actor,
      owned.id,
      {
        expectedVersion: reviewing.version,
        nextStatus: 'RESOLVED',
        reason: 'E2E customer warranty resolved',
        publicResolution:
          'The device was inspected and restored to normal operation.',
      },
      `${fixture.namespace}-e2e-resolve`,
    );
    await page.reload();
    await expect(
      page.getByText(
        'The device was inspected and restored to normal operation.',
      ),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Xác nhận đã nhận kết quả' })
      .click();
    await page.getByLabel('Ghi chú xác nhận').fill('Đã nhận kết quả xử lý.');
    await page.getByRole('button', { name: 'Đóng yêu cầu' }).click();
    await expect(page.getByText('Đã đóng').first()).toBeVisible();
    await expect(page.getByTestId('warranty-audit-list')).toContainText(
      'Trạng thái được cập nhật',
    );
    await noHorizontalOverflow(page);

    const denied = await page.request.get(`/api/v1/warranty/${foreign.id}`);
    expect(denied.status()).toBe(404);
    expect(await denied.text()).not.toContain('Private warranty details');
    await page.goto(`/warranty/${foreign.id}`);
    await expect(
      page.getByRole('heading', { name: 'Không tìm thấy trang.' }),
    ).toBeVisible();
    await expect(page.getByText(foreign.requestNumber)).toHaveCount(0);
  } finally {
    await fixture.cleanup();
  }
});

test('customer creates a new eligible installation warranty from the UI', async ({
  page,
}) => {
  const fixture = await createWarrantyFixture();
  try {
    await signIn(page, fixture.users.customerA.email);
    await page.goto('/warranty#create-warranty');
    await page
      .getByLabel('Sản phẩm hoặc dịch vụ')
      .selectOption(`${fixture.orderItems.eligibleInstallation}:INSTALLATION`);
    await page
      .getByLabel('Vấn đề cần hỗ trợ')
      .selectOption('INSTALLATION_QUALITY');
    await page
      .getByLabel('Mô tả chi tiết')
      .fill(
        'The installation requires inspection because the mount is no longer stable.',
      );
    await page.getByRole('button', { name: 'Gửi yêu cầu bảo hành' }).click();
    await expect(page).toHaveURL(/\/warranty\/[a-z0-9]+$/);
    await expect(page.getByText('Bảo hành lắp đặt')).toBeVisible();
    await expect(page.getByTestId('warranty-status-timeline')).toBeVisible();
  } finally {
    await fixture.cleanup();
  }
});
