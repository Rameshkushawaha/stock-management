import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Receipt } from '../../models/models';

@Component({
  selector: 'app-receipt-panel',
  templateUrl: './receipt-panel.component.html',
  styleUrls: ['./receipt-panel.component.scss']
})
export class ReceiptPanelComponent {
  @Input() receipt!: Receipt;
  @Output() closed = new EventEmitter<void>();
  @Output() newSale = new EventEmitter<void>();

  printReceipt(): void {
    window.print();
  }

  close(): void { this.closed.emit(); }
  startNewSale(): void { this.newSale.emit(); }

  get formattedDate(): string {
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium', timeStyle: 'short'
    }).format(this.receipt.timestamp);
  }
}
