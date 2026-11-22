import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../security/jwt-auth.guard';
import { PageDto } from '../payments/dto/payment.dto';
import { AuthUser } from '../payments/payments.service';
import { WalletService } from './wallet.service';

type AuthedRequest = { user: AuthUser };

// A customer can only ever see THEIR OWN wallet: the user id comes from the verified JWT, never from the URL.
@Controller('payments/wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get()
  mine(@Req() req: AuthedRequest) {
    return this.wallet.getMine(req.user.userId);
  }

  @Get('transactions')
  transactions(@Req() req: AuthedRequest, @Query() q: PageDto) {
    return this.wallet.transactionsMine(req.user.userId, q.page, q.limit);
  }
}
