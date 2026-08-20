import { Component } from '@angular/core'; import { IonApp,IonRouterOutlet } from '@ionic/angular/standalone'; import { RouterOutlet } from '@angular/router';
@Component({selector:'app-root',standalone:true,imports:[IonApp,IonRouterOutlet,RouterOutlet],template:'<ion-app><ion-router-outlet></ion-router-outlet></ion-app>'}) export class AppComponent {}
