Guía rápida de navegación:

- Desplegar → OPERATIVA-Y-DESPLIEGUE.md
- Arranque local → INICIO-Y-DIAGNOSTICO.md
- Estado actual → RESUMEN-MAESTRO.md
- Últimos cambios → CHANGELOG-OPERATIVO.md
- Pendientes → PENDIENTES-REALES.md

---
*Arquitectura rápida: El panel de control Admin (Incidencias, Consumibles, Propuestas y Partes) vive 100% integrado en `frontend/js/pages/admin/dashboard.js` bajo un patrón de filtros compactos y Supabase-first.*

*Módulos Supabase-primary (abril 2026): Partes (`partes_limpieza`), Incidencias, Consumibles. `GET /admin/dashboard` aún lee Sheets — segunda fase pendiente.*

*Timestamps frontend: toda conversión UTC→Europe/Madrid pasa por `frontend/js/utils/time.js`.*
