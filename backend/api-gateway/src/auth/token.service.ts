import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface GatewayUser {
  userId: string;
  email: string;
  role: string;
}

export interface AuthResult {
  user: GatewayUser | null;
  invalid: boolean; // a token was sent but it is malformed, forged or expired
}

@Injectable()
export class TokenService {
  constructor(private readonly jwt: JwtService) {}

  async authenticate(authorization?: string): Promise<AuthResult> {
    if (!authorization) return { user: null, invalid: false };
    const [scheme, token] = authorization.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) return { user: null, invalid: true };
    try {
      const p = await this.jwt.verifyAsync<{ sub: string; email: string; role: string }>(token);
      return { user: { userId: p.sub, email: p.email, role: p.role }, invalid: false };
    } catch {
      return { user: null, invalid: true };
    }
  }
}
