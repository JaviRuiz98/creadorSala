# Listas operativas

- La interfaz visible usa «Listas» en lugar de «Planos».
- «Crear lista» crea el contenedor y abre directamente la operativa de mesas/reservados.
- No se abre el editor gráfico al crear una lista.
- Desde la cabecera del listado ADMIN puede crear «+ Mesa» y «+ Reservado».
- La numeración usa el siguiente número libre del listado.
- La lógica interna mantiene `floor_plans` y `tables` para no requerir una migración destructiva.
