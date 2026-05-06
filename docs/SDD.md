# Atalaya — Documento de Diseño de Software (SDD)

**Versión:** 0.4
**Fecha:** 2026-05-06
**Estado:** Borrador completo (todas las vistas redactadas)
**Estándar de referencia:** IEEE 1016-2009
**Documento relacionado:** `SRD.md` (Especificación de Requisitos)

---

## 1. Introducción

### 1.1 Propósito

Este documento describe el diseño del sistema **Atalaya** en su versión MVP. Su objetivo es traducir los requisitos definidos en el SRS (`SRD.md`) en una solución técnica concreta, descrita con suficiente detalle para guiar la implementación.

Está dirigido al desarrollador del proyecto y a cualquier colaborador futuro que necesite entender cómo está construido el sistema, por qué se tomaron ciertas decisiones y cómo se relacionan las piezas entre sí.

### 1.2 Alcance

Cubre el diseño completo del MVP descrito en el SRS, incluyendo:

- La arquitectura del sistema (componentes, conexiones, despliegue).
- El modelo de datos persistido en SQLite.
- El contrato de las interfaces externas (API REST, WebSocket).
- Las interacciones internas relevantes (diagramas de comportamiento).
- Las decisiones de diseño significativas y su justificación.

No cubre detalles de implementación a nivel de código (clases, funciones, firmas), que se materializarán durante la fase de construcción.

### 1.3 Definiciones, acrónimos y abreviaturas

Aplica el glosario definido en el SRS (sección 1.3). A continuación se añaden términos específicos del diseño:

| Término | Definición |
|---------|-----------|
| **SDD** | Software Design Document (Documento de Diseño de Software). |
| **Componente** | Unidad lógica del sistema con una responsabilidad clara y una interfaz definida. |
| **Bus de eventos** | Canal interno de publicación/suscripción in-memory que desacopla productores de consumidores de eventos. |
| **Snapshot** | Conjunto de métricas tomadas en un instante dado (definido en SRS, repetido aquí por claridad). |
| **ADR** | Architecture Decision Record. Registro breve de una decisión de diseño y su justificación. |
| **Vista** | En IEEE 1016, una representación parcial del diseño desde una perspectiva específica (estructural, de datos, de interfaces, de comportamiento, de despliegue). |

### 1.4 Referencias

- IEEE Std 1016-2009: *IEEE Standard for Information Technology — Systems Design — Software Design Descriptions*.
- IEEE Std 830-1998: *IEEE Recommended Practice for Software Requirements Specifications*.
- `SRD.md`: Especificación de Requisitos de Software de Atalaya.
- Documentación oficial de FastAPI — https://fastapi.tiangolo.com/.
- Documentación oficial de psutil — https://psutil.readthedocs.io/.
- Documentación oficial de Svelte — https://svelte.dev/.

### 1.5 Visión general del documento

El documento está organizado en vistas, según la práctica recomendada por IEEE 1016. Cada vista presenta el diseño desde una perspectiva distinta:

- **Sección 2:** vista de contexto y stakeholders.
- **Sección 3:** vista de arquitectura (componentes, conexiones, despliegue).
- **Sección 4:** vista de datos (modelo, esquema SQLite, retención y agregación).
- **Sección 5:** vista de interfaces (API REST, WebSocket, estáticos).
- **Sección 6:** vista de comportamiento (escenarios principales).
- **Sección 7:** decisiones de diseño (ADRs).

---

## 2. Vista de contexto

### 2.1 Stakeholders y preocupaciones de diseño

| Stakeholder | Preocupación principal |
|-------------|------------------------|
| Desarrollador (autor del proyecto) | Que el diseño sea simple, mantenible y permita aprender SDLC end-to-end. |
| Usuario final | Que la app se descargue, ejecute y funcione sin configuración adicional. |
| Colaborador futuro hipotético | Que el código y la documentación sean comprensibles sin contexto previo. |

### 2.2 Contexto del sistema

Atalaya es una aplicación autónoma que se ejecuta en la máquina del usuario. No interactúa con sistemas externos. Sus únicas interfaces con el exterior son:

- El **sistema operativo del host**, del que lee métricas vía psutil.
- El **navegador del usuario**, al que sirve la interfaz web y los datos.
- El **sistema de archivos local**, donde persiste la base de datos SQLite.

---

## 3. Vista de arquitectura

### 3.1 Estilo arquitectónico

El sistema adopta los siguientes estilos y patrones:

- **Monolito**: todo el backend se ejecuta en un único proceso. Justificación: la app es single-user y single-host; un monolito minimiza la complejidad operativa y facilita la distribución como un binario único.
- **Cliente-servidor**: el navegador es el cliente; el proceso Python es el servidor. Comunicación exclusiva sobre `127.0.0.1`.
- **Arquitectura por capas en el backend**: capa de presentación (API), capa de servicios (lógica de muestreo, agregación), capa de datos (acceso a SQLite).
- **Event-driven internamente**: un bus de eventos in-memory desacopla al productor de snapshots (muestreador) de sus consumidores (persistencia, WebSocket).
- **Single-tenant, single-host**: una instancia atiende a un único usuario en una única máquina.

### 3.2 Componentes

El sistema se descompone en los siguientes componentes lógicos, agrupados por su ubicación física en tiempo de ejecución.

#### 3.2.1 Componentes del backend (proceso Python)

| ID | Componente | Responsabilidad |
|----|-----------|-----------------|
| C-01 | Muestreador | Lee métricas del sistema vía psutil con periodicidad configurable (~1s) y publica snapshots en el bus de eventos. |
| C-02 | Bus de eventos | Canal pub/sub in-memory que distribuye snapshots a todos los suscriptores. |
| C-03 | Persistencia | Suscriptor del bus. Escribe cada snapshot recibido en la base de datos SQLite. |
| C-04 | Agregador | Tarea periódica (~5min) que comprime datos antiguos a resolución de 1 minuto y elimina datos más viejos que 7 días. |
| C-05 | API REST | Expone endpoints HTTP para consultar el snapshot actual y el histórico. |
| C-06 | WebSocket server | Suscriptor del bus. Reenvía snapshots a los clientes WebSocket conectados. |
| C-07 | Servidor de estáticos | Sirve los archivos del frontend (HTML, JS, CSS) embebidos en el binario. |

