import { describe, expect, it } from 'vitest';

import {
  decideWarrantyTransition,
  evaluateWarrantyEligibility,
  hasDuplicateWarrantyCoverage,
} from '@/modules/warranty';

describe('customer warranty policy', () => {
  it('evaluates completed device and installation coverage from the order snapshot', () => {
    const completedAt = new Date('2026-01-31T10:00:00.000Z');
    const now = new Date('2026-02-01T00:00:00.000Z');

    expect(
      evaluateWarrantyEligibility({
        orderStatus: 'COMPLETED',
        completedAt,
        warrantyMonths: 1,
        hasServicePackage: true,
        coverageType: 'DEVICE',
        now,
      }),
    ).toEqual({
      eligible: true,
      startsAt: completedAt,
      expiresAt: new Date('2026-02-28T10:00:00.000Z'),
    });
    expect(
      evaluateWarrantyEligibility({
        orderStatus: 'COMPLETED',
        completedAt,
        warrantyMonths: 12,
        hasServicePackage: false,
        coverageType: 'INSTALLATION',
        now,
      }),
    ).toEqual({ eligible: false, reason: 'NO_INSTALLATION_PACKAGE' });
  });

  it('rejects incomplete, expired, and zero-term orders', () => {
    const base = {
      completedAt: new Date('2025-01-01T00:00:00.000Z'),
      warrantyMonths: 12,
      hasServicePackage: true,
      coverageType: 'DEVICE' as const,
      now: new Date('2026-02-01T00:00:00.000Z'),
    };
    expect(
      evaluateWarrantyEligibility({ ...base, orderStatus: 'PROCESSING' }),
    ).toEqual({ eligible: false, reason: 'ORDER_NOT_COMPLETED' });
    expect(
      evaluateWarrantyEligibility({ ...base, orderStatus: 'COMPLETED' }),
    ).toEqual({ eligible: false, reason: 'WARRANTY_EXPIRED' });
    expect(
      evaluateWarrantyEligibility({
        ...base,
        orderStatus: 'COMPLETED',
        warrantyMonths: 0,
      }),
    ).toEqual({ eligible: false, reason: 'NO_WARRANTY_TERM' });
  });

  it('identifies duplicate coverage without replacing the database unique guard', () => {
    expect(hasDuplicateWarrantyCoverage(['DEVICE'], 'DEVICE')).toBe(true);
    expect(hasDuplicateWarrantyCoverage(['DEVICE'], 'INSTALLATION')).toBe(
      false,
    );
  });

  it('enforces customer and processor transitions without allowing skips', () => {
    expect(
      decideWarrantyTransition({
        currentStatus: 'SUBMITTED',
        nextStatus: 'IN_REVIEW',
        roles: ['STAFF'],
        isOwner: false,
      }),
    ).toEqual({ allowed: true });
    expect(
      decideWarrantyTransition({
        currentStatus: 'REJECTED',
        nextStatus: 'CLOSED',
        roles: ['CUSTOMER'],
        isOwner: true,
      }),
    ).toEqual({ allowed: true });
    expect(
      decideWarrantyTransition({
        currentStatus: 'IN_REVIEW',
        nextStatus: 'RESOLVED',
        roles: ['MANAGER'],
        isOwner: false,
      }),
    ).toEqual({ allowed: true });
    expect(
      decideWarrantyTransition({
        currentStatus: 'RESOLVED',
        nextStatus: 'CLOSED',
        roles: ['CUSTOMER'],
        isOwner: true,
      }),
    ).toEqual({ allowed: true });
    expect(
      decideWarrantyTransition({
        currentStatus: 'SUBMITTED',
        nextStatus: 'RESOLVED',
        roles: ['MANAGER'],
        isOwner: false,
      }),
    ).toEqual({ allowed: false, code: 'INVALID_STATE_TRANSITION' });
  });

  it('denies technician and admin mutations even when another role is present', () => {
    for (const roles of [
      ['TECHNICIAN'] as const,
      ['ADMIN', 'MANAGER'] as const,
    ]) {
      expect(
        decideWarrantyTransition({
          currentStatus: 'SUBMITTED',
          nextStatus: 'IN_REVIEW',
          roles,
          isOwner: false,
        }),
      ).toEqual({ allowed: false, code: 'FORBIDDEN' });
    }
  });
});
