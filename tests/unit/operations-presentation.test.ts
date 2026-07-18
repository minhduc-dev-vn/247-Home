import { AppointmentStatus, OrderStatus, WarrantyStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  getOperationsStatusMeta,
  operationsAppointmentStatuses,
  operationsOrderStatuses,
  operationsWarrantyStatuses,
} from '@/components/operations/operations-presentation';

describe('operations status presentation', () => {
  it('covers every order, appointment and warranty state from the backend', () => {
    expect(Object.keys(operationsOrderStatuses).sort()).toEqual(
      Object.values(OrderStatus).sort(),
    );
    expect(Object.keys(operationsAppointmentStatuses).sort()).toEqual(
      Object.values(AppointmentStatus).sort(),
    );
    expect(Object.keys(operationsWarrantyStatuses).sort()).toEqual(
      Object.values(WarrantyStatus).sort(),
    );
  });

  it('falls back safely for an unknown future status', () => {
    expect(getOperationsStatusMeta('order', 'FUTURE_STATE')).toEqual({
      label: 'FUTURE_STATE',
      variant: 'default',
    });
  });
});
