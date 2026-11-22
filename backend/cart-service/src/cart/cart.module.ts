import { Module } from '@nestjs/common';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { ProductClient } from './product.client';

@Module({ controllers: [CartController], providers: [CartService, ProductClient] })
export class CartModule {}
