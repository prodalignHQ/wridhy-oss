# Developer Setup & Installation Guide

This guide walks through configuring, bootstrapping, and developing with MoMoney locally.

---

## 1. Prerequisites

Ensure the following tools are installed on your machine:

- **Node.js**: `v20.x` or later (tested on Node v22+)
- **pnpm**: `v9.x` or later (`npm install -g pnpm`)
- **Bun**: `v1.2.x` or later (required for compiling the zero-dependency standalone binary)
- **Docker & Docker Compose**: (Optional, only needed if developing with PostgreSQL)

---

## 2. Clone and Install Dependencies

```bash
git clone https://github.com/prodalignHQ/wridhy-oss.git momoney
cd momoney
pnpm install
```

---

## 3. Database Bootstrapping Options

MoMoney supports two database engines via **Drizzle ORM**:

1. **SQLite** (Fastest local setup, zero dependencies, used by standalone binary)
2. **PostgreSQL** (Multi-tenant commercial deployment setup)

---

### Option A: SQLite Database (Recommended for Fast Local Development)

With SQLite, you do **not** need Docker or a running PostgreSQL instance. The schema and initial seed data are applied automatically when the application boots up.

1. **Configure Environment:**
   Create or edit `apps/api/.env`:

   ```env
   # Force SQLite engine
   DB_DIALECT=sqlite
   PORT=3001
   BETTER_AUTH_URL=http://localhost:3001
   BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
   ```

   _(Optional: If you want to specify a custom database location, add `DATABASE_URL=file:./momoney.db` or `SQLITE_DB_PATH=~/.momoney/momoney.db`)_.

2. **Automatic Bootstrap:**
   When the API server starts up with `DB_DIALECT=sqlite`, it automatically:
   - Creates the database file at `~/.momoney/momoney.db` (or custom path).
   - Enables WAL mode and foreign key constraints.
   - Executes raw DDL (`sqlite-init.ts`) to create all 19 tables and performance indexes.
   - Seeds the default local user (`local@momoney.internal`), default owner (`Self`), and 12 standard system expense/income categories.

3. **Start the Dev Servers:**
   ```bash
   DB_DIALECT=sqlite pnpm dev
   ```

---

### Option B: PostgreSQL Database (Commercial / Hosted Architecture)

1. **Start the PostgreSQL Container:**
   Start the local PostgreSQL database using the included Docker Compose configuration:

   ```bash
   docker-compose up -d
   ```

2. **Configure Environment:**
   Set up `apps/api/.env`:

   ```env
   DATABASE_URL=postgres://momoney:momoney_dev@localhost:5432/momoney_db2
   PORT=3001
   NODE_ENV=development
   BETTER_AUTH_URL=http://localhost:3001
   BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
   BETTER_AUTH_SECRET=your_super_secret_development_string
   ```

3. **Push the Schema (Drizzle ORM):**
   Push the schema to create all tables (including Better Auth tables):

   ```bash
   pnpm --filter @momoney/db exec drizzle-kit push
   ```

   > **Note:** `drizzle-kit push` is interactive. To run non-interactively in CI or scripts:
   >
   > ```bash
   > yes | pnpm --filter @momoney/db exec drizzle-kit push
   > ```

4. **Seed the Database:**
   - **Basic System Seed** (standard categories, rules, and merchants):
     ```bash
     pnpm --filter @momoney/db run db:seed
     ```
   - **Rich Demo Dataset** (verified user, transactions, statements, Husband & Wife owners, net worth snapshots, salary progression, tax history):
     ```bash
     pnpm --filter @momoney/db run db:seed-demo
     # Log in with demo@momoney.io / password123
     ```

5. **Start the Dev Servers:**
   ```bash
   pnpm dev
   ```

---

## 4. Development Workflow

The dev server runs both the Next.js frontend and Hono API server in parallel using Turborepo:

- **Web App**: [http://localhost:3000](http://localhost:3000)
- **API Server Check**: [http://localhost:3001/health](http://localhost:3001/health)

### Running Commands

| Command                      | Action                                                |
| :--------------------------- | :---------------------------------------------------- |
| `pnpm dev`                   | Starts dev server using `.env` database configuration |
| `DB_DIALECT=sqlite pnpm dev` | Forces dev server to run with SQLite                  |
| `pnpm type-check`            | Type-checks all 7 workspace packages                  |
| `pnpm lint`                  | Runs linter across the repository                     |
| `pnpm build`                 | Production build of web and api packages              |
| `pnpm clean`                 | Cleans build artifacts and caches                     |

---

## 5. Compiling the Standalone Single-File Binary

Wridhy can be compiled into a single executable binary powered by Bun:

```bash
# 1. Build binary for your current operating system
pnpm run build:binary

# Output binary created at:
# ./dist/wridhy (macOS/Linux)
```

To compile for all target platforms (macOS Apple Silicon, macOS Intel, Linux x64, Windows x64):

```bash
pnpm run build:binary:all

# Output binaries created at:
# ./dist/wridhy-darwin-arm64 (macOS Apple Silicon)
# ./dist/wridhy-darwin-x64 (macOS Intel)
# ./dist/wridhy-linux-x64 (Linux x64)
# ./dist/wridhy-windows-x64.exe (Windows x64)
```

### Automated GitHub Releases Workflow:

A GitHub Action (`.github/workflows/release-binaries.yml`) is configured to automatically:

- Trigger whenever a GitHub Release is published (`on: release: types: [published]`) or manually dispatched via `workflow_dispatch`.
- Build and cross-compile standalone executables for macOS (Apple Silicon & Intel), Linux (x64 & ARM64), and Windows (x64).
- Create compressed `.tar.gz` and `.zip` archives where the extracted executable is named `wridhy` (or `wridhy.exe` on Windows).
- Generate a `checksums.txt` file with SHA-256 signatures for all binaries and archives.
- Publish all artifacts as a **GitHub Actions Workflow Artifact** (`wridhy-binaries`).
- Attach all binaries and checksums directly as downloadable assets to the GitHub Release.

### How the Standalone Build Works Under the Hood:

1. `apps/web` exports static HTML/JS/CSS assets via `NEXT_OUTPUT_EXPORT=true`.
2. `scripts/bundle-assets.ts` gzips and embeds all static assets into `apps/api/src/embedded-assets.ts`.
3. Bun bundles `apps/api/src/standalone.ts` and compiles it with Bun's embedded runtime into a self-contained binary (`bun build --compile`).

---

## 6. Docker Container Deployment (PostgreSQL & SQLite)

Wridhy is packaged into a minimal multi-stage Docker image (`rohanmallya/wridhy:latest`) that supports **both PostgreSQL and SQLite** seamlessly:

### Building and Pushing the Docker Image:

```bash
# Build and push rohanmallya/wridhy:latest
./build.sh

# Build and push with version tag
./build.sh v0.1.0

# Multi-arch build for linux/amd64 and linux/arm64
./build.sh latest --multi-arch
```

### Running with PostgreSQL (Recommended for production / homelab servers):

Pass `DATABASE_URL` pointing to your PostgreSQL instance. Wridhy automatically initializes the database tables and indexes on first boot:

```bash
docker run -d \
  --name wridhy \
  -p 3000:3000 \
  -e DATABASE_URL="postgres://momoney:momoney_dev@postgres-host:5432/momoney_db" \
  rohanmallya/wridhy:latest
```

### Running with Docker Compose (Wridhy + PostgreSQL):

The included [`docker-compose.yml`](file:///Users/rohanmallya/Development/prodalign/momoney-oss/docker-compose.yml) starts both PostgreSQL and Wridhy together:

```bash
docker compose up -d
```

### Running with SQLite (Zero-configuration):

If `DATABASE_URL` is omitted, Wridhy defaults to SQLite with data persisted in `/data`:

```bash
docker run -d \
  --name wridhy \
  -p 3000:3000 \
  -v wridhy_data:/data \
  rohanmallya/wridhy:latest
```
