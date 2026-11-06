# Configuración del laboratorio de Proxmox y Kubernetes

Este documento registra la instalación y validación de un entorno pequeño de
Kubernetes alojado en Proxmox VE.

# Grupo 8 — KubeLab

## Inventario de red, infraestructura y servicios de Kubernetes

> **Fuente:** salidas verificadas con `k3s kubectl get nodes`, `get svc -A -o wide`, `get pods -A -o wide`, `get pvc -A`, `get ingressroute -A` y `get ingress -A`, más las direcciones de la infraestructura confirmadas durante la práctica. Las IP de los pods representan una captura puntual y pueden cambiar si se recrean.

### 1. Infraestructura física y red local

| Elemento | Identificador | Dirección IPv4 | Red / máscara | Función |
|---|---|---|---|---|
| Laptop Windows (ICS) | Interfaz Ethernet compartida | `192.168.137.1` | `192.168.137.0/24` | Puerta de enlace, NAT y acceso a Internet para Proxmox y las VMs |
| Host Proxmox VE | Hipervisor físico | `192.168.137.2` | `192.168.137.0/24` | Alojamiento de las máquinas virtuales |
| VM101 — Control Plane | `k8s-control` | `192.168.137.159` | `192.168.137.0/24` | Servidor k3s y administración de Kubernetes |
| VM102 — Worker 1 | `k8s-worker1` | `192.168.137.47` | `192.168.137.0/24` | Ejecución de cargas de trabajo |
| MetalLB / Traefik | IP externa del Service `traefik` | `192.168.137.240` | `192.168.137.0/24` | Punto de entrada HTTP/HTTPS al clúster |
| Wi-Fi de Windows | Conexión ascendente | Asignada por DHCP | Variable según Wi-Fi u hotspot | Salida a Internet de Windows, compartida por ICS |

**Parámetros de infraestructura:** red `192.168.137.0/24`; gateway `192.168.137.1`; hipervisor `192.168.137.2`; nodos con IP estática `192.168.137.159` y `192.168.137.47`; dirección LoadBalancer `192.168.137.240`.

### 2. Red de Kubernetes y CNI

| Componente | Dirección o rango | Alcance / observación |
|---|---|---|
| Red de nodos | `192.168.137.0/24` | Comunicación entre host y VMs |
| Pod CIDR del Control Plane | `10.42.0.0/24` | Asignado a `k8s-control` |
| Pod CIDR del Worker 1 | `10.42.1.0/24` | Asignado a `k8s-worker1` |
| Espacio de direcciones de pods | `10.42.x.x` | Observado en las IP de pods |
| Espacio de servicios ClusterIP | `10.43.x.x` | Observado en los Services |
| DNS de Kubernetes (CoreDNS) | `10.43.0.10` | Puerto `53/UDP` y `53/TCP` |
| Servicio de la API de Kubernetes | `10.43.0.1` | Puerto `443/TCP` |
| LoadBalancer de Traefik | `192.168.137.240` | Puertos externos `80/TCP` y `443/TCP` |

### 3. Direccionamiento de Services

| Namespace | Service | Tipo | ClusterIP | IP externa | Puertos |
|---|---|---|---|---|---|
| `argocd` | `argocd-applicationset-controller` | ClusterIP | `10.43.164.248` | — | `7000/TCP` |
| `argocd` | `argocd-redis` | ClusterIP | `10.43.137.29` | — | `6379/TCP` |
| `argocd` | `argocd-repo-server` | ClusterIP | `10.43.111.136` | — | `8081/TCP` |
| `argocd` | `argocd-server` | ClusterIP | `10.43.231.31` | — | `80/TCP`, `443/TCP` |
| `default` | `kubernetes` | ClusterIP | `10.43.0.1` | — | `443/TCP` |
| `kube-system` | `kube-dns` | ClusterIP | `10.43.0.10` | — | `53/UDP`, `53/TCP`, `9153/TCP` |
| `kube-system` | `metrics-server` | ClusterIP | `10.43.230.197` | — | `443/TCP` |
| `kube-system` | `traefik` | LoadBalancer | `10.43.14.170` | `192.168.137.240` | `80:32464/TCP`, `443:30888/TCP` |
| `kubelab` | `kubelab-api` | ClusterIP | `10.43.203.232` | — | `80/TCP` |
| `kubelab` | `kubelab-web` | ClusterIP | `10.43.235.164` | — | `80/TCP` |
| `kubelab` | `postgresql` | Headless (`ClusterIP: None`) | — | — | `5432/TCP` |
| `metallb-system` | `metallb-webhook-service` | ClusterIP | `10.43.222.21` | — | `443/TCP` |
| `monitoring` | `grafana` | ClusterIP | `10.43.120.215` | — | `80/TCP` |
| `monitoring` | `loki` | ClusterIP | `10.43.113.2` | — | `3100/TCP` |
| `monitoring` | `prometheus-server` | ClusterIP | `10.43.20.109` | — | `80/TCP` |

