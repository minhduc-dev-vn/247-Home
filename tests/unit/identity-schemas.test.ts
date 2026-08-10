import { describe, expect, it } from 'vitest';

import {
  loginSchema,
  registrationSchema,
  resetPasswordSchema,
} from '@/modules/identity/presentation/schemas';

const eightCharacterPassword = 'Pass247!';
const sevenCharacterPassword = 'Pass247';

describe('identity password policy', () => {
  it('accepts an eight-character password for registration, login and reset', () => {
    expect(
      registrationSchema.safeParse({
        name: 'Schema Customer',
        email: 'schema-customer@example.test',
        password: eightCharacterPassword,
      }).success,
    ).toBe(true);
    expect(
      loginSchema.safeParse({
        email: 'schema-customer@example.test',
        password: eightCharacterPassword,
      }).success,
    ).toBe(true);
    expect(
      resetPasswordSchema.safeParse({
        token: 'a'.repeat(32),
        password: eightCharacterPassword,
      }).success,
    ).toBe(true);
  });

  it('rejects passwords shorter than eight characters', () => {
    expect(
      registrationSchema.safeParse({
        name: 'Schema Customer',
        email: 'schema-customer@example.test',
        password: sevenCharacterPassword,
      }).success,
    ).toBe(false);
  });
});
