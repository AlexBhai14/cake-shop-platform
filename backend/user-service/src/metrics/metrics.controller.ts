import { Controller, Get, Res } from '@nestjs/common';
import { MetricsService } from './metrics.service';

// Do not publish /metrics through the ingress or the gateway: it is only for Prometheus inside the network.
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  async get(@Res() res: any) {
    res.setHeader('Content-Type', this.metrics.contentType);
    res.send(await this.metrics.render());
  }
}