> PostgreSQL utiliza un Service **headless**: no tiene una ClusterIP virtual. Su DNS interno puede resolver directamente las IP de los endpoints asociados.

### 4. Direcciones DNS internas de servicios principales

| Componente | Dirección dentro de Kubernetes | Puerto |
|---|---|---|
| Frontend | `kubelab-web.kubelab.svc.cluster.local` | `80` |
| API REST | `kubelab-api.kubelab.svc.cluster.local` | `80` |
| PostgreSQL | `postgresql.kubelab.svc.cluster.local` | `5432` |
| Grafana | `grafana.monitoring.svc.cluster.local` | `80` |
| Prometheus | `prometheus-server.monitoring.svc.cluster.local` | `80` |
| Loki | `loki.monitoring.svc.cluster.local` | `3100` |
| Argo CD | `argocd-server.argocd.svc.cluster.local` | `80`, `443` |
| Traefik | `traefik.kube-system.svc.cluster.local` | `80`, `443` |
| CoreDNS | `kube-dns.kube-system.svc.cluster.local` | `53` |

### 5. IP y ubicación de pods

| Namespace | Pod | IP registrada | Nodo | Estado observado |
|---|---|---|---|---|
| `argocd` | `argocd-application-controller-0` | `10.42.1.41` | `k8s-worker1` | Running |
| `argocd` | `argocd-applicationset-controller-74887bfd8f-9lfkg` | `10.42.1.36` | `k8s-worker1` | Running |
| `argocd` | `argocd-redis-85d66966f9-544r8` | `10.42.1.38` | `k8s-worker1` | Running |
| `argocd` | `argocd-repo-server-668df84947-l2s7r` | `10.42.1.42` | `k8s-worker1` | Running |
| `argocd` | `argocd-server-57fd8796b8-qtldc` | `10.42.1.37` | `k8s-worker1` | Running |
| `default` | `kubelab-storage-test-7ccbd46fcd-xh6jf` | `10.42.1.39` | `k8s-worker1` | Running |
| `doppler-operator-system` | `doppler-operator-controller-manager-5cc574c984-chw9d` | `10.42.0.58` | `k8s-control` | Running |
| `kube-system` | `coredns-7cfb7bc9c7-wf6j2` | `10.42.0.62` | `k8s-control` | Running |
| `kube-system` | `helm-install-traefik-crd-vf6vb` | — | `k8s-control` | Completed |
| `kube-system` | `helm-install-traefik-rwmwq` | — | `k8s-control` | Completed |
| `kube-system` | `local-path-provisioner-77b9867795-qhkcz` | `10.42.0.63` | `k8s-control` | Running |
| `kube-system` | `metrics-server-6dc596dfb8-d8r6p` | `10.42.0.61` | `k8s-control` | Running |
| `kube-system` | `svclb-traefik-e90f165b-l7j48` | `10.42.0.60` | `k8s-control` | Running (2/2) |
| `kube-system` | `svclb-traefik-e90f165b-xrl8v` | `10.42.1.35` | `k8s-worker1` | Running (2/2) |
| `kube-system` | `traefik-7c8544f77-mv8gv` | `10.42.0.59` | `k8s-control` | Running |
| `kubelab` | `kubelab-api-5d8744685f-2mcf8` | `10.42.1.33` | `k8s-worker1` | Running |
| `kubelab` | `kubelab-web-676d6dcd6c-pps4l` | `10.42.1.40` | `k8s-worker1` | Running |
| `kubelab` | `postgresql-0` | `10.42.1.34` | `k8s-worker1` | Running |
| `metallb-system` | `controller-658745d67-srdcn` | `10.42.0.64` | `k8s-control` | Running |
| `metallb-system` | `speaker-bdsw9` | `192.168.137.47` | `k8s-worker1` | Running (IP del nodo) |
| `metallb-system` | `speaker-qrh6k` | `192.168.137.159` | `k8s-control` | Running (IP del nodo) |
| `monitoring` | `alloy-54f4898cdd-tr9w7` | `10.42.1.45` | `k8s-worker1` | Running |
| `monitoring` | `grafana-7b6444755c-7kmw2` | `10.42.0.68` | `k8s-control` | Running |
| `monitoring` | `loki-78c6c7f495-gnfzt` | `10.42.1.44` | `k8s-worker1` | Running |
| `monitoring` | `prometheus-server-8d76cfd5d-dc547` | `10.42.0.65` | `k8s-control` | Running (2/2; con reinicios registrados) |

