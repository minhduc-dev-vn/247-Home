import { describe, expect, it } from 'vitest';

import { toServiceDate } from '@/shared/date/service-time';

describe('Vietnam service timezone', () => {
  it('derives date-only values from Asia/Ho_Chi_Minh rather than UTC', () => {
    expect(toServiceDate('2026-07-15T16:59:59.999Z')).toBe('2026-07-15');
    expect(toServiceDate('2026-07-15T17:00:00.000Z')).toBe('2026-07-16');
  });
});
