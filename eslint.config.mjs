import { fixupPluginRules } from '@eslint/compat';
import eslint from '@eslint/js';
import parser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';
import jsdoc from 'eslint-plugin-jsdoc';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import noOnlyTests from 'eslint-plugin-no-only-tests';
import playwright from 'eslint-plugin-playwright';
import react from 'eslint-plugin-react';
import hooksPlugin from 'eslint-plugin-react-hooks';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import testingLibrary from 'eslint-plugin-testing-library';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Restricted imports to enforce project-specific patterns */
const RESTRICTED_IMPORT_PATHS = [
  {
    name: 'react-hook-form',
    importNames: ['useForm'],
    message: "Please use useWalhallForm from '@src/utilities/form' instead.",
  },
  {
    name: 'react-router',
    importNames: ['withRouter'],
    message: 'Use router hooks instead',
  },
  {
    name: 'react-redux',
    importNames: ['connect'],
    message: "Use redux hooks, or 'useTypedSelector' if you need to select from state",
  },
  {
    name: 'react-redux',
    importNames: ['useSelector'],
    message: "Use 'useTypedSelector' instead",
  },
  {
    name: '@playwright/test',
    importNames: ['expect'],
    message:
      "If you're writing a unit test, 'expect' is accessible without an import. For playwright tests, use 'test.expect' from './utils/testFixtures'.",
  },
  {
    name: '@optimizely/react-sdk',
    importNames: ['useDecision'],
    message: "Import from '@src/hooks/useDecision' instead.",
  },
];

/** Restricted global variables (browser window properties that should be accessed explicitly) */
const RESTRICTED_BROWSER_GLOBALS = [
  'addEventListener',
  'blur',
  'close',
  'closed',
  'confirm',
  'defaultStatus',
  'defaultstatus',
  'event',
  'external',
  'find',
  'focus',
  'frameElement',
  'frames',
  'history',
  'innerHeight',
  'innerWidth',
  'length',
  'location',
  'locationbar',
  'menubar',
  'moveBy',
  'moveTo',
  'name',
  'onblur',
  'onerror',
  'onfocus',
  'onload',
  'onresize',
  'onunload',
  'open',
  'opener',
  'opera',
  'outerHeight',
  'outerWidth',
  'pageXOffset',
  'pageYOffset',
  'parent',
  'print',
  'removeEventListener',
  'resizeBy',
  'resizeTo',
  'screen',
  'screenLeft',
  'screenTop',
  'screenX',
  'screenY',
  'scroll',
  'scrollbars',
  'scrollBy',
  'scrollTo',
  'scrollX',
  'scrollY',
  'self',
  'status',
  'statusbar',
  'stop',
  'toolbar',
  'top',
];

/** Restricted properties to enforce modern module syntax */
const RESTRICTED_PROPERTIES = [
  {
    object: 'require',
    property: 'ensure',
    message:
      'Please use import() instead. More info: https://facebook.github.io/create-react-app/docs/code-splitting',
  },
  {
    object: 'System',
    property: 'import',
    message:
      'Please use import() instead. More info: https://facebook.github.io/create-react-app/docs/code-splitting',
  },
];

/** Import sort group configuration */
const IMPORT_SORT_GROUPS = [
  // Node.js builtins prefixed with `node:`.
  ['^node:'],
  // Packages.
  // Things that start with a letter (or digit or underscore), or `@` followed by a letter.
  ['^@?\\w'],
  // Absolute imports and other imports such as Vue-style `@/foo`.
  // Anything not matched in another group.
  ['^'],
  // Side effect imports.
  ['^\\u0000'],
  ['^@src/'],
  // Relative imports.
  // Anything that starts with a dot.
  ['^\\.'],
];

/** Denied identifier names (primitive wrapper types) */
const DENIED_IDENTIFIERS = [
  'any',
  'Number',
  'number',
  'String',
  'string',
  'Boolean',
  'boolean',
  'Undefined',
  'undefined',
];

