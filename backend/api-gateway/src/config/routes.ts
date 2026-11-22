export type ServiceName = 'auth' | 'user' | 'product' | 'cart' | 'inventory' | 'order' | 'payment' | 'notification';
export type ServiceUrls = Record<ServiceName, string>;

export interface ResolvedRoute {
  service: ServiceName;
  baseUrl: string;
  // Path + query string sent to the microservice (the "/api" prefix removed)
  upstreamPath: string;
}

// Which public URL prefix belongs to which microservice.
const PREFIXES: Array<{ prefix: string; service: ServiceName }> = [
  { prefix: '/api/auth', service: 'auth' },
  { prefix: '/api/users', service: 'user' },
  { prefix: '/api/categories', service: 'product' },
  { prefix: '/api/cakes', service: 'product' },
  { prefix: '/api/variants', service: 'product' },
  { prefix: '/api/cart', service: 'cart' },
  { prefix: '/api/inventory', service: 'inventory' },
  { prefix: '/api/orders', service: 'order' },
  { prefix: '/api/payments', service: 'payment' },
  { prefix: '/api/notifications', service: 'notification' },
];

export function loadServiceUrls(env: Record<string, string | undefined>): ServiceUrls {
  return {
    auth: env.AUTH_SERVICE_URL ?? 'http://localhost:3001',
    user: env.USER_SERVICE_URL ?? 'http://localhost:3002',
    product: env.PRODUCT_SERVICE_URL ?? 'http://localhost:3003',
    cart: env.CART_SERVICE_URL ?? 'http://localhost:3004',
    inventory: env.INVENTORY_SERVICE_URL ?? 'http://localhost:3005',
    order: env.ORDER_SERVICE_URL ?? 'http://localhost:3006',
    payment: env.PAYMENT_SERVICE_URL ?? 'http://localhost:3007',
    notification: env.NOTIFICATION_SERVICE_URL ?? 'http://localhost:3008',
  };
}

export function resolveRoute(originalUrl: string, urls: ServiceUrls): ResolvedRoute | null {
  const pathname = originalUrl.split('?')[0];
  for (const { prefix, service } of PREFIXES) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) {
      return {
        service,
        baseUrl: urls[service].replace(/\/+$/, ''),
        upstreamPath: originalUrl.slice('/api'.length),
      };
    }
  }
  return null;
}
