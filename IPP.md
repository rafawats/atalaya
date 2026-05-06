# Atalaya — Plan de Iteraciones (IPP)

**Versión:** 0.1
**Fecha:** 2026-05-06
**Estado:** Borrador
**Documentos relacionados:** `SRS.md` (requisitos), `SDD.md` (diseño)

---

## 1. Introducción

### 1.1 Propósito

Este documento define el plan de iteraciones para la construcción del MVP de Atalaya. Su objetivo es secuenciar el trabajo de implementación de forma que cada iteración produzca un incremento coherente, verificable y entregable, reduciendo el riesgo de integración tardía.

### 1.2 Enfoque

Se adopta un enfoque de **vertical slicing**: cada iteración (a partir de la 1) entrega una porción funcional que atraviesa todas las capas del sistema (muestreador → bus → persistencia → API/WS → frontend), en lugar de construir capa por capa.

La **Iteración 0** funciona como un *spike* inicial centrado en validar la viabilidad del empaquetado multiplataforma con PyInstaller, considerado el riesgo técnico más alto del proyecto.

### 1.3 Criterio de cierre de iteraciones

Las iteraciones se planean **por alcance, no por tiempo**. Una iteración se considera completa cuando todos sus criterios de aceptación se cumplen. No hay duración fija.

### 1.4 Reglas transversales (aplican a todas las iteraciones)

Estas reglas se asumen vigentes en cada iteración y no se repiten en los criterios:

- El código nuevo debe ir acompañado de tests automatizados de la lógica relevante.
- Los linters y formateadores configurados deben pasar sin errores.
- Los lockfiles (`uv.lock`, `package-lock.json`) deben mantenerse actualizados.
- El CI debe seguir verde tras cada iteración.
- Cualquier decisión técnica significativa que surja durante la iteración debe registrarse como ADR en el `SDD.md`.

---

## 2. Resumen de iteraciones

| ID | Nombre | Foco principal |
|----|--------|----------------|
| IT-0 | Cimientos | Setup del repo, esqueleto end-to-end y validación de empaquetado. |
| IT-1 | CPU end-to-end | Primera métrica funcional desde muestreo hasta gráfica en tiempo real. |
| IT-2 | RAM | Extender el sistema con métricas de memoria. |
| IT-3 | Disco | Añadir métricas de disco con su dimensión de particiones. |
| IT-4 | Histórico y agregación | Tablas agregadas, agregador periódico, endpoints de histórico y selector de rango en UI. |
| IT-5 | Pulido y release del MVP | Manejo robusto de errores, documentación y publicación del primer release. |

---

## 3. Iteración 0 — Cimientos

### 3.1 Objetivo

Establecer la infraestructura del proyecto y validar tempranamente que el modelo de distribución (binario único con frontend embebido) es viable en los tres sistemas operativos objetivo.

### 3.2 Alcance

**Backend:**
- Estructura inicial del proyecto Python con `uv` y `uv.lock`.
- FastAPI con un único endpoint: `GET /api/health` (responde `{"status": "ok"}`).
- Configuración base: escucha en `127.0.0.1` en un puerto configurable.
- Suite de tests vacía pero ejecutable (pytest).
- Configuración de linter/formateador (ruff).

**Frontend:**
- Estructura inicial del proyecto Svelte con Vite y `package-lock.json`.
- Una sola vista: pantalla de bienvenida con el texto "Atalaya".
- Configuración del proxy de Vite hacia el backend para desarrollo.
- Configuración de prettier.

**Integración:**
- El backend sirve el bundle del frontend desde el mismo proceso y puerto.
- Estructura de carpetas final del repo (definida en este IPP, no rehecha en cada iteración).

**Empaquetado y CI:**
- Script local que construye el frontend, lo embebe en el backend y genera un binario con PyInstaller.
- Workflow de GitHub Actions que ejecuta lo anterior en Linux, Windows y macOS, y publica los artefactos como build outputs.
- Workflow que corre tests y linters en cada push.

### 3.3 Fuera del alcance

- Lectura de cualquier métrica (no se importa psutil aún).
- Persistencia / SQLite.
- WebSocket.
- Cualquier UI que no sea la pantalla de bienvenida.

### 3.4 Criterios de aceptación