> Los `speaker` de MetalLB aparecen con IP de nodo; no se les asignó en esta captura una dirección de la red `10.42.x.x`. Los Jobs de instalación de Traefik aparecen como **Completed**, que es su estado esperado.

### 6. Almacenamiento persistente (PVC)

| Namespace | PVC | Capacidad | Acceso | StorageClass | Estado | PV asociado |
|---|---|---|---|---|---|---|
| `default` | `kubelab-storage-test` | `1Gi` | RWO | `local-path` | Bound | `pvc-87fcb996-6dd3-45e3-a9ce-77aac052c68c` |
| `kubelab` | `postgres-data-postgresql-0` | `2Gi` | RWO | `local-path` | Bound | `pvc-daff0bae-fe60-4714-bee4-a14fb2cc89a6` |
| `monitoring` | `grafana` | `1Gi` | RWO | `local-path` | Bound | `pvc-fe6b4249-2675-4fa5-9327-7a5efcc8cf28` |
| `monitoring` | `loki-data` | `2Gi` | RWO | `local-path` | Bound | `pvc-0070a4ee-500e-4554-ac10-5e049eca83ff` |
| `monitoring` | `prometheus-server` | `2Gi` | RWO | `local-path` | Bound | `pvc-617f56ae-9dfa-400b-a035-e0fcba336856` |
| **Total** | **5 PVC** | **8Gi** | — | `local-path` | **5 Bound** | — |


### 7. Enrutamiento y dominios realmente utilizados

| Namespace | Recurso | Observación |
|---|---|---|
| `kubelab` | `IngressRoute/kubelab-api` | Ruta Traefik del backend |
| `kubelab` | `IngressRoute/kubelab-web` | Ruta Traefik del frontend |
| `monitoring` | `IngressRoute/grafana` | Ruta Traefik de Grafana |


### 8. Observaciones de operación

- El clúster está formado por **un Control Plane y un Worker**, ambos registrados como `Ready` en las comprobaciones previas.
- El frontend cuenta con HPA configurado de **1 a 2 réplicas**; durante la prueba se observaron eventos de escalado automático `1 → 2 → 1` motivados por métricas de CPU.
- Se comprobó la continuidad de la infraestructura al cambiar la conexión ascendente de Windows desde Wi-Fi doméstico a un hotspot celular, manteniendo ICS y las IP estáticas internas.

# Pasos realizados

## 1. Instalación de Proxmox VE

El resumen del instalador de Proxmox VE confirma el disco de destino, el
sistema de archivos, la configuración regional, la zona horaria, la interfaz
de administración, el nombre del host, la dirección IP estática, la puerta de
enlace y el DNS antes de iniciar la instalación. El reinicio automático está
habilitado para que el host se reinicie cuando finalice la instalación.

![Instalación de Proxmox](docs/img/proxomox_install.png)

Después de la instalación, la consola de Proxmox muestra la URL de
administración. Esta consola confirma que el host se inició correctamente y
está listo para administrarse mediante la interfaz web.

![Consola de Proxmox](docs/img/proxmox_console.png)

## 2. Configuración de red de Proxmox

Los comandos `ip -br link` e `ip -br addr` muestran el estado de las
interfaces del host. La interfaz física está conectada al puente de Proxmox y
el puente tiene la dirección IPv4 del host. Esto verifica que el host cuenta
con conectividad de red para la administración y las máquinas virtuales.

![Configuración Ethernet de Proxmox](docs/img/proxmox_ethernet.png)

## 3. Interfaz web de Proxmox y almacenamiento de máquinas virtuales

La interfaz web de Proxmox proporciona la vista central de administración del
datacenter. Muestra el nodo de Proxmox, el puente de red, los almacenes y el
uso actual de recursos, lo que confirma que el host está visible y puede
administrarse.

![Interfaz web de Proxmox](docs/img/proxmox_gui.png)

La vista de almacenamiento muestra el almacén `local` y su capacidad
disponible. También muestra la máquina virtual del control plane y registra
tareas recientes, como la creación de la máquina virtual, la copia de datos y
su inicio.

