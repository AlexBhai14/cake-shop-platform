import { decodeJwt, userFromToken } from './jwt';

const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const token = (payload: object) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.signature`;

describe('jwt helpers', () => {
  it('reads the payload of a token', () => {
    expect(decodeJwt(token({ sub: 'u1', email: 'a@b.com', role: 'CUSTOMER' }))).toMatchObject({ sub: 'u1' });
  });

  it('builds the session user from a valid token', () => {
    expect(userFromToken(token({ sub: 'u1', email: 'a@b.com', role: 'ADMIN' }))).toEqual({
      userId: 'u1',
      email: 'a@b.com',
      role: 'ADMIN',
    });
  });

  it('returns null for garbage, missing fields and unknown roles', () => {
    expect(decodeJwt('not-a-token')).toBeNull();
    expect(userFromToken('not-a-token')).toBeNull();
    expect(userFromToken(token({ sub: 'u1' }))).toBeNull();
    expect(userFromToken(token({ sub: 'u1', email: 'a@b.com', role: 'HACKER' }))).toBeNull();
  });
});