const MAIN_CONFIGURATIONS = {
  files: ['**/*.{js,jsx,mjs,cjs,ts,tsx,mts}'],
  plugins: {
    react,
    'jsx-a11y': jsxA11y,
    'react-hooks': fixupPluginRules(hooksPlugin),
    unicorn: eslintPluginUnicorn,
    'simple-import-sort': simpleImportSort,
    'unused-imports': fixupPluginRules(unusedImports),
    'no-only-tests': noOnlyTests,
    import: importPlugin,
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    // ==========================================
    // TypeScript Rules
    // ==========================================
    '@typescript-eslint/adjacent-overload-signatures': 'error',
    '@typescript-eslint/array-type': [
      'error',
      {
        default: 'array',
      },
    ],
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/consistent-type-assertions': 'error',
    '@typescript-eslint/dot-notation': 'error',
    '@typescript-eslint/indent': 'off',
    '@typescript-eslint/member-delimiter-style': [
      'off',
      {
        multiline: {
          delimiter: 'none',
          requireLast: true,
        },
        singleline: {
          delimiter: 'semi',
          requireLast: false,
        },
      },
    ],
    '@typescript-eslint/naming-convention': 'off',
    '@typescript-eslint/no-duplicate-enum-values': 'off',
    '@typescript-eslint/no-empty-function': 'error',
    '@typescript-eslint/no-empty-interface': 'error',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-misused-new': 'error',
    '@typescript-eslint/no-namespace': 'error',
    '@typescript-eslint/no-parameter-properties': 'off',
    '@typescript-eslint/no-shadow': [
      'error',
      {
        hoist: 'all',
      },
    ],
    '@typescript-eslint/no-this-alias': 'error',
    '@typescript-eslint/no-unnecessary-type-assertion': 'off',
    '@typescript-eslint/no-unnecessary-type-constraint': 'off',
    '@typescript-eslint/no-unused-expressions': 'warn',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    '@typescript-eslint/no-use-before-define': 'off',
    '@typescript-eslint/no-var-requires': 'error',
    '@typescript-eslint/prefer-for-of': 'error',
    '@typescript-eslint/prefer-function-type': 'error',
    '@typescript-eslint/prefer-namespace-keyword': 'error',
    '@typescript-eslint/quotes': 'off',
    '@typescript-eslint/semi': ['off', null],
    '@typescript-eslint/triple-slash-reference': [
      'error',
      {
        path: 'always',
        types: 'prefer-import',
        lib: 'always',
      },
    ],
    '@typescript-eslint/type-annotation-spacing': 'off',
    '@typescript-eslint/unified-signatures': 'error',

    // ==========================================
    // JSDoc Rules
    // ==========================================
    'jsdoc/check-alignment': 'error',
    'jsdoc/check-indentation': 'error',
    'jsdoc/check-param-names': 'off',
    'jsdoc/check-tag-names': 'off',
    'jsdoc/check-types': 'off',
    'jsdoc/multiline-blocks': 'off',
    'jsdoc/no-multi-asterisks': 'off',
    'jsdoc/no-undefined-types': 'off',
    'jsdoc/require-param': 'off',
    'jsdoc/require-param-description': 'off',
    'jsdoc/require-param-type': 'off',
    'jsdoc/require-returns': 'off',
    'jsdoc/require-returns-check': 'off',
    'jsdoc/require-returns-description': 'off',
    'jsdoc/require-returns-type': 'off',
    'jsdoc/tag-lines': ['error', 'any', { startLines: 1 }],

    // ==========================================
    // React Rules
    // ==========================================
    'react/forbid-foreign-prop-types': [
      'warn',
      {
        allowInPropTypes: true,
      },
    ],
    'react/jsx-boolean-value': 'error',
    'react/jsx-curly-brace-presence': ['warn', { props: 'always', children: 'ignore' }],
    'react/jsx-curly-spacing': 'off',
    'react/jsx-equals-spacing': 'off',
    'react/jsx-fragments': ['error', 'syntax'],
    'react/jsx-key': 'error',
    'react/jsx-no-bind': 'off',
    'react/jsx-no-comment-textnodes': 'warn',
    'react/jsx-no-duplicate-props': 'warn',
    'react/jsx-no-target-blank': 'warn',
    'react/jsx-no-undef': 'error',
    'react/jsx-no-useless-fragment': ['error', { allowExpressions: true }],
    'react/jsx-pascal-case': [
      'warn',
      {
        allowAllCaps: true,
        ignore: [],
      },
    ],
    'react/jsx-tag-spacing': [
      'off',
      {
        afterOpening: 'allow',
        closingSlash: 'allow',
      },
    ],
    'react/jsx-uses-react': 'warn',
    'react/jsx-uses-vars': 'warn',
    'react/jsx-wrap-multilines': 'off',
    'react/no-array-index-key': 'warn',
    'react/no-danger-with-children': 'warn',
    'react/no-direct-mutation-state': 'warn',
    'react/no-is-mounted': 'warn',
    'react/no-string-refs': 'error',
    'react/no-typos': 'error',
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off',
    'react/require-render-return': 'error',
    'react/self-closing-comp': 'error',
    'react/style-prop-object': 'warn',

    // ==========================================
    // React Hooks Rules
    // ==========================================
    'react-hooks/exhaustive-deps': 'warn',
    'react-hooks/rules-of-hooks': 'error',

    // ==========================================
    // Accessibility (jsx-a11y) Rules
    // ==========================================
    'jsx-a11y/alt-text': 'warn',
    'jsx-a11y/anchor-has-content': 'warn',
    'jsx-a11y/anchor-is-valid': [
      'warn',
      {
        aspects: ['noHref', 'invalidHref'],
      },
    ],
    'jsx-a11y/aria-activedescendant-has-tabindex': 'warn',
    'jsx-a11y/aria-props': 'warn',
    'jsx-a11y/aria-proptypes': 'warn',
    'jsx-a11y/aria-role': [
      'warn',
      {
        ignoreNonDOM: true,
      },
    ],
    'jsx-a11y/aria-unsupported-elements': 'warn',
    'jsx-a11y/heading-has-content': 'warn',
    'jsx-a11y/iframe-has-title': 'warn',
    'jsx-a11y/img-redundant-alt': 'warn',
    'jsx-a11y/no-access-key': 'warn',
    'jsx-a11y/no-distracting-elements': 'warn',
    'jsx-a11y/no-redundant-roles': 'warn',
    'jsx-a11y/role-has-required-aria-props': 'warn',
    'jsx-a11y/role-supports-aria-props': 'warn',
    'jsx-a11y/scope': 'warn',

    // ==========================================
    // Import/Export Rules
    // ==========================================
    'no-duplicate-imports': 'error',
    'no-restricted-imports': ['error', { paths: RESTRICTED_IMPORT_PATHS }],
    'simple-import-sort/exports': 'warn',
    'simple-import-sort/imports': ['warn', { groups: IMPORT_SORT_GROUPS }],
    'unused-imports/no-unused-imports': 'warn',
    'import/no-default-export': 'error',

    // ==========================================
    // Code Quality & Best Practices
    // ==========================================
    'array-callback-return': 'warn',
    complexity: 'off',
    'default-case': [
      'warn',
      {
        commentPattern: '^no default$',
      },
    ],
    'dot-location': ['warn', 'property'],
    'dot-notation': 'error',
    eqeqeq: ['error', 'smart'],
    'guard-for-in': 'error',
    'max-classes-per-file': 'off',
    'no-array-constructor': 'warn',
    'no-bitwise': 'error',
    'no-caller': 'error',
    'no-case-declarations': 'off',
    'no-console': 'warn',
    'no-constant-binary-expression': 'off',
    'no-empty-function': 'error',
    'no-eval': 'error',
    'no-extend-native': 'warn',
    'no-extra-bind': 'error',
    'no-extra-boolean-cast': 'off',
    'no-extra-label': 'warn',
    'no-implied-eval': 'warn',
    'no-invalid-this': 'off',
    'no-iterator': 'warn',
    'no-label-var': 'warn',
    'no-labels': [
      'warn',
      {
        allowLoop: true,
        allowSwitch: false,
      },
    ],
    'no-lone-blocks': 'warn',
    'no-loop-func': 'warn',
    'no-mixed-operators': [
      'warn',
      {
        groups: [
          ['&', '|', '^', '~', '<<', '>>', '>>>'],
          ['==', '!=', '===', '!==', '>', '>=', '<', '<='],
          ['&&', '||'],
          ['in', 'instanceof'],
        ],
        allowSamePrecedence: false,
      },
    ],
    'no-multi-str': 'warn',
    'no-native-reassign': 'warn',
    'no-negated-in-lhs': 'warn',
    'no-new-func': 'error',
    'no-new-object': 'warn',
    'no-new-symbol': 'warn',
    'no-new-wrappers': 'error',
    'no-octal-escape': 'warn',
    'no-only-tests/no-only-tests': 'error',
    'no-prototype-builtins': 'off',
    'no-restricted-globals': ['error', ...RESTRICTED_BROWSER_GLOBALS],
    'no-restricted-properties': ['error', ...RESTRICTED_PROPERTIES],
    'no-restricted-syntax': [
      'warn',
      'WithStatement',
      // todo: later consider:
      // eslint-plugin-no-literal-values
      // eslint-plugin-no-hardcoded-colors
      {
        selector: 'Property[key.name=/color|background/i][value.type="Literal"]',
        message:
          'Avoid hardcoded colors. Use Ant Design tokens (e.g., token.colorBgLayout) instead.',
      },
    ],
    'no-return-await': 'error',
    'no-script-url': 'warn',
    'no-self-compare': 'warn',
    'no-sequences': 'error',
    'no-template-curly-in-string': 'error',
    'no-throw-literal': 'error',
    'no-undef-init': 'error',
    'no-underscore-dangle': 'off',
    'no-unsafe-optional-chaining': 'off',
    'no-unused-expressions': 'error',
    'no-use-before-define': 'off',
    'no-useless-computed-key': 'warn',
    'no-useless-concat': 'warn',
    'no-useless-constructor': 'warn',
    'no-useless-escape': 'off',
    'no-useless-rename': [
      'warn',
      {
        ignoreDestructuring: false,
        ignoreImport: false,
        ignoreExport: false,
      },
    ],
    'no-var': 'error',
    'object-shorthand': 'error',
    'one-var': ['error', 'never'],
    'prefer-arrow-callback': 'error',
    'prefer-const': 'error',
    'prefer-object-spread': 'error',
    radix: 'error',
    strict: ['warn', 'never'],
    'valid-typeof': 'off',

    // ==========================================
    // Naming & Identifier Rules
    // ==========================================
    'id-denylist': ['error', ...DENIED_IDENTIFIERS],
    'id-match': 'error',

    // ==========================================
    // Formatting Rules (mostly disabled - handled by Prettier)
    // ==========================================
    'arrow-parens': ['off', 'always'],
    'brace-style': ['off', 'off'],
    'comma-dangle': 'off',
    'eol-last': 'off',
    indent: 'off',
    'linebreak-style': 'off',
    'max-len': 'off',
    'new-parens': 'off',
    'newline-per-chained-call': 'off',
    'no-extra-semi': 'off',
    'no-irregular-whitespace': 'error',
    'no-multiple-empty-lines': 'off',
    'no-trailing-spaces': 'off',
    'no-whitespace-before-property': 'warn',
    'padded-blocks': [
      'off',
      {
        blocks: 'never',
      },
      {
        allowSingleLineBlocks: true,
      },
    ],
    'quote-props': 'off',
    quotes: 'off',
    'rest-spread-spacing': ['warn', 'never'],
    semi: 'off',
    'space-before-function-paren': 'off',
    'space-in-parens': ['off', 'never'],
    'spaced-comment': [
      'error',
      'always',
      {
        markers: ['/'],
      },
    ],
    'unicode-bom': ['warn', 'never'],

    // ==========================================
    // Other Plugin Rules
    // ==========================================
    'unicorn/prefer-ternary': 'error',
  },
};

