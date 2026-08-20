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


    const allTables =
      (tablesResult.data ?? []) as ClubTable[];


    return {

      elements:
        elementsResult.data as FloorPlanElement[],

      /*
       * La tabla de Supabase contiene tanto
       * mesas normales como reservados.
       *
       * Separamos ambos tipos para que el
       * componente pueda trabajar con ellos
       * independientemente.
       */
      tables:
        allTables.filter(
          table =>
            table.type !== 'RESERVED'
        ),

      reserved:
        allTables.filter(
          table =>
            table.type === 'RESERVED'
        )

    } as FloorSnapshot;
  }


  async saveSnapshot(
    planId: string,
    snapshot: FloorSnapshot
  ): Promise<void> {

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
    const allTables: ClubTable[] = [

      ...(snapshot.tables ?? []),

      ...(
        (snapshot as any).reserved ?? []
      )

    ];


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
         * Se envían tanto TABLE como RESERVED.
         */
        p_tables:
          allTables.map(
            ({
              id,
              ...table
            }) => table
          )

      }
    );


    if (rpcError) {
      throw rpcError;
    }
  }

}

