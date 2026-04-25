import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Product } from '../../models/models';

@Component({
  selector: 'app-new-product-modal',
  templateUrl: './new-product-modal.component.html',
  styleUrls: ['./new-product-modal.component.scss']
})
export class NewProductModalComponent {
  @Input() barcodeId = '';
  @Output() saved = new EventEmitter<{ productData: Omit<Product,'productId'>; initialStock: number }>();
  @Output() cancelled = new EventEmitter<void>();

  categories = ['Electronics','Groceries','Stationery','Cleaning','Clothing','Furniture','Other'];

  form = { productName: '', category: '', unitPrice: null as number | null, description: '', initialStock: 1 };
  errors: Record<string,string> = {};

  validate(): boolean {
    this.errors = {};
    if (!this.form.productName.trim()) this.errors['name'] = 'Required';
    if (!this.form.category) this.errors['cat'] = 'Required';
    if (!this.form.unitPrice || this.form.unitPrice <= 0) this.errors['price'] = 'Enter valid price';
    if (this.form.initialStock < 1) this.errors['qty'] = 'Min 1';
    return !Object.keys(this.errors).length;
  }

  save(): void {
    if (!this.validate()) return;
    this.saved.emit({
      productData: { barcodeId: this.barcodeId, productName: this.form.productName.trim(), category: this.form.category, unitPrice: this.form.unitPrice!, description: this.form.description.trim() },
      initialStock: this.form.initialStock
    });
  }

  cancel(): void { this.cancelled.emit(); }
}
