-- =====================================================================
-- Smiles Campana: esquema de base de datos para Supabase
-- Pegar completo en Supabase > SQL Editor > New query > Run.
-- Se puede volver a ejecutar sin perder datos (usa "if not exists").
-- =====================================================================

-- ---------- Tipos ----------
do $$ begin
  create type rol as enum ('paciente', 'recepcion', 'odontologia', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  -- pendiente: pedido online por el paciente, falta que el consultorio lo confirme
  -- rechazado: el consultorio no pudo confirmar el pedido
  create type estado_turno as enum ('pendiente', 'confirmado', 'rechazado', 'cancelado', 'atendido', 'ausente');
exception when duplicate_object then null; end $$;

-- ---------- Tablas ----------
create table if not exists perfiles (
  id         uuid primary key references auth.users on delete cascade,
  email      text,
  rol        rol not null default 'paciente',
  nombre     text,
  apellido   text,
  dni        text,
  creado_en  timestamptz not null default now()
);

create table if not exists pacientes (
  id          uuid primary key default gen_random_uuid(),
  dni         text not null unique,
  nombre      text not null,
  apellido    text not null,
  fecha_nac   date,
  telefono    text,
  email       text,
  direccion   text,
  notas       text,                 -- notas administrativas (no clínicas)
  usuario_id  uuid unique references perfiles(id) on delete set null,
  creado_en   timestamptz not null default now()
);

-- Antecedentes médicos: tabla aparte para que recepción no los vea.
create table if not exists antecedentes (
  paciente_id     uuid primary key references pacientes on delete cascade,
  texto           text not null default '',
  actualizado_en  timestamptz not null default now(),
  actualizado_por uuid references perfiles(id)
);

create table if not exists agenda_config (
  id                 int primary key default 1 check (id = 1),
  duracion           int not null default 60 check (duracion between 10 and 180),  -- minutos de cada turno
  intervalo          int not null default 30 check (intervalo between 5 and 120),   -- cada cuánto se ofrece un inicio
  margen_sobreturno  int not null default 60 check (margen_sobreturno between 0 and 180), -- extensión de la franja, solo para sobreturnos
  dias_visibles      int not null default 30 check (dias_visibles between 1 and 120),
  horas_cancelacion  int not null default 12 check (horas_cancelacion between 0 and 168)
);
alter table agenda_config add column if not exists intervalo int not null default 30 check (intervalo between 5 and 120);
alter table agenda_config add column if not exists margen_sobreturno int not null default 60 check (margen_sobreturno between 0 and 180);
insert into agenda_config (id) values (1) on conflict do nothing;

create table if not exists agenda_horarios (
  id     serial primary key,
  dia    smallint not null check (dia between 0 and 6),  -- 0 = domingo
  desde  time not null,
  hasta  time not null check (hasta > desde)
);
insert into agenda_horarios (dia, desde, hasta)
select * from (values (2, '15:00'::time, '21:00'::time), (4, '15:00', '21:00'), (6, '10:00', '14:00')) v
where not exists (select 1 from agenda_horarios);

-- Bloqueos: un día completo o un rango horario; opcionalmente repetido cada semana (mismo día que 'fecha')
-- desde 'fecha' hasta 'hasta_fecha' (vacío = sin fin). Los sobreturnos son lo único que puede ocupar un bloqueo.
create table if not exists agenda_bloqueos (
  id           uuid primary key default gen_random_uuid(),
  fecha        date not null,
  hora_desde   time,   -- vacías = todo el día
  hora_hasta   time,
  repetir      boolean not null default false,
  hasta_fecha  date,
  motivo       text,
  constraint bloqueo_horas check ((hora_desde is null) = (hora_hasta is null) and (hora_hasta is null or hora_hasta > hora_desde)),
  constraint bloqueo_repeticion check (hasta_fecha is null or (repetir and hasta_fecha >= fecha))
);
-- Actualización desde la versión anterior (una fila por fecha, sin rangos)
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'agenda_bloqueos' and column_name = 'id') then
    alter table agenda_bloqueos drop constraint agenda_bloqueos_pkey;
    alter table agenda_bloqueos add column id uuid not null default gen_random_uuid() primary key;
    alter table agenda_bloqueos add column hora_desde time, add column hora_hasta time,
      add column repetir boolean not null default false, add column hasta_fecha date;
    alter table agenda_bloqueos add constraint bloqueo_horas check ((hora_desde is null) = (hora_hasta is null) and (hora_hasta is null or hora_hasta > hora_desde));
    alter table agenda_bloqueos add constraint bloqueo_repeticion check (hasta_fecha is null or (repetir and hasta_fecha >= fecha));
  end if;
end $$;
create index if not exists agenda_bloqueos_fecha on agenda_bloqueos (fecha);