#### 3.2.2 Componentes del frontend (navegador)

| ID | Componente | Responsabilidad |
|----|-----------|-----------------|
| C-08 | Cliente WebSocket | Mantiene una conexión persistente al backend y actualiza el estado en vivo. |
| C-09 | Cliente REST | Realiza peticiones HTTP bajo demanda para cargar datos históricos. |
| C-10 | Componentes UI | Renderizan gráficas, indicadores y controles de la interfaz. |

#### 3.2.3 Almacenamiento

| ID | Componente | Responsabilidad |
|----|-----------|-----------------|
| C-11 | Base de datos SQLite | Archivo único en disco que persiste todas las métricas con sus distintas resoluciones. |

### 3.3 Diagrama de componentes

El siguiente diagrama presenta la relación entre componentes. Las líneas continuas representan flujo de datos; las líneas punteadas representan peticiones cliente-servidor.

```
                    ┌─────────────────────────────────────────────────────┐
                    │            Sistema operativo del host                │
                    │              (CPU, RAM, disco)                       │
                    └─────────────────────┬───────────────────────────────┘
                                          │ psutil
                                          ▼
       ┌──────────────────────────────────────────────────────────────────┐
       │  Backend (proceso Python, FastAPI)                               │
       │                                                                  │
       │  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
       │  │ Muestreador  │───▶│ Bus de       │───▶│ WebSocket server │  │
       │  │   (C-01)     │    │ eventos      │    │     (C-06)       │  │
       │  └──────────────┘    │   (C-02)     │    └──────────────────┘  │
       │                       │              │                          │
       │                       └──────┬───────┘                          │
       │                              │                                  │
       │                              ▼                                  │
       │  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
       │  │ Agregador    │───▶│ Persistencia │    │   API REST       │  │
       │  │   (C-04)     │    │    (C-03)    │    │     (C-05)       │  │
       │  └──────┬───────┘    └──────┬───────┘    └────────┬─────────┘  │
       │         │                   │                      │            │
       │         └─────────┬─────────┘                      │            │
       │                   ▼                                ▼            │
       │            ┌─────────────────────────────────────────────┐     │
       │            │       SQLite (atalaya.db, C-11)             │     │
       │            └─────────────────────────────────────────────┘     │
       │                                                                  │
       │  ┌────────────────────────────────────────────────────────────┐│
       │  │ Servidor de estáticos (C-07)                               ││
       │  └────────────────────────────────────────────────────────────┘│
       └─────────┬────────────────────┬────────────────────┬────────────┘
                 │ HTTP               │ HTTP               │ WebSocket
                 │ (estáticos)        │ (API REST)         │
                 ▼                    ▼                    ▼
       ┌──────────────────────────────────────────────────────────────────┐
       │  Frontend (navegador, Svelte)                                    │
       │                                                                  │
       │  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
       │  │ Cliente REST │    │ Cliente WS   │    │  Componentes UI  │  │
       │  │   (C-09)     │    │   (C-08)     │    │     (C-10)       │  │
       │  └──────────────┘    └──────────────┘    └──────────────────┘  │
       └──────────────────────────────────────────────────────────────────┘
```

### 3.4 Conexiones entre componentes

| ID | Origen | Destino | Mecanismo | Frecuencia |
|----|--------|---------|-----------|------------|
| L-01 | Muestreador (C-01) | SO del host | Llamadas a psutil | ~1s |
| L-02 | Muestreador (C-01) | Bus de eventos (C-02) | Publicación in-memory | Cada snapshot |
| L-03 | Bus de eventos (C-02) | Persistencia (C-03) | Suscripción in-memory | Continuo |
| L-04 | Bus de eventos (C-02) | WebSocket server (C-06) | Suscripción in-memory | Continuo |
| L-05 | Persistencia (C-03) | SQLite (C-11) | Escritura SQL | Cada snapshot |
| L-06 | Agregador (C-04) | SQLite (C-11) | Lectura/escritura SQL | ~5min |
| L-07 | API REST (C-05) | SQLite (C-11) | Lectura SQL | Por petición |
| L-08 | Cliente REST (C-09) | API REST (C-05) | HTTP/JSON | Bajo demanda |
| L-09 | Cliente WS (C-08) | WebSocket server (C-06) | WebSocket sobre TCP | Persistente |
| L-10 | Navegador | Servidor de estáticos (C-07) | HTTP GET | Carga inicial |

### 3.5 Vista de despliegue

#### 3.5.1 Empaquetado

El sistema se distribuye como **un único binario por sistema operativo** (Linux, Windows, macOS), generado mediante PyInstaller en pipelines de CI (GitHub Actions). El binario contiene:

- El intérprete de Python embebido.
- Todas las dependencias del backend (FastAPI, psutil, etc.).
- El bundle compilado del frontend Svelte (HTML, JS, CSS).

#### 3.5.2 Ejecución

Al ejecutarse el binario:

1. Se lanza un único proceso del sistema operativo.
2. El proceso inicializa todos los componentes del backend en su interior.
3. El servidor HTTP escucha exclusivamente en `127.0.0.1` en un puerto configurable (por defecto a definir).
4. Si la base de datos SQLite no existe en la ruta esperada, se crea con el esquema inicial.
5. El usuario abre su navegador en `http://127.0.0.1:<puerto>` y comienza a usar la aplicación.

#### 3.5.3 Ubicación de datos

La base de datos SQLite se almacena en el directorio de datos estándar del usuario según el sistema operativo:

- **Linux:** `~/.local/share/atalaya/atalaya.db`
- **macOS:** `~/Library/Application Support/atalaya/atalaya.db`
- **Windows:** `%APPDATA%\atalaya\atalaya.db`

Esta ubicación se determina mediante una librería estándar (por ejemplo `platformdirs`) durante la implementación.

#### 3.5.4 Diagrama de despliegue

