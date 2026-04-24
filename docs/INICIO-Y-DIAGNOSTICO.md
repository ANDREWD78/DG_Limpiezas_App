# DG Limpiezas App — Arranque, diagnóstico y recuperación

> **Última actualización: 2026-04-12** · Puerto backend: **3001** · Puerto frontend: **4173**
> **Nota:** Este es el manual táctico local de arranque. Para la visión global, decisiones vigentes y el estado consolidado del proyecto, consultar siempre el **Resumen Maestro** (`docs/DG_Limpiezas_Resumen_Maestro_2026-04-12.md`).

---

## ⚠️ Requisito de versión de Node en local

> **Versión oficial para desarrollo local: Node 20.x**  
> El proyecto incluye un `.nvmrc` en la raíz con el valor `20`.

### Problema confirmado con Node 22

| Elemento | Detalle |
|---|---|
| **Síntoma visible** | El frontend carga, a veces llegas al PIN, pero no entra |
| **Causa real** | `require('googleapis')` tarda casi **1 minuto** con Node 22.x — el backend no se cae, se bloquea cargando |
| **Consecuencia** | El servidor no empieza a escuchar en `:3001` hasta mucho después de que el frontend ya está abierto |
| **Diagnóstico confuso** | Parece un fallo de PIN o de sesión — en realidad el backend aún no está listo |
| **Solución** | Cambiar a Node 20.x |

### Señal de arranque correcto

Cuando el backend arranca bien y rápido, en la terminal debe aparecer:

```
🧹 DG Limpiezas v2 → http://localhost:3001
Entorno: development
```

Si tras `npm run dev` no aparece ese mensaje en menos de 5 segundos, sospecha de versión de Node incorrecta.

### Pasos si cambias de versión de Node

```bash
nvm use 20          # o: nvm install 20 && nvm use 20
cd backend
rm -rf node_modules package-lock.json
npm install
```

> ⚠️ No mezclar `node_modules` instalados con Node 22 y ejecutarlos con Node 20 (ni al revés). Siempre reinstalar tras cambiar versión.

---

## Configuración actual

| Componente | Puerto | URL |
|---|---|---|
| Backend (Node/Express) | **3001** | `http://localhost:3001` |
| Frontend (static) | **4173** | `http://localhost:4173` |
| **Entrada correcta en navegador** | — | **`http://localhost:4173`** |

> **Nota:** El dashboard admin ahora incluye "Ficha de Casa" con gestión integral de reservas por alojamiento y operativa en tiempo real.

> ⚠️ No usar `http://localhost:3000` como punto de entrada. Puerto 3000 es solo el fallback de emergencia del backend si no hay `.env`.

---

## Dos terminales que deben quedar siempre abiertas

### Terminal 1 — BACKEND
```bash
cd "/Users/andrew/Desktop/DESTINO GUARA/APPS/DG_Limpiezas_App/backend"
npm run dev
```
Confirmar que sale:
```
🧹 DG Limpiezas v2 → http://localhost:3001
```

### Terminal 2 — FRONTEND
```bash
cd "/Users/andrew/Desktop/DESTINO GUARA/APPS/DG_Limpiezas_App/frontend"
npx serve . -p 4173
```
Confirmar que sale:
```
Accepting connections at http://localhost:4173
```

> **Nota:** La convención oficial del proyecto es `npx serve . -p 4173`, pero como alternativa puntual (si falla npx) también funciona `python3 -m http.server 4173`.

> **Arranque rápido:** desde la raíz del proyecto puedes usar `./start-dev.sh` (ver sección más abajo).

---

## URL correcta para entrar a la app

```
http://localhost:4173
```

Abre esta URL en el navegador. El login con PIN debe aparecer inmediatamente.

---

## Checklist de diagnóstico — "la app no entra"

Seguir **en este orden exacto:**

