import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  signal,
  SimpleChanges,
  ViewChild,
  WritableSignal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonButton, IonInput, IonInputPasswordToggle, IonLabel, IonModal, IonSelect, IonSelectOption } from '@ionic/angular/standalone';
import Konva from 'konva';
import { FloorPlanService } from '../../core/services/floor-plan.service';
import { GeometryService, Point } from '../../core/services/geometry.service';
import { AuthService } from '../../core/auth/auth.service';
import { OrderService } from '../../core/services/order.service';
import { ProductService } from '../../core/services/product.service';
import { TableDeletionService } from '../../core/services/table-deletion.service';
import type { ClubTable, FloorPlan, FloorPlanElement, FloorSnapshot, Product } from '../../core/models/models';

type EditorTool = 'select' | 'draw' | 'pan' | 'text';

@Component({
  selector: 'app-plan-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, IonButton, IonInput, IonInputPasswordToggle, IonLabel, IonModal, IonSelect, IonSelectOption],
  templateUrl: './plan-editor.component.html',
  styleUrl: './plan-editor.component.scss',
})
export class PlanEditorComponent implements OnChanges, OnDestroy {
  @Input({ required: true })
  plan!: FloorPlan;
  @Input()
  mode: 'editor' | 'operativo' = 'editor';
  @Output()
  pendingChanged = new EventEmitter<number>();
  @ViewChild('container', { static: true })
  container!: ElementRef<HTMLDivElement>;
  private stage!: Konva.Stage;
  private layer!: Konva.Layer;
  private draftLayer!: Konva.Layer;
  private drawingShape: Konva.Line | null = null;
  private ordersLoadRequestId = 0;
  private drawingPointerId: number | null = null;
  drawing: Point[] = [];
  elements: FloorPlanElement[] = [];
  tables: ClubTable[] = [];
  reserved: ClubTable[] = [];
  selectedTable: ClubTable | null = null;
  selectedReserved: ClubTable | null = null;
  selectedElementId: string | null = null;
  private activeEndpoint: 'start' | 'end' | null = null;
  private endpointShape: Konva.Circle | null = null;
  history: FloorSnapshot[] = [];
  historyIndex = -1;
  tool: EditorTool = 'select';
  showTextDialog = false;
  showUnlockDialog = false;
  showDeletePasswordDialog = false;
  showServedDeleteWarning = false;
  pendingDeleteTarget: ClubTable | null = null;
  deletePassword = '';
  deleteError = '';
  private verifiedDeletePassword = '';
  newText = '';
  private textPosition: Point | null = null;
  selectedProductId = '';
  quantity = 1;
  selectedAlcoholProductId = '';
  alcoholQuantity = 1;
  selectedSoftDrinkProductId = '';
  softDrinkQuantity = 1;
  products: Product[] = [];
  productCategories: Array<{ id: string; name: string }> = [];
  orderItems: WritableSignal<Array<any>> = signal([]);
  orderCountMap = new Map<string, number>();
  selectedPending = 0;
  get alcoholItems(): Array<any> {
    return this.orderItems().filter((i) => this.isAlcohol(i));
  }
  get softDrinkItems(): Array<any> {
    return this.orderItems().filter((i) => this.isSoftDrink(i));
  }
  get otherOrderItems(): Array<any> {
    return this.orderItems().filter((i) => !this.isAlcohol(i) && !this.isSoftDrink(i));
  }
  get alcoholProducts(): Product[] {
    return this.products.filter((p) => this.isAlcoholProduct(p));
  }
  get softDrinkProducts(): Product[] {
    return this.products.filter((p) => this.isSoftDrinkProduct(p));
  }
  private isAlcoholProduct(product: any): boolean {
    const name = this.categoryName(product);
    return name.includes('alcohol') || name.includes('alcoh');
  }
  private isSoftDrinkProduct(product: any): boolean {
    const name = this.categoryName(product);
    return name.includes('refresco') || name.includes('bebida');
  }
  private categoryName(product: any): string {
    const category = this.productCategories.find((c) => c.id === product?.category_id);
    return String(category?.name ?? product?.category?.name ?? '')
      .trim()
      .toLowerCase();
  }
  private isAlcohol(item: any): boolean {
    const name = this.categoryName(item?.product);
    return name.includes('alcohol') || name.includes('alcoh');
  }
  private isSoftDrink(item: any): boolean {
    const name = this.categoryName(item?.product);
    return name.includes('refresco') || name.includes('refrescos') || name.includes('bebida');
  }
  selectedOrderTarget: ClubTable | null = null;
  showOrderDialog = false;
  private realtimeChannel: any;
  pendingMap = new Map<string, number>();
  showSaveDialog = false;
  private _panMode = false;
  get panMode(): boolean {
    return this._panMode;
  }
  set panMode(value: boolean) {
    this._panMode = value;
  }
  get isAdmin(): boolean {
    return this.auth.hasRole('ADMIN');
  }
  get canManageOrders(): boolean {
    return this.isAdmin;
  }
  get canEditGeometry(): boolean {
    return this.isAdmin && this.mode === 'editor' && !this.plan?.is_locked;
  }

