import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';

// Validates JWT access tokens issued by the auth-service (shared secret, stateless).
@Module({ imports: [PassportModule], providers: [JwtStrategy], exports: [PassportModule] })
export class SecurityModule {}
