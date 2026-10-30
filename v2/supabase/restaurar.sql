-- Restaurar una copia de seguridad (archivo respaldo-AAAA-MM-DD_HHMM.json de la carpeta de Drive).
--
-- Cómo usarlo, en Supabase → SQL Editor:
--   1. Abrir el archivo de respaldo en Drive (o descargarlo), copiar TODO su contenido.
--   2. Pegarlo abajo, reemplazando PEGAR_ACA (queda entre las dos marcas $respaldo$).
--   3. Ejecutar todo el script (Run). Es una sola transacción: si algo falla, no cambia nada.
--
-- Qué hace: AGREGA lo que falta y NO pisa lo que existe (filas con el mismo id se dejan como están).
-- Sirve tanto para recuperar algo borrado por error como para reconstruir en un proyecto nuevo
-- (después de cargar supabase/schema.sql). Durante la restauración no se envían correos.
--
-- En un proyecto nuevo las cuentas no existen todavía: las fichas quedan sin cuenta vinculada y se
-- vinculan solas cuando cada paciente crea su cuenta con el mismo DNI y correo. Los roles del personal
-- se recuperan cuando cada uno vuelve a crear su cuenta y se vuelve a ejecutar este script.

begin;

create temp table respaldo on commit drop as
select ($respaldo$PEGAR_ACA$respaldo$)::jsonb -> 'tablas' as t;

-- Sin correos ni autores automáticos mientras se restaura
alter table turnos disable trigger user;
alter table odontogramas disable trigger user;
alter table evoluciones disable trigger user;
alter table foto_secciones disable trigger user;
alter table fotos disable trigger user;

-- Perfiles: solo de cuentas que existen en este proyecto (recupera nombre y rol)
insert into perfiles
select x.* from respaldo, jsonb_populate_recordset(null::perfiles, t -> 'perfiles') x
where exists (select 1 from auth.users u where u.id = x.id)
on conflict (id) do update set rol = excluded.rol, nombre = excluded.nombre, apellido = excluded.apellido;

-- Fichas (si la cuenta no existe en este proyecto, queda sin vincular)
insert into pacientes
select (jsonb_populate_record(x, jsonb_build_object('usuario_id',
          case when exists (select 1 from perfiles p where p.id = x.usuario_id) then x.usuario_id end))).*
from respaldo, jsonb_populate_recordset(null::pacientes, t -> 'pacientes') x
on conflict do nothing;

insert into antecedentes
select (jsonb_populate_record(x, jsonb_build_object('actualizado_por',
          case when exists (select 1 from perfiles p where p.id = x.actualizado_por) then x.actualizado_por end))).*
from respaldo, jsonb_populate_recordset(null::antecedentes, t -> 'antecedentes') x
where exists (select 1 from pacientes p where p.id = x.paciente_id)
on conflict do nothing;

-- Agenda
update agenda_config c set duracion = x.duracion, intervalo = x.intervalo, margen_sobreturno = x.margen_sobreturno,
  dias_visibles = x.dias_visibles, horas_cancelacion = x.horas_cancelacion
from respaldo, jsonb_populate_recordset(null::agenda_config, t -> 'agenda_config') x where c.id = x.id;

insert into agenda_horarios
select x.* from respaldo, jsonb_populate_recordset(null::agenda_horarios, t -> 'agenda_horarios') x
on conflict do nothing;
select setval(pg_get_serial_sequence('agenda_horarios', 'id'), greatest((select max(id) from agenda_horarios), 1));

insert into agenda_bloqueos
select x.* from respaldo, jsonb_populate_recordset(null::agenda_bloqueos, t -> 'agenda_bloqueos') x
on conflict do nothing;

-- Turnos e historia clínica
insert into turnos
select x.* from respaldo, jsonb_populate_recordset(null::turnos, t -> 'turnos') x
where exists (select 1 from pacientes p where p.id = x.paciente_id)
on conflict do nothing;

insert into odontogramas
select (jsonb_populate_record(x, jsonb_build_object('creado_por',
          case when exists (select 1 from perfiles p where p.id = x.creado_por) then x.creado_por end))).*
from respaldo, jsonb_populate_recordset(null::odontogramas, t -> 'odontogramas') x
where exists (select 1 from pacientes p where p.id = x.paciente_id)
on conflict do nothing;

insert into evoluciones
select (jsonb_populate_record(x, jsonb_build_object('creado_por',
          case when exists (select 1 from perfiles p where p.id = x.creado_por) then x.creado_por end))).*
from respaldo, jsonb_populate_recordset(null::evoluciones, t -> 'evoluciones') x
where exists (select 1 from pacientes p where p.id = x.paciente_id)
on conflict do nothing;

-- Fotos: la lista y las secciones (los archivos siguen en Cloudflare R2). Copias viejas no las traen.
insert into foto_secciones
select (jsonb_populate_record(x, jsonb_build_object('creado_por',
          case when exists (select 1 from perfiles p where p.id = x.creado_por) then x.creado_por end))).*
from respaldo, jsonb_populate_recordset(null::foto_secciones, coalesce(t -> 'foto_secciones', '[]')) x
where exists (select 1 from pacientes p where p.id = x.paciente_id)
on conflict do nothing;

insert into fotos
select (jsonb_populate_record(x, jsonb_build_object('creado_por',
          case when exists (select 1 from perfiles p where p.id = x.creado_por) then x.creado_por end))).*
from respaldo, jsonb_populate_recordset(null::fotos, coalesce(t -> 'fotos', '[]')) x
where exists (select 1 from pacientes p where p.id = x.paciente_id)
on conflict do nothing;

alter table turnos enable trigger user;
alter table odontogramas enable trigger user;
alter table evoluciones enable trigger user;
alter table foto_secciones enable trigger user;
alter table fotos enable trigger user;

-- Resumen de lo que quedó
select 'pacientes' as tabla, count(*) from pacientes
union all select 'turnos', count(*) from turnos
union all select 'odontogramas', count(*) from odontogramas
union all select 'evoluciones', count(*) from evoluciones
union all select 'fotos', count(*) from fotos;

commit;
