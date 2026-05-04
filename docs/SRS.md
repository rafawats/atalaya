# Atalaya — Especificación de Requisitos de Software (SRS)

**Versión:** 0.2 (MVP)
**Fecha:** 2026-05-04
**Estado:** Borrador
**Estándar de referencia:** IEEE 830-1998

---

## 1. Introducción

### 1.1 Propósito

Este documento define los requisitos funcionales y no funcionales del sistema **Atalaya** en su versión MVP. Su objetivo es servir como referencia única para las fases posteriores del ciclo de vida de desarrollo (diseño, implementación, pruebas y despliegue), y como contrato entre la visión del proyecto y su realización técnica.

Está dirigido al desarrollador del proyecto (autor único), pero su estructura permite que cualquier colaborador futuro entienda el alcance y los criterios de aceptación sin contexto adicional.

### 1.2 Alcance

**Nombre del producto:** Atalaya.

**Qué hace:** Atalaya es una aplicación web local que permite al usuario monitorear en tiempo real e históricamente las métricas de hardware y sistema operativo de la máquina donde se ejecuta. Provee una interfaz visual accesible vía navegador en `localhost`.

**Qué no hace:**
- No monitorea máquinas remotas.
- No funciona como servicio multiusuario ni en la nube.
- No envía datos a terceros.
- No reemplaza herramientas profesionales de observabilidad (Prometheus, Grafana, Datadog).

**Beneficios:** ofrece una herramienta personal, ligera y portable para inspeccionar el estado del sistema, sin requerir instalación de dependencias ni configuración de servicios.

**Objetivos:**
- Distribuirse como un único binario por sistema operativo.
- Cubrir el ciclo completo de SDLC como proyecto de aprendizaje.
- Sentar una base extensible para incorporar métricas adicionales en versiones futuras.

### 1.3 Definiciones, acrónimos y abreviaturas

| Término | Definición |
|---------|-----------|
| **SRS** | Software Requirements Specification (Especificación de Requisitos de Software). |
| **MVP** | Minimum Viable Product (Producto Mínimo Viable). |
| **SDLC** | Software Development Life Cycle (Ciclo de Vida de Desarrollo de Software). |
| **API** | Application Programming Interface. |
| **REST** | Representational State Transfer. Estilo arquitectónico para APIs HTTP. |
| **WebSocket** | Protocolo de comunicación bidireccional sobre TCP, sobre HTTP. |
| **Host** | Máquina física o virtual donde corre Atalaya. |
| **Métrica** | Valor numérico medido del sistema (uso de CPU, memoria libre, etc.). |
| **Snapshot** | Conjunto de métricas tomadas en un instante dado. |
| **Agregación** | Proceso de reducir la resolución temporal de datos históricos (ej. promediar muestras de 1s en una de 1min). |
| **Retención** | Política que define cuánto tiempo se conservan los datos antes de ser eliminados. |
| **psutil** | Librería de Python para acceso multiplataforma a información del sistema. |
| **FastAPI** | Framework web de Python para construir APIs. |
| **Svelte** | Framework de frontend basado en compilación. |
| **PyInstaller** | Herramienta para empaquetar aplicaciones Python como binarios ejecutables. |
| **uv** | Gestor de paquetes y entornos para Python. |
| **SQLite** | Motor de base de datos relacional embebida basado en archivo. |
| **localhost** | Dirección de red `127.0.0.1`, accesible solo desde la propia máquina. |
| **RF / RNF** | Requisito Funcional / Requisito No Funcional. |

### 1.4 Referencias

- IEEE Std 830-1998: *IEEE Recommended Practice for Software Requirements Specifications*.
- Netdata — https://www.netdata.cloud/ — referencia de inspiración para métricas en tiempo real.
- Glances — https://nicolargo.github.io/glances/ — referencia de inspiración por su modo web.
- Scrutiny — https://github.com/AnalogJ/scrutiny — referencia de inspiración por su distribución y UX.
- Documentación oficial de FastAPI — https://fastapi.tiangolo.com/.
- Documentación oficial de psutil — https://psutil.readthedocs.io/.
- Documentación oficial de Svelte — https://svelte.dev/.

### 1.5 Visión general del documento

El resto del documento se organiza en tres secciones principales. La sección 2 ofrece una descripción general del producto, sus usuarios y su contexto. La sección 3 detalla los requisitos específicos: funcionales, no funcionales, de interfaz y de datos. La sección 4 contiene los criterios de aceptación y el roadmap orientativo posterior al MVP.

---

## 2. Descripción general

### 2.1 Perspectiva del producto

Atalaya es un producto **autónomo** (no es un componente de un sistema mayor). Su única dependencia externa es el sistema operativo del host, del cual lee información mediante llamadas estándar (vía la librería psutil).

El producto se compone internamente de dos elementos lógicos que se distribuyen como un único artefacto:

- Un **backend** que lee el hardware, persiste métricas y expone una API HTTP/WebSocket.
- Un **frontend** web que consume la API y presenta la información al usuario.

