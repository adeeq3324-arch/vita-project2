# Vital AI

Premium AI Fitness & Health mobile app. React Native + Expo + TypeScript.

## Getting started

```bash
npm install
cp .env.example .env   # then fill in the values
npm run dev
```

Then press `i` for iOS, `a` for Android.

`npm run dev` starts the **whole stack**: it builds and boots the NestJS backend,
waits until its `/health` probe passes, and only then starts Expo. Use it rather
than `npm start` — the app reads all of its data over HTTP, so when the backend
is not listening every screen fails at the transport layer (`Failed to fetch` on
web, `Network request failed` on native). Starting Expo alone is the single most
common cause of those errors.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Backend + Expo together (recommended) |
| `npm run dev:web` | Same, with Expo in web mode |
| `npm run dev:fast` | Same, skipping the backend rebuild |
| `npm run backend` | Backend only |
| `npm start` | Expo dev server only (needs the backend already running) |
| `npm run ios` / `npm run android` | Start and open on a simulator |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint via `expo lint` |

## Structure

```
src/
  components/   Reusable UI (ui/ primitives, charts/, layout/)
  config/       env.ts — typed runtime configuration
  hooks/        Shared hooks
  navigation/   React Navigation: RootNavigator + route types
  screens/      One folder per feature area
  services/     API client and backend integrations
  theme/        Design system — single source of truth
  types/        Shared domain types
```

Path alias `@/*` maps to `src/*`.

## Design system

`src/theme/` is the **only** place visual constants are defined. Never hardcode a
colour, font size, spacing value, radius or shadow in a screen — import from
`@/theme` instead:

```ts
import { theme } from '@/theme';

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.base,
    padding: theme.layout.cardPadding,
    ...theme.shadows.sm,
  },
});
```

| File | Contains |
| --- | --- |
| `colors.ts` | Palette, semantic colours, per-metric accents, gradients |
| `typography.ts` | Font families, sizes, weights, named text styles |
| `spacing.ts` | 4pt spacing scale, layout constants, radii |
| `shadows.ts` | Cross-platform elevation tokens |
| `navigationTheme.ts` | Adapts the above to React Navigation |

The app is **light theme only** — white surfaces, violet (`#6D28D9`) primary,
with orange / cyan / green / red accents colour-coding each health domain. This
is locked in `app.json` via `userInterfaceStyle: "light"`.

## Navigation

Classic React Navigation (native-stack + bottom-tabs), not Expo Router. Routes
are declared in `src/navigation/types.ts` and registered globally, so
`useNavigation()` is typed without a generic at the call site.

`RootNavigator` currently renders a single placeholder screen. As features land
it switches between the `Auth`, `Onboarding` and `Main` navigators.

## Conventions

- Production code only — no placeholder implementations.
- Secrets never reach the client. Only `EXPO_PUBLIC_*` vars are bundled; treat
  every value in `.env` as public.
- Feature-specific components live beside their screen; only genuinely shared
  ones go in `src/components/`.

## Troubleshooting

**"Cannot reach the VITAL AI server"** — the request never got a response. In
order of likelihood:

1. **The backend is not running.** Check it: `curl http://localhost:3000/health`
   should return `{"status":"ok",…}`. Fix: use `npm run dev`, which will not
   start Expo until the API is healthy.
2. **Redis or Postgres is down.** `/health` returns `status: "error"` with the
   failing component named. Redis must be listening on `localhost:6379`.
3. **Wrong host for the platform.** `EXPO_PUBLIC_API_URL=http://localhost:3000`
   is correct for web and the iOS simulator. On a physical device `localhost`
   means the phone itself — `src/config/env.ts` rewrites it to the Metro host
   automatically, so this only bites if Metro's host cannot be resolved.

The API client retries transient failures (transport errors, timeouts, 5xx)
with exponential backoff on idempotent requests, so a brief blip recovers on its
own. `POST`/`PATCH` are not retried by default — a replay could duplicate a
write the server already accepted — but individual calls can opt in with
`{ retry: true }`.
