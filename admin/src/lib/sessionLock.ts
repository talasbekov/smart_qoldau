// All tabs use these locks. Storage writes hold a lock only synchronously;
// refresh has its own lock so logout/login never wait for the network.
export async function withSessionLock<T>(
  name: string,
  work: (signal: AbortSignal) => T | Promise<T>,
): Promise<T> {
  if (!navigator.locks?.request) {
    throw new Error(
      'Для безопасной сессии нужен браузер с поддержкой Web Locks (HTTPS).',
    );
  }
  const controller = new AbortController();
  const timer = setTimeout(
    () =>
      controller.abort(
        new Error('Истекло время ожидания сессии. Повторите вход.'),
      ),
    10_000,
  );
  try {
    return await navigator.locks.request(
      `sq-admin:${name}`,
      { signal: controller.signal },
      async () => {
        controller.signal.throwIfAborted();
        // Also bound the holder, including response body reads, not just lock acquisition.
        return await Promise.race([
          Promise.resolve().then(() => {
            controller.signal.throwIfAborted();
            return work(controller.signal);
          }),
          new Promise<never>((_, reject) => {
            controller.signal.addEventListener(
              'abort',
              () => reject(controller.signal.reason),
              { once: true },
            );
          }),
        ]);
      },
    );
  } finally {
    clearTimeout(timer);
  }
}