```
┌─────────────────────────────────────────────────────────────┐
│  Máquina del usuario (Linux / Windows / macOS)              │
│                                                              │
│   ┌──────────────────────────────────────────┐              │
│   │  Proceso: atalaya (binario PyInstaller)  │              │
│   │                                          │              │
│   │   - Backend completo                     │              │
│   │   - Frontend embebido                    │              │
│   │                                          │              │
│   │   Escucha en 127.0.0.1:<puerto>          │              │
│   └────────────────┬─────────────────────────┘              │
│                    │                                         │
│                    │ lee/escribe                             │
│                    ▼                                         │
│   ┌──────────────────────────────────────────┐              │
│   │  Archivo: atalaya.db (SQLite)            │              │
│   │  Ubicación según SO                      │              │
│   └──────────────────────────────────────────┘              │
│                                                              │
│   ┌──────────────────────────────────────────┐              │
│   │  Navegador del usuario                   │              │
│   │  Conecta a http://127.0.0.1:<puerto>     │              │
│   └──────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

### 3.6 Trazabilidad con requisitos

| Requisito (SRS) | Componente(s) que lo implementa(n) |
|-----------------|------------------------------------|
| RF-01, RF-02, RF-03 | C-01 (Muestreador) |
| RF-04, RF-07 | C-05 (API REST) + C-11 (SQLite) |
| RF-05 | C-06 (WebSocket server) + C-02 (Bus) |
| RF-06 | C-03 (Persistencia) + C-11 (SQLite) |
| RF-08, RF-09 | C-04 (Agregador) |
| RF-10 | C-07 (Servidor de estáticos) |
| RF-11, RF-12, RF-13, RF-14 | C-08, C-09, C-10 (Frontend) |
| RNF-04 | Configuración del servidor en C-05/C-06/C-07 |
| RNF-09 | Estrategia de empaquetado (sección 3.5.1) |

---

## 4. Vista de datos

Esta sección describe el modelo lógico y físico de los datos persistidos por Atalaya. Toda la persistencia ocurre en una única base de datos SQLite local (componente C-11).

### 4.1 Modelo lógico

El sistema almacena tres familias de métricas: **CPU**, **memoria RAM** y **disco**. Para cada familia se mantienen dos resoluciones temporales:

- **Resolución cruda (`_raw`):** una muestra por segundo, retenida durante 1 hora.
- **Resolución agregada por minuto (`_1min`):** una muestra por minuto, calculada a partir de las muestras crudas, retenida durante 7 días.

Los datos crudos más antiguos que 1 hora se comprimen en el agregado y luego se eliminan. Los datos agregados más antiguos que 7 días se eliminan sin más procesamiento.

Las dimensiones (núcleos de CPU, particiones de disco) que tienen información estática asociada se modelan en tablas independientes para evitar redundancia.

### 4.2 Convenciones generales

- **Timestamps:** todos los timestamps se almacenan como `INTEGER` representando segundos epoch UTC.
- **Tamaños:** todos los valores en bytes se almacenan como `INTEGER`.
- **Porcentajes:** se almacenan como `REAL` en el rango `0.0` a `100.0`.
- **Claves primarias subrogadas:** se usa `INTEGER PRIMARY KEY` (rowid implícito) en tablas de dimensiones.
- **Foreign keys:** habilitadas explícitamente al abrir la conexión (`PRAGMA foreign_keys = ON`).

### 4.3 Esquema físico

#### 4.3.1 Tabla `disks` (información estática de particiones)

Almacena los metadatos de cada partición monitoreada. Una fila por partición.

```sql
CREATE TABLE disks (
    id           INTEGER PRIMARY KEY,
    mount_point  TEXT NOT NULL UNIQUE,
    device       TEXT,
    fstype       TEXT,
    total_bytes  INTEGER NOT NULL
);
```

| Campo | Descripción |
|-------|-------------|
| `id` | Identificador interno usado como FK en las tablas de muestras. |
| `mount_point` | Punto de montaje (ej. `/`, `/home`, `C:\`). Único. |
| `device` | Dispositivo subyacente (ej. `/dev/sda1`). Informativo. |
| `fstype` | Tipo de sistema de archivos (ej. `ext4`, `ntfs`, `apfs`). Informativo. |
| `total_bytes` | Tamaño total de la partición. Puede actualizarse si cambia. |

#### 4.3.2 Tablas de CPU

**`cpu_global_raw` — uso global de CPU, resolución 1s**

```sql
CREATE TABLE cpu_global_raw (
    timestamp  INTEGER NOT NULL,
    percent    REAL NOT NULL,
    PRIMARY KEY (timestamp)
);
```

**`cpu_global_1min` — uso global de CPU, resolución 1min**

```sql
CREATE TABLE cpu_global_1min (
    timestamp     INTEGER NOT NULL,
    percent_avg   REAL NOT NULL,
    percent_max   REAL NOT NULL,
    PRIMARY KEY (timestamp)
);
```

**`cpu_core_raw` — uso por núcleo, resolución 1s**

```sql
CREATE TABLE cpu_core_raw (
    timestamp  INTEGER NOT NULL,
    core_id    INTEGER NOT NULL,
    percent    REAL NOT NULL,
    PRIMARY KEY (timestamp, core_id)
);
```

**`cpu_core_1min` — uso por núcleo, resolución 1min**

```sql
CREATE TABLE cpu_core_1min (
    timestamp     INTEGER NOT NULL,
    core_id       INTEGER NOT NULL,
    percent_avg   REAL NOT NULL,
    percent_max   REAL NOT NULL,
    PRIMARY KEY (timestamp, core_id)
);
```

#### 4.3.3 Tablas de RAM

**`ram_raw` — memoria, resolución 1s**

```sql
CREATE TABLE ram_raw (
    timestamp        INTEGER NOT NULL,
    total_bytes      INTEGER NOT NULL,
    used_bytes       INTEGER NOT NULL,
    available_bytes  INTEGER NOT NULL,
    percent          REAL NOT NULL,
    PRIMARY KEY (timestamp)
);
```

**`ram_1min` — memoria, resolución 1min**

```sql
CREATE TABLE ram_1min (
    timestamp        INTEGER NOT NULL,
    total_bytes      INTEGER NOT NULL,   -- last
    used_bytes       INTEGER NOT NULL,   -- last
    available_bytes  INTEGER NOT NULL,   -- last
    percent_avg      REAL NOT NULL,
    percent_max      REAL NOT NULL,
    PRIMARY KEY (timestamp)
);
```

#### 4.3.4 Tablas de disco

**`disk_raw` — uso por partición, resolución 1s**

```sql
CREATE TABLE disk_raw (
    timestamp   INTEGER NOT NULL,
    disk_id     INTEGER NOT NULL,
    used_bytes  INTEGER NOT NULL,
    free_bytes  INTEGER NOT NULL,
    percent     REAL NOT NULL,
    PRIMARY KEY (timestamp, disk_id),
    FOREIGN KEY (disk_id) REFERENCES disks(id) ON DELETE CASCADE
);
```

**`disk_1min` — uso por partición, resolución 1min**

```sql
CREATE TABLE disk_1min (
    timestamp     INTEGER NOT NULL,
    disk_id       INTEGER NOT NULL,
    used_bytes    INTEGER NOT NULL,   -- last
    free_bytes    INTEGER NOT NULL,   -- last
    percent_avg   REAL NOT NULL,
    percent_max   REAL NOT NULL,
    PRIMARY KEY (timestamp, disk_id),
    FOREIGN KEY (disk_id) REFERENCES disks(id) ON DELETE CASCADE
);
```

### 4.4 Índices

Las claves primarias compuestas `(timestamp, dimension)` ya proveen el índice principal necesario para las queries por rango temporal con filtro por dimensión. Para queries que necesitan recorrer solo por timestamp en tablas con dimensión adicional, se añaden índices auxiliares:

```sql
CREATE INDEX idx_cpu_core_raw_ts   ON cpu_core_raw (timestamp);
CREATE INDEX idx_cpu_core_1min_ts  ON cpu_core_1min (timestamp);
CREATE INDEX idx_disk_raw_ts       ON disk_raw (timestamp);
CREATE INDEX idx_disk_1min_ts      ON disk_1min (timestamp);
```

Las tablas sin dimensión adicional (`cpu_global_*`, `ram_*`) no requieren índices auxiliares porque su clave primaria ya es solo `timestamp`.

### 4.5 Política de retención y agregación

#### 4.5.1 Reglas de retención

| Tabla | Retención | Política |
|-------|-----------|----------|
| `*_raw` | 1 hora | Se eliminan filas con `timestamp < now - 3600` tras ser agregadas. |
| `*_1min` | 7 días | Se eliminan filas con `timestamp < now - 7*86400`. |

#### 4.5.2 Algoritmo de agregación

El componente Agregador (C-04) ejecuta el siguiente proceso periódicamente (intervalo recomendado: 5 minutos):

1. Determinar el rango de minutos completos que ya cumplieron 1 hora de antigüedad y aún no han sido agregados.
2. Para cada minuto en ese rango y para cada métrica:
   - Calcular `avg(percent)` y `max(percent)` para porcentajes.
   - Tomar el último valor (`MAX(timestamp)` por grupo) para los campos `_bytes` que se agregan como "last".
   - Insertar una fila en la tabla `_1min` correspondiente con `timestamp` igual al inicio del minuto (epoch alineado a 60s).
3. Eliminar de la tabla `_raw` todas las filas con `timestamp` anterior al límite de 1 hora.
4. Eliminar de la tabla `_1min` todas las filas con `timestamp` anterior al límite de 7 días.

Cada paso de inserción y borrado se ejecuta dentro de una **transacción** para garantizar atomicidad.

#### 4.5.3 Ejemplo conceptual de agregación

Para `cpu_global_raw`, la query que produce el agregado de un minuto dado `T` (representado como epoch alineado a 60s) es conceptualmente:

```sql
INSERT INTO cpu_global_1min (timestamp, percent_avg, percent_max)
SELECT
    :T AS timestamp,
    AVG(percent) AS percent_avg,
    MAX(percent) AS percent_max
