import { describe, expect, it } from 'vitest';

import { actorHasRole } from '@/modules/identity';
import { canAccessOwnUser } from '@/modules/identity/domain/roles';

const customer = {
  userId: 'customer-1',
  authVersion: 1,
  roles: ['CUSTOMER'] as const,
};

describe('identity authorization', () => {
  it('denies an admin route to a customer actor', () => {
    expect(actorHasRole(customer, ['ADMIN'])).toBe(false);
  });

  it('allows a user to access only their own profile', () => {
    expect(canAccessOwnUser(customer, 'customer-1')).toBe(true);
    expect(canAccessOwnUser(customer, 'customer-2')).toBe(false);
  });
});
