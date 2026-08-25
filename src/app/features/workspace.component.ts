import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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
  IonModal,
  IonInputPasswordToggle,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  logOutOutline,
  addOutline,
  trashOutline,
  copyOutline,
  settingsOutline,
  closeOutline,
  personAddOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
} from 'ionicons/icons';

import { AuthService } from '../core/auth/auth.service';
import { isValidUsername, normalizeUsername } from '../core/auth/auth-identity';
import { ErrorMessageService } from '../core/services/error-message.service';
import { FloorPlanService } from '../core/services/floor-plan.service';
import { ProductService } from '../core/services/product.service';
import { OrderService } from '../core/services/order.service';
import { UserAdminService } from '../core/services/user-admin.service';
import { PlanDuplicationService } from '../core/services/plan-duplication.service';
import { OrderNotificationService } from '../core/services/order-notification.service';
import type { FloorPlan, Product, ProductCategory, Role } from '../core/models/models';
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
    IonInputPasswordToggle,
    PlanEditorComponent,
    TableProductPanelComponent,
  ],
  templateUrl: './workspace.component.html',
  styleUrl: './workspace.component.scss',
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

  userAccessDialog = signal(false);
  createUserDialog = signal(false);
  verifyingUserAccess = signal(false);
  creatingUser = signal(false);
  userAccessError = signal('');
  createUserError = signal('');
  adminAccessPassword = '';
  newUserFullName = '';
  newUserUsername = '';
  newUserPassword = '';
  newUserRole: Role = 'USER';
  copyPlanDialog = signal(false);
  planToCopy = signal<FloorPlan | null>(null);
  copyPlanName = '';
  renamePlanDialog = signal(false);
  planToRename = signal<FloorPlan | null>(null);
  renamePlanName = '';
  deletePlanDialog = signal(false);
  planToDelete = signal<FloorPlan | null>(null);
  newOrderAlert = signal(false);
  private verifiedAdminPassword = '';
  private channel: any;
  private userOrderChannel: any;

  constructor(
    private auth: AuthService,
    private floors: FloorPlanService,
    private product: ProductService,
    private orders: OrderService,
    private userAdmin: UserAdminService,
    private duplication: PlanDuplicationService,
    private notifications: OrderNotificationService,
    private errors: ErrorMessageService,
    private router: Router,
  ) {
    addIcons({
      logOutOutline,
      addOutline,
      trashOutline,
      copyOutline,
      settingsOutline,
      closeOutline,
      personAddOutline,
      checkmarkCircleOutline,
      alertCircleOutline,
    });
    this.configured = (this.floors as any).db.configured;
  }

  get activeLabel(): string {
    return this.activeTab() === 'planos' ? 'Planos' : this.activeTab() === 'operativo' ? 'Operativa' : 'Productos';
  }
  get isAdmin(): boolean {
    return this.auth.hasRole('ADMIN');
  }
  get canCreateUser(): boolean {
    return (
      !!this.newUserFullName.trim() &&
      isValidUsername(this.newUserUsername) &&
      this.newUserPassword.length >= 6 &&
      (this.newUserRole === 'ADMIN' || this.newUserRole === 'USER') &&
      !!this.verifiedAdminPassword
    );
  }

  private validateNewUserForm(): string | null {
    if (!this.newUserFullName.trim()) return 'Introduce el nombre del usuario.';
    if (!this.newUserUsername.trim()) return 'Introduce un nombre de usuario.';
    if (!isValidUsername(this.newUserUsername)) {
      return 'El nombre de usuario debe tener entre 3 y 32 caracteres y solo puede contener letras, números, punto, guion o guion bajo.';
    }
    if (!this.newUserPassword) return 'Introduce una contraseña para el nuevo usuario.';
    if (this.newUserPassword.length < 6) return 'La contraseña debe tener al menos 6 caracteres.';
    if (this.newUserRole !== 'ADMIN' && this.newUserRole !== 'USER') return 'Selecciona un rol válido.';
    if (!this.verifiedAdminPassword) return 'Vuelve a validar la contraseña de administración.';
    return null;
  }

  async ngOnInit(): Promise<void> {
    try {
      this.plans.set(await this.floors.list());
      this.categories.set(await this.product.categories());
      this.products.set(await this.product.products());
      if (this.isAdmin) {
        // Un ADMIN siempre entra por la pantalla de listado de planos.
        this.activeTab.set('planos');
        this.editorMode.set('editor');
        this.selectedPlan.set(null);
      } else {
        this.activeTab.set('operativo');
        this.editorMode.set('operativo');
        if (this.plans().length) this.selectedPlan.set(this.plans()[0]);
        this.userOrderChannel = this.notifications.subscribeToNewOrderItems(() => {
          this.newOrderAlert.set(true);
          void this.refreshOperationalData();
        });
      }
      this.channel = this.orders.subscribe(() => this.refreshOperationalData(), 'workspace-orders');
    } catch (error) {
      this.toast.set(error instanceof Error ? error.message : 'Error cargando datos');
    }
  }

  ngOnDestroy(): void {
    this.channel?.unsubscribe?.();
    this.userOrderChannel?.unsubscribe?.();
  }

  private async refreshOperationalData(): Promise<void> {
    if (this.activeTab() !== 'operativo') return;
    this.toast.set('Datos actualizados');
  }

  toggleEditorMode(): void {
    if (!this.isAdmin) return;
    this.editorMode.set(this.editorMode() === 'editor' ? 'operativo' : 'editor');
  }
  openCreatePlanDialog(): void {
    this.newPlanName = '';
    this.createPlanDialog.set(true);
  }
  closeCreatePlanDialog(): void {
    this.createPlanDialog.set(false);
    this.newPlanName = '';
  }

  openUserAccessDialog(): void {
    if (!this.isAdmin) {
      this.toast.set('Solo los administradores pueden gestionar usuarios');
      return;
    }
    this.adminAccessPassword = '';
    this.userAccessError.set('');
    this.userAccessDialog.set(true);
  }

  closeUserAccessDialog(): void {
    this.userAccessDialog.set(false);
    this.adminAccessPassword = '';
    this.userAccessError.set('');
  }

  async verifyUserAccess(): Promise<void> {
    if (!this.isAdmin || !this.adminAccessPassword || this.verifyingUserAccess()) return;
    this.verifyingUserAccess.set(true);
    this.userAccessError.set('');
    try {
      const ok = await this.userAdmin.verifyAccess(this.adminAccessPassword);
      if (!ok) {
        this.userAccessError.set('Contraseña incorrecta');
        return;
      }
      this.verifiedAdminPassword = this.adminAccessPassword;
      this.userAccessDialog.set(false);
      this.adminAccessPassword = '';
      this.resetNewUserForm();
      this.createUserDialog.set(true);
    } catch (error) {
      this.userAccessError.set(error instanceof Error ? error.message : 'No se pudo verificar la contraseña');
    } finally {
      this.verifyingUserAccess.set(false);
    }
  }

  closeCreateUserDialog(): void {
    this.createUserDialog.set(false);
    this.verifiedAdminPassword = '';
    this.resetNewUserForm();
  }

  private resetNewUserForm(): void {
    this.newUserFullName = '';
    this.newUserUsername = '';
    this.newUserPassword = '';
    this.newUserRole = 'USER';
    this.createUserError.set('');
  }

  async createUser(): Promise<void> {
    if (!this.isAdmin || this.creatingUser()) return;

    const validationError = this.validateNewUserForm();
    if (validationError) {
      this.createUserError.set(validationError);
      return;
    }

    this.creatingUser.set(true);
    this.createUserError.set('');
    try {
      await this.userAdmin.createUser({
        full_name: this.newUserFullName.trim(),
        username: normalizeUsername(this.newUserUsername),
        password: this.newUserPassword,
        role: this.newUserRole,
        admin_password: this.verifiedAdminPassword,
      });
      const username = normalizeUsername(this.newUserUsername);
      this.closeCreateUserDialog();
      this.toast.set(`Usuario ${username} creado correctamente`);
    } catch (error) {
      this.createUserError.set(this.errors.humanize(error, 'No se pudo crear el usuario'));
    } finally {
      this.creatingUser.set(false);
    }
  }

  async createPlan(): Promise<void> {
    if (!this.isAdmin) return;
    const name = this.newPlanName.trim();
    const session = this.auth.session();
    if (!name || !session) {
      this.toast.set('No hay una sesión activa');
      return;
    }
    try {
      const plan = await this.floors.create(name, 2000, 1200, session.user.id);
      this.plans.update((current) => [...current, plan]);
      this.selectedPlan.set(plan);
      this.editorMode.set('editor');
      this.activeTab.set('operativo');
      this.closeCreatePlanDialog();
      this.toast.set('Plano creado correctamente');
    } catch (error) {
      this.toast.set(error instanceof Error ? error.message : 'No se pudo crear el plano');
    }
  }

  openPlan(plan: FloorPlan): void {
    this.selectedPlan.set(plan);
    this.editorMode.set('operativo');
    this.activeTab.set('operativo');
  }
  openEditor(plan: FloorPlan): void {
    if (!this.isAdmin) return;
    this.selectedPlan.set(plan);
    this.editorMode.set('editor');
    this.activeTab.set('operativo');
  }
  openPlanById(id: string): void {
    const plan = this.plans().find((item) => item.id === id);
    if (plan) this.openPlan(plan);
  }

  askDuplicate(plan: FloorPlan): void {
    if (!this.isAdmin) return;
    this.planToCopy.set(plan);
    this.copyPlanName = `${plan.name} copia`;
    this.copyPlanDialog.set(true);
  }

  closeCopyDialog(): void {
    this.copyPlanDialog.set(false);
    this.planToCopy.set(null);
    this.copyPlanName = '';
  }

  async confirmDuplicate(): Promise<void> {
    const plan = this.planToCopy();
    const session = this.auth.session();
    const name = this.copyPlanName.trim();
    if (!this.isAdmin || !plan || !session || !name) return;
    try {
      const copy = await this.duplication.duplicate(plan, session.user.id, name);
      this.plans.update((current) => [...current, copy].sort((a, b) => a.name.localeCompare(b.name)));
      this.closeCopyDialog();
      this.toast.set('Plano copiado correctamente');
    } catch (error) {
      this.toast.set(error instanceof Error ? error.message : 'No se pudo copiar el plano');
    }
  }

  openRenamePlanDialog(plan: FloorPlan): void {
    if (!this.isAdmin) return;
    this.planToRename.set(plan);
    this.renamePlanName = plan.name;
    this.renamePlanDialog.set(true);
  }

  closeRenamePlanDialog(): void {
    this.renamePlanDialog.set(false);
    this.planToRename.set(null);
    this.renamePlanName = '';
  }

  async confirmRenamePlan(): Promise<void> {
    const plan = this.planToRename();
    const name = this.renamePlanName.trim();
    if (!this.isAdmin || !plan || !name) return;
    try {
      await this.floors.update(plan.id, { name });
      this.plans.update((current) => current.map((item) => item.id === plan.id ? { ...item, name } : item).sort((a, b) => a.name.localeCompare(b.name)));
      if (this.selectedPlan()?.id === plan.id) this.selectedPlan.set({ ...this.selectedPlan()!, name });
      this.closeRenamePlanDialog();
      this.toast.set('Nombre del plano actualizado');
    } catch (error) {
      this.toast.set(error instanceof Error ? error.message : 'No se pudo cambiar el nombre');
    }
  }

  acknowledgeNewOrder(): void {
    this.newOrderAlert.set(false);
    this.activeTab.set('operativo');
    this.editorMode.set('operativo');
  }

  askRemovePlan(plan: FloorPlan): void {
    if (!this.isAdmin) return;
    this.planToDelete.set(plan);
    this.deletePlanDialog.set(true);
  }

  closeDeletePlanDialog(): void {
    this.deletePlanDialog.set(false);
    this.planToDelete.set(null);
  }

  async confirmRemovePlan(): Promise<void> {
    const plan = this.planToDelete();
    if (!this.isAdmin || !plan) return;
    try {
      await this.floors.remove(plan.id);
      this.plans.update((current) => current.filter((item) => item.id !== plan.id));
      if (this.selectedPlan()?.id === plan.id) this.selectedPlan.set(null);
      this.closeDeletePlanDialog();
      this.toast.set('Plano eliminado');
    } catch (error) {
      this.toast.set(error instanceof Error ? error.message : 'No se pudo eliminar');
    }
  }

  productsFor(categoryId: string): Product[] {
    return this.products().filter((product) => product.category_id === categoryId);
  }

  async createCategory(): Promise<void> {
    if (!this.isAdmin) return;
    const name = this.newCategory.trim();
    if (!name) return;
    try {
      const category = await this.product.createCategory(name);
      this.categories.update((current) => [...current, category]);
      this.newCategory = '';
      this.toast.set('Categoría creada');
    } catch (error) {
      this.toast.set(error instanceof Error ? error.message : 'No se pudo crear la categoría');
    }
  }

  async createProduct(categoryId: string): Promise<void> {
    if (!this.isAdmin) return;
    const name = this.newProductName[categoryId]?.trim();
    const price = Number(this.newProductPrice[categoryId]);
    if (!name || !Number.isFinite(price) || price < 0) return;
    try {
      const product = await this.product.createProduct(categoryId, name, price);
      this.products.update((current) => [...current, product]);
      this.newProductName[categoryId] = '';
      this.newProductPrice[categoryId] = 0;
      this.toast.set('Producto añadido');
    } catch (error) {
      this.toast.set(error instanceof Error ? error.message : 'No se pudo crear el producto');
    }
  }

  async logout(): Promise<void> {
    try {
      await this.auth.signOut();
    } catch (error) {
      this.toast.set(error instanceof Error ? error.message : 'No se pudo cerrar la sesión');
      return;
    }
    // signOut() solo actualiza el estado de sesión; el guard de la ruta
    // únicamente se re-evalúa al navegar, así que sin esto el botón
    // "cerrar sesión" no hacía nada visible.
    await this.router.navigateByUrl('/login');
  }
}
