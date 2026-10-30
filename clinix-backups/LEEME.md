# Respaldos de Clinix para una máquina virtual con AlmaLinux

Paquete preparado para tu instalación: Podman ejecutado como root, contenedor `clinix_postgres`, base `clinix_db` y usuario `clinix_user`.

## Qué corrige

Tu script anterior comprobaba sólo que el archivo `.sql.gz` tuviera tamaño. Un fallo de `pg_dump` podía dejar una cabecera gzip o una salida parcial no vacía y registrarse como éxito. La versión corregida comprueba el estado de toda la tubería con `pipefail`, valida la compresión y el contenido no vacío, y sólo entonces publica el archivo final.

- Espera hasta cinco minutos a que el contenedor y PostgreSQL respondan.
- No inicia ni detiene los contenedores. Si PostgreSQL no arranca, el servicio falla y reintenta cinco minutos después de cada fallo.
- Evita respaldos simultáneos con `flock`.
- Escribe primero un archivo temporal y lo renombra al terminar. El temporal se elimina ante errores controlados o señales de parada.
- Crea archivos nuevos con permisos privados y nombres distintos.
- Mantiene la política original de limpieza de archivos `clinix_backup_*.sql.gz` con `-mtime +30`, sólo después de completar una copia nueva. Una exportación fallida no elimina los respaldos antiguos.
- Registra errores y éxitos en `backups/respaldos.log` y en el registro del servicio.

El temporizador de systemd ejecuta el respaldo:

1. A los tres minutos de arrancar la VM.
2. Diariamente a las 02:00, en la zona horaria del servidor.
3. Cuando se reactiva y quedó pendiente una ejecución de calendario durante un apagado, gracias a `Persistent=true`.

Puede haber más de una copia en un día por los distintos eventos. El bloqueo evita que se exporten al mismo tiempo. No se reconstruyen copias históricas de los días apagados: las copias se hacen con el estado actual de la base.

## Instalación en la VM

Este ZIP contiene archivos para AlmaLinux, no para el proyecto Flutter ni para la imagen del backend. No hace falta reconstruir los contenedores para instalar este respaldo.

1. Sube `clinix-backups-vm.zip` al directorio `/root` del servidor con WinSCP, SFTP o tu herramienta de transferencia habitual.
2. Como root, ejecuta:

   ```bash
   cd /root
   unzip clinix-backups-vm.zip
   bash /root/clinix-backups/instalar.sh
   ```

El instalador:

- Conserva una copia de `/root/clinix/respaldo_clinix.sh` y del crontab de root, con fecha y hora en `/root/clinix`.
- Instala el script corregido y los archivos `clinix-backup.service` y `clinix-backup.timer` en `/etc/systemd/system`.
- Comprueba las unidades e intenta un respaldo real. Si falla, conserva el cron anterior y muestra dónde consultar el error.
- Activa el temporizador. Después retira del crontab la entrada activa que llama a `/bin/bash /root/clinix/respaldo_clinix.sh`, conservando comentarios y otras tareas.

La prueba inicial puede tardar hasta cinco minutos si PostgreSQL no está iniciado, además del tiempo que tarde la exportación. Si falla, revisa el servicio, inicia PostgreSQL con tu procedimiento habitual y vuelve a ejecutar el instalador. El servicio también reintenta automáticamente mientras la VM esté encendida.

## Comprobar el resultado

```bash
systemctl list-timers --all --no-pager clinix-backup.timer
systemctl show clinix-backup.service -p Result
journalctl -u clinix-backup.service -n 60 --no-pager
ls -lht /root/clinix/backups | head -15
```

Un servicio de tipo `oneshot` puede verse como `inactive (dead)` después de acabar correctamente. Eso es normal; consulta `Result=success` y el mensaje `RESPALDO COMPLETADO` en el log.

Para ejecutar una copia manual:

```bash
systemctl start clinix-backup.service
```

Para consultar el cron que queda:

```bash
crontab -l
```

## Archivos instalados

| Archivo | Destino |
| --- | --- |
| `respaldo_clinix.sh` | `/root/clinix/respaldo_clinix.sh` |
| `clinix-backup.service` | `/etc/systemd/system/clinix-backup.service` |
| `clinix-backup.timer` | `/etc/systemd/system/clinix-backup.timer` |
| Copias SQL comprimidas | `/root/clinix/backups/` |

Las copias permanecen dentro de la VM. Este paquete no las transfiere a otro equipo ni a un almacenamiento externo.

## Volver al método anterior

Primero detén y desactiva el temporizador y el servicio para cancelar también reintentos pendientes:

```bash
systemctl disable --now clinix-backup.timer
systemctl stop clinix-backup.service
```

El instalador deja archivos `respaldo_clinix.sh.anterior_FECHA` y `crontab_antes_respaldo_FECHA.txt` en `/root/clinix`. Puedes revisar las versiones guardadas antes de restaurar el script y su programación. Si posteriormente cambiaste otras tareas de cron, conserva esos cambios al recuperar sólo la línea del respaldo.

## Validación incluida

Se ejecutaron **16 pruebas funcionales aisladas** con Podman, cron y systemctl simulados. Se comprobaron exportación correcta, fallo de `pg_dump` con salida vacía o parcial, compresión fallida/corrupta, exportación vacía con código cero, espera de PostgreSQL, bloqueo simultáneo, retención segura, nombres únicos, preservación de otras tareas y conservación del cron ante un fallo de instalación.

También pasaron `bash -n` y `systemd-analyze verify` para los scripts y unidades. Las pruebas no acceden a tu servidor ni a tu base real. Se pueden repetir con Python 3:

```bash
python3 -m unittest discover -s tests -v
```

La validación del script comprueba la exportación y el archivo comprimido; no es un ensayo de restauración de tus datos reales. Los respaldos anteriores tampoco quedan certificados retroactivamente por instalar esta corrección.

Referencias:

- https://www.gnu.org/software/bash/manual/html_node/Pipelines
- https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html
- https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html
- https://www.postgresql.org/docs/16/app-pgdump.html
