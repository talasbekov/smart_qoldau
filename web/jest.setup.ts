import '@testing-library/jest-dom';

Object.defineProperty(navigator, 'locks', {
  configurable: true,
  value: {
    request: async (
      _name: string,
      _options: LockOptions,
      callback: () => unknown,
    ) => callback(),
  },
});
