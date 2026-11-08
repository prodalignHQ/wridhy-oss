# 💰 MoMoney

> **Take complete control of your personal finances. Private, fast, and built for you.**

MoMoney is a modern, privacy-first personal finance management platform and net worth tracker. It is designed for individuals, families, and freelancers who want complete ownership over their financial life—without monthly subscriptions, privacy-invasive data aggregators, or vendor lock-in.

Whether you want a lightweight single-file desktop application running 100% offline on your laptop, or a self-hosted cloud platform accessible anywhere, MoMoney adapts to your workflow.

---

## 🌟 Key Features

### 📊 1. Unified Financial Command Center
Get an instant, crystal-clear snapshot of your entire financial health the moment you log in.
- **Cash Flow at a Glance**: Track real-time monthly income, expenses, and net savings.
- **Spending Velocity**: See how your current month compares against historical averages before you overspend.
- **Visual Trends**: Beautiful, intuitive charts that illuminate where your money is flowing.

<!-- SCREENSHOT: Main Dashboard overview showing cash flow chart, monthly savings, and recent activity -->

---

### 💳 2. All Your Accounts in One Place
Eliminate the chaos of logging into five different banking portals and credit card apps.
- **Unified Register**: View checking accounts, savings accounts, credit cards, and investment portfolios in a single ledger.
- **Lightning-Fast Search**: Instantly find any transaction by keyword, merchant, category, date range, or amount.
- **Clean Interface**: Visual category badges, account pills, and clear debit/credit indicators.

<!-- SCREENSHOT: Interactive transaction ledger with search filters, category tags, and account indicators -->

---

### 📄 3. Drag-and-Drop Bank Statement Imports
Importing your financial data should take seconds, not hours of copy-pasting into spreadsheets.
- **Format Flexibility**: Drop your monthly bank statements in CSV, Excel (`.xls`, `.xlsx`), or PDF format.
- **Built-in Parsers**: Out-of-the-box support for leading banks (HDFC Savings, HDFC Credit Cards, ICICI Bank, and more).
- **Zero Duplicates**: Smart SHA-256 fingerprinting ensures you can re-import statements without creating duplicate transactions.

<!-- SCREENSHOT: Statement upload interface with drag-and-drop file zone and statement history -->

---

### ⚡ 4. Automated Categorization & Rules Engine
Tired of manually labeling transactions every weekend? Let MoMoney do the tedious work for you.
- **Pattern-Matching Rules**: Create custom rules that automatically detect recurring vendors and assign the right categories.
- **Merchant Normalization**: Cleans cryptic bank descriptions (`POS 491028 SWIGGY BANGALORE IN` $\rightarrow$ `Swiggy`).
- **Priority Ordering**: Fine-tune your rules with priority evaluation so specific conditions always override general rules.

<!-- SCREENSHOT: Rules management screen showing keyword matching conditions and category mapping -->

---

### 👥 5. Multi-Owner Expense Tracking & Splitting
Perfect for couples, roommates, and small business owners managing shared finances.
- **Owner Tagging**: Attribute transactions to specific people (e.g. *Self*, *Partner*, *Kids*, *Business*).
- **Split Transactions**: Split a single bill across multiple owners by exact percentage or fixed dollar amount.
- **Shared vs. Personal Breakdown**: See exactly who spent what, making monthly reimbursements and budgeting painless.

<!-- SCREENSHOT: Split expense modal showing multi-owner percentage allocation -->

---

### 🧾 6. Monthly Invoices & Family Expense Settlement
Real-world finances don't follow rigid calendar boundaries: when you swipe a credit card in August, that money actually leaves your account in September when you clear the bill. MoMoney's Invoicing system solves this by letting you pool and settle your true monthly outflow:
- **Pool Statements into an Invoice**: Aggregate multiple statements (credit cards, checking accounts, household bills) into a single monthly spending invoice representing your actual cash outlay.
- **Categorize & Allocate Owners**: Review all aggregated line items in one place, adjusting categories and assigning who is responsible for each expense.
- **Settle with Family & Friends**: Generate a clean, transparent invoice breaking down each person's exact share, ready to share with family members, partners, or roommates to settle balances effortlessly.

