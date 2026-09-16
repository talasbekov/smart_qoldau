import type { TicketCategory } from './support';

const PREFIX = 'smartqoldau:support:';
const VERSIONED_PREFIX = `${PREFIX}v1:`;
const VERSION = 1 as const;
const ACTIVE_OWNER_KEY = `${VERSIONED_PREFIX}session:owner`;
const SESSION_EPOCH_KEY = `${VERSIONED_PREFIX}session:epoch`;
const LEGACY_UNKNOWN_KEY = `${VERSIONED_PREFIX}unknown:pending`;

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

export interface PendingUnknown {
  operationId: string;
  unknown: true;
}

export type PendingState<T> = T | PendingUnknown;
export type PendingAcquire = 'acquired' | 'occupied' | 'unavailable';

type Kind =
  | 'create-draft'
  | 'create-pending'
  | 'reply-draft'
  | 'reply-pending'
  | 'guest-draft'
  | 'guest-pending'
  | 'unknown-pending';

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

function isPendingUnknown(value: RecordEnvelope): boolean {
  return value.unknown === true && typeof value.operationId === 'string';
}

function readGlobalUnknown(): StorageRead<PendingUnknown> {
  return readRecord<PendingUnknown>(
    LEGACY_UNKNOWN_KEY,
    'unknown',
    'unknown-pending',
    (value): value is RecordEnvelope & PendingUnknown =>
      isPendingUnknown(value),
  );
}

function readPending<P>(
  key: string,
  ownerId: string,
  kind: Kind,
  validateFull: (value: RecordEnvelope) => boolean,
): StorageRead<PendingState<P>> {
  const globalUnknown = readGlobalUnknown();
  if (globalUnknown.status !== 'missing') return globalUnknown;
  return readRecord(
    key,
    ownerId,
    kind,
    (value): value is RecordEnvelope & PendingState<P> =>
      isPendingUnknown(value) || validateFull(value),
  );
}

async function acquire(
  lockName: string,
  read: () => StorageRead<unknown>,
  save: () => boolean,
): Promise<PendingAcquire> {
  if (typeof navigator === 'undefined' || !navigator.locks?.request)
    return 'unavailable';
  return navigator.locks.request(
    `smartqoldau-support:${lockName}`,
    { mode: 'exclusive' },
    () => {
      const current = read();
      if (current.status === 'unavailable') return 'unavailable';
      if (current.status !== 'missing') return 'occupied';
      return save() ? 'acquired' : 'unavailable';
    },
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
      readPending<PendingCreate>(
        keys.createPending,
        ownerId,
        'create-pending',
        (value) => validPending(value, isCreatePayload, true),
      ),
    saveCreatePending: (pending: PendingCreate) =>
      writeRecord(keys.createPending, ownerId, 'create-pending', {
        ...pending,
      }),
    acquireCreatePending(pending: PendingCreate) {
      return acquire(keys.createPending, this.readCreatePending, () =>
        this.saveCreatePending(pending),
      );
    },
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
      readPending<PendingReply>(
        keys.replyPending(ticketId),
        ownerId,
        'reply-pending',
        (value) => validPending(value, isReplyPayload, true),
      ),
    saveReplyPending: (ticketId: string, pending: PendingReply) =>
      writeRecord(keys.replyPending(ticketId), ownerId, 'reply-pending', {
        ...pending,
      }),
    acquireReplyPending(ticketId: string, pending: PendingReply) {
      return acquire(
        keys.replyPending(ticketId),
        () => this.readReplyPending(ticketId),
        () => this.saveReplyPending(ticketId, pending),
      );
    },
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
      readPending<PendingGuest>(
        keys.guestPending,
        ownerId,
        'guest-pending',
        (value) => validPending(value, isGuestPayload, false),
      ),
    saveGuestPending: (pending: PendingGuest) =>
      writeRecord(keys.guestPending, ownerId, 'guest-pending', { ...pending }),
    acquireGuestPending(pending: PendingGuest) {
      return acquire(keys.guestPending, this.readGuestPending, () =>
        this.saveGuestPending(pending),
      );
    },
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

function storageKeys(storage: Storage): string[] {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key) keys.push(key);
  }
  return keys;
}

function pendingIdentity(key: string): { ownerId: string; kind: Kind } | null {
  const match = key.match(
    /^smartqoldau:support:v1:([^:]+):(?:(create|guest):pending|reply:[^:]+:pending)$/,
  );
  if (!match) return null;
  try {
    return {
      ownerId: decodeURIComponent(match[1]),
      kind:
        match[2] === 'create'
          ? 'create-pending'
          : match[2] === 'guest'
            ? 'guest-pending'
            : 'reply-pending',
    };
  } catch {
    return null;
  }
}

