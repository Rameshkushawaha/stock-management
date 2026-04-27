import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { InventoryService } from '../../services/inventory.service';
import { AuthService } from '../../auth/services/auth.service';
import { DashboardStats, DemandItem } from '../../models/models';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  stats!: DashboardStats;
  recentSales: any[] = [];
  trending: DemandItem[] = [];
  quickScanBarcode = '';
  quickScanMode: 'sell' | 'add' = 'sell';
  scanMessage = '';
  scanError = '';
  constructor(
    private inventory: InventoryService,
    public auth: AuthService,
    private router: Router
  ) { }


  ngOnInit() {
    this.loadStats();
    // this.recentSales = this.inventory.getRecentSales();
    this.inventory.getRecentSales().subscribe({
      next: (sales: any[]) => {
        this.recentSales = sales;
      },
      error: (err: any) => {
        console.error('Error fetching recent sales', err);
      }
    });
    this.loadTrending();
  }

  // Helper to sum quantities of items in a single sale
  getTotalQty(items: any[]): number {
    return items ? items.reduce((sum, item) => sum + item.qty, 0) : 0;
  }

  loadStats() {
    this.inventory.getDashboardStats().subscribe({
      next: (data: DashboardStats) => {
        this.stats = data;
      },
      error: (err: any) => {
        console.error('Error fetching dashboard stats', err);
      }
    });
  }

  loadTrending() {
    this.inventory.getDemandReport(30).subscribe({
      next: (data: DemandItem[]) => {
        this.trending = data;
      },
      error: (err: any) => {
        console.error('Error fetching trending products', err);
      }
    });
  }
  quickScan(): void {
    const bc = this.quickScanBarcode.trim();
    if (!bc) return;
    if (this.quickScanMode === 'sell') {
      const res = this.inventory.addToCart(bc);
      if ('error' in res) { this.scanError = res.error; this.scanMessage = ''; }
      else { this.scanMessage = `Added ${res.item.productName} to cart`; this.scanError = ''; }
    } else {
      const res = this.inventory.processInbound(bc);
      if (!res) { this.scanError = 'Product not found'; this.scanMessage = ''; }
      else { this.scanMessage = `Stock updated: ${res.product.productName}`; this.scanError = ''; }
    }
    this.quickScanBarcode = '';
    setTimeout(() => { this.scanMessage = ''; this.scanError = ''; }, 3000);
  }

  goToScanner(): void {
    this.router.navigate([this.quickScanMode === 'sell' ? '/scanner/sell' : '/scanner/add']);
  }

  get formattedRevenue(): string {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(this.stats.totalRevenue);
  }

  get formattedTodayRevenue(): string {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(this.stats.todayRevenue);
  }
}
