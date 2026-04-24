# DG LIMPIEZAS APP — RESUMEN MAESTRO DEL PROYECTO
Estado del proyecto a fecha: 2026-03-09

Este documento resume:
- arquitectura actual
- decisiones de diseño
- modelo de datos
- lógica del cronómetro
- problemas detectados
- bugs pendientes
- roadmap futuro (PMS, Postgres, UX, etc.)

El objetivo es poder continuar el desarrollo en nuevos hilos sin perder contexto.


------------------------------------------------------------
1. OBJETIVO DEL PROYECTO
------------------------------------------------------------

Crear una PWA interna para gestionar limpiezas de las casas de Destino Guara.

Debe permitir:

- iniciar limpieza
- registrar tiempos reales por empleada
- registrar incidencias con foto o vídeo
- registrar consumibles faltantes
- subir fotos a Drive
- enviar resumen por Telegram
- calcular coste de limpieza automáticamente
- controlar sesiones de limpieza cuando hay varias personas

La app sustituye el control manual actual.


------------------------------------------------------------
2. ARQUITECTURA ACTUAL
------------------------------------------------------------

Backend stack:

- Node.js
- Express
- Google Sheets como base de datos
- Google Drive para fotos
- Telegram Bot para notificaciones

Estructura principal:

backend/
  routes/
    partes.js
  services/
    sheets.js
    drive.js
    telegram.js
  middleware/
    auth.js

Frontend:

PWA simple con HTML + JS.

Pantallas principales:

login
selección de casa
tipo de parte
flujo de limpieza
pantalla éxito


------------------------------------------------------------
3. CASAS DEL SISTEMA
------------------------------------------------------------

MIRADOR (Sabayés)
CASON (Salto de Roldán)
GRATAL (Siétamo)

Particularidades:

MIRADOR y CASON comparten lógica especial Sabayés.


------------------------------------------------------------
4. TIPOS DE PARTE
------------------------------------------------------------

Actualmente:

Cambio de huéspedes
Revisión rápida
Añadir consumibles

Estado actual del flujo de Cambio de huéspedes:

- Pantalla 1: suciedad inicial (1–5)
- Pantalla 2: checklist por casa
- Pantalla 3: fotos
- Pantalla 4: cierre

La incidencia se registra mediante un botón global visible en todas las
pantallas del flujo.

Limpieza profunda queda pendiente como sistema separado de tareas
periódicas gestionadas desde admin.


------------------------------------------------------------
5. BASE DE DATOS (GOOGLE SHEETS)
------------------------------------------------------------

Sheet principal:

PartesLimpieza

Columnas actuales:

id
session_id
fecha
casa
tipo_limpieza
suciedad_1a5
inicio_ts
fin_ts
duracion_min
user_id
usuario_nombre
motivo_demora
motivo_demora_detalle
checklist_json
resumen
pendiente
ropa_sucia_estado
lena_rellenada
pellets_rellenado
casa_lista
casa_lista_falta_texto
drive_folder_url
fotos_cierre_urls_json
coste_estimado_eur
created_by
tareas_realizadas
status
cleaning_session_id
last_alert_ts_open_part
admin_editado
admin_editado_por
admin_editado_ts
admin_edit_motivo
inicio_ts_original
fin_ts_original
limpieza_profunda_texto
tiempo_efectivo_min
pausas_json
observaciones
tiempo_acumulado_seg
ultimo_reanudar_ts
tareas_periodicas_json


------------------------------------------------------------
6. MODELO DE SESIONES DE LIMPIEZA
------------------------------------------------------------

Conceptos clave:

session_id
identifica cada parte individual.

cleaning_session_id
identifica una limpieza conjunta cuando trabajan varias personas.

Ejemplo:

persona1 inicia limpieza → cleaning_session_id = A
persona2 se une → cleaning_session_id = A

ambos forman una sesión.


------------------------------------------------------------
7. MODELO DE TIEMPO (CRONÓMETRO)
------------------------------------------------------------

Sistema actual basado en:

tiempo_acumulado_seg
ultimo_reanudar_ts

Estados:

ABIERTO
PAUSADO
CERRADO

Cálculo del tiempo:

si ABIERTO
    tiempo = acumulado + (ahora - ultimo_reanudar_ts)

si PAUSADO
    tiempo = acumulado

si CERRADO
    tiempo = acumulado final

Esto evita recalcular pausas constantemente.


------------------------------------------------------------
8. SISTEMA DE PAUSAS
------------------------------------------------------------

pausas_json

estructura:

[
  {inicio, fin}
]

al pausar:

inicio = now
fin = null

al reanudar:

fin = now

Pero el tiempo efectivo no depende de esto directamente.


------------------------------------------------------------
9. REGLAS SABAYÉS
------------------------------------------------------------

Caso especial:

MIRADOR
CASON

Una persona puede tener:

MIRADOR pausado
CASON abierto

pero nunca dos ABIERTO simultáneos.


------------------------------------------------------------
10. SISTEMA DE CACHE DE PAUSA
------------------------------------------------------------

Problema detectado:

Google Sheets tiene latencia de escritura.

Solución implementada:

cache en memoria:

_pausaReciente Map

TTL 10 segundos

Evita conflicto al iniciar otro parte inmediatamente después de pausar.


------------------------------------------------------------
11. SISTEMA DE FOTOS
------------------------------------------------------------

Fotos subidas a Google Drive.

Estructura de carpetas:

CASA/
  fecha_parte/


------------------------------------------------------------
12. TELEGRAM BOT
------------------------------------------------------------

Envía resumen final con:

usuario
casa
tipo de parte en texto legible
fecha y hora de inicio/fin
duración en formato legible
suciedad
estado casa
consumibles
incidencias
checklist incompleto
número de fotos
enlace a carpeta de fotos en Google Drive


------------------------------------------------------------
13. SISTEMA DE ALERTAS
------------------------------------------------------------

Parte abierto demasiado tiempo.

Config en Sheet:

alert_open_part_hours
open_part_alert_cooldown_hours


------------------------------------------------------------
14. BUGS QUE HEMOS TENIDO
------------------------------------------------------------

cronómetro ignoraba pausas
tiempo acumulado se reiniciaba
columnas desalineadas en Sheets
faltaba ultimo_reanudar_ts
conflictos Sabayés
409 al iniciar tras pausar
pantalla "nuevo parte" rota


------------------------------------------------------------
15. BUGS ACTUALES PENDIENTES
------------------------------------------------------------

latencia Google Sheets
sistema de tareas periódicas pendiente: control mensual automático por Telegram


------------------------------------------------------------
16. DECISIONES UX
------------------------------------------------------------

1 parte abierto máximo por persona

si sales de la app:
parte persiste

al volver:
reanuda

acciones disponibles solo tras elegir casa

