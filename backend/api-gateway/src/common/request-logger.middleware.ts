import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

// Structured (JSON) access log. Never logs headers or bodies, so no tokens or passwords leak.
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    res.on('finish', () => {
      console.log(
        JSON.stringify({
          level: 'info',
          service: 'api-gateway',
          correlationId: req.headers['x-correlation-id'],
          method: req.method,
          path: req.originalUrl.split('?')[0],
          status: res.statusCode,
          durationMs: Date.now() - start,
        }),
      );
    });
    next();
  }
}
