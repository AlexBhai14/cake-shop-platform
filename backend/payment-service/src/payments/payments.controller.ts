import {
  Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { JwtAuthGuard } from '../security/jwt-auth.guard';
import { Roles } from '../security/roles.decorator';
import { RolesGuard } from '../security/roles.guard';
import { PageDto, PayDto } from './dto/payment.dto';
import { AuthUser, PaymentsService } from './payments.service';

type AuthedRequest = { user: AuthUser; headers: Record<string, string | string[] | undefined> };
const corr = (req: AuthedRequest) => String(req.headers['x-correlation-id'] ?? randomUUID());

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  // MOCK payment: the customer chooses the simulated outcome.
  @Post('orders/:orderId/pay')
  pay(@Req() req: AuthedRequest, @Param('orderId', ParseUUIDPipe) orderId: string, @Body() dto: PayDto) {
    return this.payments.pay(req.user, orderId, dto.scenario ?? 'SUCCESS', corr(req));
  }

  // Pay with the customer's mock wallet balance (the money that came from refunds).
  @Post('orders/:orderId/pay-with-wallet')
  payWithWallet(@Req() req: AuthedRequest, @Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.payments.payWithWallet(req.user, orderId, corr(req));
  }

  @Get('orders/:orderId')
  one(@Req() req: AuthedRequest, @Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.payments.getOne(req.user, orderId);
  }

  @Get('admin/all')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  all(@Query() q: PageDto) {
    return this.payments.listAll(q.page, q.limit);
  }

  @Post('orders/:orderId/refund')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  refund(@Req() req: AuthedRequest, @Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.payments.adminRefund(orderId, corr(req));
  }
}