en Cambio de huéspedes, la pantalla de suciedad solo se muestra al crear
el parte por primera vez; si ya existe suciedad guardada, al reanudar se
entra directamente en checklist

botón global de incidencia visible en cabecera durante el flujo

en la pantalla de “Nuevo parte”, solo se muestran como opciones:
Cambio de huéspedes, Revisión rápida y Añadir consumibles

el tipo de parte seleccionado queda marcado visualmente igual que la casa seleccionada


------------------------------------------------------------
17. CONSUMIBLES
------------------------------------------------------------

catálogo en Google Sheets

orden alfabético

si no existe:

propuesta → aprobación admin → se añade


------------------------------------------------------------
18. INCIDENCIAS
------------------------------------------------------------

registro disponible en cualquier pantalla del flujo mediante botón global

acepta foto o vídeo como adjunto

se guardan en Sheet:

IncidenciasMantenimiento


------------------------------------------------------------
19. ROADMAP FUTURO
------------------------------------------------------------

Migración de base de datos.

Google Sheets → Postgres

Ventajas:

consultas rápidas
sin latencia
control transacciones
mejor escalabilidad


------------------------------------------------------------
20. PMS FUTURO
------------------------------------------------------------

Integración con sistema de reservas.

Objetivos:

saber automáticamente:

checkin
checkout
casa ocupada
tipo limpieza


------------------------------------------------------------
21. FUNCIONES FUTURAS
------------------------------------------------------------

geolocalización al iniciar parte
detección automática de duplicados
panel admin avanzado
dashboard costes limpieza
resumen semanal automático
resumen mensual costes empleados
IA detección suciedad por fotos (idea futura)
control mensual automático de tareas periódicas por Telegram


------------------------------------------------------------
22. MEJORAS UX PENDIENTES
------------------------------------------------------------

panel admin para gestión de tareas periódicas


------------------------------------------------------------
23. MIGRACIÓN A POSTGRES
------------------------------------------------------------

estructura futura recomendada:

tables:

users
cleaning_sessions
cleaning_parts
pauses
incidents
consumables


------------------------------------------------------------
24. PRINCIPIOS DE DISEÑO
------------------------------------------------------------

simplicidad para empleadas
mínimos clicks
todo móvil
offline tolerante
persistencia de sesión


------------------------------------------------------------
25. ESTADO ACTUAL DEL PROYECTO
------------------------------------------------------------

Backend:

85% funcional

Frontend:

85%

cronómetro:

estable y operativo tras corrección de lectura en Sheets


------------------------------------------------------------
26. PRÓXIMO PASO RECOMENDADO
------------------------------------------------------------

1 panel admin para gestión de tareas periódicas

2 control mensual automático de tareas periódicas por Telegram

3 panel admin básico

4 migración progresiva a Postgres

5 integración PMS


------------------------------------------------------------
27. USUARIOS DEL SISTEMA
------------------------------------------------------------

Usuarios limpieza:

Inma       PIN 3333
Isabel     PIN 4444
Daniela    PIN 5555
Natalia    PIN 6666

Usuarios admin:

Andrés     PIN 3552
María      PIN 1111

Tarifa limpieza:

12 €/hora


------------------------------------------------------------
28. TIEMPOS OBJETIVO LIMPIEZA
------------------------------------------------------------

MIRADOR

1 persona → 420 min
2 personas → 210 min
3 personas → 140 min

CASON

1 persona → 210 min
2 personas → 105 min
3 personas → 70 min

GRATAL

1 persona → 180 min
2 personas → 90 min


------------------------------------------------------------
29. CONFIGURACIÓN DEL SISTEMA
------------------------------------------------------------

temporada = entretiempo

umbral_factor = 1.3

alert_open_part_hours = 8

open_part_alert_cooldown_hours = 12

email_to = info@destinoguara.com

telegram_chat_id = -5227209765

Sistema Tareas Periódicas:

- hoja TareasPeriodicas para catálogo y estado vivo
- hoja TareasPeriodicasLog para histórico
- campo tareas_periodicas_json en PartesLimpieza


Entorno local de desarrollo:

- backend/API oficial en http://localhost:3000
- frontend oficial de desarrollo en http://localhost:4173
- comando recomendado frontend: npx serve . -p 4173
- frontend/js/api.js usa BASE dinámico según puerto y hostname
- en 3000 las llamadas son relativas; en 4173 o acceso por IP local apuntan al host real en puerto 3000


------------------------------------------------------------
29B. SISTEMA TAREAS PERIÓDICAS
------------------------------------------------------------

Se implementa un sistema para gestionar tareas de mantenimiento o
limpieza profunda que deben realizarse de forma periódica en cada casa.

Objetivo:

evitar olvidos de mantenimiento importante y repartir estas tareas dentro
de las limpiezas normales de cambio de huéspedes.

Funcionamiento:

- las tareas se definen en la hoja TareasPeriodicas
- cada tarea tiene casa, zona, nombre y periodicidad en meses
- la app consulta GET /api/tareas-periodicas?casa=X al abrir el checklist
- solo se muestran tareas activas, de esa casa, cuya
  proxima_realizacion_ts está vacía o ya venció
- aparecen en el checklist como una sección separada:
  🛠️ Tareas periódicas
- no bloquean el envío del parte
- al cerrar el parte se guarda tareas_periodicas_json en PartesLimpieza
- además se registra histórico en TareasPeriodicasLog
- si una tarea se marca como hecha, se actualiza:
  ultima_realizacion_ts y proxima_realizacion_ts

Integración en Telegram:

- si hubo tareas periódicas en el parte, el resumen final las muestra todas
- ✅ si se hicieron
- ❌ si no se hicieron

Validación funcional realizada:

- sección visible en checklist
- guardado correcto en log
- actualización de próxima realización
- bloque correcto en Telegram

Estado: IMPLEMENTADO Y VALIDADO.


------------------------------------------------------------
HISTORIAL TÉCNICO DEL PROYECTO
------------------------------------------------------------

Las siguientes secciones documentan hallazgos técnicos, bugs
resueltos y mejoras importantes implementadas durante el
desarrollo de la app DG Limpiezas.

Este bloque funciona como historial técnico del sistema y
permite entender rápidamente:

- problemas encontrados
- decisiones técnicas tomadas
- cambios relevantes en UX y backend
- evolución del proyecto

Las entradas están ordenadas cronológicamente.


------------------------------------------------------------
30. HALLAZGO TÉCNICO — BUG CRONÓMETRO (2026-03-09)
------------------------------------------------------------

Se detectó un bug crítico en el cronómetro de la app DG Limpiezas.

Síntomas observados:

- al pausar y reanudar el cronómetro volvía a 00:00
- tras logout/login el tiempo acumulado desaparecía
- la reconstrucción del tiempo no era consistente

