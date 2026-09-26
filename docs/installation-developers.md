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
git clone https://github.com/prodalignHQ/nuffmoney.git momoney
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
   *(Optional: If you want to specify a custom database location, add `DATABASE_URL=file:./momoney.db` or `SQLITE_DB_PATH=~/.momoney/momoney.db`)*.

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
   > ```bash
   > yes | pnpm --filter @momoney/db exec drizzle-kit push
   > ```

4. **Seed the Database:**
   Run the seed script to populate sample accounts, categories, owners, and merchants:
   ```bash
   pnpm --filter @momoney/db run db:seed
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

| Command | Action |
| :--- | :--- |
| `pnpm dev` | Starts dev server using `.env` database configuration |
| `DB_DIALECT=sqlite pnpm dev` | Forces dev server to run with SQLite |
| `pnpm type-check` | Type-checks all 7 workspace packages |
| `pnpm lint` | Runs linter across the repository |
| `pnpm build` | Production build of web and api packages |
| `pnpm clean` | Cleans build artifacts and caches |

---

## 5. Compiling the Standalone Single-File Binary

MoMoney can be compiled into a single executable binary powered by Bun:

```bash
# 1. Build binary for your current operating system
pnpm run build:binary

# Output binary created at:
# ./dist/momoney (macOS/Linux)
```

To compile for all target platforms (macOS, Linux x64, Windows x64):
```bash
pnpm run build:binary:all

# Output binaries created at:
# ./dist/momoney (macOS Apple Silicon)
# ./dist/momoney-linux-x64 (Linux x64)
# ./dist/momoney-windows-x64.exe (Windows x64)
```

### How the Standalone Build Works Under the Hood:
1. `apps/web` exports static HTML/JS/CSS assets via `NEXT_OUTPUT_EXPORT=true`.
2. `scripts/bundle-assets.ts` gzips and embeds all static assets into `apps/api/src/embedded-assets.ts`.
3. Bun bundles `apps/api/src/standalone.ts` and compiles it with Bun's embedded runtime into a self-contained binary (`bun build --compile`).
