import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonButton, IonSelect, IonSelectOption, IonSpinner } from '@ionic/angular/standalone';

import { FloorPlanService } from '../../core/services/floor-plan.service';
import { ProductService } from '../../core/services/product.service';
import { OrderService } from '../../core/services/order.service';
import { AuthService } from '../../core/auth/auth.service';
import type { ClubTable, FloorPlan, OrderItem, Product } from '../../core/models/models';

type AssignmentTarget = ClubTable & { displayName: string; kindLabel: string };
type ListedItem = OrderItem & { product: Product };
type ListedTarget = AssignmentTarget & { items: ListedItem[] };

type QuantityMap = Record<string, number>;
type ProductGroup = { id: string; name: string; products: Product[] };

@Component({
  selector: 'app-table-product-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, IonButton, IonSelect, IonSelectOption, IonSpinner],
  templateUrl: './table-product-panel.component.html',
  styleUrl: './table-product-panel.component.scss',
})
export class TableProductPanelComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) plan!: FloorPlan;
  @Output() targetSelected = new EventEmitter<ClubTable>();

  listedTargets: ListedTarget[] = [];
  availableTargets: AssignmentTarget[] = [];
  productGroups: ProductGroup[] = [];
  dialogOpen = false;
  loading = false;
  saving = false;
  selectedTargetId = '';
  productQuantities: QuantityMap = {};
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
    return Object.values(this.productQuantities).reduce((sum, quantity) => sum + (quantity || 0), 0);
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

      this.productGroups = categoryList
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
        .map((category) => ({
          id: category.id,
          name: category.name,
          products: productList.filter((product) => product.active !== false && product.category_id === category.id),
        }))
        .filter((group) => group.products.length > 0);

      const knownCategoryIds = new Set(categoryList.map((category) => category.id));
      const uncategorized = productList.filter((product) => product.active !== false && !knownCategoryIds.has(product.category_id));
      if (uncategorized.length) {
        this.productGroups.push({ id: 'uncategorized', name: 'Otros', products: uncategorized });
      }

      const orderResults = await Promise.all(targets.map((table) => this.orders.forTable(table.id)));
      if (version !== this.loadVersion) return;

      this.listedTargets = targets.map((table, index) => ({
        ...table,
        displayName: `${table.type === 'RESERVED' ? 'Reservado' : 'Mesa'} ${table.number}`,
        kindLabel: table.type === 'RESERVED' ? 'RESERVADO' : 'MESA',
        items: orderResults[index]?.items ?? [],
      }));

      // Se puede añadir un nuevo pedido también a mesas/reservados con histórico atendido.
      this.availableTargets = [...this.listedTargets];
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'No se pudo cargar la operativa';
    } finally {
      if (version === this.loadVersion) {
        this.loading = false;
        this.cdr.detectChanges();
      }
    }
  }


  selectTarget(target: ListedTarget): void {
    this.targetSelected.emit(target);
  }

  openDialog(): void {
    if (!this.isAdmin) return;
    this.errorMessage = '';
    this.selectedTargetId = '';
    this.productQuantities = {};
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
      const items = Object.entries(this.productQuantities).map(([product_id, quantity]) => ({ product_id, quantity }));

      await this.orders.assignProducts(this.selectedTargetId, items);
      this.dialogOpen = false;
      await this.load();
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'No se pudo guardar la asignación';
    } finally {
      this.saving = false;
    }
  }


  currentItems(target: ListedTarget): ListedItem[] {
    return target.items.filter((item) => item.status === 'PENDING' && item.attended !== true);
  }

  attendedItems(target: ListedTarget): ListedItem[] {
    return target.items.filter((item) => item.status === 'PLACED' || item.attended === true);
  }

  private subscribeRealtime(): void {
    this.realtimeChannel?.unsubscribe?.();
    this.realtimeChannel = this.orders.subscribe(() => void this.load(), `table-product-panel-${this.plan.id}`);
  }

}
