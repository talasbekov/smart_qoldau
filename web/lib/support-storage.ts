import type { TicketCategory } from './support';

const PREFIX = 'smartqoldau:support:';
const VERSIONED_PREFIX = `${PREFIX}v1:`;
const VERSION = 1 as const;

const CATEGORIES = new Set<string>([
  'CONSULTATIONS',
  'PAYMENT',
  'PAYOUTS',
  'TECHNICAL',
  'ACCOUNT_DATA',
  'VERIFICATION',
  'SECURITY',
  'CLIENT_QUESTION',
  'OTHER',
]);

export type StorageRead<T> =
  | { status: 'valid'; value: T }
  | { status: 'missing' }
  | { status: 'corrupt' }
  | { status: 'unavailable' };

export interface CreatePayload {
  category: TicketCategory;
  subject: string;
  body: string;
}

export interface GuestPayload {
  name: string;
  contact: string;
  message: string;
}

export interface Draft<T> {
  revision: string;
  payload: T;
}

export interface PendingCreate {
  operationId: string;
  draftRevision: string;
  payload: CreatePayload;
  baselineIds: string[];
}

export interface PendingReply {
  operationId: string;
  draftRevision: string;
  payload: { body: string };
  baselineIds: string[];
}

export interface PendingGuest {
  operationId: string;
  draftRevision: string;
  payload: GuestPayload;
}

type Kind =
  | 'create-draft'
  | 'create-pending'
  | 'reply-draft'
  | 'reply-pending'
  | 'guest-draft'
  | 'guest-pending';

type RecordEnvelope = {
  version: typeof VERSION;
  ownerId: string;
  kind: Kind;
  [key: string]: unknown;
};

function browserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

function isCreatePayload(value: unknown): value is CreatePayload {
  return (
    isObject(value) &&
    typeof value.category === 'string' &&
    CATEGORIES.has(value.category) &&
    typeof value.subject === 'string' &&
    typeof value.body === 'string'
  );
}

function isGuestPayload(value: unknown): value is GuestPayload {
  return (
    isObject(value) &&
    typeof value.name === 'string' &&
    typeof value.contact === 'string' &&
    typeof value.message === 'string'
  );
}

function isReplyPayload(value: unknown): value is { body: string } {
  return isObject(value) && typeof value.body === 'string';
}

function readRecord<T>(
  key: string,
  ownerId: string,
  kind: Kind,
  validate: (value: RecordEnvelope) => value is RecordEnvelope & T,
): StorageRead<T> {
  const storage = browserStorage();
  if (!storage) return { status: 'unavailable' };
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return { status: 'unavailable' };
  }
  if (raw === null) return { status: 'missing' };
  try {
    const value: unknown = JSON.parse(raw);
    if (
      !isObject(value) ||
      value.version !== VERSION ||
      value.ownerId !== ownerId ||
      value.kind !== kind ||
      !validate(value as RecordEnvelope)
    ) {
      return { status: 'corrupt' };
    }
    const {
      version: _version,
      ownerId: _ownerId,
      kind: _kind,
      ...data
    } = value as RecordEnvelope;
    return { status: 'valid', value: data as T };
  } catch {
    return { status: 'corrupt' };
  }
}

function writeRecord(
  key: string,
  ownerId: string,
  kind: Kind,
  value: Record<string, unknown>,
): boolean {
  const storage = browserStorage();
  if (!storage) return false;
  try {
    storage.setItem(
      key,
      JSON.stringify({ version: VERSION, ownerId, kind, ...value }),
    );
    return true;
  } catch {
    return false;
  }
}