const UNIT_TEST_RULES = {
  files: ['**/*.test.{ts,tsx}'],
  ignores: ['apps/main/src/playwright/**/*.ts'],
  plugins: {
    'testing-library': fixupPluginRules(testingLibrary),
  },
  rules: {
    ...testingLibrary.configs.react.rules,
    'testing-library/prefer-user-event': 'error',
    'testing-library/no-unnecessary-act': 'off',
    'testing-library/no-node-access': 'off',
    'testing-library/no-await-sync-events': 'off', // This rule only applies to userEvent version < 14. Since we are on v14, userEvent is async.
    'testing-library/no-render-in-lifecycle': 'off',
  },
};

const E2E_TEST_RULES = {
  files: ['apps/main/src/playwright/**/*.ts'],
  ...playwright.configs['flat/recommended'],
  rules: {
    'playwright/no-raw-locators': 'error',
    'playwright/no-skipped-test': 'off',
    'playwright/no-conditional-in-test': 'off',
    'playwright/no-eval': 'off',
    'playwright/no-element-handle': 'off',
    'playwright/no-force-option': 'off',
    'playwright/no-focused-test': 'warn',
    '@typescript-eslint/no-floating-promises': ['error'],
    'playwright/expect-expect': 'off',
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: 'vitest',
            message: "Make sure you're using functions from Playwright",
          },
        ],
      },
    ],
  },
};

