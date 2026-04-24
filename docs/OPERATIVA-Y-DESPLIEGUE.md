# DG LIMPIEZAS APP – OPERATIVA Y DESPLIEGUE
**Última actualización: 2026-04-22**

> **Nota:** Esta es la guía de operativa en VPS. Para el arranque local y acceso desde dispositivos móviles, consultar **INICIO-Y-DIAGNOSTICO-APP.md**. Para la visión global y decisiones del proyecto, consultar el Resumen Maestro.

## 1. Datos base del despliegue

**App**  
DG Limpiezas App

**Dominio**  
`https://limpiezas.destinoguara.com`

**Servidor**  
VPS Hostinger  
Ubuntu 24.04

**Rutas principales**
- Proyecto: `/var/www/limpiezas-dg`
- Backend: `/var/www/limpiezas-dg/backend`
- Frontend: `/var/www/limpiezas-dg/frontend`
- Credenciales: `/var/www/limpiezas-dg/credentials`

**Proceso PM2**
- `limpiezas-dg-api`

**Nginx**
- `/etc/nginx/sites-available/limpiezas.destinoguara.com` (Proxy reverso hacia `127.0.0.1:3001`)
- `/etc/nginx/sites-enabled/limpiezas.destinoguara.com`

**Variables sensibles**
- `/var/www/limpiezas-dg/backend/.env`

---

## 2. Regla de oro antes de tocar nada

Antes de cualquier cambio:

- comprobar que la app funciona en producción
- hacer copia local de los archivos modificados
- **ESTRICTAMENTE PROHIBIDO:** no tocar ni sobreescribir `backend/.env` durante despliegues salvo necesidad real y conocida. Usar siempre el backup y restauración de seguridad descritos abajo.
- no borrar `credentials`
- no tocar Nginx ni PM2 si el cambio es solo de frontend o lógica simple
- hacer un cambio cada vez y probar después

---

## 3. Tipos de actualización

### A. Cambio solo de frontend
Ejemplos:
- textos
- estilos
- navegación
- lógica JS del frontend
- `manifest.json`, iconos PWA, `apple-touch-icon.png` (branding visual y acceso directo)
- `sw.js`

Normalmente requiere:
- subir archivos
- (opcional) reiniciar backend para asegurar limpieza de posibles estados residuales, aunque no es estrictamente obligatorio para cambios visuales o de CSS puro.
- a veces limpiar caché/PWA en móvil si no aparecen los cambios (F5 o borrar datos PWA).

### B. Cambio de backend sin dependencias nuevas
Ejemplos:
- rutas
- middleware
- lógica con Sheets, Drive, Telegram o email
- validaciones
- sesiones

Normalmente requiere:
- subir archivos
- reiniciar PM2

### C. Cambio de backend con dependencias nuevas
Ejemplos:
- nuevo paquete npm
- cambios en `package.json` o `package-lock.json`

Normalmente requiere:
- subir archivos
- `npm install`
- reiniciar PM2

### D. Cambio de infraestructura
Ejemplos:
- Nginx
- SSL
- tamaño máximo de subida
- puertos
- subdominios
- firewall

Requiere:
- revisar configuración
- validar con `nginx -t`
- recargar servicios con cuidado

---

### 4. Procedimiento maestro de actualización

### Paso 1. Trabajar en Local
- Realizar cambios en el entorno de desarrollo.
- Probar flujos críticos (login, cronómetro, calendarios).

### Paso 2. Preparar Paquete Limpio (ZIP)
Desde la terminal en el Mac, en la carpeta del proyecto:
```bash
# Limpiar archivos innecesarios
find . -name ".DS_Store" -delete
rm -rf backend/node_modules

# Crear zip excluyendo .env local y la carpeta de peligro
zip -r dg-limpiezas-app-clean.zip frontend backend docs README.md package.json package-lock.json -x "backend/.env" "backend/scripts/diagnostics/_dangerous/*"
```

### Paso 3. Subir al VPS (SCP)
```bash
scp dg-limpiezas-app-clean.zip andres@72.60.186.92:/home/andres/
```

### Paso 4. Desplegar en el VPS
Acceder por SSH: `ssh andres@72.60.186.92`

```bash
# 1. Asegurar backup de .env (VITAL)
cp /var/www/limpiezas-dg/backend/.env /home/andres/.env.limpiezas.backup

# 2. Descomprimir en carpeta temporal
mkdir -p /home/andres/deploy-tmp
unzip /home/andres/dg-limpiezas-app-clean.zip -d /home/andres/deploy-tmp

# 3. Copiar al directorio de producción (SIN BORRADO DESTRUCTIVO)
cp -r /home/andres/deploy-tmp/backend/* /var/www/limpiezas-dg/backend/
cp -r /home/andres/deploy-tmp/frontend/* /var/www/limpiezas-dg/frontend/
cp -r /home/andres/deploy-tmp/docs/* /var/www/limpiezas-dg/docs/
cp /home/andres/deploy-tmp/README.md /var/www/limpiezas-dg/README.md

# 4. Restaurar .env si se hubiera perdido
cp /home/andres/.env.limpiezas.backup /var/www/limpiezas-dg/backend/.env

# 5. Instalar dependencias (SOLO si ha cambiado backend/package.json)
# cd /var/www/limpiezas-dg/backend
# npm install

# 6. Reiniciar PM2 con carga de nuevas variables
pm2 restart limpiezas-dg-api --update-env
```

