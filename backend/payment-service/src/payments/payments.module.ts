import { Module } from '@nestjs/common';
import { MockGateway } from './mock-gateway';
import { PaymentsController } from './payments.controller';
import { PaymentsSaga } from './payments.saga';
import { PaymentsService } from './payments.service';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, MockGateway, PaymentsSaga],
})
export class PaymentsModule {}
