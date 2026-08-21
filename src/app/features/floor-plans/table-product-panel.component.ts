import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonSelect,
  IonSelectOption,
  IonSpinner
} from '@ionic/angular/standalone';

import { FloorPlanService } from '../../core/services/floor-plan.service';
import { ProductService } from '../../core/services/product.service';
import { OrderService } from '../../core/services/order.service';
import type { ClubTable, FloorPlan, OrderItem, Product, ProductCategory } from '../../core/models/models';

type AssignmentTarget = ClubTable & { displayName: string; kindLabel: string };
type ListedItem = OrderItem & { product: Product };
type ListedTarget = AssignmentTarget & { items: ListedItem[] };

type QuantityMap = Record<string, number>;

@Component({
  selector: 'app-table-product-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonButton,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonSelect,
    IonSelectOption,
    IonSpinner
  ],
  template: `
    <aside class="product-panel">
      <div class="panel-header">
        <div>
          <span class="eyebrow">OPERATIVA</span>
          <h2>Mesas y reservados</h2>
          <p>{{ listedTargets.length }} elementos en el plano</p>
        </div>
        <ion-button class="add-button" (click)="openDialog()" [disabled]="loading || availableTargets.length === 0">
          + Agregar producto
        </ion-button>
      </div>

      @if (loading) {
        <div class="panel-loading"><ion-spinner></ion-spinner><span>Cargando estado...</span></div>
      } @else {
        <div class="target-list">
          @for (target of listedTargets; track target.id) {
            <article class="target-card" [class.attended]="target.attended" [class.pending]="!target.attended">
              <div class="target-title-row">
                <div>
                  <span class="kind">{{ target.kindLabel }}</span>
                  <strong>{{ target.displayName }}</strong>
                </div>
                <span class="status-dot" [class.green]="target.attended" [class.red]="!target.attended"></span>
              </div>

              @if (target.items.length > 0) {
                <div class="item-list">
                  @for (item of target.items; track item.id) {
                    <div class="assigned-item">
                      <span>{{ item.product.name }}</span>
                      <strong>x{{ item.quantity }}</strong>
                    </div>
                  }
                </div>
              } @else {
                <div class="no-items">Sin productos asignados</div>
              }
            </article>
          } @empty {
            <div class="empty-panel">
              <strong>No hay mesas ni reservados</strong>
              <span>Guarda primero el esquema del plano.</span>
            </div>
          }
        </div>
      }
    </aside>

    @if (dialogOpen) {
      <div class="dialog-backdrop" (click)="closeDialog()">
        <section class="assignment-dialog" (click)="$event.stopPropagation()">
          <header class="dialog-header">
            <div>
              <span class="eyebrow">ASIGNAR PRODUCTOS</span>
              <h2>Alcohol y refrescos</h2>
              <p>Selecciona una mesa o reservado y prepara su pedido.</p>
            </div>
            <button type="button" class="close-button" (click)="closeDialog()">×</button>
          </header>

          <div class="dialog-body">
            <ion-select label="Mesa / reservado" labelPlacement="stacked" fill="outline" [(ngModel)]="selectedTargetId" (ionChange)="onTargetChange()">
              <ion-select-option [value]="''">Seleccionar...</ion-select-option>
              @for (target of availableTargets; track target.id) {
                <ion-select-option [value]="target.id">{{ target.displayName }}</ion-select-option>
              }
            </ion-select>

            @if (selectedTargetId) {
              <section class="product-section">
                <h3>Alcohol</h3>
                @for (product of alcoholProducts; track product.id) {
                  <div class="product-line">
                    <span>{{ product.name }}</span>
                    <div class="quantity-control">
                      <button type="button" (click)="changeQuantity(alcoholQuantities, product.id, -1)">−</button>
                      <strong>{{ alcoholQuantities[product.id] || 0 }}</strong>
                      <button type="button" (click)="changeQuantity(alcoholQuantities, product.id, 1)">+</button>
                    </div>
                  </div>
                } @empty {
                  <p class="empty-products">No hay productos de alcohol en el inventario.</p>
                }
              </section>

              <section class="product-section">
                <h3>Refrescos</h3>
                @for (product of softDrinkProducts; track product.id) {
                  <div class="product-line">
                    <span>{{ product.name }}</span>
                    <div class="quantity-control">
                      <button type="button" (click)="changeQuantity(softDrinkQuantities, product.id, -1)">−</button>
                      <strong>{{ softDrinkQuantities[product.id] || 0 }}</strong>
                      <button type="button" (click)="changeQuantity(softDrinkQuantities, product.id, 1)">+</button>
                    </div>
                  </div>
                } @empty {
                  <p class="empty-products">No hay refrescos en el inventario.</p>
                }
              </section>
            }
          </div>

          <footer class="dialog-actions">
            <span class="dialog-error">{{ errorMessage }}</span>
            <ion-button fill="outline" (click)="closeDialog()">Cancelar</ion-button>
            <ion-button class="save-button" [disabled]="saving || !selectedTargetId || selectedItemCount === 0" (click)="saveAssignment()">
              @if (saving) { <ion-spinner name="crescent"></ion-spinner> } @else { Guardar asignación }
            </ion-button>
          </footer>
        </section>
      </div>
    }
  `,
  styles: [`
    :host { display:block; min-width:320px; height:100%; }
    .product-panel { height:100%; min-height:65vh; background:#fffaf7; border-left:1px solid #e4d7ce; display:flex; flex-direction:column; overflow:hidden; }
    .panel-header { padding:18px; border-bottom:1px solid #eadfd8; display:flex; flex-direction:column; gap:12px; }
    .eyebrow,.kind { font-size:10px; font-weight:900; letter-spacing:.13em; color:#9a6749; }
    .panel-header h2 { margin:4px 0; color:#2d211b; font-size:20px; }
    .panel-header p { margin:0; color:#887970; font-size:12px; }
    .add-button,.save-button { --background:#65412e; --color:#fff; --border-radius:10px; font-weight:800; }
    .target-list { overflow:auto; padding:12px; display:flex; flex-direction:column; gap:10px; }
    .target-card { border:1px solid #e4d7ce; border-radius:14px; padding:13px; background:#fff; box-shadow:0 5px 15px rgba(70,43,29,.05); }
    .target-card.pending { border-left:5px solid #c94141; }
    .target-card.attended { border-left:5px solid #3f9b63; }
    .target-title-row { display:flex; justify-content:space-between; align-items:center; gap:10px; }
    .target-title-row > div { display:flex; flex-direction:column; gap:2px; }
    .target-title-row strong { color:#3d2a20; font-size:15px; }
    .status-dot { width:12px; height:12px; border-radius:50%; flex:0 0 auto; }
    .status-dot.red { background:#c94141; box-shadow:0 0 0 4px rgba(201,65,65,.12); }
    .status-dot.green { background:#3f9b63; box-shadow:0 0 0 4px rgba(63,155,99,.12); }
    .item-list { margin-top:10px; border-top:1px solid #f0e8e2; padding-top:8px; display:flex; flex-direction:column; gap:5px; }
    .assigned-item { display:flex; justify-content:space-between; color:#59473d; font-size:13px; }
    .assigned-item strong { color:#65412e; }
    .no-items,.empty-panel,.empty-products { color:#9a8c84; font-size:12px; }
    .empty-panel { margin:20px 8px; padding:22px; border:1px dashed #d9ccc3; border-radius:14px; text-align:center; display:flex; flex-direction:column; gap:5px; }
    .panel-loading { flex:1; display:grid; place-items:center; color:#887970; gap:8px; }
    .dialog-backdrop { position:fixed; inset:0; z-index:1000; background:rgba(38,25,18,.42); display:grid; place-items:center; padding:20px; }
    .assignment-dialog { width:min(620px,100%); max-height:min(90vh,800px); overflow:hidden; background:#fff; border-radius:20px; box-shadow:0 25px 80px rgba(0,0,0,.28); display:flex; flex-direction:column; }
    .dialog-header { padding:22px 24px 16px; display:flex; justify-content:space-between; gap:20px; border-bottom:1px solid #eee5df; }
    .dialog-header h2 { margin:4px 0; font-size:23px; color:#2d211b; }
    .dialog-header p { margin:0; font-size:13px; color:#887970; }
    .close-button { width:34px; height:34px; border:0; border-radius:10px; background:#f4eee9; color:#65412e; font-size:25px; cursor:pointer; }
    .dialog-body { padding:20px 24px; overflow:auto; }
    .product-section { margin-top:20px; }
    .product-section h3 { margin:0 0 9px; color:#65412e; font-size:15px; }
    .product-line { display:flex; align-items:center; justify-content:space-between; padding:9px 0; border-bottom:1px solid #f1e9e4; gap:15px; }
    .product-line span { color:#4f3b31; font-size:14px; }
    .quantity-control { display:flex; align-items:center; gap:10px; }
    .quantity-control button { width:34px; height:34px; border:1px solid #d8c7bb; border-radius:9px; background:#fffaf7; color:#65412e; font-size:20px; cursor:pointer; }
    .quantity-control strong { min-width:24px; text-align:center; }
    .dialog-actions { display:flex; align-items:center; justify-content:flex-end; gap:10px; padding:15px 24px 20px; border-top:1px solid #eee5df; }
    .dialog-error { margin-right:auto; color:#b53b3b; font-size:12px; }
    @media(max-width:850px) { :host { min-width:280px; } .panel-header { padding:12px; } .dialog-header,.dialog-body,.dialog-actions { padding-left:16px; padding-right:16px; } }
  `]
})
export class TableProductPanelComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) plan!: FloorPlan;

  listedTargets: ListedTarget[] = [];
  availableTargets: AssignmentTarget[] = [];
  alcoholProducts: Product[] = [];
  softDrinkProducts: Product[] = [];
  dialogOpen = false;
  loading = false;
  saving = false;
  selectedTargetId = '';
  alcoholQuantities: QuantityMap = {};
  softDrinkQuantities: QuantityMap = {};
  errorMessage = '';
  private realtimeChannel: any;
  private loadVersion = 0;

  constructor(
    private readonly floors: FloorPlanService,
    private readonly products: ProductService,
    private readonly orders: OrderService
  ) {}

  get selectedItemCount(): number {
    return Object.values({ ...this.alcoholQuantities, ...this.softDrinkQuantities })
      .reduce((sum, quantity) => sum + (quantity || 0), 0);
  }

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    if (changes['plan']?.currentValue?.id) {
      await this.load();
      this.subscribeRealtime();
    }
  }

  ngOnDestroy(): void {
    this.realtimeChannel?.unsubscribe?.();
  }

  async load(): Promise<void> {
    const version = ++this.loadVersion;
    this.loading = true;
    try {
      const [snapshot, productList, categoryList] = await Promise.all([
        this.floors.load(this.plan.id),
        this.products.products(),
        this.products.categories()
      ]);
      if (version !== this.loadVersion) return;

      const targets = [
        ...(snapshot.tables ?? []),
        ...((snapshot as any).reserved ?? [])
      ].sort((a, b) => a.type === b.type ? a.number - b.number : a.type === 'TABLE' ? -1 : 1);

      const categoryById = new Map(categoryList.map(category => [category.id, category]));
      this.alcoholProducts = productList.filter(product => this.isAlcohol(categoryById.get(product.category_id)));
      this.softDrinkProducts = productList.filter(product => this.isSoftDrink(categoryById.get(product.category_id)));

      const orderResults = await Promise.all(targets.map(table => this.orders.forTable(table.id)));
      if (version !== this.loadVersion) return;

      this.listedTargets = targets.map((table, index) => ({
        ...table,
        displayName: `${table.type === 'RESERVED' ? 'Reservado' : 'Mesa'} ${table.number}`,
        kindLabel: table.type === 'RESERVED' ? 'RESERVADO' : 'MESA',
        items: orderResults[index]?.items ?? []
      }));

      const assignedIds = new Set(
        this.listedTargets.filter(target => target.items.length > 0).map(target => target.id)
      );
      this.availableTargets = this.listedTargets.filter(target => !assignedIds.has(target.id));
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'No se pudo cargar la operativa';
    } finally {
      if (version === this.loadVersion) this.loading = false;
    }
  }

  openDialog(): void {
    this.errorMessage = '';
    this.selectedTargetId = '';
    this.alcoholQuantities = {};
    this.softDrinkQuantities = {};
    this.dialogOpen = true;
  }

  closeDialog(): void {
    if (this.saving) return;
    this.dialogOpen = false;
    this.errorMessage = '';
  }

  onTargetChange(): void {
    this.errorMessage = '';
  }

  changeQuantity(target: QuantityMap, productId: string, delta: number): void {
    const next = Math.max(0, (target[productId] || 0) + delta);
    if (next === 0) delete target[productId];
    else target[productId] = next;
  }

  async saveAssignment(): Promise<void> {
    if (!this.selectedTargetId || this.selectedItemCount === 0 || this.saving) return;
    this.saving = true;
    this.errorMessage = '';
    try {
      const items = [
        ...Object.entries(this.alcoholQuantities),
        ...Object.entries(this.softDrinkQuantities)
      ].map(([product_id, quantity]) => ({ product_id, quantity }));

      await this.orders.assignProducts(this.selectedTargetId, items);
      this.dialogOpen = false;
      await this.load();
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'No se pudo guardar la asignación';
    } finally {
      this.saving = false;
    }
  }

  private subscribeRealtime(): void {
    this.realtimeChannel?.unsubscribe?.();
    this.realtimeChannel = this.orders.subscribe(() => void this.load());
  }

  private isAlcohol(category?: ProductCategory): boolean {
    const name = category?.name?.toLowerCase() ?? '';
    return name.includes('alcohol');
  }

  private isSoftDrink(category?: ProductCategory): boolean {
    const name = category?.name?.toLowerCase() ?? '';
    return name.includes('refresco') || name.includes('soft drink') || name.includes('softdrink') || name.includes('soda') || name.includes('mix');
  }
}
