import { MetricsModule } from './metrics/metrics.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CatalogModule } from './catalog/catalog.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { SecurityModule } from './security/security.module';

@Module({
  imports: [MetricsModule, ConfigModule.forRoot({ isGlobal: true }), PrismaModule, SecurityModule, CatalogModule],
  controllers: [HealthController],
})
export class AppModule {}
