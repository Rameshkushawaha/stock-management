# StockSys — Inventory Management System v2.0

A full-featured Angular 17 stock management system inspired by the Vaultory UI.

## 🚀 Quick Start

```bash
cd stock-management
npm install
ng serve
# Open http://localhost:4200
```

---

## 🔑 Login Credentials

| Role | Name | PIN | Access |
|------|------|-----|--------|
| **Admin** | Admin User | `1234` | Full access: dashboard, reports, products, scanner |
| **Stock Adder** | Ravi Kumar | `2222` | Scanner (add stock mode only) |
| **Cashier** | Priya Sharma | `3333` | Scanner (sell mode), sales log |

---

## 📱 Scanner Support

### USB / Bluetooth Hardware Scanner
1. Plug in your USB barcode scanner (or pair Bluetooth)
2. Open the Scanner page — the **🟢 SCANNER READY** indicator confirms it's active
3. Aim scanner at barcode — it types + auto-submits (Enter) automatically
4. If focus drifts, tap anywhere on the scan zone to re-activate

### Mobile Camera Scanner
1. Tap **📷 Use Camera** on the scanner page
2. Allow camera permission when prompted
3. Aim rear camera at barcode
4. If auto-detect fails, type barcode in the manual input below the camera

---

## 🧾 Receipt Printing (80mm Thermal Printer)

1. Scan products in **Sell / Cashier** mode
2. Select payment method (Cash / Card / UPI / Other)
3. Tap **Checkout & Print Receipt**
4. The receipt panel slides in showing a thermal-style receipt
5. Tap **Print Receipt** — the browser print dialog opens
6. Select your 80mm thermal printer (set paper width to 80mm, no margins)

---

## 📂 Project Structure

```
src/app/
├── auth/
│   ├── login/              # PIN keypad login page
│   ├── guards/             # Route protection by role
│   └── services/           # Auth service (login, session, permissions)
├── layout/                 # Sidebar + topbar shell
├── pages/
│   ├── dashboard/          # Stats, quick scan, trending
│   ├── scanner/            # Full POS scanner (sell + add modes)
│   ├── products/           # Full product table
│   ├── low-stock/          # Restock report
│   ├── high-demand/        # Sales velocity ranking
│   └── sales-log/          # All outbound transactions
├── components/
│   ├── receipt-panel/      # Slide-in thermal receipt with print CSS
│   └── new-product-modal/  # Register unknown barcodes
├── services/
│   └── inventory.service.ts  # All business logic (swap for API here)
├── models/models.ts          # TypeScript interfaces
└── data/mock-data.json       # Mock data (replace with HTTP calls)
```

---

## 🔌 Replacing JSON with API

All data calls are in `inventory.service.ts`. Steps to migrate:
1. Inject `HttpClient` into the service
2. Replace in-memory arrays with `this.http.get<T>(url)` calls
3. Make methods return `Observable<T>` instead of plain values
4. Components subscribe (or use `async` pipe)

### Recommended API endpoints
```
POST   /api/auth/login
GET    /api/products
GET    /api/products/barcode/:id
POST   /api/products
GET    /api/inventory
PATCH  /api/inventory/:productId
POST   /api/transactions
GET    /api/reports/demand?days=30
GET    /api/reports/low-stock?threshold=10
GET    /api/reports/sales?limit=50
```

---

## 🎨 Design Tokens (`styles.scss`)

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-base` | `#08090d` | Page background |
| `--bg-sidebar` | `#0f1117` | Sidebar, modals |
| `--bg-card` | `#13151f` | Cards, tables |
| `--border` | `rgba(255,255,255,0.08)` | Dividers |
| `--accent` | `#3b82f6` | Blue — primary actions |
| `--success` | `#22c55e` | In stock, inbound |
| `--danger` | `#ef4444` | Out of stock, errors |
| `--warning` | `#eab308` | Low stock |
