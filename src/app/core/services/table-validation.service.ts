import { Injectable } from '@angular/core';
import type { ClubTable } from '../models/models';
@Injectable({ providedIn: 'root' })
export class TableValidationService {
  validateUniqueNumbers(tables: ClubTable[]): boolean {
    const s = new Set(tables.map((t) => t.number));
    return s.size === tables.length;
  }
  clampPosition(table: ClubTable, width: number, height: number): ClubTable {
    return { ...table, x: Math.max(0, Math.min(table.x, width - table.width)), y: Math.max(0, Math.min(table.y, height - table.height)) };
  }
}
