# Personal Finance Platform — Product Requirements Document (PRD)

Version: v1.0

Status: Draft

Document Owner: Product Team

# 1. Product Overview

## Vision

Build a privacy-first personal finance platform that enables users to:

* Import bank and credit card statements
* Automatically categorize financial transactions
* Analyze spending patterns
* Assign owners to transactions
* Track net worth growth over time
* Maintain full ownership and portability of financial data

The system will initially be delivered as a web application, but the backend must be API-first to support future mobile applications.

The platform will prioritize user privacy, meaning financial data is not stored by default unless users explicitly opt-in.

# 2. Core Value Proposition

Most personal finance applications suffer from one or more of the following issues:

* Require manual expense entry
* Poor categorization accuracy
* Limited long-term analytics
* Limited data portability
* Lack of privacy guarantees

This platform solves these issues by providing:

* Automated transaction ingestion
* Intelligent categorization
* Powerful analytics
* Local data control
* Optional cloud persistence

# 3. Product Goals

Primary goals:

* Reduce friction in financial tracking
* Automatically categorize transactions
* Provide clear spending insights
* Allow ownership attribution for transactions
* Track long-term financial growth
* Allow full data portability
* Support both privacy-focused and cloud users

# 4. Non-Goals (Initial Version)

The following are out of scope for the initial release:

* Direct bank API integrations
* Bill payments
* Tax preparation
* Investment trading
* Financial advisory services

# 5. Target Users
## Primary Users

* Individuals who want to understand their spending patterns without manually logging every expense.

## Secondary Users

* Couples
* Families
* Privacy-focused users
* Personal finance enthusiasts

# 6. Operating Modes

The platform supports three operating modes.

## 6.1 Session Mode (Default Hosted Mode)

Financial data is not stored on the server by default.

Characteristics:

* Transactions exist only in browser memory or local browser storage
* Backend database does not store financial records
* Insights are computed locally
* Data disappears when session ends unless exported

Export options:

* SQLite
* CSV
* JSON

This mode maximizes privacy and user control.

## 6.2 Persistent Cloud Storage (Opt-In)

Users may explicitly allow the platform to store financial data.

Capabilities enabled:

* Cross-device access
* Persistent analytics
* Long-term insights
* Automatic backups

Users must explicitly approve:

* Allow this platform to securely store my financial data.
* Users may disable persistence at any time.

## 6.3 Local SQLite Mode

Users may run the platform using a local SQLite database file.

Capabilities:

* Fully offline operation
* Statement uploads
* Transaction categorization
* Analytics dashboards
* Net worth tracking

Supported actions:

* Import SQLite file
* Export SQLite file
* Download backups

The SQLite schema mirrors the cloud schema.

# 7. Data Portability

Users must be able to move data between modes.

Supported migrations:

* Session → SQLite
* SQLite → Cloud
* Cloud → SQLite

Supported export formats:

* SQLite
* CSV
* JSON

# 8. User Authentication

Authentication is required only for cloud mode.

Capabilities:

* Signup
* Login
* Logout
* Password reset

Future additions:

* Google login
* Apple login

# 9. Financial Accounts

Users can create financial accounts.

Examples:

* Bank accounts
* Credit cards
* Wallets
* Investment accounts

Account Data Model

Fields:

* id
* user_id
* account_name
* account_type
* bank_name
* currency
* created_at

Account types:

* bank
* credit_card
* wallet
* investment

# 10. Statement Upload

Users upload statements to import transactions.

Supported formats:

* PDF
* CSV

Upload Flow

* User uploads statement
* System parses transactions
* Preview shown
* User confirms import

# 11. Transaction Parsing

The system extracts structured data from uploaded statements.

Extracted fields:

* transaction_date
* description
* amount
* debit_credit
* account
* merchant

# 12. Transaction Normalization

Banks use inconsistent transaction descriptions.

Example:

AMZN Mktp IN
Amazon Marketplace
AMAZON PAY INDIA

Normalized merchant:

Amazon

Normalization improves categorization accuracy.

# 13. Automatic Categorization

Transactions are categorized automatically.

Example categories:

* Food & Dining
* Groceries
* Shopping
* Travel
* Transport
* Subscriptions
* Utilities
* Healthcare
* Entertainment
* Rent
* Investment
* Transfers
* Income

Categorization methods:

* Merchant dictionary
* Pattern matching
* User rules
* Machine learning (future)

# 14. Categorization Rules Engine

Users may define automation rules.

Example rules:

If merchant contains "uber" → category = Transport
If description contains "salary" → category = Income

Rules improve categorization accuracy over time.

Rules Data Model

Fields:

* id
* user_id
* match_pattern
* category_id
* priority

# 15. Manual Categorization

Users may override automatic categories.

Example:

Amazon → Groceries
Amazon → Electronics
Amazon → Shopping