<!-- SCREENSHOT: Monthly Invoice view showing pooled statement items and per-owner settlement breakdown -->

---

### 📈 7. Long-Term Net Worth & Asset Tracking
Building wealth requires seeing the big picture. Track your assets and liabilities over time.
- **Comprehensive Asset Coverage**: Track bank balances, stocks, mutual funds, real estate, gold, and retirement funds (EPF/PPF/401k).
- **Liability Tracking**: Monitor mortgages, car loans, education debt, and credit balances.
- **Monthly Net Worth Snapshots**: Automatically record monthly snapshots to visualize your net worth growth trajectory over months and years.

<!-- SCREENSHOT: Net worth dashboard showing asset vs. liability breakdown and trajectory graph -->

---

### 💡 8. Deep Financial Insights & Analytics
Gain deep clarity on your spending habits with data-driven insights.
- **Category Deep Dives**: Drill into specific categories (e.g. Dining, Subscriptions, Utilities) to see spending patterns.
- **Trajectory Analysis**: Compare your month-over-month savings rate to ensure you stay on track with your financial goals.
- **Smart Budgeting**: Identify unnecessary recurring expenses and leaky subscriptions before they compound.

<!-- SCREENSHOT: Insights page with visual category distribution and monthly spending trends -->

---

### 🔒 9. 100% Data Privacy & Total Freedom
Your financial data is private. It should never be mined, monetized, or shared with third parties.
- **Local-First Architecture**: Run MoMoney as a single self-contained application with an offline SQLite database stored entirely on your computer.
- **Zero Cloud Required**: No third-party data aggregators scraping your bank credentials.
- **Self-Host Anywhere**: When you want cloud access across multiple devices, self-host MoMoney on your own private server using PostgreSQL.

---

## 🚀 Quick Start for Developers & Demo Data

Want to explore the app with rich sample data right away? You can quickly bootstrap a demo database with pre-populated dummy data:

```bash
# Seed a complete demo dataset into your database
pnpm --filter @momoney/db run db:seed-demo
# or from root:
pnpm run db:seed-demo
```

This creates a complete household financial workspace:
- 👤 **Verified Demo Account**: `demo@momoney.io` (password: `password123`)
- 👥 **2 Household Owners**: Husband (`indigo`, default) and Wife (`rose`)
- 🏦 **Accounts & Statements**: HDFC Savings, ICICI Credit Card, and SBI Joint Account across 3 months of statements
- 💳 **70+ Realistic Transactions**: Groceries, dining, rent, utilities, subscriptions, and investments with realistic category tags and multi-owner splits
- 📈 **Net Worth Tracking**: 10 diversified assets, 3 liabilities, and 12 consecutive months of historical snapshots for both members
- 💼 **Salary Growth**: 4 career employers with 11 revisions tracking annual hikes, promotions, CTC, and designations for both members
- 📑 **Income Tax History**: 5 financial years (FY 2020-21 through FY 2024-25) of ITR filings, TDS reconciliation, and income breakdowns

---

## 📚 Documentation & Guides

Explore our dedicated guides for installation, configuration, and customization:

| Guide | Description |
| :--- | :--- |
| 🚀 **[Installation (Non-Developers)](docs/installation-non-dev.md)** | Download the single-file binary and get running in seconds on Mac, Linux, or Windows with zero coding or setup. |
| 🛠️ **[Installation (Developers)](docs/installation-developers.md)** | Step-by-step developer setup: bootstrapping SQLite or PostgreSQL, running development servers, and compiling binaries. |
| ⚙️ **[Configuration Reference](docs/configuration.md)** | Complete reference of all environment variables, database options, authentication settings, and email drivers. |
| 🧩 **[Customization & Developer Guides](docs/customization/index.md)** | Architecture guides, writing custom bank parsers, categorization rules, and essential guidelines for AI agents & contributors. |

---

## 📄 License

MoMoney is open source under the MIT License.
