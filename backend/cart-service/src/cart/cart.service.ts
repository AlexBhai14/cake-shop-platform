import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddItemDto } from './dto/cart.dto';
import { fromMinor, toMinor } from './money.util';
import { ProductClient, ProductVariant } from './product.client';

export const MAX_QUANTITY_PER_ITEM = 20;

export interface AuthUser {
  userId: string;
  email: string;
  role: string;
}

interface StoredItem {
  id: string;
  variantId: string;
  quantity: number;
  message: string | null;
}

// Pure function: combines stored cart lines with CURRENT product data.
export function buildCartView(items: StoredItem[], variants: Array<ProductVariant | null>) {
  let subtotalMinor = 0;
  let hasUnavailableItems = false;

  const lines = items.map((item, index) => {
    const v = variants[index];
    const available = !!v && v.available;
    if (!available) hasUnavailableItems = true;
    const unitMinor = v ? toMinor(v.price) : 0;
    const lineMinor = unitMinor * item.quantity;
    if (available) subtotalMinor += lineMinor;
    return {
      id: item.id,
      variantId: item.variantId,
      quantity: item.quantity,
      message: item.message,
      cakeName: v?.cakeName ?? 'Unavailable item',
      flavour: v?.flavour ?? null,
      weightGrams: v?.weightGrams ?? null,
      eggless: v?.eggless ?? null,
      unitPrice: fromMinor(unitMinor),
      lineTotal: fromMinor(lineMinor),
      available,
    };
  });

  return { items: lines, subtotal: fromMinor(subtotalMinor), currency: 'INR', hasUnavailableItems };
}

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductClient,
  ) {}

  private getOrCreateCart(userId: string) {
    return this.prisma.cart.upsert({
      where: { userId },
      update: {},
      create: { userId },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async getCart(user: AuthUser) {
    const cart = await this.getOrCreateCart(user.userId);
    const variants = await Promise.all(cart.items.map((i) => this.products.getVariant(i.variantId)));
    return buildCartView(cart.items, variants);
  }

  async addItem(user: AuthUser, dto: AddItemDto) {
    const variant = await this.products.getVariant(dto.variantId);
    if (!variant || !variant.available) {
      throw new BadRequestException('This cake option is not available');
    }
    const cart = await this.getOrCreateCart(user.userId);
    const existing = await this.prisma.cartItem.findFirst({
      where: { cartId: cart.id, variantId: dto.variantId },
    });

    const newQuantity = (existing?.quantity ?? 0) + dto.quantity;
    if (newQuantity > MAX_QUANTITY_PER_ITEM) {
      throw new BadRequestException(`You can order at most ${MAX_QUANTITY_PER_ITEM} of the same cake`);
    }

    if (existing) {
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: newQuantity, ...(dto.message !== undefined ? { message: dto.message } : {}) },
      });
    } else {
      await this.prisma.cartItem.create({
        data: { cartId: cart.id, variantId: dto.variantId, quantity: dto.quantity, message: dto.message },
      });
    }
    return this.getCart(user);
  }

  async updateItem(user: AuthUser, itemId: string, quantity: number) {
    const cart = await this.getOrCreateCart(user.userId);
    const item = await this.prisma.cartItem.findFirst({ where: { id: itemId, cartId: cart.id } });
    if (!item) throw new NotFoundException('Cart item not found'); // also covers other users' items
    await this.prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
    return this.getCart(user);
  }

  async removeItem(user: AuthUser, itemId: string) {
    const cart = await this.getOrCreateCart(user.userId);
    const item = await this.prisma.cartItem.findFirst({ where: { id: itemId, cartId: cart.id } });
    if (!item) throw new NotFoundException('Cart item not found');
    await this.prisma.cartItem.delete({ where: { id: itemId } });
    return this.getCart(user);
  }

  async clear(user: AuthUser) {
    const cart = await this.getOrCreateCart(user.userId);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return this.getCart(user);
  }
}
