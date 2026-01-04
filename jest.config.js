/** @type {import('jest').Config} */
export default {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/web'],
  testMatch: ['**/*.test.js'],
  moduleFileExtensions: ['js'],
  collectCoverageFrom: [
    'web/**/*.js',
    '!web/**/*.test.js',
    '!web/service-worker.js'
  ],
  transform: {},
  // Setup files to run before tests
  setupFilesAfterEnv: ['<rootDir>/web/test-setup.js']
};
