import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

const baseConfig = createJestConfig({
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
});

// next/jest только ДОБАВЛЯЕТ к своему дефолтному "/node_modules/" (игнорировать
// всё), а не заменяет — раз next-intl/use-intl/intl-messageformat/@formatjs/*
// публикуются как чистый ESM, их пришлось транспилировать вручную здесь
// (next.config.ts transpilePackages на юнит-тесты Jest не влияет, только на
// сборку Next.js).
export default async () => {
  const resolved = await baseConfig();
  return {
    ...resolved,
    transformIgnorePatterns: ['/node_modules/(?!(next-intl|use-intl|intl-messageformat|@formatjs)/)'],
    moduleNameMapper: {
      ...resolved.moduleNameMapper,
      '^@/(.*)$': '<rootDir>/$1',
    },
  };
};
