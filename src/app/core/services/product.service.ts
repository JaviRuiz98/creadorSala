import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import type { Product, ProductCategory } from '../models/models';
@Injectable({ providedIn: 'root' })
export class ProductService {
  constructor(private db: SupabaseService) {}
  async categories(): Promise<ProductCategory[]> {
    const { data, error } = await this.db.client.from('product_categories').select('*').order('sort_order');
    if (error) throw error;
    return data as ProductCategory[];
  }
  async products(): Promise<Product[]> {
    const { data, error } = await this.db.client.from('products').select('*').eq('active', true).order('name');
    if (error) throw error;
    return data as Product[];
  }
  async createCategory(name: string): Promise<ProductCategory> {
    const { data, error } = await this.db.client.from('product_categories').insert({ name }).select().single();
    if (error) throw error;
    return data as ProductCategory;
  }
  async createProduct(categoryId: string, name: string): Promise<Product> {
    const { data, error } = await this.db.client.from('products').insert({ category_id: categoryId, name, price: null }).select().single();
    if (error) throw error;
    return data as Product;
  }
  async updateProduct(id: string, patch: Partial<Product>): Promise<void> {
    const { error } = await this.db.client.from('products').update(patch).eq('id', id);
    if (error) throw error;
  }
}