![Almacenamiento y actividad de la máquina virtual](docs/img/proxmox_running_vm.png)

## 4. Máquina virtual del control plane

La consola del control plane muestra Debian GNU/Linux 13 ejecutándose en la
máquina virtual `k8s-control`. El inicio de sesión correcto y el indicador de
comandos confirman que el sistema operativo está instalado y que la máquina
virtual es accesible desde la consola de Proxmox.

![Consola del control plane](docs/img/debian_console.png)

### 4.1 Conectividad del control plane

La terminal del control plane muestra primero la información de red del
nodo y después ejecuta `apt update`. Las respuestas correctas de los
repositorios y el resultado final actualizado verifican que la máquina virtual
puede acceder a los repositorios de paquetes de Debian.

![Conectividad y actualización de paquetes del control plane](docs/img/control_plane_apt_update.png)

### 4.2 Servicios de Kubernetes del control plane

Las métricas del control plane muestran las cargas de trabajo de Kubernetes
ejecutándose en el espacio de nombres `kube-system`, incluidos CoreDNS, el
servidor de métricas, el provisionador de rutas locales y Traefik. La salida
también muestra la dirección IPv4 del nodo y las interfaces Flannel y CNI
utilizadas para la red de los pods.

![Estado y métricas de Kubernetes del control plane](docs/img/control_plane_metrics.png)

## 5. Máquina virtual Worker 1

La consola de Worker 1 muestra Debian GNU/Linux 13 ejecutándose en la máquina
virtual `k8s-worker1`. El inicio de sesión correcto y el indicador de comandos
confirman que el sistema operativo del worker está disponible para configurarlo
con Kubernetes.

![Consola de Worker 1](docs/img/worker1_console.png)

### 5.1 Conectividad de red de Worker 1

La terminal del worker utiliza `ping google.com` para probar la conectividad
externa. El comando resuelve el nombre de host y comienza a recibir
respuestas ICMP, lo que confirma que Worker 1 puede acceder a la red.

![Prueba de conectividad de Worker 1](docs/img/worker1_k8s_install.png)

### 5.2 Instalación de Kubernetes en Worker 1

La salida del estado de Kubernetes muestra el nodo del control plane en
estado `Ready` y los pods del sistema de Kubernetes ejecutándose en Worker 1.
La salida también muestra la dirección IPv4 interna del worker, la interfaz
Flannel y la interfaz CNI, lo que confirma que el nodo se unió al clúster y
que tiene configurada la red de pods.

![Estado de Kubernetes en Worker 1](docs/img/worker1_metrics.png)

## 6. Memoria del host y asignación de máquinas virtuales

La salida de los comandos `free -h`, `swapon --show` y `qm list` valida la
asignación de recursos del host desde la línea de comandos. Muestra la memoria
total y disponible, el espacio swap activo y las cuatro máquinas virtuales en
ejecución, junto con la memoria y el tamaño de disco de arranque asignados.

![Memoria del host y asignación de máquinas virtuales](docs/img/host_ram_usage.png)

## 7. Validación final de los cuatro nodos

El árbol de nodos de Proxmox confirma que la máquina virtual del plano de
control y las tres máquinas virtuales worker están ejecutándose
simultáneamente. Esta es la comprobación final de la infraestructura antes de
utilizar el clúster de Kubernetes.

![Los cuatro nodos de Kubernetes en ejecución](docs/img/nodes_running.png)

### 7.1 Servicios de k3s y Traefik

La lista de servicios de k3s confirma que los componentes principales del
clúster están activos. También muestra el servicio Traefik, que proporciona
la entrada de tráfico HTTP y HTTPS hacia las aplicaciones desplegadas.

![Servicios de k3s, incluido Traefik](docs/img/k3s_traefik.png)

### 7.2 Recursos administrados por Helm

La salida de Helm muestra los recursos instalados y administrados mediante
releases. Esta comprobación confirma que las aplicaciones y sus componentes
asociados fueron desplegados correctamente en el clúster.

![Recursos administrados por Helm](docs/img/helm_resources.png)

### 7.3 Verificación de taints

La verificación de taints muestra las restricciones configuradas en los nodos
de Kubernetes. Esto permite confirmar qué nodos pueden recibir determinados
pods y que las reglas de programación del clúster están aplicadas.

![Verificación de taints](docs/img/taints_verification.png)

### 7.4 Instalación de Argo CD

La salida de la instalación de Argo CD confirma que sus recursos fueron
creados correctamente en el clúster de Kubernetes. Esta herramienta permite
gestionar las aplicaciones mediante un enfoque de entrega continua basado en
GitOps.