  get toolLabel(): string {
    if (this.tool === 'draw') {
      return 'Dibujar paredes';
    }
    if (this.tool === 'text') {
      return 'Añadir texto';
    }
    if (this.tool === 'pan') {
      return 'Mover plano';
    }
    return 'Seleccionar';
  }
  constructor(
    private floors: FloorPlanService,
    private geometry: GeometryService,
    private auth: AuthService,
    private orders: OrderService,
    private productService: ProductService,
    private tableDeletion: TableDeletionService,
    private cdr: ChangeDetectorRef,
  ) {}
  async ngOnChanges(changes: SimpleChanges) {
    if (changes['plan']?.currentValue) {
      await this.load();
    }
  }
  private getLineEndpoints(e: FloorPlanElement): {
    start: Point;
    end: Point;
  } | null {
    if (!e.points || e.points.length < 4) {
      return null;
    }
    return {
      start: {
        x: e.points[0],
        y: e.points[1],
      },
      end: {
        x: e.points[e.points.length - 2],
        y: e.points[e.points.length - 1],
      },
    };
  }
  private updateLineEndpoint(e: FloorPlanElement, endpoint: 'start' | 'end', point: Point) {
    if (!e.points || e.points.length < 4) {
      return;
    }
    if (endpoint === 'start') {
      e.points[0] = point.x;
      e.points[1] = point.y;
    } else {
      e.points[e.points.length - 2] = point.x;
      e.points[e.points.length - 1] = point.y;
    }
    e.x = e.points[0];
    e.y = e.points[1];
    const endpoints = this.getLineEndpoints(e);
    if (endpoints) {
      e.width = endpoints.end.x - endpoints.start.x;
      e.height = endpoints.end.y - endpoints.start.y;
    }
    e.updated_at = new Date().toISOString();
  }
  private moveLine(e: FloorPlanElement, dx: number, dy: number) {
    if (e.points && e.points.length >= 2) {
      e.points = e.points.map((value, index) => value + (index % 2 === 0 ? dx : dy));
    }
    e.x += dx;
    e.y += dy;
    e.updated_at = new Date().toISOString();
  }
  private async load() {
    const snap = await this.floors.load(this.plan.id);
    this.elements = snap.elements;
    this.tables = (snap.tables ?? []).filter((t) => t.type !== 'RESERVED');
    const snapshotReserved = snap.reserved ?? [];
    const legacyReserved = (snap.tables ?? []).filter((t) => t.type === 'RESERVED');
    this.reserved = [
      ...snapshotReserved,
      ...legacyReserved.filter((legacy) => !snapshotReserved.some((r: ClubTable) => r.id === legacy.id)),
    ];
    this.selectedTable = null;
    this.selectedReserved = null;
    this.selectedElementId = null;
    this.selectedOrderTarget = null;
    this.showOrderDialog = false;
    this.activeEndpoint = null;
    this.endpointShape = null;
    this.clearDrawing();
    this.history = [];
    this.historyIndex = -1;
    this.pushHistory();
    this.products = await this.productService.products();
    try {
      this.productCategories = await this.productService.categories();
    } catch {
      this.productCategories = [];
    }
    await this.refreshPendingMap();
    this.initStage();
    if (this.realtimeChannel) {
      this.realtimeChannel.unsubscribe();
    }
    this.realtimeChannel = this.orders.subscribe(() => {
      void this.refreshPendingMap();
      const target = this.selectedOrderTarget ?? this.selectedTable ?? this.selectedReserved;
      if (target) void this.loadOrdersForTarget(target);
    }, `plan-editor-orders-${this.plan.id}`);
  }
  private initStage() {
    if (this.stage) {
      this.stage.destroy();
    }
    const el = this.container.nativeElement;
    const width = Math.max(el.clientWidth, 600);
    const height = Math.max(el.clientHeight, 500);
    this.stage = new Konva.Stage({
      container: el,
      width,
      height,
      draggable: false,
    });
    this.layer = new Konva.Layer();
    this.draftLayer = new Konva.Layer();
    this.stage.add(this.layer);
    this.stage.add(this.draftLayer);
    this.stage.on('wheel', (e) => {
      e.evt.preventDefault();
      this.zoomAtPointer(e.evt as WheelEvent, e.evt.deltaY < 0 ? 0.1 : -0.1);
    });
    this.render();
  }
  private render() {
    if (!this.layer) {
      return;
    }
    this.layer.destroyChildren();
    this.activeEndpoint = null;
    this.endpointShape = null;
    for (const e of this.elements) {
      if (String(e.kind) === 'text') {
        const selected = this.selectedElementId === e.id;
        const text = new Konva.Text({
          x: e.x,
          y: e.y,
          text: e.label ?? '',
          fill: selected ? '#6b4430' : '#2d211b',
          fontSize: 22,
          fontStyle: 'bold',
          padding: 6,
          draggable: this.canEditGeometry && this.tool === 'select',
          name: e.id,
          shadowColor: 'rgba(0,0,0,.12)',
          shadowBlur: selected ? 6 : 0,
          shadowOffset: selected
            ? {
                x: 0,
                y: 2,
              }
            : undefined,
        });
        text.on('click tap', (event) => {
          event.cancelBubble = true;
          if (!this.canEditGeometry) {
            return;
          }
          if (this.tool !== 'select') {
            return;
          }
          this.selectedElementId = e.id;
          this.selectedTable = null;
          this.selectedReserved = null;
          this.render();
        });
        text.on('dragend', () => {
          e.x = text.x();
          e.y = text.y();
          e.updated_at = new Date().toISOString();
          this.pushHistory();
          this.render();
        });
        this.layer.add(text);
        continue;
      }
      const points = e.points ?? [e.x, e.y, e.x + e.width, e.y + e.height];
      const selected = this.selectedElementId === e.id;
      const line = new Konva.Line({
        points,
        stroke: selected ? '#8b5a3c' : String(e.kind) === 'wall' ? '#111111' : String(e.kind) === 'door' ? '#198754' : '#555555',
        strokeWidth: selected ? 16 : String(e.kind) === 'wall' ? 12 : 6,
        lineCap: 'round',
        lineJoin: 'round',
        draggable: this.canEditGeometry && this.tool === 'select',
        name: e.id,
      });
      line.on('click tap', (event) => {
        event.cancelBubble = true;
        if (!this.canEditGeometry || this.tool !== 'select') {
          return;
        }
        this.selectedElementId = e.id;
        this.selectedTable = null;
        this.selectedReserved = null;
        this.activeEndpoint = null;
        this.render();
      });
      line.on('dragend', () => {
        if (this.activeEndpoint) {
          line.position({
            x: 0,
            y: 0,
          });
          return;
        }
        const dx = line.x();
        const dy = line.y();
        if (dx === 0 && dy === 0) {
          return;
        }
        this.moveLine(e, dx, dy);
        line.position({
          x: 0,
          y: 0,
        });
        this.pushHistory();
        this.render();
      });
      this.layer.add(line);
      if (selected && this.canEditGeometry && this.tool === 'select') {
        const endpoints = this.getLineEndpoints(e);
        if (endpoints) {
          const startCircle = new Konva.Circle({
            x: endpoints.start.x,
            y: endpoints.start.y,
            radius: 9,
            fill: '#ffffff',
            stroke: '#8b5a3c',
            strokeWidth: 4,
            draggable: true,
            name: `${e.id}-start-endpoint`,
          });
          startCircle.on('mousedown touchstart', (event) => {
            event.cancelBubble = true;
            this.activeEndpoint = 'start';
            this.selectedElementId = e.id;
          });
          startCircle.on('dragstart', (event) => {
            event.cancelBubble = true;
            this.activeEndpoint = 'start';
          });
          startCircle.on('dragmove', (event) => {
            event.cancelBubble = true;
            const point = this.getStagePointerPoint(event.evt);
            if (!point) {
              return;
            }
            this.updateLineEndpoint(e, 'start', point);
            line.points(e.points ?? []);
            startCircle.position({
              x: point.x,
              y: point.y,
            });
            this.layer.batchDraw();
          });
          startCircle.on('dragend', (event) => {
            event.cancelBubble = true;
            const point = this.getStagePointerPoint(event.evt);
            if (point) {
              this.updateLineEndpoint(e, 'start', point);
            }
            this.activeEndpoint = null;
            this.endpointShape = null;
            this.pushHistory();
            this.render();
          });
          const endCircle = new Konva.Circle({
            x: endpoints.end.x,
            y: endpoints.end.y,
            radius: 9,
            fill: '#ffffff',
            stroke: '#8b5a3c',
            strokeWidth: 4,
            draggable: true,
            name: `${e.id}-end-endpoint`,
          });
          endCircle.on('mousedown touchstart', (event) => {
            event.cancelBubble = true;
            this.activeEndpoint = 'end';
            this.selectedElementId = e.id;
          });
          endCircle.on('dragstart', (event) => {
            event.cancelBubble = true;
            this.activeEndpoint = 'end';
          });
          endCircle.on('dragmove', (event) => {
            event.cancelBubble = true;
            const point = this.getStagePointerPoint(event.evt);
            if (!point) {
              return;
            }
            this.updateLineEndpoint(e, 'end', point);
            line.points(e.points ?? []);
            endCircle.position({
              x: point.x,
              y: point.y,
            });
            this.layer.batchDraw();
          });
          endCircle.on('dragend', (event) => {
            event.cancelBubble = true;
            const point = this.getStagePointerPoint(event.evt);
            if (point) {
              this.updateLineEndpoint(e, 'end', point);
            }
            this.activeEndpoint = null;
            this.endpointShape = null;
            this.pushHistory();
            this.render();
          });
          this.layer.add(startCircle);
          this.layer.add(endCircle);
          this.endpointShape = endCircle;
        }
      }
      if (e.label && String(e.kind) !== 'text') {
        this.layer.add(
          new Konva.Text({
            x: e.x,
            y: e.y,
            text: e.label,
            fill: '#111111',
            fontSize: 18,
          }),
        );
      }
    }
    for (const t of this.tables) {
      this.renderTable(t);
    }
    for (const r of this.reserved) {
      this.renderReserved(r);
    }
    this.layer.draw();
  }
  /*
   * Colores de mesa/reservado en modo operativo:
   *  - Sin productos              -> color normal (el mismo que en editor)
   *  - Con productos y atendida   -> verde
   *  - Con productos y no atendida-> rojo
   */
  private tableColor(t: ClubTable, hasProducts: boolean, normalColor = '#111111'): string {
    if (!hasProducts) {
      return normalColor;
    }
    return t.attended ? '#4c8b62' : '#9f2f3a';
  }
  private renderTable(t: ClubTable) {
    const active = this.selectedTable?.id === t.id;
    const hasProducts = (this.orderCountMap.get(t.id) ?? 0) > 0;
    const common = {
      rotation: t.rotation,
      draggable: this.canEditGeometry && this.tool === 'select',
      name: t.id,
      fill: this.tableColor(t, hasProducts),
      stroke: active ? '#704936' : '#000000',
      strokeWidth: active ? 4 : 3,
    };
    const shape: Konva.Shape =
      t.shape === 'circle'
        ? new Konva.Circle({
            ...common,
            x: t.x + t.width / 2,
            y: t.y + t.height / 2,
            radius: Math.min(t.width, t.height) / 2,
          })
        : new Konva.Rect({
            ...common,
            x: t.x,
            y: t.y,
            width: t.width,
            height: t.height,
            cornerRadius: 10,
          });
    shape.on('click tap', (event) => {
      event.cancelBubble = true;
      this.selectTable(t);
    });
    shape.on('dragend', () => {
      if (!this.canEditGeometry) {
        return;
      }
      if (t.shape === 'circle') {
        t.x = shape.x() - t.width / 2;
        t.y = shape.y() - t.height / 2;
      } else {
        t.x = shape.x();
        t.y = shape.y();
      }
      t.updated_at = new Date().toISOString();
      this.selectedElementId = null;
      this.selectedReserved = null;
      this.pushHistory();
      this.render();
    });
    this.layer.add(shape);
    const numberText = new Konva.Text({
      x: t.x,
      y: t.y,
      text: `${t.number}`,
      fill: '#ffffff',
      fontSize: 18,
      fontStyle: 'bold',
      width: t.width,
      height: t.height,
      align: 'center',
      verticalAlign: 'middle',
      listening: false,
    });
    shape.on('dragmove', () => {
      if (t.shape === 'circle') {
        numberText.position({
          x: shape.x() - t.width / 2,
          y: shape.y() - t.height / 2,
        });
      } else {
        numberText.position({
          x: shape.x(),
          y: shape.y(),
        });
      }
      this.layer.batchDraw();
    });
    this.layer.add(numberText);
  }
  private renderReserved(r: ClubTable) {
    const active = this.selectedReserved?.id === r.id;
    const hasProducts = (this.orderCountMap.get(r.id) ?? 0) > 0;
    const shape = new Konva.Rect({
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
      rotation: r.rotation,
      cornerRadius: 14,
      fill: this.tableColor(r, hasProducts, '#704936'),
      stroke: active ? '#3d2417' : '#704936',
      strokeWidth: active ? 5 : 3,
      draggable: this.canEditGeometry && this.tool === 'select',
      name: r.id,
      shadowColor: 'rgba(0,0,0,.15)',
      shadowBlur: active ? 8 : 3,
      shadowOffset: {
        x: 0,
        y: 2,
      },
    });
    shape.on('click tap', (event) => {
      event.cancelBubble = true;
      this.selectReserved(r);
    });
    shape.on('dragend', () => {
      if (!this.canEditGeometry) {
        return;
      }
      r.x = shape.x();
      r.y = shape.y();
      r.updated_at = new Date().toISOString();
      this.selectedElementId = null;
      this.selectedTable = null;
      this.pushHistory();
      this.render();
    });
    this.layer.add(shape);
    const reservedText = new Konva.Text({
      x: r.x,
      y: r.y,
      text: `RESERVADO\n${r.number}`,
      fill: '#ffffff',
      fontSize: 16,
      fontStyle: 'bold',
      width: r.width,
      height: r.height,
      align: 'center',
      verticalAlign: 'middle',
      listening: false,
      lineHeight: 1.15,
    });
    shape.on('dragmove', () => {
      reservedText.position({
        x: shape.x(),
        y: shape.y(),
      });
      this.layer.batchDraw();
    });
    this.layer.add(reservedText);
  }
  private selectTable(t: ClubTable) {
    if (this.mode === 'operativo') {
      // En operativa, una mesa abre siempre el modal global al primer toque.
      // No usamos ya el antiguo panel lateral dentro del canvas.
      void this.openOrderDialog(t);
      return;
    }
    this.selectedTable = t;
    this.selectedReserved = null;
    this.selectedElementId = null;
    this.activeEndpoint = null;
    this.render();
  }
  private selectReserved(r: ClubTable) {
    if (this.mode === 'operativo') {
      // Igual que las mesas: primer toque = modal global.
      void this.openOrderDialog(r);
      return;
    }
    this.selectedReserved = r;
    this.selectedTable = null;
    this.selectedElementId = null;
    this.activeEndpoint = null;
    this.render();
  }
  private async openOrderDialog(target: ClubTable) {
    if (this.mode !== 'operativo') {
      return;
    }
    this.selectedOrderTarget = target;
    if (target.type === 'RESERVED') {
      this.selectedReserved = target;
      this.selectedTable = null;
    } else {
      this.selectedTable = target;
      this.selectedReserved = null;
    }
    this.selectedElementId = null;
    this.selectedProductId = '';
    this.quantity = 1;
    await this.loadOrdersForTarget(target);
    this.showOrderDialog = true;
    this.render();
  }
  closeOrderDialog() {
    this.showOrderDialog = false;
    this.selectedOrderTarget = null;
    this.selectedProductId = '';
    this.quantity = 1;
  }
  async markAttended(attended: boolean) {
    const target = this.selectedOrderTarget;
    if (!target) return;
    if (attended && this.orderItems().length === 0) {
      // No se puede marcar como atendida una mesa/reservado sin productos.
      return;
    }
    const previous = target.attended;
    // Actualiza el objeto local al instante (el objeto es el mismo que
    // vive dentro de this.tables / this.reserved, así que redibuja ya
    // en el color correcto).
    target.attended = attended;
    target.updated_at = new Date().toISOString();
    this.render();
    try {
      await this.floors.setTableAttended(target.id, attended);
      this.closeOrderDialog();
    } catch (error) {
      target.attended = previous;
      this.render();
      console.error('Error actualizando el estado de atención:', error);
    }
  }
  private async loadOrdersForTarget(target?: ClubTable) {
    const requestId = ++this.ordersLoadRequestId;

    const orderTarget = target ?? this.selectedOrderTarget ?? this.selectedTable ?? this.selectedReserved;

    if (!orderTarget) {
      if (requestId !== this.ordersLoadRequestId) return;

      this.orderItems.set([]);
      this.selectedPending = 0;
      this.cdr.detectChanges();

      return;
    }

    try {
      const result = await this.orders.forTable(orderTarget.id);

      // Si mientras esperábamos hubo otra petición más reciente,
      // ignoramos esta respuesta antigua.
      if (requestId !== this.ordersLoadRequestId) {
        return;
      }

      this.orderItems.set([...result.items]);

      this.selectedPending = this.orderItems()
        .filter((item) => item.status === 'PENDING')
        .reduce((total, item) => total + item.quantity, 0);

      this.pendingChanged.emit(this.selectedPending);

      this.cdr.detectChanges();
    } catch (error) {
      if (requestId !== this.ordersLoadRequestId) {
        return;
      }

      console.error('Error cargando pedido:', error);

      this.orderItems.set([]);
      this.selectedPending = 0;

      this.cdr.detectChanges();
    }
  }
  async togglePlanLock(): Promise<void> {
    if (!this.isAdmin) return;
    if (this.plan.is_locked) {
      this.showUnlockDialog = true;
      return;
    }
    try {
      await this.floors.setLocked(this.plan.id, true);
      this.plan.is_locked = true;
      this.setTool('pan');
      this.render();
    } catch (error) {
      console.error('No se pudo fijar el plano:', error);
    }
  }

