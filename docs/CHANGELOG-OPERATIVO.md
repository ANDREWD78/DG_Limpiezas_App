## 2026-04-28

### Partes de limpieza — Migración a Supabase (FASE 3)

**Backend — `backend/routes/partes.js`**
- Supabase-primary para todas las rutas operativas: iniciar, pausar, reanudar, cerrar, fotos.
- Sheets solo como backup INSERT en parte nuevo (no bloquea respuesta).
- Updates de partes (pausar, reanudar, cerrar) ya **NO escriben en Sheets**.

**Backend — `backend/routes/admin.js`** — endpoints migrados a Supabase:
- `GET /admin/resumen-mensual` — lee `partes_limpieza` con rango `.gte/.lt` por fecha
- `GET /admin/partes-abiertos` — lee `partes_limpieza`
- `POST /admin/partes/:id/cerrar` — SELECT + UPDATE en `partes_limpieza`
- `POST /admin/partes/:id/editar-horas` — SELECT + UPDATE en `partes_limpieza`
- `PATCH /admin/partes/:id/ajustar-tiempo` — SELECT + UPDATE en `partes_limpieza`
- `POST /admin/partes/:id/anular` — SELECT + UPDATE en `partes_limpieza`
- `POST /admin/partes/manual` — INSERT en `partes_limpieza` (primario) + backup Sheets asíncrono
- `GET /admin/dashboard` — **sin cambios**, sigue leyendo Sheets (segunda fase pendiente)

**Tipos corregidos en updates Supabase:**
- `admin_editado`: `true` (boolean, no string)
- `duracion_min`, `tiempo_efectivo_min`, `tiempo_acumulado_seg`: numbers
- `coste_estimado_eur`: `parseFloat()`
- `ultimo_reanudar_ts`, `fin_ts_original` vacíos: `null` (no string vacío)
- `pausas_json`: array JS (JSONB nativo)

**Helpers nuevos en `admin.js`:**
- `_safeJsonArr(v)` — acepta array o JSON string (compatibilidad Supabase JSONB)
- `nextMonthStart(mes)` — calcula primer día del mes siguiente para rango `.lt`

**Frontend — `frontend/js/utils/time.js`** (creado en esta sesión):
- Helper centralizado `timeMadrid()`, `formatDateTimeMadrid()`, `todayMadrid()`, etc.
- Corrige visualización UTC→Europe/Madrid en todo el frontend.
- Aplicado a: `paso1.js`, `paso2.js`, `paso3.js`, `partes-abiertos.js`, `dashboard.js`

**Backfill:**
- Script: `backend/scripts/backfill_partes_csv.js`
- CSV: `backend/data/backfill/PartesLimpieza.csv`
- 26/26 filas importadas. Status: CERRADO ×24, CERRADO_FORZADO ×2.
- No volver a ejecutar con `--force`. Si se reejecuta post-deploy: usar `--skip-existing`.

Estado: ⚠️ pendiente de prueba local completa y deploy en producción  
Requiere: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` en `.env`  
Impacto: backend + frontend

## 2026-04-24

- **Consumibles (Migración Supabase)**: CRUD principal migrado operativamente a PostgreSQL (Supabase). Dual-write a Sheets mantenido como backup de seguridad.
- **Consumibles (UI)**: Filtros compactos en Dashboard Admin (Estado/Casa). Arranque por defecto en 'Pendiente'.
- **Consumibles (UX)**: Gestión de cantidad separada (deja de concatenarse en item_otro). Acciones directas de Repuesto y Descartar.
- **Consumibles (Catálogo)**: Preparado para migración a tabla Supabase (actualmente en arrays legacy).
- **Incidencias (UI)**: Filtros reorganizados visualmente (Labels arriba, chips compactos) para consistencia con Consumibles.
- **Validación Producción**: Verificados flujos de alta, resolución y descartado en ambos módulos.

Estado: ✅ en producción  
Requiere npm install: sí (por session-file-store si no estaba previamente instalado en el entorno)  
Impacto: backend + frontend

## 2026-04-22

- Incidencias: múltiples fotos + vídeo
- Validación MIME móvil (heic, heif, mov, webm)
- Supabase Storage con signed URLs
- Telegram: álbum + fallback automático
- Sessions: session-file-store
- Avaibook: migrado a fetch nativo (sin axios)
- Eliminado uso operativo de Google Drive para fotos
- Incidencias (DB): CRUD principal migrado operativamente a PostgreSQL (Supabase). Dual-write a Sheets mantenido como backup de seguridad.
- Incidencias (Lectura): Soporte híbrido para Drive URLs legacy y Supabase Storage paths.
- Incidencias (Admin UI): Pestaña integrada definitivamente en `dashboard.js` con filtros reactivos (Casa/Estado).
- Incidencias (Reglas UX): Implementado estado `Descartada`. Descartadas ocultas por defecto. Resueltas se auto-ocultan tras 7 días.
- Código Muerto: `admin/incidencias.js` aislado a `_legacy_incidencias.js`.
- Warnings críticos de producción resueltos (MemoryStore y MaxListenersExceededWarning)

Estado: ✅ en producción  
Requiere npm install: no  
Impacto: backend + frontend
