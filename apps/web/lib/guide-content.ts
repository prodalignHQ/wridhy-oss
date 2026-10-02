// ─── Getting-started guide content ─────────────────────────────────────────
// Single source of truth for the guided tour (sidebar → /guide) and the per-
// section "?" helpers. Steps follow the order a new user must actually do
// things in: accounts → household → statements → rules → transactions →
// invoices → insights.

import {
  Landmark,
  Users,
  FileUp,
  SlidersHorizontal,
  ArrowLeftRight,
  Receipt,
  BarChart3,
  LayoutDashboard,
  TrendingUp,
  Settings as SettingsIcon,
  Lock,
  type LucideIcon,
} from 'lucide-react'

export const GUIDE_PATH = '/guide'

export interface GuideStep {
  id: string
  title: string
  tagline: string
  description: string
  bullets: string[]
  href: string
  cta: string
  icon: LucideIcon
}

export const GUIDE_STEPS: GuideStep[] = [
  {
    id: 'accounts',
    title: 'Add your accounts',
    tagline: 'Step 1 · Where your money lives',
    description:
      'MoMoney tracks spending per account, and every statement is imported into one specific account. So set up your accounts first — a savings account, a credit card, a wallet, whatever you actually use.',
    bullets: [
      'Go to Accounts and click “Add Account”.',
      'Pick the type: bank, credit card, wallet or investment.',
      'Add one account per real-world account whose statements you will upload.',
    ],
    href: '/accounts',
    cta: 'Open Accounts',
    icon: Landmark,
  },
  {
    id: 'household',
    title: 'Add household members',
    tagline: 'Step 2 · Who spends what',
    description:
      'Household members let you split transactions and, later, see exactly which family member spent how much in each category. Add yourself and everyone whose spending flows through these accounts.',
    bullets: [
      'Go to Household (under Finances in the sidebar).',
      'Add each person — e.g. Self, Partner, Parent.',
      'You can split any transaction between members later.',
    ],
    href: '/settings/owners',
    cta: 'Open Household',
    icon: Users,
  },
  {
    id: 'statements',
    title: 'Upload your statements',
    tagline: 'Step 3 · Bring your data in',
    description:
      'Download statements from your bank (CSV, XLS, XLSX or PDF) and upload them here. MoMoney parses each file, auto-categorizes the transactions, and silently skips anything you already imported.',
    bullets: [
      'Go to Statements, choose the account and month.',
      'Drop in the file and review the preview.',
      'Click import — duplicates are skipped automatically.',
    ],
    href: '/statements',
    cta: 'Open Statements',
    icon: FileUp,
  },
  {
    id: 'rules',
    title: 'Add rules (optional)',
    tagline: 'Step 4 · Teach it your merchants',
    description:
      'Rules auto-categorize future imports. If “SWIGGY” should always be Food & Dining, make it a rule once instead of fixing it every month. Your rules always beat the built-in ones.',
    bullets: [
      'Go to Rules and create a rule from a merchant name or keyword.',
      'Pick the category it should always map to.',
      'Hit “Re-apply” to fix already-imported transactions too.',
    ],
    href: '/rules',
    cta: 'Open Rules',
    icon: SlidersHorizontal,
  },
  {
    id: 'transactions',
    title: 'Review transactions',
    tagline: 'Step 5 · Categorize and filter',
    description:
      'This is your ledger. Filter by account, member, category or month, fix any wrong categories, and split shared expenses between household members.',
    bullets: [
      'Go to Transactions and use the filters to slice by account or member.',
      'Click a transaction to change its category or owner split.',
      'Bulk-edit a whole month at once when needed.',
    ],
    href: '/transactions',
    cta: 'Open Transactions',
    icon: ArrowLeftRight,
  },
  {
    id: 'invoices',
    title: 'Create an invoice',
    tagline: 'Step 6 · Who owes what',
    description:
      'An invoice bundles a month’s statements into a shareable snapshot: per-member totals broken down by category. This is how you answer “who spent how much on what”.',
    bullets: [
      'Go to Invoices and start a draft for the month.',
      'Pick the statements to include and review the per-member split.',
      'Generate the invoice to freeze a permanent snapshot.',
    ],
    href: '/invoices',
    cta: 'Open Invoices',
    icon: Receipt,
  },
  {
    id: 'insights',
    title: 'Explore insights',
    tagline: 'Step 7 · See the trends',
    description:
      'Once you have a month or two of categorized data, Insights shows monthly and yearly trends, category comparisons, and per-member spending patterns.',
    bullets: [
      'Go to Insights after importing at least one statement.',
      'Compare months and categories to spot drift.',
      'Filter by member to see individual habits.',
    ],
    href: '/insights',
    cta: 'Open Insights',
    icon: BarChart3,
  },
  {
    id: 'networth',
    title: 'Track your net worth',
    tagline: 'Step 8 · The long view',
    description:
      'Day-to-day spending is only half the picture. Net Worth tracks assets minus liabilities over time — savings and investments against loans and cards — so you can see whether the household is actually getting richer.',
    bullets: [
      'Go to Net Worth and add your assets (savings, investments).',
      'Add liabilities (loans, credit card dues).',
      'Take a snapshot each month to draw the trend line.',
    ],
    href: '/networth',
    cta: 'Open Net Worth',
    icon: TrendingUp,
  },
]

export type SectionKey =
  | 'dashboard'
  | 'accounts'
  | 'household'
  | 'statements'
  | 'rules'
  | 'transactions'
  | 'invoices'
  | 'insights'
  | 'networth'
  | 'settings'
  | 'vault'

