export type Role = 'ADMIN' | 'WAITER' | 'BARTENDER' | 'MANAGER';
export type TableShape = 'circle' | 'rectangle';
export type OrderStatus = 'OPEN' | 'CLOSED' | 'CANCELLED';
export type OrderItemStatus = 'PENDING' | 'PLACED' | 'CANCELLED';

export interface Profile { id: string; full_name: string | null; role: Role; created_at: string; updated_at: string; }
export interface FloorPlan { id: string; name: string; width: number; height: number; is_active: boolean; created_by: string; created_at: string; updated_at: string; }
export type FloorElementKind =
  | 'wall'
  | 'zone'
  | 'door'
  | 'text'
  | 'reserved';

  export interface FloorPlanElement {
  id: string;
  floor_plan_id: string;
  kind: FloorElementKind;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  points: number[] | null;
  label: string | null;
  number?: number | null;
  z_index: number;
  created_at: string;
  updated_at: string;
}
export interface ClubTable { id: string; floor_plan_id: string; number: number; x: number; y: number; width: number; height: number; rotation: number; shape: TableShape; created_at: string; updated_at: string; }
export interface ProductCategory { id: string; name: string; sort_order: number; created_at: string; updated_at: string; }
export interface Product { id: string; category_id: string; name: string; price: number; active: boolean; created_at: string; updated_at: string; }
export interface Order { id: string; table_id: string; created_by: string; status: OrderStatus; created_at: string; updated_at: string; }
export interface OrderItem { id: string; order_id: string; product_id: string; quantity: number; status: OrderItemStatus; created_by: string; placed_by: string | null; placed_at: string | null; created_at: string; updated_at: string; }

export interface FloorSnapshot { elements: FloorPlanElement[]; tables: ClubTable[]; }
