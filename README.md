# finance-dashboard-be

Backend for the finance dashboard. NestJS + TypeScript, MSSQL throughout.

## What this is

A multi-tenant backend where each **organization** has its own separate **Autocount**
ERP database. This app never writes to Autocount — it only runs read-only, live,
per-request queries against whichever organization's database a request is scoped to
(no sync/cache layer for the data itself). Organizations' Autocount connection details
(host/port/database/username/password) are stored in this app's own database,
`finance-dashboard-db`, with the password encrypted at rest.

## Roles & permissions

Every user has exactly one **global** role — `admin` or `staff` — never a per-organization
role. Permissions are attached to the role, not the individual user (see
`src/common/auth/role.ts`):

- `admin` — implicit access to every organization, plus `organization:manage` and
  `user:manage` (create/edit organizations, users, Autocount credentials, audit log).
- `staff` — only `report:view`. Can see the organizations explicitly granted to them
  (via the `organization_access` table) and view reports (e.g. Profit & Loss) for those
  organizations only.

`admin` bypasses the `organization_access` table entirely — see `OrgAccessGuard`.

## Getting started

```bash
cp .env.example .env
# fill in APP_DB_*, JWT_SECRET, and CREDENTIALS_ENCRYPTION_KEY (see below)

npm install
npm run migration:run
npm run bootstrap:admin   # ADMIN_EMAIL / ADMIN_FULL_NAME / ADMIN_PASSWORD env vars, see .env.example
npm run start:dev
```

Generate a `CREDENTIALS_ENCRYPTION_KEY`:

```bash
npm run generate:encryption-key
```

This key encrypts every organization's stored Autocount password (AES-256-GCM). Losing
it means every stored Autocount credential must be re-entered — back it up like any
other production secret.

## Migrations

App DB (`finance-dashboard-db`) only — Autocount databases are owned by each
organization and are never migrated by this app.

```bash
npm run migration:run
npm run migration:revert
npm run migration:generate -- src/migrations/SomeName   # after changing an entity
```

## Bootstrapping the first admin

There is deliberately no seeded default admin migration (a checked-in migration with a
real password is a leaked credential the moment it's committed). Instead, run once per
environment:

```bash
ADMIN_EMAIL=you@example.com ADMIN_FULL_NAME="Your Name" ADMIN_PASSWORD='...' npm run bootstrap:admin
```

## Tests

```bash
npm test          # unit tests — statement builder, connection manager, guards
npm run test:e2e  # requires a reachable finance-dashboard-db with migrations applied
```

## Autocount connections

`AutocountConnectionManagerService` (`src/modules/autocount-connections/`) caches one
`mssql.ConnectionPool` per organization, evicting idle ones and never caching a failed
connection attempt. It intentionally does not use TypeORM — Autocount access is 100%
raw parameterized queries, no entities or migrations on that side. See the class-level
comment in that file for the full design rationale.

## Environment variables

See `.env.example` for the full list and defaults.
