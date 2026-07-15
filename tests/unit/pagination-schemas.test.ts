import { describe, expect, it } from 'vitest';

import { serviceAreaListQuerySchema } from '@/modules/catalog';
import {
  addressListQuerySchema,
  orderListQuerySchema,
  slotQuerySchema,
} from '@/modules/commerce';

describe('bounded list query contracts', () => {
  it.each([
    addressListQuerySchema,
    orderListQuerySchema,
    serviceAreaListQuerySchema,
  ])('defaults to 25 and caps list pages at 100', (schema) => {
    expect(schema.parse({})).toMatchObject({ limit: 25 });
    expect(schema.parse({ limit: '100' })).toMatchObject({ limit: 100 });
    expect(schema.safeParse({ limit: '101' }).success).toBe(false);
  });

  it('caps installation-slot date ranges and page size', () => {
    const base = {
      serviceAreaId: 'cm12345678901234567890123',
      fromDate: '2026-08-01',
      toDate: '2026-09-01',
    };
    expect(slotQuerySchema.parse(base)).toMatchObject({ limit: 25 });
    expect(
      slotQuerySchema.safeParse({ ...base, toDate: '2026-09-02' }).success,
    ).toBe(false);
    expect(slotQuerySchema.safeParse({ ...base, limit: 101 }).success).toBe(
      false,
    );
  });
});