create table if not exists turnos (
  id           uuid primary key default gen_random_uuid(),
  paciente_id  uuid not null references pacientes on delete cascade,
  inicio       timestamptz not null,
  duracion     int not null default 30,
  motivo       text,
  estado       estado_turno not null default 'confirmado',
  creado_por   text not null default 'personal' check (creado_por in ('paciente', 'personal')),
  creado_en    timestamptz not null default now(),
  cancelado_en timestamptz,  -- solo cuando lo cancela el propio paciente online (límite diario de pedidos)
  inicio_pedido timestamptz,  -- horario original, si el personal cambió el turno a otro horario
  cambio_ofrecido_en timestamptz,  -- cuándo se le ofreció otro horario por un pedido pendiente
  sobreturno   boolean not null default false,  -- turno de 30 min que da el personal en un hueco o fuera de horario
  cancelado_por text check (cancelado_por in ('paciente', 'consultorio')),  -- quién pidió la cancelación
  fin          timestamptz  -- inicio + duración; lo completa la base
);
alter table turnos add column if not exists cancelado_en timestamptz;
alter table turnos add column if not exists inicio_pedido timestamptz;
alter table turnos add column if not exists cambio_ofrecido_en timestamptz;
alter table turnos add column if not exists sobreturno boolean not null default false;
alter table turnos add column if not exists cancelado_por text check (cancelado_por in ('paciente', 'consultorio'));
alter table turnos add column if not exists fin timestamptz;
update turnos set fin = inicio + make_interval(mins => duracion) where fin is null;
alter table turnos alter column fin set not null;
create index if not exists turnos_paciente on turnos (paciente_id);
-- Nunca dos turnos activos superpuestos (un pedido pendiente también reserva su horario).
-- Reemplaza a la regla anterior, que solo impedía dos turnos a la misma hora exacta.
drop index if exists turnos_un_horario;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'turnos_sin_superposicion') then
    alter table turnos add constraint turnos_sin_superposicion
      exclude using gist (tstzrange(inicio, fin) with &&) where (estado not in ('cancelado', 'rechazado'));
  end if;
end $$;

-- Cada guardado del odontograma es una versión nueva (historial clínico inmutable).
create table if not exists odontogramas (
  id                 uuid primary key default gen_random_uuid(),
  paciente_id        uuid not null references pacientes on delete cascade,
  datos              jsonb not null,
  nota               text,
  creado_por         uuid references perfiles(id),
  creado_por_nombre  text,
  creado_en          timestamptz not null default now(),
  -- Correcciones: la última versión se puede corregir; lo que tenía antes queda guardado en "correcciones"
  corregido_en           timestamptz,
  corregido_por_nombre   text,
  correcciones           jsonb not null default '[]'
);
alter table odontogramas add column if not exists corregido_en timestamptz;
alter table odontogramas add column if not exists corregido_por_nombre text;
alter table odontogramas add column if not exists correcciones jsonb not null default '[]';
create index if not exists odontogramas_paciente on odontogramas (paciente_id, creado_en desc);

create table if not exists evoluciones (
  id                 uuid primary key default gen_random_uuid(),
  paciente_id        uuid not null references pacientes on delete cascade,
  texto              text not null,
  piezas             text,
  creado_por         uuid references perfiles(id),
  creado_por_nombre  text,
  creado_en          timestamptz not null default now()
);
create index if not exists evoluciones_paciente on evoluciones (paciente_id, creado_en desc);

-- Fotos clínicas, agrupadas en secciones (por ejemplo "Primera consulta 02/11/2026").
-- Los archivos están en Cloudflare R2 (pacientes/<paciente_id>/<foto_id>.jpg y -mini.jpg); el Worker
-- (worker/index.js) los sube, entrega y borra solo si la base se lo permite a quien lo pide.
create table if not exists foto_secciones (
  id                 uuid primary key default gen_random_uuid(),
  paciente_id        uuid not null references pacientes on delete cascade,
  titulo             text not null check (length(trim(titulo)) > 0),
  orden              int not null default 0,
  creado_por         uuid references perfiles(id),
  creado_por_nombre  text,
  creado_en          timestamptz not null default now()
);
create index if not exists foto_secciones_paciente on foto_secciones (paciente_id, orden);

create table if not exists fotos (
  id                 uuid primary key default gen_random_uuid(),
  paciente_id        uuid not null references pacientes on delete cascade,
  seccion_id         uuid references foto_secciones on delete set null,  -- sin sección: "Sin sección"
  orden              int not null default 0,
  ancho              int,
  alto               int,
  bytes              int,
  creado_por         uuid references perfiles(id),
  creado_por_nombre  text,
  creado_en          timestamptz not null default now()
);
create index if not exists fotos_paciente on fotos (paciente_id, seccion_id, orden);
create index if not exists fotos_seccion on fotos (seccion_id);
create index if not exists foto_secciones_creado_por on foto_secciones (creado_por);
create index if not exists fotos_creado_por on fotos (creado_por);

-- Índices para las columnas de autoría (sugeridos por el analizador de Supabase)
create index if not exists antecedentes_actualizado_por on antecedentes (actualizado_por);
create index if not exists odontogramas_creado_por on odontogramas (creado_por);
create index if not exists evoluciones_creado_por on evoluciones (creado_por);

-- ---------- Funciones de ayuda para permisos ----------
create or replace function mi_rol() returns rol
language sql stable security definer set search_path = public as $$
  select rol from perfiles where id = auth.uid()
