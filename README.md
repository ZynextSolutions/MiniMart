# Mini Mart ERP / POS

Production-ready cloud-native Retail ERP and Point-of-Sale system.

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and set your PostgreSQL credentials (use `127.0.0.1` on Mac, not `localhost`):

```env
DATABASE_URL=
DIRECT_URL=
AUTH_SECRET=
AUTH_URL="http://localhost:3000"
```

Generate `AUTH_SECRET`:

```bash
openssl rand -base64 32
```

### 3. Database setup

```bash
npx prisma migrate dev --name init
npm run db:seed
```

### 4. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

**Default login:** `admin@minimart.com` / `Admin@123`

## Phase 1 — Foundation (Complete)

- Next.js 15 + React 19 + TypeScript strict
- Prisma schema (40+ models) + seed data
- NextAuth v5 credentials authentication
- RBAC with 6 system roles, 70+ permissions
- App shell: sidebar, header, breadcrumbs, branch switcher, dark mode
- User management CRUD
- Role management CRUD
- Company settings
- Audit logs
- Audit service on all mutations

## Phase 2 — Master Data (Complete)

- Categories (parent/child tree), Brands, Units
- Products: SKU, pricing, barcode auto-generate, default variant, image URL
- Suppliers (`SUP-*`) & Customers (`CUS-*`) with search/pagination
- Tax rates, Branches, Warehouses
- Product search API: `GET /api/v1/products/search?q=`

## Phase 3 — Inventory (Complete)

- Stock overview with KPIs, valuation, low-stock badges
- Stock In (batch/expiry), Stock Out, Adjustments (reason codes)
- Warehouse transfers (two-step OUT + IN)
- Stock count with variance adjustment on complete
- Inventory ledger with filters
- FIFO + Weighted Average costing engine
- Low stock & expiry notifications
- Stock level initialization per warehouse

## Phase 4 — POS (Complete)

- POS terminal: product grid, cart, touch-friendly layout
- Zustand cart store with line/order discounts
- USB barcode scanner (keyboard wedge) + camera scanner (html5-qrcode)
- Product search with keyboard shortcuts (F1–F9, Ctrl+N/P)
- Payment dialog: cash, card, QR, bank transfer, credit, mixed
- Hold / resume sales
- Complete sale → stock deduction + auto journal posting
- Customer selection + loyalty points on sale
- Coupon validation
- Return / refund with stock restock + reversing journal
- Cash register open/close session
- Receipt HTML preview + reprint
- `/cash-register` session summary page

## Phase 5 — Purchasing (Complete)

- Purchase Request workflow: create → submit → approve → convert to PO
- Purchase Order workflow: create → submit → approve → receive
- Goods Receiving (with or without PO) → stock increase via PURCHASE movement
- Supplier Invoice → AP journal (DR Inventory + Tax, CR AP)
- Supplier payment recording (DR AP, CR Cash/Bank)
- Supplier Return → stock out + ledger credit
- Supplier ledger auto-update on invoice/payment/return
- Outstanding payables view
- Pages: `/purchasing/requests`, `/orders`, `/receiving`, `/invoices`, `/payables`, `/returns`

## Phase 6 — Accounting (Complete)

- Chart of Accounts tree view with parent hierarchy + CRUD
- Manual journal entries with approval workflow (PENDING → COMPLETED)
- Journal void via reversing entries
- General Ledger with account filter and date range
- Financial reports: Trial Balance, Balance Sheet, P&L, Cash Flow
- AR/AP aging reports from customer/supplier ledgers
- Expense & income recording with auto journal posting
- Bank account management, transactions, and reconciliation
- Fiscal year creation, monthly periods, period close (trial balance check)
- Petty cash fund tracking and expense recording
- Extended `AccountingEngine` with report methods + expense/income posting
- Pages: `/accounting/chart-of-accounts`, `/journal`, `/general-ledger`, `/trial-balance`, `/balance-sheet`, `/profit-loss`, `/cash-flow`, `/receivables`, `/payables`, `/expenses`, `/income`, `/bank`, `/fiscal-year`, `/petty-cash`

## Phase 7 — Reports (Complete)

- Sales reports: daily, by product, category, cashier, payment method
- Purchase reports: PO summary by supplier, GRN totals
- Inventory reports: stock on hand, valuation, movement history
- Profit analysis: margin by product with COGS
- Product analysis: best selling, slow moving, dead stock
- Customer & supplier statements from ledger
- Tax report: output VAT vs input VAT
- PDF export (pdf-lib) and Excel export (ExcelJS) via `/api/v1/reports/export`
- Date range + branch filters on all transactional reports
- Pages: `/reports/sales`, `/purchases`, `/inventory`, `/profit`, `/customer-statement`, `/supplier-statement`, `/tax`

## Phase 8 — Barcode & Thermal Printing (Complete)

- Code128, EAN13 (with check digit), and QR code generation
- Label designer with templates: 40×30mm thermal, A4 3×8, A4 4×10
- Browser print for barcode labels
- ESC/POS receipt builder (58mm / 80mm) with QR verification URL
- Thermal printing: browser print, ESC/POS download, Web Serial API
- Cash drawer kick command (ESC p)
- Company logo on HTML receipts; ESC/POS bitmap support (client-side)
- Pages: `/barcode` — label designer & barcode generator
- API: `/api/v1/receipt/escpos`, `/api/v1/barcode/qr`

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, React 19, Tailwind, shadcn/ui |
| State | TanStack Query, Zustand (POS in Phase 4) |
| Backend | Server Actions, Route Handlers |
| Database | PostgreSQL (Neon) + Prisma |
| Auth | NextAuth v5 |

## Project Structure

```
src/
├── app/              # Next.js App Router
├── components/       # Shared UI
├── features/         # Feature modules (auth, users, roles, settings)
├── infrastructure/   # Prisma, external services
└── lib/              # Auth, permissions, services, utils
```

## Documentation

See [`docs/`](./docs/) for full architecture and design.

Production deployment: [`docs/deployment.md`](./docs/deployment.md)