### 1. ¿El frontend está levantado?
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:4173
```
- `200` → frontend OK
- `000` o error → **Terminal 2 no está corriendo.** Levantarla.

### 2. ¿El backend está levantado?
```bash
curl -s http://localhost:3001/api/auth/me
```
- Responde JSON (aunque sea `401`) → backend OK
- `curl: (7) Failed to connect` → **Terminal 1 no está corriendo.** Levantarla.

### 3. ¿El backend responde en 3001 (no en 3000)?
```bash
curl -s http://localhost:3000/api/auth/me
```
- Responde → ⚠️ Backend fue iniciado sin `.env` y cayó al fallback 3000. Parar y relanzar con `.env` presente.
- No responde → correcto, el 3000 no está en uso.

### 4. ¿El login con PIN falla sin error de red?
- Abre DevTools → Network
- Mira a qué destino va el POST a `/api/auth/login`. Si falla estando en local, asegúrate de acceder a través de `localhost` o `127.0.0.1` para que el cliente resuelva correctamente contra `http://localhost:3001`.

### 5. ¿El backend devuelve error de sesión / CORS?
```bash
curl -v http://localhost:3001/api/auth/me 2>&1 | grep -E "< HTTP|cors|cookie"
```
- Verificar que el `SESSION_SECRET` en `.env` no está vacío ni corrupto.
- CORS está en `origin: true` — acepta cualquier origen. No debería ser problema.

### 6. ¿El `.env` del backend está bien?
```bash
grep "^PORT" "/Users/andrew/Desktop/DESTINO GUARA/APPS/DG_Limpiezas_App/backend/.env"
```
Debe devolver: `PORT=3001`

---

## Errores típicos y qué significan

| Síntoma | Causa probable | Solución |
|---|---|---|
| Pantalla en blanco / no carga | Frontend no levantado | Levantar Terminal 2 |
| PIN correcto pero no entra | Backend down o en puerto incorrecto | Comprobar Terminal 1 y ver paso 3 |
| `Failed to fetch` en consola del navegador | Frontend no puede alcanzar backend | Backend en otro puerto o no arrancado |
| `401 Unauthorized` en `/api/auth/me` | Normal si no hay sesión. No es error. | — |
| `Error 500` al hacer login | Problema con Google Sheets / credenciales | Revisar logs de Terminal 1 |
| App carga en 4173 pero API va mal | IP no reconocida como local (ej: red WiFi) | Usar siempre `localhost` o `127.0.0.1` en desarrollo |
| `EADDRINUSE 3001` al arrancar backend | Proceso previo zombie en ese puerto | `kill $(lsof -ti:3001)` luego relanzar |
| `EADDRINUSE 4173` al arrancar frontend | Proceso previo zombie en ese puerto | `kill $(lsof -ti:4173)` luego relanzar |
| Backend arranca pero tarda >30 s en escuchar en 3001 | Node 22.x — `googleapis` se bloquea al cargar | Cambiar a Node 20.x (ver sección de requisito Node) |
| `MaxListenersExceededWarning` en logs | Resuelto en producción. | Backend usa `fetch` nativo para Avaibook (axios eliminado). |
| Warning `MemoryStore is not designed...` | Resuelto en producción. | Backend usa `session-file-store`. |
| Warning `DeprecationWarning: punycode` | Dependencia profunda de `googleapis`. Es un aviso inofensivo de Node 21+. | Ignorar. No rompe nada. |

---

## Qué NO hacer

- ❌ No abrir la app desde `http://localhost:3001` — el backend no sirve el frontend
- ❌ No usar `npm start` en frontend (no hay `package.json` en `/frontend`)
- ❌ No confundir puerto 3000 con el correcto — es solo el fallback de emergencia
- ❌ No editar `.env` mientras el backend está corriendo sin reiniciarlo después
- ❌ No matar el proceso de backend mientras hay partes abiertos (datos en vuelo no se pierden — están en Sheets — pero el parte quedará abierto hasta cierre manual)

---

## Configuración técnica relevante

### Backend — `server.js`
```js
const PORT = process.env.PORT || 3000;  // fallback 3000 si no hay .env
```
→ El puerto 3001 viene de `.env` → `PORT=3001`

