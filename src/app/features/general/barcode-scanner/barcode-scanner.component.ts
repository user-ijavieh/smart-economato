import { AfterViewInit, Component, ElementRef, EventEmitter, Input, NgZone, OnDestroy, Output, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType, NotFoundException } from '@zxing/library';
import { MessageService } from '../../../core/services/message.service';
import { ProductService } from '../../../core/services/product.service';
import { Product } from '../../../shared/models/product.model';
import { LoggerService } from '../../../core/services/logger.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-barcode-scanner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './barcode-scanner.component.html',
  styleUrl: './barcode-scanner.component.css'
})
export class BarcodeScannerComponent implements AfterViewInit, OnDestroy {
  private logger = inject(LoggerService);
  private ngZone = inject(NgZone);
  @ViewChild('videoElement') videoRef!: ElementRef<HTMLVideoElement>;
  @Input() compact = true;
  @Output() productFound = new EventEmitter<Product>();
  @Output() codeScanned = new EventEmitter<string>();

  private messageService = inject(MessageService);
  private productService = inject(ProductService);
  private reader!: BrowserMultiFormatReader;
  private scanControls?: IScannerControls;
  private isInitializingCamera = false;
  private readonly isProduction = environment.production;

  scannerEnabled = true;
  hasPermission = false;
  permissionDenied = false;

  availableDevices: MediaDeviceInfo[] = [];
  selectedDevice: MediaDeviceInfo | undefined;

  allowedFormats = [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.QR_CODE,
  ];

  scannedCode: string | null = null;
  product: Product | null = null;
  loading = false;

