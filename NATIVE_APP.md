# Sala Chocolatte como app nativa

El proyecto está preparado con Capacitor para generar aplicaciones Android e iOS usando el mismo código Angular/Ionic.

## Requisitos

- Node.js 22
- Android: Android Studio + SDK de Android + JDK compatible con la versión de Android Gradle Plugin instalada por Capacitor
- iOS: macOS + Xcode (solo puede compilarse iOS en un Mac)

## Primera instalación

1. Copia `.env` a la raíz del proyecto con `SUPABASE_URL` y `SUPABASE_ANON_KEY`.
2. Instala dependencias:
   `npm install`
3. Compila la web:
   `npm run build`

### Android

Ejecuta una sola vez:

`npm run android:add`

Después genera iconos/splash y sincroniza:

`npm run native:assets`
`npm run native:sync`

Abre Android Studio:

`npm run android:open`

### iOS

En macOS, ejecuta una sola vez:

`npm run ios:add`

Después:

`npm run native:assets`
`npm run native:sync`
`npm run ios:open`

## Flujo habitual después de modificar Angular

No vuelvas a crear las carpetas `android` o `ios`. Basta con:

`npm run native:build`

Esto ejecuta el build de Angular y sincroniza la carpeta web con los proyectos nativos.

## Identidad nativa

- Nombre: Sala Chocolatte
- App ID: `com.salachocolatte.app`
- Web output: `dist/discoteca/browser`

El archivo `resources/icon.svg` sirve como fuente del icono. `@capacitor/assets` genera los tamaños nativos cuando existen las plataformas Android/iOS.

## Actualizar iconos y cambios nativos

Después de añadir Android/iOS por primera vez, ejecuta:

`npm run native:update`

Este comando compila Angular, sincroniza Capacitor y regenera los iconos nativos desde `resources/icon.png` / `resources/icon.svg`.

Para que iOS muestre el icono de Sala Chocolatte en la pantalla de inicio, ejecuta `npm run native:assets` después de haber creado la carpeta `ios/`, y vuelve a compilar desde Xcode. En Android se aplica igual después de crear `android/`.
