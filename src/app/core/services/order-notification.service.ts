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
        { event: 'INSERT', schema: 'public', table: 'order_items' },
        (_payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => onNewOrder(),
      )
      .subscribe();
  }
}
