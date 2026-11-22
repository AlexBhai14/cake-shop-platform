import {
  BadRequestException, Body, Controller, Get, Headers, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { JwtAuthGuard } from '../security/jwt-auth.guard';
import { Roles } from '../security/roles.decorator';
import { RolesGuard } from '../security/roles.guard';
import { CheckoutDto, OrderListQueryDto, SetStatusDto } from './dto/order.dto';
import { AuthUser, OrdersService } from './orders.service';

type AuthedRequest = { user: AuthUser; headers: Record<string, string | string[] | undefined> };
const corr = (req: AuthedRequest) => String(req.headers['x-correlation-id'] ?? randomUUID());

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('checkout')
  checkout(
    @Req() req: AuthedRequest,
    @Body() dto: CheckoutDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (idempotencyKey && idempotencyKey.length > 64) throw new BadRequestException('Idempotency-Key is too long');
    return this.orders.checkout(req.user, String(req.headers.authorization), dto, corr(req), idempotencyKey);
  }

  @Get()
  mine(@Req() req: AuthedRequest, @Query() q: OrderListQueryDto) {
    return this.orders.listMine(req.user, q.page, q.limit);
  }

  @Get('admin/stats')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  stats(@Query('days') days?: string) {
    return this.orders.adminStats(Math.min(Math.max(Number(days) || 14, 1), 90));
  }

  // Declared before ":id" so "admin" is not read as an order id
  @Get('admin/all')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  all(@Query() q: OrderListQueryDto) {
    return this.orders.listAll(q.status, q.page, q.limit);
  }

  @Get(':id')
  one(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.getOne(req.user, id);
  }

  @Post(':id/cancel')
  cancel(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.cancel(req.user, id, corr(req));
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  setStatus(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SetStatusDto) {
    return this.orders.adminSetStatus(req.user, id, dto.status, corr(req));
  }
}