Causa raíz:

En services/sheets.js la función readRange utilizaba un rango fijo
demasiado corto para leer los datos del Sheet.

Implementación original:

async function readRange(tab, range = 'A:Z')

El rango 'A:Z' solo lee 26 columnas.

La hoja PartesLimpieza ya tenía más de 40 columnas, por lo que las
columnas finales no se estaban leyendo:

tiempo_acumulado_seg
ultimo_reanudar_ts

Estas columnas sí se escribían correctamente en Google Sheets, pero
al reconstruir el estado del cronómetro el backend recibía valores
vacíos, provocando que el tiempo acumulado se reiniciara.

Solución aplicada:

Se introdujo una constante global para lectura completa:

const DEFAULT_FULL_RANGE = 'A:ZZZ';

async function readRange(tab, range = DEFAULT_FULL_RANGE)

Con 'A:ZZZ' se cubren miles de columnas, evitando que futuras
ampliaciones de la hoja vuelvan a provocar truncación.

Resultado:

- tiempo_acumulado_seg se lee correctamente
- ultimo_reanudar_ts se mantiene entre pausas
- el cronómetro sobrevive a logout/login
- la reconstrucción del estado del parte funciona correctamente

Este bug queda considerado RESUELTO.


------------------------------------------------------------
31. RESOLUCIÓN BUG UX — BOTÓN “NUEVO PARTE” (2026-03-09)
------------------------------------------------------------

Se detectó un bug en el flujo de navegación del frontend de la app.

Síntomas observados:

- desde la pantalla de éxito, al pulsar el botón "Nuevo parte"
- la app volvía a la pantalla de selección
- pero los botones de selección de casa y tipo de parte no respondían
- era necesario recargar la página y volver a hacer login

Impacto:

El flujo de trabajo tras finalizar una limpieza quedaba bloqueado.

Causa:

La transición desde la pantalla de éxito no reinicializaba correctamente
el estado del frontend ni los listeners de los botones interactivos.

Solución aplicada:

Se corrigió la lógica de navegación para que el flujo de creación de
nuevo parte reinicialice correctamente:

- pantalla de selección
- listeners de botones
- estado del flujo anterior

Resultado:

- el botón "Nuevo parte" inicia correctamente un nuevo flujo
- los botones de selección vuelven a responder
- ya no es necesario recargar la aplicación

Este bug queda considerado RESUELTO.


------------------------------------------------------------
32. RESOLUCIÓN BUG LÓGICA — REANUDAR PARTE DE OTRA PERSONA (2026-03-09)
------------------------------------------------------------

Se detectó un problema en la lógica de recuperación de partes abiertos
al iniciar sesión con PIN.

Síntomas observados:

- al iniciar sesión con el PIN de una empleada
- podía aparecer la opción de reanudar un parte abierto de otra persona
- esto podía provocar mezcla de tiempos entre empleadas

Impacto:

Los tiempos de limpieza podían mezclarse entre usuarias,
alterando la duración real y el coste por empleada.

Regla funcional correcta:

- cada usuaria solo puede reanudar los partes que ella misma ha iniciado
- no se permite unirse automáticamente a un parte abierto de otra persona
- se mantiene la regla de máximo un parte abierto por usuario

Solución aplicada:

Se ajustó la validación de recuperación de partes abiertos para que
solo permita reanudar partes cuyo user_id coincida con el usuario
autenticado.

Resultado:

- cada empleada solo puede continuar sus propios partes
- se evita la mezcla de tiempos entre usuarias
- el control de sesiones queda aislado por usuario

Este bug queda considerado RESUELTO.


------------------------------------------------------------
33. REDISEÑO FLUJO — CAMBIO DE HUÉSPEDES (2026-03-09)
------------------------------------------------------------

Se rediseñó el flujo de Cambio de huéspedes para simplificar la operativa
real de limpieza.

Flujo final:

- Pantalla 1: suciedad inicial (1–5)
- Pantalla 2: checklist por casa
- Pantalla 3: fotos
- Pantalla 4: cierre

Se eliminó la antigua pantalla específica de incidencias al inicio,
porque la incidencia pasa a registrarse mediante botón global en
cualquier momento del flujo.

El checklist se definió como lista de tareas mínimas por casa y por
temporada. Solo aparecen las tareas que realmente aplican según la
configuración activa.

En cierre:

- se mantiene Casa lista: Sí / No
- se eliminó la caja “¿Qué falta para estar lista?”
- observaciones sigue siendo opcional
- el texto de ayuda en observaciones incluye también objetos perdidos

Resultado:

- menos pasos
- menos fricción para limpiadoras
- checklist más útil para operaciones
- flujo más claro y rápido

Este rediseño queda considerado APLICADO.


------------------------------------------------------------
34. RESOLUCIÓN BUG CIERRE — CASA NO LISTA (2026-03-09)
------------------------------------------------------------

Se detectó un bug en la pantalla final de cierre.

Síntoma observado:

- cuando la casa se marcaba como No lista
- el parte podía quedar bloqueado por una validación residual ligada a un
  campo de texto ya eliminado

Causa:

Quedaba lógica antigua intentando leer el campo “¿Qué falta para estar
lista?” después de haber simplificado la pantalla de cierre.

Solución aplicada:

- se eliminó la validación residual
- el parte puede enviarse tanto si la casa está lista como si no
- al marcar No lista se muestra solo un aviso visual recomendando usar
  observaciones para añadir contexto, sin hacerlo obligatorio

Resultado:

- Sí lista → envío correcto
- No lista → envío correcto
- sin seleccionar estado final → sigue bloqueando con validación normal

Este bug queda considerado RESUELTO.


------------------------------------------------------------
35. MEJORAS TELEGRAM — RESUMEN DE PARTE CERRADO (2026-03-09)
------------------------------------------------------------

Se mejoró el formato del mensaje final enviado por Telegram.

Mejoras aplicadas:

- tipo de parte en formato legible (ej.: Cambio de huéspedes)
- duración en formato humano (ej.: 47 min, 1 h 12 min)
- checklist incompleto mostrado con etiquetas legibles
- consumibles mostrados con emoji aproximado según el producto
- si no hay fotos, se informa como “Sin fotos”
- enlace directo a la carpeta de fotos en Google Drive

Resultado:

El mensaje final es más útil para operaciones y más fácil de leer desde
Telegram.

Esta mejora queda considerada APLICADA.

------------------------------------------------------------
36. AJUSTE UX — REANUDAR CAMBIO DE HUÉSPEDES DESDE CHECKLIST (2026-03-09)
------------------------------------------------------------

Se ajustó el comportamiento al reanudar un parte de Cambio de huéspedes.

Regla aplicada:

