/**
 * True when the frontend was built for the standalone single-binary
 * distribution (`pnpm run build:binary`), where there is no concept
 * of accounts — a local user is auto-provisioned and there is no
 * login/signup flow.
 *
 * Inlined at build time via `NEXT_PUBLIC_LOCAL_MODE`.
 */
export const isLocalMode = () => process.env.NEXT_PUBLIC_LOCAL_MODE === 'true'
