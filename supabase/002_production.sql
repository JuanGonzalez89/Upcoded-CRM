-- Ejecutar después de schema.sql para activar mantenimiento de producción.

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists prospects_set_updated_at on public.prospects;
create trigger prospects_set_updated_at before update on public.prospects for each row execute function public.set_updated_at();

-- La función ya existe en schema.sql. pg_cron elimina los temporales aun si nadie abre el CRM.
create extension if not exists pg_cron;
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'upcoded-purge-expired-prospects') then
    perform cron.schedule('upcoded-purge-expired-prospects', '*/15 * * * *', 'select public.purge_expired_temporary_prospects()');
  end if;
end;
$$;
