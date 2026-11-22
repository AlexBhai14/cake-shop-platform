import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CartLine {
  variantId: string;
  quantity: number;
  message: string | null;
  cakeName: string;
  flavour: string | null;
  weightGrams: number | null;
  eggless: boolean | null;
  unitPrice: string;
  lineTotal: string;
  available: boolean;
}

export interface CartView {
  items: CartLine[];
  subtotal: string;
  currency: string;
  hasUnavailableItems: boolean;
}

export interface AddressView {
  id: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

// REST calls to other services. The customer's own token is forwarded, so those services
// apply their normal authorization rules.
@Injectable()
export class ServiceClients {
  constructor(private readonly config: ConfigService) {}

  private async call<T>(url: string, authorization: string, method = 'GET'): Promise<T> {
    try {
      const res = await fetch(url, { method, headers: { authorization }, signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`${url} returned ${res.status}`);
      return (await res.json()) as T;
    } catch {
      throw new ServiceUnavailableException('A required service is unavailable, please try again');
    }
  }

  getCart(authorization: string): Promise<CartView> {
    const base = this.config.get<string>('CART_SERVICE_URL') ?? 'http://localhost:3004';
    return this.call<CartView>(`${base}/cart`, authorization);
  }

  async getAddress(authorization: string, addressId: string): Promise<AddressView | null> {
    const base = this.config.get<string>('USER_SERVICE_URL') ?? 'http://localhost:3002';
    const list = await this.call<AddressView[]>(`${base}/users/me/addresses`, authorization);
    return list.find((a) => a.id === addressId) ?? null;
  }

  // Best effort: the order already exists, so a failure here must not fail the checkout.
  async clearCart(authorization: string): Promise<void> {
    const base = this.config.get<string>('CART_SERVICE_URL') ?? 'http://localhost:3004';
    try {
      await this.call(`${base}/cart`, authorization, 'DELETE');
    } catch {
      console.error(JSON.stringify({ level: 'warn', service: 'order-service', msg: 'could not clear cart after checkout' }));
    }
  }
}
