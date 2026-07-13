# About the Project

The orchestrator-frontend is the user interface for the Platform Orchestrator.
It is a single-page application that allows users to manage their applications, environments, and resources.

# Common Mistakes

- Make sure that you use the correct node version (see .nvmrc) before running any npm/pnpm commands

# Tech Stack

- TypeScript
- React
- antd for the component library and styling
- Vite
- pnpm for package management
- Turbo for monorepo management
- Vitest for unit testing
- Playwright for end-to-end testing
- ESLint for linting
- Prettier for code formatting
- React Query for data fetching
- Zustand for state management

# Development Workflow

- To run the development server: `pnpm run start`
- To build the project: `pnpm run build`
- To run the linter: `pnpm run lint`
- To format the code: `pnpm exec prettier --write .`
- To run unit tests: `pnpm run test:ci -- --reporter=tap`
- To run end-to-end tests: `pnpm run e2e`

# Planning your changes

Before jumping into making changes, please plan the changes you wish to make and get approval from the user. Check documentation and function signatures to ensure that the right
arguments are being passed to functions and that the functions exist and behave as expected.

# API & Data Fetching

API functions and models are generated from OpenAPI specifications located in `apps/main/schemas/`.
The generated hooks and models can be found in the `apps/main/src/hooks` and `apps/main/src/models` directories respectively.
We use React Query for data fetching and caching.

# Testing

After making changes, you must run the linter, TypeScript check, and unit tests! You must write additional unit tests as needed.

## TypeScript Check

Always run the TypeScript check after making changes to catch type errors:

```bash
pnpm run check-typescript
```

## Unit Tests

Unit tests are written with Vitest. To run the unit tests, use the following command:

```bash
pnpm run test:ci -- --reporter=tap
```

If turbo has cached the results, you can force it to run with `pnpm run test:ci --force -- --reporter=tap`

## End-to-End Tests

End-to-end tests are written with Playwright. To run the end-to-end tests, use the following command:

```bash
pnpm run e2e
```

To run with a specific browser, use:

```bash
pnpm run e2e -- --browser=firefox
```

To run a single e2e test, `cd` into `apps/main` and run:

```bash
npx playwright test playwright/tests/ServiceUsers.test.ts --browser=firefox
```

# Coding Style & Conventions

This project uses ESLint and Prettier to enforce a consistent coding style.
Before committing any changes, make sure to run the linter and formatter.
Don't use `--no-verify` for git commits.

- **Follow Existing Conventions**: When adding new code, prioritize following the patterns and conventions used in similar, adjacent files over inventing new ones.
- **Concise Code**: We value reducing the total lines of code. The team is small and does not have dedicated frontend experts, so maintainability and simplicity are key.
- **Linting**: `pnpm run lint`
- **Formatting**: `pnpm exec prettier --write .`

The configuration for ESLint can be found in `eslint.config.mjs` and for Prettier in `.prettierrc`.
