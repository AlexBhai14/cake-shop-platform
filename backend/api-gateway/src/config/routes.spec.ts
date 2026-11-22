import { isPublicRoute } from './public-routes';
import { loadServiceUrls, resolveRoute } from './routes';

const urls = loadServiceUrls({ PRODUCT_SERVICE_URL: 'http://product:3003/' });

describe('resolveRoute', () => {
  it('maps /api/auth/login to the auth service without the /api prefix', () => {
    const r = resolveRoute('/api/auth/login', urls);
    expect(r).toEqual({ service: 'auth', baseUrl: 'http://localhost:3001', upstreamPath: '/auth/login' });
  });

  it('keeps the query string and trims a trailing slash from the base URL', () => {
    const r = resolveRoute('/api/cakes?search=velvet&eggless=true', urls);
    expect(r?.service).toBe('product');
    expect(r?.baseUrl).toBe('http://product:3003');
    expect(r?.upstreamPath).toBe('/cakes?search=velvet&eggless=true');
  });

  it('routes categories, variants, users and cart to the right services', () => {
    expect(resolveRoute('/api/categories', urls)?.service).toBe('product');
    expect(resolveRoute('/api/variants/abc', urls)?.service).toBe('product');
    expect(resolveRoute('/api/users/me/addresses', urls)?.service).toBe('user');
    expect(resolveRoute('/api/cart/items', urls)?.service).toBe('cart');
    expect(resolveRoute('/api/inventory/slots?date=2026-12-01', urls)?.service).toBe('inventory');
    expect(resolveRoute('/api/orders/checkout', urls)?.upstreamPath).toBe('/orders/checkout');
    expect(resolveRoute('/api/payments/orders/abc/pay', urls)?.service).toBe('payment');
    expect(resolveRoute('/api/notifications', urls)?.service).toBe('notification');
  });

  it('returns null for unknown routes and look-alike prefixes', () => {
    expect(resolveRoute('/api/unknown', urls)).toBeNull();
    expect(resolveRoute('/api/cakesX', urls)).toBeNull();
    expect(resolveRoute('/health', urls)).toBeNull();
  });
});

describe('isPublicRoute', () => {
  it('allows login, register and browsing without a token', () => {
    expect(isPublicRoute('POST', '/api/auth/login')).toBe(true);
    expect(isPublicRoute('POST', '/api/auth/register')).toBe(true);
    expect(isPublicRoute('GET', '/api/cakes')).toBe(true);
    expect(isPublicRoute('GET', '/api/cakes/123')).toBe(true);
    expect(isPublicRoute('GET', '/api/categories')).toBe(true);
  });

  it('requires a token for everything else', () => {
    expect(isPublicRoute('GET', '/api/auth/me')).toBe(false);
    expect(isPublicRoute('POST', '/api/cakes')).toBe(false); // admin create
    expect(isPublicRoute('GET', '/api/cakes/admin/all')).toBe(false);
    expect(isPublicRoute('GET', '/api/cart')).toBe(false);
    expect(isPublicRoute('POST', '/api/orders/checkout')).toBe(false);
    expect(isPublicRoute('GET', '/api/inventory/slots')).toBe(false);
    expect(isPublicRoute('POST', '/api/payments/orders/abc/pay')).toBe(false);
    expect(isPublicRoute('GET', '/api/notifications')).toBe(false);
    expect(isPublicRoute('GET', '/api/users/me')).toBe(false);
  });
});
