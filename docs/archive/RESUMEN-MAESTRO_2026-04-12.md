# DG LIMPIEZAS APP — RESUMEN MAESTRO ACTUALIZADO DEL PROYECTO
Última actualización: 2026-04-12
Estado consolidado del proyecto a fecha: Abril 2026

> ⚠️ DOCUMENTO MAESTRO VIGENTE
> Este archivo consolida el estado final de la aplicación tras múltiples iteraciones y refactoring de UX y base de datos.
> Sirve como Single Source of Truth puro, excluyendo todo el ruido intermedio o deudas ya saldadas. 

------------------------------------------------------------
1. ESTADO GENERAL DEL PROYECTO
------------------------------------------------------------
La app es una PWA monolítica enfocada a móvil, soportada por Node.js/Express y alojada detrás de un proxy Nginx en un VPS con PM2. Utiliza Google Sheets como base de datos operativa principal y Google Drive para adjuntos.

El enfoque central es el **rendimiento con mínima fricción**. Ya se encuentra en fase de operaciones reales (producción documentada). 

Prioridades superadas: estabilización del cronómetro, limpieza de flujos de interfaces, fiabilidad OAuth e individualización de permisos de vistas.
Prioridades de la iteración actual: pulido de UX del entorno "Admin" (paneles de control directos para revisar y actuar sobre datos sin fricción técnica).

------------------------------------------------------------
2. CAMBIOS YA IMPLANTADOS (Actualidad operativa)
------------------------------------------------------------
Se han completado con éxito y se encuentran en producción las siguientes actualizaciones:

*   **Propuestas de Consumibles:**
    *   Nueva pestaña exclusiva Admin en `dashboard.js`. Sustituye la etiqueta temporal de "Próximamente".
    *   El dashboard muestra contador real de propuestas pendientes.
    *   Flujo: revisión detallada de cada propuesta -> botón Aprobar (cataloga / despacha) -> botón Rechazar. Integrado a la hoja `ConsumiblesPropuestas`.
*   **Selector de Partes / Casas Restringidas:**
    *   Las empleadas solo ven en la interfaz inicial las casas listadas bajo su columna `casas_permitidas`.
    *   Se eliminaron todos los subtítulos secundarios y verbos innecesarios (MIRADOR, CASON, GRATAL son la jerarquía absoluta visible).
    *   Fallback seguro: Si el usuario es nuevo o tiene su columna vacía, ve el listado completo para no quedar bloqueado.
*   **Fotos de Cierre V2 e Inteligencia `isLast`:**
    *   Las subidas a Google Drive son obligatorias solo para la última persona (`isLast = true`) y solo si nadie ha subido fotos previas (`hasPhotos = false`).
    *   Backend `open-by-casa` devuelve el campo `hasPhotos` consolidado.
    *   El frontend en `fotos.js` habilita dinámicamente un botón "Cerrar sin subir fotos" adaptable al estado transversal de toda la casa. Sin romper el schema en Sheets ni añadir columnas pesadas.
*   **Migración de Fotos a Supabase Storage:**
    *   ✔ Migración completada de subida de fotos de partes a Supabase.
    *   ✔ Eliminado uso de Google Drive en cierre de partes.
    *   ✔ Eliminado bloqueo por errores OAuth (`invalid_grant`, `unauthorized_client`).
    *   ✔ Flujo validado en producción (cierre real con fotos).
*   **Gestión Admin de Consumibles e Incidencias:**
    *   Los botones flotantes "➕" ahora están dentro de su propia tab estructural en el admin.
    *   Botón consumibles renombrado a "Registrar consumible".
    *   Los CTA no desaparecen si la lista se vacía, permitiendo seguir operando.
    *   Modales rápidos in-place (no se va a una pantalla general ajena). Incorporados campos ricos para incidencias (Categoría, Ubicación dinámica, Prioridad, etc.).
*   **Anulación de Partes desde Admin:**
    *   Prohibido el borrado duro. Anulación lógica con status = `ANULADO`.
    *   Endpoint y modal de confirmación funcionales. Auditoría forzada con un `prompt` exigiendo el *motivo*.
    *   Los anulados están explícitamente y rigurosamente excluidos de los ciclos de `active` / `open-by-casa`, dashboards económicos, resúmenes mensuales y facturación temporal. No se "pisan a 0" horas ni costes, manteniendo inmutabilidad e historial de trazabilidad.
*   **Modal Detalles Parte (Reconstrucción Premium):**
    *   Modal responsivo de bottom-sheet puro con un grid moderno y ligero.
    *   Resumen superior renovado y edición admin mucho más clara.
    *   Botón de anular visible y funcional.
    *   *Nota*: Se mantiene el uso de `<input type="time">` para "Hora Inicio" y "Hora Fin", lo cual en iPhone/Safari supone una limitación de renderizado nativo conocida y queda como deuda pendiente.
*   **PWA / App Icon Mapeado:**
    *   Fin del placeholder tipo "L azul". Implementado pipeline webmanifest/HTML apuntando a los archivos generados `/icons/icon-512.png`, `apple-touch-icon.png` (usando el logo naranja limpio provisto como asset en `logo-dg-icono.svg`).
*   **Barra Superior Admin ("Navbar Header"):**
    *   Preparación estructural.
    *   *Nota*: El botón `QR Codes` NO ha sido retirado todavía y sigue renderizándose, por lo que la barra aún no goza del equilibrio final consolidado (Usuarios / Dashboard / Temporada). Queda como ajuste visual pendiente.

------------------------------------------------------------
3. DECISIONES FUNCIONALES VIGENTES
------------------------------------------------------------
*   **Cero Fricción al Trabajador:**
    *   Se eliminaron definitivamente las abstracciones "Nivel de suciedad (1 a 5)" y "Checklist" previo a limpiezas ordinarias en el frontend del usuario estándar, permitiendo acceso superrápido de arranque por fricción de terreno reportada. Se mantiene el soporte backend para su futura vuelta modular.
