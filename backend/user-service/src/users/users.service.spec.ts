import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: any;
  const user = { userId: 'auth-1', email: 'sahil@example.com', role: 'CUSTOMER' };
  const addressDto = {
    label: 'Home', line1: '12 MG Road', city: 'Mumbai', state: 'Maharashtra', postalCode: '400001',
  };

  beforeEach(() => {
    prisma = {
      profile: {
        upsert: jest.fn().mockResolvedValue({ id: 'p1', userId: 'auth-1', addresses: [] }),
        update: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      address: {
        count: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'a-new', ...data })),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
    };
    prisma.$transaction = jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma));
    service = new UsersService(prisma);
  });

  it('creates a profile on first access using the email prefix as the name', async () => {
    await service.getOrCreateProfile(user);
    expect(prisma.profile.upsert.mock.calls[0][0].create).toMatchObject({
      userId: 'auth-1',
      email: 'sahil@example.com',
      fullName: 'sahil',
    });
  });

  describe('addAddress', () => {
    it('makes the first address the default', async () => {
      prisma.address.count.mockResolvedValue(0);
      const result = await service.addAddress(user, addressDto);
      expect(result.isDefault).toBe(true);
    });

    it('keeps the existing default when a second address is added normally', async () => {
      prisma.address.count.mockResolvedValue(1);
      const result = await service.addAddress(user, addressDto);
      expect(result.isDefault).toBe(false);
      expect(prisma.address.updateMany).not.toHaveBeenCalled();
    });

    it('moves the default when the new address asks for it', async () => {
      prisma.address.count.mockResolvedValue(2);
      const result = await service.addAddress(user, { ...addressDto, isDefault: true });
      expect(result.isDefault).toBe(true);
      expect(prisma.address.updateMany).toHaveBeenCalledWith({
        where: { profileId: 'p1', isDefault: true },
        data: { isDefault: false },
      });
    });
  });

  describe('ownership', () => {
    it("treats another customer's address as not found", async () => {
      prisma.address.findFirst.mockResolvedValue(null);
      await expect(service.updateAddress(user, 'someone-elses', { city: 'Pune' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.address.findFirst).toHaveBeenCalledWith({ where: { id: 'someone-elses', profileId: 'p1' } });
      expect(prisma.address.update).not.toHaveBeenCalled();
    });
  });

  describe('setDefault', () => {
    it('unsets the old default and sets the new one in one transaction', async () => {
      prisma.address.findFirst.mockResolvedValue({ id: 'a2', profileId: 'p1', isDefault: false });
      await service.setDefault(user, 'a2');
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.address.updateMany).toHaveBeenCalledWith({
        where: { profileId: 'p1', isDefault: true },
        data: { isDefault: false },
      });
      expect(prisma.address.update).toHaveBeenCalledWith({ where: { id: 'a2' }, data: { isDefault: true } });
    });
  });

  describe('deleteAddress', () => {
    it('promotes the oldest remaining address when the default is deleted', async () => {
      prisma.address.findFirst
        .mockResolvedValueOnce({ id: 'a1', profileId: 'p1', isDefault: true })
        .mockResolvedValueOnce({ id: 'a2', profileId: 'p1' });
      await service.deleteAddress(user, 'a1');
      expect(prisma.address.delete).toHaveBeenCalledWith({ where: { id: 'a1' } });
      expect(prisma.address.update).toHaveBeenCalledWith({ where: { id: 'a2' }, data: { isDefault: true } });
    });

    it('does not promote anything when a non-default address is deleted', async () => {
      prisma.address.findFirst.mockResolvedValueOnce({ id: 'a2', profileId: 'p1', isDefault: false });
      await service.deleteAddress(user, 'a2');
      expect(prisma.address.update).not.toHaveBeenCalled();
    });
  });
});
