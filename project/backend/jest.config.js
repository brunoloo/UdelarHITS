export default {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/load-env.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  globalSetup: '<rootDir>/tests/global-setup.js',
  testMatch: ['**/tests/**/*.test.js'],
  transform: {},
};