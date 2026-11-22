import { Injectable } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client';

type HttpLabels = 'method' | 'route' | 'status';

// Prometheus metrics of this service. Prometheus calls GET /metrics every few seconds and stores the numbers.
@Injectable()
export class MetricsService {
  readonly registry = new Registry();
  readonly requests: Counter<HttpLabels>;
  readonly duration: Histogram<HttpLabels>;

  constructor() {
    // every metric of this service carries the label service="inventory-service"
    this.registry.setDefaultLabels({ service: 'inventory-service' });
    collectDefaultMetrics({ register: this.registry }); // CPU, memory, event loop lag, GC...
    this.requests = new Counter({
      name: 'http_requests_total',
      help: 'Number of HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });
    this.duration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
      registers: [this.registry],
    });
  }

  // A gauge that asks the database (or anything else) for its value each time Prometheus scrapes
  addGauge(name: string, help: string, read: () => Promise<number>) {
    new Gauge({
      name,
      help,
      registers: [this.registry],
      async collect() {
        try {
          this.set(await read());
        } catch {
          /* keep the last value; the service itself reports its errors elsewhere */
        }
      },
    });
  }

  get contentType(): string {
    return this.registry.contentType;
  }

  render(): Promise<string> {
    return this.registry.metrics();
  }
}