$$;

create or replace function es_personal() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(mi_rol() in ('recepcion', 'odontologia', 'admin'), false)
$$;

create or replace function es_clinico() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(mi_rol() in ('odontologia', 'admin'), false)
$$;

create or replace function mi_paciente_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from pacientes where usuario_id = auth.uid()
$$;

create or replace function mi_nombre() returns text
language sql stable security definer set search_path = public as $$
  select trim(coalesce(nombre, '') || ' ' || coalesce(apellido, '')) from perfiles where id = auth.uid()
$$;

-- ---------- Alta automática al registrarse ----------
-- 1) Al registrarse se crea el perfil (rol paciente).
create or replace function al_registrarse() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into perfiles (id, email, rol, nombre, apellido, dni)
  values (new.id, new.email, 'paciente', m->>'nombre', m->>'apellido', nullif(trim(m->>'dni'), ''))
  on conflict (id) do nothing;
  return new;
end $$;

-- 2) La ficha se vincula recién cuando el email está confirmado, para que nadie
--    pueda quedarse con la ficha de otra persona registrándose con su DNI. Con el DNI del registro:
--   * sin ficha previa con ese DNI: crea la ficha y la vincula;
--   * con ficha previa y mismo email: la vincula;
--   * con ficha previa y otro email: queda pendiente para que recepción la vincule.
create or replace function al_confirmar_email() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_dni text := nullif(trim(m->>'dni'), '');
  v_pac pacientes%rowtype;
begin
  if new.email_confirmed_at is null or v_dni is null then return new; end if;
  if tg_op = 'UPDATE' and old.email_confirmed_at is not null then return new; end if;
  if exists (select 1 from pacientes where usuario_id = new.id) then return new; end if;

  select * into v_pac from pacientes where dni = v_dni;
  if not found then
    insert into pacientes (dni, nombre, apellido, fecha_nac, telefono, email, usuario_id)
    values (v_dni, coalesce(m->>'nombre', ''), coalesce(m->>'apellido', ''),
            nullif(m->>'fecha_nac', '')::date, m->>'telefono', new.email, new.id);
  elsif v_pac.usuario_id is null and lower(coalesce(v_pac.email, '')) = lower(new.email) then
    update pacientes set usuario_id = new.id where id = v_pac.id;
  end if;
  return new;
end $$;

-- Los disparadores corren en orden alfabético: primero el perfil, después la ficha.
drop trigger if exists al_registrarse on auth.users;
drop trigger if exists smiles_1_perfil on auth.users;
create trigger smiles_1_perfil after insert on auth.users
  for each row execute function al_registrarse();
drop trigger if exists smiles_2_vincular_ficha on auth.users;
create trigger smiles_2_vincular_ficha after insert or update of email_confirmed_at on auth.users
  for each row execute function al_confirmar_email();

-- Solo un admin puede cambiar roles, y nunca el propio.
-- (Desde el SQL Editor, sin usuario, sí se permite: así se crea el primer admin.)
create or replace function proteger_rol() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.rol is distinct from old.rol and auth.uid() is not null then
    if mi_rol() <> 'admin' then raise exception 'No tenés permiso para cambiar roles.'; end if;
    if new.id = auth.uid() then raise exception 'No podés cambiar tu propio rol.'; end if;
  end if;
  return new;
end $$;

drop trigger if exists proteger_rol on perfiles;
create trigger proteger_rol before update on perfiles
  for each row execute function proteger_rol();

-- ---------- Seguridad por filas (RLS) ----------
alter table perfiles         enable row level security;
alter table pacientes        enable row level security;
alter table antecedentes     enable row level security;
alter table agenda_config    enable row level security;
alter table agenda_horarios  enable row level security;
alter table agenda_bloqueos  enable row level security;
alter table turnos           enable row level security;
alter table odontogramas     enable row level security;
alter table evoluciones      enable row level security;
alter table foto_secciones   enable row level security;
alter table fotos            enable row level security;

-- Borra políticas previas para poder re-ejecutar el script
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on %I', r.policyname, r.tablename);
  end loop;
end $$;

-- Las funciones van entre (select ...) para que se evalúen una vez por consulta y no una vez por fila.

-- perfiles
create policy "ver perfil propio o personal" on perfiles for select to authenticated
  using (id = (select auth.uid()) or (select es_personal()));
create policy "admin edita perfiles" on perfiles for update to authenticated
  using ((select mi_rol()) = 'admin') with check ((select mi_rol()) = 'admin');

-- pacientes
create policy "personal y el propio paciente ven la ficha" on pacientes for select to authenticated
  using ((select es_personal()) or usuario_id = (select auth.uid()));
create policy "personal crea fichas" on pacientes for insert to authenticated
  with check ((select es_personal()));
create policy "personal edita fichas" on pacientes for update to authenticated
  using ((select es_personal())) with check ((select es_personal()));
create policy "admin borra fichas" on pacientes for delete to authenticated
  using ((select mi_rol()) = 'admin');

-- antecedentes: solo odontología y admin
create policy "clinico gestiona antecedentes" on antecedentes for all to authenticated
  using ((select es_clinico())) with check ((select es_clinico()));

