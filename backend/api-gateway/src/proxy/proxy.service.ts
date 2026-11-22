import { BadGatewayException, GatewayTimeoutException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { ResolvedRoute } from '../config/routes';

// Headers that describe one network hop and must not be forwarded.
const HOP_BY_HOP = new Set([
  'host', 'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade', 'content-length',
]);

@Injectable()
export class ProxyService {
  constructor(private readonly config: ConfigService) {}

  async forward(req: Request, res: Response, route: ResolvedRoute, correlationId: string): Promise<void> {
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (HOP_BY_HOP.has(key) || value === undefined) continue;
      headers[key] = Array.isArray(value) ? value.join(', ') : value;
    }
    headers['x-correlation-id'] = correlationId;
    headers['x-forwarded-for'] = req.ip ?? 'unknown'; // set by the gateway; a client value is ignored

    let body: string | undefined;
    if (!['GET', 'HEAD'].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
      body = JSON.stringify(req.body);
      headers['content-type'] = 'application/json';
    }

    const timeoutMs = Number(this.config.get('UPSTREAM_TIMEOUT_MS') ?? 8000);
    let upstream: Awaited<ReturnType<typeof fetch>>;
    try {
      upstream = await fetch(route.baseUrl + route.upstreamPath, {
        method: req.method,
        headers,
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      const timedOut = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
      throw timedOut
        ? new GatewayTimeoutException(`${route.service} service timed out`)
        : new BadGatewayException(`${route.service} service is unavailable`);
    }

    res.status(upstream.status);
    const contentType = upstream.headers.get('content-type');
    if (contentType) res.setHeader('content-type', contentType);
    res.send(Buffer.from(await upstream.arrayBuffer()));
  }
}
