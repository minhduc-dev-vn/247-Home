import {
  AppointmentStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  appointmentStatusPresentation,
  orderStatusPresentation,
  paymentMethodLabels,
  paymentStatusPresentation,
} from '@/components/commerce/order-status';

describe('customer order status presentation', () => {
  it('maps every backend order status to a customer label', () => {
    expect(Object.keys(orderStatusPresentation).sort()).toEqual(
      Object.values(OrderStatus).sort(),
    );
    for (const status of Object.values(OrderStatus)) {
      expect(orderStatusPresentation[status].label).not.toBe(status);
      expect(orderStatusPresentation[status].description.length).toBeGreaterThan(
        10,
      );
    }
  });

  it('maps every payment and appointment state without inventing values', () => {
    expect(Object.keys(paymentStatusPresentation).sort()).toEqual(
      Object.values(PaymentStatus).sort(),
    );
    expect(Object.keys(appointmentStatusPresentation).sort()).toEqual(
      Object.values(AppointmentStatus).sort(),
    );
    expect(Object.keys(paymentMethodLabels).sort()).toEqual(
      Object.values(PaymentMethod).sort(),
    );
  });
});
