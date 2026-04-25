## PRIORIDAD ALTA

[BASE DE DATOS] Migrar catálogo de consumibles a tabla Supabase
Impacto: eliminar dependencia de arrays hardcodeados y permitir edición dinámica.
Estado: PENDIENTE (Siguiente paso)

[BACKFILL] Crear script de poblado inicial para tabla consumibles_catalogo
Impacto: automatización de la migración de datos legacy.
Estado: PENDIENTE (Siguiente paso)

[UX] Refactor de Inputs de Hora (Dashboard Admin)
Impacto: eliminar selectores nativos de iOS/Safari para evitar incoherencias visuales.
Estado: PENDIENTE

## PRIORIDAD MEDIA

[LIMPIEZA] Retirar Google Sheets como backup de incidencias y consumibles (Apagado definitivo del dual-write)
Impacto: reducción de deuda técnica y mejora de rendimiento backend.
Estado: PENDIENTE

[MONITORIZACIÓN] Crear endpoint /api/health
Impacto: monitorización de estado de servicios (Supabase, Sheets, Avaibook).
Estado: PENDIENTE

[MANTENIMIENTO] Revisar hardcode de variables en frontend (puertos, URLs)
Impacto: facilidad de despliegue en entornos espejo.
Estado: PENDIENTE

## PRIORIDAD BAJA

[ORDEN] Limpieza de backups y archivos antiguos en el servidor
Impacto: ahorro de espacio y claridad en el VPS.
Estado: PENDIENTE
