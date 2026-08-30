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

  async updateCategory(id: string, name: string): Promise<void> {
    const { error } = await this.db.client.from('product_categories').update({ name }).eq('id', id);
    if (error) throw error;
  }

  async productHasOrderHistory(productId: string): Promise<boolean> {
    const { data, error } = await this.db.client.rpc('product_has_order_history', { p_product_id: productId });
    if (error) throw error;
    return data === true;
  }

  async categoryHasOrderHistory(categoryId: string): Promise<boolean> {
    const { data, error } = await this.db.client.rpc('category_has_order_history', { p_category_id: categoryId });
    if (error) throw error;
    return data === true;
  }

  async deleteProductSafe(productId: string): Promise<boolean> {
    const { data, error } = await this.db.client.rpc('delete_product_safe', { p_product_id: productId });
    if (error) throw error;
    return data === true;
  }

  async deleteCategorySafe(categoryId: string): Promise<boolean> {
    const { data, error } = await this.db.client.rpc('delete_category_safe', { p_category_id: categoryId });
    if (error) throw error;
    return data === true;
  }
}
