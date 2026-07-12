# MoMoney

Privacy-first personal finance application focusing on data ownership, transparent categorization, and actionable insights.

## Project Structure

This project is a Turborepo monorepo using `pnpm` workspaces. It is divided into two main applications (frontend and backend API) and shared internal packages.

### Apps (`/apps`)

- `web`: The Next.js 16 frontend app using App Router and Tailwind CSS v4. Contains the dashboard, statements upload UI, and transaction management interfaces.
- `api`: A minimal lightweight Hono.js backend API meant to support both the web app and future mobile applications.

### Packages (`/packages`)

- `db`: The global database schema definition using **Drizzle ORM** (PostgreSQL). It exports all tables (users, accounts, transactions, statements, categories, rules, assets, liabilities) as well as the Drizzle database client.
- `types`: Shared **Zod** models and inferred Typescript types used by both the frontend and the `api`. It enforces type safety across the entire monorepo boundaries.
- `utils`: Shared isomorphic utility functions (currency formatters, string hashers, `cn` class merger for Tailwind, color assignment logic).

## Setup & Running Locally

1. **Install Dependencies**
   Run the following from the root directory:

   ```bash
   pnpm install
   ```

2. **Environment Variables**
   Set up your environment variables for the API and Database. Create a `.env` inside `apps/api/`:
   
   ```bash
   DATABASE_URL=postgres://momoney:momoney_dev@localhost:5432/momoney_db
   BETTER_AUTH_SECRET=your_super_secret_string
   ```

3. **Database Setup**
   The project uses PostgreSQL. A `docker-compose.yml` file is provided at the root:

   ```bash
   # Start the local database
   docker-compose up -d
   ```

4. **Initialize Database Schema**
   Once the database is running, push the Drizzle ORM schema to create the initial tables (this includes the tables required for `better-auth` as they are woven into the Drizzle schema):

   ```bash
   pnpm --filter @momoney/db exec drizzle-kit push
   ```

   > **Note:** `drizzle-kit push` is interactive — it will show pending changes and wait for confirmation. Use arrow keys to select "Yes" and press Enter. If you need a non-interactive alternative, you can pipe the confirmation:
   > ```bash
   > yes | pnpm --filter @momoney/db exec drizzle-kit push
   > ```

   *(Optional) If you ever need to apply Better Auth specific migrations directly via their CLI, you can run `DATABASE_URL=... pnpm dlx @better-auth/cli migrate`*.

5. **Start Development Servers**
   To start both the Next.js web application and the Hono.js API server simultaneously, run:

   ```bash
   pnpm dev
   ```

   This will spin up:
   - **Web App**: http://localhost:3000
   - **API Server Check**: http://localhost:3001/health

> **Note on Ports:** If `pnpm dev` fails to start due to port conflicts, ensure you don't have zombie Node/Next.js processes running. You can kill them using `lsof -ti :3000,3001 | xargs kill -9`.

## Development Phases

This project is being built in distinct phases. We have currently completed **Phase 0:**

- Setup monorepo structure
- Drizzle schema definition
- Shared typing definitions
- Next.js 16 Dark-mode app shell with Shadcn UI custom components
- Minimal API health check and route stubs
