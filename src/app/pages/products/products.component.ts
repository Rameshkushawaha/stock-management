import { Component, OnInit } from '@angular/core';
import { InventoryService } from '../../services/inventory.service';
import { ProductWithStock } from '../../models/models';

@Component({ selector: 'app-products', templateUrl: './products.component.html', styleUrls: ['./products.component.scss'] })
export class ProductsComponent implements OnInit {


  products: any[] = [];
  filtered: any[] = [];
  categories: string[] = [];
  search: string = '';
  cat: string = '';
  constructor(private inv: InventoryService) { }
  ngOnInit() {
    this.getProducts();
   
  }

getProducts() {
  this.inv.getProducts().subscribe({
    next: (data) => {
      // data is response.data from your API
      this.products = data;
      this.filtered = data; 
      
      // Ensure categories are pulled correctly
      this.categories = [...new Set(data.map((p: any) => p.category.name))];
      
      console.log('Products loaded into component:', this.products);
    }
  });
}

  filter() {
    this.filtered = this.products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(this.search.toLowerCase()) ||
        p.barcode.toLowerCase().includes(this.search.toLowerCase());
      const matchesCat = this.cat === '' || p.category.name === this.cat;
      return matchesSearch && matchesCat;
    });
  }

  // Helper to get price from the first batch
  getPrice(p: any) {
    return p.stockBatches?.[0]?.sellingPrice || 0;
  }

  stockClass(p: any) {
    if (p.currentStock <= 0) return 'out';
    if (p.isLowStock) return 'low';
    return 'in';
  }

  stockLabel(p: any) {
    if (p.currentStock <= 0) return 'Out of Stock';
    if (p.isLowStock) return 'Low Stock';
    return 'In Stock';
  }

  fmt(val: any) {
    return '₹' + Number(val).toLocaleString('en-IN');
  }

  // ngOnInit() {
  //   this.all = this.inv.getAllWithStock();
  //   this.filtered = [...this.all];
  //   this.categories = [...new Set(this.all.map(p=>p.category))].sort();
  // }
  // filter() {
  //   this.filtered = this.all.filter(p=>
  //     (!this.search || p.productName.toLowerCase().includes(this.search.toLowerCase()) || p.barcodeId.toLowerCase().includes(this.search.toLowerCase())) &&
  //     (!this.cat || p.category === this.cat)
  //   );
  // }
  // stockClass(n:number) { return n===0?'empty':n<10?'low':'ok'; }
  // stockLabel(n:number) { return n===0?'Out of Stock':n<10?'Low Stock':'In Stock'; }
  // fmt(n:number) { return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',minimumFractionDigits:0}).format(n); }
}
