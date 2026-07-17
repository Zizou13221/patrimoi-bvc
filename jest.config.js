/** @type {import('jest').Config} */
module.exports = {
  preset: 'react-native',
  transform: {
    '^.+\\.(ts|tsx)$': ['babel-jest', { presets: ['module:@react-native/babel-preset'] }],
  },
  testMatch: ['**/__tests__/**/*.test.(ts|tsx|js|jsx)'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    // Stub native modules non testables
    'react-native-mmkv':                 '<rootDir>/__mocks__/mmkv.js',
    'react-native-keychain':             '<rootDir>/__mocks__/keychain.js',
    'react-native-prevent-screenshot':   '<rootDir>/__mocks__/prevent-screenshot.js',
    '@react-native-async-storage/async-storage': '<rootDir>/__mocks__/async-storage.js',
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '__tests__/App.test.tsx',   // boilerplate RN template — pas nos tests
  ],
  collectCoverageFrom: [
    'src/utils/calc.ts',
    'src/utils/migrations.ts',
    'src/store/slices/*.ts',
    'src/schemas/index.ts',
  ],
  coverageThreshold: {
    global: { lines: 80 },
  },
};
