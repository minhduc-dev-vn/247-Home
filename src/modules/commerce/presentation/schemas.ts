import { PaymentMethod } from '@prisma/client';
import { z } from 'zod';

import { orderActions } from '@/modules/commerce/domain/order-transition';
import { paymentActions } from '@/modules/commerce/domain/payment-transition';

const cuid = z.string().cuid();
const text = (max: number) => z.string().trim().min(1).max(max);

export const cartItemInputSchema = z
  .object({
    productVariantId: cuid,
    servicePackageId: cuid.nullable().optional(),
    quantity: z.coerce.number().int().min(1).max(99),
  })
  .strict();
export const cartItemPatchSchema = z
  .object({ quantity: z.coerce.number().int().min(1).max(99) })
  .strict();
export const addressInputSchema = z
  .object({
    recipientName: text(120),
    phone: z
      .string()
      .trim()
      .regex(/^[0-9+ -]{8,20}$/),
    line1: text(240),
    line2: z.string().trim().max(240).nullable().optional(),
    wardName: text(120),
    districtCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{2,32}$/),
    districtName: text(120),
    provinceCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{2,32}$/),
    provinceName: text(120),
    postalCode: z.string().trim().max(20).nullable().optional(),
    isDefault: z.boolean().optional(),
  })
  .strict();
export const quoteInputSchema = z
  .object({ addressId: cuid, slotId: cuid.nullable().optional() })
  .strict();
export const checkoutInputSchema = z
  .object({
    cartId: cuid,
    addressId: cuid,
    paymentMethod: z.nativeEnum(PaymentMethod),
    slotId: cuid.nullable().optional(),
  })
  .strict();
export const slotQuerySchema = z
  .object({
    serviceAreaId: cuid,
    fromDate: z.string().date(),
    toDate: z.string().date(),
    cursor: cuid.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict()
  .refine((value) => value.fromDate <= value.toDate)
  .refine(
    (value) =>
      Date.parse(`${value.toDate}T00:00:00.000Z`) -
        Date.parse(`${value.fromDate}T00:00:00.000Z`) <=
      31 * 24 * 60 * 60 * 1_000,
    'Khoang ngay khong duoc vuot qua 31 ngay.',
  );
export const addressListQuerySchema = z
  .object({
    cursor: cuid.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();
export const orderListQuerySchema = addressListQuerySchema;
export const orderActionSchema = z
  .object({
    action: z.enum(orderActions),
    expectedVersion: z.coerce.number().int().positive(),
    reason: z.string().trim().min(3).max(300),
  })
  .strict();
export const paymentActionSchema = z
  .object({
    action: z.enum(paymentActions),
    expectedVersion: z.coerce.number().int().positive(),
    reference: z.string().trim().min(3).max(128).optional(),
    reason: z.string().trim().min(3).max(300),
  })
  .strict();

export type CartItemInput = z.infer<typeof cartItemInputSchema>;
export type AddressInput = z.infer<typeof addressInputSchema>;
export type QuoteInput = z.infer<typeof quoteInputSchema>;
export type CheckoutInput = z.infer<typeof checkoutInputSchema>;
export type AddressListQuery = z.infer<typeof addressListQuerySchema>;
export type OrderListQuery = z.infer<typeof orderListQuerySchema>;
export type SlotQuery = z.infer<typeof slotQuerySchema>;