![Instalación de Argo CD](docs/img/argocd_installation.png)

### 7.5 Aplicación de MetalLB

La captura muestra la aplicación de MetalLB desplegada en el clúster de
Kubernetes. MetalLB proporciona balanceo de carga para exponer servicios con
direcciones IP accesibles desde la red local.

![Aplicación de MetalLB](docs/img/metallb_application.png)

### 7.6 Configuración funcional de MetalLB

La captura confirma que la configuración de MetalLB se encuentra funcionando
correctamente. La asignación de direcciones IP permite que los servicios
publicados mediante `LoadBalancer` sean accesibles desde la red configurada.

![Configuración funcional de MetalLB](docs/img/metalLB_installation_guide.png)

### 7.7 Aplicación de Traefik

La captura muestra la aplicación de Traefik desplegada correctamente en el
clúster. Este componente administra el enrutamiento del tráfico entrante
hacia los servicios publicados por Kubernetes.

![Traefik aplicado](docs/img/traefik_applied.png)

### 7.8 Evidencia de persistencia de datos

La evidencia confirma que los datos de la aplicación permanecen disponibles
después de las operaciones realizadas sobre el pod. Esto demuestra que el
almacenamiento persistente está funcionando correctamente.

![Evidencia de persistencia](docs/img/persistence_evidence.png)

### 7.9 Despliegue de la StorageClass

La captura muestra la creación y configuración de la `StorageClass` utilizada
por Kubernetes para aprovisionar almacenamiento persistente. Esta configuración
permite que las aplicaciones soliciten volúmenes según sus necesidades.

![Despliegue de la StorageClass](docs/img/storageclass_deployment.png)

### 7.10 Prueba de eliminación del pod

La prueba muestra la eliminación controlada de un pod para verificar el
comportamiento de recuperación de la aplicación. Esta operación permite
comprobar que Kubernetes puede detectar y gestionar la ausencia del pod.

![Prueba de eliminación del pod](docs/img/test_pod_deleted.png)

### 7.11 Recreación del pod y recuperación de datos

La captura muestra la recreación del pod y la recuperación de los datos
previamente almacenados. El resultado confirma que la aplicación conserva la
información mediante el volumen persistente después de reiniciarse.

![Recreación del pod y recuperación de datos](docs/img/pod_recreation.png)

## 8. Gestión segura de secretos con Doppler

### 8.0 Dashboard de Doppler

La captura muestra el Dashboard de Doppler con los secretos, sin revelar, que gestiona, para el proyecto.

![doppler dashboard](docs/img/doppler_dashboard.png)

### 8.1 Aplicación de Doppler

La captura muestra Doppler aplicado en el clúster de Kubernetes. Esta
integración permite administrar los secretos de las aplicaciones desde una
fuente centralizada y evitar su almacenamiento directo en los manifiestos.

![Doppler aplicado](docs/img/doppler_applied.png)

### 8.2 Secretos administrados por Doppler

La vista de Doppler muestra los secretos configurados para el proyecto. Esto
confirma que las credenciales necesarias están disponibles en el gestor de
secretos para ser utilizadas por las aplicaciones autorizadas.

![Secretos administrados por Doppler](docs/img/dopller_secrets.png)

### 8.3 Namespace de secretos

La captura confirma la existencia del namespace destinado a los secretos de
la aplicación. Separar estos recursos facilita su administración y limita el
alcance de los componentes que pueden acceder a ellos.

![Namespace de secretos](docs/img/secrets_namespace.png)

### 8.4 Creación del token de Doppler

La salida muestra la creación del token utilizado para conectar Kubernetes
con Doppler. Este token permite sincronizar los secretos de forma controlada
sin exponer las credenciales directamente en los archivos de configuración.

![Token de Doppler](docs/img/doppler_token_created.png)

### 8.5 Deshabilitación de credenciales anteriores

La captura evidencia que la credencial anterior fue deshabilitada después de
la configuración de Doppler. Esta acción evita que un token antiguo continúe
teniendo acceso a los secretos del proyecto.

![Credencial anterior deshabilitada](docs/img/old_credential_disabled.png)

### 8.6 Aplicación de los secretos de Doppler

La salida confirma que los secretos de Doppler fueron aplicados correctamente
en Kubernetes. La aplicación puede consumirlos sin que sus valores queden
expuestos en los manifiestos del clúster.

![Secretos de Doppler aplicados](docs/img/doppler_secrets_applied.png)

## 9. Validación de PostgreSQL

