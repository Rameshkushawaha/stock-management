import { Injectable } from '@angular/core';
import { BehaviorSubject, map, Observable } from 'rxjs';
import {
  Product, Inventory, Transaction, ProductWithStock, DemandItem,
  Receipt, ReceiptItem, DashboardStats
} from '../models/models';
import mockData from '../data/mock-data.json';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../environment/environment';

@Injectable({ providedIn: 'root' })
export class InventoryService {

  private products: Product[] = mockData.products as Product[];
  private inventory: Inventory[] = mockData.inventory as Inventory[];
  private transactions: Transaction[] = mockData.transactions as Transaction[];

  // Active cart for receipt building (seller session)
  private cartSubject = new BehaviorSubject<ReceiptItem[]>([]);
  cart$ = this.cartSubject.asObservable();
  get cart(): ReceiptItem[] { return this.cartSubject.value; }

  // ─── Products ────────────────────────────────────────────────────────────────
  getProductByBarcode(barcodeId: string): Product | undefined {
    return this.products.find(p => p.barcodeId.toLowerCase() === barcodeId.toLowerCase());
  }
  getProductById(id: number): Product | undefined {
    return this.products.find(p => p.productId === id);
  }
  getAllProducts(): Product[] { return [...this.products]; }

  addProduct(p: Omit<Product, 'productId'>): Product {
    const newId = Math.max(...this.products.map(x => x.productId)) + 1;
    const product = { ...p, productId: newId };
    this.products.push(product);
    return product;
  }

  getProducts(): Observable<any[]> {
    const token = sessionStorage.getItem('stocksys_token');
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

    return this.http.get<any>(`${this.API_URL}products`, { headers }).pipe(
      map(response => {
        if (response.success && response.data) {
          // Returning the data array directly to the component
          return response.data;
        }
        return [];
      })
    );
  }

  // ─── Inventory ───────────────────────────────────────────────────────────────
  getInventory(productId: number): Inventory | undefined {
    return this.inventory.find(i => i.productId === productId);
  }

  getAllWithStock(): ProductWithStock[] {
    return this.products.map(p => {
      const inv = this.getInventory(p.productId);
      return { ...p, currentStock: inv?.currentStock ?? 0, lastUpdated: inv?.lastUpdated ?? '' };
    });
  }

  getLowStock(threshold = 10): ProductWithStock[] {
    return this.getAllWithStock().filter(p => p.currentStock < threshold);
  }

  private updateStock(productId: number, delta: number): void {
    const inv = this.inventory.find(i => i.productId === productId);
    if (inv) {
      inv.currentStock = Math.max(0, inv.currentStock + delta);
      inv.lastUpdated = new Date().toISOString();
    }
  }

  addInventoryEntry(productId: number, qty: number): Inventory {
    const newId = Math.max(...this.inventory.map(i => i.inventoryId)) + 1;
    const entry: Inventory = { inventoryId: newId, productId, currentStock: qty, lastUpdated: new Date().toISOString() };
    this.inventory.push(entry);
    return entry;
  }

  // ─── Transactions ────────────────────────────────────────────────────────────
  getAllTransactions(): Transaction[] { return [...this.transactions].reverse(); }

  logTransaction(productId: number, type: 'Inbound' | 'Outbound', qty: number, operatorId?: number): Transaction {
    const newId = Math.max(...this.transactions.map(t => t.transactionId)) + 1;
    const tx: Transaction = { transactionId: newId, productId, transactionType: type, quantity: qty, timestamp: new Date().toISOString(), operatorId };
    this.transactions.push(tx);
    return tx;
  }

  // ─── Inbound ─────────────────────────────────────────────────────────────────
  processInbound(barcodeId: string, operatorId?: number): { product: Product; currentStock: number } | null {
    const product = this.getProductByBarcode(barcodeId);
    if (!product) return null;
    this.updateStock(product.productId, 1);
    this.logTransaction(product.productId, 'Inbound', 1, operatorId);
    return { product, currentStock: this.getInventory(product.productId)?.currentStock ?? 0 };
  }

  registerNewProduct(data: Omit<Product, 'productId'>, qty: number, operatorId?: number): { product: Product; currentStock: number } {
    const product = this.addProduct(data);
    this.addInventoryEntry(product.productId, qty);
    this.logTransaction(product.productId, 'Inbound', qty, operatorId);
    return { product, currentStock: qty };
  }

