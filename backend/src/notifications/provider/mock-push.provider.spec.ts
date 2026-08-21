import { MockPushProvider } from './mock-push.provider';

// Юнит: RedisService мокается in-memory, реальный Redis не нужен (паттерн
// MockPaymentProvider.spec).
describe('MockPushProvider (юнит)', () => {
  function makeRedisMock() {
    const store = new Map<string, string>();
    const lists = new Map<string, string[]>();
    return {
      get: jest.fn(async (key: string) => store.get(key) ?? null),
      set: jest.fn(async (key: string, value: string) => {
        store.set(key, value);
        return 'OK';
      }),
      rpush: jest.fn(async (key: string, value: string) => {
        const list = lists.get(key) ?? [];
        list.push(value);
        lists.set(key, list);
        return list.length;
      }),
      expire: jest.fn(async () => 1),
      lrange: jest.fn(async (key: string, start: number, stop: number) =>
        (lists.get(key) ?? []).slice(start, stop === -1 ? undefined : stop + 1),
      ),
      _store: store,
      _lists: lists,
    } as any;
  }

  it('send пишет отправку в mockpush:sent:{token} со всеми полями и возвращает providerMessageId', async () => {
    const redis = makeRedisMock();
    const provider = new MockPushProvider(redis);

    const result = await provider.send({
      token: 'tok-1',
      title: 'Новая заявка',
      body: 'Откройте приложение',
      data: { offerId: 'offer-1' },
      critical: true,
    });

    expect(result.providerMessageId).toBeTruthy();
    const sent = redis._lists.get('mockpush:sent:tok-1');
    expect(sent).toHaveLength(1);
    const record = JSON.parse(sent[0]);
    expect(record).toMatchObject({
      title: 'Новая заявка',
      body: 'Откройте приложение',
      data: { offerId: 'offer-1' },
      critical: true,
      providerMessageId: result.providerMessageId,
    });
  });

  it('флаг mockpush:fail:{token} -> throw, отправка не записана', async () => {
    const redis = makeRedisMock();
    await redis.set('mockpush:fail:tok-2', '1');
    const provider = new MockPushProvider(redis);

    await expect(
      provider.send({
        token: 'tok-2',
        title: 'x',
        body: 'y',
        data: {},
        critical: false,
      }),
    ).rejects.toThrow();
    expect(redis._lists.get('mockpush:sent:tok-2')).toBeUndefined();
  });
});
