import { CorrelationIdMiddleware } from './correlation-id.middleware';

describe('CorrelationIdMiddleware', () => {
  const mw = new CorrelationIdMiddleware();
  const run = (header?: string) => {
    const req: any = { headers: header ? { 'x-correlation-id': header } : {} };
    const res: any = { setHeader: jest.fn() };
    const next = jest.fn();
    mw.use(req, res, next);
    return { req, res, next };
  };

  it('generates an id when none is sent and echoes it in the response', () => {
    const { req, res, next } = run();
    expect(req.headers['x-correlation-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.setHeader).toHaveBeenCalledWith('X-Correlation-Id', req.headers['x-correlation-id']);
    expect(next).toHaveBeenCalled();
  });

  it('keeps a valid incoming id', () => {
    expect(run('abc-12345678').req.headers['x-correlation-id']).toBe('abc-12345678');
  });

  it('replaces an unsafe incoming id', () => {
    expect(run('bad id\nwith newline').req.headers['x-correlation-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});
