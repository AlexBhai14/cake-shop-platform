import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const makeContext = (user: unknown) =>
    ({
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  const guardFor = (required: string[] | undefined) =>
    new RolesGuard({ getAllAndOverride: jest.fn().mockReturnValue(required) } as unknown as Reflector);

  it('allows any user when the route has no role requirement', () => {
    expect(guardFor(undefined).canActivate(makeContext({ role: 'CUSTOMER' }))).toBe(true);
  });

  it('allows an ADMIN on an admin-only route', () => {
    expect(guardFor(['ADMIN']).canActivate(makeContext({ role: 'ADMIN' }))).toBe(true);
  });

  it('blocks a CUSTOMER on an admin-only route with 403', () => {
    expect(() => guardFor(['ADMIN']).canActivate(makeContext({ role: 'CUSTOMER' }))).toThrow(
      ForbiddenException,
    );
  });
});
