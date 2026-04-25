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
