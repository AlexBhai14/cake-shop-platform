import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  const jwt = { signAsync: jest.fn().mockResolvedValue('access.jwt.token') } as unknown as JwtService;
  const config = {
    get: (key: string) => (({ BCRYPT_ROUNDS: 4, REFRESH_TOKEN_TTL_DAYS: 7 }) as Record<string, number>)[key],
  } as unknown as ConfigService;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn(), create: jest.fn() },
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    service = new AuthService(prisma, jwt, config);
  });

  describe('register', () => {
    it('stores a bcrypt hash (never the plain password) and lowercases the email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(async ({ data }: any) => ({ id: 'u1', ...data }));

      const result = await service.register({ email: 'Sahil@Example.com', password: 'Password123' });

      const data = prisma.user.create.mock.calls[0][0].data;
      expect(data.email).toBe('sahil@example.com');
      expect(data.passwordHash).not.toBe('Password123');
      expect(await bcrypt.compare('Password123', data.passwordHash)).toBe(true);
      expect(data.role).toBe('CUSTOMER');
      expect(result).toEqual({ id: 'u1', email: 'sahil@example.com', role: 'CUSTOMER' });
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('rejects a duplicate email with ConflictException', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      await expect(service.register({ email: 'a@b.com', password: 'Password123' })).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const makeUser = async (overrides: Record<string, unknown> = {}) => ({
      id: 'u1',
      email: 'a@b.com',
      role: 'CUSTOMER',
      status: 'ACTIVE',
      passwordHash: await bcrypt.hash('Password123', 4),
      ...overrides,
    });

    it('rejects a wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue(await makeUser());
      await expect(service.login({ email: 'a@b.com', password: 'wrong' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects an unknown email with the same error', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.login({ email: 'x@y.com', password: 'Password123' })).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('rejects a suspended account', async () => {
      prisma.user.findUnique.mockResolvedValue(await makeUser({ status: 'SUSPENDED' }));
      await expect(service.login({ email: 'a@b.com', password: 'Password123' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('returns tokens and stores only the HASH of the refresh token', async () => {
      prisma.user.findUnique.mockResolvedValue(await makeUser());
      const tokens = await service.login({ email: 'a@b.com', password: 'Password123' });

      expect(tokens.accessToken).toBe('access.jwt.token');
      expect(tokens.tokenType).toBe('Bearer');
      const stored = prisma.refreshToken.create.mock.calls[0][0].data;
      expect(stored.tokenHash).toHaveLength(64);
      expect(stored.tokenHash).not.toBe(tokens.refreshToken);
    });
  });

  describe('refresh', () => {
    const future = new Date(Date.now() + 60_000);
    const user = { id: 'u1', email: 'a@b.com', role: 'CUSTOMER', status: 'ACTIVE' };

    it('rejects an unknown token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);
      await expect(service.refresh('nope')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rotates: revokes the old token and issues a new pair', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 't1', userId: 'u1', revokedAt: null, expiresAt: future, user,
      });
      const tokens = await service.refresh('old-token');

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { revokedAt: expect.any(Date) },
      });
      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
      expect(tokens.refreshToken).toBeDefined();
    });

    it('detects reuse of a revoked token and revokes all sessions of the user', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 't1', userId: 'u1', revokedAt: new Date(), expiresAt: future, user,
      });
      await expect(service.refresh('reused')).rejects.toThrow('Refresh token reuse detected');
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('rejects an expired token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 't1', userId: 'u1', revokedAt: null, expiresAt: new Date(Date.now() - 1000), user,
      });
      await expect(service.refresh('expired')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('revokes the given refresh token', async () => {
      await service.logout('some-token');
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: expect.any(String), revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});
