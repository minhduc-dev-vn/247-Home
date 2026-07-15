import { AppointmentStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { authorizeInstallationTransition } from '@/modules/operations';
import { type IdentityActor } from '@/modules/identity';

const manager: IdentityActor = {
  userId: 'manager',
  authVersion: 1,
  roles: ['MANAGER'],
};
const technician: IdentityActor = {
  userId: 'technician',
  authVersion: 1,
  roles: ['TECHNICIAN'],
};

describe('installation transition policy', () => {
  it.each([
    ['en-route', AppointmentStatus.ASSIGNED, AppointmentStatus.EN_ROUTE],
    ['arrive', AppointmentStatus.EN_ROUTE, AppointmentStatus.ARRIVED],
    ['start', AppointmentStatus.ARRIVED, AppointmentStatus.IN_PROGRESS],
    ['complete', AppointmentStatus.IN_PROGRESS, AppointmentStatus.COMPLETED],
  ] as const)('allows %s only in sequence', (action, current, next) => {
    expect(
      authorizeInstallationTransition({
        actor: technician,
        action,
        current,
        ownsActiveAssignment: true,
      }),
    ).toEqual({ next, idempotent: false });
  });

  it('uses acceptedAt without adding a confirmation state', () => {
    expect(
      authorizeInstallationTransition({
        actor: technician,
        action: 'accept',
        current: AppointmentStatus.ASSIGNED,
        ownsActiveAssignment: true,
        alreadyAccepted: true,
      }),
    ).toEqual({ next: AppointmentStatus.ASSIGNED, idempotent: true });
  });

  it('rejects skipping ARRIVED and defaults to deny', () => {
    expect(() =>
      authorizeInstallationTransition({
        actor: technician,
        action: 'start',
        current: AppointmentStatus.EN_ROUTE,
        ownsActiveAssignment: true,
      }),
    ).toThrowError(
      expect.objectContaining({ code: 'INVALID_STATE_TRANSITION' }),
    );
    expect(() =>
      authorizeInstallationTransition({
        actor: technician,
        action: 'arrive',
        current: AppointmentStatus.EN_ROUTE,
        ownsActiveAssignment: false,
      }),
    ).toThrowError(expect.objectContaining({ code: 'FORBIDDEN' }));
  });

  it('limits assign and cancellation to manager policy and valid states', () => {
    expect(
      authorizeInstallationTransition({
        actor: manager,
        action: 'assign',
        current: AppointmentStatus.ASSIGNMENT_PENDING,
      }).next,
    ).toBe(AppointmentStatus.ASSIGNED);
    expect(() =>
      authorizeInstallationTransition({
        actor: manager,
        action: 'cancel',
        current: AppointmentStatus.EN_ROUTE,
      }),
    ).toThrowError(
      expect.objectContaining({ code: 'INVALID_STATE_TRANSITION' }),
    );
  });
});
