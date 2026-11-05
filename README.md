# Configuración del laboratorio de Proxmox y Kubernetes

Este documento registra la instalación y validación de un entorno pequeño de
Kubernetes alojado en Proxmox VE. El laboratorio contiene un host de Proxmox,
una máquina virtual para el control plane de Kubernetes y tres máquinas
virtuales worker.

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

![Sinrconizacion de postgresql](docs/img/postgrsql_sync.png)