-- agenda: lectura pública (el sitio muestra los horarios), edición recepción/admin
create policy "agenda visible" on agenda_config for select to anon, authenticated using (true);
create policy "agenda editable" on agenda_config for update to authenticated
  using ((select mi_rol()) in ('recepcion', 'admin')) with check ((select mi_rol()) in ('recepcion', 'admin'));

create policy "horarios visibles" on agenda_horarios for select to anon, authenticated using (true);
create policy "horarios: agregar" on agenda_horarios for insert to authenticated
  with check ((select mi_rol()) in ('recepcion', 'admin'));
create policy "horarios: modificar" on agenda_horarios for update to authenticated
  using ((select mi_rol()) in ('recepcion', 'admin')) with check ((select mi_rol()) in ('recepcion', 'admin'));
create policy "horarios: quitar" on agenda_horarios for delete to authenticated
  using ((select mi_rol()) in ('recepcion', 'admin'));

create policy "bloqueos visibles" on agenda_bloqueos for select to anon, authenticated using (true);
create policy "bloqueos: agregar" on agenda_bloqueos for insert to authenticated
  with check ((select mi_rol()) in ('recepcion', 'admin'));
create policy "bloqueos: modificar" on agenda_bloqueos for update to authenticated
  using ((select mi_rol()) in ('recepcion', 'admin')) with check ((select mi_rol()) in ('recepcion', 'admin'));
create policy "bloqueos: quitar" on agenda_bloqueos for delete to authenticated
  using ((select mi_rol()) in ('recepcion', 'admin'));

-- turnos: el paciente solo ve los suyos; los pide (quedan pendientes) y cancela con las funciones de abajo
create policy "ver turnos" on turnos for select to authenticated
  using ((select es_personal()) or paciente_id = (select mi_paciente_id()));
create policy "personal crea turnos" on turnos for insert to authenticated
  with check ((select es_personal()));
create policy "personal edita turnos" on turnos for update to authenticated
  using ((select es_personal())) with check ((select es_personal()));

-- odontogramas: el paciente puede verlos; solo odontología/admin crea versiones nuevas
create policy "ver odontogramas" on odontogramas for select to authenticated
  using ((select es_clinico()) or paciente_id = (select mi_paciente_id()));
create policy "clinico registra odontograma" on odontogramas for insert to authenticated
  with check ((select es_clinico()) and creado_por = (select auth.uid()));
-- Corregir: la última versión, quien la creó o admin, en cualquier momento (queda registro en "correcciones").
-- Borrar: lo mismo, pero solo dentro de las 48 h de creada. "Solo la última" lo controla corregir_odontograma().
create policy "autor o admin corrige odontograma" on odontogramas for update to authenticated
  using ((select es_clinico()) and (creado_por = (select auth.uid()) or (select mi_rol()) = 'admin'))
  with check ((select es_clinico()) and (creado_por = (select auth.uid()) or (select mi_rol()) = 'admin'));
create policy "autor o admin borra odontograma reciente" on odontogramas for delete to authenticated
  using ((select es_clinico()) and (creado_por = (select auth.uid()) or (select mi_rol()) = 'admin')
         and creado_en > now() - interval '48 hours');

-- fotos y secciones: solo odontología/admin (el paciente, más adelante)
create policy "clinico gestiona secciones de fotos" on foto_secciones for all to authenticated
  using ((select es_clinico())) with check ((select es_clinico()));
create policy "clinico gestiona fotos" on fotos for all to authenticated
  using ((select es_clinico())) with check ((select es_clinico()));

-- evoluciones: solo odontología/admin
create policy "clinico ve evoluciones" on evoluciones for select to authenticated
  using ((select es_clinico()));
create policy "clinico registra evoluciones" on evoluciones for insert to authenticated
  with check ((select es_clinico()) and creado_por = (select auth.uid()));

-- ---------- Funciones que usan los pacientes y el personal ----------

-- ¿El rango [p_inicio, p_fin) cae en algún bloqueo? (en hora argentina)
create or replace function bloqueado(p_inicio timestamptz, p_fin timestamptz)
returns boolean
language sql stable security definer set search_path = public as $$
  with x as (
    select p_inicio at time zone 'America/Argentina/Buenos_Aires' as i, p_fin at time zone 'America/Argentina/Buenos_Aires' as f
  )
  select exists (
    select 1 from agenda_bloqueos b, x
    where (case when b.repetir
                then x.i::date >= b.fecha and (b.hasta_fecha is null or x.i::date <= b.hasta_fecha)
                     and extract(dow from x.i) = extract(dow from b.fecha)
                else x.i::date = b.fecha end)
      and (b.hora_desde is null or (x.i::time < b.hora_hasta and (x.f::time > b.hora_desde or x.f::date > x.i::date)))
  )
$$;

