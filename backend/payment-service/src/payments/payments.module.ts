import { Module } from '@nestjs/common';
import { MockGateway } from './mock-gateway';
import { PaymentsController } from './payments.controller';
import { PaymentsSaga } from './payments.saga';
import { PaymentsService } from './payments.service';
import { WalletController } from '../wallet/wallet.controller';
import { WalletService } from '../wallet/wallet.service';

@Module({
  controllers: [PaymentsController, WalletController],
  providers: [PaymentsService, MockGateway, PaymentsSaga, WalletService],
})
export class PaymentsModule {}
