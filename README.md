# 🧹 DG Limpiezas App (v2.1)

Sistema integral de gestión de limpiezas, control de inventario y auditoría económica para **Destino Guara**.  
Una PWA robusta que conecta la operativa real de campo con la inteligencia de negocio en Google Sheets y Avaibook.

---

## 🏗️ Arquitectura del Sistema

El proyecto se basa en una arquitectura de **Sincronización Híbrida**:

1.  **Backend (Node.js/Express)**: Motor central que procesa la lógica de negocio, autenticación por PIN y comunicación con APIs externas.
2.  **Frontend (Vanilla JS / PWA)**: Interfaz reactiva diseñada para móviles (trabajadoras) y escritorio (administración).
3.  **Persistence Layer (Google Sheets)**:
    *   `ReservasAvaibook`: Ventana operativa móvil (-1 mes a +10 meses) sincronizada periódicamente en producción (entorno Railway/VPS).
    *   `ReservasHistoricas`: Repositorio inmutable para auditoría de años pasados.
4.  **Integraciones**:
    *   **Avaibook API**: Sincronización de reservas reales y bloqueos de calendario.
    *   **Google Drive**: Almacenamiento jerárquico de fotos de revisión.
    *   **Telegram Bot**: Notificaciones instantáneas de partes finalizados e incidencias.

---

## 🚀 Inicio Rápido (Local)

1.  **Instalar dependencias**:
    ```bash
    cd backend && npm install
    ```
2.  **Configurar entorno**:
    Crea un archivo `.env` en `backend/` basado en `.env.example` con tus credenciales de Google, Avaibook y Telegram.
3.  **Lanzar servidor**:
    ```bash
    ./start-dev.sh
    ```
    Acceso: `http://localhost:3001` (Usar PINs configurados en Google Sheets).

---

## 📂 Módulos Principales

### 📊 Dashboard Económico (Admin)
*   **Ficha Interactiva**: Alternancia entre modo [Mes] y [Año].
*   **KPIs de Negocio**: Cálculo de Bruto, Comisiones y Neto con exclusión de cancelaciones y bloqueos.
*   **Navegación Reactiva**: Consulta de históricos sin recarga de página.

### 📅 Calendario y Disponibilidad
*   Visualización unificada de reservas (Mirador, Casón, Gratal).
*   Diferenciación visual entre reservas reales y bloqueos manuales.
*   Sincronización automática de `ReservasAvaibook` activa periódicamente en producción.

### 🧤 App de Campo (Trabajadoras)
*   Checklist dinámico por temporada.
*   **i18n**: Soporte completo para Castellano y Ruso.
*   Gestión de Tareas Periódicas y Reporte de Incidencias con foto.

---

## 🛠️ Herramientas y Scripts

Ubicados en `backend/scripts/`:
*   `backfill_historico.js`: Carga masiva de años anteriores desde Avaibook.
*   `run_archivar_historico.js`: Lanzador manual para mover reservas cerradas al histórico.
*   `diagnostics/verify_sheets_sync.js`: Auditoría de integridad entre API y Sheets.

---

## 📖 Documentación Viva

Para detalles profundos, consulta la carpeta `docs/`:
*   [Resumen Maestro V2.1](docs/DG_Limpiezas_Resumen_Maestro_V2.1.md): El estado del arte del proyecto.
*   [Guía de Operativa y Despliegue](docs/DG_LIMPIEZAS_APP_OPERATIVA_Y_DESPLIEGUE.md): Cómo mantener el sistema.
*   [Instrucciones Trabajadoras (ES/RU)](docs/Instrucciones_app_trabajadoras_DG.md): Manual de usuario de campo.

---

**Nota sobre Mantenimiento:**  
Este README debe actualizarse siempre que se realicen cambios estructurales en los servicios de `backend/` o en el esquema de datos de Google Sheets.
