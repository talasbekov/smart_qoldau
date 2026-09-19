import type { Session } from './types';
import { withSessionLock } from './sessionLock';

const KEY = 'sq-admin-session';
// id changes on login/logout, revision also changes on rotation. Keeping a
// signed-out record prevents a pending login from mistaking logout for the
// same empty state it observed before another account signed in (ABA).
export interface SessionSnapshot {
  id: string;
  revision: string;
  session: Session | null;
}
const empty: SessionSnapshot = { id: '', revision: '', session: null };
const unavailable: SessionSnapshot = {
  id: 'unavailable',
  revision: 'unavailable',
  session: null,
};
let cachedRaw: string | null | undefined;
let cached = empty;
let storageFailed = false;
const retired = new Set<string>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export function isSession(value: unknown): value is Session {
  const s = value as Session | null;
  return (
    !!s &&
    typeof s.accessToken === 'string' &&
    !!s.accessToken &&
    typeof s.refreshToken === 'string' &&
    !!s.refreshToken &&
    !!s.admin &&
    typeof s.admin.id === 'string' &&
    !!s.admin.id &&
    typeof s.admin.email === 'string' &&
    Array.isArray(s.admin.roles) &&
    s.admin.roles.every((role) => typeof role === 'string')
  );
}

function read(): SessionSnapshot {
  const raw = localStorage.getItem(KEY);
  if (raw === cachedRaw) return cached;
  let next = empty;
  if (raw) {
    try {
      const value = JSON.parse(raw);
      if (
        typeof value.id === 'string' &&
        typeof value.revision === 'string' &&
        (value.session === null || isSession(value.session))
      )
        next = value;
      // Old unversioned sessions require a fresh login. Never coordinate an
      // old tab's unconditional writes as if they belonged to this protocol.
      else next = { id: '', revision: raw, session: null };
    } catch {
      next = { id: '', revision: raw, session: null };
    }
  }
  cachedRaw = raw;
  cached = next;
  return next;
}

function write(next: SessionSnapshot) {
  localStorage.setItem(KEY, JSON.stringify(next));
  cachedRaw = undefined;
  emit();
}

export const tokenStore = {
  snapshot(): SessionSnapshot {
    if (storageFailed) return unavailable;
    try {
      const next = read();
      return retired.has(next.id) ? unavailable : next;
    } catch {
      // Do not resurrect a cached session if storage recovers after logout.
      storageFailed = true;
      return unavailable;
    }
  },
  get(): Session | null {
    return this.snapshot().session;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    const onStorage = (event: StorageEvent) => {
      if (event.key === KEY || event.key === null) listener();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener('storage', onStorage);
    };
  },
  async set(session: Session, expected?: SessionSnapshot): Promise<void> {
    if (!isSession(session)) throw new Error('Некорректная сессия');
    await withSessionLock('state', () => {
      const current = read();
      if (expected && storageFailed) {
        throw new Error(
          'Доступ к хранилищу прерывался. Разрешите хранилище и перезагрузите страницу для входа.',
        );
      }
      if (
        expected &&
        (current.revision !== expected.revision || retired.has(expected.id))
      ) {
        throw new Error('Сессия изменилась. Повторите вход.');
      }
      storageFailed = false;
      const id = crypto.randomUUID();
      write({ id, revision: crypto.randomUUID(), session });
    });
  },
  async replace(
    expected: SessionSnapshot,
    session: Session,
    signal?: AbortSignal,
  ): Promise<boolean> {
    return withSessionLock('state', () => {
      signal?.throwIfAborted();
      const current = this.snapshot();
      if (
        !current.session ||
        current.id !== expected.id ||
        current.revision !== expected.revision
      )
        return false;
      if (!isSession(session) || session.admin.id !== current.session.admin.id)
        throw new Error('Некорректная сессия');
      write({ id: current.id, revision: crypto.randomUUID(), session });
      return true;
    });
  },
  async clear(
    expected: SessionSnapshot = tokenStore.snapshot(),
    exactRevision = false,
  ): Promise<void> {
    if (expected === unavailable)
      throw new Error('Не удалось прочитать сессию для выхода.');
    // Explicit logout retires the identity immediately, even if storage/locks fail.
    // Refresh errors use exactRevision and must not retire a newer rotation.
    if (!exactRevision) {
      retired.add(expected.id);
      emit();
    }
    await withSessionLock('state', () => {
      const current = read();
      if (
        current.id !== expected.id ||
        (exactRevision && current.revision !== expected.revision)
      )
        return;
      const id = crypto.randomUUID();
      write({ id, revision: crypto.randomUUID(), session: null });
    });
  },
};
