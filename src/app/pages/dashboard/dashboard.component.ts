import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { InventoryService } from '../../services/inventory.service';
import { AuthService } from '../../auth/services/auth.service';
import { DashboardStats, DemandItem, Product } from '../../models/models';
import { BarcodeFormat } from '@zxing/library';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {

   @ViewChild('barcodeInput', { static: false })
    barcodeInputRef!: ElementRef<HTMLInputElement>;
    
  stats!: DashboardStats;
  recentSales: any[] = [];
  trending: DemandItem[] = [];
  quickScanBarcode = '';
  quickScanMode: 'sell' | 'add' = 'sell';
  scanMessage = '';
  scanError = '';
  // Scanner state
  scannerReady = true;
  scannerFocusLost = false;
  scanLineActive = false;
  flashClass = '';
   showCamera = false;
  // Feedback
  private msgTimer: any;
  lastMessage = '';
  lastError = '';
   lastScannedProduct: Product | null = null;

  categoryList: any[] = [];
  brandList: any[] = [];
  unitList: any[] = [];

  showNewProductPopup = false;
  newProductData = {
    barcode: '',
    name: '',
    categoryId: null,
    brandId: null,
    unitId: 0,
    taxPercent: 18.0, // Default from your schema
    minStock: 10,     // Default from your schema
    initialQty: 1,
    purchasePrice: 0,
    sellingPrice: 0
  };

  showNewBatchPopup = false;
  newBatchData = {
    barcode: '',
    qty: 1,
    purchasePrice: 0,
    sellingPrice: 0,
    expiryDate: ''
  };

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
    const res = this.inventory.addToCart(bc).subscribe({
      next: (res: any) => {
        console.log('Add to cart response:', res);
        
        // SUCCESS CASE
        if (res.item) {
          this.triggerFlash('flash--success');
          this.showMsg(`Added to cart: ${res.item.productName}`);
        } 
        // ERROR HANDLING & POPUP TRIGGERING
        else if (res.error) {
          this.showError(res.error.error);
        }
      },
      error: (err) => {
        this.showError('Connection error. Please try again.');
        this.triggerFlash('flash--error');
      }
    });
   
  } else {
    this.inventory.processInbond(bc).subscribe({
      next: (res: any) => {
        console.log('Inbound response:', res);
        
        // SUCCESS CASE
        if (res.success) {
          const updatedQty = res.data.qtyAvailable;
          this.triggerFlash('flash--success');
          this.showMsg(`Stock updated! Current Qty: ${updatedQty}`);
        } 
        // ERROR HANDLING & POPUP TRIGGERING
        else if (res.error) {
          if (res.error.includes('No existing stock batch')) {
            this.openNewBatchModal(bc);
          } else if (res.error.includes('Product not found')) {
            // Load dropdowns before opening registration
            this.getCategoryList();
            this.getBrandList();
            this.getUnitList();
            console.log('Opening registration popup for barcode:', bc);
            this.openRegistrationPopup(bc);
          } else {
            this.showError(res.error);
          }
        }
      },
      error: (err) => {
        this.showError('Connection error. Please try again.');
        this.triggerFlash('flash--error');
      }
    });
  }

  this.quickScanBarcode = '';
}

  // Helper for cleaner code
  private handleConnectionError() {
    this.scanError = 'Server connection failed';
    this.scanMessage = '';
  }

  goToScanner(): void {
    this.router.navigate([this.quickScanMode === 'sell' ? '/scanner/sell' : '/scanner/add']);
  }

 get formattedRevenue(): string {
  // Add this check
  if (!this.stats) return '₹0.00'; 
  
  return new Intl.NumberFormat('en-IN', { 
    style: 'currency', 
    currency: 'INR', 
    minimumFractionDigits: 2 
  }).format(this.stats.totalRevenue);
}

