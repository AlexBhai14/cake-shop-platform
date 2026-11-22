import {
  All, Controller, HttpException, NotFoundException, Req, Res, UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { TokenService } from '../auth/token.service';
import { isPublicRoute } from '../config/public-routes';
import { loadServiceUrls, resolveRoute } from '../config/routes';
import { ProxyService } from '../proxy/proxy.service';
import { selectSubject } from '../rate-limit/rate-limit.config';
import { RateLimitService } from '../rate-limit/rate-limit.service';

@Controller()
export class GatewayController {
  constructor(
    private readonly tokens: TokenService,
    private readonly limiter: RateLimitService,
    private readonly proxy: ProxyService,
    private readonly config: ConfigService,
  ) {}

  @All('api/*')
  async handle(@Req() req: Request, @Res() res: Response): Promise<void> {
    // 1. Which microservice owns this URL?
    const urls = loadServiceUrls({
      AUTH_SERVICE_URL: this.config.get('AUTH_SERVICE_URL'),
      USER_SERVICE_URL: this.config.get('USER_SERVICE_URL'),
      PRODUCT_SERVICE_URL: this.config.get('PRODUCT_SERVICE_URL'),
      CART_SERVICE_URL: this.config.get('CART_SERVICE_URL'),
      INVENTORY_SERVICE_URL: this.config.get('INVENTORY_SERVICE_URL'),
      ORDER_SERVICE_URL: this.config.get('ORDER_SERVICE_URL'),
      PAYMENT_SERVICE_URL: this.config.get('PAYMENT_SERVICE_URL'),
      NOTIFICATION_SERVICE_URL: this.config.get('NOTIFICATION_SERVICE_URL'),
    });
    const route = resolveRoute(req.originalUrl, urls);
    if (!route) throw new NotFoundException('Route not found');

    const pathname = req.originalUrl.split('?')[0];

    // 2. Who is calling? (an invalid token is remembered, not thrown yet)
    const { user, invalid } = await this.tokens.authenticate(req.headers.authorization);

    // 3. Rate limit BEFORE rejecting, so token-guessing and brute force are limited too
    const subject = selectSubject(pathname, user, req.ip ?? 'unknown');
    const rl = await this.limiter.check(subject);
    res.setHeader('X-RateLimit-Limit', String(rl.limit));
    res.setHeader('X-RateLimit-Remaining', String(rl.remaining));
    if (!rl.allowed) {
      res.setHeader('Retry-After', String(rl.retryAfterSec));
      throw new HttpException('Too many requests, please try again later', 429);
    }

    // 4. Authentication rules
    if (invalid) throw new UnauthorizedException('Invalid or expired token');
    if (!user && !isPublicRoute(req.method, pathname)) {
      throw new UnauthorizedException('Authentication required');
    }

    // 5. Forward to the microservice
    await this.proxy.forward(req, res, route, String(req.headers['x-correlation-id']));
  }
}
