# MSAL Browser v4 to v5 Migration Guide

## Critical: COOP (Cross-Origin Opener Policy) Support

Microsoft Entra ID now returns `Cross-Origin-Opener-Policy` headers by default, which breaks popup-based authentication. The popup stays open or fails instead of closing automatically.

### Steps

1. **Create a redirect bridge page** at `public/redirect.html`:

```html
<!DOCTYPE html>
<html>
  <body>
    <script type="module">
      import { broadcastResponseToMainFrame } from '@azure/msal-browser/redirect-bridge';
      broadcastResponseToMainFrame();
    </script>
  </body>
</html>
```

This page must NOT have COOP headers. It broadcasts the auth response back to the main frame via `BroadcastChannel`.

2. **Update MSAL config** (`apps/main/src/auth/msalConfig.ts`):

```typescript
export const msalConfig: Configuration = {
  auth: {
    clientId: windowEnv.MICROSOFT_CLIENT_ID,
    redirectUri: '/redirect.html', // changed from '/'
  },
  // ...
};
```

3. **Register `/redirect.html`** as a redirect URI in the Azure AD app registration.

## API Breaking Changes

### Removed Methods on `PublicClientApplication`

| Removed                                                          | Replacement                           |
| ---------------------------------------------------------------- | ------------------------------------- |
| `getAccountByHomeId()`                                           | `getAccount({ homeAccountId })`       |
| `getAccountByLocalId()`                                          | `getAccount({ localAccountId })`      |
| `getAccountByUsername()`                                         | `getAccount({ username })`            |
| `logout()`                                                       | `logoutRedirect()` or `logoutPopup()` |
| `enableAccountStorageEvents()` / `disableAccountStorageEvents()` | No longer needed                      |
| `startPerformanceMeasurement()`                                  | `startMeasurement()`                  |

### `handleRedirectPromise` Signature Change

Now accepts a `HandleRedirectPromiseOptions` object instead of a hash string parameter. `navigateToLoginRequestUrl` moved from config into this options object.

### `TokenCache` Removed

`getTokenCache()` removed. `loadExternalTokens()` is now a standalone export requiring a `Configuration` parameter.

### `SignedHttpRequest.removeKeys`

Return type changed from `Promise<boolean>` to `Promise<void>`. Use try-catch instead of conditional checks.

## Configuration Changes

### `BrowserAuthOptions`

| Removed / Changed            | Notes                                                           |
| ---------------------------- | --------------------------------------------------------------- |
| `skipAuthorityMetadataCache` | Removed                                                         |
| `protocolMode`               | Moved to `SystemOptions`                                        |
| `supportsNestedAppAuth`      | Removed; use `createNestablePublicClientApplication()`          |
| `navigateToLoginRequestUrl`  | Removed from config; pass via `handleRedirectPromise()` options |
| `encodeExtraQueryParams`     | Removed; all query params now encoded automatically             |

### `CacheOptions` (removed deprecations)

- `temporaryCacheLocation`
- `claimsBasedCachingEnabled`
- `storeAuthStateInCookie`
- `secureCookies`
- `cacheMigrationEnabled`

### `SystemOptions`

| Change              | Details                                                               |
| ------------------- | --------------------------------------------------------------------- |
| `navigateFrameWait` | Removed                                                               |
| `iframeHashTimeout` | Renamed to `iframeBridgeTimeout`                                      |
| `windowHashTimeout` | Renamed to `popupBridgeTimeout`                                       |
| `asyncPopups`       | Renamed to `navigatePopups` with **reversed logic** (default: `true`) |

## Request Parameter Changes

- `onRedirectNavigate` removed from `RedirectRequest` and `EndSessionRequest`; only supported in main `Configuration`.
- `authorizePostBodyParams`, `tokenBodyParameters`, `tokenQueryParameters` removed. Use `extraParameters` instead.

## Event Type Changes

| Old                                   | New                                             |
| ------------------------------------- | ----------------------------------------------- |
| `SSO_SILENT`, `ACQUIRE_TOKEN_BY_CODE` | `ACQUIRE_TOKEN` variants                        |
| `ACCOUNT_ADDED` / `ACCOUNT_REMOVED`   | `LOGIN_SUCCESS` / `LOGOUT_SUCCESS`              |
| `LOGIN_START` / `LOGIN_FAILURE`       | `ACQUIRE_TOKEN_START` / `ACQUIRE_TOKEN_FAILURE` |

`LOGIN_SUCCESS` payload is now an `AccountInfo` object. Successful logins emit both `LOGIN_SUCCESS` and `ACQUIRE_TOKEN_SUCCESS`.

## Other Behavioral Changes

- **Error messages** now return documentation links instead of descriptive text. Use `errorCode` for identification.
- **Console log messages** replaced with hash values to reduce bundle size. Use the provided decode script for debugging.

## Impact on Our Codebase

Files that need changes:

- `apps/main/src/auth/msalConfig.ts` — update `redirectUri`
- `apps/main/src/containers/Auth/components/MicrosoftButton.tsx` — verify `loginPopup` and `clearCache` still work as expected
- `apps/main/src/components/shared/MainHeader/MainHeader.tsx` — verify `clearCache` in logout flow
- `apps/main/src/index.tsx` — no changes expected (standard `PublicClientApplication` usage)
- New file: `apps/main/public/redirect.html` — redirect bridge page
- Azure AD app registration — add `/redirect.html` as redirect URI

## Sources

- [Issue #8325: Changed popup behavior with v5?](https://github.com/AzureAD/microsoft-authentication-library-for-js/issues/8325)
- [MSAL Browser v4 Migration Guide](https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/msal-v5/lib/msal-browser/docs/v4-migration.md)
- [MSAL Browser Releases](https://github.com/AzureAD/microsoft-authentication-library-for-js/releases)
