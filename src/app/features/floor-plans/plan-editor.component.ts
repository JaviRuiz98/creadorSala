import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  IonButton,
  IonButtons,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonSelect,
  IonSelectOption
} from '@ionic/angular/standalone';

import Konva from 'konva';

import { FloorPlanService } from '../../core/services/floor-plan.service';

import {
  GeometryService,
  Point
} from '../../core/services/geometry.service';

import { AuthService } from '../../core/auth/auth.service';
import { OrderService } from '../../core/services/order.service';
import { ProductService } from '../../core/services/product.service';

import type {
  ClubTable,
  FloorPlan,
  FloorPlanElement,
  FloorSnapshot,
  Product
} from '../../core/models/models';


type EditorTool =
  | 'select'
  | 'draw'
  | 'pan'
  | 'text';


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


      <!-- =====================================================
           TOOLBAR
           ===================================================== -->

      <div class="editor-toolbar">

        @if (mode === 'editor') {

          <div class="tool-group">

            <ion-button
              class="editor-button"
              size="small"
              [class.active]="tool === 'select'"
              (click)="setTool('select')">

              ↖ Seleccionar

            </ion-button>


            <ion-button
              class="editor-button"
              size="small"
              [class.active]="tool === 'draw'"
              (click)="setTool('draw')">

              ✏️ Dibujar

            </ion-button>


            <ion-button
              class="editor-button"
              size="small"
              [class.active]="tool === 'text'"
              (click)="setTool('text')">

              T Texto

            </ion-button>


            <ion-button
              class="editor-button"
              size="small"
              [class.active]="tool === 'pan'"
              (click)="setTool('pan')">

              ✋ Pan

            </ion-button>

          </div>


          <!-- ACCIONES -->

          <div class="tool-group">

            <ion-button
              class="editor-button primary"
              size="small"
              (click)="saveDesign()">

              💾 Guardar diseño

            </ion-button>


            <ion-button
              class="editor-button danger"
              size="small"
              (click)="deleteSelected()"
              [disabled]="
                !selectedElementId &&
                !selectedTable
              ">

              🧹 Borrar

            </ion-button>


            <ion-button
              class="editor-button"
              size="small"
              (click)="clearDrawing()"
              [disabled]="drawing.length === 0">

              Borrar dibujo

            </ion-button>


            <ion-button
              class="editor-button"
              size="small"
              (click)="addTable()">

              + Mesa

            </ion-button>


            <ion-button
              class="editor-button icon-button"
              size="small"
              (click)="undo()"
              [disabled]="historyIndex < 1">

              ↶

            </ion-button>


            <ion-button
              class="editor-button icon-button"
              size="small"
              (click)="redo()"
              [disabled]="
                historyIndex >=
                history.length - 1
              ">

              ↷

            </ion-button>


            <ion-button
              class="editor-button icon-button"
              size="small"
              (click)="zoom(-0.1)">

              −

            </ion-button>


            <ion-button
              class="editor-button icon-button"
              size="small"
              (click)="zoom(0.1)">

              +

            </ion-button>

          </div>


          <!-- ESTADO -->

          <span class="tool-status">

            Herramienta:

            <strong>
              {{ toolLabel }}
            </strong>


            @if (selectedElementId) {

              <span class="selected-status">

                · Elemento seleccionado

              </span>

            }


            @if (selectedTable) {

              <span class="selected-status">

                · Mesa {{ selectedTable.number }}

              </span>

            }

          </span>

        }

        @else {

          <div class="tool-group">

            <ion-button
              class="editor-button"
              size="small"
              [class.active]="tool === 'select'"
              (click)="setTool('select')">

              ↖ Seleccionar

            </ion-button>


            <ion-button
              class="editor-button"
              size="small"
              [class.active]="tool === 'pan'"
              (click)="setTool('pan')">

              ✋ Pan

            </ion-button>


            <ion-button
              class="editor-button icon-button"
              size="small"
              (click)="zoom(-0.1)">

              −

            </ion-button>


            <ion-button
              class="editor-button icon-button"
              size="small"
              (click)="zoom(0.1)">

              +

            </ion-button>

          </div>

        }

      </div>



      <!-- =====================================================
           CANVAS
           ===================================================== -->

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



      <!-- =====================================================
           PEDIDOS
           ===================================================== -->

      @if (
        mode === 'operativo' &&
        selectedTable
      ) {

        <aside class="orders-panel">

          <div class="orders-head">

            <strong>
              Mesa {{ selectedTable.number }}
            </strong>

            <span>
              {{ selectedPending }} pendientes
            </span>

          </div>


          <ion-list>

            @for (
              item of orderItems;
              track item.id
            ) {

              <ion-item>

                <ion-label>

                  <h3>
                    {{ item.product.name }}
                    ×
                    {{ item.quantity }}
                  </h3>

                  <p>

                    {{
                      item.status === 'PENDING'
                        ? '🔴 Pendiente'
                        : '🟢 Puesto'
                    }}

                  </p>

                </ion-label>


                @if (
                  item.status === 'PENDING'
                ) {

                  <ion-button
                    class="editor-button"
                    slot="end"
                    size="small"
                    (click)="markPlaced(item.id)">

                    Puesta

                  </ion-button>

                }

              </ion-item>

            }

          </ion-list>


          <div class="add-order">

            <ion-select
              label="Producto"
              labelPlacement="stacked"
              [(ngModel)]="selectedProductId">

              @for (
                p of products;
                track p.id
              ) {

                <ion-select-option
                  [value]="p.id">

                  {{ p.name }}

                </ion-select-option>

              }

            </ion-select>


            <ion-input
              label="Cantidad"
              type="number"
              labelPlacement="stacked"
              [(ngModel)]="quantity">
            </ion-input>


            <ion-button
              class="editor-button primary full"
              expand="block"
              (click)="addOrderItem()">

              Añadir

            </ion-button>

          </div>

        </aside>

      }



      <!-- =====================================================
           DIALOGO TEXTO
           ===================================================== -->

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


              <h2>
                Añadir texto
              </h2>


              <p>
                Introduce el texto que quieres
                colocar en el plano.
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



      <!-- =====================================================
           DIALOGO GUARDADO
           ===================================================== -->

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


              <h2>
                Diseño guardado
              </h2>


              <p>
                El diseño del plano se ha guardado
                correctamente.
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

    /* =========================================================
       EDITOR
       ========================================================= */

    .editor-shell {

      position: relative;

      display: flex;

      min-height: 65vh;

      overflow: hidden;

      background: #f4eee9;

      border-radius: 18px;

      border: 1px solid #e3d5ca;

      box-shadow:
        0 12px 35px
        rgba(70, 43, 29, .08);

    }


    /* =========================================================
       TOOLBAR
       ========================================================= */

    .editor-toolbar {

      position: absolute;

      z-index: 20;

      top: 12px;

      left: 12px;

      right: 12px;

      display: flex;

      gap: 8px;

      flex-wrap: wrap;

      align-items: center;

      pointer-events: none;

    }


    .editor-toolbar > * {

      pointer-events: auto;

    }


    .tool-group {

      display: flex;

      gap: 5px;

      flex-wrap: wrap;

      padding: 5px;

      background:
        rgba(255, 252, 249, .96);

      border: 1px solid #e2d5cc;

      border-radius: 12px;

      box-shadow:
        0 5px 18px
        rgba(70, 43, 29, .10);

      backdrop-filter: blur(8px);

    }


    /* =========================================================
       BOTONES
       ========================================================= */

    .editor-button {

      --background: #fffaf6;

      --background-hover: #f4e7de;

      --background-activated: #ead8ca;

      --color: #5b3928;

      --border-color: #d8c4b6;

      --border-style: solid;

      --border-width: 1px;

      --border-radius: 9px;

      --box-shadow: none;

      font-weight: 700;

      font-size: 12px;

      margin: 0;

    }


    .editor-button:hover {

      --background: #f4e7de;

    }


    .editor-button.active {

      --background: #704936;

      --color: #ffffff;

      --border-color: #704936;

    }


    .editor-button.primary {

      --background: #6b4430;

      --color: #ffffff;

      --border-color: #6b4430;

    }


    .editor-button.primary:hover {

      --background: #593624;

    }


    .editor-button.danger {

      --color: #8c3f3f;

      --border-color: #d9b7b0;

    }


    .editor-button.danger:hover {

      --background: #f8e8e5;

      --color: #783333;

    }


    .editor-button.full {

      width: 100%;

    }


    .editor-button.icon-button {

      min-width: 38px;

    }


    .editor-button:disabled {

      opacity: .45;

    }


    /* =========================================================
       STATUS
       ========================================================= */

    .tool-status {

      background:
        rgba(255, 252, 249, .96);

      padding: 9px 12px;

      border-radius: 10px;

      border: 1px solid #e2d5cc;

      color: #725e52;

      font-size: 12px;

      box-shadow:
        0 5px 18px
        rgba(70, 43, 29, .08);

    }


    .tool-status strong {

      color: #4f3021;

    }


    .selected-status {

      color: #8b5a3c;

      font-weight: 700;

    }


    /* =========================================================
       CANVAS
       ========================================================= */

    .canvas-area {

      flex: 1;

      min-height: 65vh;

      touch-action: none;

      cursor: default;

      background: #ffffff;

      background-image:
        linear-gradient(
          #f1eeeb 1px,
          transparent 1px
        ),
        linear-gradient(
          90deg,
          #f1eeeb 1px,
          transparent 1px
        );

      background-size: 25px 25px;

    }


    .canvas-area.draw-mode {

      cursor: crosshair;

    }


    .canvas-area.text-mode {

      cursor: text;

    }


    /* =========================================================
       PEDIDOS
       ========================================================= */

    .orders-panel {

      width: 340px;

      max-width: 38vw;

      background: #fffaf7;

      overflow: auto;

      border-left: 1px solid #dfd1c8;

      padding-top: 68px;

    }


    .orders-head {

      padding: 14px;

      display: flex;

      justify-content: space-between;

      color: #4e3326;

      border-bottom: 1px solid #eadfd8;

    }


    .add-order {

      padding: 14px;

      display: grid;

      gap: 8px;

    }


    /* =========================================================
       DIALOGOS
       ========================================================= */

    .dialog-backdrop {

      position: absolute;

      inset: 0;

      z-index: 100;

      display: flex;

      align-items: center;

      justify-content: center;

      padding: 20px;

      background:
        rgba(45, 30, 22, .38);

      backdrop-filter: blur(4px);

    }


    .save-dialog,
    .text-dialog {

      width:
        min(
          380px,
          calc(100vw - 40px)
        );

      background: #fffaf7;

      border: 1px solid #e2d5cc;

      border-radius: 20px;

      overflow: hidden;

      box-shadow:
        0 25px 70px
        rgba(45, 30, 22, .25);

      animation:
        dialogIn .18s ease-out;

    }


    .text-dialog {

      width:
        min(
          420px,
          calc(100vw - 40px)
        );

    }


    .dialog-icon {

      width: 54px;

      height: 54px;

      margin: 28px auto 0;

      display: grid;

      place-items: center;

      border-radius: 50%;

      background: #e9f3ec;

      color: #4c8b62;

      font-size: 25px;

      font-weight: 900;

    }


    .dialog-icon.text-icon {

      background: #f1e5dc;

      color: #6b4430;

    }


    .dialog-content {

      padding:
        18px 28px 26px;

      text-align: center;

    }


    .dialog-eyebrow {

      display: block;

      margin-bottom: 7px;

      color: #9a6749;

      font-size: 10px;

      font-weight: 900;

      letter-spacing: .14em;

    }


    .dialog-content h2 {

      margin:
        0 0 8px;

      color: #2d211b;

      font-size: 23px;

    }


    .dialog-content p {

      margin:
        0 0 22px;

      color: #81736b;

      font-size: 14px;

      line-height: 1.5;

    }


    /* =========================================================
       INPUT TEXTO
       ========================================================= */

    .text-input {

      display: block;

      margin-bottom: 20px;

      text-align: left;

      --background: #ffffff;

      --border-color: #d8c4b6;

      --border-radius: 10px;

      --color: #3d2a20;

      --padding-start: 12px;

      --padding-end: 12px;

      --highlight-color-focused: #6b4430;

    }


    /* =========================================================
       DIALOG ACTIONS
       ========================================================= */

    .dialog-actions {

      display: flex;

      gap: 8px;

      justify-content: flex-end;

    }


    .dialog-button {

      --background: #6b4430;

      --background-hover: #593624;

      --color: #fff;

      --border-radius: 10px;

      font-weight: 700;

      margin: 0;

      flex: 1;

    }


    .dialog-secondary {

      --background: #f4e7de;

      --background-hover: #ead8ca;

      --color: #5b3928;

      --border-radius: 10px;

      font-weight: 700;

      margin: 0;

    }


    @keyframes dialogIn {

      from {

        opacity: 0;

        transform:
          translateY(8px)
          scale(.98);

      }

      to {

        opacity: 1;

        transform:
          translateY(0)
          scale(1);

      }

    }


    /* =========================================================
       MOBILE
       ========================================================= */

    @media (max-width: 800px) {

      .editor-shell {

        min-height: 70vh;

      }


      .orders-panel {

        position: absolute;

        right: 0;

        top: 0;

        bottom: 0;

        width:
          min(
            380px,
            92vw
          );

        max-width: none;

        z-index: 30;

        box-shadow:
          -8px 0 24px
          rgba(45, 30, 22, .18);

      }


      .tool-status {

        display: none;

      }


      .editor-toolbar {

        top: 8px;

        left: 8px;

        right: 8px;

      }


      .dialog-actions {

        flex-direction: column;

      }


      .dialog-secondary,
      .dialog-button {

        width: 100%;

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


  /* =========================================================
     KONVA
     ========================================================= */

  private stage!: Konva.Stage;

  private layer!: Konva.Layer;

  private draftLayer!: Konva.Layer;


  /* =========================================================
     DRAWING
     ========================================================= */

  private drawingShape:
    Konva.Line | null = null;

  private drawingPointerId:
    number | null = null;

  drawing: Point[] = [];


  /* =========================================================
     DATA
     ========================================================= */

  elements:
    FloorPlanElement[] = [];

  tables:
    ClubTable[] = [];


  selectedTable:
    ClubTable | null = null;


  selectedElementId:
    string | null = null;


  /*
   * Extremo de línea que se está modificando.
   *
   * start = primer punto
   * end   = último punto
   */

  private activeEndpoint:
    'start' |
    'end' |
    null = null;


  private endpointShape:
    Konva.Circle | null = null;


  /* =========================================================
     HISTORY
     ========================================================= */

  history:
    FloorSnapshot[] = [];

  historyIndex =
    -1;


  /* =========================================================
     TOOL
     ========================================================= */

  tool:
    EditorTool =
    'select';


  /* =========================================================
     TEXT
     ========================================================= */

  showTextDialog =
    false;

  newText =
    '';

  private textPosition:
    Point | null = null;


  /* =========================================================
     ORDERS
     ========================================================= */

  selectedProductId =
    '';

  quantity =
    1;

  products:
    Product[] = [];

  orderItems:
    Array<any> = [];

  selectedPending =
    0;


  /* =========================================================
     REALTIME
     ========================================================= */

  private realtimeChannel:
    any;

  pendingMap =
    new Map<string, number>();


  /* =========================================================
     SAVE DIALOG
     ========================================================= */

  showSaveDialog =
    false;


  /* =========================================================
     PAN
     ========================================================= */

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


  /* =========================================================
     LABEL
     ========================================================= */

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


  /* =========================================================
     CONSTRUCTOR
     ========================================================= */

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


  /* =========================================================
     CHANGES
     ========================================================= */

  async ngOnChanges(
    changes: SimpleChanges
  ) {

    if (
      changes['plan']?.currentValue
    ) {

      await this.load();

    }

  }


  /* =========================================================
     LINE ENDPOINTS
     ========================================================= */

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


  /* =========================================================
     UPDATE LINE ENDPOINT
     ========================================================= */

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


    /*
     * Mantenemos también x/y
     * sincronizados con el primer punto.
     */

    e.x =
      e.points[0];

    e.y =
      e.points[1];


    /*
     * Actualizamos width y height
     * para mantener consistencia.
     */

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


  /* =========================================================
     LOAD
     ========================================================= */

  private async load() {

    const snap =
      await this.floors.load(
        this.plan.id
      );


    this.elements =
      snap.elements;


    this.tables =
      snap.tables;


    this.selectedTable =
      null;


    this.selectedElementId =
      null;


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


  /* =========================================================
     INIT STAGE
     ========================================================= */

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

        this.zoom(
          e.evt.deltaY < 0
            ? 0.1
            : -0.1
        );

      }
    );


    this.render();

  }


  /* =========================================================
     RENDER
     ========================================================= */

  private render() {

    if (!this.layer) {

      return;

    }


    this.layer.destroyChildren();


    /*
     * Evitamos que quede un extremo
     * antiguo activo después de renderizar.
     */

    this.activeEndpoint =
      null;

    this.endpointShape =
      null;


    /* =======================================================
       ELEMENTOS
       ======================================================= */

    for (
      const e of this.elements
    ) {

      /*
       * TEXTO
       *
       * FloorElementKind no contempla
       * necesariamente "text", por lo que
       * hacemos la comparación como string.
       */

      if (
        String(e.kind) === 'text'
      ) {

        const selected =
          this.selectedElementId === e.id;


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


      /*
       * PAREDES / OTROS ELEMENTOS
       */

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


      /* =====================================================
         SELECCIONAR LINEA
         ===================================================== */

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


          this.activeEndpoint =
            null;


          this.render();

        }
      );


      /* =====================================================
         MOVER LINEA ENTERA
         ===================================================== */

      line.on(
        'dragend',
        () => {

          /*
           * Si se estaba arrastrando un extremo,
           * este evento no debe modificar toda
           * la línea.
           */

          if (
            this.activeEndpoint
          ) {

            return;

          }


          const dx =
            line.x();


          const dy =
            line.y();


          /*
           * Si no se ha movido realmente,
           * no hacemos nada.
           */

          if (
            dx === 0 &&
            dy === 0
          ) {

            return;

          }


          /*
           * Movemos TODOS los puntos.
           */

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


          /*
           * Actualizamos las coordenadas
           * principales del elemento.
           */

          e.x +=
            dx;

          e.y +=
            dy;


          e.updated_at =
            new Date()
              .toISOString();


          /*
           * Muy importante:
           *
           * Los puntos ya contienen el
           * desplazamiento, así que
           * reiniciamos la posición de
           * Konva.
           */

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


      /* =====================================================
         EXTREMOS DE LINEA
         ===================================================== */

      if (
        selected &&
        this.mode === 'editor' &&
        this.tool === 'select'
      ) {

        const endpoints =
          this.getLineEndpoints(e);


        if (endpoints) {

          /*
           * EXTREMO INICIAL
           */

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


          /*
           * Evita que al tocar el extremo
           * se arrastre también la línea.
           */

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
                this.getKonvaAbsolutePoint(
                  startCircle
                );


              if (!point) {

                return;

              }


              this.updateLineEndpoint(
                e,
                'start',
                point
              );


              /*
               * Actualizamos visualmente
               * la línea sin reconstruir
               * todo el canvas.
               */

              line.points(
                e.points ?? []
              );


              /*
               * Movemos el extremo final
               * independientemente.
               */

              startCircle.position({

                x: point.x,

                y: point.y

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
                this.getKonvaAbsolutePoint(
                  startCircle
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


          /*
           * EXTREMO FINAL
           */

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
                this.getKonvaAbsolutePoint(
                  endCircle
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

                x: point.x,

                y: point.y

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
                this.getKonvaAbsolutePoint(
                  endCircle
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


          /*
           * Añadimos los extremos
           * DESPUÉS de la línea para
           * que estén visualmente encima.
           */

          this.layer.add(
            startCircle
          );


          this.layer.add(
            endCircle
          );


          /*
           * Guardamos referencia al
           * último extremo creado.
           */

          this.endpointShape =
            endCircle;

        }

      }


      /* =====================================================
         LABEL
         ===================================================== */

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


    /* =======================================================
       MESAS
       ======================================================= */

    for (
      const t of this.tables
    ) {

      const active =
        this.selectedTable?.id ===
        t.id;


      const hasPending =
        this.mode ===
          'operativo' &&
        this.pendingForTable(
          t.id
        ) > 0;


      const common = {

        x:
          t.x,

        y:
          t.y,

        rotation:
          t.rotation,

        draggable:
          this.mode ===
            'editor' &&
          this.tool ===
            'select',

        name:
          t.id,

        fill:
          hasPending
            ? '#9f2f3a'
            : active
              ? '#704936'
              : '#f3e9e2',

        stroke:
          hasPending
            ? '#ff5964'
            : active
              ? '#704936'
              : '#765744',

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

            radius:
              Math.min(
                t.width,
                t.height
              ) / 2

          })

          :

          new Konva.Rect({

            ...common,

            width:
              t.width,

            height:
              t.height,

            cornerRadius:
              10

          });


      /*
       * SELECCIONAR MESA
       */

      shape.on(
        'click tap',
        (event) => {

          event.cancelBubble =
            true;


          this.selectTable(t);

        }
      );


      /*
       * MOVER MESA
       */

      shape.on(
        'dragend',
        () => {

          t.x =
            shape.x();

          t.y =
            shape.y();


          t.updated_at =
            new Date()
              .toISOString();


          this.selectedElementId =
            null;


          this.pushHistory();

          this.render();

        }
      );


      this.layer.add(
        shape
      );


      /*
       * NUMERO
       */

      this.layer.add(

        new Konva.Text({

          x:
            t.x -
            (
              t.shape === 'circle'
                ? 20
                : 0
            ),

          y:
            t.y - 8,

          text:
            `${t.number}`,

          fill:
            hasPending ||
            active
              ? '#ffffff'
              : '#4d3326',

          fontSize:
            18,

          fontStyle:
            'bold',

          width:
            t.shape === 'circle'
              ? 40
              : t.width,

          align:
            'center'

        })

      );

    }


    this.layer.draw();

  }


  /* =========================================================
     KONVA POINT
     ========================================================= */

  private getKonvaAbsolutePoint(
    shape: Konva.Shape
  ): Point | null {

    if (!this.stage) {

      return null;

    }


    const absolute =
      shape.getAbsolutePosition();


    const transform =
      this.stage
        .getAbsoluteTransform()
        .copy();


    transform.invert();


    return transform.point(
      absolute
    );

  }


  /* =========================================================
     SELECT TABLE
     ========================================================= */

  private selectTable(
    t: ClubTable
  ) {

    this.selectedTable =
      t;


    this.selectedElementId =
      null;


    this.activeEndpoint =
      null;


    if (
      this.mode ===
      'operativo'
    ) {

      void this.loadOrders();

    }


    this.render();

  }


  /* =========================================================
     DELETE
     ========================================================= */

  deleteSelected() {

    /*
     * Elemento
     */

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


    /*
     * Mesa
     */

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

    }

  }


  /* =========================================================
     PENDING
     ========================================================= */

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


      for (
        const o of
        (data as any[])
      ) {

        const n =
          (
            o.order_items ??
            []
          )
            .filter(
              (i: any) =>
                i.status ===
                'PENDING'
            )
            .reduce(
              (
                a: number,
                i: any
              ) =>
                a +
                i.quantity,
              0
            );


        if (n) {

          map.set(
            o.table_id,
            n
          );

        }

      }


      this.pendingMap =
        map;


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
    catch {}

  }


  /* =========================================================
     DESTROY
     ========================================================= */

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


  /* =========================================================
     TOOL
     ========================================================= */

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

    }


    if (
      tool !== 'draw'
    ) {

      this.clearDrawing();

    }


    this.render();

  }


  /* =========================================================
     CANVAS POINT
     ========================================================= */

  private getCanvasPoint(
    ev: PointerEvent
  ): Point | null {

    this.stage
      .setPointersPositions(
        ev
      );


    const pointer =
      this.stage
        .getPointerPosition();


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


  /* =========================================================
     POINTER DOWN
     ========================================================= */

  pointerDown(
    ev: PointerEvent
  ) {

    /*
     * TEXTO
     */

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


    /*
     * DIBUJO
     */

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


  /* =========================================================
     POINTER MOVE
     ========================================================= */

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


  /* =========================================================
     POINTER UP
     ========================================================= */

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
      !this.drawingShape
    ) {

      return;

    }


    this.drawingShape =
      null;


    this.draftLayer.draw();

  }


  /* =========================================================
     START DRAWING
     ========================================================= */

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


  /* =========================================================
     CLEAR DRAWING
     ========================================================= */

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


  /* =========================================================
     TEXT DIALOG
     ========================================================= */

  closeTextDialog() {

    this.showTextDialog =
      false;


    this.newText =
      '';


    this.textPosition =
      null;

  }


  /* =========================================================
     ADD TEXT
     ========================================================= */

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


    /*
     * El modelo actual de FloorPlanElement
     * parece no incluir "text" en FloorElementKind.
     *
     * Por eso usamos un cast intermedio
     * mediante unknown.
     */

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


    this.pushHistory();


    this.render();


    this.closeTextDialog();


    this.setTool(
      'select'
    );

  }


  /* =========================================================
     CONVERT DRAWING
     ========================================================= */

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


  /* =========================================================
     SAVE DESIGN
     ========================================================= */

  async saveDesign() {

    try {

      /*
       * Si hay un dibujo sin convertir,
       * lo convertimos automáticamente.
       */

      if (
        this.drawing.length >=
        2
      ) {

        this.convertDrawing();

      }


      /*
       * Guardamos:
       *
       * - paredes
       * - textos
       * - mesas
       */

      await this.floors.saveSnapshot(

        this.plan.id,

        {

          elements:
            this.elements,

          tables:
            this.tables

        }

      );


      /*
       * Dialog de confirmación.
       */

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


  /* =========================================================
     SAVE DIALOG
     ========================================================= */

  closeSaveDialog() {

    this.showSaveDialog =
      false;

  }


  /* =========================================================
     ADD TABLE
     ========================================================= */

  addTable() {

    const numbers =
      new Set(
        this.tables.map(
          t => t.number
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


    this.tables = [

      ...this.tables,

      {

        id:
          crypto.randomUUID(),

        floor_plan_id:
          this.plan.id,

        number:
          n,

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
          now

      }

    ];


    this.pushHistory();


    this.render();

  }


  /* =========================================================
     PAN
     ========================================================= */

  togglePan() {

    this.setTool(

      this.tool ===
        'pan'

        ? 'select'

        : 'pan'

    );

  }


  /* =========================================================
     ZOOM
     ========================================================= */

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


  /* =========================================================
     HISTORY
     ========================================================= */

  pushHistory() {

    const snapshot:
      FloorSnapshot = {

        elements:
          structuredClone(
            this.elements
          ),

        tables:
          structuredClone(
            this.tables
          )

      };


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


  /* =========================================================
     RESTORE
     ========================================================= */

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


    this.selectedElementId =
      null;


    this.selectedTable =
      null;


    this.activeEndpoint =
      null;


    this.render();

  }


  /* =========================================================
     UNDO
     ========================================================= */

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


  /* =========================================================
     REDO
     ========================================================= */

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


  /* =========================================================
     ORDERS
     ========================================================= */

  async addOrderItem() {

    if (
      !this.selectedTable ||
      !this.selectedProductId ||
      this.quantity < 1
    ) {

      return;

    }


    await this.orders.addItem(

      this.selectedTable.id,

      this.selectedProductId,

      Math.floor(
        this.quantity
      ),

      this.auth.session()!
        .user.id

    );


    this.quantity =
      1;


    await this.loadOrders();

  }


  async markPlaced(
    id: string
  ) {

    await this.orders.markPlaced(

      id,

      this.auth.session()!
        .user.id

    );


    await this.loadOrders();

  }


  private async loadOrders() {

    if (
      !this.selectedTable
    ) {

      return;

    }


    try {

      const result =
        await this.orders.forTable(

          this.selectedTable.id

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
    catch {}

  }

}