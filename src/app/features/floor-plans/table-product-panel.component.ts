import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonButton, IonSelect, IonSelectOption, IonSpinner } from '@ionic/angular/standalone';

import { FloorPlanService } from '../../core/services/floor-plan.service';
import { ProductService } from '../../core/services/product.service';
import { OrderService } from '../../core/services/order.service';
import { AuthService } from '../../core/auth/auth.service';
import type { ClubTable, FloorPlan, OrderItem, Product, ProductCategory } from '../../core/models/models';

type AssignmentTarget = ClubTable & { displayName: string; kindLabel: string };
type ListedItem = OrderItem & { product: Product };
type ListedTarget = AssignmentTarget & { items: ListedItem[] };

type QuantityMap = Record<string, number>;

@Component({
  selector: 'app-table-product-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, IonButton, IonSelect, IonSelectOption, IonSpinner],
  templateUrl: './table-product-panel.component.html',
  styleUrl: './table-product-panel.component.scss',
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
    private readonly orders: OrderService,
    private readonly auth: AuthService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  get isAdmin(): boolean {
    return this.auth.hasRole('ADMIN');
  }


  get pendingTargets(): ListedTarget[] {
    return this.listedTargets
      .filter((target) => target.items.length > 0 && !target.attended)
      .sort((a, b) => a.type === b.type ? a.number - b.number : a.type === 'TABLE' ? -1 : 1);
  }

  get attendedTables(): ListedTarget[] {
    return this.listedTargets
      .filter((target) => target.type === 'TABLE' && !this.pendingTargets.some((pending) => pending.id === target.id))
      .sort((a, b) => a.number - b.number);
  }

  get attendedReserved(): ListedTarget[] {
    return this.listedTargets
      .filter((target) => target.type === 'RESERVED' && !this.pendingTargets.some((pending) => pending.id === target.id))
      .sort((a, b) => a.number - b.number);
  }

  get selectedItemCount(): number {
    return Object.values({ ...this.alcoholQuantities, ...this.softDrinkQuantities }).reduce((sum, quantity) => sum + (quantity || 0), 0);
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
        this.products.categories(),
      ]);
      if (version !== this.loadVersion) return;

      const targets = [...(snapshot.tables ?? []), ...(snapshot.reserved ?? [])].sort((a, b) =>
        a.type === b.type ? a.number - b.number : a.type === 'TABLE' ? -1 : 1,
      );

      const categoryById = new Map(categoryList.map((category) => [category.id, category]));
      this.alcoholProducts = productList.filter((product) => this.isAlcohol(categoryById.get(product.category_id)));
      this.softDrinkProducts = productList.filter((product) => this.isSoftDrink(categoryById.get(product.category_id)));

      const orderResults = await Promise.all(targets.map((table) => this.orders.forTable(table.id)));
      if (version !== this.loadVersion) return;

      this.listedTargets = targets.map((table, index) => ({
        ...table,
        displayName: `${table.type === 'RESERVED' ? 'Reservado' : 'Mesa'} ${table.number}`,
        kindLabel: table.type === 'RESERVED' ? 'RESERVADO' : 'MESA',
        items: orderResults[index]?.items ?? [],
      }));

      const assignedIds = new Set(this.listedTargets.filter((target) => target.items.length > 0).map((target) => target.id));
      this.availableTargets = this.listedTargets.filter((target) => !assignedIds.has(target.id));
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'No se pudo cargar la operativa';
    } finally {
      if (version === this.loadVersion) {
        this.loading = false;
        this.cdr.detectChanges();
      }
    }
  }

  openDialog(): void {
    if (!this.isAdmin) return;
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
    if (!this.isAdmin) return;
    if (!this.selectedTargetId || this.selectedItemCount === 0 || this.saving) return;
    this.saving = true;
    this.errorMessage = '';
    try {
      const items = [...Object.entries(this.alcoholQuantities), ...Object.entries(this.softDrinkQuantities)].map(
        ([product_id, quantity]) => ({ product_id, quantity }),
      );

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
    this.realtimeChannel = this.orders.subscribe(() => void this.load(), `table-product-panel-${this.plan.id}`);
  }

  private isAlcohol(category?: ProductCategory): boolean {
    const name = category?.name?.toLowerCase() ?? '';
    return name.includes('alcohol');
  }

  private isSoftDrink(category?: ProductCategory): boolean {
    const name = category?.name?.toLowerCase() ?? '';
    return (
      name.includes('refresco') ||
      name.includes('soft drink') ||
      name.includes('softdrink') ||
      name.includes('soda') ||
      name.includes('mix')
    );
  }
}
