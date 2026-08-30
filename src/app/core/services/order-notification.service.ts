import { Injectable } from '@angular/core';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class OrderNotificationService {
  constructor(private readonly db: SupabaseService) {}

  subscribeToNewOrderItems(onNewOrder: () => void): RealtimeChannel {
    return this.db.client
      .channel(`user-new-orders-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          // Un producto nuevo puede llegar como INSERT o como UPDATE cuando
          // ya existía en el pedido y se incrementa su cantidad. Solo avisamos
          // cuando el resultado queda pendiente; los cambios a PLACED/CANCELLED
          // no deben generar un aviso de pedido nuevo.
          const next = payload.new as Record<string, unknown> | undefined;
          if (next?.['status'] === 'PENDING') {
            onNewOrder();
          }
        },
      )
      .subscribe();
  }
}
