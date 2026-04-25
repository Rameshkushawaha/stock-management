import { Component, OnInit } from '@angular/core';
import { InventoryService } from '../../services/inventory.service';
import { ProductWithStock } from '../../models/models';

@Component({ selector:'app-products', templateUrl:'./products.component.html', styleUrls:['./products.component.scss'] })
export class ProductsComponent implements OnInit {
  all: ProductWithStock[] = [];
  filtered: ProductWithStock[] = [];
  search = ''; cat = '';
  categories: string[] = [];

  constructor(private inv: InventoryService) {}
  ngOnInit() {
    this.all = this.inv.getAllWithStock();
    this.filtered = [...this.all];
    this.categories = [...new Set(this.all.map(p=>p.category))].sort();
  }
  filter() {
    this.filtered = this.all.filter(p=>
      (!this.search || p.productName.toLowerCase().includes(this.search.toLowerCase()) || p.barcodeId.toLowerCase().includes(this.search.toLowerCase())) &&
      (!this.cat || p.category === this.cat)
    );
  }
  stockClass(n:number) { return n===0?'empty':n<10?'low':'ok'; }
  stockLabel(n:number) { return n===0?'Out of Stock':n<10?'Low Stock':'In Stock'; }
  fmt(n:number) { return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',minimumFractionDigits:0}).format(n); }
}
