import { Logger } from '@nestjs/common';
import { ContentItem, ContentKind, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { ClockService } from '../common/clock/clock.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ContentAdminService } from './content-admin.service';

const ITEM_ID = '11111111-1111-4111-8111-111111111111';
const ADMIN_ID = '22222222-2222-4222-8222-222222222222';
const OLD_KEY = `content/${ITEM_ID}/33333333-3333-4333-8333-333333333333.mp3`;
const NOW = new Date('2026-09-18T12:00:00.000Z');

function item(
  payload: Record<string, unknown> = {},
  kind: ContentKind = ContentKind.MEDITATION,
): ContentItem {
  return {
    id: ITEM_ID,
    kind,
    access: 'FREE',
    slug: 'calm-audio',
    category: 'calm',
    titleRu: 'Спокойствие',
    titleKk: 'Тыныштық',
    summaryRu: '',
    summaryKk: '',
    payload: payload as Prisma.JsonObject,
    durationSec: null,
    coverKey: null,
    sortOrder: 0,
    usefulYes: 0,
    usefulNo: 0,
    publishedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function dto(overrides: Record<string, unknown> = {}) {
  return {
    kind: ContentKind.MEDITATION,
    access: 'FREE' as const,
    slug: 'calm-audio',
    category: 'calm',
    titleRu: 'Спокойствие',
    titleKk: 'Тыныштық',
    summaryRu: '',
    summaryKk: '',
    payload: {},
    published: false,
    ...overrides,
  };
}

function uploadedFile(): Express.Multer.File {
  return {
    buffer: Buffer.from([0xff, 0xfb, 0x90, 0x00]),
    mimetype: 'audio/mpeg',
    originalname: 'calm.mp3',
  } as Express.Multer.File;
}

function harness(existing = item()) {
  let committed = existing;
  const contentItem = {
    findUnique: jest.fn().mockResolvedValue(existing),
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(existing),
    update: jest.fn().mockResolvedValue(existing),
    updateManyAndReturn: jest.fn().mockImplementation(async ({ data }) => {
      committed = { ...committed, payload: data.payload };
      return [committed];
    }),
    delete: jest.fn().mockResolvedValue(existing),
  };
  const prisma = { contentItem };
  const storage = {
    putContentObject: jest.fn().mockResolvedValue(undefined),
    deleteContentObject: jest.fn().mockResolvedValue(undefined),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const service = new ContentAdminService(
    prisma as unknown as PrismaService,
    { now: () => NOW } as ClockService,
    audit as unknown as AuditService,
    storage as unknown as StorageService,
  );
  return { service, contentItem, storage, audit, committed: () => committed };
}

describe('ContentAdminService audio lifecycle', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => warn.mockRestore());

  it('creates an unpublished audio draft only with an empty request payload', async () => {
    const { service, contentItem } = harness();

    await expect(service.create(ADMIN_ID, dto())).resolves.toBeDefined();
    expect(contentItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ payload: {}, publishedAt: null }),
      }),
    );

    await expect(
      service.create(ADMIN_ID, dto({ payload: { audioKey: 'legacy.mp3' } })),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'VALIDATION_FAILED' }),
      status: 400,
    });
    await expect(
      service.create(ADMIN_ID, dto({ published: true })),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'VALIDATION_FAILED' }),
      status: 400,
    });
  });

  it('rejects audio payload patches and refuses publication until persisted audio exists', async () => {
    const { service, contentItem } = harness(item({}));

    await expect(
      service.patch(ADMIN_ID, ITEM_ID, { payload: { audioKey: 'manual.mp3' } }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'VALIDATION_FAILED' }),
      status: 400,
    });
    await expect(
      service.patch(ADMIN_ID, ITEM_ID, { published: true }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'VALIDATION_FAILED' }),
      status: 400,
    });
    expect(contentItem.update).not.toHaveBeenCalled();
  });

  it('stores a generated key before conditionally committing the payload', async () => {
    const { service, contentItem, storage } = harness(item({}));

    const result = await service.uploadAudio(ADMIN_ID, ITEM_ID, uploadedFile());
    const key = String((result.payload as Record<string, unknown>).audioKey);

    expect(key).toMatch(new RegExp(`^content/${ITEM_ID}/[0-9a-f-]{36}\\.mp3$`));
    expect(key).not.toContain('calm.mp3');
    expect(storage.putContentObject).toHaveBeenCalledWith(
      key,
      uploadedFile().buffer,
      'audio/mpeg',
    );
    expect(contentItem.updateManyAndReturn).toHaveBeenCalledWith({
      where: { id: ITEM_ID, payload: { equals: {} } },
      data: { payload: { audioKey: key } },
    });
    expect(storage.putContentObject.mock.invocationCallOrder[0]).toBeLessThan(
      contentItem.updateManyAndReturn.mock.invocationCallOrder[0],
    );
  });

  it('cleans a confirmed-unreferenced new object when the database update fails', async () => {
    const { service, contentItem, storage } = harness(
      item({ audioKey: OLD_KEY }),
    );
    const dbError = new Error('database unavailable');
    contentItem.updateManyAndReturn.mockRejectedValue(dbError);
    contentItem.findUnique
      .mockReset()
      .mockResolvedValueOnce(item({ audioKey: OLD_KEY }))
      .mockResolvedValueOnce(item({ audioKey: OLD_KEY }));

    await expect(
      service.uploadAudio(ADMIN_ID, ITEM_ID, uploadedFile()),
    ).rejects.toThrow(dbError);

    const newKey = storage.putContentObject.mock.calls[0][0];
    expect(contentItem.findFirst).toHaveBeenCalledWith({
      where: { payload: { path: ['audioKey'], equals: newKey } },
      select: { id: true },
    });
    expect(storage.deleteContentObject).toHaveBeenCalledWith(newKey);
    expect(storage.deleteContentObject).not.toHaveBeenCalledWith(OLD_KEY);
  });

  it('preserves a new object when the database outcome cannot be confirmed', async () => {
    const { service, contentItem, storage } = harness(
      item({ audioKey: OLD_KEY }),
    );
    const dbError = new Error('connection dropped during commit');
    contentItem.updateManyAndReturn.mockRejectedValue(dbError);
    contentItem.findUnique
      .mockReset()
      .mockResolvedValueOnce(item({ audioKey: OLD_KEY }))
      .mockRejectedValueOnce(new Error('cannot refresh'));

    await expect(
      service.uploadAudio(ADMIN_ID, ITEM_ID, uploadedFile()),
    ).rejects.toThrow(dbError);

    const newKey = storage.putContentObject.mock.calls[0][0];
    expect(storage.deleteContentObject).not.toHaveBeenCalledWith(newKey);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(newKey));
  });

  it('returns success when a refresh proves that an apparently failed commit wrote the new key', async () => {
    const { service, contentItem, storage, audit } = harness(
      item({ audioKey: OLD_KEY }),
    );
    contentItem.updateManyAndReturn.mockRejectedValue(
      new Error('connection dropped after commit'),
    );
    contentItem.findUnique
      .mockReset()
      .mockImplementationOnce(async () => item({ audioKey: OLD_KEY }));
    contentItem.findUnique.mockImplementationOnce(async () => {
      const newKey = storage.putContentObject.mock.calls[0][0];
      return item({ audioKey: newKey });
    });

    const result = await service.uploadAudio(ADMIN_ID, ITEM_ID, uploadedFile());
    const newKey = storage.putContentObject.mock.calls[0][0];

    expect((result.payload as Record<string, unknown>).audioKey).toBe(newKey);
    expect(storage.deleteContentObject).not.toHaveBeenCalledWith(newKey);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        transition: 'content.audio_uploaded',
        payload: { replaced: true },
      }),
    );
  });

  it('updates Prisma before deleting an owned old key and keeps success if cleanup fails', async () => {
    const { service, contentItem, storage } = harness(
      item({ audioKey: OLD_KEY }),
    );
    storage.deleteContentObject.mockRejectedValue(new Error('MinIO down'));

    await expect(
      service.uploadAudio(ADMIN_ID, ITEM_ID, uploadedFile()),
    ).resolves.toBeDefined();

    expect(
      contentItem.updateManyAndReturn.mock.invocationCallOrder[0],
    ).toBeLessThan(storage.deleteContentObject.mock.invocationCallOrder[0]);
    expect(storage.deleteContentObject).toHaveBeenCalledWith(OLD_KEY);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(OLD_KEY));
  });

  it('never deletes a legacy key whose ownership is not established', async () => {
    const legacy = 'shared/manual-upload.mp3';
    const { service, storage } = harness(item({ audioKey: legacy }));

    await service.uploadAudio(ADMIN_ID, ITEM_ID, uploadedFile());

    expect(storage.deleteContentObject).not.toHaveBeenCalledWith(legacy);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(legacy));
  });

  it('allows only one simultaneous replacement to commit and never deletes the winning key', async () => {
    let row: ContentItem | null = item({ audioKey: OLD_KEY });
    const deleted = new Set<string>();
    const putKeys: string[] = [];
    let releasePuts!: () => void;
    const putsReleased = new Promise<void>((resolve) => {
      releasePuts = resolve;
    });
    const contentItem = {
      findUnique: jest.fn(async () => row),
      updateManyAndReturn: jest.fn(async ({ where, data }) => {
        const expected = where.payload.equals;
        if (!row || JSON.stringify(row.payload) !== JSON.stringify(expected)) {
          return [];
        }
        row = { ...row, payload: data.payload };
        return [row];
      }),
      findFirst: jest.fn(async ({ where }) => {
        const key = where.payload.equals;
        return row && (row.payload as Record<string, unknown>).audioKey === key
          ? { id: row.id }
          : null;
      }),
    };
    const storage = {
      putContentObject: jest.fn(async (key: string) => {
        putKeys.push(key);
        if (putKeys.length === 2) releasePuts();
        await putsReleased;
      }),
      deleteContentObject: jest.fn(async (key: string) => {
        deleted.add(key);
      }),
    };
    const service = new ContentAdminService(
      { contentItem } as unknown as PrismaService,
      { now: () => NOW } as ClockService,
      { log: jest.fn() } as unknown as AuditService,
      storage as unknown as StorageService,
    );

    const results = await Promise.allSettled([
      service.uploadAudio(ADMIN_ID, ITEM_ID, uploadedFile()),
      service.uploadAudio(ADMIN_ID, ITEM_ID, uploadedFile()),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(rejected).toMatchObject({
      reason: {
        response: expect.objectContaining({ code: 'CONTENT_AUDIO_CHANGED' }),
        status: 409,
      },
    });
    const winningKey = (row?.payload as Record<string, unknown>)
      .audioKey as string;
    expect(putKeys).toContain(winningKey);
    expect(deleted).not.toContain(winningKey);
    expect(deleted).toContain(OLD_KEY);
    expect(putKeys.some((key) => deleted.has(key))).toBe(true);
  });

  it('serializes delete against an in-flight upload and cleans only unreferenced owned objects', async () => {
    let row: ContentItem | null = item({ audioKey: OLD_KEY });
    let uploadedKey = '';
    let announcePut!: () => void;
    let releasePut!: () => void;
    const putStarted = new Promise<void>((resolve) => {
      announcePut = resolve;
    });
    const putGate = new Promise<void>((resolve) => {
      releasePut = resolve;
    });
    const contentItem = {
      findUnique: jest.fn(async () => row),
      updateManyAndReturn: jest.fn(async ({ where, data }) => {
        if (
          !row ||
          JSON.stringify(row.payload) !== JSON.stringify(where.payload.equals)
        ) {
          return [];
        }
        row = { ...row, payload: data.payload };
        return [row];
      }),
      findFirst: jest.fn(async ({ where }) => {
        const key = where.payload.equals;
        return row && (row.payload as Record<string, unknown>).audioKey === key
          ? { id: row.id }
          : null;
      }),
      delete: jest.fn(async () => {
        if (!row) throw new Error('missing');
        const removed = row;
        row = null;
        return removed;
      }),
    };
    const storage = {
      putContentObject: jest.fn(async (key: string) => {
        uploadedKey = key;
        announcePut();
        await putGate;
      }),
      deleteContentObject: jest.fn().mockResolvedValue(undefined),
    };
    const service = new ContentAdminService(
      { contentItem } as unknown as PrismaService,
      { now: () => NOW } as ClockService,
      { log: jest.fn() } as unknown as AuditService,
      storage as unknown as StorageService,
    );

    const upload = service.uploadAudio(ADMIN_ID, ITEM_ID, uploadedFile());
    await putStarted;
    await service.remove(ADMIN_ID, ITEM_ID);
    releasePut();

    await expect(upload).rejects.toMatchObject({ status: 404 });
    expect(row).toBeNull();
    expect(storage.deleteContentObject).toHaveBeenCalledWith(OLD_KEY);
    expect(storage.deleteContentObject).toHaveBeenCalledWith(uploadedKey);
  });

  it('deletes the database row before owned-object cleanup and never reverses a completed remove', async () => {
    const { service, contentItem, storage } = harness(
      item({ audioKey: OLD_KEY }),
    );
    storage.deleteContentObject.mockRejectedValue(new Error('MinIO down'));

    await expect(service.remove(ADMIN_ID, ITEM_ID)).resolves.toBeUndefined();

    expect(contentItem.delete.mock.invocationCallOrder[0]).toBeLessThan(
      storage.deleteContentObject.mock.invocationCallOrder[0],
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(OLD_KEY));
  });
});
