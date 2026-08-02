# VITAL AI — Backend

Backend API for **VITAL AI**, a premium AI Fitness & Health platform.

**Stack:** NestJS · Supabase (Postgres/Auth/Storage) · Drizzle ORM · Redis · BullMQ · Docker

> **Phase 5 — Production Hardening.** The feature set is complete: the Phase 0
> foundation (configuration, logging, database/Redis/queue wiring, error
> handling, health check), Phase 1 auth & onboarding, Phase 2 nutrition core,
> Phase 3 AI layer, and Phase 4 progress & engagement. This phase adds no
> features and changes no response shape. It adds **two-layer rate limiting**
> backed by Redis, a completed **caching pass** with the invalidation the
> analytics views were missing, an audited and **enforced RLS** surface with a
> CI gate, **error tracking and Prometheus metrics**, and the **unit and
> end-to-end test suites**.

## Architecture

```
src/
├── main.ts                       # Bootstrap: security, versioning, validation, shutdown hooks
├── app.module.ts                 # Root module wiring the foundation together
├── config/                       # Env loading + fail-fast Joi validation (typed ConfigService)
├── common/
│   ├── logging/                  # Global structured logging (pino)
│   ├── filters/                  # Global RFC 7807 exception filter
│   ├── http/                     # Shared HTTP contracts (problem-details)
│   ├── cache/                    # Redis JSON cache + the shared key registry
│   ├── util/                     # Time-zone-aware calendar-day helpers
│   └── validation/               # Reusable class-validator constraints
├── database/                     # Drizzle + postgres.js client, schema barrel, migration & seed runners
│   └── schema/                   # Per-feature table definitions
├── redis/                        # Shared ioredis client (cache + health)
├── queue/                        # BullMQ root connection, queue + job-name registry
├── health/                       # GET /health — active dependency probes
│
│                                 # ── Phase 1: auth & onboarding ──
├── auth/  users/  profiles/  goals/  health-conditions/  onboarding/
│
│                                 # ── Phase 2: nutrition core ──
├── foods/                        # Catalogue, full-text search, starter dataset + seeder
├── meal-logs/                    # Food diary CRUD and intake aggregates
├── nutrition-targets/            # BMR/TDEE modelling and daily targets
├── daily-metrics/                # Steps, water, weight, workout, health score
├── home/                         # Dashboard aggregator — GET /home/feed
│
│                                 # ── Phase 3: AI layer ──
├── ai/                           # Abstract AiService contract + runtime provider selection
│   ├── ai.interface.ts           #   the contract — zero vendor references
│   ├── ai.module.ts              #   binds one implementation from AI_PROVIDER_ID
│   ├── structured.ts             #   JSON extraction + Zod validation of model output
│   └── providers/                #   THE ONLY place a vendor may be named
├── ai-context/                   # Assembles what the model is told about a user
├── ai-jobs/                      # The generation lifecycle ledger (queued→processing→ready)
├── storage/                      # Supabase Storage for scan images (private + signed URLs)
├── meal-plans/                   # Weekly AI meal plans (queued)
├── supplement-plans/             # Monthly AI supplement plans (queued + monthly cron)
├── coach/                        # Streaming AI health coach (SSE) + voice transcription
├── scanner/                      # Food photo, colour-quality photo, and barcode scanners
│
│                                 # ── Phase 4: progress & engagement ──
├── workout-logs/                 # Training diary, MET-based energy estimates, fitness aggregates
├── analytics/                    # Shared read layer: one gap-filled daily series per window
├── achievements/                 # Badge/streak/milestone catalogue + unlock logic
├── progress/                     # GET /progress (the whole tab) + snapshot roll-ups & cron
├── reminders/                    # Recurring nudges, time-zone-correct scheduling, delivery sweep
└── notifications/                # Device registry + push transport (the only vendor-aware part)
```

