import { Buffer } from 'node:buffer';

import { expect, test } from '@playwright/test';

import {
  login,
  requestJson,
  requestStatus,
  withOperationsE2eFixture,
} from './operations.helpers';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL4wAAAABJRU5ErkJggg==',
  'base64',
);

type AssignmentDetail = {
  id: string;
  appointment: { id: string; status: string; version: number };
  evidence: Array<{ id: string }>;
};

test('assigned technician completes the installation workflow and rejects a concurrent en-route submit', async ({
  browser,
}) => {
  await withOperationsE2eFixture(browser, async ({ fixture, newContext }) => {
    const context = await newContext();
    const page = await context.newPage();
    const assignmentUrl = `/api/v1/technician/assignments/${fixture.appointments.assigned.assignmentId}`;
    const actionsUrl = `${assignmentUrl}/actions`;

    await login(page, fixture.users.technicianA.email);
    await page.goto('/technician');
    await page.getByLabel('Trang thai').selectOption('ASSIGNED');

    const job = page.locator('tr', {
      hasText: fixture.appointments.assigned.orderNumber,
    });
    await expect(job).toContainText('ASSIGNED');

    const invalidStart = await requestJson<{ error: { code: string } }>(
      page,
      actionsUrl,
      {
        method: 'POST',
        body: {
          action: 'start',
          expectedVersion: fixture.appointments.assigned.version,
        },
      },
    );
    expect(invalidStart.status).toBe(409);
    expect(invalidStart.body.error.code).toBe('INVALID_STATE_TRANSITION');

    await job.getByRole('button', { name: 'Chi tiet' }).click();
    const dialog = page.getByRole('dialog', { name: 'Chi tiet cong viec' });
    await expect(
      dialog.getByText('Fixture installation product'),
    ).toBeVisible();
    await expect(dialog.getByText('Fixture District').first()).toBeVisible();

    await dialog.getByRole('button', { name: 'Nhan viec' }).click();
    await expect(dialog.getByText(/^Nhan viec:/)).toBeVisible();
    const accepted = await requestJson<{ data: AssignmentDetail }>(
      page,
      assignmentUrl,
    );
    expect(accepted.status).toBe(200);
    const expectedVersion = accepted.body.data.appointment.version;
    expect(accepted.body.data.appointment.status).toBe('ASSIGNED');

    const concurrent = await Promise.all([
      requestJson<{ data?: { version: number }; error?: { code: string } }>(
        page,
        actionsUrl,
        {
          method: 'POST',
          body: { action: 'en-route', expectedVersion },
        },
      ),
      requestJson<{ data?: { version: number }; error?: { code: string } }>(
        page,
        actionsUrl,
        {
          method: 'POST',
          body: { action: 'en-route', expectedVersion },
        },
      ),
    ]);
    expect(concurrent.map(({ status }) => status).sort()).toEqual([200, 409]);
    expect(concurrent.find(({ status }) => status === 409)?.body.error).toEqual(
      expect.objectContaining({ code: 'CONFLICT' }),
    );

    const afterConcurrent = await requestJson<{ data: AssignmentDetail }>(
      page,
      assignmentUrl,
    );
    expect(afterConcurrent.body.data.appointment).toMatchObject({
      status: 'EN_ROUTE',
      version: expectedVersion + 1,
    });

    await page.reload();
    await page.getByLabel('Trang thai').selectOption('EN_ROUTE');
    const enRouteJob = page.locator('tr', {
      hasText: fixture.appointments.assigned.orderNumber,
    });
    await expect(enRouteJob).toContainText('EN_ROUTE');
    await enRouteJob.getByRole('button', { name: 'Chi tiet' }).click();
    const refreshedDialog = page.getByRole('dialog', {
      name: 'Chi tiet cong viec',
    });
    await expect(
      refreshedDialog.getByText('EN_ROUTE', { exact: true }),
    ).toBeVisible();

    await refreshedDialog.getByRole('button', { name: 'Da den' }).click();
    await expect(
      refreshedDialog.getByRole('button', { name: 'Bat dau cong viec' }),
    ).toBeVisible();
    await refreshedDialog
      .getByRole('button', { name: 'Bat dau cong viec' })
      .click();
    await expect(
      refreshedDialog.getByRole('button', { name: 'Hoan thanh' }),
    ).toBeVisible();

    await refreshedDialog.getByLabel('Anh nghiem thu').setInputFiles({
      name: 'completion.png',
      mimeType: 'image/png',
      buffer: png,
    });
    await refreshedDialog.getByRole('button', { name: 'Tai evidence' }).click();
    await expect(
      refreshedDialog.getByRole('img', { name: /Evidence/ }),
    ).toBeVisible();

    const afterUpload = await requestJson<{ data: AssignmentDetail }>(
      page,
      assignmentUrl,
    );
    const evidenceId = afterUpload.body.data.evidence[0]?.id;
    expect(evidenceId).toBeTruthy();
    await expect(
      requestStatus(page, `/api/v1/operations/evidence/${evidenceId}`),
    ).resolves.toMatchObject({ status: 200, contentType: 'image/png' });

    await refreshedDialog
      .getByLabel('Ghi chu ket qua')
      .fill('Da lap dat va kiem tra nghiem thu.');
    await refreshedDialog.getByRole('button', { name: 'Hoan thanh' }).click();
    await expect(
      refreshedDialog.getByText('COMPLETED', { exact: true }),
    ).toBeVisible();
    await expect(
      refreshedDialog.getByText('Ket qua: Da lap dat va kiem tra nghiem thu.'),
    ).toBeVisible();

    const managerContext = await newContext();
    const managerPage = await managerContext.newPage();
    await login(managerPage, fixture.users.manager.email);
    const [appointments, orders, audit, evidenceAudit] = await Promise.all([
      requestJson<{
        data: { items: Array<{ id: string; status: string }> };
      }>(managerPage, '/api/v1/admin/operations/appointments?limit=100'),
      requestJson<{
        data: { items: Array<{ id: string; status: string }> };
      }>(managerPage, '/api/v1/admin/operations/orders?limit=100'),
      requestJson<{
        data: { items: Array<{ action: string; targetId: string }> };
      }>(
        managerPage,
        `/api/v1/admin/operations/audit?limit=100&targetId=${fixture.appointments.assigned.id}`,
      ),
      requestJson<{
        data: { items: Array<{ action: string; targetId: string }> };
      }>(
        managerPage,
        `/api/v1/admin/operations/audit?limit=100&targetId=${fixture.appointments.assigned.assignmentId}`,
      ),
    ]);
    expect(
      appointments.body.data.items.find(
        (item) => item.id === fixture.appointments.assigned.id,
      ),
    ).toMatchObject({ status: 'COMPLETED' });
    expect(
      orders.body.data.items.find(
        (item) => item.id === fixture.appointments.assigned.orderId,
      ),
    ).toMatchObject({ status: 'COMPLETED' });
    expect(
      audit.body.data.items.filter(
        (item) =>
          item.action === 'operations.technician-en-route' &&
          item.targetId === fixture.appointments.assigned.id,
      ),
    ).toHaveLength(1);
    expect(audit.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'operations.technician-arrive',
          targetId: fixture.appointments.assigned.id,
        }),
        expect.objectContaining({
          action: 'operations.technician-start',
          targetId: fixture.appointments.assigned.id,
        }),
        expect.objectContaining({
          action: 'operations.technician-complete',
          targetId: fixture.appointments.assigned.id,
        }),
      ]),
    );
    expect(evidenceAudit.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'operations.installation-evidence-added',
          targetId: fixture.appointments.assigned.assignmentId,
        }),
      ]),
    );
  });
});