export interface SectionHelp {
  title: string
  what: string
  bullets: string[]
  /** Guide step that explains this section in the full tour. */
  guideStepId?: string
  next?: { label: string; href: string }
  icon: LucideIcon
}

export const SECTION_HELP: Record<SectionKey, SectionHelp> = {
  dashboard: {
    title: 'Dashboard',
    what: 'Your financial pulse at a glance: connected accounts, this month’s cash flow, and shortcuts to the things that need attention.',
    bullets: [
      'Pick the spend period to change what the stats cover.',
      '“Add Account” here is the same as on the Accounts page.',
      'New here? Work through the Guided Tour in order instead.',
    ],
    guideStepId: 'accounts',
    next: { label: 'Add your first account', href: '/accounts' },
    icon: LayoutDashboard,
  },
  accounts: {
    title: 'Accounts',
    what: 'Every bank account, credit card, wallet or investment you want to track. Statements are always imported into one specific account, which is why this comes first.',
    bullets: [
      'Click “Add Account” and pick the right type.',
      'Deleting an account orphans its transactions — they stay, unlinked.',
      'Add one account per real statement source.',
    ],
    guideStepId: 'accounts',
    next: { label: 'Next: add household members', href: '/settings/owners' },
    icon: Landmark,
  },
  household: {
    title: 'Household Members',
    what: 'The people sharing these finances. Members let you split transactions and break every invoice down per person.',
    bullets: [
      'Add each person whose spending flows through your accounts.',
      'Split any transaction between members with a percentage.',
      'One member is the default owner for new imports.',
    ],
    guideStepId: 'household',
    next: { label: 'Next: upload a statement', href: '/statements' },
    icon: Users,
  },
  statements: {
    title: 'Statements',
    what: 'Where bank files become transactions. Upload a CSV, XLS, XLSX or PDF, preview what was parsed, then import. Re-uploading the same file is safe — duplicates are skipped.',
    bullets: [
      'Select the matching account and month before uploading.',
      'Check the preview counts (parsed / imported / duplicates).',
      'Import history below shows everything already brought in.',
    ],
    guideStepId: 'statements',
    next: { label: 'Next: set up rules', href: '/rules' },
    icon: FileUp,
  },
  rules: {
    title: 'Rules',
    what: 'Automatic categorization. A rule says “transactions looking like THIS always belong to THAT category”. Your rules run before the built-in ones.',
    bullets: [
      'Match on merchant name, description keyword, or amount pattern.',
      '“Re-apply” re-categorizes transactions you already imported.',
      'The Categories section below manages the category list itself.',
    ],
    guideStepId: 'rules',
    next: { label: 'Next: review transactions', href: '/transactions' },
    icon: SlidersHorizontal,
  },
  transactions: {
    title: 'Transactions',
    what: 'Your full ledger. Everything imported from statements lands here, where you filter, categorize, and split it between members.',
    bullets: [
      'Filters: narrow by month, account, member, category or search text.',
      'Click a row to edit its category or owner split.',
      'Wrong categories at scale? Fix the rule, then “Re-apply rules”.',
    ],
    guideStepId: 'transactions',
    next: { label: 'Next: create an invoice', href: '/invoices' },
    icon: ArrowLeftRight,
  },
  invoices: {
    title: 'Invoices',
    what: 'Monthly snapshots answering “who spent how much on what”. Build a draft from the month’s statements, review the per-member × per-category split, then generate to freeze it permanently.',
    bullets: [
      'Drafts are editable; generated invoices are frozen records.',
      'Include only the statements that belong to the period.',
      'Share or export the snapshot for family settlements.',
    ],
    guideStepId: 'invoices',
    next: { label: 'Next: explore insights', href: '/insights' },
    icon: Receipt,
  },
  insights: {
    title: 'Insights',
    what: 'Trends over time: monthly and yearly spending, category comparisons, and per-member patterns. Needs at least one imported statement to say anything useful.',
    bullets: [
      'Switch invoice vs. calendar accounting to match billing cycles.',
      'Filter by member to compare individual habits.',
      'Looks empty? Import a statement first.',
    ],
    guideStepId: 'insights',
    next: { label: 'Next: track net worth', href: '/networth' },
    icon: BarChart3,
  },
  networth: {
    title: 'Net Worth',
    what: 'Assets minus liabilities, tracked over time with manual snapshots. Separate from day-to-day spending — this is the long view.',
    bullets: [
      'Add assets (savings, investments) and liabilities (loans, cards).',
      'Take snapshots periodically to draw the trend line.',
      'Filter by member to see individual net worth.',
    ],
    guideStepId: 'networth',
    icon: TrendingUp,
  },
  settings: {
    title: 'Settings',
    what: 'App configuration: household members, categories, rules, and your encrypted vault live one level down from here.',
    bullets: [
      'Household: manage the people you split with.',
      'Encrypted Vault: back up your data with zero-knowledge encryption.',
      'Most day-to-day work happens in the Finances section, not here.',
    ],
    icon: SettingsIcon,
  },
  vault: {
    title: 'Encrypted Vault',
    what: 'Zero-knowledge backup. Your data is encrypted on this device before it ever reaches the server — we cannot read it. Keep your password and recovery key safe.',
    bullets: [
      'Password unlocks daily use; recovery key is the last resort.',
      'A passkey adds one-tap unlock on this device.',
      'Lose all three and the backup is unrecoverable — by design.',
    ],
    icon: Lock,
  },
}

/** 1-based step number for deep-linking (/guide?step=<id>). */
export function guideStepIndex(id: string | undefined): number {
  const i = GUIDE_STEPS.findIndex((s) => s.id === id)
  return i === -1 ? 0 : i
}
