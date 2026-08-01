import { z } from 'zod';
import { AppointmentStatus, OrderStatus, WarrantyStatus } from '@prisma/client';

const cuid = z.string().cuid();
export const assignmentSchema = z
  .object({
    technicianId: cuid,
    expectedVersion: z.coerce.number().int().positive(),
    reason: z.string().trim().min(3).max(300),
  })
  .strict();
export const technicianActionSchema = z
  .object({
    action: z.enum(['accept', 'en-route', 'arrive', 'start', 'complete']),
    expectedVersion: z.coerce.number().int().positive(),
    note: z.string().trim().min(3).max(1000).optional(),
  })
  .strict();

// Query schemas strip unknown keys instead of rejecting them: shared links
// arrive carrying tracking parameters (fbclid, utm_*, gclid) that neither the
// user nor this application put there. The schemas extended from this one
// inherit that behaviour. Body schemas stay strict.
export const paginationSchema = z
  .object({
    cursor: cuid.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strip();

export const operationsOrderQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(OrderStatus).optional(),
});
export const appointmentQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(AppointmentStatus).optional(),
});
export const technicianAssignmentQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(AppointmentStatus).optional(),
});
export const warrantyQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(WarrantyStatus).optional(),
});
export const auditQuerySchema = paginationSchema.extend({
  action: z.string().trim().min(1).max(120).optional(),
  targetId: cuid.optional(),
  targetType: z.string().trim().min(1).max(80).optional(),
});

export const eligibleTechnicianQuerySchema = paginationSchema
  .extend({
    appointmentId: cuid,
    search: z.string().trim().min(1).max(100).optional(),
  })
  .strip();
export const evidenceSchema = z
  .object({
    filename: z.string().trim().min(5).max(160),
    contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    contentBase64: z.string().min(4).max(7_000_000),
  })
  .strict();
export const rescheduleSchema = z
  .object({
    slotId: cuid,
    expectedVersion: z.coerce.number().int().positive(),
    reason: z.string().trim().min(3).max(300),
  })
  .strict();
