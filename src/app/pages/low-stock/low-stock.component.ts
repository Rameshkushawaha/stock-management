import { Component, OnInit } from '@angular/core';
import { InventoryService } from '../../services/inventory.service';
import { ProductWithStock } from '../../models/models';

@Component({ selector:'app-low-stock', templateUrl:'./low-stock.component.html', styleUrls:['./low-stock.component.scss'] })
export class LowStockComponent implements OnInit {
  items: ProductWithStock[] = [];
  constructor(private inv: InventoryService) {}
  ngOnInit() { this.items = this.inv.getLowStock(10).sort((a,b)=>a.currentStock-b.currentStock); }
  urgency(n:number) { return n===0?'critical':n<=5?'high':'medium'; }
  urgencyLabel(n:number) { return n===0?'OUT OF STOCK':n<=5?'CRITICAL':'LOW'; }
  suggested(n:number) { return Math.max(50-n,20); }
  fmt(n:number) { return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',minimumFractionDigits:0}).format(n); }
}
