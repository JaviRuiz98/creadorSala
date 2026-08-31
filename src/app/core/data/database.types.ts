export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

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

      verify_app_secret: {
        Args: {
          p_key: string;
          p_secret: string;
        };
        Returns: boolean;
      };

      assign_products_to_table: {
        Args: {
          p_table_id: string;
          p_items: Json;
        };
        Returns: string;
      };

      set_table_attended: {
        Args: {
          p_table_id: string;
          p_attended: boolean;
        };
        Returns: undefined;
      };

      set_table_observation: {
        Args: {
          p_table_id: string;
          p_observation: string | null;
        };
        Returns: undefined;
      };

      delete_table_with_orders: {
        Args: {
          p_table_id: string;
          p_secret: string;
          p_force: boolean;
        };
        Returns: Json;
      };


      product_has_order_history: {
        Args: { p_product_id: string };
        Returns: boolean;
      };

      category_has_order_history: {
        Args: { p_category_id: string };
        Returns: boolean;
      };

      delete_product_safe: {
        Args: { p_product_id: string };
        Returns: boolean;
      };

      delete_category_safe: {
        Args: { p_category_id: string };
        Returns: boolean;
      };
    };

    Enums: {
      app_role: 'ADMIN' | 'USER';

      table_shape: 'circle' | 'rectangle';

      table_type: 'TABLE' | 'RESERVED';

      floor_element_kind: 'wall' | 'zone' | 'door' | 'text';

      order_status: 'OPEN' | 'CLOSED' | 'CANCELLED';

      order_item_status: 'PENDING' | 'PLACED' | 'CANCELLED';
    };

    CompositeTypes: Record<string, never>;
  };
}
