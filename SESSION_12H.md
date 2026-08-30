# Límite absoluto de sesión: 12 horas

La aplicación registra localmente el instante del login explícito y fuerza el cierre de sesión al alcanzar 12 horas, aunque Supabase renueve el access token mediante refresh tokens.

Comportamiento:
- Un login nuevo inicia un periodo máximo de 12 horas.
- TOKEN_REFRESHED no reinicia el contador.
- Al volver a una pestaña/equipo suspendido se vuelve a comprobar el límite.
- Si la aplicación permanece abierta, se programa el cierre al cumplirse exactamente las 12 horas.
- Las sesiones existentes de versiones anteriores, que no tienen timestamp de inicio, se invalidan una vez al instalar esta versión.
