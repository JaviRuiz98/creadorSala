# Mejoras móviles

- Icono nativo: `resources/icon.png` (1024x1024) y `resources/icon.svg`, con el mismo diseño que el favicon de Sala Chocolatte.
- Vista inicial del plano: calcula el zoom mínimo necesario para intentar mostrar el plano completo en el área disponible.
- Botón de zoom `−`: queda deshabilitado y gris al alcanzar el mínimo.
- Botón de zoom `+`: queda deshabilitado al alcanzar el máximo.
- Navegación táctil: soporte de gesto de pinza con dos dedos para zoom y desplazamiento.
- El lienzo usa el ancho real del dispositivo, sin forzar 600 px en móvil.
- `PAN` se muestra como `MOVER`.

## Aplicar iconos a plataformas ya creadas

Con las carpetas `ios/` y/o `android/` ya existentes:

```bash
npm run native:assets
npm run native:sync
```

Después recompila desde Xcode o Android Studio. En iOS, si el icono anterior queda cacheado, elimina la app del iPhone y vuelve a instalarla desde Xcode.
