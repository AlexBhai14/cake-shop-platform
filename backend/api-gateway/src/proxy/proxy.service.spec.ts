import { BadGatewayException, GatewayTimeoutException } from '@nestjs/common';
import { ProxyService } from './proxy.service';

describe('ProxyService', () => {
  const route = { service: 'product' as const, baseUrl: 'http://product:3003', upstreamPath: '/cakes?x=1' };
  const config = { get: () => '8000' } as any;
  const originalFetch = global.fetch;
  let service: ProxyService;
  let res: any;

  const makeReq = (over: Record<string, unknown> = {}) =>
    ({
      method: 'GET',
      ip: '9.9.9.9',
      headers: { host: 'localhost:3000', authorization: 'Bearer abc', 'content-length': '10' },
      body: {},
      ...over,
    }) as any;

  beforeEach(() => {
    service = new ProxyService(config);
    res = { status: jest.fn().mockReturnThis(), setHeader: jest.fn(), send: jest.fn() };
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('forwards method, URL, correlation id and authorization, and drops hop-by-hop headers', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      status: 200,
      headers: { get: () => 'application/json' },
      arrayBuffer: async () => new TextEncoder().encode('{"ok":true}').buffer,
    });
    global.fetch = fetchMock as any;

    await service.forward(makeReq(), res, route, 'corr-1234');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://product:3003/cakes?x=1');
    expect(init.method).toBe('GET');
    expect(init.headers['x-correlation-id']).toBe('corr-1234');
    expect(init.headers['authorization']).toBe('Bearer abc');
    expect(init.headers['x-forwarded-for']).toBe('9.9.9.9');
    expect(init.headers['host']).toBeUndefined();
    expect(init.headers['content-length']).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalled();
  });

  it('passes upstream error responses through unchanged', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 403,
      headers: { get: () => 'application/json' },
      arrayBuffer: async () => new TextEncoder().encode('{"message":"Insufficient permissions"}').buffer,
    }) as any;
    await service.forward(makeReq(), res, route, 'corr-1234');
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('sends a JSON body for POST requests', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      status: 201,
      headers: { get: () => null },
      arrayBuffer: async () => new ArrayBuffer(0),
    });
    global.fetch = fetchMock as any;
    await service.forward(makeReq({ method: 'POST', body: { name: 'Test' } }), res, route, 'corr-1234');
    expect(fetchMock.mock.calls[0][1].body).toBe('{"name":"Test"}');
    expect(fetchMock.mock.calls[0][1].headers['content-type']).toBe('application/json');
  });

  it('returns 502 when the microservice is unreachable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('fetch failed')) as any;
    await expect(service.forward(makeReq(), res, route, 'corr-1234')).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('returns 504 when the microservice times out', async () => {
    const err = new Error('timeout');
    err.name = 'TimeoutError';
    global.fetch = jest.fn().mockRejectedValue(err) as any;
    await expect(service.forward(makeReq(), res, route, 'corr-1234')).rejects.toBeInstanceOf(GatewayTimeoutException);
  });
});
