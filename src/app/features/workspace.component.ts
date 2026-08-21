import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonButton,
  IonIcon,
  IonContent,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonToast,
  IonBadge,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonModal
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { logOutOutline, addOutline, trashOutline, copyOutline, settingsOutline, closeOutline } from 'ionicons/icons';

import { AuthService } from '../core/auth/auth.service';
import { FloorPlanService } from '../core/services/floor-plan.service';
import { ProductService } from '../core/services/product.service';
import { OrderService } from '../core/services/order.service';
import type { FloorPlan, Product, ProductCategory } from '../core/models/models';
import { PlanEditorComponent } from './floor-plans/plan-editor.component';
import { TableProductPanelComponent } from './floor-plans/table-product-panel.component';

@Component({
  selector: 'app-workspace',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonButton,
    IonIcon,
    IonContent,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonToast,
    IonBadge,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonModal,
    PlanEditorComponent,
    TableProductPanelComponent
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <div class="topbar">
          <div class="brand-mini"><span>SALA</span><strong>CHOCOLATTE</strong></div>
          <div class="topbar-title"><span>Gestión de sala</span><small>{{ activeLabel }}</small></div>
          <div class="top-actions">
            <div class="connection"><span></span>Conectado</div>
            <ion-button fill="clear" class="logout-button" (click)="logout()"><ion-icon name="log-out-outline"></ion-icon></ion-button>
          </div>
        </div>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="nav-wrap">
        <ion-segment [value]="activeTab()" (ionChange)="activeTab.set($any($event.detail.value))">
          <ion-segment-button value="planos"><ion-label>Planos</ion-label></ion-segment-button>
          <ion-segment-button value="operativo">
            <ion-label>Operativa @if (pendingCount() > 0) { <ion-badge color="danger">{{ pendingCount() }}</ion-badge> }</ion-label>
          </ion-segment-button>
          <ion-segment-button value="productos"><ion-label>Productos</ion-label></ion-segment-button>
        </ion-segment>
      </div>

      @if (!configured) {
        <div class="notice">Configura Supabase en <code>.env</code>.</div>
      } @else if (activeTab() === 'planos') {
        <main class="page">
          <div class="page-head">
            <div><span class="eyebrow">DISEÑO DE SALA</span><h1>Planos</h1><p>Organiza las zonas, mesas y reservados de la sala.</p></div>
            <ion-button class="primary-button" (click)="openCreatePlanDialog()"><ion-icon name="add-outline" slot="start"></ion-icon>Nuevo plano</ion-button>
          </div>
          <div class="plans">
            @for (plan of plans(); track plan.id) {
              <article class="plan-card" (click)="openPlan(plan)">
                <div class="plan-preview">{{ plan.name.charAt(0).toUpperCase() }}</div>
                <div class="plan-info"><h2>{{ plan.name }}</h2><p>{{ plan.width }} × {{ plan.height }} · Plano de sala</p></div>
                <div class="plan-actions">
                  <ion-button fill="clear" (click)="$event.stopPropagation(); openEditor(plan)"><ion-icon name="settings-outline"></ion-icon></ion-button>
                  <ion-button fill="clear" (click)="$event.stopPropagation(); duplicate(plan)"><ion-icon name="copy-outline"></ion-icon></ion-button>
                  <ion-button fill="clear" color="danger" (click)="$event.stopPropagation(); removePlan(plan)"><ion-icon name="trash-outline"></ion-icon></ion-button>
                </div>
              </article>
            } @empty {
              <div class="empty"><div>▧</div><h2>Aún no hay planos</h2><p>Crea el primer plano de la sala para empezar.</p><ion-button class="primary-button" (click)="openCreatePlanDialog()">Crear plano</ion-button></div>
            }
          </div>
        </main>
      } @else if (activeTab() === 'operativo') {
        <main class="page operative-page">
          <div class="page-head compact">
            <div><span class="eyebrow">OPERATIVA</span><h1>Mesas, reservados y productos</h1><p>El plano queda a la izquierda y el control de bebidas a la derecha.</p></div>
            <div class="select-actions">
              <ion-select label="Plano" labelPlacement="stacked" [value]="selectedPlan()?.id" (ionChange)="openPlanById($any($event.detail.value))">
                @for (p of plans(); track p.id) { <ion-select-option [value]="p.id">{{ p.name }}</ion-select-option> }
              </ion-select>
              <ion-button fill="outline" class="secondary-button" (click)="toggleEditorMode()">{{ editorMode() === 'editor' ? 'Ver operativo' : 'Editar plano' }}</ion-button>
            </div>
          </div>

          @if (selectedPlan()) {
            <div class="operative-layout">
              <div class="plan-column">
                <app-plan-editor [plan]="selectedPlan()!" [mode]="editorMode()" (pendingChanged)="pendingCount.set($event)"></app-plan-editor>
              </div>
              @if (editorMode() === 'operativo') {
                <app-table-product-panel [plan]="selectedPlan()!"></app-table-product-panel>
              } @else {
                <aside class="editor-placeholder"><strong>Modo editor</strong><span>El panel de productos se muestra en modo operativo para no interferir con el diseño.</span></aside>
              }
            </div>
          } @else {
            <div class="empty"><div>◫</div><h2>Selecciona un plano</h2><p>Crea o selecciona un plano para comenzar.</p></div>
          }
        </main>
      } @else {
        <main class="page products">
          <div class="page-head"><div><span class="eyebrow">CATÁLOGO</span><h1>Productos</h1><p>Gestiona las bebidas disponibles para los pedidos.</p></div></div>
          <div class="category-create">
            <ion-input label="Nueva categoría" labelPlacement="stacked" fill="outline" [(ngModel)]="newCategory"></ion-input>
            <ion-button class="primary-button" (click)="createCategory()">Añadir categoría</ion-button>
          </div>
          @for (category of categories(); track category.id) {
            <section class="category-card">
              <h2>{{ category.name }}</h2>
              @for (product of productsFor(category.id); track product.id) {
                <div class="product-row"><span>{{ product.name }}</span><strong>{{ product.price | number:'1.2-2' }} €</strong></div>
              }
              <div class="category-add">
                <ion-input label="Producto" labelPlacement="stacked" fill="outline" [(ngModel)]="newProductName[category.id]"></ion-input>
                <ion-input label="Precio" type="number" labelPlacement="stacked" fill="outline" [(ngModel)]="newProductPrice[category.id]"></ion-input>
                <ion-button class="primary-button" (click)="createProduct(category.id)">Añadir</ion-button>
              </div>
            </section>
          }
        </main>
      }
    </ion-content>

    <ion-modal [isOpen]="createPlanDialog()" [backdropDismiss]="false" class="create-plan-modal" (didDismiss)="closeCreatePlanDialog()">
      <ng-template>
        <div class="plan-dialog">
          <div class="dialog-header"><div><span class="dialog-eyebrow">NUEVO PLANO</span><h2>Crear plano</h2><p>Añade un nombre para identificar este plano.</p></div><button type="button" class="dialog-close" (click)="closeCreatePlanDialog()"><ion-icon name="close-outline"></ion-icon></button></div>
          <div class="dialog-body"><ion-input label="Nombre del plano" labelPlacement="stacked" fill="outline" placeholder="Ej. Sala principal" [(ngModel)]="newPlanName" (keydown.enter)="createPlan()"></ion-input></div>
          <div class="dialog-actions"><ion-button fill="outline" class="secondary-button" (click)="closeCreatePlanDialog()">Cancelar</ion-button><ion-button class="primary-button" [disabled]="!newPlanName.trim()" (click)="createPlan()">Crear plano</ion-button></div>
        </div>
      </ng-template>
    </ion-modal>

    <ion-toast [isOpen]="toast() !== ''" [message]="toast()" [duration]="2200" (didDismiss)="toast.set('')"></ion-toast>
  `,
  styles: [`
    ion-button { --border-radius:10px; --box-shadow:none; font-weight:700; text-transform:none; }
    .primary-button { --background:#65412e; --color:#fff; }
    .secondary-button { --border-color:#d7c7bc; --color:#65412e; --background:#fff; }
    .topbar { width:100%; display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:24px; padding:0 22px; }
    .brand-mini { display:flex; align-items:baseline; gap:7px; color:#563522; letter-spacing:.08em; }.brand-mini span,.brand-mini strong{font-weight:900}.brand-mini span{font-size:16px}.brand-mini strong{font-size:17px}
    .topbar-title{display:flex;align-items:center;gap:12px;color:#9a8c84}.topbar-title small{font-size:15px;color:#2d211b;font-weight:700}.top-actions{display:flex;align-items:center;gap:10px}.connection{font-size:12px;color:#6f7c72}.connection span{display:inline-block;width:7px;height:7px;border-radius:50%;background:#4c9b6e;margin-right:5px}
    .nav-wrap{padding:14px 24px 0;background:#fff;border-bottom:1px solid #eadfd8}.nav-wrap ion-segment{max-width:560px;margin:auto}
    .page{max-width:1400px;margin:auto;padding:30px 24px 60px}.page-head{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin-bottom:24px}.page-head.compact{align-items:center}.eyebrow{font-size:11px;font-weight:900;letter-spacing:.13em;color:#9a6749}.page-head h1{margin:5px 0;color:#2d211b;font-size:32px}.page-head p{margin:0;color:#81736b}
    .plans{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:16px}.plan-card{display:grid;grid-template-columns:76px 1fr auto;align-items:center;gap:16px;padding:14px;border:1px solid #e7ddd6;border-radius:18px;background:#fff;box-shadow:0 8px 25px rgba(70,43,29,.06);cursor:pointer;transition:.18s}.plan-card:hover{transform:translateY(-2px)}.plan-preview{width:76px;height:64px;border-radius:12px;background:linear-gradient(135deg,#6b4430,#a6785c);display:grid;place-items:center;color:#fff;font-size:28px;font-weight:900}.plan-info h2{margin:0 0 4px;font-size:17px}.plan-info p{margin:0;color:#8a7d75;font-size:12px}.plan-actions{display:flex}
    .operative-layout{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:14px;align-items:stretch}.plan-column{min-width:0}.editor-placeholder{min-height:65vh;border:1px dashed #d9ccc3;border-radius:18px;background:#fffaf7;padding:30px;display:flex;flex-direction:column;gap:8px;color:#81736b}.editor-placeholder strong{color:#65412e}.select-actions{display:flex;align-items:flex-end;gap:10px}.select-actions ion-select{min-width:180px}
    .category-create,.category-add{display:flex;gap:10px;align-items:flex-end}.category-create{max-width:600px;margin-bottom:22px}.category-create ion-input,.category-add ion-input{flex:1}.category-card{background:#fff;border:1px solid #e7ddd6;border-radius:18px;padding:18px;margin-bottom:16px}.category-card h2{margin:0 0 12px}.product-row{display:flex;justify-content:space-between;padding:12px 0;border-top:1px solid #f0e8e2}.product-row strong{color:#68422e}.category-add{padding-top:14px;margin-top:8px;border-top:1px dashed #e3d8d1}
    .empty{padding:70px 20px;text-align:center;border:1px dashed #d9ccc3;border-radius:20px;background:rgba(255,255,255,.65)}.empty>div{font-size:36px;color:#a27459}.empty h2{margin:10px 0 5px}.empty p{margin:0 0 20px;color:#81736b}.notice{max-width:700px;margin:40px auto;padding:20px;border:1px solid #e3cdbb;border-radius:14px;background:#fff8f3;color:#634431}
    .create-plan-modal{--width:min(460px,calc(100vw - 32px));--height:auto;--max-height:none;--border-radius:22px}.plan-dialog{width:100%;background:#fff;border-radius:22px;overflow:hidden}.dialog-header{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding:25px 26px 18px;border-bottom:1px solid #eee5df}.dialog-eyebrow{font-size:10px;font-weight:900;letter-spacing:.14em;color:#9a6749}.dialog-header h2{margin:5px 0;font-size:25px}.dialog-header p{margin:0;color:#8a7d75;font-size:13px}.dialog-close{width:34px;height:34px;border:0;border-radius:10px;background:#f5f0ec;color:#65412e;display:grid;place-items:center;cursor:pointer}.dialog-body{padding:22px 26px 8px}.dialog-actions{display:flex;justify-content:flex-end;gap:10px;padding:18px 26px 24px}
    @media(max-width:1000px){.operative-layout{grid-template-columns:1fr}.operative-page{padding-bottom:30px}}@media(max-width:760px){.topbar{grid-template-columns:1fr auto;gap:8px;padding:0 12px}.topbar-title,.connection{display:none}.page{padding:22px 14px 40px}.page-head,.page-head.compact{align-items:stretch;flex-direction:column}.select-actions{flex-direction:column;align-items:stretch}.select-actions ion-select{width:100%}.plans{grid-template-columns:1fr}.plan-card{grid-template-columns:58px 1fr auto}.plan-preview{width:58px;height:54px}.category-create,.category-add{flex-wrap:wrap}}
  `]
})
export class WorkspaceComponent implements OnInit, OnDestroy {
  activeTab = signal<'planos' | 'operativo' | 'productos'>('planos');
  editorMode = signal<'editor' | 'operativo'>('editor');
  plans = signal<FloorPlan[]>([]);
  selectedPlan = signal<FloorPlan | null>(null);
  categories = signal<ProductCategory[]>([]);
  products = signal<Product[]>([]);
  pendingCount = signal(0);
  toast = signal('');
  configured = true;
  newCategory = '';
  newProductName: Record<string, string> = {};
  newProductPrice: Record<string, number> = {};
  createPlanDialog = signal(false);
  newPlanName = '';
  private channel: any;

  constructor(private auth: AuthService, private floors: FloorPlanService, private product: ProductService, private orders: OrderService) {
    addIcons({ logOutOutline, addOutline, trashOutline, copyOutline, settingsOutline, closeOutline });
    this.configured = (this.floors as any).db.configured;
  }

  get activeLabel(): string { return this.activeTab() === 'planos' ? 'Planos' : this.activeTab() === 'operativo' ? 'Operativa' : 'Productos'; }

  async ngOnInit(): Promise<void> {
    try {
      this.plans.set(await this.floors.list());
      this.categories.set(await this.product.categories());
      this.products.set(await this.product.products());
      this.channel = this.orders.subscribe(() => this.refreshOperationalData());
    } catch (error) {
      this.toast.set(error instanceof Error ? error.message : 'Error cargando datos');
    }
  }

  ngOnDestroy(): void { this.channel?.unsubscribe?.(); }

  private async refreshOperationalData(): Promise<void> {
    if (this.activeTab() !== 'operativo') return;
    this.toast.set('Datos actualizados');
  }

  toggleEditorMode(): void { this.editorMode.set(this.editorMode() === 'editor' ? 'operativo' : 'editor'); }
  openCreatePlanDialog(): void { this.newPlanName = ''; this.createPlanDialog.set(true); }
  closeCreatePlanDialog(): void { this.createPlanDialog.set(false); this.newPlanName = ''; }

  async createPlan(): Promise<void> {
    const name = this.newPlanName.trim();
    const session = this.auth.session();
    if (!name || !session) { this.toast.set('No hay una sesión activa'); return; }
    try {
      const plan = await this.floors.create(name, 2000, 1200, session.user.id);
      this.plans.update(current => [...current, plan]);
      this.selectedPlan.set(plan);
      this.editorMode.set('editor');
      this.activeTab.set('operativo');
      this.closeCreatePlanDialog();
      this.toast.set('Plano creado correctamente');
    } catch (error) { this.toast.set(error instanceof Error ? error.message : 'No se pudo crear el plano'); }
  }

  openPlan(plan: FloorPlan): void { this.selectedPlan.set(plan); this.editorMode.set('operativo'); this.activeTab.set('operativo'); }
  openEditor(plan: FloorPlan): void { this.selectedPlan.set(plan); this.editorMode.set('editor'); this.activeTab.set('operativo'); }
  openPlanById(id: string): void { const plan = this.plans().find(item => item.id === id); if (plan) this.openPlan(plan); }

  async duplicate(plan: FloorPlan): Promise<void> {
    const session = this.auth.session();
    if (!session) return;
    try {
      const copy = await this.floors.create(`${plan.name} copia`, plan.width, plan.height, session.user.id);
      const snapshot = await this.floors.load(plan.id);
      await this.floors.saveSnapshot(copy.id, snapshot);
      this.plans.update(current => [...current, copy]);
      this.toast.set('Plano duplicado');
    } catch (error) { this.toast.set(error instanceof Error ? error.message : 'No se pudo duplicar'); }
  }

  async removePlan(plan: FloorPlan): Promise<void> {
    if (!confirm(`¿Eliminar "${plan.name}"?`)) return;
    try {
      await this.floors.remove(plan.id);
      this.plans.update(current => current.filter(item => item.id !== plan.id));
      if (this.selectedPlan()?.id === plan.id) this.selectedPlan.set(null);
      this.toast.set('Plano eliminado');
    } catch (error) { this.toast.set(error instanceof Error ? error.message : 'No se pudo eliminar'); }
  }

  productsFor(categoryId: string): Product[] { return this.products().filter(product => product.category_id === categoryId); }

  async createCategory(): Promise<void> {
    const name = this.newCategory.trim();
    if (!name) return;
    try {
      const category = await this.product.createCategory(name);
      this.categories.update(current => [...current, category]);
      this.newCategory = '';
      this.toast.set('Categoría creada');
    } catch (error) { this.toast.set(error instanceof Error ? error.message : 'No se pudo crear la categoría'); }
  }

  async createProduct(categoryId: string): Promise<void> {
    const name = this.newProductName[categoryId]?.trim();
    const price = Number(this.newProductPrice[categoryId]);
    if (!name || !Number.isFinite(price) || price < 0) return;
    try {
      const product = await this.product.createProduct(categoryId, name, price);
      this.products.update(current => [...current, product]);
      this.newProductName[categoryId] = '';
      this.newProductPrice[categoryId] = 0;
      this.toast.set('Producto añadido');
    } catch (error) { this.toast.set(error instanceof Error ? error.message : 'No se pudo crear el producto'); }
  }

  async logout(): Promise<void> { await this.auth.signOut(); }
}