### Paso 5. Post-despliegue (Notas para Frontend / PWA)
Si la actualización incluye cambios en el icono o branding de la PWA:
- En **iPhone/Safari** el cambio puede no verse de inmediato por el cacheo agresivo.
- Para solucionarlo y que cargue el nuevo logo, es necesario: **borrar el acceso directo anterior**, limpiar caché del navegador si el problema persiste, y **volver a añadir a la pantalla de inicio**.

---

## 5.1 Limpieza post-despliegue

Tras verificar que producción funciona correctamente, conviene limpiar los restos temporales del despliegue en el VPS para evitar confusión futura, no acumular basura temporal y no mezclar paquetes viejos con nuevos.

**Borrar temporales (Seguro):**
```bash
rm -rf /home/andres/deploy-tmp
rm -f /home/andres/dg-limpiezas-app-clean.zip
```

> **⚠️ NUNCA TOCAR:**
> - `/var/www/limpiezas-dg/backend/.env`
> - `/var/www/limpiezas-dg/credentials`

---

# 5. Notas de Release - Abril 2026 (Consolidado)
Esta versión incluye hitos técnicos y funcionales drásticos para la estabilidad y profesionalización:
- **Incidencias Multimedia y DB (Supabase)**: Soporte completo para múltiples fotos (max 10) y 1 vídeo, con validación MIME real en servidor. El flujo de subida usa **Signed URLs** temporales de Supabase Storage. El modelo de datos completo de Incidencias ha migrado operativamente a Supabase PostgreSQL (escribiendo a Sheets en dual-write como mero backup).
- **Consolidación UI Admin**: La fuente de verdad visual del panel de incidencias vive 100% nativa en `dashboard.js`. Incluye filtros interactivos, estado "Descartada", y limpieza automática visual de resueltas antiguas. El antiguo `incidencias.js` ha sido deprecado.
- **Telegram Resiliente**: Se usa `sendMediaGroup` para agrupar fotos en álbumes. Incluye un sistema "Fallback" automático que reintenta enviar imagen por imagen si la API rechaza el lote.
- **Sesiones Persistentes**: Implementación de `session-file-store` en el backend. Las sesiones de las empleadas ya no se borran al reiniciar PM2 y se elimina el error de producción de `MemoryStore`.
- **Avaibook Nativo**: Sustituido el cliente HTTP `axios`/`follow-redirects` por el API `fetch` nativo de Node.js (v18+). Elimina por completo los `MaxListenersExceededWarning` en la sincronización del calendario.

---

## 6. Operativa de Scripts y Archivados

El proyecto funciona con una doble hoja: operativa activa (`ReservasAvaibook`) e inmutable (`ReservasHistoricas`). Mantenla limpia usando la carpeta `backend/scripts/`:

### A. Proceso Automático (Cron Oficial)
- **`backend/jobs/archivarHistorico.js`**:
  Ejecutado automáticamente por PM2 el día 1 de cada mes a las 03:00 am (Zona horaria Europe/Madrid). Filtra reservas estables (cerradas, comprobadas) y las mueve deductivamente al histórico. **No se requiere intervención humana.**

### B. Ejecuciones Manuales (On-Demand)
Asegurarse de estar siempre dentro del directorio `backend/` antes de ejecutar estos comandos:
```bash
cd backend
```

- **`run_archivar_historico.js`**:
  Wrapper manual para forzar la ejecución del job de archivado si alguna vez falla el cron o queremos limpiar la hoja operativa el último día del mes por razones de rendimiento.
  ```bash
  node scripts/run_archivar_historico.js
  ```
- **`backfill_historico.js`**:
  Llama a la API de Avaibook para solicitar reservas enteras de años anteriores y poblarlas en nuestra hoja. *Solamente usar para cargar años pasados vírgenes.*
  ```bash
  node scripts/backfill_historico.js 2024-01-01 2024-12-31
  ```

---

## 7. Notas Importantes de Producción

### Fix de Sesión y Proxy
Para que el login persista detrás de Nginx, `backend/server.js` debe incluir:
- `app.set('trust proxy', 1);`
- `proxy: true` en la configuración de `express-session`.

### Archivos Excluidos y Peligrosos
Nunca subir al runtime de producción:
- Los archivos en `backend/scripts/diagnostics/_dangerous/`. (Son destructivos para la base de datos Sheet).

### Restauración Crítica
Si el `.env` se corrompe o borra, el backup maestro está en `/home/andres/.env.limpiezas.backup`. Revisar siempre `SESSION_SECRET`, `SHEET_ID` y `AVAIBOOK_TOKEN` tras restaurar.