Each domain feature gets its own module under `src/` in later phases, following
this same clean, modular structure.

### The AI layer is provider-agnostic

Nothing outside `src/ai/providers/` knows or can discover which model service the
platform uses. Feature code injects the `AI_SERVICE` token and depends only on
four capabilities — `generateText`, `generateStructured`, `analyzeImage` and
`chat` (streaming).

The concrete adapter is chosen **at runtime from `AI_PROVIDER_ID` alone**: never
inferred from the URL or model name, and never defaulted to a particular vendor.
Adapters are registered under the request/response **format** they speak rather
than under a company name, because that is what actually determines
compatibility — one format is accepted by many services, managed and self-hosted
alike:

| `AI_PROVIDER_ID`   | Endpoint shape                                |
| ------------------ | --------------------------------------------- |
| `chat-completions` | `POST {AI_BASE_URL}/chat/completions`         |
| `messages`         | `POST {AI_BASE_URL}/messages`                 |
| `generate-content` | `POST {AI_BASE_URL}/models/{model}:generateContent` |

No vendor SDK is a dependency — every adapter is plain `fetch` — so switching
model services is an edit to `.env` and nothing else. Boot with an unrecognised
id and the API refuses to start, printing the ids it supports.

Structured output is enforced three times over, weakest to strongest: described
in the prompt, requested natively where the format supports it, and — the only
one that decides the outcome — validated with Zod. A first failure is fed back to
the model once as a repair instruction; a second is an error. A caller is never
handed a value that did not pass validation.

## Getting started (local, Docker)

```bash
cp .env.example .env          # adjust values if needed
docker compose up --build     # postgres + redis + migrate + api
```

The API is then available at `http://localhost:3000`, health at
`http://localhost:3000/health`.

## Getting started (local, without Docker)

Requires Node.js ≥ 20 and reachable Postgres + Redis instances.

```bash
npm install
cp .env.example .env          # point DATABASE_URL / REDIS_* at your instances
npm run db:migrate            # apply migrations (no-op until the first is generated)
npm run start:dev
```

## Endpoints

| Method | Path      | Description                                            |
| ------ | --------- | ------------------------------------------------------ |
| GET    | `/health` | Liveness/readiness — 200 when DB + Redis are reachable, 503 otherwise. |

Feature routes are served under the versioned prefix `/api/v1/*`. Every route
below requires `Authorization: Bearer <supabase access token>` except the auth
entry points, which are marked `@Public()`.

### Auth & onboarding (Phase 1)

| Method | Path                        | Description                              |
| ------ | --------------------------- | ---------------------------------------- |
| POST   | `/auth/signup`              | Create an account (public).              |
| POST   | `/auth/login`               | Exchange credentials for a session (public). |
| POST   | `/auth/refresh`             | Refresh an access token (public).        |
| POST   | `/auth/logout`              | Revoke the current session.              |
| POST   | `/auth/password/reset`      | Send a password-reset email (public).    |
| POST   | `/onboarding/submit`        | Persist profile, goal and conditions in one transaction. |
| GET    | `/onboarding/me`            | Read back the current onboarding state.  |
| GET    | `/profiles/me`              | Current user's profile.                  |
| PATCH  | `/profiles/me`              | Update profile fields (incl. `timezone`). |
| GET    | `/goals/me`                 | Current user's goal.                     |
| PATCH  | `/goals/me`                 | Update the goal.                         |
| GET    | `/health-conditions/me`     | Declared health conditions.              |
| PUT    | `/health-conditions/me`     | Replace the declared set.                |

### Nutrition core (Phase 2)