-- Horarios libres para pedir turno (no expone quién tiene los otros turnos).
-- Un inicio cada 'intervalo' minutos; el turno completo ('duracion') tiene que entrar en la franja,
-- no superponerse con otro turno activo y no caer en un bloqueo.
create or replace function horarios_libres(desde date, dias int)
returns setof timestamptz
language sql stable security definer set search_path = public as $$
  with c as (select duracion, intervalo from agenda_config where id = 1),
  d as (select (desde + g)::date as fecha from generate_series(0, least(greatest(dias, 1), 120) - 1) g),
  s as (
    select distinct ((d.fecha + h.desde) + make_interval(mins => k * c.intervalo)) at time zone 'America/Argentina/Buenos_Aires' as inicio,
           c.duracion
    from d
    join agenda_horarios h on h.dia = extract(dow from d.fecha)
    cross join c
    cross join lateral generate_series(0, floor((extract(epoch from (h.hasta - h.desde)) / 60 - c.duracion) / c.intervalo)::int) k
  )
  select s.inicio from s
  where s.inicio > now() + interval '1 hour'
    and not bloqueado(s.inicio, s.inicio + make_interval(mins => s.duracion))
    and not exists (select 1 from turnos t
                    where t.estado not in ('cancelado', 'rechazado')
                      and t.inicio < s.inicio + make_interval(mins => s.duracion) and t.fin > s.inicio)
  order by s.inicio
$$;

-- Huecos para sobreturnos (solo el personal): 30 minutos, desde 'margen_sobreturno' antes hasta
-- 'margen_sobreturno' después de cada franja. Pueden caer en un bloqueo; nunca sobre otro turno.
create or replace function horarios_sobreturno(desde date, dias int)
returns setof timestamptz
language plpgsql stable security definer set search_path = public as $$
begin
  if not es_personal() then raise exception 'No tenés permiso para dar sobreturnos.'; end if;
  return query
  with c as (select margen_sobreturno as m from agenda_config where id = 1),
  d as (select (desde + g)::date as fecha from generate_series(0, least(greatest(dias, 1), 120) - 1) g),
  s as (
    select distinct ((d.fecha + h.desde) - make_interval(mins => c.m) + make_interval(mins => k * 30)) at time zone 'America/Argentina/Buenos_Aires' as inicio
    from d
    join agenda_horarios h on h.dia = extract(dow from d.fecha)
    cross join c
    cross join lateral generate_series(0, floor((extract(epoch from (h.hasta - h.desde)) / 60 + 2 * c.m - 30) / 30)::int) k
  )
  select s.inicio from s
  where s.inicio > now()
    and not exists (select 1 from turnos t
                    where t.estado not in ('cancelado', 'rechazado')
                      and t.inicio < s.inicio + interval '30 minutes' and t.fin > s.inicio)
  order by s.inicio;
end $$;

-- Completa 'fin' y valida los sobreturnos (30 minutos, dentro de la franja extendida).
create or replace function preparar_turno() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_margen int;
  v_local timestamp := new.inicio at time zone 'America/Argentina/Buenos_Aires';
begin
  new.fin := new.inicio + make_interval(mins => new.duracion);
  if new.sobreturno and (tg_op = 'INSERT' or new.inicio is distinct from old.inicio
                         or new.duracion is distinct from old.duracion or not old.sobreturno) then
    if new.duracion <> 30 then raise exception 'Los sobreturnos duran 30 minutos.'; end if;
    select margen_sobreturno into v_margen from agenda_config where id = 1;
    if not exists (
      select 1 from agenda_horarios h
      where h.dia = extract(dow from v_local)
        and v_local >= (v_local::date + h.desde) - make_interval(mins => v_margen)
        and v_local + interval '30 minutes' <= (v_local::date + h.hasta) + make_interval(mins => v_margen)
    ) then
      raise exception 'El sobreturno tiene que estar dentro del horario de atención, con hasta % minutos antes o después.', v_margen;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists preparar_turno on turnos;
create trigger preparar_turno before insert or update on turnos
  for each row execute function preparar_turno();

create or replace function pedir_turno(p_inicio timestamptz, p_motivo text default null)
returns turnos
language plpgsql security definer set search_path = public as $$
declare
  v_pid uuid := mi_paciente_id();
  v_cfg agenda_config%rowtype;
  v_turno turnos;
begin
  if v_pid is null then
    raise exception 'Tu cuenta todavía no está vinculada a una ficha. Llamanos y lo resolvemos.';
  end if;
  -- Límite contra abusos: con 4 cancelaciones propias en el día (hora argentina), no puede pedir hasta mañana
  if (select count(*) from turnos
      where paciente_id = v_pid
        and cancelado_en >= date_trunc('day', now() at time zone 'America/Argentina/Buenos_Aires') at time zone 'America/Argentina/Buenos_Aires') >= 4 then
    raise exception 'Por actividad sospechosa no podés pedir turnos hasta mañana. Si lo necesitás, escribinos por WhatsApp.';
  end if;
  if exists (select 1 from turnos where paciente_id = v_pid and estado in ('pendiente', 'confirmado') and inicio > now()) then
    raise exception 'Ya pediste un turno. Cancelalo si querés elegir otro horario.';
  end if;
  select * into v_cfg from agenda_config where id = 1;
  if p_inicio not in (select horarios_libres((now() at time zone 'America/Argentina/Buenos_Aires')::date, v_cfg.dias_visibles)) then
    raise exception 'Ese horario ya no está disponible. Elegí otro.';
  end if;
  insert into turnos (paciente_id, inicio, duracion, motivo, estado, creado_por)
  values (v_pid, p_inicio, v_cfg.duracion, coalesce(nullif(trim(p_motivo), ''), 'Consulta'), 'pendiente', 'paciente')
  returning * into v_turno;
  return v_turno;
