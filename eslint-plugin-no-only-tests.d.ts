declare module 'eslint-plugin-no-only-tests' {
  import type { ESLint, Linter } from 'eslint';

  const plugin: ESLint.Plugin & {
    rules: Record<string, Linter.RuleEntry>;
  };

  export default plugin;
}