Ambos se empaquetan en un solo binario por sistema operativo. El backend sirve los archivos estáticos del frontend, de modo que el usuario interactúa con un único proceso y un único puerto.

### 2.2 Funciones del producto

A alto nivel, Atalaya permite al usuario:

- Visualizar en tiempo real el uso de CPU, RAM y disco del host.
- Consultar el histórico reciente de dichas métricas (última hora con detalle fino, últimos 7 días con detalle agregado).
- Acceder a la interfaz desde cualquier navegador moderno apuntando a `localhost`.

### 2.3 Características de los usuarios

**Perfil único: usuario técnico individual.**

- Conocimientos: familiarizado con conceptos básicos de sistemas operativos (CPU, memoria, disco) y cómo abrir un navegador.
- Frecuencia de uso: ocasional o continua, según interés.
- Privilegios: corre la aplicación en su propia máquina; no comparte la instancia con otros.

No se contemplan perfiles diferenciados (administrador / lector / etc.) porque el modelo es estrictamente single-user, single-host.

### 2.4 Restricciones generales

- **R-01 (Plataforma):** debe funcionar en Linux, Windows y macOS.
- **R-02 (Lenguaje del backend):** Python 3.12 o superior.
- **R-03 (Distribución):** debe distribuirse como binario único por SO; no se requiere que el usuario instale Python, Node, Docker ni ningún runtime.
- **R-04 (Red):** el servidor solo escucha en `127.0.0.1`; no se expone a la red.
- **R-05 (Sin autenticación):** el modelo de amenaza asume que quien tiene acceso físico/sesión a la máquina ya tiene acceso a la información del sistema.
- **R-06 (Almacenamiento local):** toda la persistencia ocurre en un archivo SQLite local; no hay servicios externos.

### 2.5 Suposiciones y dependencias

- **S-01:** el usuario tiene un navegador moderno instalado (Chrome, Firefox, Edge o Safari en versiones de los últimos 2 años).
- **S-02:** el usuario tiene permisos suficientes para que psutil lea las métricas básicas del sistema (en la práctica, esto se cumple para CPU, RAM y disco sin privilegios elevados).
- **S-03:** el sistema operativo expone las métricas mediante las APIs estándar que psutil utiliza.
- **S-04:** el puerto que la aplicación intentará usar (por definir en diseño) está disponible o la aplicación puede elegir uno alternativo.
- **D-01:** depende de psutil para la lectura multiplataforma de métricas.
- **D-02:** depende de PyInstaller (o equivalente) para el empaquetado.

---

## 3. Requisitos específicos

### 3.1 Requisitos funcionales

| ID | Descripción | Prioridad |
|----|-------------|-----------|
| RF-01 | El sistema debe leer el porcentaje de uso global y por núcleo de CPU del host. | Must |
| RF-02 | El sistema debe leer la memoria RAM total, usada, disponible y porcentaje de uso. | Must |
| RF-03 | El sistema debe leer el espacio total, usado y libre por partición de disco montada. | Must |
| RF-04 | El sistema debe exponer un endpoint HTTP que devuelva el snapshot actual de métricas en formato JSON. | Must |
| RF-05 | El sistema debe exponer un canal WebSocket que envíe métricas actualizadas con un intervalo aproximado de 1 segundo. | Must |
| RF-06 | El sistema debe persistir las métricas en una base de datos SQLite local. | Must |
| RF-07 | El sistema debe exponer un endpoint HTTP que permita consultar el histórico, recibiendo como parámetros el rango temporal solicitado. | Must |
| RF-08 | El sistema debe agregar automáticamente los datos de más de 1 hora de antigüedad a una resolución de 1 minuto. | Must |
| RF-09 | El sistema debe eliminar automáticamente los datos de más de 7 días de antigüedad. | Must |
| RF-10 | El backend debe servir los archivos estáticos del frontend desde el mismo proceso y puerto que la API. | Must |
| RF-11 | El frontend debe mostrar los valores actuales de CPU, RAM y disco. | Must |
| RF-12 | El frontend debe mostrar gráficas temporales de las métricas. | Must |
| RF-13 | El frontend debe permitir al usuario seleccionar la ventana de tiempo a visualizar entre "última hora" y "últimos 7 días". | Must |
| RF-14 | El frontend debe actualizarse en tiempo real a medida que el WebSocket entrega nuevos datos. | Must |

### 3.2 Requisitos no funcionales

#### 3.2.1 Rendimiento

| ID | Descripción |
|----|-------------|
| RNF-01 | El consumo de CPU del backend en idle debe ser inferior al 2% en una máquina moderna de escritorio. |
| RNF-02 | La latencia entre la lectura de una métrica y su entrega por WebSocket al frontend debe ser inferior a 1.5 segundos. |
| RNF-03 | Una consulta histórica de los últimos 7 días debe responder en menos de 500 ms. |

#### 3.2.2 Seguridad

| ID | Descripción |
|----|-------------|
| RNF-04 | El servidor debe escuchar exclusivamente en la interfaz `127.0.0.1`. |
| RNF-05 | El sistema no debe enviar datos fuera del host bajo ninguna circunstancia. |

