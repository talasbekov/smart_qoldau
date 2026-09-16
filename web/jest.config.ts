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
    transformIgnorePatterns: [
      '/node_modules/(?!(next-intl|use-intl|intl-messageformat|@formatjs)/)',
    ],
    // e2e/ принадлежит Playwright: его .spec-файлы Jest выполнить не может
    // (там свой раннер и свои фикстуры), и подхватывал он их только потому,
    // что имена совпадают по маске.
    testPathIgnorePatterns: [
      '<rootDir>/node_modules/',
      '<rootDir>/e2e/',
      '<rootDir>/.next/',
    ],
    // После production build standalone содержит копию package.json.
    // Haste не должен считать её вторым модулем `web` и шуметь collision.
    modulePathIgnorePatterns: ['<rootDir>/.next/'],
    moduleNameMapper: {
      ...resolved.moduleNameMapper,
      '^@/(.*)$': '<rootDir>/$1',
    },
  };
};
