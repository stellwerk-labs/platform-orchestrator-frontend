## Problems with current Orval

- reported: https://github.com/orval-labs/orval/issues/2081
- `...overrideResponse,` -> need to manually add to `apps/main/src/hooks/react-query/v2/dataplane/deployment/deployment.msw.ts` line 256

### Why this happens

The `createDeployment` endpoint returns different types for `200` (DeploymentDryRun) vs `201` (Deployment). Orval generates a generic mock using `faker.helpers.arrayElement([...])` to randomly pick one type, but forgets to add `...overrideResponse` to the second element. This causes a TypeScript error.

### Fix after regeneration

In `getCreateDeploymentResponseMock`, find the second element in `faker.helpers.arrayElement([...])` (the `Deployment` type with `manifest`, `runner_id`, etc.) and add `...overrideResponse,` before the closing `},`.

## Orval 8.x Breaking Changes Summary

### 1. Node.js Version

- **Required:** Node.js ≥ 22.18

### 2. ESM Only (CommonJS Dropped)

- Add `"type": "module"` to `package.json`
- Config files: use `.mjs` extension or ESM syntax
- Replace `require()` → `import`

### 3. OpenAPI Version

- **Only OpenAPI 3.1.0+** supported (3.0 dropped)
- Replace `nullable: true` → `type: ["string", "null"]`

### 4. HTTP Client Default

- Changed from **axios → fetch**
- To keep axios: set `httpClient: 'axios'` in config

### 5. Removed Config Options

| Removed                   | Replacement                  |
| ------------------------- | ---------------------------- |
| `override.fetch.explode`  | Set in OpenAPI spec          |
| `override.coerceTypes`    | `override.zod.coerce`        |
| `override.useNativeEnums` | `enumGenerationType: 'enum'` |

### 6. Other Changes

- **Mock delay:** default `1000` → `false`
- **Combined types:** `anyOf`/`oneOf`/`allOf` inlined by default (restore with `aliasCombinedTypes: true`)
- **Zod schemas:** now PascalCase (`createPetsBody` → `CreatePetsBody`)
- **TanStack Query v3:** dropped

---

**Sources:**

- [Orval GitHub Releases](https://github.com/orval-labs/orval/releases)
- [Orval v8 Migration Guide](https://orval.dev/versions/v8)