#### 3.2.3 Usabilidad

| ID | Descripción |
|----|-------------|
| RNF-06 | El usuario debe poder iniciar la aplicación y ver el dashboard funcional en menos de 10 segundos desde la ejecución del binario. |
| RNF-07 | La interfaz debe ser legible en pantallas con resolución mínima de 1280×720. |

#### 3.2.4 Portabilidad

| ID | Descripción |
|----|-------------|
| RNF-08 | El sistema debe funcionar en Linux (kernel 5.x o superior), Windows 10/11 y macOS 12 o superior. |
| RNF-09 | El binario distribuido no debe requerir la instalación previa de Python, Node ni ningún runtime adicional. |

#### 3.2.5 Mantenibilidad

| ID | Descripción |
|----|-------------|
| RNF-10 | El código debe contar con tests automatizados para la lógica de lectura, persistencia y agregación de métricas. |
| RNF-11 | Las dependencias deben estar fijadas mediante lockfile (`uv.lock` para Python, `package-lock.json` para frontend). |
| RNF-12 | El código debe seguir convenciones de estilo verificables automáticamente (ruff/black para Python, prettier para frontend). |

#### 3.2.6 Almacenamiento

| ID | Descripción |
|----|-------------|
| RNF-13 | El tamaño de la base de datos en uso normal no debe exceder 100 MB. |

### 3.3 Requisitos de interfaz

#### 3.3.1 Interfaces de usuario

El sistema expone una única interfaz web accesible desde el navegador en `http://127.0.0.1:<puerto>`. El diseño visual detallado se definirá en la fase de diseño; los requisitos mínimos son:

- Vista de dashboard único con secciones diferenciadas para CPU, RAM y disco.
- Selector de rango temporal para gráficas históricas.
- Indicadores numéricos de los valores actuales.

#### 3.3.2 Interfaces de hardware

El sistema accede al hardware del host únicamente a través de las APIs del sistema operativo expuestas por psutil. No se realizan accesos directos a dispositivos.

#### 3.3.3 Interfaces de software

- **Sistema operativo:** Linux, Windows o macOS, mediante llamadas estándar de psutil.
- **Navegador del cliente:** comunicación HTTP y WebSocket sobre `localhost`.

#### 3.3.4 Interfaces de comunicación

- **HTTP/REST** sobre `localhost` para consultas puntuales (snapshot actual, histórico).
- **WebSocket** sobre `localhost` para actualizaciones en tiempo real.

El contrato detallado de la API (endpoints, esquemas, códigos de respuesta) se definirá en el documento de diseño.

### 3.4 Requisitos de datos

| ID | Descripción |
|----|-------------|
| RD-01 | Las métricas se almacenan en una base de datos SQLite contenida en un único archivo en disco. |
| RD-02 | Cada muestra debe registrar al menos: marca de tiempo (UTC), tipo de métrica e identificador (núcleo de CPU, partición, etc.) y valor. |
| RD-03 | El esquema debe distinguir entre datos de alta resolución (últimos 60 minutos, ~1s) y datos agregados (últimos 7 días, ~1min). |
| RD-04 | La integridad referencial entre tablas (si la hubiera) debe garantizarse mediante restricciones del esquema. |

El modelo lógico y físico detallado se definirá en el documento de diseño.

---

## 4. Apéndices

### 4.1 Criterios de aceptación del MVP

El MVP se considerará completo cuando se cumplan todas las siguientes condiciones:

1. Existan binarios funcionales para Linux, Windows y macOS publicados como release en el repositorio de GitHub.
2. Al ejecutar el binario, el usuario pueda abrir `http://127.0.0.1:<puerto>` en su navegador y ver un dashboard con CPU, RAM y disco actualizándose en tiempo real.
3. El dashboard permita alternar entre las vistas de "última hora" y "últimos 7 días" para los datos históricos.
4. La aplicación se mantenga corriendo de forma estable durante al menos 24 horas continuas sin fugas de memoria notables (crecimiento de RAM inferior a 50 MB en ese periodo).
5. Exista documentación básica (README) que explique cómo descargar, ejecutar y usar la aplicación.
6. Todos los requisitos marcados como **Must** en la sección 3.1 estén implementados y verificables.

### 4.2 Roadmap post-MVP (orientativo, no comprometido)

1. Métricas de red (interfaces, throughput, conexiones activas).
2. Listado y monitoreo de procesos.
3. Temperaturas de CPU.
4. Información y temperaturas de GPU.
5. Dispositivos conectados (USB, periféricos).
6. Sistema de alertas configurables.
7. Tema oscuro y opciones de personalización visual.
8. Exportación de datos históricos (CSV, JSON).

### 4.3 Trazabilidad

Cada requisito (RF-XX, RNF-XX, RD-XX) deberá poder rastrearse a:
- Un componente del diseño que lo implementa.
- Al menos un caso de prueba que lo verifica.

La matriz de trazabilidad se mantendrá como artefacto vivo durante el desarrollo.