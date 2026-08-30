import { Injectable } from '@angular/core';

import { SupabaseService } from './supabase.service';

import type { ClubTable, FloorPlan, FloorPlanElement, FloorSnapshot } from '../models/models';

@Injectable({
  providedIn: 'root',
})
export class FloorPlanService {
  constructor(public readonly db: SupabaseService) {}

  async list(): Promise<FloorPlan[]> {
    const { data, error } = await this.db.client.from('floor_plans').select('*').order('name');

    if (error) {
      throw error;
    }

    return data as FloorPlan[];
  }

  async create(name: string, width = 2000, height = 1200, userId: string): Promise<FloorPlan> {
    const { data, error } = await this.db.client
      .from('floor_plans')
      .insert({
        name,
        width,
        height,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as FloorPlan;
  }

  async update(planId: string, patch: Partial<FloorPlan>): Promise<void> {
    const { error } = await this.db.client.from('floor_plans').update(patch).eq('id', planId);

    if (error) {
      throw error;
    }
  }

  async remove(planId: string): Promise<void> {
    const { error } = await this.db.client.from('floor_plans').delete().eq('id', planId);

    if (error) {
      throw error;
    }
  }

  async load(planId: string): Promise<FloorSnapshot> {
    const [elementsResult, tablesResult] = await Promise.all([
      this.db.client.from('floor_plan_elements').select('*').eq('floor_plan_id', planId).order('z_index'),

      this.db.client.from('tables').select('*').eq('floor_plan_id', planId).order('number'),
    ]);

    if (elementsResult.error) {
      throw elementsResult.error;
    }

    if (tablesResult.error) {
      throw tablesResult.error;
    }

    const allTables = (tablesResult.data ?? []) as ClubTable[];

    return {
      elements: elementsResult.data as FloorPlanElement[],

      /*
       * La tabla de Supabase contiene tanto
       * mesas normales como reservados.
       *
       * Separamos ambos tipos para que el
       * componente pueda trabajar con ellos
       * independientemente.
       */
      tables: allTables.filter((table) => table.type !== 'RESERVED'),

      reserved: allTables.filter((table) => table.type === 'RESERVED'),
    } as FloorSnapshot;
  }

  async saveSnapshot(planId: string, snapshot: FloorSnapshot): Promise<void> {
    /*
     * IMPORTANTE:
     *
     * El componente mantiene las mesas normales
     * y los reservados en arrays separados.
     *
     * Supabase, sin embargo, guarda ambos en
     * la misma tabla "tables".
     *
     * Por eso aquí los combinamos antes de
     * enviarlos al RPC.
     */
    const allTables: ClubTable[] = [...(snapshot.tables ?? []), ...(snapshot.reserved ?? [])];

    const { error: rpcError } = await this.db.client.rpc('replace_floor_plan_snapshot', {
      p_floor_plan_id: planId,

      p_elements: snapshot.elements.map((element) => ({
        kind: element.kind,
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
        rotation: element.rotation,
        points: element.points,
        label: element.label,
        z_index: element.z_index,
      })),

      /*
       * IMPORTANTE: aquí SÍ se envía el id de cada mesa/reservado
       * (junto con type y attended). El RPC hace un upsert por id:
       * así las mesas que se mantienen conservan su fila real en
       * BBDD (y sus pedidos), las que ya no están en el array se
       * borran de verdad, y las nuevas se crean con el id que ya
       * generó el cliente. Se envían tanto TABLE como RESERVED.
       */
      p_tables: allTables.map((table) => ({
        id: table.id,
        type: table.type,
        number: table.number,
        x: table.x,
        y: table.y,
        width: table.width,
        height: table.height,
        rotation: table.rotation,
        shape: table.shape,
        attended: table.attended ?? false,
      })),
    });

    if (rpcError) {
      throw rpcError;
    }
  }

  /*
   * Actualiza el estado de "atendida" directamente en BBDD, sin tener
   * que reenviar todo el plano (evita reconstrucciones innecesarias y
   * que un guardado a medias del plano se lleve por delante el estado
   * de atención de la mesa).
   */
  async setTableAttended(tableId: string, attended: boolean): Promise<void> {
    const { error } = await this.db.client.rpc('set_table_attended', {
      p_table_id: tableId,
      p_attended: attended,
    });
    if (error) throw error;
  }

  /**
   * Devuelve únicamente el estado mutable de las mesas/reservados de un plano.
   * Se usa por Realtime para mantener sincronizado el color del canvas entre
   * dispositivos sin recargar toda la geometría del plano.
   */
  async loadTableAttentionStates(planId: string): Promise<Array<Pick<ClubTable, 'id' | 'attended' | 'updated_at'>>> {
    const { data, error } = await this.db.client
      .from('tables')
      .select('id,attended,updated_at')
      .eq('floor_plan_id', planId);

    if (error) throw error;
    return (data ?? []) as Array<Pick<ClubTable, 'id' | 'attended' | 'updated_at'>>;
  }

  async setLocked(planId: string, locked: boolean): Promise<void> {
    const { error } = await this.db.client.from('floor_plans').update({ is_locked: locked }).eq('id', planId);
    if (error) throw error;
  }
}