| Method | Path                              | Description                                        |
| ------ | --------------------------------- | -------------------------------------------------- |
| GET    | `/foods/search`                   | Search the catalogue (`q`, `category`, `limit`, `offset`). Backs the "Add Meal" search bar. |
| GET    | `/foods/:id`                      | A single catalogue entry.                          |
| POST   | `/meal-logs`                      | Log a meal — from the catalogue (`foodId`) or custom. |
| GET    | `/meal-logs`                      | A diary day with entries and totals (`date`, defaults to today). |
| GET    | `/meal-logs/recent`               | "Recent Meals" — newest entries for quick re-adding. |
| GET    | `/meal-logs/history`              | "Meal History" — per-day roll-ups (`from`/`to` or `days`). |
| GET    | `/meal-logs/:id`                  | A single diary entry.                              |
| PATCH  | `/meal-logs/:id`                  | Edit an entry; changing `servings` re-scales macros. |
| DELETE | `/meal-logs/:id`                  | Remove an entry (204).                             |
| GET    | `/nutrition/targets`              | Daily kcal/macro/water targets, derived from profile + goal. |
| PUT    | `/nutrition/targets`              | Override one or more targets (switches to `custom`). |
| POST   | `/nutrition/targets/recalculate`  | Discard the override and re-derive.                |
| GET    | `/daily-metrics`                  | One day's steps, water, weight, workout and health score. |
| GET    | `/daily-metrics/range`            | A window of days for trend charts.                 |
| PATCH  | `/daily-metrics`                  | Upsert the day's metrics.                          |
| POST   | `/daily-metrics/water`            | Add to the day's fluid intake (atomic increment).  |
| GET    | `/home/feed`                      | **The whole Home tab in one call** — metrics, activities, health score + trend, progress. |

#### How the targets are derived

Mifflin-St Jeor BMR → activity-scaled TDEE → goal-adjusted calories (−20% for
weight loss, +15% for muscle gain, floored at a safe minimum) → macros allocated
protein-first (per kg of body weight), then fat (a share of calories), with
carbohydrate absorbing the remaining energy. Fibre follows 14 g/1000 kcal and
water 35 ml/kg plus a training allowance. See `src/nutrition-targets/nutrition.calculator.ts`.

Targets are cached in Redis and additionally carry a fingerprint of the profile
and goal they came from, so a profile edit always re-derives them — even if a
cache invalidation were missed.

#### Time zones

Diary days and daily metrics are keyed to the user's **local** calendar day,
resolved from `profiles.timezone` (IANA, defaults to `UTC`). The client should
send `timezone` at onboarding or via `PATCH /profiles/me` so midnight lands
where the user expects it.

### AI layer (Phase 3)

| Method | Path                                | Description                                          |
| ------ | ----------------------------------- | ---------------------------------------------------- |
| POST   | `/meal-plans/generate`              | Start this week's plan. Returns `202` immediately with an id to poll. |
| GET    | `/meal-plans/current`               | This week's plan. Creates nothing; 404 when there is none. |
| GET    | `/meal-plans/:id/status`            | Poll target — `{ mealPlanId, status, error }`.       |
| GET    | `/meal-plans/:id`                   | The plan, grouped into seven days with per-day totals (kcal, protein, carbs, fat, fibre). |
| GET    | `/meal-plans/:id/items/:itemId`     | One meal, with its nutrition and the reason it was chosen. |
| POST   | `/meal-plans/:id/items/:itemId/swap`| Replace one meal with a different dish of equivalent nutrition. Generated inline; returns the replacement. |
| POST   | `/meal-plans/:id/items/:itemId/recipe`| The recipe for one meal — shopping list, method, timings, tips. Generated inline on first request and stored; every later call returns the same one. `POST` so a client retry cannot repeat the generation. |
| POST   | `/supplement-plans/generate`        | Ensure this month has a plan. Idempotent — never generates twice in a month. |
| GET    | `/supplement-plans/current`         | This month's plan. Creates nothing; 404 when there is none. |
| GET    | `/supplement-plans/:id/status`      | Poll target — same contract as meal plans.           |
| GET    | `/supplement-plans/:id`             | A plan, as a flat list, a daily schedule and core/optional counts. |
| GET    | `/supplement-plans/:id/items/:itemId` | One supplement: timing, purpose, benefits and cautions. |
| GET    | `/coach/personalities`              | The three coaching voices, for the picker.           |
| POST   | `/coach/conversations`              | Open a thread (`personality`, optional `title`).     |
| GET    | `/coach/conversations`              | The caller's threads, most recently active first.    |
| GET    | `/coach/conversations/:id/messages` | Full history, oldest first.                          |
| POST   | `/coach/conversations/:id/messages` | Send a turn; the reply **streams** as `text/event-stream`. |
| POST   | `/coach/voice`                      | `multipart/form-data` with an `audio` part — transcribe a spoken question. Returns the words, does not send them. |
| POST   | `/scanner/food`                     | `multipart/form-data` with an `image` part — identify a food and score it. |
| POST   | `/scanner/quality`                  | Same upload — judge freshness and quality.           |
| POST   | `/scanner/barcode`                  | `{ barcode }` — resolve the product and give a personalised verdict. |
| GET    | `/scanner/jobs/:id`                 | Poll target for a scan that was deferred to the queue. |
| GET    | `/scanner/scans/:id`                | A stored scan, with a freshly signed image URL.      |

