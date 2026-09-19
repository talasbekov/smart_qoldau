#!/usr/bin/env node
// OPERATOR-ONLY, insert-only setup for manual testing on a dev-SMS/mock-payment
// deployment. Not the disposable seed. Does not issue JWTs, OTPs, requests,
// consultations, holds, or payments. Does not read a repository .env file.
//
// Run from the backend directory with the deployment's explicit environment:
// node scripts/prepare-manual-communications.cjs --allow-testonly-setup \
//   --database-name=THE_CONFIRMED_DATABASE_NAME
//
// Any existing fixture ID/phone/slug aborts the whole transaction, even if it
// looks like an earlier test setup. This script NEVER repairs/updates/deletes.
const crypto = require('node:crypto');
function fixtureId(label) {
  const h = crypto.createHash('sha256').update(`smartqoldau-manual-testonly-v1:${label}`).digest('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
}
function fixturePlan() {
  const client = { id: fixtureId('client'), phone: '+77000001981', displayName: 'TESTONLY Manual Client', locale: 'ru', isGuest: false };
  const expertUser = { id: fixtureId('expert-user'), phone: '+77000001982', displayName: 'TESTONLY Manual Expert', locale: 'ru', isGuest: false };
  const topic = { id: fixtureId('topic'), slug: 'testonly-manual-communications', nameRu: 'TESTONLY Проверка связи', nameKz: 'TESTONLY Байланысты тексеру', sortOrder: 99999, isActive: true };
  const expert = { id: fixtureId('expert'), userId: expertUser.id, displayName: 'TESTONLY Manual Expert', city: 'Алматы', experience: 'THREE_TO_FIVE', education: 'TESTONLY synthetic profile; not a real professional', priceTiyn: 300000, languages: ['ru','kz'], formats: ['chat','audio','video'], verificationStatus: 'VERIFIED', workStatus: 'ACCEPTING', isBlocked: false, about: 'TESTONLY: профиль только для ручной проверки связи, не настоящий специалист.', aboutStatus: 'APPROVED' };
  const method = { id: fixtureId('payment-method'), userId: client.id, providerToken: `mockpay_tok_1111_TESTONLY_${fixtureId('payment-method')}`, maskedPan: '**** 1111', brand: 'visa', holderName: 'TESTONLY CLIENT' };
  return { client, expertUser, topic, expert, method };
}
function validateManualSetup(env, args) {
  if (!args.includes('--allow-testonly-setup')) throw new Error('Explicit --allow-testonly-setup is required');
  if (env.SMS_PROVIDER !== 'dev') throw new Error('SMS_PROVIDER must explicitly equal dev');
  if (env.PAYMENT_PROVIDER !== 'mock') throw new Error('PAYMENT_PROVIDER must explicitly equal mock');
  let url;
  try { url = new URL(env.DATABASE_URL); } catch { throw new Error('Explicit database URL required'); }
  if (!['postgresql:', 'postgres:'].includes(url.protocol)) throw new Error('PostgreSQL database required');
  const acknowledged = args.find(arg => arg.startsWith('--database-name='))?.slice('--database-name='.length);
  if (!acknowledged || decodeURIComponent(url.pathname.slice(1)) !== acknowledged) throw new Error('Exact --database-name acknowledgement required');
  return { databaseUrl: env.DATABASE_URL };
}
function assertNoConflicts(rows) {
  if (Object.values(rows).some(items => items.length)) throw new Error('Existing identity/phone/fixture row found; refusing all changes. Inspect manually; no upsert supported.');
}
async function prepareManual(env, args) {
  const { databaseUrl } = validateManualSetup(env, args);
  const plan = fixturePlan();
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    await prisma.$transaction(async tx => {
      const userIds = [plan.client.id, plan.expertUser.id];
      const rows = {
        users: await tx.user.findMany({ where: { OR: [{ id: { in: userIds } }, { phone: { in: [plan.client.phone, plan.expertUser.phone] } }] }, select: { id: true } }),
        experts: await tx.expert.findMany({ where: { OR: [{ id: plan.expert.id }, { userId: { in: userIds } }] }, select: { id: true } }),
        topics: await tx.topic.findMany({ where: { OR: [{ id: plan.topic.id }, { slug: plan.topic.slug }] }, select: { id: true } }),
        methods: await tx.paymentMethod.findMany({ where: { OR: [{ id: plan.method.id }, { userId: { in: userIds } }] }, select: { id: true } }),
      };
      assertNoConflicts(rows);
      await tx.user.createMany({ data: [plan.client, plan.expertUser] });
      await tx.topic.create({ data: plan.topic });
      await tx.expert.create({ data: plan.expert });
      await tx.expertTopic.create({ data: { expertId: plan.expert.id, topicId: plan.topic.id } });
      await tx.paymentMethod.create({ data: plan.method });
    }, { isolationLevel: 'Serializable' });
    return { client: { id: plan.client.id, phone: plan.client.phone }, expert: { id: plan.expert.id, userId: plan.expertUser.id, phone: plan.expertUser.phone }, topicSlug: plan.topic.slug, paymentMethodId: plan.method.id, priceTiyn: plan.expert.priceTiyn, nextSteps: ['Login separately using SMSdev codes from backend logs.', 'Expert sets a current schedule through the normal UI/API.', 'Expert toggles work status to NOT_ACCEPTING then ACCEPTING and keeps dashboard open for heartbeat.', 'Client selects the TESTONLY topic/expert and proceeds through request, hold, chat/audio/video, completion normally.'] };
  } finally { await prisma.$disconnect(); }
}
if (require.main === module) {
  prepareManual(process.env, process.argv.slice(2)).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => {
    // Prisma errors may contain connection details; never print them.
    console.error(`TESTONLY setup refused/failed (${error.code || error.constructor.name}). Check explicit provider/flag/database acknowledgement and possible ID/phone conflicts; no existing rows are changed.`);
    process.exitCode = 1;
  });
}
module.exports = { validateManualSetup, assertNoConflicts, fixturePlan, prepareManual };
