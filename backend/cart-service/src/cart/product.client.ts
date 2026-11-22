import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ProductVariant {
  id: string;
  cakeId: string;
  cakeName: string;
  flavour: string;
  weightGrams: number;
  eggless: boolean;
  price: string;
  available: boolean;
}

// Talks to the product-service over REST. The cart never reads the product database.
@Injectable()
export class ProductClient {
  constructor(private readonly config: ConfigService) {}

  // Returns null when the variant does not exist; throws 503 when the product-service is down.
  async getVariant(id: string): Promise<ProductVariant | null> {
    const base = this.config.get<string>('PRODUCT_SERVICE_URL') ?? 'http://localhost:3003';
    try {
      const res = await fetch(`${base}/variants/${id}`, { signal: AbortSignal.timeout(5000) });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`product-service returned ${res.status}`);
      return (await res.json()) as ProductVariant;
    } catch {
      throw new ServiceUnavailableException('Product service is unavailable');
    }
  }
}