#### The generation lifecycle

Plans are never generated on the request thread. `generate` does the cheap part
— resolve the period, validate that the user can be planned for, reserve the row
— and hands the rest to a worker, so the client gets an id to poll in
milliseconds. Two records track the work and are kept in step by `AiJobsService`:

- `ai_jobs` — the ledger: `queued → processing → ready | failed`, with the id of
  whatever the job produced.
- the artefact's own `status` column — `idle → generating → ready | failed`,
  which is what the client polls.

Queues: `meal-plan-queue`, `supplement-plan-queue`, `scan-queue`.

Supplement plans are additionally swept on the **1st of each month at 03:00 UTC**
by a BullMQ job scheduler. The sweep only triggers — it fans out into ordinary
generation jobs on the same queue, so a scheduled plan takes exactly the same
path as a user-requested one. Each user's month boundary is resolved in their own
time zone, and dormant accounts are skipped.

#### Scans answer inline, and defer only when they must

A scan is something the user is standing there waiting for, so all three
scanners try to answer on the request thread under a 20-second budget. If the
model runs long or is rate-limited, the attempt is cancelled and the work moves
to `scan-queue`; the response then carries `{ status: 'processing', jobId }`
instead of a result. Both paths run the identical analysis, so a deferred scan is
never a lesser one. Clients must branch on `status`.

Scan images live in a **private** bucket under a per-user prefix.
`scan_results.image_url` stores the object *path*, not a URL — every read,
including the one handed to the model, goes through a short-lived signed URL.

Barcode scans split cleanly in two: `products` is a **shared** cache keyed on the
barcode (the same product for everyone, looked up once), while the verdict on
whether *this* user should eat it is generated fresh each time and stored on
their own `scan_results` row. An unrecognised barcode is reported rather than
cached — storing a fabricated product would serve that invention to everyone who
scans it afterwards.

#### Supplement safety

The generator describes the substance and never prescribes an amount. What a
serving contains is stated as a facts panel (`serving_size`, `ingredients`) — the
figures a person can check against a label — while how much *they* should take is
routed to a clinician by `recommendation`, which the schema forbids from carrying
a dose of its own. The standing "speak to a doctor or pharmacist and agree the
right amount" line is appended **in code** on the way into the database, not
requested in the prompt: a disclaimer that depends on the model remembering it is
not a disclaimer.

### Progress & engagement (Phase 4)

