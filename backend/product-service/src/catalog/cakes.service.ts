import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CakeQueryDto,
  CreateCakeDto,
  UpdateCakeDto,
  UpdateVariantDto,
  VariantDto,
} from './dto/cake.dto';
import { isUniqueViolation, slugify } from './slug.util';

@Injectable()
export class CakesService {
  constructor(private readonly prisma: PrismaService) {}

  // Public browsing: only active cakes, only active variants.
  async listPublic(q: CakeQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 12;

    const variantFilter: Record<string, unknown> = { isActive: true };
    if (q.flavour) variantFilter.flavour = q.flavour;
    if (q.eggless !== undefined) variantFilter.eggless = q.eggless;
    if (q.minPrice !== undefined || q.maxPrice !== undefined) {
      variantFilter.price = { gte: q.minPrice, lte: q.maxPrice };
    }

    const where: Record<string, unknown> = { isActive: true, variants: { some: variantFilter } };
    if (q.search) where.name = { contains: q.search };
    if (q.categoryId) where.categoryId = q.categoryId;

    const [items, total] = await Promise.all([
      this.prisma.cake.findMany({
        where,
        include: {
          category: true,
          variants: { where: { isActive: true }, orderBy: { price: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.cake.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async getPublic(id: string) {
    const cake = await this.prisma.cake.findUnique({
      where: { id },
      include: { category: true, variants: { where: { isActive: true }, orderBy: { price: 'asc' } } },
    });
    if (!cake || !cake.isActive) throw new NotFoundException('Cake not found');
    return cake;
  }

  // Admin: everything, including inactive cakes and variants.
  async listAdmin(page = 1, limit = 20) {
    const [items, total] = await Promise.all([
      this.prisma.cake.findMany({
        include: { category: true, variants: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.cake.count(),
    ]);
    return { items, total, page, limit };
  }

  // Used by the cart/order services to check the CURRENT price (never trust a client price).
  async getVariant(variantId: string) {
    const variant = await this.prisma.cakeVariant.findUnique({
      where: { id: variantId },
      include: { cake: { select: { id: true, name: true, isActive: true } } },
    });
    if (!variant) throw new NotFoundException('Variant not found');
    return {
      id: variant.id,
      cakeId: variant.cakeId,
      cakeName: variant.cake.name,
      flavour: variant.flavour,
      weightGrams: variant.weightGrams,
      eggless: variant.eggless,
      price: variant.price,
      available: variant.isActive && variant.cake.isActive,
    };
  }

  async create(dto: CreateCakeDto) {
    const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
    if (!category || !category.isActive) throw new NotFoundException('Category not found');
    try {
      return await this.prisma.cake.create({
        data: {
          name: dto.name,
          slug: slugify(dto.name),
          description: dto.description,
          categoryId: dto.categoryId,
          imageUrl: dto.imageUrl,
          variants: { create: dto.variants },
        },
        include: { variants: true },
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException('A cake with this name or a duplicate variant already exists');
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateCakeDto) {
    await this.ensureExists(id);
    try {
      return await this.prisma.cake.update({
        where: { id },
        data: { ...dto, ...(dto.name ? { slug: slugify(dto.name) } : {}) },
        include: { variants: true },
      });
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException('A cake with this name already exists');
      throw e;
    }
  }

  // "Delete" is a soft delete: the cake disappears from the shop but old orders keep working.
  async deactivate(id: string) {
    await this.ensureExists(id);
    return this.prisma.cake.update({ where: { id }, data: { isActive: false } });
  }

  async addVariant(cakeId: string, dto: VariantDto) {
    await this.ensureExists(cakeId);
    try {
      return await this.prisma.cakeVariant.create({ data: { ...dto, cakeId } });
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException('This variant already exists');
      throw e;
    }
  }

  async updateVariant(variantId: string, dto: UpdateVariantDto) {
    const variant = await this.prisma.cakeVariant.findUnique({ where: { id: variantId } });
    if (!variant) throw new NotFoundException('Variant not found');
    return this.prisma.cakeVariant.update({ where: { id: variantId }, data: dto });
  }

  private async ensureExists(id: string) {
    const cake = await this.prisma.cake.findUnique({ where: { id } });
    if (!cake) throw new NotFoundException('Cake not found');
    return cake;
  }
}
