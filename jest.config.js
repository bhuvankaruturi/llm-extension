module.exports = {
  testEnvironment: 'jsdom', // Use jsdom for tests that need a DOM
  // Automatically clear mock calls and instances between every test
  clearMocks: true,
  // The directory where Jest should output its coverage files
  coverageDirectory: 'coverage',
  // An array of glob patterns indicating a set of files for which coverage information should be collected
  collectCoverageFrom: [
    '**/*.js',
    '!**/node_modules/**',
    '!**/vendor/**',
    '!**/tests/**', // Exclude test files from coverage
    '!jest.config.js', // Exclude jest config from coverage
    '!.eslintrc.js', // Exclude eslint config from coverage (if any)
  ],
  // Setup files to run before each test file
  setupFilesAfterEnv: ['./tests/setupTests.js'], // if we need global mocks or setup
};