- la pantalla de suciedad solo se muestra al iniciar el parte por primera vez
- una vez guardada la suciedad y comenzada la limpieza, ese dato se
  reutiliza al reanudar
- si el usuario hace logout/login y vuelve al parte, entra directamente en
  la pantalla de checklist

Resultado:

- se evita repetir una pantalla ya superada
- la reanudación resulta más rápida y natural para la limpiadora

Este ajuste queda considerado APLICADO.


------------------------------------------------------------
37. MODO PRUEBA ADMIN — CAMBIO DE HUÉSPEDES SIN FOTOS (2026-03-09)
------------------------------------------------------------

Se añadió una excepción controlada para usuarios admin en el flujo de
Cambio de huéspedes.

Regla aplicada:

- usuarios normales: las fotos siguen siendo obligatorias
- usuarios admin: pueden continuar sin fotos para realizar pruebas del
  flujo completo y del resumen de Telegram

La excepción se aplica solo en la pantalla de fotos del flujo de Cambio de
huéspedes y muestra un aviso visual de modo prueba.

Resultado:

- se pueden hacer pruebas completas sin necesidad de subir fotos
- no afecta al comportamiento normal de limpiadoras

Esta mejora queda considerada APLICADA.


------------------------------------------------------------
38. IMPLEMENTACIÓN SISTEMA — TAREAS PERIÓDICAS (2026-03-09)
------------------------------------------------------------

Se implementa el sistema de Tareas periódicas dentro del flujo de Cambio
de huéspedes.

Arquitectura aplicada:

- nueva ruta backend GET /api/tareas-periodicas?casa=X
- nueva hoja TareasPeriodicas
- nueva hoja TareasPeriodicasLog
- nuevo campo tareas_periodicas_json en PartesLimpieza
- integración en checklist de Cambio de huéspedes
- integración en Telegram con detalle completo de tareas mostradas

Regla funcional:

- la sección solo aparece si para esa casa existen tareas activas cuya
  próxima realización ya venció o está vacía
- las tareas se muestran con checkbox independiente
- no bloquean el cierre del parte
- al cerrar, cada tarea mostrada queda registrada en log
- si se marca como hecha, se recalcula su próxima fecha

Telegram:

El resumen final muestra todas las tareas periódicas del parte con este
formato:

- ✅ tarea realizada
- ❌ tarea no realizada

Resultado:

- mejora del control operativo de mantenimiento
- trazabilidad de tareas periódicas por casa
- integración completa con flujo actual sin añadir pantallas nuevas

Esta mejora queda considerada APLICADA.

------------------------------------------------------------
39. PANEL ADMIN — TAREAS PERIÓDICAS (2026-03-10)
------------------------------------------------------------

Se implementa el panel admin para gestión completa del sistema de
Tareas periódicas.

Funciones disponibles para admin:

- listar todas las tareas periódicas
- filtrar por casa
- ver estado visual de cada tarea:
  - 🔴 vencida
  - 🟡 próxima
  - 🟢 al día
- crear tarea nueva
- editar tarea existente
- activar / desactivar tarea
- marcar tarea como hecha manualmente
- consultar histórico de ejecuciones

Arquitectura aplicada:

Backend:
- nuevas rutas en admin.js para listado, creación, edición, marcado manual
  y consulta de log
- uso de esquema fijo TP_COLS para evitar desalineaciones en Google Sheets
- validación mínima en creación de tarea
- al marcar “hecha hoy” se actualiza:
  ultima_realizacion_ts
  proxima_realizacion_ts
  ultima_realizacion_user
  ultima_realizacion_parte_id = ADMIN-MANUAL
- además se crea fila en TareasPeriodicasLog

Frontend:
- nueva pestaña admin:
  🛠️ Tareas
- tabla de tareas con acciones:
  editar
  hecha hoy
  activa / inactiva
- modal de creación y edición
- vista de histórico integrada

Validación funcional realizada:

- crear tarea → correcto
- editar tarea → correcto
- activar / desactivar → correcto
- marcar hecha hoy → correcto
- actualización de próxima fecha → correcta
- escritura en TareasPeriodicasLog → correcta
- histórico visible en panel admin → correcto

Resultado:

- gestión centralizada de mantenimiento periódico
- control manual desde admin sin depender del flujo de limpiadoras
- trazabilidad completa de cambios y ejecuciones

Esta mejora queda considerada APLICADA.


------------------------------------------------------------
40. CIERRE DEUDA TÉCNICA — ENTORNO LOCAL 3000 VS 4173 (2026-03-10)
------------------------------------------------------------

Se cierra la deuda técnica del entorno local de desarrollo que generaba
confusión entre el frontend servido desde 3000 y el frontend servido
aparte en 4173.

Diagnóstico:

- el backend en 3000 sirve API y también frontend estático mediante
  express.static
- el frontend servido aparte en 4173 reflejaba mejor los cambios de
  interfaz durante desarrollo
- trabajar indistintamente en 3000 y 4173 provocaba diferencias visibles
  y pérdida de tiempo en validación de cambios

Solución aplicada:

- se fija como convención oficial de desarrollo:
  - backend/API en http://localhost:3000
  - frontend en http://localhost:4173
- se mantiene el backend sirviendo frontend estático, pero no como vía
  principal de desarrollo de interfaz
- frontend/js/api.js usa BASE dinámico según puerto:
  - si se abre en 3000, usa rutas relativas
  - si se abre en 4173, apunta a http://localhost:3000

Configuración oficial de trabajo local:

- Terminal A:
  cd backend && npm run dev
- Terminal B:
  cd frontend && npx serve . -p 4173
- URL oficial de trabajo:
  http://localhost:4173

Resultado:

- entorno local más estable y predecible
- menos confusión entre versiones visibles del frontend
- separación clara entre frontend de desarrollo y backend/API

Esta deuda técnica queda considerada CERRADA.


------------------------------------------------------------
41. RESOLUCIÓN BUG LOGIN MÓVIL — IP LOCAL VS LOCALHOST (2026-03-10)
------------------------------------------------------------

Se resolvió un bug bloqueante de login en móvil, especialmente visible en
iPhone al acceder a la app desde la IP local del Mac dentro de la misma
red Wi‑Fi.

Síntoma observado:

- en iPhone la pantalla PIN se mostraba correctamente
- al introducir las 4 cifras parecía que intentaba entrar
- los dígitos se limpiaban, pero la app no avanzaba
- en escritorio sí funcionaba

Causa raíz:

frontend/js/api.js utilizaba BASE con localhost hardcodeado para los
casos fuera de puerto 3000.

Esto provocaba que, al abrir la app desde una URL tipo:

http://192.168.x.x

el móvil intentara llamar a:

http://localhost:3000

pero en el iPhone localhost apunta al propio iPhone, no al Mac.

Resultado:

- las peticiones API fallaban antes de llegar al backend
- el login no podía completarse en móvil por red local

Solución aplicada:

Se cambió la construcción de BASE para usar el hostname real del
navegador cuando no se trabaja directamente en puerto 3000.

Regla final:

- si la app se abre en 3000 → rutas relativas
- si la app se abre en 4173 o por IP local → API al mismo hostname en
  puerto 3000

Resultado:

- el login móvil vuelve a funcionar correctamente
- la app puede abrirse desde iPhone usando la IP local del Mac
- queda resuelto el acceso por red local durante pruebas reales en móvil

Esta resolución queda considerada APLICADA.

------------------------------------------------------------
42. SIMPLIFICACIÓN SELECTOR — NUEVO PARTE (2026-03-10)
------------------------------------------------------------

Se simplifica la primera pantalla de “Nuevo parte” para reducir ruido y
alinearla con el flujo real de trabajo.

Cambios aplicados:

- se eliminan del selector las opciones:
  - Limpieza profunda
  - Post-incidencia
- se mantienen solo:
  - Cambio de huéspedes
  - Revisión rápida
  - Añadir consumibles
- la opción “Añadir consumibles” pasa a ser acceso directo operativo
- el tipo de parte seleccionado queda marcado visualmente con el mismo
  comportamiento que la selección de casa

Motivo:

- Limpieza profunda queda absorbida dentro de Cambio de huéspedes /
  Tareas periódicas
- Post-incidencia deja de ser necesaria como acceso separado porque las
  incidencias ya pueden registrarse desde los flujos mediante botón global

Resultado:

- pantalla inicial más clara
- menos opciones irrelevantes
- selección de tipo más evidente en móvil

Este cambio queda considerado APLICADO.


------------------------------------------------------------
43. MEJORAS UX MÓVIL — QUICK WINS (2026-03-10)
------------------------------------------------------------

Se aplican varias mejoras pequeñas de usabilidad móvil en el flujo de
limpiadora para reducir fricción y errores.

Cambios aplicados:

- en Cierre, el botón “Enviar parte” queda desactivado hasta elegir
  “Casa lista: Sí / No”
- en Observaciones, al hacer focus se aplica scrollIntoView para evitar
  que el teclado tape el campo en móvil
- en Cierre, se aumenta el tamaño táctil de checkboxes de consumibles y
  se mejora ligeramente el select de urgencia
- en Checklist, se mejora la zona pulsable de Tareas periódicas
- en Fotos, se añade contador global de fotos visibles en pantalla
- en Éxito, el botón “Salir” deja de mostrarse con estilo de acción
  destructiva

Resultado:

- menos errores al cerrar parte
- mejor uso en móvil con teclado abierto
- consumibles más cómodos de marcar
- mayor claridad en la pantalla de fotos
- cierre visual más coherente en la pantalla de éxito

Estas mejoras quedan consideradas APLICADAS.

------------------------------------------------------------
44. MEJORA UX — BORRADO INDIVIDUAL DE FOTOS (2026-03-10)
------------------------------------------------------------

Se mejora la pantalla de Fotos del flujo de Cambio de huéspedes para
permitir eliminar imágenes ya añadidas antes de continuar.

Problema previo:

- si una foto salía mal o se añadía por error
- no existía forma de eliminarla
- solo se podían seguir añadiendo más fotos
- esto obligaba a continuar con imágenes incorrectas o repetir el flujo

Solución aplicada:

- cada miniatura de foto incorpora un botón de borrado individual
- al pulsarlo, se elimina solo esa foto del slot correspondiente
- se actualiza el contador por slot
- se actualiza el contador global de fotos
- si al borrar una foto un slot deja de cumplir el mínimo requerido,
  el botón “Continuar” vuelve a desactivarse

Resultado:

- flujo más tolerante a errores
- menos frustración al tomar fotos
- mayor control en móvil durante la limpieza

Esta mejora queda considerada APLICADA.

------------------------------------------------------------
45. AJUSTE UX — ELIMINACIÓN DE BIENVENIDA FLOTANTE DUPLICADA (2026-03-10)
------------------------------------------------------------

Se elimina la bienvenida flotante que aparecía tras el login y se
duplicaba con el saludo integrado en la pantalla de selección.

Problema previo:

- tras hacer login correcto se mostraba un toast flotante:
  “✅ Bienvenid@, [nombre] 👋”
- en la pantalla siguiente ya existía un saludo integrado:
  “👋 Hola, [nombre]”
- el resultado era una duplicidad visual y el bloque flotante se montaba
  sobre el header, ensuciando la interfaz

Solución aplicada:

- se elimina el toast de bienvenida en login.js
- se mantiene únicamente el saludo integrado dentro del contenido de la
  pantalla de selector

Resultado:

- desaparece la cápsula flotante sobre el header
- solo queda una bienvenida, más limpia e integrada
- la navegación tras login queda visualmente más clara

Este ajuste queda considerado APLICADO.

------------------------------------------------------------
46. CORRECCIÓN VISUAL — SELECTOR DE TIPO IGUAL QUE SELECTOR DE CASA (2026-03-10)
------------------------------------------------------------

Se corrige la selección visual del tipo de parte en la pantalla
“Nuevo parte” para que use exactamente el mismo estilo que la selección
de casa.

Problema previo:

- la casa seleccionada mostraba claramente su estado visual
- el tipo de parte no replicaba bien ese mismo comportamiento
- el usuario no percibía ambas selecciones con la misma consistencia

Causa técnica:

- el selector de tipo mantenía estilos inline que interferían con la
  clase visual de seleccionado
- además el estado base de .tipo-row no usaba exactamente el mismo fondo
  que .piso-card

Solución aplicada:

- se eliminan estilos inline del tipo de parte que interferían con el
  borde visual
- el estado base de .tipo-row se alinea con .piso-card
- la selección y deselección se gestiona por clases CSS, igual que en
  las casas
- el tipo seleccionado pasa a mostrar exactamente el mismo borde, fondo
  y comportamiento visual que una casa seleccionada

Resultado:

- selector de casa y selector de tipo quedan visualmente consistentes
- la elección del tipo es más evidente en móvil
- se elimina la incoherencia de estilos entre ambos bloques

Esta corrección queda considerada APLICADA.

------------------------------------------------------------

------------------------------------------------------------
47. REDISEÑO UX — PANTALLA DE PARTES ABIERTOS POST-PIN (2026-03-10)
------------------------------------------------------------

Se rediseña la pantalla que aparece justo después del PIN cuando el
usuario tiene al menos un parte abierto o pausado.

Objetivo:

convertir una pantalla técnica de estado en una pantalla de acción clara
y sencilla para empleadas.

Cambios aplicados:

- si existe al menos un parte abierto o pausado, esta pantalla aparece
  directamente después del PIN