FROM cpu_global_raw
WHERE timestamp >= :T AND timestamp < :T + 60;
```

El patrón es análogo para las demás tablas, con los campos correspondientes.

### 4.6 Estimación de volumen

Estimación aproximada del crecimiento de datos en uso normal, considerando una máquina con 8 núcleos y 2 particiones:

| Tabla | Filas/segundo | Filas en periodo de retención |
|-------|---------------|-------------------------------|
| `cpu_global_raw` | 1 | ~3,600 |
| `cpu_core_raw` | 8 | ~28,800 |
| `ram_raw` | 1 | ~3,600 |
| `disk_raw` | 2 | ~7,200 |
| `cpu_global_1min` | 1/60 | ~10,080 |
| `cpu_core_1min` | 8/60 | ~80,640 |
| `ram_1min` | 1/60 | ~10,080 |
| `disk_1min` | 2/60 | ~20,160 |

Total aproximado: **~165,000 filas en estado estable**. Considerando un promedio de ~80 bytes por fila incluyendo overhead de SQLite e índices, el tamaño estimado de la base de datos en uso normal es del orden de **15-30 MB**, muy por debajo del límite de 100 MB definido en RNF-13.

### 4.7 Inicialización del esquema

Al arrancar la aplicación, el componente de Persistencia (C-03) verifica la existencia del archivo de base de datos en la ruta determinada (sección 3.5.3). Si no existe, lo crea y ejecuta el script de inicialización con todas las sentencias `CREATE TABLE` y `CREATE INDEX` definidas arriba.

Si la base de datos ya existe, se verifica la versión del esquema mediante una tabla auxiliar `schema_version` para permitir futuras migraciones:

```sql
CREATE TABLE schema_version (
    version     INTEGER PRIMARY KEY,
    applied_at  INTEGER NOT NULL
);
```

La versión inicial del esquema MVP es `1`.

### 4.8 Trazabilidad con requisitos

| Requisito (SRS) | Elemento de diseño |
|-----------------|---------------------|
| RF-06 | Esquema completo (sección 4.3) |
| RF-08 | Algoritmo de agregación (sección 4.5.2) |
| RF-09 | Política de retención (sección 4.5.1) |
| RD-01 | Sección 4.1 |
| RD-02 | Esquema (sección 4.3): todas las muestras tienen timestamp + dimensión + valor |
| RD-03 | Tablas separadas `_raw` y `_1min` (sección 4.3) |
| RD-04 | Foreign keys en `disk_raw` y `disk_1min` (sección 4.3.4) |
| RNF-13 | Estimación de volumen (sección 4.6) |

---

## 5. Vista de interfaces

Esta sección describe el contrato externo del backend: las interfaces que el frontend (u otros clientes) usan para interactuar con el sistema. Se compone de una API REST sobre HTTP y un canal WebSocket para datos en tiempo real.

### 5.1 Convenciones generales

- **Prefijo de rutas REST:** todas las rutas de la API REST se sirven bajo `/api/`.
- **Ruta WebSocket:** `/ws/metrics`.
- **Content-Type:** `application/json` en todas las peticiones y respuestas REST.
- **Timestamps:** formato ISO-8601 en UTC con sufijo `Z` (ej. `2026-05-05T14:30:00Z`). Internamente se almacenan como epoch en segundos; la conversión ocurre en la frontera de la API.
- **Bytes:** enteros sin unidad. El cliente formatea las unidades (KB/MB/GB) en la UI.
- **Porcentajes:** valores `REAL` en el rango `0.0`–`100.0`.
- **Códigos de respuesta:** se usan los códigos HTTP estándar (`200`, `400`, `404`, `500`).

### 5.2 Formato uniforme de error

Todas las respuestas de error siguen la misma estructura:

```json
{
  "error": {
    "code": "INVALID_RANGE",
    "message": "El parámetro 'to' debe ser posterior a 'from'."
  }
}
```

Los códigos de error específicos por endpoint se listan en cada subsección.

### 5.3 Endpoints REST

#### 5.3.1 `GET /api/health`

Healthcheck simple. Sirve para verificar que el proceso responde.

**Parámetros:** ninguno.

**Respuesta `200 OK`:**

```json
{
  "status": "ok",
  "uptime_seconds": 3421
}
```

#### 5.3.2 `GET /api/system/info`

Información estática del host. El frontend la consulta una vez al cargar para construir la UI dinámicamente (número de cores, particiones existentes, etc.).

**Parámetros:** ninguno.

**Respuesta `200 OK`:**

```json
{
  "hostname": "mi-laptop",
  "os": {
    "system": "Linux",
    "release": "6.5.0-21-generic",
    "version": "#21-Ubuntu SMP"
  },
  "cpu": {
    "cores": 8,
    "model": "AMD Ryzen 7 5800H"
  },
  "ram": {
    "total_bytes": 16777216000
  },
  "disks": [
    {
      "id": 1,
      "mount_point": "/",
      "device": "/dev/sda1",
      "fstype": "ext4",
      "total_bytes": 500000000000
    }
  ]
}
```

#### 5.3.3 `GET /api/metrics/current`

Devuelve el snapshot actual de todas las métricas. Su utilidad principal es popular la UI antes de que llegue el primer mensaje vía WebSocket.

**Parámetros:** ninguno.

**Respuesta `200 OK`:**

```json
{
  "timestamp": "2026-05-05T14:30:00Z",
  "cpu": {
    "global_percent": 23.5,
    "per_core": [
      { "core_id": 0, "percent": 18.2 },
      { "core_id": 1, "percent": 28.7 }
    ]
  },
  "ram": {
    "total_bytes": 16777216000,
    "used_bytes": 8500000000,
    "available_bytes": 8277216000,
    "percent": 50.6
  },
  "disks": [
    {
      "disk_id": 1,
      "used_bytes": 250000000000,
      "free_bytes": 250000000000,
      "percent": 50.0
    }
  ]
}
```

#### 5.3.4 `GET /api/metrics/cpu/history`

Histórico de CPU. Devuelve en una sola respuesta el porcentaje global y el porcentaje por núcleo, agrupados por dimensión.

**Parámetros (query string):**

| Nombre | Tipo | Requerido | Descripción |
|--------|------|-----------|-------------|
| `from` | ISO-8601 UTC | sí | Inicio del rango (inclusivo). |
| `to` | ISO-8601 UTC | sí | Fin del rango (exclusivo). |
| `resolution` | `raw` \| `1min` | no | Override manual. Si se omite, el backend selecciona automáticamente: `raw` si `to - from <= 1h`, `1min` en caso contrario. |

**Respuesta `200 OK` (resolución `raw`):**

```json
{
  "resolution": "raw",
  "from": "2026-05-05T13:30:00Z",
  "to": "2026-05-05T14:30:00Z",
  "global": [
    { "timestamp": "2026-05-05T13:30:00Z", "percent": 22.1 },
    { "timestamp": "2026-05-05T13:30:01Z", "percent": 24.5 }
  ],
  "per_core": [
    {
      "core_id": 0,
      "samples": [
        { "timestamp": "2026-05-05T13:30:00Z", "percent": 18.0 }
      ]
    }
  ]
}
```

**Respuesta `200 OK` (resolución `1min`):**

```json
{
  "resolution": "1min",
  "from": "2026-04-28T14:30:00Z",
  "to": "2026-05-05T14:30:00Z",
  "global": [
    { "timestamp": "2026-04-28T14:30:00Z", "percent_avg": 22.1, "percent_max": 41.5 }
  ],
  "per_core": [
    {
      "core_id": 0,
      "samples": [
        { "timestamp": "2026-04-28T14:30:00Z", "percent_avg": 18.0, "percent_max": 35.2 }
      ]
    }
  ]
}
```

**Códigos de error:**

| HTTP | `error.code` | Causa |
|------|--------------|-------|
| `400` | `INVALID_RANGE` | `from` >= `to`, o formato de timestamp inválido. |
| `400` | `RANGE_TOO_LARGE` | El rango excede 7 días. |
| `400` | `INVALID_RESOLUTION` | El valor de `resolution` no es `raw` ni `1min`. |

#### 5.3.5 `GET /api/metrics/ram/history`

Histórico de RAM.

**Parámetros (query string):** mismos que `5.3.4` (sin `disk_id`).

**Respuesta `200 OK` (resolución `raw`):**

```json
{
  "resolution": "raw",
  "from": "2026-05-05T13:30:00Z",
  "to": "2026-05-05T14:30:00Z",
  "samples": [
    {
      "timestamp": "2026-05-05T13:30:00Z",
      "total_bytes": 16777216000,
      "used_bytes": 8500000000,
      "available_bytes": 8277216000,
      "percent": 50.6
    }
  ]
}
```

**Respuesta `200 OK` (resolución `1min`):**

```json
{
  "resolution": "1min",
  "from": "2026-04-28T14:30:00Z",
  "to": "2026-05-05T14:30:00Z",
  "samples": [
    {
      "timestamp": "2026-04-28T14:30:00Z",
      "total_bytes": 16777216000,
      "used_bytes": 8500000000,
      "available_bytes": 8277216000,
      "percent_avg": 50.6,
      "percent_max": 72.3
    }
  ]
}
```

**Códigos de error:** mismos que `5.3.4`.

#### 5.3.6 `GET /api/metrics/disk/history`

Histórico de uso de disco, agrupado por partición.

**Parámetros (query string):**

| Nombre | Tipo | Requerido | Descripción |
|--------|------|-----------|-------------|
| `from` | ISO-8601 UTC | sí | Inicio del rango (inclusivo). |
| `to` | ISO-8601 UTC | sí | Fin del rango (exclusivo). |
| `resolution` | `raw` \| `1min` | no | Override manual. |
| `disk_id` | integer | no | Si se especifica, devuelve solo esa partición. Si se omite, devuelve todas. |

**Respuesta `200 OK` (resolución `raw`):**

```json
{
  "resolution": "raw",
  "from": "2026-05-05T13:30:00Z",
  "to": "2026-05-05T14:30:00Z",
  "disks": [
    {
      "disk_id": 1,
      "samples": [
        {
          "timestamp": "2026-05-05T13:30:00Z",
          "used_bytes": 250000000000,
          "free_bytes": 250000000000,
          "percent": 50.0
        }
      ]
    }
  ]
}
```

**Respuesta `200 OK` (resolución `1min`):**

```json
{
  "resolution": "1min",
  "from": "2026-04-28T14:30:00Z",
  "to": "2026-05-05T14:30:00Z",
  "disks": [
    {
      "disk_id": 1,
      "samples": [
        {
          "timestamp": "2026-04-28T14:30:00Z",
          "used_bytes": 250000000000,
          "free_bytes": 250000000000,
          "percent_avg": 50.0,
          "percent_max": 51.2
        }
      ]
    }
  ]
}
```

**Códigos de error:**

| HTTP | `error.code` | Causa |
|------|--------------|-------|
| `400` | `INVALID_RANGE` | `from` >= `to`, o formato inválido. |
| `400` | `RANGE_TOO_LARGE` | El rango excede 7 días. |
| `400` | `INVALID_RESOLUTION` | Valor de `resolution` inválido. |
| `404` | `DISK_NOT_FOUND` | `disk_id` no existe. |

#### 5.3.7 Tabla resumen de errores genéricos

Aplican a todos los endpoints:

| HTTP | `error.code` | Causa |
|------|--------------|-------|
| `500` | `INTERNAL_ERROR` | Error inesperado en el servidor. |

### 5.4 Interfaz WebSocket

#### 5.4.1 `/ws/metrics`

Canal **unidireccional servidor → cliente** que entrega snapshots de métricas en tiempo real. El cliente abre la conexión y recibe mensajes; no envía datos al servidor en el MVP.

**Comportamiento:**

- Al conectar, el cliente queda suscrito al bus de eventos interno (componente C-02).
- Por cada nuevo snapshot publicado por el muestreador (~1s), el WebSocket server (C-06) envía un mensaje al cliente.
- Si la conexión se interrumpe, el cliente es responsable de reintentar la conexión.
- El servidor cierra la conexión limpiamente al apagarse el proceso.

#### 5.4.2 Formato de mensajes

Todos los mensajes son JSON con un campo `type` que indica el tipo de mensaje. En el MVP solo existe el tipo `snapshot`. El campo `type` permite añadir tipos adicionales en el futuro (ej. `alert`, `system_event`) sin romper el formato.

**Mensaje `snapshot`:**

```json
{
  "type": "snapshot",
  "data": {
    "timestamp": "2026-05-05T14:30:00Z",
    "cpu": {
      "global_percent": 23.5,
      "per_core": [
        { "core_id": 0, "percent": 18.2 },
        { "core_id": 1, "percent": 28.7 }
      ]
    },
    "ram": {
      "total_bytes": 16777216000,
      "used_bytes": 8500000000,
      "available_bytes": 8277216000,
      "percent": 50.6
    },
    "disks": [
      {
        "disk_id": 1,
        "used_bytes": 250000000000,
        "free_bytes": 250000000000,
        "percent": 50.0
      }
    ]
  }
}
```

El contenido del campo `data` tiene **exactamente la misma estructura** que la respuesta de `GET /api/metrics/current` (sección 5.3.3). Esto permite que el frontend use el mismo parser y modelo de datos para ambos casos.

### 5.5 Interfaz de archivos estáticos

El servidor de estáticos (componente C-07) sirve el bundle del frontend en la **raíz** del servidor:

| Ruta | Comportamiento |
|------|----------------|
| `GET /` | Devuelve `index.html` del frontend. |
| `GET /assets/*` | Devuelve los assets del bundle (JS, CSS, imágenes). |
| Cualquier otra ruta no `/api/*` ni `/ws/*` | Devuelve `index.html` (fallback para SPAs con routing del lado del cliente). |

Las rutas `/api/*` y `/ws/*` quedan reservadas para la API y el WebSocket; nunca se sirven como contenido estático.

### 5.6 Trazabilidad con requisitos

| Requisito (SRS) | Elemento de diseño |
|-----------------|---------------------|
| RF-04 | `GET /api/metrics/current` (sección 5.3.3) |
| RF-05 | `/ws/metrics` (sección 5.4) |
| RF-07 | `GET /api/metrics/{cpu,ram,disk}/history` (secciones 5.3.4–5.3.6) |
| RF-10 | Servidor de estáticos (sección 5.5) |
| RF-13 | Parámetro `resolution` y selección automática (sección 5.3.4) |

---

## 6. Vista de comportamiento

Esta sección describe la interacción entre componentes a lo largo del tiempo para los escenarios más representativos del sistema. Los diagramas usan notación de secuencia simplificada en ASCII para mantener la portabilidad del documento.

Los componentes se referencian por su ID definido en la sección 3.2. Las flechas representan invocaciones o mensajes; las líneas verticales representan la línea de vida de cada componente.

### 6.1 Escenario: Arranque de la aplicación

Ocurre una vez, al ejecutar el binario.

**Disparador:** el usuario ejecuta el binario `atalaya`.

**Flujo:**

```
Usuario       Proceso        Persistencia    SQLite       Muestreador     Bus       WS server    API REST    Estáticos
  │              │                 │            │              │            │            │            │            │
  │─ ejecuta ───▶│                 │            │              │            │            │            │            │
  │              │── inicializa ──▶│            │              │            │            │            │            │
  │              │                 │── ¿existe atalaya.db? ──▶│              │            │            │            │
  │              │                 │◀── (no/sí) ──│            │              │            │            │            │
  │              │                 │── CREATE TABLE si falta ▶│              │            │            │            │
  │              │── inicializa Bus ──────────────────────────▶│            │            │            │            │
  │              │── inicializa Muestreador ──────────▶        │            │            │            │            │
  │              │── inicializa WS server ──────────────────────────────────▶│            │            │            │
  │              │   (WS se suscribe al Bus)                                │            │            │            │
  │              │   (Persistencia se suscribe al Bus)                      │            │            │            │
  │              │── inicializa API REST ─────────────────────────────────────────────────▶            │            │
  │              │── inicializa Estáticos ──────────────────────────────────────────────────────────────▶            │
  │              │── escucha en 127.0.0.1:<puerto> ─                                                                │
  │◀─ listo ─────│                                                                                                  │
```

**Resultado:** el proceso queda escuchando en el puerto local. Todos los componentes están inicializados y suscritos al bus según corresponda. La base de datos existe con su esquema.

**Notas:**

- Si la base de datos no existe, se crea con todas las tablas e índices definidos en la sección 4.3 y se inserta una fila en `schema_version` con `version = 1`.
- Si existe, se verifica que la versión registrada coincida con la esperada. Una versión distinta dispararía una migración (no aplica en el MVP).

### 6.2 Escenario: Carga inicial del dashboard

Ocurre cada vez que el usuario abre `http://127.0.0.1:<puerto>` en su navegador.

**Disparador:** el navegador hace una petición HTTP a la raíz del servidor.

**Flujo:**

```
Navegador          Estáticos       API REST      WS server      Bus     Muestreador
   │                   │               │             │            │            │
   │── GET / ─────────▶│               │             │            │            │
   │◀── index.html ────│               │             │            │            │
   │── GET /assets/*──▶│               │             │            │            │
   │◀── JS/CSS ────────│               │            │            │            │
   │  (frontend Svelte se ejecuta)                                              │
   │                                                                             │
   │── GET /api/system/info ─────────▶│             │            │            │
   │◀── 200 OK (hostname, cores...)──│             │            │            │
   │                                                                             │
   │── GET /api/metrics/current ─────▶│             │            │            │
   │◀── 200 OK (último snapshot) ────│             │            │            │
   │                                                                             │
   │── WS conecta /ws/metrics ──────────────────────▶│            │            │
   │   (suscripción al Bus)                          │── suscribe─▶│            │
   │                                                                             │
   │  (espera nuevos snapshots por WebSocket)                                    │
```

**Resultado:** el dashboard está renderizado con datos iniciales y queda recibiendo actualizaciones en tiempo real.

**Notas:**

- La petición a `/api/metrics/current` evita que el usuario vea una pantalla vacía hasta que llegue el primer mensaje WebSocket (que puede tardar hasta 1 segundo).
- La información estática de `/api/system/info` permite al frontend dimensionar la UI (cuántos cores dibujar, cuántas particiones mostrar).

### 6.3 Escenario: Ciclo de muestreo en tiempo real

Ocurre continuamente, una vez por segundo, mientras la aplicación está corriendo.

**Disparador:** temporizador interno del muestreador (~1s).

**Flujo:**

```
Muestreador      psutil        Bus       Persistencia    SQLite      WS server     Cliente WS
     │              │            │            │              │            │              │
     │── lee CPU ──▶│            │            │              │            │              │
     │◀── valores──│            │            │              │            │              │
     │── lee RAM ──▶│            │            │              │            │              │
     │◀── valores──│            │            │              │            │              │
     │── lee disco ▶│            │            │              │            │              │
     │◀── valores──│            │            │              │            │              │
     │                                                                                    │
     │── construye snapshot ──                                                            │
     │── publica(snapshot) ────▶│            │              │            │              │
     │                          │── notifica ▶│              │            │              │
     │                          │            │── INSERT ───▶│              │            │
     │                          │            │◀── ok ───────│              │            │
     │                          │── notifica ─────────────────────────────▶│              │
     │                                                                    │── envía ────▶│
     │                                                                    │              │
     │  (próxima iteración en ~1s)                                                        │
```

**Resultado:** el snapshot queda persistido en `*_raw` y todos los clientes WebSocket activos lo reciben.

**Notas:**

- La persistencia y el envío por WebSocket ocurren **en paralelo** desde la perspectiva del muestreador: este publica una vez en el bus y olvida. Si la escritura en SQLite es lenta, no bloquea el envío en tiempo real al cliente.
- Si no hay clientes WebSocket conectados, el snapshot se persiste igual. La aplicación no para de muestrear cuando nadie mira.
- Si la lectura de psutil falla (caso poco frecuente), el muestreador registra el error y continúa en la siguiente iteración. No se publica un snapshot incompleto.

### 6.4 Escenario: Consulta de histórico

Ocurre cuando el usuario cambia la ventana temporal en la UI (de "última hora" a "últimos 7 días" o viceversa).

**Disparador:** evento UI que dispara una petición HTTP.

**Flujo:**

```
Usuario      Cliente REST    API REST      SQLite
   │              │              │             │
   │── selecciona "7 días" ────▶│             │
   │              │── GET /api/metrics/cpu/history?from=...&to=... ──▶│
   │              │              │             │
   │              │              │── valida parámetros ──             │
   │              │              │── selecciona resolución (1min) ──  │
   │              │              │── SELECT desde cpu_*_1min ───────▶│
   │              │              │◀── filas ──────────────────────────│
   │              │              │── construye respuesta JSON ──      │
   │              │◀── 200 OK ───│             │
   │              │── actualiza estado/UI ──   │
   │◀── nuevas gráficas ─────────│             │
```

**Resultado:** el frontend actualiza las gráficas con los datos del nuevo rango.

**Notas:**

- La selección automática de resolución es transparente para el cliente: este solo pide un rango y recibe los datos con el detalle apropiado.
- Si el rango excede 7 días, la API responde `400 RANGE_TOO_LARGE` antes de tocar SQLite.
- El cliente puede forzar la resolución con el parámetro `resolution=` para casos especiales (depuración o exploración).

### 6.5 Escenario: Ciclo de agregación y limpieza

Ocurre periódicamente, cada ~5 minutos, en segundo plano. No es disparado por el usuario.

**Disparador:** temporizador interno del agregador.

**Flujo:**

```
Agregador      SQLite
    │            │
    │── BEGIN TRANSACTION ──▶│
    │                        │
    │── identifica minutos completos no agregados ─▶│
    │◀── lista de minutos ────────────────────────│
    │                                              │
    │  para cada minuto T:                         │
    │   ── SELECT AVG/MAX FROM *_raw WHERE ts ∈[T, T+60) ──▶│
    │   ◀── valores agregados ─────────────────────────────│
    │   ── INSERT INTO *_1min ────────────────────▶│
    │                                              │
    │── DELETE FROM *_raw WHERE ts < (now - 3600) ▶│
    │── DELETE FROM *_1min WHERE ts < (now - 7d) ─▶│
    │                                              │
    │── COMMIT TRANSACTION ──▶│
    │                                              │
    │  (próxima iteración en ~5min)
```

**Resultado:** los datos antiguos se han comprimido a 1 minuto de resolución, los datos crudos ya agregados se han eliminado, y los datos agregados muy viejos se han borrado.

**Notas:**

- Toda la operación ocurre en una sola transacción SQL para garantizar que un fallo a mitad del proceso no deje el sistema en estado inconsistente.
- El agregador no compite con el muestreador por SQLite: SQLite serializa las escrituras, así que las inserciones en curso se intercalan correctamente.
- Si la aplicación se reinicia y queda más de 1 hora de datos sin agregar, el agregador procesa todos los minutos pendientes en su primera ejecución tras el arranque.

### 6.6 Trazabilidad con requisitos

| Requisito (SRS) | Escenario que lo ilustra |
|-----------------|--------------------------|
| RF-01, RF-02, RF-03 | 6.3 (Ciclo de muestreo) |
| RF-04 | 6.2 (Carga inicial) |
| RF-05 | 6.3 (envío vía WebSocket) |
| RF-06 | 6.3 (persistencia tras muestreo) |
| RF-07, RF-13 | 6.4 (Consulta de histórico) |
| RF-08, RF-09 | 6.5 (Ciclo de agregación) |
| RF-10 | 6.2 (carga de estáticos) |

---

## 7. Decisiones de diseño (ADRs)

A continuación se registran las decisiones significativas tomadas durante el diseño. Cada ADR sigue el formato: contexto, decisión, consecuencias.

### ADR-001: Distribución como binario nativo en lugar de Docker

- **Contexto:** se evaluaron Docker, binarios nativos (PyInstaller) y un esquema híbrido.
- **Decisión:** distribuir como binario nativo por SO desde el inicio.
- **Justificación:** Docker en Windows/macOS corre en una VM Linux, lo que impide acceder a sensores reales del host (temperaturas, GPU, dispositivos), funcionalidades planeadas en el roadmap post-MVP. El binario nativo evita esta limitación.
- **Consecuencias:** mayor trabajo de empaquetado y CI multiplataforma desde el inicio; mayor cobertura de hardware accesible.

### ADR-002: Backend único que sirve también el frontend

- **Contexto:** se consideró separar backend y frontend en procesos/servidores distintos.
- **Decisión:** el backend FastAPI sirve los archivos estáticos del frontend desde el mismo proceso y puerto.
- **Justificación:** la app es local, single-user y se distribuye como un solo binario; separar añadiría complejidad sin beneficio. Elimina problemas de CORS en producción.
- **Consecuencias:** durante desarrollo se requiere proxy de Vite para hot-reload; en producción todo es un solo origen.

### ADR-003: Bus de eventos in-memory para desacoplar muestreo

- **Contexto:** múltiples consumidores necesitan acceder al mismo flujo de snapshots (persistencia y WebSocket).
- **Decisión:** introducir un bus pub/sub in-memory entre el muestreador y sus consumidores.
- **Justificación:** una sola lectura de psutil sirve a múltiples consumidores; permite añadir nuevos consumidores (ej. sistema de alertas futuro) sin tocar al muestreador.
- **Consecuencias:** el sistema gana flexibilidad a costa de una indirección adicional. La complejidad es mínima (puede implementarse con `asyncio.Queue` o equivalente).

### ADR-004: SQLite como motor de persistencia

- **Contexto:** se requiere histórico persistente con buena ingestión continua.
- **Decisión:** usar SQLite como única base de datos.
- **Justificación:** un solo archivo, sin servidor que administrar, multiplataforma, soportado por la stdlib de Python. Suficiente para los volúmenes esperados (RNF-13: <100 MB). No se requiere TimescaleDB ni similares por la escala del MVP.
- **Consecuencias:** simplicidad operativa máxima. Si en el futuro se requiere multi-host o concurrencia alta, habría que reevaluar.

### ADR-005: Svelte como framework de frontend

- **Contexto:** se evaluaron Svelte, React y vanilla JS.
- **Decisión:** usar Svelte con Vite.
- **Justificación:** equilibrio entre productividad (componentes, reactividad, routing) y simplicidad (bundle pequeño, poco boilerplate, curva de aprendizaje suave). React se consideró sobredimensionado; vanilla JS, insuficiente para la complejidad esperada cuando crezca el alcance.
- **Consecuencias:** ecosistema más reducido que React, pero adecuado para el alcance del proyecto.