import {
  type Prisma,
  ProductStatus,
  type ProductCategory,
} from '@prisma/client';

import { requireCatalogAccess, requirePriceAccess } from './authorization';
import {
  getAvailability,
  moneyToString,
  type PublicAvailability,
} from '@/modules/catalog/domain/catalog';
import { CatalogError } from '@/modules/catalog/domain/errors';
import { lockInventory } from '@/modules/catalog/infrastructure/inventory-repository';
import {
  type InventoryAdjustment,
  type ProductInput,
  type ProductListQuery,
  type ProductPatch,
  type ServiceAreaInput,
  type ServiceAreaListQuery,
  type ServiceAreaPatch,
  type ServicePackageInput,
  type ServicePackagePatch,
  type VariantInput,
  type VariantPatch,
} from '@/modules/catalog/presentation/schemas';
import { type IdentityActor } from '@/modules/identity';
import { prisma } from '@/shared/db/client';

const publicProductSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  category: true,
  images: {
    orderBy: { sortOrder: 'asc' },
    take: 1,
    select: { id: true, altText: true },
  },
  variants: {
    where: { isActive: true },
    orderBy: { priceVnd: 'asc' },
    select: {
      id: true,
      sku: true,
      name: true,
      priceVnd: true,
      inventory: { select: { onHand: true, reserved: true } },
    },
  },
} satisfies Prisma.ProductSelect;

function publicVariant(variant: {
  id: string;
  sku: string;
  name: string;
  priceVnd: bigint;
  inventory: { onHand: number; reserved: number } | null;
}) {
  return {
    id: variant.id,
    sku: variant.sku,
    name: variant.name,
    priceVnd: moneyToString(variant.priceVnd),
    availability: getAvailability(variant.inventory),
  };
}

function publicProduct(
  product: Prisma.ProductGetPayload<{ select: typeof publicProductSelect }>,
) {
  const variants = product.variants.map(publicVariant);
  const minPrice = variants.at(0)?.priceVnd ?? null;
  const availability: PublicAvailability = variants.some(
    (variant) => variant.availability === 'IN_STOCK',
  )
    ? 'IN_STOCK'
    : 'OUT_OF_STOCK';

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    category: product.category,
    minPriceVnd: minPrice,
    availability,
    image: product.images.at(0)
      ? { id: product.images[0].id, altText: product.images[0].altText }
      : null,
    variants,
  };
}

function toBigInt(value: string | undefined, fallback = 0n): bigint {
  return value === undefined ? fallback : BigInt(value);
}

function priceAudit(value: bigint) {
  return { priceVnd: moneyToString(value) };
}

function serviceAreaDto<
  T extends { installationFee: bigint; shippingFee: bigint },
>({ installationFee, shippingFee, ...serviceArea }: T) {
  return {
    ...serviceArea,
    installationFeeVnd: moneyToString(installationFee),
    shippingFeeVnd: moneyToString(shippingFee),
  };
}