- nueva cabecera: "Estos son tus partes abiertos" · "Vamos a seguir"
- se muestran tarjetas por casa con casa, tipo, tiempo y estado visual
- el estado se representa de forma destacada: En marcha / En pausa
- las acciones se centran en lo que el usuario quiere hacer
- en contexto Sabayés, la app pausa o reanuda automáticamente
- "Añadir consumibles" queda como acción secundaria fija al final

Resultado:

- menos pantallas bloqueantes
- flujo mucho más claro para empleadas

Este rediseño queda considerado APLICADO.


------------------------------------------------------------
48. AJUSTE DE NAVEGACIÓN — REGLA GLOBAL DE SALIR (2026-03-10)
------------------------------------------------------------

Se redefine la navegación del botón "Salir" para reducir el uso
innecesario del PIN y hacer el flujo más natural para las empleadas.

Nueva regla aplicada:

- desde la pantalla de partes abiertos o el selector: Salir implica PIN
- desde cualquier parte del flujo o pantalla de éxito: no hay logout real
  - si quedan partes abiertos o pausados → pantalla de partes abiertos
  - si no queda ninguno → selector

Resultado:

- menos fricción y menor dependencia del PIN en operativa diaria

Este ajuste queda considerado APLICADO.


------------------------------------------------------------
49. AJUSTES UX — FLUJO DE REVISIÓN (2026-03-10)
------------------------------------------------------------

Se aplican varios ajustes de claridad en el flujo de Revisión.

Cambios aplicados:

- la cabecera usa: "Revisión · [CASA]"
- se elimina el bloque de chips de tareas realizadas
- el botón final pasa a llamarse "Enviar y cerrar parte"

Este ajuste queda considerado APLICADO.


------------------------------------------------------------
50. SIMPLIFICACIÓN FLUJO REVISIÓN — ELIMINACIÓN DE PANTALLA INTERMEDIA (2026-03-10)
------------------------------------------------------------

Se elimina la pantalla intermedia de confirmación del flujo de Revisión
para reducir un paso innecesario.

Flujo nuevo:

P1 → P2 → "Enviar y cerrar parte" → exito

Este cambio queda considerado APLICADO.


------------------------------------------------------------
51. REFINO UX — DASHBOARD ADMIN CON ACCESOS RAPIDOS Y BLOQUE "AHORA MISMO" (2026-03-11)
------------------------------------------------------------

Se aplica una mejora incremental al dashboard admin para hacerlo más
útil en móvil y más fácil de revisar de un vistazo.

Cambios aplicados:

- cabecera del admin más limpia y compacta
- accesos rápidos en grid en la parte alta del dashboard:
  Incidencias, Sin cerrar, Consumibles, Propuestas, Tareas
- Usuarios y QR quedan como navegación secundaria en la barra superior
- bloque "Ahora mismo" con máximo 3 alertas accionables:
  partes sin cerrar, incidencias urgentes, consumibles pendientes
- si no hay alertas: "Todo controlado por ahora"

Resultado:

- dashboard más claro, menos ruido visual, accesos importantes arriba

Este ajuste queda considerado APLICADO.


------------------------------------------------------------
52. MEJORA UX — BLOQUE "ESTADO POR CASA" EN DASHBOARD ADMIN (2026-03-11)
------------------------------------------------------------

Se sustituye el antiguo bloque "Por alojamiento" por un bloque más
claro y accionable llamado "Estado por casa".

Cambios aplicados:

- 3 tarjetas: MIRADOR, CASON, GRATAL
- cada tarjeta muestra nombre, estado principal y motivo principal
- jerarquía de gravedad diferenciada:
  - Urgente: incidencias urgentes
  - Atención: incidencias abiertas o partes sin cerrar
  - Aviso: consumibles pendientes (azul suave, menos peso visual)
  - OK: sin alertas
- separación visual entre estado y motivo
- navegación directa a la sección correspondiente

Resultado:

- lectura rápida del estado operativo por casa
- mejor jerarquía entre problemas graves y avisos menores

Este ajuste queda considerado APLICADO.

------------------------------------------------------------


------------------------------------------------------------
53. REFINO UX — RESUMEN DEL DIA Y TARJETA DE COSTES EN DASHBOARD ADMIN (2026-03-11)
------------------------------------------------------------

Se simplifica el bloque principal de KPIs del dashboard admin y se
separa el análisis de costes en una tarjeta propia más clara.

Cambios aplicados:

- el resumen principal del día pasa a mostrar solo:
  - Partes hoy
  - Pendientes
  - Urgentes
- se eliminan del bloque principal:
  - Min. medio
  - Consumibles
  - Coste hoy
- se añade una tarjeta específica de costes con:
  - coste acumulado del mes actual
  - referencia temporal desde el día 1 del mes
  - acceso directo a una vista propia de costes
- se añade una sección/tab específica de Costes
- esta nueva vista permite consultar el coste con más detalle sin
  recargar el dashboard principal

Resultado:

- dashboard más limpio y más fácil de leer
- mejor separación entre operativa diaria y análisis económico
- el coste deja de competir visualmente con incidencias y pendientes
- el panel admin gana claridad para revisión diaria

Este ajuste queda considerado APLICADO.

------------------------------------------------------------


------------------------------------------------------------
54. REFINO VISUAL — BARRA SUPERIOR DEL ADMIN COMO NAVEGACION SECUNDARIA (2026-03-11)
------------------------------------------------------------

Se reduce el peso visual de la barra superior de navegación del admin
para que deje de competir con el dashboard principal.

Objetivo:

mantener una navegación de respaldo segura, pero sin que robe
protagonismo a los accesos rápidos, al bloque "Ahora mismo" y al resto
del dashboard.

Cambios aplicados:

- la barra superior del admin se mantiene funcional
- se reduce su protagonismo visual mediante ajustes de estilo
- disminuyen:
  - opacidad
  - padding
  - tamaño de fuente
  - presencia del borde inferior
- el estado activo deja de destacar como botón protagonista y pasa a una
  señal más discreta
- la barra queda como navegación secundaria / fallback

Resultado:

- menos duplicidad visual
- más claridad en la parte superior del admin
- el dashboard principal gana protagonismo
- la navegación sigue disponible sin estorbar

Este ajuste queda considerado APLICADO.

------------------------------------------------------------


------------------------------------------------------------
55. MEJORA FUNCIONAL — SECCION "COSTES LIMPIEZA" EN PANEL ADMIN (2026-03-11)
------------------------------------------------------------

Se amplía y ordena la sección "Costes limpieza" del panel admin para
hacerla realmente útil en la gestión diaria.

Cambios aplicados:

- la antigua visualización de costes se reorganiza como sección propia
  más clara