function remove(key: string): boolean {
  const storage = browserStorage();
  if (!storage) return false;
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function validDraft<T>(
  value: RecordEnvelope,
  payload: (value: unknown) => value is T,
): value is RecordEnvelope & Draft<T> {
  return typeof value.revision === 'string' && payload(value.payload);
}

function validPending<T>(
  value: RecordEnvelope,
  payload: (value: unknown) => value is T,
  withBaseline: boolean,
): boolean {
  return (
    typeof value.operationId === 'string' &&
    typeof value.draftRevision === 'string' &&
    payload(value.payload) &&
    (!withBaseline || isStringArray(value.baselineIds))
  );
}

export function newSupportId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

export function createSupportStorage(ownerId: string) {
  const owner = encodeURIComponent(ownerId);
  const base = `${VERSIONED_PREFIX}${owner}`;
  const keys = {
    createDraft: `${base}:create:draft`,
    createPending: `${base}:create:pending`,
    guestDraft: `${base}:guest:draft`,
    guestPending: `${base}:guest:pending`,
    replyDraft: (ticketId: string) =>
      `${base}:reply:${encodeURIComponent(ticketId)}:draft`,
    replyPending: (ticketId: string) =>
      `${base}:reply:${encodeURIComponent(ticketId)}:pending`,
  };

  return {
    keys,
    readCreateDraft: () =>
      readRecord<Draft<CreatePayload>>(
        keys.createDraft,
        ownerId,
        'create-draft',
        (value): value is RecordEnvelope & Draft<CreatePayload> =>
          validDraft(value, isCreatePayload),
      ),
    saveCreateDraft: (draft: Draft<CreatePayload>) =>
      writeRecord(keys.createDraft, ownerId, 'create-draft', { ...draft }),
    removeCreateDraft: () => remove(keys.createDraft),
    removeCreateDraftIfRevision(revision: string) {
      const current = this.readCreateDraft();
      return current.status === 'valid' && current.value.revision === revision
        ? remove(keys.createDraft)
        : false;
    },
    readCreatePending: () =>
      readRecord<PendingCreate>(
        keys.createPending,
        ownerId,
        'create-pending',
        (value): value is RecordEnvelope & PendingCreate =>
          validPending(value, isCreatePayload, true),
      ),
    saveCreatePending: (pending: PendingCreate) =>
      writeRecord(keys.createPending, ownerId, 'create-pending', {
        ...pending,
      }),
    removeCreatePending: () => remove(keys.createPending),
    removeCreatePendingIfOperation(operationId: string) {
      const current = this.readCreatePending();
      return current.status === 'valid' &&
        current.value.operationId === operationId
        ? remove(keys.createPending)
        : false;
    },
    readReplyDraft: (ticketId: string) =>
      readRecord<Draft<{ body: string }>>(
        keys.replyDraft(ticketId),
        ownerId,
        'reply-draft',
        (value): value is RecordEnvelope & Draft<{ body: string }> =>
          validDraft(value, isReplyPayload),
      ),
    saveReplyDraft: (ticketId: string, draft: Draft<{ body: string }>) =>
      writeRecord(keys.replyDraft(ticketId), ownerId, 'reply-draft', {
        ...draft,
      }),
    removeReplyDraft: (ticketId: string) => remove(keys.replyDraft(ticketId)),
    removeReplyDraftIfRevision(ticketId: string, revision: string) {
      const current = this.readReplyDraft(ticketId);
      return current.status === 'valid' && current.value.revision === revision
        ? remove(keys.replyDraft(ticketId))
        : false;
    },
    readReplyPending: (ticketId: string) =>
      readRecord<PendingReply>(
        keys.replyPending(ticketId),
        ownerId,
        'reply-pending',
        (value): value is RecordEnvelope & PendingReply =>
          validPending(value, isReplyPayload, true),
      ),
    saveReplyPending: (ticketId: string, pending: PendingReply) =>
      writeRecord(keys.replyPending(ticketId), ownerId, 'reply-pending', {
        ...pending,
      }),
    removeReplyPending: (ticketId: string) =>
      remove(keys.replyPending(ticketId)),
    removeReplyPendingIfOperation(ticketId: string, operationId: string) {
      const current = this.readReplyPending(ticketId);
      return current.status === 'valid' &&
        current.value.operationId === operationId
        ? remove(keys.replyPending(ticketId))
        : false;
    },
    readGuestDraft: () =>
      readRecord<Draft<GuestPayload>>(
        keys.guestDraft,
        ownerId,
        'guest-draft',
        (value): value is RecordEnvelope & Draft<GuestPayload> =>
          validDraft(value, isGuestPayload),
      ),
    saveGuestDraft: (draft: Draft<GuestPayload>) =>
      writeRecord(keys.guestDraft, ownerId, 'guest-draft', { ...draft }),
    removeGuestDraft: () => remove(keys.guestDraft),
    removeGuestDraftIfRevision(revision: string) {
      const current = this.readGuestDraft();
      return current.status === 'valid' && current.value.revision === revision
        ? remove(keys.guestDraft)
        : false;
    },
    readGuestPending: () =>
      readRecord<PendingGuest>(
        keys.guestPending,
        ownerId,
        'guest-pending',
        (value): value is RecordEnvelope & PendingGuest =>
          validPending(value, isGuestPayload, false),
      ),
    saveGuestPending: (pending: PendingGuest) =>
      writeRecord(keys.guestPending, ownerId, 'guest-pending', { ...pending }),
    removeGuestPending: () => remove(keys.guestPending),
    removeGuestPendingIfOperation(operationId: string) {
      const current = this.readGuestPending();
      return current.status === 'valid' &&
        current.value.operationId === operationId
        ? remove(keys.guestPending)
        : false;
    },
  };
}

function removeMatching(predicate: (key: string) => boolean): boolean {
  const storage = browserStorage();
  if (!storage) return false;
  try {
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && predicate(key)) keys.push(key);
    }
    keys.forEach((key) => storage.removeItem(key));
    return true;
  } catch {
    return false;
  }
}

export function purgeLegacySupportStorage(): boolean {
  return removeMatching(
    (key) => key.startsWith(PREFIX) && !key.startsWith(VERSIONED_PREFIX),
  );
}

export function clearOtherSupportStorage(ownerId: string): boolean {
  const currentPrefix = `${VERSIONED_PREFIX}${encodeURIComponent(ownerId)}:`;
  return removeMatching(
    (key) => key.startsWith(PREFIX) && !key.startsWith(currentPrefix),
  );
}

export function clearAllSupportStorage(): boolean {
  return removeMatching((key) => key.startsWith(PREFIX));
}