export async function listPublicProducts(query: ProductListQuery) {
  const priceFilter = {
    isActive: true,
    ...(query.minPrice ? { priceVnd: { gte: BigInt(query.minPrice) } } : {}),
    ...(query.maxPrice ? { priceVnd: { lte: BigInt(query.maxPrice) } } : {}),
  };
  const products = await prisma.product.findMany({
    where: {
      status: ProductStatus.ACTIVE,
      ...(query.category ? { category: query.category } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { description: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.minPrice || query.maxPrice
        ? { variants: { some: priceFilter } }
        : {}),
    },
    select: publicProductSelect,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    take: query.limit + 1,
  });
  const hasNextPage = products.length > query.limit;
  const items = products.slice(0, query.limit).map(publicProduct);

  return {
    items,
    nextCursor: hasNextPage ? (items.at(-1)?.id ?? null) : null,
  };
}

export async function getPublicProduct(slug: string) {
  const product = await prisma.product.findFirst({
    where: { slug, status: ProductStatus.ACTIVE },
    select: {
      ...publicProductSelect,
      images: {
        orderBy: { sortOrder: 'asc' },
        select: { id: true, altText: true },
      },
      variants: {
        where: { isActive: true },
        orderBy: { priceVnd: 'asc' },
        select: {
          id: true,
          sku: true,
          name: true,
          priceVnd: true,
          inventory: { select: { onHand: true, reserved: true } },
          servicePackages: {
            where: { isActive: true },
            orderBy: { priceVnd: 'asc' },
            select: { id: true, name: true, description: true, priceVnd: true },
          },
        },
      },
    },
  });
  if (!product) {
    return null;
  }
  return {
    ...publicProduct(product),
    images: product.images.map((image) => ({
      id: image.id,
      altText: image.altText,
    })),
    variants: product.variants.map((variant) => ({
      ...publicVariant(variant),
      servicePackages: variant.servicePackages.map((servicePackage) => ({
        id: servicePackage.id,
        name: servicePackage.name,
        description: servicePackage.description,
        priceVnd: moneyToString(servicePackage.priceVnd),
      })),
    })),
  };
}

export async function checkServiceArea(
  provinceCode: string,
  districtCode: string,
) {
  const area = await prisma.serviceArea.findFirst({
    where: { provinceCode, districtCode, isActive: true },
    select: {
      code: true,
      provinceName: true,
      districtName: true,
      installationFee: true,
      shippingFee: true,
    },
  });
  if (!area) return { status: 'UNSUPPORTED' as const, area: null };
  const { installationFee, shippingFee, ...publicArea } = area;
  return {
    status: 'SUPPORTED' as const,
    area: {
      ...publicArea,
      installationFeeVnd: moneyToString(installationFee),
      shippingFeeVnd: moneyToString(shippingFee),
    },
  };
}

export async function listAdminProducts(cursor?: string, limit = 20) {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      category: true,
      status: true,
      updatedAt: true,
      variants: {
        select: {
          id: true,
          sku: true,
          name: true,
          priceVnd: true,
          isActive: true,
          inventory: {
            select: { onHand: true, reserved: true, version: true },
          },
        },
      },
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: limit + 1,
  });
  const hasNextPage = products.length > limit;
  const items = products.slice(0, limit).map((product) => ({
    ...product,
    variants: product.variants.map((variant) => ({
      ...variant,
      priceVnd: moneyToString(variant.priceVnd),
      inventory: variant.inventory
        ? {
            available: variant.inventory.onHand - variant.inventory.reserved,
            onHand: variant.inventory.onHand,
            reserved: variant.inventory.reserved,
            version: variant.inventory.version,
          }
        : null,
    })),
  }));
  return { items, nextCursor: hasNextPage ? (items.at(-1)?.id ?? null) : null };
}

export async function createProduct(
  actor: IdentityActor | null,
  input: ProductInput,
) {
  requireCatalogAccess(actor);
  return prisma.product.create({
    data: { ...input, status: ProductStatus.DRAFT },
  });
}