1. Ejecutar el binario en cada uno de los tres SO abre `http://127.0.0.1:<puerto>` y muestra "Atalaya".
2. `GET /api/health` devuelve `200 OK` con `{"status": "ok"}`.
3. El workflow de CI pasa en los tres SO y produce binarios descargables.
4. El comando `uv run pytest` ejecuta correctamente la suite vacía.
5. El comando `npm run dev` sirve el frontend con hot-reload contra el backend en modo desarrollo.

### 3.5 Riesgos y notas

- **Riesgo principal:** PyInstaller puede comportarse de forma distinta entre SO, especialmente al embeber assets estáticos del frontend. Resolverlo aquí evita rework masivo en iteraciones futuras.
- **Decisión a registrar como ADR si aplica:** ruta exacta donde se embeben los archivos estáticos dentro del binario y cómo el código los localiza en runtime.

---

## 4. Iteración 1 — CPU end-to-end

### 4.1 Objetivo

Implementar el primer slice vertical funcional: lectura de CPU, persistencia, exposición vía API y WebSocket, y visualización en tiempo real en el frontend. CPU se elige primero por ser la métrica con dimensión adicional (`core_id`), lo que ejercita el patrón completo del sistema.

### 4.2 Alcance

**Backend:**
- Componente Muestreador (C-01): lee CPU global y por core con psutil cada ~1s.
- Componente Bus de eventos (C-02): pub/sub in-memory.
- Componente Persistencia (C-03): escribe en `cpu_global_raw` y `cpu_core_raw`.
- Inicialización del esquema SQLite (solo las tablas y la `schema_version`; el resto se añade en iteraciones siguientes).
- Endpoint `GET /api/system/info` (incluye solo el bloque `cpu` y `os`/`hostname`).
- Endpoint `GET /api/metrics/current` (solo la sección `cpu`).
- WebSocket `/ws/metrics` que envía mensajes `snapshot` con solo la sección `cpu`.

**Frontend:**
- Cliente WebSocket que recibe mensajes y mantiene estado.
- Cliente REST para `/api/system/info` y `/api/metrics/current`.
- Componente UI: tarjeta de CPU global (porcentaje actual + gráfica simple en vivo de los últimos N segundos en memoria).
- Componente UI: visualización de uso por core (forma a definir, ej. barras o mini-gráficas).

**Tests:**
- Tests unitarios del Muestreador (mockear psutil).
- Tests unitarios de Persistencia (insertar y leer de una BD temporal).
- Test de integración mínimo: arrancar el backend, conectar al WebSocket, recibir al menos un mensaje válido.

### 4.3 Fuera del alcance

- Tablas `*_1min` y agregación.
- Endpoints de histórico.
- Selector de rango temporal.
- Métricas que no sean CPU.

### 4.4 Criterios de aceptación

1. Al ejecutar el binario y abrir el navegador, el dashboard muestra CPU global y por core actualizándose cada ~1 segundo.
2. El archivo SQLite se crea automáticamente al primer arranque en la ubicación correcta del SO.
3. La tabla `cpu_global_raw` y `cpu_core_raw` acumulan filas durante el uso normal.
4. Al desconectar y reconectar el frontend, el WebSocket se restablece y los datos siguen llegando.
5. Los tests del Muestreador y de Persistencia pasan en CI.

### 4.5 Notas

- El esquema completo del SDD se introduce de forma incremental: en cada iteración se añaden solo las tablas que esa iteración usa. La versión del esquema en `schema_version` se incrementa cuando se añadan tablas nuevas.

---

## 5. Iteración 2 — RAM

### 5.1 Objetivo

Extender el sistema para incluir métricas de memoria RAM, reutilizando toda la infraestructura construida en IT-1.

### 5.2 Alcance

**Backend:**
- Extender el Muestreador para leer RAM (`total`, `used`, `available`, `percent`).
- Añadir tabla `ram_raw` al esquema (incrementar `schema_version` a 2).
- Extender el snapshot publicado en el bus para incluir la sección `ram`.
- Extender `/api/system/info` con el bloque `ram` (solo `total_bytes`).
- Extender `/api/metrics/current` con la sección `ram`.
- Los mensajes WebSocket pasan a incluir `ram` en su `data`.