end $$;

create or replace function cancelar_mi_turno(p_id uuid)
returns turnos
language plpgsql security definer set search_path = public as $$
declare
  v_turno turnos;
  v_horas int;
begin
  select horas_cancelacion into v_horas from agenda_config where id = 1;
  select * into v_turno from turnos where id = p_id and paciente_id = mi_paciente_id();
  if not found then raise exception 'No encontramos ese turno.'; end if;
  if v_turno.estado not in ('pendiente', 'confirmado') then
    raise exception 'Ese turno ya no se puede cancelar.';
  end if;
  -- Un pedido sin confirmar se puede retirar en cualquier momento
  if v_turno.estado = 'confirmado' and v_turno.inicio - now() < make_interval(hours => v_horas) then
    raise exception 'Los turnos se pueden cancelar online hasta % h antes. Escribinos por WhatsApp.', v_horas;
  end if;
  update turnos set estado = 'cancelado', cancelado_en = now(), cancelado_por = 'paciente' where id = p_id returning * into v_turno;
  return v_turno;
end $$;

create or replace function actualizar_mis_datos(p_telefono text, p_email text, p_direccion text)
returns pacientes
language plpgsql security definer set search_path = public as $$
declare v pacientes;
begin
  update pacientes set telefono = p_telefono, email = p_email, direccion = p_direccion
  where usuario_id = auth.uid() returning * into v;
  if not found then raise exception 'Tu cuenta todavía no está vinculada a una ficha.'; end if;
  return v;
end $$;

-- Cuentas de pacientes registradas que todavía no tienen ficha vinculada
create or replace function cuentas_sin_vincular()
returns setof perfiles
language sql stable security definer set search_path = public as $$
  select p.* from perfiles p
  where es_personal() and p.rol = 'paciente'
    and not exists (select 1 from pacientes x where x.usuario_id = p.id)
  order by p.creado_en desc
$$;

-- Completa autor y nombre en odontogramas y evoluciones
create or replace function completar_autor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.creado_por := auth.uid();
  new.creado_por_nombre := mi_nombre();
  return new;
end $$;

drop trigger if exists autor_odontograma on odontogramas;
create trigger autor_odontograma before insert on odontogramas for each row execute function completar_autor();
drop trigger if exists autor_evolucion on evoluciones;
create trigger autor_evolucion before insert on evoluciones for each row execute function completar_autor();

drop trigger if exists autor_foto_seccion on foto_secciones;
create trigger autor_foto_seccion before insert on foto_secciones for each row execute function completar_autor();
drop trigger if exists autor_foto on fotos;
create trigger autor_foto before insert on fotos for each row execute function completar_autor();

-- Una foto no cambia de paciente (su archivo está en la carpeta del paciente) y solo puede ir a una
-- sección del mismo paciente. Al mover o reordenar, el resto de los datos queda como estaba.
create or replace function validar_foto() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.paciente_id := old.paciente_id;
    new.creado_por := old.creado_por;
    new.creado_por_nombre := old.creado_por_nombre;
    new.creado_en := old.creado_en;
  end if;
  if new.seccion_id is not null and not exists (
    select 1 from foto_secciones s where s.id = new.seccion_id and s.paciente_id = new.paciente_id) then
    raise exception 'Esa sección es de otro paciente.';
  end if;
  return new;
end $$;
revoke execute on function validar_foto() from public, anon, authenticated;
drop trigger if exists validar_foto on fotos;
create trigger validar_foto before insert or update on fotos for each row execute function validar_foto();

create or replace function validar_foto_seccion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.id := old.id;
  new.paciente_id := old.paciente_id;
  new.creado_por := old.creado_por;
  new.creado_por_nombre := old.creado_por_nombre;
  new.creado_en := old.creado_en;
  return new;
end $$;
revoke execute on function validar_foto_seccion() from public, anon, authenticated;
drop trigger if exists validar_foto_seccion on foto_secciones;
create trigger validar_foto_seccion before update on foto_secciones for each row execute function validar_foto_seccion();

-- Corregir o borrar un odontograma: solo la última versión del paciente. Al corregir, solo cambian el
-- dibujo y la nota; lo anterior se agrega a "correcciones" con fecha y autor.
create or replace function corregir_odontograma() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Al eliminar el paciente se borran todas sus versiones juntas
  if tg_op = 'DELETE' and not exists (select 1 from pacientes where id = old.paciente_id) then return old; end if;
  if exists (select 1 from odontogramas o where o.paciente_id = old.paciente_id and o.id <> old.id
             and o.creado_en > old.creado_en) then
    raise exception 'Solo se puede % el último registro del odontograma.',
      case tg_op when 'DELETE' then 'borrar' else 'corregir' end;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  new.id := old.id;
  new.paciente_id := old.paciente_id;
  new.creado_por := old.creado_por;
  new.creado_por_nombre := old.creado_por_nombre;
  new.creado_en := old.creado_en;
  new.corregido_en := now();
  new.corregido_por_nombre := mi_nombre();
  new.correcciones := old.correcciones || jsonb_build_array(jsonb_build_object(
    'datos', old.datos, 'nota', old.nota, 'reemplazado_en', now(),
    'por', auth.uid(), 'por_nombre', mi_nombre()));
  return new;
