import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonInput, IonInputPasswordToggle, IonButton, IonText, IonSpinner, IonIcon } from '@ionic/angular/standalone';
import { lockClosedOutline, logInOutline } from 'ionicons/icons';
import { addIcons } from 'ionicons';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, IonContent, IonInput, IonInputPasswordToggle, IonButton, IonText, IonSpinner, IonIcon],
  template: `
    <ion-content [fullscreen]="true" class="login-page">
      <main class="login-layout">
        <section class="login-card" aria-label="Acceso a Sala Chocolatte">
          <div class="brand">
            <div class="brand-mark">SALA<br />CHOCOLATTE</div>
            <p>Gestión de sala</p>
          </div>

          <div class="login-content">
            <div class="heading">
              <span class="eyebrow">ACCESO PRIVADO</span>
              <h1>Bienvenido</h1>
              <p>Inicia sesión para acceder a la gestión de la sala.</p>
            </div>

            <form (ngSubmit)="submit()">
              <ion-input
                label="Usuario"
                labelPlacement="stacked"
                type="text"
                autocomplete="username"
                fill="outline"
                [(ngModel)]="username"
                name="username"
                required
              ></ion-input>

              <ion-input
                label="Contraseña"
                labelPlacement="stacked"
                type="password"
                autocomplete="current-password"
                fill="outline"
                [(ngModel)]="password"
                name="password"
                required
              >
                <ion-input-password-toggle slot="end"></ion-input-password-toggle>
              </ion-input>

              @if (error()) {
                <ion-text color="danger" class="error-message">
                  <p>{{ error() }}</p>
                </ion-text>
              }

              <ion-button type="submit" expand="block" size="large" [disabled]="loading() || !username || !password">
                @if (loading()) {
                  <ion-spinner name="crescent"></ion-spinner>
                } @else {
                  <ion-icon slot="start" name="log-in-outline"></ion-icon>
                  Entrar
                }
              </ion-button>
            </form>

            <div class="security-note">
              <ion-icon name="lock-closed-outline"></ion-icon>
              <span>Acceso exclusivo para personal autorizado</span>
            </div>
          </div>
        </section>
      </main>
    </ion-content>
  `,
  styles: [`
    .login-page { --background: transparent; }
    .login-layout { min-height: 100%; display: grid; place-items: center; padding: 28px 18px; background: radial-gradient(circle at 15% 15%, rgba(113,70,48,.14), transparent 34%), linear-gradient(135deg, #f8f4f0 0%, #fff 52%, #f2ece7 100%); }
    .login-card { width: min(920px, 100%); min-height: 570px; display: grid; grid-template-columns: 40% 60%; overflow: hidden; border: 1px solid #e8ded7; border-radius: 28px; background: #fff; box-shadow: 0 24px 70px rgba(70,43,29,.15); }
    .brand { display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 48px; color: #fff; text-align: center; background: #563522; }
    .brand-mark { width: min(245px, 100%); padding: 28px 18px; border: 1px solid rgba(255,255,255,.25); font-weight: 900; font-size: clamp(25px, 4vw, 40px); line-height: .9; letter-spacing: .06em; }
    .brand p { margin: 22px 0 0; color: #eadbd0; font-size: 14px; letter-spacing: .12em; text-transform: uppercase; }
    .login-content { display: flex; flex-direction: column; justify-content: center; padding: clamp(32px, 6vw, 70px); }
    .heading { margin-bottom: 30px; }
    .eyebrow { color: #80543b; font-size: 12px; font-weight: 800; letter-spacing: .13em; }
    h1 { margin: 7px 0 8px; color: #2d211b; font-size: 36px; line-height: 1.05; }
    .heading p { margin: 0; color: #766a63; line-height: 1.5; }
    form { display: grid; gap: 18px; }
    ion-input { --background: #fff; --border-color: #d9ccc3; --border-radius: 12px; --highlight-color: #68422e; --padding-start: 14px; --padding-end: 14px; }
    ion-button { --background: #68422e; --background-hover: #543421; --border-radius: 12px; margin-top: 4px; font-weight: 700; }
    .error-message { display: block; padding: 11px 13px; border-radius: 10px; background: #fff1f0; }
    .error-message p { margin: 0; font-size: 13px; }
    .security-note { display: flex; align-items: center; justify-content: center; gap: 7px; margin-top: 26px; color: #8b7d75; font-size: 12px; }
    @media (max-width: 680px) { .login-card { grid-template-columns: 1fr; min-height: auto; border-radius: 22px; } .brand { padding: 30px 20px; } .brand-mark { font-size: 27px; padding: 18px; } .brand p { margin-top: 12px; } .login-content { padding: 30px 22px 34px; } h1 { font-size: 30px; } }
  `]
})
export class LoginComponent {
  username = '';
  password = '';
  loading = signal(false);
  error = signal('');

  constructor(private auth: AuthService, private router: Router) {
    addIcons({ lockClosedOutline, logInOutline });
  }

  async submit() {
    this.loading.set(true);
    this.error.set('');
    try {
      await this.auth.signIn(this.username.trim(), this.password);
      await this.router.navigateByUrl('/');
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo iniciar sesión');
    } finally {
      this.loading.set(false);
    }
  }
}
