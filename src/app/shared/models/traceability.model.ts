import { RecipeCookingAudit } from './kitchen.model';
import { StockLedgerResponseDTO } from './stock-ledger.model';
import { Order } from './order.model';

export interface ForwardTraceabilityDTO {
  supplierName: string;
  productNames: string[];
  fromDate: string;
  toDate: string;
  affectedOrders: Order[];
  ledgerEntries: StockLedgerResponseDTO[];
  affectedCookings: any[]; // Avoid circular dependency if possible, or use simplified interface
}

export interface ReverseTraceabilityDTO {
  cookingAudit: RecipeCookingAudit;
  ingredientTrace: IngredientTraceDTO[];
}

export interface IngredientTraceDTO {
  productName: string;
  ledgerHash: string | null;
  orderId: number | null;
  supplierName: string | null;
}