  ngAfterViewInit(): void {
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, this.allowedFormats);
    this.reader = new BrowserMultiFormatReader(hints);
    void this.initCamera();
  }

  onCamerasNotFound(): void {
    this.runInZone(() => {
      this.scannerEnabled = false;
    });
    this.logScannerError('No se encontraron cámaras disponibles para el scanner.');
  }

  private async initCamera(): Promise<void> {
    if (this.isInitializingCamera) return;

    this.isInitializingCamera = true;

    let permissionStream: MediaStream | undefined;

    try {
      permissionStream = await navigator.mediaDevices.getUserMedia({ video: true });
      this.runInZone(() => {
        this.hasPermission = true;
        this.permissionDenied = false;
      });
    } catch (err: unknown) {
      const errorName = err instanceof DOMException ? err.name : '';
      const isPermissionError =
        errorName === 'NotAllowedError' ||
        errorName === 'PermissionDeniedError' ||
        errorName === 'SecurityError';

      const errorMessage = isPermissionError
        ? 'Se necesitan permisos de cámara para escanear códigos de barras.'
        : 'No se pudo acceder a la cámara en este dispositivo.';

      this.runInZone(() => {
        this.hasPermission = false;
        this.permissionDenied = true;
        this.scannerEnabled = false;
      });

      if (!isPermissionError) {
        this.logScannerError('Error requesting camera permission.', err);
      }

      return;
    } finally {
      permissionStream?.getTracks().forEach(t => t.stop());
    }

    try {
      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      this.runInZone(() => {
        this.availableDevices = devices;
      });

      if (devices.length === 0) {
        this.onCamerasNotFound();
        return;
      }

      const backCamera = devices.find(d =>
        d.label.toLowerCase().includes('back') ||
        d.label.toLowerCase().includes('trasera') ||
        d.label.toLowerCase().includes('rear') ||
        d.label.toLowerCase().includes('environment')
      );

      this.runInZone(() => {
        this.selectedDevice = backCamera || devices[0];
      });

      const started = await this.startScanning();
      if (!started) {
        this.runInZone(() => {
          this.scannerEnabled = false;
        });
      }
    } catch (err) {
      const errorMessage = this.getCameraInitErrorMessage(err);
      this.runInZone(() => {
        this.scannerEnabled = false;
      });
      this.logScannerError('Error initializing barcode scanner.', err);
    } finally {
      this.runInZone(() => {
        this.isInitializingCamera = false;
      });
    }
  }

  private async startScanning(): Promise<boolean> {
    if (!this.selectedDevice || !this.scannerEnabled) return false;
    if (!this.videoRef?.nativeElement) {
      this.logScannerWarn('Scanner video element is not ready yet.');
      return false;
    }

    this.stopScanning();

    try {
      this.scanControls = await this.reader.decodeFromConstraints(
        {
          video: {
            deviceId: { exact: this.selectedDevice.deviceId }
          }
        },
        this.videoRef.nativeElement,
        (result, error) => {
          if (result) {
            this.runInZone(() => this.onScanSuccess(result.getText()));
          }
          if (error && !(error instanceof NotFoundException)) {
            this.runInZone(() => this.onScanError(error));
          }
        }
      );
      return true;
    } catch (selectedDeviceError) {
      this.logScannerWarn('Failed to start scanner with selected camera, trying default camera.', selectedDeviceError);

      try {
        this.scanControls = await this.reader.decodeFromConstraints(
          {
            video: {
              facingMode: { ideal: 'environment' }
            }
          },
          this.videoRef.nativeElement,
          (result, error) => {
            if (result) {
              this.runInZone(() => this.onScanSuccess(result.getText()));
            }
            if (error && !(error instanceof NotFoundException)) {
              this.runInZone(() => this.onScanError(error));
            }
          }
        );

        if (this.selectedDevice) {
          const activeTrack = this.videoRef.nativeElement.srcObject instanceof MediaStream
            ? this.videoRef.nativeElement.srcObject.getVideoTracks()[0]
            : undefined;
          const activeDeviceId = activeTrack?.getSettings().deviceId;
          const matchedDevice = this.availableDevices.find(d => d.deviceId === activeDeviceId);
          if (matchedDevice) {
            this.selectedDevice = matchedDevice;
          }
        }

        return true;
      } catch (fallbackError) {
        const errorMessage = this.getCameraInitErrorMessage(fallbackError);
        this.logScannerError('Failed to start scanner with fallback camera.', fallbackError);
        return false;
      }
    }
  }

  private runInZone(action: () => void): void {
    this.ngZone.run(action);
  }

  private logScannerWarn(message: string, error?: unknown): void {
    if (!this.isProduction) {
      this.logger.warn(message, error);
    }
  }

  private logScannerError(message: string, error?: unknown): void {
    if (this.isProduction) {
      this.logger.error(message);
      return;
    }

    this.logger.error(message, error);
  }

  private getCameraInitErrorMessage(error: unknown): string {
    const domErrorName = error instanceof DOMException ? error.name : '';

    switch (domErrorName) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
      case 'SecurityError':
        return 'Permiso de cámara denegado. Revisa la configuración del navegador y vuelve a intentarlo.';
      case 'NotFoundError':
        return 'No se encontró ninguna cámara disponible en este dispositivo.';
      case 'NotReadableError':
        return 'La cámara está siendo usada por otra aplicación o pestaña. Ciérrala e inténtalo de nuevo.';
      case 'OverconstrainedError':
        return 'La cámara seleccionada no está disponible actualmente. Prueba con otra cámara.';
      case 'AbortError':
        return 'La inicialización de la cámara se interrumpió. Vuelve a intentarlo.';
      default:
        return 'No se pudo iniciar el escáner de cámara en este dispositivo.';
    }
  }

  private stopScanning(): void {
    this.scanControls?.stop();
    this.scanControls = undefined;
  }

  onScanSuccess(code: string): void {
    if (this.loading || this.scannedCode === code) return;

    this.scannedCode = code;
    this.stopScanning();
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
    this.runInZone(() => {
      this.messageService.showWarning('No se pudo leer el código en este momento. Inténtalo de nuevo.');
    });
    this.logScannerWarn('Scan error.', error);
  }

  scanAgain(): void {
    this.scannedCode = null;
    this.product = null;
    this.loading = false;
    this.scannerEnabled = true;
    void this.startScanning().then((started) => {
      if (!started) {
        this.scannerEnabled = false;
      }
    });
  }

  selectCamera(device: MediaDeviceInfo): void {
    this.selectedDevice = device;
    this.stopScanning();
    this.scannerEnabled = true;
    void this.startScanning().then((started) => {
      if (!started) {
        this.scannerEnabled = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.stopScanning();
  }
}
