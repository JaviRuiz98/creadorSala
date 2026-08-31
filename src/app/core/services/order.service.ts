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

  async addItem(tableId: string, productId: string, quantity: number, _userId: string): Promise<void> {
    if (!productId || quantity < 1) {
      throw new Error('Producto o cantidad no válidos');
    }

    // Centralizamos el alta en la RPC transaccional. Además de evitar carreras
    // al crear el pedido, la RPC vuelve a poner el producto en PENDING si ya
    // había sido servido anteriormente y marca la mesa como no atendida.
    await this.assignProducts(tableId, [
      { product_id: productId, quantity: Math.floor(quantity) },
    ]);
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
        attended: true,
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