**Frontend:**
- Tarjeta de RAM con porcentaje actual, valores absolutos y mini-gráfica en vivo.

**Tests:**
- Tests del Muestreador para RAM.
- Tests de Persistencia para RAM.

### 5.3 Criterios de aceptación

1. El dashboard muestra simultáneamente CPU y RAM actualizándose en vivo.
2. La tabla `ram_raw` acumula filas correctamente.
3. Al actualizar una instalación previa (BD ya existente con `schema_version=1`), el sistema añade la tabla `ram_raw` y actualiza `schema_version` a 2.
4. Los tests pasan en CI.

### 5.4 Notas

- Esta es la primera iteración que introduce **migración de esquema**. Conviene resolver aquí el patrón general (script de migración o detección de tablas faltantes) que se reutilizará en IT-3 e IT-4.

---

## 6. Iteración 3 — Disco

### 6.1 Objetivo

Añadir métricas de disco. Esta iteración introduce la **dimensión de particiones**, que requiere una tabla de catálogo (`disks`) y la lógica de detección de particiones al arranque.

### 6.2 Alcance

**Backend:**
- Detección de particiones al arranque (vía `psutil.disk_partitions`) y poblamiento/actualización de la tabla `disks`.
- Tabla `disk_raw` (incrementar `schema_version` a 3).
- Extender el Muestreador para iterar sobre las particiones registradas y muestrear cada una.
- Extender `/api/system/info` con el bloque `disks`.
- Extender `/api/metrics/current` con la sección `disks`.
- Los mensajes WebSocket pasan a incluir `disks` en su `data`.

**Frontend:**
- Sección de discos en el dashboard, con una tarjeta por partición.
- La UI se construye dinámicamente a partir de la información de `/api/system/info`.

**Tests:**
- Tests del Muestreador para disco.
- Tests de Persistencia para `disks` y `disk_raw`.
- Test del flujo de detección de particiones al arranque.

### 6.3 Criterios de aceptación

1. El dashboard muestra dinámicamente todas las particiones detectadas, con CPU y RAM ya funcionando.
2. Si se añade o elimina una partición entre arranques, el catálogo `disks` refleja el cambio.
3. La tabla `disk_raw` acumula filas para cada partición monitoreada.
4. Los tests pasan en CI.

---

## 7. Iteración 4 — Histórico y agregación

### 7.1 Objetivo

Habilitar la consulta de datos históricos. Es la iteración más compleja porque introduce el componente Agregador (C-04), las tablas `_1min` y los endpoints de histórico.

### 7.2 Alcance

**Backend:**
- Añadir todas las tablas `*_1min` al esquema (incrementar `schema_version` a 4).
- Componente Agregador (C-04): tarea periódica que ejecuta el algoritmo definido en SDD §4.5.2.
- Política de retención: borrado de filas en `*_raw` agregadas y de filas en `*_1min` mayores a 7 días.
- Endpoint `GET /api/metrics/cpu/history` con parámetros `from`, `to`, `resolution`.
- Endpoint `GET /api/metrics/ram/history` análogo.
- Endpoint `GET /api/metrics/disk/history` análogo (incluye `disk_id` opcional).
- Lógica de selección automática de resolución según el tamaño de la ventana.
- Validación de parámetros y manejo de los códigos de error definidos en SDD §5.3.

**Frontend:**
- Selector de rango temporal: "última hora" (por defecto) y "últimos 7 días".
- Cliente REST que consulta los endpoints de histórico al cambiar el rango.
- Las gráficas pasan a mostrar datos históricos del rango seleccionado, sin perder la actualización en vivo cuando el rango incluye el momento actual.

**Tests:**
- Tests del Agregador en casos de borde:
  - Minuto recién completado.
  - Sistema arranca con datos pendientes de agregar de varias horas atrás.
  - Comportamiento cuando no hay datos crudos en el rango.
- Tests de los endpoints de histórico (parámetros válidos/inválidos, selección automática de resolución).
- Test de integración de larga duración: verificar que tras 1 hora de funcionamiento, hay datos correctamente agregados en `*_1min`.

### 7.3 Criterios de aceptación