end $$;
revoke execute on function corregir_odontograma() from public, anon, authenticated;

drop trigger if exists corregir_odontograma on odontogramas;
create trigger corregir_odontograma before update or delete on odontogramas
  for each row execute function corregir_odontograma();

-- Eliminar un paciente con todo lo suyo (turnos, odontogramas, historia) y su cuenta de Mi espacio.
-- SOLO PARA LA ETAPA DE PRUEBAS: se quita antes de cargar pacientes reales (ver PENDIENTES.md).
create or replace function eliminar_paciente(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_usuario uuid;
begin
  if mi_rol() is distinct from 'admin' then raise exception 'Solo un admin puede eliminar pacientes.'; end if;
  select usuario_id into v_usuario from pacientes where id = p_id;
  if not found then raise exception 'No encontramos ese paciente.'; end if;
  delete from pacientes where id = p_id;  -- borrar turnos no envía correos (el aviso es solo al crear o cambiar)
  -- La cuenta solo se borra si es de paciente (nunca la de alguien del personal)
  if v_usuario is not null and (select rol from perfiles where id = v_usuario) = 'paciente' then
    delete from auth.users where id = v_usuario;
  end if;
end $$;
revoke execute on function eliminar_paciente(uuid) from public, anon;
grant execute on function eliminar_paciente(uuid) to authenticated;

-- Permisos de ejecución
revoke execute on function horarios_libres(date, int), horarios_sobreturno(date, int), pedir_turno(timestamptz, text), cancelar_mi_turno(uuid),
  actualizar_mis_datos(text, text, text), cuentas_sin_vincular() from public, anon;
grant execute on function horarios_libres(date, int), horarios_sobreturno(date, int), pedir_turno(timestamptz, text), cancelar_mi_turno(uuid),
  actualizar_mis_datos(text, text, text), cuentas_sin_vincular() to authenticated;

-- Funciones internas: los disparadores y auxiliares no se llaman directamente desde la API.
revoke execute on function al_registrarse(), al_confirmar_email(), completar_autor(), proteger_rol(), mi_nombre(),
  preparar_turno(), bloqueado(timestamptz, timestamptz)
  from public, anon, authenticated;
-- Las que usan las reglas de permisos: solo usuarios con sesión.
revoke execute on function mi_rol(), es_personal(), es_clinico(), mi_paciente_id() from public, anon;
grant execute on function mi_rol(), es_personal(), es_clinico(), mi_paciente_id() to authenticated;

-- ---------- Avisos en vivo (Realtime) ----------
-- Las pantallas del personal se actualizan solas cuando cambia un turno.
-- Los avisos respetan las mismas reglas de permisos: el personal recibe todos; un paciente, solo los suyos.
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'turnos') then
    alter publication supabase_realtime add table turnos;
  end if;
end $$;

-- ---------- Correos automáticos al paciente ----------
-- Cuando un turno se confirma, cambia de horario, lo agenda el personal o lo cancela el consultorio,
-- la base llama al script de Google (google/avisos.gs), que envía el correo desde Gmail.
-- La llamada es asíncrona (pg_net): no demora ni puede impedir el cambio del turno.
-- La dirección del script y la clave secreta se guardan en Vault (avisos_url, avisos_secreto); ver google/LEEME.md.
-- Sin correo en la ficha, o sin esos dos secretos cargados, no se envía nada.
do $$ begin
  create extension if not exists pg_net with schema extensions;
exception when others then
  raise notice 'pg_net no disponible en esta base: los correos automáticos quedan desactivados.';
end $$;

create or replace function avisar_turno() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_tipo text;
  v_anterior timestamptz;
  v_era_pedido boolean := false;
  v_a_pedido boolean := false;
  v_pac pacientes%rowtype;
  v_horas int;
  v_url text;
  v_secreto text;
