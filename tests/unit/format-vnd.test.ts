import { describe, expect, it } from 'vitest';

import { formatVnd } from '@/shared/money/format-vnd';

describe('formatVnd', () => {
  it('formats decimal strings without converting them to Number', () => {
    expect(formatVnd('9007199254740993')).toBe('9.007.199.254.740.993 VND');
    expect(formatVnd('-1200000')).toBe('-1.200.000 VND');
  });

  it('accepts bigint and rejects non-integer decimal input', () => {
    expect(formatVnd(12345678901234567890n)).toBe(
      '12.345.678.901.234.567.890 VND',
    );
    expect(() => formatVnd('1.5')).toThrow('VND value must be an integer.');
  });
});
