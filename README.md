# http-db

A tiny Bun-based HTTP database server with a table-level REST API and in-memory caching.

Features
- Table-level REST endpoints: list, create, get, update, delete.
- Query params on listing: `page`, `pageSize`, `limit`.
- Toggleable Bearer token auth (enabled by default).
- In-memory cache with debounced batched writes to database.

Quick start
-----------

**Option A: Download binary executable**
```bash
# Download the latest release
curl -L -o http-db https://github.com/Nathan93705/http-db/releases
chmod +x http-db
./http-db
```

**Option B: Build and run from source**
```bash
# Clone the repository
git clone https://github.com/Nathan93705/http-db.git
cd http-db

# Install dependencies and start
npm i
npm run dev
```

The server logs the URL it listens on (for example: http://localhost:3000).

Try it — quick smoke test
-------------------------

Run this sequence to exercise basic CRUD (replace host/port if different):

```bash
# Create table "users"
curl -s -X POST http://localhost:3000/api/db/tables \
	-H 'Content-Type: application/json' \
	-d '{ "tableName": "users" }' | jq

# List all tables
curl -s -x GET http://localhost:3000/api/db/tables | jq

# Get table info for "users"
curl -s -x GET http://localhost:3000/api/db/tables/users | jq

# Delete table "users"
curl -s -X DELETE http://localhost:3000/api/db/tables/users | jq

```

API
---

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

Auth
----

- A simple Bearer token can be enabled in the `.env` via the `AUTH_ENABLED` constant.
- Default: `AUTH_ENABLED` is `false` (auth disabled).
- To enable auth, set `AUTH_ENABLED` to `true` and `AUTH_KEY` to a string (for example `AUTH_KEY = 'secret-token'`) and restart the server. Then include the header:

```
Authorization: Bearer secret-token
```

Persistence & caching
---------------------

- Collections are cached in memory on first access. Writes are batched and flushed (debounced ~100ms) to reduce I/O.

Frontend integration
--------------------

- Recommended: use Vite + React + TypeScript for a dev-friendly experience (HMR and proxy). Add a proxy from your dev server to the API (e.g., `/api` -> `http://localhost:3000`).
- Alternative: keep a Bun-only frontend build (esbuild) if you want a single runtime. Vite gives a nicer DX.

Notes & limitations
-------------------

- Realtime pub/sub is in-process only (no clustered pub/sub). If you run multiple server instances you’ll need an external pub/sub (Redis, etc.) for SSE to work across instances.

Troubleshooting
---------------

- If the server fails to start, ensure Bun is installed and the port isn't already in use. If you see EADDRINUSE, stop the process occupying the port or change the port.
- If you change `AUTH_KEY`, restart the server for the new key to take effect.

-----------------------
