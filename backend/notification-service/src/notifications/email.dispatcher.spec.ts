import { EmailDispatcher, MAX_ATTEMPTS } from './email.dispatcher';

describe('EmailDispatcher', () => {
  const row = (over: Record<string, unknown> = {}) => ({
    id: 'n1', toEmail: 'a@b.com', subject: 'S', bodyText: 'T', bodyHtml: '<p>T</p>', attempts: 0, ...over,
  });
  let prisma: any;
  let email: { send: jest.Mock };
  let dispatcher: EmailDispatcher;
  const now = new Date('2026-11-10T10:00:00Z');

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    prisma = { notification: { findMany: jest.fn(), update: jest.fn() } };
    email = { send: jest.fn().mockResolvedValue(undefined) };
    dispatcher = new EmailDispatcher(prisma, email as any);
  });

  it('only picks PENDING notifications that are due', async () => {
    prisma.notification.findMany.mockResolvedValue([]);
    await dispatcher.tick(now);
    expect(prisma.notification.findMany.mock.calls[0][0].where).toEqual({ status: 'PENDING', nextAttemptAt: { lte: now } });
  });

  it('sends the email and marks the notification SENT', async () => {
    prisma.notification.findMany.mockResolvedValue([row()]);
    expect(await dispatcher.tick(now)).toBe(1);
    expect(email.send).toHaveBeenCalledWith({ to: 'a@b.com', subject: 'S', text: 'T', html: '<p>T</p>' });
    expect(prisma.notification.update.mock.calls[0][0].data).toMatchObject({ status: 'SENT', attempts: 1 });
  });

  it('keeps a failed email PENDING and tries again later with a delay', async () => {
    prisma.notification.findMany.mockResolvedValue([row({ attempts: 1 })]);
    email.send.mockRejectedValue(new Error('smtp down'));
    expect(await dispatcher.tick(now)).toBe(0);
    const data = prisma.notification.update.mock.calls[0][0].data;
    expect(data.status).toBe('PENDING');
    expect(data.attempts).toBe(2);
    expect(data.nextAttemptAt).toEqual(new Date(now.getTime() + 60_000));
    expect(data.lastError).toContain('smtp down');
  });

  it('gives up after the maximum number of attempts', async () => {
    prisma.notification.findMany.mockResolvedValue([row({ attempts: MAX_ATTEMPTS - 1 })]);
    email.send.mockRejectedValue(new Error('smtp down'));
    await dispatcher.tick(now);
    expect(prisma.notification.update.mock.calls[0][0].data.status).toBe('FAILED');
  });

  it('one failing email does not stop the next one', async () => {
    prisma.notification.findMany.mockResolvedValue([row({ id: 'n1' }), row({ id: 'n2' })]);
    email.send.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(undefined);
    expect(await dispatcher.tick(now)).toBe(1);
  });
});
