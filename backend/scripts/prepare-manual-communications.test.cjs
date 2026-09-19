const test = require('node:test');
const assert = require('node:assert/strict');
const { validateManualSetup, assertNoConflicts, fixturePlan } = require('./prepare-manual-communications.cjs');
const env = { DATABASE_URL: 'postgresql://operator:password@db:5432/manual_test', SMS_PROVIDER: 'dev', PAYMENT_PROVIDER: 'mock', NODE_ENV: 'production' };
const args = ['--allow-testonly-setup', '--database-name=manual_test'];
test('requires deliberate opt-in and exact database name acknowledgement', () => {
  assert.throws(() => validateManualSetup(env, []), /allow-testonly/);
  assert.throws(() => validateManualSetup(env, ['--allow-testonly-setup', '--database-name=other']), /database/);
  assert.equal(validateManualSetup(env, args).databaseUrl, env.DATABASE_URL);
});
test('refuses SMS or payment provider that could contact real services', () => {
  assert.throws(() => validateManualSetup({ ...env, SMS_PROVIDER: 'mobizon' }, args), /SMS_PROVIDER/);
  assert.throws(() => validateManualSetup({ ...env, PAYMENT_PROVIDER: 'real' }, args), /PAYMENT_PROVIDER/);
});
test('refuses any existing identity or fixture row, including partial prior setup', () => {
  assert.doesNotThrow(() => assertNoConflicts({ users: [], experts: [], topics: [], methods: [] }));
  for (const key of ['users', 'experts', 'topics', 'methods']) {
    assert.throws(() => assertNoConflicts({ users: [], experts: [], topics: [], methods: [], [key]: [{ id: 'already-present' }] }), /Existing/);
  }
});
test('plan uses distinct deterministic TESTONLY identities and supported profile price', () => {
  const a = fixturePlan(); const b = fixturePlan();
  assert.deepEqual(a, b);
  assert.notEqual(a.client.id, a.expertUser.id);
  assert.notEqual(a.client.phone, a.expertUser.phone);
  for (const user of [a.client, a.expertUser]) { assert.match(user.phone, /^\+77\d{9}$/); assert.match(user.displayName, /^TESTONLY /); }
  assert.deepEqual(a.expert.formats, ['chat', 'audio', 'video']);
  assert.ok(a.expert.priceTiyn >= 200000 && a.expert.priceTiyn <= 1500000);
});