  closeUnlockDialog(): void {
    this.showUnlockDialog = false;
  }

  async confirmUnlock(): Promise<void> {
    if (!this.isAdmin) return;
    try {
      await this.floors.setLocked(this.plan.id, false);
      this.plan.is_locked = false;
      this.showUnlockDialog = false;
      this.setTool('select');
      this.render();
    } catch (error) {
      console.error('No se pudo desbloquear el plano:', error);
    }
  }

  deleteSelected(): void {
    if (!this.canEditGeometry) return;
    if (this.selectedElementId) {
      const id = this.selectedElementId;
      this.elements = this.elements.filter((e) => e.id !== id);
      this.selectedElementId = null;
      this.activeEndpoint = null;
      this.pushHistory();
      this.render();
      return;
    }
    const target = this.selectedTable ?? this.selectedReserved;
    if (!target) return;
    this.pendingDeleteTarget = target;
    this.deletePassword = '';
    this.deleteError = '';
    this.verifiedDeletePassword = '';
    this.showDeletePasswordDialog = true;
  }

  closeDeletePasswordDialog(): void {
    this.showDeletePasswordDialog = false;
    this.deletePassword = '';
    this.deleteError = '';
    this.pendingDeleteTarget = null;
  }

  async confirmProtectedDelete(): Promise<void> {
    const target = this.pendingDeleteTarget;
    if (!target || !this.deletePassword || !this.canEditGeometry) return;
    this.deleteError = '';
    try {
      const result = await this.tableDeletion.delete(target.id, this.deletePassword, false);
      if (!result.ok && result.reason === 'BAD_PASSWORD') {
        this.deleteError = 'Contraseña incorrecta';
        return;
      }
      if (!result.ok && result.reason === 'SERVED_PRODUCTS') {
        this.verifiedDeletePassword = this.deletePassword;
        this.showDeletePasswordDialog = false;
        this.showServedDeleteWarning = true;
        return;
      }
      if (!result.ok) {
        this.deleteError = 'No se pudo eliminar la mesa/reservado';
        return;
      }
      this.removeTargetLocally(target.id);
      this.closeDeletePasswordDialog();
    } catch (error) {
      this.deleteError = error instanceof Error ? error.message : 'No se pudo eliminar';
    }
  }

