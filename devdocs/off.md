# Implementation Tasks: Browser-First Mode

- [ ] **1. Auth / Middleware Layer**
  - [ ] Strip auth redirect from `middleware.ts`
  - [ ] Remove `getServerSession()` redirect from `app/(app)/layout.tsx`

- [ ] **2. Local Storage Engine & Adapter**
  - [ ] Create `lib/store/local-db.ts` to manage all localStorage CRUD
  - [ ] Create `lib/store/default-categories.ts` (seed data)
  - [ ] Expand `DataAdapter` interface in `lib/store/storage-mode.tsx`
  - [ ] Implement `localAdapter` inside `storage-mode.tsx`

- [ ] **3. Page-by-Page Refactoring**
  - [ ] Refactor Accounts Page (`app/(app)/accounts/page.tsx`)
  - [ ] Refactor Statements Page (`app/(app)/statements/page.tsx`) (Handle missing PDF support in local mode)
  - [ ] Refactor Transactions Page (`app/(app)/transactions/page.tsx`)
  - [ ] Refactor Rules Page (`app/(app)/rules/page.tsx`)
  - [ ] Refactor Insights Page (`app/(app)/insights/page.tsx`)
  - [ ] Refactor Networth Page (`app/(app)/networth/page.tsx`)
  - [ ] Refactor Owners Page (`app/(app)/settings/owners/page.tsx`)

- [ ] **4. Layout & Sidebar Adaptations**
  - [ ] Update `components/layout/Sidebar.tsx` (Fallback user, clear verified gating)
  - [ ] Update `components/auth/AppAccessGuard.tsx` (Bypass lock in local mode)
  - [ ] Update `components/auth/DashboardVerificationNotice.tsx`

- [ ] **5. Landing Page & Settings**
  - [ ] Update Landing Page CTAs (`app/page.tsx`)
  - [ ] Add Data Portability (Export/Import JSON Backup) to Settings.
  - [ ] Add "Migrate Local Data to Cloud" feature.
