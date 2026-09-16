import {
  clearAllSupportStorage,
  clearOtherSupportStorage,
  createSupportStorage,
  purgeLegacySupportStorage,
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
    expect(localStorage.length).toBe(1);
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
});
