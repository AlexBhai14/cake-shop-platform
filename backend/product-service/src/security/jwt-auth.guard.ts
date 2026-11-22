import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// No/invalid token -> HTTP 401
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
