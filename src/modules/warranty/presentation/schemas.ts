import { z } from 'zod';

import {
  warrantyCoverageTypes,
  warrantyStates,
} from '@/modules/warranty/domain/warranty-policy';

export const warrantyIssueTypes = [
  'DEVICE_NOT_WORKING',
  'INSTALLATION_QUALITY',
  'PHYSICAL_DAMAGE',
  'OTHER',
] as const;

export const warrantyListSchema = z
  .object({
    status: z.enum(warrantyStates).optional(),
    cursor: z.string().cuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

const warrantyCreateFields = {
  coverageType: z.enum(warrantyCoverageTypes).default('DEVICE'),
  issueType: z.enum(warrantyIssueTypes).default('OTHER'),
  description: z.string().trim().min(20).max(2000),
  contactPhone: z
    .string()
    .trim()
    .min(8)
    .max(20)
    .regex(/^\+?[0-9][0-9 -]+$/)
    .optional(),
};

export const warrantyCreateSchema = z.union([
  z
    .object({
      orderId: z.string().cuid(),
      productId: z.string().cuid(),
      ...warrantyCreateFields,
    })
    .strict(),
  z
    .object({
      orderItemId: z.string().cuid(),
      ...warrantyCreateFields,
    })
    .strict(),
]);

export const warrantyStateSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    nextStatus: z.enum(warrantyStates),
    reason: z.string().trim().min(3).max(500),
    publicResolution: z.string().trim().min(3).max(2000).optional(),
    internalNote: z.string().trim().min(3).max(2000).optional(),
  })
  .strict();

export const warrantyEvidenceSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    filename: z.string().trim().min(1).max(255),
    contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    contentBase64: z.string().min(4).max(7_000_000),
  })
  .strict();

export const warrantyAuditListSchema = z
  .object({
    cursor: z.string().cuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

export type WarrantyCreateInput = z.output<typeof warrantyCreateSchema>;
export type WarrantyStateInput = z.output<typeof warrantyStateSchema>;
export type WarrantyEvidenceInput = z.output<typeof warrantyEvidenceSchema>;
export type WarrantyListInput = z.output<typeof warrantyListSchema>;
export type WarrantyAuditListInput = z.output<typeof warrantyAuditListSchema>;
