## PRIORIDAD ALTA

[PRUEBAS] Probar flujo completo de partes en local
Impacto: validar migración Supabase antes de producción.
Pasos: iniciar parte → pausar → reanudar → cerrar con fotos.
Estado: PENDIENTE (previo al deploy)

[PRUEBAS] Probar endpoints admin migrados en local
Impacto: validar cerrar/editar-horas/ajustar-tiempo/anular/manual contra Supabase.
Estado: PENDIENTE (previo al deploy)

[DEPLOY] Deploy en producción — ventana sin partes activos
Impacto: poner en producción la migración Supabase de partes.
Notas: verificar que `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` están en `.env` del VPS.
Estado: PENDIENTE

[BASE DE DATOS] Migrar GET /admin/dashboard a Supabase (Segunda Fase)
Impacto: el dashboard actualmente lee PartesLimpieza desde Sheets y puede mostrar datos desincronizados respecto a ediciones admin (que ya solo tocan Supabase).
Estado: PENDIENTE (segunda fase)

[BASE DE DATOS] Migrar catálogo de consumibles a tabla Supabase
Impacto: eliminar dependencia de arrays hardcodeados y permitir edición dinámica.
Estado: PENDIENTE

## PRIORIDAD MEDIA

[DECISIÓN] ¿Mantener backend/data/backfill/PartesLimpieza.csv en el repo?
Opciones: mantener como snapshot histórico (26 filas) o excluirlo del repo.
Estado: PENDIENTE DECISIÓN

[LIMPIEZA] Revisar backend/scripts/backfill_partes.js y warm_googleapis.js
Impacto: decidir si se conservan, archivan o eliminan tras la migración.
Estado: PENDIENTE

[LIMPIEZA] Retirar Google Sheets como backup de incidencias y consumibles (Apagado definitivo del dual-write)
Impacto: reducción de deuda técnica y mejora de rendimiento backend.
Estado: PENDIENTE

[VERIFICACIÓN] Confirmar que producción tiene NODE_ENV=production
Impacto: los cron jobs (scheduler.js) están desactivados si NODE_ENV != production.
Estado: PENDIENTE verificación post-deploy

[VERIFICACIÓN] Confirmar que Google Sheets sigue funcionando en producción
Impacto: Sheets sigue siendo necesario para backups y módulos no migrados (tareas periódicas, usuarios, reservas, dashboard).
Estado: PENDIENTE verificación post-deploy

[UX] Refactor de Inputs de Hora (Dashboard Admin)
Impacto: eliminar selectores nativos de iOS/Safari para evitar incoherencias visuales.
Estado: PENDIENTE

## PRIORIDAD BAJA

[MONITORIZACIÓN] Crear endpoint /api/health
Impacto: monitorización de estado de servicios (Supabase, Sheets, Avaibook).
Estado: PENDIENTE

[MANTENIMIENTO] Revisar hardcode de variables en frontend (puertos, URLs)
Impacto: facilidad de despliegue en entornos espejo.
Estado: PENDIENTE

[ORDEN] Limpieza de backups y archivos antiguos en el servidor
Impacto: ahorro de espacio y claridad en el VPS.
Estado: PENDIENTE
