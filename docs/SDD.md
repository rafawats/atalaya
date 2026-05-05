# Atalaya — Documento de Diseño de Software (SDD)

**Versión:** 0.2
**Fecha:** 2026-05-05
**Estado:** Borrador (en construcción incremental)
**Estándar de referencia:** IEEE 1016-2009
**Documento relacionado:** `SRS.md` (Especificación de Requisitos)

---

## 1. Introducción

### 1.1 Propósito

Este documento describe el diseño del sistema **Atalaya** en su versión MVP. Su objetivo es traducir los requisitos definidos en el SRS (`SRS.md`) en una solución técnica concreta, descrita con suficiente detalle para guiar la implementación.

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
- `SRS.md`: Especificación de Requisitos de Software de Atalaya.
- Documentación oficial de FastAPI — https://fastapi.tiangolo.com/.
- Documentación oficial de psutil — https://psutil.readthedocs.io/.
- Documentación oficial de Svelte — https://svelte.dev/.

### 1.5 Visión general del documento

El documento está organizado en vistas, según la práctica recomendada por IEEE 1016. Cada vista presenta el diseño desde una perspectiva distinta:

- **Sección 2:** vista de contexto y stakeholders.
- **Sección 3:** vista de arquitectura (componentes, conexiones, despliegue).
- **Sección 4:** vista de datos *(pendiente, se añadirá en la siguiente iteración)*.
- **Sección 5:** vista de interfaces *(pendiente)*.
- **Sección 6:** vista de comportamiento *(pendiente)*.
- **Sección 7:** decisiones de diseño (ADRs).

Las secciones marcadas como pendientes se completarán a medida que se avance en la fase de diseño.

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

*Pendiente. Se completará tras la vista de datos.*

## 6. Vista de comportamiento

*Pendiente.*

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
