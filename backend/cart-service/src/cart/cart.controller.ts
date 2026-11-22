import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../security/jwt-auth.guard';
import { AuthUser, CartService } from './cart.service';
import { AddItemDto, UpdateItemDto } from './dto/cart.dto';

type AuthedRequest = { user: AuthUser };

@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  get(@Req() req: AuthedRequest) {
    return this.cart.getCart(req.user);
  }

  @Post('items')
  add(@Req() req: AuthedRequest, @Body() dto: AddItemDto) {
    return this.cart.addItem(req.user, dto);
  }

  @Patch('items/:itemId')
  update(@Req() req: AuthedRequest, @Param('itemId', ParseUUIDPipe) itemId: string, @Body() dto: UpdateItemDto) {
    return this.cart.updateItem(req.user, itemId, dto.quantity);
  }

  @Delete('items/:itemId')
  remove(@Req() req: AuthedRequest, @Param('itemId', ParseUUIDPipe) itemId: string) {
    return this.cart.removeItem(req.user, itemId);
  }

  @Delete()
  clear(@Req() req: AuthedRequest) {
    return this.cart.clear(req.user);
  }
}
