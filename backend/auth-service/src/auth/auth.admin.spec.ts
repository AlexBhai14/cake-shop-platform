import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService admin account management', () => {
  let prisma: any;
  let service: AuthService;

  beforeEach(() => {
    prisma = {
      user: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), findUnique: jest.fn(), update: jest.fn() },
      refreshToken: { updateMany: jest.fn() },
    };
    service = new AuthService(prisma, {} as any, { get: () => undefined } as any);
  });

  it('lists accounts without the password hash, newest first, with paging', async () => {
    await service.listUsers(2, 10);
    const arg = prisma.user.findMany.mock.calls[0][0];
    expect(arg.select).toEqual({ id: true, email: true, role: true, status: true, createdAt: true });
    expect(arg.skip).toBe(10);
    expect(arg.take).toBe(10);
  });

  it('does not let an admin change their own status', async () => {
    await expect(service.setStatus('a1', 'a1', 'SUSPENDED')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.setStatus('a1', 'u1', 'SUSPENDED')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('suspending a user also revokes all their refresh tokens', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
    const r = await service.setStatus('a1', 'u1', 'SUSPENDED');
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { status: 'SUSPENDED' } });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(r).toEqual({ id: 'u1', email: 'a@b.com', status: 'SUSPENDED' });
  });

  it('re-activating a user does not touch the tokens', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
    await service.setStatus('a1', 'u1', 'ACTIVE');
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });
});
