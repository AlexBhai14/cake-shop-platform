import { JwtService } from '@nestjs/jwt';
import { TokenService } from './token.service';

describe('TokenService', () => {
  const jwt = new JwtService({ secret: 'test-secret' });
  const service = new TokenService(jwt);

  it('treats a missing header as anonymous, not invalid', async () => {
    expect(await service.authenticate(undefined)).toEqual({ user: null, invalid: false });
  });

  it('accepts a valid token and returns the user', async () => {
    const token = await jwt.signAsync({ sub: 'u1', email: 'a@b.com', role: 'ADMIN' });
    const r = await service.authenticate(`Bearer ${token}`);
    expect(r.user).toEqual({ userId: 'u1', email: 'a@b.com', role: 'ADMIN' });
    expect(r.invalid).toBe(false);
  });

  it('rejects garbage, a wrong scheme and a token signed with another secret', async () => {
    expect((await service.authenticate('Bearer not.a.jwt')).invalid).toBe(true);
    expect((await service.authenticate('Basic abc')).invalid).toBe(true);
    const forged = await new JwtService({ secret: 'other-secret' }).signAsync({ sub: 'u1', role: 'ADMIN' });
    expect((await service.authenticate(`Bearer ${forged}`)).invalid).toBe(true);
  });

  it('rejects an expired token', async () => {
    const token = await jwt.signAsync({ sub: 'u1', email: 'a@b.com', role: 'CUSTOMER' }, { expiresIn: '-10s' });
    expect((await service.authenticate(`Bearer ${token}`)).invalid).toBe(true);
  });
});