const GENERATED_FILE_RULES = {
  files: [
    'apps/main/src/hooks/react-query/v2/dataplane/**/*.ts',
    'apps/main/src/models/v2/dataplane/**/*.ts',
    'apps/main/src/hooks/react-query/v2/controlplane/**/*.ts',
    'apps/main/src/models/v2/controlplane/**/*.ts',
    'apps/main/src/hooks/react-query/v2/iam/**/*.ts',
    'apps/main/src/models/v2/iam/**/*.ts',
  ],
  rules: {
    'id-denylist': 'off',
    '@typescript-eslint/unified-signatures': 'off',
    'no-duplicate-imports': 'off',
  },
};

// For slow introduction of new lint rules
const NEW_RULES = {
  files: ['apps/main/src/utilities/navigation.ts'],
  rules: {
    '@typescript-eslint/naming-convention': [
      'error',
      {
        selector: 'variable',
        format: ['strictCamelCase', 'UPPER_CASE'],
      },
    ],
  },
};

const CONFIG_FILES_ALLOW_DEFAULT_EXPORT = {
  files: [
    '**/*.config.ts',
    '**/*.config.mts',
    '**/*.config.js',
    '**/*.config.mjs',
    '**/plopfile.mjs',
    '**/vite.config.*',
    '**/vitest.config.*',
    '**/playwright.config.*',
    '**/orval.config.*',
  ],
  rules: {
    'import/no-default-export': 'off',
  },
};

// Allow hardcoded colors in theme definition files
const THEME_FILE_RULES = {
  files: ['**/styles/themes.ts'],
  rules: {
    'no-restricted-syntax': ['warn', 'WithStatement'],

    // Config files that require default exports (Vite, Playwright, etc.)
  },
};

export default [
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  jsdoc.configs['flat/recommended'],
  {
    // Global ignores - applies to all configurations
    ignores: [
      'packages/ui-components/.storybook/',
      'packages/ui-components/dist/',
      'apps/main/vitest-report/',
      'apps/main/dist/',
      'eslint-plugin-no-only-tests.d.ts',
      'commitlint.config.mjs',
      'orval.config.js',
      'apps/main/test-reports/',
      'reports/',
    ],
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parser,
      parserOptions: {
        ecmaVersion: 'latest',
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: import.meta.dirname,
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  MAIN_CONFIGURATIONS,
  UNIT_TEST_RULES,
  E2E_TEST_RULES,
  GENERATED_FILE_RULES,
  THEME_FILE_RULES,
  CONFIG_FILES_ALLOW_DEFAULT_EXPORT,
  NEW_RULES,
];