function redactPending(storage: Storage, key: string): boolean {
  const identity = pendingIdentity(key);
  if (!identity) return false;
  let operationId = newSupportId();
  try {
    const parsed: unknown = JSON.parse(storage.getItem(key) ?? 'null');
    if (isObject(parsed) && typeof parsed.operationId === 'string') {
      operationId = parsed.operationId;
    }
  } catch {
    // A malformed pending is still an unresolved operation.
  }
  storage.setItem(
    key,
    JSON.stringify({
      version: VERSION,
      ownerId: identity.ownerId,
      kind: identity.kind,
      operationId,
      unknown: true,
    }),
  );
  return true;
}

function preserveLegacyPending(storage: Storage, key: string): void {
  storage.setItem(
    LEGACY_UNKNOWN_KEY,
    JSON.stringify({
      version: VERSION,
      ownerId: 'unknown',
      kind: 'unknown-pending',
      operationId: newSupportId(),
      unknown: true,
    }),
  );
  storage.removeItem(key);
}

function redactSupportStorage(keepOwnerId?: string): boolean {
  const storage = browserStorage();
  if (!storage) return false;
  try {
    const keepPrefix = keepOwnerId
      ? `${VERSIONED_PREFIX}${encodeURIComponent(keepOwnerId)}:`
      : null;
    for (const key of storageKeys(storage)) {
      if (!key.startsWith(PREFIX)) continue;
      if (
        key === ACTIVE_OWNER_KEY ||
        key === SESSION_EPOCH_KEY ||
        key === LEGACY_UNKNOWN_KEY
      )
        continue;
      if (!key.startsWith(VERSIONED_PREFIX)) {
        if (key.endsWith(':pending')) preserveLegacyPending(storage, key);
        else storage.removeItem(key);
        continue;
      }
      if (keepPrefix && key.startsWith(keepPrefix)) continue;
      if (!redactPending(storage, key)) storage.removeItem(key);
    }
    return true;
  } catch {
    return false;
  }
}

export function purgeLegacySupportStorage(): boolean {
  const storage = browserStorage();
  if (!storage) return false;
  try {
    for (const key of storageKeys(storage)) {
      if (!key.startsWith(PREFIX) || key.startsWith(VERSIONED_PREFIX)) continue;
      if (key.endsWith(':pending')) preserveLegacyPending(storage, key);
      else storage.removeItem(key);
    }
    return true;
  } catch {
    return false;
  }
}

export function clearOtherSupportStorage(ownerId: string): boolean {
  return redactSupportStorage(ownerId);
}

export function clearAllSupportStorage(): boolean {
  const storage = browserStorage();
  if (!storage || !redactSupportStorage()) return false;
  try {
    storage.removeItem(ACTIVE_OWNER_KEY);
    storage.setItem(SESSION_EPOCH_KEY, newSupportId());
    return true;
  } catch {
    return false;
  }
}

export type SupportSession =
  { status: 'valid'; epoch: string } | { status: 'unavailable' };

export function activateSupportOwner(ownerId: string): SupportSession {
  const storage = browserStorage();
  if (!storage) return { status: 'unavailable' };
  try {
    const currentOwner = storage.getItem(ACTIVE_OWNER_KEY);
    let epoch = storage.getItem(SESSION_EPOCH_KEY);
    if (currentOwner !== ownerId) {
      if (!redactSupportStorage(ownerId)) return { status: 'unavailable' };
      epoch = newSupportId();
      storage.setItem(ACTIVE_OWNER_KEY, ownerId);
      storage.setItem(SESSION_EPOCH_KEY, epoch);
    } else if (!epoch) {
      epoch = newSupportId();
      storage.setItem(SESSION_EPOCH_KEY, epoch);
    }
    return { status: 'valid', epoch };
  } catch {
    return { status: 'unavailable' };
  }
}

export function isSupportSessionCurrent(
  ownerId: string,
  epoch: string,
): boolean {
  const storage = browserStorage();
  if (!storage) return false;
  try {
    return (
      storage.getItem(ACTIVE_OWNER_KEY) === ownerId &&
      storage.getItem(SESSION_EPOCH_KEY) === epoch
    );
  } catch {
    return false;
  }
}

export const supportSessionEpochKey = SESSION_EPOCH_KEY;
