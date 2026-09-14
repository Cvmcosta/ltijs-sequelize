/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  clearMocks: true,
  collectCoverage: true,
  coverageProvider: 'v8',
  coverageDirectory: 'coverage',
  roots: ['<rootDir>'],
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  verbose: true,
}
