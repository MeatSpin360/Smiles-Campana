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
  duracion           int not null default 30 check (duracion between 10 and 180),
  dias_visibles      int not null default 30 check (dias_visibles between 1 and 120),
  horas_cancelacion  int not null default 12 check (horas_cancelacion between 0 and 168)
);
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

create table if not exists agenda_bloqueos (
  fecha   date primary key,
  motivo  text
);

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
  cambio_ofrecido_en timestamptz  -- cuándo se le ofreció otro horario por un pedido pendiente
);
alter table turnos add column if not exists cancelado_en timestamptz;
alter table turnos add column if not exists inicio_pedido timestamptz;
alter table turnos add column if not exists cambio_ofrecido_en timestamptz;
-- Nunca dos turnos activos en el mismo horario (un pedido pendiente también reserva el horario)
create unique index if not exists turnos_un_horario on turnos (inicio) where estado not in ('cancelado', 'rechazado');
create index if not exists turnos_paciente on turnos (paciente_id);

-- Cada guardado del odontograma es una versión nueva (historial clínico inmutable).
create table if not exists odontogramas (
  id                 uuid primary key default gen_random_uuid(),
  paciente_id        uuid not null references pacientes on delete cascade,
  datos              jsonb not null,
  nota               text,
  creado_por         uuid references perfiles(id),
  creado_por_nombre  text,
  creado_en          timestamptz not null default now()
);
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

-- evoluciones: solo odontología/admin
create policy "clinico ve evoluciones" on evoluciones for select to authenticated
  using ((select es_clinico()));
create policy "clinico registra evoluciones" on evoluciones for insert to authenticated
  with check ((select es_clinico()) and creado_por = (select auth.uid()));

-- ---------- Funciones que usan los pacientes y el personal ----------

-- Horarios libres (no expone quién tiene los otros turnos)
create or replace function horarios_libres(desde date, dias int)
returns setof timestamptz
language sql stable security definer set search_path = public as $$
  with c as (select duracion from agenda_config where id = 1),
  d as (select (desde + g)::date as fecha from generate_series(0, least(greatest(dias, 1), 120) - 1) g),
  s as (
    select ((d.fecha + h.desde) + make_interval(mins => k * c.duracion)) at time zone 'America/Argentina/Buenos_Aires' as inicio
    from d
    join agenda_horarios h on h.dia = extract(dow from d.fecha)
    cross join c
    cross join lateral generate_series(0, floor(extract(epoch from (h.hasta - h.desde)) / 60 / c.duracion)::int - 1) k
    where d.fecha not in (select fecha from agenda_bloqueos)
  )
  select s.inicio from s
  where s.inicio > now() + interval '1 hour'
    and not exists (select 1 from turnos t where t.inicio = s.inicio and t.estado not in ('cancelado', 'rechazado'))
  order by s.inicio
$$;

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
  update turnos set estado = 'cancelado', cancelado_en = now() where id = p_id returning * into v_turno;
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

-- Permisos de ejecución
revoke execute on function horarios_libres(date, int), pedir_turno(timestamptz, text), cancelar_mi_turno(uuid),
  actualizar_mis_datos(text, text, text), cuentas_sin_vincular() from public, anon;
grant execute on function horarios_libres(date, int), pedir_turno(timestamptz, text), cancelar_mi_turno(uuid),
  actualizar_mis_datos(text, text, text), cuentas_sin_vincular() to authenticated;

-- Funciones internas: los disparadores y auxiliares no se llaman directamente desde la API.
revoke execute on function al_registrarse(), al_confirmar_email(), completar_autor(), proteger_rol(), mi_nombre()
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
