import { describe, expect, it } from 'vitest';

import { eligibleTechnicianQuerySchema } from '@/modules/operations';

describe('eligible technician query schema', () => {
  const appointmentId = 'cmrk4zx8w0000fnx0p1g4mabc';

  it('uses a bounded default page and supports a bounded search term', () => {
    expect(
      eligibleTechnicianQuerySchema.parse({
        appointmentId,
        search: ' Technician ',
      }),
    ).toEqual({ appointmentId, limit: 25, search: 'Technician' });
  });

  it('rejects a page larger than the API maximum', () => {
    expect(
      eligibleTechnicianQuerySchema.safeParse({ appointmentId, limit: 101 })
        .success,
    ).toBe(false);
  });
});
