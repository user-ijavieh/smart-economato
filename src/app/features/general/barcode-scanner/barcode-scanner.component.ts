import { Component, EventEmitter, Input, OnInit, Output, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ZXingScannerComponent, ZXingScannerModule } from '@zxing/ngx-scanner';
import { BarcodeFormat } from '@zxing/library';
import { MessageService } from '../../../core/services/message.service';
import { ProductService } from '../../../core/services/product.service';
import { Product } from '../../../shared/models/product.model';

@Component({
  selector: 'app-barcode-scanner',
  standalone: true,
  imports: [CommonModule, ZXingScannerModule],
  templateUrl: './barcode-scanner.component.html',
  styleUrl: './barcode-scanner.component.css'
})
export class BarcodeScannerComponent implements OnInit {
  @ViewChild('scanner') scanner!: ZXingScannerComponent;
  @Input() compact = true;
  @Output() productFound = new EventEmitter<Product>();
  @Output() codeScanned = new EventEmitter<string>();

  private messageService = inject(MessageService);
  private productService = inject(ProductService);

  // Scanner state
  scannerEnabled = true;
  hasPermission = false;
  permissionDenied = false;

  // Camera
  availableDevices: MediaDeviceInfo[] = [];
  selectedDevice: MediaDeviceInfo | undefined;

  // Formats to scan
  allowedFormats = [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.QR_CODE,
  ];

  // Result state
  scannedCode: string | null = null;
  product: Product | null = null;
  loading = false;

  ngOnInit(): void {}

  onCamerasFound(devices: MediaDeviceInfo[]): void {
    this.availableDevices = devices;
    // Prefer back camera
    const backCamera = devices.find(d =>
      d.label.toLowerCase().includes('back') ||
      d.label.toLowerCase().includes('trasera') ||
      d.label.toLowerCase().includes('rear') ||
      d.label.toLowerCase().includes('environment')
    );
    this.selectedDevice = backCamera || devices[0];
  }

  onCamerasNotFound(): void {
    this.messageService.showError('No se encontraron cámaras disponibles para el scanner.');
    this.scannerEnabled = false;
  }

  onPermissionResponse(perm: boolean): void {
    this.hasPermission = perm;
    if (!perm) {
      this.permissionDenied = true;
      this.scannerEnabled = false;
      this.messageService.showError('Se necesitan permisos de cámara para escanear códigos de barras.');
    }
  }

  onScanSuccess(code: string): void {
    if (this.loading || this.scannedCode === code) return;

    this.scannedCode = code;
    this.scannerEnabled = false;
    this.loading = true;
    this.product = null;

    this.codeScanned.emit(code);

    this.productService.getByBarcode(code).subscribe({
      next: (product) => {
        this.product = product;
        this.loading = false;
        this.productFound.emit(product);
      },
      error: (err) => {
        this.loading = false;
        if (err.status === 404) {
          this.messageService.showWarning(`No se encontró ningún producto con el código: ${code}`);
        } else {
          this.messageService.showError('Error al consultar el producto. Inténtalo de nuevo.');
        }
        this.scanAgain();
      }
    });
  }

  onScanError(error: Error): void {
    console.error('Scan error:', error);
  }

  scanAgain(): void {
    this.scannedCode = null;
    this.product = null;
    this.loading = false;
    this.scannerEnabled = true;
  }

  selectCamera(device: MediaDeviceInfo): void {
    this.selectedDevice = device;
  }
}
