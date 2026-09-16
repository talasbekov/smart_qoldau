import {
  activateSupportOwner,
  clearAllSupportStorage,
  clearOtherSupportStorage,
  createSupportStorage,
  purgeLegacySupportStorage,
  supportSessionEpochKey,
} from './support-storage';

const createPayload = {
  category: 'TECHNICAL' as const,
  subject: 'Камера',
  body: 'Не включается камера',
};

describe('support storage', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => jest.restoreAllMocks());

  it('isolates drafts by owner and validates the embedded owner', () => {
    const a = createSupportStorage('user-a');
    const b = createSupportStorage('user-b');

    expect(a.saveCreateDraft({ revision: 'a-1', payload: createPayload })).toBe(
      true,
    );
    expect(a.readCreateDraft()).toEqual({
      status: 'valid',
      value: { revision: 'a-1', payload: createPayload },
    });
    expect(b.readCreateDraft()).toEqual({ status: 'missing' });
  });

  it('never treats malformed pending data as an absent operation', () => {
    const storage = createSupportStorage('user-a');
    localStorage.setItem(
      storage.keys.createPending,
      JSON.stringify({
        version: 1,
        ownerId: 'user-a',
        kind: 'create-pending',
        operationId: 'op-1',
        draftRevision: 'a-1',
        payload: createPayload,
        baselineIds: {},
      }),
    );

    expect(storage.readCreatePending()).toEqual({ status: 'corrupt' });
  });

  it('does not hydrate a draft whose runtime field types are invalid', () => {
    const storage = createSupportStorage('user-a');
    localStorage.setItem(
      storage.keys.createDraft,
      JSON.stringify({
        version: 1,
        ownerId: 'user-a',
        kind: 'create-draft',
        revision: 'a-1',
        payload: { ...createPayload, subject: 17 },
      }),
    );

    expect(storage.readCreateDraft()).toEqual({ status: 'corrupt' });
  });

  it('stores the immutable full payload for an unknown create', () => {
    const storage = createSupportStorage('user-a');
    expect(
      storage.saveCreatePending({
        operationId: 'op-1',
        draftRevision: 'a-1',
        payload: createPayload,
        baselineIds: ['old'],
      }),
    ).toBe(true);

    expect(storage.readCreatePending()).toEqual({
      status: 'valid',
      value: {
        operationId: 'op-1',
        draftRevision: 'a-1',
        payload: createPayload,
        baselineIds: ['old'],
      },
    });
  });

  it('removes only the draft revision and pending operation that completed', () => {
    const storage = createSupportStorage('user-a');
    storage.saveCreateDraft({ revision: 'newer', payload: createPayload });
    storage.saveCreatePending({
      operationId: 'op-newer',
      draftRevision: 'newer',
      payload: createPayload,
      baselineIds: [],
    });

    expect(storage.removeCreateDraftIfRevision('older')).toBe(false);
    expect(storage.removeCreatePendingIfOperation('op-older')).toBe(false);
    expect(storage.readCreateDraft().status).toBe('valid');
    expect(storage.readCreatePending().status).toBe('valid');

    expect(storage.removeCreateDraftIfRevision('newer')).toBe(true);
    expect(storage.removeCreatePendingIfOperation('op-newer')).toBe(true);
    expect(storage.readCreateDraft()).toEqual({ status: 'missing' });
    expect(storage.readCreatePending()).toEqual({ status: 'missing' });
  });

  it('contains unavailable browser storage without throwing', () => {
    const storage = createSupportStorage('user-a');
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });

    expect(storage.readCreateDraft()).toEqual({ status: 'unavailable' });
    expect(() => storage.readCreatePending()).not.toThrow();
  });

  it('reports quota failure instead of pretending pending is durable', () => {
    const storage = createSupportStorage('user-a');
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });

    expect(
      storage.saveCreatePending({
        operationId: 'op-1',
        draftRevision: 'a-1',
        payload: createPayload,
        baselineIds: [],
      }),
    ).toBe(false);
  });

  it('does not hydrate legacy shared keys and can purge them safely', () => {
    localStorage.setItem(
      'smartqoldau:support:create:draft',
      JSON.stringify({ subject: 'private legacy text' }),
    );
    localStorage.setItem(
      'smartqoldau:support:reply:ticket-1:draft',
      'private reply',
    );

    const storage = createSupportStorage('user-b');
    expect(storage.readCreateDraft()).toEqual({ status: 'missing' });
    expect(purgeLegacySupportStorage()).toBe(true);
    expect(localStorage.length).toBe(0);
  });

  it('clears all scoped and guest support data on logout', () => {
    createSupportStorage('user-a').saveCreateDraft({
      revision: 'a-1',
      payload: createPayload,
    });
    createSupportStorage('guest').saveGuestDraft({
      revision: 'g-1',
      payload: { name: 'Гость', contact: 'g@example.com', message: 'Текст' },
    });
    localStorage.setItem('unrelated', 'keep');

    expect(clearAllSupportStorage()).toBe(true);
    expect(localStorage.getItem('unrelated')).toBe('keep');
    expect(
      Array.from({ length: localStorage.length }, (_, index) =>
        localStorage.key(index),
      ).filter((key) => key?.endsWith(':draft')),
    ).toEqual([]);
  });

  it('clears another account and legacy data when an owner becomes active', () => {
    createSupportStorage('user-a').saveCreateDraft({
      revision: 'a-1',
      payload: createPayload,
    });
    createSupportStorage('user-b').saveCreateDraft({
      revision: 'b-1',
      payload: createPayload,
    });
    localStorage.setItem('smartqoldau:support:create:draft', 'legacy');

    expect(clearOtherSupportStorage('user-b')).toBe(true);
    expect(createSupportStorage('user-a').readCreateDraft().status).toBe(
      'missing',
    );
    expect(createSupportStorage('user-b').readCreateDraft().status).toBe(
      'valid',
    );
  });

  it('redacts pending payloads on logout while preserving unknown blocking', () => {
    const storage = createSupportStorage('user-a');
    storage.saveCreateDraft({ revision: 'a-1', payload: createPayload });
    storage.saveCreatePending({
      operationId: 'operation-a',
      draftRevision: 'a-1',
      payload: createPayload,
      baselineIds: ['old'],
    });

    expect(clearAllSupportStorage()).toBe(true);
    expect(storage.readCreateDraft()).toEqual({ status: 'missing' });
    expect(storage.readCreatePending()).toEqual({
      status: 'valid',
      value: { operationId: 'operation-a', unknown: true },
    });
    expect(localStorage.getItem(storage.keys.createPending)).not.toContain(
      createPayload.body,
    );
  });

  it('migrates a legacy pending to a global conservative marker', () => {
    localStorage.setItem(
      'smartqoldau:support:create:pending',
      JSON.stringify({ subject: 'private legacy text' }),
    );

    expect(purgeLegacySupportStorage()).toBe(true);
    expect(createSupportStorage('user-a').readCreatePending().status).toBe(
      'valid',
    );
    expect(
      localStorage.getItem('smartqoldau:support:create:pending'),
    ).toBeNull();
  });

  it('acquires each pending slot without overwriting an existing operation', async () => {
    const storage = createSupportStorage('user-a');
    expect(
      await storage.acquireCreatePending({
        operationId: 'create-1',
        draftRevision: 'draft-1',
        payload: createPayload,
        baselineIds: [],
      }),
    ).toBe('acquired');
    expect(
      await storage.acquireCreatePending({
        operationId: 'create-2',
        draftRevision: 'draft-2',
        payload: createPayload,
        baselineIds: [],
      }),
    ).toBe('occupied');

    expect(
      await storage.acquireReplyPending('ticket-1', {
        operationId: 'reply-1',
        draftRevision: 'reply-draft',
        payload: { body: 'reply' },
        baselineIds: [],
      }),
    ).toBe('acquired');
    expect(
      await storage.acquireReplyPending('ticket-1', {
        operationId: 'reply-2',
        draftRevision: 'reply-draft-2',
        payload: { body: 'reply 2' },
        baselineIds: [],
      }),
    ).toBe('occupied');

    const guest = createSupportStorage('guest');
    expect(
      await guest.acquireGuestPending({
        operationId: 'guest-1',
        draftRevision: 'guest-draft',
        payload: {
          name: 'Guest',
          contact: 'g@example.com',
          message: 'message',
        },
      }),
    ).toBe('acquired');
    expect(
      await guest.acquireGuestPending({
        operationId: 'guest-2',
        draftRevision: 'guest-draft-2',
        payload: {
          name: 'Guest',
          contact: 'g@example.com',
          message: 'message',
        },
      }),
    ).toBe('occupied');
  });

  it('changes the session epoch only when the active owner changes', () => {
    const first = activateSupportOwner('user-a');
    const same = activateSupportOwner('user-a');
    const switched = activateSupportOwner('user-b');

    expect(first.status).toBe('valid');
    expect(same).toEqual(first);
    expect(switched.status).toBe('valid');
    if (first.status === 'valid' && switched.status === 'valid') {
      expect(switched.epoch).not.toBe(first.epoch);
    }
    expect(localStorage.getItem(supportSessionEpochKey)).not.toBeNull();
  });
});