### Backend — CORS (`server.js`)
```js
const corsOptions = { origin: true, credentials: true };
```
→ Acepta cualquier origen. Las cookies de sesión necesitan `credentials: include` en el frontend.

### Frontend — `js/api.js`
```js
const isLocal =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1';

const BASE = isLocal ? 'http://localhost:3001' : '';
```
→ Lógica final: En local, la app siempre utiliza explícitamente `http://localhost:3001`. En producción (dominio real), la app siempre utiliza rutas relativas (`''`), quedando protegida detrás del proxy Nginx. Ya no existe ni debe usarse la llamada a `http://dominio:3001`.

> ⚠️ **Fragilidad detectada:** Si en algún momento el backend cambia al puerto 3002 u otro, hay que actualizar esta línea. El puerto 3001 está hardcodeado aquí.

---

## Script de arranque rápido — `start-dev.sh`

Ubicado en la raíz del proyecto. Abre dos procesos en paralelo:

```bash
./start-dev.sh
```

Para matar todo: `Ctrl+C` en la terminal donde corre.

---

## 🛠️ Acceso desde móvil en red local

Si necesitas probar la app (cámara, PWA, interfaz táctil) desde un móvil real antes de subir a producción:

1. **Misma Wi-Fi**: Asegúrate de que el móvil y el Mac están conectados a la misma red.
2. **Obtener IP local**: En el Mac, busca tu IP local (Sist. Prefs -> Red -> Wi-Fi -> detalla IP). 
   - *Ejemplo real:* `192.168.86.38`
3. **Abrir en el móvil**:
   - URL Frontend: `http://IP_LOCAL:4173`
   - *Ejemplo real:* `http://192.168.86.38:4173`
4. **Validación técnica**: El backend debe estar levantado en el Mac en el puerto 3001. La app está configurada para redirigir las llamadas a la API correctamente usando la IP del Mac.
5. **Añadir a Inicio**: En Safari (iPhone) -> Compartir -> *Añadir a pantalla de inicio* para probarla como PWA.
   - **Nota sobre PWA / Icono:** La app ya cuenta con su icono naranja real. Si en el móvil ya había un acceso directo antiguo (con la "L" azul generada por Apple), es importante **borrar ese acceso directo, limpiar la caché de Safari si fuera necesario, y volver a añadirlo** para que refresque y cargue el logo correcto.

---

## Chuleta diaria

```
┌─────────────────────────────────────────────────────┐
│  DG Limpiezas App — Arranque diario                │
├─────────────────────────────────────────────────────┤
│  OPCIÓN A — Script automático:                     │
│    ./start-dev.sh                                  │
│                                                    │
│  OPCIÓN B — Dos terminales manuales:               │
│                                                    │
│  [T1 - Backend]                                    │
│  cd .../DG_Limpiezas_App/backend                   │
│  npm run dev                                       │
│  → Esperar: "🧹 DG Limpiezas v2 → :3001"          │
│                                                    │
│  [T2 - Frontend]                                   │
│  cd .../DG_Limpiezas_App/frontend                  │
│  npx serve . -p 4173                              │
│  → Esperar: "Accepting connections at :4173"       │
│                                                    │
│  ABRIR EN NAVEGADOR:                               │
│  http://localhost:4173                             │
└─────────────────────────────────────────────────────┘
```

---

## Recomendaciones para más adelante

| Prioridad | Acción | Motivo |
|---|---|---|
| 🟡 Media | Mover el `3001` de `api.js` a una variable de entorno leída en build | Evitar hardcodeo |
| 🟢 Baja | Añadir `package.json` raíz con scripts `start:backend` y `start:frontend` | Alternativa al script `.sh` |
| 🟢 Baja | Añadir healthcheck básico en `/api/health` | Diagnóstico más limpio |
| ✅ Hecho | `.nvmrc` en raíz del proyecto con `20` | Evitar problemas con Node 22 (googleapis lento) |
