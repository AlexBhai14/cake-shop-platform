import { Injectable, NestMiddleware } from '@nestjs/common';
import { MetricsService } from './metrics.service';

// Counts every request and measures how long it took.
// The label "route" is the route PATTERN (/orders/:id), never the real URL, so the number of
// label values stays small (a label per order id would overload Prometheus).
@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: MetricsService) {}

  use(req: any, res: any, next: () => void) {
    if (req.path === '/metrics') return next();
    const stop = this.metrics.duration.startTimer();
    res.on('finish', () => {
      const pattern = req.route?.path;
      const labels = {
        method: req.method as string,
        route: typeof pattern === 'string' ? pattern : 'unmatched',
        status: String(res.statusCode),
      };
      this.metrics.requests.inc(labels);
      stop(labels);
    });
    next();
  }
}
