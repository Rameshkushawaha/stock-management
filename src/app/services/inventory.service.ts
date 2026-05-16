import { Injectable } from '@angular/core';
import { BehaviorSubject, map, Observable } from 'rxjs';
import {
  Product, Inventory, Transaction, ProductWithStock, DemandItem,
  Receipt, ReceiptItem, DashboardStats
} from '../models/models';
import mockData from '../data/mock-data.json';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
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

  registerNewProduct(productData: any): Observable<any> {
  const token = sessionStorage.getItem('stocksys_token');
  const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
  const url = `${this.API_URL}products/addProduct`;

  return this.http.post<any>(url, productData, { headers }).pipe(
    map(response => {
      if (response.success) {
        return response.data; // This returns the full object you saw in Postman
      }
      throw new Error(response.message || 'Registration failed');
    })
  );
}

  // ─── Cart / Outbound ─────────────────────────────────────────────────────────
  addToCart1(barcodeId: string): { item: ReceiptItem; isLowStock: boolean } | { error: string } {
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

  // addto cart with API call
  addToCart(barcodeId: string): Observable<{ item: ReceiptItem; isLowStock: boolean } | { error: string }> {
    
    const token = sessionStorage.getItem('stocksys_token');
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    const url = `${this.API_URL}sales/outbounditem?barcode=${barcodeId}&qty=1`;

    return this.http.post<any>(url, {}, { headers }).pipe(
      map(response => {
        if (response.success) {
          const inv = this.getInventory(response.data.product.id);
          const cart = [...this.cart];
          const existing = cart.find(i => i.barcodeId === response.data.product.barcode);
          if (existing) {
            existing.quantity += 1;
            existing.total = existing.quantity * existing.unitPrice;
          } else {
            const unitPrice = Number(response.data.batch.sellingPrice );
            cart.push({ productName: response.data.product.name, barcodeId: response.data.product.barcode, quantity: 1, unitPrice: response.data.batch.sellingPrice, total: response.data.batch.sellingPrice });
          }
          this.cartSubject.next(cart);
          const isLowStock = inv ? (inv.currentStock - 1) < 10 : false;
          return { item: cart.find(i => i.barcodeId === response.data.product.barcode)!, isLowStock };
        }
        return { error: response || 'Failed to add to cart' };
      })
    );
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

  // checkout with API call
  checkout(operatorName: string, paymentMethod: string): Observable<Receipt> {
  const token = sessionStorage.getItem('stocksys_token');
  const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
  const url = `${this.API_URL}sales/checkout`;
  
  // Align payload keys with your backend (barcodeId vs barcode)
  const payload = { 
    items: this.cart.map(i => ({ barcodeId: i.barcodeId, quantity: i.quantity })), 
    paymentMode: paymentMethod 
  };

  return this.http.post<any>(url, payload, { headers }).pipe(
    map(response => {
      if (response.success) {
        const d = response.data; // Alias for cleaner mapping
        
        const receipt: Receipt = {
          receiptId: d.invoiceNo, // API uses invoiceNo
          items: d.items.map((i: any) => ({
            productName: i.productName,
            barcodeId: i.barcodeSnapshot, // API uses barcodeSnapshot
            quantity: i.qty,              // API uses qty
            unitPrice: Number(i.rate),    // API uses rate (string)
            total: Number(i.lineTotal)    // API uses lineTotal (string)
          })),
          subtotal: Number(d.subtotal),
          tax: Number(d.taxAmount),       // API uses taxAmount
          total: Number(d.grandTotal),    // API uses grandTotal
          timestamp: new Date(d.saleDate), // API uses saleDate
          operatorName: d.operator?.name || operatorName,
          paymentMethod: d.paymentMode     // API uses paymentMode
        };
        
        this.clearCart();
        return receipt;
      }
      throw new Error(response.error || 'Checkout failed');
    })
  );
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

processInbond(barcodeId: string): Observable<any> {
  const token = sessionStorage.getItem('stocksys_token');
  const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

  // Create formal HttpParams
  const queryParams = new HttpParams()
    .set('barcode', barcodeId)
    .set('qty', '1');

  const url = `${this.API_URL}products/addStock`;

  // Second argument is the BODY (empty {}), third argument is the OPTIONS (params)
 return this.http.post<any>(url, {}, { headers, params: queryParams }).pipe(
    map(response => {
      // Check for the 'success' flag from your backend JSON
      if (response) {
        return response
         
      }
      return { error: response.message || 'Failed to process inbound' };
    })
  );
}

// 1. New API for adding a fresh batch
addNewBatch(payload: any): Observable<any> {
  const token = sessionStorage.getItem('stocksys_token');
  const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
  return this.http.post<any>(`${this.API_URL}products/addNewBatchStock`, payload, { headers });
}

getCategoryList(): Observable<any[]> {
  const token = sessionStorage.getItem('stocksys_token');
  const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
  const url = `${this.API_URL}products/categories`;
  return this.http.get<any>(url, { headers }).pipe(
    map(response => {
      if (response.success) {
        return response.data; // Assuming data is the array of categories
      }
      return [];
    })
  );
}

getBrandList(): Observable<any[]> {
  const token = sessionStorage.getItem('stocksys_token');
  const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
  const url = `${this.API_URL}products/brands`;
  return this.http.get<any>(url, { headers }).pipe(
    map(response => {
      if (response.success) {
        return response.data; // Assuming data is the array of brands
      }
      return [];
    })
  );

}

getUnitList(): Observable<any[]> {
  const token = sessionStorage.getItem('stocksys_token');
  const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
  const url = `${this.API_URL}products/units`;
  return this.http.get<any>(url, { headers }).pipe(
    map(response => {
      if (response.success) {
        return response.data; // Assuming data is the array of units
      }
      return [];
    })
  );
}

}

