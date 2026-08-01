import { describe, expect, it } from 'vitest';

import {
  adminListQuerySchema,
  productInputSchema,
  productListQuerySchema,
  serviceAreaListQuerySchema,
} from '@/modules/catalog/presentation/schemas';
import {
  addressListQuerySchema,
  cartItemInputSchema,
  checkoutInputSchema,
  orderListQuerySchema,
  slotQuerySchema,
} from '@/modules/commerce/presentation/schemas';
import {
  appointmentQuerySchema,
  auditQuerySchema,
  assignmentSchema,
  eligibleTechnicianQuerySchema,
  operationsOrderQuerySchema,
  paginationSchema,
  technicianAssignmentQuerySchema,
  warrantyQuerySchema,
} from '@/modules/operations/presentation/schemas';
import {
  warrantyAuditListSchema,
  warrantyListSchema,
  warrantyStateSchema,
} from '@/modules/warranty/presentation/schemas';

// Every parameter a link shortener, ad network or social platform is known to
// append to an outbound URL without asking anyone.
const trackingParams = {
  fbclid: 'IwAR0abc123',
  utm_source: 'facebook',
  utm_medium: 'social',
  utm_campaign: 'tet-2026',
  gclid: 'Cj0KCQiA',
  ref: 'newsletter',
};

const cuid = 'cms1yqk8j0000fnh0ze26p402';

const queryCases = [
  {
    name: 'productListQuerySchema',
    schema: productListQuerySchema,
    valid: { limit: '12' },
  },
  { name: 'adminListQuerySchema', schema: adminListQuerySchema, valid: {} },
  {
    name: 'serviceAreaListQuerySchema',
    schema: serviceAreaListQuerySchema,
    valid: {},
  },
  {
    name: 'slotQuerySchema',
    schema: slotQuerySchema,
    valid: {
      serviceAreaId: cuid,
      fromDate: '2026-07-01',
      toDate: '2026-07-10',
    },
  },
  { name: 'addressListQuerySchema', schema: addressListQuerySchema, valid: {} },
  { name: 'orderListQuerySchema', schema: orderListQuerySchema, valid: {} },
  { name: 'paginationSchema', schema: paginationSchema, valid: {} },
  {
    name: 'operationsOrderQuerySchema',
    schema: operationsOrderQuerySchema,
    valid: {},
  },
  {
    name: 'appointmentQuerySchema',
    schema: appointmentQuerySchema,
    valid: {},
  },
  {
    name: 'technicianAssignmentQuerySchema',
    schema: technicianAssignmentQuerySchema,
    valid: {},
  },
  { name: 'warrantyQuerySchema', schema: warrantyQuerySchema, valid: {} },
  { name: 'auditQuerySchema', schema: auditQuerySchema, valid: {} },
  {
    name: 'eligibleTechnicianQuerySchema',
    schema: eligibleTechnicianQuerySchema,
    valid: { appointmentId: cuid },
  },
  { name: 'warrantyListSchema', schema: warrantyListSchema, valid: {} },
  {
    name: 'warrantyAuditListSchema',
    schema: warrantyAuditListSchema,
    valid: {},
  },
] as const;

describe('query schemas tolerate tracking parameters', () => {
  it.each(queryCases)('$name accepts and drops them', ({ schema, valid }) => {
    const parsed = schema.safeParse({ ...valid, ...trackingParams });

    expect(parsed.success).toBe(true);
    for (const key of Object.keys(trackingParams)) {
      expect(parsed.success && parsed.data).not.toHaveProperty(key);
    }
  });

  it('covers every query schema reached through parseSearchParams', () => {
    expect(queryCases).toHaveLength(15);
  });
});

describe('query schemas still reject genuinely invalid values', () => {
  it('rejects a non-numeric limit', () => {
    expect(productListQuerySchema.safeParse({ limit: 'abc' }).success).toBe(
      false,
    );
  });

  it('rejects a limit above the documented maximum', () => {
    expect(productListQuerySchema.safeParse({ limit: '999' }).success).toBe(
      false,
    );
  });

  it('rejects a cursor that is not a cuid', () => {
    expect(
      productListQuerySchema.safeParse({ cursor: 'not-a-cuid' }).success,
    ).toBe(false);
  });

  it('rejects an unknown enum value', () => {
    expect(
      productListQuerySchema.safeParse({ category: 'SPACESHIP' }).success,
    ).toBe(false);
    expect(
      orderListQuerySchema.safeParse({ status: 'NOT_A_STATUS' }).success,
    ).toBe(false);
  });

  it('keeps the slot date-range refinements', () => {
    expect(
      slotQuerySchema.safeParse({
        serviceAreaId: cuid,
        fromDate: '2026-07-10',
        toDate: '2026-07-01',
        ...trackingParams,
      }).success,
    ).toBe(false);
  });
});

describe('body schemas stay strict', () => {
  const bodyCases = [
    {
      name: 'productInputSchema',
      schema: productInputSchema,
      valid: {
        slug: 'camera-1',
        name: 'Camera',
        description: 'Mo ta san pham',
        category: 'SECURITY_CAMERA',
      },
    },
    {
      name: 'cartItemInputSchema',
      schema: cartItemInputSchema,
      valid: { productVariantId: cuid, quantity: 1 },
    },
    {
      name: 'checkoutInputSchema',
      schema: checkoutInputSchema,
      valid: { cartId: cuid, addressId: cuid, paymentMethod: 'COD' },
    },
    {
      name: 'assignmentSchema',
      schema: assignmentSchema,
      valid: { technicianId: cuid, expectedVersion: 1, reason: 'ly do' },
    },
    {
      name: 'warrantyStateSchema',
      schema: warrantyStateSchema,
      valid: {
        expectedVersion: 1,
        nextStatus: 'IN_REVIEW',
        reason: 'ly do',
      },
    },
  ] as const;

  it.each(bodyCases)('$name accepts a clean payload', ({ schema, valid }) => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it.each(bodyCases)('$name rejects an unknown field', ({ schema, valid }) => {
    expect(schema.safeParse({ ...valid, isAdmin: true }).success).toBe(false);
  });

  it.each(bodyCases)(
    '$name rejects tracking parameters',
    ({ schema, valid }) => {
      expect(schema.safeParse({ ...valid, ...trackingParams }).success).toBe(
        false,
      );
    },
  );
});
