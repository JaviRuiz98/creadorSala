import { Injectable } from '@angular/core';
import { FloorPlanService } from './floor-plan.service';
import type { FloorPlan, FloorSnapshot } from '../models/models';

@Injectable({ providedIn: 'root' })
export class PlanDuplicationService {
  constructor(private readonly floors: FloorPlanService) {}

  async duplicate(plan: FloorPlan, userId: string, copyName: string): Promise<FloorPlan> {
    const source = await this.floors.load(plan.id);
    const copy = await this.floors.create(copyName, plan.width, plan.height, userId);
    const clone: FloorSnapshot = {
      elements: source.elements.map((element) => ({
        ...structuredClone(element),
        id: crypto.randomUUID(),
        floor_plan_id: copy.id,
      })),
      tables: source.tables.map((table) => ({
        ...structuredClone(table),
        id: crypto.randomUUID(),
        floor_plan_id: copy.id,
        attended: false,
        observation: null,
      })),
      reserved: (source.reserved ?? []).map((table) => ({
        ...structuredClone(table),
        id: crypto.randomUUID(),
        floor_plan_id: copy.id,
        attended: false,
        observation: null,
      })),
    };
    await this.floors.saveSnapshot(copy.id, clone);
    if (plan.is_locked) {
      await this.floors.setLocked(copy.id, true);
      copy.is_locked = true;
    }
    return copy;
  }
}
