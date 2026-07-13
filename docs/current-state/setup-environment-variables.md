# Environment variables

This app manages environment variables for both dev and production modes similarly and allows you to also run the app with Docker locally in both self-hosted and saas modes (see how-to in README.md).

Locally, we use Vite (that uses dotenv to read env vars from `.env` file).

Once env vars are read, they are exposed in the app as `windowEnv` (via `src/config/environment.ts`), so the client can access them.

**Files:**

Locally:

- `.env` (development): read and used by Vite in development mode

Running with Docker:

- `docker/init-env-vars` (when running with docker): list of env vars read from the docker container environment

Processing env vars at runtime (all modes):

- `src/config/environment.ts` (all environments and run modes): puts env vars on `windowEnv` (remember, no secrets, as these are exposed to the client!)
