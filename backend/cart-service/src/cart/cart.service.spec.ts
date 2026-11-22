import { BadRequestException, NotFoundException } from '@nestjs/common';
import { buildCartView, CartService } from './cart.service';
import { fromMinor, toMinor } from './money.util';

describe('money util', () => {
  it('converts prices to paise without floating point errors', () => {
    expect(toMinor('549.00')).toBe(54900);
    expect(toMinor('549')).toBe(54900);
    expect(toMinor('549.5')).toBe(54950);
    expect(toMinor('0.10') + toMinor('0.20')).toBe(30);
  });
  it('formats paise back to a price string', () => {
    expect(fromMinor(54900)).toBe('549.00');
    expect(fromMinor(5)).toBe('0.05');
  });
});

const variant = (over: Record<string, unknown> = {}) => ({
  id: 'v1', cakeId: 'k1', cakeName: 'Chocolate Truffle', flavour: 'Chocolate',
  weightGrams: 500, eggless: false, price: '549.00', available: true, ...over,
});

describe('buildCartView', () => {
  it('uses the CURRENT price and sums only available items', () => {
    const items = [
      { id: 'i1', variantId: 'v1', quantity: 2, message: 'Happy Birthday' },
      { id: 'i2', variantId: 'v2', quantity: 1, message: null },
    ];
    const view = buildCartView(items, [variant(), variant({ id: 'v2', price: '999.00', available: false })]);
    expect(view.items[0].lineTotal).toBe('1098.00');
    expect(view.subtotal).toBe('1098.00');
    expect(view.hasUnavailableItems).toBe(true);
    expect(view.items[1].available).toBe(false);
  });

  it('adds display-only crossed-out prices and the total savings, without changing the real totals', () => {
    const items = [{ id: 'i1', variantId: 'v1', quantity: 2, message: null }];
    const view = buildCartView(items, [variant({ price: '70.00', mrp: '100.00' })]);
    expect(view.items[0]).toMatchObject({ unitPrice: '70.00', lineTotal: '140.00', unitMrp: '100.00', lineMrp: '200.00' });
    expect(view.subtotal).toBe('140.00'); // the customer pays the REAL price
    expect(view.savings).toBe('60.00');
  });

  it('shows no savings for items without a discount or that are unavailable', () => {
    const items = [
      { id: 'i1', variantId: 'v1', quantity: 1, message: null },
      { id: 'i2', variantId: 'v2', quantity: 1, message: null },
    ];
    const view = buildCartView(items, [variant({ mrp: null }), variant({ id: 'v2', price: '70.00', mrp: '100.00', available: false })]);
    expect(view.savings).toBe('0.00');
    expect(view.items[0].unitMrp).toBeNull();
    expect(view.items[1].lineMrp).toBeNull();
  });

  it('marks items whose variant no longer exists as unavailable', () => {
    const view = buildCartView([{ id: 'i1', variantId: 'gone', quantity: 1, message: null }], [null]);
    expect(view.items[0].available).toBe(false);
    expect(view.subtotal).toBe('0.00');
  });
});

describe('CartService', () => {
  const user = { userId: 'u1', email: 'a@b.com', role: 'CUSTOMER' };
  const VARIANT_ID = '22222222-2222-2222-2222-222222222222';
  let prisma: any;
  let products: { getVariant: jest.Mock };
  let service: CartService;

  beforeEach(() => {
    prisma = {
      cart: { upsert: jest.fn().mockResolvedValue({ id: 'c1', userId: 'u1', items: [] }) },
      cartItem: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
    };
    products = { getVariant: jest.fn().mockResolvedValue(variant()) };
    service = new CartService(prisma, products as any);
  });

  describe('addItem', () => {
    it('rejects a variant that does not exist', async () => {
      products.getVariant.mockResolvedValue(null);
      await expect(service.addItem(user, { variantId: VARIANT_ID, quantity: 1 })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects an unavailable variant', async () => {
      products.getVariant.mockResolvedValue(variant({ available: false }));
      await expect(service.addItem(user, { variantId: VARIANT_ID, quantity: 1 })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.cartItem.create).not.toHaveBeenCalled();
    });

    it('creates a new cart line when the cake is not in the cart yet', async () => {
      prisma.cartItem.findFirst.mockResolvedValue(null);
      await service.addItem(user, { variantId: VARIANT_ID, quantity: 2, message: 'Happy Birthday' });
      expect(prisma.cartItem.create).toHaveBeenCalledWith({
        data: { cartId: 'c1', variantId: VARIANT_ID, quantity: 2, message: 'Happy Birthday' },
      });
    });

    it('adds to the quantity of an existing line', async () => {
      prisma.cartItem.findFirst.mockResolvedValue({ id: 'i1', quantity: 3 });
      await service.addItem(user, { variantId: VARIANT_ID, quantity: 2 });
      expect(prisma.cartItem.update).toHaveBeenCalledWith({ where: { id: 'i1' }, data: { quantity: 5 } });
    });

    it('rejects going above the maximum quantity', async () => {
      prisma.cartItem.findFirst.mockResolvedValue({ id: 'i1', quantity: 19 });
      await expect(service.addItem(user, { variantId: VARIANT_ID, quantity: 2 })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('ownership', () => {
    it("does not let a user change or delete someone else's cart line", async () => {
      prisma.cartItem.findFirst.mockResolvedValue(null);
      await expect(service.updateItem(user, 'foreign', 3)).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.removeItem(user, 'foreign')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.cartItem.findFirst).toHaveBeenCalledWith({ where: { id: 'foreign', cartId: 'c1' } });
      expect(prisma.cartItem.update).not.toHaveBeenCalled();
      expect(prisma.cartItem.delete).not.toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('removes all lines of the current cart only', async () => {
      await service.clear(user);
      expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({ where: { cartId: 'c1' } });
    });
  });
});