| Method | Path                              | Description                                          |
| ------ | --------------------------------- | ---------------------------------------------------- |
| POST   | `/workout-logs`                   | Log a session. Only `type` + `durationMinutes` are required. |
| GET    | `/workout-logs`                   | A training day with its sessions and totals (`date`, defaults to today). |
| GET    | `/workout-logs/types`             | The workout types with their label, icon and accent — for the picker. |
| GET    | `/workout-logs/recent`            | Newest sessions across all days (`limit`, `type`).   |
| GET    | `/workout-logs/history`           | Per-day roll-ups (`from`/`to` or `days`).            |
| GET    | `/workout-logs/summary`           | Sessions, minutes, streak and per-type breakdown (default: trailing month). |
| GET    | `/workout-logs/:id`               | A single session.                                    |
| PATCH  | `/workout-logs/:id`               | Edit a session; changing type/intensity/duration re-estimates the energy. |
| DELETE | `/workout-logs/:id`               | Remove a session (204).                              |
| GET    | `/progress`                       | **The whole Progress tab in one call** (`period=week\|month`). |
| GET    | `/progress/snapshots`             | Stored period roll-ups, newest first (`period`, `limit`). |
| POST   | `/progress/snapshots`             | Roll up a period and record body measurements. Idempotent. |
| GET    | `/achievements`                   | Badge rail + milestone bars, re-evaluated behind a short cache. |
| POST   | `/achievements/evaluate`          | Force a fresh evaluation; returns `newlyUnlocked`.   |
| POST   | `/reminders`                      | Create a reminder (`name`, `time` as 24-hour `HH:MM`). |
| GET    | `/reminders`                      | The caller's reminders (`filter=all\|today\|upcoming`). |
| GET    | `/reminders/:id`                  | A single reminder.                                   |
| PATCH  | `/reminders/:id`                  | Partial update — **including the on/off switch** (`{ "enabled": false }`). |
| DELETE | `/reminders/:id`                  | Remove a reminder (204).                             |
| POST   | `/notifications/devices`          | Register this device's push token. Idempotent.       |
| GET    | `/notifications/devices`          | The caller's registered devices (tokens are never returned). |
| DELETE | `/notifications/devices/:id`      | Unregister a device (204).                           |

#### One window, read by everything

`AnalyticsService` builds a single **gap-filled daily series** — intake, hydration,
movement, weight, training and the health score on one row per calendar day — and
the Progress tab, the snapshot roll-ups and the achievement evaluator all read
that instead of the diaries. Three things follow: gap filling and "what counts as
logged" are defined once, so a streak and a chart can never disagree about the
same Tuesday; every source is fetched concurrently, so a 90-day window costs
roughly one round trip; and nothing recomputes a number another module owns.

#### Live charts, stored history

The two halves of the Progress feature answer different questions and are built
differently on purpose:

- **`GET /progress` is computed live** from a rolling window, because it must
  reflect the meal logged a minute ago. It fetches *twice* the period so the
  preceding week/month is available for "vs last month" without a second round of
  queries. It is cached in Redis for 5 minutes — the most expensive read in the
  app — and the whole per-user analytics prefix is dropped the moment a workout,
  or a measurement, changes what feeds it.
- **`progress_snapshots` is calendar history**, keyed on the Monday or the 1st.
  It is the only home for user-reported body measurements (body fat, muscle mass,
  tape measurements), which nothing else can know, and it makes long-range
  comparison two row reads instead of two months of re-aggregation.

A week is 7 days; a month is **28**, so the frequency chart's `W1…W4` buckets are
genuine seven-day weeks. Roll-ups run on a BullMQ scheduler — **Mondays 04:30 UTC**
and the **1st at 05:00 UTC** — for the period that has just finished, each user's
boundary resolved in their own time zone. Rolling up a period still in progress
clamps the aggregation at today, so a Monday snapshot averages over the days that
have actually happened.

#### Achievements: catalogue in code, standing in data

The catalogue lives in `src/achievements/achievement.catalog.ts`, not in a table.
A definition is inseparable from the metric that unlocks it, and splitting the two
across a migration boundary invites a catalogue row no evaluator can satisfy.
What *is* data is each user's standing — progress, target and the instant they
crossed the line. Three properties hold:

