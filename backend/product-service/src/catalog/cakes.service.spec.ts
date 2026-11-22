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

    it('stores the discount percent (0 when not given)', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'c1', isActive: true });
      prisma.cake.create.mockResolvedValue({ id: 'k1' });
      await service.create(dto);
      expect(prisma.cake.create.mock.calls[0][0].data.discountPercent).toBe(0);
      await service.create({ ...dto, discountPercent: 30 } as any);
      expect(prisma.cake.create.mock.calls[1][0].data.discountPercent).toBe(30);
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

  describe('discount display', () => {
    const cake = { id: 'k1', isActive: true, discountPercent: 30, variants: [{ id: 'v1', price: '70.00' }] };

    it('getPublic adds the crossed-out mrp but keeps the real price', async () => {
      prisma.cake.findUnique.mockResolvedValue(cake);
      const r = await service.getPublic('k1');
      expect(r.variants[0]).toMatchObject({ price: '70.00', mrp: '100.00' });
    });

    it('listPublic and listAdmin add mrp too', async () => {
      prisma.cake.findMany.mockResolvedValue([cake]);
      expect((await service.listPublic({})).items[0].variants[0].mrp).toBe('100.00');
      expect((await service.listAdmin()).items[0].variants[0].mrp).toBe('100.00');
    });

    it('getVariant keeps price as the REAL price and adds mrp for display only', async () => {
      prisma.cakeVariant.findUnique.mockResolvedValue({
        id: 'v1', cakeId: 'k1', flavour: 'Choc', weightGrams: 500, eggless: false, price: '70.00',
        isActive: true, cake: { id: 'k1', name: 'Truffle', isActive: true, discountPercent: 30 },
      });
      const v: any = await service.getVariant('v1');
      expect(v.price).toBe('70.00');
      expect(v.mrp).toBe('100.00');
    });

    it('getVariant gives mrp null when the cake has no discount', async () => {
      prisma.cakeVariant.findUnique.mockResolvedValue({
        id: 'v1', cakeId: 'k1', flavour: 'Choc', weightGrams: 500, eggless: false, price: '70.00',
        isActive: true, cake: { id: 'k1', name: 'Truffle', isActive: true, discountPercent: 0 },
      });
      expect(((await service.getVariant('v1')) as any).mrp).toBeNull();
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
