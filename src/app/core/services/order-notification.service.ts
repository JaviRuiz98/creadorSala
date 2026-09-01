import { Injectable } from '@angular/core';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class OrderNotificationService {
  private lastOrderAlertAt = 0;
  private lastObservationAlertAt = 0;

  constructor(private readonly db: SupabaseService) {}

  subscribeToNewOrderItems(onNewOrder: () => void, onObservationChange?: () => void): RealtimeChannel {
    const emitOrder = () => {
      const now = Date.now();
      // Un mismo alta puede producir UPDATE/INSERT en order_items y, justo
      // después, UPDATE de la mesa a attended=false. Evitamos doble aviso.
      if (now - this.lastOrderAlertAt < 700) return;
      this.lastOrderAlertAt = now;
      onNewOrder();
    };

    const emitObservation = () => {
      const now = Date.now();
      if (now - this.lastObservationAlertAt < 700) return;
      this.lastObservationAlertAt = now;
      onObservationChange?.();
    };

    return this.db.client
      .channel(`user-new-orders-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const next = payload.new as Record<string, unknown> | undefined;
          if (next?.['status'] === 'PENDING' && next?.['attended'] !== true) {
            emitOrder();
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tables' },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const previous = payload.old as Record<string, unknown> | undefined;
          const next = payload.new as Record<string, unknown> | undefined;
          if (!next) return;

          const observationChanged = Boolean(
            onObservationChange &&
            previous &&
            previous['observation'] !== next['observation'],
          );

          if (observationChanged) {
            // Guardar una observación también deja la mesa pendiente, pero el
            // usuario debe ver el aviso específico de OBSERVACIÓN, no dos avisos.
            emitObservation();
            return;
          }

          const becamePending = next['attended'] === false && previous?.['attended'] !== false;
          if (becamePending) {
            emitOrder();
          }
        },
      )
      .subscribe();
  }
}
