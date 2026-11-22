import { Module } from '@nestjs/common';
import { ServiceClients } from './http-clients';
import { OrderSaga } from './order.saga';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { ReconciliationService } from './reconciliation.service';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, OrderSaga, ReconciliationService, ServiceClients],
})
export class OrdersModule {}
