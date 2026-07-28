/**
 * Unit test configuration.
 *
 * Covers `src/**` only. The e2e suite has its own config (`test/jest-e2e.config.js`)
 * because it boots the whole application and needs a different environment,
 * timeout and setup — keeping them separate means a fast unit run stays fast and
 * `--watch` never drags a full Nest bootstrap along with it.
 */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: 'src/.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    // Wiring, not logic: these files declare modules, constants and view types.
    // Including them would report a coverage number that mostly measures how
    // much of the framework's own boilerplate happened to be imported.
    '!src/**/*.module.ts',
    '!src/**/*.constants.ts',
    '!src/**/*.interface.ts',
    '!src/main.ts',
    '!src/database/migrate.ts',
    '!src/database/seed.ts',
    '!src/database/schema/**',
  ],
  coverageDirectory: 'coverage',
  clearMocks: true,
};
