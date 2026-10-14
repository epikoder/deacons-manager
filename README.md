# Deacons Manager

Admin dashboard for Deacon's Publishers. It pulls book orders from the affiliate
sites, and the office uses it to confirm them, assign them to delivery agents, track
delivery, and report earnings for affiliates and agents.

Built with [Vike](https://vike.dev) + React + Tailwind on the front end, and
[PostgREST](https://postgrest.org) over PostgreSQL as the API. There is no separate
application server: the browser talks to PostgREST directly, and the rules that must
hold for every client (phone normalisation, "assigned implies confirmed", access
scopes) live in the database.

## Contents

- [How it fits together](#how-it-fits-together)
- [Local development](#local-development)
- [Migrations](#migrations)
- [Orders](#orders)
- [Dashboard](#dashboard)
- [Users](#users)
- [Project layout](#project-layout)
- [Scripts](#scripts)
- [Deploying](#deploying)

## How it fits together

```
affiliate sites ──(poll every 60s)──▶ browser (OrderService) ──▶ PostgREST ──▶ Postgres
  api.php / orders_v1                                         /rest
```

- **Order sources** are registered in `pages/(authenticated)/+Layout.tsx`. Each one is
  an affiliate site and a parser from `src/services/orders.service/sources.ts`
  (`sourceUsingJambWaec` for the PHP `api.php` sites, `sourceUsingProductTable` for the
  `/api/orders_v1` sites). The name a source is registered under is stamped on
  `orders.source`, so renaming one splits its history.
- While an admin has the app open, `OrderService` polls every source for orders newer
  than its last pull (kept in `configs.timestamp`). New rows are inserted with
  `ON CONFLICT (source, id) DO NOTHING`, so a re-pull never overwrites an order an
  admin has already worked on.
- **Auth**: `rpc/login` returns an access and a refresh token. The access token is kept
  in `sessionStorage` and the refresh token in `localStorage`. `WithAuth`
  (`src/utils/postgrest.ts`) attaches the token and refreshes it once on a `PGRST301`.

## Local development

You need [Bun](https://bun.sh) and Docker.

```bash
bun install
docker compose up -d                 # Postgres on :5433, PostgREST on :3001
./docker/apply-migrations.sh         # replay migrations/*.up.sql (add --fresh to start over)
docker compose exec -T db psql -U postgres -d deacons < docker/seed-dev.sql
bun run dev                          # http://localhost:3000
```

Vite proxies `/rest` to PostgREST (`PG_REST` overrides the default
`http://localhost:3001`). In development the client calls
`http://localhost:3000/rest`, set in `pages/credentials.shared.ts`, so the dev server
has to be on port 3000.

The seed creates an admin, `admin@prep50.com.ng` / `secret123`, plus a dev app client
and a few orders.

The background pull runs against the **live** affiliate sites in development as well,
so real orders will appear in your local database.

## Migrations

Migrations live in `migrations/` as `<timestamp>_<name>.up.sql` / `.down.sql`.

- **Local stack:** `./docker/apply-migrations.sh` (a plain ordered replay).
- **Real databases:** `./scripts/migrate.sh` (uses `sqlx`, which records history in
  `_sqlx_migrations`). Use `--info` to see what is pending and `--revert` to roll back
  the latest one. Never replay files with `psql` on a database sqlx manages.

Recent migrations the app depends on:

| Migration | What it adds |
|---|---|
| `20250911000000_phone_standardisation` | `normalize_phone()` trigger and the generated `orders.phone_digits` column that phone search uses |
| `20261014000000_order_archive` | `orders.archived_on`, the `confirm_orders_on_assign` trigger plus a backfill, and dashboard chart functions that leave out archived orders |
| `20261014010000_user_management` | the user RPCs below, a fixed `refresh_token` (it now checks the token's expiry and that the user still exists), and a unique index on active emails, created only when no duplicates exist |
| `20261014020000_change_password` | `change_password()` for Settings → Change password |

## Orders

The Orders page (`pages/(authenticated)/orders/+Page.tsx`) fetches one page of 100
rows at a time from the server. Filters, sort and search all run as part of that query.

- **Status filters:** All, UnConfirmed, Confirmed, UnAssigned, Assigned,
  PendingDelivery, Delivered and Archived. Only one can be active at a time.
- **Refiners:** Date range, Affiliate and Category. These can be combined with a status
  filter. Filters are saved in `localStorage` under `filters`.
- **Sort:** the ASC/DESC button orders by `created_at` (by `delivered_on` on the
  Delivered filter). It is saved under `orders_sort`. Use ASC to see the oldest orders
  first.
- **Search:** by default it matches the customer name (substring, case-insensitive),
  the phone number in any format (through `phone_digits`, which holds the last ten
  digits), and the order number. While you type, a dropdown offers to narrow it to one
  field (**Order number**, **Customer name** or **Phone**). The chosen field shows as a
  chip in the box. Without a chip, order numbers match anywhere (`67` finds #67, #767,
  #1067); with the Order number chip they must match exactly. In an order number `x`
  stands for any digit, so `1xx` finds #100–#199 with or without the chip. Typing the
  field also works: `order number: 1727` (or `order: 1727`, `#1727`), `name: Ada`,
  `phone: 0803`. The same help is shown under the search box. Backspace at the start of the box removes the chip. The rules live in
  `src/services/orders.service/search.ts`, with tests in `test/search.test.ts`
  (`bun test test/search.test.ts`). While a search is active it covers all orders and
  ignores the other filters. The one exception is Archived: with that filter on,
  search looks only at archived orders.
- **Confirming and assigning:** assigning an agent also confirms the order. The client
  does this, and the `confirm_orders_on_assign` trigger enforces it for every write
  path. After any change the list reloads, so the order leaves views it no longer
  matches.
- **Archive:** use this for duplicate submissions. An archived order is hidden from
  every list and from the dashboard charts but kept on record. Find it under
  **Archived** and click **Restore** to bring it back. Unconfirmed orders can still be
  deleted outright.
- **Copy:** name, phone and order number each have a copy button. It shows an inline
  "Copied" label instead of an alert.

Saving an order goes through `Order.save()` in `src/services/orders.service/order.ts`.
It drops the generated `phone_digits` column, which Postgres refuses to accept on
insert or update, and reports failures with a toast. If a save fails, the card goes
back to its previous state.

## Dashboard

`pages/(authenticated)/index/+Page.tsx` shows:

- stat tiles for the selected year: orders, delivered, pending, agents and affiliates
- **Orders per month:** a column chart with delivered and pending stacked
  (`cummulative_orders_for_affiliate_by_month`)
- **Orders by affiliate** and **Orders by state:** ranked horizontal bars, top 10
  plus "others" (`cummulative_orders_by_state`)
- the last 10 orders, and the books each agent is holding

The charts use Chart.js through `react-chartjs-2`. The colours are a palette checked
to be colour-blind safe, defined in `VIZ` at the top of the page.

## Users

`/users` is for admins only. Staff who open it see an "Admins only" notice, and every
RPC behind it can only be executed by `admin`. There are two roles: **Staff**
(`authenticated`: orders, agents, affiliates) and **Admin** (also users and book cost).

- **List** (`/users`): search by name or email, with Active and Removed tabs.
- **New user** (`/users/create`): name, email, role and an initial password, at least 8
  characters. The admin shares the password with the person directly.
- **User page** (`/users/<id>`): edit name, email and role; set a new password; remove
  or restore the account.

The rules are enforced in the database, so they hold for any client:

| RPC | Notes |
|---|---|
| `list_users()` | a set-returning function; filter and sort it like a table (`?id=eq.<uuid>`, `?select=*&order=created_at.desc`) |
| `create_user(fname, lname, email, password, role)` | email is trimmed and lower-cased, and must not belong to another active user |
| `update_user(user_id, fname, lname, email, role)` | you can't change your own role, and the last admin can't be demoted |
| `reset_user_password(user_id, password)` | |
| `delete_user(user_id)` | soft delete; you can't remove yourself or the last admin |
| `restore_user(user_id)` | refused if the email has since been given to someone else |

**Changing your own password** (Settings → Change password) calls
`change_password(current_password, new_password)`. It checks the current password,
signs out every other session, and returns a new token pair so the current session
stays signed in.

Changing someone's role or email, resetting their password, or removing them deletes
their tokens. Their current access token keeps working until it expires (at most an
hour), after which they have to sign in again.

## Project layout

```
pages/                    Vike pages (filesystem routing)
  (authenticated)/        everything behind login; +Layout.tsx registers order sources
  login/
src/
  components/             UI: Order card, CopyButton, Dialog, Pagination, Select, ...
  services/
    orders.service/       OrderService (fetch, search, ingest), Order model, sources
    agents.service.ts
    affiliate.service.ts
  utils/                  postgrest client + WithAuth, Carbon (dates), phone, toast
@types/                   shared model types, observer helpers
migrations/               SQL migrations (up/down)
docker/                   local stack: Postgres image, migration runner, seed, checks
scripts/                  migrate.sh, app client and authenticator setup, one-off data fixes
```

## Scripts

| Command | What it does |
|---|---|
| `bun run dev` | Vite dev server |
| `bun run build` | production build into `dist/` |
| `bun run preview` | serve the production build |
| `./scripts/migrate.sh` | apply pending migrations to `DATABASE_URL` |
| `./scripts/register-app-client.sh` | register a third-party app client and its namespaces (run `docker/check-sources.sql` first) |
| `./scripts/set-authenticator-password.sh` | set the PostgREST `authenticator` password |
| `bun run scripts/normalize-phones.ts` | one-off phone backfill (dry run unless `--apply`) |
| `./docker/test-app-client.sh` | end-to-end check of the app-client auth surface |

## Deploying

1. Run migrations: `./scripts/migrate.sh --info`, then `./scripts/migrate.sh`.
2. Build with `bun run build` and serve with `bun run preview` (`admin.prep50.ng` is
   allowed in `vite.config.ts`). In production the client calls
   `https://admin.prep50.ng/rest`.