### 9.1 Credenciales de PostgreSQL en Doppler

La captura muestra las credenciales de PostgreSQL almacenadas en Doppler.
Esto confirma que los datos sensibles de conexión están centralizados y
disponibles para el despliegue autorizado de la base de datos.

![Credenciales de PostgreSQL en Doppler](docs/img/postgres_credentials_doppler.png)

### 9.2 Verificación de las credenciales de PostgreSQL

La verificación confirma que PostgreSQL recibe y utiliza correctamente las
credenciales administradas por Doppler. Esta comprobación valida la conexión
entre el gestor de secretos y la aplicación de base de datos.

![Verificación de las credenciales de PostgreSQL](docs/img/postgres_credentials_verification.png)

### 9.3 Persistencia de PostgreSQL

La captura muestra PostgreSQL funcionando con almacenamiento persistente.
Esto garantiza que los datos de la base de datos se conserven aunque el pod
sea reiniciado o recreado.

![Persistencia de PostgreSQL](docs/img/postgres_persistence.png)

### 9.4 Acceso mediante port forwarding

El reenvío de puertos permite acceder temporalmente al servicio de PostgreSQL
desde el entorno local para realizar comprobaciones. Esta técnica facilita la
validación del servicio sin exponerlo permanentemente fuera del clúster.

![Acceso mediante port forwarding](docs/img/port_forwarding.png)

### 9.5 Sincronización de PostgreSQL

La captura confirma la sincronización de PostgreSQL con la configuración
definida para la aplicación. Esta validación demuestra que la base de datos
está integrada correctamente con los secretos y el almacenamiento del
clúster.

![Sincronización de PostgreSQL](docs/img/postgrsql_sync.png)

## 10. Despliegue de la API y operaciones con PostgreSQL

### 10.1 Imagen de contenedor y servicios de la API

La captura muestra la imagen de contenedor de la API y los servicios
relacionados con su despliegue. Estos elementos permiten preparar la aplicación
para ejecutarse y comunicarse dentro del clúster.

![Servicios de la API e imagen de Docker](docs/img/docker_api_services.png)

### 10.2 Validación de los manifiestos

La salida muestra la validación de los manifiestos de Kubernetes antes de su
aplicación. Esta comprobación ayuda a detectar errores de configuración en los
recursos declarados.

![Validación de los manifiestos](docs/img/manifest_validation.png)

### 10.3 Aplicaciones de Argo CD

La vista de Argo CD muestra las aplicaciones registradas para su despliegue.
Permite revisar su estado y confirmar que están bajo la gestión del flujo
GitOps configurado.

![Aplicaciones de Argo CD](docs/img/agrocd_applications.png)

### 10.4 Pods administrados por Argo CD

La captura muestra los pods asociados a las aplicaciones de Argo CD y su estado
en Kubernetes. Esta revisión permite comprobar los recursos creados durante el
despliegue.

![Pods de Argo CD](docs/img/argocd_pods.png)

### 10.5 Estado de los servicios

La salida presenta los servicios creados para la aplicación y sus datos de
acceso. Esta información permite verificar cómo se exponen los componentes
dentro del clúster.

![Estado de los servicios](docs/img/svc_advance.png)

### 10.6 Conexión con la base de datos

La captura muestra la comprobación de conectividad entre la aplicación y
PostgreSQL. Esta prueba permite validar que la API puede comunicarse con la
base de datos configurada.

![Conexión con la base de datos](docs/img/db_connection.png)

### 10.7 Prueba del servicio de la API

La solicitud de prueba permite comprobar que el servicio de la API responde
desde el clúster. Es una verificación inicial de que el endpoint está
disponible.

![Prueba del servicio de la API](docs/img/api_test_service.png)

### 10.8 Inserción de datos en PostgreSQL

La captura muestra una operación de inserción enviada desde PowerShell para
crear un registro en PostgreSQL mediante la API.

![Inserción de datos desde PowerShell](docs/img/postgres_powershell_insert.png)

### 10.9 Consulta de datos con GET

La solicitud `GET` permite recuperar datos a través de la API y verificar que
los registros están disponibles para su lectura.

![Consulta de datos con GET](docs/img/postrgres_poweshell_get.png)

### 10.10 Consulta directa de registros

La captura muestra la consulta de los registros almacenados en PostgreSQL,
como comprobación de los datos disponibles en la base de datos.

![Consulta de registros de PostgreSQL](docs/img/postgres_powershell_select.png)

### 10.11 Actualización de datos con PUT

La solicitud `PUT` muestra la actualización de un registro existente mediante
la API.

