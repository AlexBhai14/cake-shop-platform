import { ConflictException, NotFoundException } from '@nestjs/common';
import { CakesService } from './cakes.service';
import { slugify } from './slug.util';

describe('slugify', () => {
  it('creates URL-friendly slugs', () => {
    expect(slugify('  Chocolate Truffle!! ')).toBe('chocolate-truffle');
  });
});

describe('CakesService', () => {
  let service: CakesService;
  let prisma: any;
  const dto = {
    name: 'Chocolate Truffle',
    description: 'Rich chocolate cake',
    categoryId: '11111111-1111-1111-1111-111111111111',
    variants: [{ flavour: 'Chocolate', weightGrams: 500, eggless: false, price: 549 }],
  };

  beforeEach(() => {
    prisma = {
      category: { findUnique: jest.fn() },
      cake: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
      },
      cakeVariant: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    };
    service = new CakesService(prisma);
  });

  describe('create', () => {
    it('rejects an unknown category', async () => {
      prisma.category.findUnique.mockResolvedValue(null);
      await expect(service.create(dto)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects an inactive category', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'c1', isActive: false });
      await expect(service.create(dto)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('creates the cake with a generated slug and its variants', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'c1', isActive: true });
      prisma.cake.create.mockResolvedValue({ id: 'k1' });
      await service.create(dto);
      const arg = prisma.cake.create.mock.calls[0][0];
      expect(arg.data.slug).toBe('chocolate-truffle');
      expect(arg.data.variants.create).toEqual(dto.variants);
    });

    it('maps a unique-constraint error to ConflictException', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'c1', isActive: true });
      prisma.cake.create.mockRejectedValue({ code: 'P2002' });
      await expect(service.create(dto)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('listPublic', () => {
    it('only returns active cakes and applies eggless, price and pagination filters', async () => {
      await service.listPublic({ eggless: true, minPrice: 300, maxPrice: 800, page: 2, limit: 5 });
      const arg = prisma.cake.findMany.mock.calls[0][0];
      expect(arg.where.isActive).toBe(true);
      expect(arg.where.variants.some).toEqual({
        isActive: true,
        eggless: true,
        price: { gte: 300, lte: 800 },
      });
      expect(arg.skip).toBe(5);
      expect(arg.take).toBe(5);
    });

    it('adds a name search when provided', async () => {
      await service.listPublic({ search: 'velvet' });
      expect(prisma.cake.findMany.mock.calls[0][0].where.name).toEqual({ contains: 'velvet' });
    });
  });

  describe('getPublic', () => {
    it('hides inactive cakes from customers', async () => {
      prisma.cake.findUnique.mockResolvedValue({ id: 'k1', isActive: false });
      await expect(service.getPublic('k1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('deactivate', () => {
    it('soft-deletes by setting isActive to false', async () => {
      prisma.cake.findUnique.mockResolvedValue({ id: 'k1' });
      await service.deactivate('k1');
      expect(prisma.cake.update).toHaveBeenCalledWith({ where: { id: 'k1' }, data: { isActive: false } });
    });

    it('throws NotFound for an unknown cake', async () => {
      prisma.cake.findUnique.mockResolvedValue(null);
      await expect(service.deactivate('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getVariant', () => {
    it('reports unavailable when the cake is inactive', async () => {
      prisma.cakeVariant.findUnique.mockResolvedValue({
        id: 'v1', cakeId: 'k1', flavour: 'Choc', weightGrams: 500, eggless: false, price: '549.00',
        isActive: true, cake: { id: 'k1', name: 'Truffle', isActive: false },
      });
      const result = await service.getVariant('v1');
      expect(result.available).toBe(false);
    });
  });
});
