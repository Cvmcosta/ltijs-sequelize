module.exports = [
  {
    // Plain CommonJS config/scripts stay outside the type-aware TS project, since
    // eslint-config-love's ruleset below assumes a TypeScript parser.
    ignores: ['dist/*', 'node_modules/*', 'coverage/*', 'eslint.config.cjs'],
  },
  {
    ...require('eslint-config-love'),
    files: ['src/**/*.ts', 'jest.config.ts', 'jest.dbconfig.ts'],
  },
  {
    files: ['src/**/*.ts', 'jest.config.ts', 'jest.dbconfig.ts'],
    rules: {
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/no-magic-numbers': 'off',
      '@typescript-eslint/no-unnecessary-type-parameters': 'off',
      '@typescript-eslint/class-methods-use-this': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/init-declarations': 'off',
      '@typescript-eslint/non-nullable-type-assertion-style': 'off',
      curly: ['error', 'multi-line'],
    },
  },
]
