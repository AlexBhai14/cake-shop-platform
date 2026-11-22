import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { Request, Response } from 'express';

// One consistent JSON error shape for everything the gateway itself rejects.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = 500;
    let message: unknown = 'Internal server error';
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      message = typeof body === 'string' ? body : ((body as { message?: unknown }).message ?? exception.message);
    } else {
      console.error(
        JSON.stringify({ level: 'error', service: 'api-gateway', msg: 'unhandled exception', error: String(exception) }),
      );
    }

    res.status(status).json({
      statusCode: status,
      message,
      path: req.originalUrl?.split('?')[0],
      correlationId: req.headers['x-correlation-id'],
      timestamp: new Date().toISOString(),
    });
  }
}
