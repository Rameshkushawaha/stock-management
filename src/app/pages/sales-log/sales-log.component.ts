import { Component, OnInit } from '@angular/core';
import { InventoryService } from '../../services/inventory.service';

@Component({ selector:'app-sales-log', templateUrl:'./sales-log.component.html', styleUrls:['./sales-log.component.scss'] })
export class SalesLogComponent implements OnInit {
  sales: any[] = [];
  constructor(private inv: InventoryService) {}
  // ngOnInit() { this.inv.getRecentSales(50).subscribe((sales) => this.sales = sales); }
  // // ngOnInit(): void {
  // //   this.sales = this.inv.getRecentSales(20);
  // // }
  salesLog: any[] = [];

ngOnInit() {
  this.inv.getRecentSales(50).subscribe((sales: any[]) => {
    const flattened: any[] = [];
    
    sales.forEach(sale => {
      sale.items.forEach((item: any) => {
        flattened.push({
          invoiceNo: sale.invoiceNo,
          productName: item.productName,
          barcode: item.barcode || 'N/A', // Add barcode if available in API
          qty: item.qty,
          unitPrice: item.rate,
          lineTotal: item.lineTotal,
          date: sale.saleDate,
          paymentMode: sale.paymentMode,
          customer: sale.customer?.name || 'Walk-in'
        });
      });
    });
    
    this.salesLog = flattened;
  });
}
  fmt(n:number) { return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',minimumFractionDigits:0}).format(n); }
}