Overrides create new rules.

# 16. Transaction Dashboard

Users can view all transactions.

Capabilities:

* Search
* Filters
* Category editing
* Merchant editing
* Bulk categorization
* Owner assignment
* Tagging

# 17. Transaction Owners

Each transaction may have one or many owners assigned.

Examples:

* Self
* Partner
* Household
* Roommate
* Child

Transactions can also be split.

Example:

₹4,000 dinner

* Alex: 50%
* Sam: 50%

## Owner Data Model

Fields:

* id
* user_id
* name
* type

Owner types:

* person
* shared
* household

## Transaction Owner Mapping

Fields:

* transaction_id
* owner_id
* amount
* percentage

# 18. Monthly Spend Dashboard

Primary metrics:

* Total spend
* Category breakdown
* Spend change vs previous month
* Top merchants

Visualizations:

* Category chart
* Spend timeline
* Merchant leaderboard

# 19. Historical Insights

Users can analyze spending across time.

Supported ranges:

* Monthly
* Yearly
* Last 12 months
* Last X years
* Custom range

Insights include:

* Category trends
* Merchant trends
* Owner comparisons
* Spending growth

# 20. Category Analytics

Detailed category view.

Example:

Food & Dining

Total spend: ₹12,400
Transactions: 42

Top merchants:

Zomato

Swiggy

Starbucks

21. Merchant Insights

Example merchant analytics:

Amazon

Total spend: ₹1,24,000
Transactions: 63

Categories:

* Shopping
* Electronics
* Groceries

# 22. Net Worth Growth Tracking

The system tracks net worth growth over time.

Net worth formula:

Net Worth = Total Assets − Total Liabilities

## 22.1 Net Worth Monthly Entry

Users can manually enter values.

Example table:

```markdown
| Month | Assets | Liabilities | Net Worth |
| :--- | :--- | :--- | :--- |
| Jan 2025 | ₹10,00,000 | ₹4,00,000 | ₹6,00,000 |
| Feb 2025 | ₹10,50,000 | ₹3,90,000 | ₹6,60,000 |
| Mar 2025 | ₹11,20,000 | ₹3,80,000 | ₹7,40,000 |
```

## 22.2 Net Worth Timeline Visualization

Users can view:

* Monthly growth
* Yearly growth
* Long-term trends

## 22.3 Net Worth Data Model

Fields:

* id
* user_id
* date
* total_assets
* total_liabilities
* net_worth
* notes
* created_at

# 23. Optional Asset Tracking

Users may track individual assets.

Examples:

* bank balances
* investments
* mutual funds
* stocks
* crypto
* real estate
* cash

## Fields:

* id
* user_id
* asset_name
* asset_type
* value
* currency
* valuation_date

## Asset types:

* bank_account
* investment
* real_estate
* crypto
* cash
* other

# 24. Liability Tracking

Users may track liabilities.

Examples:

* credit cards
* home loans
* car loans
* student loans
* personal loans

## Fields:

* id
* user_id
* liability_name
* liability_type
* outstanding_amount
* interest_rate
* monthly_payment
* last_updated

# 25. API Design

Backend APIs support future mobile apps.

## Authentication

* POST /auth/signup
* POST /auth/login
* POST /auth/logout

## Statements

* POST /statements/upload
* GET /statements
* GET /statements/{id}

## Transactions

* GET /transactions
* PATCH /transactions/{id}
* PATCH /transactions/{id}/category

## Categories

* GET /categories

## Insights

* GET /insights/monthly
* GET /insights/yearly
* GET /insights/categories
* GET /insights/merchants
* GET /insights/owners

## Net Worth

* GET /networth
* GET /networth/history
* POST /networth

# 26. Non-Functional Requirements
## Performance

System must support:

* 100k+ transactions per user
* analytics queries under 1 second

## Security

Requirements:

* encrypted storage (when persistence enabled)
* secure authentication
* strict user data isolation

## Scalability

Target scale:

* 1M users
* 10M+ transactions

# 27. Privacy Principles

The system follows privacy-first design.

Rules:

* financial data not stored by default
* users must explicitly opt-in to persistence
* users can export data anytime
* users can delete stored data anytime

# 28. Future Roadmap

Future capabilities may include:

* bank API integrations
* budgeting tools
* savings rate tracking
* subscription detection
* financial goal tracking
* AI insights
* investment analytics
* mobile apps

# 29. Open Questions

Key architectural questions remaining:

> Should PDF parsing support any bank or specific templates first? 

No, we can just mandate Excel and CSV.

> Should merchant recognition rely primarily on rules or ML models?

Rules

> Should recurring transactions be automatically detected?

No.

> Should transactions support tags in addition to categories?

A comment field should be present

> Should income tracking be included in MVP?

Yes, depending on bank account statement.