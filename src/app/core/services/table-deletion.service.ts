import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export type DeleteTableResult =
  { ok: true; reason: 'DELETED' | 'NOT_PERSISTED' } | { ok: false; reason: 'BAD_PASSWORD' | 'SERVED_PRODUCTS' | string };

@Injectable({ providedIn: 'root' })
export class TableDeletionService {
  constructor(private readonly db: SupabaseService) {}

  async delete(tableId: string, password: string, force = false): Promise<DeleteTableResult> {
    const { data, error } = await this.db.client.rpc('delete_table_with_orders', {
      p_table_id: tableId,
      p_secret: password,
      p_force: force,
    });
    if (error) throw error;
    return data as DeleteTableResult;
  }
}
