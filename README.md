# Discoteca

Aplicación PWA Angular + Ionic para gestión de planos, mesas, productos y pedidos en tiempo real con Supabase.

## Requisitos
- Node.js 22+
- npm
- Proyecto Supabase

## Instalación
```bash
npm ci
```

## Supabase
1. Crea un proyecto.
2. Ejecuta `supabase/migrations/0001_initial.sql` en el SQL Editor o mediante Supabase CLI.
3. Copia la Project URL y la Publishable/Anon Key a `src/environments/environment.ts` y `environment.prod.ts` (son valores públicos; RLS protege los datos).
4. No copies nunca la Service Role Key al frontend.
5. En Authentication habilita Email/Password.
6. En Realtime verifica que las tablas de la migración estén en la publicación `supabase_realtime`.
7. El primer usuario creado queda con rol WAITER; asígnale ADMIN/MANAGER desde SQL de administración si necesitas crear planos/productos.

## Desarrollo
```bash
npm start
```

## Tests / lint / build
```bash
npm test -- --run
npm run lint
npm run build
```

## GitHub Pages
El workflow `.github/workflows/deploy.yml` ejecuta install, lint, tests, build y solo después despliega. En GitHub activa Pages con **GitHub Actions** como fuente. El proyecto está preparado para el repositorio `usuario/discoteca` y la URL `/discoteca/`.

## Arquitectura
Angular standalone + Ionic para UI responsive/táctil. Supabase JS accede directamente a Postgres mediante la API generada, con Auth/RLS como frontera de seguridad. Realtime notifica cambios de pedidos. Konva se usa para el editor gráfico porque mantiene objetos interactivos independientes sobre Canvas y soporta mouse/touch.

## Limitaciones MVP
- La conversión dibujo→plano es determinista y deliberadamente conservadora; produce segmentos ortogonales y requiere corrección manual.
- Offline solo cubre shell/cache; las mutaciones requieren conexión.
- La administración avanzada de usuarios se deja en Supabase Dashboard/SQL para evitar un panel no solicitado.

## Estado acumulado de esta entrega

Esta entrega conserva las correcciones acumuladas: roles ADMIN/USER, usuarios por nombre de usuario, Edge Function `create-user` con CORS y validación de sesión, contraseñas protegidas por RPC con `extensions.crypt`, entrada ADMIN en Planos, borrado protegido, `attended=true` => líneas PENDING a PLACED, precio de producto oculto/nullable y aviso Realtime mediante diálogo `HAY NUEVOS PEDIDOS` con botón `Continuar`.

GitHub Pages queda preparado para el repositorio `creadorSala` mediante `.github/workflows/deploy.yml` y `--base-href /creadorSala/`.

### Responsive order modal
The order detail overlay is styled globally in `src/styles.scss` because Ionic renders modal overlays outside Angular component style encapsulation. On phones it opens full-screen with internal vertical scrolling and safe-area support.

## App nativa (Capacitor)

El repositorio está preparado para empaquetar la misma aplicación como Android/iOS con Capacitor. Consulta `NATIVE_APP.md` para los pasos completos.

Comandos principales:

```bash
npm install
npm run android:add   # una sola vez
npm run ios:add       # una sola vez, en macOS
npm run native:assets
npm run native:build
npm run android:open
npm run ios:open
```