- **Unlocks are permanent.** `unlocked_at` is written once and never moved; a
  streak that later breaks does not un-earn the badge it produced.
- **Evaluation is idempotent**, which is what makes it safe to run on a `GET`.
- **Notification is exactly once** — only achievements that crossed their line
  during *this* evaluation are announced, and more than two collapse into one
  summary push rather than eight separate ones.

Milestones may carry a *personal* target (the distance to this user's goal weight).
One that the user has not set is omitted entirely rather than shown as failed.

#### Reminders fire on the user's clock, once

A reminder stores two representations of "when", and the distinction matters:

- `time_of_day` + `days_of_week` is the **intent** — a bare local wall-clock time,
  so 08:00 stays 08:00 across a daylight-saving change instead of drifting an hour.
- `next_run_at` is the **resolved UTC instant**, which is what lets the delivery
  sweep be one indexed query instead of a scan that re-derives every user's clock.
  It is recomputed on every write, and self-heals on read if the profile's time
  zone changed underneath it.

`reminder-queue` is swept **every minute**. The sweep claims due rows
`FOR UPDATE SKIP LOCKED` and advances their schedules **in the same transaction**,
so several API instances take disjoint sets and a reminder is claimed exactly once
per firing. Claims are then fanned out as individual delivery jobs, so one
unreachable device cannot delay anybody else's nudge — and deliveries are
deliberately **never retried**, because the schedule has already advanced and a
duplicate push is worse than a missed one. Firings missed during an outage are
discarded rather than replayed.

Push delivery goes through `NotificationsModule`, which is the only part of the
codebase that knows a push service exists. `PUSH_ENABLED=false` (the default)
leaves reminders scheduling and firing exactly as they do in production, with no
device notification and no credentials required. Tokens the service reports as
gone are retired automatically; a token is unique table-wide, so a handset signed
into a second account *moves* rather than leaving two accounts believing they own
it.

#### Workouts and the day's score

Logging a session re-syncs `daily_metrics.workout_completed` / `workout_minutes`
for that day from the diary, so the home dashboard and the health score move
immediately and can never disagree with the training log. Editing a session that
*moves* days re-syncs both. Energy burned is estimated with the standard MET
equation scaled by intensity (`src/workout-logs/workout.presentation.ts`) and
stored, not derived on read — a later weight change must not rewrite training
history. A figure sent by a wearable always wins.

## Production hardening (Phase 5)

### Rate limiting

Two layers, and the split between them is the point.

| Layer | Where it runs | Keyed by | Scope | Default |
| ----- | ------------- | -------- | ----- | ------- |
| `global` | **Before** authentication | IP address | The whole API, one bucket | 600 / min |
| `default` | **After** authentication | User id, else IP | Per route | 120 / min |
| `ai` | After authentication | User id, else IP | Shared across every model-backed route | 60 / hour |

The edge guard exists for the case the per-user limiter structurally cannot
cover: it runs *after* the auth guard, so a request bearing an invalid token is
rejected as a 401 before any limit is consulted — meaning a flood of junk tokens
would otherwise reach Supabase's auth API unmetered. The edge guard meters that
traffic while it is still anonymous. Its limit is deliberately generous because
mobile clients share carrier NAT addresses; fairness is the inner guard's job.

The `ai` budget is deliberately **not** route-scoped: a model call costs money
wherever it is made, so scans, coach turns and plan generation draw on one
allowance. Route-scoping it would let a caller spend the same budget three times
over by alternating endpoints.

Counting happens in Redis via an atomic Lua script, so a limit means the same
thing however many instances are running. If Redis is unreachable the limiter
**fails open** and logs — a cache outage must not become an API outage.

> **`TRUST_PROXY` is load-bearing and wrong in both directions.** Behind a load
> balancer, leaving it unset collapses every user into the balancer's address as
> one bucket. On a directly exposed service, setting it lets any caller spoof
> `X-Forwarded-For` and evade the shield entirely. It must match the topology.

Refusals are RFC 7807 documents like every other error, with `Retry-After` set.

### Caching

| Cached read | TTL | Invalidated by |
| ----------- | --- | -------------- |
| Nutrition targets | 15 min | Profile, goal and onboarding writes |
| Food catalogue entry / search page | 24 h / 10 min | Seeder only — shared reference data |
| Barcode product lookup | 24 h | Re-resolution only |
| Progress overview / snapshots / achievements | 5–10 min | Any write that can move a chart |

A product lookup is now cached in Redis ahead of the database, because a miss
there is not a query but a **model call** — a popular barcode would otherwise be
billed for on every scan.

The analytics prefix (`vital:v1:analytics:<userId>:`) is dropped wholesale rather
than by named key, so a cached view added later is invalidated correctly without
every producer learning about it. Phase 5 added the invalidation that meal-log
and daily-metric writes were missing: without it a user who logged a meal watched
their own Progress tab disagree with their own diary until the TTL lapsed.

### Row Level Security

Every table has RLS enabled with an owner-scoped policy (see the section below).
Phase 5 audited that surface and closed two gaps:

- Revoked `EXECUTE` on Supabase's `public.rls_auto_enable()` from `anon` and
  `authenticated`. It is a `SECURITY DEFINER` function that PostgREST exposes at
  `/rest/v1/rpc/`, and Postgres grants `EXECUTE` to `PUBLIC` by default. The
  event trigger still fires — a trigger runs as its owner regardless.
- Added restrictive per-command policies to `foods` and `products` making the
  client write ban structural rather than incidental, so a future permissive
  `FOR ALL` policy still cannot grant an INSERT, UPDATE or DELETE.

`npm run db:verify-rls` audits a live database and exits non-zero if any table
lacks RLS, lacks a policy, carries `user_id` without an `auth.uid()` policy, or
exposes rows through a permissive `USING (true)`. **CI runs it on every push and
again during release, before any new container serves traffic.**

### Observability

`GET /metrics` exposes Prometheus metrics — HTTP counts and latency by route
*template*, cache hit/miss/error, rate-limit rejections by budget, background job
outcomes, plus process and event-loop metrics. It is version-neutral and outside
the `/api` prefix, and requires `METRICS_TOKEN` as a bearer token when set.

> Metrics disclose route names, traffic volumes and error rates. Any
> internet-reachable deployment **must** set `METRICS_TOKEN`.

Error tracking speaks the Sentry envelope API over plain `fetch`, so any
Sentry-compatible ingest works and no vendor SDK is pulled in. Only 5xx faults
are reported — a 404 or a rejected payload is the API working correctly.
Reporting is fire-and-forget and never throws: failing to *report* an error must
not turn a handled 500 into a crash. Reports carry the correlation id, route and
user **id** — never an email or any profile field.

### Tests

| Command | Covers |
| ------- | ------ |
| `npm test` | Unit suites: nutrition modelling, health score, time-zone/DST handling, reminder scheduling, cache keys, throttler storage, error tracking, upload validation |
| `npm run test:e2e` | The cross-cutting stack over real HTTP: both rate-limit layers, validation, the problem-details envelope, metrics |
| `npm run test:all` | Both |

The e2e suite runs the production guards, pipes and filter against an in-memory
Redis double. The rate limiter's Lua script is additionally executed against a
**real Redis** by `test/redis-throttle.e2e-spec.ts` — including a concurrency
test proving atomicity — which is skipped locally when none is reachable and
always runs in CI.

## Database & migrations (Drizzle)

- Define tables in `src/database/schema/` and re-export them from `schema/index.ts`.
- `npm run db:generate` — generate SQL migrations from the schema.
- `npm run db:migrate` — apply pending migrations (dev, via `tsx`).
- `npm run db:migrate:prod` — apply migrations from compiled output (containers/CI).
- `npm run db:seed` — load reference data (the starter food catalogue). Idempotent:
  entries are upserted on `slug`, so re-running corrects values without
  duplicating rows or breaking the diary entries that point at them.
- `npm run db:seed:prod` — the same, from compiled output.
- `npm run db:seed:plan -- <email>` — **development only.** Writes one ready week
  of meals, recipes for the first day's four dishes, and one ready month of
  supplements for the named account, straight into the tables the generator
  writes to. It exists so the planning screens can be reviewed before an AI
  provider is configured; it refuses to run when `NODE_ENV=production`, and a
  real generation replaces what it wrote. The rest of the week is left without
  recipes on purpose — that is the state a real plan is in until a dish is
  opened, and it is what exercises the generate-on-first-open path.
- `npm run db:studio` — open Drizzle Studio.

Row Level Security is enabled on every table. User-owned tables carry a
`auth.uid() = user_id` policy; child tables without their own `user_id`
(`meal_plan_items`, `supplement_plan_items`, `coach_messages`) inherit ownership
through an `EXISTS` check against their parent — `meal_recipes` does the same
across two hops, from the recipe to its meal to the plan that holds the owner. `foods` and `products` are shared
caches readable by any authenticated user and writable only by the owner role the
API connects as. `achievements` is deliberately **read-only** to the
`authenticated` role — badges are awarded by the backend from what the user
actually did, and a client able to grant itself one would make every badge
meaningless.

## Configuration

Every secret and connection value is read from the environment and validated at
boot — nothing is hardcoded. See `.env.example` for the full list. The process
refuses to start if a required variable is missing or malformed.

The AI layer is configured by exactly four values, and switching model services
requires changing nothing else:

| Variable          | Purpose                                                    |
| ----------------- | ---------------------------------------------------------- |
| `AI_PROVIDER_ID`  | Selects the adapter. See the table above. No default.      |
| `AI_BASE_URL`     | Root URL of the inference endpoint, no trailing slash.     |
| `AI_MODEL_NAME`   | Model identifier, exactly as that service names it.        |
| `AI_API_KEY`      | Credential for the endpoint. Server-only.                  |

`SUPABASE_SCANS_BUCKET` (default `scans`) must exist in the Supabase project.
Keep it **private** — the API signs short-lived read URLs and never needs it
public.

Push notifications are off unless switched on, and need nothing else locally:

| Variable             | Purpose                                                      |
| -------------------- | ------------------------------------------------------------ |
| `PUSH_ENABLED`       | Master switch (default `false`). Off, reminders still fire — there is simply nowhere to send them. |
| `EXPO_PUSH_URL`      | Push endpoint. Only change it to point at a proxy or a test double. |
| `EXPO_ACCESS_TOKEN`  | Needed only when the Expo project enforces push security. Server-only. |
| `PUSH_TIMEOUT_MS`    | Per-request ceiling for a push batch.                        |

## Scripts

| Script               | Description                          |
| -------------------- | ------------------------------------ |
| `npm run start:dev`  | Watch-mode development server        |
| `npm run build`      | Compile to `dist/`                   |
| `npm run start:prod` | Run the compiled server              |
| `npm run lint`       | Lint & auto-fix                      |
| `npm run format`     | Format with Prettier                 |
| `npm run db:migrate` | Apply pending migrations             |
| `npm run db:seed`    | Load the starter food catalogue      |
| `npm run db:verify-rls` | Audit Row Level Security on a live database |
| `npm run typecheck`  | Typecheck without emitting           |
| `npm test`           | Unit tests                           |
| `npm run test:cov`   | Unit tests with coverage             |
| `npm run test:e2e`   | End-to-end tests                     |
| `npm run test:all`   | Unit then end-to-end                 |
