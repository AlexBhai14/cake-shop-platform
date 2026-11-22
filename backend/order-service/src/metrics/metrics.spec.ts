import { EventEmitter } from 'events';
import { MetricsMiddleware } from './metrics.middleware';
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  it('exposes default process metrics with the service label', async () => {
    const text = await new MetricsService().render();
    expect(text).toContain('process_cpu_user_seconds_total');
    expect(text).toContain('service="order-service"');
  });

  it('exposes a gauge that is read at scrape time', async () => {
    const service = new MetricsService();
    service.addGauge('outbox_pending_events', 'pending events', async () => 7);
    expect(await service.render()).toMatch(/outbox_pending_events\{service="order-service"\} 7/);
  });

  it('keeps the last value when the gauge source fails', async () => {
    const service = new MetricsService();
    service.addGauge('flaky_gauge', 'flaky', async () => {
      throw new Error('db down');
    });
    await expect(service.render()).resolves.toContain('flaky_gauge');
  });
});

describe('MetricsMiddleware', () => {
  const run = async (req: any, status = 200) => {
    const metrics = new MetricsService();
    const res: any = new EventEmitter();
    res.statusCode = status;
    const next = jest.fn();
    new MetricsMiddleware(metrics).use(req, res, next);
    res.emit('finish');
    return { text: await metrics.render(), next };
  };

  it('counts a request with the route PATTERN, method and status', async () => {
    const { text, next } = await run({ path: '/orders/123', method: 'GET', route: { path: '/orders/:id' } }, 200);
    expect(next).toHaveBeenCalled();
    const line = text.split('\n').find((l) => l.startsWith('http_requests_total{'))!;
    expect(line).toContain('method="GET"');
    expect(line).toContain('route="/orders/:id"');
    expect(line).toContain('status="200"');
    expect(line.trim().endsWith(' 1')).toBe(true);
    expect(text).toContain('http_request_duration_seconds_bucket');
  });

  it('uses "unmatched" when no route matched, so label values stay few', async () => {
    const { text } = await run({ path: '/random/scan/123', method: 'GET' }, 404);
    expect(text).toContain('route="unmatched"');
  });

  it('does not count the scrape requests of Prometheus itself', async () => {
    const { text } = await run({ path: '/metrics', method: 'GET', route: { path: '/metrics' } });
    expect(text).not.toContain('http_requests_total{');
  });
});
