# ==============================================================================
# Wridhy Production Dockerfile
# Multi-stage build producing a minimal, secure, non-root container with embedded
# Next.js 16 frontend and SQLite-backed standalone server.
# ==============================================================================

# --- Stage 1: Build & Compile ---
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install system dependencies required for build and Bun installer
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    unzip \
    ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Install pnpm and Bun
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:/root/.bun/bin:$PATH"
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
RUN curl -fsSL https://bun.sh/install | bash

# Copy workspace package manifests first to optimize Docker layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY apps/landing/package.json ./apps/landing/
COPY packages/db/package.json ./packages/db/
COPY packages/parsers/package.json ./packages/parsers/
COPY packages/rules-engine/package.json ./packages/rules-engine/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/

# Install workspace dependencies with frozen lockfile
RUN pnpm install --frozen-lockfile

# Copy application source code
COPY . .

# Build static Next.js frontend export
ENV NEXT_OUTPUT_EXPORT=true
ENV NEXT_PUBLIC_API_URL=""
ENV NEXT_PUBLIC_LOCAL_MODE=true
ENV NODE_ENV=production
RUN pnpm --filter web build

# Bundle static assets into embedded standalone server
RUN bun scripts/bundle-assets.ts

# Compile standalone single binary with Bun
RUN mkdir -p /app/dist && \
    bun build apps/api/src/standalone.ts --compile --outfile /app/dist/wridhy && \
    chmod +x /app/dist/wridhy

# --- Stage 2: Minimal Runtime ---
FROM debian:bookworm-slim AS runner

# Install ca-certificates and curl for health check
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
 && rm -rf /var/lib/apt/lists/*

# Create dedicated non-root user and group
RUN groupadd --system --gid 1001 wridhy && \
    useradd --system --uid 1001 --gid wridhy wridhy

# Set up data directory with proper ownership for SQLite storage
RUN mkdir -p /data && chown -R wridhy:wridhy /data

# Copy compiled binary from builder
COPY --from=builder --chown=wridhy:wridhy /app/dist/wridhy /usr/local/bin/wridhy

# Run as non-root user
USER wridhy

# Default Environment variables:
# Zero-config default: SQLite stored in /data/wridhy.db
# PostgreSQL mode: simply set -e DATABASE_URL="postgres://user:password@host:5432/dbname"
ENV PORT=3000
ENV SQLITE_DB_PATH=/data/wridhy.db

EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

ENTRYPOINT ["wridhy"]
