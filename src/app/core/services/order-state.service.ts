import { Injectable } from '@angular/core';
import type { OrderItemStatus } from '../models/models';
@Injectable({ providedIn: 'root' })
export class OrderStateService {
  canTransition(from: OrderItemStatus, to: OrderItemStatus): boolean {
    return (from === 'PENDING' && to === 'PLACED') || (from === 'PENDING' && to === 'CANCELLED');
  }
  pendingQuantity(items: Array<{ status: OrderItemStatus; quantity: number }>): number {
    return items.filter((i) => i.status === 'PENDING').reduce((n, i) => n + i.quantity, 0);
  }
}