- el bloque superior pasa a mostrar:
  - coste de esta semana
  - coste de este mes
  - coste de este año
  - horas del mes
- se elimina la métrica "medio por parte" por no aportar valor operativo
- en "Por casa" se reorganizan los datos en un formato más claro y
  comparable, mostrando por cada casa:
  - Semana
  - Mes
  - Año
- en "Por persona" se muestran:
  - coste del mes
  - horas del mes
- se elimina el contador de partes no fiable de esa vista
- la vista personal de cada persona pasa a mostrar:
  - coste del mes
  - horas del mes
  - y la lista real de partes del mes cuando aplica

Resultado:

- la sección de costes deja de ser un apunte secundario
- mejora la lectura comparativa por casa
- mejora el control de costes por persona
- el panel admin gana una vista económica más útil y ordenada

Este ajuste queda considerado APLICADO.

------------------------------------------------------------
56. MEJORA UX — NAVEGACION MENSUAL EN VISTAS DE COSTES POR PERSONA Y POR CASA (2026-03-11)
------------------------------------------------------------

Se añade navegación mensual en las vistas de detalle de la sección
"Costes limpieza", tanto por persona como por casa.

Objetivo:

permitir revisar partes y costes de meses anteriores de forma cómoda en
móvil, sin usar buscadores manuales de mes/año.

Cambios aplicados:

- se añade una barra de navegación mensual en:
  - vista por persona
  - vista por casa
- formato de navegación:
  - flecha izquierda
  - mes y año visibles en el centro
  - flecha derecha
- el mes actual se usa por defecto al entrar
- al cambiar de mes:
  - se actualizan los KPI de coste/horas de la vista
  - se recarga la lista de partes correspondiente a ese mes
- la flecha de mes siguiente queda desactivada cuando la vista ya está en
  el mes actual
- se mantiene el mismo layout general de las vistas, añadiendo solo esta
  capa de navegación temporal

Implementación:

- la vista reutiliza la misma fuente de datos ya existente
- el filtro mensual pasa a depender del mes seleccionado
- se amplía el límite de carga de partes para cubrir mejor meses
  históricos cuando hace falta

Resultado:

- consulta mucho más cómoda de partes y costes por mes
- mejor revisión histórica por persona y por casa
- navegación más natural en móvil
- mejora clara de la utilidad real de la sección "Costes limpieza"

Este ajuste queda considerado APLICADO.

------------------------------------------------------------
58. MEJORA OPERATIVA — CAMBIO MANUAL DE PRIORIDAD EN ADMIN (2026-03-11)
------------------------------------------------------------

Se añade la posibilidad de cambiar manualmente la prioridad desde el
panel admin tanto en incidencias como en consumibles.

Objetivo:

permitir a Andrés o María corregir rápidamente la prioridad cuando una
limpiadora marca algo como normal pero en realidad debe tratarse como
urgente, o al revés.

Cambios aplicados:

- en admin, incidencias y consumibles pasan a mostrar un control inline
  de prioridad con 2 estados:
  - Normal
  - Urgente
- el cambio se guarda de verdad en backend
- en incidencias se actualiza el campo de prioridad
- en consumibles se actualiza el campo de urgencia
- la UI queda alineada con la lógica simplificada de prioridades de la
  app
- la operativa nueva queda reducida a:
  - Normal → amarillo
  - Urgente → rojo

Resultado:

- mayor control manual desde admin
- menos dependencia de cómo lo haya marcado la limpiadora
- prioridades más coherentes con badges, KPIs y listados

Este ajuste queda considerado APLICADO.


------------------------------------------------------------
59. FASE 1 — EDICIÓN ADMIN DE PARTES Y CIERRE RESPETANDO PAUSAS (2026-03-11)
------------------------------------------------------------

Se implementa la primera fase de edición admin de partes para corregir
cierres olvidados y tiempos erróneos sin romper la lógica de pausas.

Objetivo:

permitir a admin corregir horas y tiempo efectivo de forma segura,
manteniendo auditoría y preservando las pausas ya registradas.

Cambios aplicados:

- se corrige el bug crítico por el que admin usaba una construcción de
  fila antigua incompatible con la estructura real del Sheet
- admin pasa a usar la misma estructura completa de columnas del sistema
  actual
- en “Sin cerrar” se añade un campo de hora fin real
- el cierre admin de un parte abierto deja de recalcular a bruto y pasa a
  respetar pausas/sesiones ya registradas
- se añade ajuste manual de tiempo efectivo con motivo obligatorio
- se mantiene auditoría administrativa:
  - admin_editado
  - admin_editado_por
  - admin_editado_ts
  - admin_edit_motivo
  - inicio_ts_original
  - fin_ts_original
- en la sección “Partes” los últimos 30 partes dejan de ser solo
  visuales y pasan a abrir una vista de detalle/edición
- el modal de edición admin se ajusta para móvil:
  - mejor layout
  - recálculo automático del tiempo efectivo al cambiar horas
  - guardado corregido
- la validación del backend permite una corrección razonable de hora fin
  hacia delante sin bloquear falsamente la edición admin

Resultado:

- ya se pueden corregir cierres olvidados de forma mucho más segura
- la edición admin de horas deja de ser una operación rota o peligrosa
- se preserva mejor el tiempo real trabajado cuando hubo pausas
- la operativa admin gana una herramienta útil para correcciones reales

Este ajuste queda considerado APLICADO.


------------------------------------------------------------
60. ESTABILIZACIÓN TÉCNICA — ARRANQUE DEL BACKEND Y CARGA DIFERIDA DE SERVICIOS (2026-03-11)
------------------------------------------------------------

Se corrigen varios puntos técnicos que estaban provocando bloqueos
intermitentes o silenciosos en el arranque del backend.

Objetivo:

asegurar que el servidor arranque correctamente sin quedarse colgado
durante la carga de rutas, scheduler o servicios externos.

Cambios aplicados:

- se revisa y corrige el arranque del scheduler para evitar bloqueos al
  importar módulos en top-level
- se eliminan dependencias cruzadas innecesarias entre rutas que podían
  agravar el bloqueo del backend
- se aplica lazy-load a módulos pesados relacionados con Google APIs para
  evitar que bloqueen el arranque al importarse
- se añaden y utilizan logs de arranque para localizar puntos exactos de
  bloqueo durante el diagnóstico
- tras la corrección, el backend vuelve a alcanzar correctamente el
  listen y arranca en local con normalidad

Resultado:

- backend más estable al arrancar
- menos riesgo de bloqueos silenciosos antes de listen
- mejor aislamiento entre rutas y servicios
- base más fiable para probar y desplegar la app

Este ajuste queda considerado APLICADO.


------------------------------------------------------------
61. ROBUSTEZ DE PERSISTENCIA — INCIDENCIAS Y CONSUMIBLES CON BUILDERS SEGUROS (2026-03-11)
------------------------------------------------------------

