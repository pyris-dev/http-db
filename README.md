# http-db

A tiny Bun-based HTTP database server with a table-level REST API and in-memory caching.

Features

- Browser control room at `/` for same-origin API testing.
- Table-level REST endpoints: list, create, get, delete.
- Row-level REST endpoints: list, create, get, update, delete.
- Oplog-compatible table sync endpoint with optional version checks.
- Query params on listing: `page`, `pageSize`, `limit`.
- Toggleable Bearer token auth.
- SQLite-backed persistence with in-memory table metadata.

## Quick start

**Option A: Download binary executable**

```bash
# Download from the latest GitHub release assets:
# - http-db-<version>-windows-x64.exe
# - http-db-<version>-linux-x64
# https://github.com/pyris-dev/http-db/releases/latest
```

**Option B: Build and run from source**

```bash
# Clone the repository
git clone https://github.com/pyris-dev/http-db.git
cd http-db

# Install dependencies and start
npm i
npm run dev
```

The server logs the URL it listens on (for example: http://localhost:3000).

Open the root URL in a browser to use the built-in request console.

## Scripts

- `npm run dev`: start the Bun server in development mode.
- `npm run build`: compile TypeScript to `./dist`.
- `npm run bundle`: compile a standalone executable via `bundle.ts`.
  - Output path: `./bundle/http-db-<version>.exe` on Windows.
  - Output path: `./bundle/http-db-<version>` on Linux.
- `npm run release`: shorthand for `npm run release:patch`.
- `npm run release:patch`: bump the patch version, create the release tag, and push the branch plus tags.
- `npm run release:minor`: bump the minor version, create the release tag, and push the branch plus tags.
- `npm run release:major`: bump the major version, create the release tag, and push the branch plus tags.
- `npm run lint`: run ESLint.
- `npm run lint:fix`: auto-fix ESLint issues where safe.

## Configuration

- Runtime configuration is loaded from `config.yaml` in the current working directory.
- If `config.yaml` does not exist, the server auto-generates one with defaults and comments.
- If `config.yaml` exists but is missing required options, startup fails with a clear config error.
- `AUTH_KEY` is conditionally required when `AUTH_ENABLED: true`.

Example:

```yaml
AUTH_ENABLED: true
AUTH_KEY: yoursupersecretkey
DATABASE_TYPE: embedded
DATABASE_PLATFORM: sqlite
DATABASE_NAME: database.db
```

## Releases

- GitHub Actions builds and publishes bundled binaries on version tags (`v*`).
- Release assets include both Windows and Ubuntu builds:
  - `http-db-<version>-windows-x64.exe`
  - `http-db-<version>-linux-x64`
- The simplest release flow is `npm run release:patch`, which bumps the patch version, creates the `v*` tag, and pushes everything to GitHub.

## Try it — quick smoke test

Run this sequence to exercise basic CRUD (replace host/port if different):

```bash
# Create table "users"
curl -s -X POST http://localhost:3000/api/db/tables \
	-H 'Content-Type: application/json' \
	-d '{ "tableName": "users" }' | jq

# List all tables
curl -s -X GET http://localhost:3000/api/db/tables | jq

# Get table info for "users"
curl -s -X GET http://localhost:3000/api/db/tables/users | jq

# Delete table "users"
curl -s -X DELETE http://localhost:3000/api/db/tables/users | jq

```

## API

- GET /api/health
  - Returns 200 OK if the server is running.

- GET /api/db/tables
  - List tables.
  - Query params:
    - `limit` (number)
    - `page` (number)
    - `pageSize` (number)
      (URL-encoded)

- POST /api/db/tables
  - Create a new table (JSON body with `tableName`).
  - Example body: `{ "tableName": "users" }`
  - Returns the created table info.

- GET /api/db/tables/:table
  - Get info about a specific table.
  - URL param: `:table` — table name.
  - Returns the table info.

- DELETE /api/db/tables/:table
  - Delete a specific table.
  - URL param: `:table` — table name.
  - Returns a success message.

- GET /api/db/tables/:table/rows
  - List rows in the table.
  - URL param: `:table` — table name.
  - Query params:
    - `limit` (number)
    - `page` (number)
    - `pageSize` (number)

- POST /api/db/tables/:table/rows
  - Create a row in the table.
  - Request body: any JSON object. If `id` is provided, it is used as the row id.

- GET /api/db/tables/:table/rows/:row
  - Get a single row by id.

- PUT /api/db/tables/:table/rows/:row
  - Update a row by id.
  - Request body: JSON object merged into the existing row data.

- DELETE /api/db/tables/:table/rows/:row
  - Delete a single row by id.

- GET /api/db/tables/:table/sync
  - Get current sync version for a table.
  - Response: `{ "tableName": string, "version": number }`

- POST /api/db/tables/:table/sync
  - Apply oplog and/or snapshot sync atomically.
  - Request body:
    - `ops`: ordered array of operations:
      - `{ "op": "set", "key": string, "value": any }`
      - `{ "op": "delete", "key": string }`
      - `{ "op": "clear" }`
    - `memory`: full snapshot as `Record<string, any>`
    - `baseVersion` (optional): reject stale update if current version differs
    - `mode` (optional): `incremental` | `overwrite` | `reconcile`
  - Mode behavior:
    - `incremental` (default when `ops` exists): apply `ops` in order
    - `overwrite` (default when no `ops`): replace table state with `memory`
    - `reconcile`: apply `ops`, then replace with `memory`
  - Response includes version and resulting state.

## Auth

- A simple Bearer token can be enabled in `config.yaml` via `AUTH_ENABLED`.
- Default: `AUTH_ENABLED` is `false` (auth disabled).
- To enable auth, set `AUTH_ENABLED: true` and `AUTH_KEY: secret-token`, then restart the server. Include the header:

```
Authorization: Bearer secret-token
```

## Persistence & caching

- Collections are cached in memory on first access. Writes are batched and flushed (debounced ~100ms) to reduce I/O.
- On startup, only tables with `id` and `data` columns are loaded as API tables. Internal metadata tables are ignored.

## Frontend integration

- Recommended: use Vite + React + TypeScript for a dev-friendly experience (HMR and proxy). Add a proxy from your dev server to the API (e.g., `/api` -> `http://localhost:3000`).
- Alternative: keep a Bun-only frontend build (esbuild) if you want a single runtime. Vite gives a nicer DX.

## Notes & limitations

- Realtime pub/sub is in-process only (no clustered pub/sub). If you run multiple server instances you’ll need an external pub/sub (Redis, etc.) for SSE to work across instances.

## Troubleshooting

- If the server fails to start, ensure Bun is installed and the port isn't already in use. If you see EADDRINUSE, stop the process occupying the port or change the port.
- If you change `AUTH_KEY`, restart the server for the new key to take effect.

## Route debugging

- Set `DEBUG_MODE: true` in `config.yaml` to print request and operation logs.
- Each request logs:
  - inbound line: method + path/query
  - outbound line: method + path/query + status + duration in ms
  - error line (if thrown): method + path/query + duration + error message
- Database operations also log with a `[DB][OP]` prefix for key actions:
  - table load/create/delete
  - row insert/update/delete
  - sync apply summary (mode, versions, op count, key count)

Example output:

```text
[ROUTE][IN] GET /api/db/tables?page=1&pageSize=20
[ROUTE][OUT] GET /api/db/tables?page=1&pageSize=20 -> 200 (4ms)
[DB][OP] create table table=users
[DB][OP] insert row table=users id=abc-123
```

---
