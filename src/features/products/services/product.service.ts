import { prisma } from "@/infrastructure/database/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors/app-error";
import { AuditService } from "@/lib/services/audit-service";
import { BarcodeService } from "@/lib/services/barcode-service";
import { BarcodeType, PriceType, type Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

export interface CreateProductInput {
  organizationId: string;
  sku: string;
  name: string;
  description?: string;
  categoryId?: string | null;
  brandId?: string | null;
  unitId: string;
  supplierId?: string | null;
  taxRateId?: string | null;
  costPrice: number;
  sellingPrice: number;
  wholesalePrice?: number;
  minStock?: number;
  reorderLevel?: number;
  trackBatch?: boolean;
  trackExpiry?: boolean;
  hasVariants?: boolean;
  barcode?: string;
  barcodeType?: BarcodeType;
  imageUrl?: string;
}

export interface ProductListParams {
  organizationId: string;
  page?: number;
  pageSize?: number;
  search?: string;
  categoryId?: string;
  brandId?: string;
  isActive?: boolean;
}

export class ProductService {
  static async list(params: ProductListParams) {
    const {
      organizationId,
      page = 1,
      pageSize = 20,
      search,
      categoryId,
      brandId,
      isActive,
    } = params;

    const where: Prisma.ProductWhereInput = {
      organizationId,
      deletedAt: null,
      ...(categoryId ? { categoryId } : {}),
      ...(brandId ? { brandId } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { sku: { contains: search, mode: "insensitive" } },
              { barcodes: { some: { code: { contains: search } } } },
            ],
          }
        : {}),
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { name: "asc" },
        include: {
          category: { select: { id: true, name: true } },
          brand: { select: { id: true, name: true } },
          unit: { select: { id: true, name: true, abbreviation: true } },
          taxRate: { select: { id: true, name: true, rate: true } },
          images: { where: { isPrimary: true }, take: 1 },
          barcodes: { where: { isPrimary: true }, take: 1 },
          _count: { select: { variants: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return { products, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  static async search(organizationId: string, query: string, limit = 20) {
    if (!query.trim()) return [];

    return prisma.product.findMany({
      where: {
        organizationId,
        deletedAt: null,
        isActive: true,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { sku: { contains: query, mode: "insensitive" } },
          { barcodes: { some: { code: { equals: query } } } },
        ],
      },
      take: limit,
      include: {
        unit: { select: { abbreviation: true } },
        images: { where: { isPrimary: true }, take: 1 },
        barcodes: { where: { isPrimary: true }, take: 1 },
        variants: {
          where: { deletedAt: null, isActive: true },
          take: 1,
          include: { barcodes: { where: { isPrimary: true }, take: 1 } },
        },
        taxRate: { select: { id: true, rate: true } },
      },
    });
  }

  static async getById(id: string, organizationId: string) {
    const product = await prisma.product.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        category: true,
        brand: true,
        unit: true,
        supplier: true,
        taxRate: true,
        variants: { where: { deletedAt: null }, orderBy: { name: "asc" } },
        images: { orderBy: { sortOrder: "asc" } },
        barcodes: true,
        prices: { orderBy: { priceType: "asc" } },
      },
    });
    if (!product) throw new NotFoundError("Product");
    return product;
  }

  static async create(data: CreateProductInput, actorId: string) {
    const existing = await prisma.product.findFirst({
      where: {
        organizationId: data.organizationId,
        sku: data.sku,
        deletedAt: null,
      },
    });
    if (existing) throw new ConflictError("SKU already exists");

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          organizationId: data.organizationId,
          sku: data.sku,
          name: data.name,
          description: data.description,
          categoryId: data.categoryId || null,
          brandId: data.brandId || null,
          unitId: data.unitId,
          supplierId: data.supplierId || null,
          taxRateId: data.taxRateId || null,
          costPrice: new Decimal(data.costPrice),
          sellingPrice: new Decimal(data.sellingPrice),
          wholesalePrice: data.wholesalePrice !== undefined ? new Decimal(data.wholesalePrice) : null,
          minStock: new Decimal(data.minStock ?? 0),
          reorderLevel: new Decimal(data.reorderLevel ?? 0),
          trackBatch: data.trackBatch ?? false,
          trackExpiry: data.trackExpiry ?? false,
          hasVariants: data.hasVariants ?? false,
          isActive: true,
          createdById: actorId,
        },
      });

      const variant = await tx.productVariant.create({
        data: {
          productId: created.id,
          sku: created.sku,
          name: created.name,
          costPrice: new Decimal(data.costPrice),
          sellingPrice: new Decimal(data.sellingPrice),
          wholesalePrice: data.wholesalePrice !== undefined ? new Decimal(data.wholesalePrice) : null,
          isActive: true,
        },
      });

      const barcodeCode =
        data.barcode || (await BarcodeService.generateInternalCode(data.organizationId));

      const barcodeExists = await tx.productBarcode.findUnique({ where: { code: barcodeCode } });
      if (barcodeExists) throw new ConflictError("Barcode already exists");

      await tx.productBarcode.create({
        data: {
          productId: created.id,
          variantId: variant.id,
          code: barcodeCode,
          type: data.barcodeType ?? BarcodeType.INTERNAL,
          isPrimary: true,
        },
      });

      if (data.imageUrl) {
        await tx.productImage.create({
          data: {
            productId: created.id,
            url: data.imageUrl,
            publicId: "local",
            isPrimary: true,
            sortOrder: 0,
          },
        });
      }

      await tx.productPrice.create({
        data: {
          productId: created.id,
          priceType: PriceType.RETAIL,
          price: new Decimal(data.sellingPrice),
          minQty: new Decimal(1),
        },
      });

      return created;
    });

    await AuditService.log({
      organizationId: data.organizationId,
      userId: actorId,
      action: "product.created",
      entityType: "Product",
      entityId: product.id,
      after: { sku: product.sku, name: product.name },
    });

    return this.getById(product.id, data.organizationId);
  }

  static async update(
    id: string,
    organizationId: string,
    data: Partial<CreateProductInput> & { isActive?: boolean },
    actorId: string,
  ) {
    await this.getById(id, organizationId);

    if (data.sku) {
      const dup = await prisma.product.findFirst({
        where: { organizationId, sku: data.sku, deletedAt: null, NOT: { id } },
      });
      if (dup) throw new ConflictError("SKU already exists");
    }

    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          sku: data.sku,
          name: data.name,
          description: data.description,
          categoryId:
            data.categoryId !== undefined ? (data.categoryId ?? null) : undefined,
          brandId: data.brandId !== undefined ? (data.brandId ?? null) : undefined,
          unitId: data.unitId,
          supplierId:
            data.supplierId !== undefined ? (data.supplierId ?? null) : undefined,
          taxRateId: data.taxRateId !== undefined ? (data.taxRateId ?? null) : undefined,
          costPrice: data.costPrice !== undefined ? new Decimal(data.costPrice) : undefined,
          sellingPrice: data.sellingPrice !== undefined ? new Decimal(data.sellingPrice) : undefined,
          wholesalePrice: data.wholesalePrice !== undefined ? new Decimal(data.wholesalePrice) : undefined,
          minStock: data.minStock !== undefined ? new Decimal(data.minStock) : undefined,
          reorderLevel: data.reorderLevel !== undefined ? new Decimal(data.reorderLevel) : undefined,
          trackBatch: data.trackBatch,
          trackExpiry: data.trackExpiry,
          isActive: data.isActive,
          updatedById: actorId,
          version: { increment: 1 },
        },
      });

      if (data.sellingPrice !== undefined && !data.hasVariants) {
        const defaultVariant = await tx.productVariant.findFirst({
          where: { productId: id, deletedAt: null },
          orderBy: { createdAt: "asc" },
        });
        if (defaultVariant) {
          await tx.productVariant.update({
            where: { id: defaultVariant.id },
            data: {
              sellingPrice: new Decimal(data.sellingPrice),
              costPrice: data.costPrice !== undefined ? new Decimal(data.costPrice) : undefined,
              name: data.name ?? undefined,
              sku: data.sku ?? undefined,
            },
          });
        }
      }

      if (data.sellingPrice !== undefined) {
        await tx.productPrice.updateMany({
          where: { productId: id, priceType: PriceType.RETAIL },
          data: { price: new Decimal(data.sellingPrice) },
        });
      }

      if (data.barcode) {
        const primaryBarcode = await tx.productBarcode.findFirst({
          where: { productId: id, isPrimary: true },
        });
        const existingBarcode = await tx.productBarcode.findUnique({
          where: { code: data.barcode },
        });
        if (existingBarcode && existingBarcode.productId !== id) {
          throw new ConflictError("Barcode already exists");
        }

        if (primaryBarcode) {
          await tx.productBarcode.update({
            where: { id: primaryBarcode.id },
            data: { code: data.barcode },
          });
        } else {
          const defaultVariant = await tx.productVariant.findFirst({
            where: { productId: id, deletedAt: null },
            orderBy: { createdAt: "asc" },
          });
          await tx.productBarcode.create({
            data: {
              productId: id,
              variantId: defaultVariant?.id ?? null,
              code: data.barcode,
              type: BarcodeType.INTERNAL,
              isPrimary: true,
            },
          });
        }
      }

      if (data.imageUrl !== undefined) {
        const primaryImage = await tx.productImage.findFirst({
          where: { productId: id, isPrimary: true },
          orderBy: { createdAt: "asc" },
        });

        if (data.imageUrl) {
          if (primaryImage) {
            await tx.productImage.update({
              where: { id: primaryImage.id },
              data: { url: data.imageUrl },
            });
          } else {
            await tx.productImage.create({
              data: {
                productId: id,
                url: data.imageUrl,
                publicId: "local",
                isPrimary: true,
                sortOrder: 0,
              },
            });
          }
        } else if (primaryImage) {
          await tx.productImage.delete({
            where: { id: primaryImage.id },
          });
        }
      }
    });

    await AuditService.log({
      organizationId,
      userId: actorId,
      action: "product.updated",
      entityType: "Product",
      entityId: id,
      after: { sku: data.sku, name: data.name },
    });

    return this.getById(id, organizationId);
  }

  static async addBarcode(
    productId: string,
    organizationId: string,
    data: { code?: string; type?: BarcodeType; variantId?: string; isPrimary?: boolean },
    actorId: string,
  ) {
    await this.getById(productId, organizationId);

    const code = data.code || (await BarcodeService.generateInternalCode(organizationId));
    const existing = await prisma.productBarcode.findUnique({ where: { code } });
    if (existing) throw new ConflictError("Barcode already exists");

    if (data.isPrimary) {
      await prisma.productBarcode.updateMany({
        where: { productId },
        data: { isPrimary: false },
      });
    }

    const barcode = await prisma.productBarcode.create({
      data: {
        productId,
        variantId: data.variantId || null,
        code,
        type: data.type ?? BarcodeType.INTERNAL,
        isPrimary: data.isPrimary ?? false,
      },
    });

    await AuditService.log({
      organizationId,
      userId: actorId,
      action: "product.barcode.added",
      entityType: "ProductBarcode",
      entityId: barcode.id,
      after: { code },
    });

    return barcode;
  }

  static async softDelete(id: string, organizationId: string, actorId: string) {
    await this.getById(id, organizationId);
    await prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    await AuditService.log({
      organizationId,
      userId: actorId,
      action: "product.deleted",
      entityType: "Product",
      entityId: id,
    });
  }
}
