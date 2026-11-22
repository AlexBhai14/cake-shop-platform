module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/**/*.e2e.spec.ts'],
  setupFiles: ['dotenv/config'],
  testTimeout: 60000,
  maxWorkers: 1,
};