![Actualización de datos con PUT](docs/img/postgres_powershell_put.png)

### 10.12 Verificación de la actualización

La consulta posterior a la operación `PUT` permite comprobar que los cambios
se guardaron en PostgreSQL.

![Verificación de la actualización en PostgreSQL](docs/img/postgres_powershell_put_select.png)

### 10.13 Eliminación y confirmación de datos

La captura muestra la eliminación de un registro y la comprobación posterior
de que ya no aparece en los resultados.

![Eliminación y confirmación de datos](docs/img/postgres_powershell_delete_confirm.png)

## 11. Despliegue de Kubelab y flujo CI/CD

### 11.1 Interfaz de Kubelab

La captura muestra la interfaz web de Kubelab, desde la que se accede a las
funciones de la aplicación.

![Interfaz de Kubelab](docs/img/kubelab_interface.png)

### 11.2 Despliegue de la Web API

La salida muestra el despliegue de la Web API en Kubernetes y los recursos
asociados a su puesta en marcha.

![Despliegue de la Web API](docs/img/webapi_deploy.png)

### 11.3 Verificación de la Web API

La captura muestra la Web API funcionando después del despliegue, como
comprobación de que la aplicación está disponible.

![Web API en funcionamiento](docs/img/webapi_depoly_working.png)

### 11.4 Servicios de Kubelab

La salida presenta los servicios de Kubelab en ejecución y permite verificar
los puntos de acceso configurados para la aplicación.

![Servicios de Kubelab en ejecución](docs/img/kubelab_services_running.png)

### 11.5 Despliegue mediante CI/CD

La captura muestra la ejecución del proceso de despliegue CI/CD para publicar
la aplicación en el clúster.

![Despliegue mediante CI/CD](docs/img/cicd_deploy.png)

### 11.6 Pods después del despliegue

La verificación muestra los pods existentes después del despliegue CI/CD y
permite revisar su estado en Kubernetes.

![Pods después del despliegue](docs/img/pods_after_deployment.png)

## 12. Monitoreo con Prometheus y Grafana

### 12.1 Pods de Prometheus

La captura muestra los pods de Prometheus y permite verificar el estado de los
componentes de monitoreo desplegados en Kubernetes.

![Pods de Prometheus](docs/img/prometheus_pods.png)

### 12.2 Interfaz de Prometheus

La interfaz de Prometheus permite consultar el estado del sistema de monitoreo
y explorar las métricas recopiladas.

![Interfaz de Prometheus](docs/img/prometheus_interface.png)

### 12.3 Monitoreo de la API

La captura muestra métricas asociadas a la Web API en Prometheus, para revisar
su actividad y comportamiento.

![Monitoreo de la Web API](docs/img/prometheus_api_monitoring.png)

### 12.4 Tráfico de la Web API y del sitio web

La visualización presenta métricas de tráfico de la Web API y del sitio web,
útiles para observar las solicitudes recibidas por los servicios.

![Tráfico de la Web API y del sitio web](docs/img/prometheus_web_api_traffic.png)

### 12.5 Estado de los pods y acceso a Grafana

La primera captura permite revisar el estado de salud de los pods asociados a
Grafana.

![Estado de los pods y puerto de Grafana](docs/img/grafana_pods_health.png)

La segunda captura verifica la dirección IP y el puerto configurados para
acceder a Grafana.

![Verificación de IP y puerto de Grafana](docs/img/grafana_port_ip_verification.png)

### 12.6 Paneles de Grafana

El panel de Grafana presenta las métricas recopiladas para facilitar la
supervisión visual del clúster y sus aplicaciones.

![Panel de Grafana](docs/img/grafana_dashboard.png)

### 12.7 Integración de Grafana con Prometheus

La captura muestra la configuración de Prometheus como fuente de datos de
Grafana, necesaria para consultar y visualizar sus métricas desde los paneles.

![Integración de Grafana con Prometheus](docs/img/grafana_prometheus_integration.png)

### 12.8 Conexión de la API de Kubelab

La captura muestra la conexión de Kubelab con su API, como parte de la
integración entre la interfaz y el servicio de backend.

![Conexión de la API de Kubelab](docs/img/kubelab_api_connection.png)

### 12.9 Métricas de Kubelab

La vista presenta las métricas disponibles para Kubelab y permite inspeccionar
la información expuesta por la aplicación para su monitoreo.

![Métricas de Kubelab](docs/img/kubelab_metrics.png)

### 12.10 Visualización de consultas