export async function addProductImage(
  actor: IdentityActor | null,
  productId: string,
  image: {
    storageKey: string;
    altText: string;
    mimeType: string;
    byteSize: number;
  },
) {
  requireCatalogAccess(actor);
  return prisma.$transaction(async (transaction) => {
    const product = await transaction.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) throw new CatalogError('NOT_FOUND');
    const previous = await transaction.productImage.findFirst({
      where: { productId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    return transaction.productImage.create({
      data: { productId, ...image, sortOrder: (previous?.sortOrder ?? -1) + 1 },
    });
  });
}

export async function getPublicImage(imageId: string) {
  return prisma.productImage.findFirst({
    where: { id: imageId, product: { status: ProductStatus.ACTIVE } },
    select: { storageKey: true, mimeType: true },
  });
}

export async function updateProduct(
  actor: IdentityActor | null,
  id: string,
  input: ProductPatch,
) {
  requireCatalogAccess(actor);
  const current = await prisma.product.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!current) throw new CatalogError('NOT_FOUND');

  if (input.status === ProductStatus.ACTIVE) {
    const activeVariant = await prisma.productVariant.findFirst({
      where: { productId: id, isActive: true },
      select: { id: true },
    });
    if (!activeVariant) {
      throw new CatalogError('CONFLICT', 'Cần ít nhất một biến thể đang bán.');
    }
  }
  return prisma.product.update({ where: { id }, data: input });
}

export async function archiveProduct(actor: IdentityActor | null, id: string) {
  requireCatalogAccess(actor);
  return updateProduct(actor, id, { status: ProductStatus.ARCHIVED });
}

export async function createVariant(
  actor: IdentityActor | null,
  input: VariantInput,
  requestId: string,
) {
  const catalogActor = requireCatalogAccess(actor);
  const price = toBigInt(input.priceVnd);
  if (price > 0n) requirePriceAccess(catalogActor);
  return prisma.$transaction(async (transaction) => {
    const product = await transaction.product.findUnique({
      where: { id: input.productId },
      select: { id: true },
    });
    if (!product) throw new CatalogError('NOT_FOUND');
    const variant = await transaction.productVariant.create({
      data: {
        productId: input.productId,
        sku: input.sku,
        name: input.name,
        priceVnd: price,
        isActive: input.isActive ?? true,
        inventory: { create: { onHand: 0, reserved: 0, version: 1 } },
      },
    });
    if (price > 0n) {
      await transaction.auditLog.create({
        data: {
          actorUserId: catalogActor.userId,
          action: 'catalog.variant-price-created',
          targetType: 'product_variant',
          targetId: variant.id,
          before: {},
          after: priceAudit(price),
          requestId,
        },
      });
    }
    return variant;
  });
}

export async function updateVariant(
  actor: IdentityActor | null,
  id: string,
  input: VariantPatch,
  requestId: string,
) {
  const catalogActor = requireCatalogAccess(actor);
  return prisma.$transaction(async (transaction) => {
    const current = await transaction.productVariant.findUnique({
      where: { id },
    });
    if (!current) throw new CatalogError('NOT_FOUND');
    const nextPrice =
      input.priceVnd === undefined ? current.priceVnd : BigInt(input.priceVnd);
    if (nextPrice !== current.priceVnd) requirePriceAccess(catalogActor);
    const variant = await transaction.productVariant.update({
      where: { id },
      data: {
        ...(input.sku !== undefined ? { sku: input.sku } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.priceVnd !== undefined ? { priceVnd: nextPrice } : {}),
      },
    });
    if (nextPrice !== current.priceVnd) {
      await transaction.auditLog.create({
        data: {
          actorUserId: catalogActor.userId,
          action: 'catalog.variant-price-updated',
          targetType: 'product_variant',
          targetId: id,
          before: priceAudit(current.priceVnd),
          after: priceAudit(nextPrice),
          requestId,
        },
      });
    }
    return variant;
  });
}

export async function deactivateVariant(
  actor: IdentityActor | null,
  id: string,
  requestId: string,
) {
  return updateVariant(actor, id, { isActive: false }, requestId);
}

export async function adjustInventory(
  actor: IdentityActor | null,
  variantId: string,
  input: InventoryAdjustment,
  requestId: string,
) {
  const catalogActor = requireCatalogAccess(actor);
  return prisma.$transaction(async (transaction) => {
    const current = await lockInventory(transaction, variantId);
    if (!current) throw new CatalogError('NOT_FOUND');
    if (current.version !== input.expectedVersion) {
      throw new CatalogError('CONFLICT', 'Tồn kho đã được cập nhật.');
    }
    const nextOnHand = current.onHand + input.delta;
    if (nextOnHand < current.reserved || nextOnHand < 0) {
      throw new CatalogError(
        'INVENTORY_CONFLICT',
        'Tồn kho không đủ cho điều chỉnh này.',
      );
    }
    const updated = await transaction.inventory.updateMany({
      where: { productVariantId: variantId, version: input.expectedVersion },
      data: { onHand: nextOnHand, version: { increment: 1 } },
    });
    if (updated.count !== 1) throw new CatalogError('CONFLICT');
    const after = {
      onHand: nextOnHand,
      reserved: current.reserved,
      version: current.version + 1,
    };
    await transaction.auditLog.create({
      data: {
        actorUserId: catalogActor.userId,
        action: 'inventory.adjusted',
        targetType: 'inventory',
        targetId: variantId,
        before: {
          onHand: current.onHand,
          reserved: current.reserved,
          version: current.version,
        },
        after,
        reason: input.reason,
        requestId,
      },
    });
    return { ...after, available: nextOnHand - current.reserved };
  });
}

export async function createServicePackage(
  actor: IdentityActor | null,
  input: ServicePackageInput,
  requestId: string,
) {
  const catalogActor = requireCatalogAccess(actor);
  const price = toBigInt(input.priceVnd);
  if (price > 0n) requirePriceAccess(catalogActor);
  return prisma.$transaction(async (transaction) => {
    const servicePackage = await transaction.servicePackage.create({
      data: {
        productVariantId: input.productVariantId,
        name: input.name,
        description: input.description,
        priceVnd: price,
        isActive: input.isActive ?? true,
      },
    });
    if (price > 0n) {
      await transaction.auditLog.create({
        data: {
          actorUserId: catalogActor.userId,
          action: 'catalog.service-package-price-created',
          targetType: 'service_package',
          targetId: servicePackage.id,
          before: {},
          after: priceAudit(price),
          requestId,
        },
      });
    }
    return servicePackage;
  });
}

export async function updateServicePackage(
  actor: IdentityActor | null,
  id: string,
  input: ServicePackagePatch,
  requestId: string,
) {
  const catalogActor = requireCatalogAccess(actor);
  return prisma.$transaction(async (transaction) => {
    const current = await transaction.servicePackage.findUnique({
      where: { id },
    });
    if (!current) throw new CatalogError('NOT_FOUND');
    const nextPrice =
      input.priceVnd === undefined ? current.priceVnd : BigInt(input.priceVnd);
    if (nextPrice !== current.priceVnd) requirePriceAccess(catalogActor);
    const servicePackage = await transaction.servicePackage.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.priceVnd !== undefined ? { priceVnd: nextPrice } : {}),
      },
    });
    if (nextPrice !== current.priceVnd) {
      await transaction.auditLog.create({
        data: {
          actorUserId: catalogActor.userId,
          action: 'catalog.service-package-price-updated',
          targetType: 'service_package',
          targetId: id,
          before: priceAudit(current.priceVnd),
          after: priceAudit(nextPrice),
          requestId,
        },
      });
    }
    return servicePackage;
  });
}

