// In-process LockManager for jsdom; browser smoke exercises native Web Locks.
export function installLocks() {
  const tails = new Map<string, Promise<unknown>>();
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: {
      request: async (
        name: string,
        options: LockOptions,
        callback: () => unknown,
      ) => {
        const prior = tails.get(name) ?? Promise.resolve();
        const next = prior
          .catch(() => {})
          .then(() => {
            options.signal?.throwIfAborted();
            return callback();
          });
        tails.set(name, next);
        // Native requests reject immediately when aborted in the queue.
        return Promise.race([
          next,
          new Promise((_, reject) => {
            options.signal?.addEventListener(
              'abort',
              () => reject(options.signal?.reason),
              { once: true },
            );
          }),
        ]);
      },
    },
  });
}
