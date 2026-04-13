import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-pruebas',
  standalone: true,
  imports: [],
  templateUrl: './pruebas.component.html',
  styleUrl: './pruebas.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PruebasComponent {
  showSimpleForm = false;
  showGridForm = false;
  showCredentialsForm = false;
  showComplexOrderForm = false;
  showDetailReadOnly = false;
  showConfirmationDialog = false;
  showSpecialProcess = false;
  showSuccessResult = false;

  credentialsGenerated = false;
  showSafeConfirmationVariant = false;

  readonly detailRows = [
    { label: 'Pedido', value: 'ORD-2026-0148' },
    { label: 'Proveedor', value: 'Molinos del Sur' },
    { label: 'Fecha recepcion', value: '13/04/2026 - 09:40' },
    { label: 'Responsable', value: 'Cocina central' }
  ];

  readonly orderSearchResults = [
    'Harina de trigo 25kg',
    'Aceite de oliva 5L',
    'Arroz integral 10kg',
    'Tomate triturado 3kg'
  ];

  readonly orderItems = [
    { name: 'Harina de trigo 25kg', qty: '2', price: '18.40 EUR', subtotal: '36.80 EUR' },
    { name: 'Aceite de oliva 5L', qty: '3', price: '26.50 EUR', subtotal: '79.50 EUR' },
    { name: 'Arroz integral 10kg', qty: '1', price: '21.90 EUR', subtotal: '21.90 EUR' }
  ];

  readonly detailProducts = [
    { product: 'Harina de trigo', qty: '25 kg', unitPrice: '1.22 EUR', subtotal: '30.50 EUR' },
    { product: 'Aceite de oliva', qty: '12 L', unitPrice: '5.60 EUR', subtotal: '67.20 EUR' },
    { product: 'Arroz integral', qty: '18 kg', unitPrice: '2.15 EUR', subtotal: '38.70 EUR' }
  ];

  readonly lotRows = [
    { id: 'LT-2026-0413', qty: '25 kg', expiry: '22/05/2026', expired: false },
    { id: 'LT-2026-0352', qty: '12 kg', expiry: '04/02/2026', expired: true }
  ];

  readonly processRows = [
    { product: 'Harina de trigo', requested: 20, received: 20, expiry: '2026-07-12' },
    { product: 'Aceite de oliva', requested: 8, received: 6, expiry: '2026-11-01' },
    { product: 'Arroz integral', requested: 15, received: 15, expiry: '2026-09-25' }
  ];

  readonly successRows = [
    { label: 'Operacion', value: 'Recepcion de pedido' },
    { label: 'Codigo', value: 'REC-2026-0087' },
    { label: 'Registrado por', value: 'Chef Garcia' }
  ];

  openSimpleForm(): void {
    this.showSimpleForm = true;
  }

  closeSimpleForm(): void {
    this.showSimpleForm = false;
  }

  openGridForm(): void {
    this.showGridForm = true;
  }

  closeGridForm(): void {
    this.showGridForm = false;
  }

  openCredentialsForm(): void {
    this.credentialsGenerated = false;
    this.showCredentialsForm = true;
  }

  closeCredentialsForm(): void {
    this.showCredentialsForm = false;
  }

  generateCredentials(): void {
    this.credentialsGenerated = true;
  }

  openComplexOrderForm(): void {
    this.showComplexOrderForm = true;
  }

  closeComplexOrderForm(): void {
    this.showComplexOrderForm = false;
  }

  openDetailReadOnly(): void {
    this.showDetailReadOnly = true;
  }

  closeDetailReadOnly(): void {
    this.showDetailReadOnly = false;
  }

  openConfirmationDialog(): void {
    this.showSafeConfirmationVariant = false;
    this.showConfirmationDialog = true;
  }

  closeConfirmationDialog(): void {
    this.showConfirmationDialog = false;
  }

  toggleConfirmationVariant(): void {
    this.showSafeConfirmationVariant = !this.showSafeConfirmationVariant;
  }

  openSpecialProcess(): void {
    this.showSpecialProcess = true;
  }

  closeSpecialProcess(): void {
    this.showSpecialProcess = false;
  }

  openSuccessResult(): void {
    this.showSuccessResult = true;
  }

  closeSuccessResult(): void {
    this.showSuccessResult = false;
  }
}