export async function deactivateServicePackage(
  actor: IdentityActor | null,
  id: string,
  requestId: string,
) {
  return updateServicePackage(actor, id, { isActive: false }, requestId);
}

export async function listServiceAreas(
  adminOnly = false,
  input: ServiceAreaListQuery = { limit: 25 },
) {
  const areas = await prisma.serviceArea.findMany({
    where: adminOnly ? undefined : { isActive: true },
    orderBy: [{ provinceName: 'asc' }, { districtName: 'asc' }, { id: 'asc' }],
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    take: input.limit + 1,
    select: {
      id: true,
      code: true,
      provinceCode: true,
      provinceName: true,
      districtCode: true,
      districtName: true,
      isActive: true,
      installationFee: true,
      shippingFee: true,
      updatedAt: true,
    },
  });
  const hasNext = areas.length > input.limit;
  const items = areas.slice(0, input.limit).map((area) => ({
    ...area,
    installationFeeVnd: moneyToString(area.installationFee),
    shippingFeeVnd: moneyToString(area.shippingFee),
  }));
  return { items, nextCursor: hasNext ? (items.at(-1)?.id ?? null) : null };
}

export async function createServiceArea(
  actor: IdentityActor | null,
  input: ServiceAreaInput,
  requestId: string,
) {
  const catalogActor = requirePriceAccess(actor);
  return prisma.$transaction(async (transaction) => {
    const serviceArea = await transaction.serviceArea.create({
      data: {
        code: input.code,
        provinceCode: input.provinceCode,
        provinceName: input.provinceName,
        districtCode: input.districtCode,
        districtName: input.districtName,
        installationFee: toBigInt(input.installationFeeVnd),
        shippingFee: toBigInt(input.shippingFeeVnd),
        isActive: input.isActive ?? true,
      },
    });
    await transaction.auditLog.create({
      data: {
        actorUserId: catalogActor.userId,
        action: 'catalog.service-area-created',
        targetType: 'service_area',
        targetId: serviceArea.id,
        before: {},
        after: {
          isActive: serviceArea.isActive,
          installationFeeVnd: moneyToString(serviceArea.installationFee),
          shippingFeeVnd: moneyToString(serviceArea.shippingFee),
        },
        requestId,
      },
    });
    return serviceAreaDto(serviceArea);
  });
}

export async function updateServiceArea(
  actor: IdentityActor | null,
  id: string,
  input: ServiceAreaPatch,
  requestId: string,
) {
  const catalogActor = requirePriceAccess(actor);
  return prisma.$transaction(async (transaction) => {
    const current = await transaction.serviceArea.findUnique({
      where: { id },
    });
    if (!current) throw new CatalogError('NOT_FOUND');
    const { installationFeeVnd, shippingFeeVnd, ...fields } = input;
    const serviceArea = await transaction.serviceArea.update({
      where: { id },
      data: {
        ...fields,
        ...(installationFeeVnd !== undefined
          ? { installationFee: BigInt(installationFeeVnd) }
          : {}),
        ...(shippingFeeVnd !== undefined
          ? { shippingFee: BigInt(shippingFeeVnd) }
          : {}),
      },
    });
    await transaction.auditLog.create({
      data: {
        actorUserId: catalogActor.userId,
        action: 'catalog.service-area-updated',
        targetType: 'service_area',
        targetId: id,
        before: {
          isActive: current.isActive,
          installationFeeVnd: moneyToString(current.installationFee),
          shippingFeeVnd: moneyToString(current.shippingFee),
        },
        after: {
          isActive: serviceArea.isActive,
          installationFeeVnd: moneyToString(serviceArea.installationFee),
          shippingFeeVnd: moneyToString(serviceArea.shippingFee),
        },
        requestId,
      },
    });
    return serviceAreaDto(serviceArea);
  });
}

export async function deactivateServiceArea(
  actor: IdentityActor | null,
  id: string,
  requestId: string,
) {
  return updateServiceArea(actor, id, { isActive: false }, requestId);
}
