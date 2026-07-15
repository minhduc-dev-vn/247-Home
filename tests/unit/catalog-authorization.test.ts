import { describe, expect, it } from 'vitest';

import {
  CatalogError,
  requireCatalogAccess,
  requirePriceAccess,
} from '@/modules/catalog';
import { type IdentityActor } from '@/modules/identity';

const customer: IdentityActor = {
  userId: 'customer',
  authVersion: 1,
  roles: ['CUSTOMER'],
};
const staff: IdentityActor = {
  userId: 'staff',
  authVersion: 1,
  roles: ['STAFF'],
};
const manager: IdentityActor = {
  userId: 'manager',
  authVersion: 1,
  roles: ['MANAGER'],
};

describe('catalog authorization', () => {
  it('rejects customer access to catalog administration', () => {
    expect(() => requireCatalogAccess(customer)).toThrow(CatalogError);
    expect(() => requireCatalogAccess(customer)).toThrow('FORBIDDEN');
  });

  it('allows staff catalog access but keeps price changes for manager or admin', () => {
    expect(requireCatalogAccess(staff)).toBe(staff);
    expect(() => requirePriceAccess(staff)).toThrow('FORBIDDEN');
    expect(requirePriceAccess(manager)).toBe(manager);
  });
});