  // ─── Cart / Outbound ─────────────────────────────────────────────────────────
  addToCart(barcodeId: string): { item: ReceiptItem; isLowStock: boolean } | { error: string } {
    const product = this.getProductByBarcode(barcodeId);
    if (!product) return { error: 'Product not found: ' + barcodeId };
    const inv = this.getInventory(product.productId);
    if (!inv || inv.currentStock <= 0) return { error: 'Out of stock: ' + product.productName };

    const cart = [...this.cart];
    const existing = cart.find(i => i.barcodeId === product.barcodeId);
    if (existing) {
      existing.quantity += 1;
      existing.total = existing.quantity * existing.unitPrice;
    } else {
      cart.push({ productName: product.productName, barcodeId: product.barcodeId, quantity: 1, unitPrice: product.unitPrice, total: product.unitPrice });
    }
    this.cartSubject.next(cart);

    this.updateStock(product.productId, -1);
    this.logTransaction(product.productId, 'Outbound', 1);
    const isLowStock = (inv.currentStock - 1) < 10;
    return { item: cart.find(i => i.barcodeId === product.barcodeId)!, isLowStock };
  }

  removeFromCart(barcodeId: string): void {
    const cart = this.cart.filter(i => i.barcodeId !== barcodeId);
    // restore stock for removed items
    const removed = this.cart.find(i => i.barcodeId === barcodeId);
    if (removed) {
      this.updateStock(this.getProductByBarcode(barcodeId)?.productId ?? -1, removed.quantity);
    }
    this.cartSubject.next(cart);
  }

  clearCart(): void { this.cartSubject.next([]); }

  buildReceipt(operatorName: string, paymentMethod: string): Receipt {
    const items = [...this.cart];
    const subtotal = items.reduce((s, i) => s + i.total, 0);
    const tax = Math.round(subtotal * 0.18);
    const total = subtotal + tax;
    const receipt: Receipt = {
      receiptId: 'RCP-' + Date.now(),
      items, subtotal, tax, total,
      timestamp: new Date(),
      operatorName,
      paymentMethod
    };
    this.clearCart();
    return receipt;
  }

  private readonly API_URL = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getDashboardStats(): Observable<any> {
    const token = sessionStorage.getItem('stocksys_token');
  const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
  console.log('Fetching dashboard stats with token:', token,headers);
    // Calling the stats endpoint
    const url = `${this.API_URL}reports/dashboard?shopId=1`;
  return this.http.get<any>(url, { headers }).pipe(
      map((response: { success: any; data: { totalProducts: any; overall: { revenue: any; sales: any; }; today: { sales: any; revenue: any; }; lowStockCount: any; totalStockUnits: any; totalStockValue: any; }; }) => {
        if (response.success) {
          // Unwrapping the 'data' object so the component gets the clean stats
          return {
            totalProducts: response.data.totalProducts,
            totalRevenue: response.data.overall.revenue,
            todaySales: response.data.today.sales,
            todayRevenue: response.data.today.revenue,
            lowStockCount: response.data.lowStockCount,
            totalStockUnits: response.data.totalStockUnits,
            totalSalesCount: response.data.overall.sales,
            // Assuming totalStockValue isn't in your JSON, 
            // you can add it to the backend or keep it 0 for now
            totalStockValue: response.data.totalStockValue || 0 
          };
        }
        return null;
      })
    );
  }
 
  getRecentSales(limit: number = 20): Observable<any[]> {
  const token = sessionStorage.getItem('stocksys_token');
  const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
  
  // Update the URL to your sales/reports endpoint
  const url = `${this.API_URL}sales`;

  return this.http.get<any>(url, { headers }).pipe(
    map(response => {
      if (response.success && response.data?.data) {
        // We return the array of sales directly
        return response.data.data;
      }
      return [];
    })
  );
}

getDemandReport(days: number = 30): Observable<DemandItem[]> {
  const token = sessionStorage.getItem('stocksys_token');
  const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
  
  // Update the URL to your demand report endpoint
  const url = `${this.API_URL}reports/demand?days=${days}`;

  return this.http.get<any>(url, { headers }).pipe(
    map(response => {
      if (response.success && response.data) {
        // Assuming the backend returns an array of demand items in response.data
        return response.data as DemandItem[];
      }
      return [];
    })
  );
  
}
}