get formattedTodayRevenue(): string {
  // Add this check
  if (!this.stats) return '₹0.00';

  return new Intl.NumberFormat('en-IN', { 
    style: 'currency', 
    currency: 'INR', 
    minimumFractionDigits: 2 
  }).format(this.stats.todayRevenue);
}
  // dropdown
  getCategoryList() {
    this.inventory.getCategoryList().subscribe({
      next: (res) => {
        console.log('Categories:', res);
        this.categoryList = res; // Assign to local variable to populate dropdown
      },
      error: (err) => {
        console.error('Failed to load categories:', err);
      }
    });
  }

  getBrandList() {
    this.inventory.getBrandList().subscribe({
      next: (res) => {
        console.log('Brands:', res);
        this.brandList = res;
        // You can assign this to a local variable to populate a dropdown
      },
      error: (err) => {
        console.error('Failed to load brands:', err);
      }
    });
  }

  getUnitList() {
    this.inventory.getUnitList().subscribe({
      next: (res) => {
        console.log('Units:', res);
        this.unitList = res;
        // You can assign this to a local variable to populate a dropdown
      },
      error: (err) => {
        console.error('Failed to load units:', err);
      }
    });
  }

  // new Batch Modal
  // Logic to open this specific modal
  openNewBatchModal(bc: string) {
    this.newBatchData = {
      barcode: bc,
      qty: 1,
      purchasePrice: 0,
      sellingPrice: 0,
      expiryDate: ''
    };
    this.showNewBatchPopup = true;
  }
  saveNewBatch(): void {
    this.inventory.addNewBatch(this.newBatchData).subscribe({
      next: (res) => {
        if (res.success) {
          this.showMsg(`Initial stock added for ${this.newBatchData.barcode}!`);
          this.showNewBatchPopup = false;
          this.triggerFlash('flash--success');
          setTimeout(() => this.focusInput(), 100);
        }
      },
      error: (err) => this.showError('Failed to create initial batch')
    });
  }

  // =========================================================
  // NEW PRODUCT
  // =========================================================

  openRegistrationPopup(barcode: string): void {
    this.newProductData = {
      name: '',
      barcode: barcode, // Pre-fill the barcode you just scanned
      taxPercent: 18,
      unitId: 0,
      categoryId: null,
      brandId: null,
      minStock: 10,
      initialQty: 1,
      purchasePrice: 0,
      sellingPrice: 0
    };
    this.showNewProductPopup = true;
  }

  saveNewProduct(): void {
    // Ensure numeric fields are actually numbers
    const payload = {
      ...this.newProductData,
      categoryId: Number(this.newProductData.categoryId),
      brandId: Number(this.newProductData.brandId),
      unitId: Number(this.newProductData.unitId),
      taxPercent: Number(this.newProductData.taxPercent),
      initialQty: Number(this.newProductData.initialQty),
      purchasePrice: Number(this.newProductData.purchasePrice || 0),
      sellingPrice: Number(this.newProductData.sellingPrice || 0)
    };

    this.inventory.registerNewProduct(payload).subscribe({
      next: (product) => {
        this.showNewProductPopup = false;
        this.triggerFlash('flash--success');

        // Update UI feedback
        this.lastScannedProduct = product;
        this.showMsg(`Successfully registered: ${product.name}`);

        // Reset local input
        this.quickScanBarcode = '';

        // Return focus to scanner
        setTimeout(() => this.focusInput(), 100);
      },
      error: (err) => {
        this.showError(err.message || 'Could not save product');
        this.triggerFlash('flash--error');
      }
    });
  }

   // =========================================================
    // CAMERA SCANNER (FINAL STABLE)
    // =========================================================\
    // Add these to your class properties
    availableDevices: MediaDeviceInfo[] = [];
    currentDevice: MediaDeviceInfo | undefined;
  
    // This method picks the correct camera automatically
    onCamerasFound(devices: MediaDeviceInfo[]): void {
      this.availableDevices = devices;
      if (devices && devices.length > 0) {
        // Priority: 1. Back camera (for mobile) 2. First available (for PC)
        const backCam = devices.find(d => d.label.toLowerCase().includes('back'));
        this.currentDevice = backCam || devices[0];
        console.log('Camera selected:', this.currentDevice.label);
      }
    }
    // 1. Add this property to your class
    allowedFormats = [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.QR_CODE
    ];
  
    toggleCamera(): void {
      this.showCamera = !this.showCamera;
      // When we close the camera, we ensure focus returns to the USB input
      if (!this.showCamera) {
        setTimeout(() => this.focusInput(), 100);
      }
    }
  
    // This is the ONLY function that should handle a successful scan
    cameraScanSuccess(code: string): void {
      if (!code) return;
  
      console.log('Decoded Code:', code); // Check F12 console to see if it sees the number
  
      // 1. Fill the search value
      this.quickScanBarcode = code;
  
      // 2. Trigger the visual feedback
      this.triggerFlash('flash--success');
      this.triggerScanLine();
  
      // 3. Force a tiny delay so Angular's data-binding catches up
      setTimeout(() => {
        this.showCamera = false; // Close the camera
        this.quickScan();        // Process the barcode (Add to cart or Stock)
      }, 100);
    }
  
    onHasPermission(has: boolean): void {
      if (!has) {
        this.showError('Camera permission was denied.');
      } else {
        this.showMsg('Camera ready - aim at barcode');
      }
    }
  
    stopCamera(): void {
      this.showCamera = false;
      setTimeout(() => this.focusInput(), 100);
    }
  
    // Manual add from camera panel input
    onCameraBarcode(bc: string): void {
      this.quickScanBarcode = bc;
      this.quickScan();
    }
  
  // =========================================================
  // UI HELPERS
  // =========================================================
  private triggerScanLine(): void {
    this.scanLineActive = true;
    setTimeout(() => this.scanLineActive = false, 700);
  }

  private triggerFlash(cls: string): void {
    this.flashClass = cls;
    setTimeout(() => this.flashClass = '', 600);
  }

  private showMsg(msg: string): void {
    this.lastMessage = msg;
    this.lastError = '';

    clearTimeout(this.msgTimer);

    this.msgTimer = setTimeout(() => {
      this.lastMessage = '';
    }, 4000);
  }

  private showError(msg: string): void {
    this.lastError = msg;
    this.lastMessage = '';

    clearTimeout(this.msgTimer);

    this.msgTimer = setTimeout(() => {
      this.lastError = '';
    }, 4000);
  }

    focusInput(): void {
    this.barcodeInputRef?.nativeElement?.focus();
    this.scannerReady = true;
    this.scannerFocusLost = false;
  }

}
