# Stellwerk Platform Orchestrator Frontend

## Deployment Pipelines availability (RC)

Deployment Pipelines are an RC feature in [v1.8.0-rc.2](docs/releases/v1.8.0-rc.2.md),
part of the coordinated Pipeline release candidate. The current stable release
from `main` does not include Pipelines. Use the matching RC services and clients
when following Pipeline documentation.

Upgrading alone does not activate Native execution or change existing deployment
behavior. On an explicitly enabled Pipeline installation, the built-in **Apply**
default runs Apply directly, with no additional Plan, approval, pre-deployment or
post-deployment steps. Planning remains an explicit action or part of a selected
recipe. Publishing a recipe alone does not change any default; an authorized
operator must select it or update deployment-use policy.

## Setup

### Prerequisites 📖

- Have `pnpm` installed
- Enable corepack (`corepack enable`) to respect the `packageManager` reference in the package.json
- `corepack install` to setup the correct version of `pnpm`

### Install & run 🚀

```bash
# Install project dependencies
pnpm i

# Create and fill your .env file
cp env.example .env

# Start the app
pnpm run start
```

Open [app](http://localhost:4200/orgs).

### Build & run with docker 🐳

```bash
docker build --no-cache -f apps/main/Dockerfile -t orchestrator-frontend .

# Note: 4200 is whitelisted for CORS
docker run -p 4200:9000 --env-file apps/main/.env.docker orchestrator-frontend

# To try the app in self-hosted mode
docker run -p 4200:9000 --env-file apps/main/.env.docker.selfhosted orchestrator-frontend
```

Example `.env.docker` files for running in Docker:

```bash
ENVIRONMENT_NAME=local

BASE_URL=https://dev-api.my-domain.com

# Deployment mode - self-hosted or saas
DEPLOYMENT_MODE=saas

GOOGLE_CLIENT_ID=
MICROSOFT_CLIENT_ID=
CONFIG_CAT_SDK_KEY=
```

### Generate code from API spec 🤖

Refresh dependent API yaml as needed (eg. `iam.yaml`), then run:

```bash
pnpm run orval
```

### Testing 🧪

**Unit tests:**

Run unit tests using Vitest - runs all test.ts and test.tsx files:

```bash
pnpm run test

# for headless execution
pnpm run test:ci

# for coverage metrics
pnpm run coverage
```

**e2e tests:**

Run e2e tests:

```bash
pnpm run e2e

# run with a specific browser
pnpm run e2e -- --browser=firefox
```

Run a single e2e test:

```bash
cd apps/main

npx playwright test playwright/tests/ServiceUsers.test.ts --browser=firefox
```

**Quality:**

```bash
pnpm run lint
pnpm run check-typescript

# Dead code detection
ENVIRONMENT=dev npx knip
```

### Debugging 🐛

**Trigger Getting Started Banner (Debug):**

To re-show the Getting Started banner after dismissing it (useful for testing), run this in the browser console:

```js
window.debugTriggerGettingStartedBanner();
```

**Trigger Onboarding Survey (Debug):**

To re-show the onboarding survey after dismissing it (useful for testing), run this in the browser console:

```js
window.debugTriggerOnboardingSurvey();
```

Note: The survey appears only when the user has registered directly, not via SSO or invitation.

Note: These debug functions reset the local cache only. The server still has the prompts marked as dismissed, so the state will revert on page refresh.

### Collaboration 🤝

For minimal & uncontroversial changes, add the label `auto-approve`.
Avoid using it for behavioral changes or large refactors.