  cancelServedDelete(): void {
    this.showServedDeleteWarning = false;
    this.pendingDeleteTarget = null;
    this.verifiedDeletePassword = '';
    this.deletePassword = '';
  }

  async confirmServedDelete(): Promise<void> {
    const target = this.pendingDeleteTarget;
    if (!target || !this.verifiedDeletePassword || !this.canEditGeometry) return;
    try {
      const result = await this.tableDeletion.delete(target.id, this.verifiedDeletePassword, true);
      if (!result.ok) throw new Error('No se pudo completar el borrado');
      this.removeTargetLocally(target.id);
      this.cancelServedDelete();
    } catch (error) {
      console.error('Error eliminando mesa con productos servidos:', error);
    }
  }

  private removeTargetLocally(id: string): void {
    this.tables = this.tables.filter((t) => t.id !== id);
    this.reserved = this.reserved.filter((r) => r.id !== id);
    if (this.selectedTable?.id === id) this.selectedTable = null;
    if (this.selectedReserved?.id === id) this.selectedReserved = null;
    if (this.selectedOrderTarget?.id === id) this.closeOrderDialog();
    this.pushHistory();
    this.render();
  }
  private pendingForTable(tableId: string): number {
    return this.pendingMap.get(tableId) ?? 0;
  }
  private async refreshPendingMap() {
    try {
      const { data, error } = await this.orders.db.client
        .from('orders')
        .select('id,table_id,order_items(quantity,status)')
        .eq('status', 'OPEN');
      if (error) {
        throw error;
      }
      const map = new Map<string, number>();
      const countMap = new Map<string, number>();
      for (const o of data as any[]) {
        const items = (o.order_items ?? []).filter((i: any) => i.status !== 'CANCELLED');
        const total = items.reduce((a: number, i: any) => a + Number(i.quantity || 0), 0);
        const pending = items.filter((i: any) => i.status === 'PENDING').reduce((a: number, i: any) => a + Number(i.quantity || 0), 0);
        if (total) countMap.set(o.table_id, total);
        if (pending) map.set(o.table_id, pending);
      }
      this.pendingMap = map;
      this.orderCountMap = countMap;
      this.pendingChanged.emit([...map.values()].reduce((a, b) => a + b, 0));
      this.render();
    } catch {
      // Silenciado a propósito: si falla el refresco de pendientes,
      // el listener de realtime volverá a intentarlo en el próximo evento.
    }
  }
  ngOnDestroy() {
    // Evita que un overlay de pedidos sobreviva al abandonar el editor/sesión.
    this.showOrderDialog = false;
    this.selectedOrderTarget = null;
    if (this.realtimeChannel) {
      this.realtimeChannel.unsubscribe();
    }
    if (this.stage) {
      this.stage.destroy();
    }
  }
  setTool(tool: EditorTool) {
    if ((tool === 'draw' || tool === 'text') && !this.canEditGeometry) return;
    this.tool = tool;
    this.panMode = tool === 'pan';
    this.activeEndpoint = null;
    if (this.stage) {
      this.stage.draggable(this.panMode);
    }
    if (tool !== 'select') {
      this.selectedElementId = null;
      this.selectedTable = null;
      this.selectedReserved = null;
    }
    if (tool !== 'draw') {
      this.clearDrawing();
    }
    this.render();
  }
  pointerDown(ev: PointerEvent) {
    if (this.mode === 'editor' && this.tool === 'text') {
      const point = this.getCanvasPoint(ev);
      if (!point) {
        return;
      }
      this.textPosition = point;
      this.newText = '';
      this.showTextDialog = true;
      return;
    }
    if (this.mode !== 'editor' || this.tool !== 'draw') {
      return;
    }
    const p = this.getCanvasPoint(ev);
    if (!p) {
      return;
    }
    this.drawingPointerId = ev.pointerId;
    this.startDrawingAt(p);
  }
  pointerMove(ev: PointerEvent) {
    if (this.drawingPointerId !== ev.pointerId || !this.drawingShape) {
      return;
    }
    const p = this.getCanvasPoint(ev);
    if (!p) {
      return;
    }
    const last = this.drawing[this.drawing.length - 1];
    if (last && Math.hypot(p.x - last.x, p.y - last.y) < 4) {
      return;
    }
    this.drawing.push({
      x: p.x,
      y: p.y,
    });
    this.drawingShape.points(this.drawing.flatMap((point) => [point.x, point.y]));
    this.draftLayer.batchDraw();
  }
  pointerUp(ev: PointerEvent) {
    if (this.drawingPointerId !== ev.pointerId) {
      return;
    }
    this.drawingPointerId = null;
    if (!this.drawingShape || this.drawing.length < 2) {
      this.clearDrawing();
      return;
    }
    const segments = this.geometry.toSegments(this.drawing);
    const now = new Date().toISOString();
    const newElements: FloorPlanElement[] = segments.map((s) => ({
      id: crypto.randomUUID(),
      floor_plan_id: this.plan.id,
      kind: 'wall',
      x: s.x,
      y: s.y,
      width: s.width,
      height: s.height,
      rotation: s.rotation,
      points: s.points,
      label: null,
      z_index: this.elements.length,
      created_at: now,
      updated_at: now,
    }));
    this.elements = [...this.elements, ...newElements];
    this.clearDrawing();
    this.pushHistory();
    this.render();
  }
  private startDrawingAt(point: Point) {
    this.drawing = [point];
    this.drawingShape = new Konva.Line({
      points: [point.x, point.y],
      stroke: '#111111',
      strokeWidth: 6,
      dash: [10, 8],
      lineCap: 'round',
      lineJoin: 'round',
    });
    this.draftLayer.add(this.drawingShape);
    this.draftLayer.draw();
  }
  clearDrawing() {
    this.drawing = [];
    this.drawingShape = null;
    this.drawingPointerId = null;
    if (this.draftLayer) {
      this.draftLayer.destroyChildren();
      this.draftLayer.draw();
    }
  }
  closeTextDialog() {
    this.showTextDialog = false;
    this.newText = '';
    this.textPosition = null;
  }
  confirmAddText() {
    const text = this.newText.trim();
    if (!text || !this.textPosition) {
      return;
    }
    const now = new Date().toISOString();
    const textElement = {
      id: crypto.randomUUID(),
      floor_plan_id: this.plan.id,
      kind: 'text',
      x: this.textPosition.x,
      y: this.textPosition.y,
      width: 0,
      height: 0,
      rotation: 0,
      points: null,
      label: text,
      z_index: this.elements.length,
      created_at: now,
      updated_at: now,
    } as unknown as FloorPlanElement;
    this.elements = [...this.elements, textElement];
    this.selectedElementId = textElement.id;
    this.selectedTable = null;
    this.selectedReserved = null;
    this.pushHistory();
    this.render();
    this.closeTextDialog();
    this.setTool('select');
  }
  private convertDrawing() {
    if (this.drawing.length < 2) {
      return;
    }
    const segments = this.geometry.toSegments(this.drawing);
    const now = new Date().toISOString();
    const newElements: FloorPlanElement[] = segments.map((s) => ({
      id: crypto.randomUUID(),
      floor_plan_id: this.plan.id,
      kind: 'wall',
      x: s.x,
      y: s.y,
      width: s.width,
      height: s.height,
      rotation: s.rotation,
      points: s.points,
      label: null,
      z_index: this.elements.length,
      created_at: now,
      updated_at: now,
    }));
    this.elements = [...this.elements, ...newElements];
    this.clearDrawing();
    this.pushHistory();
    this.render();
    this.setTool('select');
  }
  async saveDesign() {
    if (!this.isAdmin) return;
    try {
      if (this.drawing.length >= 2) {
        this.convertDrawing();
      }
      await this.floors.saveSnapshot(this.plan.id, {
        elements: this.elements,
        tables: this.tables,
        reserved: this.reserved,
      });
      this.showSaveDialog = true;
    } catch (e) {
      console.error('Error guardando diseño:', e);
    }
  }
  closeSaveDialog() {
    this.showSaveDialog = false;
  }
  addTable() {
    if (!this.canEditGeometry) return;
    const numbers = new Set(this.tables.map((t) => t.number));
    let n = 1;
    while (numbers.has(n)) {
      n++;
    }
    const now = new Date().toISOString();
    const table: ClubTable = {
      id: crypto.randomUUID(),
      floor_plan_id: this.plan.id,
      number: n,
      type: 'TABLE',
      x: 300 + this.tables.length * 20,
      y: 300 + this.tables.length * 20,
      width: 100,
      height: 80,
      rotation: 0,
      shape: 'circle',
      created_at: now,
      updated_at: now,
      attended: false,
    };
    this.tables = [...this.tables, table];
    this.selectedTable = table;
    this.selectedReserved = null;
    this.selectedElementId = null;
    this.pushHistory();
    this.render();
  }
  addReserved() {
    if (!this.canEditGeometry) return;
    const numbers = new Set(this.reserved.map((r) => r.number));
    let n = 1;
    while (numbers.has(n)) {
      n++;
    }
    const now = new Date().toISOString();
    const reserved: ClubTable = {
      id: crypto.randomUUID(),
      floor_plan_id: this.plan.id,
      type: 'RESERVED',
      attended: false,
      number: n,
      x: 300 + this.reserved.length * 20,
      y: 450 + this.reserved.length * 20,
      width: 140,
      height: 80,
      rotation: 0,
      shape: 'rectangle',
      created_at: now,
      updated_at: now,
    };
    this.reserved = [...this.reserved, reserved];
    this.selectedReserved = reserved;
    this.selectedTable = null;
    this.selectedElementId = null;
    this.pushHistory();
    this.render();
  }
  togglePan() {
    this.setTool(this.tool === 'pan' ? 'select' : 'pan');
  }
  zoom(delta: number) {
    if (!this.stage) {
      return;
    }
    const old = this.stage.scaleX();
    const next = Math.min(2.5, Math.max(0.35, old + delta));
    this.stage.scale({
      x: next,
      y: next,
    });
    this.render();
  }
  private zoomAtPointer(event: WheelEvent, delta: number) {
    if (!this.stage) {
      return;
    }
    const oldScale = this.stage.scaleX();
    const pointer = this.stage.getPointerPosition();
    if (!pointer) {
      this.zoom(delta);
      return;
    }
    const newScale = Math.min(2.5, Math.max(0.35, oldScale + delta));
    const mousePointTo = {
      x: (pointer.x - this.stage.x()) / oldScale,
      y: (pointer.y - this.stage.y()) / oldScale,
    };
    this.stage.scale({
      x: newScale,
      y: newScale,
    });
    this.stage.position({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
    this.render();
  }
  pushHistory() {
    const snapshot: FloorSnapshot = {
      elements: structuredClone(this.elements),
      tables: structuredClone(this.tables),
      reserved: structuredClone(this.reserved),
    };
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(snapshot);
    if (this.history.length > 30) {
      this.history.shift();
    }
    this.historyIndex = this.history.length - 1;
  }
  restore(s: FloorSnapshot) {
    this.elements = structuredClone(s.elements);
    this.tables = structuredClone(s.tables);
    this.reserved = structuredClone(s.reserved ?? []);
    const legacyReserved = this.tables.filter((t) => t.type === 'RESERVED');
    if (legacyReserved.length) {
      this.tables = this.tables.filter((t) => t.type !== 'RESERVED');
      for (const legacy of legacyReserved) {
        if (!this.reserved.some((r) => r.id === legacy.id)) {
          this.reserved.push(legacy);
        }
      }
    }
    this.selectedElementId = null;
    this.selectedTable = null;
    this.selectedReserved = null;
    this.selectedOrderTarget = null;
    this.showOrderDialog = false;
    this.activeEndpoint = null;
    this.render();
  }
  undo() {
    if (this.historyIndex <= 0) {
      return;
    }
    this.historyIndex--;
    this.restore(this.history[this.historyIndex]);
  }
  redo() {
    if (this.historyIndex >= this.history.length - 1) {
      return;
    }
    this.historyIndex++;
    this.restore(this.history[this.historyIndex]);
  }
  async addOrderItem() {
    if (!this.canManageOrders) return;
    const added = await this.addProductToOrder(this.selectedProductId, this.quantity);
    if (added) {
      this.quantity = 1;
      this.selectedProductId = '';
    }
  }
  async addAlcoholItem() {
    if (!this.canManageOrders) return;
    const added = await this.addProductToOrder(this.selectedAlcoholProductId, this.alcoholQuantity);

    if (added) {
      this.alcoholQuantity = 1;
      this.selectedAlcoholProductId = '';
    }
  }
  async addSoftDrinkItem() {
    if (!this.canManageOrders) return;
    const added = await this.addProductToOrder(this.selectedSoftDrinkProductId, this.softDrinkQuantity);

    if (added) {
      this.softDrinkQuantity = 1;
      this.selectedSoftDrinkProductId = '';
    }
  }
  /*
   * Añade (o incrementa, si ya existe en el pedido) un producto para la
   * mesa/reservado seleccionado. Se usa tanto desde el dropdown de
   * alcoholes como el de refrescos: la lógica de "ya existe -> +cantidad"
   * vive en OrderService.addItem y es idéntica para mesa y reservado.
   */
  private async addProductToOrder(productId: string, quantity: number): Promise<boolean> {
    const target = this.selectedOrderTarget ?? this.selectedTable ?? this.selectedReserved;

    if (!target || !productId || quantity < 1) {
      return false;
    }

    const session = this.auth.session();

    if (!session) {
      return false;
    }

    try {
      await this.orders.addItem(target.id, productId, Math.floor(quantity), session.user.id);

      // Todo producto nuevo vuelve a dejar la mesa/reservado pendiente de atención.
      await this.floors.setTableAttended(target.id, false);
      target.attended = false;
      target.updated_at = new Date().toISOString();

      await this.loadOrdersForTarget(target);
      await this.refreshPendingMap();
      this.render();

      return true;
    } catch (error) {
      console.error('Error añadiendo producto:', error);

      return false;
    }
  }

  async changeItemQuantity(item: any, delta: number) {
    if (!this.canManageOrders) return;
    const nextQuantity = Number(item.quantity) + delta;
    if (nextQuantity <= 0) {
      await this.removeOrderItem(item);
      return;
    }
    const session = this.auth.session();
    if (!session) return;
    try {
      const patch: any = {
        quantity: nextQuantity,
        updated_at: new Date().toISOString(),
      };
      if (item.status === 'PLACED') {
        patch.status = 'PENDING';
        patch.placed_by = null;
        patch.placed_at = null;
      }
      const { error } = await this.orders.db.client.from('order_items').update(patch).eq('id', item.id);
      if (error) throw error;
      await this.loadOrdersForTarget();
      await this.refreshPendingMap();
      this.render();
    } catch (error) {
      console.error('Error modificando producto:', error);
    }
  }

  async removeOrderItem(item: any) {
    if (!this.canManageOrders) return;
    const session = this.auth.session();
    if (!session) return;
    try {
      const { error } = await this.orders.db.client
        .from('order_items')
        .update({
          status: 'CANCELLED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);
      if (error) throw error;
      await this.loadOrdersForTarget();
      await this.refreshPendingMap();
      this.render();
    } catch (error) {
      console.error('Error eliminando producto:', error);
    }
  }

  async markPlaced(id: string) {
    if (!this.canManageOrders) return;
    const session = this.auth.session();
    if (!session) {
      console.error('No hay una sesión activa.');
      return;
    }
    try {
      await this.orders.markPlaced(id, session.user.id);
      const target = this.selectedOrderTarget ?? this.selectedTable ?? this.selectedReserved;
      if (target) {
        await this.loadOrdersForTarget(target);
      }
      await this.refreshPendingMap();
    } catch (error) {
      console.error('Error marcando producto como puesto:', error);
    }
  }
  private getStagePointerPoint(event: Event): Point | null {
    if (!this.stage) {
      return null;
    }
    this.stage.setPointersPositions(event);
    const pointer = this.stage.getPointerPosition();
    if (!pointer) {
      return null;
    }
    const transform = this.stage.getAbsoluteTransform().copy();
    transform.invert();
    return transform.point(pointer);
  }
  private getCanvasPoint(ev: PointerEvent): Point | null {
    return this.getStagePointerPoint(ev);
  }
}
