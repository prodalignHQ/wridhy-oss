# Application Configuration Reference

This document outlines all configuration variables, environment flags, and runtime settings supported by MoMoney.

---

## 1. Environment Files

MoMoney loads configuration from:
- `apps/api/.env` (for backend server, database, and authentication)
- `apps/web/.env.local` (for frontend Next.js variables during development)

When running the standalone binary, environment variables can be passed directly via your shell or a `.env` file located in the same directory as the executable.

---

## 2. Configuration Variables

### Database Settings

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | String | *Empty* | Connection string for the database.<br>• If starts with `postgres://` or `postgresql://` $\rightarrow$ Connects to PostgreSQL.<br>• If starts with `file:` (e.g. `file:~/.momoney/momoney.db`) or ends with `.db` $\rightarrow$ Connects to SQLite.<br>• If omitted, defaults to SQLite. |
| `DB_DIALECT` | String (`sqlite` \| `postgres`) | *Auto-detected* | Explicitly forces the database engine, overriding whatever is present in `DATABASE_URL`. Set `DB_DIALECT=sqlite` to run SQLite without modifying existing postgres connection strings. |
| `SQLITE_DB_PATH` | String (File path) | `~/.momoney/momoney.db` | Explicit file path for the SQLite database file when running in SQLite mode. Supports tilde paths (e.g. `~/.momoney/my_data.db`) and relative paths (e.g. `./data/momoney.db`). |
| `MOMONEY_LOCAL_MODE` | Boolean (`true` \| `false`) | `false` (Auto in binary) | When `true`, enables local mode: automatically grants a pre-seeded local user session (`local@momoney.internal`) without requiring passwords or email verification. Automatically enabled in the standalone binary. |

---

### Server & Network

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `PORT` | Integer | `3001` (API) / `3000` (Binary) | The HTTP port the Hono server listens on. In standalone binary mode, the unified frontend and backend listen on this port. |
| `NODE_ENV` | String (`development` \| `production` \| `test`) | `development` | Node runtime environment mode. In development mode, verbose error messages are returned in API error responses. |

---

### Authentication (Better Auth)

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `BETTER_AUTH_SECRET` | String | *Required in Prod* | Encryption key used to sign session cookies and JWT tokens. In standalone local mode, a fallback default secret is automatically provided if left blank. |
| `BETTER_AUTH_URL` (or `AUTH_BASE_URL`) | String (URL) | `http://localhost:3001` | Publicly accessible base URL of the authentication server. Used for generating email verification and callback URLs. |
| `BETTER_AUTH_TRUSTED_ORIGINS` (or `AUTH_TRUSTED_ORIGINS`) | Comma-separated URLs | `http://localhost:3000,http://127.0.0.1:3000` | Whitelisted frontend origins allowed to send cross-origin requests with authentication cookies. |

---

### Email Delivery (Cloud / PostgreSQL Mode)

When running in multi-tenant PostgreSQL mode, MoMoney can send email verification links and transactional notices:

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `EMAIL_PROVIDER` | String (`console` \| `resend` \| `custom`) | `console` | The email delivery driver to use.<br>• `console`: Prints verification URLs to server stdout (ideal for development).<br>• `resend`: Uses the Resend API.<br>• `custom`: Dynamically loads an external JS/TS module. |
| `RESEND_API_KEY` | String | *None* | Your Resend API key (required when `EMAIL_PROVIDER=resend`). |
| `EMAIL_FROM` | String (Email) | `no-reply@momoney.internal` | The "From" address for outgoing emails. |
| `EMAIL_CUSTOM_PROVIDER_PATH` | String (File path) | *None* | Path to a custom email provider module (used when `EMAIL_PROVIDER=custom`). |

> [!NOTE]
> When running in SQLite or local mode, email verification is automatically bypassed—no emails are dispatched.

---

### Frontend Build & Client Settings

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | String (URL) | `http://localhost:3001` | Target URL used by the browser to communicate with the API. For the embedded standalone binary, this is set to an empty string (`""`) so API calls use relative paths (`/api/...`). |
| `NEXT_OUTPUT_EXPORT` | String (`true` \| `false`) | `false` | When set to `'true'`, Next.js outputs a static HTML/JS/CSS export (`apps/web/out`) instead of requiring a Node.js server. Used when packaging the standalone binary. |

---

## 3. Sample Configuration Files

### Sample 1: SQLite Mode (`apps/api/.env`)
Zero-configuration, lightweight local development:

```env
DB_DIALECT=sqlite
PORT=3001
NODE_ENV=development
BETTER_AUTH_URL=http://localhost:3001
BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

---

### Sample 2: PostgreSQL Local Mode (`apps/api/.env`)
Development with local Dockerized PostgreSQL:

```env
DATABASE_URL=postgres://momoney:momoney_dev@localhost:5432/momoney_db2
PORT=3001
NODE_ENV=development
BETTER_AUTH_SECRET=super_secret_local_dev_token_123456
BETTER_AUTH_URL=http://localhost:3001
BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
EMAIL_PROVIDER=console
```

---

### Sample 3: Production Hosted Cloud Deployment (`apps/api/.env`)
Production cloud deployment (e.g. AWS, Render, Fly.io, Railway):

```env
DATABASE_URL=postgres://user:strong_password@db.provider.internal:5432/momoney_production?sslmode=require
PORT=3001
NODE_ENV=production
BETTER_AUTH_SECRET=generate_with_openssl_rand_hex_32
BETTER_AUTH_URL=https://api.yourdomain.com
BETTER_AUTH_TRUSTED_ORIGINS=https://app.yourdomain.com
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_1234567890abcdef
EMAIL_FROM=hello@yourdomain.com
```
