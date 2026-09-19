const test = require('node:test');
const assert = require('node:assert/strict');
const { validateTarget, resetMockHolds } = require('./seed-comm-fixtures.cjs');
const base = { DATABASE_URL: 'postgresql://fixture:fixture@127.0.0.1:15439/smartqoldau_comm_test', JWT_SECRET: 'only-for-disposable-comm-tests-123456789', REDIS_URL: 'redis://127.0.0.1:16389' };
test('accepts only the dedicated loopback fixture database', () => {
  assert.equal(validateTarget(base).databaseUrl, base.DATABASE_URL);
});
test('rejects shared database, default postgres port, and non-loopback targets before connecting', () => {
  for (const url of [
    'postgresql://fixture:fixture@127.0.0.1:15439/smartqoldau',
    'postgresql://fixture:fixture@127.0.0.1:5432/smartqoldau_comm_test',
    'postgresql://fixture:fixture@database:15439/smartqoldau_comm_test',
  ]) assert.throws(() => validateTarget({ ...base, DATABASE_URL: url }), /dedicated/);
});
test('requires an explicitly supplied test JWT secret', () => {
  assert.throws(() => validateTarget({ DATABASE_URL: base.DATABASE_URL, REDIS_URL: base.REDIS_URL }), /JWT_SECRET/);
});

test('rejects any shared or non-loopback Redis before connecting', () => {
  for (const redis of ['redis://127.0.0.1:6379', 'redis://shared:16389', 'redis://127.0.0.1:16389/1']) {
    assert.throws(() => validateTarget({ ...base, REDIS_URL: redis }), /Redis/);
  }
});
test('creates usable mock holds and clears only fixture settlement idempotency keys', async () => {
  const records = new Map([['mockpay:idem:capture:test-payment', 'stale'], ['unrelated-key', 'preserve']]);
  const redis = { set: async (key, value) => records.set(key, value), del: async (...keys) => keys.forEach((key) => records.delete(key)) };
  await resetMockHolds(redis, { chat: { paymentId: 'test-payment' } });
  assert.deepEqual(JSON.parse(records.get('mockpay:hold:disposable-hold-chat')), { providerHoldId: 'disposable-hold-chat', token: 'disposable-fixture-no-provider', amountTiyn: 100000, status: 'held' });
  assert.equal(records.has('mockpay:idem:capture:test-payment'), false);
  assert.equal(records.get('unrelated-key'), 'preserve');
});
