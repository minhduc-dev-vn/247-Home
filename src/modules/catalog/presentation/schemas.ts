import { ProductCategory, ProductStatus } from '@prisma/client';
import { z } from 'zod';

const moneyString = z
  .string()
  .regex(/^(0|[1-9]\d{0,14})$/, 'Giá phải là số nguyên VND không âm.');

const shortText = (max: number) => z.string().trim().min(1).max(max);
const optionalMoneyString = moneyString.optional();

export const productListQuerySchema = z
  .object({
    category: z.nativeEnum(ProductCategory).optional(),
    q: z.string().trim().min(1).max(80).optional(),
    minPrice: moneyString.optional(),
    maxPrice: moneyString.optional(),
    cursor: z.string().cuid().optional(),
    limit: z.coerce.number().int().min(1).max(24).default(12),
  })
  .strict();

export const adminListQuerySchema = z
  .object({
    cursor: z.string().cuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export const serviceAreaListQuerySchema = z
  .object({
    cursor: z.string().cuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

export const productInputSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(120),
    name: shortText(160),
    description: shortText(4_000),
    category: z.nativeEnum(ProductCategory),
  })
  .strict();

export const productPatchSchema = productInputSchema
  .partial()
  .extend({ status: z.nativeEnum(ProductStatus).optional() })
  .strict()
  .refine((input) => Object.keys(input).length > 0, 'Có ít nhất một trường.');

export const variantInputSchema = z
  .object({
    productId: z.string().cuid(),
    sku: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9_-]{2,63}$/),
    name: shortText(160),
    priceVnd: optionalMoneyString,
    isActive: z.boolean().optional(),
  })
  .strict();

export const variantPatchSchema = variantInputSchema
  .omit({ productId: true })
  .partial()
  .extend({ isActive: z.boolean().optional() })
  .strict()
  .refine((input) => Object.keys(input).length > 0, 'Có ít nhất một trường.');

export const servicePackageInputSchema = z
  .object({
    productVariantId: z.string().cuid(),
    name: shortText(160),
    description: shortText(1_000),
    priceVnd: optionalMoneyString,
    isActive: z.boolean().optional(),
  })
  .strict();

export const servicePackagePatchSchema = servicePackageInputSchema
  .omit({ productVariantId: true })
  .partial()
  .extend({ isActive: z.boolean().optional() })
  .strict()
  .refine((input) => Object.keys(input).length > 0, 'Có ít nhất một trường.');

export const inventoryAdjustmentSchema = z
  .object({
    delta: z.coerce
      .number()
      .int()
      .min(-100_000)
      .max(100_000)
      .refine((value) => value !== 0),
    expectedVersion: z.coerce.number().int().positive(),
    reason: z.string().trim().min(3).max(300),
  })
  .strict();

export const serviceAreaInputSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{3,40}$/),
    provinceCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{2,32}$/),
    provinceName: shortText(120),
    districtCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{2,32}$/),
    districtName: shortText(120),
    installationFeeVnd: optionalMoneyString,
    shippingFeeVnd: optionalMoneyString,
    isActive: z.boolean().optional(),
  })
  .strict();

export const serviceAreaPatchSchema = serviceAreaInputSchema
  .partial()
  .strict()
  .refine((input) => Object.keys(input).length > 0, 'Có ít nhất một trường.');

export const serviceAreaCheckSchema = z
  .object({
    provinceCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{2,32}$/),
    districtCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{2,32}$/),
  })
  .strict();

export const productImageInputSchema = z
  .object({
    filename: z.string().trim().min(5).max(120),
    contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    contentBase64: z.string().min(4).max(2_800_000),
    altText: shortText(240),
  })
  .strict();

export type ProductListQuery = z.infer<typeof productListQuerySchema>;
export type ProductInput = z.infer<typeof productInputSchema>;
export type ProductPatch = z.infer<typeof productPatchSchema>;
export type VariantInput = z.infer<typeof variantInputSchema>;
export type VariantPatch = z.infer<typeof variantPatchSchema>;
export type ServicePackageInput = z.infer<typeof servicePackageInputSchema>;
export type ServicePackagePatch = z.infer<typeof servicePackagePatchSchema>;
export type InventoryAdjustment = z.infer<typeof inventoryAdjustmentSchema>;
export type ServiceAreaInput = z.infer<typeof serviceAreaInputSchema>;
export type ServiceAreaPatch = z.infer<typeof serviceAreaPatchSchema>;
export type ServiceAreaListQuery = z.infer<typeof serviceAreaListQuerySchema>;
