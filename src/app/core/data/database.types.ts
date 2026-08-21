export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {

  public: {

    Tables: {

      profiles: {
        Row: any;
        Insert: any;
        Update: any;
        Relationships: [];
      };

      floor_plans: {
        Row: any;
        Insert: any;
        Update: any;
        Relationships: [];
      };

      floor_plan_elements: {
        Row: any;
        Insert: any;
        Update: any;
        Relationships: [];
      };

      tables: {
        Row: any;
        Insert: any;
        Update: any;
        Relationships: [];
      };

      reservations: {
        Row: any;
        Insert: any;
        Update: any;
        Relationships: [];
      };

      product_categories: {
        Row: any;
        Insert: any;
        Update: any;
        Relationships: [];
      };

      products: {
        Row: any;
        Insert: any;
        Update: any;
        Relationships: [];
      };

      orders: {
        Row: any;
        Insert: any;
        Update: any;
        Relationships: [];
      };

      order_items: {
        Row: any;
        Insert: any;
        Update: any;
        Relationships: [];
      };

    };

    Views: Record<string, never>;

    Functions: {

      replace_floor_plan_snapshot: {
        Args: {
          p_floor_plan_id: string;
          p_elements: Json;
          p_tables: Json;
        };
        Returns: undefined;
      };

    };

    Enums: {
      app_role:
        | 'ADMIN'
        | 'WAITER'
        | 'BARTENDER'
        | 'MANAGER';

      table_shape:
        | 'circle'
        | 'rectangle';

      table_type:
        | 'TABLE'
        | 'RESERVED';

      floor_element_kind:
        | 'wall'
        | 'zone'
        | 'door'
        | 'text';

      order_status:
        | 'OPEN'
        | 'CLOSED'
        | 'CANCELLED';

      order_item_status:
        | 'PENDING'
        | 'PLACED'
        | 'CANCELLED';
    };

    CompositeTypes: Record<string, never>;

  };

}