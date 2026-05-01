import {
  Component, OnInit, OnDestroy, ViewChild, ElementRef, HostListener
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { InventoryService } from '../../services/inventory.service';
import { AuthService } from '../../auth/services/auth.service';
import { ReceiptItem, Receipt, Product } from '../../models/models';

// Import ONLY what the component needs for the template
import { BarcodeFormat } from '@zxing/library';

type ScanMode = 'sell' | 'add';

@Component({
  selector: 'app-scanner',
  templateUrl: './scanner.component.html',
  styleUrls: ['./scanner.component.scss']
})
export class ScannerComponent implements OnInit, OnDestroy {

  @ViewChild('barcodeInput', { static: false })
  barcodeInputRef!: ElementRef<HTMLInputElement>;

  @ViewChild('videoEl', { static: false })
  videoEl!: ElementRef<HTMLVideoElement>;

  mode: ScanMode = 'sell';
  barcodeValue = '';

  // Scanner state
  scannerReady = true;
  scannerFocusLost = false;
  scanLineActive = false;
  flashClass = '';

  // Feedback
  lastMessage = '';
  lastError = '';
  lastScannedProduct: Product | null = null;
  isLowStock = false;

  // Cart
  cartItems: ReceiptItem[] = [];
  private cartSub!: Subscription;

  // New Product Modal
  showNewProductModal = false;
  pendingBarcode = '';

  // Receipt
  completedReceipt: Receipt | null = null;
  showReceipt = false;
  paymentMethod = 'Cash';
  paymentMethods = ['Cash', 'Card', 'UPI', 'Other'];

  // Camera
  showCamera = false;
  // cameraStream: MediaStream | null = null;
  // private codeReader!: BrowserMultiFormatReader;
  // private scanning = false;/

  // Timers
  private msgTimer: any;
  private focusTimer: any;
  private clockInterval: any;
  currentTime = new Date();

  constructor(
    private inventory: InventoryService,
    public auth: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) { }

  // =========================================================
  // INIT
  // =========================================================
  ngOnInit(): void {

    this.route.url.subscribe(segments => {
      const last = segments[segments.length - 1]?.path;
      this.mode = last === 'add' ? 'add' : 'sell';
    });

    this.cartSub = this.inventory.cart$.subscribe(items => {
      this.cartItems = items;
    });

    this.clockInterval = setInterval(() => {
      this.currentTime = new Date();
    }, 1000);

    setTimeout(() => this.focusInput(), 200);
  }

  // =========================================================
  // KEYBOARD / USB SCANNER
  // =========================================================
  @HostListener('document:keydown', ['$event'])
  onGlobalKey(e: KeyboardEvent): void {

    if (this.showNewProductModal || this.showReceipt || this.showCamera) return;

    const t = e.target as HTMLElement;

    const otherInput =
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) &&
      t !== this.barcodeInputRef?.nativeElement;

    if (otherInput || e.ctrlKey || e.altKey || e.metaKey) return;

    if (document.activeElement !== this.barcodeInputRef?.nativeElement) {
      this.focusInput();
    }
  }

  focusInput(): void {
    this.barcodeInputRef?.nativeElement?.focus();
    this.scannerReady = true;
    this.scannerFocusLost = false;
  }

  onInputFocus(): void {
    this.scannerReady = true;
    this.scannerFocusLost = false;
  }

  onInputBlur(): void {
    clearTimeout(this.focusTimer);

    this.focusTimer = setTimeout(() => {
      if (
        document.activeElement !== this.barcodeInputRef?.nativeElement &&
        !this.showNewProductModal &&
        !this.showReceipt
      ) {
        this.scannerReady = false;
        this.scannerFocusLost = true;
      }
    }, 250);
  }

  // =========================================================
  // SUBMIT BARCODE
  // =========================================================
  onSubmit(): void {

    const bc = this.barcodeValue.trim();

    if (!bc) return;

    this.barcodeValue = '';
    this.triggerScanLine();

    if (this.mode === 'sell') {
      this.handleSell(bc);
    } else {
      this.handleAdd(bc);
    }

    setTimeout(() => this.focusInput(), 60);
  }

  handleSell(bc: string): void {

    const result = this.inventory.addToCart(bc);

    if ('error' in result) {
      this.showError(result.error);
      this.triggerFlash('flash--error');
      return;
    }

    this.lastScannedProduct = this.inventory.getProductByBarcode(bc) ?? null;
    this.isLowStock = result.isLowStock;

    this.showMsg(`Added: ${result.item.productName}`);
    this.triggerFlash('flash--success');
  }

  handleAdd(bc: string): void {

    const result = this.inventory.processInbound(
      bc,
      this.auth.currentUser?.id
    );

    if (!result) {
      this.pendingBarcode = bc;
      this.showNewProductModal = true;
      return;
    }

    this.lastScannedProduct = result.product;

    this.showMsg(
      `Stock updated: ${result.product.productName} → ${result.currentStock} units`
    );

    this.triggerFlash('flash--success');
  }

  // =========================================================
  // NEW PRODUCT
  // =========================================================
  onNewProductSaved(data: {
    productData: Omit<Product, 'productId'>;
    initialStock: number;
  }): void {

    const { product } = this.inventory.registerNewProduct(
      data.productData,
      data.initialStock,
      this.auth.currentUser?.id
    );

    this.lastScannedProduct = product;
    this.showMsg(`Registered: ${product.productName}`);
    this.showNewProductModal = false;

    this.triggerFlash('flash--success');

    setTimeout(() => this.focusInput(), 100);
  }

  onNewProductCancelled(): void {
    this.showNewProductModal = false;
    setTimeout(() => this.focusInput(), 100);
  }

  // =========================================================
  // CART
  // =========================================================
  removeFromCart(barcodeId: string): void {
    this.inventory.removeFromCart(barcodeId);
  }

  clearCart(): void {
    this.inventory.clearCart();
  }

  checkout(): void {

    if (this.cartItems.length === 0) return;

    this.completedReceipt = this.inventory.buildReceipt(
      this.auth.currentUser?.name ?? 'Staff',
      this.paymentMethod
    );

    this.showReceipt = true;
  }

  onReceiptClosed(): void {
    this.showReceipt = false;
    this.completedReceipt = null;
    setTimeout(() => this.focusInput(), 100);
  }

  onNewSale(): void {
    this.showReceipt = false;
    this.completedReceipt = null;
    setTimeout(() => this.focusInput(), 100);
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
  this.barcodeValue = code;

  // 2. Trigger the visual feedback
  this.triggerFlash('flash--success');
  this.triggerScanLine();

  // 3. Force a tiny delay so Angular's data-binding catches up
  setTimeout(() => {
    this.showCamera = false; // Close the camera
    this.onSubmit();        // Process the barcode (Add to cart or Stock)
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
    this.barcodeValue = bc;
    this.onSubmit();
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

  // =========================================================
  // COMPUTED
  // =========================================================
  get cartTotal(): number {
    return this.cartItems.reduce((s, i) => s + i.total, 0);
  }

  get cartCount(): number {
    return this.cartItems.reduce((s, i) => s + i.quantity, 0);
  }

  get modeLabel(): string {
    return this.mode === 'sell' ? 'Cashier Mode' : 'Stock Add Mode';
  }

  formatPrice(n: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(n);
  }

  switchMode(m: ScanMode): void {

    if (m === 'sell' && !this.auth.can('sell')) return;
    if (m === 'add' && !this.auth.can('add-stock')) return;

    this.mode = m;

    this.inventory.clearCart();

    this.lastMessage = '';
    this.lastError = '';

    this.router.navigate(['/scanner/' + m]);

    setTimeout(() => this.focusInput(), 100);
  }

  // =========================================================
  // DESTROY
  // =========================================================
  ngOnDestroy(): void {

    this.cartSub?.unsubscribe();

    clearTimeout(this.msgTimer);
    clearTimeout(this.focusTimer);
    clearInterval(this.clockInterval);

    // this.stopCamera();
  }
}