begin
  if tg_op = 'INSERT' then
    -- Turno dado directamente por el personal
    if new.estado = 'confirmado' and new.creado_por = 'personal' then v_tipo := 'agendado'; end if;
  elsif new.estado = 'confirmado' and old.estado in ('pendiente', 'confirmado') and new.inicio is distinct from old.inicio then
    v_tipo := 'cambio';
    v_anterior := old.inicio;
  elsif new.estado = 'confirmado' and old.estado = 'pendiente' then
    v_tipo := 'confirmado';
  elsif new.estado in ('cancelado', 'rechazado') and old.estado in ('pendiente', 'confirmado') and new.cancelado_en is null then
    -- Lo canceló el personal (cuando cancela el paciente online, cancelar_mi_turno completa cancelado_en).
    -- a_pedido: el paciente lo pidió por WhatsApp o teléfono; si no, lo canceló el consultorio.
    v_tipo := 'cancelado';
    v_era_pedido := old.estado = 'pendiente';
    v_a_pedido := new.cancelado_por is not distinct from 'paciente';
  end if;

  if v_tipo is null or new.inicio < now() then return new; end if;

  select * into v_pac from pacientes where id = new.paciente_id;
  if coalesce(trim(v_pac.email), '') = '' then return new; end if;

  begin
    select decrypted_secret into v_url from vault.decrypted_secrets where name = 'avisos_url';
    select decrypted_secret into v_secreto from vault.decrypted_secrets where name = 'avisos_secreto';
    if v_url is null or v_secreto is null then return new; end if;
    select horas_cancelacion into v_horas from agenda_config where id = 1;

    perform net.http_post(
      url := v_url,
      body := jsonb_build_object(
        'secreto', v_secreto,
        'tipo', v_tipo,
        'email', trim(v_pac.email),
        'nombre', v_pac.nombre,
        'inicio', new.inicio,
        'inicio_anterior', v_anterior,
        'duracion', new.duracion,
        'motivo', new.motivo,
        'era_pedido', v_era_pedido,
        'a_pedido', v_a_pedido,
        'horas_cancelacion', v_horas),
      headers := '{"Content-Type": "application/json"}'::jsonb,
      timeout_milliseconds := 15000);
  exception when others then
    -- Un problema con el aviso nunca debe impedir confirmar, cambiar o cancelar el turno
    raise warning 'No se pudo encolar el correo del turno %: %', new.id, sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists avisar_turno on turnos;
create trigger avisar_turno after insert or update of estado, inicio on turnos
  for each row execute function avisar_turno();

revoke execute on function avisar_turno() from public, anon, authenticated;

-- ---------- Copia de seguridad semanal ----------
-- Una vez por semana la base arma una copia de sus tablas y se la manda al script de Google
-- (google/avisos.gs), que la guarda en Drive. Usa la misma dirección y clave de Vault que los correos.
-- No incluye las cuentas (auth.users): al reconstruir, cada paciente vuelve a crear su cuenta y queda
-- vinculado a su ficha por DNI y correo. Para restaurar: supabase/restaurar.sql.
create or replace function enviar_respaldo() returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_url text;
  v_secreto text;
  v_respaldo jsonb;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'avisos_url';
  select decrypted_secret into v_secreto from vault.decrypted_secrets where name = 'avisos_secreto';
  if v_url is null or v_secreto is null then
    raise exception 'Faltan los secretos avisos_url / avisos_secreto en Vault.';
  end if;
  v_respaldo := jsonb_build_object(
    'version', 1,
    'creado', now(),
    'tablas', jsonb_build_object(
      'perfiles',        (select coalesce(jsonb_agg(to_jsonb(x) order by x.id), '[]') from perfiles x),
      'pacientes',       (select coalesce(jsonb_agg(to_jsonb(x) order by x.id), '[]') from pacientes x),
      'antecedentes',    (select coalesce(jsonb_agg(to_jsonb(x) order by x.paciente_id), '[]') from antecedentes x),
      'agenda_config',   (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from agenda_config x),
      'agenda_horarios', (select coalesce(jsonb_agg(to_jsonb(x) order by x.id), '[]') from agenda_horarios x),
      'agenda_bloqueos', (select coalesce(jsonb_agg(to_jsonb(x) order by x.fecha), '[]') from agenda_bloqueos x),
      'turnos',          (select coalesce(jsonb_agg(to_jsonb(x) order by x.inicio), '[]') from turnos x),
      'odontogramas',    (select coalesce(jsonb_agg(to_jsonb(x) order by x.creado_en), '[]') from odontogramas x),
      'evoluciones',     (select coalesce(jsonb_agg(to_jsonb(x) order by x.creado_en), '[]') from evoluciones x),
      -- De las fotos se copia la lista y las secciones; los archivos quedan guardados en Cloudflare R2
      'foto_secciones',  (select coalesce(jsonb_agg(to_jsonb(x) order by x.creado_en), '[]') from foto_secciones x),
      'fotos',           (select coalesce(jsonb_agg(to_jsonb(x) order by x.creado_en), '[]') from fotos x)));
  return net.http_post(
    url := v_url,
    body := jsonb_build_object('secreto', v_secreto, 'tipo', 'respaldo', 'respaldo', v_respaldo),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 60000);
end $$;
revoke execute on function enviar_respaldo() from public, anon, authenticated;

-- Tarea semanal: domingos a las 3:00 de Argentina (6:00 UTC). Requiere pg_cron (incluido en Supabase).
do $$ begin
  create extension if not exists pg_cron with schema pg_catalog;
  grant usage on schema cron to postgres;
  grant all privileges on all tables in schema cron to postgres;
  perform cron.schedule('respaldo-semanal', '0 6 * * 0', 'select public.enviar_respaldo()');
exception when others then
  raise notice 'pg_cron no disponible en esta base: la copia semanal no queda programada (%).', sqlerrm;
end $$;
