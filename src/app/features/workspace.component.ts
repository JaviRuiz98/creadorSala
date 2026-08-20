import {
  Component,
  OnDestroy,
  OnInit,
  signal
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  IonHeader,
  IonToolbar,
  IonButtons,
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

import {
  logOutOutline,
  addOutline,
  saveOutline,
  trashOutline,
  copyOutline,
  playOutline,
  settingsOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  closeOutline
} from 'ionicons/icons';

import { AuthService } from '../core/auth/auth.service';
import { FloorPlanService } from '../core/services/floor-plan.service';
import { ProductService } from '../core/services/product.service';
import { OrderService } from '../core/services/order.service';

import type {
  FloorPlan,
  Product,
  ProductCategory
} from '../core/models/models';

import { PlanEditorComponent } from './floor-plans/plan-editor.component';


@Component({
  selector: 'app-workspace',
  standalone: true,

  imports: [
    CommonModule,
    FormsModule,

    IonHeader,
    IonToolbar,
    IonButtons,
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

    PlanEditorComponent
  ],

  template: `

<ion-header>
  <ion-toolbar>

    <div class="topbar">

      <div class="brand-mini">
        <span>SALA</span>
        <strong>CHOCOLATTE</strong>
      </div>

      <div class="topbar-title">
        <span>Gestión de sala</span>

        <small>
          {{
            activeTab() === 'planos'
              ? 'Planos'
              : activeTab() === 'operativo'
                ? 'Operativa'
                : 'Productos'
          }}
        </small>
      </div>

      <div class="top-actions">

        <div class="connection">
          <span></span>
          Conectado
        </div>

        <ion-button
          fill="clear"
          class="logout-button"
          (click)="logout()">

          <ion-icon name="log-out-outline"></ion-icon>

        </ion-button>

      </div>

    </div>

  </ion-toolbar>
</ion-header>


<ion-content>

  <!-- NAV -->

  <div class="nav-wrap">

    <ion-segment
      [value]="activeTab()"
      (ionChange)="activeTab.set($any($event.detail.value))">

      <ion-segment-button value="planos">
        <ion-label>Planos</ion-label>
      </ion-segment-button>

      <ion-segment-button value="operativo">

        <ion-label>
          Operativa

          @if(pendingCount() > 0) {
            <ion-badge color="danger">
              {{ pendingCount() }}
            </ion-badge>
          }

        </ion-label>

      </ion-segment-button>

      <ion-segment-button value="productos">
        <ion-label>Productos</ion-label>
      </ion-segment-button>

    </ion-segment>

  </div>


  @if(!configured) {

    <div class="notice">

      Configura Supabase en
      <code>.env</code>.

    </div>

  }


  <!-- ========================= -->
  <!-- PLANOS -->
  <!-- ========================= -->

  @else if(activeTab() === 'planos') {

    <div class="page">

      <div class="page-head">

        <div>

          <span class="eyebrow">
            DISEÑO DE SALA
          </span>

          <h1>
            Planos
          </h1>

          <p>
            Organiza las zonas y mesas de la sala.
          </p>

        </div>


        <ion-button
          class="primary-button"
          (click)="openCreatePlanDialog()">

          <ion-icon
            name="add-outline"
            slot="start">
          </ion-icon>

          Nuevo plano

        </ion-button>

      </div>


      <div class="plans">

        @for(plan of plans(); track plan.id) {

          <article
            class="plan-card"
            (click)="openPlan(plan)">

            <div class="plan-preview">

              <span>
                {{ plan.name.charAt(0).toUpperCase() }}
              </span>

            </div>


            <div class="plan-info">

              <h2>
                {{ plan.name }}
              </h2>

              <p>
                {{ plan.width }} × {{ plan.height }}
                · Plano de sala
              </p>

            </div>


            <div class="plan-actions">

              <ion-button
                fill="clear"
                (click)="$event.stopPropagation(); openEditor(plan)">

                <ion-icon
                  name="settings-outline">
                </ion-icon>

              </ion-button>


              <ion-button
                fill="clear"
                (click)="$event.stopPropagation(); duplicate(plan)">

                <ion-icon
                  name="copy-outline">
                </ion-icon>

              </ion-button>


              <ion-button
                fill="clear"
                color="danger"
                (click)="$event.stopPropagation(); removePlan(plan)">

                <ion-icon
                  name="trash-outline">
                </ion-icon>

              </ion-button>

            </div>

          </article>

        }


        @empty {

          <div class="empty">

            <div>
              ▧
            </div>

            <h2>
              Aún no hay planos
            </h2>

            <p>
              Crea el primer plano de la sala para empezar.
            </p>

            <ion-button
              class="primary-button"
              (click)="openCreatePlanDialog()">

              <ion-icon
                name="add-outline"
                slot="start">
              </ion-icon>

              Crear plano

            </ion-button>

          </div>

        }

      </div>

    </div>

  }


  <!-- ========================= -->
  <!-- OPERATIVA -->
  <!-- ========================= -->

  @else if(activeTab() === 'operativo') {

    <div class="page">

      <div class="page-head compact">

        <div>

          <span class="eyebrow">
            OPERATIVA
          </span>

          <h1>
            Mesas y pedidos
          </h1>

          <p>
            Gestiona la sala en tiempo real.
          </p>

        </div>


        <div class="select-actions">

          <ion-select
            label="Plano"
            labelPlacement="stacked"
            [value]="selectedPlan()?.id"
            (ionChange)="openPlanById($any($event.detail.value))">

            @for(p of plans(); track p.id) {

              <ion-select-option [value]="p.id">
                {{ p.name }}
              </ion-select-option>

            }

          </ion-select>


          <ion-button
            fill="outline"
            class="secondary-button"
            (click)="
              editorMode.set(
                editorMode() === 'editor'
                  ? 'operativo'
                  : 'editor'
              )
            ">

            {{
              editorMode() === 'editor'
                ? 'Ver operativo'
                : 'Editar plano'
            }}

          </ion-button>

        </div>

      </div>


      @if(selectedPlan()) {

        <app-plan-editor
          [plan]="selectedPlan()!"
          [mode]="editorMode()"
          (pendingChanged)="pendingCount.set($event)">
        </app-plan-editor>

      }

      @else {

        <div class="empty">

          <div>
            ◫
          </div>

          <h2>
            Selecciona un plano
          </h2>

          <p>
            Crea o selecciona un plano para comenzar.
          </p>

        </div>

      }

    </div>

  }


  <!-- ========================= -->
  <!-- PRODUCTOS -->
  <!-- ========================= -->

  @else {

    <div class="page products">

      <div class="page-head">

        <div>

          <span class="eyebrow">
            CATÁLOGO
          </span>

          <h1>
            Productos
          </h1>

          <p>
            Gestiona las bebidas disponibles para los pedidos.
          </p>

        </div>

      </div>


      <div class="category-create">

        <ion-input
          label="Nueva categoría"
          labelPlacement="stacked"
          fill="outline"
          [(ngModel)]="newCategory">
        </ion-input>


        <ion-button
          class="primary-button"
          (click)="createCategory()">

          <ion-icon
            name="add-outline"
            slot="start">
          </ion-icon>

          Añadir categoría

        </ion-button>

      </div>


      @for(c of categories(); track c.id) {

        <section class="category-card">

          <h2>
            {{ c.name }}
          </h2>


          @for(p of productsFor(c.id); track p.id) {

            <div class="product-row">

              <span>
                {{ p.name }}
              </span>

              <strong>
                {{ p.price | number:'1.2-2' }} €
              </strong>

            </div>

          }


          <div class="category-add">

            <ion-input
              label="Producto"
              labelPlacement="stacked"
              fill="outline"
              [(ngModel)]="newProductName[c.id]">
            </ion-input>


            <ion-input
              label="Precio"
              type="number"
              labelPlacement="stacked"
              fill="outline"
              [(ngModel)]="newProductPrice[c.id]">
            </ion-input>


            <ion-button
              class="primary-button"
              (click)="createProduct(c.id)">

              Añadir

            </ion-button>

          </div>

        </section>

      }

    </div>

  }

</ion-content>


<!-- ================================= -->
<!-- DIALOG CREAR PLANO -->
<!-- ================================= -->

<ion-modal
  [isOpen]="createPlanDialog()"
  [backdropDismiss]="false"
  class="create-plan-modal"
  (didDismiss)="closeCreatePlanDialog()">

  <ng-template>

    <div class="plan-dialog">

      <div class="dialog-header">

        <div>

          <span class="dialog-eyebrow">
            NUEVO PLANO
          </span>

          <h2>
            Crear plano
          </h2>

          <p>
            Añade un nombre para identificar este plano.
          </p>

        </div>


        <button
          type="button"
          class="dialog-close"
          (click)="closeCreatePlanDialog()">

          <ion-icon name="close-outline"></ion-icon>

        </button>

      </div>


      <div class="dialog-body">

        <ion-input
          #planNameInput
          class="plan-name-input"
          label="Nombre del plano"
          labelPlacement="stacked"
          fill="outline"
          placeholder="Ej. Sala principal"
          [(ngModel)]="newPlanName"
          (keydown.enter)="createPlan()">

        </ion-input>

      </div>


      <div class="dialog-actions">

        <ion-button
          fill="outline"
          class="secondary-button"
          (click)="closeCreatePlanDialog()">

          Cancelar

        </ion-button>


        <ion-button
          class="primary-button"
          [disabled]="!newPlanName.trim()"
          (click)="createPlan()">

          <ion-icon
            name="add-outline"
            slot="start">
          </ion-icon>

          Crear plano

        </ion-button>

      </div>

    </div>

  </ng-template>

</ion-modal>


<ion-toast
  [isOpen]="toast() !== ''"
  [message]="toast()"
  [duration]="2200"
  (didDismiss)="toast.set('')">
</ion-toast>

`,

  styles: [`

/* ================================= */
/* GLOBAL BUTTONS */
/* ================================= */

ion-button {
  --border-radius: 10px;
  --box-shadow: none;
  font-weight: 700;
  text-transform: none;
}

.primary-button {
  --background: #65412e;
  --background-hover: #543523;
  --background-activated: #4b2f20;
  --color: #ffffff;
}

.secondary-button {
  --border-color: #d7c7bc;
  --color: #65412e;
  --background: #ffffff;
}


/* ================================= */
/* TOPBAR */
/* ================================= */

.topbar {
  width: 100%;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 24px;
  padding: 0 22px;
}

.brand-mini {
  display: flex;
  align-items: baseline;
  gap: 7px;
  color: #563522;
  letter-spacing: .08em;
}

.brand-mini span {
  font-weight: 900;
  font-size: 16px;
}

.brand-mini strong {
  font-weight: 900;
  font-size: 17px;
}

.topbar-title {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #9a8c84;
}

.topbar-title small {
  font-size: 15px;
  color: #2d211b;
  font-weight: 700;
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.connection {
  font-size: 12px;
  color: #6f7c72;
}

.connection span {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #4c9b6e;
  margin-right: 5px;
}


/* ================================= */
/* NAV */
/* ================================= */

.nav-wrap {
  padding: 14px 24px 0;
  background: #fff;
  border-bottom: 1px solid #eadfd8;
}

.nav-wrap ion-segment {
  max-width: 560px;
  margin: auto;
}


/* ================================= */
/* PAGE */
/* ================================= */

.page {
  max-width: 1250px;
  margin: auto;
  padding: 30px 24px 60px;
}

.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 20px;
  margin-bottom: 24px;
}

.page-head.compact {
  align-items: center;
}

.eyebrow {
  font-size: 11px;
  font-weight: 900;
  letter-spacing: .13em;
  color: #9a6749;
}

.page-head h1 {
  margin: 5px 0;
  color: #2d211b;
  font-size: 32px;
}

.page-head p {
  margin: 0;
  color: #81736b;
}


/* ================================= */
/* PLANS */
/* ================================= */

.plans {
  display: grid;
  grid-template-columns:
    repeat(auto-fill, minmax(310px, 1fr));

  gap: 16px;
}

.plan-card {
  display: grid;
  grid-template-columns: 76px 1fr auto;
  align-items: center;
  gap: 16px;

  padding: 14px;

  border: 1px solid #e7ddd6;
  border-radius: 18px;

  background: #fff;

  box-shadow:
    0 8px 25px rgba(70,43,29,.06);

  cursor: pointer;

  transition: .18s;
}

.plan-card:hover {
  transform: translateY(-2px);

  box-shadow:
    0 12px 30px rgba(70,43,29,.11);
}

.plan-preview {
  width: 76px;
  height: 64px;

  border-radius: 12px;

  background:
    linear-gradient(
      135deg,
      #6b4430,
      #a6785c
    );

  display: grid;
  place-items: center;

  color: #fff;
  font-size: 28px;
  font-weight: 900;
}

.plan-info h2 {
  margin: 0 0 4px;
  font-size: 17px;
}

.plan-info p {
  margin: 0;
  color: #8a7d75;
  font-size: 12px;
}

.plan-actions {
  display: flex;
}


/* ================================= */
/* EMPTY */
/* ================================= */

.empty {
  padding: 70px 20px;

  text-align: center;

  border: 1px dashed #d9ccc3;
  border-radius: 20px;

  background: rgba(255,255,255,.65);
}

.empty > div {
  font-size: 36px;
  color: #a27459;
}

.empty h2 {
  margin: 10px 0 5px;
}

.empty p {
  margin: 0 0 20px;
  color: #81736b;
}


/* ================================= */
/* NOTICE */
/* ================================= */

.notice {
  max-width: 700px;
  margin: 40px auto;
  padding: 20px;

  border: 1px solid #e3cdbb;
  border-radius: 14px;

  background: #fff8f3;
  color: #634431;
}


/* ================================= */
/* SELECT */
/* ================================= */

.select-actions {
  display: flex;
  align-items: flex-end;
  gap: 10px;
}

.select-actions ion-select {
  min-width: 180px;
}


/* ================================= */
/* PRODUCTS */
/* ================================= */

.category-create,
.category-add {
  display: flex;
  gap: 10px;
  align-items: flex-end;
}

.category-create {
  max-width: 600px;
  margin-bottom: 22px;
}

.category-create ion-input,
.category-add ion-input {
  flex: 1;
}

.category-card {
  background: #fff;
  border: 1px solid #e7ddd6;
  border-radius: 18px;
  padding: 18px;
  margin-bottom: 16px;
}

.category-card h2 {
  margin: 0 0 12px;
}

.product-row {
  display: flex;
  justify-content: space-between;

  padding: 12px 0;

  border-top: 1px solid #f0e8e2;
}

.product-row strong {
  color: #68422e;
}

.category-add {
  padding-top: 14px;
  margin-top: 8px;

  border-top: 1px dashed #e3d8d1;
}


/* ================================= */
/* CREATE PLAN DIALOG */
/* ================================= */

.create-plan-modal {
  --width: min(460px, calc(100vw - 32px));
  --height: auto;
  --max-height: none;

  --border-radius: 22px;
}

.plan-dialog {
  width: 100%;
  background: #fff;

  border-radius: 22px;

  overflow: hidden;

  box-shadow:
    0 25px 80px rgba(50,30,20,.22);
}


/* HEADER */

.dialog-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;

  gap: 20px;

  padding: 25px 26px 18px;

  border-bottom: 1px solid #eee5df;
}

.dialog-eyebrow {
  font-size: 10px;
  font-weight: 900;
  letter-spacing: .14em;
  color: #9a6749;
}

.dialog-header h2 {
  margin: 5px 0 5px;

  color: #2d211b;

  font-size: 25px;
  font-weight: 800;
}

.dialog-header p {
  margin: 0;

  color: #8a7d75;

  font-size: 13px;
}


/* CLOSE */

.dialog-close {
  width: 34px;
  height: 34px;

  border: 0;

  border-radius: 10px;

  background: #f5f0ec;

  color: #65412e;

  display: grid;
  place-items: center;

  cursor: pointer;

  transition: .15s;
}

.dialog-close:hover {
  background: #eadfd7;
}


/* BODY */

.dialog-body {
  padding: 22px 26px 8px;
}

.plan-name-input {
  width: 100%;
}


/* ACTIONS */

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;

  gap: 10px;

  padding: 18px 26px 24px;
}


/* ================================= */
/* MOBILE */
/* ================================= */

@media(max-width:760px) {

  .topbar {
    grid-template-columns: 1fr auto;
    gap: 8px;
    padding: 0 12px;
  }

  .topbar-title {
    display: none;
  }

  .connection {
    display: none;
  }

  .page {
    padding: 22px 14px 40px;
  }

  .page-head,
  .page-head.compact {
    align-items: stretch;
    flex-direction: column;
  }

  .select-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .select-actions ion-select {
    width: 100%;
  }

  .plans {
    grid-template-columns: 1fr;
  }

  .category-create,
  .category-add {
    flex-wrap: wrap;
  }

  .category-create ion-input,
  .category-add ion-input {
    min-width: 140px;
  }

  .plan-card {
    grid-template-columns: 58px 1fr auto;
  }

  .plan-preview {
    width: 58px;
    height: 54px;
  }

  .dialog-header {
    padding: 21px 20px 16px;
  }

  .dialog-body {
    padding: 18px 20px 5px;
  }

  .dialog-actions {
    padding: 15px 20px 20px;
  }

}

`]
})
export class WorkspaceComponent implements OnInit, OnDestroy {

  activeTab =
    signal<'planos' | 'operativo' | 'productos'>('planos');

  editorMode =
    signal<'editor' | 'operativo'>('editor');

  plans =
    signal<FloorPlan[]>([]);

  selectedPlan =
    signal<FloorPlan | null>(null);

  categories =
    signal<ProductCategory[]>([]);

  products =
    signal<Product[]>([]);

  pendingCount =
    signal(0);

  toast =
    signal('');

  configured = true;

  newCategory = '';

  newProductName: Record<string, string> = {};

  newProductPrice: Record<string, number> = {};

  /* DIALOG */

  createPlanDialog =
    signal(false);

  newPlanName = '';

  private channel: any;


  constructor(
    private auth: AuthService,
    private floors: FloorPlanService,
    private product: ProductService,
    private orders: OrderService
  ) {

    addIcons({
      logOutOutline,
      addOutline,
      saveOutline,
      trashOutline,
      copyOutline,
      playOutline,
      settingsOutline,
      checkmarkCircleOutline,
      alertCircleOutline,
      closeOutline
    });

    this.configured =
      (this.floors as any).db.configured;
  }


  async ngOnInit() {

    try {

      this.plans.set(
        await this.floors.list()
      );

      this.categories.set(
        await this.product.categories()
      );

      this.products.set(
        await this.product.products()
      );

      this.channel =
        this.orders.subscribe(
          () => this.toast.set('Datos actualizados')
        );

    } catch (e) {

      this.toast.set(
        e instanceof Error
          ? e.message
          : 'Error cargando datos'
      );

    }

  }


  ngOnDestroy() {

    if (this.channel) {
      this.channel.unsubscribe();
    }

  }


  /* ================================= */
  /* CREATE PLAN DIALOG */
  /* ================================= */

  openCreatePlanDialog() {

    this.newPlanName = '';

    this.createPlanDialog.set(true);

  }


  closeCreatePlanDialog() {

    this.createPlanDialog.set(false);

    this.newPlanName = '';

  }


  async createPlan() {

    const name =
      this.newPlanName.trim();

    if (!name) {
      return;
    }


    try {

      const session =
        this.auth.session();

      if (!session) {

        this.toast.set(
          'No hay una sesión activa'
        );

        return;

      }


      const plan =
        await this.floors.create(
          name,
          2000,
          1200,
          session.user.id
        );


      this.plans.update(
        current => [
          ...current,
          plan
        ]
      );


      this.selectedPlan.set(plan);

      this.createPlanDialog.set(false);

      this.newPlanName = '';

      this.toast.set(
        'Plano creado correctamente'
      );


    } catch (e) {

      this.toast.set(
        e instanceof Error
          ? e.message
          : 'No se pudo crear el plano'
      );

    }

  }


  /* ================================= */
  /* PLANS */
/* ================================= */

  openPlan(plan: FloorPlan) {

    this.selectedPlan.set(plan);

    this.editorMode.set('operativo');

    this.activeTab.set('operativo');

  }


  openEditor(plan: FloorPlan) {

    this.selectedPlan.set(plan);

    this.editorMode.set('editor');

    this.activeTab.set('operativo');

  }


  openPlanById(id: string) {

    const plan =
      this.plans().find(
        x => x.id === id
      );

    if (plan) {
      this.openPlan(plan);
    }

  }


  async duplicate(plan: FloorPlan) {

    try {

      const copy =
        await this.floors.create(
          `${plan.name} copia`,
          plan.width,
          plan.height,
          this.auth.session()!.user.id
        );


      const snapshot =
        await this.floors.load(
          plan.id
        );


      await this.floors.saveSnapshot(
        copy.id,
        snapshot
      );


      this.plans.update(
        current => [
          ...current,
          copy
        ]
      );


      this.toast.set(
        'Plano duplicado'
      );

    } catch (e) {

      this.toast.set(
        e instanceof Error
          ? e.message
          : 'No se pudo duplicar'
      );

    }

  }


  async removePlan(plan: FloorPlan) {

    if (
      !confirm(
        `¿Eliminar "${plan.name}"?`
      )
    ) {
      return;
    }


    try {

      await this.floors.remove(
        plan.id
      );


      this.plans.update(
        current =>
          current.filter(
            x => x.id !== plan.id
          )
      );


      if (
        this.selectedPlan()?.id ===
        plan.id
      ) {

        this.selectedPlan.set(null);

      }


      this.toast.set(
        'Plano eliminado'
      );

    } catch (e) {

      this.toast.set(
        e instanceof Error
          ? e.message
          : 'No se pudo eliminar'
      );

    }

  }


  /* ================================= */
  /* PRODUCTS */
/* ================================= */

  productsFor(
    categoryId: string
  ) {

    return this.products().filter(
      p => p.category_id === categoryId
    );

  }


  async createCategory() {

    if (
      !this.newCategory.trim()
    ) {
      return;
    }


    try {

      const category =
        await this.product.createCategory(
          this.newCategory.trim()
        );


      this.categories.update(
        current => [
          ...current,
          category
        ]
      );


      this.newCategory = '';

      this.toast.set(
        'Categoría creada'
      );

    } catch (e) {

      this.toast.set(
        e instanceof Error
          ? e.message
          : 'No se pudo crear la categoría'
      );

    }

  }


  async createProduct(
    categoryId: string
  ) {

    const name =
      this.newProductName[
        categoryId
      ]?.trim();

    const price =
      Number(
        this.newProductPrice[
          categoryId
        ]
      );


    if (
      !name ||
      !Number.isFinite(price)
    ) {
      return;
    }


    try {

      const product =
        await this.product.createProduct(
          categoryId,
          name,
          price
        );


      this.products.update(
        current => [
          ...current,
          product
        ]
      );


      this.newProductName[
        categoryId
      ] = '';

      this.newProductPrice[
        categoryId
      ] = 0;


      this.toast.set(
        'Producto añadido'
      );

    } catch (e) {

      this.toast.set(
        e instanceof Error
          ? e.message
          : 'No se pudo crear el producto'
      );

    }

  }


  /* ================================= */
  /* AUTH */
/* ================================= */

  async logout() {

    await this.auth.signOut();

  }

}