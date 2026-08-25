import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import type { Order, OrderItem, Product } from '../models/models';

export interface ProductAssignmentItem {
  product_id: string;
  quantity: number;
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  constructor(public db: SupabaseService) {}

  async forTable(tableId: string): Promise<{
    order: Order | null;
    items: Array<OrderItem & { product: Product }>;
  }> {
    const { data: orders, error } = await this.db.client
      .from('orders')
      .select('*')
      .eq('table_id', tableId)
      .eq('status', 'OPEN')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    const order = (orders?.[0] as Order | undefined) ?? null;

    if (!order) {
      return {
        order: null,
        items: [],
      };
    }

    const { data, error: itemError } = await this.db.client
      .from('order_items')
      .select('*, product:products(*)')
      .eq('order_id', order.id)
      .neq('status', 'CANCELLED')
      .order('created_at');

    if (itemError) throw itemError;

    return {
      order,
      items: (data as Array<OrderItem & { product: Product }>) ?? [],
    };
  }

  async addItem(tableId: string, productId: string, quantity: number, userId: string): Promise<void> {
    const { data: order, error } = await this.db.client
      .from('orders')
      .select('id')
      .eq('table_id', tableId)
      .eq('status', 'OPEN')
      .maybeSingle();

    if (error) throw error;

    let orderId = (order as { id?: string } | null)?.id;

    if (!orderId) {
      const { data: created, error: createError } = await this.db.client
        .from('orders')
        .insert({
          table_id: tableId,
          created_by: userId,
        })
        .select('id')
        .single();

      if (createError) throw createError;

      orderId = (created as { id: string }).id;
    }

    const { data: existingItem, error: existingError } = await this.db.client
      .from('order_items')
      .select('id, quantity')
      .eq('order_id', orderId)
      .eq('product_id', productId)
      .neq('status', 'CANCELLED')
      .maybeSingle();

    if (existingError) throw existingError;

    if (existingItem) {
      const current = existingItem as { id: string; quantity: number };
      const { error: updateError } = await this.db.client
        .from('order_items')
        .update({
          quantity: current.quantity + quantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', current.id);

      if (updateError) throw updateError;
      return;
    }

    const { error: itemError } = await this.db.client.from('order_items').insert({
      order_id: orderId,
      product_id: productId,
      quantity,
      created_by: userId,
    });

    if (itemError) throw itemError;
  }

  async assignProducts(tableId: string, items: ProductAssignmentItem[]): Promise<string> {
    if (!items.length) {
      throw new Error('Selecciona al menos un producto');
    }

    const { data, error } = await (this.db.client as any).rpc('assign_products_to_table', {
      p_table_id: tableId,
      p_items: items,
    });

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error('Supabase no devolvió el ID del pedido');
    }

    return data as string;
  }

  async markPlaced(itemId: string, userId: string): Promise<void> {
    const { error } = await this.db.client
      .from('order_items')
      .update({
        status: 'PLACED',
        placed_by: userId,
        placed_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .eq('status', 'PENDING');

    if (error) throw error;
  }

  subscribe(onChange: () => void, channelName = 'orders-realtime') {
    return this.db.client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        onChange,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_items',
        },
        onChange,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tables',
        },
        onChange,
      )
      .subscribe();
  }
}
