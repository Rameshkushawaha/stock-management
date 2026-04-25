import {
  Component, OnInit, OnDestroy, ViewChild, ElementRef, HostListener, Input
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { InventoryService } from '../../services/inventory.service';
import { AuthService } from '../../auth/services/auth.service';
import { ReceiptItem, Receipt, Product } from '../../models/models';
import { Subscription } from 'rxjs';

type ScanMode = 'sell' | 'add';

@Component({
  selector: 'app-scanner',
  templateUrl: './scanner.component.html',
  styleUrls: ['./scanner.component.scss']
})
export class ScannerComponent implements OnInit, OnDestroy {
  @ViewChild('barcodeInput', { static: false }) barcodeInputRef!: ElementRef<HTMLInputElement>;

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

  // Cart (sell mode)
  cartItems: ReceiptItem[] = [];
  private cartSub!: Subscription;

  // New product modal
  showNewProductModal = false;
  pendingBarcode = '';

  // Receipt
  completedReceipt: Receipt | null = null;
  showReceipt = false;
  paymentMethod = 'Cash';
  paymentMethods = ['Cash', 'Card', 'UPI', 'Other'];

  // Camera scanner
  showCamera = false;
  cameraStream: MediaStream | null = null;
  @ViewChild('videoEl') videoEl!: ElementRef<HTMLVideoElement>;
  private scanInterval: any;

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
  ) {}

  ngOnInit(): void {
    this.route.url.subscribe(segments => {
      const last = segments[segments.length - 1]?.path;
      this.mode = last === 'add' ? 'add' : 'sell';
    });

    this.cartSub = this.inventory.cart$.subscribe(items => {
      this.cartItems = items;
    });

    this.clockInterval = setInterval(() => this.currentTime = new Date(), 1000);
    setTimeout(() => this.focusInput(), 200);
  }

  // ─── Global keydown redirect (USB scanner support) ──────────────────────────
  @HostListener('document:keydown', ['$event'])
  onGlobalKey(e: KeyboardEvent): void {
    if (this.showNewProductModal || this.showReceipt || this.showCamera) return;
    const t = e.target as HTMLElement;
    const isOther = ['INPUT','TEXTAREA','SELECT'].includes(t.tagName) && t !== this.barcodeInputRef?.nativeElement;
    if (isOther || e.ctrlKey || e.altKey || e.metaKey) return;
    if (document.activeElement !== this.barcodeInputRef?.nativeElement) this.focusInput();
  }

  focusInput(): void {
    this.barcodeInputRef?.nativeElement?.focus();
    this.scannerReady = true;
    this.scannerFocusLost = false;
  }

  onInputFocus(): void { this.scannerReady = true; this.scannerFocusLost = false; }

  onInputBlur(): void {
    clearTimeout(this.focusTimer);
    this.focusTimer = setTimeout(() => {
      if (document.activeElement !== this.barcodeInputRef?.nativeElement && !this.showNewProductModal && !this.showReceipt) {
        this.scannerReady = false;
        this.scannerFocusLost = true;
      }
    }, 250);
  }

  // ─── Submit barcode ──────────────────────────────────────────────────────────
  onSubmit(): void {
    const bc = this.barcodeValue.trim();
    if (!bc) return;
    this.barcodeValue = '';
    this.triggerScanLine();

    if (this.mode === 'sell') this.handleSell(bc);
    else this.handleAdd(bc);

    setTimeout(() => this.focusInput(), 60);
  }

  handleSell(bc: string): void {
    const result = this.inventory.addToCart(bc);
    if ('error' in result) {
      this.showError(result.error);
      this.triggerFlash('flash--error');
    } else {
      this.lastScannedProduct = this.inventory.getProductByBarcode(bc) ?? null;
      this.isLowStock = result.isLowStock;
      this.showMsg(`Added: ${result.item.productName}`);
      this.triggerFlash('flash--success');
    }
  }

  handleAdd(bc: string): void {
    const result = this.inventory.processInbound(bc, this.auth.currentUser?.id);
    if (!result) {
      this.pendingBarcode = bc;
      this.showNewProductModal = true;
      return;
    }
    this.lastScannedProduct = result.product;
    this.showMsg(`Stock updated: ${result.product.productName} → ${result.currentStock} units`);
    this.triggerFlash('flash--success');
  }

  // ─── New product modal ───────────────────────────────────────────────────────
  onNewProductSaved(data: { productData: Omit<Product,'productId'>; initialStock: number }): void {
    const { product } = this.inventory.registerNewProduct(data.productData, data.initialStock, this.auth.currentUser?.id);
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

  // ─── Cart actions ────────────────────────────────────────────────────────────
  removeFromCart(barcodeId: string): void { this.inventory.removeFromCart(barcodeId); }

  clearCart(): void { this.inventory.clearCart(); }

  checkout(): void {
    if (this.cartItems.length === 0) return;
    this.completedReceipt = this.inventory.buildReceipt(this.auth.currentUser?.name ?? 'Staff', this.paymentMethod);
    this.showReceipt = true;
  }

  onReceiptClosed(): void { this.showReceipt = false; this.completedReceipt = null; setTimeout(() => this.focusInput(), 100); }
  onNewSale(): void { this.showReceipt = false; this.completedReceipt = null; setTimeout(() => this.focusInput(), 100); }

  // ─── Camera scanner ──────────────────────────────────────────────────────────
  async toggleCamera(): Promise<void> {
    if (this.showCamera) {
      this.stopCamera();
    } else {
      await this.startCamera();
    }
  }

  async startCamera(): Promise<void> {
    try {
      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      this.showCamera = true;
      setTimeout(() => {
        if (this.videoEl?.nativeElement) {
          this.videoEl.nativeElement.srcObject = this.cameraStream;
        }
      }, 100);
      this.showMsg('Camera active – aim at barcode');
    } catch (err) {
      this.showError('Camera not available. Use USB scanner or type barcode.');
    }
  }

  stopCamera(): void {
    this.cameraStream?.getTracks().forEach(t => t.stop());
    this.cameraStream = null;
    this.showCamera = false;
    clearInterval(this.scanInterval);
    setTimeout(() => this.focusInput(), 100);
  }

  // Manual barcode entry from camera UI
  onCameraBarcode(bc: string): void {
    this.barcodeValue = bc;
    this.onSubmit();
  }

  // ─── Visual helpers ──────────────────────────────────────────────────────────
  private triggerScanLine(): void {
    this.scanLineActive = true;
    setTimeout(() => this.scanLineActive = false, 700);
  }

  private triggerFlash(cls: string): void {
    this.flashClass = cls;
    setTimeout(() => this.flashClass = '', 600);
  }

  private showMsg(msg: string): void {
    this.lastMessage = msg; this.lastError = '';
    clearTimeout(this.msgTimer);
    this.msgTimer = setTimeout(() => this.lastMessage = '', 4000);
  }

  private showError(err: string): void {
    this.lastError = err; this.lastMessage = '';
    clearTimeout(this.msgTimer);
    this.msgTimer = setTimeout(() => this.lastError = '', 4000);
  }

  // ─── Computed ─────────────────────────────────────────────────────────────────
  get cartTotal(): number { return this.cartItems.reduce((s, i) => s + i.total, 0); }
  get cartCount(): number { return this.cartItems.reduce((s, i) => s + i.quantity, 0); }

  get modeLabel(): string { return this.mode === 'sell' ? 'Cashier Mode' : 'Stock Add Mode'; }

  formatPrice(n: number): string {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(n);
  }

  switchMode(m: ScanMode): void {
    if (m === 'sell' && !this.auth.can('sell')) return;
    if (m === 'add' && !this.auth.can('add-stock')) return;
    this.mode = m;
    this.inventory.clearCart();
    this.lastMessage = ''; this.lastError = '';
    this.router.navigate(['/scanner/' + m]);
    setTimeout(() => this.focusInput(), 100);
  }

  ngOnDestroy(): void {
    this.cartSub?.unsubscribe();
    clearTimeout(this.msgTimer);
    clearTimeout(this.focusTimer);
    clearInterval(this.clockInterval);
    this.stopCamera();
  }
}
