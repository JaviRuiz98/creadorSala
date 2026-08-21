import {
  Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy,
  Output, SimpleChanges, ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonButton, IonButtons, IonIcon, IonInput, IonItem, IonLabel,
  IonList, IonSelect, IonSelectOption
} from '@ionic/angular/standalone';
import Konva from 'konva';
import { FloorPlanService } from '../../core/services/floor-plan.service';
import { GeometryService, Point } from '../../core/services/geometry.service';
import { AuthService } from '../../core/auth/auth.service';
import { OrderService } from '../../core/services/order.service';
import { ProductService } from '../../core/services/product.service';
import type {
  ClubTable, FloorPlan, FloorPlanElement, FloorSnapshot, Product
} from '../../core/models/models';

type EditorTool = 'select' | 'draw' | 'pan' | 'text';

@Component({
  selector: 'app-plan-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonButton,
    IonButtons,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonSelect,
    IonSelectOption
  ],
  template: `
<div class="editor-shell">
  <div class="editor-toolbar">
    @if (mode === 'editor') {
      <div class="tool-group">
        <ion-button class="editor-button" size="small" [class.active]="tool === 'select'" (click)="setTool('select')">↖ Seleccionar</ion-button>
        <ion-button class="editor-button" size="small" [class.active]="tool === 'draw'" (click)="setTool('draw')">✏️ Dibujar</ion-button>
        <ion-button class="editor-button" size="small" [class.active]="tool === 'text'" (click)="setTool('text')">T Texto</ion-button>
        <ion-button class="editor-button" size="small" [class.active]="tool === 'pan'" (click)="setTool('pan')">✋ Pan</ion-button>
      </div>

      <div class="tool-group">
        <ion-button class="editor-button primary" size="small" (click)="saveDesign()">💾 Guardar diseño</ion-button>
        <ion-button class="editor-button danger" size="small" (click)="deleteSelected()" [disabled]="!selectedElementId && !selectedTable && !selectedReserved">🧹 Borrar</ion-button>
        <ion-button class="editor-button" size="small" (click)="clearDrawing()" [disabled]="drawing.length === 0">Borrar dibujo</ion-button>
        <ion-button class="editor-button" size="small" (click)="addTable()">+ Mesa</ion-button>
        <ion-button class="editor-button reserved-button" size="small" (click)="addReserved()">+ Reservado</ion-button>
        <ion-button class="editor-button icon-button" size="small" (click)="undo()" [disabled]="historyIndex < 1">↶</ion-button>
        <ion-button class="editor-button icon-button" size="small" (click)="redo()" [disabled]="historyIndex >= history.length - 1">↷</ion-button>
        <ion-button class="editor-button icon-button" size="small" (click)="zoom(-0.1)">−</ion-button>
        <ion-button class="editor-button icon-button" size="small" (click)="zoom(0.1)">+</ion-button>
      </div>

      <span class="tool-status">
        Herramienta: <strong>{{ toolLabel }}</strong>
        @if (selectedElementId) {
          <span class="selected-status">· Elemento seleccionado</span>
        }
        @if (selectedTable) {
          <span class="selected-status">· Mesa {{ selectedTable.number }}</span>
        }
        @if (selectedReserved) {
          <span class="selected-status">· Reservado {{ selectedReserved.number }}</span>
        }
      </span>
    } @else {
      <div class="tool-group">
        <ion-button class="editor-button" size="small" [class.active]="tool === 'select'" (click)="setTool('select')">↖ Seleccionar</ion-button>
        <ion-button class="editor-button" size="small" [class.active]="tool === 'pan'" (click)="setTool('pan')">✋ Pan</ion-button>
        <ion-button class="editor-button icon-button" size="small" (click)="zoom(-0.1)">−</ion-button>
        <ion-button class="editor-button icon-button" size="small" (click)="zoom(0.1)">+</ion-button>
      </div>
    }
  </div>

  <div
    class="canvas-area"
    #container
    [class.draw-mode]="tool === 'draw'"
    [class.text-mode]="tool === 'text'"
    (pointerdown)="pointerDown($event)"
    (pointermove)="pointerMove($event)"
    (pointerup)="pointerUp($event)"
    (pointercancel)="pointerUp($event)">
  </div>

@if (mode === 'operativo' && (selectedTable || selectedReserved)) {
    <aside class="orders-panel">
      <div class="orders-head">
        <strong>
          {{ selectedTable ? 'Mesa' : 'Reservado' }}
          {{ (selectedTable || selectedReserved)?.number }}
        </strong>
        <span>{{ selectedPending }} pendientes</span>
      </div>

      <div class="order-list">
        @for (item of orderItems; track item.id) {
          <div class="order-list-item">
            <ion-label>
              <strong>{{ item.product.name }}</strong>
              <span> × {{ item.quantity }}</span>
              <small>
                {{ item.status === 'PENDING' ? '🔴 Pendiente' : '🟢 Puesto' }}
              </small>
            </ion-label>

            @if (item.status === 'PENDING') {
              <ion-button
                class="small-action"
                size="small"
                (click)="markPlaced(item.id)">
                Puesta
              </ion-button>
            }
          </div>
        }
      </div>

      <div class="add-order">
        <ion-select
          label="Producto"
          labelPlacement="stacked"
          [(ngModel)]="selectedProductId">

          @for (p of products; track p.id) {
            <ion-select-option [value]="p.id">
              {{ p.name }}
            </ion-select-option>
          }
        </ion-select>

        <ion-input
          label="Cantidad"
          type="number"
          min="1"
          step="1"
          labelPlacement="stacked"
          [(ngModel)]="quantity">
        </ion-input>

        <ion-button
          class="editor-button primary full"
          expand="block"
          [disabled]="!selectedProductId || quantity < 1"
          (click)="addOrderItem()">
          Añadir
        </ion-button>
      </div>
    </aside>
  }

  @if (showOrderDialog) {
    <div
      class="dialog-backdrop order-backdrop"
      (click)="closeOrderDialog()">

      <div
        class="order-dialog attention-dialog"
        (click)="$event.stopPropagation()">

        <div class="order-dialog-header">
          <div>
            <span class="dialog-eyebrow">
              {{ selectedOrderTarget?.type === 'RESERVED' ? 'RESERVADO' : 'MESA' }}
            </span>

            <h2>{{ selectedOrderTarget?.number }}</h2>
          </div>

          <ion-button
            class="close-button"
            fill="clear"
            (click)="closeOrderDialog()">
            ✕
          </ion-button>
        </div>

        <div class="current-order">
          <div class="section-title">Pedido actual</div>

          @if (orderItems.length === 0) {
            <div class="empty-order">
              <span>🛒</span>
              <p>No hay productos en el pedido.</p>
            </div>
          } @else {

            @if (alcoholItems.length) {
              <div class="product-section alcohol-section">

                <div class="product-section-title">
                  🍺 Alcoholes
                </div>

                @for (item of alcoholItems; track item.id) {
                  <div class="order-item">

                    <div class="order-item-info">
                      <strong>{{ item.product.name }}</strong>
                      <span>
                        {{ item.status === 'PENDING' ? '🔴' : '🟢' }}
                      </span>
                    </div>

                    <div class="quantity-editor">
                      <ion-button
                        size="small"
                        class="qty-button"
                        (click)="changeItemQuantity(item, -1)">
                        −
                      </ion-button>

                      <span>{{ item.quantity }}</span>

                      <ion-button
                        size="small"
                        class="qty-button"
                        (click)="changeItemQuantity(item, 1)">
                        +
                      </ion-button>

                      <ion-button
                        size="small"
                        class="remove-item"
                        (click)="removeOrderItem(item)">
                        ✕
                      </ion-button>
                    </div>

                  </div>
                }
              </div>
            }

            @if (softDrinkItems.length) {
              <div class="product-section soft-section">

                <div class="product-section-title">
                  🥤 Refrescos
                </div>

                @for (item of softDrinkItems; track item.id) {
                  <div class="order-item">

                    <div class="order-item-info">
                      <strong>{{ item.product.name }}</strong>
                      <span>
                        {{ item.status === 'PENDING' ? '🔴' : '🟢' }}
                      </span>
                    </div>

                    <div class="quantity-editor">
                      <ion-button
                        size="small"
                        class="qty-button"
                        (click)="changeItemQuantity(item, -1)">
                        −
                      </ion-button>

                      <span>{{ item.quantity }}</span>

                      <ion-button
                        size="small"
                        class="qty-button"
                        (click)="changeItemQuantity(item, 1)">
                        +
                      </ion-button>

                      <ion-button
                        size="small"
                        class="remove-item"
                        (click)="removeOrderItem(item)">
                        ✕
                      </ion-button>
                    </div>

                  </div>
                }
              </div>
            }

            @if (otherOrderItems.length) {
              <div class="product-section">

                <div class="product-section-title">
                  📦 Otros
                </div>

                @for (item of otherOrderItems; track item.id) {
                  <div class="order-item">

                    <div class="order-item-info">
                      <strong>{{ item.product.name }}</strong>
                      <span>
                        {{ item.status === 'PENDING' ? '🔴' : '🟢' }}
                      </span>
                    </div>

                    <div class="quantity-editor">
                      <ion-button
                        size="small"
                        class="qty-button"
                        (click)="changeItemQuantity(item, -1)">
                        −
                      </ion-button>

                      <span>{{ item.quantity }}</span>

                      <ion-button
                        size="small"
                        class="qty-button"
                        (click)="changeItemQuantity(item, 1)">
                        +
                      </ion-button>

                      <ion-button
                        size="small"
                        class="remove-item"
                        (click)="removeOrderItem(item)">
                        ✕
                      </ion-button>
                    </div>

                  </div>
                }
              </div>
            }
          }
        </div>

        <div class="add-order-dialog">

          <div class="section-title">
            Añadir producto
          </div>

          <div class="add-product-row alcohol-row">

            <ion-select
              label="🍺 Alcoholes"
              labelPlacement="stacked"
              interface="popover"
              [(ngModel)]="selectedAlcoholProductId">

              <ion-select-option value="">
                Selecciona un alcohol
              </ion-select-option>

              @for (p of alcoholProducts; track p.id) {
                <ion-select-option [value]="p.id">
                  {{ p.name }}
                </ion-select-option>
              }
            </ion-select>

            <ion-input
              label="Cantidad"
              type="number"
              min="1"
              step="1"
              labelPlacement="stacked"
              [(ngModel)]="alcoholQuantity">
            </ion-input>

            <ion-button
              class="editor-button primary add-product-button"
              expand="block"
              [disabled]="!selectedAlcoholProductId || alcoholQuantity < 1"
              (click)="addAlcoholItem()">
              + Añadir alcohol
            </ion-button>

          </div>

          <div class="add-product-row soft-row">

            <ion-select
              label="🥤 Refrescos"
              labelPlacement="stacked"
              interface="popover"
              [(ngModel)]="selectedSoftDrinkProductId">

              <ion-select-option value="">
                Selecciona un refresco
              </ion-select-option>

              @for (p of softDrinkProducts; track p.id) {
                <ion-select-option [value]="p.id">
                  {{ p.name }}
                </ion-select-option>
              }
            </ion-select>

            <ion-input
              label="Cantidad"
              type="number"
              min="1"
              step="1"
              labelPlacement="stacked"
              [(ngModel)]="softDrinkQuantity">
            </ion-input>

            <ion-button
              class="editor-button primary add-product-button"
              expand="block"
              [disabled]="!selectedSoftDrinkProductId || softDrinkQuantity < 1"
              (click)="addSoftDrinkItem()">
              + Añadir refresco
            </ion-button>

          </div>
        </div>

        <div class="attention-question">
          ¿Ha sido atendida esta
          {{ selectedOrderTarget?.type === 'RESERVED' ? 'reservado' : 'mesa' }}?
        </div>

        <div class="dialog-actions attention-actions">
          <ion-button
            class="dialog-secondary"
            (click)="markAttended(false)">
            No ha sido atendida
          </ion-button>

          <ion-button
            class="dialog-button"
            [disabled]="orderItems.length === 0"
            (click)="markAttended(true)">
            Sí, atendida
          </ion-button>
        </div>

      </div>
    </div>
  }

  @if (showTextDialog) {
    <div
      class="dialog-backdrop"
      (click)="closeTextDialog()">

      <div
        class="text-dialog"
        (click)="$event.stopPropagation()">

        <div class="dialog-icon text-icon">
          T
        </div>

        <div class="dialog-content">

          <span class="dialog-eyebrow">
            EDITOR DE PLANO
          </span>

          <h2>Añadir texto</h2>

          <p>
            Introduce el texto que quieres colocar en el plano.
          </p>

          <ion-input
            class="text-input"
            label="Texto"
            labelPlacement="stacked"
            placeholder="Ej. Barra, Cocina, Entrada..."
            [(ngModel)]="newText"
            (keydown.enter)="confirmAddText()">
          </ion-input>

          <div class="dialog-actions">

            <ion-button
              class="dialog-secondary"
              (click)="closeTextDialog()">
              Cancelar
            </ion-button>

            <ion-button
              class="dialog-button"
              [disabled]="!newText.trim()"
              (click)="confirmAddText()">
              Añadir texto
            </ion-button>

          </div>

        </div>
      </div>
    </div>
  }

  @if (showSaveDialog) {
    <div
      class="dialog-backdrop"
      (click)="closeSaveDialog()">

      <div
        class="save-dialog"
        (click)="$event.stopPropagation()">

        <div class="dialog-icon">
          ✓
        </div>

        <div class="dialog-content">

          <span class="dialog-eyebrow">
            SALA CHOCOLATTE
          </span>

          <h2>Diseño guardado</h2>

          <p>
            El diseño del plano se ha guardado correctamente.
          </p>

          <ion-button
            class="dialog-button"
            expand="block"
            (click)="closeSaveDialog()">
            Continuar
          </ion-button>

        </div>
      </div>
    </div>
  }
</div>
`,

  styles: [`

.editor-shell{
  position:relative;
  display:flex;
  min-height:65vh;
  overflow:hidden;
  background:#f4eee9;
  border-radius:18px;
  border:1px solid #e3d5ca;
  box-shadow:0 12px 35px rgba(70,43,29,.08);
}

.editor-toolbar{
  position:absolute;
  z-index:20;
  top:12px;
  left:12px;
  right:12px;
  display:flex;
  gap:8px;
  flex-wrap:wrap;
  align-items:center;
  pointer-events:none;
}

.editor-toolbar > *{
  pointer-events:auto;
}

.tool-group{
  display:flex;
  gap:5px;
  flex-wrap:wrap;
  padding:5px;
  background:rgba(255,252,249,.96);
  border:1px solid #e2d5cc;
  border-radius:12px;
  box-shadow:0 5px 18px rgba(70,43,29,.10);
  backdrop-filter:blur(8px);
}

.editor-button{
  --background:#fffaf6;
  --background-hover:#f4e7de;
  --background-activated:#ead8ca;
  --color:#5b3928;
  --border-color:#d8c4b6;
  --border-style:solid;
  --border-width:1px;
  --border-radius:9px;
  --box-shadow:none;
  font-weight:700;
  font-size:12px;
  margin:0;
}

.editor-button:hover{
  --background:#f4e7de;
}

.editor-button.active{
  --background:#704936;
  --color:#ffffff;
  --border-color:#704936;
}

.editor-button.primary{
  --background:#6b4430;
  --color:#ffffff;
  --border-color:#6b4430;
}

.editor-button.primary:hover{
  --background:#593624;
}

.editor-button.danger{
  --color:#8c3f3f;
  --border-color:#d9b7b0;
}

.editor-button.danger:hover{
  --background:#f8e8e5;
  --color:#783333;
}

.editor-button.reserved-button{
  --background:#7a4b2e;
  --color:#ffffff;
  --border-color:#7a4b2e;
}

.editor-button.reserved-button:hover{
  --background:#653c24;
}

.editor-button.full{
  width:100%;
}

.editor-button.icon-button{
  min-width:38px;
}

.editor-button:disabled{
  opacity:.45;
}

.tool-status{
  background:rgba(255,252,249,.96);
  padding:9px 12px;
  border-radius:10px;
  border:1px solid #e2d5cc;
  color:#725e52;
  font-size:12px;
  box-shadow:0 5px 18px rgba(70,43,29,.08);
}

.tool-status strong{
  color:#4f3021;
}

.selected-status{
  color:#8b5a3c;
  font-weight:700;
}

.canvas-area{
  flex:1;
  min-height:65vh;
  touch-action:none;
  cursor:default;
  background:#ffffff;
  background-image:
    linear-gradient(#f1eeeb 1px,transparent 1px),
    linear-gradient(90deg,#f1eeeb 1px,transparent 1px);
  background-size:25px 25px;
}

.canvas-area.draw-mode{
  cursor:crosshair;
}

.canvas-area.text-mode{
  cursor:text;
}

.orders-panel{
  width:340px;
  max-width:38vw;
  background:#fffaf7;
  overflow:auto;
  border-left:1px solid #dfd1c8;
  padding-top:68px;
}

.orders-head{
  padding:14px;
  display:flex;
  justify-content:space-between;
  color:#4e3326;
  border-bottom:1px solid #eadfd8;
}

.add-order{
  padding:14px;
  display:grid;
  gap:8px;
}

/* =========================================================
   DIALOGO PEDIDO
   ========================================================= */

.dialog-backdrop{
  position:fixed !important;
  inset:0 !important;
  z-index:99999 !important;

  display:flex;
  align-items:center;
  justify-content:center;

  width:100vw;
  height:100vh;

  box-sizing:border-box;
  padding:12px;

  background:rgba(45,30,22,.38);
  backdrop-filter:blur(4px);

  overflow-y:auto;
  overscroll-behavior:contain;
}

.order-backdrop{
  position:fixed !important;
  inset:0 !important;
  z-index:99999 !important;
}

.order-dialog{
  position:relative;
  z-index:100000;

  width:min(620px,calc(100vw - 24px));
  max-width:620px;

  max-height:calc(100vh - 24px);

  display:flex;
  flex-direction:column;

  margin:auto;

  background:#fffaf7;
  border:1px solid #e2d5cc;
  border-radius:20px;

  overflow:hidden;

  box-shadow:0 25px 70px rgba(45,30,22,.30);

  animation:dialogIn .18s ease-out;

  box-sizing:border-box;
}

.order-dialog-header{
  flex-shrink:0;

  display:flex;
  align-items:center;
  justify-content:space-between;

  padding:16px 20px;

  border-bottom:1px solid #eadfd8;
  background:#fffaf7;
}

.order-dialog-header h2{
  margin:2px 0 0;
  color:#2d211b;
  font-size:24px;
}

.close-button{
  --color:#725e52;
  --background:transparent;
  --box-shadow:none;
  font-size:18px;
  margin:0;
}

/* =========================================================
   PEDIDO ACTUAL
   ========================================================= */

.current-order{
  padding:14px 20px;

  overflow-y:auto;

  flex:1;
  min-height:0;

  max-height:45vh;
}

.section-title{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;

  margin-bottom:10px;

  color:#4e3326;
  font-size:15px;
  font-weight:800;
}

.pending-badge{
  padding:4px 8px;
  border-radius:999px;
  background:#f5dfdf;
  color:#9f2f3a;
  font-size:11px;
  font-weight:800;
}

.empty-order{
  padding:20px 15px;
  text-align:center;

  border:1px dashed #d8c4b6;
  border-radius:12px;

  background:#fff;
}

.empty-order span{
  display:block;
  font-size:28px;
  margin-bottom:6px;
}

.empty-order p{
  margin:0;
  color:#81736b;
  font-size:13px;
}

.order-items{
  display:grid;
  gap:8px;
}

.order-item{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:15px;

  padding:9px 12px;

  background:#ffffff;
  border:1px solid #eadfd8;
  border-radius:11px;
}

.order-item-info{
  display:flex;
  align-items:center;
  gap:8px;
  min-width:0;
}

.order-item-info strong{
  color:#3d2a20;
  font-size:14px;
}

.order-item-info span{
  color:#8b5a3c;
  font-size:13px;
  font-weight:800;
}

.order-item-status{
  display:flex;
  align-items:center;
  gap:8px;
  white-space:nowrap;
  font-size:11px;
  font-weight:700;
}

.order-item-status.pending{
  color:#9f2f3a;
}

.order-item-status.placed{
  color:#4c8b62;
}

.small-action{
  --background:#f4e7de;
  --color:#5b3928;
  --border-radius:8px;
  --box-shadow:none;

  font-size:10px;
  margin:0;
  height:28px;
}

/* =========================================================
   SECCIONES ALCOHOL / REFRESCOS
   ========================================================= */

.product-section{
  display:grid;
  gap:6px;
  margin-bottom:10px;
}

.product-section-title{
  padding:6px 9px;

  border-radius:8px;

  font-size:12px;
  font-weight:900;
  letter-spacing:.04em;

  background:#f4e7de;
  color:#5b3928;
}

.alcohol-section .product-section-title{
  background:#f3dfdf;
  color:#8f3038;
}

.soft-section .product-section-title{
  background:#e2f0e7;
  color:#3d7652;
}

.quantity-editor{
  display:flex;
  align-items:center;
  gap:6px;
  flex-shrink:0;
}

.quantity-editor > span{
  min-width:24px;
  text-align:center;
  font-weight:800;
  color:#4e3326;
}

.qty-button{
  --background:#f4e7de;
  --color:#5b3928;
  --border-radius:7px;
  --box-shadow:none;

  margin:0;
  height:28px;
  min-width:28px;
}

.remove-item{
  --background:#f5dfdf;
  --color:#9f2f3a;
  --border-radius:7px;
  --box-shadow:none;

  margin:0;
  height:28px;
  min-width:28px;
}

.order-list{
  padding:0 10px;
  max-height:35vh;
  overflow:auto;
}

.order-list-item{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:8px;

  padding:9px 4px;

  border-bottom:1px solid #eadfd8;
}

.order-list-item ion-label{
  display:grid;
  gap:2px;
}

.order-list-item ion-label strong{
  color:#3d2a20;
  font-size:13px;
}

.order-list-item ion-label span{
  color:#8b5a3c;
  font-size:12px;
}

.order-list-item ion-label small{
  color:#81736b;
  font-size:10px;
}

/* =========================================================
   AÑADIR PRODUCTOS
   ========================================================= */

.add-order-dialog{
  flex-shrink:0;

  padding:12px 20px;

  display:grid;
  gap:8px;

  border-top:1px solid #eadfd8;
  background:#fdf8f4;
}

.add-product-row{
  display:grid;

  /*
   * Antes:
   * selector
   * cantidad
   * boton
   *
   * Ahora:
   * selector | cantidad | boton
   */
  grid-template-columns:minmax(0,1fr) 82px auto;

  align-items:end;

  gap:8px;

  padding:7px 8px;

  border-radius:10px;

  background:#fff;
  border:1px solid #eadfd8;

  min-height:0;
}

.alcohol-row{
  border-color:#eccfcf;
}

.soft-row{
  border-color:#cfe6d7;
}

.add-product-button{
  margin:0;

  white-space:nowrap;

  height:40px;
}

/* =========================================================
   PARTE INFERIOR DEL DIALOGO
   ========================================================= */

.attention-question{
  flex-shrink:0;

  padding:10px 20px 6px;

  text-align:center;

  color:#4e3326;
  font-weight:800;
}

.attention-actions{
  flex-shrink:0;

  padding:6px 20px 14px;
}

.order-dialog-footer{
  display:flex;
  justify-content:flex-end;

  padding:12px 22px;

  border-top:1px solid #eadfd8;
  background:#fffaf7;
}

/* =========================================================
   OTROS DIALOGOS
   ========================================================= */

.save-dialog,
.text-dialog{
  width:min(380px,calc(100vw - 40px));

  background:#fffaf7;
  border:1px solid #e2d5cc;
  border-radius:20px;
  overflow:hidden;

  box-shadow:0 25px 70px rgba(45,30,22,.25);

  animation:dialogIn .18s ease-out;
}

.text-dialog{
  width:min(420px,calc(100vw - 40px));
}

.dialog-icon{
  width:54px;
  height:54px;

  margin:28px auto 0;

  display:grid;
  place-items:center;

  border-radius:50%;

  background:#e9f3ec;
  color:#4c8b62;

  font-size:25px;
  font-weight:900;
}

.dialog-icon.text-icon{
  background:#f1e5dc;
  color:#6b4430;
}

.dialog-content{
  padding:18px 28px 26px;
  text-align:center;
}

.dialog-eyebrow{
  display:block;

  margin-bottom:7px;

  color:#9a6749;

  font-size:10px;
  font-weight:900;

  letter-spacing:.14em;
}

.dialog-content h2{
  margin:0 0 8px;

  color:#2d211b;
  font-size:23px;
}

.dialog-content p{
  margin:0 0 22px;

  color:#81736b;

  font-size:14px;
  line-height:1.5;
}

.text-input{
  display:block;

  margin-bottom:20px;
  text-align:left;

  --background:#ffffff;
  --border-color:#d8c4b6;
  --border-radius:10px;
  --color:#3d2a20;
  --padding-start:12px;
  --padding-end:12px;
  --highlight-color-focused:#6b4430;
}

.dialog-actions{
  display:flex;
  gap:8px;
  justify-content:flex-end;
}

.dialog-button{
  --background:#6b4430;
  --background-hover:#593624;
  --color:#fff;
  --border-radius:10px;

  font-weight:700;
  margin:0;

  flex:1;
}

.dialog-secondary{
  --background:#f4e7de;
  --background-hover:#ead8ca;
  --color:#5b3928;
  --border-radius:10px;

  font-weight:700;
  margin:0;
}

/* =========================================================
   ANIMACION
   ========================================================= */

@keyframes dialogIn{
  from{
    opacity:0;
    transform:translateY(8px) scale(.98);
  }

  to{
    opacity:1;
    transform:translateY(0) scale(1);
  }
}

/* =========================================================
   TABLET / MOVIL
   ========================================================= */

@media (max-width:800px){

  .editor-shell{
    min-height:70vh;
  }

  .orders-panel{
    position:absolute;

    right:0;
    top:0;
    bottom:0;

    width:min(380px,92vw);
    max-width:none;

    z-index:30;

    box-shadow:-8px 0 24px rgba(45,30,22,.18);
  }

  .tool-status{
    display:none;
  }

  .editor-toolbar{
    top:8px;
    left:8px;
    right:8px;
  }

  .dialog-actions{
    flex-direction:column;
  }

  .dialog-secondary,
  .dialog-button{
    width:100%;
  }

  .order-dialog{
    width:calc(100vw - 20px);
    max-width:none;
    max-height:calc(100vh - 20px);
  }

  .current-order{
    max-height:none;
  }

  .order-item{
    align-items:flex-start;
  }

  .add-product-row{
    grid-template-columns:minmax(0,1fr) 78px;
  }

  .add-product-button{
    grid-column:1 / -1;
    width:100%;
  }
}

/* =========================================================
   MOVIL PEQUEÑO
   ========================================================= */

@media (max-width:480px){

  .dialog-backdrop{
    padding:8px;
  }

  .order-dialog{
    width:calc(100vw - 16px);
    max-height:calc(100vh - 16px);

    border-radius:16px;
  }

  .order-dialog-header{
    padding:12px 14px;
  }

  .order-dialog-header h2{
    font-size:20px;
  }

  .current-order{
    padding:10px 14px;
  }

  .add-order-dialog{
    padding:10px 14px;
  }

  .attention-question{
    padding:8px 14px 4px;
    font-size:13px;
  }

  .attention-actions{
    padding:4px 14px 10px;
  }

  .add-product-row{
    grid-template-columns:minmax(0,1fr) 70px;
    gap:6px;
    padding:6px;
  }
}

`]
})
export class PlanEditorComponent
  implements OnChanges, OnDestroy {
  @Input({ required: true })
  plan!: FloorPlan;
  @Input()
  mode:
    'editor' |
    'operativo' =
    'editor';
  @Output()
  pendingChanged =
    new EventEmitter<number>();
  @ViewChild(
    'container',
    { static: true }
  )
  container!: ElementRef<HTMLDivElement>;
  private stage!: Konva.Stage;
  private layer!: Konva.Layer;
  private draftLayer!: Konva.Layer;
  private drawingShape:
    Konva.Line | null = null;
  private drawingPointerId:
    number | null = null;
  drawing: Point[] = [];
  elements:
    FloorPlanElement[] = [];
  tables:
    ClubTable[] = [];
  reserved:
    ClubTable[] = [];
  selectedTable:
    ClubTable | null = null;
  selectedReserved:
    ClubTable | null = null;
  selectedElementId:
    string | null = null;
  private activeEndpoint:
    'start' |
    'end' |
    null = null;
  private endpointShape:
    Konva.Circle | null = null;
  history:
    FloorSnapshot[] = [];
  historyIndex =
    -1;
  tool:
    EditorTool =
    'select';
  showTextDialog =
    false;
  newText =
    '';
  private textPosition:
    Point | null = null;
  selectedProductId =
    '';
  quantity =
    1;
  selectedAlcoholProductId =
    '';
  alcoholQuantity =
    1;
  selectedSoftDrinkProductId =
    '';
  softDrinkQuantity =
    1;
  products:
    Product[] = [];
  productCategories:
    Array<{ id: string; name: string }> = [];
  orderItems:
    Array<any> = [];
  orderCountMap =
    new Map<string, number>();
  selectedPending =
    0;
  get alcoholItems(): Array<any> {
    return this.orderItems.filter(i => this.isAlcohol(i));
  }
  get softDrinkItems(): Array<any> {
    return this.orderItems.filter(i => this.isSoftDrink(i));
  }
  get otherOrderItems(): Array<any> {
    return this.orderItems.filter(i => !this.isAlcohol(i) && !this.isSoftDrink(i));
  }
  get alcoholProducts(): Product[] {
    return this.products.filter(p => this.isAlcoholProduct(p));
  }
  get softDrinkProducts(): Product[] {
    return this.products.filter(p => this.isSoftDrinkProduct(p));
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
    const category = this.productCategories.find(c => c.id === product?.category_id);
    return String(category?.name ?? product?.category?.name ?? '').trim().toLowerCase();
  }
  private isAlcohol(item: any): boolean {
    const name = this.categoryName(item?.product);
    return name.includes('alcohol') || name.includes('alcoh');
  }
  private isSoftDrink(item: any): boolean {
    const name = this.categoryName(item?.product);
    return name.includes('refresco') || name.includes('refrescos') || name.includes('bebida');
  }
  selectedOrderTarget:
    ClubTable | null = null;
  showOrderDialog =
    false;
  private realtimeChannel:
    any;
  pendingMap =
    new Map<string, number>();
  showSaveDialog =
    false;
  private _panMode =
    false;
  get panMode(): boolean {
    return this._panMode;
  }
  set panMode(
    value: boolean
  ) {
    this._panMode =
      value;
  }
  get toolLabel(): string {
    if (
      this.tool === 'draw'
    ) {
      return 'Dibujar paredes';
    }
    if (
      this.tool === 'text'
    ) {
      return 'Añadir texto';
    }
    if (
      this.tool === 'pan'
    ) {
      return 'Mover plano';
    }
    return 'Seleccionar';
  }
  constructor(
    private floors:
      FloorPlanService,
    private geometry:
      GeometryService,
    private auth:
      AuthService,
    private orders:
      OrderService,
    private productService:
      ProductService
  ) {}
  async ngOnChanges(
    changes: SimpleChanges
  ) {
    if (
      changes['plan']?.currentValue
    ) {
      await this.load();
    }
  }
  private getLineEndpoints(
    e: FloorPlanElement
  ): {
    start: Point;
    end: Point;
  } | null {
    if (
      !e.points ||
      e.points.length < 4
    ) {
      return null;
    }
    return {
      start: {
        x:
          e.points[0],
        y:
          e.points[1]
      },
      end: {
        x:
          e.points[
            e.points.length - 2
          ],
        y:
          e.points[
            e.points.length - 1
          ]
      }
    };
  }
  private updateLineEndpoint(
    e: FloorPlanElement,
    endpoint:
      'start' |
      'end',
    point: Point
  ) {
    if (
      !e.points ||
      e.points.length < 4
    ) {
      return;
    }
    if (
      endpoint === 'start'
    ) {
      e.points[0] =
        point.x;
      e.points[1] =
        point.y;
    }
    else {
      e.points[
        e.points.length - 2
      ] =
        point.x;
      e.points[
        e.points.length - 1
      ] =
        point.y;
    }
    e.x =
      e.points[0];
    e.y =
      e.points[1];
    const endpoints =
      this.getLineEndpoints(e);
    if (endpoints) {
      e.width =
        endpoints.end.x -
        endpoints.start.x;
      e.height =
        endpoints.end.y -
        endpoints.start.y;
    }
    e.updated_at =
      new Date()
        .toISOString();
  }
  private moveLine(
    e: FloorPlanElement,
    dx: number,
    dy: number
  ) {
    if (
      e.points &&
      e.points.length >= 2
    ) {
      e.points =
        e.points.map(
          (
            value,
            index
          ) =>
            value +
            (
              index % 2 === 0
                ? dx
                : dy
            )
        );
    }
    e.x +=
      dx;
    e.y +=
      dy;
    e.updated_at =
      new Date()
        .toISOString();
  }
  private async load() {
    const snap =
      await this.floors.load(
        this.plan.id
      );
    this.elements =
      snap.elements;
    this.tables =
      (snap.tables ?? [])
        .filter(
          t =>
            t.type !== 'RESERVED'
        );
    const snapshotReserved =
      (snap as any).reserved ?? [];
    const legacyReserved =
      (snap.tables ?? [])
        .filter(
          t =>
            t.type === 'RESERVED'
        );
    this.reserved = [
      ...snapshotReserved,
      ...legacyReserved.filter(
        legacy =>
          !snapshotReserved.some(
            (r: ClubTable) =>
              r.id === legacy.id
          )
      )
    ];
    this.selectedTable =
      null;
    this.selectedReserved =
      null;
    this.selectedElementId =
      null;
    this.selectedOrderTarget =
      null;
    this.showOrderDialog =
      false;
    this.activeEndpoint =
      null;
    this.endpointShape =
      null;
    this.clearDrawing();
    this.history = [];
    this.historyIndex =
      -1;
    this.pushHistory();
    this.products =
      await this.productService.products();
    try {
      this.productCategories =
        await this.productService.categories();
    } catch {
      this.productCategories = [];
    }
    await this.refreshPendingMap();
    this.initStage();
    if (
      this.realtimeChannel
    ) {
      this.realtimeChannel.unsubscribe();
    }
    this.realtimeChannel =
      this.orders.subscribe(
        () =>
          void this.refreshPendingMap()
      );
  }
  private initStage() {
    if (this.stage) {
      this.stage.destroy();
    }
    const el =
      this.container.nativeElement;
    const width =
      Math.max(
        el.clientWidth,
        600
      );
    const height =
      Math.max(
        el.clientHeight,
        500
      );
    this.stage =
      new Konva.Stage({
        container: el,
        width,
        height,
        draggable: false
      });
    this.layer =
      new Konva.Layer();
    this.draftLayer =
      new Konva.Layer();
    this.stage.add(
      this.layer
    );
    this.stage.add(
      this.draftLayer
    );
    this.stage.on(
      'wheel',
      (e) => {
        e.evt.preventDefault();
        this.zoomAtPointer(
          e.evt as WheelEvent,
          e.evt.deltaY < 0
            ? 0.1
            : -0.1
        );
      }
    );
    this.render();
  }
  private render() {
    if (!this.layer) {
      return;
    }
    this.layer.destroyChildren();
    this.activeEndpoint =
      null;
    this.endpointShape =
      null;
    for (
      const e of this.elements
    ) {
      if (
        String(e.kind) === 'text'
      ) {
        const selected =
          this.selectedElementId ===
          e.id;
        const text =
          new Konva.Text({
            x:
              e.x,
            y:
              e.y,
            text:
              e.label ?? '',
            fill:
              selected
                ? '#6b4430'
                : '#2d211b',
            fontSize:
              22,
            fontStyle:
              'bold',
            padding:
              6,
            draggable:
              this.mode === 'editor' &&
              this.tool === 'select',
            name:
              e.id,
            shadowColor:
              'rgba(0,0,0,.12)',
            shadowBlur:
              selected
                ? 6
                : 0,
            shadowOffset:
              selected
                ? {
                    x: 0,
                    y: 2
                  }
                : undefined
          });
        text.on(
          'click tap',
          (event) => {
            event.cancelBubble =
              true;
            if (
              this.mode !==
              'editor'
            ) {
              return;
            }
            if (
              this.tool !==
              'select'
            ) {
              return;
            }
            this.selectedElementId =
              e.id;
            this.selectedTable =
              null;
            this.selectedReserved =
              null;
            this.render();
          }
        );
        text.on(
          'dragend',
          () => {
            e.x =
              text.x();
            e.y =
              text.y();
            e.updated_at =
              new Date()
                .toISOString();
            this.pushHistory();
            this.render();
          }
        );
        this.layer.add(
          text
        );
        continue;
      }
      const points =
        e.points ??
        [
          e.x,
          e.y,
          e.x + e.width,
          e.y + e.height
        ];
      const selected =
        this.selectedElementId ===
        e.id;
      const line =
        new Konva.Line({
          points,
          stroke:
            selected
              ? '#8b5a3c'
              : String(e.kind) === 'wall'
                ? '#111111'
                : String(e.kind) === 'door'
                  ? '#198754'
                  : '#555555',
          strokeWidth:
            selected
              ? 16
              : String(e.kind) === 'wall'
                ? 12
                : 6,
          lineCap:
            'round',
          lineJoin:
            'round',
          draggable:
            this.mode === 'editor' &&
            this.tool === 'select',
          name:
            e.id
        });
      line.on(
        'click tap',
        (event) => {
          event.cancelBubble =
            true;
          if (
            this.mode !==
              'editor' ||
            this.tool !==
              'select'
          ) {
            return;
          }
          this.selectedElementId =
            e.id;
          this.selectedTable =
            null;
          this.selectedReserved =
            null;
          this.activeEndpoint =
            null;
          this.render();
        }
      );
      line.on(
        'dragend',
        () => {
          if (
            this.activeEndpoint
          ) {
            line.position({
              x: 0,
              y: 0
            });
            return;
          }
          const dx =
            line.x();
          const dy =
            line.y();
          if (
            dx === 0 &&
            dy === 0
          ) {
            return;
          }
          this.moveLine(
            e,
            dx,
            dy
          );
          line.position({
            x: 0,
            y: 0
          });
          this.pushHistory();
          this.render();
        }
      );
      this.layer.add(
        line
      );
      if (
        selected &&
        this.mode === 'editor' &&
        this.tool === 'select'
      ) {
        const endpoints =
          this.getLineEndpoints(e);
        if (endpoints) {
          const startCircle =
            new Konva.Circle({
              x:
                endpoints.start.x,
              y:
                endpoints.start.y,
              radius:
                9,
              fill:
                '#ffffff',
              stroke:
                '#8b5a3c',
              strokeWidth:
                4,
              draggable:
                true,
              name:
                `${e.id}-start-endpoint`
            });
          startCircle.on(
            'mousedown touchstart',
            (event) => {
              event.cancelBubble =
                true;
              this.activeEndpoint =
                'start';
              this.selectedElementId =
                e.id;
            }
          );
          startCircle.on(
            'dragstart',
            (event) => {
              event.cancelBubble =
                true;
              this.activeEndpoint =
                'start';
            }
          );
          startCircle.on(
            'dragmove',
            (event) => {
              event.cancelBubble =
                true;
              const point =
                this.getStagePointerPoint(
                  event.evt
                );
              if (!point) {
                return;
              }
              this.updateLineEndpoint(
                e,
                'start',
                point
              );
              line.points(
                e.points ?? []
              );
              startCircle.position({
                x:
                  point.x,
                y:
                  point.y
              });
              this.layer.batchDraw();
            }
          );
          startCircle.on(
            'dragend',
            (event) => {
              event.cancelBubble =
                true;
              const point =
                this.getStagePointerPoint(
                  event.evt
                );
              if (point) {
                this.updateLineEndpoint(
                  e,
                  'start',
                  point
                );
              }
              this.activeEndpoint =
                null;
              this.endpointShape =
                null;
              this.pushHistory();
              this.render();
            }
          );
          const endCircle =
            new Konva.Circle({
              x:
                endpoints.end.x,
              y:
                endpoints.end.y,
              radius:
                9,
              fill:
                '#ffffff',
              stroke:
                '#8b5a3c',
              strokeWidth:
                4,
              draggable:
                true,
              name:
                `${e.id}-end-endpoint`
            });
          endCircle.on(
            'mousedown touchstart',
            (event) => {
              event.cancelBubble =
                true;
              this.activeEndpoint =
                'end';
              this.selectedElementId =
                e.id;
            }
          );
          endCircle.on(
            'dragstart',
            (event) => {
              event.cancelBubble =
                true;
              this.activeEndpoint =
                'end';
            }
          );
          endCircle.on(
            'dragmove',
            (event) => {
              event.cancelBubble =
                true;
              const point =
                this.getStagePointerPoint(
                  event.evt
                );
              if (!point) {
                return;
              }
              this.updateLineEndpoint(
                e,
                'end',
                point
              );
              line.points(
                e.points ?? []
              );
              endCircle.position({
                x:
                  point.x,
                y:
                  point.y
              });
              this.layer.batchDraw();
            }
          );
          endCircle.on(
            'dragend',
            (event) => {
              event.cancelBubble =
                true;
              const point =
                this.getStagePointerPoint(
                  event.evt
                );
              if (point) {
                this.updateLineEndpoint(
                  e,
                  'end',
                  point
                );
              }
              this.activeEndpoint =
                null;
              this.endpointShape =
                null;
              this.pushHistory();
              this.render();
            }
          );
          this.layer.add(
            startCircle
          );
          this.layer.add(
            endCircle
          );
          this.endpointShape =
            endCircle;
        }
      }
      if (
        e.label &&
        String(e.kind) !== 'text'
      ) {
        this.layer.add(
          new Konva.Text({
            x:
              e.x,
            y:
              e.y,
            text:
              e.label,
            fill:
              '#111111',
            fontSize:
              18
          })
        );
      }
    }
    for (
      const t of this.tables
    ) {
      this.renderTable(t);
    }
    for (
      const r of this.reserved
    ) {
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
  private tableColor(
    t: ClubTable,
    hasProducts: boolean,
    normalColor = '#111111'
  ): string {
    if (!hasProducts) {
      return normalColor;
    }
    return t.attended ? '#4c8b62' : '#9f2f3a';
  }
  private renderTable(
    t: ClubTable
  ) {
    const active =
      this.selectedTable?.id ===
      t.id;
    const hasProducts =
      this.mode === 'operativo' &&
      (this.orderCountMap.get(t.id) ?? 0) > 0;
    const common = {
      rotation:
        t.rotation,
      draggable:
        this.mode === 'editor' &&
        this.tool === 'select',
      name:
        t.id,
      fill:
        this.mode !== 'operativo'
          ? '#111111'
          : this.tableColor(t, hasProducts),
      stroke:
        active
          ? '#704936'
          : '#000000',
      strokeWidth:
        active
          ? 4
          : 3
    };
    const shape:
      Konva.Shape =
      t.shape === 'circle'
        ?
        new Konva.Circle({
          ...common,
          x:
            t.x +
            t.width / 2,
          y:
            t.y +
            t.height / 2,
          radius:
            Math.min(
              t.width,
              t.height
            ) / 2
        })
        :
        new Konva.Rect({
          ...common,
          x:
            t.x,
          y:
            t.y,
          width:
            t.width,
          height:
            t.height,
          cornerRadius:
            10
        });
    shape.on(
      'click tap',
      (event) => {
        event.cancelBubble =
          true;
        this.selectTable(t);
      }
    );
    shape.on(
      'dragend',
      () => {
        if (
          this.mode !==
          'editor'
        ) {
          return;
        }
        if (
          t.shape === 'circle'
        ) {
          t.x =
            shape.x() -
            t.width / 2;
          t.y =
            shape.y() -
            t.height / 2;
        }
        else {
          t.x =
            shape.x();
          t.y =
            shape.y();
        }
        t.updated_at =
          new Date()
            .toISOString();
        this.selectedElementId =
          null;
        this.selectedReserved =
          null;
        this.pushHistory();
        this.render();
      }
    );
    this.layer.add(
      shape
    );
    const numberText =
      new Konva.Text({
        x:
          t.x,
        y:
          t.y,
        text:
          `${t.number}`,
        fill:
          '#ffffff',
        fontSize:
          18,
        fontStyle:
          'bold',
        width:
          t.width,
        height:
          t.height,
        align:
          'center',
        verticalAlign:
          'middle',
        listening:
          false
      });
    shape.on(
      'dragmove',
      () => {
        if (
          t.shape === 'circle'
        ) {
          numberText.position({
            x:
              shape.x() -
              t.width / 2,
            y:
              shape.y() -
              t.height / 2
          });
        }
        else {
          numberText.position({
            x:
              shape.x(),
            y:
              shape.y()
          });
        }
        this.layer.batchDraw();
      }
    );
    this.layer.add(
      numberText
    );
  }
  private renderReserved(
    r: ClubTable
  ) {
    const active =
      this.selectedReserved?.id ===
      r.id;
    const hasProducts =
      this.mode === 'operativo' &&
      (this.orderCountMap.get(r.id) ?? 0) > 0;
    const shape =
      new Konva.Rect({
        x:
          r.x,
        y:
          r.y,
        width:
          r.width,
        height:
          r.height,
        rotation:
          r.rotation,
        cornerRadius:
          14,
        fill:
          this.mode !== 'operativo'
            ? '#704936'
            : this.tableColor(r, hasProducts, '#704936'),
        stroke:
          active
            ? '#3d2417'
            : '#704936',
        strokeWidth:
          active
            ? 5
            : 3,
        draggable:
          this.mode === 'editor' &&
          this.tool === 'select',
        name:
          r.id,
        shadowColor:
          'rgba(0,0,0,.15)',
        shadowBlur:
          active
            ? 8
            : 3,
        shadowOffset:
          {
            x: 0,
            y: 2
          }
      });
    shape.on(
      'click tap',
      (event) => {
        event.cancelBubble =
          true;
        this.selectReserved(r);
      }
    );
    shape.on(
      'dragend',
      () => {
        if (
          this.mode !==
          'editor'
        ) {
          return;
        }
        r.x =
          shape.x();
        r.y =
          shape.y();
        r.updated_at =
          new Date()
            .toISOString();
        this.selectedElementId =
          null;
        this.selectedTable =
          null;
        this.pushHistory();
        this.render();
      }
    );
    this.layer.add(
      shape
    );
    const reservedText =
      new Konva.Text({
        x:
          r.x,
        y:
          r.y,
        text:
          `RESERVADO\n${r.number}`,
        fill:
          '#ffffff',
        fontSize:
          16,
        fontStyle:
          'bold',
        width:
          r.width,
        height:
          r.height,
        align:
          'center',
        verticalAlign:
          'middle',
        listening:
          false,
        lineHeight:
          1.15
      });
    shape.on(
      'dragmove',
      () => {
        reservedText.position({
          x:
            shape.x(),
          y:
            shape.y()
        });
        this.layer.batchDraw();
      }
    );
    this.layer.add(
      reservedText
    );
  }
  private selectTable(t: ClubTable) {
    if (this.mode === 'operativo' && this.selectedTable?.id === t.id) {
      void this.openOrderDialog(t);
      return;
    }
    this.selectedTable = t;
    this.selectedReserved = null;
    this.selectedElementId = null;
    this.activeEndpoint = null;
    if (this.mode === 'operativo') void this.loadOrdersForTarget(t);
    this.render();
  }
  private selectReserved(r: ClubTable) {
    if (this.mode === 'operativo' && this.selectedReserved?.id === r.id) {
      void this.openOrderDialog(r);
      return;
    }
    this.selectedReserved = r;
    this.selectedTable = null;
    this.selectedElementId = null;
    this.activeEndpoint = null;
    if (this.mode === 'operativo') void this.loadOrdersForTarget(r);
    this.render();
  }
  private async openOrderDialog(
    target: ClubTable
  ) {
    if (
      this.mode !==
      'operativo'
    ) {
      return;
    }
    this.selectedOrderTarget =
      target;
    if (
      target.type ===
      'RESERVED'
    ) {
      this.selectedReserved =
        target;
      this.selectedTable =
        null;
    }
    else {
      this.selectedTable =
        target;
      this.selectedReserved =
        null;
    }
    this.selectedElementId =
      null;
    this.selectedProductId =
      '';
    this.quantity =
      1;
    await this.loadOrdersForTarget(
      target
    );
    this.showOrderDialog =
      true;
    this.render();
  }
  closeOrderDialog() {
    this.showOrderDialog =
      false;
    this.selectedOrderTarget =
      null;
    this.selectedProductId =
      '';
    this.quantity =
      1;
  }
  async markAttended(attended: boolean) {
    const target = this.selectedOrderTarget;
    if (!target) return;
    if (attended && this.orderItems.length === 0) {
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
  private async loadOrdersForTarget(
    target?: ClubTable
  ) {
    const orderTarget =
      target ??
      this.selectedOrderTarget ??
      this.selectedTable ??
      this.selectedReserved;
    if (!orderTarget) {
      this.orderItems = [];
      this.selectedPending = 0;
      return;
    }
    try {
      const result =
        await this.orders.forTable(
          orderTarget.id
        );
      this.orderItems =
        result.items;
      this.selectedPending =
        this.orderItems
          .filter(
            i =>
              i.status ===
              'PENDING'
          )
          .reduce(
            (n, i) =>
              n +
              i.quantity,
            0
          );
      this.pendingChanged.emit(
        this.selectedPending
      );
    }
    catch (error) {
      console.error(
        'Error cargando pedido:',
        error
      );
      this.orderItems = [];
      this.selectedPending = 0;
    }
  }
  deleteSelected() {
    if (
      this.selectedElementId
    ) {
      const id =
        this.selectedElementId;
      this.elements =
        this.elements.filter(
          e =>
            e.id !== id
        );
      this.selectedElementId =
        null;
      this.activeEndpoint =
        null;
      this.pushHistory();
      this.render();
      return;
    }
    if (
      this.selectedTable
    ) {
      const tableId =
        this.selectedTable.id;
      this.tables =
        this.tables.filter(
          t =>
            t.id !== tableId
        );
      this.selectedTable =
        null;
      this.pushHistory();
      this.render();
      return;
    }
    if (
      this.selectedReserved
    ) {
      const reservedId =
        this.selectedReserved.id;
      this.reserved =
        this.reserved.filter(
          r =>
            r.id !== reservedId
        );
      this.selectedReserved =
        null;
      this.pushHistory();
      this.render();
    }
  }
  private pendingForTable(
    tableId: string
  ): number {
    return (
      this.pendingMap.get(
        tableId
      ) ?? 0
    );
  }
  private async refreshPendingMap() {
    try {
      const {
        data,
        error
      } =
        await this.orders.db.client
          .from('orders')
          .select(
            'id,table_id,order_items(quantity,status)'
          )
          .eq(
            'status',
            'OPEN'
          );
      if (error) {
        throw error;
      }
      const map =
        new Map<string, number>();
      const countMap =
        new Map<string, number>();
      for (const o of (data as any[])) {
        const items = (o.order_items ?? [])
          .filter((i: any) => i.status !== 'CANCELLED');
        const total = items.reduce(
          (a: number, i: any) => a + Number(i.quantity || 0), 0
        );
        const pending = items
          .filter((i: any) => i.status === 'PENDING')
          .reduce(
            (a: number, i: any) => a + Number(i.quantity || 0),
            0
          );
        if (total) countMap.set(o.table_id, total);
        if (pending) map.set(o.table_id, pending);
      }
      this.pendingMap = map;
      this.orderCountMap = countMap;
      this.pendingChanged.emit(
        [...map.values()]
          .reduce(
            (a, b) =>
              a + b,
            0
          )
      );
      this.render();
    }
    catch {
      // Silenciado a propósito: si falla el refresco de pendientes,
      // el listener de realtime volverá a intentarlo en el próximo evento.
    }
  }
  ngOnDestroy() {
    if (
      this.realtimeChannel
    ) {
      this.realtimeChannel.unsubscribe();
    }
    if (
      this.stage
    ) {
      this.stage.destroy();
    }
  }
  setTool(
    tool: EditorTool
  ) {
    this.tool =
      tool;
    this.panMode =
      tool === 'pan';
    this.activeEndpoint =
      null;
    if (this.stage) {
      this.stage.draggable(
        this.panMode
      );
    }
    if (
      tool !== 'select'
    ) {
      this.selectedElementId =
        null;
      this.selectedTable =
        null;
      this.selectedReserved =
        null;
    }
    if (
      tool !== 'draw'
    ) {
      this.clearDrawing();
    }
    this.render();
  }
  pointerDown(
    ev: PointerEvent
  ) {
    if (
      this.mode ===
        'editor' &&
      this.tool ===
        'text'
    ) {
      const point =
        this.getCanvasPoint(
          ev
        );
      if (!point) {
        return;
      }
      this.textPosition =
        point;
      this.newText =
        '';
      this.showTextDialog =
        true;
      return;
    }
    if (
      this.mode !==
        'editor' ||
      this.tool !==
        'draw'
    ) {
      return;
    }
    const p =
      this.getCanvasPoint(
        ev
      );
    if (!p) {
      return;
    }
    this.drawingPointerId =
      ev.pointerId;
    this.startDrawingAt(
      p
    );
  }
  pointerMove(
    ev: PointerEvent
  ) {
    if (
      this.drawingPointerId !==
        ev.pointerId ||
      !this.drawingShape
    ) {
      return;
    }
    const p =
      this.getCanvasPoint(
        ev
      );
    if (!p) {
      return;
    }
    const last =
      this.drawing[
        this.drawing.length - 1
      ];
    if (
      last &&
      Math.hypot(
        p.x - last.x,
        p.y - last.y
      ) < 4
    ) {
      return;
    }
    this.drawing.push({
      x:
        p.x,
      y:
        p.y
    });
    this.drawingShape.points(
      this.drawing.flatMap(
        point => [
          point.x,
          point.y
        ]
      )
    );
    this.draftLayer.batchDraw();
  }
  pointerUp(
    ev: PointerEvent
  ) {
    if (
      this.drawingPointerId !==
      ev.pointerId
    ) {
      return;
    }
    this.drawingPointerId =
      null;
    if (
      !this.drawingShape ||
      this.drawing.length < 2
    ) {
      this.clearDrawing();
      return;
    }
    const segments =
      this.geometry.toSegments(
        this.drawing
      );
    const now =
      new Date()
        .toISOString();
    const newElements:
      FloorPlanElement[] =
      segments.map(
        s => ({
          id:
            crypto.randomUUID(),
          floor_plan_id:
            this.plan.id,
          kind:
            'wall',
          x:
            s.x,
          y:
            s.y,
          width:
            s.width,
          height:
            s.height,
          rotation:
            s.rotation,
          points:
            s.points,
          label:
            null,
          z_index:
            this.elements.length,
          created_at:
            now,
          updated_at:
            now
        })
      );
    this.elements = [
      ...this.elements,
      ...newElements
    ];
    this.clearDrawing();
    this.pushHistory();
    this.render();
  }
  private startDrawingAt(
    point: Point
  ) {
    this.drawing = [
      point
    ];
    this.drawingShape =
      new Konva.Line({
        points: [
          point.x,
          point.y
        ],
        stroke:
          '#111111',
        strokeWidth:
          6,
        dash: [
          10,
          8
        ],
        lineCap:
          'round',
        lineJoin:
          'round'
      });
    this.draftLayer.add(
      this.drawingShape
    );
    this.draftLayer.draw();
  }
  clearDrawing() {
    this.drawing = [];
    this.drawingShape =
      null;
    this.drawingPointerId =
      null;
    if (
      this.draftLayer
    ) {
      this.draftLayer.destroyChildren();
      this.draftLayer.draw();
    }
  }
  closeTextDialog() {
    this.showTextDialog =
      false;
    this.newText =
      '';
    this.textPosition =
      null;
  }
  confirmAddText() {
    const text =
      this.newText.trim();
    if (
      !text ||
      !this.textPosition
    ) {
      return;
    }
    const now =
      new Date()
        .toISOString();
    const textElement =
      {
        id:
          crypto.randomUUID(),
        floor_plan_id:
          this.plan.id,
        kind:
          'text',
        x:
          this.textPosition.x,
        y:
          this.textPosition.y,
        width:
          0,
        height:
          0,
        rotation:
          0,
        points:
          null,
        label:
          text,
        z_index:
          this.elements.length,
        created_at:
          now,
        updated_at:
          now
      } as unknown as FloorPlanElement;
    this.elements = [
      ...this.elements,
      textElement
    ];
    this.selectedElementId =
      textElement.id;
    this.selectedTable =
      null;
    this.selectedReserved =
      null;
    this.pushHistory();
    this.render();
    this.closeTextDialog();
    this.setTool(
      'select'
    );
  }
  private convertDrawing() {
    if (
      this.drawing.length <
      2
    ) {
      return;
    }
    const segments =
      this.geometry.toSegments(
        this.drawing
      );
    const now =
      new Date()
        .toISOString();
    const newElements:
      FloorPlanElement[] =
      segments.map(
        s => ({
          id:
            crypto.randomUUID(),
          floor_plan_id:
            this.plan.id,
          kind:
            'wall',
          x:
            s.x,
          y:
            s.y,
          width:
            s.width,
          height:
            s.height,
          rotation:
            s.rotation,
          points:
            s.points,
          label:
            null,
          z_index:
            this.elements.length,
          created_at:
            now,
          updated_at:
            now
        })
      );
    this.elements = [
      ...this.elements,
      ...newElements
    ];
    this.clearDrawing();
    this.pushHistory();
    this.render();
    this.setTool(
      'select'
    );
  }
  async saveDesign() {
    try {
      if (
        this.drawing.length >=
        2
      ) {
        this.convertDrawing();
      }
      await this.floors.saveSnapshot(
        this.plan.id,
        {
          elements:
            this.elements,
          tables:
            this.tables,
          reserved:
            this.reserved
        } as any
      );
      this.showSaveDialog =
        true;
    }
    catch (e) {
      console.error(
        'Error guardando diseño:',
        e
      );
    }
  }
  closeSaveDialog() {
    this.showSaveDialog =
      false;
  }
  addTable() {
    const numbers =
      new Set(
        this.tables
          .map(
            t =>
              t.number
          )
      );
    let n =
      1;
    while (
      numbers.has(n)
    ) {
      n++;
    }
    const now =
      new Date()
        .toISOString();
    const table:
      ClubTable = {
        id:
          crypto.randomUUID(),
        floor_plan_id:
          this.plan.id,
        number:
          n,
        type:
          'TABLE',
        x:
          300 +
          this.tables.length *
          20,
        y:
          300 +
          this.tables.length *
          20,
        width:
          100,
        height:
          80,
        rotation:
          0,
        shape:
          'circle',
        created_at:
          now,
        updated_at:
          now,
        attended: false,
      };
    this.tables = [
      ...this.tables,
      table
    ];
    this.selectedTable =
      table;
    this.selectedReserved =
      null;
    this.selectedElementId =
      null;
    this.pushHistory();
    this.render();
  }
  addReserved() {
    const numbers =
      new Set(
        this.reserved
          .map(
            r =>
              r.number
          )
      );
    let n =
      1;
    while (
      numbers.has(n)
    ) {
      n++;
    }
    const now =
      new Date()
        .toISOString();
    const reserved:
      ClubTable = {
        id:
          crypto.randomUUID(),
        floor_plan_id:
          this.plan.id,
        type:
          'RESERVED',
      attended: false,
        number:
          n,
        x:
          300 +
          this.reserved.length *
          20,
        y:
          450 +
          this.reserved.length *
          20,
        width:
          140,
        height:
          80,
        rotation:
          0,
        shape:
          'rectangle',
        created_at:
          now,
        updated_at:
          now
      };
    this.reserved = [
      ...this.reserved,
      reserved
    ];
    this.selectedReserved =
      reserved;
    this.selectedTable =
      null;
    this.selectedElementId =
      null;
    this.pushHistory();
    this.render();
  }
  togglePan() {
    this.setTool(
      this.tool ===
        'pan'
        ? 'select'
        : 'pan'
    );
  }
  zoom(
    delta: number
  ) {
    if (
      !this.stage
    ) {
      return;
    }
    const old =
      this.stage.scaleX();
    const next =
      Math.min(
        2.5,
        Math.max(
          0.35,
          old +
          delta
        )
      );
    this.stage.scale({
      x:
        next,
      y:
        next
    });
    this.render();
  }
  private zoomAtPointer(
    event: WheelEvent,
    delta: number
  ) {
    if (
      !this.stage
    ) {
      return;
    }
    const oldScale =
      this.stage.scaleX();
    const pointer =
      this.stage.getPointerPosition();
    if (!pointer) {
      this.zoom(delta);
      return;
    }
    const newScale =
      Math.min(
        2.5,
        Math.max(
          0.35,
          oldScale +
          delta
        )
      );
    const mousePointTo =
      {
        x:
          (
            pointer.x -
            this.stage.x()
          ) /
          oldScale,
        y:
          (
            pointer.y -
            this.stage.y()
          ) /
          oldScale
      };
    this.stage.scale({
      x:
        newScale,
      y:
        newScale
    });
    this.stage.position({
      x:
        pointer.x -
        mousePointTo.x *
        newScale,
      y:
        pointer.y -
        mousePointTo.y *
        newScale
    });
    this.render();
  }
  pushHistory() {
    const snapshot:
      FloorSnapshot =
      {
        elements:
          structuredClone(
            this.elements
          ),
        tables:
          structuredClone(
            this.tables
          ),
        reserved:
          structuredClone(
            this.reserved
          )
      } as any;
    this.history =
      this.history.slice(
        0,
        this.historyIndex +
        1
      );
    this.history.push(
      snapshot
    );
    if (
      this.history.length >
      30
    ) {
      this.history.shift();
    }
    this.historyIndex =
      this.history.length -
      1;
  }
  restore(
    s: FloorSnapshot
  ) {
    this.elements =
      structuredClone(
        s.elements
      );
    this.tables =
      structuredClone(
        s.tables
      );
    this.reserved =
      structuredClone(
        (s as any).reserved ?? []
      );
    const legacyReserved =
      this.tables.filter(
        t =>
          t.type === 'RESERVED'
      );
    if (
      legacyReserved.length
    ) {
      this.tables =
        this.tables.filter(
          t =>
            t.type !== 'RESERVED'
        );
      for (
        const legacy of legacyReserved
      ) {
        if (
          !this.reserved.some(
            r =>
              r.id === legacy.id
          )
        ) {
          this.reserved.push(
            legacy
          );
        }
      }
    }
    this.selectedElementId =
      null;
    this.selectedTable =
      null;
    this.selectedReserved =
      null;
    this.selectedOrderTarget =
      null;
    this.showOrderDialog =
      false;
    this.activeEndpoint =
      null;
    this.render();
  }
  undo() {
    if (
      this.historyIndex <=
      0
    ) {
      return;
    }
    this.historyIndex--;
    this.restore(
      this.history[
        this.historyIndex
      ]
    );
  }
  redo() {
    if (
      this.historyIndex >=
      this.history.length -
      1
    ) {
      return;
    }
    this.historyIndex++;
    this.restore(
      this.history[
        this.historyIndex
      ]
    );
  }
  async addOrderItem() {
    const added = await this.addProductToOrder(this.selectedProductId, this.quantity);
    if (added) {
      this.quantity = 1;
      this.selectedProductId = '';
    }
  }
  async addAlcoholItem() {
    const added = await this.addProductToOrder(this.selectedAlcoholProductId, this.alcoholQuantity);
    if (added) {
      this.alcoholQuantity = 1;
      this.selectedAlcoholProductId = '';
    }
  }
  async addSoftDrinkItem() {
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
  private async addProductToOrder(
    productId: string,
    quantity: number
  ): Promise<boolean> {
    const target =
      this.selectedOrderTarget ??
      this.selectedTable ??
      this.selectedReserved;
    if (
      !target ||
      !productId ||
      quantity < 1
    ) {
      return false;
    }
    const session =
      this.auth.session();
    if (!session) {
      console.error(
        'No hay una sesión activa.'
      );
      return false;
    }
    try {
      await this.orders.addItem(target.id, productId, Math.floor(quantity), session.user.id);
      await this.loadOrdersForTarget(
        target
      );
      await this.refreshPendingMap();
      this.render();
      return true;
    }
    catch (error) {
      console.error(
        'Error añadiendo producto:',
        error
      );
      return false;
    }
  }
  async changeItemQuantity(item: any, delta: number) {
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
        updated_at: new Date().toISOString()
      };
      if (item.status === 'PLACED') {
        patch.status = 'PENDING';
        patch.placed_by = null;
        patch.placed_at = null;
      }
      const { error } = await this.orders.db.client
        .from('order_items')
        .update(patch)
        .eq('id', item.id);
      if (error) throw error;
      await this.loadOrdersForTarget();
      await this.refreshPendingMap();
    } catch (error) {
      console.error('Error modificando producto:', error);
    }
  }

  async removeOrderItem(item: any) {
    const session = this.auth.session();
    if (!session) return;
    try {
      const { error } = await this.orders.db.client
        .from('order_items')
        .update({
          status: 'CANCELLED',
          updated_at: new Date().toISOString()
        })
        .eq('id', item.id);
      if (error) throw error;
      await this.loadOrdersForTarget();
      await this.refreshPendingMap();
    } catch (error) {
      console.error('Error eliminando producto:', error);
    }
  }

  async markPlaced(
    id: string
  ) {
    const session =
      this.auth.session();
    if (!session) {
      console.error(
        'No hay una sesión activa.'
      );
      return;
    }
    try {
      await this.orders.markPlaced(
        id,
        session.user.id
      );
      const target =
        this.selectedOrderTarget ??
        this.selectedTable ??
        this.selectedReserved;
      if (target) {
        await this.loadOrdersForTarget(
          target
        );
      }
      await this.refreshPendingMap();
    }
    catch (error) {
      console.error(
        'Error marcando producto como puesto:',
        error
      );
    }
  }
  private getStagePointerPoint(
    event: Event
  ): Point | null {
    if (!this.stage) {
      return null;
    }
    this.stage.setPointersPositions(
      event
    );
    const pointer =
      this.stage.getPointerPosition();
    if (!pointer) {
      return null;
    }
    const transform =
      this.stage
        .getAbsoluteTransform()
        .copy();
    transform.invert();
    return transform.point(
      pointer
    );
  }
  private getCanvasPoint(
    ev: PointerEvent
  ): Point | null {
    return this.getStagePointerPoint(
      ev
    );
  }
}