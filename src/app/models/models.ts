// ─── Auth ─────────────────────────────────────────────────────────────────────
export type UserRole = 'admin' | 'stock-adder' | 'seller';

export interface User {
  token(arg0: string, token: any): unknown;
  user: User;
  data: User;
  success: User;
  id: number;
  name: string;
  role: UserRole;
  pin: string;
  avatar: string;
}

// ─── Products ─────────────────────────────────────────────────────────────────
export interface Product {
  productId: number;
  barcodeId: string;
  productName: string;
  category: string;
  unitPrice: number;
  description: string;
}

export interface Inventory {
  inventoryId: number;
  productId: number;
  currentStock: number;
  lastUpdated: string;
}

export interface Transaction {
  transactionId: number;
  productId: number;
  transactionType: 'Inbound' | 'Outbound';
  quantity: number;
  timestamp: string;
  operatorId?: number;
}

export interface ProductWithStock extends Product {
  currentStock: number;
  lastUpdated: string;
}

export interface DemandItem extends ProductWithStock {
  outboundCount: number;
  demandPercent: number;
}

// ─── Receipt ─────────────────────────────────────────────────────────────────
export interface ReceiptItem {
  productName: string;
  barcodeId: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Receipt {
  receiptId: string;
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  total: number;
  timestamp: Date;
  operatorName: string;
  paymentMethod: string;
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
export interface DashboardStats {
  totalProducts: number;
  totalRevenue: number;
  todaySales: number;
  todayRevenue: number;
  lowStockCount: number;
  totalStockUnits: number;
  totalSalesCount: number;
  totalStockValue: number;
}
