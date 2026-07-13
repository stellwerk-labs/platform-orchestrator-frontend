# Named Exports > Default Exports

**Named exports are generally better.** Here's why:

### Problems with `export default`

1. **Refactoring risk** - Import name can differ from actual component name, making renames hard to track
2. **No autocomplete** - IDEs can't suggest the name since it's arbitrary
3. **Inconsistent naming** - Same component imported as different names across files

```ts
// These all work, which is the problem:
import Welcome from './Welcome';
import WelcomePage from './Welcome';
import Foo from './Welcome';
```

### Why people still use them

- React community convention (especially with file-per-component)
- Slightly cleaner import syntax
- Some bundlers historically optimized them better (less true now)

### Recommendation

**Use named exports:**

```ts
// Welcome.tsx
export const Welcome = () => { ... };

// Importing
import { Welcome } from './Welcome';
```

This project already mixes both styles.
Named exports are the safer choice for maintainability.