Se refuerza la escritura y actualización de incidencias y consumibles en
Google Sheets para evitar desalineaciones de columnas en el futuro.

Objetivo:

dejar de depender de arrays crudos por posición y adoptar el mismo
enfoque robusto ya aplicado en Partes.

Cambios aplicados:

- se crea buildIncidenciaRow() para mapear de forma explícita las
  columnas de IncidenciasMantenimiento
- se usa buildIncidenciaRow() tanto en POST como en PATCH
- se crea buildConsumoRow() para mapear de forma explícita las columnas
  de Consumibles
- se usa buildConsumoRow() tanto en POST como en PATCH
- se elimina el riesgo de escritura insegura por posición cruda en esas
  dos áreas del sistema

Resultado:

- menor riesgo de corrupción silenciosa de datos en Sheets
- persistencia más segura y mantenible
- coherencia técnica con el patrón robusto ya aplicado en Partes

Este ajuste queda considerado APLICADO.


------------------------------------------------------------
62. AJUSTE FINAL — PRIORIDADES OPERATIVAS UNIFICADAS Y FORMULARIOS COHERENTES (2026-03-11)
------------------------------------------------------------

Se completa la simplificación de prioridades de la app para que toda la
operativa trabaje únicamente con dos niveles consistentes.

Objetivo:

unificar formularios, backend, badges, KPIs y admin bajo la misma lógica
de prioridad simple.

Cambios aplicados:

- incidencias quedan limitadas a:
  - Normal
  - Urgente
- consumibles quedan limitados a:
  - Normal
  - Urgente
- los valores por defecto backend se corrigen a Normal
- el formulario de añadir incidencia vuelve a mostrar un selector visible
  de prioridad
- el envío a Telegram de incidencias pasa a usar la prioridad ya
  normalizada
- se elimina la persistencia de defaults antiguos como Baja o Media en la
  operativa nueva

Resultado:

- prioridades más claras para empleadas y admins
- menos ambigüedad en formularios y paneles
- mejor coherencia de negocio en toda la app

Este ajuste queda considerado APLICADO.


------------------------------------------------------------
63. CORRECCIÓN DE PRODUCCIÓN — API FRONTEND POR RUTA RELATIVA TRAS NGINX (2026-03-11)
------------------------------------------------------------

Se corrige un fallo de producción por el que el frontend intentaba
llamar a la API usando directamente el puerto 3001 en lugar de usar la
ruta relativa bajo el dominio público.

Objetivo:

hacer que el frontend funcione correctamente detrás de Nginx y HTTPS,
evitando llamadas mixtas o directas al puerto interno del backend.

Cambios aplicados:

- se corrige frontend/js/api.js
- en entorno local:
  - la app sigue usando http://localhost:3001
- en producción:
  - la app usa ruta relativa
  - y deja que Nginx resuelva /api hacia 127.0.0.1:3001
- se elimina la lógica incorrecta que construía BASE usando el hostname
  público con :3001
- esta corrección resulta clave para que el login vuelva a funcionar
  correctamente en producción

Resultado:

- el login y las llamadas autenticadas vuelven a funcionar correctamente
  en producción
- el frontend queda alineado con el proxy Nginx
- se evita el uso incorrecto de http://dominio:3001 en entorno real

Este ajuste queda considerado APLICADO.


------------------------------------------------------------
64. DESPLIEGUE Y REGULARIZACIÓN DE PRODUCCIÓN — PM2, PROXY Y PROCESO ACTIVO (2026-03-11)
------------------------------------------------------------

Se regulariza el estado real del despliegue en producción tras detectar
que el backend activo no estaba siendo servido por el proceso correcto.

Objetivo:

dejar producción con el backend correcto activo, gestionado por PM2 y
alineado con Nginx.

Cambios aplicados:

- se detecta y elimina un proceso antiguo de Node corriendo fuera de PM2
  y ocupando el puerto 3001
- se arranca la versión correcta del backend bajo PM2 con el usuario
  andres
- se confirma que Nginx apunta correctamente a 127.0.0.1:3001
- se añade trust proxy en server.js para alinear mejor la sesión segura
  detrás de proxy HTTPS
- se verifica que el login backend, la cookie segura y las rutas
  autenticadas funcionan correctamente en producción
- se deja el backend gestionado de forma consistente por PM2 y no por un
  proceso manual antiguo

Resultado:

- despliegue de producción regularizado
- menor riesgo de servir mezcla de frontend nuevo con backend viejo
- infraestructura más clara y mantenible
- base más estable para siguientes despliegues

Este ajuste queda considerado APLICADO.

------------------------------------------------------------
65. CORRECCIÓN DE PRODUCCIÓN — DRIVE OAUTH RESTAURADO PARA ENVÍO DE INCIDENCIAS (2026-03-14)
------------------------------------------------------------

Se corrige el fallo de producción que impedía enviar incidencias con
fotos por error de autenticación contra Google Drive.

Objetivo:

restaurar la subida de archivos de incidencias a Drive sin bloquear la
operativa real de la app.

Problema detectado:

- el backend devolvía errores de OAuth al subir archivos a Drive
- primero apareció invalid_grant
- después unauthorized_client
- se comprobó que el refresh token anterior estaba caducado o revocado
- también se descartó:
  - desfase horario del VPS
  - problema de Nginx
  - problema general del backend
- se probó temporalmente la vía de Service Account para Drive, pero no
  resultó válida para este caso por las limitaciones de cuota /
  almacenamiento sobre carpetas normales de My Drive

Resolución aplicada:

- se restauró drive.js a la versión basada en OAuth de usuario
- se regeneró el flujo de autorización de Google Drive
- el cliente OAuth que terminó funcionando correctamente fue el cliente
  de tipo Escritorio
- se obtuvo un nuevo refresh token válido
- se actualizaron en producción estas variables:
  - GOOGLE_OAUTH_CLIENT_ID
  - GOOGLE_OAUTH_CLIENT_SECRET
  - GOOGLE_OAUTH_REFRESH_TOKEN
- se reinició PM2 y se verificó que el envío de incidencias con foto
  volvía a funcionar correctamente

Resultado:

- las incidencias vuelven a enviarse correctamente con subida a Drive
- queda descartada la solución provisional basada en Service Account
  para este flujo concreto
- Drive queda funcionando de nuevo mediante OAuth

Notas operativas aplicadas:

- se vaciaron los scripts temporales usados para generar tokens en local
- queda pendiente (para el administrador) revisar y limpiar secretos
  antiguos ya no usados en Google Cloud

Este ajuste queda considerado APLICADO.

------------------------------------------------------------
FIN DEL RESUMEN MAESTRO
------------------------------------------------------------