*   **Base de datos / Single Source of Truth:**
    *   No hay RDBMS (Postgres o MySQL) hasta la rama oficial V2.5. La única fuente de verdad es la Spreadsheet maestra. Todo borrado siempre será lógico. Todo parte conserva intactos sus inputs de duración estimada (salvo ajustes del admin y tiempo efectivo manual auditado).
*   **Partes Solapados / Concurrentes:**
    *   Máximo 1 parte en progreso simultáneo a nombre directo de UN usuario.

------------------------------------------------------------
4. FLUJOS ADMIN
------------------------------------------------------------
*   **Visualización Central Dashboard:** Métricas puras y concentradas. Tareas pendientes, aprobaciones de suministros, partes abiertos vs pendientes vs histórico del dinero incurrido.
*   **Control del Parte Individual (Bottom-sheet context)**: Puede editar las horas (HH:MM de `inicio` y `fin`) forzando recomputación automática de `tiempo efectivo`. Modifica registros de forma transparente. Si anula, queda auditado y fuera de radares.
*   **Gestión Rápida de Entidades**: Tanto Incidencias como Consumibles como Propuestas gozan de modales directos que recargan (`reloadCb()`) las listas limpiamente sin redibujar todo el DOM innecesariamente.

------------------------------------------------------------
5. FLUJOS TRABAJADORAS
------------------------------------------------------------
*   **Selección Restringida Transparente:** La limpiadora no se entera si tiene o no la app capada. Solo ve los tiles correspondientes a sus locaciones asignadas en Google Sheets.
*   **Creación e Inmersión Inmediata:** Tocar su Casa -> Tocar Parte -> Reloj en marcha y cierre por botón en footer flotante. Las incidencias y fotos aplican transversalmente.
*   **Resolución Final Segura:** Cuando intentan enviar el trabajo, el sistema chequea si la casa ha sido cubierta de fotos por el turno anterior.
*   **Flujo de partes (Fotos):**
    *   *ANTES:* Fotos se subían a Google Drive (generando carpeta y URLs).
    *   *AHORA:* Fotos se suben a Supabase Storage. Se almacenan rutas internas (path) en `fotos_cierre_urls_json`. No se generan URLs públicas en backend para guardar en Sheets. El campo `drive_folder_url` se mantiene por compatibilidad en DB pero sin uso operativo.

------------------------------------------------------------
6. BACKEND / INTEGRACIONES Y MODELO BASAL
------------------------------------------------------------
*   **Controladores/Endpoints principales (`/api/...`)**:
    *   `/partes` y subrutas `/(action)/open-by-casa`.
    *   `/admin/anular-parte` -> marca Status = `ANULADO`, audita y recalcula.
    *   Sheets.js maneja caché temporal.
*   **Autenticación**: Doble flujo: API PIN + Cookies de SESIÓN HTTP-Only.
*   **Modelo de Datos Básico (Representación Sheets `PartesLimpieza`)**:
    `id` | `session_id` | `fecha` | `casa` | `tipo_limpieza` | `inicio_ts` | `fin_ts` | `duracion_min` | `user_id` | `usuario_nombre` | `motivo_demora` | `coste_estimado_eur` | `admin_editado` | `status` | ...

------------------------------------------------------------
6.5 SUPABASE STORAGE (FOTOS)
------------------------------------------------------------
*   **Bucket usado**: `partes-fotos`
*   **Tipo**: Privado
*   Se guarda únicamente la ruta interna (`path`) de cada archivo.
*   **Ejemplo real (`fotos_cierre_urls_json`)**:
```json
{
  "cierre": [
    "MIRADOR/20-04-2026_P-XXXX/foto.jpg"
  ]
}
```

------------------------------------------------------------
7. DEUDAS PENDIENTES / PRÓXIMOS PASOS
------------------------------------------------------------
*   **Refactor de Inputs de Hora**: Eliminar los `<input type="time">` nativos del modal de detalle de parte de Admin y cambiarlos por una solución controlable (por ejemplo, selects HH:MM) para evitar incoherencias visuales en iOS/Safari.
*   **Limpieza Barra Superior Admin**: Retirar `QR Codes` del array de `TABS` de navegación y ajustar el flex/grid final para que `Dashboard` quede firmemente centrado.
*   **Limpieza de UI Desktop**: El Admin panel ha sido optimizado brutalmente en mobile-first. Una revisión visual (max-widths o paddings expansivos) podría requerirse si este se transiciona a una pantalla Mac/Tablet en exclusiva.
*   **Saltos Evolutivos PMS / PostgreSQL (V2.5)**: Queda mapeada la posibilidad de romper Google Sheets cuando el tráfico mensual desborde cuotas de lectura / escritura o para simplificar consultas GROUP_BY temporales ineficientes en .js puro.

------------------------------------------------------------
8. RIESGOS O NOTAS IMPORTANTES
------------------------------------------------------------
*   El mayor stopper técnico post-deploy del icono y tema PWA, reside en iOS/Safari. Todo trabajador debe **eliminar el "Add to Homescreen" actual de la L azul, purgar caché Webkit (Settings > Safari > Clear History) y re-añadir el bookmark** para empujar el nuevo manifest con `logo-dg-icono.svg`.
*   Un "Parte Anulado" guarda íntegros sus costes paramétricos (`coste_estimado_eur` y `duracion_min`) así que siempre hay que filtrarlos en backend explícitamente `p.status !== 'ANULADO'` para previsiones de flujo de caja. Esta norma es inquebrantable en todo script y ruta que compute gastos.