1. El usuario puede alternar entre "última hora" y "últimos 7 días" y ver gráficas con datos coherentes en ambos casos.
2. Tras 1 hora ininterrumpida de funcionamiento, las tablas `*_1min` contienen agregados correctos de los datos crudos.
3. Las filas crudas mayores a 1 hora se eliminan tras ser agregadas.
4. Los endpoints de histórico responden con los códigos de error correctos ante parámetros inválidos.
5. Los tests pasan en CI, incluido el test de integración de larga duración (puede correrse de forma acelerada simulando el reloj).

### 7.4 Notas

- Por la complejidad del agregador, conviene implementar **primero el algoritmo aislado** (con BDs de prueba) y solo después integrarlo como tarea periódica del proceso.
- El test de larga duración debe usar un reloj inyectable o acelerable para no requerir tiempo real de ejecución en CI.

---

## 8. Iteración 5 — Pulido y release del MVP

### 8.1 Objetivo

Llevar el sistema del estado "funcional" al estado "publicable como release v1.0", asegurando que cumple todos los criterios de aceptación del MVP definidos en SRS §4.1.

### 8.2 Alcance

**Robustez:**
- Manejo robusto de errores en el backend: respuestas con `INTERNAL_ERROR` ante fallos inesperados sin filtrar trazas, logging adecuado.
- Manejo de errores en el frontend: estados de "cargando", "error", "sin datos" en cada componente.
- Reconexión automática del cliente WebSocket con backoff exponencial.

**Documentación:**
- README en la raíz del repo con: descripción, capturas, instrucciones de descarga, ejecución y desinstalación.
- Sección de troubleshooting básico (puerto en uso, ubicación de la BD, cómo resetearla).
- Licencia.

**Verificación final:**
- Recorrer cada criterio de aceptación de SRS §4.1 y confirmar que se cumple.
- Test de estabilidad de 24 horas en al menos un SO (RNF-08): el binario se ejecuta durante 24h y se verifica que el consumo de memoria no crece más de 50 MB.

**Release:**
- Tag de versión `v1.0.0`.
- Workflow de GitHub Actions que, al taggear, genera los binarios para los tres SO y los publica como GitHub Release con changelog.

### 8.3 Criterios de aceptación

1. Todos los criterios de aceptación del MVP definidos en SRS §4.1 se cumplen y están verificados.
2. Existe un GitHub Release `v1.0.0` con binarios descargables para Linux, Windows y macOS.
3. El README permite a un usuario que llega al repo descargar y ejecutar Atalaya sin contexto adicional.
4. El test de estabilidad de 24h se ha ejecutado al menos una vez con resultado positivo.

---

## 9. Backlog post-MVP (no comprometido)

Estos elementos quedan registrados pero **fuera del MVP**. Su orden y alcance se replanteará tras el release de v1.0.0.

- Métricas de red (interfaces, throughput, conexiones).
- Listado y monitoreo de procesos.
- Temperaturas de CPU.
- Información y temperaturas de GPU.
- Dispositivos conectados (USB, periféricos).
- Sistema de alertas configurables.
- Tema oscuro y personalización visual.
- Exportación de datos históricos (CSV, JSON).

---

## 10. Trazabilidad con requisitos

| Requisito (SRS) | Iteración que lo entrega |
|-----------------|--------------------------|
| RF-01 (CPU) | IT-1 |
| RF-02 (RAM) | IT-2 |
| RF-03 (Disco) | IT-3 |
| RF-04 (snapshot actual) | IT-1 (parcial), IT-2/3 (completado) |
| RF-05 (WebSocket) | IT-1 (parcial), IT-2/3 (completado) |
| RF-06 (persistencia) | IT-1 (parcial), IT-2/3 (completado) |
| RF-07 (histórico) | IT-4 |
| RF-08 (agregación) | IT-4 |
| RF-09 (retención) | IT-4 |
| RF-10 (servir estáticos) | IT-0 |
| RF-11, RF-12, RF-14 (UI en vivo) | IT-1/2/3 incrementalmente |
| RF-13 (selector de rango) | IT-4 |
| RNF-02 (binario sin runtime) | IT-0 |
| RNF-08 (estabilidad 24h) | IT-5 |
| RNF-10 (tests automatizados) | Todas las iteraciones |
| RNF-11 (lockfiles) | IT-0 (establecidos), todas (mantenidos) |