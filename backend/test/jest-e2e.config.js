/**
 * End-to-end configuration.
 *
 * Separate from the unit config because these tests boot a Nest application and
 * drive it over HTTP: they need a longer timeout, and they must run serially so
 * that suites sharing a rate-limit keyspace cannot exhaust one another's
 * budgets.
 */
module.exports = {
  rootDir: '..',
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: 'test/.*\\.e2e-spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  testTimeout: 30_000,
  maxWorkers: 1,
  clearMocks: true,
};
