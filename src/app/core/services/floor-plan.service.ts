import { Injectable } from '@angular/core';

import { SupabaseService } from './supabase.service';

import type {
  ClubTable,
  FloorPlan,
  FloorPlanElement,
  FloorSnapshot
} from '../models/models';


@Injectable({
  providedIn: 'root'
})
export class FloorPlanService {

  constructor(
    private readonly db: SupabaseService
  ) {}


  async list(): Promise<FloorPlan[]> {

    const {
      data,
      error
    } = await this.db.client
      .from('floor_plans')
      .select('*')
      .order('name');

    if (error) {
      throw error;
    }

    return data as FloorPlan[];
  }


  async create(
    name: string,
    width = 2000,
    height = 1200,
    userId: string
  ): Promise<FloorPlan> {

    const {
      data,
      error
    } = await this.db.client
      .from('floor_plans')
      .insert({
        name,
        width,
        height,
        created_by: userId
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as FloorPlan;
  }


  async update(
    planId: string,
    patch: Partial<FloorPlan>
  ): Promise<void> {

    const {
      error
    } = await this.db.client
      .from('floor_plans')
      .update(patch)
      .eq(
        'id',
        planId
      );

    if (error) {
      throw error;
    }
  }


  async remove(
    planId: string
  ): Promise<void> {

    const {
      error
    } = await this.db.client
      .from('floor_plans')
      .delete()
      .eq(
        'id',
        planId
      );

    if (error) {
      throw error;
    }
  }


  /**
   * Carga el plano completo.
   *
   * Las mesas y los reservados se almacenan
   * en la misma tabla "tables".
   *
   * La diferencia entre ambos está en:
   *
   * type = 'TABLE'
   * type = 'RESERVED'
   *
   * Por tanto, ambos se cargan juntos en
   * snapshot.tables.
   */
  async load(
    planId: string
  ): Promise<FloorSnapshot> {

    const [
      elementsResult,
      tablesResult
    ] = await Promise.all([

      this.db.client
        .from('floor_plan_elements')
        .select('*')
        .eq(
          'floor_plan_id',
          planId
        )
        .order('z_index'),

      this.db.client
        .from('tables')
        .select('*')
        .eq(
          'floor_plan_id',
          planId
        )
        .order('number')

    ]);


    if (elementsResult.error) {
      throw elementsResult.error;
    }


    if (tablesResult.error) {
      throw tablesResult.error;
    }


    /*
     * IMPORTANTE:
     *
     * No filtramos por type.
     *
     * Aquí entran tanto:
     *
     * TABLE
     * RESERVED
     *
     * El componente PlanEditor será el encargado
     * de distinguirlos mediante t.type.
     */
    const tables =
      (tablesResult.data ?? []) as ClubTable[];


    return {

      elements:
        elementsResult.data as FloorPlanElement[],

      tables

    };
  }


  /**
   * Guarda el estado completo del plano.
   *
   * Mesas y reservados se guardan en la misma
   * tabla "tables".
   *
   * La propiedad "type" determina qué es cada
   * registro:
   *
   * TABLE    -> mesa
   * RESERVED -> reservado
   */
  async saveSnapshot(
    planId: string,
    snapshot: FloorSnapshot
  ): Promise<void> {

    const {
      error: rpcError
    } = await this.db.client.rpc(
      'replace_floor_plan_snapshot',
      {

        p_floor_plan_id:
          planId,

        p_elements:
          snapshot.elements.map(
            ({
              id,
              ...element
            }) => element
          ),

        /*
         * Aquí enviamos TODOS los objetos:
         *
         * - mesas
         * - reservados
         *
         * Cada uno conserva su "type".
         */
        p_tables:
          snapshot.tables.map(
            ({
              id,
              ...table
            }) => ({
              ...table,

              /*
               * Nos aseguramos de conservar
               * explícitamente el tipo.
               */
              type:
                table.type
            })
          )

      }
    );


    if (rpcError) {
      throw rpcError;
    }
  }

}