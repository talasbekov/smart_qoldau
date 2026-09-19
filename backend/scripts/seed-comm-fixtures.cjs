#!/usr/bin/env node
// Test fixture only. Refuses every database except localhost:15439 /
// smartqoldau_comm_test. Never loads backend/.env, sends SMS, or calls payment APIs.
// Usage: node scripts/seed-comm-fixtures.cjs --env-file /tmp/.../env.json
// Or provide DATABASE_URL and JWT_SECRET explicitly in the process environment.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function validateTarget(env) {
  let url;
  try { url = new URL(env.DATABASE_URL); } catch { throw new Error('A dedicated DATABASE_URL is required'); }
  if (!['postgresql:', 'postgres:'].includes(url.protocol) || !['127.0.0.1', 'localhost'].includes(url.hostname) || url.port !== '15439' || url.pathname !== '/smartqoldau_comm_test' || url.search) {
    throw new Error('Refusing target: only the dedicated loopback comm-test database is allowed');
  }
  let redis;
  try { redis = new URL(env.REDIS_URL); } catch { throw new Error('Dedicated Redis URL required'); }
  if (redis.protocol !== 'redis:' || !['127.0.0.1', 'localhost'].includes(redis.hostname) || redis.port !== '16389' || !['', '/', '/0'].includes(redis.pathname) || redis.search) throw new Error('Refusing Redis target: only dedicated loopback Redis16389 is allowed');
  if (typeof env.JWT_SECRET !== 'string' || env.JWT_SECRET.length < 32) throw new Error('Explicit test JWT_SECRET of at least 32 characters required');
  return { databaseUrl: env.DATABASE_URL, redisUrl: env.REDIS_URL, secret: env.JWT_SECRET };
}
function id(label) {
  const hex = crypto.createHash('sha256').update(`smartqoldau-disposable-comm-v1:${label}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
function accessToken(userId, secret) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const content = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: userId, isGuest: false, iat: now, exp: now + 2 * 3600 })}`;
  return `${content}.${crypto.createHmac('sha256', secret).update(content).digest('base64url')}`;
}
async function resetMockHolds(redis, scenarios) {
  for (const [format, scenario] of Object.entries(scenarios)) {
    const providerHoldId = `disposable-hold-${format}`;
    const record = { providerHoldId, token: 'disposable-fixture-no-provider', amountTiyn: 100000, status: 'held' };
    await redis.set(`mockpay:hold:${providerHoldId}`, JSON.stringify(record), 'EX', 30 * 86400);
    await redis.set(`mockpay:idem:hold:${scenario.paymentId}:1`, providerHoldId, 'EX', 30 * 86400);
    await redis.del(`mockpay:idem:capture:${scenario.paymentId}`, `mockpay:idem:void:${scenario.paymentId}`);
  }
}
async function seed(env) {
  const { databaseUrl, redisUrl, secret } = validateTarget(env);
  const { PrismaClient } = require('@prisma/client');
  const Redis = require('ioredis');
  const redis = new Redis(redisUrl, { lazyConnect: true, connectTimeout: 3000, maxRetriesPerRequest: 1 });
  redis.on('error', () => {});
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const output = '/tmp/smartqoldau-comm-test/fixtures.json';
  try {
    await redis.connect();
    const now = new Date();
    const credentials = await prisma.$transaction(async (tx) => {
      const topicId = id('topic');
      await tx.topic.upsert({ where: { id: topicId }, create: { id: topicId, slug: 'comm-fixture', nameRu: 'Тест связи', nameKz: 'Байланыс сынағы', sortOrder: 1 }, update: { isActive: true } });
      async function user(label, name) {
        const userId = id(label);
        await tx.user.upsert({ where: { id: userId }, create: { id: userId, displayName: name, locale: 'ru', isGuest: false }, update: { deletedAt: null, displayName: name } });
        const refreshToken = crypto.randomBytes(48).toString('base64url');
        await tx.refreshToken.create({ data: { userId, tokenHash: crypto.createHash('sha256').update(refreshToken).digest('hex'), expiresAt: new Date(now.getTime() + 86400_000) } });
        return { userId, accessToken: accessToken(userId, secret), refreshToken };
      }
      const client = await user('client', 'COMM TEST Client');
      const outsider = await user('outsider', 'COMM TEST Outsider');
      const paymentMethodId = id('payment-method');
      await tx.paymentMethod.upsert({ where: { id: paymentMethodId }, create: { id: paymentMethodId, userId: client.userId, providerToken: 'disposable-fixture-no-provider', maskedPan: '**** 0000', brand: 'fixture', holderName: 'TEST ONLY' }, update: {} });
      const scenarios = {};
      for (const [index, format] of ['chat', 'audio', 'video'].entries()) {
        const expert = await user(`expert-user-${format}`, `COMM TEST ${format} Expert`);
        const expertId = id(`expert-${format}`);
        const expertData = { userId: expert.userId, displayName: `COMM TEST ${format} Expert`, city: 'Алматы', experience: 'THREE_TO_FIVE', education: 'Disposable fixture', priceTiyn: 100000, languages: ['ru', 'kz'], formats: ['chat', 'audio', 'video'], verificationStatus: 'VERIFIED', workStatus: 'BUSY', isBlocked: false };
        await tx.expert.upsert({ where: { id: expertId }, create: { id: expertId, ...expertData }, update: expertData });
        await tx.expertTopic.upsert({ where: { expertId_topicId: { expertId, topicId } }, create: { expertId, topicId }, update: {} });
        const requestId = id(`request-${format}`);
        const clientCode = 8800 + index;
        const requestData = { clientUserId: client.userId, clientCode, topicId, format, status: 'MATCHED', directedExpertId: expertId, matchedExpertId: expertId, closedAt: now };
        await tx.request.upsert({ where: { id: requestId }, create: { id: requestId, ...requestData }, update: requestData });
        const candidateId = id(`candidate-${format}`);
        const candidateData = { requestId, expertId, offeredAt: now, deadlineAt: new Date(now.getTime() + 60_000), respondedAt: now, response: 'ACCEPTED' };
        await tx.requestCandidate.upsert({ where: { id: candidateId }, create: { id: candidateId, ...candidateData }, update: candidateData });
        const consultationId = id(`consultation-${format}`);
        const consultationData = { requestId, clientUserId: client.userId, clientCode, expertId, topicId, format, status: 'ACTIVE', paymentStatus: 'HELD', priceTiyn: 100000, plannedDurationMin: 50, startedAt: now, endedAt: null, outcome: null, clientJoinedAt: null, expertJoinedAt: null, noShowNotifiedAt: null };
        await tx.consultation.upsert({ where: { id: consultationId }, create: { id: consultationId, ...consultationData }, update: consultationData });
        const paymentId = id(`payment-${format}`);
        const paymentData = { consultationId, clientUserId: client.userId, expertId, paymentMethodId, amountTiyn: 100000, discountTiyn: 0, commissionTiyn: 15000, commissionRateBp: 1500, status: 'HELD', providerHoldId: `disposable-hold-${format}`, holdCreatedAt: now, holdAttempts: 1, settleAttempts: 0, lastSettleAttemptAt: null, failReason: null };
        await tx.payment.upsert({ where: { id: paymentId }, create: { id: paymentId, ...paymentData }, update: paymentData });
        scenarios[format] = { consultationId, requestId, paymentId, expertId, expert, clientPath: `/ru/consultations/${consultationId}`, expertPath: `/ru/expert/consultations/${consultationId}`, room: `cons-${consultationId}` };
      }
      return { createdAt: now.toISOString(), purpose: 'Disposable communication fixture only; no SMS or payment provider invoked', client, outsider, scenarios };
    });
    await resetMockHolds(redis, credentials.scenarios);
    fs.mkdirSync(path.dirname(output), { recursive: true, mode: 0o700 });
    const temporary = `${output}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(credentials, null, 2), { mode: 0o600, flag: 'wx' });
    fs.renameSync(temporary, output);
    // IDs are safe to report; never print credentials or the database URI.
    console.log(JSON.stringify({ output, clientUserId: credentials.client.userId, scenarios: Object.fromEntries(Object.entries(credentials.scenarios).map(([format, value]) => [format, { consultationId: value.consultationId, expertId: value.expertId }])) }));
    return credentials;
  } finally { await prisma.$disconnect(); redis.disconnect(); }
}
if (require.main === module) {
  Promise.resolve().then(() => {
    const arg = process.argv.indexOf('--env-file');
    let env = process.env;
    if (arg !== -1) env = { ...process.env, ...JSON.parse(fs.readFileSync(process.argv[arg + 1], 'utf8')) };
    return seed(env);
  }).catch((error) => {
    console.error(`Fixture seed failed (${error.code || error.constructor.name}); no credentials printed.`);
    process.exitCode = 1;
  });
}
module.exports = { validateTarget, resetMockHolds, seed };