La captura muestra la visualización de consultas de métricas en Kubelab,
permitiendo revisar los resultados obtenidos desde la interfaz.

![Visualización de consultas](docs/img/kubelab_query_visualization.png)

### 12.11 Paneles adicionales y validación de consultas

El primer panel muestra una visualización adicional de las métricas en
Grafana.

![Panel adicional de Grafana](docs/img/grafana_dashboard1.png)

El segundo panel presenta otra vista de las métricas disponibles en Grafana.

![Segundo panel de Grafana](docs/img/grafana_dashboard6.png)

La última captura permite comprobar el estado de los pods después de ejecutar
consultas en los paneles.

![Verificación de pods después de las consultas](docs/img/pods_check_after_dashboard_queries.png)

## 13. Recolección y consulta de logs con Loki

### 13.1 Estado del pod de Loki

La captura muestra el pod de Loki en estado saludable y sincronizado, como
verificación del componente de almacenamiento y consulta de logs.

![Pod de Loki saludable y sincronizado](docs/img/loki_pod_healthy.png)

### 13.2 Integración de Grafana con Loki

La captura muestra la integración de Loki en Grafana para consultar y explorar
los registros desde la interfaz de monitoreo.

![Integración de Grafana con Loki](docs/img/grafana_loki_integration.png)

### 13.3 Pod de Alloy

La salida confirma la creación del pod de Alloy, componente utilizado en este
entorno para recopilar y enviar registros hacia Loki.

![Pod de Alloy creado](docs/img/alloy_pod_created.png)

### 13.4 Consulta de logs

La captura muestra registros consultados desde Loki, como comprobación del
flujo de recolección y visualización de logs.

![Logs de Loki](docs/img/loki_logs.png)

## 14. Escalado automático de la aplicación

### 14.1 HPA con una réplica

La captura muestra el estado inicial del Horizontal Pod Autoscaler (HPA) con
una réplica de la aplicación, que sirve como referencia antes de aumentar la
carga.

![HPA con una réplica](docs/img/hpa_replica1.png)

### 14.2 Uso de CPU de la primera réplica

La visualización muestra el consumo de CPU de la primera réplica durante la
prueba de carga.

![Uso de CPU de la primera réplica](docs/img/replica1_cpu_usage.png)

### 14.3 HPA con dos réplicas

La captura muestra dos réplicas de la aplicación después de que el HPA ajusta
la cantidad de pods en respuesta a la carga.

![HPA con dos réplicas](docs/img/hpa_replica2.png)

### 14.4 Reescalado ante exceso de CPU

La evidencia muestra el reescalado de la aplicación al superar el umbral de
uso de CPU configurado. Esto permite comprobar la respuesta automática del HPA
ante un aumento de demanda.

![Reescalado ante exceso de CPU](docs/img/cpu_excess_reescalation.png)

### 14.5 Verificación de pods

La salida permite comprobar el estado de los pods después de la prueba de
escalado.

![Verificación de pods](docs/img/pods_verification.png)

## 15. Acceso remoto y disponibilidad de las aplicaciones

### 15.1 Acceso mediante datos móviles

La captura muestra el acceso remoto al entorno utilizando una conexión de
datos móviles, como prueba de disponibilidad fuera de la red local.

![Acceso remoto mediante datos móviles](docs/img/remote_access_with_cellular_data.png)

### 15.2 Conectividad con los nodos

La prueba de conectividad muestra respuestas desde el control plane y Worker 1,
verificando que ambos nodos son alcanzables desde el entorno remoto.

![Conectividad con el control plane y Worker 1](docs/img/ping_control_plane_worker1.png)

### 15.3 Aplicaciones disponibles desde acceso remoto

La captura muestra las aplicaciones accesibles mediante la conexión remota,
como comprobación de su disponibilidad desde fuera de la red local.

![Aplicaciones disponibles mediante acceso remoto](docs/img/apps_working_remote.png)

### 15.4 Estado de los pods durante el acceso remoto

La salida muestra los pods saludables y sincronizados mientras se valida el
acceso remoto a las aplicaciones.

![Pods saludables y sincronizados](docs/img/pods_healthy_synced.png)

### 15.5 Conexión remota a los puertos

La captura muestra la conexión remota a los puertos publicados para acceder a
los servicios del clúster.

![Acceso remoto a los puertos](docs/img/ports_remote_connection.png)

### 15.6
En esta captura se muestra el dashboard de grafana, luego de realizar un cambio de dominio
![grafana dashboard via new domain](docs/img/grafana_new_domain_dashboard.png)