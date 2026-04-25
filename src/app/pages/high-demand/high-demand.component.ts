import { Component, OnInit } from '@angular/core';
import { InventoryService } from '../../services/inventory.service';
import { DemandItem } from '../../models/models';

@Component({ selector:'app-high-demand', templateUrl:'./high-demand.component.html', styleUrls:['./high-demand.component.scss'] })
export class HighDemandComponent implements OnInit {
  items: DemandItem[] = [];
  days = 30;
  dayOpts = [7,14,30,60,90];
  constructor(private inv: InventoryService) {}
  ngOnInit() { this.load(); }
  load() { this.inv.getDemandReport(this.days).subscribe(items => this.items = items); }
  fmt(n:number) { return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',minimumFractionDigits:0}).format(n); }
}
