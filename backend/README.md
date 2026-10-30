# Backend Clinix corregido

Actualización de Node.js/Express y PostgreSQL para el frontend Flutter adjunto.

- Instalación: `npm ci`.
- Migración de una base existente: `npm run migrate`.
- Arranque: `npm start`. Las migraciones se verifican antes de aceptar peticiones.
- Pruebas aisladas: `npm test` (instala también dependencias de desarrollo).
- Contenedor: `podman build -t clinix-backend -f Containerfile .` o su equivalente Docker. Conserva la red y las variables de tu despliegue.

Lee `../LEEME.md` antes de actualizar el sistema. En ejecución directa, las variables se leen del `.env` de esta carpeta. `DB_HOST=postgres` requiere resolver ese nombre en la red del contenedor; para PostgreSQL local ajusta el host. El servidor usa el puerto `PORT`, con 3000 como valor predeterminado.

`init_db/04_pacientes_datos_completos.sql` y `init_db/05_antecedentes_nutricion.sql` agregan columnas sin eliminar registros. La migración 06 (`init_db/06_ampliar_campos_pacientes.sql`) amplía las columnas antiguas que sean más estrechas que el contrato actual. No reduce tamaños ni trunca datos. La segunda incorpora `consultas_nutricion.antecedentes_patologicos` para guardar las casillas por evaluación. No crea una base desde cero. Las pruebas usan PGlite y datos sintéticos, sin modificar tu PostgreSQL real.

La migración 07 (`init_db/07_diagnosticos_psicologia.sql`) agrega `diagnosticos` (JSONB) y `estado_diagnostico` por sesión psicológica, con restricciones de estructura, principal único y códigos no repetidos. Las notas antiguas conservan su texto y estado `LEGADO`. Las rutas nuevas validan la lista y aceptan `EN_EVALUACION` sin códigos. La migración se ejecuta también al arrancar. Consulta `../PSICOLOGIA_DIAGNOSTICOS.md`.
