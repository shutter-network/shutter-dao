module.exports = {
  env: {
    browser: false,
    es2021: true,
    mocha: true,
    node: true,
  },
  plugins: ['@typescript-eslint', 'node'],
  extends: [
    "standard",
    "plugin:prettier/recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 12,
  },
  rules: {
    'node/no-unsupported-features/es-syntax': ['error', { ignores: ['modules'] }],
    camelcase: ['error', { ignoreImports: true }],
    'prettier/prettier': [
      1,
      {
        endOfLine: 'auto',
      },
    ],
  },
};
