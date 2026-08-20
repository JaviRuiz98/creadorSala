import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import type { ClubTable, FloorPlan, FloorPlanElement, FloorSnapshot } from '../models/models';

@Injectable({providedIn:'root'})
export class FloorPlanService {
  constructor(private readonly db: SupabaseService) {}
  async list(): Promise<FloorPlan[]> { const {data,error}=await this.db.client.from('floor_plans').select('*').order('name'); if(error) throw error; return data as FloorPlan[]; }
  async create(name:string, width=2000,height=1200,userId:string):Promise<FloorPlan>{ const {data,error}=await this.db.client.from('floor_plans').insert({name,width,height,created_by:userId}).select().single(); if(error) throw error; return data as FloorPlan; }
  async update(planId:string, patch:Partial<FloorPlan>):Promise<void>{const {error}=await this.db.client.from('floor_plans').update(patch).eq('id',planId);if(error)throw error;}
  async remove(planId:string):Promise<void>{const {error}=await this.db.client.from('floor_plans').delete().eq('id',planId);if(error)throw error;}
  async load(planId:string):Promise<FloorSnapshot>{const [e,t]=await Promise.all([this.db.client.from('floor_plan_elements').select('*').eq('floor_plan_id',planId).order('z_index'),this.db.client.from('tables').select('*').eq('floor_plan_id',planId).order('number')]); if(e.error)throw e.error;if(t.error)throw t.error;return {elements:e.data as FloorPlanElement[],tables:t.data as ClubTable[]};}
  async saveSnapshot(planId:string,snapshot:FloorSnapshot):Promise<void>{const {error:rpcError}=await this.db.client.rpc('replace_floor_plan_snapshot',{p_floor_plan_id:planId,p_elements:snapshot.elements.map(({id,...x})=>x),p_tables:snapshot.tables.map(({id,...x})=>x)});if(rpcError)throw rpcError;}
}
